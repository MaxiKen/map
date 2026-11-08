"""Regression evidence for transparent EMAG2 partial-coverage classification."""
import csv
import hashlib
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/geospatial-audit'
sys.path.insert(0, str(ROOT / 'scripts'))

from reclassify_magnetic_coverage import (  # noqa: E402
    CONFIG, LABEL, PNG, RESULT, SOURCE, STATE_CSV, TABLE, VALUES, VERIFICATION,
    source_evidence,
)


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


class MagneticCoverageReclassificationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = json.loads(RESULT.read_text(encoding='utf8'))
        cls.verification = json.loads(VERIFICATION.read_text(encoding='utf8'))
        cls.current = source_evidence(SOURCE)

    def test_guarded_result_and_source_catalog_metadata(self):
        self.assertEqual(self.result['status'], 'reclassified_and_verified')
        self.assertEqual(self.result['classification'], 'partial_coverage_no_interpolation')
        self.assertTrue(all(self.result['checks'].values()))
        self.assertTrue(all(self.verification['checks'].values()))
        self.assertEqual(sha256(SOURCE), self.result['after_sha256'])
        self.assertNotEqual(self.result['before_sha256'], self.result['after_sha256'])
        self.assertEqual(sha256(VERIFICATION), self.result['verification_sha256'])
        self.assertEqual(self.result['staged_verification']['changed_contents_fields'],
                         ['description', 'last_change'])
        description = self.current['contents']['description']
        self.assertEqual(description, self.result['after_description'])
        self.assertTrue(description.startswith('PARTIAL NIGERIA COVERAGE: 90.2%'))
        self.assertIn('Missing areas remain NoData', description)
        self.assertIn('no interpolation or magnetic infilling', description)
        self.assertIn('not continuous national coverage', description)
        self.assertNotIn('PARTIAL NIGERIA COVERAGE', self.result['before_description'])
        config = json.loads(CONFIG.read_text(encoding='utf8'))
        self.assertEqual(config['layers'][TABLE]['label'], LABEL)
        catalog = json.loads((ROOT / 'public/catalog.json').read_text(encoding='utf8'))
        layer = next(row for row in catalog['layers'] if row['id'] == TABLE)
        self.assertEqual(layer['label'], LABEL)
        self.assertEqual(layer['description'], description)

    def test_tile_array_other_tables_and_public_assets_are_unchanged(self):
        self.assertEqual(self.current['tiles']['sha256'], self.result['tile_sha256'])
        self.assertEqual(self.current['tiles']['rows'], self.result['tile_rows'])
        self.assertEqual(self.current['array_sha256'], self.result['array_sha256'])
        self.assertEqual(self.current['non_contents_sha256'], self.result['non_contents_sha256'])
        self.assertEqual(self.current['coverage'], self.result['coverage'])
        self.assertEqual(self.current['integrity_check'], 'ok')
        self.assertEqual(sha256(PNG), self.result['public_assets_before']['png_sha256'])
        self.assertEqual(sha256(VALUES), self.result['public_assets_before']['values_sha256'])
        self.assertFalse((OUT / 'magnetic-coverage-install-journal.json').exists())
        self.assertFalse(SOURCE.with_name(SOURCE.name + '.reclassifying.gpkg').exists())

    def test_coverage_measurements_and_state_register(self):
        coverage = self.current['coverage']
        self.assertEqual(coverage['grid']['width'], 500)
        self.assertEqual(coverage['grid']['height'], 400)
        self.assertEqual(coverage['grid']['cells'], 200000)
        self.assertEqual(coverage['grid']['valid_cells'], 109484)
        self.assertEqual(coverage['grid']['nodata_cells'], 90516)
        self.assertEqual(coverage['full_cell_land']['cells'], 119116)
        self.assertEqual(coverage['full_cell_land']['valid_cells'], 107357)
        self.assertAlmostEqual(coverage['full_cell_land']['valid_fraction'], 0.9012811041337856)
        self.assertEqual(coverage['sampled_land']['stride_cells'], 2)
        self.assertEqual(coverage['sampled_land']['cells'], 29789)
        self.assertEqual(coverage['sampled_land']['valid_cells'], 26871)
        self.assertAlmostEqual(coverage['sampled_land']['valid_fraction'], 0.9020443787975427)
        states = {row['state']: row for row in coverage['states']}
        self.assertEqual(len(states), 38)  # 37 administrative areas plus Water body
        self.assertEqual(states['Ekiti']['valid_fraction'], 0)
        for name, expected in (('Osun', 0.05587989991659716),
                               ('Oyo', 0.30442035029190995),
                               ('Sokoto', 0.40212264150943394)):
            self.assertAlmostEqual(states[name]['valid_fraction'], expected)
        with STATE_CSV.open(encoding='utf8', newline='') as handle:
            published = {row['state']: float(row['valid_fraction'])
                         for row in csv.DictReader(handle)}
        self.assertEqual(set(published), set(states))
        for name, row in states.items():
            self.assertAlmostEqual(published[name], row['valid_fraction'])
        report = (OUT / 'magnetic-coverage-reclassification.md').read_text(encoding='utf8')
        self.assertIn('applied and verified', report)
        self.assertIn('90.1% full-cell and 90.2% sampled', report)
        self.assertIn('| Ekiti | 697 | 0 | 0.0% |', report)

    def test_future_fetch_has_a_completeness_gate(self):
        source = (ROOT / 'scripts/fetch_geology_layers.py').read_text(encoding='utf8')
        self.assertIn('land = nigeria_mask(a.shape[1], a.shape[0])', source)
        self.assertIn('land_coverage = float(valid[land].mean())', source)
        self.assertIn('if land_coverage < 0.98:', source)
        self.assertIn('refusing to publish an', source)
        self.assertIn('Do not interpolate missing magnetic values.', source)

    def test_refreshed_audit_discloses_scope_without_claiming_repair(self):
        extended = json.loads((OUT / 'extended-audit.json').read_text(encoding='utf8'))
        recorded = extended['magnetic_coverage_reclassification']
        self.assertEqual(recorded['after_sha256'], self.result['after_sha256'])
        self.assertEqual(recorded['array_sha256'], self.result['array_sha256'])
        with (OUT / 'layer-review.csv').open(encoding='utf8', newline='') as handle:
            review = {row['layer']: row for row in csv.DictReader(handle)}[TABLE]
        self.assertEqual(review['disposition'], 'Scope limitation disclosed')
        self.assertIn('partial valid-cell coverage (90.2%', review['review_findings'])
        self.assertIn('do not interpolate', review['recommended_action'])
        self.assertIn('98% land-coverage gate', review['recommended_action'])
        self.assertIn('tile bytes, logical array and public assets unchanged', review['evidence'])
        report = (OUT / 'README.md').read_text(encoding='utf8')
        self.assertIn('B2 — Disclosed scope limitation: EMAG2 partial coverage', report)
        self.assertIn('transparently classified as partial coverage', report)
        self.assertIn('90.1%', report)
        self.assertIn('NoData must not be interpreted as zero nanoTesla', report)
        self.assertNotIn('B2 — Medium: EMAG2 coverage is incomplete', report)
        self.assertIn('magnetic partial-coverage disclosure are complete', report)


if __name__ == '__main__':
    unittest.main()
