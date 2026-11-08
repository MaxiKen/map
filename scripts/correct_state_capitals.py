#!/usr/bin/env python3
"""Review and correct state-capital coordinates with independent provenance.

Default mode is read-only and writes a 37-row correction ledger:

    python scripts/correct_state_capitals.py

After reviewing rows marked review_required, apply with:

    python scripts/correct_state_capitals.py --apply --approve-reviewed

Thirty-two scanned-map symbol/dot positions are candidates for replacement by
same-name OSM city/town nodes. Five approximate gazetteer positions are retained
when both available independent references are within 5 km. Every replacement
must fall inside its named GADM state and use a city/town node. DIVA is retained
as an independent cross-check; it is not averaged into the OSM coordinate.

The original visible GeoPackage is preserved as a hidden, uniquely named
provenance layer. The visible layer records previous coordinates, correction
distance, coordinate source and QA notes. No national or per-layer translation
is applied. The operation is atomic and refuses to overwrite an earlier correction.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import shutil
import sqlite3
import struct
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import shapely
from shapely import wkb
from shapely.geometry import Point

from audit_geospatial import (
    ROOT, DATA, gpkg_geometry, load_features, norm, shapely_metric,
)

VISIBLE = DATA / 'Settlements' / 'settlements_state_capitals_map2023_pt.gpkg'
TABLE = 'settlements_state_capitals_map2023_pt'
HIDDEN = DATA / 'Settlements' / 'hidden_settlements_state_capitals_map2023_original_pt.gpkg'
HIDDEN_TABLE = 'settlements_state_capitals_map2023_original_pt'
OUT = ROOT / 'docs' / 'geospatial-audit'
LEDGER = OUT / 'capital-correction-ledger.csv'
RESULT = OUT / 'capital-correction-result.json'

# Individually reviewed cases where place rank alone is not sufficient.
PREFERRED_OSM = {
    'Yola': {
        'longitude': 12.483333, 'latitude': 9.2,
        'reason': 'Selected the OSM town node because it coincides with DIVA and the conventional Yola coordinate; the separate city node represents the northern metropolitan/Jimeta centre.',
    },
}


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def gpkg_point(point):
    """Little-endian GeoPackage header with a current XY envelope, then WKB."""
    header = b'GP' + bytes([0, 3]) + struct.pack(
        '<i4d', 4326, point.x, point.x, point.y, point.y)
    return header + wkb.dumps(point, byte_order=1, include_srid=False)


def distance(a, b):
    return shapely_metric(a).distance(shapely_metric(b)) / 1000


def build_ledger():
    source_hash = sha256(VISIBLE)
    states, _ = load_features('admin_states_gadm_pg', ['state'])
    state_lookup = {norm(f['properties']['state']): f['geometry'] for f in states}
    osm, _ = load_features('settlements_places_osm_pt', ['name', 'place', 'state'])
    diva, _ = load_features(
        'settlements_gazetteer_diva_pt', ['name', 'feature_designation', 'state'])
    osm_by_name = defaultdict(list)
    diva_by_name = defaultdict(list)
    for feature in osm:
        osm_by_name[norm(feature['properties'].get('name'))].append(feature)
    for feature in diva:
        diva_by_name[norm(feature['properties'].get('name'))].append(feature)

    rows = []
    with sqlite3.connect(f'file:{VISIBLE}?mode=ro', uri=True) as con:
        capitals = con.execute(
            f'select fid,geom,name,state,position_basis,offset_from_basis_km from {TABLE} order by fid'
        ).fetchall()
    if len(capitals) != 37:
        raise RuntimeError(f'expected 37 capitals, found {len(capitals)}')

    for fid, blob, name, state, basis, old_offset in capitals:
        current = gpkg_geometry(blob)
        state_geometry = state_lookup[norm(state)]
        if not state_geometry.intersects(current):
            raise RuntimeError(f'{name}: existing point is outside {state}; resolve before correction')
        osm_candidates = osm_by_name[norm(name)]
        diva_candidates = [f for f in diva_by_name[norm(name)]
                           if f['properties'].get('feature_designation') != 'airport']
        # Same-name settlements in other states are not independent corroboration.
        same_state_diva = [f for f in diva_candidates
                           if norm(f['properties'].get('state')) == norm(state)]
        contained_diva = [f for f in diva_candidates if state_geometry.intersects(f['geometry'])]
        diva_candidates = same_state_diva or contained_diva
        if not osm_candidates:
            raise RuntimeError(f'{name}: no exact-name OSM candidate')

        def diva_rank(feature):
            return {
                'seat of a first-order administrative division': 0,
                'national capital': 0, 'populated place': 1,
            }.get(feature['properties'].get('feature_designation'), 2)

        best_diva = min(diva_candidates, key=lambda f: (
            diva_rank(f), distance(current, f['geometry']))) if diva_candidates else None
        populated_osm = [f for f in osm_candidates
                         if f['properties'].get('place') in ('city', 'town')]
        best_osm_for_review = min(populated_osm or osm_candidates,
                                  key=lambda f: distance(current, f['geometry']))
        osm_review_distance = distance(current, best_osm_for_review['geometry'])
        diva_review_distance = distance(current, best_diva['geometry']) if best_diva else None
        retain = (basis or '').startswith('approximate gazetteer coordinate')
        if retain and (osm_review_distance > 5 or
                       (diva_review_distance is not None and diva_review_distance > 5)):
            raise RuntimeError(f'{name}: approximate position no longer meets the 5 km retention rule')

        review_reasons = []
        if retain:
            selected = best_osm_for_review
            action = 'retain_corroborated_gazetteer'
            replacement = current
            correction_distance = 0.0
            if not state_geometry.intersects(selected['geometry']):
                review_reasons.append(
                    'OSM reference lies across the GADM state boundary; current Delta/state-contained approximation retained')
            coordinate_source = 'Original approximate gazetteer coordinate retained after OSM/DIVA review'
            new_basis = 'Retained approximate gazetteer coordinate; OSM/DIVA cross-check'
            qa_note = (f'Retained: OSM {osm_review_distance:.2f} km and DIVA '
                       f'{diva_review_distance:.2f} km from current coordinate; no precision-justified move.')
        else:
            action = 'replace_with_osm_city_or_town'
            inside = [f for f in osm_candidates if state_geometry.intersects(f['geometry'])]
            if not inside:
                raise RuntimeError(f'{name}: no OSM candidate inside {state}; manual source review required')
            city_or_town = [f for f in inside if f['properties'].get('place') in ('city', 'town')]
            if not city_or_town:
                raise RuntimeError(f'{name}: no OSM city/town candidate inside {state}')

            def candidate_score(feature):
                place_rank = 0 if feature['properties']['place'] == 'city' else 1
                independent_distance = (distance(feature['geometry'], best_diva['geometry'])
                                        if best_diva else distance(current, feature['geometry']))
                return place_rank, independent_distance, distance(current, feature['geometry'])

            selected = min(city_or_town, key=candidate_score)
            if name in PREFERRED_OSM:
                preferred = PREFERRED_OSM[name]
                curated = [f for f in city_or_town
                           if abs(f['geometry'].x - preferred['longitude']) < 0.000001
                           and abs(f['geometry'].y - preferred['latitude']) < 0.000001]
                if len(curated) != 1:
                    raise RuntimeError(f'{name}: curated OSM node was not found exactly once')
                selected = curated[0]
                review_reasons.append(preferred['reason'])
            replacement = selected['geometry']
            correction_distance = distance(current, replacement)
            coordinate_source = 'OpenStreetMap same-name populated-place node'
            new_basis = f"OSM {selected['properties']['place']} node; GADM state containment + DIVA cross-check"
            qa_note = 'Replaced scanned-map source position; exact name, city/town type and named-state containment verified.'
            if norm(selected['properties'].get('state')) != norm(state):
                review_reasons.append('OSM admin attribute differs from named state; geometric containment used')
        independent_distance = (distance(replacement, best_diva['geometry'])
                                if best_diva else None)
        if not retain and independent_distance is not None and independent_distance > 5:
            review_reasons.append(
                f'OSM and DIVA populated-place centres differ by {independent_distance:.2f} km; OSM city/town node preferred')
        if correction_distance > 30:
            review_reasons.append(f'correction exceeds 30 km ({correction_distance:.2f} km)')
        if not state_geometry.intersects(replacement):
            raise RuntimeError(f'{name}: selected replacement is outside {state}')

        rows.append({
            'fid': fid, 'capital': name, 'state': state, 'action': action,
            'previous_position_basis': basis,
            'previous_offset_from_basis_km': old_offset,
            'previous_longitude': current.x, 'previous_latitude': current.y,
            'new_longitude': replacement.x, 'new_latitude': replacement.y,
            'correction_distance_km': correction_distance,
            'coordinate_source': coordinate_source, 'new_position_basis': new_basis,
            'osm_name': selected['properties'].get('name'),
            'osm_place': selected['properties'].get('place'),
            'osm_state_attribute': selected['properties'].get('state'),
            'osm_candidate_count_same_name': len(osm_candidates),
            'osm_longitude': selected['geometry'].x, 'osm_latitude': selected['geometry'].y,
            'diva_name': best_diva['properties'].get('name') if best_diva else None,
            'diva_designation': best_diva['properties'].get('feature_designation') if best_diva else None,
            'diva_longitude': best_diva['geometry'].x if best_diva else None,
            'diva_latitude': best_diva['geometry'].y if best_diva else None,
            'diva_crosscheck_km': independent_distance,
            'state_containment_passed': True,
            'review_required': bool(review_reasons), 'review_reason': '; '.join(review_reasons),
            'qa_note': qa_note, 'source_sha256': source_hash,
        })
    return rows


def write_ledger(rows):
    OUT.mkdir(parents=True, exist_ok=True)
    fields = list(rows[0])
    with LEDGER.open('w', newline='', encoding='utf8') as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def rename_provenance(con):
    con.execute(f'alter table {TABLE} rename to {HIDDEN_TABLE}')
    con.execute(
        'update gpkg_contents set table_name=?,identifier=?,description=?,last_change=strftime(\'%Y-%m-%dT%H:%M:%fZ\',\'now\') where table_name=?',
        (HIDDEN_TABLE, HIDDEN_TABLE,
         'Uncorrected 2023-map state-capital source positions retained only for provenance. '
         'Do not use as ground-truth coordinates; see capital-correction-ledger.csv.', TABLE))
    con.execute('update gpkg_geometry_columns set table_name=? where table_name=?', (HIDDEN_TABLE, TABLE))
    con.execute('update sqlite_sequence set name=? where name=?', (HIDDEN_TABLE, TABLE))
    if con.execute("select 1 from sqlite_master where type='table' and name='gpkg_extensions'").fetchone():
        con.execute('update gpkg_extensions set table_name=? where table_name=?', (HIDDEN_TABLE, TABLE))


def apply_correction(rows):
    if HIDDEN.exists():
        raise RuntimeError(f'hidden provenance already exists: {HIDDEN}; refusing to overwrite')
    pending = [r['capital'] for r in rows if r['review_required']]
    if pending and not apply_correction.approve_reviewed:
        raise RuntimeError('review required for: ' + ', '.join(pending) +
                           '; inspect the ledger and rerun with --approve-reviewed')
    source_hash = sha256(VISIBLE)
    if {r['source_sha256'] for r in rows} != {source_hash}:
        raise RuntimeError('source GeoPackage changed after ledger generation; regenerate and review')
    visible_tmp = VISIBLE.with_suffix('.correcting.gpkg')
    hidden_tmp = HIDDEN.with_suffix('.creating.gpkg')
    for path in (visible_tmp, hidden_tmp):
        if path.exists():
            path.unlink()
    shutil.copy2(VISIBLE, visible_tmp)
    shutil.copy2(VISIBLE, hidden_tmp)
    try:
        with sqlite3.connect(hidden_tmp) as con:
            rename_provenance(con)
            assert con.execute('pragma integrity_check').fetchone()[0] == 'ok'
            con.commit()
            con.execute('vacuum')

        with sqlite3.connect(visible_tmp) as con:
            con.execute('begin immediate')
            additions = {
                'coordinate_source': 'TEXT', 'previous_longitude': 'REAL',
                'previous_latitude': 'REAL', 'previous_position_basis': 'TEXT',
                'correction_distance_km': 'REAL', 'diva_crosscheck_km': 'REAL', 'qa_note': 'TEXT',
            }
            for column, dtype in additions.items():
                con.execute(f'alter table {TABLE} add column {column} {dtype}')
            for row in rows:
                point = Point(row['new_longitude'], row['new_latitude'])
                con.execute(
                    f'''update {TABLE} set geom=?,position_basis=?,coordinate_source=?,
                    previous_longitude=?,previous_latitude=?,previous_position_basis=?,
                    correction_distance_km=?,diva_crosscheck_km=?,qa_note=? where fid=?''',
                    (gpkg_point(point), row['new_position_basis'], row['coordinate_source'],
                     row['previous_longitude'], row['previous_latitude'], row['previous_position_basis'],
                     row['correction_distance_km'], row['diva_crosscheck_km'],
                     row['qa_note'] + (' ' + row['review_reason'] if row['review_reason'] else ''), row['fid']))
            con.execute(f'alter table {TABLE} drop column offset_from_basis_km')
            xs = [r['new_longitude'] for r in rows]
            ys = [r['new_latitude'] for r in rows]
            description = (
                'Reviewed state-capital positions: 32 same-name OSM city/town replacements and '
                'five retained corroborated gazetteer coordinates. Previous coordinates and '
                'per-feature QA are stored in attributes; DIVA is an independent cross-check. '
                'The uncorrected source is preserved in '
                'hidden_settlements_state_capitals_map2023_original_pt.gpkg.')
            con.execute(
                "update gpkg_contents set min_x=?,min_y=?,max_x=?,max_y=?,description=?,"
                "last_change=strftime('%Y-%m-%dT%H:%M:%fZ','now') where table_name=?",
                (min(xs), min(ys), max(xs), max(ys), description, TABLE))
            con.commit()
            assert con.execute('pragma integrity_check').fetchone()[0] == 'ok'
            assert con.execute(f'select count(*) from {TABLE}').fetchone()[0] == 37
            assert con.execute(
                f'select count(*) from {TABLE} where coordinate_source is null or qa_note is null'
            ).fetchone()[0] == 0
            con.execute('vacuum')

        os.replace(hidden_tmp, HIDDEN)
        os.replace(visible_tmp, VISIBLE)
    except Exception:
        for path in (visible_tmp, hidden_tmp):
            if path.exists():
                path.unlink()
        raise

    # Preserve the pre-correction evidence before the next extended audit rebuilds it.
    for suffix in ('csv', 'png'):
        source = OUT / f'capital-coordinate-comparison.{suffix}'
        target = OUT / f'capital-coordinate-comparison-before.{suffix}'
        if source.exists() and not target.exists():
            shutil.copy2(source, target)
    result = {
        'applied_utc': datetime.now(timezone.utc).isoformat(),
        'visible_file': str(VISIBLE.relative_to(ROOT)), 'visible_sha256': sha256(VISIBLE),
        'hidden_provenance_file': str(HIDDEN.relative_to(ROOT)), 'hidden_sha256': sha256(HIDDEN),
        'hidden_table': HIDDEN_TABLE, 'source_sha256_before_correction': source_hash,
        'corrected_with_osm': sum(r['action'] == 'replace_with_osm_city_or_town' for r in rows),
        'retained_corroborated_gazetteer': sum(r['action'] == 'retain_corroborated_gazetteer' for r in rows),
        'reviewed_exceptions': [r['capital'] for r in rows if r['review_required']],
        'maximum_diva_crosscheck_km': max(r['diva_crosscheck_km'] or 0 for r in rows),
        'ledger': str(LEDGER.relative_to(ROOT)),
    }
    RESULT.write_text(json.dumps(result, indent=2) + '\n', encoding='utf8')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--approve-reviewed', action='store_true',
                        help='confirm that every review_required ledger row has been professionally reviewed')
    args = parser.parse_args()
    with sqlite3.connect(f'file:{VISIBLE}?mode=ro', uri=True) as con:
        corrected = con.execute(
            "select 1 from pragma_table_info(?) where name='coordinate_source'", (TABLE,)).fetchone()
    if corrected:
        print('State capitals already contain correction provenance; no changes made.')
        return
    rows = build_ledger()
    write_ledger(rows)
    replaced = [r for r in rows if r['action'] == 'replace_with_osm_city_or_town']
    retained = [r for r in rows if r['action'] == 'retain_corroborated_gazetteer']
    reviewed = [r for r in rows if r['review_required']]
    print(f'Ledger: {LEDGER}')
    print(f'OSM replacements: {len(replaced)}; retained corroborated gazetteer positions: {len(retained)}')
    print(f'Rows requiring documented review: {len(reviewed)}')
    for row in reviewed:
        print(f"  {row['capital']}: {row['review_reason']}")
    independent = [r['diva_crosscheck_km'] for r in rows if r['diva_crosscheck_km'] is not None]
    if independent:
        import numpy as np
        print('Post-correction DIVA cross-check median/p95/max km:',
              round(float(np.median(independent)), 3),
              round(float(np.percentile(independent, 95)), 3),
              round(float(max(independent)), 3))
    if args.apply:
        apply_correction.approve_reviewed = args.approve_reviewed
        result = apply_correction(rows)
        print(json.dumps(result, indent=2))
    else:
        print('Dry run only: no GeoPackage was changed.')


if __name__ == '__main__':
    main()
