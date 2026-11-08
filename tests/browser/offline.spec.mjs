import { test, expect } from '@playwright/test';
import {
  blockThirdParty, expectOnlyTileHostsBlocked, bootMap, capturePageErrors, NATIONAL_BOUNDARY, openQualityTab,
  serverState, serviceWorkerBuild, showNationalBoundary, waitForServiceWorker,
} from './helpers.mjs';

const COMPRESSED = '/data/admin_country_geoboundaries_pg.geojson.gz';

test('offline reload restores the shell, catalog, gzip worker layer and complete register', async ({ page, context }) => {
  const errors = capturePageErrors(page);
  const blocked = await blockThirdParty(page);
  await bootMap(page, { quality: true });
  await waitForServiceWorker(page);
  const build = await page.evaluate(() => window.__nwg.build);
  expect(await serviceWorkerBuild(page)).toBe(build);

  const shellPaths = await page.evaluate(async (currentBuild) => {
    const cache = await caches.open(`nwg-shell-${currentBuild}`);
    return (await cache.keys()).map((request) => new URL(request.url).pathname);
  }, build);
  for (const path of ['/', '/index.html', '/css/app.css', '/js/app.js', '/js/engine.js', '/js/quality.js', '/js/vector-worker.js']) {
    expect(shellPaths).toContain(path);
  }

  await showNationalBoundary(page);
  const onlineRegister = await page.evaluate(async () => {
    const response = await fetch('quality-register.json');
    if (!response.ok) throw new Error(`Register preload failed: ${response.status}`);
    return response.json();
  });
  expect(onlineRegister.summary.layer_count).toBe(98);
  expect(onlineRegister.layers).toHaveLength(98);
  expect(await page.evaluate(async () => {
    const hit = await caches.match('data/admin_country_geoboundaries_pg.geojson.gz');
    const register = await caches.match('quality-register.json');
    return Boolean(hit?.ok && register?.ok);
  })).toBe(true);

  const beforeOffline = await serverState();
  try {
    await context.setOffline(true);
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__nwg?.L?.size === 59);
    await page.evaluate(() => document.fonts.ready);
    expect(await serviceWorkerBuild(page)).toBe(build);

    await showNationalBoundary(page);
    await openQualityTab(page);
    await expect(page.locator('#quality .quality-stats .statbox').nth(0)).toContainText('59');
    const offlineRegister = await page.evaluate(async () => {
      const response = await fetch('quality-register.json');
      const bytes = await response.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
      const register = JSON.parse(new TextDecoder().decode(bytes));
      return { status: response.status, count: register.layers.length, hex };
    });
    expect(offlineRegister.status).toBe(200);
    expect(offlineRegister.count).toBe(98);
    await expect(page.locator('#quality .quality-hash-label code')).toHaveText(offlineRegister.hex);

    const afterOffline = await serverState();
    for (const path of ['/', '/catalog.json', COMPRESSED, '/quality-register.json']) {
      expect(afterOffline.requestCounts[path] || 0, `${path} must be served from cache while offline`)
        .toBe(beforeOffline.requestCounts[path] || 0);
    }
  } finally {
    await context.setOffline(false).catch(() => {});
  }

  expectOnlyTileHostsBlocked(blocked);
  expect(errors).toEqual([]);
});
