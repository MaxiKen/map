"""Regression evidence for persistent administrative identifiers and INEC links."""
import csv
import hashlib
import json
import sqlite3
import sys
import unittest
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/geospatial-audit'
DOCS = ROOT / 'docs/admin-identifiers'
sys.path.insert(0, str(ROOT / 'scripts'))

from audit_geospatial import layer_index, norm  # noqa: E402
from introduce_admin_identifiers import (  # noqa: E402
    ADDED, CAPITALS, CENTROIDS, INDEXES, LGAS, POPULATION, STATES, TABLES, WARDS,
    expected_values, geometry_digest, registry_maps, registry_rows, row_digest,
)


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read_rows(table):
    path = layer_index()[table]['path']
    with sqlite3.connect(f'file:{path}?mode=ro', uri=True) as con:
        con.row_factory = sqlite3.Row
        return [dict(row) for row in con.execute(f'select * from {table} order by fid')]


class AdministrativeIdentifierTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = json.loads((OUT / 'admin-identifier-result.json').read_text())
        cls.verification = json.loads((OUT / 'admin-identifier-verification.json').read_text())
        cls.manifest = json.loads((DOCS / 'inec-source-manifest.json').read_text())
        cls.registry = registry_rows()
        cls.maps = registry_maps(cls.registry)
        cls.rows = {table: read_rows(table) for table in TABLES}

    def test_guarded_registry_source_and_result_hashes(self):
        self.assertEqual(self.result['status'], 'installed_and_verified')
        self.assertEqual(self.result['scheme'], 'ngmap-admin-v1')
        self.assertTrue(all(self.verification['checks'].values()))
        self.assertTrue(all(self.result['checks'].values()))
        self.assertEqual(len(self.registry), 9622)
        self.assertEqual(Counter(row['admin_level'] for row in self.registry),
                         {'state': 38, 'lga': 775, 'ward': 8809})
        self.assertEqual(sha256(DOCS / 'admin-identifier-registry.csv'), self.result['registry_sha256'])
        self.assertEqual(sha256(DOCS / 'inec-source-manifest.json'), self.result['source_manifest_sha256'])
        self.assertEqual(sha256(OUT / 'admin-identifier-verification.json'),
                         self.result['verification_sha256'])
        self.assertEqual(self.manifest['source_commit'],
                         '8a5bebf12f2e688ed26c313a632f1b729115d095')
        self.assertEqual(len(self.manifest['source_files']), 37)
        self.assertEqual(self.manifest['raw_counts']['wards'], 8810)
        self.assertEqual(self.manifest['curated_counts']['wards'], 8809)
        self.assertEqual(self.manifest['excluded_duplicate_source_record']['ward']['id'], '8810')
        self.assertEqual(self.manifest['excluded_duplicate_source_record']['retained_inec_ward_id'], '1462')
        self.assertFalse((OUT / 'admin-identifier-install-journal.json').exists())

    def test_complete_canonical_state_lga_centroid_and_population_relationships(self):
        states = self.rows[STATES]
        state_by_name = {row['state']: row for row in states}
        self.assertEqual(len(states), 38)
        self.assertEqual(sum(row['admin_id'] is not None for row in states), 37)
        self.assertEqual(len({row['admin_id'] for row in states if row['admin_id']}), 37)
        self.assertIsNone(state_by_name['Water body']['admin_id'])
        self.assertIsNone(state_by_name['Water body']['inec_state_id'])
        self.assertEqual(state_by_name['Abia']['admin_id'], 'ngmap:state:NG-AB')
        self.assertEqual(state_by_name['Federal Capital Territory']['inec_state_id'], 15)

        polygons = self.rows[LGAS]
        polygon_by_name = {(row['state'], row['lga']): row for row in polygons}
        self.assertEqual(len(polygons), 775)
        self.assertEqual(sum(row['admin_id'] is not None for row in polygons), 774)
        self.assertEqual(len({row['admin_id'] for row in polygons if row['admin_id']}), 774)
        lake = polygon_by_name[('Water body', 'Lake Chad')]
        self.assertIsNone(lake['admin_id'])
        self.assertIsNone(lake['state_admin_id'])
        gada = polygon_by_name[('Sokoto', 'Gada')]
        illela = polygon_by_name[('Sokoto', 'Illela')]
        self.assertEqual((gada['admin_id'], gada['inec_lga_id'], gada['inec_lga_code']),
                         ('ngmap:lga:0712', 702, '04'))
        self.assertEqual((illela['admin_id'], illela['inec_lga_id'], illela['inec_lga_code']),
                         ('ngmap:lga:0708', 706, '08'))
        self.assertEqual(gada['state_admin_id'], 'ngmap:state:NG-SO')
        self.assertNotEqual(gada['admin_id'], illela['admin_id'])

        centroids = self.rows[CENTROIDS]
        self.assertEqual(len(centroids), 774)
        for row in centroids:
            polygon = polygon_by_name[(row['state'], row['lga'])]
            for column in ('admin_id', 'state_admin_id', 'inec_lga_id', 'inec_lga_code'):
                self.assertEqual(row[column], polygon[column])
        for row in self.rows[POPULATION]:
            state = state_by_name[row['state']]
            self.assertEqual(row['admin_id'], state['admin_id'])
            self.assertEqual(row['inec_state_id'], state['inec_state_id'])
        for row in self.rows[CAPITALS]:
            self.assertEqual(row['state_admin_id'], state_by_name[row['state']]['admin_id'])

    def test_ward_ids_are_unique_and_external_links_are_conservative(self):
        wards = self.rows[WARDS]
        self.assertEqual(len(wards), 8809)
        self.assertEqual(len({row['admin_id'] for row in wards}), 8809)
        self.assertTrue(all(row['admin_id'] and row['state_admin_id'] and row['lga_admin_id']
                            for row in wards))
        self.assertEqual(sum(row['inec_ward_id'] is not None for row in wards), 8589)
        self.assertEqual(len({row['inec_ward_id'] for row in wards if row['inec_ward_id'] is not None}), 8589)
        by_fid = {row['fid']: row for row in wards}
        for fid in (436, 437, 892, 893):
            self.assertIsNone(by_fid[fid]['inec_ward_id'])
            self.assertIsNone(by_fid[fid]['inec_ward_code'])
        self.assertNotEqual(by_fid[436]['admin_id'], by_fid[437]['admin_id'])
        self.assertEqual((by_fid[1461]['inec_ward_id'], by_fid[1461]['inec_ward_code']), (1462, '09'))
        self.assertEqual((by_fid[557]['inec_ward_id'], by_fid[557]['inec_ward_code']), (557, '11'))
        self.assertNotIn(8810, {row['inec_ward_id'] for row in wards})
        registry_wards = self.maps[3]
        methods = Counter(row['inec_match_method'] for row in registry_wards.values())
        self.assertEqual(methods, {'exact_name': 8189, 'normalized_numeral_name': 400,
                                   'unmatched_name': 198, 'duplicate_local_label': 22})
        duplicate_groups = [key for key, count in Counter(
            (row['state'], row['lga'], norm(row['ward'])) for row in wards).items() if count > 1]
        self.assertEqual(len(duplicate_groups), 11)

    def test_every_installed_value_matches_registry_and_original_rows_are_preserved(self):
        for table in TABLES:
            saved = self.result['sources'][table]
            current = self.rows[table]
            self.assertEqual(sha256(layer_index()[table]['path']), self.result['after_sha256'][table])
            self.assertEqual(list(ADDED[table]), list(saved['added_columns']))
            original_rows = [{column: row[column] for column in saved['original_columns']} for row in current]
            self.assertEqual(row_digest(saved['original_columns'], original_rows), saved['original_row_digest'])
            self.assertEqual(geometry_digest(original_rows), saved['geometry_digest'])
            for row in current:
                expected = expected_values(table, row, self.maps)
                for column, value in expected.items():
                    self.assertEqual(row[column], value, f'{table} FID {row["fid"]} {column}')
            path = layer_index()[table]['path']
            with sqlite3.connect(f'file:{path}?mode=ro', uri=True) as con:
                self.assertEqual(con.execute('pragma integrity_check').fetchone()[0], 'ok')
                columns = [row[1] for row in con.execute(f'pragma table_info({table})')]
                self.assertEqual(columns, saved['original_columns'] + list(ADDED[table]))
                indexes = {row[0] for row in con.execute(
                    "select name from sqlite_master where type='index'")}
                self.assertTrue({name for name, _, _ in INDEXES[table]}.issubset(indexes))
            staged = self.result['staged_verification'][table]
            self.assertTrue(staged['all_original_values_and_geometry_byte_identical'])
            self.assertTrue(staged['all_installed_values_match_registry'])
            self.assertTrue(staged['identifier_indexes_verified'])
            self.assertEqual(staged['original_row_digest'], saved['original_row_digest'])
            self.assertEqual(staged['geometry_digest'], saved['geometry_digest'])

    def test_public_geojson_exposes_stable_feature_ids_and_properties(self):
        for table in (STATES, LGAS, CENTROIDS, WARDS, POPULATION):
            data = json.loads((ROOT / f'public/data/{table}.geojson').read_text(encoding='utf8'))
            self.assertEqual(len(data['features']), len(self.rows[table]))
            for feature, source in zip(data['features'], self.rows[table]):
                if source['admin_id']:
                    self.assertEqual(feature['id'], source['admin_id'])
                    self.assertEqual(feature['properties']['admin_id'], source['admin_id'])
                else:
                    self.assertNotIn('id', feature)
                    self.assertNotIn('admin_id', feature['properties'])
        capitals = json.loads((ROOT / f'public/data/{CAPITALS}.geojson').read_text(encoding='utf8'))
        for feature, source in zip(capitals['features'], self.rows[CAPITALS]):
            self.assertEqual(feature['properties']['state_admin_id'], source['state_admin_id'])
        catalog = json.loads((ROOT / 'public/catalog.json').read_text(encoding='utf8'))
        layers = {row['id']: row for row in catalog['layers']}
        for table in (STATES, LGAS, CENTROIDS, WARDS, POPULATION):
            self.assertIn('admin_id', {field['name'] for field in layers[table]['fields']})
        self.assertIn('state_admin_id', {field['name'] for field in layers[CAPITALS]['fields']})

    def test_refreshed_audit_records_item_six_without_hiding_unresolved_links(self):
        extended = json.loads((OUT / 'extended-audit.json').read_text(encoding='utf8'))
        self.assertEqual(extended['administrative_identifiers']['after_sha256'], self.result['after_sha256'])
        self.assertEqual(extended['administrative_identifiers']['coverage']['wards_without_inec_id'], 220)
        report = (OUT / 'README.md').read_text(encoding='utf8')
        self.assertIn('All six prioritized correction/reclassification tasks are complete', report)
        self.assertIn('Stable administrative identifiers are installed', report)
        self.assertIn('8,589/8,809', report)
        self.assertIn('220', report)
        self.assertIn('admin-identifier-result.json', report)
        with (OUT / 'layer-review.csv').open(encoding='utf8', newline='') as handle:
            review = {row['layer']: row for row in csv.DictReader(handle)}
        for table in (STATES, LGAS, CENTROIDS, WARDS):
            self.assertIn('ngmap-admin-v1', review[table]['evidence'])


if __name__ == '__main__':
    unittest.main()
