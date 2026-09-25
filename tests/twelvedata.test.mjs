/* The provider adapter: rate-limit chunking, tolerance of a bad symbol, and
   the rule that the API key never reaches an error message. */
import test from 'node:test';
import assert from 'node:assert/strict';

import { chunk, toQuote, unpack, createTwelveData, CHUNK_SIZE } from '../src/lib/market-data/twelvedata.mjs';
import { NotImplemented, missing } from '../src/lib/market-data/provider.mjs';

const KEY = 'test-key-never-logged';
const env = { TWELVEDATA_API_KEY: KEY };

const symbols = (n) => Array.from({ length: n }, (_, i) => `S${i}`);

/* ------------------------------------------------------------- chunking */

test('chunking respects the free tier: 8 credits a minute', () => {
  assert.equal(CHUNK_SIZE, 8);
  const groups = chunk(symbols(20));
  assert.deepEqual(groups.map((g) => g.length), [8, 8, 4]);
});

test('chunking handles the edges', () => {
  assert.deepEqual(chunk([]), []);
  assert.deepEqual(chunk(['A']), [['A']]);
  assert.deepEqual(chunk(symbols(8)).length, 1);
});

/* --------------------------------------------------------------- mapping */

test('a good entry maps to a quote', () => {
  const q = toQuote('AAAA', {
    name: 'Alpha Test Corp', exchange: 'TESTEX', close: '20.00',
    previous_close: '19.00', change: '1.00', percent_change: '5.26316',
    timestamp: 4070908800
  });
  assert.equal(q.ok, true);
  assert.equal(q.price, 20);
  assert.equal(q.previousClose, 19);
  assert.equal(q.change, 1);
  assert.equal(Number(q.percentChange.toFixed(2)), 5.26);
  assert.equal(q.name, 'Alpha Test Corp');
  assert.match(q.asOf, /^\d{4}-\d{2}-\d{2}T/);
});

test('change and percent are derived when the provider omits them', () => {
  const q = toQuote('AAAA', { close: '20.00', previous_close: '16.00' });
  assert.equal(q.change, 4);
  assert.equal(q.percentChange, 25);
});

test('a date-only datetime still parses', () => {
  assert.equal(toQuote('AAAA', { close: '1', datetime: '2099-01-15' }).asOf, '2099-01-15T00:00:00.000Z');
});

test('an error entry, a missing entry and a closeless entry all come back not-ok', () => {
  assert.equal(toQuote('AAAA', { status: 'error', message: 'bad symbol' }).ok, false);
  assert.equal(toQuote('AAAA', null).ok, false);
  assert.equal(toQuote('AAAA', { previous_close: '19' }).ok, false);
  assert.equal(toQuote('AAAA', { status: 'error', message: 'bad symbol' }).error, 'bad symbol');
});

test('missing() builds a complete, null-valued quote', () => {
  const q = missing('AAAA', 'nope');
  assert.equal(q.ok, false);
  assert.equal(q.symbol, 'AAAA');
  assert.equal(q.price, null);
  assert.equal(q.error, 'nope');
});

test('unpack handles the single-symbol shape and the keyed shape', () => {
  const one = unpack(['AAAA'], { close: '20.00' });
  assert.equal(one.AAAA.price, 20);

  const many = unpack(['AAAA', 'BBBB'], {
    AAAA: { close: '20.00' },
    BBBB: { status: 'error', message: 'unknown symbol' }
  });
  assert.equal(many.AAAA.ok, true);
  assert.equal(many.BBBB.ok, false);
});

/* ----------------------------------------------------------- the adapter */

function stubProvider(handler, pauseMs = 0) {
  return createTwelveData({ root: '/nonexistent', fetchImpl: handler, pauseMs, env });
}

test('one bad symbol does not take down the batch', async () => {
  const provider = createTwelveData({
    root: '/nonexistent',
    pauseMs: 0,
    env,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        AAAA: { close: '20.00' },
        BBBB: { status: 'error', message: 'unknown symbol' }
      })
    })
  });
  const quotes = await provider.getQuotes(['AAAA', 'BBBB']);
  assert.equal(quotes.AAAA.ok, true);
  assert.equal(quotes.BBBB.ok, false);
  assert.equal(quotes.BBBB.error, 'unknown symbol');
});

