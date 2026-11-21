// Small dependency-free web map engine: Web-Mercator canvas map with raster overlays, vector layers,
// XYZ basemap tiles, graticule, touch (pan + pinch), hit-testing, value sampling and symbology.
// No libraries, no API keys, works offline.
const TAU = Math.PI * 2;
export const DEFAULT_VECTOR_COLOR = '#7a7a7a';
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
    this.selectionSet = [];     // [{ layer: {id}, feature }] — many features at once
    this.panLock = false;       // true while box-selecting, so a drag draws a box instead of panning
    this.extraTop = [];                                        // drawn above everything, incl. grid labels
    this.basemap = 'light'; this.tiles = new Map(); this.minZoom = 2; this.maxZoom = 19;
    this.grid = { on: false, step: null };
    this.rotation = 0; // degrees, clockwise
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
  // Screen pixel position of a lon/lat, honouring map rotation (inverse of canvas rotation).
  screenOf(lon, lat) {
    const [x, y] = this.toScreen(mercX(lon), mercY(lat));
    if (!this.rotation) return [x, y];
    const cx = this.W / 2, cy = this.H / 2, a = this.rotation * Math.PI / 180;
    const dx = x - cx, dy = y - cy;
    return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
  }
  // Screen pixel position adjusted for map rotation (inverse of canvas rotation)
  rotPos(px, py) {
    if (!this.rotation) return [px, py];
    const cx = this.W / 2, cy = this.H / 2;
    const dx = px - cx, dy = py - cy;
    const angle = (this.rotation * Math.PI) / 180;
    const x = dx * Math.cos(angle) + dy * Math.sin(angle);
    const y = -dx * Math.sin(angle) + dy * Math.cos(angle);
    return [cx + x, cy + y];
  }
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
  setRotation(deg) { this.rotation = ((deg % 360) + 360) % 360; this.render(); }
  // ---- rendering
  render() { if (this._raf) return; this._raf = requestAnimationFrame(() => { this._raf = 0; this._draw(); }); }
  _draw() {
    const ctx = this.ctx, d = this.dpr; ctx.setTransform(d, 0, 0, d, 0, 0);
    const bm = BASEMAPS[this.basemap] || BASEMAPS.none;
    // Apply map rotation around canvas center
    if (this.rotation) {
      ctx.translate(this.W / 2, this.H / 2);
      ctx.rotate((this.rotation * Math.PI) / 180);
      ctx.translate(-this.W / 2, -this.H / 2);
    }
    ctx.fillStyle = bm.bg; ctx.fillRect(0, 0, this.W, this.H);
    ctx.globalAlpha = 1;
    if (bm.url) this._drawTiles(bm);
    if (this.grid.on) this._drawGridLines();
    const tol = this._moving ? 1.6 : 0.7;
    if (this.clip) { ctx.save(); this._clipPath(ctx); ctx.clip('nonzero'); }
    for (const l of this.layers) {
      if (!l.visible || l.opacity <= 0) continue;
      ctx.globalAlpha = 1;
      if (l.kind === 'raster' || l.kind === 'image') { ctx.globalAlpha = l.opacity; this._drawImage(l); ctx.globalAlpha = 1; }
      else this._drawVector(l, tol);
    }
    ctx.globalAlpha = 1;
    if (this.selectionSet && this.selectionSet.length) this._drawSelectionSet(this.selectionSet);
    if (this.selection) this._drawSelection(this.selection);
    if (this.clip) { ctx.restore(); this._drawClipFocus(); }
    if (this.overlay) this.overlay(ctx, this);
    if (this.grid.on) this._drawGridLabels();
    for (const e of this.extra) e(ctx, this);
    for (const e of this.extraTop) e(ctx, this);
  }
  // ---- focus / clip area
  setClip(clip) {
    const normalized = normalizeClip(clip);
    if (normalized) {
      this.clip = normalized;
      this.buildClipIndex();
    } else {
      this.clip = null;
    }
    this.render();
  }
  buildClipIndex() {
    const c = this.clip; if (!c || !c.polys) return null;
    const cells = 64;
    const [x0, y0, x1, y1] = c.bb;
    const w = x1 - x0, h = y1 - y0;
    const index = new Uint8Array(cells * cells); // 0=OUTSIDE, 1=INSIDE, 2=BOUNDARY
    const allRings = c._allRings;
    for (let cy = 0; cy < cells; cy++) {
      for (let cx = 0; cx < cells; cx++) {
        const px = x0 + (cx + 0.5) / cells * w;
        const py = y0 + (cy + 0.5) / cells * h;
        if (!pip2(px, py, allRings)) { index[cy * cells + cx] = 0; continue; }
        // Sample corners to detect boundary cells
        let cornerIn = null, boundary = false;
        for (let dx = 0; dx <= 1 && !boundary; dx++) {
          for (let dy = 0; dy <= 1; dy++) {
            const ci = pip2(x0 + (cx + dx) / cells * w, y0 + (cy + dy) / cells * h, allRings);
            if (cornerIn === null) cornerIn = ci;
            else if (ci !== cornerIn) { boundary = true; break; }
          }
        }
        index[cy * cells + cx] = boundary ? 2 : 1;
      }
    }
    c.index = index; c.indexCells = cells; c.indexBB = c.bb;
    return index;
  }
  clipContainsPoint(wx, wy) {
    const c = this.clip; if (!c) return true;
    if (c.bb && (wx < c.bb[0] || wx > c.bb[2] || wy < c.bb[1] || wy > c.bb[3])) return false;
    return pip2(wx, wy, c._allRings);
  }
  // Strict interior-overlap predicate: area(feature ∩ clip) > 0.
  // Touching border neighbours (area = 0) are excluded; straddling/enclosing/contained features (area > 0) are retained.
  clipOverlapsFeature(f) {
    const c = this.clip; if (!c || !c.polys) return true;
    // Quick bbox reject
    if (f.bb[2] < c.bb[0] || f.bb[0] > c.bb[2] || f.bb[3] < c.bb[1] || f.bb[1] > c.bb[3]) return false;
    // Spatial index fast path
    if (c.index) {
      const cells = c.indexCells;
      const [x0, y0, x1, y1] = c.indexBB;
      const w = x1 - x0, h = y1 - y0;
      const cx0 = Math.max(0, Math.floor((f.bb[0] - x0) / w * cells));
      const cx1 = Math.min(cells - 1, Math.floor((f.bb[2] - x0) / w * cells));
      const cy0 = Math.max(0, Math.floor((f.bb[1] - y0) / h * cells));
      const cy1 = Math.min(cells - 1, Math.floor((f.bb[3] - y0) / h * cells));
      let hasInside = false, hasBoundary = false;
      for (let cy = cy0; cy <= cy1 && !(hasInside && hasBoundary); cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const v = c.index[cy * cells + cx];
          if (v === 1) hasInside = true;
          else if (v === 2) hasBoundary = true;
        }
      }
      if (!hasInside && !hasBoundary) return false;  // all OUTSIDE cells
      if (hasInside && !hasBoundary) return true;    // fully inside, no boundary cells
    }
    // Precise test: feature rings vs all clip rings (outer + holes, multi-polygon)
    const featureRings = f.type === 'poly' ? f.parts : f.parts;
    return polyOverlapsPoly(featureRings, c._allRings);
  }
  clipBounds() {
    const c = this.clip; if (!c) return null;
    return [unX(c.bb[0]), unY(c.bb[3]), unX(c.bb[2]), unY(c.bb[1])];
  }
  _appendClip(ctx) {
    const c = this.clip; if (!c || !c.polys) return false;
    for (const poly of c.polys) {
      for (const ring of poly) {
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
  _drawClipFocus() {
    const ctx = this.ctx; if (!this.clip) return;
    ctx.save();
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
        if (f.hidden || !f.parts || !f.bb) continue;
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
    if (this._suppressGridLabels) return;
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
  _drawSelectionSet(list) {
    const ctx = this.ctx; if (!list || !list.length) return;
    ctx.save();
    for (let k = 0; k < list.length; k++) {
      const f = list[k].feature || list[k].f || list[k]; if (!f || !f.parts || f.type == null) continue;
      const strong = k === list.length - 1;
      // A selection has to be obvious on a busy map: bright outline plus a solid overlay,
      // with a dark casing so it reads over pale and dark polygons alike.
      ctx.lineWidth = strong ? 3.5 : 2.5;
      ctx.strokeStyle = strong ? '#ffe14d' : '#ffd400';
      ctx.fillStyle = strong ? 'rgba(255,225,77,.45)' : 'rgba(255,212,0,.34)';
      ctx.setLineDash([]); ctx.lineJoin = 'round';
      if (f.type === 'point') {
        for (let i = 0; i < f.parts.length; i += 2) {
          const [x, y] = this.screenOf(unX(f.parts[i]), unY(f.parts[i + 1]));
          ctx.beginPath(); ctx.arc(x, y, strong ? 9 : 7, 0, TAU); ctx.fill(); ctx.stroke();
        }
      } else if (f.type === 'line') {
        ctx.beginPath();
        for (const r of f.parts) {
          for (let i = 0; i < r.length; i += 2) {
            const [x, y] = this.screenOf(unX(r[i]), unY(r[i + 1]));
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
        }
        ctx.stroke();
      } else {
        ctx.beginPath();
        for (const poly of f.parts) for (const ring of poly) {
          for (let i = 0; i < ring.length; i += 2) {
            const [x, y] = this.screenOf(unX(ring[i]), unY(ring[i + 1]));
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.closePath();
        }
        ctx.fill('evenodd'); ctx.stroke();
      }
    }
    ctx.restore();
  }
  // Every feature whose geometry crosses a world-space box [wx0, wy0, wx1, wy1]
  // (drag a box on the map to select). Pass screen corners through fromScreen first;
  // doing it there keeps rotated maps correct.
  featuresInRect(box, opts = {}) {
    const wx0 = Math.min(box[0], box[2]), wx1 = Math.max(box[0], box[2]);
    const wy0 = Math.min(box[1], box[3]), wy1 = Math.max(box[1], box[3]);
    const mode = opts.mode || 'intersect';   // 'intersect' | 'contain'
    const limit = opts.limit || Infinity;
    const out = [];
    const wrapped = (x, y) => x >= wx0 && x <= wx1 && y >= wy0 && y <= wy1;
    for (const l of [...this.layers].reverse()) {
      if (!l.visible || l.opacity <= 0) continue;
      if (l.kind === 'raster' || l.kind === 'image') continue;
      if (opts.layers && !opts.layers.includes(l.id)) continue;
      for (const f of l.features) {
        if (f.hidden) continue;
        if (f.bb[2] < wx0 || f.bb[0] > wx1 || f.bb[3] < wy0 || f.bb[1] > wy1) continue;
        let hit;
        if (mode === 'contain') hit = f.bb[0] >= wx0 && f.bb[2] <= wx1 && f.bb[1] >= wy0 && f.bb[3] <= wy1;
        else {
          hit = false;
          if (f.type === 'point') {
            for (let i = 0; i < f.parts.length && !hit; i += 2) hit = wrapped(f.parts[i], f.parts[i + 1]);
          } else {
            const rings = f.type === 'poly' ? f.parts.flat() : f.parts;
            for (const r of rings) {
              for (let i = 0; i < r.length && !hit; i += 2) hit = wrapped(r[i], r[i + 1]);
              if (hit) break;
            }
            // a polygon that fully encloses the box counts too
            if (!hit && f.type === 'poly' && f.bb[0] <= wx0 && f.bb[2] >= wx1 && f.bb[1] <= wy0 && f.bb[3] >= wy1) {
              hit = pip(wx0 + (wx1 - wx0) / 2, wy0 + (wy1 - wy0) / 2, f.parts.flat());
            }
            // a line or polygon edge crossing the box (no vertex inside) counts as intersecting
            if (!hit && mode === 'intersect' && f.type === 'line') {
              for (const r of f.parts) {
                for (let i = 2; i < r.length && !hit; i += 2) {
                  hit = segCrossBox(r[i - 2], r[i - 1], r[i], r[i + 1], wx0, wy0, wx1, wy1);
                }
                if (hit) break;
              }
            }
          }
        }
        if (!hit) continue;
        out.push({ layer: l, feature: f });
        if (out.length >= limit) return out;
      }
    }
    return out;
  }
  // ---- hit testing & sampling
  identify(px, py) {
    const [wx, wy] = this.fromScreen(px, py), S = this.S, out = [];
    if (!this.clipContainsPoint(wx, wy)) return out;
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
    const pos = (e) => { const r = cv.getBoundingClientRect(); return this.rotPos(e.clientX - r.left, e.clientY - r.top); };
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId); P.set(e.pointerId, pos(e)); this._moving = true;
      if (P.size === 1) { tapT = performance.now(); [tapX, tapY] = pos(e); moved = 0; }
      if (P.size === 2) { const [a, b] = [...P.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 }; moved = 99; }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!P.has(e.pointerId)) { this._emit('hover', ...pos(e)); return; }
      const p = pos(e), old = P.get(e.pointerId); P.set(e.pointerId, p);
      if (P.size === 1) { moved += Math.abs(p[0] - old[0]) + Math.abs(p[1] - old[1]); if (moved > 3 && !this.panLock) { this.cx -= (p[0] - old[0]) / this.S; this.cy -= (p[1] - old[1]) / this.S; this.cy = Math.max(0.0005, Math.min(0.9995, this.cy)); this._viewChanged(); } }
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
  let col = DEFAULT_VECTOR_COLOR;
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
// does the segment (ax,ay)-(bx,by) cross the axis-aligned box?
function segCrossBox(ax, ay, bx, by, x0, y0, x1, y1) {
  const segHit = (px, py, qx, qy, rx, ry, sx, sy) => {
    const d = (qx - px) * (sy - ry) - (qy - py) * (sx - rx);
    if (Math.abs(d) < 1e-12) return false;
    const t = ((rx - px) * (sy - ry) - (ry - py) * (sx - rx)) / d;
    const u = ((rx - px) * (qy - py) - (ry - py) * (qx - px)) / d;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  };
  return segHit(ax, ay, bx, by, x0, y0, x1, y0) || segHit(ax, ay, bx, by, x1, y0, x1, y1)
    || segHit(ax, ay, bx, by, x1, y1, x0, y1) || segHit(ax, ay, bx, by, x0, y1, x0, y0);
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

// ------------------------------------------------------------------ spatial analysis geometry helpers

// Meters to degrees at a given latitude (Web-Mercator local approximation).
export function metersToDegLon(m, lat) { return m / (111320.0 * Math.cos(lat * Math.PI / 180)); }
export function metersToDegLat(m) { return m / 110540.0; }

// Centroid of a flat ring [x0,y0,x1,y1,...] in mercator coords.
export function ringCentroidMerc(ring) {
  let sx = 0, sy = 0, n = ring.length / 2;
  for (let i = 0; i < ring.length; i += 2) { sx += ring[i]; sy += ring[i + 1]; }
  return [sx / n, sy / n];
}

// Centroid of a feature (mercator). For polygons uses outer ring centroid.
export function featureCentroid(f) {
  if (f.type === 'point') return [f.parts[0], f.parts[1]];
  if (f.type === 'line') {
    const line = f.parts[0] || [];
    return ringCentroidMerc(line);
  }
  const outer = f.parts[0] && f.parts[0][0];
  return outer ? ringCentroidMerc(outer) : [(f.bb[0] + f.bb[2]) / 2, (f.bb[1] + f.bb[3]) / 2];
}

// Haversine distance between two mercator points (converts to lon/lat internally).
export function haversineMerc(x1, y1, x2, y2) {
  return haversineKm([unX(x1), unY(y1)], [unX(x2), unY(y2)]);
}

// Distance from point (px,py) to a segment (x1,y1)-(x2,y2) in mercator space (approx km).
export function distToSegmentMerc(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const L = dx * dx + dy * dy;
  let t = L ? ((px - x1) * dx + (py - y1) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  const mx = x1 + t * dx, my = y1 + t * dy;
  return haversineMerc(px, py, mx, my);
}

// Minimum distance between a point and a flat ring (approx km).
export function distToRingMerc(px, py, ring) {
  let best = 1e9;
  const n = ring.length;
  for (let i = 0; i < n; i += 2) {
    const x2 = ring[(i + 2) % n], y2 = ring[(i + 3) % n];
    const d = distToSegmentMerc(px, py, ring[i], ring[i + 1], x2, y2);
    if (d < best) best = d;
  }
  return best;
}

// Minimum distance between two flat rings (approx km).
export function distBetweenRings(r1, r2) {
  let best = 1e9;
  for (let i = 0; i < r1.length; i += 2) {
    const d = distToRingMerc(r1[i], r1[i + 1], r2);
    if (d < best) best = d;
    if (best === 0) return 0;
  }
  return best;
}

// Buffer a flat mercator ring by a distance in meters.
// Works in degrees around the ring's mean latitude (so the offset has the right north/south
// scale), expands outward with mitred corners, then converts back to mercator. The result is a
// closed polygon ring that always contains the source geometry.
export function bufferRing(ring, distMeters, segments = 8) {
  const n = ring.length / 2;
  if (n < 2) return ring.slice();

  let sinSum = 0;
  for (let i = 0; i < ring.length; i += 2) sinSum += unY(ring[i + 1]);
  const avgLat = sinSum / n;
  const dLon = metersToDegLon(distMeters, avgLat);
  const dLat = metersToDegLat(distMeters);

  // Normalise to degrees so a metre is the same north and south, then scale for distance.
  const ll = [];
  for (let i = 0; i < n; i++) ll.push([unX(ring[i * 2]) / dLon, unY(ring[i * 2 + 1]) / dLat]);

  const closed = n > 2 && ll[0][0] === ll[n - 1][0] && ll[0][1] === ll[n - 1][1];
  const pts = closed ? ll.slice(0, n - 1) : ll;
  const m = pts.length;
  if (m < 2) return ring.slice();

  // Winding: only a genuinely closed ring is buffered as a polygon; open paths get a corridor.
  let signed = 0;
  if (m > 2) for (let i = 0; i < m; i++) { const a = pts[i], b = pts[(i + 1) % m]; signed += a[0] * b[1] - b[0] * a[1]; }
  const sign = signed >= 0 ? 1 : -1;   // +1 anticlockwise
  const dist = 1;                      // one "unit" is exactly distMeters in the normalised space

  const result = [];
  const push = (x, y) => result.push(x, y);
  if (!closed || m < 3) {
    // open line: parallel offset each side, then two end caps
    const off = (a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
      return [-dy / len * dist, dx / len * dist];
    };
    const left = [], right = [];
    for (let i = 0; i < m - 1; i++) {
      const o = off(pts[i], pts[i + 1]);
      left.push([pts[i][0] - o[0], pts[i][1] - o[1]], [pts[i + 1][0] - o[0], pts[i + 1][1] - o[1]]);
      right.push([pts[i][0] + o[0], pts[i][1] + o[1]], [pts[i + 1][0] + o[0], pts[i + 1][1] + o[1]]);
    }
    const cap = (c, from) => {
      const a0 = Math.atan2(from[1] - c[1], from[0] - c[0]);
      for (let k = 1; k < segments; k++) {
        const a = a0 + Math.PI * k / segments;
        push(c[0] + Math.cos(a) * dist, c[1] + Math.sin(a) * dist);
      }
    };
    for (const p of left) push(p[0], p[1]);
    cap(pts[m - 1], left[left.length - 1]);
    cap(pts[m - 1], right[right.length - 1]);
    for (let i = right.length - 1; i >= 0; i--) push(right[i][0], right[i][1]);
    cap(pts[0], right[0]);
  } else {
    for (let i = 0; i < m; i++) {
      const prev = pts[(i - 1 + m) % m], curr = pts[i], next = pts[(i + 1) % m];
      const v1x = curr[0] - prev[0], v1y = curr[1] - prev[1];
      const v2x = next[0] - curr[0], v2y = next[1] - curr[1];
      const l1 = Math.hypot(v1x, v1y) || 1, l2 = Math.hypot(v2x, v2y) || 1;
      const u1x = v1x / l1, u1y = v1y / l1, u2x = v2x / l2, u2y = v2y / l2;
      // outward normal for an anticlockwise ring is on the right of each edge
      const n1x = sign * u1y, n1y = -sign * u1x;
      const n2x = sign * u2y, n2y = -sign * u2x;
      let bx = n1x + n2x, by = n1y + n2y;
      const blen = Math.hypot(bx, by);
      let ox, oy;
      if (blen < 1e-9) { ox = n1x * dist; oy = n1y * dist; }
      else {
        const ux = bx / blen, uy = by / blen;
        const miter = Math.min(dist / Math.max(blen / 2, 0.2), dist * 6);
        ox = ux * miter; oy = uy * miter;
      }
      push(curr[0] + ox, curr[1] + oy);
    }
  }

  const merc = new Float64Array(result.length + 2);
  for (let i = 0; i < result.length; i += 2) {
    merc[i] = mercX(result[i] * dLon);
    merc[i + 1] = mercY(result[i + 1] * dLat);
  }
  merc[result.length] = merc[0]; merc[result.length + 1] = merc[1];
  return merc;
}

// Buffer all rings of a polygon feature by distMeters.
// Accepts a polygon, a line or a point feature. Points become circles; lines and
// open rings are buffered as closed loops so a road or a river gets a real corridor.
export function bufferFeature(f, distMeters, segments = 8) {
  if (!f || !f.parts) return null;
  if (f.type === 'point') {
    const rings = ringOfPoint(f, distMeters);
    return { ...f, type: 'poly', parts: rings.length ? [[rings[0]]] : [], bb: bufferBB(f.bb, distMeters) };
  }
  if (f.type === 'line') {
    // Keep the line open. Closing it first buffers the loop between the two ends,
    // which is a blob, not a corridor.
    const outParts = [];
    for (const part of f.parts) {
      const ring = bufferRing(part, distMeters, Math.max(segments, 12));
      if (ring && ring.length >= 6) outParts.push([ring]);
    }
    return { ...f, type: 'poly', parts: outParts, bb: bufferBB(f.bb, distMeters) };
  }
  const outParts = [];
  for (const poly of f.parts) {
    const outPoly = [];
    for (const ring of poly) outPoly.push(bufferRing(ring, distMeters, segments));
    outParts.push(outPoly);
  }
  return { ...f, type: 'poly', parts: outParts, bb: bufferBB(f.bb, distMeters) };
}

// Buffer a single point into a closed ring in mercator coordinates.
export function bufferPoint(x, y, distMeters, segments = 32) {
  const lon = unX(x), lat = unY(y);
  const dLat = distMeters / 110574;
  const dLon = distMeters / Math.max(1, 111320 * Math.cos(lat * Math.PI / 180));
  const ring = new Float64Array(segments * 2);
  for (let i = 0; i < segments; i++) {
    const a = i / segments * Math.PI * 2;
    ring[i * 2] = mercX(lon + Math.cos(a) * dLon);
    ring[i * 2 + 1] = mercY(lat + Math.sin(a) * dLat);
  }
  return ring;
}
function ringOfPoint(f, distMeters) {
  const out = [];
  for (let i = 0; i < f.parts.length; i += 2) out.push(bufferPoint(f.parts[i], f.parts[i + 1], distMeters));
  return out;
}
function closeRing(part) {
  const n = part.length;
  if (n < 4) return part;
  const closed = part[0] === part[n - 2] && part[1] === part[n - 1];
  if (closed) return part;
  const out = new Float64Array(n + 2);
  out.set(part, 0); out[n] = part[0]; out[n + 1] = part[1];
  return out;
}

// Feature bounding boxes are in mercator units, so the padding has to be converted
// back through mercX/mercY — mixing degrees in here made every buffer look ~10 degrees wide.
function bufferBB(bb, distMeters) {
  const cy = (bb[1] + bb[3]) / 2;
  const avgLat = unY(cy);
  const dLon = metersToDegLon(distMeters, avgLat);
  const dLat = metersToDegLat(distMeters);
  const west = unX(bb[0]) - dLon, east = unX(bb[2]) + dLon;
  const south = unY(bb[3]) - dLat, north = unY(bb[1]) + dLat; // mercator y grows southwards
  return [mercX(west), mercY(north), mercX(east), mercY(south)];
}

// Sutherland-Hodgman polygon clipping: clip subjectRing against clipRing (both flat mercator rings).
// Returns the intersection flat ring(s). Simple version returns one ring.
export function ringIntersection(subjectRing, clipRing) {
  let output = subjectRing.slice();
  const n = clipRing.length;
  for (let i = 0; i < n; i += 2) {
    const x1 = clipRing[i], y1 = clipRing[i + 1];
    const x2 = clipRing[(i + 2) % n], y2 = clipRing[(i + 3) % n];
    if (output.length < 4) break;
    const input = output; output = [];
    const m = input.length;
    for (let j = 0; j < m; j += 2) {
      const curX = input[j], curY = input[j + 1];
      const prevX = input[(j - 2 + m) % m], prevY = input[(j - 1 + m) % m];
      const curIn = pipStrict(curX, curY, [clipRing]);
      const prevIn = pipStrict(prevX, prevY, [clipRing]);
      if (curIn) {
        if (!prevIn) output.push(segmentIntersectXY(prevX, prevY, curX, curY, x1, y1, x2, y2));
        output.push(curX, curY);
      } else if (prevIn) {
        output.push(segmentIntersectXY(prevX, prevY, curX, curY, x1, y1, x2, y2));
      }
    }
  }
  return output.length >= 6 ? output : null;
}

// Intersection of two infinite lines given by two points each; returns [x,y] or null.
function segmentIntersectXY(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(d) < 1e-12) return [x2, y2];
  const px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / d;
  const py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / d;
  return [px, py];
}

// Intersect a polygon feature with a clip polygon feature. Returns array of flat rings (intersection).
// Real overlap of two polygon features, including concave shapes and holes.
// Returns one flat outer ring per overlapping piece (holes are kept on polygonBoolean).
export function intersectPolyPoly(fSubj, fClip) {
  const parts = polygonBoolean([fSubj, fClip], 'intersection');
  const rings = [];
  for (const poly of parts) if (poly[0] && poly[0].length >= 6) rings.push(poly[0]);
  return rings;
}

// Convex hull of an array of [x,y] points (monotone chain), returns flat ring [x0,y0,...].
export function convexHullPoints(pts) {
  if (pts.length < 3) return null;
  const sorted = pts.slice().sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop(); lower.pop();
  const hull = lower.concat(upper);
  if (hull.length < 3) return null;
  const ring = [];
  for (const p of hull) ring.push(p[0], p[1]);
  ring.push(hull[0][0], hull[0][1]);
  return ring;
}

// Convex hull of all vertices of a feature (flat mercator ring).
export function convexHullFeature(f) {
  const pts = [];
  if (f.type === 'point') {
    pts.push([f.parts[0], f.parts[1]]);
  } else {
    for (const poly of f.parts) for (const ring of poly) {
      for (let i = 0; i < ring.length; i += 2) pts.push([ring[i], ring[i + 1]]);
    }
  }
  const ring = convexHullPoints(pts);
  return ring ? { ...f, parts: [[ring]], bb: clipBB([ring]) } : null;
}

// Douglas-Peucker simplification of a flat ring, tolerance in mercator units (approx km).
export function simplifyRing(ring, tolerance) {
  const n = ring.length / 2;
  if (n < 3) return ring.slice();
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([ring[i * 2], ring[i * 2 + 1]]);
  const keep = new Array(n).fill(false);
  keep[0] = true; keep[n - 1] = true;
  function simplify(start, end) {
    let maxDist = 0, maxIdx = -1;
    const x1 = pts[start][0], y1 = pts[start][1];
    const x2 = pts[end][0], y2 = pts[end][1];
    for (let i = start + 1; i < end; i++) {
      const d = distToSegmentMerc(pts[i][0], pts[i][1], x1, y1, x2, y2);
      if (d > maxDist) { maxDist = d; maxIdx = i; }
    }
    if (maxDist > tolerance && maxIdx >= 0) {
      keep[maxIdx] = true;
      simplify(start, maxIdx);
      simplify(maxIdx, end);
    }
  }
  simplify(0, n - 1);
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i][0], pts[i][1]);
  return out.length >= 6 ? out : ring.slice();
}

// Simplify all rings of a polygon feature.
export function simplifyFeature(f, toleranceKm) {
  // One mercator unit is 40,075 km at the equator, so a kilometre tolerance is
  // this many units. Using the equator keeps the tolerance at least as large
  // as asked for everywhere on the map.
  const tol = Math.max(0, +toleranceKm || 0) * 1000 / (40075016.686 / 1e6);
  const outParts = [];
  for (const poly of f.parts || []) {
    const outPoly = [];
    for (const ring of poly) outPoly.push(simplifyRing(ring, tol));
    if (outPoly.length) outParts.push(outPoly);
  }
  return { ...f, parts: outParts, bb: f.bb.slice() };
}

// ------------------------------------------------------------------ end spatial analysis helpers

// ------------------------------------------------------------------ clip geometry helpers (hard spatial clipping)

// Signed area of a flat ring [x0,y0,x1,y1,...]. Positive = clockwise in screen/Mercator coords (y down).
export function ringSignedArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    a += ring[j] * ring[i + 1] - ring[i] * ring[j + 1];
  }
  return a / 2;
}

// Reverse point order of a flat ring.
export function reverseRing(ring) {
  const out = new Float64Array(ring.length);
  const n = ring.length / 2;
  for (let i = 0; i < n; i++) {
    out[i * 2] = ring[(n - 1 - i) * 2];
    out[i * 2 + 1] = ring[(n - 1 - i) * 2 + 1];
  }
  return out;
}

// Ensure a flat outer ring is CW (positive signed area in screen coords).
export function ensureCW(ring) { return ringSignedArea(ring) < 0 ? reverseRing(ring) : ring; }
// Ensure a flat hole ring is CCW (negative signed area in screen coords).
export function ensureCCW(ring) { return ringSignedArea(ring) > 0 ? reverseRing(ring) : ring; }

// Bounding box of an array of flat rings.
export function clipBB(rings) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i += 2) {
      if (ring[i] < x0) x0 = ring[i];
      if (ring[i] > x1) x1 = ring[i];
      if (ring[i + 1] < y0) y0 = ring[i + 1];
      if (ring[i + 1] > y1) y1 = ring[i + 1];
    }
  }
  return [x0, y0, x1, y1];
}

