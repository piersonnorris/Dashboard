/* Read the private holdings snapshot and work out what each row actually is.

   The snapshot is `private/STOCK_HANDOFF.md` — a human-readable note with one
   fenced ```json block under "## Machine-readable snapshot". That file is the
   weekly Google Sheet export maintained by the stock-trackers project; nothing
   here writes to it, and nothing here prints a holding.

   classify() and symbolsNeeded() are ported verbatim from stock-trackers'
   assets/js/prices.js (PNPrices) so both projects agree on what "SOL (crypto)"
   at 1.2 Units means. Change them in one place and the two drift apart. */
import fs from 'node:fs';

/** Pull the machine-readable block out of the handoff note. */
export function readHandoff(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const marker = text.indexOf('## Machine-readable snapshot');
  if (marker === -1) {
    throw new Error(`No "## Machine-readable snapshot" heading in ${filePath}`);
  }
  const fence = /```json\s*\n([\s\S]*?)\n```/.exec(text.slice(marker));
  if (!fence) {
    throw new Error(`No fenced json block after the snapshot heading in ${filePath}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(fence[1]);
  } catch (err) {
    throw new Error(`The snapshot's json block does not parse: ${err.message}`);
  }
  return normalize(parsed);
}

/* build.js accepts either shape, so this does too: the current note carries
   `months` (newest first); older ones were a single month object. */
function normalize(parsed) {
  if (parsed && Array.isArray(parsed.months)) return parsed;
  if (parsed && Array.isArray(parsed.holdings)) return { months: [parsed] };
  throw new Error('Snapshot json has neither a months array nor a holdings array');
}

export function latestMonth(snapshot) {
  const month = snapshot.months[0];
  if (!month || !Array.isArray(month.holdings) || month.holdings.length === 0) {
    throw new Error('The newest month in the snapshot has no holdings');
  }
  return month;
}

/* ---------------------------------------------------------------- classify

   Ported from stock-trackers assets/js/prices.js. Labels are free text, so
   this is deliberately forgiving and never throws. */
export function classify(h) {
  const label = String(h.label || '').trim();
  const unit = String(h.unit || '').trim().toLowerCase();
  const lower = label.toLowerCase();

  if (unit === 'usd') {
    let kind = 'Cash';
    if (/option|call|put/.test(lower)) kind = 'Options';
    else if (/crypto/.test(lower)) kind = 'Crypto';
    else if (/robo|auto-invest/.test(lower)) kind = 'Managed';
    else if (/total value|total/.test(lower)) kind = 'Other';
    else if (/cash/.test(lower)) kind = 'Cash';
    else kind = 'Other';
    return { kind, symbol: null, priced: true };
  }

  /* Strip parenthetical qualifiers: "SOL (crypto)" -> "SOL" */
  let sym = label.replace(/\([^)]*\)/g, '').trim().toUpperCase();
  sym = sym.replace(/[^A-Z0-9.\-]/g, '');

  if (unit === 'units') {
    return { kind: 'Crypto', symbol: sym ? sym + '/USD' : null, priced: false };
  }
  if (unit === 'shares') {
    return { kind: 'Equity', symbol: sym || null, priced: false };
  }
  return { kind: 'Other', symbol: null, priced: false };
}

/** Every distinct symbol that would need a live quote. */
export function symbolsNeeded(holdings) {
  const seen = new Set();
  for (const h of holdings || []) {
    const c = classify(h);
    if (c.symbol) seen.add(c.symbol);
  }
  return [...seen];
}

/* ------------------------------------------------------------- grouping

   One note per ticker, not per row: a ticker held on two platforms is one
   position with two lots. Rows that need no quote (cash, options, robo
   balances) come back separately so the index can still account for them. */
export function positionsBySymbol(holdings) {
  const priced = new Map();
  const unpriced = [];

  for (const h of holdings || []) {
    const c = classify(h);
    const lot = {
      platform: h.platform || '',
      label: h.label || '',
      amount: Number(h.amount),
      unit: h.unit || '',
      notes: h.notes || ''
    };
    if (!c.symbol) {
      unpriced.push({ ...lot, kind: c.kind });
      continue;
    }
    if (!priced.has(c.symbol)) {
      priced.set(c.symbol, { symbol: c.symbol, kind: c.kind, lots: [] });
    }
    priced.get(c.symbol).lots.push(lot);
  }

  return { positions: [...priced.values()], unpriced };
}

/** Filename-safe form of a symbol: "SOL/USD" -> "SOL-USD". */
export function noteName(symbol) {
  return String(symbol).replace(/\//g, '-');
}
