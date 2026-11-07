import { GeoMap, BASEMAPS, BASEMAP_ORDER, convertFeature, mercX, mercY, unX, unY, featureMetrics, haversineKm, labelAnchor, ringAreaKm2, ringPerimeterKm, pointInFeature } from './engine.js?v=a8944dbc47';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NIGERIA = [2.6, 4.2, 14.7, 13.95];
const NIGERIA_KM2 = 923769;
const ABUJA = [7.3986, 9.0765];
const PKEY = 'nwg.project.v1';
const BUILD = document.querySelector('meta[name="build"]')?.content || 'dev';

// ---------------------------------------------------------------- icons
const IC = {
  layers: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 12.5 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
  legend: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  tools: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  locate: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  home: '<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', close: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="m15 18-6-6 6-6"/>', chev: '<path d="m6 9 6 6 6-6"/>',
  ruler: '<path d="M3 17 17 3l4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>',
  area: '<path d="M4 7l7-4 9 5-3 11-10 1z"/><path d="M4 7v0"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
  zoom: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/>',
  down: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>',
  point: '<circle cx="12" cy="12" r="4.5" fill="currentColor"/>', line: '<path d="M4 18 10 8l5 6 5-9"/>',
  polygon: '<path d="M5 6l10-2 5 8-6 8-9-4z"/>', raster: '<rect x="4" y="4" width="16" height="16"/><path d="M4 12h16M12 4v16"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m21 16-5-5-8 8"/>',
  grip: '<path d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01"/>',
  grid: '<path d="M3 9h18M3 15h18M9 3v18M15 3v18"/><rect x="3" y="3" width="18" height="18" rx="2"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.6"/>',
  target: '<circle cx="12" cy="12" r="8"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="2"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.7 0 2-1.2 1.2-2.2-.9-1.1-.2-2.3 1.2-2.3H17a4 4 0 0 0 4-4c0-5.2-4-9.5-9-9.5Z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="8" r="1.2"/>',
  tag: '<path d="M20 12.5 12.5 20 3 10.5V3h7.5L20 12.5Z"/><circle cx="7.5" cy="7.5" r="1.4"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h8M16 18h4"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="14" cy="18" r="2"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.8"/>',
  eyeoff: '<path d="M4 4l16 16M10 5.5A9.6 9.6 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3.4 4.1M6.3 7.6A17 17 0 0 0 2 12s3.6 6.5 10 6.5c1.4 0 2.7-.3 3.8-.8"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5.5-5.5 2 2-5.5z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  pin: '<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
  query: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8.5 11h5M11 8.5v5"/>',
  undo: '<path d="M4 10h9a5 5 0 0 1 0 10H8"/><path d="m8 6-4 4 4 4"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  hist: '<path d="M4 20V8M9 20V4M14 20v-6M19 20v-9M2 20h20"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;
const KIND_LABEL = { point: 'Points', line: 'Lines', polygon: 'Polygons', raster: 'Raster', image: 'Picture', table: 'Table' };

// ---------------------------------------------------------------- state
const map = new GeoMap($('#map'));
let catalog = null;
const L = new Map();          // id -> { meta, on, opacity, loading, obj, sym, labels, filter, reclass, stats }
const stack = [];             // visible layer ids, bottom -> top (last switched on is on top)
let baseOrder = [];           // every layer id in list order
const expanded = new Set();
let annotations = [];         // labels placed on the map
let activeTab = 'layers', measure = null, userLoc = null, gridOn = false, editing = null, booting = true;
// Viewers get the read-only map: analysis and viewing only. Content/styling work lives behind ?author=1.
let AUTHOR = new URLSearchParams(location.search).get('author') === '1';
let draw = null;              // {kind:'rect'|'poly'|'pick', pts:[]} while the user is drawing a focus area
let clip = null;              // active focus area (mirrors map.clip)
const viewHist = [];          // previous views, for the back button
const RAMPS = {
  viridis: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'],
  blues: ['#deebf7', '#9ecae1', '#4292c6', '#2171b5', '#08306b'],
  earth: ['#f6e8c3', '#d8b365', '#8c510a', '#5ab4ac', '#01665e'],
  spectral: ['#d53e4f', '#fc8d59', '#fee08b', '#e6f598', '#3288bd'],
  warm: ['#fff7ec', '#fdd49e', '#fc8d59', '#d7301f', '#7f0000'],
  greys: ['#f7f7f7', '#cccccc', '#969696', '#525252', '#252525'],
};

function toast(msg, ms = 2800) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms); }
const fmtNum = (v) => (v == null || isNaN(v)) ? '' : Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : (+Number(v).toFixed(2)).toString();
const fmtLL = (la, lo) => `${Math.abs(la).toFixed(4)}°${la >= 0 ? 'N' : 'S'}  ${Math.abs(lo).toFixed(4)}°${lo >= 0 ? 'E' : 'W'}`;
const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const utmZone = (lon, lat) => `${Math.floor((lon + 180) / 6) + 1}${lat >= 0 ? 'N' : 'S'}`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- start
async function start() {
  for (const el of $$('[data-i]')) el.insertAdjacentHTML('afterbegin', icon(el.dataset.i));
  try {
    catalog = await (await fetch('catalog.json', { cache: 'no-cache' })).json();
  } catch (e) {
    $('#layerlist').innerHTML = '<p class="empty">Could not load catalog.json. Run the build (scripts/build_site.py) and deploy the public folder.</p>';
    openSheet('layers'); return;
  }
  if (catalog.authorMode === true) AUTHOR = true;
  document.title = catalog.title; $('#title').textContent = catalog.title;
  catalog.layers.forEach((m, i) => L.set(m.id, {
    meta: m, on: false, opacity: m.opacity ?? (m.kind === 'polygon' ? 0.85 : 1), loading: false, obj: null,
    order: i, sym: null, labels: null, filter: null, reclass: null, stats: null,
  }));
  baseOrder = catalog.layers.map((m) => m.id);
  const saved = readProject();
  if (saved) restoreProject(saved);

  buildBasemaps(); renderLayerTools(); buildTools(); buildAbout(); renderAnnotations();
  $('#layerfilter').addEventListener('input', renderLayerLists);

  const h = parseHash();
  map.setBasemap(h.b && BASEMAPS[h.b] ? h.b : (catalog.basemap in BASEMAPS ? catalog.basemap : 'light'));
  syncBasemapUI(); updateAttrib();
  if (h.c) map.setView(h.c[1], h.c[0], h.c[2]); else home(false);

  let initial;
  if (h.l) initial = h.l.filter((id) => L.has(id));
  else if (saved && saved.layers) initial = baseOrder.filter((id) => saved.layers[id] && saved.layers[id].on);
  else initial = catalog.layers.filter((m) => m.visible).map((m) => m.id);
  if (!h.l && !initial.length && !(saved && saved.layers)) {
    const p = catalog.layers.find((m) => m.kind === 'polygon') || catalog.layers.find((m) => m.kind !== 'table');
    if (p) initial = [p.id];
  }
  if (saved && Array.isArray(saved.stack) && !h.l) {
    for (const id of saved.stack) if (L.has(id)) stack.push(id);
    initial = initial.filter((id) => !stack.includes(id));
  }
  booting = false;
  renderLayerLists();
  Promise.all(initial.map((id) => setLayer(id, true, { quiet: true }))).then(() => {
    applyOrderFromStack(); renderLayerLists(); refreshLegend(); renderAnnotations();
  });

  map.on('view', onView); map.on('click', onClick);
  bindDrawPointer();
  $('#drawdone').onclick = () => { if (draw?.kind === 'poly') { const pts = draw.pts.slice(); endDraw(); focusFromLonLat(pts); } else endDraw(); };
  $('#drawclear').onclick = () => { endDraw(); toast('Focus drawing cancelled'); };
  $('#btn-full').onclick = toggleFullscreen;
  $('#leave-author')?.addEventListener('click', () => {
    const u = new URL(location.href); u.searchParams.delete('author');
    location.href = u.pathname + (u.search ? u.search : '') + u.hash;
  });
  $('#btn-back').onclick = goBack;
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && draw) { endDraw(); toast('Focus drawing cancelled'); }
  });
  if (saved && saved.clip) restoreFocus(saved.clip);
  map.on('hover', (x, y) => { const [lo, la] = map.lonlatAt(x, y); $('#coords').textContent = fmtLL(la, lo); });
  map.on('tileerror', onTileError);
  onView();
  if (matchMedia('(min-width:900px)').matches) openSheet('layers');
  setupServiceWorker();
}

// ---------------------------------------------------------------- updates
// A deploy is picked up with no cache clearing: the worker script is never taken from the HTTP cache,
// the app shell is fetched network-first, an update is checked on load / on every return to the tab /
// every 15 minutes, and when a new worker takes over the page reloads itself (work is saved first).
function setupServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!(location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) return;
  const hadController = !!navigator.serviceWorker.controller;   // false on the very first visit
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;                    // a first install must not reload the page
    reloading = true;
    saveProject();
    toast('New version — reloading…', 1600);
    setTimeout(() => location.reload(), 450);
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    const check = () => reg.update().catch(() => { });
    check();
    setTimeout(check, 6000);
    setInterval(check, 15 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    window.addEventListener('online', check);
  }).catch(() => { });
}

// hover read-out: name of the feature under the mouse (desktop only)
let hoverInfo = null, hoverTimer = 0, hoverPos = null;
map.on('hover', (x, y) => {
  if (window.matchMedia('(hover: none)').matches) return;
  hoverPos = [x, y];
  if (hoverTimer) return;
  hoverTimer = setTimeout(() => {
    hoverTimer = 0;
    if (!hoverPos) return;
    const [hx, hy] = hoverPos;
    const hit = measure ? null : map.identify(hx, hy).find((r) => r.feature);
    const next = hit ? { x: hx, y: hy, text: titleOf(hit.layer, hit.feature) } : null;
    const changed = (!!next !== !!hoverInfo) || (next && hoverInfo && next.text !== hoverInfo.text);
    hoverInfo = next;
    if (changed) map.render();
  }, 70);
});
map.cv.addEventListener('pointerleave', () => { hoverPos = null; if (hoverInfo) { hoverInfo = null; map.render(); } });
map.extraTop.push((ctx, m) => {
  if (!hoverInfo) return;
  const text = hoverInfo.text.length > 46 ? hoverInfo.text.slice(0, 45) + '…' : hoverInfo.text;
  ctx.save();
  ctx.font = '600 11.5px system-ui,sans-serif';
  const w = ctx.measureText(text).width;
  let x = hoverInfo.x + 14, y = hoverInfo.y + 16;
  if (x + w + 16 > m.W) x = m.W - w - 20;
  if (y + 22 > m.H) y = hoverInfo.y - 26;
  ctx.globalAlpha = 0.94;
  ctx.fillStyle = '#0b3d2e';
  const r = 7;
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w + 12 - r, y); ctx.quadraticCurveTo(x + w + 12, y, x + w + 12, y + r);
  ctx.lineTo(x + w + 12, y + 20 - r); ctx.quadraticCurveTo(x + w + 12, y + 20, x + w + 12 - r, y + 20);
  ctx.lineTo(x + r, y + 20); ctx.quadraticCurveTo(x, y + 20, x, y + 20 - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + 7, y + 10.5);
  ctx.restore();
});

function home() {
  const side = matchMedia('(min-width:900px)').matches ? 400 : 0;
  map.fitBounds(NIGERIA, 22);
  if (side) { map.cx -= (side / 2) / map.S; map._viewChanged(); }
}

// ---------------------------------------------------------------- basemaps
let tileWarned = false;
function onTileError(n) {
  if (n < 6 || tileWarned) return;
  tileWarned = true;
  toast('These basemap tiles are not loading. Try another basemap in Tools.', 5000);
}
function buildBasemaps() {
  const box = $('#basemaps'); box.innerHTML = '';
  for (const k of BASEMAP_ORDER) {
    const v = BASEMAPS[k]; if (!v) continue;
    const b = document.createElement('button'); b.textContent = v.label; b.dataset.k = k;
    b.onclick = () => { map.setBasemap(k); syncBasemapUI(); updateAttrib(); pushHash(); };
    box.appendChild(b);
  }
  $('#basemapnote').textContent = 'No API key needed: tiles come from key-free sources (Esri, OpenStreetMap, OpenTopoMap).';
}
function syncBasemapUI() { for (const b of $$('#basemaps button')) b.classList.toggle('on', b.dataset.k === map.basemap); }
function updateAttrib() { $('#attrib').textContent = BASEMAPS[map.basemap]?.attr || ''; }

// ---------------------------------------------------------------- layer loading
const palette = '#7a7a7a';
function styleColor(style, props) {
  if (!style) return palette;
  if (style.mode === 'color-field') { const v = props[style.field]; return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : style.color; }
  if (style.mode === 'category') return style.colors[props[style.field]] || '#9aa0a6';
  return style.color || palette;
}
function defaultSym(m) {
  const s = m.style || {};
  return {
    fillMode: 'data', fill: s.color || '#4e79a7', fillOpacity: m.kind === 'polygon' ? 0.72 : 1,
    stroke: '', strokeWidth: m.kind === 'line' ? (m.count > 8000 ? 0.9 : 1.4) : m.kind === 'point' ? 1 : 0.6,
    dash: 'solid', pointSize: 3.4, pointShape: 'circle',
  };
}
function defaultLabels(m) {
  return { field: (m.style && m.style.labelField) || m.labelField || null, size: 11, color: '', halo: true, bold: true, italic: false, minZoom: m.count > 3000 ? 10 : 8, on: true };
}
async function loadLayer(st) {
  const m = st.meta;
  if (st.obj) return st.obj;
  if (m.kind === 'polygon' || m.kind === 'line' || m.kind === 'point') {
    const gj = await (await fetch(m.file)).json();
    const feats = [];
    let i = 0;
    for (const f of gj.features) {
      const c = convertFeature(f); if (!c) continue;
      const col = styleColor(m.style, c.props);
      c.fill = col; c.stroke = col; c.fill0 = col; c.idx = i++;
      feats.push(c);
    }
    st.obj = { id: m.id, kind: m.kind, visible: false, opacity: st.opacity, order: st.order, features: feats, style: m.style, labelField: m.labelField, labels: null, sym: null };
  } else if (m.kind === 'raster' || m.kind === 'image') {
    const img = new Image(); img.decoding = 'async'; img.src = m.image;
    await img.decode().catch(() => new Promise((res, rej) => { img.onload = res; img.onerror = rej; }));
    const [w, s, e, n] = m.bounds;
    st.obj = { id: m.id, kind: m.kind, visible: false, opacity: st.opacity, order: st.order, img, wb: [mercX(w), mercY(n), mercX(e), mercY(s)], categorical: !!m.categorical, nodata: m.nodata, vals: null, classes: m.classes };
    if (m.kind === 'raster' && m.values) loadValues(st).catch(() => {});
  }
  if (!st.sym) st.sym = defaultSym(m); else st.sym = { ...defaultSym(m), ...st.sym };
  if (!st.labels) st.labels = defaultLabels(m); else st.labels = { ...defaultLabels(m), ...st.labels };
  map.addLayer(st.obj);
  applyLayerState(st);
  return st.obj;
}
async function loadValues(st) {
  const v = st.meta.values; if (!v || typeof DecompressionStream === 'undefined') return;
  const res = await fetch(v.file); const ds = res.body.pipeThrough(new DecompressionStream('gzip'));
  const buf = await new Response(ds).arrayBuffer();
  st.obj.vals = { w: v.w, h: v.h, dtype: v.dtype, data: v.dtype === 'i2' ? new Int16Array(buf) : new Float32Array(buf) };
}

function applyLayerState(st) {
  const o = st.obj; if (!o) return;
  o.opacity = st.opacity;
  o.sym = st.sym || null;
  o.labels = st.labels && st.labels.field ? st.labels : null;
  if (o.features) {
    for (const f of o.features) { f.fill = f.fill0; f.hidden = false; }
    if (st.reclass) applyReclass(st, false);
    if (st.filter) applyFilter(st, false);
  }
  map.render();
}

function rampColor(ramp, t) {
  if (!ramp.length) return '#999';
  const i = clamp(Math.floor(t * ramp.length), 0, ramp.length - 1);
  return ramp[i];
}
function breaksOf(values, n, method) {
  const v = values.slice().sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i <= n; i++) {
    if (method === 'quantile') out.push(v[clamp(Math.round((v.length - 1) * i / n), 0, v.length - 1)]);
    else out.push(v[0] + (v[v.length - 1] - v[0]) * i / n);
  }
  out[0] = v[0]; out[n] = v[v.length - 1];
  return out;
}
function applyReclass(st, rerender = true) {
  const rc = st.reclass, o = st.obj; if (!o || !o.features) return;
  if (!rc) { for (const f of o.features) f.fill = f.fill0; if (rerender) map.render(); return; }
  const vals = [];
  for (const f of o.features) { const v = +f.props[rc.field]; if (isFinite(v)) vals.push(v); }
  if (!vals.length) { toast('That field has no numbers to classify'); return; }
  rc.breaks = breaksOf(vals, rc.n, rc.method);
  const ramp = RAMPS[rc.ramp] || RAMPS.viridis;
  for (const f of o.features) {
    const v = +f.props[rc.field];
    if (!isFinite(v)) { f.fill = '#c9ced2'; continue; }
    let k = 0; while (k < rc.n - 1 && v > rc.breaks[k + 1]) k++;
    f.fill = rampColor(ramp, k / Math.max(1, rc.n - 1) + (rc.n === 1 ? 0 : 0.001));
  }
  if (rerender) { map.render(); refreshLegend(); }
}
function applyFilter(st, rerender = true) {
  const fl = st.filter, o = st.obj; if (!o || !o.features) return;
  let n = 0;
  for (const f of o.features) {
    if (!fl) { f.hidden = false; n++; continue; }
    const raw = f.props[fl.field], val = String(raw ?? ''), num = +raw;
    let hit;
    if (fl.op === 'contains') hit = val.toLowerCase().includes(String(fl.value).toLowerCase());
    else if (fl.op === 'neq') hit = val !== String(fl.value);
    else if (fl.op === 'gt') hit = num > +fl.value;
    else if (fl.op === 'lt') hit = num < +fl.value;
    else if (fl.op === 'gte') hit = num >= +fl.value;
    else if (fl.op === 'lte') hit = num <= +fl.value;
    else hit = val === String(fl.value);
    f.hidden = !hit; if (hit) n++;
  }
  st.filterCount = fl ? n : null;
  if (rerender) { map.render(); refreshLegend(); renderLayerLists(); }
}