// Approximate a circle as a flat CW ring (segments sides).
export function circleToPolygon(cx, cy, r, segments = 64) {
  const ring = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * TAU;
    ring.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return ring;
}

// Point-in-(multi)polygon, even-odd rule. rings: array of flat rings.
export function pip2(x, y, rings) {
  let inside = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

// Strict point-in-polygon: returns false for points on the boundary.
export function pipStrict(x, y, rings) {
  for (const r of rings) {
    const n = r.length;
    for (let i = 0; i < n; i += 2) {
      const x1 = r[i], y1 = r[i + 1];
      const x2 = r[(i + 2) % n], y2 = r[(i + 3) % n];
      const cross = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1);
      if (Math.abs(cross) < 1e-9 &&
          x >= Math.min(x1, x2) - 1e-9 && x <= Math.max(x1, x2) + 1e-9 &&
          y >= Math.min(y1, y2) - 1e-9 && y <= Math.max(y1, y2) + 1e-9) {
        return false; // on boundary
      }
    }
  }
  return pip2(x, y, rings);
}

// Strict segment intersection (proper crossing, not touching at endpoints).
export function segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(d) < 1e-12) return false;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / d;
  return t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9;
}

// Test if any feature ring overlaps any clip ring with area > 0.
// Uses vertex-inside + edge-crossing tests, robust for convex and concave polygons.
function ringCentroid(ring) {
  let cx = 0, cy = 0, n = ring.length / 2;
  for (let i = 0; i < ring.length; i += 2) { cx += ring[i]; cy += ring[i + 1]; }
  return [cx / n, cy / n];
}

