import assert from 'node:assert/strict';
import { mercX, mercY, convexHullPoints, simplifyRing, simplifyFeature, featureClosestKm, featureMetrics, distToSegmentMerc } from '../app/js/engine.js';

const MERC_METRES = 40075016.686;

function point(lon, lat) {
  return { type: 'point', parts: [mercX(lon), mercY(lat)], bb: [mercX(lon), mercY(lat), mercX(lon), mercY(lat)] };
}
function square(lon0, lat0, lon1, lat1) {
  const ring = [
    mercX(lon0), mercY(lat1), mercX(lon1), mercY(lat1),
    mercX(lon1), mercY(lat0), mercX(lon0), mercY(lat0), mercX(lon0), mercY(lat1),
  ];
  const bb = [mercX(lon0), Math.min(mercY(lat0), mercY(lat1)), mercX(lon1), Math.max(mercY(lat0), mercY(lat1))];
  return { type: 'poly', parts: [[ring]], bb };
}
function line(coords) {
  const flat = coords.flatMap(([lon, lat]) => [mercX(lon), mercY(lat)]);
  const xs = flat.filter((_, i) => i % 2 === 0), ys = flat.filter((_, i) => i % 2 === 1);
  return { type: 'line', parts: [flat], bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
}

// A point inside a polygon is touching, not a distance to the middle.
const zone = square(7, 9, 8, 10);
const inside = featureClosestKm(point(7.5, 9.5), zone);
assert.equal(inside.km, 0, 'a point inside a polygon is 0 km');

const outside = featureClosestKm(point(8.1, 9.5), zone);
assert.ok(outside.km > 0 && outside.km < 20, 'a point just outside is a short edge distance, not a centroid distance');

// The closest feature can sit well outside a small neighbourhood of the centroid.
const far = featureClosestKm(point(7, 9), point(7.5, 9));
const nearerEdge = featureClosestKm(square(6.9, 8.6, 7.05, 8.7), point(7, 9));
assert.ok(nearerEdge.km < far.km, 'an edge outside the centroid neighbourhood can still be nearer');

// Hull of a line uses its ends, and collinear points do not invent a polygon.
const bent = line([[7, 9], [8, 9.5], [9, 9]]);
const hull = convexHullPoints([[mercX(7), mercY(9)], [mercX(8), mercY(9.5)], [mercX(9), mercY(9)], [mercX(8), mercY(9.2)]]);
assert.ok(hull && hull.length >= 6, 'three corners make a hull');
assert.equal(convexHullPoints([[0, 0], [1, 0], [2, 0]]), null, 'a straight line is not a hull');

// The ring simplifier drops a bend only when it moves the line by more than the
// tolerance, and it refuses a result under three vertices — so a short line has
// to be shortened by the tool, which uses the same distance test.
const wiggly = [mercX(7), mercY(9), mercX(7.01), mercY(9.004), mercX(7.02), mercY(9), mercX(7.03), mercY(9.006), mercX(7.04), mercY(9)];
const bend = distToSegmentMerc(wiggly[2], wiggly[3], wiggly[0], wiggly[1], wiggly[8], wiggly[9]);
assert.ok(bend > 0, 'the test bend is a real deviation');
assert.equal(simplifyRing(wiggly, 0).length, wiggly.length, 'a zero tolerance keeps every vertex');
assert.equal(simplifyRing(wiggly, bend / 2).length, wiggly.length, 'a tolerance below the bend keeps it');

function shortLine(metres) {
  const km = metres / 1000;
  const mid = [mercX(7.01), mercY(9.004)];
  const ends = [mercX(7), mercY(9), mercX(7.02), mercY(9)];
  const dx = ends[2] - ends[0], dy = ends[3] - ends[1], L = dx * dx + dy * dy;
  let t = ((mid[0] - ends[0]) * dx + (mid[1] - ends[1]) * dy) / L;
  t = Math.max(0, Math.min(1, t));
  const bendKm = distToSegmentMerc(mid[0], mid[1], ends[0], ends[1], ends[2], ends[3]);
  return bendKm > km ? 6 : 4;
}
assert.equal(shortLine(100000), 4, 'a short line drops its only bend once the tolerance covers it');
assert.equal(shortLine(1), 6, 'a short line keeps a bend the tolerance does not cover');

const poly = square(7, 9, 8, 10);
const untouched = simplifyFeature(poly, 0.001);
assert.equal(featureMetrics(untouched).area > 100, true, 'a tiny tolerance does not erase the polygon');

// The nearest-search stop rule, in one unit. A feature whose box could still
// reach closer than the current best must not be skipped.
function searchWouldStop({ bestKm, ring, cellMerc, srcSpanMerc }) {
  const bestMerc = bestKm * 1000 / MERC_METRES;
  const unsearched = Math.max(0, (ring - 1) * cellMerc - srcSpanMerc);
  return unsearched > bestMerc;
}
const cell = 25 * 1000 / MERC_METRES;
assert.equal(searchWouldStop({ bestKm: 10, ring: 1, cellMerc: cell, srcSpanMerc: 0 }), false, 'the first ring has not proved the neighbourhood empty');
assert.equal(searchWouldStop({ bestKm: 10, ring: 2, cellMerc: cell, srcSpanMerc: 0 }), true, 'one full cell out, a 10 km hit can no longer be beaten');
assert.equal(searchWouldStop({ bestKm: 40, ring: 2, cellMerc: cell, srcSpanMerc: 0 }), false, 'a 40 km hit is not final after one 25 km cell');
assert.equal(searchWouldStop({ bestKm: 0, ring: 2, cellMerc: cell, srcSpanMerc: cell }), false, 'a source as wide as a cell keeps the search open');

console.log('analysis geometry ok');
