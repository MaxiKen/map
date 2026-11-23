import assert from 'node:assert/strict';
import {
  mercX, mercY, unX, unY, haversineKm, pip2,
  groundDegreeStep, fishnetCells, regularGridPoints, hexBinPoints,
} from '../app/js/engine.js';

const step = groundDegreeStep(6, 5);
const north = haversineKm([0, 6], [0, 6 + step.dLat]);
const east = haversineKm([0, 6], [step.dLon, 6]);
assert.ok(Math.abs(north - 5) < 0.01, 'a latitude step is 5 km on the ground, got ' + north);
assert.ok(Math.abs(east - 5) < 0.01, 'a longitude step is 5 km on the ground, got ' + east);
assert.notEqual(step.dLat, 5 / 111, 'the step is not a degree-as-kilometre shortcut');

const west = 7, south = 6;
const boxEast = west + 2 * step.dLon;
const boxNorth = south + 2 * step.dLat;
const grid = fishnetCells(west, south, boxEast, boxNorth, 5);
assert.equal(grid.cols, 2);
assert.equal(grid.rows, 2);
assert.equal(grid.cells.length, 4);
assert.equal(grid.tooMany, false);
const cell = grid.cells[0];
assert.ok(cell.ring[0] < 2, 'a cell is stored in mercator, not longitude');
assert.ok(Math.abs(cell.ring[0] - mercX(cell.east)) < 1e-9);
const midLat = (cell.south + cell.north) / 2;
const midLon = (cell.west + cell.east) / 2;
const width = haversineKm([cell.west, midLat], [cell.east, midLat]);
const height = haversineKm([midLon, cell.south], [midLon, cell.north]);
assert.ok(Math.abs(width - 5) < 0.05, 'cell width ' + width);
assert.ok(Math.abs(height - 5) < 0.05, 'cell height ' + height);

const huge = fishnetCells(7, 6, 8, 7, 0.5, 20);
assert.equal(huge.tooMany, true);
assert.equal(huge.cells.length, 0, 'a grid that cannot be finished is not a partial grid');

const points = regularGridPoints(7, 6, 7.15, 6.15, 5);
assert.ok(points.cols >= 2 && points.rows >= 2, 'a 5 km grid fits more than one point, got ' + points.cols + 'x' + points.rows);
const row = points.points.filter((p) => p.row === 0);
assert.ok(row.length >= 2);
const gap = haversineKm([unX(row[0].x), unY(row[0].y)], [unX(row[1].x), unY(row[1].y)]);
assert.ok(Math.abs(gap - 5) < 0.05, 'grid spacing ' + gap);
assert.ok(points.points.every((p) => unX(p.x) <= 7.15 + 1e-6 && unY(p.y) >= 6 - 1e-8), 'a grid point stays inside the box');
assert.ok(points.points[0].x < 2, 'a grid point is mercator');

const near = [mercX(7), mercY(6)];
const beside = [mercX(7.001), mercY(6.001)];
const away = [mercX(7.08), mercY(6)];
const bins = hexBinPoints([
  { x: near[0], y: near[1] },
  { x: beside[0], y: beside[1] },
  { x: away[0], y: away[1] },
], 2);
assert.equal(bins.points, 3);
assert.equal(bins.hexes.length, 2, 'two nearby points share a hexagon, got ' + bins.hexes.length);
assert.equal(Math.max(...bins.hexes.map((h) => h.count)), 2);
assert.ok(bins.hexes.every((h) => h.ring.length === 12), 'a hexagon has six corners');
const full = bins.hexes.find((h) => h.count === 2);
assert.ok(pip2(near[0], near[1], [full.ring]), 'the counted point falls inside its hexagon');
assert.ok(pip2(beside[0], beside[1], [full.ring]), 'the neighbour falls inside the same hexagon');
assert.equal(pip2(away[0], away[1], [full.ring]), false, 'a distant point is not given the same hexagon');
const corner = (ring, i) => [unX(ring[i * 2]), unY(ring[i * 2 + 1])];
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const right = mid(corner(full.ring, 0), corner(full.ring, 1));
const left = mid(corner(full.ring, 3), corner(full.ring, 4));
const top = corner(full.ring, 2);
const bottom = corner(full.ring, 5);
const across = haversineKm(left, right);
const tall = haversineKm(bottom, top);
assert.ok(Math.abs(across - 2) < 0.15, 'flat-to-flat width ' + across);
assert.ok(tall / across > 1.1, 'a hexagon is not a square, ratio ' + (tall / across));

console.log('generation ops ok');