export function ringsBBox(rings) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rings) {
    for (let i = 0; i < r.length; i += 2) {
      const x = r[i], y = r[i + 1];
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return [x0, y0, x1, y1];
}

export function polyOverlapsPoly(featureRings, clipRings) {
  if (!featureRings || !clipRings || !clipRings.length) return false;
  // A flat coordinate list (x, y, x, y, ...) is accepted as a single ring.
  // Rings are usually Float64Array, so test the container — not its first element —
  // otherwise a polygon that happens to hold typed rings is misread as flat numbers.
  const isFlatList = (r) => (r instanceof Float64Array) || (Array.isArray(r) && typeof r[0] === 'number');
  featureRings = isFlatList(featureRings) ? [featureRings] : featureRings;
  clipRings = isFlatList(clipRings) ? [clipRings] : clipRings;
  // Bounding boxes first: this is what keeps layer × layer comparisons fast.
  const bf = ringsBBox(featureRings), bc = ringsBBox(clipRings);
  if (bf[2] < bc[0] || bf[0] > bc[2] || bf[3] < bc[1] || bf[1] > bc[3]) return false;
  // 1. Any feature vertex strictly inside clip (boundary-touching doesn't count)
  for (const ring of featureRings) {
    for (let i = 0; i < ring.length; i += 2) {
      if (pipStrict(ring[i], ring[i + 1], clipRings)) return true;
    }
  }
  // 2. Any clip vertex strictly inside feature
  for (const ring of clipRings) {
    for (let i = 0; i < ring.length; i += 2) {
      if (pipStrict(ring[i], ring[i + 1], featureRings)) return true;
    }
  }
  // 3. Any edge crossing (transverse segment intersection)
  for (const fr of featureRings) {
    const n = fr.length;
    for (let i = 0; i < n; i += 2) {
      const x1 = fr[i], y1 = fr[i + 1];
      const x2 = fr[(i + 2) % n], y2 = fr[(i + 3) % n];
      for (const cr of clipRings) {
        const m = cr.length;
        for (let j = 0; j < m; j += 2) {
          const x3 = cr[j], y3 = cr[j + 1];
          const x4 = cr[(j + 2) % m], y4 = cr[(j + 3) % m];
          if (segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4)) return true;
        }
      }
    }
  }
  // 4. Containment: centroid of feature outer ring inside clip, or vice versa
  const outerF = featureRings[0];
  const outerC = clipRings[0];
  if (outerF && outerC) {
    const [cfx, cfy] = ringCentroid(outerF);
    if (pip2(cfx, cfy, clipRings)) return true;
    const [ccx, ccy] = ringCentroid(outerC);
    if (pip2(ccx, ccy, featureRings)) return true;
  }
  return false;
}

// Coerce a ring (typed array or plain list) to a plain number array.
function asFlatRing(r) { return Array.from(r || []); }
// Accept a ring, a list of rings, or a list of polygons and return every ring in it.
function asRingList(v, out = []) {
  if (!v || typeof v.length !== 'number') return out;
  if (typeof v[0] === 'number') { if (v.length >= 6) out.push(Array.from(v)); }
  else for (const x of v) asRingList(x, out);
  return out;
}

// Distance (metres) from the middle of an edge to its chord, for a circle whose flat
// radius is r and centre latitude lat. Used to turn a screen radius into a ground radius.
export function circleMercRadiusForMetres(metres, lat, segments = 128) {
  const dLat = metres / 110540;
  const lon0 = 8.7;                                   // any longitude: mercator x is linear
  const ring = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    ring.push(mercX(lon0 + Math.cos(a) * (dLat / Math.max(1e-6, Math.cos(lat * Math.PI / 180)))), mercY(lat + Math.sin(a) * dLat));
  }
  let best = 0;
  for (let i = 0; i < segments; i++) {
    const x1 = ring[i * 2], y1 = ring[i * 2 + 1], x2 = ring[i * 2 + 2], y2 = ring[i * 2 + 3];
    best = Math.max(best, Math.hypot((x1 + x2) / 2 - mercX(lon0), (y1 + y2) / 2 - mercY(lat)));
  }
  return best;
}

// Normalize a clip object (rect/poly/circle/freehand/multi) into { type, polys, bb, label }.
// polys: [[outerCW, ...holesCCW], ...] in Mercator world coords, for ctx.clip('nonzero').
// Several separate shapes (multi-feature focus, or a polygon layer with holes) must stay
// separate ring groups, otherwise the clip path loses every shape but the first.
export function normalizeClip(obj) {
  if (!obj) return null;
  let polys, bb, type, label = obj.label || '';
  if (obj.type === 'rect') {
    let [w, y0, e, y1] = obj.wb || [];
    if (![w, y0, e, y1].every(Number.isFinite)) return null;
    // Callers may hand the two corners over in either order — mercator y grows downwards,
    // so "south, north" and "north, south" are both natural. Sort them instead of refusing
    // the rectangle, which used to make the whole shape silently do nothing.
    const yt = Math.min(y0, y1), yb = Math.max(y0, y1);
    const n = yt, s = yb;
    if (w === e || yt === yb) return null;
    if (w > e) { const t = w; w = e; e = t; }
    // CW outer ring on screen (y down): top-right -> bottom-right -> bottom-left -> top-left (flat)
    polys = [[[e, n, e, s, w, s, w, n]]];
    // Same order as clipBB and every other bbox here: [west, top, east, bottom] (y grows downwards).
    bb = [w, yt, e, yb]; type = 'rect';
  } else if (obj.type === 'circle') {
    const { c, r } = obj;
    if (!c || !Number.isFinite(r) || r <= 0) return null;
    const ring = ensureCW(circleToPolygon(c[0], c[1], r));
    polys = [[ring]];
    bb = [c[0] - r, c[1] - r, c[0] + r, c[1] + r];
    type = 'circle';
  } else if (obj.type === 'poly' || obj.type === 'freehand' || obj.type === 'multi') {
    // `rings`: a flat list of rings, each its own area.
    // `polys`: an array of polygons, each [outer, ...holes] — holes are preserved.
    let groups;
    if (obj.polys && obj.polys.length) {
      groups = typeof obj.polys[0]?.[0] === 'number'
        ? obj.polys.map((ring) => [ring])                    // really a list of rings
        : obj.polys.map((poly) => poly.map(asFlatRing));
    } else {
      groups = asRingList(obj.rings).map((ring) => [ring]);
    }
    groups = groups
      .map((g) => g.filter((r) => r && r.length >= 6))
      .filter((g) => g.length);
    if (!groups.length) return null;
    polys = groups.map(([outer, ...holes]) => [ensureCW(outer), ...holes.map(ensureCCW)]);
    bb = clipBB(groups.flat());
    if (!bb.every(Number.isFinite) || bb[0] >= bb[2] || bb[1] >= bb[3]) return null;
    type = obj.type;
  } else {
    return null;
  }
  // Flatten all rings (outer + holes) for pip2 testing; keep structured polys for ctx.clip('nonzero')
  const allRings = polys.flatMap((p) => p);
  // The circle radius is measured on the ground, so remember it: saved, shared and
  // restored circles must report the same metres and km² they were drawn with.
  const metres = type === 'circle' && Number.isFinite(obj.metres) && obj.metres > 0 ? obj.metres : undefined;
  const wb = type === 'rect' ? [bb[0], bb[1], bb[2], bb[3]] : undefined;
  return { type, polys, bb, wb, label, metres, _allRings: allRings };
}

// ------------------------------------------------------------------ end clip geometry helpers

// ------------------------------------------------------------------ polygon booleans
// polygon-clipping 0.15.7 (MIT). Copyright (c) 2018 Mike Fogel.
// Portions Copyright (c) 2016 Alexander Milevski (martinez).
// Used here to union, intersect and subtract real polygons, including concave
// rings and holes. Coordinates are scaled before the clip so small mercator
// values do not collapse.

