#!/usr/bin/env python3
"""Fetch seven geology-associated Nigeria layers into group folders under data/.

Run where outbound HTTPS is available (GitHub Actions); the sandbox cannot reach
these hosts directly.  Sources, licences and method: docs/geology-layers.md.

Vectors (5) -- the subsurface as discrete units and observed points:
  * BGS Africa Groundwater Atlas Nigeria hydrogeology map .... CC BY-SA 4.0
  * WHYMAP/BGR ECOWAS 2022 hydrogeological units, clipped ..... doi 10.25928/GWR-ECOWAS.1
  * WHYMAP/BGR ECOWAS 2022 superficial cover aquifers ......... doi 10.25928/GWR-ECOWAS.1
  * WPDx Nigeria water points (boreholes / wells) .............. HDX, CC BY-SA 4.0
  * IGRAC / UNESCO-IHP Transboundary Aquifers 2025 ............. CC BY-SA 3.0 IGO

Rasters (2) -- continuous fields that cannot be faithful vectors:
  * Fan et al. (2017 revised) 1 km water table depth, Africa .... free for research
  * EMAG2 v2 2-arc-minute magnetic anomaly ...................... free, NOAA/NCEI

Everything is cropped to 2.5-15.0 E, 4.0-14.0 N; rasters are also masked to the
geoBoundaries national outline.  One standalone GeoPackage per layer, no tables.

All download URLs were HEAD/GET-verified in GitHub Actions on 2026-11-07; see
docs/geology-layers.md for the probe results and licences.
"""
from __future__ import annotations

import glob
import json
import os
import sys
import urllib.parse
import urllib.request
import zipfile

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import Affine
from rasterio.windows import from_bounds
from shapely.geometry import box, shape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_raster_gpkg import write_raster  # noqa: E402
from data_paths import layer_path  # noqa: E402
from fetch_layers import (  # noqa: E402
    BBOX, WEST, SOUTH, EAST, NORTH, NODATA, TMP,
    download, unzip, asset, to_grid, write_vec,
)

DATA = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')

BGS_NIGERIA = 'https://africagroundwateratlas.org/downloads/Nigeria.zip'
ECOWAS_SHP = ('https://download.bgr.de/bgr/grundwasser/gwr_ecowas/SHP/'
              'GWR_ECOWAS_SHP_v1.zip')
WPDX_CSV = ('https://data.humdata.org/dataset/29677a2d-1fb2-48a3-a06a-9c66800c418b/'
            'resource/1fdb9a0c-d145-49e5-a502-6a3bc63626e8/download/wpdx_enhanced.csv')
WTD_NC = ('http://thredds-gfnl.usc.es/thredds/fileServer/GLOBALWTDFTP/'
          'annualmeans/AFRICA_WTD_annualmean.nc')
EMAG2_TIF = 'https://geomag.colorado.edu/images/EMAG2/EMAG2_V2.tif'
IGRAC_WFS = 'https://ggis.un-igrac.org/geoserver/ows'

DOWNLOADS = [
    ('bgs', BGS_NIGERIA, True),
    ('ecowas', ECOWAS_SHP, True),
    ('wpdx', WPDX_CSV, False),
    ('wtd', WTD_NC, False),
]


# ------------------------------------------------------------------ helpers
def clip_polygons(gdf, tol=0.0008):
    """Intersect with the map window and simplify, keeping only area geometries."""
    b = box(WEST, SOUTH, EAST, NORTH)
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty].copy()
    gdf = gdf[gdf.geometry.intersects(b)]
    gdf['geometry'] = gdf.geometry.intersection(b)
    gdf['geometry'] = gdf.geometry.simplify(tol, preserve_topology=True)
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty]
    gdf = gdf[gdf.geometry.geom_type.isin(['Polygon', 'MultiPolygon'])]
    return gdf.reset_index(drop=True)


def shp(key, stem):
    hits = glob.glob(os.path.join(TMP, key, '**', stem), recursive=True)
    if not hits:
        raise RuntimeError(f'{stem} not found in {TMP}/{key}')
    return hits[0]


