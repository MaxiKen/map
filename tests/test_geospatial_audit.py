"""Lightweight regression tests for the geospatial audit methods and evidence."""
import csv
import json
import sys
import unittest
from pathlib import Path

from shapely.geometry import Point, box
from shapely import wkb

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))

from audit_geospatial import gpkg_geometry, layer_index, shapely_metric  # noqa: E402
from audit_geospatial_extended import admin_name_equivalent, values_inside  # noqa: E402
import numpy as np  # noqa: E402


class GeospatialAuditMethodTests(unittest.TestCase):
    def test_gpkg_point_decoder_preserves_full_precision(self):
        # Empty-envelope GeoPackage header, followed by little-endian WKB.
        blob = b'GP' + bytes([0, 0, 0, 0, 0, 0]) + wkb.dumps(
            Point(7.123456789012, 13.987654321098), byte_order=1)
        geometry = gpkg_geometry(blob)
        self.assertAlmostEqual(geometry.x, 7.123456789012, places=12)
        self.assertAlmostEqual(geometry.y, 13.987654321098, places=12)

    def test_metric_distance_is_not_a_degree_approximation(self):
        distance = shapely_metric(Point(3, 6)).distance(shapely_metric(Point(3.01, 6)))
        self.assertGreater(distance, 1000)
        self.assertLess(distance, 1200)

    def test_raster_sampling_uses_north_up_cell_centres(self):
        array = np.array([[1, 2], [3, 4]], dtype='f4')
        # Includes only the western cell centres; northern value is 1, southern is 3.
        values = values_inside(array, (0, 0, 2, 2), -9999, box(0, 0, 0.6, 1.6), step=1)
        self.assertEqual(sorted(values.tolist()), [1, 3])

    def test_name_variants_do_not_hide_reciprocal_lga_conflict(self):
        self.assertTrue(admin_name_equivalent('Aiyedade', 'Ayedaade'))
        self.assertTrue(admin_name_equivalent('Calabar', 'Calabar Municipal'))
        self.assertFalse(admin_name_equivalent('Gada', 'Illela'))
        self.assertFalse(admin_name_equivalent('Kaduna North', 'Igabi'))


class GeospatialAuditEvidenceTests(unittest.TestCase):
    def test_layer_review_covers_every_visible_and_hidden_layer(self):
        with (ROOT / 'docs/geospatial-audit/layer-review.csv').open(encoding='utf8') as handle:
            rows = list(csv.DictReader(handle))
        index = layer_index()
        self.assertEqual(len(rows), len(index))
        self.assertEqual({r['layer'] for r in rows}, set(index))
        self.assertEqual(sum(r['visibility'] == 'visible' for r in rows),
                         sum(meta['visible'] for meta in index.values()))
        self.assertEqual(sum(r['visibility'] == 'hidden' for r in rows),
                         sum(not meta['visible'] for meta in index.values()))

    def test_capital_report_separates_construction_from_held_out_validation(self):
        evidence = json.loads((ROOT / 'docs/geospatial-audit/extended-audit.json').read_text(
            encoding='utf8'))['capital_cross_source']
        self.assertEqual(evidence['correction']['corrected_with_osm'], 32)
        self.assertEqual(evidence['correction']['retained_corroborated_gazetteer'], 5)
        self.assertIn('Construction/self-consistency',
                      evidence['summary']['osm']['validation_role'])
        strict = evidence['summary']['diva']['strict_held_out']
        self.assertEqual(strict['eligible_capitals'], 30)
        self.assertEqual(set(strict['selection_informed_exclusions']), {
            'Umuahia', 'Yola', 'Abakaliki', 'Ado-Ekiti', 'Katsina', 'Gusau'})
        self.assertLess(strict['maximum_distance_km'], 5.273)


if __name__ == '__main__':
    unittest.main()