const polygonClipping = (function () { 'use strict';

    /**
     * splaytree v3.1.2
     * Fast Splay tree for Node and browser
     *
     * @author Alexander Milevski <info@w8r.name>
     * @license MIT
     * @preserve
     */

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation. All rights reserved.
    Licensed under the Apache License, Version 2.0 (the "License"); you may not use
    this file except in compliance with the License. You may obtain a copy of the
    License at http://www.apache.org/licenses/LICENSE-2.0

    THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
    WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
    MERCHANTABLITY OR NON-INFRINGEMENT.

    See the Apache Version 2.0 License for specific language governing permissions
    and limitations under the License.
    ***************************************************************************** */

    function __generator(thisArg, body) {
      var _ = {
          label: 0,
          sent: function () {
            if (t[0] & 1) throw t[1];
            return t[1];
          },
          trys: [],
          ops: []
        },
        f,
        y,
        t,
        g;
      return g = {
        next: verb(0),
        "throw": verb(1),
        "return": verb(2)
      }, typeof Symbol === "function" && (g[Symbol.iterator] = function () {
        return this;
      }), g;
      function verb(n) {
        return function (v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return {
                value: op[1],
                done: false
              };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return {
          value: op[0] ? op[1] : void 0,
          done: true
        };
      }
    }
    var Node = /** @class */function () {
      function Node(key, data) {
        this.next = null;
        this.key = key;
        this.data = data;
        this.left = null;
        this.right = null;
      }
      return Node;
    }();

    /* follows "An implementation of top-down splaying"
     * by D. Sleator <sleator@cs.cmu.edu> March 1992
     */
    function DEFAULT_COMPARE(a, b) {
      return a > b ? 1 : a < b ? -1 : 0;
    }
    /**
     * Simple top down splay, not requiring i to be in the tree t.
     */
    function splay(i, t, comparator) {
      var N = new Node(null, null);
      var l = N;
      var r = N;
      while (true) {
        var cmp = comparator(i, t.key);
        //if (i < t.key) {
        if (cmp < 0) {
          if (t.left === null) break;
          //if (i < t.left.key) {
          if (comparator(i, t.left.key) < 0) {
            var y = t.left; /* rotate right */
            t.left = y.right;
            y.right = t;
            t = y;
            if (t.left === null) break;
          }
          r.left = t; /* link right */
          r = t;
          t = t.left;
          //} else if (i > t.key) {
        } else if (cmp > 0) {
          if (t.right === null) break;
          //if (i > t.right.key) {
          if (comparator(i, t.right.key) > 0) {
            var y = t.right; /* rotate left */
            t.right = y.left;
            y.left = t;
            t = y;
            if (t.right === null) break;
          }
          l.right = t; /* link left */
          l = t;
          t = t.right;
        } else break;
      }
      /* assemble */
      l.right = t.left;
      r.left = t.right;
      t.left = N.right;
      t.right = N.left;
      return t;
    }
    function insert(i, data, t, comparator) {
      var node = new Node(i, data);
      if (t === null) {
        node.left = node.right = null;
        return node;
      }
      t = splay(i, t, comparator);
      var cmp = comparator(i, t.key);
      if (cmp < 0) {
        node.left = t.left;
        node.right = t;
        t.left = null;
      } else if (cmp >= 0) {
        node.right = t.right;
        node.left = t;
        t.right = null;
      }
      return node;
    }
    function split(key, v, comparator) {
      var left = null;
      var right = null;
      if (v) {
        v = splay(key, v, comparator);
        var cmp = comparator(v.key, key);
        if (cmp === 0) {
          left = v.left;
          right = v.right;
        } else if (cmp < 0) {
          right = v.right;
          v.right = null;
          left = v;
        } else {
          left = v.left;
          v.left = null;
          right = v;
        }
      }
      return {
        left: left,
        right: right
      };
    }
    function merge(left, right, comparator) {
      if (right === null) return left;
      if (left === null) return right;
      right = splay(left.key, right, comparator);
      right.left = left;
      return right;
    }
    /**
     * Prints level of the tree
     */
    function printRow(root, prefix, isTail, out, printNode) {
      if (root) {
        out("" + prefix + (isTail ? '└── ' : '├── ') + printNode(root) + "\n");
        var indent = prefix + (isTail ? '    ' : '│   ');
        if (root.left) printRow(root.left, indent, false, out, printNode);
        if (root.right) printRow(root.right, indent, true, out, printNode);
      }
    }
    var Tree = /** @class */function () {
      function Tree(comparator) {
        if (comparator === void 0) {
          comparator = DEFAULT_COMPARE;
        }
        this._root = null;
        this._size = 0;
        this._comparator = comparator;
      }
      /**
       * Inserts a key, allows duplicates
       */
      Tree.prototype.insert = function (key, data) {
        this._size++;
        return this._root = insert(key, data, this._root, this._comparator);
      };
      /**
       * Adds a key, if it is not present in the tree
       */
      Tree.prototype.add = function (key, data) {
        var node = new Node(key, data);
        if (this._root === null) {
          node.left = node.right = null;
          this._size++;
          this._root = node;
        }
        var comparator = this._comparator;
        var t = splay(key, this._root, comparator);
        var cmp = comparator(key, t.key);
        if (cmp === 0) this._root = t;else {
          if (cmp < 0) {
            node.left = t.left;
            node.right = t;
            t.left = null;
          } else if (cmp > 0) {
            node.right = t.right;
            node.left = t;
            t.right = null;
          }
          this._size++;
          this._root = node;
        }
        return this._root;
      };
      /**
       * @param  {Key} key
       * @return {Node|null}
       */
      Tree.prototype.remove = function (key) {
        this._root = this._remove(key, this._root, this._comparator);
      };
      /**
       * Deletes i from the tree if it's there
       */
      Tree.prototype._remove = function (i, t, comparator) {
        var x;
        if (t === null) return null;
        t = splay(i, t, comparator);
        var cmp = comparator(i, t.key);
        if (cmp === 0) {
          /* found it */
          if (t.left === null) {
            x = t.right;
          } else {
            x = splay(i, t.left, comparator);
            x.right = t.right;
          }
          this._size--;
          return x;
        }
        return t; /* It wasn't there */
      };
      /**
       * Removes and returns the node with smallest key
       */
      Tree.prototype.pop = function () {
        var node = this._root;
        if (node) {
          while (node.left) node = node.left;
          this._root = splay(node.key, this._root, this._comparator);
          this._root = this._remove(node.key, this._root, this._comparator);
          return {
            key: node.key,
            data: node.data
          };
        }
        return null;
      };
      /**
       * Find without splaying
       */
      Tree.prototype.findStatic = function (key) {
        var current = this._root;
        var compare = this._comparator;
        while (current) {
          var cmp = compare(key, current.key);
          if (cmp === 0) return current;else if (cmp < 0) current = current.left;else current = current.right;
        }
        return null;
      };
      Tree.prototype.find = function (key) {
        if (this._root) {
          this._root = splay(key, this._root, this._comparator);
          if (this._comparator(key, this._root.key) !== 0) return null;
        }
        return this._root;
      };
      Tree.prototype.contains = function (key) {
        var current = this._root;
        var compare = this._comparator;
        while (current) {
          var cmp = compare(key, current.key);
          if (cmp === 0) return true;else if (cmp < 0) current = current.left;else current = current.right;
        }
        return false;
      };
      Tree.prototype.forEach = function (visitor, ctx) {
        var current = this._root;
        var Q = []; /* Initialize stack s */
        var done = false;
        while (!done) {
          if (current !== null) {
            Q.push(current);
            current = current.left;
          } else {
            if (Q.length !== 0) {
              current = Q.pop();
              visitor.call(ctx, current);
              current = current.right;
            } else done = true;
          }
        }
        return this;
      };
      /**
       * Walk key range from `low` to `high`. Stops if `fn` returns a value.
       */
      Tree.prototype.range = function (low, high, fn, ctx) {
        var Q = [];
        var compare = this._comparator;
        var node = this._root;
        var cmp;
        while (Q.length !== 0 || node) {
          if (node) {
            Q.push(node);
            node = node.left;
          } else {
            node = Q.pop();
            cmp = compare(node.key, high);
            if (cmp > 0) {
              break;
            } else if (compare(node.key, low) >= 0) {
              if (fn.call(ctx, node)) return this; // stop if smth is returned
            }
            node = node.right;
          }
        }
        return this;
      };
      /**
       * Returns array of keys
       */
      Tree.prototype.keys = function () {
        var keys = [];
        this.forEach(function (_a) {
          var key = _a.key;
          return keys.push(key);
        });
        return keys;
      };
      /**
       * Returns array of all the data in the nodes
       */
      Tree.prototype.values = function () {
        var values = [];
        this.forEach(function (_a) {
          var data = _a.data;
          return values.push(data);
        });
        return values;
      };
      Tree.prototype.min = function () {
        if (this._root) return this.minNode(this._root).key;
        return null;
      };
      Tree.prototype.max = function () {
        if (this._root) return this.maxNode(this._root).key;
        return null;
      };
      Tree.prototype.minNode = function (t) {
        if (t === void 0) {
          t = this._root;
        }
        if (t) while (t.left) t = t.left;
        return t;
      };
      Tree.prototype.maxNode = function (t) {
        if (t === void 0) {
          t = this._root;
        }
        if (t) while (t.right) t = t.right;
        return t;
      };
      /**
       * Returns node at given index
       */
      Tree.prototype.at = function (index) {
        var current = this._root;
        var done = false;
        var i = 0;
        var Q = [];
        while (!done) {
          if (current) {
            Q.push(current);
            current = current.left;
          } else {
            if (Q.length > 0) {
              current = Q.pop();
              if (i === index) return current;
              i++;
              current = current.right;
            } else done = true;
          }
        }
        return null;
      };
      Tree.prototype.next = function (d) {
        var root = this._root;
        var successor = null;
        if (d.right) {
          successor = d.right;
          while (successor.left) successor = successor.left;
          return successor;
        }
        var comparator = this._comparator;
        while (root) {
          var cmp = comparator(d.key, root.key);
          if (cmp === 0) break;else if (cmp < 0) {
            successor = root;
            root = root.left;
          } else root = root.right;
        }
        return successor;
      };
      Tree.prototype.prev = function (d) {
        var root = this._root;
        var predecessor = null;
        if (d.left !== null) {
          predecessor = d.left;
          while (predecessor.right) predecessor = predecessor.right;
          return predecessor;
        }
        var comparator = this._comparator;
        while (root) {
          var cmp = comparator(d.key, root.key);
          if (cmp === 0) break;else if (cmp < 0) root = root.left;else {
            predecessor = root;
            root = root.right;
          }
        }
        return predecessor;
      };
      Tree.prototype.clear = function () {
        this._root = null;
        this._size = 0;
        return this;
      };
      Tree.prototype.toList = function () {
        return toList(this._root);
      };
      /**
       * Bulk-load items. Both array have to be same size
       */
      Tree.prototype.load = function (keys, values, presort) {
        if (values === void 0) {
          values = [];
        }
        if (presort === void 0) {
          presort = false;
        }
        var size = keys.length;
        var comparator = this._comparator;
        // sort if needed
        if (presort) sort(keys, values, 0, size - 1, comparator);
        if (this._root === null) {
          // empty tree
          this._root = loadRecursive(keys, values, 0, size);
          this._size = size;
        } else {
          // that re-builds the whole tree from two in-order traversals
          var mergedList = mergeLists(this.toList(), createList(keys, values), comparator);
          size = this._size + size;
          this._root = sortedListToBST({
            head: mergedList
          }, 0, size);
        }
        return this;
      };
      Tree.prototype.isEmpty = function () {
        return this._root === null;
      };
      Object.defineProperty(Tree.prototype, "size", {
        get: function () {
          return this._size;
        },
        enumerable: true,
        configurable: true
      });
      Object.defineProperty(Tree.prototype, "root", {
        get: function () {
          return this._root;
        },
        enumerable: true,
        configurable: true
      });
      Tree.prototype.toString = function (printNode) {
        if (printNode === void 0) {
          printNode = function (n) {
            return String(n.key);
          };
        }
        var out = [];
        printRow(this._root, '', true, function (v) {
          return out.push(v);
        }, printNode);
        return out.join('');
      };
      Tree.prototype.update = function (key, newKey, newData) {
        var comparator = this._comparator;
        var _a = split(key, this._root, comparator),
          left = _a.left,
          right = _a.right;
        if (comparator(key, newKey) < 0) {
          right = insert(newKey, newData, right, comparator);
        } else {
          left = insert(newKey, newData, left, comparator);
        }
        this._root = merge(left, right, comparator);
      };
      Tree.prototype.split = function (key) {
        return split(key, this._root, this._comparator);
      };
      Tree.prototype[Symbol.iterator] = function () {
        var current, Q, done;
        return __generator(this, function (_a) {
          switch (_a.label) {
            case 0:
              current = this._root;
              Q = [];
              done = false;
              _a.label = 1;
            case 1:
              if (!!done) return [3 /*break*/, 6];
              if (!(current !== null)) return [3 /*break*/, 2];
              Q.push(current);
              current = current.left;
              return [3 /*break*/, 5];
            case 2:
              if (!(Q.length !== 0)) return [3 /*break*/, 4];
              current = Q.pop();
              return [4 /*yield*/, current];
            case 3:
              _a.sent();
              current = current.right;
              return [3 /*break*/, 5];
            case 4:
              done = true;
              _a.label = 5;
            case 5:
              return [3 /*break*/, 1];
            case 6:
              return [2 /*return*/];
          }
        });
      };
      return Tree;
    }();
    function loadRecursive(keys, values, start, end) {
      var size = end - start;
      if (size > 0) {
        var middle = start + Math.floor(size / 2);
        var key = keys[middle];
        var data = values[middle];
        var node = new Node(key, data);
        node.left = loadRecursive(keys, values, start, middle);
        node.right = loadRecursive(keys, values, middle + 1, end);
        return node;
      }
      return null;
    }
    function createList(keys, values) {
      var head = new Node(null, null);
      var p = head;
      for (var i = 0; i < keys.length; i++) {
        p = p.next = new Node(keys[i], values[i]);
      }
      p.next = null;
      return head.next;
    }
    function toList(root) {
      var current = root;
      var Q = [];
      var done = false;
      var head = new Node(null, null);
      var p = head;
      while (!done) {
        if (current) {
          Q.push(current);
          current = current.left;
        } else {
          if (Q.length > 0) {
            current = p = p.next = Q.pop();
            current = current.right;
          } else done = true;
        }
      }
      p.next = null; // that'll work even if the tree was empty
      return head.next;
    }
    function sortedListToBST(list, start, end) {
      var size = end - start;
      if (size > 0) {
        var middle = start + Math.floor(size / 2);
        var left = sortedListToBST(list, start, middle);
        var root = list.head;
        root.left = left;
        list.head = list.head.next;
        root.right = sortedListToBST(list, middle + 1, end);
        return root;
      }
      return null;
    }
    function mergeLists(l1, l2, compare) {
      var head = new Node(null, null); // dummy
      var p = head;
      var p1 = l1;
      var p2 = l2;
      while (p1 !== null && p2 !== null) {
        if (compare(p1.key, p2.key) < 0) {
          p.next = p1;
          p1 = p1.next;
        } else {
          p.next = p2;
          p2 = p2.next;
        }
        p = p.next;
      }
      if (p1 !== null) {
        p.next = p1;
      } else if (p2 !== null) {
        p.next = p2;
      }
      return head.next;
    }
    function sort(keys, values, left, right, compare) {
      if (left >= right) return;
      var pivot = keys[left + right >> 1];
      var i = left - 1;
      var j = right + 1;
      while (true) {
        do i++; while (compare(keys[i], pivot) < 0);
        do j--; while (compare(keys[j], pivot) > 0);
        if (i >= j) break;
        var tmp = keys[i];
        keys[i] = keys[j];
        keys[j] = tmp;
        tmp = values[i];
        values[i] = values[j];
        values[j] = tmp;
      }
      sort(keys, values, left, j, compare);
      sort(keys, values, j + 1, right, compare);
    }

    /**
     * A bounding box has the format:
     *
     *  { ll: { x: xmin, y: ymin }, ur: { x: xmax, y: ymax } }
     *
     */

    const isInBbox = (bbox, point) => {
      return bbox.ll.x <= point.x && point.x <= bbox.ur.x && bbox.ll.y <= point.y && point.y <= bbox.ur.y;
    };

    /* Returns either null, or a bbox (aka an ordered pair of points)
     * If there is only one point of overlap, a bbox with identical points
     * will be returned */
    const getBboxOverlap = (b1, b2) => {
      // check if the bboxes overlap at all
      if (b2.ur.x < b1.ll.x || b1.ur.x < b2.ll.x || b2.ur.y < b1.ll.y || b1.ur.y < b2.ll.y) return null;

      // find the middle two X values
      const lowerX = b1.ll.x < b2.ll.x ? b2.ll.x : b1.ll.x;
      const upperX = b1.ur.x < b2.ur.x ? b1.ur.x : b2.ur.x;

      // find the middle two Y values
      const lowerY = b1.ll.y < b2.ll.y ? b2.ll.y : b1.ll.y;
      const upperY = b1.ur.y < b2.ur.y ? b1.ur.y : b2.ur.y;

      // put those middle values together to get the overlap
      return {
        ll: {
          x: lowerX,
          y: lowerY
        },
        ur: {
          x: upperX,
          y: upperY
        }
      };
    };

    /* Javascript doesn't do integer math. Everything is
     * floating point with percision Number.EPSILON.
     *
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/EPSILON
     */

    let epsilon$1 = Number.EPSILON;

    // IE Polyfill
    if (epsilon$1 === undefined) epsilon$1 = Math.pow(2, -52);
    const EPSILON_SQ = epsilon$1 * epsilon$1;

    /* FLP comparator */
    const cmp = (a, b) => {
      // check if they're both 0
      if (-epsilon$1 < a && a < epsilon$1) {
        if (-epsilon$1 < b && b < epsilon$1) {
          return 0;
        }
      }

      // check if they're flp equal
      const ab = a - b;
      if (ab * ab < EPSILON_SQ * a * b) {
        return 0;
      }

      // normal comparison
      return a < b ? -1 : 1;
    };

    /**
     * This class rounds incoming values sufficiently so that
     * floating points problems are, for the most part, avoided.
     *
     * Incoming points are have their x & y values tested against
     * all previously seen x & y values. If either is 'too close'
     * to a previously seen value, it's value is 'snapped' to the
     * previously seen value.
     *
     * All points should be rounded by this class before being
     * stored in any data structures in the rest of this algorithm.
     */

    class PtRounder {
      constructor() {
        this.reset();
      }
      reset() {
        this.xRounder = new CoordRounder();
        this.yRounder = new CoordRounder();
      }
      round(x, y) {
        return {
          x: this.xRounder.round(x),
          y: this.yRounder.round(y)
        };
      }
    }
    class CoordRounder {
      constructor() {
        this.tree = new Tree();
        // preseed with 0 so we don't end up with values < Number.EPSILON
        this.round(0);
      }

      // Note: this can rounds input values backwards or forwards.
      //       You might ask, why not restrict this to just rounding
      //       forwards? Wouldn't that allow left endpoints to always
      //       remain left endpoints during splitting (never change to
      //       right). No - it wouldn't, because we snap intersections
      //       to endpoints (to establish independence from the segment
      //       angle for t-intersections).
      round(coord) {
        const node = this.tree.add(coord);
        const prevNode = this.tree.prev(node);
        if (prevNode !== null && cmp(node.key, prevNode.key) === 0) {
          this.tree.remove(coord);
          return prevNode.key;
        }
        const nextNode = this.tree.next(node);
        if (nextNode !== null && cmp(node.key, nextNode.key) === 0) {
          this.tree.remove(coord);
          return nextNode.key;
        }
        return coord;
      }
    }

    // singleton available by import
    const rounder = new PtRounder();

    const epsilon = 1.1102230246251565e-16;
    const splitter = 134217729;
    const resulterrbound = (3 + 8 * epsilon) * epsilon;

    // fast_expansion_sum_zeroelim routine from oritinal code
    function sum(elen, e, flen, f, h) {
      let Q, Qnew, hh, bvirt;
      let enow = e[0];
      let fnow = f[0];
      let eindex = 0;
      let findex = 0;
      if (fnow > enow === fnow > -enow) {
        Q = enow;
        enow = e[++eindex];
      } else {
        Q = fnow;
        fnow = f[++findex];
      }
      let hindex = 0;
      if (eindex < elen && findex < flen) {
        if (fnow > enow === fnow > -enow) {
          Qnew = enow + Q;
          hh = Q - (Qnew - enow);
          enow = e[++eindex];
        } else {
          Qnew = fnow + Q;
          hh = Q - (Qnew - fnow);
          fnow = f[++findex];
        }
        Q = Qnew;
        if (hh !== 0) {
          h[hindex++] = hh;
        }
        while (eindex < elen && findex < flen) {
          if (fnow > enow === fnow > -enow) {
            Qnew = Q + enow;
            bvirt = Qnew - Q;
            hh = Q - (Qnew - bvirt) + (enow - bvirt);
            enow = e[++eindex];
          } else {
            Qnew = Q + fnow;
            bvirt = Qnew - Q;
            hh = Q - (Qnew - bvirt) + (fnow - bvirt);
            fnow = f[++findex];
          }
          Q = Qnew;
          if (hh !== 0) {
            h[hindex++] = hh;
          }
        }
      }
      while (eindex < elen) {
        Qnew = Q + enow;
        bvirt = Qnew - Q;
        hh = Q - (Qnew - bvirt) + (enow - bvirt);
        enow = e[++eindex];
        Q = Qnew;
        if (hh !== 0) {
          h[hindex++] = hh;
        }
      }
      while (findex < flen) {
        Qnew = Q + fnow;
        bvirt = Qnew - Q;
        hh = Q - (Qnew - bvirt) + (fnow - bvirt);
        fnow = f[++findex];
        Q = Qnew;
        if (hh !== 0) {
          h[hindex++] = hh;
        }
      }
      if (Q !== 0 || hindex === 0) {
        h[hindex++] = Q;
      }
      return hindex;
    }
    function estimate(elen, e) {
      let Q = e[0];
      for (let i = 1; i < elen; i++) Q += e[i];
      return Q;
    }
    function vec(n) {
      return new Float64Array(n);
    }

    const ccwerrboundA = (3 + 16 * epsilon) * epsilon;
    const ccwerrboundB = (2 + 12 * epsilon) * epsilon;
    const ccwerrboundC = (9 + 64 * epsilon) * epsilon * epsilon;
    const B = vec(4);
    const C1 = vec(8);
    const C2 = vec(12);
    const D = vec(16);
    const u = vec(4);
    function orient2dadapt(ax, ay, bx, by, cx, cy, detsum) {
      let acxtail, acytail, bcxtail, bcytail;
      let bvirt, c, ahi, alo, bhi, blo, _i, _j, _0, s1, s0, t1, t0, u3;
      const acx = ax - cx;
      const bcx = bx - cx;
      const acy = ay - cy;
      const bcy = by - cy;
      s1 = acx * bcy;
      c = splitter * acx;
      ahi = c - (c - acx);
      alo = acx - ahi;
      c = splitter * bcy;
      bhi = c - (c - bcy);
      blo = bcy - bhi;
      s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
      t1 = acy * bcx;
      c = splitter * acy;
      ahi = c - (c - acy);
      alo = acy - ahi;
      c = splitter * bcx;
      bhi = c - (c - bcx);
      blo = bcx - bhi;
      t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
      _i = s0 - t0;
      bvirt = s0 - _i;
      B[0] = s0 - (_i + bvirt) + (bvirt - t0);
      _j = s1 + _i;
      bvirt = _j - s1;
      _0 = s1 - (_j - bvirt) + (_i - bvirt);
      _i = _0 - t1;
      bvirt = _0 - _i;
      B[1] = _0 - (_i + bvirt) + (bvirt - t1);
      u3 = _j + _i;
      bvirt = u3 - _j;
      B[2] = _j - (u3 - bvirt) + (_i - bvirt);
      B[3] = u3;
      let det = estimate(4, B);
      let errbound = ccwerrboundB * detsum;
      if (det >= errbound || -det >= errbound) {
        return det;
      }
      bvirt = ax - acx;
      acxtail = ax - (acx + bvirt) + (bvirt - cx);
      bvirt = bx - bcx;
      bcxtail = bx - (bcx + bvirt) + (bvirt - cx);
      bvirt = ay - acy;
      acytail = ay - (acy + bvirt) + (bvirt - cy);
      bvirt = by - bcy;
      bcytail = by - (bcy + bvirt) + (bvirt - cy);
      if (acxtail === 0 && acytail === 0 && bcxtail === 0 && bcytail === 0) {
        return det;
      }
      errbound = ccwerrboundC * detsum + resulterrbound * Math.abs(det);
      det += acx * bcytail + bcy * acxtail - (acy * bcxtail + bcx * acytail);
      if (det >= errbound || -det >= errbound) return det;
      s1 = acxtail * bcy;
      c = splitter * acxtail;
      ahi = c - (c - acxtail);
      alo = acxtail - ahi;
      c = splitter * bcy;
      bhi = c - (c - bcy);
      blo = bcy - bhi;
      s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
      t1 = acytail * bcx;
      c = splitter * acytail;
      ahi = c - (c - acytail);
      alo = acytail - ahi;
      c = splitter * bcx;
      bhi = c - (c - bcx);
      blo = bcx - bhi;
      t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
      _i = s0 - t0;
      bvirt = s0 - _i;
      u[0] = s0 - (_i + bvirt) + (bvirt - t0);
      _j = s1 + _i;
      bvirt = _j - s1;
      _0 = s1 - (_j - bvirt) + (_i - bvirt);
      _i = _0 - t1;
      bvirt = _0 - _i;
      u[1] = _0 - (_i + bvirt) + (bvirt - t1);
      u3 = _j + _i;
      bvirt = u3 - _j;
      u[2] = _j - (u3 - bvirt) + (_i - bvirt);
      u[3] = u3;
      const C1len = sum(4, B, 4, u, C1);
      s1 = acx * bcytail;
      c = splitter * acx;
      ahi = c - (c - acx);
      alo = acx - ahi;
      c = splitter * bcytail;
      bhi = c - (c - bcytail);
      blo = bcytail - bhi;
      s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
      t1 = acy * bcxtail;
      c = splitter * acy;
      ahi = c - (c - acy);
      alo = acy - ahi;
      c = splitter * bcxtail;
      bhi = c - (c - bcxtail);
      blo = bcxtail - bhi;
      t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
      _i = s0 - t0;
      bvirt = s0 - _i;
      u[0] = s0 - (_i + bvirt) + (bvirt - t0);
      _j = s1 + _i;
      bvirt = _j - s1;
      _0 = s1 - (_j - bvirt) + (_i - bvirt);
      _i = _0 - t1;
      bvirt = _0 - _i;
      u[1] = _0 - (_i + bvirt) + (bvirt - t1);
      u3 = _j + _i;
      bvirt = u3 - _j;
      u[2] = _j - (u3 - bvirt) + (_i - bvirt);
      u[3] = u3;
      const C2len = sum(C1len, C1, 4, u, C2);
      s1 = acxtail * bcytail;
      c = splitter * acxtail;
      ahi = c - (c - acxtail);
      alo = acxtail - ahi;
      c = splitter * bcytail;
      bhi = c - (c - bcytail);
      blo = bcytail - bhi;
      s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
      t1 = acytail * bcxtail;
      c = splitter * acytail;
      ahi = c - (c - acytail);
      alo = acytail - ahi;
      c = splitter * bcxtail;
      bhi = c - (c - bcxtail);
      blo = bcxtail - bhi;
      t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
      _i = s0 - t0;
      bvirt = s0 - _i;
      u[0] = s0 - (_i + bvirt) + (bvirt - t0);
      _j = s1 + _i;
      bvirt = _j - s1;
      _0 = s1 - (_j - bvirt) + (_i - bvirt);
      _i = _0 - t1;
      bvirt = _0 - _i;
      u[1] = _0 - (_i + bvirt) + (bvirt - t1);
      u3 = _j + _i;
      bvirt = u3 - _j;
      u[2] = _j - (u3 - bvirt) + (_i - bvirt);
      u[3] = u3;
      const Dlen = sum(C2len, C2, 4, u, D);
      return D[Dlen - 1];
    }
    function orient2d(ax, ay, bx, by, cx, cy) {
      const detleft = (ay - cy) * (bx - cx);
      const detright = (ax - cx) * (by - cy);
      const det = detleft - detright;
      const detsum = Math.abs(detleft + detright);
      if (Math.abs(det) >= ccwerrboundA * detsum) return det;
      return -orient2dadapt(ax, ay, bx, by, cx, cy, detsum);
    }

    /* Cross Product of two vectors with first point at origin */
    const crossProduct = (a, b) => a.x * b.y - a.y * b.x;

    /* Dot Product of two vectors with first point at origin */
    const dotProduct = (a, b) => a.x * b.x + a.y * b.y;

    /* Comparator for two vectors with same starting point */
    const compareVectorAngles = (basePt, endPt1, endPt2) => {
      const res = orient2d(basePt.x, basePt.y, endPt1.x, endPt1.y, endPt2.x, endPt2.y);
      if (res > 0) return -1;
      if (res < 0) return 1;
      return 0;
    };
    const length = v => Math.sqrt(dotProduct(v, v));

    /* Get the sine of the angle from pShared -> pAngle to pShaed -> pBase */
    const sineOfAngle = (pShared, pBase, pAngle) => {
      const vBase = {
        x: pBase.x - pShared.x,
        y: pBase.y - pShared.y
      };
      const vAngle = {
        x: pAngle.x - pShared.x,
        y: pAngle.y - pShared.y
      };
      return crossProduct(vAngle, vBase) / length(vAngle) / length(vBase);
    };

    /* Get the cosine of the angle from pShared -> pAngle to pShaed -> pBase */
    const cosineOfAngle = (pShared, pBase, pAngle) => {
      const vBase = {
        x: pBase.x - pShared.x,
        y: pBase.y - pShared.y
      };
      const vAngle = {
        x: pAngle.x - pShared.x,
        y: pAngle.y - pShared.y
      };
      return dotProduct(vAngle, vBase) / length(vAngle) / length(vBase);
    };

    /* Get the x coordinate where the given line (defined by a point and vector)
     * crosses the horizontal line with the given y coordiante.
     * In the case of parrallel lines (including overlapping ones) returns null. */
    const horizontalIntersection = (pt, v, y) => {
      if (v.y === 0) return null;
      return {
        x: pt.x + v.x / v.y * (y - pt.y),
        y: y
      };
    };

    /* Get the y coordinate where the given line (defined by a point and vector)
     * crosses the vertical line with the given x coordiante.
     * In the case of parrallel lines (including overlapping ones) returns null. */
    const verticalIntersection = (pt, v, x) => {
      if (v.x === 0) return null;
      return {
        x: x,
        y: pt.y + v.y / v.x * (x - pt.x)
      };
    };

    /* Get the intersection of two lines, each defined by a base point and a vector.
     * In the case of parrallel lines (including overlapping ones) returns null. */
    const intersection$1 = (pt1, v1, pt2, v2) => {
      // take some shortcuts for vertical and horizontal lines
      // this also ensures we don't calculate an intersection and then discover
      // it's actually outside the bounding box of the line
      if (v1.x === 0) return verticalIntersection(pt2, v2, pt1.x);
      if (v2.x === 0) return verticalIntersection(pt1, v1, pt2.x);
      if (v1.y === 0) return horizontalIntersection(pt2, v2, pt1.y);
      if (v2.y === 0) return horizontalIntersection(pt1, v1, pt2.y);

      // General case for non-overlapping segments.
      // This algorithm is based on Schneider and Eberly.
      // http://www.cimec.org.ar/~ncalvo/Schneider_Eberly.pdf - pg 244

      const kross = crossProduct(v1, v2);
      if (kross == 0) return null;
      const ve = {
        x: pt2.x - pt1.x,
        y: pt2.y - pt1.y
      };
      const d1 = crossProduct(ve, v1) / kross;
      const d2 = crossProduct(ve, v2) / kross;

      // take the average of the two calculations to minimize rounding error
      const x1 = pt1.x + d2 * v1.x,
        x2 = pt2.x + d1 * v2.x;
      const y1 = pt1.y + d2 * v1.y,
        y2 = pt2.y + d1 * v2.y;
      const x = (x1 + x2) / 2;
      const y = (y1 + y2) / 2;
      return {
        x: x,
        y: y
      };
    };

    class SweepEvent {
      // for ordering sweep events in the sweep event queue
      static compare(a, b) {
        // favor event with a point that the sweep line hits first
        const ptCmp = SweepEvent.comparePoints(a.point, b.point);
        if (ptCmp !== 0) return ptCmp;

        // the points are the same, so link them if needed
        if (a.point !== b.point) a.link(b);

        // favor right events over left
        if (a.isLeft !== b.isLeft) return a.isLeft ? 1 : -1;

        // we have two matching left or right endpoints
        // ordering of this case is the same as for their segments
        return Segment.compare(a.segment, b.segment);
      }

      // for ordering points in sweep line order
      static comparePoints(aPt, bPt) {
        if (aPt.x < bPt.x) return -1;
        if (aPt.x > bPt.x) return 1;
        if (aPt.y < bPt.y) return -1;
        if (aPt.y > bPt.y) return 1;
        return 0;
      }

      // Warning: 'point' input will be modified and re-used (for performance)
      constructor(point, isLeft) {
        if (point.events === undefined) point.events = [this];else point.events.push(this);
        this.point = point;
        this.isLeft = isLeft;
        // this.segment, this.otherSE set by factory
      }
      link(other) {
        if (other.point === this.point) {
          throw new Error("Tried to link already linked events");
        }
        const otherEvents = other.point.events;
        for (let i = 0, iMax = otherEvents.length; i < iMax; i++) {
          const evt = otherEvents[i];
          this.point.events.push(evt);
          evt.point = this.point;
        }
        this.checkForConsuming();
      }

      /* Do a pass over our linked events and check to see if any pair
       * of segments match, and should be consumed. */
      checkForConsuming() {
        // FIXME: The loops in this method run O(n^2) => no good.
        //        Maintain little ordered sweep event trees?
        //        Can we maintaining an ordering that avoids the need
        //        for the re-sorting with getLeftmostComparator in geom-out?

        // Compare each pair of events to see if other events also match
        const numEvents = this.point.events.length;
        for (let i = 0; i < numEvents; i++) {
          const evt1 = this.point.events[i];
          if (evt1.segment.consumedBy !== undefined) continue;
          for (let j = i + 1; j < numEvents; j++) {
            const evt2 = this.point.events[j];
            if (evt2.consumedBy !== undefined) continue;
            if (evt1.otherSE.point.events !== evt2.otherSE.point.events) continue;
            evt1.segment.consume(evt2.segment);
          }
        }
      }
      getAvailableLinkedEvents() {
        // point.events is always of length 2 or greater
        const events = [];
        for (let i = 0, iMax = this.point.events.length; i < iMax; i++) {
          const evt = this.point.events[i];
          if (evt !== this && !evt.segment.ringOut && evt.segment.isInResult()) {
            events.push(evt);
          }
        }
        return events;
      }

      /**
       * Returns a comparator function for sorting linked events that will
       * favor the event that will give us the smallest left-side angle.
       * All ring construction starts as low as possible heading to the right,
       * so by always turning left as sharp as possible we'll get polygons
       * without uncessary loops & holes.
       *
       * The comparator function has a compute cache such that it avoids
       * re-computing already-computed values.
       */
      getLeftmostComparator(baseEvent) {
        const cache = new Map();
        const fillCache = linkedEvent => {
          const nextEvent = linkedEvent.otherSE;
          cache.set(linkedEvent, {
            sine: sineOfAngle(this.point, baseEvent.point, nextEvent.point),
            cosine: cosineOfAngle(this.point, baseEvent.point, nextEvent.point)
          });
        };
        return (a, b) => {
          if (!cache.has(a)) fillCache(a);
          if (!cache.has(b)) fillCache(b);
          const {
            sine: asine,
            cosine: acosine
          } = cache.get(a);
          const {
            sine: bsine,
            cosine: bcosine
          } = cache.get(b);

          // both on or above x-axis
          if (asine >= 0 && bsine >= 0) {
            if (acosine < bcosine) return 1;
            if (acosine > bcosine) return -1;
            return 0;
          }

          // both below x-axis
          if (asine < 0 && bsine < 0) {
            if (acosine < bcosine) return -1;
            if (acosine > bcosine) return 1;
            return 0;
          }

          // one above x-axis, one below
          if (bsine < asine) return -1;
          if (bsine > asine) return 1;
          return 0;
        };
      }
    }

    // Give segments unique ID's to get consistent sorting of
    // segments and sweep events when all else is identical
    let segmentId = 0;
    class Segment {
      /* This compare() function is for ordering segments in the sweep
       * line tree, and does so according to the following criteria:
       *
       * Consider the vertical line that lies an infinestimal step to the
       * right of the right-more of the two left endpoints of the input
       * segments. Imagine slowly moving a point up from negative infinity
       * in the increasing y direction. Which of the two segments will that
       * point intersect first? That segment comes 'before' the other one.
       *
       * If neither segment would be intersected by such a line, (if one
       * or more of the segments are vertical) then the line to be considered
       * is directly on the right-more of the two left inputs.
       */
      static compare(a, b) {
        const alx = a.leftSE.point.x;
        const blx = b.leftSE.point.x;
        const arx = a.rightSE.point.x;
        const brx = b.rightSE.point.x;

        // check if they're even in the same vertical plane
        if (brx < alx) return 1;
        if (arx < blx) return -1;
        const aly = a.leftSE.point.y;
        const bly = b.leftSE.point.y;
        const ary = a.rightSE.point.y;
        const bry = b.rightSE.point.y;

        // is left endpoint of segment B the right-more?
        if (alx < blx) {
          // are the two segments in the same horizontal plane?
          if (bly < aly && bly < ary) return 1;
          if (bly > aly && bly > ary) return -1;

          // is the B left endpoint colinear to segment A?
          const aCmpBLeft = a.comparePoint(b.leftSE.point);
          if (aCmpBLeft < 0) return 1;
          if (aCmpBLeft > 0) return -1;

          // is the A right endpoint colinear to segment B ?
          const bCmpARight = b.comparePoint(a.rightSE.point);
          if (bCmpARight !== 0) return bCmpARight;

          // colinear segments, consider the one with left-more
          // left endpoint to be first (arbitrary?)
          return -1;
        }

        // is left endpoint of segment A the right-more?
        if (alx > blx) {
          if (aly < bly && aly < bry) return -1;
          if (aly > bly && aly > bry) return 1;

          // is the A left endpoint colinear to segment B?
          const bCmpALeft = b.comparePoint(a.leftSE.point);
          if (bCmpALeft !== 0) return bCmpALeft;

          // is the B right endpoint colinear to segment A?
          const aCmpBRight = a.comparePoint(b.rightSE.point);
          if (aCmpBRight < 0) return 1;
          if (aCmpBRight > 0) return -1;

          // colinear segments, consider the one with left-more
          // left endpoint to be first (arbitrary?)
          return 1;
        }

        // if we get here, the two left endpoints are in the same
        // vertical plane, ie alx === blx

        // consider the lower left-endpoint to come first
        if (aly < bly) return -1;
        if (aly > bly) return 1;

        // left endpoints are identical
        // check for colinearity by using the left-more right endpoint

        // is the A right endpoint more left-more?
        if (arx < brx) {
          const bCmpARight = b.comparePoint(a.rightSE.point);
          if (bCmpARight !== 0) return bCmpARight;
        }

        // is the B right endpoint more left-more?
        if (arx > brx) {
          const aCmpBRight = a.comparePoint(b.rightSE.point);
          if (aCmpBRight < 0) return 1;
          if (aCmpBRight > 0) return -1;
        }
        if (arx !== brx) {
          // are these two [almost] vertical segments with opposite orientation?
          // if so, the one with the lower right endpoint comes first
          const ay = ary - aly;
          const ax = arx - alx;
          const by = bry - bly;
          const bx = brx - blx;
          if (ay > ax && by < bx) return 1;
          if (ay < ax && by > bx) return -1;
        }

        // we have colinear segments with matching orientation
        // consider the one with more left-more right endpoint to be first
        if (arx > brx) return 1;
        if (arx < brx) return -1;

        // if we get here, two two right endpoints are in the same
        // vertical plane, ie arx === brx

        // consider the lower right-endpoint to come first
        if (ary < bry) return -1;
        if (ary > bry) return 1;

        // right endpoints identical as well, so the segments are idential
        // fall back on creation order as consistent tie-breaker
        if (a.id < b.id) return -1;
        if (a.id > b.id) return 1;

        // identical segment, ie a === b
        return 0;
      }

      /* Warning: a reference to ringWindings input will be stored,
       *  and possibly will be later modified */
      constructor(leftSE, rightSE, rings, windings) {
        this.id = ++segmentId;
        this.leftSE = leftSE;
        leftSE.segment = this;
        leftSE.otherSE = rightSE;
        this.rightSE = rightSE;
        rightSE.segment = this;
        rightSE.otherSE = leftSE;
        this.rings = rings;
        this.windings = windings;
        // left unset for performance, set later in algorithm
        // this.ringOut, this.consumedBy, this.prev
      }
      static fromRing(pt1, pt2, ring) {
        let leftPt, rightPt, winding;

        // ordering the two points according to sweep line ordering
        const cmpPts = SweepEvent.comparePoints(pt1, pt2);
        if (cmpPts < 0) {
          leftPt = pt1;
          rightPt = pt2;
          winding = 1;
        } else if (cmpPts > 0) {
          leftPt = pt2;
          rightPt = pt1;
          winding = -1;
        } else throw new Error(`Tried to create degenerate segment at [${pt1.x}, ${pt1.y}]`);
        const leftSE = new SweepEvent(leftPt, true);
        const rightSE = new SweepEvent(rightPt, false);
        return new Segment(leftSE, rightSE, [ring], [winding]);
      }

      /* When a segment is split, the rightSE is replaced with a new sweep event */
      replaceRightSE(newRightSE) {
        this.rightSE = newRightSE;
        this.rightSE.segment = this;
        this.rightSE.otherSE = this.leftSE;
        this.leftSE.otherSE = this.rightSE;
      }
      bbox() {
        const y1 = this.leftSE.point.y;
        const y2 = this.rightSE.point.y;
        return {
          ll: {
            x: this.leftSE.point.x,
            y: y1 < y2 ? y1 : y2
          },
          ur: {
            x: this.rightSE.point.x,
            y: y1 > y2 ? y1 : y2
          }
        };
      }

      /* A vector from the left point to the right */
      vector() {
        return {
          x: this.rightSE.point.x - this.leftSE.point.x,
          y: this.rightSE.point.y - this.leftSE.point.y
        };
      }
      isAnEndpoint(pt) {
        return pt.x === this.leftSE.point.x && pt.y === this.leftSE.point.y || pt.x === this.rightSE.point.x && pt.y === this.rightSE.point.y;
      }

      /* Compare this segment with a point.
       *
       * A point P is considered to be colinear to a segment if there
       * exists a distance D such that if we travel along the segment
       * from one * endpoint towards the other a distance D, we find
       * ourselves at point P.
       *
       * Return value indicates:
       *
       *   1: point lies above the segment (to the left of vertical)
       *   0: point is colinear to segment
       *  -1: point lies below the segment (to the right of vertical)
       */
      comparePoint(point) {
        if (this.isAnEndpoint(point)) return 0;
        const lPt = this.leftSE.point;
        const rPt = this.rightSE.point;
        const v = this.vector();

        // Exactly vertical segments.
        if (lPt.x === rPt.x) {
          if (point.x === lPt.x) return 0;
          return point.x < lPt.x ? 1 : -1;
        }

        // Nearly vertical segments with an intersection.
        // Check to see where a point on the line with matching Y coordinate is.
        const yDist = (point.y - lPt.y) / v.y;
        const xFromYDist = lPt.x + yDist * v.x;
        if (point.x === xFromYDist) return 0;

        // General case.
        // Check to see where a point on the line with matching X coordinate is.
        const xDist = (point.x - lPt.x) / v.x;
        const yFromXDist = lPt.y + xDist * v.y;
        if (point.y === yFromXDist) return 0;
        return point.y < yFromXDist ? -1 : 1;
      }

      /**
       * Given another segment, returns the first non-trivial intersection
       * between the two segments (in terms of sweep line ordering), if it exists.
       *
       * A 'non-trivial' intersection is one that will cause one or both of the
       * segments to be split(). As such, 'trivial' vs. 'non-trivial' intersection:
       *
       *   * endpoint of segA with endpoint of segB --> trivial
       *   * endpoint of segA with point along segB --> non-trivial
       *   * endpoint of segB with point along segA --> non-trivial
       *   * point along segA with point along segB --> non-trivial
       *
       * If no non-trivial intersection exists, return null
       * Else, return null.
       */
      getIntersection(other) {
        // If bboxes don't overlap, there can't be any intersections
        const tBbox = this.bbox();
        const oBbox = other.bbox();
        const bboxOverlap = getBboxOverlap(tBbox, oBbox);
        if (bboxOverlap === null) return null;

        // We first check to see if the endpoints can be considered intersections.
        // This will 'snap' intersections to endpoints if possible, and will
        // handle cases of colinearity.

        const tlp = this.leftSE.point;
        const trp = this.rightSE.point;
        const olp = other.leftSE.point;
        const orp = other.rightSE.point;

        // does each endpoint touch the other segment?
        // note that we restrict the 'touching' definition to only allow segments
        // to touch endpoints that lie forward from where we are in the sweep line pass
        const touchesOtherLSE = isInBbox(tBbox, olp) && this.comparePoint(olp) === 0;
        const touchesThisLSE = isInBbox(oBbox, tlp) && other.comparePoint(tlp) === 0;
        const touchesOtherRSE = isInBbox(tBbox, orp) && this.comparePoint(orp) === 0;
        const touchesThisRSE = isInBbox(oBbox, trp) && other.comparePoint(trp) === 0;

        // do left endpoints match?
        if (touchesThisLSE && touchesOtherLSE) {
          // these two cases are for colinear segments with matching left
          // endpoints, and one segment being longer than the other
          if (touchesThisRSE && !touchesOtherRSE) return trp;
          if (!touchesThisRSE && touchesOtherRSE) return orp;
          // either the two segments match exactly (two trival intersections)
          // or just on their left endpoint (one trivial intersection
          return null;
        }

        // does this left endpoint matches (other doesn't)
        if (touchesThisLSE) {
          // check for segments that just intersect on opposing endpoints
          if (touchesOtherRSE) {
            if (tlp.x === orp.x && tlp.y === orp.y) return null;
          }
          // t-intersection on left endpoint
          return tlp;
        }

        // does other left endpoint matches (this doesn't)
        if (touchesOtherLSE) {
          // check for segments that just intersect on opposing endpoints
          if (touchesThisRSE) {
            if (trp.x === olp.x && trp.y === olp.y) return null;
          }
          // t-intersection on left endpoint
          return olp;
        }

        // trivial intersection on right endpoints
        if (touchesThisRSE && touchesOtherRSE) return null;

        // t-intersections on just one right endpoint
        if (touchesThisRSE) return trp;
        if (touchesOtherRSE) return orp;

        // None of our endpoints intersect. Look for a general intersection between
        // infinite lines laid over the segments
        const pt = intersection$1(tlp, this.vector(), olp, other.vector());

        // are the segments parrallel? Note that if they were colinear with overlap,
        // they would have an endpoint intersection and that case was already handled above
        if (pt === null) return null;

        // is the intersection found between the lines not on the segments?
        if (!isInBbox(bboxOverlap, pt)) return null;

        // round the the computed point if needed
        return rounder.round(pt.x, pt.y);
      }

      /**
       * Split the given segment into multiple segments on the given points.
       *  * Each existing segment will retain its leftSE and a new rightSE will be
       *    generated for it.
       *  * A new segment will be generated which will adopt the original segment's
       *    rightSE, and a new leftSE will be generated for it.
       *  * If there are more than two points given to split on, new segments
       *    in the middle will be generated with new leftSE and rightSE's.
       *  * An array of the newly generated SweepEvents will be returned.
       *
       * Warning: input array of points is modified
       */
      split(point) {
        const newEvents = [];
        const alreadyLinked = point.events !== undefined;
        const newLeftSE = new SweepEvent(point, true);
        const newRightSE = new SweepEvent(point, false);
        const oldRightSE = this.rightSE;
        this.replaceRightSE(newRightSE);
        newEvents.push(newRightSE);
        newEvents.push(newLeftSE);
        const newSeg = new Segment(newLeftSE, oldRightSE, this.rings.slice(), this.windings.slice());

        // when splitting a nearly vertical downward-facing segment,
        // sometimes one of the resulting new segments is vertical, in which
        // case its left and right events may need to be swapped
        if (SweepEvent.comparePoints(newSeg.leftSE.point, newSeg.rightSE.point) > 0) {
          newSeg.swapEvents();
        }
        if (SweepEvent.comparePoints(this.leftSE.point, this.rightSE.point) > 0) {
          this.swapEvents();
        }

        // in the point we just used to create new sweep events with was already
        // linked to other events, we need to check if either of the affected
        // segments should be consumed
        if (alreadyLinked) {
          newLeftSE.checkForConsuming();
          newRightSE.checkForConsuming();
        }
        return newEvents;
      }

      /* Swap which event is left and right */
      swapEvents() {
        const tmpEvt = this.rightSE;
        this.rightSE = this.leftSE;
        this.leftSE = tmpEvt;
        this.leftSE.isLeft = true;
        this.rightSE.isLeft = false;
        for (let i = 0, iMax = this.windings.length; i < iMax; i++) {
          this.windings[i] *= -1;
        }
      }

      /* Consume another segment. We take their rings under our wing
       * and mark them as consumed. Use for perfectly overlapping segments */
      consume(other) {
        let consumer = this;
        let consumee = other;
        while (consumer.consumedBy) consumer = consumer.consumedBy;
        while (consumee.consumedBy) consumee = consumee.consumedBy;
        const cmp = Segment.compare(consumer, consumee);
        if (cmp === 0) return; // already consumed
        // the winner of the consumption is the earlier segment
        // according to sweep line ordering
        if (cmp > 0) {
          const tmp = consumer;
          consumer = consumee;
          consumee = tmp;
        }

        // make sure a segment doesn't consume it's prev
        if (consumer.prev === consumee) {
          const tmp = consumer;
          consumer = consumee;
          consumee = tmp;
        }
        for (let i = 0, iMax = consumee.rings.length; i < iMax; i++) {
          const ring = consumee.rings[i];
          const winding = consumee.windings[i];
          const index = consumer.rings.indexOf(ring);
          if (index === -1) {
            consumer.rings.push(ring);
            consumer.windings.push(winding);
          } else consumer.windings[index] += winding;
        }
        consumee.rings = null;
        consumee.windings = null;
        consumee.consumedBy = consumer;

        // mark sweep events consumed as to maintain ordering in sweep event queue
        consumee.leftSE.consumedBy = consumer.leftSE;
        consumee.rightSE.consumedBy = consumer.rightSE;
      }

      /* The first segment previous segment chain that is in the result */
      prevInResult() {
        if (this._prevInResult !== undefined) return this._prevInResult;
        if (!this.prev) this._prevInResult = null;else if (this.prev.isInResult()) this._prevInResult = this.prev;else this._prevInResult = this.prev.prevInResult();
        return this._prevInResult;
      }
      beforeState() {
        if (this._beforeState !== undefined) return this._beforeState;
        if (!this.prev) this._beforeState = {
          rings: [],
          windings: [],
          multiPolys: []
        };else {
          const seg = this.prev.consumedBy || this.prev;
          this._beforeState = seg.afterState();
        }
        return this._beforeState;
      }
      afterState() {
        if (this._afterState !== undefined) return this._afterState;
        const beforeState = this.beforeState();
        this._afterState = {
          rings: beforeState.rings.slice(0),
          windings: beforeState.windings.slice(0),
          multiPolys: []
        };
        const ringsAfter = this._afterState.rings;
        const windingsAfter = this._afterState.windings;
        const mpsAfter = this._afterState.multiPolys;

        // calculate ringsAfter, windingsAfter
        for (let i = 0, iMax = this.rings.length; i < iMax; i++) {
          const ring = this.rings[i];
          const winding = this.windings[i];
          const index = ringsAfter.indexOf(ring);
          if (index === -1) {
            ringsAfter.push(ring);
            windingsAfter.push(winding);
          } else windingsAfter[index] += winding;
        }

        // calcualte polysAfter
        const polysAfter = [];
        const polysExclude = [];
        for (let i = 0, iMax = ringsAfter.length; i < iMax; i++) {
          if (windingsAfter[i] === 0) continue; // non-zero rule
          const ring = ringsAfter[i];
          const poly = ring.poly;
          if (polysExclude.indexOf(poly) !== -1) continue;
          if (ring.isExterior) polysAfter.push(poly);else {
            if (polysExclude.indexOf(poly) === -1) polysExclude.push(poly);
            const index = polysAfter.indexOf(ring.poly);
            if (index !== -1) polysAfter.splice(index, 1);
          }
        }

        // calculate multiPolysAfter
        for (let i = 0, iMax = polysAfter.length; i < iMax; i++) {
          const mp = polysAfter[i].multiPoly;
          if (mpsAfter.indexOf(mp) === -1) mpsAfter.push(mp);
        }
        return this._afterState;
      }

      /* Is this segment part of the final result? */
      isInResult() {
        // if we've been consumed, we're not in the result
        if (this.consumedBy) return false;
        if (this._isInResult !== undefined) return this._isInResult;
        const mpsBefore = this.beforeState().multiPolys;
        const mpsAfter = this.afterState().multiPolys;
        switch (operation.type) {
          case "union":
            {
              // UNION - included iff:
              //  * On one side of us there is 0 poly interiors AND
              //  * On the other side there is 1 or more.
              const noBefores = mpsBefore.length === 0;
              const noAfters = mpsAfter.length === 0;
              this._isInResult = noBefores !== noAfters;
              break;
            }
          case "intersection":
            {
              // INTERSECTION - included iff:
              //  * on one side of us all multipolys are rep. with poly interiors AND
              //  * on the other side of us, not all multipolys are repsented
              //    with poly interiors
              let least;
              let most;
              if (mpsBefore.length < mpsAfter.length) {
                least = mpsBefore.length;
                most = mpsAfter.length;
              } else {
                least = mpsAfter.length;
                most = mpsBefore.length;
              }
              this._isInResult = most === operation.numMultiPolys && least < most;
              break;
            }
          case "xor":
            {
              // XOR - included iff:
              //  * the difference between the number of multipolys represented
              //    with poly interiors on our two sides is an odd number
              const diff = Math.abs(mpsBefore.length - mpsAfter.length);
              this._isInResult = diff % 2 === 1;
              break;
            }
          case "difference":
            {
              // DIFFERENCE included iff:
              //  * on exactly one side, we have just the subject
              const isJustSubject = mps => mps.length === 1 && mps[0].isSubject;
              this._isInResult = isJustSubject(mpsBefore) !== isJustSubject(mpsAfter);
              break;
            }
          default:
            throw new Error(`Unrecognized operation type found ${operation.type}`);
        }
        return this._isInResult;
      }
    }

    class RingIn {
      constructor(geomRing, poly, isExterior) {
        if (!Array.isArray(geomRing) || geomRing.length === 0) {
          throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
        }
        this.poly = poly;
        this.isExterior = isExterior;
        this.segments = [];
        if (typeof geomRing[0][0] !== "number" || typeof geomRing[0][1] !== "number") {
          throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
        }
        const firstPoint = rounder.round(geomRing[0][0], geomRing[0][1]);
        this.bbox = {
          ll: {
            x: firstPoint.x,
            y: firstPoint.y
          },
          ur: {
            x: firstPoint.x,
            y: firstPoint.y
          }
        };
        let prevPoint = firstPoint;
        for (let i = 1, iMax = geomRing.length; i < iMax; i++) {
          if (typeof geomRing[i][0] !== "number" || typeof geomRing[i][1] !== "number") {
            throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
          }
          let point = rounder.round(geomRing[i][0], geomRing[i][1]);
          // skip repeated points
          if (point.x === prevPoint.x && point.y === prevPoint.y) continue;
          this.segments.push(Segment.fromRing(prevPoint, point, this));
          if (point.x < this.bbox.ll.x) this.bbox.ll.x = point.x;
          if (point.y < this.bbox.ll.y) this.bbox.ll.y = point.y;
          if (point.x > this.bbox.ur.x) this.bbox.ur.x = point.x;
          if (point.y > this.bbox.ur.y) this.bbox.ur.y = point.y;
          prevPoint = point;
        }
        // add segment from last to first if last is not the same as first
        if (firstPoint.x !== prevPoint.x || firstPoint.y !== prevPoint.y) {
          this.segments.push(Segment.fromRing(prevPoint, firstPoint, this));
        }
      }
      getSweepEvents() {
        const sweepEvents = [];
        for (let i = 0, iMax = this.segments.length; i < iMax; i++) {
          const segment = this.segments[i];
          sweepEvents.push(segment.leftSE);
          sweepEvents.push(segment.rightSE);
        }
        return sweepEvents;
      }
    }
    class PolyIn {
      constructor(geomPoly, multiPoly) {
        if (!Array.isArray(geomPoly)) {
          throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
        }
        this.exteriorRing = new RingIn(geomPoly[0], this, true);
        // copy by value
        this.bbox = {
          ll: {
            x: this.exteriorRing.bbox.ll.x,
            y: this.exteriorRing.bbox.ll.y
          },
          ur: {
            x: this.exteriorRing.bbox.ur.x,
            y: this.exteriorRing.bbox.ur.y
          }
        };
        this.interiorRings = [];
        for (let i = 1, iMax = geomPoly.length; i < iMax; i++) {
          const ring = new RingIn(geomPoly[i], this, false);
          if (ring.bbox.ll.x < this.bbox.ll.x) this.bbox.ll.x = ring.bbox.ll.x;
          if (ring.bbox.ll.y < this.bbox.ll.y) this.bbox.ll.y = ring.bbox.ll.y;
          if (ring.bbox.ur.x > this.bbox.ur.x) this.bbox.ur.x = ring.bbox.ur.x;
          if (ring.bbox.ur.y > this.bbox.ur.y) this.bbox.ur.y = ring.bbox.ur.y;
          this.interiorRings.push(ring);
        }
        this.multiPoly = multiPoly;
      }
      getSweepEvents() {
        const sweepEvents = this.exteriorRing.getSweepEvents();
        for (let i = 0, iMax = this.interiorRings.length; i < iMax; i++) {
          const ringSweepEvents = this.interiorRings[i].getSweepEvents();
          for (let j = 0, jMax = ringSweepEvents.length; j < jMax; j++) {
            sweepEvents.push(ringSweepEvents[j]);
          }
        }
        return sweepEvents;
      }
    }
    class MultiPolyIn {
      constructor(geom, isSubject) {
        if (!Array.isArray(geom)) {
          throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
        }
        try {
          // if the input looks like a polygon, convert it to a multipolygon
          if (typeof geom[0][0][0] === "number") geom = [geom];
        } catch (ex) {
          // The input is either malformed or has empty arrays.
          // In either case, it will be handled later on.
        }
        this.polys = [];
        this.bbox = {
          ll: {
            x: Number.POSITIVE_INFINITY,
            y: Number.POSITIVE_INFINITY
          },
          ur: {
            x: Number.NEGATIVE_INFINITY,
            y: Number.NEGATIVE_INFINITY
          }
        };
        for (let i = 0, iMax = geom.length; i < iMax; i++) {
          const poly = new PolyIn(geom[i], this);
          if (poly.bbox.ll.x < this.bbox.ll.x) this.bbox.ll.x = poly.bbox.ll.x;
          if (poly.bbox.ll.y < this.bbox.ll.y) this.bbox.ll.y = poly.bbox.ll.y;
          if (poly.bbox.ur.x > this.bbox.ur.x) this.bbox.ur.x = poly.bbox.ur.x;
          if (poly.bbox.ur.y > this.bbox.ur.y) this.bbox.ur.y = poly.bbox.ur.y;
          this.polys.push(poly);
        }
        this.isSubject = isSubject;
      }
      getSweepEvents() {
        const sweepEvents = [];
        for (let i = 0, iMax = this.polys.length; i < iMax; i++) {
          const polySweepEvents = this.polys[i].getSweepEvents();
          for (let j = 0, jMax = polySweepEvents.length; j < jMax; j++) {
            sweepEvents.push(polySweepEvents[j]);
          }
        }
        return sweepEvents;
      }
    }

    class RingOut {
      /* Given the segments from the sweep line pass, compute & return a series
       * of closed rings from all the segments marked to be part of the result */
      static factory(allSegments) {
        const ringsOut = [];
        for (let i = 0, iMax = allSegments.length; i < iMax; i++) {
          const segment = allSegments[i];
          if (!segment.isInResult() || segment.ringOut) continue;
          let prevEvent = null;
          let event = segment.leftSE;
          let nextEvent = segment.rightSE;
          const events = [event];
          const startingPoint = event.point;
          const intersectionLEs = [];

          /* Walk the chain of linked events to form a closed ring */
          while (true) {
            prevEvent = event;
            event = nextEvent;
            events.push(event);

            /* Is the ring complete? */
            if (event.point === startingPoint) break;
            while (true) {
              const availableLEs = event.getAvailableLinkedEvents();

              /* Did we hit a dead end? This shouldn't happen.
               * Indicates some earlier part of the algorithm malfunctioned. */
              if (availableLEs.length === 0) {
                const firstPt = events[0].point;
                const lastPt = events[events.length - 1].point;
                throw new Error(`Unable to complete output ring starting at [${firstPt.x},` + ` ${firstPt.y}]. Last matching segment found ends at` + ` [${lastPt.x}, ${lastPt.y}].`);
              }

              /* Only one way to go, so cotinue on the path */
              if (availableLEs.length === 1) {
                nextEvent = availableLEs[0].otherSE;
                break;
              }

              /* We must have an intersection. Check for a completed loop */
              let indexLE = null;
              for (let j = 0, jMax = intersectionLEs.length; j < jMax; j++) {
                if (intersectionLEs[j].point === event.point) {
                  indexLE = j;
                  break;
                }
              }
              /* Found a completed loop. Cut that off and make a ring */
              if (indexLE !== null) {
                const intersectionLE = intersectionLEs.splice(indexLE)[0];
                const ringEvents = events.splice(intersectionLE.index);
                ringEvents.unshift(ringEvents[0].otherSE);
                ringsOut.push(new RingOut(ringEvents.reverse()));
                continue;
              }
              /* register the intersection */
              intersectionLEs.push({
                index: events.length,
                point: event.point
              });
              /* Choose the left-most option to continue the walk */
              const comparator = event.getLeftmostComparator(prevEvent);
              nextEvent = availableLEs.sort(comparator)[0].otherSE;
              break;
            }
          }
          ringsOut.push(new RingOut(events));
        }
        return ringsOut;
      }
      constructor(events) {
        this.events = events;
        for (let i = 0, iMax = events.length; i < iMax; i++) {
          events[i].segment.ringOut = this;
        }
        this.poly = null;
      }
      getGeom() {
        // Remove superfluous points (ie extra points along a straight line),
        let prevPt = this.events[0].point;
        const points = [prevPt];
        for (let i = 1, iMax = this.events.length - 1; i < iMax; i++) {
          const pt = this.events[i].point;
          const nextPt = this.events[i + 1].point;
          if (compareVectorAngles(pt, prevPt, nextPt) === 0) continue;
          points.push(pt);
          prevPt = pt;
        }

        // ring was all (within rounding error of angle calc) colinear points
        if (points.length === 1) return null;

        // check if the starting point is necessary
        const pt = points[0];
        const nextPt = points[1];
        if (compareVectorAngles(pt, prevPt, nextPt) === 0) points.shift();
        points.push(points[0]);
        const step = this.isExteriorRing() ? 1 : -1;
        const iStart = this.isExteriorRing() ? 0 : points.length - 1;
        const iEnd = this.isExteriorRing() ? points.length : -1;
        const orderedPoints = [];
        for (let i = iStart; i != iEnd; i += step) orderedPoints.push([points[i].x, points[i].y]);
        return orderedPoints;
      }
      isExteriorRing() {
        if (this._isExteriorRing === undefined) {
          const enclosing = this.enclosingRing();
          this._isExteriorRing = enclosing ? !enclosing.isExteriorRing() : true;
        }
        return this._isExteriorRing;
      }
      enclosingRing() {
        if (this._enclosingRing === undefined) {
          this._enclosingRing = this._calcEnclosingRing();
        }
        return this._enclosingRing;
      }

      /* Returns the ring that encloses this one, if any */
      _calcEnclosingRing() {
        // start with the ealier sweep line event so that the prevSeg
        // chain doesn't lead us inside of a loop of ours
        let leftMostEvt = this.events[0];
        for (let i = 1, iMax = this.events.length; i < iMax; i++) {
          const evt = this.events[i];
          if (SweepEvent.compare(leftMostEvt, evt) > 0) leftMostEvt = evt;
        }
        let prevSeg = leftMostEvt.segment.prevInResult();
        let prevPrevSeg = prevSeg ? prevSeg.prevInResult() : null;
        while (true) {
          // no segment found, thus no ring can enclose us
          if (!prevSeg) return null;

          // no segments below prev segment found, thus the ring of the prev
          // segment must loop back around and enclose us
          if (!prevPrevSeg) return prevSeg.ringOut;

          // if the two segments are of different rings, the ring of the prev
          // segment must either loop around us or the ring of the prev prev
          // seg, which would make us and the ring of the prev peers
          if (prevPrevSeg.ringOut !== prevSeg.ringOut) {
            if (prevPrevSeg.ringOut.enclosingRing() !== prevSeg.ringOut) {
              return prevSeg.ringOut;
            } else return prevSeg.ringOut.enclosingRing();
          }

          // two segments are from the same ring, so this was a penisula
          // of that ring. iterate downward, keep searching
          prevSeg = prevPrevSeg.prevInResult();
          prevPrevSeg = prevSeg ? prevSeg.prevInResult() : null;
        }
      }
    }
    class PolyOut {
      constructor(exteriorRing) {
        this.exteriorRing = exteriorRing;
        exteriorRing.poly = this;
        this.interiorRings = [];
      }
      addInterior(ring) {
        this.interiorRings.push(ring);
        ring.poly = this;
      }
      getGeom() {
        const geom = [this.exteriorRing.getGeom()];
        // exterior ring was all (within rounding error of angle calc) colinear points
        if (geom[0] === null) return null;
        for (let i = 0, iMax = this.interiorRings.length; i < iMax; i++) {
          const ringGeom = this.interiorRings[i].getGeom();
          // interior ring was all (within rounding error of angle calc) colinear points
          if (ringGeom === null) continue;
          geom.push(ringGeom);
        }
        return geom;
      }
    }
    class MultiPolyOut {
      constructor(rings) {
        this.rings = rings;
        this.polys = this._composePolys(rings);
      }
      getGeom() {
        const geom = [];
        for (let i = 0, iMax = this.polys.length; i < iMax; i++) {
          const polyGeom = this.polys[i].getGeom();
          // exterior ring was all (within rounding error of angle calc) colinear points
          if (polyGeom === null) continue;
          geom.push(polyGeom);
        }
        return geom;
      }
      _composePolys(rings) {
        const polys = [];
        for (let i = 0, iMax = rings.length; i < iMax; i++) {
          const ring = rings[i];
          if (ring.poly) continue;
          if (ring.isExteriorRing()) polys.push(new PolyOut(ring));else {
            const enclosingRing = ring.enclosingRing();
            if (!enclosingRing.poly) polys.push(new PolyOut(enclosingRing));
            enclosingRing.poly.addInterior(ring);
          }
        }
        return polys;
      }
    }

    /**
     * NOTE:  We must be careful not to change any segments while
     *        they are in the SplayTree. AFAIK, there's no way to tell
     *        the tree to rebalance itself - thus before splitting
     *        a segment that's in the tree, we remove it from the tree,
     *        do the split, then re-insert it. (Even though splitting a
     *        segment *shouldn't* change its correct position in the
     *        sweep line tree, the reality is because of rounding errors,
     *        it sometimes does.)
     */

    class SweepLine {
      constructor(queue) {
        let comparator = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Segment.compare;
        this.queue = queue;
        this.tree = new Tree(comparator);
        this.segments = [];
      }
      process(event) {
        const segment = event.segment;
        const newEvents = [];

        // if we've already been consumed by another segment,
        // clean up our body parts and get out
        if (event.consumedBy) {
          if (event.isLeft) this.queue.remove(event.otherSE);else this.tree.remove(segment);
          return newEvents;
        }
        const node = event.isLeft ? this.tree.add(segment) : this.tree.find(segment);
        if (!node) throw new Error(`Unable to find segment #${segment.id} ` + `[${segment.leftSE.point.x}, ${segment.leftSE.point.y}] -> ` + `[${segment.rightSE.point.x}, ${segment.rightSE.point.y}] ` + "in SweepLine tree.");
        let prevNode = node;
        let nextNode = node;
        let prevSeg = undefined;
        let nextSeg = undefined;

        // skip consumed segments still in tree
        while (prevSeg === undefined) {
          prevNode = this.tree.prev(prevNode);
          if (prevNode === null) prevSeg = null;else if (prevNode.key.consumedBy === undefined) prevSeg = prevNode.key;
        }

        // skip consumed segments still in tree
        while (nextSeg === undefined) {
          nextNode = this.tree.next(nextNode);
          if (nextNode === null) nextSeg = null;else if (nextNode.key.consumedBy === undefined) nextSeg = nextNode.key;
        }
        if (event.isLeft) {
          // Check for intersections against the previous segment in the sweep line
          let prevMySplitter = null;
          if (prevSeg) {
            const prevInter = prevSeg.getIntersection(segment);
            if (prevInter !== null) {
              if (!segment.isAnEndpoint(prevInter)) prevMySplitter = prevInter;
              if (!prevSeg.isAnEndpoint(prevInter)) {
                const newEventsFromSplit = this._splitSafely(prevSeg, prevInter);
                for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
                  newEvents.push(newEventsFromSplit[i]);
                }
              }
            }
          }

          // Check for intersections against the next segment in the sweep line
          let nextMySplitter = null;
          if (nextSeg) {
            const nextInter = nextSeg.getIntersection(segment);
            if (nextInter !== null) {
              if (!segment.isAnEndpoint(nextInter)) nextMySplitter = nextInter;
              if (!nextSeg.isAnEndpoint(nextInter)) {
                const newEventsFromSplit = this._splitSafely(nextSeg, nextInter);
                for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
                  newEvents.push(newEventsFromSplit[i]);
                }
              }
            }
          }

          // For simplicity, even if we find more than one intersection we only
          // spilt on the 'earliest' (sweep-line style) of the intersections.
          // The other intersection will be handled in a future process().
          if (prevMySplitter !== null || nextMySplitter !== null) {
            let mySplitter = null;
            if (prevMySplitter === null) mySplitter = nextMySplitter;else if (nextMySplitter === null) mySplitter = prevMySplitter;else {
              const cmpSplitters = SweepEvent.comparePoints(prevMySplitter, nextMySplitter);
              mySplitter = cmpSplitters <= 0 ? prevMySplitter : nextMySplitter;
            }

            // Rounding errors can cause changes in ordering,
            // so remove afected segments and right sweep events before splitting
            this.queue.remove(segment.rightSE);
            newEvents.push(segment.rightSE);
            const newEventsFromSplit = segment.split(mySplitter);
            for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
              newEvents.push(newEventsFromSplit[i]);
            }
          }
          if (newEvents.length > 0) {
            // We found some intersections, so re-do the current event to
            // make sure sweep line ordering is totally consistent for later
            // use with the segment 'prev' pointers
            this.tree.remove(segment);
            newEvents.push(event);
          } else {
            // done with left event
            this.segments.push(segment);
            segment.prev = prevSeg;
          }
        } else {
          // event.isRight

          // since we're about to be removed from the sweep line, check for
          // intersections between our previous and next segments
          if (prevSeg && nextSeg) {
            const inter = prevSeg.getIntersection(nextSeg);
            if (inter !== null) {
              if (!prevSeg.isAnEndpoint(inter)) {
                const newEventsFromSplit = this._splitSafely(prevSeg, inter);
                for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
                  newEvents.push(newEventsFromSplit[i]);
                }
              }
              if (!nextSeg.isAnEndpoint(inter)) {
                const newEventsFromSplit = this._splitSafely(nextSeg, inter);
                for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
                  newEvents.push(newEventsFromSplit[i]);
                }
              }
            }
          }
          this.tree.remove(segment);
        }
        return newEvents;
      }

      /* Safely split a segment that is currently in the datastructures
       * IE - a segment other than the one that is currently being processed. */
      _splitSafely(seg, pt) {
        // Rounding errors can cause changes in ordering,
        // so remove afected segments and right sweep events before splitting
        // removeNode() doesn't work, so have re-find the seg
        // https://github.com/w8r/splay-tree/pull/5
        this.tree.remove(seg);
        const rightSE = seg.rightSE;
        this.queue.remove(rightSE);
        const newEvents = seg.split(pt);
        newEvents.push(rightSE);
        // splitting can trigger consumption
        if (seg.consumedBy === undefined) this.tree.add(seg);
        return newEvents;
      }
    }

    // Limits on iterative processes to prevent infinite loops - usually caused by floating-point math round-off errors.
    const POLYGON_CLIPPING_MAX_QUEUE_SIZE = typeof process !== "undefined" && process.env.POLYGON_CLIPPING_MAX_QUEUE_SIZE || 1000000;
    const POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS = typeof process !== "undefined" && process.env.POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS || 1000000;
    class Operation {
      run(type, geom, moreGeoms) {
        operation.type = type;
        rounder.reset();

        /* Convert inputs to MultiPoly objects */
        const multipolys = [new MultiPolyIn(geom, true)];
        for (let i = 0, iMax = moreGeoms.length; i < iMax; i++) {
          multipolys.push(new MultiPolyIn(moreGeoms[i], false));
        }
        operation.numMultiPolys = multipolys.length;

        /* BBox optimization for difference operation
         * If the bbox of a multipolygon that's part of the clipping doesn't
         * intersect the bbox of the subject at all, we can just drop that
         * multiploygon. */
        if (operation.type === "difference") {
          // in place removal
          const subject = multipolys[0];
          let i = 1;
          while (i < multipolys.length) {
            if (getBboxOverlap(multipolys[i].bbox, subject.bbox) !== null) i++;else multipolys.splice(i, 1);
          }
        }

        /* BBox optimization for intersection operation
         * If we can find any pair of multipolygons whose bbox does not overlap,
         * then the result will be empty. */
        if (operation.type === "intersection") {
          // TODO: this is O(n^2) in number of polygons. By sorting the bboxes,
          //       it could be optimized to O(n * ln(n))
          for (let i = 0, iMax = multipolys.length; i < iMax; i++) {
            const mpA = multipolys[i];
            for (let j = i + 1, jMax = multipolys.length; j < jMax; j++) {
              if (getBboxOverlap(mpA.bbox, multipolys[j].bbox) === null) return [];
            }
          }
        }

        /* Put segment endpoints in a priority queue */
        const queue = new Tree(SweepEvent.compare);
        for (let i = 0, iMax = multipolys.length; i < iMax; i++) {
          const sweepEvents = multipolys[i].getSweepEvents();
          for (let j = 0, jMax = sweepEvents.length; j < jMax; j++) {
            queue.insert(sweepEvents[j]);
            if (queue.size > POLYGON_CLIPPING_MAX_QUEUE_SIZE) {
              // prevents an infinite loop, an otherwise common manifestation of bugs
              throw new Error("Infinite loop when putting segment endpoints in a priority queue " + "(queue size too big).");
            }
          }
        }

        /* Pass the sweep line over those endpoints */
        const sweepLine = new SweepLine(queue);
        let prevQueueSize = queue.size;
        let node = queue.pop();
        while (node) {
          const evt = node.key;
          if (queue.size === prevQueueSize) {
            // prevents an infinite loop, an otherwise common manifestation of bugs
            const seg = evt.segment;
            throw new Error(`Unable to pop() ${evt.isLeft ? "left" : "right"} SweepEvent ` + `[${evt.point.x}, ${evt.point.y}] from segment #${seg.id} ` + `[${seg.leftSE.point.x}, ${seg.leftSE.point.y}] -> ` + `[${seg.rightSE.point.x}, ${seg.rightSE.point.y}] from queue.`);
          }
          if (queue.size > POLYGON_CLIPPING_MAX_QUEUE_SIZE) {
            // prevents an infinite loop, an otherwise common manifestation of bugs
            throw new Error("Infinite loop when passing sweep line over endpoints " + "(queue size too big).");
          }
          if (sweepLine.segments.length > POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS) {
            // prevents an infinite loop, an otherwise common manifestation of bugs
            throw new Error("Infinite loop when passing sweep line over endpoints " + "(too many sweep line segments).");
          }
          const newEvents = sweepLine.process(evt);
          for (let i = 0, iMax = newEvents.length; i < iMax; i++) {
            const evt = newEvents[i];
            if (evt.consumedBy === undefined) queue.insert(evt);
          }
          prevQueueSize = queue.size;
          node = queue.pop();
        }

        // free some memory we don't need anymore
        rounder.reset();

        /* Collect and compile segments we're keeping into a multipolygon */
        const ringsOut = RingOut.factory(sweepLine.segments);
        const result = new MultiPolyOut(ringsOut);
        return result.getGeom();
      }
    }

    // singleton available by import
    const operation = new Operation();

    const union = function (geom) {
      for (var _len = arguments.length, moreGeoms = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        moreGeoms[_key - 1] = arguments[_key];
      }
      return operation.run("union", geom, moreGeoms);
    };
    const intersection = function (geom) {
      for (var _len2 = arguments.length, moreGeoms = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        moreGeoms[_key2 - 1] = arguments[_key2];
      }
      return operation.run("intersection", geom, moreGeoms);
    };
    const xor = function (geom) {
      for (var _len3 = arguments.length, moreGeoms = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
        moreGeoms[_key3 - 1] = arguments[_key3];
      }
      return operation.run("xor", geom, moreGeoms);
    };
    const difference = function (subjectGeom) {
      for (var _len4 = arguments.length, clippingGeoms = new Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
        clippingGeoms[_key4 - 1] = arguments[_key4];
      }
      return operation.run("difference", subjectGeom, clippingGeoms);
    };
    var index = {
      union: union,
      intersection: intersection,
      xor: xor,
      difference: difference
    };

    return index;
})();

