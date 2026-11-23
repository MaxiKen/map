import assert from 'node:assert/strict';
import {
  mercX, mercY, unX, unY, haversineKm, ringAreaKm2, lonlatRing,
  areaCentroidMerc, pointFeature, lineFeature, polygonFeature,
  featureVertices, featureBBoxRing, densifyFlat, pointsAlongFlat, offsetLineFlat,
  smoothFlat, affineFlat, splitRingByLine, splitPolygonByLines, concaveHullPoints,
  polygonMeasure, lineLengthStats, polygonsTouch,
} from '../app/js/engine.js';

function ring(lon0, lat0, lon1, lat1) {
  return [
    mercX(lon0), mercY(lat1), mercX(lon1), mercY(lat1),
    mercX(lon1), mercY(lat0), mercX(lon0), mercY(lat0), mercX(lon0), mercY(lat1),
  ];
}
function poly(r) {
  return { type: 'poly', parts: [[Float64Array.from(r)]], bb: [0, 0, 1, 1] };
}
function line(coords) {
  return { type: 'line', parts: [Float64Array.from(coords.flatMap(([lon, lat]) => [mercX(lon), mercY(lat)]))], bb: [0, 0, 1, 1] };
}

const square = ring(7, 9, 8, 10);
const holed = [
  [Float64Array.from(square), Float64Array.from(ring(7.4, 9.4, 7.6, 9.6))],
];
const measured = polygonMeasure(holed);
const outer = ringAreaKm2(lonlatRing(square));
const hole = ringAreaKm2(lonlatRing(ring(7.4, 9.4, 7.6, 9.6)));
assert.ok(Math.abs(measured.areaKm2 - (outer - hole)) < 0.01, 'a hole is subtracted from the area');
assert.equal(measured.holes, 1);
assert.ok(measured.perimKm > 0);

const centroid = areaCentroidMerc(poly(square));
const mean = [(mercX(7) + mercX(8)) / 2, (mercY(9) + mercY(10)) / 2];
assert.ok(Math.abs(centroid[0] - mean[0]) < 1e-6 && Math.abs(centroid[1] - mean[1]) < 1e-4, 'a square centroid sits at its centre');
const lShape = [
  mercX(0), mercY(2), mercX(2), mercY(2), mercX(2), mercY(1),
  mercX(1), mercY(1), mercX(1), mercY(0), mercX(0), mercY(0), mercX(0), mercY(2),
];
const lCent = areaCentroidMerc(poly(lShape));
assert.ok(lCent[0] < mercX(1), 'an L centroid is left of the bounding-box centre');

const pt = pointFeature(mercX(7), mercY(9), { name: 'A' });
assert.deepEqual(Array.from(pt.parts), [mercX(7), mercY(9)]);
assert.equal(pt.parts.length, 2, 'a point is a flat pair, not a nested pair');
const drawnLine = lineFeature([[mercX(7), mercY(9), mercX(8), mercY(9)]], {});
assert.equal(drawnLine.parts[0].length, 4);
const drawnPoly = polygonFeature([[square]], {});
assert.equal(drawnPoly.parts[0][0].length >= 8, true);
assert.equal(Array.isArray(drawnPoly.parts[0]), true);

const box = featureBBoxRing({ type: 'point', parts: [mercX(7), mercY(9), mercX(8), mercY(10)] });
assert.equal(box.length, 10);
assert.equal(featureVertices({ type: 'point', parts: [1, 2, 3, 4] }).length, 2);
assert.equal(featureVertices(poly(square)).length, 4, 'a closed ring does not repeat its first vertex');

const east = [mercX(7), mercY(9), mercX(8), mercY(9)];
const dense = densifyFlat(east, 27, false);
const span = haversineKm([7, 9], [8, 9]);
assert.equal(dense.length / 2, Math.floor(span / 27) + 1);
const walked = [];
for (let i = 0; i < dense.length - 2; i += 2) {
  walked.push(haversineKm([unX(dense[i]), unY(dense[i + 1])], [unX(dense[i + 2]), unY(dense[i + 3])]));
}
assert.ok(walked.slice(0, -1).every((d) => Math.abs(d - 27) < 0.05), 'densify spacing is ground kilometres');
assert.ok(walked[walked.length - 1] < 54, 'the leftover end is shorter than two intervals');

const marks = pointsAlongFlat(east, 20);
assert.ok(marks.length >= 5);
const gaps = [];
for (let i = 1; i < marks.length; i++) gaps.push(haversineKm([unX(marks[i - 1][0]), unY(marks[i - 1][1])], [unX(marks[i][0]), unY(marks[i][1])]));
assert.ok(gaps.every((d) => Math.abs(d - 20) < 0.05), 'points along a line are 20 km apart, including the join');

