#!/usr/bin/env python3
"""Fetch six new Nigeria concepts and write them into data/ as GeoPackages.

Run where outbound HTTPS is available (GitHub Actions).  Sources are all public,
key-free and Nigeria-relevant; see docs/online-layers.md for citations/licences.

  * Settlement extents .... GRID3 NGA Settlement Extents v3.1 (HDX / CIESIN, CC BY-SA 4.0)
  * Built-up areas ........ GHSL GHS-BUILT-S E2020, 30 arc-sec (JRC, CC BY 4.0)
  * River basins .......... FAO AQUASTAT hydrological basins in Africa (HydroSHEDS derived)
  * Flood hazard .......... WRI Aqueduct Floods v2, baseline riverine 1-in-100-year depth
  * Gridded population .... WorldPop NGA v3.0, 3 arc-second (~100 m), CC BY 4.0
  * Airports / seaports / POIs ... HOT OSM country exports (HDX, ODbL)

Continuous fields become spec-clean `2d-gridded-coverage` GeoPackages; discrete
features become one standalone feature GeoPackage per layer.  Everything is cropped
to 2.5-15.0 E, 4.0-14.0 N and rasters are clipped to the Nigeria national outline.
"""
from __future__ import annotations

import glob
import math
import os
import shutil
import sqlite3
import sys
import urllib.request
import zipfile

import numpy as np
from PIL import Image, ImageDraw
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import Affine
from rasterio.vrt import WarpedVRT

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_raster_gpkg import write_raster  # noqa: E402
from build_site import read_gpkg_geom  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
TMP = '/tmp/nga_layers'
WEST, SOUTH, EAST, NORTH = 2.5, 4.0, 15.0, 14.0
BBOX = (WEST, SOUTH, EAST, NORTH)
NODATA = -9999.0
UA = {'User-Agent': 'nigeria-webgis-layer-fetch/1.0'}

HDX_GRID3 = ('https://data.humdata.org/dataset/af838671-b9a6-4ae9-8ed5-eea750b05597'
             '/resource/0a22d6fc-7f1f-4f50-aead-09ef7be0455d/download/'
             'grid3_nga_settlement_extents_v3_1_gpkg.zip')
GHSL = ('https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/GHS_BUILT_S_GLOBE_R2023A/'
        'GHS_BUILT_S_E2020_GLOBE_R2023A_4326_30ss/V1-0/'
        'GHS_BUILT_S_E2020_GLOBE_R2023A_4326_30ss_V1_0.zip')
FAO_BASINS = ('https://storage.googleapis.com/fao-maps-catalog-data/geonetwork/'
              'aquamaps/hydrobasins_africa.zip')
AQUEDUCT = ('https://aqueduct.wridata.org/AqueductFloods20/'
            'inunriver_historical_000000000WATCH_1980_rp00100.tif')
WORLDPOP = ('https://data.worldpop.org/repo/wopr/NGA/population/v3.0/'
            'NGA_population_v3_0_gridded.zip')
HOT = 'https://production-raw-data-api.s3.amazonaws.com/ISO3/NGA/%s/hotosm_nga_%s_osm_gpkg.zip'

# (table, url, is_zip) for downloads; processed in this order.
DOWNLOADS = [
    ('grid3', HDX_GRID3, True),
    ('ghsl', GHSL, True),
    ('fao', FAO_BASINS, True),
    ('aqueduct', AQUEDUCT, False),
    ('worldpop', WORLDPOP, True),
    ('airports', HOT % ('airports', 'airports'), True),
    ('sea_ports', HOT % ('sea_ports', 'sea_ports'), True),
    ('points_of_interest', HOT % ('points_of_interest', 'points_of_interest'), True),
]


# ------------------------------------------------------------------ plumbing
def download(url: str, path: str, timeout: int = 900) -> str:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path) and os.path.getsize(path) > 1024:
        print(f'  cached {os.path.getsize(path)/1e6:8.2f} MB  {path}', flush=True)
        return path
    last = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r, open(path, 'wb') as f:
                while True:
                    chunk = r.read(1 << 20)
                    if not chunk:
                        break
                    f.write(chunk)
            print(f'  fetched {os.path.getsize(path)/1e6:8.2f} MB  {url[:110]}', flush=True)
            return path
        except Exception as e:
            last = e
            print(f'  retry {attempt + 1}: {e}', flush=True)
            if os.path.exists(path):
                os.remove(path)
    raise RuntimeError(f'download failed: {url}: {last}')


