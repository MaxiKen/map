#!/usr/bin/env python3
"""
Build the static site from the GeoPackages in data/<group name>/.

    python scripts/build_site.py            # data/<group name>/**/*.gpkg -> public/
    python scripts/build_site.py --data data --app app --out public --config config/layers.config.json

Every layer found in every .gpkg (any name, any columns) becomes an entry in public/catalog.json.
The immediate subfolder of data/ is the layer's group and its name is displayed verbatim. Files
placed directly in data/ are rejected: the build never guesses a group from a filename or table.
A file whose basename starts with hidden_ is ignored, including every table inside that GeoPackage.
The web app builds its layer list, popups, legends and tables ONLY from that catalog, so adding,
replacing or renaming a layer/column in data/ needs no change to the app.

Needs: Python 3.9+, numpy, Pillow, Shapely (pip install -r scripts/requirements.txt). No GDAL, no server.
"""
import argparse, glob, gzip, hashlib, io, json, math, os, re, shutil, sqlite3, struct, sys, time
import numpy as np
from PIL import Image
from shapely.geometry import shape

from cross_border_policy import catalog_policy, load_policy, public_metadata, resolve_layer
from layer_quality_public import catalog_summary, public_quality, public_source_metadata

Image.MAX_IMAGE_PIXELS = None
MAX_IMG = 2800        # longest side of a raster / picture overlay (pixels)
MAX_VAL = 1400        # longest side of the value grid used for click-to-read values
MAX_TABLE_ROWS = 20000
PALETTE = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#46a4b5', '#c9a100', '#a6ce39', '#e64fb0', '#008080',
           '#9a6324', '#800000', '#4a7a00', '#808000', '#000075', '#e18d96', '#2f9e8f', '#8e6bbf', '#d96c1e', '#5c7aff',
           '#a3a33a', '#b5338a', '#3aa655', '#d3495a', '#4b8bbe', '#b7791f', '#6b46c1', '#2c7a7b', '#c05621', '#718096']
RAMP = [(0, (68, 1, 84)), (0.25, (59, 82, 139)), (0.5, (33, 145, 140)), (0.75, (94, 201, 98)), (1, (253, 231, 37))]
KIND_SUFFIX = {'pg': 'polygon', 'ln': 'line', 'pt': 'point', 'rst': 'raster', 'img': 'image', 'tbl': 'table'}
NAME_FIELDS = ['name', 'label', 'title', 'class_name', 'mineral', 'unit', 'lga', 'state', 'ward', 'town', 'description']
CLASS_FIELDS = ['class_name', 'mineral', 'unit', 'unit_code', 'geology_unit', 'glg_code', 'type', 'class', 'category',
                'description', 'state', 'group', 'legend', 'zone', 'age_group', 'era', 'name']


# ------------------------------------------------------------------ helpers
def slug(s): return re.sub(r'[^a-z0-9_]+', '_', s.lower()).strip('_')


def pretty(s): return re.sub(r'\s+', ' ', s.replace('_', ' ')).strip().capitalize()


def discover_geopackages(data_dir):
    """Return (path, group name) pairs, grouped by each top-level data subfolder.

    Group folders may contain additional nested folders for organisation; only the
    top-level folder controls the display group. No files of any kind are allowed
    directly in data/, which prevents an upload from silently losing its grouping.
    """
    if not os.path.isdir(data_dir):
        raise ValueError(f'data directory does not exist: {data_dir}')
    with os.scandir(data_dir) as entries:
        entries = list(entries)
    loose = sorted(e.name for e in entries if e.is_file())
    if loose:
        shown = ', '.join(loose[:5]) + (', …' if len(loose) > 5 else '')
        raise ValueError(
            f'files are not allowed directly in {data_dir}/: {shown}. '
            f'Move each GeoPackage into a group folder, for example '
            f'{data_dir}/Geology/example.gpkg. The folder name becomes the display group.')
    files = []
    groups = sorted((e for e in entries if e.is_dir()), key=lambda e: e.name.casefold())
    for group in groups:
        paths = sorted(glob.glob(os.path.join(group.path, '**', '*.gpkg'), recursive=True))
        files.extend((path, group.name) for path in paths)
    return files


SOURCES = {'map2011', 'map2023', 'picture', 'usgs', 'gadm', 'diva', 'isric', 'worldclim', 'osm', 'wdpa', 'wfp', 'esri',
           'cgls2019', 'anthromapper', 'geoboundaries', 'glc2000', 'srtm1km', 'srtm247m'}


def label_from_name(n):
    parts = n.split('_')
    kind = None
    if parts and parts[-1] in KIND_SUFFIX: kind = KIND_SUFFIX[parts.pop()]
    if len(parts) > 1: parts = parts[1:]          # omit the legacy theme prefix from the layer label
    src = [p for p in parts if p in SOURCES]
    rest = [p for p in parts if p not in SOURCES]
    if not rest: rest = [kind or 'layer']
    lab = pretty(' '.join(rest))
    return lab + (' (' + ', '.join(s.upper() if s in ('usgs', 'gadm', 'diva', 'isric', 'osm', 'wdpa', 'wfp', 'esri') else s for s in src) + ')' if src else '')


