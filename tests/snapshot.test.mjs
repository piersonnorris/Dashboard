/* Ingestion: both snapshot shapes, the classify rules ported from
   stock-trackers, and lot grouping. Synthetic fixtures only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  readHandoff, latestMonth, classify, symbolsNeeded, positionsBySymbol, noteName
} from '../src/lib/holdings/snapshot.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => path.join(HERE, 'fixtures', name);

test('reads the months shape, newest first', () => {
  const snapshot = readHandoff(fixture('handoff.md'));
  assert.equal(snapshot.months.length, 2);
  const month = latestMonth(snapshot);
  assert.equal(month.tab, 'Early Testmonth');
  assert.equal(month.holdings.length, 7);
});

test('reads the older single-month shape', () => {
  const snapshot = readHandoff(fixture('handoff-legacy.md'));
  assert.equal(snapshot.months.length, 1);
  assert.equal(latestMonth(snapshot).tab, 'Legacy Testmonth');
});

test('a note with no json block fails loudly', () => {
  assert.throws(() => readHandoff(fixture('handoff.md').replace('handoff', 'nope')));
});

test('classify: shares become an equity symbol', () => {
  assert.deepEqual(classify({ label: 'AAAA', unit: 'Shares' }), {
    kind: 'Equity', symbol: 'AAAA', priced: false
  });
});

test('classify: units become a crypto pair, parentheticals stripped', () => {
  assert.deepEqual(classify({ label: 'ZZZ (crypto)', unit: 'Units' }), {
    kind: 'Crypto', symbol: 'ZZZ/USD', priced: false
  });
});

test('classify: usd rows are already priced and need no symbol', () => {
  assert.deepEqual(classify({ label: 'Cash', unit: 'USD' }), {
    kind: 'Cash', symbol: null, priced: true
  });
  assert.equal(classify({ label: 'AAAA call Jan', unit: 'USD' }).kind, 'Options');
  assert.equal(classify({ label: 'Robo balance', unit: 'USD' }).kind, 'Managed');
  assert.equal(classify({ label: 'Total value', unit: 'USD' }).kind, 'Other');
});

test('classify: junk characters are stripped, dots and dashes survive', () => {
  assert.equal(classify({ label: 'br k.b*', unit: 'Shares' }).symbol, 'BRK.B');
  assert.equal(classify({ label: 'BRK-B', unit: 'Shares' }).symbol, 'BRK-B');
});

test('classify: an unknown unit is priced by nothing', () => {
  assert.deepEqual(classify({ label: 'AAAA', unit: 'Widgets' }), {
    kind: 'Other', symbol: null, priced: false
  });
});

test('classify never throws on a malformed row', () => {
  assert.doesNotThrow(() => classify({}));
  assert.doesNotThrow(() => classify({ label: null, unit: undefined }));
});

test('symbolsNeeded is distinct and skips usd rows', () => {
  const month = latestMonth(readHandoff(fixture('handoff.md')));
  const symbols = symbolsNeeded(month.holdings);
  assert.deepEqual(symbols.sort(), ['AAAA', 'BBBB', 'ZZZ/USD']);
});

test('one ticker on two platforms groups into one position with two lots', () => {
  const month = latestMonth(readHandoff(fixture('handoff.md')));
  const { positions, unpriced } = positionsBySymbol(month.holdings);

  const aaaa = positions.find((p) => p.symbol === 'AAAA');
  assert.equal(aaaa.lots.length, 2);
  assert.deepEqual(aaaa.lots.map((l) => l.platform).sort(), ['AlphaBroker', 'BetaBroker']);
  assert.equal(positions.length, 3);

  /* Cash, the option and the robo balance stay out of the priced set. */
  assert.equal(unpriced.length, 3);
  assert.deepEqual(unpriced.map((u) => u.kind).sort(), ['Cash', 'Managed', 'Options']);
});

test('noteName makes a crypto pair filename-safe', () => {
  assert.equal(noteName('ZZZ/USD'), 'ZZZ-USD');
  assert.equal(noteName('AAAA'), 'AAAA');
});
