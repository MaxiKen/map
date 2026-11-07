#!/usr/bin/env python3
"""Final batch: three non-groundwater geology-associated Nigeria layers.

The previous batch was deliberately groundwater-heavy.  These three broaden the
catalog into geohazards and geothermal/rock properties, from the survey in
``docs/geology-associated-layers.md``.  Sources, licences and method:
``docs/final-layers.md``.

  * Landslide hazard, rainfall-triggered annual frequency .. World Bank / GFDRR (CC BY 4.0)
  * Landslide hazard, 4 ThinkHazard classes (vector) ....... World Bank / GFDRR (CC BY 4.0)
  * Geothermal heat flow measurements ....................... IHFC GHFDB Release 2024

Two vectors + one raster: the continuous frequency field is the only thing that
needs a raster.  Everything is cropped to 2.5-15.0 E, 4.0-14.0 N; the raster is
also masked to the geoBoundaries national outline.  One standalone GeoPackage
per layer, no table layers.

Run in GitHub Actions -- the editing sandbox cannot reach these hosts directly.
"""
from __future__ import annotations

import glob
import os
import sys
import zipfile

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.features import shapes as raster_shapes
from rasterio.windows import from_bounds
from shapely.geometry import shape as shapely_shape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_raster_gpkg import write_raster  # noqa: E402
from fetch_layers import (  # noqa: E402
    BBOX, WEST, SOUTH, EAST, NORTH, NODATA, TMP,
    download, unzip, to_grid, write_vec, nigeria_mask,
)

DATA = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')

# World Bank / GFDRR Global Landslide Hazard Map (Arup, 2020), CKAN dataset
# global-landslide-hazard-map, CC BY 4.0.  Both are Cloud-Optimised GeoTIFFs
# at 30 arc-seconds (~1 km) read through /vsicurl/ so only the Nigeria window
# is transferred (the median COG alone is 130 MB).
WB_MEDIAN_COG = ('https://datacatalogfiles.worldbank.org/ddh-published/0037584/'
                 'DR0045419/LS_RF_Median_1980-2018_COG.tif')
WB_TH_ZIP = ('https://datacatalogfiles.worldbank.org/ddh-published/0037584/'
             'DR0045415/ls_th.zip')
# IHFC Global Heat Flow Database, Release 2024 (91,182 points), GFZ doi
# 10.5880/fidgeo.2024.014.  Sheet 'data release2024', header on row 5 (0-based).
IHFC_XLSX = 'https://www.ihfc-iugg.org/user/downloads/data/R2024/IHFC_2024_GHFDB.xlsx'

DOWNLOADS = [
    ('ls_th', WB_TH_ZIP, True),
    ('ihfc', IHFC_XLSX, False),
]

TH_CLASSES = {1: 'Very low', 2: 'Low', 3: 'Moderate', 4: 'High'}


# ------------------------------------------------------------------ raster
def window_tif(url, key, out_path, nodata=None):
    """Read just the Nigeria window of a remote COG into a local GeoTIFF."""
    os.environ.setdefault('GDAL_DISABLE_READDIR_ON_OPEN', 'EMPTY_DIR')
    with rasterio.open('/vsicurl/' + url) as src:
        win = from_bounds(WEST, SOUTH, EAST, NORTH, transform=src.transform)
        arr = src.read(1, window=win)
        tr = src.window_transform(win)
        print(f'  {key}: remote window {arr.shape}, dtype={arr.dtype}, '
              f'nodata={src.nodata}, transform={tr}', flush=True)
        prof = dict(driver='GTiff', height=arr.shape[0], width=arr.shape[1], count=1,
                    dtype=arr.dtype, crs='EPSG:4326', transform=tr, nodata=nodata)
    with rasterio.open(out_path, 'w', **prof) as dst:
        dst.write(arr, 1)
    return out_path


def landslide_frequency():
    print('\n[World Bank rainfall-triggered landslide hazard]', flush=True)
    win = window_tif(WB_MEDIAN_COG, 'rainfall-triggered median',
                     os.path.join(TMP, 'ls_rf_median_window.tif'))
    # Annual frequency of significant landslides per km2 is a rate: average it.
    a = to_grid(win, 500, 400, Resampling.average)
    valid = a != NODATA
    print(f'  grid valid {valid.mean():.1%}, range '
          f'[{a[valid].min():.6f}, {a[valid].max():.6f}] landslides/km2/yr', flush=True)
    write_raster(os.path.join(DATA, 'hazards_landslide_rainfall_wb_rst.gpkg'),
                 'hazards_landslide_rainfall_wb_rst', a, BBOX,
                 uom='landslides per km2 per year', field='LandslideFrequency',
                 description='World Bank / GFDRR Global Landslide Hazard Map (Arup, 2020), '
                             'median annual frequency of significant rainfall-triggered '
                             'landslides per square kilometre, 1980-2018, 30 arc-second '
                             'COG averaged to 0.025 degree and masked to Nigeria. '
                             'CC BY 4.0. EPSG:4326.')
    print('WROTE hazards_landslide_rainfall_wb_rst.gpkg  '
          f'{os.path.getsize(os.path.join(DATA, "hazards_landslide_rainfall_wb_rst.gpkg"))/1e6:.2f} MB',
          flush=True)