function applyOrderFromStack() {
  stack.forEach((id, i) => { const o = L.get(id)?.obj; if (o) o.z = 10 + i; });
  map._sort(); map.render();
  const tab = $('.tab[data-tab="layers"] span');
  if (tab && catalog) tab.textContent = stack.length ? `Layers · ${stack.length}` : 'Layers';
}
async function setLayer(id, on, opts = {}) {
  const st = L.get(id); if (!st || st.meta.kind === 'table') return;
  const sw = () => $(`.lrow[data-id="${CSS.escape(id)}"] .sw`);
  if (on) {
    st.on = true;
    if (!st.obj) {
      st.loading = true; sw()?.classList.add('loading', 'on');
      try { await loadLayer(st); } catch (e) { console.error(e); toast('Could not load ' + st.meta.label); st.on = false; st.loading = false; sw()?.classList.remove('on', 'loading'); renderLayerLists(); return; }
      st.loading = false; sw()?.classList.remove('loading');
    }
    if (!st.on) return;
    st.obj.visible = true;
    applyLayerState(st);
    const i = stack.indexOf(id); if (i >= 0) stack.splice(i, 1);
    stack.push(id);
  } else {
    st.on = false;
    if (st.obj) st.obj.visible = false;
    const i = stack.indexOf(id); if (i >= 0) stack.splice(i, 1);
  }
  applyOrderFromStack();
  if (!opts.quiet) { renderLayerLists(); refreshLegend(); pushHash(); saveProject(); }
}
const isOn = (id) => !!L.get(id)?.on;

// ---------------------------------------------------------------- layer panel
function renderLayerTools() {
  $('#lyrtools').innerHTML = `
    <button data-x="showall">${icon('eye')}Show all</button>
    <button data-x="hideall">${icon('eyeoff')}Hide all</button>
    <button data-x="fitall">${icon('zoom')}Fit visible</button>
    <button data-x="focus" class="${clip ? 'on' : ''}">${icon('crop')}${clip ? 'Focused' : 'Clip'}</button>
    <button data-x="grid" class="${gridOn ? 'on' : ''}">${icon('grid')}Grid</button>
    <button data-x="labels">${icon('tag')}Labels</button>
    <button data-x="clearfilter">${icon('filter')}Clear filters</button>`;
}
function countText(m) {
  if (m.count == null) return '';
  return `${m.count.toLocaleString()} ${m.kind === 'table' ? 'rows' : m.kind === 'point' ? 'points' : 'features'}`;
}
function layerRow(id) {
  const st = L.get(id), m = st.meta, row = document.createElement('div');
  row.className = 'lrow'; row.dataset.id = id;
  if (expanded.has(id)) row.classList.add('open');
  row.dataset.search = `${m.label} ${m.group} ${m.table} ${m.description || ''}`.toLowerCase();
  const isTable = m.kind === 'table';
  const sub = [KIND_LABEL[m.kind], countText(m)].filter(Boolean).join(' · ');
  const flags = [
    st.filter ? `<span class="chip on">${icon('filter')}Filtered</span>` : '',
    st.reclass ? `<span class="chip on">${icon('sliders')}Classified</span>` : '',
    st.labels?.field && st.labels.on !== false ? `<span class="chip on">${icon('tag')}${esc(st.labels.field)}</span>` : '',
  ].join('');
  row.innerHTML = `<div class="lmain">
      <button class="grip" aria-label="Drag to reorder">${icon('grip')}</button>
      <span class="kind">${icon(m.kind)}</span>
      <button class="lt"><b>${esc(m.label)}</b><small>${esc(sub)}</small></button>
      ${isTable ? '<button class="chip" data-act="table">Open</button>' : `<button class="sw${st.on ? ' on' : ''}" role="switch" aria-checked="${st.on}" aria-label="Show layer"></button>`}
    </div>
    <div class="lopts">
      ${m.description ? `<p>${esc(m.description.length > 300 ? m.description.slice(0, 297) + '…' : m.description)}</p>` : ''}
      ${isTable ? '' : `<label>Opacity <input type="range" min="0" max="100" value="${Math.round(st.opacity * 100)}"></label>`}
      ${flags}
      <span class="chip" data-act="zoom">${icon('zoom')}Zoom to</span>
      ${isTable ? '' : `<span class="chip" data-act="sym">${icon('palette')}Symbology</span>`}
      ${isTable ? '' : `<span class="chip" data-act="labels">${icon('tag')}Labels</span>`}
      <span class="chip" data-act="table">${icon('table')}Attributes</span>
      ${m.file && m.kind !== 'table' ? `<a class="chip" href="${esc(m.file)}" download>${icon('down')}GeoJSON</a>` : ''}
      ${st.on ? `<span class="chip" data-act="off">${icon('eyeoff')}Hide</span>` : `<span class="chip" data-act="on">${icon('eye')}Show</span>`}
    </div>`;
  row.querySelector('.lt').onclick = (e) => { e.stopPropagation(); row.classList.toggle('open'); if (row.classList.contains('open')) expanded.add(id); else expanded.delete(id); };
  const sw = row.querySelector('.sw');
  if (sw) sw.onclick = (e) => { e.stopPropagation(); setLayer(id, !L.get(id).on); };
  const rg = row.querySelector('input[type=range]');
  if (rg) rg.oninput = () => { st.opacity = rg.value / 100; if (st.obj) { st.obj.opacity = st.opacity; map.render(); } };
  if (rg) rg.onchange = () => saveProject();
  row.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]'); if (!a) return;
    e.stopPropagation();
    const act = a.dataset.act;
    if (act === 'zoom') zoomToLayer(m);
    else if (act === 'table') openTable(id);
    else if (act === 'sym') toolSymbology(id);
    else if (act === 'labels') toolLabels(id);
    else if (act === 'on') setLayer(id, true);
    else if (act === 'off') setLayer(id, false);
  });
  return row;
}
function renderLayerLists() {
  const q = ($('#layerfilter').value || '').trim().toLowerCase();
  // --- on the map (topmost first; the layer clicked last is on top)
  const act = $('#activelist');
  const vis = [...stack].reverse();
  act.innerHTML = `<div class="sec">On the map <span class="n">${vis.length ? vis.length + ' layer' + (vis.length > 1 ? 's' : '') : ''}</span></div>` +
    (vis.length ? '<p class="hint">Drag ⠿ to restack — the top layer is drawn on top.</p><div class="group"><div class="lrows" id="active-rows"></div></div>'
      : '<p class="empty">Nothing on the map yet — turn a layer on below.</p>');
  const arows = $('#active-rows');
  if (arows) {
    for (const id of vis) {
      const row = layerRow(id);
      if (q && !row.dataset.search.includes(q)) row.hidden = true;
      arows.appendChild(row);
    }
    enableReorder(arows, (ids) => { stack.splice(0, stack.length, ...ids.reverse()); applyOrderFromStack(); renderLayerLists(); saveProject(); });
  }
  // --- all layers, grouped
  const root = $('#layerlist');
  root.innerHTML = '<div class="sec">All layers <span class="n">' + catalog.layers.length + '</span></div>';
  for (const g of catalog.groups) {
    const items = baseOrder.map((id) => L.get(id)).filter((st) => st && st.meta.group === g.id);
    if (!items.length) continue;
    const grp = document.createElement('div'); grp.className = 'group'; grp.dataset.group = g.id;
    grp.innerHTML = `<button class="ghead">${icon('chev')}<span>${esc(g.label)}</span><span class="n">${items.length}</span></button><div class="lrows"></div>`;
    grp.querySelector('.ghead').onclick = () => grp.classList.toggle('collapsed');
    const rows = grp.querySelector('.lrows');
    for (const st of items) {
      const row = layerRow(st.meta.id);
      if (q && !row.dataset.search.includes(q)) row.hidden = true;
      rows.appendChild(row);
    }
    if (q && !$$('.lrow:not([hidden])', rows).length) grp.hidden = true;
    root.appendChild(grp);
    enableReorder(rows, (ids) => {
      const slots = baseOrder.map((id, i) => ({ id, i })).filter((s) => ids.includes(s.id)).map((s) => s.i);
      slots.forEach((slot, k) => { baseOrder[slot] = ids[k]; });
      renderLayerLists(); saveProject();
    });
  }
  renderLayerTools();
}
function enableReorder(container, commit) {
  if (!container) return;
  container.addEventListener('pointerdown', (e) => {
    const grip = e.target.closest('.grip'); if (!grip) return;
    const row = grip.closest('.lrow'); if (!row || row.parentElement !== container) return;
    e.preventDefault(); e.stopPropagation();
    row.classList.add('dragging'); row.style.pointerEvents = 'none';
    const move = (ev) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.lrow');
      if (!el || el === row || el.parentElement !== container) return;
      const r = el.getBoundingClientRect();
      container.insertBefore(row, ev.clientY > r.top + r.height / 2 ? el.nextSibling : el);
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      row.style.pointerEvents = ''; row.classList.remove('dragging');
      commit([...container.querySelectorAll('.lrow')].map((n) => n.dataset.id));
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  });
}
function zoomToLayer(m) {
  const b = m.bounds; if (!b) { toast('No extent for this layer'); return; }
  if (!L.get(m.id).on && m.kind !== 'table') setLayer(m.id, true);
  const mobile = !matchMedia('(min-width:900px)').matches, sheetOpen = !$('#sheet').classList.contains('closed');
  map.fitBounds(b, 30, mobile && sheetOpen ? innerHeight * 0.4 : 0);
  if (!mobile) { map.cx -= 200 / map.S; map._viewChanged(); }
}

// ---------------------------------------------------------------- legend
function colorOfEntry(st, c) {
  const m = st.meta;
  if (c.color) return c.color;
  const s = m.style || {};
  if (s.mode === 'category') return s.colors?.[c.label] || s.colors?.[c.key] || '#9aa0a6';
  if (s.mode === 'color-field') {
    const hit = (s.legend || []).find(([k]) => k === c.label || k === c.key);
    return hit ? hit[1] : (s.color || palette);
  }
  if (st.obj?.features) {
    const f = st.obj.features.find((ft) => (m.legendKey ? ft.props[m.legendKey] : ft.props[s.field]) === c.key);
    if (f) return f.fill0;
  }
  return s.color || palette;
}
function legendRow(st, color, label, sub, data) {
  const attr = data ? `data-layer="${esc(st.meta.id)}" ${data}` : '';
  return `<button class="lgrow" ${attr}><span class="lgsw" style="background:${esc(color)}"></span><span class="t">${esc(label)}${sub ? `<small>${sub}</small>` : ''}</span></button>`;
}
async function refreshLegend() {
  const box = $('#legend');
  const active = [...stack].reverse().map((id) => L.get(id)).filter((st) => st.obj);
  if (!active.length) { box.innerHTML = '<p class="empty">Turn on a layer to see its legend.<br>Tap any legend entry to zoom to it, filter to it or add it to the map as a label.</p>'; return; }
  const out = [clip
    ? `<div class="lgnote">Focus area active (${fmtNum(focusAreaKm2())} km²). Counts below still describe whole layers. <button class="btn" data-x="unfocus">Show the whole map</button></div>`
    : '<p class="hint">Tap a legend entry to zoom to it, focus on it, show only that class, or add it to the map as a label.</p>'];
  for (const st of active) {
    const m = st.meta;
    let rows = '';
    if (m.kind === 'image') rows = '<div class="lgnote">Scanned map picture — no classes (use it as a background).</div>';
    else if (m.kind === 'raster') {
      if (st.reclass) rows = reclassLegend(st);
      else if (m.categorical) {
        rows = (m.classes || []).map((c) => {
          const sub = c.props ? Object.entries(c.props).filter(([k, v]) => v !== '' && v != null && k !== 'geology_unit' && k !== 'class').slice(0, 2).map(([k, v]) => `${esc(k.replace(/_/g, ' '))}: ${esc(v)}`).join(' · ') : '';
          return legendRow(st, c.color, c.label || 'Class ' + c.value, sub, `data-kind="class" data-key="${esc(c.value)}"`);
        }).join('');
      } else {
        const [a, b] = m.stretch || [m.min, m.max];
        rows = `<div class="bar" style="background:linear-gradient(90deg,${(m.ramp || RAMPS.viridis).join(',')})"></div>
          <div class="barlab"><span>${fmtNum(a)}</span><span>${esc(m.uom || '')}</span><span>${fmtNum(b)}</span></div>
          <div class="lgnote">${m.attributes ? 'Attributes: ' + m.attributes.map((a2) => esc(a2.label)).join(', ') : ''}</div>`;
      }
    } else if (st.reclass) rows = reclassLegend(st);
    else if (m.legendClasses?.length) {
      rows = m.legendClasses.map((c) => {
        const sub = c.props ? Object.entries(c.props).filter(([, v]) => v !== '' && v != null).slice(0, 2).map(([k, v]) => `${esc(k.replace(/_/g, ' '))}: ${esc(v)}`).join(' · ') : '';
        return legendRow(st, colorOfEntry(st, c), c.label, sub, `data-kind="legend" data-key="${esc(c.key)}" data-field="${esc(m.legendKey || '')}"`);
      }).join('');
    } else {
      const s = m.style || {};
      if (s.mode === 'category') {
        const e = Object.entries(s.colors);
        rows = e.map(([k, c]) => legendRow(st, c, k, '', `data-kind="style" data-key="${esc(k)}" data-field="${esc(s.field)}"`)).join('') +
          (e.length > 80 ? `<div class="lgnote">…and ${e.length - 80} more</div>` : '');
      } else if (s.mode === 'color-field') {
        const e = s.legend || [];
        rows = e.slice(0, 120).map(([k, c]) => legendRow(st, c, k, '', `data-kind="style" data-key="${esc(k)}" data-field="${esc(s.field)}"`)).join('');
      } else rows = legendRow(st, s.color || palette, m.label, '');
    }
    const n = st.filter ? `<span class="n">${st.filterCount}/${m.count} shown</span>` : '';
    out.push(`<div class="lg" data-layer="${m.id}"><button class="lghead">${icon('chev')}<span>${esc(m.label)}</span>${n}</button><div class="lgb">${rows}</div></div>`);
  }
  box.innerHTML = out.join('');
  for (const lg of $$('.lg', box)) {
    const head = lg.querySelector('.lghead');
    head.onclick = () => lg.classList.toggle('collapsed');
  }
}
function reclassLegend(st) {
  const rc = st.reclass, ramp = RAMPS[rc.ramp] || RAMPS.viridis, b = rc.breaks || [];
  let out = `<div class="lgnote">${esc(rc.field)} · ${rc.method} · ${rc.n} classes</div>`;
  for (let i = 0; i < rc.n; i++) {
    const lo = b[i] ?? '', hi = b[i + 1] ?? '';
    out += `<div class="lgrow"><span class="lgsw" style="background:${rampColor(ramp, i / Math.max(1, rc.n - 1) + 0.001)}"></span><span class="t">${fmtNum(lo)} – ${fmtNum(hi)}</span></div>`;
  }
  return out;
}
$('#legend').addEventListener('click', (e) => {
  const row = e.target.closest('.lgrow[data-layer]'); if (!row) return;
  legendEntryActions(row.dataset.layer, row.dataset.kind, row.dataset.key, row.dataset.field)
    .catch((err) => { console.error(err); toast('Could not open this legend entry'); });
});