def unzip(path: str, key: str) -> str:
    out = os.path.join(TMP, key)
    os.makedirs(out, exist_ok=True)
    with zipfile.ZipFile(path) as z:
        z.extractall(out)
    return out


def asset(key: str, ext: str) -> str:
    hits = glob.glob(os.path.join(TMP, key, '**', '*' + ext), recursive=True)
    if not hits:
        raise RuntimeError(f'no {ext} inside {TMP}/{key}')
    return max(hits, key=os.path.getsize)


def nigeria_mask(h: int, w: int) -> np.ndarray:
    """Rasterise the geoBoundaries national outline on an arbitrary grid."""
    p = os.path.join(DATA, 'admin_country_geoboundaries_pg.gpkg')
    con = sqlite3.connect('file:' + p + '?mode=ro', uri=True)
    blob = con.execute('select geom from admin_country_geoboundaries_pg limit 1').fetchone()[0]
    con.close()
    g = read_gpkg_geom(blob)
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    img = Image.new('L', (w, h), 0)
    draw = ImageDraw.Draw(img)
    outer, holes = [], []
    for poly in polys:
        for i, ring in enumerate(poly):
            pts = [((lon - WEST) / (EAST - WEST) * w, (NORTH - lat) / (NORTH - SOUTH) * h)
                   for lon, lat in ring]
            (outer if i == 0 else holes).append(pts)
    for pts in outer:
        draw.polygon(pts, fill=255)
    for pts in holes:
        draw.polygon(pts, fill=0)
    m = np.asarray(img) > 127
    print(f'  [mask {w}x{h}] Nigeria outline covers {m.mean():.1%} of the grid', flush=True)
    return m


def to_grid(src_path: str, w: int, h: int, resampling, src_nodata=None,
            to_sum=False, positive_only=False, zero_from_neg9999=False) -> np.ndarray:
    """Warp a source raster onto the Nigeria window at an arbitrary output size."""
    tr = Affine((EAST - WEST) / w, 0, WEST, 0, -(NORTH - SOUTH) / h, NORTH)
    with rasterio.open(src_path) as src:
        opts = dict(crs='EPSG:4326', transform=tr, width=w, height=h,
                    resampling=resampling, nodata=NODATA, dtype='float32')
        if src_nodata is not None:
            opts['src_nodata'] = src_nodata
        with WarpedVRT(src, **opts) as vrt:
            a = vrt.read(1).astype('f4')
        factor = 1.0
        if to_sum:
            src_area = abs(src.res[0] * src.res[1])
            out_area = abs((EAST - WEST) / w * (NORTH - SOUTH) / h)
            factor = out_area / src_area
            print(f'  sum resampling: source cell {src.res}, x{factor:.1f} cells per output cell',
                  flush=True)
    if zero_from_neg9999:
        a = np.where(a <= -9999, 0.0, a)
    a = np.where(np.isfinite(a) & (a != NODATA), a * factor, NODATA)
    if positive_only:
        a = np.where(a < 0, NODATA, a)
    mask = nigeria_mask(h, w)
    a = np.where(mask, a, NODATA)
    ok = a != NODATA
    if not ok.any():
        raise RuntimeError(f'empty grid for {src_path}: no valid cells inside Nigeria')
    print(f'  grid {w}x{h}: valid {ok.mean():.1%}, range '
          f'[{a[ok].min():.3f}, {a[ok].max():.3f}]', flush=True)
    return a


def write_rst(table, arr, uom, field, desc):
    out = os.path.join(DATA, table + '.gpkg')
    h, w = arr.shape
    write_raster(out, table, arr, BBOX, uom=uom, field=field, description=desc)
    print(f'WROTE {out}  {w}x{h}  {os.path.getsize(out)/1e6:.2f} MB', flush=True)