def write_tif(path, arr, transform, nodata=NODATA):
    arr = np.asarray(arr, dtype='float32')
    with rasterio.open(path, 'w', driver='GTiff', height=arr.shape[0], width=arr.shape[1],
                       count=1, dtype='float32', crs='EPSG:4326', transform=transform,
                       nodata=nodata) as dst:
        dst.write(arr, 1)
    return path


# ------------------------------------------------------------------ vectors
def bgs_nigeria():
    import geopandas as gpd
    import pyogrio
    print('\n[BGS Africa Groundwater Atlas: Nigeria hydrogeology]', flush=True)
    gdf = pyogrio.read_dataframe(shp('bgs', 'Nigeria_HG.shp'), force_2d=True)
    if gdf.crs is None:
        gdf = gdf.set_crs('EPSG:4326')
    gdf = gdf.to_crs('EPSG:4326')
    print(f'  source rows={len(gdf)} fields={list(gdf.columns)}', flush=True)
    out = clip_polygons(gdf[['NigiaGLG', 'NigiaHGCom', 'geometry']], tol=0.0004)
    out = out.rename(columns={'NigiaGLG': 'geology_unit', 'NigiaHGCom': 'class_name'})
    out['source'] = 'BGS Africa Groundwater Atlas v1.0 (2019/2021)'
    g = gpd.GeoDataFrame(out, geometry='geometry', crs='EPSG:4326')
    write_vec('groundwater_aquifers_bgs2019_pg', g,
              'BGS Africa Groundwater Atlas country hydrogeology map for Nigeria, '
              'Version 1.0 (2019/2021), 1:5,000,000. Each polygon carries both the '
              'hydrogeologically significant geology unit and the aquifer type / '
              'productivity class (CSI, I, B, U ... codes, see user guide OR/21/063). '
              'CC BY-SA 4.0. EPSG:4326.')


def ecowas(key, stem, table, keep, desc):
    import geopandas as gpd
    import pyogrio
    print(f'\n[WHYMAP ECOWAS 2022: {stem}]', flush=True)
    gdf = pyogrio.read_dataframe(shp(key, stem), bbox=BBOX, force_2d=True)
    if gdf.crs is None:
        gdf = gdf.set_crs('EPSG:4326')
    gdf = gdf.to_crs('EPSG:4326')
    print(f'  source rows in window={len(gdf)} fields={len(gdf.columns)}', flush=True)
    gdf = clip_polygons(gdf)
    cols = {c: c.lower() for c in keep if c in gdf.columns}
    out = gdf[list(cols)].rename(columns=cols).reset_index(drop=True)
    # build_site colors categorical fields named in CLASS_FIELDS; expose the
    # aquifer-productivity class under that conventional name.
    if 'aq_prod' in out.columns:
        out['class_name'] = out.pop('aq_prod')
    if 'Yield' in out.columns:
        out = out.rename(columns={'Yield': 'yield_class'})
    if 'yield' in out.columns:
        out = out.rename(columns={'yield': 'yield_class'})
    if 'Aq_type' in out.columns:
        out = out.rename(columns={'Aq_type': 'aq_type'})
    if 'sources' in out.columns:
        out = out.rename(columns={'sources': 'references'})
    out['source'] = 'BGR/BGS/BRGM/Eawag/UNESCO (2022), doi 10.25928/GWR-ECOWAS.1'
    for c in ('name', 'st_unit', 'references'):
        if c in out.columns:
            out[c] = out[c].astype(str).str.slice(0, 180)
    g = gpd.GeoDataFrame(out, geometry=gdf['geometry'].reset_index(drop=True), crs='EPSG:4326')
    write_vec(table, g, desc)


