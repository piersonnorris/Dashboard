/* Refresh this repo's private holdings snapshot from stock-trackers.

   The Asset Tracking sheet is exported into stock-trackers/private/
   STOCK_HANDOFF.md by a scheduled task. Dashboard takes a copy rather than
   reading across repos, so the generator has exactly one documented input
   path. This script is the only sanctioned way to make that copy.

   It reports the snapshot's tab, date and holding count. It never prints a
   holding, and it never prints the API key. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readHandoff, latestMonth, symbolsNeeded } from '../src/lib/holdings/snapshot.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_REPO = path.resolve(ROOT, '..', 'stock-trackers', 'private');

const FILES = [
  { name: 'STOCK_HANDOFF.md', required: true },
  { name: '.twelvedata-key', required: false }
];

function main() {
  if (!fs.existsSync(SOURCE_REPO)) {
    console.error(`No stock-trackers private folder at ${SOURCE_REPO}`);
    process.exit(1);
  }
  fs.mkdirSync(path.join(ROOT, 'private'), { recursive: true });

  for (const file of FILES) {
    const from = path.join(SOURCE_REPO, file.name);
    const to = path.join(ROOT, 'private', file.name);
    if (!fs.existsSync(from)) {
      if (file.required) {
        console.error(`Missing required source file: ${from}`);
        process.exit(1);
      }
      console.log(`skipped ${file.name} (not present in stock-trackers)`);
      continue;
    }
    fs.copyFileSync(from, to);
    console.log(`copied  ${file.name}`);
  }

  const snapshot = readHandoff(path.join(ROOT, 'private', 'STOCK_HANDOFF.md'));
  const month = latestMonth(snapshot);
  const symbols = symbolsNeeded(month.holdings);

  console.log('');
  console.log(`snapshot tab   ${month.tab || month.month}`);
  console.log(`snapshot date  ${month.date || 'not stated'}`);
  console.log(`months held    ${snapshot.months.length}`);
  console.log(`holdings       ${month.holdings.length}`);
  console.log(`need a quote   ${symbols.length}`);
}

main();
