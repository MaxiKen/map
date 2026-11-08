"""Lightweight public-catalog projections of the layer quality register."""
from __future__ import annotations

import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTER_JSON = ROOT / 'docs' / 'geospatial-audit' / 'layer-quality-register.json'


def public_quality(row: dict) -> dict:
    return {
        'registerId': 'ngmap-layer-quality-v1',
        'qualityUseClass': row['quality_use_class'],
        'structuralStatus': row['structural_status'],
        'topologyStatus': row['topology_status'],
        'reviewStatus': row['review_status'],
        'coverageStatus': row['coverage_status'],
        'sourceSha256': row['source_sha256'],
        'limitations': row['quality_limitations'],
    }


def public_source_metadata(row: dict) -> dict:
    return {
        'dataset': row['dataset'], 'publisher': row['publisher'], 'url': row['source_url'],
        'licenceOrTerms': row['licence_or_terms'], 'licenceStatus': row['licence_status'],
        'temporalCoverage': row['temporal_coverage'], 'reference': row['metadata_reference'],
        'notes': row['metadata_notes'], 'description': row['source_description'],
        'metadataStatus': row['metadata_status'],
        'metadataFieldsRecorded': row['metadata_fields_recorded'],
        'metadataFieldsTotal': row['metadata_fields_total'],
        'metadataGaps': row['metadata_gaps'],
    }


def catalog_summary(document: dict, register_path: Path = REGISTER_JSON) -> dict:
    return {
        'registerId': document['register_id'],
        'schemaVersion': document['schema_version'],
        'registerSha256': hashlib.sha256(Path(register_path).read_bytes()).hexdigest(),
        'registerFile': 'quality-register.json',
        'generatedUtc': document['generated_utc'],
        'summary': {
            key: value for key, value in document['summary'].items()
            if key in (
                'layer_count', 'visible_layer_count', 'hidden_layer_count',
                'published_layer_count', 'quality_use_class_counts',
                'structural_status_counts', 'metadata_status_counts',
                'source_description_status_counts', 'metadata_field_coverage',
                'layers_with_metadata_gaps',
            )
        },
    }
