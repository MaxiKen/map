// Coordinate systems a Nigerian GeoPackage is likely to use, converted to the
// longitude and latitude (WGS 84) this map draws. No network and no server:
// the file's own code or definition is read, then these formulas are applied.
//
// Minna uses the national three-parameter shift EPSG:1168 (−92, −93, +122 m).
// That shift is only good to about 15 metres across Nigeria. It is the figure
// to show the user, not a survey residual at one station.

const WGS84 = { a: 6378137, f: 1 / 298.257223563 };
const CLARKE = { a: 6378249.145, f: 1 / 293.465 };
const MINNA_SHIFT = { dx: -92, dy: -93, dz: 122 };
const MINNA_ACCURACY_M = 15;

const DEG = Math.PI / 180;

function utmZone(zone, south) {
  return {
    method: 'tmerc',
    lat0: 0,
    lon0: zone * 6 - 183,
    k0: 0.9996,
    x0: 500000,
    y0: south ? 10000000 : 0,
  };
}

function belt(lon0, x0) {
  return { method: 'tmerc', lat0: 4, lon0, k0: 0.99975, x0, y0: 0 };
}

// Popular systems, in the order the chooser shows them.
export const CRS_MENU = [
  { code: 4326, label: 'WGS 84 longitude / latitude (EPSG:4326)' },
  { code: 32631, label: 'WGS 84 / UTM zone 31N (EPSG:32631)' },
  { code: 32632, label: 'WGS 84 / UTM zone 32N (EPSG:32632)' },
  { code: 32633, label: 'WGS 84 / UTM zone 33N (EPSG:32633)' },
  { code: 4263, label: 'Minna longitude / latitude (EPSG:4263)' },
  { code: 26331, label: 'Minna / UTM zone 31N (EPSG:26331)' },
  { code: 26332, label: 'Minna / UTM zone 32N (EPSG:26332)' },
  { code: 26391, label: 'Minna / Nigeria West Belt (EPSG:26391)' },
  { code: 26392, label: 'Minna / Nigeria Mid Belt (EPSG:26392)' },
  { code: 26393, label: 'Minna / Nigeria East Belt (EPSG:26393)' },
  { code: 3857, label: 'Web Mercator (EPSG:3857)' },
];

const CATALOG = {
  4326: { name: 'WGS 84', method: 'longlat', ellip: WGS84, shift: null },
  4979: { name: 'WGS 84', method: 'longlat', ellip: WGS84, shift: null },
  4263: { name: 'Minna', method: 'longlat', ellip: CLARKE, shift: MINNA_SHIFT, datum: 'minna' },
  3857: { name: 'Web Mercator', method: 'merc' },
  26331: { name: 'Minna / UTM zone 31N', ellip: CLARKE, shift: MINNA_SHIFT, datum: 'minna', ...utmZone(31) },
  26332: { name: 'Minna / UTM zone 32N', ellip: CLARKE, shift: MINNA_SHIFT, datum: 'minna', ...utmZone(32) },
  26333: { name: 'Minna / UTM zone 33N', ellip: CLARKE, shift: MINNA_SHIFT, datum: 'minna', ...utmZone(33) },
  26391: { name: 'Minna / Nigeria West Belt', ellip: CLARKE, shift: MINNA_SHIFT, datum: 'minna', ...belt(4.5, 230738.26) },
  26392: { name: 'Minna / Nigeria Mid Belt', ellip: CLARKE, shift: MINNA_SHIFT, datum: 'minna', ...belt(8.5, 670553.98) },
  26393: { name: 'Minna / Nigeria East Belt', ellip: CLARKE, shift: MINNA_SHIFT, datum: 'minna', ...belt(12.5, 1110369.7) },
};

function utmEntry(code) {
  if (code >= 32601 && code <= 32660) {
    const zone = code - 32600;
    return { name: `WGS 84 / UTM zone ${zone}N`, ellip: WGS84, shift: null, ...utmZone(zone, false) };
  }
  if (code >= 32701 && code <= 32760) {
    const zone = code - 32700;
    return { name: `WGS 84 / UTM zone ${zone}S`, ellip: WGS84, shift: null, ...utmZone(zone, true) };
  }
  return null;
}

