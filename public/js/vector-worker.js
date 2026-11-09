import { prepareFeature } from './engine.js?v=360a9e2272';

// GeoJSON parsing, Mercator conversion and typed-array allocation happen away from the UI thread.
// Coordinate buffers are transferred, not copied, in the result message.
async function readJSON(response, encoding) {
  if (!response.ok) throw new Error(`Layer request failed (${response.status})`);
  if (encoding === 'gzip') {
    if (!response.body || typeof DecompressionStream === 'undefined') {
      throw new Error('This browser cannot stream the compressed layer');
    }
    const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).json();
  }
  return response.json();
}

function collectBuffers(parts, buffers) {
  if (ArrayBuffer.isView(parts)) buffers.add(parts.buffer);
  else if (Array.isArray(parts)) for (const part of parts) collectBuffers(part, buffers);
}

self.onmessage = async (event) => {
  try {
    const { url, encoding, style } = event.data;
    const response = await fetch(url);
    const geojson = await readJSON(response, encoding);
    const features = [];
    for (const feature of geojson.features || []) {
      const converted = prepareFeature(feature, style, features.length);
      if (converted) features.push(converted);
    }
    const buffers = new Set();
    for (const feature of features) collectBuffers(feature.parts, buffers);
    self.postMessage({ features }, [...buffers]);
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
