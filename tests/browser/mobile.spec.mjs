import { test, expect } from '@playwright/test';
import {
  blockThirdParty, expectOnlyTileHostsBlocked, bootMap, capturePageErrors, resetPanelScroll, WPDX,
} from './helpers.mjs';

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
