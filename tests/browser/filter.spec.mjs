import { test, expect } from '@playwright/test';
import { blockThirdParty, bootMap, capturePageErrors, settle } from './helpers.mjs';

const STATES = 'admin_states_gadm_pg';
const LGAS = 'admin_lgas_gadm_pg';

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
    return Boolean(layer?.on && layer.obj?.features?.length);
  }, id, { timeout: 60_000 });
  await page.locator('#layerfilter').fill('');
}

async function shown(page, id) {
  return page.evaluate((layerId) => {
    const st = window.__nwg.L.get(layerId);
    return {
      rules: Array.isArray(st.filter) ? st.filter.length : 0,
      count: st.filterCount,
      names: st.obj.features.filter((f) => !f.hidden).map((f) => f.props.state),
    };
  }, id);
}

test('filters stack on any active layer and can be edited or removed', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = capturePageErrors(page);
  await blockThirdParty(page);
  await bootMap(page);
  await enableLayer(page, STATES, 'States (GADM)');
  await enableLayer(page, LGAS, 'Local government areas (GADM)');

  await page.evaluate(() => window.__nwg.toolFilter());
  await expect(page.locator('#modal-title')).toHaveText('Filter features');
  await expect(page.locator('#f-list')).toContainText('No filters yet');

  const picker = await page.evaluate(() => ({
    ids: [...document.querySelectorAll('#f-layer option')].map((o) => o.value),
    off: [...document.querySelectorAll('#f-layer option')].map((o) => o.value).filter((id) => !window.__nwg.L.get(id)?.on),
  }));
  expect(picker.ids).toContain(STATES);
  expect(picker.ids).toContain(LGAS);
  expect(picker.ids).not.toContain('admin_country_geoboundaries_pg');
  expect(picker.off).toEqual([]);

  await page.locator('#f-apply').click();
  await expect(page.locator('#toast')).toContainText(/Enter a value|Pick a field/);
  expect(errors).toEqual([]);

  await page.locator('#f-layer').selectOption(STATES);
  await page.locator('#f-field').selectOption('state');
  await page.locator('#f-op').selectOption('eq');
  await page.locator('#f-value').fill('Lagos');
  await page.locator('#f-apply').click();
  await expect(page.locator('#f-list .fitem')).toHaveCount(1);
  await expect(page.locator('#f-list .fn')).toHaveText('1');
  await expect(page.locator('#f-list')).toContainText('Lagos');
  expect(await shown(page, STATES)).toMatchObject({ rules: 1, count: 1, names: ['Lagos'] });

  await page.locator('#f-field').selectOption('area_km2');
  await page.locator('#f-op').selectOption('gt');
  await page.locator('#f-value').fill('10000');
  await page.locator('#f-apply').click();
  await expect(page.locator('#f-list .fitem')).toHaveCount(2);
  await expect(page.locator('#f-list .fn').nth(1)).toHaveText('2');
  await expect(page.locator('#f-list')).toContainText('combined');
  expect(await shown(page, STATES)).toMatchObject({ rules: 2, count: 0, names: [] });

  await page.locator('#f-layer').selectOption(LGAS);
  await page.locator('#f-field').selectOption('state');
  await page.locator('#f-op').selectOption('eq');
  await page.locator('#f-value').fill('Lagos');
  await page.locator('#f-apply').click();
  await expect(page.locator('#f-list .fitem')).toHaveCount(3);
  await expect(page.locator('#f-list .fn').nth(2)).toHaveText('3');
  expect(await shown(page, LGAS)).toMatchObject({ rules: 1, count: 20 });
  expect((await shown(page, STATES)).count).toBe(0);

  await page.locator('#f-list .fitem').nth(1).locator('[data-frm]').click();
  await expect(page.locator('#f-list .fitem')).toHaveCount(2);
  await expect(page.locator('#f-list .fn').nth(0)).toHaveText('1');
  await expect(page.locator('#f-list .fn').nth(1)).toHaveText('2');
  expect(await shown(page, STATES)).toMatchObject({ rules: 1, count: 1, names: ['Lagos'] });
  expect((await shown(page, LGAS)).count).toBe(20);

  await page.locator('#f-list .fitem').nth(0).locator('[data-fedit]').click();
  await expect(page.locator('#f-form-title')).toHaveText('Edit filter 1');
  await page.locator('#f-value').fill('Kano');
  await page.locator('#f-apply').click();
  await expect(page.locator('#f-form-title')).toHaveText('Add a filter');
  await expect(page.locator('#f-list')).toContainText('Kano');
  await expect(page.locator('#f-list .fn').nth(0)).toHaveText('1');
  expect(await shown(page, STATES)).toMatchObject({ rules: 1, count: 1, names: ['Kano'] });
  expect((await shown(page, LGAS)).count).toBe(20);

  await page.locator('#modal-close').click();
  const sheetClosed = await page.evaluate(() => document.querySelector('#sheet').classList.contains('closed'));
  if (sheetClosed) await page.locator('.tab[data-tab="layers"]').click();
  await expect(page.locator('#activelist .flist .fitem')).toHaveCount(2);
  await expect(page.locator('#activelist .fn').first()).toHaveText('1');
  await page.locator('#activelist .fitem').nth(1).locator('[data-frm]').click();
  await expect(page.locator('#activelist .flist .fitem')).toHaveCount(1);
  expect((await shown(page, LGAS)).rules).toBe(0);
  expect((await shown(page, STATES)).names).toEqual(['Kano']);

  await settle(page);
  expect(errors).toEqual([]);
});
