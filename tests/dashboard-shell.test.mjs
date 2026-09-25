import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_PORT,
  contentTypeFor,
  createDashboardServer,
  isCleanAppRoute,
  parsePort,
  resolveRequestPath,
} from '../scripts/serve-dashboard.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function fetchFromServer(port, path, { method = 'GET' } = {}) {
  return new Promise((resolveRequest, rejectRequest) => {
    const request = httpRequest(
      {
        host: '127.0.0.1',
        port,
        path,
        method,
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          resolveRequest({
            status: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    request.on('error', rejectRequest);
    request.end();
  });
}

describe('dashboard preview server helpers', () => {
  test('parses explicit ports and uses the dashboard default', () => {
    assert.equal(parsePort(undefined), DEFAULT_PORT);
    assert.equal(parsePort('4310'), 4310);
    assert.throws(() => parsePort('abc'), /PORT must be an integer/);
    assert.throws(() => parsePort('0'), /PORT must be an integer/);
    assert.throws(() => parsePort('65536'), /PORT must be an integer/);
  });

  test('returns useful content types with a safe binary fallback', () => {
    assert.equal(contentTypeFor('index.html'), 'text/html; charset=utf-8');
    assert.equal(contentTypeFor('app.JS'), 'text/javascript; charset=utf-8');
    assert.equal(contentTypeFor('chart.svg'), 'image/svg+xml; charset=utf-8');
    assert.equal(contentTypeFor('unknown.bin'), 'application/octet-stream');
  });

  test('recognizes only extensionless, clean application routes', () => {
    assert.equal(isCleanAppRoute('/overview'), true);
    assert.equal(isCleanAppRoute('/portfolio/activity'), true);
    assert.equal(isCleanAppRoute('/market-update'), true);
    assert.equal(isCleanAppRoute('/app.js'), false);
    assert.equal(isCleanAppRoute('/bad_route'), false);
  });

  test('keeps resolved files beneath the application root', () => {
    const root = resolve(repositoryRoot, 'app');
    const home = resolveRequestPath('/?preview=true', root);
    assert.equal(home.ok, true);
    assert.equal(home.filePath, resolve(root, 'index.html'));

    const asset = resolveRequestPath('/assets/icon.svg', root);
    assert.equal(asset.ok, true);
    assert.equal(asset.filePath, resolve(root, 'assets', 'icon.svg'));

    assert.deepEqual(resolveRequestPath('/%2e%2e/private.json', root), {
      ok: false,
      statusCode: 403,
      reason: 'Path traversal is not allowed',
    });
    assert.equal(resolveRequestPath('/bad%ZZ', root).statusCode, 400);
    assert.equal(resolveRequestPath('/assets\\secret.txt', root).statusCode, 400);
  });
});

describe('dashboard preview server responses', () => {
  let root;
  let server;
  let port;

  before(async () => {
    root = await mkdtemp(join(tmpdir(), 'dashboard-shell-'));
    await writeFile(join(root, 'index.html'), '<!doctype html><title>Dashboard fixture</title>', 'utf8');
    await writeFile(join(root, 'styles.css'), 'body { color: white; }', 'utf8');

    server = createDashboardServer({ root });
    await new Promise((resolveListen, rejectListen) => {
      server.once('error', rejectListen);
      server.listen(0, '127.0.0.1', resolveListen);
    });
    port = server.address().port;
  });

  after(async () => {
    if (server) {
      await new Promise((resolveClose) => server.close(resolveClose));
    }
    if (root) await rm(root, { recursive: true, force: true });
  });

  test('serves the shell and static assets with security-aware headers', async () => {
    const home = await fetchFromServer(port, '/');
    assert.equal(home.status, 200);
    assert.match(home.headers['content-type'], /^text\/html/);
    assert.match(home.headers['content-security-policy'], /default-src 'self'/);
    assert.equal(home.headers['x-content-type-options'], 'nosniff');
    assert.match(home.body, /Dashboard fixture/);

    const css = await fetchFromServer(port, '/styles.css');
    assert.equal(css.status, 200);
    assert.match(css.headers['content-type'], /^text\/css/);
  });

  test('supports HEAD without sending a response body', async () => {
    const response = await fetchFromServer(port, '/', { method: 'HEAD' });
    assert.equal(response.status, 200);
    assert.equal(response.body, '');
  });

  test('falls back to the shell for clean routes, not missing assets', async () => {
    const cleanRoute = await fetchFromServer(port, '/portfolio');
    assert.equal(cleanRoute.status, 200);
    assert.match(cleanRoute.body, /Dashboard fixture/);

    const missingAsset = await fetchFromServer(port, '/missing.js');
    assert.equal(missingAsset.status, 404);
  });

  test('rejects traversal and unsupported methods', async () => {
    const traversal = await fetchFromServer(port, '/%2e%2e/private.json');
    assert.equal(traversal.status, 403);

    const post = await fetchFromServer(port, '/', { method: 'POST' });
    assert.equal(post.status, 405);
    assert.equal(post.headers.allow, 'GET, HEAD');
  });
});

describe('dashboard shell contract', () => {
  let html;
  let javascript;
  let css;

  before(async () => {
    [html, javascript, css] = await Promise.all([
      readFile(resolve(repositoryRoot, 'app', 'index.html'), 'utf8'),
      readFile(resolve(repositoryRoot, 'app', 'app.js'), 'utf8'),
      readFile(resolve(repositoryRoot, 'app', 'styles.css'), 'utf8'),
    ]);
  });

  test('declares a responsive, navigable document with an honest demo-data label', () => {
    assert.match(html, /<!doctype html>/i);
    assert.match(html, /<meta[^>]+name=["']viewport["']/i);
    assert.match(html, /href=["']#main-content["'][^>]*>[^<]*(?:skip|content)/i);
    assert.match(html, /<main[^>]+id=["']main-content["']/i);
    assert.match(html, /<nav[^>]+aria-label=["'][^"']+["']/i);
    assert.match(html, /(?:demo|fictional|sample|synthetic) data/i);
    assert.match(html, /href=["'][^"']*styles\.css(?:\?[^"']*)?["']/i);
    assert.match(html, /src=["'][^"']*app\.js(?:\?[^"']*)?["']/i);
  });

  test('exposes understandable privacy and time-range controls', () => {
    assert.match(html, /(?:privacy|hide balances|show balances)/i);
    assert.match(html, /aria-label=["'][^"']*(?:range|period|time)[^"']*["']/i);
    assert.match(javascript, /privacy/i);
    assert.match(javascript, /range/i);
    assert.match(javascript, /addEventListener/);
    assert.match(javascript, /redactCurrencyText\(chartNarrative, state\.privacy\)/);
  });

  test('includes keyboard focus, narrow-screen, and reduced-motion styles', () => {
    assert.match(css, /:focus-visible/);
    assert.match(css, /@media\s*\([^)]*(?:max-width|width\s*[<]=)/i);
    assert.match(css, /prefers-reduced-motion/i);
    assert.match(javascript, /sidebar\.inert\s*=/);
    assert.match(javascript, /event\.key === 'Escape'/);
  });
});
