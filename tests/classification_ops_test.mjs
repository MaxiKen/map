import assert from 'node:assert/strict';
import { classIndex, classifyValues } from '../app/js/engine.js';

function ssd(values, edges) {
  const groups = edges.slice(0, -1).map(() => []);
  for (const value of values) groups[classIndex(value, edges)].push(value);
  let score = 0;
  for (const group of groups) {
    if (!group.length) continue;
    const mean = group.reduce((a, b) => a + b, 0) / group.length;
    for (const value of group) score += (value - mean) ** 2;
  }
  return score;
}
function bruteJenks(values, n) {
  const sorted = values.slice().sort((a, b) => a - b);
  const unique = [...new Set(sorted)];
  let best = Infinity;
  const cuts = [];
  function walk(start, left) {
    if (left === 1) {
      const edges = [unique[0]];
      for (const cut of cuts) edges.push(unique[cut]);
      edges.push(unique[unique.length - 1]);
      best = Math.min(best, ssd(sorted, edges));
      return;
    }
    for (let end = start; end <= unique.length - left; end++) {
      cuts.push(end);
      walk(end + 1, left - 1);
      cuts.pop();
    }
  }
  walk(0, n);
  return best;
}

const gapped = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 50, 51, 52, 100];
const jenks = classifyValues(gapped, 3, 'jenks');
const quantile = classifyValues(gapped, 4, 'quantile');
const equal = classifyValues(gapped, 4, 'equal');
assert.equal(jenks.n, 3);
assert.equal(jenks.classes.reduce((s, c) => s + c.count, 0), gapped.length);
assert.ok(Math.abs(ssd(gapped, jenks.edges) - bruteJenks(gapped, 3)) < 1e-6, 'Jenks is the minimum-variance partition');
assert.ok(ssd(gapped, jenks.edges) <= ssd(gapped, classifyValues(gapped, 3, 'quantile').edges));
assert.notDeepEqual(jenks.edges, classifyValues(gapped, 3, 'quantile').edges, 'Jenks is not equal-count');
const tight = [1, 1.2, 1.4, 2, 2.2, 2.4, 100, 100.2];
const tightJenks = classifyValues(tight, 3, 'jenks');
const tightEqual = classifyValues(tight, 3, 'interval');
assert.ok(ssd(tight, tightJenks.edges) < ssd(tight, tightEqual.edges), 'Jenks follows the gaps equal widths miss');
assert.equal(tightJenks.classes.filter((c) => c.count).length, 3);

assert.equal(quantile.classes.map((c) => c.count).join(','), '4,4,4,4');
assert.deepEqual(classifyValues([1, 1, 1, 1, 5, 5, 9], 3, 'quantile').classes.map((c) => c.count), [4, 2, 1]);

assert.equal(equal.n, 4);
assert.equal(equal.edges[0], 1);
assert.equal(equal.edges[equal.edges.length - 1], 100);
const width = equal.edges[1] - equal.edges[0];
for (let i = 1; i < equal.edges.length - 1; i++) assert.ok(Math.abs((equal.edges[i + 1] - equal.edges[i]) - width) < 1e-9);

const same = classifyValues([4, 4, 4, 4], 5, 'jenks');
assert.equal(same.n, 1, 'fewer distinct values are not padded with empty classes');
assert.equal(same.classes[0].count, 4);
assert.equal(classifyValues([1, 2, 3], 9, 'equal').n, 3);
assert.equal(classifyValues([], 5, 'jenks').n, 0);
assert.equal(classIndex(5, [1, 5, 10, 20]), 0);
assert.equal(classIndex(5.1, [1, 5, 10, 20]), 1);
assert.equal(classIndex(20, [1, 5, 10, 20]), 2);

console.log('classification ops ok');
