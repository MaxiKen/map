// Read a GeoPackage in the browser. sql.js (MIT, vendor/sqljs) opens the
// SQLite file in memory. Nothing is uploaded. Geometries stay in the file's
// own coordinates here; crs.js turns them into longitude and latitude.

import { detectCrs, looksLikeDegrees } from './crs.js';

const MAX_BYTES = 80 * 1024 * 1024;
const MAX_FEATURES = 150000;

let sqlReady = null;

export function loadSqlJs(version) {
  if (sqlReady) return sqlReady;
  sqlReady = (async () => {
    if (typeof globalThis.initSqlJs !== 'function') {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `vendor/sqljs/sql-wasm.js?v=${encodeURIComponent(version || '')}`;
        script.onload = () => (typeof globalThis.initSqlJs === 'function' ? resolve() : reject(new Error('Could not start the GeoPackage reader')));
        script.onerror = () => reject(new Error('Could not load the GeoPackage reader'));
        document.head.appendChild(script);
      });
    }
    return globalThis.initSqlJs({
      locateFile: () => `vendor/sqljs/sql-wasm.wasm?v=${encodeURIComponent(version || '')}`,
    });
  })();
  sqlReady.catch(() => { sqlReady = null; });
  return sqlReady;
}

function fail(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export async function openGeoPackage(buffer, version) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength > MAX_BYTES) {
    throw fail(buffer instanceof ArrayBuffer ? 'That file is over 80 MB. The browser cannot hold a GeoPackage that large. Split it into smaller layers and try again.' : 'Could not read that file.', buffer instanceof ArrayBuffer ? 'too-big' : 'not-gpkg');
  }
  if (buffer.byteLength < 16) throw fail('That file is empty.', 'not-gpkg');
  const magic = String.fromCharCode(...new Uint8Array(buffer, 0, 15));
  if (!magic.startsWith('SQLite format 3')) throw fail('That is not a GeoPackage. Choose a .gpkg file.', 'not-gpkg');
  const SQL = await loadSqlJs(version);
  const db = new SQL.Database(new Uint8Array(buffer));
  try {
    return readGeoPackage(db);
  } finally {
    db.close();
  }
}

