#!/usr/bin/env python3
"""Verify and correct the reciprocal Gada/Illela administrative identities.

Default mode is read-only and writes a 601-row ledger plus verification gates:

    python scripts/correct_gada_illela.py

Apply only after reviewing those gates:

    python scripts/correct_gada_illela.py --apply --approve-verified

INEC's official Sokoto registration-area directory controls ward assignments.
A compact two-feature Esri/Michael Bauer Research/NBS 2023 extract independently
controls polygon identity direction. Its simplified geometry is evidence only;
no production geometry is replaced, translated, or simplified.

The correction changes two polygon labels, two centroid identity records, 22
ward-to-centroid distances, and only those derived LGA joins whose old attribute
exactly matched the old containing polygon. Official ward names, assignments,
and all geometry blobs remain unchanged. Darna/Sabon Gari is not forced into
Illela. Seven GeoPackages are staged and fully checked before any replacement;
the borehole RTree triggers and index are preserved exactly. Full original LGA
and centroid layers are retained as hidden provenance.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import shutil
import sqlite3
from collections import Counter
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

import shapely
from shapely.geometry import shape

from audit_geospatial import (
    DATA, ROOT, gpkg_geometry, layer_index, norm, q, shapely_metric,
)

OUT = ROOT / 'docs/geospatial-audit'
REFERENCE = OUT / 'references/sokoto-gada-illela-esri-mbr-2023.geojson'
LEDGER = OUT / 'gada-illela-correction-ledger.csv'
VERIFICATION = OUT / 'gada-illela-verification.json'
RESULT = OUT / 'gada-illela-correction-result.json'
JOURNAL = OUT / 'gada-illela-install-journal.json'
POLYGONS = 'admin_lgas_gadm_pg'
CENTROIDS = 'admin_lga_centroids_pt'
WARDS = 'admin_wards_pt'
DERIVED = {
    'groundwater_boreholes_wpdx_pt': 173,
    'settlements_gazetteer_diva_pt': 97,
    'settlements_places_osm_pt': 303,
    'settlements_towns_map2023_pt': 2,
}
TABLES = [POLYGONS, CENTROIDS, WARDS, *DERIVED]
NEW_NAME = {'Gada': 'Illela', 'Illela': 'Gada'}
TARGET_FIDS = {'Gada': 708, 'Illela': 712}
OFFICIAL = {
    'Gada': {
        'code': '04', 'polling_units': 239,
        'wards': ['Gada', 'Kaddi', 'Kadadin Buda (Kaddi)', 'Gilbadi', 'Tsitse',
                  'Kaffe', 'Dukamaje/Ilah', 'Kyadawa/Holai', 'Kiri', 'Kadassaka', 'Kwarma'],
    },
    'Illela': {
        'code': '08', 'polling_units': 210,
        'wards': ['Illela', 'Kalmalo', 'Damba', 'Darna/ Sabon Gari', 'Darne/ Tsolawo',
                  'G/ Hamma', 'Araba', 'Garu', 'R. Gati', 'Tozai', 'G/ Katta'],
    },
}
FIELDS = [
    'layer', 'fid', 'change_type', 'previous_lga', 'new_lga',
    'before_attributes_json', 'after_attributes_json',
    'before_geometry_sha256', 'after_geometry_sha256',
    'containing_lga_before', 'containing_lga_after', 'source_sha256', 'reason',
]


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def blob_sha(blob):
    return hashlib.sha256(blob).hexdigest()


def canonical(rows):
    return json.dumps(rows, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def connect(path, readonly=False):
    if readonly:
        return sqlite3.connect(f'file:{Path(path)}?mode=ro', uri=True)
    return sqlite3.connect(path)


def schema(con, table):
    columns = [r[1] for r in con.execute(f'pragma table_info({q(table)})')]
    grow = con.execute(
        'select column_name from gpkg_geometry_columns where table_name=?', (table,)).fetchone()
    if grow is None:
        raise RuntimeError(f'{table}: missing geometry registration')
    return columns, grow[0]


def selected_rows(path, table, where='', parameters=()):
    with closing(connect(path, True)) as con:
        columns, gcol = schema(con, table)
        sql = f'select * from {q(table)}'
        if where:
            sql += ' where ' + where
        sql += ' order by fid'
        output = []
        for values in con.execute(sql, parameters):
            row = dict(zip(columns, values))
            row['_geometry'] = gpkg_geometry(row[gcol])
            row['_geometry_column'] = gcol
            output.append(row)
        return output


def source_path(table):
    return layer_index()[table]['path']


def hidden_path(table):
    return source_path(table).with_name(f'hidden_{hidden_table(table)}.gpkg')


def hidden_table(table):
    return table.replace('_gadm_pg', '_gadm_identity_original_pg').replace('_centroids_pt', '_centroids_identity_original_pt')


def geometry_hash(row):
    return blob_sha(row[row['_geometry_column']])


def containing_rows(point, polygons, tree):
    indices = tree.query(point, predicate='intersects')
    return [polygons[int(i)] for i in indices]


def iou(a, b):
    am, bm = shapely_metric(a), shapely_metric(b)
    union = am.union(bm).area
    return am.intersection(bm).area / union if union else 0.0


def ledger_row(table, row, change_type, before, after, source_hash,
               containing_before='', containing_after='', reason=''):
    old_lga = row.get('lga', '')
    new_lga = after.get('lga', old_lga)
    return {
        'layer': table, 'fid': int(row['fid']), 'change_type': change_type,
        'previous_lga': old_lga, 'new_lga': new_lga,
        'before_attributes_json': canonical(before),
        'after_attributes_json': canonical(after),
        'before_geometry_sha256': geometry_hash(row),
        'after_geometry_sha256': geometry_hash(row),
        'containing_lga_before': containing_before,
        'containing_lga_after': containing_after,
        'source_sha256': source_hash, 'reason': reason,
    }


def build_plan():
    source_hashes = {table: sha256(source_path(table)) for table in TABLES}
    polygons = selected_rows(source_path(POLYGONS), POLYGONS)
    target = {row['lga']: row for row in polygons
              if row['state'] == 'Sokoto' and row['lga'] in TARGET_FIDS}
    if {name: row['fid'] for name, row in target.items()} != TARGET_FIDS:
        raise RuntimeError('unexpected Gada/Illela polygon FIDs or labels')
    tree = shapely.STRtree([row['_geometry'] for row in polygons])
    ledger = []

    # Polygon labels only: IDs, areas, state and geometry stay fixed.
    for old_name in ('Gada', 'Illela'):
        row = target[old_name]
        ledger.append(ledger_row(
            POLYGONS, row, 'polygon_identity', {'lga': old_name}, {'lga': NEW_NAME[old_name]},
            source_hashes[POLYGONS], old_name, NEW_NAME[old_name],
            'Reciprocal independent boundary identity and official ward-list control'))

    # Transfer identity-specific centroid attributes between the two fixed points.
    centroid_rows = selected_rows(
        source_path(CENTROIDS), CENTROIDS,
        "state='Sokoto' and lga in ('Gada','Illela')")
    centroids = {row['lga']: row for row in centroid_rows}
    if {name: row['fid'] for name, row in centroids.items()} != TARGET_FIDS:
        raise RuntimeError('unexpected centroid FIDs or labels')
    identity_fields = ('lga', 'wikidata_id', 'representative_district', 'position_qa')
    for old_name in ('Gada', 'Illela'):
        row = centroids[old_name]
        other = centroids[NEW_NAME[old_name]]
        before = {field: row[field] for field in identity_fields}
        after = {field: other[field] for field in identity_fields}
        ledger.append(ledger_row(
            CENTROIDS, row, 'centroid_identity_attributes', before, after,
            source_hashes[CENTROIDS], old_name, NEW_NAME[old_name],
            'Fixed centroid geometry; transfer the corrected name-specific identity attributes'))

    # Official ward assignments stay fixed; only their distance to the corrected
    # same-name centroid changes.
    ward_rows = selected_rows(
        source_path(WARDS), WARDS, "state='Sokoto' and lga in ('Gada','Illela')")
    if len(ward_rows) != 22:
        raise RuntimeError(f'expected 22 target wards, found {len(ward_rows)}')
    for name, control in OFFICIAL.items():
        local = [r['ward'] for r in ward_rows if r['lga'] == name]
        if sorted(map(norm, local)) != sorted(map(norm, control['wards'])):
            raise RuntimeError(f'{name}: local ward list differs from INEC')
    corrected_polygons = {NEW_NAME[name]: row['_geometry'] for name, row in target.items()}
    corrected_centroids = {NEW_NAME[name]: row['_geometry'] for name, row in centroids.items()}
    post_distances = {}
    reciprocal_before = 0
    post_containment = Counter()
    for row in ward_rows:
        old_name = row['lga']
        point = row['_geometry']
        old_containers = containing_rows(point, polygons, tree)
        if any(p['lga'] == NEW_NAME[old_name] for p in old_containers):
            reciprocal_before += 1
        if corrected_polygons[old_name].intersects(point):
            post_containment[old_name] += 1
        distance = shapely_metric(point).distance(shapely_metric(corrected_centroids[old_name])) / 1000
        new_distance = round(distance, 1)
        post_distances[str(row['fid'])] = new_distance
        ledger.append(ledger_row(
            WARDS, row, 'ward_distance_to_corrected_centroid',
            {'dist_to_lga_centroid_km': row['dist_to_lga_centroid_km']},
            {'dist_to_lga_centroid_km': new_distance},
            source_hashes[WARDS], old_name, old_name,
            'Official ward assignment and coordinates retained; recompute distance only'))

    darna = next(r for r in ward_rows if norm(r['ward']) == norm('Darna/ Sabon Gari'))
    darna_distance = shapely_metric(darna['_geometry']).distance(
        shapely_metric(corrected_polygons['Illela'])) / 1000
    darna_container = next((p['lga'] for p in containing_rows(darna['_geometry'], polygons, tree)
                            if p['state'] == 'Sokoto'), None)

    # Derived joins change only when the old LGA attribute exactly matched the
    # old containing target polygon. This intentionally leaves Kiri unchanged.
    derived_counts = {}
    unchanged_candidates = {}
    for table, expected_count in DERIVED.items():
        candidates = selected_rows(source_path(table), table, "lga in ('Gada','Illela')")
        changed = 0
        unchanged = []
        for row in candidates:
            old_name = row['lga']
            containers = containing_rows(row['_geometry'], polygons, tree)
            exact_old = [p for p in containers if p['fid'] == TARGET_FIDS[old_name]
                         and p['lga'] == old_name and p['state'] == row.get('state')]
            if not exact_old:
                unchanged.append(row)
                continue
            new_name = NEW_NAME[old_name]
            ledger.append(ledger_row(
                table, row, 'derived_lga_join',
                {'lga': old_name, 'previous_lga': None},
                {'lga': new_name, 'previous_lga': old_name},
                source_hashes[table], old_name, new_name,
                'Old attribute exactly matched the old containing polygon; recompute join after identity correction'))
            changed += 1
        derived_counts[table] = changed
        unchanged_candidates[table] = [int(r['fid']) for r in unchanged]
        if changed != expected_count:
            raise RuntimeError(f'{table}: expected {expected_count} derived corrections, found {changed}')

    kiri = selected_rows(source_path('settlements_places_osm_pt'), 'settlements_places_osm_pt',
                         'fid=14680')
    if len(kiri) != 1 or kiri[0]['lga'] != 'Illela' or 14680 not in unchanged_candidates['settlements_places_osm_pt']:
        raise RuntimeError('OSM Kiri FID 14680 no longer meets the unchanged mismatch-control rule')

    # Independent two-feature boundary direction and same-name town controls.
    reference = json.loads(REFERENCE.read_text(encoding='utf8'))
    if len(reference['features']) != 2:
        raise RuntimeError('reference must contain exactly two features')
    reference_rows = {f['properties']['NAME']: f for f in reference['features']}
    if set(reference_rows) != {'Gada', 'Illela'}:
        raise RuntimeError('reference names are incomplete')
    expected_ids = {'Illela': (709, '3405'), 'Gada': (713, '3409')}
    for name, (objectid, id_string) in expected_ids.items():
        props = reference_rows[name]['properties']
        if props['OBJECTID'] != objectid or props['ID'] != id_string:
            raise RuntimeError(f'{name}: reference identity fields changed')
    reference_geometries = {name: shape(f['geometry']) for name, f in reference_rows.items()}
    comparisons = []
    for old_name in ('Gada', 'Illela'):
        for ref_name in ('Gada', 'Illela'):
            comparisons.append({
                'current_label': old_name, 'reference_label': ref_name,
                'iou': iou(target[old_name]['_geometry'], reference_geometries[ref_name]),
            })
    reciprocal = [next(r['iou'] for r in comparisons
                       if r['current_label'] == name and r['reference_label'] == NEW_NAME[name])
                  for name in ('Gada', 'Illela')]
    same_name = [next(r['iou'] for r in comparisons
                      if r['current_label'] == name and r['reference_label'] == name)
                 for name in ('Gada', 'Illela')]
    towns = selected_rows(source_path('settlements_places_osm_pt'), 'settlements_places_osm_pt',
                          "state='Sokoto' and name in ('Gada','Illela')")
    town_controls = []
    for row in towns:
        if row['name'] not in ('Gada', 'Illela'):
            continue
        containers = containing_rows(row['_geometry'], polygons, tree)
        old_container = next((p['lga'] for p in containers if p['fid'] in TARGET_FIDS.values()), None)
        if old_container:
            town_controls.append({
                'fid': row['fid'], 'name': row['name'], 'place': row.get('place'),
                'containing_lga_before': old_container,
                'containing_lga_after': NEW_NAME.get(old_container, old_container),
            })
    town_reciprocal = [r for r in town_controls if r['containing_lga_before'] == NEW_NAME[r['name']]]

    if len(ledger) != 601:
        raise RuntimeError(f'expected 601 ledger rows, found {len(ledger)}')
    ledger.sort(key=lambda r: (r['layer'], r['fid'], r['change_type']))
    post_exception_count = 61 - reciprocal_before
    checks = {
        'official_inec_ward_lists_exact': True,
        'reference_two_feature_ids_and_direction': min(reciprocal) > 0.70 and max(same_name) < 0.10,
        'reciprocal_reference_at_least_ten_times_same_name': all(
            r >= 10 * s for r, s in zip(reciprocal, same_name)),
        'reciprocal_ward_exceptions_before_21': reciprocal_before == 21,
        'post_gada_containment_11_of_11': post_containment['Gada'] == 11,
        'post_illela_containment_10_of_11': post_containment['Illela'] == 10,
        'darna_remains_separate_gwadabawa_exception': (
            darna_container == 'Gwadabawa' and 0 < darna_distance < 0.5 and
            not corrected_polygons['Illela'].intersects(darna['_geometry'])),
        'national_post_exceptions_40': post_exception_count == 40,
        'derived_counts_exact': derived_counts == DERIVED,
        'ledger_601_rows': len(ledger) == 601,
        'all_ledger_geometry_hashes_unchanged': all(
            r['before_geometry_sha256'] == r['after_geometry_sha256'] for r in ledger),
        'ward_distances_recomputed_and_improved': all(
            float(json.loads(r['after_attributes_json'])['dist_to_lga_centroid_km']) <
            float(json.loads(r['before_attributes_json'])['dist_to_lga_centroid_km'])
            for r in ledger if r['layer'] == WARDS),
        'kiri_14680_remains_illela': True,
        'same_name_towns_corroborate_reciprocal_direction': len(town_reciprocal) >= 2,
    }
    verification = {
        'created_at': datetime.now(timezone.utc).isoformat(),
        'status': 'ready_for_approved_apply' if all(checks.values()) else 'failed',
        'official_control': {
            'url': 'https://inecnigeria.org/documents/resources/rac/SOKOTO.pdf',
            'title': 'SOKOTO LGA SUMMARY — list of registration areas',
            'gada': OFFICIAL['Gada'], 'illela': OFFICIAL['Illela'],
            'limitation': 'Authoritative for ward-to-LGA assignments, not a legal polygon survey.',
        },
        'boundary_reference': {
            'url': ('https://services8.arcgis.com/oTalEaSXAuyNT7xf/arcgis/rest/services/'
                    'Nigeria_Local_Government_Area_Boundaries/FeatureServer/0'),
            'item_id': '686ce086434740b3b5c517b732999c47',
            'credits': 'Esri, Michael Bauer Research GmbH 2023, National Bureau of Statistics',
            'query': "NAME IN ('Gada','Illela'); outSR=4326; maxAllowableOffset=0.002; geometryPrecision=6",
            'local_file': str(REFERENCE.relative_to(ROOT)), 'local_sha256': sha256(REFERENCE),
            'limitation': 'Simplified identity evidence only; never used as production replacement geometry.',
        },
        'reference_comparisons': comparisons,
        'reciprocal_ious': reciprocal, 'same_name_ious': same_name,
        'town_controls': town_controls,
        'before_reciprocal_ward_exceptions': reciprocal_before,
        'post_containment': dict(post_containment),
        'post_national_ward_exceptions': post_exception_count,
        'post_ward_distances_km': post_distances,
        'post_ward_distance_range_km': [min(post_distances.values()), max(post_distances.values())],
        'darna_sabon_gari': {
            'assigned_lga_unchanged': darna['lga'], 'containing_lga': darna_container,
            'distance_to_corrected_illela_km': darna_distance,
            'geometry_unchanged': True,
        },
        'derived_correction_counts': derived_counts,
        'unchanged_candidate_fids': unchanged_candidates,
        'ledger_counts': {
            'polygon_identities': 2, 'centroid_identities': 2,
            'ward_distances': 22, 'derived_joins': sum(derived_counts.values()),
            'total': len(ledger),
        },
        'source_sha256': source_hashes, 'checks': checks,
    }
    if not all(checks.values()):
        raise RuntimeError(f'verification gates failed: {[k for k, v in checks.items() if not v]}')
    return ledger, verification


def write_dry_run():
    ledger, verification = build_plan()
    OUT.mkdir(parents=True, exist_ok=True)
    with LEDGER.open('w', encoding='utf8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(ledger)
    verification['ledger_sha256'] = sha256(LEDGER)
    VERIFICATION.write_text(json.dumps(verification, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
    for current, before in (
            (OUT / 'ward-lga-exceptions.csv', OUT / 'ward-lga-exceptions-before.csv'),
            (OUT / 'sokoto-gada-illela.png', OUT / 'sokoto-gada-illela-before.png')):
        if not before.exists():
            shutil.copyfile(current, before)
    print(f'Wrote {LEDGER} and {VERIFICATION}; no GeoPackage was modified.')


def load_ledger():
    with LEDGER.open(encoding='utf8', newline='') as handle:
        rows = list(csv.DictReader(handle))
    for row in rows:
        row['fid'] = int(row['fid'])
    return rows


def triggers(con, table):
    return con.execute(
        "select name,sql from sqlite_master where type='trigger' and tbl_name=? order by name",
        (table,)).fetchall()


def rtree_snapshot(con):
    output = {}
    names = [r[0] for r in con.execute(
        "select name from sqlite_master where type='table' and name like 'rtree_%' order by name")]
    for name in names:
        digest = hashlib.sha256()
        count = 0
        for row in con.execute(f'select * from {q(name)} order by 1'):
            digest.update(repr(row).encode('utf8'))
            count += 1
        output[name] = {'count': count, 'sha256': digest.hexdigest()}
    return output


def rename_provenance(path, old_table, new_table):
    with closing(connect(path)) as con:
        con.execute('pragma foreign_keys=off')
        con.execute(f'alter table {q(old_table)} rename to {q(new_table)}')
        con.execute('update gpkg_contents set table_name=?,identifier=?,description=? where table_name=?',
                    (new_table, new_table,
                     'Hidden pre-Gada/Illela-identity-correction original; not current administration', old_table))
        con.execute('update gpkg_geometry_columns set table_name=? where table_name=?', (new_table, old_table))
        if con.execute("select count(*) from sqlite_master where type='table' and name='gpkg_extensions'").fetchone()[0]:
            con.execute('update gpkg_extensions set table_name=? where table_name=?', (new_table, old_table))
        if con.execute('pragma integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError(f'{path}: provenance integrity failure')
        con.commit()


def verify_exact_provenance(backup, source, table):
    with closing(connect(backup, True)) as copied, closing(connect(source, True)) as original:
        copied_columns, _ = schema(copied, hidden_table(table))
        original_columns, _ = schema(original, table)
        if copied_columns != original_columns:
            raise RuntimeError(f'{table}: provenance schema differs')
        copied_rows = copied.execute(f'select * from {q(hidden_table(table))} order by fid').fetchall()
        original_rows = original.execute(f'select * from {q(table)} order by fid').fetchall()
        if copied_rows != original_rows:
            raise RuntimeError(f'{table}: provenance rows differ from original')
        if copied.execute('pragma integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError(f'{table}: provenance integrity failure')


def verify_staged(stage, source, table, ledger_rows, provenance=False):
    """Compare every feature, attribute and geometry against the original."""
    expected = {int(r['fid']): r for r in ledger_rows}
    with closing(connect(stage, True)) as current, closing(connect(source, True)) as original:
        current_columns, current_gcol = schema(current, table)
        original_table = hidden_table(table) if provenance else table
        original_columns, original_gcol = schema(original, original_table)
        allowed_new = {'previous_lga'} if table in DERIVED and not provenance else set()
        if set(current_columns) != set(original_columns) | allowed_new:
            raise RuntimeError(f'{table}: unexpected schema change')
        if current_gcol != original_gcol:
            raise RuntimeError(f'{table}: geometry column changed')
        current_rows = current.execute(f'select * from {q(table)} order by fid').fetchall()
        original_rows = original.execute(f'select * from {q(original_table)} order by fid').fetchall()
        if len(current_rows) != len(original_rows):
            raise RuntimeError(f'{table}: feature count changed')
        current_index = {name: i for i, name in enumerate(current_columns)}
        original_index = {name: i for i, name in enumerate(original_columns)}
        changed = 0
        for current_values, original_values in zip(current_rows, original_rows):
            fid = current_values[current_index['fid']]
            if fid != original_values[original_index['fid']]:
                raise RuntimeError(f'{table}: FIDs changed')
            if current_values[current_index[current_gcol]] != original_values[original_index[original_gcol]]:
                raise RuntimeError(f'{table} FID {fid}: geometry changed')
            row = expected.get(fid)
            after = json.loads(row['after_attributes_json']) if row else {}
            for column in original_columns:
                if column in (current_gcol, 'fid'):
                    continue
                expected_value = after.get(column, original_values[original_index[column]])
                actual = current_values[current_index[column]]
                if actual != expected_value:
                    raise RuntimeError(f'{table} FID {fid}: unexpected {column} value {actual!r} != {expected_value!r}')
            if table in DERIVED and not provenance:
                previous = current_values[current_index['previous_lga']]
                expected_previous = after.get('previous_lga') if row else None
                if previous != expected_previous:
                    raise RuntimeError(f'{table} FID {fid}: previous_lga provenance mismatch')
            if row:
                before_blob = original_values[original_index[original_gcol]]
                after_blob = current_values[current_index[current_gcol]]
                if blob_sha(before_blob) != row['before_geometry_sha256'] or blob_sha(after_blob) != row['after_geometry_sha256']:
                    raise RuntimeError(f'{table} FID {fid}: geometry ledger hash mismatch')
                changed += 1
        if changed != len(expected):
            raise RuntimeError(f'{table}: ledger FID set mismatch')
        if current.execute('pragma integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError(f'{table}: integrity failure')
        return {'feature_count': len(current_rows), 'changed_features': changed,
                'all_geometry_byte_identical': True, 'all_other_attributes_verified': True,
                'integrity_check': 'ok'}


def apply_correction(approve):
    if not approve:
        raise RuntimeError('verified correction requires --approve-verified')
    verification = json.loads(VERIFICATION.read_text(encoding='utf8'))
    if verification['status'] != 'ready_for_approved_apply' or not all(verification['checks'].values()):
        raise RuntimeError('verification is not approved')
    if sha256(LEDGER) != verification['ledger_sha256']:
        raise RuntimeError('ledger changed after verification')
    recomputed, _ = build_plan()
    ledger = load_ledger()
    if canonical(recomputed) != canonical(ledger):
        raise RuntimeError('source no longer reproduces the reviewed ledger')
    by_layer = {}
    for row in ledger:
        by_layer.setdefault(row['layer'], []).append(row)
    staged = {}
    try:
        for table in TABLES:
            source = source_path(table)
            if sha256(source) != verification['source_sha256'][table]:
                raise RuntimeError(f'{table}: source hash changed')
            stage = source.with_name(source.name + '.correcting.gpkg')
            if stage.exists():
                raise RuntimeError(f'{table}: stale stage requires review')
            shutil.copyfile(source, stage)
            staged[table] = {'source': source, 'stage': stage, 'after_sha256': None}
            with closing(connect(stage)) as con:
                columns, gcol = schema(con, table)
                before_triggers = triggers(con, table)
                before_rtree = rtree_snapshot(con)
                before_feature_count = None
                if con.execute("select count(*) from sqlite_master where type='table' and name='gpkg_ogr_contents'").fetchone()[0]:
                    before_feature_count = con.execute('select * from gpkg_ogr_contents order by table_name').fetchall()
                for name, _ in before_triggers:
                    con.execute(f'drop trigger {q(name)}')
                if table in DERIVED:
                    if 'previous_lga' in columns:
                        raise RuntimeError(f'{table}: previous_lga already exists')
                    con.execute(f'alter table {q(table)} add column previous_lga text')
                for row in by_layer.get(table, []):
                    before = json.loads(row['before_attributes_json'])
                    after = json.loads(row['after_attributes_json'])
                    fid = int(row['fid'])
                    for column, expected in before.items():
                        if column == 'previous_lga':
                            continue
                        actual = con.execute(
                            f'select {q(column)} from {q(table)} where fid=?', (fid,)).fetchone()[0]
                        if actual != expected:
                            raise RuntimeError(f'{table} FID {fid}: guarded {column} mismatch')
                    assignments = ','.join(f'{q(column)}=?' for column in after)
                    con.execute(f'update {q(table)} set {assignments} where fid=?',
                                (*after.values(), fid))
                for name, sql in before_triggers:
                    con.execute(sql)
                if triggers(con, table) != before_triggers:
                    raise RuntimeError(f'{table}: trigger definitions changed')
                if rtree_snapshot(con) != before_rtree:
                    raise RuntimeError(f'{table}: RTree index changed')
                if before_feature_count is not None and con.execute(
                        'select * from gpkg_ogr_contents order by table_name').fetchall() != before_feature_count:
                    raise RuntimeError(f'{table}: feature-count metadata changed')
                con.commit()
            verify_staged(stage, source, table, by_layer.get(table, []))
            staged[table]['after_sha256'] = sha256(stage)
            print(f'{table}: staged {len(by_layer.get(table, []))} changes with geometry/index checks', flush=True)

        provenance = {}
        for table in (POLYGONS, CENTROIDS):
            source = source_path(table)
            hidden = hidden_path(table)
            backup = hidden.with_name(hidden.name + '.creating.gpkg')
            if hidden.exists() or backup.exists():
                raise RuntimeError(f'{table}: identity provenance already exists or is stale')
            shutil.copyfile(source, backup)
            rename_provenance(backup, table, hidden_table(table))
            verify_exact_provenance(backup, source, table)
            provenance[table] = {
                'path': str(hidden.relative_to(ROOT)), 'table': hidden_table(table),
                'sha256': sha256(backup), 'backup': backup, 'hidden': hidden,
            }
        journal = {
            'created_at': datetime.now(timezone.utc).isoformat(),
            'verification_sha256': sha256(VERIFICATION), 'ledger_sha256': sha256(LEDGER),
            'before_sha256': verification['source_sha256'],
            'after_sha256': {table: paths['after_sha256'] for table, paths in staged.items()},
            'provenance': {table: {k: v for k, v in p.items() if k not in ('backup', 'hidden')}
                           for table, p in provenance.items()},
        }
        JOURNAL.write_text(json.dumps(journal, indent=2) + '\n', encoding='utf8')
        for table in TABLES:
            os.replace(staged[table]['stage'], staged[table]['source'])
        for table in (POLYGONS, CENTROIDS):
            os.replace(provenance[table]['backup'], provenance[table]['hidden'])
        finalize_installation()
        print(f'Applied and verified 601 attribute-only corrections; result: {RESULT}')
    finally:
        for paths in staged.values():
            if paths['stage'].exists():
                paths['stage'].unlink()
        for table in (POLYGONS, CENTROIDS):
            hidden = hidden_path(table)
            backup = hidden.with_name(hidden.name + '.creating.gpkg')
            if backup.exists():
                backup.unlink()


def post_evidence():
    polygons = selected_rows(source_path(POLYGONS), POLYGONS)
    target = {row['lga']: row for row in polygons
              if row['state'] == 'Sokoto' and row['lga'] in TARGET_FIDS}
    if {name: row['fid'] for name, row in target.items()} != {'Illela': 708, 'Gada': 712}:
        raise RuntimeError('post-correction polygon identities are wrong')
    tree = shapely.STRtree([row['_geometry'] for row in polygons])
    centroids = {row['lga']: row for row in selected_rows(
        source_path(CENTROIDS), CENTROIDS, "state='Sokoto' and lga in ('Gada','Illela')")}
    expected_attributes = {
        'Gada': (712, 'Q5516271', 'Goronyo/Gada'),
        'Illela': (708, 'Q5999073', 'Gwadabawa/Ilella'),
    }
    for name, (fid, wikidata, district) in expected_attributes.items():
        row = centroids[name]
        if (row['fid'], row['wikidata_id'], row['representative_district']) != (fid, wikidata, district):
            raise RuntimeError(f'{name}: centroid attributes are wrong')
        if not target[name]['_geometry'].intersects(row['_geometry']):
            raise RuntimeError(f'{name}: centroid is outside its corrected polygon')
    wards = selected_rows(source_path(WARDS), WARDS, "state='Sokoto' and lga in ('Gada','Illela')")
    containment = Counter()
    distances = {}
    for row in wards:
        name = row['lga']
        if target[name]['_geometry'].intersects(row['_geometry']):
            containment[name] += 1
        actual = shapely_metric(row['_geometry']).distance(shapely_metric(centroids[name]['_geometry'])) / 1000
        if round(actual, 1) != row['dist_to_lga_centroid_km']:
            raise RuntimeError(f'ward FID {row["fid"]}: distance is stale')
        distances[str(row['fid'])] = row['dist_to_lga_centroid_km']
    darna = next(r for r in wards if norm(r['ward']) == norm('Darna/ Sabon Gari'))
    darna_distance = shapely_metric(darna['_geometry']).distance(
        shapely_metric(target['Illela']['_geometry'])) / 1000
    darna_container = next((p['lga'] for p in containing_rows(darna['_geometry'], polygons, tree)
                            if p['state'] == 'Sokoto'), None)
    if containment != Counter({'Gada': 11, 'Illela': 10}):
        raise RuntimeError(f'post ward containment mismatch: {containment}')
    if darna_container != 'Gwadabawa' or not 0 < darna_distance < 0.5:
        raise RuntimeError('Darna residual exception changed unexpectedly')
    ledger = load_ledger()
    for row in ledger:
        table = row['layer']
        current = selected_rows(source_path(table), table, 'fid=?', (int(row['fid']),))[0]
        after = json.loads(row['after_attributes_json'])
        for column, expected in after.items():
            if current[column] != expected:
                raise RuntimeError(f'{table} FID {row["fid"]}: post {column} mismatch')
        if geometry_hash(current) != row['after_geometry_sha256']:
            raise RuntimeError(f'{table} FID {row["fid"]}: post geometry changed')
        if table in DERIVED and not target[current['lga']]['_geometry'].intersects(current['_geometry']):
            raise RuntimeError(f'{table} FID {row["fid"]}: corrected join is not contained')
    kiri = selected_rows(source_path('settlements_places_osm_pt'), 'settlements_places_osm_pt', 'fid=14680')[0]
    if kiri['lga'] != 'Illela' or kiri['previous_lga'] is not None:
        raise RuntimeError('Kiri unchanged-control failed')
    return {
        'polygon_identities': {'708': 'Illela', '712': 'Gada'},
        'ward_containment': dict(containment), 'ward_distances_km': distances,
        'ward_distance_range_km': [min(distances.values()), max(distances.values())],
        'national_ward_exceptions': 40,
        'reciprocal_gada_illela_exceptions': 0,
        'darna_sabon_gari': {
            'assigned_lga': darna['lga'], 'containing_lga': darna_container,
            'distance_to_corrected_illela_km': darna_distance,
        },
        'visible_derived_joins': DERIVED['groundwater_boreholes_wpdx_pt'] + DERIVED['settlements_places_osm_pt'],
        'all_601_ledger_rows_rechecked': True,
        'all_ledger_geometry_hashes_unchanged': True,
        'kiri_14680_unchanged_illela': True,
    }


def finalize_installation():
    journal = json.loads(JOURNAL.read_text(encoding='utf8'))
    for table, expected in journal['after_sha256'].items():
        if sha256(source_path(table)) != expected:
            raise RuntimeError(f'{table}: installed hash differs from staged journal')
        with closing(connect(source_path(table), True)) as con:
            if con.execute('pragma integrity_check').fetchone()[0] != 'ok':
                raise RuntimeError(f'{table}: installed integrity failure')
    for table, saved in journal['provenance'].items():
        hidden = ROOT / saved['path']
        if sha256(hidden) != saved['sha256']:
            raise RuntimeError(f'{table}: provenance hash mismatch')
        verify_staged(source_path(table), hidden, table,
                      [r for r in load_ledger() if r['layer'] == table], provenance=True)
    evidence = post_evidence()
    verification = json.loads(VERIFICATION.read_text(encoding='utf8'))
    result = {
        'applied_at': datetime.now(timezone.utc).isoformat(),
        'before_sha256': journal['before_sha256'], 'after_sha256': journal['after_sha256'],
        'provenance': journal['provenance'],
        'ledger_sha256': journal['ledger_sha256'], 'verification_sha256': journal['verification_sha256'],
        'counts': verification['ledger_counts'], 'post_correction': evidence,
        'checks': {
            'seven_source_hashes_verified': len(journal['after_sha256']) == 7,
            'two_hidden_originals_verified': len(journal['provenance']) == 2,
            'all_601_ledger_rows_rechecked': evidence['all_601_ledger_rows_rechecked'],
            'zero_geometry_changes': evidence['all_ledger_geometry_hashes_unchanged'],
            'official_wards_and_distances_verified': len(evidence['ward_distances_km']) == 22,
            'gada_11_and_illela_10_containment': evidence['ward_containment'] == {'Gada': 11, 'Illela': 10},
            'darna_residual_retained': evidence['darna_sabon_gari']['containing_lga'] == 'Gwadabawa',
            'visible_derived_joins_476': evidence['visible_derived_joins'] == 476,
            'kiri_unchanged': evidence['kiri_14680_unchanged_illela'],
        },
    }
    if not all(result['checks'].values()):
        raise RuntimeError('post-installation checks failed')
    RESULT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
    JOURNAL.unlink()


def verify_existing_result():
    result = json.loads(RESULT.read_text(encoding='utf8'))
    residual_path = OUT / 'ward-lga-correction-result.json'
    residual = (json.loads(residual_path.read_text(encoding='utf8'))
                if residual_path.exists() else None)
    for table, expected in result['after_sha256'].items():
        current_hash = sha256(source_path(table))
        if current_hash == expected:
            continue
        # A later, separately verified residual review may change only the ward
        # attributes. Preserve this historical result and verify the hash chain
        # rather than reapplying or rewriting the completed Gada/Illela work.
        superseded_wards = bool(
            table == WARDS and residual and
            residual.get('status') == 'applied_and_verified' and
            residual.get('before_sha256') == expected and
            residual.get('after_sha256') == current_hash and
            all(residual.get('checks', {}).values()))
        if not superseded_wards:
            raise RuntimeError(f'{table}: current hash differs from correction result')
    for table, saved in result['provenance'].items():
        if sha256(ROOT / saved['path']) != saved['sha256']:
            raise RuntimeError(f'{table}: provenance hash differs from result')
    evidence = post_evidence()
    if evidence != result['post_correction']:
        raise RuntimeError('current post-correction evidence differs from result')
    print('Existing Gada/Illela correction verified; nothing reapplied.')


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
        print('Recovered and verified the installed correction; nothing reapplied.')
        return
    if args.apply:
        if not LEDGER.exists() or not VERIFICATION.exists():
            raise RuntimeError('run the read-only dry run first')
        apply_correction(args.approve_verified)
    else:
        write_dry_run()


if __name__ == '__main__':
    main()
