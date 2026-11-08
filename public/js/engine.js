// Small dependency-free web map engine: Web-Mercator canvas map with raster overlays, vector layers,
// XYZ basemap tiles, graticule, touch (pan + pinch), hit-testing, value sampling and symbology.
// No libraries, no API keys, works offline.
const TAU = Math.PI * 2;
export const mercY = (lat) => { lat = Math.max(-85.05, Math.min(85.05, lat)); const s = Math.sin(lat * Math.PI / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };
export const mercX = (lon) => (lon + 180) / 360;
export const unX = (x) => x * 360 - 180;
export const unY = (y) => { const n = Math.PI - TAU * y; return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); };

// Basemaps that need no API key. (CARTO's free tiles show an "API KEY REQUIRED" watermark since 2026,
// so they are deliberately not used here.)
export const BASEMAPS = {
  light: { label: 'Light grey', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', sub: 'a', max: 16, bg: '#eef1f3', attr: 'Basemap © Esri, HERE, Garmin, © OpenStreetMap contributors' },
  streets: { label: 'Streets', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', sub: 'a', max: 19, bg: '#e8e4d8', attr: '© OpenStreetMap contributors' },
  dark: { label: 'Dark grey', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', sub: 'a', max: 16, bg: '#1d2024', attr: 'Basemap © Esri, HERE, Garmin, © OpenStreetMap contributors' },
  satellite: { label: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', sub: 'a', max: 18, bg: '#20262a', attr: 'Imagery © Esri, Maxar, Earthstar Geographics' },
  topo: { label: 'Topographic', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', sub: 'abc', max: 16, bg: '#f0ece0', attr: '© OpenStreetMap contributors, SRTM | © OpenTopoMap (CC-BY-SA)' },
  none: { label: 'None', url: null, sub: 'a', bg: '#f3f4f2', attr: '' },
};
export const BASEMAP_ORDER = ['light', 'streets', 'dark', 'satellite', 'topo', 'none'];

// ---------------------------------------------------------------- geometry helpers (lon / lat)
const R_EARTH = 6371.0088;
const rad = Math.PI / 180;

export function haversineKm(a, b) {
  const dLa = (b[1] - a[1]) * rad, dLo = (b[0] - a[0]) * rad;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLo / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function ringAreaKm2(ring) {
  if (!ring || ring.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [l1, p1] = ring[i], [l2, p2] = ring[(i + 1) % ring.length];
    sum += (l2 - l1) * rad * (2 + Math.sin(p1 * rad) + Math.sin(p2 * rad));
  }
  return Math.abs(sum * R_EARTH * R_EARTH / 2);
}
export function ringPerimeterKm(ring) {
  let d = 0;
  for (let i = 1; i < ring.length; i++) d += haversineKm(ring[i - 1], ring[i]);
  if (ring.length > 2) d += haversineKm(ring[ring.length - 1], ring[0]);
  return d;
}
export function lineLengthKm(line) {
  let d = 0;
  for (let i = 1; i < line.length; i++) d += haversineKm(line[i - 1], line[i]);
  return d;
}
export function lonlatRing(arr) { const a = []; for (let i = 0; i < arr.length; i += 2) a.push([unX(arr[i]), unY(arr[i + 1])]); return a; }
export function lonlatPoint(arr) { const a = []; for (let i = 0; i < arr.length; i += 2) a.push([unX(arr[i]), unY(arr[i + 1])]); return a; }

// world-coordinate metrics for one feature (used for ranking, facts panels, stats)
export function featureMetrics(f) {
  if (f._m) return f._m;
  let m;
  if (f.type === 'poly') {
    let area = 0, perim = 0, holes = 0, verts = 0;
    // outer rings add area, holes (GeoJSON winding) subtract it
    for (const poly of f.parts) poly.forEach((ring, i) => {
      const ll = lonlatRing(ring), a = ringAreaKm2(ll);
      perim += ringPerimeterKm(ll); verts += ring.length / 2;
      if (i === 0) area += a; else { holes++; area -= a; }
    });
    m = { area: Math.abs(area), perim, holes, verts };
  } else if (f.type === 'line') {
    let len = 0, verts = 0;
    for (const line of f.parts) { len += lineLengthKm(lonlatRing(line)); verts += line.length / 2; }
    m = { length: len, verts, parts: f.parts.length };
  } else {
    m = { verts: f.parts.length / 2 };
  }
  const [x, y] = labelAnchor(f);
  m.center = [unX(x), unY(y)];
  f._m = m;
  return m;
}

function polyCentroid(ring) { // ring: flat world coords -> [x,y] area centroid
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const x0 = ring[j], y0 = ring[j + 1], x1 = ring[i], y1 = ring[i + 1];
    const c = x0 * y1 - x1 * y0;
    a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
  }
  if (Math.abs(a) < 1e-14) { const [x0, y0, x1, y1] = f_bbox(ring); return [(x0 + x1) / 2, (y0 + y1) / 2]; }
  return [cx / (3 * a), cy / (3 * a)];
}
function f_bbox(a) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let i = 0; i < a.length; i += 2) { const x = a[i], y = a[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; }

export function labelAnchor(f) {
  if (f._a) return f._a;
  let p;
  if (f.type === 'point') p = [f.parts[0], f.parts[1]];
  else if (f.type === 'line') { const line = f.parts[0] || []; const n = line.length / 2; p = n ? [line[(Math.floor(n / 2) * 2)], line[(Math.floor(n / 2) * 2) + 1]] : [f.bb[0], f.bb[1]]; }
  else {
    const poly = f.parts[0] || []; const outer = poly[0];
    p = outer && outer.length >= 6 ? polyCentroid(outer) : [(f.bb[0] + f.bb[2]) / 2, (f.bb[1] + f.bb[3]) / 2];
  }
  f._a = p; return p;
}

export class GeoMap {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.cx = mercX(8.7); this.cy = mercY(9.1); this.zoom = 5.4;
    this.layers = []; this.selection = null; this.extra = []; // extra: transient overlays (measure, location, labels)
    this.extraTop = [];                                        // drawn above everything, incl. grid labels
    this.basemap = 'light'; this.tiles = new Map(); this.minZoom = 2; this.maxZoom = 19;
    this.grid = { on: false, step: null };
    this.overlay = null;         // transient drawing preview (focus-area capture)
    this.clip = null;            // focus area: {type:'rect', wb:[]} | {type:'poly', rings:[[x,y,...]]} | {type:'circle', c:[x,y], r}
    this.listeners = { view: [], click: [], hover: [], layers: [], tileerror: [] };
    this._raf = 0; this._moving = false; this.tileErrors = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this._bind(); this.resize();
    new ResizeObserver(() => this.resize()).observe(document.documentElement);
  }
  on(ev, fn) { (this.listeners[ev] || (this.listeners[ev] = [])).push(fn); }
  off(ev, fn) { const a = this.listeners[ev]; if (!a) return; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }
  _emit(ev, ...a) { for (const f of this.listeners[ev] || []) f(...a); }
  get S() { return 256 * Math.pow(2, this.zoom); }
  resize() {
    const w = window.innerWidth, h = window.innerHeight; this.W = w; this.H = h;
    this.cv.width = Math.round(w * this.dpr); this.cv.height = Math.round(h * this.dpr);
    this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
    this.render();
  }
  // ---- view
  center() { return [unX(this.cx), unY(this.cy)]; }
  setView(lon, lat, zoom) {
    if (zoom != null) this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    this.cx = mercX(lon); this.cy = Math.max(0.0005, Math.min(0.9995, mercY(lat))); this._viewChanged();
  }
  fitBounds(b, pad = 40, bottomPad = 0) {
    const [w, s, e, n] = b; const x0 = mercX(w), x1 = mercX(e), y0 = mercY(n), y1 = mercY(s);
    const availW = Math.max(60, this.W - pad * 2), availH = Math.max(60, this.H - pad * 2 - bottomPad);
    const z = Math.log2(Math.min(availW / Math.max(1e-9, x1 - x0), availH / Math.max(1e-9, y1 - y0)) / 256);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom - 1, z));
    this.cx = (x0 + x1) / 2; this.cy = (y0 + y1) / 2 + (bottomPad / 2) / this.S; this._viewChanged();
  }
  _viewChanged() { this.render(); this._emit('view'); }
  toScreen(wx, wy) { const S = this.S; return [(wx - this.cx) * S + this.W / 2, (wy - this.cy) * S + this.H / 2]; }
  fromScreen(px, py) { const S = this.S; return [this.cx + (px - this.W / 2) / S, this.cy + (py - this.H / 2) / S]; }
  lonlatAt(px, py) { const [wx, wy] = this.fromScreen(px, py); return [unX(wx), unY(wy)]; }
  screenOf(lon, lat) { return this.toScreen(mercX(lon), mercY(lat)); }
  zoomAt(px, py, dz) {
    const [wx, wy] = this.fromScreen(px, py); const nz = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom + dz));
    if (nz === this.zoom) return; this.zoom = nz; const S = this.S;
    this.cx = wx - (px - this.W / 2) / S; this.cy = wy - (py - this.H / 2) / S; this._viewChanged();
  }
  zoomToFeature(f, pad = 60) {
    const [x0, y0, x1, y1] = f.bb;
    if (x1 - x0 < 1e-6 && y1 - y0 < 1e-6) { this.setView(unX(x0), unY(y0), Math.max(this.zoom, 12)); return; }
    this.fitBounds([unX(x0), unY(y1), unX(x1), unY(y0)], pad);
  }
  // ---- layers
  addLayer(l) { this.layers.push(l); this._sort(); this.render(); this._emit('layers'); return l; }
  removeLayer(id) { this.layers = this.layers.filter(l => l.id !== id); this.render(); }
  getLayer(id) { return this.layers.find(l => l.id === id); }
  _sort() {
    const rank = { raster: 0, image: 0, polygon: 10, line: 11, point: 12 };
    this.layers.sort((a, b) => {
      if (a.z != null && b.z != null) return a.z - b.z;
      if (a.z != null) return 1;
      if (b.z != null) return -1;
      return (rank[a.kind] - rank[b.kind]) || ((a.order ?? 0) - (b.order ?? 0));
    });
  }
  setZ(id, z) { const l = this.getLayer(id); if (l) { l.z = z; this._sort(); this.render(); } }
  drawOrder() { return this.layers.filter(l => l.visible); }
  setBasemap(k) { this.basemap = k; this.tileErrors = 0; this.render(); }
  setGrid(on) { this.grid.on = !!on; this.render(); }
  // ---- rendering
  render() { if (this._raf) return; this._raf = requestAnimationFrame(() => { this._raf = 0; this._draw(); }); }
  _draw() {
    const ctx = this.ctx, d = this.dpr; ctx.setTransform(d, 0, 0, d, 0, 0);
    const bm = BASEMAPS[this.basemap] || BASEMAPS.none;
    ctx.fillStyle = bm.bg; ctx.fillRect(0, 0, this.W, this.H);
    ctx.globalAlpha = 1;
    if (bm.url) this._drawTiles(bm);
    if (this.grid.on) this._drawGridLines();
    const tol = this._moving ? 1.6 : 0.7;
    if (this.clip) { ctx.save(); this._clipPath(ctx); ctx.clip('evenodd'); }
    for (const l of this.layers) {
      if (!l.visible || l.opacity <= 0) continue;
      ctx.globalAlpha = 1;
      if (l.kind === 'raster' || l.kind === 'image') { ctx.globalAlpha = l.opacity; this._drawImage(l); ctx.globalAlpha = 1; }
      else this._drawVector(l, tol);
    }
    ctx.globalAlpha = 1;
    if (this.selection) this._drawSelection(this.selection);
    if (this.clip) { ctx.restore(); this._drawClipFocus(); }
    if (this.overlay) this.overlay(ctx, this);
    if (this.grid.on) this._drawGridLabels();
    for (const e of this.extra) e(ctx, this);
    for (const e of this.extraTop) e(ctx, this);
  }
  // ---- focus / clip area
  setClip(clip) {
    if (clip && clip.type === 'poly') {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const ring of clip.rings) for (let i = 0; i < ring.length; i += 2) {
        if (ring[i] < x0) x0 = ring[i]; if (ring[i] > x1) x1 = ring[i];
        if (ring[i + 1] < y0) y0 = ring[i + 1]; if (ring[i + 1] > y1) y1 = ring[i + 1];
      }
      clip._bb = [x0, y0, x1, y1];
    }
    this.clip = clip || null;
    this.render();
  }
  _appendClip(ctx) {
    const c = this.clip; if (!c) return false;
    if (c.type === 'rect') {
      const [x0, y0] = this.toScreen(c.wb[0], c.wb[1]), [x1, y1] = this.toScreen(c.wb[2], c.wb[3]);
      ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    } else if (c.type === 'poly') {
      for (const ring of c.rings) {
        for (let i = 0; i < ring.length; i += 2) {
          const [x, y] = this.toScreen(ring[i], ring[i + 1]);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath();
      }
    }
    return true;
  }
  _clipPath(ctx) { ctx.beginPath(); this._appendClip(ctx); }
  containsClip(wx, wy) {
    const c = this.clip; if (!c) return true;
    if (c.type === 'rect') return wx >= Math.min(c.wb[0], c.wb[2]) && wx <= Math.max(c.wb[0], c.wb[2]) && wy >= Math.min(c.wb[1], c.wb[3]) && wy <= Math.max(c.wb[1], c.wb[3]);
    if (c.type === 'poly') {
      let bb = c._bb;
      if (!bb) {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const ring of c.rings) for (let i = 0; i < ring.length; i += 2) {
          if (ring[i] < x0) x0 = ring[i]; if (ring[i] > x1) x1 = ring[i];
          if (ring[i + 1] < y0) y0 = ring[i + 1]; if (ring[i + 1] > y1) y1 = ring[i + 1];
        }
        bb = c._bb = [x0, y0, x1, y1];
      }
      if (wx < bb[0] || wx > bb[2] || wy < bb[1] || wy > bb[3]) return false;
      let hits = 0;
      for (const ring of c.rings) if (pip(wx, wy, [ring])) hits++;
      return hits % 2 === 1;   // even-odd: rings inside rings behave like holes
    }
    return true;
  }
  clipBounds() {
    const c = this.clip; if (!c) return null;
    if (c.type === 'rect') return [unX(Math.min(c.wb[0], c.wb[2])), unY(Math.max(c.wb[1], c.wb[3])), unX(Math.max(c.wb[0], c.wb[2])), unY(Math.min(c.wb[1], c.wb[3]))];
    if (c.type === 'poly') {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const ring of c.rings) for (let i = 0; i < ring.length; i += 2) {
        if (ring[i] < x0) x0 = ring[i]; if (ring[i] > x1) x1 = ring[i];
        if (ring[i + 1] < y0) y0 = ring[i + 1]; if (ring[i + 1] > y1) y1 = ring[i + 1];
      }
      return [unX(x0), unY(y1), unX(x1), unY(y0)];
    }
    return null;
  }
  _drawClipFocus() {
    const ctx = this.ctx; if (!this.clip) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, this.W, this.H); this._appendClip(ctx);
    ctx.fillStyle = this.basemap === 'dark' ? 'rgba(0,0,0,.55)' : 'rgba(250,250,248,.62)';
    ctx.fill('evenodd');
    ctx.beginPath(); this._appendClip(ctx);
    ctx.setLineDash([7, 5]); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(11,107,69,.95)';
    ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
  _drawTiles(bm) {
    const ctx = this.ctx; const z = Math.max(0, Math.min(bm.max, Math.round(this.zoom))); const n = 1 << z;
    const size = this.S / n; const [wx0, wy0] = this.fromScreen(0, 0), [wx1, wy1] = this.fromScreen(this.W, this.H);
    const x0 = Math.floor(wx0 * n), x1 = Math.floor(wx1 * n), y0 = Math.max(0, Math.floor(wy0 * n)), y1 = Math.min(n - 1, Math.floor(wy1 * n));
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 120) return;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const xm = ((x % n) + n) % n; const key = bm.url + z + '/' + xm + '/' + y; let t = this.tiles.get(key);
      if (!t) {
        t = { img: new Image(), ok: false, err: false }; t.img.crossOrigin = 'anonymous';
        t.img.onload = () => { t.ok = true; this.render(); };
        t.img.onerror = () => { t.err = true; this.tileErrors++; this._emit('tileerror', this.tileErrors); };
        t.img.src = bm.url.replace('{s}', bm.sub[(xm + y) % bm.sub.length]).replace('{z}', z).replace('{x}', xm).replace('{y}', y);
        this.tiles.set(key, t);
        if (this.tiles.size > 500) { const k = this.tiles.keys().next().value; this.tiles.delete(k); }
      }
      if (t.ok) { const [sx, sy] = this.toScreen(x / n, y / n); ctx.drawImage(t.img, Math.floor(sx), Math.floor(sy), Math.ceil(size) + 1, Math.ceil(size) + 1); }
    }
  }
  _drawImage(l) {
    if (!l.img || !l.img.complete || !l.img.naturalWidth) return;
    const [x0, y0] = this.toScreen(l.wb[0], l.wb[1]), [x1, y1] = this.toScreen(l.wb[2], l.wb[3]);
    if (x1 < 0 || y1 < 0 || x0 > this.W || y0 > this.H) return;
    this.ctx.imageSmoothingEnabled = !l.categorical; this.ctx.drawImage(l.img, x0, y0, x1 - x0, y1 - y0);
  }
  _vis(f) { // bbox culling
    const [x0, y0] = this.toScreen(f.bb[0], f.bb[1]), [x1, y1] = this.toScreen(f.bb[2], f.bb[3]);
    return !(x1 < -20 || x0 > this.W + 20 || y1 < -20 || y0 > this.H + 20) ? [x0, y0, x1, y1] : null;
  }
  _dash(ctx, sym) {
    const w = Math.max(0.5, sym.strokeWidth ?? 1);
    if (sym.dash === 'dashed') ctx.setLineDash([w * 4, w * 3]);
    else if (sym.dash === 'dotted') ctx.setLineDash([w * 0.1, w * 2.4]);
    else ctx.setLineDash([]);
  }
  _drawVector(l, tol) {
    const ctx = this.ctx, S = this.S, hw = this.W / 2, hh = this.H / 2, cx = this.cx, cy = this.cy;
    const sym = l.sym || {};
    const labels = [];
    if (l.kind === 'polygon') {
      const fillA = sym.fillOpacity ?? l.fillAlpha ?? 0.72;
      const strokeW = sym.strokeWidth ?? 0.6;
      ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(0.3, strokeW);
      this._dash(ctx, sym);
      for (const f of l.features) {
        if (f.hidden) continue;
        const b = this._vis(f); if (!b) continue; if (b[2] - b[0] < 0.4 && b[3] - b[1] < 0.4) continue;
        ctx.beginPath();
        for (const poly of f.parts) for (const r of poly) {
          let lx = 1e9, ly = 1e9; const n = r.length;
          for (let i = 0; i < n; i += 2) {
            const x = (r[i] - cx) * S + hw, y = (r[i + 1] - cy) * S + hh;
            if (i === 0) { ctx.moveTo(x, y); lx = x; ly = y; continue; }
            if (i < n - 2 && Math.abs(x - lx) + Math.abs(y - ly) < tol) continue;
            ctx.lineTo(x, y); lx = x; ly = y;
          }
          ctx.closePath();
        }
        const fill = sym.fillMode === 'single' && sym.fill ? sym.fill : f.fill;
        if (fillA > 0) { ctx.globalAlpha = l.opacity * fillA; ctx.fillStyle = fill; ctx.fill('evenodd'); }
        if (strokeW > 0) { ctx.globalAlpha = l.opacity * (sym.strokeOpacity ?? 0.75); ctx.strokeStyle = sym.stroke || 'rgba(30,30,30,.7)'; ctx.stroke(); }
        if (l.labels && l.labels.on !== false) labels.push(f);
      }
      ctx.setLineDash([]);
    } else if (l.kind === 'line') {
      const w = sym.strokeWidth ?? l.width ?? 1.3;
      ctx.lineWidth = Math.max(0.3, w); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      this._dash(ctx, sym);
      const groups = new Map();
      for (const f of l.features) {
        if (f.hidden) continue;
        const b = this._vis(f); if (!b) continue; if (b[2] - b[0] < 0.5 && b[3] - b[1] < 0.5) continue;
        const col = (sym.fillMode === 'single' && sym.stroke) ? sym.stroke : f.stroke;
        let g = groups.get(col); if (!g) groups.set(col, g = []); g.push(f);
        if (l.labels && l.labels.on !== false) labels.push(f);
      }
      ctx.globalAlpha = l.opacity;
      for (const [col, fs] of groups) {
        ctx.beginPath(); ctx.strokeStyle = col;
        for (const f of fs) for (const line of f.parts) {
          let lx = 1e9, ly = 1e9; const n = line.length;
          for (let i = 0; i < n; i += 2) {
            const x = (line[i] - cx) * S + hw, y = (line[i + 1] - cy) * S + hh;
            if (i === 0) { ctx.moveTo(x, y); lx = x; ly = y; continue; }
            if (i < n - 2 && Math.abs(x - lx) + Math.abs(y - ly) < tol) continue;
            ctx.lineTo(x, y); lx = x; ly = y;
          }
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
    } else if (l.kind === 'point') {
      const total = l.features.length;
      const many = total > 4000 && this.zoom < 8;
      const base = sym.pointSize ?? Math.max(2.6, Math.min(5.5, 1.6 + (this.zoom - 5) * 0.5));
      const r = many ? Math.min(base, 1.8) : base;
      const strokeW = sym.strokeWidth ?? 1;
      ctx.lineWidth = Math.max(0, strokeW);
      ctx.strokeStyle = sym.stroke && sym.stroke !== 'auto' ? sym.stroke : 'rgba(255,255,255,.95)';
      ctx.fillStyle = '#888'; ctx.globalAlpha = l.opacity;
      const shape = sym.pointShape || 'circle';
      for (const f of l.features) {
        if (f.hidden) continue;
        const pts = f.parts; const col = (sym.fillMode === 'single' && sym.fill) ? sym.fill : f.fill;
        for (let i = 0; i < pts.length; i += 2) {
          const x = (pts[i] - cx) * S + hw, y = (pts[i + 1] - cy) * S + hh;
          if (x < -14 || y < -14 || x > this.W + 14 || y > this.H + 14) continue;
          ctx.fillStyle = col;
          this._shape(ctx, shape, x, y, r, many && shape === 'circle');
        }
        if (l.labels && l.labels.on !== false) labels.push(f);
      }
    }
    if (labels.length) this._drawFeatureLabels(l, labels);
  }
  _shape(ctx, shape, x, y, r, square) {
    if (square || shape === 'square') { ctx.fillRect(x - r, y - r, r * 2, r * 2); return; }
    ctx.beginPath();
    if (shape === 'triangle') { ctx.moveTo(x, y - r * 1.2); ctx.lineTo(x + r * 1.1, y + r * 0.9); ctx.lineTo(x - r * 1.1, y + r * 0.9); ctx.closePath(); }
    else if (shape === 'diamond') { ctx.moveTo(x, y - r * 1.25); ctx.lineTo(x + r * 1.1, y); ctx.lineTo(x, y + r * 1.25); ctx.lineTo(x - r * 1.1, y); ctx.closePath(); }
    else if (shape === 'star') {
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r * 1.25; const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath();
    } else if (shape === 'cross') { ctx.rect(x - r * 0.35, y - r, r * 0.7, r * 2); ctx.rect(x - r, y - r * 0.35, r * 2, r * 0.7); }
    else ctx.arc(x, y, r, 0, TAU);
    ctx.fill(); if (ctx.lineWidth > 0) ctx.stroke();
  }
  _drawFeatureLabels(l, features) {
    const cfg = l.labels || {};
    if (cfg.field == null) return;
    const size = cfg.size || 11, bold = cfg.bold !== false, italic = !!cfg.italic;
    const ctx = this.ctx;
    ctx.font = `${italic ? 'italic ' : ''}${bold ? '600 ' : ''}${size}px system-ui,-apple-system,sans-serif`;
    ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, size * 0.34);
    const dark = this.basemap === 'dark';
    const color = cfg.color || (dark ? '#ffffff' : '#16201b');
    const halo = cfg.halo === false ? null : (cfg.haloColor || (dark ? '#000000' : '#ffffff'));
    const minZ = cfg.minZoom ?? 8;
    if (this.zoom < minZ) return;
    const lim = cfg.max ?? (this.zoom >= 12 ? 1200 : 350);
    const taken = new Set();
    const off = cfg.offset || 0;
    let n = 0;
    ctx.globalAlpha = 1;
    for (const f of features) {
      if (n >= lim) break;
      const v = f.props[cfg.field];
      if (v == null || v === '') continue;
      const text = String(v);
      const [wx, wy] = labelAnchor(f);
      const [x, y] = this.toScreen(wx, wy);
      if (x < -60 || y < -20 || x > this.W + 60 || y > this.H + 20) continue;
      const w = ctx.measureText(text).width;
      if (cfg.onlyLarge !== false && f.type === 'poly') {
        const [x0, y0] = this.toScreen(f.bb[0], f.bb[1]);
        const [x1, y1] = this.toScreen(f.bb[2], f.bb[3]);
        if (Math.abs(x1 - x0) < w + 8 || Math.abs(y1 - y0) < size + 6) continue;
      }
      const k = Math.floor((x - w / 2) / (w + 6)) + ':' + Math.floor((y + off) / (size + 3));
      if (taken.has(k)) continue; taken.add(k);
      if (halo) { ctx.strokeStyle = halo; ctx.strokeText(text, x - w / 2, y + off); }
      ctx.fillStyle = color; ctx.fillText(text, x - w / 2, y + off);
      n++;
    }
  }
  _gridStep() {
    const target = 110;                                  // px between graticule lines
    const degPerPx = 360 / (256 * Math.pow(2, this.zoom));
    const want = degPerPx * target;
    const steps = [45, 30, 20, 10, 5, 2, 1, 0.5, 0.25, 0.1, 0.05, 0.02, 0.01, 0.005];
    return steps.find((s) => s <= want) || steps[steps.length - 1];
  }
  _gridLines() {
    const step = this.grid.step || this._gridStep();
    const [w, s, e, n] = [unX(this.fromScreen(0, this.H)[0]), unY(this.fromScreen(0, this.H)[1]), unX(this.fromScreen(this.W, 0)[0]), unY(this.fromScreen(this.W, 0)[1])];
    const lons = [], lats = [];
    for (let lo = Math.ceil(w / step) * step; lo <= e; lo += step) lons.push(+lo.toFixed(6));
    for (let la = Math.floor(s / step) * step; la <= n; la += step) lats.push(+la.toFixed(6));
    return { lons, lats, step };
  }
  _drawGridLines() {
    const ctx = this.ctx, g = this._gridLines();
    ctx.save(); ctx.globalAlpha = 1; ctx.strokeStyle = this.basemap === 'dark' ? 'rgba(255,255,255,.28)' : 'rgba(20,30,40,.28)';
    ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath();
    for (const lo of g.lons) { const [x] = this.screenOf(lo, 0); const xx = Math.round(x) + 0.5; ctx.moveTo(xx, 0); ctx.lineTo(xx, this.H); }
    for (const la of g.lats) { const [, y] = this.screenOf(0, la); const yy = Math.round(y) + 0.5; ctx.moveTo(0, yy); ctx.lineTo(this.W, yy); }
    ctx.stroke(); ctx.restore();
  }
  _drawGridLabels() {
    const ctx = this.ctx, g = this._gridLines();
    ctx.save(); ctx.font = '600 10px system-ui,sans-serif'; ctx.textBaseline = 'top';
    const bg = this.basemap === 'dark' ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.8)';
    const fg = this.basemap === 'dark' ? '#fff' : '#16201b';
    const fmt = (v, pos, neg) => `${Math.abs(v).toFixed(g.step < 0.1 ? 2 : g.step < 1 ? 1 : 0)}°${v >= 0 ? pos : neg}`;
    for (const lo of g.lons) {
      const [x] = this.screenOf(lo, 0); if (x < 24 || x > this.W - 24) continue;
      const t = fmt(lo, 'E', 'W'); const w = ctx.measureText(t).width;
      ctx.fillStyle = bg; ctx.fillRect(x - w / 2 - 2, 2, w + 4, 13);
      ctx.fillStyle = fg; ctx.fillText(t, x - w / 2, 3);
    }
    for (const la of g.lats) {
      const [, y] = this.screenOf(0, la); if (y < 18 || y > this.H - 18) continue;
      const t = fmt(la, 'N', 'S'); const w = ctx.measureText(t).width;
      ctx.fillStyle = bg; ctx.fillRect(2, y - 7, w + 4, 13);
      ctx.fillStyle = fg; ctx.fillText(t, 4, y - 6);
    }
    ctx.restore();
  }
  _drawSelection(sel) {
    const ctx = this.ctx, S = this.S, hw = this.W / 2, hh = this.H / 2, f = sel.feature, cx = this.cx, cy = this.cy;
    if (!f) return;
    ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = '#ffd400'; ctx.fillStyle = 'rgba(255,212,0,.25)'; ctx.globalAlpha = 1; ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    if (f.type === 'point') {
      for (let i = 0; i < f.parts.length; i += 2) { const x = (f.parts[i] - cx) * S + hw, y = (f.parts[i + 1] - cy) * S + hh; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill(); ctx.stroke(); }
    } else {
      ctx.beginPath();
      const rings = f.type === 'poly' ? f.parts.flat() : f.parts;
      for (const r of rings) for (let i = 0; i < r.length; i += 2) { const x = (r[i] - cx) * S + hw, y = (r[i + 1] - cy) * S + hh; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      if (f.type === 'poly') ctx.fill('evenodd'); ctx.stroke();
    }
    ctx.restore();
  }
  // ---- hit testing & sampling
  identify(px, py) {
    const [wx, wy] = this.fromScreen(px, py), S = this.S, out = [];
    if (!this.containsClip(wx, wy)) return out;
    for (const l of [...this.layers].reverse()) {
      if (!l.visible || l.opacity <= 0) continue;
      if (l.kind === 'raster' || l.kind === 'image') {
        if (wx >= l.wb[0] && wx <= l.wb[2] && wy >= l.wb[1] && wy <= l.wb[3]) {
          if (l.kind === 'raster') { const v = this.sampleRaster(l, wx, wy); if (v != null) out.push({ layer: l, value: v }); }
          else out.push({ layer: l });
        }
        continue;
      }
      const tolW = 10 / S;
      for (const f of l.features) {
        if (f.hidden) continue;
        if (wx < f.bb[0] - tolW || wx > f.bb[2] + tolW || wy < f.bb[1] - tolW || wy > f.bb[3] + tolW) continue;
        if (l.kind === 'polygon') { for (const poly of f.parts) if (pip(wx, wy, poly)) { out.push({ layer: l, feature: f }); break; } }
        else if (l.kind === 'line') { let best = 1e9; for (const ln of f.parts) best = Math.min(best, distLine(wx, wy, ln)); if (best * S <= 9) out.push({ layer: l, feature: f, dist: best * S }); }
        else { let best = 1e9; for (let i = 0; i < f.parts.length; i += 2) best = Math.min(best, Math.hypot(wx - f.parts[i], wy - f.parts[i + 1])); if (best * S <= 12) out.push({ layer: l, feature: f, dist: best * S }); }
      }
    }
    return out;
  }
  sampleRaster(l, wx, wy) {
    const v = l.vals; if (!v || !v.data) return null;
    const fx = (wx - l.wb[0]) / (l.wb[2] - l.wb[0]), fy = (wy - l.wb[1]) / (l.wb[3] - l.wb[1]);
    const ix = Math.floor(fx * v.w), iy = Math.floor(fy * v.h); if (ix < 0 || iy < 0 || ix >= v.w || iy >= v.h) return null;
    const x = v.data[iy * v.w + ix]; if (v.dtype === 'i2' ? x === -32768 : (!isFinite(x) || x === l.nodata)) return null; return x;
  }
  // ---- interaction
  _bind() {
    const cv = this.cv, P = new Map(); let tapT = 0, tapX = 0, tapY = 0, lastTap = 0, lastTapX = 0, lastTapY = 0, moved = 0, pinch = null;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId); P.set(e.pointerId, pos(e)); this._moving = true;
      if (P.size === 1) { tapT = performance.now(); [tapX, tapY] = pos(e); moved = 0; }
      if (P.size === 2) { const [a, b] = [...P.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 }; moved = 99; }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!P.has(e.pointerId)) { this._emit('hover', ...pos(e)); return; }
      const p = pos(e), old = P.get(e.pointerId); P.set(e.pointerId, p);
      if (P.size === 1) { moved += Math.abs(p[0] - old[0]) + Math.abs(p[1] - old[1]); if (moved > 3) { this.cx -= (p[0] - old[0]) / this.S; this.cy -= (p[1] - old[1]) / this.S; this.cy = Math.max(0.0005, Math.min(0.9995, this.cy)); this._viewChanged(); } }
      else if (P.size === 2 && pinch) {
        const [a, b] = [...P.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        this.cx -= (mx - pinch.mx) / this.S; this.cy -= (my - pinch.my) / this.S;
        if (pinch.d > 0 && d > 0) this.zoomAt(mx, my, Math.log2(d / pinch.d)); else this._viewChanged();
        pinch = { d, mx, my };
      }
    });
    const up = (e) => {
      if (!P.has(e.pointerId)) return; const wasOne = P.size === 1; P.delete(e.pointerId); if (P.size < 2) pinch = null;
      if (P.size === 0) { this._moving = false; this.render(); }
      if (wasOne && e.type === 'pointerup' && moved <= 6 && performance.now() - tapT < 450) {
        const now = performance.now();
        if (now - lastTap < 320 && Math.hypot(tapX - lastTapX, tapY - lastTapY) < 30) { this.zoomAt(tapX, tapY, 1); lastTap = 0; }
        else { lastTap = now; lastTapX = tapX; lastTapY = tapY; setTimeout(() => { if (lastTap === now) this._emit('click', tapX, tapY); }, 300); }
      }
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = pos(e); this._moving = true; this.zoomAt(x, y, -e.deltaY * (e.ctrlKey ? 0.01 : 0.0022)); clearTimeout(this._wt); this._wt = setTimeout(() => { this._moving = false; this.render(); }, 160); }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === '+' || e.key === '=') this.zoomAt(this.W / 2, this.H / 2, 1);
      if (e.key === '-' || e.key === '_') this.zoomAt(this.W / 2, this.H / 2, -1);
    });
  }
}