function entryForCode(code) {
  if (!Number.isFinite(code)) return null;
  return CATALOG[code] || utmEntry(code) || null;
}

export function crsByCode(code) {
  const entry = entryForCode(+code);
  if (!entry) return null;
  return finishCrs(+code, entry, { fromFile: false });
}

function finishCrs(code, entry, { fromFile, assumed, omittedShift }) {
  const minnaNumbers = entry.shift && entry.shift.dx === MINNA_SHIFT.dx && entry.shift.dy === MINNA_SHIFT.dy && entry.shift.dz === MINNA_SHIFT.dz
    && entry.ellip && Math.abs(entry.ellip.a - CLARKE.a) < 1;
  const datum = entry.datum === 'minna' || minnaNumbers ? 'minna' : (entry.datum || (entry.shift ? 'other' : 'wgs84'));
  const accuracyM = datum === 'minna' ? MINNA_ACCURACY_M : (entry.shift ? 30 : (entry.method === 'longlat' ? 0 : 1));
  const name = code ? `${entry.name} (EPSG:${code})` : entry.name;
  const crs = {
    code: code || null,
    name,
    shortName: entry.name,
    method: entry.method,
    datum,
    accuracyM,
    assumed: !!assumed,
    fromFile: !!fromFile,
    omittedShift: !!omittedShift,
    note: '',
    project(x, y) { return projectEntry(x, y, entry); },
  };
  crs.note = caveatFor(crs);
  return crs;
}

export function caveatFor(crs) {
  if (!crs) return 'This file did not name a coordinate system this map knows. Choose one before adding the layer. If the choice is wrong, the shapes will land in the wrong place.';
  const where = crs.name;
  if (crs.datum === 'minna') {
    const applied = crs.omittedShift
      ? `The file said Minna but did not include a datum shift, so the national Minna to WGS 84 shift (EPSG:1168: −92 m, −93 m, +122 m) was used. `
      : `Converted from ${where} with the national Minna to WGS 84 shift (EPSG:1168: −92 m, −93 m, +122 m). `;
    return applied + 'That shift is only good to about 15 metres across Nigeria. Fine for mapping against these layers. Not a survey fix.';
  }
  if (crs.datum === 'other') {
    return `Converted from ${where} using the datum shift written in the file. A shift like this is approximate. Treat positions as good to a few tens of metres, not as a survey fix.`;
  }
  if (crs.method === 'longlat') {
    return `Already longitude and latitude (${where}). Nothing was shifted.`;
  }
  return `Converted from ${where}. This only unfolds a grid onto longitude and latitude. It is not a datum change, so it should land within about a metre.`;
}

export function assumedCaveat(crs) {
  if (!crs) return caveatFor(null);
  return `The file did not name a coordinate system. You chose ${crs.name}. ${caveatFor({ ...crs, omittedShift: false })}`;
}

// ---- projection math -------------------------------------------------------

function geodeticToGeocentric(lon, lat, a, f) {
  const e2 = f * (2 - f);
  const s = Math.sin(lat);
  const c = Math.cos(lat);
  const N = a / Math.sqrt(1 - e2 * s * s);
  return [N * c * Math.cos(lon), N * c * Math.sin(lon), N * (1 - e2) * s];
}

function geocentricToGeodetic(X, Y, Z, a, f) {
  const b = a * (1 - f);
  const e2 = f * (2 - f);
  const ep2 = (a * a - b * b) / (b * b);
  const p = Math.hypot(X, Y);
  const theta = Math.atan2(Z * a, p * b);
  const st = Math.sin(theta);
  const ct = Math.cos(theta);
  const lat = Math.atan2(Z + ep2 * b * st * st * st, p - e2 * a * ct * ct * ct);
  const lon = Math.atan2(Y, X);
  return [lon, lat];
}

