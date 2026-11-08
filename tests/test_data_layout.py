import json
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
from shapely import wkb
from shapely.geometry import Polygon, box
from shapely.geometry import shape


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))

from build_site import discover_geopackages, read_gpkg_geom, read_valid_gpkg_geom  # noqa: E402
from data_paths import layer_path  # noqa: E402
from import_missing_hidden import embed_attribute  # noqa: E402
from make_raster_gpkg import write_raster  # noqa: E402
from optimize_gpkg import clean_config, optimize_file  # noqa: E402


def touch(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b'')


def make_attribute_gpkg(path, table='unrelated_prefix_tbl'):
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path)
    con.execute('''create table gpkg_contents (
        table_name text, data_type text, identifier text, description text,
        min_x real, min_y real, max_x real, max_y real)''')
    con.execute(f'create table "{table}" (id integer, name text)')
    con.execute(f'insert into "{table}" values (1, ?)', ('example',))
    con.execute('insert into gpkg_contents values (?, ?, ?, ?, 0, 0, 1, 1)',
                (table, 'attributes', table, 'layout test'))
    con.commit()
    con.close()


class GeometryExportTests(unittest.TestCase):
    @staticmethod
    def blob(geometry):
        return b'GP' + bytes([0, 0, 0, 0, 0, 0]) + wkb.dumps(geometry, byte_order=1)

    def test_precision_fallback_is_used_only_when_rounding_breaks_validity(self):
        valid_blob = self.blob(box(0, 0, 1, 1))
        geometry, precision = read_valid_gpkg_geom(valid_blob)
        self.assertEqual(precision, 5)
        self.assertTrue(shape(geometry).is_valid)

        narrow = Polygon([(0, 0), (0.000004, 0), (0, 1), (0, 0)])
        narrow_blob = self.blob(narrow)
        self.assertFalse(shape(read_gpkg_geom(narrow_blob, 5)).is_valid)
        geometry, precision = read_valid_gpkg_geom(narrow_blob)
        self.assertEqual(precision, 6)
        self.assertTrue(shape(geometry).is_valid)
        self.assertEqual(geometry['coordinates'][0][1][0], 0.000004)


class DiscoverGeoPackagesTests(unittest.TestCase):
    def test_top_level_folder_is_verbatim_group_and_nested_folders_are_allowed(self):
        with tempfile.TemporaryDirectory() as tmp:
            data = Path(tmp) / 'data'
            first = data / 'My Exact Group' / 'one.gpkg'
            nested = data / 'My Exact Group' / 'archive' / 'two.gpkg'
            second = data / 'another group' / 'three.gpkg'
            for path in (second, nested, first):
                touch(path)
            touch(data / 'Empty group' / 'notes.txt')

            found = discover_geopackages(str(data))

            self.assertEqual(found, [
                (str(second), 'another group'),
                (str(nested), 'My Exact Group'),
                (str(first), 'My Exact Group'),
            ])

    def test_any_loose_root_file_is_rejected(self):
        for filename in ('loose.gpkg', 'README.txt'):
            with self.subTest(filename=filename), tempfile.TemporaryDirectory() as tmp:
                data = Path(tmp) / 'data'
                touch(data / filename)
                touch(data / 'Geology' / 'valid.gpkg')
                with self.assertRaisesRegex(ValueError, 'files are not allowed directly'):
                    discover_geopackages(str(data))

    def test_missing_data_directory_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(ValueError, 'does not exist'):
                discover_geopackages(str(Path(tmp) / 'missing'))


