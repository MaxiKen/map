import { test, expect } from '@playwright/test';
import { blockThirdParty, bootMap, capturePageErrors, settle } from './helpers.mjs';

// Clip to an area used to be silently broken: the drag handlers read the drawing state
// after it had already been cleared, so rectangle, square and circle never produced a
// focus area, and several picked features collapsed into a single unusable clip.

const LGA = 'admin_lgas_gadm_pg';

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
  if (!(await page.evaluate((layerId) => Boolean(window.__nwg.L.get(layerId)?.on), id))) await row.locator('.sw').click();
  await page.waitForFunction((layerId) => {
    const layer = window.__nwg.L.get(layerId);
    return Boolean(layer?.obj?.features?.length && layer.on);
  }, id, { timeout: 60_000 });
  await page.locator('#layerfilter').fill('');
}

async function openMap(page) {
  await blockThirdParty(page);
  await bootMap(page);
  await enableLayer(page, LGA, 'Local government areas (GADM)');
  await page.evaluate(() => {
    document.querySelector('#sheet').classList.add('closed');
    window.__nwg.stopFocus();
    window.__nwg.map.setView(8.5, 11.5, 8.2);
  });
  await settle(page);
}

// a URL without any one-off query state, so a reload starts from the saved project
const plainUrl = (page) => page.evaluate(() => {
  const u = new URL(location.href); u.search = ''; u.hash = '#l=&b=none';
  return u.href;
});

const clipState = (page) => page.evaluate(() => ({
  type: window.__nwg.clip?.type || null,
  clipped: !!window.__nwg.map.clip,
  polys: window.__nwg.clip?.polys?.length || 0,
  area: Math.round(window.__nwg.focusAreaKm2()),
  bounds: window.__nwg.map.clipBounds(),
}));

