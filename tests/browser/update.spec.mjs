import { test, expect } from '@playwright/test';
import {
  BASE_URL, blockThirdParty, expectOnlyTileHostsBlocked, bootMap, capturePageErrors, serverState,
  serviceWorkerBuild, setServerWorkerBuild, waitForServiceWorker,
} from './helpers.mjs';

const NAVIGATION_COUNT = '__browser_test_navigation_count';

test('a new worker build activates, replaces the shell and reloads once', async ({ page }) => {
  const errors = capturePageErrors(page);
  const blocked = await blockThirdParty(page);
  await setServerWorkerBuild(null);
  await page.addInitScript((key) => {
    localStorage.setItem(key, String(Number(localStorage.getItem(key) || 0) + 1));
  }, NAVIGATION_COUNT);
  await bootMap(page, { quality: true });
  await waitForServiceWorker(page);
  const originalBuild = await page.evaluate(() => window.__nwg.build);
  expect(await serviceWorkerBuild(page)).toBe(originalBuild);
  expect(await page.evaluate((key) => Number(localStorage.getItem(key)), NAVIGATION_COUNT))
    .toBe(1); // the first-ever installation must not reload the visitor

  const workerResponse = await fetch(`${BASE_URL}/sw.js`);
  expect(workerResponse.headers.get('cache-control')).toBe('no-store');
  const before = await serverState();
  try {
    await setServerWorkerBuild('browser-update-v2');
    await page.evaluate(() => {
      navigator.serviceWorker.getRegistration()
        .then((registration) => registration.update())
        .catch(() => {});
    });
    await page.waitForFunction((key) => (
      Number(localStorage.getItem(key)) === 2 && window.__nwg?.L?.size === 59
    ), NAVIGATION_COUNT, { timeout: 20_000 });
    await waitForServiceWorker(page);

    expect(await serviceWorkerBuild(page)).toBe('browser-update-v2');
    expect(await page.evaluate((key) => Number(localStorage.getItem(key)), NAVIGATION_COUNT))
      .toBe(2); // controllerchange reloads once, not in a loop
    const cacheNames = await page.evaluate(() => caches.keys());
    expect(cacheNames).toContain('nwg-shell-browser-update-v2');
    expect(cacheNames).toContain('nwg-data-browser-update-v2');
    expect(cacheNames).not.toContain(`nwg-shell-${originalBuild}`);
    expect(cacheNames).not.toContain(`nwg-data-${originalBuild}`);
    const after = await serverState();
    expect(after.workerRequests).toBeGreaterThan(before.workerRequests);
  } finally {
    await setServerWorkerBuild(null);
  }

  expectOnlyTileHostsBlocked(blocked);
  expect(errors).toEqual([]);
});
