import { test, expect } from '@playwright/test';
import { blockThirdParty, bootMap, capturePageErrors } from './helpers.mjs';

function point(lon, lat) {
  const x = (lon + 180) / 360;
  const s = Math.sin(lat * Math.PI / 180);
  const y = 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  return { x, y };
}

test('time tools filter by year and accessibility applies', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await blockThirdParty(page);
  await bootMap(page);
  await page.locator('.tab[data-tab="tools"]').click();
  const openTool = (id) => page.evaluate((tool) => document.querySelector(`[data-tool="${tool}"]`)?.click(), id);

  const a = point(7.4, 9.1);
  const b = point(8.1, 9.4);
  await page.evaluate(({ a, b }) => {
    const feat = (name, year, at, extra = {}) => ({
      type: 'point', idx: 0, hidden: false,
      props: { name, year, report_date: '1970–2000', ...extra },
      parts: new Float64Array([at.x, at.y]),
      fill: '#888888', stroke: '#888888', fill0: '#888888',
      bb: [at.x, at.y, at.x, at.y],
    });
    const add = (id, label, fields, features, extra = {}) => {
      window.__nwg.L.set(id, {
        meta: { id, label, kind: 'point', group: 'time-test', fields, count: features.length, style: { color: '#888888' }, ...extra },
        on: false, opacity: 1, obj: null,
        sym: null, labels: null, filter: null, reclass: null,
        _features: features,
      });
      const st = window.__nwg.L.get(id);
      st.obj = { id, labelField: 'name', kind: 'point', visible: false, features, bounds: [7, 9, 9, 10] };
    };
    add('time_heat', 'Time heatflow', [
      { name: 'name', type: 'text', label: 'Name' },
      { name: 'year', type: 'number', label: 'Year' },
      { name: 'report_date', type: 'text', label: 'Report date' },
    ], [
      feat('Old', 1972, a),
      feat('Mid', 1994.4, a),
      feat('New', 2011, b),
      feat('Blank', '', b),
    ], { sourceMetadata: { temporalCoverage: '1970–2000' } });
    add('time_note', 'Time note only', [
      { name: 'name', type: 'text', label: 'Name' },
    ], [feat('Note', 2001, a)], { sourceMetadata: { temporalCoverage: '1970–2000' } });
    if (!window.__nwg.catalog) throw new Error('catalog is not on the test hook');
    window.__nwg.catalog.layers.push(
      window.__nwg.L.get('time_heat').meta,
      window.__nwg.L.get('time_note').meta,
    );
  }, { a, b });

  await openTool('timelayers');
  await expect(page.locator('#modal.modal-map')).toBeVisible();
  await expect(page.locator('#map')).toBeVisible();
  const heat = page.locator('#tl-list .lrow[data-id="time_heat"]');
  await expect(heat).toContainText('Year');
  await expect(heat).toContainText('1970–2000');
  const note = page.locator('#tl-list .lrow[data-id="time_note"]');
  await expect(note).toContainText('Source period only');
  await note.locator('button[data-act="zoom"]').click();
  await expect(page.locator('#toast')).toContainText('Show Time note only');
  const stillOff = await page.evaluate(() => window.__nwg.L.get('time_note').on);
  expect(stillOff).toBe(false);
  await heat.locator('button[data-act="on"]').click();
  await expect(page.locator('#toast')).toContainText('Turned on Time heatflow');
  const turnedOn = await page.evaluate(() => window.__nwg.L.get('time_heat').on);
  expect(turnedOn).toBe(true);
  await page.locator('#modal-close').click();

  await openTool('timefilter');
  await expect(page.locator('#modal.modal-map')).toBeVisible();
  await expect(page.locator('#tf-field option')).toHaveCount(1);
  await expect(page.locator('#tf-field')).toHaveValue('year');
  await page.locator('#tf-layer').selectOption('time_heat');
  await page.locator('#tf-op').selectOption('range');
  await page.locator('#tf-min').fill('1990');
  await page.locator('#tf-max').fill('2011');
  await page.locator('#tf-apply').click();
  await expect(page.locator('#tf-info')).toContainText('2 of 4');
  const ranged = await page.evaluate(() => {
    const st = window.__nwg.L.get('time_heat');
    return {
      shown: st.obj.features.filter((f) => !f.hidden).map((f) => f.props.name).sort(),
      rule: st.filter.some((r) => r.op === '_temporal'),
    };
  });
  expect(ranged.shown).toEqual(['Mid', 'New']);
  expect(ranged.rule).toBe(true);
  await page.locator('#tf-clear').click();
  await expect(page.locator('#toast')).toContainText('Time filter cleared on Time heatflow');
  const cleared = await page.evaluate(() => window.__nwg.L.get('time_heat').obj.features.filter((f) => f.hidden).length);
  expect(cleared).toBe(0);
  await page.locator('#modal-close').click();

  await openTool('timeslider');
  await expect(page.locator('#modal.modal-map')).toBeVisible();
  await page.locator('#ts-layer').selectOption('time_heat');
  await page.locator('#ts-field').selectOption('year');
  await page.locator('#ts-play').click();
  await expect(page.locator('#ts-span')).toContainText('1972 to 2011');
  await expect(page.locator('#ts-info')).toContainText('1 feature');
  const playing = await page.evaluate(() => window.__nwg.L.get('time_heat').obj.features.filter((f) => !f.hidden).length);
  expect(playing).toBe(1);
  await page.locator('#ts-stop').click();
  await expect(page.locator('#toast')).toContainText('Time filter cleared on Time heatflow');
  const stopped = await page.evaluate(() => ({
    hidden: window.__nwg.L.get('time_heat').obj.features.filter((f) => f.hidden).length,
    rules: (window.__nwg.L.get('time_heat').filter || []).length,
  }));
  expect(stopped.hidden).toBe(0);
  expect(stopped.rules).toBe(0);
  await page.locator('#ts-year').evaluate((el) => {
    el.value = '1980';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#ts-info')).toContainText('0 features in 1980');
  await page.locator('#modal-close').click();
  const afterClose = await page.evaluate(() => window.__nwg.L.get('time_heat').obj.features.filter((f) => !f.hidden).length);
  expect(afterClose).toBe(0);

  await openTool('a11y');
  await expect(page.locator('#a11y-apply')).toHaveCount(0);
  await page.locator('#a11y-hc').check();
  await expect(page.locator('body')).toHaveClass(/a11y-hc/);
  await page.locator('#a11y-motion').check();
  await expect(page.locator('html')).toHaveClass(/a11y-reduce-motion/);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('nwg.a11y')));
  expect(stored.hc).toBe(true);
  expect(stored.motion).toBe(true);
  await page.locator('#a11y-reset').click();
  await expect(page.locator('body')).not.toHaveClass(/a11y-hc/);
  await page.locator('#modal-close').click();

  await openTool('screenreader');
  await page.locator('#sr-announce').click();
  await expect(page.locator('#toast')).toContainText('Turn live announcements on first');
  await page.locator('#sr-toggle').click();
  await expect(page.locator('#sr-toggle')).toContainText('Turn off');
  await page.locator('#sr-announce').click();
  await expect(page.locator('#sr-live')).toContainText('Time heatflow');
  await page.locator('#sr-toggle').click();
  await expect(page.locator('#sr-toggle')).toContainText('Turn on');
  await page.locator('#modal-close').click();

  await openTool('gestures');
  await expect(page.locator('#modal-body')).toContainText('does not report a touch screen');
  await expect(page.locator('#modal-body')).not.toContainText('You are on a touch device');
  await page.locator('#modal-close').click();

  await openTool('colorblind');
  await expect(page.locator('#modal.modal-map')).toBeVisible();
  await expect(page.locator('#cb-ramp option[value="cb_deuteranopia"]')).toHaveCount(1);
  const rampText = await page.locator('#cb-ramp').innerText();
  expect(rampText.toLowerCase()).not.toContain('deuteranopia-safe');
  await page.locator('#cb-layer').selectOption('time_heat');
  await page.locator('#cb-field').selectOption('');
  await page.locator('#cb-ramp').selectOption('cividis');
  await page.locator('#cb-apply').click();
  await expect(page.locator('#toast')).toContainText('Painted Time heatflow');
  const painted = await page.evaluate(() => window.__nwg.L.get('time_heat').sym.fill);
  expect(painted).toMatch(/^#[0-9a-f]{6}$/i);
  await page.locator('#cb-field').selectOption('year');
  await page.locator('#cb-ramp').selectOption('cb_mono');
  await page.locator('#cb-apply').click();
  await expect(page.locator('#toast')).toContainText('Classified Time heatflow');
  const classified = await page.evaluate(() => {
    const st = window.__nwg.L.get('time_heat');
    return { ramp: st.reclass?.ramp, fills: [...new Set(st.obj.features.map((f) => f.fill))] };
  });
  expect(classified.ramp).toBe('cb_mono');
  expect(classified.fills.length).toBeGreaterThan(1);

  expect(errors).toEqual([]);
});
