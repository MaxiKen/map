import { test, expect } from '@playwright/test';
import { blockThirdParty, bootMap, capturePageErrors } from './helpers.mjs';

const DRAWN = 'Drawn on the map. The original layer is unchanged.';
const PANEL = 'This stays in the panel. It does not draw a layer and does not change the source.';

function line(coords) {
  const flat = [];
  for (const [lon, lat] of coords) {
    const λ = lon * Math.PI / 180;
    const φ = lat * Math.PI / 180;
    flat.push((λ + Math.PI) / (2 * Math.PI), (1 - Math.log(Math.tan(Math.PI / 4 + φ / 2)) / Math.PI) / 2);
  }
  return flat;
}

async function openTool(page, id) {
  await page.evaluate((tool) => document.querySelector(`[data-tool="${tool}"]`)?.click(), id);
  await expect(page.locator('#modal.modal-map')).toBeVisible();
}

function takeErrors(errors, label) {
  const got = errors.splice(0, errors.length);
  expect(got, label).toEqual([]);
}

test('network tools follow the lines and leave the source', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await blockThirdParty(page);
  await bootMap(page);
  await page.locator('.tab[data-tab="tools"]').click();

  const east = line([[7, 6], [7.1, 6]]);
  const north = line([[7.1, 6], [7.1, 6.1]]);
  const apart = line([[8, 6], [8.1, 6]]);
  await page.evaluate(({ east, north, apart }) => {
    window.__nwg.selClear();
    window.__nwg.setFocus(null, false);
    window.__nwg.clearAnalysisLayers();
    const bb = (flat) => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < flat.length; i += 2) {
        x0 = Math.min(x0, flat[i]); x1 = Math.max(x1, flat[i]);
        y0 = Math.min(y0, flat[i + 1]); y1 = Math.max(y1, flat[i + 1]);
      }
      return [x0, y0, x1, y1];
    };
    const feat = (flat, name, idx) => ({ type: 'line', hidden: false, parts: [flat], bb: bb(flat), props: { name }, stroke: '#a83232', idx });
    const features = [feat(east, 'East', 0), feat(north, 'North', 1), feat(apart, 'Apart', 2)];
    const obj = { id: 'net_line', kind: 'line', visible: true, opacity: 1, order: 9, features, labels: null };
    window.__nwg.L.set('net_line', { meta: { id: 'net_line', label: 'Network lines', kind: 'line', fields: [{ name: 'name', label: 'Name' }] }, on: true, obj });
    window.__nwg.stack.push('net_line');
    window.__nwg.map.addLayer(obj);
    const start = { type: 'point', hidden: false, parts: [east[0], east[1]], bb: [east[0], east[1], east[0], east[1]], props: { name: 'Start' }, fill: '#0b6b45', idx: 0 };
    const mid = { type: 'point', hidden: false, parts: [east[2], east[3]], bb: [east[2], east[3], east[2], east[3]], props: { name: 'Corner' }, fill: '#0b6b45', idx: 1 };
    const end = { type: 'point', hidden: false, parts: [north[2], north[3]], bb: [north[2], north[3], north[2], north[3]], props: { name: 'End' }, fill: '#0b6b45', idx: 2 };
    const off = { type: 'point', hidden: false, parts: [0.2, 0.2], bb: [0.2, 0.2, 0.2, 0.2], props: { name: 'Off' }, fill: '#888', idx: 3 };
    const pts = { id: 'net_pt', kind: 'point', visible: true, opacity: 1, order: 10, features: [start, mid, end, off], labels: null };
    window.__nwg.L.set('net_pt', { meta: { id: 'net_pt', label: 'Network stops', kind: 'point', fields: [{ name: 'name', label: 'Name' }] }, on: true, obj: pts });
    window.__nwg.stack.push('net_pt');
    window.__nwg.map.addLayer(pts);
    window.__nwg.__netX = features[0].parts[0][0];
    window.__nwg.__netHidden = features[0].hidden;
    window.__nwg.map.fitBounds([[6.9, 5.9], [7.2, 6.2]], 40);
  }, { east, north, apart });

  await expect(page.locator('[data-tool="shortestpath"]')).toContainText('Along the lines');
  await expect(page.locator('[data-tool="networkbuffer"]')).toContainText('Along the lines');

  const tap = (lon, lat) => page.evaluate(({ lon, lat }) => {
    const λ = lon * Math.PI / 180;
    const φ = lat * Math.PI / 180;
    const x = (λ + Math.PI) / (2 * Math.PI);
    const y = (1 - Math.log(Math.tan(Math.PI / 4 + φ / 2)) / Math.PI) / 2;
    window.__nwg.tapMerc(x, y);
  }, { lon, lat });

  await openTool(page, 'shortestpath');
  await page.locator('#np-layer').selectOption('net_line');
  await page.locator('#np-pick-a').click();
  await tap(7, 6);
  await expect(page.locator('#np-start')).toHaveText('Set');
  await page.locator('#np-pick-b').click();
  await tap(7.1, 6.1);
  await expect(page.locator('#np-end')).toHaveText('Set');
  await page.locator('#np-run').click();
  await expect(page.locator('#modal.modal-map')).toBeVisible();
  await expect(page.locator('[data-net-result]')).toContainText(DRAWN);
  await expect(page.locator('[data-net-result]')).toContainText('East');
  const path = await page.evaluate(() => {
    const layer = window.__nwg.analysisLayers.at(-1);
    const src = window.__nwg.L.get('net_line').obj.features[0];
    const drawn = layer?.features?.[0];
    return {
      verts: drawn?.parts?.[0]?.length || 0,
      km: drawn?.props?.length_km || 0,
      sourceX: src.parts[0][0],
      hidden: src.hidden,
      layers: window.__nwg.analysisLayers.length,
    };
  });
  expect(path.verts).toBeGreaterThanOrEqual(6);
  expect(path.km).toBeGreaterThan(20);
  expect(path.sourceX).toBe(await page.evaluate(() => window.__nwg.__netX));
  expect(path.hidden).toBe(false);
  expect(path.layers).toBe(1);
  takeErrors(errors, 'path');

  await openTool(page, 'servicearea');
  await page.locator('#sa-layer').selectOption('net_line');
  await page.locator('#sa-dist').fill('5');
  await page.locator('#sa-pick').click();
  await tap(7, 6);
  await page.locator('#sa-run').click();
  await expect(page.locator('[data-net-result]')).toContainText('not a circle');
  const reach = await page.evaluate(() => {
    const drawn = window.__nwg.analysisLayers.at(-1);
    return { kind: drawn?.kind, km: drawn?.features?.[0]?.props?.length_km || 0, n: drawn?.features?.length || 0 };
  });
  expect(reach.kind).toBe('line');
  expect(reach.km).toBeGreaterThan(4);
  expect(reach.km).toBeLessThan(6);
  takeErrors(errors, 'service');

  await openTool(page, 'networkbuffer');
  await page.locator('#nb-net').selectOption('net_line');
  await page.locator('#nb-pts').selectOption('net_pt');
  await page.locator('#nb-dist').fill('5');
  await page.locator('#nb-run').click();
  await expect(page.locator('[data-net-result]')).toContainText('not a circle');
  await expect(page.locator('[data-net-result]')).toContainText('Off');
  const buffer = await page.evaluate(() => window.__nwg.analysisLayers.at(-1)?.kind);
  expect(buffer).toBe('line');
  takeErrors(errors, 'buffer');

  await openTool(page, 'networkconnect');
  await page.locator('#nc-layer').selectOption('net_line');
  await page.locator('#nc-run').click();
  await expect(page.locator('#nc-out')).toContainText(PANEL);
  await expect(page.locator('#nc-out')).toContainText('2');
  const connectDrawn = await page.evaluate(() => window.__nwg.analysisLayers.length);
  expect(connectDrawn).toBe(0);
  takeErrors(errors, 'connect');

  await openTool(page, 'linebearing');
  await page.locator('#lb-layer').selectOption('net_line');
  await page.locator('#lb-run').click();
  await expect(page.locator('#lb-out')).toContainText(PANEL);
  await expect(page.locator('#lb-out')).toContainText('E');
  takeErrors(errors, 'bearing');

  await openTool(page, 'distancematrix');
  await page.locator('#dm-layer').selectOption('net_pt');
  await page.locator('#dm-run').click();
  await expect(page.locator('#dm-out')).toContainText(PANEL);
  await expect(page.locator('#dm-out')).toContainText('straight-line');
  await expect(page.locator('#dm-out')).toContainText('Start');
  await expect(page.locator('#dm-out')).toContainText('End');
  takeErrors(errors, 'matrix');

  await openTool(page, 'linemerge');
  await page.locator('#lm-layer').selectOption('net_line');
  await page.locator('#lm-run').click();
  await expect(page.locator('[data-net-result]')).toContainText(DRAWN);
  const merged = await page.evaluate(() => {
    const layer = window.__nwg.analysisLayers.at(-1);
    const src = window.__nwg.L.get('net_line').obj.features[0];
    return { drawn: layer?.features?.length || 0, sourceParts: src.parts.length, hidden: src.hidden };
  });
  expect(merged.drawn).toBe(2);
  expect(merged.sourceParts).toBe(1);
  expect(merged.hidden).toBe(false);
  takeErrors(errors, 'merge');
});
