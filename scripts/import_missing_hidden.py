#!/usr/bin/env python3
"""Import missing all_maps layers as hidden files and consolidate table files.

    python scripts/import_missing_hidden.py --master /path/to/all_maps.gpkg

For every feature layer in the external all_maps.gpkg that is absent from data/, write
    data/<group>/hidden_<table>.gpkg
using the maintenance groups in data_paths.py. Existing visible or hidden layers
are never replaced. Attribute tables are not exported as standalone GeoPackages.

Standalone attribute-only GeoPackages already in data/ are embedded as registered
attribute tables in the owner named by their layer config's legendOf. The existing
build-time legend fold then enriches the published owner without duplicating those
values in the source features. The redundant standalone file is removed only after
a successful copy.

Master attribute tables whose actual owner is absent stay in the master; they are
not attached to an unrelated layer. Re-running the command is safe and should be
a no-op.
"""
import argparse
import glob
import json
import os
import shutil
import sqlite3
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from data_paths import group_for_table  # noqa: E402
from split_gpkg import split  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / 'files' / 'all_maps.gpkg'
DATA = ROOT / 'data'
CONFIG = ROOT / 'config' / 'layers.config.json'

# These master tables were already joined as feature columns by import_selected.py.
# They do not need a second copy registered as an attribute table in the owner.
ALREADY_JOINED = {
    'admin_senatorial_districts_tbl',
    'landcover_cgls2019_legend_tbl',
    'soil_wrb2006_groups_tbl',
    'soil_wrb2006_isric_legend_tbl',
}


def quote(name):
    return '"' + name.replace('"', '""') + '"'


def gpkg_paths(data_dir):
    return sorted(glob.glob(os.path.join(str(data_dir), '*', '**', '*.gpkg'), recursive=True))


def scan_data(data_dir):
    """Return table -> (path, data_type), rejecting ambiguous duplicate tables."""
    found = {}
    for path in gpkg_paths(data_dir):
        con = sqlite3.connect('file:' + path + '?mode=ro', uri=True)
        try:
            rows = con.execute('select table_name,data_type from gpkg_contents').fetchall()
        finally:
            con.close()
        for table, kind in rows:
            if table in found:
                raise RuntimeError(
                    f'{table!r} occurs in both {found[table][0]} and {path}; '
                    'remove the duplicate before importing')
            found[table] = (Path(path), kind)
    return found


def master_contents(master, kind=None):
    con = sqlite3.connect('file:' + str(master) + '?mode=ro', uri=True)
    try:
        sql = 'select table_name,data_type from gpkg_contents'
        if kind:
            sql += ' where data_type=?'
            return con.execute(sql + ' order by table_name', (kind,)).fetchall()
        return con.execute(sql + ' order by table_name').fetchall()
    finally:
        con.close()