def kind_from_name(n):
    t = n.split('_')[-1]
    return KIND_SUFFIX.get(t)


def hexcol(rgb): return '#%02x%02x%02x' % tuple(int(v) for v in rgb)


def ramp_color(t):
    t = min(1, max(0, t))
    for (a, ca), (b, cb) in zip(RAMP, RAMP[1:]):
        if t <= b:
            k = (t - a) / (b - a); return tuple(ca[i] + (cb[i] - ca[i]) * k for i in range(3))
    return RAMP[-1][1]


def hash_color(s):
    h = int(hashlib.md5(s.encode()).hexdigest(), 16)
    return PALETTE[h % len(PALETTE)]


def merc_y(lat): return math.log(math.tan(math.pi / 4 + math.radians(max(-85, min(85, lat))) / 2))


def lat_from_merc(y): return math.degrees(2 * math.atan(math.exp(y)) - math.pi / 2)


# ------------------------------------------------------------------ geometry (GeoPackage blob -> GeoJSON geometry)
def _r(v, nd): return round(v, nd)


def read_wkb(b, o, nd):
    bo = '<' if b[o] == 1 else '>'
    t = struct.unpack_from(bo + 'I', b, o + 1)[0]; o += 5
    has_z = bool(t & 0x80000000) or (1000 <= (t & 0xFFFF) < 2000) or (3000 <= (t & 0xFFFF) < 4000)
    has_m = bool(t & 0x40000000) or (2000 <= (t & 0xFFFF) < 3000) or (3000 <= (t & 0xFFFF) < 4000)
    if t & 0x20000000: o += 4  # srid
    t = (t & 0xFFFF) % 1000
    dim = 2 + (1 if has_z else 0) + (1 if has_m else 0)

    def pts(o):
        n = struct.unpack_from(bo + 'I', b, o)[0]; o += 4
        a = np.frombuffer(b, dtype=bo + 'f8', count=n * dim, offset=o).reshape(n, dim)[:, :2]
        return np.round(a, nd).tolist(), o + 8 * n * dim

    if t == 1:
        a = struct.unpack_from(bo + 'dd', b, o); return {'type': 'Point', 'coordinates': [_r(a[0], nd), _r(a[1], nd)]}, o + 8 * dim
    if t == 2:
        p, o = pts(o); return {'type': 'LineString', 'coordinates': p}, o
    if t == 3:
        n = struct.unpack_from(bo + 'I', b, o)[0]; o += 4; rings = []
        for _ in range(n):
            p, o = pts(o); rings.append(p)
        return {'type': 'Polygon', 'coordinates': rings}, o
    if t in (4, 5, 6, 7):
        n = struct.unpack_from(bo + 'I', b, o)[0]; o += 4; parts = []
        for _ in range(n):
            g, o = read_wkb(b, o, nd); parts.append(g)
        if t == 7: return {'type': 'GeometryCollection', 'geometries': parts}, o
        name = {4: 'MultiPoint', 5: 'MultiLineString', 6: 'MultiPolygon'}[t]
        return {'type': name, 'coordinates': [p['coordinates'] for p in parts]}, o
    raise ValueError('WKB type %d' % t)


def read_gpkg_geom(b, nd=5):
    if b is None or len(b) < 8 or b[:2] != b'GP': return None
    env = (b[3] >> 1) & 7
    n = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[env]
    if (b[3] >> 4) & 1: return None  # empty
    g, _ = read_wkb(b, 8 + n, nd)
    return g


def read_valid_gpkg_geom(blob, nd=5):
    """Export valid geometry, increasing precision only where rounding breaks it.

    The source is never repaired or altered. Most features retain the compact
    five-decimal representation; a small number need more significant digits to
    avoid collapsed points or rounding-induced self-intersections.
    """
    geometry = read_gpkg_geom(blob, nd)
    if geometry is None or shape(geometry).is_valid:
        return geometry, nd
    for precision in (6, 7, 8, 9, 10, 12, 15):
        if precision <= nd:
            continue
        candidate = read_gpkg_geom(blob, precision)
        if shape(candidate).is_valid:
            return candidate, precision
    raise ValueError('GeoPackage geometry remains invalid at full export precision')


def bbox_of(g, box):
    t = g['type']
    if t == 'Point': c = [g['coordinates']]
    elif t in ('LineString', 'MultiPoint'): c = g['coordinates']
    elif t in ('Polygon', 'MultiLineString'): c = [p for r in g['coordinates'] for p in r]
    elif t == 'MultiPolygon': c = [p for pl in g['coordinates'] for r in pl for p in r]
    else:
        for s in g['geometries']: bbox_of(s, box)
        return
    for x, y in c:
        if x < box[0]: box[0] = x
        if y < box[1]: box[1] = y
        if x > box[2]: box[2] = x
        if y > box[3]: box[3] = y