function applyShift(lonDeg, latDeg, from, shift) {
  if (!shift) return [lonDeg, latDeg];
  const [X, Y, Z] = geodeticToGeocentric(lonDeg * DEG, latDeg * DEG, from.a, from.f);
  const [lon, lat] = geocentricToGeodetic(X + shift.dx, Y + shift.dy, Z + shift.dz, WGS84.a, WGS84.f);
  return [lon / DEG, lat / DEG];
}

function meridianArc(phi, a, e2) {
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  return a * (
    (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi
    - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * phi)
    + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * phi)
    - (35 * e6 / 3072) * Math.sin(6 * phi)
  );
}

function inverseTmerc(E, N, entry) {
  const { a, f } = entry.ellip;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const k0 = entry.k0;
  const M = meridianArc(entry.lat0 * DEG, a, e2) + (N - entry.y0) / k0;
  const mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256));
  const e12 = e1 * e1;
  const e13 = e12 * e1;
  const e14 = e13 * e1;
  const phi1 = mu
    + (3 * e1 / 2 - 27 * e13 / 32) * Math.sin(2 * mu)
    + (21 * e12 / 16 - 55 * e14 / 32) * Math.sin(4 * mu)
    + (151 * e13 / 96) * Math.sin(6 * mu)
    + (1097 * e14 / 512) * Math.sin(8 * mu);
  const s1 = Math.sin(phi1);
  const c1 = Math.cos(phi1);
  const t1 = Math.tan(phi1);
  const C1 = ep2 * c1 * c1;
  const T1 = t1 * t1;
  const N1 = a / Math.sqrt(1 - e2 * s1 * s1);
  const R1 = a * (1 - e2) / Math.pow(1 - e2 * s1 * s1, 1.5);
  const D = (E - entry.x0) / (N1 * k0);
  const D2 = D * D;
  const D4 = D2 * D2;
  const D6 = D4 * D2;
  const lat = phi1 - (N1 * t1 / R1) * (
    D2 / 2
    - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D6 / 720
  );
  const lon = entry.lon0 * DEG + (
    D
    - (1 + 2 * T1 + C1) * D2 * D / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D4 * D / 120
  ) / c1;
  return applyShift(lon / DEG, lat / DEG, entry.ellip, entry.shift);
}

function inverseMerc(x, y) {
  const R = WGS84.a;
  return [x / R / DEG, (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) / DEG];
}

function projectEntry(x, y, entry) {
  if (entry.method === 'longlat') return applyShift(x, y, entry.ellip, entry.shift);
  if (entry.method === 'merc') return inverseMerc(x, y);
  return inverseTmerc(x, y, entry);
}

export function projectToLonLat(x, y, crs, latFirst) {
  if (!crs) return null;
  if (crs.method === 'longlat' && latFirst) return crs.project(y, x);
  return crs.project(x, y);
}

export function looksLikeDegrees(samples) {
  return samples.length > 0 && samples.every(([x, y]) => Math.abs(x) <= 180 && Math.abs(y) <= 90 && Number.isFinite(x) && Number.isFinite(y));
}

// Systems the coordinate tools offer. Decimal degrees on the map are always
// WGS 84. Minna is the national datum, good to about 15 metres, not a survey fix.
export const GRID_SYSTEMS = [
  { id: 'wgs-utm', label: 'WGS 84 / UTM (this point’s zone)', kind: 'auto' },
  { id: '32631', label: 'WGS 84 / UTM zone 31N', kind: 'grid' },
  { id: '32632', label: 'WGS 84 / UTM zone 32N', kind: 'grid' },
  { id: '32633', label: 'WGS 84 / UTM zone 33N', kind: 'grid' },
  { id: '4263', label: 'Minna longitude / latitude', kind: 'longlat' },
  { id: '26331', label: 'Minna / UTM zone 31N', kind: 'grid' },
  { id: '26332', label: 'Minna / UTM zone 32N', kind: 'grid' },
  { id: '26333', label: 'Minna / UTM zone 33N', kind: 'grid' },
  { id: '26391', label: 'Minna / Nigeria West Belt', kind: 'grid' },
  { id: '26392', label: 'Minna / Nigeria Mid Belt', kind: 'grid' },
  { id: '26393', label: 'Minna / Nigeria East Belt', kind: 'grid' },
];