test('an HTTP failure marks the whole chunk not-ok rather than throwing', async () => {
  const provider = createTwelveData({
    root: '/nonexistent', pauseMs: 0, env,
    fetchImpl: async () => ({ ok: false, status: 429 })
  });
  const quotes = await provider.getQuotes(['AAAA', 'BBBB']);
  assert.equal(quotes.AAAA.ok, false);
  assert.match(quotes.AAAA.error, /429/);
  assert.equal(quotes.BBBB.ok, false);
});

test('the API key never reaches an error message', async () => {
  const provider = createTwelveData({
    root: '/nonexistent', pauseMs: 0, env,
    /* A fetch that leaks the whole URL into its message, as a real one can. */
    fetchImpl: async (url) => { throw new Error(`connect ECONNREFUSED ${url}`); }
  });
  const quotes = await provider.getQuotes(['AAAA']);
  assert.equal(quotes.AAAA.ok, false);
  assert.ok(!quotes.AAAA.error.includes(KEY), 'the key must be scrubbed');
  assert.match(quotes.AAAA.error, /\[key\]/);
});

test('every symbol asked for comes back, even across chunks', async () => {
  const provider = createTwelveData({
    root: '/nonexistent', pauseMs: 0, env,
    fetchImpl: async (url) => {
      const asked = decodeURIComponent(/symbol=([^&]+)/.exec(url)[1]).split(',');
      const body = {};
      for (const s of asked) body[s] = { close: '1.00' };
      return { ok: true, json: async () => body };
    }
  });
  const asked = symbols(20);
  const quotes = await provider.getQuotes(asked);
  assert.deepEqual(Object.keys(quotes).sort(), asked.sort());
});

test('the unimplemented half of the seam fails loudly', () => {
  const provider = stubProvider(async () => ({ ok: true, json: async () => ({}) }));
  assert.throws(() => provider.getBars(), NotImplemented);
  assert.throws(() => provider.getFxRate(), NotImplemented);
  assert.throws(() => provider.getCorporateActions(), NotImplemented);
});

test('no key anywhere is a clear error, not a silent empty run', () => {
  assert.throws(
    () => createTwelveData({ root: '/nonexistent', env: {} }),
    /TWELVEDATA_API_KEY|\.twelvedata-key/
  );
});

/* ------------------------------------------- regressions found in review */

test('a top-level error envelope reaches every symbol with its real message', async () => {
  /* Twelve Data reports credit exhaustion as HTTP 200 plus {code:429,...}. */
  const provider = createTwelveData({
    root: '/nonexistent', pauseMs: 0, env,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ code: 429, message: 'API credits exceeded', status: 'error' })
    })
  });
  const quotes = await provider.getQuotes(['AAAA', 'BBBB']);
  for (const symbol of ['AAAA', 'BBBB']) {
    assert.equal(quotes[symbol].ok, false);
    assert.match(quotes[symbol].error, /API credits exceeded/);
    assert.match(quotes[symbol].error, /429/);
  }
});

test('an empty body is reported as such, not as 8 invalid tickers', () => {
  const out = unpack(['AAAA', 'BBBB'], null);
  assert.match(out.AAAA.error, /no body/);
});

test('a good multi-symbol batch is not mistaken for an envelope', () => {
  const out = unpack(['AAAA', 'BBBB'], { AAAA: { close: '1' }, BBBB: { close: '2' } });
  assert.equal(out.AAAA.ok, true);
  assert.equal(out.BBBB.ok, true);
});

test('a non-Error throw does not surface as "undefined"', async () => {
  const provider = createTwelveData({
    root: '/nonexistent', pauseMs: 0, env,
    fetchImpl: async () => { throw 'socket hang up'; }
  });
  const quotes = await provider.getQuotes(['AAAA']);
  assert.equal(quotes.AAAA.ok, false);
  assert.doesNotMatch(quotes.AAAA.error, /undefined/);
  assert.match(quotes.AAAA.error, /socket hang up/);
});
