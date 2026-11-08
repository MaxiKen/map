#!/usr/bin/env python3
"""Review 40 residual ward/LGA exceptions and apply only verified label fixes.

Default mode is read-only with respect to source GeoPackages. It preserves the
40-row pre-review exception register and writes a case ledger, verification and
human-readable report:

    python scripts/correct_residual_ward_lgas.py

Apply only after reviewing the evidence and verification gates:

    python scripts/correct_residual_ward_lgas.py --apply --approve-verified

INEC registration-area directories control ward-to-LGA assignment. Independent
ArcGIS point-intersection results are boundary evidence, not a reason to relabel
a containing polygon or move a ward. Only Kwarau, Gidan Waya and Ward XI E9 I
have sufficiently strong evidence for an LGA attribute correction. Their
centroid-distance attributes are recomputed; every ward geometry blob stays
byte-identical. All 40 dispositions, including retained exceptions and naming
or delimitation cautions, are recorded in the ledger.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import shutil
import sqlite3
from collections import Counter
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

import shapely

from audit_geospatial import ROOT, gpkg_geometry, layer_index, norm, q, shapely_metric

OUT = ROOT / 'docs/geospatial-audit'
CURRENT_EXCEPTIONS = OUT / 'ward-lga-exceptions.csv'
BASELINE = OUT / 'ward-lga-exceptions-before-residual-review.csv'
LEDGER = OUT / 'ward-lga-review-ledger.csv'
VERIFICATION = OUT / 'ward-lga-review-verification.json'
RESULT = OUT / 'ward-lga-correction-result.json'
JOURNAL = OUT / 'ward-lga-correction-install-journal.json'
REPORT = OUT / 'ward-lga-review.md'
SOURCES = OUT / 'references/ward-lga-review-sources.md'
TABLE = 'admin_wards_pt'
POLYGONS = 'admin_lgas_gadm_pg'
CENTROIDS = 'admin_lga_centroids_pt'
CHANGES = {4095: 'Igabi', 4214: "Jema'a", 7294: 'Ibadan North East'}
CORRECTION_NOTES = {
    4095: ('INEC lists KWARAU code 10 in Igabi; the complete Kaduna North list does not '
           'contain it. Local and independent polygons both contain the fixed point in Igabi.'),
    4214: ("INEC lists GIDAN WAYA code 07 in Jema'a; Sanga lists ARAK but not Gidan Waya. "
           "Local and independent polygons both contain the fixed point in Jema'a."),
    7294: ('INEC lists WARD E9I code 011 in Ibadan North East; Ibadan South East uses C/S '
           'wards and has no E9I. The local polygon contains the fixed point in Ibadan North '
           'East. The independent service instead says Egbeda; that disagreement is retained, '
           'not hidden or used to override INEC.'),
}
CATEGORY_COUNTS = {
    'correct_lga': 3,
    'retain_boundary_generalisation': 20,
    'retain_coastal_water': 14,
    'retain_suspect_coordinate': 2,
    'retain_delimitation_uncertainty': 1,
}

# feature_index, official ward label, RA code, independent LGA, OBJECTID, ID,
# disposition, case-specific note. feature_index is zero-based; FID = index + 1.
CASES = [
    (59, 'AMASAA NSULU', '', 'Isiala Ngwa South', 14, '0114', 'retain_boundary_generalisation',
     'Local Ikwuano and independent Isiala Ngwa South disagree with INEC Isiala Ngwa North at only 0.054 km.'),
    (472, 'ETIM EKPO X', '10', 'Etim Ekpo', 74, '0430', 'retain_boundary_generalisation',
     'Independent Etim Ekpo supports INEC; local Ika containment is a 0.130 km boundary discrepancy.'),
    (668, 'URBAN IV', '04', 'Udung Uko', 52, '0408', 'retain_boundary_generalisation',
     'INEC Oron is retained; local Mbo and independent Udung Uko results show source disagreement at 0.104 km.'),
    (1184, 'GAMBAKI/BIDIR', '07', 'Shira', 116, '0620', 'retain_suspect_coordinate',
     'INEC assigns the ward to Katagum, but local and independent boundaries both say Shira and the point is 5.062 km outside Katagum. Retain the official LGA and flag the coordinate for separate authoritative corroboration.'),
    (1282, 'MINIBIE', '09', 'Brass', 117, '0701', 'retain_coastal_water',
     'Local land polygons have no container; independent Brass agrees with INEC. Treat as coastal/water coverage, not an attribute error.'),
    (1762, 'GUZAMALI WEST', '06', 'Guzamala', 161, '0914', 'retain_boundary_generalisation',
     'Independent Guzamala supports INEC; local Nganzai is a 0.340 km boundary discrepancy. Guzamala/Guzamali spelling is not changed.'),
    (2007, 'EFUT INSANG', '08', '', None, '', 'retain_coastal_water',
     'Both boundary sources lack a land container at this Bakassi coastal point. Efut Inwang/EFUT INSANG is recorded as a name variant, not silently renamed.'),
    (2195, 'NGBILEBIRI I', '07', 'Ughelli South', 211, '1119', 'retain_boundary_generalisation',
     'INEC Burutu is retained; local and independent Ughelli South results indicate a 0.235 km river/boundary discrepancy.'),
    (2334, 'PATANI I', '02', 'Patani', 214, '1122', 'retain_boundary_generalisation',
     'Independent Patani supports INEC; local Isoko South containment is a 0.598 km boundary discrepancy.'),
    (2431, 'ORERE', '08', 'Warri South West', 205, '1113', 'retain_coastal_water',
     'Local land polygons have no container; independent Warri South West agrees with INEC.'),
    (2821, 'ILASA II/IKUN/ARAROMI', '', 'Ikole', 257, '1409', 'retain_suspect_coordinate',
     'INEC assigns the ward to Ekiti East, but local and independent boundaries both say Ikole and the point is 3.762 km outside Ekiti East. Retain the official LGA and flag the coordinate for separate authoritative corroboration.'),
    (3291, 'KARSHI', '08', 'Abuja Municipal', 20, '0203', 'retain_boundary_generalisation',
     'Independent Abuja Municipal supports the AMAC assignment; local Kuje is a 0.561 km boundary discrepancy. Local Kashi versus official Karshi remains a separate name-review caution.'),
    (4095, 'KWARAU', '10', 'Igabi', 367, '1921', 'correct_lga', CORRECTION_NOTES[4095]),
    (4210, 'ARAK', '10', 'Sanga', 351, '1905', 'retain_boundary_generalisation',
     "Independent Sanga supports INEC although local Jema'a is 1.812 km from assigned Sanga. This supports a local polygon discrepancy, not a ward relabel or coordinate move."),
    (4214, 'GIDAN WAYA', '07', "Jema'A", 355, '1909', 'correct_lga', CORRECTION_NOTES[4214]),
    (4456, 'LAKWAYA', '06', 'Gwarzo', 386, '2017', 'retain_boundary_generalisation',
     'Independent Gwarzo supports INEC; local Shanono is a 0.931 km boundary discrepancy.'),
    (4823, 'TSANGAAMAWA', '05', 'Giwa', 350, '1904', 'retain_boundary_generalisation',
     'INEC Danja is retained only 0.013 km from its boundary; local and independent Giwa agree across the state-edge discrepancy. Tsangamawa/TSANGAAMAWA spelling is unchanged.'),
    (5070, "BABBAN DUHU A", '05', 'Safana', 445, '2132', 'retain_boundary_generalisation',
     'Independent Safana supports INEC; local Batsari is a 0.051 km boundary discrepancy.'),
    (5127, 'GWAZANGE/KISAWA/U GYAGA', '06', 'Argungu', 450, '2203', 'retain_boundary_generalisation',
     'Independent Argungu supports INEC; local Augie is a 0.171 km boundary discrepancy.'),
    (6042, 'PANDA/KARE', '10', 'Karu', 530, '2605', 'retain_boundary_generalisation',
     'The INEC Karu sequence and supplementary ward list identify Panda/Kare code 10; independent Karu also contains the point. Local Kagarko is therefore a 2.135 km local polygon discrepancy, not evidence for relabelling.'),
    (6952, 'IRAGBERI I', '005', 'Egbedore', 603, '3002', 'retain_boundary_generalisation',
     'Independent Egbedore supports INEC; local Ejigbo is a 0.278 km discrepancy. The PDF repeats IDO-OSUN at code 005 but its RAC is IRAGBERI TOWN HALL; the local spelling is retained.'),
    (6990, 'AYE', '011', 'Ife South', 609, '3008', 'retain_boundary_generalisation',
     'Independent Ife South supports INEC; local Ife East is a 0.479 km boundary discrepancy.'),
    (6994, 'KERE', '009', 'Ife South', 609, '3008', 'retain_boundary_generalisation',
     'Independent Ife South supports INEC; local Ife North is a 0.126 km boundary discrepancy.'),
    (7294, 'WARD E9I', '011', 'Egbeda', 640, '3109', 'correct_lga', CORRECTION_NOTES[7294]),
    (7733, 'KURUNGBAU (B)', '04', 'Shendam', 679, '3215', 'retain_boundary_generalisation',
     'Independent Shendam supports INEC; local Langtang South is a 0.150 km boundary discrepancy.'),
    (7811, 'ATABA II', '11', 'Khana', 688, '3307', 'retain_coastal_water',
     'INEC Andoni is retained. Local land has no container and independent Khana disagrees; do not use either coastal polygon to move or relabel the ward.'),
    (7817, 'UNYEADA II', '07', 'Andoni', 696, '3315', 'retain_coastal_water',
     'Local land has no container; independent Andoni agrees with INEC.'),
    (7851, 'BUKUMA', '15', 'Degema', 690, '3309', 'retain_coastal_water',
     'INEC lists BUKUMA code 15 in Degema and independent Degema contains the point; local land has no container.'),
    (7853, 'DEGEMA II', '12', 'Akukutoru', 682, '3301', 'retain_coastal_water',
     'Legacy Degema II is retained within official Degema; local land has no container and independent Akukutoru disagrees in this riverine area.'),
    (7854, 'DEGEMA III', '13', 'Obua/Odual', 683, '3302', 'retain_coastal_water',
     'Legacy Degema III is retained within official Degema; local land has no container and independent Obua/Odual disagrees in this riverine area.'),
    (7860, 'TOMBLE IV', '10', 'Degema', 690, '3309', 'retain_coastal_water',
     'Independent Degema supports the assignment; local land has no container 1.067 km from Degema. Current INEC uses TOMBIA while legacy ward lists use Tomble IV; no name change is made.'),
    (7891, 'IGBO II', '04', 'Ikwerre', 694, '3313', 'retain_boundary_generalisation',
     'INEC Etche is retained; local and independent Ikwerre agree at a 0.245 km boundary discrepancy.'),
    (7997, 'OGU VI', '06', 'Ogu/Bolo', 697, '3316', 'retain_coastal_water',
     'Local land has no container; independent Ogu/Bolo agrees with INEC.'),
    (8003, 'OGOLOMA III', '12', 'Okrika', 699, '3318', 'retain_coastal_water',
     'Local land has no container; independent Okrika agrees with INEC. Ogoloma/OGOLOMA spelling is unchanged.'),
    (8028, 'NKORO II', '10', 'Opobo/Nkoro', 701, '3320', 'retain_coastal_water',
     'Local land has no container; independent Opobo/Nkoro agrees with INEC.'),
    (8042, 'ABULOMA/AMADI-AMA', '20', 'Okrika', 699, '3318', 'retain_coastal_water',
     'INEC Port Harcourt is retained; local land has no container and independent Okrika disagrees at this coastal-edge case.'),
    (8048, 'NKPOLU OROWORUKWO (TWO)', '18', 'Port Harcourt', 702, '3321', 'retain_coastal_water',
     'Local land has no container only 0.003 km from Port Harcourt; independent Port Harcourt agrees with INEC.'),
    (8149, 'DARNA/ SABON GARI', '', 'Illela', 709, '3405', 'retain_boundary_generalisation',
     'INEC Illela and the corrected independent identity are retained; local Gwadabawa is a 0.242 km residual. This is unchanged by the residual review.'),
    (8342, 'FIINDA-DUTSE', '05', 'Donga', 730, '3503', 'retain_boundary_generalisation',
     "Independent Donga supports INEC; local Takum is a 0.415 km discrepancy. Gindin Dutse versus current INEC FIINDA-DUTSE is a name/source-vintage caution, not an LGA correction."),
    (8447, 'KWAMBAI', '', '', None, '', 'retain_delimitation_uncertainty',
     'The current INEC PDF leaves Ussa RA 09–11 unresolved, and Kwambai has a documented Takum/Ussa delimitation dispute. Local and independent polygons both lack a container. Retain Ussa and the fixed coordinate with explicit uncertainty; no safe relabel is evidence-backed.'),
]

DIRECTORIES = {
    'Abia': 'ABIA', 'Akwa Ibom': 'AKWA-IBOM', 'Bauchi': 'BAUCHI',
    'Bayelsa': 'BAYELSA', 'Borno': 'BORNO', 'Cross River': 'CROSS-RIVER',
    'Delta': 'DELTA', 'Ekiti': 'EKITI', 'Federal Capital Territory': 'FCT',
    'Kaduna': 'KADUNA', 'Kano': 'KANO', 'Katsina': 'KATSINA', 'Kebbi': 'KEBBI',
    'Nasarawa': 'NASARAWA', 'Osun': 'OSUN', 'Oyo': 'OYO', 'Plateau': 'PLATEAU',
    'Rivers': 'RIVERS', 'Sokoto': 'SOKOTO', 'Taraba': 'TARABA',
}
DIRECTORY_ROOT = 'https://inecnigeria.org/documents/resources/rac/'
ARCGIS_LAYER = ('https://services8.arcgis.com/oTalEaSXAuyNT7xf/arcgis/rest/services/'
                'Nigeria_Local_Government_Area_Boundaries/FeatureServer/0')
SUPPLEMENTARY = {
    6042: ['https://www.manpower.com.ng/places/wards-in-lga/566/karu'],
    7851: ['https://www.manpower.com.ng/places/wards-in-lga/726/degema'],
    7853: ['https://www.manpower.com.ng/places/wards-in-lga/726/degema'],
    7854: ['https://www.manpower.com.ng/places/wards-in-lga/726/degema'],
    7860: ['https://www.manpower.com.ng/places/wards-in-lga/726/degema'],
    8447: [
        'https://www.manpower.com.ng/places/wards-in-lga/777/ussa',
        'https://www.lawglobalhub.com/madaki-akintse-angwe-v-the-president-of-federal-republic-of-nigeria-ors-2012-lljr-ca/',
    ],
}

FIELDS = [
    'feature_index', 'fid', 'state', 'ward', 'longitude', 'latitude',
    'assigned_lga_before', 'reviewed_lga', 'official_ward_name', 'official_ra_code',
    'official_match', 'official_source_url', 'supplementary_evidence_urls',
    'local_containing_state_lga', 'local_distance_before_km',
    'independent_lga', 'independent_objectid', 'independent_id',
    'independent_query_url', 'disposition', 'review_note',
    'before_attributes_json', 'after_attributes_json',
    'before_geometry_sha256', 'after_geometry_sha256', 'source_sha256',
]


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def blob_sha(blob):
    return hashlib.sha256(blob).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def source_path(table=TABLE):
    return layer_index()[table]['path']


def connect(path, readonly=False):
    if readonly:
        return sqlite3.connect(f'file:{Path(path)}?mode=ro', uri=True)
    return sqlite3.connect(path)


def schema(con, table=TABLE):
    columns = [row[1] for row in con.execute(f'pragma table_info({q(table)})')]
    geometry_column = con.execute(
        'select column_name from gpkg_geometry_columns where table_name=?', (table,)).fetchone()[0]
    return columns, geometry_column


def all_ward_rows(path):
    with closing(connect(path, True)) as con:
        columns, geometry_column = schema(con)
        rows = []
        for values in con.execute(f'select * from {q(TABLE)} order by fid'):
            row = dict(zip(columns, values))
            row['_geometry'] = gpkg_geometry(row[geometry_column])
            row['_geometry_column'] = geometry_column
            rows.append(row)
        return rows


def all_geometry_digest(rows):
    digest = hashlib.sha256()
    for row in rows:
        digest.update(str(row['fid']).encode('ascii'))
        digest.update(b'\0')
        digest.update(row[row['_geometry_column']])
        digest.update(b'\0')
    return digest.hexdigest()


def load_features(table):
    path = source_path(table)
    with closing(connect(path, True)) as con:
        columns, geometry_column = schema(con, table)
        rows = []
        for values in con.execute(f'select * from {q(table)} order by fid'):
            row = dict(zip(columns, values))
            row['_geometry'] = gpkg_geometry(row[geometry_column])
            rows.append(row)
        return rows


def point_query(longitude, latitude):
    return ARCGIS_LAYER + '/query?' + urlencode({
        'geometry': f'{longitude},{latitude}', 'geometryType': 'esriGeometryPoint',
        'inSR': '4326', 'spatialRel': 'esriSpatialRelIntersects',
        'outFields': 'OBJECTID,ID,NAME', 'returnGeometry': 'false', 'f': 'pjson',
    })


def official_match(ward, official, index):
    if index == 8447:
        return 'current_directory_incomplete; supplementary and historical dispute reviewed'
    if index in (7851, 7853, 7854, 7860):
        return 'official LGA and sequence; legacy exact name independently corroborated'
    if norm(ward) == norm(official):
        return 'exact after case/punctuation normalization'
    return 'spelling/source-vintage variant; name not changed'


def build_review():
    if RESULT.exists() or JOURNAL.exists():
        raise RuntimeError('review is already applied or installation is in progress')
    if not BASELINE.exists():
        if not CURRENT_EXCEPTIONS.exists():
            raise RuntimeError('current 40-row exception register is missing')
        shutil.copyfile(CURRENT_EXCEPTIONS, BASELINE)
    with BASELINE.open(encoding='utf8', newline='') as handle:
        baseline = list(csv.DictReader(handle))
    if len(baseline) != 40:
        raise RuntimeError(f'expected 40 pre-review exceptions, found {len(baseline)}')
    baseline_by_index = {int(row['feature_index']): row for row in baseline}
    if set(baseline_by_index) != {case[0] for case in CASES}:
        raise RuntimeError('case evidence does not match the 40-row baseline')
    rows = all_ward_rows(source_path())
    if len(rows) != 8809:
        raise RuntimeError(f'expected 8,809 wards, found {len(rows)}')
    polygons = load_features(POLYGONS)
    centroids = load_features(CENTROIDS)
    polygon_lookup = {(norm(row['state']), norm(row['lga'])): row for row in polygons}
    centroid_lookup = {(norm(row['state']), norm(row['lga'])): row for row in centroids}
    source_hash = sha256(source_path())
    geometry_digest = all_geometry_digest(rows)
    ledger = []
    for index, official, code, independent_lga, objectid, independent_id, disposition, note in CASES:
        base = baseline_by_index[index]
        ward = rows[index]
        if ward['fid'] != index + 1:
            raise RuntimeError(f'feature index {index}: expected FID {index + 1}, got {ward["fid"]}')
        for key, base_key in (('state', 'assigned_state'), ('lga', 'assigned_lga'), ('ward', 'ward')):
            if ward[key] != base[base_key]:
                raise RuntimeError(f'feature index {index}: {key} differs from baseline')
        geometry = ward['_geometry']
        if (abs(geometry.x - float(base['longitude'])) > 1e-10 or
                abs(geometry.y - float(base['latitude'])) > 1e-10):
            raise RuntimeError(f'feature index {index}: coordinates differ from baseline')
        reviewed_lga = CHANGES.get(index, ward['lga'])
        after_lga = reviewed_lga if disposition == 'correct_lga' else ward['lga']
        if reviewed_lga != after_lga:
            raise RuntimeError(f'feature index {index}: non-correction case has an LGA plan')
        before_attributes = {key: ward[key] for key in
                             ('ward', 'lga', 'state', 'dist_to_lga_centroid_km')}
        after_attributes = dict(before_attributes)
        after_attributes['lga'] = after_lga
        if disposition == 'correct_lga':
            centroid = centroid_lookup[(norm(ward['state']), norm(after_lga))]
            distance = shapely_metric(geometry).distance(
                shapely_metric(centroid['_geometry'])) / 1000
            after_attributes['dist_to_lga_centroid_km'] = round(distance, 1)
            target = polygon_lookup[(norm(ward['state']), norm(after_lga))]
            if not target['_geometry'].intersects(geometry):
                raise RuntimeError(f'feature index {index}: corrected local polygon does not contain point')
        before_hash = blob_sha(ward[ward['_geometry_column']])
        row = {
            'feature_index': str(index), 'fid': str(ward['fid']), 'state': ward['state'],
            'ward': ward['ward'], 'longitude': base['longitude'], 'latitude': base['latitude'],
            'assigned_lga_before': ward['lga'], 'reviewed_lga': reviewed_lga,
            'official_ward_name': official, 'official_ra_code': code,
            'official_match': official_match(ward['ward'], official, index),
            'official_source_url': DIRECTORY_ROOT + DIRECTORIES[ward['state']] + '.pdf',
            'supplementary_evidence_urls': '; '.join(SUPPLEMENTARY.get(index, [])),
            'local_containing_state_lga': base['containing_state_lga'],
            'local_distance_before_km': base['distance_to_assigned_lga_km'],
            'independent_lga': independent_lga,
            'independent_objectid': '' if objectid is None else str(objectid),
            'independent_id': independent_id,
            'independent_query_url': point_query(base['longitude'], base['latitude']),
            'disposition': disposition, 'review_note': note,
            'before_attributes_json': canonical(before_attributes),
            'after_attributes_json': canonical(after_attributes),
            'before_geometry_sha256': before_hash, 'after_geometry_sha256': before_hash,
            'source_sha256': source_hash,
        }
        ledger.append(row)
    if Counter(row['disposition'] for row in ledger) != Counter(CATEGORY_COUNTS):
        raise RuntimeError('disposition counts differ from the reviewed evidence')
    verification = {
        'status': 'ready_for_approved_apply',
        'created_at': datetime.now(timezone.utc).isoformat(),
        'scope': '40 residual ward/LGA exceptions after the Gada/Illela identity correction',
        'identifier_rule': 'feature_index is zero-based in audit CSV; GeoPackage fid = feature_index + 1',
        'official_control': {
            'authority': 'Independent National Electoral Commission (INEC)',
            'directories': {state: DIRECTORY_ROOT + stem + '.pdf'
                            for state, stem in sorted(DIRECTORIES.items())},
            'limitation': 'Directories control registration-area assignment and naming, not legal polygon geometry.',
        },
        'independent_boundary_control': {
            'layer': ARCGIS_LAYER,
            'item_id': '686ce086434740b3b5c517b732999c47',
            'credit': 'Esri, Michael Bauer Research GmbH 2023, National Bureau of Statistics',
            'method': 'Read-only EPSG:4326 point intersection; OBJECTID, ID and NAME recorded for every case',
            'limitation': 'Independent boundary evidence only; no external geometry replaces production geometry.',
        },
        'source_path': str(source_path().relative_to(ROOT)),
        'source_sha256': source_hash,
        'baseline_sha256': sha256(BASELINE),
        'all_ward_geometry_sha256': geometry_digest,
        'disposition_counts': CATEGORY_COUNTS,
        'correction_plan': {str(index): {
            'fid': index + 1,
            'ward': next(row['ward'] for row in ledger if int(row['feature_index']) == index),
            'previous_lga': next(row['assigned_lga_before'] for row in ledger
                                 if int(row['feature_index']) == index),
            'new_lga': CHANGES[index],
            'previous_attributes': json.loads(next(
                row['before_attributes_json'] for row in ledger
                if int(row['feature_index']) == index)),
            'new_attributes': json.loads(next(
                row['after_attributes_json'] for row in ledger
                if int(row['feature_index']) == index)),
        } for index in CHANGES},
        'checks': {
            'exactly_40_cases': len(ledger) == 40,
            'exactly_20_states': len({row['state'] for row in ledger}) == 20,
            'exactly_3_lga_corrections': sum(row['disposition'] == 'correct_lga' for row in ledger) == 3,
            'all_other_37_retained': sum(row['disposition'] != 'correct_lga' for row in ledger) == 37,
            'all_geometry_hashes_preserved_in_plan': all(
                row['before_geometry_sha256'] == row['after_geometry_sha256'] for row in ledger),
            'all_fids_match_zero_based_indices': all(
                int(row['fid']) == int(row['feature_index']) + 1 for row in ledger),
            'all_corrected_local_polygons_contain_fixed_points': True,
            'no_ward_names_changed': all(
                json.loads(row['before_attributes_json'])['ward'] ==
                json.loads(row['after_attributes_json'])['ward'] for row in ledger),
            'kwambai_uncertainty_explicit': ledger[-1]['disposition'] == 'retain_delimitation_uncertainty',
        },
    }
    if not all(verification['checks'].values()):
        raise RuntimeError('review verification gates failed')
    return ledger, verification


def write_csv(rows):
    with LEDGER.open('w', encoding='utf8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def load_ledger():
    with LEDGER.open(encoding='utf8', newline='') as handle:
        rows = list(csv.DictReader(handle))
    if len(rows) != 40 or list(rows[0]) != FIELDS:
        raise RuntimeError('review ledger schema or row count is invalid')
    return rows


def write_sources():
    lines = [
        '# Residual ward/LGA review sources', '',
        '## Official administrative control', '',
        'INEC registration-area directories control the ward-to-LGA assignments reviewed here. '
        'They are not legal polygon surveys and were not used to move points or replace geometry.', '',
    ]
    for state, stem in sorted(DIRECTORIES.items()):
        url = DIRECTORY_ROOT + stem + '.pdf'
        lines.append(f'- [{state}]({url})')
    lines += [
        '', '## Independent boundary point checks', '',
        f'Every case has a recorded point-intersection URL in `../{LEDGER.name}`. The queries use:',
        '',
        f'- Layer: <{ARCGIS_LAYER}>',
        '- ArcGIS item: `686ce086434740b3b5c517b732999c47`',
        '- Credit: **Esri, Michael Bauer Research GmbH 2023, National Bureau of Statistics**',
        '- Input: original EPSG:4326 ward coordinate, `esriSpatialRelIntersects`',
        '- Output: `OBJECTID`, `ID`, `NAME`, no returned or substituted geometry', '',
        'A different independent containing polygon does not override INEC. Empty coastal or '
        'inland results are recorded as empty rather than filled with the nearest polygon.', '',
        '## Supplementary and historical evidence', '',
        'Supplementary lists are not treated as superior to INEC. They resolve legacy names '
        'where current PDF extraction uses updated names or omits headings. The Kwambai case '
        'also records the historical Takum/Ussa dispute and remains explicitly uncertain.', '',
    ]
    for index in sorted(SUPPLEMENTARY):
        row = next(case for case in CASES if case[0] == index)
        lines.append(f'- Feature index {index}, {row[1]}:')
        for url in SUPPLEMENTARY[index]:
            lines.append(f'  - <{url}>')
    SOURCES.parent.mkdir(parents=True, exist_ok=True)
    SOURCES.write_text('\n'.join(lines) + '\n', encoding='utf8')


def write_report(ledger, verification, applied=False):
    lines = [
        '# Residual ward/LGA exception review', '',
        ('**Status: three evidence-backed LGA corrections applied; all 40 cases reviewed.**'
         if applied else '**Status: evidence-reviewed plan; no source GeoPackage has been modified.**'), '',
        'The pre-review register contains 40 cases in 20 states. INEC controls ward-to-LGA '
        'assignment. The ArcGIS/Michael Bauer Research/NBS 2023 service supplies an independent '
        'point-intersection check. Neither source licenses forced containment, coordinate movement '
        'or automatic relabelling of a containing polygon.', '',
        '## Outcome', '',
        '- **3 LGA attribute corrections:** Kwarau → Igabi, Gidan Waya → Jema’a, and '
        'Ward XI E9 I → Ibadan North East. Ward names and coordinates are unchanged.',
        '- **20 boundary-generalisation/source-disagreement retentions.** INEC assignments are '
        'retained; local and independent polygon results are recorded individually.',
        '- **14 coastal/water retentions.** Empty local land containers and conflicting coastal '
        'polygons are not treated as proof of an LGA error.',
        '- **2 suspect-coordinate retentions:** Gambaki/Bidir and Ilasa II/Ikun/Araromi. Both '
        'boundary sources disagree with INEC by more than 1 km, so coordinates need separate '
        'authoritative corroboration rather than an LGA relabel.',
        '- **1 delimitation-uncertainty retention:** Kwambai remains assigned to Ussa with its '
        'original point. Current INEC extraction is incomplete and the Takum/Ussa history is disputed.',
        '- **0 ward geometries changed.** The ledger stores complete before/after attributes and '
        'SHA256 geometry hashes for all 40 cases.', '',
        '## Applied LGA plan', '',
        '| feature_index | FID | Ward | Previous LGA | Reviewed LGA | Old centroid km | New centroid km |',
        '|---:|---:|---|---|---|---:|---:|',
    ]
    for row in ledger:
        if row['disposition'] != 'correct_lga':
            continue
        before = json.loads(row['before_attributes_json'])
        after = json.loads(row['after_attributes_json'])
        lines.append(f'| {row["feature_index"]} | {row["fid"]} | {row["ward"]} | '
                     f'{row["assigned_lga_before"]} | {row["reviewed_lga"]} | '
                     f'{before["dist_to_lga_centroid_km"]} | {after["dist_to_lga_centroid_km"]} |')
    lines += [
        '', 'The CSV `feature_index` is zero-based. The actual GeoPackage FID is `feature_index + 1`; '
        'using the index as a FID would select the wrong ward.', '',
        '## All 40 dispositions', '',
        '| feature_index | FID | State | Ward | LGA before → reviewed | Independent polygon | Disposition |',
        '|---:|---:|---|---|---|---|---|',
    ]
    for row in ledger:
        independent = row['independent_lga'] or 'no containing polygon'
        lines.append(f'| {row["feature_index"]} | {row["fid"]} | {row["state"]} | {row["ward"]} | '
                     f'{row["assigned_lga_before"]} → {row["reviewed_lga"]} | {independent} | '
                     f'{row["disposition"]} |')
    lines += [
        '', 'The case-specific INEC label/code, source URL, local and independent containers, '
        'query URL, reason, complete attributes and geometry hashes are in '
        '`ward-lga-review-ledger.csv`. `references/ward-lga-review-sources.md` lists the source '
        'directories, query method and supplementary evidence.', '',
        '## Cautions that were not silently corrected', '',
        '- Kashi/Karshi, Efut Inwang/EFUT INSANG, Guzamala/GUZAMALI WEST, '
        'Tsangamawa/TSANGAAMAWA, Gindin Dutse/FIINDA-DUTSE and Tomble/TOMBIA are name or '
        'source-vintage issues outside these three LGA corrections.',
        '- Ward XI E9 I is supported by INEC and the local Ibadan North East polygon, but the '
        'independent service says Egbeda. That third-source disagreement remains visible in the ledger.',
        '- Arak and Panda/Kare exceed 1 km locally but the independent polygons support Sanga and '
        'Karu respectively. They are not grouped with the two suspect-coordinate cases.',
        '- Kwambai is not declared resolved merely because other cases were reviewed. Its current '
        'assignment and coordinates are preserved while delimitation uncertainty remains explicit.', '',
        '## Reproduction', '',
        '```bash', 'python scripts/correct_residual_ward_lgas.py',
        '# Only after reviewing the ledger and verification:',
        'python scripts/correct_residual_ward_lgas.py --apply --approve-verified',
        'python scripts/audit_geospatial.py',
        'python scripts/audit_geospatial_extended.py',
        'python scripts/build_site.py', '```', '',
        f'Pre-review source SHA256: `{verification["source_sha256"]}`  ',
        f'All-ward geometry digest: `{verification["all_ward_geometry_sha256"]}`',
    ]
    REPORT.write_text('\n'.join(lines) + '\n', encoding='utf8')


def write_dry_run():
    ledger, verification = build_review()
    OUT.mkdir(parents=True, exist_ok=True)
    write_csv(ledger)
    verification['ledger_sha256'] = sha256(LEDGER)
    VERIFICATION.write_text(json.dumps(verification, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
    write_sources()
    write_report(ledger, verification, applied=False)
    print(f'Reviewed 40 cases; planned only 3 LGA corrections. Wrote {LEDGER} and {VERIFICATION}.')
    print('No GeoPackage was modified.')


def verify_staged(stage, original, ledger):
    targets = {int(row['fid']): row for row in ledger if row['disposition'] == 'correct_lga'}
    reviewed = {int(row['fid']): row for row in ledger}
    with closing(connect(stage, True)) as current, closing(connect(original, True)) as source:
        current_columns, current_gcol = schema(current)
        original_columns, original_gcol = schema(source)
        if current_columns != original_columns or current_gcol != original_gcol:
            raise RuntimeError('schema changed during correction')
        current_rows = current.execute(f'select * from {q(TABLE)} order by fid').fetchall()
        original_rows = source.execute(f'select * from {q(TABLE)} order by fid').fetchall()
        if (len(current_rows) != 8809 or len(original_rows) != 8809 or
                len(current_rows) != len(original_rows)):
            raise RuntimeError('ward feature count changed')
        for current_values, original_values in zip(current_rows, original_rows):
            current_row = dict(zip(current_columns, current_values))
            original_row = dict(zip(original_columns, original_values))
            fid = current_row['fid']
            if fid != original_row['fid']:
                raise RuntimeError('ward FID changed')
            if current_row[current_gcol] != original_row[original_gcol]:
                raise RuntimeError(f'FID {fid}: geometry changed')
            expected = targets.get(fid)
            for column in current_columns:
                if column in ('fid', current_gcol):
                    continue
                if expected:
                    before = json.loads(expected['before_attributes_json'])
                    after = json.loads(expected['after_attributes_json'])
                    if original_row[column] != before[column]:
                        raise RuntimeError(f'FID {fid}: guarded previous {column} mismatch')
                    if current_row[column] != after[column]:
                        raise RuntimeError(f'FID {fid}: unexpected corrected {column}')
                elif current_row[column] != original_row[column]:
                    raise RuntimeError(f'FID {fid}: untargeted attribute {column} changed')
            if fid in reviewed:
                evidence = reviewed[fid]
                if blob_sha(original_row[original_gcol]) != evidence['before_geometry_sha256']:
                    raise RuntimeError(f'FID {fid}: original geometry hash mismatch')
                if blob_sha(current_row[current_gcol]) != evidence['after_geometry_sha256']:
                    raise RuntimeError(f'FID {fid}: reviewed geometry hash mismatch')
        if current.execute('pragma integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError('staged GeoPackage integrity failure')
        current_contents = current.execute(
            "select table_name,data_type,identifier,min_x,min_y,max_x,max_y,srs_id from gpkg_contents order by table_name").fetchall()
        original_contents = source.execute(
            "select table_name,data_type,identifier,min_x,min_y,max_x,max_y,srs_id from gpkg_contents order by table_name").fetchall()
        if current_contents != original_contents:
            raise RuntimeError('GeoPackage contents metadata changed')
    rows = all_ward_rows(stage)
    verification = json.loads(VERIFICATION.read_text(encoding='utf8'))
    if all_geometry_digest(rows) != verification['all_ward_geometry_sha256']:
        raise RuntimeError('all-ward geometry digest changed')
    return {
        'feature_count': len(rows),
        'changed_features': len(targets),
        'untargeted_features_verified': len(rows) - len(targets),
        'all_geometry_byte_identical': True,
        'all_untargeted_attributes_verified': True,
        'integrity_check': 'ok',
        'contents_metadata_unchanged': True,
    }


def current_exceptions(rows=None):
    rows = rows or all_ward_rows(source_path())
    polygons = load_features(POLYGONS)
    lookup = {(norm(row['state']), norm(row['lga'])): row for row in polygons}
    tree = shapely.STRtree([row['_geometry'] for row in polygons])
    exceptions = []
    for index, ward in enumerate(rows):
        target = lookup[(norm(ward['state']), norm(ward['lga']))]
        point = ward['_geometry']
        if target['_geometry'].intersects(point):
            continue
        distance = shapely_metric(point).distance(shapely_metric(target['_geometry'])) / 1000
        containers = [polygons[int(i)] for i in tree.query(point, predicate='intersects')]
        exceptions.append({
            'feature_index': index, 'fid': ward['fid'], 'distance_km': distance,
            'has_local_container': bool(containers),
        })
    return exceptions


def post_evidence():
    rows = all_ward_rows(source_path())
    ledger = load_ledger()
    by_fid = {row['fid']: row for row in rows}
    for evidence in ledger:
        fid = int(evidence['fid'])
        row = by_fid[fid]
        after = json.loads(evidence['after_attributes_json'])
        for column, expected in after.items():
            if row[column] != expected:
                raise RuntimeError(f'FID {fid}: installed {column} differs from ledger')
        if blob_sha(row[row['_geometry_column']]) != evidence['after_geometry_sha256']:
            raise RuntimeError(f'FID {fid}: installed geometry differs from ledger')
    verification = json.loads(VERIFICATION.read_text(encoding='utf8'))
    if all_geometry_digest(rows) != verification['all_ward_geometry_sha256']:
        raise RuntimeError('installed all-ward geometry digest mismatch')
    exceptions = current_exceptions(rows)
    expected_indices = {int(row['feature_index']) for row in ledger
                        if row['disposition'] != 'correct_lga'}
    if {row['feature_index'] for row in exceptions} != expected_indices:
        raise RuntimeError('post-correction residual exception set differs from 37 reviewed retentions')
    corrected = {}
    polygons = load_features(POLYGONS)
    polygon_lookup = {(norm(row['state']), norm(row['lga'])): row for row in polygons}
    for evidence in ledger:
        if evidence['disposition'] != 'correct_lga':
            continue
        row = by_fid[int(evidence['fid'])]
        target = polygon_lookup[(norm(row['state']), norm(row['lga']))]
        if not target['_geometry'].intersects(row['_geometry']):
            raise RuntimeError(f'FID {row["fid"]}: corrected point is not contained')
        corrected[str(row['fid'])] = {
            'feature_index': int(evidence['feature_index']), 'ward': row['ward'],
            'previous_lga': evidence['assigned_lga_before'], 'new_lga': row['lga'],
            'dist_to_lga_centroid_km': row['dist_to_lga_centroid_km'],
            'contained_by_corrected_local_lga': True,
        }
    return {
        'corrected_wards': corrected,
        'residual_exception_count': len(exceptions),
        'residual_within_1km': sum(row['distance_km'] <= 1 for row in exceptions),
        'residual_over_10km': sum(row['distance_km'] > 10 for row in exceptions),
        'residual_without_local_container': sum(not row['has_local_container'] for row in exceptions),
        'residual_feature_indices': [row['feature_index'] for row in exceptions],
        'all_40_ledger_rows_rechecked': True,
        'all_8809_geometry_blobs_unchanged': True,
    }


def finalize_installation():
    journal = json.loads(JOURNAL.read_text(encoding='utf8'))
    if sha256(source_path()) != journal['after_sha256']:
        raise RuntimeError('installed source hash differs from staged journal')
    with closing(connect(source_path(), True)) as con:
        if con.execute('pragma integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError('installed GeoPackage integrity failure')
    evidence = post_evidence()
    verification = json.loads(VERIFICATION.read_text(encoding='utf8'))
    result = {
        'status': 'applied_and_verified',
        'applied_at': datetime.now(timezone.utc).isoformat(),
        'source_path': str(source_path().relative_to(ROOT)),
        'before_sha256': journal['before_sha256'],
        'after_sha256': journal['after_sha256'],
        'baseline_sha256': journal['baseline_sha256'],
        'ledger_sha256': journal['ledger_sha256'],
        'verification_sha256': journal['verification_sha256'],
        'all_ward_geometry_sha256': verification['all_ward_geometry_sha256'],
        'counts': {
            'reviewed_cases': 40, 'lga_corrections': 3, 'retained_cases': 37,
            'ward_geometries_changed': 0, 'dispositions': CATEGORY_COUNTS,
        },
        'staged_verification': journal['staged_verification'],
        'post_correction': evidence,
        'checks': {
            'source_hash_matches_staged_installation': True,
            'ledger_and_verification_hashes_preserved': (
                sha256(LEDGER) == journal['ledger_sha256'] and
                sha256(VERIFICATION) == journal['verification_sha256']),
            'exactly_3_lga_corrections': len(evidence['corrected_wards']) == 3,
            'all_corrected_points_contained': all(
                row['contained_by_corrected_local_lga']
                for row in evidence['corrected_wards'].values()),
            'exactly_37_reviewed_residuals': evidence['residual_exception_count'] == 37,
            'zero_ward_geometries_changed': evidence['all_8809_geometry_blobs_unchanged'],
            'all_8809_rows_staged_and_verified': journal['staged_verification']['feature_count'] == 8809,
            'untargeted_attributes_unchanged': journal['staged_verification']['all_untargeted_attributes_verified'],
            'gpkg_contents_unchanged': journal['staged_verification']['contents_metadata_unchanged'],
        },
    }
    if not all(result['checks'].values()):
        raise RuntimeError('post-installation verification failed')
    RESULT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
    write_report(load_ledger(), verification, applied=True)
    JOURNAL.unlink()
    print(f'Applied and verified 3 attribute-only corrections; result: {RESULT}')


def apply_correction(approve):
    if not approve:
        raise RuntimeError('verified correction requires --approve-verified')
    verification = json.loads(VERIFICATION.read_text(encoding='utf8'))
    if verification['status'] != 'ready_for_approved_apply' or not all(verification['checks'].values()):
        raise RuntimeError('review verification is not ready')
    if sha256(LEDGER) != verification['ledger_sha256']:
        raise RuntimeError('review ledger changed after verification')
    if sha256(BASELINE) != verification['baseline_sha256']:
        raise RuntimeError('pre-review baseline changed after verification')
    recomputed, _ = build_review()
    if canonical(recomputed) != canonical(load_ledger()):
        raise RuntimeError('source no longer reproduces the reviewed ledger')
    source = source_path()
    if sha256(source) != verification['source_sha256']:
        raise RuntimeError('ward source hash changed after review')
    stage = source.with_name(source.name + '.correcting.gpkg')
    if stage.exists():
        raise RuntimeError('stale correction stage requires review')
    try:
        shutil.copyfile(source, stage)
        with closing(connect(stage)) as con:
            for row in load_ledger():
                if row['disposition'] != 'correct_lga':
                    continue
                before = json.loads(row['before_attributes_json'])
                after = json.loads(row['after_attributes_json'])
                fid = int(row['fid'])
                for column, expected in before.items():
                    actual = con.execute(
                        f'select {q(column)} from {q(TABLE)} where fid=?', (fid,)).fetchone()[0]
                    if actual != expected:
                        raise RuntimeError(f'FID {fid}: guarded {column} mismatch')
                assignments = ','.join(f'{q(column)}=?' for column in after)
                con.execute(f'update {q(TABLE)} set {assignments} where fid=?',
                            (*after.values(), fid))
            con.commit()
        staged_verification = verify_staged(stage, source, load_ledger())
        journal = {
            'created_at': datetime.now(timezone.utc).isoformat(),
            'before_sha256': verification['source_sha256'],
            'after_sha256': sha256(stage),
            'baseline_sha256': verification['baseline_sha256'],
            'ledger_sha256': verification['ledger_sha256'],
            'verification_sha256': sha256(VERIFICATION),
            'staged_verification': staged_verification,
        }
        JOURNAL.write_text(json.dumps(journal, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
        os.replace(stage, source)
        finalize_installation()
    finally:
        if stage.exists():
            stage.unlink()


def verify_existing_result():
    result = json.loads(RESULT.read_text(encoding='utf8'))
    if sha256(source_path()) != result['after_sha256']:
        raise RuntimeError('current ward hash differs from correction result')
    for path, key in ((BASELINE, 'baseline_sha256'), (LEDGER, 'ledger_sha256'),
                      (VERIFICATION, 'verification_sha256')):
        if sha256(path) != result[key]:
            raise RuntimeError(f'{path.name}: evidence hash differs from correction result')
    evidence = post_evidence()
    if evidence != result['post_correction']:
        raise RuntimeError('current post-correction evidence differs from result')
    if not all(result['checks'].values()):
        raise RuntimeError('existing result has a failed check')
    print('Existing residual ward/LGA correction verified; nothing reapplied.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--approve-verified', action='store_true')
    args = parser.parse_args()
    if RESULT.exists():
        verify_existing_result()
        return
    if JOURNAL.exists():
        finalize_installation()
        print('Recovered and verified the installed correction; nothing reapplied.')
        return
    if args.apply:
        if not LEDGER.exists() or not VERIFICATION.exists() or not BASELINE.exists():
            raise RuntimeError('run the read-only review first')
        apply_correction(args.approve_verified)
    else:
        write_dry_run()


if __name__ == '__main__':
    main()
