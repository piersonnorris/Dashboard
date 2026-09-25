# Dashboard

A private personal-finance and investment dashboard. The full product definition
is in [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md); this README covers what is
actually built.

## What exists today (chunk 1)

Holdings ingestion, a market-data provider seam, and a generator that writes one
Markdown note per holding plus an index, for reading in Obsidian.

```
private/STOCK_HANDOFF.md          the Asset Tracking sheet's snapshot (gitignored)
        │
        ├─ src/lib/holdings       parse, classify, group into positions
        ├─ src/lib/market-data    provider seam + the Twelve Data adapter
        └─ src/lib/notes          render the Markdown
                │
                ├─ out/market-updates/                      (gitignored)
                └─ ../PN Website Project/Dashboard/Market Updates/   (Obsidian)
```

Nothing here trades, transfers or moves money, and nothing reads a brokerage
credential. Market data is read-only and delayed.

## Privacy boundary

**`.gitignore` is deny-by-default**: `*` on the first line, then an explicit `!`
allowlist. A new source file needs its own `!` entry; a new private file needs
nothing, because it is already ignored.

Never tracked, never in a commit message, never pasted into a chat:

| Path | Holds |
|---|---|
| `private/STOCK_HANDOFF.md` | real share counts, copied from stock-trackers |
| `private/.twelvedata-key` | the market-data API key |
| `private/quote-cache.json` | real prices for the last 15 minutes |
| `out/market-updates/` | generated notes with real position values |

The vault output directory sits inside the **public website repo's** working
tree. That repo ignores it by the same deny-by-default rule, and
`scripts/market-update.mjs` re-checks this with `git check-ignore` on every run —
it refuses to write if the answer ever changes.

Before any commit here:

```bash
git status --short
git check-ignore -v private out .env
```

## Running it

Node 20+ (24.14.0 locally). No dependencies.

```bash
npm run pull            # refresh private/STOCK_HANDOFF.md from stock-trackers
npm run update          # fetch quotes, write notes to out/ and the vault
npm run update:dry      # write out/ only, leave the vault alone
npm run update:cached   # reuse the quote cache — for iterating on formatting
npm test                # 51 tests, synthetic fixtures only
```

`scripts/market-update.mjs` also takes `--symbol VST` to build one note.

A full run takes about four minutes: Twelve Data's free tier allows 8 credits a
minute and each symbol costs one, so symbols go out in chunks of 8 with a 60s
pause between them. This is the same pacing `stock-trackers/build.js` uses.

## What the notes promise

- **Your writing is yours.** Everything below the `## Notes` heading is copied
  through a rebuild byte for byte. Write a thesis in there.
- **History is appended, not rewritten.** One row per day; re-running on the same
  date replaces that day's row rather than adding a second.
- **Staleness is visible.** A symbol the provider could not price still gets its
  note, carrying a warning callout and no history row, rather than quietly
  keeping yesterday's number.
- **Cash, options and managed balances** are already recorded in dollars by the
  sheet, so no quote is fetched for them. They appear in the index under
  "Carried at stated value".

## What this is not

No cost basis, no realized or unrealized gain, no performance figures. Those need
a dated transaction ledger, and `docs/BLUEPRINT.md` §10 is explicit that
performance must not be inferred from a position snapshot. Nothing here is
advice.
