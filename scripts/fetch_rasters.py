#!/usr/bin/env python3
"""Fetch the five missing Nigeria rasters and write them into data/ as GeoPackages.

Run where outbound HTTP is available (GitHub Actions). Sources, all public and key-free:

  * WorldClim 2.1, 10 arc-minute monthly climatologies (1970-2000)
      https://geodata.ucdavis.edu/climate/worldclim/2_1/base/wc2.1_10m_{prec,srad,tavg}.zip
      Fick & Hijmans (2017), doi:10.1002/joc.5086
  * AWS Terrain Tiles / Mapzen Terrarium DEM (SRTM 30 m + Copernicus fill)
      https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png
      elevation = R*256 + G + B/256 - 32768
  * ISRIC SoilGrids 2.0 WCS, phh2o_0-5cm_mean (pH x 10)
      https://maps.isric.org/mapserv?map=/map/phh2o.map
      Poggio et al. (2021), doi:10.5194/soil-7-217-2021, CC BY 4.0

Everything is cropped to the Nigeria extent and written on one common 500x400 grid
(0.025 deg), with ocean / no-prediction cells set to NoData.
"""
from __future__ import annotations

import concurrent.futures
import glob
import io
import math
import os
import sys
import urllib.request
import zipfile

import numpy as np
import rasterio
from PIL import Image
from rasterio.enums import Resampling
from rasterio.windows import from_bounds

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_raster_gpkg import write_raster  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
WEST, SOUTH, EAST, NORTH = 2.5, 4.0, 15.0, 14.0
W, H = 500, 400
NODATA = -9999.0
UA = {'User-Agent': 'nigeria-webgis-raster-fetch/1.0'}


def get(url: str, timeout: int = 300) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        b = r.read()
    print(f'  fetched {len(b)/1e6:7.2f} MB  {url[:110]}', flush=True)
    return b


def save(url: str, path: str, timeout: int = 300) -> bytes:
    b = get(url, timeout)
    with open(path, 'wb') as f:
        f.write(b)
    return b


def read_window(path_or_bytes, nodata_below=None):
    """Read a GeoTIFF, crop to the Nigeria bbox and resample onto the common grid."""
    if isinstance(path_or_bytes, (bytes, bytearray)):
        ctx = rasterio.MemoryFile(bytes(path_or_bytes))
        mf = ctx.open()
    else:
        ctx, mf = None, rasterio.open(path_or_bytes)
    with mf as ds:
        try:
            win = from_bounds(WEST, SOUTH, EAST, NORTH, ds.transform)
            a = ds.read(1, window=win, out_shape=(H, W), resampling=Resampling.bilinear)
        except Exception as e:
            print('    window crop failed, resampling whole coverage:', e, flush=True)
            a = ds.read(1, out_shape=(H, W), resampling=Resampling.bilinear)
        a = np.asarray(a, dtype='f4')
        nd = ds.nodata
        print(f'    crs={ds.crs} shape={a.shape} range=[{np.nanmin(a):.2f},{np.nanmax(a):.2f}] nodata={nd}',
              flush=True)
    if ctx is not None:
        ctx.close()
    if nd is not None and np.isfinite(nd):
        a = np.where(a == nd, NODATA, a)
    if nodata_below is not None:
        a = np.where(a < nodata_below, NODATA, a)
    a = np.where(np.isfinite(a), a, NODATA)
    return a


# ----------------------------------------------------------------- WorldClim
WC = 'https://geodata.ucdavis.edu/climate/worldclim/2_1/base/wc2.1_10m_%s.zip'


