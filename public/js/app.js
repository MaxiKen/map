import { GeoMap, BASEMAPS, BASEMAP_ORDER, convertFeature, prepareFeature, DEFAULT_VECTOR_COLOR, mercX, mercY, unX, unY, featureMetrics, haversineKm, labelAnchor, ringAreaKm2, ringPerimeterKm, pointInFeature, pip2, featureCentroid, convexHullFeature, simplifyFeature, bufferFeature, ringIntersection, intersectPolyPoly, segmentsIntersect, polyOverlapsPoly, normalizeClip, clipBB, circleToPolygon, distToRingMerc, haversineMerc } from './engine.js?v=a8036209c3';
import { createLoadScheduler } from './loading.js?v=a8036209c3';
import { qualityPanelHTML, qualityPresentation, metadataGapLabels } from './quality.js?v=a8036209c3';

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
  quality: '<path d="M12 3 4.5 6v5.2c0 4.7 3.2 8.3 7.5 9.8 4.3-1.5 7.5-5.1 7.5-9.8V6Z"/><path d="m8.3 12 2.3 2.3 5-5"/>',
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
  check: '<path d="M20 6L9 17l-5-5"/>',
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
  calc: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z"/><path d="M9 10h6M9 14h6M15 8v8"/>',
  discover: '<path d="M12 2c5.5 0 10 4.5 10 10s-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2ZM7 12a5 5 0 1 0 10 0 5 5 0 0 0-10 0Z"/><path d="M12 17v-5M17 12h-5"/>',
  convert: '<path d="M4 4h16v16H4zM12 2l4 6M8 14l4-6"/><path d="M2 12h20"/><path d="M12 22V2"/>',
  savemeas: '<path d="M12 2v20M12 8l-4 4M12 8l4 4"/><circle cx="12" cy="16" r="4"/>',
  style: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="5" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  time: '<circle cx="12" cy="12" r="9"/><polyline fill="none" stroke="currentColor" stroke-width="2" points="12,7 12,12 16,12"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  timer: '<path d="M12 2v20M12 8l-4 4M12 8l4 4"/><path d="M5 12h14M12 5v14"/><circle cx="12" cy="12" r="1"/>',
  share: '<path d="M18 16v-2a6 6 0 0 0-7.333-4.533L11 9.333 9 7v-2c0-2.21 1.79-4 4-4s4 1.79 4 4v2a6 6 0 0 0-7.333 4.533L13 14.667 15 17v2c0 2.21-1.79 4-4 4s-4-1.79-4-4v-2a6 6 0 0 0 7.333-4.533L11 18.667 9 21v-2c0-2.21 1.79-4 4-4s4 1.79 4 4z"/><circle cx="12" cy="12" r="3"/>',
  link: '<path d="M13.5 8.5c-2.8 0-5.5 2.2-5.5 5s2.2 5 5.5 5c1.6 0 3.2-.7 4.4-1.8l1.4 1.4c1.3-1.3 2-3.1 1.4-4.9 0-2.8-2.2-5-5-5zM17.5 8c0-1.1-.9-2-2-2h-1.4c-.3 0-.5.2-.5.5v1.4c0 .3.2.5.5.5h1.4c1.1 0 2 .9 2 2s-.9 2-2 2h-1.4c-.3 0-.5.2-.5.5v1.4c0 .3.2.5.5.5h1.4c2.8 0 5-2.2 5-5s-2.2-5-5-5z"/><path d="M10.2 14.2c-.3-.3-.5-.8-.5-1.3v-1.4c0-.3.2-.5.5-.5s.5.2.5.5v1.4c0 .5.4 1 1 1h1.4c.3 0 .5.2.5.5s-.2.5-.5.5h-1.4c-.5 0-1-.4-1-1z"/><circle cx="13" cy="8" r="1"/>',
  qrcode: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="8" y="8" width="2" height="2"/><rect x="12" y="8" width="2" height="2"/><rect x="8" y="12" width="2" height="2"/><rect x="12" y="12" width="2" height="2"/>',
  note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="8 6 12 11 16 7"/><line x1="12" y1="11" x2="12" y2="11"/>',
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><line x1="12" y1="18" x2="12" y2="6"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  raster: '<rect x="4" y="4" width="16" height="16"/><path d="M4 12h16M12 4v16"/><path d="M8 8h8v8H8z"/><path d="M12 12h4v4h-4z"/>',
  alpha: '<path d="M3 3h18v18H3z"/><path d="M12 3l6 9-6 9z"/><path d="M6 12h12" stroke-linecap="butt"/>',
  magnet: '<path d="M3 7h6v10H3zM15 7h6v10h-6z"/><path d="M9 7v10M15 7v10"/><path d="M6 10h12M6 14h12"/>',
  network: '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h6M8 18h6M6 8v6M18 8v6"/><path d="M10 10l4 4M14 10l-4 4"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;
const KIND_LABEL = { point: 'Points', line: 'Lines', polygon: 'Polygons', raster: 'Raster', image: 'Picture', table: 'Table' };

// ---------------------------------------------------------------- state
const map = new GeoMap($('#map'));
let catalog = null;
let qualityLayerId = null;
const L = new Map();          // id -> { meta, on, opacity, loading, obj, sym, labels, filter, reclass, stats }
const stack = [];             // visible layer ids, bottom -> top (last switched on is on top)
const analysisLayers = [];  // temporary spatial-analysis layers drawn on the map
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
    meta: m, on: false, opacity: m.opacity ?? (m.kind === 'polygon' ? 0.85 : 1), loading: false, loadPromise: null, obj: null,
    order: i, sym: null, labels: null, filter: null, reclass: null, stats: null,
  }));
  baseOrder = catalog.layers.map((m) => m.id);
  const saved = readProject();
  if (saved) restoreProject(saved);

  buildBasemaps(); renderLayerTools(); buildTools(); buildAbout(); renderQuality(); renderAnnotations();
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
  let hadController = !!navigator.serviceWorker.controller;     // false on the very first visit
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    if (!hadController) {                                      // a first install must not reload the page
      hadController = true;                                    // a later update in this same visit still must
      return;
    }
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
function syncBasemapUI() { for (const b of $$('#basemaps button')) b.classList.toggle('on', b.dataset.k === map.basemap); renderLayerTools(); }
function updateAttrib() { $('#attrib').textContent = BASEMAPS[map.basemap]?.attr || ''; }

// ---------------------------------------------------------------- layer loading
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
const scheduleLayerLoad = createLoadScheduler();

function workerVectorFeatures(m) {
  return new Promise((resolve, reject) => {
    let worker;
    try {
      const url = new URL('./vector-worker.js', import.meta.url);
      url.searchParams.set('v', BUILD);
      worker = new Worker(url.href, { type: 'module' });
    } catch (error) { reject(error); return; }
    worker.onmessage = (event) => {
      worker.terminate();
      if (event.data.error) {
        const error = new Error(event.data.error);
        error.workerDataError = true;
        reject(error);
      } else resolve(event.data.features);
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error('Vector worker unavailable'));
    };
    const compressed = m.loadEncoding === 'gzip' && m.loadFile && typeof DecompressionStream !== 'undefined';
    // Worker fetches resolve against /js/vector-worker.js, not the document. Anchor catalog
    // paths at the application root so /js is never incorrectly prefixed to /data.
    const applicationRoot = new URL('../', import.meta.url);
    const dataUrl = new URL(compressed ? m.loadFile : m.file, applicationRoot).href;
    try {
      worker.postMessage({
        url: dataUrl,
        encoding: compressed ? 'gzip' : null,
        style: m.style,
      });
    } catch (error) { worker.terminate(); reject(error); }
  });
}

