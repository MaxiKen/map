import assert from 'node:assert/strict';
import {
  mercX, mercY, unX, unY, polygonMeasure, polygonBoolean,
  geometryIssues, ringDirectionFaults, featurePartCount, geometrySignature,
  snapFlatToDegrees, snapFlatToVertices, overlapAreaKm2, enclosedGapParts,
  ringSelfCrosses, featureDistanceKm, pointInFeature,
} from '../app/js/engine.js';

function rect(x, y, w, h = w) {
  const ring = [mercX(x), mercY(y), mercX(x + w), mercY(y), mercX(x + w), mercY(y + h), mercX(x), mercY(y + h), mercX(x), mercY(y)];
  const xs = ring.filter((_, i) => i % 2 === 0);
  const ys = ring.filter((_, i) => i % 2 === 1);
  return { type: 'poly', parts: [[Float64Array.from(ring)]], bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
}
function point(lon, lat) {
  const x = mercX(lon), y = mercY(lat);
  return { type: 'point', parts: Float64Array.from([x, y]), bb: [x, y, x, y] };
}
function line(coords) {
  const flat = [];
  for (const [lon, lat] of coords) flat.push(mercX(lon), mercY(lat));
  const xs = flat.filter((_, i) => i % 2 === 0), ys = flat.filter((_, i) => i % 2 === 1);
  return { type: 'line', parts: [Float64Array.from(flat)], bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
}

const square = rect(7, 6, 1);
assert.deepEqual(geometryIssues(square), [], 'a closed anticlockwise square is valid');
assert.deepEqual(ringDirectionFaults(square), [], 'an anticlockwise outer ring is the ordinary direction');
assert.equal(featurePartCount(square), 1);
assert.equal(featurePartCount(point(7, 6)), 1, 'one point is not multi-part');
assert.deepEqual(geometryIssues(point(7, 6)), [], 'a point is not null and not a bad ring');

const hole = rect(7, 6, 2);
const hx = 7.4, hy = 6.4, hw = 0.5;
hole.parts[0].push(Float64Array.from([mercX(hx), mercY(hy), mercX(hx), mercY(hy + hw), mercX(hx + hw), mercY(hy + hw), mercX(hx + hw), mercY(hy), mercX(hx), mercY(hy)]));
assert.equal(featurePartCount(hole), 1, 'a hole is not a second part');
assert.ok(polygonMeasure(hole.parts).areaKm2 < polygonMeasure(rect(7, 6, 2).parts).areaKm2, 'a hole is subtracted');

const open = { type: 'poly', parts: [[[mercX(7), mercY(6), mercX(8), mercY(6), mercX(8), mercY(7)]]], bb: square.bb };
assert.ok(geometryIssues(open).includes('ring is not closed'));
const bow = line([[7, 6], [8, 7], [7, 7], [8, 6]]);
assert.equal(ringSelfCrosses(bow.parts[0]), true, 'a bowtie crosses itself');
assert.ok(geometryIssues(bow).includes('line crosses itself'));
assert.equal(ringSelfCrosses(square.parts[0][0]), false);

const empty = { type: 'line', parts: [Float64Array.from([mercX(7), mercY(6)])], bb: [mercX(7), mercY(6), mercX(7), mercY(6)] };
assert.ok(geometryIssues(empty).includes('line with fewer than 2 vertices'));
assert.equal(geometryIssues({ type: 'point', parts: Float64Array.from([]) }).includes('no coordinates'), true);

const oob = point(181, 6);
assert.ok(geometryIssues(oob).some((s) => s.includes('outside')), 'longitude 181 is out of range');
assert.deepEqual(geometryIssues(point(7, 6)), [], 'a Nigerian point is in range');

const reversed = rect(7, 6, 1);
const src = reversed.parts[0][0];
const flipped = new Float64Array(src.length);
const pairs = src.length / 2;
for (let i = 0; i < pairs; i++) {
  flipped[i * 2] = src[(pairs - 1 - i) * 2];
  flipped[i * 2 + 1] = src[(pairs - 1 - i) * 2 + 1];
}
reversed.parts = [[flipped]];
assert.equal(geometrySignature(square, 1), geometrySignature(reversed, 1), 'a reversed ring is the same shape');
assert.notEqual(geometrySignature(square, 1), geometrySignature(rect(9, 6, 1), 1));
const shifted = point(7.000004, 6);
assert.equal(geometrySignature(point(7, 6), 1), geometrySignature(shifted, 1), 'one metre groups nearby points');
assert.notEqual(geometrySignature(point(7, 6), 1), geometrySignature(point(7.01, 6), 1));

const grid = snapFlatToDegrees([mercX(7.04), mercY(6.06)], 0.1);
assert.ok(Math.abs(unX(grid[0]) - 7) < 1e-9 && Math.abs(unY(grid[1]) - 6.1) < 1e-6, 'the grid step is degrees, not mercator');
const target = [mercX(7), mercY(6)];
const snapped = snapFlatToVertices([mercX(7.0002), mercY(6.0002)], [target], 50);
assert.equal(snapped[0], target[0], 'a vertex within 50 m snaps');
const far = snapFlatToVertices([mercX(7.01), mercY(6)], [target], 50);
assert.notEqual(far[0], target[0], 'a vertex a kilometre away does not snap');

const overlap = overlapAreaKm2(rect(7, 6, 1), rect(7.5, 6.5, 1));
assert.ok(overlap > 1000, 'overlapping squares have area');
assert.equal(overlapAreaKm2(rect(7, 6, 1), rect(9, 6, 1)), 0, 'separated squares do not overlap');

const thick = 0.3;
const frame = [rect(7, 6, 3, thick), rect(7, 8.7, 3, thick), rect(7, 6, thick, 3), rect(9.7, 6, thick, 3)];
const gaps = enclosedGapParts(frame);
assert.equal(gaps.length, 1, 'a closed frame has one enclosed gap');
assert.ok(polygonMeasure(gaps).areaKm2 > 1000);
assert.equal(enclosedGapParts([rect(7, 6, 1), rect(8, 6, 1)]).length, 0, 'touching polygons have no gap');
assert.equal(enclosedGapParts([rect(7, 6, 1), rect(9, 6, 1)]).length, 0, 'separated polygons have no enclosed gap');
assert.equal(enclosedGapParts([hole, rect(12, 12, 0.2)]).length, 0, 'a hole in one polygon is not a gap');

const inside = point(7.5, 6.5);
assert.equal(featureDistanceKm(inside, square), 0, 'a point inside a polygon is 0 km, not the vertex distance');
const beside = point(8.05, 6.5);
const km = featureDistanceKm(beside, square);
assert.ok(km > 4 && km < 8, 'distance is to the edge, got ' + km);

const union = polygonBoolean([rect(7, 6, 0.4), rect(7.2, 6, 0.4), rect(7.4, 6, 0.4)], 'union');
assert.equal(union.length, 1, 'a pairwise union still merges a chain');

console.log('topology ops ok');