/** centre + extent of a raster class, found in the value grid (used by legend actions) */
function rasterClassAnchor(st, value) {
  const o = st.obj; if (!o || !o.vals || !o.vals.data) return null;
  const { w, h, data, dtype } = o.vals;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, n = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const v = data[j * w + i];
    const hit = dtype === 'i2' ? (v === value) : (Math.round(v) === value);
    if (!hit) continue;
    if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; n++;
  }
  if (!n) return null;
  const [wx0, wy0, wx1, wy1] = o.wb;
  const lon = unX(wx0 + (((x0 + x1) / 2) + 0.5) / w * (wx1 - wx0));
  const lat = unY(wy0 + (((y0 + y1) / 2) + 0.5) / h * (wy1 - wy0));
  const west = unX(wx0 + (x0 / w) * (wx1 - wx0)), east = unX(wx0 + ((x1 + 1) / w) * (wx1 - wx0));
  const north = unY(wy0 + (y0 / h) * (wy1 - wy0)), south = unY(wy0 + ((y1 + 1) / h) * (wy1 - wy0));
  return { lon, lat, bbox: [west, south, east, north], count: n };
}
function featuresForClass(st, field, value) {
  if (!st.obj?.features || field == null) return [];
  return st.obj.features.filter((f) => String(f.props[field] ?? '') === String(value));
}
async function legendEntryActions(layerId, kind, key, field) {
  const st = L.get(layerId); if (!st) return;
  const m = st.meta;
  if (m.kind === 'raster' && st.obj && !st.obj.vals && m.values) { try { await loadValues(st); } catch { } }
  let entry = null;
  if (kind === 'class') entry = (m.classes || []).find((c) => String(c.value) === String(key));
  else if (kind === 'legend') entry = (m.legendClasses || []).find((c) => String(c.key) === String(key));
  if (!entry) entry = { label: key, key };
  const label = entry.label || String(key);
  const props = entry.props || {};
  const useField = field || m.legendKey || (kind === 'style' ? m.style?.field : null);
  const anchor = (() => {
    if (m.kind === 'raster') {
      const ra = rasterClassAnchor(st, +entry.value || +key);
      return ra ? { lon: ra.lon, lat: ra.lat, bbox: ra.bbox, count: ra.count } : null;
    }
    const feats = featuresForClass(st, useField, kind === 'style' ? label : entry.key);
    if (!feats.length) return null;
    let best = feats[0];
    for (const f of feats) if (f.bb[2] - f.bb[0] > best.bb[2] - best.bb[0]) best = f;
    const [x, y] = labelAnchor(best);
    return { lon: unX(x), lat: unY(y), bbox: [unX(best.bb[0]), unY(best.bb[3]), unX(best.bb[2]), unY(best.bb[1])], count: feats.length };
  })();
  openModal('Legend entry', (body) => {
    body.innerHTML = `<h4>${esc(label)}</h4>
      <p class="muted">${esc(m.label)}</p>
      ${Object.keys(props).length ? `<div class="kv">${Object.entries(props).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `<div>${esc(k.replace(/_/g, ' '))}</div><div>${esc(v)}</div>`).join('')}</div>` : ''}
      ${anchor ? `<div class="lgnote">${anchor.count.toLocaleString()} ${m.kind === 'raster' ? 'cells' : 'features'} at ${fmtLL(anchor.lat, anchor.lon)}</div>` : '<div class="lgnote">No feature of this class is on the map.</div>'}
      <h4>Use this entry</h4>
      <div class="frow act" style="justify-content:stretch">
        <button class="btn primary" id="le-zoom">${icon('zoom')} Zoom to it</button>
        ${anchor ? `<button class="btn" id="le-focus">${icon('crop')} Focus on it</button>` : ''}
      </div>
      <div class="frow act" style="justify-content:stretch">
        <button class="btn" id="le-filter">${icon('filter')} Show only this</button>
        ${AUTHOR ? `<button class="btn" id="le-label">${icon('tag')} Add label to the map</button>` : ''}
      </div>`;
    body.querySelector('#le-focus')?.addEventListener('click', () => {
      if (!anchor) return;
      closeModal();
      const bb = anchor.bbox;
      setFocus({ type: 'rect', wb: [mercX(bb[0]), mercY(bb[1]), mercX(bb[2]), mercY(bb[3])] });
      focusLabel = label;
      openSheet('layers');
      map.fitBounds(bb, 60);
    });
    body.querySelector('#le-label')?.addEventListener('click', () => {
      const [lo, la] = anchor ? [anchor.lon, anchor.lat] : map.center();
      const a = addAnnotation({ text: label, lon: lo, lat: la, size: 15, bold: true });
      closeModal();
      if (anchor) map.setView(lo, la, Math.max(map.zoom, 7));
      openLabelEditor(a);
    });
    body.querySelector('#le-zoom').onclick = () => {
      if (!anchor) { toast('This entry has no features on the map'); return; }
      closeModal(); openSheet('layers');
      map.fitBounds(anchor.bbox, 60);
      if (!mobileQ.matches) { map.cx -= 200 / map.S; map._viewChanged(); }
    };
    body.querySelector('#le-filter').onclick = () => {
      if (!anchor || !st.obj?.features) { toast('Raster classes cannot be filtered — the raster is drawn as one image'); return; }
      st.filter = { field: useField, op: 'eq', value: kind === 'style' ? label : entry.key };
      applyFilter(st); closeModal(); toast('Showing only ' + label); saveProject();
    };
  });
}

// ---------------------------------------------------------------- identify / info
function propTable(m, props) {
  const labels = Object.fromEntries((m.fields || []).map((f) => [f.name, f.label]));
  const ent = Object.entries(props).filter(([, v]) => v !== null && v !== '');
  if (!ent.length) return '<div class="rastv muted">No attributes</div>';
  return '<div class="kv">' + ent.map(([k, v]) => `<div>${esc(labels[k] || k)}</div><div>${esc(typeof v === 'number' ? fmtNum(v) : v)}</div>`).join('') + '</div>';
}
function titleOf(l, f) {
  const key = l.labelField || l.labels?.field;
  if (key && f.props[key] != null) return String(f.props[key]);
  for (const v of Object.values(f.props)) if (typeof v === 'string') return v;
  return 'Feature';
}
function layerRank(st) {
  if (st.rank) return st.rank;
  const kind = st.meta.kind;
  const metric = kind === 'polygon' ? 'area' : kind === 'line' ? 'length' : null;
  if (!metric || !st.obj?.features) return null;
  const arr = st.obj.features.map((f) => ({ idx: f.idx, v: featureMetrics(f)[metric] || 0 }));
  const sorted = arr.slice().sort((a, b) => b.v - a.v);
  const pos = new Map(); sorted.forEach((r, i) => pos.set(r.idx, i + 1));
  st.rank = { metric, sorted, pos, total: arr.reduce((s, r) => s + r.v, 0), n: arr.length, byIdx: new Map(arr.map((r) => [r.idx, r.v])) };
  return st.rank;
}
function factsHtml(st, f) {
  const m = st.meta, met = featureMetrics(f);
  const [lon, lat] = met.center;
  const rows = [];
  const push = (k, v) => { if (v !== undefined && v !== null && v !== '') rows.push(`<span>${esc(k)}</span><span>${v}</span>`); };
  const rk = layerRank(st);
  const bboxW = haversineKm([unX(f.bb[0]), unY((f.bb[1] + f.bb[3]) / 2)], [unX(f.bb[2]), unY((f.bb[1] + f.bb[3]) / 2)]);
  const bboxH = haversineKm([unX((f.bb[0] + f.bb[2]) / 2), unY(f.bb[1])], [unX((f.bb[0] + f.bb[2]) / 2), unY(f.bb[3])]);
  if (m.kind === 'polygon') {
    push('Area', `<b>${fmtNum(met.area)} km²</b> <span class="muted">(${(met.area * 100).toLocaleString(undefined, { maximumFractionDigits: 0 })} ha)</span>`);
    if (rk) {
      const p = rk.pos.get(f.idx);
      push('Rank in layer', `${ordinal(p)} largest <span class="badge">${rk.n} polygons</span>`);
      push('Share of layer', (met.area / Math.max(1e-9, rk.total) * 100).toFixed(2) + '% of ' + fmtNum(rk.total) + ' km²');
    }
    push('Share of Nigeria', (met.area / NIGERIA_KM2 * 100).toFixed(2) + '%');
    push('Edge length', fmtNum(met.perim) + ' km');
    push('Compactness', (4 * Math.PI * met.area / Math.max(1e-9, met.perim ** 2) * 100).toFixed(1) + '% of a circle');
    push('Shape', `${met.verts.toFixed(0)} vertices${met.holes ? `, ${met.holes} hole${met.holes > 1 ? 's' : ''}` : ''}`);
  } else if (m.kind === 'line') {
    push('Length', `<b>${fmtNum(met.length)} km</b>`);
    if (rk) push('Rank in layer', `${ordinal(rk.pos.get(f.idx))} longest <span class="badge">${rk.n} lines</span>`);
    push('Vertices', `${met.verts.toFixed(0)} in ${met.parts} part${met.parts > 1 ? 's' : ''}`);
  } else if (m.kind === 'point') {
    let best = Infinity;
    for (const o of st.obj.features) { if (o.idx === f.idx) continue; const om = featureMetrics(o).center; const d = haversineKm(om, met.center); if (d < best) best = d; }
    if (isFinite(best)) push('Nearest other point', fmtNum(best) + ' km');
    push('Points in layer', st.obj.features.length.toLocaleString());
  }
  push('Centre', `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(4)}°${lon >= 0 ? 'E' : 'W'}`);
  push('UTM zone', utmZone(lon, lat));
  if (m.kind !== 'point') push('Bounding box', `${fmtNum(bboxW)} × ${fmtNum(bboxH)} km`);
  push('Distance to Abuja', fmtNum(haversineKm([lon, lat], ABUJA)) + ' km');
  return rows.length ? `<div class="facts">${rows.join('')}</div>` : '';
}
async function showResults(res, lonlat) {
  const box = $('#info'); const parts = [];
  const spot = lonlat || map.center();
  if (lonlat) parts.push(`<div class="muted" style="margin:4px 0 6px">${esc(fmtLL(lonlat[1], lonlat[0]))}</div>`);
  if (clip) parts.push(`<div class="lgnote">Showing only inside the focus area (${fmtNum(focusAreaKm2())} km²). <button class="btn" data-x="unfocus">Show the whole map</button></div>`);
  for (const r of res.slice(0, 30)) {
    const st = L.get(r.layer.id); if (!st) continue;
    const m = st.meta;
    if (r.value !== undefined) {
      const cls = (m.classes || []).find((c) => c.value === r.value);
      const label = cls?.label || `Class ${r.value}`;
      const attrRows = cls?.props ? Object.entries(cls.props).filter(([, v]) => v !== '' && v != null) : [];
      parts.push(`<div class="card"><header>${icon('raster')}${esc(m.label)}<small>at this spot</small></header>
        <div class="rastv">${esc(label)} <span class="muted">(code ${esc(r.value)}${m.uom ? ' ' + esc(m.uom) : ''})</span></div>
        ${attrRows.length ? `<div class="kv">${attrRows.map(([k, v]) => `<div>${esc(k.replace(/_/g, ' '))}</div><div>${esc(typeof v === 'number' ? fmtNum(v) : v)}</div>`).join('')}</div>` : ''}
        <div class="actions"><button class="btn" data-x="rast-table" data-id="${esc(m.id)}">${icon('table')}Class table</button>
        ${AUTHOR ? `<button class="btn" data-x="rast-label" data-id="${esc(m.id)}" data-text="${esc(label)}">${icon('tag')}Add label</button>` : ''}</div></div>`);
      continue;
    }
    if (!r.feature) { parts.push(`<div class="card"><header>${icon(m.kind)}${esc(m.label)}<small>picture</small></header><div class="rastv muted">Scanned map picture</div></div>`); continue; }
    const f = r.feature;
    parts.push(`<div class="card" data-id="${esc(m.id)}" data-idx="${f.idx}">
      <header>${icon(m.kind)}${esc(titleOf(st.obj, f))}<small>${esc(KIND_LABEL[m.kind])}</small></header>
      ${propTable(m, f.props)}
      ${factsHtml(st, f)}
      <div class="actions">
        <button class="btn" data-x="zoom">${icon('zoom')}Zoom</button>
        ${AUTHOR ? `<button class="btn" data-x="label">${icon('tag')}Label</button>` : ''}
        <button class="btn" data-x="copy">${icon('copy')}Copy</button>
        <button class="btn" data-x="json">${icon('down')}JSON</button>
      </div></div>`);
  }
  box.innerHTML = parts.join('') || '<p class="empty">Tap the map to see what is there.</p>';
  box.querySelectorAll('[data-x]').forEach((b) => {
    b.onclick = () => {
      const x = b.dataset.x;
      const id = b.dataset.id;
      if (x === 'rast-table') return openTable(id);
      if (x === 'rast-label') { openLabelEditor(addAnnotation({ text: b.dataset.text, lon: spot[0], lat: spot[1], size: 15 })); return; }
      const card = b.closest('.card'), st = L.get(card.dataset.id), f = st.obj.features[+card.dataset.idx];
      if (x === 'zoom') { map.zoomToFeature(f, 80); openSheet('layers'); }
      else if (x === 'label') { const [wx, wy] = labelAnchor(f); const a = addAnnotation({ text: titleOf(st.obj, f), lon: unX(wx), lat: unY(wy), size: 15 }); openLabelEditor(a); }
      else if (x === 'copy') {
        const txt = Object.entries(f.props).map(([k, v]) => `${k}: ${v}`).join('\n');
        navigator.clipboard?.writeText(txt).then(() => toast('Attributes copied'), () => toast('Could not copy'));
      } else if (x === 'json') {
        const gj = { type: 'Feature', properties: f.props, geometry: toGeoJSON(f) };
        download('feature.json', JSON.stringify(gj, null, 1), 'application/json');
      }
    };
  });
}
function toGeoJSON(f) {
  const unring = (arr) => { const out = []; for (let i = 0; i < arr.length; i += 2) out.push([+unX(arr[i]).toFixed(6), +unY(arr[i + 1]).toFixed(6)]); return out; };
  if (f.type === 'point') return { type: 'Point', coordinates: unring(f.parts)[0] };
  if (f.type === 'line') return f.parts.length === 1 ? { type: 'LineString', coordinates: unring(f.parts[0]) } : { type: 'MultiLineString', coordinates: f.parts.map(unring) };
  const polys = f.parts.map((poly) => poly.map(unring));
  return polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys };
}
function onClick(x, y) {
  const [lo, la] = map.lonlatAt(x, y);
  if (draw?.kind === 'pick') {
    const res = map.identify(x, y);
    const hit = res.find((r) => r.feature && r.layer.kind === 'polygon');
    if (!hit) { toast('Tap inside a polygon'); return; }
    const st = L.get(hit.layer.id), mode = draw.mode, pid = draw.pid, lid = draw.lid;
    endDraw();
    const poly = { layer: hit.layer.id, kind: 'poly', f: hit.feature };
    if (mode === 'focus') { focusFromFeature(poly.f, st?.meta.label); toast(`Focused on ${st?.meta.label || 'the polygon'}`); }
    else runQuery(poly, lid || pid);
    return;
  }
  if (draw?.kind === 'poly') {
    draw.pts.push([lo, la]);
    drawPreview();
    $('#drawtext').textContent = `${draw.pts.length} corner${draw.pts.length === 1 ? '' : 's'} — tap Done to close`;
    return;
  }
  if (measure) { measure.pts.push([lo, la]); updateMeasure(); return; }
  if (!stack.length) { toast('Turn a layer on, then tap the map'); return; }
  const res = map.identify(x, y);
  const feat = res.find((r) => r.feature);
  map.selection = feat ? { feature: feat.feature, layer: feat.layer } : null; map.render();
  if (!res.length) {
    if (clip) {
      toast('That spot is outside the focus area');
      $('#info').innerHTML = `<p class="empty">That point is outside the focus area, so nothing is shown there.</p><div class="aoi"><button class="btn" data-x="unfocus">Clear the focus area</button></div>`;
    } else {
      toast('Nothing found at this spot');
      $('#info').innerHTML = '<p class="empty">Nothing found there. Try another spot.</p>';
    }
    return;
  }
  showResults(res, [lo, la]); openSheet('info', true);
}

