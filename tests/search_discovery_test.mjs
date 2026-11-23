import assert from 'node:assert/strict';
import { formatDms, lonLatToSystem, parseCoordinateText, systemToLonLat, utmZoneOf, validateLonLat } from '../app/js/crs.js';

function metresApart(lon, lat, elon, elat) {
  const dx = (lon - elon) * 111320 * Math.cos(elat * Math.PI / 180);
  const dy = (lat - elat) * 110540;
  return Math.hypot(dx, dy);
}

const checks = [
  [32632, 323998.9537, 1003697.9049, 7.3986, 9.0765],
  [32631, 544226.1181, 718493.6481, 3.4, 6.5],
  [32633, 291861.1301, 1128136.6286, 13.1, 10.2],
  [26392, 549572.9540798797, 561371.242159577, 7.3986, 9.0765],
  [26391, 109176.85596772374, 276443.29268538463, 3.4, 6.5],
  [26393, 1176168.4074, 685482.2263, 13.1, 10.2],
  [26332, 324075.8703, 1003578.1469, 7.3986, 9.0765],
];

for (const [code, easting, northing, lon, lat] of checks) {
  const forward = lonLatToSystem(lon, lat, String(code));
  assert.equal(forward.error, undefined, `EPSG:${code} forward error`);
  assert.ok(Math.hypot(forward.easting - easting, forward.northing - northing) < 0.5, `EPSG:${code} forward is off`);
  const back = systemToLonLat(String(code), easting, northing);
  assert.ok(metresApart(back.lon, back.lat, lon, lat) < 0.05, `EPSG:${code} inverse is off`);
  const round = systemToLonLat(String(code), forward.easting, forward.northing);
  assert.ok(metresApart(round.lon, round.lat, lon, lat) < 0.05, `EPSG:${code} does not round-trip`);
}

const minna = lonLatToSystem(7.3986, 9.0765, '4263');
assert.ok(Math.abs(minna.x - 7.399331137443918) < 1e-6, 'Minna longitude');
assert.ok(Math.abs(minna.y - 9.076245123470477) < 1e-6, 'Minna latitude');
assert.match(minna.caveat, /15 metres/);
const minnaBack = systemToLonLat('4263', minna.x, minna.y);
assert.ok(metresApart(minnaBack.lon, minnaBack.lat, 7.3986, 9.0765) < 0.05, 'Minna degrees round-trip');

assert.equal(utmZoneOf(7.3986, 9.0765).label, '32N');
assert.equal(utmZoneOf(3.4, 6.5).label, '31N');
assert.equal(utmZoneOf(13.1, 10.2).label, '33N');
assert.equal(utmZoneOf(-1, -1).label, '30S');
assert.equal(utmZoneOf(180, 0).label, '60N');
assert.doesNotMatch(utmZoneOf(-3, 6).label, /west/i);

assert.equal(formatDms(9.0765, true), '9°04\'35.4"N');
assert.equal(formatDms(7.3986, false), '7°23\'55.0"E');
assert.equal(formatDms(59.96 / 3600, true), '0°01\'00.0"N');
assert.equal(formatDms(-0.5, true), '0°30\'00.0"S');
assert.doesNotMatch(formatDms(59.96 / 3600, false), /60\.0/);

assert.equal(validateLonLat(7, 999), 'Latitude must be between −90 and 90.');
assert.equal(validateLonLat(181, 9), 'Longitude must be between −180 and 180.');
assert.equal(validateLonLat(7, 89), '');

const pasted = parseCoordinateText('9.0765, 7.3986');
assert.equal(pasted.kind, 'lonlat');
assert.equal(pasted.lat, 9.0765);
assert.equal(pasted.lon, 7.3986);
const dms = parseCoordinateText('9°04\'35.4"N, 7°23\'55.0"E');
assert.ok(metresApart(dms.lon, dms.lat, 7.3986, 9.0765) < 2, 'DMS paste');
const grid = parseCoordinateText('32N 323998.9537 1003697.9049');
assert.equal(grid.systemId, '32632');
const back = systemToLonLat(grid.systemId, grid.easting, grid.northing);
assert.ok(metresApart(back.lon, back.lat, 7.3986, 9.0765) < 0.05, 'grid paste');
assert.match(parseCoordinateText('Minna 32N 324075.87 1003578.15').systemId, /^26332$/);
assert.match(parseCoordinateText('9°04\'35.4"N').error, /could not be read|hemisphere|latitude/i);
assert.match(systemToLonLat('32632', 1e12, 1e12).error, /not a grid|does not land/);

console.log('search discovery coordinates ok');
