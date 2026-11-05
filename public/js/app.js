import { GeoMap, BASEMAPS, convertFeature, mercX, mercY, unX, unY } from './engine.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NIGERIA = [2.6, 4.2, 14.7, 13.95];

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
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
  zoom: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/>',
  down: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  point: '<circle cx="12" cy="12" r="4.5" fill="currentColor"/>', line: '<path d="M4 18 10 8l5 6 5-9"/>',
  polygon: '<path d="M5 6l10-2 5 8-6 8-9-4z"/>', raster: '<rect x="4" y="4" width="16" height="16"/><path d="M4 12h16M12 4v16"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m21 16-5-5-8 8"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;
const KIND_LABEL = { point: 'Points', line: 'Lines', polygon: 'Polygons', raster: 'Raster', image: 'Picture', table: 'Table' };

// ---------------------------------------------------------------- state
const map = new GeoMap($('#map'));
let catalog = null;
const L = new Map();            // id -> { meta, on, opacity, loading, obj }
const cache = { tables: new Map() };
let activeTab = 'layers', measure = null, userLoc = null;

function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms); }

// ---------------------------------------------------------------- start
async function start() {
  for (const el of $$('[data-i]')) el.insertAdjacentHTML('afterbegin', icon(el.dataset.i));
  try {
    catalog = await (await fetch('catalog.json', { cache: 'no-cache' })).json();
  } catch (e) {
    $('#layerlist').innerHTML = '<p class="empty">Could not load catalog.json. Run the build (scripts/build_site.py) and deploy the public folder.</p>';
    openSheet('layers'); return;
  }
  document.title = catalog.title; $('#title').textContent = catalog.title;
  catalog.layers.forEach((m, i) => L.set(m.id, { meta: m, on: false, opacity: m.opacity ?? (m.kind === 'polygon' ? 0.85 : 1), loading: false, obj: null, order: i }));
  buildBasemaps(); buildLayerList(); buildAbout();
  const h = parseHash();
  map.setBasemap(h.b && BASEMAPS[h.b] ? h.b : (catalog.basemap in BASEMAPS ? catalog.basemap : 'light')); syncBasemapUI();
  if (h.c) map.setView(h.c[1], h.c[0], h.c[2]); else home(false);
  let initial = h.l ? h.l.filter((id) => L.has(id)) : catalog.layers.filter((m) => m.visible).map((m) => m.id);
  if (!h.l && !initial.length) { const p = catalog.layers.find((m) => m.kind === 'polygon') || catalog.layers.find((m) => m.kind !== 'table'); if (p) initial = [p.id]; }
  for (const id of initial) setLayer(id, true);
  map.on('view', onView); map.on('click', onClick); map.on('hover', (x, y) => { const [lo, la] = map.lonlatAt(x, y); $('#coords').textContent = fmtLL(la, lo); });
  onView(); updateAttrib();
  if (matchMedia('(min-width:900px)').matches) openSheet('layers');
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
}
const fmtLL = (la, lo) => `${Math.abs(la).toFixed(4)}°${la >= 0 ? 'N' : 'S'}  ${Math.abs(lo).toFixed(4)}°${lo >= 0 ? 'E' : 'W'}`;

function home(animate = true) {
  const side = matchMedia('(min-width:900px)').matches ? 400 : 0;
  map.fitBounds(NIGERIA, 22);
  if (side) { map.cx -= (side / 2) / map.S; map._viewChanged(); }
}