export function validateLonLat(lon, lat) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return 'Enter a latitude and a longitude.';
  if (Math.abs(lat) > 90) return 'Latitude must be between −90 and 90.';
  if (Math.abs(lon) > 180) return 'Longitude must be between −180 and 180.';
  return '';
}

export function utmZoneOf(lon, lat) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  let zone = Math.floor((lon + 180) / 6) + 1;
  if (lon >= 180) zone = 60;
  if (lon <= -180) zone = 1;
  zone = Math.min(60, Math.max(1, zone));
  const south = lat < 0;
  return { zone, south, label: `${zone}${south ? 'S' : 'N'}` };
}

function wgsToDatum(lonDeg, latDeg, entry) {
  if (!entry?.shift) return [lonDeg, latDeg];
  const [X, Y, Z] = geodeticToGeocentric(lonDeg * DEG, latDeg * DEG, WGS84.a, WGS84.f);
  const [lon, lat] = geocentricToGeodetic(X - entry.shift.dx, Y - entry.shift.dy, Z - entry.shift.dz, entry.ellip.a, entry.ellip.f);
  return [lon / DEG, lat / DEG];
}

function forwardMerc(lonDeg, latDeg) {
  const R = WGS84.a;
  const lat = Math.max(-89.9, Math.min(89.9, latDeg)) * DEG;
  return [lonDeg * DEG * R, Math.log(Math.tan(Math.PI / 4 + lat / 2)) * R];
}

function forwardTmerc(lonDeg, latDeg, entry) {
  const { a, f } = entry.ellip;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const phi = latDeg * DEG;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = Math.tan(phi);
  const N = a / Math.sqrt(1 - e2 * sinPhi * sinPhi);
  const T = tanPhi * tanPhi;
  const C = ep2 * cosPhi * cosPhi;
  const A = (lonDeg - entry.lon0) * DEG * cosPhi;
  const M = meridianArc(phi, a, e2);
  const M0 = meridianArc((entry.lat0 || 0) * DEG, a, e2);
  const A2 = A * A;
  const A3 = A2 * A;
  const A4 = A2 * A2;
  const A5 = A4 * A;
  const A6 = A4 * A2;
  const easting = entry.x0 + entry.k0 * N * (
    A
    + (1 - T + C) * A3 / 6
    + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A5 / 120
  );
  const northing = entry.y0 + entry.k0 * (
    M - M0
    + N * tanPhi * (
      A2 / 2
      + (5 - T + 9 * C + 4 * C * C) * A4 / 24
      + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A6 / 720
    )
  );
  return [easting, northing];
}

function wgsUtmEntry(lon, lat) {
  const zone = utmZoneOf(lon, lat);
  const code = (zone.south ? 32700 : 32600) + zone.zone;
  const known = entryForCode(code);
  const entry = known || {
    name: `WGS 84 / UTM zone ${zone.label}`,
    ellip: WGS84,
    shift: null,
    datum: 'wgs84',
    ...utmZone(zone.zone, zone.south),
  };
  return { code, entry, zone };
}

function resolveSystem(systemId, lon, lat) {
  if (systemId === 'wgs-utm') {
    const picked = wgsUtmEntry(lon, lat);
    if (!picked) return null;
    return {
      kind: 'grid',
      auto: true,
      entry: picked.entry,
      caveat: '',
      meta: { id: 'wgs-utm', code: picked.code, name: picked.entry.name, zone: picked.zone.label, datum: 'wgs84' },
    };
  }
  const code = +systemId;
  const entry = entryForCode(code);
  if (!entry) return null;
  const crs = finishCrs(code, entry, { fromFile: false });
  return {
    kind: entry.method === 'longlat' ? 'longlat' : 'grid',
    auto: false,
    entry,
    caveat: crs.datum === 'minna' ? crs.note : '',
    meta: { id: String(code), code, name: crs.shortName || entry.name, datum: crs.datum },
  };
}