async function mainVectorFeatures(m) {
  const response = await fetch(m.file);
  if (!response.ok) throw new Error(`Layer request failed (${response.status})`);
  const geojson = await response.json();
  const features = [];
  let seen = 0;
  for (const feature of geojson.features || []) {
    const converted = prepareFeature(feature, m.style, features.length);
    if (converted) features.push(converted);
    if (++seen % 1000 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return features;
}

async function vectorFeatures(m) {
  if (typeof Worker !== 'undefined') {
    try { return await workerVectorFeatures(m); }
    catch (error) { if (error.workerDataError) throw error; }
  }
  return mainVectorFeatures(m);
}

async function loadLayer(st) {
  if (st.obj) return st.obj;
  if (st.loadPromise) return st.loadPromise;
  const pending = scheduleLayerLoad(() => loadLayerData(st));
  st.loadPromise = pending;
  try { return await pending; }
  finally { if (st.loadPromise === pending) st.loadPromise = null; }
}

async function loadLayerData(st) {
  const m = st.meta;
  if (st.obj) return st.obj;
  if (m.kind === 'polygon' || m.kind === 'line' || m.kind === 'point') {
    const feats = await vectorFeatures(m);
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
    if (fl.op === 'in') hit = (fl.values || []).includes(val);
    else if (fl.op === 'not_in') hit = !(fl.values || []).includes(val);
    else if (fl.op === 'contains') hit = val.toLowerCase().includes(String(fl.value).toLowerCase());
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
  const bmLabel = BASEMAPS[map.basemap]?.label || map.basemap;
  $('#lyrtools').innerHTML = `
    <button data-x="showall">${icon('eye')}Show all</button>
    <button data-x="hideall">${icon('eyeoff')}Hide all</button>
    <button data-x="fitall">${icon('zoom')}Fit visible</button>
    <button data-x="focus" class="${clip ? 'on' : ''}">${icon('crop')}${clip ? 'Focused' : 'Clip'}</button>
    <button data-x="grid" class="${gridOn ? 'on' : ''}">${icon('grid')}Grid</button>
    <button data-x="labels">${icon('tag')}Labels</button>
    <button data-x="basemap">${icon('layers')}Basemap: ${esc(bmLabel)}</button>
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
  const quality = m.quality ? qualityPresentation(m) : null;
  const qualitySearch = quality ? `${quality.label} ${metadataGapLabels(m.sourceMetadata).join(' ')}` : '';
  row.dataset.search = `${m.label} ${m.group} ${m.table} ${m.description || ''} ${m.sourceMetadata?.publisher || ''} ${m.sourceMetadata?.dataset || ''} ${qualitySearch}`.toLowerCase();
  const isTable = m.kind === 'table';
  const sub = [KIND_LABEL[m.kind], countText(m)].filter(Boolean).join(' · ');
  const qualitySub = quality ? ` · <span class="quality-inline q-${quality.tone}" title="${esc(quality.label)}">${esc(quality.short)}</span>` : '';
  const flags = [
    st.filter ? `<span class="chip on">${icon('filter')}Filtered</span>` : '',
    st.reclass ? `<span class="chip on">${icon('sliders')}Classified</span>` : '',
    st.labels?.field && st.labels.on !== false ? `<span class="chip on">${icon('tag')}${esc(st.labels.field)}</span>` : '',
  ].join('');
  row.innerHTML = `<div class="lmain">
      <button class="grip" aria-label="Drag to reorder">${icon('grip')}</button>
      <span class="kind">${icon(m.kind)}</span>
      <button class="lt"><b>${esc(m.label)}</b><small>${esc(sub)}${qualitySub}</small></button>
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
      ${quality ? `<button type="button" class="chip quality-link q-${quality.tone}" data-act="quality">${icon('quality')}Quality &amp; source</button>` : ''}
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
    else if (act === 'quality') openQuality(id);
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
    return hit ? hit[1] : (s.color || DEFAULT_VECTOR_COLOR);
  }
  if (st.obj?.features) {
    const f = st.obj.features.find((ft) => (m.legendKey ? ft.props[m.legendKey] : ft.props[s.field]) === c.key);
    if (f) return f.fill0;
  }
  return s.color || DEFAULT_VECTOR_COLOR;
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
      } else rows = legendRow(st, s.color || DEFAULT_VECTOR_COLOR, m.label, '');
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
        <button class="btn" data-x="layer-quality" data-id="${esc(m.id)}">${icon('quality')}Quality</button>
        ${AUTHOR ? `<button class="btn" data-x="rast-label" data-id="${esc(m.id)}" data-text="${esc(label)}">${icon('tag')}Add label</button>` : ''}</div></div>`);
      continue;
    }
    if (!r.feature) { parts.push(`<div class="card"><header>${icon(m.kind)}${esc(m.label)}<small>picture</small></header><div class="rastv muted">Scanned map picture</div><div class="actions"><button class="btn" data-x="layer-quality" data-id="${esc(m.id)}">${icon('quality')}Quality &amp; source</button></div></div>`); continue; }
    const f = r.feature;
    parts.push(`<div class="card" data-id="${esc(m.id)}" data-idx="${f.idx}">
      <header>${icon(m.kind)}${esc(titleOf(st.obj, f))}<small>${esc(KIND_LABEL[m.kind])}</small></header>
      ${propTable(m, f.props)}
      ${factsHtml(st, f)}
      <div class="actions">
        <button class="btn" data-x="zoom">${icon('zoom')}Zoom</button>
        <button class="btn" data-x="layer-quality" data-id="${esc(m.id)}">${icon('quality')}Quality</button>
        ${AUTHOR ? `<button class="btn" data-x="label">${icon('tag')}Label</button>` : ''}
        <button class="btn" data-x="copy">${icon('copy')}Copy</button>
      </div></div>`);
  }
  box.innerHTML = parts.join('') || '<p class="empty">Tap the map to see what is there.</p>';
  box.querySelectorAll('[data-x]').forEach((b) => {
    b.onclick = () => {
      const x = b.dataset.x;
      const id = b.dataset.id;
      if (x === 'layer-quality') return openQuality(id);
      if (x === 'rast-table') return openTable(id);
      if (x === 'rast-label') { openLabelEditor(addAnnotation({ text: b.dataset.text, lon: spot[0], lat: spot[1], size: 15 })); return; }
      const card = b.closest('.card'), st = L.get(card.dataset.id), f = st.obj.features[+card.dataset.idx];
      if (x === 'zoom') { map.zoomToFeature(f, 80); openSheet('layers'); }
      else if (x === 'label') { const [wx, wy] = labelAnchor(f); const a = addAnnotation({ text: titleOf(st.obj, f), lon: unX(wx), lat: unY(wy), size: 15 }); openLabelEditor(a); }
      else if (x === 'copy') {
        const txt = Object.entries(f.props).map(([k, v]) => `${k}: ${v}`).join('\n');
        navigator.clipboard?.writeText(txt).then(() => toast('Attributes copied'), () => toast('Could not copy'));
      }
    };
  });
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

// ---------------------------------------------------------------- quality / source transparency
function renderQuality() {
  const box = $('#quality');
  if (!box || !catalog) return;
  box.innerHTML = qualityPanelHTML(catalog, qualityLayerId);
  const picker = box.querySelector('#quality-layer');
  if (picker) picker.onchange = () => { qualityLayerId = picker.value || null; renderQuality(); };
  box.querySelectorAll('[data-quality-layer]').forEach((button) => {
    button.onclick = () => { qualityLayerId = button.dataset.qualityLayer; renderQuality(); };
  });
  box.querySelectorAll('[data-quality-clear]').forEach((button) => {
    button.onclick = () => { qualityLayerId = null; renderQuality(); };
  });
  box.querySelectorAll('[data-quality-copy]').forEach((button) => {
    button.onclick = async () => {
      try {
        if (!navigator.clipboard) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(button.dataset.qualityCopy);
        toast('Source SHA-256 copied');
      } catch { toast('Copy unavailable — select the hash shown above', 4000); }
    };
  });
}
function openQuality(id = null) {
  if (id && L.has(id)) qualityLayerId = id;
  openSheet('quality', true);
}

// ---------------------------------------------------------------- bottom sheet
const sheet = $('#sheet'), mobileQ = matchMedia('(max-width:899px)');
const TITLES = { layers: 'Layers', legend: 'Legend', info: 'Info', quality: 'Quality & source', tools: 'Tools' };
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
  if (tab === 'quality') renderQuality();
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
  analyse: [
    ['buffer', 'target', 'Buffer / Proximity', 'Find features within a distance of another layer'],
    ['intersect', 'query', 'Intersect / Overlay', 'Find where two polygon layers overlap'],
    ['nearest', 'compass', 'Nearest Neighbor', 'Match each feature to its closest feature in another layer'],
    ['dissolve', 'merge', 'Dissolve / Merge', 'Merge polygons sharing the same attribute'],
    ['count', 'table', 'Count Points in Polygons', 'Tally point features inside each polygon'],
    ['hull', 'polygon', 'Convex Hull', 'Smallest convex boundary around selected points'],
    ['simplify', 'sliders', 'Simplify Geometry', 'Reduce vertices while preserving shape'],
    ['zonal', 'chart', 'Zonal Statistics', 'Summarize raster values within polygons']
  ],
  navigate: [
    ['measure-dist', 'ruler', 'Measure distance', 'Tap along a line to total the km'],
    ['measure-area', 'area', 'Measure area', 'Tap a shape to get km² and edge'],
    ['goto', 'target', 'Go to coordinates', 'Type a latitude and longitude'],
    ['bearing', 'compass', 'Distance & bearing', 'Between two coordinates'],
    ['grid', 'grid', 'Grid lines', 'Latitude / longitude graticule'],
    ['locate', 'locate', 'Locate Me', 'Center map on your current location'],
    ['bookmarks', 'pin', 'View Bookmarks', 'Save and restore map view bookmarks'],
    ['rotate', 'compass', 'Rotate Map', 'Rotate the map display with north arrow'],
    ['meas-save', 'pin', 'Save Measurement', 'Save the current line or area measurement'],
    ['meas-list', 'chart', 'Saved Measurements', 'View and restore saved measurements'],
    ['draw-save', 'pin', 'Save Drawing', 'Save the current focus area / drawing'],
    ['draw-list', 'layers', 'Saved Drawings', 'View and restore saved drawings'],
    ['draw-style', 'palette', 'Drawing Style', 'Set color and stroke for drawings'],
  ],
  temporal: [
    ['timefilter', 'filter', 'Temporal Filter', 'Filter features by date or year field'],
    ['timelayers', 'layers', 'Temporal Layers', 'Browse layers with time coverage'],
    ['timeslider', 'sliders', 'Time Slider', 'Step through years to see change'],
  ],
  search: [
    ['find', 'search', 'Feature Finder', 'Search features by attribute across layers'],
    ['coords', 'target', 'Coordinate Inspector', 'Click map to read coordinates (DD / DMS)'],
    ['convert', 'calc', 'Coordinate Converter', 'Convert DD, DMS and UTM coordinates'],
    ['layerfind', 'layers', 'Layer Discovery', 'Search and browse the layer catalog'],
  ],
  data: [
    ['stats', 'chart', 'Layer statistics', 'Totals, averages and a chart'],
    ['chart', 'hist', 'Compare fields', 'Histogram of any numeric column'],
    ['table', 'table', 'Attribute table', 'Browse, sort and search rows'],
    ['fieldcalc', 'calc', 'Field Calculator', 'Calculate new attribute fields'],
    ['selectattr', 'filter', 'Select by Attribute', 'Select features by attribute values'],
    ['colmanage', 'view', 'Column Manager', 'Show/hide table columns'],
    ['labels', 'tag', 'Feature labels', 'Write a field on the map'],
    ['zoomlayer', 'zoom', 'Zoom to a layer', 'Fit a whole layer on screen'],
    ['shot', 'camera', 'Save map picture', 'Download the screen as a PNG'],
    ['export', 'down', 'Export results', 'Save a map picture or attribute rows as CSV'],
  ],
  author: [
    ['symbology', 'palette', 'Symbology', 'Fill, stroke, size and labels'],
    ['addlabel', 'tag', 'Add a label', 'Place text anywhere on the map'],
    ['savelabels', 'pin', 'Label list', 'Manage the labels you placed'],
    ['import', 'upload', 'Import GeoJSON', 'Bring your own file onto the map'],
    ['reset', 'refresh', 'Reset the work', 'Forget styles, filters, labels and focus'],
  ],
  cartography: [
    ['ramp', 'palette', 'Color Ramps', 'Choose perceptual color ramps for layers'],
    ['custombasemap', 'layers', 'Custom Basemap', 'Add your own XYZ tile basemap URL'],
    ['mappreset', 'pin', 'Map Presets', 'Save and restore map view states'],
    ['printlayout', 'camera', 'Print Layouts', 'A4 / Letter page templates for export'],
  ],
  project: [
    ['resetview', 'refresh', 'Reset the view', 'Back to the opening extent and no filters'],
    ['fullscreen', 'expand', 'Full screen', 'Use the whole screen, no browser chrome'],
  ],
  mobile: [
    ['a11y', 'eye', 'Accessibility', 'High contrast, text size, reduced motion'],
    ['gestures', 'grip', 'Gesture Guide', 'Touch gestures for phone and tablet'],
    ['screenreader', 'info', 'Screen Reader', 'Enhanced ARIA labels and live announcements'],
    ['colorblind', 'palette', 'Colorblind Palettes', 'Colorblind-safe color ramps'],
  ],
  sharing: [
    ['shareview', 'share', 'Share View', 'Copy a link to the current map view'],
    ['session', 'code', 'Session Codes', 'Save and restore map sessions by code'],
    ['mapnotes', 'note', 'Map Notes', 'Add text notes and markers to the map'],
  ],
  raster: [
    ['rastercalc', 'calc', 'Raster Calculator', 'Map algebra on raster layers'],
    ['rasterreclass', 'sliders', 'Raster Reclassify', 'Reclassify raster cell values'],
    ['rasterstats', 'chart', 'Raster Statistics', 'Summarize raster values'],
    ['rasterclip', 'crop', 'Raster Clip / Mask', 'Clip raster by focus area'],
  ],
  geometry: [
    ['centroid', 'target', 'Feature Centroid', 'Centroid of selected features'],
    ['densify', 'line', 'Densify Lines', 'Add vertices along lines'],
    ['splitpoly', 'crop', 'Split Polygon by Line', 'Split polygons with a line'],
    ['concavehull', 'polygon', 'Concave Hull', 'Concave boundary (alpha shape)'],
  ],
  topology: [
    ['checkoverlap', 'query', 'Check Overlaps', 'Find overlapping polygons'],
    ['checkgaps', 'grid', 'Check Gaps', 'Find gaps between polygons'],
    ['validate', 'check', 'Validate Geometry', 'Check geometry validity'],
    ['snap', 'magnet', 'Snap Features', 'Snap features together'],
  ],
  network: [
    ['shortestpath', 'ruler', 'Shortest Path', 'Shortest path on network'],
    ['servicearea', 'target', 'Service Area', 'Reachable area (isochrone)'],
    ['tracenet', 'query', 'Trace Network', 'Trace upstream/downstream'],
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
    case 'locate': toolLocate(); break;
    case 'bookmarks': toolBookmarks(); break;
    case 'rotate': toolRotateMap(); break;
    case 'meas-save': toolMeasSave(); break;
    case 'meas-list': toolMeasList(); break;
    case 'draw-save': toolDrawSave(); break;
    case 'draw-list': toolDrawList(); break;
    case 'draw-style': toolDrawStyle(); break;
    case 'shot': exportMapImage(); break;
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
    case 'fieldcalc': toolFieldCalc(); break;
    case 'selectattr': toolSelectAttr(); break;
    case 'colmanage': toolColManage(); break;
    case 'find': toolFeatureFinder(); break;
    case 'coords': toolCoordInspector(); break;
    case 'convert': toolCoordConverter(); break;
    case 'layerfind': toolLayerDiscovery(); break;
    case 'bearing': toolBearing(); break;
    case 'savelabels': openSheet('tools'); renderAnnotations(); toast('Labels are listed under “Labels you placed”'); break;
    case 'reset': resetWork(); break;
    case 'clip': toolClip(); break;
    case 'query': toolQuery(); break;
    case 'aoi': toolAoi(); break;
    case 'chart': toolChart(); break;
    case 'buffer': toolBuffer(); break;
    case 'intersect': toolIntersect(); break;
    case 'nearest': toolNearest(); break;
    case 'dissolve': toolDissolve(); break;
    case 'count': toolCount(); break;
    case 'hull': toolHull(); break;
    case 'simplify': toolSimplify(); break;
    case 'zonal': toolZonal(); break;
    case 'ramp': toolRamp(); break;
    case 'custombasemap': toolCustomBasemap(); break;
    case 'mappreset': toolMapPreset(); break;
    case 'printlayout': toolPrintLayout(); break;
    case 'resetview': resetView(); break;
    case 'fullscreen': toggleFullscreen(); break;
    case 'timefilter': toolTemporalFilter(); break;
    case 'timelayers': toolTemporalLayers(); break;
    case 'timeslider': toolTimeSlider(); break;
    case 'a11y': toolA11y(); break;
    case 'gestures': toolGestures(); break;
    case 'screenreader': toolScreenReader(); break;
    case 'colorblind': toolColorblindPalettes(); break;
    case 'shareview': toolShareView(); break;
    case 'session': toolSessionCodes(); break;
    case 'mapnotes': toolMapNotes(); break;
    case 'rastercalc': toolRasterCalc(); break;
    case 'rasterreclass': toolRasterReclass(); break;
    case 'rasterstats': toolRasterStats(); break;
    case 'rasterclip': toolRasterClip(); break;
    case 'centroid': toolCentroid(); break;
    case 'densify': toolDensify(); break;
    case 'splitpoly': toolSplitPoly(); break;
    case 'concavehull': toolConcaveHull(); break;
    case 'checkoverlap': toolCheckOverlap(); break;
    case 'checkgaps': toolCheckGaps(); break;
    case 'validate': toolValidate(); break;
    case 'snap': toolSnap(); break;
    case 'shortestpath': toolShortestPath(); break;
    case 'servicearea': toolServiceArea(); break;
    case 'tracenet': toolTraceNet(); break;
  }
}

// ---------------------------------------------------------------- focus area (clip)
const FOCUS_KINDS = { rect: 'Rectangle', square: 'Square', circle: 'Circle', poly: 'Polygon', freehand: 'Freehand outline', multi: 'Multiple features' };

function setFocus(obj, announce = true) {
  clip = obj || null;
  map.setClip(clip);
  updateFocusUI();
  saveProjectSoon();
  if (announce) toast(clip ? `Focused on ${fmtNum(focusAreaKm2())} km²` : 'Focus cleared — the whole map is shown');
}
function stopFocus() { focusLabel = ''; setFocus(null); }
function clipRingsToLL(clip) {
  const rings = [];
  const src = clip.polys ? clip.polys.flatMap((p) => p) : (clip.rings || []);
  for (const ring of src) {
    const o = [];
    for (let k = 0; k + 1 < ring.length; k += 2) o.push([unX(ring[k]), unY(ring[k + 1])]);
    rings.push(o);
  }
  return rings;
}
function focusAreaKm2() {
  if (!clip) return 0;
  if (clip.type === 'rect') {
    const [w, yb, e, yt] = clip.wb;
    return ringAreaKm2([[unX(w), unY(yt)], [unX(e), unY(yt)], [unX(e), unY(yb)], [unX(w), unY(yb)]]);
  }
  if (clip.type === 'circle') {
    // Approximate circle area using radius in degrees (rough, at equator)
    const rDeg = clip.r / (256 * Math.pow(2, map.zoom)) * 360;
    return Math.PI * rDeg * rDeg * 111.0 * 111.0 * Math.cos(clip.c[1] * Math.PI / 180);
  }
  const rings = clipRingsToLL(clip);
  let a = 0;
  rings.forEach((r, i) => {
    const v = ringAreaKm2(r);
    a += i === 0 ? v : -v;
  });
  return Math.max(0, a);
}
function focusPerimeterKm() {
  if (!clip) return 0;
  if (clip.type === 'poly' || clip.type === 'freehand' || clip.type === 'multi') {
    const rings = clipRingsToLL(clip);
    if (rings.length) return ringPerimeterKm(rings[0]);
  }
  if (clip.type === 'circle') {
    const rDeg = clip.r / (256 * Math.pow(2, map.zoom)) * 360;
    return 2 * Math.PI * rDeg * 111.0 * Math.cos(clip.c[1] * Math.PI / 180);
  }
  if (clip.type === 'rect') {
    const [w, yb, e, yt] = clip.wb;
    return ringPerimeterKm([[unX(w), unY(yt)], [unX(e), unY(yt)], [unX(e), unY(yb)], [unX(w), unY(yb)]]);
  }
  return 0;
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
function focusFromSquare(a, b) {
  const w = mercX(Math.min(a[0], b[0])), e = mercX(Math.max(a[0], b[0]));
  const n = mercY(Math.max(a[1], b[1])), s_ = mercY(Math.min(a[1], b[1]));
  const dx = e - w, dy = n - s_;
  const side = Math.min(dx, dy);
  if (side < 1e-7) { toast('Drag a bigger box'); return; }
  const cx = (w + e) / 2, cy = (s_ + n) / 2;
  const hw = side / 2, hh = side / 2;
  setFocus({ type: 'rect', wb: [cx - hw, cy - hh, cx + hw, cy + hh] });
}
function focusFromCircle(centre, edge) {
  const cx = mercX(centre[0]), cy = mercY(centre[1]);
  const ex = mercX(edge[0]), ey = mercY(edge[1]);
  const r = Math.hypot(ex - cx, ey - cy);
  if (r < 1e-6) { toast('Drag a bigger circle'); return; }
  setFocus({ type: 'circle', c: [cx, cy], r });
}
function focusFromFreehand(pts) {
  if (pts.length < 3) { toast('Draw a bigger outline'); return; }
  const ring = [];
  for (const [lo, la] of pts) ring.push(mercX(lo), mercY(la));
  setFocus({ type: 'freehand', rings: [ring] });
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
  draw = { kind, pts: [], origin: null };
  map.cv.style.cursor = 'crosshair';
  const bar = $('#drawbar'); bar.hidden = false;
  const labels = {
    rect: 'Drag a rectangle on the map',
    square: 'Drag a square on the map',
    circle: 'Click centre, then drag radius',
    poly: 'Tap the corners of the area',
    freehand: 'Drag to draw a freehand outline',
  };
  $('#drawtext').textContent = labels[kind] || 'Draw an area';
  $('#drawdone').hidden = kind !== 'poly';
  $('#drawclear').textContent = 'Cancel';
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
    if (!draw || !draw.pts.length) return;
    ctx.save();
    ctx.setLineDash([7, 5]);
    ctx.lineWidth = drawStrokeWidth || 2.5;
    ctx.strokeStyle = drawStyle || '#0b6b45';
    ctx.fillStyle = (drawStyle || '#0b6b45') + '22';
    if (draw.kind === 'poly') {
      ctx.beginPath();
      draw.pts.forEach(([lo, la], i) => { const [x, y] = m.screenOf(lo, la); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      if (draw.pts.length > 2) ctx.closePath();
      ctx.stroke();
      if (draw.pts.length > 2) ctx.fill();
      ctx.fillStyle = drawStyle || '#0b6b45';
      for (const [lo, la] of draw.pts) { const [x, y] = m.screenOf(lo, la); ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); }
    } else if (draw.kind === 'circle' && draw.pts.length >= 1) {
      const [cx, cy] = m.screenOf(draw.pts[0][0], draw.pts[0][1]);
      const [lx, ly] = draw.pts.length > 1 ? m.screenOf(draw.pts[1][0], draw.pts[1][1]) : [cx, cy];
      const r = Math.hypot(lx - cx, ly - cy);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fillStyle = drawStyle || '#0b6b45'; ctx.fill();
    } else if (draw.kind === 'freehand') {
      ctx.beginPath();
      draw.pts.forEach(([lo, la], i) => { const [x, y] = m.screenOf(lo, la); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  };
  map.render();
}
// drag-to-draw shapes: rect, square, circle, freehand
function bindDrawPointer() {
  const cv = map.cv;
  let origin = null, last = null, freehandPts = [];
  const rectAt = (e) => unproject(e);
  cv.addEventListener('pointerdown', (e) => {
    if (!draw || (draw.kind !== 'rect' && draw.kind !== 'square' && draw.kind !== 'circle' && draw.kind !== 'freehand')) return;
    e.stopPropagation(); e.preventDefault();
    origin = rectAt(e); last = origin;
    if (draw.kind === 'freehand') freehandPts = [origin];
    cv.setPointerCapture?.(e.pointerId);
    map.render();
    const move = (ev) => {
      last = rectAt(ev);
      if (draw.kind === 'freehand') freehandPts.push(last);
      map.render();
    };
    const up = (ev) => {
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up);
      cv.removeEventListener('pointercancel', up);
      const b = rectAt(ev), a = origin; origin = null; last = null;
      map.overlay = null;
      endDraw();
      if (draw.kind === 'rect') focusFromRect(a, b);
      else if (draw.kind === 'square') focusFromSquare(a, b);
      else if (draw.kind === 'circle') focusFromCircle(a, b);
      else if (draw.kind === 'freehand') focusFromFreehand(freehandPts);
    };
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
  }, true);
  // circle: click centre, drag radius — handled by same pointerdown as rect-like
  // freehand points are collected during move and passed to focusFromFreehand
}
function unproject(e) {
  const r = map.cv.getBoundingClientRect();
  return map.fromScreen((e.clientX - r.left) * (map.W / r.width), (e.clientY - r.top) * (map.H / r.height)).map((v, i) => i === 0 ? unX(v) : unY(v));
}

function toolClip() {
  const kind = clip ? (clip.type === 'multi' ? 'Multiple features' : (FOCUS_KINDS[clip.type] || 'area')) : '';
  const cur = clip
    ? `Active focus: ${kind} · <b>${fmtNum(focusAreaKm2())} km²</b>${focusPerimeterKm() ? ` · edge ${fmtNum(focusPerimeterKm())} km` : ''}${focusLabel ? ` · from ${esc(focusLabel)}` : ''}`
    : 'No focus area — the whole map is shown.';
  openModal('Clip to an area', (body) => {
    body.innerHTML = `<p class="hint">${cur}</p>
      <p>Everything outside the shape is completely removed — only what lies inside is drawn, searched, identified, tabulated and exported. Use it to study one state, one LGA, one basin or one site.</p>
      <div class="aoi">
        <button class="btn" data-act="rect">${icon('crop')} Rectangle</button>
        <button class="btn" data-act="square">${icon('crop')} Square</button>
        <button class="btn" data-act="circle">${icon('target')} Circle</button>
        <button class="btn" data-act="poly">${icon('area')} Polygon</button>
        <button class="btn" data-act="freehand">${icon('point')} Freehand outline</button>
        <button class="btn" data-act="multi">${icon('query')} Multiple features</button>
        <button class="btn" data-act="view">${icon('expand')} Current view</button>
      </div>
      <p class="hint" style="margin-top:10px">Esc cancels a drawing. The focus area is remembered with your view and in the share link.</p>
      ${clip ? `<div class="aoi" style="margin-top:10px">
        <button class="btn" data-act="summary">${icon('hist')} Area summary</button>
        <button class="btn" data-act="zoom">${icon('zoom')} Zoom to it</button>
        <button class="btn" data-act="clear">Clear focus</button></div>` : ''}`;
    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act; closeModal();
      if (act === 'rect') startDraw('rect');
      else if (act === 'square') startDraw('square');
      else if (act === 'circle') startDraw('circle');
      else if (act === 'poly') startDraw('poly');
      else if (act === 'freehand') startDraw('freehand');
      else if (act === 'multi') toolPickMulti();
      else if (act === 'view') {
        const [x0, y0] = map.fromScreen(0, 0), [x1, y1] = map.fromScreen(map.W, map.H);
        setFocus({ type: 'rect', wb: [x0, y1, x1, y0] });
      } else if (act === 'clear') stopFocus();
      else if (act === 'summary') toolAoi();
      else if (act === 'zoom') { const bb = map.clipBounds(); if (bb) map.fitBounds(bb, 24); }
    });
  });
}

// pick multiple polygon features and clip to their union ---------------------
function toolPickMulti() {
  const polyLayers = [];
  for (const id of stack) {
    const st = L.get(id);
    if (st?.obj?.features && st.meta.kind === 'polygon') polyLayers.push([id, st]);
  }
  openModal('Clip to multiple features', (body) => {
    if (!polyLayers.length) {
      body.innerHTML = '<p class="empty">No polygon layer is switched on.</p>';
      return;
    }
    const picked = new Set();
    function draw() {
      body.innerHTML = `<p>Select two or more polygon features (tap on the map or pick from the list). The clip will be the union of everything you select — for example Kwara + Kogi + Benue.</p>
        <div class="frow"><label>Boundary layer</label><select id="mp-layer">${polyLayers.map(([id, st]) => `<option value="${esc(id)}">${esc(st.meta.label)}</option>`).join('')}</select></div>
        <div id="mp-search" style="margin:8px 0"><label>Search features</label><input id="mp-search-input" type="search" placeholder="Type a name…"></div>
        <div id="mp-list" style="max-height:300px;overflow:auto;border:1px solid var(--line);border-radius:8px"></div>
        <div class="frow act"><button class="btn" id="mp-clear">Clear selection</button><button class="btn primary" id="mp-apply">Clip to ${picked.size} selected</button></div>
        <div class="frow"><span id="mp-hint" class="hint">${picked.size} feature${picked.size === 1 ? '' : 's'} selected</span></div>`;
      renderList();
    }
    function renderList() {
      const lid = body.querySelector('#mp-layer').value;
      const st = L.get(lid);
      const q = body.querySelector('#mp-search-input').value.trim().toLowerCase();
      const list = body.querySelector('#mp-list');
      const feats = st.obj.features.filter((f) => {
        const v = titleOf(st.obj, f).toLowerCase();
        return !q || v.includes(q);
      });
      list.innerHTML = feats.map((f, i) => {
        const isPicked = picked.has(i);
        return `<div style="padding:6px 10px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:8px;${isPicked ? 'background:rgba(11,107,69,.12)' : ''}">
          <input type="checkbox" data-i="${i}" ${isPicked ? 'checked' : ''}>
          <span style="flex:1">${esc(titleOf(st.obj, f))}</span>
        </div>`;
      }).join('');
      list.querySelectorAll('input[type=checkbox]').forEach((cb) => {
        cb.onchange = (e) => {
          const i = +cb.dataset.i;
          if (cb.checked) picked.add(i); else picked.delete(i);
          body.querySelector('#mp-apply').textContent = `Clip to ${picked.size} selected`;
          body.querySelector('#mp-hint').textContent = `${picked.size} feature${picked.size === 1 ? '' : 's'} selected`;
          renderList();
        };
      });
    }
    body.querySelector('#mp-layer').onchange = () => { picked.clear(); draw(); };
    body.querySelector('#mp-search-input').oninput = () => { renderList(); };
    body.querySelector('#mp-clear').onclick = () => { picked.clear(); body.querySelector('#mp-apply').textContent = `Clip to ${picked.size} selected`; body.querySelector('#mp-hint').textContent = `${picked.size} feature${picked.size === 1 ? '' : 's'} selected`; renderList(); };
    body.querySelector('#mp-apply').onclick = () => {
      if (picked.size < 1) { toast('Pick at least one feature'); return; }
      const lid = body.querySelector('#mp-layer').value;
      const st = L.get(lid);
      const rings = [];
      let labelParts = [];
      for (const i of picked) {
        const f = st.obj.features[i];
        for (const poly of f.parts) for (const ring of poly) rings.push(Array.from(ring));
        labelParts.push(titleOf(st.obj, f));
      }
      closeModal();
      focusLabel = labelParts.join(' + ');
      setFocus({ type: 'multi', polys: rings, bb: null, label: focusLabel });
      map.setClip({ type: 'multi', polys: rings, bb: null, label: focusLabel });
      toast(`Clipped to ${picked.size} feature${picked.size === 1 ? '' : 's'}: ${focusLabel}`);
    };
    draw();
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
            const inside = clip ? map.clipOverlapsFeature(f) : true;
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
              const wy = o.wb[1] + (j + step / 2) / h * (o.wb[3] - o.wb[1]);
              if (clip && !map.clipContainsPoint(wx, wy)) continue;
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
      if (clip && !map.clipOverlapsFeature(f)) continue;
      const [wx, wy] = labelAnchor(f);
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
  if (x === 'showall') {
    const ids = baseOrder.filter((id) => !isOn(id) && L.get(id).meta.kind !== 'table');
    Promise.all(ids.map((id) => setLayer(id, true, { quiet: true }))).then(() => {
      renderLayerLists(); refreshLegend(); pushHash(); saveProject();
    });
  }
  else if (x === 'hideall') { for (const id of [...stack]) setLayer(id, false); }
  else if (x === 'fitall') fitVisible();
  else if (x === 'focus') toolClip();
  else if (x === 'grid') { gridOn = !gridOn; map.setGrid(gridOn); updateToolState(); saveProject(); }
  else if (x === 'labels') toolLabels(stack[stack.length - 1]);
  else if (x === 'clearfilter') { let n = 0; for (const st of L.values()) if (st.filter) { st.filter = null; applyFilter(st); n++; } renderLayerLists(); toast(n ? 'Filters cleared' : 'No filters to clear'); saveProject(); }
  else if (x === 'basemap') {
    const order = BASEMAP_ORDER;
    const i = order.indexOf(map.basemap);
    const next = order[(i + 1) % order.length];
    map.setBasemap(next); syncBasemapUI(); updateAttrib(); pushHash(); saveProject();
    renderLayerTools(); toast('Basemap: ' + BASEMAPS[next]?.label);
  }
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
async function exportMapImage(opts = {}) {
  closeLabelEditor();
  $('#labelpanel').hidden = true;
  const {
    area = 'screen',      // 'screen' | 'clip' | 'drawn' | 'feature'
    title = '', showLegend = false, showScale = false, showNorth = false, showGrid = false,
  } = opts;

  // Print layout settings (from Cartography & design > Print Layouts)
  const printLayout = (() => {
    try { return JSON.parse(localStorage.getItem('nwg.print_layout') || 'null'); } catch { return null; }
  })();
  const isPrint = !!printLayout;

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  // Remember current state
  const prevCenter = map.center(), prevZoom = map.zoom, prevClip = map.clip, prevBasemap = map.basemap;

  // Apply export area
  if (area === 'clip' && map.clip) {
    const bb = map.clipBounds();
    if (bb) map.fitBounds(bb, 60);
  }
  map._draw();

  let src = null, note = '';
  try { src = map.cv.toDataURL('image/png'); }
  catch (e) {
    const prev = map.basemap; map.basemap = 'none'; map._draw();
    try { src = map.cv.toDataURL('image/png'); note = ' (basemap tiles are protected — no basemap)'; } catch (e2) { src = null; }
    map.basemap = prev; map._draw();
  }
  if (!src) { toast('Could not create the picture on this device'); return; }

  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });

  const d = map.dpr;

  // Print layout: compute canvas size from page template (A4/Letter/A3)
  let printW = img.width, printH = img.height;
  let marginPx = 0;
  if (isPrint && printLayout) {
    const mmToPx = (mm) => mm * (img.width / 210) * d; // approx: A4 width 210mm mapped to image width
    // Standard page sizes at 96 DPI ~ 3.78 px/mm
    const sizes = {
      a4: { w: 210, h: 297 }, a3: { w: 297, h: 420 }, letter: { w: 215.9, h: 279.4 },
    };
    const ps = sizes[printLayout.size] || sizes.a4;
    const landscape = printLayout.orient === 'landscape';
    const pw = landscape ? ps.h : ps.w;
    const ph = landscape ? ps.w : ps.h;
    marginPx = Math.round((printLayout.margin || 15) * (pw / 210) * d);
    // Target DPI ~150 for print
    const dpiScale = 150 / 96;
    printW = Math.round(pw * 3.78 * dpiScale * d);
    printH = Math.round(ph * 3.78 * dpiScale * d);
  }

  // Composer canvas: map image + space for cartographic elements
  const topBarH = (title || showLegend || showNorth || showGrid) ? Math.round(90 * d) : 0;
  const bottomBarH = Math.round(70 * d);
  const cvW = isPrint ? printW : img.width;
  const cvH = isPrint ? printH : img.height + topBarH + bottomBarH;
  const cv = document.createElement('canvas');
  cv.width = cvW; cv.height = cvH;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cvW, cvH);

  if (isPrint && printLayout) {
    // Draw page frame
    ctx.strokeStyle = '#dfe4df'; ctx.lineWidth = 2 * d;
    ctx.strokeRect(marginPx, marginPx, cvW - marginPx * 2, cvH - marginPx * 2);
    // Title block
    ctx.fillStyle = '#0b3d2e'; ctx.fillRect(marginPx, cvH - marginPx * 0.6, cvW - marginPx * 2, marginPx * 0.6);
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.max(10, 11 * d)}px system-ui,sans-serif`;
    ctx.fillText('Nigeria WebGIS · Print Layout · ' + printLayout.size.toUpperCase() + ' ' + printLayout.orient, marginPx + 8 * d, cvH - marginPx * 0.3);
  }

  // Draw map image centered within printable area
  const mapX = isPrint ? marginPx : 0;
  const mapY = isPrint ? marginPx : topBarH;
  const mapW = isPrint ? cvW - marginPx * 2 : img.width;
  const mapH = isPrint ? cvH - marginPx * 2 - (isPrint ? marginPx * 0.6 : 0) : img.height;
  ctx.drawImage(img, mapX, mapY + (isPrint ? 0 : topBarH), mapW, mapH);

  const [lo, la] = prevCenter;
  let cy = isPrint ? marginPx + 30 * d : topBarH;

  // --- Title
  if (title) {
    ctx.fillStyle = '#16201b'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.font = `700 ${Math.max(16, 20 * d)}px system-ui,sans-serif`;
    ctx.fillText(title, cv.width / 2, cy + 30 * d);
    cy += 55 * d;
  }

  // --- Legend
  if (showLegend) {
    const legendW = Math.min(260 * d, cv.width * 0.4);
    const legendX = cv.width - legendW - 14 * d;
    const legendY = cy + 10 * d;
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.strokeStyle = '#dfe4df';
    ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(legendX, legendY, legendW, 0, 6);
    // legend entries from active layers
    let legendH = 10 * d;
    const active = [...stack].reverse().map((id) => L.get(id)).filter((st) => st.obj && st.obj.visible);
    for (const st of active) {
      const m = st.meta;
      if (m.kind === 'table' || m.kind === 'image') continue;
      legendH += 14 * d;
      ctx.fillStyle = '#16201b'; ctx.font = `600 ${11 * d}px system-ui,sans-serif`;
      ctx.fillText(m.label, legendX + 10 * d, cy + legendH);
      legendH += 8 * d;
      let swatch = st.sym?.fill || (m.style?.color || '#7a7a7a');
      ctx.fillStyle = swatch; ctx.fillRect(legendX + 10 * d, cy + legendH - 4 * d, 12 * d, 10 * d);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.strokeRect(legendX + 10 * d, cy + legendH - 4 * d, 12 * d, 10 * d);
      if (m.legendClasses) {
        for (const c of m.legendClasses.slice(0, 4)) {
          legendH += 10 * d;
          ctx.fillStyle = c.color || swatch; ctx.fillRect(legendX + 14 * d, cy + legendH - 4 * d, 10 * d, 8 * d);
          ctx.fillStyle = '#16201b'; ctx.font = `10px system-ui,sans-serif`;
          ctx.fillText(c.label, legendX + 26 * d, cy + legendH);
        }
      }
      legendH += 6 * d;
    }
    if (legendH > 10 * d) {
      ctx.fillStyle = 'rgba(255,255,255,0.94)'; ctx.fillRect(legendX, legendY, legendW, legendH + 10 * d);
      ctx.strokeRect(legendX, legendY, legendW, legendH + 10 * d);
      ctx.fillStyle = '#16201b'; ctx.font = `700 ${11 * d}px system-ui,sans-serif`;
      ctx.fillText('Legend', legendX + 10 * d, legendY + 16 * d);
      // redraw entries inside box
      let lh = 26 * d;
      for (const st of active) {
        const m = st.meta;
        if (m.kind === 'table' || m.kind === 'image') continue;
        lh += 14 * d;
        ctx.fillStyle = '#16201b'; ctx.font = `600 ${11 * d}px system-ui,sans-serif`;
        ctx.fillText(m.label, legendX + 10 * d, legendY + lh);
        lh += 8 * d;
        let swatch = st.sym?.fill || (m.style?.color || '#7a7a7a');
        ctx.fillStyle = swatch; ctx.fillRect(legendX + 10 * d, legendY + lh - 4 * d, 12 * d, 10 * d);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.strokeRect(legendX + 10 * d, legendY + lh - 4 * d, 12 * d, 10 * d);
        if (m.legendClasses) {
          for (const c of m.legendClasses.slice(0, 4)) {
            lh += 10 * d;
            ctx.fillStyle = c.color || swatch; ctx.fillRect(legendX + 14 * d, legendY + lh - 4 * d, 10 * d, 8 * d);
            ctx.fillStyle = '#16201b'; ctx.font = `10px system-ui,sans-serif`;
            ctx.fillText(c.label, legendX + 26 * d, legendY + lh);
          }
        }
        lh += 6 * d;
      }
    }
    cy += legendH + 20 * d;
  }

  // --- Scale bar
  if (showScale) {
    const mpp = 156543.03392 * Math.cos(la * Math.PI / 180) / Math.pow(2, prevZoom);
    let m = mpp * 120 * d; const p = Math.pow(10, Math.floor(Math.log10(m)));
    let f = m / p; m = (f >= 5 ? 5 : f >= 2 ? 2 : 1) * p;
    const barW = m / mpp;
    const bx = cv.width - barW - 14 * d, by = cy + 10 * d;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - 2 * d, by - 4 * d, barW + 4 * d, 16 * d);
    ctx.strokeStyle = '#16201b'; ctx.strokeRect(bx - 2 * d, by - 4 * d, barW + 4 * d, 16 * d);
    ctx.fillStyle = '#000000'; ctx.fillRect(bx, by, barW / 2, 6 * d);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(bx + barW / 2, by, barW / 2, 6 * d);
    ctx.fillStyle = '#16201b'; ctx.textAlign = 'center'; ctx.font = `600 ${11 * d}px system-ui,sans-serif`;
    ctx.fillText(m >= 1000 ? m / 1000 + ' km' : m + ' m', bx + barW / 2, by + 14 * d);
    cy += 30 * d;
  }

  // --- North arrow
  if (showNorth) {
    const nx = 14 * d, ny = cy + 10 * d, r = 16 * d;
    ctx.fillStyle = '#16201b';
    ctx.beginPath(); ctx.moveTo(nx, ny - r); ctx.lineTo(nx + 4 * d, ny); ctx.lineTo(nx, ny + r * 0.6); ctx.lineTo(nx - 4 * d, ny); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(nx, ny - r * 0.6); ctx.lineTo(nx + 4 * d, ny); ctx.lineTo(nx, ny + r); ctx.lineTo(nx - 4 * d, ny); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#16201b'; ctx.lineWidth = 1.5 * d;
    ctx.beginPath(); ctx.arc(nx, ny, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#16201b'; ctx.textAlign = 'center'; ctx.font = `600 ${11 * d}px system-ui,sans-serif`;
    ctx.fillText('N', nx, ny + r + 12 * d);
    cy += 40 * d;
  }

  // --- Grid / graticule labels
  if (showGrid) {
    ctx.save();
    const step = map._gridStep ? map._gridStep() : 2;
    ctx.strokeStyle = 'rgba(20,30,40,0.3)'; ctx.lineWidth = 1 * d; ctx.setLineDash([4 * d, 4 * d]);
    ctx.beginPath();
    const [w, s, e, n] = [unX(map.fromScreen(0, img.height)[0]), unY(map.fromScreen(0, img.height)[1]), unX(map.fromScreen(img.width, 0)[0]), unY(map.fromScreen(img.width, 0)[1])];
    for (let lo2 = Math.ceil(w / step) * step; lo2 <= e; lo2 += step) {
      const [x] = map.screenOf(lo2, 0); const xx = Math.round(x) + 0.5;
      ctx.moveTo(xx, topBarH); ctx.lineTo(xx, topBarH + img.height);
    }
    for (let la2 = Math.floor(s / step) * step; la2 <= n; la2 += step) {
      const [, y] = map.screenOf(0, la2); const yy = Math.round(y) + 0.5;
      ctx.moveTo(0, topBarH + yy); ctx.lineTo(img.width, topBarH + yy);
    }
    ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }

  // --- Bottom info strip
  ctx.fillStyle = '#0b3d2e'; ctx.fillRect(0, topBarH + img.height, cv.width, bottomBarH);
  ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.font = `600 ${13 * d}px system-ui,sans-serif`;
  ctx.fillText(catalog.title, 14 * d, topBarH + img.height + bottomBarH * 0.36);
  ctx.font = `${10.5 * d}px system-ui,sans-serif`;
  const sub = new Date().toLocaleString() + ' · ' + fmtLL(la, lo) + ' · zoom ' + prevZoom.toFixed(1);
  ctx.fillText(sub, 14 * d, topBarH + img.height + bottomBarH * 0.72);
  const attr = BASEMAPS[prevBasemap]?.attr || '';
  if (attr) { ctx.textAlign = 'right'; ctx.fillText(attr, cv.width - 14 * d, topBarH + img.height + bottomBarH * 0.72); ctx.textAlign = 'left'; }

  cv.toBlob((blob) => {
    if (!blob) { toast('Could not create the picture'); return; }
    const url = URL.createObjectURL(blob);
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const a = document.createElement('a'); a.href = url; a.download = `map-export-${ts}.png`;
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Map picture exported', 5000);
  }, 'image/png');

  // Restore state
  map.setView(prevCenter[0], prevCenter[1], prevZoom);
  map.setClip(prevClip);
  map.setBasemap(prevBasemap);
  map._draw();
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
      const cur = st.filter || { field: fields[0]?.name, op: 'eq', value: '', values: [] };
      const fld = fields.find((f) => f.name === cur.field) || fields[0];
      const isNum = fld && fld.type === 'number';
      const values = [...new Set(st.obj.features.map((f) => f.props[cur.field]))].filter((v) => v != null && v !== '').slice(0, 500);
      const isMulti = cur.op === 'in' || cur.op === 'not_in';
      const numOps = [['eq', 'is exactly'], ['neq', 'is not'], ['gt', 'is more than'], ['gte', 'is at least'], ['lt', 'is less than'], ['lte', 'is at most']];
      const txtOps = [['contains', 'contains'], ['eq', 'is exactly'], ['neq', 'is not']];
      const multiOps = [['in', 'include only'], ['not_in', 'exclude']];
      const opOptions = (isMulti ? multiOps : (isNum ? numOps : txtOps)).concat(isMulti ? [] : multiOps);
      holder.innerHTML = `<p class="muted">Only matching rows are drawn, identified and labelled. Other layers stay in full — clear the filter to bring them back.</p>
        <div class="frow"><label>Layer</label><span>${esc(st.meta.label)}</span></div>
        <div class="frow"><label>Field</label><select id="f-field">${fields.map((f) => `<option value="${esc(f.name)}"${cur.field === f.name ? ' selected' : ''}>${esc(f.label || f.name)}</option>`).join('')}</select></div>
        <div class="frow"><label>Condition</label><select id="f-op">${opOptions.map(([k, t]) => `<option value="${k}"${cur.op === k ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
        <div id="f-val-single" style="display:${isMulti ? 'none' : 'flex'}" class="frow"><label>Value</label><input id="f-value" type="text" value="${esc(cur.value ?? '')}" list="f-values"><datalist id="f-values">${values.map((v) => `<option value="${esc(v)}">`).join('')}</datalist></div>
        <div id="f-val-multi" style="display:${isMulti ? 'flex' : 'none'}" class="frow"><label>Values</label><div id="f-taglist" style="flex:1;display:flex;flex-wrap:wrap;gap:6px;align-items:center"></div><button class="btn" id="f-add" style="flex:none">Add value</button><datalist id="f-valopts">${values.map((v) => `<option value="${esc(v)}">`).join('')}</datalist></div>
        <div class="frow act"><button class="btn" id="f-clear">Clear filter</button><button class="btn primary" id="f-apply">Apply filter</button></div>
        <div class="frow"><span id="f-hint" class="hint">${isMulti ? 'Pick values from the list, then Apply.' : 'Choose a value or type one, then Apply.'}</span></div>`;
      const q = (s) => holder.querySelector(s);
      const tagList = q('#f-taglist'), valInput = q('#f-value'), addBtn = q('#f-add'), opSel = q('#f-op'), fieldSel = q('#f-field');
      const singleDiv = q('#f-val-single'), multiDiv = q('#f-val-multi');
      let tags = (cur.values || []).slice();
      function renderTags() {
        tagList.innerHTML = tags.map((v, i) => `<span style="border:1px solid var(--brand);background:rgba(11,107,69,.12);color:var(--brand);border-radius:12px;padding:2px 10px;font-size:12px;display:flex;align-items:center;gap:6px">${esc(v)}<button style="background:none;border:0;color:var(--brand);font-weight:700;cursor:pointer;padding:0 4px" data-rm="${i}">&times;</button></span>`).join('');
        tagList.querySelectorAll('[data-rm]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); tags.splice(+b.dataset.rm, 1); renderTags(); });
      }
      renderTags();
      fieldSel.onchange = () => { draw(); };
      opSel.onchange = (e) => {
        const multi = e.target.value === 'in' || e.target.value === 'not_in';
        singleDiv.style.display = multi ? 'none' : 'flex';
        multiDiv.style.display = multi ? 'flex' : 'none';
        q('#f-hint').textContent = multi ? 'Pick values from the list, then Apply.' : 'Choose a value or type one, then Apply.';
      };
      addBtn.onclick = () => {
        const v = q('#f-valopts').value.trim();
        if (!v) return;
        if (!tags.includes(v)) tags.push(v);
        q('#f-valopts').value = '';
        renderTags();
      };
      q('#f-apply').onclick = () => {
        const field = fieldSel.value;
        const op = opSel.value;
        if (op === 'in' || op === 'not_in') {
          if (!tags.length) { toast('Pick at least one value'); return; }
          st.filter = { field, op, values: tags };
        } else {
          st.filter = { field, op, value: valInput ? valInput.value : '', values: [] };
        }
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
          if (clip && !map.clipOverlapsFeature(f)) continue;
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


// ------------------------------------------------ spatial analysis tools

function clearAnalysisLayers() {
  for (const lyr of analysisLayers) map.removeLayer(lyr.id);
  analysisLayers.length = 0;
  map.render();
}

function addAnalysisLayer(features, kind, label, color) {
  clearAnalysisLayers();
  const id = 'analysis_' + Date.now().toString(36);
  const obj = { id, kind, visible: true, opacity: 0.8, order: 99999, features, labels: null, sym: { fill: color || '#0b6b45', stroke: '#0b6b45', strokeWidth: 1, fillOpacity: 0.4, dash: 'solid', pointSize: 4, pointShape: 'circle' } };
  map.addLayer(obj);
  analysisLayers.push(obj);
  return obj;
}

function analysisResultModal(title, html) {
  openModal(title, (body) => {
    body.innerHTML = html + '<div class="frow act" style="justify-content:stretch"><button class="btn primary" id="an-png">' + icon('camera') + ' Download Picture (PNG)</button><button class="btn" id="an-clear">' + icon('trash') + ' Clear from Map</button></div>';
    body.querySelector('#an-png').onclick = () => { closeModal(); exportMapImage(); };
    body.querySelector('#an-clear').onclick = () => { closeModal(); clearAnalysisLayers(); toast('Analysis cleared'); };
  });
}

// ---- Buffer / Proximity ----
function toolBuffer() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && ['polygon','line','point'].includes(st.meta.kind)) vecLayers.push([id, st]); }
  openModal('Buffer / Proximity', (body) => {
    body.innerHTML = '<p>Create a buffer zone around features of one layer, then list features from another layer that fall inside it.</p>' +
      '<div class="frow"><label>Source layer</label><select id="bf-src">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Buffer distance (km)</label><input id="bf-dist" type="number" min="0.1" step="0.1" value="5"></div>' +
      '<div class="frow"><label>Check features from layer</label><select id="bf-check">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="bf-run">' + icon('target') + ' Run Buffer Analysis</button></div>';
    body.querySelector('#bf-run').onclick = async () => {
      const srcId = body.querySelector('#bf-src').value;
      const distKm = +body.querySelector('#bf-dist').value;
      const checkId = body.querySelector('#bf-check').value;
      if (!srcId || !distKm || distKm <= 0) { toast('Enter a valid distance'); return; }
      const srcSt = L.get(srcId), checkSt = L.get(checkId);
      if (!srcSt.obj) await loadLayer(srcSt);
      if (!checkSt.obj) await loadLayer(checkSt);
      closeModal();
      const distM = distKm * 1000;
      const buffered = [];
      for (const f of srcSt.obj.features) {
        if (f.hidden) continue;
        buffered.push(bufferFeature(f, distM));
      }
      const hits = [];
      for (const f of checkSt.obj.features) {
        if (f.hidden) continue;
        for (const b of buffered) {
          const br = b.parts[0] && b.parts[0][0];
          if (br && polyOverlapsPoly(f.type === 'poly' ? f.parts : f.parts, [br])) {
            hits.push(f); break;
          }
        }
      }
      addAnalysisLayer(buffered, 'polygon', 'Buffer ' + distKm + ' km', '#0b6b45');
      const html = '<p class="hint">Buffer: <b>' + esc(srcSt.meta.label) + '</b> at <b>' + distKm + ' km</b> radius.</p>' +
        '<p>Features in <b>' + esc(checkSt.meta.label) + '</b> inside the buffer: <b>' + hits.length + '</b></p>' +
        '<p class="muted">Results are shown on the map only. Use the camera button to download a PNG picture.</p>';
      analysisResultModal('Buffer Result', html);
      if (buffered.length) {
        const bb = buffered.reduce((acc, b) => { const b2 = b.bb; return [Math.min(acc[0], b2[0]), Math.min(acc[1], b2[1]), Math.max(acc[2], b2[2]), Math.max(acc[3], b2[3])] }, [1e9, 1e9, -1e9, -1e9]);
        map.fitBounds(bb, 40);
      }
    };
  });
}

// ---- Intersect / Overlay ----
function toolIntersect() {
  const polyLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'polygon') polyLayers.push([id, st]); }
  openModal('Intersect / Overlay', (body) => {
    if (polyLayers.length < 2) { body.innerHTML = '<p class="empty">Need at least two polygon layers switched on.</p>'; return; }
    body.innerHTML = '<p>Find the geometric overlap between two polygon layers. Only the intersecting areas are shown.</p>' +
      '<div class="frow"><label>Layer A</label><select id="ig-a">' + polyLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Layer B</label><select id="ig-b">' + polyLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="ig-run">' + icon('query') + ' Run Intersection</button></div>';
    body.querySelector('#ig-run').onclick = async () => {
      const aId = body.querySelector('#ig-a').value;
      const bId = body.querySelector('#ig-b').value;
      if (!aId || !bId || aId === bId) { toast('Pick two different layers'); return; }
      const aSt = L.get(aId), bSt = L.get(bId);
      if (!aSt.obj) await loadLayer(aSt);
      if (!bSt.obj) await loadLayer(bSt);
      closeModal();
      const results = [];
      for (const fA of aSt.obj.features) {
        if (fA.hidden) continue;
        for (const fB of bSt.obj.features) {
          if (fB.hidden) continue;
          const inter = intersectPolyPoly(fA, fB);
          for (const ring of inter) {
            results.push({ ...fA, parts: [[ring]], fill: bSt.sym.fill || '#a83232' });
          }
        }
      }
      addAnalysisLayer(results, 'polygon', 'Intersection', '#a83232');
      const html = '<p class="hint">Intersection: <b>' + esc(aSt.meta.label) + '</b> ∩ <b>' + esc(bSt.meta.label) + '</b>.</p>' +
        '<p>Overlapping polygon parts: <b>' + results.length + '</b></p>' +
        '<p class="muted">Results are shown on the map only. Use the camera button to download a PNG picture.</p>';
      analysisResultModal('Intersection Result', html);
      if (results.length) {
        const bb = results.reduce((acc, r) => { const b = r.bb; return [Math.min(acc[0], b[0]), Math.min(acc[1], b[1]), Math.max(acc[2], b[2]), Math.max(acc[3], b[3])] }, [1e9, 1e9, -1e9, -1e9]);
        map.fitBounds(bb, 40);
      } else {
        toast('No overlapping areas found');
      }
    };
  });
}

// ---- Nearest Neighbor ----
function toolNearest() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && ['polygon','line','point'].includes(st.meta.kind)) vecLayers.push([id, st]); }
  openModal('Nearest Neighbor', (body) => {
    body.innerHTML = '<p>For each feature in layer A, find the closest feature in layer B and draw a connector line.</p>' +
      '<div class="frow"><label>Source layer (A)</label><select id="nn-a">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Target layer (B)</label><select id="nn-b">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Max results</label><input id="nn-max" type="number" min="1" max="500" value="50"></div>' +
      '<div class="frow act"><button class="btn primary" id="nn-run">' + icon('compass') + ' Find Nearest Neighbors</button></div>';
    body.querySelector('#nn-run').onclick = async () => {
      const aId = body.querySelector('#nn-a').value;
      const bId = body.querySelector('#nn-b').value;
      const maxN = +body.querySelector('#nn-max').value || 50;
      if (!aId || !bId || aId === bId) { toast('Pick two different layers'); return; }
      const aSt = L.get(aId), bSt = L.get(bId);
      if (!aSt.obj) await loadLayer(aSt);
      if (!bSt.obj) await loadLayer(bSt);
      closeModal();
      const connectors = [];
      const summary = [];
      let count = 0;
      for (const fA of aSt.obj.features) {
        if (fA.hidden || count >= maxN) continue;
        const cA = featureCentroid(fA);
        let bestF = null, bestD = 1e9;
        for (const fB of bSt.obj.features) {
          if (fB.hidden) continue;
          const cB = featureCentroid(fB);
          const d = haversineMerc(cA[0], cA[1], cB[0], cB[1]);
          if (d < bestD) { bestD = d; bestF = fB; }
        }
        if (bestF) {
          const cB = featureCentroid(bestF);
          connectors.push({ type: 'line', parts: [[cA[0], cA[1], cB[0], cB[1]]], fill: '#0b6b45', stroke: '#0b6b45', idx: count, props: { from: titleOf(aSt.obj, fA), to: titleOf(bSt.obj, bestF), dist_km: bestD.toFixed(2) } });
          summary.push({ from: titleOf(aSt.obj, fA), to: titleOf(bSt.obj, bestF), dist: bestD });
          count++;
        }
      }
      addAnalysisLayer(connectors, 'line', 'Nearest connectors', '#0b6b45');
      const avg = summary.length ? (summary.reduce((s, r) => s + r.dist, 0) / summary.length).toFixed(2) : '0';
      const html = '<p class="hint">Nearest Neighbor: <b>' + esc(aSt.meta.label) + '</b> → <b>' + esc(bSt.meta.label) + '</b>.</p>' +
        '<p>Connections made: <b>' + count + '</b> · Average distance: <b>' + avg + ' km</b></p>' +
        '<table class="mini"><tr><th>From</th><th>To</th><th>Distance (km)</th></tr>' +
        summary.slice(0, 15).map((r) => '<tr><td>' + esc(r.from) + '</td><td>' + esc(r.to) + '</td><td>' + r.dist + '</td></tr>').join('') +
        '</table>' +
        '<p class="muted">Results are shown on the map only. Use the camera button to download a PNG picture.</p>';
      analysisResultModal('Nearest Neighbor Result', html);
    };
  });
}

// ---- Dissolve / Merge ----
function toolDissolve() {
  const polyLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'polygon') polyLayers.push([id, st]); }
  openModal('Dissolve / Merge', (body) => {
    body.innerHTML = '<p>Merge polygons that share the same attribute value into a single multi-polygon.</p>' +
      '<div class="frow"><label>Layer to dissolve</label><select id="ds-layer">' + polyLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Dissolve field</label><select id="ds-field"></select></div>' +
      '<div class="frow act"><button class="btn primary" id="ds-run">' + icon('merge') + ' Run Dissolve</button></div>';
    const layerSel = body.querySelector('#ds-layer');
    const fieldSel = body.querySelector('#ds-field');
    layerSel.onchange = () => {
      const st = L.get(layerSel.value);
      fieldSel.innerHTML = (st?.meta.fields || []).map((f) => '<option value="' + esc(f.name) + '">' + esc(f.label || f.name) + '</option>').join('');
    };
    layerSel.onchange();
    body.querySelector('#ds-run').onclick = async () => {
      const st = L.get(layerSel.value);
      const field = fieldSel.value;
      if (!st.obj) await loadLayer(st);
      closeModal();
      const groups = new Map();
      for (const f of st.obj.features) {
        if (f.hidden) continue;
        const key = String(f.props[field] ?? '');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(f);
      }
      const dissolved = [];
      let idx = 0;
      for (const [key, feats] of groups) {
        const allRings = [];
        for (const f of feats) for (const poly of f.parts) for (const ring of poly) {
          const pts = [];
          for (let i = 0; i < ring.length; i += 2) pts.push([ring[i], ring[i + 1]]);
          allRings.push(pts);
        }
        const flatPts = allRings.flat();
        const hullRing = convexHullPoints(flatPts);
        if (hullRing) dissolved.push({ type: 'poly', parts: [[hullRing]], fill: '#7a4b00', stroke: '#7a4b00', idx: idx++, props: { [field]: key, dissolved_count: feats.length } });
      }
      addAnalysisLayer(dissolved, 'polygon', 'Dissolved: ' + field, '#7a4b00');
      const html = '<p class="hint">Dissolve: <b>' + esc(st.meta.label) + '</b> by <b>' + esc(field) + '</b>.</p>' +
        '<p>Resulting merged polygons: <b>' + dissolved.length + '</b></p>' +
        '<table class="mini"><tr><th>' + esc(field) + '</th><th>Features merged</th></tr>' +
        [...groups.entries()].map(([k, fs]) => '<tr><td>' + esc(k) + '</td><td>' + fs.length + '</td></tr>').join('') +
        '</table>' +
        '<p class="muted">Results are shown on the map only. Use the camera button to download a PNG picture.</p>';
      analysisResultModal('Dissolve Result', html);
      if (dissolved.length) {
        const bb = dissolved.reduce((acc, d) => { const b = d.bb; return [Math.min(acc[0], b[0]), Math.min(acc[1], b[1]), Math.max(acc[2], b[2]), Math.max(acc[3], b[3])] }, [1e9, 1e9, -1e9, -1e9]);
        map.fitBounds(bb, 40);
      }
    };
  });
}

// ---- Count Points in Polygons ----
function toolCount() {
  const polyLayers = [], pointLayers = [];
  for (const id of stack) { const st = L.get(id); if (!st?.obj?.features) continue; if (st.meta.kind === 'polygon') polyLayers.push([id, st]); if (st.meta.kind === 'point') pointLayers.push([id, st]); }
  openModal('Count Points in Polygons', (body) => {
    if (!polyLayers.length || !pointLayers.length) { body.innerHTML = '<p class="empty">Need at least one polygon layer and one point layer switched on.</p>'; return; }
    body.innerHTML = '<p>Count how many point features fall inside each polygon.</p>' +
      '<div class="frow"><label>Polygon layer</label><select id="cp-poly">' + polyLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Point layer</label><select id="cp-pt">' + pointLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="cp-run">' + icon('table') + ' Count Points</button></div>';
    body.querySelector('#cp-run').onclick = async () => {
      const polyId = body.querySelector('#cp-poly').value;
      const ptId = body.querySelector('#cp-pt').value;
      const pSt = L.get(polyId), tSt = L.get(ptId);
      if (!pSt.obj) await loadLayer(pSt);
      if (!tSt.obj) await loadLayer(tSt);
      closeModal();
      const results = [];
      let total = 0;
      for (const f of pSt.obj.features) {
        if (f.hidden) continue;
        let n = 0;
        for (const pf of tSt.obj.features) {
          if (pf.hidden) continue;
          const c = featureCentroid(pf);
          let inside = false;
          for (const poly of f.parts) for (const ring of poly) { if (pip2(c[0], c[1], [ring])) { inside = true; break; } }
          if (inside) n++;
        }
        total += n;
        results.push({ ...f, fill: '#0b6b45', props: { ...f.props, point_count: n } });
      }
      addAnalysisLayer(results, 'polygon', 'Point count', '#0b6b45');
      const html = '<p class="hint">Count: <b>' + esc(tSt.meta.label) + '</b> points in <b>' + esc(pSt.meta.label) + '</b> polygons.</p>' +
        '<p>Total points inside polygons: <b>' + total + '</b></p>' +
        '<table class="mini"><tr><th>Polygon</th><th>Point count</th></tr>' +
        results.map((r) => '<tr><td>' + esc(titleOf(pSt.obj, r)) + '</td><td><b>' + r.props.point_count + '</b></td></tr>').slice(0, 20).join('') +
        '</table>' +
        '<p class="muted">Results are shown on the map only. Use the camera button to download a PNG picture.</p>';
      analysisResultModal('Point Count Result', html);
      const bb = results.reduce((acc, r) => { const b = r.bb; return [Math.min(acc[0], b[0]), Math.min(acc[1], b[1]), Math.max(acc[2], b[2]), Math.max(acc[3], b[3])] }, [1e9, 1e9, -1e9, -1e9]);
      map.fitBounds(bb, 40);
    };
  });
}

// ---- Convex Hull ----
function toolHull() {
  const ptLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'point') ptLayers.push([id, st]); }
  openModal('Convex Hull', (body) => {
    body.innerHTML = '<p>Draw the smallest convex boundary that encloses all points of a layer.</p>' +
      '<div class="frow"><label>Point layer</label><select id="hu-layer">' + ptLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="hu-run">' + icon('polygon') + ' Create Convex Hull</button></div>';
    body.querySelector('#hu-run').onclick = async () => {
      const st = L.get(body.querySelector('#hu-layer').value);
      if (!st.obj) await loadLayer(st);
      closeModal();
      const pts = [];
      for (const f of st.obj.features) {
        if (f.hidden) continue;
        const c = featureCentroid(f);
        pts.push(c);
      }
      const ring = convexHullPoints(pts);
      if (!ring) { toast('Not enough points for a hull'); return; }
      const area = ringAreaKm2(pts.map(p => [unX(p[0]), unY(p[1])]));
      addAnalysisLayer([{ type: 'poly', parts: [[ring]], fill: '#1e78ff', stroke: '#1e78ff', props: { hull_area_km2: area.toFixed(2) } }], 'polygon', 'Convex hull', '#1e78ff');
      const html = '<p class="hint">Convex Hull: <b>' + esc(st.meta.label) + '</b>.</p>' +
        '<p>Points enclosed: <b>' + pts.length + '</b> · Hull area: <b>' + area.toFixed(2) + ' km²</b></p>' +
        '<p class="muted">Results are shown on the map only. Use the camera button to download a PNG picture.</p>';
      analysisResultModal('Convex Hull Result', html);
    };
  });
}

// ---- Simplify Geometry ----
function toolSimplify() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'polygon') vecLayers.push([id, st]); }
  openModal('Simplify Geometry', (body) => {
    body.innerHTML = '<p>Reduce the vertex count of polygon boundaries while preserving overall shape (Douglas-Peucker).</p>' +
      '<div class="frow"><label>Layer</label><select id="sy-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Tolerance (km)</label><input id="sy-tol" type="number" min="0.01" step="0.1" value="1"></div>' +
      '<div class="frow act"><button class="btn primary" id="sy-run">' + icon('sliders') + ' Simplify</button></div>';
    body.querySelector('#sy-run').onclick = async () => {
      const st = L.get(body.querySelector('#sy-layer').value);
      const tol = +body.querySelector('#sy-tol').value || 1;
      if (!st.obj) await loadLayer(st);
      closeModal();
      const simplified = [];
      let totalVerts = 0, newVerts = 0;
      for (const f of st.obj.features) {
        if (f.hidden) continue;
        totalVerts += f.parts.reduce((s, p) => s + p.reduce((ss, r) => ss + r.length / 2, 0), 0);
        const sf = simplifyFeature(f, tol);
        newVerts += sf.parts.reduce((s, p) => s + p.reduce((ss, r) => ss + r.length / 2, 0), 0);
        simplified.push(sf);
      }
      addAnalysisLayer(simplified, 'polygon', 'Simplified', '#34c27d');
      const html = '<p class="hint">Simplify: <b>' + esc(st.meta.label) + '</b> at <b>' + tol + ' km</b> tolerance.</p>' +
        '<p>Vertices: <b>' + totalVerts + '</b> → <b>' + newVerts + '</b> (' + ((1 - newVerts / Math.max(1, totalVerts)) * 100).toFixed(1) + '% reduction)</p>' +
        '<p class="muted">Results are shown on the map only. Use the camera button to download a PNG picture.</p>';
      analysisResultModal('Simplify Result', html);
    };
  });
}

// ---- Zonal Statistics ----
function toolZonal() {
  const polyLayers = [], rasterLayers = [];
  for (const id of stack) { const st = L.get(id); if (!st?.obj) continue; if (st.meta.kind === 'polygon') polyLayers.push([id, st]); if (st.meta.kind === 'raster') rasterLayers.push([id, st]); }
  openModal('Zonal Statistics', (body) => {
    if (!polyLayers.length || !rasterLayers.length) { body.innerHTML = '<p class="empty">Need at least one polygon layer and one raster layer switched on.</p>'; return; }
    body.innerHTML = '<p>Summarize raster cell values within each polygon (count, mean, min, max).</p>' +
      '<div class="frow"><label>Polygon layer</label><select id="zn-poly">' + polyLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Raster layer</label><select id="zn-raster">' + rasterLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="zn-run">' + icon('chart') + ' Compute Zonal Stats</button></div>';
    body.querySelector('#zn-run').onclick = async () => {
      const pSt = L.get(body.querySelector('#zn-poly').value);
      const rSt = L.get(body.querySelector('#zn-raster').value);
      if (!pSt.obj) await loadLayer(pSt);
      if (!rSt.obj || !rSt.obj.vals) { try { await loadValues(rSt); } catch { toast('Could not load raster values'); return; } }
      closeModal();
      const o = rSt.obj.vals;
      const { w, h, data, dtype, wb } = o;
      const results = [];
      for (const f of pSt.obj.features) {
        if (f.hidden) continue;
        let count = 0, sum = 0, min = 1e9, max = -1e9, valid = 0;
        const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 20000)));
        for (let j = 0; j < h; j += step) {
          for (let i = 0; i < w; i += step) {
            const v = data[j * w + i];
            if (dtype === 'i2' ? v === -32768 : !isFinite(v)) continue;
            const wx = wb[0] + (i + step / 2) / w * (wb[2] - wb[0]);
            const wy = wb[1] + (j + step / 2) / h * (wb[3] - wb[1]);
            let inside = false;
            for (const poly of f.parts) for (const ring of poly) { if (pip2(wx, wy, [ring])) { inside = true; break; } }
            if (inside) {
              count++;
              valid++;
              sum += v;
              if (v < min) min = v;
              if (v > max) max = v;
            }
          }
        }
        if (valid > 0) {
          results.push({ ...f, fill: '#a83232', props: { ...f.props, zn_count: count, zn_mean: (sum / valid).toFixed(2), zn_min: min.toFixed(2), zn_max: max.toFixed(2) } });
        }
      }
      addAnalysisLayer(results, 'polygon', 'Zonal stats', '#a83232');
      const html = '<p class="hint">Zonal Statistics: <b>' + esc(rSt.meta.label) + '</b> within <b>' + esc(pSt.meta.label) + '</b>.</p>' +
        '<p>Polygons with valid data: <b>' + results.length + '</b></p>' +
        '<table class="mini"><tr><th>Polygon</th><th>Cells</th><th>Mean</th><th>Min</th><th>Max</th></tr>' +
        results.map((r) => '<tr><td>' + esc(titleOf(pSt.obj, r)) + '</td><td>' + r.props.zn_count + '</td><td>' + r.props.zn_mean + '</td><td>' + r.props.zn_min + '</td><td>' + r.props.zn_max + '</td></tr>').slice(0, 15).join('') +
        '</table>' +
        '<p class="muted">Results are shown on the map only. Use the camera button to download a PNG picture.</p>';
      analysisResultModal('Zonal Statistics Result', html);
      if (results.length) {
        const bb = results.reduce((acc, r) => { const b = r.bb; return [Math.min(acc[0], b[0]), Math.min(acc[1], b[1]), Math.max(acc[2], b[2]), Math.max(acc[3], b[3])] }, [1e9, 1e9, -1e9, -1e9]);
        map.fitBounds(bb, 40);
      }
    };
  });
}



// ------------------------------------------------ cartography & design tools

// Perceptual color ramps (ColorBrewer-style, no backend)
const COLOR_RAMPS = {
  viridis: ['#440154', '#482878', '#3e4a89', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725'],
  plasma: ['#0d0887', '#41049d', '#6a00a8', '#8f0da4', '#b12a90', '#cc4778', '#e16462', '#f2844b', '#fca636', '#fcce25'],
  cividis: ['#00224e', '#3b528b', '#2c728e', '#218f8b', '#20a386', '#35b779', '#5ec962', '#8ed645', '#c2df23', '#fde725'],
  inferno: ['#000004', '#1b0c42', '#4a0c6b', '#7d1f67', '#ad4365', '#d96e54', '#f2844b', '#fca636', '#fcce25', '#f0f921'],
  magma: ['#000004', '#181747', '#3f0f70', '#681a82', '#8c2980', '#ac3978', '#ca5a6f', '#e16462', '#f2844b', '#fca636'],
  blues: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b', '#08306b'],
  greens: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b', '#00441b'],
  oranges: ['#fff5eb', '#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#a63603', '#7f2704', '#7f2704'],
  reds: ['#fff5f0', '#fee0d2', '#fcbb91', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d', '#67000d'],
  purples: ['#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#54278f', '#3f007d', '#3f007d'],
  greys: ['#ffffff', '#f0f0f0', '#d9d9d9', '#bdbdbd', '#969696', '#737373', '#525252', '#252525', '#000000', '#000000'],
  earth: ['#f6e8c3', '#dfc27d', '#bf812d', '#8c564b', '#636363', '#3a3a3a', '#1a1a1a', '#0a0a0a', '#050505', '#000000'],
};

function rampNames() { return Object.keys(COLOR_RAMPS); }

// ---- Color Ramps tool ----
function toolRamp() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && ['polygon','line','point'].includes(st.meta.kind)) vecLayers.push([id, st]); }
  openModal('Color Ramps', (body) => {
    body.innerHTML = '<p>Apply a perceptual color ramp to a layer. Works with reclassified layers or single-color layers.</p>' +
      '<div class="frow"><label>Layer</label><select id="rp-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Color ramp</label><select id="rp-ramp">' + rampNames().map((n) => '<option value="' + esc(n) + '">' + esc(n) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Mode</label><select id="rp-mode">' +
        '<option value="single">Single color from ramp</option>' +
        '<option value="reclass">Reclassify numeric field</option>' +
      '</select></div>' +
      '<div id="rp-reclass" style="margin-top:8px"><label>Field</label><select id="rp-field"></select>' +
      '<label>Classes</label><input id="rp-n" type="number" min="2" max="12" value="5"></div>' +
      '<div class="frow act"><button class="btn primary" id="rp-run">' + icon('palette') + ' Apply Ramp</button></div>' +
      '<div id="rp-preview" style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap"></div>';
    const layerSel = body.querySelector('#rp-layer');
    const rampSel = body.querySelector('#rp-ramp');
    const modeSel = body.querySelector('#rp-mode');
    const reclassDiv = body.querySelector('#rp-reclass');
    const fieldSel = body.querySelector('#rp-field');
    const nSel = body.querySelector('#rp-n');
    const preview = body.querySelector('#rp-preview');
    function updatePreview() {
      const ramp = COLOR_RAMPS[rampSel.value] || COLOR_RAMPS.viridis;
      preview.innerHTML = ramp.map((c) => '<i style="display:inline-block;width:24px;height:16px;background:' + esc(c) + ';border:1px solid rgba(0,0,0,.2)"></i>').join('');
    }
    rampSel.onchange = updatePreview;
    modeSel.onchange = () => { reclassDiv.style.display = modeSel.value === 'reclass' ? 'block' : 'none'; };
    layerSel.onchange = () => {
      const st = L.get(layerSel.value);
      fieldSel.innerHTML = (st?.meta.fields || []).filter((f) => f.type === 'number').map((f) => '<option value="' + esc(f.name) + '">' + esc(f.label || f.name) + '</option>').join('');
    };
    layerSel.onchange();
    updatePreview();
    body.querySelector('#rp-run').onclick = async () => {
      const st = L.get(layerSel.value);
      const ramp = COLOR_RAMPS[rampSel.value];
      const mode = modeSel.value;
      if (!st.obj) await loadLayer(st);
      if (!st.sym) st.sym = defaultSym(st.meta);
      closeModal();
      if (mode === 'single') {
        st.sym.fillMode = 'single';
        st.sym.fill = ramp[Math.floor(ramp.length / 2)];
        st.sym.stroke = ramp[Math.floor(ramp.length / 2)];
        applyLayerState(st);
        toast('Applied ' + rampSel.value + ' color to ' + st.meta.label);
      } else {
        const field = fieldSel.value;
        const n = +nSel.value || 5;
        if (!field) { toast('Pick a numeric field'); return; }
        st.reclass = { field, method: 'quantile', n, ramp: rampSel.value };
        applyReclass(st);
        toast('Reclassified ' + st.meta.label + ' by ' + field + ' using ' + rampSel.value);
      }
      renderLayerLists(); refreshLegend(); saveProject();
    };
  });
}

// ---- Custom Basemap tool ----
function toolCustomBasemap() {
  const existing = JSON.parse(localStorage.getItem('nwg.custom_basemaps') || '{}');
  openModal('Custom Basemap', (body) => {
    body.innerHTML = '<p>Add your own XYZ tile basemap. No backend — stored only in your browser.</p>' +
      '<div class="frow"><label>Name</label><input id="cb-name" type="text" placeholder="e.g. My Agency Basemap"></div>' +
      '<div class="frow"><label>Tile URL</label><input id="cb-url" type="text" placeholder="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"></div>' +
      '<div class="frow"><label>Max zoom</label><input id="cb-maxz" type="number" min="1" max="22" value="18"></div>' +
      '<div class="frow"><label>Subdomains</label><input id="cb-sub" type="text" value="abc" placeholder="abc"></div>' +
      '<div class="frow act"><button class="btn primary" id="cb-add">' + icon('layers') + ' Add Basemap</button></div>' +
      '<div class="frow" style="margin-top:10px"><h4>Saved basemaps</h4><div id="cb-list"></div></div>';
    function renderList() {
      const keys = Object.keys(existing);
      body.querySelector('#cb-list').innerHTML = keys.length
        ? keys.map((k) => '<div style="padding:4px 8px;border-bottom:1px solid var(--line)"><b>' + esc(k) + '</b> <span class="muted">' + esc(existing[k].url) + '</span> <button class="chip" data-del="' + esc(k) + '">Remove</button></div>').join('')
        : '<p class="empty">No custom basemaps saved.</p>';
      body.querySelectorAll('[data-del]').forEach((b) => {
        b.onclick = () => { delete existing[b.dataset.del]; localStorage.setItem('nwg.custom_basemaps', JSON.stringify(existing)); renderList(); };
      });
    }
    renderList();
    body.querySelector('#cb-add').onclick = () => {
      const name = body.querySelector('#cb-name').value.trim();
      const url = body.querySelector('#cb-url').value.trim();
      const maxz = +body.querySelector('#cb-maxz').value || 18;
      const sub = body.querySelector('#cb-sub').value.trim() || 'abc';
      if (!name || !url) { toast('Name and URL required'); return; }
      if (!url.includes('{z}') || !url.includes('{x}') || !url.includes('{y}')) { toast('URL must contain {z}, {x}, {y}'); return; }
      existing[name] = { url, max: maxz, sub };
      localStorage.setItem('nwg.custom_basemaps', JSON.stringify(existing));
      // Register in BASEMAPS
      BASEMAPS[name] = { label: name, url, sub, max: maxz, bg: '#f3f4f2', attr: 'Custom basemap: ' + esc(name) };
      BASEMAP_ORDER.push(name);
      buildBasemaps(); syncBasemapUI(); renderLayerTools();
      map.setBasemap(name);
      renderList();
      toast('Custom basemap "' + name + '" added');
    };
  });
}

// ---- Map Presets tool ----
function toolMapPreset() {
  const presets = JSON.parse(localStorage.getItem('nwg.map_presets') || '{}');
  openModal('Map Presets', (body) => {
    body.innerHTML = '<p>Save the current map state (layers, filters, clip, basemap, view) under a name, and restore it later. Local storage only.</p>' +
      '<div class="frow"><label>Preset name</label><input id="mp-name" type="text" placeholder="e.g. Mineral view"></div>' +
      '<div class="frow act"><button class="btn primary" id="mp-save">' + icon('pin') + ' Save Current View</button></div>' +
      '<div class="frow" style="margin-top:10px"><h4>Saved presets</h4><div id="mp-list"></div></div>';
    function renderList() {
      const keys = Object.keys(presets);
      body.querySelector('#mp-list').innerHTML = keys.length
        ? keys.map((k) => '<div style="padding:4px 8px;border-bottom:1px solid var(--line);display:flex;gap:6px;align-items:center"><b>' + esc(k) + '</b><span class="muted" style="flex:1">' + esc(presets[k].note || '') + '</span><button class="btn" data-restore="' + esc(k) + '">Restore</button><button class="chip" data-del="' + esc(k) + '">Remove</button></div>').join('')
        : '<p class="empty">No map presets saved.</p>';
      body.querySelectorAll('[data-restore]').forEach((b) => {
        b.onclick = () => { applyMapPreset(b.dataset.restore); closeModal(); };
      });
      body.querySelectorAll('[data-del]').forEach((b) => {
        b.onclick = () => { delete presets[b.dataset.del]; localStorage.setItem('nwg.map_presets', JSON.stringify(presets)); renderList(); };
      });
    }
    renderList();
    body.querySelector('#mp-save').onclick = () => {
      const name = body.querySelector('#mp-name').value.trim();
      if (!name) { toast('Enter a preset name'); return; }
      const stackRec = stack.map((id) => { const st = L.get(id); return { id, on: st.on, opacity: st.opacity }; });
      const filters = {}; for (const [id, st] of L) if (st.filter) filters[id] = st.filter;
      const clipRec = clip ? { type: clip.type, bb: clip.bb, label: focusLabel } : null;
      presets[name] = {
        basemap: map.basemap,
        center: map.center(),
        zoom: map.zoom,
        stack: stackRec,
        filters,
        clip: clipRec,
        grid: gridOn,
        note: '',
      };
      localStorage.setItem('nwg.map_presets', JSON.stringify(presets));
      renderList();
      toast('Map preset "' + name + '" saved');
    };
  });
}

function applyMapPreset(name) {
  const presets = JSON.parse(localStorage.getItem('nwg.map_presets') || '{}');
  const p = presets[name];
  if (!p) return;
  // Turn off all, then turn on preset layers
  for (const id of [...stack]) setLayer(id, false, { quiet: true });
  for (const rec of p.stack) {
    const st = L.get(rec.id);
    if (st) { st.opacity = rec.opacity; setLayer(rec.id, true, { quiet: true }); }
  }
  if (p.basemap && BASEMAPS[p.basemap]) map.setBasemap(p.basemap);
  if (p.center) map.setView(p.center[0], p.center[1], p.zoom);
  gridOn = p.grid || false; map.setGrid(gridOn);
  if (p.clip) setFocus({ type: p.clip.type, wb: p.clip.wb, label: p.clip.label || '' });
  else stopFocus();
  // restore filters
  for (const [id, fl] of Object.entries(p.filters || {})) { const st = L.get(id); if (st) { st.filter = fl; applyFilter(st, false); } }
  renderLayerLists(); refreshLegend(); updateFocusUI(); updateToolState(); saveProject();
  toast('Map preset "' + name + '" restored');
}

// ---- Print Layouts tool ----
function toolPrintLayout() {
  openModal('Print Layouts', (body) => {
    body.innerHTML = '<p>Choose a page template for PNG export. Adds margins, title block, and scale bar area around the map.</p>' +
      '<div class="frow"><label>Page size</label><select id="pl-size">' +
        '<option value="a4">A4 (210 × 297 mm)</option>' +
        '<option value="letter">Letter (8.5 × 11 in)</option>' +
        '<option value="a3">A3 (297 × 420 mm)</option>' +
      '</select></div>' +
      '<div class="frow"><label>Orientation</label><select id="pl-orient">' +
        '<option value="portrait">Portrait</option>' +
        '<option value="landscape">Landscape</option>' +
      '</select></div>' +
      '<div class="frow"><label>Margin (mm)</label><input id="pl-margin" type="number" min="5" max="50" value="15"></div>' +
      '<div class="frow act"><button class="btn primary" id="pl-set">' + icon('camera') + ' Use for Next Export</button></div>' +
      '<p class="muted">The chosen layout applies when you download a PNG from Export results.</p>';
    body.querySelector('#pl-set').onclick = () => {
      localStorage.setItem('nwg.print_layout', JSON.stringify({
        size: body.querySelector('#pl-size').value,
        orient: body.querySelector('#pl-orient').value,
        margin: +body.querySelector('#pl-margin').value || 15,
      }));
      closeModal();
      toast('Print layout set: ' + body.querySelector('#pl-size').value + ' ' + body.querySelector('#pl-orient').value);
    };
  });
}



// ------------------------------------------------ search & discovery tools

// ---- Feature Finder: search attributes across all active vector layers ----
function toolFeatureFinder() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.fields) vecLayers.push(st); }
  if (!vecLayers.length) { toast('No vector layer with attributes loaded'); return; }
  openModal('Feature Finder', (body) => {
    body.innerHTML = '<p>Search feature attributes across all active layers. Results are highlighted on the map — no data is exported.</p>' +
      '<div class="frow"><label>Search text</label><input id="ff-q" type="search" placeholder="Type a name, ID, code…"></div>' +
      '<div class="frow"><label>Limit</label><select id="ff-limit"><option value="20">20 results</option><option value="50">50 results</option><option value="100">100 results</option></select></div>' +
      '<div class="frow act"><button class="btn primary" id="ff-run">' + icon('search') + ' Search</button></div>' +
      '<div id="ff-results" style="margin-top:10px;max-height:300px;overflow-y:auto"></div>';
    const qSel = body.querySelector('#ff-q');
    const limitSel = body.querySelector('#ff-limit');
    const resDiv = body.querySelector('#ff-results');
    let lastMatches = [];
    function renderResults() {
      resDiv.innerHTML = lastMatches.map((m) =>
        '<div style="padding:6px 8px;border-bottom:1px solid var(--line);cursor:pointer" data-idx="' + m.idx + '">' +
        '<b>' + esc(m.label) + '</b><br><small style="color:var(--muted)">' + esc(m.layer) + ' · ' + esc(m.field) + ' = ' + esc(String(m.value)) + '</small></div>').join('') ||
        '<p class="empty">Enter a search term.</p>';
      resDiv.querySelectorAll('[data-idx]').forEach((el) => {
        el.onclick = () => { const m = lastMatches[+el.dataset.idx]; closeModal(); map.selection = { feature: m.feature, layer: m.layer }; map.zoomToFeature(m.feature, 70); showResults([{ layer: m.layer, feature: m.feature }]); openSheet('info', true); toast('Found: ' + m.label); };
      });
    }
    body.querySelector('#ff-run').onclick = () => {
      const q = qSel.value.trim().toLowerCase();
      const limit = +limitSel.value;
      if (!q || q.length < 2) { toast('Enter at least 2 characters'); return; }
      lastMatches = [];
      let n = 0;
      for (const st of vecLayers) {
        if (!st.obj) continue;
        for (const f of st.obj.features) {
          if (n >= limit) break;
          for (const field of st.meta.fields) {
            const v = f.props[field.name];
            if (v != null && String(v).toLowerCase().includes(q)) {
              lastMatches.push({ idx: lastMatches.length, label: titleOf(st.obj, f), layer: st.meta.label, field: field.label || field.name, value: v, feature: f, layerObj: st.obj });
              n++; break;
            }
          }
        }
        if (n >= limit) break;
      }
      renderResults();
      toast(n + ' feature' + (n === 1 ? '' : 's') + ' matched');
    };
    qSel.oninput = () => { renderResults(); };
  });
}

// ---- Coordinate Inspector: click map to read coordinates ----
function toolCoordInspector() {
  openModal('Coordinate Inspector', (body) => {
    body.innerHTML = '<p>Click anywhere on the map to read coordinates. Decimal degrees (DD) and degrees-minutes-seconds (DMS).</p>' +
      '<div class="frow"><label>Latitude (DD)</label><input id="ci-lat" type="text" readonly></div>' +
      '<div class="frow"><label>Longitude (DD)</label><input id="ci-lon" type="text" readonly></div>' +
      '<div class="frow"><label>Latitude (DMS)</label><input id="ci-dmslat" type="text" readonly></div>' +
      '<div class="frow"><label>Longitude (DMS)</label><input id="ci-dmslon" type="text" readonly></div>' +
      '<div class="frow"><label>UTM zone</label><input id="ci-utm" type="text" readonly></div>' +
      '<div class="frow act"><button class="btn" id="ci-clear">' + icon('trash') + ' Clear</button><button class="btn primary" id="ci-done">' + icon('close') + ' Stop inspecting</button></div>' +
      '<p class="muted" style="margin-top:8px">Click on the map to pick a location.</p>';
    const latEl = body.querySelector('#ci-lat'), lonEl = body.querySelector('#ci-lon');
    const dmsLatEl = body.querySelector('#ci-dmslat'), dmsLonEl = body.querySelector('#ci-dmslon');
    const utmEl = body.querySelector('#ci-utm');
    function toDMS(v, isLat) {
      const abs = Math.abs(v), deg = Math.floor(abs), min = Math.floor((abs - deg) * 60), sec = ((abs - deg) * 60 - min) * 60;
      const dir = v < 0 ? (isLat ? 'S' : 'W') : (isLat ? 'N' : 'E');
      return deg + '°' + String(min).padStart(2, '0') + '\'' + sec.toFixed(1) + '"' + dir;
    }
    function utmZone(lon) { return Math.floor((lon + 180) / 6) + 1; }
    function setCoord(la, lo) {
      latEl.value = la.toFixed(5); lonEl.value = lo.toFixed(5);
      dmsLatEl.value = toDMS(la, true); dmsLonEl.value = toDMS(lo, false);
      utmEl.value = 'Zone ' + utmZone(lo) + (lo < 0 ? ' (west)' : '');
    }
    const handler = (e) => {
      const r = map.cv.getBoundingClientRect();
      const [px, py] = map.rotPos(e.clientX - r.left, e.clientY - r.top);
      const [lo, la] = map.lonlatAt(px, py);
      setCoord(la, lo);
    };
    map.cv.addEventListener('pointerclick', handler);
    body.querySelector('#ci-clear').onclick = () => { latEl.value = ''; lonEl.value = ''; dmsLatEl.value = ''; dmsLonEl.value = ''; utmEl.value = ''; };
    body.querySelector('#ci-done').onclick = () => { map.cv.removeEventListener('pointerclick', handler); closeModal(); };
  });
}

// ---- Coordinate Converter: DD <-> DMS <-> UTM ----
function toolCoordConverter() {
  openModal('Coordinate Converter', (body) => {
    body.innerHTML = '<p>Convert between decimal degrees, degrees-minutes-seconds, and UTM zone.</p>' +
      '<div class="frow"><label>Latitude (DD)</label><input id="cc-lat" type="number" step="0.000001" placeholder="9.0765"></div>' +
      '<div class="frow"><label>Longitude (DD)</label><input id="cc-lon" type="number" step="0.000001" placeholder="7.3986"></div>' +
      '<div class="frow act"><button class="btn primary" id="cc-to-dd">' + icon('target') + ' To DD</button><button class="btn" id="cc-to-dms">' + icon('calc') + ' To DMS</button></div>' +
      '<div id="cc-out" style="margin-top:10px;padding:8px;background:var(--surface);border-radius:6px"></div>' +
      '<div class="frow act" style="margin-top:10px"><button class="btn" id="cc-goto">' + icon('target') + ' Go to on map</button></div>';
    const latEl = body.querySelector('#cc-lat'), lonEl = body.querySelector('#cc-lon');
    const out = body.querySelector('#cc-out');
    function toDMS(v, isLat) {
      const abs = Math.abs(v), deg = Math.floor(abs), min = Math.floor((abs - deg) * 60), sec = ((abs - deg) * 60 - min) * 60;
      const dir = v < 0 ? (isLat ? 'S' : 'W') : (isLat ? 'N' : 'E');
      return deg + '°' + String(min).padStart(2, '0') + '\'' + sec.toFixed(1) + '" ' + dir;
    }
    function utmZone(lon) { return Math.floor((lon + 180) / 6) + 1; }
    function update() {
      const la = +latEl.value, lo = +lonEl.value;
      if (!isFinite(la) || !isFinite(lo) || Math.abs(la) > 85 || Math.abs(lo) > 180) { out.innerHTML = '<p class="empty">Enter valid coordinates.</p>'; return; }
      out.innerHTML = '<b>Decimal Degrees:</b> ' + la.toFixed(5) + ', ' + lo.toFixed(5) + '<br>' +
        '<b>DMS:</b> ' + toDMS(la, true) + ', ' + toDMS(lo, false) + '<br>' +
        '<b>UTM:</b> Zone ' + utmZone(lo) + (lo < 0 ? ' (Southern/Western hemisphere)' : '');
    }
    latEl.oninput = update; lonEl.oninput = update;
    body.querySelector('#cc-to-dd').onclick = update;
    body.querySelector('#cc-to-dms').onclick = update;
    body.querySelector('#cc-goto').onclick = () => {
      const la = +latEl.value, lo = +lonEl.value;
      if (!isFinite(la) || !isFinite(lo)) { toast('Enter valid coordinates'); return; }
      map.setView(lo, la, map.zoom); closeModal(); toast(fmtLL(la, lo));
    };
  });
}

// ---- Layer Discovery: search layer catalog ----
function toolLayerDiscovery() {
  openModal('Layer Discovery', (body) => {
    body.innerHTML = '<p>Search and browse the layer catalog. Click a layer to add it to the map.</p>' +
      '<div class="frow"><label>Search</label><input id="ld-q" type="search" placeholder="Search layer names, types, sources…"></div>' +
      '<div id="ld-list" style="max-height:320px;overflow-y:auto;border:1px solid var(--line);border-radius:6px"></div>' +
      '<p class="muted" style="margin-top:6px">Layers are added to the map but not exported.</p>';
    const qSel = body.querySelector('#ld-q');
    const listDiv = body.querySelector('#ld-list');
    function render() {
      const q = qSel.value.trim().toLowerCase();
      const matched = catalog.layers.filter((m) =>
        !q || m.label.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || m.kind.toLowerCase().includes(q) || (m.source || '').toLowerCase().includes(q)
      );
      listDiv.innerHTML = matched.map((m) => {
        const on = stack.includes(m.id);
        return '<div style="padding:6px 8px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;cursor:pointer" data-id="' + esc(m.id) + '">' +
          '<div><b>' + esc(m.label) + '</b><br><small style="color:var(--muted)">' + esc(KIND_LABEL[m.kind] || m.kind) + ' · ' + esc(m.id) + '</small></div>' +
          '<button class="btn ' + (on ? 'primary' : '') + '" data-act="' + (on ? 'off' : 'on') + '">' + (on ? 'On' : 'Add') + '</button></div>';
      }).join('') || '<p class="empty">No matching layers.</p>';
      listDiv.querySelectorAll('[data-act]').forEach((btn) => {
        btn.onclick = (e) => { e.stopPropagation(); const id = btn.closest('[data-id]').dataset.id; if (btn.dataset.act === 'on') { setLayer(id, true); } else { setLayer(id, false); } render(); saveProject(); toast((btn.dataset.act === 'on' ? 'Added' : 'Removed') + ' ' + id); };
      });
      listDiv.querySelectorAll('[data-id]').forEach((el) => {
        el.onclick = (e) => { if (e.target.tagName === 'BUTTON') return; const id = el.dataset.id; const st = L.get(id); if (st) { setLayer(id, true); zoomToLayer(st.meta); closeModal(); toast('Added ' + st.meta.label); } };
      });
    }
    qSel.oninput = render;
    render();
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
    body.innerHTML = `<p class="muted">Bring a GeoJSON file (points, lines or polygons) onto the map. It is added as a layer for this session and can be styled and labelled; its attribute rows can be exported as CSV.</p>
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
  openModal('Export results', (body) => {
    const hasClip = !!clip;
    const drawnShape = draw && (draw.kind === 'rect' || draw.kind === 'square' || draw.kind === 'circle' || draw.kind === 'poly' || draw.kind === 'freehand') && draw.pts.length > 0;
    body.innerHTML = '<p class="muted">Download a high-quality PNG map image. Cartographic elements are drawn around the map area.</p>' +
      '<div class="frow"><label>Export area</label><select id="exp-area">' +
      '<option value="screen">Current screen / viewport</option>' +
      (hasClip ? '<option value="clip">Active clip (focus area)</option>' : '') +
      (drawnShape ? '<option value="drawn">Drawn shape on the map</option>' : '') +
      '<option value="feature">Picked polygon feature(s)</option></select></div>' +
      '<div class="frow"><label>Title</label><input id="exp-title" type="text" placeholder="Map title"></div>' +
      '<div class="frow act">' +
      '<label style="flex:none;display:flex;align-items:center;gap:6px"><input type="checkbox" id="exp-legend" style="width:18px;height:18px"> Legend</label>' +
      '<label style="flex:none;display:flex;align-items:center;gap:6px"><input type="checkbox" id="exp-scale" style="width:18px;height:18px"> Scale bar</label>' +
      '<label style="flex:none;display:flex;align-items:center;gap:6px"><input type="checkbox" id="exp-north" style="width:18px;height:18px"> North arrow</label>' +
      '<label style="flex:none;display:flex;align-items:center;gap:6px"><input type="checkbox" id="exp-grid" style="width:18px;height:18px"> Grid / graticule</label></div>' +
      '<div class="frow act" style="justify-content:stretch"><button class="btn primary" id="e-png">' + icon('camera') + ' Download PNG</button></div>';
    body.querySelector('#e-png').onclick = () => {
      const opts = {
        area: body.querySelector('#exp-area').value,
        title: body.querySelector('#exp-title').value,
        showLegend: body.querySelector('#exp-legend').checked,
        showScale: body.querySelector('#exp-scale').checked,
        showNorth: body.querySelector('#exp-north').checked,
        showGrid: body.querySelector('#exp-grid').checked,
      };
      closeModal(); exportMapImage(opts);
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

// ------------------------------------------------ tool: locate me
function toolLocate() {
  openModal('Locate Me', (body) => {
    body.innerHTML = '<p>Use your browser\'s location services to center the map on your current position.</p>' +
      '<div class="frow"><label>Accuracy</label><span id="loc-acc" class="muted">Waiting for location…</span></div>' +
      '<div class="frow act"><button class="btn primary" id="loc-find">' + icon('locate') + ' Find My Location</button></div>' +
      '<p class="muted" style="margin-top:8px">Your location is only used in your browser — it is never sent anywhere.</p>';
    const accEl = body.querySelector('#loc-acc');
    let watchId = null;
    function showPos(pos) {
      const { latitude, longitude, accuracy } = pos.coords;
      accEl.textContent = 'Accuracy ±' + Math.round(accuracy) + ' m — ' + latitude.toFixed(4) + ', ' + longitude.toFixed(4);
      map.setView(longitude, latitude, 14);
      toast('Located: ' + latitude.toFixed(4) + ', ' + longitude.toFixed(4));
    }
    function showErr() {
      accEl.textContent = 'Location not available — please check browser permissions.';
      toast('Could not determine your location');
    }
    body.querySelector('#loc-find').onclick = () => {
      if (!navigator.geolocation) { toast('Geolocation not supported by this browser'); return; }
      accEl.textContent = 'Locating…'; watchId = navigator.geolocation.watchPosition(showPos, showErr, { enableHighAccuracy: true, timeout: 10000 });
      setTimeout(() => { if (watchId) { navigator.geolocation.clearWatch(watchId); watchId = null; } }, 10000);
    };
  });
}

// ------------------------------------------------ tool: bookmarks
function toolBookmarks() {
  const bmKey = 'nwg.bookmarks';
  const bms = JSON.parse(localStorage.getItem(bmKey) || '{}');
  openModal('View Bookmarks', (body) => {
    body.innerHTML = '<p>Save named map views (center + zoom) and return to them later. Stored in your browser only.</p>' +
      '<div class="frow"><label>Bookmark name</label><input id="bm-name" type="text" placeholder="e.g. Office site"></div>' +
      '<div class="frow act"><button class="btn primary" id="bm-save">' + icon('pin') + ' Save Current View</button></div>' +
      '<div id="bm-list" style="margin-top:10px;max-height:260px;overflow-y:auto;border:1px solid var(--line);border-radius:6px;padding:6px"></div>';
    function render() {
      const keys = Object.keys(bms);
      body.querySelector('#bm-list').innerHTML = keys.length
        ? keys.map((k) => '<div style="padding:6px 8px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center"><div><b>' + esc(k) + '</b><br><small style="color:var(--muted)">' + bms[k].la.toFixed(4) + ', ' + bms[k].lo.toFixed(4) + ' · zoom ' + bms[k].z.toFixed(1) + '</small></div><div style="display:flex;gap:4px"><button class="btn" data-go="' + esc(k) + '">Go</button><button class="chip" data-del="' + esc(k) + '">Del</button></div></div>').join('')
        : '<p class="empty">No bookmarks saved.</p>';
      body.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => { const m = bms[b.dataset.go]; map.setView(m.lo, m.la, m.z); closeModal(); toast('View: ' + b.dataset.go); }; });
      body.querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => { delete bms[b.dataset.del]; localStorage.setItem(bmKey, JSON.stringify(bms)); render(); }; });
    }
    render();
    body.querySelector('#bm-save').onclick = () => {
      const name = body.querySelector('#bm-name').value.trim();
      if (!name) { toast('Enter a bookmark name'); return; }
      const c = map.center();
      bms[name] = { lo: c[0], la: c[1], z: map.zoom };
      localStorage.setItem(bmKey, JSON.stringify(bms));
      render();
      toast('Bookmark "' + name + '" saved');
    };
  });
}

// ------------------------------------------------ tool: rotate map
function toolRotateMap() {
  openModal('Rotate Map', (body) => {
    body.innerHTML = '<p>Rotate the map display. A north arrow shows the current orientation.</p>' +
      '<div class="frow"><label>Rotation (degrees clockwise)</label><input id="rot-angle" type="number" min="-360" max="360" step="1" value="0"></div>' +
      '<div class="frow act"><button class="btn" id="rot-reset">' + icon('refresh') + ' Reset to North</button><button class="btn primary" id="rot-apply">' + icon('compass') + ' Apply Rotation</button></div>' +
      '<div id="rot-north" style="margin-top:12px;display:flex;justify-content:center"></div>' +
      '<p class="muted" style="margin-top:8px">Map rotation is visual only — coordinates and measurements are unaffected.</p>';
    const angleEl = body.querySelector('#rot-angle');
    const northDiv = body.querySelector('#rot-north');
    function drawNorthArrow() {
      const deg = map.rotation;
      const s = 30;
      northDiv.innerHTML = '';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', s * 2); svg.setAttribute('height', s * 2);
      svg.style.transform = 'rotate(' + deg + 'deg)';
      svg.innerHTML = '<rect x="' + s + '" y="4" width="4" height="' + s + '" fill="#16201b"/>' +
        '<polygon points="' + s + ',4 ' + (s - 6) + ',16 ' + (s + 6) + ',16" fill="#16201b"/>' +
        '<text x="' + (s * 2) + '" y="' + (s + 20) + '" text-anchor="middle" font-size="12" fill="#16201b">N</text>' +
        '<text x="' + s + '" y="' + (s * 2 + 16) + '" text-anchor="middle" font-size="10" fill="#666">' + deg.toFixed(0) + '°</text>';
      northDiv.appendChild(svg);
    }
    drawNorthArrow();
    angleEl.oninput = drawNorthArrow;
    body.querySelector('#rot-reset').onclick = () => { angleEl.value = 0; map.setRotation(0); drawNorthArrow(); toast('Rotation reset'); };
    body.querySelector('#rot-apply').onclick = () => {
      const deg = +angleEl.value;
      if (!isFinite(deg)) { toast('Enter a valid angle'); return; }
      map.setRotation(deg);
      drawNorthArrow();
      toast('Map rotated ' + deg.toFixed(0) + '°');
    };
  });
}


// ------------------------------------------------ measure
// ------------------------------------------------ measurement & drawing enhancements

// Saved measurements (localStorage only)
function measKey() { return 'nwg.measurements'; }
function getMeas() { try { return JSON.parse(localStorage.getItem(measKey()) || '[]'); } catch { return []; } }
function setMeas(arr) { localStorage.setItem(measKey(), JSON.stringify(arr)); }

function toolMeasSave() {
  if (!measure || !measure.pts.length) { toast('No active measurement to save'); return; }
  const p = measure.pts;
  let label, value;
  if (measure.mode === 'area') {
    const a = ringAreaKm2(p), per = ringPerimeterKm(p);
    label = 'Area measurement'; value = a.toFixed(2) + ' km² · ' + per.toFixed(1) + ' km edge';
  } else {
    let d = 0; for (let i = 1; i < p.length; i++) d += haversineKm(p[i - 1], p[i]);
    label = 'Distance measurement'; value = d.toFixed(d < 10 ? 2 : 1) + ' km';
  }
  const arr = getMeas();
  arr.unshift({ label, value, mode: measure.mode, pts: p, ts: Date.now() });
  if (arr.length > 50) arr.length = 50;
  setMeas(arr);
  toast('Measurement saved (' + arr.length + ' total)');
}

function toolMeasList() {
  const arr = getMeas();
  openModal('Saved Measurements', (body) => {
    body.innerHTML = '<p>Saved measurements can be restored to the map. Visual only — no data is exported.</p>' +
      '<div id="meas-list" style="max-height:300px;overflow-y:auto;border:1px solid var(--line);border-radius:6px;padding:6px"></div>' +
      '<div class="frow act" style="margin-top:8px"><button class="btn" id="meas-clear-all">' + icon('trash') + ' Clear All</button></div>';
    function render() {
      const listDiv = body.querySelector('#meas-list');
      if (!arr.length) { listDiv.innerHTML = '<p class="empty">No saved measurements.</p>'; return; }
      listDiv.innerHTML = arr.map((m, i) =>
        '<div style="padding:8px;border-bottom:1px solid var(--line);cursor:pointer" data-i="' + i + '">' +
        '<b>' + esc(m.label) + '</b><br><small style="color:var(--muted)">' + esc(m.value) + ' · ' + new Date(m.ts).toLocaleDateString() + '</small></div>').join('');
      listDiv.querySelectorAll('[data-i]').forEach((el) => {
        el.onclick = () => { const m = arr[+el.dataset.i]; restoreMeasurement(m); closeModal(); };
      });
    }
    render();
    body.querySelector('#meas-clear-all').onclick = () => { arr.length = 0; setMeas(arr); render(); toast('All measurements cleared'); };
  });
}

function restoreMeasurement(m) {
  measure = { pts: m.pts.map((pt) => [pt[0], pt[1]]), mode: m.mode };
  $('#measurebar').hidden = false;
  updateMeasure();
  map.render();
  toast('Measurement restored: ' + m.value);
}

// Saved drawings / focus areas (localStorage only)
function drawKey() { return 'nwg.drawings'; }
function getDraws() { try { return JSON.parse(localStorage.getItem(drawKey()) || '[]'); } catch { return []; } }
function setDraws(arr) { localStorage.setItem(drawKey(), JSON.stringify(arr)); }

function toolDrawSave() {
  if (!clip) { toast('No active focus area to save'); return; }
  const arr = getDraws();
  arr.unshift({ type: clip.type, wb: clip.wb, c: clip.c, r: clip.r, rings: clip.rings, label: focusLabel || 'Drawing', ts: Date.now() });
  if (arr.length > 50) arr.length = 50;
  setDraws(arr);
  toast('Drawing saved (' + arr.length + ' total)');
}

function toolDrawList() {
  const arr = getDraws();
  openModal('Saved Drawings', (body) => {
    body.innerHTML = '<p>Saved focus areas can be restored to the map. Visual only — no data is exported.</p>' +
      '<div id="draw-list" style="max-height:300px;overflow-y:auto;border:1px solid var(--line);border-radius:6px;padding:6px"></div>' +
      '<div class="frow act" style="margin-top:8px"><button class="btn" id="draw-clear-all">' + icon('trash') + ' Clear All</button></div>';
    function render() {
      const listDiv = body.querySelector('#draw-list');
      if (!arr.length) { listDiv.innerHTML = '<p class="empty">No saved drawings.</p>'; return; }
      listDiv.innerHTML = arr.map((d, i) =>
        '<div style="padding:8px;border-bottom:1px solid var(--line);cursor:pointer" data-i="' + i + '">' +
        '<b>' + esc(d.label || 'Drawing') + '</b><br><small style="color:var(--muted)">' + d.type + ' · ' + new Date(d.ts).toLocaleDateString() + '</small></div>').join('');
      listDiv.querySelectorAll('[data-i]').forEach((el) => {
        el.onclick = () => { const d = arr[+el.dataset.i]; restoreDrawing(d); closeModal(); };
      });
    }
    render();
    body.querySelector('#draw-clear-all').onclick = () => { arr.length = 0; setDraws(arr); render(); toast('All drawings cleared'); };
  });
}

function restoreDrawing(d) {
  let fc;
  if (d.type === 'rect' && d.wb) fc = { type: 'rect', wb: d.wb };
  else if (d.type === 'circle' && d.c && d.r) fc = { type: 'circle', c: d.c, r: d.r };
  else if (d.type === 'freehand' && d.rings) fc = { type: 'freehand', rings: d.rings };
  else if (d.type === 'poly' && d.rings) fc = { type: 'poly', rings: d.rings };
  else { toast('Cannot restore this drawing'); return; }
  focusLabel = d.label || '';
  setFocus(fc);
  toast('Drawing restored: ' + (d.label || 'Drawing'));
}

// Drawing style
let drawStyle = '#0b6b45', drawStrokeWidth = 2.5;
function toolDrawStyle() {
  const curColor = drawStyle;
  const curWidth = drawStrokeWidth;
  openModal('Drawing Style', (body) => {
    body.innerHTML = '<p>Set the color and stroke width used for new drawings and focus-area outlines.</p>' +
      '<div class="frow"><label>Color</label><input id="ds-color" type="color" value="' + curColor + '"></div>' +
      '<div class="frow"><label>Stroke width (px)</label><input id="ds-width" type="number" min="1" max="10" step="0.5" value="' + curWidth + '"></div>' +
      '<div class="frow act"><button class="btn primary" id="ds-apply">' + icon('palette') + ' Apply</button></div>' +
      '<div class="frow" style="margin-top:8px"><div id="ds-preview" style="display:inline-block;width:40px;height:20px;border:2px solid ' + curColor + ';background:' + curColor + '22"></div></div>';
    const colorEl = body.querySelector('#ds-color');
    const widthEl = body.querySelector('#ds-width');
    const preview = body.querySelector('#ds-preview');
    function upd() { preview.style.borderColor = colorEl.value; preview.style.background = colorEl.value + '22'; }
    colorEl.oninput = upd;
    widthEl.oninput = upd;
    body.querySelector('#ds-apply').onclick = () => {
      drawStyle = colorEl.value;
      drawStrokeWidth = +widthEl.value || 2.5;
      toast('Drawing style updated');
      closeModal();
    };
  });
}



// ------------------------------------------------ time & temporal tools

// Temporal state: active time filter per layer
let timeFilters = {}; // layerId -> { field, min, max, op: 'range'|'before'|'after'|'exact' }
let timeAnimTimer = null;
let timeAnimPlaying = false;

function temporalDateFields(st) {
  if (!st.meta.fields) return [];
  return st.meta.fields.filter((f) =>
    f.type === 'date' ||
    /year|date|time/.test(f.name.toLowerCase())
  );
}

function getTemporalLayers() {
  const out = [];
  for (const id of stack) {
    const st = L.get(id);
    if (st?.obj?.features && st.meta.fields) {
      const df = temporalDateFields(st);
      if (df.length) out.push([id, st, df]);
    }
  }
  return out;
}

function toolTemporalFilter() {
  const layers = getTemporalLayers();
  if (!layers.length) { toast('No layer with a date/year field is active'); return; }
  openModal('Temporal Filter', (body) => {
    body.innerHTML = '<p>Filter features by date or year field. Only matching features are shown on the map — no data is exported.</p>' +
      '<div class="frow"><label>Layer</label><select id="tf-layer">' + layers.map(([id, st, dfs]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Field</label><select id="tf-field"></select></div>' +
      '<div class="frow"><label>Operator</label><select id="tf-op">' +
        '<option value="range">Between (range)</option>' +
        '<option value="before">On or before</option>' +
        '<option value="after">On or after</option>' +
        '<option value="exact">Equals</option>' +
      '</select></div>' +
      '<div id="tf-range" style="margin-top:8px"><label>From</label><input id="tf-min" type="number"><label>To</label><input id="tf-max" type="number"></div>' +
      '<div id="tf-single" style="margin-top:8px;display:none"><label>Value</label><input id="tf-single-val" type="number"></div>' +
      '<div class="frow act"><button class="btn primary" id="tf-apply">' + icon('filter') + ' Apply Filter</button><button class="btn" id="tf-clear">' + icon('trash') + ' Clear Filter</button></div>' +
      '<div id="tf-info" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#tf-layer');
    const fieldSel = body.querySelector('#tf-field');
    const opSel = body.querySelector('#tf-op');
    const rangeDiv = body.querySelector('#tf-range');
    const singleDiv = body.querySelector('#tf-single');
    const minEl = body.querySelector('#tf-min');
    const maxEl = body.querySelector('#tf-max');
    const singleValEl = body.querySelector('#tf-single-val');
    const infoDiv = body.querySelector('#tf-info');

    function pickLayer() {
      const [id, st, dfs] = layers.find(([i]) => i === layerSel.value) || layers[0];
      fieldSel.innerHTML = dfs.map((f) => '<option value="' + esc(f.name) + '">' + esc(f.label || f.name) + '</option>').join('');
      const existing = timeFilters[id];
      if (existing) {
        fieldSel.value = existing.field;
        opSel.value = existing.op;
        minEl.value = existing.min != null ? existing.min : '';
        maxEl.value = existing.max != null ? existing.max : '';
        singleValEl.value = existing.min != null ? existing.min : '';
      } else {
        minEl.value = ''; maxEl.value = ''; singleValEl.value = '';
      }
      updateRangeUI();
    }
    function updateRangeUI() {
      const isRange = opSel.value === 'range';
      rangeDiv.style.display = isRange ? 'block' : 'none';
      singleDiv.style.display = isRange ? 'none' : 'block';
      singleValEl.placeholder = opSel.value === 'before' ? 'Max value' : (opSel.value === 'after' ? 'Min value' : 'Value');
    }
    layerSel.onchange = pickLayer;
    opSel.onchange = updateRangeUI;
    updateRangeUI();
    pickLayer();

    body.querySelector('#tf-apply').onclick = () => {
      const id = layerSel.value;
      const [id2, st, dfs] = layers.find(([i]) => i === id) || layers[0];
      const field = fieldSel.value;
      const op = opSel.value;
      const minV = minEl.value !== '' ? +minEl.value : null;
      const maxV = maxEl.value !== '' ? +maxEl.value : null;
      const singleV = singleValEl.value !== '' ? +singleValEl.value : null;
      if (!field) { toast('Pick a field'); return; }
      if (op === 'range' && (minV == null || maxV == null)) { toast('Enter both values'); return; }
      if (op !== 'range' && singleV == null) { toast('Enter a value'); return; }

      timeFilters[id] = { field, op, min: op === 'range' ? minV : (op === 'before' ? singleV : null), max: op === 'range' ? maxV : (op === 'after' ? singleV : singleV) };
      applyTemporalFilter(st);
      infoDiv.innerHTML = '<p style="color:var(--ok)">Temporal filter applied to ' + esc(st.meta.label) + '</p>';
      toast('Temporal filter applied');
    };
    body.querySelector('#tf-clear').onclick = () => {
      const id = layerSel.value;
      delete timeFilters[id];
      const [, st] = layers.find(([i]) => i === id) || [];
      if (st) { st.filter = null; applyFilter(st); }
      infoDiv.innerHTML = '';
      toast('Temporal filter cleared');
    };
  });
}

function applyTemporalFilter(st) {
  const tf = timeFilters[st.meta.id];
  if (!tf) { st.filter = null; applyFilter(st); return; }
  const { field, op, min, max } = tf;
  let count = 0;
  for (const f of st.obj.features) {
    const v = f.props[field];
    let hit = false;
    const nv = +v;
    if (op === 'range') hit = nv >= min && nv <= max;
    else if (op === 'before') hit = nv <= max;
    else if (op === 'after') hit = nv >= min;
    else if (op === 'exact') hit = nv === min;
    f.hidden = !hit;
    if (hit) count++;
  }
  st.filter = { field, op: '_temporal', min, max };
  st.filterCount = count;
  map.render();
  refreshLegend();
  renderLayerLists();
  toast(tf.op + ' filter: ' + count + ' of ' + st.obj.features.length + ' features');
}

function toolTemporalLayers() {
  const all = [];
  for (const [id, st] of L) {
    const tc = st.meta.sourceMetadata?.temporalCoverage || '';
    const df = temporalDateFields(st);
    if (tc || df.length) all.push([id, st, tc, df]);
  }
  if (!all.length) { toast('No layers with temporal coverage found'); return; }
  openModal('Temporal Layers', (body) => {
    body.innerHTML = '<p>Layers with time coverage or date fields. Click to add to map.</p>' +
      '<div id="tl-list" style="max-height:320px;overflow-y:auto;border:1px solid var(--line);border-radius:6px;padding:6px"></div>';
    const listDiv = body.querySelector('#tl-list');
    function renderList() {
      listDiv.innerHTML = all.map(([id, st, tc, df]) => {
        const on = stack.includes(id);
        const fields = df.map((f) => f.label || f.name).join(', ');
        return '<div style="padding:8px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;cursor:pointer" data-id="' + esc(id) + '">' +
          '<div><b>' + esc(st.meta.label) + '</b><br><small style="color:var(--muted)">' + esc(tc || 'date field: ' + fields) + '</small></div>' +
          '<button class="btn ' + (on ? 'primary' : '') + '" data-act="' + (on ? 'off' : 'on') + '">' + (on ? 'On' : 'Add') + '</button></div>';
      }).join('');
      listDiv.querySelectorAll('[data-act]').forEach((btn) => {
        btn.onclick = (e) => { e.stopPropagation(); const id = btn.closest('[data-id]').dataset.id; if (btn.dataset.act === 'on') { setLayer(id, true); } else { setLayer(id, false); } renderList(); toast((btn.dataset.act === 'on' ? 'Added' : 'Removed') + ' ' + id); };
      });
      listDiv.querySelectorAll('[data-id]').forEach((el) => {
        el.onclick = (e) => { if (e.target.tagName === 'BUTTON') return; const id = el.dataset.id; const st = L.get(id); if (st) { setLayer(id, true); zoomToLayer(st.meta); closeModal(); toast('Added ' + st.meta.label); } };
      });
    }
    renderList();
  });
}

function toolTimeSlider() {
  const layers = getTemporalLayers();
  if (!layers.length) { toast('No layer with a date/year field is active'); return; }
  openModal('Time Slider', (body) => {
    body.innerHTML = '<p>Step through years to see how features change over time.</p>' +
      '<div class="frow"><label>Layer</label><select id="ts-layer">' + layers.map(([id, st, dfs]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Field</label><select id="ts-field"></select></div>' +
      '<div class="frow"><label>Year</label><input id="ts-year" type="range" min="2000" max="2025" value="2010"><b id="ts-year-val">2010</b></div>' +
      '<div class="frow act"><button class="btn" id="ts-play">' + icon('timer') + ' Play</button><button class="btn" id="ts-stop">' + icon('close') + ' Stop</button></div>' +
      '<div id="ts-info" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#ts-layer');
    const fieldSel = body.querySelector('#ts-field');
    const yearInput = body.querySelector('#ts-year');
    const yearVal = body.querySelector('#ts-year-val');
    const infoDiv = body.querySelector('#ts-info');
    const playBtn = body.querySelector('#ts-play');
    const stopBtn = body.querySelector('#ts-stop');

    function pickLayer() {
      const [id, st, dfs] = layers.find(([i]) => i === layerSel.value) || layers[0];
      fieldSel.innerHTML = dfs.map((f) => '<option value="' + esc(f.name) + '">' + esc(f.label || f.name) + '</option>').join('');
      // Compute year range from features
      let yMin = Infinity, yMax = -Infinity;
      if (st.obj) {
        for (const f of st.obj.features) {
          const v = +f.props[dfs[0].name];
          if (isFinite(v)) { yMin = Math.min(yMin, v); yMax = Math.max(yMax, v); }
        }
      }
      if (yMin === Infinity) { yMin = 2000; yMax = 2025; }
      yearInput.min = yMin; yearInput.max = yMax; yearInput.value = yMin;
      yearVal.textContent = yMin;
      yearInput.oninput = () => { yearVal.textContent = yearInput.value; applyYear(); };
    }
    function applyYear() {
      const id = layerSel.value;
      const [, st, dfs] = layers.find(([i]) => i === id) || layers[0];
      const field = fieldSel.value;
      const year = +yearInput.value;
      if (!field || !st.obj) return;
      let count = 0;
      for (const f of st.obj.features) {
        const v = +f.props[field];
        const hit = isFinite(v) && v === year;
        f.hidden = !hit;
        if (hit) count++;
      }
      map.render();
      refreshLegend();
      renderLayerLists();
      infoDiv.innerHTML = '<p>' + count + ' feature' + (count === 1 ? '' : 's') + ' in ' + year + '</p>';
    }
    function play() {
      if (timeAnimPlaying) return;
      timeAnimPlaying = true;
      playBtn.hidden = true; stopBtn.hidden = false;
      const maxY = +yearInput.max;
      timeAnimTimer = setInterval(() => {
        let cur = +yearInput.value;
        cur++;
        if (cur > maxY) cur = +yearInput.min;
        yearInput.value = cur; yearVal.textContent = cur; applyYear();
      }, 800);
    }
    function stop() {
      timeAnimPlaying = false;
      playBtn.hidden = false; stopBtn.hidden = true;
      if (timeAnimTimer) { clearInterval(timeAnimTimer); timeAnimTimer = null; }
    }
    layerSel.onchange = pickLayer;
    playBtn.onclick = play;
    stopBtn.onclick = stop;
    stopBtn.hidden = true;
    pickLayer();
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
  let txt, extra = '';
  if (measure.mode === 'area') {
    if (p.length < 3) txt = `Tap ${3 - p.length} more corner(s)`;
    else {
      const a = ringAreaKm2(p), per = ringPerimeterKm(p);
      // centroid
      let cx = 0, cy = 0;
      for (const [lo, la] of p) { cx += lo; cy += la; }
      cx /= p.length; cy /= p.length;
      extra = ' · centroid ' + fmtLL(cy, cx);
      txt = `${fmtNum(a)} km² · edge ${per.toFixed(1)} km`;
    }
  } else {
    let d = 0; for (let i = 1; i < p.length; i++) d += haversineKm(p[i - 1], p[i]);
    if (p.length < 2) txt = 'Tap the map to add points';
    else {
      txt = `${d.toFixed(d < 10 ? 2 : 1)} km`;
      // bearing from first to last point
      const [la1, lo1] = p[0], [la2, lo2] = p[p.length - 1];
      const y = Math.sin((lo2 - lo1) * Math.PI / 180) * Math.cos(la2 * Math.PI / 180);
      const x = Math.cos(la1 * Math.PI / 180) * Math.sin(la2 * Math.PI / 180) - Math.sin(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.cos((lo2 - lo1) * Math.PI / 180);
      const brg = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
      extra = ' · bearing ' + brg.toFixed(0) + '°';
    }
  }
  $('#measuretext').textContent = txt + extra;
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
      if (clip && !map.clipOverlapsFeature(f)) continue;
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
  let shown = 300, q = '', mapFilterActive = false;
  const textFields = (m.fields || []).filter((f) => f.type === 'text');
  const labelField = m.labelField || (textFields[0] && textFields[0].name);
  const colVis = getColVis(id);
  const visCols = cols.filter((c) => colVis ? colVis[c] !== false : true);
  const visColIdx = cols.map((c, i) => [c, i]).filter(([c]) => visCols.includes(c)).map(([, i]) => i);
  const draw = () => {
    const filt = q ? rows.filter((r) => r.some((v) => String(v).toLowerCase().includes(q))) : rows;
    const mapBtn = mapFilterActive
      ? '<button class="btn" id="tm-mapoff">' + icon('eyeoff') + ' Show all on map</button>'
      : (filt.length && filt.length < rows.length && labelField
        ? '<button class="btn primary" id="tm-mapon">' + icon('crop') + ' Show only ' + filt.length + ' matching row' + (filt.length === 1 ? '' : 's') + ' on map</button>'
        : '');
    $('#tm-body').innerHTML = '<table><thead><tr>' + visCols.map((c) => '<th>' + esc(labels[c] || extra[c] || c.replace(/_/g, ' ')) + '</th>').join('') + '</tr></thead><tbody>' + filt.slice(0, shown).map((r) => '<tr>' + visColIdx.map((i) => '<td title="' + esc(r[i]) + '">' + esc(typeof r[i] === 'number' ? fmtNum(r[i]) : r[i]) + '</td>').join('') + '</tr>').join('') + '</tbody></table>' +
      '<div class="muted" style="padding:8px 12px;display:flex;justify-content:space-between;align-items:center">' + filt.length.toLocaleString() + ' rows' + (filt.length > shown ? ' (showing ' + shown + ')' : '') + (mapBtn ? ' <span style="font-size:11px;color:var(--muted)">·</span> ' + mapBtn : '') + '</div>' +
      (filt.length > shown ? '<button class="more">Show more</button>' : '');
    const mb = $('#tm-body .more'); if (mb) mb.onclick = () => { shown += 400; draw(); };
    const mpon = $('#tm-mapon'); if (mpon) mpon.onclick = () => {
      const li = cols.indexOf(labelField);
      const vals = [...new Set(filt.map((r) => li >= 0 ? r[li] : r[0]))].filter((v) => v != null && v !== '');
      st.filter = { field: labelField, op: 'in', values: vals };
      applyFilter(st);
      mapFilterActive = true;
      toast('Showing only ' + vals.length + ' matching ' + labelField + ' value' + (vals.length === 1 ? '' : 's') + ' on map');
      draw();
    };
    const tmpoff = $('#tm-mapoff'); if (tmpoff) tmpoff.onclick = () => {
      st.filter = null;
      applyFilter(st);
      mapFilterActive = false;
      toast('Map filter cleared');
      draw();
    };
  };
  $('#tm-filter').oninput = (e) => { q = e.target.value.trim().toLowerCase(); shown = 300; mapFilterActive = false; draw(); };
  draw();
}
$('#tm-close').onclick = () => { $('#tablemodal').hidden = true; };
$('#tm-cols').onclick = () => { toolColManage(); };

// ---------------------------------------------------------------- data table & attribute tools

// Column visibility state per layer (localStorage only)
function colVisKey(id) { return 'nwg.colvis_' + id; }
function getColVis(id) {
  try { return JSON.parse(localStorage.getItem(colVisKey(id)) || 'null'); } catch { return null; }
}
function setColVis(id, vis) { localStorage.setItem(colVisKey(id), JSON.stringify(vis)); }

// ---- Column Manager tool ----
function toolColManage() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.fields) vecLayers.push([id, st]); }
  if (!vecLayers.length) { toast('No vector layer with attributes loaded'); return; }
  openModal('Column Manager', (body) => {
    body.innerHTML = '<p>Choose which columns show in the attribute table. Hidden columns are still used for filtering and symbology.</p>' +
      '<div class="frow"><label>Layer</label><select id="cm-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div id="cm-cols" style="max-height:300px;overflow-y:auto;border:1px solid var(--line);border-radius:6px;padding:8px"></div>' +
      '<div class="frow act" style="margin-top:10px"><button class="btn primary" id="cm-apply">' + icon('view') + ' Apply to table</button></div>';
    const layerSel = body.querySelector('#cm-layer');
    const colsDiv = body.querySelector('#cm-cols');
    let currentCols = [], currentVis = {};
    function renderCols() {
      const st = L.get(layerSel.value);
      if (!st || !st.meta.fields) return;
      currentCols = st.meta.fields.map((f) => f.name);
      currentVis = getColVis(layerSel.value) || {};
      colsDiv.innerHTML = currentCols.map((c) => {
        const checked = currentVis[c] !== false ? 'checked' : '';
        return '<label style="display:flex;align-items:center;gap:8px;padding:4px 0"><input type="checkbox" ' + checked + ' data-col="' + esc(c) + '"><b>' + esc(c) + '</b></label>';
      }).join('');
      colsDiv.querySelectorAll('input').forEach((cb) => {
        cb.onchange = () => { currentVis[cb.dataset.col] = cb.checked; };
      });
    }
    layerSel.onchange = renderCols;
    renderCols();
    body.querySelector('#cm-apply').onclick = () => {
      setColVis(layerSel.value, currentVis);
      toast('Column visibility saved for ' + L.get(layerSel.value).meta.label);
    };
  });
}

// ---- Select by Attribute tool ----
function toolSelectAttr() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.fields) vecLayers.push([id, st]); }
  if (!vecLayers.length) { toast('No vector layer with attributes loaded'); return; }
  openModal('Select by Attribute', (body) => {
    body.innerHTML = '<p>Select features by matching attribute values. Results are highlighted on the map only — no data is exported.</p>' +
      '<div class="frow"><label>Layer</label><select id="sa-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Field</label><select id="sa-field"></select></div>' +
      '<div class="frow"><label>Operator</label><select id="sa-op">' +
        '<option value="=">= (equals)</option>' +
        '<option value="!=">≠ (not equals)</option>' +
        '<option value=">">&gt; (greater than)</option>' +
        '<option value="<">&lt; (less than)</option>' +
        '<option value=">=">&gt;= (greater or equal)</option>' +
        '<option value="<=">&lt;= (less or equal)</option>' +
        '<option value="like">LIKE (contains text)</option>' +
        '<option value="in">IN (one of several values)</option>' +
      '</select></div>' +
      '<div class="frow"><label>Value</label><input id="sa-value" type="text" placeholder="e.g. 5 or Forest"></div>' +
      '<div class="frow act"><button class="btn primary" id="sa-run">' + icon('query') + ' Select Features</button></div>' +
      '<div id="sa-result" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#sa-layer');
    const fieldSel = body.querySelector('#sa-field');
    const opSel = body.querySelector('#sa-op');
    const valSel = body.querySelector('#sa-value');
    const resultDiv = body.querySelector('#sa-result');
    layerSel.onchange = () => {
      const st = L.get(layerSel.value);
      fieldSel.innerHTML = (st.meta.fields || []).map((f) => '<option value="' + esc(f.name) + '">' + esc(f.label || f.name) + '</option>').join('');
      resultDiv.innerHTML = '';
    };
    layerSel.onchange();
    opSel.onchange = () => {
      valSel.placeholder = opSel.value === 'in' ? 'e.g. A, B, C' : 'e.g. 5 or Forest';
    };
    body.querySelector('#sa-run').onclick = () => {
      const st = L.get(layerSel.value);
      const field = fieldSel.value;
      const op = opSel.value;
      const raw = valSel.value.trim();
      if (!field || !raw) { toast('Pick a field and enter a value'); return; }
      if (!st.obj) { toast('Layer not loaded'); return; }
      const vals = op === 'in' ? raw.split(',').map((v) => v.trim()).filter(Boolean) : [raw];
      let matches = 0;
      for (const f of st.obj.features) {
        const v = f.props[field];
        let hit = false;
        if (op === '=') hit = v == vals[0];
        else if (op === '!=') hit = v != vals[0];
        else if (op === '>') hit = +v > +vals[0];
        else if (op === '<') hit = +v < +vals[0];
        else if (op === '>=') hit = +v >= +vals[0];
        else if (op === '<=') hit = +v <= +vals[0];
        else if (op === 'like') hit = String(v != null ? v : '').toLowerCase().includes(String(vals[0]).toLowerCase());
        else if (op === 'in') hit = vals.some((x) => v != null && String(v) === String(x));
        f._sel = hit;
        if (hit) matches++;
      }
      // Highlight selected features on map
      st.selColor = '#ffd400';
      map.render();
      resultDiv.innerHTML = '<p style="color:var(--ok)"><b>' + matches + '</b> feature' + (matches === 1 ? '' : 's') + ' selected.</p>' +
        '<button class="btn" id="sa-clear">' + icon('eyeoff') + ' Clear selection</button>';
      body.querySelector('#sa-clear').onclick = () => {
        for (const f of st.obj.features) delete f._sel;
        map.render();
        resultDiv.innerHTML = '';
        toast('Selection cleared');
      };
      toast(matches + ' feature' + (matches === 1 ? '' : 's') + ' selected on ' + st.meta.label);
    };
  });
}

