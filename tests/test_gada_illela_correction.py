"""Regression evidence for the narrowly scoped Gada/Illela identity correction."""
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
sys.path.insert(0, str(ROOT / 'scripts'))

from audit_geospatial import gpkg_geometry, layer_index, shapely_metric  # noqa: E402
from shapely import STRtree  # noqa: E402


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def csv_rows(name):
    with (OUT / name).open(encoding='utf8', newline='') as handle:
        return list(csv.DictReader(handle))


def read_rows(table, path=None):
    path = path or layer_index()[table]['path']
    with sqlite3.connect(f'file:{path}?mode=ro', uri=True) as con:
        con.row_factory = sqlite3.Row
        return [dict(row) for row in con.execute(f'select * from "{table}" order by fid')]


class GadaIllelaCorrectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ledger = csv_rows('gada-illela-correction-ledger.csv')
        cls.verification = json.loads((OUT / 'gada-illela-verification.json').read_text())
        cls.result = json.loads((OUT / 'gada-illela-correction-result.json').read_text())
        residual_path = OUT / 'ward-lga-correction-result.json'
        cls.residual_result = (json.loads(residual_path.read_text(encoding='utf8'))
                               if residual_path.exists() else None)
        hidden_path = OUT / 'hidden-source-artifact-result.json'
        cls.hidden_artifact_result = (json.loads(hidden_path.read_text(encoding='utf8'))
                                      if hidden_path.exists() else None)
        cls.by_layer = {}
        for row in cls.ledger:
            cls.by_layer.setdefault(row['layer'], {})[int(row['fid'])] = row
        cls.index = layer_index()

    def test_official_direction_ledger_counts_and_result_hashes(self):
        self.assertEqual(len(self.index), 98)
        self.assertEqual(len(self.ledger), 601)
        self.assertTrue(all(self.verification['checks'].values()))
        self.assertTrue(all(self.result['checks'].values()))
        self.assertEqual(self.result['counts'], {
            'polygon_identities': 2, 'centroid_identities': 2,
            'ward_distances': 22, 'derived_joins': 575, 'total': 601,
        })
        self.assertEqual(Counter(r['layer'] for r in self.ledger), {
            'admin_lgas_gadm_pg': 2, 'admin_lga_centroids_pt': 2, 'admin_wards_pt': 22,
            'groundwater_boreholes_wpdx_pt': 173, 'settlements_gazetteer_diva_pt': 97,
            'settlements_places_osm_pt': 303, 'settlements_towns_map2023_pt': 2,
        })
        official = self.verification['official_control']
        self.assertEqual((official['gada']['code'], official['gada']['polling_units']), ('04', 239))
        self.assertEqual((official['illela']['code'], official['illela']['polling_units']), ('08', 210))
        self.assertEqual(len(official['gada']['wards']), 11)
        self.assertEqual(len(official['illela']['wards']), 11)
        self.assertGreater(min(self.verification['reciprocal_ious']),
                           10 * max(self.verification['same_name_ious']))
        reference = OUT / 'references/sokoto-gada-illela-esri-mbr-2023.geojson'
        self.assertEqual(sha256(reference), self.verification['boundary_reference']['local_sha256'])
        self.assertEqual(len(json.loads(reference.read_text())['features']), 2)
        self.assertEqual(sha256(OUT / 'gada-illela-correction-ledger.csv'), self.result['ledger_sha256'])
        self.assertEqual(sha256(OUT / 'gada-illela-verification.json'), self.result['verification_sha256'])
        self.assertEqual(self.result['post_correction']['visible_derived_joins'], 476)

    def test_all_source_hashes_ledger_attributes_geometry_and_hidden_originals(self):
        for table in self.by_layer:
            path = self.index[table]['path']
            if table == 'admin_wards_pt' and self.residual_result:
                self.assertEqual(self.residual_result['before_sha256'],
                                 self.result['after_sha256'][table])
                self.assertEqual(sha256(path), self.residual_result['after_sha256'])
            elif table == 'settlements_towns_map2023_pt' and self.hidden_artifact_result:
                self.assertEqual(self.hidden_artifact_result['sources']['towns']['before_sha256'],
                                 self.result['after_sha256'][table])
                self.assertEqual(sha256(path), self.hidden_artifact_result['after_sha256']['towns'])
            else:
                self.assertEqual(sha256(path), self.result['after_sha256'][table])
            with sqlite3.connect(f'file:{path}?mode=ro', uri=True) as con:
                self.assertEqual(con.execute('pragma integrity_check').fetchone()[0], 'ok')
                gcol = con.execute('select column_name from gpkg_geometry_columns where table_name=?',
                                   (table,)).fetchone()[0]
                con.row_factory = sqlite3.Row
                for fid, ledger in self.by_layer[table].items():
                    row = dict(con.execute(f'select * from "{table}" where fid=?', (fid,)).fetchone())
                    self.assertEqual(hashlib.sha256(row[gcol]).hexdigest(), ledger['after_geometry_sha256'])
                    self.assertEqual(ledger['before_geometry_sha256'], ledger['after_geometry_sha256'])
                    for key, value in json.loads(ledger['after_attributes_json']).items():
                        self.assertEqual(row[key], value, f'{table} FID {fid} {key}')
        for table, saved in self.result['provenance'].items():
            original_path = ROOT / saved['path']
            self.assertEqual(sha256(original_path), saved['sha256'])
            # The table rename inside the provenance copy changes file bytes, not feature rows.
            self.assertNotEqual(saved['sha256'], self.result['before_sha256'][table])
            original_table = saved['table']
            current = {r['fid']: r for r in read_rows(table)}
            original = {r['fid']: r for r in read_rows(original_table, original_path)}
            self.assertEqual(current.keys(), original.keys())
            with sqlite3.connect(f'file:{original_path}?mode=ro', uri=True) as con:
                self.assertEqual(con.execute('pragma integrity_check').fetchone()[0], 'ok')
            for fid, before in original.items():
                after = current[fid]
                expected = (json.loads(self.by_layer[table][fid]['after_attributes_json'])
                            if fid in self.by_layer[table] else {})
                for key in before:
                    if key == 'geom':
                        self.assertEqual(after[key], before[key], f'{table} FID {fid} geometry')
                    elif key in expected:
                        self.assertEqual(after[key], expected[key], f'{table} FID {fid} {key}')
                    else:
                        self.assertEqual(after[key], before[key], f'{table} FID {fid} {key}')

    def polygon_index(self):
        polygons = [(row, gpkg_geometry(row['geom']))
                    for row in read_rows('admin_lgas_gadm_pg')]
        return polygons, STRtree([geometry for _, geometry in polygons])

    def containers(self, polygons, tree, point):
        return [polygons[i][0] for i in tree.query(point, predicate='intersects')
                if polygons[i][1].intersects(point)]

    def test_official_wards_fixed_coordinates_distances_and_retained_exceptions(self):
        wards = {r['fid']: r for r in read_rows('admin_wards_pt')
                 if r['state'] == 'Sokoto' and r['lga'] in ('Gada', 'Illela')}
        self.assertEqual(len(wards), 22)
        polygons, tree = self.polygon_index()
        counts = Counter()
        for fid, ward in wards.items():
            containing = self.containers(polygons, tree, gpkg_geometry(ward['geom']))
            if any(r['lga'] == ward['lga'] for r in containing):
                counts[ward['lga']] += 1
            if fid in self.by_layer['admin_wards_pt']:
                self.assertEqual(ward['dist_to_lga_centroid_km'],
                                 self.result['post_correction']['ward_distances_km'][str(fid)])
        self.assertEqual(counts, {'Gada': 11, 'Illela': 10})
        darna = wards[8150]
        self.assertEqual(darna['lga'], 'Illela')
        containing = self.containers(polygons, tree, gpkg_geometry(darna['geom']))
        self.assertEqual([r['lga'] for r in containing], ['Gwadabawa'])
        illela = next(g for r, g in polygons if r['state'] == 'Sokoto' and r['lga'] == 'Illela')
        distance = shapely_metric(gpkg_geometry(darna['geom'])).distance(shapely_metric(illela)) / 1000
        self.assertAlmostEqual(distance, 0.24204866496460706, places=9)
        kiri = next(r for r in read_rows('settlements_places_osm_pt') if r['fid'] == 14680)
        self.assertEqual(kiri['lga'], 'Illela')
        self.assertIsNone(kiri['previous_lga'])

    def test_all_derived_joins_and_current_public_attributes(self):
        polygons, tree = self.polygon_index()
        visible = 0
        for table in ('groundwater_boreholes_wpdx_pt', 'settlements_gazetteer_diva_pt',
                      'settlements_places_osm_pt', 'settlements_towns_map2023_pt'):
            current = {r['fid']: r for r in read_rows(table)}
            for fid, ledger in self.by_layer[table].items():
                row = current[fid]
                after = json.loads(ledger['after_attributes_json'])
                self.assertEqual(row['lga'], after['lga'])
                self.assertEqual(row['previous_lga'], after['previous_lga'])
                containing = self.containers(polygons, tree, gpkg_geometry(row['geom']))
                self.assertTrue(any(r['state'] == row['state'] and r['lga'] == row['lga']
                                    for r in containing), f'{table} FID {fid}')
                visible += self.index[table]['visible']
        self.assertEqual(visible, 476)

        for table in ('admin_lgas_gadm_pg', 'admin_lga_centroids_pt', 'admin_wards_pt',
                      'groundwater_boreholes_wpdx_pt'):
            public = json.loads((ROOT / f'public/data/{table}.geojson').read_text())['features']
            source = read_rows(table)
            self.assertEqual(len(public), len(source))
            for row, feature in zip(source, public):
                ledger = self.by_layer.get(table, {}).get(row['fid'])
                if not ledger:
                    continue
                for key, value in json.loads(ledger['after_attributes_json']).items():
                    if key in feature['properties']:
                        self.assertEqual(feature['properties'][key], value,
                                         f'public {table} FID {row["fid"]} {key}')
                if table == 'groundwater_boreholes_wpdx_pt':
                    self.assertEqual(feature['properties']['previous_lga'],
                                     json.loads(ledger['after_attributes_json'])['previous_lga'])
        catalog = json.loads((ROOT / 'public/catalog.json').read_text())
        self.assertEqual(len(catalog['layers']), 59)
        self.assertFalse([layer for layer in catalog['layers'] if 'identity_original' in layer['id']])

    def test_refreshed_audits_report_and_layer_register(self):
        core = json.loads((OUT / 'audit.json').read_text())
        extended = json.loads((OUT / 'extended-audit.json').read_text())
        self.assertEqual(len(core['database_integrity']), 98)
        self.assertEqual(len(core['vectors']), 82)
        self.assertEqual(len(core['rasters']), 16)
        summary = core['geometry_summary']
        self.assertEqual(summary['active_vector_layers'], 64)
        self.assertEqual(summary['active_invalid_geometry_count'], 0)
        self.assertEqual(summary['topology_provenance_invalid_geometry_count'], 191)
        self.assertEqual(summary['identity_provenance_layers'], 2)
        self.assertEqual(summary['identity_provenance_invalid_geometry_count'], 0)
        self.assertEqual(extended['topology']['total_invalid'], 0)
        self.assertEqual(extended['topology']['provenance_invalid'], 191)
        wards = extended['ward_exceptions']
        self.assertEqual(wards['total_outside_assigned_lga'], 37)
        self.assertTrue(wards['individual_review_complete'])
        self.assertEqual(wards['pre_review_exception_count'], 40)
        self.assertEqual(wards['review_lga_corrections'], 3)
        self.assertEqual(wards['reciprocal_gada_illela_containment'], 0)
        self.assertEqual(wards['sokoto_gada_illela_exceptions'], 1)
        self.assertEqual(extended['gada_illela_correction']['counts']['total'], 601)
        report = (OUT / 'README.md').read_text()
        self.assertIn('A2 — Resolved with provenance', report)
        self.assertNotIn('A2 — High: reciprocal', report)
        self.assertIn('A3 — Resolved with provenance: residual ward/LGA exception review', report)
        self.assertIn('Darna/Sabon Gari remains a separate Gwadabawa', report)
        self.assertIn('all 98 GeoPackages', report)
        self.assertIn('with 43 per-feature higher-precision fallbacks', report)
        review = {r['layer']: r for r in csv_rows('layer-review.csv')}
        self.assertEqual(len(review), 98)
        self.assertNotIn('Action required', {r['disposition'] for r in review.values()})
        for table in ('admin_lgas_gadm_identity_original_pg', 'admin_lga_centroids_identity_original_pt'):
            self.assertEqual(review[table]['disposition'], 'Context / scope note')
            self.assertIn('Hidden Gada/Illela identity provenance only', review[table]['recommended_action'])
        self.assertEqual(review['admin_wards_pt']['disposition'], 'Reviewed with exceptions')
        self.assertIn('40-case review', review['admin_wards_pt']['recommended_action'])


if __name__ == '__main__':
    unittest.main()
