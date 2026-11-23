import { test, expect } from '@playwright/test';
import { blockThirdParty, bootMap, capturePageErrors } from './helpers.mjs';

const DRAWN = 'Drawn on the map. The original layer is unchanged.';
const PANEL = 'This stays in the panel. It does not draw a layer and does not change the source.';

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

test('topology checks stay in the panel and edits draw a copy', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await blockThirdParty(page);
  await bootMap(page);
  await page.locator('.tab[data-tab="tools"]').click();

  const thick = 0.01;
  await page.evaluate(({ a, b, hole, frame, bow, point, multi }) => {
    window.__nwg.selClear();
    window.__nwg.setFocus(null, false);
    window.__nwg.clearAnalysisLayers();
    const bb = (flat) => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const walk = (v) => {
        if (typeof v === 'number') return;
        if (v.length && typeof v[0] === 'number') {
          for (let i = 0; i < v.length; i += 2) { x0 = Math.min(x0, v[i]); x1 = Math.max(x1, v[i]); y0 = Math.min(y0, v[i + 1]); y1 = Math.max(y1, v[i + 1]); }
        } else for (const c of v) walk(c);
      };
      walk(flat);
      return [x0, y0, x1, y1];
    };
    const add = (id, label, kind, features) => {
      const obj = { id, kind, visible: true, opacity: 1, order: 9, features, labels: null };
      window.__nwg.L.set(id, { meta: { id, label, kind, fields: [{ name: 'name', label: 'Name' }] }, on: true, obj });
      window.__nwg.stack.push(id);
      window.__nwg.map.addLayer(obj);
    };
    const poly = (parts, name, idx) => ({ type: 'poly', hidden: false, parts, bb: bb(parts), props: { name }, fill: '#3366cc', stroke: '#3366cc', idx });
    add('topo_poly', 'Topology polygons', 'polygon', [
      poly([[a]], 'Left', 0),
      poly([[b]], 'Right', 1),
      poly([[hole[0], hole[1]]], 'Donut', 2),
    ]);
    add('topo_frame', 'Topology frame', 'polygon', frame.map((ring, i) => poly([[ring]], 'Frame ' + i, i)));
    add('topo_line', 'Topology lines', 'line', [{
      type: 'line', hidden: false, parts: [bow], bb: bb([bow]), props: { name: 'Bow' }, stroke: '#a83232', idx: 0,
    }]);
    add('topo_pt', 'Topology points', 'point', [
      { type: 'point', hidden: false, parts: point, bb: bb([point]), props: { name: 'Inside' }, fill: '#0b6b45', idx: 0 },
      { type: 'point', hidden: false, parts: multi, bb: bb([multi]), props: { name: 'Pair' }, fill: '#0b6b45', idx: 1 },
    ]);
    const src = window.__nwg.L.get('topo_poly').obj.features[0];
    window.__nwg.__topoX = src.parts[0][0][0];
    window.__nwg.__topoHidden = src.hidden;
  }, {
    a: square(0.50, 0.50, 0.54, 0.54),
    b: square(0.52, 0.52, 0.56, 0.56),
    hole: [square(0.60, 0.50, 0.66, 0.56), square(0.62, 0.52, 0.64, 0.54)],
    frame: [
      square(0.70, 0.50, 0.78, 0.50 + thick),
      square(0.70, 0.58 - thick, 0.78, 0.58),
      square(0.70, 0.50, 0.70 + thick, 0.58),
      square(0.78 - thick, 0.50, 0.78, 0.58),
    ],
    bow: [0.40, 0.40, 0.44, 0.44, 0.40, 0.44, 0.44, 0.40],
    point: [0.52, 0.52],
    multi: [0.80, 0.50, 0.82, 0.52],
  });

  await expect(page.locator('[data-tool="checkgaps"]')).toContainText('not the outside');
  await expect(page.locator('[data-tool="removesmallpoly"]')).toContainText('at or above');

  await openTool(page, 'checkoverlap');
  await page.locator('#ov-layer').selectOption('topo_poly');
  await page.locator('#ov-run').click();
  await expect(page.locator('#ov-out')).toContainText(PANEL);
  await expect(page.locator('#ov-out')).toContainText('Left');
  await expect(page.locator('#ov-out')).toContainText('Right');
  const overlap = await page.evaluate(() => window.__nwg.analysisLayers.length);
  expect(overlap).toBe(0);
  takeErrors(errors, 'overlap');

  await openTool(page, 'checkgaps');
  await page.locator('#gp-layer').selectOption('topo_frame');
  await page.locator('#gp-run').click();
  await expect(page.locator('#gp-out')).toContainText(PANEL);
  await expect(page.locator('#gp-out')).toContainText('1');
  const gaps = await page.evaluate(() => document.querySelector('#gp-out')?.innerText || '');
  expect(gaps).not.toContain('Grid resolution');
  takeErrors(errors, 'gaps');

  await openTool(page, 'checkmultipart');
  await page.locator('#cmp-layer').selectOption('topo_pt');
  await page.locator('#cmp-run').click();
  await expect(page.locator('#cmp-out')).toContainText(PANEL);
  await expect(page.locator('#cmp-out')).toContainText('Pair');
  await expect(page.locator('#cmp-out')).not.toContainText('Inside');
  takeErrors(errors, 'multipart');

  await openTool(page, 'selfintersect');
  await page.locator('#si-layer').selectOption('topo_line');
  await page.locator('#si-run').click();
  await expect(page.locator('#si-out')).toContainText('Bow');
  takeErrors(errors, 'cross');

  await openTool(page, 'checknullgeom');
  await page.locator('#cng-layer').selectOption('topo_pt');
  await page.locator('#cng-run').click();
  await expect(page.locator('#cng-out')).toContainText('Every feature has coordinates.');
  takeErrors(errors, 'null');

  await openTool(page, 'spatialjoincount');
  await page.locator('#sjc-p').selectOption('topo_poly');
  await page.locator('#sjc-pt').selectOption('topo_pt');
  await page.locator('#sjc-run').click();
  await expect(page.locator('#modal')).toContainText(DRAWN);
  await expect(page.locator('#modal')).toContainText('point_count');
  const join = await page.evaluate(() => {
    const layer = window.__nwg.analysisLayers.at(-1);
    const src = window.__nwg.L.get('topo_poly').obj.features[0];
    const counted = layer.features.find((f) => f.props.source === 'Left');
    return { attr: counted?.props?.point_count, source: src.props.point_count, x: src.parts[0][0][0], hidden: src.hidden };
  });
  expect(join.attr).toBeGreaterThan(0);
  expect(join.source).toBeUndefined();
  expect(join.x).toBe(await page.evaluate(() => window.__nwg.__topoX));
  expect(join.hidden).toBe(false);
  takeErrors(errors, 'join');

  await page.evaluate(() => window.__nwg.clearAnalysisLayers());
  await openTool(page, 'removesmallpoly');
  await page.locator('#rsp-layer').selectOption('topo_poly');
  await page.locator('#rsp-min').fill('100000000');
  await page.locator('#rsp-run').click();
  await expect(page.locator('#modal')).toContainText(DRAWN);
  const removed = await page.evaluate(() => {
    const src = window.__nwg.L.get('topo_poly').obj.features;
    return { hidden: src.some((f) => f.hidden), drawn: window.__nwg.analysisLayers.at(-1)?.features.length || 0 };
  });
  expect(removed.hidden).toBe(false);
  expect(removed.drawn).toBe(0);
  takeErrors(errors, 'small');
});
