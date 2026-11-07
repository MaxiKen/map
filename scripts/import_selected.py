#!/usr/bin/env python3
"""Import the approved layers from files/all_maps.gpkg into data/.

    python scripts/import_selected.py              # one standalone .gpkg per layer (default)
    python scripts/import_selected.py --single     # one .gpkg holding all approved layers

Attribute / legend tables are never written as layers.  Each one in INTEGRATIONS is
joined into the layer it describes, as extra columns on the features themselves, so
every output GeoPackage contains feature tables only.  Layer names are kept exactly
as they appear in all_maps.gpkg so build_site.py picks them up unchanged.
"""
import argparse
import os
import sqlite3

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER = os.path.join(ROOT, 'files', 'all_maps.gpkg')
DATA = os.path.join(ROOT, 'data')
CORE = ['gpkg_spatial_ref_sys', 'gpkg_contents', 'gpkg_geometry_columns']

# The approved list, in catalog order.
SELECTED = [
    'admin_country_geoboundaries_pg',
    'admin_states_gadm_pg',
    'admin_lgas_gadm_pg',
    'admin_lga_centroids_pt',
    'admin_wards_pt',
    'population_density2016_states_pg',
    'settlements_places_osm_pt',
    'settlements_state_capitals_map2023_pt',
    'transport_roads_diva_ln',
    'transport_railways_diva_ln',
    'water_lines_diva_ln',
    'water_areas_diva_pg',
    'landcover_cgls2019_pg',
    'soil_wrb2006_isric_pg',
    'ethnic_areas_anthromapper_pg',
    'forest_osm_pg',
    'forest_reserves_water_picture_pg',
    'protected_areas_wdpa_pg',
    'reference_africa_countries_pg',
    'reference_world_countries_pg',
]

# table -> owning layer. `join` uses t = owning layer, src = source table.
# `cols` are (new column name, SQLite type, expression from src) added to the owner.
INTEGRATIONS = [
    dict(
        table='admin_senatorial_districts_tbl', owner='admin_lga_centroids_pt',
        join='src.senatorial_district = t.senatorial_district',
        cols=[('district_state', 'TEXT', 'src.state'),
              ('district_n_lgas', 'INTEGER', 'src.n_lgas'),
              ('district_lgas', 'TEXT', 'src.lgas')]),
    dict(
        table='landcover_cgls2019_legend_tbl', owner='landcover_cgls2019_pg',
        join='src.raster_value = t.raster_value',
        cols=[('legend_class_name', 'TEXT', 'src.class_name'),
              ('legend_cells', 'INTEGER', 'src.cells'),
              ('legend_area_km2', 'REAL', 'src.area_km2')]),
    dict(
        table='soil_wrb2006_isric_legend_tbl', owner='soil_wrb2006_isric_pg',
        join='src.raster_value = t.raster_value',
        cols=[('legend_group', 'TEXT', 'src.wrb2006_group'),
              ('legend_cells_in_nigeria', 'INTEGER', 'src.cells_in_nigeria'),
              ('legend_area_km2', 'REAL', 'src.area_km2'),
              ('isric_colour', 'TEXT', 'src.isric_colour')]),
    dict(
        table='soil_wrb2006_groups_tbl', owner='soil_wrb2006_isric_pg',
        join='src.reference_soil_group = t.wrb2006_group',
        cols=[('wrb_code', 'TEXT', 'src.code')]),
]


def build(out, layers, master=MASTER):
    """Write a GeoPackage containing `layers`, with their tables folded in."""
    if os.path.exists(out):
        os.remove(out)
    d = sqlite3.connect(out, uri=True)
    d.execute('PRAGMA application_id=1196444487')
    d.execute('PRAGMA user_version=10300')
    d.execute('ATTACH ? AS m', ('file:' + master + '?mode=ro',))
    ddl = {r[0]: r[1] for r in d.execute(
        "select name, sql from m.sqlite_master where type='table' and sql is not null")}
    for t in CORE:
        d.execute(ddl[t])
    d.execute('insert into gpkg_spatial_ref_sys select * from m.gpkg_spatial_ref_sys')

    folded = []
    for lay in layers:
        d.execute('insert into gpkg_contents select * from m.gpkg_contents where table_name=?', (lay,))
        d.execute('insert into gpkg_geometry_columns select * from m.gpkg_geometry_columns where table_name=?', (lay,))
        d.execute(ddl[lay])
        d.execute('insert into "%s" select * from m."%s"' % (lay, lay))
        for it in INTEGRATIONS:
            if it['owner'] != lay:
                continue
            for col, typ, _ in it['cols']:
                d.execute('alter table "%s" add column "%s" %s' % (lay, col, typ))
            sets = ', '.join('"%s" = (select %s from m."%s" as src where %s limit 1)'
                             % (col, expr, it['table'], it['join'])
                             for col, _, expr in it['cols'])
            d.execute('update "%s" as t set %s' % (lay, sets))
            filled = d.execute('select count(*) from "%s" where "%s" is not null'
                               % (lay, it['cols'][0][0])).fetchone()[0]
            folded.append((it['table'], lay, filled))
    d.commit()
    d.execute('DETACH m')
    d.execute('VACUUM')
    d.close()
    return folded


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--single', action='store_true', help='write one .gpkg containing all approved layers')
    ap.add_argument('--data', default=DATA)
    a = ap.parse_args()
    os.makedirs(a.data, exist_ok=True)
    folded = []
    if a.single:
        out = os.path.join(a.data, 'selected_layers.gpkg')
        folded = build(out, SELECTED)
        print('%-48s %8.2f MB  (%d layers)' % (os.path.basename(out), os.path.getsize(out) / 1e6, len(SELECTED)))
    else:
        for lay in SELECTED:
            out = os.path.join(a.data, lay + '.gpkg')
            folded.extend(build(out, [lay]))
            print('%-48s %8.2f MB' % (os.path.basename(out), os.path.getsize(out) / 1e6))
    for tbl, owner, n in folded:
        print('  folded %-42s -> %-34s %d rows enriched' % (tbl, owner, n))


if __name__ == '__main__':
    main()