def landslide_classes():
    import geopandas as gpd
    print('\n[World Bank ThinkHazard landslide classes, polygonised]', flush=True)
    tif = glob.glob(os.path.join(TMP, 'ls_th', '**', 'LS_TH.tif'), recursive=True)
    if not tif:
        raise RuntimeError('LS_TH.tif not found in ls_th.zip')
    with rasterio.open(tif[0]) as src:
        win = from_bounds(WEST, SOUTH, EAST, NORTH, transform=src.transform)
        arr = src.read(1, window=win)
        tr = src.window_transform(win)
        nodata = src.nodata if src.nodata is not None else 255
    print(f'  window {arr.shape}, values {np.unique(arr)[:8]}', flush=True)
    # Mask to the national outline before polygonising so the very-low class
    # does not spill into neighbouring countries.
    outline = nigeria_mask(arr.shape[0], arr.shape[1])
    ok = (arr != nodata) & outline
    work = np.where(ok, arr, nodata).astype('uint8')
    feats, geoms = [], []
    for geom, value in raster_shapes(work, mask=ok, transform=tr):
        v = int(value)
        if v not in TH_CLASSES:
            continue
        g = shapely_shape(geom)
        if g.is_empty or g.area < 5e-6:
            continue
        feats.append({
            'class_name': TH_CLASSES[v],
            'hazard_rank': v,
            'name': TH_CLASSES[v] + ' landslide hazard',
            'source': 'World Bank / GFDRR (2020), CC BY 4.0',
        })
        geoms.append(g)
    print(f'  polygonised {len(feats)} class regions', flush=True)
    g = gpd.GeoDataFrame(feats, geometry=geoms, crs='EPSG:4326')
    if len(g) > 1500:
        g = g.assign(_a=g.geometry.area).nlargest(1500, '_a').drop(columns=['_a'])
    g['geometry'] = g.geometry.simplify(0.002, preserve_topology=True)
    g = g[g.geometry.notna() & ~g.geometry.is_empty]
    g = g.reset_index(drop=True)
    write_vec('hazards_landslide_classes_wb_pg', g,
              'World Bank / GFDRR Global Landslide Hazard Map (Arup, 2020), combined '
              'rainfall- and earthquake-triggered hazard simplified to four '
              'ThinkHazard ranks (1 Very low, 2 Low, 3 Moderate, 4 High). '
              'The 30 arc-second LS_TH.tif raster was clipped to the Nigeria outline '
              'and polygonised into contiguous class regions; tiny regions removed '
              'and boundaries simplified to 0.002 degree. CC BY 4.0. EPSG:4326.')


# ------------------------------------------------------------------ vector
def heat_flow_points():
    import geopandas as gpd
    import pandas as pd
    print('\n[IHFC Global Heat Flow Database, Release 2024]', flush=True)
    p = os.path.join(TMP, 'ihfc.xlsx')
    d = pd.read_excel(p, sheet_name='data release2024', header=5)
    print(f'  source rows={len(d)}', flush=True)
    lat = pd.to_numeric(d['lat_NS'], errors='coerce')
    lon = pd.to_numeric(d['long_EW'], errors='coerce')
    m = (lon >= WEST) & (lon <= EAST) & (lat >= SOUTH) & (lat <= NORTH)
    d = d[m].copy()
    print(f'  rows inside Nigeria window={len(d)}', flush=True)
    clean = lambda v: str(v or '').strip('[]').strip()
    out = pd.DataFrame({
        'name': d['name'].fillna('Unnamed site').astype(str).str.slice(0, 90),
        'heat_flow': pd.to_numeric(d['q'], errors='coerce'),
        'uncertainty': pd.to_numeric(d['q_uncertainty'], errors='coerce'),
        'class_name': d['environment'].map(clean).replace('', 'Unspecified'),
        'country': d['Country'].fillna('').astype(str).str.slice(0, 60),
        'domain': d['Domain'].map(clean).str.slice(0, 60),
        'year': pd.to_numeric(d['Year'], errors='coerce'),
        'quality': d['Quality_Code'].fillna('').astype(str).str.slice(0, 30),
        'reference': d['publication_reference'].fillna('').astype(str).str.slice(0, 100),
        'lithology': d['geo_lithology'].fillna('').astype(str).str.slice(0, 120),
        'temp_gradient': pd.to_numeric(d['T_grad_mean'], errors='coerce'),
        'source': 'IHFC GHFDB Release 2024 (doi 10.5880/fidgeo.2024.014)',
    })
    geom = gpd.points_from_xy(lon[m].to_numpy(), lat[m].to_numpy(), crs='EPSG:4326')
    g = gpd.GeoDataFrame(out.reset_index(drop=True), geometry=geom, crs='EPSG:4326')
    write_vec('geology_heatflow_ihfc2024_pt', g,
              'International Heat Flow Commission Global Heat Flow Database, Release '
              '2024 (91,182 measurements, doi 10.5880/fidgeo.2024.014). Observed '
              'terrestrial heat flow q in mW/m2 with uncertainty, temperature gradient, '
              'environment, quality code and publication reference. Points inside the '
              'Nigeria map window, including nearby cross-border sites. EPSG:4326.')


# ----------------------------------------------------------------------- main
def main():
    os.makedirs(DATA, exist_ok=True)
    os.makedirs(TMP, exist_ok=True)
    for key, url, is_zip in DOWNLOADS:
        print(f'\n=== download {key}', flush=True)
        p = os.path.join(TMP, key + ('.zip' if is_zip else '.xlsx'))
        download(url, p)
        if is_zip:
            unzip(p, key)

    landslide_frequency()
    landslide_classes()
    heat_flow_points()

    expected = ['hazards_landslide_rainfall_wb_rst',
                'hazards_landslide_classes_wb_pg',
                'geology_heatflow_ihfc2024_pt']
    print('\n=== expected outputs ===', flush=True)
    missing = []
    for t in expected:
        p = os.path.join(DATA, t + '.gpkg')
        ok = os.path.exists(p) and os.path.getsize(p) > 1024
        print(f'  {"OK " if ok else "MISS"} {t}', flush=True)
        if not ok:
            missing.append(t)
    if missing:
        raise RuntimeError('missing outputs: ' + ', '.join(missing))


if __name__ == '__main__':
    main()