const CLIP_SCALE = 1e6;

function flatRingToXY(flat) {
  if (!flat || flat.length < 6) return null;
  const n = flat.length / 2;
  const ring = [];
  for (let i = 0; i < n; i++) ring.push([flat[i * 2] * CLIP_SCALE, flat[i * 2 + 1] * CLIP_SCALE]);
  const clean = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    const p = ring[i], q = clean[clean.length - 1];
    if (Math.abs(p[0] - q[0]) > 1e-6 || Math.abs(p[1] - q[1]) > 1e-6) clean.push(p);
  }
  const a = clean[0], b = clean[clean.length - 1];
  if (a[0] !== b[0] || a[1] !== b[1]) clean.push([a[0], a[1]]);
  return clean.length >= 4 ? clean : null;
}
function featurePolys(f) {
  if (!f || f.type !== 'poly' || !f.parts) return [];
  const out = [];
  for (const poly of f.parts) {
    const rings = [];
    for (const ring of poly) {
      const xy = flatRingToXY(ring);
      if (xy) rings.push(xy);
    }
    if (rings.length) out.push(rings);
  }
  return out;
}
function xyToFlat(ring) {
  const flat = new Float64Array(ring.length * 2);
  for (let i = 0; i < ring.length; i++) {
    flat[i * 2] = ring[i][0] / CLIP_SCALE;
    flat[i * 2 + 1] = ring[i][1] / CLIP_SCALE;
  }
  return flat;
}
function multiToParts(multi) {
  if (!multi || !multi.length) return [];
  const parts = [];
  for (const poly of multi) {
    if (!poly || !poly.length) continue;
    const rings = poly.map(xyToFlat).filter((r) => r.length >= 6);
    if (rings.length) parts.push(rings);
  }
  return parts;
}
// op: 'union' | 'intersection' | 'difference'. Returns polygon parts [[[ring, hole?]]].
export function polygonBoolean(features, op = 'intersection') {
  const geoms = (features || []).map(featurePolys).filter((g) => g.length);
  if (!geoms.length) return [];
  if (geoms.length === 1 && op !== 'difference') return multiToParts(geoms[0]);
  let acc = geoms[0];
  try {
    if (op === 'union') {
      for (let i = 1; i < geoms.length; i++) acc = polygonClipping.union(acc, geoms[i]);
    } else if (op === 'difference') {
      for (let i = 1; i < geoms.length; i++) acc = polygonClipping.difference(acc, geoms[i]);
    } else {
      for (let i = 1; i < geoms.length; i++) acc = polygonClipping.intersection(acc, geoms[i]);
    }
  } catch {
    return [];
  }
  return multiToParts(acc);
}
export function partsBBox(parts) {
  return clipBB(parts.flat());
}