def wpdx_points():
    import geopandas as gpd
    import pandas as pd
    from shapely.geometry import Point
    print('\n[WPDx Nigeria water points]', flush=True)
    p = os.path.join(TMP, 'wpdx.csv')
    d = pd.read_csv(p, skiprows=[1], low_memory=False)  # row 1 is the HXL tag row
    d['lat_deg'] = pd.to_numeric(d['lat_deg'], errors='coerce')
    d['lon_deg'] = pd.to_numeric(d['lon_deg'], errors='coerce')
    d = d.dropna(subset=['lat_deg', 'lon_deg'])
    d = d[(d.lon_deg >= WEST) & (d.lon_deg <= EAST) & (d.lat_deg >= SOUTH) & (d.lat_deg <= NORTH)]
    print(f'  rows inside Nigeria window={len(d)}', flush=True)
    out = pd.DataFrame({
        'type': d['water_source_clean'].fillna('Unknown').astype(str),
        'water_tech': d['water_tech_clean'].fillna('').astype(str),
        'status': d['status_clean'].fillna('').astype(str),
        'state': d['clean_adm1'].fillna('').astype(str),
        'lga': d['clean_adm2'].fillna('').astype(str),
        'install_year': pd.to_numeric(d['install_year'], errors='coerce'),
        'report_date': d['report_date'].fillna('').astype(str).str.slice(0, 10),
        'wpdx_id': d['wpdx_id'].fillna('').astype(str).str.slice(0, 40),
    })
    geom = gpd.points_from_xy(d.lon_deg.to_numpy(), d.lat_deg.to_numpy(), crs='EPSG:4326')
    g = gpd.GeoDataFrame(out.reset_index(drop=True), geometry=geom, crs='EPSG:4326')
    write_vec('groundwater_boreholes_wpdx_pt', g,
              'Water Point Data Exchange (WPDx) Nigeria water points, HDX enhanced CSV '
              '(CC BY-SA 4.0). Boreholes, protected wells, springs and piped sources with '
              'technology, functionality status and administrative area. Observed points, '
              'not modelled groundwater. Clipped to Nigeria. EPSG:4326.')


def transboundary_aquifers():
    import geopandas as gpd
    print('\n[IGRAC Transboundary Aquifers of the World 2025]', flush=True)
    q = urllib.parse.urlencode({
        'service': 'WFS', 'version': '1.0.0', 'request': 'GetFeature',
        'typeName': 'geonode:tba_map_2025', 'outputFormat': 'application/json',
        'bbox': '2.0,3.5,15.5,14.5', 'maxFeatures': '200',
    })
    url = IGRAC_WFS + '?' + q
    p = os.path.join(TMP, 'tba2025.geojson')
    download(url, p)
    with open(p, encoding='utf8') as f:
        fc = json.load(f)
    feats = fc.get('features', [])
    print(f'  WFS returned {len(feats)} features', flush=True)
    rows, geoms = [], []
    for f in feats:
        pr = f.get('properties') or {}
        geom = shape(f['geometry'])
        if not geom.intersects(box(WEST, SOUTH, EAST, NORTH)):
            continue
        clean = lambda v: str(v or '').replace('\xa0', ' ').strip()
        rows.append({
            'name': (clean(pr.get('name')) or clean(pr.get('code')) or 'Unnamed')[:160],
            'code': clean(pr.get('code'))[:20],
            'countries': clean(pr.get('countries'))[:220],
            'class_name': (clean(pr.get('aq_type')) or 'Undefined')[:80],
            'lithology': clean(pr.get('litho_a'))[:160],
            'aq_system': clean(pr.get('aq_system'))[:80],
            'info': str(pr.get('info') or '')[:40],
            'report_sdg': str(pr.get('report_sdg') or '')[:60],
            'source': 'IGRAC & UNESCO-IHP (2025), CC BY-SA 3.0 IGO',
        })
        geoms.append(geom)
    g = gpd.GeoDataFrame(rows, geometry=geoms, crs='EPSG:4326')
    g = clip_polygons(g, tol=0.0005)
    write_vec('groundwater_transboundary_igrac2025_pg', g,
              'IGRAC & UNESCO-IHP Transboundary Aquifers of the World, Edition 2025 '
              '(CC BY-SA 3.0 IGO; doi 10.58154/yb8g-cp97), via the GGIS GeoServer WFS '
              'layer geonode:tba_map_2025. Shared aquifer systems intersecting Nigeria '
              'including Lake Chad, Iullemmeden, Benue and Rio del Rey. Clipped to the '
              'Nigeria map window. EPSG:4326.')


