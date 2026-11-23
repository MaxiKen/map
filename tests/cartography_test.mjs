import assert from 'node:assert/strict';
import { pageFrame } from '../app/js/engine.js';

const wide = pageFrame({ size: 'a4', orient: 'portrait', margin: 15, legend: false }, 1600, 900);
assert.ok(wide.pageHmm > wide.pageWmm, 'portrait A4 is taller than it is wide');
assert.ok(Math.abs(wide.mapW / wide.mapH - 1600 / 900) < 0.02, 'a wide view is letterboxed, not stretched');
assert.ok(wide.mapX >= wide.marginPx && wide.mapY >= wide.marginPx, 'the map stays inside the margin');
assert.ok(wide.mapX + wide.mapW <= wide.pageW - wide.marginPx + 1, 'the map does not cross the right margin');
assert.ok(wide.mapY + wide.mapH <= wide.pageH - wide.marginPx - wide.footH + 1, 'the map stays above the footer');

const land = pageFrame({ size: 'a4', orient: 'landscape', margin: 15 }, 1600, 900);
assert.ok(land.pageWmm > land.pageHmm, 'landscape swaps the page');
assert.ok(land.mapW / land.pageW > wide.mapW / wide.pageW, 'a wide view fills more of a landscape page');

const tight = pageFrame({ size: 'a3', orient: 'portrait', margin: 0, legend: true }, 800, 800);
assert.equal(tight.marginPx, Math.round(5 * (110 / 25.4)), 'a margin below 5 mm is raised to 5');
assert.ok(tight.legendW > 0, 'a legend takes a column');
assert.ok(tight.mapX + tight.mapW <= tight.pageW - tight.marginPx - tight.legendW + 1, 'the map does not run under the legend');

const loose = pageFrame({ margin: 80 }, 100, 100);
assert.ok(loose.marginPx <= Math.round(40 * (110 / 25.4)) + 1, 'a margin above 40 mm is capped');

console.log('cartography page frame ok');
