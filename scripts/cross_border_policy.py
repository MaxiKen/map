#!/usr/bin/env python3
"""Resolve the repository's geographic cross-border policy for map layers.

The policy classifies geographic scope and aggregation semantics. It never clips,
moves, deletes or relabels a source feature. The JSON document is the single source
of truth used by the audits, static catalog and artifact validation.
"""
from __future__ import annotations

import hashlib
import json
from collections import Counter
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLICY_PATH = ROOT / 'config' / 'cross-border-policy.json'
CLASS_FIELDS = (
    'description', 'scope_note', 'source_retention', 'national_statistics',
    'foreign_features',
)
PROVENANCE_SUFFIXES = ('_topology_original',)
PROVENANCE_BASES = {
    'admin_lgas_gadm_identity_original_pg': 'admin_lgas_gadm_pg',
    'admin_lga_centroids_identity_original_pt': 'admin_lga_centroids_pt',
    'settlements_state_capitals_map2023_original_pt': 'settlements_state_capitals_map2023_pt',
}


def _validate_document(policy: dict) -> None:
    required = ('policy_id', 'schema_version', 'title', 'classes', 'kind_defaults', 'layers')
    missing = [key for key in required if key not in policy]
    if missing:
        raise ValueError(f'Cross-border policy is missing: {missing}')
    if not isinstance(policy['policy_id'], str) or not policy['policy_id']:
        raise ValueError('Cross-border policy_id must be a non-empty string')
    if policy['schema_version'] != 1:
        raise ValueError('Only cross-border policy schema_version 1 is supported')
    for name, definition in policy['classes'].items():
        absent = [key for key in CLASS_FIELDS if not definition.get(key)]
        if absent:
            raise ValueError(f'Cross-border class {name}: missing {absent}')
        if definition['source_retention'] != 'preserve_unclipped':
            raise ValueError(f'Cross-border class {name}: source retention must be preserve_unclipped')
    for kind, scope_class in policy['kind_defaults'].items():
        if scope_class not in policy['classes']:
            raise ValueError(f'Cross-border kind default {kind}: unknown class {scope_class}')
    for table, rule in policy['layers'].items():
        if rule.get('scope_class') not in policy['classes']:
            raise ValueError(f'Cross-border layer {table}: unknown scope_class')
        if table.endswith(PROVENANCE_SUFFIXES) or table in PROVENANCE_BASES:
            raise ValueError(f'Cross-border provenance {table} must inherit its active layer rule')
        unexpected = set(rule) - {'scope_class', 'scope_note'}
        if unexpected:
            raise ValueError(f'Cross-border layer {table}: unsupported overrides {sorted(unexpected)}')


@lru_cache(maxsize=4)
def load_policy(path: Path = POLICY_PATH) -> dict:
    path = Path(path)
    raw = path.read_bytes()
    policy = json.loads(raw)
    _validate_document(policy)
    policy['_path'] = path
    policy['_sha256'] = hashlib.sha256(raw).hexdigest()
    return policy


def provenance_base(table: str) -> str | None:
    if table in PROVENANCE_BASES:
        return PROVENANCE_BASES[table]
    for suffix in PROVENANCE_SUFFIXES:
        if table.endswith(suffix):
            return table[:-len(suffix)]
    return None


def resolve_layer(table: str, *, visible: bool = True, kind: str = 'features',
                  policy: dict | None = None) -> dict:
    """Return complete source/publication/aggregation semantics for one layer."""
    policy = policy or load_policy()
    base = provenance_base(table)
    rule = policy['layers'].get(base or table, {})
    scope_class = rule.get('scope_class') or policy['kind_defaults'].get(
        kind, policy['kind_defaults']['features'])
    definition = policy['classes'][scope_class]
    publication = (
        'hidden_provenance' if base else
        'full_layer' if visible else 'hidden_source'
    )
    result = {
        'policy_id': policy['policy_id'],
        'schema_version': policy['schema_version'],
        'scope_class': scope_class,
        'scope_note': rule.get('scope_note') or definition['scope_note'],
        'source_retention': definition['source_retention'],
        'publication': publication,
        'national_statistics': definition['national_statistics'],
        'foreign_features': definition['foreign_features'],
    }
    if base:
        result['provenance_of'] = base
    return result


