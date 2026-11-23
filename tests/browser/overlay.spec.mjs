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

test('overlay tools cut, merge and report without coordinates', async ({ page }) => {
  const errors = capturePageErrors(page);
  await blockThirdParty(page);
  await bootMap(page);
  await page.locator('.tab[data-tab="tools"]').click();
  await page.locator('[data-tool="intersect"]').click();
  await expect(page.locator('#modal-body')).toContainText('Turn on two polygon layers');
  await expect(page.locator('#ix-run')).toHaveCount(0);
  await page.locator('#modal-close').click();

  await page.evaluate(({ west, east, band }) => {
    const poly = (name, coords, zone) => {
      const xs = [], ys = [];
      for (let i = 0; i < coords.length; i += 2) { xs.push(coords[i]); ys.push(coords[i + 1]); }
      return {
        type: 'poly', idx: xs.length, hidden: false, props: { name, zone },
        parts: [[coords]],
        bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      };
    };
    const add = (id, label, features) => {
      window.__nwg.L.set(id, {
        meta: {
          id, label, kind: 'polygon', group: 'overlay-test',
          fields: [{ name: 'name', type: 'text', label: 'Name' }, { name: 'zone', type: 'text', label: 'Zone' }],
        },
        on: true,
        obj: { labelField: 'name', features },
      });
      window.__nwg.stack.push(id);
    };
    add('overlay_squares', 'Overlay squares', [poly('West', west, 'plain'), poly('East', east, 'plain')]);
    add('overlay_band', 'Overlay band', [poly('Band', band, 'band')]);
  }, { west: ring(7, 9, 8, 10), east: ring(8, 9, 9, 10), band: ring(7.5, 9.2, 8.5, 9.8) });

  await page.locator('[data-tool="intersect"]').click();
  await expect(page.locator('#ix-a')).toHaveValue('overlay_squares');
  await expect(page.locator('#ix-b')).toHaveValue('overlay_band');
  await page.locator('#ix-run').click();
  await expect(page.locator('#modal-title')).toHaveText('Intersection');
  await expect(page.locator('#modal-body')).toContainText('counts each piece of ground once');
  await expect(page.locator('#modal-body')).toContainText('West');
  await expect(page.locator('#modal-body')).toContainText('East');
  await expect(page.locator('#modal-body')).toContainText('never include latitude');
  const intersection = await page.evaluate(() => {
    const layer = window.__nwg.analysisLayers.at(-1);
    return { label: layer?.id ? layer.features.length : 0, names: layer.features.map((f) => f.props.layer_a) };
  });
  expect(intersection.label).toBe(2);
  expect(intersection.names.sort()).toEqual(['East', 'West']);

  await page.locator('#modal-close').click();
  await page.locator('[data-tool="polyunion"]').click();
  await page.locator('#pu-run').click();
  await expect(page.locator('#modal-title')).toHaveText('Union');
  const union = await page.evaluate(() => {
    const feature = window.__nwg.analysisLayers.at(-1).features[0];
    return { features: feature.props.features_merged, polygons: feature.parts.length, rings: feature.parts[0].length };
  });
  expect(union).toEqual({ features: 2, polygons: 1, rings: 1 });

  await page.locator('#modal-close').click();
  await page.locator('[data-tool="erasefeatures"]').click();
  await expect(page.locator('#ef-input')).toHaveValue('overlay_squares');
  await expect(page.locator('#ef-erase')).toHaveValue('overlay_band');
  await page.locator('#ef-run').click();
  await expect(page.locator('#modal-title')).toHaveText('Difference');
  await expect(page.locator('#modal-body')).toContainText('partly cut');
  const difference = await page.evaluate(() => {
    const features = window.__nwg.analysisLayers.at(-1).features;
    return features.map((f) => ({ name: f.props.feature, removed: f.props.removed_km2, remaining: f.props.remaining_km2 }));
  });
  expect(difference).toHaveLength(2);
  expect(difference.every((row) => row.removed > 0 && row.remaining > 0)).toBe(true);

  await page.locator('#modal-close').click();
  await page.locator('[data-tool="dissolve"]').click();
  await page.locator('#ds-field').selectOption('zone');
  await page.locator('#ds-run').click();
  await expect(page.locator('#modal-title')).toHaveText('Dissolve');
  const dissolved = await page.evaluate(() => {
    const feature = window.__nwg.analysisLayers.at(-1).features[0];
    return { groups: window.__nwg.analysisLayers.at(-1).features.length, merged: feature.props.features_merged, polygons: feature.parts.length };
  });
  expect(dissolved).toEqual({ groups: 1, merged: 2, polygons: 1 });
  expect(errors).toEqual([]);
});
