// Reader and Nigerian coordinate conversion. No browser: sql.js opens a real
// GeoPackage, and the Minna / UTM formulas are checked against pyproj.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crsByCode, detectCrs, projectToLonLat } from '../app/js/crs.js';
import { readGeoPackage, readGpkgGeometry } from '../app/js/gpkg.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const initSqlJs = require(resolve(root, 'app/vendor/sqljs/sql-wasm.js'));
const SQL = await initSqlJs();

function assert(cond, message) {
  if (!cond) throw new Error(message || 'assertion failed');
}

function metresApart(lon, lat, elon, elat) {
  const dx = (lon - elon) * 111320 * Math.cos(elat * Math.PI / 180);
  const dy = (lat - elat) * 110540;
  return Math.hypot(dx, dy);
}

// Projected coordinates below are the pyproj forward of the expected WGS 84
// point through the same parameters the reader uses (EPSG:1168 for Minna).
const checks = [
  [32632, 323998.9537, 1003697.9049, 7.3986, 9.0765],
  [32631, 544226.1181, 718493.6481, 3.4, 6.5],
  [32633, 291861.1301, 1128136.6286, 13.1, 10.2],
  [26392, 549572.9540798797, 561371.242159577, 7.3986, 9.0765],
  [26391, 109176.85596772374, 276443.29268538463, 3.4, 6.5],
  [26393, 1176168.4074, 685482.2263, 13.1, 10.2],
  [26332, 324075.8703, 1003578.1469, 7.3986, 9.0765],
  [4263, 7.399331137443918, 9.076245123470477, 7.3986, 9.0765],
  [3857, 823608.3846, 1014644.0704, 7.3986, 9.0765],
];
let worst = 0;
for (const [code, x, y, lon, lat] of checks) {
  const [outLon, outLat] = projectToLonLat(x, y, crsByCode(code), false);
  const apart = metresApart(outLon, outLat, lon, lat);
  worst = Math.max(worst, apart);
  assert(apart < 0.05, `EPSG:${code} is ${apart.toFixed(3)} m off`);
}
const minna = crsByCode(26392);
assert(minna.datum === 'minna' && minna.accuracyM === 15, 'Minna accuracy');
assert(minna.note.includes('15 metres'), 'Minna note');
assert(crsByCode(4326).note.includes('Nothing was shifted'), '4326 note');
assert(detectCrs({ organization: 'NONE', orgCode: 0, srsId: 0, definition: 'undefined' }) == null, 'unknown crs');

const capitals = readFileSync(resolve(root, 'data/Settlements/settlements_state_capitals_map2023_pt.gpkg'));
const capitalDb = new SQL.Database(capitals);
const capital = readGeoPackage(capitalDb);
capitalDb.close();
assert(capital.layers.length === 1 && capital.layers[0].count === 37, 'capital count');
assert(capital.layers[0].detected.code === 4326, 'capital crs');
assert(capital.layers[0].features[0].properties.name === 'Umuahia', 'capital name');
const [clon, clat] = capital.layers[0].features[0].geometry.coordinates;
assert(Math.abs(clon - 7.483333) < 1e-6 && Math.abs(clat - 5.5333331) < 1e-7, 'Umuahia coordinates');

function gpkgPoint(x, y, srsId) {
  const buf = Buffer.alloc(61);
  buf.write('GP', 0, 'ascii');
  buf[3] = 0x03;
  buf.writeInt32LE(srsId, 4);
  buf[40] = 1;
  buf.writeUInt32LE(1, 41);
  buf.writeDoubleLE(x, 45);
  buf.writeDoubleLE(y, 53);
  return buf;
}

const db = new SQL.Database();
db.run(`CREATE TABLE gpkg_spatial_ref_sys (
  srs_name TEXT NOT NULL, srs_id INTEGER NOT NULL PRIMARY KEY,
  organization TEXT NOT NULL, organization_coordsys_id INTEGER NOT NULL,
  definition TEXT NOT NULL, description TEXT)`);