def public_metadata(rule: dict) -> dict:
    """Compact camelCase metadata embedded in each public catalog layer."""
    return {
        'policyId': rule['policy_id'],
        'scopeClass': rule['scope_class'],
        'scopeNote': rule['scope_note'],
        'sourceRetention': rule['source_retention'],
        'nationalStatistics': rule['national_statistics'],
        'foreignFeatures': rule['foreign_features'],
    }


def catalog_policy(policy: dict | None = None) -> dict:
    """Policy definitions required to interpret public per-layer metadata."""
    policy = policy or load_policy()
    return {
        'policyId': policy['policy_id'],
        'schemaVersion': policy['schema_version'],
        'policySha256': policy['_sha256'],
        'title': policy['title'],
        'geographicReference': policy['geographic_reference'],
        'nationalAggregationRules': policy['national_aggregation_rules'],
        'classes': {
            name: {
                'description': definition['description'],
                'sourceRetention': definition['source_retention'],
                'nationalStatistics': definition['national_statistics'],
                'foreignFeatures': definition['foreign_features'],
            }
            for name, definition in policy['classes'].items()
        },
    }


def explicit_scope_notes(policy: dict | None = None) -> dict[str, str]:
    """Notes for explicitly classified layers, used by the detailed review register."""
    policy = policy or load_policy()
    return {
        table: rule.get('scope_note') or policy['classes'][rule['scope_class']]['scope_note']
        for table, rule in policy['layers'].items()
    }


def register_rows(index: dict, policy: dict | None = None) -> list[dict]:
    policy = policy or load_policy()
    rows = []
    for table in sorted(index):
        meta = index[table]
        rule = resolve_layer(table, visible=meta['visible'], kind=meta['kind'], policy=policy)
        rows.append({
            'layer': table,
            'path': str(meta['path'].relative_to(ROOT)),
            'visibility': 'visible' if meta['visible'] else 'hidden',
            'kind': meta['kind'],
            'scope_class': rule['scope_class'],
            'source_retention': rule['source_retention'],
            'publication': rule['publication'],
            'national_statistics': rule['national_statistics'],
            'foreign_features': rule['foreign_features'],
            'provenance_of': rule.get('provenance_of', ''),
            'scope_note': rule['scope_note'],
        })
    return rows


def policy_summary(index: dict, policy: dict | None = None) -> dict:
    policy = policy or load_policy()
    rows = register_rows(index, policy)
    return {
        'policy_id': policy['policy_id'],
        'schema_version': policy['schema_version'],
        'policy_path': str(policy['_path'].relative_to(ROOT)),
        'policy_sha256': policy['_sha256'],
        'status': 'defined_and_propagated',
        'source_geometry_changes': 0,
        'layer_count': len(rows),
        'visible_layer_count': sum(row['visibility'] == 'visible' for row in rows),
        'hidden_layer_count': sum(row['visibility'] == 'hidden' for row in rows),
        'provenance_layer_count': sum(bool(row['provenance_of']) for row in rows),
        'class_counts': dict(sorted(Counter(row['scope_class'] for row in rows).items())),
        'visible_class_counts': dict(sorted(Counter(
            row['scope_class'] for row in rows if row['visibility'] == 'visible').items())),
        'all_sources_preserved_unclipped': all(
            row['source_retention'] == 'preserve_unclipped' for row in rows),
    }


def validate_inventory(index: dict, policy: dict | None = None) -> None:
    """Fail on stale overrides or an inventory that cannot be resolved."""
    policy = policy or load_policy()
    tables = set(index)
    bases = {provenance_base(table) for table in tables} - {None}
    stale = sorted(set(policy['layers']) - tables - bases)
    if stale:
        raise ValueError(f'Cross-border policy has stale layer overrides: {stale}')
    for table, meta in index.items():
        resolve_layer(table, visible=meta['visible'], kind=meta['kind'], policy=policy)
