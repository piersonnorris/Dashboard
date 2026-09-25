/* The note writer's two promises: your text below "## Notes" survives a
   rebuild, and the History table gains exactly one row per day. */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  renderNote, renderIndex, parseExisting, mergeHistory, valuePosition,
  money, qty, pct, arrow, yamlScalar, NOTES_HEADING
} from '../src/lib/notes/market-update.mjs';

const month = { tab: 'Early Testmonth', month: 'Testmonth', date: '2099-01-15' };

const position = {
  symbol: 'AAAA',
  kind: 'Equity',
  lots: [
    { platform: 'AlphaBroker', label: 'AAAA', amount: 10, unit: 'Shares', notes: '' },
    { platform: 'BetaBroker', label: 'AAAA', amount: 2.5, unit: 'Shares', notes: 'second lot' }
  ]
};

const quote = {
  ok: true, symbol: 'AAAA', price: 20, previousClose: 19, change: 1,
  percentChange: 5.263157, name: 'Alpha Test Corp', exchange: 'TESTEX',
  asOf: '2099-01-15T20:15:00.000Z', error: null
};

const noQuote = {
  ok: false, symbol: 'AAAA', price: null, previousClose: null, change: null,
  percentChange: null, name: null, exchange: null, asOf: null,
  error: 'provider rejected the symbol'
};

function build(overrides = {}) {
  const q = 'quote' in overrides ? overrides.quote : quote;
  return renderNote({
    position,
    quote: q,
    valued: valuePosition(position, q),
    month,
    runAt: overrides.runAt || '2099-01-15T21:00:00.000Z',
    share: overrides.share === undefined ? 42.5 : overrides.share,
    existing: overrides.existing || ''
  });
}

/* ------------------------------------------------------------- formatting */

test('formatters handle a missing number without printing NaN', () => {
  assert.equal(money(null), '—');
  assert.equal(qty(undefined), '—');
  assert.equal(pct(Number.NaN), '—');
  assert.equal(money(1234.5), '$1,234.50');
  assert.equal(pct(-2.345), '-2.35%');
  assert.equal(pct(2.345), '+2.35%');
});

test('arrows read up, down and flat', () => {
  assert.equal(arrow(1), '▲');
  assert.equal(arrow(-1), '▼');
  assert.equal(arrow(0), '·');
  assert.equal(arrow(null), '·');
});

/* ------------------------------------------------------------------ value */

test('a position values each lot and totals them', () => {
  const valued = valuePosition(position, quote);
  assert.equal(valued.amount, 12.5);
  assert.equal(valued.total, 250);
  assert.deepEqual(valued.lots.map((l) => l.value), [200, 50]);
});

test('no quote means no value, not a zero value', () => {
  const valued = valuePosition(position, noQuote);
  assert.equal(valued.total, null);
  assert.deepEqual(valued.lots.map((l) => l.value), [null, null]);
});

/* -------------------------------------------------------------- rendering */

