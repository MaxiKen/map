"""Regression tests for the versioned cross-border geographic data policy."""
import csv
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))

import cross_border_policy as policy  # noqa: E402
from audit_geospatial import layer_index  # noqa: E402


class CrossBorderPolicyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.policy = policy.load_policy()
        cls.index = layer_index()
        cls.audit = json.loads((ROOT / 'docs/geospatial-audit/audit.json').read_text(
            encoding='utf8'))
        cls.extended = json.loads((ROOT / 'docs/geospatial-audit/extended-audit.json').read_text(
            encoding='utf8'))
        cls.catalog = json.loads((ROOT / 'public/catalog.json').read_text(encoding='utf8'))

    def test_policy_is_valid_and_covers_exact_source_inventory(self):
        policy.validate_inventory(self.index, self.policy)
        summary = policy.policy_summary(self.index, self.policy)
        self.assertEqual(summary['policy_id'], 'ngmap-cross-border-v1')
        self.assertEqual(summary['layer_count'], len(self.index))
        self.assertEqual(summary['visible_layer_count'],
                         sum(meta['visible'] for meta in self.index.values()))
        self.assertEqual(summary['hidden_layer_count'],
                         sum(not meta['visible'] for meta in self.index.values()))
        self.assertEqual(sum(summary['class_counts'].values()), len(self.index))
        self.assertTrue(summary['all_sources_preserved_unclipped'])
        self.assertEqual(summary['source_geometry_changes'], 0)

    def test_representative_scope_and_aggregation_rules(self):
        expected = {
            'admin_states_gadm_pg': ('nigeria_focused', 'explicit_nigeria_filter_required'),
            'settlements_places_osm_pt': ('nigeria_with_context', 'explicit_nigeria_filter_required'),
            'groundwater_transboundary_igrac2025_pg': (
                'transboundary_system', 'separate_whole_system_and_nigeria_portion'),
            'groundwater_units_ecowas2022_pg': ('regional_reference', 'not_a_nigeria_total'),
            'geology_map2011_img': (
                'map_sheet', 'exclude_foreign_sheet_content_and_clip_measurements'),
            'population_worldpop2025_rst': ('raster_window', 'use_aoi_and_valid_data_mask'),
        }
        for table, (scope_class, national_rule) in expected.items():
            with self.subTest(table=table):
                rule = policy.resolve_layer(
                    table, visible=self.index[table]['visible'],
                    kind=self.index[table]['kind'], policy=self.policy)
                self.assertEqual(rule['scope_class'], scope_class)
                self.assertEqual(rule['national_statistics'], national_rule)
                self.assertEqual(rule['source_retention'], 'preserve_unclipped')

    def test_hidden_sources_and_provenance_have_distinct_publication_rules(self):
        original = policy.resolve_layer(
            'geology_units_map2011_pg_topology_original', visible=False, kind='features')
        self.assertEqual(original['scope_class'], 'transboundary_system')
        self.assertEqual(original['publication'], 'hidden_provenance')
        self.assertEqual(original['provenance_of'], 'geology_units_map2011_pg')

        identity = policy.resolve_layer(
            'admin_lgas_gadm_identity_original_pg', visible=False, kind='features')
        self.assertEqual(identity['scope_class'], 'nigeria_focused')
        self.assertEqual(identity['provenance_of'], 'admin_lgas_gadm_pg')
        self.assertEqual(identity['publication'], 'hidden_provenance')

        hidden = policy.resolve_layer(
            'reference_graticule_map2011_ln', visible=False, kind='features')
        self.assertEqual(hidden['scope_class'], 'map_sheet')
        self.assertEqual(hidden['publication'], 'hidden_source')
        self.assertNotIn('provenance_of', hidden)

        visible = policy.resolve_layer(
            'groundwater_transboundary_igrac2025_pg', visible=True, kind='features')
        self.assertEqual(visible['publication'], 'full_layer')

    def test_generated_register_matches_every_resolved_source_rule(self):
        path = ROOT / 'docs/geospatial-audit/cross-border-policy-register.csv'
        with path.open(encoding='utf8', newline='') as handle:
            actual = list(csv.DictReader(handle))
        expected = [
            {key: str(value) for key, value in row.items()}
            for row in policy.register_rows(self.index, self.policy)
        ]
        self.assertEqual(actual, expected)
        self.assertEqual(len(actual), len(self.index))
        self.assertTrue(all(row['source_retention'] == 'preserve_unclipped' for row in actual))

    def test_refreshed_audits_and_report_propagate_current_policy(self):
        summary = policy.policy_summary(self.index, self.policy)
        self.assertEqual(self.audit['cross_border_policy'], summary)
        self.assertEqual(self.extended['cross_border_policy'], summary)
        for table, meta in self.index.items():
            collection = self.audit['vectors'] if meta['kind'] == 'features' else self.audit['rasters']
            expected = policy.resolve_layer(
                table, visible=meta['visible'], kind=meta['kind'], policy=self.policy)
            self.assertEqual(collection[table]['cross_border_policy'], expected)
        report = (ROOT / 'docs/geospatial-audit/README.md').read_text(encoding='utf8')
        self.assertIn('7. **A cross-border data policy governs all 98 spatial layers.**', report)
        self.assertIn('No source geometry was clipped, moved or deleted for this policy.', report)
        self.assertIn('not an automatic country filter', report)
        self.assertIn('not legal sovereignty', report)

    def test_public_catalog_matches_policy_for_every_published_layer(self):
        self.assertEqual(self.catalog['crossBorderPolicy'], policy.catalog_policy(self.policy))
        visible = {table for table, meta in self.index.items() if meta['visible']}
        self.assertEqual({layer['table'] for layer in self.catalog['layers']}, visible)
        for layer in self.catalog['layers']:
            table = layer['table']
            meta = self.index[table]
            expected = policy.public_metadata(policy.resolve_layer(
                table, visible=True, kind=meta['kind'], policy=self.policy))
            self.assertEqual(layer['crossBorder'], expected)
            self.assertEqual(layer['crossBorder']['sourceRetention'], 'preserve_unclipped')

    def test_stale_overrides_and_unknown_classes_are_rejected(self):
        stale = copy.deepcopy(self.policy)
        stale.pop('_path')
        stale.pop('_sha256')
        stale['layers']['retired_layer_pg'] = {'scope_class': 'nigeria_focused'}
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'policy.json'
            path.write_text(json.dumps(stale), encoding='utf8')
            loaded = policy.load_policy(path)
            with self.assertRaisesRegex(ValueError, 'stale layer overrides'):
                policy.validate_inventory(self.index, loaded)

        invalid = copy.deepcopy(stale)
        invalid['layers'].pop('retired_layer_pg')
        invalid['layers']['admin_states_gadm_pg'] = {'scope_class': 'invented_scope'}
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'invalid.json'
            path.write_text(json.dumps(invalid), encoding='utf8')
            with self.assertRaisesRegex(ValueError, 'unknown scope_class'):
                policy.load_policy(path)


if __name__ == '__main__':
    unittest.main()
