// Test-only static server. Production remains a dependency-free static site.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const publicDirectory = resolve(here, '../../public');
const portArgument = process.argv.indexOf('--port');
const port = Number(portArgument >= 0 ? process.argv[portArgument + 1] : process.env.PORT || 4173);
const workerSource = await readFile(resolve(publicDirectory, 'sw.js'), 'utf8');
let workerBuildOverride = null;
let workerRequests = 0;
const requestCounts = Object.create(null);

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.gif': 'image/gif',
  '.gz': 'application/gzip',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function json(response, value, status = 200) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  response.end(body);
}

async function testEndpoint(request, response, pathname) {
  if (pathname === '/__test/state' && request.method === 'GET') {
    json(response, { workerBuildOverride, workerRequests, requestCounts: { ...requestCounts } });
    return true;
  }
  if (pathname === '/__test/sw-build' && request.method === 'POST') {
    let body = '';
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 4096) { json(response, { error: 'Request too large' }, 413); return true; }
    }
    try {
      const build = JSON.parse(body || '{}').build ?? null;
      if (build !== null && !/^[a-z0-9-]{1,64}$/.test(build)) {
        json(response, { error: 'Invalid test build identifier' }, 400);
        return true;
      }
      workerBuildOverride = build;
      json(response, { workerBuildOverride });
    } catch { json(response, { error: 'Invalid JSON' }, 400); }
    return true;
  }
  return false;
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (await testEndpoint(request, response, url.pathname)) return;
    requestCounts[url.pathname] = (requestCounts[url.pathname] || 0) + 1;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      json(response, { error: 'Method not allowed' }, 405);
      return;
    }

    if (url.pathname === '/sw.js') {
      workerRequests += 1;
      const source = workerBuildOverride === null ? workerSource : workerSource.replace(
        /const BUILD = '[^']+';/,
        `const BUILD = '${workerBuildOverride}';`,
      );
      response.writeHead(200, {
        'Content-Type': MIME['.js'],
        'Content-Length': Buffer.byteLength(source),
        'Cache-Control': 'no-store',
      });
      response.end(request.method === 'HEAD' ? undefined : source);
      return;
    }

    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const file = resolve(publicDirectory, relative);
    if (file !== publicDirectory && !file.startsWith(publicDirectory + sep)) {
      json(response, { error: 'Forbidden' }, 403);
      return;
    }
    const info = await stat(file);
    if (!info.isFile()) { json(response, { error: 'Not found' }, 404); return; }
    const body = await readFile(file);
    response.writeHead(200, {
      'Content-Type': MIME[extname(file)] || 'application/octet-stream',
      'Content-Length': body.length,
      // Match the deployment rule that makes HTML/catalog/register updates visible.
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    if (!response.headersSent) json(response, { error: 'Not found' }, error?.code === 'ENOENT' ? 404 : 500);
    else response.end();
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Browser-test server: http://127.0.0.1:${port} (${publicDirectory})`);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
