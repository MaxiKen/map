import assert from 'node:assert/strict';
import {
  mercX, mercY, haversineKm, compassBearing, lineBearingSummary,
  buildLineNetwork, networkPath, networkReach, networkTrace, networkComponents,
  mergeLineChains, networkBetweenness,
} from '../app/js/engine.js';

function line(coords, name) {
  const flat = [];
  for (const [lon, lat] of coords) flat.push(mercX(lon), mercY(lat));
  const xs = flat.filter((_, i) => i % 2 === 0), ys = flat.filter((_, i) => i % 2 === 1);
  return { type: 'line', name, parts: [Float64Array.from(flat)], bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
}
function at(lon, lat) { return [mercX(lon), mercY(lat)]; }

const east = line([[7, 6], [7.1, 6]], 'East');
const north = line([[7.1, 6], [7.1, 6.1]], 'North');
const apart = line([[8, 6], [8.1, 6]], 'Apart');
const graph = buildLineNetwork([east, north, apart], 25);
assert.equal(graph.edges.length, 3);
const components = networkComponents(graph);
assert.equal(components.components, 2, 'a separated line is its own piece');
assert.equal(components.deadEnds, 4, 'dead ends are not extra pieces');

const bend = networkPath(graph, ...at(7, 6), ...at(7.1, 6.1), 1);
assert.equal(bend.ok, true);
assert.ok(bend.flat.length >= 6, 'the path follows the bend, not a straight join');
const straight = haversineKm([7, 6], [7.1, 6.1]);
const along = haversineKm([7, 6], [7.1, 6]) + haversineKm([7.1, 6], [7.1, 6.1]);
assert.ok(Math.abs(bend.km - along) < 0.05, 'path length is along the lines, got ' + bend.km + ' vs ' + along);
assert.ok(bend.km > straight + 1, 'the path is longer than the straight line');
assert.ok(bend.names.includes('East') && bend.names.includes('North'));

const missed = networkPath(graph, ...at(7, 6), ...at(8.1, 6), 1);
assert.equal(missed.reason, 'disconnected');
const far = networkPath(graph, ...at(7, 6), ...at(9, 9), 1);
assert.equal(far.reason, 'end-far');

const mid = line([[7, 6], [7.2, 6]], 'Long');
const midGraph = buildLineNetwork([mid], 25);
const midLen = haversineKm([7, 6], [7.2, 6]);
const partial = networkPath(midGraph, ...at(7.04, 6), ...at(7.16, 6), 2);
assert.equal(partial.ok, true);
assert.ok(Math.abs(partial.km - midLen * 0.6) < midLen * 0.08, 'a mid-edge path does not detour to the ends, got ' + partial.km);

const reach = networkReach(midGraph, [at(7, 6)], midLen * 0.4, 1);
assert.equal(reach.snapped, 1);
assert.ok(reach.reachedKm < midLen * 0.55 && reach.reachedKm > midLen * 0.3, 'reach stops at the distance, got ' + reach.reachedKm);
assert.ok(reach.lines.every((l) => l.flat.length >= 4));
const off = networkReach(midGraph, [at(8, 7)], 5, 1);
assert.equal(off.missed, 1);
assert.equal(off.lines.length, 0, 'a point off the line is not given a circle');

const traced = networkTrace(graph, ...at(7, 6), 'down', 1);
assert.ok(traced.km > along * 0.9, 'downstream follows both stored lines');
const back = networkTrace(graph, ...at(7, 6), 'up', 1);
assert.ok(back.km < 0.01, 'upstream from the start of the stored direction does not walk backward');
const fromEnd = networkTrace(graph, ...at(7.1, 6.1), 'down', 1);
assert.ok(fromEnd.km < 0.01, 'downstream stops at the stored end');

const chain = mergeLineChains([east, north], 25);
assert.equal(chain.input, 2);
assert.equal(chain.output, 1, 'two lines that meet end to end become one');
assert.equal(chain.joins, 1);
const tee = mergeLineChains([
  line([[7, 6], [7.1, 6]], 'A'),
  line([[7.1, 6], [7.2, 6]], 'B'),
  line([[7.1, 6], [7.1, 6.1]], 'C'),
], 25);
assert.equal(tee.output, 3, 'a junction of three lines is not merged');

const eastOnly = lineBearingSummary([east]);
assert.equal(eastOnly.dominant, 'E', 'an eastward line is east, not the mercator flip');
assert.ok(eastOnly.mean > 80 && eastOnly.mean < 100, 'mean ' + eastOnly.mean);
const northOnly = lineBearingSummary([line([[7, 6], [7, 6.1]], 'Up')]);
assert.equal(northOnly.dominant, 'N', 'north is increasing latitude, got ' + northOnly.dominant + ' ' + northOnly.mean);
assert.equal(compassBearing(7, 6, 7, 6.1) < 1 || compassBearing(7, 6, 7, 6.1) > 359, true);

const bridge = buildLineNetwork([
  line([[7, 6], [7.05, 6]], 'Left'),
  line([[7.05, 6], [7.1, 6]], 'Bridge'),
  line([[7.1, 6], [7.15, 6]], 'Right'),
], 25);
const rank = networkBetweenness(bridge, 400);
assert.equal(rank.exact, true);
const top = rank.rows[0];
assert.ok(top && top.junction.includes('Bridge'), 'the middle junction outranks a dead end, got ' + JSON.stringify(rank.rows));
assert.ok(!rank.rows.some((row) => row.junction === 'Left' && row.paths > top.paths));

console.log('network ops ok');
