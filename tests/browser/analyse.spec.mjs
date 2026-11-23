import { test, expect } from '@playwright/test';
import { blockThirdParty, bootMap, capturePageErrors } from './helpers.mjs';

function ring(lon0, lat0, lon1, lat1) {
  const x = (lon) => (lon + 180) / 360;
  const y = (lat) => {
    const s = Math.sin(lat * Math.PI / 180);
    return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  };
  const west = x(lon0), east = x(lon1), north = y(lat1), south = y(lat0);
  return [west, north, east, north, east, south, west, south, west, north];
}
function merc(lon, lat) {
  const x = (lon + 180) / 360;
  const s = Math.sin(lat * Math.PI / 180);
  return [x, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)];
}

test('remaining analysis tools measure, count and summarise', async ({ page }) => {
  const errors = capturePageErrors(page);
  await blockThirdParty(page);
  await bootMap(page);
  await page.locator('.tab[data-tab="tools"]').click();

  await page.locator('[data-tool="nearest"]').click();
  await expect(page.locator('#modal-body')).toContainText('Turn on two vector layers');
  await page.locator('#modal-close').click();
  await page.locator('[data-tool="count"]').click();
  await expect(page.locator('#modal-body')).toContainText('polygon layer and a point layer');
  await page.locator('#modal-close').click();
  await page.locator('[data-tool="zonal"]').click();
  await expect(page.locator('#modal-body')).toContainText('raster and a polygon layer');
  await page.locator('#modal-close').click();

  const west = ring(7, 9, 8, 10);
  const east = ring(7.5, 9.2, 8.5, 9.8);
  const [ix, iy] = merc(7.6, 9.5);
  const [ox, oy] = merc(6.5, 9.5);
  const [lx, ly] = merc(7, 9);
  const [mx, my] = merc(8, 9.4);
  const [rx, ry] = merc(9, 9);
  await page.evaluate(({ west, east, ix, iy, ox, oy, line }) => {
    const poly = (name, coords) => {
      const xs = [], ys = [];
      for (let i = 0; i < coords.length; i += 2) { xs.push(coords[i]); ys.push(coords[i + 1]); }
      return { type: 'poly', idx: 0, hidden: false, props: { name, zone: name }, parts: [[coords]], bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
    };
    const point = (name, x, y, people) => ({ type: 'point', idx: 0, hidden: false, props: { name, people }, parts: [x, y], bb: [x, y, x, y] });
    const add = (id, label, kind, features, extra = {}) => {
      window.__nwg.L.set(id, { meta: { id, label, kind, group: 'analyse-test', fields: extra.fields || [], bounds: [6, 8, 10, 11] }, on: true, obj: { labelField: 'name', features, ...extra.obj } });
      window.__nwg.stack.push(id);
    };
    add('an_polys', 'Analyse polygons', 'polygon', [poly('West', west), poly('East', east)], { fields: [{ name: 'name', type: 'text', label: 'Name' }, { name: 'zone', type: 'text', label: 'Zone' }] });
    add('an_pts', 'Analyse points', 'point', [point('Inside', ix, iy, 4), point('Outside', ox, oy, 9)], { fields: [{ name: 'name', type: 'text', label: 'Name' }, { name: 'people', type: 'number', label: 'People' }] });
    add('an_line', 'Analyse line', 'line', [{ type: 'line', idx: 0, hidden: false, props: { name: 'Bent' }, parts: [line], bb: [Math.min(line[0], line[2], line[4]), Math.min(line[1], line[3], line[5]), Math.max(line[0], line[2], line[4]), Math.max(line[1], line[3], line[5])] }], { fields: [{ name: 'name', type: 'text', label: 'Name' }] });
    const w = 4, h = 4;
    const data = new Float32Array(w * h);
    data.fill(10);
    data[0] = NaN;
    add('an_raster', 'Analyse raster', 'raster', null, { obj: { vals: { w, h, wb: [west[0], west[1], west[4], west[5]], dtype: 'f4', data } } });
  }, { west, east, ix, iy, ox, oy, line: [lx, ly, mx, my, rx, ry] });

  await page.locator('[data-tool="count"]').click();
  await expect(page.locator('#cp-poly')).toHaveValue('an_polys');
  await expect(page.locator('#cp-pt')).toHaveValue('an_pts');
  await page.locator('#cp-field').selectOption('people');
  await page.locator('#cp-zero').check();
  await page.locator('#cp-go').click();
  await expect(page.locator('#modal-title')).toHaveText('Count Points in Polygons');
  await expect(page.locator('#modal-body')).toContainText('shared border');
  await expect(page.locator('#modal-body')).toContainText('never include latitude');
  const counted = await page.evaluate(() => window.__nwg.analysisLayers.at(-1).features.map((f) => ({ name: f.props.polygon, n: f.props.point_count, sum: f.props.people_sum })));
  expect(counted.find((r) => r.name === 'West')).toEqual({ name: 'West', n: 1, sum: 4 });
  expect(counted.find((r) => r.name === 'East')).toEqual({ name: 'East', n: 1, sum: 4 });

  await page.locator('#modal-close').click();
  await page.locator('[data-tool="nearest"]').click();
  await expect(page.locator('#nn-a')).toHaveValue('an_polys');
  await expect(page.locator('#nn-b')).not.toHaveValue('an_polys');
  await page.locator('#nn-a').selectOption('an_pts');
  await page.locator('#nn-b').selectOption('an_polys');
  await page.locator('#nn-go').click();
  await expect(page.locator('#modal-title')).toHaveText('Nearest Neighbor');
  await expect(page.locator('#modal-body')).toContainText('Already touching');
  const nearest = await page.evaluate(() => window.__nwg.analysisLayers.at(-1).features.map((f) => f.props));
  const inside = nearest.find((r) => r.from === 'Inside');
  expect(inside.distance_km).toBe(0);
  expect(inside.to).toBe('West');
  expect(nearest.find((r) => r.from === 'Outside').distance_km).toBeGreaterThan(0);

  await page.locator('#modal-close').click();
  await page.locator('[data-tool="hull"]').click();
  await page.locator('#hu-layer').selectOption('an_line');
  await page.locator('#hu-go').click();
  await expect(page.locator('#modal-title')).toHaveText('Convex Hull');
  const hull = await page.evaluate(() => {
    const feature = window.__nwg.analysisLayers.at(-1).features[0];
    return { corners: feature.props.corners, area: feature.props.area_km2 };
  });
  expect(hull.corners).toBe(3);
  expect(hull.area).toBeGreaterThan(0);

  await page.locator('#modal-close').click();
  await page.locator('[data-tool="simplify"]').click();
  await page.locator('#sy-layer').selectOption('an_line');
  await page.locator('#sy-tol').fill('500000');
  await page.locator('#sy-go').click();
  await expect(page.locator('#modal-title')).toHaveText('Simplify Geometry');
  const simple = await page.evaluate(() => {
    const feature = window.__nwg.analysisLayers.at(-1).features[0];
    const original = window.__nwg.L.get('an_line').obj.features[0];
    return { after: feature.parts[0].length, before: original.parts[0].length };
  });
  expect(simple.before).toBe(6);
  expect(simple.after).toBe(4);

  await page.locator('#modal-close').click();
  await page.locator('[data-tool="zonal"]').click();
  await page.locator('#zn-poly').selectOption('an_polys');
  await page.locator('#zn-raster').selectOption('an_raster');
  await page.locator('#zn-budget').selectOption('80000');
  await page.locator('#zn-go').click();
  await expect(page.locator('#modal-title')).toHaveText('Zonal Statistics');
  await expect(page.locator('#modal-body')).toContainText('NoData was skipped');
  const zonal = await page.evaluate(() => window.__nwg.analysisLayers.at(-1).features.map((f) => ({ name: f.props.polygon, samples: f.props.samples, mean: f.props.mean })));
  expect(zonal.find((r) => r.name === 'West').samples).toBeGreaterThan(0);
  expect(zonal.find((r) => r.name === 'West').mean).toBe(10);
  expect(zonal.find((r) => r.name === 'East').samples).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
