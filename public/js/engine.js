// Small dependency-free web map engine: Web-Mercator canvas map with raster overlays, vector layers,
// XYZ basemap tiles, touch (pan + pinch), hit-testing and value sampling. No libraries, works offline.
const TAU = Math.PI * 2;
export const mercY = (lat) => { lat = Math.max(-85.05, Math.min(85.05, lat)); const s = Math.sin(lat * Math.PI / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };
export const mercX = (lon) => (lon + 180) / 360;
export const unX = (x) => x * 360 - 180;
export const unY = (y) => { const n = Math.PI - TAU * y; return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); };

export const BASEMAPS = {
  light: { label: 'Light', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', sub: 'abcd', max: 19, bg: '#e8ebee', attr: '© OpenStreetMap contributors © CARTO' },
  streets: { label: 'Streets', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', sub: 'a', max: 19, bg: '#e8e4d8', attr: '© OpenStreetMap contributors' },
  dark: { label: 'Dark', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', sub: 'abcd', max: 19, bg: '#1d2024', attr: '© OpenStreetMap contributors © CARTO' },
  none: { label: 'None', url: null, bg: '#f3f4f2', attr: '' },
};

export class GeoMap {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.cx = mercX(8.7); this.cy = mercY(9.1); this.zoom = 5.4;
    this.layers = []; this.selection = null; this.extra = []; // extra: transient overlays (measure, location)
    this.basemap = 'light'; this.tiles = new Map(); this.minZoom = 2; this.maxZoom = 19;
    this.listeners = { view: [], click: [], hover: [], layers: [] }; this._raf = 0; this._moving = false;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this._bind(); this.resize();
    new ResizeObserver(() => this.resize()).observe(document.documentElement);
  }
  on(ev, fn) { this.listeners[ev].push(fn); }
  _emit(ev, ...a) { for (const f of this.listeners[ev]) f(...a); }
  get S() { return 256 * Math.pow(2, this.zoom); }
  resize() {
    const w = window.innerWidth, h = window.innerHeight; this.W = w; this.H = h;
    this.cv.width = Math.round(w * this.dpr); this.cv.height = Math.round(h * this.dpr);
    this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px'; this.render();
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
  // ---- layers
  addLayer(l) { this.layers.push(l); this._sort(); this.render(); this._emit('layers'); return l; }
  removeLayer(id) { this.layers = this.layers.filter(l => l.id !== id); this.render(); }
  getLayer(id) { return this.layers.find(l => l.id === id); }
  _sort() {
    const rank = { raster: 0, image: 0, polygon: 1, line: 2, point: 3 };
    this.layers.sort((a, b) => (rank[a.kind] - rank[b.kind]) || ((a.order ?? 0) - (b.order ?? 0)));
  }
  setBasemap(k) { this.basemap = k; this.render(); }
  // ---- rendering
  render() { if (this._raf) return; this._raf = requestAnimationFrame(() => { this._raf = 0; this._draw(); }); }
  _draw() {
    const ctx = this.ctx, d = this.dpr; ctx.setTransform(d, 0, 0, d, 0, 0);
    const bm = BASEMAPS[this.basemap] || BASEMAPS.none;
    ctx.fillStyle = bm.bg; ctx.fillRect(0, 0, this.W, this.H);
    if (bm.url) this._drawTiles(bm);
    const tol = this._moving ? 1.6 : 0.7;
    for (const l of this.layers) {
      if (!l.visible || l.opacity <= 0) continue;
      ctx.globalAlpha = l.opacity;
      if (l.kind === 'raster' || l.kind === 'image') this._drawImage(l);
      else this._drawVector(l, tol);
    }
    ctx.globalAlpha = 1;
    if (this.selection) this._drawSelection(this.selection);
    for (const e of this.extra) e(ctx, this);
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
        t.img.onload = () => { t.ok = true; this.render(); }; t.img.onerror = () => { t.err = true; };
        t.img.src = bm.url.replace('{s}', bm.sub[(xm + y) % bm.sub.length]).replace('{z}', z).replace('{x}', xm).replace('{y}', y);
        this.tiles.set(key, t);
        if (this.tiles.size > 400) { const k = this.tiles.keys().next().value; this.tiles.delete(k); }
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
  _drawVector(l, tol) {
    const ctx = this.ctx, S = this.S, hw = this.W / 2, hh = this.H / 2, cx = this.cx, cy = this.cy;
    const st = l.style;
    if (l.kind === 'polygon') {
      ctx.lineWidth = 0.6; ctx.lineJoin = 'round';
      for (const f of l.features) {
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
        ctx.fillStyle = f.fill; ctx.globalAlpha = l.opacity * (l.fillAlpha ?? 0.72); ctx.fill('evenodd');
        ctx.globalAlpha = l.opacity * 0.55; ctx.strokeStyle = l.outline || 'rgba(30,30,30,.7)'; ctx.stroke();
      }
    } else if (l.kind === 'line') {
      ctx.lineWidth = l.width || 1.3; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const groups = new Map();
      for (const f of l.features) { const b = this._vis(f); if (!b) continue; if (b[2] - b[0] < 0.5 && b[3] - b[1] < 0.5) continue; let g = groups.get(f.stroke); if (!g) groups.set(f.stroke, g = []); g.push(f); }
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
    } else if (l.kind === 'point') {
      const many = l.features.length > 4000 && this.zoom < 8; const r = many ? 1.6 : Math.max(2.6, Math.min(5, 1.6 + (this.zoom - 5) * 0.5));
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.95)';
      const labels = [];
      for (const f of l.features) {
        const pts = f.parts; for (let i = 0; i < pts.length; i += 2) {
          const x = (pts[i] - cx) * S + hw, y = (pts[i + 1] - cy) * S + hh;
          if (x < -10 || y < -10 || x > this.W + 10 || y > this.H + 10) continue;
          ctx.fillStyle = f.fill;
          if (many) ctx.fillRect(x - r, y - r, r * 2, r * 2); else { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke(); }
          if (l.labelField && this.zoom >= (l.labelZoom ?? 8) && f.props[l.labelField] != null) labels.push([x, y, String(f.props[l.labelField])]);
        }
      }
      if (labels.length) this._drawLabels(labels);
    }
  }
  _drawLabels(labels) {
    const ctx = this.ctx; ctx.font = '600 11px system-ui,sans-serif'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = 3;
    const taken = new Set(); const dark = this.basemap === 'dark';
    for (const [x, y, t] of labels.slice(0, 1500)) {
      const k = Math.floor(x / 70) + ':' + Math.floor(y / 16); if (taken.has(k)) continue; taken.add(k);
      ctx.strokeStyle = dark ? 'rgba(0,0,0,.8)' : 'rgba(255,255,255,.9)'; ctx.fillStyle = dark ? '#fff' : '#1b1f23';
      ctx.strokeText(t, x + 7, y); ctx.fillText(t, x + 7, y);
    }
  }
  _drawSelection(sel) {
    const ctx = this.ctx, S = this.S, hw = this.W / 2, hh = this.H / 2, f = sel.feature, cx = this.cx, cy = this.cy;
    ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = '#ffd400'; ctx.fillStyle = 'rgba(255,212,0,.25)'; ctx.globalAlpha = 1; ctx.lineJoin = 'round';
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
    for (const l of [...this.layers].reverse()) {
      if (!l.visible || l.opacity <= 0) continue;
      if (l.kind === 'raster' || l.kind === 'image') {
        if (wx >= l.wb[0] && wx <= l.wb[2] && wy >= l.wb[1] && wy <= l.wb[3]) {
          if (l.kind === 'raster') { const v = this.sampleRaster(l, wx, wy); if (v != null) out.push({ layer: l, value: v }); }
        }
        continue;
      }
      const tolW = 10 / S;
      for (const f of l.features) {
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
        else { lastTap = now; lastTapX = tapX; lastTapY = tapY; setTimeout(() => { if (lastTap === now) this._emit('click', tapX, tapY); }, 330); }
      }
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = pos(e); this._moving = true; this.zoomAt(x, y, -e.deltaY * (e.ctrlKey ? 0.01 : 0.0022)); clearTimeout(this._wt); this._wt = setTimeout(() => { this._moving = false; this.render(); }, 160); }, { passive: false });
    window.addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT') return; if (e.key === '+' || e.key === '=') this.zoomAt(this.W / 2, this.H / 2, 1); if (e.key === '-') this.zoomAt(this.W / 2, this.H / 2, -1); });
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