# ------------------------------------------------------------------ rasters
def water_table():
    import netCDF4
    print('\n[Fan et al. revised water table depth, Africa annual mean]', flush=True)
    p = os.path.join(TMP, 'wtd.nc')
    ds = netCDF4.Dataset(p)
    lat = np.asarray(ds['lat'][:], dtype='f8')
    lon = np.asarray(ds['lon'][:], dtype='f8')
    iy = np.where((lat >= SOUTH - 0.05) & (lat <= NORTH + 0.05))[0]
    ix = np.where((lon >= WEST - 0.05) & (lon <= EAST + 0.05))[0]
    iy0, iy1, ix0, ix1 = iy[0], iy[-1], ix[0], ix[-1]
    print(f'  lat[{iy0}:{iy1}] {lat[iy0]:.4f}..{lat[iy1]:.4f}, '
          f'lon[{ix0}:{ix1}] {lon[ix0]:.4f}..{lon[ix1]:.4f}', flush=True)
    raw = np.ma.filled(ds['WTD'][0, iy0:iy1 + 1, ix0:ix1 + 1], np.nan).astype('f8')
    msk = np.asarray(ds['mask'][iy0:iy1 + 1, ix0:ix1 + 1])
    ds.close()
    # The revised Fan NetCDF stores water table depth as a NEGATIVE quantity
    # (metres below the land surface, -1000..0).  Depth in metres is -WTD.
    depth = -raw
    ok = (msk == 1) & np.isfinite(depth) & (depth >= 0)
    print(f'  source in-domain {ok.mean():.1%}, depth percentiles '
          f'{np.percentile(depth[ok], [1, 25, 50, 75, 99]).round(2)} m', flush=True)
    depth = np.where(ok, depth, NODATA).astype('f4')
    # NetCDF lat ascends; GeoTIFF rows run north -> south.
    depth = np.flipud(depth)
    resx = float(lon[1] - lon[0])
    resy = float(lat[1] - lat[0])
    tr = Affine(resx, 0, float(lon[ix0]) - resx / 2,
                0, -resy, float(lat[iy1]) + resy / 2)
    win = write_tif(os.path.join(TMP, 'wtd_window.tif'), depth, tr)
    a = to_grid(win, 1000, 800, Resampling.average, src_nodata=NODATA)
    out = layer_path(DATA, 'groundwater_water_table_fan2017_rst')
    write_raster(out, 'groundwater_water_table_fan2017_rst', a, BBOX,
                 uom='metres below land surface', field='WaterTableDepth',
                 description='Revised Fan et al. (2017) equilibrium water table depth, '
                             '0.01 degree (~1 km) Africa annual-mean NetCDF, averaged to '
                             'a 0.0125 degree grid and masked to Nigeria. Depth in metres '
                             'below the land surface (source stores negative depth). Free '
                             'for research with acknowledgement of Fan et al. 2017, '
                             'PNAS 114(40):10572-10577. EPSG:4326.')
    print(f'WROTE {out}  {os.path.getsize(out)/1e6:.2f} MB',
          flush=True)


