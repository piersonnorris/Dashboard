# ADR 0002: local dependency-free dashboard prototype

**Status:** accepted for the first visual milestone
**Date:** 2026-09-25

## Decision

Build the first dashboard shell as a dependency-free static application served
by the repository's small Node.js preview server. It uses synthetic data only
and runs with `npm run dev`.

## Why

The repository already contains working Node-based holdings ingestion but no
browser UI. A static shell produces a testable, responsive interface without
introducing a framework migration, package supply-chain changes, authentication
assumptions, or a path from private files into browser code.

## Consequences

- The current milestone proves navigation, layout, charts, privacy masking,
  responsive behavior, accessibility, and the data contract.
- Add/import actions are intentionally non-persistent and say so in the UI.
- The existing holdings and market-note pipeline remains unchanged.
- This does not replace the blueprint's production architecture decision.
  Authentication, a database, server-side calculations, and a safe local data
  adapter remain later milestones.
