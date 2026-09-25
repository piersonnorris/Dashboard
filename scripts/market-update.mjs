/* Build the market-update notes.

   snapshot -> classify -> quotes -> one .md per ticker + an index, written to
   out/market-updates/ and then copied into the Obsidian vault.

   Flags:
     --cached      reuse private/quote-cache.json if it is under 15 minutes old
     --dry-run     write out/ only; do not touch the vault
     --symbol VST  one symbol, for iterating on formatting
     --no-pause    skip the rate-limit pause (only sane with --cached or one chunk)

   The vault copy is gated: the target sits inside the public website repo's
   working tree, which ignores it by a deny-by-default rule. This script
   re-checks that with `git check-ignore` at runtime and refuses to write if the
   answer ever changes. Holdings must never reach a tracked file. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { readHandoff, latestMonth, positionsBySymbol, noteName } from '../src/lib/holdings/snapshot.mjs';
import { createTwelveData } from '../src/lib/market-data/twelvedata.mjs';
import { renderNote, renderIndex, valuePosition } from '../src/lib/notes/market-update.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'out', 'market-updates');
const CACHE_FILE = path.join(ROOT, 'private', 'quote-cache.json');
const CACHE_TTL_MS = 15 * 60 * 1000;
const VAULT_DIR = path.resolve(
  ROOT, '..', 'PN Website Project', 'Dashboard', 'Market Updates'
);
const INDEX_NAME = '_Market Update.md';

function flags(argv) {
  const at = argv.indexOf('--symbol');
  let only = null;
  if (at !== -1) {
    const value = argv[at + 1];
    if (!value || value.startsWith('--')) {
      console.error('--symbol needs a ticker, e.g. --symbol VST');
      process.exit(1);
    }
    only = value.toUpperCase();
  }
  return {
    cached: argv.includes('--cached'),
    dryRun: argv.includes('--dry-run'),
    noPause: argv.includes('--no-pause'),
    only
  };
}

/* ------------------------------------------------------------------ quotes */

/* The cache is only usable when it holds a good quote for every symbol asked
   for. Keying on age alone meant a newly added holding was served a cached
   "no quote" warning for a symbol that had never been fetched, and a symbol
   that failed once would keep reporting that failure for 15 minutes. */
function readCache(symbols) {
  if (!fs.existsSync(CACHE_FILE)) return null;
  try {
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (!cache.at || Date.now() - cache.at > CACHE_TTL_MS) return null;
    const quotes = cache.quotes || {};
    const usable = symbols.every((s) => quotes[s] && quotes[s].ok);
    return usable ? quotes : null;
  } catch {
    return null;
  }
}

/* Deliberately not merged with what was there. One `at` stamp covers the whole
   file, so folding in older quotes would relabel them as fetched just now. A
   --symbol run therefore shrinks the cache and the next full run refetches,
   which is the honest trade. */
function writeCache(quotes) {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify({ at: Date.now(), quotes }, null, 2));
}

async function getQuotes(symbols, opts) {
  if (opts.cached) {
    const cached = readCache(symbols);
    if (cached) {
      console.log(`quotes: reusing the cache (${symbols.length} symbols)`);
      return cached;
    }
    console.log('quotes: cache does not cover every symbol or has gone stale, fetching');
  }
  const provider = createTwelveData({
    root: ROOT,
    pauseMs: opts.noPause ? 0 : undefined,
    log: (line) => console.log(line)
  });
  const quotes = await provider.getQuotes(symbols);
  writeCache(quotes);
  return quotes;
}

/* ------------------------------------------------------------- vault copy */