// ---------------------------------------------------------------- labels on the map
let labelSeq = 0;
function addAnnotation(o) {
  const a = { id: 'l' + (++labelSeq) + '_' + Date.now().toString(36), size: 15, color: '', halo: true, bold: true, italic: false, rot: 0, ...o };
  annotations.push(a); map.render(); renderAnnotations(); saveProject();
  return a;
}
function hitAnnotation(px, py) {
  const ctx = map.ctx;
  for (let i = annotations.length - 1; i >= 0; i--) {
    const a = annotations[i];
    const [x, y] = map.screenOf(a.lon, a.lat);
    ctx.save(); ctx.font = `${a.italic ? 'italic ' : ''}${a.bold !== false ? '700 ' : '400 '}${a.size || 14}px system-ui,sans-serif`;
    const w = ctx.measureText(a.text || '').width; ctx.restore();
    if (Math.abs(px - x) < w / 2 + 8 && Math.abs(py - y) < (a.size || 14) * 0.75 + 6) return a;
  }
  return null;
}
map.extraTop.push((ctx, m) => {
  for (const a of annotations) {
    const [x, y] = m.screenOf(a.lon, a.lat);
    if (x < -400 || y < -60 || x > m.W + 400 || y > m.H + 60) continue;
    ctx.save();
    ctx.translate(x, y); ctx.rotate((a.rot || 0) * Math.PI / 180);
    ctx.font = `${a.italic ? 'italic ' : ''}${a.bold !== false ? '700 ' : '400 '}${a.size || 14}px system-ui,-apple-system,sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const dark = m.basemap === 'dark' || m.basemap === 'satellite';
    if (a.halo !== false) { ctx.lineWidth = Math.max(2.5, (a.size || 14) * 0.32); ctx.strokeStyle = dark ? 'rgba(0,0,0,.85)' : 'rgba(255,255,255,.92)'; ctx.strokeText(a.text, 0, 0); }
    ctx.fillStyle = a.color || (dark ? '#ffffff' : '#16201b');
    ctx.fillText(a.text, 0, 0);
    if (editing && editing.id === a.id) {
      const w = ctx.measureText(a.text).width;
      ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5; ctx.strokeStyle = '#ffd400';
      ctx.strokeRect(-w / 2 - 5, -(a.size || 14) * 0.8, w + 10, (a.size || 14) * 1.6);
    }
    ctx.restore();
  }
});
window.addEventListener('pointerdown', (e) => {
  if (!annotations.length || e.target !== map.cv) return;   // never swallow taps on panels / inputs
  const r = map.cv.getBoundingClientRect();
  const px = e.clientX - r.left, py = e.clientY - r.top;
  if (px < 0 || py < 0 || px > r.width || py > r.height) return;
  const hit = hitAnnotation(px, py); if (!hit) return;
  e.stopPropagation(); e.preventDefault();
  const start = map.lonlatAt(px, py), dLon = hit.lon - start[0], dLat = hit.lat - start[1];
  let moved = false;
  const move = (ev) => { moved = true; const [lo, la] = map.lonlatAt(ev.clientX - r.left, ev.clientY - r.top); hit.lon = lo + dLon; hit.lat = la + dLat; map.render(); };
  const up = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
    saveProject(); if (!moved) openLabelEditor(hit);
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}, true);

function openLabelEditor(a) {
  editing = a;
  $('#labelpanel').hidden = false;
  $('#lp-text').value = a.text;
  $('#lp-size').value = a.size; $('#lp-sizeout').textContent = a.size;
  $('#lp-color').value = a.color || '#16201b';
  $('#lp-halo').checked = a.halo !== false;
  $('#lp-bold').checked = a.bold !== false;
  $('#lp-italic').checked = !!a.italic;
  $('#lp-rot').value = a.rot || 0; $('#lp-rotout').textContent = (a.rot || 0) + '°';
  map.render();
  if (mobileQ.matches) closeSheet();
}
function closeLabelEditor() { editing = null; $('#labelpanel').hidden = true; map.render(); saveProject(); }
$('#lp-text').oninput = (e) => { if (editing) { editing.text = e.target.value; map.render(); } };
$('#lp-size').oninput = (e) => { if (editing) { editing.size = +e.target.value; $('#lp-sizeout').textContent = e.target.value; map.render(); } };
$('#lp-color').oninput = (e) => { if (editing) { editing.color = e.target.value; map.render(); } };
$('#lp-halo').onchange = (e) => { if (editing) { editing.halo = e.target.checked; map.render(); } };
$('#lp-bold').onchange = (e) => { if (editing) { editing.bold = e.target.checked; map.render(); } };
$('#lp-italic').onchange = (e) => { if (editing) { editing.italic = e.target.checked; map.render(); } };
$('#lp-rot').oninput = (e) => { if (editing) { editing.rot = +e.target.value; $('#lp-rotout').textContent = e.target.value + '°'; map.render(); } };
$('#lp-del').onclick = () => { if (!editing) return; annotations = annotations.filter((x) => x.id !== editing.id); closeLabelEditor(); renderAnnotations(); toast('Label removed'); };
$('#lp-done').onclick = () => { closeLabelEditor(); renderAnnotations(); };
$('#lp-close').onclick = () => { closeLabelEditor(); renderAnnotations(); };

function renderAnnotations() {
  const box = $('#annotationlist'); if (!box) return;
  box.innerHTML = annotations.length
    ? annotations.map((a) => `<div class="lgrow" data-ann="${esc(a.id)}"><span class="lgsw" style="background:${esc(a.color || '#16201b')}"></span><span class="t">${esc(a.text || '(empty)')}<small>${fmtLL(a.lat, a.lon)}</small></span><button class="chip" data-edit="${esc(a.id)}">Edit</button><button class="chip" data-del="${esc(a.id)}">${icon('trash')}</button></div>`).join('')
    : '<p class="empty">No labels yet. Add one from the Legend tab or with the “Add a label” tool.</p>';
  box.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => { const a = annotations.find((x) => x.id === b.dataset.edit); if (a) { openSheet('tools'); openLabelEditor(a); } });
  box.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => { annotations = annotations.filter((x) => x.id !== b.dataset.del); renderAnnotations(); map.render(); saveProject(); });
}

// ---------------------------------------------------------------- bottom sheet
const sheet = $('#sheet'), mobileQ = matchMedia('(max-width:899px)');
const TITLES = { layers: 'Layers', legend: 'Legend', info: 'Info', tools: 'Tools' };
function openSheet(tab, keep) {
  if (tab === activeTab && !sheet.classList.contains('closed') && !keep && !mobileQ.matches) { closeSheet(); return; }
  activeTab = tab;
  for (const p of $$('.panel')) p.classList.toggle('active', p.id === 'panel-' + tab);
  for (const b of $$('.tab')) b.classList.toggle('active', b.dataset.tab === tab);
  $('#sheettitle').textContent = TITLES[tab];
  if (sheet.classList.contains('closed')) { sheet.style.removeProperty('--sheet-h'); sheet.classList.remove('closed'); }
  document.body.classList.add('side-open');
  if (tab === 'legend') refreshLegend();
  if (tab === 'layers') renderLayerLists();
  if (tab === 'tools') renderAnnotations();
}
function closeSheet() { sheet.classList.add('closed'); document.body.classList.remove('side-open'); for (const b of $$('.tab')) b.classList.remove('active'); }
for (const b of $$('.tab')) b.onclick = () => { if (b.dataset.tab === activeTab && !sheet.classList.contains('closed')) closeSheet(); else openSheet(b.dataset.tab, true); };
$('#sheetclose').onclick = closeSheet;
(function drag() {
  let y0, h0, dragging = false;
  const start = (e) => { if (!mobileQ.matches) return; dragging = true; y0 = e.clientY; h0 = sheet.getBoundingClientRect().height; sheet.classList.add('dragging'); e.target.setPointerCapture?.(e.pointerId); };
  const move = (e) => { if (!dragging) return; const h = Math.max(60, Math.min(innerHeight * 0.9, h0 + (y0 - e.clientY))); sheet.style.setProperty('--sheet-h', h + 'px'); };
  const end = () => {
    if (!dragging) return; dragging = false; sheet.classList.remove('dragging'); const h = sheet.getBoundingClientRect().height, f = h / innerHeight;
    if (f < 0.2) { closeSheet(); sheet.style.removeProperty('--sheet-h'); } else sheet.style.setProperty('--sheet-h', (f > 0.66 ? 0.86 : 0.52) * innerHeight + 'px');
  };
  for (const el of [$('#grab'), $('#sheethead')]) { el.style.touchAction = 'none'; el.addEventListener('pointerdown', start); el.addEventListener('pointermove', move); el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); }
})();

// ---------------------------------------------------------------- tools panel
const TOOL_GROUPS = {
  focus: [
    ['clip', 'crop', 'Clip to an area', 'Fade everything outside a shape you draw'],
    ['query', 'query', 'Select by area', 'List what lies inside a polygon'],
    ['aoi', 'hist', 'Area summary', 'Counts, classes and area inside the focus'],
    ['filter', 'filter', 'Filter features', 'Show only the rows that match'],
    ['reclass', 'sliders', 'Group into classes', 'Reclassify and recolour a numeric field'],
  ],
  navigate: [
    ['measure-dist', 'ruler', 'Measure distance', 'Tap along a line to total the km'],
    ['measure-area', 'area', 'Measure area', 'Tap a shape to get km² and edge'],
    ['goto', 'target', 'Go to coordinates', 'Type a latitude and longitude'],
    ['bearing', 'compass', 'Distance & bearing', 'Between two coordinates'],
    ['grid', 'grid', 'Grid lines', 'Latitude / longitude graticule'],
  ],
  data: [
    ['stats', 'chart', 'Layer statistics', 'Totals, averages and a chart'],
    ['chart', 'hist', 'Compare fields', 'Histogram of any numeric column'],
    ['table', 'table', 'Attribute table', 'Browse, sort and search rows'],
    ['labels', 'tag', 'Feature labels', 'Write a field on the map'],
    ['zoomlayer', 'zoom', 'Zoom to a layer', 'Fit a whole layer on screen'],
    ['shot', 'camera', 'Save map picture', 'Download the screen as a PNG'],
    ['export', 'down', 'Export data', 'Download layers as GeoJSON / CSV'],
  ],
  author: [
    ['symbology', 'palette', 'Symbology', 'Fill, stroke, size and labels'],
    ['addlabel', 'tag', 'Add a label', 'Place text anywhere on the map'],
    ['savelabels', 'pin', 'Label list', 'Manage the labels you placed'],
    ['import', 'upload', 'Import GeoJSON', 'Bring your own file onto the map'],
    ['reset', 'refresh', 'Reset the work', 'Forget styles, filters, labels and focus'],
  ],
  project: [
    ['resetview', 'refresh', 'Reset the view', 'Back to the opening extent and no filters'],
    ['fullscreen', 'expand', 'Full screen', 'Use the whole screen, no browser chrome'],
  ],
};

function buildTools() {
  const authorZone = $('#authorzone');
  if (authorZone) authorZone.hidden = !AUTHOR;
  for (const [group, list] of Object.entries(TOOL_GROUPS)) {
    if (group === 'author' && !AUTHOR) continue;
    const box = $('#tools-' + group);
    if (!box) continue;
    box.innerHTML = list.map(([id, ic, label, desc]) => `<button class="tool" data-tool="${id}">${icon(ic)}${esc(label)}<small>${esc(desc)}</small></button>`).join('');
  }
  $('.panel#panel-tools').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tool]'); if (!b) return;
    runTool(b.dataset.tool);
  });
  updateToolState();
}
function updateToolState() {
  for (const b of $$('[data-tool]')) {
    const t = b.dataset.tool;
    b.classList.toggle('on', (t === 'grid' && gridOn)
      || (t === 'measure-dist' && measure?.mode === 'line') || (t === 'measure-area' && measure?.mode === 'area')
      || (t === 'clip' && !!clip) || (t === 'query' && draw?.mode === 'query'));
  }
  const g = $('#lyrtools [data-x="grid"]'); if (g) g.classList.toggle('on', gridOn);
}
const AUTHOR_ONLY = new Set(['symbology', 'addlabel', 'savelabels', 'import', 'reset']);
function runTool(t) {
  if (AUTHOR_ONLY.has(t) && !AUTHOR) return;
  switch (t) {
    case 'addlabel': {
      const [lo, la] = map.center();
      openLabelEditor(addAnnotation({ text: 'New label', lon: lo, lat: la, size: 16 }));
      break;
    }
    case 'measure-dist': startMeasure('line'); break;
    case 'measure-area': startMeasure('area'); break;
    case 'grid': gridOn = !gridOn; map.setGrid(gridOn); updateToolState(); saveProject(); toast(gridOn ? 'Grid on' : 'Grid off'); break;
    case 'shot': saveMapImage(); break;
    case 'goto': toolGoto(); break;
    case 'symbology': toolSymbology(); break;
    case 'labels': toolLabels(); break;
    case 'reclass': toolReclass(); break;
    case 'filter': toolFilter(); break;
    case 'stats': toolStats(); break;
    case 'zoomlayer': toolZoomLayer(); break;
    case 'import': toolImport(); break;
    case 'export': toolExport(); break;
    case 'table': toolTable(); break;
    case 'bearing': toolBearing(); break;
    case 'savelabels': openSheet('tools'); renderAnnotations(); toast('Labels are listed under “Labels you placed”'); break;
    case 'reset': resetWork(); break;
    case 'clip': toolClip(); break;
    case 'query': toolQuery(); break;
    case 'aoi': toolAoi(); break;
    case 'chart': toolChart(); break;
    case 'resetview': resetView(); break;
    case 'fullscreen': toggleFullscreen(); break;
  }
}

// ---------------------------------------------------------------- focus area (clip)
const FOCUS_KINDS = { rect: 'Rectangle', poly: 'Polygon' };

function setFocus(obj, announce = true) {
  clip = obj || null;
  map.setClip(clip);
  updateFocusUI();
  saveProjectSoon();
  if (announce) toast(clip ? `Focused on ${fmtNum(focusAreaKm2())} km²` : 'Focus cleared — the whole map is shown');
}
function stopFocus() { focusLabel = ''; setFocus(null); }
function focusAreaKm2() {
  if (!clip) return 0;
  if (clip.type === 'rect') {
    const [w, yb, e, yt] = clip.wb;
    return ringAreaKm2([[unX(w), unY(yt)], [unX(e), unY(yt)], [unX(e), unY(yb)], [unX(w), unY(yb)]]);
  }
  if (clip.type === 'poly') {
    let a = 0;
    clip.rings.forEach((r, i) => {
      const o = [];
      for (let k = 0; k + 1 < r.length; k += 2) o.push([unX(r[k]), unY(r[k + 1])]);
      const v = ringAreaKm2(o);
      a += i === 0 ? v : -v;
    });
    return Math.max(0, a);
  }
  return 0;
}
function focusPerimeterKm() {
  if (clip?.type !== 'poly') return 0;
  const r = clip.rings[0], o = [];
  for (let i = 0; i + 1 < r.length; i += 2) o.push([unX(r[i]), unY(r[i + 1])]);
  return ringPerimeterKm(o);
}
function focusFromLonLat(pts) {
  if (!pts || pts.length < 3) { toast('Tap at least three corners'); return; }
  const ring = [];
  for (const [lo, la] of pts) ring.push(mercX(lo), mercY(la));
  setFocus({ type: 'poly', rings: [ring] });
}
function focusFromRect(a, b) {
  const w = mercX(Math.min(a[0], b[0])), e = mercX(Math.max(a[0], b[0]));
  const n = mercY(Math.max(a[1], b[1])), s_ = mercY(Math.min(a[1], b[1]));
  if (Math.abs(e - w) < 1e-7 || Math.abs(n - s_) < 1e-7) { toast('Drag a bigger box'); return; }
  setFocus({ type: 'rect', wb: [w, s_, e, n] });
}
function focusFromFeature(f, label) {
  if (!f) return;
  if (f.type === 'poly') {
    const rings = [];
    for (const poly of f.parts) for (const ring of poly) rings.push(Array.from(ring));
    focusLabel = label || '';
    setFocus({ type: 'poly', rings });
    map.fitBounds([unX(f.bb[0]), unY(f.bb[3]), unX(f.bb[2]), unY(f.bb[1])], 40);
  } else if (f.type === 'point') {
    const pad = 0.02 / Math.max(1, Math.pow(1.6, map.zoom - 4));
    const x = f.parts[0], y = f.parts[1];
    setFocus({ type: 'rect', wb: [x - pad, y - pad, x + pad, y + pad] });
  } else toast('Only a polygon or a point can be used as a focus area');
}
let focusLabel = '';

function updateFocusUI() {
  const chip = $('#lyrtools [data-x="focus"]');
  if (chip) {
    chip.classList.toggle('on', !!clip);
    chip.innerHTML = icon('crop') + (clip ? 'Focused' : 'Clip');
    chip.title = clip ? 'A focus area is active — tap to change or clear it' : 'Clip the map to an area';
  }
  updateToolState();
  const b = $('#btn-back'); if (b) b.hidden = !viewHist.length;
}

// drawing a focus area ---------------------------------------------------
function startDraw(kind) {
  if (measure) { measure = null; $('#measurebar').hidden = true; }
  draw = { kind, pts: [] };
  map.cv.style.cursor = 'crosshair';
  const bar = $('#drawbar'); bar.hidden = false;
  $('#drawtext').textContent = kind === 'rect' ? 'Drag a box on the map' : kind === 'poly' ? 'Tap the corners of the area' : 'Tap a polygon to use as the focus';
  $('#drawdone').hidden = kind !== 'poly';
  $('#drawclear').textContent = kind === 'rect' ? 'Cancel' : 'Cancel';
  if (kind === 'poly') { drawPreview(); }
  updateToolState();
}
function startPick(mode, extra = {}) {
  if (measure) { measure = null; $('#measurebar').hidden = true; }
  if (mode === 'focus') setFocus(null, false);
  draw = { kind: 'pick', mode, ...extra };
  map.cv.style.cursor = 'crosshair';
  const bar = $('#drawbar'); bar.hidden = false;
  $('#drawtext').textContent = mode === 'focus' ? 'Tap a polygon to use as the focus' : 'Tap a polygon to select inside it';
  $('#drawdone').hidden = true;
  $('#drawclear').textContent = 'Cancel';
  updateToolState();
}
function endDraw() {
  draw = null;
  map.cv.style.cursor = '';
  map.overlay = null;
  $('#drawbar').hidden = true;
  map.render();
  updateToolState();
}
function drawPreview() {
  map.overlay = (ctx, m) => {
    if (!draw || draw.kind !== 'poly' || !draw.pts.length) return;
    ctx.save();
    ctx.beginPath();
    draw.pts.forEach(([lo, la], i) => { const [x, y] = m.screenOf(lo, la); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.setLineDash([7, 5]); ctx.lineWidth = 2.5; ctx.strokeStyle = '#0b6b45'; ctx.stroke();
    if (draw.pts.length > 2) { ctx.setLineDash([]); ctx.fillStyle = 'rgba(11,107,69,.14)'; ctx.fill(); }
    ctx.setLineDash([]);
    ctx.fillStyle = '#0b6b45';
    for (const [lo, la] of draw.pts) { const [x, y] = m.screenOf(lo, la); ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  };
  map.render();
}
// drag-to-draw a rectangle: capture phase so the map never pans while drawing
function bindDrawPointer() {
  const cv = map.cv;
  let origin = null;
  const rectAt = (e) => unproject(e);
  cv.addEventListener('pointerdown', (e) => {
    if (draw?.kind !== 'rect') return;
    e.stopPropagation(); e.preventDefault();
    origin = rectAt(e);
    let last = origin;
    cv.setPointerCapture?.(e.pointerId);
    map.overlay = (ctx, m) => {
      const [x0, y0] = m.screenOf(Math.min(origin[0], last[0]), Math.max(origin[1], last[1]));
      const [x1, y1] = m.screenOf(Math.max(origin[0], last[0]), Math.min(origin[1], last[1]));
      ctx.save();
      ctx.fillStyle = 'rgba(11,107,69,.16)'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.setLineDash([7, 5]); ctx.lineWidth = 2.5; ctx.strokeStyle = '#0b6b45'; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      ctx.restore();
    };
    map.render();
    const move = (ev) => { last = rectAt(ev); map.render(); };
    const up = (ev) => {
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up);
      cv.removeEventListener('pointercancel', up);
      const b = rectAt(ev), a = origin; origin = null;
      map.overlay = null;
      endDraw();
      focusFromRect(a, b);
    };
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
  }, true);
}
function unproject(e) {
  const r = map.cv.getBoundingClientRect();
  return map.fromScreen((e.clientX - r.left) * (map.W / r.width), (e.clientY - r.top) * (map.H / r.height)).map((v, i) => i === 0 ? unX(v) : unY(v));
}

function toolClip() {
  const kind = clip ? (FOCUS_KINDS[clip.type] || 'area') : '';
  const cur = clip
    ? `Active focus: ${kind} · <b>${fmtNum(focusAreaKm2())} km²</b>${focusPerimeterKm() ? ` · edge ${fmtNum(focusPerimeterKm())} km` : ''}${focusLabel ? ` · from ${esc(focusLabel)}` : ''}`
    : 'No focus area — the whole map is shown.';
  openModal('Clip to an area', (body) => {
    body.innerHTML = `<p class="hint">${cur}</p>
      <p>Everything outside the shape fades back, and only features inside it are drawn and picked. Use it to study one state, one local government, one basin or one site without the national picture in the way.</p>
      <div class="aoi">
        <button class="btn" data-act="rect">${icon('crop')} Drag a box</button>
        <button class="btn" data-act="poly">${icon('area')} Draw a polygon</button>
        <button class="btn" data-act="pick">${icon('query')} Use a polygon from a layer</button>
        <button class="btn" data-act="view">${icon('expand')} Use the current view</button>
      </div>
      <p class="hint" style="margin-top:10px">Esc cancels a drawing. The focus area is remembered with your view and in the share link.</p>
      ${clip ? `<div class="aoi" style="margin-top:10px">
        <button class="btn" data-act="summary">${icon('hist')} Area summary</button>
        <button class="btn" data-act="zoom">${icon('zoom')} Zoom to it</button>
        <button class="btn" data-act="clear">Clear focus</button></div>` : ''}`;
    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act; closeModal();
      if (act === 'rect' || act === 'poly') startDraw(act);
      else if (act === 'pick') startPick('focus');
      else if (act === 'view') {
        const [x0, y0] = map.fromScreen(0, 0), [x1, y1] = map.fromScreen(map.W, map.H);
        setFocus({ type: 'rect', wb: [x0, y1, x1, y0] });
      } else if (act === 'clear') stopFocus();
      else if (act === 'summary') toolAoi();
      else if (act === 'zoom') { const bb = map.clipBounds(); if (bb) map.fitBounds(bb, 24); }
    });
  });
}

// what is inside the focus area ------------------------------------------
function visibleLayerIds() { return stack.filter((id) => isOn(id) && L.get(id)?.obj); }
function valueFor(st, f) {
  const rk = layerRank(st);
  if (rk && Number.isFinite(rk.byIdx?.get?.(f.idx))) return fmtNum(rk.byIdx.get(f.idx));
  for (const fld of (st.meta.fields || [])) {
    const v = f.props?.[fld.name];
    if (v != null && v !== '') return String(v).slice(0, 40);
  }
  return '';
}

function toolAoi() {
  openModal('Area summary', (body) => {
    body.innerHTML = '<p class="hint">Counting features inside the focus area…</p>';
    setTimeout(() => {
      const area = focusAreaKm2();
      const rows = [];
      for (const id of visibleLayerIds()) {
        const st = L.get(id), obj = st.obj, m = st.meta;
        if (m.kind === 'table') continue;
        if (obj.features) {
          let n = 0, tot = 0, ar = 0, arIn = 0;
          for (const f of obj.features) {
            if (f.hidden) continue;
            tot++;
            const [wx, wy] = labelAnchor(f);
            const inside = clip ? map.containsClip(wx, wy) : true;
            if (m.kind === 'polygon') ar += featureMetrics(f).area || 0;
            if (inside) { n++; if (m.kind === 'polygon') arIn += featureMetrics(f).area || 0; }
          }
          rows.push({ label: m.label, kind: m.kind, n, tot, ar: arIn });
        } else if (obj.vals) {
          const o = obj.vals, { w, h, data, dtype } = o;
          const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 45000)));
          const counts = new Map(); let inside = 0, cells = 0;
          for (let j = 0; j < h; j += step) {
            const wy = o.wb[1] + (j + step / 2) / h * (o.wb[3] - o.wb[1]);
            for (let i = 0; i < w; i += step) {
              const v = data[j * w + i];
              if (dtype === 'i2' ? v === -32768 : !isFinite(v)) continue;
              cells++;
              const wx = o.wb[0] + (i + step / 2) / w * (o.wb[2] - o.wb[0]);
              if (clip && !map.containsClip(wx, wy)) continue;
              inside++;
              counts.set(v, (counts.get(v) || 0) + 1);
            }
          }
          const top = [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5);
          rows.push({ label: m.label, kind: 'raster', n: inside * step * step, tot: cells * step * step, classes: top, weight: step * step });
        }
      }
      const max = Math.max(1, ...rows.map((r) => r.n));
      const bars = rows.map((r) => `<div class="brow"><span>${esc(r.label)}</span><span class="barwrap"><i style="width:${Math.max(1, 100 * r.n / max)}%"></i></span><b>${fmtNum(r.n)}</b></div>`).join('');
      body.innerHTML = `<p class="hint">${clip
        ? `Focus area: <b>${fmtNum(area)} km²</b>${focusPerimeterKm() ? ` · edge ${fmtNum(focusPerimeterKm())} km` : ''}. Only what lies inside it is counted.`
        : 'No focus area set — the totals below cover every visible layer. Use <b>Clip to an area</b> to narrow them.'}</p>
        <div class="chart">${bars || '<p class="hint">Nothing visible.</p>'}</div>
        <table class="mini"><tr><th>Layer</th><th>${clip ? 'Inside' : 'Count'}</th><th>of</th><th>Detail</th></tr>
        ${rows.map((r) => `<tr><td>${esc(r.label)}</td><td><b>${fmtNum(r.n)}</b></td><td>${fmtNum(r.tot)}</td><td>${
          r.classes ? r.classes.map(([v, c]) => `${esc(v)}: ${fmtNum(c * r.weight)} cells`).join('<br>')
            : r.kind === 'polygon' ? `Σ ${fmtNum(r.ar)} km²` : r.kind === 'point' ? 'points' : 'lines'}</td></tr>`).join('')}</table>
        ${rows.some((r) => r.kind === 'polygon') ? '<p class="hint">Area sums use the feature\'s own size, so polygons that straddle the edge of the focus count in full.</p>' : ''}
        <div class="aoi" style="margin-top:10px">${clip
          ? '<button class="btn" data-act="clear">Clear focus</button><button class="btn" data-act="zoom">Zoom to area</button><button class="btn" data-act="csv">Export summary (CSV)</button>'
          : '<button class="btn primary" data-act="clip">Clip to an area</button>'}</div>`;
      body.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        const act = b.dataset.act; closeModal();
        if (act === 'clear') stopFocus();
        else if (act === 'zoom') { const bb = map.clipBounds(); if (bb) map.fitBounds(bb, 24); }
        else if (act === 'clip') toolClip();
        else if (act === 'csv') {
          const head = 'layer,inside,total,detail';
          const lines = [head, ...rows.map((r) => [r.label, r.n, r.tot, r.classes ? r.classes.map(([v, c]) => `${v}=${c * r.weight}`).join(' ') : r.kind === 'polygon' ? `${Math.round(r.ar)} km2` : r.kind].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))];
          download('area-summary.csv', lines.join(String.fromCharCode(10)), 'text/csv');
        }
      });
    }, 40);
  });
}

// select by area: list features inside a polygon feature -------------------
function toolQuery() {
  const polys = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'polygon') polys.push([id, st]); }
  openModal('Select by area', (body) => {
    if (!polys.length) {
      body.innerHTML = `<p class="hint">No polygon layer is switched on, so there is no boundary to select against.${clip ? ' Your focus area still works — use <b>Area summary</b> to count inside it.' : ''}</p>`;
      return;
    }
    body.innerHTML = `<p>Tap a polygon on the map, then everything inside it is listed, counted and can be exported. Uses the polygon's own boundary, so a state or LGA border works as a rubber band.</p>
      <label>Boundary layer<select id="qpoly">${polys.map(([id, st]) => `<option value="${esc(id)}">${esc(st.meta.label)}</option>`).join('')}</select></label>
      <label>List features from<select id="qlayer"><option value="">all switched-on layers</option>${visibleLayerIds().map((id) => `<option value="${esc(id)}">${esc(L.get(id).meta.label)}</option>`).join('')}</select></label>
      <div class="frow act"><button class="btn primary" data-act="run">Next: tap a polygon</button></div>
      ${clip ? '<p class="hint">Rows are also limited to the current focus area.</p>' : ''}`;
    body.addEventListener('click', (e) => {
      if (!e.target.closest('[data-act="run"]')) return;
      const pid = body.querySelector('#qpoly').value, lid = body.querySelector('#qlayer').value || '';
      closeModal();
      startPick('query', { pid, lid });
      toast('Tap a polygon to select inside it');
    });
  });
}
function runQuery(poly, onlyLayer) {
  const ids = onlyLayer ? [onlyLayer] : visibleLayerIds();
  const out = [];
  for (const id of ids) {
    const st = L.get(id); if (!st?.obj?.features) continue;
    if (id === poly.layer && !onlyLayer) continue;
    for (const f of st.obj.features) {
      if (f.hidden) continue;
      const [wx, wy] = labelAnchor(f);
      if (clip && !map.containsClip(wx, wy)) continue;
      if (!pointInFeature(wx, wy, poly.f)) continue;
      out.push({ id, st, f });
    }
  }
  const label = L.get(poly.layer)?.meta.label || 'polygon';
  const area = poly.f.type === 'poly' ? (featureMetrics(poly.f).area || 0) : 0;
  const name = titleOf(L.get(poly.layer)?.obj, poly.f);
  const byLayer = new Map();
  for (const r of out) byLayer.set(r.st.meta.label, (byLayer.get(r.st.meta.label) || 0) + 1);
  const sample = out.slice(0, 150);
  const maxN = Math.max(1, ...byLayer.values());
  openModal('Selection result', (body) => {
    body.innerHTML = `<p class="hint">Inside <b>${esc(name || label)}</b> (${esc(label)})${area ? ` · ${fmtNum(area)} km²` : ''} · <b>${fmtNum(out.length)}</b> feature${out.length === 1 ? '' : 's'} found.</p>
      ${byLayer.size ? `<div class="chart">${[...byLayer.entries()].sort((a, b) => b[1] - a[1]).map(([l, n]) => `<div class="brow"><span>${esc(l)}</span><span class="barwrap"><i style="width:${Math.max(2, 100 * n / maxN)}%"></i></span><b>${fmtNum(n)}</b></div>`).join('')}</div>`
        : '<p>Nothing falls inside this polygon.</p>'}
      ${sample.length ? `<table class="mini"><tr><th>Layer</th><th>Feature</th><th>Value</th></tr>${sample.map((r) => `<tr><td>${esc(r.st.meta.label)}</td><td>${esc(titleOf(r.st.obj, r.f))}</td><td>${esc(valueFor(r.st, r.f))}</td></tr>`).join('')}</table>
        ${out.length > sample.length ? `<p class="hint">Showing the first ${sample.length} of ${fmtNum(out.length)}.</p>` : ''}` : ''}
      <div class="aoi" style="margin-top:10px">
        <button class="btn" data-act="focus">${icon('crop')} Focus on this polygon</button>
        <button class="btn" data-act="zoom">${icon('zoom')} Zoom to it</button>
        ${out.length ? '<button class="btn" data-act="csv">Export selection (CSV)</button>' : ''}
      </div>`;
    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act; closeModal();
      if (act === 'focus') focusFromFeature(poly.f, label);
      else if (act === 'zoom') focusThenZoom(poly.f);
      else if (act === 'csv') {
        const lines = ['layer,name,value,lat,lon'];
        for (const r of out) {
          const [wx, wy] = labelAnchor(r.f);
          lines.push([r.st.meta.label, titleOf(r.st.obj, r.f), valueFor(r.st, r.f), unY(wy).toFixed(5), unX(wx).toFixed(5)].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
        }
        download('selection.csv', lines.join(String.fromCharCode(10)), 'text/csv');
      }
    });
  });
}
function focusThenZoom(f) {
  const bb = f.bb;
  map.fitBounds([unX(bb[0]), unY(bb[3]), unX(bb[2]), unY(bb[1])], 24);
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-x="unfocus"]');
  if (!b) return;
  stopFocus();
  toast('Focus cleared');
});
$('#lyrtools').addEventListener('click', (e) => {
  const b = e.target.closest('[data-x]'); if (!b) return;
  const x = b.dataset.x;
  if (x === 'showall') { for (const id of baseOrder) if (!isOn(id) && L.get(id).meta.kind !== 'table') setLayer(id, true); }
  else if (x === 'hideall') { for (const id of [...stack]) setLayer(id, false); }
  else if (x === 'fitall') fitVisible();
  else if (x === 'focus') toolClip();
  else if (x === 'grid') { gridOn = !gridOn; map.setGrid(gridOn); updateToolState(); saveProject(); }
  else if (x === 'labels') toolLabels(stack[stack.length - 1]);
  else if (x === 'clearfilter') { let n = 0; for (const st of L.values()) if (st.filter) { st.filter = null; applyFilter(st); n++; } renderLayerLists(); toast(n ? 'Filters cleared' : 'No filters to clear'); saveProject(); }
});
function fitVisible() {
  const b = stack.map((id) => L.get(id).meta.bounds).filter(Boolean);
  if (!b.length) { toast('Nothing visible to fit'); return; }
  const bb = [Math.min(...b.map((x) => x[0])), Math.min(...b.map((x) => x[1])), Math.max(...b.map((x) => x[2])), Math.max(...b.map((x) => x[3]))];
  map.fitBounds(bb, 30);
  if (!mobileQ.matches) { map.cx -= 200 / map.S; map._viewChanged(); }
}

// ------------------------------------------------ generic modal
function openModal(title, build) {
  $('#modal-title').textContent = title;
  const body = $('#modal-body'); body.innerHTML = '';
  $('#modal').hidden = false;
  if (mobileQ.matches) closeSheet();
  build(body);
}
function closeModal() { $('#modal').hidden = true; }
$('#modal-close').onclick = closeModal;
function closeAll() { closeModal(); $('#tablemodal').hidden = true; $('#search').hidden = true; closeLabelEditor(); }

// ------------------------------------------------ tool: go to coordinates
function toolGoto() {
  openModal('Go to coordinates', (body) => {
    body.innerHTML = `<p class="muted">Decimal degrees. You can also paste “lat, lon”.</p>
      <div class="frow"><label>Latitude</label><input id="g-lat" type="number" step="0.0001" placeholder="9.0765"></div>
      <div class="frow"><label>Longitude</label><input id="g-lon" type="number" step="0.0001" placeholder="7.3986"></div>
      <div class="frow"><label>Zoom</label><input id="g-zoom" type="range" min="2" max="18" step="0.5" value="${Math.round(map.zoom)}"><b id="g-zoomout">${map.zoom.toFixed(1)}</b></div>
      <div class="frow"><label>Paste</label><input id="g-paste" type="text" placeholder="9.0765, 7.3986"></div>
      <div class="frow act"><button class="btn" id="g-here">Use map centre</button><button class="btn primary" id="g-go">Zoom there</button></div>`;
    const lat = body.querySelector('#g-lat'), lon = body.querySelector('#g-lon'), zoom = body.querySelector('#g-zoom'), zo = body.querySelector('#g-zoomout'), paste = body.querySelector('#g-paste');
    const c = map.center(); lat.value = +c[1].toFixed(5); lon.value = +c[0].toFixed(5);
    zoom.oninput = () => { zo.textContent = (+zoom.value).toFixed(1); };
    paste.oninput = () => {
      const m = paste.value.split(/[,;\s]+/).map(Number).filter((v) => isFinite(v));
      if (m.length >= 2) { lat.value = m[0]; lon.value = m[1]; if (m[2] != null) zoom.value = clamp(m[2], 2, 18), zo.textContent = (+zoom.value).toFixed(1); }
    };
    body.querySelector('#g-here').onclick = () => { const cc = map.center(); lat.value = +cc[1].toFixed(5); lon.value = +cc[0].toFixed(5); };
    body.querySelector('#g-go').onclick = () => {
      const la = +lat.value, lo = +lon.value;
      if (!isFinite(la) || !isFinite(lo) || Math.abs(la) > 85 || Math.abs(lo) > 180) { toast('Enter a latitude between -85 and 85 and a longitude between -180 and 180'); return; }
      map.setView(lo, la, +zoom.value); closeModal(); toast(fmtLL(la, lo));
    };
  });
}

// ------------------------------------------------ tool: screenshot
async function saveMapImage() {
  closeLabelEditor();
  $('#labelpanel').hidden = true;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  map._draw();
  let src = null, note = '';
  try { src = map.cv.toDataURL('image/png'); }
  catch (e) {
    const prev = map.basemap; map.basemap = 'none'; map._draw();
    try { src = map.cv.toDataURL('image/png'); note = ' (basemap tiles are protected by their provider, so the picture is without a basemap)'; } catch (e2) { src = null; }
    map.basemap = prev; map._draw();
  }
  if (!src) { toast('Could not create the picture on this device'); return; }
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
  const pad = Math.round(46 * map.dpr);
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height + pad;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.drawImage(img, 0, 0);
  const d = map.dpr, [lo, la] = map.center();
  ctx.fillStyle = '#0b3d2e'; ctx.fillRect(0, img.height, cv.width, pad);
  ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle'; ctx.font = `600 ${13 * d}px system-ui,sans-serif`;
  ctx.fillText(catalog.title, 14 * d, img.height + pad * 0.36);
  ctx.font = `${10.5 * d}px system-ui,sans-serif`;
  const sub = `${new Date().toLocaleString()} · ${fmtLL(la, lo)} · zoom ${map.zoom.toFixed(1)}`;
  ctx.fillText(sub, 14 * d, img.height + pad * 0.72);
  const attr = BASEMAPS[map.basemap]?.attr || '';
  if (attr) { ctx.textAlign = 'right'; ctx.fillText(attr, cv.width - 14 * d, img.height + pad * 0.72); ctx.textAlign = 'left'; }
  cv.toBlob((blob) => {
    if (!blob) { toast('Could not create the picture'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `map-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Picture saved' + note, 5000);
  }, 'image/png');
}

