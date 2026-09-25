/* Render one market-update note per holding, plus an index.

   Two rules make these notes safe to actually write in:

     1. Everything below the "## Notes" heading is yours. A rebuild parses the
        existing file and copies that tail through byte for byte.
     2. The History table is appended, never rewritten. Re-running on the same
        date replaces that date's row instead of adding a second one, so the
        table stays one row per day however often the script runs.

   BLUEPRINT §12: a stale or missing value must look stale. A symbol the
   provider could not price still gets its note, carrying a visible warning and
   no History row, rather than quietly keeping yesterday's number. */

export const NOTES_HEADING = '## Notes';
const NOTES_HINT = '<!-- yours; the generator never touches below this line -->';

/* ------------------------------------------------------------- formatting */

export function money(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function qty(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 5 });
}

export function pct(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function arrow(value) {
  if (value == null || !Number.isFinite(value) || value === 0) return '·';
  return value > 0 ? '▲' : '▼';
}

/** "2026-09-24T20:15:00Z" -> "2026-09-24 20:15 UTC" */
export function humanStamp(iso) {
  if (!iso) return 'unknown';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
}

export function dayOf(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

/* ------------------------------------------------------ existing-file parse */

/** Split a note into the History rows it already holds and the Notes tail.

    Line endings are normalized first. Obsidian on Windows saves CRLF, and an
    edited note coming back with \r\n used to parse as zero history rows — which
    meant the next rebuild silently wiped every prior day. */
export function parseExisting(raw) {
  if (!raw) return { history: [], tail: '' };
  const text = String(raw).replace(/\r\n?/g, '\n');

  const at = text.indexOf(`\n${NOTES_HEADING}`);
  const body = at === -1 ? text : text.slice(0, at);
  const tail = at === -1 ? '' : text.slice(at + NOTES_HEADING.length + 1).replace(/^\n/, '');

  const history = [];
  const section = /\n## History\n([\s\S]*?)(?=\n## |$)/.exec(body);
  if (section) {
    for (const line of section[1].split('\n')) {
      const cells = line.split('|').map((c) => c.trim());
      /* A data row is "| 2026-09-24 | ... |" — six cells once the empty
         leading and trailing splits are counted. Header and rule rows fail
         the date test and drop out. */
      if (cells.length >= 6 && /^\d{4}-\d{2}-\d{2}$/.test(cells[1])) {
        history.push({ date: cells[1], price: cells[2], change: cells[3], value: cells[4] });
      }
    }
  }
  return { history, tail };
}

/** Same-date rows replace; everything else keeps its order, oldest first. */
export function mergeHistory(existing, row) {
  if (!row) return existing;
  const kept = existing.filter((r) => r.date !== row.date);
  kept.push(row);
  kept.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return kept;
}

/* --------------------------------------------------------------- rendering */

/* A security name is provider text and can hold anything. "Foo: Bar Inc" or a
   leading "[" would break the YAML block, and a note with invalid frontmatter
   drops out of every Obsidian query. Quote anything that is not plainly safe. */
export function yamlScalar(value) {
  if (value == null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const s = String(value);
  if (s === '') return "''";
  const needsQuotes = /[:#,[\]{}&*!|>'"%@`]/.test(s)
    || /^[-?\s]/.test(s)
    || /\s$/.test(s)
    || /^(true|false|null|yes|no|on|off|~)$/i.test(s)
    || /^[\d.+-]+$/.test(s);
  if (!needsQuotes) return s;
  return `'${s.replace(/'/g, "''")}'`;
}

function frontmatter(fields) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) lines.push(`${key}: [${value.map(yamlScalar).join(', ')}]`);
    else lines.push(`${key}: ${yamlScalar(value)}`);
  }
  lines.push('---');
  return lines.join('\n');
}

/** Total market value of a position, and the per-lot values behind it.

    A lot with an unreadable amount makes the *total* unknown, not smaller.
    Treating it as zero would report a confident number covering only part of
    the position — exactly the silent-wrongness BLUEPRINT §12 rules out. The
    same goes for the share count. */
export function valuePosition(position, quote) {
  const price = quote && quote.ok ? quote.price : null;
  const lots = position.lots.map((lot) => ({
    ...lot,
    value: price == null || !Number.isFinite(lot.amount) ? null : lot.amount * price
  }));

  const everyAmountReadable = position.lots.every((lot) => Number.isFinite(lot.amount));
  const total = price == null || !everyAmountReadable
    ? null
    : lots.reduce((sum, lot) => sum + lot.value, 0);
  const amount = everyAmountReadable
    ? position.lots.reduce((sum, lot) => sum + lot.amount, 0)
    : null;

  return { price, lots, total, amount };
}

export function renderNote({ position, quote, valued, month, runAt, share, existing }) {
  const { history: priorHistory, tail } = parseExisting(existing);
  const asOf = (quote && quote.asOf) || runAt;
  const date = dayOf(runAt);

  const row = quote && quote.ok
    ? { date, price: money(valued.price), change: pct(quote.percentChange), value: money(valued.total) }
    : null;
  const history = mergeHistory(priorHistory, row);

  const platforms = [...new Set(position.lots.map((l) => l.platform).filter(Boolean))];
  const title = quote && quote.name ? `${position.symbol} — ${quote.name}` : position.symbol;

  const out = [];
  out.push(frontmatter({
    ticker: position.symbol,
    name: (quote && quote.name) || null,
    type: position.kind,
    platforms,
    price: quote && quote.ok ? valued.price : null,
    change_pct: quote && quote.ok && quote.percentChange != null
      ? Number(quote.percentChange.toFixed(2))
      : null,
    position_value: valued.total == null ? null : Number(valued.total.toFixed(2)),
    as_of: asOf,
    source: 'Twelve Data (delayed)',
    snapshot_month: month.tab || month.month || 'unknown',
    updated: date,
    tags: ['market-update', 'holding']
  }));
  out.push('');
  out.push(`# ${title}`);
  out.push('');

  if (quote && quote.ok) {
    out.push(`**${money(valued.price)}**  ${arrow(quote.percentChange)} ${money(quote.change)} (${pct(quote.percentChange)})`);
    out.push('');
    out.push(`as of ${humanStamp(asOf)} · Twelve Data, delayed${quote.exchange ? ` · ${quote.exchange}` : ''}`);
  } else {
    out.push(`> [!warning] No quote returned for ${position.symbol} on ${date}`);
    out.push(`> ${(quote && quote.error) || 'The provider had no answer for this symbol.'}`);
    out.push('> Position amounts below are from the snapshot and are still good; the value is not.');
  }

  out.push('');
  out.push('## Position');
  out.push('');
  out.push('| Platform | Amount | Unit | Value | Notes |');
  out.push('|---|---:|---|---:|---|');
  for (const lot of valued.lots) {
    out.push(`| ${lot.platform || '—'} | ${qty(lot.amount)} | ${lot.unit || '—'} | ${money(lot.value)} | ${lot.notes || ''} |`);
  }
  if (valued.lots.length > 1) {
    out.push(`| **Total** | **${qty(valued.amount)}** | | **${money(valued.total)}** | |`);
  }
  out.push('');
  out.push(`Share of priced portfolio: ${share == null ? '—' : `${share.toFixed(1)}%`}`);
  out.push('');
  out.push('## History');
  out.push('');
  out.push('| Date | Price | Change | Position value |');
  out.push('|---|---:|---:|---:|');
  for (const h of history) out.push(`| ${h.date} | ${h.price} | ${h.change} | ${h.value} |`);
  if (history.length === 0) out.push('| — | — | — | — |');
  out.push('');
  out.push(
    `Snapshot: ${month.tab || month.month}${month.date ? ` (${month.date})` : ''}. ` +
    'Amounts come from the Asset Tracking sheet, prices from Twelve Data.'
  );
  out.push('');
  out.push(NOTES_HEADING);
  out.push('');
  out.push(tail.trim() ? tail.replace(/\s+$/, '') : NOTES_HINT);
  out.push('');

  return out.join('\n');
}

/* ------------------------------------------------------------------ index */

export function renderIndex({ entries, unpriced, month, runAt, totals }) {
  const date = dayOf(runAt);
  const out = [];

  out.push(frontmatter({
    title: 'Market Update',
    as_of: runAt,
    snapshot_month: month.tab || month.month || 'unknown',
    priced_value: Number(totals.priced.toFixed(2)),
    stated_value: Number(totals.stated.toFixed(2)),
    positions_priced: totals.ok,
    positions_failed: totals.failed,
    updated: date,
    tags: ['market-update', 'index']
  }));
  out.push('');
  out.push('# Market Update');
  out.push('');
  out.push(`${humanStamp(runAt)} · snapshot **${month.tab || month.month}**${month.date ? ` (${month.date})` : ''} · prices from Twelve Data, delayed`);
  out.push('');
  out.push(
    `**${money(totals.priced)}** across ${totals.ok} priced position${totals.ok === 1 ? '' : 's'}` +
    (totals.failed ? `, **${totals.failed} without a quote**` : '') +
    (unpriced.length ? `, plus ${money(totals.stated)} carried at stated value` : '') + '.'
  );
  out.push('');
  out.push('## Holdings');
  out.push('');
  out.push('| Ticker | Platforms | Amount | Price | Change | Value | Share |');
  out.push('|---|---|---:|---:|---:|---:|---:|');

  for (const e of entries) {
    const platforms = [...new Set(e.position.lots.map((l) => l.platform).filter(Boolean))].join(', ');
    const change = e.quote && e.quote.ok ? `${arrow(e.quote.percentChange)} ${pct(e.quote.percentChange)}` : '—';
    const link = `[[${e.noteName}\\|${e.position.symbol}]]`;
    out.push(`| ${link} | ${platforms} | ${qty(e.valued.amount)} | ${money(e.valued.price)} | ${change} | ${money(e.valued.total)} | ${e.share == null ? '—' : `${e.share.toFixed(1)}%`} |`);
  }

  if (unpriced.length) {
    out.push('');
    out.push('## Carried at stated value');
    out.push('');
    out.push('Rows the sheet already records in dollars — cash, option positions and managed balances. No quote is fetched for these.');
    out.push('');
    out.push('| Platform | Item | Kind | Value | Notes |');
    out.push('|---|---|---|---:|---|');
    for (const u of unpriced) {
      out.push(`| ${u.platform || '—'} | ${u.label} | ${u.kind} | ${money(u.amount)} | ${u.notes || ''} |`);
    }
  }

  const failures = entries.filter((e) => !(e.quote && e.quote.ok));
  if (failures.length) {
    out.push('');
    out.push('## Needs attention');
    out.push('');
    for (const f of failures) {
      out.push(`- [[${f.noteName}\\|${f.position.symbol}]] — ${(f.quote && f.quote.error) || 'no quote returned'}`);
    }
  }

  out.push('');
  out.push('---');
  out.push('');
  out.push('Amounts come from the Asset Tracking sheet via `private/STOCK_HANDOFF.md`; nothing here is advice, and no value is live.');
  out.push('');
  return out.join('\n');
}