function eachSegment(f, fn) {
  if (!f) return;
  if (f.type === 'point') {
    for (let i = 0; i < f.parts.length; i += 2) fn(f.parts[i], f.parts[i + 1], f.parts[i], f.parts[i + 1]);
    return;
  }
  const rings = f.type === 'line' ? f.parts : (f.parts || []).flat();
  for (const ring of rings) {
    if (!ring || ring.length < 4) continue;
    const n = ring.length;
    const closed = f.type === 'poly' || (ring[0] === ring[n - 2] && ring[1] === ring[n - 1]);
    const limit = closed ? n : n - 2;
    for (let i = 0; i < limit; i += 2) {
      const j = (i + 2) % n;
      fn(ring[i], ring[i + 1], ring[j], ring[j + 1]);
    }
  }
}
function vertexInside(host, guest) {
  if (!host || host.type !== 'poly' || !guest) return false;
  if (guest.type === 'point') {
    for (let i = 0; i < guest.parts.length; i += 2) {
      const x = guest.parts[i], y = guest.parts[i + 1];
      if (x < host.bb[0] || x > host.bb[2] || y < host.bb[1] || y > host.bb[3]) continue;
      for (const poly of host.parts) if (pip2(x, y, poly)) return true;
    }
    return false;
  }
  const rings = guest.type === 'line' ? guest.parts : (guest.parts || []).flat();
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i += 2) {
      const x = ring[i], y = ring[i + 1];
      if (x < host.bb[0] || x > host.bb[2] || y < host.bb[1] || y > host.bb[3]) continue;
      for (const poly of host.parts) if (pip2(x, y, poly)) return true;
    }
  }
  return false;
}
// Ground distance in km between two features. 0 when they touch, cross or one contains the other.
function featureClosest(a, b) {
  const none = { km: Infinity, ax: 0, ay: 0, bx: 0, by: 0 };
  if (!a || !b || !a.bb || !b.bb) return none;
  if (a.type === 'poly' && vertexInside(a, b)) {
    const [x, y] = b.type === 'point' ? [b.parts[0], b.parts[1]] : [b.bb[0], b.bb[1]];
    return { km: 0, ax: x, ay: y, bx: x, by: y };
  }
  if (b.type === 'poly' && vertexInside(b, a)) {
    const [x, y] = a.type === 'point' ? [a.parts[0], a.parts[1]] : [a.bb[0], a.bb[1]];
    return { km: 0, ax: x, ay: y, bx: x, by: y };
  }
  let best = none;
  eachSegment(a, (ax, ay, bx, by) => {
    eachSegment(b, (cx, cy, dx, dy) => {
      if (segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy)) {
        best = { km: 0, ax, ay, bx: cx, by: cy };
        return;
      }
      const d1 = distToSegmentMerc(ax, ay, cx, cy, dx, dy);
      if (d1 < best.km) best = { km: d1, ax, ay, bx: cx, by: cy };
      if (ax !== bx || ay !== by) {
        const d2 = distToSegmentMerc(cx, cy, ax, ay, bx, by);
        if (d2 < best.km) best = { km: d2, ax, ay, bx: cx, by: cy };
      }
    });
  });
  return best;
}
export function featureDistanceKm(a, b) { return featureClosest(a, b).km; }
export function featureClosestKm(a, b) { return featureClosest(a, b); }