def magnetic_anomaly():
    print('\n[EMAG2 v2 magnetic anomaly]', flush=True)
    os.environ.setdefault('GDAL_DISABLE_READDIR_ON_OPEN', 'EMPTY_DIR')
    win_path = os.path.join(TMP, 'emag2_window.tif')
    try:
        with rasterio.open('/vsicurl/' + EMAG2_TIF) as src:
            win = from_bounds(WEST, SOUTH, EAST, NORTH, transform=src.transform)
            arr = src.read(1, window=win)
            tr = src.window_transform(win)
            print(f'  remote window {arr.shape}, nodata={src.nodata}', flush=True)
        write_tif(win_path, arr, tr, nodata=-99999.0)
        path = win_path
    except Exception as e:
        print(f'  remote window failed ({e}); downloading full GeoTIFF', flush=True)
        path = download(EMAG2_TIF, os.path.join(TMP, 'emag2.tif'))
    a = to_grid(path, 500, 400, Resampling.average, src_nodata=-99999.0)
    valid = a != NODATA
    if valid.sum() == 0:
        raise RuntimeError('EMAG2 produced an empty Nigeria grid')
    print(f'  EMAG2 valid {valid.mean():.1%}, range '
          f'[{a[valid].min():.1f}, {a[valid].max():.1f}] nT', flush=True)
    out = layer_path(DATA, 'geophysics_magnetic_emag2_rst')
    write_raster(out, 'geophysics_magnetic_emag2_rst', a, BBOX,
                 uom='nanoTesla', field='MagneticAnomaly',
                 description='EMAG2 Earth Magnetic Anomaly Grid v2, 2 arc-minute global '
                             'total-field anomaly in nT (NOAA/NCEI / CIRES, free). '
                             'Averaged to 0.025 degree and masked to Nigeria. '
                             'EPSG:4326.')
    print(f'WROTE {out}  {os.path.getsize(out)/1e6:.2f} MB',
          flush=True)


# ----------------------------------------------------------------------- main
def main():
    os.makedirs(DATA, exist_ok=True)
    os.makedirs(TMP, exist_ok=True)

    for key, url, is_zip in DOWNLOADS:
        print(f'\n=== download {key}', flush=True)
        ext = '.zip' if is_zip else ('.csv' if key == 'wpdx' else '.nc')
        p = os.path.join(TMP, key + ext)
        download(url, p)
        if is_zip:
            unzip(p, key)

    bgs_nigeria()
    ecowas('ecowas', 'GWR_ECOWAS_v1_HydrogeologicalUnit.shp',
           'groundwater_units_ecowas2022_pg',
           ['ID_unit', 'St_unit', 'Basin', 'CS_era', 'CS_system', 'Lithology',
            'Consoldtn', 'Aq_type', 'Yield', 'Aq_prod', 'Sources'],
           'Groundwater Resources in the ECOWAS Region (BGR/BGS/BRGM/Eawag/UNESCO 2022), '
           '1:5,000,000, vector dataset GWR_ECOWAS_SHP_v1. Hydrogeological units '
           'with stratigraphy, basin, lithology, aquifer flow type, expected borehole '
           'yield and productivity class; harmonised with Nigeria linework from '
           'Dessauvagie (1974). Clipped to Nigeria. doi 10.25928/GWR-ECOWAS.1. EPSG:4326.')
    ecowas('ecowas', 'GWR_ECOWAS_v1_CoverLayer.shp',
           'groundwater_cover_ecowas2022_pg',
           ['ID_Cover', 'St_unit', 'Basin', 'CS_era', 'Lithology', 'Consoldtn',
            'Aq_type', 'Yield', 'Aq_prod', 'Sources'],
           'Groundwater Resources in the ECOWAS Region (2022) superficial cover layer: '
           'Quaternary alluvial, aeolian and lacustrine deposits overlying bedrock '
           'aquifers, with aquifer flow type and expected borehole yield. Nine '
           'region-wide units, clipped to Nigeria. doi 10.25928/GWR-ECOWAS.1. EPSG:4326.')
    wpdx_points()
    transboundary_aquifers()
    water_table()
    magnetic_anomaly()

    expected = [
        'groundwater_aquifers_bgs2019_pg', 'groundwater_units_ecowas2022_pg',
        'groundwater_cover_ecowas2022_pg', 'groundwater_boreholes_wpdx_pt',
        'groundwater_transboundary_igrac2025_pg',
        'groundwater_water_table_fan2017_rst', 'geophysics_magnetic_emag2_rst',
    ]
    print('\n=== expected outputs ===', flush=True)
    missing = []
    for t in expected:
        p = layer_path(DATA, t)
        ok = os.path.exists(p) and os.path.getsize(p) > 1024
        print(f'  {"OK " if ok else "MISS"} {t}', flush=True)
        if not ok:
            missing.append(t)
    if missing:
        raise RuntimeError('missing outputs: ' + ', '.join(missing))


if __name__ == '__main__':
    main()
