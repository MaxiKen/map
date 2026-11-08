#!/usr/bin/env python3
"""Extended, independent alignment checks and professional report.

Run scripts/audit_geospatial.py first, then this script.  It reads the core
inventory and adds same-name point corroboration, detailed administrative
exceptions, exact raster/vector class agreement, raster land-mask registration,
topology reasons and actionable CSV evidence.  Source data is never modified.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import sqlite3
import sys
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path

import numpy as np
import shapely
import tifffile
from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import Point
from shapely.ops import unary_union

from audit_geospatial import (
    ROOT, DATA, SCOPE_NOTES, distance_summary, gpkg_geometry, layer_index, load_features,
    natural_earth_nigeria, nigeria_reference, norm, percentile, shapely_metric,
)
import build_site
import layer_quality_register as layer_quality
from cross_border_policy import load_policy, resolve_layer


def write_csv(path, rows, fieldnames=None):
    fields = fieldnames or sorted({key for row in rows for key in row})
    if not rows and not fields:
        path.write_text('')
        return
    with path.open('w', newline='', encoding='utf8') as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(rows)


def load_raster(table):
    meta = layer_index()[table]
    with sqlite3.connect(meta['path']) as con:
        ancillary = con.execute(
            'select data_null,uom,field_name from gpkg_2d_gridded_coverage_ancillary '
            'where tile_matrix_set_name=?', (table,),
        ).fetchone()
        nodata = float(ancillary[0]) if ancillary and ancillary[0] is not None else -9999.0
        build_site.table_fill = nodata
        try:
            array, bounds = build_site.stitch(
                con, table, lambda blob: tifffile.imread(io.BytesIO(blob)).astype(np.float32))
        finally:
            build_site.table_fill = None
    return array, bounds, nodata, ancillary


def values_inside(array, bounds, nodata, geometry, step=3):
    """Sample raster cells whose centres fall inside a vector geometry."""
    west, south, east, north = bounds
    height, width = array.shape
    minx, miny, maxx, maxy = geometry.bounds
    c0 = max(0, int((minx - west) / (east - west) * width) - 1)
    c1 = min(width, int(np.ceil((maxx - west) / (east - west) * width)) + 1)
    r0 = max(0, int((north - maxy) / (north - south) * height) - 1)
    r1 = min(height, int(np.ceil((north - miny) / (north - south) * height)) + 1)
    rows = np.arange(r0, r1, step)
    cols = np.arange(c0, c1, step)
    if not len(rows) or not len(cols):
        return np.array([], dtype=array.dtype)
    x = west + (cols + 0.5) * (east - west) / width
    y = north - (rows + 0.5) * (north - south) / height
    xx, yy = np.meshgrid(x, y)
    mask = shapely.contains_xy(geometry, xx, yy)
    values = array[np.ix_(rows, cols)][mask]
    return values[(values != nodata) & np.isfinite(values)]


def values_at_representative_points(array, bounds, nodata, features):
    west, south, east, north = bounds
    height, width = array.shape
    points = [f['geometry'].representative_point() for f in features]
    x = np.array([p.x for p in points])
    y = np.array([p.y for p in points])
    cols = np.floor((x - west) / (east - west) * width).astype(int)
    rows = np.floor((north - y) / (north - south) * height).astype(int)
    valid_index = (rows >= 0) & (rows < height) & (cols >= 0) & (cols < width)
    values = np.full(len(features), np.nan, dtype=float)
    values[valid_index] = array[rows[valid_index], cols[valid_index]]
    values[values == nodata] = np.nan
    return values


def capital_cross_source_checks():
    table = 'settlements_state_capitals_map2023_pt'
    meta = layer_index()[table]
    with sqlite3.connect(f'file:{meta["path"]}?mode=ro', uri=True) as con:
        columns = {row[1] for row in con.execute(f'pragma table_info({table})')}
    fields = ['name', 'state', 'position_basis'] + [
        field for field in ('offset_from_basis_km', 'coordinate_source',
                            'correction_distance_km', 'previous_longitude',
                            'previous_latitude', 'qa_note') if field in columns]
    capitals, _ = load_features(table, fields)
    osm, _ = load_features('settlements_places_osm_pt', ['name', 'place', 'state'])
    diva, _ = load_features(
        'settlements_gazetteer_diva_pt', ['name', 'feature_designation', 'state'])
    states, _ = load_features('admin_states_gadm_pg', ['state'])
    state_lookup = {norm(f['properties']['state']): f['geometry'] for f in states}
    rows = []
    for index, feature in enumerate(capitals):
        props = feature['properties']
        source = feature['geometry']
        source_metric = shapely_metric(source)
        row = {
            'feature_index': index, 'capital': props['name'], 'state': props['state'],
            'position_basis': props['position_basis'],
            'reported_offset_from_basis_km': props.get('offset_from_basis_km'),
            'coordinate_source': props.get('coordinate_source'),
            'correction_distance_km': props.get('correction_distance_km'),
            'previous_longitude': props.get('previous_longitude'),
            'previous_latitude': props.get('previous_latitude'),
            'qa_note': props.get('qa_note'),
            'source_longitude': source.x, 'source_latitude': source.y,
        }
        # DIVA informed candidate ranking when several equally ranked OSM nodes
        # were available, and the individually reviewed Yola choice. Exclude
        # those cases from the strict held-out summary; retain their broader
        # cross-source comparison separately.
        selection_informed = False
        if props.get('coordinate_source', '').startswith('OpenStreetMap'):
            state_geometry = state_lookup[norm(props['state'])]
            eligible_osm = [f for f in osm
                            if norm(f['properties'].get('name')) == norm(props['name'])
                            and f['properties'].get('place') in ('city', 'town')
                            and state_geometry.intersects(f['geometry'])]
            if eligible_osm:
                best_rank = min(0 if f['properties']['place'] == 'city' else 1
                                for f in eligible_osm)
                equally_ranked = [f for f in eligible_osm
                                  if (0 if f['properties']['place'] == 'city' else 1) == best_rank]
                selection_informed = len(equally_ranked) > 1
            selection_informed = selection_informed or 'coincides with DIVA' in (props.get('qa_note') or '')
        row['diva_strict_held_out_eligible'] = not selection_informed
        for label, candidates in (('osm', osm), ('diva', diva)):
            matches = [f for f in candidates if norm(f['properties'].get('name')) == norm(props['name'])]
            if not matches:
                row[label + '_match_count'] = 0
                continue

            def score(candidate):
                p = candidate['properties']
                distance = shapely_metric(candidate['geometry']).distance(source_metric)
                if label == 'osm':
                    rank_bonus = {'city': 0, 'town': 1000}.get(p.get('place'), 4000)
                else:
                    rank_bonus = {
                        'seat of a first-order administrative division': 0,
                        'national capital': 0, 'populated place': 1000,
                    }.get(p.get('feature_designation'), 5000)
                    if p.get('feature_designation') == 'airport':
                        rank_bonus = 100000
                state_bonus = 0 if norm(p.get('state')) == norm(props['state']) else 10000
                return distance + rank_bonus + state_bonus

            best = min(matches, key=score)
            reference = best['geometry']
            reference_metric = shapely_metric(reference)
            row[label + '_match_count'] = len(matches)
            row[label + '_distance_km'] = source_metric.distance(reference_metric) / 1000
            row[label + '_reference_east_minus_source_m'] = reference_metric.x - source_metric.x
            row[label + '_reference_north_minus_source_m'] = reference_metric.y - source_metric.y
            row[label + '_longitude'] = reference.x
            row[label + '_latitude'] = reference.y
            row[label + '_place'] = best['properties'].get('place') or best['properties'].get('feature_designation')
            row[label + '_state'] = best['properties'].get('state')
        rows.append(row)

    summary = {}
    for label in ('osm', 'diva'):
        matched = [r for r in rows if r.get(label + '_distance_km') is not None]
        distances = np.array([r[label + '_distance_km'] for r in matched])
        summary[label] = {
            'matched_capitals': len(matched),
            'median_distance_km': float(np.median(distances)),
            'p95_distance_km': float(np.percentile(distances, 95)),
            'maximum_distance_km': float(distances.max()),
            'median_reference_east_minus_source_m': float(np.median(
                [r[label + '_reference_east_minus_source_m'] for r in matched])),
            'median_reference_north_minus_source_m': float(np.median(
                [r[label + '_reference_north_minus_source_m'] for r in matched])),
        }
    corrected = any(r.get('coordinate_source') for r in rows)
    if corrected:
        summary['osm']['validation_role'] = (
            'Construction/self-consistency check for the 32 OSM replacements; '
            'independent corroboration only for the five retained gazetteer positions.')
        summary['diva']['validation_role'] = (
            'Independent cross-source check; no DIVA coordinate was averaged into an output '
            'geometry. Candidate-disambiguation rows are selection-informed and excluded '
            'from the strict held-out subset. Same-name matching is not legal ground truth.')
        held_out = [r for r in rows if r.get('diva_distance_km') is not None
                    and r['diva_strict_held_out_eligible']]
        held_distances = np.array([r['diva_distance_km'] for r in held_out])
        summary['diva']['strict_held_out'] = {
            'eligible_capitals': len(held_out),
            'median_distance_km': float(np.median(held_distances)),
            'p95_distance_km': float(np.percentile(held_distances, 95)),
            'maximum_distance_km': float(held_distances.max()),
            'selection_informed_exclusions': [r['capital'] for r in rows
                                               if not r['diva_strict_held_out_eligible']],
        }
    grouped = {}
    for basis in sorted({r['position_basis'] for r in rows}):
        subset = [r for r in rows if r['position_basis'] == basis]
        distances = [r['osm_distance_km'] for r in subset if r.get('osm_distance_km') is not None]
        grouped[basis] = {
            'count': len(subset), 'osm_matches': len(distances),
            'median_osm_distance_km': float(np.median(distances)) if distances else None,
            'median_osm_east_minus_source_m': float(np.median(
                [r['osm_reference_east_minus_source_m'] for r in subset
                 if r.get('osm_reference_east_minus_source_m') is not None])) if distances else None,
            'median_osm_north_minus_source_m': float(np.median(
                [r['osm_reference_north_minus_source_m'] for r in subset
                 if r.get('osm_reference_north_minus_source_m') is not None])) if distances else None,
        }
    return {'summary': summary, 'by_position_basis': grouped}, rows


def ward_exception_checks(core_admin):
    lgas, _ = load_features('admin_lgas_gadm_pg', ['state', 'lga'])
    wards, _ = load_features('admin_wards_pt', ['state', 'lga', 'ward'])
    tree = shapely.STRtree([f['geometry'] for f in lgas])
    lookup = {(norm(f['properties']['state']), norm(f['properties']['lga'])): f for f in lgas}
    rows = []
    for index, feature in enumerate(wards):
        props = feature['properties']
        target = lookup[(norm(props['state']), norm(props['lga']))]
        geometry = feature['geometry']
        if target['geometry'].intersects(geometry):
            continue
        indices = tree.query(geometry, predicate='intersects')
        containing = [lgas[int(i)]['properties'] for i in indices]
        nearest = lgas[int(tree.nearest(geometry))]['properties']
        distance = shapely_metric(geometry).distance(shapely_metric(target['geometry'])) / 1000
        rows.append({
            'feature_index': index, 'assigned_state': props['state'], 'assigned_lga': props['lga'],
            'ward': props['ward'], 'longitude': geometry.x, 'latitude': geometry.y,
            'distance_to_assigned_lga_km': distance,
            'containing_state_lga': '; '.join(f"{p['state']} / {p['lga']}" for p in containing),
            'nearest_state_lga': f"{nearest['state']} / {nearest['lga']}",
        })
    reciprocal = [r for r in rows if
                  (r['assigned_lga'] == 'Gada' and r['containing_state_lga'] == 'Sokoto / Illela') or
                  (r['assigned_lga'] == 'Illela' and r['containing_state_lga'] == 'Sokoto / Gada')]
    sokoto = [r for r in rows if r['assigned_state'] == 'Sokoto'
              and r['assigned_lga'] in ('Gada', 'Illela')]
    residual_path = ROOT / 'docs/geospatial-audit/ward-lga-correction-result.json'
    residual = (json.loads(residual_path.read_text(encoding='utf8'))
                if residual_path.exists() else None)
    residual_reviewed = bool(
        residual and residual.get('status') == 'applied_and_verified' and
        all(residual['checks'].values()) and
        residual['post_correction']['residual_exception_count'] == len(rows) and
        residual['post_correction']['residual_feature_indices'] == [r['feature_index'] for r in rows])
    summary = {
        'total_outside_assigned_lga': len(rows),
        'within_1km_of_assigned_lga': sum(r['distance_to_assigned_lga_km'] <= 1 for r in rows),
        'over_10km_from_assigned_lga': sum(r['distance_to_assigned_lga_km'] > 10 for r in rows),
        'without_local_container': sum(not r['containing_state_lga'] for r in rows),
        'sokoto_gada_illela_exceptions': len(sokoto),
        'reciprocal_gada_illela_containment': len(reciprocal),
        'individual_review_complete': residual_reviewed,
        'pre_review_exception_count': residual['counts']['reviewed_cases'] if residual_reviewed else None,
        'review_lga_corrections': residual['counts']['lga_corrections'] if residual_reviewed else 0,
        'review_dispositions': residual['counts']['dispositions'] if residual_reviewed else {},
        'interpretation': (
            'All 40 residual cases were reviewed individually against INEC and an independent boundary service; '
            'three LGA attributes were corrected without geometry changes and 37 evidence-documented exceptions remain.'
            if residual_reviewed else
            'The verified identity correction resolved all 21 reciprocal exceptions without geometry changes; residual exceptions require separate review.'
            if len(reciprocal) == 0 and (ROOT / 'docs/geospatial-audit/gada-illela-correction-result.json').exists() else
            'The reciprocal pattern and same-name town locations indicate an LGA attribute conflict; do not shift ward coordinates to fit the polygons.'),
    }
    return summary, rows


def topology_checks(core):
    """Report active defects separately from preserved pre-repair originals."""
    reasons = Counter()
    provenance_reasons = Counter()
    by_layer = {}
    provenance_by_layer = {}
    rows = []
    provenance_rows = []
    for table, meta in layer_index().items():
        if meta['kind'] != 'features':
            continue
        is_provenance = table.endswith('_topology_original')
        features, _ = load_features(table, [])
        layer_reasons = Counter()
        for index, feature in enumerate(features):
            geometry = feature['geometry']
            if geometry is None or geometry.is_valid:
                continue
            reason = shapely.is_valid_reason(geometry)
            category = reason.split('[')[0].strip()
            layer_reasons[category] += 1
            row = {
                'layer': table, 'feature_index': index,
                'visibility': 'visible' if meta['visible'] else 'hidden',
                'reason': reason, 'bounds': ' '.join(str(v) for v in geometry.bounds),
            }
            if is_provenance:
                provenance_reasons[category] += 1
                provenance_rows.append(row)
            else:
                reasons[category] += 1
                rows.append(row)
        if layer_reasons:
            if is_provenance:
                provenance_by_layer[table] = dict(layer_reasons)
            else:
                by_layer[table] = dict(layer_reasons)
    return {
        'total_invalid': sum(reasons.values()),
        'visible_invalid': sum(r['visibility'] == 'visible' for r in rows),
        'hidden_invalid': sum(r['visibility'] == 'hidden' for r in rows),
        'reason_counts': dict(reasons), 'by_layer': by_layer,
        'provenance_invalid': len(provenance_rows),
        'provenance_layer_count': len(provenance_by_layer),
        'provenance_reason_counts': dict(provenance_reasons),
        'provenance_by_layer': provenance_by_layer,
        'interpretation': (
            'Zero active invalid geometries; hidden *_topology_original layers retain the 191 pre-correction defects as evidence.'
            if not rows and len(provenance_rows) == 191 else
            'Counts cover active layers only; hidden topology originals are reported separately.'),
    }, rows


def raster_registration_checks():
    result = {'class_pairs': [], 'land_masks': {}, 'comparison_notes': [
        'Historical picture polygons for climate, soil and population are not the same product/year as the modern rasters; their value disagreement is not used as a coordinate-failure test.',
        'Land-mask agreement detects gross raster shifts but does not validate the physical accuracy of each cell value.',
    ]}
    class_rows = []
    pair_specs = [
        ('geology_general_picture_code_rst', 'geology_general_picture_pg', None),
        ('geology_surficial_usgs_code_rst', 'geology_surficial_usgs_pg', 'glg_code'),
    ]
    for raster, vector, key in pair_specs:
        array, bounds, nodata, _ = load_raster(raster)
        features, _ = load_features(vector)
        expected = {}
        if key:
            with sqlite3.connect(layer_index()[raster]['path']) as con:
                columns = [r[1] for r in con.execute('pragma table_info(geology_surficial_usgs_legend_tbl)')]
                for values in con.execute('select * from geology_surficial_usgs_legend_tbl'):
                    props = dict(zip(columns, values))
                    expected[props[key]] = props['raster_value']
        for index, feature in enumerate(features):
            values = values_inside(array, bounds, nodata, feature['geometry'], step=3).astype(int)
            code = expected.get(feature['properties'].get(key), index + 1)
            codes, counts = np.unique(values, return_counts=True)
            order = np.argsort(-counts)
            row = {
                'raster': raster, 'vector': vector,
                'class': feature['properties'].get(key) or feature['properties'].get('class_name'),
                'expected_code': code, 'sampled_cells': len(values),
                'agreement_fraction': float((values == code).mean()) if len(values) else None,
                'dominant_codes': '; '.join(f'{codes[i]}:{counts[i]}' for i in order[:5]),
            }
            class_rows.append(row)
        result['class_pairs'].append({'raster': raster, 'vector': vector})

    # Valid-data footprints should follow the independent national land outline.
    land = nigeria_reference()
    for table, meta in layer_index().items():
        if meta['kind'] != '2d-gridded-coverage':
            continue
        array, bounds, nodata, _ = load_raster(table)
        step = 4 if max(array.shape) > 1000 else 2
        sampled = array[::step, ::step]
        height, width = sampled.shape
        west, south, east, north = bounds
        x = west + (np.arange(width) * step + 0.5) * (east - west) / array.shape[1]
        y = north - (np.arange(height) * step + 0.5) * (north - south) / array.shape[0]
        xx, yy = np.meshgrid(x, y)
        inside = shapely.contains_xy(land, xx, yy)
        valid = (sampled != nodata) & np.isfinite(sampled)
        result['land_masks'][table] = {
            'inside_land_valid_fraction': float(valid[inside].mean()),
            'outside_land_valid_fraction': float(valid[~inside].mean()),
            'whole_grid_valid_fraction': float(valid.mean()),
            'sample_stride_cells': step,
        }

    # State coverage explains the exceptional magnetic mask rather than hiding it.
    table = 'geophysics_magnetic_emag2_rst'
    array, bounds, nodata, _ = load_raster(table)
    height, width = array.shape
    west, south, east, north = bounds
    x = west + (np.arange(width) + 0.5) * (east - west) / width
    y = north - (np.arange(height) + 0.5) * (north - south) / height
    xx, yy = np.meshgrid(x, y)
    valid = (array != nodata) & np.isfinite(array)
    state_rows = []
    states, _ = load_features('admin_states_gadm_pg', ['state'])
    for feature in states:
        inside = shapely.contains_xy(feature['geometry'], xx, yy)
        if inside.any():
            state_rows.append({'state': feature['properties']['state'], 'cells': int(inside.sum()),
                               'valid_fraction': float(valid[inside].mean())})
    result['magnetic_valid_fraction_by_state'] = state_rows

    # Independent ordinal consistency for the World Bank landslide pair.
    array, bounds, nodata, _ = load_raster('hazards_landslide_rainfall_wb_rst')
    features, _ = load_features('hazards_landslide_classes_wb_pg', ['class_name', 'hazard_rank'])
    groups = defaultdict(list)
    for feature in features:
        groups[feature['properties']['hazard_rank']].append(
            values_inside(array, bounds, nodata, feature['geometry'], step=3))
    result['landslide_value_distributions'] = {}
    for rank, parts in sorted(groups.items()):
        values = np.concatenate(parts)
        result['landslide_value_distributions'][str(rank)] = {
            'sampled_cells': len(values),
            'p0_p25_p50_p75_p95_p100': np.percentile(values, [0, 25, 50, 75, 95, 100]).tolist(),
        }

    # 12,000 independent representative-point samples, not a handful of visual checks.
    array, bounds, nodata, _ = load_raster('settlements_builtup_ghsl2020_rst')
    features, _ = load_features('settlements_extents_grid3_pg', [])
    values = values_at_representative_points(array, bounds, nodata, features)
    finite = np.isfinite(values)
    result['settlement_builtup_samples'] = {
        'polygon_count': len(features), 'valid_samples': int(finite.sum()),
        'valid_sample_fraction': float(finite.mean()),
        'positive_builtup_fraction_among_valid': float((values[finite] > 0).mean()),
        'median_builtup_m2_per_cell': float(np.median(values[finite])),
    }

    # Large semantic outliers in the hidden historical district abstraction.
    # Registered semantic exclusions remain in the picture evidence but are not
    # misreported as unresolved administrative-district candidates.
    population_path = layer_index()['population_districts_picture_pg']['path']
    semantic_reviews = {}
    with sqlite3.connect(f'file:{population_path}?mode=ro', uri=True) as con:
        sidecar = 'population_districts_picture_semantic_review_tbl'
        if con.execute("select 1 from sqlite_master where type='table' and name=?",
                       (sidecar,)).fetchone():
            con.row_factory = sqlite3.Row
            for row in con.execute(
                    f'select district_id,classification,analysis_use,reason,'
                    f'state_intersection_count,lga_intersection_count,geometry_sha256 '
                    f'from {sidecar}'):
                semantic_reviews[row['district_id']] = dict(row)
    features, _ = load_features('population_districts_picture_pg',
                                ['district_id', 'class_name', 'area_km2'])
    result['population_districts_over_50000km2'] = [
        {**f['properties'], 'bounds': list(f['geometry'].bounds)}
        for f in features if (f['properties'].get('area_km2') or 0) > 50000 and
        f['properties'].get('district_id') not in semantic_reviews]
    result['population_connected_region_exclusions'] = [
        {**f['properties'], 'bounds': list(f['geometry'].bounds),
         **semantic_reviews[f['properties']['district_id']]}
        for f in features if f['properties'].get('district_id') in semantic_reviews]
    return result, class_rows, state_rows


def admin_name_equivalent(a, b):
    a, b = norm(a), norm(b)
    if a == b:
        return True
    if min(len(a), len(b)) >= 5 and (a in b or b in a):
        return True
    return SequenceMatcher(None, a, b).ratio() >= 0.80


def named_point_containment(table, state_field, lga_field=None):
    selected = [state_field] + ([lga_field] if lga_field else []) + ['name']
    features, _ = load_features(table, selected)
    if lga_field:
        targets, _ = load_features('admin_lgas_gadm_pg', ['state', 'lga'])
    else:
        targets, _ = load_features('admin_states_gadm_pg', ['state'])
    tree = shapely.STRtree([f['geometry'] for f in targets])
    points = np.asarray([f['geometry'] for f in features], dtype=object)
    pairs = tree.query(points, predicate='intersects')
    containers = defaultdict(list)
    for source, target in pairs.T:
        containers[int(source)].append(targets[int(target)]['properties'])
    stats = Counter()
    substantive = Counter()
    for index, feature in enumerate(features):
        props = feature['properties']
        state = props.get(state_field)
        lga = props.get(lga_field) if lga_field else None
        if not state or (lga_field and not lga):
            stats['missing_attributes'] += 1
            continue
        stats['named'] += 1
        containing = containers.get(index, [])
        if not containing:
            stats['no_reference_container'] += 1
            continue
        stats['contained'] += 1
        exact = any(norm(p['state']) == norm(state) and
                    (not lga_field or norm(p['lga']) == norm(lga)) for p in containing)
        if exact:
            stats['exact_name_match'] += 1
            continue
        stats['raw_name_mismatch'] += 1
        equivalent = any(norm(p['state']) == norm(state) and
                         (not lga_field or admin_name_equivalent(p['lga'], lga)) for p in containing)
        if equivalent:
            stats['spelling_or_naming_variant'] += 1
        else:
            stats['substantive_mismatch_after_fuzzy_names'] += 1
            for p in containing:
                substantive[(state, lga, p['state'], p.get('lga'))] += 1
    return {
        'counts': dict(stats),
        'top_substantive_mismatches': [
            {'assigned_state': key[0], 'assigned_lga': key[1],
             'containing_state': key[2], 'containing_lga': key[3], 'count': count}
            for key, count in substantive.most_common(30)],
    }


def classify_point_outliers(core_rows):
    africa, _ = load_features('reference_africa_countries_pg', ['name', 'iso3'])
    tree = shapely.STRtree([f['geometry'] for f in africa])
    rows = []
    for source in core_rows:
        row = dict(source)
        point = Point(float(row['longitude']), float(row['latitude']))
        indices = tree.query(point, predicate='intersects')
        countries = [africa[int(i)]['properties'] for i in indices]
        row['natural_earth_country'] = '; '.join(p['name'] for p in countries) or 'marine / unassigned'
        layer = row['layer']
        country = row['natural_earth_country']
        if layer == 'geology_heatflow_ihfc2024_pt':
            classification = 'expected offshore measurement'
        elif layer == 'infrastructure_seaports_osm_pt':
            classification = 'expected Lake Chad/coastal port context'
        elif layer == 'infrastructure_pois_osm_pt' and country == 'marine / unassigned':
            classification = 'expected marine/coastal extraction context'
        elif layer == 'settlements_towns_map2023_pt' and norm(row.get('name')) == 'tow ns':
            classification = 'probable scanned-map legend artefact; review'
        elif layer in ('settlements_places_osm_pt', 'infrastructure_pois_osm_pt') and country != 'marine / unassigned':
            classification = 'expected neighbouring-country extraction context'
        elif layer == 'settlements_gazetteer_diva_pt' and (
                row.get('feature_designation') in ('reef', 'shoal', 'stream') or country != 'marine / unassigned'):
            classification = 'expected marine/cross-border gazetteer context'
        elif layer == 'settlements_towns_map2023_pt' and country != 'marine / unassigned':
            classification = 'map content in neighbouring country; not a Nigerian coordinate shift'
        else:
            classification = 'feature-level review'
        row['classification'] = classification
        rows.append(row)
    return rows


def crs_checks():
    declarations = Counter()
    mismatches = []
    for path in sorted(DATA.glob('*/**/*.gpkg')):
        with sqlite3.connect(f'file:{path}?mode=ro', uri=True) as con:
            for table, dtype, contents_srs in con.execute(
                    "select table_name,data_type,srs_id from gpkg_contents where data_type!='attributes'"):
                row = con.execute(
                    'select srs_name,organization,organization_coordsys_id from gpkg_spatial_ref_sys where srs_id=?',
                    (contents_srs,),
                ).fetchone()
                declarations[(contents_srs, row)] += 1
                if dtype == 'features':
                    geometry_srs = con.execute(
                        'select srs_id from gpkg_geometry_columns where table_name=?', (table,),
                    ).fetchone()[0]
                    if geometry_srs != contents_srs:
                        mismatches.append({'path': str(path), 'table': table,
                                           'contents_srs': contents_srs, 'geometry_srs': geometry_srs})
    return {'declarations': [{'srs_id': key[0], 'srs_metadata': key[1], 'spatial_layer_count': count}
                             for key, count in declarations.items()],
            'contents_geometry_srs_mismatches': mismatches}


def magnetic_reclassification_is_current(result, raster):
    if not result or result.get('status') != 'reclassified_and_verified':
        return False
    path = layer_index()['geophysics_magnetic_emag2_rst']['path']
    return bool(
        all(result.get('checks', {}).values()) and
        hashlib.sha256(path.read_bytes()).hexdigest() == result.get('after_sha256') and
        result['classification'] == 'partial_coverage_no_interpolation' and
        result['coverage']['sampled_land']['valid_fraction'] ==
        raster['land_masks']['geophysics_magnetic_emag2_rst']['inside_land_valid_fraction'] and
        'partial coverage' in result['visible_label'].lower())


def hidden_artifact_resolution_is_current(result, core):
    if not result or result.get('status') != 'resolved_and_verified' or not all(result.get('checks', {}).values()):
        return False
    tables = {'towns': 'settlements_towns_map2023_pt',
              'population': 'population_districts_picture_pg'}
    for key, table in tables.items():
        path = layer_index()[table]['path']
        if (hashlib.sha256(path.read_bytes()).hexdigest() != result['after_sha256'][key] or
                core['vectors'][table]['feature_count'] != result['planned_counts'][key]):
            return False
    return True


def admin_identifiers_are_current(result):
    if not result or result.get('status') != 'installed_and_verified' or not all(result.get('checks', {}).values()):
        return False
    for table, expected in result.get('after_sha256', {}).items():
        if table not in layer_index() or hashlib.sha256(layer_index()[table]['path'].read_bytes()).hexdigest() != expected:
            return False
    return True


def cross_border_policy_is_current(core):
    try:
        policy = load_policy()
        summary = core.get('cross_border_policy', {})
        if (summary.get('policy_id') != policy['policy_id'] or
                summary.get('policy_sha256') != policy['_sha256'] or
                summary.get('layer_count') != len(layer_index()) or
                not summary.get('all_sources_preserved_unclipped')):
            return False
        for table, meta in layer_index().items():
            collection = core['vectors'] if meta['kind'] == 'features' else core['rasters']
            expected = resolve_layer(
                table, visible=meta['visible'], kind=meta['kind'], policy=policy)
            if collection[table].get('cross_border_policy') != expected:
                return False
        return (ROOT / 'docs/geospatial-audit/cross-border-policy-register.csv').is_file()
    except (KeyError, OSError, ValueError):
        return False


def layer_quality_is_current(document, core):
    if not document or document.get('register_id') != 'ngmap-layer-quality-v1':
        return False
    summary = document.get('summary', {})
    try:
        metadata = layer_quality.load_metadata()
        if (summary.get('source_commit') != core['source_commit'] or
                summary.get('audit_generated_utc') != core['generated_utc'] or
                summary.get('layer_count') != len(layer_index()) or
                summary.get('metadata_config_sha256') != metadata['_sha256'] or
                summary.get('cross_border_policy_sha256') != layer_quality.load_policy()['_sha256'] or
                document.get('methodology', {}).get('quality_score') != 'not_assigned'):
            return False
        rows = document.get('layers', [])
        if len(rows) != len(layer_index()) or {row['layer'] for row in rows} != set(layer_index()):
            return False
        return all(
            row['source_sha256'] == hashlib.sha256(
                layer_index()[row['layer']]['path'].read_bytes()).hexdigest()
            for row in rows)
    except (KeyError, OSError, ValueError):
        return False


def make_layer_review(core, raster, class_rows, named):
    """Return an explicit disposition for every spatial layer, not only exceptions."""
    rows = []
    topology_result_path = ROOT / 'docs/geospatial-audit/topology-correction-result.json'
    topology_result = (json.loads(topology_result_path.read_text(encoding='utf8'))
                       if topology_result_path.exists() else None)
    gada_result_path = ROOT / 'docs/geospatial-audit/gada-illela-correction-result.json'
    gada_result = (json.loads(gada_result_path.read_text(encoding='utf8'))
                   if gada_result_path.exists() else None)
    residual_result_path = ROOT / 'docs/geospatial-audit/ward-lga-correction-result.json'
    residual_result = (json.loads(residual_result_path.read_text(encoding='utf8'))
                       if residual_result_path.exists() else None)
    residual_reviewed = bool(
        residual_result and residual_result.get('status') == 'applied_and_verified' and
        all(residual_result['checks'].values()) and
        residual_result['post_correction']['residual_exception_count'] ==
        core['administrative']['wards']['outside_named_lga'])
    magnetic_result_path = ROOT / 'docs/geospatial-audit/magnetic-coverage-reclassification-result.json'
    magnetic_result = (json.loads(magnetic_result_path.read_text(encoding='utf8'))
                       if magnetic_result_path.exists() else None)
    magnetic_disclosed = magnetic_reclassification_is_current(magnetic_result, raster)
    hidden_artifact_path = ROOT / 'docs/geospatial-audit/hidden-source-artifact-result.json'
    hidden_artifacts = (json.loads(hidden_artifact_path.read_text(encoding='utf8'))
                        if hidden_artifact_path.exists() else None)
    hidden_resolved = hidden_artifact_resolution_is_current(hidden_artifacts, core)
    admin_identifier_path = ROOT / 'docs/geospatial-audit/admin-identifier-result.json'
    admin_identifiers = (json.loads(admin_identifier_path.read_text(encoding='utf8'))
                         if admin_identifier_path.exists() else None)
    admin_identified = admin_identifiers_are_current(admin_identifiers)
    for table, meta in sorted(layer_index().items()):
        is_topology_provenance = table.endswith('_topology_original')
        is_identity_provenance = table.endswith('_identity_original_pg') or table.endswith('_identity_original_pt')
        issues = []
        evidence = []
        action = 'None indicated by the applicable checks'
        policy_rule = resolve_layer(
            table, visible=meta['visible'], kind=meta['kind'])
        if policy_rule['scope_class'] != 'nigeria_focused':
            evidence.append(
                f'ngmap-cross-border-v1: {policy_rule["scope_class"]}; '
                f'{policy_rule["national_statistics"]}')
            if action == 'None indicated by the applicable checks':
                action = ('Preserve the unclipped source and apply the cross-border policy before '
                          'Nigeria-only aggregation')
        if table == 'settlements_state_capitals_map2023_pt':
            action = ('Correction completed: retain the 37-row ledger and hidden original; '
                      'do not apply a blanket translation')
            evidence.append('32 reviewed OSM replacements; five retained positions; DIVA cross-check and 37/37 state containment')
        if table == 'settlements_state_capitals_map2023_original_pt':
            action = 'Hidden provenance only; never publish or use as corrected ground locations'
            evidence.append('37 uncorrected source positions preserved with original schema and geometry')
        if is_topology_provenance:
            action = 'Hidden topology provenance only; never publish or use as current repaired geometry'
            evidence.append('Full pre-correction source preserved; historical invalid geometries are expected')
        elif topology_result and table in topology_result['layers']:
            corrected = topology_result['layers'][table]
            action = ('Topology correction completed; retain the feature ledger, hidden original and '
                      'area/bounds/raster regression evidence')
            evidence.append(f'{corrected["repaired_features"]} reviewed MakeValid repairs; '
                            f'{corrected["unchanged_geometry_blobs"]} other geometry blobs byte-identical')
        if is_identity_provenance:
            action = 'Hidden Gada/Illela identity provenance only; never publish or use as current administration'
            evidence.append('Original polygon/centroid identities preserved with byte-identical geometry')
        if table in ('admin_lgas_gadm_pg', 'admin_lga_centroids_pt', 'admin_wards_pt'):
            if gada_result and all(gada_result['checks'].values()):
                if table == 'admin_wards_pt':
                    residual = core['administrative']['wards']['outside_named_lga']
                    if residual_reviewed:
                        issues.append(f'{residual} individually reviewed residual ward/LGA containment exceptions')
                        action = ('Retain the 40-case review and 37 documented exceptions; seek new authoritative '
                                  'evidence for the two suspect coordinates and Kwambai before any future change; '
                                  'never force containment by moving wards')
                        evidence.append('INEC and independent-boundary review; three LGA attributes corrected; '
                                        'all 8,809 ward geometries byte-identical')
                    else:
                        issues.append(f'{residual} residual ward/LGA containment exceptions after identity correction')
                        action = ('Review residual exceptions separately, including Darna/Sabon Gari in '
                                  'Gwadabawa; never force containment by moving wards')
                        evidence.append('21 reciprocal exceptions resolved; official assignments and coordinates unchanged')
                else:
                    action = ('Identity correction completed; retain INEC/reference evidence, hidden originals '
                              'and the 601-row ledger; no geometry was changed')
                    evidence.append('FID 708 = Illela and FID 712 = Gada; corrected name-specific attributes')
            else:
                issues.append('Gada/Illela administrative identity conflict')
                action = 'Verify official LGA identities and rebuild derived joins; do not translate wards'
                evidence.append('reciprocal containment and independent towns')
        if table == 'geophysics_magnetic_emag2_rst':
            fraction = raster['land_masks'][table]['inside_land_valid_fraction']
            issues.append(f'partial valid-cell coverage ({fraction:.1%} of sampled land cells)')
            if magnetic_disclosed:
                action = ('Partial-coverage classification completed; retain the explicit label and NoData gaps; '
                          'do not interpolate; a future source rebuild must pass the 98% land-coverage gate')
                evidence.append('metadata-only reclassification; tile bytes, logical array and public assets unchanged')
            else:
                action = 'Refetch/rebuild or describe explicitly as partial coverage'
            evidence.append('valid cells by state')
        if table == 'settlements_towns_map2023_pt':
            if hidden_resolved:
                action = ('Hidden-source artifact resolved; retain 478 active cross-check points and the '
                          'quarantined FID 479 record; never publish the excluded legend text as a settlement')
                evidence.append('FID 479 alone quarantined with complete original attributes/geometry; '
                                'all other active rows byte-identical')
            else:
                issues.append('hidden “Tow ns” legend artefact in Cameroon')
                action = 'Remove/correct the source artefact during hidden-layer maintenance'
        if table == 'population_districts_picture_pg':
            if hidden_resolved:
                action = ('Hidden-source semantics resolved; exclude D0451 from district-level analysis '
                          'while retaining it as a connected population-class picture region')
                evidence.append('D0451 intersects 16 states and 124 LGAs; all 504 active features '
                                'and geometry/attribute rows byte-identical')
            else:
                issues.append('hidden connected-region abstraction D0451 exceeds 121,000 km²')
                action = 'Review vectorisation semantics before any district-level use'
        if admin_identified and table in admin_identifiers['after_sha256']:
            evidence.append('ngmap-admin-v1 stable IDs and parent keys; original attributes and geometry byte-identical')
            if table in ('admin_states_gadm_pg', 'population_density2016_states_pg'):
                evidence.append('37 state IDs; Water body remains non-administrative with null ID')
            elif table in ('admin_lgas_gadm_pg', 'admin_lga_centroids_pt'):
                evidence.append('774 shared LGA IDs and INEC links; Lake Chad remains non-administrative')
            elif table == 'admin_wards_pt':
                evidence.append('8,809 unique ward IDs; 8,589 one-to-one INEC links; 220 null external links retained')
            if action == 'None indicated by the applicable checks':
                action = 'Use stable admin_id and parent keys for joins; preserve the registry and INEC crosswalk limits'
        if table == 'groundwater_boreholes_wpdx_pt':
            count = named[table]['counts'].get('substantive_mismatch_after_fuzzy_names', 0)
            evidence.append(f'all points contained; {count} non-equivalent LGA-name joins')
            if count:
                issues.append(f'{count} LGA-name joins need source-vintage review')
                action = 'Review admin-name mappings; no coordinate shift indicated'
        elif table in ('settlements_places_osm_pt', 'settlements_gazetteer_diva_pt',
                       'infrastructure_airports_osm_pt', 'infrastructure_pois_osm_pt'):
            count = named[table]['counts'].get('substantive_mismatch_after_fuzzy_names', 0)
            if count:
                evidence.append(f'{count} non-equivalent admin-name joins')
        if meta['kind'] == 'features':
            vector = core['vectors'][table]
            if vector['invalid_geometry_count'] and not is_topology_provenance:
                issues.append(f'{vector["invalid_geometry_count"]} invalid polygon geometries')
                if action == 'None indicated by the applicable checks':
                    action = 'Repair topology separately and regression-test areas/bounds'
            count = vector['feature_count']
            detail = f'{count:,} features; {vector["invalid_geometry_count"]} invalid'
            evidence.append('full-precision geometry/CRS/extent checks')
        else:
            grid = core['rasters'][table]
            detail = f'{grid["expected_stitched_shape"][1]} × {grid["expected_stitched_shape"][0]} grid; {grid["tile_count_at_max_zoom"]} max-zoom tiles'
            evidence.append('tile-matrix decode and bounds checks')
            if table in raster['land_masks']:
                mask = raster['land_masks'][table]
                evidence.append(f'{mask["inside_land_valid_fraction"]:.1%} valid inside land')
        matching_classes = [r for r in class_rows if r['raster'] == table or r['vector'] == table]
        if matching_classes:
            evidence.append(f'{min(r["agreement_fraction"] for r in matching_classes):.1%}–{max(r["agreement_fraction"] for r in matching_classes):.1%} paired-class agreement')
        if table in ('geology_map2011_img', 'minerals_map2023_img'):
            evidence.append('independent river/graticule controls in registration report')
        if table == 'geology_unit_boundaries_map2011_ln':
            evidence.append('0.119 km median to unit-polygon boundaries')
        scope = SCOPE_NOTES.get(table, '')
        if table == 'settlements_state_capitals_map2023_original_pt':
            scope = ('Uncorrected scanned-map/gazetteer source retained only for audit provenance; '
                     'its positional disagreements are documented in the before-correction evidence.')
        if is_topology_provenance:
            scope = ('Pre-topology-correction source retained only for audit provenance; its invalid '
                     'geometries are historical evidence and are excluded from active-defect counts.')
        if is_identity_provenance:
            scope = ('Pre-Gada/Illela-identity-correction source retained only for audit provenance; '
                     'its old labels are not current administration.')
        if table == 'geophysics_magnetic_emag2_rst' and magnetic_disclosed:
            scope = ('Explicit partial-coverage product; missing cells remain NoData and are not '
                     'continuous national coverage or evidence of a coordinate shift.')
        if table == 'settlements_towns_map2023_pt' and hidden_resolved:
            scope = ('Hidden 2023 sheet-label cross-check source; one non-settlement legend artefact '
                     'is quarantined in a registered attributes table, not active spatial data.')
        if table == 'population_districts_picture_pg' and hidden_resolved:
            scope = ('Hidden picture-derived population-class regions, not official districts; D0451 '
                     'has an explicit semantic exclusion and must not be used for district analysis.')
        if scope:
            evidence.append(scope)
        disposition = (
            'Artifact quarantined / hidden' if table == 'settlements_towns_map2023_pt' and hidden_resolved else
            'Scope reclassified / hidden' if table == 'population_districts_picture_pg' and hidden_resolved else
            'Scope limitation disclosed' if table == 'geophysics_magnetic_emag2_rst' and magnetic_disclosed else
            'Reviewed with exceptions' if table == 'admin_wards_pt' and residual_reviewed else
            'Action required' if table in (
                'admin_lgas_gadm_pg', 'admin_lga_centroids_pt', 'admin_wards_pt') and not gada_result else
            'Review' if issues else ('Context / scope note' if scope else 'No gross registration error detected'))
        rows.append({
            'layer': table, 'path': str(meta['path'].relative_to(ROOT)),
            'visibility': 'visible' if meta['visible'] else 'hidden', 'type': meta['kind'],
            'disposition': disposition, 'details': detail,
            'review_findings': '; '.join(issues) or 'None in applicable checks',
            'evidence': '; '.join(evidence), 'recommended_action': action,
        })
    return rows


def write_layer_review(out, rows):
    write_csv(out / 'layer-review.csv', rows)
    lines = [
        '# Per-layer geospatial review register', '',
        'Every visible and hidden spatial layer is listed. “No gross registration error detected” is not a survey-grade certification; read the evidence and scope columns. Absolute accuracy cannot be established for layers with structural/internal evidence alone.', '',
        '| Layer | Visibility | Type | Disposition | Findings | Evidence | Recommended action |',
        '|---|---|---|---|---|---|---|',
    ]
    for row in rows:
        values = [f'`{row["layer"]}`', row['visibility'], row['type'], row['disposition'],
                  row['review_findings'], row['evidence'], row['recommended_action']]
        lines.append('| ' + ' | '.join(str(v).replace('|', '\\|') for v in values) + ' |')
    (out / 'layer-review.md').write_text('\n'.join(lines) + '\n', encoding='utf8')


def make_figures(out, capital_rows, ward_rows):
    """Draw diagnostic evidence without altering or re-fitting any coordinates."""
    def font(size, bold=False):
        name = 'DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf'
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            return ImageFont.load_default()

    def projector(bounds, width, height, margins=(35, 100, 35, 75)):
        left, top, right, bottom = margins
        latitude = (bounds[1] + bounds[3]) / 2
        aspect = np.cos(np.radians(latitude))
        x0, x1 = bounds[0] * aspect, bounds[2] * aspect
        y0, y1 = bounds[1], bounds[3]
        scale = min((width - left - right) / (x1 - x0), (height - top - bottom) / (y1 - y0))
        used_width, used_height = (x1 - x0) * scale, (y1 - y0) * scale
        ox = left + (width - left - right - used_width) / 2
        oy = top + (height - top - bottom - used_height) / 2

        def project(x, y):
            return (ox + (x * aspect - x0) * scale, oy + (y1 - y) * scale)
        return project

    def draw_polygon(draw, geometry, project, outline, fill=None, width=1):
        for part in shapely.get_parts(geometry):
            if part.geom_type != 'Polygon':
                continue
            exterior = [project(x, y) for x, y in part.exterior.coords]
            if fill:
                draw.polygon(exterior, fill=fill)
            draw.line(exterior, fill=outline, width=width, joint='curve')
            for ring in part.interiors:
                draw.line([project(x, y) for x, y in ring.coords], fill=outline, width=width)

    # Capital source-to-OSM residual map.
    width, height = 1500, 1050
    image = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(image)
    corrected = any(row.get('coordinate_source') for row in capital_rows)
    draw.text((35, 22), 'State capitals: published positions versus same-name OSM places',
              font=font(28, True), fill='#15202b')
    draw.text((35, 61), 'Red = published capital point; green = OSM reference; line = positional residual',
              font=font(18), fill='#3c4854')
    states, _ = load_features('admin_states_gadm_pg', ['state'])
    country = unary_union([f['geometry'] for f in states])
    project = projector(country.bounds, width, height)
    for feature in states:
        draw_polygon(draw, feature['geometry'], project, '#c8d0d7', width=1)
    draw_polygon(draw, country, project, '#4a5660', width=2)
    for row in capital_rows:
        if row.get('osm_longitude') is None:
            continue
        source = project(row['source_longitude'], row['source_latitude'])
        reference = project(row['osm_longitude'], row['osm_latitude'])
        draw.line([source, reference], fill='#d98c32', width=2)
        draw.ellipse((source[0]-5, source[1]-5, source[0]+5, source[1]+5),
                     fill='#c9252d', outline='white', width=1)
        draw.ellipse((reference[0]-4, reference[1]-4, reference[0]+4, reference[1]+4),
                     fill='#138a55', outline='white', width=1)
    for row in sorted(capital_rows, key=lambda r: r.get('osm_distance_km', 0), reverse=True)[:10]:
        if row.get('osm_longitude') is None:
            continue
        x, y = project(row['osm_longitude'], row['osm_latitude'])
        label = f"{row['capital']} {row['osm_distance_km']:.1f} km"
        draw.text((x + 7, y - 11), label, font=font(14, True), fill='#18362a',
                  stroke_width=2, stroke_fill='white')
    note = ('OSM constructed 32 replacements and is not independent validation for them; '
            'DIVA strict held-out cases and state containment provide validation.'
            if corrected else
            'Diagnostic only: OSM is independent corroboration, not legal survey control. '
            'See CSV for all 37 residuals and DIVA matches.')
    draw.text((35, 995), note, font=font(16), fill='#3c4854')
    image.save(out / 'capital-coordinate-comparison.png', optimize=True)

    # Reciprocal Sokoto LGA identity evidence.
    lgas, _ = load_features('admin_lgas_gadm_pg', ['state', 'lga'])
    selected = [f for f in lgas if f['properties']['state'] == 'Sokoto'
                and f['properties']['lga'] in ('Gada', 'Illela')]
    union = unary_union([f['geometry'] for f in selected])
    b = union.bounds
    bounds = (b[0]-0.07, b[1]-0.07, b[2]+0.07, b[3]+0.07)
    image = Image.new('RGB', (1400, 1050), 'white')
    draw = ImageDraw.Draw(image)
    reciprocal = sum(
        (r['assigned_lga'] == 'Gada' and r['containing_state_lga'] == 'Sokoto / Illela') or
        (r['assigned_lga'] == 'Illela' and r['containing_state_lga'] == 'Sokoto / Gada')
        for r in ward_rows)
    corrected = reciprocal == 0 and (out / 'gada-illela-correction-result.json').exists()
    title = ('Sokoto: corrected Gada / Illela identities' if corrected
             else 'Sokoto: reciprocal Gada / Illela containment')
    subtitle = ('Polygon labels and ward colours follow assigned LGA; 21 former reciprocal exceptions resolved'
                if corrected else
                'Polygon labels and ward colours follow assigned LGA; reciprocal placement indicates an attribute conflict')
    draw.text((35, 22), title, font=font(28, True), fill='#15202b')
    draw.text((35, 61), subtitle, font=font(18), fill='#3c4854')
    project = projector(bounds, 1400, 1050)
    for feature in lgas:
        if feature['properties']['state'] == 'Sokoto':
            draw_polygon(draw, feature['geometry'], project, '#d5d9dd', width=1)
    styles = {'Gada': ('#2166ac', '#d6e8f7'), 'Illela': ('#b2182b', '#f9d9dc')}
    for feature in selected:
        name = feature['properties']['lga']
        outline, fill = styles[name]
        draw_polygon(draw, feature['geometry'], project, outline, fill=fill, width=3)
        centre = feature['geometry'].representative_point()
        x, y = project(centre.x, centre.y)
        draw.text((x, y), f'GADM label: {name}', font=font(17, True), fill=outline,
                  anchor='mm', stroke_width=2, stroke_fill='white')
    for row in ward_rows:
        if row['assigned_state'] != 'Sokoto' or row['assigned_lga'] not in styles:
            continue
        colour = styles[row['assigned_lga']][0]
        x, y = project(row['longitude'], row['latitude'])
        draw.ellipse((x-5, y-5, x+5, y+5), fill=colour, outline='white', width=1)
    osm, _ = load_features('settlements_places_osm_pt', ['name', 'place', 'state'])
    for feature in osm:
        p = feature['properties']
        if p.get('state') != 'Sokoto' or norm(p.get('name')) not in ('gada', 'illela'):
            continue
        if not (bounds[0] <= feature['geometry'].x <= bounds[2]
                and bounds[1] <= feature['geometry'].y <= bounds[3]):
            continue
        if p['name'] == 'Illela' and p.get('place') != 'town':
            continue
        x, y = project(feature['geometry'].x, feature['geometry'].y)
        draw.rectangle((x-5, y-5, x+5, y+5), fill='#111111', outline='white', width=1)
        draw.text((x+8, y-12), f"OSM {p['name']}", font=font(15, True), fill='#111111',
                  stroke_width=2, stroke_fill='white')
    if corrected:
        draw.text((35, 970), 'Zero geometry changes; official ward assignments retained. No ward was moved.',
                  font=font(16), fill='#3c4854')
        draw.text((35, 998), 'Darna/Sabon Gari remains a separate Gwadabawa exception.',
                  font=font(16), fill='#3c4854')
    else:
        draw.text((35, 995), '21 ward points fall in the reciprocal polygon. Correct identities with an official source; do not shift wards.',
                  font=font(16), fill='#3c4854')
    image.save(out / 'sokoto-gada-illela.png', optimize=True)

    # Visually inspect the four individually reviewed topology dispositions.
    topology_result_path = out / 'topology-correction-result.json'
    if topology_result_path.exists():
        result = json.loads(topology_result_path.read_text(encoding='utf8'))
        with (out / 'topology-correction-ledger.csv').open(encoding='utf8') as handle:
            ledger = {(r['layer'], int(r['fid'])): r for r in csv.DictReader(handle)}
        cases = [
            ('forest_reserves_water_picture_pg', 795, 'Gulf of Guinea — self-crossing marine ring'),
            ('protected_areas_wdpa_pg', 148, 'Cross River — nested/overlapping components'),
            ('climate_temperature_picture_pg', 8, 'Historical water — self-crossing component lobes'),
            ('geology_background_map2023_pg', 234, 'Basement — collapsed vertical line residue'),
        ]
        review_image = Image.new('RGB', (1600, 1580), 'white')
        review_draw = ImageDraw.Draw(review_image)
        review_draw.text((35, 22), 'Reviewed topology repairs: original rings vs valid polygonal output',
                         font=font(27, True), fill='#15202b')
        review_draw.text((35, 61), 'Each pair uses one common scale; red = hidden original, blue = current repaired geometry',
                         font=font(17), fill='#3c4854')
        for row_index, (table, fid, title) in enumerate(cases):
            saved = result['layers'][table]
            original_path = ROOT / saved['provenance_path']
            current_path = layer_index()[table]['path']
            with sqlite3.connect(f'file:{original_path}?mode=ro', uri=True) as con:
                gcol = con.execute('select column_name from gpkg_geometry_columns where table_name=?',
                                   (saved['provenance_table'],)).fetchone()[0]
                before_blob = con.execute(
                    f'select {gcol} from {saved["provenance_table"]} where fid=?', (fid,)).fetchone()[0]
            with sqlite3.connect(f'file:{current_path}?mode=ro', uri=True) as con:
                gcol = con.execute('select column_name from gpkg_geometry_columns where table_name=?',
                                   (table,)).fetchone()[0]
                after_blob = con.execute(f'select {gcol} from {table} where fid=?', (fid,)).fetchone()[0]
            before = gpkg_geometry(before_blob)
            after = gpkg_geometry(after_blob)
            evidence = ledger[(table, fid)]
            top = 110 + row_index * 360
            review_draw.text((35, top), title, font=font(19, True), fill='#15202b')
            review_draw.text((35, top + 29), f'{table} / FID {fid}', font=font(14), fill='#55616c')
            minx = min(before.bounds[0], after.bounds[0])
            miny = min(before.bounds[1], after.bounds[1])
            maxx = max(before.bounds[2], after.bounds[2])
            maxy = max(before.bounds[3], after.bounds[3])
            dx, dy = maxx - minx, maxy - miny
            bounds = (minx - dx * 0.03, miny - dy * 0.03,
                      maxx + dx * 0.03, maxy + dy * 0.03)
            for column, geometry, label, outline, fill in (
                    (0, before, 'Before / invalid source', '#b2182b', '#f9d9dc'),
                    (1, after, 'After / valid MultiPolygon', '#2166ac', '#d6e8f7')):
                offset_x = 35 + column * 785
                offset_y = top + 60
                review_draw.text((offset_x, offset_y), label, font=font(15, True), fill=outline)
                base_project = projector(bounds, 745, 245, margins=(5, 27, 5, 5))
                project = lambda x, y, ox=offset_x, oy=offset_y, p=base_project: (
                    ox + p(x, y)[0], oy + p(x, y)[1])
                draw_polygon(review_draw, geometry, project, outline, fill=fill, width=2)
            before_area = float(evidence['before_area_km2'])
            after_area = float(evidence['after_area_km2'])
            note = (f'Area {before_area:,.3f} → {after_area:,.3f} km²; '
                    f'Δ {after_area - before_area:+,.3f} km². ')
            if evidence['review_status'] == 'reviewed_collapsed_line_extent':
                note += ('Only the zero-area northern line is removed; polygon area is unchanged and '
                         f'envelope shrink is {float(evidence["max_bounds_delta_degrees"]):.9f}°.')
            else:
                note += 'Invalid signed source area is diagnostic; see the explicit ledger disposition.'
            review_draw.text((35, top + 325), note, font=font(14), fill='#3c4854')
        review_image.save(out / 'topology-reviewed-cases.png', optimize=True)


def make_report(core, capital, cap_rows, ward_summary, ward_rows, topology, raster,
                class_rows, named, outliers, crs, topology_correction=None, gada_correction=None,
                residual_correction=None, magnetic_reclassification=None, hidden_artifacts=None,
                admin_identifiers=None, quality_register=None):
    osm = capital['summary']['osm']
    diva = capital['summary']['diva']
    grey = next((v for k, v in capital['by_position_basis'].items() if 'grey square' in k), None)
    land_values = [v['inside_land_valid_fraction'] for k, v in raster['land_masks'].items()
                   if k != 'geophysics_magnetic_emag2_rst']
    boundaries = {r['comparison']: r for r in core['boundary_comparisons']}
    independent_boundary = boundaries['geoBoundaries national polygon vs Natural Earth Nigeria']
    classifications = Counter(r['classification'] for r in outliers)
    magnetic = sorted(raster['magnetic_valid_fraction_by_state'], key=lambda r: r['valid_fraction'])
    largest_capital = max(cap_rows, key=lambda r: r.get('osm_distance_km', -1))
    pop_outliers = raster['population_districts_over_50000km2']
    correction = capital.get('correction')
    strict_diva = diva.get('strict_held_out')
    layer_count = len(core['vectors']) + len(core['rasters'])
    database_count = len(core['database_integrity'])
    vector_count = len(core['vectors'])
    numeric_count = sum(meta['kind'] == '2d-gridded-coverage' for meta in layer_index().values())
    image_count = sum(meta['kind'] == 'tiles' for meta in layer_index().values())
    historical_capital = ''
    before_file = ROOT / 'docs/geospatial-audit/capital-coordinate-comparison-before.csv'
    if before_file.exists():
        with before_file.open(encoding='utf8') as handle:
            before_rows = list(csv.DictReader(handle))
        before_osm = [float(r['osm_distance_km']) for r in before_rows if r.get('osm_distance_km')]
        before_diva = [float(r['diva_distance_km']) for r in before_rows if r.get('diva_distance_km')]
        historical_capital = (
            f'Before correction, OSM median/p95/maximum separation was **{np.median(before_osm):.3f} / '
            f'{np.percentile(before_osm, 95):.3f} / {max(before_osm):.3f} km**; DIVA median was '
            f'**{np.median(before_diva):.3f} km**. The original evidence is preserved, not overwritten.')

    public_precision_fallbacks = Counter()
    public_catalog_path = ROOT / 'public/catalog.json'
    if public_catalog_path.exists():
        public_catalog = json.loads(public_catalog_path.read_text(encoding='utf8'))
        for layer in public_catalog['layers']:
            public_precision_fallbacks.update({
                int(precision): count for precision, count in
                layer.get('geometryPrecisionFallbacks', {}).items()})
    gada_resolved = bool(
        gada_correction and all(gada_correction['checks'].values()) and
        ward_summary['reciprocal_gada_illela_containment'] == 0 and
        ward_summary['sokoto_gada_illela_exceptions'] == 1)
    residual_resolved = bool(
        residual_correction and residual_correction.get('status') == 'applied_and_verified' and
        all(residual_correction['checks'].values()) and
        ward_summary.get('individual_review_complete') and
        ward_summary['total_outside_assigned_lga'] == 37)
    magnetic_resolved = magnetic_reclassification_is_current(magnetic_reclassification, raster)
    hidden_resolved = hidden_artifact_resolution_is_current(hidden_artifacts, core)
    admin_identified = admin_identifiers_are_current(admin_identifiers)
    if gada_resolved:
        gada_verification_path = ROOT / 'docs/geospatial-audit/gada-illela-verification.json'
        gada_verification = json.loads(gada_verification_path.read_text(encoding='utf8'))
        post = gada_correction['post_correction']
        admin_executive = (
            '2. **The Gada/Illela reciprocal identity conflict is resolved without moving geometry.** '
            f'All 11 Gada wards and 10 of 11 Illela wards now fall inside their corrected named polygons; '
            '21 former reciprocal exceptions are resolved. Darna/Sabon Gari remains a separate Gwadabawa '
            f'exception {post["darna_sabon_gari"]["distance_to_corrected_illela_km"]:.3f} km outside corrected '
            'Illela. No ward, polygon, centroid or derived-feature geometry was changed.')
        admin_details = [
            '### A2 — Resolved with provenance: reciprocal Gada/Illela identity conflict', '',
            '- **Official control:** INEC’s Sokoto registration-area directory identifies Gada as LGA code 04 '
            'and Illela as code 08. Both official 11-name ward lists exactly match the existing assignments; '
            'no ward name, assignment or coordinate was changed.',
            f'- **Independent boundary identity:** reciprocal metric IoU is '
            f'**{gada_verification["reciprocal_ious"][0]:.3f}** for the former Gada-labelled polygon versus '
            f'reference Illela and **{gada_verification["reciprocal_ious"][1]:.3f}** for the former '
            'Illela-labelled polygon versus reference Gada. Same-name IoUs are only '
            f'{gada_verification["same_name_ious"][0]:.3f} and {gada_verification["same_name_ious"][1]:.3f}. '
            'The simplified external geometry was identity evidence only, not replacement geometry.',
            '- **Correction:** FID/lga_id 708 is now Illela and FID/lga_id 712 is now Gada. Two polygon names '
            'and two centroid identity/attribute records were corrected; FIDs, IDs, areas and all centroid/'
            'polygon geometry remain fixed. Gada retains Wikidata Q5516271 and Illela Q5999073 with their '
            'correct representative districts.',
            '- **Derived data:** 575 LGA joins were corrected only where the old attribute exactly matched '
            'the old containing polygon: 173 boreholes, 97 DIVA places, 303 OSM places and two hidden '
            'scanned-map towns. `previous_lga` is retained. Twenty-two ward-to-centroid distances were '
            'recomputed; OSM Kiri FID 14680 correctly remains Illela.',
            (f'- **Residual ward review:** the follow-on A3 review is complete. Three LGA attributes were '
             f'corrected and {ward_summary["total_outside_assigned_lga"]} documented exceptions remain; '
             f'{ward_summary["within_1km_of_assigned_lga"]} are within 1 km and '
             f'{ward_summary["over_10km_from_assigned_lga"]} exceed 10 km. Darna/Sabon Gari remains assigned '
             f'to Illela but contained in Gwadabawa, **{post["darna_sabon_gari"]["distance_to_corrected_illela_km"]:.3f} km** '
             'outside corrected Illela; it was not moved to force containment.'
             if residual_resolved else
             f'- **Residual ward review:** {ward_summary["total_outside_assigned_lga"]} ward/LGA exceptions '
             f'remain nationally; {ward_summary["within_1km_of_assigned_lga"]} are within 1 km and only '
             f'{ward_summary["over_10km_from_assigned_lga"]} exceeds 10 km. Darna/Sabon Gari remains assigned '
             f'to Illela but contained in Gwadabawa, **{post["darna_sabon_gari"]["distance_to_corrected_illela_km"]:.3f} km** '
             'outside corrected Illela; it was not moved to force containment.'),
            '- **Provenance and evidence:** original LGA/centroid layers are hidden as '
            '`admin_lgas_gadm_identity_original_pg` and `admin_lga_centroids_identity_original_pt`. '
            '`gada-illela-verification.json`, the 601-row correction ledger, result hashes, two-feature '
            'reference extract and `ward-lga-exceptions-before.csv` / `sokoto-gada-illela-before.png` '
            'preserve the evidence.',
        ]
    else:
        admin_executive = (
            '2. **The Gada and Illela LGA identities conflict across the visible admin layers.** '
            f'{ward_summary["sokoto_gada_illela_exceptions"]} ward records assigned to those LGAs fall outside '
            f'their named polygon; {ward_summary["reciprocal_gada_illela_containment"]} fall in the reciprocal '
            'polygon. The evidence points to swapped/misattributed LGA polygons—not a national coordinate shift.')
        admin_details = [
            '### A2 — High: reciprocal Gada/Illela administrative conflict', '',
            f'- **{ward_summary["total_outside_assigned_lga"]} of 8,809** ward points fall outside their '
            f'assigned GADM LGA; {ward_summary["within_1km_of_assigned_lga"]} are within 1 km.',
            f'- **{ward_summary["over_10km_from_assigned_lga"]}** are more than 10 km away. The dominant '
            'cluster is Sokoto: 11 Gada records fall in Illela, 10 Illela records fall in Gada, and one '
            'Illela record falls in Gwadabawa.',
            '- **Action:** verify the two polygons against an official Sokoto boundary source and correct '
            'the identities. **Do not move ward points merely to force containment.**',
            '- **Evidence:** `ward-lga-exceptions.csv` and `sokoto-gada-illela.png`.',
        ]
    if residual_resolved:
        admin_executive += (
            ' The follow-on 40-case residual review is also complete: three LGA attributes were corrected '
            'and 37 evidence-documented exceptions remain, with zero ward geometry changes.')
        residual_post = residual_correction['post_correction']
        residual_details = [
            '### A3 — Resolved with provenance: residual ward/LGA exception review', '',
            '- **Individual authoritative review:** all 40 cases across 20 states were checked against '
            'INEC registration-area directories and independent ArcGIS/Michael Bauer Research/NBS 2023 '
            'point intersections. The 40-row pre-review register is preserved separately.',
            '- **Three true LGA attribute errors:** FID 4096 Kwarau changed from Kaduna North to Igabi; '
            "FID 4215 Gidan Waya changed from Sanga to Jema'a; FID 7295 Ward XI E9 I changed from Ibadan "
            'South East to Ibadan North East. Their derived centroid distances are 25.5, 23.4 and 0.9 km '
            'respectively. CSV feature indices 4095, 4214 and 7294 are zero-based and are not FIDs.',
            '- **Thirty-seven reviewed retentions:** 20 boundary-generalisation/source-disagreement cases, '
            '14 coastal/water cases, two suspect-coordinate cases (Gambaki/Bidir and Ilasa II/Ikun/Araromi), '
            'and Kwambai with explicit Takum/Ussa delimitation uncertainty. No containing polygon was '
            'relabeled merely because it contained a point.',
            f'- **Current residual metrics:** {residual_post["residual_exception_count"]} exceptions; '
            f'{residual_post["residual_within_1km"]} within 1 km; '
            f'{residual_post["residual_over_10km"]} over 10 km; '
            f'{residual_post["residual_without_local_container"]} without a local container. All 8,809 '
            'ward geometry blobs are byte-identical and all untargeted attributes were verified.',
            '- **Cautions retained:** Ward XI E9 I has an independent Egbeda disagreement despite INEC '
            'and local Ibadan North East support. Arak and Panda/Kare have independent support for Sanga '
            'and Karu. Name variants and Kwambai uncertainty were documented rather than silently changed.',
            '- **Evidence:** `ward-lga-review-ledger.csv`, `ward-lga-review-verification.json`, '
            '`ward-lga-correction-result.json`, `ward-lga-review.md`, '
            '`ward-lga-exceptions-before-residual-review.csv` and '
            '`references/ward-lga-review-sources.md` preserve every disposition, source URL, query, '
            'before/after attribute and geometry hash.',
        ]
    else:
        residual_details = []
    magnetic_fraction = raster['land_masks']['geophysics_magnetic_emag2_rst']['inside_land_valid_fraction']
    magnetic_state_text = (
        f'Ekiti {next(r for r in magnetic if r["state"] == "Ekiti")["valid_fraction"]:.1%}, '
        f'Osun {next(r for r in magnetic if r["state"] == "Osun")["valid_fraction"]:.1%}, '
        f'Oyo {next(r for r in magnetic if r["state"] == "Oyo")["valid_fraction"]:.1%}, and '
        f'Sokoto {next(r for r in magnetic if r["state"] == "Sokoto")["valid_fraction"]:.1%}')
    if magnetic_resolved:
        full_cell = magnetic_reclassification['coverage']['full_cell_land']
        magnetic_executive = (
            f'4. **The magnetic raster is transparently classified as partial coverage.** '
            f'{magnetic_fraction:.1%} of sampled land cells are valid; {magnetic_state_text}. '
            'The visible label and source description disclose the limitation. Missing cells remain '
            'NoData, and no magnetic values were interpolated or shifted.')
        magnetic_details = [
            '### B2 — Disclosed scope limitation: EMAG2 partial coverage', '',
            '- Valid magnetic cells follow the same national grid, so this is not a misregistration '
            'finding. Whole or large parts of states have no values; those gaps remain explicitly NoData.',
            f'- **Two coverage denominators are retained:** the published stride-two sample is '
            f'**{magnetic_fraction:.1%}**, while the independent full-cell calculation is '
            f'**{full_cell["valid_fraction"]:.1%}** ({full_cell["valid_cells"]:,} of '
            f'{full_cell["cells"]:,} land cells). They are not contradictory measurements.',
            f'- **Transparent reclassification:** the visible name is '
            f'“{magnetic_reclassification["visible_label"]}”. The GeoPackage description begins '
            '“PARTIAL NIGERIA COVERAGE” and lists the state gaps and no-interpolation rule.',
            '- **Preservation:** only `gpkg_contents.description` and `last_change` changed. Tile '
            'bytes, the logical float32 array, every other table and the public PNG/value-grid assets '
            'are hash-verified unchanged. No scientific values were fabricated.',
            '- **Future rebuild control:** the EMAG2 fetch path now rejects output below 98% land '
            'coverage instead of silently publishing it as nationally complete. A verified complete '
            'source-window rebuild may replace the partial derivative as a separate evidence-led change.',
            '- **Evidence:** `magnetic-coverage-reclassification-verification.json`, '
            '`magnetic-coverage-reclassification-result.json`, '
            '`magnetic-coverage-reclassification.md` and `raster-coverage-by-state.csv`.',
        ]
    else:
        magnetic_executive = (
            '4. **The visible magnetic raster has real completeness gaps.** '
            f'Only {magnetic_fraction:.1%} of sampled land cells are valid. {magnetic_state_text}. '
            'This is missing source/derived data, not evidence that valid cells are shifted.')
        magnetic_details = [
            '### B2 — Medium: EMAG2 coverage is incomplete', '',
            '- Valid magnetic cells follow the same national grid, so this is not a misregistration '
            'finding. The problem is that whole or large parts of states have no values.',
            '- **Action:** refetch/rebuild from a verified complete EMAG2 window or replace the '
            'product. Until then, describe the layer as partial coverage rather than continuous national coverage.',
            '- **Evidence:** `raster-coverage-by-state.csv`.',
        ]
    if hidden_resolved:
        town = hidden_artifacts['towns']
        district = hidden_artifacts['population']
        hidden_executive = (
            '5. **Both hidden-source artefacts are resolved without coordinate shifts.** FID 479 '
            '“Tow ns” was quarantined as non-settlement legend text, leaving 478 active hidden '
            'cross-check points. D0451 was retained byte-for-byte but reclassified as a connected '
            'population-class region crossing 16 states and 124 LGAs, excluded from district analysis.')
        hidden_details = [
            f'- **Resolved — scanned legend text:** FID {town["fid"]} “Tow ns” at '
            f'{town["longitude"]:.6f} E, {town["latitude"]:.6f} N was removed only from the active '
            'hidden town-label table (479 → 478). Its complete original attributes and exact geometry '
            f'blob are preserved in `{hidden_artifacts["sources"]["towns"]["sidecar_table"]}`. '
            f'The nearest OSM/DIVA settlement is {town["nearest_settlements"]["osm"]["nearest_name"]}, '
            f'{town["nearest_settlements"]["osm"]["distance_km"]:.3f}/'
            f'{town["nearest_settlements"]["diva"]["distance_km"]:.3f} km away; the point was not '
            'renamed or moved as a settlement.',
            f'- **Resolved — population-region semantics:** D0451/FID {district["fid"]} remains '
            f'among all {hidden_artifacts["planned_counts"]["population"]} active picture regions '
            'with identical feature digest, attributes and geometry. It is explicitly a connected '
            'population-class region, not an administrative district: 16 state and 124 LGA '
            'intersections support that classification. Its exclusion is registered in '
            f'`{hidden_artifacts["sources"]["population"]["sidecar_table"]}`; no split, deletion or '
            'coordinate repair was invented.',
            '- **Evidence:** `hidden-source-artifact-ledger.csv`, '
            '`hidden-source-artifact-verification.json`, `hidden-source-artifact-result.json` and '
            '`hidden-source-artifact-resolution.md`.',
        ]
    else:
        hidden_executive = (
            '5. **Two hidden-source artefacts still need feature-specific resolution.** The “Tow ns” '
            'point is probable scanned legend text, while D0451 is an oversized connected-region '
            'abstraction rather than a plausible ordinary district.')
        hidden_details = [
            '- Hidden `settlements_towns_map2023_pt` includes a point named **“Tow ns”** at '
            '12.434389 E, 5.750015 N, 139.50 km from Nigerian land in Cameroon. Its name and 15.8 pt '
            'label distance indicate a likely scanned-map legend artefact. It is hidden and not '
            'published, but should be removed or corrected in the source workflow.',
        ]
    if admin_identified:
        coverage = admin_identifiers['coverage']
        identifier_executive = (
            '6. **Stable administrative identifiers are installed.** All 37 states, 774 LGAs and '
            '8,809 wards have persistent `ngmap-admin-v1` IDs and parent keys. The separate INEC '
            'crosswalk covers every state/LGA and 8,589/8,809 wards; 220 ambiguous or unmatched '
            'ward links remain explicitly null rather than guessed.')
        identifier_details = [
            '### D — Resolved: stable administrative identifiers', '',
            '- **Canonical keys:** states use `ngmap:state:NG-AB`, LGAs `ngmap:lga:0001` and wards '
            '`ngmap:ward:000001`. These are persistent repository-issued IDs, not statutory codes. '
            'LGA polygons and centroids share keys; wards carry both state and LGA parent keys; '
            'population-state polygons and capitals reference state keys.',
            '- **Non-administrative context:** Water body and Lake Chad retain null administrative '
            'and INEC identifiers. They are not counted as a 38th state or 775th LGA.',
            f'- **INEC crosswalk:** 37/37 states, 774/774 LGAs and '
            f'**{coverage["wards_with_inec_id"]:,}/8,809 wards** have one-to-one INEC links. '
            'The ward links comprise 8,189 exact-name and 400 conservative numeral-normalized matches. '
            f'The remaining **{coverage["wards_without_inec_id"]}** comprise 198 unmatched names and '
            '22 rows in 11 duplicate local-label groups; canonical project IDs remain complete.',
            '- **Name stability:** Gada and Illela retain separate persistent project IDs while their '
            'INEC codes 04 and 08 are explicit. The Gbonyin/Aiyekire alias demonstrates why labels '
            'must not be used as identifiers. Existing names and assignments were not rewritten.',
            '- **Preservation:** only declared identifier columns, indexes and metadata were added. '
            'All original attributes and geometry blobs passed staged and final byte-for-byte comparisons. '
            'Hidden pre-correction provenance was not modified.',
            '- **Evidence:** `admin-identifier-verification.json`, `admin-identifier-result.json`, '
            '`admin-identifier-resolution.md` and `../admin-identifiers/` contain the 9,622-row registry, '
            'pinned source manifest, matching rules, coverage and before/after hashes.',
        ]
    else:
        identifier_executive = (
            '6. **Stable administrative identifiers still need installation.** Names and source-row '
            'numbers remain the only cross-layer administrative join keys.')
        identifier_details = []
    cross_border_defined = cross_border_policy_is_current(core)
    if cross_border_defined:
        policy_summary = core['cross_border_policy']
        class_counts = ', '.join(
            f'{name} {count}' for name, count in policy_summary['class_counts'].items())
        cross_border_executive = (
            f'7. **A cross-border data policy governs all {layer_count} spatial layers.** '
            '`ngmap-cross-border-v1` preserves complete sources, distinguishes foreign/marine context '
            'from Nigerian administration, and requires explicit Nigeria-only filters and clipped '
            'measurements. No source geometry was clipped, moved or deleted for this policy.')
        cross_border_details = [
            '### E — Defined: cross-border geographic data policy', '',
            f'- **Coverage:** {policy_summary["visible_layer_count"]} visible and '
            f'{policy_summary["hidden_layer_count"]} hidden layers have explicit scope metadata; '
            f'{policy_summary["provenance_layer_count"]} hidden provenance layers inherit their active '
            f'layer’s class. Current class counts: {class_counts}.',
            '- **Retention and publication:** every class requires `preserve_unclipped`. Visibility remains '
            'unchanged; foreign extraction context, transboundary systems, regional references, map sheets '
            'and hidden originals are not silently removed or published.',
            '- **National statistics:** an explicit named Nigeria mask is required. Foreign-only, boundary, '
            'marine and wholly internal features are separate categories. Nigeria-only polygon areas and '
            'line lengths are derived clipped measurements; whole transboundary totals are reported separately.',
            '- **Boundary limits:** GADM and Natural Earth are diagnostic references, not legal sovereignty, '
            'international-boundary, territorial-sea or EEZ determinations. Water body / Lake Chad is not '
            'Nigerian administration or wholesale Nigerian land. NoData remains unknown, never zero.',
            '- **Application contract:** catalog `crossBorder` metadata describes required interpretation; '
            'the focus-area Area summary is not an automatic country filter. Foreign features never receive '
            'Nigerian canonical IDs through nearest-distance or fuzzy-name inference.',
            '- **Evidence:** `../cross-border-data-policy.md`, `../../config/cross-border-policy.json`, '
            '`cross-border-policy-register.csv`, the core audit policy summary and public catalog metadata '
            'provide the versioned rules and all 98 layer assignments.',
        ]
    else:
        cross_border_executive = (
            '7. **A cross-border data policy still needs to be propagated.** Foreign, marine, transboundary '
            'and map-sheet content requires consistent retention and Nigeria-only aggregation rules.')
        cross_border_details = []
    quality_current = layer_quality_is_current(quality_register, core)
    if quality_current:
        quality_summary = quality_register['summary']
        quality_counts = ', '.join(
            f'{key} {value}' for key, value in quality_summary['quality_use_class_counts'].items())
        metadata_counts = ', '.join(
            f'{key} {value}' for key, value in quality_summary['metadata_status_counts'].items())
        quality_executive = (
            f'8. **A layer quality and metadata register covers all {layer_count} layers.** '
            f'{quality_summary["structural_status_counts"].get("structural_pass", 0)} layers pass '
            'applicable structural checks and 16 hidden topology originals retain historical defects '
            'as provenance. One WPDx layer still requires source-vintage name-join review. '
            f'{quality_summary["layers_with_metadata_gaps"]} layers have explicit source-metadata gaps; '
            'no numeric accuracy score is invented.')
        quality_details = [
            '### F — Added: layer quality and metadata register', '',
            f'- **Quality use classes:** {quality_counts}. These are evidence-based usage categories, '
            'not quality scores. Structural passes do not certify absolute positional accuracy, '
            'completeness or legal boundaries.',
            '- **Current review:** `groundwater_boreholes_wpdx_pt` has all 99,245 points contained but '
            '314 non-equivalent LGA-name joins requiring source-vintage review; no coordinate shift is '
            'indicated. Ward, magnetic, hidden-source and cross-border limitations remain separate.',
            f'- **Metadata completeness:** {metadata_counts}. '
            f'{quality_summary["layers_with_metadata_gaps"]} layers have at least one gap across publisher, '
            'dataset, URL, licence/terms, temporal coverage and local reference. Missing values remain '
            'blank or `not_recorded`; metadata completeness is not licence clearance.',
            f'- **Lineage:** {len(layer_quality.load_metadata()["sources"])} reusable source records cover '
            '79 active layers, with 19 hidden originals inheriting their active source. Every row carries '
            'the current GeoPackage SHA-256, CRS, bounds, attributes/grid, visibility, public export, '
            'cross-border rule, quality evidence and recommended action.',
            '- **Publication:** compact `quality` and `sourceMetadata` fields are embedded in the public '
            'catalog, with a register summary/hash. Hidden layers remain unpublished.',
            '- **Evidence:** `layer-quality-register.json` / `.csv` / `.md` and '
            '`../../config/layer-metadata.json` provide the complete register and maintenance procedure.',
        ]
    else:
        quality_executive = (
            '8. **The layer quality and metadata register needs regeneration.** Current source hashes, '
            'quality dispositions and source-metadata completeness must be consolidated.')
        quality_details = []
    topology_resolved = bool(
        topology_correction and topology['total_invalid'] == 0 and
        topology['provenance_invalid'] == topology_correction['repair_count'] and
        all(topology_correction['checks'].values()))
    if topology_resolved:
        verification_path = ROOT / 'docs/geospatial-audit/topology-correction-verification.json'
        topology_verification = json.loads(verification_path.read_text(encoding='utf8'))
        unchanged_blobs = sum(
            layer['unchanged_geometry_blobs'] for layer in topology_correction['layers'].values())
        automatic_count = (topology_correction['repair_count'] -
                           len(topology_correction['reviewed_cases']) -
                           len(topology_correction['reviewed_extent_cases']))
        topology_executive = (
            f'3. **The reviewed polygon-topology correction is complete with zero active invalid geometries.** '
            f'All {topology_correction["repair_count"]} former exceptions across '
            f'{topology_correction["affected_layer_count"]} layers are valid MultiPolygons. '
            f'{unchanged_blobs:,} untargeted geometry blobs and every attribute are unchanged; '
            f'{topology["provenance_invalid"]} invalid originals remain only in hidden provenance.')
        topology_details = [
            '### B1 — Resolved with provenance: polygon topology errors', '',
            f'- **Before:** {topology_correction["repair_count"]} invalid geometries: '
            + ', '.join(f'**{count} {reason}**' for reason, count in
                        topology_verification['reason_counts'].items()) +
            f'; {topology_correction["visible_repairs"]} visible and '
            f'{topology_correction["hidden_repairs"]} hidden. **After: zero active invalid geometries.**',
            f'- **Method:** GEOS {topology_correction["geos_version"]} MakeValid linework, retaining valid '
            f'polygonal coverage and discarding zero-area line residue from '
            f'{topology_correction["collapsed_line_residue_features"]} features. No coordinate translation, '
            'feature deletion, FID change or attribute edit was applied.',
            f'- **Review gates:** {automatic_count} automatic cases, three individually reviewed area cases '
            '(Gulf of Guinea, Cross River and historical climate water), and one reviewed collapsed-line '
            'envelope case. The largest automatic absolute area change was '
            f'{topology_verification["maximum_automatic_area_change_fraction"]:.3%}. Invalid source signed '
            'areas are diagnostic, not authoritative ground areas.',
            f'- **Bounds and unchanged data:** all raw GEOS linework bounds are unchanged. One zero-area '
            f'vertical line extended {topology_correction["maximum_bounds_delta_degrees"]:.12f}° north of its '
            'polygon; discarding it shrinks only that feature envelope. '
            f'{unchanged_blobs:,} untargeted geometry blobs remain byte-identical and every attribute is preserved.',
            '- **Raster regression:** all 22 exact geology raster/vector class checks retain identical '
            'sampled-cell counts and agreement fractions before and after repair.',
            f'- **Static export:** the five-decimal default remains, with {sum(public_precision_fallbacks.values())} '
            'per-feature higher-precision fallbacks recorded in `public/catalog.json` to prevent '
            'rounding-induced invalidity. The exporter does not MakeValid or alter source geometry.',
            '- **Provenance:** 16 full source copies are hidden as `*_topology_original`; their 191 invalid '
            'geometries are historical evidence and excluded from active-defect counts. '
            '`topology-correction-ledger.csv`, `topology-correction-verification.json` and '
            '`topology-correction-result.json` record every feature, review, area, bounds delta and hash.',
            '- **Evidence:** `topology-exceptions-before.csv` preserves the original 191 exceptions; '
            '`topology-exceptions.csv` is the now-empty active exception register. '
            '`raster-class-agreement-before-topology.csv` preserves the pre-repair raster baseline; '
            '`topology-reviewed-cases.png` shows all four reviewed before/after dispositions.',
        ]
    else:
        topology_executive = (
            f'3. **{topology["visible_invalid"]} visible and {topology["hidden_invalid"]} hidden polygon '
            'geometries fail OGC validity.** These require topology repair and area regression tests, '
            'not coordinate translation.')
        topology_details = [
            '### B1 — Medium: polygon topology errors', '',
            f'- Total: **{topology["total_invalid"]}** invalid geometries: '
            + ', '.join(f'**{count} {reason}**' for reason, count in topology['reason_counts'].items()) + '.',
            f'- **{topology["visible_invalid"]}** occur in visible layers and '
            f'**{topology["hidden_invalid"]}** in hidden layers.',
            '- **Action:** repair in a separate, reviewable operation using GEOS `make_valid`, then compare '
            'feature counts, bounds, areas and raster-class agreement.',
            '- **Evidence:** `topology-exceptions.csv` and the `topology` section of `extended-audit.json`.',
        ]

    if correction and strict_diva:
        capital_executive = (
            f'1. **The state-capital correction is complete and reproducible.** '
            f'{correction["corrected_with_osm"]} scanned-map positions were replaced individually with reviewed '
            f'OSM city/town nodes and {correction["retained_corroborated_gazetteer"]} corroborated gazetteer '
            f'positions were retained. Strict held-out DIVA validation across {strict_diva["eligible_capitals"]} '
            f'eligible matches gives median **{strict_diva["median_distance_km"]:.3f} km**, p95 '
            f'**{strict_diva["p95_distance_km"]:.3f} km** and maximum **{strict_diva["maximum_distance_km"]:.3f} km**; '
            'all 37 outputs also pass named-state containment. ' +
            ('Remaining findings are documented scope limitations.'
             if hidden_resolved and magnetic_resolved and residual_resolved else
             'Other findings remain open.'))
        capital_details = [
            '### A1 — Resolved with provenance: state-capital positions', '',
            f'- **Construction:** {correction["corrected_with_osm"]} same-name OSM city/town replacements and '
            f'{correction["retained_corroborated_gazetteer"]} retained approximate gazetteer positions. '
            'No coordinates were averaged and no constant shift was applied.',
            f'- **Strict held-out DIVA:** median / p95 / maximum **{strict_diva["median_distance_km"]:.3f} / '
            f'{strict_diva["p95_distance_km"]:.3f} / {strict_diva["maximum_distance_km"]:.3f} km** across '
            f'{strict_diva["eligible_capitals"]} eligible matches. Six selection-informed cases are excluded: '
            + ', '.join(strict_diva['selection_informed_exclusions']) + '.',
            f'- **All available DIVA cross-source comparisons:** median / p95 / maximum '
            f'**{diva["median_distance_km"]:.3f} / {diva["p95_distance_km"]:.3f} / '
            f'{diva["maximum_distance_km"]:.3f} km** across {diva["matched_capitals"]} matches. '
            'Osogbo has no suitable DIVA match; state containment still applies.',
            '- **OSM is not independent validation for the 32 replacements.** Its residuals are construction '
            'self-consistency checks; only the five unchanged positions use OSM solely as corroboration.',
            '- **Reviewed exceptions:** Yola uses the DIVA-corroborated OSM town rather than the separate '
            'northern metropolitan/Jimeta city node; Asaba retains its Delta-side approximation because the '
            'OSM reference lies across the GADM boundary; Abuja and Lokoja retain reviewed OSM nodes despite '
            '5.27/5.23 km DIVA centre differences.',
            '- **Provenance:** the original is hidden as `settlements_state_capitals_map2023_original_pt`; '
            'the visible attributes retain previous coordinates, source, movement and QA notes. Before/after '
            'SHA256 values and reviewed exceptions are in `capital-correction-result.json`.',
            '- **Evidence:** `capital-correction-ledger.csv` is the authoritative 37-row review record; '
            '`capital-coordinate-comparison.csv` / `.png` are current comparisons; `-before.csv` / `-before.png` '
            'preserve the uncorrected evidence.',
        ]
        if historical_capital:
            capital_details.insert(2, '- ' + historical_capital)
        correction_note = (
            'Only the documented capital correction was applied. No automatic correction was applied to the '
            'other findings: administrative identity, topology, magnetic coverage and hidden artefacts remain '
            'separate reviewable tasks. A blanket translation would still be professionally unsafe.')
        containment_note = (
            'All 37 corrected capital points fall inside their named state. Containment is independent of the '
            'OSM construction coordinates, but it establishes administrative plausibility rather than survey accuracy.')
        next_step = (
            '**Recommended next step:** verify the Gada/Illela identities against an authoritative Sokoto source '
            '(A2), then handle topology repair, magnetic refetch and hidden-artefact review as separate changes. '
            'Keep the capital provenance and rerun both audits after every subsequent correction.')
    else:
        capital_executive = (
            f'1. **Visible state-capital positions are not reliable ground locations.** All '
            f'{osm["matched_capitals"]} capitals have OSM same-name matches, but median separation is '
            f'**{osm["median_distance_km"]:.2f} km**, p95 **{osm["p95_distance_km"]:.2f} km**, and maximum '
            f'**{osm["maximum_distance_km"]:.2f} km**. DIVA independently gives a median of '
            f'**{diva["median_distance_km"]:.2f} km**. This is a systematic source-position problem, not random screen distortion.')
        capital_details = [
            '### A1 — High: state-capital source positions disagree with independent places', '',
            f'- OSM median / p95 / maximum: **{osm["median_distance_km"]:.2f} / {osm["p95_distance_km"]:.2f} / {osm["maximum_distance_km"]:.2f} km** across {osm["matched_capitals"]} matches.',
            f'- DIVA median / p95 / maximum: **{diva["median_distance_km"]:.2f} / {diva["p95_distance_km"]:.2f} / {diva["maximum_distance_km"]:.2f} km** across {diva["matched_capitals"]} matches.',
            f'- The 22 grey-square capital symbols have median OSM separation **{grey["median_osm_distance_km"]:.2f} km**; the median OSM-minus-source residual is **{grey["median_osm_east_minus_source_m"]/1000:.2f} km east and {grey["median_osm_north_minus_source_m"]/1000:.2f} km north**.',
            f'- The largest OSM separation in this audit is **{largest_capital["capital"]}: {largest_capital["osm_distance_km"]:.2f} km**.',
            '- **Action:** replace or explicitly reclassify the visible layer using vetted coordinates. Do not apply one average shift to all 37. Preserve the scanned positions as hidden provenance.',
            '- **Evidence:** `capital-coordinate-comparison.csv` contains every source and reference coordinate; `.png` maps the residuals.',
        ]
        correction_note = (
            'No automatic correction has been applied. A single translation would be professionally unsafe: '
            'the capital errors vary by feature, while the Sokoto problem is administrative identity rather than geometry registration.')
        containment_note = (
            'All 37 capital points fall inside their named state, but containment alone is insufficient—the '
            'independent same-name distances above expose the positional problem.')
        next_step = (
            '**Recommended next step:** handle A1 and A2 as source-correction tasks with independent reference '
            'evidence, then rerun both audit scripts and the production build.')

    if topology_resolved:
        correction_note = (
            'Only the documented capital and reviewed polygon-topology corrections were applied. '
            'Administrative identity, magnetic coverage, residual ward issues and hidden artefacts remain '
            'separate reviewable tasks. No blanket translation, administrative relabelling, magnetic infilling '
            'or hidden-artefact deletion was performed.')
        next_step = (
            '**Recommended next step:** verify the Gada/Illela identities against an authoritative Sokoto '
            'source (A2), preserving the completed capital and topology provenance. Then address magnetic '
            'coverage and hidden-source artefacts independently; rerun both audits and production tests '
            'after every subsequent correction.')
    if gada_resolved:
        correction_note = (
            'Only the documented capital, reviewed polygon-topology and evidence-gated Gada/Illela identity '
            'corrections were applied. Magnetic coverage, residual ward exceptions and hidden artefacts '
            'remain separate reviewable tasks. No blanket translation, ward movement, geometry replacement, '
            'magnetic infilling or hidden-artefact deletion was performed.')
        next_step = (
            '**Recommended next step:** preserve the completed capital, topology and Gada/Illela provenance. '
            'Review residual ward exceptions—including Darna/Sabon Gari—individually rather than forcing '
            'containment, then address magnetic coverage and hidden-source artefacts independently.')
    if residual_resolved:
        correction_note = (
            'Only the documented capital, reviewed polygon-topology, Gada/Illela identity and three '
            'evidence-gated residual LGA attribute corrections were applied. Magnetic coverage and hidden '
            'artefacts remain separate tasks; the 37 reviewed ward exceptions are documented, not forced '
            'into containment. No blanket translation, ward movement, geometry replacement, magnetic '
            'infilling or hidden-artefact deletion was performed.')
        next_step = (
            '**Recommended next step:** preserve all correction and 40-case review provenance. Seek new '
            'authoritative evidence before changing the two suspect coordinates or Kwambai; otherwise '
            'address magnetic coverage and hidden-source artefacts independently.')
    if magnetic_resolved and residual_resolved:
        correction_note = (
            'Only the documented capital, reviewed polygon-topology, Gada/Illela identity, three '
            'evidence-gated residual LGA attribute corrections and metadata-only magnetic '
            'partial-coverage reclassification were applied. Hidden artefacts remain a separate task; '
            'the 37 reviewed ward exceptions are documented, not forced into containment. No blanket '
            'translation, ward movement, geometry replacement, magnetic infilling or hidden-artefact '
            'deletion was performed.')
        next_step = (
            '**Recommended next step:** preserve all correction, 40-case review and magnetic '
            'reclassification provenance. Address hidden-source artefacts independently. Replace the '
            'partial magnetic derivative only with a verified source rebuild that passes the coverage '
            'gate; never infer missing magnetic values by interpolation.')
    if hidden_resolved and magnetic_resolved and residual_resolved:
        correction_note = (
            'Only the documented capital, reviewed polygon-topology, Gada/Illela identity, three '
            'evidence-gated residual LGA attribute corrections, metadata-only magnetic '
            'partial-coverage reclassification and two evidence-gated hidden-artifact resolutions '
            'were applied. FID 479 was quarantined—not silently deleted—while every D0451 feature '
            'attribute and geometry byte was retained. No blanket translation, ward movement, '
            'geometry replacement or magnetic infilling was performed.')
        next_step = (
            '**Recommended next step:** no further automatic correction is recommended. Preserve '
            'all five correction/reclassification evidence chains and the remaining ward/coastal and '
            'partial-magnetic scope limitations. Reopen a case only for new authoritative evidence '
            'or a verified complete source rebuild.')
    if admin_identified and hidden_resolved and magnetic_resolved and residual_resolved:
        correction_note = (
            'Only the documented capital, reviewed polygon-topology, Gada/Illela identity, three '
            'evidence-gated residual LGA attribute corrections, metadata-only magnetic '
            'partial-coverage reclassification, two evidence-gated hidden-artifact resolutions and '
            'schema-only stable administrative identifier additions were applied. FID 479 was '
            'quarantined—not silently deleted—while every D0451 feature attribute and geometry byte '
            'was retained. Identifier installation preserved every original value and geometry byte. '
            'No blanket translation, ward movement, geometry replacement or magnetic infilling was performed.')
        next_step = (
            '**Recommended next step:** no further automatic correction is recommended. Preserve '
            'all six correction/reclassification evidence chains and the administrative identifier '
            'registry. Use canonical IDs for new joins; never backfill the 220 unresolved INEC ward '
            'links without new authoritative evidence. Reopen a case only for new evidence or a '
            'verified source rebuild.')
    if cross_border_defined:
        correction_note += (
            ' The cross-border task changed policy, audit and catalog metadata only; it did not alter '
            'any GeoPackage, feature value or geometry.')
        next_step = (
            '**Recommended next step:** no further automatic correction is recommended. Preserve all six '
            'correction/reclassification evidence chains, the administrative identifier registry and '
            '`ngmap-cross-border-v1`. Apply the cross-border register before any Nigeria-only aggregation; '
            'use canonical IDs for new joins and never backfill unresolved INEC links or clip transboundary '
            'sources without a separately documented derivative.')
    if quality_current:
        correction_note += (
            ' The layer quality/metadata task added curated source documentation and generated registers; '
            'it did not modify any GeoPackage, feature value or geometry.')
        next_step = (
            '**Recommended next step:** preserve all correction evidence and regenerate '
            '`ngmap-layer-quality-v1` after any source, audit or metadata change. Review the 314 WPDx '
            'LGA-name joins against source vintages and fill recorded metadata gaps only from traceable '
            'sources; do not infer licences, dates, coordinates or national totals to make the register '
            'look complete.')
    executive_status = (
        'All six prioritized correction/reclassification tasks are complete; the reviewed ward '
        'exceptions, partial magnetic coverage, unresolved external identifier links and other '
        'documented scope qualifications remain explicit:'
        if admin_identified and hidden_resolved and magnetic_resolved and residual_resolved else
        'All five prioritized correction/reclassification tasks are complete; the reviewed ward '
        'exceptions, partial magnetic coverage and other documented scope qualifications remain explicit:'
        if hidden_resolved and magnetic_resolved and residual_resolved else
        'The capital, polygon-topology, Gada/Illela identity and residual ward/LGA reviews plus the '
        'magnetic partial-coverage disclosure are complete; hidden-source issues still require separate treatment:'
        if magnetic_resolved and residual_resolved else
        'The capital, polygon-topology, Gada/Illela identity and residual ward/LGA reviews are complete; '
        'magnetic coverage and hidden-source issues still require separate treatment:'
        if residual_resolved else
        'The capital, polygon-topology and Gada/Illela identity corrections are complete; magnetic coverage '
        'and hidden-source issues still require separate treatment:'
        if gada_resolved else
        'The capital and polygon-topology corrections are complete; administrative identity, magnetic '
        'coverage and hidden-source issues still require separate treatment:'
        if topology_resolved else
        'The capital correction is complete; administrative identity, topology, coverage and hidden-source '
        'issues still require separate treatment:')

    lines = [
        '# Professional geospatial alignment and plausibility audit', '',
        f'Audited source commit: `{core["source_commit"]}`',
        f'Scope: **all {database_count} GeoPackages — {vector_count} vector layers, {numeric_count} numeric rasters and {image_count} georeferenced image overlays; visible and hidden data included.**',
        '', 'See `layer-review.md` for the explicit disposition and evidence level of every layer.',
        '', '## Executive conclusion', '',
        '**The layers must not receive a blanket “all aligned” certification.** The audit found no evidence of a repository-wide CRS error, latitude/longitude swap, null-island coordinates or a single national translation. Most layers pass structural and gross-registration checks, and several independent pairs align strongly. ' + executive_status,
        '',
        capital_executive,
        admin_executive,
        topology_executive,
        magnetic_executive,
        hidden_executive,
        identifier_executive,
        cross_border_executive,
        quality_executive,
        '', correction_note,
        '', '## Prioritized findings', '',
        *capital_details,
        '',
        *admin_details,
        '',
        *residual_details,
        '',
        *topology_details,
        '',
        *magnetic_details,
        '',
        '### C — Hidden/source-data issues and scope qualifications', '',
        *hidden_details,
        '',
        *identifier_details,
        '',
        *cross_border_details,
        '',
        *quality_details,
    ]
    if pop_outliers:
        for item in pop_outliers:
            lines.append(f'- Hidden population district **{item["district_id"]}** has a stated area of **{item["area_km2"]:,.0f} km²**. That is not a plausible ordinary district polygon and indicates a connected-region/vectorisation abstraction problem, not something to repair by shifting coordinates.')
    lines += [
        '- Visible WDPA includes correctly identified Cameroon features such as Korup, Takamanda and Waza-Logone; the large Gulf of Guinea polygon is explicitly marine; offshore heat-flow records are tagged `domain=marine`. Lake Chad ports are intentionally outside the land-only reference but remain valid water/port context. These are scope issues, not coordinate errors.',
        f'- Classified point-outlier outcomes: ' + '; '.join(f'**{key}: {value}**' for key, value in sorted(classifications.items())) + '.',
        '- OSM/DIVA extraction envelopes contain neighbouring-country settlements. If the intended product is Nigeria-only, use a separately documented clipped derivative or label them as surrounding context rather than moving them or clipping the source in place.',
        '', '## Checks that support alignment', '',
        '### Coordinate systems, geometry decoding and raster grids', '',
        f'- **{database_count}/{database_count} SQLite integrity checks passed.** All {layer_count} spatial layers declare EPSG:4326 with no contents/geometry-column SRS mismatch.',
        f'- **0 null geometries, 0 empty geometries, 0 non-finite coordinates and 0 out-of-range longitude/latitude geometries** across {len(core["vectors"])} vector layers.',
        f'- **{topology["total_invalid"]} active invalid geometries.** Hidden topology provenance separately retains **{topology["provenance_invalid"]}** historical invalid originals; those copies are not current production data.',
        '- Every computed vector extent agrees with its declared GeoPackage extent to better than 0.001°. All 16 raster/image tile matrices have positive pixel sizes, decodable tiles and bounds consistent with their contents metadata.',
        f'- Excluding the explicitly partial magnetic product, sampled valid-data coverage inside Nigerian land is **{min(land_values):.1%}–{max(land_values):.1%}** across the other 12 numeric rasters; outside-land valid fractions are low edge effects. This confirms tile-grid and clipping-mask registration, but is not by itself proof of every cell value’s absolute accuracy.',
        '',
        '### Exact raster/vector classification pairs', '',
        '| Raster / vector pair | Classes | Agreement range | Interpretation |',
        '|---|---:|---:|---|',
    ]
    for pair in raster['class_pairs']:
        rows = [r for r in class_rows if r['raster'] == pair['raster']]
        lines.append(f'| `{pair["raster"]}` / `{pair["vector"]}` | {len(rows)} | '
                     f'{min(r["agreement_fraction"] for r in rows):.1%}–{max(r["agreement_fraction"] for r in rows):.1%} | '
                     'Strong whole-class registration; small residuals are consistent with boundary/rasterisation differences |')
    landslide = raster['landslide_value_distributions']
    lines += [
        '', f'- Landslide medians increase from **{landslide["1"]["p0_p25_p50_p75_p95_p100"][2]:.5g}** in rank 1 to **{landslide["4"]["p0_p25_p50_p75_p95_p100"][2]:.5g}** in rank 4, supporting correct raster/vector registration and ordinal meaning.',
        f'- **{raster["settlement_builtup_samples"]["positive_builtup_fraction_among_valid"]:.1%}** of **{raster["settlement_builtup_samples"]["valid_samples"]:,}** valid representative-point samples from 12,000 settlement-extent polygons have positive built-up surface; median **{raster["settlement_builtup_samples"]["median_builtup_m2_per_cell"]:,.0f} m² per cell**.',
        '- `raster-class-agreement.csv` provides every class sample count, expected code, agreement fraction and dominant-code distribution.',
        '',
        '### Administrative and independent national controls', '',
        f'- GADM LGA polygons reconstruct every state with minimum area IoU **{core["administrative"]["minimum_state_from_lgas_iou"]:.8f}**. The population-state polygons are geometrically identical to the state source (minimum IoU **{core["administrative"]["minimum_population_state_iou"]:.8f}**).',
        f'- The special 775th LGA polygon is **Water body / Lake Chad**, explaining 775 polygons versus 774 LGA centroids; it was excluded from land-mask and national land-boundary comparisons.',
        f'- Independent geoBoundaries/Natural Earth national boundary comparison: area IoU **{independent_boundary["area_iou"]:.5f}**, directed median nearest-boundary distances **{independent_boundary["source_to_target"]["median_km"]:.3f} km** and **{independent_boundary["target_to_source"]["median_km"]:.3f} km**. The remaining differences are consistent with source generalisation and boundary vintage.',
        f'- {containment_note}',
        '- All 99,245 boreholes have a containing GADM LGA. Raw name mismatches are dominated by spelling variants; fuzzy-name results for boreholes, OSM/DIVA places, airports and POIs are retained in `extended-audit.json` rather than being misreported as coordinate failures.',
        '',
        '### Scans and linear features', '',
        '- The existing control-based registration report shows geology/mineral scan river controls at sub-kilometre to few-kilometre agreement and documents correction of the former 3.2 km mineral-vector offset. See `docs/registration/registration-report.md` and its before/after evidence.',
        '- In this audit, 2011 geology contact lines have a **0.119 km median** nearest distance to their unit-polygon boundaries; 98.3% of samples are within 5 km.',
        '- Roads, railways and rivers do **not** show a common constant translation: matched nearest-line median east/north residuals are generally below 0.3 km. Larger p95 distances reflect different network completeness, map scale and generalisation. DIVA contains many minor roads/rivers absent from the scanned maps, so reverse coverage percentages are not alignment scores.',
        '- These are consistency checks, not proof that every geological contact or mineral occurrence is survey-accurate.',
        '', '## Professional limitations', '',
        '- **Internal alignment is not absolute ground truth.** Two layers derived from the same incorrect source can agree perfectly and still be wrong on the ground.',
        '- OSM, DIVA, Natural Earth, GADM and geoBoundaries are external corroborating sources, but none is a legal survey. OSM is a construction source—not independent validation—for the 32 corrected capitals. DIVA statistics distinguish strict held-out cases from selection-informed candidate review. Authoritative ground control is still required for legal, engineering or mineral-title decisions.',
        '- Different survey years, administrative vintages, generalisation and coast/lake treatments create legitimate residuals. Exceptions were therefore interpreted by feature type and stated scope.',
        '- Scanned-map symbol alignment verifies digitisation relative to that sheet; it does not independently verify the real-world mineral occurrence or settlement coordinate.',
        '- Historical picture polygons for climate, soil pH and population are different products/years from the modern rasters. Their numeric disagreement was not misused as a coordinate test.',
        *(['- INEC controls ward-to-LGA assignments and ward names; its directory is not a legal polygon survey. '
            'The ArcGIS reference provides independent identity corroboration, but its simplified two-feature '
            'extract was not used as replacement geometry or relabelled as an official GRID3 product.'
           ] if gada_resolved else []),
        *(['- The residual review uses INEC for assignment and 40 independent point-intersection responses '
           'for boundary corroboration. Independent disagreements remain visible; no external geometry was '
           'substituted and no ward coordinate was moved.'
           ] if residual_resolved else []),
        *(['- EMAG2 remains a partial derivative despite its global source product name. The 90.2% '
           'sampled / 90.1% full-cell figures describe data presence, not scientific accuracy. NoData '
           'must not be interpreted as zero nanoTesla or filled by spatial interpolation.'
           ] if magnetic_resolved else []),
        *(['- The hidden town layer remains a scanned-sheet cross-check source, not an authoritative '
           'settlement gazetteer. Population picture regions are class connected regions, not legal '
           'districts; D0451’s semantic exclusion must survive any future export or republication.'
           ] if hidden_resolved else []),
        *(['- `ngmap-admin-v1` IDs are repository-issued, not official government codes. INEC internal '
           'IDs and local codes describe electoral registration areas, not legal boundary surveys. '
           'The 220 null INEC ward links are intentional unresolved evidence gaps, not missing '
           'canonical IDs; do not infer them from fuzzy names or row order.'
           ] if admin_identified else []),
        *(['- Cross-border scope classes govern retention and aggregation, not sovereignty. GADM and '
           'Natural Earth remain diagnostic references; map inclusion does not prove Nigerian '
           'administration, a legal boundary, territorial waters or an EEZ. The catalog policy metadata '
           'does not turn the generic focus-area summary into an automatic country filter.'
           ] if cross_border_defined else []),
        *(['- The layer register’s structural pass is limited to applicable integrity, CRS, extent and '
           'geometry checks; it is not an accuracy or completeness score. Metadata completeness counts '
           'six source fields and is not licence clearance. Hidden historical defects remain provenance, '
           'and the WPDx source-vintage name-join review remains open.'
           ] if quality_current else []),
        '', '## Reproduction and evidence files', '',
        '```bash',
        'python -m pip install -r scripts/requirements.txt',
        'python scripts/audit_geospatial.py',
        'python scripts/audit_geospatial_extended.py',
        'python scripts/layer_quality_register.py',
        'python scripts/audit_geospatial_extended.py',
        'python scripts/build_site.py',
        '```', '',
        '- `audit.json`: full core inventory, per-layer geometry and scope metrics, admin checks, national-boundary and line comparisons.',
        '- `extended-audit.json`: independent capital checks, topology, raster registration/coverage and named-point results.',
        f'- `layer-review.md` / `layer-review.csv`: explicit disposition, evidence and action for every one of the {layer_count} layers.',
        '- `capital-correction-ledger.csv` / `capital-correction-result.json`: all 37 correction decisions, previous/new coordinates, sources, QA, review exceptions and hashes.',
        '- `capital-coordinate-comparison.csv` and `.png`: current capital comparisons; `-before.csv` / `-before.png` preserve the uncorrected evidence.',
        f'- `ward-lga-exceptions.csv` and `sokoto-gada-illela.png`: all {ward_summary["total_outside_assigned_lga"]} current assigned-LGA exceptions and the current Sokoto evidence.',
        *(['- `gada-illela-correction-ledger.csv` / `gada-illela-verification.json` / '
            '`gada-illela-correction-result.json`: official controls, independent identity direction, all '
            '601 attribute-only decisions, before/after source and provenance hashes and post-apply checks. '
            '`references/` documents the exact two-feature boundary response and source limitations.'
           ] if gada_resolved else []),
        *(['- `ward-lga-review-ledger.csv` / `ward-lga-review-verification.json` / '
           '`ward-lga-correction-result.json`: all 40 individual dispositions, three attribute-only '
           'corrections, official and independent evidence, before/after hashes and post-apply checks. '
           '`ward-lga-review.md`, `ward-lga-exceptions-before-residual-review.csv` and '
           '`references/ward-lga-review-sources.md` preserve the human review and source limitations.'
           ] if residual_resolved else []),
        *(['- `magnetic-coverage-reclassification-verification.json` / '
           '`magnetic-coverage-reclassification-result.json` / '
           '`magnetic-coverage-reclassification.md`: explicit partial-coverage decision, full-cell '
           'and sampled coverage, state register, before/after metadata and unchanged-data hashes.'
           ] if magnetic_resolved else []),
        *(['- `hidden-source-artifact-ledger.csv` / `hidden-source-artifact-verification.json` / '
           '`hidden-source-artifact-result.json` / `hidden-source-artifact-resolution.md`: the '
           'quarantined legend row and D0451 semantic exclusion, nearest-settlement and '
           'state/LGA-intersection evidence, sidecar provenance and complete before/after digests.'
           ] if hidden_resolved else []),
        *(['- `admin-identifier-verification.json` / `admin-identifier-result.json` / '
           '`admin-identifier-resolution.md` and `../admin-identifiers/`: canonical assignment rules, '
           'the 9,622-row registry, pinned INEC source manifest, external-link limitations, complete '
           'original-row/geometry digests and six before/after source hash chains.'
           ] if admin_identified else []),
        *(['- `../cross-border-data-policy.md` / `../../config/cross-border-policy.json` / '
           '`cross-border-policy-register.csv`: versioned retention, publication and aggregation rules, '
           'diagnostic-boundary limitations and all 98 per-layer scope assignments. Public catalog '
           '`crossBorderPolicy` and per-layer `crossBorder` fields carry the same policy ID and rules.'
           ] if cross_border_defined else []),
        *(['- `layer-quality-register.json` / `.csv` / `.md` and '
           '`../../config/layer-metadata.json`: all 98 source hashes, structural/topology statuses, '
           'review dispositions, attributes/grids, public exports, source attribution, temporal coverage, '
           'licence/terms status and explicit metadata gaps. Public catalog `quality` and '
           '`sourceMetadata` fields carry the compact register projection.'
           ] if quality_current else []),
        '- `topology-correction-ledger.csv` / `topology-correction-verification.json` / `topology-correction-result.json`: all 191 feature repairs, four explicit review dispositions, before/after areas and bounds, source/provenance hashes and post-apply checks.',
        '- `topology-exceptions.csv`: current active exceptions; `topology-exceptions-before.csv` preserves all 191 original defects and GEOS reasons.',
        '- `raster-class-agreement.csv`: all 22 exact geology class checks; `raster-class-agreement-before-topology.csv` preserves the pre-repair baseline.',
        '- `raster-coverage-by-state.csv`: magnetic valid-cell fraction by state.',
        '- `point-outliers-classified.csv`: offshore/neighbouring-country/review interpretation for every point over 10 km from land.',
        '', next_step,
    ]
    return '\n'.join(lines) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'docs' / 'geospatial-audit')
    args = parser.parse_args()
    out = args.output_dir
    core = json.loads((out / 'audit.json').read_text(encoding='utf8'))

    print('Independent capital comparisons', flush=True)
    capital, cap_rows = capital_cross_source_checks()
    correction_path = out / 'capital-correction-result.json'
    if correction_path.exists():
        capital['correction'] = json.loads(correction_path.read_text(encoding='utf8'))
    write_csv(out / 'capital-coordinate-comparison.csv', cap_rows)
    print('Detailed ward exceptions', flush=True)
    ward_summary, ward_rows = ward_exception_checks(core['administrative'])
    write_csv(out / 'ward-lga-exceptions.csv', ward_rows)
    print('Topology reasons', flush=True)
    topology, topology_rows = topology_checks(core)
    write_csv(out / 'topology-exceptions.csv', topology_rows,
              ['bounds', 'feature_index', 'layer', 'reason', 'visibility'])
    print('Raster/vector registration and coverage', flush=True)
    raster, class_rows, state_rows = raster_registration_checks()
    write_csv(out / 'raster-class-agreement.csv', class_rows)
    write_csv(out / 'raster-coverage-by-state.csv', state_rows)
    print('Named-point administrative checks', flush=True)
    named = {
        'groundwater_boreholes_wpdx_pt': named_point_containment('groundwater_boreholes_wpdx_pt', 'state', 'lga'),
        'settlements_places_osm_pt': named_point_containment('settlements_places_osm_pt', 'state', 'lga'),
        'settlements_gazetteer_diva_pt': named_point_containment('settlements_gazetteer_diva_pt', 'state', 'lga'),
        'infrastructure_airports_osm_pt': named_point_containment('infrastructure_airports_osm_pt', 'adm1_name'),
        'infrastructure_pois_osm_pt': named_point_containment('infrastructure_pois_osm_pt', 'adm1_name'),
    }
    with (out / 'point-outliers-over-10km.csv').open(encoding='utf8') as handle:
        core_outliers = list(csv.DictReader(handle))
    outliers = classify_point_outliers(core_outliers)
    write_csv(out / 'point-outliers-classified.csv', outliers)
    crs = crs_checks()
    print('Per-layer disposition register and evidence figures', flush=True)
    review_rows = make_layer_review(core, raster, class_rows, named)
    assert len(review_rows) == len(layer_index()) == len(core['vectors']) + len(core['rasters'])
    write_layer_review(out, review_rows)
    make_figures(out, cap_rows, ward_rows)
    topology_correction_path = out / 'topology-correction-result.json'
    topology_correction = (json.loads(topology_correction_path.read_text(encoding='utf8'))
                           if topology_correction_path.exists() else None)
    gada_correction_path = out / 'gada-illela-correction-result.json'
    gada_correction = (json.loads(gada_correction_path.read_text(encoding='utf8'))
                       if gada_correction_path.exists() else None)
    residual_correction_path = out / 'ward-lga-correction-result.json'
    residual_correction = (json.loads(residual_correction_path.read_text(encoding='utf8'))
                           if residual_correction_path.exists() else None)
    magnetic_reclassification_path = out / 'magnetic-coverage-reclassification-result.json'
    magnetic_reclassification = (
        json.loads(magnetic_reclassification_path.read_text(encoding='utf8'))
        if magnetic_reclassification_path.exists() else None)
    hidden_artifact_path = out / 'hidden-source-artifact-result.json'
    hidden_artifacts = (json.loads(hidden_artifact_path.read_text(encoding='utf8'))
                        if hidden_artifact_path.exists() else None)
    admin_identifier_path = out / 'admin-identifier-result.json'
    admin_identifiers = (json.loads(admin_identifier_path.read_text(encoding='utf8'))
                         if admin_identifier_path.exists() else None)
    quality_register_path = out / 'layer-quality-register.json'
    quality_register = (json.loads(quality_register_path.read_text(encoding='utf8'))
                        if quality_register_path.exists() else None)

    extended = {
        'source_commit': core['source_commit'], 'capital_cross_source': capital,
        'ward_exceptions': ward_summary, 'topology': topology,
        'topology_correction': topology_correction,
        'gada_illela_correction': gada_correction,
        'residual_ward_lga_correction': residual_correction,
        'magnetic_coverage_reclassification': magnetic_reclassification,
        'hidden_source_artifact_resolution': hidden_artifacts,
        'administrative_identifiers': admin_identifiers,
        'cross_border_policy': core.get('cross_border_policy'),
        'layer_quality_register': quality_register.get('summary') if quality_register else None,
        'raster_registration': raster, 'named_point_containment': named,
        'point_outlier_classifications': dict(Counter(r['classification'] for r in outliers)),
        'crs': crs,
    }
    (out / 'extended-audit.json').write_text(
        json.dumps(extended, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
    report = make_report(core, capital, cap_rows, ward_summary, ward_rows, topology,
                         raster, class_rows, named, outliers, crs, topology_correction,
                         gada_correction, residual_correction, magnetic_reclassification,
                         hidden_artifacts, admin_identifiers, quality_register)
    (out / 'README.md').write_text(report, encoding='utf8')
    print(f'Wrote extended audit and professional report to {out}', flush=True)


if __name__ == '__main__':
    main()
