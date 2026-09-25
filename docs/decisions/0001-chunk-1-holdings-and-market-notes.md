# ADR 0001 — Chunk 1: holdings ingestion and market-update notes

- **Date:** 2026-09-24
- **Status:** Accepted
- **Decided by:** Pierson Norris
- **Relates to:** BLUEPRINT §11 (market data), §13 (roadmap), §17 (Obsidian model), §20 (decisions before coding)

## Context

The blueprint was complete and nothing was built. Rather than open with the
Phase 1 scaffold (Next.js, Postgres, auth), the first chunk was scoped to the
two seams every later phase depends on — **getting real holdings in** and
**getting a market-data provider behind an interface** — with a deliverable that
is useful on its own: per-asset market-update notes, readable in Obsidian today.

## Decisions

### 1. Output goes to both `out/` and the Obsidian vault

The generator writes `out/market-updates/` in this repo and copies the tree to
`PN Website Project\Dashboard\Market Updates\`.

*Why:* the vault copy is the one actually read and annotated; `out/` is the build
artifact and the thing a future CI job would produce. When a note already exists
in the vault, the generator reads **that** copy for prior history and personal
notes, so the vault is effectively authoritative for the parts a human wrote.

*Risk accepted:* two copies can drift if `out/` is inspected as if it were
current. It is regenerated on every run, so the drift window is one run.

### 2. Holdings come from the stock-trackers snapshot, copied in

`scripts/pull-holdings.mjs` copies `stock-trackers/private/STOCK_HANDOFF.md`
into `private/`.

*Why:* that file is already refreshed weekly from the Asset Tracking sheet by a
scheduled task, needs no credentials, and works unattended. Reading the Google
Sheet directly would be fresher but requires either the session-bound Drive
connector or a service account — neither can run headless today.

*Why a copy, not a cross-repo read:* one documented input path, and no runtime
dependency on a sibling repo's directory layout.

*Consequence:* the notes are only as current as the last sheet export. Every note
and the index stamp the snapshot tab and date, so this is visible rather than
assumed. When the Sheet pipeline (stock-trackers R2) lands, only
`pull-holdings.mjs` changes.

### 3. One note per ticker, plus an index

`AAAA.md` per symbol, rewritten each run, with a growing History table; plus
`_Market Update.md` linking them all with `[[wikilinks]]`.

*Why:* a dated digest per run would give no per-ticker history and would pile up
files. Per-ticker notes accumulate a price history in place and give each holding
one durable, linkable home for a thesis — which is what makes them worth opening
in Obsidian rather than reading a table.

*Consequence:* the writer must never clobber what the human wrote. Two rules
enforce this and both are tested: everything below `## Notes` survives byte for
byte, and a same-date rerun replaces that date's history row rather than adding
one.

### 4. Numbers only; headless

Price, change, position value, allocation and freshness — no news, no narrative.

*Why:* the whole run is a plain `node` script with no Claude session in the loop,
so it can be scheduled later without rework. Adding per-ticker narrative would
bind every run to a live session with WebSearch.

*Consequence:* the `## Notes` section is where judgement lives, written by hand.
A narrative slot can be added later without changing the generator's contract,
since that section is already untouched by rebuilds.

## Also decided

- **Twelve Data, via a provider interface.** `src/lib/market-data/provider.mjs`
  declares the blueprint's §11 shape; `twelvedata.mjs` implements `getQuotes`
  only, and the rest throws `NotImplemented` so an accidental call fails loudly.
  `/quote` rather than `/price`: one call returns close, previous close, change,
  percent change, name and exchange.
- **`classify()` is ported verbatim** from `stock-trackers/assets/js/prices.js`
  rather than re-derived. It is the existing, correct rule for what
  "SOL (crypto)" at 1.2 Units means, and two independent copies of that
  judgement would drift.
- **No cost basis or performance.** BLUEPRINT §10 forbids inferring performance
  from a position snapshot, and there is no dated transaction ledger.
- **Deny-by-default `.gitignore` written before any other file.** The repo had no
  ignore file at all while this chunk was about to introduce real share counts
  and an API key into the working tree.

## Deferred

Next.js scaffold, database, auth, CSV import, cost basis, news narrative, and a
scheduled task. None is blocked by this chunk; the ingestion and provider seams
are what they would build on.