// ---------------------------------------------------------------- layer loading
const palette = '#7a7a7a';
function styleColor(style, props) {
  if (!style) return palette;
  if (style.mode === 'color-field') { const v = props[style.field]; return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : style.color; }
  if (style.mode === 'category') return style.colors[props[style.field]] || '#9aa0a6';
  return style.color || palette;
}
async function loadLayer(st) {
  const m = st.meta;
  if (st.obj) return st.obj;
  if (m.kind === 'polygon' || m.kind === 'line' || m.kind === 'point') {
    const gj = await (await fetch(m.file)).json();
    const feats = [];
    for (const f of gj.features) { const c = convertFeature(f); if (!c) continue; const col = styleColor(m.style, c.props); c.fill = col; c.stroke = col; feats.push(c); }
    st.obj = { id: m.id, kind: m.kind, visible: false, opacity: st.opacity, order: st.order, features: feats, style: m.style, labelField: m.labelField, width: m.kind === 'line' ? (m.count > 8000 ? 0.9 : 1.4) : undefined, labelZoom: feats.length > 3000 ? 10 : 8 };
  } else if (m.kind === 'raster' || m.kind === 'image') {
    const img = new Image(); img.decoding = 'async'; img.src = m.image;
    await img.decode().catch(() => new Promise((res, rej) => { img.onload = res; img.onerror = rej; }));
    const [w, s, e, n] = m.bounds;
    st.obj = { id: m.id, kind: m.kind, visible: false, opacity: st.opacity, order: st.order, img, wb: [mercX(w), mercY(n), mercX(e), mercY(s)], categorical: !!m.categorical, nodata: m.nodata, vals: null };
    if (m.kind === 'raster' && m.values) loadValues(st).catch(() => {});
  }
  map.addLayer(st.obj); return st.obj;
}
async function loadValues(st) {
  const v = st.meta.values; if (!v || typeof DecompressionStream === 'undefined') return;
  const res = await fetch(v.file); const ds = res.body.pipeThrough(new DecompressionStream('gzip'));
  const buf = await new Response(ds).arrayBuffer();
  st.obj.vals = { w: v.w, h: v.h, dtype: v.dtype, data: v.dtype === 'i2' ? new Int16Array(buf) : new Float32Array(buf) };
}
async function setLayer(id, on) {
  const st = L.get(id); if (!st || st.meta.kind === 'table') return;
  const sw = $(`.lrow[data-id="${CSS.escape(id)}"] .sw`);
  if (on) {
    st.on = true; sw?.classList.add('on');
    if (!st.obj) {
      st.loading = true; sw?.classList.add('loading');
      try { await loadLayer(st); } catch (e) { console.error(e); toast('Could not load ' + st.meta.label); st.on = false; sw?.classList.remove('on'); st.loading = false; sw?.classList.remove('loading'); return; }
      st.loading = false; sw?.classList.remove('loading');
    }
    if (!st.on) return; st.obj.visible = true; st.obj.opacity = st.opacity; map.render();
  } else { st.on = false; sw?.classList.remove('on'); if (st.obj) st.obj.visible = false; map.render(); }
  refreshLegend(); pushHash();
}