// ------------------------------------------------ shared select helpers
function layerPicker(body, onChange, filter = () => true, preferred = null) {
  const opts = [...stack].reverse().map((id) => L.get(id)).filter((st) => st && filter(st));
  const all = [...L.values()].filter((st) => st.meta.kind !== 'table' && filter(st) && !opts.includes(st));
  const wrap = document.createElement('div'); wrap.className = 'frow';
  const select = document.createElement('select');
  select.style.flex = '1';
  select.innerHTML = [...opts, ...all].map((st) => `<option value="${esc(st.meta.id)}">${esc(st.meta.label)}${st.on ? '' : ' (off)'}</option>`).join('');
  if (preferred) select.value = preferred;
  wrap.innerHTML = '<label>Layer</label>'; wrap.appendChild(select);
  body.appendChild(wrap);
  select.onchange = () => onChange(L.get(select.value));
  return { select, first: L.get(select.value) };
}
function fieldSelect(body, st, onChange, kind = 'any', preferred = null) {
  const wrap = document.createElement('div'); wrap.className = 'frow';
  const fields = (st?.meta.fields || []).filter((f) => kind === 'any' || (kind === 'number' ? f.type === 'number' : f.type === 'text'));
  wrap.innerHTML = '<label>Field</label>';
  const sel = document.createElement('select'); sel.style.flex = '1';
  sel.innerHTML = fields.map((f) => `<option value="${esc(f.name)}">${esc(f.label || f.name)}</option>`).join('') || '<option value="">(no fields)</option>';
  if (preferred) sel.value = preferred;
  wrap.appendChild(sel); body.appendChild(wrap);
  sel.onchange = () => onChange(sel.value);
  return sel;
}