/** Refuse to write holdings anywhere git would track them. */
function vaultIsIgnored(dir) {
  const repo = path.resolve(ROOT, '..', 'PN Website Project');
  try {
    execFileSync('git', ['-C', repo, 'check-ignore', '-q', dir], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function copyIntoVault(files) {
  if (!vaultIsIgnored(VAULT_DIR)) {
    console.error('');
    console.error(`REFUSING to write ${VAULT_DIR}`);
    console.error('git no longer reports that path as ignored, so holdings could be committed.');
    console.error('Fix the website repo .gitignore before running without --dry-run.');
    process.exit(1);
  }
  fs.mkdirSync(VAULT_DIR, { recursive: true });
  for (const [name, body] of files) {
    fs.writeFileSync(path.join(VAULT_DIR, name), body, 'utf8');
  }
  console.log(`vault:  wrote ${files.length} notes to ${VAULT_DIR}`);
}

/* -------------------------------------------------------------------- run */

async function main() {
  const opts = flags(process.argv.slice(2));
  const runAt = new Date().toISOString();

  const handoff = path.join(ROOT, 'private', 'STOCK_HANDOFF.md');
  if (!fs.existsSync(handoff)) {
    console.error('No private/STOCK_HANDOFF.md — run `node scripts/pull-holdings.mjs` first.');
    process.exit(1);
  }

  const month = latestMonth(readHandoff(handoff));
  let { positions, unpriced } = positionsBySymbol(month.holdings);
  if (opts.only) {
    /* Exact match on the symbol or its filename form, never a prefix:
       --symbol V must not quietly also rebuild VST, VZ and VDE. */
    positions = positions.filter((p) => {
      const symbol = p.symbol.toUpperCase();
      return symbol === opts.only || noteName(symbol) === opts.only;
    });
    unpriced = [];
    if (positions.length === 0) {
      console.error(`No position matching --symbol ${opts.only}`);
      process.exit(1);
    }
  }

  console.log(`snapshot: ${month.tab || month.month}${month.date ? ` (${month.date})` : ''}`);
  console.log(`positions: ${positions.length} priced, ${unpriced.length} carried at stated value`);

  const quotes = await getQuotes(positions.map((p) => p.symbol), opts);

  /* Value everything first — a position's share of the portfolio cannot be
     known until every other position has been valued. */
  const valuedAll = positions.map((position) => ({
    position,
    quote: quotes[position.symbol] || null,
    valued: valuePosition(position, quotes[position.symbol] || null),
    noteName: noteName(position.symbol)
  }));

  const pricedTotal = valuedAll.reduce((sum, e) => sum + (e.valued.total || 0), 0);
  const statedTotal = unpriced.reduce(
    (sum, u) => sum + (Number.isFinite(u.amount) ? u.amount : 0), 0
  );

  const entries = valuedAll.map((e) => ({
    ...e,
    share: e.valued.total == null || pricedTotal === 0 ? null : (e.valued.total / pricedTotal) * 100
  }));
  entries.sort((a, b) => (b.valued.total || 0) - (a.valued.total || 0));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const written = [];

  for (const entry of entries) {
    const file = `${entry.noteName}.md`;
    /* Prefer the vault copy as the source of prior history and personal
       notes: that is the one actually edited. */
    const vaultCopy = path.join(VAULT_DIR, file);
    const outCopy = path.join(OUT_DIR, file);
    const priorPath = fs.existsSync(vaultCopy) ? vaultCopy : outCopy;
    const existing = fs.existsSync(priorPath) ? fs.readFileSync(priorPath, 'utf8') : '';

    const body = renderNote({ ...entry, month, runAt, existing });
    fs.writeFileSync(outCopy, body, 'utf8');
    written.push([file, body]);
  }

  /* A --symbol run knows about one position, so its index would claim that
     holding is 100% of the portfolio. Never write it: it would overwrite the
     real one in the vault. */
  if (opts.only) {
    console.log('index:  skipped (--symbol builds one note only)');
  } else {
    const index = renderIndex({
      entries,
      unpriced,
      month,
      runAt,
      totals: {
        priced: pricedTotal,
        stated: statedTotal,
        ok: entries.filter((e) => e.quote && e.quote.ok).length,
        failed: entries.filter((e) => !(e.quote && e.quote.ok)).length
      }
    });
    fs.writeFileSync(path.join(OUT_DIR, INDEX_NAME), index, 'utf8');
    written.push([INDEX_NAME, index]);
  }

  console.log(`out:    wrote ${written.length} notes to ${OUT_DIR}`);

  if (opts.dryRun) {
    console.log('vault:  skipped (--dry-run)');
  } else {
    copyIntoVault(written);
  }

  const failed = entries.filter((e) => !(e.quote && e.quote.ok));
  if (failed.length) {
    console.log('');
    console.log(`${failed.length} symbol(s) had no quote; their notes carry a warning:`);
    for (const f of failed) console.log(`  ${f.position.symbol} — ${f.quote?.error || 'no quote'}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
