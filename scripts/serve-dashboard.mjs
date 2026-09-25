import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 4175;
export const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'app');

export const CONTENT_TYPES = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
});

const CLEAN_ROUTE_PATTERN = /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/?)*$/i;

export function parsePort(value, fallback = DEFAULT_PORT) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new TypeError(`PORT must be an integer from 1 to 65535; received ${JSON.stringify(value)}`);
  }

  return port;
}

export function contentTypeFor(filePath) {
  return CONTENT_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

export function isCleanAppRoute(pathname) {
  return CLEAN_ROUTE_PATTERN.test(pathname) && !extname(pathname);
}

/**
 * Resolve a URL pathname underneath the static root.
 *
 * This function deliberately validates the decoded path before normalizing it.
 * That matters because URL/path normalization can otherwise erase `..` segments
 * before the server has a chance to reject them.
 */
export function resolveRequestPath(rawRequestTarget, root = APP_ROOT) {
  const rawPathname = String(rawRequestTarget || '/').split(/[?#]/, 1)[0] || '/';
  let pathname;

  try {
    pathname = decodeURIComponent(rawPathname);
  } catch {
    return { ok: false, statusCode: 400, reason: 'Malformed URL encoding' };
  }

  if (!pathname.startsWith('/')) {
    return { ok: false, statusCode: 400, reason: 'Request path must be absolute' };
  }

  if (pathname.includes('\0') || pathname.includes('\\')) {
    return { ok: false, statusCode: 400, reason: 'Invalid request path' };
  }

  const segments = pathname.split('/');
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return { ok: false, statusCode: 403, reason: 'Path traversal is not allowed' };
  }

  const rootPath = resolve(root);
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = resolve(rootPath, relativePath);
  const fromRoot = relative(rootPath, filePath);

  if (fromRoot.startsWith('..') || isAbsolute(fromRoot)) {
    return { ok: false, statusCode: 403, reason: 'Path traversal is not allowed' };
  }

  return {
    ok: true,
    pathname,
    filePath,
    fallbackEligible: isCleanAppRoute(pathname),
  };
}

function writePlainText(response, statusCode, message, extraHeaders = {}) {
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  response.end(message);
}

async function isRegularFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return false;
    throw error;
  }
}

function streamFile(request, response, filePath) {
  response.writeHead(200, {
    'Content-Type': contentTypeFor(filePath),
    'Cache-Control': 'no-cache',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  const stream = createReadStream(filePath);
  stream.on('error', () => {
    if (!response.headersSent) {
      writePlainText(response, 500, 'Internal server error');
    } else {
      response.destroy();
    }
  });
  stream.pipe(response);
}

export async function serveDashboardRequest(request, response, { root = APP_ROOT } = {}) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    writePlainText(response, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
    return;
  }

  const resolution = resolveRequestPath(request.url, root);
  if (!resolution.ok) {
    writePlainText(response, resolution.statusCode, resolution.reason);
    return;
  }

  let filePath = resolution.filePath;
  if (!(await isRegularFile(filePath)) && resolution.fallbackEligible) {
    filePath = resolve(root, 'index.html');
  }

  if (!(await isRegularFile(filePath))) {
    writePlainText(response, 404, 'Not found');
    return;
  }

  streamFile(request, response, filePath);
}

export function createDashboardServer(options = {}) {
  return createServer((request, response) => {
    serveDashboardRequest(request, response, options).catch((error) => {
      console.error('[dashboard] Request failed:', error);
      if (!response.headersSent) {
        writePlainText(response, 500, 'Internal server error');
      } else {
        response.destroy(error);
      }
    });
  });
}

export async function startDashboardServer({
  host = DEFAULT_HOST,
  port = parsePort(process.env.PORT),
  root = APP_ROOT,
} = {}) {
  const server = createDashboardServer({ root });

  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, host, () => {
      server.off('error', rejectListen);
      resolveListen();
    });
  });

  const address = server.address();
  const listeningPort = typeof address === 'object' && address ? address.port : port;
  console.log(`[dashboard] Local preview: http://${host}:${listeningPort}`);
  console.log(`[dashboard] Serving ${resolve(root)}`);
  return server;
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (entryPath === import.meta.url) {
  const server = await startDashboardServer();

  const stop = (signal) => {
    console.log(`\n[dashboard] ${signal} received; stopping preview.`);
    server.close(() => process.exit(0));
  };

  process.once('SIGINT', () => stop('SIGINT'));
  process.once('SIGTERM', () => stop('SIGTERM'));
}
