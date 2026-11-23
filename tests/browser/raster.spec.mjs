import { test, expect } from '@playwright/test';
import { blockThirdParty, bootMap, capturePageErrors } from './helpers.mjs';

const W = 4;
const H = 3;
const CELL = 1000 / 40075016.686;
const WB = [0.5, 0.5, 0.5 + W * CELL, 0.5 + H * CELL];
const DRAWN = 'Drawn on the map as a new surface. The original layer is unchanged.';
const LINES = 'Drawn on the map as lines on this raster. The original layer is unchanged.';
const PANEL = 'This stays in the panel. It does not draw a layer.';

function grid(fill) {
  const data = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) data.push(fill(i, j));
  return data;
}

async function openTool(page, id) {
  await page.evaluate((tool) => document.querySelector(`[data-tool="${tool}"]`)?.click(), id);
  await expect(page.locator('#modal.modal-map')).toBeVisible();
}

function takeErrors(errors, label) {
  const got = errors.splice(0, errors.length);
  expect(got, label).toEqual([]);
}

test('raster tools draw a surface, a line on the raster, or a panel result', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = capturePageErrors(page);
  let dialog = false;
  page.on('dialog', async (d) => { dialog = true; await d.dismiss(); });
  await page.setViewportSize({ width: 1280, height: 800 });
  await blockThirdParty(page);
  await bootMap(page);
  await page.locator('.tab[data-tab="tools"]').click();

  await page.evaluate(({ wb, w, h, a, b }) => {
    window.__nwg.selClear();
    window.__nwg.setFocus(null, false);
    window.__nwg.clearAnalysisLayers();
    const paint = (values, role) => {
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h; canvas.dataset.role = role;
      const ctx = canvas.getContext('2d');
      const img = ctx.createImageData(w, h);
      for (let i = 0; i < values.length; i++) {
        img.data[i * 4] = 180; img.data[i * 4 + 1] = 40; img.data[i * 4 + 2] = 40; img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      return canvas;
    };
    const addRaster = (id, label, values, classes) => {
      const canvas = paint(values, id);
      const data = Float32Array.from(values);
      const obj = {
        id, kind: 'raster', visible: true, opacity: 1, order: 5,
        img: canvas, wb: wb.slice(), categorical: false, nodata: null,
        vals: { w, h, wb: wb.slice(), dtype: 'f4', data },
      };
      const st = {
        meta: { id, label, kind: 'raster', nodata: null, classes: classes || null },
        on: true, opacity: 1, order: 5, obj,
      };
      window.__nwg.L.set(id, st);
      window.__nwg.stack.push(id);
      window.__nwg.map.addLayer(obj);
    };
    addRaster('syn_a', 'Synthetic A', a, [
      { value: 0, label: 'Zero' }, { value: 10, label: 'Ten' },
      { value: 20, label: 'Twenty' }, { value: 30, label: 'Thirty' },
    ]);
    addRaster('syn_b', 'Synthetic B', b, null);
    const mid = wb[0] + (wb[2] - wb[0]) / 2;
    const ring = [wb[0], wb[1], mid, wb[1], mid, wb[3], wb[0], wb[3]];
    const feature = {
      type: 'poly', hidden: false, parts: [[ring]], bb: [wb[0], wb[1], mid, wb[3]],
      props: { name: 'Left half' }, fill: '#3366cc', stroke: '#3366cc', idx: 0,
    };
    const poly = {
      id: 'syn_poly', kind: 'polygon', visible: false, opacity: 0.3, order: 6,
      features: [feature],
    };
    window.__nwg.L.set('syn_poly', {
      meta: { id: 'syn_poly', label: 'Synthetic polygons', kind: 'polygon' },
      on: true, obj: poly,
    });
    window.__nwg.stack.push('syn_poly');
  }, { wb: WB, w: W, h: H, a: grid((i) => i * 10), b: grid(() => 1) });

  await expect(page.locator('[data-tool="rastercalc"]')).toContainText('New surface from a cell expression');
  await expect(page.locator('[data-tool="rasterdiff"]')).toContainText('How many cells are higher or lower');

  await openTool(page, 'rastercalc');
  await page.locator('#rc-expr').fill('v * 2');
  await page.locator('#rc-run').click();
  await expect(page.locator('#rc-out')).toContainText(DRAWN);
  const calc = await page.evaluate(async () => {
    const src = window.__nwg.L.get('syn_a');
    const layer = window.__nwg.analysisLayers[0];
    src.obj.visible = false;
    window.__nwg.L.get('syn_b').obj.visible = false;
    window.__nwg.map.render();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const wb = layer.wb;
    const [x, y] = window.__nwg.map.toScreen((wb[0] + wb[2]) / 2, (wb[1] + wb[3]) / 2);
    const dpr = window.__nwg.map.dpr || 1;
    const px = [...window.__nwg.map.ctx.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data];
    src.obj.visible = true;
    window.__nwg.L.get('syn_b').obj.visible = true;
    window.__nwg.map.render();
    return {
      kind: layer.kind,
      canvas: layer.img.nodeName,
      doubled: layer.vals.data[1],
      source: src.obj.vals.data[1],
      sameImage: src.obj.img.dataset.role === 'syn_a',
      px, x, y,
    };
  });
  expect(calc.kind).toBe('raster');
  expect(calc.canvas).toBe('CANVAS');
  expect(calc.doubled).toBe(20);
  expect(calc.source).toBe(10);
  expect(calc.sameImage).toBe(true);
  expect(calc.px[0]).not.toBe(243);
  takeErrors(errors, 'calculator');

  await openTool(page, 'rasterreclass');
  await page.locator('#rr-n').fill('2');
  await page.locator('#rr-method').selectOption('equal');
  await page.locator('#rr-run').click();
  await expect(page.locator('#rr-out')).toContainText(DRAWN);
  await expect(page.locator('#rr-out')).toContainText('equal-interval');
  const reclass = await page.evaluate(() => {
    const data = window.__nwg.analysisLayers[0].vals.data;
    return { low: data[1], high: data[2], source: window.__nwg.L.get('syn_a').obj.vals.data[2] };
  });
  expect(reclass).toEqual({ low: 1, high: 2, source: 20 });
  takeErrors(errors, 'reclass');

  await page.evaluate(() => window.__nwg.clearAnalysisLayers());
  await openTool(page, 'rasterstats');
  await page.locator('#rs-run').click();
  await expect(page.locator('#rs-out')).toContainText(PANEL);
  const stats = await page.locator('#rs-out .statbox').allTextContents();
  expect(stats.some((t) => t.includes('lowest') && t.includes('0'))).toBe(true);
  expect(stats.some((t) => t.includes('highest') && t.includes('30'))).toBe(true);
  expect(stats.some((t) => t.includes('mean') && t.includes('15'))).toBe(true);
  expect(await page.evaluate(() => window.__nwg.analysisLayers.length)).toBe(0);
  takeErrors(errors, 'stats');

  await openTool(page, 'rastercontour');
  await page.locator('#cont-interval').fill('15');
  await page.locator('#cont-run').click();
  await expect(page.locator('#cont-out')).toContainText(LINES);
  const contour = await page.evaluate((wb) => {
    const layer = window.__nwg.analysisLayers[0];
    const pts = layer.features.flatMap((f) => [...f.parts[0]]);
    let inside = pts.length > 0;
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i], y = pts[i + 1];
      if (x < wb[0] - 1e-8 || x > wb[2] + 1e-8 || y < wb[1] - 1e-8 || y > wb[3] + 1e-8) inside = false;
    }
    return { kind: layer.kind, pieces: layer.features.length, inside, x: pts[0] };
  }, WB);
  expect(contour.kind).toBe('line');
  expect(contour.pieces).toBeGreaterThan(0);
  expect(contour.inside).toBe(true);
  expect(contour.x).toBeGreaterThan(0.4);
  takeErrors(errors, 'contour');

  await openTool(page, 'rasterslope');
  await page.locator('#slp-run').click();
  await expect(page.locator('#slp-out')).toContainText(DRAWN);
  await expect(page.locator('#slp-out')).toContainText('degrees');
  const slope = await page.evaluate(() => {
    const data = window.__nwg.analysisLayers[0].vals.data;
    return { edge: data[0], interior: data[1 * 4 + 1] };
  });
  expect(Number.isNaN(slope.edge)).toBe(true);
  expect(slope.interior).toBeGreaterThan(0.2);
  expect(slope.interior).toBeLessThan(5);
  takeErrors(errors, 'slope');

  await page.evaluate(() => window.__nwg.clearAnalysisLayers());
  await openTool(page, 'rasterhist');
  await page.locator('#hst-bins').fill('4');
  await page.locator('#hst-run').click();
  await expect(page.locator('#hst-out')).toContainText(PANEL);
  await expect(page.locator('#hst-out .raster-bar')).toHaveCount(4);
  expect(await page.evaluate(() => window.__nwg.analysisLayers.length)).toBe(0);
  takeErrors(errors, 'histogram');

  await openTool(page, 'rasterclipoly');
  await page.locator('#rcp-run').click();
  await expect(page.locator('#rcp-out')).toContainText(DRAWN);
  await expect(page.locator('#rcp-out')).toContainText('centre is inside');
  const clipped = await page.evaluate(() => {
    const data = window.__nwg.analysisLayers[0].vals.data;
    return { left: data[0], right: data[2], kept: [...data].filter((v) => Number.isFinite(v)).length };
  });
  expect(clipped.left).toBe(0);
  expect(Number.isNaN(clipped.right)).toBe(true);
  expect(clipped.kept).toBe(6);
  takeErrors(errors, 'clip polygon');

  await openTool(page, 'rasteroverlay');
  await expect(page.locator('#ro-b')).toHaveValue('syn_b');
  await page.locator('#ro-run').click();
  await expect(page.locator('#ro-out')).toContainText(DRAWN);
  expect(await page.evaluate(() => window.__nwg.analysisLayers[0].vals.data[1])).toBe(11);
  takeErrors(errors, 'overlay');

  await page.evaluate(() => window.__nwg.clearAnalysisLayers());
  await openTool(page, 'rasterclasszonal');
  await page.locator('#rcz-run').click();
  await expect(page.locator('#rcz-out')).toContainText(PANEL);
  await expect(page.locator('#rcz-out')).toContainText('Left half');
  await expect(page.locator('#rcz-out')).toContainText('Zero');
  await expect(page.locator('#rcz-out')).toContainText('published classes');
  expect(await page.evaluate(() => window.__nwg.analysisLayers.length)).toBe(0);
  await page.evaluate(() => { window.__nwg.L.get('syn_a').meta.classes = null; });
  await page.locator('#rcz-run').click();
  await expect(page.locator('#rcz-out')).toContainText('no published classes');
  await expect(page.locator('#rcz-out')).toContainText(PANEL);
  takeErrors(errors, 'class zonal');

  await openTool(page, 'rasterdiff');
  await expect(page.locator('#rd-b')).toHaveValue('syn_b');
  await page.locator('#rd-run').click();
  await expect(page.locator('#rd-out')).toContainText(PANEL);
  const diff = await page.locator('#rd-out .statbox').allTextContents();
  expect(diff.some((t) => t.includes('cells subtracted') && t.includes('12'))).toBe(true);
  expect(diff.some((t) => t.includes('A greater than B') && t.includes('9'))).toBe(true);
  expect(diff.some((t) => t.includes('A less than B') && t.includes('3'))).toBe(true);
  expect(diff.some((t) => t.includes('equal cells') && t.includes('0'))).toBe(true);
  expect(await page.evaluate(() => window.__nwg.analysisLayers.length)).toBe(0);
  takeErrors(errors, 'difference');

  const mid = WB[0] + (WB[2] - WB[0]) / 2;
  await page.evaluate((focus) => window.__nwg.setFocus({ type: 'rect', wb: focus }, false), [mid, WB[1], WB[2], WB[3]]);
  await openTool(page, 'rasterclip');
  await page.locator('#rcl-run').click();
  await expect(page.locator('#rcl-out')).toContainText(DRAWN);
  await expect(page.locator('#rcl-out')).toContainText('outside the focus');
  const mask = await page.evaluate(async () => {
    const layer = window.__nwg.analysisLayers[0];
    const data = layer.vals.data;
    window.__nwg.L.get('syn_a').obj.visible = false;
    window.__nwg.L.get('syn_b').obj.visible = false;
    window.__nwg.map.render();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const map = window.__nwg.map;
    const dpr = map.dpr || 1;
    const sample = (i, j) => {
      const { w, h, wb } = layer.vals;
      const [x, y] = map.toScreen(wb[0] + (i + 0.5) / w * (wb[2] - wb[0]), wb[1] + (j + 0.5) / h * (wb[3] - wb[1]));
      return [...map.ctx.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data];
    };
    return { left: data[0], right: data[2], kept: [...data].filter((v) => Number.isFinite(v)).length, leftPx: sample(0, 1), rightPx: sample(2, 1) };
  });
  expect(Number.isNaN(mask.left)).toBe(true);
  expect(mask.right).toBe(20);
  expect(mask.kept).toBe(6);
  expect(mask.rightPx[0]).not.toBe(243);
  expect(mask.leftPx[0]).toBe(243);
  takeErrors(errors, 'clip focus');

  await page.evaluate(() => { window.__nwg.setFocus(null, false); window.__nwg.clearAnalysisLayers(); });
  await openTool(page, 'rastercalc');
  await page.locator('#rc-expr').fill('alert(1)');
  await page.locator('#rc-run').click();
  await expect(page.locator('#rc-out')).toContainText('not allowed');
  expect(dialog).toBe(false);
  expect(await page.evaluate(() => window.__nwg.analysisLayers.length)).toBe(0);
  takeErrors(errors, 'rejected expression');
});
