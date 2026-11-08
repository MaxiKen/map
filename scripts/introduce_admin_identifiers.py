#!/usr/bin/env python3
"""Introduce persistent administrative IDs without changing names or geometry.

Canonical ``ngmap-admin-v1`` IDs are repository-issued, not statutory codes:
states use ``ngmap:state:NG-AB``; LGAs ``ngmap:lga:0001``; wards
``ngmap:ward:000001``. IDs are assigned once and never renumbered to fill gaps.
The initial LGA/ward sequences use current source IDs only as assignment evidence.
The two non-administrative Water body / Lake Chad rows retain null admin IDs.

A separate, optional INEC crosswalk preserves internal database IDs and local
LGA/ward codes. All 37 states and 774 real LGAs are crosswalked. Ward links are
installed only for one-to-one exact or conservative numeral-normalized matches;
ambiguous/unmatched rows retain null INEC fields. INEC electoral codes are not
represented as legal boundary identifiers.

The pinned source hierarchy is only needed to regenerate the committed registry:

    python scripts/introduce_admin_identifiers.py --prepare-registry \
        --source-dir /path/to/find-my-polling-unit

Normal review/application needs no network or external source directory:

    python scripts/introduce_admin_identifiers.py
    python scripts/introduce_admin_identifiers.py --apply --approve-verified

After installation, the default invocation verifies the existing result.
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

from audit_geospatial import ROOT, layer_index, norm, q

OUT = ROOT / 'docs/geospatial-audit'
DOCS = ROOT / 'docs/admin-identifiers'
REGISTRY = DOCS / 'admin-identifier-registry.csv'
SOURCE_MANIFEST = DOCS / 'inec-source-manifest.json'
VERIFICATION = OUT / 'admin-identifier-verification.json'
RESULT = OUT / 'admin-identifier-result.json'
JOURNAL = OUT / 'admin-identifier-install-journal.json'
REPORT = OUT / 'admin-identifier-resolution.md'

SOURCE_REPOSITORY = 'https://github.com/kcemenike/find-my-polling-unit'
SOURCE_COMMIT = '8a5bebf12f2e688ed26c313a632f1b729115d095'
SOURCE_DUPLICATE_WARD_ID = '8810'
STATES = 'admin_states_gadm_pg'
LGAS = 'admin_lgas_gadm_pg'
CENTROIDS = 'admin_lga_centroids_pt'
WARDS = 'admin_wards_pt'
POPULATION = 'population_density2016_states_pg'
CAPITALS = 'settlements_state_capitals_map2023_pt'
TABLES = (STATES, LGAS, CENTROIDS, WARDS, POPULATION, CAPITALS)
ADDED = {
    STATES: {'admin_id': 'TEXT', 'inec_state_id': 'INTEGER'},
    LGAS: {'admin_id': 'TEXT', 'state_admin_id': 'TEXT',
           'inec_lga_id': 'INTEGER', 'inec_lga_code': 'TEXT'},
    CENTROIDS: {'admin_id': 'TEXT', 'state_admin_id': 'TEXT',
                'inec_lga_id': 'INTEGER', 'inec_lga_code': 'TEXT'},
    WARDS: {'admin_id': 'TEXT', 'state_admin_id': 'TEXT', 'lga_admin_id': 'TEXT',
            'inec_ward_id': 'INTEGER', 'inec_ward_code': 'TEXT'},
    POPULATION: {'admin_id': 'TEXT', 'inec_state_id': 'INTEGER'},
    CAPITALS: {'state_admin_id': 'TEXT'},
}
INDEXES = {
    STATES: [('idx_admin_states_admin_id', 'admin_id', True),
             ('idx_admin_states_inec_id', 'inec_state_id', True)],
    LGAS: [('idx_admin_lgas_admin_id', 'admin_id', True),
           ('idx_admin_lgas_state_admin_id', 'state_admin_id', False),
           ('idx_admin_lgas_inec_id', 'inec_lga_id', True)],
    CENTROIDS: [('idx_admin_centroids_admin_id', 'admin_id', True),
                ('idx_admin_centroids_state_admin_id', 'state_admin_id', False),
                ('idx_admin_centroids_inec_id', 'inec_lga_id', True)],
    WARDS: [('idx_admin_wards_admin_id', 'admin_id', True),
            ('idx_admin_wards_state_admin_id', 'state_admin_id', False),
            ('idx_admin_wards_lga_admin_id', 'lga_admin_id', False),
            ('idx_admin_wards_inec_id', 'inec_ward_id', True)],
    POPULATION: [('idx_population_states_admin_id', 'admin_id', True),
                 ('idx_population_states_inec_id', 'inec_state_id', True)],
    CAPITALS: [('idx_capitals_state_admin_id', 'state_admin_id', False)],
}
REGISTRY_FIELDS = [
    'admin_level', 'identifier_status', 'admin_id', 'parent_admin_id',
    'state_admin_id', 'lga_admin_id', 'source_fid', 'state', 'lga', 'ward',
    'inec_state_id', 'inec_lga_id', 'inec_lga_code', 'inec_ward_id',
    'inec_ward_code', 'inec_match_method', 'inec_state_name', 'inec_lga_name',
    'inec_ward_name',
]
LGA_ALIASES = {
    ('Abia', 'Obi Ngwa'): 'OBINGWA',
    ('Akwa Ibom', 'Esit Eket'): 'ESIT EKET (UQUO)',
    ('Bauchi', 'Damban'): 'DAMBAM',
    ('Borno', 'Maiduguri'): 'MAIDUGURI M. C.',
    ('Cross River', 'Calabar Municipal'): 'CALABAR MUNICIPALITY',
    ('Edo', 'Uhunmwonde'): 'UHUNMWODE',
    ('Ekiti', 'Gbonyin'): 'AIYEKIRE',
    ('Federal Capital Territory', 'Abuja'): 'MUNICIPAL',
    ('Gombe', 'Yamaltu/Deba'): 'YALMALTU/ DEBA',
    ('Jigawa', 'Biriniwa'): 'BIRNIWA',
    ('Jigawa', 'Kiri Kasama'): 'KIRIKA SAMMA',
    ('Kano', 'Dambatta'): 'DANBATA',
    ('Kano', 'Dawakin Kudu'): 'DAWAKI KUDU',
    ('Kano', 'Dawakin Tofa'): 'DAWAKI TOFA',
    ('Katsina', 'Malumfashi'): 'MALUFASHI',
    ('Kebbi', 'Arewa Dandi'): 'AREWA',
    ('Kebbi', 'Danko-Wasagu'): 'WASAGU/DANKO',
    ('Kogi', 'Kogi'): 'KOGI . K. K.',
    ('Kogi', 'Mopa-Muro'): 'MOPA MORO',
    ('Kogi', 'Ogori/Magongo'): 'OGORI MANGOGO',
    ('Kwara', 'Pategi'): 'PATIGI',
    ('Lagos', 'Ifako-Ijaiye'): 'IFAKO-IJAYE',
    ('Niger', 'Edati'): 'EDATTI',
    ('Ogun', 'Yewa North'): 'EGBADO NORTH',
    ('Ogun', 'Yewa South'): 'EGBADO SOUTH',
    ('Ogun', 'Ogun Waterside'): 'OGUN WATER SIDE',
    ('Ogun', 'Shagamu'): 'SAGAMU',
    ('Ondo', 'Ile Oluji/Okeigbo'): 'ILEOLUJI/OKEIGBO',
    ('Osun', 'Atakunmosa East'): 'ATAKUMOSA EAST',
    ('Osun', 'Atakunmosa West'): 'ATAKUMOSA WEST',
    ('Osun', 'Aiyedire'): 'AYEDIRE',
    ('Oyo', 'Ogbomosho North'): 'OGBOMOSO NORTH',
    ('Oyo', 'Ogbomosho South'): 'OGBOMOSO SOUTH',
    ('Plateau', 'Barkin Ladi'): 'BARIKIN LADI',
    ('Sokoto', 'Sabon Birni'): 'S/BIRNI',
    ('Sokoto', 'Wamako'): 'WAMAKKO',
    ('Yobe', 'Karasuwa'): 'KARASAWA',
    ('Zamfara', 'Birnin Magaji/Kiyaw'): 'BIRNIN MAGAJI',
}
ROMAN = {
    'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 'vi': 6, 'vii': 7,
    'viii': 8, 'ix': 9, 'x': 10, 'xi': 11, 'xii': 12, 'xiii': 13,
    'xiv': 14, 'xv': 15, 'xvi': 16, 'xvii': 17, 'xviii': 18, 'xix': 19,
    'xx': 20,
}
# INEC's current JSON uses digit 1 for letter I in some Roman numerals.
NUMERAL_LOOKALIKE = {
    '11': '2', '111': '3', '1v': '4', 'v1': '6', 'v11': '7',
    'v111': '8', '1x': '9', 'x1': '11', 'x11': '12', 'x111': '13',
    'x1v': '14', 'xv1': '16', 'xv11': '17', 'xv111': '18',
}


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def update_hash(digest, value):
    if isinstance(value, bytes):
        payload = b'b' + value
    else:
        payload = ('j' + json.dumps(value, ensure_ascii=False, sort_keys=True)).encode('utf8')
    digest.update(struct.pack('<Q', len(payload)))
    digest.update(payload)


def connect(path, readonly=False):
    return sqlite3.connect(f'file:{path}?mode=ro', uri=True) if readonly else sqlite3.connect(path)


def source_path(table):
    return layer_index()[table]['path']


def table_rows(path, table, columns=None):
    with closing(connect(path, True)) as con:
        original_columns = [row[1] for row in con.execute(f'pragma table_info({q(table)})')]
        columns = columns or original_columns
        selected = ','.join(q(column) for column in columns)
        rows = [dict(zip(columns, values)) for values in con.execute(
            f'select {selected} from {q(table)} order by fid')]
    return original_columns, rows


def row_digest(columns, rows):
    digest = hashlib.sha256()
    update_hash(digest, columns)
    for row in rows:
        for column in columns:
            update_hash(digest, row[column])
    return digest.hexdigest()


def geometry_digest(rows):
    digest = hashlib.sha256()
    for row in rows:
        update_hash(digest, row['fid'])
        update_hash(digest, row['geom'])
    return digest.hexdigest()


def normalized_numeral_key(name):
    tokens = norm(name).split()
    if not tokens:
        return ''
    if tokens[-1] in ROMAN:
        tokens[-1] = str(ROMAN[tokens[-1]])
    elif tokens[-1] in NUMERAL_LOOKALIKE:
        tokens[-1] = NUMERAL_LOOKALIKE[tokens[-1]]
    return ' '.join(tokens)


def empty_registry_row(level, fid, state, lga='', ward=''):
    row = {field: '' for field in REGISTRY_FIELDS}
    row.update({'admin_level': level, 'identifier_status': 'assigned',
                'source_fid': str(fid), 'state': state, 'lga': lga, 'ward': ward})
    return row


def read_source_hierarchy(source_dir):
    source_dir = Path(source_dir)
    states = []
    source_files = []
    for path in sorted((source_dir / 'inec_scraped').glob('state_*.json')):
        if path.name.endswith('_coords.json'):
            continue
        data = json.loads(path.read_text(encoding='utf8'))
        states.append(data)
        source_files.append({'path': path.relative_to(source_dir).as_posix(), 'sha256': sha256(path)})
    if len(states) != 37:
        raise RuntimeError(f'expected 37 INEC state files, found {len(states)}')
    return states, source_files


def prepare_registry(source_dir):
    """Build the reviewed registry from the pinned INEC snapshot and current rows."""
    source_states, source_files = read_source_hierarchy(source_dir)
    source_lgas = []
    source_wards = []
    source_states_by_name = {}
    for state in source_states:
        source_states_by_name[norm(state['name'])] = state
        for lga in state['lgas']:
            item = {'state_id': state['id'], 'state': state['name'], 'lga_id': lga['id'],
                    'lga_code': lga['code'], 'lga': lga['name'], 'wards': lga['wards']}
            source_lgas.append(item)
            for ward in lga['wards']:
                if ward['id'] == SOURCE_DUPLICATE_WARD_ID:
                    continue
                source_wards.append({**item, 'wards': None, **ward})
    if (len(source_lgas), len(source_wards)) != (774, 8809):
        raise RuntimeError('curated INEC hierarchy must contain 774 LGAs and 8,809 wards')
    source_lga_lookup = {(norm(row['state']), norm(row['lga'])): row for row in source_lgas}
    source_wards_by_lga = defaultdict(list)
    for row in source_wards:
        source_wards_by_lga[row['lga_id']].append(row)

    registry = []
    lga_map = {}
    state_source_fids = {}
    _, states = table_rows(source_path(STATES), STATES)
    for row in states:
        state_source_fids[row['state']] = row['fid']
        item = empty_registry_row('state', row['fid'], row['state'])
        if row['state'] == 'Water body':
            item.update({'identifier_status': 'non_administrative',
                         'inec_match_method': 'not_applicable_non_administrative'})
        else:
            source_name = 'fct' if row['state'] == 'Federal Capital Territory' else norm(row['state'])
            source = source_states_by_name[source_name]
            item.update({
                'admin_id': f'ngmap:state:{row["state_code"]}', 'state_admin_id': f'ngmap:state:{row["state_code"]}',
                'inec_state_id': source['id'], 'inec_match_method':
                    'reviewed_state_alias' if row['state'] == 'Federal Capital Territory' else 'exact_name',
                'inec_state_name': source['name'],
            })
        registry.append(item)

    _, lgas = table_rows(source_path(LGAS), LGAS)
    for row in lgas:
        item = empty_registry_row('lga', row['fid'], row['state'], row['lga'])
        if row['state'] == 'Water body' and row['lga'] == 'Lake Chad':
            item.update({'identifier_status': 'non_administrative',
                         'inec_match_method': 'not_applicable_non_administrative'})
            registry.append(item)
            continue
        alias = LGA_ALIASES.get((row['state'], row['lga']))
        target = alias or row['lga']
        source_name = 'fct' if row['state'] == 'Federal Capital Territory' else norm(row['state'])
        source = source_lga_lookup.get((source_name, norm(target)))
        if source is None:
            raise RuntimeError(f'unreviewed LGA mapping: {row["state"]} / {row["lga"]}')
        state_admin_id = f'ngmap:state:{next(r["admin_id"].split(":")[-1] for r in registry if r["admin_level"] == "state" and r["state"] == row["state"])}'
        admin_id = f'ngmap:lga:{int(row["lga_id"]):04d}'
        item.update({
            'admin_id': admin_id, 'parent_admin_id': state_admin_id,
            'state_admin_id': state_admin_id, 'lga_admin_id': admin_id,
            'inec_state_id': source['state_id'], 'inec_lga_id': source['lga_id'],
            'inec_lga_code': source['lga_code'],
            'inec_match_method': 'reviewed_lga_alias' if alias else 'exact_name',
            'inec_state_name': source['state'], 'inec_lga_name': source['lga'],
        })
        registry.append(item)
        lga_map[(row['state'], row['lga'])] = (item, source)

    _, wards = table_rows(source_path(WARDS), WARDS)
    local_name_groups = defaultdict(list)
    for row in wards:
        local_name_groups[(row['state'], row['lga'], norm(row['ward']))].append(row)
    for row in wards:
        item = empty_registry_row('ward', row['fid'], row['state'], row['lga'], row['ward'])
        lga_item, source_lga = lga_map[(row['state'], row['lga'])]
        admin_id = f'ngmap:ward:{int(row["fid"]):06d}'
        item.update({
            'admin_id': admin_id, 'parent_admin_id': lga_item['admin_id'],
            'state_admin_id': lga_item['state_admin_id'], 'lga_admin_id': lga_item['admin_id'],
            'inec_state_id': source_lga['state_id'], 'inec_lga_id': source_lga['lga_id'],
            'inec_lga_code': source_lga['lga_code'], 'inec_state_name': source_lga['state'],
            'inec_lga_name': source_lga['lga'],
        })
        duplicate_local = len(local_name_groups[(row['state'], row['lga'], norm(row['ward']))]) > 1
        candidates = source_wards_by_lga[source_lga['lga_id']]
        if duplicate_local:
            item['inec_match_method'] = 'duplicate_local_label'
        else:
            exact = [candidate for candidate in candidates if norm(candidate['name']) == norm(row['ward'])]
            method = 'exact_name'
            if len(exact) != 1:
                exact = [candidate for candidate in candidates
                         if normalized_numeral_key(candidate['name']) == normalized_numeral_key(row['ward'])]
                method = 'normalized_numeral_name'
            if len(exact) == 1:
                source = exact[0]
                item.update({'inec_ward_id': source['id'], 'inec_ward_code': source['code'],
                             'inec_match_method': method, 'inec_ward_name': source['name']})
            else:
                item['inec_match_method'] = 'ambiguous_source_name' if exact else 'unmatched_name'
        registry.append(item)
    by_inec_id = defaultdict(list)
    for item in registry:
        if item['admin_level'] == 'ward' and item['inec_ward_id']:
            by_inec_id[item['inec_ward_id']].append(item)
    collisions = {key: value for key, value in by_inec_id.items() if len(value) > 1}
    if collisions:
        raise RuntimeError(f'INEC ward crosswalk is not one-to-one: {collisions}')

    DOCS.mkdir(parents=True, exist_ok=True)
    with REGISTRY.open('w', encoding='utf8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=REGISTRY_FIELDS)
        writer.writeheader()
        writer.writerows(registry)
    duplicate = next(ward for state in source_states for lga in state['lgas']
                     for ward in lga['wards'] if ward['id'] == SOURCE_DUPLICATE_WARD_ID)
    manifest = {
        'source_repository': SOURCE_REPOSITORY, 'source_commit': SOURCE_COMMIT,
        'source_description': 'INEC CVR-derived state/LGA/registration-area hierarchy; IDs are INEC internal database IDs.',
        'terms_note': 'The upstream README calls the public INEC data free to use but declares no formal repository licence. Attribution and source URLs are retained.',
        'source_readme_sha256': sha256(Path(source_dir) / 'README.md'),
        'source_files': source_files,
        'raw_counts': {'states': 37, 'lgas': 774, 'wards': 8810},
        'curated_counts': {'states': 37, 'lgas': 774, 'wards': 8809},
        'excluded_duplicate_source_record': {
            'reason': 'Exact duplicate Mbaikyaan registration area in Gwer East; ID 8810 duplicates persistent ID 1462 and code 09.',
            'state': 'BENUE', 'lga_id': '125', 'lga': 'GWER EAST', 'ward': duplicate,
            'retained_inec_ward_id': '1462',
        },
        'lga_aliases': [{'state': state, 'local_lga': lga, 'inec_lga': target}
                        for (state, lga), target in sorted(LGA_ALIASES.items())],
        'ward_matching': 'One-to-one exact names, then conservative terminal Roman/Arabic numeral normalization only; duplicate local labels and unmatched names retain null INEC ward fields.',
    }
    SOURCE_MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
    print(f'Wrote {len(registry):,} registry rows and pinned source manifest; no GeoPackage was modified.')


def registry_rows():
    with REGISTRY.open(encoding='utf8', newline='') as handle:
        return list(csv.DictReader(handle))


def registry_maps(rows=None):
    rows = rows or registry_rows()
    states = {row['state']: row for row in rows if row['admin_level'] == 'state'}
    lgas = {(row['state'], row['lga']): row for row in rows if row['admin_level'] == 'lga'}
    wards = {int(row['source_fid']): row for row in rows if row['admin_level'] == 'ward'}
    lgas_by_fid = {int(row['source_fid']): row for row in lgas.values()}
    return states, lgas, lgas_by_fid, wards


def expected_values(table, row, maps):
    states, lgas, _, wards = maps
    if table == STATES:
        item = states[row['state']]
        return {'admin_id': item['admin_id'] or None,
                'inec_state_id': int(item['inec_state_id']) if item['inec_state_id'] else None}
    if table in (LGAS, CENTROIDS):
        item = lgas[(row['state'], row['lga'])]
        return {'admin_id': item['admin_id'] or None,
                'state_admin_id': item['state_admin_id'] or None,
                'inec_lga_id': int(item['inec_lga_id']) if item['inec_lga_id'] else None,
                'inec_lga_code': item['inec_lga_code'] or None}
    if table == WARDS:
        item = wards[row['fid']]
        return {'admin_id': item['admin_id'], 'state_admin_id': item['state_admin_id'],
                'lga_admin_id': item['lga_admin_id'],
                'inec_ward_id': int(item['inec_ward_id']) if item['inec_ward_id'] else None,
                'inec_ward_code': item['inec_ward_code'] or None}
    if table == POPULATION:
        item = states[row['state']]
        return {'admin_id': item['admin_id'] or None,
                'inec_state_id': int(item['inec_state_id']) if item['inec_state_id'] else None}
    if table == CAPITALS:
        return {'state_admin_id': states[row['state']]['admin_id'] or None}
    raise KeyError(table)


def build_verification(require_new_columns=True):
    rows = registry_rows()
    maps = registry_maps(rows)
    states, lgas, _, wards = maps
    source_info = {}
    checks = {}
    for table in TABLES:
        original_columns, current_rows = table_rows(source_path(table), table)
        added = ADDED[table]
        if require_new_columns and any(column in original_columns for column in added):
            raise RuntimeError(f'{table}: identifier columns already exist; inspect before applying')
        original_rows = [{column: row[column] for column in original_columns} for row in current_rows]
        for row in current_rows:
            expected_values(table, row, maps)  # validates every parent/name/FID mapping
        with closing(connect(source_path(table), True)) as con:
            integrity = con.execute('pragma integrity_check').fetchone()[0]
        source_info[table] = {
            'path': source_path(table).relative_to(ROOT).as_posix(),
            'before_sha256': sha256(source_path(table)),
            'feature_count': len(current_rows),
            'original_columns': original_columns,
            'added_columns': added,
            'original_row_digest': row_digest(original_columns, original_rows),
            'geometry_digest': geometry_digest(original_rows),
            'integrity_check': integrity,
        }
        checks[f'{table}_integrity'] = source_info[table]['integrity_check'] == 'ok'
    assigned = [row for row in rows if row['admin_id']]
    ward_external = [row for row in wards.values() if row['inec_ward_id']]
    unresolved = [row for row in wards.values() if not row['inec_ward_id']]
    duplicate_groups = [key for key, count in Counter(
        (row['state'], row['lga'], norm(row['ward'])) for row in wards.values()).items() if count > 1]
    checks.update({
        'registry_9622_rows': len(rows) == 9622,
        'registry_38_state_rows': len(states) == 38,
        'registry_775_lga_rows': len(lgas) == 775,
        'registry_8809_ward_rows': len(wards) == 8809,
        'assigned_ids_37_states_774_lgas_8809_wards': len(assigned) == 37 + 774 + 8809,
        'unique_assigned_ids': len({row['admin_id'] for row in assigned}) == len(assigned),
        'two_nonadmin_rows_have_null_ids': sum(row['identifier_status'] == 'non_administrative' and not row['admin_id'] for row in rows) == 2,
        'all_37_states_have_inec_ids': sum(bool(row['inec_state_id']) for row in states.values()) == 37,
        'all_774_lgas_have_inec_ids': sum(bool(row['inec_lga_id']) for row in lgas.values()) == 774,
        'inec_lga_ids_unique': len({row['inec_lga_id'] for row in lgas.values() if row['inec_lga_id']}) == 774,
        'inec_ward_ids_unique': len({row['inec_ward_id'] for row in ward_external}) == len(ward_external),
        '8589_wards_have_inec_ids': len(ward_external) == 8589,
        '220_wards_have_null_inec_fields': len(unresolved) == 220,
        '198_unmatched_and_22_duplicate_rows': Counter(row['inec_match_method'] for row in unresolved) == {'unmatched_name': 198, 'duplicate_local_label': 22},
        '11_duplicate_local_label_groups': len(duplicate_groups) == 11,
        'six_source_counts_preserved': {table: source_info[table]['feature_count'] for table in TABLES} == {
            STATES: 38, LGAS: 775, CENTROIDS: 774, WARDS: 8809, POPULATION: 38, CAPITALS: 37},
    })
    coverage = {
        'states_with_admin_id': 37, 'lgas_with_admin_id': 774, 'wards_with_admin_id': 8809,
        'non_admin_rows_without_admin_id': 2,
        'states_with_inec_id': 37, 'lgas_with_inec_id': 774,
        'wards_with_inec_id': len(ward_external),
        'wards_without_inec_id': len(unresolved),
        'ward_inec_coverage_fraction': len(ward_external) / 8809,
        'ward_unresolved_methods': dict(Counter(row['inec_match_method'] for row in unresolved)),
        'ward_match_methods': dict(Counter(row['inec_match_method'] for row in wards.values())),
        'duplicate_local_label_groups': len(duplicate_groups),
    }
    return {
        'status': 'ready_for_approved_admin_identifier_installation',
        'scheme': 'ngmap-admin-v1',
        'registry': REGISTRY.relative_to(ROOT).as_posix(), 'registry_sha256': sha256(REGISTRY),
        'source_manifest': SOURCE_MANIFEST.relative_to(ROOT).as_posix(),
        'source_manifest_sha256': sha256(SOURCE_MANIFEST),
        'sources': source_info, 'coverage': coverage, 'checks': checks,
    }


def write_report(verification, applied=False):
    coverage = verification['coverage']
    lines = [
        '# Stable administrative identifier resolution', '',
        f'**Status:** {"installed and verified" if applied else "reviewed dry run; not applied"}.', '',
        '## Canonical IDs', '',
        '- `ngmap-admin-v1` assigns persistent IDs to **37 states**, **774 LGAs** and **8,809 wards**. '
        'Water body and Lake Chad are non-administrative rows and retain null IDs.',
        '- States use `ngmap:state:NG-AB`; LGAs use `ngmap:lga:0001`; wards use '
        '`ngmap:ward:000001`. These are repository-issued identifiers, not statutory or INEC codes.',
        '- IDs are never renumbered to fill gaps. A reviewed name correction retains the existing ID; '
        'new, split or merged entities require an explicit registry decision.',
        '- LGA rows include `state_admin_id`; ward rows include both `state_admin_id` and '
        '`lga_admin_id`. Population-state polygons share state IDs, and capitals reference them.', '',
        '## INEC crosswalk', '',
        f'- **{coverage["states_with_inec_id"]}/37 states** and **{coverage["lgas_with_inec_id"]}/774 LGAs** '
        'have INEC internal IDs; LGA/ward local codes are stored as text to preserve leading zeroes.',
        f'- **{coverage["wards_with_inec_id"]:,}/8,809 wards ({coverage["ward_inec_coverage_fraction"]:.1%})** '
        'have one-to-one INEC ward links. Exact names account for 8,189 and conservative terminal-numeral '
        'normalization for 400.',
        f'- **{coverage["wards_without_inec_id"]} wards** retain null INEC ward fields: 198 unmatched names '
        'and 22 rows in 11 duplicate local-label groups. No external ID is guessed or reused.',
        '- The pinned source contains 8,810 raw ward records. ID 8810 is excluded as an exact duplicate '
        'of Mbaikyaan ID 1462/code 09 in Gwer East, leaving the curated 8,809.',
        '- INEC IDs describe the electoral registration-area hierarchy. They are not legal boundary '
        'identifiers and do not replace the canonical project IDs.', '',
        '## Preservation and reproduction', '',
        '- Only the declared identifier columns, indexes and GeoPackage descriptions are added. Every '
        'original attribute and geometry blob is compared byte-for-byte in staging and after installation.',
        '- Registry: `docs/admin-identifiers/admin-identifier-registry.csv` (9,622 rows including two '
        'non-administrative records).',
        '- Source provenance: `docs/admin-identifiers/inec-source-manifest.json`, pinned to '
        f'`{SOURCE_COMMIT}` of `{SOURCE_REPOSITORY}`.', '',
        '```bash', 'python scripts/introduce_admin_identifiers.py',
        'python scripts/introduce_admin_identifiers.py --apply --approve-verified',
        'python scripts/audit_geospatial.py', 'python scripts/audit_geospatial_extended.py',
        'python scripts/build_site.py', '```',
    ]
    REPORT.write_text('\n'.join(lines) + '\n', encoding='utf8')


def write_dry_run():
    verification = build_verification()
    if not all(verification['checks'].values()):
        raise RuntimeError(f'admin identifier gates failed: {verification["checks"]}')
    VERIFICATION.write_text(json.dumps(verification, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
    write_report(verification, applied=False)
    print(f'Reviewed stable IDs for six GeoPackages; wrote {VERIFICATION}. No source was modified.')


def apply_table(stage, table, maps, changed_at):
    with closing(connect(stage)) as con:
        columns = [row[1] for row in con.execute(f'pragma table_info({q(table)})')]
        if any(column in columns for column in ADDED[table]):
            raise RuntimeError(f'{table}: staged identifier columns already exist')
        for column, kind in ADDED[table].items():
            con.execute(f'alter table {q(table)} add column {q(column)} {kind}')
        rows = [dict(zip(columns, values)) for values in con.execute(f'select * from {q(table)} order by fid')]
        assignments = ','.join(f'{q(column)}=?' for column in ADDED[table])
        for row in rows:
            expected = expected_values(table, row, maps)
            con.execute(f'update {q(table)} set {assignments} where fid=?',
                        (*expected.values(), row['fid']))
        for name, column, unique in INDEXES[table]:
            con.execute(f'create {"unique " if unique else ""}index {q(name)} on {q(table)} ({q(column)}) '
                        'where ' + (f'{q(column)} is not null' if unique else '1=1'))
        description = con.execute('select description from gpkg_contents where table_name=?', (table,)).fetchone()[0]
        note = (' Stable ngmap-admin-v1 identifiers and parent keys added; original names, attributes and '
                'geometry preserved. Optional INEC crosswalk fields are electoral identifiers, not legal boundary codes.')
        con.execute('update gpkg_contents set description=?,last_change=? where table_name=?',
                    ((description or '') + note, changed_at, table))
        con.commit()


def verify_staged_table(original_path, stage, table, maps):
    original_columns, original_rows = table_rows(original_path, table)
    staged_columns, staged_rows = table_rows(stage, table)
    if staged_columns != original_columns + list(ADDED[table]):
        raise RuntimeError(f'{table}: unexpected staged schema')
    if len(staged_rows) != len(original_rows):
        raise RuntimeError(f'{table}: feature count changed')
    for before, after in zip(original_rows, staged_rows):
        for column in original_columns:
            if after[column] != before[column]:
                raise RuntimeError(f'{table} FID {before["fid"]}: original {column} changed')
        expected = expected_values(table, before, maps)
        for column, value in expected.items():
            if after[column] != value:
                raise RuntimeError(f'{table} FID {before["fid"]}: installed {column} differs from registry')
    with closing(connect(stage, True)) as con:
        integrity = con.execute('pragma integrity_check').fetchone()[0]
        indexes = {row[0] for row in con.execute(
            "select name from sqlite_master where type='index'")}
        if not {name for name, _, _ in INDEXES[table]}.issubset(indexes):
            raise RuntimeError(f'{table}: identifier indexes are missing')
    return {
        'feature_count': len(staged_rows),
        'original_row_digest': row_digest(original_columns, original_rows),
        'geometry_digest': geometry_digest(original_rows),
        'integrity_check': integrity,
        'all_original_values_and_geometry_byte_identical': True,
        'all_installed_values_match_registry': True,
        'identifier_indexes_verified': True,
    }


def finalize_installation():
    journal = json.loads(JOURNAL.read_text(encoding='utf8'))
    verification = json.loads(VERIFICATION.read_text(encoding='utf8'))
    maps = registry_maps()
    current = {}
    checks = {}
    for table in TABLES:
        path = source_path(table)
        original_columns = verification['sources'][table]['original_columns']
        _, rows = table_rows(path, table)
        original_rows = [{column: row[column] for column in original_columns} for row in rows]
        for row in rows:
            expected = expected_values(table, row, maps)
            for column, value in expected.items():
                if row[column] != value:
                    raise RuntimeError(f'{table} FID {row["fid"]}: final {column} differs from registry')
        current[table] = {
            'source_hash': sha256(path) == journal['after_sha256'][table],
            'original_row_digest': row_digest(original_columns, original_rows) == verification['sources'][table]['original_row_digest'],
            'geometry_digest': geometry_digest(original_rows) == verification['sources'][table]['geometry_digest'],
            'feature_count': len(rows) == verification['sources'][table]['feature_count'],
            'installed_values': True,
        }
        checks.update({f'{table}_{key}': value for key, value in current[table].items()})
    result = {
        'status': 'installed_and_verified', 'scheme': 'ngmap-admin-v1',
        'applied_at': datetime.now(timezone.utc).isoformat(),
        'registry': verification['registry'], 'registry_sha256': verification['registry_sha256'],
        'source_manifest': verification['source_manifest'],
        'source_manifest_sha256': verification['source_manifest_sha256'],
        'verification_sha256': sha256(VERIFICATION),
        'before_sha256': {table: verification['sources'][table]['before_sha256'] for table in TABLES},
        'after_sha256': journal['after_sha256'],
        'sources': verification['sources'], 'coverage': verification['coverage'],
        'staged_verification': journal['staged_verification'], 'checks': checks,
    }
    if not all(checks.values()):
        raise RuntimeError(f'post-install identifier checks failed: {checks}')
    RESULT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
    write_report(verification, applied=True)
    JOURNAL.unlink()
    print(f'Installed and verified stable administrative identifiers: {RESULT}')


def apply_resolution(approve):
    if not approve:
        raise RuntimeError('identifier installation requires --approve-verified')
    verification = json.loads(VERIFICATION.read_text(encoding='utf8'))
    if verification['status'] != 'ready_for_approved_admin_identifier_installation' or not all(verification['checks'].values()):
        raise RuntimeError('verification is not ready')
    if build_verification() != verification:
        raise RuntimeError('sources or registry changed after review')
    maps = registry_maps()
    stages = {table: source_path(table).with_name(source_path(table).name + '.identifying.gpkg') for table in TABLES}
    if any(path.exists() for path in stages.values()):
        raise RuntimeError('stale identifier staging file requires review')
    try:
        for table in TABLES:
            shutil.copyfile(source_path(table), stages[table])
        changed_at = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
        for table in TABLES:
            apply_table(stages[table], table, maps, changed_at)
        staged = {table: verify_staged_table(source_path(table), stages[table], table, maps) for table in TABLES}
        journal = {
            'after_sha256': {table: sha256(stages[table]) for table in TABLES},
            'staged_verification': staged,
        }
        JOURNAL.write_text(json.dumps(journal, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
        for table in TABLES:
            os.replace(stages[table], source_path(table))
        finalize_installation()
    finally:
        for stage in stages.values():
            if stage.exists():
                stage.unlink()


def verify_existing_result():
    result = json.loads(RESULT.read_text(encoding='utf8'))
    if (sha256(REGISTRY) != result['registry_sha256'] or
            sha256(SOURCE_MANIFEST) != result['source_manifest_sha256'] or
            sha256(VERIFICATION) != result['verification_sha256']):
        raise RuntimeError('identifier evidence hashes differ from result')
    maps = registry_maps()
    checks = {}
    for table in TABLES:
        path = source_path(table)
        original_columns = result['sources'][table]['original_columns']
        _, rows = table_rows(path, table)
        original_rows = [{column: row[column] for column in original_columns} for row in rows]
        values_ok = True
        for row in rows:
            expected = expected_values(table, row, maps)
            values_ok = values_ok and all(row[column] == value for column, value in expected.items())
        checks[table] = (
            sha256(path) == result['after_sha256'][table] and
            len(rows) == result['sources'][table]['feature_count'] and
            row_digest(original_columns, original_rows) == result['sources'][table]['original_row_digest'] and
            geometry_digest(original_rows) == result['sources'][table]['geometry_digest'] and values_ok)
    if not all(checks.values()) or not all(result['checks'].values()):
        raise RuntimeError(f'existing admin identifier installation failed verification: {checks}')
    print('Existing stable administrative identifiers verified; nothing reapplied.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prepare-registry', action='store_true')
    parser.add_argument('--source-dir', type=Path)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--approve-verified', action='store_true')
    args = parser.parse_args()
    if RESULT.exists():
        verify_existing_result()
        return
    if JOURNAL.exists():
        finalize_installation()
        return
    if args.prepare_registry:
        if not args.source_dir:
            raise RuntimeError('--prepare-registry requires --source-dir')
        prepare_registry(args.source_dir)
        write_dry_run()
        return
    if args.apply:
        if not VERIFICATION.exists() or not REGISTRY.exists() or not SOURCE_MANIFEST.exists():
            raise RuntimeError('run the read-only review first')
        apply_resolution(args.approve_verified)
    else:
        if not REGISTRY.exists() or not SOURCE_MANIFEST.exists():
            raise RuntimeError('prepare or restore the committed registry first')
        write_dry_run()


if __name__ == '__main__':
    main()
