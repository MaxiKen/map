#!/usr/bin/env python3
"""Transparently classify the committed EMAG2 derivative as partial coverage.

This is deliberately a metadata-only correction. It does not interpolate, fill,
shift, resample or otherwise alter magnetic values. A staged GeoPackage changes
only gpkg_contents.description and last_change; all tile bytes and every other
 table are verified against the source before installation.

    python scripts/reclassify_magnetic_coverage.py
    python scripts/reclassify_magnetic_coverage.py --apply --approve-verified

After a result exists, the default invocation verifies it and changes nothing.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import shutil
import sqlite3
import struct
import sys
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import shapely
import tifffile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import build_site  # noqa: E402
from audit_geospatial import nigeria_reference  # noqa: E402
from audit_geospatial_extended import load_features  # noqa: E402

OUT = ROOT / 'docs/geospatial-audit'
SOURCE = ROOT / 'data/Geology/geophysics_magnetic_emag2_rst.gpkg'
CONFIG = ROOT / 'config/layers.config.json'
TABLE = 'geophysics_magnetic_emag2_rst'
LABEL = 'Magnetic anomaly (EMAG2 v2, partial coverage)'
VERIFICATION = OUT / 'magnetic-coverage-reclassification-verification.json'
RESULT = OUT / 'magnetic-coverage-reclassification-result.json'
JOURNAL = OUT / 'magnetic-coverage-install-journal.json'
REPORT = OUT / 'magnetic-coverage-reclassification.md'
PNG = ROOT / 'public/data/geophysics_magnetic_emag2_rst.png'
VALUES = ROOT / 'public/data/geophysics_magnetic_emag2_rst.vals.gz'
STATE_CSV = OUT / 'raster-coverage-by-state.csv'


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def connect(path, readonly=False):
    return sqlite3.connect(f'file:{path}?mode=ro', uri=True) if readonly else sqlite3.connect(path)


def q(name):
    return '"' + name.replace('"', '""') + '"'


def update_hash(hash_obj, value):
    if isinstance(value, bytes):
        payload = b'b' + value
    else:
        payload = ('j' + json.dumps(value, ensure_ascii=False, sort_keys=True)).encode('utf8')
    hash_obj.update(struct.pack('<Q', len(payload)))
    hash_obj.update(payload)


def tile_digest(con):
    digest = hashlib.sha256()
    count = 0
    for zoom, column, row, blob in con.execute(
            f'select zoom_level,tile_column,tile_row,tile_data from {q(TABLE)} '
            'order by zoom_level,tile_column,tile_row'):
        for value in (zoom, column, row):
            update_hash(digest, value)
        update_hash(digest, blob)
        count += 1
    return {'rows': count, 'sha256': digest.hexdigest()}


def non_contents_digest(con):
    """Hash schemas and rows for every table except the intentionally edited one."""
    digest = hashlib.sha256()
    tables = [row[0] for row in con.execute(
        "select name from sqlite_master where type='table' and name != 'gpkg_contents' order by name")]
    for table in tables:
        columns = [row[1] for row in con.execute(f'pragma table_info({q(table)})')]
        update_hash(digest, table)
        update_hash(digest, columns)
        for values in con.execute(f'select * from {q(table)} order by rowid'):
            for value in values:
                update_hash(digest, value)
    return digest.hexdigest()


def load_array(path):
    with closing(connect(path, True)) as con:
        nodata = con.execute(
            'select data_null from gpkg_2d_gridded_coverage_ancillary '
            'where tile_matrix_set_name=?', (TABLE,)).fetchone()[0]
        previous = build_site.table_fill
        try:
            build_site.table_fill = nodata
            array, bounds = build_site.stitch(
                con, TABLE, lambda data: tifffile.imread(io.BytesIO(data)).astype(np.float32))
        finally:
            build_site.table_fill = previous
    return array, bounds, float(nodata)


def coverage_evidence(array, bounds, nodata):
    height, width = array.shape
    west, south, east, north = bounds
    x = west + (np.arange(width) + 0.5) * (east - west) / width
    y = north - (np.arange(height) + 0.5) * (north - south) / height
    xx, yy = np.meshgrid(x, y)
    valid = (array != nodata) & np.isfinite(array)
    land = nigeria_reference()
    inside = shapely.contains_xy(land, xx, yy)

    # Match audit_geospatial_extended.py's published sample exactly.
    step = 2
    sampled = array[::step, ::step]
    sh, sw = sampled.shape
    sx = west + (np.arange(sw) * step + 0.5) * (east - west) / width
    sy = north - (np.arange(sh) * step + 0.5) * (north - south) / height
    sxx, syy = np.meshgrid(sx, sy)
    sampled_inside = shapely.contains_xy(land, sxx, syy)
    sampled_valid = (sampled != nodata) & np.isfinite(sampled)

    states = []
    features, _ = load_features('admin_states_gadm_pg', ['state'])
    for feature in features:
        state_inside = shapely.contains_xy(feature['geometry'], xx, yy)
        if state_inside.any():
            states.append({
                'state': feature['properties']['state'],
                'cells': int(state_inside.sum()),
                'valid_cells': int(valid[state_inside].sum()),
                'valid_fraction': float(valid[state_inside].mean()),
            })
    return {
        'grid': {'width': width, 'height': height, 'cells': int(array.size),
                 'valid_cells': int(valid.sum()), 'nodata_cells': int((~valid).sum()),
                 'nodata_value': nodata},
        'full_cell_land': {'cells': int(inside.sum()), 'valid_cells': int(valid[inside].sum()),
                           'valid_fraction': float(valid[inside].mean())},
        'sampled_land': {'stride_cells': step, 'cells': int(sampled_inside.sum()),
                         'valid_cells': int(sampled_valid[sampled_inside].sum()),
                         'valid_fraction': float(sampled_valid[sampled_inside].mean())},
        'states': states,
    }


def state(coverage, name):
    return next(row for row in coverage['states'] if row['state'] == name)


def partial_description(coverage):
    sampled = coverage['sampled_land']['valid_fraction']
    return (
        f'PARTIAL NIGERIA COVERAGE: {sampled:.1%} of sampled land cells are valid '
        f'(Ekiti {state(coverage, "Ekiti")["valid_fraction"]:.1%}, '
        f'Osun {state(coverage, "Osun")["valid_fraction"]:.1%}, '
        f'Oyo {state(coverage, "Oyo")["valid_fraction"]:.1%}, '
        f'Sokoto {state(coverage, "Sokoto")["valid_fraction"]:.1%}). '
        'Missing areas remain NoData; no interpolation or magnetic infilling was applied. '
        'This is not continuous national coverage. EMAG2 Earth Magnetic Anomaly Grid v2, '
        '2 arc-minute global total-field anomaly in nT (NOAA/NCEI / CIRES, free), '
        'averaged to 0.025 degree and masked to Nigeria. EPSG:4326.'
    )


def source_evidence(path):
    with closing(connect(path, True)) as con:
        columns = [row[1] for row in con.execute('pragma table_info(gpkg_contents)')]
        values = con.execute('select * from gpkg_contents where table_name=?', (TABLE,)).fetchone()
        contents = dict(zip(columns, values))
        tiles = tile_digest(con)
        other_tables = non_contents_digest(con)
        integrity = con.execute('pragma integrity_check').fetchone()[0]
    array, bounds, nodata = load_array(path)
    return {
        'sha256': sha256(path), 'contents': contents, 'tiles': tiles,
        'non_contents_sha256': other_tables, 'integrity_check': integrity,
        'array_sha256': hashlib.sha256(np.asarray(array, dtype='<f4').tobytes()).hexdigest(),
        'bounds': list(bounds), 'coverage': coverage_evidence(array, bounds, nodata),
    }


def check_published_state_coverage(coverage):
    with STATE_CSV.open(encoding='utf8', newline='') as handle:
        published = {row['state']: float(row['valid_fraction'])
                     for row in csv.DictReader(handle)}
    return (set(published) == {row['state'] for row in coverage['states']} and
            all(abs(published[row['state']] - row['valid_fraction']) < 1e-12
                for row in coverage['states']))


def build_verification():
    evidence = source_evidence(SOURCE)
    config = json.loads(CONFIG.read_text(encoding='utf8'))
    coverage = evidence['coverage']
    description = partial_description(coverage)
    assets = {'png_sha256': sha256(PNG), 'values_sha256': sha256(VALUES)}
    checks = {
        'source_integrity_ok': evidence['integrity_check'] == 'ok',
        'expected_500_by_400_grid': coverage['grid']['width'] == 500 and coverage['grid']['height'] == 400,
        'partial_coverage_confirmed': 0.90 < coverage['sampled_land']['valid_fraction'] < 0.91,
        'published_state_coverage_reproduced': check_published_state_coverage(coverage),
        'ekiti_has_no_valid_cells': state(coverage, 'Ekiti')['valid_fraction'] == 0,
        'visible_label_says_partial_coverage': (
            config['layers'][TABLE]['label'] == LABEL and 'partial coverage' in LABEL),
        'description_says_partial_and_nodata': (
            description.startswith('PARTIAL NIGERIA COVERAGE:') and
            'remain NoData' in description and 'not continuous national coverage' in description),
        'public_asset_baselines_present': PNG.is_file() and VALUES.is_file(),
    }
    return {
        'status': 'ready_for_approved_metadata_reclassification',
        'source_path': str(SOURCE.relative_to(ROOT)),
        'source_sha256': evidence['sha256'],
        'before_description': evidence['contents']['description'],
        'after_description': description,
        'visible_label': LABEL,
        'tile_rows': evidence['tiles']['rows'],
        'tile_sha256': evidence['tiles']['sha256'],
        'array_sha256': evidence['array_sha256'],
        'non_contents_sha256': evidence['non_contents_sha256'],
        'coverage': coverage,
        'public_assets_before': assets,
        'checks': checks,
    }


def write_report(verification, applied):
    coverage = verification['coverage']
    lines = [
        '# EMAG2 magnetic coverage — transparent reclassification', '',
        f'**Status:** {"applied and verified" if applied else "reviewed dry run; not applied"}.', '',
        '## Decision', '',
        'The committed derivative is **partial coverage**, not a continuous national magnetic surface. '
        'No values were interpolated or otherwise repaired. Missing cells remain NoData. The visible '
        f'layer label is **{LABEL}**.', '',
        f'- Full-cell Nigerian land coverage: **{coverage["full_cell_land"]["valid_fraction"]:.1%}** '
        f'({coverage["full_cell_land"]["valid_cells"]:,} of {coverage["full_cell_land"]["cells"]:,} cells).',
        f'- Published stride-two land sample: **{coverage["sampled_land"]["valid_fraction"]:.1%}** '
        f'({coverage["sampled_land"]["valid_cells"]:,} of {coverage["sampled_land"]["cells"]:,} cells).',
        f'- Grid: {coverage["grid"]["width"]} × {coverage["grid"]["height"]}; '
        f'{coverage["grid"]["valid_cells"]:,} valid and {coverage["grid"]["nodata_cells"]:,} NoData cells.',
        '- The distinction between 90.1% full-cell and 90.2% sampled coverage is intentional.', '',
        '## Preservation', '',
        f'- Tile rows: {verification["tile_rows"]}; tile SHA256: `{verification["tile_sha256"]}`.',
        f'- Logical float32 array SHA256: `{verification["array_sha256"]}`.',
        f'- All tables other than `gpkg_contents`: `{verification["non_contents_sha256"]}`.',
        '- Installation changes only `gpkg_contents.description` and `last_change`. '
        'The public PNG and compressed value grid are expected to remain byte-identical.', '',
        '## State coverage', '',
        '| State / area | Cells | Valid cells | Valid fraction |', '|---|---:|---:|---:|',
    ]
    for row in coverage['states']:
        lines.append(f'| {row["state"]} | {row["cells"]} | {row["valid_cells"]} | '
                     f'{row["valid_fraction"]:.1%} |')
    lines += [
        '', '## Reproduction', '', '```bash',
        'python scripts/reclassify_magnetic_coverage.py',
        '# Only after reviewing the verification evidence:',
        'python scripts/reclassify_magnetic_coverage.py --apply --approve-verified',
        'python scripts/audit_geospatial.py',
        'python scripts/audit_geospatial_extended.py',
        'python scripts/build_site.py', '```', '',
        'A future source rebuild must pass the completeness gate in '
        '`scripts/fetch_geology_layers.py`; otherwise it must retain explicit partial-coverage labeling.',
    ]
    REPORT.write_text('\n'.join(lines) + '\n', encoding='utf8')


def write_dry_run():
    verification = build_verification()
    if not all(verification['checks'].values()):
        raise RuntimeError(f'reclassification gates failed: {verification["checks"]}')
    VERIFICATION.write_text(json.dumps(verification, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
    write_report(verification, applied=False)
    print(f'Reviewed partial magnetic coverage; wrote {VERIFICATION}. No source data was modified.')


def finalize_installation():
    journal = json.loads(JOURNAL.read_text(encoding='utf8'))
    current = source_evidence(SOURCE)
    verification = json.loads(VERIFICATION.read_text(encoding='utf8'))
    checks = {
        'source_hash_matches_staged_installation': current['sha256'] == journal['after_sha256'],
        'description_is_explicit_partial_coverage': current['contents']['description'] == verification['after_description'],
        'tile_bytes_unchanged': current['tiles']['sha256'] == verification['tile_sha256'],
        'logical_array_unchanged': current['array_sha256'] == verification['array_sha256'],
        'all_other_tables_unchanged': current['non_contents_sha256'] == verification['non_contents_sha256'],
        'coverage_unchanged': current['coverage'] == verification['coverage'],
        'integrity_check_ok': current['integrity_check'] == 'ok',
        'public_png_unchanged': sha256(PNG) == verification['public_assets_before']['png_sha256'],
        'public_values_unchanged': sha256(VALUES) == verification['public_assets_before']['values_sha256'],
    }
    if not all(checks.values()):
        raise RuntimeError(f'post-installation verification failed: {checks}')
    result = {
        'status': 'reclassified_and_verified',
        'classification': 'partial_coverage_no_interpolation',
        'applied_at': datetime.now(timezone.utc).isoformat(),
        'source_path': str(SOURCE.relative_to(ROOT)),
        'before_sha256': journal['before_sha256'],
        'after_sha256': journal['after_sha256'],
        'verification_sha256': sha256(VERIFICATION),
        'visible_label': LABEL,
        'before_description': verification['before_description'],
        'after_description': verification['after_description'],
        'coverage': verification['coverage'],
        'tile_rows': verification['tile_rows'],
        'tile_sha256': verification['tile_sha256'],
        'array_sha256': verification['array_sha256'],
        'non_contents_sha256': verification['non_contents_sha256'],
        'public_assets_before': verification['public_assets_before'],
        'staged_verification': journal['staged_verification'],
        'checks': checks,
    }
    RESULT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
    write_report(verification, applied=True)
    JOURNAL.unlink()
    print(f'Applied and verified metadata-only partial-coverage classification: {RESULT}')


def apply_reclassification(approve):
    if not approve:
        raise RuntimeError('metadata reclassification requires --approve-verified')
    verification = json.loads(VERIFICATION.read_text(encoding='utf8'))
    if (verification['status'] != 'ready_for_approved_metadata_reclassification' or
            not all(verification['checks'].values())):
        raise RuntimeError('review verification is not ready')
    if sha256(SOURCE) != verification['source_sha256']:
        raise RuntimeError('magnetic source changed after review')
    recomputed = build_verification()
    protected = ('source_sha256', 'before_description', 'after_description', 'tile_rows',
                 'tile_sha256', 'array_sha256', 'non_contents_sha256', 'coverage',
                 'public_assets_before', 'checks')
    if any(recomputed[key] != verification[key] for key in protected):
        raise RuntimeError('source no longer reproduces the reviewed metadata plan')
    stage = SOURCE.with_name(SOURCE.name + '.reclassifying.gpkg')
    if stage.exists():
        raise RuntimeError('stale reclassification stage requires review')
    try:
        shutil.copyfile(SOURCE, stage)
        changed_at = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
        with closing(connect(stage)) as con:
            con.execute('update gpkg_contents set description=?, last_change=? where table_name=?',
                        (verification['after_description'], changed_at, TABLE))
            if con.total_changes != 1:
                raise RuntimeError('expected exactly one gpkg_contents row to change')
            con.commit()
        before = source_evidence(SOURCE)
        after = source_evidence(stage)
        ignored = {'sha256', 'contents'}
        if any(before[key] != after[key] for key in before if key not in ignored):
            raise RuntimeError('staged raster or non-contents metadata changed')
        content_changes = {key for key in before['contents']
                           if before['contents'][key] != after['contents'][key]}
        if content_changes != {'description', 'last_change'}:
            raise RuntimeError(f'unexpected gpkg_contents changes: {content_changes}')
        journal = {
            'before_sha256': verification['source_sha256'], 'after_sha256': sha256(stage),
            'staged_verification': {
                'changed_contents_fields': sorted(content_changes),
                'tile_bytes_unchanged': before['tiles'] == after['tiles'],
                'logical_array_unchanged': before['array_sha256'] == after['array_sha256'],
                'all_other_tables_unchanged': before['non_contents_sha256'] == after['non_contents_sha256'],
                'coverage_unchanged': before['coverage'] == after['coverage'],
                'integrity_check': after['integrity_check'],
            },
        }
        JOURNAL.write_text(json.dumps(journal, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
        os.replace(stage, SOURCE)
        finalize_installation()
    finally:
        if stage.exists():
            stage.unlink()


def verify_existing_result():
    result = json.loads(RESULT.read_text(encoding='utf8'))
    current = source_evidence(SOURCE)
    verification = json.loads(VERIFICATION.read_text(encoding='utf8'))
    checks = {
        'source_hash': current['sha256'] == result['after_sha256'],
        'verification_hash': sha256(VERIFICATION) == result['verification_sha256'],
        'description': current['contents']['description'] == result['after_description'],
        'tiles': current['tiles']['sha256'] == result['tile_sha256'],
        'array': current['array_sha256'] == result['array_sha256'],
        'other_tables': current['non_contents_sha256'] == result['non_contents_sha256'],
        'coverage': current['coverage'] == result['coverage'],
        'public_png': sha256(PNG) == result['public_assets_before']['png_sha256'],
        'public_values': sha256(VALUES) == result['public_assets_before']['values_sha256'],
        'recorded_checks': all(result['checks'].values()),
        'verification_matches_result': verification['coverage'] == result['coverage'],
    }
    if not all(checks.values()):
        raise RuntimeError(f'existing reclassification verification failed: {checks}')
    print('Existing magnetic partial-coverage reclassification verified; nothing reapplied.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--approve-verified', action='store_true')
    args = parser.parse_args()
    if RESULT.exists():
        verify_existing_result()
        return
    if JOURNAL.exists():
        finalize_installation()
        return
    if args.apply:
        if not VERIFICATION.exists():
            raise RuntimeError('run the read-only review first')
        apply_reclassification(args.approve_verified)
    else:
        write_dry_run()


if __name__ == '__main__':
    main()
