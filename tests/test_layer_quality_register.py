"""Regression tests for the complete layer quality and metadata register."""
import copy
import csv
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))

import layer_quality_register as register  # noqa: E402
from audit_geospatial import layer_index  # noqa: E402
from audit_geospatial_extended import layer_quality_is_current  # noqa: E402
from layer_quality_public import (  # noqa: E402
    catalog_summary, public_quality, public_source_metadata,
)


class LayerQualityRegisterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.index = layer_index()
        cls.metadata = register.load_metadata()
        cls.audit = json.loads((ROOT / 'docs/geospatial-audit/audit.json').read_text(
            encoding='utf8'))
        cls.extended = json.loads((ROOT / 'docs/geospatial-audit/extended-audit.json').read_text(
            encoding='utf8'))
        cls.catalog = json.loads((ROOT / 'public/catalog.json').read_text(encoding='utf8'))
        cls.document = json.loads((ROOT / 'docs/geospatial-audit/layer-quality-register.json').read_text(
            encoding='utf8'))
        cls.rows = {row['layer']: row for row in cls.document['layers']}
        with (ROOT / 'docs/geospatial-audit/layer-review.csv').open(
                encoding='utf8', newline='') as handle:
            cls.reviews = list(csv.DictReader(handle))

    def test_metadata_sources_cover_exact_active_inventory_and_provenance(self):
        register.validate_inventory(self.index, self.metadata)
        active = {table for table in self.index if not register.provenance_base(table)}
        self.assertEqual(set(self.metadata['layers']), active)
        self.assertEqual(len(active), 79)
        self.assertEqual(sum(bool(register.provenance_base(table)) for table in self.index), 19)
        self.assertEqual(len(self.metadata['sources']), 42)
        for key, source in self.metadata['sources'].items():
            self.assertTrue((ROOT / source['metadata_reference']).is_file(), key)
            if source['licence_status'] == 'not_recorded':
                self.assertEqual(source['licence_or_terms'], '')

    def test_complete_json_rows_and_summary_match_source_and_audit_evidence(self):
        expected = register.build_rows(
            self.index, self.audit, self.catalog, self.reviews, self.metadata)
        self.assertEqual(self.document['layers'], expected)
        self.assertEqual(self.document['summary'], register.summarise(
            expected, self.metadata, self.audit))
        self.assertEqual(self.document['cross_border_policy'], self.extended['cross_border_policy'])
        self.assertEqual(self.document['methodology']['quality_score'], 'not_assigned')
        self.assertEqual(self.document['summary']['layer_count'], 98)
        self.assertEqual(self.document['summary']['published_layer_count'], 59)
        self.assertEqual(self.document['summary']['structural_status_counts'], {
            'historical_defects_retained': 16, 'structural_pass': 82,
        })

    def test_every_source_hash_is_current_and_hidden_layers_stay_unpublished(self):
        published = {row['table'] for row in self.catalog['layers']}
        for table, row in self.rows.items():
            path = self.index[table]['path']
            self.assertEqual(row['source_sha256'], hashlib.sha256(path.read_bytes()).hexdigest())
            self.assertEqual(row['crs'], 'EPSG:4326')
            self.assertEqual(row['published'], table in published)
            if row['visibility'] == 'hidden':
                self.assertFalse(row['published'])
                self.assertNotIn(table, published)

    def test_quality_classes_preserve_limitations_and_review_actions(self):
        self.assertEqual(self.rows['admin_states_gadm_pg']['quality_use_class'],
                         'current_structural_pass')
        self.assertEqual(self.rows['admin_wards_pt']['quality_use_class'],
                         'current_with_documented_limits')
        self.assertIn('37 individually reviewed',
                      self.rows['admin_wards_pt']['review_findings'])
        magnetic = self.rows['geophysics_magnetic_emag2_rst']
        self.assertEqual(magnetic['coverage_status'], 'partial_coverage')
        self.assertEqual(magnetic['review_status'], 'Scope limitation disclosed')
        boreholes = self.rows['groundwater_boreholes_wpdx_pt']
        self.assertEqual(boreholes['quality_use_class'], 'review_required')
        self.assertIn('314 LGA-name joins', boreholes['review_findings'])
        original = self.rows['geology_units_map2011_pg_topology_original']
        self.assertEqual(original['quality_use_class'], 'hidden_historical_provenance')
        self.assertEqual(original['structural_status'], 'historical_defects_retained')
        self.assertEqual(original['topology_status'], 'historical_invalid')

    def test_metadata_completeness_does_not_invent_missing_values(self):
        gadm = self.rows['admin_states_gadm_pg']
        self.assertEqual(gadm['licence_status'], 'not_recorded')
        self.assertIn('licence_or_terms', gadm['metadata_gaps'])
        self.assertIn('temporal_coverage', gadm['metadata_gaps'])
        osm = self.rows['forest_osm_pg']
        self.assertEqual(osm['licence_or_terms'], 'ODbL 1.0')
        self.assertIn('temporal_coverage', osm['metadata_gaps'])
        fan = self.rows['groundwater_water_table_fan2017_rst']
        self.assertEqual(fan['temporal_coverage'], '')
        self.assertIn('temporal_coverage', fan['metadata_gaps'])
        self.assertIn('2017 publication', fan['metadata_notes'])
        for row in self.rows.values():
            self.assertNotRegex(row['temporal_coverage'].lower(),
                                r'not (?:pinned|recorded|stated)')
        igrac = self.rows['groundwater_transboundary_igrac2025_pg']
        self.assertEqual(igrac['metadata_status'], 'documented')
        self.assertEqual(igrac['metadata_fields_recorded'], 6)
        self.assertEqual(igrac['licence_or_terms'], 'CC BY-SA 3.0 IGO')
        self.assertEqual(igrac['temporal_coverage'], '2025 edition')
        self.assertEqual(self.document['summary']['metadata_status_counts'], {
            'documented': 12, 'minimal': 19, 'partial': 67,
        })
        self.assertEqual(self.document['summary']['layers_with_metadata_gaps'], 86)

    def test_csv_and_markdown_cover_every_layer(self):
        with (ROOT / 'docs/geospatial-audit/layer-quality-register.csv').open(
                encoding='utf8', newline='') as handle:
            csv_rows = list(csv.DictReader(handle))
        self.assertEqual(len(csv_rows), 98)
        self.assertEqual({row['layer'] for row in csv_rows}, set(self.index))
        markdown = (ROOT / 'docs/geospatial-audit/layer-quality-register.md').read_text(
            encoding='utf8')
        for table in self.index:
            self.assertIn(f'| `{table}` |', markdown)
        self.assertIn('does not assign a numeric accuracy score', markdown)
        self.assertIn('Missing licence/version/publisher fields are not inferred', markdown)

    def test_public_catalog_is_exact_compact_projection_of_register(self):
        self.assertEqual(self.catalog['layerQualityRegister'], catalog_summary(self.document))
        for layer in self.catalog['layers']:
            row = self.rows[layer['table']]
            self.assertEqual(layer['quality'], public_quality(row))
            self.assertEqual(layer['sourceMetadata'], public_source_metadata(row))
            self.assertEqual(layer['quality']['sourceSha256'], row['source_sha256'])

    def test_refreshed_extended_report_and_register_freshness(self):
        self.assertEqual(self.extended['layer_quality_register'], self.document['summary'])
        self.assertTrue(layer_quality_is_current(self.document, self.audit))
        for field in ('source_commit', 'audit_generated_utc', 'metadata_config_sha256',
                      'cross_border_policy_sha256'):
            stale = copy.deepcopy(self.document)
            stale['summary'][field] = 'stale'
            self.assertFalse(layer_quality_is_current(stale, self.audit), field)
        report = (ROOT / 'docs/geospatial-audit/README.md').read_text(encoding='utf8')
        self.assertIn('8. **A layer quality and metadata register covers all 98 layers.**', report)
        self.assertIn('One WPDx layer still requires source-vintage name-join review.', report)
        self.assertIn('86 layers have explicit source-metadata gaps', report)
        self.assertIn('metadata completeness is not licence clearance', report)

    def test_stale_or_unknown_metadata_mappings_are_rejected(self):
        stale = copy.deepcopy(self.metadata)
        stale.pop('_path')
        stale.pop('_sha256')
        stale['layers']['retired_layer_pg'] = 'gadm'
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'metadata.json'
            path.write_text(json.dumps(stale), encoding='utf8')
            loaded = register.load_metadata(path)
            with self.assertRaisesRegex(ValueError, 'inventory mismatch'):
                register.validate_inventory(self.index, loaded)

        invalid = copy.deepcopy(stale)
        invalid['layers'].pop('retired_layer_pg')
        invalid['layers']['admin_states_gadm_pg'] = 'unknown_source'
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'invalid.json'
            path.write_text(json.dumps(invalid), encoding='utf8')
            with self.assertRaisesRegex(ValueError, 'unknown source'):
                register.load_metadata(path)


if __name__ == '__main__':
    unittest.main()