test('clipping: rectangle draws and clips', async ({ page }) => {
  const errors = capturePageErrors(page);
  await openMap(page);
  await page.evaluate(() => window.__nwg.startDraw('rect'));
  await page.mouse.move(400, 300);
  await page.mouse.down();
  await page.mouse.move(820, 620, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const s = await clipState(page);
  expect(s.type).toBe('rect');
  // the toast is not enough: the map itself has to be clipped
  expect(s.clipped).toBe(true);
  expect(s.area).toBeGreaterThan(1000);
  // a rectangle used to be stored upside down, which the engine silently refused
  const inside = await page.evaluate(() => {
    const m = window.__nwg.map;
    const [wx, wy] = m.fromScreen(610, 460);
    return m.clipContainsPoint(wx, wy);
  });
  expect(inside).toBe(true);
  expect(await page.evaluate(() => window.__nwg.map.identify(60, 120).length)).toBe(0);
  expect(errors).toEqual([]);
});

test('clipping: Current view clips to everything on screen', async ({ page }) => {
  const errors = capturePageErrors(page);
  await openMap(page);
  await page.evaluate(() => document.querySelector('[data-tool="clip"]')?.click());
  await page.click('[data-act="view"]');
  await page.waitForTimeout(400);
  const s = await clipState(page);
  expect(s.type).toBe('rect');
  expect(s.clipped).toBe(true);
  expect(s.area).toBeGreaterThan(1000);
  // all four corners of the map must be inside the focus, the world outside it must not
  const corners = await page.evaluate(() => {
    const m = window.__nwg.map;
    return [[1, 1], [m.W - 2, 1], [m.W - 2, m.H - 2], [1, m.H - 2]]
      .map(([x, y]) => { const [wx, wy] = m.fromScreen(x, y); return m.clipContainsPoint(wx, wy); });
  });
  expect(corners).toEqual([true, true, true, true]);
  expect(await page.evaluate(() => {
    const m = window.__nwg.map; const [wx, wy] = m.fromScreen(-200, -200);
    return m.clipContainsPoint(wx, wy);
  })).toBe(false);
  expect(errors).toEqual([]);
});

test('clipping: the area summary has no CSV export', async ({ page }) => {
  const errors = capturePageErrors(page);
  await openMap(page);
  await page.evaluate(() => window.__nwg.focusFromRect([7.5, 11], [9, 12]));
  await page.evaluate(() => document.querySelector('[data-tool="aoi"]')?.click());
  // the summary is counted after a tick, so wait for the finished panel
  await expect(page.locator('#modal')).toContainText('Focus area:');
  const acts = await page.evaluate(() => [...document.querySelectorAll('#modal [data-act]')].map((b) => b.textContent.trim()));
  expect(acts).toContain('Clear focus');
  expect(acts.some((t) => /csv/i.test(t))).toBe(false);
  expect(await page.evaluate(() => /export summary/i.test(document.body.textContent))).toBe(false);
  expect(errors).toEqual([]);
});

test('clipping: square has equal ground sides and clips', async ({ page }) => {
  const errors = capturePageErrors(page);
  await openMap(page);
  await page.evaluate(() => window.__nwg.startDraw('square'));
  await page.mouse.move(420, 300);
  await page.mouse.down();
  await page.mouse.move(900, 520, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const shape = await page.evaluate(() => {
    const bb = window.__nwg.map.clipBounds();
    const mid = (bb[1] + bb[3]) / 2;
    return {
      type: window.__nwg.clip?.type,
      widthKm: (bb[2] - bb[0]) * 111.32 * Math.cos((mid * Math.PI) / 180),
      heightKm: (bb[3] - bb[1]) * 110.57,
      area: Math.round(window.__nwg.focusAreaKm2()),
    };
  });
  expect(shape.type).toBe('rect');
  // a square must be square on the ground, not only on screen
  expect(Math.abs(shape.widthKm - shape.heightKm) / shape.widthKm).toBeLessThan(0.02);
  expect(shape.area).toBeGreaterThan(1000);
  expect(errors).toEqual([]);
});

test('clipping: circle measures a real ground radius', async ({ page }) => {
  const errors = capturePageErrors(page);
  await openMap(page);
  await page.evaluate(() => window.__nwg.startDraw('circle'));
  await page.mouse.move(640, 430);
  await page.mouse.down();
  await page.mouse.move(840, 430, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const c = await page.evaluate(() => ({
    type: window.__nwg.clip?.type,
    metres: window.__nwg.clip?.metres,
    area: window.__nwg.focusAreaKm2(),
    perimeter: window.__nwg.focusPerimeterKm(),
  }));
  expect(c.type).toBe('circle');
  // area and perimeter must agree with the radius the app reports
  expect(c.area).toBeGreaterThan(500);
  expect(c.perimeter).toBeCloseTo((2 * Math.PI * c.metres) / 1000, 1);
  expect(errors).toEqual([]);
});

test('clipping: a drawn polygon closes with Done', async ({ page }) => {
  const errors = capturePageErrors(page);
  await openMap(page);
  await page.evaluate(() => window.__nwg.startDraw('poly'));
  // the map emits a tap ~300 ms after pointerup, so wait for the corner count, not a fixed delay
  let corners = 0;
  for (const [x, y] of [[420, 300], [820, 330], [760, 620], [470, 560]]) {
    await page.mouse.click(x, y);
    corners += 1;
    await page.waitForFunction((n) => window.__nwg.draw?.pts?.length === n, corners, { timeout: 5000 });
  }
  await page.click('#drawdone');
  await page.waitForTimeout(400);
  const s = await clipState(page);
  expect(s.type).toBe('poly');
  expect(s.area).toBeGreaterThan(1000);
  expect(errors).toEqual([]);
});

test('clipping: several picked features stay separate shapes', async ({ page }) => {
  const errors = capturePageErrors(page);
  await openMap(page);
  await page.evaluate(() => document.querySelector('[data-tool="clip"]')?.click());
  await page.click('[data-act="multi"]');
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    [...document.querySelectorAll('#mp-list input[type=checkbox]')].slice(0, 3)
      .forEach((c) => { c.checked = true; c.dispatchEvent(new Event('change')); });
  });
  await expect(page.locator('#mp-apply')).toHaveText('Clip to 3 selected');
  await page.click('#mp-apply');
  await page.waitForTimeout(500);

  const s = await clipState(page);
  expect(s.type).toBe('multi');
  // three separate LGAs must remain three separate clip shapes
  expect(s.polys).toBe(3);
  expect(s.area).toBeGreaterThan(100);
  expect(await page.evaluate(() => document.querySelector('#toast').textContent)).toMatch(/Clipped to 3 shapes/);
  expect(errors).toEqual([]);
});

test('clipping: the polygon picker offers layers and keeps picks across them', async ({ page }) => {
  const errors = capturePageErrors(page);
  await openMap(page);
  await page.evaluate(() => document.querySelector('[data-tool="clip"]')?.click());
  await page.click('[data-act="multi"]');
  await page.waitForTimeout(300);

  // the picker must list real layers to choose from
  const layers = await page.evaluate(() => [...document.querySelectorAll('#mp-layer option')].map((o) => o.textContent));
  expect(layers.length).toBeGreaterThan(0);
  expect(layers[0]).toContain('Local government areas');

  await page.evaluate(() => {
    const c = document.querySelector('#mp-list input[type=checkbox]');
    c.checked = true;
    c.dispatchEvent(new Event('change'));
  });
  // switching layers must not throw away what was already ticked
  await page.evaluate(() => {
    const sel = document.querySelector('#mp-layer');
    if (sel.options.length > 1) { sel.selectedIndex = 1; sel.dispatchEvent(new Event('change')); }
  });
  await expect(page.locator('#mp-hint')).toContainText('1 in total');
  expect(errors).toEqual([]);
});

test('clipping: tapping shapes on the map picks them, then clips', async ({ page }) => {
  const errors = capturePageErrors(page);
  await openMap(page);
  await page.evaluate(() => document.querySelector('[data-tool="clip"]')?.click());
  await page.click('[data-act="multi"]');
  await page.waitForTimeout(300);
  await page.click('#mp-tap');
  await page.waitForTimeout(300);
  await expect(page.locator('#drawbar')).toBeVisible();

  const spots = await page.evaluate(() => {
    const m = window.__nwg.map, out = [];
    for (let y = 240; y < 700 && out.length < 2; y += 40) {
      for (let x = 300; x < 1000 && out.length < 2; x += 80) {
        const hit = m.identify(x, y).filter((r) => r.feature && r.layer.kind === 'polygon');
        if (hit.length && !out.some(([px, py]) => Math.hypot(px - x, py - y) < 150)) out.push([x, y]);
      }
    }
    return out;
  });
  expect(spots.length).toBe(2);
  for (const [x, y] of spots) { await page.mouse.click(x, y); await page.waitForTimeout(600); }
  expect(await page.evaluate(() => window.__nwg.map.selectionSet.length)).toBe(2);

  await page.click('#drawdone');
  await page.waitForTimeout(400);
  await expect(page.locator('#mp-apply')).toHaveText('Clip to 2 selected');
  await page.click('#mp-apply');
  await page.waitForTimeout(500);
  expect((await clipState(page)).polys).toBe(2);
  expect(errors).toEqual([]);
});

test('clipping: after a clip, tapping the map still reads features', async ({ page }) => {
  const errors = capturePageErrors(page);
  await openMap(page);
  await page.evaluate(() => window.__nwg.startDraw('rect'));
  await page.mouse.move(400, 300);
  await page.mouse.down();
  await page.mouse.move(820, 620, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);

  const inside = await page.evaluate(() => {
    const m = window.__nwg.map;
    for (let y = 340; y < 580; y += 20) for (let x = 440; x < 780; x += 20) {
      if (m.identify(x, y).some((r) => r.feature)) return [x, y];
    }
    return null;
  });
  expect(inside).not.toBeNull();
  await page.mouse.click(inside[0], inside[1]);
  await page.waitForTimeout(700);
  // a normal tap identifies the feature; it must not be swallowed by a stale pick mode
  expect(await page.evaluate(() => document.querySelector('#toast').textContent)).not.toMatch(/Tap inside a polygon/);
  expect(await page.evaluate(() => document.querySelectorAll('#info .card').length)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('clipping: a shared link and a reload bring the same focus back', async ({ page }) => {
  const errors = capturePageErrors(page);
  await openMap(page);

  // a multi clip: three LGAs picked from the list
  await page.evaluate(() => document.querySelector('[data-tool="clip"]')?.click());
  await page.click('[data-act="multi"]');
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    [...document.querySelectorAll('#mp-list input[type=checkbox]')].slice(0, 3)
      .forEach((c) => { c.checked = true; c.dispatchEvent(new Event('change')); });
  });
  await page.click('#mp-apply');
  await page.waitForTimeout(500);
  const before = await clipState(page);
  expect(before.polys).toBe(3);

  // the share link must carry the whole multi clip, not just a bounding box
  const shared = await page.evaluate(() => {
    const u = JSON.parse(decodeURIComponent(new URL(window.__nwg.buildShareUrl()).searchParams.get('f')));
    return { type: u.type, polys: u.polys?.length || 0, label: u.label };
  });
  expect(shared.type).toBe('multi');
  expect(shared.polys).toBe(3);
  expect(shared.label).toMatch(/\+/);

  // and a reload must rebuild it from the saved project
  await page.evaluate(() => window.__nwg.saveProject());
  const url = await plainUrl(page);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__nwg?.L?.size === 59);
  await settle(page);
  const after = await clipState(page);
  expect(after.type).toBe('multi');
  expect(after.polys).toBe(3);
  expect(after.area).toBe(before.area);
  expect(errors).toEqual([]);
});

test('clipping: a saved circle keeps its ground radius', async ({ page }) => {
  const errors = capturePageErrors(page);
  await openMap(page);
  await page.evaluate(() => window.__nwg.startDraw('circle'));
  await page.mouse.move(620, 430);
  await page.mouse.down();
  await page.mouse.move(800, 430, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => ({ metres: window.__nwg.clip.metres, area: window.__nwg.focusAreaKm2() }));
  expect(before.metres).toBeGreaterThan(1000);

  await page.evaluate(() => window.__nwg.saveProject());
  await page.goto(await plainUrl(page), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__nwg?.L?.size === 59);
  await settle(page);
  const after = await page.evaluate(() => ({ type: window.__nwg.clip?.type, metres: window.__nwg.clip?.metres, area: window.__nwg.focusAreaKm2() }));
  expect(after.type).toBe('circle');
  // a restored circle must still know its radius, not its mercator pixels
  expect(after.metres).toBe(before.metres);
  expect(after.area).toBeCloseTo(before.area, 3);
  expect(errors).toEqual([]);
});

test('the only download in the app is a PNG picture', async ({ page }) => {
  const errors = capturePageErrors(page);
  await openMap(page);

  // any download the page starts must be an image
  const downloads = [];
  page.on('download', (d) => downloads.push(d.suggestedFilename()));

  const check = async (label, open, settleMs = 900) => {
    await page.evaluate(() => {
      document.querySelector('#sheet').classList.remove('closed');
      document.querySelector('.tab[data-tab="tools"]')?.click();
    });
    await page.waitForTimeout(250);
    await open();
    await page.waitForTimeout(settleMs);
    const found = await page.evaluate(() => {
      const out = [];
      for (const a of document.querySelectorAll('a[download]')) out.push(`${a.textContent.trim()} -> ${a.getAttribute('href')}`);
      for (const b of document.querySelectorAll('[data-act],[data-x],button')) {
        if (/\bcsv\b|geojson|\bkml\b|shapefile|\.zip\b/i.test(b.textContent)) out.push(`button: ${b.textContent.trim()}`);
      }
      for (const el of document.querySelectorAll('#panel-quality, #panel-layers, #info, #modal')) {
        if (/export summary|download full json|export csv/i.test(el.textContent)) out.push(`text in ${el.id || el.className}`);
      }
      return out;
    });
    expect({ label, found }).toEqual({ label, found: [] });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  };

  await check('quality panel', async () => {
    await page.evaluate(() => {
      document.querySelector('#sheet').classList.remove('closed');
      document.querySelector('.tab[data-tab="quality"]').click();
    });
  });
  await check('select bar + selection list', async () => {
    await page.evaluate(() => window.__nwg.toolSelect());
    await page.locator('[data-act="start"]').click();
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      window.__nwg.selToggle('admin_lgas_gadm_pg', window.__nwg.L.get('admin_lgas_gadm_pg').obj.features[0]);
    });
    await page.locator('#sellist').click();
  });
  // "Select by area" has no Tools button of its own; it is the map-tap query mode
  await check('select by area result', async () => {
    await page.evaluate(() => window.__nwg.toolQuery());
  });
  await check('picture panel', async () => {
    await page.evaluate(() => document.querySelector('[data-tool="export"]').click());
  });
  await check('area summary', async () => {
    await page.evaluate(() => window.__nwg.focusFromRect([7.5, 11], [9, 12]));
    await page.evaluate(() => document.querySelector('[data-tool="aoi"]').click());
  }, 1400);
  await check('attribute table', async () => {
    await page.evaluate(() => document.querySelector('[data-tool="table"]').click());
  });

  // the picture button itself is the one allowed download
  await page.evaluate(() => document.querySelector('[data-tool="export"]').click());
  await page.waitForTimeout(400);
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page.locator('#e-png').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^map-export-[\d-]+\.png$/);
  expect(downloads).toEqual([download.suggestedFilename()]);
  expect(errors).toEqual([]);
});
