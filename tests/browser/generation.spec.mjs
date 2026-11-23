import { test, expect } from '@playwright/test';
import { blockThirdParty, bootMap, capturePageErrors } from './helpers.mjs';

const DRAWN = 'Drawn on the map. The original layer is unchanged.';

function merc(lon, lat) {
  const λ = lon * Math.PI / 180;
  const φ = lat * Math.PI / 180;
  return [(λ + Math.PI) / (2 * Math.PI), (1 - Math.log(Math.tan(Math.PI / 4 + φ / 2)) / Math.PI) / 2];
}
function unLon(x) { return x * 360 - 180; }
function unLat(y) {
  const n = Math.PI - 2 * Math.PI * y;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}
function hav(a, b) {
  const R = 6371.0088;
  const rad = Math.PI / 180;
  const dLa = (b[1] - a[1]) * rad;
  const dLo = (b[0] - a[0]) * rad;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

async function openTool(page, id) {
  await page.evaluate((tool) => document.querySelector(`[data-tool="${tool}"]`)?.click(), id);
  await expect(page.locator('#modal.modal-map')).toBeVisible();
}

function takeErrors(errors, label) {
  const got = errors.splice(0, errors.length);
  expect(got, label).toEqual([]);
}

test('generation tools draw the shape they name', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await blockThirdParty(page);
  await bootMap(page);
  await page.locator('.tab[data-tab="tools"]').click();
  await expect(page.locator('[data-tool="fishnet"]')).toContainText('Kilometre cells');
  await expect(page.locator('[data-tool="hexbin"]')).toContainText('hexagon');
  await expect(page.locator('[data-tool="randomraster"]')).toContainText('not a measurement');

  await page.evaluate(() => window.__nwg.map.setView(7.05, 6.05, 12));
  await openTool(page, 'fishnet');
  await page.locator('#fn-size').fill('5');
  await page.locator('#fn-run').click();
  await expect(page.locator('#modal.modal-map')).toBeVisible();
  await expect(page.locator('#fn-size')).toBeVisible();
  await expect(page.locator('[data-net-result]')).toContainText(DRAWN);
  await expect(page.locator('[data-net-result]')).toContainText('5');
  const grid = await page.evaluate(() => {
    const layer = window.__nwg.analysisLayers.at(-1);
    const ring = layer?.features?.[0]?.parts?.[0]?.[0];
    return { kind: layer?.kind, n: layer?.features?.length || 0, ring: ring ? Array.from(ring).slice(0, 8) : [] };
  });
  expect(grid.kind).toBe('polygon');
  expect(grid.n).toBeGreaterThan(0);
  expect(grid.ring[0]).toBeLessThan(2);
  const southWest = [unLon(grid.ring[4]), unLat(grid.ring[5])];
  const southEast = [unLon(grid.ring[2]), unLat(grid.ring[3])];
  const width = hav(southWest, southEast);
  expect(width).toBeGreaterThan(4);
  expect(width).toBeLessThan(6);
  takeErrors(errors, 'fishnet');

  await page.evaluate(() => {
    const x = (lon) => (lon + 180) / 360;
    const y = (lat) => {
      const s = Math.sin(Math.max(-85, Math.min(85, lat)) * Math.PI / 180);
      return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
    };
    window.__nwg.map.setView(10, 10, 8);
    window.__nwg.setFocus({ type: 'rect', wb: [x(7), y(6.08), x(7.08), y(6)] }, false);
  });
  await openTool(page, 'fishnet');
  await page.locator('#fn-size').fill('4');
  await page.locator('#fn-run').click();
  await expect(page.locator('[data-net-result]')).toContainText('focus area');
  const focused = await page.evaluate(() => {
    const layer = window.__nwg.analysisLayers.at(-1);
    const lons = (layer?.features || []).map((f) => f.parts[0][0][0] * 360 - 180);
    return { n: lons.length, min: Math.min(...lons), max: Math.max(...lons) };
  });
  expect(focused.n).toBeGreaterThan(0);
  expect(focused.min).toBeGreaterThan(6.5);
  expect(focused.max).toBeLessThan(8);
  await page.evaluate(() => window.__nwg.setFocus(null, false));
  takeErrors(errors, 'focus grid');

  await page.evaluate(() => window.__nwg.map.setView(7.05, 6.05, 12));
  await openTool(page, 'randompts');
  await page.locator('#rp-count').fill('20');
  await page.locator('#rp-run').click();
  await expect(page.locator('[data-net-result]')).toContainText('20');
  const points = await page.evaluate(() => {
    const layer = window.__nwg.analysisLayers.at(-1);
    const xs = (layer?.features || []).map((f) => f.parts[0]);
    return { kind: layer?.kind, n: layer?.features?.length || 0, mercator: xs.every((x) => x > 0 && x < 1) };
  });
  expect(points.kind).toBe('point');
  expect(points.n).toBe(20);
  expect(points.mercator).toBe(true);
  takeErrors(errors, 'points');

  await openTool(page, 'randomlines');
  await page.locator('#rl-count').fill('3');
  await page.locator('#rl-verts').fill('4');
  await page.locator('#rl-step').fill('2');
  await page.locator('#rl-run').click();
  await expect(page.locator('#modal.modal-map')).toBeVisible();
  await expect(page.locator('[data-net-result]')).toContainText('km');
  const lines = await page.evaluate(() => {
    const layer = window.__nwg.analysisLayers.at(-1);
    const part = layer?.features?.[0]?.parts?.[0];
    return { kind: layer?.kind, n: layer?.features?.length || 0, verts: part ? part.length / 2 : 0, x: part?.[0] };
  });
  expect(lines.kind).toBe('line');
  expect(lines.n).toBe(3);
  expect(lines.verts).toBeGreaterThanOrEqual(2);
  expect(lines.x).toBeGreaterThan(0);
  expect(lines.x).toBeLessThan(1);
  takeErrors(errors, 'lines');

  await openTool(page, 'randompolygons');
  await page.locator('#rpoly-count').fill('3');
  await page.locator('#rpoly-verts').fill('5');
  await page.locator('#rpoly-width').fill('3');
  await page.locator('#rpoly-run').click();
  await expect(page.locator('[data-net-result]')).toContainText(DRAWN);
  const polys = await page.evaluate(() => {
    const layer = window.__nwg.analysisLayers.at(-1);
    const ring = layer?.features?.[0]?.parts?.[0]?.[0];
    return { kind: layer?.kind, n: layer?.features?.length || 0, corners: ring ? ring.length : 0, x: ring?.[0] };
  });
  expect(polys.kind).toBe('polygon');
  expect(polys.n).toBe(3);
  expect(polys.corners).toBeGreaterThanOrEqual(10);
  expect(polys.x).toBeGreaterThan(0);
  expect(polys.x).toBeLessThan(1);
  takeErrors(errors, 'polygons');

  const near = merc(7, 6);
  const beside = merc(7.001, 6.001);
  const away = merc(7.08, 6);
  await page.evaluate(({ near, beside, away }) => {
    window.__nwg.clearAnalysisLayers();
    const bb = (flat) => [Math.min(flat[0], flat[2] || flat[0]), Math.min(flat[1], flat[3] || flat[1]), Math.max(flat[0], flat[2] || flat[0]), Math.max(flat[1], flat[3] || flat[1])];
    const pt = (flat, name, idx) => ({ type: 'point', hidden: false, parts: flat, bb: bb(flat), props: { name }, fill: '#0b6b45', idx });
    const features = [pt(near, 'Near', 0), pt(beside, 'Beside', 1), pt(away, 'Away', 2)];
    const obj = { id: 'gen_pt', kind: 'point', visible: true, opacity: 1, order: 9, features, labels: null };
    window.__nwg.L.set('gen_pt', { meta: { id: 'gen_pt', label: 'Generation points', kind: 'point', fields: [{ name: 'name', label: 'Name' }] }, on: true, obj });
    window.__nwg.stack.push('gen_pt');
    window.__nwg.map.addLayer(obj);
    window.__nwg.__genX = features[0].parts[0];
  }, { near, beside, away });
  await openTool(page, 'hexbin');
  await page.locator('#hx-layer').selectOption('gen_pt');
  await page.locator('#hx-size').fill('2');
  await page.locator('#hx-run').click();
  await expect(page.locator('[data-net-result]')).toContainText(DRAWN);
  await expect(page.locator('[data-net-result]')).toContainText('2');
  const hex = await page.evaluate(() => {
    const layer = window.__nwg.analysisLayers.at(-1);
    const src = window.__nwg.L.get('gen_pt').obj.features[0];
    const counts = (layer?.features || []).map((f) => f.props.points);
    return {
      kind: layer?.kind,
      n: counts.length,
      max: Math.max(...counts),
      corners: layer?.features?.[0]?.parts?.[0]?.[0]?.length || 0,
      source: src.parts[0],
      hidden: src.hidden,
    };
  });
  expect(hex.kind).toBe('polygon');
  expect(hex.n).toBe(2);
  expect(hex.max).toBe(2);
  expect(hex.corners).toBeGreaterThanOrEqual(12);
  expect(hex.source).toBe(await page.evaluate(() => window.__nwg.__genX));
  expect(hex.hidden).toBe(false);
  takeErrors(errors, 'hex');

  await page.evaluate(() => {
    const line = (i) => {
      const x = 0.52 + i * 0.002;
      const flat = [x, 0.48, x + 0.001, 0.481, x + 0.002, 0.48];
      return { type: 'line', hidden: false, parts: [flat], bb: [x, 0.48, x + 0.002, 0.481], props: { name: 'Line ' + (i + 1) }, stroke: '#a83232', idx: i };
    };
    const features = [0, 1, 2, 3].map(line);
    const obj = { id: 'gen_line', kind: 'line', visible: true, opacity: 1, order: 9, features, labels: null };
    window.__nwg.L.set('gen_line', { meta: { id: 'gen_line', label: 'Generation lines', kind: 'line', fields: [{ name: 'name', label: 'Name' }] }, on: true, obj });
    window.__nwg.stack.push('gen_line');
    window.__nwg.map.addLayer(obj);
  });
  await openTool(page, 'randomsample');
  await page.locator('#rs-layer').selectOption('gen_line');
  await page.locator('#rs-n').fill('2');
  await page.locator('#rs-run').click();
  await expect(page.locator('[data-net-result]')).toContainText(DRAWN);
  const sample = await page.evaluate(() => {
    const src = window.__nwg.L.get('gen_line').obj.features;
    const drawn = window.__nwg.analysisLayers.at(-1);
    const srcParts = src.flatMap((f) => f.parts);
    const drawnParts = (drawn?.features || []).flatMap((f) => f.parts);
    return {
      kind: drawn?.kind,
      drawn: drawn?.features?.length || 0,
      source: src.length,
      hidden: src.some((f) => f.hidden),
      shared: drawnParts.some((part) => srcParts.includes(part)),
    };
  });
  expect(sample.kind).toBe('line');
  expect(sample.drawn).toBe(2);
  expect(sample.source).toBe(4);
  expect(sample.hidden).toBe(false);
  expect(sample.shared).toBe(false);
  takeErrors(errors, 'sample');

  await openTool(page, 'randomraster');
  await page.locator('#rr-w').fill('6');
  await page.locator('#rr-h').fill('4');
  await page.locator('#rr-min').fill('2');
  await page.locator('#rr-max').fill('9');
  await page.locator('#rr-run').click();
  await expect(page.locator('#modal.modal-map')).toBeVisible();
  await expect(page.locator('#rr-out')).toContainText('Not a measurement');
  const raster = await page.evaluate(() => {
    const layer = window.__nwg.analysisLayers.at(-1);
    const values = layer?.vals?.data ? Array.from(layer.vals.data) : [];
    const fake = [...window.__nwg.L.keys()].some((id) => String(id).startsWith('random-raster'));
    return { kind: layer?.kind, n: values.length, min: Math.min(...values), max: Math.max(...values), fake, x: layer?.wb?.[0] };
  });
  expect(raster.kind).toBe('raster');
  expect(raster.n).toBe(24);
  expect(raster.min).toBeGreaterThanOrEqual(2);
  expect(raster.max).toBeLessThanOrEqual(9);
  expect(raster.fake).toBe(false);
  expect(raster.x).toBeGreaterThan(0);
  expect(raster.x).toBeLessThan(1);
  takeErrors(errors, 'raster');
});
