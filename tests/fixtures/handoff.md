# SYNTHETIC HANDOFF — test fixture

Not real. Invented tickers and amounts only; see BLUEPRINT §12.

## Machine-readable snapshot

```json
{
  "months": [
    {
      "tab": "Early Testmonth",
      "month": "Testmonth",
      "year": 2099,
      "date": "2099-01-15",
      "holdings": [
        {"platform": "AlphaBroker", "label": "AAAA", "amount": 10, "unit": "Shares", "notes": ""},
        {"platform": "BetaBroker", "label": "AAAA", "amount": 2.5, "unit": "Shares", "notes": "second lot"},
        {"platform": "AlphaBroker", "label": "BBBB", "amount": 4, "unit": "Shares", "notes": ""},
        {"platform": "GammaWallet", "label": "ZZZ (crypto)", "amount": 1.25, "unit": "Units", "notes": ""},
        {"platform": "AlphaBroker", "label": "Cash", "amount": 100, "unit": "USD", "notes": ""},
        {"platform": "AlphaBroker", "label": "AAAA call Jan", "amount": 50, "unit": "USD", "notes": ""},
        {"platform": "AlphaBroker", "label": "Robo balance", "amount": 25, "unit": "USD", "notes": ""}
      ]
    },
    {
      "tab": "Older Testmonth",
      "month": "Older",
      "year": 2098,
      "date": "2098-12-01",
      "holdings": [
        {"platform": "AlphaBroker", "label": "AAAA", "amount": 8, "unit": "Shares", "notes": ""}
      ]
    }
  ]
}
```
