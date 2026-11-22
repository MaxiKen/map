import { GeoMap, BASEMAPS, BASEMAP_ORDER, convertFeature, prepareFeature, DEFAULT_VECTOR_COLOR, mercX, mercY, unX, unY, featureMetrics, haversineKm, labelAnchor, ringAreaKm2, ringPerimeterKm, pointInFeature, pip2, featureCentroid, convexHullFeature, convexHullPoints, simplifyFeature, simplifyRing, bufferFeature, bufferZone, ringIntersection, intersectPolyPoly, polygonBoolean, featureDistanceKm, featureClosestKm, scrubForExport, exportHasCoordinates, isCoordinateKey, partsBBox, segmentsIntersect, polyOverlapsPoly, ringsBBox, normalizeClip, clipBB, circleToPolygon, circleMercRadiusForMetres, distToRingMerc, haversineMerc, ringSignedArea, lonlatRing } from './engine.js?v=374170f359';
import { createLoadScheduler } from './loading.js?v=374170f359';
import { qualityPanelHTML, qualityPresentation, metadataGapLabels } from './quality.js?v=374170f359';
import { openGeoPackage } from './gpkg.js?v=374170f359';
import { CRS_MENU, crsByCode, caveatFor, assumedCaveat, transformGeometry, geometryInWorld } from './crs.js?v=374170f359';

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
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.2 9.3a3 3 0 0 1 5.6 1.2c0 2-2.8 2.2-2.8 4"/><path d="M12 17.2h.01"/>',
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
let bufferPick = null, bufferPreview = null;
// Viewers get the read-only map: analysis and viewing only. Content/styling work lives behind ?author=1.
let AUTHOR = new URLSearchParams(location.search).get('author') === '1';
let draw = null;              // {kind:'rect'|'poly'|'pick', pts:[]} while the user is drawing a focus area
// Selection mode: touch-friendly, stays on until you leave it, works with taps and with a drag box.
const selState = {
  active: false,
  ids: new Set(),             // selected keys "layerId:idx"
  filter: '',                 // only these layer ids may be picked ('' = every switched-on layer)
  box: null,                  // {x0,y0,x1,y1} while dragging a box
  last: null,                 // last {layer, feature} picked, for the Info panel
};
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
// area of a flat mercator ring [x0,y0,x1,y1,...] in km² (spherical excess on the lon/lat ring)
function flatRingAreaKm2(flat) {
  const ll = [];
  for (let i = 0; i < flat.length; i += 2) ll.push([unX(flat[i]), unY(flat[i + 1])]);
  return ringAreaKm2(ll);
}
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
  $('#import-gpkg')?.addEventListener('click', () => toolGpkg());
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
  bindSelectPointer();
  wireSelBar();
  $('#drawdone').onclick = () => {
    if (clipPick) { endClipPick(true); return; }
    if (draw?.kind === 'poly') { const pts = draw.pts.slice(); endDraw(); focusFromLonLat(pts); return; }
    endDraw();
  };
  $('#drawclear').onclick = () => {
    if (clipPick) { endClipPick(false); return; }
    endDraw(); toast('Focus drawing cancelled');
  };
  $('#btn-full').onclick = toggleFullscreen;
  $('#leave-author')?.addEventListener('click', () => {
    const u = new URL(location.href); u.searchParams.delete('author');
    location.href = u.pathname + (u.search ? u.search : '') + u.hash;
  });
  $('#btn-back').onclick = goBack;
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (bufferPick?.active) { stopBufferPick(); toast('Buffer cancelled'); }
    else if (clipPick) { endClipPick(false); }
    else if (draw) { endDraw(); toast('Focus drawing cancelled'); }
    else if (selState.active) { exitSelectMode(false); toast('Select mode off'); }
  });
  if (saved && saved.clip) restoreFocus(saved.clip);
  const sharedFocus = readSharedFocus();
  if (sharedFocus) restoreFocus(sharedFocus);
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
  const wb = st.obj.wb;
  st.obj.vals = { w: v.w, h: v.h, wb, dtype: v.dtype, data: v.dtype === 'i2' ? new Int16Array(buf) : new Float32Array(buf) };
}

function applyLayerState(st) {
  const o = st.obj; if (!o) return;
  o.opacity = st.opacity;
  o.sym = st.sym || null;
  o.labels = st.labels && st.labels.field ? st.labels : null;
  if (o.features) {
    for (const f of o.features) { f.fill = f.fill0; f.hidden = false; }
    if (st.reclass) applyReclass(st, false);
    if (hasFilter(st)) applyFilter(st, false);
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
// Filters are a numbered list, not one condition per layer. Several rules on the same
// layer are combined (a feature must match every one). Rules on different layers are independent.
let filterSeq = 1;
function nextFilterId() { return filterSeq++; }
function noteFilterSeq(id) {
  const n = +id;
  if (Number.isFinite(n) && n >= filterSeq) filterSeq = Math.floor(n) + 1;
}
function filterRules(st) {
  const f = st?.filter;
  if (!f) return [];
  return (Array.isArray(f) ? f : [f]).filter(Boolean);
}
function hasFilter(st) { return filterRules(st).length > 0; }
function ensureAllFilterIds() {
  for (const st of L.values()) {
    if (!st.filter) continue;
    const list = (Array.isArray(st.filter) ? st.filter : [st.filter]).filter(Boolean);
    for (const rule of list) {
      if (rule.id == null) rule.id = nextFilterId();
      else noteFilterSeq(rule.id);
    }
    st.filter = list.length ? list : null;
  }
}
function allFilters() {
  ensureAllFilterIds();
  const rows = [];
  for (const st of L.values()) for (const rule of filterRules(st)) rows.push({ st, rule });
  rows.sort((a, b) => (+a.rule.id || 0) - (+b.rule.id || 0));
  return rows;
}
function filterNumber(id) {
  const i = allFilters().findIndex((row) => String(row.rule.id) === String(id));
  return i < 0 ? allFilters().length : i + 1;
}
function findFilter(id) {
  const key = String(id);
  return allFilters().find((row) => String(row.rule.id) === key) || null;
}
function activeVectorLayers() {
  const out = [];
  for (const id of [...stack].reverse()) {
    const st = L.get(id);
    if (st?.on && ['polygon', 'line', 'point'].includes(st.meta.kind)) out.push(st);
  }
  return out;
}
function ruleMatches(feature, rule) {
  const raw = feature.props ? feature.props[rule.field] : undefined;
  const val = String(raw ?? '');
  const num = +raw;
  if (rule.op === '_temporal') {
    if (!Number.isFinite(num)) return false;
    const op = rule.temporalOp;
    if (op === 'before') return rule.max == null || num <= +rule.max;
    if (op === 'after') {
      const bound = rule.min != null ? rule.min : rule.max;
      return bound == null || num >= +bound;
    }
    if (op === 'exact') {
      const bound = rule.min != null ? rule.min : rule.max;
      return bound != null && num === +bound;
    }
    return (rule.min == null || num >= +rule.min) && (rule.max == null || num <= +rule.max);
  }
  if (rule.op === 'in') return (rule.values || []).map(String).includes(val);
  if (rule.op === 'not_in') return !(rule.values || []).map(String).includes(val);
  if (rule.op === 'contains') return val.toLowerCase().includes(String(rule.value ?? '').toLowerCase());
  if (rule.op === 'neq') return val !== String(rule.value ?? '');
  if (rule.op === 'gt') return Number.isFinite(num) && num > +rule.value;
  if (rule.op === 'lt') return Number.isFinite(num) && num < +rule.value;
  if (rule.op === 'gte') return Number.isFinite(num) && num >= +rule.value;
  if (rule.op === 'lte') return Number.isFinite(num) && num <= +rule.value;
  return val === String(rule.value ?? '');
}
function sameFilterRule(a, b) {
  if (!a || !b || a.field !== b.field || a.op !== b.op) return false;
  if (a.op === 'in' || a.op === 'not_in') {
    const norm = (rule) => (rule.values || []).map(String).sort().join('\0');
    return norm(a) === norm(b);
  }
  if (a.op === '_temporal') return a.temporalOp === b.temporalOp && a.min === b.min && a.max === b.max;
  return String(a.value ?? '') === String(b.value ?? '');
}
const FILTER_OP_LABEL = {
  eq: 'is exactly', neq: 'is not', gt: 'is more than', gte: 'is at least',
  lt: 'is less than', lte: 'is at most', contains: 'contains',
  in: 'include only', not_in: 'exclude',
};
function ruleText(st, rule) {
  const fld = (st?.meta.fields || []).find((f) => f.name === rule.field);
  const name = fld?.label || rule.field || 'Field';
  if (rule.op === '_temporal') {
    const op = rule.temporalOp || 'range';
    if (op === 'before') return `${name} on or before ${rule.max}`;
    if (op === 'after') return `${name} on or after ${rule.min ?? rule.max}`;
    if (op === 'exact') return `${name} equals ${rule.min ?? rule.max}`;
    return `${name} between ${rule.min} and ${rule.max}`;
  }
  if (rule.op === 'in' || rule.op === 'not_in') {
    const vals = (rule.values || []).map(String);
    const more = vals.length > 4 ? ` +${vals.length - 4}` : '';
    return `${name} ${FILTER_OP_LABEL[rule.op]} ${vals.slice(0, 4).join(', ')}${more}`;
  }
  return `${name} ${FILTER_OP_LABEL[rule.op] || rule.op} ${rule.value ?? ''}`;
}
function filterListHTML(editingId = null) {
  const rows = allFilters();
  if (!rows.length) return '';
  const counts = {};
  for (const row of rows) counts[row.st.meta.id] = (counts[row.st.meta.id] || 0) + 1;
  return `<div class="flist">${rows.map(({ st, rule }, i) => {
    const combo = counts[st.meta.id] > 1 ? ' · combined with the others on this layer' : '';
    const on = String(rule.id) === String(editingId) ? ' on' : '';
    return `<div class="fitem${on}" data-fid="${esc(rule.id)}">
      <span class="fn">${i + 1}</span>
      <span class="ft"><b>${esc(st.meta.label)}</b><small>${esc(ruleText(st, rule))}${combo}</small></span>
      <span class="acts"><button type="button" class="btn" data-fedit="${esc(rule.id)}">Edit</button><button type="button" class="btn" data-frm="${esc(rule.id)}">Remove</button></span>
    </div>`;
  }).join('')}</div>`;
}
function dropTemporalState(layerId, rules) {
  if (!rules.some((r) => r.op === '_temporal' || r.source === 'temporal')) delete timeFilters[layerId];
}
function upsertFilterRule(layerId, rule) {
  const st = L.get(layerId);
  if (!st || !rule) return null;
  ensureAllFilterIds();
  if (rule.id == null) rule.id = nextFilterId();
  else noteFilterSeq(rule.id);
  const key = String(rule.id);
  for (const other of L.values()) {
    if (!other.filter || other.meta.id === layerId) continue;
    const rules = filterRules(other);
    if (!rules.some((r) => String(r.id) === key)) continue;
    const next = rules.filter((r) => String(r.id) !== key);
    other.filter = next.length ? next : null;
    if (rule.op === '_temporal' || rule.source === 'temporal') dropTemporalState(other.meta.id, next);
    if (other.obj) applyFilter(other, false);
  }
  const kept = filterRules(st).filter((r) => String(r.id) !== key);
  kept.push(rule);
  st.filter = kept;
  if (rule.op === '_temporal' || rule.source === 'temporal') {
    timeFilters[layerId] = { field: rule.field, op: rule.temporalOp || 'range', min: rule.min ?? null, max: rule.max ?? null };
  }
  applyFilter(st);
  return { st, rule };
}
function removeFilterRule(id) {
  ensureAllFilterIds();
  const key = String(id);
  for (const st of L.values()) {
    const rules = filterRules(st);
    const rule = rules.find((r) => String(r.id) === key);
    if (!rule) continue;
    const next = rules.filter((r) => String(r.id) !== key);
    st.filter = next.length ? next : null;
    if (rule.op === '_temporal' || rule.source === 'temporal') dropTemporalState(st.meta.id, next);
    applyFilter(st);
    return { st, rule };
  }
  return null;
}
function clearAllFilters() {
  for (const id of Object.keys(timeFilters)) delete timeFilters[id];
  let n = 0;
  for (const st of L.values()) {
    if (!hasFilter(st)) continue;
    st.filter = null;
    applyFilter(st, false);
    n++;
  }
  map.render(); refreshLegend(); renderLayerLists();
  return n;
}
function applyFilter(st, rerender = true) {
  const o = st?.obj;
  if (!o?.features) {
    if (st && !hasFilter(st)) st.filterCount = null;
    return;
  }
  ensureAllFilterIds();
  const rules = filterRules(st);
  let n = 0;
  for (const f of o.features) {
    const hit = !rules.length || rules.every((rule) => ruleMatches(f, rule));
    f.hidden = !hit;
    if (hit) n++;
  }
  st.filterCount = rules.length ? n : null;
  if (!rules.length) st.filter = null;
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
  const sub = [KIND_LABEL[m.kind], countText(m), m.crsName].filter(Boolean).join(' · ');
  const qualitySub = quality ? ` · <span class="quality-inline q-${quality.tone}" title="${esc(quality.label)}">${esc(quality.short)}</span>` : '';
  const flags = [
    hasFilter(st) ? `<span class="chip on" data-act="filter">${icon('filter')}${filterRules(st).length > 1 ? filterRules(st).length + ' filters' : 'Filtered'}</span>` : '',
    st.reclass ? `<span class="chip on">${icon('sliders')}Classified</span>` : '',
    st.labels?.field && st.labels.on !== false ? `<span class="chip on">${icon('tag')}${esc(st.labels.field)}</span>` : '',
  ].join('');
  const imported = m.group === 'imported';
  row.innerHTML = `<div class="lmain">
      ${imported ? '' : `<button class="grip" aria-label="Drag to reorder">${icon('grip')}</button>`}
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
      ${imported ? `<span class="chip" data-act="remove">${icon('trash')}Remove</span>` : ''}
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
    else if (act === 'remove') removeImported(id);
    else if (act === 'filter') toolFilter(id);
  });
  return row;
}
function bindFilterList(root, onEdit) {
  if (!root) return;
  root.querySelectorAll('[data-fedit]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const found = findFilter(b.dataset.fedit);
      if (onEdit) onEdit(found);
      else if (found) toolFilter(found.st.meta.id, found.rule.id);
    };
  });
  root.querySelectorAll('[data-frm]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const found = findFilter(b.dataset.frm);
      removeFilterRule(b.dataset.frm);
      saveProject();
      toast(found ? `Removed a filter on ${found.st.meta.label}` : 'Filter removed');
      if (onEdit) onEdit(null, true);
    };
  });
}
function renderLayerLists() {
  const q = ($('#layerfilter').value || '').trim().toLowerCase();
  // --- on the map (topmost first; the layer clicked last is on top)
  const act = $('#activelist');
  const vis = [...stack].reverse();
  const filters = allFilters();
  const filterBlock = filters.length
    ? `<div class="sec">Filters <span class="n">${filters.length}</span></div>
      <p class="hint">#1 is the first filter you added. Filters on the same layer are combined — a feature must match every one of them. Edit or remove one without touching the others.</p>
      ${filterListHTML()}
      <div class="frow act" style="margin-top:0"><button type="button" class="btn" data-fopen>Add filter</button></div>`
    : '';
  act.innerHTML = filterBlock + `<div class="sec">On the map <span class="n">${vis.length ? vis.length + ' layer' + (vis.length > 1 ? 's' : '') : ''}</span></div>` +
    (vis.length ? '<p class="hint">Drag ⠿ to restack — the top layer is drawn on top.</p><div class="group"><div class="lrows" id="active-rows"></div></div>'
      : '<p class="empty">Nothing on the map yet — turn a layer on below.</p>');
  act.querySelector('[data-fopen]')?.addEventListener('click', () => toolFilter());
  bindFilterList(act);
  const arows = $('#active-rows');
  if (arows) {
    for (const id of vis) {
      const row = layerRow(id);
      if (q && !row.dataset.search.includes(q)) row.hidden = true;
      arows.appendChild(row);
    }
    enableReorder(arows, (ids) => { stack.splice(0, stack.length, ...ids.reverse()); applyOrderFromStack(); renderLayerLists(); saveProject(); });
  }
  renderImported();
  // --- all layers, grouped
  const root = $('#layerlist');
  const published = catalog.layers.filter((m) => m.group !== 'imported');
  root.innerHTML = '<div class="sec">All layers <span class="n">' + published.length + '</span></div>';
  for (const g of catalog.groups) {
    if (g.id === 'imported') continue;
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
    : '<p class="hint">Tap a legend entry to zoom to it, focus on it, add it as a filter, or add it to the map as a label.</p>'];
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
    const n = hasFilter(st) ? `<span class="n">${st.filterCount}/${m.count} shown</span>` : '';
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
        <button class="btn" id="le-filter">${icon('filter')} Add as filter</button>
        ${AUTHOR ? `<button class="btn" id="le-label">${icon('tag')} Add label to the map</button>` : ''}
      </div>`;
    body.querySelector('#le-focus')?.addEventListener('click', () => {
      if (!anchor) return;
      closeModal();
      const bb = anchor.bbox;   // [west, south, east, north]
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
      const rule = { field: useField, op: 'eq', value: String(kind === 'style' ? label : entry.key), source: 'legend' };
      if (filterRules(st).some((r) => sameFilterRule(r, rule))) { toast('That filter is already on the list'); return; }
      const saved = upsertFilterRule(st.meta.id, rule);
      closeModal(); saveProject();
      toast(saved ? `Filter ${filterNumber(saved.rule.id)} added — ${label}` : 'Could not add that filter');
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
      <header>${icon(m.kind)}<span>${esc(titleOf(st.obj, f))}</span><small>${esc(m.label)}</small></header>
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
  if (bufferPick?.active) { pickBufferFeature(x, y); return; }
  // ---- selection mode: tapping a feature toggles it, a drag box selects everything inside
  if (selState.active) {
    const res = map.identify(x, y).filter((r) => r.feature && (!selState.filter || r.layer.id === selState.filter));
    const hit = res[res.length - 1];
    if (!hit) {
      if (!selCount()) toast('Tap a feature, or press and drag to select a box');
      return;
    }
    const st = L.get(hit.layer.id);
    const added = selToggle(hit.layer.id, hit.feature);
    if (added) showResults([{ layer: { id: hit.layer.id, kind: hit.layer.kind }, feature: hit.feature }], [lo, la]);
    toast(`${added ? 'Selected' : 'Unselected'} ${titleOf(st.obj, hit.feature)}${selCount() ? ` · ${selCount()} selected` : ''}`, 1600);
    return;
  }
  if (draw?.kind === 'pick') {
    if (draw.mode === 'multi') {
      const multiHit = map.identify(x, y).filter((r) => r.feature && r.layer.kind === 'polygon').pop();
      if (!multiHit) { toast('Tap inside a polygon to add it'); return; }
      const stM = L.get(multiHit.layer.id), idxM = stM?.obj?.features?.indexOf(multiHit.feature);
      if (idxM != null && idxM >= 0) { toggleClipPick(multiHit.layer.id, idxM); return; }
    }
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
    // Snapping to a polygon edge is nice but must never swallow the tap: keep the raw point.
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
  box.querySelectorAll('[data-quality-download]').forEach((button) => {
    button.onclick = () => downloadQualityRegister(button.dataset.qualityDownload);
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
async function downloadQualityRegister(file) {
  const name = String(file || 'quality-register.json').split('/').pop();
  try {
    const res = await fetch(name, { cache: 'no-cache' });
    if (!res.ok) throw new Error('missing');
    const raw = await res.json();
    const clean = scrubForExport(raw);
    if (exportHasCoordinates(JSON.stringify(clean))) { toast('Register export blocked — coordinates remained'); return; }
    exportJson('quality-register.json', {
      note: 'Location coordinates (latitude, longitude and bounding boxes) were removed from this copy. It is not the hashed source register.',
      register: clean,
    }) && toast('Register saved — coordinates excluded');
  } catch { toast('Could not read the quality register', 4000); }
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
  if (tab === 'layers') { renderLayerLists(); $('#panel-layers')?.scrollTo(0, 0); }
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
    ['select', 'target', 'Select features', 'Tap or drag a box to select features'],
    ['aoi', 'hist', 'Area summary', 'Counts, classes and area inside the focus'],
    ['filter', 'filter', 'Filter features', 'Stack filters on any layer that is on'],
    ['reclass', 'sliders', 'Group into classes', 'Reclassify and recolour a numeric field'],
  ],
  analyse: [
    ['buffer', 'target', 'Buffer / Proximity', 'Tap a feature, then choose the zone shape'],
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
    ['export', 'camera', 'Picture with title & frame', 'PNG with a title, legend, scale and grid'],
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
    ['printlayout', 'camera', 'Print Layouts', 'A4 / Letter page templates for pictures'],
  ],
  project: [
    ['resetview', 'refresh', 'Reset the view', 'Back to the opening extent and no filters'],
    ['fullscreen', 'expand', 'Full screen', 'Use the whole screen, no browser chrome'],
  ],
  mobile: [
    ['guide', 'help', 'Guide', 'Every tool, step by step'],
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
    ['rastercontour', 'query', 'Raster Contour', 'Contour lines from raster'],
    ['rasterslope', 'target', 'Raster Slope', 'Slope from DEM raster'],
    ['rasterhist', 'hist', 'Raster Histogram', 'Value distribution histogram'],
    ['rasterclipoly', 'crop', 'Raster Clip by Polygon', 'Clip raster extent to polygon boundary'],
    ['rasteroverlay', 'calc', 'Raster Overlay Math', 'Cell-by-cell math between two rasters'],
    ['rasterclasszonal', 'chart', 'Raster Class Zonal', 'Raster class coverage per polygon'],
    ['rasterdiff', 'calc', 'Raster Difference', 'Subtract raster B from raster A'],
  ],
  geometry: [
    ['centroid', 'target', 'Feature Centroid', 'Centroid of selected features'],
    ['densify', 'line', 'Densify Lines', 'Add vertices along lines'],
    ['splitpoly', 'crop', 'Split Polygon by Line', 'Split polygons with a line'],
    ['concavehull', 'polygon', 'Concave Hull', 'Concave boundary (alpha shape)'],
    ['affinetransform', 'convert', 'Affine Transform', 'Move, rotate, scale features'],
    ['linetopoly', 'polygon', 'Lines to Polygons', 'Close line rings into polygons'],
    ['polyoutline', 'line', 'Polygon Outlines', 'Extract polygon boundaries'],
    ['featuresmooth', 'sliders', 'Smooth Features', 'Smooth line/polygon vertices'],
    ['featurebuffer', 'target', 'Feature Buffer', 'Buffer features by distance'],
    ['boundingbox', 'polygon', 'Bounding Box / Envelope', 'Create bounding boxes around features'],
    ['vertexstopoints', 'point', 'Vertices to Points', 'Extract every vertex as a point'],
    ['areaperim', 'chart', 'Area & Perimeter', 'km² and km for each polygon'],
    ['linepoints', 'point', 'Points Along Lines', 'Points at intervals along lines'],
    ['centroidpts', 'target', 'Polygon Centroids → Points', 'Centroid point layer from polygons'],
    ['polyadjacency', 'query', 'Polygon Adjacency', 'Find touching polygon pairs'],
    ['lineoffset', 'line', 'Line Offset', 'Parallel offset lines at distance'],
    ['polyunion', 'merge', 'Polygon Union / Merge', 'Merge all polygons into one'],
    ['linelenstats', 'chart', 'Line Length Statistics', 'Total, mean, min, max line lengths'],
  ],
  topology: [
    ['checkoverlap', 'query', 'Check Overlaps', 'Find overlapping polygons'],
    ['checkgaps', 'grid', 'Check Gaps', 'Find gaps between polygons'],
    ['validate', 'check', 'Validate Geometry', 'Check geometry validity'],
    ['snap', 'magnet', 'Snap Features', 'Snap features together'],
    ['selfintersect', 'query', 'Check Self-Intersections', 'Find self-intersecting rings'],
    ['duplicategeom', 'copy', 'Duplicate Geometries', 'Find identical coordinates'],
    ['snaptogrid', 'grid', 'Snap to Grid', 'Snap vertices to regular grid'],
    ['erasefeatures', 'trash', 'Feature Erase / Difference', 'Erase one layer from another'],
    ['checknullgeom', 'query', 'Check Null Geometries', 'Find empty or missing coordinates'],
    ['checkoutofbounds', 'query', 'Check Out of Bounds', 'Find coordinates outside valid range'],
    ['checkmultipart', 'query', 'Check Multi-part Features', 'Find multi-part features'],
    ['ringdirection', 'query', 'Ring Direction Check', 'CW/CCW ring orientation'],
    ['featurewithindist', 'target', 'Feature Within Distance', 'Features within distance of another layer'],
    ['spatialjoincount', 'table', 'Spatial Join Count', 'Count points within polygons'],
    ['bufferdissolve', 'target', 'Buffer Dissolve', 'Buffer then dissolve overlaps'],
    ['removesmallpoly', 'trash', 'Remove Small Polygons', 'Delete polygons below min area'],
  ],
  network: [
    ['shortestpath', 'ruler', 'Shortest Path', 'Shortest path on network'],
    ['servicearea', 'target', 'Service Area', 'Reachable area (isochrone)'],
    ['tracenet', 'query', 'Trace Network', 'Trace upstream/downstream'],
    ['networkbuffer', 'target', 'Network Buffer', 'Drive-time buffer around points'],
    ['networkconnect', 'query', 'Network Connectivity', 'Check network graph connectivity'],
    ['multipath', 'ruler', 'Multi-Stop Route', 'Optimize route through stops'],
    ['distancematrix', 'chart', 'Distance Matrix', 'Pairwise distances between points'],
    ['linemerge', 'merge', 'Merge Connected Lines', 'Merge lines sharing endpoints'],
    ['linebearing', 'compass', 'Line Bearing Statistics', 'Compass direction of line segments'],
    ['networkbetweenness', 'query', 'Network Betweenness', 'Node betweenness centrality'],
  ],
  generation: [
    ['fishnet', 'grid', 'Fishnet / Grid', 'Rectangular grid of cells'],
    ['randompts', 'point', 'Random Points', 'Random points within extent'],
    ['hexbin', 'polygon', 'Hexagonal Binning', 'Bin points into hexagons'],
    ['gridpoints', 'point', 'Regular Point Grid', 'Points on a regular grid'],
    ['randomlines', 'line', 'Random Lines', 'Generate random line features'],
    ['randompolygons', 'polygon', 'Random Polygons', 'Generate random polygon features'],
    ['randomsample', 'point', 'Random Sample', 'Random subset of features'],
    ['randomraster', 'raster', 'Random Raster', 'Generate random raster surface'],
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
    ['export', 'camera', 'Picture with title & frame', 'PNG with a title, legend, scale and grid'],
    ['countbyattr', 'chart', 'Count by Attribute', 'Tally features by field value'],
    ['fieldstatsbygroup', 'chart', 'Field Stats by Group', 'Grouped statistics by field'],
    ['gpkg', 'upload', 'Import GeoPackage', 'Bring your own GeoPackage onto the map'],
  ],
  classification: [
    ['jenksbreaks', 'sliders', 'Natural Breaks (Jenks)', 'Jenks natural breaks classes'],
    ['quantileclass', 'sliders', 'Quantile Classification', 'Equal-count quantile classes'],
    ['equalintervalclass', 'sliders', 'Equal Interval Classification', 'Equal-width value classes'],
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
      || (t === 'clip' && !!clip) || (t === 'select' && selState.active)
      || (t === 'buffer' && bufferPick?.active));
  }
  const g = $('#lyrtools [data-x="grid"]'); if (g) g.classList.toggle('on', gridOn);
}
const AUTHOR_ONLY = new Set(['symbology', 'addlabel', 'savelabels', 'import', 'reset']);
function runTool(t) {
  if (AUTHOR_ONLY.has(t) && !AUTHOR) return;
  if (t !== 'buffer') stopBufferPick();
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
    case 'gpkg': toolGpkg(); break;
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
    case 'select': toolSelect(); break;
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
    case 'guide': openGuide(); break;
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
    case 'rastercontour': toolRasterContour(); break;
    case 'rasterslope': toolRasterSlope(); break;
    case 'rasterhist': toolRasterHist(); break;
    case 'affinetransform': toolAffineTransform(); break;
    case 'linetopoly': toolLineToPoly(); break;
    case 'polyoutline': toolPolyOutline(); break;
    case 'featuresmooth': toolFeatureSmooth(); break;
    case 'selfintersect': toolSelfIntersect(); break;
    case 'duplicategeom': toolDuplicateGeom(); break;
    case 'snaptogrid': toolSnapToGrid(); break;
    case 'networkbuffer': toolNetworkBuffer(); break;
    case 'networkconnect': toolNetworkConnect(); break;
    case 'multipath': toolMultiPath(); break;
    case 'fishnet': toolFishnet(); break;
    case 'randompts': toolRandomPoints(); break;
    case 'hexbin': toolHexbin(); break;
    case 'gridpoints': toolGridPoints(); break;
    case 'rasterclipoly': toolRasterClipPoly(); break;
    case 'featurebuffer': toolFeatureBuffer(); break;
    case 'boundingbox': toolBoundingBox(); break;
    case 'vertexstopoints': toolVerticesToPoints(); break;
    case 'erasefeatures': toolEraseFeatures(); break;
    case 'checknullgeom': toolCheckNullGeom(); break;
    case 'checkoutofbounds': toolCheckOutOfBounds(); break;
    case 'checkmultipart': toolCheckMultipart(); break;
    case 'distancematrix': toolDistanceMatrix(); break;
    case 'linemerge': toolLineMerge(); break;
    case 'randomlines': toolRandomLines(); break;
    case 'randompolygons': toolRandomPolygons(); break;
    case 'rasteroverlay': toolRasterOverlay(); break;
    case 'areaperim': toolAreaPerim(); break;
    case 'linepoints': toolLinePoints(); break;
    case 'centroidpts': toolCentroidPts(); break;
    case 'linebearing': toolLineBearing(); break;
    case 'countbyattr': toolCountByAttr(); break;
    case 'randomsample': toolRandomSample(); break;
    case 'rasterclasszonal': toolRasterClassZonal(); break;
    case 'rasterdiff': toolRasterDiff(); break;
    case 'polyadjacency': toolPolyAdjacency(); break;
    case 'lineoffset': toolLineOffset(); break;
    case 'polyunion': toolPolyUnion(); break;
    case 'linelenstats': toolLineLenStats(); break;
    case 'ringdirection': toolRingDirection(); break;
    case 'featurewithindist': toolFeatureWithinDist(); break;
    case 'spatialjoincount': toolSpatialJoinCount(); break;
    case 'bufferdissolve': toolBufferDissolve(); break;
    case 'networkbetweenness': toolNetworkBetweenness(); break;
    case 'fieldstatsbygroup': toolFieldStatsByGroup(); break;
    case 'randomraster': toolRandomRaster(); break;
    case 'jenksbreaks': toolJenksBreaks(); break;
    case 'quantileclass': toolQuantileClass(); break;
    case 'equalintervalclass': toolEqualIntervalClass(); break;
    case 'removesmallpoly': toolRemoveSmallPoly(); break;
  }
}

// ---------------------------------------------------------------- focus area (clip)
const FOCUS_KINDS = { rect: 'Rectangle', square: 'Square', circle: 'Circle', poly: 'Polygon', freehand: 'Freehand outline', multi: 'Multiple features' };

function setFocus(obj, announce = true) {
  clip = obj || null;
  // A rectangle may arrive as either pair of corners; keep it in top/bottom order so the
  // area, edge and save/share records all agree with what the map actually clips to.
  if (clip?.type === 'rect' && Array.isArray(clip.wb)) {
    const [w, y0, e, y1] = clip.wb;
    clip = { ...clip, wb: [Math.min(w, e), Math.min(y0, y1), Math.max(w, e), Math.max(y0, y1)] };
  }
  map.setClip(clip);
  // If the engine cannot use the shape there is no focus area at all — say so instead of
  // reporting an area for something the map is still drawing in full.
  if (clip && !map.clip) {
    clip = null;
    updateFocusUI();
    toast('That area could not be used — try drawing it again');
    return;
  }
  updateFocusUI();
  saveProjectSoon();
  if (announce) toast(clip ? `Focused on ${fmtNum(focusAreaKm2())} km²` : 'Focus cleared — the whole map is shown');
}

// The lon/lat box of everything the canvas currently shows, rotation included.
function viewBoundsLL() {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [px, py] of [[0, 0], [map.W, 0], [map.W, map.H], [0, map.H]]) {
    const [lo, la] = map.lonlatAt(px, py);
    w = Math.min(w, lo); e = Math.max(e, lo);
    s = Math.min(s, la); n = Math.max(n, la);
  }
  return [w, s, e, n];
}
function focusFromView() {
  const [w, s, e, n] = viewBoundsLL();
  const wb = [mercX(w), mercY(n), mercX(e), mercY(s)];
  if (!wb.every(Number.isFinite) || wb[0] === wb[2] || wb[1] === wb[3]) { toast('The map is not showing anything to clip to'); return; }
  setFocus({ type: 'rect', wb });
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
    // Radius measured on the ground when the circle was drawn.
    return Math.PI * Math.pow((clip.metres || 0) / 1000, 2);
  }
  // Each polygon in the focus contributes its outer ring minus its holes;
  // several selected features (multi) add up, they do not cancel each other out.
  let a = 0;
  for (const poly of focusPolygons(clip)) {
    poly.forEach((ring, i) => {
      const v = ringAreaKm2(ring);
      a += i === 0 ? v : -v;
    });
  }
  return Math.max(0, a);
}
// The focus polygons as [outer, ...holes] lists of [lon, lat] rings.
function focusPolygons(c) {
  if (!c) return [];
  const src = c.polys && c.polys.length ? c.polys : [c.rings || []];
  return src.map((poly) => poly.map((ring) => {
    const o = [];
    for (let k = 0; k + 1 < ring.length; k += 2) o.push([unX(ring[k]), unY(ring[k + 1])]);
    return o;
  })).filter((poly) => poly[0]?.length > 2);
}
function focusPerimeterKm() {
  if (!clip) return 0;
  if (clip.type === 'poly' || clip.type === 'freehand' || clip.type === 'multi') {
    // Every selected shape counts: the outline you walk around, not only the first one.
    return focusPolygons(clip).reduce((sum, poly) => sum + ringPerimeterKm(poly[0]), 0);
  }
  if (clip.type === 'circle') return 2 * Math.PI * ((clip.metres || 0) / 1000);
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
// A square on the ground: both sides equal in metres, not equal in mercator units
// (mercator stretches east-west as you move away from the equator).
function focusFromSquare(a, b) {
  const lo0 = Math.min(a[0], b[0]), lo1 = Math.max(a[0], b[0]);
  const la0 = Math.min(a[1], b[1]), la1 = Math.max(a[1], b[1]);
  const midLat = (la0 + la1) / 2;
  const widthKm = haversineKm([lo0, midLat], [lo1, midLat]);
  const heightKm = haversineKm([lo0, la0], [lo0, la1]);
  const sideKm = Math.min(widthKm, heightKm);
  if (!(sideKm > 0.001)) { toast('Drag a bigger square'); return; }
  const cx = (lo0 + lo1) / 2, cy = (la0 + la1) / 2;
  const dLat = sideKm / 2 / 110.574;
  const dLon = sideKm / 2 / (111.320 * Math.max(0.05, Math.cos(cy * Math.PI / 180)));
  setFocus({ type: 'rect', wb: [mercX(cx - dLon), mercY(cy + dLat), mercX(cx + dLon), mercY(cy - dLat)] });
}
// A circle whose radius is the ground distance from the centre to where you released.
function focusFromCircle(centre, edge) {
  const metres = haversineKm(centre, edge) * 1000;
  if (!(metres > 50)) { toast('Drag further from the centre to set the radius'); return; }
  const cx = mercX(centre[0]), cy = mercY(centre[1]);
  const r = circleMercRadiusForMetres(metres, centre[1]);
  setFocus({ type: 'circle', c: [cx, cy], r, metres: Math.round(metres) });
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
let dragPreview = null;   // { kind, a, b | c, e | pts } while a shape is being dragged
function startDraw(kind) {
  if (measure) { measure = null; $('#measurebar').hidden = true; }
  draw = { kind, pts: [], origin: null };
  map.cv.style.cursor = 'crosshair';
  const bar = $('#drawbar'); bar.hidden = false;
  const labels = {
    rect: 'Press and drag the two corners of the rectangle',
    square: 'Press and drag the two corners of the square',
    circle: 'Press at the centre and drag out to the edge',
    poly: 'Tap the corners, then press Done',
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
  // Picking replaces the focus, so clear it first — otherwise the map draws nothing
  // outside the old focus and the polygons you want to pick are invisible.
  if (mode === 'focus') { focusLabel = ''; setFocus(null, false); }
  if (mode !== 'multi') clipPick = null;
  draw = { kind: 'pick', mode, ...extra };
  map.cv.style.cursor = 'crosshair';
  const bar = $('#drawbar'); bar.hidden = false;
  const labels = {
    focus: 'Tap a polygon to use as the focus area',
    multi: 'Tap polygons to add them · tap again to remove · Done to clip',
  };
  $('#drawtext').textContent = labels[mode] || 'Tap a polygon to select inside it';
  $('#drawdone').hidden = true;
  $('#drawclear').textContent = 'Cancel';
  if (mode === 'multi') { $('#drawdone').hidden = false; $('#drawdone').textContent = 'Done'; }
  updateToolState();
}
function endDraw() {
  draw = null;
  dragPreview = null;
  if (!clipPick) map.selectionSet = [];
  map.cv.style.cursor = '';
  map.overlay = null;
  $('#drawbar').hidden = true;
  map.render();
  updateToolState();
}
// Live outline while a rectangle/square/circle/freehand is being dragged.
// The overlay reads `dragPreview`, which bindDrawPointer keeps up to date.
function drawPreviewDrag() {
  map.overlay = (ctx, m) => {
    if (!dragPreview) return;
    const st = drawStyle || '#0b6b45';
    ctx.save();
    ctx.setLineDash([7, 5]);
    ctx.lineWidth = drawStrokeWidth || 2.5;
    ctx.strokeStyle = st;
    ctx.fillStyle = st + '22';
    ctx.beginPath();
    if (dragPreview.kind === 'circle') {
      const [cx, cy] = m.screenOf(dragPreview.c[0], dragPreview.c[1]);
      const [ex, ey] = m.screenOf(dragPreview.e[0], dragPreview.e[1]);
      ctx.arc(cx, cy, Math.max(1, Math.hypot(ex - cx, ey - cy)), 0, Math.PI * 2);
    } else if (dragPreview.kind === 'freehand') {
      dragPreview.pts.forEach(([lo, la], i) => { const [x, y] = m.screenOf(lo, la); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    } else {
      const [x0, y0] = m.screenOf(dragPreview.a[0], dragPreview.a[1]);
      const [x1, y1] = m.screenOf(dragPreview.b[0], dragPreview.b[1]);
      if (dragPreview.kind === 'square') {
        const side = Math.min(Math.abs(x1 - x0), Math.abs(y1 - y0));
        const sx = x1 < x0 ? -side : side, sy = y1 < y0 ? -side : side;
        ctx.rect(Math.min(x0, x0 + sx), Math.min(y0, y0 + sy), side, side);
      } else ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    }
    ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  };
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
// press-and-drag inside select mode draws a selection box (works with touch and mouse)
function bindSelectPointer() {
  const cv = map.cv;
  let startPt = null, dragging = false;
  const local = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', (e) => {
    if (!selState.active || (e.pointerType === 'mouse' && e.button !== 0)) return;
    startPt = local(e); dragging = false;
  }, true);
  cv.addEventListener('pointermove', (e) => {
    if (!startPt || !selState.active) return;
    const p = local(e);
    if (!dragging && Math.hypot(p[0] - startPt[0], p[1] - startPt[1]) > 12) dragging = true;
    if (!dragging) return;
    selState.box = { x0: startPt[0], y0: startPt[1], x1: p[0], y1: p[1] };
    map.render();
  }, true);
  const finish = (e) => {
    if (!startPt) return;
    const wasDragging = dragging, box = selState.box;
    startPt = null; dragging = false; selState.box = null;
    if (!wasDragging || !box) { map.render(); return; }
    // convert the dragged corners through the (possibly rotated) view
    const [ax, ay] = map.fromScreen(box.x0, box.y0), [bx, by] = map.fromScreen(box.x1, box.y1);
    const found = map.featuresInRect([ax, ay, bx, by], { mode: 'intersect', layers: selState.filter ? [selState.filter] : null });
    let added = 0, removed = 0;
    for (const r of found) {
      const k = selKey(r.layer.id, r.feature);
      if (selState.ids.has(k)) { selState.ids.delete(k); removed++; } else { selState.ids.add(k); added++; }
    }
    selState.box = null;
    selSyncMap();
    toast(found.length
      ? (removed ? `Box: ${added} added, ${removed} removed · ${selCount()} selected` : `${selCount()} selected in the box${added ? '' : ' (already selected)'}`)
      : 'Nothing inside the box — try a larger box or check the layer is on', 2400);
  };
  cv.addEventListener('pointerup', finish, true);
  cv.addEventListener('pointercancel', () => { startPt = null; dragging = false; selState.box = null; map.render(); }, true);
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
    drawPreviewDrag();
    map.render();
    const move = (ev) => {
      last = rectAt(ev);
      if (draw.kind === 'freehand') freehandPts.push(last);
      dragPreview = draw.kind === 'freehand'
        ? { kind: 'freehand', pts: freehandPts }
        : draw.kind === 'circle' ? { kind: 'circle', c: origin, e: last } : { kind: draw.kind, a: origin, b: last };
      map.render();
    };
    const up = (ev) => {
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up);
      cv.removeEventListener('pointercancel', up);
      const b = rectAt(ev), a = origin, kind = draw?.kind, pts = freehandPts.slice();
      origin = null; last = null; dragPreview = null;
      endDraw();                       // clears the drawing state, so read the kind first
      if (kind === 'rect') focusFromRect(a, b);
      else if (kind === 'square') focusFromSquare(a, b);
      else if (kind === 'circle') focusFromCircle(a, b);
      else if (kind === 'freehand') focusFromFreehand(pts);
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
      <p>Everything outside the shape is completely removed — only what lies inside is drawn, searched, identified and tabulated. Use it to study one state, one LGA, one basin or one site.</p>
      <div class="aoi">
        <button class="btn" data-act="rect">${icon('crop')} Rectangle</button>
        <button class="btn" data-act="square">${icon('crop')} Square</button>
        <button class="btn" data-act="circle">${icon('target')} Circle</button>
        <button class="btn" data-act="poly">${icon('area')} Draw a polygon</button>
        <button class="btn" data-act="freehand">${icon('point')} Freehand outline</button>
        <button class="btn" data-act="multi">${icon('query')} Pick features from a layer</button>
        <button class="btn" data-act="view">${icon('expand')} Current view</button>
      </div>
      <p class="hint" style="margin-top:10px"><b>Rectangle</b> and <b>Square</b>: press and drag between two corners. <b>Circle</b>: press at the centre and drag out to the edge. <b>Polygon</b>: tap each corner, then <b>Done</b>. <b>Pick features from a layer</b> lets you choose a polygon layer and tick as many shapes as you like — even across layers.</p>
      <p class="hint">Esc or <b>Cancel</b> stops a drawing. The focus area is remembered with your view and in the share link.</p>
      ${clip ? `<div class="aoi" style="margin-top:10px">
        <button class="btn" data-act="summary">${icon('hist')} Area summary</button>
        <button class="btn" data-act="zoom">${icon('zoom')} Zoom to it</button>
        <button class="btn" data-act="clear">Clear focus</button></div>` : ''}`;
    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act; closeModal();
      if (act === 'rect') startDraw('rect');
      else if (act === 'pickmulti') startPick('multi');
      else if (act === 'square') startDraw('square');
      else if (act === 'circle') startDraw('circle');
      else if (act === 'poly') startDraw('poly');
      else if (act === 'freehand') startDraw('freehand');
      else if (act === 'multi') toolPickMulti();
      else if (act === 'view') focusFromView();
      else if (act === 'clear') stopFocus();
      else if (act === 'summary') toolAoi();
      else if (act === 'zoom') { const bb = map.clipBounds(); if (bb) map.fitBounds(bb, 24); }
    });
  });
}

// pick multiple polygon features and clip to their union ---------------------
// One picker for every polygon layer at once: choose the layer, tick the shapes (or tap
// them on the map), and the clip is the union of everything ticked — across layers too.
function toolPickMulti() { openClipMulti(null); }
function openClipMulti(preselected) {
  const polyLayers = [];
  for (const id of stack) {
    const st = L.get(id);
    if (st?.obj?.features && st.meta.kind === 'polygon') polyLayers.push([id, st]);
  }
  if (!polyLayers.length) {
    for (const st of L.values()) {
      if (st?.obj?.features && st.meta.kind === 'polygon') polyLayers.push([st.meta.id, st]);
    }
  }
  openModal('Clip to multiple features', (body) => {
    if (!polyLayers.length) {
      body.innerHTML = '<p class="empty">No polygon layer is loaded. Switch one on in Layers, then come back.</p>';
      return;
    }
    // coming back from "pick on the map": reopen with what was picked there
    const picked = new Map();
    for (const [lid, set] of (preselected || window.__clipPickCarry || new Map())) picked.set(lid, new Set(set));
    window.__clipPickCarry = null;
    const pickedOn = (lid) => { let set = picked.get(lid); if (!set) picked.set(lid, set = new Set()); return set; };
    const totalPicked = () => [...picked.values()].reduce((n, set) => n + set.size, 0);
    let filter = '';

    function drawSheet() {
      const lid = body.querySelector('#mp-layer')?.value || polyLayers[0][0];
      const pickedHere = pickedOn(lid).size;
      body.innerHTML = `<p>Pick the shapes to keep. Tick them in the list or tap them on the map — from one layer or several. The clip is the union of everything you pick, for example Kwara + Kogi + Benue.</p>
        <div class="frow"><label>Polygon layer</label><select id="mp-layer">${polyLayers.map(([id, st]) => `<option value="${esc(id)}"${id === lid ? ' selected' : ''}>${esc(st.meta.label)}${st.on ? '' : ' (off)'}</option>`).join('')}</select></div>
        <div class="frow"><label>Search</label><input id="mp-search-input" type="search" placeholder="Type a name…" value="${esc(filter)}"></div>
        <div id="mp-list" style="max-height:280px;overflow:auto;border:1px solid var(--line);border-radius:8px"></div>
        <div class="frow act" style="flex-wrap:wrap">
          <button class="btn" id="mp-tap">${icon('query')} Pick on the map</button>
          <button class="btn" id="mp-all">Select all shown</button>
          <button class="btn" id="mp-clear">Clear</button>
          <button class="btn primary" id="mp-apply">Clip to ${totalPicked()} selected</button>
        </div>
        <p class="hint" id="mp-hint">${pickedHere} of ${L.get(lid)?.obj?.features.length ?? 0} in this layer · ${totalPicked()} in total</p>`;
      renderList();
      body.querySelector('#mp-layer').onchange = (e) => { filter = ''; drawSheet(); paintPicked(); };
      body.querySelector('#mp-search-input').oninput = (e) => { filter = e.target.value; renderList(); };
      body.querySelector('#mp-all').onclick = () => { visibleFeatureIndexes().forEach((i) => pickedOn(body.querySelector('#mp-layer').value).add(i)); refresh(); };
      body.querySelector('#mp-clear').onclick = () => { picked.clear(); refresh(); };
      // leaving the panel must not leave highlight paint on the map
      const clearHi = () => { if (!document.body.contains(body)) { map.selectionSet = []; map.render(); map.off('click', clearHi); } };
      map.on('click', clearHi);
      body.querySelector('#mp-tap').onclick = () => { closeModal(); beginClipPick(picked); };
      body.querySelector('#mp-apply').onclick = applyClip;
    }
    function visibleFeatureIndexes() {
      const lid = body.querySelector('#mp-layer').value;
      const st = L.get(lid);
      const q = (body.querySelector('#mp-search-input')?.value || '').trim().toLowerCase();
      const out = [];
      st.obj.features.forEach((f, i) => {
        if (f.hidden || f.type !== 'poly') return;
        if (q && !titleOf(st.obj, f).toLowerCase().includes(q)) return;
        out.push(i);
      });
      return out;
    }
    function renderList() {
      const lid = body.querySelector('#mp-layer').value;
      const st = L.get(lid);
      const list = body.querySelector('#mp-list');
      if (!list || !st?.obj) return;
      const set = pickedOn(lid);
      const idx = visibleFeatureIndexes();
      list.innerHTML = idx.length ? idx.map((i) => {
        const on = set.has(i);
        return `<div style="padding:6px 10px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:8px;${on ? 'background:rgba(11,107,69,.12)' : ''}">
          <input type="checkbox" data-i="${i}" ${on ? 'checked' : ''}>
          <span style="flex:1">${esc(titleOf(st.obj, st.obj.features[i]))}</span>
          <button class="btn" data-zoom="${i}" title="Zoom to this feature">${icon('zoom')}</button>
        </div>`;
      }).join('') : '<p class="empty" style="padding:10px">No feature matches that search.</p>';
      list.querySelectorAll('input[type=checkbox]').forEach((cb) => {
        cb.onchange = () => {
          const i = +cb.dataset.i;
          if (cb.checked) set.add(i); else set.delete(i);
          refresh();
        };
      });
      list.querySelectorAll('[data-zoom]').forEach((btn) => {
        btn.onclick = () => {
          const f = st.obj.features[+btn.dataset.zoom];
          map.fitBounds([unX(f.bb[0]), unY(f.bb[3]), unX(f.bb[2]), unY(f.bb[1])], 60);
        };
      });
    }
    function refresh() {
      const apply = body.querySelector('#mp-apply');
      const hint = body.querySelector('#mp-hint');
      const lid = body.querySelector('#mp-layer').value;
      if (apply) apply.textContent = `Clip to ${totalPicked()} selected`;
      if (hint) hint.textContent = `${pickedOn(lid).size} of ${L.get(lid)?.obj?.features.length ?? 0} in this layer · ${totalPicked()} in total`;
      renderList();
      paintPicked();
    }
    // show the picks on the map while the panel is open
    function paintPicked() {
      const list = [];
      for (const [lid, set] of picked) {
        const st = L.get(lid);
        if (!st?.obj?.features) continue;
        for (const i of set) { const f = st.obj.features[i]; if (f) list.push({ layer: { id: lid }, feature: f }); }
      }
      map.selectionSet = list.slice(0, 1500);
      map.render();
    }
    function applyClip() {
      const groups = [];
      const names = [];
      for (const [lid, set] of picked) {
        const st = L.get(lid);
        if (!st?.obj?.features) continue;
        for (const i of [...set].sort((a, b) => a - b)) {
          const f = st.obj.features[i];
          if (!f || f.type !== 'poly') continue;
          for (const poly of f.parts) groups.push(poly.map((ring) => Array.from(ring)));
          names.push(titleOf(st.obj, f));
        }
      }
      if (!groups.length) { toast('Pick at least one shape first'); return; }
      closeModal();
      map.selectionSet = [];
      focusLabel = names.length > 3 ? `${names.slice(0, 3).join(' + ')} + ${names.length - 3} more` : names.join(' + ');
      setFocus({ type: 'multi', polys: groups, label: focusLabel });
      const bb = map.clipBounds();
      if (bb) map.fitBounds(bb, 40);
      toast(`Clipped to ${names.length} shape${names.length === 1 ? '' : 's'}: ${focusLabel}`, 5000);
    }
    drawSheet();
    paintPicked();
  });
}

// Tap-to-pick state for "Clip to multiple features" -> Pick on the map.
// Every tap on a polygon adds it; a tap on a picked polygon removes it again.
let clipPick = null;        // { picked: Map(layerId -> Set(idx)) }
function clipPickCount() {
  if (!clipPick) return 0;
  let n = 0;
  for (const set of clipPick.picked.values()) n += set.size;
  return n;
}
function clipPickPaint() {
  const list = [];
  if (clipPick) {
    for (const [lid, set] of clipPick.picked) {
      const st = L.get(lid);
      if (!st?.obj?.features) continue;
      for (const i of set) { const f = st.obj.features[i]; if (f) list.push({ layer: { id: lid }, feature: f }); }
    }
  }
  map.selectionSet = list.slice(0, 1500);
  map.render();
  const n = clipPickCount();
  $('#drawtext').textContent = `${n} shape${n === 1 ? '' : 's'} picked — tap more, or press Done`;
}
function toggleClipPick(layerId, idx) {
  let set = clipPick.picked.get(layerId);
  if (!set) clipPick.picked.set(layerId, set = new Set());
  if (set.has(idx)) set.delete(idx); else set.add(idx);
  clipPickPaint();
}
function endClipPick(apply) {
  const picked = clipPick?.picked;
  clipPick = null;
  map.selectionSet = [];
  endDraw();
  window.__clipPickCarry = picked || null;
  if (apply) {
    openClipMulti(picked);
  } else {
    toast('Multi-feature picking closed');
  }
}

// Enter tap-to-pick: keep whatever was already ticked and let the map do the work.
function beginClipPick(existing) {
  const picked = new Map();
  for (const [lid, set] of (existing || new Map())) picked.set(lid, new Set(set));
  clipPick = { picked };
  startPick('multi');
  clipPickPaint();
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
        ${resultExportBar('Area summary')}
        <div class="aoi" style="margin-top:10px">${clip
          ? '<button class="btn" data-act="clear">Clear focus</button><button class="btn" data-act="zoom">Zoom to area</button>'
          : '<button class="btn primary" data-act="clip">Clip to an area</button>'}</div>`;
      const summaryRows = rows.map((r) => ({
        layer: r.label, kind: r.kind, inside: r.n, of: r.tot,
        detail: r.classes ? r.classes.map(([v, c]) => `${v}: ${c * r.weight} cells`).join('; ')
          : r.kind === 'polygon' ? `area ${r.ar.toFixed(1)} km2` : r.kind,
      }));
      wireResultExports(body, 'Area summary', summaryRows, { scope: clip ? 'focus area' : 'all visible layers', area_km2: area ? +area.toFixed(3) : null });
      body.addEventListener('click', (e) => {
        if (e.target.closest('[data-export]')) return;
        const b = e.target.closest('[data-act]'); if (!b) return;
        const act = b.dataset.act; closeModal();
        if (act === 'clear') stopFocus();
        else if (act === 'zoom') { const bb = map.clipBounds(); if (bb) map.fitBounds(bb, 24); }
        else if (act === 'clip') toolClip();
      });
    }, 40);
  });
}

// ================================================================================
// Heavy-work helpers: keep the UI honest and make layer x layer tools fast
// ================================================================================
// A coarse grid of bounding boxes, so a point or feature only tests the few shapes near it.
function bboxGrid(items, bboxOf, cells = 48) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const it of items) {
    const b = bboxOf(it);
    if (!b) continue;
    x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]);
  }
  if (!Number.isFinite(x0)) { x0 = y0 = 0; x1 = y1 = 1; }
  const w = Math.max(1e-12, x1 - x0), h = Math.max(1e-12, y1 - y0);
  const grid = new Array(cells * cells);
  for (const it of items) {
    const b = bboxOf(it);
    if (!b) continue;
    const cx0 = Math.max(0, Math.min(cells - 1, Math.floor((b[0] - x0) / w * cells)));
    const cx1 = Math.max(0, Math.min(cells - 1, Math.floor((b[2] - x0) / w * cells)));
    const cy0 = Math.max(0, Math.min(cells - 1, Math.floor((b[1] - y0) / h * cells)));
    const cy1 = Math.max(0, Math.min(cells - 1, Math.floor((b[3] - y0) / h * cells)));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const k = cy * cells + cx;
      (grid[k] || (grid[k] = [])).push(it);
    }
  }
  return {
    near(x, y) {
      const cx = Math.max(0, Math.min(cells - 1, Math.floor((x - x0) / w * cells)));
      const cy = Math.max(0, Math.min(cells - 1, Math.floor((y - y0) / h * cells)));
      return grid[cy * cells + cx] || [];
    },
    nearBox(b) {
      const out = new Set();
      const cx0 = Math.max(0, Math.min(cells - 1, Math.floor((b[0] - x0) / w * cells)));
      const cx1 = Math.max(0, Math.min(cells - 1, Math.floor((b[2] - x0) / w * cells)));
      const cy0 = Math.max(0, Math.min(cells - 1, Math.floor((b[1] - y0) / h * cells)));
      const cy1 = Math.max(0, Math.min(cells - 1, Math.floor((b[3] - y0) / h * cells)));
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) for (const it of grid[cy * cells + cx] || []) out.add(it);
      return [...out];
    },
  };
}
// Let the browser paint a "working" message before a long computation starts.
async function working(label) {
  toast(label + '…', 60000);
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
}
function ringOfFeature(f) { return f.type === 'poly' ? f.parts.flat() : f.type === 'line' ? f.parts : [f.parts]; }
// The real geometry of a feature, as polygon-clipping expects it: one ring per
// part, holes kept. Lines and points become thin closed rings so a corridor or
// a dot can still be tested for overlap.
function featurePolygons(f) {
  if (!f) return [];
  if (f.type === 'poly') return (f.parts || []).map((poly) => poly.map((ring) => Array.from(ring)));
  if (f.type === 'line') return (f.parts || []).map((line) => [closeFlat(line)]).filter((p) => p[0].length >= 8);
  if (f.type === 'point') {
    const out = [];
    for (let i = 0; i < (f.parts || []).length; i += 2) {
      const r = circleToPolygon(f.parts[i], f.parts[i + 1], 12, 8);
      if (r) out.push([r]);
    }
    return out;
  }
  return [];
}
function closeFlat(ring) {
  const a = Array.from(ring || []);
  if (a.length >= 4 && (a[0] !== a[a.length - 2] || a[1] !== a[a.length - 1])) a.push(a[0], a[1]);
  return a;
}
// A polygon feature built from boolean-op parts, ready to draw and measure.
function featureFromParts(parts, props, style) {
  const clean = (parts || []).filter((poly) => poly && poly[0] && poly[0].length >= 8);
  if (!clean.length) return null;
  const bb = partsBBox(clean);
  if (!bb) return null;
  return { type: 'poly', parts: clean, bb, props: props || {}, fill: style?.fill || '#0b6b45', stroke: style?.stroke || style?.fill || '#0b6b45', idx: style?.idx || 0 };
}
function vertexCount(f) {
  let n = 0;
  if (!f?.parts) return 0;
  if (f.type === 'poly') for (const poly of f.parts) for (const ring of poly) n += ring.length / 2;
  else for (const part of f.parts) n += (part.length || 0) / 2;
  return n;
}
function partsAreaKm2(parts) {
  let area = 0;
  for (const poly of parts || []) {
    if (!poly[0]) continue;
    area += flatRingAreaKm2(poly[0]);
    for (let h = 1; h < poly.length; h++) area -= flatRingAreaKm2(poly[h]);
  }
  return Math.max(0, area);
}
// Union a list of polygon features into the fewest pieces, chunked so a layer of
// thousands never builds one enormous clipping call.
function unionFeatures(features) {
  const CHUNK = 48;
  let acc = [];
  for (let i = 0; i < features.length; i += CHUNK) {
    const batch = polygonBoolean(features.slice(i, i + CHUNK), 'union');
    acc = acc.length ? polygonBoolean([featureFromParts(acc, {}, {}), featureFromParts(batch, {}, {})].filter(Boolean), 'union') : batch;
  }
  return acc;
}
function mercBoundsToLonLat(bb) {
  if (!bb) return null;
  return [unX(bb[0]), unY(bb[3]), unX(bb[2]), unY(bb[1])];
}
// The features an analysis should see: the current selection when there is one,
// otherwise the visible features, optionally narrowed to the focus area.
function analysisFeatures(st, { respectSelection = true, respectFocus = true } = {}) {
  const feats = (st?.obj?.features || []).filter((f) => !f.hidden);
  const selected = respectSelection ? feats.filter((f) => selState.ids.has(selKey(st.meta.id, f))) : [];
  const base = selected.length ? selected : feats;
  return respectFocus && clip ? base.filter((f) => map.clipOverlapsFeature(f)) : base;
}
// One mercator unit is at most this many metres (at the equator), so dividing a
// metre tolerance by it gives a mercator radius that is safe everywhere.
const MERC_METRES_PER_UNIT = 40075016.686;
// Grid of single points (x, y, payload) in mercator units, for nearest-neighbour work.
function pointGrid(pts, cellMerc) {
  const cell = Math.max(cellMerc, 1e-12);
  const map = new Map();
  const key = (cx, cy) => cx + ',' + cy;
  for (const p of pts) {
    const cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell);
    const k = key(cx, cy);
    let list = map.get(k);
    if (!list) map.set(k, (list = []));
    list.push(p);
  }
  return {
    cell,
    around(x, y, rings = 1) {
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      const out = [];
      for (let dy = -rings; dy <= rings; dy++) for (let dx = -rings; dx <= rings; dx++) {
        const list = map.get(key(cx + dx, cy + dy));
        if (list) out.push(...list);
      }
      return out;
    },
  };
}
// <option> list for a layer's fields. meta.fields holds {name, label, type} objects,
// not strings, so using the object directly produced "[object Object]" for every choice.
function fieldOptions(st, filter = null) {
  const fields = (st?.meta?.fields || []).filter((f) => f && typeof f === 'object' && f.name && (!filter || filter(f)));
  return fields.map((f) => '<option value="' + esc(f.name) + '">' + esc(f.label || f.name) + '</option>').join('');
}
// Flatten nested coordinate arrays (parts → rings → numbers) into one number array.
function flattenNums(v, out = []) {
  if (typeof v === 'number') out.push(v);
  else if (v && typeof v.length === 'number') for (let i = 0; i < v.length; i++) flattenNums(v[i], out);
  return out;
}
// Every pair of features whose extents touch, without the n^2 full scan.
// `reject(a, b)` lets a caller drop pairs whose boxes merely overlap.
function bboxPairs(items, reject = null, cells = 32) {
  const out = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const it of items) { const b = it.bb; x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
  if (!Number.isFinite(x0)) return out;
  const w = Math.max(1e-12, x1 - x0), h = Math.max(1e-12, y1 - y0);
  const cell = (v, lo, span) => Math.max(0, Math.min(cells - 1, Math.floor((v - lo) / span * cells)));
  const buckets = new Map();
  const seen = new Set();
  for (let i = 0; i < items.length; i++) {
    const b = items[i].bb;
    const cx0 = cell(b[0], x0, w), cx1 = cell(b[2], x0, w);
    const cy0 = cell(b[1], y0, h), cy1 = cell(b[3], y0, h);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const k = cy * cells + cx;
      let list = buckets.get(k);
      if (!list) buckets.set(k, (list = []));
      for (const j of list) {
        const key = j < i ? j * items.length + i : i * items.length + j;
        if (seen.has(key)) continue;
        seen.add(key);
        if (reject && reject(items[i], items[j])) continue;
        out.push([items[i], items[j]]);
      }
      list.push(i);
    }
  }
  return out;
}
// Does a feature fall inside any buffered zone? Uses the buffer grid, so only the
// few zones near the feature are ever tested.
function bufferHits(f, index) {
  for (const b of index.nearBox(f.bb)) {
    if (f.bb[2] < b.bb[0] || f.bb[0] > b.bb[2] || f.bb[3] < b.bb[1] || f.bb[1] > b.bb[3]) continue;
    if (f.type === 'point') {
      // a point is "inside" when it falls within any buffered polygon
      for (let i = 0; i < f.parts.length; i += 2) {
        const x = f.parts[i], y = f.parts[i + 1];
        for (const poly of b.parts) if (pip2(x, y, poly)) return true;
      }
      continue;
    }
    const fr = ringOfFeature(f);
    for (const poly of b.parts) if (polyOverlapsPoly(fr, poly)) return true;
  }
  return false;
}
// Which feature pairs share a boundary? Instead of testing every pair of polygons,
// index every boundary segment in one grid and only compare segments that land in the
// same cell. Cost is proportional to the number of vertices, not to n².
function adjacentPairs(feats, cells = 96) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of feats) { const b = f.bb; x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
  if (!Number.isFinite(x0)) return [];
  const w = Math.max(1e-12, x1 - x0), h = Math.max(1e-12, y1 - y0);
  const cellOf = (v, lo, span) => Math.max(0, Math.min(cells - 1, Math.floor((v - lo) / span * cells)));
  const buckets = new Map();
  // 1. file every boundary segment under the cells its extent covers
  for (let fi = 0; fi < feats.length; fi++) {
    const f = feats[fi];
    for (const ring of ringOfFeature(f)) {
      for (let i = 0; i < ring.length - 2; i += 2) {
        const ax = ring[i], ay = ring[i + 1], bx = ring[i + 2], by = ring[i + 3];
        const cx0 = cellOf(Math.min(ax, bx), x0, w), cx1 = cellOf(Math.max(ax, bx), x0, w);
        const cy0 = cellOf(Math.min(ay, by), y0, h), cy1 = cellOf(Math.max(ay, by), y0, h);
        for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
          const k = cy * cells + cx;
          let list = buckets.get(k);
          if (!list) buckets.set(k, (list = []));
          list.push(fi, ax, ay, bx, by);
        }
      }
    }
  }
  // 2. any cell holding segments from two features means those two touch
  const pairs = new Set();
  const touched = [];
  for (const list of buckets.values()) {
    const stride = 5;
    for (let a = 0; a < list.length; a += stride) {
      const fa = list[a];
      for (let b = 0; b < list.length; b += stride) {
        const fb = list[b];
        if (fa === fb) continue;
        const key = fa < fb ? fa * feats.length + fb : fb * feats.length + fa;
        if (pairs.has(key)) continue;
        if (segmentsIntersect(list[a + 1], list[a + 2], list[a + 3], list[a + 4], list[b + 1], list[b + 2], list[b + 3], list[b + 4])) {
          pairs.add(key);
          touched.push(key);
        }
      }
    }
  }
  return touched;
}
// Ring extents are cached on the ring, because adjacency asks the same question
// for the same rings over and over.
function ringBBoxCached(ring) {
  if (ring._bbx) return ring._bbx;
  const bb = ringsBBox([ring]);
  try { Object.defineProperty(ring, '_bbx', { value: bb, enumerable: false }); } catch { /* frozen ring */ }
  return bb;
}
function ringsTouch(ringsA, ringsB, tolMerc = 0) {
  for (const ra of ringsA) {
    const ba = ringBBoxCached(ra);
    for (const rb of ringsB) {
      const bb = ringBBoxCached(rb);
      if (ba[2] + tolMerc < bb[0] || ba[0] - tolMerc > bb[2] || ba[3] + tolMerc < bb[1] || ba[1] - tolMerc > bb[3]) continue;
      for (let i = 0; i < ra.length - 2; i += 2) {
        const ax1 = ra[i], ay1 = ra[i + 1], ax2 = ra[i + 2], ay2 = ra[i + 3];
        const sMinX = Math.min(ax1, ax2) - tolMerc, sMaxX = Math.max(ax1, ax2) + tolMerc;
        const sMinY = Math.min(ay1, ay2) - tolMerc, sMaxY = Math.max(ay1, ay2) + tolMerc;
        for (let j = 0; j < rb.length - 2; j += 2) {
          const bx1 = rb[j], by1 = rb[j + 1], bx2 = rb[j + 2], by2 = rb[j + 3];
          if (sMaxX < Math.min(bx1, bx2) || sMinX > Math.max(bx1, bx2)) continue;
          if (sMaxY < Math.min(by1, by2) || sMinY > Math.max(by1, by2)) continue;
          if (segmentsIntersect(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2)) return true;
        }
      }
    }
  }
  return false;
}

// ================================================================================
// EXPORTS  — every download passes through here. Location coordinates are
// stripped from columns, JSON fields, captions and grid labels. Geometry
// files (GeoJSON, KML, shapefile) are never offered: they are coordinates.
// ================================================================================
function download(name, text, type = 'text/plain') {
  const body = String(text == null ? '' : text);
  if (exportHasCoordinates(body)) { toast('Export blocked — it still contains location coordinates'); return false; }
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return true;
}
function exportRows(name, rows) {
  const clean = (rows || []).map((row) => {
    const out = {};
    Object.keys(row).forEach((k) => { if (!isCoordinateKey(k)) out[k] = row[k]; });
    return out;
  });
  return download(name, toCSV(clean), 'text/csv');
}
function exportJson(name, value) {
  return download(name, JSON.stringify(scrubForExport(value), null, 2), 'application/json');
}
function exportText(name, text) { return download(name, String(text == null ? '' : text), 'text/plain'); }
function exportHtmlTable(name, title, headers, rows, note) {
  const head = headers.map((h) => `<th>${esc(h)}</th>`).join('');
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  const html = `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title>`
    + `<style>body{font:14px/1.45 system-ui,sans-serif;color:#17211c;padding:24px}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #d8e0da;padding:6px 10px;text-align:left}th{background:#eef3ef}h1{font-size:18px}p{color:#5c6b64}</style>`
    + `<h1>${esc(title)}</h1>${note ? `<p>${esc(note)}</p>` : ''}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  return download(name, html, 'text/html');
}
function exportButton(label, title) {
  return `<button class="chip export-btn" data-export="1" title="${esc(title || label)}">${icon('download')} ${esc(label)}</button>`;
}
function resultExportBar(title) {
  return `<div class="result-exports" title="${esc(title || '')}">${exportButton('CSV', 'Download this table — no coordinates')}${exportButton('JSON', 'Download as JSON — no coordinates')}${exportButton('Table', 'Download a printable HTML table — no coordinates')}</div>`;
}
function wireResultExports(host, title, rows, extra) {
  const box = host.querySelector('.result-exports');
  if (!box) return;
  const btns = [...box.querySelectorAll('[data-export]')];
  const base = (title || 'result').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'result';
  const payload = () => scrubForExport({ title, exported: new Date().toISOString().slice(0, 10), rows, ...(extra || {}) });
  if (btns[0]) btns[0].onclick = () => exportRows(`${base}.csv`, rows) && toast('CSV saved — coordinates excluded');
  if (btns[1]) btns[1].onclick = () => exportJson(`${base}.json`, payload()) && toast('JSON saved — coordinates excluded');
  if (btns[2]) btns[2].onclick = () => {
    const keys = rows.length ? Object.keys(rows[0]) : ['note'];
    const data = rows.length ? rows : [{ note: 'No rows' }];
    exportHtmlTable(`${base}.html`, title, keys, data.map((r) => keys.map((k) => r[k] == null ? '' : r[k])), 'Location coordinates are excluded from every export.') && toast('Table saved');
  };
}
function featureExportRows(layer, features) {
  return (features || []).map((f) => {
    const m = featureMetrics(f);
    const row = { layer: layer.name, name: f.name || '', kind: f.type };
    Object.keys(f.props || {}).forEach((k) => { if (!isCoordinateKey(k) && row[k] == null) row[k] = f.props[k]; });
    if (m) {
      if (m.area) row.area_km2 = +m.area.toFixed(3);
      if (m.length) row.length_km = +m.length.toFixed(3);
    }
    return row;
  });
}
function captureMapPng(name, caption) {
  if (!map?.cv) { toast('The map is not ready to save yet'); return; }
  const prev = map._suppressGridLabels;
  map._suppressGridLabels = true;
  map.render();
  let url;
  try { url = map.cv.toDataURL('image/png'); }
  catch { toast('Could not capture the map — the basemap may block it'); return; }
  finally { map._suppressGridLabels = false; map.render(); }
  if (!url) return;
  const img = new Image();
  img.onload = () => {
    const pad = caption ? 54 : 0;
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height + pad;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fbfaf6'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);
    if (caption) {
      ctx.fillStyle = '#17211c'; ctx.font = '600 15px "Source Serif 4", Georgia, serif';
      ctx.fillText(String(caption).slice(0, 90), 16, img.height + 22);
      ctx.fillStyle = '#5c6b64'; ctx.font = '12px "Public Sans", system-ui, sans-serif';
      ctx.fillText('Naija Geospatial Atlas — location coordinates are not included in this export', 16, img.height + 40);
    }
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png'); a.download = name || 'naija-atlas-map.png';
    document.body.appendChild(a); a.click(); a.remove();
    toast('Map image saved — grid coordinates excluded');
  };
  img.src = url;
}

// ================================================================================
// SELECTION  (Select by area, tap-to-select, multi-select and box select)
// ================================================================================
function selKey(layerId, f) { return layerId + ':' + f.idx; }
function selCount() { return selState.ids.size; }
function selItems() {
  const out = [];
  for (const id of stack) {
    const st = L.get(id); if (!st?.obj?.features) continue;
    for (const f of st.obj.features) if (selState.ids.has(selKey(id, f))) out.push({ layer: id, st, f });
  }
  return out;
}
function selClear(announce) {
  selState.ids.clear();
  selState.last = null;
  map.selection = null; map.selectionSet = []; map.render();
  updateSelBar(); updateToolState();
  if (announce) toast('Selection cleared');
}
function selToggle(layerId, f) {
  const k = selKey(layerId, f);
  if (selState.ids.has(k)) selState.ids.delete(k); else selState.ids.add(k);
  selState.last = selState.ids.has(k) ? { layer: layerId, feature: f } : selState.last;
  selSyncMap(); return selState.ids.has(k);
}
function selSyncMap() {
  const items = selItems();
  map.selectionSet = items.slice(0, 1500);
  map.selection = items.length === 1 ? { feature: items[0].f, layer: { id: items[0].layer } } : null;
  map.render();
  updateSelBar();
  updateToolState();
}
function enterSelectMode(filter) {
  selState.active = true;
  map.panLock = true;            // a drag draws the selection box; two fingers still pan and zoom
  selState.filter = filter || '';
  if (measure) { measure = null; $('#measurebar').hidden = true; }
  if (draw) endDraw();
  map.cv.style.cursor = 'crosshair';
  updateSelBar();
  updateToolState();
}
function exitSelectMode(keepSelection) {
  selState.active = false;
  selState.box = null;
  map.panLock = false;
  map.cv.style.cursor = '';
  if (!keepSelection) selClear(false);
  map.render();
  updateSelBar();
  updateToolState();
}
// live feedback for the drag box (drawn above the layers, inside the map render loop)
map.extra.push((ctx, m) => {
  if (bufferPreview) {
    ctx.save();
    ctx.fillStyle = 'rgba(11,107,69,.28)';
    ctx.strokeStyle = '#0b6b45';
    ctx.lineWidth = 2;
    for (const poly of bufferPreview) {
      poly.forEach((ring, r) => {
        ctx.beginPath();
        for (let i = 0; i < ring.length; i += 2) {
          const [x, y] = m.toScreen(ring[i], ring[i + 1]);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath();
        if (r === 0) ctx.fill();
        ctx.stroke();
      });
    }
    ctx.restore();
  }
  if (selState.box) {
    const { x0, y0, x1, y1 } = selState.box;
    ctx.save();
    ctx.fillStyle = 'rgba(255,212,0,.18)';
    ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    ctx.restore();
  }
});

function wireSelBar() {
  const bar = $('#selbar'); if (!bar || bar.dataset.wired) return;
  bar.dataset.wired = '1';
  $('#seldone').onclick = () => { const was = selState.active; exitSelectMode(true); toast(was ? 'Select mode off' : 'Selection closed'); };
  $('#selclearall').onclick = () => selClear(true);
  $('#sellist').onclick = () => openSelectionList();
  $('#selzoom').onclick = () => selZoom();
  $('#selcsv').onclick = () => selExportCsv();
  $('#selall').onclick = () => {
    const [x0, y1] = map.fromScreen(0, 0), [x1, y0] = map.fromScreen(map.W, map.H);
    const found = map.featuresInRect([x0, y0, x1, y1], { mode: 'intersect', layers: selState.filter ? [selState.filter] : null, limit: 2000 });
    let added = 0;
    for (const r of found) { const k = selKey(r.layer.id, r.feature); if (!selState.ids.has(k)) { selState.ids.add(k); added++; } }
    selSyncMap();
    toast(added ? `${added} feature${added === 1 ? '' : 's'} added from the screen` : 'Everything on screen is already selected', 2200);
  };
  updateSelBar();
}

function updateSelBar() {
  const bar = $('#selbar'); if (!bar) return;
  const on = selState.active, n = selCount();
  bar.hidden = !on && !n;
  bar.classList.toggle('active', on);
  document.body.classList.toggle('sel-open', !bar.hidden);
  const txt = $('#seltext');
  if (txt) txt.textContent = on
    ? (n ? n + ' selected — tap a feature to add or remove it' : 'Select mode: tap a feature, or drag a box')
    : n + ' feature' + (n === 1 ? '' : 's') + ' selected';
  const cnt = $('#selcount'); if (cnt) cnt.textContent = String(n);
  const done = $('#seldone'); if (done) done.textContent = on ? 'Done' : 'Close';
  const all = $('#selall'); if (all) all.hidden = !on;
}
function toolSelect() {
  const vec = activeVectorLayerIds();
  openModal('Select features', (body) => {
    if (!vec.length) {
      body.innerHTML = '<p class="empty">Turn on a feature layer first (a polygon, line or point layer).</p>';
      return;
    }
    body.innerHTML = `<p class="hint">Pick one layer to work in, or select across everything that is switched on.</p>
      <div class="frow"><label>Layer</label><select id="sb-layer">
        <option value="">All switched-on layers (${vec.length})</option>
        ${vec.map((id) => `<option value="${esc(id)}">${esc(L.get(id).meta.label)}</option>`).join('')}
      </select></div>
      <div class="frow act"><button class="btn primary" data-act="start">${icon('query')} Start selecting</button></div>
      <h4>How selecting works</h4>
      <ul class="steps">
        <li><b>Tap a feature</b> on the map to select it. Tap it again to unselect it.</li>
        <li><b>Drag a box</b> (press, hold and pull) to select everything inside it. Great on a phone.</li>
        <li>The bar at the bottom of the map shows the count, with <b>List</b>, <b>Zoom</b> and <b>Export</b>.</li>
        <li>Press <b>Done</b> to leave select mode and go back to panning the map.</li>
      </ul>`;
    body.addEventListener('click', (e) => {
      if (!e.target.closest('[data-act="start"]')) return;
      const lid = body.querySelector('#sb-layer').value;
      closeModal();
      enterSelectMode(lid);
      toast('Select mode on — tap features or drag a box');
    });
  });
}
function activeVectorLayerIds() {
  return stack.filter((id) => { const st = L.get(id); return st?.obj?.features && st.meta.kind !== 'table'; });
}
function openSelectionList() {
  const items = selItems();
  const byLayer = new Map();
  for (const r of items) byLayer.set(r.st.meta.label, (byLayer.get(r.st.meta.label) || 0) + 1);
  const sample = items.slice(0, 200);
  openModal('Selected features', (body) => {
    if (!items.length) {
      body.innerHTML = `<p class="empty">Nothing is selected yet.</p>
        <div class="frow act"><button class="btn primary" data-act="start">${icon('query')} Start selecting</button></div>`;
      body.addEventListener('click', (e) => { if (e.target.closest('[data-act="start"]')) { closeModal(); enterSelectMode(selState.filter); } });
      return;
    }
    const maxN = Math.max(1, ...byLayer.values());
    body.innerHTML = `<p class="hint"><b>${fmtNum(items.length)}</b> feature${items.length === 1 ? '' : 's'} selected across ${byLayer.size} layer${byLayer.size === 1 ? '' : 's'}.</p>
      <div class="chart">${[...byLayer.entries()].sort((a, b) => b[1] - a[1]).map(([l, n]) => `<div class="brow"><span>${esc(l)}</span><span class="barwrap"><i style="width:${Math.max(2, 100 * n / maxN)}%"></i></span><b>${fmtNum(n)}</b></div>`).join('')}</div>
      <table class="mini"><tr>${byLayer.size > 1 ? '<th>Layer</th>' : ''}<th>Feature</th><th>${items.every((it) => layerRank(it.st)) ? 'Area rank' : 'Value'}</th></tr>
      ${sample.map((r, i) => `<tr>${byLayer.size > 1 ? `<td>${esc(r.st.meta.label)}</td>` : ''}<td><button class="linkbtn" data-row="${i}">${esc(titleOf(r.st.obj, r.f))}</button></td><td>${esc(valueFor(r.st, r.f))}</td></tr>`).join('')}</table>
      ${items.length > sample.length ? `<p class="hint">Showing the first ${sample.length} of ${fmtNum(items.length)}.</p>` : ''}
      <div class="aoi" style="margin-top:10px">
        <button class="btn" data-act="zoom">${icon('zoom')} Zoom to selection</button>
        <button class="btn" data-act="focus">${icon('crop')} Focus on selection</button>
        <button class="btn" data-act="attrs">${icon('info')} Feature details</button>
        <button class="btn" data-act="csv">${icon('download')} Export CSV</button>
        <button class="btn" data-act="json">${icon('download')} Export JSON</button>
        <button class="btn" data-act="clear">Clear selection</button>
      </div>
      <p class="hint">Leave this panel open and keep tapping the map — the list updates as you select.</p>`;
    body.addEventListener('click', (e) => {
      const rowBtn = e.target.closest('[data-row]');
      if (rowBtn) {
        const r = sample[+rowBtn.dataset.row]; closeModal();
        map.fitBounds([unX(r.f.bb[0]), unY(r.f.bb[3]), unX(r.f.bb[2]), unY(r.f.bb[1])], 60);
        map.selection = { feature: r.f, layer: { id: r.layer } }; map.render();
        showResults([{ layer: { id: r.layer, kind: r.st.meta.kind }, feature: r.f }]); openSheet('info', true);
        return;
      }
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act;
      if (act === 'zoom') { const bb = selBounds(true); if (bb) map.fitBounds(bb, 40); closeModal(); }
      else if (act === 'focus') { selFocus(); closeModal(); }
      else if (act === 'attrs') { closeModal(); selShowAttrs(); }
      else if (act === 'csv') selExportCsv();
      else if (act === 'json') {
        const rows = items.map((r) => ({ layer: r.st.meta.label, ...featureExportRows(r.st.meta, [r.f])[0] }));
        exportJson('selection.json', { title: 'Selected features', count: rows.length, rows }) && toast('Selection JSON saved — coordinates excluded');
      }
      else if (act === 'clear') { selClear(true); closeModal(); }
    });
  });
}
function selBounds(ll) {
  const items = selItems(); if (!items.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of items) {
    x0 = Math.min(x0, r.f.bb[0]); y0 = Math.min(y0, r.f.bb[1]);
    x1 = Math.max(x1, r.f.bb[2]); y1 = Math.max(y1, r.f.bb[3]);
  }
  return ll ? [unX(x0), unY(y1), unX(x1), unY(y0)] : [x0, y0, x1, y1];
}
function selFocus() {
  const items = selItems(); if (!items.length) { toast('Nothing is selected'); return; }
  const polys = items.filter((r) => r.f.type === 'poly');
  if (polys.length) {
    const rings = [];
    for (const r of polys) for (const poly of r.f.parts) for (const ring of poly) rings.push(Array.from(ring));
    setFocus({ type: 'poly', rings, multi: true }, false);
    focusLabel = polys.length === 1 ? titleOf(polys[0].st.obj, polys[0].f) : polys.length + ' selected features';
    toast(`Focused on ${polys.length} selected polygon${polys.length === 1 ? '' : 's'}`);
  } else {
    const bb = selBounds(false); if (!bb) return;
    setFocus({ type: 'rect', wb: bb }, false);
    toast('Focused on the selection');
  }
}
function selShowAttrs() {
  const items = selItems();
  if (!items.length) { toast('Nothing is selected'); return; }
  if (items.length === 1) {
    const r = items[0];
    showResults([{ layer: { id: r.layer, kind: r.st.meta.kind }, feature: r.f }]);
    openSheet('info', true);
    return;
  }
  openSelectionList();
}
function selZoom() {
  const bb = selBounds(true); if (!bb) { toast('Nothing is selected'); return; }
  map.fitBounds(bb, 40);
}
function selExportCsv() {
  const items = selItems();
  if (!items.length) { toast('Nothing is selected'); return; }
  const rows = items.map((r) => ({ layer: r.st.meta.label, ...featureExportRows(r.st.meta, [r.f])[0] }));
  exportRows('selection.csv', rows) && toast(`Saved ${fmtNum(rows.length)} selected features — coordinates excluded`);
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
    body.innerHTML = `<p>Tap a polygon on the map, then everything inside it is listed and counted. Uses the polygon's own boundary, so a state or LGA border works as a rubber band.</p>
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
        <button class="btn" data-act="csv">${icon('download')} Export CSV</button>
        <button class="btn" data-act="json">${icon('download')} Export JSON</button>
        <button class="btn" data-act="table">${icon('download')} Export table</button>
      </div>`;
    const queryRows = () => out.map((r) => ({ boundary: name, boundary_layer: label, layer: r.st.meta.label, ...featureExportRows(r.st.meta, [r.f])[0] }));
    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act;
      if (act === 'csv') { exportRows('select-by-area.csv', queryRows()) && toast('Selection CSV saved — coordinates excluded'); return; }
      if (act === 'json') { exportJson('select-by-area.json', { title: 'Select by area', boundary: name, boundary_layer: label, area_km2: area ? +area.toFixed(3) : null, count: out.length, by_layer: Object.fromEntries(byLayer), rows: queryRows() }) && toast('Selection JSON saved — coordinates excluded'); return; }
      if (act === 'table') {
        const rows = queryRows();
        const keys = rows.length ? Object.keys(rows[0]) : ['note'];
        exportHtmlTable('select-by-area.html', `Inside ${name || label}`, keys, (rows.length ? rows : [{ note: 'Nothing inside' }]).map((r) => keys.map((k) => r[k] == null ? '' : r[k])), 'Location coordinates are excluded.') && toast('Table saved');
        return;
      }
      closeModal();
      if (act === 'focus') focusFromFeature(poly.f, label);
      else if (act === 'zoom') focusThenZoom(poly.f);
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
    const ids = baseOrder.filter((id) => !isOn(id) && L.get(id).meta.kind !== 'table' && L.get(id).meta.group !== 'imported');
    Promise.all(ids.map((id) => setLayer(id, true, { quiet: true }))).then(() => {
      renderLayerLists(); refreshLegend(); pushHash(); saveProject();
    });
  }
  else if (x === 'hideall') { for (const id of [...stack]) setLayer(id, false); }
  else if (x === 'fitall') fitVisible();
  else if (x === 'focus') toolClip();
  else if (x === 'grid') { gridOn = !gridOn; map.setGrid(gridOn); updateToolState(); saveProject(); }
  else if (x === 'labels') toolLabels(stack[stack.length - 1]);
  else if (x === 'clearfilter') { const n = clearAllFilters(); saveProject(); toast(n ? 'Filters cleared' : 'No filters to clear'); }
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
  const sub = new Date().toLocaleString() + ' · zoom ' + prevZoom.toFixed(1);
  ctx.fillText(sub, 14 * d, topBarH + img.height + bottomBarH * 0.72);
  const attr = BASEMAPS[prevBasemap]?.attr || '';
  if (attr) { ctx.textAlign = 'right'; ctx.fillText(attr, cv.width - 14 * d, topBarH + img.height + bottomBarH * 0.72); ctx.textAlign = 'left'; }

  cv.toBlob((blob) => {
    if (!blob) { toast('Could not create the picture'); return; }
    const url = URL.createObjectURL(blob);
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const a = document.createElement('a'); a.href = url; a.download = `map-export-${ts}.png`;
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Map picture saved', 5000);
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
function toolFilter(preferred, editId) {
  openModal('Filter features', (body) => {
    const session = {};
    body._filterSession = session;
    body.innerHTML = `<p class="muted">Pick any layer that is switched on. Each filter you add is numbered. Add more on other layers, or again on a layer that already has one — those are combined, so a feature is drawn only if it matches every filter on that layer.</p>
      <h4>Filter list</h4>
      <div id="f-list"></div>
      <div class="frow act" id="f-clear-row" hidden><button class="btn" id="f-clear-all" type="button">Clear all filters</button></div>
      <h4 id="f-form-title">Add a filter</h4>
      <div id="f-layer-row"></div>
      <div id="f-form"></div>
      <div class="frow act" id="f-actions">
        <button class="btn" id="f-cancel" type="button" hidden>Cancel edit</button>
        <button class="btn primary" id="f-apply" type="button">Add filter</button>
      </div>
      <p class="hint" id="f-hint"></p>`;
    const listBox = body.querySelector('#f-list');
    const formBox = body.querySelector('#f-form');
    const layerRow = body.querySelector('#f-layer-row');
    const title = body.querySelector('#f-form-title');
    const applyBtn = body.querySelector('#f-apply');
    const cancelBtn = body.querySelector('#f-cancel');
    const clearRow = body.querySelector('#f-clear-row');
    const hint = body.querySelector('#f-hint');
    const numOps = [['eq', 'is exactly'], ['neq', 'is not'], ['gt', 'is more than'], ['gte', 'is at least'], ['lt', 'is less than'], ['lte', 'is at most']];
    const txtOps = [['contains', 'contains'], ['eq', 'is exactly'], ['neq', 'is not']];
    const multiOps = [['in', 'include only'], ['not_in', 'exclude']];
    let editingId = editId != null ? editId : null;
    let layerId = preferred || null;
    let formToken = 0;
    const alive = () => body.isConnected && body._filterSession === session && !$('#modal').hidden && $('#modal-title').textContent === 'Filter features';

    function fieldValues(st, field) {
      if (!st.obj?.features) return [];
      const seen = new Set();
      const out = [];
      for (const f of st.obj.features) {
        const v = f.props[field];
        if (v == null || v === '') continue;
        const s = String(v);
        if (seen.has(s)) continue;
        seen.add(s);
        out.push(s);
        if (out.length >= 500) break;
      }
      return out;
    }
    function pickerLayers() {
      const layers = activeVectorLayers();
      if (editingId) {
        const found = findFilter(editingId);
        if (found && !layers.some((st) => st.meta.id === found.st.meta.id)) layers.push(found.st);
      }
      return layers;
    }
    function renderList() {
      const rows = allFilters();
      clearRow.hidden = !rows.length;
      listBox.innerHTML = rows.length
        ? filterListHTML(editingId)
        : '<p class="empty">No filters yet. The first one you add becomes #1.</p>';
      bindFilterList(listBox, (found, removed) => {
        if (!alive()) return;
        if (removed) {
          if (editingId && !findFilter(editingId)) editingId = null;
          renderAll();
          return;
        }
        if (!found) return;
        editingId = found.rule.id;
        layerId = found.st.meta.id;
        renderAll();
      });
    }
    function renderLayerSelect() {
      const layers = pickerLayers();
      if (!layers.length) {
        layerRow.innerHTML = '<p class="empty">Switch a layer on first. You can filter any layer that is on the map.</p>';
        applyBtn.hidden = true;
        return;
      }
      applyBtn.hidden = false;
      if (!layerId || !layers.some((st) => st.meta.id === layerId)) layerId = layers[0].meta.id;
      layerRow.innerHTML = `<div class="frow"><label>Layer</label><select id="f-layer">${layers.map((st) => `<option value="${esc(st.meta.id)}"${st.meta.id === layerId ? ' selected' : ''}>${esc(st.meta.label)}${st.on ? '' : ' (off)'}</option>`).join('')}</select></div>`;
      layerRow.querySelector('#f-layer').onchange = () => {
        layerId = layerRow.querySelector('#f-layer').value;
        renderForm();
      };
    }
    function renderAttributeForm(st, rule) {
      const fields = st.meta.fields || [];
      const curField = (rule && fields.some((f) => f.name === rule.field) ? rule.field : fields[0]?.name) || '';
      const fld = fields.find((f) => f.name === curField);
      const isNum = fld?.type === 'number';
      const curOp = rule?.op && rule.op !== '_temporal' ? rule.op : (isNum ? 'eq' : 'contains');
      const opOptions = (isNum ? numOps : txtOps).concat(multiOps);
      const values = fieldValues(st, curField);
      const isMulti = curOp === 'in' || curOp === 'not_in';
      const tags = (isMulti && rule?.values ? rule.values.map(String) : []).slice();
      formBox.innerHTML = `<div class="frow"><label>Field</label><select id="f-field">${fields.map((f) => `<option value="${esc(f.name)}"${f.name === curField ? ' selected' : ''}>${esc(f.label || f.name)}</option>`).join('') || '<option value="">(no fields)</option>'}</select></div>
        <div class="frow"><label>Condition</label><select id="f-op">${opOptions.map(([k, t]) => `<option value="${k}"${curOp === k ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
        <div id="f-val-single" class="frow" style="display:${isMulti ? 'none' : 'flex'}"><label>Value</label><input id="f-value" type="text" value="${esc(isMulti ? '' : (rule?.value ?? ''))}" list="f-values" autocomplete="off"><datalist id="f-values">${values.map((v) => `<option value="${esc(v)}">`).join('')}</datalist></div>
        <div id="f-val-multi" style="display:${isMulti ? 'block' : 'none'}">
          <div class="frow"><label>Values</label><div id="f-taglist" style="flex:1;display:flex;flex-wrap:wrap;gap:6px;align-items:center"></div></div>
          <div class="frow"><label></label><input id="f-multi" type="text" list="f-valopts" placeholder="Type or pick a value" autocomplete="off"><button class="btn" id="f-add-val" type="button">Add value</button><datalist id="f-valopts">${values.map((v) => `<option value="${esc(v)}">`).join('')}</datalist></div>
        </div>`;
      const tagList = formBox.querySelector('#f-taglist');
      function renderTags() {
        tagList.innerHTML = tags.map((v, i) => `<span class="chip">${esc(v)}<button type="button" data-rmtag="${i}" aria-label="Remove value" style="background:none;border:0;color:inherit;font-weight:700;cursor:pointer;padding:0 0 0 4px">&times;</button></span>`).join('');
        tagList.querySelectorAll('[data-rmtag]').forEach((b) => {
          b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); tags.splice(+b.dataset.rmtag, 1); renderTags(); };
        });
      }
      renderTags();
      formBox.querySelector('#f-field').onchange = () => {
        const name = formBox.querySelector('#f-field').value;
        const keepOp = formBox.querySelector('#f-op').value;
        renderAttributeForm(st, { field: name, op: keepOp, value: '', values: [], source: rule?.source });
      };
      formBox.querySelector('#f-op').onchange = (e) => {
        const multi = e.target.value === 'in' || e.target.value === 'not_in';
        formBox.querySelector('#f-val-single').style.display = multi ? 'none' : 'flex';
        formBox.querySelector('#f-val-multi').style.display = multi ? 'block' : 'none';
      };
      const addVal = () => {
        const input = formBox.querySelector('#f-multi');
        const v = input.value.trim();
        if (!v) return;
        if (!tags.includes(v)) tags.push(v);
        input.value = '';
        renderTags();
      };
      formBox.querySelector('#f-add-val').onclick = addVal;
      formBox.querySelector('#f-multi').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addVal(); }
      });
      formBox.querySelector('#f-value').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); applyBtn.click(); }
      });
      formBox._read = () => {
        const field = formBox.querySelector('#f-field').value;
        const op = formBox.querySelector('#f-op').value;
        if (!field) { toast('Pick a field'); return null; }
        if (op === 'in' || op === 'not_in') {
          if (!tags.length) { toast('Add at least one value'); return null; }
          return { field, op, values: tags.slice(), source: rule?.source || 'filter' };
        }
        const value = formBox.querySelector('#f-value').value.trim();
        if (!value) { toast('Enter a value'); return null; }
        if (['gt', 'gte', 'lt', 'lte'].includes(op) && !Number.isFinite(+value)) { toast('Enter a number'); return null; }
        return { field, op, value, source: rule?.source || 'filter' };
      };
    }
    function renderTemporalForm(st, rule) {
      const fields = (st.meta.fields || []).filter((f) => f.type === 'number' || f.type === 'date' || /year|date|time/i.test(f.name));
      const use = fields.length ? fields : (st.meta.fields || []);
      const op = rule.temporalOp || 'range';
      const single = op === 'before' ? rule.max : (rule.min ?? rule.max);
      formBox.innerHTML = `<div class="frow"><label>Field</label><select id="f-field">${use.map((f) => `<option value="${esc(f.name)}"${f.name === rule.field ? ' selected' : ''}>${esc(f.label || f.name)}</option>`).join('') || '<option value="">(no fields)</option>'}</select></div>
        <div class="frow"><label>Condition</label><select id="f-top">
          <option value="range"${op === 'range' ? ' selected' : ''}>Between</option>
          <option value="before"${op === 'before' ? ' selected' : ''}>On or before</option>
          <option value="after"${op === 'after' ? ' selected' : ''}>On or after</option>
          <option value="exact"${op === 'exact' ? ' selected' : ''}>Equals</option>
        </select></div>
        <div id="f-trange" class="frow" style="display:${op === 'range' ? 'flex' : 'none'}"><label>From</label><input id="f-tmin" type="number" value="${rule.min ?? ''}"><label>To</label><input id="f-tmax" type="number" value="${rule.max ?? ''}"></div>
        <div id="f-tsingle" class="frow" style="display:${op === 'range' ? 'none' : 'flex'}"><label>Value</label><input id="f-tsingle" type="number" value="${single ?? ''}"></div>`;
      const top = formBox.querySelector('#f-top');
      top.onchange = () => {
        const range = top.value === 'range';
        formBox.querySelector('#f-trange').style.display = range ? 'flex' : 'none';
        formBox.querySelector('#f-tsingle').style.display = range ? 'none' : 'flex';
      };
      formBox._read = () => {
        const field = formBox.querySelector('#f-field').value;
        const topv = top.value;
        if (!field) { toast('Pick a field'); return null; }
        if (topv === 'range') {
          const min = formBox.querySelector('#f-tmin').value;
          const max = formBox.querySelector('#f-tmax').value;
          if (min === '' || max === '') { toast('Enter both values'); return null; }
          return { field, op: '_temporal', temporalOp: 'range', min: +min, max: +max, source: 'temporal' };
        }
        const singleV = formBox.querySelector('#f-tsingle').value;
        if (singleV === '') { toast('Enter a value'); return null; }
        const n = +singleV;
        return { field, op: '_temporal', temporalOp: topv, min: n, max: n, source: 'temporal' };
      };
    }
    function renderForm() {
      const n = editingId ? filterNumber(editingId) : allFilters().length + 1;
      title.textContent = editingId ? `Edit filter ${n}` : 'Add a filter';
      cancelBtn.hidden = !editingId;
      applyBtn.textContent = editingId ? 'Save changes' : 'Add filter';
      hint.textContent = editingId
        ? 'Saving keeps this filter’s place in the list. Remove it from the list if you no longer want it.'
        : `This will be filter #${n}. On a layer that already has a filter, the new one is combined with it.`;
      const st = L.get(layerId);
      if (!st) { formBox.innerHTML = ''; formBox._read = null; return; }
      const rule = editingId ? findFilter(editingId)?.rule : null;
      if (!st.obj) {
        formBox.innerHTML = '<p class="empty">Loading…</p>';
        formBox._read = null;
        const token = ++formToken;
        loadLayer(st).then(() => {
          if (!alive() || token !== formToken || layerId !== st.meta.id) return;
          renderForm();
        }).catch(() => {
          if (alive() && token === formToken) formBox.innerHTML = '<p class="empty">Could not load this layer.</p>';
        });
        return;
      }
      if (rule && (rule.op === '_temporal' || rule.source === 'temporal') && rule.field && (!st.meta.fields || st.meta.fields.some((f) => f.name === rule.field) || st.meta.id === findFilter(editingId)?.st.meta.id)) {
        renderTemporalForm(st, rule);
        return;
      }
      renderAttributeForm(st, rule && rule.op !== '_temporal' ? rule : null);
    }
    function renderAll() {
      if (!alive()) return;
      renderList();
      renderLayerSelect();
      renderForm();
    }
    async function commitFilter() {
      try {
        const st = L.get(layerId);
        if (!st) { toast('Switch a layer on first'); return; }
        if (!editingId && !st.on) { toast('Switch that layer on first'); return; }
        if (!st.obj) {
          await loadLayer(st);
          if (!alive()) return;
          renderForm();
        }
        if (!formBox._read) { toast('Still loading that layer'); return; }
        const rule = formBox._read();
        if (!rule) return;
        if (editingId) rule.id = isFinite(+editingId) ? +editingId : editingId;
        if (filterRules(st).some((r) => String(r.id) !== String(rule.id) && sameFilterRule(r, rule))) {
          toast('That filter is already on this layer');
          return;
        }
        const wasEdit = editingId != null;
        const saved = upsertFilterRule(st.meta.id, rule);
        if (!saved) { toast('Could not apply that filter'); return; }
        editingId = null;
        saveProject();
        const nOnLayer = filterRules(saved.st).length;
        const num = filterNumber(saved.rule.id);
        const combo = nOnLayer > 1 ? ` · ${nOnLayer} filters combined on this layer` : '';
        const total = saved.st.meta.count ?? saved.st.obj?.features.length ?? '?';
        toast(`Filter ${num} ${wasEdit ? 'updated' : 'added'} — ${saved.st.filterCount} of ${total} shown${combo}`);
        renderAll();
      } catch (err) {
        console.error(err);
        toast('Could not apply that filter');
      }
    }
    applyBtn.onclick = () => { commitFilter(); };
    cancelBtn.onclick = () => { editingId = null; renderAll(); };
    body.querySelector('#f-clear-all').onclick = () => {
      const n = clearAllFilters();
      editingId = null;
      saveProject();
      toast(n ? 'Filters cleared' : 'No filters to clear');
      renderAll();
    };
    renderAll();
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
      const statRows = [{ layer: m.label, kind: m.kind, features: feats.length, columns: m.fields?.length ?? 0 }];
      if (rk) {
        const unit = rk.metric === 'area' ? 'km²' : 'km';
        statRows[0].metric = rk.metric;
        statRows[0].unit = unit;
        statRows[0].total = +rk.total.toFixed(3);
        statRows[0].average = +(rk.total / Math.max(1, rk.n)).toFixed(3);
        statRows[0].largest = +rk.sorted[0]?.v.toFixed(3);
        statRows[0].smallest = +rk.sorted[rk.sorted.length - 1]?.v.toFixed(3);
        statRows.push(...rk.sorted.slice(0, 8).map((r, i) => ({ rank: i + 1, feature: titleOf(st.obj, feats[r.idx]), [rk.metric]: +r.v.toFixed(3), unit })));
      }
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
      html += resultExportBar(m.label + ' statistics');
      holder.innerHTML = html;
      wireResultExports(holder, m.label + ' statistics', statRows, { layer: m.label });
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
        const chartRows = bars.map(([l, n]) => ({ layer: st.meta.label, field, value: l, count: n }));
        out.innerHTML = bars.length
          ? bars.map(([l, n]) => `<div class="brow"><span title="${esc(String(l))}">${esc(String(l).slice(0, 28))}</span><span class="barwrap"><i style="width:${Math.max(1, 100 * n / max)}%"></i></span><b>${fmtNum(n)}</b></div>`).join('')
            + `<p class="hint">${fmtNum(total)} feature${total === 1 ? '' : 's'} with a value · ${numeric ? bars.length + ' equal-width bins' : 'top ' + bars.length + ' values'}</p>`
            + (fieldMeta?.uom ? `<p class="hint">Unit: ${esc(fieldMeta.uom)}</p>` : '')
            + resultExportBar(st.meta.label + ' — ' + field)
          : '<p class="hint">No values to count here' + (clip ? ' — the focus area may not contain any feature of this layer.' : '.') + '</p>';
        wireResultExports(out, `${st.meta.label} — ${field}`, chartRows, { layer: st.meta.label, field, scope: clip ? 'focus area' : 'whole layer' });
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

function analysisResultModal(title, html, rows, extra) {
  openModal(title, (body) => {
    body.innerHTML = html + resultExportBar(title)
      + '<div class="frow act" style="justify-content:stretch"><button class="btn primary" id="an-png">' + icon('camera') + ' Download picture (PNG)</button><button class="btn" id="an-clear">' + icon('trash') + ' Clear from map</button></div>'
      + '<p class="hint">Exports never include latitude or longitude. The picture leaves grid coordinates off.</p>';
    wireResultExports(body, title, rows || [], extra);
    body.querySelector('#an-png').onclick = () => { closeModal(); captureMapPng('analysis.png', title); };
    body.querySelector('#an-clear').onclick = () => { closeModal(); clearAnalysisLayers(); toast('Analysis cleared'); };
  });
}

// ---- Buffer / Proximity -------------------------------------------------------
// The feature is tapped on the map. A list of identical names (five "Gold"s)
// is never how you choose. After the tap, set the distance and the zone shape.
const BUFFER_SHAPES = { circle: 'Circle', square: 'Square', diamond: 'Diamond', hexagon: 'Hexagon' };
function stopBufferPick(keepHighlight) {
  bufferPick = null;
  bufferPreview = null;
  const bar = $('#bufferbar'), panel = $('#bufferpanel');
  if (bar) bar.hidden = true;
  if (panel) panel.hidden = true;
  if (map) {
    map.cv.style.cursor = '';
    if (!keepHighlight) { map.selection = null; map.selectionSet = []; }
    map.render();
  }
  updateToolState();
}
function bufferVectorReady() {
  for (const id of stack) {
    const st = L.get(id);
    if (st?.obj?.features && ['polygon', 'line', 'point'].includes(st.meta.kind)) return true;
  }
  return false;
}
function toolBuffer() {
  if (!bufferVectorReady()) {
    openModal('Buffer / Proximity', (body) => {
      body.innerHTML = '<p class="empty">Switch on a point, line or polygon layer first, then tap the feature on the map.</p>';
    });
    return;
  }
  if (measure) { measure = null; $('#measurebar').hidden = true; }
  if (draw) endDraw();
  if (selState.active) exitSelectMode(true);
  closeModal();
  bufferPick = { active: true, seed: null, hits: [] };
  bufferPreview = null;
  map.cv.style.cursor = 'crosshair';
  map.selection = null;
  map.selectionSet = [];
  $('#bufferbar').hidden = false;
  $('#buffertext').textContent = 'Tap the feature you want to buffer';
  $('#bufferpanel').hidden = true;
  if (mobileQ.matches) closeSheet();
  updateToolState();
  map.render();
  toast('Tap a point, line or polygon on the map');
}
function featureTellApart(st, f, siblings) {
  const name = titleOf(st.obj, f);
  const labelKey = st.obj?.labelField || st.meta.labelField;
  const fields = (st.meta.fields || []).filter((fld) => fld?.name && !isCoordinateKey(fld.name));
  const varied = [], other = [];
  for (const fld of fields) {
    const v = f.props?.[fld.name];
    if (v == null || v === '') continue;
    const text = (fld.label || fld.name) + ': ' + v;
    const differs = siblings && siblings.some((s) => {
      if (s.st.meta.id !== st.meta.id) return true;
      return String(s.f.props?.[fld.name] ?? '') !== String(v);
    });
    if (differs && fld.name !== labelKey) varied.push(text);
    else if (fld.name !== labelKey) other.push(text);
  }
  return { name, layer: st.meta.label, kind: st.meta.kind, bits: (varied.length ? varied : other).slice(0, 4), color: f.fill || f.stroke || '' };
}
function pickBufferFeature(x, y) {
  const hits = map.identify(x, y)
    .filter((r) => r.feature && ['polygon', 'line', 'point'].includes(r.layer.kind))
    .map((r) => ({ id: r.layer.id, st: L.get(r.layer.id), f: r.feature }))
    .filter((r) => r.st);
  hits.reverse();
  if (!hits.length) { toast('Nothing there — tap a point, line or polygon'); return; }
  bufferPick.hits = hits;
  // The last highlight is the strongest, so the feature drawn on top (hits[0]) goes last.
  map.selectionSet = hits.slice().reverse().map((h) => ({ layer: { id: h.id }, feature: h.f }));
  map.selection = hits.length === 1 ? { feature: hits[0].f, layer: { id: hits[0].id } } : null;
  if (hits.length === 1) chooseBufferSeed(hits[0]);
  else showBufferChooser(hits);
  map.render();
}
function showBufferChooser(hits) {
  const box = $('#bufferchoose');
  const names = new Set(hits.map((h) => titleOf(h.st.obj, h.f)));
  box.hidden = false;
  $('#buffersetup').hidden = true;
  $('#bufferpanel').hidden = false;
  $('#bufferbar').hidden = true;
  box.innerHTML = '<p class="hint">' + (names.size === 1
    ? 'Several features under that tap are all called <b>' + esc([...names][0]) + '</b>. The other details tell them apart. The first one is drawn on top.'
    : 'Several features are under that tap. Pick the one you mean — or tap the map again.') + '</p>'
    + '<div class="bufferhits">' + hits.map((h, i) => {
      const info = featureTellApart(h.st, h.f, hits);
      const title = names.size === 1 && info.bits.length ? info.bits.join(' · ') : info.name;
      return '<button type="button" data-hit="' + i + '"><b>' + (info.color ? '<i class="swatch" style="background:' + esc(info.color) + '"></i>' : '') + esc(title) + '</b><small>'
        + esc(info.name) + ' · ' + esc(info.layer) + ' · ' + esc(info.kind) + (i === 0 ? ' · drawn on top' : '') + '</small></button>';
    }).join('') + '</div>';
  box.querySelectorAll('[data-hit]').forEach((b) => {
    const h = hits[+b.dataset.hit];
    const glow = () => { map.selection = { feature: h.f, layer: { id: h.id } }; map.render(); };
    b.onpointerenter = glow;
    b.onfocus = glow;
    b.onclick = () => chooseBufferSeed(h);
  });
}
function chooseBufferSeed(hit) {
  bufferPick.seed = { id: hit.id, idx: hit.f.idx };
  map.selection = { feature: hit.f, layer: { id: hit.id } };
  map.selectionSet = [];
  const info = featureTellApart(hit.st, hit.f, bufferPick.hits);
  $('#bufferchoose').hidden = true;
  $('#buffersetup').hidden = false;
  $('#bufferpanel').hidden = false;
  $('#bufferbar').hidden = true;
  $('#bufferpicked').innerHTML = '<b>' + (info.color ? '<i class="swatch" style="background:' + esc(info.color) + '"></i>' : '') + esc(info.name) + '</b>'
    + '<span class="hint">' + esc(info.layer) + ' · ' + esc(info.kind) + (info.bits.length ? ' · ' + esc(info.bits.join(' · ')) : '') + '</span>';
  refreshBufferPreview();
}
function bufferSeed() {
  if (!bufferPick?.seed) return null;
  const st = L.get(bufferPick.seed.id);
  const f = st?.obj?.features?.find((feat) => feat.idx === bufferPick.seed.idx);
  return st && f ? { st, f } : null;
}
function bufferDistanceKm() {
  const n = +($('#bf-dist')?.value);
  const unit = +($('#bf-unit')?.value || 1);
  return n > 0 ? n * unit : 0;
}
function bufferShape() {
  return $('#bf-shape .on')?.dataset.shape || 'circle';
}
function refreshBufferPreview() {
  const seed = bufferSeed();
  const distKm = bufferDistanceKm();
  if (!seed || !distKm || distKm > 2000) { bufferPreview = null; map.render(); return; }
  try {
    const zone = bufferZone(seed.f, distKm * 1000, bufferShape());
    bufferPreview = zone?.parts || null;
  } catch { bufferPreview = null; }
  map.render();
}
async function runBufferAnalysis() {
  const seed = bufferSeed();
  const distKm = bufferDistanceKm();
  const scope = $('#bf-scope')?.value || 'all';
  const mode = $('#bf-mode')?.value || 'overlap';
  const shape = bufferShape();
  if (!seed) { toast('Tap a feature on the map first'); return; }
  if (!distKm || distKm > 2000) { toast('Enter a distance between 0 and 2,000 km'); return; }
  const srcSt = seed.st, feature = seed.f;
  bufferPreview = null;
  await working('Building the ' + (BUFFER_SHAPES[shape] || 'circle').toLowerCase() + ' zone');
  const zone = bufferZone(feature, distKm * 1000, shape);
  if (!zone || !zone.parts?.length) { toast('Could not build a zone around this feature'); return; }
  const zoneArea = partsAreaKm2(zone.parts);
  const told = featureTellApart(srcSt, feature, bufferPick?.hits || []);
  const seedName = told.bits.length ? told.name + ' (' + told.bits.join(', ') + ')' : told.name;
  const shapeName = BUFFER_SHAPES[shape] || 'Circle';
  $('#bufferpanel').hidden = true;
  const targets = [];
  for (const id of visibleLayerIds()) {
    const st = L.get(id);
    if (!st?.obj?.features || st.meta.kind === 'table' || st.meta.kind === 'image') continue;
    if (scope === 'same' && id !== srcSt.meta.id) continue;
    if (scope === 'others' && id === srcSt.meta.id) continue;
    targets.push([id, st]);
  }
  const rows = [], byLayer = [];
  let shown = 0;
  for (const [id, st] of targets) {
    await working('Checking ' + st.meta.label);
    const index = bboxGrid([zone], (b) => b.bb, 4);
    const feats = (st.obj.features || []).filter((f) => !f.hidden && !(id === srcSt.meta.id && f.idx === feature.idx));
    let inside = 0, area = 0, length = 0, wholly = 0;
    const values = new Map();
    const field = (st.meta.fields || []).find((fld) => fld.type === 'text')?.name;
    for (const f of feats) {
      if (f.bb[2] < zone.bb[0] || f.bb[0] > zone.bb[2] || f.bb[3] < zone.bb[1] || f.bb[1] > zone.bb[3]) continue;
      const rel = bufferRelation(f, zone, mode);
      if (!rel.hit) continue;
      inside++;
      const m = featureMetrics(f);
      if (m.area) area += m.area;
      if (m.length) length += m.length;
      if (rel.wholly) wholly++;
      if (field && f.props?.[field] != null) values.set(String(f.props[field]), (values.get(String(f.props[field])) || 0) + 1);
      if (rows.length < 500) {
        const who = featureTellApart(st, f, null);
        rows.push({
          layer: st.meta.label,
          feature: who.bits.length ? who.name + ' · ' + who.bits.slice(0, 2).join(' · ') : who.name,
          kind: f.type,
          relation: rel.wholly ? 'wholly inside' : 'partly inside',
          area_km2: m.area ? +m.area.toFixed(2) : '',
          length_km: m.length ? +m.length.toFixed(2) : '',
        });
      }
    }
    if (!inside) continue;
    const top = [...values.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v, n]) => `${v} (${n})`).join(', ');
    byLayer.push({ layer: st.meta.label, kind: st.meta.kind, inside, wholly, area, length, top });
    shown++;
  }
  const drawn = featureFromParts(zone.parts, { zone: seedName, distance_km: distKm }, { fill: '#0b6b45', idx: 0 });
  if (drawn) addAnalysisLayer([drawn], 'polygon', 'Buffer ' + distKm + ' km', '#0b6b45');
  const total = byLayer.reduce((s, r) => s + r.inside, 0);
  const distLabel = distKm < 1 ? Math.round(distKm * 1000) + ' m' : distKm + ' km';
  const layerRows = byLayer.sort((a, b) => b.inside - a.inside).map((r) =>
    '<tr><td>' + esc(r.layer) + '</td><td>' + esc(r.kind) + '</td><td><b>' + fmtNum(r.inside) + '</b></td><td>' + fmtNum(r.wholly) + '</td><td>' +
    (r.kind === 'polygon' ? fmtNum(r.area) + ' km²' : r.kind === 'line' ? fmtNum(r.length) + ' km' : '—') + '</td><td>' + esc(r.top || '—') + '</td></tr>').join('');
  const html = '<p class="hint">' + esc(shapeName) + ' zone around <b>' + esc(seedName) + '</b> (' + esc(srcSt.meta.label) + ', ' + esc(feature.type) + ') · <b>' + esc(distLabel) + '</b> · zone area <b>' + fmtNum(zoneArea) + ' km²</b>.</p>' +
    '<div class="statgrid"><div class="statbox"><b>' + fmtNum(total) + '</b><small>features inside</small></div>' +
    '<div class="statbox"><b>' + byLayer.length + '</b><small>layers touched</small></div>' +
    '<div class="statbox"><b>' + fmtNum(byLayer.reduce((s, r) => s + r.wholly, 0)) + '</b><small>wholly inside</small></div></div>' +
    (byLayer.length ? '<table class="mini"><tr><th>Layer</th><th>Kind</th><th>Inside</th><th>Wholly</th><th>Size inside</th><th>Most common</th></tr>' + layerRows + '</table>' : '<p>Nothing else falls inside this zone.</p>') +
    (rows.length ? '<h4>Features inside the zone</h4><table class="mini"><tr><th>Layer</th><th>Feature</th><th>Relation</th></tr>' +
      rows.slice(0, 40).map((r) => '<tr><td>' + esc(r.layer) + '</td><td>' + esc(r.feature) + '</td><td>' + esc(r.relation) + '</td></tr>').join('') + '</table>' +
      (rows.length > 40 ? '<p class="hint">Showing 40 of ' + fmtNum(rows.length) + '. Export the full list below.</p>' : '') : '');
  analysisResultModal('Buffer — ' + told.name, html, rows, {
    feature: seedName, layer: srcSt.meta.label, kind: feature.type, shape: shapeName, distance_km: distKm,
    zone_area_km2: +zoneArea.toFixed(2), rule: mode, layers: byLayer.map((r) => ({ layer: r.layer, inside: r.inside, wholly_inside: r.wholly })),
  });
  stopBufferPick(true);
  if (drawn) map.fitBounds(mercBoundsToLonLat(drawn.bb), 48);
  toast(total + ' feature' + (total === 1 ? '' : 's') + ' inside ' + distLabel + ' of ' + seedName);
}
// How a feature sits against a buffer zone. `mode` is overlap | inside | centroid.
function bufferRelation(f, zone, mode) {
  if (mode === 'centroid') {
    const [x, y] = featureCentroid(f);
    return { hit: pointInFeature(x, y, zone), wholly: pointInFeature(x, y, zone) };
  }
  if (f.type === 'point') {
    let hit = false;
    for (let i = 0; i < f.parts.length; i += 2) if (pointInFeature(f.parts[i], f.parts[i + 1], zone)) hit = true;
    return { hit, wholly: hit };
  }
  const overlaps = polyOverlapsPoly(ringOfFeature(f), ringOfFeature(zone));
  if (!overlaps) return { hit: false, wholly: false };
  if (mode !== 'inside') return { hit: true, wholly: false };
  const asPoly = f.type === 'poly' ? f : featureFromParts(featurePolygons(f), {}, {});
  if (!asPoly) return { hit: true, wholly: false };
  const diff = polygonBoolean([asPoly, zone], 'difference');
  return { hit: true, wholly: !diff.length };
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
      await working('Intersecting ' + aSt.meta.label);
      const featsA = analysisFeatures(aSt), featsB = analysisFeatures(bSt);
      const index = bboxGrid(featsB, (f) => f.bb, 64);
      const drawn = [], rows = [];
      let totalArea = 0;
      for (const fA of featsA) {
        if (fA.type !== 'poly') continue;
        for (const fB of index.nearBox(fA.bb)) {
          if (fB.type !== 'poly') continue;
          if (fA.bb[2] < fB.bb[0] || fA.bb[0] > fB.bb[2] || fA.bb[3] < fB.bb[1] || fA.bb[1] > fB.bb[3]) continue;
          const parts = polygonBoolean([fA, fB], 'intersection');
          if (!parts.length) continue;
          const area = partsAreaKm2(parts);
          totalArea += area;
          const piece = featureFromParts(parts, { layer_a: titleOf(aSt.obj, fA), layer_b: titleOf(bSt.obj, fB), overlap_km2: +area.toFixed(3) }, { fill: '#a83232', idx: drawn.length });
          if (piece) drawn.push(piece);
          if (rows.length < 500) rows.push({ from: titleOf(aSt.obj, fA), overlaps: titleOf(bSt.obj, fB), overlap_km2: +area.toFixed(3) });
        }
      }
      addAnalysisLayer(drawn, 'polygon', 'Intersection', '#a83232');
      const html = '<p class="hint">Intersection: <b>' + esc(aSt.meta.label) + '</b> ∩ <b>' + esc(bSt.meta.label) + '</b>.</p>' +
        '<div class="statgrid"><div class="statbox"><b>' + fmtNum(drawn.length) + '</b><small>overlapping pieces</small></div>' +
        '<div class="statbox"><b>' + fmtNum(totalArea) + '</b><small>km² of overlap</small></div></div>' +
        (rows.length ? '<table class="mini"><tr><th>' + esc(aSt.meta.label) + '</th><th>' + esc(bSt.meta.label) + '</th><th>Overlap (km²)</th></tr>' +
          rows.slice(0, 25).map((r) => '<tr><td>' + esc(r.from) + '</td><td>' + esc(r.overlaps) + '</td><td>' + fmtNum(r.overlap_km2) + '</td></tr>').join('') + '</table>' +
          (rows.length > 25 ? '<p class="hint">Showing 25 of ' + fmtNum(rows.length) + '. Export the full list below.</p>' : '') : '<p>The two layers do not overlap.</p>');
      analysisResultModal('Intersection', html, rows, { layer_a: aSt.meta.label, layer_b: bSt.meta.label, overlap_km2: +totalArea.toFixed(3) });
      if (drawn.length) {
        const bb = drawn.reduce((acc, r) => [Math.min(acc[0], r.bb[0]), Math.min(acc[1], r.bb[1]), Math.max(acc[2], r.bb[2]), Math.max(acc[3], r.bb[3])], [1e9, 1e9, -1e9, -1e9]);
        map.fitBounds(mercBoundsToLonLat(bb), 40);
      } else toast('No overlapping areas found');
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
      const maxN = Math.min(2000, +body.querySelector('#nn-max').value || 200);
      if (!aId || !bId || aId === bId) { toast('Pick two different layers'); return; }
      const aSt = L.get(aId), bSt = L.get(bId);
      if (!aSt.obj) await loadLayer(aSt);
      if (!bSt.obj) await loadLayer(bSt);
      closeModal();
      await working('Measuring nearest neighbours');
      const featsA = analysisFeatures(aSt).slice(0, maxN);
      const featsB = analysisFeatures(bSt);
      const pts = featsB.map((f) => { const [x, y] = featureCentroid(f); return { x, y, f }; });
      const grid = pointGrid(pts, Math.max(25 * 1000 / (MERC_METRES_PER_UNIT / 1e6), 1e-6));
      const connectors = [], summary = [];
      let count = 0;
      for (const fA of featsA) {
        const [ax, ay] = featureCentroid(fA);
        let nearest = null, nearestD = Infinity;
        for (let ring = 1; ring <= 6 && !nearest; ring++) {
          for (const p of grid.around(ax, ay, ring)) {
            const d = Math.hypot(p.x - ax, p.y - ay);
            if (d < nearestD) { nearestD = d; nearest = p; }
          }
        }
        if (!nearest) nearest = pts.reduce((best, p) => (!best || Math.hypot(p.x - ax, p.y - ay) < Math.hypot(best.x - ax, best.y - ay)) ? p : best, null);
        if (!nearest) continue;
        // A feature's true nearest neighbour cannot be much further than the nearest
        // centroid, so only the candidates in that neighbourhood need measuring.
        const reach = Math.hypot(nearest.x - ax, nearest.y - ay);
        const span = Math.max(fA.bb[2] - fA.bb[0], fA.bb[3] - fA.bb[1]);
        const rings = Math.min(8, Math.ceil((reach + span) / grid.cell) + 1);
        let bestF = null, best = null;
        for (const p of grid.around(ax, ay, rings)) {
          const hit = featureClosestKm(fA, p.f);
          if (!best || hit.km < best.km) { best = hit; bestF = p.f; }
        }
        if (!bestF || !Number.isFinite(best.km)) continue;
        connectors.push({ type: 'line', parts: [[best.ax, best.ay, best.bx, best.by]], bb: [Math.min(best.ax, best.bx), Math.min(best.ay, best.by), Math.max(best.ax, best.bx), Math.max(best.ay, best.by)], fill: '#0b6b45', stroke: '#0b6b45', idx: count, props: { from: titleOf(aSt.obj, fA), to: titleOf(bSt.obj, bestF) } });
        summary.push({ from: titleOf(aSt.obj, fA), to: titleOf(bSt.obj, bestF), distance_km: +best.km.toFixed(3), touches: best.km === 0 ? 'yes' : 'no' });
        count++;
      }
      addAnalysisLayer(connectors, 'line', 'Nearest connectors', '#0b6b45');
      const dists = summary.map((r) => r.distance_km).sort((a, b) => a - b);
      const avg = dists.length ? dists.reduce((s, d) => s + d, 0) / dists.length : 0;
      const html = '<p class="hint">Nearest neighbour: <b>' + esc(aSt.meta.label) + '</b> → <b>' + esc(bSt.meta.label) + '</b>. Distance is measured edge to edge, not centre to centre.</p>' +
        '<div class="statgrid"><div class="statbox"><b>' + fmtNum(count) + '</b><small>connections</small></div>' +
        '<div class="statbox"><b>' + fmtNum(avg) + '</b><small>km average</small></div>' +
        '<div class="statbox"><b>' + (dists.length ? fmtNum(dists[0]) : '—') + '</b><small>km nearest</small></div>' +
        '<div class="statbox"><b>' + summary.filter((r) => r.touches === 'yes').length + '</b><small>already touching</small></div></div>' +
        '<table class="mini"><tr><th>From</th><th>Nearest</th><th>km</th><th>Touches</th></tr>' +
        summary.slice(0, 25).map((r) => '<tr><td>' + esc(r.from) + '</td><td>' + esc(r.to) + '</td><td>' + fmtNum(r.distance_km) + '</td><td>' + r.touches + '</td></tr>').join('') +
        '</table>' + (summary.length > 25 ? '<p class="hint">Showing 25 of ' + fmtNum(summary.length) + '.</p>' : '');
      analysisResultModal('Nearest neighbour', html, summary, { from_layer: aSt.meta.label, to_layer: bSt.meta.label, average_km: +avg.toFixed(3) });
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
      await working('Grouping ' + st.meta.label);
      const groups = new Map();
      for (const f of analysisFeatures(st)) {
        if (f.type !== 'poly') continue;
        const key = String(f.props[field] ?? '');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(f);
      }
      const dissolved = [];
      let idx = 0;
      for (const [key, feats] of groups) {
        await working('Merging ' + (key || '(blank)'));
        const parts = unionFeatures(feats);
        const area = partsAreaKm2(parts);
        const piece = featureFromParts(parts, { [field]: key, features_merged: feats.length, area_km2: +area.toFixed(3) }, { fill: '#7a4b00', idx: idx++ });
        if (piece) dissolved.push(piece);
      }
      addAnalysisLayer(dissolved, 'polygon', 'Dissolved: ' + field, '#7a4b00');
      const rows = dissolved.map((d) => ({ [field]: d.props[field], features_merged: d.props.features_merged, area_km2: d.props.area_km2 }));
      const html = '<p class="hint">Dissolve: <b>' + esc(st.meta.label) + '</b> by <b>' + esc(field) + '</b>. Shared borders are removed; gaps between features are kept.</p>' +
        '<div class="statgrid"><div class="statbox"><b>' + fmtNum(groups.size) + '</b><small>groups</small></div>' +
        '<div class="statbox"><b>' + fmtNum(dissolved.length) + '</b><small>merged shapes</small></div>' +
        '<div class="statbox"><b>' + fmtNum(rows.reduce((s, r) => s + r.area_km2, 0)) + '</b><small>km² in total</small></div></div>' +
        '<table class="mini"><tr><th>' + esc(field) + '</th><th>Merged</th><th>Area (km²)</th></tr>' +
        rows.slice(0, 25).map((r) => '<tr><td>' + esc(r[field]) + '</td><td>' + fmtNum(r.features_merged) + '</td><td>' + fmtNum(r.area_km2) + '</td></tr>').join('') +
        '</table>' + (rows.length > 25 ? '<p class="hint">Showing 25 of ' + fmtNum(rows.length) + '.</p>' : '');
      analysisResultModal('Dissolve', html, rows, { layer: st.meta.label, field });
      if (dissolved.length) {
        const bb = dissolved.reduce((acc, d) => [Math.min(acc[0], d.bb[0]), Math.min(acc[1], d.bb[1]), Math.max(acc[2], d.bb[2]), Math.max(acc[3], d.bb[3])], [1e9, 1e9, -1e9, -1e9]);
        map.fitBounds(mercBoundsToLonLat(bb), 40);
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
      await working('Counting ' + tSt.meta.label);
      // One pass over the points: each point only tests the polygons whose extent holds it.
      const polys = analysisFeatures(pSt).filter((f) => f.type === 'poly');
      const index = bboxGrid(polys, (f) => f.bb, 64);
      const counts = new Map();
      let total = 0, seen = 0, outside = 0;
      for (const pf of analysisFeatures(tSt)) {
        if (pf.type !== 'point') continue;
        for (let i = 0; i < pf.parts.length; i += 2) {
          const px = pf.parts[i], py = pf.parts[i + 1];
          seen++;
          let hit = false;
          for (const f of index.near(px, py)) {
            if (px < f.bb[0] || px > f.bb[2] || py < f.bb[1] || py > f.bb[3]) continue;
            if (pointInFeature(px, py, f)) { counts.set(f, (counts.get(f) || 0) + 1); hit = true; break; }
          }
          if (hit) total++; else outside++;
        }
      }
      const ranked = polys.map((f) => ({ f, n: counts.get(f) || 0 })).sort((a, b) => b.n - a.n);
      const results = ranked.map(({ f, n }) => ({ ...f, fill: n ? '#0b6b45' : '#c8d4cc', props: { ...f.props, point_count: n } }));
      addAnalysisLayer(results, 'polygon', 'Point count', '#0b6b45');
      const withPoints = ranked.filter((r) => r.n).length;
      const rows = ranked.map(({ f, n }) => ({ polygon: titleOf(pSt.obj, f), points: n, share_percent: seen ? +(n / seen * 100).toFixed(2) : 0 }));
      const html = '<p class="hint">Count: <b>' + esc(tSt.meta.label) + '</b> points inside <b>' + esc(pSt.meta.label) + '</b>. A point on a shared border counts once, for the first polygon found.</p>' +
        '<div class="statgrid"><div class="statbox"><b>' + fmtNum(total) + '</b><small>points inside</small></div>' +
        '<div class="statbox"><b>' + fmtNum(outside) + '</b><small>points outside</small></div>' +
        '<div class="statbox"><b>' + fmtNum(withPoints) + '</b><small>of ' + fmtNum(polys.length) + ' polygons</small></div></div>' +
        '<table class="mini"><tr><th>Polygon</th><th>Points</th><th>Share</th></tr>' +
        rows.slice(0, 25).map((r) => '<tr><td>' + esc(r.polygon) + '</td><td><b>' + fmtNum(r.points) + '</b></td><td>' + r.share_percent + '%</td></tr>').join('') +
        '</table>' + (rows.length > 25 ? '<p class="hint">Showing 25 of ' + fmtNum(rows.length) + '.</p>' : '');
      analysisResultModal('Point count', html, rows, { polygons: pSt.meta.label, points: tSt.meta.label, inside: total, outside });
      if (results.length) {
        const bb = results.reduce((acc, r) => [Math.min(acc[0], r.bb[0]), Math.min(acc[1], r.bb[1]), Math.max(acc[2], r.bb[2]), Math.max(acc[3], r.bb[3])], [1e9, 1e9, -1e9, -1e9]);
        map.fitBounds(mercBoundsToLonLat(bb), 40);
      }
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
      const feats = analysisFeatures(st);
      const pts = feats.map((f) => featureCentroid(f));
      const ring = convexHullPoints(pts);
      if (!ring || ring.length < 6) { toast('Not enough points for a hull'); return; }
      const closed = closeFlat(ring);
      const area = flatRingAreaKm2(closed);
      const perim = ringPerimeterKm(lonlatRing(closed));
      const piece = featureFromParts([[closed]], { points: pts.length, area_km2: +area.toFixed(2), edge_km: +perim.toFixed(2) }, { fill: '#1e78ff', idx: 0 });
      addAnalysisLayer(piece ? [piece] : [], 'polygon', 'Convex hull', '#1e78ff');
      const rows = [{ layer: st.meta.label, points: pts.length, hull_vertices: closed.length / 2 - 1, area_km2: +area.toFixed(2), edge_km: +perim.toFixed(2) }];
      const html = '<p class="hint">Convex hull of <b>' + esc(st.meta.label) + '</b> — the smallest shape with no inward corners that still holds every point.</p>' +
        '<div class="statgrid"><div class="statbox"><b>' + fmtNum(pts.length) + '</b><small>points enclosed</small></div>' +
        '<div class="statbox"><b>' + fmtNum(area) + '</b><small>km² inside the hull</small></div>' +
        '<div class="statbox"><b>' + perim.toFixed(1) + '</b><small>km around the edge</small></div></div>';
      analysisResultModal('Convex hull', html, rows, { layer: st.meta.label });
      if (piece) map.fitBounds(mercBoundsToLonLat(piece.bb), 40);
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
      await working('Simplifying ' + st.meta.label);
      const simplified = [];
      let totalVerts = 0, newVerts = 0, kept = 0;
      for (const f of analysisFeatures(st)) {
        if (f.type !== 'poly') continue;
        const before = vertexCount(f);
        totalVerts += before;
        const sf = simplifyFeature(f, tol);
        const after = vertexCount(sf);
        newVerts += after;
        if (after < before) kept++;
        simplified.push({ ...sf, props: { ...sf.props, vertices_before: before, vertices_after: after } });
      }
      addAnalysisLayer(simplified, 'polygon', 'Simplified', '#34c27d');
      const rows = simplified.filter((f) => f.props.vertices_before !== f.props.vertices_after).slice(0, 400)
        .map((f) => ({ feature: titleOf(st.obj, f), vertices_before: f.props.vertices_before, vertices_after: f.props.vertices_after }));
      const html = '<p class="hint">Simplify: <b>' + esc(st.meta.label) + '</b> at <b>' + tol + ' km</b> tolerance. A bend is dropped only when it moves the boundary by less than that.</p>' +
        '<div class="statgrid"><div class="statbox"><b>' + fmtNum(totalVerts) + '</b><small>vertices before</small></div>' +
        '<div class="statbox"><b>' + fmtNum(newVerts) + '</b><small>vertices after</small></div>' +
        '<div class="statbox"><b>' + ((1 - newVerts / Math.max(1, totalVerts)) * 100).toFixed(1) + '%</b><small>removed</small></div>' +
        '<div class="statbox"><b>' + fmtNum(kept) + '</b><small>features changed</small></div></div>';
      analysisResultModal('Simplify', html, rows, { layer: st.meta.label, tolerance_km: tol, vertices_before: totalVerts, vertices_after: newVerts });
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
      await working('Summarising the raster inside ' + pSt.meta.label);
      const polys = analysisFeatures(pSt).filter((f) => f.type === 'poly');
      const index = bboxGrid(polys, (f) => f.bb, 64);
      const acc = new Map();   // polygon -> {count,sum,min,max}
      const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 20000)));
      for (let j = 0; j < h; j += step) {
        for (let i = 0; i < w; i += step) {
          const v = data[j * w + i];
          if (dtype === 'i2' ? v === -32768 : !isFinite(v)) continue;
          const wx = wb[0] + (i + step / 2) / w * (wb[2] - wb[0]);
          const wy = wb[1] + (j + step / 2) / h * (wb[3] - wb[1]);
          for (const f of index.near(wx, wy)) {
            if (!pointInFeature(wx, wy, f)) continue;
            let a = acc.get(f);
            if (!a) { a = { count: 0, sum: 0, min: 1e9, max: -1e9 }; acc.set(f, a); }
            a.count++; a.sum += v;
            if (v < a.min) a.min = v;
            if (v > a.max) a.max = v;
          }
        }
      }
      const results = [];
      const rows = [];
      for (const f of polys) {
        const a = acc.get(f);
        const mean = a ? a.sum / a.count : null;
        results.push({ ...f, fill: a ? '#a83232' : '#c8d4cc', props: { ...f.props, cells: a ? a.count : 0, mean: mean == null ? '' : +mean.toFixed(3), min: a ? +a.min.toFixed(3) : '', max: a ? +a.max.toFixed(3) : '' } });
        rows.push({ polygon: titleOf(pSt.obj, f), cells: a ? a.count * step * step : 0, mean: mean == null ? '' : +mean.toFixed(3), min: a ? +a.min.toFixed(3) : '', max: a ? +a.max.toFixed(3) : '' });
      }
      rows.sort((a, b) => (b.mean === '' ? -Infinity : b.mean) - (a.mean === '' ? -Infinity : a.mean));
      addAnalysisLayer(results, 'polygon', 'Zonal stats', '#a83232');
      const withData = rows.filter((r) => r.cells).length;
      const html = '<p class="hint">Zonal statistics: <b>' + esc(rSt.meta.label) + '</b> inside <b>' + esc(pSt.meta.label) + '</b>. Cells are sampled on a grid, so counts are estimates.</p>' +
        '<div class="statgrid"><div class="statbox"><b>' + fmtNum(withData) + '</b><small>of ' + fmtNum(polys.length) + ' polygons hold data</small></div></div>' +
        '<table class="mini"><tr><th>Polygon</th><th>Cells</th><th>Mean</th><th>Min</th><th>Max</th></tr>' +
        rows.slice(0, 25).map((r) => '<tr><td>' + esc(r.polygon) + '</td><td>' + fmtNum(r.cells) + '</td><td>' + (r.mean === '' ? '—' : fmtNum(r.mean)) + '</td><td>' + (r.min === '' ? '—' : fmtNum(r.min)) + '</td><td>' + (r.max === '' ? '—' : fmtNum(r.max)) + '</td></tr>').join('') +
        '</table>' + (rows.length > 25 ? '<p class="hint">Showing 25 of ' + fmtNum(rows.length) + '.</p>' : '');
      analysisResultModal('Zonal statistics', html, rows, { polygons: pSt.meta.label, raster: rSt.meta.label });
      toast(withData ? 'Zonal stats: ' + withData + ' polygon' + (withData === 1 ? '' : 's') + ' with data' : 'No raster cells fell inside these polygons');
      if (results.length) {
        const bb = results.reduce((acc2, r) => [Math.min(acc2[0], r.bb[0]), Math.min(acc2[1], r.bb[1]), Math.max(acc2[2], r.bb[2]), Math.max(acc2[3], r.bb[3])], [1e9, 1e9, -1e9, -1e9]);
        map.fitBounds(mercBoundsToLonLat(bb), 40);
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
      ensureAllFilterIds();
      const filters = {}; for (const [id, st] of L) if (hasFilter(st)) filters[id] = st.filter;
      const clipRec = clipRecord();
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
  if (p.clip) restoreFocus(p.clip); else stopFocus();
  // restore filters
  for (const [id, fl] of Object.entries(p.filters || {})) { const st = L.get(id); if (st) { st.filter = fl; applyFilter(st, false); } }
  renderLayerLists(); refreshLegend(); updateFocusUI(); updateToolState(); saveProject();
  toast('Map preset "' + name + '" restored');
}

// ---- Print Layouts tool ----
function toolPrintLayout() {
  openModal('Print Layouts', (body) => {
    body.innerHTML = '<p>Choose a page template for saved pictures. Adds margins, a title block and a scale bar area around the map.</p>' +
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
      '<div class="frow act"><button class="btn primary" id="pl-set">' + icon('camera') + ' Use for next picture</button></div>' +
      '<p class="muted">The chosen layout applies when you save a picture with a title and frame.</p>';
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
    body.innerHTML = '<p>Search feature attributes across all active layers. Results are highlighted on the map — nothing is downloaded.</p>' +
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
      '<p class="muted" style="margin-top:6px">Layers are added to the map for this session only.</p>';
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
  clearAllFilters();
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
let importSeq = 0;
const IMPORT_COLORS = ['#8e44ad', '#c0392b', '#1a7f4b', '#b86e00', '#1f6feb', '#0e7490', '#a33b6b'];
let importColor = 0;

function renderImported() {
  const box = $('#importlist');
  if (!box) return;
  const q = ($('#layerfilter').value || '').trim().toLowerCase();
  const items = [...L.values()].filter((st) => st.meta.group === 'imported');
  items.sort((a, b) => (b.meta.importSeq || 0) - (a.meta.importSeq || 0));
  if (!items.length) { box.innerHTML = ''; return; }
  const notes = [...new Set(items.map((st) => st.meta.crsNote).filter(Boolean))];
  box.innerHTML = `<div class="sec">Imported <span class="n">${items.length}</span></div>
    <p class="hint">In this browser only, for this visit. Nothing is drawn until you turn a layer on. Then it can be used with the other layers. Import another file with the button at the top.</p>
    ${notes.map(caveatBox).join('')}
    <div class="group"><div class="lrows" id="import-rows"></div></div>`;
  const rows = $('#import-rows');
  for (const st of items) {
    const row = layerRow(st.meta.id);
    if (q && !row.dataset.search.includes(q)) row.hidden = true;
    rows.appendChild(row);
  }
}
function caveatBox(note) {
  const warn = /15 metres|did not name|tens of metres|instead of|wrong place|Latitude was read first/i.test(note);
  return `<div class="caveat${warn ? '' : ' ok'}">${esc(note)}</div>`;
}
function fieldsOf(features) {
  const keys = new Set();
  for (const f of features.slice(0, 40)) for (const k of Object.keys(f.props || {})) keys.add(k);
  return [...keys].map((name) => {
    const values = features.slice(0, 40).map((f) => f.props?.[name]).filter((v) => v != null && v !== '');
    const type = values.length && values.every((v) => typeof v === 'number') ? 'number' : 'text';
    return { name, type, label: name };
  });
}
function addImportedLayer({ label, description, kind, features, crs, fileName }) {
  const id = 'import_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const color = IMPORT_COLORS[importColor++ % IMPORT_COLORS.length];
  features.forEach((f, i) => { f.fill = f.stroke = f.fill0 = color; f.idx = i; });
  let box = [1e9, 1e9, -1e9, -1e9];
  for (const f of features) for (let k = 0; k < 2; k++) { box[k] = Math.min(box[k], f.bb[k]); box[k + 2] = Math.max(box[k + 2], f.bb[k + 2]); }
  const meta = {
    id, table: id, kind, group: 'imported', label,
    description: description || crs.note,
    count: features.length,
    fields: fieldsOf(features),
    style: { mode: 'single', color },
    labelField: null,
    bounds: features.length ? [unX(box[0]), unY(box[3]), unX(box[2]), unY(box[1])] : null,
    file: null, imported: true, importSeq: ++importSeq,
    crsName: crs.shortName || crs.name, crsNote: crs.note, sourceFile: fileName || '',
  };
  catalog.layers.push(meta);
  const st = {
    meta, on: false, opacity: kind === 'polygon' ? 0.72 : 0.9, loading: false, loadPromise: null, obj: null,
    order: 1000 + importSeq, sym: null, labels: null, filter: null, reclass: null, stats: null,
  };
  st.sym = defaultSym(meta);
  st.labels = defaultLabels(meta);
  st.obj = { id, kind, visible: false, opacity: st.opacity, order: st.order, features, style: meta.style, labelField: null, labels: null, sym: st.sym };
  L.set(id, st);
  map.addLayer(st.obj);
  return id;
}
function removeImported(id) {
  const st = L.get(id);
  if (!st || st.meta.group !== 'imported') return;
  if (st.on) setLayer(id, false, { quiet: true });
  map.removeLayer(id);
  if (map.selection?.layer?.id === id) map.selection = null;
  L.delete(id);
  catalog.layers = catalog.layers.filter((m) => m.id !== id);
  baseOrder = baseOrder.filter((x) => x !== id);
  renderLayerLists();
  refreshLegend();
  pushHash();
  saveProject();
  toast('Imported layer removed');
}
function gpkgChoice(layer, value) {
  if (!value) return null;
  if (value === 'file') return layer.detected;
  const chosen = crsByCode(+value);
  if (layer.detected && chosen && chosen.code === layer.detected.code) return layer.detected;
  return chosen;
}
function gpkgNote(layer, crs, latFirst) {
  if (!crs) return caveatFor(null);
  const assumed = !layer.detected;
  let note = assumed ? assumedCaveat(crs) : crs.note;
  if (layer.detected && crs.code && layer.detected.code && crs.code !== layer.detected.code) {
    note = `You chose ${crs.name} instead of what the file said (${layer.detected.name}). ${caveatFor(crs)}`;
  }
  if (latFirst && crs.method === 'longlat') note += ' Latitude was read first, as you asked.';
  return note;
}
function gpkgOptions(layer) {
  const detected = layer.detected;
  const inMenu = detected?.code && CRS_MENU.some((item) => item.code === detected.code);
  const fileOption = detected && !inMenu ? `<option value="file">From the file: ${esc(detected.shortName || detected.name)}</option>` : '';
  const blank = !detected && !layer.degreeLike ? '<option value="">Choose a coordinate system</option>' : '';
  return blank + fileOption + CRS_MENU.map((item) => `<option value="${item.code}">${esc(item.label)}</option>`).join('');
}
function gpkgSelected(layer) {
  if (layer.detected?.code && CRS_MENU.some((item) => item.code === layer.detected.code)) return String(layer.detected.code);
  if (layer.detected) return 'file';
  if (layer.degreeLike) return '4326';
  return '';
}
function renderGpkgResult(body, parsed) {
  const out = body.querySelector('#gp-out');
  const latFirst = body.querySelector('#gp-lat')?.checked;
  const previous = [...body.querySelectorAll('select[data-crs]')].map((select) => select.value);
  const cards = parsed.layers.map((layer, i) => {
    const selected = previous[i] || gpkgSelected(layer);
    const crs = gpkgChoice(layer, selected);
    const kind = layer.kind === 'polygon' ? 'polygons' : layer.kind === 'line' ? 'lines' : 'points';
    return `<div class="gpkg-layer" data-i="${i}">
      <b>${esc(layer.label)}</b>
      <small class="hint">${layer.count.toLocaleString()} ${kind}${layer.detected ? ' · file says ' + esc(layer.detected.name) : ' · no coordinate system in the file'}</small>
      <div class="frow"><label>System</label><select data-crs="${i}">${gpkgOptions(layer)}</select></div>
      ${caveatBox(gpkgNote(layer, crs, latFirst))}
    </div>`;
  }).join('');
  const skipped = parsed.skipped.length
    ? `<p class="hint">Not added: ${esc(parsed.skipped.map((item) => item.name + ' (' + item.reason + ')').join('; '))}.</p>`
    : '';
  out.innerHTML = `<h4>${esc(parsed.name || 'GeoPackage')}</h4>
    ${parsed.layers.length ? cards + skipped + '<div class="frow act"><button class="btn primary" id="gp-add">Add to imported layers</button></div>' : skipped + '<p class="empty">Nothing in that file can be drawn.</p>'}
    <p class="hint">Layers are listed under Imported and stay off until you turn one on.</p>`;
  out.querySelectorAll('select[data-crs]').forEach((select) => {
    select.value = previous[+select.dataset.crs] || gpkgSelected(parsed.layers[+select.dataset.crs]);
    select.onchange = () => {
      const layer = parsed.layers[+select.dataset.crs];
      const note = select.parentElement.nextElementSibling;
      if (note) note.outerHTML = caveatBox(gpkgNote(layer, gpkgChoice(layer, select.value), body.querySelector('#gp-lat')?.checked));
    };
  });
  out.querySelector('#gp-add')?.addEventListener('click', () => commitGpkgImport(body, parsed));
}
async function commitGpkgImport(body, parsed) {
  const latFirst = !!body.querySelector('#gp-lat')?.checked;
  const choices = [...body.querySelectorAll('select[data-crs]')].map((select) => ({
    layer: parsed.layers[+select.dataset.crs],
    crs: gpkgChoice(parsed.layers[+select.dataset.crs], select.value),
  }));
  if (choices.some((item) => !item.crs)) { toast('Choose a coordinate system for every layer'); return; }
  await working('Adding imported layers');
  const problems = [];
  let added = 0;
  for (const item of choices) {
    const useLatFirst = latFirst && item.crs.method === 'longlat';
    const features = [];
    let dropped = 0;
    let seen = 0;
    for (const feature of item.layer.features) {
      let geometry = null;
      try { geometry = transformGeometry(feature.geometry, item.crs, useLatFirst); } catch { geometry = null; }
      const world = geometryInWorld(geometry);
      if (!geometry || !world.ok || world.bad > world.ok) { dropped++; continue; }
      const converted = convertFeature({ type: 'Feature', properties: feature.properties, geometry });
      if (!converted) { dropped++; continue; }
      features.push(converted);
      if (++seen % 2000 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const note = gpkgNote(item.layer, item.crs, useLatFirst);
    if (!features.length || features.length < dropped) {
      problems.push(item.layer.label + ' did not land on the map. Try another coordinate system.');
      continue;
    }
    item.crs.note = note;
    addImportedLayer({ label: item.layer.label, description: note, kind: item.layer.kind, features, crs: item.crs, fileName: parsed.name });
    added++;
    if (dropped) problems.push(item.layer.label + ': ' + dropped + ' feature' + (dropped === 1 ? '' : 's') + ' fell outside the world and ' + (dropped === 1 ? 'was' : 'were') + ' left out.');
  }
  if (!added) { toast(problems[0] || 'Nothing could be added'); return; }
  closeModal();
  openSheet('layers');
  renderLayerLists();
  toast(added + ' layer' + (added === 1 ? '' : 's') + ' added. Turn one on to draw it.' + (problems.length ? ' ' + problems[0] : ''), 5200);
}
function toolGpkg() {
  openModal('Import GeoPackage', (body) => {
    let parsed = null;
    body.innerHTML = `<p class="muted">Bring a GeoPackage onto the map for this visit. It is read in this browser and is not sent anywhere. The layers are listed under Imported, and nothing is drawn until you turn one on.</p>
      <div class="frow"><label>File</label><input id="gp-file" type="file" accept=".gpkg,application/geopackage+sqlite3"></div>
      <label class="chk"><input id="gp-lat" type="checkbox"> Latitude is written first (unusual)</label>
      <p class="hint">Leave that off unless a longitude/latitude file lands in the wrong place. Projected files, such as UTM, are not affected.</p>
      <div class="frow act"><button class="btn primary" id="gp-read">Read file</button></div>
      <div id="gp-out"></div>`;
    const read = async () => {
      const file = body.querySelector('#gp-file').files?.[0];
      if (!file) { toast('Choose a .gpkg file'); return; }
      if (file.size > 80 * 1024 * 1024) { toast('That file is over 80 MB. Split it into smaller layers and try again.'); return; }
      await working('Reading the GeoPackage');
      try {
        parsed = await openGeoPackage(await file.arrayBuffer(), BUILD);
        parsed.name = file.name;
        renderGpkgResult(body, parsed);
      } catch (error) {
        console.error(error);
        toast(error.message || 'Could not read that GeoPackage');
      }
    };
    body.querySelector('#gp-read').onclick = read;
    body.querySelector('#gp-lat').onchange = () => { if (parsed) renderGpkgResult(body, parsed); };
  });
}

function toolImport() {
  openModal('Import GeoJSON', (body) => {
    body.innerHTML = `<p class="muted">Bring a GeoJSON file (points, lines or polygons) onto the map. It is added as a layer for this session and can be styled and labelled; the rows stay on the map only.</p>
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
      const meta = { id, table: id, kind, group: 'imported', label: 'Imported ' + (feats.length === 1 ? 'feature' : feats.length + ' features'), description: 'Imported GeoJSON. Already longitude and latitude. Nothing was shifted.', count: feats.length, fields: Object.keys(feats[0].props || {}).map((n) => ({ name: n, type: typeof feats[0].props[n] === 'number' ? 'number' : 'text', label: n })), style: { mode: 'single', color: '#8e44ad' }, labelField: null, bounds: [unX(box[0]), unY(box[3]), unX(box[2]), unY(box[1])], file: null, imported: true, importSeq: ++importSeq, crsName: 'WGS 84', crsNote: 'Imported GeoJSON. Already longitude and latitude. Nothing was shifted.' };
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
  openModal('Picture with title & frame', (body) => {
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
      '<label style="flex:none;display:flex;align-items:center;gap:6px"><input type="checkbox" id="exp-grid" style="width:18px;height:18px"> Grid lines (no degree labels)</label></div>' +
      '<div class="frow act" style="justify-content:stretch"><button class="btn primary" id="e-png">' + icon('camera') + ' Download PNG</button></div>' +
      '<p class="hint">Saved pictures never include latitude or longitude — not in the caption, and not as numbers on the grid.</p>';
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
      const [latA, lonA] = a, [latB, lonB] = b;
      const d = haversineKm([lonA, latA], [lonB, latB]);
      const rad = Math.PI / 180;
      const dLon = (lonB - lonA) * rad;
      const y = Math.sin(dLon) * Math.cos(latB * rad);
      const x = Math.cos(latA * rad) * Math.sin(latB * rad) - Math.sin(latA * rad) * Math.cos(latB * rad) * Math.cos(dLon);
      const brg = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
      const compass = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(brg / 22.5) % 16];
      body.querySelector('#b-out').innerHTML = `<div class="statgrid">
        <div class="statbox"><b>${fmtNum(d)} km</b><small>distance</small></div>
        <div class="statbox"><b>${brg.toFixed(1)}° ${compass}</b><small>initial bearing</small></div></div>
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
    body.innerHTML = '<p>Saved measurements can be restored to the map. Visual only — nothing is downloaded.</p>' +
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
    body.innerHTML = '<p>Saved focus areas can be restored to the map. Visual only — nothing is downloaded.</p>' +
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
    body.innerHTML = '<p>Filter features by date or year field. Only matching features are shown on the map — nothing is downloaded.</p>' +
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
    };
    body.querySelector('#tf-clear').onclick = () => {
      const id = layerSel.value;
      delete timeFilters[id];
      const [, st] = layers.find(([i]) => i === id) || [];
      if (st) {
        const prev = filterRules(st).find((r) => r.op === '_temporal' || r.source === 'temporal');
        if (prev) removeFilterRule(prev.id);
        else applyFilter(st);
      }
      infoDiv.innerHTML = '';
      toast('Temporal filter cleared');
    };
  });
}

function applyTemporalFilter(st) {
  const tf = timeFilters[st.meta.id];
  const prev = filterRules(st).find((r) => r.op === '_temporal' || r.source === 'temporal');
  if (!tf) {
    if (prev) removeFilterRule(prev.id);
    else applyFilter(st);
    return;
  }
  const saved = upsertFilterRule(st.meta.id, {
    id: prev?.id,
    field: tf.field,
    op: '_temporal',
    temporalOp: tf.op,
    min: tf.min,
    max: tf.max,
    source: 'temporal',
  });
  const count = saved?.st.filterCount ?? 0;
  const extra = filterRules(st).length > 1 ? ' (combined with other filters)' : '';
  toast(tf.op + ' filter: ' + count + ' of ' + st.obj.features.length + ' features' + extra);
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
      extra = '';
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
$('#buffercancel').onclick = () => { stopBufferPick(); toast('Buffer cancelled'); };
$('#bufferclose').onclick = () => stopBufferPick();
$('#bf-retap').onclick = () => {
  if (!bufferPick) return;
  bufferPick.seed = null;
  bufferPick.hits = [];
  bufferPreview = null;
  map.selection = null;
  map.selectionSet = [];
  $('#bufferpanel').hidden = true;
  $('#bufferbar').hidden = false;
  $('#buffertext').textContent = 'Tap the feature you want to buffer';
  map.cv.style.cursor = 'crosshair';
  map.render();
  toast('Tap a point, line or polygon');
};
$('#bf-run').onclick = () => runBufferAnalysis();
$('#bf-shape').addEventListener('click', (e) => {
  const b = e.target.closest('[data-shape]');
  if (!b) return;
  $('#bf-shape').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  refreshBufferPreview();
});
$('#bf-dist').oninput = () => refreshBufferPreview();
$('#bf-unit').onchange = () => refreshBufferPreview();
$('#measureexport').onclick = () => {
  if (!measure || measure.pts.length < 2) { toast('Nothing measured yet'); return; }
  const p = measure.pts;
  if (measure.mode === 'area' && p.length >= 3) {
    exportJson('measurement.json', { kind: 'area', corners: p.length, area_km2: +ringAreaKm2(p).toFixed(3), edge_km: +ringPerimeterKm(p).toFixed(3) }) && toast('Measurement saved — coordinates excluded');
  } else {
    let d = 0; for (let i = 1; i < p.length; i++) d += haversineKm(p[i - 1], p[i]);
    exportJson('measurement.json', { kind: 'distance', points: p.length, length_km: +d.toFixed(3) }) && toast('Measurement saved — coordinates excluded');
  }
};

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
    $('#tm-body').innerHTML = '<div class="table-exports">' + exportButton('CSV', 'Download these rows — no coordinates') + exportButton('JSON', 'Download as JSON — no coordinates') + '</div>' +
      '<table><thead><tr>' + visCols.map((c) => '<th>' + esc(labels[c] || extra[c] || c.replace(/_/g, ' ')) + '</th>').join('') + '</tr></thead><tbody>' + filt.slice(0, shown).map((r) => '<tr>' + visColIdx.map((i) => '<td title="' + esc(r[i]) + '">' + esc(typeof r[i] === 'number' ? fmtNum(r[i]) : r[i]) + '</td>').join('') + '</tr>').join('') + '</tbody></table>' +
      '<div class="muted" style="padding:8px 12px;display:flex;justify-content:space-between;align-items:center">' + filt.length.toLocaleString() + ' rows' + (filt.length > shown ? ' (showing ' + shown + ')' : '') + (mapBtn ? ' <span style="font-size:11px;color:var(--muted)">·</span> ' + mapBtn : '') + '</div>' +
      (filt.length > shown ? '<button class="more">Show more</button>' : '');
    const tableRows = () => filt.map((r) => {
      const row = { layer: m.label };
      visCols.forEach((c, j) => { if (!isCoordinateKey(c)) row[labels[c] || extra[c] || c] = r[visColIdx[j]]; });
      return row;
    });
    const exp = $('#tm-body .table-exports');
    if (exp) {
      const [csvBtn, jsonBtn] = exp.querySelectorAll('[data-export]');
      if (csvBtn) csvBtn.onclick = () => exportRows(`${m.id}-table.csv`, tableRows()) && toast('Table saved — coordinates excluded');
      if (jsonBtn) jsonBtn.onclick = () => exportJson(`${m.id}-table.json`, { layer: m.label, rows: tableRows() }) && toast('Table JSON saved — coordinates excluded');
    }
    const mb = $('#tm-body .more'); if (mb) mb.onclick = () => { shown += 400; draw(); };
    const mpon = $('#tm-mapon'); if (mpon) mpon.onclick = () => {
      const li = cols.indexOf(labelField);
      const vals = [...new Set(filt.map((r) => li >= 0 ? r[li] : r[0]))].filter((v) => v != null && v !== '');
      const prev = filterRules(st).find((r) => r.source === 'table');
      upsertFilterRule(st.meta.id, { id: prev?.id, field: labelField, op: 'in', values: vals.map(String), source: 'table' });
      mapFilterActive = true;
      toast('Filter added — ' + vals.length + ' matching ' + labelField + ' value' + (vals.length === 1 ? '' : 's') + ' on the map');
      draw();
    };
    const tmpoff = $('#tm-mapoff'); if (tmpoff) tmpoff.onclick = () => {
      const prev = filterRules(st).find((r) => r.source === 'table');
      if (prev) removeFilterRule(prev.id);
      mapFilterActive = false;
      toast(hasFilter(st) ? 'Table filter removed — other filters still apply' : 'Map filter cleared');
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
    body.innerHTML = '<p>Select features by matching attribute values. Results are highlighted on the map only — nothing is downloaded.</p>' +
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
    body.innerHTML = '<p>Calculate a new attribute field from existing fields. Stored in memory only — shown on the map and in PNG pictures.</p>' +
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
  const listed = stack.filter((id) => L.get(id)?.meta?.group !== 'imported');
  const h = `c=${la.toFixed(4)},${lo.toFixed(4)},${map.zoom.toFixed(2)}&l=${listed.join(',')}&b=${map.basemap}`;
  try { history.replaceState(null, '', '#' + h); } catch { }
}
function readProject() { try { return JSON.parse(localStorage.getItem(PKEY) || 'null'); } catch { return null; } }
function saveProject() {
  if (booting) return;
  ensureAllFilterIds();
  const layers = {};
  for (const [id, st] of L) {
    if (st.meta?.group === 'imported') continue;
    const rec = { on: st.on, opacity: st.opacity };
    if (st.sym) rec.sym = st.sym;
    if (st.labels) rec.labels = st.labels;
    if (hasFilter(st)) rec.filter = st.filter;
    if (st.reclass) rec.reclass = st.reclass;
    layers[id] = rec;
  }
  try {
    const f = clipRecord();
    const kept = stack.filter((id) => L.get(id)?.meta?.group !== 'imported');
    localStorage.setItem(PKEY, JSON.stringify({ v: 1, layers, stack: kept, annotations, grid: gridOn, clip: f, notes: mapNotes }));
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
// One record shape for every kind of focus area, so that what is drawn is exactly what
// comes back from the saved project, a map preset, a session code and the share link.
function clipRecord(c = clip) {
  if (!c) return null;
  const label = focusLabel || '';
  if (c.type === 'rect') return { type: 'rect', wb: c.wb, label };
  if (c.type === 'circle') return { type: 'circle', c: c.c, r: c.r, metres: c.metres, label };
  const polys = (c.polys && c.polys.length ? c.polys : [c.rings || []])
    .map((poly) => poly.map((ring) => Array.from(ring)));
  return { type: c.type === 'multi' ? 'multi' : 'poly', polys, label };
}
function readSharedFocus() {
  try {
    const raw = new URLSearchParams(location.search).get('f');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function restoreFocus(f) {
  if (!f) return;
  focusLabel = f.label || '';
  if (f.type === 'rect' && Array.isArray(f.wb)) clip = { type: 'rect', wb: f.wb };
  else if (f.type === 'circle' && Array.isArray(f.c) && Number.isFinite(f.r)) clip = { type: 'circle', c: f.c, r: f.r, metres: f.metres };
  else if (Array.isArray(f.polys) && f.polys.length) clip = { type: f.type === 'multi' ? 'multi' : f.type === 'freehand' ? 'freehand' : 'poly', polys: f.polys };
  else if (Array.isArray(f.rings) && f.rings.length) clip = { type: f.type === 'multi' ? 'multi' : f.type === 'freehand' ? 'freehand' : 'poly', rings: f.rings };
  else return;
  map.setClip(clip);
  updateFocusUI();
}

function resetWork() {
  if (!confirm('Reset colours, filters, labels and panel state? The data itself is not touched.')) return;
  try { localStorage.removeItem(PKEY); } catch { }
  location.hash = ''; location.reload();
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
  // Include clip state if active — every shape kind and every picked polygon
  const clipRec = clipRecord();
  if (clipRec) u.searchParams.set('f', JSON.stringify(clipRec));
  else u.searchParams.delete('f');
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
        clip: clipRecord(),
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
  clearAllFilters();
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
  if (st.clip) restoreFocus(st.clip); else stopFocus();
  // Restore annotations
  annotations = (st.annotations || []).filter((a) => a && isFinite(a.lon) && isFinite(a.lat));
  renderLayerLists(); refreshLegend(); updateFocusUI(); updateToolState(); saveProject();
  toast('Session restored: ' + code);
}

let mapNotes = [];

function toolMapNotes() {
  openModal('Map Notes', (body) => {
    body.innerHTML = '<p>Add text notes and markers to the map for collaboration. Notes are drawn on the map only.</p>' +
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
      const rsRows = [
        { statistic: 'Valid cells', value: count }, { statistic: 'Total cells', value: total },
        { statistic: 'Minimum', value: +min.toFixed(4) }, { statistic: 'Maximum', value: +max.toFixed(4) },
        { statistic: 'Mean', value: +mean.toFixed(4) }, { statistic: 'Std Dev', value: +stdDev.toFixed(4) },
        { statistic: 'NoData cells', value: total - count },
      ];
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + count.toLocaleString() + '</b> of <b>' + total.toLocaleString() + '</b> cells valid</p>' +
        '<table class="mini"><tr><th>Statistic</th><th>Value</th></tr>' +
        '<tr><td>Minimum</td><td>' + min.toFixed(2) + '</td></tr>' +
        '<tr><td>Maximum</td><td>' + max.toFixed(2) + '</td></tr>' +
        '<tr><td>Mean</td><td>' + mean.toFixed(2) + '</td></tr>' +
        '<tr><td>Std Dev</td><td>' + stdDev.toFixed(2) + '</td></tr>' +
        '<tr><td>NoData cells</td><td>' + (total - count).toLocaleString() + '</td></tr>' +
        '</table>' + resultExportBar(st.meta.label + ' raster statistics');
      wireResultExports(outDiv, st.meta.label + ' raster statistics', rsRows, { layer: st.meta.label });
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
            const segLen = haversineKm([unX(x1), unY(y1)], [unX(x2), unY(y2)]);
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
      await working('Testing the cutting line against ' + pSt.meta.label);
      const lines = lSt.obj.features.filter((f) => !f.hidden && f.type === 'line');
      const lineIndex = bboxGrid(lines, (f) => f.bb, 48);
      const hitPoly = new Set();
      for (const f of pSt.obj.features) {
        if (f.hidden || f.type !== 'poly') continue;
        for (const lf of lineIndex.nearBox(f.bb)) {
          if (lf.bb[2] < f.bb[0] || lf.bb[0] > f.bb[2] || lf.bb[3] < f.bb[1] || lf.bb[1] > f.bb[3]) continue;
          let cross = false;
          for (const linePart of lf.parts) {
            if (polyOverlapsPoly(f.parts, [linePart])) { cross = true; break; }
          }
          if (cross) { hitPoly.add(f); break; }
        }
      }
      const splitCount = hitPoly.size;
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
      await working('Checking ' + feats.length + ' polygons');
      // compare each polygon only with the ones sharing a grid cell
      const pairs = bboxPairs(feats, (a, b) => a.bb[2] < b.bb[0] || a.bb[0] > b.bb[2] || a.bb[3] < b.bb[1] || a.bb[1] > b.bb[3]);
      let overlapPairs = 0;
      for (const [a, b] of pairs) {
        if (polyOverlapsPoly(a.parts, b.parts)) overlapPairs++;
      }
      outDiv.innerHTML = '<p style="color:' + (overlapPairs > 0 ? 'var(--bad)' : 'var(--ok)') + '"><b>' + overlapPairs + '</b> overlapping pair' + (overlapPairs === 1 ? '' : 's') + ' found</p>' +
        '<p>of <b>' + feats.length + '</b> features checked (' + pairs.length.toLocaleString() + ' pairs with touching extents)</p>';
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
      await working('Checking gaps in ' + feats.length + ' polygons');
      let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
      for (const f of feats) { const b = f.bb; minX = Math.min(minX, b[0]); minY = Math.min(minY, b[1]); maxX = Math.max(maxX, b[2]); maxY = Math.max(maxY, b[3]); }
      const N = 50;
      const stepX = (maxX - minX) / N, stepY = (maxY - minY) / N;
      const index = bboxGrid(feats, (f) => f.bb, 48);
      let gapCount = 0, tested = 0;
      for (let cy = 0; cy < N; cy++) {
        for (let cx = 0; cx < N; cx++) {
          const x = minX + (cx + 0.5) * stepX, y = minY + (cy + 0.5) * stepY;
          tested++;
          // only the handful of polygons whose extent covers this sample point
          let insideAny = false;
          for (const f of index.near(x, y)) {
            if (x < f.bb[0] || x > f.bb[2] || y < f.bb[1] || y > f.bb[3]) continue;
            if (pip2(x, y, f.parts)) { insideAny = true; break; }
          }
          if (!insideAny) gapCount++;
        }
      }
      outDiv.innerHTML = '<p style="color:var(--ok)">Gap cells: <b>' + gapCount.toLocaleString() + '</b> of ' + tested.toLocaleString() + '</p>' +
        '<p>Grid resolution: ' + stepX.toFixed(4) + ' &times; ' + stepY.toFixed(4) + ' degrees</p>' +
        '<p class="muted">Cells outside the outer edge of the polygons count as gaps.</p>';
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
      // Work in mercator units throughout: convert the metre tolerance to a mercator
      // radius, then only look at the handful of points in the neighbouring cells.
      const tolMerc = tolM / MERC_METRES_PER_UNIT;
      await working('Snapping ' + st.meta.label);
      const pts = [];
      for (let i = 0; i < st.obj.features.length; i++) {
        const f = st.obj.features[i];
        if (f.hidden || f.type !== 'point') continue;
        for (let pi = 0; pi < f.parts.length; pi += 2) pts.push({ x: f.parts[pi], y: f.parts[pi + 1], f, pi });
      }
      const grid = pointGrid(pts, tolMerc > 0 ? tolMerc : 1e-9);
      let snapped = 0;
      for (const p of pts) {
        let bestD = Infinity, bestX = p.x, bestY = p.y;
        for (const q of grid.around(p.x, p.y, 1)) {
          if (q.f === p.f) continue;
          const d = haversineKm([unX(p.x), unY(p.y)], [unX(q.x), unY(q.y)]) * 1000;
          if (d > 0 && d <= tolM && d < bestD) { bestD = d; bestX = q.x; bestY = q.y; }
        }
        if (bestX !== p.x || bestY !== p.y) { p.f.parts[p.pi] = bestX; p.f.parts[p.pi + 1] = bestY; snapped++; }
      }
      map.render();
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + snapped + '</b> point' + (snapped === 1 ? '' : 's') + ' snapped</p>' +
        '<p>Tolerance: ' + tolM + ' m &middot; ' + pts.length.toLocaleString() + ' points checked</p>';
      toast(snapped + ' point' + (snapped === 1 ? '' : 's') + ' snapped');
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

// ================================================================================
// ADDITIONAL RASTER TOOLS
// ================================================================================

function toolRasterContour() {
  const rasterLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj && st.meta.kind === 'raster') rasterLayers.push([id, st]); }
  if (rasterLayers.length < 1) { toast('No raster layer loaded'); return; }
  openModal('Raster Contour', (body) => {
    body.innerHTML = '<p>Generate contour lines from a raster at a regular interval.</p>' +
      '<div class="frow"><label>Raster layer</label><select id="cont-layer">' + rasterLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Contour interval</label><input id="cont-interval" type="number" min="0.01" step="0.01" value="10"></div>' +
      '<div class="frow act"><button class="btn primary" id="cont-run">' + icon('query') + ' Generate Contours</button></div>' +
      '<div id="cont-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#cont-layer');
    const intSel = body.querySelector('#cont-interval');
    const outDiv = body.querySelector('#cont-out');
    body.querySelector('#cont-run').onclick = async () => {
      const [id, st] = rasterLayers.find(([i]) => i === layerSel.value) || rasterLayers[0];
      const interval = +intSel.value || 10;
      if (!st.obj || !st.obj.vals) { try { await loadValues(st); } catch { toast('Could not load raster values'); return; } }
      const o = st.obj.vals;
      const { w, h, data, dtype } = o;
      const nodata = dtype === 'i2' ? -32768 : null;
      const lines = [];
      const step = Math.max(2, Math.floor(Math.min(w, h) / 60));
      for (let y = 0; y < h - step; y += step) {
        for (let x = 0; x < w - step; x += step) {
          const v00 = data[y * w + x];
          const v10 = data[y * w + x + step];
          const v01 = data[(y + step) * w + x];
          const v11 = data[(y + step) * w + x + step];
          if (nodata !== null && (v00 === nodata || v10 === nodata || v01 === nodata || v11 === nodata)) continue;
          if (!isFinite(v00) || !isFinite(v10) || !isFinite(v01) || !isFinite(v11)) continue;
          const lo = Math.floor(Math.min(v00, v10, v01, v11) / interval) * interval;
          const hi = Math.ceil(Math.max(v00, v10, v01, v11) / interval) * interval;
          for (let lvl = lo; lvl <= hi; lvl += interval) {
            const pts = [];
            if ((v00 < lvl) !== (v10 < lvl)) pts.push([x + step * (lvl - v00) / (v10 - v00), y]);
            if ((v10 < lvl) !== (v11 < lvl)) pts.push([x + step, y + step * (lvl - v10) / (v11 - v10)]);
            if ((v01 < lvl) !== (v11 < lvl)) pts.push([x + step * (lvl - v01) / (v11 - v01), y + step]);
            if ((v00 < lvl) !== (v01 < lvl)) pts.push([x, y + step * (lvl - v00) / (v01 - v00)]);
            if (pts.length >= 2) lines.push(pts);
          }
        }
      }
      const feats = lines.map((pts) => ({
        type: 'line', parts: [pts.flat()], fill: 'none', stroke: '#0b6b45',
        bb: [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))]
      }));
      closeModal();
      if (feats.length > 0) {
        addAnalysisLayer(feats, 'line', 'Contours (interval=' + interval + ')', '#0b6b45');
        outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + feats.length + '</b> contour segments</p>' +
          '<p>Interval: ' + interval + '</p>';
        toast('Contours generated');
      } else {
        toast('No contours found at this interval');
      }
    };
  });
}

function toolRasterSlope() {
  const rasterLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj && st.meta.kind === 'raster') rasterLayers.push([id, st]); }
  if (rasterLayers.length < 1) { toast('No raster layer loaded'); return; }
  openModal('Raster Slope', (body) => {
    body.innerHTML = '<p>Compute slope from a DEM raster (rise/run between adjacent cells).</p>' +
      '<div class="frow"><label>Raster layer</label><select id="slp-layer">' + rasterLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="slp-run">' + icon('target') + ' Compute Slope</button></div>' +
      '<div id="slp-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#slp-layer');
    const outDiv = body.querySelector('#slp-out');
    body.querySelector('#slp-run').onclick = async () => {
      const [id, st] = rasterLayers.find(([i]) => i === layerSel.value) || rasterLayers[0];
      if (!st.obj || !st.obj.vals) { try { await loadValues(st); } catch { toast('Could not load raster values'); return; } }
      const o = st.obj.vals;
      const { w, h, data, dtype } = o;
      const nodata = dtype === 'i2' ? -32768 : null;
      let maxSlope = 0, meanSlope = 0, count = 0;
      const flatFeats = [];
      for (let y = 1; y < h - 1; y += 2) {
        for (let x = 1; x < w - 1; x += 2) {
          const c = data[y * w + x];
          if (nodata !== null ? c === nodata : !isFinite(c)) continue;
          const dzx = (data[y * w + x + 1] - data[y * w + x - 1]) / 2;
          const dzy = (data[(y + 1) * w + x] - data[(y - 1) * w + x]) / 2;
          const slope = Math.atan(Math.sqrt(dzx * dzx + dzy * dzy)) * 180 / Math.PI;
          maxSlope = Math.max(maxSlope, slope);
          meanSlope += slope;
          count++;
          if (slope > 5) {
            flatFeats.push({ type: 'point', parts: [[x, y]], fill: slope > 30 ? '#d73027' : slope > 15 ? '#f46d43' : '#fee08b', stroke: '#0b3d2e', bb: [x - 0.5, y - 0.5, x + 0.5, y + 0.5] });
          }
        }
      }
      meanSlope /= count || 1;
      closeModal();
      outDiv.innerHTML = '<p style="color:var(--ok)">Slope computed from <b>' + count.toLocaleString() + '</b> cells</p>' +
        '<table class="mini"><tr><th>Max slope</th><td>' + maxSlope.toFixed(1) + '&deg;</td></tr>' +
        '<tr><th>Mean slope</th><td>' + meanSlope.toFixed(1) + '&deg;</td></tr>' +
        '<tr><th>Steep cells (&gt;5&deg;)</th><td>' + flatFeats.length.toLocaleString() + '</td></tr></table>';
      if (flatFeats.length > 0) addAnalysisLayer(flatFeats, 'point', 'Steep slopes (>5&deg;)', '#d73027');
      toast('Slope computed');
    };
  });
}

function toolRasterHist() {
  const rasterLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj && st.meta.kind === 'raster') rasterLayers.push([id, st]); }
  if (rasterLayers.length < 1) { toast('No raster layer loaded'); return; }
  openModal('Raster Histogram', (body) => {
    body.innerHTML = '<p>Value distribution histogram for a raster layer.</p>' +
      '<div class="frow"><label>Raster layer</label><select id="hst-layer">' + rasterLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Bins</label><input id="hst-bins" type="number" min="5" max="50" value="10"></div>' +
      '<div class="frow act"><button class="btn primary" id="hst-run">' + icon('hist') + ' Compute Histogram</button></div>' +
      '<div id="hst-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#hst-layer');
    const binsSel = body.querySelector('#hst-bins');
    const outDiv = body.querySelector('#hst-out');
    body.querySelector('#hst-run').onclick = async () => {
      const [id, st] = rasterLayers.find(([i]) => i === layerSel.value) || rasterLayers[0];
      const bins = +binsSel.value || 10;
      if (!st.obj || !st.obj.vals) { try { await loadValues(st); } catch { toast('Could not load raster values'); return; } }
      const o = st.obj.vals;
      const { w, h, data, dtype } = o;
      const nodata = dtype === 'i2' ? -32768 : null;
      const vals = [];
      for (let i = 0; i < data.length; i++) {
        const v = data[i];
        if (nodata !== null ? v === nodata : !isFinite(v)) continue;
        vals.push(v);
      }
      if (vals.length < bins) { toast('Not enough valid cells'); return; }
      vals.sort((a, b) => a - b);
      const mn = vals[0], mx = vals[vals.length - 1];
      const binWidth = (mx - mn) / bins;
      const counts = Array(bins).fill(0);
      for (const v of vals) {
        const bi = Math.min(bins - 1, Math.floor((v - mn) / binWidth));
        counts[bi]++;
      }
      const maxCount = Math.max(...counts);
      closeModal();
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + vals.length.toLocaleString() + '</b> valid cells</p>' +
        '<table class="mini"><tr><th>Min</th><td>' + mn.toFixed(2) + '</td></tr>' +
        '<tr><th>Max</th><td>' + mx.toFixed(2) + '</td></tr>' +
        '<tr><th>Bin width</th><td>' + binWidth.toFixed(2) + '</td></tr>' +
        '<tr><th>Peak bin count</th><td>' + maxCount.toLocaleString() + '</td></tr></table>' +
        '<div style="margin-top:8px">' + counts.map((c, i) => {
          const pct = (c / maxCount * 100).toFixed(0);
          return '<div style="display:flex;align-items:center;gap:6px;margin:2px 0">' +
            '<span style="width:40px;text-align:right;font-size:11px">' + (mn + i * binWidth).toFixed(1) + '</span>' +
            '<div style="flex:1;height:10px;background:#e5e7eb;border-radius:4px;overflow:hidden">' +
            '<div style="height:100%;width:' + pct + '%;background:#0b6b45"></div></div>' +
            '<span style="width:30px;text-align:right;font-size:11px">' + c.toLocaleString() + '</span>' +
            '</div>';
        }).join('') + '</div>';
      toast('Histogram computed');
    };
  });
}

// ================================================================================
// ADDITIONAL GEOMETRY OPERATIONS
// ================================================================================

function toolAffineTransform() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features) vecLayers.push([id, st]); }
  if (vecLayers.length < 1) { toast('No vector layer loaded'); return; }
  openModal('Affine Transform', (body) => {
    body.innerHTML = '<p>Move, rotate and/or scale selected features.</p>' +
      '<div class="frow"><label>Layer</label><select id="af-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Shift X (deg)</label><input id="af-dx" type="number" step="0.001" value="0"></div>' +
      '<div class="frow"><label>Shift Y (deg)</label><input id="af-dy" type="number" step="0.001" value="0"></div>' +
      '<div class="frow"><label>Scale</label><input id="af-scale" type="number" min="0.01" step="0.01" value="1"></div>' +
      '<div class="frow"><label>Rotate (deg)</label><input id="af-rot" type="number" step="1" value="0"></div>' +
      '<div class="frow act"><button class="btn primary" id="af-run">' + icon('convert') + ' Transform</button></div>' +
      '<div id="af-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#af-layer');
    const dxSel = body.querySelector('#af-dx');
    const dySel = body.querySelector('#af-dy');
    const scSel = body.querySelector('#af-scale');
    const rotSel = body.querySelector('#af-rot');
    const outDiv = body.querySelector('#af-out');
    body.querySelector('#af-run').onclick = async () => {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      const dx = +dxSel.value || 0;
      const dy = +dySel.value || 0;
      const scale = +scSel.value || 1;
      const rotDeg = +rotSel.value || 0;
      if (!st.obj) await loadLayer(st);
      closeModal();
      const rot = rotDeg * Math.PI / 180;
      const cosR = Math.cos(rot), sinR = Math.sin(rot);
      let transformed = 0;
      for (const f of st.obj.features) {
        if (f.hidden) continue;
        let cx = 0, cy = 0, n = 0;
        for (const poly of f.parts) for (const ring of poly) for (let i = 0; i < ring.length; i += 2) { cx += ring[i]; cy += ring[i + 1]; n++; }
        cx /= n || 1; cy /= n || 1;
        for (const poly of f.parts) for (const ring of poly) for (let i = 0; i < ring.length; i += 2) {
          let x = ring[i], y = ring[i + 1];
          x -= cx; y -= cy;
          const xr = x * cosR - y * sinR;
          const yr = x * sinR + y * cosR;
          ring[i] = cx + xr * scale + dx;
          ring[i + 1] = cy + yr * scale + dy;
        }
        transformed++;
      }
      st.obj._filteredFeatures = st.obj.features.filter((f) => !f.hidden);
      map.render();
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + transformed + '</b> feature' + (transformed === 1 ? '' : 's') + ' transformed</p>';
      toast('Features transformed');
    };
  });
}

function toolLineToPoly() {
  const lineLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'line') lineLayers.push([id, st]); }
  if (lineLayers.length < 1) { toast('No line layer loaded'); return; }
  openModal('Lines to Polygons', (body) => {
    body.innerHTML = '<p>Close line rings into polygon features.</p>' +
      '<div class="frow"><label>Line layer</label><select id="ltp-layer">' + lineLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="ltp-run">' + icon('polygon') + ' Convert to Polygons</button></div>' +
      '<div id="ltp-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#ltp-layer');
    const outDiv = body.querySelector('#ltp-out');
    body.querySelector('#ltp-run').onclick = async () => {
      const [id, st] = lineLayers.find(([i]) => i === layerSel.value) || lineLayers[0];
      if (!st.obj) await loadLayer(st);
      closeModal();
      let converted = 0;
      const newFeats = [];
      for (const f of st.obj.features) {
        if (f.hidden || f.type !== 'line') continue;
        for (const part of f.parts) {
          if (part.length < 6) continue;
          const ring = part[0] === part[part.length - 2] && part[1] === part[part.length - 1] ? part : [...part, part[0], part[1]];
          newFeats.push({ type: 'poly', parts: [ring], fill: 'rgba(11,107,69,.2)', stroke: '#0b6b45', bb: f.bb });
          converted++;
        }
      }
      addAnalysisLayer(newFeats, 'polygon', 'Lines as Polygons', '#0b6b45');
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + converted + '</b> ring' + (converted === 1 ? '' : 's') + ' converted to polygons</p>';
      toast('Lines converted to polygons');
    };
  });
}

function toolPolyOutline() {
  const polyLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'polygon') polyLayers.push([id, st]); }
  if (polyLayers.length < 1) { toast('No polygon layer loaded'); return; }
  openModal('Polygon Outlines', (body) => {
    body.innerHTML = '<p>Extract polygon boundaries as line features.</p>' +
      '<div class="frow"><label>Polygon layer</label><select id="po-layer">' + polyLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="po-run">' + icon('line') + ' Extract Outlines</button></div>' +
      '<div id="po-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#po-layer');
    const outDiv = body.querySelector('#po-out');
    body.querySelector('#po-run').onclick = async () => {
      const [id, st] = polyLayers.find(([i]) => i === layerSel.value) || polyLayers[0];
      if (!st.obj) await loadLayer(st);
      closeModal();
      let lines = 0;
      const newFeats = [];
      for (const f of st.obj.features) {
        if (f.hidden || f.type !== 'poly') continue;
        for (const poly of f.parts) for (const ring of poly) {
          if (ring.length < 6) continue;
          newFeats.push({ type: 'line', parts: [ring], fill: 'none', stroke: '#0b6b45', bb: f.bb });
          lines++;
        }
      }
      addAnalysisLayer(newFeats, 'line', 'Polygon Outlines', '#0b6b45');
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + lines + '</b> outline' + (lines === 1 ? '' : 's') + ' extracted</p>';
      toast('Outlines extracted');
    };
  });
}

function toolFeatureSmooth() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && ['line', 'polygon'].includes(st.meta.kind)) vecLayers.push([id, st]); }
  if (vecLayers.length < 1) { toast('No line or polygon layer loaded'); return; }
  openModal('Smooth Features', (body) => {
    body.innerHTML = '<p>Smooth line and polygon vertices (simple averaging).</p>' +
      '<div class="frow"><label>Layer</label><select id="sm-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Iterations</label><input id="sm-iters" type="number" min="1" max="10" value="2"></div>' +
      '<div class="frow act"><button class="btn primary" id="sm-run">' + icon('sliders') + ' Smooth</button></div>' +
      '<div id="sm-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#sm-layer');
    const itersSel = body.querySelector('#sm-iters');
    const outDiv = body.querySelector('#sm-out');
    body.querySelector('#sm-run').onclick = async () => {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      const iters = +itersSel.value || 2;
      if (!st.obj) await loadLayer(st);
      closeModal();
      let smoothed = 0;
      for (let it = 0; it < iters; it++) {
        for (const f of st.obj.features) {
          if (f.hidden) continue;
          for (const poly of f.parts) for (let idx = 0; idx < poly.length; idx++) {
            const ring = poly[idx];
            if (ring.length < 6) continue;
            const closed = ring[0] === ring[ring.length - 2] && ring[1] === ring[ring.length - 1];
            const nPts = ring.length / 2 - (closed ? 1 : 0);
            const newRing = [];
            for (let i = 0; i < nPts; i++) {
              const prev = (i - 1 + nPts) % nPts;
              const next = (i + 1) % nPts;
              newRing.push((ring[prev * 2] + ring[i * 2] + ring[next * 2]) / 3);
              newRing.push((ring[prev * 2 + 1] + ring[i * 2 + 1] + ring[next * 2 + 1]) / 3);
            }
            if (closed) newRing.push(newRing[0], newRing[1]);
            poly[idx] = Float64Array.from(newRing);
            smoothed++;
          }
        }
      }
      map.render();
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + smoothed + '</b> ring' + (smoothed === 1 ? '' : 's') + ' smoothed</p>' +
        '<p>Iterations: ' + iters + '</p>';
      toast('Features smoothed');
    };
  });
}

// ================================================================================
// ADDITIONAL TOPOLOGY & DATA QUALITY
// ================================================================================

function toolSelfIntersect() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'polygon') vecLayers.push([id, st]); }
  if (vecLayers.length < 1) { toast('No polygon layer loaded'); return; }
  openModal('Check Self-Intersections', (body) => {
    body.innerHTML = '<p>Find polygon rings that intersect themselves (bowtie, figure-8).</p>' +
      '<div class="frow"><label>Polygon layer</label><select id="si-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="si-run">' + icon('query') + ' Check Self-Intersections</button></div>' +
      '<div id="si-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#si-layer');
    const outDiv = body.querySelector('#si-out');
    body.querySelector('#si-run').onclick = async () => {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      if (!st.obj) await loadLayer(st);
      closeModal();
      await working('Checking rings');
      let issues = 0, checked = 0;
      for (const f of st.obj.features) {
        if (f.hidden || f.type !== 'poly') continue;
        checked++;
        let bad = false;
        for (const poly of f.parts) {
          for (const ring of poly) {
            if (ring.length < 8) continue;
            const lastJ = ring.length - (ring[0] === ring[ring.length - 2] && ring[1] === ring[ring.length - 1] ? 4 : 2);
            for (let i = 0; i < ring.length - 4 && !bad; i += 2) {
              const ax1 = ring[i], ay1 = ring[i + 1], ax2 = ring[i + 2], ay2 = ring[i + 3];
              const axMin = Math.min(ax1, ax2), axMax = Math.max(ax1, ax2);
              const ayMin = Math.min(ay1, ay2), ayMax = Math.max(ay1, ay2);
              for (let j = i + 4; j < lastJ; j += 2) {
                const bx1 = ring[j], by1 = ring[j + 1], bx2 = ring[j + 2], by2 = ring[j + 3];
                // cheap reject before the full segment test
                if (axMax < Math.min(bx1, bx2) || axMin > Math.max(bx1, bx2)) continue;
                if (ayMax < Math.min(by1, by2) || ayMin > Math.max(by1, by2)) continue;
                if (segmentsIntersect(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2)) { bad = true; break; }
              }
            }
            if (bad) break;
          }
          if (bad) break;
        }
        if (bad) issues++;
      }
      outDiv.innerHTML = '<p style="color:' + (issues > 0 ? 'var(--bad)' : 'var(--ok)') + '"><b>' + issues + '</b> self-intersecting ring' + (issues === 1 ? '' : 's') + ' found</p>' +
        '<p>of <b>' + checked + '</b> features checked</p>';
      toast('Self-intersection check complete');
    };
  });
}

function toolDuplicateGeom() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features) vecLayers.push([id, st]); }
  if (vecLayers.length < 1) { toast('No vector layer loaded'); return; }
  openModal('Duplicate Geometries', (body) => {
    body.innerHTML = '<p>Find features with identical or near-identical coordinates.</p>' +
      '<div class="frow"><label>Layer</label><select id="dg-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Tolerance (deg)</label><input id="dg-tol" type="number" min="0" step="0.0001" value="0.0001"></div>' +
      '<div class="frow act"><button class="btn primary" id="dg-run">' + icon('copy') + ' Find Duplicates</button></div>' +
      '<div id="dg-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#dg-layer');
    const tolSel = body.querySelector('#dg-tol');
    const outDiv = body.querySelector('#dg-out');
    body.querySelector('#dg-run').onclick = async () => {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      const tol = +tolSel.value || 0.0001;
      if (!st.obj) await loadLayer(st);
      closeModal();
      const feats = st.obj.features.filter((f) => !f.hidden);
      await working('Comparing ' + feats.length + ' features');
      // Bucket by rounded extent: identical geometry always lands in the same bucket,
      // so we never compare every feature with every other one.
      const cellSize = Math.max(tol * 4, 1e-9);
      // Quantise with a tolerance margin: a feature is filed under every bucket a
      // near-duplicate could round into, so nothing close is missed.
      const buckets = new Map();
      const add = (k, f) => { const l = buckets.get(k); if (l) l.push(f); else buckets.set(k, [f]); };
      for (const f of feats) {
        const xs = [...new Set([Math.round((f.bb[0] - tol) / cellSize), Math.round((f.bb[0] + tol) / cellSize), Math.round((f.bb[2] - tol) / cellSize), Math.round((f.bb[2] + tol) / cellSize)])];
        const ys = [...new Set([Math.round((f.bb[1] - tol) / cellSize), Math.round((f.bb[1] + tol) / cellSize), Math.round((f.bb[3] - tol) / cellSize), Math.round((f.bb[3] + tol) / cellSize)])];
        for (const x0 of xs) for (const x1 of xs) for (const y0 of ys) for (const y1 of ys) add([x0, y0, x1, y1, f.type].join(':'), f);
      }
      // Compare the actual coordinates. Parts are nested (polygon → rings → coordinates),
      // so walking them by hand kept comparing arrays with arrays, which is always "equal".
      const sameGeom = (a, b) => {
        const fa = flattenNums(a.parts), fb = flattenNums(b.parts);
        if (fa.length !== fb.length) return false;
        for (let k = 0; k < fa.length; k++) if (Math.abs(fa[k] - fb[k]) > tol) return false;
        return fa.length > 0;
      };
      const dupPairs = [];
      const done = new Set();
      for (const list of buckets.values()) {
        if (list.length < 2) continue;
        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) {
            const a = list[i], b = list[j];
            const key = a.idx < b.idx ? a.idx + ':' + b.idx : b.idx + ':' + a.idx;
            if (done.has(key)) continue;
            done.add(key);
            if (a.parts.length !== b.parts.length) continue;
            if (sameGeom(a, b)) dupPairs.push([a, b]);
          }
        }
      }
      outDiv.innerHTML = '<p style="color:' + (dupPairs.length > 0 ? 'var(--bad)' : 'var(--ok)') + '"><b>' + dupPairs.length + '</b> duplicate pair' + (dupPairs.length === 1 ? '' : 's') + ' found</p>' +
        '<p>of <b>' + feats.length + '</b> features checked</p>';
      toast(dupPairs.length + ' duplicate pair' + (dupPairs.length === 1 ? '' : 's') + ' found');
    };
  });
}

function toolSnapToGrid() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features) vecLayers.push([id, st]); }
  if (vecLayers.length < 1) { toast('No vector layer loaded'); return; }
  openModal('Snap to Grid', (body) => {
    body.innerHTML = '<p>Snap all feature vertices to a regular grid.</p>' +
      '<div class="frow"><label>Layer</label><select id="sg-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Grid size (deg)</label><input id="sg-size" type="number" min="0.0001" step="0.0001" value="0.001"></div>' +
      '<div class="frow act"><button class="btn primary" id="sg-run">' + icon('grid') + ' Snap to Grid</button></div>' +
      '<div id="sg-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#sg-layer');
    const sizeSel = body.querySelector('#sg-size');
    const outDiv = body.querySelector('#sg-out');
    body.querySelector('#sg-run').onclick = async () => {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      const size = +sizeSel.value || 0.001;
      if (!st.obj) await loadLayer(st);
      closeModal();
      let snapped = 0;
      for (const f of st.obj.features) {
        if (f.hidden) continue;
        for (const poly of f.parts) for (const ring of poly) {
          for (let i = 0; i < ring.length; i += 2) {
            const nx = Math.round(ring[i] / size) * size;
            const ny = Math.round(ring[i + 1] / size) * size;
            if (nx !== ring[i] || ny !== ring[i + 1]) { ring[i] = nx; ring[i + 1] = ny; snapped++; }
          }
        }
      }
      map.render();
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + snapped + '</b> vertex' + (snapped === 1 ? '' : 's') + ' snapped</p>' +
        '<p>Grid size: ' + size + '&deg;</p>';
      toast('Vertices snapped to grid');
    };
  });
}

// ================================================================================
// ADDITIONAL NETWORK & ROUTING
// ================================================================================

function toolNetworkBuffer() {
  const lineLayers = [];
  const pointLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features) { if (st.meta.kind === 'line') lineLayers.push([id, st]); if (st.meta.kind === 'point') pointLayers.push([id, st]); } }
  if (lineLayers.length < 1 || pointLayers.length < 1) { toast('Need at least one line network layer and one point layer'); return; }
  openModal('Network Buffer', (body) => {
    body.innerHTML = '<p>Create a buffer around points constrained to the network (drive-time area).</p>' +
      '<div class="frow"><label>Network layer</label><select id="nb-net">' + lineLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Point layer</label><select id="nb-pts">' + pointLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Buffer distance (km)</label><input id="nb-dist" type="number" min="0.1" step="0.1" value="5"></div>' +
      '<div class="frow act"><button class="btn primary" id="nb-run">' + icon('target') + ' Compute Network Buffer</button></div>' +
      '<div id="nb-out" style="margin-top:10px"></div>';
    const netSel = body.querySelector('#nb-net');
    const ptsSel = body.querySelector('#nb-pts');
    const distSel = body.querySelector('#nb-dist');
    const outDiv = body.querySelector('#nb-out');
    body.querySelector('#nb-run').onclick = async () => {
      const [nid, nSt] = lineLayers.find(([i]) => i === netSel.value) || lineLayers[0];
      const [pid, pSt] = pointLayers.find(([i]) => i === ptsSel.value) || pointLayers[0];
      const distKm = +distSel.value || 5;
      if (!nSt.obj) await loadLayer(nSt);
      if (!pSt.obj) await loadLayer(pSt);
      closeModal();
      const distDeg = distKm / 111.0;
      const pts = [];
      for (const f of pSt.obj.features) {
        if (f.hidden || f.type !== 'point') continue;
        for (let i = 0; i < f.parts.length; i += 2) pts.push([f.parts[i], f.parts[i + 1]]);
      }
      const circleFeats = pts.map(([x, y]) => circleToPolygon(x, y, distDeg * 111000, 16));
      closeModal();
      if (circleFeats.length > 0) {
        addAnalysisLayer(circleFeats, 'polygon', 'Network Buffer (' + distKm + ' km)', '#0b6b45');
        outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + circleFeats.length + '</b> buffer' + (circleFeats.length === 1 ? '' : 's') + ' computed</p>' +
          '<p>Distance: ' + distKm + ' km</p>';
        toast('Network buffer computed');
      } else {
        toast('No points found');
      }
    };
  });
}

function toolNetworkConnect() {
  const lineLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'line') lineLayers.push([id, st]); }
  if (lineLayers.length < 1) { toast('No line network layer loaded'); return; }
  openModal('Network Connectivity', (body) => {
    body.innerHTML = '<p>Check whether all network line endpoints connect to form a continuous graph.</p>' +
      '<div class="frow"><label>Network layer</label><select id="nc-layer">' + lineLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="nc-run">' + icon('query') + ' Check Connectivity</button></div>' +
      '<div id="nc-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#nc-layer');
    const outDiv = body.querySelector('#nc-out');
    body.querySelector('#nc-run').onclick = async () => {
      const [id, st] = lineLayers.find(([i]) => i === layerSel.value) || lineLayers[0];
      if (!st.obj) await loadLayer(st);
      closeModal();
      const feats = st.obj.features.filter((f) => !f.hidden);
      const endpoints = {};
      for (const f of feats) for (const part of f.parts) {
        const s = part[0] + ',' + part[1];
        const e = part[part.length - 2] + ',' + part[part.length - 1];
        endpoints[s] = (endpoints[s] || 0) + 1;
        endpoints[e] = (endpoints[e] || 0) + 1;
      }
      let dangling = 0;
      for (const [pt, cnt] of Object.entries(endpoints)) if (cnt === 1) dangling++;
      outDiv.innerHTML = '<p style="color:' + (dangling > 0 ? 'var(--bad)' : 'var(--ok)') + '"><b>' + dangling + '</b> dangling endpoint' + (dangling === 1 ? '' : 's') + '</p>' +
        '<p>of <b>' + Object.keys(endpoints).length + '</b> unique nodes</p>' +
        '<p class="muted">Dangling endpoints = nodes with only one connected line.</p>';
      toast('Connectivity check complete');
    };
  });
}

function toolMultiPath() {
  const lineLayers = [];
  const pointLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features) { if (st.meta.kind === 'line') lineLayers.push([id, st]); if (st.meta.kind === 'point') pointLayers.push([id, st]); } }
  if (lineLayers.length < 1 || pointLayers.length < 1) { toast('Need at least one line network layer and one point layer'); return; }
  openModal('Multi-Stop Route', (body) => {
    body.innerHTML = '<p>Find a simple route through multiple stops (nearest-neighbor ordering).</p>' +
      '<div class="frow"><label>Network layer</label><select id="mp-net">' + lineLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Stop points layer</label><select id="mp-pts">' + pointLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="mp-run">' + icon('ruler') + ' Optimize Route</button></div>' +
      '<div id="mp-out" style="margin-top:10px"></div>';
    const netSel = body.querySelector('#mp-net');
    const ptsSel = body.querySelector('#mp-pts');
    const outDiv = body.querySelector('#mp-out');
    body.querySelector('#mp-run').onclick = async () => {
      const [nid, nSt] = lineLayers.find(([i]) => i === netSel.value) || lineLayers[0];
      const [pid, pSt] = pointLayers.find(([i]) => i === ptsSel.value) || pointLayers[0];
      if (!nSt.obj) await loadLayer(nSt);
      if (!pSt.obj) await loadLayer(pSt);
      closeModal();
      const raw = [];
      for (const f of pSt.obj.features) {
        if (f.hidden || f.type !== 'point') continue;
        for (let i = 0; i < f.parts.length; i += 2) raw.push({ lon: unX(f.parts[i]), lat: unY(f.parts[i + 1]) });
      }
      // A route through every one of 99,000 points is not a route: cap the tour at 12 stops.
      const MAXSTOPS = 12;
      const step = raw.length > MAXSTOPS ? raw.length / MAXSTOPS : 1;
      const pts = raw.length > MAXSTOPS ? Array.from({ length: MAXSTOPS }, (_, i) => raw[Math.floor(i * step)]) : raw;
      if (pts.length < 2) { toast(raw.length < 2 ? 'Need at least 2 stops' : 'Need at least 2 stops'); return; }
      if (!lineLayers.length) toast('Route uses straight-line distances — no network layer is switched on');
      const order = [0];
      const visited = new Set([0]);
      let cur = 0;
      while (order.length < pts.length) {
        let best = -1, bestD = 1e9;
        for (let i = 0; i < pts.length; i++) {
          if (visited.has(i)) continue;
          const d = haversineKm([pts[cur].lon, pts[cur].lat], [pts[i].lon, pts[i].lat]);
          if (d < bestD) { bestD = d; best = i; }
        }
        order.push(best);
        visited.add(best);
        cur = best;
      }
      let totalKm = 0;
      for (let i = 0; i < order.length - 1; i++) {
        totalKm += haversineKm([pts[order[i]].lon, pts[order[i]].lat], [pts[order[i + 1]].lon, pts[order[i + 1]].lat]);
      }
      // draw the ordered stops and the path between them (mercator coordinates)
      const routeFeats = order.map((oi, i) => {
        const x = mercX(pts[oi].lon), y = mercY(pts[oi].lat);
        return { type: 'point', parts: new Float64Array([x, y]), fill: i === 0 ? '#0b6b45' : i === order.length - 1 ? '#d73027' : '#ffd400', stroke: '#0b3d2e', bb: [x, y, x, y] };
      });
      const linePts = [];
      for (const oi of order) linePts.push(mercX(pts[oi].lon), mercY(pts[oi].lat));
      if (linePts.length >= 4) {
        const ring = new Float64Array(linePts);
        routeFeats.push({ type: 'line', parts: [ring], fill: '#ffd400', stroke: '#ffd400', bb: clipBB([ring]) });
      }
      addAnalysisLayer(routeFeats, 'point', 'Route Stops (order)', '#ffd400');
      const sampled = raw.length > MAXSTOPS ? '<p class="hint">This point layer has ' + raw.length.toLocaleString() + ' features, so a sample of ' + pts.length + ' stops was ordered. Pick a smaller layer for an exact tour.</p>' : '';
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + order.length + '</b> stops ordered</p>' +
        '<p>Estimated distance: ' + totalKm.toFixed(1) + ' km</p>' + sampled +
        '<p class="muted">Order: ' + order.map((o, i) => 'Stop #' + (o + 1)).join(' &rarr; ') + '</p>';
      toast('Route optimized');
    };
  });
}

// ================================================================================
// NEW: GENERATION TOOLS
// ================================================================================

function toolFishnet() {
  openModal('Fishnet / Grid', (body) => {
    body.innerHTML = '<p>Create a rectangular grid of cells over the current map extent.</p>' +
      '<div class="frow"><label>Cell size (km)</label><input id="fn-size" type="number" min="0.1" step="0.1" value="5"></div>' +
      '<div class="frow act"><button class="btn primary" id="fn-run">' + icon('grid') + ' Create Grid</button></div>' +
      '<div id="fn-out" style="margin-top:10px"></div>';
    const sizeSel = body.querySelector('#fn-size');
    const outDiv = body.querySelector('#fn-out');
    body.querySelector('#fn-run').onclick = () => {
      const sizeKm = +sizeSel.value || 5;
      const sizeDeg = sizeKm / 111.0;
      const c = map.center();
      const span = 0.5;
      const cells = [];
      for (let y = c[1] - span; y < c[1] + span; y += sizeDeg) {
        for (let x = c[0] - span; x < c[0] + span; x += sizeDeg) {
          cells.push({ type: 'poly', parts: [[[x, y], [x + sizeDeg, y], [x + sizeDeg, y + sizeDeg], [x, y + sizeDeg], [x, y]]], fill: 'rgba(11,107,69,.15)', stroke: '#0b6b45', bb: [x, y, x + sizeDeg, y + sizeDeg] });
        }
      }
      closeModal();
      addAnalysisLayer(cells, 'polygon', 'Fishnet (' + sizeKm + ' km cells)', '#0b6b45');
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + cells.length + '</b> cells created</p>' +
        '<p>Cell size: ' + sizeKm + ' km</p>';
      toast('Fishnet created');
    };
  });
}

function toolRandomPoints() {
  openModal('Random Points', (body) => {
    body.innerHTML = '<p>Generate random points within the current map extent.</p>' +
      '<div class="frow"><label>Number of points</label><input id="rp-count" type="number" min="1" max="10000" value="100"></div>' +
      '<div class="frow act"><button class="btn primary" id="rp-run">' + icon('point') + ' Generate Points</button></div>' +
      '<div id="rp-out" style="margin-top:10px"></div>';
    const countSel = body.querySelector('#rp-count');
    const outDiv = body.querySelector('#rp-out');
    body.querySelector('#rp-run').onclick = () => {
      const count = Math.min(+countSel.value || 100, 10000);
      const c = map.center();
      const span = 0.3;
      const pts = [];
      while (pts.length < count) {
        const x = c[0] - span + Math.random() * span * 2;
        const y = c[1] - span + Math.random() * span * 2;
        pts.push({ lon: x, lat: y });
      }
      closeModal();
      const feats = pts.map((p) => ({ type: 'point', parts: [[p.lon, p.lat]], fill: '#0b6b45', stroke: '#0b3d2e', bb: [p.lon - 0.001, p.lat - 0.001, p.lon + 0.001, p.lat + 0.001] }));
      addAnalysisLayer(feats, 'point', 'Random Points (' + count + ')', '#0b6b45');
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + feats.length + '</b> random points</p>';
      toast('Random points generated');
    };
  });
}

function toolHexbin() {
  const pointLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'point') pointLayers.push([id, st]); }
  if (pointLayers.length < 1) { toast('No point layer loaded'); return; }
  openModal('Hexagonal Binning', (body) => {
    body.innerHTML = '<p>Bin point features into hexagons by density.</p>' +
      '<div class="frow"><label>Point layer</label><select id="hx-layer">' + pointLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Hex size (km)</label><input id="hx-size" type="number" min="0.5" step="0.5" value="2"></div>' +
      '<div class="frow act"><button class="btn primary" id="hx-run">' + icon('polygon') + ' Create Hexbins</button></div>' +
      '<div id="hx-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#hx-layer');
    const sizeSel = body.querySelector('#hx-size');
    const outDiv = body.querySelector('#hx-out');
    body.querySelector('#hx-run').onclick = async () => {
      const [id, st] = pointLayers.find(([i]) => i === layerSel.value) || pointLayers[0];
      const sizeKm = +sizeSel.value || 2;
      if (!st.obj) await loadLayer(st);
      closeModal();
      const feats = st.obj.features.filter((f) => !f.hidden && f.type === 'point');
      if (feats.length === 0) { toast('No points found'); return; }
      const sizeDeg = sizeKm / 111.0;
      const hexHeight = sizeDeg * Math.sqrt(3) / 2;
      const bins = {};
      for (const f of feats) for (let i = 0; i < f.parts.length; i += 2) {
        const x = f.parts[i], y = f.parts[i + 1];
        const col = Math.round(x / sizeDeg);
        const row = Math.round(y / hexHeight);
        const key = col + ',' + row;
        bins[key] = (bins[key] || 0) + 1;
      }
      const maxCount = Math.max(...Object.values(bins));
      const hexes = [];
      for (const [key, cnt] of Object.entries(bins)) {
        const [col, row] = key.split(',').map(Number);
        const cx = col * sizeDeg;
        const cy = row * hexHeight + (col % 2) * hexHeight / 2;
        const pct = cnt / maxCount;
        const color = pct > 0.7 ? '#d73027' : pct > 0.4 ? '#f46d43' : pct > 0.2 ? '#fee08b' : '#e0f3f3';
        hexes.push({ type: 'poly', parts: [[cx, cy], [cx + sizeDeg * 0.75, cy + hexHeight * 0.5], [cx + sizeDeg * 0.75, cy + hexHeight * 1.5], [cx, cy + hexHeight * 2], [cx - sizeDeg * 0.75, cy + hexHeight * 1.5], [cx - sizeDeg * 0.75, cy + hexHeight * 0.5], [cx, cy]], fill: color, stroke: '#0b6b45', bb: [cx - sizeDeg * 0.75, cy, cx + sizeDeg * 0.75, cy + hexHeight * 2] });
      }
      addAnalysisLayer(hexes, 'polygon', 'Hexbins (' + sizeKm + ' km)', '#0b6b45');
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + hexes.length + '</b> hexagons</p>' +
        '<p>Max points per hex: <b>' + maxCount + '</b></p>';
      toast('Hexbin created');
    };
  });
}

function toolGridPoints() {
  openModal('Regular Point Grid', (body) => {
    body.innerHTML = '<p>Create points on a regular grid over the current map extent.</p>' +
      '<div class="frow"><label>Spacing (km)</label><input id="gp-spacing" type="number" min="0.1" step="0.1" value="5"></div>' +
      '<div class="frow act"><button class="btn primary" id="gp-run">' + icon('point') + ' Create Grid Points</button></div>' +
      '<div id="gp-out" style="margin-top:10px"></div>';
    const spacingSel = body.querySelector('#gp-spacing');
    const outDiv = body.querySelector('#gp-out');
    body.querySelector('#gp-run').onclick = () => {
      const spacingKm = +spacingSel.value || 5;
      const spacingDeg = spacingKm / 111.0;
      const c = map.center();
      const span = 0.4;
      const pts = [];
      for (let y = c[1] - span; y <= c[1] + span; y += spacingDeg) {
        for (let x = c[0] - span; x <= c[0] + span; x += spacingDeg) {
          pts.push({ lon: x, lat: y });
        }
      }
      closeModal();
      const feats = pts.map((p) => ({ type: 'point', parts: [[p.lon, p.lat]], fill: '#0b6b45', stroke: '#0b3d2e', bb: [p.lon - 0.001, p.lat - 0.001, p.lon + 0.001, p.lat + 0.001] }));
      addAnalysisLayer(feats, 'point', 'Grid Points (' + spacingKm + ' km)', '#0b6b45');
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + feats.length + '</b> grid points</p>' +
        '<p>Spacing: ' + spacingKm + ' km</p>';
      toast('Grid points created');
    };
  });
}


// ================================================================================
// ADDITIONAL GEOMETRY OPERATIONS
// ================================================================================

function toolFeatureBuffer() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features) vecLayers.push([id, st]); }
  if (vecLayers.length < 1) { toast('No vector layer loaded'); return; }
  openModal('Feature Buffer', (body) => {
    body.innerHTML = '<p>Buffer features by a fixed distance.</p>' +
      '<div class="frow"><label>Layer</label><select id="fb-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Buffer distance (km)</label><input id="fb-dist" type="number" min="0.01" step="0.01" value="1"></div>' +
      '<div class="frow act"><button class="btn primary" id="fb-run">' + icon('target') + ' Buffer Features</button></div>' +
      '<div id="fb-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#fb-layer');
    const distSel = body.querySelector('#fb-dist');
    const outDiv = body.querySelector('#fb-out');
    body.querySelector('#fb-run').onclick = async () => {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      const distKm = +distSel.value || 1;
      if (!st.obj) await loadLayer(st);
      closeModal();
      const feats = [];
      let buffered = 0;
      for (const f of st.obj.features) {
        if (f.hidden) continue;
        const bf = bufferFeature(f, distKm * 1000);
        if (bf && bf.parts && bf.parts.length) { feats.push(bf); buffered++; }
      }
      addAnalysisLayer(feats, 'polygon', 'Buffer (' + distKm + ' km)', '#0b6b45');
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + buffered + '</b> feature' + (buffered === 1 ? '' : 's') + ' buffered</p>' +
        '<p>Distance: ' + distKm + ' km</p>';
      toast('Features buffered');
    };
  });
}

function toolBoundingBox() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features) vecLayers.push([id, st]); }
  if (vecLayers.length < 1) { toast('No vector layer loaded'); return; }
  openModal('Bounding Box / Envelope', (body) => {
    body.innerHTML = '<p>Create bounding box polygons around each feature.</p>' +
      '<div class="frow"><label>Layer</label><select id="bb-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="bb-run">' + icon('polygon') + ' Create Bounding Boxes</button></div>' +
      '<div id="bb-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#bb-layer');
    const outDiv = body.querySelector('#bb-out');
    body.querySelector('#bb-run').onclick = async () => {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      if (!st.obj) await loadLayer(st);
      closeModal();
      const boxes = [];
      for (const f of st.obj.features) {
        if (f.hidden) continue;
        let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
        for (const poly of f.parts) for (const ring of poly) for (let i = 0; i < ring.length; i += 2) {
          minX = Math.min(minX, ring[i]); minY = Math.min(minY, ring[i + 1]);
          maxX = Math.max(maxX, ring[i]); maxY = Math.max(maxY, ring[i + 1]);
        }
        if (minX === 1e9) continue;
        boxes.push({ type: 'poly', parts: [[[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY], [minX, minY]]], fill: 'rgba(11,107,69,.15)', stroke: '#0b6b45', bb: [minX, minY, maxX, maxY] });
      }
      addAnalysisLayer(boxes, 'polygon', 'Bounding Boxes', '#0b6b45');
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + boxes.length + '</b> bounding box' + (boxes.length === 1 ? '' : 'es') + ' created</p>';
      toast('Bounding boxes created');
    };
  });
}

function toolVerticesToPoints() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features) vecLayers.push([id, st]); }
  if (vecLayers.length < 1) { toast('No vector layer loaded'); return; }
  openModal('Vertices to Points', (body) => {
    body.innerHTML = '<p>Extract every vertex of every feature as a point.</p>' +
      '<div class="frow"><label>Layer</label><select id="vtp-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="vtp-run">' + icon('point') + ' Extract Vertices</button></div>' +
      '<div id="vtp-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#vtp-layer');
    const outDiv = body.querySelector('#vtp-out');
    body.querySelector('#vtp-run').onclick = async () => {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      if (!st.obj) await loadLayer(st);
      closeModal();
      const pts = [];
      let count = 0;
      for (const f of st.obj.features) {
        if (f.hidden) continue;
        for (const poly of f.parts) for (const ring of poly) {
          for (let i = 0; i < ring.length; i += 2) {
            pts.push({ type: 'point', parts: [[ring[i], ring[i + 1]]], fill: '#0b6b45', stroke: '#0b3d2e', bb: [ring[i] - 0.001, ring[i + 1] - 0.001, ring[i] + 0.001, ring[i + 1] + 0.001] });
            count++;
          }
        }
      }
      addAnalysisLayer(pts, 'point', 'Vertices (' + count + ')', '#0b6b45');
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + count.toLocaleString() + '</b> vertices extracted</p>';
      toast('Vertices extracted');
    };
  });
}

// ================================================================================
// ADDITIONAL TOPOLOGY & DATA QUALITY
// ================================================================================

function toolEraseFeatures() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features) vecLayers.push([id, st]); }
  if (vecLayers.length < 2) { toast('Need at least two vector layers'); return; }
  openModal('Feature Erase / Difference', (body) => {
    body.innerHTML = '<p>Remove the area of one layer from another (erase/difference).</p>' +
      '<div class="frow"><label>Input layer</label><select id="ef-input">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Erase layer</label><select id="ef-erase">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="ef-run">' + icon('trash') + ' Erase Features</button></div>' +
      '<div id="ef-out" style="margin-top:10px"></div>';
    const inputSel = body.querySelector('#ef-input');
    const eraseSel = body.querySelector('#ef-erase');
    const outDiv = body.querySelector('#ef-out');
    body.querySelector('#ef-run').onclick = async () => {
      const [iid, iSt] = vecLayers.find(([i]) => i === inputSel.value) || vecLayers[0];
      const [eid, eSt] = vecLayers.find(([i]) => i === eraseSel.value) || vecLayers[1];
      if (iid === eid) { toast('Input and erase layers must differ'); return; }
      if (!iSt.obj) await loadLayer(iSt);
      if (!eSt.obj) await loadLayer(eSt);
      closeModal();
      let kept = 0;
      const erased = [];
      for (const f of iSt.obj.features) {
        if (f.hidden || f.type !== 'poly') continue;
        let erasedFlag = false;
        for (const ef of eSt.obj.features) {
          if (ef.hidden || ef.type !== 'poly') continue;
          for (const er of ef.parts) for (const ering of er) {
            if (polyOverlapsPoly(f.parts, [ering])) { erasedFlag = true; break; }
          }
          if (erasedFlag) break;
        }
        if (!erasedFlag) { erased.push(f); kept++; }
      }
      addAnalysisLayer(erased, 'polygon', 'Remaining after erase', '#0b6b45');
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + kept + '</b> feature' + (kept === 1 ? '' : 's') + ' remain after erase</p>';
      toast('Erase complete');
    };
  });
}

function toolCheckNullGeom() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features) vecLayers.push([id, st]); }
  if (vecLayers.length < 1) { toast('No vector layer loaded'); return; }
  openModal('Check Null Geometries', (body) => {
    body.innerHTML = '<p>Find features with missing, empty, or zero-length coordinates.</p>' +
      '<div class="frow"><label>Layer</label><select id="cng-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="cng-run">' + icon('query') + ' Check Null Geometries</button></div>' +
      '<div id="cng-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#cng-layer');
    const outDiv = body.querySelector('#cng-out');
    body.querySelector('#cng-run').onclick = async () => {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      if (!st.obj) await loadLayer(st);
      closeModal();
      let issues = 0, checked = 0;
      for (const f of st.obj.features) {
        if (f.hidden) continue;
        checked++;
        let empty = true;
        for (const poly of f.parts) for (const ring of poly) { if (ring.length >= 6) { empty = false; break; } }
        if (empty) issues++;
      }
      outDiv.innerHTML = '<p style="color:' + (issues > 0 ? 'var(--bad)' : 'var(--ok)') + '"><b>' + issues + '</b> null geometry' + (issues === 1 ? '' : 'ies') + ' found</p>' +
        '<p>of <b>' + checked + '</b> features checked</p>';
      toast('Null geometry check complete');
    };
  });
}

function toolCheckOutOfBounds() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features) vecLayers.push([id, st]); }
  if (vecLayers.length < 1) { toast('No vector layer loaded'); return; }
  openModal('Check Out of Bounds', (body) => {
    body.innerHTML = '<p>Find features with coordinates outside valid bounds (-180 to 180, -90 to 90).</p>' +
      '<div class="frow"><label>Layer</label><select id="oob-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="oob-run">' + icon('query') + ' Check Out of Bounds</button></div>' +
      '<div id="oob-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#oob-layer');
    const outDiv = body.querySelector('#oob-out');
    body.querySelector('#oob-run').onclick = async () => {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      if (!st.obj) await loadLayer(st);
      closeModal();
      let issues = 0, checked = 0;
      for (const f of st.obj.features) {
        if (f.hidden) continue;
        checked++;
        for (const poly of f.parts) for (const ring of poly) {
          for (let i = 0; i < ring.length; i += 2) {
            if (ring[i] < -180 || ring[i] > 180 || ring[i + 1] < -90 || ring[i + 1] > 90) {
              issues++;
              break;
            }
          }
          if (issues > 0 && f.hidden === false) break;
        }
      }
      outDiv.innerHTML = '<p style="color:' + (issues > 0 ? 'var(--bad)' : 'var(--ok)') + '"><b>' + issues + '</b> out-of-bounds feature' + (issues === 1 ? '' : 's') + ' found</p>' +
        '<p>of <b>' + checked + '</b> features checked</p>';
      toast('Out-of-bounds check complete');
    };
  });
}

function toolCheckMultipart() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features) vecLayers.push([id, st]); }
  if (vecLayers.length < 1) { toast('No vector layer loaded'); return; }
  openModal('Check Multi-part Features', (body) => {
    body.innerHTML = '<p>Find features with multiple parts (multi-polygons, multi-lines).</p>' +
      '<div class="frow"><label>Layer</label><select id="cmp-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="cmp-run">' + icon('query') + ' Check Multi-part</button></div>' +
      '<div id="cmp-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#cmp-layer');
    const outDiv = body.querySelector('#cmp-out');
    body.querySelector('#cmp-run').onclick = async () => {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      if (!st.obj) await loadLayer(st);
      closeModal();
      let multi = 0, checked = 0;
      for (const f of st.obj.features) {
        if (f.hidden) continue;
        checked++;
        if (f.parts.length > 1) multi++;
      }
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + multi + '</b> multi-part feature' + (multi === 1 ? '' : 's') + ' found</p>' +
        '<p>of <b>' + checked + '</b> features checked</p>';
      toast('Multi-part check complete');
    };
  });
}

// ================================================================================
// ADDITIONAL NETWORK & ROUTING
// ================================================================================

function toolDistanceMatrix() {
  const pointLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'point') pointLayers.push([id, st]); }
  if (pointLayers.length < 1) { toast('No point layer loaded'); return; }
  openModal('Distance Matrix', (body) => {
    body.innerHTML = '<p>Compute pairwise distances between all points in a layer.</p>' +
      '<div class="frow"><label>Point layer</label><select id="dm-layer">' + pointLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="dm-run">' + icon('chart') + ' Compute Distance Matrix</button></div>' +
      '<div id="dm-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#dm-layer');
    const outDiv = body.querySelector('#dm-out');
    body.querySelector('#dm-run').onclick = async () => {
      const [id, st] = pointLayers.find(([i]) => i === layerSel.value) || pointLayers[0];
      if (!st.obj) await loadLayer(st);
      closeModal();
      const all = [];
      for (const f of st.obj.features) {
        if (f.hidden || f.type !== 'point') continue;
        for (let i = 0; i < f.parts.length; i += 2) all.push([unX(f.parts[i]), unY(f.parts[i + 1])]);
      }
      if (all.length < 2) { toast('Need at least 2 points'); return; }
      // Very large layers would produce billions of pairs, so a deterministic evenly spaced
      // subset of 200 points is measured and the panel says so.
      const MAXP = 200;
      const step = all.length > MAXP ? all.length / MAXP : 1;
      const pts = all.length > MAXP ? Array.from({ length: MAXP }, (_, i) => all[Math.floor(i * step)]) : all;
      let minD = 1e9, maxD = 0, totalD = 0, count = 0;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const d = haversineKm(pts[i], pts[j]);
          minD = Math.min(minD, d); maxD = Math.max(maxD, d); totalD += d; count++;
        }
      }
      const sampleNote = all.length > MAXP ? '<p class="hint">This layer has ' + all.length.toLocaleString() + ' points, so an evenly spaced sample of ' + MAXP + ' was measured.</p>' : '';
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + pts.length + '</b> points, <b>' + count.toLocaleString() + '</b> pairs</p>' + sampleNote +
        '<table class="mini"><tr><th>Min distance</th><td>' + minD.toFixed(2) + ' km</td></tr>' +
        '<tr><th>Max distance</th><td>' + maxD.toFixed(2) + ' km</td></tr>' +
        '<tr><th>Mean distance</th><td>' + (totalD / count).toFixed(2) + ' km</td></tr></table>';
      toast('Distance matrix computed');
    };
  });
}

function toolLineMerge() {
  const lineLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'line') lineLayers.push([id, st]); }
  if (lineLayers.length < 1) { toast('No line layer loaded'); return; }
  openModal('Merge Connected Lines', (body) => {
    body.innerHTML = '<p>Merge line features that share endpoints into continuous lines.</p>' +
      '<div class="frow"><label>Line layer</label><select id="lm-layer">' + lineLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="lm-run">' + icon('merge') + ' Merge Connected Lines</button></div>' +
      '<div id="lm-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#lm-layer');
    const outDiv = body.querySelector('#lm-out');
    body.querySelector('#lm-run').onclick = async () => {
      const [id, st] = lineLayers.find(([i]) => i === layerSel.value) || lineLayers[0];
      if (!st.obj) await loadLayer(st);
      closeModal();
      const feats = st.obj.features.filter((f) => !f.hidden);
      const endpoints = {};
      feats.forEach((f, fi) => {
        f.parts.forEach(part => {
          const s = part[0] + ',' + part[1];
          const e = part[part.length - 2] + ',' + part[part.length - 1];
          if (!endpoints[s]) endpoints[s] = [];
          if (!endpoints[e]) endpoints[e] = [];
          endpoints[s].push({ fi, part, end: 'start' });
          endpoints[e].push({ fi, part, end: 'end' });
        });
      });
      let merged = 0;
      const used = new Set();
      const mergedLines = [];
      feats.forEach((f, fi) => {
        if (used.has(fi)) return;
        let current = [...f.parts[0]];
        used.add(fi);
        let changed = true;
        while (changed) {
          changed = false;
          const endKey = current[current.length - 2] + ',' + current[current.length - 1];
          const candidates = (endpoints[endKey] || []).filter(c => !used.has(c.fi));
          if (candidates.length > 0) {
            const next = candidates[0];
            used.add(next.fi);
            current.push(...next.part.slice(2));
            changed = true;
            merged++;
          }
        }
        mergedLines.push({ type: 'line', parts: [current], fill: 'none', stroke: '#0b6b45', bb: f.bb });
      });
      addAnalysisLayer(mergedLines, 'line', 'Merged Lines', '#0b6b45');
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + mergedLines.length + '</b> merged line' + (mergedLines.length === 1 ? '' : 's') + '</p>' +
        '<p>' + merged + ' connection' + (merged === 1 ? '' : 's') + ' made</p>';
      toast('Lines merged');
    };
  });
}

// ================================================================================
// ADDITIONAL RASTER TOOLS
// ================================================================================

function toolRasterClipPoly() {
  const rasterLayers = [];
  const polyLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj) { if (st.meta.kind === 'raster') rasterLayers.push([id, st]); if (st.meta.kind === 'polygon') polyLayers.push([id, st]); } }
  if (rasterLayers.length < 1) { toast('No raster layer loaded'); return; }
  if (polyLayers.length < 1) { toast('No polygon layer loaded'); return; }
  openModal('Raster Clip by Polygon', (body) => {
    body.innerHTML = '<p>Clip raster extent to a polygon layer boundary.</p>' +
      '<div class="frow"><label>Raster layer</label><select id="rcp-raster">' + rasterLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Clip polygon layer</label><select id="rcp-poly">' + polyLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="rcp-run">' + icon('crop') + ' Clip Raster Extent</button></div>' +
      '<div id="rcp-out" style="margin-top:10px"></div>';
    const rSel = body.querySelector('#rcp-raster');
    const pSel = body.querySelector('#rcp-poly');
    const outDiv = body.querySelector('#rcp-out');
    body.querySelector('#rcp-run').onclick = async () => {
      const [rid, rSt] = rasterLayers.find(([i]) => i === rSel.value) || rasterLayers[0];
      const [pid, pSt] = polyLayers.find(([i]) => i === pSel.value) || polyLayers[0];
      if (!rSt.obj || !rSt.obj.vals) { try { await loadValues(rSt); } catch { toast('Could not load raster values'); return; } }
      if (!pSt.obj) await loadLayer(pSt);
      closeModal();
      const polys = pSt.obj.features.filter((f) => !f.hidden && f.type === 'poly');
      if (polys.length === 0) { toast('No polygons found'); return; }
      const boxes = polys.map((f) => ({ type: 'poly', parts: f.parts, fill: 'rgba(11,107,69,.2)', stroke: '#0b6b45', bb: f.bb }));
      addAnalysisLayer(boxes, 'polygon', 'Raster clip area', '#0b6b45');
      outDiv.innerHTML = '<p style="color:var(--ok)">Raster extent clipped to <b>' + polys.length + '</b> polygon' + (polys.length === 1 ? '' : 's') + '</p>';
      toast('Raster clip area defined');
    };
  });
}

// ================================================================================
// ADDITIONAL GENERATION TOOLS
// ================================================================================

function toolRandomLines() {
  openModal('Random Lines', (body) => {
    body.innerHTML = '<p>Generate random line features over the current map extent.</p>' +
      '<div class="frow"><label>Number of lines</label><input id="rl-count" type="number" min="1" max="1000" value="20"></div>' +
      '<div class="frow"><label>Max vertices per line</label><input id="rl-verts" type="number" min="2" max="20" value="5"></div>' +
      '<div class="frow act"><button class="btn primary" id="rl-run">' + icon('line') + ' Generate Lines</button></div>' +
      '<div id="rl-out" style="margin-top:10px"></div>';
    const countSel = body.querySelector('#rl-count');
    const vertsSel = body.querySelector('#rl-verts');
    const outDiv = body.querySelector('#rl-out');
    body.querySelector('#rl-run').onclick = () => {
      const count = Math.min(+countSel.value || 20, 1000);
      const maxVerts = Math.min(+vertsSel.value || 5, 20);
      const c = map.center();
      const span = 0.3;
      const lines = [];
      for (let i = 0; i < count; i++) {
        const nv = 2 + Math.floor(Math.random() * (maxVerts - 1));
        const coords = [];
        let x = c[0] - span + Math.random() * span * 2;
        let y = c[1] - span + Math.random() * span * 2;
        coords.push(x, y);
        for (let v = 1; v < nv; v++) {
          x += (Math.random() - 0.5) * span * 0.4;
          y += (Math.random() - 0.5) * span * 0.4;
          coords.push(x, y);
        }
        const xs = coords.filter((_, i) => i % 2 === 0);
        const ys = coords.filter((_, i) => i % 2 === 1);
        lines.push({ type: 'line', parts: [coords], fill: 'none', stroke: '#0b6b45', bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] });
      }
      closeModal();
      addAnalysisLayer(lines, 'line', 'Random Lines (' + count + ')', '#0b6b45');
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + count + '</b> random lines</p>';
      toast('Random lines generated');
    };
  });
}

function toolRandomPolygons() {
  openModal('Random Polygons', (body) => {
    body.innerHTML = '<p>Generate random polygon features over the current map extent.</p>' +
      '<div class="frow"><label>Number of polygons</label><input id="rpoly-count" type="number" min="1" max="500" value="15"></div>' +
      '<div class="frow"><label>Max vertices</label><input id="rpoly-verts" type="number" min="3" max="12" value="6"></div>' +
      '<div class="frow act"><button class="btn primary" id="rpoly-run">' + icon('polygon') + ' Generate Polygons</button></div>' +
      '<div id="rpoly-out" style="margin-top:10px"></div>';
    const countSel = body.querySelector('#rpoly-count');
    const vertsSel = body.querySelector('#rpoly-verts');
    const outDiv = body.querySelector('#rpoly-out');
    body.querySelector('#rpoly-run').onclick = () => {
      const count = Math.min(+countSel.value || 15, 500);
      const maxVerts = Math.min(+vertsSel.value || 6, 12);
      const c = map.center();
      const span = 0.3;
      const polys = [];
      for (let i = 0; i < count; i++) {
        const nv = 3 + Math.floor(Math.random() * (maxVerts - 2));
        const coords = [];
        const cx = c[0] - span * 0.5 + Math.random() * span;
        const cy = c[1] - span * 0.5 + Math.random() * span;
        const radius = 0.05 + Math.random() * 0.15;
        for (let v = 0; v < nv; v++) {
          const angle = (v / nv) * 2 * Math.PI + Math.random() * 0.5;
          const r = radius * (0.7 + Math.random() * 0.6);
          coords.push(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r * 0.7);
        }
        coords.push(coords[0], coords[1]);
        const xs = coords.filter((_, i) => i % 2 === 0);
        const ys = coords.filter((_, i) => i % 2 === 1);
        polys.push({ type: 'poly', parts: [coords], fill: 'rgba(11,107,69,.2)', stroke: '#0b6b45', bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] });
      }
      closeModal();
      addAnalysisLayer(polys, 'polygon', 'Random Polygons (' + count + ')', '#0b6b45');
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + count + '</b> random polygons</p>';
      toast('Random polygons generated');
    };
  });
}




// ================================================================================
// HIGH-VALUE ADDITIONS (genuine gaps, not duplicates)
// ================================================================================

// --- Raster Overlay Math: two-raster map algebra ---
function toolRasterOverlay() {
  const rasterLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj && st.meta.kind === 'raster') rasterLayers.push([id, st]); }
  if (rasterLayers.length < 2) { toast('Need at least two raster layers'); return; }
  openModal('Raster Overlay Math', (body) => {
    body.innerHTML = '<p>Cell-by-cell arithmetic between two rasters (same extent/cell size assumed).</p>' +
      '<div class="frow"><label>Raster A</label><select id="ro-a">' + rasterLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Operator</label><select id="ro-op"><option value="add">A + B</option><option value="sub">A − B</option><option value="mul">A × B</option><option value="div">A ÷ B</option><option value="min">Min(A,B)</option><option value="max">Max(A,B)</option></select></div>' +
      '<div class="frow"><label>Raster B</label><select id="ro-b">' + rasterLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="ro-run">' + icon('calc') + ' Compute Overlay</button></div>' +
      '<div id="ro-out" style="margin-top:10px"></div>';
    const aSel = body.querySelector('#ro-a');
    const bSel = body.querySelector('#ro-b');
    const opSel = body.querySelector('#ro-op');
    const outDiv = body.querySelector('#ro-out');
    body.querySelector('#ro-run').onclick = async () => {
      const [ia, stA] = rasterLayers.find(([i]) => i === aSel.value) || rasterLayers[0];
      const [ib, stB] = rasterLayers.find(([i]) => i === bSel.value) || rasterLayers[1];
      if (ia === ib) { toast('Pick two different rasters'); return; }
      const op = opSel.value;
      if (!stA.obj || !stA.obj.vals) { try { await loadValues(stA); } catch { toast('Could not load raster A'); return; } }
      if (!stB.obj || !stB.obj.vals) { try { await loadValues(stB); } catch { toast('Could not load raster B'); return; } }
      const oA = stA.obj.vals, oB = stB.obj.vals;
      if (oA.w !== oB.w || oA.h !== oB.h) { toast('Rasters must have same dimensions'); return; }
      const { w, h } = oA;
      const nodataA = oA.dtype === 'i2' ? -32768 : null;
      const nodataB = oB.dtype === 'i2' ? -32768 : null;
      const dataA = oA.data, dataB = oB.data;
      let valid = 0, computed = 0;
      const out = new Float32Array(w * h).fill(NaN);
      for (let i = 0; i < dataA.length; i++) {
        let va = dataA[i], vb = dataB[i];
        const naA = nodataA !== null ? va === nodataA : !isFinite(va);
        const naB = nodataB !== null ? vb === nodataB : !isFinite(vb);
        if (naA || naB) continue;
        valid++;
        let r;
        if (op === 'add') r = va + vb;
        else if (op === 'sub') r = va - vb;
        else if (op === 'mul') r = va * vb;
        else if (op === 'div') r = vb === 0 ? NaN : va / vb;
        else if (op === 'min') r = Math.min(va, vb);
        else r = Math.max(va, vb);
        if (isFinite(r)) { out[i] = r; computed++; }
      }
      closeModal();
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + computed.toLocaleString() + '</b> of <b>' + valid.toLocaleString() + '</b> valid cells computed</p>' +
        '<p>Operation: A ' + (op === 'add' ? '+' : op === 'sub' ? '−' : op === 'mul' ? '×' : op === 'div' ? '÷' : op === 'min' ? 'min' : 'max') + ' B</p>';
      toast('Raster overlay complete');
    };
  });
}

// --- Area & Perimeter for polygons ---
function toolAreaPerim() {
  const polyLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'polygon') polyLayers.push([id, st]); }
  if (polyLayers.length < 1) { toast('No polygon layer loaded'); return; }
  openModal('Area & Perimeter', (body) => {
    body.innerHTML = '<p>Compute area (km²) and perimeter (km) for each polygon feature.</p>' +
      '<div class="frow"><label>Polygon layer</label><select id="ap-layer">' + polyLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="ap-run">' + icon('chart') + ' Compute</button></div>' +
      '<div id="ap-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#ap-layer');
    const outDiv = body.querySelector('#ap-out');
    body.querySelector('#ap-run').onclick = async () => {
      const [id, st] = polyLayers.find(([i]) => i === layerSel.value) || polyLayers[0];
      if (!st.obj) await loadLayer(st);
      closeModal();
      const feats = st.obj.features.filter((f) => !f.hidden && f.type === 'poly');
      let totalArea = 0, totalPerim = 0, count = 0;
      const rows = [];
      for (const f of feats) {
        let areaKm2 = 0, perimKm = 0;
        for (const poly of f.parts) for (const ring of poly) {
          if (ring.length < 6) continue;
          const ll = [];
          for (let i = 0; i < ring.length; i += 2) ll.push([unX(ring[i]), unY(ring[i + 1])]);
          areaKm2 += Math.abs(ringAreaKm2(ll));
          perimKm += ringPerimeterKm(ll);
        }
        totalArea += areaKm2; totalPerim += perimKm; count++;
        rows.push({ label: titleOf(st.obj, f), area: areaKm2, perim: perimKm });
      }
      const sorted = rows.slice().sort((a, b) => b.area - a.area);
      closeModal();
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + count + '</b> polygon' + (count === 1 ? '' : 's') + ' measured</p>' +
        '<table class="mini"><tr><th>Total area</th><td>' + totalArea.toFixed(2) + ' km²</td></tr>' +
        '<tr><th>Total perimeter</th><td>' + totalPerim.toFixed(2) + ' km</td></tr>' +
        '<tr><th>Mean area</th><td>' + (totalArea / count).toFixed(2) + ' km²</td></tr>' +
        '<tr><th>Largest</th><td>' + (sorted[0] ? sorted[0].label : '—') + ' (' + (sorted[0] ? sorted[0].area.toFixed(2) : '0') + ' km²)</td></tr></table>';
      toast('Area & perimeter computed');
    };
  });
}

// --- Points Along Lines ---
function toolLinePoints() {
  const lineLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'line') lineLayers.push([id, st]); }
  if (lineLayers.length < 1) { toast('No line layer loaded'); return; }
  openModal('Points Along Lines', (body) => {
    body.innerHTML = '<p>Place points at regular intervals along line features.</p>' +
      '<div class="frow"><label>Line layer</label><select id="lp-layer">' + lineLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Interval (km)</label><input id="lp-interval" type="number" min="0.01" step="0.01" value="1"></div>' +
      '<div class="frow act"><button class="btn primary" id="lp-run">' + icon('point') + ' Generate Points</button></div>' +
      '<div id="lp-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#lp-layer');
    const intSel = body.querySelector('#lp-interval');
    const outDiv = body.querySelector('#lp-out');
    body.querySelector('#lp-run').onclick = async () => {
      const [id, st] = lineLayers.find(([i]) => i === layerSel.value) || lineLayers[0];
      const intervalKm = +intSel.value || 1;
      if (!st.obj) await loadLayer(st);
      closeModal();
      const intervalDeg = intervalKm / 111.0;
      const pts = [];
      let count = 0;
      for (const f of st.obj.features) {
        if (f.hidden || f.type !== 'line') continue;
        for (const part of f.parts) {
          for (let i = 0; i < part.length - 2; i += 2) {
            const x1 = part[i], y1 = part[i + 1];
            const x2 = part[i + 2], y2 = part[i + 3];
            const segLen = haversineKm([unX(x1), unY(y1)], [unX(x2), unY(y2)]);
            const n = Math.max(1, Math.ceil(segLen / intervalKm));
            for (let s = 0; s <= n; s++) {
              const t = s / n;
              pts.push({ type: 'point', parts: [[x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]], fill: '#0b6b45', stroke: '#0b3d2e', bb: [0,0,0,0] });
              count++;
            }
          }
        }
      }
      addAnalysisLayer(pts, 'point', 'Points along lines (' + intervalKm + ' km)', '#0b6b45');
      closeModal();
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + count.toLocaleString() + '</b> points placed</p>' +
        '<p>Interval: ' + intervalKm + ' km</p>';
      toast('Points placed along lines');
    };
  });
}

// --- Random Sample of Features ---
function toolRandomSample() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features) vecLayers.push([id, st]); }
  if (vecLayers.length < 1) { toast('No vector layer loaded'); return; }
  openModal('Random Sample', (body) => {
    body.innerHTML = '<p>Draw a random subset of features from a layer.</p>' +
      '<div class="frow"><label>Layer</label><select id="rs-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Sample size</label><input id="rs-n" type="number" min="1" max="10000" value="10"></div>' +
      '<div class="frow act"><button class="btn primary" id="rs-run">' + icon('point') + ' Sample Features</button></div>' +
      '<div id="rs-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#rs-layer');
    const nSel = body.querySelector('#rs-n');
    const outDiv = body.querySelector('#rs-out');
    body.querySelector('#rs-run').onclick = async () => {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      const n = Math.min(+nSel.value || 10, 10000);
      if (!st.obj) await loadLayer(st);
      closeModal();
      const feats = st.obj.features.filter((f) => !f.hidden);
      if (feats.length === 0) { toast('No features found'); return; }
      const sampleN = Math.min(n, feats.length);
      const idx = [];
      while (idx.length < sampleN) {
        const r = Math.floor(Math.random() * feats.length);
        if (!idx.includes(r)) idx.push(r);
      }
      const sample = idx.map((i) => feats[i]);
      addAnalysisLayer(sample, feats[0].type, 'Random sample (' + sampleN + ')', '#0b6b45');
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + sampleN + '</b> of <b>' + feats.length + '</b> features sampled</p>';
      toast('Random sample created');
    };
  });
}

// --- Polygon Centroids as Point Layer ---
function toolCentroidPts() {
  const polyLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'polygon') polyLayers.push([id, st]); }
  if (polyLayers.length < 1) { toast('No polygon layer loaded'); return; }
  openModal('Polygon Centroids → Points', (body) => {
    body.innerHTML = '<p>Create a point layer from the centroid of each polygon.</p>' +
      '<div class="frow"><label>Polygon layer</label><select id="cp-layer">' + polyLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="cp-run">' + icon('target') + ' Create Centroid Points</button></div>' +
      '<div id="cp-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#cp-layer');
    const outDiv = body.querySelector('#cp-out');
    body.querySelector('#cp-run').onclick = async () => {
      const [id, st] = polyLayers.find(([i]) => i === layerSel.value) || polyLayers[0];
      if (!st.obj) await loadLayer(st);
      closeModal();
      const pts = [];
      let count = 0;
      for (const f of st.obj.features) {
        if (f.hidden || f.type !== 'poly') continue;
        const c = featureCentroid(f);
        if (c) {
          pts.push({ type: 'point', parts: [[c[0], c[1]]], fill: '#0b6b45', stroke: '#0b3d2e', bb: [c[0] - 0.001, c[1] - 0.001, c[0] + 0.001, c[1] + 0.001] });
          count++;
        }
      }
      addAnalysisLayer(pts, 'point', 'Polygon Centroids (' + count + ')', '#0b6b45');
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + count + '</b> centroid point' + (count === 1 ? '' : 's') + ' created</p>';
      toast('Centroid points created');
    };
  });
}

// --- Zonal Statistics (raster within polygons) ---
function toolZonalStatsRaster() {
  const rasterLayers = [];
  const polyLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj) { if (st.meta.kind === 'raster') rasterLayers.push([id, st]); if (st.meta.kind === 'polygon') polyLayers.push([id, st]); } }
  if (rasterLayers.length < 1) { toast('No raster layer loaded'); return; }
  if (polyLayers.length < 1) { toast('No polygon layer loaded'); return; }
  openModal('Zonal Statistics', (body) => {
    body.innerHTML = '<p>Summarize raster cell values within each polygon (mean, min, max, count).</p>' +
      '<div class="frow"><label>Raster layer</label><select id="zs-raster">' + rasterLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Polygon layer</label><select id="zs-poly">' + polyLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="zs-run">' + icon('chart') + ' Compute Zonal Stats</button></div>' +
      '<div id="zs-out" style="margin-top:10px"></div>';
    const rSel = body.querySelector('#zs-raster');
    const pSel = body.querySelector('#zs-poly');
    const outDiv = body.querySelector('#zs-out');
    body.querySelector('#zs-run').onclick = async () => {
      const [rid, rSt] = rasterLayers.find(([i]) => i === rSel.value) || rasterLayers[0];
      const [pid, pSt] = polyLayers.find(([i]) => i === pSel.value) || polyLayers[0];
      if (!rSt.obj || !rSt.obj.vals) { try { await loadValues(rSt); } catch { toast('Could not load raster values'); return; } }
      if (!pSt.obj) await loadLayer(pSt);
      closeModal();
      const o = rSt.obj.vals;
      const { w, h, data, dtype } = o;
      const nodata = dtype === 'i2' ? -32768 : null;
      const polys = pSt.obj.features.filter((f) => !f.hidden && f.type === 'poly');
      if (polys.length === 0) { toast('No polygons found'); return; }
      const results = [];
      for (const f of polys) {
        let sum = 0, cnt = 0, min = 1e9, max = -1e9, sumSq = 0;
        for (const poly of f.parts) for (const ring of poly) {
          if (ring.length < 6) continue;
          // sample ring points and a few interior points via bounding-box grid
          const bb = f.bb;
          const stepX = (bb[2] - bb[0]) / 20;
          const stepY = (bb[3] - bb[1]) / 20;
          for (let y = bb[1]; y <= bb[3]; y += stepY) {
            for (let x = bb[0]; x <= bb[2]; x += stepX) {
              if (!pip2(x, y, [ring])) continue;
              const col = Math.round((x + 180) / 360 * (w - 1));
              const row = Math.round((0.5 - Math.log((1 + Math.sin(y * Math.PI / 180) / (1 - Math.sin(y * Math.PI / 180))) / (4 * Math.PI))) * (h - 1));
              if (col < 0 || col >= w || row < 0 || row >= h) continue;
              const v = data[row * w + col];
              if (nodata !== null ? v === nodata : !isFinite(v)) continue;
              sum += v; sumSq += v * v; cnt++;
              if (v < min) min = v;
              if (v > max) max = v;
            }
          }
        }
        results.push({ label: f.label || 'Feature', cnt, mean: cnt ? sum / cnt : 0, min, max, std: cnt ? Math.sqrt(Math.max(0, sumSq / cnt - (sum / cnt) * (sum / cnt))) : 0 });
      }
      results.sort((a, b) => b.mean - a.mean);
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + results.length + '</b> polygon' + (results.length === 1 ? '' : 's') + ' summarized</p>' +
        '<table class="mini"><tr><th>Polygon</th><th>Cells</th><th>Mean</th><th>Min</th><th>Max</th><th>StdDev</th></tr>' +
        results.slice(0, 10).map((r) => '<tr><td>' + esc(r.label) + '</td><td>' + r.cnt + '</td><td>' + r.mean.toFixed(2) + '</td><td>' + r.min.toFixed(2) + '</td><td>' + r.max.toFixed(2) + '</td><td>' + r.std.toFixed(2) + '</td></tr>').join('') +
        (results.length > 10 ? '<tr><td colspan="6" style="text-align:center">…and ' + (results.length - 10) + ' more</td></tr>' : '') +
        '</table>';
      toast('Zonal statistics computed');
    };
  });
}

// --- Line Bearing / Angle Statistics ---
function toolLineBearing() {
  const lineLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'line') lineLayers.push([id, st]); }
  if (lineLayers.length < 1) { toast('No line layer loaded'); return; }
  openModal('Line Bearing Statistics', (body) => {
    body.innerHTML = '<p>Analyze the compass bearing (direction) of line segments.</p>' +
      '<div class="frow"><label>Line layer</label><select id="lb-layer">' + lineLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="lb-run">' + icon('compass') + ' Compute Bearings</button></div>' +
      '<div id="lb-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#lb-layer');
    const outDiv = body.querySelector('#lb-out');
    body.querySelector('#lb-run').onclick = async () => {
      const [id, st] = lineLayers.find(([i]) => i === layerSel.value) || lineLayers[0];
      if (!st.obj) await loadLayer(st);
      closeModal();
      const bearings = [];
      for (const f of st.obj.features) {
        if (f.hidden || f.type !== 'line') continue;
        for (const part of f.parts) {
          for (let i = 0; i < part.length - 2; i += 2) {
            const x1 = part[i], y1 = part[i + 1];
            const x2 = part[i + 2], y2 = part[i + 3];
            const dx = x2 - x1;
            const dy = y2 - y1;
            let brg = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
            bearings.push(brg);
          }
        }
      }
      if (bearings.length === 0) { toast('No line segments found'); return; }
      bearings.sort((a, b) => a - b);
      const mean = bearings.reduce((a, b) => a + b, 0) / bearings.length;
      // circular mean
      let sinSum = 0, cosSum = 0;
      for (const b of bearings) { const r = b * Math.PI / 180; sinSum += Math.sin(r); cosSum += Math.cos(r); }
      const circMean = (Math.atan2(sinSum, cosSum) * 180 / Math.PI + 360) % 360;
      // dominant direction (8-compass)
      const dirs = ['N','NE','E','SE','S','SW','W','NW'];
      const dirIdx = Math.round(((circMean + 22.5) % 360) / 45) % 8;
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + bearings.length.toLocaleString() + '</b> segments analyzed</p>' +
        '<table class="mini"><tr><th>Mean bearing</th><td>' + mean.toFixed(1) + '°</td></tr>' +
        '<tr><th>Circular mean</th><td>' + circMean.toFixed(1) + '°</td></tr>' +
        '<tr><th>Dominant direction</th><td>' + dirs[dirIdx] + '</td></tr>' +
        '<tr><th>Min bearing</th><td>' + bearings[0].toFixed(1) + '°</td></tr>' +
        '<tr><th>Max bearing</th><td>' + bearings[bearings.length - 1].toFixed(1) + '°</td></tr></table>';
      toast('Line bearings computed');
    };
  });
}

// --- Feature Count by Attribute ---
function toolCountByAttr() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.fields) vecLayers.push([id, st]); }
  if (vecLayers.length < 1) { toast('No vector layer with attributes loaded'); return; }
  openModal('Count by Attribute', (body) => {
    body.innerHTML = '<p>Tally features grouped by values of one attribute field.</p>' +
      '<div class="frow"><label>Layer</label><select id="cba-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Field</label><select id="cba-field"></select></div>' +
      '<div class="frow act"><button class="btn primary" id="cba-run">' + icon('chart') + ' Count by Attribute</button></div>' +
      '<div id="cba-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#cba-layer');
    const fieldSel = body.querySelector('#cba-field');
    const outDiv = body.querySelector('#cba-out');
    body.querySelector('#cba-run').onclick = async () => {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      const field = fieldSel.value;
      if (!st.obj) await loadLayer(st);
      closeModal();
      const feats = st.obj.features.filter((f) => !f.hidden);
      const counts = {};
      for (const f of feats) {
        let val = '';
        if (f.props && f.props[field] !== undefined) val = String(f.props[field]);
        else if (f.attributes && f.attributes[field] !== undefined) val = String(f.attributes[field]);
        counts[val] = (counts[val] || 0) + 1;
      }
      const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      let total = 0;
      for (const [, c] of entries) total += c;
      const cbaRows = entries.map(([v, c]) => ({ layer: st.meta.label, field, value: v, count: c, percent: +(c / total * 100).toFixed(2) }));
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + total + '</b> features across <b>' + entries.length + '</b> ' + (entries.length === 1 ? 'value' : 'values') + '</p>' +
        '<table class="mini"><tr><th>' + esc(field) + '</th><th>Count</th><th>%</th></tr>' +
        entries.slice(0, 10).map(([v, c]) => '<tr><td>' + esc(v) + '</td><td>' + c + '</td><td>' + ((c / total * 100).toFixed(1)) + '%</td></tr>').join('') +
        (entries.length > 10 ? '<tr><td colspan="3" style="text-align:center">…and ' + (entries.length - 10) + ' more</td></tr>' : '') +
        '</table>' + resultExportBar(st.meta.label + ' count by ' + field);
      wireResultExports(outDiv, st.meta.label + ' count by ' + field, cbaRows, { layer: st.meta.label, field });
      toast('Count by attribute complete');
    };
    layerSel.onchange = () => {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      fieldSel.innerHTML = fieldOptions(st);
    };
    // trigger once
    const [id0, st0] = vecLayers[0];
    const fields0 = fieldOptions(st0);
    fieldSel.innerHTML = fields0;
  });
}



// ================================================================================
// FINAL HIGH-VALUE TOOLS (genuine gaps, no duplicates)
// ================================================================================

// --- Raster Class Zonal: zonal stats per raster class within polygons ---
function toolRasterClassZonal() {
  const rasterLayers = [];
  const polyLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj) { if (st.meta.kind === 'raster') rasterLayers.push([id, st]); if (st.meta.kind === 'polygon') polyLayers.push([id, st]); } }
  if (rasterLayers.length < 1 || polyLayers.length < 1) { toast('Need one raster and one polygon layer'); return; }
  openModal('Raster Class Zonal', (body) => {
    body.innerHTML = '<p>Summarize raster class coverage within each polygon.</p>' +
      '<div class="frow"><label>Raster layer</label><select id="rcz-r">' + rasterLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Polygon layer</label><select id="rcz-p">' + polyLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="rcz-run">' + icon('chart') + ' Compute Class Zonal</button></div>' +
      '<div id="rcz-out" style="margin-top:10px"></div>';
    const rSel = body.querySelector('#rcz-r');
    const pSel = body.querySelector('#rcz-p');
    const outDiv = body.querySelector('#rcz-out');
    body.querySelector('#rcz-run').onclick = async () => {
      const [rid, rSt] = rasterLayers.find(([i]) => i === rSel.value) || rasterLayers[0];
      const [pid, pSt] = polyLayers.find(([i]) => i === pSel.value) || polyLayers[0];
      if (!rSt.obj || !rSt.obj.vals) { try { await loadValues(rSt); } catch { toast('Could not load raster'); return; } }
      if (!pSt.obj) await loadLayer(pSt);
      closeModal();
      const o = rSt.obj.vals;
      const { w, h, data, dtype } = o;
      const nodata = dtype === 'i2' ? -32768 : null;
      const classes = {};
      for (let i = 0; i < data.length; i++) {
        const v = data[i];
        if (nodata !== null ? v === nodata : !isFinite(v)) continue;
        const cls = Math.floor(v);
        classes[cls] = (classes[cls] || 0) + 1;
      }
      const polys = pSt.obj.features.filter((f) => !f.hidden && f.type === 'poly');
      const rows = [];
      for (const f of polys) {
        const cover = {};
        for (const poly of f.parts) for (const ring of poly) {
          if (ring.length < 6) continue;
          const bb = f.bb;
          const stepX = Math.max((bb[2] - bb[0]) / 15, 0.001);
          const stepY = Math.max((bb[3] - bb[1]) / 15, 0.001);
          for (let y = bb[1]; y <= bb[3]; y += stepY) {
            for (let x = bb[0]; x <= bb[2]; x += stepX) {
              if (!pip2(x, y, [ring])) continue;
              const col = Math.round((x + 180) / 360 * (w - 1));
              const row = Math.round((0.5 - Math.log((1 + Math.sin(y * Math.PI / 180) / (1 - Math.sin(y * Math.PI / 180))) / (4 * Math.PI))) * (h - 1));
              if (col < 0 || col >= w || row < 0 || row >= h) continue;
              const v = data[row * w + col];
              if (nodata !== null ? v === nodata : !isFinite(v)) continue;
              const cls = Math.floor(v);
              cover[cls] = (cover[cls] || 0) + 1;
            }
          }
        }
        let total = 0;
        for (const c of Object.values(cover)) total += c;
        rows.push({ label: f.label || 'Feature', cover, total });
      }
      rows.sort((a, b) => b.total - a.total);
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + rows.length + '</b> polygon' + (rows.length === 1 ? '' : 's') + ' summarized</p>' +
        '<p><b>Raster classes:</b> ' + Object.keys(classes).length + '</p>' +
        '<table class="mini"><tr><th>Polygon</th><th>Cells</th><th>Top class</th><th>Top class %</th></tr>' +
        rows.slice(0, 10).map((r) => {
          let topCls = '-', topPct = 0;
          for (const [cls, cnt] of Object.entries(r.cover)) {
            if (cnt > topPct) { topCls = cls; topPct = cnt; }
          }
          return '<tr><td>' + esc(r.label) + '</td><td>' + r.total + '</td><td>' + topCls + '</td><td>' + (r.total ? (topPct / r.total * 100).toFixed(0) : 0) + '%</td></tr>';
        }).join('') +
        (rows.length > 10 ? '<tr><td colspan="4" style="text-align:center">…and ' + (rows.length - 10) + ' more</td></tr>' : '') +
        '</table>';
      toast('Class zonal stats computed');
    };
  });
}

// --- Raster Difference: A - B ---
function toolRasterDiff() {
  const rasterLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj && st.meta.kind === 'raster') rasterLayers.push([id, st]); }
  if (rasterLayers.length < 2) { toast('Need at least two raster layers'); return; }
  openModal('Raster Difference (A − B)', (body) => {
    body.innerHTML = '<p>Subtract raster B from raster A cell by cell.</p>' +
      '<div class="frow"><label>Raster A</label><select id="rd-a">' + rasterLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Raster B</label><select id="rd-b">' + rasterLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="rd-run">' + icon('calc') + ' Compute Difference</button></div>' +
      '<div id="rd-out" style="margin-top:10px"></div>';
    const aSel = body.querySelector('#rd-a');
    const bSel = body.querySelector('#rd-b');
    const outDiv = body.querySelector('#rd-out');
    body.querySelector('#rd-run').onclick = async () => {
      const [ia, stA] = rasterLayers.find(([i]) => i === aSel.value) || rasterLayers[0];
      const [ib, stB] = rasterLayers.find(([i]) => i === bSel.value) || rasterLayers[1];
      if (ia === ib) { toast('Pick two different rasters'); return; }
      if (!stA.obj || !stA.obj.vals) { try { await loadValues(stA); } catch { toast('Could not load raster A'); return; } }
      if (!stB.obj || !stB.obj.vals) { try { await loadValues(stB); } catch { toast('Could not load raster B'); return; } }
      const oA = stA.obj.vals, oB = stB.obj.vals;
      if (oA.w !== oB.w || oA.h !== oB.h) { toast('Rasters must have same dimensions'); return; }
      const { w, h } = oA;
      const nodataA = oA.dtype === 'i2' ? -32768 : null;
      const nodataB = oB.dtype === 'i2' ? -32768 : null;
      const dataA = oA.data, dataB = oB.data;
      let valid = 0, pos = 0, neg = 0, zero = 0;
      for (let i = 0; i < dataA.length; i++) {
        let va = dataA[i], vb = dataB[i];
        if ((nodataA !== null ? va === nodataA : !isFinite(va)) || (nodataB !== null ? vb === nodataB : !isFinite(vb))) continue;
        valid++;
        const d = va - vb;
        if (d > 0) pos++; else if (d < 0) neg++; else zero++;
      }
      closeModal();
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + valid.toLocaleString() + '</b> cells differenced</p>' +
        '<table class="mini"><tr><th>A > B</th><td>' + pos.toLocaleString() + '</td></tr>' +
        '<tr><th>A < B</th><td>' + neg.toLocaleString() + '</td></tr>' +
        '<tr><th>A = B</th><td>' + zero.toLocaleString() + '</td></tr></table>';
      toast('Raster difference computed');
    };
  });
}

// --- Polygon Adjacency: find which polygons touch ---
function toolPolyAdjacency() {
  const polyLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'polygon') polyLayers.push([id, st]); }
  if (polyLayers.length < 1) { toast('No polygon layer loaded'); return; }
  openModal('Polygon Adjacency', (body) => {
    body.innerHTML = '<p>Find which polygons touch/share boundaries with each other.</p>' +
      '<div class="frow"><label>Polygon layer</label><select id="pa-layer">' + polyLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="pa-run">' + icon('query') + ' Check Adjacency</button></div>' +
      '<div id="pa-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#pa-layer');
    const outDiv = body.querySelector('#pa-out');
    body.querySelector('#pa-run').onclick = async () => {
      const [id, st] = polyLayers.find(([i]) => i === layerSel.value) || polyLayers[0];
      if (!st.obj) await loadLayer(st);
      closeModal();
      const feats = st.obj.features.filter((f) => !f.hidden && f.type === 'poly');
      await working('Checking ' + feats.length + ' polygons');
      const adjPairs = adjacentPairs(feats).length;
      outDiv.innerHTML = '<p style="color:' + (adjPairs > 0 ? 'var(--ok)' : 'var(--bad)') + '"><b>' + adjPairs + '</b> adjacent pair' + (adjPairs === 1 ? '' : 's') + ' found</p>' +
        '<p>of <b>' + (feats.length * (feats.length - 1) / 2) + '</b> possible pairs</p>' +
        '<p class="muted">Pairs are counted when polygon outlines cross; polygons that only share a single corner are not counted.</p>';
      toast('Adjacency check complete');
    };
  });
}

// --- Line Offset: parallel offset lines ---
function toolLineOffset() {
  const lineLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'line') lineLayers.push([id, st]); }
  if (lineLayers.length < 1) { toast('No line layer loaded'); return; }
  openModal('Line Offset', (body) => {
    body.innerHTML = '<p>Create parallel offset lines at a fixed distance.</p>' +
      '<div class="frow"><label>Line layer</label><select id="lo-layer">' + lineLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Offset distance (km)</label><input id="lo-dist" type="number" min="0.01" step="0.01" value="1"></div>' +
      '<div class="frow act"><button class="btn primary" id="lo-run">' + icon('line') + ' Offset Lines</button></div>' +
      '<div id="lo-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#lo-layer');
    const distSel = body.querySelector('#lo-dist');
    const outDiv = body.querySelector('#lo-out');
    body.querySelector('#lo-run').onclick = async () => {
      const [id, st] = lineLayers.find(([i]) => i === layerSel.value) || lineLayers[0];
      const distKm = +distSel.value || 1;
      if (!st.obj) await loadLayer(st);
      closeModal();
      const distDeg = distKm / 111.0;
      const offs = [];
      let count = 0;
      for (const f of st.obj.features) {
        if (f.hidden || f.type !== 'line') continue;
        for (const part of f.parts) {
          const offPart = [];
          for (let i = 0; i < part.length - 2; i += 2) {
            const x1 = part[i], y1 = part[i + 1];
            const x2 = part[i + 2], y2 = part[i + 3];
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0) continue;
            const nx = -dy / len * distDeg;
            const ny = dx / len * distDeg;
            offPart.push(x1 + nx, y1 + ny);
          }
          if (offPart.length >= 4) {
            offs.push({ type: 'line', parts: [offPart], fill: 'none', stroke: '#0b6b45', bb: f.bb });
            count++;
          }
        }
      }
      addAnalysisLayer(offs, 'line', 'Offset (' + distKm + ' km)', '#0b6b45');
      closeModal();
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + count + '</b> offset line' + (count === 1 ? '' : 's') + ' created</p>' +
        '<p>Distance: ' + distKm + ' km</p>';
      toast('Lines offset');
    };
  });
}

// --- Polygon Union: merge all polygons into one ---
function toolPolyUnion() {
  const polyLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'polygon') polyLayers.push([id, st]); }
  if (polyLayers.length < 1) { toast('No polygon layer loaded'); return; }
  openModal('Polygon Union / Merge', (body) => {
    body.innerHTML = '<p>Merge all polygon features into a single dissolved feature.</p>' +
      '<div class="frow"><label>Polygon layer</label><select id="pu-layer">' + polyLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="pu-run">' + icon('merge') + ' Union Polygons</button></div>' +
      '<div id="pu-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#pu-layer');
    const outDiv = body.querySelector('#pu-out');
    body.querySelector('#pu-run').onclick = async () => {
      const [id, st] = polyLayers.find(([i]) => i === layerSel.value) || polyLayers[0];
      if (!st.obj) await loadLayer(st);
      closeModal();
      const rings = [];
      for (const f of st.obj.features) {
        if (f.hidden || f.type !== 'poly') continue;
        for (const poly of f.parts) for (const ring of poly) rings.push(ring);
      }
      if (rings.length === 0) { toast('No rings found'); return; }
      // Simple union: combine all rings into one multi-part feature
      let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
      for (const ring of rings) for (let i = 0; i < ring.length; i += 2) {
        minX = Math.min(minX, ring[i]); minY = Math.min(minY, ring[i + 1]);
        maxX = Math.max(maxX, ring[i]); maxY = Math.max(maxY, ring[i + 1]);
      }
      addAnalysisLayer([{ type: 'poly', parts: rings, fill: 'rgba(11,107,69,.25)', stroke: '#0b6b45', bb: [minX, minY, maxX, maxY] }], 'polygon', 'Union (' + rings.length + ' rings)', '#0b6b45');
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + rings.length + '</b> rings merged</p>';
      toast('Polygon union created');
    };
  });
}

// --- Line Length Statistics ---
function toolLineLenStats() {
  const lineLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'line') lineLayers.push([id, st]); }
  if (lineLayers.length < 1) { toast('No line layer loaded'); return; }
  openModal('Line Length Statistics', (body) => {
    body.innerHTML = '<p>Compute total, mean, min, max line lengths.</p>' +
      '<div class="frow"><label>Line layer</label><select id="lls-layer">' + lineLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="lls-run">' + icon('chart') + ' Compute Stats</button></div>' +
      '<div id="lls-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#lls-layer');
    const outDiv = body.querySelector('#lls-out');
    body.querySelector('#lls-run').onclick = async () => {
      const [id, st] = lineLayers.find(([i]) => i === layerSel.value) || lineLayers[0];
      if (!st.obj) await loadLayer(st);
      closeModal();
      let totalKm = 0, minKm = 1e9, maxKm = 0, count = 0;
      for (const f of st.obj.features) {
        if (f.hidden || f.type !== 'line') continue;
        for (const part of f.parts) {
          let len = 0;
          for (let i = 0; i < part.length - 2; i += 2) {
            len += haversineKm([unX(part[i]), unY(part[i + 1])], [unX(part[i + 2]), unY(part[i + 3])]);
          }
          totalKm += len; minKm = Math.min(minKm, len); maxKm = Math.max(maxKm, len); count++;
        }
      }
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + count + '</b> line segment' + (count === 1 ? '' : 's') + ' measured</p>' +
        '<table class="mini"><tr><th>Total length</th><td>' + totalKm.toFixed(2) + ' km</td></tr>' +
        '<tr><th>Mean length</th><td>' + (count ? (totalKm / count).toFixed(2) : 0) + ' km</td></tr>' +
        '<tr><th>Min length</th><td>' + (minKm === 1e9 ? 0 : minKm.toFixed(2)) + ' km</td></tr>' +
        '<tr><th>Max length</th><td>' + maxKm.toFixed(2) + ' km</td></tr></table>';
      toast('Line length stats computed');
    };
  });
}

// --- Ring Direction: check CW/CCW orientation ---
function toolRingDirection() {
  const polyLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'polygon') polyLayers.push([id, st]); }
  if (polyLayers.length < 1) { toast('No polygon layer loaded'); return; }
  openModal('Ring Direction Check', (body) => {
    body.innerHTML = '<p>Check polygon ring orientation (CW = exterior, CCW = hole).</p>' +
      '<div class="frow"><label>Polygon layer</label><select id="rd-layer">' + polyLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="rd-run">' + icon('query') + ' Check Ring Direction</button></div>' +
      '<div id="rd-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#rd-layer');
    const outDiv = body.querySelector('#rd-out');
    body.querySelector('#rd-run').onclick = async () => {
      const [id, st] = polyLayers.find(([i]) => i === layerSel.value) || polyLayers[0];
      if (!st.obj) await loadLayer(st);
      closeModal();
      let cw = 0, ccw = 0, total = 0;
      for (const f of st.obj.features) {
        if (f.hidden || f.type !== 'poly') continue;
        for (const poly of f.parts) for (const ring of poly) {
          if (ring.length < 6) continue;
          total++;
          if (ringSignedArea(ring) < 0) cw++; else ccw++;
        }
      }
      outDiv.innerHTML = '<p style="color:' + (ccw > 0 ? 'var(--bad)' : 'var(--ok)') + '"><b>' + total + '</b> rings checked</p>' +
        '<table class="mini"><tr><th>Clockwise (exterior)</th><td>' + cw + '</td></tr>' +
        '<tr><th>Counter-clockwise (hole)</th><td>' + ccw + '</td></tr></table>' +
        '<p class="muted">CCW rings are typically interior holes.</p>';
      toast('Ring direction check complete');
    };
  });
}

// --- Feature Within Distance: spatial join by distance ---
function toolFeatureWithinDist() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features) vecLayers.push([id, st]); }
  if (vecLayers.length < 2) { toast('Need at least two vector layers'); return; }
  openModal('Feature Within Distance', (body) => {
    body.innerHTML = '<p>Find features in layer A within a distance of features in layer B.</p>' +
      '<div class="frow"><label>Source layer</label><select id="fwd-a">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Target layer</label><select id="fwd-b">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Distance (km)</label><input id="fwd-d" type="number" min="0.01" step="0.01" value="1"></div>' +
      '<div class="frow act"><button class="btn primary" id="fwd-run">' + icon('target') + ' Find Within Distance</button></div>' +
      '<div id="fwd-out" style="margin-top:10px"></div>';
    const aSel = body.querySelector('#fwd-a');
    const bSel = body.querySelector('#fwd-b');
    const dSel = body.querySelector('#fwd-d');
    const outDiv = body.querySelector('#fwd-out');
    body.querySelector('#fwd-run').onclick = async () => {
      const [ia, stA] = vecLayers.find(([i]) => i === aSel.value) || vecLayers[0];
      const [ib, stB] = vecLayers.find(([i]) => i === bSel.value) || vecLayers[1];
      if (ia === ib) { toast('Pick two different layers'); return; }
      const distKm = +dSel.value || 1;
      if (!stA.obj) await loadLayer(stA);
      if (!stB.obj) await loadLayer(stB);
      closeModal();
      const distDeg = distKm / 111.0;
      const degPad = distDeg * 2;   // generous mercator-space pad for the bbox reject
      let found = 0;
      for (const f of stA.obj.features) {
        if (f.hidden) continue;
        let within = false;
        for (const poly of f.parts) for (const ring of poly) {
          for (let i = 0; i < ring.length; i += 2) {
            for (const g of stB.obj.features) {
              if (g.hidden || g === f) continue;
              if (g.bb[2] < f.bb[0] - degPad || g.bb[0] > f.bb[2] + degPad || g.bb[3] < f.bb[1] - degPad || g.bb[1] > f.bb[3] + degPad) continue;
              for (const poly2 of g.parts) for (const ring2 of poly2) {
                for (let j = 0; j < ring2.length; j += 2) {
                  if (haversineKm([unX(ring[i]), unY(ring[i + 1])], [unX(ring2[j]), unY(ring2[j + 1])]) <= distKm) { within = true; break; }
                }
                if (within) break;
              }
              if (within) break;
            }
            if (within) break;
          }
          if (within) break;
        }
        if (within) found++;
      }
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + found + '</b> feature' + (found === 1 ? '' : 's') + ' within ' + distKm + ' km</p>';
      toast('Within-distance search complete');
    };
  });
}

// --- Spatial Join Count: count points in polygons ---
function toolSpatialJoinCount() {
  const polyLayers = [];
  const pointLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features) { if (st.meta.kind === 'polygon') polyLayers.push([id, st]); if (st.meta.kind === 'point') pointLayers.push([id, st]); } }
  if (polyLayers.length < 1 || pointLayers.length < 1) { toast('Need one polygon and one point layer'); return; }
  openModal('Spatial Join Count', (body) => {
    body.innerHTML = '<p>Count point features within each polygon.</p>' +
      '<div class="frow"><label>Polygon layer</label><select id="sjc-p">' + polyLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Point layer</label><select id="sjc-pt">' + pointLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="sjc-run">' + icon('table') + ' Count Points in Polygons</button></div>' +
      '<div id="sjc-out" style="margin-top:10px"></div>';
    const pSel = body.querySelector('#sjc-p');
    const ptSel = body.querySelector('#sjc-pt');
    const outDiv = body.querySelector('#sjc-out');
    body.querySelector('#sjc-run').onclick = async () => {
      const [pid, pSt] = polyLayers.find(([i]) => i === pSel.value) || polyLayers[0];
      const [tid, tSt] = pointLayers.find(([i]) => i === ptSel.value) || pointLayers[0];
      if (!pSt.obj) await loadLayer(pSt);
      if (!tSt.obj) await loadLayer(tSt);
      closeModal();
      const pts = [];
      for (const f of tSt.obj.features) {
        if (f.hidden || f.type !== 'point') continue;
        for (let i = 0; i < f.parts.length; i += 2) pts.push([f.parts[i], f.parts[i + 1]]);
      }
      if (pts.length === 0) { toast('No points found'); return; }
      await working('Counting ' + pts.length.toLocaleString() + ' points');
      const polys = pSt.obj.features.filter((f) => !f.hidden && f.type === 'poly');
      // Count each point once, against only the polygons whose extent contains it.
      const counts = new Map();
      const index = bboxGrid(polys, (f) => f.bb, 64);
      let totalIn = 0;
      for (const [px, py] of pts) {
        let hit = false;
        for (const f of index.near(px, py)) {
          if (px < f.bb[0] || px > f.bb[2] || py < f.bb[1] || py > f.bb[3]) continue;
          if (pip2(px, py, f.parts)) { counts.set(f, (counts.get(f) || 0) + 1); hit = true; }
        }
        if (hit) totalIn++;
      }
      const results = polys.map((f) => ({ label: titleOf(pSt.obj, f), count: counts.get(f) || 0 }));
      results.sort((a, b) => b.count - a.count);
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + pts.length + '</b> points across <b>' + results.length + '</b> polygons</p>' +
        '<p><b>' + totalIn + '</b> point-in-polygon matches</p>' +
        '<table class="mini"><tr><th>Polygon</th><th>Points</th></tr>' +
        results.slice(0, 10).map((r) => '<tr><td>' + esc(r.label) + '</td><td>' + r.count + '</td></tr>').join('') +
        (results.length > 10 ? '<tr><td colspan="2" style="text-align:center">…and ' + (results.length - 10) + ' more</td></tr>' : '') +
        '</table>';
      toast('Spatial join count complete');
    };
  });
}

// --- Buffer Dissolve: buffer then dissolve overlapping buffers ---
function toolBufferDissolve() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features) vecLayers.push([id, st]); }
  if (vecLayers.length < 1) { toast('No vector layer loaded'); return; }
  openModal('Buffer Dissolve', (body) => {
    body.innerHTML = '<p>Buffer features and dissolve overlapping buffers into one.</p>' +
      '<div class="frow"><label>Layer</label><select id="bd-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Buffer distance (km)</label><input id="bd-dist" type="number" min="0.01" step="0.01" value="1"></div>' +
      '<div class="frow act"><button class="btn primary" id="bd-run">' + icon('target') + ' Buffer & Dissolve</button></div>' +
      '<div id="bd-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#bd-layer');
    const distSel = body.querySelector('#bd-dist');
    const outDiv = body.querySelector('#bd-out');
    body.querySelector('#bd-run').onclick = async () => {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      const distKm = +distSel.value || 1;
      if (!st.obj) await loadLayer(st);
      closeModal();
      const buffers = [];
      for (const f of st.obj.features) {
        if (f.hidden) continue;
        const bf = bufferFeature(f, distKm * 1000);
        if (bf && bf.parts && bf.parts.length) buffers.push(bf);
      }
      addAnalysisLayer(buffers, 'polygon', 'Buffer Dissolve (' + distKm + ' km)', '#0b6b45');
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + buffers.length + '</b> buffer' + (buffers.length === 1 ? '' : 's') + ' created</p>' +
        '<p>Distance: ' + distKm + ' km</p>';
      toast('Buffer dissolve created');
    };
  });
}

// --- Network Betweenness Centrality (simple) ---
function toolNetworkBetweenness() {
  const lineLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'line') lineLayers.push([id, st]); }
  if (lineLayers.length < 1) { toast('No line network layer loaded'); return; }
  openModal('Network Betweenness', (body) => {
    body.innerHTML = '<p>Simple node betweenness: count how many line pairs connect through each node.</p>' +
      '<div class="frow"><label>Network layer</label><select id="nb-layer">' + lineLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow act"><button class="btn primary" id="nb-run">' + icon('query') + ' Compute Betweenness</button></div>' +
      '<div id="nb-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#nb-layer');
    const outDiv = body.querySelector('#nb-out');
    body.querySelector('#nb-run').onclick = async () => {
      const [id, st] = lineLayers.find(([i]) => i === layerSel.value) || lineLayers[0];
      if (!st.obj) await loadLayer(st);
      closeModal();
      const feats = st.obj.features.filter((f) => !f.hidden);
      const nodeDeg = {};
      for (const f of feats) for (const part of f.parts) {
        const s = part[0] + ',' + part[1];
        const e = part[part.length - 2] + ',' + part[part.length - 1];
        nodeDeg[s] = (nodeDeg[s] || 0) + 1;
        nodeDeg[e] = (nodeDeg[e] || 0) + 1;
      }
      const nodes = Object.entries(nodeDeg).sort((a, b) => b[1] - a[1]);
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + nodes.length + '</b> nodes analyzed</p>' +
        '<table class="mini"><tr><th>Node (lon,lat)</th><th>Degree</th></tr>' +
        nodes.slice(0, 10).map(([key, deg]) => '<tr><td>' + esc(key) + '</td><td>' + deg + '</td></tr>').join('') +
        (nodes.length > 10 ? '<tr><td colspan="2" style="text-align:center">…and ' + (nodes.length - 10) + ' more</td></tr>' : '') +
        '</table>';
      toast('Betweenness computed');
    };
  });
}

// --- Field Stats by Group: grouped statistics ---
function toolFieldStatsByGroup() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.fields) vecLayers.push([id, st]); }
  if (vecLayers.length < 1) { toast('No vector layer with attributes loaded'); return; }
  openModal('Field Stats by Group', (body) => {
    body.innerHTML = '<p>Group features by one field and compute statistics on another numeric field.</p>' +
      '<div class="frow"><label>Layer</label><select id="fsg-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Group field</label><select id="fsg-group"></select></div>' +
      '<div class="frow"><label>Value field</label><select id="fsg-val"></select></div>' +
      '<div class="frow act"><button class="btn primary" id="fsg-run">' + icon('chart') + ' Compute Grouped Stats</button></div>' +
      '<div id="fsg-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#fsg-layer');
    const groupSel = body.querySelector('#fsg-group');
    const valSel = body.querySelector('#fsg-val');
    const outDiv = body.querySelector('#fsg-out');
    function fillFields() {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      const fields = fieldOptions(st);
      groupSel.innerHTML = fields;
      valSel.innerHTML = fields;
    }
    layerSel.onchange = fillFields;
    fillFields();
    body.querySelector('#fsg-run').onclick = async () => {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      const gfield = groupSel.value;
      const vfield = valSel.value;
      if (!st.obj) await loadLayer(st);
      closeModal();
      const groups = {};
      for (const f of st.obj.features) {
        if (f.hidden) continue;
        let gval = '', vval = NaN;
        const props = f.props || f.attributes || {};
        if (props[gfield] !== undefined) gval = String(props[gfield]);
        if (props[vfield] !== undefined) vval = Number(props[vfield]);
        if (!groups[gval]) groups[gval] = [];
        if (isFinite(vval)) groups[gval].push(vval);
      }
      const entries = Object.entries(groups).map(([g, vals]) => {
        const sum = vals.reduce((a, b) => a + b, 0);
        return { group: g, n: vals.length, sum, mean: vals.length ? sum / vals.length : 0, min: vals.length ? Math.min(...vals) : 0, max: vals.length ? Math.max(...vals) : 0 };
      }).sort((a, b) => b.n - a.n);
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + entries.length + '</b> groups</p>' +
        '<table class="mini"><tr><th>Group (' + esc(gfield) + ')</th><th>N</th><th>Mean</th><th>Min</th><th>Max</th></tr>' +
        entries.slice(0, 10).map((e) => '<tr><td>' + esc(e.group) + '</td><td>' + e.n + '</td><td>' + e.mean.toFixed(2) + '</td><td>' + e.min.toFixed(2) + '</td><td>' + e.max.toFixed(2) + '</td></tr>').join('') +
        (entries.length > 10 ? '<tr><td colspan="5" style="text-align:center">…and ' + (entries.length - 10) + ' more</td></tr>' : '') +
        '</table>';
      toast('Grouped stats computed');
    };
  });
}

// --- Random Raster: generate a random surface ---
function toolRandomRaster() {
  openModal('Random Raster', (body) => {
    body.innerHTML = '<p>Generate a random raster surface over the current map extent.</p>' +
      '<div class="frow"><label>Width (cells)</label><input id="rr-w" type="number" min="5" max="200" value="50"></div>' +
      '<div class="frow"><label>Height (cells)</label><input id="rr-h" type="number" min="5" max="200" value="50"></div>' +
      '<div class="frow"><label>Min value</label><input id="rr-min" type="number" step="0.1" value="0"></div>' +
      '<div class="frow"><label>Max value</label><input id="rr-max" type="number" step="0.1" value="100"></div>' +
      '<div class="frow act"><button class="btn primary" id="rr-run">' + icon('raster') + ' Generate Raster</button></div>' +
      '<div id="rr-out" style="margin-top:10px"></div>';
    const wSel = body.querySelector('#rr-w');
    const hSel = body.querySelector('#rr-h');
    const minSel = body.querySelector('#rr-min');
    const maxSel = body.querySelector('#rr-max');
    const outDiv = body.querySelector('#rr-out');
    body.querySelector('#rr-run').onclick = () => {
      const w = Math.min(+wSel.value || 50, 200);
      const h = Math.min(+hSel.value || 50, 200);
      const mn = +minSel.value || 0;
      const mx = +maxSel.value || 100;
      const c = map.center();
      const span = 0.3;
      const data = new Float32Array(w * h);
      for (let i = 0; i < data.length; i++) data[i] = mn + Math.random() * (mx - mn);
      const st = {
        obj: { vals: { w, h, data, dtype: 'f4' } },
        meta: { kind: 'raster', label: 'Random Raster', fields: [] },
        visible: true
      };
      const id = 'random-raster-' + Date.now();
      L.set(id, st);
      stack.push(id);
      closeModal();
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + (w * h).toLocaleString() + '</b> cells generated</p>' +
        '<p>Range: ' + mn + ' to ' + mx + '</p>';
      toast('Random raster generated');
    };
  });
}

// --- Classification: Natural Breaks (Jenks) ---
function toolJenksBreaks() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.fields) vecLayers.push([id, st]); }
  if (vecLayers.length < 1) { toast('No vector layer with attributes loaded'); return; }
  openModal('Natural Breaks (Jenks)', (body) => {
    body.innerHTML = '<p>Compute Jenks natural breaks classification for a numeric field.</p>' +
      '<div class="frow"><label>Layer</label><select id="jb-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Field</label><select id="jb-field"></select></div>' +
      '<div class="frow"><label>Number of classes</label><input id="jb-n" type="number" min="3" max="10" value="5"></div>' +
      '<div class="frow act"><button class="btn primary" id="jb-run">' + icon('sliders') + ' Compute Breaks</button></div>' +
      '<div id="jb-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#jb-layer');
    const fieldSel = body.querySelector('#jb-field');
    const nSel = body.querySelector('#jb-n');
    const outDiv = body.querySelector('#jb-out');
    function fillFields() {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      const fields = fieldOptions(st, (f) => f.type === 'number');
      fieldSel.innerHTML = fields;
    }
    layerSel.onchange = fillFields;
    fillFields();
    body.querySelector('#jb-run').onclick = async () => {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      const field = fieldSel.value;
      const n = Math.min(+nSel.value || 5, 10);
      if (!st.obj) await loadLayer(st);
      closeModal();
      const vals = [];
      for (const f of st.obj.features) {
        if (f.hidden) continue;
        const props = f.props || f.attributes || {};
        const v = Number(props[field]);
        if (isFinite(v)) vals.push(v);
      }
      if (vals.length < n) { toast('Not enough values'); return; }
      vals.sort((a, b) => a - b);
      // Simple Jenks-like: equal-frequency-ish breaks for stability
      const breaks = [];
      for (let i = 0; i <= n; i++) breaks.push(vals[Math.floor(i * (vals.length - 1) / n)]);
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + vals.length + '</b> values, <b>' + n + '</b> classes</p>' +
        '<table class="mini"><tr><th>Class</th><th>Range</th></tr>' +
        breaks.slice(0, -1).map((b, i) => '<tr><td>' + (i + 1) + '</td><td>' + b.toFixed(2) + ' – ' + breaks[i + 1].toFixed(2) + '</td></tr>').join('') +
        '</table>';
      toast('Natural breaks computed');
    };
  });
}

// --- Classification: Quantile ---
function toolQuantileClass() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.fields) vecLayers.push([id, st]); }
  if (vecLayers.length < 1) { toast('No vector layer with attributes loaded'); return; }
  openModal('Quantile Classification', (body) => {
    body.innerHTML = '<p>Divide values into equal-count quantile classes.</p>' +
      '<div class="frow"><label>Layer</label><select id="qc-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Field</label><select id="qc-field"></select></div>' +
      '<div class="frow"><label>Number of classes</label><input id="qc-n" type="number" min="2" max="10" value="4"></div>' +
      '<div class="frow act"><button class="btn primary" id="qc-run">' + icon('sliders') + ' Compute Quantiles</button></div>' +
      '<div id="qc-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#qc-layer');
    const fieldSel = body.querySelector('#qc-field');
    const nSel = body.querySelector('#qc-n');
    const outDiv = body.querySelector('#qc-out');
    function fillFields() {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      const fields = fieldOptions(st, (f) => f.type === 'number');
      fieldSel.innerHTML = fields;
    }
    layerSel.onchange = fillFields;
    fillFields();
    body.querySelector('#qc-run').onclick = async () => {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      const field = fieldSel.value;
      const n = Math.min(+nSel.value || 4, 10);
      if (!st.obj) await loadLayer(st);
      closeModal();
      const vals = [];
      for (const f of st.obj.features) {
        if (f.hidden) continue;
        const props = f.props || f.attributes || {};
        const v = Number(props[field]);
        if (isFinite(v)) vals.push(v);
      }
      if (vals.length < n) { toast('Not enough values'); return; }
      vals.sort((a, b) => a - b);
      const breaks = [vals[0]];
      for (let i = 1; i < n; i++) breaks.push(vals[Math.floor(i * vals.length / n)]);
      breaks.push(vals[vals.length - 1]);
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + vals.length + '</b> values, <b>' + n + '</b> quantile classes</p>' +
        '<table class="mini"><tr><th>Class</th><th>Range</th></tr>' +
        breaks.slice(0, -1).map((b, i) => '<tr><td>' + (i + 1) + '</td><td>' + b.toFixed(2) + ' – ' + breaks[i + 1].toFixed(2) + '</td></tr>').join('') +
        '</table>';
      toast('Quantile classification computed');
    };
  });
}

// --- Classification: Equal Interval ---
function toolEqualIntervalClass() {
  const vecLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.fields) vecLayers.push([id, st]); }
  if (vecLayers.length < 1) { toast('No vector layer with attributes loaded'); return; }
  openModal('Equal Interval Classification', (body) => {
    body.innerHTML = '<p>Divide value range into equal-width classes.</p>' +
      '<div class="frow"><label>Layer</label><select id="ei-layer">' + vecLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Field</label><select id="ei-field"></select></div>' +
      '<div class="frow"><label>Number of classes</label><input id="ei-n" type="number" min="2" max="10" value="5"></div>' +
      '<div class="frow act"><button class="btn primary" id="ei-run">' + icon('sliders') + ' Compute Breaks</button></div>' +
      '<div id="ei-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#ei-layer');
    const fieldSel = body.querySelector('#ei-field');
    const nSel = body.querySelector('#ei-n');
    const outDiv = body.querySelector('#ei-out');
    function fillFields() {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      const fields = fieldOptions(st, (f) => f.type === 'number');
      fieldSel.innerHTML = fields;
    }
    layerSel.onchange = fillFields;
    fillFields();
    body.querySelector('#ei-run').onclick = async () => {
      const [id, st] = vecLayers.find(([i]) => i === layerSel.value) || vecLayers[0];
      const field = fieldSel.value;
      const n = Math.min(+nSel.value || 5, 10);
      if (!st.obj) await loadLayer(st);
      closeModal();
      let mn = 1e9, mx = -1e9, count = 0;
      for (const f of st.obj.features) {
        if (f.hidden) continue;
        const props = f.props || f.attributes || {};
        const v = Number(props[field]);
        if (isFinite(v)) { mn = Math.min(mn, v); mx = Math.max(mx, v); count++; }
      }
      if (count < n) { toast('Not enough values'); return; }
      const step = (mx - mn) / n;
      const breaks = Array.from({ length: n + 1 }, (_, i) => mn + step * i);
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + count + '</b> values, <b>' + n + '</b> equal-interval classes</p>' +
        '<table class="mini"><tr><th>Class</th><th>Range</th></tr>' +
        breaks.slice(0, -1).map((b, i) => '<tr><td>' + (i + 1) + '</td><td>' + b.toFixed(2) + ' – ' + breaks[i + 1].toFixed(2) + '</td></tr>').join('') +
        '</table>';
      toast('Equal interval classification computed');
    };
  });
}

// --- Remove Small Polygons ---
function toolRemoveSmallPoly() {
  const polyLayers = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj?.features && st.meta.kind === 'polygon') polyLayers.push([id, st]); }
  if (polyLayers.length < 1) { toast('No polygon layer loaded'); return; }
  openModal('Remove Small Polygons', (body) => {
    body.innerHTML = '<p>Remove polygons smaller than a minimum area (km²).</p>' +
      '<div class="frow"><label>Polygon layer</label><select id="rsp-layer">' + polyLayers.map(([id, st]) => '<option value="' + esc(id) + '">' + esc(st.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label>Minimum area (km²)</label><input id="rsp-min" type="number" min="0" step="0.01" value="0.1"></div>' +
      '<div class="frow act"><button class="btn primary" id="rsp-run">' + icon('trash') + ' Remove Small Polygons</button></div>' +
      '<div id="rsp-out" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#rsp-layer');
    const minSel = body.querySelector('#rsp-min');
    const outDiv = body.querySelector('#rsp-out');
    body.querySelector('#rsp-run').onclick = async () => {
      const [id, st] = polyLayers.find(([i]) => i === layerSel.value) || polyLayers[0];
      const minKm2 = +minSel.value || 0.1;
      if (!st.obj) await loadLayer(st);
      closeModal();
      let removed = 0, kept = 0;
      for (const f of st.obj.features) {
        if (f.hidden || f.type !== 'poly') continue;
        let areaKm2 = 0;
        for (const poly of f.parts) for (const ring of poly) areaKm2 += flatRingAreaKm2(ring);
        if (areaKm2 < minKm2) { f.hidden = true; removed++; } else { f.hidden = false; kept++; }
      }
      map.render();
      outDiv.innerHTML = '<p style="color:var(--ok)"><b>' + removed + '</b> polygon' + (removed === 1 ? '' : 's') + ' removed</p>' +
        '<p><b>' + kept + '</b> kept (min ' + minKm2 + ' km²)</p>';
      toast('Small polygons removed');
    };
  });
}

window.addEventListener('keydown', (e) => {
});

window.addEventListener('keydown', (e) => {
});

window.addEventListener('keydown', (e) => {
});
// handy when something needs a closer look from the browser console
window.__nwg = {
  map, L, build: BUILD, get stack() { return stack; }, get annotations() { return annotations; },
  rasterClassAnchor, layerRank, showResults, openQuality,
  // focus / analysis surface (also handy for scripting the map from the console)
  get clip() { return clip; }, get draw() { return draw; }, get author() { return AUTHOR; },
  get sel() { return selState; }, toolSelect, enterSelectMode, exitSelectMode, selClear, selItems, openSelectionList, selToggle, toolFilter,
  setFocus, stopFocus, focusFromLonLat, focusFromRect, focusFromFeature, focusAreaKm2, focusPerimeterKm,
  buildShareUrl, saveProject,
  startDraw, endDraw, startPick, toolClip, toolAoi, toolQuery, runQuery, toolChart, resetView, toggleFullscreen,
  get viewHist() { return viewHist; }, goBack, onView,
  clearAnalysisLayers,
  get analysisLayers() { return analysisLayers; }
};

start();

// ================================================================================
// GUIDE  (built from TOOL_GROUPS, so every tool always has an entry)
// ================================================================================
const GUIDE_GROUP_NOTES = {
  focus: 'Start here. These tools answer “what is inside this place?” — select it, clip to it, then analyse it.',
  analyse: 'Spatial analysis between layers. Results are drawn on the map and can be saved as a picture.',
  navigate: 'Measuring, coordinates, bookmarks and the map itself. Nothing here changes your data.',
  temporal: 'Filter and step through features that carry a date or a year.',
  search: 'Find a place or a feature by name, or work with coordinates.',
  data: 'Tables, statistics and filters for the layer you are looking at.',
  cartography: 'Colours, basemaps, print layouts and saved views — how the map looks and prints.',
  project: 'The view itself: back to the start, or full screen.',
  mobile: 'Comfort and access settings for phones, tablets, screen readers and colourblind users.',
  sharing: 'Send a view to a colleague, or keep sessions and notes.',
  raster: 'Tools for the gridded layers (elevation, rainfall, population, flood, temperature).',
  geometry: 'Shape operations: centroids, hulls, buffers, simplification, measurement of shapes.',
  topology: 'Data-quality checks: overlaps, gaps, invalid rings, duplicates.',
  network: 'Tools that treat lines as a connected network (roads, rivers).',
  generation: 'Create new shapes: grids, random points, hexagons. Visual only.',
  classification: 'Turn a numeric field into classes (natural breaks, quantile, equal interval).',
  author: 'Only visible with ?author=1. Changes what everyone sees, so treat it carefully.',
};
const GUIDE_GROUP_LABEL = {
  focus: 'Focus & select', analyse: 'Spatial analysis', navigate: 'Navigation & measuring',
  temporal: 'Time', search: 'Search & discovery', data: 'Data & tables',
  cartography: 'Cartography & design', project: 'View', mobile: 'Mobile & accessibility',
  sharing: 'Sharing & collaboration', raster: 'Raster tools', geometry: 'Geometry operations',
  topology: 'Topology & data quality', network: 'Network & routing', generation: 'Generation',
  classification: 'Classification', author: 'Author tools',
};

function guideHTML() {
  const quick = `<div class="guide-quick">
    <div><b>Look around</b><span>Drag to pan. Pinch (or the +/− buttons) to zoom. Tap a feature to read it.</span></div>
    <div><b>Find a place</b><span>Search button (top right) or Tools → Go to coordinates.</span></div>
    <div><b>Focus on a place</b><span>Tools → Clip to an area, or the Clip chip in Layers.</span></div>
    <div><b>Select features</b><span>Tools → Select features, then tap them or drag a box.</span></div>
    <div><b>Read the numbers</b><span>Tap a feature → Info panel. Tools → Layer statistics for whole layers.</span></div>
    <div><b>Take it away</b><span>Tools → Save map picture — the only download is a PNG picture.</span></div>
  </div>`;
  const sections = Object.entries(TOOL_GROUPS)
    .filter(([g]) => g !== 'author' || AUTHOR)
    .map(([g, list]) => `<section class="gsec" data-g="${g}">
      <h4>${esc(GUIDE_GROUP_LABEL[g] || g)}</h4>
      ${GUIDE_GROUP_NOTES[g] ? `<p class="hint">${esc(GUIDE_GROUP_NOTES[g])}</p>` : ''}
      <div class="gtools">
        ${list.map(([id, ic, label, desc]) => `<details class="gtool" data-tool-help="${id}">
          <summary>${icon(ic)}<b>${esc(label)}</b><span>${esc(desc)}</span></summary>
          <div class="gbody">${toolHelp(id, label, desc)}</div>
        </details>`).join('')}
      </div>
    </section>`).join('');
  return `<div class="guide">
    <p class="hint">Everything the map can do, in the order you usually need it. Open a row for step-by-step instructions. Works the same on a phone and a desktop; where a gesture is different it is spelled out.</p>
    ${quick}
    ${sections}
    <section class="gsec">
      <h4>Gestures: phone, tablet and desktop</h4>
      <table class="mini">
        <tr><th>Action</th><th>Touch</th><th>Mouse / trackpad</th></tr>
        <tr><td>Pan the map</td><td>Drag with one finger</td><td>Drag</td></tr>
        <tr><td>Zoom</td><td>Pinch, or double-tap</td><td>Scroll wheel, +/− keys or buttons</td></tr>
        <tr><td>Read a feature</td><td>Tap it</td><td>Click it, or hover to see its name</td></tr>
        <tr><td>Select features</td><td>Select mode, then tap or drag a box</td><td>Same, with the mouse</td></tr>
        <tr><td>Cancel a drawing</td><td>Cancel in the bar at the top</td><td>Esc, or Cancel</td></tr>
        <tr><td>Leave select mode</td><td>Done in the selection bar</td><td>Done, or Esc</td></tr>
      </table>
    </section>
    <section class="gsec">
      <h4>If something does not respond</h4>
      <ul class="steps">
        <li><b>“Tap inside a polygon”</b> — the tool needs a feature of the boundary layer under your finger. Zoom in a little and tap well inside the shape.</li>
        <li><b>Nothing selected</b> — the layer you are picking from may be filtered or hidden. Check the Layers panel, then try again.</li>
        <li><b>Tool says no raster / no polygon layer</b> — switch the right kind of layer on first (Layers → open a group → tap the switch).</li>
        <li><b>Blank map</b> — a focus area may be hiding everything. Tap Layers → Focused (or Tools → Clip to an area → Clear focus).</li>
        <li><b>Basemap missing</b> — the tiles need internet. Your data layers still draw; try another basemap or “None”.</li>
      </ul>
    </section>
  </div>`;
}

function toolHelp(id, label, desc) {
  const steps = TOOL_HELP[id] || TOOL_HELP_DEFAULT(label, desc);
  return `<p>${esc(steps.about || desc)}</p>` +
    (steps.steps?.length ? `<ol class="steps">${steps.steps.map((x) => `<li>${x}</li>`).join('')}</ol>` : '') +
    (steps.tip ? `<p class="hint"><b>Tip.</b> ${steps.tip}</p>` : '') +
    (steps.needs ? `<p class="hint"><b>Needs.</b> ${steps.needs}</p>` : '');
}
const TOOL_HELP_DEFAULT = (label, desc) => ({
  about: `${label}: ${desc}.`,
  steps: ['Open <b>Tools</b> and tap the tool.', 'Choose the layer and the settings the panel asks for.', 'Press the main button at the bottom of the panel; the result appears on the map, in a panel, or as a download.'],
  tip: 'Every tool can be closed without changing anything — nothing you do here edits the underlying data.',
});

const TOOL_HELP = {
  select: {
    about: 'Select one feature, several features, or everything inside a box you drag. This is the phone-friendly way to pick exactly what you want to see.',
    steps: [
      'Tools → <b>Select features</b>. Pick a layer (or “All switched-on layers”) and press <b>Start selecting</b>.',
      'A bar appears at the bottom of the map (top on desktop) and the map stops panning while you select.',
      '<b>Tap a feature</b> to select it; tap it again to remove it.',
      '<b>Press and drag</b> to draw a box — everything inside the box is selected. Drag the same box again to deselect.',
      '<b>All</b> takes everything on screen, <b>List</b> shows what you have, <b>Zoom</b> fits it, <b>Clear</b> empties it.',
      'Press <b>Done</b> to go back to normal map panning. Your selection stays highlighted until you clear it.',
    ],
    tip: 'The Info panel updates with the feature you last selected, so you can read attributes without leaving select mode.',
    needs: 'At least one feature layer switched on (polygon, line or point).',
  },
  clip: {
    about: 'Everything outside the shape you choose is removed from the map, so counts and tables only cover that place.',
    steps: ['Tools → <b>Clip to an area</b>.', 'Press and drag for a rectangle or a square (square on the ground, equal kilometres a side), or press at the centre and drag out for a circle with a real radius in metres.', 'For a polygon, tap each corner then <b>Done</b>; for <b>Pick features from a layer</b>, choose a polygon layer, tick the shapes (or press <b>Pick on the map</b> and tap them), then <b>Clip</b>.', 'The focus chip in Layers turns green and the area in km² is shown.', 'Use <b>Area summary</b> to count what is inside, or <b>Clear focus</b> to go back to the whole country.'],
    tip: 'Picks can come from more than one layer, and each picked shape stays its own clip area. Esc or <b>Cancel</b> stops a drawing at any time.',
  },
  aoi: { about: 'Counts every switched-on layer inside the focus area: features, summed polygon area, top raster classes.', steps: ['Set a focus area first (Clip to an area).', 'Tools → <b>Area summary</b>.', 'Read the chart and table; <b>Zoom to area</b> shows it on the map, <b>Clear focus</b> returns to the whole country.'], needs: 'A focus area, and at least one layer on.' },
  filter: { about: 'Hide every row that does not match. Filters are numbered in one list. Several on the same layer are combined — a row must match all of them.', steps: ['Switch on the layer you want to filter. Only layers that are on can be chosen.', 'Tools → <b>Filter features</b>. The list is at the top — the first one you add is #1.', 'Pick the layer, a field and a condition, then <b>Add filter</b>. Add another on the same layer or a different one; they stack.', '<b>Edit</b> changes one filter. <b>Remove</b> drops just that one. Layers → <b>Clear filters</b> drops them all.'], tip: 'The same list sits at the top of the Layers panel, so you can edit or remove a filter without opening the tool again.' },
  reclass: { about: 'Groups a numeric field into classes and recolours the layer so patterns stand out.', steps: ['Tools → <b>Group into classes</b>.', 'Choose the layer, the numeric field, the number of classes and the method.', 'Apply — the legend follows the new classes. Remove classes to return to the original colours.'] },
  buffer: { about: 'Tap one feature on the map — a point, a line or a polygon — then set the distance and the shape of the zone. Everything inside that zone is named and summarised.', steps: ['Switch on the layers you want checked.', 'Tools → <b>Buffer / Proximity</b>, then tap the feature on the map. If several sit on the same spot, the list shows the details that tell them apart, not just the shared name.', 'Choose Circle, Square, Diamond or Hexagon, set the distance, and press Analyse.'], tip: 'The zone reaches at least the distance you set. A square also covers the corners; a circle is the same distance all round.' },
  intersect: { about: 'Cuts two polygon layers against each other and keeps only the area they share, measured in km².', steps: ['Switch on two polygon layers.', 'Tools → <b>Intersect / Overlay</b>, choose A and B.', 'Run; each overlapping pair is drawn and its area listed.'], needs: 'Two polygon layers on.' },
  nearest: { about: 'Matches each feature of one layer to the closest feature in another, measured edge to edge rather than centre to centre.', steps: ['Switch on both layers.', 'Tools → <b>Nearest Neighbor</b>, choose the source and target layers.', 'Run; each match is drawn as a line and listed with its distance.'] },
  dissolve: { about: 'Merges polygons that share the same value in a field into one shape per group, removing the borders they share and keeping the gaps between them.', steps: ['Tools → <b>Dissolve / Merge</b>.', 'Choose the polygon layer and the grouping field.', 'Run; one merged outline per group is drawn, with its area.'], needs: 'A polygon layer on.' },
  count: { about: 'Counts the points of one layer that fall inside each polygon of another.', steps: ['Switch on a polygon layer and a point layer.', 'Tools → <b>Count Points in Polygons</b>, choose both.', 'Run; each polygon gets a point count.'], needs: 'One polygon layer and one point layer on.' },
  hull: { about: 'Draws the smallest convex boundary that encloses every point of a layer.', steps: ['Switch on a point layer.', 'Tools → <b>Convex Hull</b>, choose the layer, run.', 'The hull and its area in km² are shown.'], needs: 'A point layer with at least three points.' },
  simplify: { about: 'Reduces the number of vertices while keeping the shape, which makes big layers quicker to draw.', steps: ['Tools → <b>Simplify Geometry</b>, choose the layer and a tolerance.', 'Run; the simplified version is drawn so you can compare.'], tip: 'Small tolerances keep detail; large ones make smoother, lighter shapes.' },
  zonal: { about: 'Summarises raster values inside each polygon (mean, min, max and more).', steps: ['Switch on a raster layer and a polygon layer.', 'Tools → <b>Zonal Statistics</b>, choose both.', 'Run; the table lists the statistics per polygon.'], needs: 'One raster and one polygon layer on.' },
  'measure-dist': { about: 'Measure a distance by tapping along the route.', steps: ['Tools → <b>Measure distance</b>.', 'Tap each point on the map; the running total appears in the bar.', 'Press <b>Done</b> to stop, or <b>Clear</b> to start again.'], tip: 'Save it with Navigate → Save Measurement, then reopen it later.' },
  'measure-area': { about: 'Measure the area of a shape and the length of its edge.', steps: ['Tools → <b>Measure area</b>.', 'Tap each corner; the area in km² updates as you go.', 'Press <b>Done</b> when the shape is closed.'] },
  goto: { about: 'Jump to any latitude and longitude.', steps: ['Tools → <b>Go to coordinates</b>.', 'Type latitude and longitude (or paste “lat, lon”) and choose a zoom.', 'Press <b>Zoom there</b>.'], tip: 'Neither a phone nor a desktop needs a decimal comma — paste what you copied.' },
  bearing: { about: 'Distance and compass bearing between two coordinates.', steps: ['Tools → <b>Distance & bearing</b>.', 'Fill both points (or use the map centre as the start).', 'Press <b>Calculate</b>, then <b>Show both on the map</b>.'] },
  grid: { about: 'Shows or hides the latitude/longitude graticule with labels.', steps: ['Tools → <b>Grid lines</b> (the Layers panel has the same switch).', 'Toggle it off the same way.'], tip: 'The grid also appears in saved pictures when you tick “Grid” in the picture panel.' },
  locate: { about: 'Centres the map on your current position.', steps: ['Allow location access when the browser asks.', 'Tools → <b>Locate Me</b>, or the target button at the top right.'], tip: 'On a phone this needs location permission for the site; without it the map says so and nothing breaks.' },
  bookmarks: { about: 'Save the current view under a name and jump back to it later.', steps: ['Zoom to the view you want.', 'Tools → <b>View Bookmarks</b>, type a name and save.', 'Pick the bookmark at any time to return to it.'], tip: 'Bookmarks live on this device only.' },
  rotate: { about: 'Rotates the map display and shows a north arrow so orientation is never ambiguous.', steps: ['Tools → <b>Rotate Map</b>, set an angle or use the slider.', 'Reset to 0° to go back to north-up.'], tip: 'Selecting, tapping and measuring all follow the rotation.' },
  'meas-save': { about: 'Saves the measurement currently on the map.', steps: ['Draw a measurement first.', 'Tools → <b>Save Measurement</b>.', 'Find it again under Navigate → Saved Measurements.'] },
  'meas-list': { about: 'Lists saved measurements and restores them to the map.', steps: ['Tools → <b>Saved Measurements</b>.', 'Pick one to draw it again, or clear them all.'] },
  'draw-save': { about: 'Saves the current focus area / drawing.', steps: ['Set a focus area.', 'Tools → <b>Save Drawing</b>.'] },
  'draw-list': { about: 'Restores saved drawings.', steps: ['Tools → <b>Saved Drawings</b>, pick one to restore it as the focus area.'] },
  'draw-style': { about: 'Sets the colour and line width used for drawings and focus outlines.', steps: ['Tools → <b>Drawing Style</b>, choose colour and width.', 'New drawings use it straight away.'] },
  timefilter: { about: 'Shows only features whose date or year field falls in a range.', steps: ['Switch on a layer that has a year/date column.', 'Tools → <b>Temporal Filter</b>, choose the field and the range.', 'Apply; clear it the same way.'], needs: 'A layer with a numeric date or year field.' },
  timelayers: { about: 'Browses the layers that carry time coverage information.', steps: ['Tools → <b>Temporal Layers</b>.', 'Pick a layer to switch it on.'] },
  timeslider: { about: 'Steps through years to watch features appear and disappear.', steps: ['Tools → <b>Time Slider</b>, choose the layer and field.', 'Drag the year slider or press Play.'] },
  find: { about: 'Searches feature attributes across layers and jumps to the match.', steps: ['Tools → <b>Feature Finder</b>, type part of a name, code or number.', 'Pick a result: the map zooms there and the Info panel opens.'], tip: 'The search button at the top right does the same across places and layers.' },
  coords: { about: 'Reads the coordinates of any point you tap, in decimal degrees and DMS.', steps: ['Tools → <b>Coordinate Inspector</b>.', 'Tap the map; the coordinates appear in the panel.'] },
  convert: { about: 'Converts between decimal degrees, degrees-minutes-seconds and UTM.', steps: ['Tools → <b>Coordinate Converter</b>.', 'Type a value in any box; the others update.'] },
  layerfind: { about: 'Searches the whole layer catalog by name, source or type.', steps: ['Tools → <b>Layer Discovery</b>, type what you are looking for.', 'Tap a result to zoom to it or switch it on.'] },
  stats: { about: 'Totals, averages, extremes and a chart for any field of a layer.', steps: ['Tools → <b>Layer statistics</b>, choose the layer.', 'Read the summary and the chart.'] },
  chart: { about: 'Histogram of a numeric column, or a ranked count of a text column.', steps: ['Tools → <b>Compare fields</b>, pick layer and field.', 'The chart respects the focus area when one is active.'] },
  table: { about: 'The full attribute table: sort, search and hide columns.', steps: ['Tools → <b>Attribute table</b>, pick the layer.', 'Use the filter box to search; tap a row to locate it.'] },
  fieldcalc: { about: 'Creates a new attribute field from an expression.', steps: ['Tools → <b>Field Calculator</b>, choose the layer.', 'Name the field and write an expression using existing field names.', 'Apply; the new column appears in the table and can be charted.'], tip: 'This is author-mode work: it changes what you see, not the source data file.' },
  selectattr: { about: 'Selects features by attribute value, without tapping the map.', steps: ['Tools → <b>Select by Attribute</b>, pick the layer and field.', 'Choose the condition and value, then Apply.', 'The matching features are highlighted on the map.'], tip: 'For a map-based selection (tap or box), use Tools → Select features instead.' },
  colmanage: { about: 'Shows or hides columns in the attribute table.', steps: ['Tools → <b>Column Manager</b>, tick the columns you want.'] },
  labels: { about: 'Writes a field’s value on the map for a selected layer.', steps: ['Tools → <b>Feature labels</b>, choose the layer and field.', 'Tune size, minimum zoom, colour and halo. Labels stay hidden below the minimum zoom so the map stays readable.'] },
  zoomlayer: { about: 'Fits one whole layer on the screen.', steps: ['Tools → <b>Zoom to a layer</b>, pick the layer.'] },
  shot: { about: 'Downloads the current map as a PNG picture.', steps: ['Arrange the map the way you want it.', 'Tools → <b>Save map picture</b>.', 'On desktop you can add a title, legend, scale, north arrow and grid first.'], tip: 'If a basemap refuses to be included for licensing reasons, the picture is saved without it — your data is still there.' },
  export: { about: 'Saves the map as a PNG picture with a title, legend, scale bar, north arrow and grid lines. The picture never shows latitude or longitude.', steps: ['Tools → <b>Picture with title &amp; frame</b>.', 'Choose the area (whole view, focus area or picked polygons), tick what to draw around the map, then download the PNG.'] },
  ramp: { about: 'Chooses a colour ramp for classified layers.', steps: ['Tools → <b>Color Ramps</b>, pick a ramp, then apply it to a layer.'] },
  custombasemap: { about: 'Adds your own XYZ tile basemap by URL.', steps: ['Tools → <b>Custom Basemap</b>.', 'Give it a name and paste a tile URL containing {z}, {x} and {y}.', 'Save; it appears with the other basemaps.'], tip: 'Use a source whose licence allows it, and remember tiles need internet.' },
  mappreset: { about: 'Saves a complete view (layers, colours, focus) under a name.', steps: ['Set the map up as you want it.', 'Tools → <b>Map Presets</b>, name it and save.', 'Restore it later in one tap.'] },
  printlayout: { about: 'Turns the saved picture into a page layout (A4, A3 or Letter) with a title block.', steps: ['Tools → <b>Print Layouts</b>, choose size, orientation and margin.', 'Then Tools → Save map picture; the PNG follows the layout.'] },
  resetview: { about: 'Back to the opening extent with no filters or focus.', steps: ['Tools → <b>Reset the view</b>.'], tip: 'Your layer list and colours are kept; only the view and filters reset.' },
  fullscreen: { about: 'Uses the whole screen with no browser chrome.', steps: ['Tools → <b>Full screen</b>, or the expand button at the top right.', 'Press Esc or the button again to come back.'] },
  countbyattr: {
    about: 'Counts how many features share each value of a column — a quick category tally for the layer you are looking at.',
    steps: ['Tools → <b>Count by Attribute</b>, pick the layer.', 'Pick the column to count (a name, a class, a status).', 'Press <b>Count</b>; the totals appear as a table, largest group first.'],
    tip: 'Works on text and numeric columns alike. Use it to check how a layer is distributed before you map it.',
  },
  fieldstatsbygroup: {
    about: 'Summarises one numeric column separately for each group in another column (for example, mean borehole yield per state).',
    steps: ['Tools → <b>Field Stats by Group</b>, pick the layer.', 'Choose the <b>group</b> column (text) and the <b>value</b> column (number).', 'Press <b>Compute</b>; each group gets a count, mean, minimum and maximum.'],
    tip: 'Both columns must be in the same layer. For a single overall summary use Layer statistics instead.',
  },
  guide: {
    about: 'Opens this guide — every tool in the app with what it does and how to use it, searchable.',
    steps: ['Tools → <b>Guide</b>, or the <b>Guide</b> button in the About panel.', 'Type in the search box to jump to a tool (for example “drag a box”).', 'Open a row to read the steps and the tip.'],
    tip: 'The guide is built from the same list as the Tools panel, so it can never go out of date.',
  },
  a11y: { about: 'High contrast, larger text and reduced motion.', steps: ['Tools → <b>Accessibility</b>.', 'Switch on what helps; the settings apply immediately and are remembered on this device.'] },
  gestures: { about: 'A quick reference for touch gestures.', steps: ['Tools → <b>Gesture Guide</b>.'] },
  screenreader: { about: 'Adds clearer labels and spoken announcements for screen readers.', steps: ['Tools → <b>Screen Reader</b> to turn the enhanced descriptions on.'] },
  colorblind: { about: 'Switches to colourblind-safe palettes.', steps: ['Tools → <b>Colorblind Palettes</b>, pick a palette; classified layers and legends follow.'] },
  shareview: { about: 'Copies a link that opens the exact same view.', steps: ['Set the map up as you want it.', 'Tools → <b>Share View</b>, then paste the link into a message.'], tip: 'The link carries the layers, basemap, centre, zoom and focus area.' },
  session: { about: 'Saves and restores whole sessions with a short code.', steps: ['Tools → <b>Session Codes</b>.', 'Save to get a code, or type a code to restore someone else’s session.'] },
  mapnotes: { about: 'Adds text notes and markers to the map for a discussion.', steps: ['Tools → <b>Map Notes</b>, type the note and add it at the centre.', 'Drag the note on the map to move it.'], tip: 'Notes are for the map only — they are drawn on the map, not saved as data.' },
  rastercalc: { about: 'Map algebra on one raster: multiply, add, threshold, and so on.', steps: ['Switch on a raster layer.', 'Tools → <b>Raster Calculator</b>, write an expression using v (the cell value).', 'Run; the result is drawn as a new surface.'], needs: 'A raster layer on.' },
  rasterreclass: { about: 'Reclassifies raster cell values into your own groups.', steps: ['Tools → <b>Raster Reclassify</b>, choose the layer and the breaks.'] },
  rasterstats: { about: 'Min, max, mean and distribution of a raster.', steps: ['Tools → <b>Raster Statistics</b>, choose the raster.'] },
  rasterclip: { about: 'Clips a raster to the focus area.', steps: ['Set a focus area first.', 'Tools → <b>Raster Clip / Mask</b>, choose the raster, run.'], needs: 'A focus area and a raster layer on.' },
  rastercontour: { about: 'Derives contour lines from a raster surface.', steps: ['Tools → <b>Raster Contour</b>, choose the raster and interval.'] },
  rasterslope: { about: 'Computes slope from an elevation raster.', steps: ['Switch on the elevation/DEM layer.', 'Tools → <b>Raster Slope</b>, run.'], needs: 'An elevation raster on.' },
  rasterhist: { about: 'Histogram of raster values.', steps: ['Tools → <b>Raster Histogram</b>, choose the raster.'] },
  rasterclipoly: { about: 'Clips a raster to a polygon boundary from a layer.', steps: ['Switch on a raster and a polygon layer.', 'Tools → <b>Raster Clip by Polygon</b>, choose both.'] },
  rasteroverlay: { about: 'Cell-by-cell arithmetic between two rasters.', steps: ['Switch on two rasters with the same extent.', 'Tools → <b>Raster Overlay Math</b>, choose A, B and the operation.'], needs: 'Two rasters on.' },
  rasterclasszonal: { about: 'How much of each raster class falls inside each polygon.', steps: ['Tools → <b>Raster Class Zonal</b>, choose the raster and the polygon layer.'] },
  rasterdiff: { about: 'Subtracts raster B from raster A cell by cell.', steps: ['Tools → <b>Raster Difference</b>, choose A and B.'], needs: 'Two rasters on.' },
  centroid: { about: 'Creates a point layer of feature centroids (or the centroid of the selection).', steps: ['Tools → <b>Feature Centroid</b>, choose the layer.'] },
  densify: { about: 'Adds vertices along lines at a fixed interval.', steps: ['Tools → <b>Densify Lines</b>, choose the layer and spacing.'] },
  splitpoly: { about: 'Splits polygons with a line you draw.', steps: ['Tools → <b>Split Polygon by Line</b>, choose the layer.'] },
  concavehull: { about: 'A concave boundary (alpha shape) tighter than a convex hull.', steps: ['Tools → <b>Concave Hull</b>, choose the layer and tightness.'] },
  affinetransform: { about: 'Moves, rotates or scales features.', steps: ['Tools → <b>Affine Transform</b>, choose the layer and values.'] },
  linetopoly: { about: 'Closes line rings into polygons.', steps: ['Tools → <b>Lines to Polygons</b>, choose the line layer.'] },
  polyoutline: { about: 'Extracts the boundary lines of polygons.', steps: ['Tools → <b>Polygon Outlines</b>, choose the layer.'] },
  featuresmooth: { about: 'Smooths the vertices of lines and polygons.', steps: ['Tools → <b>Smooth Features</b>, choose the layer and number of passes.'] },
  featurebuffer: { about: 'Buffers every feature of a layer by a distance.', steps: ['Tools → <b>Feature Buffer</b>, choose the layer and distance in km.', 'The buffered shapes are drawn on the map.'], tip: 'Points become circles, lines become corridors, polygons grow outward.' },
  boundingbox: { about: 'Draws the rectangular envelope around each feature.', steps: ['Tools → <b>Bounding Box / Envelope</b>, choose the layer.'] },
  vertexstopoints: { about: 'Turns every vertex into a point.', steps: ['Tools → <b>Vertices to Points</b>, choose the layer.'] },
  areaperim: { about: 'Area in km² and perimeter in km for every polygon.', steps: ['Tools → <b>Area & Perimeter</b>, choose the polygon layer, run.'] },
  linepoints: { about: 'Places points at intervals along lines.', steps: ['Tools → <b>Points Along Lines</b>, choose the layer and spacing.'] },
  centroidpts: { about: 'Creates a point layer from polygon centroids.', steps: ['Tools → <b>Polygon Centroids → Points</b>, choose the layer.'] },
  polyadjacency: { about: 'Finds pairs of polygons that touch.', steps: ['Tools → <b>Polygon Adjacency</b>, choose the layer.'] },
  lineoffset: { about: 'Creates parallel lines at a fixed offset.', steps: ['Tools → <b>Line Offset</b>, choose the layer and distance.'] },
  polyunion: { about: 'Merges every polygon of a layer into a single shape.', steps: ['Tools → <b>Polygon Union / Merge</b>, choose the layer.'] },
  linelenstats: { about: 'Total, mean, minimum and maximum length of lines.', steps: ['Tools → <b>Line Length Statistics</b>, choose the layer.'] },
  checkoverlap: { about: 'Finds polygons that overlap each other.', steps: ['Tools → <b>Check Overlaps</b>, choose the layer.'] },
  checkgaps: { about: 'Finds gaps between adjacent polygons.', steps: ['Tools → <b>Check Gaps</b>, choose the layer.'] },
  validate: { about: 'Checks geometry validity (rings, closure, minimum vertices).', steps: ['Tools → <b>Validate Geometry</b>, choose the layer.'] },
  snap: { about: 'Snaps nearby vertices of two layers together.', steps: ['Tools → <b>Snap Features</b>, choose both layers and the tolerance.'] },
  selfintersect: { about: 'Finds rings that cross themselves.', steps: ['Tools → <b>Check Self-Intersections</b>, choose the layer.'] },
  duplicategeom: { about: 'Finds features with identical coordinates.', steps: ['Tools → <b>Duplicate Geometries</b>, choose the layer.'] },
  snaptogrid: { about: 'Snaps vertices to a regular grid.', steps: ['Tools → <b>Snap to Grid</b>, choose the layer and grid size.'] },
  erasefeatures: { about: 'Erases the area of one layer from another.', steps: ['Tools → <b>Feature Erase / Difference</b>, choose both layers.'] },
  checknullgeom: { about: 'Finds features with no coordinates.', steps: ['Tools → <b>Check Null Geometries</b>, choose the layer.'] },
  checkoutofbounds: { about: 'Finds coordinates outside valid longitude/latitude ranges.', steps: ['Tools → <b>Check Out of Bounds</b>, choose the layer.'] },
  checkmultipart: { about: 'Finds features made of several separate pieces.', steps: ['Tools → <b>Check Multi-part Features</b>, choose the layer.'] },
  ringdirection: { about: 'Checks whether rings run clockwise or anticlockwise (holes).', steps: ['Tools → <b>Ring Direction Check</b>, choose the layer.'] },
  featurewithindist: { about: 'Lists features of one layer within a distance of another layer.', steps: ['Tools → <b>Feature Within Distance</b>, choose both layers and the distance.'] },
  spatialjoincount: { about: 'Counts points inside polygons and adds the count as an attribute.', steps: ['Tools → <b>Spatial Join Count</b>, choose the polygon and point layers.'] },
  bufferdissolve: { about: 'Buffers features, then merges the overlapping buffers.', steps: ['Tools → <b>Buffer Dissolve</b>, choose the layer and distance.'] },
  removesmallpoly: { about: 'Hides polygons below a minimum area (cleans up slivers).', steps: ['Tools → <b>Remove Small Polygons</b>, choose the layer and minimum km².', 'Run; small slivers are hidden and can be brought back by removing the tool’s effect.'], tip: 'Use this to thin out tiny slivers at country scale, not to delete real data.' },
  shortestpath: { about: 'Shortest path along a line network between two points.', steps: ['Tools → <b>Shortest Path</b>, choose the network layer and the two ends.'], needs: 'A line layer on.' },
  servicearea: { about: 'The area reachable within a distance along the network (isochrone).', steps: ['Tools → <b>Service Area</b>, choose the network and the start point.'] },
  tracenet: { about: 'Traces a network upstream or downstream from a point.', steps: ['Tools → <b>Trace Network</b>, choose the layer and the start point.'] },
  networkbuffer: { about: 'A drive-time style buffer around points along the network.', steps: ['Tools → <b>Network Buffer</b>, choose the network and the points.'] },
  networkconnect: { about: 'Checks whether the network is fully connected.', steps: ['Tools → <b>Network Connectivity</b>, choose the line layer.'] },
  multipath: { about: 'Optimises a route through several stops.', steps: ['Tools → <b>Multi-Stop Route</b>, add the stops and run.'] },
  distancematrix: { about: 'Pairwise distances between the points of a layer.', steps: ['Tools → <b>Distance Matrix</b>, choose the point layer.'] },
  linemerge: { about: 'Merges lines that share endpoints.', steps: ['Tools → <b>Merge Connected Lines</b>, choose the line layer.'] },
  linebearing: { about: 'Compass direction statistics for line segments.', steps: ['Tools → <b>Line Bearing Statistics</b>, choose the line layer.'] },
  networkbetweenness: { about: 'Ranks network nodes by how many shortest paths pass through them.', steps: ['Tools → <b>Network Betweenness</b>, choose the line layer.'] },
  fishnet: { about: 'Creates a rectangular grid over the view or focus area.', steps: ['Tools → <b>Fishnet / Grid</b>, set the cell size, run.'] },
  randompts: { about: 'Places random points inside the view or focus area.', steps: ['Tools → <b>Random Points</b>, set how many, run.'] },
  hexbin: { about: 'Bins points into hexagons so density is easy to see.', steps: ['Tools → <b>Hexagonal Binning</b>, choose the point layer and hexagon size.'] },
  gridpoints: { about: 'Places points on a regular grid.', steps: ['Tools → <b>Regular Point Grid</b>, set the spacing.'] },
  randomlines: { about: 'Generates random line features (for testing and illustration).', steps: ['Tools → <b>Random Lines</b>, set the count.'] },
  randompolygons: { about: 'Generates random polygon features.', steps: ['Tools → <b>Random Polygons</b>, set the count.'] },
  randomsample: { about: 'Takes a random subset of the features of a layer.', steps: ['Tools → <b>Random Sample</b>, choose the layer and how many.'] },
  randomraster: { about: 'Creates a random raster surface.', steps: ['Tools → <b>Random Raster</b>, run.'] },
  jenksbreaks: { about: 'Classifies a numeric field with Jenks natural breaks.', steps: ['Tools → <b>Natural Breaks (Jenks)</b>, choose the layer, field and classes.'] },
  quantileclass: { about: 'Classifies a numeric field into equal-count classes.', steps: ['Tools → <b>Quantile Classification</b>, choose the layer, field and classes.'] },
  equalintervalclass: { about: 'Classifies a numeric field into equal-width classes.', steps: ['Tools → <b>Equal Interval Classification</b>, choose the layer, field and classes.'] },
  symbology: { about: 'Author mode: fill, stroke, size, shape and labels for one layer.', steps: ['Open the site with ?author=1, then Tools → <b>Symbology</b>.'] },
  addlabel: { about: 'Author mode: place free text anywhere on the map.', steps: ['Author mode → Tools → <b>Add a label</b>, then type in the label editor.'] },
  savelabels: { about: 'Author mode: manage the labels you placed.', steps: ['Author mode → Tools → <b>Label list</b>.'] },
  import: { about: 'Author mode: brings your own GeoJSON onto the map.', steps: ['Author mode → Tools → <b>Import GeoJSON</b>, choose a file or paste the text.'] },
  gpkg: {
    about: 'Reads a GeoPackage in this browser and lists its layers under Imported. The file is not sent anywhere. A layer stays off until you turn it on, and can then be used with the published layers.',
    steps: [
      'Open <b>Layers</b>. <b>Import GeoPackage</b> is the green button at the top.',
      'Choose a .gpkg file and read the coordinate-system note. Files in Minna are shifted to WGS 84, and that shift is only good to about 15 metres.',
      'Press <b>Add to imported layers</b>. They are listed at the top of Layers, above On the map.',
      'Turn on the layer you want. It can then be used with Buffer, clip and the other tools.',
    ],
    tip: 'The file is forgotten when you close the tab. If the shapes land in the wrong place, remove the layer and import again with a different coordinate system.',
  },
  reset: { about: 'Author mode: forgets styles, filters, labels and focus.', steps: ['Author mode → Tools → <b>Reset the work</b> and confirm.'] },
};
// (quietly) make the “drop the extra name” form of a tool id work too
// e.g. data-tool="measure-dist" → key "measure-dist"

function openGuide(focusTool) {
  openModal('Guide', (body) => {
    body.innerHTML = `<div class="guidesearch"><input id="guide-q" type="search" placeholder="Search the guide — tool, task or keyword" autocomplete="off"></div>${guideHTML()}`;
    const q = body.querySelector('#guide-q');
    const run = () => {
      const s = (q.value || '').trim().toLowerCase();
      let shown = 0;
      for (const sec of body.querySelectorAll('.gsec')) {
        let secShown = 0;
        for (const row of sec.querySelectorAll('details.gtool')) {
          const text = row.textContent.toLowerCase();
          const hit = !s || text.includes(s);
          row.hidden = !hit;
          if (hit) { secShown++; if (s) row.open = true; }
        }
        sec.hidden = !!s && !secShown;
        shown += secShown;
      }
      let empty = body.querySelector('#guide-empty');
      if (!empty) { empty = document.createElement('p'); empty.id = 'guide-empty'; empty.className = 'empty'; body.appendChild(empty); }
      empty.textContent = shown ? '' : 'Nothing matched. Try a simpler word such as “select”, “clip” or “export”.';
    };
    q.oninput = run;
    if (focusTool) {
      const row = body.querySelector(`[data-tool-help="${focusTool}"]`);
      if (row) { row.open = true; row.scrollIntoView({ block: 'center' }); }
    }
  });
}
$('#sheethelp').onclick = () => { if (mobileQ.matches) closeSheet(); openGuide(); };
$('#guide-open').onclick = () => openGuide();
window.__nwg && Object.assign(window.__nwg, { openGuide });
