# Dashboard data contract

The browser prototype reads one deterministic object from `app/demo-data.js`.
Every record in that file is **fictional demo data**. It is a design and
interaction fixture, not an account statement, a live quote feed, or evidence
about the repository owner's finances.

## Scope and grain

| Collection | Grain | Required fields |
|---|---|---|
| `ranges` | one dated balance snapshot | `date`, `value`, `assets`, `liabilities` |
| `holdings` | one position in one account | symbol, quantity, synthetic price and value, weight |
| `accounts` | one account snapshot | name, type, signed balance, source label, timestamp |
| `activity` | one ledger row | date, label, category, signed amount, account |
| `goals` | one goal snapshot | current amount, target, due date, status |
| `watchlist` | one research symbol | synthetic price, change, sparkline, note |

Money is denominated in the currency named by `meta.currency`. Dates are ISO
calendar dates. Instants include a UTC offset. Missing evidence must remain
missing; it must not be converted to zero.

## Derived metrics

- `net worth = assets - liabilities`
- `monthly cash flow = income - spending`
- `savings rate = monthly cash flow / income`
- `portfolio weight = holding value / invested assets`
- `goal completion = current / target`, capped at 100% in the progress bar

The health score is an authored demo input. It is not a regulated score or
financial recommendation. Sparklines are synthetic display fixtures and must
not be described as observed market performance.

## Privacy boundary

The static UI must never import `private/`, `out/`, `.env*`, or the Obsidian
output directory. A future live-data milestone should expose a redacted local
API that performs calculations on the server and sends only the fields needed
by the active view. Provider keys and raw financial files must remain outside
the browser bundle.

## Readiness rules

Before replacing the fixture, validate that totals reconcile, timestamps and
sources are visible, stale and missing values are explicit, and all values can
be masked by privacy mode. The synthetic disclosure stays visible whenever any
demo row is present.
