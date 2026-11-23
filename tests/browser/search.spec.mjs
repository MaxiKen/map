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

test('search tools find, read, convert and browse', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await blockThirdParty(page);
  await bootMap(page);
  await page.locator('.tab[data-tab="tools"]').click();
  const openTool = (id) => page.evaluate((tool) => document.querySelector(`[data-tool="${tool}"]`)?.click(), id);

  const onRing = ring(7, 9, 8, 10);
  const offRing = ring(8.2, 9, 9, 10);
  await page.evaluate(({ onRing, offRing }) => {
    const poly = (name, coords, value, hidden) => {
      const xs = [], ys = [];
      for (let i = 0; i < coords.length; i += 2) { xs.push(coords[i]); ys.push(coords[i + 1]); }
      return {
        type: 'poly', idx: 0, hidden, props: { name, value },
        parts: [[coords]], fill: '#888888', stroke: '#888888', fill0: '#888888',
        bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      };
    };
    const add = (id, label, on, features) => {
      window.__nwg.L.set(id, {
        meta: {
          id, label, kind: 'polygon', group: 'search-test',
          fields: [{ name: 'name', type: 'text', label: 'Name' }, { name: 'value', type: 'number', label: 'Value' }],
          style: { color: '#888888' },
        },
        on, opacity: 1,
        obj: { id, labelField: 'name', kind: 'polygon', visible: on, features },
        sym: null, labels: null, filter: null, reclass: null,
      });
      if (on) window.__nwg.stack.push(id);
    };
    add('find_on', 'Finder on', true, [
      poly('High', onRing, 100, false),
      poly('Thousand', onRing, 1000, false),
      poly('Secret', onRing, 7, true),
    ]);
    add('find_off', 'Finder off', false, [poly('Quarry', offRing, 3, false)]);
  }, { onRing, offRing });

  await openTool('find');
  await expect(page.locator('#finddock')).toBeVisible();
  await expect(page.locator('#modal')).toBeHidden();
  await page.locator('#ff-q').fill('High');
  await expect(page.locator('#ff-results')).toContainText('High');
  await expect(page.locator('#ff-results')).toContainText('Name');
  await expect(page.locator('#ff-status')).toContainText('Highlighted');
  await page.locator('#ff-q').fill('Secret');
  await expect(page.locator('#ff-status')).toContainText('No features matched');
  await page.locator('#ff-hidden').check();
  await expect(page.locator('#ff-results')).toContainText('Secret');
  await page.locator('#ff-hidden').uncheck();
  await page.locator('#ff-mode').selectOption('exact');
  await page.locator('#ff-q').fill('100');
  await expect(page.locator('#ff-results')).toContainText('High');
  await expect(page.locator('#ff-results')).not.toContainText('Thousand');
  await page.locator('#ff-off').selectOption('find_off');
  await page.locator('#ff-mode').selectOption('contains');
  await page.locator('#ff-q').fill('Quarry');
  await expect(page.locator('#ff-results')).toContainText('stays off');
  const stillOff = await page.evaluate(() => window.__nwg.L.get('find_off').on);
  expect(stillOff).toBe(false);
  await page.locator('#ff-off').selectOption('');
  await page.locator('#ff-q').fill('High');
  await expect(page.locator('#ff-results')).toContainText('High');
  await expect(page.locator('#ff-results')).not.toContainText('Quarry');
  await page.locator('#ff-results .ffhit').first().click();
  await expect(page.locator('#info')).toContainText('High');
  await expect(page.locator('#toast')).toContainText('Found');
  const picked = await page.evaluate(() => window.__nwg.map.selection?.layer?.id);
  expect(picked).toBe('find_on');

  await page.locator('.tab[data-tab="tools"]').click();
  await openTool('coords');
  await expect(page.locator('#inspectdock')).toBeVisible();
  await expect(page.locator('#modal')).toBeHidden();
  await page.locator('#map').click({ position: { x: 760, y: 180 } });
  await expect(page.locator('#inspectread')).toContainText('°', { timeout: 4000 });
  await expect(page.locator('#inspectread')).toContainText(/\d+[NS]/);
  await expect(page.locator('#inspectread')).not.toContainText(/west/i);
  await expect(page.locator('#inspectread')).toContainText('E ');
  await page.locator('#inspectdone').click();
  await expect(page.locator('#inspectdock')).toBeHidden();

  const before = await page.evaluate(() => window.__nwg.map.center());
  await page.locator('.tab[data-tab="tools"]').click();
  await openTool('convert');
  await expect(page.locator('#modal-body')).toContainText('stay in step');
  await page.locator('#cc-lat').fill('9.0765');
  await page.locator('#cc-lon').fill('7.3986');
  await page.locator('#cc-sys').selectOption('32632');
  const easting = await page.locator('#cc-e').inputValue();
  expect(Math.abs(+easting - 323998.95)).toBeLessThan(1);
  await expect(page.locator('#cc-latd')).toHaveValue('9');
  await page.locator('#cc-sys').selectOption('4263');
  await expect(page.locator('#cc-note')).toContainText('15 metres');
  await page.locator('#cc-lat').fill('999');
  await page.locator('#cc-goto').click();
  await expect(page.locator('#cc-err')).toContainText('Latitude');
  const after = await page.evaluate(() => window.__nwg.map.center());
  expect(after[0]).toBeCloseTo(before[0], 4);
  expect(after[1]).toBeCloseTo(before[1], 4);
  await page.locator('#cc-paste').fill('32N 323998.9537 1003697.9049');
  await expect(page.locator('#cc-lat')).toHaveValue(/9\.076/);
  await page.locator('#modal-close').click();

  await page.locator('.tab[data-tab="tools"]').click();
  await openTool('layerfind');
  await expect(page.locator('#discoverdock')).toBeVisible();
  await expect(page.locator('#discoverbody')).not.toContainText('this session only');
  await page.locator('#ld-q').fill('State code');
  const states = page.locator('.ldrow', { hasText: 'States (GADM)' });
  await expect(states).toContainText('Column: State code');
  await expect(page.locator('#ld-status')).toContainText(' of ');
  await states.locator('[data-ld="zoom"]').click();
  await expect(page.locator('#toast')).toContainText('still off');
  const statesOn = await page.evaluate(() => window.__nwg.L.get('admin_states_gadm_pg').on);
  expect(statesOn).toBe(false);
  await page.locator('#ld-q').fill('geoBoundaries');
  await page.locator('[data-id="admin_country_geoboundaries_pg"][data-ld="show"]').click();
  await expect(page.locator('#toast')).toContainText('Showing National boundary', { timeout: 20000 });
  const boundary = await page.evaluate(() => {
    const st = window.__nwg.L.get('admin_country_geoboundaries_pg');
    return { on: st.on, label: st.meta.label };
  });
  expect(boundary.on).toBe(true);
  expect(boundary.label).toContain('National boundary');

  expect(errors).toEqual([]);
});
