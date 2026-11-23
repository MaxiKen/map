import assert from 'node:assert/strict';
import { mercX, mercY, polygonBoolean } from '../app/js/engine.js';

function square(lon0, lat0, lon1, lat1) {
  const ring = [
    mercX(lon0), mercY(lat1),
    mercX(lon1), mercY(lat1),
    mercX(lon1), mercY(lat0),
    mercX(lon0), mercY(lat0),
    mercX(lon0), mercY(lat1),
  ];
  return { type: 'poly', parts: [[ring]] };
}

const west = square(7, 9, 8, 10);
const east = square(8, 9, 9, 10);
const band = square(7.5, 9.2, 8.5, 9.8);
const gap = square(10, 9, 11, 10);
const inner = square(7.2, 9.2, 7.8, 9.8);

const joined = polygonBoolean([west, east], 'union');
assert.equal(joined.length, 1, 'adjacent squares become one polygon');
assert.equal(joined[0].length, 1, 'the shared border is removed');

const apart = polygonBoolean([west, gap], 'union');
assert.equal(apart.length, 2, 'a gap stays two pieces');

const overlap = polygonBoolean([west, band], 'intersection');
assert.equal(overlap.length, 1, 'an overlap is one piece');
assert.ok(overlap[0][0].length >= 8, 'the overlap has a ring');

const cut = polygonBoolean([west, band], 'difference');
assert.equal(cut.length, 1, 'a partial cut keeps a remainder');
assert.ok(cut[0][0].length > west.parts[0][0].length, 'the remainder has a notch');

const holed = polygonBoolean([west, inner], 'difference');
assert.equal(holed.length, 1, 'an interior cut stays one polygon');
assert.equal(holed[0].length, 2, 'an interior cut becomes a hole');

assert.equal(polygonBoolean([west, gap], 'intersection').length, 0, 'separate squares do not overlap');
assert.equal(polygonBoolean([inner, west], 'difference').length, 0, 'a shape inside the cutter is removed');

console.log('overlay geometry ok');
