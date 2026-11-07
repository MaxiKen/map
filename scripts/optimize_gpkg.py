#!/usr/bin/env python3
"""Losslessly reduce GeoPackages in data/<group>/ without changing map geometry.

    python scripts/optimize_gpkg.py --dry-run
    python scripts/optimize_gpkg.py

For registered feature and attribute tables, drop non-key, non-geometry columns
whose values are all NULL/blank or contain at most one distinct non-blank value.
Configured legend join keys are preserved. A configured labelField/field setting
is removed if its column is dropped, preventing stale app configuration.

For 2D gridded coverages, rewrite each TIFF tile with lossless DEFLATE only when
it becomes smaller and an exact dtype/shape/value read-back check passes. Image
overlays and vector geometries are not resampled, simplified or recompressed.

Changed databases are VACUUMed to reclaim the removed bytes. --dry-run performs
all analysis and trial compression in memory but writes nothing.
"""
import argparse
import io
import json
import sqlite3
from pathlib import Path

import numpy as np
import tifffile

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
CONFIG = ROOT / 'config' / 'layers.config.json'


def quote(name):
    return '"' + name.replace('"', '""') + '"'


def meaningful(value):
    return value is not None and (not isinstance(value, str) or value.strip() != '')


def value_key(value):
    """Keep values of different SQLite/Python types distinct."""
    return type(value).__name__, value


def removable_columns(con, table, settings):
    geometry = None
    if con.execute("select 1 from sqlite_master where name='gpkg_geometry_columns'").fetchone():
        row = con.execute('select column_name from gpkg_geometry_columns where table_name=?',
                          (table,)).fetchone()
        geometry = row[0] if row else None
    protected = {settings.get('legendKey')}
    candidates = []
    info = list(con.execute(f'pragma table_info({quote(table)})'))
    for row in info:
        column = row[1]
        if column == geometry or row[5] or column in protected:
            continue
        values = [r[0] for r in con.execute(f'select {quote(column)} from {quote(table)}')]
        values = [v for v in values if meaningful(v)]
        distinct = {value_key(v) for v in values}
        if len(distinct) <= 1:
            reason = 'empty' if not values else 'constant: ' + repr(values[0])
            candidates.append((column, reason))
    return candidates


def compress_raster_tiles(con, apply=False):
    """Return (tiles seen, tiles changed, original bytes, best bytes)."""
    seen = changed = original = best = 0
    tables = [r[0] for r in con.execute(
        "select table_name from gpkg_contents where data_type='2d-gridded-coverage'")]
    for table in tables:
        rows = con.execute(f'select rowid,tile_data from {quote(table)}').fetchall()
        for rowid, blob in rows:
            if blob is None:
                continue
            seen += 1
            original_size = len(blob)
            arr = tifffile.imread(io.BytesIO(blob))
            buf = io.BytesIO()
            tifffile.imwrite(buf, arr, photometric='minisblack', compression='deflate',
                             compressionargs={'level': 9}, metadata=None)
            compressed = buf.getvalue()
            if len(compressed) < original_size:
                decoded = tifffile.imread(io.BytesIO(compressed))
                if decoded.dtype != arr.dtype or decoded.shape != arr.shape:
                    raise RuntimeError(f'{table} raster compression changed its shape or dtype')
                if not np.array_equal(decoded, arr, equal_nan=True):
                    raise RuntimeError(f'{table} raster compression changed at least one cell value')
                new_size = len(compressed)
                if apply:
                    con.execute(f'update {quote(table)} set tile_data=? where rowid=?',
                                (compressed, rowid))
                    changed += 1
            else:
                new_size = original_size
            original += original_size
            best += new_size
    return seen, changed, original, best


def clean_config(config, dropped_by_table):
    """Remove app references to dropped fields; return True when config changed."""
    changed = False
    layers = config.get('layers', {})
    for table, columns in dropped_by_table.items():
        settings = layers.get(table)
        if not settings:
            continue
        dropped = {c for c, _ in columns}
        for key in ('labelField', 'legendLabelField'):
            if settings.get(key) in dropped:
                del settings[key]
                changed = True
        if 'fields' in settings:
            for column in dropped & set(settings['fields']):
                del settings['fields'][column]
                changed = True
            if not settings['fields']:
                del settings['fields']
                changed = True
        style = settings.get('style')
        if style:
            if style.get('field') in dropped:
                del settings['style']
                changed = True
            elif style.get('labelField') in dropped:
                del style['labelField']
                changed = True
    return changed


