import { test, expect } from '@playwright/test';
import { blockThirdParty, expectOnlyTileHostsBlocked, bootMap, capturePageErrors, settle, WPDX } from './helpers.mjs';

// These tests guard the behaviours a reader relies on:
//  - tapping the map always identifies a feature (regression: identify() threw on every tap)
//  - Select features keeps working with taps and with a dragged box, on touch and mouse
//  - every tool button opens, its main action runs, and nothing throws
//  - the in-app guide documents every registered tool

const LGA = 'admin_lgas_gadm_pg';

async function enableLayer(page, id, label) {
  await page.waitForFunction(() => window.__nwg?.L?.size === 59);
  const needsLayersTab = await page.evaluate(() => (
    document.querySelector('#sheet').classList.contains('closed')
    || !document.querySelector('#panel-layers').classList.contains('active')
  ));
  if (needsLayersTab) await page.locator('.tab[data-tab="layers"]').click();
  await page.locator('#layerfilter').fill(label);
  const row = page.locator(`#layerlist .lrow[data-id="${id}"]`);
  await expect(row).toBeVisible();
  const on = await page.evaluate((layerId) => Boolean(window.__nwg.L.get(layerId)?.on), id);
  if (!on) await row.locator('.sw').click();
  await page.waitForFunction((layerId) => {
    const layer = window.__nwg.L.get(layerId);
    const loaded = layer?.obj && (layer.obj.features?.length > 0 || layer.obj.img || layer.obj.categories);
    return Boolean(loaded && layer.on);
  }, id, { timeout: 60_000 });
  await page.locator('#layerfilter').fill('');
}

async function closeSheet(page) {
  const open = await page.evaluate(() => !document.querySelector('#sheet').classList.contains('closed'));
  if (open) await page.locator('.tab[data-tab="layers"]').click();
  await settle(page);
}

test('tapping the map identifies a feature and fills the Info panel', async ({ page }) => {
  const errors = capturePageErrors(page);
  const blocked = await blockThirdParty(page);
  await bootMap(page);
  await enableLayer(page, LGA, 'Local government areas (GADM)');
  await page.evaluate(() => window.__nwg.map.setView(8.5, 11.9, 8.5));
  await closeSheet(page);

  const point = await page.evaluate(() => {
    const map = window.__nwg.map;
    for (let y = map.H * 0.3; y < map.H * 0.7; y += 12) {
      for (let x = map.W * 0.3; x < map.W * 0.7; x += 12) {
        if (map.identify(x, y).some((hit) => hit.feature)) return [x, y];
      }
    }
    return null;
  });
  expect(point, 'a polygon must be identifiable on screen').not.toBeNull();

  await page.mouse.click(point[0], point[1]);
  await page.waitForFunction(() => document.querySelector('#info .card'));
  const info = page.locator('#info');
  await expect(info.locator('.card header')).toContainText('Local government areas (GADM)');
  await expect(info.locator('.card .facts')).toContainText('Area');
  expect(errors).toEqual([]);
  expectOnlyTileHostsBlocked(blocked);
});

test('select mode selects by tap, box drag and unselects on a second tap', async ({ page }) => {
  const errors = capturePageErrors(page);
  await blockThirdParty(page);
  await bootMap(page);
  await enableLayer(page, LGA, 'Local government areas (GADM)');
  await page.evaluate(() => window.__nwg.map.setView(8.5, 11.9, 8.5));
  await closeSheet(page);

  await page.evaluate(() => window.__nwg.toolSelect());
  await expect(page.locator('#modal-title')).toHaveText('Select features');
  await page.locator('[data-act="start"]').click();
  await expect(page.locator('#selbar')).toBeVisible();
  await expect(page.locator('#selbar')).toHaveClass(/active/);

  const point = await page.evaluate(() => {
    const map = window.__nwg.map;
    for (let y = map.H * 0.3; y < map.H * 0.7; y += 12) {
      for (let x = map.W * 0.3; x < map.W * 0.7; x += 12) {
        if (map.identify(x, y).some((hit) => hit.feature)) return [x, y];
      }
    }
    return null;
  });
  await page.mouse.click(point[0], point[1]);
  await expect.poll(() => page.evaluate(() => window.__nwg.sel.ids.size)).toBe(1);

  // tapping the same feature again removes it
  await page.mouse.click(point[0], point[1]);
  await expect.poll(() => page.evaluate(() => window.__nwg.sel.ids.size)).toBe(0);

  // drag a box: everything inside is selected and the map must not pan meanwhile
  const centreBefore = await page.evaluate(() => window.__nwg.map.center());
  await page.mouse.move(320, 300);
  await page.mouse.down();
  await page.mouse.move(960, 700, { steps: 14 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__nwg.sel.ids.size)).toBeGreaterThan(3);
  expect(await page.evaluate(() => window.__nwg.map.center())).toEqual(centreBefore);

  await expect(page.locator('#selcount')).not.toHaveText('0');
  await page.locator('#sellist').click();
  await expect(page.locator('#modal-title')).toHaveText('Selected features');
  await expect(page.locator('#modal-body')).toContainText('selected');
  await page.locator('#modal-close').click();

  await page.locator('#seldone').click();
  await expect(page.locator('#selbar')).not.toHaveClass(/active/);
  // the selection survives leaving select mode, so it can still be listed
  expect(await page.evaluate(() => window.__nwg.sel.ids.size)).toBeGreaterThan(3);
  expect(await page.evaluate(() => window.__nwg.map.panLock)).toBe(false);
  expect(errors).toEqual([]);
});

