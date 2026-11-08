import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { createLoadScheduler } from '../app/js/loading.js';

const schedule = createLoadScheduler(2);
let active = 0;
let maximum = 0;
const jobs = [24, 4, 16, 2, 8, 1].map((delay, index) => schedule(() => new Promise((resolve) => {
  active++;
  maximum = Math.max(maximum, active);
  setTimeout(() => {
    active--;
    resolve(index);
  }, delay);
})));
assert.deepEqual(await Promise.all(jobs), [0, 1, 2, 3, 4, 5]);
assert.equal(maximum, 2, 'scheduler must allow two but never more than two active loads');
await assert.rejects(schedule(() => { throw new Error('expected failure'); }), /expected failure/);
assert.equal(await schedule(() => 42), 42, 'a failed job must not block the queue');
assert.throws(() => createLoadScheduler(0), RangeError);

const messages = [];
globalThis.self = {
  postMessage(message, transfer) { messages.push({ message, transfer }); },
};
await import('../app/js/vector-worker.js');

const collection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', id: 'ngmap:state:01', properties: { admin_id: 'ngmap:state:01', category: 'A' }, geometry: { type: 'Point', coordinates: [7.4, 9.1] } },
    { type: 'Feature', properties: { category: 'B' }, geometry: { type: 'LineString', coordinates: [[2, 4], [3, 5], [4, 6]] } },
    { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[2, 4], [3, 4], [3, 5], [2, 4]]] } },
    { type: 'Feature', properties: { category: 'ignored' }, geometry: null },
  ],
};
const style = { mode: 'category', field: 'category', colors: { A: '#ff0000', B: '#0000ff' }, color: '#7a7a7a' };

globalThis.fetch = async (url) => {
  assert.equal(url, 'data/sample.geojson.gz');
  return new Response(gzipSync(Buffer.from(JSON.stringify(collection))), { status: 200 });
};
await self.onmessage({ data: { url: 'data/sample.geojson.gz', encoding: 'gzip', style } });
assert.equal(messages.length, 1);
const { message, transfer } = messages.pop();
assert.equal(message.error, undefined);
assert.equal(message.features.length, 3);
assert.equal(message.features[0].props.admin_id, 'ngmap:state:01');
assert.equal(message.features[0].fill, '#ff0000');
assert.equal(message.features[1].stroke, '#0000ff');
assert.equal(message.features[2].fill, '#9aa0a6');
assert.deepEqual(message.features.map((feature) => feature.idx), [0, 1, 2]);
assert.ok(message.features[0].parts instanceof Float64Array);
assert.ok(message.features[1].parts[0] instanceof Float64Array);
assert.ok(message.features[2].parts[0][0] instanceof Float64Array);
assert.ok(Math.abs(message.features[0].parts[0] - (7.4 + 180) / 360) < 1e-12);
assert.ok(transfer.includes(message.features[0].parts.buffer));
assert.ok(transfer.includes(message.features[1].parts[0].buffer));

messages.length = 0;
globalThis.fetch = async () => new Response(JSON.stringify(collection), { status: 200 });
await self.onmessage({ data: { url: 'data/sample.geojson', encoding: null, style } });
assert.equal(messages[0].message.features.length, 3, 'uncompressed fallback must use the same conversion');

messages.length = 0;
globalThis.fetch = async () => new Response('missing', { status: 404 });
await self.onmessage({ data: { url: 'data/missing.geojson', encoding: null, style } });
assert.match(messages[0].message.error, /404/);

console.log('JavaScript loading scheduler and vector worker tests passed.');