def optimize_file(path, layer_config, dry_run=False, compress_rasters=True):
    before = path.stat().st_size
    con = (sqlite3.connect('file:' + str(path) + '?mode=ro', uri=True) if dry_run
           else sqlite3.connect(str(path)))
    dropped_by_table = {}
    raster = (0, 0, 0, 0)
    try:
        tables = con.execute(
            "select table_name from gpkg_contents where data_type in ('features','attributes') "
            'order by table_name').fetchall()
        for (table,) in tables:
            drops = removable_columns(con, table, layer_config.get(table, {}))
            if drops:
                dropped_by_table[table] = drops

        if not dry_run:
            con.execute('pragma secure_delete=on')
            con.execute('begin immediate')
            for table, drops in dropped_by_table.items():
                for column, _ in drops:
                    con.execute(f'alter table {quote(table)} drop column {quote(column)}')
        if compress_rasters:
            raster = compress_raster_tiles(con, apply=not dry_run)
        if not dry_run:
            con.commit()
            if dropped_by_table or raster[1] or con.execute('pragma freelist_count').fetchone()[0]:
                con.execute('vacuum')
    except Exception:
        if not dry_run:
            con.rollback()
        raise
    finally:
        con.close()
    after = before if dry_run else path.stat().st_size
    return {
        'path': path,
        'dropped': dropped_by_table,
        'raster_seen': raster[0],
        'raster_changed': raster[1],
        'raster_before': raster[2],
        'raster_best': raster[3],
        'before': before,
        'after': after,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--data', type=Path, default=DATA)
    ap.add_argument('--config', type=Path, default=CONFIG)
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--skip-rasters', action='store_true', help='only remove empty/constant columns')
    args = ap.parse_args()
    config = json.loads(args.config.read_text(encoding='utf8'))
    layer_config = config.get('layers', {})
    paths = sorted(args.data.glob('*/**/*.gpkg'))
    if not paths:
        ap.error(f'no grouped GeoPackages found under {args.data}')

    reports = []
    config_dirty = False
    for path in paths:
        report = optimize_file(path, layer_config, args.dry_run, not args.skip_rasters)
        reports.append(report)
        dropped = report['dropped']
        if dropped or report['raster_best'] < report['raster_before']:
            print(f'\n{path}')
            for table, columns in dropped.items():
                for column, reason in columns:
                    print(f'  drop {table}.{column}: {reason}')
            if report['raster_seen']:
                print(f'  raster tiles: {report["raster_before"]/1e6:.3f} -> '
                      f'{report["raster_best"]/1e6:.3f} MB')
            if not args.dry_run:
                print(f'  file: {report["before"]/1e6:.3f} -> {report["after"]/1e6:.3f} MB')
        if not args.dry_run:
            config_dirty = clean_config(config, dropped) or config_dirty

    if not args.dry_run and config_dirty:
        args.config.write_text(json.dumps(config, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
        print(f'\nRemoved stale dropped-field references from {args.config}')

    columns = sum(len(columns) for r in reports for columns in r['dropped'].values())
    raster_before = sum(r['raster_before'] for r in reports)
    raster_best = sum(r['raster_best'] for r in reports)
    before = sum(r['before'] for r in reports)
    after = sum(r['after'] for r in reports)
    print(f'\n{"Dry run: " if args.dry_run else ""}found {columns} empty/constant columns in '
          f'{sum(bool(r["dropped"]) for r in reports)} files.')
    if not args.skip_rasters:
        print(f'Raster tile payloads: {raster_before/1e6:.3f} -> {raster_best/1e6:.3f} MB; '
              f'saving {(raster_before-raster_best)/1e6:.3f} MB with lossless DEFLATE.')
    if not args.dry_run:
        print(f'GeoPackage total: {before/1e6:.3f} -> {after/1e6:.3f} MB; '
              f'saved {(before-after)/1e6:.3f} MB.')


if __name__ == '__main__':
    main()