# ------------------------------------------------------------------- rasters
def build_rasters() -> None:
    # WorldPop v3.0 - people per ~1 km cell, summed from the 3 arc-second counts.
    print('\n[WorldPop v3.0 gridded population]', flush=True)
    tif = asset('worldpop', '.tif')
    a = to_grid(tif, 1400, 1120, Resampling.average, to_sum=True, positive_only=True)
    write_rst('population_worldpop2025_rst', a, 'people per cell', 'PopulationCount',
              'WorldPop Nigeria v3.0 (2025) bottom-up gridded population, 3 arc-second '
              '(~100 m) counts summed to a 0.0089 degree (~1 km) grid. CC BY 4.0. EPSG:4326.')

    # GHSL built-up surface - mean m2 of built-up per 30 arc-second source cell.
    print('\n[GHSL built-up surface 2020]', flush=True)
    tif = asset('ghsl', '.tif')
    a = to_grid(tif, 500, 400, Resampling.average, positive_only=True)
    write_rst('settlements_builtup_ghsl2020_rst', a, 'm2 per 30-arcsec cell', 'BuiltUpSurface',
              'JRC Global Human Settlement Layer GHS-BUILT-S, epoch 2020, R2023A, '
              '30 arc-second built-up surface (square metres) resampled to 0.025 degree. '
              'CC BY 4.0. EPSG:4326.')

    # WRI Aqueduct baseline 1-in-100-year riverine inundation depth.
    print('\n[WRI Aqueduct flood hazard]', flush=True)
    flood = os.path.join(TMP, 'aqueduct.tif')
    a = to_grid(flood, 500, 400, Resampling.bilinear,
                src_nodata=-9999.0, positive_only=True)
    if (a != NODATA).mean() < 0.25:
        # Some Aqueduct tiles use -9999 outside the modelled floodplain; inside a
        # national outline those cells simply have zero inundation depth.
        print('  sparse flood grid -> treating unmapped cells as zero depth', flush=True)
        a = to_grid(flood, 500, 400, Resampling.bilinear, src_nodata=None,
                    positive_only=True, zero_from_neg9999=True)
    write_rst('hazards_flood_aqueduct_rst', a, 'metres', 'FloodDepth',
              'WRI Aqueduct Floods v2 baseline riverine inundation depth (metres) for the '
              '1-in-100-year return period, 30 arc-second, resampled to 0.025 degree. '
              'Winsemius et al. / WRI. EPSG:4326.')


# -------------------------------------------------------------------- vectors
def _geo_stack():
    import geopandas as gpd
    import pyogrio
    from shapely.geometry import box
    return gpd, pyogrio, box


def write_vec(table: str, gdf, desc: str) -> None:
    import pyogrio
    out = os.path.join(DATA, table + '.gpkg')
    if os.path.exists(out):
        os.remove(out)
    if gdf.crs is None:
        gdf = gdf.set_crs('EPSG:4326')
    gdf = gdf.to_crs('EPSG:4326')
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty]
    gdf = gdf.rename_geometry('geom')
    pyogrio.write_dataframe(gdf, out, layer=table, driver='GPKG', geometry_name='geom')
    con = sqlite3.connect(out)
    con.execute('update gpkg_contents set description=?, identifier=? where table_name=?',
                (desc, table, table))
    con.commit()
    print(f'  gpkg_contents: {con.execute("select table_name,data_type,srs_id from gpkg_contents").fetchall()}',
          flush=True)
    con.close()
    print(f'WROTE {out}  {len(gdf)} features  {os.path.getsize(out)/1e6:.2f} MB', flush=True)


def clean_frame(gdf, box_geom, tol, cap):
    """Clip to the map window, simplify, and cap the number of features."""
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty].copy()
    gdf = gdf[gdf.geometry.intersects(box_geom)]
    if len(gdf) > cap:
        areas = gdf.geometry.area
        gdf = gdf.assign(_area=areas).nlargest(cap, '_area').drop(columns=['_area'])
    gdf['geometry'] = gdf.geometry.simplify(tol, preserve_topology=True)
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty]
    return gdf