def worldclim(var: str, combine: str) -> np.ndarray:
    print(f'[WorldClim {var}]', flush=True)
    p = f'/tmp/wc2.1_10m_{var}.zip'
    save(WC % var, p)
    outdir = f'/tmp/wc_{var}'
    os.makedirs(outdir, exist_ok=True)
    with zipfile.ZipFile(p) as z:
        names = [n for n in z.namelist() if n.lower().endswith('.tif')]
        print('  members:', names, flush=True)
        z.extractall(outdir)
    tifs = sorted(glob.glob(os.path.join(outdir, '**', '*.tif'), recursive=True))
    if not tifs:
        raise RuntimeError(f'no tifs in {var} zip')
    stack = [read_window(t, nodata_below=-1000 if var != 'tavg' else -90) for t in tifs]
    s = np.stack(stack)
    out = s.sum(axis=0) if combine == 'sum' else s.mean(axis=0)
    out = np.where((s <= -1000).any(axis=0), NODATA, out)
    print(f'  {combine} of {len(tifs)} months -> [{np.nanmin(out):.2f}, {np.nanmax(out):.2f}]', flush=True)
    return out


# ------------------------------------------------------- AWS Terrarium DEM
def dem_terrarium(z: int = 9) -> np.ndarray:
    print('[DEM Terrarium]', flush=True)
    n = 256 * (2 ** z)
    lons = WEST + (np.arange(W) + 0.5) * (EAST - WEST) / W
    lats = NORTH - (np.arange(H) + 0.5) * (NORTH - SOUTH) / H
    gx = (lons + 180.0) / 360.0 * n
    gy = (1.0 - np.arcsinh(np.tan(np.radians(lats))) / math.pi) / 2.0 * n
    xi = np.floor(gx).astype(int)
    yi = np.floor(gy).astype(int)
    tx0, tx1 = int(xi.min() // 256), int(xi.max() // 256)
    ty0, ty1 = int(yi.min() // 256), int(yi.max() // 256)
    print(f'  z={z} tiles x={tx0}..{tx1} y={ty0}..{ty1} ({(tx1-tx0+1)*(ty1-ty0+1)} tiles)', flush=True)
    base = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium'
    jobs = [(tx, ty) for ty in range(ty0, ty1 + 1) for tx in range(tx0, tx1 + 1)]

    def one(tt):
        tx, ty = tt
        u = f'{base}/{z}/{tx}/{ty}.png'
        try:
            b = get(u, timeout=60)
            im = np.asarray(Image.open(io.BytesIO(b)).convert('RGB'), dtype='f4')
            return tx, ty, im[..., 0] * 256.0 + im[..., 1] + im[..., 2] / 256.0 - 32768.0
        except Exception as e:
            print(f'    tile {tx}/{ty} failed: {e}', flush=True)
            return tx, ty, None

    mosaic = np.full(((ty1 - ty0 + 1) * 256, (tx1 - tx0 + 1) * 256), NODATA, dtype='f4')
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as ex:
        for tx, ty, tile in ex.map(one, jobs):
            if tile is not None:
                mosaic[(ty - ty0) * 256:(ty - ty0 + 1) * 256,
                       (tx - tx0) * 256:(tx - tx0 + 1) * 256] = tile
    out = mosaic[yi - ty0 * 256, xi - tx0 * 256]
    print(f'  elevation range [{np.nanmin(out):.1f}, {np.nanmax(out):.1f}] m', flush=True)
    return out


# ------------------------------------------------------------ ISRIC SoilGrids
def soil_ph() -> np.ndarray:
    print('[ISRIC SoilGrids pH]', flush=True)
    b = ('https://maps.isric.org/mapserv?map=/map/phh2o.map&SERVICE=WCS&VERSION=2.0.1'
         '&REQUEST=GetCoverage&COVERAGEID=phh2o_0-5cm_mean')
    crs = 'http://www.opengis.net/def/crs/EPSG/0/4326'
    tail = f'&FORMAT=image/tiff&SUBSETTINGCRS={crs}&OUTPUTCRS={crs}'
    variants = [
        f'{b}&SUBSET=Long({WEST},{EAST})&SUBSET=Lat({SOUTH},{NORTH})&SIZE=Long({W})&SIZE=Lat({H}){tail}',
        f'{b}&SUBSET=X({WEST},{EAST})&SUBSET=Y({SOUTH},{NORTH})&SIZE=X({W})&SIZE=Y({H}){tail}',
        f'{b}&SUBSET=Long({WEST},{EAST})&SUBSET=Lat({SOUTH},{NORTH})'
        f'&RESOLUTION=Long({(EAST-WEST)/W})&RESOLUTION=Lat({(NORTH-SOUTH)/H}){tail}',
        f'{b}&SUBSET=X({WEST},{EAST})&SUBSET=Y({SOUTH},{NORTH})'
        f'&RESOLUTION=X({(EAST-WEST)/W})&RESOLUTION=Y({(NORTH-SOUTH)/H}){tail}',
    ]
    for i, u in enumerate(variants, 1):
        try:
            raw = get(u, timeout=240)
        except Exception as e:
            print(f'  variant {i} failed: {e}', flush=True)
            continue
        if raw[:4] not in (b'II*\x00', b'MM\x00*'):
            print(f'  variant {i} not a TIFF: {raw[:180]!r}', flush=True)
            continue
        print(f'  variant {i} returned a TIFF ({len(raw)/1e6:.2f} MB)', flush=True)
        a = read_window(raw)
        a = a / 10.0                     # SoilGrids stores pH x 10
        a = np.where(a <= 0, NODATA, a)  # 0 = no prediction / water
        print(f'  pH range [{np.nanmin(a):.2f}, {np.nanmax(a):.2f}]', flush=True)
        return a
    raise RuntimeError('all SoilGrids WCS variants failed')


RASTERS = [
    ('elevation_srtm_terrarium_rst', 'metres', 'Elevation',
     'DEM of Nigeria from AWS Terrain Tiles (Mapzen Terrarium: SRTM 30 m with Copernicus/other fill), '
     'sampled at zoom 9 and resampled to 0.025 deg. EPSG:4326.', None),
    ('climate_tavg_annual_worldclim_rst', 'degrees Celsius', 'Temperature',
     'Mean annual temperature 1970-2000 (mean of the 12 WorldClim 2.1 10 arc-minute monthly tavg grids). '
     'Fick & Hijmans 2017. EPSG:4326.', None),
    ('climate_prec_annual_worldclim_rst', 'millimetres', 'Precipitation',
     'Total annual precipitation 1970-2000 (sum of the 12 WorldClim 2.1 10 arc-minute monthly prec grids). '
     'Fick & Hijmans 2017. EPSG:4326.', None),
    ('climate_srad_annual_worldclim_rst', 'kJ m-2 day-1', 'SolarRadiation',
     'Mean annual solar radiation 1970-2000 (mean of the 12 WorldClim 2.1 10 arc-minute monthly srad grids). '
     'Fick & Hijmans 2017. EPSG:4326.', None),
    ('soil_ph_0_5cm_isric_rst', 'pH', 'SoilPH',
     'Soil pH (water) at 0-5 cm, ISRIC SoilGrids 2.0 mean prediction, divided by 10 from the WCS '
     'phh2o_0-5cm_mean coverage. Poggio et al. 2021, CC BY 4.0. EPSG:4326.', None),
]


def main():
    os.makedirs(DATA, exist_ok=True)
    grids = {
        'elevation_srtm_terrarium_rst': dem_terrarium(),
        'climate_tavg_annual_worldclim_rst': worldclim('tavg', 'mean'),
        'climate_prec_annual_worldclim_rst': worldclim('prec', 'sum'),
        'climate_srad_annual_worldclim_rst': worldclim('srad', 'mean'),
        'soil_ph_0_5cm_isric_rst': soil_ph(),
    }
    for table, uom, field, desc, _ in RASTERS:
        arr = np.asarray(grids[table], dtype='f4')
        assert arr.shape == (H, W), (table, arr.shape)
        out = os.path.join(DATA, table + '.gpkg')
        write_raster(out, table, arr, (WEST, SOUTH, EAST, NORTH), uom=uom, field=field, description=desc)
        n_ok = int((arr != NODATA).sum())
        print(f'WROTE {out}  valid={n_ok}/{arr.size}', flush=True)


if __name__ == '__main__':
    main()
