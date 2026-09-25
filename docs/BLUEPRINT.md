---
title: Personal Financial Dashboard Blueprint
aliases:
  - Dashboard Blueprint
  - Finance Dashboard Plan
status: planning
owner: Pierson Norris
created: 2026-09-24
updated: 2026-09-24
repository: https://github.com/piersonnorris/Dashboard
authoritative_copy: GitHub docs/BLUEPRINT.md
tags:
  - dashboard
  - personal-finance
  - portfolio-tracking
  - engineering
---

# Personal Financial Dashboard Blueprint

> [!summary]
> Build a private, original personal-finance and investment dashboard inspired by the clarity and interaction patterns of SakuStocks. It will combine net worth, accounts, transactions, cash flow, holdings, goals, watchlists, market context, and explainable insights without copying Saku branding, assets, copy, data, or source code.

## Project record

| Item | Decision |
|---|---|
| GitHub repository | [piersonnorris/Dashboard](https://github.com/piersonnorris/Dashboard) |
| Visibility | Private |
| Default branch | main |
| GitHub document | docs/BLUEPRINT.md |
| Obsidian mirror | Dashboard/Personal Financial Dashboard Blueprint.md |
| Source of truth | GitHub is authoritative; update this mirror after approved changes |
| Current phase | Phase 1 — chunk 1 shipped 2026-09-24: holdings ingestion, provider seam, market-update notes |
| Reference reviewed | [SakuStocks public preview](https://app.sakustocks.com/) on 2026-09-24 |
| Existing related project | Private stock-trackers repo; reuse only reviewed code and synthetic fixtures |

## 1. Vision

Create one secure dashboard that answers:

- What is my current net worth?
- How much is held in cash, investments, property, and other assets?
- What do I owe?
- How have net worth and investments changed?
- What did I earn and spend this month?
- Which records need attention?
- Am I on track for my goals?
- Which securities am I watching?
- How current and trustworthy is each value?

The finished product should feel fast, visual, and scannable like a modern market terminal, but it will center on Pierson's financial position rather than a public investing network.

## 2. Saku reference and functional mapping

The public Saku preview includes:

1. Home with market climate, index movement, trending securities, and a watchlist called Your Garden.
2. Feed with human and AI market theses, targets, reactions, and discussions.
3. Discover with symbol search, sectors, news, investors, and agents.
4. Insights with recaps, catalysts, market events, education, and progression.
5. Profile with watchlist summary, levels, accuracy, badges, and themes.
6. Asset detail with chart ranges, fundamentals, news, synthesis, and discussion.

| Saku pattern | Original dashboard adaptation |
|---|---|
| Market Climate | Financial Health: net-worth trend, savings rate, liquidity, debt, and freshness |
| Your Garden | Accounts, holdings, and watchlists |
| Trending Seeds | Portfolio movers, watchlist movers, and alerts |
| Community Feed | Private activity and insight timeline; social features deferred |
| Saku Synthesis | Explainable summaries backed by visible formulas and source times |
| Catalysts | Earnings, dividends, bills, recurring payments, and deadlines |
| Conviction and accuracy | Goal progress and forecast-versus-actual tracking |
| Levels and badges | Optional habits and milestones after core math is reliable |
| Asset detail | Price chart, position context, lots, fundamentals, news, notes, and activity |

### Intellectual-property boundary

- Reuse general interaction ideas, not proprietary expression.
- Create original branding, names, copy, icons, layout details, and visual assets.
- Do not scrape or copy Saku code, data, articles, AI output, or artwork.
- Do not imply affiliation with or endorsement by SakuStocks.

## 3. Product principles

1. Personal position first: the first screen answers where the user stands.
2. Traceable totals: every aggregate drills down to source records and formulas.
3. Manual and CSV before aggregators: prove reconciliation before Plaid or broker connections.
4. Canonical ledger: records are authoritative; cards and charts are rebuildable views.
5. Privacy by design: no real financial data, exports, tokens, or account numbers in Git.
6. Read-only first: no trading, transfers, payments, or money movement.
7. Clear freshness: every balance, price, and snapshot has a source and as-of time.
8. Progressive complexity: the app is useful after a few inputs and deepens with history.
9. Original design: inspiration is pattern-level, never pixel-level.
10. Accessible and responsive: keyboard, screen reader, mobile, tablet, and desktop.

## 4. Scope

### MVP

- Private authentication
- Fictional demo mode
- Manual asset and liability accounts
- Balance snapshots and net worth
- Manual transactions
- CSV mapping, preview, validation, duplicate detection, import, and reversal
- Holdings and investment transactions
- Cost basis, market value, realized and unrealized estimates, and allocation
- Cash-flow reporting
- Watchlists and goals
- Server-side market-data adapter
- Source and freshness indicators
- Privacy mode for screen sharing
- Data export and deletion
- Responsive layouts

### Later

- Plaid or another aggregator
- Brokerage-specific adapters
- Recurring-transaction detection
- Budgets and category targets
- Dividend projections and calendar
- Scenario modeling
- Rule-based and AI-assisted explanations
- Household sharing
- PWA or native-mobile improvements
- Options and alternative-asset analytics

### Not in the first release

- Trade execution, custody, payments, or transfers
- Personalized investment advice
- Tax filing or tax-form generation
- Credit decisions
- Storage of bank usernames or passwords
- Public social posting or leaderboards
- Production use of a data provider before reviewing its license and display terms

## 5. Information architecture

### Navigation

- Overview
- Portfolio
- Accounts
- Transactions
- Cash Flow
- Goals
- Watchlists
- Insights
- Settings

### Proposed routes

~~~text
/
├── /sign-in
├── /onboarding
├── /dashboard
├── /portfolio
│   ├── /holdings
│   ├── /activity
│   └── /asset/[symbol]
├── /accounts/[accountId]
├── /transactions
│   ├── /new
│   └── /import
├── /cash-flow
├── /goals/[goalId]
├── /watchlists/[watchlistId]
├── /insights
└── /settings
    ├── /profile
    ├── /security
    ├── /data
    └── /integrations
~~~

Desktop uses a collapsible sidebar, global search, freshness status, privacy toggle, responsive card grid, and optional alert rail. Mobile uses a compact top bar, bottom navigation, single-column cards, and touch-friendly charts.

## 6. Overview blueprint

Order modules by decision value:

1. Financial position
2. Changes and trends
3. Items needing attention
4. Investment performance
5. Goals
6. Market context

### Summary cards

- Net worth
- Total assets
- Total liabilities
- Monthly cash flow
- Portfolio value
- Available cash

Each card shows current value, comparison change, as-of time, source state, drill-down link, and loading, empty, stale, and error variants.

### Charts and modules

- Net worth: assets, liabilities, and net worth over 1M, 3M, 6M, YTD, 1Y, and All.
- Portfolio: allocation by asset class, account, sector, and security.
- Cash flow: income, expenses, net flow, category mix, and month comparison.
- Goals: amount, target, pace, date, and status.
- Attention center: duplicates, stale accounts, missing prices, failed jobs, and late goals.
- Watchlist: price, daily change, mini chart, alert, and market-data time.

Every chart needs an accessible text or table equivalent.

## 7. Primary flows

### First use

1. Sign in and review the data notice.
2. Choose demo data, manual setup, or CSV import.
3. Add an account and opening balance or holdings.
4. Generate the first snapshot.
5. Keep unfinished modules visible with a clear next action.

Target: reach a meaningful dashboard within five minutes without an institution connection.

### CSV import

1. Choose account and import type.
2. Parse locally when practical.
3. Map columns and normalize dates, signs, symbols, and currencies.
4. Preview valid rows, warnings, errors, and duplicate candidates.
5. Resolve or exclude flagged rows.
6. Confirm one atomic import.
7. Report exact imported, skipped, rejected, and duplicate counts.
8. Offer an audited reversal.

Idempotency rule: importing the same source twice creates no silent duplicates.

### Investment activity

Support buy, sell, dividend, interest, fee, transfer, split, and adjustment. Preview cash and position impact, then recalculate only affected lots, positions, and snapshots.

### Goals and watchlists

Watchlists never alter holdings. Goals may link accounts or be manual, show required pace, and preserve historical snapshots rather than rewriting the past.

## 8. Recommended architecture

> [!note]
> This stack is recommended, not locked. Confirm it through architecture decision records before scaffolding.

| Layer | Recommendation | Reason |
|---|---|---|
| Application | Next.js App Router and TypeScript | UI, server routes, and jobs in one repo |
| UI | Tailwind plus accessible Radix or shadcn primitives | Fast and consistent original system |
| Forms | React Hook Form and Zod | Shared client and server validation |
| Tables | TanStack Table | Dense ledgers, sorting, filtering, and pagination |
| Charts | Recharts or Visx, plus a finance chart library if needed | Dashboard and price history |
| Database | PostgreSQL | Decimal math, constraints, transactions, and auditability |
| Query layer | Drizzle or Prisma | Typed migrations and queries |
| Auth and data | Supabase is the first candidate | Auth, PostgreSQL, backups, and row security |
| Hosting | Vercel is the first candidate | Previews, production, and scheduled jobs |
| Monitoring | Sentry and redacted structured logs | Error and job visibility |
| Tests | Vitest, Playwright, and database authorization tests | Domain, UI, and security coverage |
| CI | GitHub Actions | Checks, builds, migrations, and scans |

~~~mermaid
flowchart LR
    U[Private browser] --> W[Next.js UI and server]
    W --> A[Authentication]
    W --> D[(PostgreSQL)]
    W --> M[Market-data adapter]
    M --> P[Selected provider]
    U --> I[CSV preview and mapping]
    I --> W
    C[Authenticated scheduler] --> J[Idempotent jobs]
    J --> M
    J --> D
    H[Aggregator webhooks later] --> V[Signature verification]
    V --> J
    D --> Q[Calculation service]
    Q --> S[Snapshots and dashboard queries]
~~~

The browser never receives database service keys, market-data secrets, aggregator secrets, access tokens, or another user's records.

## 9. Repository shape

~~~text
Dashboard/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   ├── pull_request_template.md
│   └── workflows/
├── docs/
│   ├── BLUEPRINT.md
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   ├── SECURITY.md
│   ├── DESIGN_SYSTEM.md
│   └── decisions/
├── public/
├── scripts/
├── src/
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── lib/
│   │   ├── calculations/
│   │   ├── database/
│   │   ├── imports/
│   │   ├── market-data/
│   │   ├── observability/
│   │   └── validation/
│   └── types/
├── tests/
│   ├── e2e/
│   ├── fixtures/
│   ├── integration/
│   └── unit/
├── .env.example
├── .gitignore
├── CONTRIBUTING.md
├── LICENSE
├── README.md
└── package.json
~~~

## 10. Data model and rules

### Data layers

1. Ingestion validates manual inputs, CSV rows, provider responses, and later aggregator events.
2. Canonical ledger stores accounts, balances, transactions, transfers, securities, and lots.
3. Market data stores normalized prices, actions, and FX.
4. Derived data stores positions, gains, cash flow, and daily snapshots.
5. Presentation queries return only what each card or chart needs.

Raw imports should normally be parsed and discarded. Persist normalized rows, file hash, validation results, and audit metadata.

| Table group | Purpose |
|---|---|
| profiles | Currency, timezone, and display settings |
| accounts and balance_snapshots | Assets, liabilities, balances, and reconciliation |
| transactions and transaction_revisions | Cash ledger and audited corrections |
| transfer_groups and categories | Internal transfers and cash-flow classification |
| securities and investment_transactions | Stable security identity and activity |
| lots and lot_disposals | Remaining basis and realized estimates |
| market_prices, corporate_actions, fx_rates | Reference data with provider metadata |
| holding_snapshots and portfolio_snapshots | Rebuildable point-in-time analytics |
| watchlists and goals | Research and financial targets |
| import_batches and import_rows | Mapping, review, commit, and reversal |
| provider_connections and sync_jobs | Encrypted references, cursors, retries, and state |
| audit_events | Sensitive actions with redacted metadata |

Use decimal database types for money, quantities, prices, and FX. Store UTC timestamps while retaining source-local trade dates. Every user-owned record must enforce row-level authorization.

### Sign conventions

| Type | Quantity | Cash |
|---|---:|---:|
| Buy | Positive | Negative |
| Sell | Negative | Positive |
| Dividend, interest, deposit | None | Positive |
| Fee, tax, withdrawal | None | Negative |
| Transfer | Two linked records | Excluded from income and performance |
| Split | Quantity adjustment | Zero |
| Reversal | Correcting record | Never silent deletion |

### Core formulas

~~~text
Net worth = total assets - total liabilities
Position quantity = signed quantity sum adjusted for splits
Market value = quantity × latest eligible price
Unrealized gain = market value - remaining basis
Realized gain = net proceeds - allocated lot basis
Monthly cash flow = included income - included expenses
Daily P&L = ending value - prior value - external net flow
Allocation = position value / included investable value
~~~

Start with FIFO informational estimates and broker-reported overrides. Label time-weighted and money-weighted returns. Do not infer historical performance from only a current-position snapshot. Tax reporting and wash-sale logic stay out of scope until professionally validated.

## 11. Market data and future connections

Use a provider adapter so application features do not depend on one vendor.

~~~typescript
interface MarketDataProvider {
  searchSecurities(query: string): Promise<SecurityMatch[]>;
  getQuote(security: SecurityRef): Promise<Quote>;
  getBars(request: BarsRequest): Promise<PriceBar[]>;
  getCorporateActions(request: ActionsRequest): Promise<CorporateAction[]>;
  getFxRate(base: string, quote: string, at: Date): Promise<FxRate>;
}
~~~

MVP policy:

- Use delayed or end-of-day data.
- Refresh held and watched symbols only.
- Cache according to provider terms.
- Show provider, delayed state, and last success.
- Keep stored records usable during provider outages.
- Review licensing, storage, attribution, and redistribution before production.

Add Plaid or another aggregator only after manual and CSV records reconcile. Future connections need encrypted server-side tokens, verified webhooks, cursor-based sync, idempotency, conflict review, and a disconnect path.

## 12. Security and privacy

- Keep the GitHub repo private.
- Use synthetic fixtures only.
- Ignore environment files, exports, CSVs, dumps, screenshots, and local vault settings.
- Enforce server-side validation and row-level authorization.
- Use secure HTTP-only same-site sessions and MFA in production.
- Keep secrets server-side.
- Rate-limit auth, imports, search, and providers.
- Add Content Security Policy and secure headers.
- Validate import type, size, encoding, and row count.
- Protect exports from CSV formula injection.
- Run dependency, code, and secret scans in CI.
- Maintain encrypted backups and test restoration.
- Provide export and permanent deletion.
- Redact financial content from logs and analytics.

Threat tests include cross-user access, token exposure, malicious imports, duplicates, stale prices, script injection, rate exhaustion, overlapping jobs, webhook replay, and financial values leaking through screenshots or errors.

Privacy mode masks balances, quantities, basis, gains, account identifiers, and transaction amounts. It is a display convenience, not a security boundary.

## 13. Delivery roadmap

| Phase | Deliverables | Exit gate |
|---|---|---|
| 0. Definition | Approved blueprint, MVP priorities, pattern review, wireframes, ADRs, issue board | Metrics have sources; scope is separated; no copied Saku material |
| 1. Foundation | App scaffold, strict typing, lint, tests, CI, auth, shell, demo mode, previews | README works; CI passes; routes are protected; no real data in Git |
| 2. Net worth | Account CRUD, balances, snapshots, cards, chart, privacy mode | Fixtures reconcile; history is dated; user isolation passes |
| 3. Transactions | Manual entry, categories, transfers, CSV preview, duplicates, reversal, cash flow | Repeat import creates no silent duplicates; reversal restores totals |
| 4. Portfolio | Securities, lots, prices, allocation, performance, asset detail | Holdings reconcile; calculation fixtures pass; freshness is visible |
| 5. Goals and insights | Watchlists, goals, pacing, attention center, explainable summaries | Insights drill to facts; no personalized advice claims |
| 6. Automation | Scheduled market, FX, actions, snapshots, job controls, optional sandbox aggregator | Replay is harmless; tokens stay private; outages do not corrupt records |
| 7. Hardening | Accessibility, security, performance, backup drill, monitoring, export/delete, launch plan | No critical issues; E2E passes; restore and rollback are verified |

### Chunk 1 delivered — 2026-09-24

Phase 1 was opened not with the app scaffold but with the two seams every later
phase rests on, plus a deliverable useful on its own. Shipped:

- `src/lib/holdings/` — reads the private Asset Tracking snapshot, classifies each
  row (equity / crypto / cash / options / managed) and groups lots into positions.
  `classify()` is ported verbatim from stock-trackers so the two projects cannot drift.
- `src/lib/market-data/` — the §11 provider interface, with a Twelve Data adapter
  implementing `getQuotes` and the rest throwing `NotImplemented`. Rate-limit
  chunking, per-symbol failure isolation, and the key scrubbed from error messages.
- `src/lib/notes/` — one Markdown note per holding plus a linked index, written to
  `out/market-updates/` and the Obsidian vault. Personal text below `## Notes`
  survives a rebuild; the History table gains one row per day; a symbol with no
  quote carries a visible warning rather than a stale number.
- A deny-by-default `.gitignore` (the repo had none), and 42 tests on synthetic
  fixtures.

Decisions in `docs/decisions/0001-chunk-1-holdings-and-market-notes.md`. Not built,
by design: cost basis, performance, news narrative, scaffold, database, auth.

## 14. Testing and operations

### Unit

- Net worth, account totals, cash flow, and transfer exclusion
- Decimal rounding and currency conversion
- Position quantity, FIFO lots, partial sales, dividends, fees, splits, and reversals
- Realized and unrealized gain
- Goal pacing and import fingerprints

### Integration

- Auth and cross-user deny paths
- Account and transaction CRUD
- Atomic import and reversal
- Database constraints and row security
- Provider validation, cache, and stale states
- Export and deletion

### End to end

1. Sign in and onboard.
2. Add asset and liability accounts.
3. Verify net worth.
4. Import CSV and resolve an invalid row.
5. Re-import without duplication.
6. Record a purchase and verify the holding.
7. Add a watchlist item and goal.
8. Enable privacy mode.
9. Export data.
10. Delete the account.

Test desktop, tablet, mobile, themes, empty/loading/populated/stale/error states, negative values, long names, dense tables, keyboard navigation, reduced motion, and 200 percent zoom.

Maintain hand-calculated fixtures. The normal cash reconciliation tolerance is $0.01 unless the currency uses another minor unit.

## 15. Git workflow

- Protect main after initial setup.
- Require pull requests and passing CI.
- Block force pushes.
- Enable dependency alerts and secret protection.
- Use small focused commits and synthetic fixtures.

Branch examples:

~~~text
codex/feature-account-creation
codex/feature-csv-import
codex/fix-cost-basis-rounding
codex/docs-security-model
~~~

Each pull request documents problem, scope, screenshots, calculation examples, tests, privacy impact, migration, rollback, and linked issue.

Milestones: M0 Blueprint, M1 Foundation, M2 Net Worth, M3 Transactions, M4 Portfolio, M5 Goals and Insights, M6 Automation, M7 Launch.

## 16. Existing stock-trackers relationship

The existing private stock-trackers project remains separate until a migration decision is approved.

Potential reuse after audit:

- Price adapter ideas
- Calculation and chart tests
- Dividend and calendar rules
- Privacy masking
- Obsidian import and export concepts
- Synthetic fixtures

Never copy real holdings, generated pages with personal values, private snapshots, API keys, secrets, or old authentication assumptions.

Migration sequence:

1. Inventory features and tests.
2. Decide which behaviors remain requirements.
3. Port one isolated domain module at a time.
4. Replace all values with synthetic fixtures.
5. Add equivalence tests.
6. Keep the old tracker until the new dashboard reconciles.
7. Archive or redirect only after explicit approval.

## 17. Obsidian operating model

Use Obsidian for product context, design notes, decisions, research, and weekly progress. Use GitHub issues for executable work and the repository docs for authoritative engineering documentation.

Suggested vault:

~~~text
Dashboard/
├── Personal Financial Dashboard Blueprint.md
├── 00 Dashboard Project Hub.md
├── 01 Product/
├── 02 Design/
├── 03 Engineering/
├── 04 Decisions/
└── 05 Delivery/
~~~

Sync rules:

- GitHub docs/BLUEPRINT.md is authoritative.
- This Obsidian note is the planning mirror.
- Update both in the same task.
- Put implementation work in GitHub issues, not only local checklists.
- Never store secrets, account numbers, balances, tokens, transaction exports, or raw provider data in Obsidian.

## 18. Risks

| Risk | Mitigation |
|---|---|
| Saku identity is copied too closely | Original brand, copy, assets, layout details, and design tokens |
| Financial totals are wrong | Canonical ledger, decimal math, drill-down, and hand-calculated fixtures |
| Duplicate imports | Provider IDs, file hashes, fingerprints, review, and reversal |
| Stale data looks live | Visible provider and freshness states |
| Secrets or data enter Git | Private repo, ignore rules, push protection, scanning, and review |
| Cross-user data exposure | Row security plus explicit allow and deny tests |
| Provider outage breaks the app | Cached reference data and access to stored records |
| Old and new trackers drift | Migration inventory and one authoritative roadmap |
| Scope grows too quickly | Phase exit gates and explicit later backlog |
| Insights are treated as advice | Show sources and calculations; educational framing only |

## 19. Definition of done

A feature is complete only when:

- Acceptance criteria pass.
- Authorization and validation are enforced.
- Empty, loading, populated, stale, and failure states exist.
- Desktop and mobile layouts are verified.
- Accessibility is checked.
- Financial math has fixtures and tests.
- Logs contain no financial content.
- Documentation is updated.
- CI passes.
- A reviewer can reproduce the result.
- No secrets, real financial data, or proprietary third-party content is committed.

## 20. Decisions before coding

- Product name and original brand direction
- Confirm the recommended stack through an ADR
- Auth, database, and hosting providers
- Market-data provider and usage rights
- Base currency
- Manual-only or manual plus CSV for the first milestone
- Whether liabilities and cash flow enter the first visual prototype
- Default cost-basis display method
- Whether stock-trackers is a migration source or stays separate
- Obsidian mirror cadence

## 21. Immediate next sequence

1. Approve or revise this blueprint.
2. Record the stack decision.
3. Add privacy and secret-safety baseline files.
4. Create desktop and mobile wireframes.
5. Build the shell with synthetic data.
6. Establish CI and preview deployment.
7. Implement accounts and snapshots.
8. Implement net worth.
9. Implement transactions and CSV import.
10. Implement portfolio math and market data.
11. Add goals, watchlists, and explainable insights.
12. Complete automation, hardening, and launch validation.

## Success outcome

The first production-ready release succeeds when Pierson can privately sign in, add assets and liabilities, import or enter transactions, see current and historical net worth, track holdings and cash flow, maintain watchlists and goals, understand the source and freshness of every critical value, export or delete personal data, and use the product comfortably on desktop and mobile.

The result should be as polished and scannable as a contemporary market-intelligence dashboard while remaining clearly original, private, auditable, and focused on personal financial health.