class MaintenancePathTests(unittest.TestCase):
    def test_existing_manually_selected_group_wins(self):
        with tempfile.TemporaryDirectory() as tmp:
            existing = Path(tmp) / 'My chosen group' / 'geology_units_map2011_pg.gpkg'
            touch(existing)
            self.assertEqual(layer_path(tmp, 'geology_units_map2011_pg'), str(existing))

    def test_existing_hidden_layer_keeps_its_prefix_during_refresh(self):
        with tempfile.TemporaryDirectory() as tmp:
            existing = Path(tmp) / 'Water' / 'hidden_water_areas_diva_pg.gpkg'
            touch(existing)
            self.assertEqual(layer_path(tmp, 'water_areas_diva_pg'), str(existing))

    def test_new_known_layer_is_written_inside_a_group(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(layer_path(tmp, 'hazards_flood_aqueduct_rst'))
            self.assertEqual(out.parent.name, 'Natural hazards')
            self.assertEqual(out.parent.parent, Path(tmp))
            self.assertTrue(out.parent.is_dir())

    def test_duplicate_existing_layer_is_not_guessed(self):
        with tempfile.TemporaryDirectory() as tmp:
            for group in ('One', 'Two'):
                touch(Path(tmp) / group / 'water_areas_diva_pg.gpkg')
            with self.assertRaisesRegex(RuntimeError, 'more than one group'):
                layer_path(tmp, 'water_areas_diva_pg')


class EmbedAttributeTests(unittest.TestCase):
    def test_attribute_table_is_registered_and_copied_into_owner(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            owner = root / 'Geology' / 'owner.gpkg'
            source = root / 'Geology' / 'legend_tbl.gpkg'
            owner.parent.mkdir(parents=True)
            con = sqlite3.connect(owner)
            con.execute('''create table gpkg_contents (
                table_name text, data_type text, identifier text, description text,
                min_x real, min_y real, max_x real, max_y real)''')
            con.execute('create table owner_pg (id integer, name text)')
            con.execute("insert into gpkg_contents values ('owner_pg', 'features', 'owner_pg', '', 0, 0, 1, 1)")
            con.commit()
            con.close()
            make_attribute_gpkg(source, 'legend_tbl')

            embed_attribute(owner, source, 'legend_tbl')

            con = sqlite3.connect(owner)
            kinds = dict(con.execute('select table_name,data_type from gpkg_contents'))
            self.assertEqual(kinds, {'owner_pg': 'features', 'legend_tbl': 'attributes'})
            self.assertEqual(con.execute('select id,name from legend_tbl').fetchall(), [(1, 'example')])
            con.close()


class OptimizeGeoPackageTests(unittest.TestCase):
    def test_empty_and_constant_columns_drop_but_keys_and_variable_data_stay(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'sample.gpkg'
            con = sqlite3.connect(path)
            con.execute('create table gpkg_contents (table_name text, data_type text)')
            con.execute("insert into gpkg_contents values ('sample_pg', 'features')")
            con.execute('create table gpkg_geometry_columns (table_name text, column_name text)')
            con.execute("insert into gpkg_geometry_columns values ('sample_pg', 'geom')")
            con.execute('''create table sample_pg (
                fid integer primary key, geom blob, empty text, constant text,
                varied text, join_key text)''')
            con.execute("insert into sample_pg values (1, x'00', null, 'same', 'a', 'key')")
            con.execute("insert into sample_pg values (2, x'00', '', 'same', 'b', 'key')")
            con.commit()
            con.close()
            settings = {'sample_pg': {'legendKey': 'join_key', 'labelField': 'constant'}}

            optimize_file(path, settings, compress_rasters=False)

            con = sqlite3.connect(path)
            columns = {r[1] for r in con.execute('pragma table_info(sample_pg)')}
            con.close()
            self.assertEqual(columns, {'fid', 'geom', 'varied', 'join_key'})
            config = {'layers': settings}
            self.assertTrue(clean_config(config, {'sample_pg': [('constant', 'constant')]}))
            self.assertNotIn('labelField', config['layers']['sample_pg'])

    def test_raster_deflate_round_trip_is_exact_and_smaller(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'raster.gpkg'
            arr = np.zeros((20, 30), dtype='f4')
            arr[5, 5] = 2.5
            write_raster(str(path), 'raster_rst', arr, (2.5, 4.0, 15.0, 14.0))
            con = sqlite3.connect(path)
            before = con.execute('select length(tile_data) from raster_rst').fetchone()[0]
            con.close()

            optimize_file(path, {}, compress_rasters=True)

            con = sqlite3.connect(path)
            blob, after = con.execute('select tile_data,length(tile_data) from raster_rst').fetchone()
            con.close()
            self.assertLess(after, before)
            import io
            import tifffile
            decoded = tifffile.imread(io.BytesIO(blob))
            np.testing.assert_array_equal(decoded, arr)


class BuildCatalogTests(unittest.TestCase):
    def test_build_uses_folder_not_filename_or_legacy_config_for_group(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data = root / 'data'
            app = root / 'app'
            out = root / 'public'
            app.mkdir()
            (app / 'index.html').write_text('<!doctype html>', encoding='utf8')
            source = data / 'Folder display name' / 'sample.gpkg'
            make_attribute_gpkg(source)
            # A hidden file must be skipped before SQLite tries to open it.
            (data / 'Folder display name' / 'hidden_broken.gpkg').write_bytes(b'not a GeoPackage')
            config = {
                'groups': {'Folder display name': {'label': 'Must not win', 'order': 7}},
                'layers': {'unrelated_prefix_tbl': {'group': 'Must not win either'}},
            }
            config_path = root / 'config.json'
            config_path.write_text(json.dumps(config), encoding='utf8')

            subprocess.run([
                sys.executable, str(ROOT / 'scripts' / 'build_site.py'),
                '--data', str(data), '--app', str(app), '--out', str(out),
                '--config', str(config_path),
            ], cwd=ROOT, check=True, capture_output=True, text=True)

            catalog = json.loads((out / 'catalog.json').read_text(encoding='utf8'))
            self.assertEqual(catalog['groups'], [
                {'id': 'Folder display name', 'label': 'Folder display name', 'order': 7},
            ])
            self.assertEqual(len(catalog['layers']), 1)
            self.assertEqual(catalog['layers'][0]['group'], 'Folder display name')
            self.assertEqual(catalog['layers'][0]['source'], 'Folder display name/sample.gpkg')


if __name__ == '__main__':
    unittest.main()
