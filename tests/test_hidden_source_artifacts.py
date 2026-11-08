"""Regression evidence for the two hidden-source artifact resolutions."""
import csv
import hashlib
import json
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/geospatial-audit'
TOWNS_PATH = ROOT / 'data/Settlements/hidden_settlements_towns_map2023_pt.gpkg'
POPULATION_PATH = ROOT / 'data/Population/hidden_population_districts_picture_pg.gpkg'
TOWNS = 'settlements_towns_map2023_pt'
POPULATION = 'population_districts_picture_pg'
TOWNS_SIDE = 'settlements_towns_map2023_excluded_artifacts_tbl'
POPULATION_SIDE = 'population_districts_picture_semantic_review_tbl'


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


class HiddenSourceArtifactTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = json.loads((OUT / 'hidden-source-artifact-result.json').read_text())
        cls.verification = json.loads((OUT / 'hidden-source-artifact-verification.json').read_text())
        with (OUT / 'hidden-source-artifact-ledger.csv').open(encoding='utf8', newline='') as handle:
            cls.ledger = list(csv.DictReader(handle))

    def test_guarded_ledger_result_counts_and_hashes(self):
        self.assertEqual(len(self.ledger), 2)
        self.assertEqual({row['case'] for row in self.ledger}, {'towns', 'population'})
        self.assertEqual(self.result['status'], 'resolved_and_verified')
        self.assertTrue(all(self.verification['checks'].values()))
        self.assertTrue(all(self.result['checks'].values()))
        self.assertEqual(sha256(OUT / 'hidden-source-artifact-verification.json'),
                         self.result['verification_sha256'])
        self.assertEqual(sha256(OUT / 'hidden-source-artifact-ledger.csv'), self.result['ledger_sha256'])
        self.assertEqual(sha256(TOWNS_PATH), self.result['after_sha256']['towns'])
        self.assertEqual(sha256(POPULATION_PATH), self.result['after_sha256']['population'])
        self.assertEqual(self.result['planned_counts'], {'towns': 478, 'population': 504})
        self.assertTrue(self.result['staged_verification']['towns']['all_untargeted_active_rows_byte_identical'])
        self.assertTrue(self.result['staged_verification']['population']['all_untargeted_active_rows_byte_identical'])
        self.assertEqual(self.result['staged_verification']['population']['before_feature_digest'],
                         self.result['staged_verification']['population']['after_feature_digest'])
        self.assertFalse((OUT / 'hidden-source-artifact-install-journal.json').exists())

    def test_towns_only_fid479_is_quarantined_with_complete_original_record(self):
        expected = self.result['towns']
        with sqlite3.connect(f'file:{TOWNS_PATH}?mode=ro', uri=True) as con:
            con.row_factory = sqlite3.Row
            self.assertEqual(con.execute(f'select count(*) from {TOWNS}').fetchone()[0], 478)
            self.assertIsNone(con.execute(f'select 1 from {TOWNS} where fid=479').fetchone())
            self.assertEqual(con.execute(f'select count(*) from {TOWNS_SIDE}').fetchone()[0], 1)
            row = dict(con.execute(f'select * from {TOWNS_SIDE} where id=1').fetchone())
            self.assertEqual(con.execute('select data_type from gpkg_contents where table_name=?',
                                         (TOWNS_SIDE,)).fetchone()[0], 'attributes')
            self.assertIsNone(con.execute('select 1 from gpkg_geometry_columns where table_name=?',
                                          (TOWNS_SIDE,)).fetchone())
        self.assertEqual(row['source_table'], TOWNS)
        self.assertEqual(row['original_fid'], 479)
        self.assertEqual(hashlib.sha256(row['original_geom']).hexdigest(), expected['geometry_sha256'])
        self.assertEqual(row['name'], 'Tow ns')
        self.assertEqual(row['label_dist_pt'], 15.8)
        self.assertIsNone(row['state'])
        self.assertIsNone(row['lga'])
        for key, value in expected['before_attributes'].items():
            self.assertEqual(row[key], value, key)
        self.assertEqual(row['longitude'], expected['longitude'])
        self.assertEqual(row['latitude'], expected['latitude'])
        self.assertEqual(json.loads(row['nearest_evidence_json']), expected['nearest_settlements'])
        self.assertEqual(expected['nearest_settlements']['osm']['nearest_name'], 'Nver')
        self.assertGreater(expected['nearest_settlements']['osm']['distance_km'], 133)
        self.assertEqual(self.result['staged_verification']['towns']['active_feature_count'], 478)

    def test_population_d0451_is_retained_but_excluded_semantically(self):
        expected = self.result['population']
        with sqlite3.connect(f'file:{POPULATION_PATH}?mode=ro', uri=True) as con:
            con.row_factory = sqlite3.Row
            self.assertEqual(con.execute(f'select count(*) from {POPULATION}').fetchone()[0], 504)
            active = dict(con.execute(f'select * from {POPULATION} where fid=451').fetchone())
            review = dict(con.execute(f'select * from {POPULATION_SIDE} where id=1').fetchone())
            self.assertEqual(con.execute('select data_type from gpkg_contents where table_name=?',
                                         (POPULATION_SIDE,)).fetchone()[0], 'attributes')
            self.assertIsNone(con.execute('select 1 from gpkg_geometry_columns where table_name=?',
                                          (POPULATION_SIDE,)).fetchone())
        self.assertEqual(active['district_id'], 'D0451')
        self.assertEqual(active['class_name'], '232,288 - 1,319,571')
        self.assertEqual(active['area_km2'], 121139.862)
        self.assertEqual(hashlib.sha256(active['geom']).hexdigest(), expected['geometry_sha256'])
        for key, value in expected['before_attributes'].items():
            self.assertEqual(active[key], value, key)
        self.assertEqual(review['district_id'], 'D0451')
        self.assertEqual(review['classification'], 'connected_population_class_region_not_administrative_district')
        self.assertEqual(review['analysis_use'], 'exclude_from_district_level_analysis_retain_as_picture_region')
        self.assertEqual(review['state_intersection_count'], 16)
        self.assertEqual(review['lga_intersection_count'], 124)
        self.assertEqual(review['geometry_sha256'], expected['geometry_sha256'])
        self.assertEqual(json.loads(review['intersection_evidence_json']), expected['intersections'])
        self.assertEqual(len(expected['intersections']['states']), 16)
        self.assertEqual(len(expected['intersections']['lgas']), 124)
        self.assertIn('Bauchi', {row['name'] for row in expected['intersections']['states']})
        self.assertIn('Kaduna', {row['name'] for row in expected['intersections']['states']})

    def test_sidecars_and_hidden_features_are_not_published(self):
        catalog = json.loads((ROOT / 'public/catalog.json').read_text(encoding='utf8'))
        ids = {row['id'] for row in catalog['layers']}
        self.assertEqual(len(ids), 59)
        self.assertNotIn(TOWNS, ids)
        self.assertNotIn(POPULATION, ids)
        self.assertNotIn(TOWNS_SIDE, ids)
        self.assertNotIn(POPULATION_SIDE, ids)
        self.assertFalse((ROOT / f'public/data/{TOWNS}.geojson').exists())
        self.assertFalse((ROOT / f'public/data/{POPULATION}.geojson').exists())

    def test_refreshed_audits_remove_unresolved_flags(self):
        extended = json.loads((OUT / 'extended-audit.json').read_text(encoding='utf8'))
        self.assertEqual(extended['hidden_source_artifact_resolution']['after_sha256'],
                         self.result['after_sha256'])
        raster = extended['raster_registration']
        self.assertEqual(raster['population_districts_over_50000km2'], [])
        self.assertEqual(len(raster['population_connected_region_exclusions']), 1)
        self.assertEqual(raster['population_connected_region_exclusions'][0]['district_id'], 'D0451')
        with (OUT / 'point-outliers-classified.csv').open(encoding='utf8', newline='') as handle:
            outliers = list(csv.DictReader(handle))
        self.assertFalse(any(row['layer'] == TOWNS and row['name'] == 'Tow ns' for row in outliers))
        self.assertNotIn('probable scanned-map legend artefact; review',
                         extended['point_outlier_classifications'])
        with (OUT / 'layer-review.csv').open(encoding='utf8', newline='') as handle:
            review = {row['layer']: row for row in csv.DictReader(handle)}
        self.assertEqual(review[TOWNS]['disposition'], 'Artifact quarantined / hidden')
        self.assertEqual(review[POPULATION]['disposition'], 'Scope reclassified / hidden')
        self.assertEqual(review[TOWNS]['review_findings'], 'None in applicable checks')
        self.assertEqual(review[POPULATION]['review_findings'], 'None in applicable checks')
        self.assertIn('16 states and 124 LGAs', review[POPULATION]['evidence'])
        report = (OUT / 'README.md').read_text(encoding='utf8')
        self.assertIn('All five prioritized correction/reclassification tasks are complete', report)
        self.assertIn('Both hidden-source artefacts are resolved without coordinate shifts', report)
        self.assertIn('479 → 478', report)
        self.assertIn('hidden-source-artifact-resolution.md', report)
        self.assertNotIn('should be removed or corrected in the source workflow', report)


if __name__ == '__main__':
    unittest.main()
