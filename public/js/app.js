import { GeoMap, BASEMAPS, BASEMAP_ORDER, convertFeature, prepareFeature, DEFAULT_VECTOR_COLOR, mercX, mercY, unX, unY, featureMetrics, haversineKm, labelAnchor, ringAreaKm2, ringPerimeterKm, pointInFeature, pip2, featureCentroid, convexHullFeature, convexHullPoints, simplifyFeature, simplifyRing, bufferFeature, bufferZone, ringIntersection, intersectPolyPoly, polygonBoolean, featureDistanceKm, featureClosestKm, scrubForExport, exportHasCoordinates, isCoordinateKey, partsBBox, segmentsIntersect, polyOverlapsPoly, ringsBBox, normalizeClip, clipBB, circleToPolygon, circleMercRadiusForMetres, distToRingMerc, haversineMerc, ringSignedArea, lonlatRing, pageFrame, areaCentroidMerc, pointFeature, lineFeature, polygonFeature, featureVertices, featureBBoxRing, densifyFlat, pointsAlongFlat, offsetLineFlat, smoothFlat, affineFlat, splitPolygonByLines, concaveHullPoints, polygonMeasure, lineLengthStats, polygonsTouch, geometryIssues, ringDirectionFaults, featurePartCount, geometrySignature, snapFlatToDegrees, snapFlatToVertices, overlapAreaKm2, enclosedGapParts, ringSelfCrosses, buildLineNetwork, networkNearest, networkPath, networkReach, networkTrace, networkComponents, mergeLineChains, lineBearingSummary, networkBetweenness, groundDegreeStep, fishnetCells, regularGridPoints, hexBinPoints, classIndex, classifyValues } from './engine.js?v=960c580ec4';
import { createLoadScheduler } from './loading.js?v=960c580ec4';
import { qualityPanelHTML, qualityPresentation, metadataGapLabels } from './quality.js?v=960c580ec4';
import { openGeoPackage } from './gpkg.js?v=960c580ec4';
import { CRS_MENU, crsByCode, caveatFor, assumedCaveat, transformGeometry, geometryInWorld, GRID_SYSTEMS, formatDms, lonLatToSystem, parseCoordinateText, systemToLonLat, utmZoneOf, validateLonLat } from './crs.js?v=960c580ec4';

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
let mapNotes = [];            // discussion markers; not a layer and not an export
let activeTab = 'layers', measure = null, userLoc = null, gridOn = false, editing = null, booting = true;
let bufferPick = null, bufferPreview = null, networkPick = null;
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
  // Colorblind tool. Not red against green.
  cb_deuteranopia: ['#f7f7f7', '#d1e5f0', '#92c5de', '#4393c3', '#2166ac'],
  cb_protanopia: ['#f7f7f7', '#fee090', '#fdae61', '#f46d43', '#a50026'],
  cb_tritanopia: ['#f7f7f7', '#d8daeb', '#b2abd2', '#8073ac', '#542788'],
  cb_mono: ['#f7f7f7', '#d9d9d9', '#bdbdbd', '#737373', '#252525'],
};

function toast(msg, ms = 2800, opts) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms); if (!opts?.silent) announce(msg); }
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall through to the selection copy */ }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    el.remove();
    return !!ok;
  } catch { return false; }
}
function hideToast() { const t = $('#toast'); if (!t) return; t.classList.remove('show'); clearTimeout(toast._t); }
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
  restoreA11y();
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
  const sharedGrid = new URLSearchParams(location.search).get('g');
  if (sharedGrid === '1' || sharedGrid === '0') { gridOn = sharedGrid === '1'; map.setGrid(gridOn); }

  installCustomBasemaps();
  buildBasemaps(); renderLayerTools(); buildTools(); buildAbout(); renderQuality(); renderAnnotations();
  $('#layerfilter').addEventListener('input', renderLayerLists);

  const h = parseHash();
  map.setBasemap(h.b && BASEMAPS[h.b] ? h.b : (catalog.basemap in BASEMAPS ? catalog.basemap : 'light'));
  syncBasemapUI(); updateAttrib();
  if (h.c) map.setView(h.c[1], h.c[0], h.c[2]); else home(false);
  if (Number.isFinite(h.r)) map.setRotation(h.r);

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
    if (coordInspect) { stopCoordInspect('cancel'); return; }
    if (finderOn) { stopFeatureFinder(); return; }
    if (discoveryOn) { stopLayerDiscovery(); return; }
    if (bufferPick?.active) { stopBufferPick(); toast('Buffer cancelled'); }
    else if (clipPick) { endClipPick(false); }
    else if (draw) { endDraw(); toast('Focus drawing cancelled'); }
    else if (selState.active) { exitSelectMode(false); toast('Select mode off'); }
  });
  if (saved && saved.clip) restoreFocus(saved.clip);
  const sharedFocus = readSharedFocus();
  if (sharedFocus) restoreFocus(sharedFocus);
  // The share parameters have been applied. Drop them so a later reload follows
  // what the user changes, instead of forcing the original link again.
  if (new URLSearchParams(location.search).has('f') || new URLSearchParams(location.search).has('g')) {
    const u = new URL(location.href);
    u.searchParams.delete('f');
    u.searchParams.delete('g');
    try { history.replaceState(null, '', u.pathname + (u.search ? u.search : '') + u.hash); } catch { }
    saveProject();
  }
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
    if (method === 'quantile') {
      // An interior break must not land on the maximum, or the last class is empty.
      const idx = i === 0 ? 0 : i === n ? v.length - 1 : Math.min(v.length - 2, Math.round((v.length - 1) * i / n));
      out.push(v[Math.max(0, idx)]);
    } else out.push(v[0] + (v[v.length - 1] - v[0]) * i / n);
  }
  out[0] = v[0]; out[n] = v[v.length - 1];
  return out;
}
function classOf(v, breaks) {
  return classIndex(v, breaks);
}
function applyReclass(st, rerender = true) {
  const rc = st.reclass, o = st.obj; if (!o || !o.features) return;
  if (!rc) { for (const f of o.features) { f.fill = f.fill0; if (f.fill0) f.stroke = f.fill0; } if (rerender) map.render(); return; }
  const vals = [];
  for (const f of o.features) { const v = +f.props[rc.field]; if (isFinite(v)) vals.push(v); }
  if (!vals.length) { toast('That field has no numbers to classify'); return; }
  if (!(rc.breaks && rc.breaks.length === rc.n + 1)) rc.breaks = breaksOf(vals, rc.n, rc.method);
  if (rc.breaks.length !== rc.n + 1) rc.n = Math.max(1, rc.breaks.length - 1);
  const ramp = rampStops(rc.ramp, rc.reverse);
  for (const f of o.features) {
    const v = +f.props[rc.field];
    if (!isFinite(v)) { f.fill = f.stroke = '#c9ced2'; continue; }
    const k = classOf(v, rc.breaks, rc.n);
    f.fill = f.stroke = rampColor(ramp, k / Math.max(1, rc.n - 1) + (rc.n === 1 ? 0 : 0.001));
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
  if (screenReaderOn) screenReaderLabels(true);
  if (!opts.quiet) { renderLayerLists(); refreshLegend(); pushHash(); saveProject(); }
}
const isOn = (id) => !!L.get(id)?.on;

// ---------------------------------------------------------------- layer panel
function renderLayerTools() {
  const bmLabel = BASEMAPS[map.basemap]?.label || map.basemap;
  $('#lyrtools').innerHTML = `
    <button data-x="gpkg" title="Import a GeoPackage. The file stays in this browser.">${icon('upload')}Import</button>
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
        rows = `<div class="bar" style="background:linear-gradient(90deg,${(st.ramp || m.ramp || RAMPS.viridis).join(',')})"></div>
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
  const rc = st.reclass, ramp = rampStops(rc.ramp, rc.reverse), b = rc.breaks || [];
  const methodName = rc.method === 'jenks' ? 'natural breaks' : rc.method === 'interval' ? 'equal interval' : rc.method === 'quantile' ? 'quantile' : (rc.method || 'quantile');
  let out = `<div class="lgnote">${esc(rc.field)} · ${esc(methodName)}${rc.reverse ? ' · reversed' : ''} · ${rc.n} classes</div>`;
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
  if (networkPick) {
    const fn = networkPick.onPoint;
    networkPick = null;
    if (map?.cv && !draw && !bufferPick?.active) map.cv.style.cursor = '';
    fn(lo, la, mercX(lo), mercY(la));
    return;
  }
  if (coordInspect) { readInspect(lo, la, x, y); return; }
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
    ['timefilter', 'filter', 'Temporal Filter', 'Keep features whose year matches'],
    ['timelayers', 'layers', 'Temporal Layers', 'Year fields, separate from source time periods'],
    ['timeslider', 'sliders', 'Time Slider', 'Show one year at a time'],
  ],
  search: [
    ['find', 'search', 'Feature Finder', 'Search attributes on the layers that are on'],
    ['coords', 'target', 'Coordinate Inspector', 'Tap the map to read and copy a point'],
    ['convert', 'calc', 'Coordinate Converter', 'Decimal degrees, DMS and a named grid'],
    ['layerfind', 'layers', 'Layer Discovery', 'Search the catalog, then show or zoom'],
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
    ['ramp', 'palette', 'Color Ramps', 'Classify a number, or paint a layer one colour'],
    ['custombasemap', 'layers', 'Custom Basemap', 'Add an XYZ tile URL you are allowed to use'],
    ['mappreset', 'pin', 'Map Presets', 'Save the layers, colours and focus, then restore them'],
    ['printlayout', 'camera', 'Print Layouts', 'A4, A3 or Letter, without stretching the map'],
  ],
  project: [
    ['resetview', 'refresh', 'Reset the view', 'Back to the opening extent and no filters'],
    ['fullscreen', 'expand', 'Full screen', 'Use the whole screen, no browser chrome'],
  ],
  mobile: [
    ['guide', 'help', 'Guide', 'Every tool, step by step'],
    ['a11y', 'eye', 'Accessibility', 'High contrast, text size, reduced motion'],
    ['gestures', 'grip', 'Gesture Guide', 'What drag, pinch and double-tap do'],
    ['screenreader', 'info', 'Screen Reader', 'Live announcements for map changes'],
    ['colorblind', 'palette', 'Colorblind Palettes', 'Paint a layer with a colourblind-safe ramp'],
  ],
  sharing: [
    ['shareview', 'share', 'Share View', 'Copy a link to this centre, layers and focus'],
    ['session', 'code', 'Session Codes', 'Save this map, or paste a code from someone else'],
    ['mapnotes', 'note', 'Map Notes', 'Markers on the map, kept in this browser'],
  ],
  raster: [
    ['rastercalc', 'calc', 'Raster Calculator', 'New surface from a cell expression'],
    ['rasterreclass', 'sliders', 'Raster Reclassify', 'Draw cell values as classes'],
    ['rasterstats', 'chart', 'Raster Statistics', 'Min, max and mean, in the panel'],
    ['rasterclip', 'crop', 'Raster Clip / Mask', 'Keep cells inside the focus area'],
    ['rastercontour', 'query', 'Raster Contour', 'Lines on the raster, at an interval'],
    ['rasterslope', 'target', 'Raster Slope', 'Slope in degrees, as a new surface'],
    ['rasterhist', 'hist', 'Raster Histogram', 'Value bars, in the panel'],
    ['rasterclipoly', 'crop', 'Raster Clip by Polygon', 'Keep cells inside a polygon'],
    ['rasteroverlay', 'calc', 'Raster Overlay Math', 'New surface from two rasters'],
    ['rasterclasszonal', 'chart', 'Raster Class Zonal', 'Class counts inside each polygon'],
    ['rasterdiff', 'calc', 'Raster Difference', 'How many cells are higher or lower'],
  ],
  geometry: [
    ['centroid', 'target', 'Feature Centroid', 'Area centre, drawn as points'],
    ['densify', 'line', 'Densify Lines', 'Vertices every few kilometres'],
    ['splitpoly', 'crop', 'Split Polygon by Line', 'Cut polygons where a line crosses'],
    ['concavehull', 'polygon', 'Concave Hull', 'Outline that can follow a bay'],
    ['affinetransform', 'convert', 'Affine Transform', 'Move in km, rotate, scale'],
    ['linetopoly', 'polygon', 'Lines to Polygons', 'Close lines that can hold area'],
    ['polyoutline', 'line', 'Polygon Outlines', 'Boundary lines, including holes'],
    ['featuresmooth', 'sliders', 'Smooth Features', 'A smoothed copy, source unchanged'],
    ['featurebuffer', 'target', 'Feature Buffer', 'Zone around each feature, in km'],
    ['boundingbox', 'polygon', 'Bounding Box / Envelope', 'A rectangle around each feature'],
    ['vertexstopoints', 'point', 'Vertices to Points', 'One point per vertex'],
    ['areaperim', 'chart', 'Area & Perimeter', 'km² and km, holes subtracted'],
    ['linepoints', 'point', 'Points Along Lines', 'Points every few kilometres'],
    ['centroidpts', 'target', 'Polygon Centroids → Points', 'Area centre of each polygon'],
    ['polyadjacency', 'query', 'Polygon Adjacency', 'Pairs that share a border'],
    ['lineoffset', 'line', 'Line Offset', 'Parallel copy, in kilometres'],
    ['polyunion', 'merge', 'Polygon Union / Merge', 'Merge polygons and remove shared borders'],
    ['linelenstats', 'chart', 'Line Length Statistics', 'Total, mean, min, max, in the panel'],
  ],
  topology: [
    ['checkoverlap', 'query', 'Check Overlaps', 'Pairs whose areas overlap, in the panel'],
    ['checkgaps', 'grid', 'Check Gaps', 'Holes the polygons enclose, not the outside'],
    ['validate', 'check', 'Validate Geometry', 'Rings, closure, crossings, range'],
    ['snap', 'magnet', 'Snap Features', 'Copy snapped to another layer, in metres'],
    ['selfintersect', 'query', 'Check Self-Intersections', 'Rings and lines that cross themselves'],
    ['duplicategeom', 'copy', 'Duplicate Geometries', 'Same coordinates, tolerance in metres'],
    ['snaptogrid', 'grid', 'Snap to Grid', 'Copy rounded to degrees of lon/lat'],
    ['erasefeatures', 'trash', 'Feature Erase / Difference', 'Cut one polygon layer out of another'],
    ['checknullgeom', 'query', 'Check Null Geometries', 'Features with no usable coordinates'],
    ['checkoutofbounds', 'query', 'Check Out of Bounds', 'Longitude or latitude out of range'],
    ['checkmultipart', 'query', 'Check Multi-part Features', 'Several pieces; a hole is not a part'],
    ['ringdirection', 'query', 'Ring Direction Check', 'Outer anticlockwise, hole clockwise'],
    ['featurewithindist', 'target', 'Feature Within Distance', 'Nearest ground distance, in the panel'],
    ['spatialjoincount', 'table', 'Spatial Join Count', 'point_count written on a drawn copy'],
    ['bufferdissolve', 'target', 'Buffer Dissolve', 'Buffer, then merge overlapping zones'],
    ['removesmallpoly', 'trash', 'Remove Small Polygons', 'Draws the polygons at or above the minimum'],
  ],
  network: [
    ['shortestpath', 'ruler', 'Shortest Path', 'Along the lines, not a straight line'],
    ['servicearea', 'target', 'Service Area', 'Lines you can reach, not a circle'],
    ['tracenet', 'query', 'Trace Network', 'Follows the stored direction'],
    ['networkbuffer', 'target', 'Network Buffer', 'Along the lines from each point'],
    ['networkconnect', 'query', 'Network Connectivity', 'Separate pieces, not dead ends'],
    ['multipath', 'ruler', 'Multi-Stop Route', 'Nearest neighbour along the lines'],
    ['distancematrix', 'chart', 'Distance Matrix', 'Straight-line kilometres, in the panel'],
    ['linemerge', 'merge', 'Merge Connected Lines', 'Joins only where two ends meet'],
    ['linebearing', 'compass', 'Line Bearing Statistics', 'Compass bearing, weighted by length'],
    ['networkbetweenness', 'query', 'Network Betweenness', 'Shortest paths through each junction'],
  ],
  generation: [
    ['fishnet', 'grid', 'Fishnet / Grid', 'Kilometre cells over the view'],
    ['randompts', 'point', 'Random Points', 'Inside the view or the focus area'],
    ['hexbin', 'polygon', 'Hexagonal Binning', 'Counts points in each hexagon'],
    ['gridpoints', 'point', 'Regular Point Grid', 'Evenly spaced, in kilometres'],
    ['randomlines', 'line', 'Random Lines', 'Illustration lines, in kilometres'],
    ['randompolygons', 'polygon', 'Random Polygons', 'Simple shapes, in kilometres'],
    ['randomsample', 'point', 'Random Sample', 'A copy, the source unchanged'],
    ['randomraster', 'raster', 'Random Raster', 'A random surface, not a measurement'],
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
      || (t === 'buffer' && bufferPick?.active)
      || (t === 'coords' && !!coordInspect)
      || (t === 'find' && !!finderOn)
      || (t === 'layerfind' && !!discoveryOn)
      || (t === 'fullscreen' && !!(document.fullscreenElement || document.webkitFullscreenElement)));
  }
  const g = $('#lyrtools [data-x="grid"]'); if (g) g.classList.toggle('on', gridOn);
}
const AUTHOR_ONLY = new Set(['symbology', 'addlabel', 'savelabels', 'import', 'reset']);
function runTool(t) {
  if (AUTHOR_ONLY.has(t) && !AUTHOR) return;
  cancelOverlayJob();
  if (t !== 'buffer') stopBufferPick();
  if (t !== 'coords') stopCoordInspect('silent');
  if (t !== 'find') stopFeatureFinder();
  if (t !== 'layerfind') stopLayerDiscovery();
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
    case 'shot': toolShot(); break;
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
  if (x === 'gpkg') toolGpkg();
  else if (x === 'showall') {
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
let modalCleanup = null;
function openModal(title, build, onClose, opts) {
  networkPick = null;
  if (map?.cv && !draw && !bufferPick?.active) map.cv.style.cursor = '';
  stopCoordInspect('silent');
  stopFeatureFinder();
  stopLayerDiscovery();
  if (modalCleanup) { const prev = modalCleanup; modalCleanup = null; prev(); }
  const options = (onClose && typeof onClose === 'object') ? onClose : (opts || {});
  modalCleanup = typeof onClose === 'function' ? onClose : null;
  $('#modal-title').textContent = title;
  const body = $('#modal-body'); body.innerHTML = '';
  const modal = $('#modal');
  modal.classList.toggle('modal-map', !!options.map);
  modal.hidden = false;
  if (mobileQ.matches) closeSheet();
  build(body);
}
function closeModal() {
  networkPick = null;
  if (map?.cv && !draw && !bufferPick?.active) map.cv.style.cursor = '';
  const modal = $('#modal');
  modal.hidden = true;
  modal.classList.remove('modal-map');
  const fn = modalCleanup;
  modalCleanup = null;
  fn?.();
}
$('#modal-close').onclick = closeModal;
function closeAll() {
  closeModal();
  $('#tablemodal').hidden = true;
  $('#search').hidden = true;
  closeLabelEditor();
  stopCoordInspect('silent');
  stopFeatureFinder();
  stopLayerDiscovery();
}

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

function wantsPrintLayout(opts) {
  if (opts.print) return true;
  // Save map picture passes no options. A picture that already names its own
  // frame should not also be forced onto the page.
  if (opts.area || opts.title || opts.showLegend || opts.showScale || opts.showNorth || opts.showGrid) return false;
  return !!readPrintLayout();
}
function fitCanvasText(ctx, text, maxW) {
  const raw = String(text || '');
  if (ctx.measureText(raw).width <= maxW) return raw;
  let s = raw;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}
function niceBarMetres(metres) {
  if (!(metres > 0)) return 0;
  const p = 10 ** Math.floor(Math.log10(metres));
  const f = metres / p;
  return (f >= 5 ? 5 : f >= 2 ? 2 : 1) * p;
}
function printLegendRows() {
  const rows = [];
  for (const id of [...stack].reverse()) {
    const st = L.get(id);
    if (!st?.on || !st.obj || st.meta.kind === 'table' || st.meta.kind === 'image') continue;
    if (st.reclass?.breaks?.length) {
      const ramp = rampStops(st.reclass.ramp, st.reclass.reverse);
      const n = st.reclass.n || 1;
      const shown = Math.min(n, 4);
      for (let i = 0; i < shown; i++) {
        rows.push({
          color: rampColor(ramp, i / Math.max(1, n - 1) + 0.001),
          label: st.meta.label + ' ' + fmtNum(st.reclass.breaks[i]) + '–' + fmtNum(st.reclass.breaks[i + 1]),
        });
      }
      if (n > shown) rows.push({ color: '', label: st.meta.label + ': ' + (n - shown) + ' more classes' });
    } else {
      rows.push({ color: st.sym?.fill || st.meta.style?.color || '#7a7a7a', label: st.meta.label });
    }
    if (rows.length >= 12) break;
  }
  return rows;
}
function composePrintPage(img, layout, extra = {}) {
  const rows = layout.legend ? printLegendRows() : [];
  const frame = pageFrame({ ...layout, legend: rows.length > 0 }, map.W || img.width, map.H || img.height);
  const cv = document.createElement('canvas');
  cv.width = frame.pageW; cv.height = frame.pageH;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, frame.pageW, frame.pageH);
  ctx.strokeStyle = '#dfe4df'; ctx.lineWidth = 1;
  ctx.strokeRect(frame.marginPx, frame.marginPx, frame.pageW - frame.marginPx * 2, frame.pageH - frame.marginPx * 2);
  ctx.drawImage(img, frame.mapX, frame.mapY, frame.mapW, frame.mapH);
  ctx.strokeStyle = '#0b6b45'; ctx.strokeRect(frame.mapX, frame.mapY, frame.mapW, frame.mapH);
  const title = plainText(extra.title || layout.title || catalog?.title || 'Map', 80);
  ctx.fillStyle = '#16201b'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.font = `700 ${Math.max(12, Math.round(frame.titleH * 0.42))}px system-ui,sans-serif`;
  ctx.fillText(fitCanvasText(ctx, title, frame.pageW - frame.marginPx * 2 - (layout.north ? frame.titleH : 8)), frame.marginPx, frame.marginPx + frame.titleH * 0.55);
  if (layout.north) {
    const r = frame.titleH * 0.28;
    const nx = frame.pageW - frame.marginPx - r - 4;
    const ny = frame.marginPx + frame.titleH * 0.55;
    ctx.save();
    ctx.translate(nx, ny);
    ctx.rotate(-((map.rotation || 0) * Math.PI) / 180);
    ctx.fillStyle = '#16201b';
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.38, r * 0.7); ctx.lineTo(0, r * 0.3); ctx.lineTo(-r * 0.38, r * 0.7); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.font = `700 ${Math.max(9, Math.round(r))}px system-ui,sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText('N', nx - r - 3, ny);
    ctx.textAlign = 'left';
  }
  if (rows.length) {
    const lx = frame.pageW - frame.marginPx - frame.legendW + 8;
    let ly = frame.innerY + 14;
    ctx.font = `700 ${Math.max(10, Math.round(frame.footH * 0.32))}px system-ui,sans-serif`;
    ctx.fillStyle = '#16201b';
    ctx.fillText('Legend', lx, ly);
    ly += 16;
    ctx.font = `${Math.max(9, Math.round(frame.footH * 0.28))}px system-ui,sans-serif`;
    for (const row of rows) {
      if (ly > frame.innerY + frame.innerH - 8) break;
      if (row.color) { ctx.fillStyle = row.color; ctx.fillRect(lx, ly - 7, 12, 10); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.strokeRect(lx, ly - 7, 12, 10); }
      ctx.fillStyle = '#16201b';
      ctx.fillText(fitCanvasText(ctx, row.label, frame.legendW - 28), lx + 16, ly);
      ly += 16;
    }
  }
  const footY = frame.pageH - frame.marginPx - frame.footH * 0.45;
  ctx.font = `${Math.max(9, Math.round(frame.footH * 0.28))}px system-ui,sans-serif`;
  ctx.fillStyle = '#3d4a44';
  if (layout.scale) {
    const [lon1, lat1] = map.lonlatAt(0, map.H / 2);
    const [lon2, lat2] = map.lonlatAt(map.W, map.H / 2);
    const ground = haversineKm([lon1, lat1], [lon2, lat2]) * 1000;
    const barM = niceBarMetres(ground * 0.28);
    if (barM > 0 && ground > 0) {
      const barW = Math.min(Math.round(frame.pageW * 0.18), Math.max(24, Math.round(frame.mapW * (barM / ground))));
      const bx = frame.marginPx;
      const by = footY - 3;
      ctx.strokeStyle = '#16201b'; ctx.strokeRect(bx, by, barW, 6);
      ctx.fillStyle = '#16201b'; ctx.fillRect(bx, by, barW / 2, 6);
      ctx.fillStyle = '#3d4a44'; ctx.textAlign = 'left';
      const label = (barM >= 1000 ? (barM / 1000) + ' km' : barM + ' m') + (map.rotation ? ' north-up' : '');
      ctx.fillText(label, bx + barW + 6, footY);
    }
  }
  const attr = [BASEMAPS[map.basemap]?.attr, extra.note].filter(Boolean).join(' ');
  const date = new Date().toISOString().slice(0, 10);
  ctx.textAlign = 'right';
  ctx.fillText(fitCanvasText(ctx, [date, attr].filter(Boolean).join(' · '), frame.pageW * 0.42), frame.pageW - frame.marginPx, footY);
  ctx.textAlign = 'left';
  downloadCanvasPng(cv, 'map-' + layout.size + '-' + layout.orient + '.png');
}
function downloadCanvasPng(cv, name) {
  cv.toBlob((blob) => {
    if (!blob) { toast('Could not create the picture'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Map picture saved', 5000);
  }, 'image/png');
}

// ------------------------------------------------ tool: screenshot
async function exportMapImage(opts = {}) {
  closeLabelEditor();
  $('#labelpanel').hidden = true;
  const {
    area = 'screen',      // 'screen' | 'clip' | 'drawn' | 'feature'
    title = '', showLegend = false, showScale = false, showNorth = false, showGrid = false,
  } = opts;

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  // Remember current state
  const prevCenter = map.center(), prevZoom = map.zoom, prevClip = map.clip, prevBasemap = map.basemap;
  const prevGrid = map.grid.on;
  const prevSuppress = map._suppressGridLabels;

  // Apply export area. A picked feature is fitted, not invented.
  if (area === 'clip' && map.clip) {
    const bb = map.clipBounds();
    if (bb) map.fitBounds(bb, 60);
  } else if (area === 'feature') {
    const picked = selItems().map((item) => item.f).filter((f) => f?.bb);
    if (picked.length) {
      const bb = picked.reduce((acc, f) => [Math.min(acc[0], f.bb[0]), Math.min(acc[1], f.bb[1]), Math.max(acc[2], f.bb[2]), Math.max(acc[3], f.bb[3])], [1e9, 1e9, -1e9, -1e9]);
      map.fitBounds([unX(bb[0]), unY(bb[3]), unX(bb[2]), unY(bb[1])], 40);
    }
  }
  map._suppressGridLabels = true;
  if (showGrid) map.setGrid(true);
  map._draw();

  let src = null, note = '';
  try { src = map.cv.toDataURL('image/png'); }
  catch (e) {
    const prev = map.basemap; map.basemap = 'none'; map._draw();
    try { src = map.cv.toDataURL('image/png'); note = ' (basemap tiles are protected — no basemap)'; } catch (e2) { src = null; }
    map.basemap = prev; map._draw();
  }
  const restoreExportView = () => {
    map._suppressGridLabels = prevSuppress;
    map.setGrid(prevGrid);
    map.setView(prevCenter[0], prevCenter[1], prevZoom);
    map.setClip(prevClip);
    map.setBasemap(prevBasemap);
    map._draw();
  };
  if (!src) { restoreExportView(); toast('Could not create the picture on this device'); return; }

  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });

  if (wantsPrintLayout(opts)) {
    const layout = opts.layout || readPrintLayout();
    if (layout) {
      try { composePrintPage(img, layout, { title: title || layout.title, note }); }
      catch (e) { console.error(e); toast('That page could not be made'); }
      restoreExportView();
      return;
    }
  }

  const d = map.dpr;

  // Composer canvas: map image + space for cartographic elements
  const topBarH = (title || showLegend || showNorth || showGrid) ? Math.round(90 * d) : 0;
  const bottomBarH = Math.round(70 * d);
  const cvW = img.width;
  const cvH = img.height + topBarH + bottomBarH;
  const cv = document.createElement('canvas');
  cv.width = cvW; cv.height = cvH;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cvW, cvH);

  ctx.drawImage(img, 0, topBarH, img.width, img.height);

  const [lo, la] = prevCenter;
  let cy = topBarH;

  // Title sits in the reserved band above the map, not on top of it.
  if (title && topBarH) {
    ctx.fillStyle = '#16201b'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.font = `700 ${Math.max(16, 20 * d)}px system-ui,sans-serif`;
    ctx.fillText(title, cv.width / 2, topBarH / 2);
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

  // --- Scale bar, measured on the ground across the captured view
  if (showScale) {
    const midY = topBarH + img.height / 2;
    const [lon1, lat1] = map.lonlatAt(0, (midY - topBarH) / d);
    const [lon2, lat2] = map.lonlatAt(img.width / d, (midY - topBarH) / d);
    const ground = haversineKm([lon1, lat1], [lon2, lat2]) * 1000;
    const m = niceBarMetres(ground * 0.22);
    const barW = ground > 0 ? (m / ground) * img.width : 0;
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

  // Grid lines are already on the captured map. Degree numbers are never written.

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

  restoreExportView();
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
        <div class="frow"><label>Ramp</label><select id="r-ramp">${rampNames().map((k) => `<option value="${k}"${cur.ramp === k ? ' selected' : ''}>${esc(rampLabel(k))}</option>`).join('')}</select></div>
        <div class="ramp" id="r-prev">${rampStops(cur.ramp).map((c) => `<i style="background:${c}"></i>`).join('')}</div>
        <div id="r-legend" style="margin-top:10px"></div>
        <div class="frow act"><button class="btn" id="r-clear">Remove classes</button><button class="btn primary" id="r-apply">Apply</button></div>`;
      const q = (s) => holder.querySelector(s);
      const preview = () => {
        const field = q('#r-field').value, n = +q('#r-n').value, method = q('#r-method').value, ramp = q('#r-ramp').value;
        q('#r-prev').innerHTML = rampStops(ramp).map((c) => `<i style="background:${c}"></i>`).join('');
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
      const m = st.meta, feats = dataFeatures(st);
      const summary = layerStatSummary(st);
      const unit = summary.metric === 'area' ? 'km²' : 'km';
      let html = `<p class="hint">${DATA_PANEL} Hidden features are not counted.</p><div class="statgrid">
        <div class="statbox"><b>${feats.length.toLocaleString()}</b><small>${m.kind === 'point' ? 'points' : 'features'}</small></div>
        <div class="statbox"><b>${m.fields?.length ?? 0}</b><small>attribute columns</small></div>`;
      if (summary.metric) {
        html += `<div class="statbox"><b>${fmtNum(summary.total)}</b><small>total ${summary.metric} (${unit})</small></div>
          <div class="statbox"><b>${fmtNum(summary.total / Math.max(1, summary.n))}</b><small>average ${summary.metric} (${unit})</small></div>
          <div class="statbox"><b>${fmtNum(summary.largest)}</b><small>largest (${unit})</small></div>
          <div class="statbox"><b>${fmtNum(summary.smallest)}</b><small>smallest (${unit})</small></div>`;
      }
      html += '</div>';
      const statRows = summary.rows.slice();
      if (summary.ranked.length) {
        html += `<h4>Biggest features</h4><table class="mini"><tr><th>#</th><th>Feature</th><th>${summary.metric} (${unit})</th></tr>` +
          summary.ranked.slice(0, 8).map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${fmtNum(r.value)}</td></tr>`).join('') + '</table>';
      }
      const chart = fieldChart(st);
      if (chart.bars.length) {
        const max = Math.max(1, ...chart.bars.map((b) => b[1]));
        html += `<h4>${esc(chart.label)}</h4><div class="chart">` + chart.bars.map(([l, n]) => `<div class="brow"><span title="${esc(String(l))}">${esc(String(l).slice(0, 28))}</span><span class="barwrap"><i style="width:${Math.max(1, 100 * n / max)}%"></i></span><b>${fmtNum(n)}</b></div>`).join('') + '</div>';
      }
      if (summary.columns.length) {
        html += '<h4>Numeric columns</h4><table class="mini"><tr><th>Field</th><th>Min</th><th>Mean</th><th>Max</th></tr>' +
          summary.columns.map((c) => `<tr><td>${esc(c.label)}</td><td>${fmtNum(c.min)}</td><td>${fmtNum(c.mean)}</td><td>${fmtNum(c.max)}</td></tr>`).join('') + '</table>';
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
        const chart = fieldChart(st, field);
        const bars = chart.bars;
        const numeric = chart.numeric;
        const max = Math.max(1, ...bars.map((b) => b[1]));
        const total = chart.count;
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

// ---- shared overlay tools -------------------------------------------------------
// Intersect, union, dissolve and difference share one result panel and one
// geometry path. A later tool cancels a run that is still going.
let overlayJob = 0;
function cancelOverlayJob() { overlayJob += 1; hideToast(); }
function beginOverlayJob() { overlayJob += 1; return overlayJob; }
function overlayAlive(job) { return job === overlayJob; }
const OVERLAY_COLORS = { intersect: '#a83232', union: '#1a7f4b', difference: '#b45309', dissolve: '#7a4b00', buffer: '#0b6b45' };

function layersOn(kinds) {
  const out = [];
  for (const id of stack) {
    const st = L.get(id);
    if (st?.obj?.features && kinds.includes(st.meta.kind)) out.push([id, st]);
  }
  return out;
}
function layerOptions(layers, selectedIndex) {
  return layers.map(([id, st], i) => `<option value="${esc(id)}"${i === selectedIndex ? ' selected' : ''}>${esc(st.meta.label)}</option>`).join('');
}
function overlayNeed(message) {
  return `<p class="empty">${message}</p><p class="hint">Switch the layers on in Layers, then open this tool again. A selection or a clip, if you have one, is what gets used.</p>`;
}
function overlayNote() {
  return '<p class="hint">Only layers that are switched on are listed. Selected features, and a clip if one is set, narrow the run.</p>';
}
function bindDistinctLayers(aSel, bSel, button) {
  const sync = () => { button.disabled = !aSel.value || aSel.value === bSel.value; };
  aSel.addEventListener('change', sync);
  bSel.addEventListener('change', sync);
  sync();
}
function preferredField(st) {
  const fields = st?.meta?.fields || [];
  const prefer = ['name', 'label', 'zone', 'status', 'type', 'class'];
  for (const name of prefer) {
    const hit = fields.find((f) => f.name === name);
    if (hit) return hit.name;
  }
  const text = fields.find((f) => f.type !== 'number');
  return (text || fields[0])?.name || '';
}
function fillFieldSelect(select, st) {
  const fields = st?.meta?.fields || [];
  const chosen = preferredField(st);
  select.innerHTML = fields.map((f) => `<option value="${esc(f.name)}"${f.name === chosen ? ' selected' : ''}>${esc(f.label || f.name)}</option>`).join('');
  return fields.length > 0;
}
function boxesOverlap(a, b) {
  return !!(a && b) && !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}
function statBoxes(pairs) {
  return '<div class="statgrid">' + pairs.map(([n, s]) => `<div class="statbox"><b>${esc(String(n))}</b><small>${esc(s)}</small></div>`).join('') + '</div>';
}
function resultTable(headers, records, cells, emptyText) {
  if (!records.length) return `<p>${emptyText || 'Nothing to list.'}</p>`;
  const head = '<tr>' + headers.map((h) => `<th>${esc(h)}</th>`).join('') + '</tr>';
  const body = records.slice(0, 25).map((row) => '<tr>' + cells(row).map((c) => `<td>${esc(c)}</td>`).join('') + '</tr>').join('');
  const more = records.length > 25 ? `<p class="hint">Showing 25 of ${fmtNum(records.length)}. Export the full list below.</p>` : '';
  return `<table class="mini">${head}${body}</table>${more}`;
}
function fitDrawn(features) {
  const withBox = features.filter((f) => f?.bb);
  if (!withBox.length) return;
  const bb = withBox.reduce((acc, r) => [Math.min(acc[0], r.bb[0]), Math.min(acc[1], r.bb[1]), Math.max(acc[2], r.bb[2]), Math.max(acc[3], r.bb[3])], [1e9, 1e9, -1e9, -1e9]);
  map.fitBounds(mercBoundsToLonLat(bb), 40);
}
function showOverlay(job, spec) {
  if (!overlayAlive(job)) return;
  hideToast();
  if (spec.features.length) addAnalysisLayer(spec.features, 'polygon', spec.layerLabel, spec.color);
  else clearAnalysisLayers();
  const html = `<p class="hint">${spec.hint}</p>${statBoxes(spec.stats)}${resultTable(spec.headers, spec.records, spec.cells, spec.emptyTable)}`;
  analysisResultModal(spec.title, html, spec.records.slice(0, 500), spec.extra);
  if (spec.features.length) fitDrawn(spec.features);
  else toast(spec.emptyToast || 'Nothing to draw');
}
async function yieldOverlay(job, label) {
  await working(label);
  return overlayAlive(job);
}
async function runOverlay(fn) {
  try { await fn(); }
  catch (e) { console.error(e); toast('That overlay could not be finished'); }
}
// Chunked geometric union. Returns polygon parts, or null if a newer tool took over.
async function unionParts(features, job, label) {
  const CHUNK = 8;
  const polys = (features || []).filter((f) => f && f.type === 'poly' && f.parts?.length);
  let acc = [];
  for (let i = 0; i < polys.length; i += CHUNK) {
    if (!(await yieldOverlay(job, `${label} · ${Math.min(i + CHUNK, polys.length)} of ${polys.length}`))) return null;
    const batch = polygonBoolean(polys.slice(i, i + CHUNK), 'union');
    if (!acc.length) { acc = batch; continue; }
    if (!batch.length) continue;
    const left = featureFromParts(acc, {}, {});
    const right = featureFromParts(batch, {}, {});
    acc = polygonBoolean([left, right].filter(Boolean), 'union');
  }
  return acc;
}
function pieceFromParts(parts, props, color, idx) {
  return featureFromParts(parts, props, { fill: color, stroke: color, idx });
}
const GEOM_DRAWN = 'Drawn on the map. The original layer is unchanged.';
const GEOM_PANEL = 'This stays in the panel. It does not draw a layer.';
const TOPO_PANEL = 'This stays in the panel. It does not draw a layer and does not change the source.';
const DATA_PANEL = 'This stays in the panel. It does not draw a layer and does not change the source file.';
function geomSource(st) {
  return analysisFeatures(st).slice();
}
function geomCopyProps(f) {
  const out = {};
  for (const [k, v] of Object.entries(f?.props || {})) {
    if (!isCoordinateKey(k)) out[k] = v;
  }
  return out;
}
function dataFeatures(st) {
  return (st?.obj?.features || []).filter((f) => f && !f.hidden);
}
function layerStatSummary(st) {
  const feats = dataFeatures(st);
  const metric = st.meta.kind === 'polygon' ? 'area' : st.meta.kind === 'line' ? 'length' : null;
  const measured = metric ? feats.map((f) => ({ name: titleOf(st.obj, f), value: featureMetrics(f)[metric] || 0 })) : [];
  measured.sort((a, b) => b.value - a.value);
  const total = measured.reduce((s, r) => s + r.value, 0);
  const columns = (st.meta.fields || []).filter((f) => f.type === 'number').slice(0, 4).map((f) => {
    const vals = feats.map((x) => +x.props[f.name]).filter((v) => Number.isFinite(v));
    if (!vals.length) return null;
    const sum = vals.reduce((a, b) => a + b, 0);
    return { label: f.label || f.name, min: Math.min(...vals), mean: sum / vals.length, max: Math.max(...vals) };
  }).filter(Boolean);
  const row = { layer: st.meta.label, kind: st.meta.kind, features: feats.length, columns: st.meta.fields?.length ?? 0 };
  if (metric && measured.length) {
    row.metric = metric;
    row.unit = metric === 'area' ? 'km²' : 'km';
    row.total = +total.toFixed(3);
    row.average = +(total / measured.length).toFixed(3);
    row.largest = +measured[0].value.toFixed(3);
    row.smallest = +measured[measured.length - 1].value.toFixed(3);
  }
  const rows = [row, ...measured.slice(0, 8).map((r, i) => ({ rank: i + 1, feature: r.name, [metric]: +r.value.toFixed(3) }))];
  return { metric, total, n: measured.length, largest: measured[0]?.value, smallest: measured[measured.length - 1]?.value, ranked: measured, columns, rows };
}
function fieldChart(st, field) {
  const chosen = field || (st.meta.fields || []).find((f) => f.type === 'number')?.name || (st.meta.fields || [])[0]?.name;
  if (!chosen) return { bars: [], label: '', numeric: false };
  const vals = [];
  for (const f of dataFeatures(st)) {
    if (clip && !map.clipOverlapsFeature(f)) continue;
    const v = f.props?.[chosen];
    if (v == null || v === '') continue;
    vals.push(v);
  }
  const numeric = vals.length > 0 && vals.every((v) => Number.isFinite(+v));
  let bars;
  if (numeric) {
    const nums = vals.map(Number).sort((a, b) => a - b);
    const lo = nums[0], hi = nums[nums.length - 1];
    const K = Math.min(12, Math.max(3, Math.round(Math.sqrt(nums.length))));
    const w = (hi - lo) || 1;
    const bins = new Array(K).fill(0);
    for (const v of nums) bins[Math.min(K - 1, Math.floor(((v - lo) / w) * K))]++;
    bars = bins.map((n, k) => [`${fmtNum(lo + (k / K) * w)} – ${fmtNum(lo + ((k + 1) / K) * w)}`, n]);
  } else {
    const tally = new Map();
    for (const v of vals) tally.set(String(v), (tally.get(String(v)) || 0) + 1);
    bars = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }
  const meta = (st.meta.fields || []).find((f) => f.name === chosen);
  return { field: chosen, label: meta?.label || chosen, bars, numeric, count: vals.length };
}
function countByAttribute(st, field) {
  const counts = new Map();
  for (const f of dataFeatures(st)) {
    const raw = f.props?.[field];
    const value = raw == null || raw === '' ? '(blank)' : String(raw);
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const rows = [...counts.entries()]
    .map(([value, count]) => ({ layer: st.meta.label, field, value, count, percent: total ? +(count / total * 100).toFixed(1) : 0 }))
    .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
  return { total, rows };
}
function fieldStatsByGroup(st, groupField, valueField) {
  const groups = new Map();
  for (const f of dataFeatures(st)) {
    const raw = f.props?.[groupField];
    const key = raw == null || raw === '' ? '(blank)' : String(raw);
    const n = Number(f.props?.[valueField]);
    if (!Number.isFinite(n)) continue;
    let bag = groups.get(key);
    if (!bag) groups.set(key, bag = []);
    bag.push(n);
  }
  const rows = [...groups.entries()].map(([group, vals]) => {
    const sum = vals.reduce((a, b) => a + b, 0);
    return {
      layer: st.meta.label, group, value_field: valueField,
      count: vals.length, mean: +(sum / vals.length).toFixed(3),
      min: +Math.min(...vals).toFixed(3), max: +Math.max(...vals).toFixed(3),
    };
  }).sort((a, b) => b.count - a.count || String(a.group).localeCompare(String(b.group)));
  return { rows };
}
function topoPanel(out, title, html, rows, extra) {
  if (!out?.isConnected) return;
  hideToast();
  if (out.id === 'nc-out' || out.id === 'lb-out' || out.id === 'dm-out' || out.id === 'nbe-out') clearAnalysisLayers();
  out.innerHTML = `<div data-topo-result="panel">${html}<p class="hint">${TOPO_PANEL}</p></div>` + (rows ? resultExportBar(title) : '');
  if (rows) wireResultExports(out, title, rows, extra);
}
function topoName(st, f, i) {
  const name = titleOf(st?.obj || st?.meta || {}, f);
  return name && name !== 'Feature' ? name : 'Feature ' + (i + 1);
}
function topoCopyFeature(f, props, style, idx) {
  if (!f) return null;
  if (f.type === 'point') {
    const out = [];
    for (let i = 0; i < (f.parts?.length || 0); i += 2) {
      const p = pointFeature(f.parts[i], f.parts[i + 1], props, { ...style, idx });
      if (p) out.push(p);
    }
    if (out.length === 1) return out[0];
    if (!out.length) return null;
    return { type: 'point', parts: Float64Array.from(f.parts), bb: f.bb, props, fill: style?.fill, stroke: style?.stroke || style?.fill, idx };
  }
  if (f.type === 'line') return lineFeature(f.parts, props, { ...style, idx });
  if (f.type === 'poly') return polygonFeature(f.parts, props, { ...style, idx });
  return null;
}
function topoSnapCopy(f, nextParts, props, style, idx) {
  if (f.type === 'point') {
    const pts = [];
    for (let i = 0; i < nextParts.length; i += 2) {
      const p = pointFeature(nextParts[i], nextParts[i + 1], props, { ...style, idx });
      if (p) pts.push(p);
    }
    if (!pts.length) return null;
    if (pts.length === 1) return pts[0];
    const flat = Float64Array.from(nextParts);
    return { type: 'point', parts: flat, bb: clipBB([flat]), props, fill: style?.fill, stroke: style?.stroke || style?.fill, idx };
  }
  if (f.type === 'line') return lineFeature(nextParts, props, { ...style, idx });
  if (f.type === 'poly') return polygonFeature(nextParts, props, { ...style, idx });
  return null;
}
function armNetworkPick(label, onPoint) {
  networkPick = { onPoint };
  if (map?.cv) map.cv.style.cursor = 'crosshair';
  toast('Tap the map for the ' + label, 2500);
}
function netSource(st) {
  return geomSource(st).filter((f) => f.type === 'line').map((f, i) => ({ type: 'line', parts: f.parts, name: topoName(st, f, i) }));
}
function showNetLines(spec) {
  const features = [];
  (spec.lines || []).forEach((line, i) => {
    if (!line?.flat || line.flat.length < 4) return;
    const feat = lineFeature([line.flat], { source: line.name || '', length_km: +(+line.km || 0).toFixed(3) }, { stroke: spec.color || '#0b6b45', fill: spec.color || '#0b6b45', idx: i });
    if (feat) features.push(feat);
  });
  if (spec.parts) {
    const feat = lineFeature(spec.parts, spec.props || {}, { stroke: spec.color || '#0b6b45', fill: spec.color || '#0b6b45', idx: 0 });
    if (feat) features.push(feat);
  }
  showGeom({
    title: spec.title,
    kind: 'line',
    layerLabel: spec.layerLabel || spec.title,
    color: spec.color || '#0b6b45',
    features,
    hint: spec.hint,
    stats: spec.stats || [],
    records: spec.records || [],
    table: spec.table || '',
    extra: spec.extra,
    emptyToast: spec.emptyToast,
    keepOpen: true,
  });
}
function netJoinFields(prefix) {
  return `<div class="frow"><label>Join vertices within (m)</label><input id="${prefix}-join" type="number" min="0" step="1" value="25"></div>
    <div class="frow"><label>A tap must be within (km)</label><input id="${prefix}-snap" type="number" min="0" step="0.1" value="2"></div>`;
}
function showGeom(spec) {
  hideToast();
  const features = (spec.features || []).filter(Boolean);
  if (features.length) addAnalysisLayer(features, spec.kind, spec.layerLabel, spec.color || '#0b6b45');
  else clearAnalysisLayers();
  const html = `<p class="hint">${spec.hint}</p>${statBoxes(spec.stats || [])}${spec.table || ''}`;
  const modal = $('#modal');
  const body = $('#modal-body');
  if (spec.keepOpen && modal && !modal.hidden && body) {
    modal.classList.add('modal-map');
    let out = body.querySelector('[data-net-result]');
    if (!out) {
      out = document.createElement('div');
      out.dataset.netResult = '1';
      out.style.marginTop = '10px';
      body.appendChild(out);
    }
    out.innerHTML = `<div data-topo-result="panel">${html}</div>` + resultExportBar(spec.title);
    wireResultExports(out, spec.title, (spec.records || []).slice(0, 500), spec.extra);
    out.scrollIntoView({ block: 'nearest' });
  } else {
    analysisResultModal(spec.title, html, (spec.records || []).slice(0, 500), spec.extra);
  }
  if (features.length) fitDrawn(features);
  else if (spec.emptyToast) toast(spec.emptyToast);
  else toast(spec.title + ' ready');
}

function toolIntersect() {
  openModal('Intersect / Overlay', (body) => {
    const layers = layersOn(['polygon']);
    if (layers.length < 2) { body.innerHTML = overlayNeed('Turn on two polygon layers to find where they overlap.'); return; }
    body.innerHTML = '<p>Keeps only the ground that both polygon layers cover.</p>' + overlayNote() +
      `<div class="frow"><label>Layer A</label><select id="ix-a">${layerOptions(layers, 0)}</select></div>` +
      `<div class="frow"><label>Layer B</label><select id="ix-b">${layerOptions(layers, 1)}</select></div>` +
      `<div class="frow act"><button class="btn primary" id="ix-run">${icon('query')} Run intersection</button></div>`;
    bindDistinctLayers(body.querySelector('#ix-a'), body.querySelector('#ix-b'), body.querySelector('#ix-run'));
    body.querySelector('#ix-run').onclick = () => runOverlay(() => runIntersect(body.querySelector('#ix-a').value, body.querySelector('#ix-b').value));
  });
}
async function runIntersect(aId, bId) {
  if (!aId || !bId || aId === bId) { toast('Pick two different layers'); return; }
  const job = beginOverlayJob();
  const aSt = L.get(aId), bSt = L.get(bId);
  if (!aSt || !bSt) return;
  closeModal();
  if (!(await yieldOverlay(job, 'Intersecting ' + aSt.meta.label))) return;
  if (!aSt.obj) await loadLayer(aSt);
  if (!bSt.obj) await loadLayer(bSt);
  if (!overlayAlive(job)) return;
  const featsA = analysisFeatures(aSt), featsB = analysisFeatures(bSt);
  const index = bboxGrid(featsB, (f) => f.bb, 64);
  const drawn = [], records = [];
  let seen = 0;
    for (const fA of featsA) {
    if (fA.type !== 'poly' || !fA.bb) continue;
    if (++seen % 12 === 0 && !(await yieldOverlay(job, 'Intersecting ' + aSt.meta.label))) return;
    for (const fB of index.nearBox(fA.bb)) {
      if (fB.type !== 'poly' || !boxesOverlap(fA.bb, fB.bb)) continue;
      const parts = polygonBoolean([fA, fB], 'intersection');
      if (!parts.length) continue;
      const area = partsAreaKm2(parts);
      if (area < 0.0005) continue;
      const nameA = titleOf(aSt.obj, fA), nameB = titleOf(bSt.obj, fB);
      const piece = pieceFromParts(parts, { layer_a: nameA, layer_b: nameB, overlap_km2: +area.toFixed(3) }, OVERLAY_COLORS.intersect, drawn.length);
      if (!piece) continue;
      drawn.push(piece);
      if (records.length < 500) records.push({ from: nameA, overlaps: nameB, overlap_km2: +area.toFixed(3) });
    }
  }
  if (!overlayAlive(job)) return;
  let covered = records.reduce((s, r) => s + r.overlap_km2, 0);
  if (drawn.length > 1) {
    const united = await unionParts(drawn, job, 'Measuring covered ground');
    if (united == null || !overlayAlive(job)) return;
    if (united.length) covered = partsAreaKm2(united);
  }
  showOverlay(job, {
    title: 'Intersection',
    hint: `Intersection of <b>${esc(aSt.meta.label)}</b> and <b>${esc(bSt.meta.label)}</b>, drawn in red. The covered area counts each piece of ground once. The table lists every pair, so those areas can add up to more.`,
    stats: [[fmtNum(records.length), 'overlapping pairs'], [fmtNum(covered), 'km² covered once']],
    headers: [aSt.meta.label, bSt.meta.label, 'Overlap (km²)'],
    records,
    cells: (r) => [r.from, r.overlaps, fmtNum(r.overlap_km2)],
    extra: { layer_a: aSt.meta.label, layer_b: bSt.meta.label, covered_km2: +covered.toFixed(3) },
    features: drawn,
    color: OVERLAY_COLORS.intersect,
    layerLabel: 'Intersection',
    emptyToast: 'The two layers do not overlap',
    emptyTable: 'The two layers do not overlap.',
  });
}

function toolDissolve() {
  openModal('Dissolve / Merge', (body) => {
    const layers = layersOn(['polygon']);
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a polygon layer to merge features that share a value.'); return; }
    body.innerHTML = '<p>Merges polygons that share a value into one shape per value, and removes the borders they share. Gaps stay open.</p>' + overlayNote() +
      `<div class="frow"><label>Layer</label><select id="ds-layer">${layerOptions(layers, 0)}</select></div>` +
      '<div class="frow"><label>Group by</label><select id="ds-field"></select></div>' +
      `<div class="frow act"><button class="btn primary" id="ds-run">${icon('merge')} Run dissolve</button></div>`;
    const layerSel = body.querySelector('#ds-layer');
    const fieldSel = body.querySelector('#ds-field');
    const button = body.querySelector('#ds-run');
    const sync = () => {
      const ready = fillFieldSelect(fieldSel, L.get(layerSel.value));
      button.disabled = !ready;
      if (!ready) fieldSel.innerHTML = '<option value="">No attribute to group by</option>';
    };
    layerSel.addEventListener('change', sync);
    sync();
    button.onclick = () => runOverlay(() => runDissolve(layerSel.value, fieldSel.value));
  });
}
async function runDissolve(id, field) {
  const st = L.get(id);
  if (!st || !field) { toast('Choose a layer and an attribute'); return; }
  const job = beginOverlayJob();
  closeModal();
  if (!(await yieldOverlay(job, 'Grouping ' + st.meta.label))) return;
  if (!st.obj) await loadLayer(st);
  if (!overlayAlive(job)) return;
  const groups = new Map();
  for (const f of analysisFeatures(st)) {
    if (f.type !== 'poly') continue;
    const key = String(f.props?.[field] ?? '');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  const dissolved = [], records = [];
  let idx = 0;
  for (const [key, feats] of groups) {
    const parts = await unionParts(feats, job, 'Merging ' + (key || '(blank)'));
    if (parts == null || !overlayAlive(job)) return;
    const area = partsAreaKm2(parts);
    const piece = pieceFromParts(parts, { [field]: key, features_merged: feats.length, area_km2: +area.toFixed(3) }, OVERLAY_COLORS.dissolve, idx++);
    if (!piece) continue;
    dissolved.push(piece);
    records.push({ [field]: key, features_merged: feats.length, area_km2: +area.toFixed(3) });
  }
  const total = records.reduce((s, r) => s + r.area_km2, 0);
  showOverlay(job, {
    title: 'Dissolve',
    hint: `Dissolve of <b>${esc(st.meta.label)}</b> by <b>${esc(field)}</b>, drawn in brown. Shared borders are removed. Gaps between features are kept.`,
    stats: [[fmtNum(groups.size), 'groups'], [fmtNum(dissolved.length), 'merged shapes'], [fmtNum(total), 'km² in total']],
    headers: [field, 'Merged', 'Area (km²)'],
    records,
    cells: (r) => [r[field] || '(blank)', fmtNum(r.features_merged), fmtNum(r.area_km2)],
    extra: { layer: st.meta.label, field },
    features: dissolved,
    color: OVERLAY_COLORS.dissolve,
    layerLabel: 'Dissolved: ' + field,
    emptyToast: 'Nothing to merge',
  });
}


// ---- Nearest Neighbor ----
function toolNearest() {
  const vec = layersOn(['polygon', 'line', 'point']);
  openModal('Nearest Neighbor', (body) => {
    if (vec.length < 2) { body.innerHTML = overlayNeed('Turn on two vector layers first.'); return; }
    body.innerHTML = `<p class="hint">Each feature in A is matched to the closest feature in B, measured edge to edge. A point inside a polygon is 0 km, not the distance to its middle. The search keeps widening until a nearer feature is impossible, so a neighbour just outside the first neighbourhood is not missed.</p>
      ${overlayNote()}
      <div class="frow"><label>Layer A — what to match</label><select id="nn-a">${layerOptions(vec)}</select></div>
      <div class="frow"><label>Layer B — what to match against</label><select id="nn-b">${layerOptions(vec, 1)}</select></div>
      <div class="frow"><label>How many matches</label><select id="nn-max"><option value="25">25</option><option value="100" selected>100</option><option value="500">500</option><option value="2000">2,000</option></select></div>
      <div class="frow"><label>Only matches closer than (km)</label><input id="nn-within" type="number" min="0" step="1" placeholder="Any distance"></div>
      <div class="frow"><label class="chk"><input type="checkbox" id="nn-lines" checked> Draw a line for each match</label></div>
      <div class="frow act"><button class="btn primary" id="nn-go">${icon('compass')} Find nearest</button></div>`;
    bindDistinctLayers(body.querySelector('#nn-a'), body.querySelector('#nn-b'), body.querySelector('#nn-go'));
    body.querySelector('#nn-go').onclick = () => {
      const within = body.querySelector('#nn-within').value;
      closeModal();
      runNearest({
        idA: body.querySelector('#nn-a').value,
        idB: body.querySelector('#nn-b').value,
        max: +body.querySelector('#nn-max').value || 100,
        withinKm: within === '' ? null : Math.max(0, +within),
        draw: body.querySelector('#nn-lines').checked,
      });
    };
  });
}
// Nearest B feature. The centroid grid only decides where to look. A candidate
// whose box could still reach closer than the current best is always measured,
// so a neighbour just outside the first neighbourhood is not missed.
function nearestFeature(src, targets, grid) {
  const [x, y] = featureCentroid(src);
  const srcSpan = Math.hypot(src.bb[2] - src.bb[0], src.bb[3] - src.bb[1]);
  let best = null, bestF = null;
  const seen = new Set();
  const measure = (t) => {
    if (seen.has(t)) return;
    seen.add(t);
    const hit = featureClosestKm(src, t);
    if (hit && Number.isFinite(hit.km) && (!best || hit.km < best.km)) { best = hit; bestF = t; }
  };
  for (let ring = 1; ring <= 64; ring++) {
    for (const p of grid.around(x, y, ring)) measure(p.f);
    if (!best) continue;
    // Mercator units a still-unsearched feature would have to beat.
    const bestMerc = best.km * 1000 / MERC_METRES_PER_UNIT;
    const unsearched = Math.max(0, (ring - 1) * grid.cell - srcSpan);
    if (unsearched > bestMerc) break;
  }
  if (!bestF) for (const t of targets) measure(t);
  return bestF ? { feature: bestF, hit: best } : null;
}
async function runNearest(opts) {
  const job = beginOverlayJob();
  await runOverlay(async () => {
    const a = L.get(opts.idA), b = L.get(opts.idB);
    if (!a?.obj || !b?.obj || a === b) { toast('Pick two different layers'); return; }
    const fa = analysisFeatures(a), fb = analysisFeatures(b);
    if (!fa.length || !fb.length) { toast('One of those layers has nothing to match'); return; }
    const asked = fa.slice(0, opts.max);
    const pts = fb.map((f) => { const [x, y] = featureCentroid(f); return { x, y, f }; });
    const cell = Math.max(25 * 1000 / MERC_METRES_PER_UNIT, 1e-9);
    const grid = pointGrid(pts, cell);
    const matches = [];
    let outside = 0;
    for (let i = 0; i < asked.length; i++) {
      if (i % 25 === 0 && !(await yieldOverlay(job, `Matching · ${fmtNum(Math.min(i + 1, asked.length))} of ${fmtNum(asked.length)}`))) return;
      const found = nearestFeature(asked[i], fb, grid);
      if (!found) continue;
      if (opts.withinKm != null && found.hit.km > opts.withinKm) { outside++; continue; }
      matches.push({ src: asked[i], ...found });
    }
    if (!overlayAlive(job)) return;
    matches.sort((p, q) => p.hit.km - q.hit.km);
    const color = '#7c3aed';
    const lines = opts.draw ? matches.map((m, i) => ({
      type: 'line',
      parts: [[m.hit.ax, m.hit.ay, m.hit.bx, m.hit.by]],
      bb: [Math.min(m.hit.ax, m.hit.bx), Math.min(m.hit.ay, m.hit.by), Math.max(m.hit.ax, m.hit.bx), Math.max(m.hit.ay, m.hit.by)],
      fill: color, stroke: color, idx: i,
      props: { from: titleOf(a.obj, m.src), to: titleOf(b.obj, m.feature), distance_km: +m.hit.km.toFixed(3) },
    })) : [];
    const dists = matches.map((m) => m.hit.km);
    const mean = dists.length ? dists.reduce((s, v) => s + v, 0) / dists.length : 0;
    const touching = matches.filter((m) => m.hit.km === 0).length;
    const capped = fa.length > asked.length ? ` The first ${fmtNum(asked.length)} features of A were matched; raise the limit to include more.` : '';
    const records = matches.map((m) => ({
      from: titleOf(a.obj, m.src), to: titleOf(b.obj, m.feature),
      distance_km: +m.hit.km.toFixed(3), touches: m.hit.km === 0 ? 'yes' : 'no',
    }));
    showOverlay(job, {
      title: 'Nearest Neighbor',
      layerLabel: `Nearest · ${a.meta.label}`,
      color, features: lines,
      hint: `${esc(a.meta.label)} matched against ${esc(b.meta.label)}. Distance is to the nearest edge. ${fmtNum(matches.length)} matched${outside ? `, ${fmtNum(outside)} further than ${fmtNum(opts.withinKm)} km` : ''}.${capped}`,
      stats: [
        ['Matched', fmtNum(matches.length)],
        ['Closest', dists.length ? fmtNum(dists[0]) + ' km' : '—'],
        ['Average', dists.length ? fmtNum(mean) + ' km' : '—'],
        ['Already touching', fmtNum(touching)],
      ],
      headers: ['From', 'Nearest', 'km', 'Touches'],
      records,
      cells: (r) => [r.from, r.to, fmtNum(r.distance_km), r.touches],
      extra: { from_layer: a.meta.label, to_layer: b.meta.label, matched: matches.length, average_km: +mean.toFixed(3), beyond_limit: outside },
      emptyTable: 'No feature in A was close enough.',
      emptyToast: 'No matches to draw',
    });
  });
}


// ---- Count Points in Polygons ----
function toolCount() {
  const polys = layersOn(['polygon']), pts = layersOn(['point']);
  openModal('Count Points in Polygons', (body) => {
    if (!polys.length || !pts.length) { body.innerHTML = overlayNeed('Turn on a polygon layer and a point layer.'); return; }
    body.innerHTML = `<p class="hint">Counts how many points fall inside each polygon. A point on a shared border is counted in every polygon that contains it, and the headline says how many were shared so the two totals are not mixed up.</p>
      ${overlayNote()}
      <div class="frow"><label>Polygons</label><select id="cp-poly">${layerOptions(polys)}</select></div>
      <div class="frow"><label>Points</label><select id="cp-pt">${layerOptions(pts)}</select></div>
      <div class="frow"><label>Also total this numeric field</label><select id="cp-field"><option value="">Just the count</option></select></div>
      <div class="frow"><label class="chk"><input type="checkbox" id="cp-zero"> Keep polygons that contain no points</label></div>
      <div class="frow act"><button class="btn primary" id="cp-go">${icon('table')} Count</button></div>`;
    const fieldSel = body.querySelector('#cp-field');
    const fill = () => {
      const st = L.get(body.querySelector('#cp-pt').value);
      const fields = (st?.meta?.fields || []).filter((f) => f.type === 'number');
      const cur = fieldSel.value;
      fieldSel.innerHTML = '<option value="">Just the count</option>' + fields.map((f) => `<option value="${esc(f.name)}">${esc(f.label || f.name)}</option>`).join('');
      if ([...fieldSel.options].some((o) => o.value === cur)) fieldSel.value = cur;
    };
    body.querySelector('#cp-pt').onchange = fill;
    fill();
    body.querySelector('#cp-go').onclick = () => {
      closeModal();
      runCountPoints({
        polyId: body.querySelector('#cp-poly').value,
        pointId: body.querySelector('#cp-pt').value,
        field: fieldSel.value,
        keepZero: body.querySelector('#cp-zero').checked,
      });
    };
  });
}
async function runCountPoints(opts) {
  const job = beginOverlayJob();
  await runOverlay(async () => {
    const polySt = L.get(opts.polyId), ptSt = L.get(opts.pointId);
    const polys = analysisFeatures(polySt).filter((f) => f.type === 'poly');
    const points = analysisFeatures(ptSt).filter((f) => f.type === 'point');
    if (!polys.length || !points.length) { toast('Nothing to count in those layers'); return; }
    const index = bboxGrid(polys, (f) => f.bb, 64);
    const counts = new Map();
    let seen = 0, outside = 0, shared = 0;
    for (let i = 0; i < points.length; i++) {
      if (i % 200 === 0 && !(await yieldOverlay(job, `Counting · ${fmtNum(i)} of ${fmtNum(points.length)}`))) return;
      const pf = points[i];
      const value = opts.field ? +pf.props?.[opts.field] : NaN;
      for (let k = 0; k < pf.parts.length; k += 2) {
        const x = pf.parts[k], y = pf.parts[k + 1];
        seen++;
        let hits = 0;
        for (const poly of index.near(x, y)) {
          if (x < poly.bb[0] || x > poly.bb[2] || y < poly.bb[1] || y > poly.bb[3]) continue;
          if (!pointInFeature(x, y, poly)) continue;
          const slot = counts.get(poly) || { n: 0, sum: 0 };
          slot.n++;
          if (Number.isFinite(value)) slot.sum += value;
          counts.set(poly, slot);
          hits++;
        }
        if (hits > 1) shared++;
        if (!hits) outside++;
      }
    }
    if (!overlayAlive(job)) return;
    const color = '#0f766e';
    const ranked = polys
      .map((f) => ({ f, slot: counts.get(f) || { n: 0, sum: 0 } }))
      .filter((r) => r.slot.n || opts.keepZero)
      .sort((a, b) => b.slot.n - a.slot.n);
    const drawn = ranked.map(({ f, slot }, i) => ({
      ...f, fill: slot.n ? color : '#94a3b8', stroke: slot.n ? color : '#94a3b8', idx: i,
      props: { polygon: titleOf(polySt.obj, f), point_count: slot.n, ...(opts.field ? { [opts.field + '_sum']: +slot.sum.toFixed(2) } : {}) },
    }));
    const inside = [...counts.values()].reduce((s, c) => s + c.n, 0);
    const records = ranked.map(({ f, slot }) => ({
      polygon: titleOf(polySt.obj, f), points: slot.n,
      sum: opts.field ? +slot.sum.toFixed(2) : null,
      share_percent: seen ? +(slot.n / seen * 100).toFixed(2) : 0,
      area_km2: +featureMetrics(f).area.toFixed(2),
    }));
    const fieldLabel = opts.field ? ((ptSt.meta.fields || []).find((f) => f.name === opts.field)?.label || opts.field) : '';
    showOverlay(job, {
      title: 'Count Points in Polygons',
      layerLabel: `Point count · ${polySt.meta.label}`,
      color, features: drawn,
      hint: `${esc(ptSt.meta.label)} inside ${esc(polySt.meta.label)}. ${fmtNum(inside)} point${inside === 1 ? '' : 's'} counted${shared ? `, including ${fmtNum(shared)} on a shared border that were counted in each polygon` : ''}. ${fmtNum(outside)} fell outside every polygon.`,
      stats: [
        ['Points counted', fmtNum(inside)],
        ['Polygons with points', fmtNum([...counts.values()].filter((c) => c.n).length)],
        ['On a shared border', fmtNum(shared)],
        ['Outside every polygon', fmtNum(outside)],
      ],
      headers: opts.field ? ['Polygon', 'Points', fieldLabel + ' sum', 'Share'] : ['Polygon', 'Points', 'Share', 'km²'],
      records,
      cells: (r) => opts.field
        ? [r.polygon, fmtNum(r.points), fmtNum(r.sum), r.share_percent + '%']
        : [r.polygon, fmtNum(r.points), r.share_percent + '%', fmtNum(r.area_km2)],
      extra: { polygons: polySt.meta.label, points: ptSt.meta.label, counted: inside, outside, shared_border: shared },
      emptyTable: 'No polygon contained a point.',
      emptyToast: 'No polygons to draw',
    });
  });
}

// ---- Convex Hull ----
function toolHull() {
  const vec = layersOn(['polygon', 'line', 'point']);
  openModal('Convex Hull', (body) => {
    if (!vec.length) { body.innerHTML = overlayNeed('Turn on a vector layer first.'); return; }
    body.innerHTML = `<p class="hint">The smallest shape with no inward corners that still holds every feature. A line or a polygon is enclosed by its outline, not only its middle. One hull for the layer, or one hull per group.</p>
      ${overlayNote()}
      <div class="frow"><label>Layer</label><select id="hu-layer">${layerOptions(vec)}</select></div>
      <div class="frow"><label>Group by</label><select id="hu-by"><option value="">One hull for the whole layer</option></select></div>
      <div class="frow act"><button class="btn primary" id="hu-go">${icon('polygon')} Draw hull</button></div>`;
    const by = body.querySelector('#hu-by');
    const fill = () => {
      const fields = L.get(body.querySelector('#hu-layer').value)?.meta?.fields || [];
      by.innerHTML = '<option value="">One hull for the whole layer</option>' + fields.filter((f) => f?.name).map((f) => `<option value="${esc(f.name)}">${esc(f.label || f.name)}</option>`).join('');
    };
    body.querySelector('#hu-layer').onchange = fill;
    fill();
    body.querySelector('#hu-go').onclick = () => {
      closeModal();
      runHull({ id: body.querySelector('#hu-layer').value, field: by.value });
    };
  });
}
function hullRing(features) {
  const pts = [];
  for (const f of features) {
    if (f.type === 'point') {
      for (let i = 0; i < f.parts.length; i += 2) pts.push([f.parts[i], f.parts[i + 1]]);
    } else if (f.type === 'line') {
      for (const line of f.parts) for (let i = 0; i < line.length; i += 2) pts.push([line[i], line[i + 1]]);
    } else {
      for (const poly of f.parts || []) for (const ring of poly) for (let i = 0; i < ring.length; i += 2) pts.push([ring[i], ring[i + 1]]);
    }
  }
  const ring = pts.length >= 3 ? convexHullPoints(pts) : null;
  return ring && ring.length >= 6 ? { ring: closeFlat(ring), corners: ring.length / 2 - 1, points: pts.length } : null;
}
async function runHull(opts) {
  const job = beginOverlayJob();
  await runOverlay(async () => {
    const st = L.get(opts.id);
    const feats = analysisFeatures(st);
    if (!feats.length) { toast('That layer has nothing to enclose'); return; }
    if (!(await yieldOverlay(job, 'Drawing the hull…'))) return;
    const groups = new Map();
    for (const f of feats) {
      const key = opts.field ? String(f.props?.[opts.field] ?? '') : '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(f);
    }
    const color = '#b45309';
    const drawn = [], records = [];
    let tooSmall = 0;
    for (const [key, members] of groups) {
      const hull = hullRing(members);
      if (!hull) { tooSmall++; continue; }
      const piece = featureFromParts([[hull.ring]], {
        group: key || 'All features', features: members.length, corners: hull.corners,
      }, { fill: color, stroke: color, idx: drawn.length });
      if (!piece) { tooSmall++; continue; }
      const area = featureMetrics(piece).area, edge = featureMetrics(piece).perim;
      piece.props.area_km2 = +area.toFixed(2);
      piece.props.edge_km = +edge.toFixed(2);
      drawn.push(piece);
      records.push({ group: key || 'All features', features: members.length, corners: hull.corners, area_km2: +area.toFixed(2), edge_km: +edge.toFixed(2) });
    }
    if (!overlayAlive(job)) return;
    records.sort((a, b) => b.area_km2 - a.area_km2);
    const grouped = opts.field ? `one hull per <b>${esc((st.meta.fields || []).find((f) => f.name === opts.field)?.label || opts.field)}</b>` : 'one hull';
    showOverlay(job, {
      title: 'Convex Hull',
      layerLabel: `Hull · ${st.meta.label}`,
      color, features: drawn,
      hint: `${grouped} around ${esc(st.meta.label)}. ${fmtNum(drawn.length)} hull${drawn.length === 1 ? '' : 's'} drawn${tooSmall ? `, ${fmtNum(tooSmall)} group${tooSmall === 1 ? '' : 's'} had fewer than three points` : ''}.`,
      stats: [
        ['Hulls', fmtNum(drawn.length)],
        ['Largest', records.length ? fmtNum(records[0].area_km2) + ' km²' : '—'],
        ['Features enclosed', fmtNum(feats.length)],
        ['Groups too small', fmtNum(tooSmall)],
      ],
      headers: ['Group', 'Features', 'Corners', 'km²', 'Edge km'],
      records,
      cells: (r) => [r.group, fmtNum(r.features), fmtNum(r.corners), fmtNum(r.area_km2), fmtNum(r.edge_km)],
      extra: { layer: st.meta.label, grouped_by: opts.field || '', hulls: drawn.length },
      emptyTable: 'Not enough points to draw a hull.',
      emptyToast: 'Nothing to draw',
    });
  });
}

// ---- Simplify Geometry ----
function toolSimplify() {
  const vec = layersOn(['polygon', 'line', 'point']);
  openModal('Simplify Geometry', (body) => {
    if (!vec.length) { body.innerHTML = overlayNeed('Turn on a vector layer first.'); return; }
    body.innerHTML = `<p class="hint">Drops bends that move the shape by less than the tolerance, and draws a lighter copy. The original layer is left as it is. A large tolerance can erase a small polygon; those are counted rather than drawn as empty shapes.</p>
      ${overlayNote()}
      <div class="frow"><label>Layer</label><select id="sy-layer">${layerOptions(vec)}</select></div>
      <div class="frow"><label>Tolerance (metres)</label><input id="sy-tol" type="number" min="1" step="50" value="500"></div>
      <div class="frow"><label class="chk"><input type="checkbox" id="sy-sliver" checked> Leave out polygons that shrink below 0.01 km²</label></div>
      <div class="frow act"><button class="btn primary" id="sy-go">${icon('sliders')} Simplify</button></div>`;
    body.querySelector('#sy-go').onclick = () => {
      const metres = +body.querySelector('#sy-tol').value;
      if (!(metres > 0)) { toast('Set a tolerance above 0'); return; }
      closeModal();
      runSimplify({ id: body.querySelector('#sy-layer').value, metres, dropSlivers: body.querySelector('#sy-sliver').checked });
    };
  });
}
function simplifyOne(f, metres) {
  if (f.type === 'point') return null;
  const km = metres / 1000;
  if (f.type === 'poly') return simplifyFeature(f, km);
  const tol = km * 1000 / MERC_METRES_PER_UNIT;
  // simplifyRing refuses a result under three vertices, so a short line whose
  // only bend is inside the tolerance comes back unchanged. Accept the shorter
  // line: two points are a valid line, just not a valid polygon ring.
  const parts = (f.parts || []).map((line) => {
    const simple = simplifyRing(line, tol);
    if (simple.length < line.length || line.length > 6) return simple;
    const dx = line[4] - line[0], dy = line[5] - line[1];
    const L = dx * dx + dy * dy;
    let t = L ? ((line[2] - line[0]) * dx + (line[3] - line[1]) * dy) / L : 0;
    t = Math.max(0, Math.min(1, t));
    const bendKm = haversineMerc(line[2], line[3], line[0] + t * dx, line[1] + t * dy);
    return bendKm > km ? line : [line[0], line[1], line[4], line[5]];
  }).filter((line) => line && line.length >= 4);
  if (!parts.length) return null;
  const bb = parts.reduce((acc, line) => {
    for (let i = 0; i < line.length; i += 2) {
      acc[0] = Math.min(acc[0], line[i]); acc[1] = Math.min(acc[1], line[i + 1]);
      acc[2] = Math.max(acc[2], line[i]); acc[3] = Math.max(acc[3], line[i + 1]);
    }
    return acc;
  }, [Infinity, Infinity, -Infinity, -Infinity]);
  return { ...f, parts, bb };
}
async function runSimplify(opts) {
  const job = beginOverlayJob();
  await runOverlay(async () => {
    const st = L.get(opts.id);
    const feats = analysisFeatures(st);
    if (!feats.length) { toast('That layer has nothing to simplify'); return; }
    const color = '#0369a1';
    const drawn = [], records = [];
    let before = 0, after = 0, dropped = 0, unchanged = 0, points = 0;
    for (let i = 0; i < feats.length; i++) {
      if (i % 40 === 0 && !(await yieldOverlay(job, `Simplifying · ${fmtNum(i)} of ${fmtNum(feats.length)}`))) return;
      const f = feats[i];
      const was = vertexCount(f);
      before += was;
      if (f.type === 'point') { points++; after += was; unchanged++; continue; }
      const simple = simplifyOne(f, opts.metres);
      const now = simple ? vertexCount(simple) : 0;
      if (!simple || !now) { dropped++; continue; }
      if (opts.dropSlivers && f.type === 'poly' && featureMetrics(simple).area < 0.01) { dropped++; continue; }
      after += now;
      if (now === was) unchanged++;
      const name = titleOf(st.obj, f);
      const size = f.type === 'poly' ? featureMetrics(simple).area : f.type === 'line' ? featureMetrics(simple).length : null;
      drawn.push({ ...simple, fill: color, stroke: color, idx: drawn.length, props: { name, vertices_before: was, vertices_after: now } });
      records.push({ name, kind: f.type === 'poly' ? 'polygon' : 'line', vertices_before: was, vertices_after: now, size: size == null ? null : +size.toFixed(2), sizeKind: f.type });
    }
    if (!overlayAlive(job)) return;
    const saved = before ? Math.round(100 * (1 - after / before)) : 0;
    showOverlay(job, {
      title: 'Simplify Geometry',
      layerLabel: `Simplified · ${st.meta.label}`,
      color, features: drawn,
      hint: `${esc(st.meta.label)} simplified at ${fmtNum(opts.metres)} m. ${fmtNum(before)} vertices became ${fmtNum(after)} (${fmtNum(saved)}% fewer). ${fmtNum(dropped)} feature${dropped === 1 ? '' : 's'} were left out${points ? `, and ${fmtNum(points)} point feature${points === 1 ? '' : 's'} have no bends to drop` : ''}. The original layer is unchanged.`,
      stats: [
        ['Drawn', fmtNum(drawn.length)],
        ['Left out', fmtNum(dropped)],
        ['Vertices before', fmtNum(before)],
        ['Vertices after', fmtNum(after)],
      ],
      headers: ['Feature', 'Kind', 'Before', 'After', 'Size'],
      records,
      cells: (r) => [r.name, r.kind, fmtNum(r.vertices_before), fmtNum(r.vertices_after), r.size == null ? '—' : fmtNum(r.size) + (r.sizeKind === 'poly' ? ' km²' : ' km')],
      extra: { layer: st.meta.label, tolerance_m: opts.metres, vertices_before: before, vertices_after: after, left_out: dropped, unchanged },
      emptyTable: 'Every feature was left out at this tolerance. Try a smaller one.',
      emptyToast: 'Nothing left to draw',
    });
  });
}

// ---- Zonal Statistics ----
function toolZonal() {
  const polys = layersOn(['polygon']);
  const rasters = [];
  for (const id of stack) { const st = L.get(id); if (st?.obj && st.meta.kind === 'raster') rasters.push([id, st]); }
  openModal('Zonal Statistics', (body) => {
    if (!polys.length || !rasters.length) { body.innerHTML = overlayNeed('Turn on a raster and a polygon layer.'); return; }
    body.innerHTML = `<p class="hint">Summarises the raster inside each polygon. The grid is sampled, and the table keeps the sample count separate from the cells that sample stands for — it does not pretend every skipped cell was measured. A cell covered by two polygons is counted in both. NoData is skipped, never treated as zero.</p>
      ${overlayNote()}
      <div class="frow"><label>Polygons</label><select id="zn-poly">${layerOptions(polys)}</select></div>
      <div class="frow"><label>Raster</label><select id="zn-raster">${layerOptions(rasters)}</select></div>
      <div class="frow"><label>Sample density</label><select id="zn-budget"><option value="8000">Faster</option><option value="20000" selected>Balanced</option><option value="80000">Finer</option></select></div>
      <div class="frow"><label class="chk"><input type="checkbox" id="zn-empty"> Keep polygons the raster does not cover</label></div>
      <div class="frow act"><button class="btn primary" id="zn-go">${icon('chart')} Summarise</button></div>`;
    body.querySelector('#zn-go').onclick = () => {
      closeModal();
      runZonal({
        polyId: body.querySelector('#zn-poly').value,
        rasterId: body.querySelector('#zn-raster').value,
        budget: +body.querySelector('#zn-budget').value || 20000,
        keepEmpty: body.querySelector('#zn-empty').checked,
      });
    };
  });
}
function zonalQuantile(values, p) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.min(sorted.length - 1, Math.ceil(i));
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}
async function runZonal(opts) {
  const job = beginOverlayJob();
  await runOverlay(async () => {
    const polySt = L.get(opts.polyId), rst = L.get(opts.rasterId);
    if (!rst?.obj?.vals) {
      toast('Raster values are still loading — try again in a moment');
      if (rst) loadValues(rst).catch(() => {});
      return;
    }
    const { w, h, data, dtype, wb } = rst.obj.vals;
    const polys = analysisFeatures(polySt).filter((f) => f.type === 'poly');
    if (!polys.length) { toast('That polygon layer has nothing to summarise'); return; }
    const index = bboxGrid(polys, (f) => f.bb, 64);
    const step = Math.max(1, Math.floor(Math.sqrt((w * h) / opts.budget)));
    const weight = step * step;
    const acc = new Map();
    let sampled = 0, nodata = 0, rowsDone = 0;
    for (let j = 0; j < h; j += step) {
      if (rowsDone++ % 8 === 0 && !(await yieldOverlay(job, `Sampling · row ${fmtNum(j)} of ${fmtNum(h)}`))) return;
      for (let i = 0; i < w; i += step) {
        const v = data[j * w + i];
        if (dtype === 'i2' ? v === -32768 : !isFinite(v)) { nodata++; continue; }
        sampled++;
        const wx = wb[0] + (i + 0.5) / w * (wb[2] - wb[0]);
        const wy = wb[1] + (j + 0.5) / h * (wb[3] - wb[1]);
        for (const f of index.near(wx, wy)) {
          if (!pointInFeature(wx, wy, f)) continue;
          let a = acc.get(f);
          if (!a) acc.set(f, a = { samples: 0, sum: 0, min: Infinity, max: -Infinity, values: [] });
          a.samples++; a.sum += v;
          if (v < a.min) a.min = v;
          if (v > a.max) a.max = v;
          if (a.values.length < 4000) a.values.push(v);
        }
      }
    }
    if (!overlayAlive(job)) return;
    const color = '#7c3aed';
    const ranked = polys
      .map((f) => ({ f, a: acc.get(f) || null }))
      .filter((r) => r.a || opts.keepEmpty)
      .sort((p, q) => (q.a?.samples || 0) - (p.a?.samples || 0));
    const drawn = [], records = [];
    ranked.forEach(({ f, a }, i) => {
      const mean = a ? a.sum / a.samples : null;
      const median = a ? zonalQuantile(a.values, 0.5) : null;
      const name = titleOf(polySt.obj, f);
      drawn.push({
        ...f, fill: a ? color : '#94a3b8', stroke: a ? color : '#94a3b8', idx: i,
        props: { polygon: name, samples: a ? a.samples : 0, cells_represented: a ? a.samples * weight : 0, mean: mean == null ? '' : +mean.toFixed(3) },
      });
      records.push({
        polygon: name, samples: a ? a.samples : 0, cells_represented: a ? a.samples * weight : 0,
        mean: mean == null ? '' : +mean.toFixed(2), median: median == null ? '' : +median.toFixed(2),
        min: a ? +a.min.toFixed(2) : '', max: a ? +a.max.toFixed(2) : '',
        sum_scaled: a ? +(a.sum * weight).toFixed(1) : '',
      });
    });
    const covered = [...acc.values()].filter((a) => a.samples).length;
    showOverlay(job, {
      title: 'Zonal Statistics',
      layerLabel: `Zonal · ${polySt.meta.label}`,
      color, features: drawn,
      hint: `${esc(rst.meta.label)} inside ${esc(polySt.meta.label)}. Every ${step} cell${step === 1 ? '' : 's'} was read, so each sample stands for ${fmtNum(weight)} cell${weight === 1 ? '' : 's'} — the cells column is that scale, not a count of cells the polygon was proven to cover. ${fmtNum(covered)} of ${fmtNum(polys.length)} polygons had data. NoData was skipped.`,
      stats: [
        ['Polygons with data', fmtNum(covered) + ' of ' + fmtNum(polys.length)],
        ['Sample step', fmtNum(step) + (step === 1 ? ' cell' : ' cells')],
        ['Samples read', fmtNum(sampled)],
        ['NoData skipped', fmtNum(nodata)],
      ],
      headers: ['Polygon', 'Samples', 'Cells stood for', 'Mean', 'Min', 'Max'],
      records,
      cells: (r) => [r.polygon, fmtNum(r.samples), fmtNum(r.cells_represented), r.mean === '' ? '—' : fmtNum(r.mean), r.min === '' ? '—' : fmtNum(r.min), r.max === '' ? '—' : fmtNum(r.max)],
      extra: records.map((r) => ({ polygon: r.polygon, samples: r.samples, cells_represented: r.cells_represented, mean: r.mean, median: r.median, min: r.min, max: r.max, sum_scaled: r.sum_scaled })),
      emptyTable: 'No polygon covered a sampled cell.',
      emptyToast: 'Nothing to draw',
    });
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

function rampNames() {
  return [...new Set([...Object.keys(COLOR_RAMPS), ...Object.keys(RAMPS)])];
}
const RAMP_NOTES = {
  cividis: 'colorblind-safe',
  cb_deuteranopia: 'colourblind', cb_protanopia: 'colourblind', cb_tritanopia: 'colourblind', cb_mono: 'colourblind',
  viridis: 'perceptual', plasma: 'perceptual', inferno: 'perceptual', magma: 'perceptual',
  spectral: 'diverging',
};
function rampLabel(name) {
  const note = RAMP_NOTES[name];
  return note ? name + ' · ' + note : name;
}
function rampStops(name, reverse) {
  const stops = (COLOR_RAMPS[name] || RAMPS[name] || RAMPS.viridis).slice();
  return reverse ? stops.reverse() : stops;
}
function classCountFor(values, asked) {
  const n = Math.max(2, Math.min(9, Math.round(+asked) || 5));
  const distinct = new Set(values.map((v) => +(+v).toFixed(4))).size;
  return Math.max(1, Math.min(n, distinct || 1));
}

// ---- Color Ramps tool ----
function toolRamp() {
  const vec = layersOn(['polygon', 'line', 'point']);
  openModal('Color Ramps', (body) => {
    if (!vec.length) { body.innerHTML = overlayNeed('Turn on a vector layer first.'); return; }
    body.innerHTML = `<p class="hint">Colours a layer that is on. Classify a number into classes, or paint the whole layer one stop from the ramp. Cividis is the colourblind-safe ramp. This does not edit the data file — Restore brings the layer's own colours back.</p>
      <div class="frow"><label>Layer</label><select id="rp-layer">${layerOptions(vec)}</select></div>
      <div class="frow"><label>Ramp</label><select id="rp-ramp">${rampNames().map((n) => `<option value="${esc(n)}">${esc(rampLabel(n))}</option>`).join('')}</select></div>
      <div class="ramp" id="rp-bar"></div>
      <p class="hint" id="rp-note"></p>
      <div class="frow"><label>Use the ramp as</label><select id="rp-mode">
        <option value="class">Classes of a number</option>
        <option value="single">One colour for the whole layer</option>
      </select></div>
      <div id="rp-class">
        <div class="frow"><label>Field</label><select id="rp-field"></select></div>
        <div class="frow"><label>Method</label><select id="rp-method"><option value="quantile">Quantile — each class holds about the same number</option><option value="interval">Equal interval — equal steps from low to high</option></select></div>
        <div class="frow"><label>Classes</label><input id="rp-n" type="range" min="2" max="9" value="5"><b id="rp-nout">5</b></div>
        <label class="chk"><input type="checkbox" id="rp-rev"> Reverse the ramp</label>
        <div id="rp-breaks"></div>
      </div>
      <div id="rp-single" hidden>
        <div class="frow"><label>Which stop</label><input id="rp-stop" type="range" min="0" max="9" value="4"><b id="rp-stopout"></b></div>
      </div>
      <div class="frow act"><button class="btn" id="rp-restore" type="button">Restore the layer's own colours</button><button class="btn primary" id="rp-go" type="button">${icon('palette')} Apply ramp</button></div>`;
    const q = (s) => body.querySelector(s);
    const fillFields = () => {
      const st = L.get(q('#rp-layer').value);
      const fields = (st?.meta?.fields || []).filter((f) => f.type === 'number');
      const cur = q('#rp-field').value;
      q('#rp-field').innerHTML = fields.map((f) => `<option value="${esc(f.name)}">${esc(f.label || f.name)}</option>`).join('') || '<option value="">No numeric field</option>';
      if ([...q('#rp-field').options].some((o) => o.value === cur)) q('#rp-field').value = cur;
      const classMode = q('#rp-mode');
      classMode.querySelector('[value="class"]').disabled = !fields.length;
      if (!fields.length) classMode.value = 'single';
    };
    const preview = () => {
      const stops = rampStops(q('#rp-ramp').value, q('#rp-rev').checked);
      q('#rp-bar').innerHTML = stops.map((c) => `<i style="background:${esc(c)}"></i>`).join('');
      const single = q('#rp-mode').value === 'single';
      q('#rp-class').hidden = single;
      q('#rp-single').hidden = !single;
      const note = q('#rp-ramp').value === 'cividis'
        ? 'Cividis stays readable for colour-blind viewers.'
        : 'For colour-blind readers, choose Cividis.';
      q('#rp-note').textContent = note;
      if (single) {
        const stop = q('#rp-stop');
        stop.max = String(Math.max(0, stops.length - 1));
        if (+stop.value > +stop.max) stop.value = stop.max;
        const swatch = stops[+stop.value] || stops[0];
        q('#rp-stopout').textContent = `${+stop.value + 1} of ${stops.length}`;
        q('#rp-stopout').style.color = swatch;
        return;
      }
      const st = L.get(q('#rp-layer').value);
      const field = q('#rp-field').value;
      if (!st?.obj || !field) { q('#rp-breaks').innerHTML = '<p class="hint">No numeric field on this layer — use one colour, or pick another layer.</p>'; return; }
      const vals = st.obj.features.map((f) => +f.props?.[field]).filter((v) => Number.isFinite(v));
      if (!vals.length) { q('#rp-breaks').innerHTML = '<p class="hint">That field has no numbers.</p>'; return; }
      const asked = +q('#rp-n').value || 5;
      const n = classCountFor(vals, asked);
      q('#rp-nout').textContent = String(n);
      const rc = { field, method: q('#rp-method').value, n, ramp: q('#rp-ramp').value, reverse: q('#rp-rev').checked, breaks: breaksOf(vals, n, q('#rp-method').value) };
      const cap = n < asked ? `<p class="hint">${fmtNum(n)} distinct value${n === 1 ? '' : 's'}, so ${n === 1 ? 'one class' : n + ' classes'}, not ${asked}. Blank numbers stay grey.</p>` : '<p class="hint">Blank numbers stay grey and are not a class.</p>';
      q('#rp-breaks').innerHTML = cap + reclassLegend({ reclass: rc, meta: st.meta });
    };
    q('#rp-layer').onchange = () => { fillFields(); preview(); };
    for (const id of ['#rp-ramp', '#rp-mode', '#rp-field', '#rp-method', '#rp-rev']) q(id).onchange = preview;
    q('#rp-n').oninput = preview;
    q('#rp-stop').oninput = preview;
    fillFields();
    preview();
    q('#rp-go').onclick = () => {
      const st = L.get(q('#rp-layer').value);
      if (!st?.obj) { toast('That layer is not on the map'); return; }
      if (!st.sym) st.sym = defaultSym(st.meta);
      if (q('#rp-mode').value === 'single') {
        const stops = rampStops(q('#rp-ramp').value, q('#rp-rev').checked);
        const color = stops[+q('#rp-stop').value] || stops[Math.floor(stops.length / 2)];
        st.reclass = null;
        st.sym.fillMode = 'single';
        st.sym.fill = color;
        st.sym.stroke = color;
        applyLayerState(st);
        refreshLegend(); renderLayerLists(); saveProject();
        toast('Painted ' + st.meta.label + ' ' + color);
        return;
      }
      const field = q('#rp-field').value;
      if (!field) { toast('That layer has no numeric field. Use one colour instead.'); return; }
      const vals = st.obj.features.map((f) => +f.props?.[field]).filter((v) => Number.isFinite(v));
      if (!vals.length) { toast('That field has no numbers'); return; }
      const n = classCountFor(vals, +q('#rp-n').value || 5);
      st.reclass = { field, method: q('#rp-method').value, n, ramp: q('#rp-ramp').value, reverse: q('#rp-rev').checked };
      st.sym.fillMode = 'data';
      st.sym.stroke = '';
      applyReclass(st, false);
      applyLayerState(st);
      refreshLegend(); renderLayerLists(); saveProject();
      toast('Classified ' + st.meta.label + ' by ' + field + (n === 1 ? ' — every value is the same' : ''));
    };
    q('#rp-restore').onclick = () => {
      const st = L.get(q('#rp-layer').value);
      if (!st) return;
      st.reclass = null;
      st.sym = defaultSym(st.meta);
      applyReclass(st, false);
      applyLayerState(st);
      refreshLegend(); renderLayerLists(); saveProject();
      toast('Restored the colours of ' + st.meta.label);
    };
  });
}

// ---- Custom Basemap tool ----
const CUSTOM_BM_KEY = 'nwg.custom_basemaps';
function readStore(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || 'null');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch { return {}; }
}
function writeStore(key, obj) {
  try { localStorage.setItem(key, JSON.stringify(obj)); return true; }
  catch { toast('This browser could not store that'); return false; }
}
function plainText(s, max) {
  return String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function customBasemapId(name) {
  const slug = plainText(name, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug ? 'custom:' + slug : '';
}
function validTileUrl(url, allowHttp) {
  if (typeof url !== 'string' || url.length < 12 || url.length > 2000) return false;
  let parsed;
  try { parsed = new URL(url); } catch { return false; }
  if (parsed.protocol !== 'https:' && !(allowHttp && parsed.protocol === 'http:')) return false;
  if (parsed.username || parsed.password) return false;
  return url.includes('{z}') && url.includes('{x}') && url.includes('{y}');
}
function cleanSubdomains(sub) {
  return String(sub || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
}
function basemapSpecOk(spec, allowHttp) {
  return !!(spec && validTileUrl(spec.url, allowHttp) && Number.isFinite(+spec.max));
}
function registerCustomBasemap(name, spec) {
  const id = customBasemapId(name);
  if (!id || !basemapSpecOk(spec, true)) return '';
  BASEMAPS[id] = {
    label: plainText(name, 40),
    url: spec.url,
    sub: cleanSubdomains(spec.sub) || 'a',
    max: Math.max(1, Math.min(22, +spec.max || 18)),
    bg: '#f3f4f2',
    attr: plainText(spec.attr, 160) || ('Custom tiles: ' + plainText(name, 40)),
  };
  if (!BASEMAP_ORDER.includes(id)) {
    const none = BASEMAP_ORDER.indexOf('none');
    if (none >= 0) BASEMAP_ORDER.splice(none, 0, id);
    else BASEMAP_ORDER.push(id);
  }
  return id;
}
function unregisterCustomBasemap(name) {
  const id = customBasemapId(name);
  if (!id) return;
  delete BASEMAPS[id];
  const i = BASEMAP_ORDER.indexOf(id);
  if (i >= 0) BASEMAP_ORDER.splice(i, 1);
  if (map.basemap === id) {
    map.setBasemap('light');
    toast('That basemap was on. Switched back to Light grey.');
  }
}
function installCustomBasemaps() {
  for (const [name, spec] of Object.entries(readStore(CUSTOM_BM_KEY))) {
    if (basemapSpecOk(spec, true)) registerCustomBasemap(name, spec);
  }
}
function builtInBasemapName(name) {
  const n = plainText(name, 40).toLowerCase();
  for (const [id, v] of Object.entries(BASEMAPS)) {
    if (String(id).startsWith('custom:')) continue;
    if (id.toLowerCase() === n || String(v.label || '').toLowerCase() === n) return true;
  }
  return false;
}
function toolCustomBasemap() {
  openModal('Custom Basemap', (body) => {
    body.innerHTML = `<p class="hint">Adds an XYZ tile URL and keeps it in this browser. The URL must be https and contain {z}, {x} and {y}. Tiles are requested from that server only while the basemap is on — they are not stored here. Use a source whose licence allows it, and write that credit in Attribution.</p>
      <div class="frow"><label>Name</label><input id="cb-name" type="text" maxlength="40" placeholder="Agency imagery"></div>
      <div class="frow"><label>Tile URL</label><input id="cb-url" type="url" placeholder="https://tiles.example/{z}/{x}/{y}.png"></div>
      <div class="frow"><label>Attribution</label><input id="cb-attr" type="text" maxlength="160" placeholder="© The provider"></div>
      <div class="frow"><label>Max zoom</label><input id="cb-maxz" type="number" min="1" max="22" value="18"></div>
      <div class="frow"><label>Subdomains</label><input id="cb-sub" type="text" value="abc" maxlength="8" placeholder="abc"><span class="hint">Only used when the URL contains {s}. One character per server.</span></div>
      <div class="frow act"><button class="btn primary" id="cb-add" type="button">${icon('layers')} Add basemap</button></div>
      <h4>Saved in this browser</h4>
      <div id="cb-list"></div>`;
    const renderList = () => {
      const saved = readStore(CUSTOM_BM_KEY);
      const keys = Object.keys(saved);
      body.querySelector('#cb-list').innerHTML = keys.length
        ? keys.map((k) => `<div class="fitem"><div class="ft"><b>${esc(k)}</b><small>${esc(saved[k].url || '')}</small></div><div class="acts"><button class="btn" type="button" data-use="${esc(k)}">Use</button><button class="chip" type="button" data-del="${esc(k)}">Remove</button></div></div>`).join('')
        : '<p class="empty">No custom basemaps saved.</p>';
      body.querySelectorAll('[data-use]').forEach((b) => {
        b.onclick = () => {
          const spec = readStore(CUSTOM_BM_KEY)[b.dataset.use];
          const id = spec && registerCustomBasemap(b.dataset.use, spec);
          if (!id) { toast('That saved URL can no longer be used'); return; }
          map.setBasemap(id); syncBasemapUI(); updateAttrib(); pushHash(); renderLayerTools();
          toast('Basemap: ' + b.dataset.use);
        };
      });
      body.querySelectorAll('[data-del]').forEach((b) => {
        b.onclick = () => {
          const savedNow = readStore(CUSTOM_BM_KEY);
          delete savedNow[b.dataset.del];
          if (!writeStore(CUSTOM_BM_KEY, savedNow)) return;
          unregisterCustomBasemap(b.dataset.del);
          buildBasemaps(); syncBasemapUI(); updateAttrib(); pushHash(); renderLayerTools();
          renderList();
        };
      });
    };
    renderList();
    body.querySelector('#cb-add').onclick = () => {
      const name = plainText(body.querySelector('#cb-name').value, 40);
      const url = body.querySelector('#cb-url').value.trim();
      const attr = plainText(body.querySelector('#cb-attr').value, 160);
      const max = Math.max(1, Math.min(22, +body.querySelector('#cb-maxz').value || 18));
      const sub = cleanSubdomains(body.querySelector('#cb-sub').value);
      if (!name || !customBasemapId(name)) { toast('Give the basemap a name'); return; }
      if (builtInBasemapName(name)) { toast('That name is already a built-in basemap'); return; }
      const saved = readStore(CUSTOM_BM_KEY);
      const clash = Object.keys(saved).find((k) => k !== name && customBasemapId(k) === customBasemapId(name));
      if (clash) { toast('That name matches the saved basemap “' + clash + '”. Remove it or pick another name.'); return; }
      if (!validTileUrl(url, false)) { toast('The URL must be https and contain {z}, {x} and {y}'); return; }
      if (url.includes('{s}') && !sub) { toast('This URL needs subdomains, such as abc'); return; }
      if (Object.keys(saved).length >= 8 && !saved[name]) { toast('Eight custom basemaps is the limit. Remove one first.'); return; }
      saved[name] = { url, max, sub: sub || 'a', attr };
      if (!writeStore(CUSTOM_BM_KEY, saved)) return;
      const id = registerCustomBasemap(name, saved[name]);
      buildBasemaps();
      map.setBasemap(id);
      syncBasemapUI(); updateAttrib(); pushHash(); renderLayerTools();
      body.querySelector('#cb-name').value = '';
      renderList();
      toast('Basemap “' + name + '” added. If the tiles do not appear, check the URL and the licence.');
    };
  });
}

// ---- Map Presets tool ----
const PRESET_KEY = 'nwg.map_presets';
function presetLayerRecord(id) {
  const st = L.get(id);
  if (!st) return null;
  return {
    id, on: !!st.on, opacity: st.opacity,
    sym: st.sym || null, labels: st.labels || null, reclass: st.reclass || null,
    filter: hasFilter(st) ? st.filter : null,
  };
}
function captureMapPreset(name, note) {
  return {
    note: plainText(note, 80),
    saved: Date.now(),
    basemap: map.basemap,
    center: map.center(),
    zoom: map.zoom,
    rotation: map.rotation || 0,
    grid: !!gridOn,
    clip: clipRecord(),
    layers: stack.map(presetLayerRecord).filter(Boolean),
  };
}
function basemapIdFromPreset(key) {
  if (key && BASEMAPS[key]) return key;
  const hit = Object.entries(BASEMAPS).find(([, v]) => v.label === key);
  return hit ? hit[0] : '';
}
function toolMapPreset() {
  openModal('Map Presets', (body) => {
    body.innerHTML = `<p class="hint">Saves the layers that are on, their colours, filters and opacity, the basemap and the focus area. Restoring brings that map back. The centre is restored too, but it is not shown or exported. A bookmark only saves where you were looking.</p>
      <div class="frow"><label>Name</label><input id="mp-name" type="text" maxlength="40" placeholder="Mineral view"></div>
      <div class="frow"><label>Note</label><input id="mp-note" type="text" maxlength="80" placeholder="Optional"></div>
      <label class="chk"><input type="checkbox" id="mp-replace"> Replace a preset that already has this name</label>
      <div class="frow act"><button class="btn primary" id="mp-save" type="button">${icon('pin')} Save this map</button></div>
      <h4>Saved in this browser</h4>
      <div id="mp-list"></div>`;
    const renderList = () => {
      const presets = readStore(PRESET_KEY);
      const keys = Object.keys(presets);
      body.querySelector('#mp-list').innerHTML = keys.length
        ? keys.map((k) => {
          const p = presets[k];
          const when = p.saved ? new Date(p.saved).toLocaleDateString() : '';
          const layers = (p.layers || p.stack || []).length;
          const base = basemapIdFromPreset(p.basemap);
          const baseLabel = base ? BASEMAPS[base].label : 'basemap not in this browser';
          const focus = p.clip ? ' · focus area' : '';
          return `<div class="fitem"><div class="ft"><b>${esc(k)}</b><small>${esc(p.note || '')}${p.note ? ' · ' : ''}${esc(when)} · ${fmtNum(layers)} layer${layers === 1 ? '' : 's'} · ${esc(baseLabel)}${focus}</small></div><div class="acts"><button class="btn" type="button" data-restore="${esc(k)}">Restore</button><button class="chip" type="button" data-del="${esc(k)}">Remove</button></div></div>`;
        }).join('')
        : '<p class="empty">No map presets saved.</p>';
      body.querySelectorAll('[data-restore]').forEach((b) => {
        b.onclick = () => { closeModal(); applyMapPreset(b.dataset.restore); };
      });
      body.querySelectorAll('[data-del]').forEach((b) => {
        b.onclick = () => {
          const presetsNow = readStore(PRESET_KEY);
          delete presetsNow[b.dataset.del];
          if (!writeStore(PRESET_KEY, presetsNow)) return;
          renderList();
        };
      });
    };
    renderList();
    body.querySelector('#mp-save').onclick = () => {
      const name = plainText(body.querySelector('#mp-name').value, 40);
      if (!name) { toast('Name the preset'); return; }
      const presets = readStore(PRESET_KEY);
      if (presets[name] && !body.querySelector('#mp-replace').checked) {
        toast('That name is already saved. Tick replace to overwrite it.');
        return;
      }
      if (Object.keys(presets).length >= 24 && !presets[name]) { toast('Twenty-four presets is the limit. Remove one first.'); return; }
      presets[name] = captureMapPreset(name, body.querySelector('#mp-note').value);
      if (!writeStore(PRESET_KEY, presets)) return;
      body.querySelector('#mp-name').value = '';
      body.querySelector('#mp-replace').checked = false;
      renderList();
      toast('Saved “' + name + '”');
    };
  });
}
async function applyMapPreset(name) {
  const p = readStore(PRESET_KEY)[name];
  if (!p) { toast('That preset is not in this browser'); return; }
  await working('Restoring ' + name);
  const savedLayers = Array.isArray(p.layers) ? p.layers : (p.stack || []).map((rec) => (typeof rec === 'string' ? { id: rec, on: true } : rec));
  if (p.filters && typeof p.filters === 'object') {
    for (const rec of savedLayers) if (rec && rec.filter == null && p.filters[rec.id]) rec.filter = p.filters[rec.id];
  }
  const savedIds = new Set(savedLayers.map((rec) => rec.id));
  for (const st of L.values()) {
    if (!savedIds.has(st.meta.id) && hasFilter(st)) st.filter = null;
  }
  for (const id of [...stack]) {
    if (!savedIds.has(id)) await setLayer(id, false, { quiet: true });
  }
  let missing = 0, failed = 0;
  for (const rec of savedLayers) {
    const st = L.get(rec.id);
    if (!st) { missing++; continue; }
    if (typeof rec.opacity === 'number') st.opacity = rec.opacity;
    if (rec.sym) st.sym = rec.sym;
    if (rec.labels) st.labels = rec.labels;
    st.reclass = rec.reclass || null;
    st.filter = rec.filter || null;
    if (rec.on === false) {
      await setLayer(rec.id, false, { quiet: true });
      continue;
    }
    const before = st.on;
    await setLayer(rec.id, true, { quiet: true });
    if (!st.on && !before) failed++;
    if (st.obj && st.reclass) applyReclass(st, false);
    if (st.obj && hasFilter(st)) applyFilter(st, false);
  }
  const base = basemapIdFromPreset(p.basemap);
  if (base) map.setBasemap(base);
  if (Array.isArray(p.center) && p.center.length >= 2) map.setView(p.center[0], p.center[1], p.zoom);
  if (Number.isFinite(p.rotation)) map.setRotation(p.rotation);
  gridOn = !!p.grid; map.setGrid(gridOn);
  if (p.clip) restoreFocus(p.clip);
  else { focusLabel = ''; setFocus(null, false); }
  applyOrderFromStack();
  renderLayerLists(); refreshLegend(); updateFocusUI(); updateToolState(); syncBasemapUI(); updateAttrib(); pushHash(); saveProject();
  hideToast();
  const extra = missing ? ` ${fmtNum(missing)} layer${missing === 1 ? '' : 's'} from that preset ${missing === 1 ? 'is' : 'are'} not in this browser.` : '';
  const baseNote = p.basemap && !base ? ' The basemap is not in this browser.' : '';
  toast('Restored “' + name + '”.' + extra + baseNote + (failed ? ' A layer could not be loaded.' : ''));
}

// ---- Print Layouts tool ----
const PRINT_KEY = 'nwg.print_layout';
function readPrintLayout() {
  try {
    const p = JSON.parse(localStorage.getItem(PRINT_KEY) || 'null');
    if (!p || typeof p !== 'object') return null;
    return {
      size: ['a4', 'a3', 'letter'].includes(p.size) ? p.size : 'a4',
      orient: p.orient === 'landscape' ? 'landscape' : 'portrait',
      margin: Math.max(5, Math.min(40, +p.margin || 15)),
      title: plainText(p.title, 80),
      legend: !!p.legend,
      scale: p.scale !== false,
      north: p.north !== false,
    };
  } catch { return null; }
}
function layoutFromForm(body) {
  return {
    size: body.querySelector('#pl-size').value,
    orient: body.querySelector('#pl-orient').value,
    margin: Math.max(5, Math.min(40, body.querySelector('#pl-margin').value === '' ? 15 : +body.querySelector('#pl-margin').value || 0)),
    title: plainText(body.querySelector('#pl-title').value, 80),
    legend: body.querySelector('#pl-legend').checked,
    scale: body.querySelector('#pl-scale').checked,
    north: body.querySelector('#pl-north').checked,
  };
}
function toolPrintLayout() {
  const cur = readPrintLayout();
  openModal('Print Layouts', (body) => {
    body.innerHTML = `<p class="hint">Builds a page and fits the map inside it. A wide screen is letterboxed, not stretched. The picture has no latitude or longitude. Save map picture uses this page until you choose screen pictures again.</p>
      <div class="frow"><label>Page</label><select id="pl-size">
        <option value="a4">A4</option><option value="letter">Letter</option><option value="a3">A3</option>
      </select></div>
      <div class="frow"><label>Orientation</label><select id="pl-orient">
        <option value="portrait">Portrait</option><option value="landscape">Landscape</option>
      </select></div>
      <div class="frow"><label>Margin (mm)</label><input id="pl-margin" type="number" min="5" max="40" value="15"></div>
      <div class="frow"><label>Title</label><input id="pl-title" type="text" maxlength="80" placeholder="Optional title"></div>
      <div class="frow act">
        <label class="chk"><input type="checkbox" id="pl-legend"> Legend</label>
        <label class="chk"><input type="checkbox" id="pl-scale" checked> Scale bar</label>
        <label class="chk"><input type="checkbox" id="pl-north" checked> North arrow</label>
      </div>
      <div class="pageprev" id="pl-prev" title="The green area is the map. White is page margin, not stretched ground."><i id="pl-map"></i></div>
      <p class="hint" id="pl-status"></p>
      <div class="frow act"><button class="btn primary" id="pl-go" type="button">${icon('camera')} Download this page</button><button class="btn" id="pl-clear" type="button">Use screen pictures again</button></div>`;
    if (cur) {
      body.querySelector('#pl-size').value = cur.size;
      body.querySelector('#pl-orient').value = cur.orient;
      body.querySelector('#pl-margin').value = cur.margin;
      body.querySelector('#pl-title').value = cur.title || '';
      body.querySelector('#pl-legend').checked = !!cur.legend;
      body.querySelector('#pl-scale').checked = cur.scale !== false;
      body.querySelector('#pl-north').checked = cur.north !== false;
    }
    const paint = () => {
      const layout = layoutFromForm(body);
      const frame = pageFrame({ ...layout, legend: layout.legend && stack.length > 0 }, map.W || 16, map.H || 9);
      const box = body.querySelector('#pl-prev');
      box.style.aspectRatio = frame.pageWmm + ' / ' + frame.pageHmm;
      const mapBox = body.querySelector('#pl-map');
      mapBox.style.left = (100 * frame.mapX / frame.pageW) + '%';
      mapBox.style.top = (100 * frame.mapY / frame.pageH) + '%';
      mapBox.style.width = (100 * frame.mapW / frame.pageW) + '%';
      mapBox.style.height = (100 * frame.mapH / frame.pageH) + '%';
      const remembered = readPrintLayout();
      body.querySelector('#pl-status').textContent = remembered
        ? 'Save map picture is using the saved ' + remembered.size.toUpperCase() + ' ' + remembered.orient + ' page.'
        : 'Save map picture is still the screen, until you download or the page is saved.';
    };
    for (const id of ['#pl-size', '#pl-orient', '#pl-margin', '#pl-legend', '#pl-scale', '#pl-north']) body.querySelector(id).onchange = paint;
    paint();
    body.querySelector('#pl-go').onclick = () => {
      const layout = layoutFromForm(body);
      if (!writeStore(PRINT_KEY, layout)) return;
      closeModal();
      exportMapImage({ print: true, layout, title: layout.title });
    };
    body.querySelector('#pl-clear').onclick = () => {
      try { localStorage.removeItem(PRINT_KEY); } catch { }
      paint();
      toast('Save map picture is the screen again');
    };
  });
}


// ------------------------------------------------ search & discovery tools

let coordInspect = null;
let finderOn = false;
let discoveryOn = false;
let finderJob = 0;
let finderSaved = null;

function isSearchVector(st) {
  return !!st && (st.meta.kind === 'point' || st.meta.kind === 'line' || st.meta.kind === 'polygon');
}
function copyPlain(text, ok) {
  if (!text) { toast('Nothing to copy'); return; }
  const done = () => toast(ok || 'Copied');
  const fail = () => toast('Could not copy');
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, fail);
  else fail();
}
function coordinatePlain(lon, lat, systemId) {
  const zone = utmZoneOf(lon, lat);
  const sys = lonLatToSystem(lon, lat, systemId || 'wgs-utm');
  const lines = [
    `WGS 84  ${Math.abs(lat).toFixed(5)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(5)}°${lon >= 0 ? 'E' : 'W'}`,
    `DMS  ${formatDms(lat, true)}, ${formatDms(lon, false)}`,
    `UTM zone ${zone ? zone.label : ''}`,
  ];
  if (sys && !sys.error) {
    if (sys.kind === 'longlat') lines.push(`${sys.name}  ${Math.abs(sys.y).toFixed(5)}°${sys.y >= 0 ? 'N' : 'S'}, ${Math.abs(sys.x).toFixed(5)}°${sys.x >= 0 ? 'E' : 'W'}`);
    else lines.push(`${sys.name}  E ${sys.easting.toFixed(1)} m   N ${sys.northing.toFixed(1)} m`);
    if (sys.caveat) lines.push(sys.caveat);
  } else if (sys?.error) lines.push(sys.error);
  return lines.join('\n');
}
function showMapDock(el) {
  if (!el) return;
  if (mobileQ.matches) closeSheet();
  el.hidden = false;
}
function fillGridSelect(sel, selected) {
  if (!sel) return;
  if (!sel.dataset.filled) {
    sel.innerHTML = GRID_SYSTEMS.map((s) => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('');
    sel.dataset.filled = '1';
  }
  if (selected && [...sel.options].some((o) => o.value === selected)) sel.value = selected;
}
map.extra.push((ctx, m) => {
  if (!coordInspect?.point) return;
  const [x, y] = m.screenOf(coordInspect.point[0], coordInspect.point[1]);
  ctx.save();
  ctx.strokeStyle = '#9a3412';
  ctx.fillStyle = 'rgba(194,65,12,.22)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 14, y); ctx.lineTo(x + 14, y);
  ctx.moveTo(x, y - 14); ctx.lineTo(x, y + 14);
  ctx.stroke();
  ctx.restore();
});

function paintInspect() {
  const box = $('#inspectread');
  const note = $('#inspectnote');
  if (!box) return;
  const point = coordInspect?.point;
  if (!point) {
    box.innerHTML = '<p class="empty">Tap the map.</p>';
    if (note) { note.textContent = ''; note.className = 'hint'; }
    return;
  }
  const [lon, lat] = point;
  const zone = utmZoneOf(lon, lat);
  const sys = lonLatToSystem(lon, lat, coordInspect.systemId || 'wgs-utm');
  const dd = `${Math.abs(lat).toFixed(5)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(5)}°${lon >= 0 ? 'E' : 'W'}`;
  const dms = `${formatDms(lat, true)}, ${formatDms(lon, false)}`;
  let grid = sys.error || '';
  if (!sys.error && sys.kind === 'longlat') grid = `${sys.name}: ${Math.abs(sys.y).toFixed(5)}°${sys.y >= 0 ? 'N' : 'S'}, ${Math.abs(sys.x).toFixed(5)}°${sys.x >= 0 ? 'E' : 'W'}`;
  else if (!sys.error) grid = `${sys.name}: E ${sys.easting.toFixed(1)} m, N ${sys.northing.toFixed(1)} m`;
  const outside = coordInspect.outside ? '<div>Focus</div><div>Outside the focus area</div>' : '';
  box.innerHTML = `<div class="kv"><div>Decimal degrees</div><div>${esc(dd)}</div><div>DMS</div><div>${esc(dms)}</div><div>Zone</div><div>${esc(zone?.label || '')}</div><div>Grid</div><div>${esc(grid)}</div><div>On the map</div><div>${esc(coordInspect.underLabel || 'Nothing on at this point')}</div>${outside}</div>`;
  if (note) {
    note.textContent = sys.caveat || '';
    note.className = sys.caveat ? 'caveat' : 'hint';
  }
}
function readInspect(lon, lat, x, y) {
  if (!coordInspect) return;
  const err = validateLonLat(lon, lat);
  if (err) { toast(err); return; }
  coordInspect.point = [lon, lat];
  const [wx, wy] = map.fromScreen(x, y);
  coordInspect.outside = !!(clip && !map.clipContainsPoint(wx, wy));
  const top = map.identify(x, y).find((r) => r.feature);
  if (top) {
    const st = L.get(top.layer.id);
    coordInspect.under = top;
    coordInspect.underLabel = `${st?.meta.label || 'Layer'} — ${titleOf(top.layer, top.feature)}`;
  } else {
    coordInspect.under = null;
    coordInspect.underLabel = coordInspect.outside ? 'Outside the focus area' : 'Nothing on at this point';
  }
  paintInspect();
  map.render();
  if (coordInspect.once) {
    const fn = coordInspect.onPoint;
    const point = [lon, lat];
    coordInspect.onPoint = null;
    coordInspect.onCancel = null;
    stopCoordInspect('silent');
    fn?.(point[0], point[1]);
  }
}
function startCoordInspect(opts = {}) {
  const dock = $('#inspectdock');
  if (!dock) { toast('Coordinate Inspector is not available'); return; }
  wireSearchDocks();
  fillGridSelect($('#inspectgrid'), opts.systemId || 'wgs-utm');
  coordInspect = {
    once: !!opts.once,
    onPoint: opts.onPoint || null,
    onCancel: opts.onCancel || null,
    point: null,
    under: null,
    systemId: opts.systemId || 'wgs-utm',
  };
  const hint = $('#inspecthint');
  if (hint) hint.textContent = opts.hint || 'Tap the map. Pan and zoom still work. Stop when you are done.';
  paintInspect();
  showMapDock(dock);
  updateToolState();
  map.render();
}
function stopCoordInspect(reason) {
  if (!coordInspect) return;
  const job = coordInspect;
  coordInspect = null;
  const dock = $('#inspectdock');
  if (dock) dock.hidden = true;
  updateToolState();
  map.render();
  if (reason === 'cancel') job.onCancel?.();
}
function toolCoordInspector() {
  closeModal();
  startCoordInspect();
}

function stopFeatureFinder() {
  finderJob++;
  finderOn = false;
  const dock = $('#finddock');
  if (dock) dock.hidden = true;
  if (finderSaved) {
    map.selection = finderSaved.selection;
    map.selectionSet = finderSaved.set;
    finderSaved = null;
    map.render();
  }
  updateToolState();
}
function valueMatches(value, query, mode) {
  if (value == null || value === '') return false;
  const text = String(value);
  const hay = text.toLowerCase();
  const q = String(query || '').toLowerCase();
  if (!q) return false;
  if (mode === 'exact') {
    if (hay === q) return true;
    if (/^-?\d+(\.\d+)?$/.test(q) && /^-?\d+(\.\d+)?$/.test(text.trim()) && !/^0\d/.test(q) && Number(text) === Number(q)) return true;
    return false;
  }
  if (mode === 'starts') return hay.startsWith(q);
  return hay.includes(q);
}
function searchFields(st, only) {
  const listed = (st.meta.fields || []).map((f) => ({ name: f.name, label: f.label || f.name }));
  const props = st.obj?.features?.[0]?.props || {};
  const seen = new Set(listed.map((f) => f.name));
  const extra = Object.keys(props).filter((name) => !seen.has(name)).map((name) => ({ name, label: name }));
  const all = listed.length ? [...listed, ...extra] : extra;
  const label = st.obj?.labelField || st.meta.labelField;
  if (label) all.sort((a, b) => (a.name === label ? -1 : b.name === label ? 1 : 0));
  return only ? all.filter((f) => f.name === only) : all;
}
function markMatch(value, query, mode) {
  const text = String(value);
  if (mode === 'exact') return esc(text);
  const i = text.toLowerCase().indexOf(String(query || '').toLowerCase());
  if (i < 0) return esc(text);
  const n = String(query || '').length;
  return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + n)) + '</mark>' + esc(text.slice(i + n));
}
function toolFeatureFinder() {
  const dock = $('#finddock');
  if (!dock) { toast('Feature Finder is not available'); return; }
  closeModal();
  wireSearchDocks();
  finderJob++;
  if (!finderSaved) finderSaved = { selection: map.selection, set: map.selectionSet ? map.selectionSet.slice() : [] };
  finderOn = true;
  const vectors = [...L.values()].filter(isSearchVector);
  if (!vectors.length) {
    $('#findbody').innerHTML = '<p class="empty">No vector layer with attributes is in this browser.</p>';
    showMapDock(dock);
    updateToolState();
    return;
  }
  const on = vectors.filter((st) => st.on);
  const off = vectors.filter((st) => !st.on).sort((a, b) => a.meta.label.localeCompare(b.meta.label));
  const body = $('#findbody');
  body.innerHTML = `<p class="hint">Searches the layers that are on. A filtered feature, or one outside the focus, stays out unless you ask. Nothing is downloaded.</p>
    <div class="frow"><label for="ff-q">Search</label><input id="ff-q" type="search" placeholder="Name, code or number" autocomplete="off"></div>
    <div class="frow"><label for="ff-layer">Layer</label><select id="ff-layer"><option value="">Layers that are on</option>${on.map((st) => `<option value="${esc(st.meta.id)}">${esc(st.meta.label)}</option>`).join('')}</select></div>
    <div class="frow"><label for="ff-off">Also include</label><select id="ff-off"><option value="">No off layer</option>${off.map((st) => `<option value="${esc(st.meta.id)}">${esc(st.meta.label)} (stays off)</option>`).join('')}</select></div>
    <div class="frow"><label for="ff-field">Field</label><select id="ff-field"><option value="">Any field</option></select></div>
    <div class="frow"><label for="ff-mode">Match</label><select id="ff-mode"><option value="contains">Contains</option><option value="exact">Exact</option><option value="starts">Starts with</option></select></div>
    <label class="checkline"><input id="ff-hidden" type="checkbox"> Include features hidden by a filter</label>
    <label class="checkline" id="ff-focuswrap" ${clip ? '' : 'hidden'}><input id="ff-focus" type="checkbox"> Include features outside the focus</label>
    <div class="frow act"><button type="button" class="btn primary" id="ff-run">${icon('search')} Search</button></div>
    <p id="ff-status" class="hint" aria-live="polite"></p>
    <div id="ff-results"></div>`;
  showMapDock(dock);
  updateToolState();
  const qEl = body.querySelector('#ff-q');
  const layerEl = body.querySelector('#ff-layer');
  const offEl = body.querySelector('#ff-off');
  const fieldEl = body.querySelector('#ff-field');
  const modeEl = body.querySelector('#ff-mode');
  const hiddenEl = body.querySelector('#ff-hidden');
  const focusEl = body.querySelector('#ff-focus');
  const status = body.querySelector('#ff-status');
  const results = body.querySelector('#ff-results');
  let timer = 0;
  let hits = [];
  function chosen() {
    const picked = layerEl.value ? L.get(layerEl.value) : null;
    const list = picked ? [picked] : [...L.values()].filter((st) => st.on && isSearchVector(st));
    const extra = offEl.value ? L.get(offEl.value) : null;
    if (extra && !list.some((st) => st.meta.id === extra.meta.id)) list.push(extra);
    return list.filter(Boolean);
  }
  function refreshFields() {
    const prev = fieldEl.value;
    const seen = new Set();
    const fields = [];
    for (const st of chosen()) {
      for (const f of searchFields(st, '')) {
        if (seen.has(f.name)) continue;
        seen.add(f.name);
        fields.push(f);
      }
    }
    fieldEl.innerHTML = '<option value="">Any field</option>' + fields.map((f) => `<option value="${esc(f.name)}">${esc(f.label)}</option>`).join('');
    if (prev && [...fieldEl.options].some((o) => o.value === prev)) fieldEl.value = prev;
  }
  function paint(note, list) {
    if (!finderOn) return;
    status.textContent = note;
    hits = list || [];
    const q = qEl.value.trim();
    const mode = modeEl.value;
    results.innerHTML = hits.map((hit, i) => `<button type="button" class="ffhit" data-i="${i}"><b>${esc(hit.label)}</b><small>${esc(hit.layerLabel)}${hit.off ? ' · stays off' : ''} · ${esc(hit.fieldLabel)} = ${markMatch(hit.value, q, mode)}</small></button>`).join('')
      + (hits.length > 1 ? '<div class="frow act"><button type="button" class="btn" id="ff-fit">Zoom to these</button></div>' : '');
    results.querySelectorAll('.ffhit').forEach((btn) => {
      btn.onclick = () => {
        const hit = hits[+btn.dataset.i];
        if (!hit) return;
        finderSaved = null;
        map.selectionSet = [];
        if (hit.layerObj && !hit.layerObj.id) hit.layerObj.id = hit.layerId;
        map.selection = { feature: hit.feature, layer: hit.layerObj };
        map.zoomToFeature(hit.feature, 70);
        showResults([{ layer: hit.layerObj, feature: hit.feature }]);
        openSheet('info', true);
        stopFeatureFinder();
        toast('Found: ' + hit.label);
      };
    });
    const fit = results.querySelector('#ff-fit');
    if (fit) fit.onclick = () => {
      const boxes = hits.map((h) => h.feature?.bb).filter((bb) => bb && bb.length === 4);
      if (!boxes.length) { toast('Those features have no extent'); return; }
      map.fitBounds([
        Math.min(...boxes.map((bb) => unX(bb[0]))),
        Math.min(...boxes.map((bb) => unY(bb[3]))),
        Math.max(...boxes.map((bb) => unX(bb[2]))),
        Math.max(...boxes.map((bb) => unY(bb[1]))),
      ], 40, mobileQ.matches ? innerHeight * 0.42 : 0);
    };
    map.selection = null;
    map.selectionSet = hits.map((h) => ({ layer: { id: h.layerId }, feature: h.feature }));
    map.render();
  }
  async function run(token) {
    if (token !== finderJob || !finderOn) return;
    const q = qEl.value.trim();
    const mode = modeEl.value;
    const min = mode === 'contains' ? 2 : 1;
    if (q.length < min) {
      paint(mode === 'contains' ? 'Type at least 2 characters.' : 'Type a value.', []);
      return;
    }
    const layers = chosen();
    if (!layers.length) {
      paint('Turn a layer on, or choose one that is off.', []);
      return;
    }
    const includeHidden = hiddenEl.checked;
    const includeOutside = !!focusEl?.checked;
    const only = fieldEl.value;
    const shown = [];
    const counts = [];
    status.textContent = 'Searching…';
    for (const st of layers) {
      if (token !== finderJob || !finderOn) return;
      if (!st.obj?.features) {
        status.textContent = 'Loading ' + st.meta.label + '…';
        try { await loadLayer(st); }
        catch { toast('Could not load ' + st.meta.label); continue; }
        if (!st.on && st.obj) st.obj.visible = false;
      }
      if (token !== finderJob || !finderOn) return;
      if (st.obj && !st.obj.id) st.obj.id = st.meta.id;
      const feats = st.obj?.features || [];
      const fields = searchFields(st, only);
      let n = 0;
      let kept = 0;
      for (let i = 0; i < feats.length; i++) {
        if (token !== finderJob || !finderOn) return;
        if (i && i % 3000 === 0) {
          status.textContent = `Searching ${st.meta.label}… ${i.toLocaleString()} of ${feats.length.toLocaleString()}`;
          await new Promise((r) => setTimeout(r, 0));
          if (token !== finderJob || !finderOn) return;
        }
        const f = feats[i];
        if (!includeHidden && f.hidden) continue;
        if (!includeOutside && clip && !map.clipOverlapsFeature(f)) continue;
        let match = null;
        for (const field of fields) {
          const v = f.props?.[field.name];
          if (valueMatches(v, q, mode)) { match = { field, value: v }; break; }
        }
        if (!match) continue;
        n++;
        if (kept < 8 && shown.length < 48) {
          shown.push({
            feature: f, layerObj: st.obj, layerId: st.meta.id, layerLabel: st.meta.label,
            fieldLabel: match.field.label, value: match.value, label: titleOf(st.obj, f), off: !st.on,
          });
          kept++;
        }
      }
      counts.push({ label: st.meta.label, n, more: Math.max(0, n - kept), off: !st.on });
    }
    if (token !== finderJob || !finderOn) return;
    const total = counts.reduce((s, c) => s + c.n, 0);
    if (!total) { paint('No features matched.', []); return; }
    const extra = counts.filter((c) => c.more).map((c) => `${c.more.toLocaleString()} more in ${c.label}`);
    const offs = counts.filter((c) => c.off && c.n).map((c) => c.label);
    let note = `${total.toLocaleString()} feature${total === 1 ? '' : 's'} matched`;
    if (shown.length < total) note += `, ${shown.length} shown`;
    if (extra.length) note += '. ' + extra.join('; ') + ' — pick that layer to see them';
    if (offs.length) note += '. ' + offs.join(', ') + ' stayed off';
    note += '. Highlighted on the map.';
    paint(note, shown);
  }
  function schedule() { clearTimeout(timer); const token = ++finderJob; timer = setTimeout(() => run(token), 160); }
  function runNow() { clearTimeout(timer); run(++finderJob); }
  refreshFields();
  qEl.addEventListener('input', schedule);
  qEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runNow(); } });
  layerEl.addEventListener('change', () => { refreshFields(); schedule(); });
  offEl.addEventListener('change', () => { refreshFields(); schedule(); });
  fieldEl.addEventListener('change', schedule);
  modeEl.addEventListener('change', schedule);
  hiddenEl.addEventListener('change', schedule);
  focusEl?.addEventListener('change', schedule);
  body.querySelector('#ff-run').onclick = runNow;
  qEl.focus();
  status.textContent = 'Type at least 2 characters.';
}

function dmsParts(value, isLat) {
  const neg = value < 0;
  const max = (isLat ? 90 : 180) * 36000;
  let tenths = Math.round(Math.abs(value) * 36000);
  if (tenths > max) tenths = max;
  const deg = Math.floor(tenths / 36000);
  const rem = tenths % 36000;
  return { deg, min: Math.floor(rem / 600), sec: ((rem % 600) / 10).toFixed(1), hem: neg ? (isLat ? 'S' : 'W') : (isLat ? 'N' : 'E') };
}
function toolCoordConverter(seed) {
  openModal('Coordinate Converter', (body) => {
    body.innerHTML = `<p class="hint">Decimal degrees, degrees-minutes-seconds and a named grid stay in step. Decimal degrees are WGS 84, the same system as the map.</p>
      <div class="frow"><label for="cc-paste">Paste</label><input id="cc-paste" type="text" placeholder="9.0765, 7.3986 or 32N 324000 1003700" autocomplete="off"></div>
      <div class="frow"><label for="cc-lat">Latitude</label><input id="cc-lat" type="number" step="0.000001" placeholder="9.0765"></div>
      <div class="frow"><label for="cc-lon">Longitude</label><input id="cc-lon" type="number" step="0.000001" placeholder="7.3986"></div>
      <h4>Degrees, minutes, seconds</h4>
      <div class="dmsrow"><input id="cc-latd" inputmode="decimal" aria-label="Latitude degrees"><input id="cc-latm" inputmode="decimal" aria-label="Latitude minutes"><input id="cc-lats" inputmode="decimal" aria-label="Latitude seconds"><select id="cc-lath" aria-label="Latitude hemisphere"><option>N</option><option>S</option></select></div>
      <div class="dmsrow"><input id="cc-lond" inputmode="decimal" aria-label="Longitude degrees"><input id="cc-lonm" inputmode="decimal" aria-label="Longitude minutes"><input id="cc-lons" inputmode="decimal" aria-label="Longitude seconds"><select id="cc-lonh" aria-label="Longitude hemisphere"><option>E</option><option>W</option></select></div>
      <div class="frow"><label for="cc-sys">System</label><select id="cc-sys"></select></div>
      <div id="cc-grid">
        <div class="frow"><label for="cc-e">Easting</label><input id="cc-e" type="number" step="0.1"></div>
        <div class="frow"><label for="cc-n">Northing</label><input id="cc-n" type="number" step="0.1"></div>
      </div>
      <div id="cc-minna" hidden>
        <div class="frow"><label for="cc-mlon">Minna longitude</label><input id="cc-mlon" type="number" step="0.000001"></div>
        <div class="frow"><label for="cc-mlat">Minna latitude</label><input id="cc-mlat" type="number" step="0.000001"></div>
      </div>
      <p id="cc-note" class="hint"></p>
      <p id="cc-err" class="caveat" hidden></p>
      <div class="frow act"><button type="button" class="btn" id="cc-copy">Copy</button><button type="button" class="btn" id="cc-here">Map centre</button><button type="button" class="btn" id="cc-pick">Pick on map</button><button type="button" class="btn primary" id="cc-goto">Go to</button></div>`;
    const latEl = body.querySelector('#cc-lat');
    const lonEl = body.querySelector('#cc-lon');
    const sysEl = body.querySelector('#cc-sys');
    const eastEl = body.querySelector('#cc-e');
    const northEl = body.querySelector('#cc-n');
    const gridBox = body.querySelector('#cc-grid');
    const minnaBox = body.querySelector('#cc-minna');
    const note = body.querySelector('#cc-note');
    const err = body.querySelector('#cc-err');
    const paste = body.querySelector('#cc-paste');
    fillGridSelect(sysEl, seed?.systemId || 'wgs-utm');
    let writing = false;
    function showErr(message) {
      err.hidden = !message;
      err.textContent = message || '';
    }
    function setDms(lon, lat) {
      const la = dmsParts(lat, true);
      const lo = dmsParts(lon, false);
      body.querySelector('#cc-latd').value = la.deg;
      body.querySelector('#cc-latm').value = la.min;
      body.querySelector('#cc-lats').value = la.sec;
      body.querySelector('#cc-lath').value = la.hem;
      body.querySelector('#cc-lond').value = lo.deg;
      body.querySelector('#cc-lonm').value = lo.min;
      body.querySelector('#cc-lons').value = lo.sec;
      body.querySelector('#cc-lonh').value = lo.hem;
    }
    function publish(lon, lat) {
      const problem = validateLonLat(lon, lat);
      if (problem) { showErr(problem); return false; }
      showErr('');
      writing = true;
      latEl.value = +lat.toFixed(6);
      lonEl.value = +lon.toFixed(6);
      setDms(lon, lat);
      const sys = lonLatToSystem(lon, lat, sysEl.value);
      const longlat = sys.kind === 'longlat';
      gridBox.hidden = longlat;
      minnaBox.hidden = !longlat;
      if (sys.error) showErr(sys.error);
      else if (longlat) {
        body.querySelector('#cc-mlon').value = +sys.x.toFixed(6);
        body.querySelector('#cc-mlat').value = +sys.y.toFixed(6);
      } else {
        eastEl.value = +sys.easting.toFixed(1);
        northEl.value = +sys.northing.toFixed(1);
        eastEl.readOnly = !!sys.auto;
        northEl.readOnly = !!sys.auto;
      }
      note.className = sys.caveat ? 'caveat' : 'hint';
      note.textContent = sys.caveat || (sys.auto ? `Zone ${utmZoneOf(lon, lat).label}. Pick a fixed zone to type an easting and northing.` : '');
      writing = false;
      return true;
    }
    function readDms(prefix, isLat) {
      const degRaw = body.querySelector('#cc-' + prefix + 'd').value.trim();
      if (degRaw === '') return null;
      const deg = +degRaw;
      const min = +(body.querySelector('#cc-' + prefix + 'm').value.trim() || 0);
      const sec = +(body.querySelector('#cc-' + prefix + 's').value.trim() || 0);
      const hem = body.querySelector('#cc-' + prefix + 'h').value;
      if (!Number.isFinite(deg) || !Number.isFinite(min) || !Number.isFinite(sec)) return { error: 'Enter degrees, minutes and seconds as numbers.' };
      if (min < 0 || sec < 0 || min >= 60 || sec >= 60) return { error: 'Minutes and seconds must be from 0 up to, but not including, 60.' };
      let value = Math.abs(deg) + min / 60 + sec / 3600;
      if (hem === 'S' || hem === 'W') value = -value;
      if (isLat && Math.abs(value) > 90) return { error: 'Latitude must be between −90 and 90.' };
      if (!isLat && Math.abs(value) > 180) return { error: 'Longitude must be between −180 and 180.' };
      return { value };
    }
    function onDd() {
      if (writing) return;
      if (latEl.value.trim() === '' || lonEl.value.trim() === '') { showErr(''); return; }
      publish(+lonEl.value, +latEl.value);
    }
    function onDms() {
      if (writing) return;
      const lat = readDms('lat', true);
      const lon = readDms('lon', false);
      if (!lat || !lon) return;
      if (lat.error) { showErr(lat.error); return; }
      if (lon.error) { showErr(lon.error); return; }
      publish(lon.value, lat.value);
    }
    function onGrid() {
      if (writing || eastEl.readOnly) return;
      const e = +eastEl.value;
      const n = +northEl.value;
      if (eastEl.value.trim() === '' || northEl.value.trim() === '') return;
      if (Math.abs(e) < 1000 && Math.abs(n) < 1000) return;
      const out = systemToLonLat(sysEl.value, e, n);
      if (out.error) { showErr(out.error); return; }
      publish(out.lon, out.lat);
    }
    function onMinna() {
      if (writing) return;
      const lon = +body.querySelector('#cc-mlon').value;
      const lat = +body.querySelector('#cc-mlat').value;
      if (body.querySelector('#cc-mlon').value.trim() === '' || body.querySelector('#cc-mlat').value.trim() === '') return;
      const out = systemToLonLat('4263', lon, lat);
      if (out.error) { showErr(out.error); return; }
      publish(out.lon, out.lat);
    }
    latEl.addEventListener('input', onDd);
    lonEl.addEventListener('input', onDd);
    ['lat', 'lon'].forEach((prefix) => {
      ['d', 'm', 's'].forEach((part) => body.querySelector('#cc-' + prefix + part).addEventListener('input', onDms));
      body.querySelector('#cc-' + prefix + 'h').addEventListener('change', onDms);
    });
    eastEl.addEventListener('input', onGrid);
    northEl.addEventListener('input', onGrid);
    body.querySelector('#cc-mlon').addEventListener('input', onMinna);
    body.querySelector('#cc-mlat').addEventListener('input', onMinna);
    sysEl.addEventListener('change', () => {
      if (latEl.value.trim() === '' || lonEl.value.trim() === '') {
        const spec = GRID_SYSTEMS.find((s) => s.id === sysEl.value);
        gridBox.hidden = spec?.kind === 'longlat';
        minnaBox.hidden = spec?.kind !== 'longlat';
        eastEl.readOnly = sysEl.value === 'wgs-utm';
        northEl.readOnly = sysEl.value === 'wgs-utm';
        note.className = 'hint';
        note.textContent = sysEl.value === 'wgs-utm' ? 'Type a latitude and longitude first, or pick a fixed zone to type an easting.' : '';
        return;
      }
      publish(+lonEl.value, +latEl.value);
    });
    paste.addEventListener('input', () => {
      const text = paste.value.trim();
      if (text.length < 3) return;
      const parsed = parseCoordinateText(text);
      if (parsed.error) { if (text.length > 8) showErr(parsed.error); return; }
      if (parsed.kind === 'grid') {
        fillGridSelect(sysEl, parsed.systemId);
        const out = systemToLonLat(parsed.systemId, parsed.easting, parsed.northing);
        if (out.error) { showErr(out.error); return; }
        publish(out.lon, out.lat);
        return;
      }
      publish(parsed.lon, parsed.lat);
    });
    body.querySelector('#cc-copy').onclick = () => {
      if (latEl.value.trim() === '' || lonEl.value.trim() === '') { toast('Enter a coordinate first'); return; }
      const lon = +lonEl.value;
      const lat = +latEl.value;
      const problem = validateLonLat(lon, lat);
      if (problem) { showErr(problem); toast(problem); return; }
      copyPlain(coordinatePlain(lon, lat, sysEl.value), 'Coordinates copied');
    };
    body.querySelector('#cc-here').onclick = () => {
      const [lon, lat] = map.center();
      publish(lon, lat);
    };
    body.querySelector('#cc-pick').onclick = () => {
      const systemId = sysEl.value;
      const has = latEl.value.trim() !== '' && lonEl.value.trim() !== '' && !validateLonLat(+lonEl.value, +latEl.value);
      const previous = has ? { lon: +lonEl.value, lat: +latEl.value, systemId } : { systemId };
      closeModal();
      startCoordInspect({
        once: true,
        systemId,
        hint: 'Tap the map to fill the converter.',
        onPoint(lon, lat) { toolCoordConverter({ lon, lat, systemId }); },
        onCancel() { toolCoordConverter(previous); },
      });
    };
    body.querySelector('#cc-goto').onclick = () => {
      if (latEl.value.trim() === '' || lonEl.value.trim() === '') { showErr('Enter a latitude and a longitude.'); toast('Enter a latitude and a longitude.'); return; }
      const lat = +latEl.value;
      const lon = +lonEl.value;
      const problem = validateLonLat(lon, lat);
      if (problem) { showErr(problem); toast(problem); return; }
      if (Math.abs(lat) > 85) { toast('This map cannot show a latitude past 85. The conversion above is still valid.'); return; }
      map.setView(lon, lat, Math.max(map.zoom, 8));
      closeModal();
      toast('Map moved to that point');
    };
    if (seed && Number.isFinite(seed.lon) && Number.isFinite(seed.lat)) publish(seed.lon, seed.lat);
  });
}

function stopLayerDiscovery() {
  discoveryOn = false;
  const dock = $('#discoverdock');
  if (dock) dock.hidden = true;
  updateToolState();
}
function discoveryGroup(id) {
  if (!id || id === 'other') return 'Other';
  if (id === 'imported') return catalog.groups.find((g) => g.id === id)?.label || 'Imported';
  return catalog.groups.find((g) => g.id === id)?.label || id;
}
function fitLayerQuiet(meta) {
  const b = meta?.bounds;
  if (!b || b.length < 4 || b.some((v) => !Number.isFinite(v))) { toast('No extent for ' + (meta?.label || 'that layer')); return false; }
  const mobile = mobileQ.matches;
  map.fitBounds(b, 30, mobile ? innerHeight * 0.45 : 0);
  if (!mobile) { map.cx -= 200 / map.S; map._viewChanged(); }
  return true;
}
function toolLayerDiscovery() {
  const dock = $('#discoverdock');
  if (!dock) { toast('Layer Discovery is not available'); return; }
  closeModal();
  wireSearchDocks();
  discoveryOn = true;
  const body = $('#discoverbody');
  body.innerHTML = `<p class="hint">Search a name, a description, a source or a column. Show, Hide and Zoom are separate. A catalog layer you show is saved in this browser. An imported layer is listed here too, and stays off until you show it.</p>
    <div class="frow"><label for="ld-q">Search</label><input id="ld-q" type="search" placeholder="Name, source, column…" autocomplete="off"></div>
    <p id="ld-status" class="hint" aria-live="polite"></p>
    <div id="ld-list"></div>`;
  showMapDock(dock);
  updateToolState();
  const qEl = body.querySelector('#ld-q');
  const status = body.querySelector('#ld-status');
  const list = body.querySelector('#ld-list');
  function render() {
    if (!discoveryOn) return;
    const q = qEl.value.trim().toLowerCase();
    const layers = catalog.layers.filter((m) => {
      if (!q) return true;
      const fields = (m.fields || []).map((f) => `${f.name} ${f.label || ''}`).join(' ');
      const quality = m.quality ? qualityPresentation(m).label : '';
      const meta = m.sourceMetadata || {};
      const hay = [m.label, m.id, m.kind, KIND_LABEL[m.kind], m.source, m.description, discoveryGroup(m.group), fields, quality, meta.publisher, meta.dataset, m.crsName, m.crsNote].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
    status.textContent = `${layers.length} of ${catalog.layers.length} layer${catalog.layers.length === 1 ? '' : 's'}`;
    const order = [...catalog.groups.map((g) => g.id), 'imported', 'other'];
    const buckets = new Map();
    for (const m of layers) {
      const key = order.includes(m.group) ? m.group : 'other';
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(m);
    }
    const keys = [...buckets.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    list.innerHTML = keys.map((key) => {
      const rows = buckets.get(key).map((m) => {
        const st = L.get(m.id);
        const on = !!st?.on;
        const kind = KIND_LABEL[m.kind] || m.kind;
        const qn = m.quality ? qualityPresentation(m) : null;
        const cols = q ? (m.fields || []).filter((f) => (f.label || '').toLowerCase().includes(q) || f.name.toLowerCase().includes(q)).slice(0, 3) : [];
        const desc = m.description ? (m.description.length > 140 ? m.description.slice(0, 137) + '…' : m.description) : '';
        return `<div class="ldrow">
          <div><b>${esc(m.label)}</b><small>${esc(kind)}${m.count != null ? ' · ' + esc(countText(m)) : ''} · ${esc(discoveryGroup(m.group))}${qn ? ` · <span class="quality-inline q-${qn.tone}">${esc(qn.short)}</span>` : ''}</small>
          ${desc ? `<p>${esc(desc)}</p>` : ''}
          ${cols.length ? `<p>Column: ${esc(cols.map((f) => f.label || f.name).join(', '))}</p>` : ''}
          ${m.crsNote ? caveatBox(m.crsNote) : ''}</div>
          <div class="ldacts">
            ${m.kind === 'table' ? `<button type="button" class="btn" data-ld="open" data-id="${esc(m.id)}">Open</button>` : (on ? `<button type="button" class="btn" data-ld="hide" data-id="${esc(m.id)}">Hide</button>` : `<button type="button" class="btn" data-ld="show" data-id="${esc(m.id)}">Show</button>`)}
            ${m.bounds ? `<button type="button" class="btn" data-ld="zoom" data-id="${esc(m.id)}">Zoom</button>` : ''}
          </div>
        </div>`;
      }).join('');
      return `<div class="ldgroup"><h4>${esc(discoveryGroup(key))} <span class="n">${buckets.get(key).length}</span></h4>${rows}</div>`;
    }).join('') || '<p class="empty">No matching layers. Try a name, a source, or a column.</p>';
    list.querySelectorAll('[data-ld]').forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const st = L.get(id);
        if (!st) { toast('That layer is not in this browser'); return; }
        const act = btn.dataset.ld;
        if (act === 'zoom') {
          if (fitLayerQuiet(st.meta)) toast(st.on ? 'Zoomed to ' + st.meta.label : 'Zoomed to ' + st.meta.label + '. It is still off.');
          return;
        }
        if (act === 'open') { openTable(id); toast('Opened ' + st.meta.label); return; }
        if (act === 'hide') {
          await setLayer(id, false);
          if (discoveryOn) { toast('Hidden ' + st.meta.label); render(); }
          return;
        }
        btn.disabled = true;
        btn.textContent = 'Loading…';
        await setLayer(id, true);
        if (!discoveryOn) return;
        if (L.get(id)?.on) toast('Showing ' + st.meta.label);
        render();
      };
    });
  }
  qEl.addEventListener('input', render);
  render();
  qEl.focus();
}

function wireSearchDocks() {
  const inspect = $('#inspectdock');
  if (inspect && !inspect.dataset.wired) {
    inspect.dataset.wired = '1';
    $('#inspectdone').onclick = () => stopCoordInspect('cancel');
    $('#inspectclear').onclick = () => {
      if (!coordInspect) return;
      coordInspect.point = null;
      coordInspect.under = null;
      paintInspect();
      map.render();
    };
    $('#inspectcopy').onclick = () => {
      if (!coordInspect?.point) { toast('Tap the map first'); return; }
      copyPlain(coordinatePlain(coordInspect.point[0], coordInspect.point[1], coordInspect.systemId), 'Coordinates copied');
    };
    $('#inspectgrid').onchange = () => {
      if (!coordInspect) return;
      coordInspect.systemId = $('#inspectgrid').value;
      paintInspect();
    };
    $('#inspectinfo').onclick = () => {
      const under = coordInspect?.under;
      if (!under?.feature) { toast('Nothing on at this point'); return; }
      const st = L.get(under.layer.id);
      map.selection = { feature: under.feature, layer: under.layer };
      showResults([{ layer: under.layer, feature: under.feature }]);
      openSheet('info', true);
      if (st?.obj) toast(titleOf(st.obj, under.feature));
    };
  }
  const findDone = $('#finddone');
  if (findDone && !findDone.dataset.wired) { findDone.dataset.wired = '1'; findDone.onclick = () => stopFeatureFinder(); }
  const discoverDone = $('#discoverdone');
  if (discoverDone && !discoverDone.dataset.wired) { discoverDone.dataset.wired = '1'; discoverDone.onclick = () => stopLayerDiscovery(); }
}
wireSearchDocks();


// ------------------------------------------------ view: reset, full screen, back
function resetView() {
  stopTimePlayback();
  const play = document.querySelector('#ts-play');
  if (play) play.hidden = false;
  const info = document.querySelector('#ts-info');
  if (info && timeSliderLive) info.innerHTML = '<p class="hint">The view was reset, so the time filter is off.</p>';
  if (clip) { focusLabel = ''; setFocus(null, false); }
  clearAllFilters();
  if (map.rotation) map.setRotation(0);
  home();
  renderLayerLists(); refreshLegend(); map.render();
  saveProject();
  updateToolState();
  toast('View reset — opening extent, no filters or focus. Layers and colours kept.');
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
    updateToolState();
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
    <p class="hint">In this browser only, for this visit. Nothing is drawn until you turn a layer on. Then it can be used with the other layers. Import another file with Import, next to Show all.</p>
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

// ------------------------------------------------ tool: save map picture
function toolShot() {
  if (matchMedia('(min-width:900px)').matches) toolExport({ shot: true });
  else exportMapImage();
}
function toolExport(opts = {}) {
  const shot = !!opts.shot;
  openModal(shot ? 'Save map picture' : 'Picture with title & frame', (body) => {
    const hasClip = !!clip;
    const drawnShape = draw && (draw.kind === 'rect' || draw.kind === 'square' || draw.kind === 'circle' || draw.kind === 'poly' || draw.kind === 'freehand') && draw.pts.length > 0;
    body.innerHTML = '<p class="muted">' + (shot
      ? 'Download the current map as a PNG. On this screen you can add a title, legend, scale, north arrow and grid first. The picture never shows latitude or longitude.'
      : 'Download a PNG with a title and a frame. Cartographic elements are drawn around the map, never as latitude or longitude.') + '</p>' +
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

// Temporal state: active time filter per layer. Written by the filter list, not only by these tools.
let timeFilters = {}; // layerId -> { field, min, max, op: 'range'|'before'|'after'|'exact' }
let timeAnimTimer = null;
let timeAnimPlaying = false;
let timeSliderLive = null;

function stopTimePlayback() {
  timeAnimPlaying = false;
  if (timeAnimTimer) { clearInterval(timeAnimTimer); timeAnimTimer = null; }
}

const TEMPORAL_NAME = /year|date|time/i;

function isTemporalField(field) {
  if (!field || field.type === 'text') return false;
  if (field.type === 'date') return true;
  return TEMPORAL_NAME.test(field.name || '');
}

function temporalDateFields(st) {
  return (st?.meta?.fields || []).filter(isTemporalField);
}

function temporalCoverageText(meta) {
  const raw = meta?.sourceMetadata?.temporalCoverage;
  if (raw == null || raw === '') return '';
  return String(raw);
}

function temporalCatalogRows() {
  const out = [];
  for (const meta of catalog?.layers || []) {
    if (!meta || meta.kind === 'table') continue;
    const fields = (meta.fields || []).filter(isTemporalField).map((f) => ({ name: f.name, label: f.label || f.name }));
    const coverage = temporalCoverageText(meta);
    if (!fields.length && !coverage) continue;
    out.push({ id: meta.id, meta, fields, coverage });
  }
  out.sort((a, b) => (b.fields.length - a.fields.length) || a.meta.label.localeCompare(b.meta.label));
  return out;
}

function yearNumbers(st, field) {
  const vals = [];
  for (const f of st?.obj?.features || []) {
    const raw = f.props?.[field];
    if (raw == null || raw === '') continue;
    const v = +raw;
    if (Number.isFinite(v)) vals.push(v);
  }
  return vals;
}

function distinctYears(values) {
  return [...new Set(values.map((v) => Math.round(v)))].sort((a, b) => a - b);
}

async function ensureTemporalLayer(id) {
  const st = L.get(id);
  if (!st || st.meta.kind === 'table') return null;
  if (!st.on) await setLayer(id, true);
  if (!st.on || !st.obj) return null;
  return st;
}

function temporalRule(st) {
  return filterRules(st).find((r) => r.op === '_temporal' || r.source === 'temporal') || null;
}

function clearTemporalRule(st) {
  const prev = temporalRule(st);
  if (!prev) return false;
  removeFilterRule(prev.id);
  return true;
}

function toolTemporalFilter() {
  const rows = temporalCatalogRows().filter((row) => row.fields.length);
  if (!rows.length) { toast('No catalog layer has a date or year field'); return; }
  const firstOn = rows.find((row) => L.get(row.id)?.on) || rows[0];
  openModal('Temporal Filter', (body) => {
    body.innerHTML = '<p class="hint">Keep features whose year matches. The layer turns on if it is off, and the map stays visible. This joins the filter list, so another filter on the same layer still applies. Clear removes only the time rule.</p>' +
      '<div class="frow"><label for="tf-layer">Layer</label><select id="tf-layer">' + rows.map((row) => '<option value="' + esc(row.id) + '"' + (row.id === firstOn.id ? ' selected' : '') + '>' + esc(row.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label for="tf-field">Field</label><select id="tf-field"></select></div>' +
      '<p class="hint" id="tf-span"></p>' +
      '<div class="frow"><label for="tf-op">Condition</label><select id="tf-op">' +
        '<option value="range">Between</option>' +
        '<option value="before">On or before</option>' +
        '<option value="after">On or after</option>' +
        '<option value="exact">Equals</option>' +
      '</select></div>' +
      '<div id="tf-range" class="frow"><label for="tf-min">From</label><input id="tf-min" type="number" inputmode="numeric"><label for="tf-max">To</label><input id="tf-max" type="number" inputmode="numeric"></div>' +
      '<div id="tf-single" class="frow" hidden><label for="tf-single-val">Year</label><input id="tf-single-val" type="number" inputmode="numeric"></div>' +
      '<div class="frow act"><button class="btn primary" id="tf-apply" type="button">' + icon('filter') + ' Apply filter</button><button class="btn" id="tf-clear" type="button">Clear time filter</button></div>' +
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

    const span = body.querySelector('#tf-span');
    function rowOf() { return rows.find((row) => row.id === layerSel.value) || rows[0]; }
    function pickLayer() {
      const row = rowOf();
      const cur = fieldSel.value;
      fieldSel.innerHTML = row.fields.map((f) => '<option value="' + esc(f.name) + '">' + esc(f.label) + '</option>').join('');
      if (row.fields.some((f) => f.name === cur)) fieldSel.value = cur;
      const st = L.get(row.id);
      const existing = st ? temporalRule(st) : null;
      if (existing && existing.field === fieldSel.value) {
        opSel.value = existing.temporalOp || 'range';
        minEl.value = existing.min != null && Number.isFinite(+existing.min) ? existing.min : '';
        maxEl.value = existing.max != null && Number.isFinite(+existing.max) ? existing.max : '';
        singleValEl.value = (existing.temporalOp === 'before' ? existing.max : (existing.min ?? existing.max)) ?? '';
      }
      const vals = st?.obj ? yearNumbers(st, fieldSel.value) : [];
      span.textContent = vals.length
        ? fmtNum(vals.length) + ' year values, ' + Math.floor(Math.min(...vals)) + ' to ' + Math.ceil(Math.max(...vals)) + '.'
        : (st?.on ? 'That field has no year numbers.' : 'Apply turns the layer on and reads its years.');
      updateRangeUI();
    }
    function updateRangeUI() {
      const isRange = opSel.value === 'range';
      rangeDiv.hidden = !isRange;
      singleDiv.hidden = isRange;
      singleValEl.placeholder = opSel.value === 'before' ? 'On or before' : (opSel.value === 'after' ? 'On or after' : 'Year');
    }
    layerSel.onchange = () => { minEl.value = ''; maxEl.value = ''; singleValEl.value = ''; pickLayer(); };
    fieldSel.onchange = () => { minEl.value = ''; maxEl.value = ''; singleValEl.value = ''; pickLayer(); };
    opSel.onchange = updateRangeUI;
    pickLayer();

    body.querySelector('#tf-apply').onclick = async () => {
      const row = rowOf();
      const field = fieldSel.value;
      const op = opSel.value;
      const minV = minEl.value !== '' ? +minEl.value : null;
      const maxV = maxEl.value !== '' ? +maxEl.value : null;
      const singleV = singleValEl.value !== '' ? +singleValEl.value : null;
      if (!field) { toast('Pick a field'); return; }
      if (op === 'range' && (minV == null || maxV == null || !Number.isFinite(minV) || !Number.isFinite(maxV))) { toast('Enter both years'); return; }
      if (op === 'range' && minV > maxV) { toast('From is after To'); return; }
      if (op !== 'range' && (singleV == null || !Number.isFinite(singleV))) { toast('Enter a year'); return; }
      const btn = body.querySelector('#tf-apply');
      btn.disabled = true;
      const st = await ensureTemporalLayer(row.id);
      btn.disabled = false;
      if (!body.querySelector('#tf-apply') || !st) { if (!st) toast('Could not turn on ' + row.meta.label); return; }
      if (!yearNumbers(st, field).length) { toast(row.meta.label + ' has no year numbers in ' + field); pickLayer(); return; }
      const min = op === 'range' ? minV : (op === 'after' || op === 'exact' ? singleV : null);
      const max = op === 'range' ? maxV : (op === 'before' || op === 'exact' ? singleV : (op === 'after' ? singleV : singleV));
      timeFilters[row.id] = { field, op, min, max };
      applyTemporalFilter(st);
      const shown = st.filterCount ?? st.obj.features.length;
      infoDiv.innerHTML = '<p>' + esc(row.meta.label) + ': ' + fmtNum(shown) + ' of ' + fmtNum(st.obj.features.length) + ' match.</p>';
      toast(row.meta.label + ': ' + fmtNum(shown) + ' of ' + fmtNum(st.obj.features.length));
      pickLayer();
    };
    body.querySelector('#tf-clear').onclick = () => {
      const row = rowOf();
      const st = L.get(row.id);
      if (!st?.obj || !clearTemporalRule(st)) { toast('No time filter on ' + row.meta.label); return; }
      minEl.value = ''; maxEl.value = ''; singleValEl.value = '';
      infoDiv.innerHTML = '';
      toast('Time filter cleared on ' + row.meta.label);
      pickLayer();
    };
  }, { map: true });
}

function applyTemporalFilter(st) {
  const tf = timeFilters[st.meta.id];
  const prev = filterRules(st).find((r) => r.op === '_temporal' || r.source === 'temporal');
  if (!tf) {
    if (prev) removeFilterRule(prev.id);
    else applyFilter(st);
    return;
  }
  upsertFilterRule(st.meta.id, {
    id: prev?.id,
    field: tf.field,
    op: '_temporal',
    temporalOp: tf.op,
    min: tf.min,
    max: tf.max,
    source: 'temporal',
  });
}

function toolTemporalLayers() {
  const rows = temporalCatalogRows();
  if (!rows.length) { toast('No catalog layer records a year field or a source time period'); return; }
  const withField = rows.filter((row) => row.fields.length).length;
  openModal('Temporal Layers', (body) => {
    body.innerHTML = '<p class="hint">' + fmtNum(withField) + ' layers have a date or year field the filter and slider can use. ' + fmtNum(rows.length - withField) + ' more only record a source time period — that note is not a field, so it cannot be scrubbed.</p>' +
      '<div class="frow"><label for="tl-q">Find</label><input id="tl-q" placeholder="Name or group"></div>' +
      '<div class="scroll" id="tl-list" style="max-height:46vh"></div>';
    const listDiv = body.querySelector('#tl-list');
    const qEl = body.querySelector('#tl-q');
    function renderList() {
      const q = qEl.value.trim().toLowerCase();
      const list = rows.filter((row) => !q || (row.meta.label + ' ' + row.meta.group + ' ' + row.coverage).toLowerCase().includes(q));
      listDiv.innerHTML = list.map((row) => {
        const on = !!L.get(row.id)?.on;
        const note = row.fields.length ? row.fields.map((f) => f.label).join(', ') : 'Source period only';
        return '<div class="lrow" data-id="' + esc(row.id) + '"><div class="lmain"><b>' + esc(row.meta.label) + '</b><small>' + esc(row.meta.group) + ' · ' + esc(note) + (row.coverage ? ' · ' + esc(row.coverage) : '') + '</small></div>' +
          '<div class="lacts"><button type="button" data-act="' + (on ? 'off' : 'on') + '">' + (on ? 'Hide' : 'Show') + '</button><button type="button" data-act="zoom">Zoom</button></div></div>';
      }).join('') || '<p class="empty">No match.</p>';
    }
    qEl.oninput = renderList;
    listDiv.onclick = async (ev) => {
      const btn = ev.target.closest('button[data-act]');
      const rowEl = ev.target.closest('.lrow');
      if (!btn || !rowEl) return;
      const row = rows.find((item) => item.id === rowEl.dataset.id);
      if (!row) return;
      if (btn.dataset.act === 'zoom') {
        const st = L.get(row.id);
        if (!st?.on || !st.obj) { toast('Show ' + row.meta.label + ' before zooming to it'); return; }
        map.fit(st.obj.bounds, 48);
        toast('Zoomed to ' + row.meta.label);
        return;
      }
      btn.disabled = true;
      if (btn.dataset.act === 'on') {
        await setLayer(row.id, true);
        btn.disabled = false;
        if (!body.querySelector('#tl-list') || !L.get(row.id)?.on) return;
        toast('Turned on ' + row.meta.label);
      } else {
        await setLayer(row.id, false);
        btn.disabled = false;
        if (!body.querySelector('#tl-list')) return;
        toast('Turned off ' + row.meta.label);
      }
      renderList();
    };
    renderList();
  }, { map: true });
}

function toolTimeSlider() {
  stopTimePlayback();
  const rows = temporalCatalogRows().filter((row) => row.fields.length);
  if (!rows.length) { toast('No catalog layer has a date or year field'); return; }
  const firstOn = rows.find((row) => L.get(row.id)?.on) || rows[0];
  const live = { id: '', field: '', years: [] };
  timeSliderLive = live;
  openModal('Time Slider', (body) => {
    body.innerHTML = '<p class="hint">Show one year at a time. The layer turns on if it is off. Play steps through years that exist, not empty years in between. Stop removes the time filter and shows the features again. Closing this panel stops playback and leaves the filter in place.</p>' +
      '<div class="frow"><label for="ts-layer">Layer</label><select id="ts-layer">' + rows.map((row) => '<option value="' + esc(row.id) + '"' + (row.id === firstOn.id ? ' selected' : '') + '>' + esc(row.meta.label) + '</option>').join('') + '</select></div>' +
      '<div class="frow"><label for="ts-field">Field</label><select id="ts-field"></select></div>' +
      '<p class="hint" id="ts-span">Move the slider or press Play to read the years.</p>' +
      '<div class="frow"><label>Year <b id="ts-year-val">—</b></label><input id="ts-year" type="range" min="0" max="1" value="0" step="1" disabled></div>' +
      '<div class="frow act"><button class="btn" id="ts-play" type="button">' + icon('timer') + ' Play</button><button class="btn" id="ts-stop" type="button">Stop</button></div>' +
      '<div id="ts-info" style="margin-top:10px"></div>';
    const layerSel = body.querySelector('#ts-layer');
    const fieldSel = body.querySelector('#ts-field');
    const yearInput = body.querySelector('#ts-year');
    const yearVal = body.querySelector('#ts-year-val');
    const infoDiv = body.querySelector('#ts-info');
    const playBtn = body.querySelector('#ts-play');
    const stopBtn = body.querySelector('#ts-stop');
    const span = body.querySelector('#ts-span');

    function fillFields() {
      const row = rows.find((item) => item.id === layerSel.value) || rows[0];
      const cur = fieldSel.value;
      fieldSel.innerHTML = row.fields.map((f) => '<option value="' + esc(f.name) + '">' + esc(f.label) + '</option>').join('');
      if (row.fields.some((f) => f.name === cur)) fieldSel.value = cur;
    }
    function arm(st) {
      const years = distinctYears(yearNumbers(st, fieldSel.value));
      if (!years.length) {
        live.years = [];
        yearInput.disabled = true;
        playBtn.disabled = true;
        span.textContent = 'That field has no year numbers.';
        return false;
      }
      live.id = st.meta.id;
      live.field = fieldSel.value;
      live.years = years;
      yearInput.min = String(years[0]);
      yearInput.max = String(years[years.length - 1]);
      yearInput.disabled = false;
      playBtn.disabled = years.length < 2;
      if (+yearInput.value < years[0] || +yearInput.value > years[years.length - 1]) yearInput.value = String(years[0]);
      yearVal.textContent = yearInput.value;
      span.textContent = fmtNum(yearNumbers(st, fieldSel.value).length) + ' values, ' + fmtNum(years.length) + ' distinct years, ' + years[0] + ' to ' + years[years.length - 1] + '.';
      return true;
    }
    async function ensure() {
      const st = await ensureTemporalLayer(layerSel.value);
      if (!body.querySelector('#ts-year')) return null;
      if (!st) { toast('Could not turn on that layer'); return null; }
      if (live.id !== st.meta.id || live.field !== fieldSel.value || !live.years.length) {
        if (!arm(st)) { toast(st.meta.label + ' has no year numbers in that field'); return null; }
      }
      return st;
    }
    function showYear(year, snap) {
      const st = L.get(live.id);
      if (!st?.obj || !live.field) return;
      const shown = snap && live.years.length && !live.years.includes(year) ? live.years.find((y) => y >= year) || live.years[0] : year;
      yearInput.value = String(shown);
      yearVal.textContent = String(shown);
      timeFilters[live.id] = { field: live.field, op: 'exact', min: shown, max: shown };
      applyTemporalFilter(st);
      const count = st.filterCount ?? 0;
      infoDiv.innerHTML = '<p>' + fmtNum(count) + ' feature' + (count === 1 ? '' : 's') + ' in ' + shown + '.</p>';
    }
    layerSel.onchange = () => { stopTimePlayback(); playBtn.hidden = false; playBtn.disabled = false; fillFields(); live.years = []; span.textContent = 'Move the slider or press Play to read the years.'; yearInput.disabled = true; };
    fieldSel.onchange = () => { stopTimePlayback(); playBtn.hidden = false; playBtn.disabled = false; live.years = []; span.textContent = 'Move the slider or press Play to read the years.'; yearInput.disabled = true; };
    yearInput.oninput = async () => {
      stopTimePlayback();
      playBtn.hidden = false;
      const year = +yearInput.value;
      if (!(await ensure())) return;
      showYear(year);
    };
    playBtn.onclick = async () => {
      if (timeAnimPlaying) return;
      if (!(await ensure())) return;
      if (live.years.length < 2) { toast('Only one year to show'); return; }
      timeAnimPlaying = true;
      playBtn.hidden = true;
      const step = () => {
        if (!body.querySelector('#ts-year') || timeSliderLive !== live) { stopTimePlayback(); return; }
        const cur = live.years.indexOf(+yearInput.value);
        showYear(live.years[(cur + 1) % live.years.length], true);
      };
      step();
      timeAnimTimer = setInterval(step, 700);
    };
    stopBtn.onclick = () => {
      stopTimePlayback();
      playBtn.hidden = false;
      const st = L.get(layerSel.value);
      if (st?.obj && clearTemporalRule(st)) toast('Time filter cleared on ' + st.meta.label);
      else toast('No time filter to clear');
      live.years = [];
      infoDiv.innerHTML = '';
    };
    fillFields();
  }, () => { stopTimePlayback(); if (timeSliderLive === live) timeSliderLive = null; }, { map: true });
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
  let shown = 300, q = '', mapFilterActive = false, sortCol = -1, sortDir = 1;
  const textFields = (m.fields || []).filter((f) => f.type === 'text');
  const labelField = m.labelField || (textFields[0] && textFields[0].name);
  const features = m.kind === 'raster' || m.kind === 'table' || m.kind === 'image' ? null : st.obj.features;
  const draw = () => {
    const colVis = getColVis(id);
    const visCols = cols.filter((c) => !isCoordinateKey(c) && (colVis ? colVis[c] !== false : true));
    const visColIdx = cols.map((c, i) => [c, i]).filter(([c]) => visCols.includes(c)).map(([, i]) => i);
    const matched = [];
    rows.forEach((r, i) => {
      if (!q || r.some((v) => String(v).toLowerCase().includes(q))) matched.push(i);
    });
    if (sortCol >= 0) {
      const ci = visColIdx[sortCol];
      matched.sort((a, b) => {
        const av = rows[a][ci], bv = rows[b][ci];
        const an = Number(av), bn = Number(bv);
        const cmp = Number.isFinite(an) && Number.isFinite(bn) ? an - bn : String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true });
        return cmp * sortDir;
      });
    }
    const filt = matched.map((i) => rows[i]);
    const mapBtn = mapFilterActive
      ? '<button class="btn" id="tm-mapoff">' + icon('eyeoff') + ' Show all on map</button>'
      : (filt.length && filt.length < rows.length && labelField
        ? '<button class="btn primary" id="tm-mapon">' + icon('crop') + ' Show only ' + filt.length + ' matching row' + (filt.length === 1 ? '' : 's') + ' on map</button>'
        : '');
    $('#tm-body').innerHTML = '<div class="table-exports">' + exportButton('CSV', 'Download these rows — no coordinates') + exportButton('JSON', 'Download as JSON — no coordinates') + '</div>' +
      '<table><thead><tr>' + visCols.map((c, j) => '<th data-sort="' + j + '" title="Sort by this column">' + esc(labels[c] || extra[c] || c.replace(/_/g, ' ')) + (sortCol === j ? (sortDir < 0 ? ' ↓' : ' ↑') : '') + '</th>').join('') + '</tr></thead><tbody>' + matched.slice(0, shown).map((ri) => '<tr data-row="' + ri + '" title="Show this feature on the map">' + visColIdx.map((i) => '<td title="' + esc(rows[ri][i]) + '">' + esc(typeof rows[ri][i] === 'number' ? fmtNum(rows[ri][i]) : rows[ri][i]) + '</td>').join('') + '</tr>').join('') + '</tbody></table>' +
      '<div class="muted" style="padding:8px 12px;display:flex;justify-content:space-between;align-items:center">' + filt.length.toLocaleString() + ' rows' + (filt.length > shown ? ' (showing ' + shown + ')' : '') + (features ? ' · tap a row to locate it' : '') + (mapBtn ? ' <span style="font-size:11px;color:var(--muted)">·</span> ' + mapBtn : '') + '</div>' +
      (filt.length > shown ? '<button class="more">Show more</button>' : '');
    const tableRows = () => filt.map((r) => {
      const row = { layer: m.label };
      visCols.forEach((c, j) => { row[labels[c] || extra[c] || c] = r[visColIdx[j]]; });
      return row;
    });
    const exp = $('#tm-body .table-exports');
    if (exp) {
      const [csvBtn, jsonBtn] = exp.querySelectorAll('[data-export]');
      if (csvBtn) csvBtn.onclick = () => exportRows(`${m.id}-table.csv`, tableRows()) && toast('Table saved — coordinates excluded');
      if (jsonBtn) jsonBtn.onclick = () => exportJson(`${m.id}-table.json`, { layer: m.label, rows: tableRows() }) && toast('Table JSON saved — coordinates excluded');
    }
    const mb = $('#tm-body .more'); if (mb) mb.onclick = () => { shown += 400; draw(); };
    $('#tm-body').querySelectorAll('th[data-sort]').forEach((th) => {
      th.style.cursor = 'pointer';
      th.onclick = () => {
        const j = +th.dataset.sort;
        sortDir = sortCol === j ? -sortDir : 1;
        sortCol = j;
        draw();
      };
    });
    $('#tm-body').querySelectorAll('tr[data-row]').forEach((tr) => {
      tr.style.cursor = features ? 'pointer' : '';
      tr.onclick = () => {
        const f = features?.[+tr.dataset.row];
        if (!f?.bb) return;
        if (!st.on) setLayer(st.meta.id, true);
        selClear(false);
        selState.ids.add(selKey(st.meta.id, f));
        selState.last = { layer: st.meta.id, feature: f };
        selSyncMap();
        map.fitBounds([unX(f.bb[0]), unY(f.bb[3]), unX(f.bb[2]), unY(f.bb[1])], 60);
        toast('Showing ' + titleOf(st.obj, f));
      };
    });
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
function toolColManage(preferred) {
  openModal('Column Manager', (body) => {
    const holder = document.createElement('div');
    body.appendChild(holder);
    layerPicker(body, () => draw(), (st) => (st.meta.fields || []).length || (st.meta.attributes || []).length, preferred);
    function draw() {
      const st = L.get(body.querySelector('select').value);
      if (!st) { holder.innerHTML = '<p class="empty">No layer with columns.</p>'; return; }
      const cols = (st.meta.fields || []).map((f) => f.name);
      const extra = (st.meta.attributes || []).map((a) => a.name).filter((n) => !cols.includes(n));
      const all = [...cols, ...extra];
      const vis = getColVis(st.meta.id) || {};
      const labels = Object.fromEntries([...(st.meta.fields || []), ...(st.meta.attributes || [])].map((f) => [f.name, f.label || f.name]));
      holder.innerHTML = `<p class="hint">Tick the columns the attribute table should show. A hidden column is still used for filters and colours.</p>
        <div id="cm-cols" style="max-height:300px;overflow-y:auto;border:1px solid var(--line);border-radius:6px;padding:8px">
          ${all.map((c) => `<label style="display:flex;align-items:center;gap:8px;padding:4px 0"><input type="checkbox" data-col="${esc(c)}"${vis[c] === false ? '' : ' checked'}><b>${esc(labels[c] || c)}</b></label>`).join('') || '<p class="empty">This layer has no columns.</p>'}
        </div>
        <div class="frow act"><button class="btn primary" id="cm-apply" type="button">${icon('view')} Apply to table</button></div>`;
      holder.querySelector('#cm-apply').onclick = () => {
        const next = {};
        holder.querySelectorAll('input[data-col]').forEach((cb) => { next[cb.dataset.col] = cb.checked; });
        if (all.length && !Object.values(next).some(Boolean)) { toast('Keep at least one column visible'); return; }
        setColVis(st.meta.id, next);
        if (!$('#tablemodal').hidden) openTable(st.meta.id);
        toast('Table columns updated for ' + st.meta.label);
      };
    }
    draw();
  }, { map: true });
}

// ---- Select by Attribute tool ----
function attrMatch(value, op, raw) {
  const vals = op === 'in' ? String(raw).split(',').map((v) => v.trim()).filter(Boolean) : [String(raw).trim()];
  if (!vals.length) return false;
  const text = value == null ? '' : String(value);
  const num = Number(value);
  const want = Number(vals[0]);
  if (op === '=') return text === vals[0] || (Number.isFinite(num) && Number.isFinite(want) && num === want);
  if (op === '!=') return !(text === vals[0] || (Number.isFinite(num) && Number.isFinite(want) && num === want));
  if (!Number.isFinite(num) || !Number.isFinite(want)) return false;
  if (op === '>') return num > want;
  if (op === '<') return num < want;
  if (op === '>=') return num >= want;
  if (op === '<=') return num <= want;
  if (op === 'like') return text.toLowerCase().includes(vals[0].toLowerCase());
  if (op === 'in') return vals.some((x) => text === x || (Number.isFinite(num) && Number(x) === num));
  return false;
}
function selectByAttribute(st, field, op, raw) {
  const hits = dataFeatures(st).filter((f) => attrMatch(f.props?.[field], op, raw));
  selClear(false);
  for (const f of hits) selState.ids.add(selKey(st.meta.id, f));
  selState.last = hits.length ? { layer: st.meta.id, feature: hits[hits.length - 1] } : null;
  selSyncMap();
  return hits;
}
function toolSelectAttr() {
  openModal('Select by Attribute', (body) => {
    const holder = document.createElement('div');
    body.appendChild(holder);
    const picker = layerPicker(body, () => fill(), (st) => ['polygon', 'line', 'point'].includes(st.meta.kind) && (st.meta.fields || []).length);
    function fill() {
      const st = L.get(picker.select.value);
      holder.innerHTML = `<p class="hint">Matches features by a column, without tapping the map. Matches are highlighted. The source is not changed.</p>
        <div class="frow"><label>Field</label><select id="sa-field">${st ? fieldOptions(st) : ''}</select></div>
        <div class="frow"><label>Condition</label><select id="sa-op">
          <option value="=">equals</option>
          <option value="!=">does not equal</option>
          <option value=">">greater than</option>
          <option value="<">less than</option>
          <option value=">=">greater or equal</option>
          <option value="<=">less or equal</option>
          <option value="like">contains</option>
          <option value="in">one of (comma separated)</option>
        </select></div>
        <div class="frow"><label>Value</label><input id="sa-value" type="text" placeholder="e.g. 5 or Forest"></div>
        <div class="frow act"><button class="btn primary" id="sa-run" type="button">${icon('query')} Apply</button></div>
        <div id="sa-result"></div>`;
      const result = holder.querySelector('#sa-result');
      holder.querySelector('#sa-op').onchange = () => {
        holder.querySelector('#sa-value').placeholder = holder.querySelector('#sa-op').value === 'in' ? 'A, B, C' : 'e.g. 5 or Forest';
      };
      holder.querySelector('#sa-run').onclick = async () => {
        const layer = L.get(picker.select.value);
        const field = holder.querySelector('#sa-field').value;
        const op = holder.querySelector('#sa-op').value;
        const raw = holder.querySelector('#sa-value').value.trim();
        if (!layer || !field || !raw) { result.innerHTML = '<p class="empty">Pick a field and enter a value.</p>'; return; }
        if (!layer.obj) { result.innerHTML = '<p class="hint">Loading…</p>'; await loadLayer(layer); if (!result.isConnected) return; }
        if (!layer.on) await setLayer(layer.meta.id, true);
        const hits = selectByAttribute(layer, field, op, raw);
        if (!result.isConnected) return;
        result.innerHTML = `<p><b>${fmtNum(hits.length)}</b> feature${hits.length === 1 ? '' : 's'} highlighted on ${esc(layer.meta.label)}.</p>
          <div class="frow act"><button class="btn" id="sa-clear" type="button">${icon('eyeoff')} Clear selection</button></div>`;
        holder.querySelector('#sa-clear').onclick = () => { selClear(true); result.innerHTML = ''; };
      };
    }
    fill();
  }, { map: true });
}

// ---- Field Calculator tool ----
function compileFieldExpr(src, names) {
  const s = String(src || '').trim();
  if (!s) throw new Error('Write an expression that uses a field name.');
  const known = new Set(names || []);
  let i = 0;
  const skip = () => { while (s[i] === ' ' || s[i] === '\t') i++; };
  const ident = () => {
    const start = i;
    while (i < s.length && /[A-Za-z0-9_]/.test(s[i])) i++;
    return s.slice(start, i);
  };
  function parseAdd() {
    let left = parseMul();
    skip();
    while (s[i] === '+' || s[i] === '-') {
      const op = s[i++];
      const right = parseMul();
      const a = left, b = right;
      left = (row) => op === '+' ? a(row) + b(row) : a(row) - b(row);
      skip();
    }
    return left;
  }
  function parseMul() {
    let left = parseUnary();
    skip();
    while (s[i] === '*' || s[i] === '/') {
      const op = s[i++];
      const right = parseUnary();
      const a = left, b = right;
      left = (row) => op === '*' ? a(row) * b(row) : a(row) / b(row);
      skip();
    }
    return left;
  }
  function parseUnary() {
    skip();
    if (s[i] === '-') { i++; const inner = parseUnary(); return (row) => -inner(row); }
    if (s[i] === '+') { i++; return parseUnary(); }
    return parsePrimary();
  }
  function parsePrimary() {
    skip();
    if (s[i] === '(') {
      i++;
      const inner = parseAdd();
      skip();
      if (s[i] !== ')') throw new Error('A bracket is missing.');
      i++;
      return inner;
    }
    if (/[0-9.]/.test(s[i] || '')) {
      const start = i;
      while (i < s.length && /[0-9.]/.test(s[i])) i++;
      const n = Number(s.slice(start, i));
      if (!Number.isFinite(n)) throw new Error('That number is not usable.');
      return () => n;
    }
    if (!/[A-Za-z_]/.test(s[i] || '')) throw new Error('The expression uses something that is not a field or a number.');
    const name = ident();
    skip();
    if (s[i] === '(') {
      const fn = { abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil, sqrt: Math.sqrt, min: Math.min, max: Math.max }[name.toLowerCase()];
      if (!fn) throw new Error(name + ' is not a field or a supported function.');
      i++;
      const args = [];
      skip();
      if (s[i] !== ')') {
        args.push(parseAdd());
        skip();
        while (s[i] === ',') { i++; args.push(parseAdd()); skip(); }
      }
      if (s[i] !== ')') throw new Error(name + ' is missing a closing bracket.');
      i++;
      if (name.toLowerCase() === 'min' || name.toLowerCase() === 'max') {
        if (args.length < 2) throw new Error(name + ' needs two values.');
        return (row) => fn(...args.map((a) => a(row)));
      }
      if (args.length !== 1) throw new Error(name + ' needs one value.');
      return (row) => fn(args[0](row));
    }
    if (!known.has(name)) throw new Error(name + ' is not a column on this layer.');
    return (row) => Number(row[name]);
  }
  const calc = parseAdd();
  skip();
  if (i < s.length) throw new Error('The expression could not be read past "' + s.slice(i, i + 12) + '".');
  return calc;
}
function applyFieldCalc(st, name, expr) {
  const fields = (st.meta.fields || []).map((f) => f.name);
  const calc = compileFieldExpr(expr, fields);
  let wrote = 0, blank = 0;
  for (const f of st.obj.features) {
    const val = calc(f.props || {});
    if (typeof val === 'number' && Number.isFinite(val)) { f.props[name] = +val.toFixed(6); wrote++; }
    else { f.props[name] = null; blank++; }
  }
  if (!st.meta.fields.some((f) => f.name === name)) st.meta.fields.push({ name, label: name, type: 'number' });
  st.rank = null;
  st.stats = null;
  return { wrote, blank };
}
function toolFieldCalc() {
  openModal('Field Calculator', (body) => {
    const holder = document.createElement('div');
    body.appendChild(holder);
    const picker = layerPicker(body, () => fill(), (st) => ['polygon', 'line', 'point'].includes(st.meta.kind) && (st.meta.fields || []).length);
    function fill() {
      const st = L.get(picker.select.value);
      const names = (st?.meta.fields || []).map((f) => f.name).join(', ');
      holder.innerHTML = `<p class="hint">Adds a column to what you see. The source file is not edited. Use field names, numbers, + − * /, and abs, round, floor, ceil, sqrt, min, max.</p>
        <div class="frow"><label>New column</label><input id="fc-name" type="text" placeholder="e.g. yield_per_km"></div>
        <div class="frow"><label>Expression</label><input id="fc-expr" type="text" placeholder="e.g. POP * 1000 / AREA"></div>
        <p class="hint">Columns: ${esc(names || 'none')}</p>
        <div class="frow act"><button class="btn primary" id="fc-run" type="button">${icon('calc')} Apply</button></div>
        <div id="fc-result"></div>`;
      const result = holder.querySelector('#fc-result');
      holder.querySelector('#fc-run').onclick = async () => {
        const layer = L.get(picker.select.value);
        const fname = holder.querySelector('#fc-name').value.trim();
        const expr = holder.querySelector('#fc-expr').value.trim();
        if (!layer) { result.innerHTML = '<p class="empty">Pick a layer.</p>'; return; }
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(fname)) { result.innerHTML = '<p class="empty">Name the column with letters, numbers and underscore.</p>'; return; }
        if (!layer.obj) { result.innerHTML = '<p class="hint">Loading…</p>'; await loadLayer(layer); if (!result.isConnected) return; }
        let summary;
        try { summary = applyFieldCalc(layer, fname, expr); }
        catch (error) { result.innerHTML = '<p class="empty">' + esc(error.message || 'That expression could not be used.') + '</p>'; return; }
        if (!result.isConnected) return;
        result.innerHTML = `<p><b>${fmtNum(summary.wrote)}</b> feature${summary.wrote === 1 ? '' : 's'} now have <b>${esc(fname)}</b>${summary.blank ? '. ' + fmtNum(summary.blank) + ' had no usable number and were left blank.' : '.'}</p>
          <p class="hint">Open the attribute table or Compare fields. The new column is there. The source file is unchanged.</p>
          <div class="frow act"><button class="btn" id="fc-clear" type="button">${icon('trash')} Remove column</button></div>`;
        holder.querySelector('#fc-clear').onclick = () => {
          for (const f of layer.obj.features) delete f.props[fname];
          layer.meta.fields = layer.meta.fields.filter((f) => f.name !== fname);
          result.innerHTML = '<p class="hint">Column removed from this visit. The source file was not changed.</p>';
        };
      };
    }
    fill();
  }, { map: true });
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
    const r = h.get('r'); if (r != null && Number.isFinite(+r)) o.r = ((+r % 360) + 360) % 360;
  } catch { }
  return o;
}
function pushHash() {
  if (!catalog || booting) return;
  const [lo, la] = map.center();
  const listed = stack.filter((id) => L.get(id)?.meta?.group !== 'imported');
  let h = `c=${la.toFixed(4)},${lo.toFixed(4)},${map.zoom.toFixed(2)}&l=${listed.join(',')}&b=${map.basemap}`;
  if (map.rotation) h += `&r=${Math.round(map.rotation)}`;
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
  const url = buildShareUrl();
  try {
    if (navigator.share) { await navigator.share({ title: catalog.title, url }); return; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  if (await copyText(url)) toast('Link copied');
  else toast('Could not copy the link');
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
let screenReaderOn = false;

function a11yApplyStyles() {
  const root = document.documentElement;
  root.style.setProperty('--a11y-scale', String(a11yTextScale));
  document.body.classList.toggle('a11y-hc', a11yHighContrast);
  root.classList.toggle('a11y-reduce-motion', a11yReducedMotion);
  try {
    localStorage.setItem('nwg.a11y', JSON.stringify({ hc: a11yHighContrast, scale: a11yTextScale, motion: a11yReducedMotion }));
  } catch { /* private mode: the change still applies for this visit */ }
}

function a11ySet({ hc, scale, motion }, say) {
  if (hc != null) a11yHighContrast = !!hc;
  if (scale != null) a11yTextScale = Math.min(2, Math.max(1, +scale || 1));
  if (motion != null) a11yReducedMotion = !!motion;
  a11yApplyStyles();
  if (say) {
    const parts = [];
    if (hc != null) parts.push(a11yHighContrast ? 'high contrast on' : 'high contrast off');
    if (scale != null) parts.push('text ' + Math.round(a11yTextScale * 100) + '%');
    if (motion != null) parts.push(a11yReducedMotion ? 'reduced motion on' : 'reduced motion off');
    announce(parts.join(', ') || 'Accessibility updated');
  }
}

function toolA11y() {
  openModal('Accessibility', (body) => {
    body.innerHTML = '<p class="hint">Changes apply as you move them, and this browser keeps them for the next visit. Reduced motion shortens the panel and button animations. The browser’s own reduced-motion setting is still respected.</p>' +
      '<div class="frow"><label for="a11y-hc">High contrast</label><input type="checkbox" id="a11y-hc" role="switch"' + (a11yHighContrast ? ' checked' : '') + '></div>' +
      '<div class="frow"><label for="a11y-scale">Text size</label><input id="a11y-scale" type="range" min="1" max="2" step="0.1" value="' + a11yTextScale + '"><b id="a11y-scale-val">' + Math.round(a11yTextScale * 100) + '%</b></div>' +
      '<div class="frow"><label for="a11y-motion">Reduce motion</label><input type="checkbox" id="a11y-motion" role="switch"' + (a11yReducedMotion ? ' checked' : '') + '></div>' +
      '<div class="frow act"><button class="btn" id="a11y-reset" type="button">Reset</button></div>';
    const hcEl = body.querySelector('#a11y-hc');
    const scaleEl = body.querySelector('#a11y-scale');
    const scaleVal = body.querySelector('#a11y-scale-val');
    const motionEl = body.querySelector('#a11y-motion');
    hcEl.onchange = () => a11ySet({ hc: hcEl.checked }, true);
    motionEl.onchange = () => a11ySet({ motion: motionEl.checked }, true);
    scaleEl.oninput = () => {
      scaleVal.textContent = Math.round(+scaleEl.value * 100) + '%';
      a11ySet({ scale: +scaleEl.value }, false);
    };
    scaleEl.onchange = () => a11ySet({ scale: +scaleEl.value }, true);
    body.querySelector('#a11y-reset').onclick = () => {
      a11ySet({ hc: false, scale: 1, motion: false }, true);
      hcEl.checked = false;
      motionEl.checked = false;
      scaleEl.value = '1';
      scaleVal.textContent = '100%';
      toast('Accessibility reset');
    };
  });
}

function toolGestures() {
  const narrow = mobileQ.matches;
  const touch = navigator.maxTouchPoints > 0;
  const where = touch ? 'This device reports a touch screen, so these gestures work here.' : 'This device does not report a touch screen. The same moves work with a mouse: drag, scroll to zoom, double-click to zoom in.';
  openModal('Gesture Guide', (body) => {
    const row = (name, does) => '<div style="padding:8px;border:1px solid var(--line);border-radius:10px;background:var(--panel2)"><b>' + name + '</b><span style="float:right;color:var(--muted)">' + does + '</span></div>';
    body.innerHTML = '<p class="hint">' + where + (narrow ? ' The panel is the bottom sheet on this width.' : ' On a phone the panel is a bottom sheet; here it is the side panel.') + '</p>' +
      '<div style="display:grid;gap:10px">' +
      row('Drag with one finger', 'Pan the map') +
      row('Pinch with two fingers', 'Zoom in or out') +
      row('Double-tap', 'Zoom in one level') +
      row('Tap a feature', 'Open its details') +
      row('Search, location, share, home', 'The round buttons at the top right') +
      row(narrow ? 'Pull up the bottom sheet' : 'Open the side panel', 'Layers, legend and tools') +
      '</div>' +
      '<div class="frow act"><button class="btn" id="gestures-ok" type="button">Got it</button></div>';
    body.querySelector('#gestures-ok').onclick = () => closeModal();
  });
}

function ensureScreenReaderLive() {
  if (screenReaderLive) return screenReaderLive;
  screenReaderLive = document.createElement('div');
  screenReaderLive.id = 'sr-live';
  screenReaderLive.setAttribute('aria-live', 'polite');
  screenReaderLive.setAttribute('aria-atomic', 'true');
  screenReaderLive.className = 'sr-only';
  document.body.appendChild(screenReaderLive);
  return screenReaderLive;
}

function announce(msg) {
  if (!screenReaderOn || !msg) return;
  const live = ensureScreenReaderLive();
  live.textContent = '';
  setTimeout(() => { if (screenReaderOn) live.textContent = String(msg); }, 30);
}

function screenReaderLabels(on) {
  const canvas = $('#map');
  if (!canvas) return;
  if (!on) {
    canvas.setAttribute('aria-label', 'Map');
    return;
  }
  const labels = stack.map((id) => L.get(id)?.meta?.label).filter(Boolean);
  canvas.setAttribute('aria-label', labels.length ? 'Map. On: ' + labels.join(', ') : 'Map. No layers on.');
}

function toolScreenReader() {
  ensureScreenReaderLive();
  openModal('Screen Reader', (body) => {
    const paint = () => {
      const btn = body.querySelector('#sr-toggle');
      if (!btn) return;
      btn.classList.toggle('primary', screenReaderOn);
      btn.textContent = screenReaderOn ? 'Turn off live announcements' : 'Turn on live announcements';
      body.querySelector('#sr-state').textContent = screenReaderOn
        ? 'On. Layer, filter and measurement toasts are also announced. This browser remembers the choice.'
        : 'Off. Buttons already have names; this adds spoken updates when the map changes.';
    };
    body.innerHTML = '<p class="hint">Live announcements tell a screen reader what just changed. They do not replace the names already on the buttons.</p>' +
      '<p class="hint" id="sr-state"></p>' +
      '<div class="frow act"><button class="btn" id="sr-toggle" type="button">Turn on live announcements</button></div>' +
      '<div class="frow act"><button class="btn" id="sr-announce" type="button">' + icon('info') + ' Announce current view</button></div>';
    paint();
    body.querySelector('#sr-toggle').onclick = () => {
      screenReaderOn = !screenReaderOn;
      try { localStorage.setItem('nwg.sr', screenReaderOn ? '1' : '0'); } catch { /* still applies this visit */ }
      screenReaderLabels(screenReaderOn);
      paint();
      if (screenReaderOn) announce('Live announcements on');
      toast(screenReaderOn ? 'Live announcements on' : 'Live announcements off');
    };
    body.querySelector('#sr-announce').onclick = () => {
      if (!screenReaderOn) { toast('Turn live announcements on first'); return; }
      const c = map.center();
      const ns = c[1] >= 0 ? 'north' : 'south';
      const ew = c[0] >= 0 ? 'east' : 'west';
      const labels = stack.map((id) => L.get(id)?.meta?.label).filter(Boolean);
      announce('Map centred near ' + Math.abs(c[1]).toFixed(2) + ' degrees ' + ns + ', ' + Math.abs(c[0]).toFixed(2) + ' degrees ' + ew + ', zoom ' + map.zoom.toFixed(1) + '. ' + (labels.length ? labels.length + ' layers on: ' + labels.slice(0, 6).join(', ') : 'No layers on.'));
      toast('View announced', 2800, { silent: true });
    };
  });
}

const CB_RAMPS = {
  cividis: 'Cividis — colourblind-safe',
  cb_deuteranopia: 'Blue — deuteranopia',
  cb_protanopia: 'Amber — protanopia',
  cb_tritanopia: 'Purple — tritanopia',
  cb_mono: 'Greys — no colour',
};

function toolColorblindPalettes() {
  const layers = [...layersOn(['polygon', 'line', 'point']), ...layersOn(['raster'])];
  openModal('Colorblind Palettes', (body) => {
    body.innerHTML = '<p class="hint">These ramps are in Color Ramps too. Apply classifies a numeric field, or paints the whole layer one colour if it has none. The legend follows. A red-against-green ramp is not offered.</p>' +
      '<div class="frow"><label for="cb-layer">Layer</label><select id="cb-layer">' + (layers.length ? layerOptions(layers, 0) : '<option value="">Turn a vector layer on first</option>') + '</select></div>' +
      '<div class="frow"><label for="cb-field">Field</label><select id="cb-field"></select></div>' +
      '<div class="frow"><label for="cb-ramp">Palette</label><select id="cb-ramp">' + Object.entries(CB_RAMPS).map(([id, label]) => '<option value="' + esc(id) + '">' + esc(label) + '</option>').join('') + '</select></div>' +
      '<div id="cb-preview" class="ramp" style="margin-top:10px"></div>' +
      '<div id="cb-note" class="hint"></div>' +
      '<div class="frow act"><button class="btn primary" id="cb-apply" type="button"' + (layers.length ? '' : ' disabled') + '>' + icon('palette') + ' Apply palette</button></div>';
    const q = (s) => body.querySelector(s);
    const fillFields = () => {
      const st = L.get(q('#cb-layer').value);
      const fields = (st?.meta?.fields || []).filter((f) => f.type === 'number');
      const cur = q('#cb-field').value;
      q('#cb-field').innerHTML = '<option value="">One colour for the whole layer</option>' + fields.map((f) => '<option value="' + esc(f.name) + '">' + esc(f.label || f.name) + '</option>').join('');
      if ([...q('#cb-field').options].some((o) => o.value === cur)) q('#cb-field').value = cur;
    };
    const preview = () => {
      const stops = rampStops(q('#cb-ramp').value, false);
      q('#cb-preview').innerHTML = stops.map((c) => '<i style="background:' + esc(c) + '"></i>').join('');
      q('#cb-note').textContent = q('#cb-field').value
        ? 'Classes use this ramp. Blank numbers stay grey.'
        : 'The whole layer takes the middle stop.';
    };
    q('#cb-layer').onchange = () => { fillFields(); preview(); };
    q('#cb-field').onchange = preview;
    q('#cb-ramp').onchange = preview;
    fillFields();
    preview();
    q('#cb-apply').onclick = () => {
      const st = L.get(q('#cb-layer').value);
      if (!st?.obj) { toast('Turn a vector layer on first'); return; }
      if (!st.sym) st.sym = defaultSym(st.meta);
      const ramp = q('#cb-ramp').value;
      const field = q('#cb-field').value;
      const name = CB_RAMPS[ramp] || ramp;
      if (!field || st.meta.kind === 'raster') {
        if (st.meta.kind === 'raster') {
          st.ramp = rampStops(ramp, false);
          map.render();
          refreshLegend(); renderLayerLists(); saveProject();
          toast('Legend for ' + st.meta.label + ' uses ' + name);
          return;
        }
        const stops = rampStops(ramp, false);
        const color = stops[Math.floor(stops.length / 2)] || stops[0];
        st.reclass = null;
        st.sym.fillMode = 'single';
        st.sym.fill = color;
        st.sym.stroke = color;
        applyLayerState(st);
        refreshLegend(); renderLayerLists(); saveProject();
        toast('Painted ' + st.meta.label + ' with ' + name);
        return;
      }
      const vals = st.obj.features.map((f) => +f.props?.[field]).filter((v) => Number.isFinite(v));
      if (!vals.length) { toast('That field has no numbers'); return; }
      const n = classCountFor(vals, 5);
      st.reclass = { field, method: 'quantile', n, ramp, reverse: false };
      st.sym.fillMode = 'data';
      st.sym.stroke = '';
      applyReclass(st, false);
      applyLayerState(st);
      refreshLegend(); renderLayerLists(); saveProject();
      toast('Classified ' + st.meta.label + ' by ' + field);
    };
  }, { map: true });
}

function restoreA11y() {
  try {
    const saved = JSON.parse(localStorage.getItem('nwg.a11y') || 'null');
    if (saved) a11ySet({ hc: !!saved.hc, scale: saved.scale || 1, motion: !!saved.motion }, false);
    screenReaderOn = localStorage.getItem('nwg.sr') === '1';
  } catch { /* defaults stay off */ }
  if (screenReaderOn) {
    ensureScreenReaderLive();
    screenReaderLabels(true);
  }
}

// ------------------------------------------------ sharing & collaboration

// The link carries the view a colleague can reopen: centre, zoom, rotation, basemap,
// catalog layers, focus area and grid. Colours, filters, notes and imported files stay here.
function buildShareUrl() {
  pushHash();
  const u = new URL(location.href);
  const clipRec = clipRecord();
  if (clipRec) u.searchParams.set('f', JSON.stringify(clipRec));
  else u.searchParams.delete('f');
  u.searchParams.set('g', gridOn ? '1' : '0');
  return u.href;
}

function importedOnLabels() {
  return stack.map((id) => L.get(id)).filter((st) => st?.meta?.group === 'imported').map((st) => st.meta.label);
}

function toolShareView() {
  openModal('Share View', (body) => {
    const imported = importedOnLabels();
    const notes = mapNotes.length;
    body.innerHTML = '<p class="hint">The link reopens this centre, zoom, basemap and the catalog layers that are on. A focus area and the grid are included. Colours, filters and notes are not. An imported file stays in this browser.</p>' +
      (imported.length ? '<p class="hint">Not in the link: ' + esc(imported.join(', ')) + '.</p>' : '') +
      (notes ? '<p class="hint">' + fmtNum(notes) + ' note' + (notes === 1 ? '' : 's') + ' stay here. Use a session code to send them.</p>' : '') +
      '<div class="frow"><label for="sv-url">Link</label><input id="sv-url" type="text" readonly></div>' +
      '<div class="frow act"><button class="btn primary" id="sv-copy" type="button">' + icon('copy') + ' Copy link</button><button class="btn" id="sv-share" type="button">' + icon('share') + ' Share</button></div>' +
      '<div class="frow act"><button class="btn" id="sv-session" type="button">' + icon('code') + ' Save as a session code</button></div>';
    const urlEl = body.querySelector('#sv-url');
    const fresh = () => { const url = buildShareUrl(); urlEl.value = url; return url; };
    fresh();
    urlEl.onclick = () => urlEl.select();
    body.querySelector('#sv-copy').onclick = async () => {
      const url = fresh();
      if (await copyText(url)) toast('Link copied');
      else { urlEl.focus(); urlEl.select(); toast('Could not copy. Select the link and copy it.'); }
    };
    body.querySelector('#sv-share').onclick = async () => {
      const url = fresh();
      if (!navigator.share) { toast('Use Copy link on this device'); return; }
      try { await navigator.share({ title: catalog.title, url }); }
      catch (e) { if (e?.name !== 'AbortError') toast('Use Copy link on this device'); }
    };
    body.querySelector('#sv-session').onclick = () => { closeModal(); toolSessionCodes(); };
  }, { map: true });
}

// A 6-character code is only a key in this browser. The longer code carries the session,
// so someone else can paste it. There is no server.
const SESSION_PREFIX = 'NW1.';
function sessionKey() { return 'nwg.sessions'; }
function getSessions() { try { return JSON.parse(localStorage.getItem(sessionKey()) || '{}'); } catch { return {}; } }
function setSessions(obj) { localStorage.setItem(sessionKey(), JSON.stringify(obj)); }
function makeSessionCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const taken = getSessions();
  for (let n = 0; n < 20; n++) {
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    if (!taken[code]) return code;
  }
  return String(Date.now()).slice(-6);
}
function sessionLayers() {
  const imported = [];
  const layers = [];
  for (const id of stack) {
    const st = L.get(id);
    if (!st) continue;
    if (st.meta?.group === 'imported') { imported.push(st.meta.label); continue; }
    const rec = presetLayerRecord(id);
    if (rec) layers.push(rec);
  }
  return { layers, imported };
}
function captureSessionState(name) {
  const { layers } = sessionLayers();
  return {
    v: 1,
    name: plainText(name, 40),
    basemap: map.basemap,
    center: map.center(),
    zoom: map.zoom,
    rotation: map.rotation || 0,
    grid: !!gridOn,
    clip: clipRecord(),
    layers,
    notes: mapNotes.slice(0, 40).map((n) => ({ text: plainText(n.text, 80), lon: n.lon, lat: n.lat })),
    annotations: annotations.slice(0, 40).map((a) => ({ id: a.id, text: a.text, lon: a.lon, lat: a.lat, size: a.size, color: a.color, halo: a.halo, bold: a.bold, italic: a.italic, rot: a.rot })),
  };
}
function encodeSession(state) {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return SESSION_PREFIX + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function decodeSession(code) {
  const raw = String(code || '').replace(/\s+/g, '');
  if (!raw.startsWith(SESSION_PREFIX)) return null;
  try {
    const b64 = raw.slice(SESSION_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    const bin = atob(b64 + pad);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const state = JSON.parse(new TextDecoder().decode(bytes));
    if (!state || state.v !== 1 || !Array.isArray(state.layers)) return null;
    return state;
  } catch { return null; }
}
function classifySessionCode(raw) {
  const folded = String(raw || '').trim().replace(/\s+/g, '');
  if (folded.startsWith(SESSION_PREFIX)) return { kind: 'portable', code: folded };
  const local = folded.toUpperCase();
  if (/^[A-Z0-9]{6}$/.test(local)) return { kind: 'local', code: local };
  return { kind: 'bad', code: folded };
}

function toolSessionCodes() {
  openModal('Session Codes', (body) => {
    body.innerHTML = '<p class="hint">Save keeps this map in this browser under a 6-character code. Copy the longer code to send the same session to someone else. The map is in that code, not on a server. A 6-character code only works in the browser that saved it.</p>' +
      '<div class="frow"><label for="ss-name">Name</label><input id="ss-name" type="text" maxlength="40" placeholder="Field check"></div>' +
      '<div class="frow act"><button class="btn primary" id="ss-save" type="button">' + icon('code') + ' Save this session</button></div>' +
      '<div id="ss-out"></div>' +
      '<h4>Saved in this browser</h4>' +
      '<div id="ss-list" class="scroll" style="max-height:24vh"></div>' +
      '<h4>Restore a code</h4>' +
      '<div class="frow"><label for="ss-code">Code</label><textarea id="ss-code" rows="3" placeholder="6 characters from this browser, or a code someone sent you"></textarea></div>' +
      '<div class="frow act"><button class="btn" id="ss-restore" type="button">Restore</button></div>';
    const renderList = () => {
      const sessions = getSessions();
      const keys = Object.keys(sessions);
      const list = body.querySelector('#ss-list');
      if (!list) return;
      list.innerHTML = keys.length
        ? keys.map((k) => {
          const s = sessions[k];
          const when = s.ts ? new Date(s.ts).toLocaleDateString() : '';
          return '<div class="fitem"><div class="ft"><b>' + esc(k) + '</b><small>' + esc(s.name || 'Untitled') + (when ? ' · ' + esc(when) : '') + ' · this browser</small></div><div class="acts"><button class="btn" type="button" data-restore="' + esc(k) + '">Restore</button><button class="chip" type="button" data-del="' + esc(k) + '">Remove</button></div></div>';
        }).join('')
        : '<p class="empty">No sessions saved in this browser.</p>';
      list.querySelectorAll('[data-restore]').forEach((b) => {
        b.onclick = async () => {
          const s = getSessions()[b.dataset.restore];
          if (!s?.state) { toast('That code is not in this browser'); return; }
          b.disabled = true;
          await applyCapturedView(s.state, s.name ? '“' + s.name + '”' : 'the session');
          if (body.querySelector('#ss-list')) b.disabled = false;
        };
      });
      list.querySelectorAll('[data-del]').forEach((b) => {
        b.onclick = () => {
          const sessions = getSessions();
          delete sessions[b.dataset.del];
          try { setSessions(sessions); } catch { toast('This browser could not update the list'); return; }
          renderList();
        };
      });
    };
    renderList();
    body.querySelector('#ss-save').onclick = () => {
      const name = plainText(body.querySelector('#ss-name').value, 40);
      const { imported } = sessionLayers();
      const state = captureSessionState(name);
      const code = makeSessionCode();
      const sessions = getSessions();
      sessions[code] = { name, state, ts: Date.now() };
      try { setSessions(sessions); }
      catch { toast('This browser could not store the session'); return; }
      const portable = encodeSession(state);
      const out = body.querySelector('#ss-out');
      if (portable.length > 12000) {
        out.innerHTML = '<p class="hint">Saved in this browser as ' + esc(code) + '. The code is too long to send. Remove notes or the focus area and save again.</p>';
      } else {
        out.innerHTML = '<p class="hint">Saved in this browser as <b>' + esc(code) + '</b>. This longer code is the one to send. It works in another browser.</p>' +
          (imported.length ? '<p class="hint">Not in the code: ' + esc(imported.join(', ')) + '. An imported file stays in this browser.</p>' : '') +
          '<textarea id="ss-portable" readonly rows="4">' + esc(portable) + '</textarea>' +
          '<div class="frow act"><button class="btn" id="ss-copy" type="button">' + icon('copy') + ' Copy code</button></div>';
        body.querySelector('#ss-copy').onclick = async () => {
          const text = body.querySelector('#ss-portable').value;
          if (await copyText(text)) toast('Code copied');
          else { body.querySelector('#ss-portable').focus(); body.querySelector('#ss-portable').select(); toast('Could not copy. Select the code and copy it.'); }
        };
      }
      body.querySelector('#ss-name').value = '';
      renderList();
      toast('Saved ' + (name ? '“' + name + '”' : 'the session') + ' in this browser');
    };
    body.querySelector('#ss-restore').onclick = async () => {
      const typed = body.querySelector('#ss-code').value;
      const kind = classifySessionCode(typed);
      if (kind.kind === 'portable') {
        const state = decodeSession(kind.code);
        if (!state) { toast('That code could not be read'); return; }
        body.querySelector('#ss-restore').disabled = true;
        await applyCapturedView(state, state.name ? '“' + state.name + '”' : 'the session');
        if (body.querySelector('#ss-restore')) body.querySelector('#ss-restore').disabled = false;
        return;
      }
      if (kind.kind === 'local') {
        const s = getSessions()[kind.code];
        if (!s?.state) { toast('That code is not in this browser. A 6-character code only works where it was saved.'); return; }
        body.querySelector('#ss-restore').disabled = true;
        await applyCapturedView(s.state, s.name ? '“' + s.name + '”' : 'the session');
        if (body.querySelector('#ss-restore')) body.querySelector('#ss-restore').disabled = false;
        return;
      }
      toast('Paste a 6-character code from this browser, or a code someone sent you');
    };
  }, { map: true });
}

async function applyCapturedView(state, label) {
  if (!state || typeof state !== 'object') { toast('That session could not be read'); return false; }
  await working('Restoring ' + label);
  const savedLayers = Array.isArray(state.layers)
    ? state.layers.filter((rec) => rec && rec.id)
    : (state.stack || []).filter((id) => typeof id === 'string').map((id) => ({ id, on: true }));
  const whole = state.v === 1;
  const savedIds = new Set(savedLayers.map((rec) => rec.id));
  if (whole) {
    for (const st of L.values()) {
      if (!savedIds.has(st.meta.id) && hasFilter(st)) st.filter = null;
    }
  } else clearAllFilters();
  for (const id of [...stack]) {
    if (!savedIds.has(id)) await setLayer(id, false, { quiet: true });
  }
  let missing = 0;
  const failed = [];
  for (const rec of savedLayers) {
    const st = L.get(rec.id);
    if (!st) { missing++; continue; }
    if (typeof rec.opacity === 'number') st.opacity = rec.opacity;
    if (rec.sym) st.sym = rec.sym;
    if (rec.labels) st.labels = rec.labels;
    if (whole) {
      st.reclass = rec.reclass || null;
      st.filter = rec.filter || null;
    }
    if (rec.on === false) { await setLayer(rec.id, false, { quiet: true }); continue; }
    const before = st.on;
    await setLayer(rec.id, true, { quiet: true });
    if (!st.on && !before) failed.push(st.meta.label);
    if (st.obj && st.reclass) applyReclass(st, false);
    if (st.obj && hasFilter(st)) applyFilter(st, false);
  }
  const base = basemapIdFromPreset(state.basemap);
  if (base) { map.setBasemap(base); syncBasemapUI(); updateAttrib(); }
  if (Array.isArray(state.center) && state.center.length >= 2 && state.center.every((n) => Number.isFinite(+n))) {
    map.setView(+state.center[0], +state.center[1], state.zoom);
  }
  if (Number.isFinite(+state.rotation)) map.setRotation(+state.rotation);
  gridOn = !!state.grid; map.setGrid(gridOn);
  if (state.clip) restoreFocus(state.clip);
  else { focusLabel = ''; setFocus(null, false); }
  if (Array.isArray(state.notes)) {
    mapNotes = state.notes.filter((n) => n && n.text && Number.isFinite(+n.lon) && Number.isFinite(+n.lat))
      .map((n) => ({ text: plainText(n.text, 80), lon: +n.lon, lat: +n.lat }));
  }
  if (Array.isArray(state.annotations)) {
    annotations = state.annotations.filter((a) => a && Number.isFinite(+a.lon) && Number.isFinite(+a.lat));
    renderAnnotations();
  }
  applyOrderFromStack();
  renderLayerLists(); refreshLegend(); updateFocusUI(); updateToolState(); pushHash(); saveProject();
  map.render();
  hideToast();
  const extra = missing ? ' ' + fmtNum(missing) + ' layer' + (missing === 1 ? '' : 's') + ' from that session ' + (missing === 1 ? 'is' : 'are') + ' not in this browser.' : '';
  const baseNote = state.basemap && !base ? ' The basemap is not in this browser.' : '';
  const failNote = failed.length ? ' Could not load ' + failed[0] + '.' : '';
  toast('Restored ' + label + '.' + extra + baseNote + failNote);
  noteRender?.();
  return true;
}

let noteRender = null;

function toolMapNotes() {
  openModal('Map Notes', (body) => {
    body.innerHTML = '<p class="hint">A note is a marker on the map, not a layer and not an export. It stays in this browser. Drag the marker to move it. A share link does not include it. A session code can.</p>' +
      '<div class="frow"><label for="mn-text">Note</label><input id="mn-text" type="text" maxlength="80" placeholder="Check this area"></div>' +
      '<div class="frow act"><button class="btn primary" id="mn-add" type="button">' + icon('note') + ' Add at the map centre</button></div>' +
      '<div id="mn-list" class="scroll" style="max-height:28vh"></div>';
    const renderList = () => {
      const list = body.querySelector('#mn-list');
      if (!list) return;
      list.innerHTML = mapNotes.length
        ? mapNotes.map((n, i) => '<div class="fitem"><div class="ft"><b>' + esc(n.text) + '</b></div><div class="acts"><button class="btn" type="button" data-zoom="' + i + '">Zoom</button><button class="chip" type="button" data-del="' + i + '">Remove</button></div></div>').join('')
        : '<p class="empty">No notes yet.</p>';
      list.querySelectorAll('[data-zoom]').forEach((b) => b.onclick = () => {
        const n = mapNotes[+b.dataset.zoom];
        if (!n) return;
        map.setView(n.lon, n.lat, Math.max(map.zoom, 8));
        toast('Zoomed to “' + n.text + '”');
      });
      list.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => {
        const n = mapNotes[+b.dataset.del];
        mapNotes.splice(+b.dataset.del, 1);
        map.render(); saveProject(); renderList();
        toast('Removed “' + (n?.text || 'note') + '”');
      });
    };
    noteRender = () => { if (body.isConnected) renderList(); };
    renderList();
    body.querySelector('#mn-add').onclick = () => {
      const text = plainText(body.querySelector('#mn-text').value, 80);
      if (!text) { toast('Write the note first'); return; }
      const [lon, lat] = map.center();
      mapNotes.push({ text, lon, lat });
      map.render(); saveProject(); renderList();
      body.querySelector('#mn-text').value = '';
      toast('Added “' + text + '”');
    };
  }, () => { noteRender = null; }, { map: true });
}

function hitMapNote(px, py) {
  const ctx = map.ctx;
  if (!ctx) return -1;
  for (let i = mapNotes.length - 1; i >= 0; i--) {
    const n = mapNotes[i];
    if (!n || !Number.isFinite(n.lon) || !Number.isFinite(n.lat)) continue;
    const [x, y] = map.screenOf(n.lon, n.lat);
    ctx.save();
    ctx.font = '700 12px system-ui,sans-serif';
    const w = ctx.measureText(n.text || '').width;
    ctx.restore();
    if (Math.hypot(px - x, py - y) <= 14) return i;
    if (Math.abs(px - x) <= w / 2 + 6 && py <= y - 8 && py >= y - 28) return i;
  }
  return -1;
}

map.extra.push((ctx, m) => {
  for (const n of mapNotes) {
    if (!n?.text || !Number.isFinite(n.lon) || !Number.isFinite(n.lat)) continue;
    const [x, y] = m.screenOf(n.lon, n.lat);
    if (x < -120 || y < -40 || x > m.W + 120 || y > m.H + 40) continue;
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd400'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#0b3d2e'; ctx.stroke();
    ctx.font = '700 12px system-ui,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.92)';
    ctx.strokeText(n.text, x, y - 10);
    ctx.fillStyle = '#0b3d2e';
    ctx.fillText(n.text, x, y - 10);
    ctx.restore();
  }
});

window.addEventListener('pointerdown', (e) => {
  if (!mapNotes.length || e.target !== map.cv) return;
  const box = map.cv.getBoundingClientRect();
  const px = e.clientX - box.left, py = e.clientY - box.top;
  if (px < 0 || py < 0 || px > box.width || py > box.height) return;
  const i = hitMapNote(px, py);
  if (i < 0) return;
  e.stopPropagation(); e.preventDefault();
  const n = mapNotes[i];
  const start = map.lonlatAt(px, py);
  const dLon = n.lon - start[0], dLat = n.lat - start[1];
  let moved = false;
  const move = (ev) => {
    moved = true;
    const r = map.cv.getBoundingClientRect();
    const [lo, la] = map.lonlatAt(ev.clientX - r.left, ev.clientY - r.top);
    n.lon = lo + dLon; n.lat = la + dLat;
    map.render();
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    if (!moved) return;
    saveProject();
    noteRender?.();
    toast('Moved “' + n.text + '”');
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}, true);

// ================================================================================
// RASTER TOOLS
// ================================================================================

// Raster tool helpers. A derived surface is a canvas the map draws in the raster's
// own position. Typed expressions are parsed here — they are never turned into code.

function rastersOn() {
  const out = [];
  for (const id of stack) {
    const st = L.get(id);
    if (st?.obj && st.meta.kind === 'raster') out.push([id, st]);
  }
  return out;
}
function rasterMissing(v, st) {
  const vals = st?.obj?.vals;
  if (!vals) return !Number.isFinite(v);
  if (vals.dtype === 'i2') return v === -32768;
  if (!Number.isFinite(v)) return true;
  const n = st.obj.nodata;
  return n != null && n !== '' && v === +n;
}
async function rasterValues(st) {
  if (st?.obj?.vals?.data) return st.obj.vals;
  try { await loadValues(st); } catch { return null; }
  return st?.obj?.vals?.data ? st.obj.vals : null;
}
function rasterGrid(st) {
  const vals = st?.obj?.vals;
  const wb = vals?.wb || st?.obj?.wb;
  if (!vals?.data || !wb || !(vals.w > 0) || !(vals.h > 0)) return null;
  if (!(wb[2] > wb[0]) || wb[3] === wb[1]) return null;
  return { w: vals.w, h: vals.h, data: vals.data, dtype: vals.dtype, wb };
}
function cellMerc(i, j, grid) {
  const { w, h, wb } = grid;
  return [
    wb[0] + (i + 0.5) / w * (wb[2] - wb[0]),
    wb[1] + (j + 0.5) / h * (wb[3] - wb[1]),
  ];
}
async function rasterPause(out) {
  await new Promise((r) => setTimeout(r, 0));
  return !!out?.isConnected;
}
function hexRgb(hex) {
  const n = parseInt(String(hex || '').replace('#', ''), 16);
  if (!Number.isFinite(n)) return [120, 120, 120, 210];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 210];
}
function rasterCanvas(data, w, h, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const px = img.data;
  for (let i = 0; i < w * h; i++) {
    const c = paint(data[i], i);
    const o = i * 4;
    if (!c) { px[o + 3] = 0; continue; }
    px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = c[3] == null ? 210 : c[3];
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
function stretchPaint(min, max) {
  const ramp = rampStops('viridis');
  const span = (max > min) ? (max - min) : 1;
  return (v) => {
    if (!Number.isFinite(v)) return null;
    const t = Math.max(0, Math.min(1, (v - min) / span));
    return hexRgb(rampColor(ramp, t));
  };
}
function addDerivedRaster(canvas, grid, data, opts) {
  clearAnalysisLayers();
  const id = 'analysis_' + Date.now().toString(36);
  const obj = {
    id, kind: 'raster', visible: true, opacity: 0.88, order: 99999,
    img: canvas, wb: grid.wb.slice(), categorical: !!(opts && opts.categorical), nodata: null,
    vals: { w: grid.w, h: grid.h, wb: grid.wb.slice(), dtype: 'f4', data },
  };
  map.addLayer(obj);
  analysisLayers.push(obj);
  map.fitBounds(mercBoundsToLonLat(grid.wb), 36, 200);
  return obj;
}
const RASTER_DRAWN = 'Drawn on the map as a new surface. The original layer is unchanged.';
const RASTER_LINES = 'Drawn on the map as lines on this raster. The original layer is unchanged.';
const RASTER_PANEL = 'This stays in the panel. It does not draw a layer.';
function fillRasterResult(out, title, kind, html, rows, extra) {
  if (!out?.isConnected) return;
  hideToast();
  out.innerHTML = `<div data-raster-result="${kind}">${html}</div>` + (rows ? resultExportBar(title) : '')
    + (kind === 'panel' ? '' : `<div class="frow act"><button class="btn" id="raster-clear" type="button">${icon('trash')} Clear from map</button></div>`);
  if (rows) wireResultExports(out, title, rows, extra);
  const clear = out.querySelector('#raster-clear');
  if (clear) clear.onclick = () => { clearAnalysisLayers(); toast('Cleared from the map'); };
}
function compileRasterExpr(src) {
  const s = String(src || '').trim();
  if (!s) throw new Error('Write an expression that uses v, such as v * 2.');
  let i = 0;
  const skip = () => { while (s[i] === ' ' || s[i] === '\t' || s[i] === '\n') i++; };
  const wordAt = (word) => {
    if (s.slice(i, i + word.length).toLowerCase() !== word) return false;
    const after = s[i + word.length];
    if (after && /[A-Za-z0-9_]/.test(after)) return false;
    return true;
  };
  function parseOr() {
    let left = parseAnd();
    skip();
    while (wordAt('or')) {
      i += 2;
      const right = parseAnd();
      const a = left, b = right;
      left = (v) => (a(v) && b(v)) ? 1 : 0;
      skip();
    }
    return left;
  }
  function parseAnd() {
    let left = parseCmp();
    skip();
    while (wordAt('and')) {
      i += 3;
      const right = parseCmp();
      const a = left, b = right;
      left = (v) => (a(v) && b(v)) ? 1 : 0;
      skip();
    }
    return left;
  }
  function parseCmp() {
    let left = parseAdd();
    skip();
    const ops = ['>=', '<=', '!=', '==', '>', '<', '='];
    const op = ops.find((item) => s.startsWith(item, i));
    if (!op) return left;
    i += op.length;
    const right = parseAdd();
    const a = left, b = right;
    return (v) => {
      const x = a(v), y = b(v);
      if (op === '>') return x > y ? 1 : 0;
      if (op === '<') return x < y ? 1 : 0;
      if (op === '>=') return x >= y ? 1 : 0;
      if (op === '<=') return x <= y ? 1 : 0;
      if (op === '=' || op === '==') return x === y ? 1 : 0;
      return x !== y ? 1 : 0;
    };
  }
  function parseAdd() {
    let left = parseMul();
    skip();
    while (s[i] === '+' || s[i] === '-') {
      const op = s[i]; i++;
      const right = parseMul();
      const a = left, b = right;
      left = op === '+' ? (v) => a(v) + b(v) : (v) => a(v) - b(v);
      skip();
    }
    return left;
  }
  function parseMul() {
    let left = parseUnary();
    skip();
    while (s[i] === '*' || s[i] === '/') {
      const op = s[i]; i++;
      const right = parseUnary();
      const a = left, b = right;
      left = op === '*' ? (v) => a(v) * b(v) : (v) => a(v) / b(v);
      skip();
    }
    return left;
  }
  function parseUnary() {
    skip();
    if (s[i] === '-') { i++; const inner = parseUnary(); return (v) => -inner(v); }
    return parsePrimary();
  }
  const FUNCS = { abs: Math.abs, sqrt: Math.sqrt, log: Math.log, ln: Math.log, round: Math.round, floor: Math.floor, ceil: Math.ceil };
  function parsePrimary() {
    skip();
    if (s[i] === '(') {
      i++;
      const inner = parseOr();
      skip();
      if (s[i] !== ')') throw new Error('That expression could not be read. A bracket is missing.');
      i++;
      return inner;
    }
    if (/[0-9.]/.test(s[i] || '')) {
      const m = /^[0-9]*\.?[0-9]+(?:e[+-]?[0-9]+)?/i.exec(s.slice(i));
      if (!m || m[0] === '.') throw new Error('That expression could not be read.');
      i += m[0].length;
      const n = +m[0];
      if (!Number.isFinite(n)) throw new Error('That expression could not be read.');
      return () => n;
    }
    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
    if (!word) throw new Error('That expression could not be read. Use v, numbers, + - * / and brackets.');
    const name = word[0].toLowerCase();
    i += word[0].length;
    skip();
    if (name === 'v') return (v) => v;
    if (FUNCS[name] && s[i] === '(') {
      i++;
      const arg = parseOr();
      skip();
      if (s[i] !== ')') throw new Error('That expression could not be read. A bracket is missing.');
      i++;
      const fn = FUNCS[name];
      return (v) => fn(arg(v));
    }
    throw new Error('That expression is not allowed. Use v, numbers, + - * /, comparisons, and abs, sqrt, log, round, floor or ceil.');
  }
  const fn = parseOr();
  skip();
  if (i < s.length) throw new Error('That expression could not be read.');
  if (typeof fn(0) !== 'number') throw new Error('That expression could not be read.');
  return fn;
}
function contourFeatures(w, h, values, wb, interval, step, isMissing) {
  const levels = [];
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < values.length; i += step) {
    if (isMissing(i)) continue;
    const v = values[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!(max > min) || !(interval > 0)) return { features: [], levels, step, capped: false, min, max };
  for (let level = Math.ceil((min + 1e-9) / interval) * interval; level < max - 1e-9 && levels.length < 12; level += interval) levels.push(level);
  const at = (col, row) => values[row * w + col];
  const missingAt = (col, row) => isMissing(row * w + col);
  const mercAt = (col, row) => [
    wb[0] + (col + 0.5) / w * (wb[2] - wb[0]),
    wb[1] + (row + 0.5) / h * (wb[3] - wb[1]),
  ];
  const edgePoint = (edge, c, r, vTL, vTR, vBR, vBL, level) => {
    const tOf = (a, b) => (b === a ? 0.5 : (level - a) / (b - a));
    if (edge === 0) return mercAt(c + step * tOf(vTL, vTR), r);
    if (edge === 1) return mercAt(c + step, r + step * tOf(vTR, vBR));
    if (edge === 2) return mercAt(c + step * tOf(vBL, vBR), r + step);
    return mercAt(c, r + step * tOf(vTL, vBL));
  };
  // Bit 0 top-left, 1 top-right, 2 bottom-right, 3 bottom-left. Edges: 0 top, 1 right, 2 bottom, 3 left.
  const CASES = {
    1: [[0, 3]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[0, 3], [1, 2]],
    6: [[0, 2]], 7: [[3, 2]], 8: [[3, 2]], 9: [[0, 2]], 10: [[0, 1], [3, 2]],
    11: [[1, 2]], 12: [[3, 1]], 13: [[0, 1]], 14: [[0, 3]],
  };
  const features = [];
  let capped = false;
  for (const level of levels) {
    if (capped) break;
    for (let r = 0; r + step < h && !capped; r += step) {
      for (let c = 0; c + step < w; c += step) {
        if (missingAt(c, r) || missingAt(c + step, r) || missingAt(c + step, r + step) || missingAt(c, r + step)) continue;
        const vTL = at(c, r), vTR = at(c + step, r), vBR = at(c + step, r + step), vBL = at(c, r + step);
        let index = 0;
        if (vTL >= level) index |= 1;
        if (vTR >= level) index |= 2;
        if (vBR >= level) index |= 4;
        if (vBL >= level) index |= 8;
        const pairs = CASES[index];
        if (!pairs) continue;
        for (const [e0, e1] of pairs) {
          const p0 = edgePoint(e0, c, r, vTL, vTR, vBR, vBL, level);
          const p1 = edgePoint(e1, c, r, vTL, vTR, vBR, vBL, level);
          features.push({
            type: 'line',
            parts: [[p0[0], p0[1], p1[0], p1[1]]],
            bb: [Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), Math.max(p0[0], p1[0]), Math.max(p0[1], p1[1])],
            fill: 'none', stroke: '#0b6b45', idx: features.length,
            props: { level },
          });
          if (features.length >= 2500) { capped = true; break; }
        }
        if (capped) break;
      }
    }
  }
  return { features, levels, step, capped, min, max };
}
function slopeDegrees(w, h, values, wb, i, j, isMissing) {
  if (i <= 0 || j <= 0 || i >= w - 1 || j >= h - 1) return NaN;
  const here = j * w + i;
  const west = values[here - 1], east = values[here + 1], north = values[here - w], south = values[here + w];
  if (isMissing(here - 1) || isMissing(here + 1) || isMissing(here - w) || isMissing(here + w)) return NaN;
  const lat = unY(wb[1] + (j + 0.5) / h * (wb[3] - wb[1]));
  const dLon = (wb[2] - wb[0]) / w * 360;
  const cellW = haversineKm([0, lat], [dLon, lat]) * 1000;
  const latN = unY(wb[1] + (j - 0.5) / h * (wb[3] - wb[1]));
  const latS = unY(wb[1] + (j + 1.5) / h * (wb[3] - wb[1]));
  const cellH = haversineKm([0, latN], [0, latS]) * 1000;
  if (!(cellW > 1) || !(cellH > 1)) return NaN;
  const dzdx = (east - west) / (2 * cellW);
  const dzdy = (south - north) / cellH;
  return Math.atan(Math.hypot(dzdx, dzdy)) * 180 / Math.PI;
}

function toolRasterCalc() {
  const layers = rastersOn();
  openModal('Raster Calculator', (body) => {
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a raster layer first.'); return; }
    body.innerHTML = `<p class="hint">Builds a new surface from each cell. Use <b>v</b> for the cell value, for example <b>v * 2</b> or <b>v &gt; 100</b>. Only numbers and the allowed maths are run — typed code is not. Empty cells stay empty.</p>
      <div class="frow"><label>Raster</label><select id="rc-layer">${layerOptions(layers)}</select></div>
      <div class="frow"><label>Expression</label><input id="rc-expr" type="text" value="v * 2"></div>
      <div class="frow act"><button class="btn primary" id="rc-run" type="button">${icon('calc')} Calculate</button></div>
      <div id="rc-out"></div>`;
    const out = body.querySelector('#rc-out');
    const button = body.querySelector('#rc-run');
    button.onclick = async () => {
      button.disabled = true;
      try {
        let fn;
        try { fn = compileRasterExpr(body.querySelector('#rc-expr').value); }
        catch (err) { out.innerHTML = `<p class="empty">${esc(err.message)}</p>`; return; }
        const st = L.get(body.querySelector('#rc-layer').value);
        out.innerHTML = '<p class="hint">Reading the raster…</p>';
        const vals = await rasterValues(st);
        const grid = rasterGrid(st);
        if (!out.isConnected) return;
        if (!vals || !grid) { out.innerHTML = '<p class="empty">This raster has no cell values to calculate.</p>'; return; }
        const outData = new Float32Array(grid.w * grid.h);
        let n = 0, min = Infinity, max = -Infinity, sum = 0;
        for (let i = 0; i < grid.data.length; i++) {
          if (i > 0 && i % 80000 === 0 && !(await rasterPause(out))) return;
          if (rasterMissing(grid.data[i], st)) { outData[i] = NaN; continue; }
          const y = fn(grid.data[i]);
          if (!Number.isFinite(y)) { outData[i] = NaN; continue; }
          outData[i] = y; n++; sum += y;
          if (y < min) min = y;
          if (y > max) max = y;
        }
        if (!out.isConnected) return;
        if (!n) { out.innerHTML = '<p class="empty">Every cell was empty, or the expression had no finite result.</p>'; return; }
        const canvas = rasterCanvas(outData, grid.w, grid.h, stretchPaint(min, max));
        addDerivedRaster(canvas, grid, outData);
        fillRasterResult(out, 'Raster Calculator', 'surface',
          `<p class="hint">${RASTER_DRAWN} From <b>${esc(st.meta.label)}</b>.</p>` +
          statBoxes([[fmtNum(n), 'cells drawn'], [fmtNum(min), 'lowest'], [fmtNum(max), 'highest'], [fmtNum(sum / n), 'mean']]),
          [{ cells: n, lowest: +min.toFixed(4), highest: +max.toFixed(4), mean: +(sum / n).toFixed(4) }],
          { layer: st.meta.label, expression: body.querySelector('#rc-expr').value });
        toast('New surface drawn');
      } catch (err) {
        console.error(err);
        if (out.isConnected) out.innerHTML = '<p class="empty">That calculation could not be finished.</p>';
      } finally { if (button.isConnected) button.disabled = false; }
    };
  }, { map: true });
}

function toolRasterReclass() {
  const layers = rastersOn();
  openModal('Raster Reclassify', (body) => {
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a raster layer first.'); return; }
    body.innerHTML = `<p class="hint">Groups the cell values and draws those groups as a new surface. This does not recolour the original raster. A raster has no features, so the vector classifier does not apply here.</p>
      <div class="frow"><label>Raster</label><select id="rr-layer">${layerOptions(layers)}</select></div>
      <div class="frow"><label>Method</label><select id="rr-method"><option value="equal">Equal interval</option><option value="quantile">Quantile</option></select></div>
      <div class="frow"><label>Classes</label><input id="rr-n" type="number" min="2" max="9" value="5"></div>
      <div class="frow act"><button class="btn primary" id="rr-run" type="button">${icon('sliders')} Reclassify</button></div>
      <div id="rr-out"></div>`;
    const out = body.querySelector('#rr-out');
    const button = body.querySelector('#rr-run');
    button.onclick = async () => {
      button.disabled = true;
      try {
        const st = L.get(body.querySelector('#rr-layer').value);
        const method = body.querySelector('#rr-method').value === 'quantile' ? 'quantile' : 'equal';
        const asked = Math.max(2, Math.min(9, +body.querySelector('#rr-n').value || 5));
        out.innerHTML = '<p class="hint">Reading the raster…</p>';
        await rasterValues(st);
        const grid = rasterGrid(st);
        if (!out.isConnected) return;
        if (!grid) { out.innerHTML = '<p class="empty">This raster has no cell values to reclassify.</p>'; return; }
        const sample = [];
        const sampleStep = Math.max(1, Math.floor(grid.data.length / 40000));
        for (let i = 0; i < grid.data.length; i += sampleStep) {
          if (!rasterMissing(grid.data[i], st)) sample.push(grid.data[i]);
        }
        if (sample.length < 2) { out.innerHTML = '<p class="empty">Not enough cell values to make classes.</p>'; return; }
        const n = classCountFor(sample, asked);
        const breaks = breaksOf(sample, n, method);
        const ramp = rampStops('viridis');
        const outData = new Float32Array(grid.w * grid.h);
        const counts = new Array(n).fill(0);
        for (let i = 0; i < grid.data.length; i++) {
          if (i > 0 && i % 80000 === 0 && !(await rasterPause(out))) return;
          if (rasterMissing(grid.data[i], st)) { outData[i] = NaN; continue; }
          const k = classOf(grid.data[i], breaks, n);
          outData[i] = k + 1;
          counts[k]++;
        }
        if (!out.isConnected) return;
        const canvas = rasterCanvas(outData, grid.w, grid.h, (v) => Number.isFinite(v) ? hexRgb(rampColor(ramp, (v - 1) / Math.max(1, n - 1))) : null);
        addDerivedRaster(canvas, grid, outData, { categorical: true });
        const rows = counts.map((count, k) => ({ class: k + 1, from: +breaks[k].toFixed(4), to: +breaks[k + 1].toFixed(4), cells: count }));
        const sampled = sampleStep > 1 ? ` Class breaks come from every ${fmtNum(sampleStep)}th cell. Every cell is still classed.` : '';
        fillRasterResult(out, 'Raster Reclassify', 'surface',
          `<p class="hint">${RASTER_DRAWN} <b>${n}</b> ${method === 'quantile' ? 'quantile' : 'equal-interval'} class${n === 1 ? '' : 'es'} from <b>${esc(st.meta.label)}</b>. Class numbers start at 1.${sampled}</p>` +
          resultTable(['Class', 'From', 'To', 'Cells'], rows, (r) => [String(r.class), fmtNum(r.from), fmtNum(r.to), fmtNum(r.cells)]),
          rows, { layer: st.meta.label, method, classes: n });
        toast('Classes drawn');
      } catch (err) {
        console.error(err);
        if (out.isConnected) out.innerHTML = '<p class="empty">Those classes could not be drawn.</p>';
      } finally { if (button.isConnected) button.disabled = false; }
    };
  }, { map: true });
}

function toolRasterStats() {
  const layers = rastersOn();
  openModal('Raster Statistics', (body) => {
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a raster layer first.'); return; }
    body.innerHTML = `<p class="hint">Lowest, highest, mean and standard deviation of the cell values. ${RASTER_PANEL} Empty cells are skipped, not treated as zero.</p>
      <div class="frow"><label>Raster</label><select id="rs-layer">${layerOptions(layers)}</select></div>
      <div class="frow act"><button class="btn primary" id="rs-run" type="button">${icon('chart')} Summarise</button></div>
      <div id="rs-out"></div>`;
    const out = body.querySelector('#rs-out');
    const button = body.querySelector('#rs-run');
    button.onclick = async () => {
      button.disabled = true;
      try {
        const st = L.get(body.querySelector('#rs-layer').value);
        out.innerHTML = '<p class="hint">Reading the raster…</p>';
        await rasterValues(st);
        const grid = rasterGrid(st);
        if (!out.isConnected) return;
        if (!grid) { out.innerHTML = '<p class="empty">This raster has no cell values to summarise.</p>'; return; }
        let n = 0, min = Infinity, max = -Infinity, sum = 0, sum2 = 0, skipped = 0;
        for (let i = 0; i < grid.data.length; i++) {
          if (rasterMissing(grid.data[i], st)) { skipped++; continue; }
          const v = grid.data[i];
          n++; sum += v; sum2 += v * v;
          if (v < min) min = v;
          if (v > max) max = v;
        }
        if (!n) { out.innerHTML = '<p class="empty">Every cell was empty.</p>'; return; }
        const mean = sum / n;
        const variance = Math.max(0, sum2 / n - mean * mean);
        const std = Math.sqrt(variance);
        const row = { cells: n, lowest: +min.toFixed(4), highest: +max.toFixed(4), mean: +mean.toFixed(4), std: +std.toFixed(4), empty: skipped };
        fillRasterResult(out, 'Raster Statistics', 'panel',
          `<p class="hint">${RASTER_PANEL} <b>${esc(st.meta.label)}</b>.</p>` +
          statBoxes([[fmtNum(n), 'cells'], [fmtNum(min), 'lowest'], [fmtNum(max), 'highest'], [fmtNum(mean), 'mean'], [fmtNum(std), 'std dev']]) +
          (skipped ? `<p class="hint">${fmtNum(skipped)} empty cells were skipped.</p>` : ''),
          [row], { layer: st.meta.label });
        toast('Raster statistics ready');
      } catch (err) {
        console.error(err);
        if (out.isConnected) out.innerHTML = '<p class="empty">Those statistics could not be finished.</p>';
      } finally { if (button.isConnected) button.disabled = false; }
    };
  }, { map: true });
}

function toolRasterClip() {
  const layers = rastersOn();
  openModal('Raster Clip / Mask', (body) => {
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a raster layer first.'); return; }
    if (!map?.clip) { body.innerHTML = overlayNeed('Set a focus area first, then clip the raster to it.'); return; }
    body.innerHTML = `<p class="hint">Keeps a cell only when its centre is inside the focus area, and draws that as a new surface. The focus box itself is not turned into a layer. Cells outside are left empty.</p>
      <div class="frow"><label>Raster</label><select id="rcl-layer">${layerOptions(layers)}</select></div>
      <div class="frow act"><button class="btn primary" id="rcl-run" type="button">${icon('crop')} Clip raster</button></div>
      <div id="rcl-out"></div>`;
    const out = body.querySelector('#rcl-out');
    const button = body.querySelector('#rcl-run');
    button.onclick = async () => {
      button.disabled = true;
      try {
        const st = L.get(body.querySelector('#rcl-layer').value);
        if (!map?.clip) { out.innerHTML = '<p class="empty">Set a focus area first.</p>'; return; }
        out.innerHTML = '<p class="hint">Reading the raster…</p>';
        await rasterValues(st);
        const grid = rasterGrid(st);
        if (!out.isConnected) return;
        if (!grid) { out.innerHTML = '<p class="empty">This raster has no cell values to clip.</p>'; return; }
        const outData = new Float32Array(grid.w * grid.h);
        let kept = 0, dropped = 0, empty = 0;
        for (let j = 0; j < grid.h; j++) {
          if (j % 8 === 0 && !(await rasterPause(out))) return;
          for (let i = 0; i < grid.w; i++) {
            const p = j * grid.w + i;
            const v = grid.data[p];
            if (rasterMissing(v, st)) { outData[p] = NaN; empty++; continue; }
            const [x, y] = cellMerc(i, j, grid);
            if (!map.clipContainsPoint(x, y)) { outData[p] = NaN; dropped++; continue; }
            outData[p] = v; kept++;
          }
        }
        if (!out.isConnected) return;
        if (!kept) { out.innerHTML = '<p class="empty">No cell centre falls inside the focus area.</p>'; return; }
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < outData.length; i++) if (Number.isFinite(outData[i])) { if (outData[i] < min) min = outData[i]; if (outData[i] > max) max = outData[i]; }
        const canvas = rasterCanvas(outData, grid.w, grid.h, stretchPaint(min, max));
        addDerivedRaster(canvas, grid, outData);
        fillRasterResult(out, 'Raster Clip', 'surface',
          `<p class="hint">${RASTER_DRAWN} A cell is kept only when its centre is inside the focus. ${fmtNum(dropped)} cells were left empty because they are outside the focus.</p>` +
          statBoxes([[fmtNum(kept), 'cells kept'], [fmtNum(dropped), 'outside the focus'], [fmtNum(empty), 'already empty']]),
          [{ cells_kept: kept, outside_focus: dropped, already_empty: empty }],
          { layer: st.meta.label });
        toast('Raster clipped');
      } catch (err) {
        console.error(err);
        if (out.isConnected) out.innerHTML = '<p class="empty">That clip could not be finished.</p>';
      } finally { if (button.isConnected) button.disabled = false; }
    };
  }, { map: true });
}

// ================================================================================
// GEOMETRY OPERATIONS
// ================================================================================

function toolCentroid() {
  openModal('Feature Centroid', (body) => {
    const layers = layersOn(['point', 'line', 'polygon']);
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a point, line or polygon layer.'); return; }
    body.innerHTML = `<p class="hint">Draws one point at the area centre of each polygon, or the vertex centre of a line or point. ${GEOM_DRAWN}</p>` +
      `<div class="frow"><label>Layer</label><select id="ct-layer">${layerOptions(layers, 0)}</select></div>` +
      `<div class="frow act"><button class="btn primary" id="ct-run" type="button">${icon('target')} Compute centroids</button></div>`;
    body.querySelector('#ct-run').onclick = async () => {
      const st = L.get(body.querySelector('#ct-layer').value);
      if (!st) return;
      if (!st.obj) await loadLayer(st);
      const feats = geomSource(st);
      const points = [];
      for (const f of feats) {
        const c = areaCentroidMerc(f);
        const pt = c && pointFeature(c[0], c[1], geomCopyProps(f), { fill: '#ffd400', stroke: '#0b3d2e', idx: points.length });
        if (pt) points.push(pt);
      }
      showGeom({
        title: 'Feature Centroid',
        kind: 'point',
        layerLabel: 'Centroids',
        color: '#ffd400',
        features: points,
        hint: `${GEOM_DRAWN} One point per feature of <b>${esc(st.meta.label)}</b>. A polygon uses its area centre, with holes left out. A line or point uses the centre of its vertices.`,
        stats: [[fmtNum(points.length), 'points'], [fmtNum(feats.length), 'features']],
        records: points.slice(0, 500).map((p, i) => ({ feature: titleOf(st.obj, feats[i]) || 'Feature' })),
        table: resultTable(['Feature'], points.slice(0, 25).map((p, i) => ({ feature: titleOf(st.obj, feats[i]) || 'Feature' })), (r) => [r.feature]),
        extra: { layer: st.meta.label, points: points.length },
        emptyToast: 'No feature had a centre to draw',
      });
    };
  }, { map: true });
}

function toolDensify() {
  openModal('Densify Lines', (body) => {
    const layers = layersOn(['line']);
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a line layer.'); return; }
    body.innerHTML = `<p class="hint">Adds a vertex every time the line travels the interval, measured in kilometres on the ground. ${GEOM_DRAWN}</p>` +
      `<div class="frow"><label>Line layer</label><select id="dn-layer">${layerOptions(layers, 0)}</select></div>` +
      `<div class="frow"><label>Interval (km)</label><input id="dn-interval" type="number" min="0.1" step="0.1" value="1"></div>` +
      `<div class="frow act"><button class="btn primary" id="dn-run" type="button">${icon('line')} Densify</button></div>`;
    body.querySelector('#dn-run').onclick = async () => {
      const st = L.get(body.querySelector('#dn-layer').value);
      const intervalKm = Math.max(0.1, +body.querySelector('#dn-interval').value || 1);
      if (!st) return;
      if (!st.obj) await loadLayer(st);
      const feats = geomSource(st).filter((f) => f.type === 'line');
      const lines = [];
      let added = 0;
      for (const f of feats) {
        const parts = (f.parts || []).map((part) => densifyFlat(part, intervalKm, false));
        const before = featureVertices(f).length;
        const built = lineFeature(parts, geomCopyProps(f), { stroke: '#0b6b45', idx: lines.length });
        if (!built) continue;
        added += Math.max(0, featureVertices(built).length - before);
        lines.push(built);
      }
      showGeom({
        title: 'Densify Lines',
        kind: 'line',
        layerLabel: 'Densified lines',
        features: lines,
        hint: `${GEOM_DRAWN} Vertices were added about every ${fmtNum(intervalKm)} km along <b>${esc(st.meta.label)}</b>. The spacing is ground distance, not a straight step in map units.`,
        stats: [[fmtNum(lines.length), 'lines'], [fmtNum(added), 'vertices added'], [fmtNum(intervalKm), 'km interval']],
        records: [{ lines: lines.length, vertices_added: added, interval_km: intervalKm }],
        table: resultTable(['Lines', 'Vertices added', 'Interval (km)'], [{ lines: lines.length, added, intervalKm }], (r) => [fmtNum(r.lines), fmtNum(r.added), fmtNum(r.intervalKm)]),
        extra: { layer: st.meta.label, interval_km: intervalKm },
        emptyToast: 'No line to densify',
      });
    };
  }, { map: true });
}

function toolSplitPoly() {
  openModal('Split Polygon by Line', (body) => {
    const polys = layersOn(['polygon']);
    const lines = layersOn(['line']);
    if (!polys.length || !lines.length) { body.innerHTML = overlayNeed('Turn on a polygon layer and a line layer. The line is the cut.'); return; }
    body.innerHTML = `<p class="hint">Cuts each polygon where a line crosses it, and draws the pieces. A line that only touches, or misses, leaves that polygon as it was. ${GEOM_DRAWN}</p>` +
      `<div class="frow"><label>Polygon layer</label><select id="sp-poly">${layerOptions(polys, 0)}</select></div>` +
      `<div class="frow"><label>Cutting line</label><select id="sp-line">${layerOptions(lines, 0)}</select></div>` +
      `<div class="frow act"><button class="btn primary" id="sp-run" type="button">${icon('crop')} Split polygons</button></div>`;
    body.querySelector('#sp-run').onclick = async () => {
      const pSt = L.get(body.querySelector('#sp-poly').value);
      const lSt = L.get(body.querySelector('#sp-line').value);
      if (!pSt || !lSt) return;
      if (!pSt.obj) await loadLayer(pSt);
      if (!lSt.obj) await loadLayer(lSt);
      const subjects = geomSource(pSt).filter((f) => f.type === 'poly');
      const cutters = geomSource(lSt).filter((f) => f.type === 'line');
      const pieces = [];
      const records = [];
      let cut = 0, kept = 0;
      for (const f of subjects) {
        const before = f.parts.length;
        const parts = splitPolygonByLines(f, cutters);
        const grew = parts.length > before;
        const use = parts.length ? parts : f.parts;
        if (grew) cut++; else kept++;
        for (const poly of use) {
          const built = polygonFeature([poly], { ...geomCopyProps(f), split: grew ? 'yes' : 'no' }, { fill: grew ? '#b45309' : '#0b6b45', idx: pieces.length });
          if (built) pieces.push(built);
        }
        if (records.length < 500) records.push({ feature: titleOf(pSt.obj, f), pieces: use.length, cut: grew ? 'yes' : 'no' });
      }
      showGeom({
        title: 'Split Polygon by Line',
        kind: 'polygon',
        layerLabel: 'Split polygons',
        color: '#b45309',
        features: pieces,
        hint: `${GEOM_DRAWN} <b>${esc(lSt.meta.label)}</b> cuts <b>${esc(pSt.meta.label)}</b> only where a line crosses a ring. Pieces that were cut are amber. A polygon the line missed stays green.`,
        stats: [[fmtNum(cut), 'polygons cut'], [fmtNum(kept), 'left whole'], [fmtNum(pieces.length), 'pieces drawn']],
        records,
        table: resultTable(['Feature', 'Pieces', 'Cut'], records, (r) => [r.feature, fmtNum(r.pieces), r.cut]),
        extra: { polygons: pSt.meta.label, lines: lSt.meta.label, cut, kept },
        emptyToast: 'No polygon to split',
      });
    };
  }, { map: true });
}

function toolConcaveHull() {
  openModal('Concave Hull', (body) => {
    const layers = layersOn(['point', 'line', 'polygon']);
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a point, line or polygon layer.'); return; }
    body.innerHTML = `<p class="hint">Draws one outline around the vertices. A smaller alpha follows bays when a neighbour is close enough. A large alpha stays near the convex hull. ${GEOM_DRAWN}</p>` +
      `<div class="frow"><label>Layer</label><select id="ch-layer">${layerOptions(layers, 0)}</select></div>` +
      `<div class="frow"><label>Alpha (km)</label><input id="ch-alpha" type="number" min="0.1" step="0.1" value="10"></div>` +
      `<div class="frow act"><button class="btn primary" id="ch-run" type="button">${icon('polygon')} Compute concave hull</button></div>`;
    body.querySelector('#ch-run').onclick = async () => {
      const st = L.get(body.querySelector('#ch-layer').value);
      const alpha = Math.max(0.1, +body.querySelector('#ch-alpha').value || 10);
      if (!st) return;
      if (!st.obj) await loadLayer(st);
      const feats = geomSource(st);
      const pts = feats.flatMap(featureVertices);
      const ring = concaveHullPoints(pts, alpha);
      const hull = ring && polygonFeature([[ring]], { alpha_km: alpha, vertices: pts.length }, { fill: '#0b6b45', idx: 0 });
      showGeom({
        title: 'Concave Hull',
        kind: 'polygon',
        layerLabel: 'Concave hull',
        features: hull ? [hull] : [],
        hint: `${GEOM_DRAWN} Outline of <b>${esc(st.meta.label)}</b> at alpha ${fmtNum(alpha)} km. A smaller value can follow a bay. If the points are farther apart than that, the outline falls back to the convex hull and the panel still says concave only when the bay was followed.`,
        stats: [[fmtNum(pts.length), 'vertices'], [fmtNum(alpha), 'alpha km'], [fmtNum(hull ? 1 : 0), 'outline']],
        records: [{ vertices: pts.length, alpha_km: alpha, drawn: hull ? 'yes' : 'no' }],
        table: resultTable(['Vertices', 'Alpha (km)', 'Drawn'], [{ vertices: pts.length, alpha, drawn: hull ? 'yes' : 'no' }], (r) => [fmtNum(r.vertices), fmtNum(r.alpha), r.drawn]),
        extra: { layer: st.meta.label, alpha_km: alpha },
        emptyToast: 'Need at least 3 points for a hull',
      });
    };
  }, { map: true });
}

// ================================================================================
// TOPOLOGY & DATA QUALITY TOOLS
// ================================================================================

function toolCheckOverlap() {
  const polyLayers = layersOn(['polygon']);
  openModal('Check Overlaps', (body) => {
    if (!polyLayers.length) { body.innerHTML = overlayNeed('Turn on a polygon layer.'); return; }
    body.innerHTML = `<p class="hint">Lists polygon pairs whose areas overlap. A shared border alone is not an overlap. ${TOPO_PANEL}</p>
      ${overlayNote()}
      <div class="frow"><label>Polygon layer</label><select id="ov-layer">${layerOptions(polyLayers)}</select></div>
      <div class="frow act"><button class="btn primary" id="ov-run">${icon('query')} Check overlaps</button></div>
      <div id="ov-out" style="margin-top:10px"></div>`;
    const out = body.querySelector('#ov-out');
    body.querySelector('#ov-run').onclick = async () => {
      const st = L.get(body.querySelector('#ov-layer').value);
      if (!st?.obj) await loadLayer(st);
      const feats = geomSource(st).filter((f) => f.type === 'poly');
      out.innerHTML = '<p class="hint">Checking…</p>';
      await new Promise((r) => setTimeout(r, 0));
      const pairs = bboxPairs(feats, (a, b) => !boxesOverlap(a.bb, b.bb));
      const records = [];
      for (const [a, b] of pairs) {
        const crosses = polyOverlapsPoly(a.parts, b.parts);
        const km2 = overlapAreaKm2(a, b);
        if (!crosses && !(km2 > 1e-4)) continue;
        records.push({
          a: topoName(st, a, feats.indexOf(a)),
          b: topoName(st, b, feats.indexOf(b)),
          overlap_km2: +km2.toFixed(3),
        });
      }
      records.sort((p, q) => q.overlap_km2 - p.overlap_km2);
      topoPanel(out, 'Check Overlaps',
        `<p><b>${fmtNum(records.length)}</b> overlapping pair${records.length === 1 ? '' : 's'} in ${esc(st.meta.label)} (${fmtNum(feats.length)} polygons).</p>`
        + statBoxes([[fmtNum(records.length), 'Overlapping pairs'], [fmtNum(feats.length), 'Polygons checked']])
        + resultTable(['Polygon', 'Overlaps', 'km²'], records, (r) => [r.a, r.b, fmtNum(r.overlap_km2)], 'No polygon overlaps another.'),
        records, { layer: st.meta.label });
    };
  }, { map: true });
}

function toolCheckGaps() {
  const polyLayers = layersOn(['polygon']);
  openModal('Check Gaps', (body) => {
    if (!polyLayers.length) { body.innerHTML = overlayNeed('Turn on a polygon layer.'); return; }
    body.innerHTML = `<p class="hint">A gap is a hole the polygons enclose between them. Ground outside the group is not a gap, and a hole cut into one polygon is not a gap. ${TOPO_PANEL}</p>
      ${overlayNote()}
      <div class="frow"><label>Polygon layer</label><select id="gp-layer">${layerOptions(polyLayers)}</select></div>
      <div class="frow act"><button class="btn primary" id="gp-run">${icon('grid')} Check gaps</button></div>
      <div id="gp-out" style="margin-top:10px"></div>`;
    const out = body.querySelector('#gp-out');
    body.querySelector('#gp-run').onclick = async () => {
      const st = L.get(body.querySelector('#gp-layer').value);
      if (!st?.obj) await loadLayer(st);
      const feats = geomSource(st).filter((f) => f.type === 'poly');
      if (feats.length < 2) {
        topoPanel(out, 'Check Gaps', '<p>At least two polygons are needed.</p>', [], { layer: st.meta.label });
        return;
      }
      out.innerHTML = '<p class="hint">Checking…</p>';
      await new Promise((r) => setTimeout(r, 0));
      const gaps = enclosedGapParts(feats);
      const records = gaps.map((poly, i) => ({ gap: 'Gap ' + (i + 1), area_km2: +polygonMeasure([poly]).areaKm2.toFixed(3) }));
      const total = records.reduce((s, r) => s + r.area_km2, 0);
      topoPanel(out, 'Check Gaps',
        `<p><b>${fmtNum(records.length)}</b> enclosed gap${records.length === 1 ? '' : 's'} in ${esc(st.meta.label)}, ${fmtNum(total)} km² together.</p>`
        + statBoxes([[fmtNum(records.length), 'Enclosed gaps'], [fmtNum(total), 'km² inside the gaps']])
        + resultTable(['Gap', 'km²'], records, (r) => [r.gap, fmtNum(r.area_km2)], 'No enclosed gap. Ground outside the polygons is not counted.'),
        records, { layer: st.meta.label });
    };
  }, { map: true });
}

function toolValidate() {
  const vecLayers = layersOn(['polygon', 'line', 'point']);
  openModal('Validate Geometry', (body) => {
    if (!vecLayers.length) { body.innerHTML = overlayNeed('Turn on a point, line or polygon layer.'); return; }
    body.innerHTML = `<p class="hint">Checks each feature for missing coordinates, an unclosed ring, fewer than three ring vertices, a zero-area ring, a ring or line that crosses itself, and a coordinate outside longitude or latitude. ${TOPO_PANEL}</p>
      ${overlayNote()}
      <div class="frow"><label>Layer</label><select id="vl-layer">${layerOptions(vecLayers)}</select></div>
      <div class="frow act"><button class="btn primary" id="vl-run">${icon('check')} Validate</button></div>
      <div id="vl-out" style="margin-top:10px"></div>`;
    const out = body.querySelector('#vl-out');
    body.querySelector('#vl-run').onclick = async () => {
      const st = L.get(body.querySelector('#vl-layer').value);
      if (!st?.obj) await loadLayer(st);
      const feats = geomSource(st);
      const records = [];
      feats.forEach((f, i) => {
        for (const issue of geometryIssues(f)) records.push({ feature: topoName(st, f, i), issue });
      });
      topoPanel(out, 'Validate Geometry',
        `<p><b>${fmtNum(records.length)}</b> issue${records.length === 1 ? '' : 's'} in ${esc(st.meta.label)} (${fmtNum(feats.length)} features).</p>`
        + statBoxes([[fmtNum(records.length), 'Issues'], [fmtNum(feats.length), 'Features checked']])
        + resultTable(['Feature', 'Issue'], records, (r) => [r.feature, r.issue], 'Every feature passed.'),
        records, { layer: st.meta.label });
    };
  }, { map: true });
}

function toolSnap() {
  const layers = layersOn(['polygon', 'line', 'point']);
  openModal('Snap Features', (body) => {
    if (layers.length < 2) { body.innerHTML = overlayNeed('Turn on two layers. Vertices of the first are snapped to vertices of the second.'); return; }
    body.innerHTML = `<p class="hint">Moves vertices of the first layer onto vertices of the second when they are within the tolerance, in metres on the ground. The result is drawn. Neither source layer is changed.</p>
      ${overlayNote()}
      <div class="frow"><label>Move vertices of</label><select id="sn-src">${layerOptions(layers, 0)}</select></div>
      <div class="frow"><label>Onto vertices of</label><select id="sn-ref">${layerOptions(layers, 1)}</select></div>
      <div class="frow"><label>Tolerance (metres)</label><input id="sn-tol" type="number" min="0" step="1" value="50"></div>
      <div class="frow act"><button class="btn primary" id="sn-run">${icon('magnet')} Snap features</button></div>`;
    bindDistinctLayers(body.querySelector('#sn-src'), body.querySelector('#sn-ref'), body.querySelector('#sn-run'));
    body.querySelector('#sn-run').onclick = async () => {
      const src = L.get(body.querySelector('#sn-src').value);
      const ref = L.get(body.querySelector('#sn-ref').value);
      const metres = Math.max(0, +body.querySelector('#sn-tol').value || 0);
      if (!src?.obj) await loadLayer(src);
      if (!ref?.obj) await loadLayer(ref);
      const targets = [];
      for (const f of geomSource(ref)) for (const v of featureVertices(f)) targets.push(v);
      const drawn = [];
      const records = [];
      let moved = 0, seen = 0;
      geomSource(src).forEach((f, i) => {
        const flat = f.type === 'point' ? f.parts : (f.type === 'line' ? f.parts : f.parts);
        const next = f.type === 'poly'
          ? f.parts.map((poly) => poly.map((ring) => snapFlatToVertices(ring, targets, metres)))
          : f.type === 'line'
            ? f.parts.map((part) => snapFlatToVertices(part, targets, metres))
            : snapFlatToVertices(f.parts, targets, metres);
        const before = featureVertices(f).length;
        seen += before;
        const afterVerts = f.type === 'point' ? Math.floor(next.length / 2) : featureVertices({ ...f, parts: next }).length;
        let changed = 0;
        const walk = (a, b) => { for (let k = 0; k < a.length && k < b.length; k += 2) if (a[k] !== b[k] || a[k + 1] !== b[k + 1]) changed++; };
        if (f.type === 'point') walk(f.parts, next);
        else if (f.type === 'line') f.parts.forEach((part, pi) => walk(part, next[pi] || []));
        else f.parts.forEach((poly, pi) => poly.forEach((ring, ri) => walk(ring, next[pi]?.[ri] || [])));
        moved += changed;
        const copy = topoSnapCopy(f, next, { ...geomCopyProps(f), snapped_vertices: changed, source: topoName(src, f, i) }, { fill: '#0b6b45', stroke: '#0b6b45' }, i);
        if (copy) drawn.push(copy);
        if (changed) records.push({ feature: topoName(src, f, i), vertices_moved: changed });
      });
      showGeom({
        title: 'Snap Features',
        kind: 'polygon',
        layerLabel: 'Snapped · ' + src.meta.label,
        color: '#0b6b45',
        features: drawn,
        hint: `${fmtNum(moved)} of ${fmtNum(seen)} vertices in ${esc(src.meta.label)} moved onto ${esc(ref.meta.label)} within ${fmtNum(metres)} m. ${GEOM_DRAWN}`,
        stats: [[fmtNum(moved), 'Vertices moved'], [fmtNum(metres) + ' m', 'Tolerance']],
        records,
        table: resultTable(['Feature', 'Vertices moved'], records, (r) => [r.feature, fmtNum(r.vertices_moved)], 'No vertex was within the tolerance.'),
        extra: { source: src.meta.label, reference: ref.meta.label, metres, moved },
      });
    };
  }, { map: true });
}

// ================================================================================
// NETWORK & ROUTING TOOLS
// ================================================================================

function toolShortestPath() {
  const layers = layersOn(['line']);
  openModal('Shortest Path', (body) => {
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a line layer.'); return; }
    body.innerHTML = `<p class="hint">Draws the shortest route along the lines between two taps. Travel is allowed in either direction. Lines join only where a vertex is within the snap distance, in metres. A crossing without a shared vertex is not a junction. The source lines are not changed.</p>
      ${overlayNote()}
      <div class="frow"><label>Network</label><select id="np-layer">${layerOptions(layers)}</select></div>
      ${netJoinFields('np')}
      <div class="frow"><label>Start</label><span id="np-start">Not set</span> <button class="btn" id="np-pick-a" type="button">${icon('target')} Pick on the map</button></div>
      <div class="frow"><label>End</label><span id="np-end">Not set</span> <button class="btn" id="np-pick-b" type="button">${icon('target')} Pick on the map</button></div>
      <div class="frow act"><button class="btn primary" id="np-run">${icon('ruler')} Find path</button></div>`;
    const picked = { start: null, end: null };
    const arm = (which, label) => {
      body.querySelector('#np-' + which).textContent = 'Tap the map…';
      armNetworkPick(label, (lon, lat, x, y) => {
        if (!body.isConnected) return;
        picked[which] = { x, y };
        body.querySelector('#np-' + which).textContent = 'Set';
      });
    };
    body.querySelector('#np-pick-a').onclick = () => arm('start', 'start');
    body.querySelector('#np-pick-b').onclick = () => arm('end', 'end');
    body.querySelector('#np-run').onclick = async () => {
      if (!picked.start || !picked.end) { toast('Pick a start and an end on the map'); return; }
      const st = L.get(body.querySelector('#np-layer').value);
      const join = Math.max(0, +body.querySelector('#np-join').value || 0);
      const snapKm = Math.max(0, +body.querySelector('#np-snap').value || 0);
      if (!st?.obj) await loadLayer(st);
      const path = networkPath(buildLineNetwork(netSource(st), join), picked.start.x, picked.start.y, picked.end.x, picked.end.y, snapKm);
      const why = {
        'start-far': 'The start is farther from a line than the tap distance.',
        'end-far': 'The end is farther from a line than the tap distance.',
        disconnected: 'No line connects those two places. Lines do not join just because they cross.',
        'no-network': 'That layer has no line to follow.',
      }[path.reason];
      if (!path.ok) {
        showNetLines({ title: 'Shortest Path', lines: [], hint: why, emptyToast: why, records: [] });
        return;
      }
      if (!(path.km > 0.001) || !path.flat) {
        showNetLines({ title: 'Shortest Path', lines: [], hint: 'Those two taps fall on the same place on the network.', emptyToast: 'Same place on the network', records: [] });
        return;
      }
      const names = [...new Set(path.names)];
      showNetLines({
        title: 'Shortest Path',
        layerLabel: 'Path · ' + st.meta.label,
        lines: [{ flat: path.flat, name: names.join(', '), km: path.km }],
        hint: `${fmtNum(path.km)} km along ${esc(st.meta.label)}, not the straight line between the taps. ${GEOM_DRAWN}`,
        stats: [[fmtNum(path.km) + ' km', 'Along the lines'], [fmtNum(names.length), 'Lines used']],
        records: names.map((name) => ({ line: name })),
        table: resultTable(['Line used'], names.map((name) => ({ line: name })), (r) => [r.line]),
        extra: { network: st.meta.label, length_km: +path.km.toFixed(3) },
      });
    };
  }, { map: true });
}

function toolServiceArea() {
  const layers = layersOn(['line']);
  openModal('Service Area', (body) => {
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a line layer.'); return; }
    body.innerHTML = `<p class="hint">Draws the parts of the lines you can travel within the distance, starting from a tap. It is not a circle, and land off the lines is not included. Travel is allowed in either direction. The source lines are not changed.</p>
      ${overlayNote()}
      <div class="frow"><label>Network</label><select id="sa-layer">${layerOptions(layers)}</select></div>
      <div class="frow"><label>Distance along the lines (km)</label><input id="sa-dist" type="number" min="0" step="0.1" value="5"></div>
      ${netJoinFields('sa')}
      <div class="frow"><label>Start</label><span id="sa-start">Not set</span> <button class="btn" id="sa-pick" type="button">${icon('target')} Pick on the map</button></div>
      <div class="frow act"><button class="btn primary" id="sa-run">${icon('target')} Draw reachable lines</button></div>`;
    let start = null;
    body.querySelector('#sa-pick').onclick = () => {
      body.querySelector('#sa-start').textContent = 'Tap the map…';
      armNetworkPick('start', (lon, lat, x, y) => {
        if (!body.isConnected) return;
        start = { x, y };
        body.querySelector('#sa-start').textContent = 'Set';
      });
    };
    body.querySelector('#sa-run').onclick = async () => {
      if (!start) { toast('Pick a start on the map'); return; }
      const st = L.get(body.querySelector('#sa-layer').value);
      const distKm = Math.max(0, +body.querySelector('#sa-dist').value || 0);
      const join = Math.max(0, +body.querySelector('#sa-join').value || 0);
      const snapKm = Math.max(0, +body.querySelector('#sa-snap').value || 0);
      if (!st?.obj) await loadLayer(st);
      const reach = networkReach(buildLineNetwork(netSource(st), join), [[start.x, start.y]], distKm, snapKm);
      if (!reach.snapped) {
        showNetLines({ title: 'Service Area', lines: [], hint: 'The tap is farther from a line than the tap distance. Nothing was drawn.', emptyToast: 'Tap closer to a line', records: [] });
        return;
      }
      showNetLines({
        title: 'Service Area',
        layerLabel: 'Reachable · ' + st.meta.label,
        lines: reach.lines,
        hint: `${fmtNum(reach.reachedKm)} km of ${esc(st.meta.label)} is within ${fmtNum(distKm)} km along the lines. This is not a circle. ${GEOM_DRAWN}`,
        stats: [[fmtNum(reach.reachedKm) + ' km', 'Reachable lines'], [fmtNum(distKm) + ' km', 'Limit']],
        records: reach.lines.slice(0, 200).map((l) => ({ line: l.name, length_km: +l.km.toFixed(3) })),
        table: resultTable(['Line', 'km drawn'], reach.lines.map((l) => ({ line: l.name, length_km: +l.km.toFixed(3) })), (r) => [r.line, fmtNum(r.length_km)], 'No line is within that distance.'),
        extra: { network: st.meta.label, reachable_km: +reach.reachedKm.toFixed(3), limit_km: distKm },
      });
    };
  }, { map: true });
}

function toolTraceNet() {
  const layers = layersOn(['line']);
  openModal('Trace Network', (body) => {
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a line layer.'); return; }
    body.innerHTML = `<p class="hint">Draws the lines you reach by following the stored direction. Downstream is from the first vertex of each line toward the last. It does not follow a line backward, and it does not know a river's flow unless the line was stored that way. The source lines are not changed.</p>
      ${overlayNote()}
      <div class="frow"><label>Network</label><select id="tn-layer">${layerOptions(layers)}</select></div>
      <div class="frow"><label>Direction</label><select id="tn-dir"><option value="down">Downstream — toward the last vertex</option><option value="up">Upstream — toward the first vertex</option></select></div>
      ${netJoinFields('tn')}
      <div class="frow"><label>Start</label><span id="tn-start">Not set</span> <button class="btn" id="tn-pick" type="button">${icon('target')} Pick on the map</button></div>
      <div class="frow act"><button class="btn primary" id="tn-run">${icon('query')} Trace</button></div>`;
    let start = null;
    body.querySelector('#tn-pick').onclick = () => {
      body.querySelector('#tn-start').textContent = 'Tap the map…';
      armNetworkPick('start', (lon, lat, x, y) => {
        if (!body.isConnected) return;
        start = { x, y };
        body.querySelector('#tn-start').textContent = 'Set';
      });
    };
    body.querySelector('#tn-run').onclick = async () => {
      if (!start) { toast('Pick a start on the map'); return; }
      const st = L.get(body.querySelector('#tn-layer').value);
      const direction = body.querySelector('#tn-dir').value;
      const join = Math.max(0, +body.querySelector('#tn-join').value || 0);
      const snapKm = Math.max(0, +body.querySelector('#tn-snap').value || 0);
      if (!st?.obj) await loadLayer(st);
      const traced = networkTrace(buildLineNetwork(netSource(st), join), start.x, start.y, direction, snapKm);
      const way = direction === 'up' ? 'upstream' : 'downstream';
      if (traced.reason === 'far') {
        showNetLines({ title: 'Trace Network', lines: [], hint: 'The tap is farther from a line than the tap distance.', emptyToast: 'Tap closer to a line', records: [] });
        return;
      }
      const stopped = traced.reason === 'end' ? ` The ${way} direction does not continue from there.` : '';
      showNetLines({
        title: 'Trace Network',
        layerLabel: 'Trace · ' + st.meta.label,
        lines: traced.lines,
        hint: `${fmtNum(traced.km)} km of ${esc(st.meta.label)} lies ${way} of the tap, following the stored direction.${stopped} ${GEOM_DRAWN}`,
        stats: [[fmtNum(traced.km) + ' km', way], [fmtNum(traced.lines.length), 'Line pieces']],
        records: traced.lines.map((l) => ({ line: l.name, length_km: +l.km.toFixed(3) })),
        table: resultTable(['Line', 'km'], traced.lines.map((l) => ({ line: l.name, length_km: +l.km.toFixed(3) })), (r) => [r.line, fmtNum(r.length_km)], 'The trace stops here.'),
        extra: { network: st.meta.label, direction: way, length_km: +traced.km.toFixed(3) },
        emptyToast: 'The trace does not continue',
      });
    };
  }, { map: true });
}

// ================================================================================
// ADDITIONAL RASTER TOOLS
// ================================================================================

function toolRasterContour() {
  const layers = rastersOn();
  openModal('Raster Contour', (body) => {
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a raster layer first.'); return; }
    body.innerHTML = `<p class="hint">Draws contour lines at a regular interval. The lines use this raster’s position on the map. They are not placed at the page corner.</p>
      <div class="frow"><label>Raster</label><select id="cont-layer">${layerOptions(layers)}</select></div>
      <div class="frow"><label>Interval</label><input id="cont-interval" type="number" min="0.0001" step="any" value="10"></div>
      <div class="frow act"><button class="btn primary" id="cont-run" type="button">${icon('query')} Draw contours</button></div>
      <div id="cont-out"></div>`;
    const out = body.querySelector('#cont-out');
    const button = body.querySelector('#cont-run');
    button.onclick = async () => {
      button.disabled = true;
      try {
        const st = L.get(body.querySelector('#cont-layer').value);
        const interval = +body.querySelector('#cont-interval').value;
        if (!(interval > 0)) { out.innerHTML = '<p class="empty">The interval has to be greater than zero.</p>'; return; }
        out.innerHTML = '<p class="hint">Reading the raster…</p>';
        await rasterValues(st);
        const grid = rasterGrid(st);
        if (!out.isConnected) return;
        if (!grid) { out.innerHTML = '<p class="empty">This raster has no cell values to contour.</p>'; return; }
        if (!(await rasterPause(out))) return;
        const step = Math.max(1, Math.ceil(Math.max(grid.w, grid.h) / 80));
        const built = contourFeatures(grid.w, grid.h, grid.data, grid.wb, interval, step, (i) => rasterMissing(grid.data[i], st));
        if (!out.isConnected) return;
        if (!built.features.length) {
          out.innerHTML = `<p class="empty">No contour falls inside the values (${fmtNum(built.min)} to ${fmtNum(built.max)}). Try a smaller interval.</p>`;
          return;
        }
        const layer = addAnalysisLayer(built.features, 'line', 'Contours · ' + st.meta.label, '#0b6b45');
        if (layer?.sym) layer.sym.strokeWidth = 2;
        fitDrawn(built.features);
        map.render();
        const rows = built.levels.map((level) => ({ level: +level.toFixed(4), lines: built.features.filter((f) => f.props.level === level).length }));
        const note = (step > 1 ? ` Lines are traced on every ${fmtNum(step)}th cell, so a bend between samples is not drawn.` : '')
          + (built.levels.length >= 12 ? ' Only the first 12 levels from the lowest are drawn. Widen the interval to cover more of the range.' : '')
          + (built.capped ? ' Drawing stopped at 2,500 lines.' : '');
        fillRasterResult(out, 'Raster Contour', 'lines',
          `<p class="hint">${RASTER_LINES}${note}</p>` +
          statBoxes([[fmtNum(built.features.length), 'line pieces'], [fmtNum(built.levels.length), 'levels'], [fmtNum(interval), 'interval']]) +
          resultTable(['Level', 'Pieces'], rows, (r) => [fmtNum(r.level), fmtNum(r.lines)]),
          rows, { layer: st.meta.label, interval, sample_step: step });
        toast('Contours drawn');
      } catch (err) {
        console.error(err);
        if (out.isConnected) out.innerHTML = '<p class="empty">Those contours could not be drawn.</p>';
      } finally { if (button.isConnected) button.disabled = false; }
    };
  }, { map: true });
}

function toolRasterSlope() {
  const layers = rastersOn();
  openModal('Raster Slope', (body) => {
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a raster layer first. Use the elevation layer if you want a ground slope.'); return; }
    body.innerHTML = `<p class="hint">Draws the slope of the surface in degrees, using the ground size of each cell. That is a ground slope only when the cell values are heights in metres, such as the elevation layer. It is not a ground slope for rainfall or population. The edge is left empty, because a slope needs the neighbouring cells.</p>
      <div class="frow"><label>Raster</label><select id="slp-layer">${layerOptions(layers)}</select></div>
      <div class="frow act"><button class="btn primary" id="slp-run" type="button">${icon('target')} Compute slope</button></div>
      <div id="slp-out"></div>`;
    const out = body.querySelector('#slp-out');
    const button = body.querySelector('#slp-run');
    button.onclick = async () => {
      button.disabled = true;
      try {
        const st = L.get(body.querySelector('#slp-layer').value);
        out.innerHTML = '<p class="hint">Reading the raster…</p>';
        await rasterValues(st);
        const grid = rasterGrid(st);
        if (!out.isConnected) return;
        if (!grid) { out.innerHTML = '<p class="empty">This raster has no cell values to measure.</p>'; return; }
        const outData = new Float32Array(grid.w * grid.h);
        let n = 0, min = Infinity, max = -Infinity, sum = 0;
        const steep = [];
        for (let j = 0; j < grid.h; j++) {
          if (j % 8 === 0 && !(await rasterPause(out))) return;
          for (let i = 0; i < grid.w; i++) {
            const p = j * grid.w + i;
            const deg = slopeDegrees(grid.w, grid.h, grid.data, grid.wb, i, j, (idx) => rasterMissing(grid.data[idx], st));
            outData[p] = deg;
            if (!Number.isFinite(deg)) continue;
            n++; sum += deg;
            if (deg < min) min = deg;
            if (deg > max) max = deg;
            if (steep.length < 8 || deg > steep[steep.length - 1].degrees) {
              steep.push({ degrees: +deg.toFixed(2) });
              steep.sort((a, b) => b.degrees - a.degrees);
              if (steep.length > 8) steep.pop();
            }
          }
        }
        if (!out.isConnected) return;
        if (!n) { out.innerHTML = '<p class="empty">No cell had enough neighbours to measure a slope.</p>'; return; }
        const canvas = rasterCanvas(outData, grid.w, grid.h, stretchPaint(min, max));
        addDerivedRaster(canvas, grid, outData);
        fillRasterResult(out, 'Raster Slope', 'surface',
          `<p class="hint">${RASTER_DRAWN} Values are degrees. They are a ground slope only if <b>${esc(st.meta.label)}</b> is height in metres. The steepest samples are listed without a location.</p>` +
          statBoxes([[fmtNum(n), 'cells'], [fmtNum(min), 'gentlest'], [fmtNum(max), 'steepest'], [fmtNum(sum / n), 'mean degrees']]) +
          resultTable(['Steepest samples (degrees)'], steep, (r) => [fmtNum(r.degrees)]),
          steep, { layer: st.meta.label, unit: 'degrees' });
        toast('Slope drawn');
      } catch (err) {
        console.error(err);
        if (out.isConnected) out.innerHTML = '<p class="empty">That slope could not be drawn.</p>';
      } finally { if (button.isConnected) button.disabled = false; }
    };
  }, { map: true });
}

function toolRasterHist() {
  const layers = rastersOn();
  openModal('Raster Histogram', (body) => {
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a raster layer first.'); return; }
    body.innerHTML = `<p class="hint">How the cell values are spread. ${RASTER_PANEL} Empty cells are skipped, not treated as zero.</p>
      <div class="frow"><label>Raster</label><select id="hst-layer">${layerOptions(layers)}</select></div>
      <div class="frow"><label>Bars</label><input id="hst-bins" type="number" min="2" max="24" value="8"></div>
      <div class="frow act"><button class="btn primary" id="hst-run" type="button">${icon('hist')} Show histogram</button></div>
      <div id="hst-out"></div>`;
    const out = body.querySelector('#hst-out');
    const button = body.querySelector('#hst-run');
    button.onclick = async () => {
      button.disabled = true;
      try {
        const st = L.get(body.querySelector('#hst-layer').value);
        const bins = Math.max(2, Math.min(24, Math.round(+body.querySelector('#hst-bins').value) || 8));
        out.innerHTML = '<p class="hint">Reading the raster…</p>';
        await rasterValues(st);
        const grid = rasterGrid(st);
        if (!out.isConnected) return;
        if (!grid) { out.innerHTML = '<p class="empty">This raster has no cell values to chart.</p>'; return; }
        let n = 0, min = Infinity, max = -Infinity, skipped = 0;
        for (let i = 0; i < grid.data.length; i++) {
          if (rasterMissing(grid.data[i], st)) { skipped++; continue; }
          n++;
          if (grid.data[i] < min) min = grid.data[i];
          if (grid.data[i] > max) max = grid.data[i];
        }
        if (!n) { out.innerHTML = '<p class="empty">Every cell was empty.</p>'; return; }
        const counts = new Array(bins).fill(0);
        const width = max > min ? (max - min) / bins : 0;
        if (width === 0) counts[0] = n;
        else {
          for (let i = 0; i < grid.data.length; i++) {
            if (rasterMissing(grid.data[i], st)) continue;
            const bi = Math.min(bins - 1, Math.floor((grid.data[i] - min) / width));
            counts[bi]++;
          }
        }
        const peak = Math.max(...counts, 1);
        const rows = counts.map((count, i) => ({ from: +(min + i * (width || 0)).toFixed(4), to: +(width ? min + (i + 1) * width : max).toFixed(4), cells: count }));
        const bars = rows.map((r) => `<div class="raster-bar" style="display:flex;align-items:center;gap:6px;margin:2px 0"><span style="width:52px;text-align:right;font-size:11px">${fmtNum(r.from)}</span><div style="flex:1;height:10px;background:#e5e7eb;border-radius:4px;overflow:hidden"><div style="height:100%;width:${(r.cells / peak * 100).toFixed(1)}%;background:#0b6b45"></div></div><span style="width:42px;text-align:right;font-size:11px">${fmtNum(r.cells)}</span></div>`).join('');
        fillRasterResult(out, 'Raster Histogram', 'panel',
          `<p class="hint">${RASTER_PANEL} <b>${esc(st.meta.label)}</b>. ${fmtNum(n)} cells, from ${fmtNum(min)} to ${fmtNum(max)}.</p>` + bars +
          (skipped ? `<p class="hint">${fmtNum(skipped)} empty cells were skipped.</p>` : ''),
          rows, { layer: st.meta.label, bars: bins });
        toast('Histogram ready');
      } catch (err) {
        console.error(err);
        if (out.isConnected) out.innerHTML = '<p class="empty">That histogram could not be finished.</p>';
      } finally { if (button.isConnected) button.disabled = false; }
    };
  }, { map: true });
}

// ================================================================================
// ADDITIONAL GEOMETRY OPERATIONS
// ================================================================================

function toolAffineTransform() {
  openModal('Affine Transform', (body) => {
    const layers = layersOn(['point', 'line', 'polygon']);
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a point, line or polygon layer.'); return; }
    body.innerHTML = `<p class="hint">Draws a moved, rotated or scaled copy. East and north are kilometres on the ground, not degrees. ${GEOM_DRAWN}</p>` +
      `<div class="frow"><label>Layer</label><select id="af-layer">${layerOptions(layers, 0)}</select></div>` +
      `<div class="frow"><label>East (km)</label><input id="af-dx" type="number" step="0.1" value="0"></div>` +
      `<div class="frow"><label>North (km)</label><input id="af-dy" type="number" step="0.1" value="0"></div>` +
      `<div class="frow"><label>Scale</label><input id="af-scale" type="number" min="0.01" step="0.01" value="1"></div>` +
      `<div class="frow"><label>Rotate (deg)</label><input id="af-rot" type="number" step="1" value="0"></div>` +
      `<div class="frow act"><button class="btn primary" id="af-run" type="button">${icon('convert')} Transform</button></div>`;
    body.querySelector('#af-run').onclick = async () => {
      const st = L.get(body.querySelector('#af-layer').value);
      const eastKm = +body.querySelector('#af-dx').value || 0;
      const northKm = +body.querySelector('#af-dy').value || 0;
      const scale = +body.querySelector('#af-scale').value || 1;
      const rotateDeg = +body.querySelector('#af-rot').value || 0;
      if (!st) return;
      if (!st.obj) await loadLayer(st);
      const feats = geomSource(st);
      const drawn = [];
      const kind = st.meta.kind === 'line' ? 'line' : st.meta.kind === 'point' ? 'point' : 'polygon';
      for (const f of feats) {
        const origin = areaCentroidMerc(f) || [f.bb?.[0] || 0, f.bb?.[1] || 0];
        const opts = { eastKm, northKm, scale, rotateDeg };
        let built = null;
        if (f.type === 'point') {
          const moved = affineFlat(f.parts, origin, opts);
          const pts = [];
          for (let i = 0; i < moved.length; i += 2) pts.push(moved[i], moved[i + 1]);
          built = pts.length >= 2 ? pointFeature(pts[0], pts[1], geomCopyProps(f), { fill: '#0b6b45', idx: drawn.length }) : null;
          if (built && pts.length > 2) built.parts = pts;
        } else if (f.type === 'line') {
          built = lineFeature((f.parts || []).map((part) => affineFlat(part, origin, opts)), geomCopyProps(f), { stroke: '#0b6b45', idx: drawn.length });
        } else {
          const parts = (f.parts || []).map((poly) => poly.map((ring) => affineFlat(ring, origin, opts)));
          built = polygonFeature(parts, geomCopyProps(f), { fill: '#0b6b45', idx: drawn.length });
        }
        if (built) drawn.push(built);
      }
      showGeom({
        title: 'Affine Transform',
        kind,
        layerLabel: 'Transformed',
        features: drawn,
        hint: `${GEOM_DRAWN} Copy of <b>${esc(st.meta.label)}</b>, shifted ${fmtNum(eastKm)} km east and ${fmtNum(northKm)} km north, scaled ${fmtNum(scale)} and rotated ${fmtNum(rotateDeg)}°. The shift is ground distance, not degrees.`,
        stats: [[fmtNum(drawn.length), 'features'], [fmtNum(eastKm), 'km east'], [fmtNum(northKm), 'km north'], [fmtNum(rotateDeg), 'degrees']],
        records: [{ features: drawn.length, east_km: eastKm, north_km: northKm, scale, rotate_deg: rotateDeg }],
        table: resultTable(['Features', 'East (km)', 'North (km)', 'Scale', 'Rotate'], [{ features: drawn.length, eastKm, northKm, scale, rotateDeg }], (r) => [fmtNum(r.features), fmtNum(r.eastKm), fmtNum(r.northKm), fmtNum(r.scale), fmtNum(r.rotateDeg)]),
        extra: { layer: st.meta.label, east_km: eastKm, north_km: northKm, scale, rotate_deg: rotateDeg },
        emptyToast: 'No feature to transform',
      });
    };
  }, { map: true });
}

function toolLineToPoly() {
  openModal('Lines to Polygons', (body) => {
    const layers = layersOn(['line']);
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a line layer.'); return; }
    body.innerHTML = `<p class="hint">Closes each line that has at least three vertices and draws it as a polygon. A two-point line is skipped, because it has no area. ${GEOM_DRAWN}</p>` +
      `<div class="frow"><label>Line layer</label><select id="ltp-layer">${layerOptions(layers, 0)}</select></div>` +
      `<div class="frow act"><button class="btn primary" id="ltp-run" type="button">${icon('polygon')} Convert to polygons</button></div>`;
    body.querySelector('#ltp-run').onclick = async () => {
      const st = L.get(body.querySelector('#ltp-layer').value);
      if (!st) return;
      if (!st.obj) await loadLayer(st);
      const feats = geomSource(st).filter((f) => f.type === 'line');
      const polys = [];
      let skipped = 0;
      for (const f of feats) {
        for (const part of f.parts || []) {
          if (part.length < 6) { skipped++; continue; }
          const built = polygonFeature([[part]], geomCopyProps(f), { fill: '#0b6b45', idx: polys.length });
          if (built) polys.push(built);
          else skipped++;
        }
      }
      showGeom({
        title: 'Lines to Polygons',
        kind: 'polygon',
        layerLabel: 'Lines as polygons',
        features: polys,
        hint: `${GEOM_DRAWN} Closed rings from <b>${esc(st.meta.label)}</b>. A line with fewer than three vertices is not a polygon and was skipped.`,
        stats: [[fmtNum(polys.length), 'polygons'], [fmtNum(skipped), 'lines skipped']],
        records: [{ polygons: polys.length, skipped }],
        table: resultTable(['Polygons', 'Skipped'], [{ polygons: polys.length, skipped }], (r) => [fmtNum(r.polygons), fmtNum(r.skipped)]),
        extra: { layer: st.meta.label, polygons: polys.length, skipped },
        emptyToast: 'No line had enough vertices to close',
      });
    };
  }, { map: true });
}

function toolPolyOutline() {
  openModal('Polygon Outlines', (body) => {
    const layers = layersOn(['polygon']);
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a polygon layer.'); return; }
    body.innerHTML = `<p class="hint">Draws each outer ring and each hole as its own line. ${GEOM_DRAWN}</p>` +
      `<div class="frow"><label>Polygon layer</label><select id="po-layer">${layerOptions(layers, 0)}</select></div>` +
      `<div class="frow act"><button class="btn primary" id="po-run" type="button">${icon('line')} Extract outlines</button></div>`;
    body.querySelector('#po-run').onclick = async () => {
      const st = L.get(body.querySelector('#po-layer').value);
      if (!st) return;
      if (!st.obj) await loadLayer(st);
      const feats = geomSource(st).filter((f) => f.type === 'poly');
      const lines = [];
      for (const f of feats) {
        for (const poly of f.parts || []) for (const ring of poly) {
          const built = lineFeature([ring], geomCopyProps(f), { stroke: '#0b6b45', idx: lines.length });
          if (built) lines.push(built);
        }
      }
      showGeom({
        title: 'Polygon Outlines',
        kind: 'line',
        layerLabel: 'Polygon outlines',
        features: lines,
        hint: `${GEOM_DRAWN} Boundary lines of <b>${esc(st.meta.label)}</b>, including holes. The polygons themselves are unchanged.`,
        stats: [[fmtNum(lines.length), 'lines'], [fmtNum(feats.length), 'polygons']],
        records: [{ lines: lines.length, polygons: feats.length }],
        table: resultTable(['Lines', 'Polygons'], [{ lines: lines.length, polygons: feats.length }], (r) => [fmtNum(r.lines), fmtNum(r.polygons)]),
        extra: { layer: st.meta.label, lines: lines.length },
        emptyToast: 'No ring to draw',
      });
    };
  }, { map: true });
}

function toolFeatureSmooth() {
  openModal('Smooth Features', (body) => {
    const layers = layersOn(['line', 'polygon']);
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a line or polygon layer.'); return; }
    body.innerHTML = `<p class="hint">Draws a copy with each vertex moved toward its neighbours. Endpoints of an open line stay put. ${GEOM_DRAWN}</p>` +
      `<div class="frow"><label>Layer</label><select id="sm-layer">${layerOptions(layers, 0)}</select></div>` +
      `<div class="frow"><label>Passes</label><input id="sm-iters" type="number" min="1" max="8" value="2"></div>` +
      `<div class="frow act"><button class="btn primary" id="sm-run" type="button">${icon('sliders')} Smooth</button></div>`;
    body.querySelector('#sm-run').onclick = async () => {
      const st = L.get(body.querySelector('#sm-layer').value);
      const passes = Math.max(1, Math.min(8, Math.round(+body.querySelector('#sm-iters').value) || 2));
      if (!st) return;
      if (!st.obj) await loadLayer(st);
      const feats = geomSource(st);
      const drawn = [];
      const kind = st.meta.kind === 'line' ? 'line' : 'polygon';
      for (const f of feats) {
        let built = null;
        if (f.type === 'line') built = lineFeature((f.parts || []).map((part) => smoothFlat(part, passes, false)), geomCopyProps(f), { stroke: '#0b6b45', idx: drawn.length });
        else if (f.type === 'poly') built = polygonFeature((f.parts || []).map((poly) => poly.map((ring) => smoothFlat(ring, passes, true))), geomCopyProps(f), { fill: '#0b6b45', idx: drawn.length });
        if (built) drawn.push(built);
      }
      showGeom({
        title: 'Smooth Features',
        kind,
        layerLabel: 'Smoothed',
        features: drawn,
        hint: `${GEOM_DRAWN} Smoothed copy of <b>${esc(st.meta.label)}</b> after ${fmtNum(passes)} pass${passes === 1 ? '' : 'es'}. Each vertex is the average of itself and its two neighbours.`,
        stats: [[fmtNum(drawn.length), 'features'], [fmtNum(passes), 'passes']],
        records: [{ features: drawn.length, passes }],
        table: resultTable(['Features', 'Passes'], [{ features: drawn.length, passes }], (r) => [fmtNum(r.features), fmtNum(r.passes)]),
        extra: { layer: st.meta.label, passes },
        emptyToast: 'No line or polygon to smooth',
      });
    };
  }, { map: true });
}

// ================================================================================
// ADDITIONAL TOPOLOGY & DATA QUALITY
// ================================================================================

function toolSelfIntersect() {
  const layers = layersOn(['polygon', 'line']);
  openModal('Check Self-Intersections', (body) => {
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a line or polygon layer.'); return; }
    body.innerHTML = `<p class="hint">Lists rings and lines whose own segments cross. A bend is not a cross, and touching at a shared vertex is not a cross. ${TOPO_PANEL}</p>
      ${overlayNote()}
      <div class="frow"><label>Layer</label><select id="si-layer">${layerOptions(layers)}</select></div>
      <div class="frow act"><button class="btn primary" id="si-run">${icon('query')} Check self-intersections</button></div>
      <div id="si-out" style="margin-top:10px"></div>`;
    const out = body.querySelector('#si-out');
    body.querySelector('#si-run').onclick = async () => {
      const st = L.get(body.querySelector('#si-layer').value);
      if (!st?.obj) await loadLayer(st);
      const feats = geomSource(st).filter((f) => f.type === 'poly' || f.type === 'line');
      const records = [];
      feats.forEach((f, i) => {
        const rings = f.type === 'line' ? f.parts : (f.parts || []).flat();
        const hits = rings.filter((ring) => ringSelfCrosses(ring)).length;
        if (hits) records.push({ feature: topoName(st, f, i), crossings: hits });
      });
      topoPanel(out, 'Check Self-Intersections',
        `<p><b>${fmtNum(records.length)}</b> feature${records.length === 1 ? '' : 's'} in ${esc(st.meta.label)} cross themselves.</p>`
        + statBoxes([[fmtNum(records.length), 'Features that cross themselves'], [fmtNum(feats.length), 'Features checked']])
        + resultTable(['Feature', 'Rings that cross'], records, (r) => [r.feature, fmtNum(r.crossings)], 'No ring or line crosses itself.'),
        records, { layer: st.meta.label });
    };
  }, { map: true });
}

function toolDuplicateGeom() {
  const layers = layersOn(['polygon', 'line', 'point']);
  openModal('Duplicate Geometries', (body) => {
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a point, line or polygon layer.'); return; }
    body.innerHTML = `<p class="hint">Lists features whose coordinates are the same. A reverse ring and a different starting vertex still count as the same shape. The tolerance is metres on the ground. ${TOPO_PANEL}</p>
      ${overlayNote()}
      <div class="frow"><label>Layer</label><select id="dg-layer">${layerOptions(layers)}</select></div>
      <div class="frow"><label>Tolerance (metres)</label><input id="dg-tol" type="number" min="0" step="1" value="1"></div>
      <div class="frow act"><button class="btn primary" id="dg-run">${icon('copy')} Find duplicates</button></div>
      <div id="dg-out" style="margin-top:10px"></div>`;
    const out = body.querySelector('#dg-out');
    body.querySelector('#dg-run').onclick = async () => {
      const st = L.get(body.querySelector('#dg-layer').value);
      const metres = Math.max(0, +body.querySelector('#dg-tol').value || 0);
      if (!st?.obj) await loadLayer(st);
      const feats = geomSource(st);
      const buckets = new Map();
      feats.forEach((f, i) => {
        const key = geometrySignature(f, metres);
        if (!key) return;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(topoName(st, f, i));
      });
      const records = [];
      for (const names of buckets.values()) {
        if (names.length < 2) continue;
        records.push({ features: names.join(', '), copies: names.length });
      }
      records.sort((a, b) => b.copies - a.copies);
      topoPanel(out, 'Duplicate Geometries',
        `<p><b>${fmtNum(records.length)}</b> group${records.length === 1 ? '' : 's'} of matching geometry in ${esc(st.meta.label)}.</p>`
        + statBoxes([[fmtNum(records.length), 'Duplicate groups'], [fmtNum(metres) + ' m', 'Tolerance']])
        + resultTable(['Features', 'Copies'], records, (r) => [r.features, fmtNum(r.copies)], 'No two features share coordinates.'),
        records, { layer: st.meta.label, metres });
    };
  }, { map: true });
}

function toolSnapToGrid() {
  const layers = layersOn(['polygon', 'line', 'point']);
  openModal('Snap to Grid', (body) => {
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a point, line or polygon layer.'); return; }
    body.innerHTML = `<p class="hint">Rounds every longitude and latitude to the grid step, in degrees, and draws the copy. The source layer is not changed.</p>
      ${overlayNote()}
      <div class="frow"><label>Layer</label><select id="sg-layer">${layerOptions(layers)}</select></div>
      <div class="frow"><label>Grid step (degrees)</label><input id="sg-size" type="number" min="0.00001" step="0.001" value="0.01"></div>
      <div class="frow act"><button class="btn primary" id="sg-run">${icon('grid')} Snap to grid</button></div>`;
    body.querySelector('#sg-run').onclick = async () => {
      const st = L.get(body.querySelector('#sg-layer').value);
      const step = Math.abs(+body.querySelector('#sg-size').value || 0);
      if (!st?.obj) await loadLayer(st);
      const drawn = [];
      const records = [];
      let moved = 0, seen = 0;
      geomSource(st).forEach((f, i) => {
        const next = f.type === 'poly'
          ? f.parts.map((poly) => poly.map((ring) => snapFlatToDegrees(ring, step)))
          : f.type === 'line'
            ? f.parts.map((part) => snapFlatToDegrees(part, step))
            : snapFlatToDegrees(f.parts, step);
        const countMoved = (a, b) => { let n = 0; for (let k = 0; k < a.length && k < b.length; k += 2) { seen++; if (a[k] !== b[k] || a[k + 1] !== b[k + 1]) n++; } return n; };
        let changed = 0;
        if (f.type === 'point') changed = countMoved(f.parts, next);
        else if (f.type === 'line') f.parts.forEach((part, pi) => { changed += countMoved(part, next[pi] || []); });
        else f.parts.forEach((poly, pi) => poly.forEach((ring, ri) => { changed += countMoved(ring, next[pi]?.[ri] || []); }));
        moved += changed;
        const copy = topoSnapCopy(f, next, { ...geomCopyProps(f), snapped_vertices: changed, source: topoName(st, f, i) }, { fill: '#0f766e', stroke: '#0f766e' }, i);
        if (copy) drawn.push(copy);
        if (changed) records.push({ feature: topoName(st, f, i), vertices_moved: changed });
      });
      showGeom({
        title: 'Snap to Grid',
        kind: 'polygon',
        layerLabel: 'Grid snap · ' + st.meta.label,
        color: '#0f766e',
        features: drawn,
        hint: `${fmtNum(moved)} of ${fmtNum(seen)} vertices in ${esc(st.meta.label)} moved onto a ${step}° grid of longitude and latitude. ${GEOM_DRAWN}`,
        stats: [[fmtNum(moved), 'Vertices moved'], [step + '°', 'Grid step']],
        records,
        table: resultTable(['Feature', 'Vertices moved'], records, (r) => [r.feature, fmtNum(r.vertices_moved)], 'Every vertex was already on the grid.'),
        extra: { layer: st.meta.label, step_degrees: step, moved },
      });
    };
  }, { map: true });
}

// ================================================================================
// ADDITIONAL NETWORK & ROUTING
// ================================================================================

function toolNetworkBuffer() {
  const lines = layersOn(['line']);
  const points = layersOn(['point']);
  openModal('Network Buffer', (body) => {
    if (!lines.length || !points.length) { body.innerHTML = overlayNeed('Turn on a line layer and a point layer.'); return; }
    body.innerHTML = `<p class="hint">Draws the lines you can travel within the distance of each point. A point farther from a line than the snap distance is left out. This is not a circle around the point. The source layers are not changed.</p>
      ${overlayNote()}
      <div class="frow"><label>Network</label><select id="nb-net">${layerOptions(lines)}</select></div>
      <div class="frow"><label>Points</label><select id="nb-pts">${layerOptions(points)}</select></div>
      <div class="frow"><label>Distance along the lines (km)</label><input id="nb-dist" type="number" min="0" step="0.1" value="5"></div>
      <div class="frow"><label>Join vertices within (m)</label><input id="nb-join" type="number" min="0" step="1" value="25"></div>
      <div class="frow"><label>A point must be within (km)</label><input id="nb-snap" type="number" min="0" step="0.1" value="2"></div>
      <div class="frow act"><button class="btn primary" id="nb-run">${icon('target')} Draw along the lines</button></div>`;
    body.querySelector('#nb-run').onclick = async () => {
      const net = L.get(body.querySelector('#nb-net').value);
      const pts = L.get(body.querySelector('#nb-pts').value);
      const distKm = Math.max(0, +body.querySelector('#nb-dist').value || 0);
      const join = Math.max(0, +body.querySelector('#nb-join').value || 0);
      const snapKm = Math.max(0, +body.querySelector('#nb-snap').value || 0);
      if (!net?.obj) await loadLayer(net);
      if (!pts?.obj) await loadLayer(pts);
      const graph = buildLineNetwork(netSource(net), join);
      const origins = [];
      const off = [];
      let extra = 0;
      for (const [f, i] of geomSource(pts).map((f, i) => [f, i])) {
        if (f.type !== 'point') continue;
        for (let k = 0; k < f.parts.length; k += 2) {
          const name = topoName(pts, f, i);
          if (origins.length >= 80) { extra++; continue; }
          if (!networkNearest(graph, f.parts[k], f.parts[k + 1], snapKm)) { off.push(name); continue; }
          origins.push([f.parts[k], f.parts[k + 1]]);
        }
      }
      const reach = networkReach(graph, origins, distKm, snapKm);
      const note = (extra ? ` ${fmtNum(extra)} further points were not used. Select the points you want if the layer has more than 80.` : '')
        + (off.length ? ` ${fmtNum(off.length)} ${off.length === 1 ? 'point was' : 'points were'} farther from a line than ${fmtNum(snapKm)} km and ${off.length === 1 ? 'was' : 'were'} left out.` : '');
      showNetLines({
        title: 'Network Buffer',
        layerLabel: 'Along lines · ' + net.meta.label,
        lines: reach.lines,
        hint: `${fmtNum(reach.reachedKm)} km of ${esc(net.meta.label)} is within ${fmtNum(distKm)} km along the lines of ${fmtNum(origins.length)} point${origins.length === 1 ? '' : 's'}. This is not a circle.${note} ${GEOM_DRAWN}`,
        stats: [[fmtNum(reach.reachedKm) + ' km', 'Along the lines'], [fmtNum(off.length), 'Not on a line']],
        records: off.map((name) => ({ point: name, note: 'Farther than the snap distance' })),
        table: resultTable(['Left out', 'Why'], off.map((name) => ({ point: name, note: 'Farther than the snap distance' })), (r) => [r.point, r.note], 'Every used point was on a line.'),
        extra: { network: net.meta.label, points: pts.meta.label, reachable_km: +reach.reachedKm.toFixed(3), left_out: off.length },
        emptyToast: 'No point was close enough to a line',
      });
    };
  }, { map: true });
}

function toolNetworkConnect() {
  const layers = layersOn(['line']);
  openModal('Network Connectivity', (body) => {
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a line layer.'); return; }
    body.innerHTML = `<p class="hint">Counts separate pieces. Two lines are the same piece when a vertex of one is within the snap distance of a vertex of the other. A dead end is a line that stops. It is not a separate piece. ${TOPO_PANEL}</p>
      ${overlayNote()}
      <div class="frow"><label>Network</label><select id="nc-layer">${layerOptions(layers)}</select></div>
      <div class="frow"><label>Join vertices within (m)</label><input id="nc-join" type="number" min="0" step="1" value="25"></div>
      <div class="frow act"><button class="btn primary" id="nc-run">${icon('query')} Check connectivity</button></div>
      <div id="nc-out" style="margin-top:10px"></div>`;
    const out = body.querySelector('#nc-out');
    body.querySelector('#nc-run').onclick = async () => {
      const st = L.get(body.querySelector('#nc-layer').value);
      const join = Math.max(0, +body.querySelector('#nc-join').value || 0);
      if (!st?.obj) await loadLayer(st);
      const report = networkComponents(buildLineNetwork(netSource(st), join));
      const records = report.groups.map((g, i) => ({ piece: 'Piece ' + (i + 1), lines: g.lines, km: +g.km.toFixed(3), example: g.sample }));
      const linked = report.components <= 1 ? 'The lines are one piece.' : `The lines are ${fmtNum(report.components)} separate pieces.`;
      topoPanel(out, 'Network Connectivity',
        `<p>${linked} ${fmtNum(report.deadEnds)} dead end${report.deadEnds === 1 ? '' : 's'} — a line that stops, not a break.</p>`
        + statBoxes([[fmtNum(report.components), 'Pieces'], [fmtNum(report.deadEnds), 'Dead ends'], [fmtNum(report.lines), 'Lines']])
        + resultTable(['Piece', 'Lines', 'km', 'Example'], records, (r) => [r.piece, fmtNum(r.lines), fmtNum(r.km), r.example], 'No lines to check.'),
        records, { layer: st.meta.label, pieces: report.components, dead_ends: report.deadEnds });
    };
  }, { map: true });
}

function toolMultiPath() {
  const lines = layersOn(['line']);
  const points = layersOn(['point']);
  openModal('Multi-Stop Route', (body) => {
    if (!lines.length || !points.length) { body.innerHTML = overlayNeed('Turn on a line layer and a point layer.'); return; }
    body.innerHTML = `<p class="hint">Orders the stops by nearest neighbour along the lines, then draws that route. It starts at the first stop, does not return to the start, and is not a proven shortest tour. A stop farther from a line than the snap distance is left out. More than 12 stops are not routed — select the ones you want. The source layers are not changed.</p>
      ${overlayNote()}
      <div class="frow"><label>Network</label><select id="mp-net">${layerOptions(lines)}</select></div>
      <div class="frow"><label>Stops</label><select id="mp-pts">${layerOptions(points)}</select></div>
      <div class="frow"><label>Join vertices within (m)</label><input id="mp-join" type="number" min="0" step="1" value="25"></div>
      <div class="frow"><label>A stop must be within (km)</label><input id="mp-snap" type="number" min="0" step="0.1" value="2"></div>
      <div class="frow act"><button class="btn primary" id="mp-run">${icon('ruler')} Route the stops</button></div>`;
    body.querySelector('#mp-run').onclick = async () => {
      const net = L.get(body.querySelector('#mp-net').value);
      const ptSt = L.get(body.querySelector('#mp-pts').value);
      const join = Math.max(0, +body.querySelector('#mp-join').value || 0);
      const snapKm = Math.max(0, +body.querySelector('#mp-snap').value || 0);
      if (!net?.obj) await loadLayer(net);
      if (!ptSt?.obj) await loadLayer(ptSt);
      const graph = buildLineNetwork(netSource(net), join);
      const stops = [];
      const off = [];
      let extra = 0;
      geomSource(ptSt).forEach((f, i) => {
        if (f.type !== 'point') return;
        for (let k = 0; k < f.parts.length; k += 2) {
          const name = topoName(ptSt, f, i);
          if (stops.length >= 12) { extra++; return; }
          if (!networkNearest(graph, f.parts[k], f.parts[k + 1], snapKm)) { off.push(name); return; }
          stops.push({ x: f.parts[k], y: f.parts[k + 1], name });
        }
      });
      if (stops.length < 2) {
        showNetLines({ title: 'Multi-Stop Route', lines: [], hint: 'At least two stops have to lie on the lines. ' + (off.length ? fmtNum(off.length) + ' were too far from a line.' : ''), emptyToast: 'Need two stops on the lines', records: off.map((name) => ({ stop: name })) });
        return;
      }
      const order = [0];
      const seen = new Set([0]);
      const parts = [];
      let total = 0;
      let cursor = 0;
      let blocked = '';
      while (order.length < stops.length) {
        let best = -1, bestKm = Infinity, bestPath = null;
        for (let i = 0; i < stops.length; i++) {
          if (seen.has(i)) continue;
          const path = networkPath(graph, stops[cursor].x, stops[cursor].y, stops[i].x, stops[i].y, snapKm);
          if (path.ok && path.reason === 'same-spot') { best = i; bestKm = 0; bestPath = path; break; }
          if (!path.ok || !(path.km >= 0)) continue;
          if (path.km < bestKm) { bestKm = path.km; best = i; bestPath = path; }
        }
        if (best < 0 || !bestPath) { blocked = stops.filter((_, i) => !seen.has(i)).map((s) => s.name).join(', '); break; }
        order.push(best);
        seen.add(best);
        if (bestPath.flat) parts.push(bestPath.flat);
        total += bestPath.km || 0;
        cursor = best;
      }
      const names = order.map((i) => stops[i].name);
      const note = (extra ? ` ${fmtNum(extra)} further stops were not routed.` : '')
        + (off.length ? ` ${fmtNum(off.length)} were farther from a line than ${fmtNum(snapKm)} km.` : '')
        + (blocked ? ` The route stops before ${esc(blocked)} because no line connects them.` : '');
      showNetLines({
        title: 'Multi-Stop Route',
        layerLabel: 'Route · ' + net.meta.label,
        parts,
        props: { stops: names.join(' → '), length_km: +total.toFixed(3) },
        hint: `${fmtNum(total)} km along ${esc(net.meta.label)} through ${fmtNum(names.length)} stops, nearest neighbour from ${esc(names[0])}. Not a straight line, and not a proven shortest tour.${note} ${GEOM_DRAWN}`,
        stats: [[fmtNum(total) + ' km', 'Along the lines'], [fmtNum(names.length), 'Stops routed']],
        records: names.map((name, i) => ({ stop: i + 1, name })),
        table: resultTable(['Order', 'Stop'], names.map((name, i) => ({ stop: i + 1, name })), (r) => [String(r.stop), r.name]),
        extra: { network: net.meta.label, stops: ptSt.meta.label, length_km: +total.toFixed(3) },
        emptyToast: blocked ? 'Those stops are not connected' : 'No route was drawn',
      });
    };
  });
}

// ================================================================================
// NEW: GENERATION TOOLS
// ================================================================================

const GEN_CELL_CAP = 2500;
const GEN_HEX_CAP = 4000;
const GEN_DRAW_CAP = 500;
const GEN_SAMPLE_CAP = 2000;
const GEN_POINT_CAP = 5000;
function generationExtent() {
  const focus = typeof map.clipBounds === 'function' ? map.clipBounds() : null;
  const focused = !!(focus && focus.every(Number.isFinite) && focus[2] > focus[0] && focus[3] > focus[1]);
  const box = focused ? focus : viewBoundsLL();
  const [west, south, east, north] = box || [];
  if (![west, south, east, north].every(Number.isFinite) || !(east > west) || !(north > south)) return null;
  return { west, south, east, north, where: focused ? 'focus area' : 'current view' };
}
function extentKm(ext) {
  const midLat = (ext.south + ext.north) / 2;
  const midLon = (ext.west + ext.east) / 2;
  return {
    width: haversineKm([ext.west, midLat], [ext.east, midLat]),
    height: haversineKm([midLon, ext.south], [midLon, ext.north]),
  };
}
function niceKm(km) {
  if (!(km > 0) || !Number.isFinite(km)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(km)));
  const n = km / pow;
  const nice = n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10;
  const out = nice * pow;
  return out >= 10 ? Math.round(out) : +out.toFixed(2);
}
function suggestCellKm(ext, across = 16) {
  const km = extentKm(ext);
  return niceKm(Math.max(km.width, km.height, 0.1) / across);
}
function focusIsBox() {
  return !map.clip || map.clip.type === 'rect';
}
function randomInExtent(ext) {
  const x0 = mercX(ext.west), x1 = mercX(ext.east);
  const y0 = mercY(ext.north), y1 = mercY(ext.south);
  for (let n = 0; n < 80; n++) {
    const x = x0 + Math.random() * (x1 - x0);
    const y = y0 + Math.random() * (y1 - y0);
    if (map.clipContainsPoint(x, y)) return { x, y, lon: unX(x), lat: unY(y) };
  }
  return null;
}
function genRefused(title, hint, toastText) {
  showGeom({
    title, kind: 'polygon', features: [], hint, keepOpen: true, records: [], stats: [], table: '',
    emptyToast: toastText || 'Nothing was drawn',
  });
}
function cellGroundKm(cell) {
  const midLat = (cell.south + cell.north) / 2;
  const midLon = (cell.west + cell.east) / 2;
  return {
    width: haversineKm([cell.west, midLat], [cell.east, midLat]),
    height: haversineKm([midLon, cell.south], [midLon, cell.north]),
  };
}
function toolFishnet() {
  const ext0 = generationExtent();
  const suggested = ext0 ? suggestCellKm(ext0) : 25;
  openModal('Fishnet / Grid', (body) => {
    body.innerHTML = `<p class="hint">Draws a rectangular grid over the current view, or over the focus area if one is set. Each cell is the size you set, in kilometres on the ground, measured at the centre of that area. The grid starts at the south-west corner. A cell may extend past the edge so the area is covered. More than ${fmtNum(GEN_CELL_CAP)} cells are not drawn. This does not edit a layer.</p>
      <div class="frow"><label>Cell size (km)</label><input id="fn-size" type="number" min="0.01" step="0.1" value="${suggested}"></div>
      <div class="frow act"><button class="btn primary" id="fn-run" type="button">${icon('grid')} Draw grid</button></div>`;
    body.querySelector('#fn-run').onclick = () => {
      const ext = generationExtent();
      const sizeKm = +body.querySelector('#fn-size').value;
      if (!ext || !(sizeKm > 0)) { genRefused('Fishnet / Grid', 'Set a cell size in kilometres. The map has to be showing an area.'); return; }
      const grid = fishnetCells(ext.west, ext.south, ext.east, ext.north, sizeKm, GEN_CELL_CAP);
      if (!grid.cells.length) {
        const hint = grid.tooMany
          ? `A ${fmtNum(sizeKm)} km cell over the ${ext.where} would make ${fmtNum(grid.needed)} cells. The most this draws is ${fmtNum(GEN_CELL_CAP)}, and a partial grid would not cover the area. Use a larger cell, or zoom in.`
          : 'Set a cell size in kilometres. The map has to be showing an area.';
        genRefused('Fishnet / Grid', hint, grid.tooMany ? 'Zoom in or use a larger cell' : 'Nothing was drawn');
        return;
      }
      const kept = grid.cells.filter((cell) => focusIsBox() || map.clipContainsPoint(mercX((cell.west + cell.east) / 2), mercY((cell.south + cell.north) / 2)));
      if (!kept.length) { genRefused('Fishnet / Grid', 'No cell centre fell inside the focus area. Use a smaller cell, or zoom in.'); return; }
      const mid = grid.cells[Math.floor(grid.rows / 2) * grid.cols + Math.floor(grid.cols / 2)] || kept[0];
      const measured = cellGroundKm(mid);
      const features = kept.map((cell, i) => polygonFeature([[cell.ring]], { column: cell.col + 1, row: cell.row + 1, size_km: +sizeKm.toFixed(3) }, { fill: '#0b6b45', stroke: '#0b3d2e', idx: i })).filter(Boolean);
      const dropped = grid.cells.length - kept.length;
      const latNote = grid.clamped ? ' The grid stops at 80° latitude.' : '';
      const dropNote = dropped ? ` ${fmtNum(dropped)} cells had their centre outside the focus area and were left off.` : '';
      showGeom({
        title: 'Fishnet / Grid',
        kind: 'polygon',
        layerLabel: 'Fishnet ' + fmtNum(sizeKm) + ' km',
        features,
        hint: `${fmtNum(features.length)} cells of ${fmtNum(sizeKm)} km over the ${ext.where}. At the centre each cell is about ${fmtNum(measured.width)} km by ${fmtNum(measured.height)} km on the ground.${latNote}${dropNote} ${GEOM_DRAWN}`,
        stats: [[fmtNum(features.length), 'Cells'], [fmtNum(measured.width) + ' km', 'Width at centre'], [fmtNum(grid.cols) + ' × ' + fmtNum(grid.rows), 'Columns × rows']],
        records: [{ cells: features.length, columns: grid.cols, rows: grid.rows, size_km: +sizeKm.toFixed(3), width_km: +measured.width.toFixed(3), height_km: +measured.height.toFixed(3) }],
        table: resultTable(['Cells', 'Columns', 'Rows', 'km'], [{ cells: features.length, columns: grid.cols, rows: grid.rows, size_km: sizeKm }], (r) => [fmtNum(r.cells), fmtNum(r.columns), fmtNum(r.rows), fmtNum(r.size_km)]),
        extra: { cells: features.length, size_km: +sizeKm.toFixed(3), where: ext.where },
        emptyToast: 'No cell was drawn',
        keepOpen: true,
      });
    };
  }, { map: true });
}

function toolRandomPoints() {
  openModal('Random Points', (body) => {
    body.innerHTML = `<p class="hint">Places random points inside the current view, or inside the focus area if one is set. They are spread across that area on the map. A focus area that is not a rectangle only keeps points that fall inside it. This does not edit a layer.</p>
      <div class="frow"><label>Number of points</label><input id="rp-count" type="number" min="1" max="${GEN_POINT_CAP}" step="1" value="100"></div>
      <div class="frow act"><button class="btn primary" id="rp-run" type="button">${icon('point')} Place points</button></div>`;
    body.querySelector('#rp-run').onclick = () => {
      const ext = generationExtent();
      if (!ext) { genRefused('Random Points', 'The map is not showing an area to fill.'); return; }
      const asked = Math.max(1, Math.round(+body.querySelector('#rp-count').value || 1));
      const count = Math.min(asked, GEN_POINT_CAP);
      const features = [];
      let tries = 0;
      while (features.length < count && tries < count * 80) {
        tries++;
        const p = randomInExtent(ext);
        if (!p) break;
        const built = pointFeature(p.x, p.y, { n: features.length + 1 }, { fill: '#0b6b45', idx: features.length });
        if (built) features.push(built);
      }
      const capNote = asked > count ? ` Only ${fmtNum(count)} are placed.` : '';
      const miss = features.length < count ? ` ${fmtNum(count - features.length)} could not be placed inside the ${ext.where}.` : '';
      showGeom({
        title: 'Random Points',
        kind: 'point',
        layerLabel: 'Random points',
        features,
        hint: `${fmtNum(features.length)} random points inside the ${ext.where}.${capNote}${miss} ${GEOM_DRAWN}`,
        stats: [[fmtNum(features.length), 'Points'], [ext.where, 'Inside']],
        records: [{ points: features.length, where: ext.where }],
        table: resultTable(['Points', 'Inside'], [{ points: features.length, where: ext.where }], (r) => [fmtNum(r.points), r.where]),
        extra: { points: features.length, where: ext.where },
        emptyToast: 'No point fell inside that area',
        keepOpen: true,
      });
    };
  }, { map: true });
}

function toolHexbin() {
  const layers = layersOn(['point']);
  const first = layers[0] && generationExtentFromLayer(layers[0][1]);
  const suggested = first ? suggestCellKm(first, 12) : 10;
  openModal('Hexagonal Binning', (body) => {
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a point layer.'); return; }
    body.innerHTML = `<p class="hint">Draws a hexagon for each group of points and writes how many fell in it. The width is the distance across the hexagon, flat side to flat side, in kilometres on the ground. A point is counted in the hexagon whose centre is nearest. This is not a square grid. The source points are not changed.</p>
      ${overlayNote()}
      <div class="frow"><label>Points</label><select id="hx-layer">${layerOptions(layers)}</select></div>
      <div class="frow"><label>Width (km)</label><input id="hx-size" type="number" min="0.01" step="0.1" value="${suggested}"></div>
      <div class="frow act"><button class="btn primary" id="hx-run" type="button">${icon('polygon')} Draw hexagons</button></div>`;
    body.querySelector('#hx-run').onclick = async () => {
      const st = L.get(body.querySelector('#hx-layer').value);
      const sizeKm = +body.querySelector('#hx-size').value;
      if (!st) return;
      if (!st.obj) await loadLayer(st);
      if (!(sizeKm > 0)) { genRefused('Hexagonal Binning', 'Set the hexagon width in kilometres.'); return; }
      const pts = [];
      for (const f of geomSource(st)) {
        if (f.type !== 'point') continue;
        for (let i = 0; i < f.parts.length; i += 2) pts.push({ x: f.parts[i], y: f.parts[i + 1] });
      }
      if (!pts.length) { genRefused('Hexagonal Binning', 'That layer has no point to bin.'); return; }
      const bins = hexBinPoints(pts, sizeKm, GEN_HEX_CAP);
      const ramp = rampStops('cividis');
      const features = bins.hexes.map((hex, i) => {
        const t = bins.max > 1 ? (hex.count - 1) / (bins.max - 1) : 0.55;
        return polygonFeature([[hex.ring]], { points: hex.count }, { fill: rampColor(ramp, t), stroke: '#0b3d2e', idx: i });
      }).filter(Boolean);
      const left = bins.truncated ? ` ${fmtNum(bins.total - bins.hexes.length)} emptier hexagons were left off.` : '';
      const records = bins.hexes.map((hex, i) => ({ hexagon: i + 1, points: hex.count }));
      showGeom({
        title: 'Hexagonal Binning',
        kind: 'polygon',
        layerLabel: 'Hexagons · ' + st.meta.label,
        features,
        hint: `${fmtNum(features.length)} hexagons, ${fmtNum(sizeKm)} km across, from ${fmtNum(pts.length)} points of ${esc(st.meta.label)}. The fullest holds ${fmtNum(bins.max)}. Colour follows the count. A hexagon with no points is not drawn.${left} ${GEOM_DRAWN}`,
        stats: [[fmtNum(features.length), 'Hexagons'], [fmtNum(bins.max), 'Most points'], [fmtNum(sizeKm) + ' km', 'Width']],
        records,
        table: resultTable(['Hexagon', 'Points'], records, (r) => [String(r.hexagon), fmtNum(r.points)], 'No point fell in a hexagon.'),
        extra: { layer: st.meta.label, hexagons: features.length, width_km: +sizeKm.toFixed(3), points: pts.length },
        emptyToast: 'No hexagon was drawn',
        keepOpen: true,
      });
    };
  }, { map: true });
}
function generationExtentFromLayer(st) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity, any = false;
  for (const f of geomSource(st)) {
    if (!f?.bb) continue;
    const ll = mercBoundsToLonLat(f.bb);
    if (!ll || !ll.every(Number.isFinite)) continue;
    any = true;
    w = Math.min(w, ll[0]); e = Math.max(e, ll[2]); s = Math.min(s, ll[1]); n = Math.max(n, ll[3]);
  }
  if (!any || !(e > w) || !(n > s)) return null;
  return { west: w, south: s, east: e, north: n, where: 'layer' };
}

function toolGridPoints() {
  const ext0 = generationExtent();
  const suggested = ext0 ? suggestCellKm(ext0) : 25;
  openModal('Regular Point Grid', (body) => {
    body.innerHTML = `<p class="hint">Places points on a regular grid over the current view, or the focus area if one is set. The spacing is kilometres on the ground, measured at the centre. The grid starts at the south-west corner. More than ${fmtNum(GEN_CELL_CAP)} points are not drawn. This does not edit a layer.</p>
      <div class="frow"><label>Spacing (km)</label><input id="gp-spacing" type="number" min="0.01" step="0.1" value="${suggested}"></div>
      <div class="frow act"><button class="btn primary" id="gp-run" type="button">${icon('point')} Draw points</button></div>`;
    body.querySelector('#gp-run').onclick = () => {
      const ext = generationExtent();
      const spacingKm = +body.querySelector('#gp-spacing').value;
      if (!ext || !(spacingKm > 0)) { genRefused('Regular Point Grid', 'Set a spacing in kilometres. The map has to be showing an area.'); return; }
      const grid = regularGridPoints(ext.west, ext.south, ext.east, ext.north, spacingKm, GEN_CELL_CAP);
      if (!grid.points.length) {
        const hint = grid.tooMany
          ? `A ${fmtNum(spacingKm)} km spacing over the ${ext.where} would make ${fmtNum(grid.needed)} points. The most this draws is ${fmtNum(GEN_CELL_CAP)}, and a partial grid would not cover the area. Use a larger spacing, or zoom in.`
          : 'Set a spacing in kilometres. The map has to be showing an area.';
        genRefused('Regular Point Grid', hint, grid.tooMany ? 'Zoom in or use a larger spacing' : 'Nothing was drawn');
        return;
      }
      const kept = grid.points.filter((p) => focusIsBox() || map.clipContainsPoint(p.x, p.y));
      if (!kept.length) { genRefused('Regular Point Grid', 'No grid point fell inside the focus area.'); return; }
      const features = kept.map((p, i) => pointFeature(p.x, p.y, { column: p.col + 1, row: p.row + 1 }, { fill: '#0b6b45', idx: i })).filter(Boolean);
      let spacing = spacingKm;
      const pair = kept.find((p, i) => i && p.row === kept[0].row);
      if (pair) spacing = haversineKm([unX(kept[0].x), unY(kept[0].y)], [unX(pair.x), unY(pair.y)]);
      const dropped = grid.points.length - kept.length;
      showGeom({
        title: 'Regular Point Grid',
        kind: 'point',
        layerLabel: 'Grid points ' + fmtNum(spacingKm) + ' km',
        features,
        hint: `${fmtNum(features.length)} points over the ${ext.where}, ${fmtNum(spacing)} km apart on the ground.${dropped ? ` ${fmtNum(dropped)} fell outside the focus area.` : ''} ${GEOM_DRAWN}`,
        stats: [[fmtNum(features.length), 'Points'], [fmtNum(spacing) + ' km', 'Spacing']],
        records: [{ points: features.length, spacing_km: +spacing.toFixed(3) }],
        table: resultTable(['Points', 'Spacing (km)'], [{ points: features.length, spacing_km: spacing }], (r) => [fmtNum(r.points), fmtNum(r.spacing_km)]),
        extra: { points: features.length, spacing_km: +spacingKm.toFixed(3), where: ext.where },
        emptyToast: 'No point was drawn',
        keepOpen: true,
      });
    };
  }, { map: true });
}


// ================================================================================
// ADDITIONAL GEOMETRY OPERATIONS
// ================================================================================

function toolFeatureBuffer() {
  openModal('Feature Buffer', (body) => {
    const layers = layersOn(['point', 'line', 'polygon']);
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a point, line or polygon layer.'); return; }
    body.innerHTML = `<p class="hint">Draws a zone around every feature. Points become circles, lines become corridors, polygons grow outward. ${GEOM_DRAWN}</p>` +
      `<div class="frow"><label>Layer</label><select id="fb-layer">${layerOptions(layers, 0)}</select></div>` +
      `<div class="frow"><label>Distance (km)</label><input id="fb-dist" type="number" min="0.01" step="0.01" value="1"></div>` +
      `<div class="frow act"><button class="btn primary" id="fb-run" type="button">${icon('target')} Buffer features</button></div>`;
    body.querySelector('#fb-run').onclick = async () => {
      const st = L.get(body.querySelector('#fb-layer').value);
      const distKm = Math.max(0.01, +body.querySelector('#fb-dist').value || 1);
      if (!st) return;
      if (!st.obj) await loadLayer(st);
      const feats = geomSource(st);
      const zones = [];
      for (const f of feats) {
        const bf = bufferFeature(f, distKm * 1000);
        const built = bf && polygonFeature(bf.parts, geomCopyProps(f), { fill: '#0b6b45', idx: zones.length });
        if (built) zones.push(built);
      }
      showGeom({
        title: 'Feature Buffer',
        kind: 'polygon',
        layerLabel: 'Buffer ' + distKm + ' km',
        features: zones,
        hint: `${GEOM_DRAWN} ${fmtNum(distKm)} km around <b>${esc(st.meta.label)}</b>. The distance is metres on the ground.`,
        stats: [[fmtNum(zones.length), 'zones'], [fmtNum(distKm), 'km']],
        records: [{ zones: zones.length, distance_km: distKm }],
        table: resultTable(['Zones', 'Distance (km)'], [{ zones: zones.length, distKm }], (r) => [fmtNum(r.zones), fmtNum(r.distKm)]),
        extra: { layer: st.meta.label, distance_km: distKm },
        emptyToast: 'No feature could be buffered',
      });
    };
  }, { map: true });
}

function toolBoundingBox() {
  openModal('Bounding Box / Envelope', (body) => {
    const layers = layersOn(['point', 'line', 'polygon']);
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a point, line or polygon layer.'); return; }
    body.innerHTML = `<p class="hint">Draws the rectangle around each feature. A single point has no area, so it is skipped. ${GEOM_DRAWN}</p>` +
      `<div class="frow"><label>Layer</label><select id="bb-layer">${layerOptions(layers, 0)}</select></div>` +
      `<div class="frow act"><button class="btn primary" id="bb-run" type="button">${icon('polygon')} Create bounding boxes</button></div>`;
    body.querySelector('#bb-run').onclick = async () => {
      const st = L.get(body.querySelector('#bb-layer').value);
      if (!st) return;
      if (!st.obj) await loadLayer(st);
      const feats = geomSource(st);
      const boxes = [];
      let skipped = 0;
      for (const f of feats) {
        const ring = featureBBoxRing(f);
        const built = ring && polygonFeature([[ring]], geomCopyProps(f), { fill: '#0b6b45', idx: boxes.length });
        if (built) boxes.push(built);
        else skipped++;
      }
      showGeom({
        title: 'Bounding Box / Envelope',
        kind: 'polygon',
        layerLabel: 'Bounding boxes',
        features: boxes,
        hint: `${GEOM_DRAWN} One rectangle per feature of <b>${esc(st.meta.label)}</b>. A point, or a feature with no extent, is not a box.`,
        stats: [[fmtNum(boxes.length), 'boxes'], [fmtNum(skipped), 'skipped']],
        records: [{ boxes: boxes.length, skipped }],
        table: resultTable(['Boxes', 'Skipped'], [{ boxes: boxes.length, skipped }], (r) => [fmtNum(r.boxes), fmtNum(r.skipped)]),
        extra: { layer: st.meta.label, boxes: boxes.length },
        emptyToast: 'No feature had an extent to box',
      });
    };
  }, { map: true });
}

function toolVerticesToPoints() {
  openModal('Vertices to Points', (body) => {
    const layers = layersOn(['point', 'line', 'polygon']);
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a point, line or polygon layer.'); return; }
    body.innerHTML = `<p class="hint">Draws one point for every vertex. A closed ring is not repeated at its first point. ${GEOM_DRAWN}</p>` +
      `<div class="frow"><label>Layer</label><select id="vtp-layer">${layerOptions(layers, 0)}</select></div>` +
      `<div class="frow act"><button class="btn primary" id="vtp-run" type="button">${icon('point')} Extract vertices</button></div>`;
    body.querySelector('#vtp-run').onclick = async () => {
      const st = L.get(body.querySelector('#vtp-layer').value);
      if (!st) return;
      if (!st.obj) await loadLayer(st);
      const feats = geomSource(st);
      const pts = [];
      for (const f of feats) {
        for (const [x, y] of featureVertices(f)) {
          const built = pointFeature(x, y, geomCopyProps(f), { fill: '#0b6b45', idx: pts.length });
          if (built) pts.push(built);
        }
      }
      showGeom({
        title: 'Vertices to Points',
        kind: 'point',
        layerLabel: 'Vertices',
        features: pts,
        hint: `${GEOM_DRAWN} Every vertex of <b>${esc(st.meta.label)}</b>. The closing point of a ring is not drawn twice.`,
        stats: [[fmtNum(pts.length), 'points'], [fmtNum(feats.length), 'features']],
        records: [{ points: pts.length, features: feats.length }],
        table: resultTable(['Points', 'Features'], [{ points: pts.length, features: feats.length }], (r) => [fmtNum(r.points), fmtNum(r.features)]),
        extra: { layer: st.meta.label, points: pts.length },
        emptyToast: 'No vertex to draw',
      });
    };
  }, { map: true });
}

// ================================================================================
// ADDITIONAL TOPOLOGY & DATA QUALITY
// ================================================================================

function toolEraseFeatures() {
  openModal('Feature Erase / Difference', (body) => {
    const layers = layersOn(['polygon']);
    if (layers.length < 2) { body.innerHTML = overlayNeed('Turn on two polygon layers. The second is cut out of the first.'); return; }
    body.innerHTML = '<p>Cuts the second layer out of the first. A polygon that is only partly covered keeps the rest. One that is fully covered is removed.</p>' + overlayNote() +
      `<div class="frow"><label>Input</label><select id="ef-input">${layerOptions(layers, 0)}</select></div>` +
      `<div class="frow"><label>Cut out</label><select id="ef-erase">${layerOptions(layers, 1)}</select></div>` +
      `<div class="frow act"><button class="btn primary" id="ef-run">${icon('trash')} Run difference</button></div>`;
    bindDistinctLayers(body.querySelector('#ef-input'), body.querySelector('#ef-erase'), body.querySelector('#ef-run'));
    body.querySelector('#ef-run').onclick = () => runOverlay(() => runErase(body.querySelector('#ef-input').value, body.querySelector('#ef-erase').value));
  });
}
async function runErase(inputId, eraseId) {
  if (!inputId || !eraseId || inputId === eraseId) { toast('Pick two different layers'); return; }
  const job = beginOverlayJob();
  const input = L.get(inputId), eraser = L.get(eraseId);
  if (!input || !eraser) return;
  closeModal();
  if (!(await yieldOverlay(job, 'Cutting ' + eraser.meta.label + ' out of ' + input.meta.label))) return;
  if (!input.obj) await loadLayer(input);
  if (!eraser.obj) await loadLayer(eraser);
  if (!overlayAlive(job)) return;
  const subjects = analysisFeatures(input).filter((f) => f.type === 'poly');
  const blades = analysisFeatures(eraser).filter((f) => f.type === 'poly');
  const united = blades.length ? await unionParts(blades, job, 'Preparing the cut') : [];
  if (united == null || !overlayAlive(job)) return;
  const blade = blades.length ? pieceFromParts(united, {}, OVERLAY_COLORS.difference, 0) : null;
  if (blades.length && !blade) { toast('The layer to cut out could not be prepared'); return; }
  const kept = [], records = [];
  let cut = 0, removed = 0, remainArea = 0, removedArea = 0, seen = 0;
  for (const f of subjects) {
    if (++seen % 10 === 0 && !(await yieldOverlay(job, 'Cutting ' + input.meta.label))) return;
    const before = partsAreaKm2(f.parts);
    if (!blade || !boxesOverlap(f.bb, blade.bb)) {
      remainArea += before;
      kept.push(f);
      continue;
    }
    const parts = polygonBoolean([f, blade], 'difference');
    const after = partsAreaKm2(parts);
    const gone = Math.max(0, before - after);
    removedArea += gone;
    const name = titleOf(input.obj, f);
    if (!parts.length || after < 0.0005) {
      removed++;
      if (records.length < 500) records.push({ feature: name, status: 'removed', remaining_km2: 0, removed_km2: +before.toFixed(3) });
      continue;
    }
    const piece = pieceFromParts(parts, { ...(f.props || {}), feature: name, remaining_km2: +after.toFixed(3), removed_km2: +gone.toFixed(3) }, OVERLAY_COLORS.difference, kept.length);
    if (!piece) { removed++; continue; }
    remainArea += after;
    kept.push(piece);
    if (gone >= 0.0005) {
      cut++;
      if (records.length < 500) records.push({ feature: name, status: 'cut', remaining_km2: +after.toFixed(3), removed_km2: +gone.toFixed(3) });
    }
  }
  if (!overlayAlive(job)) return;
  showOverlay(job, {
    title: 'Difference',
    hint: `<b>${esc(eraser.meta.label)}</b> cut out of <b>${esc(input.meta.label)}</b>, drawn in amber. Unchanged polygons stay on the map. The table lists only polygons that were cut or removed.`,
    stats: [[fmtNum(kept.length), 'still on the map'], [fmtNum(cut), 'partly cut'], [fmtNum(removed), 'fully removed'], [fmtNum(remainArea), 'km² remaining']],
    headers: ['Feature', 'Result', 'Remaining (km²)', 'Removed (km²)'],
    records,
    cells: (r) => [r.feature, r.status, fmtNum(r.remaining_km2), fmtNum(r.removed_km2)],
    extra: { input: input.meta.label, cut_out: eraser.meta.label, remaining_km2: +remainArea.toFixed(3), removed_km2: +removedArea.toFixed(3) },
    features: kept,
    color: OVERLAY_COLORS.difference,
    layerLabel: 'Difference',
    emptyToast: 'Nothing remained after the cut',
    emptyTable: 'No polygon was cut or removed. The input is unchanged on the map.',
  });
}

function toolCheckNullGeom() {
  const layers = layersOn(['polygon', 'line', 'point']);
  openModal('Check Null Geometries', (body) => {
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a point, line or polygon layer.'); return; }
    body.innerHTML = `<p class="hint">Lists features with no coordinates, a point with no position, a line with fewer than two vertices, or a polygon with no ring. A short but real shape is not null. ${TOPO_PANEL}</p>
      ${overlayNote()}
      <div class="frow"><label>Layer</label><select id="cng-layer">${layerOptions(layers)}</select></div>
      <div class="frow act"><button class="btn primary" id="cng-run">${icon('query')} Check null geometries</button></div>
      <div id="cng-out" style="margin-top:10px"></div>`;
    const out = body.querySelector('#cng-out');
    body.querySelector('#cng-run').onclick = async () => {
      const st = L.get(body.querySelector('#cng-layer').value);
      if (!st?.obj) await loadLayer(st);
      const feats = geomSource(st);
      const records = [];
      feats.forEach((f, i) => {
        const empty = !f?.parts || (f.type === 'point' ? f.parts.length < 2 : !f.parts.length)
          || (f.type === 'line' && f.parts.every((part) => (part?.length || 0) < 4))
          || (f.type === 'poly' && f.parts.every((poly) => !poly?.length || poly.every((ring) => (ring?.length || 0) < 6)));
        if (empty || geometryIssues(f).includes('no coordinates')) records.push({ feature: topoName(st, f, i), problem: 'No usable coordinates' });
      });
      topoPanel(out, 'Check Null Geometries',
        `<p><b>${fmtNum(records.length)}</b> feature${records.length === 1 ? '' : 's'} in ${esc(st.meta.label)} have no usable coordinates.</p>`
        + statBoxes([[fmtNum(records.length), 'Null geometries'], [fmtNum(feats.length), 'Features checked']])
        + resultTable(['Feature', 'Problem'], records, (r) => [r.feature, r.problem], 'Every feature has coordinates.'),
        records, { layer: st.meta.label });
    };
  }, { map: true });
}

function toolCheckOutOfBounds() {
  const layers = layersOn(['polygon', 'line', 'point']);
  openModal('Check Out of Bounds', (body) => {
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a point, line or polygon layer.'); return; }
    body.innerHTML = `<p class="hint">Lists features with a longitude outside −180 to 180, a latitude outside −90 to 90, or a coordinate that is not a number. The test uses degrees, not the map’s internal units. ${TOPO_PANEL}</p>
      ${overlayNote()}
      <div class="frow"><label>Layer</label><select id="oob-layer">${layerOptions(layers)}</select></div>
      <div class="frow act"><button class="btn primary" id="oob-run">${icon('query')} Check out of bounds</button></div>
      <div id="oob-out" style="margin-top:10px"></div>`;
    const out = body.querySelector('#oob-out');
    body.querySelector('#oob-run').onclick = async () => {
      const st = L.get(body.querySelector('#oob-layer').value);
      if (!st?.obj) await loadLayer(st);
      const feats = geomSource(st);
      const records = [];
      feats.forEach((f, i) => {
        const bad = featureVertices(f).filter(([x, y]) => {
          const lon = unX(x), lat = unY(y);
          return !Number.isFinite(lon) || !Number.isFinite(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90;
        }).length;
        if (bad) records.push({ feature: topoName(st, f, i), vertices: bad });
      });
      topoPanel(out, 'Check Out of Bounds',
        `<p><b>${fmtNum(records.length)}</b> feature${records.length === 1 ? '' : 's'} in ${esc(st.meta.label)} have a coordinate outside longitude or latitude.</p>`
        + statBoxes([[fmtNum(records.length), 'Out of bounds'], [fmtNum(feats.length), 'Features checked']])
        + resultTable(['Feature', 'Bad vertices'], records, (r) => [r.feature, fmtNum(r.vertices)], 'Every coordinate is inside longitude and latitude.'),
        records, { layer: st.meta.label });
    };
  }, { map: true });
}

function toolCheckMultipart() {
  const layers = layersOn(['polygon', 'line', 'point']);
  openModal('Check Multi-part Features', (body) => {
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a point, line or polygon layer.'); return; }
    body.innerHTML = `<p class="hint">A multi-part feature is several separate pieces stored as one: more than one point, more than one line, or more than one polygon. A hole is part of its polygon, not a second part. ${TOPO_PANEL}</p>
      ${overlayNote()}
      <div class="frow"><label>Layer</label><select id="cmp-layer">${layerOptions(layers)}</select></div>
      <div class="frow act"><button class="btn primary" id="cmp-run">${icon('query')} Check multi-part</button></div>
      <div id="cmp-out" style="margin-top:10px"></div>`;
    const out = body.querySelector('#cmp-out');
    body.querySelector('#cmp-run').onclick = async () => {
      const st = L.get(body.querySelector('#cmp-layer').value);
      if (!st?.obj) await loadLayer(st);
      const feats = geomSource(st);
      const records = [];
      feats.forEach((f, i) => {
        const parts = featurePartCount(f);
        if (parts > 1) records.push({ feature: topoName(st, f, i), parts });
      });
      records.sort((a, b) => b.parts - a.parts);
      topoPanel(out, 'Check Multi-part Features',
        `<p><b>${fmtNum(records.length)}</b> multi-part feature${records.length === 1 ? '' : 's'} in ${esc(st.meta.label)}.</p>`
        + statBoxes([[fmtNum(records.length), 'Multi-part'], [fmtNum(feats.length), 'Features checked']])
        + resultTable(['Feature', 'Parts'], records, (r) => [r.feature, fmtNum(r.parts)], 'Every feature is a single part.'),
        records, { layer: st.meta.label });
    };
  }, { map: true });
}

// ================================================================================
// ADDITIONAL NETWORK & ROUTING
// ================================================================================

function toolDistanceMatrix() {
  const layers = layersOn(['point']);
  openModal('Distance Matrix', (body) => {
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a point layer.'); return; }
    body.innerHTML = `<p class="hint">Lists the straight-line distance between each pair, in kilometres on the ground. This is not the distance along a road. The first 40 points are measured, and a selection narrows that. ${TOPO_PANEL}</p>
      ${overlayNote()}
      <div class="frow"><label>Points</label><select id="dm-layer">${layerOptions(layers)}</select></div>
      <div class="frow act"><button class="btn primary" id="dm-run">${icon('chart')} Measure pairs</button></div>
      <div id="dm-out" style="margin-top:10px"></div>`;
    const out = body.querySelector('#dm-out');
    body.querySelector('#dm-run').onclick = async () => {
      const st = L.get(body.querySelector('#dm-layer').value);
      if (!st?.obj) await loadLayer(st);
      const pts = [];
      let extra = 0;
      geomSource(st).forEach((f, i) => {
        if (f.type !== 'point') return;
        for (let k = 0; k < f.parts.length; k += 2) {
          if (pts.length >= 40) { extra++; return; }
          const name = topoName(st, f, i) + (f.parts.length > 2 ? ' (' + (k / 2 + 1) + ')' : '');
          pts.push({ name, lon: unX(f.parts[k]), lat: unY(f.parts[k + 1]) });
        }
      });
      if (pts.length < 2) {
        topoPanel(out, 'Distance Matrix', '<p>At least two points are needed.</p>', [], { layer: st.meta.label });
        return;
      }
      const records = [];
      let minD = Infinity, maxD = 0, sum = 0;
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const km = haversineKm([pts[i].lon, pts[i].lat], [pts[j].lon, pts[j].lat]);
        records.push({ from: pts[i].name, to: pts[j].name, km: +km.toFixed(3) });
        minD = Math.min(minD, km); maxD = Math.max(maxD, km); sum += km;
      }
      const mean = sum / records.length;
      topoPanel(out, 'Distance Matrix',
        `<p><b>${fmtNum(records.length)}</b> straight-line pairs among ${fmtNum(pts.length)} points of ${esc(st.meta.label)}. Not along a road.${extra ? ` ${fmtNum(extra)} further points were not measured.` : ''}</p>`
        + statBoxes([[fmtNum(minD) + ' km', 'Shortest'], [fmtNum(mean) + ' km', 'Mean'], [fmtNum(maxD) + ' km', 'Longest']])
        + resultTable(['From', 'To', 'km'], records, (r) => [r.from, r.to, fmtNum(r.km)]),
        records, { layer: st.meta.label, pairs: records.length, straight_line: true });
    };
  }, { map: true });
}

function toolLineMerge() {
  const layers = layersOn(['line']);
  openModal('Merge Connected Lines', (body) => {
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a line layer.'); return; }
    body.innerHTML = `<p class="hint">Draws a copy with lines joined where exactly two ends meet, within the snap distance in metres. A junction of three or more lines stays a junction. A line is reversed when that is what makes the ends meet. The source layer is not changed.</p>
      ${overlayNote()}
      <div class="frow"><label>Lines</label><select id="lm-layer">${layerOptions(layers)}</select></div>
      <div class="frow"><label>Join vertices within (m)</label><input id="lm-join" type="number" min="0" step="1" value="25"></div>
      <div class="frow act"><button class="btn primary" id="lm-run">${icon('copy')} Draw merged lines</button></div>`;
    body.querySelector('#lm-run').onclick = async () => {
      const st = L.get(body.querySelector('#lm-layer').value);
      const join = Math.max(0, +body.querySelector('#lm-join').value || 0);
      if (!st?.obj) await loadLayer(st);
      const merged = mergeLineChains(netSource(st), join);
      const lines = merged.flats.map((flat, i) => ({ flat, name: 'Merged ' + (i + 1), km: 0 }));
      showNetLines({
        title: 'Merge Connected Lines',
        layerLabel: 'Merged · ' + st.meta.label,
        lines,
        hint: `${fmtNum(merged.input)} line pieces became ${fmtNum(merged.output)}, with ${fmtNum(merged.joins)} join${merged.joins === 1 ? '' : 's'}. A junction of three lines was left as three lines. ${GEOM_DRAWN}`,
        stats: [[fmtNum(merged.input), 'Pieces in'], [fmtNum(merged.output), 'Lines drawn'], [fmtNum(merged.joins), 'Joins']],
        records: [{ pieces_in: merged.input, lines_out: merged.output, joins: merged.joins }],
        table: resultTable(['Pieces in', 'Lines drawn', 'Joins'], [{ pieces_in: merged.input, lines_out: merged.output, joins: merged.joins }], (r) => [fmtNum(r.pieces_in), fmtNum(r.lines_out), fmtNum(r.joins)]),
        extra: { layer: st.meta.label, pieces_in: merged.input, lines_out: merged.output, joins: merged.joins },
      });
    };
  }, { map: true });
}

// ================================================================================
// ADDITIONAL RASTER TOOLS
// ================================================================================

function toolRasterClipPoly() {
  const layers = rastersOn();
  const polys = layersOn(['polygon']);
  openModal('Raster Clip by Polygon', (body) => {
    if (!layers.length || !polys.length) { body.innerHTML = overlayNeed('Turn on a raster and a polygon layer.'); return; }
    body.innerHTML = `<p class="hint">Keeps a cell only when its centre is inside a polygon, and draws that as a new surface. A hole stays empty. A selected polygon, or a focus area, narrows which polygons are used.</p>
      ${overlayNote()}
      <div class="frow"><label>Raster</label><select id="rcp-r">${layerOptions(layers)}</select></div>
      <div class="frow"><label>Polygons</label><select id="rcp-p">${layerOptions(polys)}</select></div>
      <div class="frow act"><button class="btn primary" id="rcp-run" type="button">${icon('crop')} Clip to polygons</button></div>
      <div id="rcp-out"></div>`;
    const out = body.querySelector('#rcp-out');
    const button = body.querySelector('#rcp-run');
    button.onclick = async () => {
      button.disabled = true;
      try {
        const st = L.get(body.querySelector('#rcp-r').value);
        const polySt = L.get(body.querySelector('#rcp-p').value);
        out.innerHTML = '<p class="hint">Reading the raster…</p>';
        await rasterValues(st);
        const grid = rasterGrid(st);
        if (!out.isConnected) return;
        if (!grid) { out.innerHTML = '<p class="empty">This raster has no cell values to clip.</p>'; return; }
        const features = analysisFeatures(polySt).filter((f) => f.type === 'poly');
        if (!features.length) { out.innerHTML = '<p class="empty">That polygon layer has nothing to clip to.</p>'; return; }
        const index = bboxGrid(features, (f) => f.bb, 64);
        const outData = new Float32Array(grid.w * grid.h);
        let kept = 0, dropped = 0, empty = 0;
        for (let j = 0; j < grid.h; j++) {
          if (j % 8 === 0 && !(await rasterPause(out))) return;
          for (let i = 0; i < grid.w; i++) {
            const p = j * grid.w + i;
            const v = grid.data[p];
            if (rasterMissing(v, st)) { outData[p] = NaN; empty++; continue; }
            const [x, y] = cellMerc(i, j, grid);
            let inside = false;
            for (const f of index.near(x, y)) { if (pointInFeature(x, y, f)) { inside = true; break; } }
            if (!inside) { outData[p] = NaN; dropped++; continue; }
            outData[p] = v; kept++;
          }
        }
        if (!out.isConnected) return;
        if (!kept) { out.innerHTML = '<p class="empty">No cell centre falls inside those polygons.</p>'; return; }
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < outData.length; i++) if (Number.isFinite(outData[i])) { if (outData[i] < min) min = outData[i]; if (outData[i] > max) max = outData[i]; }
        const canvas = rasterCanvas(outData, grid.w, grid.h, stretchPaint(min, max));
        addDerivedRaster(canvas, grid, outData);
        fillRasterResult(out, 'Raster Clip by Polygon', 'surface',
          `<p class="hint">${RASTER_DRAWN} A cell is kept only when its centre is inside <b>${esc(polySt.meta.label)}</b>.</p>` +
          statBoxes([[fmtNum(kept), 'cells kept'], [fmtNum(dropped), 'outside the polygons'], [fmtNum(features.length), 'polygons used']]),
          [{ cells_kept: kept, outside: dropped, polygons: features.length }],
          { raster: st.meta.label, polygons: polySt.meta.label });
        toast('Raster clipped to polygons');
      } catch (err) {
        console.error(err);
        if (out.isConnected) out.innerHTML = '<p class="empty">That clip could not be finished.</p>';
      } finally { if (button.isConnected) button.disabled = false; }
    };
  }, { map: true });
}

// ================================================================================
// ADDITIONAL GENERATION TOOLS
// ================================================================================

function toolRandomLines() {
  const ext0 = generationExtent();
  const step0 = ext0 ? suggestCellKm(ext0, 24) : 2;
  openModal('Random Lines', (body) => {
    body.innerHTML = `<p class="hint">Draws random lines inside the current view, or the focus area if one is set, for illustration. Each step is about the length you set, in kilometres on the ground. They are not a survey and they do not follow a road. This does not edit a layer.</p>
      <div class="frow"><label>Number of lines</label><input id="rl-count" type="number" min="1" max="${GEN_DRAW_CAP}" step="1" value="12"></div>
      <div class="frow"><label>Vertices per line</label><input id="rl-verts" type="number" min="2" max="12" step="1" value="4"></div>
      <div class="frow"><label>Step (km)</label><input id="rl-step" type="number" min="0.01" step="0.1" value="${step0}"></div>
      <div class="frow act"><button class="btn primary" id="rl-run" type="button">${icon('line')} Draw lines</button></div>`;
    body.querySelector('#rl-run').onclick = () => {
      const ext = generationExtent();
      if (!ext) { genRefused('Random Lines', 'The map is not showing an area to fill.'); return; }
      const asked = Math.max(1, Math.round(+body.querySelector('#rl-count').value || 1));
      const count = Math.min(asked, GEN_DRAW_CAP);
      const verts = Math.max(2, Math.min(12, Math.round(+body.querySelector('#rl-verts').value || 4)));
      const stepKm = Math.max(0.01, +body.querySelector('#rl-step').value || step0);
      const features = [];
      for (let i = 0; i < count; i++) {
        const start = randomInExtent(ext);
        if (!start) break;
        let lon = start.lon, lat = start.lat;
        const flat = [start.x, start.y];
        const nv = 2 + Math.floor(Math.random() * (verts - 1));
        for (let v = 1; v < nv; v++) {
          const step = groundDegreeStep(lat, stepKm);
          const angle = Math.random() * Math.PI * 2;
          lon = Math.min(ext.east, Math.max(ext.west, lon + Math.cos(angle) * step.dLon));
          lat = Math.min(ext.north, Math.max(ext.south, lat + Math.sin(angle) * step.dLat));
          const x = mercX(lon), y = mercY(lat);
          if (!map.clipContainsPoint(x, y)) break;
          flat.push(x, y);
        }
        const built = lineFeature([flat], { line: i + 1, step_km: +stepKm.toFixed(3), vertices: flat.length / 2 }, { stroke: '#0b6b45', idx: i });
        if (built) features.push(built);
      }
      const capNote = asked > count ? ` Only ${fmtNum(count)} were drawn.` : '';
      showGeom({
        title: 'Random Lines',
        kind: 'line',
        layerLabel: 'Random lines',
        features,
        hint: `${fmtNum(features.length)} illustration lines inside the ${ext.where}. Each step is about ${fmtNum(stepKm)} km on the ground. Not a survey, and not a road.${capNote} ${GEOM_DRAWN}`,
        stats: [[fmtNum(features.length), 'Lines'], [fmtNum(stepKm) + ' km', 'Step']],
        records: features.map((f, i) => ({ line: i + 1, vertices: f.props.vertices, step_km: f.props.step_km })),
        table: resultTable(['Line', 'Vertices', 'Step (km)'], features.map((f, i) => ({ line: i + 1, vertices: f.props.vertices, step_km: f.props.step_km })), (r) => [String(r.line), fmtNum(r.vertices), fmtNum(r.step_km)]),
        extra: { lines: features.length, step_km: +stepKm.toFixed(3), where: ext.where },
        emptyToast: 'No line stayed inside that area',
        keepOpen: true,
      });
    };
  }, { map: true });
}

function toolRandomPolygons() {
  const ext0 = generationExtent();
  const width0 = ext0 ? suggestCellKm(ext0, 8) : 5;
  openModal('Random Polygons', (body) => {
    body.innerHTML = `<p class="hint">Draws random polygons inside the current view, or centred in the focus area if one is set, for illustration. Each one is a simple shape about the width you set, in kilometres on the ground. Vertices go in order around the centre, so the shape does not cross itself. This is not a survey boundary. This does not edit a layer.</p>
      <div class="frow"><label>Number of polygons</label><input id="rpoly-count" type="number" min="1" max="${GEN_DRAW_CAP}" step="1" value="8"></div>
      <div class="frow"><label>Vertices</label><input id="rpoly-verts" type="number" min="3" max="12" step="1" value="6"></div>
      <div class="frow"><label>Width (km)</label><input id="rpoly-width" type="number" min="0.01" step="0.1" value="${width0}"></div>
      <div class="frow act"><button class="btn primary" id="rpoly-run" type="button">${icon('polygon')} Draw polygons</button></div>`;
    body.querySelector('#rpoly-run').onclick = () => {
      const ext = generationExtent();
      if (!ext) { genRefused('Random Polygons', 'The map is not showing an area to fill.'); return; }
      const asked = Math.max(1, Math.round(+body.querySelector('#rpoly-count').value || 1));
      const count = Math.min(asked, GEN_DRAW_CAP);
      const verts = Math.max(3, Math.min(12, Math.round(+body.querySelector('#rpoly-verts').value || 6)));
      const askedWidth = Math.max(0.01, +body.querySelector('#rpoly-width').value || width0);
      const km = extentKm(ext);
      const widthKm = Math.min(askedWidth, Math.max(0.05, Math.min(km.width, km.height) * 0.7));
      const features = [];
      for (let i = 0; i < count; i++) {
        const centre = randomInExtent(ext);
        if (!centre) break;
        const scale = groundDegreeStep(centre.lat, 1);
        const nv = verts;
        const ring = [];
        for (let v = 0; v < nv; v++) {
          const angle = (v / nv) * Math.PI * 2;
          const radius = widthKm / 2 * (0.7 + Math.random() * 0.5);
          ring.push(mercX(centre.lon + Math.cos(angle) * radius * scale.dLon), mercY(centre.lat + Math.sin(angle) * radius * scale.dLat));
        }
        const built = polygonFeature([[ring]], { polygon: i + 1, width_km: +widthKm.toFixed(3), vertices: nv }, { fill: '#0b6b45', stroke: '#0b3d2e', idx: i });
        if (built) features.push(built);
      }
      const shrunk = widthKm < askedWidth - 0.05 ? ` The width was reduced to ${fmtNum(widthKm)} km so the shape fits the ${ext.where}.` : '';
      const capNote = asked > count ? ` Only ${fmtNum(count)} were drawn.` : '';
      showGeom({
        title: 'Random Polygons',
        kind: 'polygon',
        layerLabel: 'Random polygons',
        features,
        hint: `${fmtNum(features.length)} simple polygons inside the ${ext.where}, about ${fmtNum(widthKm)} km across. Not a survey boundary.${shrunk}${capNote} ${GEOM_DRAWN}`,
        stats: [[fmtNum(features.length), 'Polygons'], [fmtNum(widthKm) + ' km', 'Width']],
        records: [{ polygons: features.length, width_km: +widthKm.toFixed(3), vertices: verts }],
        table: resultTable(['Polygons', 'Width (km)', 'Vertices'], [{ polygons: features.length, width_km: widthKm, vertices: verts }], (r) => [fmtNum(r.polygons), fmtNum(r.width_km), fmtNum(r.vertices)]),
        extra: { polygons: features.length, width_km: +widthKm.toFixed(3), where: ext.where },
        emptyToast: 'No polygon was drawn',
        keepOpen: true,
      });
    };
  }, { map: true });
}




// ================================================================================
// HIGH-VALUE ADDITIONS (genuine gaps, not duplicates)
// ================================================================================

// --- Raster Overlay Math: two-raster map algebra ---
function toolRasterOverlay() {
  const layers = rastersOn();
  openModal('Raster Overlay Math', (body) => {
    if (layers.length < 2) { body.innerHTML = overlayNeed('Turn on two raster layers of the same size.'); return; }
    body.innerHTML = `<p class="hint">Draws a new surface from two rasters, cell by cell. Both must have the same number of rows and columns. A cell is left empty when either raster is empty, or when a division is by zero. The original layers are unchanged.</p>
      <div class="frow"><label>Raster A</label><select id="ro-a">${layerOptions(layers, 0)}</select></div>
      <div class="frow"><label>Operation</label><select id="ro-op"><option value="add">A + B</option><option value="sub">A − B</option><option value="mul">A × B</option><option value="div">A ÷ B</option><option value="min">Minimum</option><option value="max">Maximum</option></select></div>
      <div class="frow"><label>Raster B</label><select id="ro-b">${layerOptions(layers, 1)}</select></div>
      <div class="frow act"><button class="btn primary" id="ro-run" type="button">${icon('calc')} Compute</button></div>
      <div id="ro-out"></div>`;
    const aSel = body.querySelector('#ro-a'), bSel = body.querySelector('#ro-b'), button = body.querySelector('#ro-run'), out = body.querySelector('#ro-out');
    bindDistinctLayers(aSel, bSel, button);
    button.onclick = async () => {
      if (aSel.value === bSel.value) { out.innerHTML = '<p class="empty">Pick two different rasters.</p>'; return; }
      button.disabled = true;
      try {
        const stA = L.get(aSel.value), stB = L.get(bSel.value);
        const op = body.querySelector('#ro-op').value;
        out.innerHTML = '<p class="hint">Reading both rasters…</p>';
        await rasterValues(stA);
        await rasterValues(stB);
        const gA = rasterGrid(stA), gB = rasterGrid(stB);
        if (!out.isConnected) return;
        if (!gA || !gB) { out.innerHTML = '<p class="empty">One of these rasters has no cell values.</p>'; return; }
        if (gA.w !== gB.w || gA.h !== gB.h) { out.innerHTML = '<p class="empty">These rasters do not have the same number of rows and columns, so their cells cannot be combined.</p>'; return; }
        const names = { add: 'A + B', sub: 'A − B', mul: 'A × B', div: 'A ÷ B', min: 'minimum', max: 'maximum' };
        const outData = new Float32Array(gA.w * gA.h);
        let n = 0, skipped = 0, min = Infinity, max = -Infinity;
        for (let i = 0; i < gA.data.length; i++) {
          if (i > 0 && i % 80000 === 0 && !(await rasterPause(out))) return;
          if (rasterMissing(gA.data[i], stA) || rasterMissing(gB.data[i], stB)) { outData[i] = NaN; skipped++; continue; }
          const a = gA.data[i], b = gB.data[i];
          let y = NaN;
          if (op === 'add') y = a + b;
          else if (op === 'sub') y = a - b;
          else if (op === 'mul') y = a * b;
          else if (op === 'div') y = b === 0 ? NaN : a / b;
          else if (op === 'min') y = Math.min(a, b);
          else y = Math.max(a, b);
          if (!Number.isFinite(y)) { outData[i] = NaN; skipped++; continue; }
          outData[i] = y; n++;
          if (y < min) min = y;
          if (y > max) max = y;
        }
        if (!out.isConnected) return;
        if (!n) { out.innerHTML = '<p class="empty">No cell had a finite result.</p>'; return; }
        const canvas = rasterCanvas(outData, gA.w, gA.h, stretchPaint(min, max));
        addDerivedRaster(canvas, gA, outData);
        fillRasterResult(out, 'Raster Overlay Math', 'surface',
          `<p class="hint">${RASTER_DRAWN} ${esc(names[op] || op)} from <b>${esc(stA.meta.label)}</b> and <b>${esc(stB.meta.label)}</b>.</p>` +
          statBoxes([[fmtNum(n), 'cells drawn'], [fmtNum(min), 'lowest'], [fmtNum(max), 'highest'], [fmtNum(skipped), 'left empty']]),
          [{ operation: names[op] || op, cells: n, lowest: +min.toFixed(4), highest: +max.toFixed(4), left_empty: skipped }],
          { a: stA.meta.label, b: stB.meta.label, operation: op });
        toast('New surface drawn');
      } catch (err) {
        console.error(err);
        if (out.isConnected) out.innerHTML = '<p class="empty">That overlay could not be finished.</p>';
      } finally { if (button.isConnected && aSel.value !== bSel.value) button.disabled = false; }
    };
  }, { map: true });
}

// --- Area & Perimeter for polygons ---
function toolAreaPerim() {
  openModal('Area & Perimeter', (body) => {
    const layers = layersOn(['polygon']);
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a polygon layer.'); return; }
    body.innerHTML = `<p class="hint">Area in km² and perimeter in km for every polygon. A hole is subtracted from the area and added to the perimeter. ${GEOM_PANEL}</p>` +
      `<div class="frow"><label>Polygon layer</label><select id="ap-layer">${layerOptions(layers, 0)}</select></div>` +
      `<div class="frow act"><button class="btn primary" id="ap-run" type="button">${icon('chart')} Compute</button></div>` +
      `<div id="ap-out"></div>`;
    const out = body.querySelector('#ap-out');
    body.querySelector('#ap-run').onclick = async () => {
      const st = L.get(body.querySelector('#ap-layer').value);
      if (!st) return;
      if (!st.obj) await loadLayer(st);
      if (!out.isConnected) return;
      const feats = geomSource(st).filter((f) => f.type === 'poly');
      const rows = feats.map((f) => {
        const m = polygonMeasure(f.parts);
        return { feature: titleOf(st.obj, f), area_km2: +m.areaKm2.toFixed(3), perimeter_km: +m.perimKm.toFixed(3), holes: m.holes };
      });
      const totalArea = rows.reduce((s, r) => s + r.area_km2, 0);
      const totalPerim = rows.reduce((s, r) => s + r.perimeter_km, 0);
      fillRasterResult(out, 'Area & Perimeter', 'panel',
        `<p class="hint">${GEOM_PANEL} <b>${esc(st.meta.label)}</b>. Holes are subtracted from the area.</p>` +
        statBoxes([[fmtNum(rows.length), 'polygons'], [fmtNum(totalArea), 'km²'], [fmtNum(totalPerim), 'km perimeter'], [fmtNum(rows.length ? totalArea / rows.length : 0), 'mean km²']]) +
        resultTable(['Feature', 'Area (km²)', 'Perimeter (km)', 'Holes'], rows, (r) => [r.feature, fmtNum(r.area_km2), fmtNum(r.perimeter_km), fmtNum(r.holes)]),
        rows, { layer: st.meta.label });
      toast('Area and perimeter ready');
    };
  }, { map: true });
}

// --- Points Along Lines ---
function toolLinePoints() {
  openModal('Points Along Lines', (body) => {
    const layers = layersOn(['line']);
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a line layer.'); return; }
    body.innerHTML = `<p class="hint">Places a point at the start, then one each time the line travels the interval, in kilometres on the ground. ${GEOM_DRAWN}</p>` +
      `<div class="frow"><label>Line layer</label><select id="lp-layer">${layerOptions(layers, 0)}</select></div>` +
      `<div class="frow"><label>Interval (km)</label><input id="lp-interval" type="number" min="0.01" step="0.01" value="1"></div>` +
      `<div class="frow act"><button class="btn primary" id="lp-run" type="button">${icon('point')} Generate points</button></div>`;
    body.querySelector('#lp-run').onclick = async () => {
      const st = L.get(body.querySelector('#lp-layer').value);
      const intervalKm = Math.max(0.01, +body.querySelector('#lp-interval').value || 1);
      if (!st) return;
      if (!st.obj) await loadLayer(st);
      const feats = geomSource(st).filter((f) => f.type === 'line');
      const pts = [];
      for (const f of feats) {
        for (const part of f.parts || []) {
          for (const [x, y] of pointsAlongFlat(part, intervalKm)) {
            const built = pointFeature(x, y, geomCopyProps(f), { fill: '#0b6b45', idx: pts.length });
            if (built) pts.push(built);
          }
        }
      }
      showGeom({
        title: 'Points Along Lines',
        kind: 'point',
        layerLabel: 'Points along lines',
        features: pts,
        hint: `${GEOM_DRAWN} Points every ${fmtNum(intervalKm)} km along <b>${esc(st.meta.label)}</b>. The interval continues across a bend instead of restarting on every segment.`,
        stats: [[fmtNum(pts.length), 'points'], [fmtNum(intervalKm), 'km interval']],
        records: [{ points: pts.length, interval_km: intervalKm }],
        table: resultTable(['Points', 'Interval (km)'], [{ points: pts.length, intervalKm }], (r) => [fmtNum(r.points), fmtNum(r.intervalKm)]),
        extra: { layer: st.meta.label, interval_km: intervalKm },
        emptyToast: 'No line to measure',
      });
    };
  }, { map: true });
}

// --- Random Sample of Features ---
function toolRandomSample() {
  const layers = layersOn(['point', 'line', 'polygon']);
  openModal('Random Sample', (body) => {
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a point, line or polygon layer.'); return; }
    body.innerHTML = `<p class="hint">Draws a random subset as a new layer. A selection, or a focus area, narrows what can be picked. The copy does not share its shape with the source. The source is not hidden and is not changed. Run it again for a different subset.</p>
      ${overlayNote()}
      <div class="frow"><label>Layer</label><select id="rs-layer">${layerOptions(layers)}</select></div>
      <div class="frow"><label>How many</label><input id="rs-n" type="number" min="1" max="${GEN_SAMPLE_CAP}" step="1" value="10"></div>
      <div class="frow act"><button class="btn primary" id="rs-run" type="button">${icon('point')} Draw sample</button></div>`;
    body.querySelector('#rs-run').onclick = async () => {
      const st = L.get(body.querySelector('#rs-layer').value);
      const asked = Math.max(1, Math.round(+body.querySelector('#rs-n').value || 1));
      if (!st) return;
      if (!st.obj) await loadLayer(st);
      const feats = geomSource(st);
      if (!feats.length) { genRefused('Random Sample', 'That layer has no feature to sample.'); return; }
      const take = Math.min(asked, feats.length, GEN_SAMPLE_CAP);
      const order = feats.map((_, i) => i);
      for (let i = 0; i < take; i++) {
        const j = i + Math.floor(Math.random() * (order.length - i));
        const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
      }
      const features = [];
      const records = [];
      order.slice(0, take).forEach((fi, n) => {
        const f = feats[fi];
        const name = topoName(st, f, fi);
        const copy = topoCopyFeature(f, { ...geomCopyProps(f), sample: n + 1 }, { fill: '#0b6b45', stroke: '#0b6b45' }, n);
        if (!copy) return;
        features.push(copy);
        records.push({ sample: n + 1, feature: name });
      });
      const short = take < asked ? ` Only ${fmtNum(take)} of the ${fmtNum(feats.length)} features in use were drawn.` : '';
      showGeom({
        title: 'Random Sample',
        kind: st.meta.kind,
        layerLabel: 'Sample · ' + st.meta.label,
        features,
        hint: `${fmtNum(features.length)} of ${fmtNum(feats.length)} features from ${esc(st.meta.label)}, chosen at random. A later run can pick a different subset.${short} ${GEOM_DRAWN}`,
        stats: [[fmtNum(features.length), 'Drawn'], [fmtNum(feats.length), 'To choose from']],
        records,
        table: resultTable(['Sample', 'Feature'], records, (r) => [String(r.sample), r.feature]),
        extra: { layer: st.meta.label, drawn: features.length, available: feats.length },
        emptyToast: 'No feature could be copied',
        keepOpen: true,
      });
    };
  }, { map: true });
}

// --- Polygon Centroids as Point Layer ---
function toolCentroidPts() {
  openModal('Polygon Centroids → Points', (body) => {
    const layers = layersOn(['polygon']);
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a polygon layer.'); return; }
    body.innerHTML = `<p class="hint">Draws the area centre of each polygon. A hole is left out of that centre. ${GEOM_DRAWN}</p>` +
      `<div class="frow"><label>Polygon layer</label><select id="cp-layer">${layerOptions(layers, 0)}</select></div>` +
      `<div class="frow act"><button class="btn primary" id="cp-run" type="button">${icon('target')} Create centroid points</button></div>`;
    body.querySelector('#cp-run').onclick = async () => {
      const st = L.get(body.querySelector('#cp-layer').value);
      if (!st) return;
      if (!st.obj) await loadLayer(st);
      const feats = geomSource(st).filter((f) => f.type === 'poly');
      const pts = [];
      for (const f of feats) {
        const c = areaCentroidMerc(f);
        const built = c && pointFeature(c[0], c[1], geomCopyProps(f), { fill: '#0b6b45', idx: pts.length });
        if (built) pts.push(built);
      }
      showGeom({
        title: 'Polygon Centroids',
        kind: 'point',
        layerLabel: 'Polygon centroids',
        features: pts,
        hint: `${GEOM_DRAWN} Area centre of each polygon in <b>${esc(st.meta.label)}</b>. This is not the average of the vertices.`,
        stats: [[fmtNum(pts.length), 'points'], [fmtNum(feats.length), 'polygons']],
        records: pts.slice(0, 500).map((p, i) => ({ feature: titleOf(st.obj, feats[i]) || 'Feature' })),
        table: resultTable(['Feature'], pts.slice(0, 25).map((p, i) => ({ feature: titleOf(st.obj, feats[i]) || 'Feature' })), (r) => [r.feature]),
        extra: { layer: st.meta.label, points: pts.length },
        emptyToast: 'No polygon had a centre',
      });
    };
  }, { map: true });
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
  const layers = layersOn(['line']);
  openModal('Line Bearing Statistics', (body) => {
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a line layer.'); return; }
    body.innerHTML = `<p class="hint">Compass bearing of each segment, from north, clockwise, using longitude and latitude. A long segment counts more than a short one. North is increasing latitude, not the map's internal up. ${TOPO_PANEL}</p>
      ${overlayNote()}
      <div class="frow"><label>Lines</label><select id="lb-layer">${layerOptions(layers)}</select></div>
      <div class="frow act"><button class="btn primary" id="lb-run">${icon('compass')} Measure bearings</button></div>
      <div id="lb-out" style="margin-top:10px"></div>`;
    const out = body.querySelector('#lb-out');
    body.querySelector('#lb-run').onclick = async () => {
      const st = L.get(body.querySelector('#lb-layer').value);
      if (!st?.obj) await loadLayer(st);
      const summary = lineBearingSummary(geomSource(st));
      if (!summary.segments) {
        topoPanel(out, 'Line Bearing Statistics', '<p>Those lines have no segment to measure.</p>', [], { layer: st.meta.label });
        return;
      }
      const records = summary.bins.map((b) => ({ direction: b.dir, km: +b.km.toFixed(3), share: summary.km ? +(b.km / summary.km * 100).toFixed(1) : 0 }));
      topoPanel(out, 'Line Bearing Statistics',
        `<p>The length-weighted compass direction of ${esc(st.meta.label)} is <b>${esc(summary.dominant || 'mixed')}</b>${summary.mean == null ? '' : ', mean ' + summary.mean.toFixed(1) + '°'}.</p>`
        + statBoxes([[summary.dominant || '—', 'Dominant'], [fmtNum(summary.km) + ' km', 'Measured'], [fmtNum(summary.segments), 'Segments']])
        + resultTable(['Direction', 'km', 'Share'], records, (r) => [r.direction, fmtNum(r.km), r.share + '%']),
        records, { layer: st.meta.label, dominant: summary.dominant, mean_degrees: summary.mean == null ? null : +summary.mean.toFixed(1) });
    };
  }, { map: true });
}

// --- Feature Count by Attribute ---
function toolCountByAttr() {
  openModal('Count by Attribute', (body) => {
    const holder = document.createElement('div');
    body.appendChild(holder);
    const picker = layerPicker(body, () => fill(), (st) => ['polygon', 'line', 'point'].includes(st.meta.kind) && (st.meta.fields || []).length);
    function fill() {
      const st = L.get(picker.select.value);
      holder.innerHTML = `<p class="hint">Counts how many features share each value. The table stays in this panel. ${DATA_PANEL}</p>
        <div class="frow"><label>Column</label><select id="cba-field">${st ? fieldOptions(st) : ''}</select></div>
        <div class="frow act"><button class="btn primary" id="cba-run" type="button">${icon('chart')} Count</button></div>
        <div id="cba-out"></div>`;
      const out = holder.querySelector('#cba-out');
      holder.querySelector('#cba-run').onclick = async () => {
        const layer = L.get(picker.select.value);
        const field = holder.querySelector('#cba-field').value;
        if (!layer || !field) { out.innerHTML = '<p class="empty">Pick a layer and a column.</p>'; return; }
        if (!layer.obj) { out.innerHTML = '<p class="hint">Loading…</p>'; await loadLayer(layer); if (!out.isConnected) return; }
        const tally = countByAttribute(layer, field);
        if (!out.isConnected) return;
        if (!tally.rows.length) { out.innerHTML = '<p class="empty">That layer has no features to count.</p>'; return; }
        const label = (layer.meta.fields || []).find((f) => f.name === field)?.label || field;
        topoPanel(out, layer.meta.label + ' count by ' + label,
          `<p><b>${fmtNum(tally.total)}</b> feature${tally.total === 1 ? '' : 's'} across <b>${fmtNum(tally.rows.length)}</b> value${tally.rows.length === 1 ? '' : 's'}, largest group first.</p>`
          + resultTable([label, 'Count', '%'], tally.rows, (r) => [r.value, fmtNum(r.count), r.percent + '%']),
          tally.rows, { layer: layer.meta.label, field });
      };
    }
    fill();
  }, { map: true });
}



// ================================================================================
// FINAL HIGH-VALUE TOOLS (genuine gaps, no duplicates)
// ================================================================================

// --- Raster Class Zonal: zonal stats per raster class within polygons ---
function toolRasterClassZonal() {
  const layers = rastersOn();
  const polys = layersOn(['polygon']);
  openModal('Raster Class Zonal', (body) => {
    if (!layers.length || !polys.length) { body.innerHTML = overlayNeed('Turn on a raster and a polygon layer.'); return; }
    body.innerHTML = `<p class="hint">Counts how much of each raster class falls inside each polygon. ${RASTER_PANEL} A cell covered by two polygons is counted in both. Empty cells are skipped.</p>
      ${overlayNote()}
      <div class="frow"><label>Raster</label><select id="rcz-r">${layerOptions(layers)}</select></div>
      <div class="frow"><label>Polygons</label><select id="rcz-p">${layerOptions(polys)}</select></div>
      <div class="frow act"><button class="btn primary" id="rcz-run" type="button">${icon('chart')} Count classes</button></div>
      <div id="rcz-out"></div>`;
    const out = body.querySelector('#rcz-out');
    const button = body.querySelector('#rcz-run');
    button.onclick = async () => {
      button.disabled = true;
      try {
        const st = L.get(body.querySelector('#rcz-r').value);
        const polySt = L.get(body.querySelector('#rcz-p').value);
        out.innerHTML = '<p class="hint">Reading the raster…</p>';
        await rasterValues(st);
        const grid = rasterGrid(st);
        if (!out.isConnected) return;
        if (!grid) { out.innerHTML = '<p class="empty">This raster has no cell values to count.</p>'; return; }
        const features = analysisFeatures(polySt).filter((f) => f.type === 'poly');
        if (!features.length) { out.innerHTML = '<p class="empty">That polygon layer has nothing to summarise.</p>'; return; }
        const published = (st.meta.classes || []).filter((c) => c && c.value != null).map((c) => ({ value: +c.value, label: c.label || String(c.value) }));
        const index = bboxGrid(features, (f) => f.bb, 64);
        const step = Math.max(1, Math.floor(Math.sqrt((grid.w * grid.h) / 25000)));
        const weight = step * step;
        let breaks = null;
        let binCount = 0;
        if (!published.length) {
          const sample = [];
          for (let i = 0; i < grid.data.length; i += step) if (!rasterMissing(grid.data[i], st)) sample.push(grid.data[i]);
          if (sample.length < 2) { out.innerHTML = '<p class="empty">Not enough cell values to group.</p>'; return; }
          binCount = classCountFor(sample, 5);
          breaks = breaksOf(sample, binCount, 'equal');
        }
        const acc = new Map();
        let samples = 0, skipped = 0;
        for (let j = 0; j < grid.h; j += step) {
          if (!(await rasterPause(out))) return;
          for (let i = 0; i < grid.w; i += step) {
            const v = grid.data[j * grid.w + i];
            if (rasterMissing(v, st)) { skipped++; continue; }
            let label;
            if (published.length) {
              const rounded = Math.round(v);
              const hit = published.find((c) => c.value === rounded || c.value === v);
              if (!hit) { skipped++; continue; }
              label = hit.label;
            } else label = (classOf(v, breaks, binCount) + 1) + ' (' + fmtNum(breaks[classOf(v, breaks, binCount)]) + '–' + fmtNum(breaks[classOf(v, breaks, binCount) + 1]) + ')';
            const [x, y] = cellMerc(i, j, grid);
            for (const f of index.near(x, y)) {
              if (!pointInFeature(x, y, f)) continue;
              let row = acc.get(f);
              if (!row) acc.set(f, row = { samples: 0, cover: {} });
              row.samples++;
              row.cover[label] = (row.cover[label] || 0) + 1;
              samples++;
            }
          }
        }
        if (!out.isConnected) return;
        const rows = features.map((f) => {
          const row = acc.get(f);
          let top = '—', topN = 0;
          if (row) for (const [name, count] of Object.entries(row.cover)) if (count > topN) { top = name; topN = count; }
          return {
            polygon: titleOf(polySt.obj, f),
            samples: row ? row.samples : 0,
            cells_represented: row ? row.samples * weight : 0,
            top_class: top,
            top_class_pct: row && row.samples ? Math.round(topN / row.samples * 100) : 0,
          };
        }).filter((r) => r.samples).sort((a, b) => b.samples - a.samples);
        if (!rows.length) { out.innerHTML = '<p class="empty">No sampled cell centre falls inside those polygons.</p>'; return; }
        const how = published.length
          ? 'Classes are the raster’s published classes.'
          : 'This raster has no published classes, so the groups are equal-interval bins of the sampled values.';
        const sampleNote = step === 1
          ? 'Every cell centre was tested.'
          : `Every ${fmtNum(step)}th cell was tested. Each sample stands for ${fmtNum(weight)} cells — the sample count is not a count of every cell.`;
        fillRasterResult(out, 'Raster Class Zonal', 'panel',
          `<p class="hint">${RASTER_PANEL} ${how} ${sampleNote} A cell in two polygons is counted in both.</p>` +
          statBoxes([[fmtNum(rows.length), 'polygons'], [fmtNum(samples), 'samples'], [fmtNum(published.length || binCount), published.length ? 'published classes' : 'bins']]) +
          resultTable(['Polygon', 'Samples', 'Cells stood for', 'Top class', 'Top %'], rows, (r) => [r.polygon, fmtNum(r.samples), fmtNum(r.cells_represented), r.top_class, r.top_class_pct + '%']),
          rows, { raster: st.meta.label, polygons: polySt.meta.label, sample_step: step });
        toast('Class counts ready');
      } catch (err) {
        console.error(err);
        if (out.isConnected) out.innerHTML = '<p class="empty">Those class counts could not be finished.</p>';
      } finally { if (button.isConnected) button.disabled = false; }
    };
  }, { map: true });
}

// --- Raster Difference: A - B ---
function toolRasterDiff() {
  const layers = rastersOn();
  openModal('Raster Difference (A − B)', (body) => {
    if (layers.length < 2) { body.innerHTML = overlayNeed('Turn on two raster layers of the same size. This subtracts cell values. It does not cut polygons.'); return; }
    body.innerHTML = `<p class="hint">Subtracts raster B from raster A, cell by cell. ${RASTER_PANEL} Both rasters must have the same number of rows and columns.</p>
      <div class="frow"><label>Raster A</label><select id="rd-a">${layerOptions(layers, 0)}</select></div>
      <div class="frow"><label>Raster B</label><select id="rd-b">${layerOptions(layers, 1)}</select></div>
      <div class="frow act"><button class="btn primary" id="rd-run" type="button">${icon('calc')} Compute difference</button></div>
      <div id="rd-out"></div>`;
    const aSel = body.querySelector('#rd-a'), bSel = body.querySelector('#rd-b'), button = body.querySelector('#rd-run'), out = body.querySelector('#rd-out');
    bindDistinctLayers(aSel, bSel, button);
    button.onclick = async () => {
      if (aSel.value === bSel.value) { out.innerHTML = '<p class="empty">Pick two different rasters.</p>'; return; }
      button.disabled = true;
      try {
        const stA = L.get(aSel.value), stB = L.get(bSel.value);
        out.innerHTML = '<p class="hint">Reading both rasters…</p>';
        await rasterValues(stA);
        await rasterValues(stB);
        const gA = rasterGrid(stA), gB = rasterGrid(stB);
        if (!out.isConnected) return;
        if (!gA || !gB) { out.innerHTML = '<p class="empty">One of these rasters has no cell values.</p>'; return; }
        if (gA.w !== gB.w || gA.h !== gB.h) { out.innerHTML = '<p class="empty">These rasters do not have the same number of rows and columns, so their cells cannot be subtracted.</p>'; return; }
        let valid = 0, pos = 0, neg = 0, zero = 0, skipped = 0;
        for (let i = 0; i < gA.data.length; i++) {
          if (rasterMissing(gA.data[i], stA) || rasterMissing(gB.data[i], stB)) { skipped++; continue; }
          valid++;
          const d = gA.data[i] - gB.data[i];
          if (d > 0) pos++; else if (d < 0) neg++; else zero++;
        }
        fillRasterResult(out, 'Raster Difference', 'panel',
          `<p class="hint">${RASTER_PANEL} <b>${esc(stA.meta.label)}</b> minus <b>${esc(stB.meta.label)}</b>. No coordinates are listed.</p>` +
          statBoxes([[fmtNum(valid), 'cells subtracted'], [fmtNum(pos), 'A greater than B'], [fmtNum(neg), 'A less than B'], [fmtNum(zero), 'equal cells']]) +
          (skipped ? `<p class="hint">${fmtNum(skipped)} cells had no value in one raster and were skipped.</p>` : ''),
          [{ cells: valid, a_greater: pos, a_less: neg, equal: zero, skipped }],
          { a: stA.meta.label, b: stB.meta.label });
        toast('Raster difference ready');
      } catch (err) {
        console.error(err);
        if (out.isConnected) out.innerHTML = '<p class="empty">That difference could not be finished.</p>';
      } finally { if (button.isConnected && aSel.value !== bSel.value) button.disabled = false; }
    };
  }, { map: true });
}
function toolPolyAdjacency() {
  openModal('Polygon Adjacency', (body) => {
    const layers = layersOn(['polygon']);
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a polygon layer.'); return; }
    body.innerHTML = `<p class="hint">Lists pairs that share a border or whose outlines cross. A shared corner alone is not enough. ${GEOM_PANEL}</p>` +
      `<div class="frow"><label>Polygon layer</label><select id="pa-layer">${layerOptions(layers, 0)}</select></div>` +
      `<div class="frow act"><button class="btn primary" id="pa-run" type="button">${icon('query')} Check adjacency</button></div>` +
      `<div id="pa-out"></div>`;
    const out = body.querySelector('#pa-out');
    body.querySelector('#pa-run').onclick = async () => {
      const st = L.get(body.querySelector('#pa-layer').value);
      if (!st) return;
      if (!st.obj) await loadLayer(st);
      if (!out.isConnected) return;
      const feats = geomSource(st).filter((f) => f.type === 'poly');
      out.innerHTML = '<p class="hint">Checking borders…</p>';
      await new Promise((r) => setTimeout(r, 0));
      if (!out.isConnected) return;
      const rows = [];
      const index = bboxGrid(feats, (f) => f.bb, 48);
      const seen = new Set();
      for (const a of feats) {
        for (const b of index.nearBox(a.bb)) {
          if (a === b || !boxesOverlap(a.bb, b.bb)) continue;
          const key = (a.idx < b.idx ? a.idx : b.idx) + ':' + (a.idx < b.idx ? b.idx : a.idx);
          if (seen.has(key)) continue;
          seen.add(key);
          if (!polygonsTouch(a, b)) continue;
          if (rows.length < 500) rows.push({ a: titleOf(st.obj, a), b: titleOf(st.obj, b) });
        }
      }
      fillRasterResult(out, 'Polygon Adjacency', 'panel',
        `<p class="hint">${GEOM_PANEL} <b>${esc(st.meta.label)}</b>. A pair is listed when the borders overlap or the outlines cross. A corner touch is not listed.</p>` +
        statBoxes([[fmtNum(rows.length), 'touching pairs'], [fmtNum(feats.length), 'polygons']]) +
        resultTable(['Polygon', 'Touches'], rows, (r) => [r.a, r.b], 'No shared border found.'),
        rows, { layer: st.meta.label, pairs: rows.length });
      toast(rows.length + ' touching pair' + (rows.length === 1 ? '' : 's'));
    };
  }, { map: true });
}

// --- Line Offset: parallel offset lines ---
function toolLineOffset() {
  openModal('Line Offset', (body) => {
    const layers = layersOn(['line']);
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a line layer.'); return; }
    body.innerHTML = `<p class="hint">Draws a parallel copy. Left of an eastbound line is north. The distance is kilometres on the ground. ${GEOM_DRAWN}</p>` +
      `<div class="frow"><label>Line layer</label><select id="lo-layer">${layerOptions(layers, 0)}</select></div>` +
      `<div class="frow"><label>Distance (km)</label><input id="lo-dist" type="number" min="0.01" step="0.01" value="1"></div>` +
      `<div class="frow"><label>Side</label><select id="lo-side"><option value="left">Left</option><option value="right">Right</option></select></div>` +
      `<div class="frow act"><button class="btn primary" id="lo-run" type="button">${icon('line')} Offset lines</button></div>`;
    body.querySelector('#lo-run').onclick = async () => {
      const st = L.get(body.querySelector('#lo-layer').value);
      const distKm = Math.max(0.01, +body.querySelector('#lo-dist').value || 1);
      const side = body.querySelector('#lo-side').value === 'right' ? 'right' : 'left';
      if (!st) return;
      if (!st.obj) await loadLayer(st);
      const feats = geomSource(st).filter((f) => f.type === 'line');
      const lines = [];
      for (const f of feats) {
        const parts = (f.parts || []).map((part) => offsetLineFlat(part, distKm, side)).filter(Boolean);
        const built = lineFeature(parts, geomCopyProps(f), { stroke: '#0b6b45', idx: lines.length });
        if (built) lines.push(built);
      }
      showGeom({
        title: 'Line Offset',
        kind: 'line',
        layerLabel: 'Offset ' + distKm + ' km',
        features: lines,
        hint: `${GEOM_DRAWN} ${side === 'left' ? 'Left' : 'Right'} of <b>${esc(st.meta.label)}</b> by ${fmtNum(distKm)} km. Left of a line going east is north.`,
        stats: [[fmtNum(lines.length), 'lines'], [fmtNum(distKm), 'km'], [side, 'side']],
        records: [{ lines: lines.length, distance_km: distKm, side }],
        table: resultTable(['Lines', 'Distance (km)', 'Side'], [{ lines: lines.length, distKm, side }], (r) => [fmtNum(r.lines), fmtNum(r.distKm), r.side]),
        extra: { layer: st.meta.label, distance_km: distKm, side },
        emptyToast: 'No line to offset',
      });
    };
  }, { map: true });
}

// --- Polygon Union: merge all polygons into one ---
function toolPolyUnion() {
  openModal('Polygon Union / Merge', (body) => {
    const layers = layersOn(['polygon']);
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a polygon layer to merge it into one shape.'); return; }
    body.innerHTML = '<p>Merges every polygon into one shape and removes the borders they share. Gaps between features stay open. Attributes are not copied, because one shape cannot keep every feature’s values.</p>' + overlayNote() +
      `<div class="frow"><label>Layer</label><select id="pu-layer">${layerOptions(layers, 0)}</select></div>` +
      `<div class="frow act"><button class="btn primary" id="pu-run">${icon('merge')} Run union</button></div>`;
    body.querySelector('#pu-run').onclick = () => runOverlay(() => runPolygonUnion(body.querySelector('#pu-layer').value));
  });
}
async function runPolygonUnion(id) {
  const st = L.get(id);
  if (!st) return;
  const job = beginOverlayJob();
  closeModal();
  if (!(await yieldOverlay(job, 'Merging ' + st.meta.label))) return;
  if (!st.obj) await loadLayer(st);
  if (!overlayAlive(job)) return;
  const feats = analysisFeatures(st).filter((f) => f.type === 'poly');
  const parts = await unionParts(feats, job, 'Merging ' + st.meta.label);
  if (parts == null || !overlayAlive(job)) return;
  const area = partsAreaKm2(parts);
  const piece = pieceFromParts(parts, { features_merged: feats.length, pieces: 0, area_km2: +area.toFixed(3) }, OVERLAY_COLORS.union, 0);
  if (piece) piece.props.pieces = piece.parts.length;
  const features = piece ? [piece] : [];
  const records = piece ? [{ features_merged: feats.length, pieces: piece.parts.length, area_km2: +area.toFixed(3) }] : [];
  showOverlay(job, {
    title: 'Union',
    hint: `Union of <b>${esc(st.meta.label)}</b>, drawn in green. Shared borders are removed. Gaps between features are kept. Attributes are not copied.`,
    stats: [[fmtNum(feats.length), 'features merged'], [fmtNum(piece ? piece.parts.length : 0), 'pieces'], [fmtNum(area), 'km²']],
    headers: ['Features merged', 'Pieces', 'Area (km²)'],
    records,
    cells: (r) => [fmtNum(r.features_merged), fmtNum(r.pieces), fmtNum(r.area_km2)],
    extra: { layer: st.meta.label, features_merged: feats.length, area_km2: +area.toFixed(3) },
    features,
    color: OVERLAY_COLORS.union,
    layerLabel: 'Union',
    emptyToast: 'No polygons to merge',
  });
}

function toolLineLenStats() {
  openModal('Line Length Statistics', (body) => {
    const layers = layersOn(['line']);
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a line layer.'); return; }
    body.innerHTML = `<p class="hint">Total, mean, shortest and longest length, in kilometres. One row is one line feature, not one segment. ${GEOM_PANEL}</p>` +
      `<div class="frow"><label>Line layer</label><select id="lls-layer">${layerOptions(layers, 0)}</select></div>` +
      `<div class="frow act"><button class="btn primary" id="lls-run" type="button">${icon('chart')} Compute stats</button></div>` +
      `<div id="lls-out"></div>`;
    const out = body.querySelector('#lls-out');
    body.querySelector('#lls-run').onclick = async () => {
      const st = L.get(body.querySelector('#lls-layer').value);
      if (!st) return;
      if (!st.obj) await loadLayer(st);
      if (!out.isConnected) return;
      const feats = geomSource(st).filter((f) => f.type === 'line');
      const stats = lineLengthStats(feats);
      const rows = [{ lines: stats.count, total_km: +stats.totalKm.toFixed(3), mean_km: +stats.meanKm.toFixed(3), min_km: +stats.minKm.toFixed(3), max_km: +stats.maxKm.toFixed(3) }];
      fillRasterResult(out, 'Line Length Statistics', 'panel',
        `<p class="hint">${GEOM_PANEL} <b>${esc(st.meta.label)}</b>. Length is ground distance. A line made of several parts is one feature.</p>` +
        statBoxes([[fmtNum(stats.count), 'lines'], [fmtNum(stats.totalKm), 'total km'], [fmtNum(stats.meanKm), 'mean km'], [fmtNum(stats.maxKm), 'longest km']]),
        rows, { layer: st.meta.label });
      toast('Line lengths ready');
    };
  }, { map: true });
}

// --- Ring Direction: check CW/CCW orientation ---
function toolRingDirection() {
  const polyLayers = layersOn(['polygon']);
  openModal('Ring Direction Check', (body) => {
    if (!polyLayers.length) { body.innerHTML = overlayNeed('Turn on a polygon layer.'); return; }
    body.innerHTML = `<p class="hint">An outer ring in this map runs anticlockwise and a hole runs clockwise, which is the opposite of a north-up drawing because map y grows downward. A ring is listed only when it runs the wrong way for its role. ${TOPO_PANEL}</p>
      ${overlayNote()}
      <div class="frow"><label>Polygon layer</label><select id="rd-layer">${layerOptions(polyLayers)}</select></div>
      <div class="frow act"><button class="btn primary" id="rd-run">${icon('query')} Check ring direction</button></div>
      <div id="rd-out" style="margin-top:10px"></div>`;
    const out = body.querySelector('#rd-out');
    body.querySelector('#rd-run').onclick = async () => {
      const st = L.get(body.querySelector('#rd-layer').value);
      if (!st?.obj) await loadLayer(st);
      const feats = geomSource(st).filter((f) => f.type === 'poly');
      const records = [];
      let rings = 0;
      feats.forEach((f, i) => {
        for (const poly of f.parts || []) rings += poly.length;
        for (const fault of ringDirectionFaults(f)) {
          records.push({ feature: topoName(st, f, i), ring: fault.role + ' ' + fault.ring, expected: fault.expected, actual: fault.actual });
        }
      });
      topoPanel(out, 'Ring Direction Check',
        `<p><b>${fmtNum(records.length)}</b> ring${records.length === 1 ? '' : 's'} in ${esc(st.meta.label)} run the wrong way.</p>`
        + statBoxes([[fmtNum(records.length), 'Wrong direction'], [fmtNum(rings), 'Rings checked']])
        + resultTable(['Feature', 'Ring', 'Runs', 'Expected'], records, (r) => [r.feature, r.ring, r.actual, r.expected], 'Every outer ring runs anticlockwise and every hole runs clockwise.'),
        records, { layer: st.meta.label });
    };
  }, { map: true });
}

// --- Feature Within Distance: spatial join by distance ---
function toolFeatureWithinDist() {
  const layers = layersOn(['polygon', 'line', 'point']);
  openModal('Feature Within Distance', (body) => {
    if (layers.length < 2) { body.innerHTML = overlayNeed('Turn on two layers.'); return; }
    body.innerHTML = `<p class="hint">Lists features of the first layer whose nearest ground distance to the second layer is within the kilometres you set. The distance is to the edge or the interior, not only to a vertex. ${TOPO_PANEL}</p>
      ${overlayNote()}
      <div class="frow"><label>Features to list</label><select id="fwd-a">${layerOptions(layers, 0)}</select></div>
      <div class="frow"><label>Within distance of</label><select id="fwd-b">${layerOptions(layers, 1)}</select></div>
      <div class="frow"><label>Distance (km)</label><input id="fwd-d" type="number" min="0" step="0.1" value="1"></div>
      <div class="frow act"><button class="btn primary" id="fwd-run">${icon('target')} Find within distance</button></div>
      <div id="fwd-out" style="margin-top:10px"></div>`;
    bindDistinctLayers(body.querySelector('#fwd-a'), body.querySelector('#fwd-b'), body.querySelector('#fwd-run'));
    const out = body.querySelector('#fwd-out');
    body.querySelector('#fwd-run').onclick = async () => {
      const stA = L.get(body.querySelector('#fwd-a').value);
      const stB = L.get(body.querySelector('#fwd-b').value);
      const distKm = Math.max(0, +body.querySelector('#fwd-d').value || 0);
      if (!stA?.obj) await loadLayer(stA);
      if (!stB?.obj) await loadLayer(stB);
      const a = geomSource(stA);
      const b = geomSource(stB);
      const pad = distKm / 30;
      const index = bboxGrid(b, (f) => f.bb ? [f.bb[0] - pad, f.bb[1] - pad, f.bb[2] + pad, f.bb[3] + pad] : null, 48);
      const records = [];
      a.forEach((f, i) => {
        const box = f.bb ? [f.bb[0] - pad, f.bb[1] - pad, f.bb[2] + pad, f.bb[3] + pad] : null;
        let best = Infinity, near = '';
        const candidates = box ? index.nearBox(box) : b;
        for (const g of (candidates.length ? candidates : b)) {
          const km = featureDistanceKm(f, g);
          if (km < best) { best = km; near = topoName(stB, g, b.indexOf(g)); }
          if (best === 0) break;
        }
        if (best <= distKm) records.push({ feature: topoName(stA, f, i), nearest: near, km: +best.toFixed(3) });
      });
      records.sort((p, q) => p.km - q.km);
      topoPanel(out, 'Feature Within Distance',
        `<p><b>${fmtNum(records.length)}</b> feature${records.length === 1 ? '' : 's'} of ${esc(stA.meta.label)} are within ${fmtNum(distKm)} km of ${esc(stB.meta.label)}.</p>`
        + statBoxes([[fmtNum(records.length), 'Within distance'], [fmtNum(distKm) + ' km', 'Limit']])
        + resultTable(['Feature', 'Nearest', 'km'], records, (r) => [r.feature, r.nearest, fmtNum(r.km)], 'None are within that distance.'),
        records, { from: stA.meta.label, to: stB.meta.label, km: distKm });
    };
  }, { map: true });
}

// --- Spatial Join Count: count points in polygons ---
function toolSpatialJoinCount() {
  const polys = layersOn(['polygon']);
  const points = layersOn(['point']);
  openModal('Spatial Join Count', (body) => {
    if (!polys.length || !points.length) { body.innerHTML = overlayNeed('Turn on a polygon layer and a point layer.'); return; }
    body.innerHTML = `<p class="hint">Counts how many points fall inside each polygon and writes that count as an attribute on a drawn copy. The source polygons are not changed. A point on a shared border is counted in each polygon that contains it.</p>
      ${overlayNote()}
      <div class="frow"><label>Polygons</label><select id="sjc-p">${layerOptions(polys)}</select></div>
      <div class="frow"><label>Points</label><select id="sjc-pt">${layerOptions(points)}</select></div>
      <div class="frow act"><button class="btn primary" id="sjc-run">${icon('table')} Count and write</button></div>`;
    body.querySelector('#sjc-run').onclick = async () => {
      const pSt = L.get(body.querySelector('#sjc-p').value);
      const tSt = L.get(body.querySelector('#sjc-pt').value);
      if (!pSt?.obj) await loadLayer(pSt);
      if (!tSt?.obj) await loadLayer(tSt);
      const polyFeats = geomSource(pSt).filter((f) => f.type === 'poly');
      const pts = [];
      for (const f of geomSource(tSt)) {
        if (f.type !== 'point') continue;
        for (let i = 0; i < f.parts.length; i += 2) pts.push([f.parts[i], f.parts[i + 1]]);
      }
      const index = bboxGrid(polyFeats, (f) => f.bb, 64);
      const counts = new Map();
      let shared = 0;
      for (const [x, y] of pts) {
        let hits = 0;
        for (const poly of index.near(x, y)) {
          if (x < poly.bb[0] || x > poly.bb[2] || y < poly.bb[1] || y > poly.bb[3]) continue;
          if (!pointInFeature(x, y, poly)) continue;
          counts.set(poly, (counts.get(poly) || 0) + 1);
          hits++;
        }
        if (hits > 1) shared++;
      }
      const drawn = [];
      const records = [];
      polyFeats.forEach((f, i) => {
        const n = counts.get(f) || 0;
        const name = topoName(pSt, f, i);
        const copy = polygonFeature(f.parts, { ...geomCopyProps(f), point_count: n, source: name }, { fill: n ? '#0f766e' : '#94a3b8', stroke: n ? '#0f766e' : '#94a3b8', idx: i });
        if (copy) drawn.push(copy);
        records.push({ polygon: name, point_count: n });
      });
      records.sort((a, b) => b.point_count - a.point_count);
      showGeom({
        title: 'Spatial Join Count',
        kind: 'polygon',
        layerLabel: 'Point count · ' + pSt.meta.label,
        color: '#0f766e',
        features: drawn,
        hint: `Each copied polygon of ${esc(pSt.meta.label)} has a point_count attribute. ${fmtNum(shared)} point${shared === 1 ? '' : 's'} sat on a shared border and were counted in each polygon. ${GEOM_DRAWN}`,
        stats: [[fmtNum(pts.length), 'Points'], [fmtNum(polyFeats.length), 'Polygons'], [fmtNum(shared), 'On a shared border']],
        records,
        table: resultTable(['Polygon', 'point_count'], records, (r) => [r.polygon, fmtNum(r.point_count)], 'No polygon was copied.'),
        extra: { polygons: pSt.meta.label, points: tSt.meta.label, shared_border: shared },
      });
    };
  }, { map: true });
}

// --- Buffer Dissolve: buffer then dissolve overlapping buffers ---
function toolBufferDissolve() {
  openModal('Buffer Dissolve', (body) => {
    const layers = layersOn(['polygon', 'line', 'point']);
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a point, line or polygon layer to buffer.'); return; }
    body.innerHTML = '<p>Draws a circle around each feature, then merges the circles that overlap into one zone. Circles that do not meet stay separate.</p>' + overlayNote() +
      `<div class="frow"><label>Layer</label><select id="bd-layer">${layerOptions(layers, 0)}</select></div>` +
      '<div class="frow"><label>Distance (km)</label><input id="bd-dist" type="number" min="0.01" step="0.1" value="5"></div>' +
      `<div class="frow act"><button class="btn primary" id="bd-run">${icon('target')} Buffer and merge</button></div>`;
    body.querySelector('#bd-run').onclick = () => runOverlay(() => runBufferDissolve(body.querySelector('#bd-layer').value, +body.querySelector('#bd-dist').value));
  });
}
async function runBufferDissolve(id, distKm) {
  const st = L.get(id);
  if (!st) return;
  const km = Math.max(0.01, distKm || 1);
  const job = beginOverlayJob();
  closeModal();
  if (!(await yieldOverlay(job, 'Buffering ' + st.meta.label))) return;
  if (!st.obj) await loadLayer(st);
  if (!overlayAlive(job)) return;
  const buffers = [];
  let seen = 0;
  for (const f of analysisFeatures(st)) {
    if (++seen % 12 === 0 && !(await yieldOverlay(job, 'Buffering ' + st.meta.label))) return;
    const bf = bufferFeature(f, km * 1000);
    if (bf?.parts?.length) buffers.push(bf);
  }
  const parts = await unionParts(buffers, job, 'Merging buffers');
  if (parts == null || !overlayAlive(job)) return;
  const area = partsAreaKm2(parts);
  const piece = pieceFromParts(parts, { distance_km: km, features_buffered: buffers.length, pieces: 0, area_km2: +area.toFixed(3) }, OVERLAY_COLORS.buffer, 0);
  if (piece) piece.props.pieces = piece.parts.length;
  const features = piece ? [piece] : [];
  const records = piece ? [{ distance_km: km, features_buffered: buffers.length, pieces: piece.parts.length, area_km2: +area.toFixed(3) }] : [];
  showOverlay(job, {
    title: 'Buffer dissolve',
    hint: `Circles of <b>${fmtNum(km)} km</b> around <b>${esc(st.meta.label)}</b>, merged where they overlap and drawn in green. Circles that do not meet stay separate pieces.`,
    stats: [[fmtNum(buffers.length), 'circles'], [fmtNum(piece ? piece.parts.length : 0), 'pieces after merge'], [fmtNum(area), 'km²']],
    headers: ['Distance (km)', 'Circles', 'Pieces', 'Area (km²)'],
    records,
    cells: (r) => [fmtNum(r.distance_km), fmtNum(r.features_buffered), fmtNum(r.pieces), fmtNum(r.area_km2)],
    extra: { layer: st.meta.label, distance_km: km, features_buffered: buffers.length, area_km2: +area.toFixed(3) },
    features,
    color: OVERLAY_COLORS.buffer,
    layerLabel: 'Buffer dissolve',
    emptyToast: 'Nothing to buffer',
  });
}
function toolNetworkBetweenness() {
  const layers = layersOn(['line']);
  openModal('Network Betweenness', (body) => {
    if (!layers.length) { body.innerHTML = overlayNeed('Turn on a line layer.'); return; }
    body.innerHTML = `<p class="hint">Ranks junctions by how many shortest paths along the lines pass through them. A dead end ranks below a junction that joins two parts of the network. This is not a count of lines touching the junction. ${TOPO_PANEL}</p>
      ${overlayNote()}
      <div class="frow"><label>Network</label><select id="nbe-layer">${layerOptions(layers)}</select></div>
      <div class="frow"><label>Join vertices within (m)</label><input id="nbe-join" type="number" min="0" step="1" value="25"></div>
      <div class="frow act"><button class="btn primary" id="nbe-run">${icon('query')} Rank junctions</button></div>
      <div id="nbe-out" style="margin-top:10px"></div>`;
    const out = body.querySelector('#nbe-out');
    body.querySelector('#nbe-run').onclick = async () => {
      const st = L.get(body.querySelector('#nbe-layer').value);
      const join = Math.max(0, +body.querySelector('#nbe-join').value || 0);
      if (!st?.obj) await loadLayer(st);
      out.innerHTML = '<p class="hint">Ranking junctions…</p>';
      await new Promise((r) => setTimeout(r, 0));
      const rank = networkBetweenness(buildLineNetwork(netSource(st), join), 200);
      const records = rank.rows.slice(0, 25).map((row, i) => ({ rank: i + 1, junction: row.junction, paths: +row.paths.toFixed(1) }));
      const note = rank.exact
        ? 'Every junction was used as a start.'
        : `The network has ${fmtNum(rank.nodes)} junctions, so this rank uses ${fmtNum(rank.sources)} evenly spaced starts. It is not every shortest path.`;
      topoPanel(out, 'Network Betweenness',
        `<p>${note} A junction is named by the lines that meet there.</p>`
        + statBoxes([[fmtNum(records.length), 'Junctions on a path'], [fmtNum(rank.nodes), 'Junctions']])
        + resultTable(['Rank', 'Junction', 'Paths'], records, (r) => [String(r.rank), r.junction, fmtNum(r.paths)], 'No junction sits on a shortest path between other junctions.'),
        records, { layer: st.meta.label, exact: rank.exact, starts: rank.sources });
    };
  }, { map: true });
}

// --- Field Stats by Group: grouped statistics ---
function toolFieldStatsByGroup() {
  openModal('Field Stats by Group', (body) => {
    const holder = document.createElement('div');
    body.appendChild(holder);
    const picker = layerPicker(body, () => fill(), (st) => ['polygon', 'line', 'point'].includes(st.meta.kind) && (st.meta.fields || []).some((f) => f.type === 'number'));
    function fill() {
      const st = L.get(picker.select.value);
      const text = st ? fieldOptions(st, (f) => f.type !== 'number') : '';
      const nums = st ? fieldOptions(st, (f) => f.type === 'number') : '';
      holder.innerHTML = `<p class="hint">Summarises one numeric column for each value of another column. Both columns are on this layer. ${DATA_PANEL}</p>
        <div class="frow"><label>Group</label><select id="fsg-group">${text || '<option value="">(no text column)</option>'}</select></div>
        <div class="frow"><label>Value</label><select id="fsg-val">${nums || '<option value="">(no numeric column)</option>'}</select></div>
        <div class="frow act"><button class="btn primary" id="fsg-run" type="button">${icon('chart')} Compute</button></div>
        <div id="fsg-out"></div>`;
      const out = holder.querySelector('#fsg-out');
      holder.querySelector('#fsg-run').onclick = async () => {
        const layer = L.get(picker.select.value);
        const gfield = holder.querySelector('#fsg-group').value;
        const vfield = holder.querySelector('#fsg-val').value;
        if (!layer || !gfield || !vfield) { out.innerHTML = '<p class="empty">Pick a group column and a numeric value column.</p>'; return; }
        if (gfield === vfield) { out.innerHTML = '<p class="empty">The group column and the value column have to be different.</p>'; return; }
        if (!layer.obj) { out.innerHTML = '<p class="hint">Loading…</p>'; await loadLayer(layer); if (!out.isConnected) return; }
        const grouped = fieldStatsByGroup(layer, gfield, vfield);
        if (!out.isConnected) return;
        if (!grouped.rows.length) { out.innerHTML = '<p class="empty">That value column has no numbers to summarise.</p>'; return; }
        const glabel = (layer.meta.fields || []).find((f) => f.name === gfield)?.label || gfield;
        const vlabel = (layer.meta.fields || []).find((f) => f.name === vfield)?.label || vfield;
        topoPanel(out, layer.meta.label + ' by ' + glabel,
          `<p><b>${fmtNum(grouped.rows.length)}</b> group${grouped.rows.length === 1 ? '' : 's'} of <b>${esc(vlabel)}</b>. A group with no number is left out.</p>`
          + resultTable([glabel, 'Count', 'Mean', 'Min', 'Max'], grouped.rows, (r) => [r.group, fmtNum(r.count), fmtNum(r.mean), fmtNum(r.min), fmtNum(r.max)]),
          grouped.rows, { layer: layer.meta.label, group: gfield, value: vfield });
      };
    }
    fill();
  }, { map: true });
}

// --- Random Raster: generate a random surface ---
function toolRandomRaster() {
  openModal('Random Raster', (body) => {
    body.innerHTML = `<p class="hint">Draws a new surface over the current view, or the focus area if one is set. Each cell is a random number between the minimum and the maximum. Neighbouring cells are not related. This is not a measurement of the ground, and it is not added to the catalog.</p>
      <div class="frow"><label>Columns</label><input id="rr-w" type="number" min="2" max="200" step="1" value="40"></div>
      <div class="frow"><label>Rows</label><input id="rr-h" type="number" min="2" max="200" step="1" value="40"></div>
      <div class="frow"><label>Minimum</label><input id="rr-min" type="number" step="0.1" value="0"></div>
      <div class="frow"><label>Maximum</label><input id="rr-max" type="number" step="0.1" value="100"></div>
      <div class="frow act"><button class="btn primary" id="rr-run" type="button">${icon('raster')} Draw surface</button></div>
      <div id="rr-out" style="margin-top:10px"></div>`;
    const out = body.querySelector('#rr-out');
    body.querySelector('#rr-run').onclick = () => {
      const ext = generationExtent();
      if (!ext) { out.innerHTML = '<p class="empty">The map is not showing an area to fill.</p>'; return; }
      const w = Math.max(2, Math.min(200, Math.round(+body.querySelector('#rr-w').value || 40)));
      const h = Math.max(2, Math.min(200, Math.round(+body.querySelector('#rr-h').value || 40)));
      const mn = +body.querySelector('#rr-min').value;
      const mx = +body.querySelector('#rr-max').value;
      if (!Number.isFinite(mn) || !Number.isFinite(mx)) { out.innerHTML = '<p class="empty">Set a minimum and a maximum.</p>'; return; }
      if (mx < mn) { out.innerHTML = '<p class="empty">The maximum has to be at least the minimum.</p>'; return; }
      const data = new Float32Array(w * h);
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < data.length; i++) {
        const v = mn === mx ? mn : mn + Math.random() * (mx - mn);
        data[i] = v;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      const north = Math.min(80, ext.north), south = Math.max(-80, ext.south);
      const wb = [mercX(ext.west), mercY(north), mercX(ext.east), mercY(south)];
      if (!(wb[2] > wb[0]) || !(wb[3] > wb[1])) { out.innerHTML = '<p class="empty">That area cannot hold a raster.</p>'; return; }
      const canvas = rasterCanvas(data, w, h, stretchPaint(lo, hi));
      addDerivedRaster(canvas, { w, h, wb }, data, { categorical: true });
      fillRasterResult(out, 'Random Raster', 'surface',
        `<p class="hint">${RASTER_DRAWN} ${fmtNum(w * h)} random cells over the ${ext.where}, from ${fmtNum(mn)} to ${fmtNum(mx)}. Not a measurement of the ground. Neighbouring cells are not related.</p>`
        + statBoxes([[fmtNum(w * h), 'Cells'], [fmtNum(lo), 'Lowest drawn'], [fmtNum(hi), 'Highest drawn']]),
        [{ cells: w * h, columns: w, rows: h, minimum: mn, maximum: mx, lowest: +lo.toFixed(3), highest: +hi.toFixed(3) }],
        { cells: w * h, minimum: mn, maximum: mx, where: ext.where });
    };
  }, { map: true });
}

const CLASS_SPEC = {
  jenks: {
    title: 'Natural Breaks (Jenks)',
    lead: 'Classes follow the gaps in the numbers. They are not equal counts and not equal widths.',
  },
  quantile: {
    title: 'Quantile Classification',
    lead: 'Each class holds about the same number of features. Identical values stay in one class, so a repeated value can make the counts uneven.',
  },
  equal: {
    title: 'Equal Interval Classification',
    lead: 'The classes are equal steps from the lowest value to the highest. A step with no features is still shown.',
  },
};
function paintClassification(st, field, fitted) {
  if (!st.sym) st.sym = defaultSym(st.meta);
  st.reclass = {
    field, method: fitted.method === 'equal' ? 'interval' : fitted.method,
    n: fitted.n, ramp: 'cividis', reverse: false, breaks: fitted.edges.slice(),
  };
  st.sym.fillMode = 'data';
  st.sym.stroke = '';
  if (st.obj) st.obj.sym = st.sym;
  applyReclass(st, true);
  renderLayerLists();
  saveProject();
}
function toolClassify(method) {
  const spec = CLASS_SPEC[method];
  openModal(spec.title, (body) => {
    const holder = document.createElement('div');
    body.appendChild(holder);
    const picker = layerPicker(body, () => draw(), (st) => ['polygon', 'line', 'point'].includes(st.meta.kind) && (st.meta.fields || []).some((f) => f.type === 'number'));
    function draw() {
      const st = L.get(picker.select.value);
      holder.innerHTML = `<p class="hint">${spec.lead} ${DATA_PANEL}</p>
        <div class="frow"><label>Field</label><select id="cl-field">${st ? fieldOptions(st, (f) => f.type === 'number') : '<option value="">(no numeric column)</option>'}</select></div>
        <div class="frow"><label>Classes</label><input id="cl-n" type="number" min="2" max="9" step="1" value="5"></div>
        <div class="frow act"><button class="btn primary" id="cl-run" type="button">${icon('sliders')} Classify</button></div>
        <div id="cl-out"></div>`;
      const out = holder.querySelector('#cl-out');
      holder.querySelector('#cl-run').onclick = async () => {
        const layer = L.get(picker.select.value);
        const field = holder.querySelector('#cl-field').value;
        const asked = holder.querySelector('#cl-n').value;
        if (!layer || !field) { out.innerHTML = '<p class="empty">Pick a layer and a numeric column.</p>'; return; }
        if (!layer.obj) { out.innerHTML = '<p class="hint">Loading…</p>'; await loadLayer(layer); if (!out.isConnected) return; }
        const before = dataFeatures(layer).map((f) => f.props?.[field]);
        const fitted = classifyValues(before, asked, method);
        if (!out.isConnected) return;
        if (!fitted.classes.length) { out.innerHTML = '<p class="empty">That column has no numbers to classify.</p>'; return; }
        const label = (layer.meta.fields || []).find((f) => f.name === field)?.label || field;
        const reduced = fitted.n < fitted.asked ? ` ${fmtNum(fitted.distinct)} distinct value${fitted.distinct === 1 ? '' : 's'}, so ${fitted.n === 1 ? 'one class' : fitted.n + ' classes'}, not ${fitted.asked}.` : '';
        const sampled = fitted.sampled ? ' The breaks were fitted to a sample of the values. Every value was still counted.' : '';
        const rows = fitted.classes.map((c) => ({
          layer: layer.meta.label, field, class: c.index,
          low: +Number(c.from).toFixed(4), high: +Number(c.to).toFixed(4), count: c.count,
        }));
        let coloured = false;
        try {
          if (!layer.on) await setLayer(layer.meta.id, true);
          if (!out.isConnected) return;
          paintClassification(layer, field, fitted);
          coloured = !!layer.reclass;
        } catch (error) { console.error(error); }
        const counts = fitted.classes.map((c) => c.count);
        const uneven = method === 'quantile' && counts.length > 1 && Math.max(...counts) - Math.min(...counts) > 1;
        topoPanel(out, spec.title,
          `<p><b>${fmtNum(fitted.count)}</b> value${fitted.count === 1 ? '' : 's'} of <b>${esc(label)}</b> in <b>${fmtNum(fitted.n)}</b> class${fitted.n === 1 ? '' : 'es'}.${esc(reduced)}${esc(sampled)}</p>`
          + (uneven ? '<p class="hint">Identical values stayed together, so the counts are not perfectly equal.</p>' : '')
          + (clip ? '<p class="hint">A focus area does not change these classes. Hidden features are not counted.</p>' : '<p class="hint">Hidden features are not counted. Blank numbers stay grey.</p>')
          + resultTable(['Class', 'Low', 'High', 'Count'], rows, (r) => [String(r.class), fmtNum(r.low), fmtNum(r.high), fmtNum(r.count)])
          + `<p class="hint">${coloured ? 'Coloured with Cividis.' : 'The classes are listed. The layer could not be coloured.'} The source file is unchanged.</p>`
          + `<div class="frow act"><button class="btn" id="cl-restore" type="button">Restore the layer’s own colours</button></div>`,
          rows, { layer: layer.meta.label, field, method: fitted.method, classes: fitted.n });
        const restore = out.querySelector('#cl-restore');
        if (restore) restore.onclick = () => {
          layer.reclass = null;
          applyReclass(layer, true);
          renderLayerLists(); saveProject();
          toast('Layer colours restored. The source file was not changed.');
        };
      };
    }
    draw();
  }, { map: true });
}
function toolJenksBreaks() { toolClassify('jenks'); }
function toolQuantileClass() { toolClassify('quantile'); }
function toolEqualIntervalClass() { toolClassify('equal'); }

// --- Remove Small Polygons ---
function toolRemoveSmallPoly() {
  const polyLayers = layersOn(['polygon']);
  openModal('Remove Small Polygons', (body) => {
    if (!polyLayers.length) { body.innerHTML = overlayNeed('Turn on a polygon layer.'); return; }
    body.innerHTML = `<p class="hint">Draws only the polygons at or above the minimum area, in km². A hole is subtracted, not added. The source layer is not changed and nothing is hidden.</p>
      ${overlayNote()}
      <div class="frow"><label>Polygon layer</label><select id="rsp-layer">${layerOptions(polyLayers)}</select></div>
      <div class="frow"><label>Minimum area (km²)</label><input id="rsp-min" type="number" min="0" step="0.01" value="1"></div>
      <div class="frow act"><button class="btn primary" id="rsp-run">${icon('trash')} Draw the polygons that remain</button></div>`;
    body.querySelector('#rsp-run').onclick = async () => {
      const st = L.get(body.querySelector('#rsp-layer').value);
      const minKm2 = Math.max(0, +body.querySelector('#rsp-min').value || 0);
      if (!st?.obj) await loadLayer(st);
      const drawn = [];
      const dropped = [];
      geomSource(st).forEach((f, i) => {
        if (f.type !== 'poly') return;
        const area = polygonMeasure(f.parts).areaKm2;
        const name = topoName(st, f, i);
        if (area < minKm2) { dropped.push({ feature: name, area_km2: +area.toFixed(3) }); return; }
        const copy = polygonFeature(f.parts, { ...geomCopyProps(f), area_km2: +area.toFixed(3), source: name }, { fill: '#0b6b45', stroke: '#0b6b45', idx: drawn.length });
        if (copy) drawn.push(copy);
      });
      showGeom({
        title: 'Remove Small Polygons',
        kind: 'polygon',
        layerLabel: 'Kept · ' + st.meta.label,
        color: '#0b6b45',
        features: drawn,
        hint: `${fmtNum(drawn.length)} polygon${drawn.length === 1 ? '' : 's'} of ${esc(st.meta.label)} are at or above ${fmtNum(minKm2)} km² and are drawn. ${fmtNum(dropped.length)} fell below and were left off this copy. ${GEOM_DRAWN}`,
        stats: [[fmtNum(drawn.length), 'Drawn'], [fmtNum(dropped.length), 'Left off'], [fmtNum(minKm2) + ' km²', 'Minimum']],
        records: dropped,
        table: resultTable(['Left off', 'km²'], dropped, (r) => [r.feature, fmtNum(r.area_km2)], 'Nothing was below the minimum.'),
        extra: { layer: st.meta.label, minimum_km2: minKm2, kept: drawn.length, left_off: dropped.length },
        emptyToast: 'Nothing was at or above the minimum',
      });
    };
  }, { map: true });
}

window.addEventListener('keydown', (e) => {
});

window.addEventListener('keydown', (e) => {
});

window.addEventListener('keydown', (e) => {
});
// handy when something needs a closer look from the browser console
window.__nwg = {
  map, L, build: BUILD, get catalog() { return catalog; }, get stack() { return stack; }, get annotations() { return annotations; }, get notes() { return mapNotes; },
  tapMerc(x, y) {
    const fn = networkPick?.onPoint;
    networkPick = null;
    if (map?.cv && !draw && !bufferPick?.active) map.cv.style.cursor = '';
    fn?.(unX(x), unY(y), x, y);
  },
  rasterClassAnchor, layerRank, showResults, openQuality,
  // focus / analysis surface (also handy for scripting the map from the console)
  get clip() { return clip; }, get draw() { return draw; }, get author() { return AUTHOR; },
  get sel() { return selState; }, toolSelect, enterSelectMode, exitSelectMode, selClear, selItems, openSelectionList, selToggle, toolFilter,
  setFocus, stopFocus, focusFromLonLat, focusFromRect, focusFromFeature, focusAreaKm2, focusPerimeterKm,
  buildShareUrl, saveProject,
  startDraw, endDraw, startPick, toolClip, toolAoi, toolQuery, runQuery, toolChart, resetView, toggleFullscreen,
  get viewHist() { return viewHist; }, goBack, onView,
  clearAnalysisLayers, classifyValues,
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
    temporal: 'Filter and step through features that carry a date or a year. A source time period is listed, but it is not a field.',
  search: 'Find a feature, read a point, convert a coordinate, or browse the catalog.',
  data: 'Tables, statistics and filters for the layer you are looking at.',
  cartography: 'Colours, basemaps, saved views and page pictures. Nothing here edits the data files.',
  project: 'The view itself: back to the start, or full screen.',
  mobile: 'Comfort and access settings for phones, tablets, screen readers and colourblind users.',
  sharing: 'Send the current view, or keep a session and notes in this browser. A share link does not carry colours, filters, notes or an imported file.',
  raster: 'Cell tools for a raster that is on. A new surface or contour is drawn on the map and can be cleared. A count or a chart stays in the panel and says so.',
  geometry: 'Shape operations. A new shape is drawn and the source is left unchanged. A measurement stays in the panel and says so.',
  topology: 'Data-quality checks. A check stays in the panel and does not edit the source. A tool that changes geometry draws a copy.',
  network: 'Tools that follow lines as a network. A route is drawn along the lines and leaves the source unchanged. A check stays in the panel.',
  generation: 'New shapes drawn on the map. A grid uses kilometres on the ground and covers the view, or the focus area if one is set. Nothing here edits a source layer.',
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
  intersect: { about: 'Keeps only the ground that two polygon layers both cover, measured in km².', steps: ['Switch on two polygon layers.', 'Tools → <b>Intersect / Overlay</b>. Layer B starts on the other layer.', 'Run. The shared ground is drawn in red. The total counts that ground once; the table lists each pair.'], needs: 'Two polygon layers on.', tip: 'A selection or a clip narrows both layers. The export has no coordinates.' },
  nearest: { about: 'Matches each feature in one layer to the closest feature in another, measured edge to edge. A point inside a polygon is 0 km, not the distance to its middle.', steps: ['Switch on both layers.', 'Tools → <b>Nearest Neighbor</b>. Layer B starts on the other layer.', 'Set how many matches, and optionally a maximum distance, then run. Each match is drawn as a line.'], needs: 'Two vector layers on.', tip: 'The search keeps widening until a nearer feature is impossible, so a neighbour just outside the first neighbourhood is not missed. A selection or a clip narrows both layers. The export has no coordinates.' },
  dissolve: { about: 'Merges polygons that share the same value in a field into one shape per group, removing the borders they share and keeping the gaps between them.', steps: ['Switch on a polygon layer.', 'Tools → <b>Dissolve / Merge</b>.', 'Choose the layer and the attribute to group by, then run. Each group is drawn in brown with its area.'], needs: 'A polygon layer on.', tip: 'A selection or a clip narrows the features that are merged.' },
  count: { about: 'Counts the points of one layer that fall inside each polygon of another. A point on a shared border is counted in every polygon that contains it, and the result says how many were shared.', steps: ['Switch on a polygon layer and a point layer.', 'Tools → <b>Count Points in Polygons</b>, choose both.', 'Optionally total a numeric field, and choose whether empty polygons stay in the list.'], needs: 'One polygon layer and one point layer on.', tip: 'The headline count and the polygon rows can add up to more than the points when borders are shared. That is stated, not hidden.' },
  hull: { about: 'Draws the smallest shape with no inward corners that still holds every feature. Lines and polygons are enclosed by their outline, not only their middle.', steps: ['Switch on a vector layer.', 'Tools → <b>Convex Hull</b>.', 'Leave the group blank for one hull, or pick a field for one hull per value.'], needs: 'A vector layer with at least three points.', tip: 'A group with fewer than three points is counted and left undrawn rather than failing the whole run.' },
  simplify: { about: 'Drops bends that move a line or a polygon boundary by less than the tolerance, and draws a lighter copy. The original layer is not changed.', steps: ['Switch on a line or polygon layer.', 'Tools → <b>Simplify Geometry</b>, set the tolerance in metres.', 'Run. The result shows vertices before and after, and how many features were left out.'], needs: 'A line or polygon layer on.', tip: 'A tolerance large enough to erase a small polygon leaves that polygon out instead of drawing an empty shape. Points have no bends to drop.' },
  zonal: { about: 'Summarises a raster inside each polygon: sample count, the cells that sample stands for, mean, median, min and max. NoData is skipped, never treated as zero.', steps: ['Switch on a raster and a polygon layer.', 'Tools → <b>Zonal Statistics</b>.', 'Pick a sample density and run. Finer reads more cells and takes longer.'], needs: 'One raster and one polygon layer on.', tip: 'The cells column is samples times the sample step. It is a scale, not a claim that every skipped cell was inside the polygon. A cell under two polygons is counted in both.' },
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
  timefilter: { about: 'Keeps features whose date or year field matches a range, an exact year, or on-or-before / on-or-after. The layer turns on if it is off. The rule joins the filter list, so another filter on that layer still applies.', steps: ['Tools → <b>Temporal Filter</b>. The map stays visible.', 'Choose the layer and the year field. A source time period is not a field and is not listed here.', 'Set the years and apply. Clear removes only the time rule.'], needs: 'A numeric or date field whose name is a year, date or time. A text column is not used, even if it is called a date.', tip: 'If the field has no year numbers, nothing is hidden.' },
  timelayers: { about: 'Lists catalog layers that have a date or year field, and separately those that only record a source time period. Show, hide and zoom are different actions. Zoom does not turn a layer on.', steps: ['Tools → <b>Temporal Layers</b>.', 'Show turns a layer on and names it only after it is on. Hide turns it off.', 'Zoom fits a layer that is already on. A source-period row cannot be scrubbed.'] },
  timeslider: { about: 'Shows one year at a time on a date or year field. Play steps through years that exist. Stop removes the time filter. Closing the panel stops playback and leaves the filter in place.', steps: ['Tools → <b>Time Slider</b>. The map stays visible.', 'Choose the layer and field, then move the slider or press Play. The layer turns on if it is off.', 'Stop shows the features again.'] , tip: 'The year range is read from the field you picked, not from the first field on the layer. Empty years between the oldest and newest are skipped.' },
  find: { about: 'Searches feature attributes on the layers that are on, names the field that matched, and jumps to the feature. A layer that is off can be included without being shown.', steps: ['Tools → <b>Feature Finder</b>. The map stays visible.', 'Type part of a name, code or number. Narrow by layer, field, or exact match if you need to.', 'Pick a result. The map zooms there and the Info panel opens.'], needs: 'A vector layer on, or one off layer chosen in the list.', tip: 'Filters and the focus area are respected unless you tick otherwise. The button at the top right only searches layers that are already on.' },
  coords: { about: 'Reads the point you tap: decimal degrees, degrees-minutes-seconds, and a grid position you can copy. The panel does not cover the map.', steps: ['Tools → <b>Coordinate Inspector</b>.', 'Tap the map. Choose WGS 84 UTM, Minna, or a Nigeria belt.', 'Copy the readout, or stop inspecting. Closing the panel always stops the tap.'], tip: 'A Minna position uses the national shift and is only good to about 15 metres. It is not a survey fix.' },
  convert: { about: 'Keeps decimal degrees, degrees-minutes-seconds and a named grid in step. Decimal degrees are WGS 84, the same system as the map.', steps: ['Tools → <b>Coordinate Converter</b>.', 'Type in any form, or paste a coordinate. The others update. Pick a fixed zone to type an easting and northing.', 'Go to moves the map. Pick on map fills the form from a tap. Map centre uses the current centre.'], tip: 'A latitude past 85 can be converted, but this map cannot draw it. An impossible value is refused, with the reason. Minna shows the 15-metre limit.' },
  layerfind: { about: 'Searches the catalog by name, description, source, group or column, then shows, hides or zooms as separate actions.', steps: ['Tools → <b>Layer Discovery</b>. The map stays visible.', 'Type a name, a source, or a column name. The count of matches is shown.', 'Show turns a layer on after it has loaded. Zoom does not turn it on. Hide turns it off.'], tip: 'A catalog layer you show is saved in this browser. An imported layer is listed too, with its accuracy note, and still stays off until you show it.' },
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
  ramp: { about: 'Colours a layer that is on. Classify a numeric field into quantile or equal-interval classes, or paint the whole layer one stop from the ramp. Cividis is the colourblind-safe ramp.', steps: ['Switch on the layer.', 'Tools → <b>Color Ramps</b>. The breaks are shown before you apply.', 'Apply. Restore brings the layer’s own colours back. The data file is not edited.'], needs: 'A vector layer on.', tip: 'A field with fewer distinct values than the class count you asked for is not padded with empty classes. Blank numbers stay grey. Lines take the class colour too, not only polygon fills.' },
  custombasemap: { about: 'Adds an XYZ tile URL and keeps it in this browser, including after a reload. It cannot replace a built-in basemap.', steps: ['Tools → <b>Custom Basemap</b>.', 'Name it, paste an https URL containing {z}, {x} and {y}, and write the attribution the licence asks for.', 'Add. Use switches to it. Remove drops it and, if it was on, returns to Light grey.'], tip: 'Tiles are requested from that server only while the basemap is on. A URL without {z}, {x} and {y}, or one that is not https, is refused.' },
  mappreset: { about: 'Saves the layers that are on, their colours, filters and opacity, the basemap and the focus area, then restores that map. The centre is restored but not shown.', steps: ['Set the map up.', 'Tools → <b>Map Presets</b>, name it and save.', 'Restore later. A layer that is not in this browser is counted, not invented.'], tip: 'Tick replace before saving over a name. This is the whole map, not just the view a bookmark stores.' },
  printlayout: { about: 'Fits the current map on an A4, A3 or Letter page without stretching it. The picture has a title, optional legend, scale bar and north arrow, and no latitude or longitude.', steps: ['Tools → <b>Print Layouts</b>. The preview shows the map inside the page.', 'Download this page, or leave it saved so Save map picture uses it.', 'Use screen pictures again to return Save map picture to the screen.'], tip: 'White space is page margin, not stretched ground. The scale bar assumes the map is north-up.' },
  resetview: { about: 'Back to the opening extent with no filters or focus. A playing time slider stops, so the filter does not come back. Rotation returns north-up.', steps: ['Tools → <b>Reset the view</b>.'], tip: 'Your layer list and colours are kept; only the view and filters reset.' },
  fullscreen: { about: 'Uses the whole screen with no browser chrome. The Tools button and the expand button are the same switch.', steps: ['Tools → <b>Full screen</b>, or the expand button at the top right.', 'Press Esc or the button again to come back.'], tip: 'If this browser blocks full screen, the map says so and stays as it was.' },
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
  a11y: { about: 'High contrast, larger text and reduced motion. Each control applies as you change it, and this browser keeps the choice for the next visit.', steps: ['Tools → <b>Accessibility</b>.', 'Tick high contrast, move the text size, or tick reduced motion. There is no separate Apply.', 'Reset returns all three to the default.'] , tip: 'Reduced motion shortens panel and button animations on top of the browser’s own reduced-motion setting. High contrast uses solid borders, not a washed-out filter.' },
  gestures: { about: 'Says what drag, pinch and double-tap do, and whether this device reports a touch screen. A narrow window is not treated as a phone.', steps: ['Tools → <b>Gesture Guide</b>.', 'Read the gesture, then close it. Nothing on the map changes.'] },
  screenreader: { about: 'Turns live announcements on or off. When on, layer, filter and measurement toasts are also announced, and the map names the layers that are on. This browser remembers the choice.', steps: ['Tools → <b>Screen Reader</b>.', 'Turn live announcements on. Announce current view speaks the centre, zoom and the layers that are on.', 'Turn them off again the same way. The button follows the current state.'] },
  colorblind: { about: 'Paints a layer that is on with a colourblind-safe ramp, or classifies a numeric field with it. The legend follows. Cividis is included. A red-against-green ramp is not offered.', steps: ['Turn a vector layer on.', 'Tools → <b>Colorblind Palettes</b>. The map stays visible.', 'Pick the layer, a numeric field or one colour, and a palette, then apply.'] , needs: 'A vector layer on. A raster takes the ramp on its legend only.', tip: 'The same ramps are in Color Ramps. Restore that layer’s own colours from there.' },
  shareview: { about: 'Copies a link that reopens this centre, zoom, basemap and the catalog layers that are on, including a focus area and the grid. Colours, filters, notes and an imported layer are not in the link.', steps: ['Set the map up.', 'Tools → <b>Share View</b>. The map stays visible. The link is refreshed when you copy it.', 'Copy the link, or use Share if this device offers it.'], tip: 'The link contains the map centre so the view can reopen. It is not a data export. Use a session code to send colours, filters and notes.' },
  session: { about: 'Saves this map in this browser under a 6-character code, and copies a longer code that carries the session so someone else can paste it. There is no server. A 6-character code only works in the browser that saved it.', steps: ['Tools → <b>Session Codes</b>. The map stays visible.', 'Save. Copy the longer code to send the session.', 'Paste a code and restore it. The layers, colours, filters, focus area, grid and notes come back after they have loaded.'], tip: 'An imported file stays in this browser and is named, not sent. The centre is restored but not shown.' },
  mapnotes: { about: 'Adds a text marker on the map. Drag it to move it. It stays in this browser. It is not a layer, it is not in an export, and a share link does not include it.', steps: ['Tools → <b>Map Notes</b>. The map stays visible.', 'Type the note and add it at the centre.', 'Drag the marker to move it, or remove it from the list.'], tip: 'A session code can carry the notes. A share link cannot.' },
  rastercalc: { about: 'Builds a new surface from each cell of one raster. The expression can use v, numbers, + - * /, comparisons, and abs, sqrt, log, round, floor or ceil. It does not run typed code. The original layer is unchanged.', steps: ['Turn a raster on.', 'Tools → <b>Raster Calculator</b>. The map stays visible.', 'Write an expression such as v * 2 or v > 100, then run. The new surface is drawn on the map.'], needs: 'A raster layer on.', tip: 'Empty cells stay empty. Clear removes the surface.' },
  rasterreclass: { about: 'Groups the cell values into equal-interval or quantile classes and draws those classes as a new surface. It does not recolour the original raster, and it is not the vector classifier.', steps: ['Turn a raster on.', 'Tools → <b>Raster Reclassify</b>. The map stays visible.', 'Choose the method and the number of classes, then run.'], needs: 'A raster layer on.', tip: 'Class numbers on the new surface start at 1. The original layer is unchanged.' },
  rasterstats: { about: 'Reports the lowest, highest, mean and standard deviation of the cell values. The numbers stay in the panel. This does not draw a layer.', steps: ['Turn a raster on.', 'Tools → <b>Raster Statistics</b>. The map stays visible.', 'Choose the raster and run. Read the panel.'], needs: 'A raster layer on.', tip: 'Empty cells are skipped, not treated as zero.' },
  rasterclip: { about: 'Draws a new surface that keeps a cell only when its centre is inside the focus area. It does not draw the focus box as a layer, and it does not change the original raster.', steps: ['Set a focus area.', 'Turn a raster on.', 'Tools → <b>Raster Clip / Mask</b>. The map stays visible.', 'Run. Cells outside the focus are left empty on the new surface.'], needs: 'A focus area and a raster layer on.', tip: 'A cell on the boundary follows its centre.' },
  rastercontour: { about: 'Draws contour lines on the raster at the interval you set. The lines use the raster position on the map, not pixel numbers. A very fine interval is limited, and the panel says so.', steps: ['Turn a raster on.', 'Tools → <b>Raster Contour</b>. The map stays visible.', 'Set the interval and run.'], needs: 'A raster layer on.', tip: 'Lines are traced on a sample of the cells, so a bend between samples is not drawn.' },
  rasterslope: { about: 'Draws a new surface of slope in degrees, using the ground size of each cell. That is a ground slope only when the cell values are heights in metres, such as the elevation layer.', steps: ['Turn the elevation raster on.', 'Tools → <b>Raster Slope</b>. The map stays visible.', 'Run. The steepest samples are listed in the panel, without a location.'], needs: 'A raster layer on. Use elevation if you want a ground slope.', tip: 'The edge of the raster is left empty, because a slope needs neighbouring cells. The original layer is unchanged.' },
  rasterhist: { about: 'Shows how the cell values are spread, as bars in the panel. This does not draw a layer.', steps: ['Turn a raster on.', 'Tools → <b>Raster Histogram</b>. The map stays visible.', 'Choose the number of bars and run.'], needs: 'A raster layer on.', tip: 'Empty cells are skipped, not treated as zero.' },
  rasterclipoly: { about: 'Draws a new surface that keeps a cell only when its centre is inside a polygon. The original raster is unchanged.', steps: ['Turn on a raster and a polygon layer.', 'Tools → <b>Raster Clip by Polygon</b>. The map stays visible.', 'Choose both and run.'], needs: 'A raster and a polygon layer on.', tip: 'A selected polygon, or a focus area, narrows which polygons are used. A cell in a hole is left empty.' },
  rasteroverlay: { about: 'Draws a new surface from two rasters, cell by cell: add, subtract, multiply, divide, minimum or maximum. Both rasters must have the same number of rows and columns. The originals are unchanged.', steps: ['Turn on two rasters of the same size.', 'Tools → <b>Raster Overlay Math</b>. The map stays visible.', 'Choose A, B and the operation. Raster B starts on the other layer.', 'Run.'], needs: 'Two different rasters on, with the same number of rows and columns.', tip: 'A cell is left empty when either raster is empty, or when a division is by zero.' },
  rasterclasszonal: { about: 'Counts how much of each raster class falls inside each polygon. The counts stay in the panel. This does not draw a layer. A raster with no published classes is grouped into equal-interval bins, and the panel says so.', steps: ['Turn on a raster and a polygon layer.', 'Tools → <b>Raster Class Zonal</b>. The map stays visible.', 'Choose both and run. Read the table.'], needs: 'A raster and a polygon layer on.', tip: 'The grid is sampled. A cell in two polygons is counted in both. Empty cells are skipped.' },
  rasterdiff: { about: 'Subtracts raster B from raster A cell by cell and reports how many cells are higher, lower or equal. The counts stay in the panel. This does not draw a new map layer.', steps: ['Turn on two rasters of the same size.', 'Tools → <b>Raster Difference</b>. The map stays visible. Raster B starts on the other layer.', 'Run. Read the counts.'], needs: 'Two different rasters on, with the same number of rows and columns.', tip: 'A cell with no value in either raster is skipped, not treated as zero.' },
  centroid: { about: 'Draws a point at the area centre of each polygon, or the vertex centre of a line or point. A hole is left out of a polygon centre. The original layer is unchanged.', steps: ['Turn a vector layer on.', 'Tools → <b>Feature Centroid</b>. The map stays visible.', 'Choose the layer and run. The points are drawn.'], needs: 'A point, line or polygon layer on.', tip: 'A selection or a focus area narrows which features are used.' },
  densify: { about: 'Draws a copy of each line with a vertex added every time the line travels the interval. The interval is kilometres on the ground. The original line is unchanged.', steps: ['Turn a line layer on.', 'Tools → <b>Densify Lines</b>. The map stays visible.', 'Set the interval in kilometres and run.'], needs: 'A line layer on.', tip: 'A short leftover at the end is kept. It is not stretched to another full step.' },
  splitpoly: { about: 'Cuts each polygon where a line crosses it and draws the pieces. A line that misses, or only touches, leaves that polygon whole. The original layers are unchanged.', steps: ['Turn on a polygon layer and a line layer.', 'Tools → <b>Split Polygon by Line</b>. The map stays visible.', 'Choose both and run. Cut pieces are amber.'], needs: 'A polygon layer and a line layer on.', tip: 'This uses the line layer. It does not ask you to draw a new line.' },
  concavehull: { about: 'Draws one outline around the vertices. A smaller alpha, in kilometres, can follow a bay when a neighbour is close enough. If the points are farther apart than that, the outline is the convex hull.', steps: ['Turn a vector layer on.', 'Tools → <b>Concave Hull</b>. The map stays visible.', 'Set alpha in kilometres and run.'], needs: 'A point, line or polygon layer on.', tip: 'Alpha is a ground distance, not a unitless slider. A large value stays near the convex hull.' },
  affinetransform: { about: 'Draws a moved, rotated or scaled copy. East and north are kilometres on the ground, not degrees. The original layer is unchanged.', steps: ['Turn a vector layer on.', 'Tools → <b>Affine Transform</b>. The map stays visible.', 'Set east, north, scale and rotation, then run.'], needs: 'A point, line or polygon layer on.', tip: 'Rotation is around each feature’s own centre.' },
  linetopoly: { about: 'Closes each line that has at least three vertices and draws it as a polygon. A two-point line is skipped. The original line is unchanged.', steps: ['Turn a line layer on.', 'Tools → <b>Lines to Polygons</b>. The map stays visible.', 'Run. Closed rings are drawn.'], needs: 'A line layer on.', tip: 'A line that was already closed is still one polygon. It is not closed a second time.' },
  polyoutline: { about: 'Draws each outer ring and each hole as its own line. The polygons are unchanged.', steps: ['Turn a polygon layer on.', 'Tools → <b>Polygon Outlines</b>. The map stays visible.', 'Run. The lines are drawn.'], needs: 'A polygon layer on.', tip: 'A hole is a line too, not dropped.' },
  featuresmooth: { about: 'Draws a copy with each vertex moved toward its two neighbours. Endpoints of an open line stay put. The original layer is unchanged.', steps: ['Turn a line or polygon layer on.', 'Tools → <b>Smooth Features</b>. The map stays visible.', 'Set the number of passes and run.'], needs: 'A line or polygon layer on.', tip: 'More passes pull the shape further toward a simple curve. They do not add vertices.' },
  featurebuffer: { about: 'Draws a zone around every feature at the distance you set, in kilometres on the ground. The original layer is unchanged.', steps: ['Turn a point, line or polygon layer on.', 'Tools → <b>Feature Buffer</b>. The map stays visible.', 'Set the distance in kilometres and run.'], needs: 'A point, line or polygon layer on.', tip: 'Points become circles, lines become corridors, polygons grow outward.' },
  boundingbox: { about: 'Draws the rectangle around each feature. A single point has no area, so it is skipped. The original layer is unchanged.', steps: ['Turn a vector layer on.', 'Tools → <b>Bounding Box / Envelope</b>. The map stays visible.', 'Run. One rectangle is drawn per feature that has an extent.'], needs: 'A point, line or polygon layer on.', tip: 'The rectangle uses the vertices, not a padded guess.' },
  vertexstopoints: { about: 'Draws one point for every vertex. The closing point of a ring is not drawn twice. The original layer is unchanged.', steps: ['Turn a vector layer on.', 'Tools → <b>Vertices to Points</b>. The map stays visible.', 'Run. The points are drawn.'], needs: 'A point, line or polygon layer on.', tip: 'A point layer comes back as the same points.' },
  areaperim: { about: 'Reports area in km² and perimeter in km for every polygon. A hole is subtracted from the area and added to the perimeter. The numbers stay in the panel. This does not draw a layer.', steps: ['Turn a polygon layer on.', 'Tools → <b>Area & Perimeter</b>. The map stays visible.', 'Run. Read the table.'], needs: 'A polygon layer on.', tip: 'A hole is not added to the area.' },
  linepoints: { about: 'Draws a point at the start of each line, then one each time the line travels the interval. The interval is kilometres on the ground and continues across a bend. The original line is unchanged.', steps: ['Turn a line layer on.', 'Tools → <b>Points Along Lines</b>. The map stays visible.', 'Set the interval in kilometres and run.'], needs: 'A line layer on.', tip: 'The interval does not restart at every vertex.' },
  centroidpts: { about: 'Draws the area centre of each polygon. A hole is left out of that centre. The original layer is unchanged.', steps: ['Turn a polygon layer on.', 'Tools → <b>Polygon Centroids → Points</b>. The map stays visible.', 'Run. The points are drawn.'], needs: 'A polygon layer on.', tip: 'This is the area centre, not the average of the vertices.' },
  polyadjacency: { about: 'Lists pairs of polygons that share a border or whose outlines cross. A shared corner alone is not listed. The list stays in the panel. This does not draw a layer.', steps: ['Turn a polygon layer on.', 'Tools → <b>Polygon Adjacency</b>. The map stays visible.', 'Run. Read the pairs.'], needs: 'A polygon layer on.', tip: 'A gap, even a small one, is not a shared border.' },
  lineoffset: { about: 'Draws a parallel copy of each line at the distance you set, in kilometres on the ground. Left of a line going east is north. The original line is unchanged.', steps: ['Turn a line layer on.', 'Tools → <b>Line Offset</b>. The map stays visible.', 'Set the distance and the side, then run.'], needs: 'A line layer on.', tip: 'The distance is ground kilometres, not a step in map units.' },
  polyunion: { about: 'Merges every polygon of a layer into one shape and removes the borders they share. Gaps stay open.', steps: ['Switch on a polygon layer.', 'Tools → <b>Polygon Union / Merge</b>, choose the layer and run.', 'The merged shape is drawn in green. Attributes are not copied.'], needs: 'A polygon layer on.', tip: 'Use Dissolve / Merge instead when each attribute value should stay its own shape.' },
  linelenstats: { about: 'Reports the total, mean, shortest and longest length of the lines, in kilometres. One row is one line feature. The numbers stay in the panel. This does not draw a layer.', steps: ['Turn a line layer on.', 'Tools → <b>Line Length Statistics</b>. The map stays visible.', 'Run. Read the panel.'], needs: 'A line layer on.', tip: 'A line made of several parts is still one feature.' },
  checkoverlap: { about: 'Lists polygon pairs whose areas overlap, with the overlap in km². A shared border alone is not an overlap. The list stays in the panel. This does not draw a layer and does not change the source.', steps: ['Turn a polygon layer on.', 'Tools → <b>Check Overlaps</b>. The map stays visible.', 'Run. Read the pairs.'], needs: 'A polygon layer on.', tip: 'A shared border is not an overlap. The area has to cross.' },
  checkgaps: { about: 'Lists holes the polygons enclose between them, with the area of each hole in km². Ground outside the group is not a gap, and a hole cut into one polygon is not a gap. The list stays in the panel. This does not draw a layer and does not change the source.', steps: ['Turn a polygon layer on.', 'Tools → <b>Check Gaps</b>. The map stays visible.', 'Run. Read the enclosed gaps.'], needs: 'A polygon layer on.', tip: 'Two polygons that only touch, or that leave a corridor open to the outside, have no enclosed gap.' },
  validate: { about: 'Lists features with missing coordinates, an unclosed ring, fewer than three ring vertices, a zero-area ring, a ring or line that crosses itself, or a coordinate outside longitude or latitude. A point is checked for coordinates and range only. The list stays in the panel. This does not draw a layer and does not change the source.', steps: ['Turn a point, line or polygon layer on.', 'Tools → <b>Validate Geometry</b>. The map stays visible.', 'Run. Read the issues.'], needs: 'A point, line or polygon layer on.', tip: 'A valid point is not flagged for having no ring.' },
  snap: { about: 'Draws a copy of the first layer with each vertex moved onto the nearest vertex of the second layer, when that vertex is within the tolerance. The tolerance is metres on the ground. Neither source layer is changed.', steps: ['Turn on two layers.', 'Tools → <b>Snap Features</b>. The map stays visible.', 'Choose which layer moves, which layer it snaps to, and the metres, then run.'], needs: 'Two layers on.', tip: 'A vertex farther than the tolerance stays where it is.' },
  selfintersect: { about: 'Lists lines and polygon rings whose own segments cross. A bend, and touching at a shared vertex, are not a cross. The list stays in the panel. This does not draw a layer and does not change the source.', steps: ['Turn a line or polygon layer on.', 'Tools → <b>Check Self-Intersections</b>. The map stays visible.', 'Run. Read the features.'], needs: 'A line or polygon layer on.', tip: 'A bowtie is listed. A simple rectangle is not.' },
  duplicategeom: { about: 'Lists features whose coordinates match. A reverse ring and a different starting vertex still count as the same shape. The tolerance is metres on the ground, not degrees. The list stays in the panel. This does not draw a layer and does not change the source.', steps: ['Turn a point, line or polygon layer on.', 'Tools → <b>Duplicate Geometries</b>. The map stays visible.', 'Set the tolerance in metres and run.'], needs: 'A point, line or polygon layer on.', tip: 'The same outline stored clockwise and anticlockwise is still one shape.' },
  snaptogrid: { about: 'Draws a copy with every longitude and latitude rounded to the grid step, in degrees. The step is not applied to the map’s internal units. The source layer is not changed.', steps: ['Turn a point, line or polygon layer on.', 'Tools → <b>Snap to Grid</b>. The map stays visible.', 'Set the step in degrees and run.'], needs: 'A point, line or polygon layer on.', tip: '0.01 degrees is about a kilometre, not a step in map units.' },
  erasefeatures: { about: 'Cuts one polygon layer out of another. A polygon that is only partly covered keeps the rest; one that is fully covered is removed.', steps: ['Switch on two polygon layers.', 'Tools → <b>Feature Erase / Difference</b>. The second menu starts on the other layer.', 'Run. What remains is drawn in amber. The table lists only polygons that were cut or removed.'], needs: 'Two polygon layers on.', tip: 'This cuts the overlapping piece out. It does not drop a whole polygon just because it touches the other layer.' },
  checknullgeom: { about: 'Lists features with no usable coordinates: a point with no position, a line with fewer than two vertices, or a polygon with no ring. A short but real shape is not null. The list stays in the panel. This does not draw a layer and does not change the source.', steps: ['Turn a point, line or polygon layer on.', 'Tools → <b>Check Null Geometries</b>. The map stays visible.', 'Run. Read the features.'], needs: 'A point, line or polygon layer on.', tip: 'A point is not null just because it has no ring.' },
  checkoutofbounds: { about: 'Lists features with a longitude outside −180 to 180, a latitude outside −90 to 90, or a coordinate that is not a number. The test uses degrees, not the map’s internal units. The list stays in the panel. This does not draw a layer and does not change the source.', steps: ['Turn a point, line or polygon layer on.', 'Tools → <b>Check Out of Bounds</b>. The map stays visible.', 'Run. Read the features.'], needs: 'A point, line or polygon layer on.', tip: 'A coordinate inside Nigeria is not out of bounds.' },
  checkmultipart: { about: 'Lists features stored as several separate pieces: more than one point, more than one line, or more than one polygon. A hole is part of its polygon, not a second part. The list stays in the panel. This does not draw a layer and does not change the source.', steps: ['Turn a point, line or polygon layer on.', 'Tools → <b>Check Multi-part Features</b>. The map stays visible.', 'Run. Read the features and their part counts.'], needs: 'A point, line or polygon layer on.', tip: 'One polygon with a hole is a single part.' },
  ringdirection: { about: 'Lists rings that run the wrong way for their role. In this map an outer ring runs anticlockwise and a hole runs clockwise, because map y grows downward. A correct outer ring is not called a hole. The list stays in the panel. This does not draw a layer and does not change the source.', steps: ['Turn a polygon layer on.', 'Tools → <b>Ring Direction Check</b>. The map stays visible.', 'Run. Read the rings that disagree with their role.'], needs: 'A polygon layer on.', tip: 'Anticlockwise here is the ordinary outer ring, not a fault.' },
  featurewithindist: { about: 'Lists features of the first layer whose nearest ground distance to the second layer is within the kilometres you set. The distance is to the edge or the interior, not only to a vertex. The list stays in the panel. This does not draw a layer and does not change the source.', steps: ['Turn on two layers.', 'Tools → <b>Feature Within Distance</b>. The map stays visible.', 'Set the kilometres and run.'], needs: 'Two layers on.', tip: 'A point inside a polygon is 0 km away, even when it is far from every vertex.' },
  spatialjoincount: { about: 'Counts how many points fall inside each polygon and writes that count as a point_count attribute on a drawn copy. The source polygons are not changed. A point on a shared border is counted in each polygon that contains it.', steps: ['Turn on a polygon layer and a point layer.', 'Tools → <b>Spatial Join Count</b>. The map stays visible.', 'Run. The copied polygons are drawn, and the table shows each point_count.'], needs: 'A polygon layer and a point layer on.', tip: 'The count is an attribute of the copy, not a number written back onto the source.' },
  bufferdissolve: { about: 'Draws a circle around each feature, then merges the circles that overlap into one zone.', steps: ['Switch on a point, line or polygon layer.', 'Tools → <b>Buffer Dissolve</b>, set the distance in kilometres and run.', 'Overlapping circles become one zone. Circles that do not meet stay separate.'] },
  removesmallpoly: { about: 'Draws only the polygons at or above the minimum area, in km². A hole is subtracted, not added. Polygons below the minimum are left off the copy. The source layer is not changed and nothing is hidden.', steps: ['Turn a polygon layer on.', 'Tools → <b>Remove Small Polygons</b>. The map stays visible.', 'Set the minimum km² and run. The polygons that remain are drawn.'], needs: 'A polygon layer on.', tip: 'This draws a copy. It does not delete or hide the source polygons.' },
  shortestpath: { about: 'Draws the shortest route along the lines between two taps. Travel is allowed in either direction. Lines join only where a vertex is within the snap distance, in metres. A crossing without a shared vertex is not a junction. The length is kilometres along the lines, not the straight line between the taps. The source lines are not changed.', steps: ['Turn a line layer on.', 'Tools → <b>Shortest Path</b>. The map stays visible.', 'Pick the start and the end on the map, then run.'], needs: 'A line layer on.', tip: 'If the taps are on lines that never meet, no route is drawn. Crossing is not enough.' },
  servicearea: { about: 'Draws the parts of the lines you can travel within the distance, starting from a tap. It is not a circle, and land off the lines is not included. Travel is allowed in either direction. The source lines are not changed.', steps: ['Turn a line layer on.', 'Tools → <b>Service Area</b>. The map stays visible.', 'Set the distance in kilometres, pick the start on the map, and run.'], needs: 'A line layer on.', tip: 'The drawn length stops at the distance. It does not keep going to the end of the line.' },
  tracenet: { about: 'Draws the lines reached by following the stored direction from a tap. Downstream runs from the first vertex of each line toward the last. It does not follow a line backward, and it does not know a river’s flow unless the line was stored that way. The source lines are not changed.', steps: ['Turn a line layer on.', 'Tools → <b>Trace Network</b>. The map stays visible.', 'Choose downstream or upstream, pick the start on the map, and run.'], needs: 'A line layer on.', tip: 'Upstream from the first vertex of a line does not walk back along that line.' },
  networkbuffer: { about: 'Draws the lines you can travel within the distance of each point. A point farther from a line than the snap distance is left out and named. This is not a circle around the point. The first 80 points are used. The source layers are not changed.', steps: ['Turn on a line layer and a point layer.', 'Tools → <b>Network Buffer</b>. The map stays visible.', 'Set the distance in kilometres and how near a point must be to a line, then run.'], needs: 'A line layer and a point layer on.', tip: 'A point that is not on a line does not grow a circle.' },
  networkconnect: { about: 'Counts separate pieces of a line layer. Two lines are the same piece when a vertex of one is within the snap distance of a vertex of the other. A dead end is a line that stops. It is not a separate piece. The list stays in the panel. This does not draw a layer and does not change the source.', steps: ['Turn a line layer on.', 'Tools → <b>Network Connectivity</b>. The map stays visible.', 'Set the snap distance in metres and run.'], needs: 'A line layer on.', tip: 'One connected tree has dead ends and is still one piece.' },
  multipath: { about: 'Orders up to 12 stops by nearest neighbour along the lines, starting at the first stop, and draws that route. It does not return to the start and is not a proven shortest tour. A stop farther from a line than the snap distance is left out. A gap is not crossed with a straight line. The source layers are not changed.', steps: ['Turn on a line layer and a point layer.', 'Tools → <b>Multi-Stop Route</b>. The map stays visible.', 'Set how near a stop must be to a line, and run.'], needs: 'A line layer and a point layer on.', tip: 'Select the stops you want when the layer has more than 12.' },
  distancematrix: { about: 'Lists the straight-line distance between each pair of points, in kilometres on the ground. This is not the distance along a road. The first 40 points are measured, and a selection narrows that. The list stays in the panel. This does not draw a layer and does not change the source.', steps: ['Turn a point layer on.', 'Tools → <b>Distance Matrix</b>. The map stays visible.', 'Run. Read the pairs.'], needs: 'A point layer on.', tip: 'A road between the points is not used. The number is the straight line.' },
  linemerge: { about: 'Draws a copy with lines joined where exactly two ends meet, within the snap distance in metres. A junction of three or more lines stays a junction. A line is reversed when that is what makes the ends meet. The source layer is not changed.', steps: ['Turn a line layer on.', 'Tools → <b>Merge Connected Lines</b>. The map stays visible.', 'Set the snap distance in metres and run.'], needs: 'A line layer on.', tip: 'Three lines meeting at one point are not merged into one.' },
  linebearing: { about: 'Reports the compass bearing of each segment, from north and clockwise, using longitude and latitude. A long segment counts more than a short one. North is increasing latitude, not the map’s internal up. The numbers stay in the panel. This does not draw a layer and does not change the source.', steps: ['Turn a line layer on.', 'Tools → <b>Line Bearing Statistics</b>. The map stays visible.', 'Run. Read the directions.'], needs: 'A line layer on.', tip: 'An eastward line is east. The map’s internal y growing downward is not used.' },
  networkbetweenness: { about: 'Ranks junctions by how many shortest paths along the lines pass through them. A junction is named by the lines that meet there. A dead end ranks below a junction that joins two parts of the network. This is not a count of lines touching the junction. On a network of more than 1,200 junctions the rank uses 200 starts and says so. The list stays in the panel. This does not draw a layer and does not change the source.', steps: ['Turn a line layer on.', 'Tools → <b>Network Betweenness</b>. The map stays visible.', 'Set the snap distance in metres and run.'], needs: 'A line layer on.', tip: 'A junction with many lines touching it is not automatically the highest rank.' },
  fishnet: { about: 'Draws a rectangular grid over the current view, or over the focus area if one is set. Each cell is the size you set, in kilometres on the ground, measured at the centre of that area. The grid starts at the south-west corner. A cell may extend past the edge so the area is covered. If that size would make more than 2,500 cells, nothing is drawn. This does not edit a layer.', steps: ['Tools → <b>Fishnet / Grid</b>. The map stays visible.', 'Set the cell size in kilometres and run.'], tip: 'On the opening view a 5 km cell is too small. Zoom in, or use a larger cell.' },
  randompts: { about: 'Places random points inside the current view, or inside the focus area if one is set. The points are spread across that area on the map. A focus area that is not a rectangle only keeps points that fall inside it. At most 5,000 are placed. This does not edit a layer.', steps: ['Tools → <b>Random Points</b>. The map stays visible.', 'Set how many and run.'], tip: 'The points fill the area you are looking at, not a fixed box around the centre.' },
  hexbin: { about: 'Draws a hexagon for each group of points and writes how many fell in it. The width is the distance across the hexagon, flat side to flat side, in kilometres on the ground. A point is counted in the hexagon whose centre is nearest. This is not a square grid. A hexagon with no points is not drawn. The source points are not changed. More than 4,000 hexagons keeps the fullest and says so.', steps: ['Turn a point layer on.', 'Tools → <b>Hexagonal Binning</b>. The map stays visible.', 'Set the width in kilometres and run.'], needs: 'A point layer on.', tip: 'The count is an attribute of the drawn hexagon, not a number written back onto the points.' },
  gridpoints: { about: 'Places points on a regular grid over the current view, or the focus area if one is set. The spacing is kilometres on the ground, measured at the centre. The grid starts at the south-west corner. If that spacing would make more than 2,500 points, nothing is drawn. This does not edit a layer.', steps: ['Tools → <b>Regular Point Grid</b>. The map stays visible.', 'Set the spacing in kilometres and run.'], tip: 'The distance between neighbours is the spacing you set, not a step in map units.' },
  randomlines: { about: 'Draws random lines inside the current view, or the focus area if one is set, for illustration. Each step is about the length you set, in kilometres on the ground. The lines are not a survey and they do not follow a road. At most 500 are drawn. This does not edit a layer.', steps: ['Tools → <b>Random Lines</b>. The map stays visible.', 'Set the count, the vertices and the step in kilometres, then run.'], tip: 'A short step on a wide view makes a short line. That length is still kilometres on the ground.' },
  randompolygons: { about: 'Draws random polygons inside the current view, or centred in the focus area if one is set, for illustration. Each polygon is a simple shape about the width you set, in kilometres on the ground. Vertices go in order around the centre, so the shape does not cross itself. It is not a survey boundary. At most 500 are drawn. This does not edit a layer.', steps: ['Tools → <b>Random Polygons</b>. The map stays visible.', 'Set the count, the vertices and the width in kilometres, then run.'], tip: 'If the width is larger than the view, it is reduced so the shape fits, and the panel says so.' },
  randomsample: { about: 'Draws a random subset of the features that are on, as a new layer. A selection, or a focus area, narrows the features it can pick. The copy does not share its shape with the source. The source is not hidden and is not changed. More than 2,000 features keeps 2,000 and says so. A later run can pick a different subset.', steps: ['Turn a point, line or polygon layer on.', 'Tools → <b>Random Sample</b>. The map stays visible.', 'Set how many and run.'], needs: 'A point, line or polygon layer on.', tip: 'The source layer stays as it was. Nothing is hidden.' },
  randomraster: { about: 'Draws a new raster surface over the current view, or the focus area if one is set. Each cell is a random number between the minimum and the maximum. Neighbouring cells are not related. This is not a measurement of the ground, and it is not added to the catalog. The surface can be cleared.', steps: ['Tools → <b>Random Raster</b>. The map stays visible.', 'Set the columns, rows and the value range, then run.'], tip: 'The cell count is the columns times the rows. It is not a kilometre size.' },
  jenksbreaks: { about: 'Classifies a numeric field with Jenks natural breaks — classes that follow the gaps in the numbers, not equal counts or equal widths. The table stays in the panel. The layer is coloured with Cividis. The source file is not edited.', steps: ['Tools → <b>Natural Breaks (Jenks)</b>, choose the layer, field and classes.', 'Press <b>Classify</b>. The ranges stay open. Restore brings the layer’s own colours back.'], tip: 'Fewer distinct values than the class count you asked for is not padded with empty classes. A hidden feature is not counted.' },
  quantileclass: { about: 'Classifies a numeric field into equal-count classes. Identical values stay in one class, so a repeated value can make the counts uneven. The table stays in the panel and the layer is coloured. The source file is not edited.', steps: ['Tools → <b>Quantile Classification</b>, choose the layer, field and classes.', 'Press <b>Classify</b>. The ranges stay open. Restore brings the layer’s own colours back.'], tip: 'Fewer distinct values than the class count you asked for is not padded with empty classes. A hidden feature is not counted.' },
  equalintervalclass: { about: 'Classifies a numeric field into equal-width classes, from the lowest value to the highest. A step with no features is still listed. The table stays in the panel and the layer is coloured. The source file is not edited.', steps: ['Tools → <b>Equal Interval Classification</b>, choose the layer, field and classes.', 'Press <b>Classify</b>. The ranges stay open. Restore brings the layer’s own colours back.'], tip: 'Fewer distinct values than the class count you asked for is not padded with empty classes. A hidden feature is not counted.' },
  symbology: { about: 'Author mode: fill, stroke, size, shape and labels for one layer.', steps: ['Open the site with ?author=1, then Tools → <b>Symbology</b>.'] },
  addlabel: { about: 'Author mode: place free text anywhere on the map.', steps: ['Author mode → Tools → <b>Add a label</b>, then type in the label editor.'] },
  savelabels: { about: 'Author mode: manage the labels you placed.', steps: ['Author mode → Tools → <b>Label list</b>.'] },
  import: { about: 'Author mode: brings your own GeoJSON onto the map.', steps: ['Author mode → Tools → <b>Import GeoJSON</b>, choose a file or paste the text.'] },
  gpkg: {
    about: 'Reads a GeoPackage in this browser and lists its layers under Imported. The file is not sent anywhere. A layer stays off until you turn it on, and can then be used with the published layers.',
    steps: [
      'Open <b>Layers</b>. <b>Import</b> is in the same row as Show all, Hide all and Basemap. It does not sit over those controls.',
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
