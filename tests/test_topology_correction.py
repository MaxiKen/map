"""Regression evidence for the reviewed polygon-topology correction."""
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
from build_site import read_valid_gpkg_geom  # noqa: E402
from correct_polygon_topology import SUFFIX  # noqa: E402
from shapely.geometry import shape  # noqa: E402


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def rows(name):
    with (OUT / name).open(encoding='utf8', newline='') as handle:
        return list(csv.DictReader(handle))


class TopologyCorrectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ledger = rows('topology-correction-ledger.csv')
        cls.verification = json.loads((OUT / 'topology-correction-verification.json').read_text())
        cls.result = json.loads((OUT / 'topology-correction-result.json').read_text())
        hidden_path = OUT / 'hidden-source-artifact-result.json'
        cls.hidden_artifact_result = (json.loads(hidden_path.read_text(encoding='utf8'))
                                      if hidden_path.exists() else None)
        cls.by_layer = {}
        for row in cls.ledger:
            cls.by_layer.setdefault(row['layer'], {})[int(row['fid'])] = row

    def test_evidence_gates_and_four_explicit_review_dispositions(self):
        self.assertEqual(len(self.ledger), 191)
        self.assertEqual(len(self.by_layer), 16)
        self.assertTrue(all(self.verification['checks'].values()))
        self.assertTrue(all(self.result['checks'].values()))
        self.assertEqual(self.verification['visible_repairs'], 76)
        self.assertEqual(self.verification['hidden_repairs'], 115)
        self.assertEqual(self.verification['collapsed_line_residue_features'], 40)
        self.assertEqual(self.verification['maximum_raw_linework_bounds_delta_degrees'], 0)
        self.assertLess(self.verification['maximum_automatic_area_change_fraction'], 0.001627)
        self.assertEqual(Counter(r['review_status'] for r in self.ledger), {
            'automatic_checks_passed': 187,
            'reviewed_large_area': 3,
            'reviewed_collapsed_line_extent': 1,
        })
        self.assertEqual({(r['layer'], int(r['fid'])) for r in self.ledger
                          if r['review_status'] == 'reviewed_large_area'}, {
            ('forest_reserves_water_picture_pg', 795),
            ('protected_areas_wdpa_pg', 148),
            ('climate_temperature_picture_pg', 8),
        })
        self.assertEqual(len(self.verification['raster_class_regression']), 22)
        self.assertTrue(all(r['exact_regression_pass'] for r in
                            self.verification['raster_class_regression']))
        self.assertEqual(sha256(OUT / 'topology-correction-ledger.csv'),
                         self.result['ledger_sha256'])
        self.assertEqual(sha256(OUT / 'topology-correction-verification.json'),
                         self.result['verification_sha256'])

    def test_current_and_provenance_hashes_integrity_and_complete_feature_comparison(self):
        repaired = 0
        unchanged = 0
        for table, ledger_by_fid in self.by_layer.items():
            saved = self.result['layers'][table]
            current_path = layer_index()[table]['path']
            original_path = ROOT / saved['provenance_path']
            if table == 'population_districts_picture_pg' and self.hidden_artifact_result:
                self.assertEqual(self.hidden_artifact_result['sources']['population']['before_sha256'],
                                 saved['after_sha256'])
                self.assertEqual(sha256(current_path),
                                 self.hidden_artifact_result['after_sha256']['population'])
            else:
                self.assertEqual(sha256(current_path), saved['after_sha256'])
            self.assertEqual(sha256(original_path), saved['provenance_sha256'])
            original_table = saved['provenance_table']
            with sqlite3.connect(f'file:{current_path}?mode=ro', uri=True) as current, \
                    sqlite3.connect(f'file:{original_path}?mode=ro', uri=True) as original:
                self.assertEqual(current.execute('pragma integrity_check').fetchone()[0], 'ok')
                self.assertEqual(original.execute('pragma integrity_check').fetchone()[0], 'ok')
                gcol = current.execute(
                    'select column_name from gpkg_geometry_columns where table_name=?',
                    (table,)).fetchone()[0]
                columns = [r[1] for r in current.execute(f'pragma table_info("{table}")')]
                self.assertEqual(columns, [r[1] for r in original.execute(
                    f'pragma table_info("{original_table}")')])
                current_rows = {
                    row[0]: dict(zip(columns, row)) for row in
                    current.execute(f'select * from "{table}" order by fid')}
                original_rows = {
                    row[0]: dict(zip(columns, row)) for row in
                    original.execute(f'select * from "{original_table}" order by fid')}
                self.assertEqual(current_rows.keys(), original_rows.keys())
                for fid, before_props in original_rows.items():
                    after_props = current_rows[fid]
                    for column in columns:
                        if column != gcol:
                            self.assertEqual(after_props[column], before_props[column],
                                             f'{table} FID {fid} attribute {column}')
                    before_blob = before_props[gcol]
                    after_blob = after_props[gcol]
                    before = gpkg_geometry(before_blob)
                    after = gpkg_geometry(after_blob)
                    if before.is_valid:
                        self.assertNotIn(fid, ledger_by_fid)
                        self.assertEqual(before_blob, after_blob,
                                         f'{table} FID {fid} valid source geometry changed')
                        unchanged += 1
                    else:
                        ledger = ledger_by_fid[fid]
                        self.assertEqual(hashlib.sha256(before_blob).hexdigest(),
                                         ledger['before_gpkg_blob_sha256'])
                        self.assertEqual(hashlib.sha256(after_blob).hexdigest(),
                                         ledger['after_gpkg_blob_sha256'])
                        self.assertTrue(after.is_valid)
                        self.assertFalse(after.is_empty)
                        self.assertEqual(after.geom_type, 'MultiPolygon')
                        delta = max(abs(a - b) for a, b in zip(before.bounds, after.bounds))
                        self.assertAlmostEqual(delta, float(ledger['max_bounds_delta_degrees']), places=12)
                        repaired += 1
        self.assertEqual(repaired, 191)
        self.assertEqual(unchanged, 5635)

    def test_reviewed_area_and_collapsed_line_cases(self):
        for layer, fid in (
                ('forest_reserves_water_picture_pg', 795),
                ('protected_areas_wdpa_pg', 148),
                ('climate_temperature_picture_pg', 8)):
            ledger = self.by_layer[layer][fid]
            saved = self.result['layers'][layer]
            with sqlite3.connect(ROOT / saved['provenance_path']) as original, \
                    sqlite3.connect(layer_index()[layer]['path']) as current:
                before_blob = original.execute(
                    f'select geom from "{saved["provenance_table"]}" where fid=?', (fid,)).fetchone()[0]
                after_blob = current.execute(f'select geom from "{layer}" where fid=?', (fid,)).fetchone()[0]
            before_area = shapely_metric(gpkg_geometry(before_blob)).area / 1e6
            after_area = shapely_metric(gpkg_geometry(after_blob)).area / 1e6
            self.assertAlmostEqual(before_area, float(ledger['before_area_km2']), places=6)
            self.assertAlmostEqual(after_area, float(ledger['after_area_km2']), places=6)
        extent = self.by_layer['geology_background_map2023_pg'][234]
        self.assertAlmostEqual(float(extent['max_bounds_delta_degrees']),
                               float(extent['collapsed_line_length_degrees']), places=12)
        self.assertEqual(extent['collapsed_residue_types'], 'LineString')
        self.assertEqual(float(extent['raw_linework_bounds_delta_degrees']), 0)
        self.assertAlmostEqual(float(extent['before_area_km2']),
                               float(extent['after_area_km2']), places=9)

    def test_refreshed_audits_separate_active_data_from_historical_provenance(self):
        core = json.loads((OUT / 'audit.json').read_text())
        extended = json.loads((OUT / 'extended-audit.json').read_text())
        topology = extended['topology']
        self.assertEqual(topology['total_invalid'], 0)
        self.assertEqual(topology['provenance_invalid'], 191)
        self.assertEqual(topology['provenance_layer_count'], 16)
        self.assertEqual(core['geometry_summary']['active_invalid_geometry_count'], 0)
        self.assertEqual(core['geometry_summary']['topology_provenance_invalid_geometry_count'], 191)
        self.assertEqual(len(core['database_integrity']), len(layer_index()))
        self.assertEqual(len(core['vectors']), sum(m['kind'] == 'features' for m in layer_index().values()))
        self.assertEqual(len(rows('topology-exceptions-before.csv')), 191)
        self.assertEqual(rows('topology-exceptions.csv'), [])
        review = {r['layer']: r for r in rows('layer-review.csv')}
        self.assertEqual(len(review), len(layer_index()))
        for table in self.result['layers']:
            original = table + SUFFIX
            self.assertIn(original, review)
            self.assertEqual(review[original]['disposition'], 'Context / scope note')
            self.assertIn('Hidden topology provenance only', review[original]['recommended_action'])
        before = rows('raster-class-agreement-before-topology.csv')
        after = rows('raster-class-agreement.csv')
        self.assertEqual(len(before), len(after), 22)
        key = lambda r: (r['raster'], r['vector'], r['class'])
        before_by_key = {key(r): r for r in before}
        for current in after:
            previous = before_by_key[key(current)]
            self.assertEqual(current['sampled_cells'], previous['sampled_cells'])
            self.assertEqual(current['agreement_fraction'], previous['agreement_fraction'])

    def test_public_repairs_match_source_and_all_exported_geometries_are_valid(self):
        for table in self.result['layers']:
            if not layer_index()[table]['visible']:
                continue
            public = json.loads((ROOT / f'public/data/{table}.geojson').read_text())['features']
            meta = layer_index()[table]
            with sqlite3.connect(f'file:{meta["path"]}?mode=ro', uri=True) as con:
                gcol = con.execute('select column_name from gpkg_geometry_columns where table_name=?',
                                   (table,)).fetchone()[0]
                blobs = [r[0] for r in con.execute(f'select "{gcol}" from "{table}"')]
            self.assertEqual(len(blobs), len(public))
            for blob, feature in zip(blobs, public):
                expected, _ = read_valid_gpkg_geom(blob, 5)
                self.assertEqual(feature['geometry'], expected, table)

        catalog = json.loads((ROOT / 'public/catalog.json').read_text())
        fallbacks = Counter()
        for layer in catalog['layers']:
            fallbacks.update({int(k): v for k, v in layer.get('geometryPrecisionFallbacks', {}).items()})
        self.assertEqual(fallbacks, {6: 29, 7: 6, 8: 2, 12: 3, 15: 3})
        feature_count = 0
        for path in (ROOT / 'public/data').glob('*.geojson'):
            collection = json.loads(path.read_text())
            for index, feature in enumerate(collection.get('features', [])):
                feature_count += 1
                self.assertTrue(shape(feature['geometry']).is_valid, f'{path.stem} feature {index}')
        self.assertEqual(feature_count, 290455)

    def test_no_staging_files_or_published_topology_provenance(self):
        self.assertFalse(list((ROOT / 'data').glob('**/*.correcting.gpkg')))
        self.assertFalse(list((ROOT / 'data').glob('**/*.creating.gpkg')))
        catalog = json.loads((ROOT / 'public/catalog.json').read_text())
        self.assertFalse([layer for layer in catalog['layers'] if SUFFIX in layer['id']])
        self.assertFalse(list((ROOT / 'public').rglob(f'*{SUFFIX}*')))


if __name__ == '__main__':
    unittest.main()
