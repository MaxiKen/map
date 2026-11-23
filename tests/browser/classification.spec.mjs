import { test, expect } from '@playwright/test';
import { blockThirdParty, bootMap, capturePageErrors } from './helpers.mjs';

function point(idx, value, hidden = false) {
  const lon = 7 + idx * 0.02;
  const lat = 6.2;
  const x = (lon + 180) / 360;
  const s = Math.sin(lat * Math.PI / 180);
  const y = 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  return {
    type: 'point', idx, hidden, props: { name: 'p' + idx, value },
    parts: [x, y], fill: '#888888', stroke: '#888888', fill0: '#888888',
    bb: [x - 0.001, y - 0.001, x + 0.001, y + 0.001],
  };
}

async function inject(page, values, hiddenValue = null) {
  const features = values.map((value, idx) => point(idx, value));
  if (hiddenValue != null) features.push(point(features.length, hiddenValue, true));
  await page.evaluate((features) => {
    window.__nwg.L.set('class_pts', {
      meta: {
        id: 'class_pts', label: 'Class points', kind: 'point', group: 'class-test',
        fields: [{ name: 'name', type: 'text', label: 'Name' }, { name: 'value', type: 'number', label: 'Value' }],
        style: { color: '#888888' },
      },
      on: true, opacity: 1, sym: null, labels: null, filter: null, reclass: null,
      obj: { features },
    });
    if (!window.__nwg.stack.includes('class_pts')) window.__nwg.stack.push('class_pts');
  }, features);
}

async function openClassify(page, tool) {
  await page.locator(`[data-tool="${tool}"]`).click();
  await expect(page.locator('#modal.modal-map')).toBeVisible();
  await page.locator('#modal-body > .frow select').selectOption('class_pts');
  await expect(page.locator('#cl-field')).toHaveValue('value');
}

test('classification and view do what they name', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await blockThirdParty(page);
  await bootMap(page);
  await page.locator('.tab[data-tab="tools"]').click();
  await expect(page.locator('[data-tool="jenksbreaks"]')).toContainText('Jenks');
  await expect(page.locator('[data-tool="resetview"]')).toContainText('opening extent');

  const gapped = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 50, 51, 52, 100];
  await inject(page, gapped, 1000);
  await openClassify(page, 'jenksbreaks');
  await page.locator('#cl-n').fill('3');
  await page.locator('#cl-run').click();
  await expect(page.locator('#modal.modal-map')).toBeVisible();
  await expect(page.locator('#cl-out')).toContainText('16 values');
  await expect(page.locator('#cl-out')).toContainText('Cividis');
  await expect(page.locator('#cl-out')).not.toContainText('1000');
  const jenks = await page.evaluate(() => {
    const st = window.__nwg.L.get('class_pts');
    return {
      method: st.reclass.method,
      ramp: st.reclass.ramp,
      counts: st.obj.features.filter((f) => !f.hidden).length,
      fills: [...new Set(st.obj.features.filter((f) => !f.hidden).map((f) => f.fill))],
      values: st.obj.features.map((f) => f.props.value),
      breaks: st.reclass.breaks,
    };
  });
  expect(jenks.method).toBe('jenks');
  expect(jenks.ramp).toBe('cividis');
  expect(jenks.counts).toBe(16);
  expect(jenks.fills.length).toBeGreaterThan(1);
  expect(jenks.values).toEqual([...gapped, 1000]);
  expect(jenks.breaks).toEqual([1, 12, 52, 100]);
  const counts = await page.locator('#cl-out tbody tr td:nth-child(4), #cl-out table tr:not(:first-child) td:nth-child(4)').allTextContents();
  expect(counts.map((c) => c.trim())).toEqual(['12', '3', '1']);

  await page.locator('#cl-restore').click();
  const restored = await page.evaluate(() => window.__nwg.L.get('class_pts').obj.features.map((f) => f.fill));
  expect(restored.every((fill) => fill === '#888888')).toBe(true);
  await expect(page.locator('#modal.modal-map')).toBeVisible();

  await openClassify(page, 'quantileclass');
  await page.locator('#cl-n').fill('4');
  await page.locator('#cl-run').click();
  await expect(page.locator('#cl-out')).toContainText('16 values');
  const quantileCounts = await page.locator('#cl-out table tr:not(:first-child) td:nth-child(4)').allTextContents();
  expect(quantileCounts.map((c) => c.trim())).toEqual(['4', '4', '4', '4']);
  expect(errors, 'quantile').toEqual([]);

  await inject(page, [1, 1.2, 1.4, 100]);
  await openClassify(page, 'equalintervalclass');
  await page.locator('#cl-n').fill('4');
  await page.locator('#cl-run').click();
  await expect(page.locator('#cl-out')).toContainText('4 values');
  const equalCounts = await page.locator('#cl-out table tr:not(:first-child) td:nth-child(4)').allTextContents();
  expect(equalCounts.map((c) => c.trim())).toContain('0');
  await page.locator('#modal-close').click();

  await page.evaluate(() => {
    const st = window.__nwg.L.get('class_pts');
    st.reclass = null;
    st.filter = [{ id: 99, field: 'value', op: '=', value: '1' }];
    st.obj.features.forEach((f) => { f.fill = '#123456'; f.fill0 = '#123456'; f.hidden = true; });
    window.__nwg.map.setRotation(25);
    window.__nwg.map.setView(3, 5, 8);
    window.__nwg.setFocus({ type: 'rect', wb: [0.45, 0.45, 0.55, 0.55] }, false);
  });
  expect(await page.evaluate(() => window.__nwg.clip)).toBeTruthy();
  await page.locator('[data-tool="resetview"]').click();
  await expect(page.locator('#toast')).toContainText('Layers and colours kept');
  const view = await page.evaluate(() => {
    const st = window.__nwg.L.get('class_pts');
    return {
      filter: st.filter,
      hidden: st.obj.features.some((f) => f.hidden),
      fill: st.obj.features[0].fill,
      rotation: window.__nwg.map.rotation,
      clip: window.__nwg.clip,
      listed: window.__nwg.stack.includes('class_pts'),
    };
  });
  expect(view.filter).toBeNull();
  expect(view.hidden).toBe(false);
  expect(view.fill).toBe('#123456');
  expect(view.rotation).toBe(0);
  expect(view.clip).toBeNull();
  expect(view.listed).toBe(true);

  await page.locator('[data-tool="fullscreen"]').click();
  const full = await page.evaluate(() => !!(document.fullscreenElement || document.webkitFullscreenElement));
  if (!full) await expect(page.locator('#toast')).toContainText('Full screen');
  expect(errors, 'classification and view').toEqual([]);
});