test('a fresh note carries frontmatter, both lots and a total row', () => {
  const note = build();
  assert.match(note, /^---\nticker: AAAA\n/);
  assert.match(note, /name: Alpha Test Corp/);
  assert.match(note, /platforms: \[AlphaBroker, BetaBroker\]/);
  assert.match(note, /position_value: 250/);
  assert.match(note, /# AAAA — Alpha Test Corp/);
  assert.match(note, /\| AlphaBroker \| 10 \| Shares \| \$200\.00 \|/);
  assert.match(note, /\| \*\*Total\*\* \| \*\*12\.5\*\* \| \| \*\*\$250\.00\*\* \|/);
  assert.match(note, /Share of priced portfolio: 42\.5%/);
  assert.match(note, /\| 2099-01-15 \| \$20\.00 \| \+5\.26% \| \$250\.00 \|/);
});

test('a single-lot position gets no redundant total row', () => {
  const single = { symbol: 'BBBB', kind: 'Equity', lots: [position.lots[0]] };
  const note = renderNote({
    position: single,
    quote: { ...quote, symbol: 'BBBB' },
    valued: valuePosition(single, quote),
    month,
    runAt: '2099-01-15T21:00:00.000Z',
    share: 10,
    existing: ''
  });
  assert.doesNotMatch(note, /\*\*Total\*\*/);
});

test('a missing quote is visible, not silent, and logs no history', () => {
  const note = build({ quote: noQuote });
  assert.match(note, /> \[!warning\] No quote returned for AAAA on 2099-01-15/);
  assert.match(note, /provider rejected the symbol/);
  assert.match(note, /price: null/);
  assert.match(note, /position_value: null/);
  /* The History table exists but holds only the empty-state row. */
  assert.match(note, /\| — \| — \| — \| — \|/);
  assert.doesNotMatch(note, /\| 2099-01-15 \|/);
});

/* ---------------------------------------------------------------- parsing */

test('parseExisting recovers history rows and the notes tail', () => {
  const note = build();
  const withNote = note.replace(
    /<!-- yours[^>]*-->/,
    'My thesis: synthetic.\n\nSecond paragraph.'
  );
  const parsed = parseExisting(withNote);
  assert.equal(parsed.history.length, 1);
  assert.equal(parsed.history[0].date, '2099-01-15');
  assert.equal(parsed.history[0].price, '$20.00');
  assert.match(parsed.tail, /My thesis: synthetic\./);
  assert.match(parsed.tail, /Second paragraph\./);
});

test('parseExisting is safe on an empty or note-less file', () => {
  assert.deepEqual(parseExisting(''), { history: [], tail: '' });
  assert.deepEqual(parseExisting('# Just a heading\n'), { history: [], tail: '' });
});

test('mergeHistory replaces a same-date row and keeps dates ordered', () => {
  const rows = [
    { date: '2099-01-14', price: '$19.00', change: '+1.00%', value: '$237.50' }
  ];
  const once = mergeHistory(rows, { date: '2099-01-15', price: '$20.00', change: '+5.26%', value: '$250.00' });
  assert.equal(once.length, 2);

  const twice = mergeHistory(once, { date: '2099-01-15', price: '$21.00', change: '+10.00%', value: '$262.50' });
  assert.equal(twice.length, 2, 're-running on the same date must not add a row');
  assert.equal(twice[1].price, '$21.00', 'the later run wins');
  assert.deepEqual(twice.map((r) => r.date), ['2099-01-14', '2099-01-15']);
});

/* ------------------------------------------------- the two live promises */

test('your notes survive a rebuild byte for byte', () => {
  const mine = 'My thesis: synthetic.\n\n- watching the 2099 print\n- [[Some Other Note]]';
  const first = build().replace(/<!-- yours[^>]*-->/, mine);

  const second = build({ existing: first, runAt: '2099-01-16T21:00:00.000Z' });
  const tail = second.slice(second.indexOf(NOTES_HEADING) + NOTES_HEADING.length).trim();
  assert.equal(tail, mine);
});

test('a rebuild on a new day appends exactly one history row', () => {
  const first = build();
  const second = build({ existing: first, runAt: '2099-01-16T21:00:00.000Z' });
  const rows = parseExisting(second).history;
  assert.deepEqual(rows.map((r) => r.date), ['2099-01-15', '2099-01-16']);
});

test('a rebuild on the same day replaces rather than duplicates', () => {
  const first = build();
  const second = build({ existing: first });
  const third = build({ existing: second });
  assert.equal(parseExisting(third).history.length, 1);
});

test('history survives a day when the quote fails', () => {
  const first = build();
  const failed = build({ existing: first, quote: noQuote, runAt: '2099-01-16T21:00:00.000Z' });
  const rows = parseExisting(failed).history;
  assert.deepEqual(rows.map((r) => r.date), ['2099-01-15'],
    'the prior row is kept; the failed day adds nothing');
});

/* ------------------------------------------------------------------ index */

test('the index links every ticker and separates stated-value rows', () => {
  const entries = [{
    position, quote, valued: valuePosition(position, quote), noteName: 'AAAA', share: 100
  }];
  const unpriced = [
    { platform: 'AlphaBroker', label: 'Cash', kind: 'Cash', amount: 100, notes: '' }
  ];
  const index = renderIndex({
    entries, unpriced, month,
    runAt: '2099-01-15T21:00:00.000Z',
    totals: { priced: 250, stated: 100, ok: 1, failed: 0 }
  });

  assert.match(index, /\[\[AAAA\\\|AAAA\]\]/);
  assert.match(index, /## Carried at stated value/);
  assert.match(index, /\| AlphaBroker \| Cash \| Cash \| \$100\.00 \|/);
  assert.match(index, /priced_value: 250/);
  assert.doesNotMatch(index, /## Needs attention/);
});

test('the index raises failures in their own section', () => {
  const entries = [{
    position, quote: noQuote, valued: valuePosition(position, noQuote), noteName: 'AAAA', share: null
  }];
  const index = renderIndex({
    entries, unpriced: [], month,
    runAt: '2099-01-15T21:00:00.000Z',
    totals: { priced: 0, stated: 0, ok: 0, failed: 1 }
  });
  assert.match(index, /## Needs attention/);
  assert.match(index, /provider rejected the symbol/);
  assert.match(index, /\*\*1 without a quote\*\*/);
});

/* ------------------------------------------- regressions found in review */

test('a CRLF note keeps its history (Obsidian on Windows saves CRLF)', () => {
  const first = build();
  const crlf = first.replace(/\n/g, '\r\n');
  assert.equal(parseExisting(crlf).history.length, 1,
    'CRLF must not parse as zero history rows');

  const rebuilt = build({ existing: crlf, runAt: '2099-01-16T21:00:00.000Z' });
  assert.deepEqual(parseExisting(rebuilt).history.map((r) => r.date),
    ['2099-01-15', '2099-01-16'], 'prior days must survive a CRLF round trip');
});

test('a CRLF note keeps the notes tail too', () => {
  const mine = 'My thesis: synthetic.';
  const first = build().replace(/<!-- yours[^>]*-->/, mine);
  const rebuilt = build({ existing: first.replace(/\n/g, '\r\n') });
  assert.match(rebuilt.slice(rebuilt.indexOf(NOTES_HEADING)), /My thesis: synthetic\./);
});

test('an unreadable lot amount makes the total unknown, not smaller', () => {
  const broken = {
    symbol: 'AAAA',
    kind: 'Equity',
    lots: [
      { platform: 'AlphaBroker', amount: 10, unit: 'Shares', notes: '' },
      { platform: 'BetaBroker', amount: Number.NaN, unit: 'Shares', notes: '' }
    ]
  };
  const valued = valuePosition(broken, quote);
  assert.equal(valued.total, null, 'must not report $200 for a 2-lot position');
  assert.equal(valued.amount, null);

  const note = renderNote({
    position: broken, quote, valued, month,
    runAt: '2099-01-15T21:00:00.000Z', share: null, existing: ''
  });
  assert.match(note, /position_value: null/);
});

test('a name containing a colon does not break the YAML block', () => {
  const note = build({ quote: { ...quote, name: 'Alpha: Test, Inc.' } });
  const block = note.slice(0, note.indexOf('\n---', 4));
  assert.match(block, /name: 'Alpha: Test, Inc\.'/);
  /* A bare colon in an unquoted scalar is what breaks Obsidian's parser. */
  assert.doesNotMatch(block, /\nname: Alpha: /);
});

test('yamlScalar quotes what needs it and leaves plain text alone', () => {
  assert.equal(yamlScalar('Vistra Corp'), 'Vistra Corp');
  assert.equal(yamlScalar('Alpha: Bar'), "'Alpha: Bar'");
  assert.equal(yamlScalar("O'Reilly Inc"), "'O''Reilly Inc'");
  assert.equal(yamlScalar('[bracketed]'), "'[bracketed]'");
  assert.equal(yamlScalar(''), "''");
  assert.equal(yamlScalar(null), 'null');
  assert.equal(yamlScalar(20), '20');
  assert.equal(yamlScalar('NO'), "'NO'", 'YAML would read a bare NO as false');
});