def embed_attribute(owner_path, source_path, table):
    """Copy one registered attribute table into its owner GeoPackage."""
    con = sqlite3.connect(str(owner_path))
    try:
        con.execute('attach database ? as source', (str(Path(source_path).resolve()),))
        con.execute('begin immediate')
        if con.execute('select 1 from sqlite_master where name=?', (table,)).fetchone():
            raise RuntimeError(f'{owner_path} already contains a table named {table}')
        ddl = con.execute(
            "select sql from source.sqlite_master where type='table' and name=?", (table,)
        ).fetchone()[0]
        con.execute(ddl)
        con.execute(f'insert into main.{quote(table)} select * from source.{quote(table)}')

        dest_cols = [r[1] for r in con.execute('pragma table_info(gpkg_contents)')]
        source_cols = [r[1] for r in con.execute('pragma source.table_info("gpkg_contents")')]
        shared = [c for c in dest_cols if c in source_cols]
        cols = ','.join(quote(c) for c in shared)
        con.execute(
            f'insert into gpkg_contents ({cols}) select {cols} from source.gpkg_contents '
            'where table_name=?', (table,))
        if con.execute('select changes()').fetchone()[0] != 1:
            raise RuntimeError(f'No gpkg_contents registration found for {table}')
        for (sql,) in con.execute(
                "select sql from source.sqlite_master where type='index' and tbl_name=? and sql is not null",
                (table,)).fetchall():
            con.execute(sql)
        con.commit()
        con.execute('detach database source')
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def consolidate_standalone_tables(data_dir, config):
    """Embed every standalone table file that has an explicit configured owner."""
    catalog = scan_data(data_dir)
    by_path = {}
    for table, (path, kind) in catalog.items():
        by_path.setdefault(path, []).append((table, kind))
    standalone = [path for path, rows in by_path.items()
                  if rows and all(kind == 'attributes' for _, kind in rows)]
    layer_config = config.get('layers', {})
    for path in standalone:
        for table, _ in by_path[path]:
            settings = layer_config.get(table, {})
            owner = settings.get('legendOf')
            if not owner:
                raise RuntimeError(
                    f'{path} is a standalone attribute table with no legendOf configured. '
                    'Set its owner before consolidating so no table data is lost')
            if owner not in catalog:
                raise RuntimeError(f'{table}: configured owner {owner!r} is not present in data/')
            owner_path, _ = catalog[owner]
            print(f'  embed {table} -> {owner_path} ({owner})')
            embed_attribute(owner_path, path, table)
        path.unlink()
        print(f'  removed consolidated table file {path}')
    return len(standalone)


def import_missing(master, data_dir):
    existing = scan_data(data_dir)
    missing = [table for table, _ in master_contents(master, 'features') if table not in existing]
    if not missing:
        print('No missing spatial layers to import.')
        return []
    imported = []
    with tempfile.TemporaryDirectory(prefix='nwg-hidden-import-') as tmp:
        split(str(master), tmp, missing)
        for table in missing:
            source = Path(tmp) / (table + '.gpkg')
            if not source.is_file():
                raise RuntimeError(f'Split did not produce {source}')
            group = group_for_table(table)
            destination = Path(data_dir) / group / ('hidden_' + table + '.gpkg')
            if destination.exists():
                raise RuntimeError(f'Refusing to replace unregistered file {destination}')
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(source), str(destination))
            imported.append(destination)
            print(f'  hidden import {destination}')
    return imported


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--master', type=Path, default=MASTER,
                    help='external all_maps.gpkg (the original files/ master was removed after import)')
    ap.add_argument('--data', type=Path, default=DATA)
    ap.add_argument('--config', type=Path, default=CONFIG)
    args = ap.parse_args()
    if not args.master.is_file():
        ap.error(f'master GeoPackage not found: {args.master}; provide it with --master')
    config = json.loads(args.config.read_text(encoding='utf8'))

    imported = import_missing(args.master, args.data)
    consolidated = consolidate_standalone_tables(args.data, config)
    final = scan_data(args.data)

    still_missing = [t for t, _ in master_contents(args.master, 'features') if t not in final]
    if still_missing:
        raise RuntimeError(f'Spatial layers still missing after import: {still_missing}')
    table_files = [p for p in gpkg_paths(args.data) if Path(p).stem.endswith('_tbl')]
    if table_files:
        raise RuntimeError(f'Standalone table files remain: {table_files}')

    registered_attributes = {t for t, (_, kind) in final.items() if kind == 'attributes'}
    master_attributes = {t for t, _ in master_contents(args.master, 'attributes')}
    orphans = sorted(master_attributes - registered_attributes - ALREADY_JOINED)
    hidden = [p for p in gpkg_paths(args.data) if Path(p).name.startswith('hidden_')]
    print(f'\nImported {len(imported)} hidden spatial layer(s); consolidated {consolidated} table file(s).')
    print(f'Data now contains {len(gpkg_paths(args.data))} GeoPackages: {len(hidden)} hidden, '
          f'{len(gpkg_paths(args.data)) - len(hidden)} visible.')
    print('Orphan master tables left only in all_maps.gpkg (their real raster owners are absent):')
    for table in orphans:
        print('  ' + table)


if __name__ == '__main__':
    main()
