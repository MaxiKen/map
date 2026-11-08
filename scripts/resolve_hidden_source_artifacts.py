#!/usr/bin/env python3
"""Resolve the two reviewed hidden-source artefacts without coordinate shifts.

* settlements_towns_map2023_pt FID 479 ("Tow ns") is generic scanned legend
  text, not a settlement. Remove it from the active hidden table and preserve
  its complete original row in a registered attributes/exclusion table.
* population_districts_picture_pg FID 451 / D0451 is a connected population-
  class region, not an administrative district. Retain every feature and byte
  of geometry, but register its semantic exclusion from district-level analysis.

    python scripts/resolve_hidden_source_artifacts.py
    python scripts/resolve_hidden_source_artifacts.py --apply --approve-verified

After a result exists, the default invocation verifies it and changes nothing.
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
import sys
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from audit_geospatial import gpkg_geometry, load_features, shapely_metric  # noqa: E402

OUT = ROOT / 'docs/geospatial-audit'
VERIFICATION = OUT / 'hidden-source-artifact-verification.json'
RESULT = OUT / 'hidden-source-artifact-result.json'
JOURNAL = OUT / 'hidden-source-artifact-install-journal.json'
LEDGER = OUT / 'hidden-source-artifact-ledger.csv'
REPORT = OUT / 'hidden-source-artifact-resolution.md'

TOWNS = 'settlements_towns_map2023_pt'
POPULATION = 'population_districts_picture_pg'
TOWNS_PATH = ROOT / 'data/Settlements/hidden_settlements_towns_map2023_pt.gpkg'
POPULATION_PATH = ROOT / 'data/Population/hidden_population_districts_picture_pg.gpkg'
TOWNS_SIDE = 'settlements_towns_map2023_excluded_artifacts_tbl'
POPULATION_SIDE = 'population_districts_picture_semantic_review_tbl'
TOWNS_FID = 479
POPULATION_FID = 451
SPECS = {
    'towns': {'path': TOWNS_PATH, 'table': TOWNS, 'side': TOWNS_SIDE, 'fid': TOWNS_FID},
    'population': {'path': POPULATION_PATH, 'table': POPULATION, 'side': POPULATION_SIDE, 'fid': POPULATION_FID},
}
TOWNS_DESCRIPTION = (
    "Hidden reviewed 2023 sheet town-label cross-check points. FID 479 generic 'Tow ns' "
    'legend text was excluded from the active table on 2026-11-08; its complete original '
    f'record and geometry are quarantined in {TOWNS_SIDE}. Not a settlement reference or for publication.'
)
POPULATION_DESCRIPTION = (
    'Hidden picture-derived population-class connected regions, not official administrative '
    'districts. D0451 (FID 451) has stated area 121,139.862 km2 and intersects 16 states and '
    f'124 LGAs; it is excluded from district-level analysis in {POPULATION_SIDE}. '
    'Geometry and class attributes are unchanged.'
)


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def blob_sha(blob):
    return hashlib.sha256(blob).hexdigest()


def connect(path, readonly=False):
    return sqlite3.connect(f'file:{path}?mode=ro', uri=True) if readonly else sqlite3.connect(path)


def q(name):
    return '"' + name.replace('"', '""') + '"'


def update_hash(digest, value):
    if isinstance(value, bytes):
        payload = b'b' + value
    else:
        payload = ('j' + json.dumps(value, ensure_ascii=False, sort_keys=True)).encode('utf8')
    digest.update(struct.pack('<Q', len(payload)))
    digest.update(payload)


def rows_and_columns(con, table):
    columns = [row[1] for row in con.execute(f'pragma table_info({q(table)})')]
    rows = con.execute(f'select * from {q(table)} order by fid').fetchall()
    return columns, rows


def feature_digest(con, table):
    columns, rows = rows_and_columns(con, table)
    digest = hashlib.sha256()
    update_hash(digest, columns)
    for row in rows:
        for value in row:
            update_hash(digest, value)
    return digest.hexdigest()


def target_record(con, table, fid):
    columns, rows = rows_and_columns(con, table)
    matches = [row for row in rows if row[columns.index('fid')] == fid]
    if len(matches) != 1:
        raise RuntimeError(f'{table}: expected exactly one FID {fid}')
    return dict(zip(columns, matches[0]))


def snapshot(spec):
    with closing(connect(spec['path'], True)) as con:
        count = con.execute(f'select count(*) from {q(spec["table"])}').fetchone()[0]
        target = target_record(con, spec['table'], spec['fid'])
        integrity = con.execute('pragma integrity_check').fetchone()[0]
        digest = feature_digest(con, spec['table'])
        contents = con.execute('select * from gpkg_contents where table_name=?',
                               (spec['table'],)).fetchone()
        side_exists = con.execute("select 1 from sqlite_master where type='table' and name=?",
                                  (spec['side'],)).fetchone() is not None
    return {
        'source_sha256': sha256(spec['path']), 'feature_count': count,
        'feature_digest': digest, 'target': target, 'integrity_check': integrity,
        'contents': contents, 'sidecar_already_exists': side_exists,
    }


def nearest_settlement_evidence(point):
    metric = shapely_metric(point)
    evidence = {}
    for key, table in (('osm', 'settlements_places_osm_pt'), ('diva', 'settlements_gazetteer_diva_pt')):
        features, _ = load_features(table, ['name'])
        pairs = [(shapely_metric(feature['geometry']).distance(metric) / 1000, feature)
                 for feature in features]
        distance, nearest = min(pairs, key=lambda item: item[0])
        evidence[key] = {'nearest_name': nearest['properties']['name'], 'distance_km': distance}
    return evidence


def intersection_evidence(geometry):
    result = {}
    for key, table, name_field in (
            ('states', 'admin_states_gadm_pg', 'state'),
            ('lgas', 'admin_lgas_gadm_pg', 'lga')):
        selected = [name_field] if key == 'states' else [name_field, 'state']
        features, _ = load_features(table, selected)
        hits = []
        for feature in features:
            if not geometry.intersects(feature['geometry']):
                continue
            area = shapely_metric(geometry.intersection(feature['geometry'])).area / 1e6
            if area >= 1:
                hit = {'name': feature['properties'][name_field], 'intersection_km2': area}
                if key == 'lgas':
                    hit['state'] = feature['properties']['state']
                hits.append(hit)
        result[key] = sorted(hits, key=lambda row: (-row['intersection_km2'], row['name']))
    return result


def build_verification():
    snapshots = {key: snapshot(spec) for key, spec in SPECS.items()}
    town = snapshots['towns']['target']
    district = snapshots['population']['target']
    town_geometry = gpkg_geometry(town['geom'])
    district_geometry = gpkg_geometry(district['geom'])
    nearest = nearest_settlement_evidence(town_geometry)
    intersections = intersection_evidence(district_geometry)
    town_evidence = {
        'fid': TOWNS_FID, 'identifier': town['name'],
        'before_attributes': {key: value for key, value in town.items() if key not in ('fid', 'geom')},
        'geometry_sha256': blob_sha(town['geom']),
        'longitude': town_geometry.x, 'latitude': town_geometry.y,
        'label_dist_pt': town['label_dist_pt'],
        'nearest_settlements': nearest,
        'disposition': 'quarantine_scanned_legend_text_not_a_settlement',
        'reason': ('Generic English plural label text with a 15.8 pt label offset, null state/LGA, '
                   'and no OSM/DIVA settlement within 100 km; do not rename or move it as a town.'),
    }
    population_evidence = {
        'fid': POPULATION_FID, 'identifier': district['district_id'],
        'before_attributes': {key: value for key, value in district.items() if key not in ('fid', 'geom')},
        'geometry_sha256': blob_sha(district['geom']),
        'current_metric_area_km2': shapely_metric(district_geometry).area / 1e6,
        'geometry_type': district_geometry.geom_type,
        'polygon_parts': len(district_geometry.geoms) if district_geometry.geom_type == 'MultiPolygon' else 1,
        'intersections': intersections,
        'state_intersection_count': len(intersections['states']),
        'lga_intersection_count': len(intersections['lgas']),
        'disposition': 'retain_as_connected_population_class_region_exclude_from_district_analysis',
        'reason': ('One connected high-population-class picture region crosses 16 states and 124 LGAs. '
                   'It is not an administrative district; retain its geometry/class as picture evidence '
                   'rather than shifting, splitting or deleting it.'),
    }
    checks = {
        'both_source_integrity_checks_ok': all(row['integrity_check'] == 'ok' for row in snapshots.values()),
        'no_stale_sidecars': not any(row['sidecar_already_exists'] for row in snapshots.values()),
        'town_feature_count_479': snapshots['towns']['feature_count'] == 479,
        'population_feature_count_504': snapshots['population']['feature_count'] == 504,
        'town_target_exact': town['name'] == 'Tow ns' and town['label_dist_pt'] == 15.8,
        'town_has_no_admin_assignment': town['state'] is None and town['lga'] is None,
        'no_reference_settlement_within_100km': all(row['distance_km'] > 100 for row in nearest.values()),
        'population_target_exact': district['district_id'] == 'D0451' and district['area_km2'] == 121139.862,
        'population_class_retained': district['class_name'] == '232,288 - 1,319,571',
        'not_a_single_district': len(intersections['states']) == 16 and len(intersections['lgas']) == 124,
        'population_geometry_retained_in_plan': population_evidence['geometry_sha256'] == blob_sha(district['geom']),
    }
    return {
        'status': 'ready_for_approved_hidden_artifact_resolution',
        'sources': {
            key: {'path': str(spec['path'].relative_to(ROOT)), 'table': spec['table'],
                  'sidecar_table': spec['side'], 'before_sha256': snapshots[key]['source_sha256'],
                  'before_feature_count': snapshots[key]['feature_count'],
                  'before_feature_digest': snapshots[key]['feature_digest']}
            for key, spec in SPECS.items()
        },
        'towns': town_evidence,
        'population': population_evidence,
        'descriptions_after': {'towns': TOWNS_DESCRIPTION, 'population': POPULATION_DESCRIPTION},
        'planned_counts': {'towns': 478, 'population': 504},
        'checks': checks,
    }


def write_ledger(verification):
    fields = ['case', 'layer', 'source_path', 'fid', 'identifier', 'disposition',
              'active_features_before', 'active_features_after', 'geometry_action',
              'attribute_action', 'sidecar_table', 'before_geometry_sha256',
              'after_geometry_sha256', 'reason']
    rows = []
    for case in ('towns', 'population'):
        evidence = verification[case]
        source = verification['sources'][case]
        rows.append({
            'case': case, 'layer': source['table'], 'source_path': source['path'],
            'fid': evidence['fid'], 'identifier': evidence['identifier'],
            'disposition': evidence['disposition'],
            'active_features_before': source['before_feature_count'],
            'active_features_after': verification['planned_counts'][case],
            'geometry_action': ('remove only FID 479 from active table; exact original GPKG blob quarantined'
                                if case == 'towns' else 'none; geometry byte-identical'),
            'attribute_action': ('original attributes quarantined; no other active attribute changed'
                                 if case == 'towns' else 'no active attribute changed; semantic sidecar added'),
            'sidecar_table': source['sidecar_table'],
            'before_geometry_sha256': evidence['geometry_sha256'],
            'after_geometry_sha256': ('quarantined:' + evidence['geometry_sha256'] if case == 'towns'
                                      else evidence['geometry_sha256']),
            'reason': evidence['reason'],
        })
    with LEDGER.open('w', encoding='utf8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def write_report(verification, applied):
    town = verification['towns']
    district = verification['population']
    lines = [
        '# Hidden-source artifact resolution', '',
        f'**Status:** {"applied and verified" if applied else "reviewed dry run; not applied"}.', '',
        '## 1. Scanned-map “Tow ns” label', '',
        f'- Active hidden point FID **{TOWNS_FID}**, coordinates **{town["longitude"]:.6f} E, '
        f'{town["latitude"]:.6f} N**, label distance **{town["label_dist_pt"]} pt**.',
        f'- Nearest OSM settlement: **{town["nearest_settlements"]["osm"]["nearest_name"]}**, '
        f'**{town["nearest_settlements"]["osm"]["distance_km"]:.3f} km** away. Nearest DIVA '
        f'settlement: **{town["nearest_settlements"]["diva"]["nearest_name"]}**, '
        f'**{town["nearest_settlements"]["diva"]["distance_km"]:.3f} km** away.',
        '- Resolution: remove only this generic legend-text row from the active hidden table '
        '(479 → 478 features). Do not rename or move it as a settlement.',
        f'- The complete original attributes and exact GeoPackage geometry blob are preserved in '
        f'`{TOWNS_SIDE}`. All other 478 rows remain byte-identical.', '',
        '## 2. Population region D0451', '',
        f'- FID **{POPULATION_FID}**, class **{district["before_attributes"]["class_name"]}**, '
        f'stated area **{district["before_attributes"]["area_km2"]:,.3f} km²**; current metric '
        f'geometry area **{district["current_metric_area_km2"]:,.3f} km²**.',
        f'- Intersects **{district["state_intersection_count"]} states** and '
        f'**{district["lga_intersection_count"]} LGAs** at ≥1 km² per intersection.',
        '- Resolution: classify D0451 as a connected population-class picture region—not an '
        'administrative district—and exclude it from district-level analysis. All 504 active '
        'features, attributes and geometry blobs remain unchanged.',
        f'- The semantic decision and intersection evidence are registered in `{POPULATION_SIDE}`.', '',
        '## Evidence and reproduction', '',
        '`hidden-source-artifact-ledger.csv`, `hidden-source-artifact-verification.json` and '
        '`hidden-source-artifact-result.json` record guarded before/after hashes and complete checks.', '',
        '```bash', 'python scripts/resolve_hidden_source_artifacts.py',
        '# Only after reviewing the verification:',
        'python scripts/resolve_hidden_source_artifacts.py --apply --approve-verified',
        'python scripts/audit_geospatial.py', 'python scripts/audit_geospatial_extended.py',
        'python scripts/build_site.py', '```',
    ]
    REPORT.write_text('\n'.join(lines) + '\n', encoding='utf8')


def write_dry_run():
    verification = build_verification()
    if not all(verification['checks'].values()):
        raise RuntimeError(f'hidden-artifact review gates failed: {verification["checks"]}')
    VERIFICATION.write_text(json.dumps(verification, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
    write_ledger(verification)
    write_report(verification, applied=False)
    print(f'Reviewed two hidden-source artifacts; wrote {VERIFICATION}. No source was modified.')


def insert_contents(con, table, description, changed_at):
    con.execute(
        "insert into gpkg_contents (table_name,data_type,identifier,description,last_change,"
        "min_x,min_y,max_x,max_y,srs_id) values (?,'attributes',?,?,?,null,null,null,null,null)",
        (table, table, description, changed_at))


def apply_towns(stage, verification, changed_at):
    evidence = verification['towns']
    attrs = evidence['before_attributes']
    with closing(connect(stage)) as con:
        con.execute(f'''create table {q(TOWNS_SIDE)} (
            id integer primary key, source_table text not null, original_fid integer not null,
            original_geom blob not null, longitude real not null, latitude real not null,
            name text, label_dist_pt real, state text, lga text, name_qa text, previous_lga text,
            exclusion_reason text not null, nearest_evidence_json text not null)''')
        target = target_record(con, TOWNS, TOWNS_FID)
        con.execute(f'insert into {q(TOWNS_SIDE)} values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', (
            1, TOWNS, TOWNS_FID, target['geom'], evidence['longitude'], evidence['latitude'],
            attrs['name'], attrs['label_dist_pt'], attrs['state'], attrs['lga'], attrs['name_qa'],
            attrs['previous_lga'], evidence['reason'], json.dumps(evidence['nearest_settlements'], sort_keys=True)))
        con.execute(f'delete from {q(TOWNS)} where fid=?', (TOWNS_FID,))
        con.execute('update gpkg_contents set description=?,last_change=? where table_name=?',
                    (TOWNS_DESCRIPTION, changed_at, TOWNS))
        insert_contents(con, TOWNS_SIDE, 'Quarantined scanned-map non-settlement artifacts; not spatial features.', changed_at)
        con.commit()


def apply_population(stage, verification, changed_at):
    evidence = verification['population']
    attrs = evidence['before_attributes']
    with closing(connect(stage)) as con:
        con.execute(f'''create table {q(POPULATION_SIDE)} (
            id integer primary key, source_table text not null, original_fid integer not null,
            district_id text not null, class_name text, stated_area_km2 real,
            current_metric_area_km2 real, geometry_sha256 text not null,
            classification text not null, analysis_use text not null, reason text not null,
            state_intersection_count integer not null, lga_intersection_count integer not null,
            intersection_evidence_json text not null)''')
        con.execute(f'insert into {q(POPULATION_SIDE)} values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', (
            1, POPULATION, POPULATION_FID, attrs['district_id'], attrs['class_name'], attrs['area_km2'],
            evidence['current_metric_area_km2'], evidence['geometry_sha256'],
            'connected_population_class_region_not_administrative_district',
            'exclude_from_district_level_analysis_retain_as_picture_region', evidence['reason'],
            evidence['state_intersection_count'], evidence['lga_intersection_count'],
            json.dumps(evidence['intersections'], sort_keys=True)))
        con.execute('update gpkg_contents set description=?,last_change=? where table_name=?',
                    (POPULATION_DESCRIPTION, changed_at, POPULATION))
        insert_contents(con, POPULATION_SIDE, 'Semantic exclusions for picture-derived population-class regions.', changed_at)
        con.commit()


def staged_case_verification(key, stage, verification):
    spec = SPECS[key]
    before = snapshot(spec)
    stage_spec = dict(spec, path=stage)
    # Population retains its target; towns has intentionally quarantined it.
    if key == 'population':
        after = snapshot(stage_spec)
    else:
        with closing(connect(stage, True)) as con:
            count = con.execute(f'select count(*) from {q(spec["table"])}').fetchone()[0]
            integrity = con.execute('pragma integrity_check').fetchone()[0]
            digest = feature_digest(con, spec['table'])
            target_absent = con.execute(f'select 1 from {q(spec["table"])} where fid=?',
                                        (spec['fid'],)).fetchone() is None
        after = {'feature_count': count, 'feature_digest': digest, 'integrity_check': integrity,
                 'target_absent': target_absent}
    with closing(connect(spec['path'], True)) as original, closing(connect(stage, True)) as current:
        original_columns, original_rows = rows_and_columns(original, spec['table'])
        current_columns, current_rows = rows_and_columns(current, spec['table'])
        if original_columns != current_columns:
            raise RuntimeError(f'{key}: active schema changed')
        if key == 'towns':
            expected_rows = [row for row in original_rows if row[original_columns.index('fid')] != TOWNS_FID]
            if current_rows != expected_rows:
                raise RuntimeError('towns: a row other than FID 479 changed')
            side = con_row = current.execute(
                f'select original_fid,original_geom,name,label_dist_pt,state,lga,name_qa,previous_lga '
                f'from {q(TOWNS_SIDE)} where id=1').fetchone()
            target = before['target']
            expected_side = (TOWNS_FID, target['geom'], target['name'], target['label_dist_pt'],
                             target['state'], target['lga'], target['name_qa'], target['previous_lga'])
            if side != expected_side:
                raise RuntimeError('towns: quarantined original record differs')
        else:
            if current_rows != original_rows:
                raise RuntimeError('population: an active feature or attribute changed')
        side_contents = current.execute(
            'select data_type from gpkg_contents where table_name=?', (spec['side'],)).fetchone()
        if not side_contents or side_contents[0] != 'attributes':
            raise RuntimeError(f'{key}: sidecar is not registered as attributes')
        if current.execute('select 1 from gpkg_geometry_columns where table_name=?',
                           (spec['side'],)).fetchone():
            raise RuntimeError(f'{key}: exclusion table must not be a spatial feature table')
    return {
        'before_feature_digest': before['feature_digest'], 'after_feature_digest': after['feature_digest'],
        'active_feature_count': after['feature_count'], 'integrity_check': after['integrity_check'],
        'sidecar_registered_as_attributes': True,
        'all_untargeted_active_rows_byte_identical': True,
        'target_absent_from_active_table': after.get('target_absent'),
    }


def finalize_installation():
    journal = json.loads(JOURNAL.read_text(encoding='utf8'))
    verification = json.loads(VERIFICATION.read_text(encoding='utf8'))
    current_checks = {}
    for key, spec in SPECS.items():
        source = verification['sources'][key]
        with closing(connect(spec['path'], True)) as con:
            count = con.execute(f'select count(*) from {q(spec["table"])}').fetchone()[0]
            digest = feature_digest(con, spec['table'])
            integrity = con.execute('pragma integrity_check').fetchone()[0]
            side_count = con.execute(f'select count(*) from {q(spec["side"])}').fetchone()[0]
            description = con.execute('select description from gpkg_contents where table_name=?',
                                      (spec['table'],)).fetchone()[0]
        current_checks[key] = {
            'source_hash': sha256(spec['path']) == journal['after_sha256'][key],
            'feature_digest': digest == journal['staged_verification'][key]['after_feature_digest'],
            'feature_count': count == verification['planned_counts'][key],
            'sidecar_count': side_count == 1,
            'description': description == verification['descriptions_after'][key],
            'integrity': integrity == 'ok',
        }
    checks = {f'{key}_{name}': value for key, case in current_checks.items() for name, value in case.items()}
    checks['town_target_removed'] = False
    with closing(connect(TOWNS_PATH, True)) as con:
        checks['town_target_removed'] = con.execute(
            f'select 1 from {q(TOWNS)} where fid=?', (TOWNS_FID,)).fetchone() is None
    if not all(checks.values()):
        raise RuntimeError(f'post-installation hidden-artifact checks failed: {checks}')
    result = {
        'status': 'resolved_and_verified', 'applied_at': datetime.now(timezone.utc).isoformat(),
        'verification_sha256': sha256(VERIFICATION), 'ledger_sha256': sha256(LEDGER),
        'sources': verification['sources'], 'after_sha256': journal['after_sha256'],
        'towns': verification['towns'], 'population': verification['population'],
        'descriptions_after': verification['descriptions_after'],
        'planned_counts': verification['planned_counts'],
        'staged_verification': journal['staged_verification'], 'checks': checks,
    }
    RESULT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
    write_report(verification, applied=True)
    JOURNAL.unlink()
    print(f'Resolved and verified both hidden-source artifacts: {RESULT}')


def apply_resolution(approve):
    if not approve:
        raise RuntimeError('hidden-artifact resolution requires --approve-verified')
    verification = json.loads(VERIFICATION.read_text(encoding='utf8'))
    if verification['status'] != 'ready_for_approved_hidden_artifact_resolution' or not all(verification['checks'].values()):
        raise RuntimeError('verification is not ready')
    recomputed = build_verification()
    if recomputed != verification:
        raise RuntimeError('sources or reference evidence changed after review')
    stages = {key: spec['path'].with_name(spec['path'].name + '.resolving.gpkg') for key, spec in SPECS.items()}
    if any(path.exists() for path in stages.values()):
        raise RuntimeError('stale hidden-artifact stage requires review')
    try:
        for key, spec in SPECS.items():
            shutil.copyfile(spec['path'], stages[key])
        changed_at = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
        apply_towns(stages['towns'], verification, changed_at)
        apply_population(stages['population'], verification, changed_at)
        staged = {key: staged_case_verification(key, stages[key], verification) for key in SPECS}
        journal = {
            'before_sha256': {key: verification['sources'][key]['before_sha256'] for key in SPECS},
            'after_sha256': {key: sha256(stages[key]) for key in SPECS},
            'staged_verification': staged,
        }
        JOURNAL.write_text(json.dumps(journal, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
        for key, spec in SPECS.items():
            os.replace(stages[key], spec['path'])
        finalize_installation()
    finally:
        for stage in stages.values():
            if stage.exists():
                stage.unlink()


def verify_existing_result():
    result = json.loads(RESULT.read_text(encoding='utf8'))
    if sha256(VERIFICATION) != result['verification_sha256'] or sha256(LEDGER) != result['ledger_sha256']:
        raise RuntimeError('hidden-artifact evidence hashes differ from result')
    checks = {}
    for key, spec in SPECS.items():
        with closing(connect(spec['path'], True)) as con:
            count = con.execute(f'select count(*) from {q(spec["table"])}').fetchone()[0]
            digest = feature_digest(con, spec['table'])
            side_count = con.execute(f'select count(*) from {q(spec["side"])}').fetchone()[0]
        checks[key] = (
            sha256(spec['path']) == result['after_sha256'][key] and
            count == result['planned_counts'][key] and
            digest == result['staged_verification'][key]['after_feature_digest'] and side_count == 1)
    if not all(checks.values()) or not all(result['checks'].values()):
        raise RuntimeError(f'existing hidden-artifact resolution failed verification: {checks}')
    print('Existing hidden-source artifact resolutions verified; nothing reapplied.')


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
        if not VERIFICATION.exists() or not LEDGER.exists():
            raise RuntimeError('run the read-only review first')
        apply_resolution(args.approve_verified)
    else:
        write_dry_run()


if __name__ == '__main__':
    main()
