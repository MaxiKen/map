import { test, expect } from '@playwright/test';
import {
  blockThirdParty, expectOnlyTileHostsBlocked, bootMap, capturePageErrors, IGRAC, resetPanelScroll, WPDX,
} from './helpers.mjs';

test('visual: desktop quality overview, evidence detail and source links', async ({ page }) => {
  const errors = capturePageErrors(page);
  const blocked = await blockThirdParty(page);
  await bootMap(page, { quality: true });

  await expect(page.locator('#sheettitle')).toHaveText('Quality & source');
  await expect(page.locator('#quality .quality-stats .statbox').nth(0)).toContainText('59');
  await expect(page.locator('#quality .quality-stats .statbox').nth(1)).toContainText('1');
  await expect(page.locator('#quality .quality-stats .statbox').nth(2)).toContainText('47');
  await expect(page.locator('#quality .quality-stats .statbox').nth(3)).toContainText('86');
  await expect(page.locator('#quality .quality-register')).toContainText('98');
  await expect(page.locator('#quality .quality-hash-label code')).toHaveText(/^[0-9a-f]{64}$/);
  await resetPanelScroll(page);
  await expect(page.locator('#sheet')).toHaveScreenshot('quality-overview-desktop.png');

  await page.locator(`[data-quality-layer="${WPDX}"]`).click();
  const detail = page.locator(`[data-quality-detail="${WPDX}"]`);
  await expect(detail).toBeVisible();
  await expect(detail.locator('.quality-title')).toHaveText('Water points & boreholes (WPDx)');
  await expect(detail).toContainText('99,245 features');
  await expect(detail).toContainText('314 LGA-name joins need source-vintage review');
  await expect(detail).toContainText('5 of 6 tracked fields recorded');
  await expect(detail).toContainText('Not recorded: Temporal coverage');
  await expect(detail.locator('a[href="https://data.humdata.org/dataset/wpdx_nga"]')).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(detail.locator('a[download][href$=".geojson"]')).toHaveAttribute('href', 'data/groundwater_boreholes_wpdx_pt.geojson');
  await expect(page.locator('a[download][href="quality-register.json"]')).toHaveCount(1);
  await resetPanelScroll(page);
  await expect(page.locator('#sheet')).toHaveScreenshot('quality-review-desktop.png');

  await page.locator('#quality-layer').selectOption(IGRAC);
  const complete = page.locator(`[data-quality-detail="${IGRAC}"]`);
  await expect(complete).toContainText('6 of 6 tracked fields recorded');
  await expect(complete).toContainText('All six tracked source fields are recorded.');
  await expect(complete).toContainText('6 features');
  await expect(complete.locator('a[href="https://doi.org/10.58154/yb8g-cp97"]')).toBeVisible();
  await complete.locator('[data-quality-clear]').click();
  await expect(page.locator('#quality .quality-overview')).toBeVisible();
  await expect(page.locator('[data-quality-detail]')).toHaveCount(0);

  expectOnlyTileHostsBlocked(blocked);
  expect(errors).toEqual([]);
});