// ---------------------------------------------------------------- layer list
function buildLayerList() {
  const root = $('#layerlist'); root.innerHTML = '';
  for (const g of catalog.groups) {
    const items = catalog.layers.filter((m) => m.group === g.id); if (!items.length) continue;
    const grp = document.createElement('div'); grp.className = 'group'; grp.dataset.group = g.id;
    grp.innerHTML = `<button class="ghead">${icon('chev')}<span>${esc(g.label)}</span><span class="n">${items.length}</span></button><div class="lrows"></div>`;
    $('.ghead', grp).onclick = () => grp.classList.toggle('collapsed');
    const rows = $('.lrows', grp);
    for (const m of items) rows.appendChild(layerRow(m));
    root.appendChild(grp);
  }
  $('#layerfilter').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    for (const row of $$('.lrow')) row.hidden = q && !(row.dataset.search.includes(q));
    for (const g of $$('.group')) g.hidden = !$$('.lrow:not([hidden])', g).length; 
  });
}
function layerRow(m) {
  const st = L.get(m.id), row = document.createElement('div'); row.className = 'lrow'; row.dataset.id = m.id;
  row.dataset.search = (m.label + ' ' + m.group + ' ' + m.table + ' ' + (m.description || '')).toLowerCase();
  const count = m.count != null ? `${m.count.toLocaleString()} ${m.kind === 'table' ? 'rows' : m.kind === 'point' ? 'points' : 'features'}` : '';
  const sub = [KIND_LABEL[m.kind], count].filter(Boolean).join(' · ');
  const isTable = m.kind === 'table';
  row.innerHTML = `<div class="lmain"><span class="kind">${icon(m.kind)}</span><button class="lt"><b>${esc(m.label)}</b><small>${esc(sub)}</small></button>${isTable ? '<button class="chip open">Open</button>' : '<button class="sw" role="switch" aria-label="Show layer"></button>'}</div>
  <div class="lopts">${m.description ? `<p>${esc(m.description.length > 260 ? m.description.slice(0, 257) + '…' : m.description)}</p>` : ''}
   ${isTable ? '' : `<label>Opacity <input type="range" min="0" max="100" value="${Math.round(st.opacity * 100)}"></label>`}
   <span class="chip act-zoom">${icon('zoom')}Zoom to</span>
   ${m.kind === 'polygon' || m.kind === 'line' || m.kind === 'point' || isTable ? `<span class="chip act-table">${icon('table')}Table</span>` : ''}
   ${m.file && m.kind !== 'table' ? `<a class="chip" href="${esc(m.file)}" download>${icon('down')}GeoJSON</a>` : ''}</div>`;
  $('.lt', row).onclick = () => { if (isTable) openTable(m.id); else row.classList.toggle('open'); };
  if (isTable) $('.open', row).onclick = () => openTable(m.id);
  else $('.sw', row).onclick = () => setLayer(m.id, !L.get(m.id).on);
  const rg = $('input[type=range]', row);
  if (rg) rg.oninput = () => { st.opacity = rg.value / 100; if (st.obj) { st.obj.opacity = st.opacity; map.render(); } };
  $('.act-zoom', row).onclick = () => zoomToLayer(m);
  const tb = $('.act-table', row); if (tb) tb.onclick = () => openTable(m.id);
  return row;
}
function zoomToLayer(m) {
  const b = m.bounds; if (!b) { toast('No extent for this layer'); return; }
  if (!L.get(m.id).on && m.kind !== 'table') setLayer(m.id, true);
  const mobile = !matchMedia('(min-width:900px)').matches, sheetOpen = !$('#sheet').classList.contains('closed');
  map.fitBounds(b, 30, mobile && sheetOpen ? innerHeight * 0.4 : 0);
  if (!mobile) { map.cx -= 200 / map.S; map._viewChanged(); }
}

// ---------------------------------------------------------------- legend
async function getTable(id) {
  if (cache.tables.has(id)) return cache.tables.get(id);
  const m = L.get(id)?.meta; if (!m) return null;
  const p = fetch(m.file).then((r) => r.json()); cache.tables.set(id, p); return p;
}
async function classNames(m) {
  if (!m.legendTable) return {};
  const t = await getTable(m.legendTable); if (!t) return {};
  const ki = t.columns.indexOf(m.legendKey), li = t.columns.indexOf(m.legendLabel); const out = {};
  for (const r of t.rows) out[r[ki]] = li >= 0 ? r[li] : String(r[ki]); return out;
}
async function refreshLegend() {
  const box = $('#legend'); const active = [...L.values()].filter((s) => s.on && s.meta.kind !== 'table').sort((a, b) => b.order - a.order);
  if (!active.length) { box.innerHTML = '<p class="empty">Turn on a layer to see its legend.</p>'; return; }
  const parts = [];
  for (const st of active) {
    const m = st.meta; let html = `<div class="lg"><h4>${esc(m.label)}</h4>`;
    const row = (c, t, cls = '') => `<div class="lgrow"><span class="lgsw ${cls}" style="background:${esc(c)}"></span><span>${esc(t)}</span></div>`;
    const sw = m.kind === 'line' ? 'line' : m.kind === 'point' ? 'dot' : '';
    if (m.kind === 'image') html += '<div class="muted">Scanned map picture (no classes)</div>';
    else if (m.kind === 'raster') {
      if (m.categorical) { const names = await classNames(m); const cl = m.classes || []; html += cl.slice(0, 80).map((c) => row(c.color, names[c.value] ?? 'Class ' + c.value)).join(''); }
      else { const [a, b] = m.stretch || [m.min, m.max]; html += `<div class="bar" style="background:linear-gradient(90deg,${m.ramp.join(',')})"></div><div class="barlab"><span>${fmtNum(a)}</span><span>${esc(m.uom || '')}</span><span>${fmtNum(b)}</span></div>`; }
    } else {
      const s = m.style || {};
      if (s.mode === 'category') { const e = Object.entries(s.colors); html += e.slice(0, 80).map(([k, c]) => row(c, k, sw)).join('') + (e.length > 80 ? `<div class="muted">…and ${e.length - 80} more</div>` : ''); }
      else if (s.mode === 'color-field') { const e = s.legend || []; html += e.slice(0, 80).map(([k, c]) => row(c, k, sw)).join('') + (e.length > 80 ? `<div class="muted">…and ${e.length - 80} more</div>` : ''); }
      else html += row(s.color || palette, m.label, sw);
    }
    parts.push(html + '</div>');
  }
  box.innerHTML = parts.join('');
}
const fmtNum = (v) => (v == null || isNaN(v)) ? '' : Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : (+v.toFixed(2)).toString();

