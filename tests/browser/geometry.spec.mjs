import { test, expect } from '@playwright/test';
import { blockThirdParty, bootMap, capturePageErrors } from './helpers.mjs';

const DRAWN = 'Drawn on the map. The original layer is unchanged.';
const PANEL = 'This stays in the panel. It does not draw a layer.';

function square(x0, y0, x1, y1) {
  return [x0, y1, x1, y1, x1, y0, x0, y0, x0, y1];
}

async function openTool(page, id) {
  await page.evaluate((tool) => document.querySelector(`[data-tool="${tool}"]`)?.click(), id);
  await expect(page.locator('#modal.modal-map')).toBeVisible();
}

function takeErrors(errors, label) {
  const got = errors.splice(0, errors.length);
  expect(got, label).toEqual([]);
}

test('geometry tools draw a new shape or keep a measurement in the panel', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await blockThirdParty(page);
  await bootMap(page);
  await page.locator('.tab[data-tab="tools"]').click();

  await page.evaluate(({ ring, hole, line, cutter, gap }) => {
    window.__nwg.selClear();
    window.__nwg.setFocus(null, false);
    window.__nwg.clearAnalysisLayers();
    const add = (id, label, kind, features) => {
      const obj = { id, kind, visible: true, opacity: 1, order: 8, features, labels: null };
      window.__nwg.L.set(id, { meta: { id, label, kind, fields: [{ name: 'name', label: 'Name' }] }, on: true, obj });
      window.__nwg.stack.push(id);
      window.__nwg.map.addLayer(obj);
    };
    const poly = (parts, name, idx) => ({
      type: 'poly', hidden: false, parts, bb: [0.5, 0.45, 0.62, 0.55],
      props: { name }, fill: '#3366cc', stroke: '#3366cc', idx,
    });
    add('syn_poly', 'Synthetic polygons', 'polygon', [
      poly([[ring, hole]], 'Holed', 0),
      poly([[gap]], 'Apart', 1),
    ]);
    add('syn_line', 'Synthetic lines', 'line', [{
      type: 'line', hidden: false, parts: [line], bb: [0.5, 0.5, 0.62, 0.5],
      props: { name: 'East' }, stroke: '#0b6b45', idx: 0,
    }]);
    add('syn_cut', 'Synthetic cut', 'line', [{
      type: 'line', hidden: false, parts: [cutter], bb: [0.55, 0.44, 0.55, 0.56],
      props: { name: 'Cut' }, stroke: '#a83232', idx: 0,
    }]);
    const source = window.__nwg.L.get('syn_poly').obj.features[0];
    source.parts[0][0] = Float64Array.from(source.parts[0][0]);
    window.__nwg.__geomSource = source.parts[0][0][0];
  }, {
    ring: square(0.50, 0.46, 0.60, 0.54),
    hole: square(0.53, 0.49, 0.55, 0.51),
    gap: square(0.64, 0.46, 0.66, 0.48),
    line: [0.50, 0.50, 0.62, 0.50],
    cutter: [0.55, 0.44, 0.55, 0.56],
  });

  await expect(page.locator('[data-tool="centroid"]')).toContainText('Area centre');
  await expect(page.locator('[data-tool="areaperim"]')).toContainText('holes subtracted');
  await expect(page.locator('[data-tool="linelenstats"]')).toContainText('in the panel');

  await openTool(page, 'centroid');
  await page.locator('#ct-layer').selectOption('syn_poly');
  await page.locator('#ct-run').click();
  await expect(page.locator('#modal')).toContainText(DRAWN);
  const centroid = await page.evaluate(() => {
    const layer = window.__nwg.analysisLayers[0];
    const src = window.__nwg.L.get('syn_poly').obj.features[0];
    return { kind: layer.kind, n: layer.features.length, flat: layer.features[0].parts.length, source: src.parts[0][0][0] };
  });
  expect(centroid.kind).toBe('point');
  expect(centroid.n).toBe(2);
  expect(centroid.flat).toBe(2);
  expect(centroid.source).toBe(await page.evaluate(() => window.__nwg.__geomSource));
  takeErrors(errors, 'centroid');

  await openTool(page, 'splitpoly');
  await page.locator('#sp-poly').selectOption('syn_poly');
  await page.locator('#sp-line').selectOption('syn_cut');
  await page.locator('#sp-run').click();
  await expect(page.locator('#modal')).toContainText(DRAWN);
  const split = await page.evaluate(() => {
    const feats = window.__nwg.analysisLayers[0].features;
    return { n: feats.length, rings: feats.every((f) => f.parts[0][0].length >= 8), cut: feats.filter((f) => f.props.split === 'yes').length };
  });
  expect(split.n).toBeGreaterThanOrEqual(3);
  expect(split.rings).toBe(true);
  expect(split.cut).toBeGreaterThanOrEqual(2);
  takeErrors(errors, 'split');

  await page.evaluate(() => window.__nwg.clearAnalysisLayers());
  await openTool(page, 'areaperim');
  await page.locator('#ap-layer').selectOption('syn_poly');
  await page.locator('#ap-run').click();
  await expect(page.locator('#ap-out')).toContainText(PANEL);
  const area = await page.evaluate(() => window.__nwg.analysisLayers.length);
  expect(area).toBe(0);
  takeErrors(errors, 'area');

  await openTool(page, 'linelenstats');
  await page.locator('#lls-layer').selectOption('syn_line');
  await page.locator('#lls-run').click();
  await expect(page.locator('#lls-out')).toContainText(PANEL);
  await expect(page.locator('#lls-out')).toContainText('total km');
  takeErrors(errors, 'length');

  await openTool(page, 'lineoffset');
  await page.locator('#lo-layer').selectOption('syn_line');
  await page.locator('#lo-dist').fill('10');
  await page.locator('#lo-side').selectOption('left');
  await page.locator('#lo-run').click();
  await expect(page.locator('#modal')).toContainText(DRAWN);
  const offset = await page.evaluate(() => {
    const src = window.__nwg.L.get('syn_line').obj.features[0].parts[0];
    const copy = window.__nwg.analysisLayers[0].features[0].parts[0];
    return { kind: window.__nwg.analysisLayers[0].kind, moved: copy[1] !== src[1], source: src[1] };
  });
  expect(offset.kind).toBe('line');
  expect(offset.moved).toBe(true);
  takeErrors(errors, 'offset');

  await openTool(page, 'polyadjacency');
  await page.locator('#pa-layer').selectOption('syn_poly');
  await page.locator('#pa-run').click();
  await expect(page.locator('#pa-out')).toContainText(PANEL);
  await expect(page.locator('#pa-out')).toContainText('No shared border');
  takeErrors(errors, 'adjacency');
});
