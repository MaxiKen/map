import { test, expect } from '@playwright/test';
import {
  blockThirdParty, expectOnlyTileHostsBlocked, bootMap, capturePageErrors, resetPanelScroll, WPDX,
} from './helpers.mjs';

const LGA = 'admin_lgas_gadm_pg';

test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});

test('visual: mobile quality overview stays within the viewport', async ({ page }) => {
  const errors = capturePageErrors(page);
  const blocked = await blockThirdParty(page);
  await bootMap(page, { quality: true });

  await expect(page.locator('#sheet')).toBeVisible();
  await expect(page.locator('#sheet')).toHaveCSS('width', '390px');
  await expect(page.locator('#quality-layer')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await resetPanelScroll(page);
  await expect(page.locator('#sheet')).toHaveScreenshot('quality-overview-mobile.png');

  await page.locator('#quality-layer').selectOption(WPDX);
  await expect(page.locator(`[data-quality-detail="${WPDX}"]`)).toBeVisible();
  await expect(page.locator('.quality-title')).toHaveText('Water points & boreholes (WPDx)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expectOnlyTileHostsBlocked(blocked);
  expect(errors).toEqual([]);
});

test('visual: mobile dark quality evidence preserves readable contrast and layout', async ({ page }) => {
  const errors = capturePageErrors(page);
  const blocked = await blockThirdParty(page);
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await bootMap(page, { quality: true });
  await page.locator('#quality-layer').selectOption(WPDX);

  await expect(page.locator(`[data-quality-detail="${WPDX}"]`)).toBeVisible();
  await expect(page.locator('#sheet')).toHaveCSS('background-color', 'rgb(23, 28, 25)');
  await expect(page.locator('.quality-detail-head .quality-status.q-review')).toBeVisible();
  await expect(page.locator('.quality-gapbox')).toContainText('Not recorded: Temporal coverage');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await resetPanelScroll(page);
  await expect(page.locator('#sheet')).toHaveScreenshot('quality-review-mobile-dark.png');

  expectOnlyTileHostsBlocked(blocked);
  expect(errors).toEqual([]);
});

// A phone is where the reported bug hurt most: the selection box has to beat panning,
// and the contextual Select bar has to be on screen.
test('phone: selecting by area picks several polygons, lists them, clears and gives panning back', async ({ page }) => {
  const errors = capturePageErrors(page);
  const blocked = await blockThirdParty(page);
  await bootMap(page);

  await page.locator('.tab[data-tab="layers"]').click();
  await page.locator('#layerfilter').fill('Local government areas (GADM)');
  const row = page.locator(`#layerlist .lrow[data-id="${LGA}"]`);
  await expect(row).toBeVisible();
  if (!(await page.evaluate((id) => Boolean(window.__nwg.L.get(id)?.on), LGA))) await row.locator('.sw').click();
  await page.waitForFunction((id) => window.__nwg.L.get(id)?.obj?.features?.length > 0, LGA, { timeout: 60_000 });
  await page.locator('#layerfilter').fill('');
  await page.evaluate(() => window.__nwg.map.setView(8.5, 11.9, 8.5));

  await page.evaluate(() => window.__nwg.enterSelectMode(''));
  await expect(page.locator('#selbar')).toBeVisible();
  const map = await page.locator('#map').boundingBox();
  const centre = await page.evaluate(() => window.__nwg.map.center());

  // drag a box: on a phone this must select, not pan
  await page.mouse.move(map.x + map.width * 0.2, map.y + map.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(map.x + map.width * 0.85, map.y + map.height * 0.75, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__nwg.map.center())).toEqual(centre);
  expect(await page.evaluate(() => window.__nwg.sel.ids.size)).toBeGreaterThan(1);

  await page.evaluate(() => window.__nwg.openSelectionList());
  await expect(page.locator('#modal-title')).toContainText('Selected');
  await page.evaluate(() => window.__nwg.selClear());
  await page.locator('#modal-close').click();
  expect(await page.evaluate(() => window.__nwg.sel.ids.size)).toBe(0);

  // leaving select mode gives normal panning back
  await page.evaluate(() => window.__nwg.exitSelectMode(true));
  await expect(page.locator('#selbar')).toBeHidden();
  await page.mouse.move(map.x + map.width * 0.5, map.y + map.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(map.x + map.width * 0.3, map.y + map.height * 0.4, { steps: 8 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.__nwg.map.center())).not.toEqual(centre);

  expectOnlyTileHostsBlocked(blocked);
  expect(errors).toEqual([]);
});