def settlement_extents() -> None:
    import geopandas as gpd
    _, pyogrio, box = _geo_stack()
    print('\n[GRID3 settlement extents v3.1]', flush=True)
    gpkg = asset('grid3', '.gpkg')
    layers = pyogrio.list_layers(gpkg)
    print('  layers:', layers, flush=True)
    layer = layers[0][0]
    info = pyogrio.read_info(gpkg, layer=layer)
    print('  fields:', info['fields'][:20], 'features:', info['features'], flush=True)
    # Let GDAL/SQL do the heavy reduction: 745,191 polygons in a 1.7 GB GeoPackage.
    order = 'building_area' if 'building_area' in info['fields'] else 'OBJECTID'
    sql = f'SELECT * FROM "{layer}" ORDER BY {order} DESC LIMIT 14000'
    gdf = None
    for dialect in ('OGRSQL', 'SQLITE', None):
        try:
            gdf = pyogrio.read_dataframe(gpkg, sql=sql, sql_dialect=dialect, force_2d=True)
            print(f'  SQL reduction OK with dialect {dialect}: {len(gdf)} rows', flush=True)
            break
        except Exception as e:
            print(f'  SQL dialect {dialect} failed: {e}', flush=True)
    if gdf is None:
        # Last resort: stream the source in chunks and keep the largest polygons.
        import pandas as pd
        pieces = []
        for skip in range(0, int(info['features']), 60000):
            part = pyogrio.read_dataframe(gpkg, layer=layer, skip_features=skip,
                                          max_features=60000, bbox=BBOX, force_2d=True)
            if len(part) == 0:
                break
            part = part.assign(_a=part.geometry.area).nlargest(1500, '_a').drop(columns=['_a'])
            pieces.append(part)
            print(f'  chunk {skip}: kept {len(part)}', flush=True)
        gdf = pd.concat(pieces, ignore_index=True)
        gdf = gdf.assign(_a=gdf.geometry.area).nlargest(14000, '_a').drop(columns=['_a'])
    if gdf.crs is None:
        gdf = gdf.set_crs('EPSG:4326')
    gdf = gdf.to_crs('EPSG:4326')
    gdf = clean_frame(gdf, box(*BBOX), 0.0015, 12000)
    keep = [c for c in ('type', 'building_count', 'building_area', 'probability', 'source')
            if c in gdf.columns]
    out = gpd.GeoDataFrame(gdf[keep].reset_index(drop=True).rename(
        columns={'type': 'settlement_type'}),
        geometry=gdf['geometry'].reset_index(drop=True), crs='EPSG:4326')
    write_vec('settlements_extents_grid3_pg', out,
              'GRID3 NGA Settlement Extents v3.1 (CIESIN/Columbia, CC BY-SA 4.0), '
              'largest 12,000 settlement polygons by building area, generalised to 0.0015 deg. '
              'EPSG:4326.')


def river_basins() -> None:
    import geopandas as gpd
    _, pyogrio, box = _geo_stack()
    print('\n[FAO / HydroSHEDS hydrological basins]', flush=True)
    shp = asset('fao', '.shp')
    gdf = pyogrio.read_dataframe(shp, bbox=BBOX, force_2d=True)
    if gdf.crs is None:
        gdf = gdf.set_crs('EPSG:4326')
    gdf = gdf.to_crs('EPSG:4326')
    print('  fields:', list(gdf.columns), 'clipped features:', len(gdf), flush=True)
    gdf = gdf[gdf.geometry.intersects(box(*BBOX))].copy()
    gdf['geometry'] = gdf.geometry.intersection(box(*BBOX))
    gdf['geometry'] = gdf.geometry.simplify(0.002, preserve_topology=True)
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty]
    name = None
    for c in ('SUB_NAME', 'MAJ_NAME', 'sub_name', 'maj_name'):
        if c in gdf.columns:
            name = c
            break
    cols = [c for c in ('SUB_BAS', 'TO_BAS', 'MAJ_BAS', 'SUB_AREA', 'MAJ_AREA',
                        'SUB_NAME', 'MAJ_NAME') if c in gdf.columns]
    out = gpd.GeoDataFrame(gdf[cols].reset_index(drop=True),
                           geometry=gdf['geometry'].reset_index(drop=True), crs='EPSG:4326')
    out = out.rename(columns={c: c.lower() for c in cols})
    if name:
        out['name'] = out[name.lower()]
    write_vec('water_basins_fao_pg', out,
              'FAO AQUASTAT hydrological basins in Africa (derived from HydroSHEDS '
              '15 arc-second drainage), clipped to Nigeria and simplified. 1450 Africa-wide '
              'sub-basins; fields sub_bas, maj_bas, sub_name, maj_name, sub_area. EPSG:4326.')


