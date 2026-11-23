import { test, expect } from '@playwright/test';
import { blockThirdParty, bootMap, capturePageErrors, showNationalBoundary, NATIONAL_BOUNDARY } from './helpers.mjs';

const PAINT = '#ff00aa';

function mercRect() {
  const x = (lon) => (lon + 180) / 360;
  const y = (lat) => {
    const s = Math.sin(lat * Math.PI / 180);
    return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  };
  return [x(7), y(10), x(8), y(9)];
}

test('share link reopens the view and not the colours', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await blockThirdParty(page);
  await bootMap(page);
  await showNationalBoundary(page);
  await page.locator('#lyrtools [data-x="grid"]').click();
  await page.evaluate(({ id, paint, wb }) => {
    window.__nwg.setFocus({ type: 'rect', wb }, false);
    window.__nwg.map.setBasemap('dark');
    const st = window.__nwg.L.get(id);
    st.sym = { fillMode: 'single', fill: paint, stroke: paint, fillOpacity: 1 };
    if (st.obj) st.obj.sym = st.sym;
    window.__nwg.L.set('imp_share', {
      meta: { id: 'imp_share', label: 'Imported sample', kind: 'point', group: 'imported' },
      on: true, obj: { features: [] },
    });
    window.__nwg.stack.push('imp_share');
  }, { id: NATIONAL_BOUNDARY, paint: PAINT, wb: mercRect() });

  await page.locator('.tab[data-tab="tools"]').click();
  const openTool = (id) => page.evaluate((tool) => document.querySelector(`[data-tool="${tool}"]`)?.click(), id);
  await openTool('mapnotes');
  await expect(page.locator('#modal.modal-map')).toBeVisible();
  await page.locator('#mn-text').fill('Check this area');
  await page.locator('#mn-add').click();
  await expect(page.locator('#toast')).toContainText('Added “Check this area”');
  await expect(page.locator('#mn-list')).toContainText('Check this area');
  await expect(page.locator('#mn-list')).not.toContainText('°');

  const before = await page.evaluate(() => {
    const n = window.__nwg.notes[0];
    const [x, y] = window.__nwg.map.screenOf(n.lon, n.lat);
    return { x, y, lon: n.lon };
  });
  await page.mouse.move(before.x, before.y);
  await page.mouse.down();
  await page.mouse.move(before.x + 80, before.y + 24);
  await page.mouse.up();
  await expect(page.locator('#toast')).toContainText('Moved “Check this area”');
  const moved = await page.evaluate(() => window.__nwg.notes[0].lon);
  expect(Math.abs(moved - before.lon)).toBeGreaterThan(0.01);

  await openTool('shareview');
  await expect(page.locator('#modal.modal-map')).toBeVisible();
  await expect(page.locator('#map')).toBeVisible();
  await expect(page.locator('#modal-body')).toContainText('Colours, filters and notes are not');
  await expect(page.locator('#modal-body')).toContainText('Imported sample');
  await expect(page.locator('#modal-body')).toContainText('Use a session code');
  const url = await page.locator('#sv-url').inputValue();
  expect(url).toContain(NATIONAL_BOUNDARY);
  expect(url).toContain('b=dark');
  expect(url).toContain('g=1');
  expect(url).toContain('f=');
  expect(url).not.toContain('imp_share');
  expect(url).not.toContain('Check this area');
  expect(url).not.toContain(PAINT);

  await page.evaluate(() => localStorage.clear());
  await page.goto(url);
  await page.waitForFunction(() => window.__nwg?.L?.size === 59);
  await page.waitForFunction((id) => window.__nwg.L.get(id)?.on, NATIONAL_BOUNDARY);
  const restored = await page.evaluate((id) => ({
    base: window.__nwg.map.basemap,
    on: window.__nwg.L.get(id).on,
    paint: window.__nwg.L.get(id).sym?.fill || '',
    clip: window.__nwg.clip?.type || '',
    notes: window.__nwg.notes.length,
    grid: document.querySelector('#lyrtools [data-x="grid"]')?.classList.contains('on'),
  }), NATIONAL_BOUNDARY);
  expect(restored.base).toBe('dark');
  expect(restored.on).toBe(true);
  expect(restored.paint).not.toBe(PAINT);
  expect(restored.clip).toBe('rect');
  expect(restored.notes).toBe(0);
  expect(restored.grid).toBe(true);
  expect(errors).toEqual([]);
});