// ---------------------------------------------------------------- identify / info
function propTable(m, props) {
  const labels = Object.fromEntries((m.fields || []).map((f) => [f.name, f.label]));
  const ent = Object.entries(props).filter(([, v]) => v !== null && v !== '');
  if (!ent.length) return '<div class="rastv muted">No attributes</div>';
  return '<div class="kv">' + ent.map(([k, v]) => `<div>${esc(labels[k] || k)}</div><div>${esc(typeof v === 'number' ? fmtNum(v) : v)}</div>`).join('') + '</div>';
}
async function showResults(res, lonlat) {
  const box = $('#info'); const parts = [];
  if (lonlat) parts.push(`<div class="muted" style="margin:4px 0 6px">${esc(fmtLL(lonlat[1], lonlat[0]))}</div>`);
  for (const r of res.slice(0, 30)) {
    const m = r.layer && L.get(r.layer.id).meta;
    if (r.value !== undefined) {
      let txt;
      if (m.categorical) { const names = await classNames(m); txt = `${names[r.value] ?? 'Class ' + r.value} <small class="muted">(code ${r.value})</small>`; }
      else txt = `${fmtNum(r.value)} ${esc(m.uom || '')}`;
      parts.push(`<div class="card"><header>${icon('raster')}${esc(m.label)}</header><div class="rastv">${txt}</div></div>`);
    } else parts.push(`<div class="card"><header>${icon(m.kind)}${esc(m.label)}<small>${esc(KIND_LABEL[m.kind])}</small></header>${propTable(m, r.feature.props)}</div>`);
  }
  box.innerHTML = parts.join('') || '<p class="empty">Tap the map to see what is there.</p>';
}
function onClick(x, y) {
  const [lo, la] = map.lonlatAt(x, y);
  if (measure) { measure.pts.push([lo, la]); updateMeasure(); return; }
  if (![...L.values()].some((s) => s.on && s.meta.kind !== 'table')) { toast('Turn a layer on, then tap the map'); return; }
  const res = map.identify(x, y);
  const feat = res.find((r) => r.feature);
  map.selection = feat ? { feature: feat.feature, layer: feat.layer } : null; map.render();
  if (!res.length) { toast('Nothing found at this spot'); $('#info').innerHTML = '<p class="empty">Nothing found there. Try another spot.</p>'; return; }
  showResults(res, [lo, la]); openSheet('info', true);
}