HOT_LAYERS = [
    ('airports', 'infrastructure_airports_osm_pt',
     ['name', 'name_en', 'aeroway', 'building', 'emergency', 'operator_type',
      'addr_city', 'adm1_name']),
    ('sea_ports', 'infrastructure_seaports_osm_pt',
     ['name', 'name_en', 'amenity', 'port', 'harbour', 'industrial',
      'operator_type', 'addr_city', 'adm1_name']),
    ('points_of_interest', 'infrastructure_pois_osm_pt',
     ['name', 'name_en', 'amenity', 'man_made', 'shop', 'tourism',
      'addr_city', 'adm1_name']),
]


def osm_points() -> None:
    import geopandas as gpd
    _, pyogrio, _ = _geo_stack()
    for key, table, keep in HOT_LAYERS:
        print(f'\n[HOT OSM {key}]', flush=True)
        gpkg = asset(key, '.gpkg')
        layers = pyogrio.list_layers(gpkg)
        layer = layers[0][0]
        gdf = pyogrio.read_dataframe(gpkg, layer=layer, bbox=BBOX, force_2d=True)
        if gdf.crs is None:
            gdf = gdf.set_crs('EPSG:4326')
        gdf = gdf.to_crs('EPSG:4326')
        # OSM exports mix points, lines and polygons -> one representative point each.
        geoms = [p if p is not None and p.geom_type == 'Point' else
                 (p.centroid if p is not None and not p.is_empty else None)
                 for p in gdf.geometry]
        cols = [c for c in keep if c in gdf.columns]
        out = gpd.GeoDataFrame(gdf[cols].reset_index(drop=True),
                               geometry=gpd.GeoSeries(geoms, crs='EPSG:4326'))
        out = out[out.geometry.notna() & ~out.geometry.is_empty]
        out = out.cx[WEST:EAST, SOUTH:NORTH]
        if 'name_en' in out.columns and 'name' in out.columns:
            blank = out['name'].isna() | (out['name'].astype(str).str.strip() == '')
            out['name'] = out['name'].where(~blank, out['name_en'])
            out = out.drop(columns=['name_en'])
        out = out.drop(columns=[c for c in out.columns if c.startswith('adm') and c != 'adm1_name'])
        write_vec(table, out,
                  f'Humanitarian OpenStreetMap Team Nigeria {key} country export '
                  f'(HDX, ODbL), {len(out)} features, clipped to Nigeria. EPSG:4326.')


# ----------------------------------------------------------------------- main
def main() -> None:
    os.makedirs(DATA, exist_ok=True)
    os.makedirs(TMP, exist_ok=True)
    only = sys.argv[1:] or [k for k, _, _ in DOWNLOADS]

    for key, url, is_zip in DOWNLOADS:
        if key not in only:
            continue
        print(f'\n=== download {key}', flush=True)
        ext = '.zip' if is_zip else '.tif'
        p = os.path.join(TMP, key + ext)
        download(url, p)
        if is_zip:
            unzip(p, key)

    if any(k in only for k in ('worldpop', 'ghsl', 'aqueduct')):
        build_rasters()
    if 'grid3' in only:
        settlement_extents()
    if 'fao' in only:
        river_basins()
    if any(k in only for k, _, _ in HOT_LAYERS):
        osm_points()

    expected = ['settlements_extents_grid3_pg', 'settlements_builtup_ghsl2020_rst',
                'water_basins_fao_pg', 'hazards_flood_aqueduct_rst',
                'population_worldpop2025_rst', 'infrastructure_airports_osm_pt',
                'infrastructure_seaports_osm_pt', 'infrastructure_pois_osm_pt']
    missing = [t for t in expected if not os.path.exists(os.path.join(DATA, t + '.gpkg'))]
    print('\n=== expected outputs ===', flush=True)
    for t in expected:
        p = os.path.join(DATA, t + '.gpkg')
        print(f'  {"OK " if os.path.exists(p) else "MISS"} {t}', flush=True)
    if missing and len(only) == len(DOWNLOADS):
        raise RuntimeError('missing outputs: ' + ', '.join(missing))


if __name__ == '__main__':
    main()
