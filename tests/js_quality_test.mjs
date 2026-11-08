import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { qualityPanelHTML, qualityDetailHTML, qualityPresentation, metadataGapLabels } from '../app/js/quality.js';
import { DEFAULT_VECTOR_COLOR, prepareFeature } from '../app/js/engine.js';

const catalog = JSON.parse(readFileSync('public/catalog.json', 'utf8'));
const overview = qualityPanelHTML(catalog);
assert.match(overview, /<b>59<\/b><small>published layers/);
assert.match(overview, /<b>47<\/b><small>published layers have metadata gaps/);
assert.match(overview, /<b>86<\/b><small>layers with gaps across all 98 sources/);
assert.match(overview, /39 hidden/);
assert.match(overview, /82 pass applicable structural checks/);
assert.match(overview, /16 hidden originals retain historical defects/);
assert.match(overview, /groundwater_boreholes_wpdx_pt/);
assert.match(overview, /quality-register\.json/);
assert.match(overview, /Evidence, not a score/);
assert.ok(!overview.includes('undefined'));
assert.ok(!overview.includes('NaN'));

const review = qualityPanelHTML(catalog, 'groundwater_boreholes_wpdx_pt');
const boreholes = catalog.layers.find((layer) => layer.id === 'groundwater_boreholes_wpdx_pt');
assert.match(review, /Review required/);
assert.match(review, /314 LGA-name joins/);
assert.match(review, /5 of 6 tracked fields recorded/);
assert.match(review, /Not recorded: Temporal coverage/);
assert.match(review, /CC BY-SA 4\.0/);
assert.ok(review.includes(boreholes.quality.sourceSha256));
assert.match(review, /structural pass/);
assert.match(review, /Catalog overview and full register/);

const igrac = qualityPanelHTML(catalog, 'groundwater_transboundary_igrac2025_pg');
assert.match(igrac, /6 of 6 tracked fields recorded/);
assert.match(igrac, /2025 edition/);
assert.match(igrac, /CC BY-SA 3\.0 IGO/);
assert.match(igrac, /transboundary system/);
assert.match(igrac, /All six tracked source fields are recorded/);

const gadm = catalog.layers.find((layer) => layer.id === 'admin_states_gadm_pg');
assert.deepEqual(metadataGapLabels(gadm.sourceMetadata), ['Licence / terms', 'Temporal coverage']);
const gadmHTML = qualityDetailHTML(gadm);
assert.match(gadmHTML, /Licence evidence<\/div><div>not recorded/);
assert.match(gadmHTML, /Temporal coverage<\/div><div><span class="quality-missing">Not recorded/);
assert.equal(qualityPresentation(gadm).tone, 'pass');
assert.equal(qualityPresentation(boreholes).tone, 'review');

const hostile = structuredClone(boreholes);
hostile.label = '<img src=x onerror=alert(1)>';
hostile.sourceMetadata.url = 'javascript:alert(1)';
hostile.sourceMetadata.publisher = '<b>publisher</b>';
hostile.sourceMetadata.notes = '<script>alert(1)</script>';
hostile.quality.limitations = ['<svg onload=alert(1)>'];
const escaped = qualityDetailHTML(hostile);
assert.ok(!escaped.includes('<img src=x'));
assert.ok(!escaped.includes('<script>'));
assert.ok(!escaped.includes('<svg onload'));
assert.ok(!escaped.includes('href="javascript:'));
assert.ok(escaped.includes('&lt;img src=x'));
assert.ok(escaped.includes('&lt;script&gt;'));

const empty = qualityPanelHTML({ layers: [{ id: 'unreviewed' }] });
assert.match(empty, /No quality judgment is inferred/);
assert.equal(DEFAULT_VECTOR_COLOR, '#7a7a7a');
const plain = prepareFeature({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [7, 9] } }, { mode: 'single' }, 0);
assert.equal(plain.fill, DEFAULT_VECTOR_COLOR);
const appSource = readFileSync('app/js/app.js', 'utf8');
assert.match(appSource, /DEFAULT_VECTOR_COLOR/);
assert.ok(!appSource.includes('s.color || palette'), 'single-colour legends must use the defined shared fallback');

console.log('Quality transparency renderer and escaping tests passed.');