# ------------------------------------------------------------------ rasters
def resample_rows_mercator(a, south, north, nodata_fill):
    """a: (H,W[,C]) north-up, rows linear in latitude -> rows linear in Web-Mercator y (same shape)."""
    H = a.shape[0]
    ys, yn = merc_y(south), merc_y(north)
    out_y = yn - (np.arange(H) + 0.5) / H * (yn - ys)
    lat = np.degrees(2 * np.arctan(np.exp(out_y)) - np.pi / 2)
    src = ((north - lat) / (north - south) * H).astype(int)
    return a[np.clip(src, 0, H - 1)]


def downsample(a, maxpx, categorical, nodata):
    H, W = a.shape[:2]
    f = max(H, W) / maxpx
    if f <= 1: return a
    nh, nw = max(1, round(H / f)), max(1, round(W / f))
    if categorical:
        ri = np.minimum((np.arange(nh) + 0.5) * H / nh, H - 1).astype(int)
        ci = np.minimum((np.arange(nw) + 0.5) * W / nw, W - 1).astype(int)
        return a[np.ix_(ri, ci)]
    valid = (a != nodata) & np.isfinite(a)
    s = Image.fromarray(np.where(valid, a, 0).astype(np.float32), 'F').resize((nw, nh), Image.BOX)
    c = Image.fromarray(valid.astype(np.float32), 'F').resize((nw, nh), Image.BOX)
    s, c = np.array(s), np.array(c)
    return np.where(c > 0.5, s / np.maximum(c, 1e-9), nodata).astype(np.float32)


def stitch(con, table, tile_decode):
    """stitch the highest zoom level of a tile table into one array; returns (array, info)"""
    z = con.execute(f'select max(zoom_level) from "{table}"').fetchone()[0]
    mw, mh, tw, th, px, py = con.execute('select matrix_width,matrix_height,tile_width,tile_height,pixel_x_size,pixel_y_size from gpkg_tile_matrix where table_name=? and zoom_level=?', (table, z)).fetchone()
    mnx, mny, mxx, mxy = con.execute('select min_x,min_y,max_x,max_y from gpkg_tile_matrix_set where table_name=?', (table,)).fetchone()
    cx0, cy0, cx1, cy1 = con.execute('select min_x,min_y,max_x,max_y from gpkg_contents where table_name=?', (table,)).fetchone()
    W0 = int(round((cx1 - mnx) / px)); H0 = int(round((mxy - cy0) / py))
    W0 = min(W0, mw * tw); H0 = min(H0, mh * th)
    big = None
    for col, row, data in con.execute(f'select tile_column,tile_row,tile_data from "{table}" where zoom_level=?', (z,)):
        t = tile_decode(data)
        if big is None:
            shape = (mh * th, mw * tw) + t.shape[2:]
            big = np.zeros(shape, t.dtype)
            if table_fill is not None: big[...] = table_fill
        big[row * th:(row + 1) * th, col * tw:(col + 1) * tw] = t
    return big[:H0, :W0], (mnx, cy0, mnx + W0 * px, mxy)


table_fill = None