function qid(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function rows(db, sql) {
  const result = db.exec(sql);
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map((row) => {
    const out = {};
    columns.forEach((column, i) => { out[column] = row[i]; });
    return out;
  });
}

function field(row, ...keys) {
  if (!row) return null;
  const lower = {};
  for (const [key, value] of Object.entries(row)) lower[key.toLowerCase()] = value;
  for (const key of keys) {
    if (lower[key] != null && lower[key] !== '') return lower[key];
  }
  return null;
}

function toBytes(value) {
  if (!value) return null;
  if (value instanceof Uint8Array) return value;
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (Array.isArray(value)) return Uint8Array.from(value);
  return null;
}

export function readGpkgGeometry(value) {
  const bytes = toBytes(value);
  if (!bytes || bytes.length < 8 || bytes[0] !== 0x47 || bytes[1] !== 0x50) return null;
  const flags = bytes[3];
  if ((flags >> 4) & 1) return null;
  const envelope = { 0: 0, 1: 32, 2: 48, 3: 48, 4: 64 }[(flags >> 1) & 7];
  if (envelope == null || bytes.length < 8 + envelope + 5) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return readWkb(view, bytes, 8 + envelope).geometry;
}

function readWkb(view, bytes, offset) {
  const little = bytes[offset] === 1;
  let o = offset + 1;
  const raw = view.getUint32(o, little);
  o += 4;
  const low = raw & 0xFFFF;
  const hasZ = (raw & 0x80000000) !== 0 || (low >= 1000 && low < 2000) || (low >= 3000 && low < 4000);
  const hasM = (raw & 0x40000000) !== 0 || (low >= 2000 && low < 3000) || (low >= 3000 && low < 4000);
  if (raw & 0x20000000) o += 4;
  const type = low % 1000;
  const dim = 2 + (hasZ ? 1 : 0) + (hasM ? 1 : 0);
  const xy = () => {
    const x = view.getFloat64(o, little);
    const y = view.getFloat64(o + 8, little);
    o += 8 * dim;
    return [x, y];
  };
  const points = () => {
    const n = view.getUint32(o, little);
    o += 4;
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = xy();
    return out;
  };
  if (type === 1) return { geometry: { type: 'Point', coordinates: xy() }, offset: o };
  if (type === 2) return { geometry: { type: 'LineString', coordinates: points() }, offset: o };
  if (type === 3) {
    const n = view.getUint32(o, little);
    o += 4;
    const rings = [];
    for (let i = 0; i < n; i++) rings.push(points());
    return { geometry: { type: 'Polygon', coordinates: rings }, offset: o };
  }
  if (type === 4 || type === 5 || type === 6 || type === 7) {
    const n = view.getUint32(o, little);
    o += 4;
    const parts = [];
    for (let i = 0; i < n; i++) {
      const part = readWkb(view, bytes, o);
      o = part.offset;
      parts.push(part.geometry);
    }
    if (type === 7) return { geometry: { type: 'GeometryCollection', geometries: parts }, offset: o };
    const name = { 4: 'MultiPoint', 5: 'MultiLineString', 6: 'MultiPolygon' }[type];
    return { geometry: { type: name, coordinates: parts.map((part) => part.coordinates) }, offset: o };
  }
  throw fail(`A geometry in this file uses a type this map cannot read (${type}).`, 'geometry');
}

function kindOfGeometry(geometry) {
  const type = geometry?.type || '';
  if (type === 'Point' || type === 'MultiPoint') return 'point';
  if (type === 'LineString' || type === 'MultiLineString') return 'line';
  if (type === 'Polygon' || type === 'MultiPolygon') return 'polygon';
  if (type === 'GeometryCollection') {
    const kinds = new Set((geometry.geometries || []).map(kindOfGeometry).filter(Boolean));
    return kinds.size === 1 ? [...kinds][0] : null;
  }
  return null;
}

function kindFromName(name) {
  const text = String(name || '').toUpperCase();
  if (!text || text === 'GEOMETRY' || text === 'UNKNOWN') return null;
  if (text.includes('POINT')) return 'point';
  if (text.includes('LINE')) return 'line';
  if (text.includes('POLYGON')) return 'polygon';
  return null;
}

function firstXY(geometry) {
  if (!geometry) return null;
  if (geometry.type === 'Point') return geometry.coordinates;
  if (geometry.type === 'LineString' || geometry.type === 'MultiPoint') return geometry.coordinates?.[0];
  if (geometry.type === 'Polygon' || geometry.type === 'MultiLineString') return geometry.coordinates?.[0]?.[0];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates?.[0]?.[0]?.[0];
  if (geometry.type === 'GeometryCollection') return firstXY(geometry.geometries?.[0]);
  return null;
}

function layerLabel(identifier, table) {
  const id = String(identifier || '').trim();
  if (id && id.length <= 80) return id;
  return String(table || 'Imported layer').replace(/_+/g, ' ').trim() || 'Imported layer';
}

function plainValue(value) {
  if (value == null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return value;
  if (typeof value === 'bigint') return Number(value);
  return null;
}

export function readGeoPackage(db) {
  let names;
  try {
    names = new Set(rows(db, "SELECT name FROM sqlite_master WHERE type='table'").map((row) => row.name));
  } catch {
    throw fail('That file could not be read as a GeoPackage.', 'not-gpkg');
  }
  if (!names.has('gpkg_contents')) throw fail('That file is not a GeoPackage.', 'not-gpkg');
  const contents = rows(db, 'SELECT * FROM gpkg_contents');
  const geometryColumns = names.has('gpkg_geometry_columns') ? rows(db, 'SELECT * FROM gpkg_geometry_columns') : [];
  const srsRows = names.has('gpkg_spatial_ref_sys') ? rows(db, 'SELECT * FROM gpkg_spatial_ref_sys') : [];
  const srsById = new Map(srsRows.map((row) => [+field(row, 'srs_id'), row]));
  const geomByTable = new Map();
  for (const row of geometryColumns) {
    const table = field(row, 'table_name');
    if (!geomByTable.has(table)) geomByTable.set(table, []);
    geomByTable.get(table).push(row);
  }
  const layers = [];
  const skipped = [];
  for (const item of contents) {
    const table = field(item, 'table_name');
    const dataType = String(field(item, 'data_type') || '').toLowerCase();
    const label = layerLabel(field(item, 'identifier'), table);
    if (dataType === 'tiles' || dataType === '2d-gridded-coverage') {
      skipped.push({ name: label, reason: 'raster layers in a GeoPackage are not drawn here' });
      continue;
    }
    if (dataType && dataType !== 'features') {
      skipped.push({ name: label, reason: 'no geometry, so it was not added' });
      continue;
    }
    const geomCols = geomByTable.get(table) || [];
    if (!geomCols.length) {
      skipped.push({ name: label, reason: 'no geometry column' });
      continue;
    }
    for (const geomCol of geomCols) {
      const column = field(geomCol, 'column_name');
      const typeName = field(geomCol, 'geometry_type_name');
      const srsId = +(field(geomCol, 'srs_id') ?? field(item, 'srs_id'));
      const srs = srsById.get(srsId) || null;
      const detected = detectCrs({
        srsId,
        organization: field(srs, 'organization'),
        orgCode: field(srs, 'organization_coordsys_id'),
        definition: field(srs, 'definition'),
        definition2: field(srs, 'definition_12_063'),
        name: field(srs, 'srs_name'),
      });
      let count = 0;
      try {
        count = +rows(db, `SELECT COUNT(*) AS n FROM ${qid(table)}`)[0].n;
      } catch {
        skipped.push({ name: label, reason: 'the table could not be read' });
        continue;
      }
      if (count > MAX_FEATURES) {
        skipped.push({ name: label, reason: `too large for the browser (${count.toLocaleString()} features). Split it and try again` });
        continue;
      }
      let records;
      try {
        records = rows(db, `SELECT * FROM ${qid(table)}`);
      } catch {
        skipped.push({ name: label, reason: 'the table could not be read' });
        continue;
      }
      const buckets = { point: [], line: [], polygon: [] };
      const samples = [];
      let empty = 0;
      for (const record of records) {
        let geometry = null;
        try { geometry = readGpkgGeometry(record[column]); } catch { empty++; continue; }
        const kind = kindOfGeometry(geometry) || kindFromName(typeName);
        if (!geometry || !kind) { empty++; continue; }
        const properties = {};
        for (const [key, value] of Object.entries(record)) {
          if (key === column) continue;
          const plain = plainValue(value);
          if (plain != null && plain !== '') properties[key] = plain;
        }
        buckets[kind].push({ type: 'Feature', properties, geometry });
        if (samples.length < 8) {
          const xy = firstXY(geometry);
          if (xy && Number.isFinite(+xy[0]) && Number.isFinite(+xy[1])) samples.push([+xy[0], +xy[1]]);
        }
      }
      const used = Object.entries(buckets).filter(([, features]) => features.length);
      if (!used.length) {
        skipped.push({ name: label, reason: empty ? 'no usable geometry' : 'empty' });
        continue;
      }
      const description = String(field(item, 'description') || '').trim();
      for (const [kind, features] of used) {
        layers.push({
          table,
          label: used.length > 1 ? `${label} (${kind === 'polygon' ? 'polygons' : kind === 'line' ? 'lines' : 'points'})` : label,
          description: description.length > 400 ? description.slice(0, 397) + '…' : description,
          kind,
          detected,
          degreeLike: looksLikeDegrees(samples),
          samples,
          count: features.length,
          skippedEmpty: empty,
          features,
        });
      }
    }
  }
  if (!layers.length && !skipped.length) throw fail('That GeoPackage has no layers.', 'empty');
  return { layers, skipped };
}