db.run(`CREATE TABLE gpkg_contents (
  table_name TEXT NOT NULL PRIMARY KEY, data_type TEXT NOT NULL, identifier TEXT,
  description TEXT, last_change TEXT, min_x DOUBLE, min_y DOUBLE, max_x DOUBLE, max_y DOUBLE, srs_id INTEGER)`);
db.run(`CREATE TABLE gpkg_geometry_columns (
  table_name TEXT NOT NULL, column_name TEXT NOT NULL, geometry_type_name TEXT NOT NULL,
  srs_id INTEGER NOT NULL, z TINYINT NOT NULL, m TINYINT NOT NULL,
  PRIMARY KEY (table_name, column_name))`);
db.run(`INSERT INTO gpkg_spatial_ref_sys VALUES ('WGS 84', 4326, 'EPSG', 4326, 'GEOGCS["WGS 84",AUTHORITY["EPSG","4326"]]', '')`);
db.run(`INSERT INTO gpkg_spatial_ref_sys VALUES ('Minna / Nigeria Mid Belt', 26392, 'EPSG', 26392, 'PROJCS["Minna / Nigeria Mid Belt",AUTHORITY["EPSG","26392"]]', '')`);
db.run(`INSERT INTO gpkg_contents VALUES ('abuja_pt', 'features', 'Abuja test', '', '2026-01-01', 0, 0, 0, 0, 26392)`);
db.run(`INSERT INTO gpkg_contents VALUES ('lagos_pt', 'features', 'Lagos test', '', '2026-01-01', 0, 0, 0, 0, 4326)`);
db.run(`INSERT INTO gpkg_contents VALUES ('notes', 'attributes', 'Notes', '', '2026-01-01', NULL, NULL, NULL, NULL, 0)`);
db.run(`INSERT INTO gpkg_geometry_columns VALUES ('abuja_pt', 'geom', 'POINT', 26392, 0, 0)`);
db.run(`INSERT INTO gpkg_geometry_columns VALUES ('lagos_pt', 'geom', 'POINT', 4326, 0, 0)`);
db.run('CREATE TABLE abuja_pt (fid INTEGER PRIMARY KEY, geom BLOB, name TEXT)');
db.run('CREATE TABLE lagos_pt (fid INTEGER PRIMARY KEY, geom BLOB, name TEXT)');
db.run('INSERT INTO abuja_pt VALUES (?, ?, ?)', [1, gpkgPoint(549572.9540798797, 561371.242159577, 26392), 'Abuja']);
db.run('INSERT INTO lagos_pt VALUES (?, ?, ?)', [1, gpkgPoint(3.3792, 6.5244, 4326), 'Lagos']);
const raw = readGpkgGeometry(gpkgPoint(549572.9540798797, 561371.242159577, 26392));
assert(Math.abs(raw.coordinates[0] - 549572.9540798797) < 1e-6, 'blob easting');

const parsed = readGeoPackage(db);
const exported = db.export();
db.close();
const fixtureDir = resolve(root, 'tests/fixtures');
mkdirSync(fixtureDir, { recursive: true });
writeFileSync(resolve(fixtureDir, 'minna_abuja.gpkg'), Buffer.from(exported));

assert(parsed.layers.length === 2, 'two feature layers');
assert(parsed.skipped.some((item) => item.name === 'Notes'), 'attribute table skipped');
const abuja = parsed.layers.find((layer) => layer.label === 'Abuja test');
assert(abuja.detected.code === 26392 && abuja.detected.note.includes('15 metres'), 'Abuja caveat');
const [alon, alat] = projectToLonLat(abuja.features[0].geometry.coordinates[0], abuja.features[0].geometry.coordinates[1], abuja.detected, false);
assert(metresApart(alon, alat, 7.3986, 9.0765) < 0.05, 'Abuja lands on Abuja');
const lagos = parsed.layers.find((layer) => layer.label === 'Lagos test');
assert(lagos.detected.code === 4326 && lagos.detected.note.includes('Nothing was shifted'), 'Lagos note');
console.log(`gpkg import ok (worst conversion ${worst.toFixed(4)} m)`);
