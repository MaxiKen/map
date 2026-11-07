#!/usr/bin/env python3
"""Write a GeoPackage `2d-gridded-coverage` raster from a float32 numpy array.

The site's build_site.py reads these directly (GeoTIFF float32 tiles).  The schema is
copied from a raster GeoPackage that already ships in data/, so the output stays
spec-clean without needing GDAL.

    from scripts.make_raster_gpkg import write_raster
    write_raster('data/foo_rst.gpkg', 'foo_rst', arr, (west, south, east, north),
                 uom='metres', field='Elevation', description='...')
"""
import io
import os
import sqlite3

import numpy as np
import tifffile

CORE = ['gpkg_spatial_ref_sys', 'gpkg_contents', 'gpkg_geometry_columns',
        'gpkg_tile_matrix_set', 'gpkg_tile_matrix', 'gpkg_2d_gridded_coverage_ancillary',
        'gpkg_2d_gridded_tile_ancillary', 'gpkg_extensions']
EXT_DEF = 'http://docs.opengeospatial.org/is/17-066r1/17-066r1.html'


def write_raster(out, table, arr, bounds, uom='', field='Value', description='',
                 nodata=-9999.0, template=None):
    """arr is float32 (H, W), first row = north. bounds = (west, south, east, north)."""
    template = template or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                                        'data', 'geology_general_picture_code_rst.gpkg')
    arr = np.asarray(arr, dtype='<f4')
    arr = np.where(np.isfinite(arr), arr, nodata).astype('<f4')
    h, w = arr.shape
    west, south, east, north = bounds
    if os.path.exists(out):
        os.remove(out)
    d = sqlite3.connect(out, uri=True)
    d.execute('PRAGMA application_id=1196444487')
    d.execute('PRAGMA user_version=10300')
    d.execute('ATTACH ? AS tpl', ('file:' + template + '?mode=ro',))
    ddl = {r[0]: r[1] for r in d.execute(
        "select name, sql from tpl.sqlite_master where type='table' and sql is not null")}
    for t in CORE:
        d.execute(ddl[t])
    d.execute('insert into gpkg_spatial_ref_sys select * from tpl.gpkg_spatial_ref_sys')
    d.commit()

    d.execute('create table "%s" (id INTEGER PRIMARY KEY AUTOINCREMENT, zoom_level INTEGER NOT NULL, '
              'tile_column INTEGER NOT NULL, tile_row INTEGER NOT NULL, tile_data BLOB NOT NULL, '
              'UNIQUE(zoom_level,tile_column,tile_row))' % table)
    d.execute('insert into gpkg_contents (table_name,data_type,identifier,description,min_x,min_y,max_x,max_y,srs_id) '
              'values (?,?,?,?,?,?,?,?,4326)',
              (table, '2d-gridded-coverage', table, description, west, south, east, north))
    d.execute('insert into gpkg_tile_matrix_set values (?,4326,?,?,?,?)',
              (table, west, south, east, north))
    d.execute('insert into gpkg_tile_matrix values (?,0,1,1,?,?,?,?)',
              (table, w, h, (east - west) / w, (north - south) / h))
    buf = io.BytesIO()
    tifffile.imwrite(buf, arr, photometric='minisblack')
    d.execute('insert into "%s" (zoom_level,tile_column,tile_row,tile_data) values (0,0,0,?)'
              % table, (buf.getvalue(),))

    d.execute('insert into gpkg_2d_gridded_coverage_ancillary '
              '(tile_matrix_set_name,datatype,scale,offset,precision,data_null,grid_cell_encoding,uom,field_name,quantity_definition) '
              'values (?,?,?,?,?,?,?,?,?,?)',
              (table, 'float', 1.0, 0.0, 1.0, nodata, 'grid-value-is-area', uom, field, field))
    good = arr[arr != nodata]
    d.execute('insert into gpkg_2d_gridded_tile_ancillary '
              '(tpudt_name,tpudt_id,scale,offset,min,max,mean,std_dev) values (?,1,1.0,0.0,?,?,?,?)',
              (table, float(good.min()), float(good.max()), float(good.mean()), float(good.std())))
    d.executemany('insert into gpkg_extensions values (?,?,?,?,?)', [
        (table, 'tile_data', 'gpkg_2d_gridded_coverage', EXT_DEF, 'read-write'),
        ('gpkg_2d_gridded_coverage_ancillary', None, 'gpkg_2d_gridded_coverage', EXT_DEF, 'read-write'),
        ('gpkg_2d_gridded_tile_ancillary', None, 'gpkg_2d_gridded_coverage', EXT_DEF, 'read-write')])
    d.commit()
    d.execute('VACUUM')
    d.close()
    return out


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--table', required=True)
    a = ap.parse_args()
    # tiny synthetic smoke-test grid; real data comes from scripts/fetch_rasters.py
    y, x = np.mgrid[0:80, 0:100].astype('f4')
    write_raster(a.out, a.table, x + y, (2.5, 4.0, 15.0, 14.0),
                 uom='test units', field='Test', description='smoke test')
    print('wrote', a.out)