test('a session code carries the map to another browser', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await blockThirdParty(page);
  await bootMap(page);
  await showNationalBoundary(page);
  await page.evaluate(({ id, paint }) => {
    const st = window.__nwg.L.get(id);
    st.sym = { fillMode: 'single', fill: paint, stroke: paint, fillOpacity: 1 };
    if (st.obj) st.obj.sym = st.sym;
    window.__nwg.map.setBasemap('streets');
  }, { id: NATIONAL_BOUNDARY, paint: PAINT });

  await page.locator('.tab[data-tab="tools"]').click();
  const openTool = (id) => page.evaluate((tool) => document.querySelector(`[data-tool="${tool}"]`)?.click(), id);
  await openTool('mapnotes');
  await page.locator('#mn-text').fill('Field note');
  await page.locator('#mn-add').click();
  await expect(page.locator('#mn-list')).toContainText('Field note');

  await openTool('session');
  await expect(page.locator('#modal.modal-map')).toBeVisible();
  await expect(page.locator('#modal-body')).toContainText('not on a server');
  await expect(page.locator('#modal-body')).toContainText('only works in the browser that saved it');
  await page.locator('#ss-name').fill('Field check');
  await page.locator('#ss-save').click();
  await expect(page.locator('#toast')).toContainText('Saved “Field check”');
  await expect(page.locator('#ss-list')).toContainText('this browser');
  const localCode = (await page.locator('#ss-list .ft b').first().innerText()).trim();
  expect(localCode).toMatch(/^[A-Z0-9]{6}$/);
  const portable = await page.locator('#ss-portable').inputValue();
  expect(portable.startsWith('NW1.')).toBe(true);
  expect(portable).not.toMatch(/latitude|longitude/i);

  await page.locator('#ss-list [data-del]').click();
  await expect(page.locator('#ss-list')).toContainText('No sessions saved');
  await page.locator('#ss-code').fill(localCode);
  await page.locator('#ss-restore').click();
  await expect(page.locator('#toast')).toContainText('only works where it was saved');

  await page.evaluate((id) => {
    const st = window.__nwg.L.get(id);
    st.sym = { fillMode: 'single', fill: '#111111', stroke: '#111111' };
    if (st.obj) st.obj.sym = st.sym;
    st.on = false;
    if (st.obj) st.obj.visible = false;
    const i = window.__nwg.stack.indexOf(id);
    if (i >= 0) window.__nwg.stack.splice(i, 1);
    window.__nwg.notes.splice(0, window.__nwg.notes.length);
    window.__nwg.map.setBasemap('none');
  }, NATIONAL_BOUNDARY);

  await page.locator('#ss-code').fill(portable);
  await page.locator('#ss-restore').click();
  await expect(page.locator('#toast')).toContainText('Restored “Field check”', { timeout: 20000 });
  await expect(page.locator('#toast')).not.toContainText(NATIONAL_BOUNDARY);
  const back = await page.evaluate((id) => ({
    on: window.__nwg.L.get(id).on,
    paint: window.__nwg.L.get(id).sym?.fill,
    note: window.__nwg.notes[0]?.text || '',
    base: window.__nwg.map.basemap,
  }), NATIONAL_BOUNDARY);
  expect(back.on).toBe(true);
  expect(back.paint).toBe(PAINT);
  expect(back.note).toBe('Field note');
  expect(back.base).toBe('streets');
  expect(errors).toEqual([]);
});
