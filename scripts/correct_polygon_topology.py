#!/usr/bin/env python3
"""Review and repair invalid polygon topology without translating coordinates.

The default mode is read-only. It independently finds invalid polygon features,
repairs them in memory with GEOS MakeValid (linework), removes only zero-area
non-polygonal residue, and writes a feature-level evidence ledger:

    python scripts/correct_polygon_topology.py

After reviewing the ledger, apply the staged, hash-checked operation with:

    python scripts/correct_polygon_topology.py --apply --approve-reviewed

Every source GeoPackage is copied to a hidden ``*_topology_original`` provenance
layer. Only originally invalid geometries change. Feature IDs, valid geometry
blobs and all attributes remain byte-for-byte/value-for-value unchanged. Three
area changes above 0.5% require the explicit reviewed dispositions below; the
invalid source area itself is not treated as authoritative.

The operation refuses unexpected counts, source hashes, geometry types,
empty/non-polygonal output, unreviewed area or bounds changes, spatial triggers,
or raster/vector class regressions. One collapsed-line envelope reduction has a
separate explicit disposition. Existing corrections are verified, not reapplied.
Full before/after source hashes and provenance hashes are recorded.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import shutil
import sqlite3
import struct
from collections import Counter, defaultdict
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import shapely
from shapely import wkb
from shapely.geometry import MultiPolygon

from audit_geospatial import (
    DATA, ROOT, _load_features_cached, gpkg_geometry, layer_index, load_features,
    q, shapely_metric,
)

OUT = ROOT / 'docs' / 'geospatial-audit'
LEDGER = OUT / 'topology-correction-ledger.csv'
VERIFICATION = OUT / 'topology-correction-verification.json'
RESULT = OUT / 'topology-correction-result.json'
BEFORE_EXCEPTIONS = OUT / 'topology-exceptions-before.csv'
BEFORE_RASTER = OUT / 'raster-class-agreement-before-topology.csv'
EXPECTED_INVALID = 191
EXPECTED_LAYERS = 16
AUTO_AREA_FRACTION = 0.005
BOUNDS_TOLERANCE_DEGREES = 1e-10
SUFFIX = '_topology_original'

# These are not blanket tolerances. Each disposition follows component-level
# inspection and is recomputed and hash-checked during both dry run and apply.
REVIEWED_EXTENT_CASES = {
    ('geology_background_map2023_pg', 234): (
        'Precambrian basement polygon: MakeValid separates one vertical, zero-area '
        'LineString from the valid polygon. The line alone extends 0.006091117859 '
        'degrees north of the polygon. Dropping that collapsed line shrinks the '
        'feature envelope but changes no polygon coordinate or polygon area.'
    ),
}

REVIEWED_CASES = {
    ('forest_reserves_water_picture_pg', 795): (
        'Gulf of Guinea: one self-crossing exterior ring forms an oppositely wound '
        'eastern marine lobe (about 1,868 km2). Invalid signed-area evaluation '
        'subtracts that lobe; MakeValid includes both marine lobes. The roughly '
        'two-lobe area increase is expected and all bounds remain unchanged.'
    ),
    ('protected_areas_wdpa_pg', 148): (
        'Cross River National Park: five overlapping/nested input components are '
        'resolved to two valid polygons. Repaired area 3,294.375 km2 is closer to '
        'the independently stored WDPA area 3,318.661 km2 than the invalid '
        'signed-area result 3,462.900 km2; no coordinates are translated.'
    ),
    ('climate_temperature_picture_pg', 8): (
        'Historical water class: self-crossing component lobes, principally the '
        'component near 6.86E/9.82N, have ambiguous signed area. MakeValid '
        'polygonises their intended positive lobes. Raster-era value comparison '
        'is not applicable to this historical picture product.'
    ),
}

FIELDS = [
    'layer', 'fid', 'visibility', 'feature_label', 'invalid_reason',
    'review_status', 'review_reason', 'source_sha256',
    'before_gpkg_blob_sha256', 'after_gpkg_blob_sha256',
    'before_geometry_type', 'after_geometry_type',
    'before_component_count', 'after_component_count',
    'before_vertex_count', 'after_vertex_count',
    'before_area_km2', 'after_area_km2', 'area_delta_km2',
    'absolute_area_change_fraction', 'max_bounds_delta_degrees',
    'raw_linework_bounds_delta_degrees', 'before_bounds', 'after_bounds',
    'collapsed_line_parts', 'collapsed_residue_types',
    'collapsed_line_length_degrees', 'reported_area_km2',
]


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def blob_sha(blob):
    return hashlib.sha256(blob).hexdigest()


def hidden_path_for(table):
    source = layer_index()[table]['path']
    hidden_stem = source.stem if source.stem.startswith('hidden_') else f'hidden_{source.stem}'
    return source.with_name(f'{hidden_stem}{SUFFIX}.gpkg')


def hidden_table_for(table):
    return f'{table}{SUFFIX}'


def geometry_column(con, table):
    row = con.execute(
        'select column_name,geometry_type_name from gpkg_geometry_columns where table_name=?',
        (table,),
    ).fetchone()
    if row is None:
        raise RuntimeError(f'{table}: missing geometry-column registration')
    return row


def gpkg_blob(original_blob, geometry):
    """Preserve GPKG header flags/SRS/envelope style and replace only geometry."""
    if original_blob[:2] != b'GP' or len(original_blob) < 8:
        raise RuntimeError('invalid GeoPackage geometry header')
    flags = original_blob[3]
    if flags & 16:
        raise RuntimeError('cannot repair an empty source geometry')
    envelope = (flags >> 1) & 7
    if envelope not in (0, 1):
        raise RuntimeError('only 2D XY envelopes are supported')
    envelope_size = 32 if envelope else 0
    header = bytearray(original_blob[:8])
    if envelope:
        minx, miny, maxx, maxy = geometry.bounds
        endian = '<' if flags & 1 else '>'
        header.extend(struct.pack(f'{endian}4d', minx, maxx, miny, maxy))
    else:
        header.extend(original_blob[8:8])
    offset = 8 + envelope_size
    if len(original_blob) <= offset:
        raise RuntimeError('truncated GeoPackage geometry')
    byte_order = original_blob[offset]
    if byte_order not in (0, 1):
        raise RuntimeError('unsupported WKB byte order')
    header.extend(wkb.dumps(geometry, byte_order=byte_order, include_srid=False))
    return bytes(header)


def polygonal_repair(geometry):
    """GEOS linework MakeValid, retaining its polygonal coverage only."""
    fixed = shapely.make_valid(geometry, method='linework')
    polygons = []
    residue = []

    def collect(part):
        if part.geom_type == 'Polygon':
            polygons.append(part)
        elif part.geom_type in ('MultiPolygon', 'GeometryCollection'):
            for child in part.geoms:
                collect(child)
        else:
            residue.append(part)

    collect(fixed)
    if not polygons:
        raise RuntimeError('MakeValid produced no polygonal geometry')
    repaired = polygons[0] if len(polygons) == 1 else MultiPolygon(polygons)
    if repaired.geom_type == 'Polygon':
        repaired = MultiPolygon([repaired])
    if repaired.is_empty or not repaired.is_valid:
        raise RuntimeError('polygonal MakeValid output is empty or invalid')
    if repaired.geom_type != 'MultiPolygon':
        raise RuntimeError(f'unexpected repaired type {repaired.geom_type}')
    if not np.isfinite(shapely.get_coordinates(repaired)).all():
        raise RuntimeError('non-finite repaired coordinate')
    # Dropping zero-area line residue must not alter the polygonal coverage area.
    if any(part.geom_type not in ('LineString', 'MultiLineString') for part in residue):
        raise RuntimeError('unexpected non-line MakeValid residue')
    if abs(repaired.area - fixed.area) > max(1e-14, abs(fixed.area) * 1e-12):
        raise RuntimeError('non-polygonal residue removal changed polygon area')
    raw_bounds_delta = max(abs(a - b) for a, b in zip(geometry.bounds, fixed.bounds))
    bounds_delta = max(abs(a - b) for a, b in zip(geometry.bounds, repaired.bounds))
    if raw_bounds_delta > BOUNDS_TOLERANCE_DEGREES:
        raise RuntimeError(f'GEOS linework moved bounds by {raw_bounds_delta} degrees')
    if bounds_delta > BOUNDS_TOLERANCE_DEGREES and not residue:
        raise RuntimeError('polygon envelope changed without collapsed line residue')
    return repaired, residue, bounds_delta, raw_bounds_delta


def feature_label(properties, fid):
    for key in ('name', 'class_name', 'district_id', 'feature_id', 'wdpa_id'):
        if properties.get(key) not in (None, ''):
            return str(properties[key])
    return f'FID {fid}'


def repair_row(table, fid, blob, properties, source_hash):
    original = gpkg_geometry(blob)
    repaired, residue, bounds_delta, raw_bounds_delta = polygonal_repair(original)
    new_blob = gpkg_blob(blob, repaired)
    before_area = shapely_metric(original).area / 1e6
    after_area = shapely_metric(repaired).area / 1e6
    delta = after_area - before_area
    fraction = abs(delta) / before_area if before_area else (0.0 if not delta else float('inf'))
    key = (table, int(fid))
    reviewed = key in REVIEWED_CASES
    extent_reviewed = key in REVIEWED_EXTENT_CASES
    if fraction > AUTO_AREA_FRACTION and not reviewed:
        raise RuntimeError(
            f'{table} FID {fid}: unreviewed area change {fraction:.6%}; inspect before apply')
    if bounds_delta > BOUNDS_TOLERANCE_DEGREES and not extent_reviewed:
        raise RuntimeError(
            f'{table} FID {fid}: unreviewed collapsed-line extent change {bounds_delta}')
    if fraction > AUTO_AREA_FRACTION:
        status = 'reviewed_large_area'
        reason = REVIEWED_CASES[key]
    elif bounds_delta > BOUNDS_TOLERANCE_DEGREES:
        status = 'reviewed_collapsed_line_extent'
        reason = REVIEWED_EXTENT_CASES[key]
    else:
        status = 'automatic_checks_passed'
        reason = ''
    return {
        'layer': table, 'fid': int(fid),
        'visibility': 'visible' if layer_index()[table]['visible'] else 'hidden',
        'feature_label': feature_label(properties, fid),
        'invalid_reason': shapely.is_valid_reason(original),
        'review_status': status, 'review_reason': reason,
        'source_sha256': source_hash,
        'before_gpkg_blob_sha256': blob_sha(blob),
        'after_gpkg_blob_sha256': blob_sha(new_blob),
        'before_geometry_type': original.geom_type,
        'after_geometry_type': repaired.geom_type,
        'before_component_count': len(original.geoms) if original.geom_type == 'MultiPolygon' else 1,
        'after_component_count': len(repaired.geoms),
        'before_vertex_count': int(shapely.get_num_coordinates(original)),
        'after_vertex_count': int(shapely.get_num_coordinates(repaired)),
        'before_area_km2': before_area, 'after_area_km2': after_area,
        'area_delta_km2': delta, 'absolute_area_change_fraction': fraction,
        'max_bounds_delta_degrees': bounds_delta,
        'raw_linework_bounds_delta_degrees': raw_bounds_delta,
        'before_bounds': ' '.join(str(v) for v in original.bounds),
        'after_bounds': ' '.join(str(v) for v in repaired.bounds),
        'collapsed_line_parts': len(residue),
        'collapsed_residue_types': ';'.join(sorted({p.geom_type for p in residue})),
        'collapsed_line_length_degrees': sum(p.length for p in residue),
        'reported_area_km2': properties.get('area_km2_wdpa', properties.get('area_km2')),
    }, new_blob


def raster_regression_profile():
    """Compare original and in-memory repaired geometry on identical raster grids."""
    from audit_geospatial_extended import load_raster, values_inside

    output = []
    pairs = [
        ('geology_general_picture_code_rst', 'geology_general_picture_pg', None),
        ('geology_surficial_usgs_code_rst', 'geology_surficial_usgs_pg', 'glg_code'),
    ]
    for raster, vector, key in pairs:
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
            geometry = feature['geometry']
            repaired = polygonal_repair(geometry)[0] if not geometry.is_valid else geometry
            code = expected.get(feature['properties'].get(key), index + 1)
            old_values = values_inside(array, bounds, nodata, geometry, step=3).astype(int)
            new_values = values_inside(array, bounds, nodata, repaired, step=3).astype(int)
            old_agreement = float((old_values == code).mean()) if len(old_values) else None
            new_agreement = float((new_values == code).mean()) if len(new_values) else None
            output.append({
                'raster': raster, 'vector': vector,
                'class': feature['properties'].get(key) or feature['properties'].get('class_name'),
                'expected_code': code,
                'before_sampled_cells': len(old_values), 'after_sampled_cells': len(new_values),
                'before_agreement_fraction': old_agreement,
                'after_agreement_fraction': new_agreement,
                'exact_regression_pass': len(old_values) == len(new_values) and old_agreement == new_agreement,
            })
    return output


def write_csv(path, rows, fields=None):
    fields = fields or list(rows[0])
    with path.open('w', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(rows)


def build_ledger():
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    source_hashes = {}
    reviewed_seen = set()
    extent_reviewed_seen = set()
    for table, meta in layer_index().items():
        if meta['kind'] != 'features' or table.endswith(SUFFIX):
            continue
        source_hash = sha256(meta['path'])
        source_hashes[table] = source_hash
        with sqlite3.connect(f'file:{meta["path"]}?mode=ro', uri=True) as con:
            gcol, declared_type = geometry_column(con, table)
            trigger_count = con.execute(
                "select count(*) from sqlite_master where type='trigger' and tbl_name=?", (table,),
            ).fetchone()[0]
            columns = [r[1] for r in con.execute(f'pragma table_info({q(table)})')]
            for fid, blob in con.execute(f'select fid,{q(gcol)} from {q(table)} order by fid'):
                geometry = gpkg_geometry(blob)
                if geometry is None or geometry.is_valid:
                    continue
                if trigger_count:
                    raise RuntimeError(f'{table}: spatial triggers require a separate index-preservation review')
                if declared_type != 'MULTIPOLYGON':
                    raise RuntimeError(f'{table}: unexpected declared type {declared_type}')
                values = con.execute(f'select * from {q(table)} where fid=?', (fid,)).fetchone()
                properties = dict(zip(columns, values))
                row, _ = repair_row(table, fid, blob, properties, source_hash)
                rows.append(row)
                if row['review_status'] == 'reviewed_large_area':
                    reviewed_seen.add((table, fid))
                if row['review_status'] == 'reviewed_collapsed_line_extent':
                    extent_reviewed_seen.add((table, fid))
        if any(r['layer'] == table for r in rows):
            print(f'{table}: {sum(r["layer"] == table for r in rows)} repairs profiled', flush=True)

    if len(rows) != EXPECTED_INVALID:
        raise RuntimeError(f'expected {EXPECTED_INVALID} invalid features, found {len(rows)}')
    affected = {r['layer'] for r in rows}
    if len(affected) != EXPECTED_LAYERS:
        raise RuntimeError(f'expected {EXPECTED_LAYERS} affected layers, found {len(affected)}')
    if reviewed_seen != set(REVIEWED_CASES):
        raise RuntimeError(f'reviewed-case mismatch: {reviewed_seen ^ set(REVIEWED_CASES)}')
    if extent_reviewed_seen != set(REVIEWED_EXTENT_CASES):
        raise RuntimeError(f'reviewed-extent mismatch: {extent_reviewed_seen ^ set(REVIEWED_EXTENT_CASES)}')

    rows.sort(key=lambda r: (r['layer'], r['fid']))
    write_csv(LEDGER, rows, FIELDS)
    if not BEFORE_EXCEPTIONS.exists():
        shutil.copyfile(OUT / 'topology-exceptions.csv', BEFORE_EXCEPTIONS)
    if not BEFORE_RASTER.exists():
        shutil.copyfile(OUT / 'raster-class-agreement.csv', BEFORE_RASTER)

    raster_rows = raster_regression_profile()
    max_bounds = max(r['max_bounds_delta_degrees'] for r in rows)
    checks = {
        'expected_invalid_count': len(rows) == EXPECTED_INVALID,
        'expected_layer_count': len(affected) == EXPECTED_LAYERS,
        'all_outputs_valid_multipolygon': all(r['after_geometry_type'] == 'MultiPolygon' for r in rows),
        'all_raw_linework_bounds_unchanged': max(r['raw_linework_bounds_delta_degrees'] for r in rows) <= BOUNDS_TOLERANCE_DEGREES,
        'only_reviewed_collapsed_line_changes_polygon_envelope': all(
            r['max_bounds_delta_degrees'] <= BOUNDS_TOLERANCE_DEGREES or
            r['review_status'] == 'reviewed_collapsed_line_extent' for r in rows),
        'all_area_changes_automatic_or_individually_reviewed': all(
            r['absolute_area_change_fraction'] <= AUTO_AREA_FRACTION or
            r['review_status'] == 'reviewed_large_area' for r in rows),
        'all_reviewed_cases_observed_exactly_once': reviewed_seen == set(REVIEWED_CASES),
        'all_reviewed_extent_cases_observed_exactly_once': extent_reviewed_seen == set(REVIEWED_EXTENT_CASES),
        'collapsed_residue_is_line_only_and_zero_area': all(
            r['collapsed_line_parts'] in (0, 1) and
            (not r['collapsed_residue_types'] or
             set(r['collapsed_residue_types'].split(';')) <= {'LineString', 'MultiLineString'})
            for r in rows),
        'all_22_raster_class_checks_exact': len(raster_rows) == 22 and all(
            r['exact_regression_pass'] for r in raster_rows),
    }
    verification = {
        'created_at': datetime.now(timezone.utc).isoformat(),
        'status': 'ready_for_reviewed_apply' if all(checks.values()) else 'failed',
        'algorithm': 'GEOS MakeValid linework; retain valid polygonal coverage; discard zero-area line residue',
        'geos_version': shapely.geos_version_string,
        'shapely_version': shapely.__version__,
        'equal_area_crs': 'EPSG:6933',
        'invalid_source_area_caveat': 'Before area of an invalid geometry is a diagnostic signed-area result, not authoritative ground area.',
        'automatic_absolute_area_change_fraction_limit': AUTO_AREA_FRACTION,
        'bounds_tolerance_degrees': BOUNDS_TOLERANCE_DEGREES,
        'repair_count': len(rows), 'affected_layer_count': len(affected),
        'visible_repairs': sum(r['visibility'] == 'visible' for r in rows),
        'hidden_repairs': sum(r['visibility'] == 'hidden' for r in rows),
        'reason_counts': dict(Counter(r['invalid_reason'].split('[')[0] for r in rows)),
        'collapsed_line_residue_features': sum(r['collapsed_line_parts'] > 0 for r in rows),
        'maximum_bounds_delta_degrees': max_bounds,
        'maximum_raw_linework_bounds_delta_degrees': max(r['raw_linework_bounds_delta_degrees'] for r in rows),
        'maximum_automatic_area_change_fraction': max(
            r['absolute_area_change_fraction'] for r in rows
            if r['review_status'] == 'automatic_checks_passed'),
        'reviewed_cases': [
            {k: r[k] for k in ('layer', 'fid', 'feature_label', 'before_area_km2',
                               'after_area_km2', 'area_delta_km2',
                               'absolute_area_change_fraction', 'review_reason')}
            for r in rows if r['review_status'] == 'reviewed_large_area'
        ],
        'reviewed_extent_cases': [
            {k: r[k] for k in ('layer', 'fid', 'feature_label', 'max_bounds_delta_degrees',
                               'raw_linework_bounds_delta_degrees', 'collapsed_line_parts',
                               'collapsed_line_length_degrees', 'review_reason')}
            for r in rows if r['review_status'] == 'reviewed_collapsed_line_extent'
        ],
        'checks': checks,
        'raster_class_regression': raster_rows,
        'source_sha256': {table: source_hashes[table] for table in sorted(affected)},
        'ledger_sha256': sha256(LEDGER),
    }
    if not all(checks.values()):
        raise RuntimeError(f'verification gates failed: {[k for k, v in checks.items() if not v]}')
    VERIFICATION.write_text(json.dumps(verification, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {LEDGER} and {VERIFICATION}; no GeoPackage was modified.')
    return verification


def load_ledger():
    with LEDGER.open(encoding='utf-8', newline='') as handle:
        return list(csv.DictReader(handle))


def rename_provenance_table(path, old_table, new_table):
    with sqlite3.connect(path) as con:
        con.execute('PRAGMA foreign_keys=OFF')
        con.execute(f'ALTER TABLE {q(old_table)} RENAME TO {q(new_table)}')
        con.execute('update gpkg_contents set table_name=?,identifier=?,description=? where table_name=?',
                    (new_table, new_table,
                     'Hidden pre-topology-correction original; not for publication or current analysis', old_table))
        con.execute('update gpkg_geometry_columns set table_name=? where table_name=?',
                    (new_table, old_table))
        if con.execute("select count(*) from sqlite_master where type='table' and name='gpkg_extensions'").fetchone()[0]:
            con.execute('update gpkg_extensions set table_name=? where table_name=?',
                        (new_table, old_table))
        if con.execute("select count(*) from sqlite_master where type='table' and name='gpkg_metadata_reference'").fetchone()[0]:
            con.execute('update gpkg_metadata_reference set table_name=? where table_name=?',
                        (new_table, old_table))
        if con.execute('pragma integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError(f'{path}: provenance integrity failure')
        con.commit()


def verify_against_original(current_path, current_table, original_path, original_table, expected_rows):
    expected = {(int(r['fid']), r['layer']): r for r in expected_rows}
    targets = {fid for fid, layer in expected if layer == current_table}
    provenance_copy_check = not expected_rows and current_table.endswith(SUFFIX)
    with closing(sqlite3.connect(f'file:{current_path}?mode=ro', uri=True)) as current, \
            closing(sqlite3.connect(f'file:{original_path}?mode=ro', uri=True)) as original:
        current_columns = [r[1] for r in current.execute(f'pragma table_info({q(current_table)})')]
        original_columns = [r[1] for r in original.execute(f'pragma table_info({q(original_table)})')]
        if current_columns != original_columns:
            raise RuntimeError(f'{current_table}: schema columns changed')
        gcol, _ = geometry_column(current, current_table)
        original_gcol, _ = geometry_column(original, original_table)
        if gcol != original_gcol:
            raise RuntimeError(f'{current_table}: geometry column changed')
        current_rows = current.execute(f'select * from {q(current_table)} order by fid').fetchall()
        original_rows = original.execute(f'select * from {q(original_table)} order by fid').fetchall()
        if len(current_rows) != len(original_rows):
            raise RuntimeError(f'{current_table}: feature count changed')
        seen = set()
        unchanged_geometry = 0
        for current_values, original_values in zip(current_rows, original_rows):
            current_props = dict(zip(current_columns, current_values))
            original_props = dict(zip(original_columns, original_values))
            fid = int(current_props['fid'])
            if fid != int(original_props['fid']):
                raise RuntimeError(f'{current_table}: feature IDs/order changed')
            for column in current_columns:
                if column != gcol and current_props[column] != original_props[column]:
                    raise RuntimeError(f'{current_table} FID {fid}: attribute {column} changed')
            before_blob = original_props[original_gcol]
            after_blob = current_props[gcol]
            before = gpkg_geometry(before_blob)
            if fid not in targets:
                if before_blob != after_blob:
                    raise RuntimeError(f'{current_table} FID {fid}: untargeted geometry changed')
                if not before.is_valid and not provenance_copy_check:
                    raise RuntimeError(f'{current_table} FID {fid}: unledgered invalid geometry')
                unchanged_geometry += 1
                continue
            seen.add(fid)
            ledger = expected[(fid, current_table)]
            if blob_sha(before_blob) != ledger['before_gpkg_blob_sha256']:
                raise RuntimeError(f'{current_table} FID {fid}: original blob hash mismatch')
            if blob_sha(after_blob) != ledger['after_gpkg_blob_sha256']:
                raise RuntimeError(f'{current_table} FID {fid}: repaired blob hash mismatch')
            after = gpkg_geometry(after_blob)
            if after.is_empty or not after.is_valid or after.geom_type != 'MultiPolygon':
                raise RuntimeError(f'{current_table} FID {fid}: invalid repaired output')
            bounds_delta = max(abs(a - b) for a, b in zip(before.bounds, after.bounds))
            if (bounds_delta > BOUNDS_TOLERANCE_DEGREES and
                    (current_table, fid) not in REVIEWED_EXTENT_CASES):
                raise RuntimeError(f'{current_table} FID {fid}: unreviewed bounds change')
            if abs(bounds_delta - float(ledger['max_bounds_delta_degrees'])) > 1e-12:
                raise RuntimeError(f'{current_table} FID {fid}: bounds delta differs from ledger')
        if seen != targets:
            raise RuntimeError(f'{current_table}: repaired FID set mismatch')
        if current.execute('pragma integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError(f'{current_table}: SQLite integrity failure')
        return {
            'feature_count': len(current_rows), 'repaired_features': len(seen),
            'unchanged_geometry_blobs': unchanged_geometry,
            'all_attributes_unchanged': True,
            'all_untargeted_geometry_byte_identical': True,
            'integrity_check': 'ok',
        }


def apply_correction(approve):
    verification = json.loads(VERIFICATION.read_text(encoding='utf-8'))
    if verification['status'] != 'ready_for_reviewed_apply' or not all(verification['checks'].values()):
        raise RuntimeError('dry-run verification is not approved')
    if sha256(LEDGER) != verification['ledger_sha256']:
        raise RuntimeError('ledger changed after verification')
    rows = load_ledger()
    reviewed = {r['layer'] for r in rows if r['review_status'] != 'automatic_checks_passed'}
    if reviewed and not approve:
        raise RuntimeError('reviewed large-area cases require --approve-reviewed')
    by_layer = defaultdict(list)
    for row in rows:
        by_layer[row['layer']].append(row)
    if set(by_layer) != verification['source_sha256'].keys():
        raise RuntimeError('ledger/verification layer mismatch')

    staged = {}
    provenance_temp = {}
    try:
        # Build and fully validate every corrected copy before replacing any source.
        for table, layer_rows in sorted(by_layer.items()):
            meta = layer_index()[table]
            source = meta['path']
            if sha256(source) != verification['source_sha256'][table]:
                raise RuntimeError(f'{table}: source hash differs from reviewed dry run')
            hidden = hidden_path_for(table)
            if hidden.exists():
                raise RuntimeError(f'{table}: provenance already exists; refusing overwrite')
            stage = source.with_name(source.name + '.correcting.gpkg')
            backup = hidden.with_name(hidden.name + '.creating.gpkg')
            if stage.exists() or backup.exists():
                raise RuntimeError(f'{table}: stale temporary file requires review')
            shutil.copyfile(source, stage)
            staged[table] = {'stage': stage, 'source': source, 'hidden': hidden,
                             'backup': backup, 'after_sha256': None}
            with sqlite3.connect(stage) as con:
                gcol, _ = geometry_column(con, table)
                original_con = sqlite3.connect(f'file:{source}?mode=ro', uri=True)
                try:
                    columns = [r[1] for r in original_con.execute(f'pragma table_info({q(table)})')]
                    for row in layer_rows:
                        fid = int(row['fid'])
                        values = original_con.execute(
                            f'select * from {q(table)} where fid=?', (fid,)).fetchone()
                        properties = dict(zip(columns, values))
                        recomputed, new_blob = repair_row(
                            table, fid, properties[gcol], properties, verification['source_sha256'][table])
                        for key in FIELDS:
                            if key in ('review_reason', 'feature_label', 'invalid_reason'):
                                continue
                            before_value = row[key]
                            after_value = recomputed[key]
                            if before_value == '' and after_value is None:
                                continue
                            if isinstance(after_value, float):
                                if not abs(float(before_value) - after_value) <= max(1e-10, abs(after_value) * 1e-10):
                                    raise RuntimeError(f'{table} FID {fid}: recomputed {key} differs')
                            elif str(after_value) != str(before_value):
                                raise RuntimeError(f'{table} FID {fid}: recomputed {key} differs')
                        update = con.execute(
                            f'update {q(table)} set {q(gcol)}=? where fid=? and {q(gcol)}=?',
                            (new_blob, fid, properties[gcol]))
                        if update.rowcount != 1:
                            raise RuntimeError(f'{table} FID {fid}: guarded update failed')
                finally:
                    original_con.close()
                con.commit()
            verify_against_original(stage, table, source, table, layer_rows)
            staged[table]['after_sha256'] = sha256(stage)
            print(f'{table}: staged and verified {len(layer_rows)} repairs', flush=True)

        # Hidden originals are complete renamed copies, never the staged outputs.
        for table, paths in staged.items():
            shutil.copyfile(paths['source'], paths['backup'])
            rename_provenance_table(paths['backup'], table, hidden_table_for(table))
            verify_against_original(paths['backup'], hidden_table_for(table),
                                    paths['source'], table, [])
            paths['hidden_sha256'] = sha256(paths['backup'])

        for table, paths in staged.items():
            os.replace(paths['backup'], paths['hidden'])
        for table, paths in staged.items():
            os.replace(paths['stage'], paths['source'])

        finalize_installed_result(
            verification,
            {table: paths['after_sha256'] for table, paths in staged.items()})
        print(f'Applied {len(rows)} topology repairs across {len(staged)} layers; result: {RESULT}')
    finally:
        for paths in staged.values():
            for key in ('stage', 'backup'):
                path = paths[key]
                if path.exists():
                    path.unlink()


def finalize_installed_result(verification, expected_staged_hashes=None):
    """Verify an installed correction and write its result without changing data.

    This is also the recovery path if the process stops after os.replace but
    before result serialization. It never performs another geometry update.
    """
    layer_index.cache_clear()
    _load_features_cached.cache_clear()
    rows = load_ledger()
    by_layer = defaultdict(list)
    for row in rows:
        by_layer[row['layer']].append(row)
    layer_results = {}
    for table, layer_rows in sorted(by_layer.items()):
        current = layer_index()[table]['path']
        hidden = hidden_path_for(table)
        if not hidden.exists():
            raise RuntimeError(f'{table}: installed provenance is missing')
        layer_results[table] = {
            **verify_against_original(current, table, hidden, hidden_table_for(table), layer_rows),
            'before_sha256': verification['source_sha256'][table],
            'after_sha256': sha256(current),
            'provenance_path': str(hidden.relative_to(ROOT)),
            'provenance_table': hidden_table_for(table),
            'provenance_sha256': sha256(hidden),
        }
        if (expected_staged_hashes is not None and
                layer_results[table]['after_sha256'] != expected_staged_hashes[table]):
            raise RuntimeError(f'{table}: installed hash differs from staged output')

    raster_rows = raster_regression_profile()
    baseline = {
        (r['raster'], r['vector'], r['class']): r
        for r in verification['raster_class_regression']
    }
    raster_matches_reviewed_baseline = len(raster_rows) == len(baseline) == 22
    for current in raster_rows:
        key = (current['raster'], current['vector'], current['class'])
        before = baseline.get(key)
        raster_matches_reviewed_baseline &= bool(before) and all(
            current[current_key] == before[before_key]
            for current_key, before_key in (
                ('before_sampled_cells', 'after_sampled_cells'),
                ('after_sampled_cells', 'after_sampled_cells'),
                ('before_agreement_fraction', 'after_agreement_fraction'),
                ('after_agreement_fraction', 'after_agreement_fraction'),
            ))
    if not raster_matches_reviewed_baseline:
        raise RuntimeError('post-apply raster-class values differ from the reviewed original baseline')
    result = {
        'applied_at': datetime.now(timezone.utc).isoformat(),
        'algorithm': verification['algorithm'],
        'geos_version': shapely.geos_version_string,
        'shapely_version': shapely.__version__,
        'repair_count': len(rows), 'affected_layer_count': len(layer_results),
        'visible_repairs': sum(r['visibility'] == 'visible' for r in rows),
        'hidden_repairs': sum(r['visibility'] == 'hidden' for r in rows),
        'collapsed_line_residue_features': sum(int(r['collapsed_line_parts']) > 0 for r in rows),
        'maximum_bounds_delta_degrees': max(float(r['max_bounds_delta_degrees']) for r in rows),
        'maximum_raw_linework_bounds_delta_degrees': max(
            float(r['raw_linework_bounds_delta_degrees']) for r in rows),
        'reviewed_cases': verification['reviewed_cases'],
        'reviewed_extent_cases': verification['reviewed_extent_cases'],
        'checks': {
            'all_191_repairs_verified': sum(v['repaired_features'] for v in layer_results.values()) == EXPECTED_INVALID,
            'all_16_layers_verified': len(layer_results) == EXPECTED_LAYERS,
            'all_attributes_unchanged': all(v['all_attributes_unchanged'] for v in layer_results.values()),
            'all_untargeted_geometry_byte_identical': all(v['all_untargeted_geometry_byte_identical'] for v in layer_results.values()),
            'all_integrity_checks_pass': all(v['integrity_check'] == 'ok' for v in layer_results.values()),
            'all_22_raster_class_checks_exact_after_apply': raster_matches_reviewed_baseline,
            'all_raw_linework_bounds_unchanged': max(
                float(r['raw_linework_bounds_delta_degrees']) for r in rows) <= BOUNDS_TOLERANCE_DEGREES,
            'only_reviewed_collapsed_line_changes_polygon_envelope': all(
                float(r['max_bounds_delta_degrees']) <= BOUNDS_TOLERANCE_DEGREES or
                r['review_status'] == 'reviewed_collapsed_line_extent' for r in rows),
        },
        'layers': layer_results,
        'ledger_sha256': sha256(LEDGER),
        'verification_sha256': sha256(VERIFICATION),
        'raster_class_regression': raster_rows,
    }
    if not all(result['checks'].values()):
        raise RuntimeError('one or more post-apply checks failed')
    RESULT.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    return result


def verify_existing_result():
    result = json.loads(RESULT.read_text(encoding='utf-8'))
    rows = load_ledger()
    by_layer = defaultdict(list)
    for row in rows:
        by_layer[row['layer']].append(row)
    hidden_artifact_path = OUT / 'hidden-source-artifact-result.json'
    hidden_artifacts = (json.loads(hidden_artifact_path.read_text(encoding='utf8'))
                        if hidden_artifact_path.exists() else None)
    for table, saved in result['layers'].items():
        current = layer_index()[table]['path']
        hidden = ROOT / saved['provenance_path']
        current_hash = sha256(current)
        superseded_population = bool(
            table == 'population_districts_picture_pg' and hidden_artifacts and
            hidden_artifacts.get('status') == 'resolved_and_verified' and
            hidden_artifacts['sources']['population']['before_sha256'] == saved['after_sha256'] and
            hidden_artifacts['after_sha256']['population'] == current_hash and
            all(hidden_artifacts.get('checks', {}).values()))
        if ((current_hash != saved['after_sha256'] and not superseded_population) or
                sha256(hidden) != saved['provenance_sha256']):
            raise RuntimeError(f'{table}: current or provenance hash differs from result')
        verify_against_original(current, table, hidden, saved['provenance_table'], by_layer[table])
    print('Existing topology correction and all provenance hashes verified; nothing reapplied.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--approve-reviewed', action='store_true')
    args = parser.parse_args()
    if RESULT.exists():
        verify_existing_result()
        return
    if LEDGER.exists() and VERIFICATION.exists():
        verification = json.loads(VERIFICATION.read_text(encoding='utf-8'))
        installed = [table for table in verification['source_sha256'] if hidden_path_for(table).exists()]
        if installed:
            if set(installed) != set(verification['source_sha256']):
                raise RuntimeError('partial provenance installation requires manual review; refusing to reapply')
            finalize_installed_result(verification)
            print('Verified the already installed correction and wrote the missing result; nothing reapplied.')
            return
    if args.apply:
        if not LEDGER.exists() or not VERIFICATION.exists():
            raise RuntimeError('run the read-only dry run first')
        apply_correction(args.approve_reviewed)
    else:
        build_ledger()


if __name__ == '__main__':
    main()