// ------------------------------------------------------------------ export scrubbing
// No latitude, longitude or other location coordinate may leave the app in a file.
const COORD_KEY = /(?:^|_)(?:lat|latitude|lon|lng|long|longitude|easting|northing|utm|coord|coords|coordinates|bbox|bounds|envelope|centroid|centre|center|geometry|geom|wkt|west|east|south|north|merc)(?:_|$)/i;
const COORD_TEXT = /(?:\d+(?:\.\d+)?\s*°\s*[NSEW])|(?:\b(?:lat(?:itude)?|lon(?:gitude)?|lng)\b\s*[:=]?\s*-?\d)/i;
export function isCoordinateKey(key) {
  const s = String(key || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (s === 'geometry_type' || s === 'geom_type' || s === 'kind') return false;
  if (COORD_KEY.test(s)) return true;
  if (s === 'x' || s === 'y' || s === 'z') return true;
  if (/(latitude|longitude|easting|northing|coordinate)/.test(s)) return true;
  return false;
}
export function scrubForExport(value) {
  if (value == null) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return COORD_TEXT.test(value) ? undefined : value;
  if (Array.isArray(value)) {
    if (value.length && value.every((v) => typeof v === 'number') && value.length <= 4) return undefined;
    const out = [];
    for (const item of value) {
      const next = scrubForExport(item);
      if (next !== undefined) out.push(next);
    }
    return out;
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (isCoordinateKey(k)) continue;
      const next = scrubForExport(v);
      if (next === undefined) continue;
      out[k] = next;
    }
    return out;
  }
  return undefined;
}
export function exportHasCoordinates(text) {
  const s = String(text || '');
  if (COORD_TEXT.test(s)) return true;
  if (/"[^"]*(?:latitude|longitude|easting|northing)[^"]*"\s*:/i.test(s)) return true;
  if (/(?:^|,)"?(?:lat|lon|lng|latitude|longitude|min_longitude|max_latitude)"?(?:,|$)/im.test(s)) return true;
  return false;
}