const offset = offsetLineFlat(east, 10, 'left');
const mid = [(east[0] + east[2]) / 2, (east[1] + east[3]) / 2];
const offMid = [(offset[0] + offset[2]) / 2, (offset[1] + offset[3]) / 2];
const offKm = haversineKm([unX(mid[0]), unY(mid[1])], [unX(offMid[0]), unY(offMid[1])]);
assert.ok(Math.abs(offKm - 10) < 0.2, 'a 10 km offset is about 10 km, not a mercator delta');
assert.ok(unY(offMid[1]) > 9, 'left of an eastbound line is north');

const source = Float64Array.from(square);
const moved = affineFlat(square, [mercX(7.5), mercY(9.5)], { eastKm: 11.1, northKm: 0, scale: 1, rotateDeg: 0 });
assert.equal(source[0], square[0], 'affine does not rewrite the source');
const shift = haversineKm([unX(square[0]), unY(square[1])], [unX(moved[0]), unY(moved[1])]);
assert.ok(Math.abs(shift - 11.1) < 0.3, 'an east shift is kilometres, not mercator units');

const wiggly = [mercX(7), mercY(9), mercX(7.02), mercY(9.02), mercX(7.04), mercY(9)];
const before = Float64Array.from(wiggly);
const smooth = smoothFlat(wiggly, 2, false);
assert.equal(before[3], wiggly[3], 'smooth does not rewrite the source');
assert.ok(Math.abs(smooth[3] - wiggly[3]) > 0, 'a bend moves toward its neighbours');
assert.equal(smooth.length, wiggly.length);

const cutter = [mercX(7.5), mercY(8.5), mercX(7.5), mercY(10.5)];
const pieces = splitRingByLine(square, cutter);
assert.equal(pieces.length, 2, 'a line across a square makes two polygons');
const areas = pieces.map((piece) => ringAreaKm2(lonlatRing(piece)));
assert.ok(Math.abs(areas[0] + areas[1] - outer) / outer < 0.02, 'the two pieces add back to the square');
const missed = splitRingByLine(square, [mercX(6), mercY(9.5), mercX(6.5), mercY(9.5)]);
assert.equal(missed.length, 0, 'a line that misses is not a split');
const parts = splitPolygonByLines(poly(square), [line([[7.5, 8.5], [7.5, 10.5]])]);
assert.equal(parts.length, 2);
assert.ok(parts.every((part) => part[0].length >= 8));

const hullPts = [];
for (let y = 0; y <= 4; y++) hullPts.push([mercX(7), mercY(9 + y * 0.1)]);
for (let x = 1; x <= 3; x++) {
  hullPts.push([mercX(7 + x * 0.1), mercY(9)]);
  hullPts.push([mercX(7 + x * 0.1), mercY(9.4)]);
}
hullPts.push([mercX(7.3), mercY(9.1)], [mercX(7.3), mercY(9.3)]);
const concave = concaveHullPoints(hullPts, 8);
assert.ok(concave && concave.length >= 8);
const hullLon = [];
for (let i = 0; i < concave.length - 2; i += 2) hullLon.push([+unX(concave[i]).toFixed(2), +unY(concave[i + 1]).toFixed(2)]);
assert.ok(hullLon.some(([lon, lat]) => lon === 7.3 && lat === 9.1), 'a tight alpha follows the bay, it is not the outer box');
assert.ok(hullLon.some(([lon, lat]) => lon === 7.3 && lat === 9.3), 'the other side of the bay is on the boundary');
const loose = concaveHullPoints(hullPts, 80);
assert.ok(loose && loose.length >= 8, 'a large alpha still returns a ring');
assert.ok(loose.length <= concave.length, 'a larger alpha is not a tighter outline');

const west = poly(ring(7, 9, 8, 10));
const eastPoly = poly(ring(8, 9, 9, 10));
const gap = poly(ring(10, 9, 11, 10));
assert.equal(polygonsTouch(west, eastPoly), true, 'a shared border counts');
assert.equal(polygonsTouch(west, gap), false, 'a gap is not adjacency');

const stats = lineLengthStats([line([[7, 9], [8, 9]]), line([[7, 9], [7, 10]])]);
assert.equal(stats.count, 2);
assert.ok(stats.totalKm > 100 && stats.minKm > 0 && stats.maxKm >= stats.minKm);

console.log('geometry ops ok');
