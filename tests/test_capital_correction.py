"""Regression checks for the reviewed state-capital correction workflow."""
import csv
import hashlib
import json
import sqlite3
import struct
import sys
import unittest
from pathlib import Path

from shapely.geometry import Point

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))

from audit_geospatial import gpkg_geometry, layer_index  # noqa: E402
from correct_state_capitals import (  # noqa: E402
    HIDDEN, HIDDEN_TABLE, LEDGER, RESULT, TABLE, VISIBLE, gpkg_point,
)


class CapitalCorrectionTests(unittest.TestCase):
    def test_gpkg_point_roundtrip_preserves_srs_envelope_and_coordinates(self):
        point = Point(7.123456789012, 13.987654321098)
        blob = gpkg_point(point)
        self.assertEqual(blob[:2], b'GP')
        self.assertEqual(blob[2], 0)
        self.assertEqual(blob[3], 3)  # little-endian, 32-byte XY envelope
        self.assertEqual(struct.unpack_from('<i', blob, 4)[0], 4326)
        self.assertEqual(struct.unpack_from('<4d', blob, 8), (
            point.x, point.x, point.y, point.y))
        decoded = gpkg_geometry(blob)
        self.assertAlmostEqual(decoded.x, point.x, places=12)
        self.assertAlmostEqual(decoded.y, point.y, places=12)

    def test_ledger_has_one_reviewed_row_per_capital(self):
        with LEDGER.open(encoding='utf8') as handle:
            rows = list(csv.DictReader(handle))
        self.assertEqual(len(rows), 37)
        self.assertEqual(len({row['capital'] for row in rows}), 37)
        self.assertEqual(sum(row['action'] == 'replace_with_osm_city_or_town'
                             for row in rows), 32)
        self.assertEqual(sum(row['action'] == 'retain_corroborated_gazetteer'
                             for row in rows), 5)
        self.assertTrue(all(row['state_containment_passed'] == 'True' for row in rows))
        self.assertEqual({row['capital'] for row in rows if row['review_required'] == 'True'},
                         {'Yola', 'Asaba', 'Abuja', 'Lokoja'})
        self.assertEqual(len({row['source_sha256'] for row in rows}), 1)

    def test_visible_layer_and_hidden_original_match_the_ledger_and_hashes(self):
        with LEDGER.open(encoding='utf8') as handle:
            rows = list(csv.DictReader(handle))
        result = json.loads(RESULT.read_text(encoding='utf8'))
        digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
        admin_path = ROOT / 'docs/geospatial-audit/admin-identifier-result.json'
        if admin_path.exists():
            admin = json.loads(admin_path.read_text(encoding='utf8'))
            self.assertEqual(admin['before_sha256'][TABLE], result['visible_sha256'])
            self.assertEqual(digest(VISIBLE), admin['after_sha256'][TABLE])
        else:
            self.assertEqual(digest(VISIBLE), result['visible_sha256'])
        self.assertEqual(digest(HIDDEN), result['hidden_sha256'])
        index = layer_index()
        self.assertTrue(index[TABLE]['visible'])
        self.assertFalse(index[HIDDEN_TABLE]['visible'])
        with sqlite3.connect(VISIBLE) as visible, sqlite3.connect(HIDDEN) as hidden:
            self.assertEqual(visible.execute('pragma integrity_check').fetchone()[0], 'ok')
            self.assertEqual(hidden.execute('pragma integrity_check').fetchone()[0], 'ok')
            original = {fid: gpkg_geometry(blob) for fid, blob in hidden.execute(
                f'select fid,geom from {HIDDEN_TABLE}')}
            self.assertEqual(len(original), 37)
            for row in rows:
                fid = int(row['fid'])
                blob, previous_x, previous_y = visible.execute(
                    f'select geom,previous_longitude,previous_latitude from {TABLE} where fid=?',
                    (fid,)).fetchone()
                current = gpkg_geometry(blob)
                self.assertAlmostEqual(current.x, float(row['new_longitude']), places=12)
                self.assertAlmostEqual(current.y, float(row['new_latitude']), places=12)
                self.assertAlmostEqual(original[fid].x, float(row['previous_longitude']), places=12)
                self.assertAlmostEqual(original[fid].y, float(row['previous_latitude']), places=12)
                self.assertAlmostEqual(previous_x, original[fid].x, places=12)
                self.assertAlmostEqual(previous_y, original[fid].y, places=12)

    def test_yola_uses_the_diva_corroborated_osm_town_not_the_other_city_node(self):
        with LEDGER.open(encoding='utf8') as handle:
            row = next(row for row in csv.DictReader(handle) if row['capital'] == 'Yola')
        self.assertEqual(row['osm_place'], 'town')
        self.assertAlmostEqual(float(row['new_longitude']), 12.483333, places=6)
        self.assertAlmostEqual(float(row['new_latitude']), 9.2, places=6)
        self.assertLess(float(row['diva_crosscheck_km']), 0.01)
        self.assertIn('northern metropolitan/Jimeta centre', row['review_reason'])


if __name__ == '__main__':
    unittest.main()