// ------------------------------------------------ tool: symbology
function toolSymbology(preferred) {
  openModal('Symbology', (body) => {
    const holder = document.createElement('div');
    const { first } = layerPicker(body, () => draw(), (st) => st.meta.kind === 'polygon' || st.meta.kind === 'line' || st.meta.kind === 'point' || st.meta.kind === 'raster', preferred || (preferred == null ? stack[stack.length - 1] : null));
    body.appendChild(holder);
    function draw() {
      const sel = body.querySelector('select'); const st = L.get(sel.value); if (!st) { holder.innerHTML = '<p class="empty">No editable layer</p>'; return; }
      if (!st.on) setLayer(st.meta.id, true);
      if (!st.sym) st.sym = defaultSym(st.meta);
      const m = st.meta;
      if (!st.obj) { holder.innerHTML = '<p class="empty">Loading…</p>'; loadLayer(st).then(() => draw()); return; }
      const s = st.sym, isPoint = m.kind === 'point', isLine = m.kind === 'line';
      if (m.kind === 'raster' || m.kind === 'image') {
        holder.innerHTML = `<p class="muted">${m.kind === 'raster' ? 'Raster colours come from the data (class colours or a colour ramp).' : 'Scanned picture.'} You can fade it here to see what is underneath.</p>
          <div class="frow"><label>Opacity</label><input id="s-op" type="range" min="0" max="100" value="${Math.round(st.opacity * 100)}"><b id="s-opout">${Math.round(st.opacity * 100)}%</b></div>
          ${m.kind === 'raster' && m.classes ? `<div class="frow act"><button class="btn" id="s-rast-table">${icon('table')} Class table (legend)</button></div>` : ''}`;
        const op = holder.querySelector('#s-op'), on = holder.querySelector('#s-opout');
        op.oninput = () => { st.opacity = op.value / 100; on.textContent = op.value + '%'; if (st.obj) { st.obj.opacity = st.opacity; map.render(); } saveProject(); };
        const tb = holder.querySelector('#s-rast-table');
        if (tb) tb.onclick = () => { closeModal(); openTable(m.id); };
        return;
      }
      holder.innerHTML = `
        <h4>Shape</h4>
        <div class="frow"><label>Colour source</label><select id="s-mode">
          <option value="data"${s.fillMode === 'data' ? ' selected' : ''}>From the data (legend colours)</option>
          <option value="single"${s.fillMode === 'single' ? ' selected' : ''}>One colour for the whole layer</option></select></div>
        <div class="frow"><label>Fill</label><input id="s-fill" type="color" value="${(s.fill || '#4e79a7').slice(0, 7)}">
          <label class="chk">Opacity <input id="s-fo" type="range" min="0" max="100" value="${Math.round((s.fillOpacity ?? 0.72) * 100)}"></label><b id="s-foout">${Math.round((s.fillOpacity ?? 0.72) * 100)}%</b></div>
        ${isPoint ? `<div class="frow"><label>Marker</label><select id="s-shape">${['circle', 'square', 'triangle', 'diamond', 'star', 'cross'].map((x) => `<option${s.pointShape === x ? ' selected' : ''}>${x}</option>`).join('')}</select>
          <input id="s-psize" type="range" min="1" max="18" step="0.5" value="${s.pointSize ?? 3.4}"><b id="s-psout">${s.pointSize ?? 3.4}</b></div>` : ''}
        <h4>Stroke</h4>
        <div class="frow"><label>Colour</label><input id="s-stroke" type="color" value="${(s.stroke || (isLine ? '#0b6b45' : '#333333')).slice(0, 7)}">
          <label class="chk"><input id="s-nostroke" type="checkbox"${(s.strokeWidth ?? 1) <= 0 ? ' checked' : ''}> No stroke</label></div>
        <div class="frow"><label>Width</label><input id="s-sw" type="range" min="0" max="8" step="0.2" value="${s.strokeWidth ?? 1}"><b id="s-swout">${s.strokeWidth ?? 1}</b></div>
        <div class="frow"><label>Style</label><select id="s-dash">${['solid', 'dashed', 'dotted'].map((x) => `<option${s.dash === x ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
        <h4>Labels</h4>
        ${labelControls(st, holder)}
        <div class="frow act"><button class="btn" id="s-reset">Reset style</button></div>`;
      const $b = (q) => holder.querySelector(q);
      const upd = (fn, save = true) => { fn(); applyLayerState(st); if (save) saveProject(); };
      $b('#s-mode').onchange = (e) => upd(() => { s.fillMode = e.target.value; });
      $b('#s-fill').oninput = (e) => upd(() => { s.fill = e.target.value; s.fillMode = 'single'; $b('#s-mode').value = 'single'; });
      $b('#s-fo').oninput = (e) => { s.fillOpacity = e.target.value / 100; $b('#s-foout').textContent = e.target.value + '%'; upd(() => {}); };
      const psize = $b('#s-psize');
      if (psize) psize.oninput = (e) => { s.pointSize = +e.target.value; $b('#s-psout').textContent = e.target.value; upd(() => {}); };
      const shape = $b('#s-shape'); if (shape) shape.onchange = (e) => upd(() => { s.pointShape = e.target.value; });
      $b('#s-stroke').oninput = (e) => upd(() => { s.stroke = e.target.value; });
      $b('#s-sw').oninput = (e) => { s.strokeWidth = +e.target.value; $b('#s-swout').textContent = e.target.value; upd(() => {}); };
      $b('#s-dash').onchange = (e) => upd(() => { s.dash = e.target.value; });
      $b('#s-nostroke').onchange = (e) => { s.strokeWidth = e.target.checked ? 0 : 1; $b('#s-sw').value = s.strokeWidth; $b('#s-swout').textContent = s.strokeWidth; upd(() => {}); };
      bindLabelControls(st, holder, () => { applyLayerState(st); saveProject(); });
      $b('#s-reset').onclick = () => { st.sym = defaultSym(m); st.labels = defaultLabels(m); st.reclass = null; applyReclass(st, false); applyLayerState(st); saveProject(); refreshLegend(); draw(); toast('Style reset'); };
    }
    draw();
    first; // keep linter quiet
  });
}
function labelControls(st) {
  const l = st.labels || defaultLabels(st.meta), fields = st.meta.fields || [];
  return `<div class="frow"><label>Field</label><select id="l-field"><option value="">(no labels)</option>${fields.map((f) => `<option value="${esc(f.name)}"${l.field === f.name ? ' selected' : ''}>${esc(f.label || f.name)}</option>`).join('')}</select></div>
    <div class="frow"><label>Size</label><input id="l-size" type="range" min="7" max="30" value="${l.size || 11}"><b id="l-sizeout">${l.size || 11}</b></div>
    <div class="frow"><label>Min zoom</label><input id="l-minz" type="range" min="3" max="16" step="0.5" value="${l.minZoom ?? 8}"><b id="l-minzout">${l.minZoom ?? 8}</b></div>
    <div class="frow"><label>Colour</label><input id="l-color" type="color" value="${(l.color || '#16201b').slice(0, 7)}">
      <label class="chk"><input id="l-halo" type="checkbox"${l.halo !== false ? ' checked' : ''}> Halo</label>
      <label class="chk"><input id="l-bold" type="checkbox"${l.bold !== false ? ' checked' : ''}> Bold</label></div>`;
}
function bindLabelControls(st, root, apply) {
  const l = st.labels || (st.labels = defaultLabels(st.meta));
  const $b = (q) => root.querySelector(q);
  $b('#l-field').onchange = (e) => { l.field = e.target.value || null; l.on = !!l.field; apply(); renderLayerLists(); };
  $b('#l-size').oninput = (e) => { l.size = +e.target.value; $b('#l-sizeout').textContent = e.target.value; apply(); };
  $b('#l-minz').oninput = (e) => { l.minZoom = +e.target.value; $b('#l-minzout').textContent = e.target.value; apply(); };
  $b('#l-color').oninput = (e) => { l.color = e.target.value; apply(); };
  $b('#l-halo').onchange = (e) => { l.halo = e.target.checked; apply(); };
  $b('#l-bold').onchange = (e) => { l.bold = e.target.checked; apply(); };
}
function toolLabels(preferred) {
  openModal('Feature labels', (body) => {
    const holder = document.createElement('div'); body.appendChild(holder);
    layerPicker(body, () => draw(), (st) => ['polygon', 'line', 'point'].includes(st.meta.kind), preferred);
    function draw() {
      const st = L.get(body.querySelector('select').value); if (!st) return;
      if (!st.on) setLayer(st.meta.id, true);
      if (!st.obj) { holder.innerHTML = '<p class="empty">Loading…</p>'; loadLayer(st).then(draw); return; }
      holder.innerHTML = `<p class="muted">Pick a field to write on the map, then tune how it looks. Labels never cover the map before the minimum zoom.</p>${labelControls(st)}`;
      bindLabelControls(st, holder, () => { applyLayerState(st); saveProject(); renderLayerLists(); });
    }
    draw();
  });
}

// ------------------------------------------------ tool: reclassify
function toolReclass(preferred) {
  openModal('Reclassify', (body) => {
    const holder = document.createElement('div'); body.appendChild(holder);
    layerPicker(body, () => draw(), (st) => ['polygon', 'line', 'point'].includes(st.meta.kind) && (st.meta.fields || []).some((f) => f.type === 'number'), preferred);
    function draw() {
      const st = L.get(body.querySelector('select').value); if (!st) { holder.innerHTML = '<p class="empty">No layer with numbers</p>'; return; }
      if (!st.on) setLayer(st.meta.id, true);
      if (!st.obj) { holder.innerHTML = '<p class="empty">Loading…</p>'; loadLayer(st).then(draw); return; }
      const cur = st.reclass || { field: (st.meta.fields || []).find((f) => f.type === 'number')?.name, method: 'quantile', n: 5, ramp: 'viridis' };
      holder.innerHTML = `<p class="muted">Turn a numeric field into a small number of classes and colour them with a ramp.</p>
        <div class="frow"><label>Field</label><select id="r-field">${(st.meta.fields || []).filter((f) => f.type === 'number').map((f) => `<option value="${esc(f.name)}"${cur.field === f.name ? ' selected' : ''}>${esc(f.label || f.name)}</option>`).join('')}</select></div>
        <div class="frow"><label>Method</label><select id="r-method"><option value="quantile"${cur.method === 'quantile' ? ' selected' : ''}>Quantile (equal count)</option><option value="interval"${cur.method === 'interval' ? ' selected' : ''}>Equal interval</option></select></div>
        <div class="frow"><label>Classes</label><input id="r-n" type="range" min="2" max="9" value="${cur.n}"><b id="r-nout">${cur.n}</b></div>
        <div class="frow"><label>Ramp</label><select id="r-ramp">${Object.keys(RAMPS).map((k) => `<option value="${k}"${cur.ramp === k ? ' selected' : ''}>${k}</option>`).join('')}</select></div>
        <div class="ramp" id="r-prev">${(RAMPS[cur.ramp] || RAMPS.viridis).map((c) => `<i style="background:${c}"></i>`).join('')}</div>
        <div id="r-legend" style="margin-top:10px"></div>
        <div class="frow act"><button class="btn" id="r-clear">Remove classes</button><button class="btn primary" id="r-apply">Apply</button></div>`;
      const q = (s) => holder.querySelector(s);
      const preview = () => {
        const field = q('#r-field').value, n = +q('#r-n').value, method = q('#r-method').value, ramp = q('#r-ramp').value;
        q('#r-prev').innerHTML = (RAMPS[ramp] || RAMPS.viridis).map((c) => `<i style="background:${c}"></i>`).join('');
        const vals = st.obj.features.map((f) => +f.props[field]).filter((v) => isFinite(v));
        const rc = { field, method, n, ramp, breaks: vals.length ? breaksOf(vals, n, method) : [] };
        q('#r-legend').innerHTML = reclassLegend({ reclass: rc, meta: st.meta });
      };
      q('#r-n').oninput = (e) => { q('#r-nout').textContent = e.target.value; preview(); };
      for (const id of ['#r-field', '#r-method', '#r-ramp']) q(id).onchange = preview;
      preview();
      q('#r-apply').onclick = () => {
        st.reclass = { field: q('#r-field').value, method: q('#r-method').value, n: +q('#r-n').value, ramp: q('#r-ramp').value };
        applyReclass(st); closeModal(); refreshLegend(); renderLayerLists(); saveProject();
        toast('Classified by ' + st.reclass.field);
      };
      q('#r-clear').onclick = () => { st.reclass = null; applyReclass(st); closeModal(); refreshLegend(); renderLayerLists(); saveProject(); toast('Classes removed'); };
    }
    draw();
  });
}

// ------------------------------------------------ tool: filter
function toolFilter(preferred) {
  openModal('Filter features', (body) => {
    const holder = document.createElement('div'); body.appendChild(holder);
    layerPicker(body, () => draw(), (st) => ['polygon', 'line', 'point'].includes(st.meta.kind), preferred);
    function draw() {
      const st = L.get(body.querySelector('select').value); if (!st) return;
      if (!st.obj) { holder.innerHTML = '<p class="empty">Loading…</p>'; loadLayer(st).then(draw); return; }
      const fields = st.meta.fields || [];
      const cur = st.filter || { field: fields[0]?.name, op: 'contains', value: '' };
      const values = [...new Set(st.obj.features.map((f) => f.props[cur.field]))].filter((v) => v != null && v !== '').slice(0, 300);
      holder.innerHTML = `<p class="muted">Only matching rows are drawn, identified and labelled. Other rows stay loaded — clear the filter to bring them back.</p>
        <div class="frow"><label>Field</label><select id="f-field">${fields.map((f) => `<option value="${esc(f.name)}"${cur.field === f.name ? ' selected' : ''}>${esc(f.label || f.name)}</option>`).join('')}</select></div>
        <div class="frow"><label>Condition</label><select id="f-op">${[['contains', 'contains'], ['eq', 'is exactly'], ['neq', 'is not'], ['gt', 'is more than'], ['gte', 'is at least'], ['lt', 'is less than'], ['lte', 'is at most']].map(([k, t]) => `<option value="${k}"${cur.op === k ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="frow"><label>Value</label><input id="f-value" type="text" value="${esc(cur.value ?? '')}" list="f-values"><datalist id="f-values">${values.map((v) => `<option value="${esc(v)}">`).join('')}</datalist></div>
        <div class="frow"><label>Pick</label><select id="f-pick"><option value="">— choose a value —</option>${values.map((v) => `<option>${esc(v)}</option>`).join('')}</select></div>
        <div class="frow act"><button class="btn" id="f-clear">Clear filter</button><button class="btn primary" id="f-apply">Apply</button></div>`;
      const q = (s) => holder.querySelector(s);
      q('#f-pick').onchange = (e) => { if (e.target.value) { q('#f-value').value = e.target.value; q('#f-op').value = 'eq'; } };
      q('#f-field').onchange = () => draw();
      q('#f-apply').onclick = () => {
        st.filter = { field: q('#f-field').value, op: q('#f-op').value, value: q('#f-value').value };
        applyFilter(st); closeModal(); renderLayerLists(); saveProject();
        toast(`${st.filterCount} of ${st.meta.count ?? '?'} shown`);
      };
      q('#f-clear').onclick = () => { st.filter = null; applyFilter(st); closeModal(); renderLayerLists(); saveProject(); toast('Filter cleared'); };
    }
    draw();
  });
}

// ------------------------------------------------ tool: statistics
function toolStats(preferred) {
  openModal('Layer statistics', (body) => {
    const holder = document.createElement('div'); body.appendChild(holder);
    layerPicker(body, () => draw(), (st) => ['polygon', 'line', 'point'].includes(st.meta.kind), preferred);
    function draw() {
      const st = L.get(body.querySelector('select').value); if (!st) return;
      if (!st.obj) { holder.innerHTML = '<p class="empty">Loading…</p>'; loadLayer(st).then(draw); return; }
      const m = st.meta, feats = st.obj.features;
      const rk = layerRank(st);
      let html = `<div class="statgrid">
        <div class="statbox"><b>${feats.length.toLocaleString()}</b><small>${m.kind === 'point' ? 'points' : 'features'}</small></div>
        <div class="statbox"><b>${m.fields?.length ?? 0}</b><small>attribute columns</small></div>`;
      if (rk) {
        const unit = rk.metric === 'area' ? 'km²' : 'km';
        html += `<div class="statbox"><b>${fmtNum(rk.total)}</b><small>total ${rk.metric} (${unit})</small></div>
          <div class="statbox"><b>${fmtNum(rk.total / Math.max(1, rk.n))}</b><small>average ${rk.metric} (${unit})</small></div>
          <div class="statbox"><b>${fmtNum(rk.sorted[0]?.v)}</b><small>largest (${unit})</small></div>
          <div class="statbox"><b>${fmtNum(rk.sorted[rk.sorted.length - 1]?.v)}</b><small>smallest (${unit})</small></div>`;
      }
      html += '</div>';
      if (rk) {
        html += `<h4>Biggest features</h4><table class="mini"><tr><th>#</th><th>Feature</th><th>${rk.metric} (${rk.metric === 'area' ? 'km²' : 'km'})</th></tr>` +
          rk.sorted.slice(0, 8).map((r, i) => `<tr><td>${i + 1}</td><td>${esc(titleOf(st.obj, feats[r.idx]))}</td><td>${fmtNum(r.v)}</td></tr>`).join('') + '</table>';
      }
      const nums = (m.fields || []).filter((f) => f.type === 'number').slice(0, 4);
      if (nums.length) {
        html += '<h4>Numeric columns</h4><table class="mini"><tr><th>Field</th><th>Min</th><th>Mean</th><th>Max</th></tr>';
        for (const f of nums) {
          const vals = feats.map((x) => +x.props[f.name]).filter((v) => isFinite(v));
          if (!vals.length) continue;
          const sum = vals.reduce((a, b) => a + b, 0);
          html += `<tr><td>${esc(f.label || f.name)}</td><td>${fmtNum(Math.min(...vals))}</td><td>${fmtNum(sum / vals.length)}</td><td>${fmtNum(Math.max(...vals))}</td></tr>`;
        }
        html += '</table>';
      }
      holder.innerHTML = html;
    }
    draw();
  });
}

// ------------------------------------------------ tool: compare fields / histogram
function toolChart(preferred) {
  openModal('Chart a field', (body) => {
    body.innerHTML = `<p class="hint">Pick any column: numeric columns are binned into a histogram, text columns are ranked by how often each value occurs.</p>
      <div id="c-picker"></div><div id="c-field"></div>
      <div class="hint" id="c-note"></div>
      <div id="c-out" class="chart"></div>`;
    const picker = body.querySelector('#c-picker'), fieldHolder = body.querySelector('#c-field'), out = body.querySelector('#c-out');
    layerPicker(picker, () => drawField(), (st) => (st.meta.fields || []).length > 0, preferred);
    drawField();

    function drawField() {
      const lid = picker.querySelector('select')?.value;
      const st = L.get(lid); if (!st) { out.innerHTML = '<p class="empty">No layer with columns is switched on.</p>'; return; }
      if (!st.obj) { out.innerHTML = '<p class="empty">Loading…</p>'; loadLayer(st).then(drawField); return; }
      const nums = (st.meta.fields || []).filter((f) => f.type === 'number');
      fieldHolder.innerHTML = '';
      fieldSelect(fieldHolder, st, () => render(), 'any', nums[0]?.name);
      render();
      function render() {
        const field = fieldHolder.querySelector('select')?.value;
        if (!field) { out.innerHTML = '<p class="hint">This layer has no attribute columns to chart.</p>'; return; }
        const vals = [];
        for (const f of st.obj.features) {
          if (f.hidden) continue;
          const [wx, wy] = labelAnchor(f);
          if (clip && !map.containsClip(wx, wy)) continue;
          const v = f.props?.[field];
          if (v == null || v === '') continue;
          vals.push(v);
        }
        const numeric = vals.length > 0 && vals.every((v) => isFinite(+v));
        let bars;
        if (numeric) {
          const nums2 = vals.map(Number).sort((a, b) => a - b);
          const lo = nums2[0], hi = nums2[nums2.length - 1];
          const K = Math.min(12, Math.max(3, Math.round(Math.sqrt(nums2.length))));
          const w = (hi - lo) || 1, bins = new Array(K).fill(0);
          for (const v of nums2) bins[Math.min(K - 1, Math.floor((v - lo) / w * K))]++;
          bars = bins.map((n, k) => [`${fmtNum(lo + (k / K) * w)} – ${fmtNum(lo + ((k + 1) / K) * w)}`, n]);
        } else {
          const m = new Map();
          for (const v of vals) m.set(String(v), (m.get(String(v)) || 0) + 1);
          bars = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
        }
        const max = Math.max(1, ...bars.map((b) => b[1]));
        const total = bars.reduce((a, b) => a + b[1], 0);
        const fieldMeta = (st.meta.fields || []).find((f) => f.name === field);
        body.querySelector('#c-note').textContent = clip
          ? 'Counting only features inside the focus area.'
          : 'Counting every visible feature of this layer.';
        out.innerHTML = bars.length
          ? bars.map(([l, n]) => `<div class="brow"><span title="${esc(String(l))}">${esc(String(l).slice(0, 28))}</span><span class="barwrap"><i style="width:${Math.max(1, 100 * n / max)}%"></i></span><b>${fmtNum(n)}</b></div>`).join('')
            + `<p class="hint">${fmtNum(total)} feature${total === 1 ? '' : 's'} with a value · ${numeric ? bars.length + ' equal-width bins' : 'top ' + bars.length + ' values'}</p>`
            + (fieldMeta?.uom ? `<p class="hint">Unit: ${esc(fieldMeta.uom)}</p>` : '')
          : '<p class="hint">No values to count here' + (clip ? ' — the focus area may not contain any feature of this layer.' : '.') + '</p>';
      }
    }
  });
}

// ------------------------------------------------ view: reset, full screen, back
function resetView() {
  stopFocus();
  for (const st of L.values()) if (st.filter) { st.filter = null; applyFilter(st, false); }
  map.selection = null;
  home();
  renderLayerLists(); refreshLegend(); map.render();
  saveProject();
  toast('View reset');
}
function toggleFullscreen() {
  const d = document;
  if (d.fullscreenElement || d.webkitFullscreenElement) {
    (d.exitFullscreen || d.webkitExitFullscreen)?.call(d);
  } else {
    const el = d.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) { toast('This browser cannot go full screen'); return; }
    Promise.resolve(req.call(el)).catch(() => toast('Full screen was blocked by the browser'));
  }
}
dashFullscreen();
function dashFullscreen() {
  const onChange = () => {
    const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
    $('#btn-full')?.classList.toggle('on', on);
    setTimeout(() => map.resize?.(), 120);
  };
  document.addEventListener('fullscreenchange', onChange);
  document.addEventListener('webkitfullscreenchange', onChange);
}
function goBack() {
  const prev = viewHist.pop();
  if (!prev) { toast('No earlier view'); return; }
  map.setView(prev.c[0], prev.c[1], prev.c[2]);
  if (prev.stack) { for (const id of [...stack]) if (!prev.stack.includes(id)) setLayer(id, false, { quiet: true }); for (const id of prev.stack) if (!stack.includes(id)) setLayer(id, true, { quiet: true }); }
  updateFocusUI();
}

// ------------------------------------------------ tool: zoom to layer
function toolZoomLayer() {
  openModal('Zoom to a layer', (body) => {
    const holder = document.createElement('div'); body.appendChild(holder);
    layerPicker(body, () => draw(), (st) => !!st.meta.bounds);
    function draw() {
      const st = L.get(body.querySelector('select').value); if (!st) return;
      const b = st.meta.bounds;
      holder.innerHTML = `<p class="muted">Extent: ${b.map((v) => v.toFixed(2)).join(', ')}</p>
        <div class="frow act"><button class="btn primary" id="z-go">Fit this layer</button></div>`;
      holder.querySelector('#z-go').onclick = () => { if (!st.on) setLayer(st.meta.id, true); zoomToLayer(st.meta); closeModal(); };
    }
    draw();
  });
}

// ------------------------------------------------ tool: import
function toolImport() {
  openModal('Import GeoJSON', (body) => {
    body.innerHTML = `<p class="muted">Bring a GeoJSON file (points, lines or polygons) onto the map. It is added as a layer for this session and can be styled, labelled and exported like any other layer.</p>
      <div class="frow"><label>File</label><input id="i-file" type="file" accept=".geojson,.json,application/geo+json,application/json"></div>
      <div class="frow"><label>or paste</label><textarea id="i-text" placeholder='{"type":"FeatureCollection","features":[…]}'></textarea></div>
      <div class="frow act"><button class="btn primary" id="i-add">Add to the map</button></div>`;
    const add = async (text) => {
      let gj;
      try { gj = JSON.parse(text); } catch (e) { toast('That is not valid JSON'); return; }
      const feats = (gj.features || (gj.type === 'Feature' ? [gj] : [])).map(convertFeature).filter(Boolean);
      if (!feats.length) { toast('No usable geometry found'); return; }
      const kindOf = (t) => t === 'poly' ? 'polygon' : t === 'line' ? 'line' : 'point';
      const kind = kindOf(feats[0].type);
      const id = 'import_' + Date.now().toString(36);
      let box = [1e9, 1e9, -1e9, -1e9];
      feats.forEach((f, i) => { f.fill = f.stroke = f.fill0 = '#8e44ad'; f.idx = i; for (let k = 0; k < 2; k++) { box[k] = Math.min(box[k], f.bb[k]); box[k + 2] = Math.max(box[k + 2], f.bb[k + 2]); } });
      const meta = { id, table: id, kind, group: 'imported', label: 'Imported ' + (feats.length === 1 ? 'feature' : feats.length + ' features'), description: 'Imported GeoJSON', count: feats.length, fields: Object.keys(feats[0].props || {}).map((n) => ({ name: n, type: typeof feats[0].props[n] === 'number' ? 'number' : 'text', label: n })), style: { mode: 'single', color: '#8e44ad' }, labelField: null, bounds: [unX(box[0]), unY(box[3]), unX(box[2]), unY(box[1])], file: null };
      catalog.layers.push(meta); baseOrder.push(id);
      if (!catalog.groups.some((g) => g.id === 'imported')) catalog.groups.push({ id: 'imported', label: 'Imported', order: 99 });
      L.set(id, { meta, on: false, opacity: 0.8, loading: false, obj: null, order: baseOrder.length, sym: null, labels: null, filter: null, reclass: null, stats: null });
      map.addLayer({ id, kind, visible: false, opacity: 0.8, order: baseOrder.length, features: feats, style: meta.style, labelField: null, labels: null, sym: null });
      L.get(id).obj = map.getLayer(id);
      L.get(id).sym = defaultSym(meta); L.get(id).labels = defaultLabels(meta);
      applyLayerState(L.get(id));
      closeModal(); renderLayerLists();
      await setLayer(id, true);
      zoomToLayer(meta); openSheet('layers');
      toast(feats.length + ' feature(s) imported');
    };
    body.querySelector('#i-file').onchange = async (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      add(await f.text());
    };
    body.querySelector('#i-add').onclick = () => {
      const t = body.querySelector('#i-text').value.trim();
      if (!t) { toast('Choose a file or paste GeoJSON'); return; }
      add(t);
    };
  });
}

// ------------------------------------------------ tool: export
function toolExport() {
  openModal('Export data', (body) => {
    body.innerHTML = `<p class="muted">Everything stays on your device — these are plain downloads.</p>
      <div class="frow act" style="justify-content:stretch"><button class="btn primary" id="e-png">${icon('camera')} Map picture (PNG)</button></div>
      <div class="frow act" style="justify-content:stretch"><button class="btn" id="e-geo">${icon('down')} Visible layers as GeoJSON</button></div>
      <div class="frow act" style="justify-content:stretch"><button class="btn" id="e-csv">${icon('table')} Attribute table as CSV</button></div>
      <div class="frow"><label>CSV layer</label><select id="e-layer"></select></div>`;
    const sel = body.querySelector('#e-layer');
    sel.innerHTML = [...L.values()].filter((s) => s.meta.kind !== 'image').map((s) => `<option value="${esc(s.meta.id)}">${esc(s.meta.label)}</option>`).join('');
    body.querySelector('#e-png').onclick = () => { closeModal(); saveMapImage(); };
    body.querySelector('#e-geo').onclick = async () => {
      const out = [];
      for (const id of stack) {
        const st = L.get(id); if (!st.obj?.features) continue;
        for (const f of st.obj.features) if (!f.hidden) out.push({ type: 'Feature', properties: { _layer: st.meta.label, ...f.props }, geometry: toGeoJSON(f) });
      }
      if (!out.length) { toast('No vector layers are on the map'); return; }
      download('visible-layers.geojson', JSON.stringify({ type: 'FeatureCollection', features: out }), 'application/geo+json');
      toast(out.length + ' features exported');
    };
    body.querySelector('#e-csv').onclick = async () => {
      const st = L.get(sel.value); if (!st) return;
      if (!st.obj) await loadLayer(st);
      if (st.meta.kind === 'raster') { toast('Rasters have no rows to export — open the class table instead'); return; }
      const cols = (st.meta.fields || []).map((f) => f.name);
      const q = (v) => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? '');
      const csv = [cols.join(','), ...st.obj.features.filter((f) => !f.hidden).map((f) => cols.map((c) => q(f.props[c])).join(','))].join('\n');
      download(st.meta.id + '.csv', csv, 'text/csv');
    };
  });
}

// ------------------------------------------------ tool: attribute table picker
function toolTable() {
  openModal('Attribute table', (body) => {
    const holder = document.createElement('div'); body.appendChild(holder);
    layerPicker(body, () => draw());
    function draw() {
      const st = L.get(body.querySelector('select').value); if (!st) return;
      holder.innerHTML = `<p class="muted">Legends live in these tables: the class names, colours and extra columns of every layer are its own attributes.</p>
        <div class="frow act"><button class="btn primary" id="t-open">Open the table</button></div>`;
      holder.querySelector('#t-open').onclick = () => { closeModal(); openTable(st.meta.id); };
    }
    draw();
  });
}

// ------------------------------------------------ tool: distance & bearing
function toolBearing() {
  openModal('Distance & bearing', (body) => {
    body.innerHTML = `<p class="muted">Great-circle distance and initial bearing between two points.</p>
      <div class="frow"><label>From lat</label><input id="b-alat" type="number" step="0.0001" placeholder="9.0765"><label>lon</label><input id="b-alon" type="number" step="0.0001" placeholder="7.3986"></div>
      <div class="frow"><label>To lat</label><input id="b-blat" type="number" step="0.0001" placeholder="6.5244"><label>lon</label><input id="b-blon" type="number" step="0.0001" placeholder="3.3792"></div>
      <div class="frow act"><button class="btn" id="b-use">Use map centre as “from”</button><button class="btn primary" id="b-go">Calculate</button></div>
      <div id="b-out"></div>`;
    body.querySelector('#b-use').onclick = () => { const c = map.center(); body.querySelector('#b-alat').value = +c[1].toFixed(5); body.querySelector('#b-alon').value = +c[0].toFixed(5); };
    body.querySelector('#b-go').onclick = () => {
      const a = [+body.querySelector('#b-alat').value, +body.querySelector('#b-alon').value];
      const b = [+body.querySelector('#b-blat').value, +body.querySelector('#b-blon').value];
      if (!a.every(isFinite) || !b.every(isFinite)) { toast('Fill in all four numbers'); return; }
      const d = haversineKm(a, b);
      const y = Math.sin((b[0] - a[0]) * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180);
      const x = Math.cos(a[1] * Math.PI / 180) * Math.sin(b[1] * Math.PI / 180) - Math.sin(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.cos((b[0] - a[0]) * Math.PI / 180);
      const brg = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
      body.querySelector('#b-out').innerHTML = `<div class="statgrid">
        <div class="statbox"><b>${fmtNum(d)} km</b><small>distance</small></div>
        <div class="statbox"><b>${brg.toFixed(1)}°</b><small>initial bearing</small></div></div>
        <div class="frow act"><button class="btn" id="b-fit">Show both on the map</button></div>`;
      body.querySelector('#b-fit').onclick = () => {
        map.fitBounds([Math.min(a[1], b[1]), Math.min(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[0], b[0])], 80);
        closeModal();
      };
    };
  });
}

// ------------------------------------------------ measure
function startMeasure(mode) {
  measure = { pts: [], mode };
  $('#measurebar').hidden = false;
  updateToolState(); updateMeasure();
  if (mobileQ.matches) closeSheet();
  toast(mode === 'area' ? 'Tap corners of the area' : 'Tap points along the line');
}
function updateMeasure() {
  if (!measure) return;
  const p = measure.pts;
  let txt;
  if (measure.mode === 'area') {
    if (p.length < 3) txt = `Tap ${3 - p.length} more corner(s)`;
    else {
      const a = ringAreaKm2(p), per = ringPerimeterKm(p);
      txt = `${fmtNum(a)} km² · edge ${per.toFixed(1)} km`;
    }
  } else {
    let d = 0; for (let i = 1; i < p.length; i++) d += haversineKm(p[i - 1], p[i]);
    txt = p.length < 2 ? 'Tap the map to add points' : `${d.toFixed(d < 10 ? 2 : 1)} km`;
  }
  $('#measuretext').textContent = txt;
  map.render();
}
$('#measureclear').onclick = () => { if (measure) { measure.pts = []; updateMeasure(); } };
$('#measuredone').onclick = () => { measure = null; $('#measurebar').hidden = true; updateToolState(); map.render(); };

// ---------------------------------------------------------------- map extras
map.extra.push((ctx, m) => {
  if (userLoc) {
    const [x, y] = m.screenOf(userLoc[0], userLoc[1]);
    const r = userLoc[2] / (156543.03 * Math.cos(userLoc[1] * Math.PI / 180) / Math.pow(2, m.zoom));
    ctx.fillStyle = 'rgba(30,120,255,.15)'; ctx.beginPath(); ctx.arc(x, y, Math.max(6, r), 0, 6.3); ctx.fill();
    ctx.fillStyle = '#1e78ff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 7, 0, 6.3); ctx.fill(); ctx.stroke();
  }
  if (measure && measure.pts.length) {
    const closed = measure.mode === 'area' && measure.pts.length > 2;
    ctx.beginPath();
    measure.pts.forEach((p, i) => { const [x, y] = m.screenOf(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    if (closed) { ctx.closePath(); ctx.fillStyle = 'rgba(255,59,107,.22)'; ctx.fill(); }
    ctx.strokeStyle = '#ff3b6b'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#ff3b6b'; ctx.lineWidth = 2;
    for (const p of measure.pts) { const [x, y] = m.screenOf(p[0], p[1]); ctx.beginPath(); ctx.arc(x, y, 5, 0, 6.3); ctx.fill(); ctx.stroke(); }
  }
});

// ---------------------------------------------------------------- search
const searchEl = $('#search'), sInput = $('#search-input'), sRes = $('#search-results');
$('#btn-search').onclick = () => { searchEl.hidden = false; sInput.value = ''; sRes.innerHTML = '<p class="empty">Type a place, rock unit, mineral or layer name.<br>Features are searched in the layers that are turned on.</p>'; sInput.focus(); };
$('#search-close').onclick = () => { searchEl.hidden = true; };
let sTimer; sInput.addEventListener('input', () => { clearTimeout(sTimer); sTimer = setTimeout(runSearch, 160); });
function runSearch() {
  const q = sInput.value.trim().toLowerCase(); if (q.length < 2) { sRes.innerHTML = ''; return; }
  const out = [];
  for (const s of L.values()) if (s.meta.label.toLowerCase().includes(q) || s.meta.table.includes(q)) out.push(`<button class="sres" data-layer="${esc(s.meta.id)}">${icon(s.meta.kind)}<span><b>${esc(s.meta.label)}</b><small>Layer · ${esc(KIND_LABEL[s.meta.kind])}</small></span></button>`);
  let n = 0;
  for (const st of L.values()) {
    const l = st.obj; if (!l || !l.features || !st.on) continue;
    for (let i = 0; i < l.features.length && n < 60; i++) {
      const f = l.features[i]; if (f.hidden) continue;
      for (const v of Object.values(f.props)) if (typeof v === 'string' && v.toLowerCase().includes(q)) {
        out.push(`<button class="sres" data-layer="${esc(l.id)}" data-i="${i}">${icon(st.meta.kind)}<span><b>${esc(titleOf(l, f))}</b><small>${esc(st.meta.label)}</small></span></button>`); n++; break;
      }
    }
  }
  sRes.innerHTML = out.join('') || '<p class="empty">No results. Turn on the layer you want to search.</p>';
}
sRes.addEventListener('click', (e) => {
  const b = e.target.closest('.sres'); if (!b) return;
  const id = b.dataset.layer, st = L.get(id); searchEl.hidden = true;
  if (b.dataset.i === undefined) {
    if (st.meta.kind === 'table') openTable(id);
    else { setLayer(id, true); zoomToLayer(st.meta); openSheet('layers'); }
    return;
  }
  const f = st.obj.features[+b.dataset.i];
  map.selection = { feature: f, layer: st.obj };
  map.zoomToFeature(f, 70);
  showResults([{ layer: st.obj, feature: f }]); openSheet('info', true);
});

// ---------------------------------------------------------------- table modal
async function openTable(id) {
  const st = L.get(id); if (!st) return;
  const m = st.meta;
  let cols = [], rows = [];
  $('#tm-title').textContent = m.label; $('#tm-body').innerHTML = '<p class="empty">Loading…</p>';
  $('#tablemodal').hidden = false; $('#tm-filter').value = '';
  try {
    if (m.kind === 'raster') {
      // the legend of this raster is its attribute table: class name + every legend column
      const attrs = (m.attributes || []).filter((a) => a.name !== 'class');
      const key = m.legendKey || 'raster_value';
      cols = ['class', ...attrs.map((a) => a.name)];
      rows = (m.classes || []).map((c) => [c.label || 'Class ' + c.value,
        ...attrs.map((a) => a.name === key ? c.value : (c.props?.[a.name] ?? ''))]);
    } else if (m.kind === 'table') {
      const gj = await (await fetch(m.file)).json();
      cols = gj.columns || []; rows = gj.rows || [];
    } else if (m.kind === 'image') {
      $('#tm-body').innerHTML = '<p class="empty">A scanned picture has no attributes.</p>'; return;
    } else {
      if (!st.obj) await loadLayer(st);
      cols = (m.fields || []).map((f) => f.name);
      rows = st.obj.features.map((f) => cols.map((c) => f.props[c] ?? ''));
    }
  } catch (e) { $('#tm-body').innerHTML = '<p class="empty">Could not load this table.</p>'; return; }
  const labels = Object.fromEntries((m.fields || []).map((f) => [f.name, f.label]));
  const extra = Object.fromEntries((m.attributes || []).map((a) => [a.name, a.label]));
  let shown = 300, q = '';
  const draw = () => {
    const filt = q ? rows.filter((r) => r.some((v) => String(v).toLowerCase().includes(q))) : rows;
    $('#tm-body').innerHTML = `<table><thead><tr>${cols.map((c) => `<th>${esc(labels[c] || extra[c] || c.replace(/_/g, ' '))}</th>`).join('')}</tr></thead><tbody>${filt.slice(0, shown).map((r) => `<tr>${r.map((v) => `<td title="${esc(v)}">${esc(typeof v === 'number' ? fmtNum(v) : v)}</td>`).join('')}</tr>`).join('')}</tbody></table>` +
      `<div class="muted" style="padding:8px 12px">${filt.length.toLocaleString()} rows${filt.length > shown ? ` (showing ${shown})` : ''}</div>` +
      (filt.length > shown ? '<button class="more">Show more</button>' : '');
    const mb = $('#tm-body .more'); if (mb) mb.onclick = () => { shown += 400; draw(); };
  };
  $('#tm-filter').oninput = (e) => { q = e.target.value.trim().toLowerCase(); shown = 300; draw(); };
  draw();
}
$('#tm-close').onclick = () => { $('#tablemodal').hidden = true; };

// ---------------------------------------------------------------- view, hash, project
let hashT;
let histTimer = null, lastView = null;
function recordView() {
  clearTimeout(histTimer);
  histTimer = setTimeout(() => {
    const c = map.center(), key = `${c[0].toFixed(3)},${c[1].toFixed(3)},${map.zoom.toFixed(1)}`;
    if (lastView && lastView.key === key) return;
    if (lastView) { viewHist.push(lastView); if (viewHist.length > 25) viewHist.shift(); }
    lastView = { key, c: [c[0], c[1], map.zoom], stack: [...stack] };
    updateFocusUI();
  }, 700);
}
function onView() {
  recordView();
  const [lo, la] = map.center(); $('#coords').textContent = fmtLL(la, lo); drawScale(la);
  clearTimeout(hashT); hashT = setTimeout(pushHash, 500);
}
function drawScale(lat) {
  const mpp = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, map.zoom);
  let m = mpp * 90; const p = Math.pow(10, Math.floor(Math.log10(m))); const f = m / p;
  m = (f >= 5 ? 5 : f >= 2 ? 2 : 1) * p;
  $('#scalebar i').style.width = m / mpp + 'px';
  $('#scalebar b').textContent = m >= 1000 ? m / 1000 + ' km' : m + ' m';
}
function parseHash() {
  const o = {};
  try {
    const h = new URLSearchParams(location.hash.slice(1));
    const c = h.get('c'); if (c) { const [a, b, z] = c.split(',').map(Number); if ([a, b, z].every(isFinite)) o.c = [a, b, z]; }
    if (h.get('l') != null) o.l = h.get('l').split(',').filter(Boolean);
    o.b = h.get('b');
  } catch { }
  return o;
}
function pushHash() {
  if (!catalog || booting) return;
  const [lo, la] = map.center();
  const h = `c=${la.toFixed(4)},${lo.toFixed(4)},${map.zoom.toFixed(2)}&l=${stack.join(',')}&b=${map.basemap}`;
  try { history.replaceState(null, '', '#' + h); } catch { }
}
function readProject() { try { return JSON.parse(localStorage.getItem(PKEY) || 'null'); } catch { return null; } }
function saveProject() {
  if (booting) return;
  const layers = {};
  for (const [id, st] of L) {
    const rec = { on: st.on, opacity: st.opacity };
    if (st.sym) rec.sym = st.sym;
    if (st.labels) rec.labels = st.labels;
    if (st.filter) rec.filter = st.filter;
    if (st.reclass) rec.reclass = st.reclass;
    layers[id] = rec;
  }
  try {
    const f = clip ? (clip.type === 'rect' ? { type: 'rect', wb: clip.wb, label: focusLabel } : { type: 'poly', rings: clip.rings.map((r) => Array.from(r)), label: focusLabel }) : null;
    localStorage.setItem(PKEY, JSON.stringify({ v: 1, layers, stack, annotations, grid: gridOn, clip: f }));
  } catch { }
}
let projTimer;
function saveProjectSoon() { clearTimeout(projTimer); projTimer = setTimeout(saveProject, 400); }
function restoreProject(p) {
  if (!p) return;
  if (p.grid) { gridOn = true; map.setGrid(true); }
  if (Array.isArray(p.annotations)) annotations = p.annotations.filter((a) => a && isFinite(a.lon) && isFinite(a.lat));
  for (const [id, rec] of Object.entries(p.layers || {})) {
    const st = L.get(id); if (!st || !rec) continue;
    if (typeof rec.opacity === 'number') st.opacity = rec.opacity;
    if (rec.sym) st.sym = rec.sym;
    if (rec.labels) st.labels = rec.labels;
    if (rec.filter) st.filter = rec.filter;
    if (rec.reclass) st.reclass = rec.reclass;
  }
}
function restoreFocus(f) {
  if (!f || (f.type !== 'rect' && f.type !== 'poly')) return;
  focusLabel = f.label || '';
  clip = f.type === 'rect' ? { type: 'rect', wb: f.wb } : { type: 'poly', rings: f.rings };
  map.setClip(clip);
  updateFocusUI();
}

function resetWork() {
  if (!confirm('Reset colours, filters, labels and panel state? The data itself is not touched.')) return;
  try { localStorage.removeItem(PKEY); } catch { }
  location.hash = ''; location.reload();
}
function download(name, text, type = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ---------------------------------------------------------------- buttons
$('#zin').onclick = () => map.zoomAt(map.W / 2, map.H / 2, 1);
$('#zout').onclick = () => map.zoomAt(map.W / 2, map.H / 2, -1);
$('#btn-home').onclick = () => home();
$('#btn-share').onclick = async () => {
  pushHash(); const url = location.href;
  try {
    if (navigator.share) await navigator.share({ title: catalog.title, url });
    else { await navigator.clipboard.writeText(url); toast('Link copied'); }
  } catch { try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { toast(url, 6000); } }
};
$('#btn-locate').onclick = () => {
  if (!navigator.geolocation) { toast('Location is not available on this device'); return; }
  toast('Finding your location…');
  navigator.geolocation.getCurrentPosition((p) => {
    userLoc = [p.coords.longitude, p.coords.latitude, p.coords.accuracy];
    map.setView(userLoc[0], userLoc[1], Math.max(map.zoom, 11)); toast('Location found');
  }, () => toast('Could not get your location'), { enableHighAccuracy: true, timeout: 12000 });
};
function buildAbout() {
  $('#about').innerHTML = `<p>${catalog.layers.length} layers in ${catalog.groups.length} groups.<br>Built from the GeoPackages on ${esc(catalog.built)} · build <code>${esc(BUILD)}</code>.</p>
    <p>Every legend now lives inside the attribute table of its own layer, so class names, colours and extra columns show up when you tap a feature. Basemaps need no API key.</p>
    <p>Readers get the viewing and analysis tools; the owner's content tools appear with <code>?author=1</code>. <b>Clip to an area</b> fades everything outside a box, a polygon or a borrowed boundary, and the analysis tools then count only what is inside it.</p>
    <p>Deploys arrive by themselves: the page checks for a new build when it loads, when you come back to the tab, and every 15 minutes, then reloads once the new version is ready.</p>`;
  console.info(`${catalog.title} · build ${BUILD}`);
}
window.addEventListener('unhandledrejection', (e) => {
  console.error('unhandled', e.reason);
  toast('Something went wrong — the details are in the browser console', 4000);
});
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (e.key === 'Escape') { if (editing) closeLabelEditor(); else if (!$('#modal').hidden) closeModal(); else if (!$('#search').hidden) $('#search').hidden = true; }
  if (e.key === 'g' || e.key === 'G') { gridOn = !gridOn; map.setGrid(gridOn); updateToolState(); saveProject(); }
});
// handy when something needs a closer look from the browser console
window.__nwg = {
  map, L, build: BUILD, get stack() { return stack; }, get annotations() { return annotations; },
  rasterClassAnchor, layerRank, showResults,
  // focus / analysis surface (also handy for scripting the map from the console)
  get clip() { return clip; }, get draw() { return draw; }, get author() { return AUTHOR; },
  setFocus, stopFocus, focusFromLonLat, focusFromRect, focusFromFeature, focusAreaKm2, focusPerimeterKm,
  startDraw, endDraw, startPick, toolClip, toolAoi, toolQuery, runQuery, toolChart, resetView, toggleFullscreen,
  get viewHist() { return viewHist; }, goBack, onView,
};

start();