// ---- geometry conversion from GeoJSON to flat world-coordinate arrays
const flat = (coords) => { const a = new Float64Array(coords.length * 2); for (let i = 0; i < coords.length; i++) { a[i * 2] = mercX(coords[i][0]); a[i * 2 + 1] = mercY(coords[i][1]); } return a; };
function bboxOf(arrs) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const a of arrs) for (let i = 0; i < a.length; i += 2) { const x = a[i], y = a[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; }
export function convertFeature(f) {
  const g = f.geometry; if (!g) return null; const props = f.properties || {};
  const gs = g.type === 'GeometryCollection' ? g.geometries : [g]; let type = null, parts = [];
  for (const s of gs) {
    if (s.type === 'Point') { type = 'point'; parts.push(...[mercX(s.coordinates[0]), mercY(s.coordinates[1])]); }
    else if (s.type === 'MultiPoint') { type = 'point'; for (const c of s.coordinates) parts.push(mercX(c[0]), mercY(c[1])); }
    else if (s.type === 'LineString') { type = 'line'; parts.push(flat(s.coordinates)); }
    else if (s.type === 'MultiLineString') { type = 'line'; for (const l of s.coordinates) parts.push(flat(l)); }
    else if (s.type === 'Polygon') { type = 'poly'; parts.push(s.coordinates.map(flat)); }
    else if (s.type === 'MultiPolygon') { type = 'poly'; for (const p of s.coordinates) parts.push(p.map(flat)); }
  }
  if (!type || !parts.length) return null;
  const bb = type === 'point' ? bboxOf([Float64Array.from(parts)]) : type === 'line' ? bboxOf(parts) : bboxOf(parts.flat());
  return { props, type, parts: type === 'point' ? Float64Array.from(parts) : parts, bb };
}
export function prepareFeature(f, style, idx) {
  const c = convertFeature(f);
  if (!c) return null;
  let col = '#7a7a7a';
  if (style) {
    if (style.mode === 'color-field') {
      const value = c.props[style.field];
      col = typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : style.color;
    } else if (style.mode === 'category') col = style.colors[c.props[style.field]] || '#9aa0a6';
    else col = style.color || col;
  }
  c.fill = col; c.stroke = col; c.fill0 = col; c.idx = idx;
  return c;
}

export function pointInFeature(x, y, f) {
  if (!f) return false;
  if (x < f.bb[0] || x > f.bb[2] || y < f.bb[1] || y > f.bb[3]) return false;
  if (f.type === 'poly') { for (const poly of f.parts) if (pip(x, y, poly)) return true; return false; }
  if (f.type === 'point') { for (let i = 0; i < f.parts.length; i += 2) if (Math.hypot(x - f.parts[i], y - f.parts[i + 1]) < 0.0004) return true; return false; }
  if (f.type === 'line') return false;
  return false;
}
function pip(x, y, rings) {
  let inside = false;
  for (const r of rings) { for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) { const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } }
  return inside;
}
function distLine(x, y, a) {
  let best = 1e9;
  for (let i = 0; i < a.length - 2; i += 2) {
    const x1 = a[i], y1 = a[i + 1], dx = a[i + 2] - x1, dy = a[i + 3] - y1, L = dx * dx + dy * dy; let t = L ? ((x - x1) * dx + (y - y1) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)); if (d < best) best = d;
  }
  return best;
}
