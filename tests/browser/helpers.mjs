import { expect } from '@playwright/test';

export const BASE_URL = 'http://127.0.0.1:4173';
export const NATIONAL_BOUNDARY = 'admin_country_geoboundaries_pg';
export const WPDX = 'groundwater_boreholes_wpdx_pt';
export const IGRAC = 'groundwater_transboundary_igrac2025_pg';

const KNOWN_TILE_HOST = /^(server\.arcgisonline\.com|([a-z]\.)?tile\.openstreetmap\.org|([a-z]\.)?tile\.opentopomap\.org)$/;
const TRANSPARENT_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=',
  'base64',
);

export function capturePageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

export async function blockThirdParty(page) {
  const blocked = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === BASE_URL) await route.continue();
    else {
      blocked.push(url.href);
      if (KNOWN_TILE_HOST.test(url.hostname)) {
        // Keep constructor-time tile requests deterministic without showing an error toast.
        await route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PIXEL });
      } else await route.abort('blockedbyclient');
    }
  });
  return blocked;
}

export function expectOnlyTileHostsBlocked(blocked) {
  expect(blocked.every((value) => KNOWN_TILE_HOST.test(new URL(value).hostname))).toBe(true);
}

export async function bootMap(page, { quality = false } = {}) {
  await page.goto('/#l=&b=none', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__nwg?.L?.size === 59);
  await page.evaluate(() => document.fonts.ready);
  if (quality) await openQualityTab(page);
  await settle(page);
}

export async function openQualityTab(page) {
  await page.waitForFunction(() => window.__nwg?.L?.size === 59);
  const needsQualityTab = await page.evaluate(() => (
    document.querySelector('#sheet').classList.contains('closed')
    || !document.querySelector('#panel-quality').classList.contains('active')
  ));
  if (needsQualityTab) await page.locator('.tab[data-tab="quality"]').click();
  await expect(page.locator('#panel-quality')).toHaveClass(/active/);
  await expect(page.locator('#quality-layer')).toBeVisible();
  await expect(page.locator('#quality .quality-stats')).toBeVisible();
}

export async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

export async function resetPanelScroll(page) {
  await page.locator('#panel-quality').evaluate((panel) => { panel.scrollTop = 0; });
  await settle(page);
}

export async function showNationalBoundary(page) {
  await page.waitForFunction(() => window.__nwg?.L?.size === 59);
  const needsLayersTab = await page.evaluate(() => (
    document.querySelector('#sheet').classList.contains('closed')
    || !document.querySelector('#panel-layers').classList.contains('active')
  ));
  if (needsLayersTab) await page.locator('.tab[data-tab="layers"]').click();
  await page.locator('#layerfilter').fill('National boundary (geoBoundaries)');
  const row = page.locator(`#layerlist .lrow[data-id="${NATIONAL_BOUNDARY}"]`);
  await expect(row).toBeVisible();
  const alreadyOn = await page.evaluate((id) => Boolean(window.__nwg.L.get(id)?.on), NATIONAL_BOUNDARY);
  if (!alreadyOn) await row.locator('.sw').click();
  await page.waitForFunction((id) => {
    const layer = window.__nwg.L.get(id);
    return layer?.obj?.features?.length === 1 && layer.on && window.__nwg.stack.includes(id);
  }, NATIONAL_BOUNDARY);
}

export async function serverState() {
  const response = await fetch(`${BASE_URL}/__test/state`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Test-server state failed: ${response.status}`);
  return response.json();
}

export async function setServerWorkerBuild(build) {
  const response = await fetch(`${BASE_URL}/__test/sw-build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ build }),
  });
  if (!response.ok) throw new Error(`Test-worker update failed: ${response.status}`);
}

export async function waitForServiceWorker(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
      });
    }
  });
}

export async function serviceWorkerBuild(page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const worker = navigator.serviceWorker.controller || registration.active;
    if (!worker) throw new Error('No active service worker');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Service-worker version reply timed out')), 5000);
      const receive = (event) => {
        if (event.data?.type !== 'version') return;
        clearTimeout(timer);
        navigator.serviceWorker.removeEventListener('message', receive);
        resolve(event.data.build);
      };
      navigator.serviceWorker.addEventListener('message', receive);
      worker.postMessage('version');
    });
  });
}
