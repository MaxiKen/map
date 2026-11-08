#!/usr/bin/env python3
"""Build and validate the complete layer quality and metadata register.

Quality statements are evidence classes, not an arbitrary numeric accuracy score.
Source metadata gaps remain explicit. Run after both audits and before build_site.py
so the static catalog can embed the resulting compact public metadata.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sqlite3
from collections import Counter
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

from audit_geospatial import DATA, ROOT, layer_index, q
from cross_border_policy import load_policy, provenance_base, resolve_layer

AUDIT_DIR = ROOT / 'docs' / 'geospatial-audit'
METADATA_PATH = ROOT / 'config' / 'layer-metadata.json'
REGISTER_JSON = AUDIT_DIR / 'layer-quality-register.json'
REGISTER_CSV = AUDIT_DIR / 'layer-quality-register.csv'
REGISTER_MD = AUDIT_DIR / 'layer-quality-register.md'
LICENCE_STATUSES = {'confirmed', 'terms_described', 'not_recorded'}
COVERAGE_STATUSES = {
    'not_assessed', 'extraction_window_subset', 'partial_coverage', 'generalised_subset',
    'partial_map_sheet', 'hidden_semantic_crosscheck', 'modelled_estimate',
    'hidden_crosscheck', 'low_accuracy_historical_source',
}
REGISTER_FIELDS = [
    'layer', 'title', 'group', 'source_path', 'visibility', 'kind', 'geometry_type',
    'feature_count', 'grid_rows', 'grid_columns', 'tile_count_at_max_zoom', 'crs',
    'min_longitude', 'min_latitude', 'max_longitude', 'max_latitude', 'attribute_count',
    'attributes', 'raster_units', 'raster_nodata', 'source_sha256', 'gpkg_last_change',
    'source_description', 'source_description_status', 'source_key', 'publisher', 'dataset',
    'source_url', 'licence_or_terms', 'licence_status', 'temporal_coverage',
    'metadata_reference', 'metadata_notes', 'metadata_fields_recorded',
    'metadata_fields_total', 'metadata_status', 'metadata_gaps', 'coverage_status',
    'quality_use_class', 'structural_status', 'topology_status', 'review_status',
    'review_findings', 'quality_evidence', 'recommended_action', 'quality_limitations',
    'cross_border_scope', 'national_statistics', 'admin_identifier_scheme', 'published',
    'public_layer_id', 'public_file', 'provenance_of',
]


def _validate_metadata(document: dict) -> None:
    required = ('register_id', 'schema_version', 'metadata_fields', 'sources', 'layers', 'coverage')
    if any(key not in document for key in required):
        raise ValueError('Layer metadata document is incomplete')
    if document['schema_version'] != 1:
        raise ValueError('Only layer metadata schema_version 1 is supported')
    if document['metadata_fields'] != [
            'publisher', 'dataset', 'url', 'licence_or_terms', 'temporal_coverage',
            'metadata_reference']:
        raise ValueError('Unexpected layer metadata field definition')
    for key, record in document['sources'].items():
        fields = {
            'publisher', 'dataset', 'url', 'licence_or_terms', 'licence_status',
            'temporal_coverage', 'metadata_reference', 'notes',
        }
        if set(record) != fields:
            raise ValueError(f'Metadata source {key}: expected exactly {sorted(fields)}')
        if not record['dataset'] or not record['metadata_reference']:
            raise ValueError(f'Metadata source {key}: dataset and local reference are required')
        if record['licence_status'] not in LICENCE_STATUSES:
            raise ValueError(f'Metadata source {key}: invalid licence_status')
        if record['licence_status'] == 'not_recorded' and record['licence_or_terms']:
            raise ValueError(f'Metadata source {key}: terms supplied with not_recorded status')
        if record['licence_status'] != 'not_recorded' and not record['licence_or_terms']:
            raise ValueError(f'Metadata source {key}: documented terms are missing')
        if not (ROOT / record['metadata_reference']).is_file():
            raise ValueError(f'Metadata source {key}: missing reference {record["metadata_reference"]}')
    for table, source_key in document['layers'].items():
        if provenance_base(table):
            raise ValueError(f'Metadata provenance {table} must inherit its active layer source')
        if source_key not in document['sources']:
            raise ValueError(f'Metadata layer {table}: unknown source {source_key}')
    if any(status not in COVERAGE_STATUSES for status in document['coverage'].values()):
        raise ValueError('Unknown coverage status in layer metadata')
    if any(table not in document['layers'] for table in document['coverage']):
        raise ValueError('Coverage override references an unmapped layer')


@lru_cache(maxsize=4)
def load_metadata(path: Path = METADATA_PATH) -> dict:
    path = Path(path)
    raw = path.read_bytes()
    document = json.loads(raw)
    _validate_metadata(document)
    document['_path'] = path
    document['_sha256'] = hashlib.sha256(raw).hexdigest()
    return document


def source_metadata(table: str, metadata: dict) -> dict:
    base = provenance_base(table)
    source_key = metadata['layers'][base or table]
    record = dict(metadata['sources'][source_key])
    recorded = {
        'publisher': bool(record['publisher']),
        'dataset': bool(record['dataset']),
        'url': bool(record['url']),
        'licence_or_terms': record['licence_status'] != 'not_recorded',
        'temporal_coverage': bool(record['temporal_coverage']),
        'metadata_reference': bool(record['metadata_reference']),
    }
    gaps = [key for key in metadata['metadata_fields'] if not recorded[key]]
    count = len(metadata['metadata_fields']) - len(gaps)
    record.update({
        'source_key': source_key,
        'coverage_status': metadata['coverage'].get(base or table, 'not_assessed'),
        'metadata_fields_recorded': count,
        'metadata_fields_total': len(metadata['metadata_fields']),
        'metadata_status': 'documented' if not gaps else 'partial' if count >= 3 else 'minimal',
        'metadata_gaps': gaps,
        'provenance_of': base or '',
    })
    return record


def validate_inventory(index: dict, metadata: dict | None = None) -> None:
    metadata = metadata or load_metadata()
    active = {table for table in index if not provenance_base(table)}
    mapped = set(metadata['layers'])
    if active != mapped:
        raise ValueError(
            f'Layer metadata inventory mismatch: missing={sorted(active - mapped)}, '
            f'stale={sorted(mapped - active)}')
    for table in index:
        source_metadata(table, metadata)


def quality_use_class(meta: dict, review: dict) -> str:
    if provenance_base(meta['table']):
        return 'hidden_historical_provenance'
    if not meta['visible']:
        return 'hidden_source_restricted'
    if review['disposition'] in ('Review', 'Action required'):
        return 'review_required'
    if review['disposition'] == 'No gross registration error detected':
        return 'current_structural_pass'
    return 'current_with_documented_limits'


def structural_status(meta: dict, core: dict, integrity: dict) -> str:
    historical = bool(provenance_base(meta['table']))
    if integrity.get('integrity_check') != 'ok':
        return 'structural_review_required'
    if meta['kind'] == 'features':
        failed = (
            core['srs_id'] != 4326 or core['null_geometry'] or core['empty_geometry'] or
            core['nonfinite_geometry_count'] or core['outside_longitude_latitude_count'] or
            core['declared_extent_max_delta_degrees'] is None or
            core['declared_extent_max_delta_degrees'] >= 0.001
        )
        if core['invalid_geometry_count']:
            return 'historical_defects_retained' if historical else 'structural_review_required'
    else:
        failed = (
            core['srs_id'] != 4326 or core['bad_tiles'] or not core['pixel_size_positive'] or
            core['bounds_max_delta_degrees'] is None or core['bounds_max_delta_degrees'] >= 0.001
        )
    return 'structural_review_required' if failed else 'structural_pass'


def topology_status(meta: dict, core: dict) -> str:
    if meta['kind'] != 'features' or 'POLYGON' not in core['geometry_type'].upper():
        return 'not_applicable'
    if core['invalid_geometry_count']:
        return 'historical_invalid' if provenance_base(meta['table']) else 'invalid'
    return 'valid'


def _table_details(meta: dict, core: dict) -> dict:
    path = meta['path']
    with sqlite3.connect(f'file:{path}?mode=ro', uri=True) as connection:
        identifier, description, last_change = connection.execute(
            'select identifier,description,last_change from gpkg_contents where table_name=?',
            (meta['table'],),
        ).fetchone()
        attributes = []
        units = None
        nodata = None
        if meta['kind'] == 'features':
            geometry_column = connection.execute(
                'select column_name from gpkg_geometry_columns where table_name=?',
                (meta['table'],),
            ).fetchone()[0]
            columns = [row[1] for row in connection.execute(
                f'pragma table_info({q(meta["table"])})')]
            attributes = [
                column for column in columns
                if column not in ('fid', 'ogc_fid', geometry_column)
            ]
        elif meta['kind'] == '2d-gridded-coverage':
            ancillary = connection.execute(
                'select uom,data_null from gpkg_2d_gridded_coverage_ancillary '
                'where tile_matrix_set_name=?', (meta['table'],),
            ).fetchone()
            if ancillary:
                units, nodata = ancillary
    return {
        'identifier': identifier, 'description': description or '', 'last_change': last_change,
        'attributes': attributes, 'raster_units': units, 'raster_nodata': nodata,
    }


def build_rows(index: dict, audit: dict, catalog: dict, review_rows: list[dict],
               metadata: dict | None = None) -> list[dict]:
    metadata = metadata or load_metadata()
    validate_inventory(index, metadata)
    policy = load_policy()
    reviews = {row['layer']: row for row in review_rows}
    if set(reviews) != set(index):
        raise ValueError('Layer review inventory differs from the source inventory')
    public = {row['table']: row for row in catalog['layers']}
    integrity = {row['path']: row for row in audit['database_integrity']}
    admin_result_path = AUDIT_DIR / 'admin-identifier-result.json'
    admin_result = json.loads(admin_result_path.read_text(encoding='utf8'))
    layer_config_path = ROOT / 'config' / 'layers.config.json'
    layer_config = json.loads(layer_config_path.read_text(encoding='utf8')).get('layers', {})
    rows = []
    for table in sorted(index):
        meta = dict(index[table])
        meta['table'] = table
        path = meta['path']
        relative_path = str(path.relative_to(ROOT))
        core = (audit['vectors'] if meta['kind'] == 'features' else audit['rasters'])[table]
        review = reviews[table]
        details = _table_details(meta, core)
        source = source_metadata(table, metadata)
        cross_border = resolve_layer(
            table, visible=meta['visible'], kind=meta['kind'], policy=policy)
        public_row = public.get(table)
        bounds = core['actual_bounds'] if meta['kind'] == 'features' else core['computed_bounds']
        shape = core.get('expected_stitched_shape')
        findings = [] if review['review_findings'].startswith('None ') else [review['review_findings']]
        limitations = list(findings)
        if cross_border['scope_class'] != 'nigeria_focused':
            limitations.append(cross_border['scope_note'])
        if source['coverage_status'] != 'not_assessed':
            limitations.append(f'Coverage/semantics: {source["coverage_status"]}')
        row = {
            'layer': table,
            'title': layer_config.get(table, {}).get('label') or details['identifier'] or table,
            'group': path.relative_to(DATA).parts[0],
            'source_path': relative_path,
            'visibility': 'visible' if meta['visible'] else 'hidden',
            'kind': meta['kind'],
            'geometry_type': core.get('geometry_type'),
            'feature_count': core.get('feature_count'),
            'grid_rows': shape[0] if shape else None,
            'grid_columns': shape[1] if shape else None,
            'tile_count_at_max_zoom': core.get('tile_count_at_max_zoom'),
            'crs': f'EPSG:{core["srs_id"]}',
            'min_longitude': bounds[0], 'min_latitude': bounds[1],
            'max_longitude': bounds[2], 'max_latitude': bounds[3],
            'attribute_count': len(details['attributes']),
            'attributes': details['attributes'],
            'raster_units': details['raster_units'],
            'raster_nodata': details['raster_nodata'],
            'source_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'gpkg_last_change': details['last_change'],
            'source_description': details['description'],
            'source_description_status': 'recorded' if details['description'].strip() else 'not_recorded',
            **{key: source[key] for key in (
                'source_key', 'publisher', 'dataset', 'coverage_status',
                'metadata_fields_recorded', 'metadata_fields_total', 'metadata_status',
                'metadata_gaps', 'provenance_of')},
            'source_url': source['url'],
            'licence_or_terms': source['licence_or_terms'],
            'licence_status': source['licence_status'],
            'temporal_coverage': source['temporal_coverage'],
            'metadata_reference': source['metadata_reference'],
            'metadata_notes': source['notes'],
            'quality_use_class': quality_use_class(meta, review),
            'structural_status': structural_status(meta, core, integrity[relative_path]),
            'topology_status': topology_status(meta, core),
            'review_status': review['disposition'],
            'review_findings': review['review_findings'],
            'quality_evidence': review['evidence'],
            'recommended_action': review['recommended_action'],
            'quality_limitations': limitations,
            'cross_border_scope': cross_border['scope_class'],
            'national_statistics': cross_border['national_statistics'],
            'admin_identifier_scheme': (
                'ngmap-admin-v1' if table in admin_result.get('after_sha256', {}) else ''),
            'published': bool(public_row),
            'public_layer_id': public_row['id'] if public_row else '',
            'public_file': public_row.get('file') or '' if public_row else '',
        }
        if set(row) != set(REGISTER_FIELDS):
            raise AssertionError(f'Register field mismatch for {table}: {set(row) ^ set(REGISTER_FIELDS)}')
        rows.append(row)
    return rows


def summarise(rows: list[dict], metadata: dict, audit: dict) -> dict:
    field_coverage = {
        field: sum(field not in row['metadata_gaps'] for row in rows)
        for field in metadata['metadata_fields']
    }
    return {
        'layer_count': len(rows),
        'visible_layer_count': sum(row['visibility'] == 'visible' for row in rows),
        'hidden_layer_count': sum(row['visibility'] == 'hidden' for row in rows),
        'published_layer_count': sum(row['published'] for row in rows),
        'hidden_provenance_count': sum(bool(row['provenance_of']) for row in rows),
        'quality_use_class_counts': dict(sorted(Counter(
            row['quality_use_class'] for row in rows).items())),
        'structural_status_counts': dict(sorted(Counter(
            row['structural_status'] for row in rows).items())),
        'metadata_status_counts': dict(sorted(Counter(
            row['metadata_status'] for row in rows).items())),
        'source_description_status_counts': dict(sorted(Counter(
            row['source_description_status'] for row in rows).items())),
        'metadata_field_coverage': field_coverage,
        'layers_with_metadata_gaps': sum(bool(row['metadata_gaps']) for row in rows),
        'layers_missing_licence_terms': [
            row['layer'] for row in rows if row['licence_status'] == 'not_recorded'],
        'layers_requiring_review': [
            row['layer'] for row in rows if row['quality_use_class'] == 'review_required'],
        'structural_review_required': [
            row['layer'] for row in rows if row['structural_status'] == 'structural_review_required'],
        'source_commit': audit['source_commit'],
        'audit_generated_utc': audit['generated_utc'],
        'metadata_config_sha256': metadata['_sha256'],
        'cross_border_policy_sha256': load_policy()['_sha256'],
    }



def _csv_value(value):
    if value is None:
        return ''
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    return value


def write_csv(rows: list[dict], path: Path = REGISTER_CSV) -> None:
    with path.open('w', newline='', encoding='utf8') as handle:
        writer = csv.DictWriter(handle, fieldnames=REGISTER_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: _csv_value(row[key]) for key in REGISTER_FIELDS})


def write_markdown(document: dict, path: Path = REGISTER_MD) -> None:
    summary = document['summary']
    lines = [
        '# Layer quality and metadata register', '',
        f'Register: `{document["register_id"]}` · source commit `{summary["source_commit"]}` · '
        f'{summary["layer_count"]} spatial layers.', '',
        'This register separates **measured structural checks**, **reviewed use limitations**, and '
        '**source-metadata completeness**. It does not assign a numeric accuracy score or certify '
        'legal/survey-grade boundaries. `current_structural_pass` means the applicable automated checks '
        'passed, not that every feature is complete or positionally accurate.', '',
        '## Summary', '',
        f'- **{summary["visible_layer_count"]} visible**, **{summary["hidden_layer_count"]} hidden**, and '
        f'**{summary["published_layer_count"]} published** layers; '
        f'{summary["hidden_provenance_count"]} hidden originals inherit source metadata.',
        '- Quality use classes: ' + ', '.join(
            f'**{key} {value}**' for key, value in summary['quality_use_class_counts'].items()) + '.',
        '- Structural statuses: ' + ', '.join(
            f'**{key} {value}**' for key, value in summary['structural_status_counts'].items()) + '.',
        '- Metadata statuses: ' + ', '.join(
            f'**{key} {value}**' for key, value in summary['metadata_status_counts'].items()) + '.',
        '- GeoPackage descriptions: ' + ', '.join(
            f'**{key} {value}**' for key, value in summary['source_description_status_counts'].items()) + '.',
        f'- **{summary["layers_with_metadata_gaps"]}** layers have at least one explicit metadata gap. '
        'Missing licence/version/publisher fields are not inferred.', '',
        '### Metadata field coverage', '',
        '| Field | Layers recorded | Layers total |', '|---|---:|---:|',
        *[f'| `{key}` | {value} | {summary["layer_count"]} |'
          for key, value in summary['metadata_field_coverage'].items()],
        '', '### Required review', '',
    ]
    if summary['layers_requiring_review']:
        for table in summary['layers_requiring_review']:
            row = next(row for row in document['layers'] if row['layer'] == table)
            lines.append(f'- `{table}`: {row["review_findings"]} {row["recommended_action"]}')
    else:
        lines.append('- No layer currently has the `review_required` use class.')
    lines += [
        '', '## Complete register', '',
        'Blank metadata fields are intentional gaps. The CSV/JSON contain full attributes, bounds, hashes, '
        'raster details, evidence, recommended actions and public-export fields.', '',
        '| Layer | Visibility | Quality use | Structural / topology | Metadata | Publisher / dataset | Licence / terms | Temporal | Scope / limitations |',
        '|---|---|---|---|---|---|---|---|---|',
    ]
    for row in document['layers']:
        limitations = row['quality_limitations'] or ['No feature-specific limitation recorded; see evidence']
        values = [
            f'`{row["layer"]}`', row['visibility'], row['quality_use_class'],
            f'{row["structural_status"]} / {row["topology_status"]}',
            f'{row["metadata_status"]} ({row["metadata_fields_recorded"]}/{row["metadata_fields_total"]})',
            f'{row["publisher"] or "Not recorded"} — {row["dataset"]}',
            row['licence_or_terms'] or 'Not recorded', row['temporal_coverage'] or 'Not recorded',
            '; '.join(limitations),
        ]
        lines.append('| ' + ' | '.join(str(value).replace('|', '\\|') for value in values) + ' |')
    lines += [
        '', '## Interpretation and maintenance', '',
        '- `hidden_historical_provenance` and `hidden_source_restricted` layers are not public production layers.',
        '- `current_with_documented_limits` requires the listed scope/coverage caveats; it is not a defect score.',
        '- `metadata_status` counts six source fields only. It does not judge geometric quality or licence clearance.',
        '- GeoPackage SHA-256 values make stale source/register combinations detectable. Any data or metadata '
        'change requires both audits, this register, and the public build to be regenerated sequentially.',
        '- Source metadata: `config/layer-metadata.json`. Full evidence: `layer-quality-register.json` and '
        '`layer-quality-register.csv`. Cross-border rules: `cross-border-policy-register.csv`.',
        '- For an inventory change, run one provisional public build before this register so public-export '
        'fields are current. The second extended-audit pass includes the current register in the item 8 report.', '',
        '```bash',
        'python scripts/audit_geospatial.py',
        'python scripts/audit_geospatial_extended.py',
        'python scripts/layer_quality_register.py',
        'python scripts/audit_geospatial_extended.py',
        'python scripts/build_site.py',
        'python scripts/validate_artifacts.py',
        'python -m unittest discover -s tests -v',
        '```',
    ]
    path.write_text('\n'.join(lines) + '\n', encoding='utf8')


def build_document(index: dict | None = None) -> dict:
    index = index or layer_index()
    audit = json.loads((AUDIT_DIR / 'audit.json').read_text(encoding='utf8'))
    extended = json.loads((AUDIT_DIR / 'extended-audit.json').read_text(encoding='utf8'))
    catalog = json.loads((ROOT / 'public/catalog.json').read_text(encoding='utf8'))
    with (AUDIT_DIR / 'layer-review.csv').open(encoding='utf8', newline='') as handle:
        reviews = list(csv.DictReader(handle))
    metadata = load_metadata()
    rows = build_rows(index, audit, catalog, reviews, metadata)
    return {
        'register_id': metadata['register_id'],
        'schema_version': metadata['schema_version'],
        'generated_utc': datetime.now(timezone.utc).isoformat(),
        'methodology': {
            'quality_score': 'not_assigned',
            'quality_basis': 'Measured GeoPackage/audit checks plus reviewed layer dispositions and scope limits',
            'metadata_basis': 'Six curated source fields; blank or unrecorded values remain explicit gaps',
            'absolute_accuracy': 'Not certified by structural checks or metadata completeness',
            'source_hash_algorithm': 'SHA-256',
        },
        'summary': summarise(rows, metadata, audit),
        'layers': rows,
        'cross_border_policy': extended.get('cross_border_policy'),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    args = parser.parse_args()
    document = build_document()
    REGISTER_JSON.write_text(json.dumps(document, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
    write_csv(document['layers'])
    write_markdown(document)
    print(
        f'Wrote {REGISTER_JSON}, {REGISTER_CSV} and {REGISTER_MD}: '
        f'{document["summary"]["layer_count"]} layers, '
        f'{document["summary"]["layers_with_metadata_gaps"]} with explicit metadata gaps.')


if __name__ == '__main__':
    main()