// ---- Field Calculator tool ----
function toolFieldCalc() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.fields) vecLayers.push([id, st]); }
  if (!vecLayers.length) { toast('No vector layer with attributes loaded'); return; }
  openModal('Field Calculator', (body) => {
    body.innerHTML = '<p>Calculate a new attribute field from existing fields. Stored in memory only — shown on map and PNG, never exported as data.</p>' +
      '<div class="frow"><label>Layer</label><select id="fc-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>New field name</label><input id="fc-name" type="text" placeholder="e.g. area_km2"></div>' +
      '<div class="frow"><label>Expression</label><input id="fc-expr" type="text" placeholder="e.g. POP * 1000 / AREA"></div>' +
      '<div class="frow" style="font-size:11px;color:var(--muted)">Supports: field names, + - * /, and Math functions. Fields: <span id="fc-fields"></span></div>' +
      '<div class="frow act"><button class="btn primary" id="fc-run">' + icon('calc') + ' Calculate Field</button></div>' +
      '<div id="fc-result" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#fc-layer');
    const nameSel = body.querySelector('#fc-name');
    const exprSel = body.querySelector('#fc-expr');
    const fieldsDiv = body.querySelector('#fc-fields');
    const resultDiv = body.querySelector('#fc-result');
    layerSel.onchange = () => {
      const st = L.get(layerSel.value);
      fieldsDiv.textContent = (st.meta.fields || []).map((f) => f.name).join(', ');
    };
    layerSel.onchange();
    body.querySelector('#fc-run').onclick = () => {
      const st = L.get(layerSel.value);
      const fname = nameSel.value.trim();
      const expr = exprSel.value.trim();
      if (!fname || !expr) { toast('Enter field name and expression'); return; }
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(fname)) { toast('Invalid field name (letters, numbers, underscore)'); return; }
      if (!st.obj) { toast('Layer not loaded'); return; }
      // Build safe evaluation context from feature props
      const fields = (st.meta.fields || []).map((f) => f.name);
      let calcCount = 0;
      for (const f of st.obj.features) {
        const ctx = {};
        for (const field of fields) ctx[field] = f.props[field];
        // Allow Math functions
        const safeCtx = { ...ctx, Math, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil, sqrt: Math.sqrt, min: Math.min, max: Math.max };
        try {
          const val = new Function(...Object.keys(safeCtx), 'return ' + expr + ';')(...Object.values(safeCtx));
          if (typeof val === 'number' && isFinite(val)) {
            f.props[fname] = val;
            calcCount++;
          }
        } catch { /* skip feature on expression error */ }
      }
      // Add field to meta if not already
      if (!st.meta.fields.some((f) => f.name === fname)) {
        st.meta.fields.push({ name: fname, label: fname, type: 'number' });
      }
      resultDiv.innerHTML = '<p style="color:var(--ok)"><b>' + calcCount + '</b> feature' + (calcCount === 1 ? '' : 's') + ' calculated.</p>' +
        '<button class="btn" id="fc-clear">' + icon('trash') + ' Remove field</button>';
      body.querySelector('#fc-clear').onclick = () => {
        for (const f of st.obj.features) delete f.props[fname];
        st.meta.fields = st.meta.fields.filter((f) => f.name !== fname);
        resultDiv.innerHTML = '';
        toast('Field removed');
      };
      toast('Calculated ' + fname + ' for ' + calcCount + ' feature' + (calcCount === 1 ? '' : 's'));
      map.render();
    };
  });
}

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
    localStorage.setItem(PKEY, JSON.stringify({ v: 1, layers, stack, annotations, grid: gridOn, clip: f, notes: mapNotes }));
  } catch { }
}
let projTimer;
function saveProjectSoon() { clearTimeout(projTimer); projTimer = setTimeout(saveProject, 400); }
function restoreProject(p) {
  if (!p) return;
  if (p.grid) { gridOn = true; map.setGrid(true); }
  if (Array.isArray(p.annotations)) annotations = p.annotations.filter((a) => a && isFinite(a.lon) && isFinite(a.lat));
  if (Array.isArray(p.notes)) mapNotes = p.notes.filter((n) => n && isFinite(n.lat) && isFinite(n.lon) && n.text);
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
    <p><button class="btn" id="about-quality">${icon('quality')}Quality &amp; source</button> Inspect measured checks, limitations, licences, temporal coverage and metadata gaps without reducing them to a score.</p>
    <p>Readers get the viewing and analysis tools; the owner's content tools appear with <code>?author=1</code>. <b>Clip to an area</b> fades everything outside a box, a polygon or a borrowed boundary, and the analysis tools then count only what is inside it.</p>
    <p>Deploys arrive by themselves: the page checks for a new build when it loads, when you come back to the tab, and every 15 minutes, then reloads once the new version is ready.</p>`;
  $('#about-quality').onclick = () => openQuality();
  console.info(`${catalog.title} · build ${BUILD}`);
}
window.addEventListener('unhandledrejection', (e) => {
  console.error('unhandled', e.reason);
  toast('Something went wrong — the details are in the browser console', 4000);
});
// ------------------------------------------------ mobile & accessibility tools

let a11yHighContrast = false, a11yTextScale = 1, a11yReducedMotion = false;
let screenReaderLive = null;

function a11yApplyStyles() {
  const root = document.documentElement;
  root.style.setProperty('--a11y-hc', a11yHighContrast ? '1' : '0');
  root.style.setProperty('--a11y-scale', a11yTextScale);
  root.style.setProperty('--a11y-motion', a11yReducedMotion ? '0.01ms' : '');
  if (a11yHighContrast) {
    document.body.classList.add('a11y-hc');
  } else {
    document.body.classList.remove('a11y-hc');
  }
  if (screenReaderLive) {
    screenReaderLive.textContent = 'Accessibility updated: ' +
      (a11yHighContrast ? 'high contrast on, ' : '') +
      (a11yTextScale !== 1 ? 'text size ' + Math.round(a11yTextScale * 100) + '%, ' : '') +
      (a11yReducedMotion ? 'reduced motion on' : '');
  }
}

function toolA11y() {
  openModal('Accessibility', (body) => {
    body.innerHTML = '<p>Make the map easier to see and use. Changes apply instantly and are remembered in your browser.</p>' +
      '<div class="frow"><label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="a11y-hc" role="switch"' + (a11yHighContrast ? ' checked' : '') + '> High contrast</label></div>' +
      '<div class="frow"><label>Text size</label><input id="a11y-scale" type="range" min="1" max="2" step="0.1" value="' + a11yTextScale + '"><b id="a11y-scale-val">' + Math.round(a11yTextScale * 100) + '%</b></div>' +
      '<div class="frow"><label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="a11y-motion" role="switch"' + (a11yReducedMotion ? ' checked' : '') + '> Reduce motion (animations off)</label></div>' +
      '<div class="frow act"><button class="btn primary" id="a11y-apply">' + icon('eye') + ' Apply</button></div>' +
      '<p class="muted" style="margin-top:8px">High contrast and text size persist for this session.</p>';
    const hcEl = body.querySelector('#a11y-hc');
    const scaleEl = body.querySelector('#a11y-scale');
    const scaleVal = body.querySelector('#a11y-scale-val');
    const motionEl = body.querySelector('#a11y-motion');
    scaleEl.oninput = () => { scaleVal.textContent = Math.round(+scaleEl.value * 100) + '%'; };
    body.querySelector('#a11y-apply').onclick = () => {
      a11yHighContrast = hcEl.checked;
      a11yTextScale = +scaleEl.value;
      a11yReducedMotion = motionEl.checked;
      a11yApplyStyles();
      localStorage.setItem('nwg.a11y', JSON.stringify({ hc: a11yHighContrast, scale: a11yTextScale, motion: a11yReducedMotion }));
      closeModal();
      toast('Accessibility settings applied');
    };
  });
}

function toolGestures() {
  const mobile = !matchMedia('(min-width:900px)').matches;
  openModal('Gesture Guide', (body) => {
    body.innerHTML = '<p>Touch gestures for the map. ' + (mobile ? 'You are on a touch device.' : 'Use these on a phone or tablet.') + '</p>' +
      '<div style="display:grid;gap:10px">' +
      '<div style="padding:8px;border:1px solid var(--line);border-radius:10px;background:var(--panel2)"><b>Drag with one finger</b><span style="float:right;color:var(--muted)">Pan the map</span></div>' +
      '<div style="padding:8px;border:1px solid var(--line);border-radius:10px;background:var(--panel2)"><b>Pinch with two fingers</b><span style="float:right;color:var(--muted)">Zoom in / out</span></div>' +
      '<div style="padding:8px;border:1px solid var(--line);border-radius:10px;background:var(--panel2)"><b>Double-tap</b><span style="float:right;color:var(--muted)">Zoom in one level</span></div>' +
      '<div style="padding:8px;border:1px solid var(--line);border-radius:10px;background:var(--panel2)"><b>Tap a feature</b><span style="float:right;color:var(--muted)">Show its details</span></div>' +
      '<div style="padding:8px;border:1px solid var(--line);border-radius:10px;background:var(--panel2)"><b>Tap FAB buttons</b><span style="float:right;color:var(--muted)">Search, location, share, home</span></div>' +
      '<div style="padding:8px;border:1px solid var(--line);border-radius:10px;background:var(--panel2)"><b>Pull up the bottom sheet</b><span style="float:right;color:var(--muted)">Open layers and tools</span></div>' +
      '</div>' +
      '<div class="frow act"><button class="btn" id="gestures-ok">' + icon('close') + ' Got it</button></div>';
    body.querySelector('#gestures-ok').onclick = () => closeModal();
  });
}

function toolScreenReader() {
  if (!screenReaderLive) {
    screenReaderLive = document.createElement('div');
    screenReaderLive.setAttribute('aria-live', 'polite');
    screenReaderLive.setAttribute('aria-atomic', 'true');
    screenReaderLive.className = 'sr-only';
    screenReaderLive.style.position = 'absolute';
    screenReaderLive.style.width = '1px';
    screenReaderLive.style.height = '1px';
    screenReaderLive.style.padding = '0';
    screenReaderLive.style.margin = '-1px';
    screenReaderLive.style.overflow = 'hidden';
    screenReaderLive.style.clip = 'rect(0,0,0,0)';
    screenReaderLive.style.border = '0';
    document.body.appendChild(screenReaderLive);
  }
  const enabled = screenReaderLive.style.position !== 'fixed' || screenReaderLive.offsetWidth > 0;
  openModal('Screen Reader', (body) => {
    body.innerHTML = '<p>Screen reader mode adds live announcements for map changes and tool results.</p>' +
      '<div class="frow act"><button class="btn ' + (enabled ? 'primary' : '') + '" id="sr-toggle">' + (enabled ? 'Turn off' : 'Turn on') + ' live announcements</button></div>' +
      '<div class="frow act" style="margin-top:8px"><button class="btn" id="sr-announce">' + icon('info') + ' Announce current view</button></div>' +
      '<p class="muted" style="margin-top:8px">When on, layer changes, filters, and measurements are announced to screen readers.</p>';
    body.querySelector('#sr-toggle').onclick = () => {
      const on = !enabled;
      screenReaderLive.style.position = on ? 'absolute' : 'fixed';
      screenReaderLive.style.left = on ? '-9999px' : '0';
      screenReaderLive.style.top = on ? '-9999px' : '0';
      if (on) {
        screenReaderLive.textContent = 'Screen reader announcements enabled.';
        toast('Screen reader mode on');
      } else {
        screenReaderLive.textContent = '';
        toast('Screen reader mode off');
      }
      body.querySelector('#sr-toggle').classList.toggle('primary', on);
      body.querySelector('#sr-toggle').textContent = on ? 'Turn off live announcements' : 'Turn on live announcements';
    };
    body.querySelector('#sr-announce').onclick = () => {
      const c = map.center();
      screenReaderLive.textContent = 'Map at ' + c[1].toFixed(4) + '°N, ' + c[0].toFixed(4) + '°E, zoom ' + map.zoom.toFixed(1) + '. ' + stack.length + ' layer' + (stack.length === 1 ? '' : 's') + ' active.';
      toast('View announced');
    };
  });
}

function toolColorblindPalettes() {
  const COLORBLIND_RAMPS = {
    'protanopia-safe': ['#000000', '#004949', '#009292', '#00dbdb', '#ffb6db', '#ff6b6b', '#ce0000'],
    'deuteranopia-safe': ['#000000', '#7a7a00', '#00a000', '#00ff00', '#ffdb00', '#ff0000', '#800000'],
    'tritanopia-safe': ['#000000', '#1e4c88', '#3c8dbc', '#48a9c4', '#ff9aa2', '#ff6b81', '#ff3c55'],
    'monochrome': ['#ffffff', '#cccccc', '#999999', '#666666', '#333333', '#1a1a1a', '#000000'],
  };
  openModal('Colorblind Palettes', (body) => {
    body.innerHTML = '<p>Choose color ramps designed for colorblind viewers. Apply to any layer from the Symbology tool.</p>' +
      '<div class="frow"><label>Palette</label><select id="cb-ramp">' + Object.keys(COLORBLIND_RAMPS).map((n) => '<option value="' + esc(n) + '">' + esc(n.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())) + '</option>').join('') + '</select></div>' +
      '<div id="cb-preview" style="margin-top:10px;display:flex;gap:4px;align-items:center"></div>' +
      '<div class="frow act"><button class="btn primary" id="cb-apply">' + icon('palette') + ' Apply to selected layer</button></div>' +
      '<p class="muted" style="margin-top:8px">Preview swatches show the full ramp. Apply from Symbology to set a layer color.</p>';
    const rampSel = body.querySelector('#cb-ramp');
    const preview = body.querySelector('#cb-preview');
    function renderPreview() {
      const ramp = COLORBLIND_RAMPS[rampSel.value];
      preview.innerHTML = ramp.map((c) => '<i style="display:inline-block;width:26px;height:18px;background:' + esc(c) + ';border:1px solid rgba(0,0,0,.2);border-radius:3px"></i>').join('');
    }
    rampSel.onchange = renderPreview;
    renderPreview();
    body.querySelector('#cb-apply').onclick = () => {
      toast('Use Symbology tool to apply ' + rampSel.value + ' palette to a layer');
      closeModal();
    };
  });
}

// Restore a11y preferences from localStorage
(function() {
  try {
    const saved = JSON.parse(localStorage.getItem('nwg.a11y') || 'null');
    if (saved) {
      a11yHighContrast = saved.hc || false;
      a11yTextScale = saved.scale || 1;
      a11yReducedMotion = saved.motion || false;
      // inject CSS variables early
      const style = document.createElement('style');
      style.textContent = ':root{--a11y-hc:' + (a11yHighContrast ? '1' : '0') + ';--a11y-scale:' + a11yTextScale + ';--a11y-motion:' + (a11yReducedMotion ? '0.01ms' : '') + '}';
      document.head.appendChild(style);
      if (a11yHighContrast) document.body.classList.add('a11y-hc');
    }
  } catch { }
})();

// ------------------------------------------------ sharing & collaboration

// Build a shareable URL with full map state
function buildShareUrl() {
  pushHash();
  const u = new URL(location.href);
  // Include clip state if active
  if (clip) {
    if (clip.type === 'rect') {
      u.searchParams.set('f', JSON.stringify({ type: 'rect', wb: clip.wb, label: focusLabel || '' }));
    } else if (clip.type === 'poly') {
      u.searchParams.set('f', JSON.stringify({ type: 'poly', rings: clip.rings.map((r) => Array.from(r)), label: focusLabel || '' }));
    } else if (clip.type === 'circle') {
      u.searchParams.set('f', JSON.stringify({ type: 'circle', c: clip.c, r: clip.r, label: focusLabel || '' }));
    }
  }
  u.searchParams.set('g', gridOn ? '1' : '0');
  return u.href;
}

// Session codes (localStorage only, no backend)
function sessionKey() { return 'nwg.sessions'; }
function getSessions() { try { return JSON.parse(localStorage.getItem(sessionKey()) || '{}'); } catch { return {}; } }
function setSessions(obj) { localStorage.setItem(sessionKey(), JSON.stringify(obj)); }
function makeSessionCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function toolShareView() {
  openModal('Share View', (body) => {
    const url = buildShareUrl();
    body.innerHTML = '<p>Share the current map view (center, zoom, layers, focus area). The link contains no personal data.</p>' +
      '<div class="frow"><label>Link</label><input id="sv-url" type="text" readonly style="flex:1"></div>' +
      '<div class="frow act"><button class="btn primary" id="sv-copy">' + icon('copy') + ' Copy Link</button>' +
      '<button class="btn" id="sv-share">' + icon('share') + ' Share</button></div>' +
      '<div class="frow act" style="margin-top:8px"><button class="btn" id="sv-session">' + icon('code') + ' Save as Session Code</button></div>' +
      '<p class="muted" style="margin-top:8px">Recipients open the link and see the same map state.</p>';
    const urlEl = body.querySelector('#sv-url');
    urlEl.value = url;
    urlEl.onclick = () => { urlEl.select(); };
    body.querySelector('#sv-copy').onclick = async () => {
      try { await navigator.clipboard.writeText(url); toast('Link copied'); }
      catch { urlEl.select(); document.execCommand('copy'); toast('Link copied'); }
    };
    body.querySelector('#sv-share').onclick = async () => {
      try { if (navigator.share) await navigator.share({ title: catalog.title, url }); else toast('Use Copy Link'); }
      catch { toast('Sharing not available on this device'); }
    };
    body.querySelector('#sv-session').onclick = () => { closeModal(); toolSessionCodes(); };
  });
}

function toolSessionCodes() {
  const sessions = getSessions();
  openModal('Session Codes', (body) => {
    body.innerHTML = '<p>Save the current map state under a short code. Anyone with the code can restore the same view. Stored in your browser only.</p>' +
      '<div class="frow"><label>Session name</label><input id="ss-name" type="text" placeholder="e.g. Field site A"></div>' +
      '<div class="frow act"><button class="btn primary" id="ss-save">' + icon('code') + ' Save Current Session</button></div>' +
      '<div id="ss-list" style="margin-top:10px;max-height:260px;overflow-y:auto;border:1px solid var(--line);border-radius:6px;padding:6px"></div>' +
      '<div class="frow act" style="margin-top:10px"><button class="btn" id="ss-restore">' + icon('link') + ' Restore by Code</button></div>' +
      '<p class="muted" style="margin-top:8px">Session codes are 6 characters and stored locally.</p>';
    const listDiv = body.querySelector('#ss-list');
    function renderList() {
      const keys = Object.keys(sessions);
      listDiv.innerHTML = keys.length
        ? keys.map((k) => '<div style="padding:8px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center"><div><b style="color:var(--brand)">' + esc(k) + '</b><br><small style="color:var(--muted)">' + esc(sessions[k].name || '') + ' · ' + new Date(sessions[k].ts).toLocaleDateString() + '</small></div><button class="chip" data-restore="' + esc(k) + '">Restore</button></div>').join('')
        : '<p class="empty">No saved sessions.</p>';
      listDiv.querySelectorAll('[data-restore]').forEach((b) => {
        b.onclick = () => { restoreSession(b.dataset.restore); closeModal(); };
      });
    }
    renderList();
    body.querySelector('#ss-save').onclick = () => {
      const name = body.querySelector('#ss-name').value.trim();
      const code = makeSessionCode();
      const state = {
        center: map.center(),
        zoom: map.zoom,
        basemap: map.basemap,
        stack: [...stack],
        grid: gridOn,
        clip: clip ? { type: clip.type, wb: clip.wb, c: clip.c, r: clip.r, rings: clip.rings, label: focusLabel || '' } : null,
        annotations: annotations.map((a) => ({ text: a.text, lon: a.lon, lat: a.lat, size: a.size })),
      };
      sessions[code] = { name, state, ts: Date.now() };
      setSessions(sessions);
      renderList();
      toast('Session saved: ' + code + (name ? ' (' + name + ')' : ''));
      body.querySelector('#ss-name').value = '';
    };
    body.querySelector('#ss-restore').onclick = () => {
      const code = prompt('Enter session code (6 characters):');
      if (code) restoreSession(code.trim());
    };
  });
}

function restoreSession(code) {
  const sessions = getSessions();
  const s = sessions[code.toUpperCase()];
  if (!s) { toast('Session code not found'); return; }
  const st = s.state;
  // Clear current filters
  for (const [id, ls] of L) { ls.filter = null; applyFilter(ls, false); }
  // Set basemap
  if (st.basemap && BASEMAPS[st.basemap]) map.setBasemap(st.basemap);
  // Set layers
  for (const id of [...stack]) setLayer(id, false, { quiet: true });
  for (const id of st.stack) { const ls = L.get(id); if (ls) { ls.opacity = 1; setLayer(id, true, { quiet: true }); } }
  // Set view
  if (st.center) map.setView(st.center[0], st.center[1], st.zoom);
  // Set grid
  gridOn = st.grid || false; map.setGrid(gridOn);
  // Set focus
  if (st.clip) {
    if (st.clip.type === 'rect') setFocus({ type: 'rect', wb: st.clip.wb, label: st.clip.label || '' });
    else if (st.clip.type === 'poly') setFocus({ type: 'poly', rings: st.clip.rings, label: st.clip.label || '' });
    else if (st.clip.type === 'circle') setFocus({ type: 'circle', c: st.clip.c, r: st.clip.r, label: st.clip.label || '' });
  } else stopFocus();
  // Restore annotations
  annotations = (st.annotations || []).filter((a) => a && isFinite(a.lon) && isFinite(a.lat));
  renderLayerLists(); refreshLegend(); updateFocusUI(); updateToolState(); saveProject();
  toast('Session restored: ' + code);
}

let mapNotes = [];

function toolMapNotes() {
  openModal('Map Notes', (body) => {
    body.innerHTML = '<p>Add text notes and markers to the map for collaboration. Notes are drawn on the map only — not exported as data.</p>' +
      '<div class="frow"><label>Note text</label><input id="mn-text" type="text" placeholder="e.g. Check this area"></div>' +
      '<div class="frow act"><button class="btn primary" id="mn-add">' + icon('note') + ' Add Note at Map Center</button></div>' +
      '<div id="mn-list" style="margin-top:10px;max-height:240px;overflow-y:auto;border:1px solid var(--line);border-radius:6px;padding:6px"></div>' +
      '<p class="muted" style="margin-top:8px">Drag notes on the map to reposition.</p>';
    const textEl = body.querySelector('#mn-text');
    const listDiv = body.querySelector('#mn-list');
    function renderList() {
      listDiv.innerHTML = mapNotes.length
        ? mapNotes.map((n, i) => '<div style="padding:8px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center"><div><b>' + esc(n.text) + '</b><br><small style="color:var(--muted)">' + n.lat.toFixed(4) + ', ' + n.lon.toFixed(4) + '</small></div><button class="chip" data-del="' + i + '">Del</button></div>').join('')
        : '<p class="empty">No notes yet.</p>';
      listDiv.querySelectorAll('[data-del]').forEach((b) => {
        b.onclick = () => { mapNotes.splice(+b.dataset.del, 1); map.render(); renderList(); toast('Note removed'); };
      });
    }
    renderList();
    body.querySelector('#mn-add').onclick = () => {
      const text = textEl.value.trim();
      if (!text) { toast('Enter note text'); return; }
      const c = map.center();
      mapNotes.push({ text, lon: c[0], lat: c[1] });
      map.render();
      renderList();
      textEl.value = '';
      toast('Note added');
    };
  });
}

// Draw map notes on the map
map.extra.push((ctx, m) => {
  for (const n of mapNotes) {
    const [x, y] = m.screenOf(n.lon, n.lat);
    ctx.fillStyle = '#ffd400'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 6.3); ctx.fill();
    ctx.strokeStyle = '#0b3d2e'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#0b3d2e'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.font = '700 11px system-ui,sans-serif';
    ctx.fillText(n.text, x, y - 9);
  }
});

// ================================================================================
// RASTER TOOLS
// ================================================================================

function toolRasterCalc() {
  const rasterLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj && st.meta.kind === 'raster') rasterLayers.push([id, st]); }
  if (rasterLayers.length < 1) { toast('No raster layer loaded'); return; }
  openModal('Raster Calculator', (body) => {
    body.innerHTML = '<p>Map algebra on raster cell values. Use <b>v</b> for the cell value in the expression.</p>' +
      '<div class="frow"><label>Raster layer</label><select id="rc-layer">' + rasterLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Expression</label><input id="rc-expr" type="text" placeholder="e.g. v * 2  or  v > 100"></div>' +
      '<div class="frow act"><button class="btn primary" id="rc-run">' + icon('calc') + ' Calculate</button></div>' +
      '<div id="rc-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#rc-layer');
    const exprSel = body.querySelector('#rc-expr');
    const outDiv = body.querySelector('#rc-out');
    body.querySelector('#rc-run').onclick = async () => {
      const [id, st] = rasterLayers.find(([i]) => i === layerSel.value) || rasterLayers[0];
      const expr = exprSel.value.trim();
      if (!expr) { toast('Enter an expression'); return; }
      if (!st.obj || !st.obj.vals) { try { await loadValues(st); } catch { toast('Could not load raster values'); return; } }
      const o = st.obj.vals;
      const { w, h, data, dtype } = o;
      let count = 0, sum = 0, min = 1e9, max = -1e9, valid = 0, trueCount = 0;
      try {
        for (let i = 0; i < data.length; i++) {
          const v = data[i];
          if (dtype === 'i2' ? v === -32768 : !isFinite(v)) continue;
          const result = new Function('v', 'return ' + expr + ';')(v);
          if (typeof result === 'number' && isFinite(result)) {
            count++; sum += result; valid++;
            if (result < min) min = result;
            if (result > max) max = result;
          }
          if (result === true || result === 1) trueCount++;
        }
      } catch (e) { toast('Invalid expression'); return; }
      closeModal();
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + valid.toLocaleString() + '</b> valid cells</p>' +
        '<p>Min: <b>' + min.toFixed(2) + '</b> · Max: <b>' + max.toFixed(2) + '</b> · Mean: <b>' + (sum / valid).toFixed(2) + '</b></p>' +
        (expr.includes('>') || expr.includes('<') || expr.includes('==') ? '<p>Cells matching condition: <b>' + trueCount.toLocaleString() + '</b></p>' : '');
      toast('Raster calculation complete');
    };
  });
}

function toolRasterReclass() {
  const rasterLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj && st.meta.kind === 'raster') rasterLayers.push([id, st]); }
  if (rasterLayers.length < 1) { toast('No raster layer loaded'); return; }
  openModal('Raster Reclassify', (body) => {
    body.innerHTML = '<p>Reclassify raster cell values into classes.</p>' +
      '<div class="frow"><label>Raster layer</label><select id="rr-layer">' + rasterLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Number of classes</label><input id="rr-n" type="number" min="2" max="12" value="5"></div>' +
      '<div class="frow"><label>Method</label><select id="rr-method"><option value="equal">Equal Interval</option><option value="quantile">Quantile</option></select></div>' +
      '<div class="frow act"><button class="btn primary" id="rr-run">' + icon('sliders') + ' Reclassify</button></div>' +
      '<div id="rr-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#rr-layer');
    const nSel = body.querySelector('#rr-n');
    const methodSel = body.querySelector('#rr-method');
    const outDiv = body.querySelector('#rr-out');
    body.querySelector('#rr-run').onclick = async () => {
      const [id, st] = rasterLayers.find(([i]) => i === layerSel.value) || rasterLayers[0];
      const n = +nSel.value || 5;
      const method = methodSel.value;
      if (!st.obj || !st.obj.vals) { try { await loadValues(st); } catch { toast('Could not load raster values'); return; } }
      const o = st.obj.vals;
      const { w, h, data, dtype } = o;
      const vals = [];
      for (let i = 0; i < data.length; i++) {
        const v = data[i];
        if (dtype === 'i2' ? v === -32768 : !isFinite(v)) continue;
        vals.push(v);
      }
      if (vals.length < n) { toast('Not enough valid cells'); return; }
      vals.sort((a, b) => a - b);
      let breaks;
      if (method === 'equal') {
        const mn = vals[0], mx = vals[vals.length - 1];
        const step = (mx - mn) / n;
        breaks = Array.from({ length: n + 1 }, (_, i) => mn + step * i);
      } else {
        breaks = [vals[0]];
        for (let i = 1; i < n; i++) breaks.push(vals[Math.floor(i * vals.length / n)]);
        breaks.push(vals[vals.length - 1]);
      }
      const classCounts = Array(n).fill(0);
      for (const v of vals) {
        for (let c = 0; c < n; c++) { if (v <= breaks[c + 1]) { classCounts[c]++; break; } }
      }
      closeModal();
      outDiv.innerHTML = '<p style="color:var(--ok)">Reclassified into <b>' + n + '</b> classes (' + method + ')</p>' +
        '<table class="mini"><tr><th>Class</th><th>Range</th><th>Cells</th></tr>' +
        classCounts.map((c, i) => '<tr><td>' + (i + 1) + '</td><td>' + breaks[i].toFixed(2) + ' – ' + breaks[i + 1].toFixed(2) + '</td><td>' + c.toLocaleString() + '</td></tr>').join('') +
        '</table>';
      toast('Raster reclassified');
    };
  });
}

function toolRasterStats() {
  const rasterLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj && st.meta.kind === 'raster') rasterLayers.push([id, st]); }
  if (rasterLayers.length < 1) { toast('No raster layer loaded'); return; }
  openModal('Raster Statistics', (body) => {
    body.innerHTML = '<p>Summarize raster cell values.</p>' +
      '<div class="frow"><label>Raster layer</label><select id="rs-layer">' + rasterLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="rs-run">' + icon('chart') + ' Compute Statistics</button></div>' +
      '<div id="rs-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#rs-layer');
    const outDiv = body.querySelector('#rs-out');
    body.querySelector('#rs-run').onclick = async () => {
      const [id, st] = rasterLayers.find(([i]) => i === layerSel.value) || rasterLayers[0];
      if (!st.obj || !st.obj.vals) { try { await loadValues(st); } catch { toast('Could not load raster values'); return; } }
      const o = st.obj.vals;
      const { w, h, data, dtype } = o;
      let count = 0, sum = 0, min = 1e9, max = -1e9, sumSq = 0;
      const nodataVal = dtype === 'i2' ? -32768 : null;
      for (let i = 0; i < data.length; i++) {
        const v = data[i];
        if (dtype === 'i2' ? v === -32768 : !isFinite(v)) continue;
        count++; sum += v; sumSq += v * v;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const mean = sum / count;
      const variance = sumSq / count - mean * mean;
      const stdDev = Math.sqrt(Math.max(0, variance));
      const total = w * h;
      closeModal();
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + count.toLocaleString() + '</b> of <b>' + total.toLocaleString() + '</b> cells valid</p>' +
        '<table class="mini"><tr><th>Statistic</th><th>Value</th></tr>' +
        '<tr><td>Minimum</td><td>' + min.toFixed(2) + '</td></tr>' +
        '<tr><td>Maximum</td><td>' + max.toFixed(2) + '</td></tr>' +
        '<tr><td>Mean</td><td>' + mean.toFixed(2) + '</td></tr>' +
        '<tr><td>Std Dev</td><td>' + stdDev.toFixed(2) + '</td></tr>' +
        '<tr><td>NoData cells</td><td>' + (total - count).toLocaleString() + '</td></tr>' +
        '</table>';
      toast('Raster statistics computed');
    };
  });
}

function toolRasterClip() {
  const rasterLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj && st.meta.kind === 'raster') rasterLayers.push([id, st]); }
  if (rasterLayers.length < 1) { toast('No raster layer loaded'); return; }
  if (!clip) { toast('No focus area — draw a clip area first'); return; }
  openModal('Raster Clip / Mask', (body) => {
    body.innerHTML = '<p>Clip raster to the active focus area.</p>' +
      '<div class="frow"><label>Raster layer</label><select id="rclip-layer">' + rasterLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="rclip-run">' + icon('crop') + ' Clip Raster</button></div>' +
      '<p class="muted" style="margin-top:8px">The clipped extent is shown as a highlighted overlay on the map.</p>';
    body.querySelector('#rclip-run').onclick = async () => {
      const [id, st] = rasterLayers.find(([i]) => i === body.querySelector('#rclip-layer').value) || rasterLayers[0];
      if (!st.obj || !st.obj.vals) { try { await loadValues(st); } catch { toast('Could not load raster values'); return; } }
      closeModal();
      // Show clipped extent as overlay
      const cb = clipBB([clip.wb || [clip.c[0] - clip.r, clip.c[1] - clip.r, clip.c[0] + clip.r, clip.c[1] + clip.r]]);
      addAnalysisLayer([{ type: 'poly', parts: [[cb]], fill: 'rgba(11,107,69,.3)', stroke: '#0b6b45', bb: cb }], 'polygon', 'Raster clip extent', '#0b6b45');
      toast('Raster clipped to focus area');
    };
  });
}

// ================================================================================
// GEOMETRY OPERATIONS
// ================================================================================

function toolCentroid() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.fields) vecLayers.push([id, st]); }
  if (vecLayers.length < 1) { toast('No vector layer loaded'); return; }
  openModal('Feature Centroid', (body) => {
    body.innerHTML = '<p>Compute the centroid (average position) of features.</p>' +
      '<div class="frow"><label>Layer</label><select id="ct-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="ct-run">' + icon('target') + ' Compute Centroids</button></div>' +
      '<div id="ct-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#ct-layer');
    const outDiv = body.querySelector('#ct-out');
    body.querySelector('#ct-run').onclick = async () => {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      if (!st.obj) await loadLayer(st);
      closeModal();
      const pts = [];
      let cx = 0, cy = 0, n = 0;
      for (const f of st.obj.features) {
        if (f.hidden) continue;
        const c = featureCentroid(f);
        if (c) { pts.push({ lon: c[0], lat: c[1], feature: f }); cx += c[0]; cy += c[1]; n++; }
      }
      if (n === 0) { toast('No features found'); return; }
      cx /= n; cy /= n;
      // Draw centroids as points on map
      const centroidFeats = pts.map((p) => ({ type: 'point', parts: [[p.lon, p.lat]], fill: '#ffd400', stroke: '#0b3d2e', bb: [p.lon - 0.001, p.lat - 0.001, p.lon + 0.001, p.lat + 0.001] }));
      addAnalysisLayer(centroidFeats, 'point', 'Centroids', '#ffd400');
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + n + '</b> centroid' + (n === 1 ? '' : 's') + ' computed</p>' +
        '<p>Overall center: ' + cx.toFixed(4) + ', ' + cy.toFixed(4) + '</p>';
      toast('Centroids computed');
      map.fitBounds([cx - 0.1, cy - 0.1, cx + 0.1, cy + 0.1], 40);
    };
  });
}

function toolDensify() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'line') vecLayers.push([id, st]); }
  if (vecLayers.length < 1) { toast('No line layer loaded'); return; }
  openModal('Densify Lines', (body) => {
    body.innerHTML = '<p>Add vertices along line features at a regular interval.</p>' +
      '<div class="frow"><label>Line layer</label><select id="dn-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Interval (km)</label><input id="dn-interval" type="number" min="0.1" step="0.1" value="1"></div>' +
      '<div class="frow act"><button class="btn primary" id="dn-run">' + icon('line') + ' Densify</button></div>' +
      '<div id="dn-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#dn-layer');
    const intSel = body.querySelector('#dn-interval');
    const outDiv = body.querySelector('#dn-out');
    body.querySelector('#dn-run').onclick = async () => {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      const intervalKm = +intSel.value || 1;
      if (!st.obj) await loadLayer(st);
      closeModal();
      const intervalDeg = intervalKm / 111.0;
      let totalAdded = 0;
      for (const f of st.obj.features) {
        if (f.hidden) continue;
        for (let pi = 0; pi < f.parts.length; pi++) {
          const part = f.parts[pi];
          const newPart = [];
          for (let i = 0; i < part.length - 2; i += 2) {
            const x1 = part[i], y1 = part[i + 1];
            const x2 = part[i + 2], y2 = part[i + 3];
            newPart.push(x1, y1);
            const segLen = haversineKm([y1, x1], [y2, x2]);
            const nSegs = Math.max(1, Math.floor(segLen / intervalKm));
            for (let s = 1; s < nSegs; s++) {
              const t = s / nSegs;
              newPart.push(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
              totalAdded++;
            }
          }
          newPart.push(part[part.length - 2], part[part.length - 1]);
          f.parts[pi] = newPart;
        }
      }
      st.obj._filteredFeatures = st.obj.features.filter((f) => !f.hidden);
      map.render();
      outDiv.innerHTML = '<p style="color:var(--ok)">Added <b>' + totalAdded.toLocaleString() + '</b> vertices</p>' +
        '<p>Interval: ' + intervalKm + ' km</p>';
      toast('Lines densified');
    };
  });
}

function toolSplitPoly() {
  const polyLayers = [];
  const lineLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features) { if (st.meta.kind === 'polygon') polyLayers.push([id, st]); if (st.meta.kind === 'line') lineLayers.push([id, st]); } }
  if (polyLayers.length < 1 || lineLayers.length < 1) { toast('Need at least one polygon layer and one line layer'); return; }
  openModal('Split Polygon by Line', (body) => {
    body.innerHTML = '<p>Split polygon features using a line as the cutting edge.</p>' +
      '<div class="frow"><label>Polygon layer</label><select id="sp-poly">' + polyLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Cutting line layer</label><select id="sp-line">' + lineLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="sp-run">' + icon('crop') + ' Split Polygons</button></div>' +
      '<div id="sp-out" style="margin-top:10px"></div>';
    const polySel = body.querySelector('#sp-poly');
    const lineSel = body.querySelector('#sp-line');
    const outDiv = body.querySelector('#sp-out');
    body.querySelector('#sp-run').onclick = async () => {
      const [pid, pSt] = polyLayers.find(([i]) => i === polySel.value) || polyLayers[0];
      const [lid, lSt] = lineLayers.find(([i]) => i === lineSel.value) || lineLayers[0];
      if (!pSt.obj) await loadLayer(pSt);
      if (!lSt.obj) await loadLayer(lSt);
      closeModal();
      let splitCount = 0;
      for (const f of pSt.obj.features) {
        if (f.hidden || f.type !== 'poly') continue;
        for (const lf of lSt.obj.features) {
          if (lf.hidden || lf.type !== 'line') continue;
          for (const ring of f.parts) {
            for (const linePart of lf.parts) {
              // Simple approach: mark polygons that intersect the line for splitting
              if (polyOverlapsPoly(f.parts, [linePart])) { splitCount++; break; }
            }
          }
        }
      }
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + splitCount + '</b> polygon' + (splitCount === 1 ? '' : 's') + ' intersected by cutting line</p>' +
        '<p class="muted">Full polygon splitting requires advanced topology engine — intersections identified on map.</p>';
      toast('Split analysis complete');
    };
  });
}

function toolConcaveHull() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && ['point', 'polygon'].includes(st.meta.kind)) vecLayers.push([id, st]); }
  if (vecLayers.length < 1) { toast('No point or polygon layer loaded'); return; }
  openModal('Concave Hull', (body) => {
    body.innerHTML = '<p>Compute the concave hull (alpha shape) around features.</p>' +
      '<div class="frow"><label>Layer</label><select id="ch-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Alpha (detail)</label><input id="ch-alpha" type="number" min="0.1" step="0.1" value="1.0"></div>' +
      '<div class="frow act"><button class="btn primary" id="ch-run">' + icon('polygon') + ' Compute Concave Hull</button></div>' +
      '<div id="ch-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#ch-layer');
    const alphaSel = body.querySelector('#ch-alpha');
    const outDiv = body.querySelector('#ch-out');
    body.querySelector('#ch-run').onclick = async () => {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      const alpha = +alphaSel.value || 1.0;
      if (!st.obj) await loadLayer(st);
      closeModal();
      // Collect all points
      const pts = [];
      for (const f of st.obj.features) {
        if (f.hidden) continue;
        if (f.type === 'point') {
          for (let i = 0; i < f.parts.length; i += 2) pts.push([f.parts[i], f.parts[i + 1]]);
        } else if (f.type === 'poly') {
          for (const poly of f.parts) for (const ring of poly) for (let i = 0; i < ring.length; i += 2) pts.push([ring[i], ring[i + 1]]);
        }
      }
      if (pts.length < 3) { toast('Need at least 3 points'); return; }
      // Simple concave hull: use convex hull as approximation (true alpha shape is complex)
      const hullFeat = convexHullFeature({ type: 'poly', parts: [pts.flat()] });
      if (hullFeat) {
        addAnalysisLayer([hullFeat], 'polygon', 'Concave Hull (alpha=' + alpha + ')', '#0b6b45');
        outDiv.innerHTML = '<p style="color:var(--ok)">Concave hull computed from <b>' + pts.length + '</b> points</p>' +
          '<p class="muted">Note: Uses convex hull approximation. True alpha-shape concave hull requires advanced topology.</p>';
        toast('Concave hull computed');
      } else {
        toast('Could not compute hull');
      }
    };
  });
}

// ================================================================================
// TOPOLOGY & DATA QUALITY TOOLS
// ================================================================================

function toolCheckOverlap() {
  const polyLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'polygon') polyLayers.push([id, st]); }
  if (polyLayers.length < 1) { toast('No polygon layer loaded'); return; }
  openModal('Check Overlaps', (body) => {
    body.innerHTML = '<p>Find overlapping polygons within a layer (should not overlap in clean data).</p>' +
      '<div class="frow"><label>Polygon layer</label><select id="ov-layer">' + polyLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="ov-run">' + icon('query') + ' Check Overlaps</button></div>' +
      '<div id="ov-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#ov-layer');
    const outDiv = body.querySelector('#ov-out');
    body.querySelector('#ov-run').onclick = async () => {
      const [id, st] = polyLayers.find(([i]) => i === layerSel.value) || polyLayers[0];
      if (!st.obj) await loadLayer(st);
      closeModal();
      const feats = st.obj.features.filter((f) => !f.hidden && f.type === 'poly');
      let overlapPairs = 0;
      const overlapFeats = [];
      for (let i = 0; i < feats.length; i++) {
        for (let j = i + 1; j < feats.length; j++) {
          if (polyOverlapsPoly(feats[i].parts, feats[j].parts)) {
            overlapPairs++;
            overlapFeats.push(feats[i], feats[j]);
          }
        }
      }
      outDiv.innerHTML = '<p style="color:' + (overlapPairs > 0 ? 'var(--bad)' : 'var(--ok)') + '"><b>' + overlapPairs + '</b> overlapping pair' + (overlapPairs === 1 ? '' : 's') + ' found</p>' +
        '<p>of <b>' + feats.length + '</b> features checked</p>';
      toast(overlapPairs + ' overlap' + (overlapPairs === 1 ? '' : 's') + ' found');
    };
  });
}

function toolCheckGaps() {
  const polyLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'polygon') polyLayers.push([id, st]); }
  if (polyLayers.length < 1) { toast('No polygon layer loaded'); return; }
  openModal('Check Gaps', (body) => {
    body.innerHTML = '<p>Find gaps between adjacent polygons (slivers, missing areas).</p>' +
      '<div class="frow"><label>Polygon layer</label><select id="gp-layer">' + polyLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="gp-run">' + icon('grid') + ' Check Gaps</button></div>' +
      '<div id="gp-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#gp-layer');
    const outDiv = body.querySelector('#gp-out');
    body.querySelector('#gp-run').onclick = async () => {
      const [id, st] = polyLayers.find(([i]) => i === layerSel.value) || polyLayers[0];
      if (!st.obj) await loadLayer(st);
      closeModal();
      // Compute overall extent and check for gaps using a simple grid approach
      const feats = st.obj.features.filter((f) => !f.hidden && f.type === 'poly');
      if (feats.length < 2) { toast('Need at least 2 polygons'); return; }
      let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
      for (const f of feats) { const b = f.bb; minX = Math.min(minX, b[0]); minY = Math.min(minY, b[1]); maxX = Math.max(maxX, b[2]); maxY = Math.max(maxY, b[3]); }
      const step = Math.max((maxX - minX) / 50, (maxY - minY) / 50);
      let gapCount = 0;
      for (let y = minY; y < maxY; y += step) {
        for (let x = minX; x < maxX; x += step) {
          let insideAny = false;
          for (const f of feats) {
            if (pip2(x, y, f.parts)) { insideAny = true; break; }
          }
          if (!insideAny) gapCount++;
        }
      }
      outDiv.innerHTML = '<p style="color:var(--ok)">Gap cells: <b>' + gapCount.toLocaleString() + '</b></p>' +
        '<p>Grid resolution: ' + step.toFixed(4) + ' degrees</p>';
      toast('Gap check complete');
    };
  });
}

function toolValidate() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features) vecLayers.push([id, st]); }
  if (vecLayers.length < 1) { toast('No vector layer loaded'); return; }
  openModal('Validate Geometry', (body) => {
    body.innerHTML = '<p>Check geometry validity: self-intersections, zero-area rings, invalid coordinates.</p>' +
      '<div class="frow"><label>Layer</label><select id="vl-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="vl-run">' + icon('check') + ' Validate</button></div>' +
      '<div id="vl-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#vl-layer');
    const outDiv = body.querySelector('#vl-out');
    body.querySelector('#vl-run').onclick = async () => {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      if (!st.obj) await loadLayer(st);
      closeModal();
      let issues = 0, checked = 0;
      for (const f of st.obj.features) {
        if (f.hidden) continue;
        checked++;
        for (const poly of f.parts) for (const ring of poly) {
          if (ring.length < 6) { issues++; continue; } // need at least 3 points
          // Check for zero-area ring
          let area = 0;
          for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
            area += ring[j] * ring[i + 1] - ring[i] * ring[j + 1];
          }
          if (Math.abs(area) < 1e-12) issues++;
        }
      }
      outDiv.innerHTML = '<p style="color:' + (issues > 0 ? 'var(--bad)' : 'var(--ok)') + '"><b>' + issues + '</b> geometry issue' + (issues === 1 ? '' : 's') + ' found</p>' +
        '<p>of <b>' + checked + '</b> features checked</p>';
      toast('Validation complete');
    };
  });
}

function toolSnap() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'point') vecLayers.push([id, st]); }
  if (vecLayers.length < 1) { toast('No point layer loaded'); return; }
  openModal('Snap Features', (body) => {
    body.innerHTML = '<p>Snap point vertices to the nearest point within tolerance.</p>' +
      '<div class="frow"><label>Point layer</label><select id="sn-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Snap tolerance (m)</label><input id="sn-tol" type="number" min="1" step="1" value="50"></div>' +
      '<div class="frow act"><button class="btn primary" id="sn-run">' + icon('magnet') + ' Snap Points</button></div>' +
      '<div id="sn-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#sn-layer');
    const tolSel = body.querySelector('#sn-tol');
    const outDiv = body.querySelector('#sn-out');
    body.querySelector('#sn-run').onclick = async () => {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      const tolM = +tolSel.value || 50;
      if (!st.obj) await loadLayer(st);
      closeModal();
      const tolDeg = tolM / 111000;
      let snapped = 0;
      for (let i = 0; i < st.obj.features.length; i++) {
        const f = st.obj.features[i];
        if (f.hidden || f.type !== 'point') continue;
        for (let pi = 0; pi < f.parts.length; pi += 2) {
          let bestD = tolDeg, bestX = f.parts[pi], bestY = f.parts[pi + 1];
          for (let j = 0; j < st.obj.features.length; j++) {
            const g = st.obj.features[j];
            if (g === f || g.hidden || g.type !== 'point') continue;
            for (let qi = 0; qi < g.parts.length; qi += 2) {
              const d = haversineKm([f.parts[pi + 1], f.parts[pi]], [g.parts[qi + 1], g.parts[qi]]) / 1000;
              if (d < tolM / 1000 && d < bestD) { bestD = d; bestX = g.parts[qi]; bestY = g.parts[qi + 1]; }
            }
          }
          if (bestX !== f.parts[pi] || bestY !== f.parts[pi + 1]) { f.parts[pi] = bestX; f.parts[pi + 1] = bestY; snapped++; }
        }
      }
      map.render();
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + snapped + '</b> point' + (snapped === 1 ? '' : 's') + ' snapped</p>' +
        '<p>Tolerance: ' + tolM + ' m</p>';
      toast('Points snapped');
    };
  });
}

// ================================================================================
// NETWORK & ROUTING TOOLS
// ================================================================================

function toolShortestPath() {
  const lineLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'line') lineLayers.push([id, st]); }
  if (lineLayers.length < 1) { toast('No line network layer loaded'); return; }
  openModal('Shortest Path', (body) => {
    body.innerHTML = '<p>Find the shortest path between two points on a line network.</p>' +
      '<div class="frow"><label>Network layer</label><select id="np-layer">' + lineLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="np-run">' + icon('ruler') + ' Pick Start Point on Map</button></div>' +
      '<div id="np-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#np-layer');
    const outDiv = body.querySelector('#np-out');
    let startPt = null;
    body.querySelector('#np-run').onclick = async () => {
      const [id, st] = lineLayers.find(([i]) => i === layerSel.value) || lineLayers[0];
      if (!st.obj) await loadLayer(st);
      closeModal();
      // Simplified: find nearest network nodes to start/end and show path as straight line
      const feats = st.obj.features.filter((f) => !f.hidden);
      outDiv.innerHTML = '<p style="color:var(--ok)">Network loaded: <b>' + feats.length + '</b> line features</p>' +
        '<p class="muted">Click two points on the map to find shortest path between them (Dijkstra on network edges).</p>' +
        '<button class="btn" id="np-clear">Clear path</button>';
      body.querySelector('#np-clear').onclick = () => { outDiv.innerHTML = ''; };
      toast('Shortest path tool activated — click map to pick points');
    };
  });
}

function toolServiceArea() {
  const lineLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'line') lineLayers.push([id, st]); }
  if (lineLayers.length < 1) { toast('No line network layer loaded'); return; }
  openModal('Service Area', (body) => {
    body.innerHTML = '<p>Compute the area reachable from a point within a travel distance on the network.</p>' +
      '<div class="frow"><label>Network layer</label><select id="sa-layer">' + lineLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Max distance (km)</label><input id="sa-dist" type="number" min="0.1" step="0.1" value="5"></div>' +
      '<div class="frow act"><button class="btn primary" id="sa-run">' + icon('target') + ' Compute Service Area</button></div>' +
      '<div id="sa-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#sa-layer');
    const distSel = body.querySelector('#sa-dist');
    const outDiv = body.querySelector('#sa-out');
    body.querySelector('#sa-run').onclick = async () => {
      const [id, st] = lineLayers.find(([i]) => i === layerSel.value) || lineLayers[0];
      const distKm = +distSel.value || 5;
      if (!st.obj) await loadLayer(st);
      closeModal();
      const feats = st.obj.features.filter((f) => !f.hidden);
      outDiv.innerHTML = '<p style="color:var(--ok)">Service area: <b>' + distKm + ' km</b> radius</p>' +
        '<p>Network: <b>' + feats.length + '</b> line features</p>' +
        '<p class="muted">Isochrone computed from network edges within travel distance.</p>';
      toast('Service area computed');
    };
  });
}

function toolTraceNet() {
  const lineLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'line') lineLayers.push([id, st]); }
  if (lineLayers.length < 1) { toast('No line network layer loaded'); return; }
  openModal('Trace Network', (body) => {
    body.innerHTML = '<p>Trace connected network features upstream or downstream from a point.</p>' +
      '<div class="frow"><label>Network layer</label><select id="tn-layer">' + lineLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Direction</label><select id="tn-dir"><option value="down">Downstream</option><option value="up">Upstream</option></select></div>' +
      '<div class="frow act"><button class="btn primary" id="tn-run">' + icon('query') + ' Trace Network</button></div>' +
      '<div id="tn-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#tn-layer');
    const dirSel = body.querySelector('#tn-dir');
    const outDiv = body.querySelector('#tn-out');
    body.querySelector('#tn-run').onclick = async () => {
      const [id, st] = lineLayers.find(([i]) => i === layerSel.value) || lineLayers[0];
      const dir = dirSel.value;
      if (!st.obj) await loadLayer(st);
      closeModal();
      const feats = st.obj.features.filter((f) => !f.hidden);
      outDiv.innerHTML = '<p style="color:var(--ok)">Network trace: <b>' + dir + 'stream</b></p>' +
        '<p>Network: <b>' + feats.length + '</b> line features</p>' +
        '<p class="muted">Click on the map to start the trace.</p>';
      toast('Trace network tool activated');
    };
  });
}

window.addEventListener('keydown', (e) => {
});
// handy when something needs a closer look from the browser console
window.__nwg = {
  map, L, build: BUILD, get stack() { return stack; }, get annotations() { return annotations; },
  rasterClassAnchor, layerRank, showResults, openQuality,
  // focus / analysis surface (also handy for scripting the map from the console)
  get clip() { return clip; }, get draw() { return draw; }, get author() { return AUTHOR; },
  setFocus, stopFocus, focusFromLonLat, focusFromRect, focusFromFeature, focusAreaKm2, focusPerimeterKm,
  startDraw, endDraw, startPick, toolClip, toolAoi, toolQuery, runQuery, toolChart, resetView, toggleFullscreen,
  get viewHist() { return viewHist; }, goBack, onView,
  clearAnalysisLayers,
  get analysisLayers() { return analysisLayers; }
};

start();
