#!/usr/bin/env python3
"""Validate source GeoPackages and generated audit/public artifacts.

This is the lightweight, read-only artifact check run before the full regression
suite in CI. Correction ledgers, geometry validity, hashes, and public/source
comparisons remain covered by tests in tests/.
"""
from __future__ import annotations

import csv
import json
import sqlite3
from collections import Counter
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
AUDIT = ROOT / 'docs' / 'geospatial-audit'
PUBLIC = ROOT / 'public'

REQUIRED_AUDIT_FILES = (
    'README.md',
    'audit.json',
    'extended-audit.json',
    'layer-review.csv',
    'layer-review.md',
    'capital-correction-ledger.csv',
    'capital-correction-result.json',
    'topology-correction-ledger.csv',
    'topology-correction-result.json',
    'gada-illela-correction-ledger.csv',
    'gada-illela-correction-result.json',
    'ward-lga-exceptions-before-residual-review.csv',
    'ward-lga-review-ledger.csv',
    'ward-lga-review-verification.json',
    'ward-lga-correction-result.json',
    'ward-lga-review.md',
)


class ValidationError(RuntimeError):
    """An artifact failed a CI validation rule."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValidationError(message)


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding='utf8'))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ValidationError(f'{relative(path)}: invalid JSON: {exc}') from exc


def validate_json_and_geojson(paths: list[Path]) -> Counter:
    counts = Counter()
    for path in paths:
        value = read_json(path)
        counts[path.suffix] += 1
        if path.suffix == '.geojson':
            require(isinstance(value, dict) and value.get('type') == 'FeatureCollection',
                    f'{relative(path)}: expected a GeoJSON FeatureCollection')
            require(isinstance(value.get('features'), list),
                    f'{relative(path)}: features must be an array')
            counts['geojson_features'] += len(value['features'])
        elif path.name == 'catalog.json':
            require(isinstance(value, dict) and isinstance(value.get('layers'), list),
                    f'{relative(path)}: catalog layers must be an array')
            layer_ids = [layer.get('id') for layer in value['layers']]
            require(all(isinstance(layer_id, str) and layer_id for layer_id in layer_ids),
                    f'{relative(path)}: every layer needs a non-empty id')
            require(len(layer_ids) == len(set(layer_ids)),
                    f'{relative(path)}: duplicate catalog layer ids')
            counts['catalog_layers'] = len(layer_ids)
    return counts


def validate_csv(path: Path) -> int:
    try:
        with path.open(encoding='utf8', newline='') as handle:
            reader = csv.DictReader(handle)
            require(reader.fieldnames is not None and len(reader.fieldnames) > 0,
                    f'{relative(path)}: missing CSV header')
            require(len(reader.fieldnames) == len(set(reader.fieldnames)),
                    f'{relative(path)}: duplicate CSV columns')
            row_count = 0
            for line_number, row in enumerate(reader, start=2):
                require(None not in row, f'{relative(path)}:{line_number}: too many fields')
                require(all(value is not None for value in row.values()),
                        f'{relative(path)}:{line_number}: missing fields')
                row_count += 1
            return row_count
    except (OSError, UnicodeError, csv.Error) as exc:
        raise ValidationError(f'{relative(path)}: invalid CSV: {exc}') from exc


def validate_png(path: Path) -> None:
    try:
        with Image.open(path) as image:
            require(image.format == 'PNG', f'{relative(path)}: not a PNG image')
            require(image.width > 0 and image.height > 0,
                    f'{relative(path)}: empty image dimensions')
            image.verify()
    except (OSError, ValueError) as exc:
        raise ValidationError(f'{relative(path)}: invalid PNG: {exc}') from exc


def validate_geopackages() -> tuple[list[Path], dict[str, dict]]:
    require(DATA.is_dir(), 'data/: directory is missing')
    require(not list(DATA.glob('*.gpkg')),
            'GeoPackages must be inside top-level group folders, not directly in data/')
    staging = sorted(path for path in DATA.rglob('*')
                     if path.name.endswith(('.correcting.gpkg', '.creating.gpkg')))
    require(not staging, 'Staging GeoPackages remain: ' + ', '.join(map(relative, staging)))

    paths = sorted(DATA.glob('*/**/*.gpkg'))
    require(paths, 'data/: no GeoPackages found')
    layers: dict[str, dict] = {}
    for path in paths:
        try:
            with sqlite3.connect(f'file:{path}?mode=ro', uri=True) as connection:
                integrity = connection.execute('pragma integrity_check').fetchone()[0]
                require(integrity == 'ok', f'{relative(path)}: SQLite integrity_check={integrity}')
                contents = connection.execute(
                    'select table_name, data_type from gpkg_contents').fetchall()
        except sqlite3.DatabaseError as exc:
            raise ValidationError(f'{relative(path)}: cannot read GeoPackage: {exc}') from exc
        spatial_rows = [(table, kind) for table, kind in contents if kind != 'attributes']
        require(spatial_rows, f'{relative(path)}: no spatial layers registered in gpkg_contents')
        for table, kind in spatial_rows:
            require(table not in layers, f'Duplicate spatial table {table!r} in {relative(path)}')
            layers[table] = {'path': path, 'kind': kind}
    return paths, layers


def validate_inventory(paths: list[Path], layers: dict[str, dict]) -> None:
    audit_path = AUDIT / 'audit.json'
    audit = read_json(audit_path)
    relative_paths = {relative(path) for path in paths}
    integrity_rows = audit.get('database_integrity')
    require(isinstance(integrity_rows, list), 'audit.json: database_integrity must be an array')
    require(len(integrity_rows) == len(paths),
            f'audit.json: {len(integrity_rows)} integrity rows for {len(paths)} GeoPackages')
    require({row.get('path') for row in integrity_rows} == relative_paths,
            'audit.json: database integrity inventory does not match data/')
    require(all(row.get('integrity_check') == 'ok' for row in integrity_rows),
            'audit.json: a recorded SQLite integrity check is not ok')

    audited_layers = set(audit.get('vectors', {})) | set(audit.get('rasters', {}))
    source_layers = set(layers)
    require(audited_layers == source_layers,
            'audit.json: layer inventory differs from data/; '
            f'missing={sorted(source_layers - audited_layers)}, '
            f'stale={sorted(audited_layers - source_layers)}')

    catalog = read_json(PUBLIC / 'catalog.json')
    for layer in catalog['layers']:
        layer_id = layer['id']
        require(layer_id in layers, f'public/catalog.json: unknown source layer {layer_id}')
        require(not layers[layer_id]['path'].name.startswith('hidden_'),
                f'public/catalog.json: hidden source layer {layer_id} was published')
        published_file = layer.get('file')
        if published_file:
            require((PUBLIC / published_file).is_file(),
                    f'public/catalog.json: missing file for {layer_id}: {published_file}')


def main() -> None:
    missing = [name for name in REQUIRED_AUDIT_FILES if not (AUDIT / name).is_file()]
    require(not missing, 'Missing required audit artifacts: ' + ', '.join(missing))
    require((PUBLIC / 'catalog.json').is_file(), 'public/catalog.json is missing')

    paths, layers = validate_geopackages()
    validate_inventory(paths, layers)

    audit_structured = sorted(path for path in AUDIT.rglob('*')
                              if path.suffix in ('.json', '.geojson'))
    public_structured = sorted(path for path in PUBLIC.rglob('*')
                               if path.suffix in ('.json', '.geojson'))
    audit_counts = validate_json_and_geojson(audit_structured)
    public_counts = validate_json_and_geojson(public_structured)

    csv_paths = sorted(AUDIT.rglob('*.csv'))
    csv_rows = sum(validate_csv(path) for path in csv_paths)
    png_paths = sorted(AUDIT.rglob('*.png'))
    for path in png_paths:
        validate_png(path)
    require(audit_structured and csv_paths and png_paths,
            'Audit JSON/CSV/PNG artifact sets must all be non-empty')

    print(
        'Artifact validation passed: '
        f'{len(paths)} GeoPackages, {len(layers)} source layers, '
        f'{public_counts["catalog_layers"]} public catalog layers, '
        f'{public_counts["geojson_features"]} published GeoJSON features; '
        f'{len(audit_structured) + len(public_structured)} JSON/GeoJSON files, '
        f'{len(csv_paths)} audit CSVs ({csv_rows} rows), and {len(png_paths)} audit PNGs.'
    )


if __name__ == '__main__':
    main()
