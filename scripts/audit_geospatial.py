#!/usr/bin/env python3
"""Reproducible geospatial quality audit for every grouped GeoPackage.

This is a diagnostic audit, not an automatic geometry repair tool.  It checks:
* SQLite/GeoPackage structure, CRS declarations, geometry validity and extents;
* implausible coordinates, duplicate point locations and Nigeria-scope outliers;
* administrative name/geometry containment and cross-source boundary agreement;
* distances between independently sourced versions of the same linear features;
* raster tile-matrix georeferencing and raster/vector registration where a paired
  representation of the same classification exists.

The script never modifies source GeoPackages.  Metric calculations use WGS 84 /
UTM zone 32N (EPSG:32632); this is suitable for Nigeria-wide diagnostic distances,
not legal surveying.  Results are written as JSON, Markdown and actionable CSVs.

    python scripts/audit_geospatial.py
    python scripts/audit_geospatial.py --output-dir docs/geospatial-audit

Requires the normal build dependencies plus shapely and pyproj.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import re
import sqlite3
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

import numpy as np
import pyproj
import shapely
import tifffile
from shapely import wkb
from shapely.geometry import MultiLineString, MultiPoint, Point
from shapely.ops import unary_union
from PIL import Image
from shapely.prepared import prep

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
METRIC_CRS = 32632
NIGERIA_BBOX = (2.5, 3.7, 15.2, 14.2)  # sheet/offshore envelope, not a land boundary

# Explicit scope notes come from the versioned cross-border policy. Layers using
# a safe kind default remain fully inventoried and checked for impossible geometry.
from cross_border_policy import (
    explicit_scope_notes, load_policy, policy_summary, register_rows,
    resolve_layer, validate_inventory,
)

CROSS_BORDER_POLICY = load_policy()
SCOPE_NOTES = explicit_scope_notes(CROSS_BORDER_POLICY)

# Point layers where being more than 10 km from GADM land deserves individual review.
POINT_REVIEW_EXEMPT = {
    'reference_world_countries_pg', 'reference_africa_countries_pg',
    'geology_heatflow_ihfc2024_pt', 'infrastructure_seaports_osm_pt',
    'infrastructure_airports_osm_pt', 'infrastructure_pois_osm_pt',
    'settlements_places_osm_pt', 'settlements_gazetteer_diva_pt',
}

TO_METRIC = pyproj.Transformer.from_crs(4326, METRIC_CRS, always_xy=True).transform
FROM_METRIC = pyproj.Transformer.from_crs(METRIC_CRS, 4326, always_xy=True).transform


def q(name):
    return '"' + name.replace('"', '""') + '"'


def norm(value):
    s = re.sub(r'[^a-z0-9]+', ' ', str(value or '').lower()).strip()
    aliases = {
        'federal capital territory': 'fct', 'federal capital territory fct': 'fct',
        'abuja federal capital territory': 'fct', 'abuja': 'fct',
        'nassarawa': 'nasarawa', 'kaba': 'kaba koton karfe',
    }
    return aliases.get(s, s)


def gpkg_geometry(blob):
    if blob is None or len(blob) < 8 or blob[:2] != b'GP':
        return None
    flags = blob[3]
    if (flags >> 4) & 1:
        return None
    envelope = (flags >> 1) & 7
    size = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}.get(envelope)
    if size is None:
        raise ValueError(f'unsupported GeoPackage envelope indicator {envelope}')
    return wkb.loads(blob[8 + size:])


def percentile(values, p):
    return float(np.percentile(values, p)) if len(values) else None


def distance_summary(values):
    a = np.asarray(values, dtype=float)
    a = a[np.isfinite(a)]
    if not len(a):
        return {'n': 0}
    return {
        'n': int(len(a)), 'median_km': percentile(a / 1000, 50),
        'p90_km': percentile(a / 1000, 90), 'p95_km': percentile(a / 1000, 95),
        'max_km': float(a.max() / 1000), 'within_1km': float((a <= 1000).mean()),
        'within_5km': float((a <= 5000).mean()), 'within_10km': float((a <= 10000).mean()),
    }


def shapely_metric(geom):
    return shapely.transform(geom, TO_METRIC, interleaved=False)


def geometry_bounds(geoms):
    valid = [g for g in geoms if g is not None and not g.is_empty]
    if not valid:
        return None
    b = shapely.total_bounds(np.asarray(valid, dtype=object))
    return [float(x) for x in b]


def bounds_delta(a, b):
    if not a or not b:
        return None
    return max(abs(float(x) - float(y)) for x, y in zip(a, b))


def iter_feature_tables(path):
    with sqlite3.connect(f'file:{path}?mode=ro', uri=True) as con:
        yield from con.execute(
            "select table_name from gpkg_contents where data_type='features' order by table_name"
        ).fetchall()


@lru_cache(maxsize=None)
def layer_index():
    index = {}
    for path in sorted(DATA.glob('*/**/*.gpkg')):
        with sqlite3.connect(f'file:{path}?mode=ro', uri=True) as con:
            rows = con.execute(
                'select table_name,data_type,srs_id,min_x,min_y,max_x,max_y from gpkg_contents'
            ).fetchall()
            for table, dtype, srs, *bounds in rows:
                if dtype == 'attributes':
                    continue
                index[table] = {
                    'table': table, 'path': path, 'group': path.parent.name,
                    'visible': not path.name.startswith('hidden_'), 'kind': dtype,
                    'srs_id': srs, 'declared_bounds': bounds if all(x is not None for x in bounds) else None,
                }
    return index


def load_features(table, selected=None):
    key = tuple(selected) if selected is not None else None
    return _load_features_cached(table, key)


@lru_cache(maxsize=12)
def _load_features_cached(table, selected=None):
    """Load features at full stored precision. selected=None loads all attributes."""
    meta = layer_index()[table]
    path = meta['path']
    features = []
    with sqlite3.connect(f'file:{path}?mode=ro', uri=True) as con:
        grow = con.execute(
            'select column_name,srs_id,geometry_type_name from gpkg_geometry_columns where table_name=?',
            (table,),
        ).fetchone()
        if grow is None:
            raise ValueError(f'{table}: not a registered feature table')
        gcol, srs, gtype = grow
        columns = [r[1] for r in con.execute(f'pragma table_info({q(table)})')]
        attrs = [c for c in columns if c not in (gcol, 'fid', 'ogc_fid')]
        if selected is not None:
            attrs = [c for c in selected if c in attrs]
        sql = f'select {q(gcol)}' + (',' + ','.join(q(c) for c in attrs) if attrs else '') + f' from {q(table)}'
        for row in con.execute(sql):
            geom = gpkg_geometry(row[0])
            features.append({'geometry': geom, 'properties': dict(zip(attrs, row[1:]))})
    return features, {'geometry_column': gcol, 'srs_id': srs, 'geometry_type': gtype}


def nigeria_reference():
    """GADM land states dissolved, excluding its special Water body/Lake Chad feature.

    This is a detailed internal diagnostic reference, not independent of GADM layers
    and not a legal boundary. Natural Earth supplies an independent comparison below.
    """
    states, _ = load_features('admin_states_gadm_pg', ['state'])
    return unary_union([f['geometry'] for f in states if f['geometry'] is not None
                        and norm(f['properties'].get('state')) != 'water body'])


def natural_earth_nigeria():
    feats, _ = load_features('reference_africa_countries_pg', ['name', 'iso3'])
    matches = [f['geometry'] for f in feats if f['properties'].get('iso3') == 'NGA'
               or norm(f['properties'].get('name')) == 'nigeria']
    if len(matches) != 1:
        raise ValueError(f'expected one Natural Earth Nigeria geometry, got {len(matches)}')
    return matches[0]


def point_scope(features, country_metric):
    """Return point distance-to-land diagnostics and detailed >10 km exceptions."""
    distances = []
    rows = []
    duplicates = Counter()
    for i, feature in enumerate(features):
        geom = feature['geometry']
        if geom is None or geom.is_empty:
            continue
        if geom.geom_type == 'Point':
            points = [geom]
        elif geom.geom_type == 'MultiPoint':
            points = list(geom.geoms)
        else:
            continue
        for point in points:
            x, y = point.x, point.y
            if -180 <= x <= 180 and -90 <= y <= 90:
                duplicates[(round(x, 8), round(y, 8))] += 1
            pm = shapely_metric(point)
            d = pm.distance(country_metric)
            distances.append(d)
            if d > 10000:
                rows.append({
                    'feature_index': i, 'distance_to_gadm_land_km': round(d / 1000, 3),
                    'longitude': round(x, 7), 'latitude': round(y, 7),
                    **{k: v for k, v in feature['properties'].items() if k in (
                        'name', 'state', 'lga', 'ward', 'country', 'adm1_name', 'wpdx_id',
                        'iso3', 'designation', 'feature_designation', 'mineral')},
                })
    duplicate_locations = sum(n - 1 for n in duplicates.values() if n > 1)
    return distance_summary(distances), {
        'over_10km': len(rows), 'over_50km': sum(r['distance_to_gadm_land_km'] > 50 for r in rows),
        'over_200km': sum(r['distance_to_gadm_land_km'] > 200 for r in rows),
        'duplicate_point_instances': duplicate_locations,
        'locations_with_duplicates': sum(n > 1 for n in duplicates.values()),
    }, rows


def audit_vector(table, country, country_metric):
    meta = layer_index()[table]
    features, ginfo = load_features(table)
    geoms = [f['geometry'] for f in features]
    nonnull = [g for g in geoms if g is not None]
    empty = sum(g.is_empty for g in nonnull)
    actual_bounds = geometry_bounds(nonnull)
    invalid = [i for i, g in enumerate(nonnull) if not g.is_valid]
    nonfinite = 0
    outside_lonlat = 0
    long_segments = 0
    max_segment_km = 0.0
    geometry_types = Counter()
    for geom in nonnull:
        if geom.is_empty:
            continue
        geometry_types[geom.geom_type] += 1
        coords = shapely.get_coordinates(geom)
        if len(coords):
            nonfinite += int((~np.isfinite(coords)).any())
            outside_lonlat += int(((np.abs(coords[:, 0]) > 180) | (np.abs(coords[:, 1]) > 90)).any())
        if geom.geom_type not in ('Point', 'MultiPoint'):
            for part in shapely.get_parts(geom):
                rings = [part] if part.geom_type == 'LineString' else (
                    [part.boundary] if part.geom_type == 'Polygon' else [])
                for ring in rings:
                    xy = shapely.get_coordinates(ring)
                    if len(xy) < 2:
                        continue
                    # Longitudinal degree length with latitude scaling is sufficient for spike screening.
                    dx = np.diff(xy[:, 0]) * 111.32 * np.cos(np.radians(xy[:-1, 1]))
                    dy = np.diff(xy[:, 1]) * 110.57
                    lengths = np.hypot(dx, dy)
                    if len(lengths):
                        max_segment_km = max(max_segment_km, float(lengths.max()))
                        long_segments += int((lengths > 500).sum())
    result = {
        **{k: v for k, v in meta.items() if k not in ('path',)},
        'path': str(meta['path'].relative_to(ROOT)), **ginfo,
        'feature_count': len(features), 'null_geometry': len(features) - len(nonnull),
        'is_topology_provenance': table.endswith('_topology_original'),
        'is_identity_provenance': table.endswith('_identity_original_pg') or table.endswith('_identity_original_pt'),
        'empty_geometry': empty, 'invalid_geometry_count': len(invalid),
        'invalid_feature_indices': invalid[:100], 'nonfinite_geometry_count': nonfinite,
        'outside_longitude_latitude_count': outside_lonlat, 'actual_bounds': actual_bounds,
        'declared_extent_max_delta_degrees': bounds_delta(actual_bounds, meta['declared_bounds']),
        'geometry_types': dict(geometry_types), 'segments_over_500km': long_segments,
        'max_segment_km': max_segment_km,
    }
    gtype = ginfo['geometry_type'].upper()
    if 'POINT' in gtype:
        summary, extra, rows = point_scope(features, country_metric)
        result['point_distance_to_gadm_land'] = summary
        result.update(extra)
        result['_outlier_rows'] = rows
    else:
        outside = 0
        no_intersection = 0
        for geom in nonnull:
            if geom.is_empty:
                continue
            if not country.covers(geom):
                outside += 1
            if not country.intersects(geom):
                no_intersection += 1
        result['features_not_fully_within_gadm_land'] = outside
        result['features_with_no_gadm_land_intersection'] = no_intersection
    policy_rule = resolve_layer(
        table, visible=meta['visible'], kind=meta['kind'], policy=CROSS_BORDER_POLICY)
    result['cross_border_policy'] = policy_rule
    result['scope_note'] = (
        'Hidden pre-topology-correction original; invalid geometries are expected historical evidence, not active data'
        if table.endswith('_topology_original') else
        'Hidden pre-Gada/Illela-identity-correction original; not current administration'
        if result['is_identity_provenance'] else
        policy_rule['scope_note'])
    return result


def boundary_samples(geom, maximum=4000):
    """Approximately evenly spaced metric samples along a line/boundary."""
    if geom is None or geom.is_empty:
        return np.empty((0, 2))
    length = geom.length
    if length <= 0:
        return np.empty((0, 2))
    n = max(2, min(maximum, int(length / 1000) + 1))
    distances = np.linspace(0, length, n)
    try:
        points = shapely.line_interpolate_point(geom, distances)
        return shapely.get_coordinates(points)
    except Exception:
        parts = [p for p in shapely.get_parts(geom) if p.geom_type == 'LineString']
        if not parts:
            return np.empty((0, 2))
        return np.concatenate([boundary_samples(p, max(2, maximum // len(parts))) for p in parts])


def boundary_agreement(name, source, target):
    """Symmetric nearest-boundary agreement, with robust nearest-point residuals."""
    sm, tm = shapely_metric(source.boundary), shapely_metric(target.boundary)
    ss, ts = boundary_samples(sm), boundary_samples(tm)
    out = {'comparison': name}
    for label, samples, target_geom in (('source_to_target', ss, tm), ('target_to_source', ts, sm)):
        if not len(samples):
            out[label] = {'n': 0}
            continue
        points = shapely.points(samples)
        distances = shapely.distance(points, target_geom)
        stats = distance_summary(distances)
        nearest_lines = shapely.shortest_line(points, target_geom)
        coords = shapely.get_coordinates(nearest_lines).reshape(-1, 2, 2)
        residual = coords[:, 1, :] - coords[:, 0, :]
        good = distances <= 5000
        stats['matched_within_5km_median_east_m'] = float(np.median(residual[good, 0])) if good.any() else None
        stats['matched_within_5km_median_north_m'] = float(np.median(residual[good, 1])) if good.any() else None
        out[label] = stats
    am, bm = shapely_metric(source), shapely_metric(target)
    inter = am.intersection(bm).area
    union = am.union(bm).area
    out['area_iou'] = float(inter / union) if union else None
    out['symmetric_difference_area_km2'] = float((am.area + bm.area - 2 * inter) / 1e6)
    return out


def metric_line_union(table):
    features, _ = load_features(table, [])
    geoms = [f['geometry'] for f in features if f['geometry'] is not None and not f['geometry'].is_empty]
    return unary_union([shapely_metric(g) for g in geoms])


def line_agreement(name, source_table, target_table, maximum=2500):
    source = metric_line_union(source_table)
    target = metric_line_union(target_table)
    result = {'comparison': name, 'source': source_table, 'target': target_table}
    for label, a, b in (('source_to_target', source, target), ('target_to_source', target, source)):
        coords = boundary_samples(a, maximum)
        if not len(coords):
            result[label] = {'n': 0}
            continue
        points = shapely.points(coords)
        distances = shapely.distance(points, b)
        stats = distance_summary(distances)
        lines = shapely.shortest_line(points, b)
        pairs = shapely.get_coordinates(lines).reshape(-1, 2, 2)
        residual = pairs[:, 1, :] - pairs[:, 0, :]
        good = distances <= 5000
        stats['matched_within_5km_median_east_m'] = float(np.median(residual[good, 0])) if good.any() else None
        stats['matched_within_5km_median_north_m'] = float(np.median(residual[good, 1])) if good.any() else None
        result[label] = stats
    return result


def admin_containment():
    states, _ = load_features('admin_states_gadm_pg', ['state', 'state_code'])
    lgas, _ = load_features('admin_lgas_gadm_pg', ['state', 'lga'])
    centroids, _ = load_features('admin_lga_centroids_pt', ['state', 'lga', 'position_qa'])
    wards, _ = load_features('admin_wards_pt', ['state', 'lga', 'ward'])
    state_lookup = {norm(f['properties']['state']): f for f in states}
    lga_lookup = {(norm(f['properties']['state']), norm(f['properties']['lga'])): f for f in lgas}
    country = nigeria_reference()
    result = {
        'state_count': len(states), 'lga_polygon_count': len(lgas),
        'lga_centroid_count': len(centroids), 'ward_point_count': len(wards),
        'state_names': sorted(f['properties']['state'] for f in states),
    }

    # Independent attribute-to-geometry joins for point datasets.
    for label, features in (('lga_centroids', centroids), ('wards', wards)):
        missing = []
        wrong_state = []
        distances = []
        outside = []
        for i, feature in enumerate(features):
            p = feature['properties']
            key = (norm(p.get('state')), norm(p.get('lga')))
            target = lga_lookup.get(key)
            if target is None:
                missing.append({'feature_index': i, **p})
                continue
            geom = feature['geometry']
            if geom is None or geom.is_empty:
                continue
            state = state_lookup.get(key[0])
            if state and not state['geometry'].intersects(geom):
                wrong_state.append({'feature_index': i, **p})
            if not target['geometry'].intersects(geom):
                d = shapely_metric(geom).distance(shapely_metric(target['geometry']))
                distances.append(d)
                outside.append({'feature_index': i, 'distance_to_named_lga_km': round(d / 1000, 3), **p})
        result[label] = {
            'missing_named_lga_matches': len(missing),
            'outside_named_lga': len(outside), 'outside_named_state': len(wrong_state),
            'outside_lga_distance': distance_summary(distances),
            'missing_examples': missing[:100], 'wrong_state_examples': wrong_state[:100],
            'outside_examples': sorted(outside, key=lambda r: -r['distance_to_named_lga_km'])[:200],
        }

    centroid_keys = {(norm(f['properties'].get('state')), norm(f['properties'].get('lga'))) for f in centroids}
    polygon_keys = set(lga_lookup)
    result['lga_key_differences'] = {
        'polygon_only': sorted(list(polygon_keys - centroid_keys)),
        'centroid_only': sorted(list(centroid_keys - polygon_keys)),
    }

    # LGA polygons should reconstruct their parent states without a spatial shift.
    grouped = defaultdict(list)
    for feature in lgas:
        grouped[norm(feature['properties']['state'])].append(feature['geometry'])
    state_iou = {}
    for key, state_feature in state_lookup.items():
        if key not in grouped:
            state_iou[key] = None
            continue
        a = shapely_metric(unary_union(grouped[key]))
        b = shapely_metric(state_feature['geometry'])
        union = a.union(b).area
        state_iou[key] = float(a.intersection(b).area / union) if union else None
    result['state_from_lgas_area_iou'] = state_iou
    result['minimum_state_from_lgas_iou'] = min(v for v in state_iou.values() if v is not None)

    # Same-state population polygons should not introduce a second geometry registration.
    population, _ = load_features('population_density2016_states_pg', ['state'])
    pop_lookup = {norm(f['properties']['state']): f for f in population}
    pop_ious = {}
    for key, state_feature in state_lookup.items():
        other = pop_lookup.get(key)
        if not other:
            continue
        a = shapely_metric(state_feature['geometry'])
        b = shapely_metric(other['geometry'])
        pop_ious[key] = float(a.intersection(b).area / a.union(b).area)
    result['population_state_geometry_iou'] = pop_ious
    result['minimum_population_state_iou'] = min(pop_ious.values()) if pop_ious else None
    return result


def audit_raster(table):
    meta = layer_index()[table]
    path = meta['path']
    with sqlite3.connect(f'file:{path}?mode=ro', uri=True) as con:
        z = con.execute(f'select max(zoom_level) from {q(table)}').fetchone()[0]
        matrix = con.execute(
            'select matrix_width,matrix_height,tile_width,tile_height,pixel_x_size,pixel_y_size '
            'from gpkg_tile_matrix where table_name=? and zoom_level=?', (table, z),
        ).fetchone()
        matrix_set = con.execute(
            'select srs_id,min_x,min_y,max_x,max_y from gpkg_tile_matrix_set where table_name=?', (table,),
        ).fetchone()
        tiles = con.execute(
            f'select zoom_level,tile_column,tile_row,tile_data from {q(table)} where zoom_level=?', (z,),
        ).fetchall()
        mw, mh, tw, th, px, py = matrix
        shapes = Counter()
        bad_tiles = []
        for zoom, col, row, blob in tiles:
            try:
                if meta['kind'] == 'tiles':
                    with Image.open(io.BytesIO(blob)) as image:
                        arr = np.asarray(image.convert('RGBA'))
                else:
                    arr = tifffile.imread(io.BytesIO(blob))
                shapes[tuple(arr.shape)] += 1
                if col < 0 or row < 0 or col >= mw or row >= mh:
                    bad_tiles.append({'column': col, 'row': row, 'reason': 'outside matrix'})
            except Exception as exc:
                bad_tiles.append({'column': col, 'row': row, 'reason': str(exc)})
        srs, mnx, mny, mxx, mxy = matrix_set
        west, south, east, north = meta['declared_bounds']
        width = int(round((east - mnx) / px))
        height = int(round((mxy - south) / py))
        expected_shape = (min(height, mh * th), min(width, mw * tw))
        computed_bounds = [mnx, mxy - expected_shape[0] * py, mnx + expected_shape[1] * px, mxy]
        result = {
            'table': table, 'path': str(path.relative_to(ROOT)), 'visible': meta['visible'],
            'srs_id': srs, 'zoom_level': z, 'tile_count_at_max_zoom': len(tiles),
            'matrix': {'width': mw, 'height': mh, 'tile_width': tw, 'tile_height': th,
                       'pixel_x_size': px, 'pixel_y_size': py},
            'tile_shapes': {str(k): v for k, v in shapes.items()}, 'bad_tiles': bad_tiles,
            'expected_stitched_shape': expected_shape, 'computed_bounds': computed_bounds,
            'declared_bounds': meta['declared_bounds'],
            'bounds_max_delta_degrees': bounds_delta(computed_bounds, meta['declared_bounds']),
            'pixel_size_positive': px > 0 and py > 0,
        }
    result['cross_border_policy'] = resolve_layer(
        table, visible=meta['visible'], kind=meta['kind'], policy=CROSS_BORDER_POLICY)
    result['scope_note'] = result['cross_border_policy']['scope_note']
    return result


def capital_checks():
    capitals, _ = load_features('settlements_state_capitals_map2023_pt',
                                ['name', 'state', 'position_basis'])
    states, _ = load_features('admin_states_gadm_pg', ['state'])
    state_lookup = {norm(f['properties']['state']): f for f in states}
    rows = []
    for i, feature in enumerate(capitals):
        p = feature['properties']
        state = state_lookup.get(norm(p.get('state')))
        if not state:
            rows.append({'feature_index': i, **p, 'issue': 'state name not found'})
            continue
        geom = feature['geometry']
        if not state['geometry'].intersects(geom):
            d = shapely_metric(geom).distance(shapely_metric(state['geometry']))
            rows.append({'feature_index': i, **p, 'issue': 'outside named state',
                         'distance_km': round(d / 1000, 3)})
    return {'capital_count': len(capitals), 'issues': rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'docs' / 'geospatial-audit')
    args = parser.parse_args()
    out = args.output_dir
    out.mkdir(parents=True, exist_ok=True)

    index = layer_index()
    validate_inventory(index, CROSS_BORDER_POLICY)
    feature_tables = sorted(t for t, m in index.items() if m['kind'] == 'features')
    raster_tables = sorted(t for t, m in index.items() if m['kind'] in ('2d-gridded-coverage', 'tiles'))
    print(f'Auditing {len(index)} spatial layers in {len(set(m["path"] for m in index.values()))} GeoPackages')

    # Database integrity includes attribute-only tables and all hidden files.
    database_integrity = []
    for path in sorted(DATA.glob('*/**/*.gpkg')):
        with sqlite3.connect(f'file:{path}?mode=ro', uri=True) as con:
            check = con.execute('pragma integrity_check').fetchone()[0]
        database_integrity.append({'path': str(path.relative_to(ROOT)), 'integrity_check': check})
        if check != 'ok':
            raise RuntimeError(f'{path}: SQLite integrity_check = {check}')

    country = nigeria_reference()
    country_metric = shapely_metric(country)
    vectors = {}
    outlier_rows = []
    for i, table in enumerate(feature_tables, 1):
        print(f'[{i}/{len(feature_tables)}] {table}', flush=True)
        result = audit_vector(table, country, country_metric)
        for row in result.pop('_outlier_rows', []):
            outlier_rows.append({'layer': table, **row})
        vectors[table] = result

    rasters = {}
    for table in raster_tables:
        print(f'Raster/georeferencing: {table}', flush=True)
        rasters[table] = audit_raster(table)

    print('Administrative containment and boundary comparisons', flush=True)
    admin = admin_containment()
    capitals = capital_checks()
    all_states, _ = load_features('admin_states_gadm_pg', ['state'])
    gadm_with_water = unary_union([f['geometry'] for f in all_states if f['geometry'] is not None])
    boundaries = [
        boundary_agreement('GADM land (Lake Chad water body excluded) vs geoBoundaries national polygon', country,
                           load_features('admin_country_geoboundaries_pg', [])[0][0]['geometry']),
        boundary_agreement('GADM including Lake Chad water body vs ESRI national polygon', gadm_with_water,
                           load_features('admin_country_esri_pg', [])[0][0]['geometry']),
        boundary_agreement('GADM land vs Natural Earth Nigeria', country, natural_earth_nigeria()),
        boundary_agreement('geoBoundaries national polygon vs Natural Earth Nigeria',
                           load_features('admin_country_geoboundaries_pg', [])[0][0]['geometry'],
                           natural_earth_nigeria()),
    ]
    comparisons = []
    comparison_specs = [
        ('2011 geology unit contacts vs unit polygon boundaries',
         'geology_unit_boundaries_map2011_ln', 'geology_units_map2011_pg'),
        ('2011 railways vs DIVA railways', 'transport_railways_map2011_ln', 'transport_railways_diva_ln'),
        ('2023 railways vs DIVA railways', 'transport_railways_map2023_ln', 'transport_railways_diva_ln'),
        ('2011 roads vs DIVA roads', 'transport_roads_map2011_ln', 'transport_roads_diva_ln'),
        ('2023 roads vs DIVA roads', 'transport_roads_map2023_ln', 'transport_roads_diva_ln'),
        ('2011 rivers vs DIVA water lines', 'water_rivers_map2011_ln', 'water_lines_diva_ln'),
        ('2023 rivers vs DIVA water lines', 'water_rivers_map2023_ln', 'water_lines_diva_ln'),
        ('WFP major rivers vs DIVA water lines', 'water_rivers_major_wfp_ln', 'water_lines_diva_ln'),
    ]
    for name, source, target in comparison_specs:
        print(f'Cross-layer: {name}', flush=True)
        if target.endswith('_pg'):
            target_features, _ = load_features(target, [])
            target_geom = unary_union([f['geometry'].boundary for f in target_features
                                       if f['geometry'] is not None])
            source_geom = metric_line_union(source)
            target_metric = shapely_metric(target_geom)
            coords = boundary_samples(source_geom, 3000)
            distances = shapely.distance(shapely.points(coords), target_metric)
            comparisons.append({'comparison': name, 'source': source, 'target': target,
                                'source_to_target': distance_summary(distances)})
        else:
            comparisons.append(line_agreement(name, source, target))

    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    geometry_summary = {
        'active_vector_layers': sum(
            not (v['is_topology_provenance'] or v['is_identity_provenance']) for v in vectors.values()),
        'active_invalid_geometry_count': sum(
            v['invalid_geometry_count'] for v in vectors.values()
            if not (v['is_topology_provenance'] or v['is_identity_provenance'])),
        'topology_provenance_layers': sum(v['is_topology_provenance'] for v in vectors.values()),
        'topology_provenance_invalid_geometry_count': sum(
            v['invalid_geometry_count'] for v in vectors.values() if v['is_topology_provenance']),
        'identity_provenance_layers': sum(v['is_identity_provenance'] for v in vectors.values()),
        'identity_provenance_invalid_geometry_count': sum(
            v['invalid_geometry_count'] for v in vectors.values() if v['is_identity_provenance']),
    }
    cross_border_summary = policy_summary(index, CROSS_BORDER_POLICY)
    report = {
        'generated_utc': datetime.now(timezone.utc).isoformat(),
        'source_commit': commit, 'metric_crs': f'EPSG:{METRIC_CRS}',
        'cross_border_policy': cross_border_summary,
        'method_limitations': [
            'Internal agreement does not by itself prove absolute ground truth.',
            'Different survey dates, map scales and generalisation can create legitimate residuals.',
            'GADM land is a reference for diagnostics, not a legal or survey-grade boundary.',
            'Offshore, transboundary and map-sheet features follow ngmap-cross-border-v1; scope is not legal sovereignty or survey certification.',
            'No geometry is automatically repaired by this audit.',
        ],
        'database_integrity': database_integrity, 'vectors': vectors, 'rasters': rasters,
        'geometry_summary': geometry_summary,
        'administrative': admin, 'capitals': capitals,
        'boundary_comparisons': boundaries, 'line_comparisons': comparisons,
        'point_outliers_over_10km': len(outlier_rows),
    }
    (out / 'audit.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf8')

    policy_fields = [
        'layer', 'path', 'visibility', 'kind', 'scope_class', 'source_retention',
        'publication', 'national_statistics', 'foreign_features', 'provenance_of', 'scope_note',
    ]
    with (out / 'cross-border-policy-register.csv').open('w', newline='', encoding='utf8') as f:
        writer = csv.DictWriter(f, fieldnames=policy_fields)
        writer.writeheader()
        writer.writerows(register_rows(index, CROSS_BORDER_POLICY))

    fields = sorted({key for row in outlier_rows for key in row})
    with (out / 'point-outliers-over-10km.csv').open('w', newline='', encoding='utf8') as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(outlier_rows)

    # A compact preliminary Markdown report; interpretation is added after reviewing metrics.
    lines = [
        '# Geospatial quality audit', '',
        f'Source commit: `{commit}`  ', f'GeoPackages: **{len(database_integrity)}**  ',
        f'Feature layers: **{len(vectors)}**  ', f'Raster/image layers: **{len(rasters)}**  ',
        '', '## Headline metrics', '',
        f'- SQLite integrity failures: **{sum(r["integrity_check"] != "ok" for r in database_integrity)}**',
        f'- Null geometries: **{sum(v["null_geometry"] for v in vectors.values())}**',
        f'- Empty geometries: **{sum(v["empty_geometry"] for v in vectors.values())}**',
        f'- Active invalid geometries: **{geometry_summary["active_invalid_geometry_count"]}**',
        f'- Cross-border policy: **{cross_border_summary["policy_id"]}** across {cross_border_summary["layer_count"]} layers; sources preserved unclipped',
        f'- Historical invalid geometries in hidden topology provenance: **{geometry_summary["topology_provenance_invalid_geometry_count"]}**',
        f'- Non-finite or impossible lon/lat geometries: **{sum(v["nonfinite_geometry_count"] + v["outside_longitude_latitude_count"] for v in vectors.values())}**',
        f'- Point instances over 10 km from GADM land: **{len(outlier_rows)}** (includes documented scope exceptions)',
        f'- Capital points outside their named state: **{len(capitals["issues"])}**',
        f'- LGA centroid points outside their named LGA: **{admin["lga_centroids"]["outside_named_lga"]}**',
        f'- Ward points outside their named LGA: **{admin["wards"]["outside_named_lga"]}**',
        f'- Minimum state/LGA-dissolve IoU: **{admin["minimum_state_from_lgas_iou"]:.8f}**',
        f'- Minimum population/state geometry IoU: **{admin["minimum_population_state_iou"]:.8f}**',
        '', '## National boundary comparisons', '',
        '| Comparison | Area IoU | Source→target median / p95 km | Target→source median / p95 km |',
        '|---|---:|---:|---:|',
    ]
    for row in boundaries:
        a, b = row['source_to_target'], row['target_to_source']
        lines.append(f'| {row["comparison"]} | {row["area_iou"]:.5f} | '
                     f'{a["median_km"]:.3f} / {a["p95_km"]:.3f} | {b["median_km"]:.3f} / {b["p95_km"]:.3f} |')
    lines += ['', '## Cross-layer line comparisons', '',
              '| Comparison | Direction | Median km | P95 km | Within 5 km |',
              '|---|---|---:|---:|---:|']
    for row in comparisons:
        for direction in ('source_to_target', 'target_to_source'):
            if direction not in row or not row[direction].get('n'):
                continue
            stats = row[direction]
            lines.append(f'| {row["comparison"]} | {direction} | {stats["median_km"]:.3f} | '
                         f'{stats["p95_km"]:.3f} | {stats["within_5km"]:.1%} |')
    lines += ['', '## Layer inventory', '',
              '| Layer | Visibility | Features | Invalid | Null/empty | Not fully within GADM land | Scope |',
              '|---|---|---:|---:|---:|---:|---|']
    for table, row in vectors.items():
        outside = row.get('features_not_fully_within_gadm_land', row.get('over_10km', '—'))
        lines.append(f'| `{table}` | {"visible" if row["visible"] else "hidden"} | {row["feature_count"]} | '
                     f'{row["invalid_geometry_count"]} | {row["null_geometry"] + row["empty_geometry"]} | '
                     f'{outside} | {row["scope_note"]} |')
    lines += ['', '## Limitations', ''] + [f'- {x}' for x in report['method_limitations']]
    (out / 'README.md').write_text('\n'.join(lines) + '\n', encoding='utf8')
    print(f'Wrote {out / "audit.json"}, {out / "README.md"} and outlier CSV')


if __name__ == '__main__':
    main()
