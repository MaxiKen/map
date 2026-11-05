#!/usr/bin/env python3
"""Split a multi-layer GeoPackage into one GeoPackage per layer.
usage: python scripts/split_gpkg.py master.gpkg data/ [prefix ...]
Only layers whose name starts with one of the optional prefixes are written."""
import sqlite3, sys, os

SUPPORT = ['gpkg_tile_matrix_set', 'gpkg_tile_matrix', 'gpkg_2d_gridded_coverage_ancillary',
           'gpkg_2d_gridded_tile_ancillary', 'gpkg_extensions']


def split(master, outdir, prefixes=()):
    os.makedirs(outdir, exist_ok=True)
    m = sqlite3.connect(master)
    names = {r[0] for r in m.execute("select name from sqlite_master where type='table'")}
    ddl = {r[0]: r[1] for r in m.execute("select name,sql from sqlite_master where type='table' and sql is not null")}
    core = ['gpkg_spatial_ref_sys', 'gpkg_contents', 'gpkg_geometry_columns']
    layers = [r[0] for r in m.execute('select table_name from gpkg_contents order by table_name')]
    done = []
    for lay in layers:
        if prefixes and not lay.startswith(tuple(prefixes)):
            continue
        out = os.path.join(outdir, lay + '.gpkg')
        if os.path.exists(out): os.remove(out)
        d = sqlite3.connect(out)
        d.execute('PRAGMA application_id=1196444487'); d.execute('PRAGMA user_version=10300')
        for t in core:
            d.execute(ddl[t])
        d.commit(); d.close()
        d = sqlite3.connect(out); d.execute('attach ? as m', (master,))
        d.execute('insert into gpkg_spatial_ref_sys select * from m.gpkg_spatial_ref_sys')
        d.execute('insert into gpkg_contents select * from m.gpkg_contents where table_name=?', (lay,))
        d.execute('insert into gpkg_geometry_columns select * from m.gpkg_geometry_columns where table_name=?', (lay,))
        d.execute(ddl[lay]); d.execute(f'insert into "{lay}" select * from m."{lay}"')
        flt = {'gpkg_tile_matrix_set': 'table_name', 'gpkg_tile_matrix': 'table_name',
               'gpkg_2d_gridded_coverage_ancillary': 'tile_matrix_set_name',
               'gpkg_2d_gridded_tile_ancillary': 'tpudt_name', 'gpkg_extensions': 'table_name'}
        for t in SUPPORT:
            if t not in names: continue
            col = flt[t]
            rows = d.execute(f'select count(*) from m."{t}" where {col}=?', (lay,)).fetchone()[0]
            ext = t == 'gpkg_extensions'
            if not rows and not (ext and d.execute("select 1 from m.gpkg_extensions where table_name like 'gpkg_2d%'").fetchone() and False):
                continue
            d.execute(ddl[t])
            cols = [r[1] for r in d.execute(f'pragma table_info("{t}")')]
            sel = ','.join(f'"{c}"' for c in cols if c != 'id') if t in ('gpkg_2d_gridded_coverage_ancillary', 'gpkg_2d_gridded_tile_ancillary') else '*'
            ins = ','.join(f'"{c}"' for c in cols if c != 'id') if sel != '*' else ''
            if sel == '*': d.execute(f'insert into "{t}" select * from m."{t}" where {col}=?', (lay,))
            else: d.execute(f'insert into "{t}"({ins}) select {sel} from m."{t}" where {col}=?', (lay,))
        # gridded tile ancillary refers to tile ids: ids are preserved because tile table rows keep their id
        if 'gpkg_2d_gridded_coverage_ancillary' in [r[0] for r in d.execute("select name from sqlite_master")]:
            for tn in ('gpkg_2d_gridded_coverage_ancillary', 'gpkg_2d_gridded_tile_ancillary'):
                if d.execute('select 1 from gpkg_extensions where table_name=?', (tn,)).fetchone() is None and \
                   d.execute(f'select 1 from {tn} limit 1').fetchone():
                    d.execute("insert into gpkg_extensions values(?,?,?,?,?)", (tn, None, 'gpkg_2d_gridded_coverage',
                              'http://docs.opengeospatial.org/is/17-066r1/17-066r1.html', 'read-write'))
        d.commit(); d.execute('detach m'); d.execute('vacuum'); d.close()
        done.append((lay, os.path.getsize(out)))
    return done


if __name__ == '__main__':
    for n, s in split(sys.argv[1], sys.argv[2], sys.argv[3:]):
        print(f'{n:50s} {s/1e6:6.2f} MB')
