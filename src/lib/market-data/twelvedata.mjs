/* Twelve Data implementation of the provider seam.

   The key is read-only market data, not an account credential, but it still
   never reaches a log line, an error message or the repo: it lives in
   private/.twelvedata-key (gitignored) or TWELVEDATA_API_KEY.

   Free tier is 8 API credits per minute and every symbol in a batch costs one,
   so symbols go out 8 at a time with a 60s pause between chunks — the same
   pacing stock-trackers/build.js uses. ~40 symbols is about four minutes.

   /quote rather than /price: one call returns close, previous_close, change,
   percent_change, name and exchange, which is everything a note needs. */
import fs from 'node:fs';
import path from 'node:path';
import { missing, unimplemented } from './provider.mjs';

const ENDPOINT = 'https://api.twelvedata.com/quote';
export const CHUNK_SIZE = 8;
export const CHUNK_PAUSE_MS = 60_000;

export function chunk(symbols, size = CHUNK_SIZE) {
  const out = [];
  for (let i = 0; i < symbols.length; i += size) out.push(symbols.slice(i, i + size));
  return out;
}

export function readKey(root, env = process.env) {
  if (env.TWELVEDATA_API_KEY) return env.TWELVEDATA_API_KEY.trim();
  const file = path.join(root, 'private', '.twelvedata-key');
  if (fs.existsSync(file)) {
    const key = fs.readFileSync(file, 'utf8').trim();
    if (key) return key;
  }
  throw new Error(
    'No Twelve Data key. Set TWELVEDATA_API_KEY or put it in private/.twelvedata-key'
  );
}

/** Turn one /quote entry into our Quote shape. Never throws. */
export function toQuote(symbol, entry) {
  if (!entry || entry.status === 'error' || entry.code) {
    return missing(symbol, (entry && entry.message) || 'provider rejected the symbol');
  }
  const price = num(entry.close);
  const previousClose = num(entry.previous_close);
  if (price == null) return missing(symbol, 'no close in the response');

  let change = num(entry.change);
  if (change == null && previousClose != null) change = price - previousClose;
  let percentChange = num(entry.percent_change);
  if (percentChange == null && previousClose) percentChange = (change / previousClose) * 100;

  return {
    ok: true,
    symbol,
    price,
    previousClose,
    change,
    percentChange,
    name: entry.name || null,
    exchange: entry.exchange || null,
    asOf: stamp(entry),
    error: null
  };
}

function num(value) {
  if (value == null || value === '') return null;
  const parsed = Number(String(value).replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

/* Twelve Data gives `timestamp` (epoch seconds) on most rows and `datetime`
   (a date, sometimes without a time) on others. Prefer the precise one. */
function stamp(entry) {
  if (entry.timestamp) {
    const ms = Number(entry.timestamp) * 1000;
    if (Number.isFinite(ms)) return new Date(ms).toISOString();
  }
  if (entry.datetime) {
    const parsed = new Date(entry.datetime.length === 10 ? `${entry.datetime}T00:00:00Z` : entry.datetime);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

/* A single-symbol request returns the quote object directly; a multi-symbol
   one returns {SYMBOL: quote}. Normalize both, and never let one bad ticker
   take down the run. */
export function unpack(symbols, json) {
  const out = {};

  /* Credit exhaustion and a bad key come back as HTTP 200 with a top-level
     error envelope, not per-symbol entries. Without this, every ticker in the
     chunk is reported as "no quote returned" and the real reason — which is
     usually "wait a minute" — is thrown away. */
  const envelope = topLevelError(json);
  if (envelope) {
    for (const symbol of symbols) out[symbol] = missing(symbol, envelope);
    return out;
  }

  if (symbols.length === 1) {
    out[symbols[0]] = toQuote(symbols[0], json);
    return out;
  }
  for (const symbol of symbols) {
    out[symbol] = toQuote(symbol, json && json[symbol]);
  }
  return out;
}

/* An envelope is an error at the root of the response. A per-symbol map never
   carries `code`/`status` at the root, so this does not fire on a good batch. */
function topLevelError(json) {
  if (!json || typeof json !== 'object') return 'the provider returned no body';
  if (json.status === 'error' || json.code) {
    const code = json.code ? ` (${json.code})` : '';
    return `${json.message || 'the provider rejected the request'}${code}`;
  }
  return null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createTwelveData({
  root, fetchImpl = fetch, pauseMs = CHUNK_PAUSE_MS, log = () => {}, env = process.env
}) {
  const key = readKey(root, env);

  return {
    ...unimplemented,
    id: 'twelvedata',

    async getQuotes(symbols) {
      const groups = chunk(symbols);
      const out = {};

      for (let i = 0; i < groups.length; i += 1) {
        const group = groups[i];
        log(`quotes: chunk ${i + 1}/${groups.length} (${group.length} symbols)`);
        const url = `${ENDPOINT}?symbol=${encodeURIComponent(group.join(','))}&apikey=${encodeURIComponent(key)}`;

        try {
          const res = await fetchImpl(url);
          if (!res.ok) throw new Error(`Twelve Data returned HTTP ${res.status}`);
          const json = await res.json();
          Object.assign(out, unpack(group, json));
        } catch (err) {
          /* Scrub the key in case it rode along in a thrown URL. A non-Error
             throw has no .message, and "undefined" is not a diagnosis. */
          const raw = (err && err.message) || String(err) || 'the request failed';
          const reason = raw.split(key).join('[key]');
          for (const symbol of group) out[symbol] = missing(symbol, reason);
        }

        if (i < groups.length - 1 && pauseMs > 0) {
          log(`quotes: pausing ${Math.round(pauseMs / 1000)}s for the rate limit`);
          await sleep(pauseMs);
        }
      }

      return out;
    }
  };
}