// ---------------------------------------------------------------- bottom sheet
const sheet = $('#sheet'), mobileQ = matchMedia('(max-width:899px)');
const TITLES = { layers: 'Layers', legend: 'Legend', info: 'Info', tools: 'Tools' };
function openSheet(tab, keep) {
  if (tab === activeTab && !sheet.classList.contains('closed') && !keep && mobileQ.matches === false) { closeSheet(); return; }
  activeTab = tab;
  for (const p of $$('.panel')) p.classList.toggle('active', p.id === 'panel-' + tab);
  for (const b of $$('.tab')) b.classList.toggle('active', b.dataset.tab === tab);
  $('#sheettitle').textContent = TITLES[tab];
  if (sheet.classList.contains('closed')) { sheet.style.removeProperty('--sheet-h'); sheet.classList.remove('closed'); }
  document.body.classList.add('side-open'); if (tab === 'legend') refreshLegend();
}
function closeSheet() { sheet.classList.add('closed'); document.body.classList.remove('side-open'); for (const b of $$('.tab')) b.classList.remove('active'); }
for (const b of $$('.tab')) b.onclick = () => { if (b.dataset.tab === activeTab && !sheet.classList.contains('closed')) closeSheet(); else openSheet(b.dataset.tab, true); };
$('#sheetclose').onclick = closeSheet;
(function drag() {
  let y0, h0, dragging = false;
  const start = (e) => { if (!mobileQ.matches) return; dragging = true; y0 = e.clientY; h0 = sheet.getBoundingClientRect().height; sheet.classList.add('dragging'); e.target.setPointerCapture?.(e.pointerId); };
  const move = (e) => { if (!dragging) return; const h = Math.max(60, Math.min(innerHeight * 0.9, h0 + (y0 - e.clientY))); sheet.style.setProperty('--sheet-h', h + 'px'); };
  const end = (e) => {
    if (!dragging) return; dragging = false; sheet.classList.remove('dragging'); const h = sheet.getBoundingClientRect().height, f = h / innerHeight;
    if (f < 0.2) { closeSheet(); sheet.style.removeProperty('--sheet-h'); } else sheet.style.setProperty('--sheet-h', (f > 0.66 ? 0.86 : 0.46) * innerHeight + 'px');
  };
  for (const el of [$('#grab'), $('#sheethead')]) { el.style.touchAction = 'none'; el.addEventListener('pointerdown', start); el.addEventListener('pointermove', move); el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); }
})();

