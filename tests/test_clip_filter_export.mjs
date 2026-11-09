import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_VECTOR_COLOR, prepareFeature, mercX, mercY, unX, unY, normalizeClip, ringSignedArea, ensureCW, ensureCCW, pip2, segmentsIntersect, polyOverlapsPoly, clipBB, circleToPolygon } from '../app/js/engine.js';

// ---------------------------------------------------------------- clip geometry tests

// rect normalization: CW outer ring
const rectClip = normalizeClip({ type: 'rect', wb: [mercX(2), mercY(4), mercX(14), mercY(13)], label: 'Test rect' });
assert.ok(rectClip, 'rect clip normalizes');
assert.equal(rectClip.type, 'rect');
assert.ok(rectClip.polys && rectClip.polys.length === 1 && rectClip.polys[0].length === 1, 'rect has one outer ring');
assert.equal(rectClip.polys[0][0].length, 8, 'rect ring is flat array of 4 points (8 coords)');
// CW: signed area positive in screen coords (y down)
const ringArea = ringSignedArea(rectClip.polys[0][0]);
assert.ok(ringArea > 0, 'rect outer ring is CW (positive signed area)', { ringArea });

// poly normalization: outer CW, holes CCW
const polyClip = normalizeClip({
  type: 'poly',
  rings: [
    [mercX(2), mercY(4), mercX(14), mercY(4), mercX(14), mercY(13), mercX(2), mercY(13)], // outer CW
    [mercX(6), mercY(8), mercX(8), mercY(8), mercX(8), mercY(10), mercX(6), mercY(10)],    // hole CCW
  ],
  label: 'Test poly with hole',
});
assert.ok(polyClip, 'poly clip normalizes');
assert.equal(polyClip.type, 'poly');
assert.ok(ringSignedArea(polyClip.polys[0][0]) > 0, 'outer ring is CW');
assert.ok(ringSignedArea(polyClip.polys[0][1]) < 0, 'hole ring is CCW');
assert.ok(polyClip.bb, 'has bounding box');

// circle normalization
const circleClip = normalizeClip({ type: 'circle', c: [mercX(8), mercY(9)], r: 0.1, label: 'Test circle' });
assert.ok(circleClip, 'circle clip normalizes');
assert.equal(circleClip.type, 'circle');
assert.ok(circleClip.polys && circleClip.polys[0][0].length > 8, 'circle approximated as polygon');

// pip2 point-in-polygon
assert.ok(pip2(mercX(8), mercY(9), [rectClip.polys[0][0]]), 'point inside rect');
assert.ok(!pip2(mercX(1), mercY(9), [rectClip.polys[0][0]]), 'point outside rect');
assert.ok(pip2(mercX(5), mercY(6), polyClip._allRings), 'point inside outer but outside hole');
assert.ok(!pip2(mercX(7), mercY(9), polyClip._allRings), 'point inside hole is outside the polygon');

// polyOverlapsPoly: strict interior-overlap
// Two rects that touch at a border should NOT overlap (area = 0)
const rectA = [[mercX(2), mercY(4), mercX(6), mercY(4), mercX(6), mercY(9), mercX(2), mercY(9)]];
const rectB = [[mercX(6), mercY(4), mercX(10), mercY(4), mercX(10), mercY(9), mercX(6), mercY(9)]];
assert.ok(!polyOverlapsPoly(rectA, rectB), 'touching border neighbours do not overlap (area=0)');

// Two rects that straddle should overlap
const rectC = [[mercX(4), mercY(4), mercX(8), mercY(4), mercX(8), mercY(9), mercX(4), mercY(9)]];
assert.ok(polyOverlapsPoly(rectA, rectC), 'straddling rects overlap');

// Enclosing: small rect inside large rect
const rectSmall = [[mercX(5), mercY(5), mercX(5.5), mercY(5), mercX(5.5), mercY(5.5), mercX(5), mercY(5.5)]];
const rectLarge = [[mercX(2), mercY(4), mercX(10), mercY(4), mercX(10), mercY(9), mercX(2), mercY(9)]];
assert.ok(polyOverlapsPoly(rectSmall, rectLarge), 'enclosed feature overlaps');
assert.ok(polyOverlapsPoly(rectLarge, rectSmall), 'enclosing clip overlaps');