export function lonLatToSystem(lon, lat, systemId) {
  const err = validateLonLat(lon, lat);
  if (err) return { error: err };
  const spec = resolveSystem(systemId, lon, lat);
  if (!spec) return { error: 'Choose a coordinate system.' };
  if (spec.kind === 'longlat') {
    const [x, y] = wgsToDatum(lon, lat, spec.entry);
    return { ...spec.meta, kind: 'longlat', x, y, caveat: spec.caveat };
  }
  const [slon, slat] = wgsToDatum(lon, lat, spec.entry);
  const [easting, northing] = spec.entry.method === 'merc'
    ? forwardMerc(slon, slat)
    : forwardTmerc(slon, slat, spec.entry);
  return { ...spec.meta, kind: 'grid', easting, northing, caveat: spec.caveat, auto: spec.auto };
}

export function systemToLonLat(systemId, a, b) {
  if (systemId === 'wgs-utm') return { error: 'Pick a fixed zone before typing an easting and northing.' };
  const spec = resolveSystem(systemId, 0, 0);
  if (!spec) return { error: 'Choose a coordinate system.' };
  if (spec.kind === 'longlat') {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return { error: 'Enter a longitude and a latitude.' };
    if (Math.abs(b) > 90 || Math.abs(a) > 180) return { error: 'That longitude or latitude is off the Earth.' };
    const [lon, lat] = spec.entry.shift ? applyShift(a, b, spec.entry.ellip, spec.entry.shift) : [a, b];
    const err = validateLonLat(lon, lat);
    if (err) return { error: 'That position does not land on the Earth.' };
    return { lon, lat, caveat: spec.caveat, name: spec.meta.name, datum: spec.meta.datum };
  }
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { error: 'Enter an easting and a northing.' };
  if (Math.abs(a) > 2e7 || Math.abs(b) > 2e7) return { error: 'That easting or northing is not a grid coordinate.' };
  const [lon, lat] = projectEntry(a, b, spec.entry);
  if (validateLonLat(lon, lat)) return { error: 'That grid position does not land on the Earth.' };
  return { lon, lat, caveat: spec.caveat, name: spec.meta.name, datum: spec.meta.datum };
}

export function formatDms(value, isLat) {
  if (!Number.isFinite(value)) return '';
  const neg = value < 0;
  const max = (isLat ? 90 : 180) * 36000;
  let tenths = Math.round(Math.abs(value) * 36000);
  if (tenths > max) tenths = max;
  const deg = Math.floor(tenths / 36000);
  const rem = tenths % 36000;
  const min = Math.floor(rem / 600);
  const sec = (rem % 600) / 10;
  const dir = neg ? (isLat ? 'S' : 'W') : (isLat ? 'N' : 'E');
  const [whole, frac] = sec.toFixed(1).split('.');
  return `${deg}°${String(min).padStart(2, '0')}'${whole.padStart(2, '0')}.${frac}"${dir}`;
}

function parseDmsToken(token) {
  const hem = String(token).match(/[NSEW]/i);
  const nums = String(token).match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
  if (!nums.length) return null;
  if (nums.length > 3) return { error: 'A degrees-minutes-seconds value has at most degrees, minutes and seconds.' };
  const deg = nums[0];
  const min = nums[1] || 0;
  const sec = nums[2] || 0;
  if (min < 0 || sec < 0 || min >= 60 || sec >= 60) return { error: 'Minutes and seconds must be from 0 up to, but not including, 60.' };
  const sign = deg < 0 ? -1 : 1;
  let value = sign * (Math.abs(deg) + min / 60 + sec / 3600);
  let axis = null;
  if (hem) {
    const h = hem[0].toUpperCase();
    axis = h === 'N' || h === 'S' ? 'lat' : 'lon';
    value = h === 'S' || h === 'W' ? -Math.abs(value) : Math.abs(value);
  }
  return { value, axis };
}

