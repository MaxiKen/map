import { test, expect } from '@playwright/test';
import { blockThirdParty, bootMap, capturePageErrors } from './helpers.mjs';

function ring(lon0, lat0, lon1, lat1) {
  const x = (lon) => (lon + 180) / 360;
  const y = (lat) => {
    const s = Math.sin(lat * Math.PI / 180);
    return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  };
  const west = x(lon0), east = x(lon1), north = y(lat1), south = y(lat0);
  return [west, north, east, north, east, south, west, south, west, north];
}

test('cartography tools colour, save and page without stretching', async ({ page }) => {
  const errors = capturePageErrors(page);
  await blockThirdParty(page);
  await bootMap(page);
  await page.locator('.tab[data-tab="tools"]').click();

  await page.locator('[data-tool="ramp"]').click();
  await expect(page.locator('#modal-body')).toContainText('Turn on a vector layer');
  await page.locator('#modal-close').click();

  const west = ring(7, 9, 8, 10);
  const east = ring(8, 9, 9, 10);
  await page.evaluate(({ west, east }) => {
    const poly = (name, coords, value) => {
      const xs = [], ys = [];
      for (let i = 0; i < coords.length; i += 2) { xs.push(coords[i]); ys.push(coords[i + 1]); }
      return {
        type: 'poly', idx: 0, hidden: false, props: { name, value },
        parts: [[coords]], fill: '#888888', stroke: '#888888', fill0: '#888888',
        bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      };
    };
    window.__nwg.L.set('carto_polys', {
      meta: {
        id: 'carto_polys', label: 'Carto polygons', kind: 'polygon', group: 'carto-test',
        fields: [{ name: 'name', type: 'text', label: 'Name' }, { name: 'value', type: 'number', label: 'Value' }],
        style: { color: '#888888' },
      },
      on: true, opacity: 1,
      obj: { labelField: 'name', features: [poly('Low', west, 1), poly('High', east, 100)] },
      sym: null, labels: null, filter: null, reclass: null,
    });
    window.__nwg.stack.push('carto_polys');
  }, { west, east });

  await page.locator('[data-tool="ramp"]').click();
  await expect(page.locator('#rp-layer')).toHaveValue('carto_polys');
  await page.locator('#rp-ramp').selectOption('cividis');
  await page.locator('#rp-n').evaluate((el) => { el.value = '2'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(page.locator('#rp-note')).toContainText('colour-blind');
  await page.locator('#rp-go').click();
  const classified = await page.evaluate(() => {
    const st = window.__nwg.L.get('carto_polys');
    return {
      ramp: st.reclass?.ramp,
      fills: st.obj.features.map((f) => f.fill),
      strokes: st.obj.features.map((f) => f.stroke),
    };
  });
  expect(classified.ramp).toBe('cividis');
  expect(classified.fills[0]).not.toBe(classified.fills[1]);
  expect(classified.strokes[0]).toBe(classified.fills[0]);

  await page.locator('#rp-rev').check();
  await page.locator('#rp-go').click();
  const reversed = await page.evaluate(() => window.__nwg.L.get('carto_polys').obj.features.map((f) => f.fill));
  expect(reversed[0]).toBe(classified.fills[1]);
  await page.locator('#rp-restore').click();
  const restored = await page.evaluate(() => window.__nwg.L.get('carto_polys').obj.features.map((f) => f.fill));
  expect(restored).toEqual(['#888888', '#888888']);
  await page.locator('#modal-close').click();

  await page.locator('[data-tool="custombasemap"]').click();
  await page.locator('#cb-name').fill('Light grey');
  await page.locator('#cb-url').fill('https://tiles.example/{z}/{x}/{y}.png');
  await page.locator('#cb-add').click();
  await expect(page.locator('#toast')).toContainText('built-in');
  await page.locator('#cb-name').fill('Agency imagery');
  await page.locator('#cb-url').fill('http://tiles.example/{z}/{x}/{y}.png');
  await page.locator('#cb-add').click();
  await expect(page.locator('#toast')).toContainText('https');
  await page.locator('#cb-url').fill('https://tiles.example/{z}/{x}/{y}.png');
  await page.locator('#cb-attr').fill('© Agency');
  await page.locator('#cb-add').click();
  await expect(page.locator('#basemaps button[data-k="custom:agency-imagery"]')).toHaveCount(1);
  await expect(page.locator('#basemaps button[data-k="light"]')).toHaveCount(1);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('nwg.custom_basemaps')));
  expect(stored['Agency imagery'].attr).toBe('© Agency');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__nwg?.L?.size === 166);
  await expect(page.locator('#basemaps button[data-k="custom:agency-imagery"]')).toHaveCount(1);
  await page.locator('.tab[data-tab="tools"]').click();
  await page.locator('[data-tool="custombasemap"]').click();
  await page.locator('[data-del="Agency imagery"]').click();
  await expect(page.locator('#basemaps button[data-k="custom:agency-imagery"]')).toHaveCount(0);
  await expect(page.locator('#basemaps button[data-k="light"]')).toHaveCount(1);
  await page.locator('#modal-close').click();

  await page.evaluate(({ west, east }) => {
    const poly = (name, coords, value) => {
      const xs = [], ys = [];
      for (let i = 0; i < coords.length; i += 2) { xs.push(coords[i]); ys.push(coords[i + 1]); }
      return {
        type: 'poly', idx: 0, hidden: false, props: { name, value },
        parts: [[coords]], fill: '#888888', stroke: '#888888', fill0: '#888888',
        bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      };
    };
    window.__nwg.L.set('carto_polys', {
      meta: {
        id: 'carto_polys', label: 'Carto polygons', kind: 'polygon', group: 'carto-test',
        fields: [{ name: 'name', type: 'text', label: 'Name' }, { name: 'value', type: 'number', label: 'Value' }],
        style: { color: '#888888' },
      },
      on: true, opacity: 1, sym: null, labels: null, filter: null,
      reclass: { field: 'value', method: 'quantile', n: 2, ramp: 'cividis', reverse: false },
      obj: { labelField: 'name', features: [poly('Low', west, 1), poly('High', east, 100)] },
    });
    if (!window.__nwg.stack.includes('carto_polys')) window.__nwg.stack.push('carto_polys');
  }, { west, east });
  await page.locator('[data-tool="mappreset"]').click();
  await page.locator('#mp-name').fill('Field view');
  await page.locator('#mp-note').fill('minerals');
  await page.locator('#mp-save').click();
  await expect(page.locator('#mp-list')).toContainText('Field view');
  await expect(page.locator('#mp-list')).not.toContainText('°');
  await page.locator('#modal-close').click();
  await page.evaluate(() => {
    const st = window.__nwg.L.get('carto_polys');
    st.on = false;
    st.reclass = null;
    const i = window.__nwg.stack.indexOf('carto_polys');
    if (i >= 0) window.__nwg.stack.splice(i, 1);
  });
  await page.locator('[data-tool="mappreset"]').click();
  await page.locator('[data-restore="Field view"]').click();
  await expect(page.locator('#toast')).toContainText('Restored');
  const preset = await page.evaluate(() => {
    const st = window.__nwg.L.get('carto_polys');
    return { on: st.on, ramp: st.reclass?.ramp };
  });
  expect(preset).toEqual({ on: true, ramp: 'cividis' });

  await page.locator('[data-tool="printlayout"]').click();
  await expect(page.locator('#modal-body')).toContainText('not stretched');
  await page.locator('#pl-size').selectOption('a4');
  await page.locator('#pl-orient').selectOption('landscape');
  await page.locator('#pl-title').fill('Rivers');
  await page.locator('#pl-legend').check();
  const preview = await page.locator('#pl-prev').evaluate((el) => el.style.aspectRatio);
  expect(preview.replace(/\s/g, '')).toMatch(/297/);
  await page.locator('#pl-go').click();
  await expect(page.locator('#toast')).toContainText('Map picture saved', { timeout: 8000 });
  const layout = await page.evaluate(() => JSON.parse(localStorage.getItem('nwg.print_layout')));
  expect(layout).toMatchObject({ size: 'a4', orient: 'landscape', title: 'Rivers', legend: true });
  await page.locator('[data-tool="printlayout"]').click();
  await page.locator('#pl-clear').click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('nwg.print_layout'))).toBeNull();
  expect(errors).toEqual([]);
});