def build_raster(con, table, row, out, cfg):
    global table_fill
    anc = con.execute('select datatype,scale,offset,data_null,uom,field_name,quantity_definition from gpkg_2d_gridded_coverage_ancillary where tile_matrix_set_name=?', (table,)).fetchone()
    nodata = float(anc[3]) if anc and anc[3] is not None else -9999.0
    uom = (anc[4] or '') if anc else ''
    field = (anc[5] or '') if anc else ''
    import tifffile
    table_fill = nodata
    arr, bb = stitch(con, table, lambda d: tifffile.imread(io.BytesIO(d)).astype(np.float32))
    table_fill = None
    west, south, east, north = bb
    valid = (arr != nodata) & np.isfinite(arr)
    if not valid.any(): raise ValueError('raster has no valid cells')
    vals = arr[valid]
    uniq = np.unique(vals) if vals.size < 5_000_000 else np.unique(vals[::50])
    categorical = ('class' in uom.lower() or field.lower().endswith('code') or table.endswith('_code_rst')
                   or (len(uniq) <= 60 and np.allclose(uniq, np.round(uniq))))
    img = downsample(arr, MAX_IMG, categorical, nodata)
    img = resample_rows_mercator(img, south, north, nodata)
    ok = (img != nodata) & np.isfinite(img)
    rgba = np.zeros(img.shape + (4,), np.uint8)
    info = {'bounds': [west, south, east, north], 'categorical': bool(categorical), 'uom': uom, 'field': field,
            'min': float(vals.min()), 'max': float(vals.max()), 'nodata': nodata}
    if categorical:
        cls = [int(v) for v in uniq]
        colors = {}
        cmap = cfg.get('colors', {})
        for i, v in enumerate(cls): colors[v] = cmap.get(str(v), PALETTE[i % len(PALETTE)])
        lut_keys = np.array(cls)
        idx = np.searchsorted(lut_keys, np.where(ok, img, lut_keys[0]).astype(int))
        pal = np.array([[int(colors[v][i:i + 2], 16) for i in (1, 3, 5)] for v in cls], np.uint8)
        rgba[..., :3] = pal[np.clip(idx, 0, len(cls) - 1)]
        info['classes'] = [{'value': v, 'color': colors[v]} for v in cls]
    else:
        lo, hi = np.percentile(vals[::max(1, vals.size // 400000)], [2, 98])
        if hi <= lo: lo, hi = float(vals.min()), float(vals.max()) + 1e-9
        t = np.clip((img - lo) / (hi - lo), 0, 1)
        stops = np.array([s for s, _ in RAMP]); cols = np.array([c for _, c in RAMP], float)
        for i in range(3): rgba[..., i] = np.interp(t, stops, cols[:, i]).astype(np.uint8)
        info['stretch'] = [float(lo), float(hi)]
        info['ramp'] = [hexcol(c) for _, c in RAMP]
    rgba[..., 3] = np.where(ok, 255, 0)
    fn = f'{row["id"]}.png'
    Image.fromarray(rgba, 'RGBA').save(os.path.join(out, 'data', fn), optimize=True)
    # value grid (same mercator-row geometry) for click-to-read values
    vg = downsample(arr, MAX_VAL, categorical, nodata)
    vg = resample_rows_mercator(vg, south, north, nodata)
    vgf = f'{row["id"]}.vals.gz'
    payload = vg.astype('<i2' if categorical and vals.max() < 32000 and vals.min() > -32000 else '<f4')
    if payload.dtype == np.int16: payload = np.where(vg == nodata, -32768, vg).astype('<i2')
    with gzip.GzipFile(os.path.join(out, 'data', vgf), 'wb', 6, mtime=0) as f: f.write(payload.tobytes())
    info['image'] = 'data/' + fn
    info['values'] = {'file': 'data/' + vgf, 'w': int(vg.shape[1]), 'h': int(vg.shape[0]), 'dtype': 'i2' if payload.dtype == np.int16 else 'f4'}
    info['size'] = [int(rgba.shape[1]), int(rgba.shape[0])]
    return info


def build_image(con, table, row, out):
    def dec(d):
        im = Image.open(io.BytesIO(d)); im.load()
        return np.array(im.convert('RGBA'))
    global table_fill
    table_fill = 0
    arr, bb = stitch(con, table, dec)
    table_fill = None
    west, south, east, north = bb
    arr = downsample_rgba(arr, MAX_IMG)
    arr = resample_rows_mercator(arr, south, north, 0)
    a = arr[..., 3]
    opaque = bool((a > 250).mean() > 0.999)
    fn = f'{row["id"]}.' + ('jpg' if opaque else 'png')
    im = Image.fromarray(arr, 'RGBA')
    if opaque: im.convert('RGB').save(os.path.join(out, 'data', fn), quality=82, optimize=True)
    else: im.save(os.path.join(out, 'data', fn), optimize=True)
    return {'bounds': [west, south, east, north], 'image': 'data/' + fn, 'size': [arr.shape[1], arr.shape[0]]}


def downsample_rgba(a, maxpx):
    H, W = a.shape[:2]; f = max(H, W) / maxpx
    if f <= 1: return a
    im = Image.fromarray(a, 'RGBA').resize((max(1, round(W / f)), max(1, round(H / f))), Image.LANCZOS)
    return np.array(im)


# ------------------------------------------------------------------ vector + tables
def col_kind(t):
    t = (t or '').upper()
    if any(k in t for k in ('INT', 'REAL', 'FLOA', 'DOUB', 'NUM', 'DEC')): return 'number'
    if 'BOOL' in t: return 'boolean'
    if any(k in t for k in ('DATE', 'TIME')): return 'date'
    return 'text'


def choose_style(kind, fields, rows, cfg, name):
    st = cfg.get('style')
    if st: return st
    base = cfg.get('color') or hash_color(name)
    txt = [f for f in fields if f['type'] == 'text']
    # hex colour column
    for f in fields:
        if f['type'] == 'text' and re.search(r'colou?r|hex', f['name'], re.I):
            vs = [r[f['name']] for r in rows[:300] if isinstance(r.get(f['name']), str)]
            if vs and sum(bool(re.fullmatch(r'#[0-9a-fA-F]{6}', v)) for v in vs) >= 0.8 * len(vs):
                lab = next((g['name'] for g in sorted([g for g in txt if g['name'] != f['name']], key=lambda g: CLASS_FIELDS.index(g['name']) if g['name'] in CLASS_FIELDS else 99)), None)
                leg, seen_l = [], set()
                for r in rows:
                    cv = r.get(f['name'])
                    lv = r.get(lab) if lab else cv
                    if cv and lv is not None and (lv, cv) not in seen_l:
                        seen_l.add((lv, cv)); leg.append([str(lv), cv])
                return {'mode': 'color-field', 'field': f['name'], 'color': base, 'labelField': lab, 'legend': sorted(leg)[:150]}
    txt = [f for f in fields if f['type'] == 'text']
    order = sorted(txt, key=lambda f: CLASS_FIELDS.index(f['name']) if f['name'] in CLASS_FIELDS else 99)
    for f in order:
        vals = [r.get(f['name']) for r in rows]
        u = sorted({v for v in vals if v not in (None, '')})
        if 2 <= len(u) <= 90 and (len(rows) <= 90 or len(u) <= 0.5 * len(rows)):
            if f['name'] in CLASS_FIELDS or len(u) <= 30:
                cmap = cfg.get('colors', {})
                return {'mode': 'category', 'field': f['name'], 'color': base,
                        'colors': {v: cmap.get(v, PALETTE[i % len(PALETTE)]) for i, v in enumerate(u)}}
    return {'mode': 'single', 'color': base}


def build_vector(con, table, row, gcol, geomtype, out, cfg):
    cols = [(r[1], col_kind(r[2])) for r in con.execute(f'pragma table_info("{table}")') if r[1] != gcol and r[1].lower() not in ('fid', 'ogc_fid')]
    hide = {k for k, v in cfg.get('fields', {}).items() if v.get('hidden')}
    nd = 5 if geomtype in ('POINT', 'MULTIPOINT') else 5
    feats, rowsd = [], []
    precision_fallbacks = {}
    box = [1e9, 1e9, -1e9, -1e9]
    sel = ','.join(f'"{c}"' for c, _ in cols)
    for rec in con.execute(f'select "{gcol}"{"," + sel if sel else ""} from "{table}"'):
        if geomtype.upper() in ('POINT', 'MULTIPOINT'):
            g = read_gpkg_geom(rec[0], nd)
            precision = nd
        else:
            g, precision = read_valid_gpkg_geom(rec[0], nd)
        if g is None: continue
        if precision != nd:
            precision_fallbacks[precision] = precision_fallbacks.get(precision, 0) + 1
        bbox_of(g, box)
        props = {}
        for (c, k), v in zip(cols, rec[1:]):
            if v is None or v == '' or c in hide: continue
            if k == 'number' and isinstance(v, float): v = round(v, 6)
            props[c] = v
        feature = {'type': 'Feature', 'properties': props, 'geometry': g}
        # Administrative IDs are stable entity identifiers, not row-number FIDs.
        # Preserve them in the standard GeoJSON id member as well as properties.
        if props.get('admin_id'):
            feature['id'] = props['admin_id']
        feats.append(feature)
        rowsd.append(props)
    fields = [{'name': c, 'type': k, 'label': cfg.get('fields', {}).get(c, {}).get('label', pretty(c))} for c, k in cols if c not in hide]
    style = choose_style(row['kind'], fields, rowsd, cfg, table)
    lf = cfg.get('labelField') or next((n for n in NAME_FIELDS if n in [f['name'] for f in fields if f['type'] == 'text']), None)
    fn = f'{row["id"]}.geojson'
    with open(os.path.join(out, 'data', fn), 'w', encoding='utf8') as f:
        json.dump({'type': 'FeatureCollection', 'features': feats}, f, separators=(',', ':'), ensure_ascii=False)
    result = {'file': 'data/' + fn, 'count': len(feats), 'fields': fields, 'style': style, 'labelField': lf,
              'bounds': box if box[0] < box[2] + 1e-9 and box[0] < 1e8 else None, 'geometry': geomtype}
    if precision_fallbacks:
        result['geometryPrecisionFallbacks'] = dict(sorted(precision_fallbacks.items()))
        print('  geometry precision fallbacks:', result['geometryPrecisionFallbacks'], flush=True)
    return result


def build_table(con, table, row, out, cfg):
    cols = [(r[1], col_kind(r[2])) for r in con.execute(f'pragma table_info("{table}")')]
    hide = {k for k, v in cfg.get('fields', {}).items() if v.get('hidden')}
    cols = [c for c in cols if c[0] not in hide]
    n = con.execute(f'select count(*) from "{table}"').fetchone()[0]
    data = [list(r) for r in con.execute(f'select {",".join(chr(34) + c + chr(34) for c, _ in cols)} from "{table}" limit {MAX_TABLE_ROWS}')]
    fn = f'{row["id"]}.json'
    with open(os.path.join(out, 'data', fn), 'w', encoding='utf8') as f:
        json.dump({'columns': [c for c, _ in cols], 'rows': data}, f, separators=(',', ':'), ensure_ascii=False, default=str)
    return {'file': 'data/' + fn, 'count': n, 'fields': [{'name': c, 'type': k, 'label': cfg.get('fields', {}).get(c, {}).get('label', pretty(c))} for c, k in cols]}


# ------------------------------------------------------------------ legends
# Legend tables are never published as layers of their own: they describe another layer, so their
# rows are folded into that layer (extra attributes on every feature for vector layers, class names
# and attribute columns for rasters) and the table file is dropped.
LEGEND_KEY_FIELDS = ['raster_value', 'unit_code', 'glg_code', 'legend_no', 'code', 'class', 'unit', 'class_name',
                     'geology_unit', 'category', 'type', 'legend']
LEGEND_LABEL_FIELDS = ['geology_unit', 'description', 'class_name', 'label', 'name', 'mineral', 'formation', 'unit',
                       'legend', 'category', 'class', 'zone', 'series', 'era', 'type']


def is_legend_table(layer):
    if layer['kind'] != 'table':
        return False
    t = layer['table'].lower()
    return bool(re.search(r'(^|_)legend(_|$)', t)) or 'legend' in (layer.get('label') or '').lower()


def read_layer_json(out, layer):
    try:
        with open(os.path.join(out, layer['file']), encoding='utf8') as f:
            return json.load(f)
    except Exception:
        return {}


def find_owner(legend, cols, layers, cfg):
    """Pick the layer a legend table describes: explicit config first, then name prefix + key overlap."""
    stem = re.sub(r'_?legend.*$', '', legend['table'])
    best = None
    for l in layers:
        if l['kind'] == 'table' or l.get('_consumed') or l is legend:
            continue
        t = l['table']
        if cfg.get('legendOf'):
            if t != cfg['legendOf']:
                continue
            name_score = 100
        elif t == stem or t.startswith(stem + '_'):
            name_score = 60 + min(len(stem), 30)
        elif stem.startswith(t):
            name_score = 40
        else:
            continue
        fnames = {f['name'] for f in l.get('fields', [])}
        if l['kind'] == 'raster':
            fnames.add('raster_value')
        overlap = len([c for c in cols if c in fnames])
        # a raster that owns a raster_value legend wins over vector layers sharing the prefix
        if l['kind'] == 'raster' and cfg.get('legendKey', 'raster_value') in cols:
            overlap += 3
        score = name_score + overlap * 5
        if l['kind'] == 'table':
            score -= 100
        if best is None or score > best[0]:
            best = (score, l)
    return best[1] if best and best[0] > 40 else None


def pick_key(cols, owner, rows, props_by_key):
    """Choose the legend column that keys into the owner layer, and how well it matches (0..1)."""
    fnames = {f['name'] for f in owner.get('fields', [])}
    cands = [c for c in cols if c in fnames]
    if owner['kind'] == 'raster' and 'raster_value' in cols:
        return 'raster_value', 1.0
    order = sorted(cands, key=lambda c: LEGEND_KEY_FIELDS.index(c) if c in LEGEND_KEY_FIELDS else 99)
    ci = cols.index
    found = []
    for c in order:
        known = props_by_key.get(c)
        if not known:
            continue
        vals = [r[ci(c)] for r in rows if len(r) > ci(c)]
        cov = sum(1 for v in vals if v in known) / max(1, len(vals))
        found.append((c, cov))
        if cov >= 0.6:            # first preferred key that actually joins wins
            return c, cov
    return max(found, key=lambda t: t[1]) if found else (None, 0.0)


def legend_field_meta(legend, cols):
    types = {f['name']: f.get('type', 'text') for f in legend.get('fields', [])}
    labels = {f['name']: f.get('label', pretty(f['name'])) for f in legend.get('fields', [])}
    return [{'name': c, 'type': types.get(c, 'text'), 'label': labels.get(c, pretty(c))} for c in cols]


def fold_legends(layers, out, lcfg):
    """Fold every legend table into the layer it belongs to. Returns True when something changed."""
    legends = [l for l in layers if is_legend_table(l)]
    changed = False
    for legend in legends:
        cfg = lcfg.get(legend['table'], lcfg.get(legend['id'], {}))
        if cfg.get('keepAsLayer'):
            continue
        data = read_layer_json(out, legend)
        cols = data.get('columns') or [f['name'] for f in legend.get('fields', [])]
        rows = data.get('rows') or []
        if not cols or not rows:
            continue
        owner = find_owner(legend, cols, layers, cfg)
        if owner is None:
            print(f'  legend {legend["table"]}: no owner found, kept as a layer'); continue

        label_field = next((c for c in LEGEND_LABEL_FIELDS if c in cols and c != cfg.get('legendKey')), None)
        label_field = label_field or next((c for c in cols if c not in ('id',)), None)
        colour_field = next((c for c in cols if re.search(r'colou?r', c, re.I)), None)
        attrs = legend_field_meta(legend, cols)

        if owner['kind'] == 'raster':
            key = cfg.get('legendKey') or 'raster_value'
            if key not in cols:
                print(f'  legend {legend["table"]}: no raster_value column, kept as a layer'); continue
            ki = cols.index(key)
            by_val = {}
            for r in rows:
                try: by_val[int(float(r[ki]))] = r
                except (TypeError, ValueError): continue
            classes = owner.get('classes') or []
            for c in classes:
                r = by_val.get(int(c['value']))
                if not r: continue
                c['label'] = str(r[cols.index(label_field)]) if label_field else 'Class %s' % c['value']
                c['props'] = {cols[i]: r[i] for i in range(len(cols))
                              if cols[i] not in (key, 'id') and r[i] not in (None, '')}
            owner['attributes'] = ([{'name': 'class', 'label': 'Class', 'type': 'text'}]
                                   + [a for a in attrs if a['name'] != 'id'])
            owner['legendTitle'] = legend.get('label') or pretty(legend['table'])
            owner['legendFrom'] = legend['table']
            owner['legendCount'] = len(by_val)
        else:
            gj = read_layer_json(out, owner)
            feats = gj.get('features') or []
            props_by_key = {}
            for c in cols:
                props_by_key[c] = {f.get('properties', {}).get(c) for f in feats[:6000]}
            key, cov = pick_key(cols, owner, rows, props_by_key)
            if not key or cov < 0.5:
                print(f'  legend {legend["table"]}: no matching key in {owner["table"]} ({key}, {cov:.0%}), kept as a layer')
                continue
            ki = cols.index(key)
            extra = [c for c in cols if c not in (key, 'id') and c not in {f['name'] for f in owner.get('fields', [])}]
            classes = []
            lut = {}
            for r in rows:
                k = r[ki]
                if k is None: continue
                lut[k] = r
                classes.append({'key': k, 'label': str(r[cols.index(label_field)]) if label_field else str(k),
                                'color': r[cols.index(colour_field)] if colour_field else None,
                                'props': {c: r[cols.index(c)] for c in extra}})
            if extra:
                for f in feats:
                    p = f.get('properties') or {}
                    r = lut.get(p.get(key))
                    if not r: continue
                    for c in extra:
                        v = r[cols.index(c)]
                        if v not in (None, '') and p.get(c) in (None, ''):
                            p[c] = v
                with open(os.path.join(out, owner['file']), 'w', encoding='utf8') as fh:
                    json.dump(gj, fh, separators=(',', ':'), ensure_ascii=False)
                owner['fields'] = (owner.get('fields') or []) + [
                    {'name': c, 'type': next((a['type'] for a in attrs if a['name'] == c), 'text'), 'label': pretty(c)}
                    for c in extra]
            owner['legendClasses'] = classes
            owner['legendKey'] = key
            owner['legendLabelField'] = label_field
            owner['legendTitle'] = legend.get('label') or pretty(legend['table'])
            owner['legendFrom'] = legend['table']
            owner['legendAttributes'] = attrs

        legend['_consumed'] = True
        changed = True
        print(f'  legend {legend["table"]} -> {owner["table"]} ({len(rows)} rows)')
    if changed:
        for legend in legends:
            if legend.get('_consumed') and legend.get('file'):
                p = os.path.join(out, legend['file'])
                if os.path.exists(p):
                    os.remove(p)
    return [l for l in layers if not l.get('_consumed')]


# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default='data'); ap.add_argument('--app', default='app')
    ap.add_argument('--out', default='public'); ap.add_argument('--config', default='config/layers.config.json')
    a = ap.parse_args()
    t0 = time.time()
    config = json.load(open(a.config, encoding='utf8')) if os.path.exists(a.config) else {}
    lcfg = config.get('layers', {})
    cross_border = load_policy()
    quality_path = os.path.join(
        os.path.dirname(__file__), '..', 'docs', 'geospatial-audit', 'layer-quality-register.json')
    quality_document = None
    quality_layers = {}
    if os.path.isfile(quality_path):
        with open(quality_path, encoding='utf8') as handle:
            quality_document = json.load(handle)
        quality_layers = {row['layer']: row for row in quality_document['layers']}
    try:
        discovered = discover_geopackages(a.data)
    except ValueError as e:
        ap.error(str(e))
    files = [(path, group) for path, group in discovered
             if not os.path.basename(path).startswith('hidden_')]
    hidden_count = len(discovered) - len(files)
    if hidden_count:
        print(f'skipped {hidden_count} hidden GeoPackage(s): remove the hidden_ filename prefix to publish them')
    if not files: print('WARNING: no visible .gpkg files in group folders under', a.data)
    if os.path.exists(a.out): shutil.rmtree(a.out)
    shutil.copytree(a.app, a.out)
    os.makedirs(os.path.join(a.out, 'data'), exist_ok=True)
    layers, seen = [], set()
    for path, group_name in files:
        try: con = sqlite3.connect('file:' + path + '?mode=ro', uri=True)
        except Exception as e: print('skip', path, e); continue
        gcols = {r[0]: (r[1], r[2]) for r in con.execute('select table_name,column_name,geometry_type_name from gpkg_geometry_columns')} if con.execute("select 1 from sqlite_master where name='gpkg_geometry_columns'").fetchone() else {}
        for table, dtype, ident, desc, mnx, mny, mxx, mxy in con.execute('select table_name,data_type,identifier,description,min_x,min_y,max_x,max_y from gpkg_contents').fetchall():
            lid = slug(table)
            if lid in seen: lid = slug(os.path.splitext(os.path.basename(path))[0] + '_' + table)
            seen.add(lid)
            cfg = lcfg.get(table, lcfg.get(lid, {}))
            if cfg.get('hidden'): continue
            kindsuf = kind_from_name(table)
            row = {'id': lid, 'table': table, 'source': os.path.relpath(path, a.data).replace('\\', '/'),
                   'group': group_name,
                   'label': cfg.get('label') or label_from_name(table), 'description': desc or ''}
            if dtype != 'attributes':
                row['crossBorder'] = public_metadata(resolve_layer(
                    table, visible=True, kind=dtype, policy=cross_border))
                quality_row = quality_layers.get(table)
                if quality_row:
                    row['quality'] = public_quality(quality_row)
                    row['sourceMetadata'] = public_source_metadata(quality_row)
            try:
                if dtype == 'features':
                    gc, gt = gcols[table]
                    row['kind'] = {'POINT': 'point', 'MULTIPOINT': 'point', 'LINESTRING': 'line', 'MULTILINESTRING': 'line'}.get(gt.upper(), 'polygon')
                    row.update(build_vector(con, table, row, gc, gt.upper(), a.out, cfg))
                elif dtype == 'attributes':
                    row['kind'] = 'table'; row.update(build_table(con, table, row, a.out, cfg))
                elif dtype == '2d-gridded-coverage':
                    row['kind'] = 'raster'; row.update(build_raster(con, table, row, a.out, cfg))
                elif dtype == 'tiles':
                    row['kind'] = 'image'; row.update(build_image(con, table, row, a.out))
                else:
                    print('skip unsupported type', dtype, table); continue
            except Exception as e:
                print(f'!! {table}: {type(e).__name__}: {e}'); continue
            for k in ('visible', 'opacity', 'order'):
                if k in cfg: row[k] = cfg[k]
            layers.append(row)
            print(f'  {row["kind"]:8s} {table}')
        con.close()
    # legend tables are folded into the layers they describe (never published as layers of their own)
    layers = fold_legends(layers, a.out, lcfg)
    gl = config.get('groups', {})
    groups = {}
    for l in layers:
        name = l['group']
        groups.setdefault(name, {'id': name, 'label': name, 'order': gl.get(name, {}).get('order', 100)})
    cat = {'title': config.get('app', {}).get('title', 'Nigeria WebGIS'), 'center': config.get('app', {}).get('center', [8.7, 9.1]),
           'zoom': config.get('app', {}).get('zoom', 5.4), 'basemap': config.get('app', {}).get('basemap', 'light'),
           'crossBorderPolicy': catalog_policy(cross_border),
           'built': time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime()), 'groups': sorted(groups.values(), key=lambda g: (g['order'], g['label'])),
           'layers': sorted(layers, key=lambda l: (l.get('order', 100), l['group'], l['label']))}
    spatial_layers = [layer for layer in layers if layer.get('kind') != 'table']
    if quality_document and spatial_layers and all(layer.get('quality') for layer in spatial_layers):
        cat['layerQualityRegister'] = catalog_summary(quality_document)
    blob = json.dumps(cat, separators=(',', ':'), ensure_ascii=False)
    with open(os.path.join(a.out, 'catalog.json'), 'w', encoding='utf8') as f: f.write(blob)
    # the build id covers the data *and* the app shell, so any change gets fresh URLs
    hsh = hashlib.md5(blob.encode())
    for rel in ('index.html', 'css/app.css', 'js/app.js', 'js/engine.js', 'sw.js', 'manifest.webmanifest'):
        p = os.path.join(a.out, rel)
        if os.path.exists(p): hsh.update(open(p, 'rb').read())
    ver = hsh.hexdigest()[:10]
    sw = os.path.join(a.out, 'sw.js')
    if os.path.exists(sw):
        s = open(sw, encoding='utf8').read().replace('__BUILD__', ver); open(sw, 'w', encoding='utf8').write(s)
    # stamp every shell URL with the build id so a new build can never be mixed with cached files
    idx = os.path.join(a.out, 'index.html')
    if os.path.exists(idx):
        h = open(idx, encoding='utf8').read()
        for before, after in (('href="css/app.css"', f'href="css/app.css?v={ver}"'),
                              ('src="js/app.js"', f'src="js/app.js?v={ver}"'),
                              ('href="manifest.webmanifest"', f'href="manifest.webmanifest?v={ver}"')):
            h = h.replace(before, after)
        h = h.replace('content="dev"', f'content="{ver}"')
        open(idx, 'w', encoding='utf8').write(h)
    app = os.path.join(a.out, 'js', 'app.js')
    if os.path.exists(app):
        t = open(app, encoding='utf8').read().replace("from './engine.js'", f"from './engine.js?v={ver}'")
        open(app, 'w', encoding='utf8').write(t)
    print(f'built {len(layers)} layers from {len(files)} files in {time.time() - t0:.1f}s -> {a.out}/ (version {ver})')


if __name__ == '__main__':
    main()