function parseDmsPair(raw) {
  const parts = raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  let tokens = parts.length >= 2 ? parts.slice(0, 2) : null;
  if (!tokens) {
    const bits = raw.match(/[-+]?\d[\d\s.°'′"″dms]*[NSEW]/gi);
    if (bits && bits.length >= 2) tokens = bits.slice(0, 2);
  }
  if (!tokens || tokens.length < 2) return null;
  const a = parseDmsToken(tokens[0]);
  const b = parseDmsToken(tokens[1]);
  if (!a || !b) return null;
  if (a.error) return a;
  if (b.error) return b;
  let lat;
  let lon;
  if (a.axis === 'lat' && b.axis === 'lon') { lat = a.value; lon = b.value; }
  else if (a.axis === 'lon' && b.axis === 'lat') { lon = a.value; lat = b.value; }
  else if (!a.axis && !b.axis) { lat = a.value; lon = b.value; }
  else return { error: 'Say which number is latitude (N or S) and which is longitude (E or W).' };
  const err = validateLonLat(lon, lat);
  if (err) return { error: err };
  return { kind: 'lonlat', lon, lat };
}

function parseGridText(raw) {
  const minna = /minna/i.test(raw);
  const m = raw.match(/(?:zone\s*)?(\d{1,2})\s*([NSns])\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const zone = +m[1];
  const south = m[2].toUpperCase() === 'S';
  const easting = +m[3];
  const northing = +m[4];
  if (zone < 1 || zone > 60) return { error: 'UTM zone must be from 1 to 60.' };
  if (minna && (south || zone < 31 || zone > 33)) return { error: 'Minna UTM on this map is zone 31N, 32N or 33N.' };
  const code = (minna ? 26300 : (south ? 32700 : 32600)) + zone;
  if (!minna && !entryForCode(code) && (zone < 1 || zone > 60)) return { error: 'That UTM zone is not used here.' };
  return { kind: 'grid', systemId: String(code), easting, northing };
}

export function parseCoordinateText(text) {
  const raw = String(text || '').trim();
  if (!raw) return { error: 'Paste a coordinate.' };
  const grid = parseGridText(raw);
  if (grid) return grid;
  if (/[°'′"″]|[NSEW]/i.test(raw)) {
    const dms = parseDmsPair(raw);
    if (dms) return dms;
    return { error: 'That degrees-minutes-seconds value could not be read. Include a hemisphere, for example 9°04\'35.4"N, 7°23\'55.0"E.' };
  }
  const nums = raw.split(/[,;\s]+/).map(Number).filter((n) => Number.isFinite(n));
  if (nums.length >= 2) {
    const [lat, lon] = nums;
    const err = validateLonLat(lon, lat);
    if (err) return { error: 'Paste latitude first, then longitude. ' + err };
    return { kind: 'lonlat', lon, lat };
  }
  return { error: 'Paste latitude and longitude, degrees-minutes-seconds, or a zone with easting and northing.' };
}

// ---- reading a code or a definition out of a GeoPackage --------------------

function lastEpsg(text) {
  if (!text) return null;
  const all = [...String(text).matchAll(/AUTHORITY\s*\[\s*"EPSG"\s*,\s*"?(\d+)"?\s*\]|ID\s*\[\s*"EPSG"\s*,\s*(\d+)\s*\]/gi)];
  if (!all.length) return null;
  const last = all[all.length - 1];
  return +(last[1] || last[2]);
}

function namedNumber(text, names) {
  for (const name of names) {
    const re = new RegExp('["\']' + name + '["\']\\s*,\\s*([+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?)', 'i');
    const m = String(text).match(re);
    if (m) return +m[1];
  }
  return null;
}

function proj4Params(text) {
  const out = {};
  for (const part of String(text).split('+')) {
    const bits = part.trim().split('=');
    if (!bits[0]) continue;
    out[bits[0].trim()] = bits.slice(1).join('=').trim();
  }
  return out;
}

function ellipsoidFrom(text, params) {
  // Check the named ellipsoid before scanning the whole string. A +towgs84
  // parameter contains the letters "wgs84" and must not decide the ellipsoid.
  if (params?.a && params?.rf) return { a: +params.a, f: 1 / +params.rf };
  if (params?.a && params?.b) return { a: +params.a, f: 1 - (+params.b) / +params.a };
  const ellps = String(params?.ellps || params?.datum || '').toLowerCase();
  if (/clrk80|clarke|minna/.test(ellps)) return CLARKE;
  if (/wgs84|wgs.?84|grs80/.test(ellps)) return WGS84;
  const sph = String(text || '').match(/SPHEROID\s*\[\s*"[^"]*"\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i)
    || String(text || '').match(/ELLIPSOID\s*\[\s*"[^"]*"\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i);
  if (sph) {
    const a = +sph[1];
    if (Math.abs(a - CLARKE.a) < 1) return CLARKE;
    if (Math.abs(a - WGS84.a) < 1) return WGS84;
    return { a, f: 1 / +sph[2] };
  }
  const cleaned = String(text || '').replace(/towgs84/ig, '').toLowerCase();
  if (/clarke|clrk80|minna/.test(cleaned)) return CLARKE;
  if (/wgs.?84|grs80/.test(cleaned)) return WGS84;
  return null;
}

function shiftFrom(text, params, ellip) {
  const raw = params?.towgs84 || (String(text || '').match(/TOWGS84\s*\[\s*([^\]]+)\]/i) || [])[1];
  if (raw) {
    const n = String(raw).split(',').map((v) => +v.trim());
    if (n.length >= 3 && n.slice(0, 3).some((v) => v !== 0)) return { dx: n[0], dy: n[1], dz: n[2] };
    return null;
  }
  const blob = `${text || ''} ${params?.datum || ''}`.toLowerCase();
  if (/minna/.test(blob) || (ellip && Math.abs(ellip.a - CLARKE.a) < 1 && /clarke|clrk/.test(blob))) {
    return { ...MINNA_SHIFT, omitted: true };
  }
  return null;
}

function parseDefinition(definition) {
  const text = String(definition || '').trim();
  if (!text || text === 'undefined') return null;
  if (text.startsWith('+proj') || text.includes('+proj=')) {
    const p = proj4Params(text);
    const ellip = ellipsoidFrom(text, p) || WGS84;
    const shift = shiftFrom(text, p, ellip);
    if (p.proj === 'longlat' || p.proj === 'latlong') {
      return { name: shift?.omitted || /minna/.test(text.toLowerCase()) ? 'Minna' : 'longitude / latitude', method: 'longlat', ellip, shift, datum: shift?.omitted || /minna/.test(text.toLowerCase()) ? 'minna' : (shift ? 'other' : 'wgs84') };
    }
    if (p.proj === 'utm') {
      const zone = +p.zone;
      if (!zone) return null;
      return { name: `UTM zone ${zone}${p.south != null ? 'S' : 'N'}`, ...utmZone(zone, p.south != null), ellip, shift, datum: shift?.omitted ? 'minna' : (shift ? 'other' : 'wgs84') };
    }
    if (p.proj === 'tmerc') {
      return {
        name: 'Transverse Mercator',
        method: 'tmerc',
        lat0: +p.lat_0 || 0,
        lon0: +p.lon_0 || 0,
        k0: +(p.k || p.k_0) || 1,
        x0: +p.x_0 || 0,
        y0: +p.y_0 || 0,
        ellip, shift,
        datum: shift?.omitted ? 'minna' : (shift ? 'other' : 'wgs84'),
      };
    }
    if (p.proj === 'merc') return { name: 'Web Mercator', method: 'merc' };
    return null;
  }
  const proj = (text.match(/PROJECTION\s*\[\s*"([^"]+)"/i) || [])[1] || '';
  const ellip = ellipsoidFrom(text, null);
  if (!ellip && !/GEOGCS|GEOGCRS|PROJCS|PROJCRS/i.test(text)) return null;
  const shift = shiftFrom(text, null, ellip || WGS84);
  const datum = shift?.omitted ? 'minna' : (shift ? 'other' : 'wgs84');
  if (!proj || /geographic/i.test(text) && !/PROJCS|PROJCRS/i.test(text)) {
    return { name: datum === 'minna' ? 'Minna' : 'longitude / latitude', method: 'longlat', ellip: ellip || WGS84, shift, datum };
  }
  if (/transverse.?mercator/i.test(proj)) {
    const lon0 = namedNumber(text, ['central_meridian', 'Central_Meridian', 'longitude_of_origin', 'Longitude of natural origin']);
    const lat0 = namedNumber(text, ['latitude_of_origin', 'Latitude_Of_Origin', 'Latitude of natural origin']);
    const k0 = namedNumber(text, ['scale_factor', 'Scale_Factor', 'Scale factor at natural origin']);
    const x0 = namedNumber(text, ['false_easting', 'False_Easting', 'False easting']);
    const y0 = namedNumber(text, ['false_northing', 'False_Northing', 'False northing']);
    if (lon0 == null || x0 == null) return null;
    const title = (text.match(/(?:PROJCS|PROJCRS)\s*\[\s*"([^"]+)"/i) || [])[1] || 'Transverse Mercator';
    return {
      name: title, method: 'tmerc', lat0: lat0 || 0, lon0, k0: k0 || 1, x0, y0: y0 || 0,
      ellip: ellip || WGS84, shift, datum,
    };
  }
  if (/mercator/i.test(proj)) return { name: 'Web Mercator', method: 'merc' };
  return null;
}

export function detectCrs(record) {
  const organization = String(record?.organization || '').toUpperCase();
  const orgCode = +record?.orgCode;
  const srsId = +record?.srsId;
  const definition = [record?.definition, record?.definition2].filter((v) => v && v !== 'undefined').join('\n');
  const named = lastEpsg(definition);
  const code = (organization === 'EPSG' && orgCode > 0 ? orgCode : 0)
    || (entryForCode(srsId) ? srsId : 0)
    || (entryForCode(named) ? named : 0)
    || 0;
  if (code) {
    const entry = entryForCode(code);
    if (entry) return finishCrs(code, entry, { fromFile: true });
  }
  const parsed = parseDefinition(definition);
  if (!parsed) return null;
  if (parsed.shift?.omitted) parsed.datum = 'minna';
  return finishCrs(entryForCode(named) ? named : (entryForCode(srsId) ? srsId : 0), parsed, {
    fromFile: true,
    omittedShift: !!parsed.shift?.omitted,
  });
}

export function transformGeometry(geometry, crs, latFirst) {
  if (!geometry || !crs) return null;
  const xy = (pair) => {
    const out = projectToLonLat(+pair[0], +pair[1], crs, latFirst);
    return out && out.map((v) => +v);
  };
  const ring = (coords) => coords.map(xy).filter((p) => p && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  const g = geometry;
  if (g.type === 'Point') return { type: 'Point', coordinates: xy(g.coordinates) };
  if (g.type === 'MultiPoint' || g.type === 'LineString') return { type: g.type, coordinates: ring(g.coordinates) };
  if (g.type === 'MultiLineString' || g.type === 'Polygon') return { type: g.type, coordinates: g.coordinates.map(ring) };
  if (g.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: g.coordinates.map((poly) => poly.map(ring)) };
  if (g.type === 'GeometryCollection') {
    const geometries = (g.geometries || []).map((part) => transformGeometry(part, crs, latFirst)).filter(Boolean);
    return geometries.length ? { type: 'GeometryCollection', geometries } : null;
  }
  return null;
}

export function geometryInWorld(geometry) {
  let ok = 0;
  let bad = 0;
  const visit = (pair) => {
    if (!pair || !Number.isFinite(pair[0]) || !Number.isFinite(pair[1]) || Math.abs(pair[0]) > 180 || Math.abs(pair[1]) > 90) bad++;
    else ok++;
  };
  const walk = (g) => {
    if (!g) return;
    if (g.type === 'Point') visit(g.coordinates);
    else if (g.type === 'MultiPoint' || g.type === 'LineString') g.coordinates.forEach(visit);
    else if (g.type === 'MultiLineString' || g.type === 'Polygon') g.coordinates.forEach((r) => r.forEach(visit));
    else if (g.type === 'MultiPolygon') g.coordinates.forEach((p) => p.forEach((r) => r.forEach(visit)));
    else if (g.type === 'GeometryCollection') (g.geometries || []).forEach(walk);
  };
  walk(geometry);
  return { ok, bad };
}