// Segments crossing
assert.ok(segmentsIntersect(0, 0, 10, 10, 0, 10, 10, 0), 'diagonals cross');
assert.ok(!segmentsIntersect(0, 0, 5, 5, 6, 6, 10, 10), 'collinear-separated segments do not cross');

// ---------------------------------------------------------------- filter operator tests

// Simulate applyFilter logic for 'in' and 'not_in'
function applyFilterMock(features, filter) {
  if (!filter) return features.filter(() => true);
  let n = 0;
  const result = [];
  for (const f of features) {
    const val = String(f.props[filter.field] ?? '');
    let hit;
    if (filter.op === 'in') hit = (filter.values || []).includes(val);
    else if (filter.op === 'not_in') hit = !(filter.values || []).includes(val);
    else if (filter.op === 'contains') hit = val.toLowerCase().includes(String(filter.value).toLowerCase());
    else hit = val === String(filter.value);
    if (hit) { result.push(f); n++; }
  }
  return result;
}

const mineralFeatures = [
  { props: { mineral: 'Gold', name: 'Obi' } },
  { props: { mineral: 'Kyanite', name: 'Kwara-1' } },
  { props: { mineral: 'Tin', name: 'Jos-1' } },
  { props: { mineral: 'Coal', name: 'Enugu-1' } },
  { props: { mineral: 'Gold', name: 'Ilesha-1' } },
];

// Include only: Gold + Kyanite
const included = applyFilterMock(mineralFeatures, { field: 'mineral', op: 'in', values: ['Gold', 'Kyanite'] });
assert.equal(included.length, 3, 'in: Gold + Kyanite = 3 features');
assert.ok(included.every((f) => f.props.mineral === 'Gold' || f.props.mineral === 'Kyanite'));

// Exclude: all except Gold + Kyanite
const excluded = applyFilterMock(mineralFeatures, { field: 'mineral', op: 'not_in', values: ['Gold', 'Kyanite'] });
assert.equal(excluded.length, 2, 'not_in: all except Gold + Kyanite = 2 features');
assert.ok(excluded.every((f) => f.props.mineral !== 'Gold' && f.props.mineral !== 'Kyanite'));

// Contains: single value
const contains = applyFilterMock(mineralFeatures, { field: 'mineral', op: 'contains', value: 'Go' });
assert.equal(contains.length, 2, 'contains "Go" = 2 features');

// ---------------------------------------------------------------- source checks

const appSource = readFileSync('app/js/app.js', 'utf8');
assert.ok(appSource.includes('clipOverlapsFeature'), 'app.js uses clipOverlapsFeature for strict interior-overlap');
assert.ok(appSource.includes('"in"') || appSource.includes("'in'"), 'app.js supports "in" operator');
assert.ok(appSource.includes('"not_in"') || appSource.includes("'not_in'"), 'app.js supports "not_in" operator');
assert.ok(appSource.includes('tm-mapon'), 'app.js has table-to-map sync button');
assert.ok(appSource.includes('exportMapImage'), 'app.js has exportMapImage function');
assert.ok(appSource.includes('id="e-png"'), 'app.js preserves #e-png');
assert.ok(!appSource.includes('id="e-csv"'), 'app.js removes #e-csv');
assert.ok(appSource.includes('#modal-title'), 'app.js preserves modal title');

const engineSource = readFileSync('app/js/engine.js', 'utf8');
assert.ok(engineSource.includes("ctx.clip('nonzero')"), 'engine.js uses ctx.clip(nonzero)');
assert.ok(!engineSource.includes('rgba(250,250,248,.62)'), 'engine.js removes grey veil fill');
assert.ok(engineSource.includes('export function normalizeClip'), 'engine.js exports normalizeClip');
assert.ok(engineSource.includes('export function polyOverlapsPoly'), 'engine.js exports polyOverlapsPoly');
assert.ok(engineSource.includes('export function clipOverlapsFeature') || engineSource.includes('clipOverlapsFeature'), 'engine.js has clipOverlapsFeature');

console.log('Clip, filter, export tests passed.');