"""Regression evidence for the 40-case residual ward/LGA review."""
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
from correct_residual_ward_lgas import all_geometry_digest, all_ward_rows  # noqa: E402
from shapely import STRtree  # noqa: E402


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def rows(name):
    with (OUT / name).open(encoding='utf8', newline='') as handle:
        return list(csv.DictReader(handle))


class ResidualWardLgaCorrectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ledger = rows('ward-lga-review-ledger.csv')
        cls.baseline = rows('ward-lga-exceptions-before-residual-review.csv')
        cls.current_exceptions = rows('ward-lga-exceptions.csv')
        cls.verification = json.loads((OUT / 'ward-lga-review-verification.json').read_text())
        cls.result = json.loads((OUT / 'ward-lga-correction-result.json').read_text())
        cls.path = layer_index()['admin_wards_pt']['path']
        cls.wards = all_ward_rows(cls.path)
        cls.by_fid = {row['fid']: row for row in cls.wards}

    def test_review_inventory_sources_and_dispositions(self):
        self.assertEqual(len(self.ledger), 40)
        self.assertEqual(len(self.baseline), 40)
        self.assertEqual(len(self.current_exceptions), 37)
        self.assertEqual(len({row['state'] for row in self.ledger}), 20)
        self.assertEqual(len({row['official_source_url'] for row in self.ledger}), 20)
        self.assertEqual(len({row['independent_query_url'] for row in self.ledger}), 40)
        self.assertEqual(Counter(row['disposition'] for row in self.ledger), Counter({
            'correct_lga': 3,
            'retain_boundary_generalisation': 20,
            'retain_coastal_water': 14,
            'retain_suspect_coordinate': 2,
            'retain_delimitation_uncertainty': 1,
        }))
        self.assertEqual(sum(not row['local_containing_state_lga'] for row in self.ledger), 15)
        self.assertEqual({int(row['feature_index']) for row in self.ledger
                          if not row['independent_lga']}, {2007, 8447})
        self.assertTrue(all(self.verification['checks'].values()))
        self.assertTrue(all(self.result['checks'].values()))
        self.assertEqual(self.result['status'], 'applied_and_verified')
        self.assertEqual(self.result['counts']['ward_geometries_changed'], 0)
        self.assertEqual(self.result['staged_verification']['untargeted_features_verified'], 8806)
        self.assertEqual(sha256(OUT / 'ward-lga-review-ledger.csv'), self.result['ledger_sha256'])
        self.assertEqual(sha256(OUT / 'ward-lga-review-verification.json'),
                         self.result['verification_sha256'])
        self.assertEqual(sha256(OUT / 'ward-lga-exceptions-before-residual-review.csv'),
                         self.result['baseline_sha256'])
        self.assertEqual(sha256(self.path), self.result['after_sha256'])

    def test_all_40_before_after_attributes_fids_and_geometry_hashes(self):
        self.assertEqual(len(self.wards), 8809)
        self.assertEqual(all_geometry_digest(self.wards), self.result['all_ward_geometry_sha256'])
        for evidence in self.ledger:
            index = int(evidence['feature_index'])
            fid = int(evidence['fid'])
            self.assertEqual(fid, index + 1)
            ward = self.by_fid[fid]
            self.assertIs(self.wards[index], ward)
            before = json.loads(evidence['before_attributes_json'])
            after = json.loads(evidence['after_attributes_json'])
            self.assertEqual(ward['ward'], before['ward'])
            self.assertEqual(ward['ward'], after['ward'])
            self.assertEqual(ward['state'], before['state'])
            self.assertEqual(evidence['source_sha256'], self.result['before_sha256'])
            for column, expected in after.items():
                self.assertEqual(ward[column], expected, f'FID {fid} {column}')
            geometry_hash = hashlib.sha256(ward['geom']).hexdigest()
            self.assertEqual(geometry_hash, evidence['before_geometry_sha256'])
            self.assertEqual(geometry_hash, evidence['after_geometry_sha256'])
            if evidence['disposition'] != 'correct_lga':
                self.assertEqual(before, after)
                self.assertEqual(ward['lga'], evidence['assigned_lga_before'])

    def test_only_three_evidence_backed_lga_changes_and_local_containment(self):
        expected = {
            4096: ('Kwarau', 'Kaduna North', 'Igabi', 17.8, 25.5),
            4215: ('Gidan Waya', 'Sanga', "Jema'a", 19.6, 23.4),
            7295: ('Ward XI E9 I', 'Ibadan South East', 'Ibadan North East', 7.8, 0.9),
        }
        changed = {int(row['fid']): row for row in self.ledger
                   if row['disposition'] == 'correct_lga'}
        self.assertEqual(set(changed), set(expected))
        polygons = []
        polygon_path = layer_index()['admin_lgas_gadm_pg']['path']
        with sqlite3.connect(f'file:{polygon_path}?mode=ro', uri=True) as con:
            con.row_factory = sqlite3.Row
            for row in con.execute('select * from admin_lgas_gadm_pg order by fid'):
                item = dict(row)
                polygons.append((item, gpkg_geometry(item['geom'])))
        tree = STRtree([geometry for _, geometry in polygons])
        for fid, (name, old_lga, new_lga, old_distance, new_distance) in expected.items():
            evidence = changed[fid]
            before = json.loads(evidence['before_attributes_json'])
            self.assertEqual((before['lga'], before['dist_to_lga_centroid_km']),
                             (old_lga, old_distance))
            ward = self.by_fid[fid]
            self.assertEqual((ward['ward'], ward['lga'], ward['dist_to_lga_centroid_km']),
                             (name, new_lga, new_distance))
            point = gpkg_geometry(ward['geom'])
            containers = [polygons[int(i)][0] for i in tree.query(point, predicate='intersects')]
            self.assertTrue(any(row['state'] == ward['state'] and row['lga'] == new_lga
                                for row in containers))
        self.assertEqual(self.result['post_correction']['residual_exception_count'], 37)
        self.assertEqual(self.result['post_correction']['residual_within_1km'], 32)
        self.assertEqual(self.result['post_correction']['residual_over_10km'], 0)
        self.assertEqual(self.result['post_correction']['residual_without_local_container'], 15)

    def test_refreshed_exception_register_is_exactly_the_37_retentions(self):
        retained = {int(row['feature_index']) for row in self.ledger
                    if row['disposition'] != 'correct_lga'}
        current = {int(row['feature_index']) for row in self.current_exceptions}
        self.assertEqual(current, retained)
        self.assertNotIn(4095, current)
        self.assertNotIn(4214, current)
        self.assertNotIn(7294, current)
        self.assertIn(1184, current)  # suspect Gambaki/Bidir coordinate retained
        self.assertIn(2821, current)  # suspect Ilasa coordinate retained
        self.assertIn(8447, current)  # Kwambai uncertainty retained
        self.assertIn(8149, current)  # Darna/Sabon Gari unchanged
        self.assertEqual(self.result['post_correction']['residual_feature_indices'],
                         [int(row['feature_index']) for row in self.current_exceptions])

    def test_public_export_and_refreshed_audit_evidence(self):
        public = json.loads((ROOT / 'public/data/admin_wards_pt.geojson').read_text())['features']
        self.assertEqual(len(public), 8809)
        by_name = {(feature['properties']['state'], feature['properties']['ward']): feature
                   for feature in public}
        for fid in (4096, 4215, 7295):
            ward = self.by_fid[fid]
            feature = by_name[(ward['state'], ward['ward'])]
            self.assertEqual(feature['properties']['lga'], ward['lga'])
            self.assertEqual(feature['properties']['dist_to_lga_centroid_km'],
                             ward['dist_to_lga_centroid_km'])
            point = gpkg_geometry(ward['geom'])
            self.assertEqual(feature['geometry']['coordinates'], [round(point.x, 5), round(point.y, 5)])
        extended = json.loads((OUT / 'extended-audit.json').read_text())
        summary = extended['ward_exceptions']
        self.assertTrue(summary['individual_review_complete'])
        self.assertEqual(summary['pre_review_exception_count'], 40)
        self.assertEqual(summary['total_outside_assigned_lga'], 37)
        self.assertEqual(summary['without_local_container'], 15)
        self.assertEqual(summary['review_lga_corrections'], 3)
        self.assertEqual(extended['residual_ward_lga_correction']['after_sha256'],
                         self.result['after_sha256'])
        review = {row['layer']: row for row in rows('layer-review.csv')}
        self.assertEqual(review['admin_wards_pt']['disposition'], 'Reviewed with exceptions')
        report = (OUT / 'README.md').read_text()
        self.assertIn('A3 — Resolved with provenance: residual ward/LGA exception review', report)
        self.assertIn('Three true LGA attribute errors', report)
        self.assertIn('All 8,809', report)
        self.assertTrue((OUT / 'references/ward-lga-review-sources.md').is_file())


if __name__ == '__main__':
    unittest.main()
