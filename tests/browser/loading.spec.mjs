import { test, expect } from '@playwright/test';
import {
  blockThirdParty, expectOnlyTileHostsBlocked, bootMap, capturePageErrors, NATIONAL_BOUNDARY, serverState, showNationalBoundary,
} from './helpers.mjs';

test('browser loads a gzip vector in its worker and renders a single-style legend', async ({ page }) => {
  const errors = capturePageErrors(page);
  const blocked = await blockThirdParty(page);
  const before = await serverState();
  await bootMap(page);
  await showNationalBoundary(page);

  const loaded = await page.evaluate((id) => {
    const state = window.__nwg.L.get(id);
    const feature = state.obj.features[0];
    return {
      count: state.obj.features.length,
      fill: feature.fill0,
      kind: state.obj.kind,
      hasCoordinates: feature.parts.length > 0,
      stack: window.__nwg.stack,
    };
  }, NATIONAL_BOUNDARY);
  expect(loaded).toMatchObject({ count: 1, fill: '#2c7a7b', kind: 'polygon', hasCoordinates: true });
  expect(loaded.stack).toContain(NATIONAL_BOUNDARY);

  const after = await serverState();
  const compressed = '/data/admin_country_geoboundaries_pg.geojson.gz';
  const uncompressed = '/data/admin_country_geoboundaries_pg.geojson';
  expect((after.requestCounts[compressed] || 0) - (before.requestCounts[compressed] || 0)).toBe(1);
  expect((after.requestCounts[uncompressed] || 0) - (before.requestCounts[uncompressed] || 0)).toBe(0);

  const row = page.locator(`#layerlist .lrow[data-id="${NATIONAL_BOUNDARY}"]`);
  await expect(row.locator('a[download][href$=".geojson"]')).toHaveCount(0);
  await page.locator('.tab[data-tab="tools"]').click();
  await page.locator('[data-tool="export"]').click();
  await expect(page.locator('#modal')).toBeVisible();
  await expect(page.locator('#modal-title')).toHaveText('Export results');
  await expect(page.locator('#e-geo')).toHaveCount(0);
  await expect(page.locator('#modal-body')).not.toContainText('GeoJSON');
  await expect(page.locator('#e-png')).toBeVisible();
  await expect(page.locator('#e-csv')).toHaveCount(0);
  await page.locator('#modal-close').click();

  await page.locator('.tab[data-tab="legend"]').click();
  const legend = page.locator(`#legend .lg[data-layer="${NATIONAL_BOUNDARY}"]`);
  await expect(legend.locator('.lghead')).toContainText('National boundary (geoBoundaries)');
  await expect(legend.locator('.lgrow')).toHaveCount(1);
  await expect(legend.locator('.lgrow .t')).toHaveText('National boundary (geoBoundaries)');
  await expect(legend.locator('.lgsw')).toHaveCSS('background-color', 'rgb(44, 122, 123)');

  expectOnlyTileHostsBlocked(blocked);
  expect(errors).toEqual([]);
});