// ---------------------------------------------------------------- tools
function buildBasemaps() {
  const box = $('#basemaps'); box.innerHTML = '';
  for (const [k, v] of Object.entries(BASEMAPS)) { const b = document.createElement('button'); b.textContent = v.label; b.dataset.k = k; b.onclick = () => { map.setBasemap(k); syncBasemapUI(); updateAttrib(); pushHash(); }; box.appendChild(b); }
}
function syncBasemapUI() { for (const b of $$('#basemaps button')) b.classList.toggle('on', b.dataset.k === map.basemap); }
function updateAttrib() { $('#attrib').textContent = BASEMAPS[map.basemap]?.attr || ''; }
function buildAbout() { $('#about').innerHTML = `<p>${catalog.layers.length} layers in ${catalog.groups.length} groups.<br>Data built from GeoPackages: ${esc(catalog.built)}.</p><p>Layers, fields and legends are read from the data folder automatically, so changing a GeoPackage and pushing to GitHub updates this app.</p>`; }
$('#tool-reset').onclick = () => home();
$('#tool-clear').onclick = () => { map.selection = null; map.render(); $('#info').innerHTML = '<p class="empty">Tap the map to see what is there.</p>'; toast('Selection cleared'); };
$('#tool-all-off').onclick = () => { for (const id of L.keys()) if (L.get(id).on) setLayer(id, false); };
$('#zin').onclick = () => map.zoomAt(map.W / 2, map.H / 2, 1); $('#zout').onclick = () => map.zoomAt(map.W / 2, map.H / 2, -1);
$('#btn-home').onclick = () => home();
$('#btn-share').onclick = async () => { pushHash(true); const url = location.href; try { if (navigator.share) await navigator.share({ title: catalog.title, url }); else { await navigator.clipboard.writeText(url); toast('Link copied'); } } catch { try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { toast(url, 6000); } } };
$('#btn-locate').onclick = () => {
  if (!navigator.geolocation) { toast('Location is not available on this device'); return; }
  toast('Finding your location…');
  navigator.geolocation.getCurrentPosition((p) => {
    userLoc = [p.coords.longitude, p.coords.latitude, p.coords.accuracy]; map.setView(userLoc[0], userLoc[1], Math.max(map.zoom, 11)); toast('Location found');
  }, () => toast('Could not get your location'), { enableHighAccuracy: true, timeout: 12000 });
};
map.extra.push((ctx, m) => {
  if (userLoc) { const [x, y] = m.screenOf(userLoc[0], userLoc[1]); const r = userLoc[2] / (156543.03 * Math.cos(userLoc[1] * Math.PI / 180) / Math.pow(2, m.zoom)); ctx.fillStyle = 'rgba(30,120,255,.15)'; ctx.beginPath(); ctx.arc(x, y, Math.max(6, r), 0, 6.3); ctx.fill(); ctx.fillStyle = '#1e78ff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 7, 0, 6.3); ctx.fill(); ctx.stroke(); }
  if (measure && measure.pts.length) {
    ctx.strokeStyle = '#ff3b6b'; ctx.fillStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath();
    measure.pts.forEach((p, i) => { const [x, y] = m.screenOf(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    for (const p of measure.pts) { const [x, y] = m.screenOf(p[0], p[1]); ctx.beginPath(); ctx.arc(x, y, 5, 0, 6.3); ctx.fill(); ctx.stroke(); }
  }
});
function hav(a, b) { const R = 6371.0088, r = Math.PI / 180, dLa = (b[1] - a[1]) * r, dLo = (b[0] - a[0]) * r; const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
function updateMeasure() { let d = 0; for (let i = 1; i < measure.pts.length; i++) d += hav(measure.pts[i - 1], measure.pts[i]); $('#measuretext').textContent = measure.pts.length < 2 ? 'Tap the map to add points' : `${d.toFixed(d < 10 ? 2 : 1)} km`; map.render(); }
$('#tool-measure').onclick = () => { measure = { pts: [] }; $('#measurebar').hidden = false; $('#tool-measure').classList.add('on'); updateMeasure(); if (mobileQ.matches) closeSheet(); };
$('#measureclear').onclick = () => { if (measure) { measure.pts = []; updateMeasure(); } };
$('#measuredone').onclick = () => { measure = null; $('#measurebar').hidden = true; $('#tool-measure').classList.remove('on'); map.render(); };

// ---------------------------------------------------------------- search
const searchEl = $('#search'), sInput = $('#search-input'), sRes = $('#search-results');
$('#btn-search').onclick = () => { searchEl.hidden = false; sInput.value = ''; sRes.innerHTML = '<p class="empty">Type a place, rock unit, mineral or layer name.<br>Features are searched in the layers that are turned on.</p>'; sInput.focus(); };
$('#search-close').onclick = () => { searchEl.hidden = true; };
let sTimer; sInput.addEventListener('input', () => { clearTimeout(sTimer); sTimer = setTimeout(runSearch, 160); });
function titleOf(l, f) { const key = l.labelField; if (key && f.props[key] != null) return String(f.props[key]); for (const v of Object.values(f.props)) if (typeof v === 'string') return v; return 'Feature'; }
function runSearch() {
  const q = sInput.value.trim().toLowerCase(); if (q.length < 2) { sRes.innerHTML = ''; return; }
  const out = [];
  for (const s of L.values()) if (s.meta.label.toLowerCase().includes(q) || s.meta.table.includes(q)) out.push(`<button class="sres" data-layer="${esc(s.meta.id)}">${icon(s.meta.kind)}<span><b>${esc(s.meta.label)}</b><small>Layer · ${esc(KIND_LABEL[s.meta.kind])}</small></span></button>`);
  let n = 0;
  for (const st of L.values()) { const l = st.obj; if (!l || !l.features || !st.on) continue;
    for (let i = 0; i < l.features.length && n < 60; i++) { const f = l.features[i];
      for (const v of Object.values(f.props)) if (typeof v === 'string' && v.toLowerCase().includes(q)) { out.push(`<button class="sres" data-layer="${esc(l.id)}" data-i="${i}">${icon(st.meta.kind)}<span><b>${esc(titleOf(l, f))}</b><small>${esc(st.meta.label)}</small></span></button>`); n++; break; } } }
  sRes.innerHTML = out.join('') || '<p class="empty">No results. Turn on the layer you want to search.</p>';
}
sRes.addEventListener('click', (e) => {
  const b = e.target.closest('.sres'); if (!b) return; const id = b.dataset.layer, st = L.get(id); searchEl.hidden = true;
  if (b.dataset.i === undefined) { if (st.meta.kind === 'table') openTable(id); else { setLayer(id, true); zoomToLayer(st.meta); openSheet('layers', true); } return; }
  const f = st.obj.features[+b.dataset.i]; const [x0, y0, x1, y1] = f.bb;
  map.selection = { feature: f, layer: st.obj };
  if (x1 - x0 < 1e-6) map.setView(unX(x0), unY(y0), Math.max(map.zoom, 11)); else map.fitBounds([unX(x0), unY(y1), unX(x1), unY(y0)], 50, mobileQ.matches ? innerHeight * 0.4 : 0);
  showResults([{ layer: st.obj, feature: f }]); openSheet('info', true);
});

// ---------------------------------------------------------------- table modal
async function openTable(id) {
  const st = L.get(id), m = st.meta; let cols, rows;
  $('#tm-title').textContent = m.label; $('#tm-body').innerHTML = '<p class="empty">Loading…</p>'; $('#tablemodal').hidden = false; $('#tm-filter').value = '';
  try {
    if (m.kind === 'table') { const t = await getTable(id); cols = t.columns; rows = t.rows; }
    else { if (!st.obj) await loadLayer(st); cols = (m.fields || []).map((f) => f.name); rows = st.obj.features.map((f) => cols.map((c) => f.props[c] ?? '')); }
  } catch (e) { $('#tm-body').innerHTML = '<p class="empty">Could not load this table.</p>'; return; }
  const labels = Object.fromEntries((m.fields || []).map((f) => [f.name, f.label]));
  let shown = 300, q = '';
  const draw = () => {
    const filt = q ? rows.filter((r) => r.some((v) => String(v).toLowerCase().includes(q))) : rows;
    $('#tm-body').innerHTML = `<table><thead><tr>${cols.map((c) => `<th>${esc(labels[c] || c)}</th>`).join('')}</tr></thead><tbody>${filt.slice(0, shown).map((r) => `<tr>${r.map((v) => `<td title="${esc(v)}">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>` +
      `<div class="muted" style="padding:8px 12px">${filt.length.toLocaleString()} rows${filt.length > shown ? ` (showing ${shown})` : ''}</div>` + (filt.length > shown ? '<button class="more">Show more</button>' : '');
    const mb = $('.more', $('#tm-body')); if (mb) mb.onclick = () => { shown += 400; draw(); };
  };
  $('#tm-filter').oninput = (e) => { q = e.target.value.trim().toLowerCase(); shown = 300; draw(); };
  draw();
}
$('#tm-close').onclick = () => { $('#tablemodal').hidden = true; };

// ---------------------------------------------------------------- view, hash, scale
let hashT;
function onView() {
  const [lo, la] = map.center(); $('#coords').textContent = fmtLL(la, lo); drawScale(la);
  clearTimeout(hashT); hashT = setTimeout(pushHash, 500);
}
function drawScale(lat) {
  const mpp = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, map.zoom); let m = mpp * 90; const p = Math.pow(10, Math.floor(Math.log10(m))); const f = m / p; m = (f >= 5 ? 5 : f >= 2 ? 2 : 1) * p;
  $('#scalebar i').style.width = m / mpp + 'px'; $('#scalebar b').textContent = m >= 1000 ? m / 1000 + ' km' : m + ' m';
}
function parseHash() {
  const o = {}; try { const h = new URLSearchParams(location.hash.slice(1)); const c = h.get('c'); if (c) { const [a, b, z] = c.split(',').map(Number); if ([a, b, z].every(isFinite)) o.c = [a, b, z]; } if (h.get('l') != null) o.l = h.get('l').split(',').filter(Boolean); o.b = h.get('b'); } catch {} return o;
}
function pushHash() {
  if (!catalog) return; const [lo, la] = map.center(); const on = [...L.values()].filter((s) => s.on).map((s) => s.meta.id);
  const h = `c=${la.toFixed(4)},${lo.toFixed(4)},${map.zoom.toFixed(2)}&l=${on.join(',')}&b=${map.basemap}`; try { history.replaceState(null, '', '#' + h); } catch {}
}
start();