test('select mode drags a box instead of panning the map', async ({ page }) => {
  await bootMap(page);
  await enableLayer(page, LGA, 'Local government areas (GADM)');
  await closeSheet(page);
  await page.evaluate(() => window.__nwg.map.setView(8.5, 11.9, 8.5));
  const before = await page.evaluate(() => window.__nwg.map.center());
  await page.evaluate(() => window.__nwg.enterSelectMode(''));
  await page.mouse.move(360, 320);
  await page.mouse.down();
  await page.mouse.move(900, 660, { steps: 12 });
  await page.mouse.up();
  await settle(page);
  expect(await page.evaluate(() => window.__nwg.map.center())).toEqual(before);
  expect(await page.evaluate(() => window.__nwg.sel.ids.size)).toBeGreaterThan(0);
  // and leaving select mode gives panning back
  await page.evaluate(() => window.__nwg.exitSelectMode(true));
  await page.mouse.move(640, 450);
  await page.mouse.down();
  await page.mouse.move(540, 420, { steps: 8 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.__nwg.map.center())).not.toEqual(before);
});

test('every tool opens and runs without throwing', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = capturePageErrors(page);
  await blockThirdParty(page);
  await bootMap(page);
  await enableLayer(page, LGA, 'Local government areas (GADM)');
  await enableLayer(page, WPDX, 'Water points & boreholes (WPDx)');
  await enableLayer(page, 'water_lines_diva_ln', 'Rivers and streams (DIVA)');
  await enableLayer(page, 'elevation_srtm_terrarium_rst', 'Elevation / DEM');
  await page.locator('.tab[data-tab="tools"]').click();

  const tools = await page.evaluate(() => [...document.querySelectorAll('#panel-tools [data-tool]')].map((b) => b.dataset.tool));
  expect(tools.length).toBeGreaterThan(100);
  const failures = [];

  for (const tool of tools) {
    errors.length = 0;
    await page.evaluate((id) => document.querySelector(`[data-tool="${id}"]`)?.click(), tool);
    await page.waitForTimeout(160);
    // run the panel's main action, if it has one
    await Promise.race([
      page.evaluate(() => document.querySelector('#modal-body button.btn.primary, #modal-body [data-act]')?.click()).catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
    await page.waitForTimeout(220);
    const toast = await page.evaluate(() => document.querySelector('#toast').textContent);
    if (errors.length) failures.push({ tool, errors: [...new Set(errors)] });
    if (/Something went wrong/.test(toast)) failures.push({ tool, toast });
    await page.evaluate(() => {
      document.querySelector('#modal-close')?.click();
      document.querySelector('#drawclear')?.click();
    });
    await page.waitForTimeout(60);
  }
  expect(failures, JSON.stringify(failures, null, 1)).toEqual([]);
});

test('a GeoPackage is listed under Imported and stays off until turned on', async ({ page }) => {
  const errors = capturePageErrors(page);
  await blockThirdParty(page);
  await bootMap(page);
  await page.locator('.tab[data-tab="tools"]').click();
  await page.locator('[data-tool="gpkg"]').click();
  await page.locator('#gp-file').setInputFiles(new URL('../fixtures/minna_abuja.gpkg', import.meta.url).pathname);
  await page.locator('#gp-read').click();
  await expect(page.locator('#gp-out .caveat').first()).toContainText('15 metres');
  await expect(page.locator('#gp-out')).toContainText('Abuja test');
  await expect(page.locator('#gp-out')).toContainText('Lagos test');
  await page.locator('#gp-add').click();
  await expect(page.locator('#importlist')).toContainText('Imported');
  await expect(page.locator('#importlist')).toContainText('15 metres');
  await expect(page.locator('#importlist')).toContainText('Abuja test');
  await expect(page.locator('#layerlist')).not.toContainText('Abuja test');
  const before = await page.evaluate(() => {
    const layer = [...window.__nwg.L.values()].find((st) => st.meta.label === 'Abuja test');
    return { on: layer?.on, id: layer?.meta.id };
  });
  expect(before.on).toBe(false);
  await page.locator(`#importlist .lrow[data-id="${before.id}"] .sw`).click();
  await expect.poll(() => page.evaluate((id) => window.__nwg.L.get(id)?.on, before.id)).toBe(true);
  const placed = await page.evaluate((id) => {
    const st = window.__nwg.L.get(id);
    return { name: st.obj.features[0].props.name, bounds: st.meta.bounds, lagos: [...window.__nwg.L.values()].find((row) => row.meta.label === 'Lagos test')?.on };
  }, before.id);
  expect(placed.name).toBe('Abuja');
  expect(placed.lagos).toBe(false);
  expect(placed.bounds[0]).toBeCloseTo(7.3986, 3);
  expect(placed.bounds[1]).toBeCloseTo(9.0765, 3);
  expect(errors).toEqual([]);
});

test('buffer is picked on the map and the zone can be a square', async ({ page }) => {
  const errors = capturePageErrors(page);
  await blockThirdParty(page);
  await bootMap(page);
  await enableLayer(page, LGA, 'Local government areas (GADM)');
  await page.evaluate(() => window.__nwg.map.setView(8.5, 11.9, 8.5));
  await closeSheet(page);
  await page.evaluate(() => document.querySelector('[data-tool="buffer"]').click());
  await expect(page.locator('#bufferbar')).toBeVisible();
  await expect(page.locator('#bufferbar')).toContainText('Tap the feature');
  await expect(page.locator('#bf-feat')).toHaveCount(0);
  await expect(page.locator('#bf-src')).toHaveCount(0);

  const point = await page.evaluate(() => {
    const map = window.__nwg.map;
    const rect = map.cv.getBoundingClientRect();
    for (let y = map.H * 0.3; y < map.H * 0.75; y += 16) {
      for (let x = map.W * 0.35; x < map.W * 0.8; x += 16) {
        if (map.identify(x, y).some((hit) => hit.feature)) return [rect.left + x, rect.top + y];
      }
    }
    return null;
  });
  expect(point, 'a feature must be on screen to tap').not.toBeNull();
  await page.mouse.click(point[0], point[1]);
  await expect(page.locator('#buffersetup')).toBeVisible();
  await expect(page.locator('#bufferpicked')).toContainText('Local government areas');
  await page.locator('#bf-shape [data-shape="square"]').click();
  await expect(page.locator('#bf-shape [data-shape="square"]')).toHaveClass(/on/);
  await page.locator('#bf-shape [data-shape="diamond"]').click();
  await page.locator('#bf-shape [data-shape="hexagon"]').click();
  await page.locator('#bf-shape [data-shape="circle"]').click();
  await expect(page.locator('#bf-run')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the guide documents every tool and can be searched', async ({ page }) => {
  await bootMap(page);
  await page.evaluate(() => window.__nwg.openGuide());
  await expect(page.locator('#modal-title')).toHaveText('Guide');

  const missing = await page.evaluate(() => {
    const documented = new Set([...document.querySelectorAll('details[data-tool-help]')].map((d) => d.dataset.toolHelp));
    // every tool button that is visible in the tools panel must have a guide entry
    return [...document.querySelectorAll('#panel-tools [data-tool]')]
      .map((b) => b.dataset.tool)
      .filter((id) => !documented.has(id));
  });
  expect(missing).toEqual([]);
  expect(await page.locator('details[data-tool-help] .gbody').count()).toBeGreaterThan(100);

  await page.locator('#guide-q').fill('drag a box');
  await expect(page.locator('details[data-tool-help="select"]')).toBeVisible();
  await expect(page.locator('details[data-tool-help="buffer"]')).toBeHidden();
  await page.locator('#guide-q').fill('');
  await expect(page.locator('details[data-tool-help="buffer"]')).toBeVisible();
});

// Regression: meta.fields holds {name, label} objects. Building a dropdown straight
// from it produced "[object Object]" options, so no column could ever be chosen.
test('field pickers list real column names and the tools run', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = capturePageErrors(page);
  await blockThirdParty(page);
  await bootMap(page);
  await enableLayer(page, LGA, 'Local government areas (GADM)');
  await page.locator('.tab[data-tab="tools"]').click();

  const cases = [
    ['countbyattr', '#cba-field'],
    ['fieldstatsbygroup', '#fsg-group'],
    ['jenksbreaks', '#jb-field'],
    ['quantileclass', '#qc-field'],
    ['equalintervalclass', '#ei-field'],
  ];
  for (const [tool, select] of cases) {
    await page.evaluate((id) => document.querySelector(`[data-tool="${id}"]`)?.click(), tool);
    await expect(page.locator('#modal')).toBeVisible();
    const options = await page.evaluate((sel) => [...document.querySelectorAll(`${sel} option`)].map((o) => o.textContent), select);
    expect(options.length, `${tool} must offer fields`).toBeGreaterThan(0);
    expect(options.some((o) => /object Object/.test(o)), `${tool} field options`).toBe(false);

    await page.evaluate(() => document.querySelector('#modal-body button.btn.primary')?.click());
    await page.waitForTimeout(900);
    const toast = await page.evaluate(() => document.querySelector('#toast').textContent);
    expect(toast, `${tool} toast`).not.toMatch(/Something went wrong|No valid|not found/i);
    await page.evaluate(() => { document.querySelector('#modal-close')?.click(); document.querySelector('#drawclear')?.click(); });
  }
  expect(errors).toEqual([]);
});
