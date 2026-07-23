# Parked: AI executive dashboard

The version of the dashboard built around an explainable churn-risk model, an
anomaly feed and a generated NEO briefing. Parked here on request; the live
dashboard was rolled back to the previous C-suite version.

Committed as `6549b5e` — `git show 6549b5e` has the full diff and message.

## What it added

- **`server/riskModel.js`** — transparent weighted-signal churn scoring over
  health, product adoption, support pressure, survey sentiment, check-in
  cadence and renewal proximity. Weights sum to 100 so a score reads as a
  percentage of worst case, and every point traces to a named factor with a
  human-readable reason. Also carries the z-score anomaly detector.
- **`server/dashboardRepo.js`** — the aggregator extended with `briefing`,
  `sparks`, `signals` and `risk` on top of everything the current one returns.
- **`server/dashboard.test.mjs`** — the API contract test plus direct unit
  coverage of the model (saturation, monotonicity, the unknown-versus-zero
  distinction, the KPI/KRI direction rule).
- **`src/Dashboard.jsx` / `src/Dashboard.css`** — the page: NEO briefing hero,
  KPI bento tiles with six-month sparklines, churn-risk radar with per-customer
  score rings and factor breakdowns, systemic risk drivers, and a signals feed.

## Restoring it

From the repository root:

```bash
cp parked/ai-dashboard/server/riskModel.js server/data/riskModel.js && cp parked/ai-dashboard/server/dashboardRepo.js server/repositories/dashboardRepo.js && cp parked/ai-dashboard/server/dashboard.test.mjs server/test/dashboard.test.mjs && cp parked/ai-dashboard/src/Dashboard.jsx src/pages/Dashboard.jsx && cp parked/ai-dashboard/src/Dashboard.css src/pages/Dashboard.css
```

Or, equivalently, `git revert` whatever commit rolled it back.

Restart the backend afterwards — `dashboardRepo` is loaded at boot. The four
files are self-contained: no route, schema or migration changes are involved,
so nothing else needs touching.

## Note on the model

It is a rule-based weighted model, not a trained one. That was deliberate: the
factor breakdown is the point, because a score nobody can explain is a score
nobody acts on. If this is ever revived and you want a learned model instead,
the factor set here is a reasonable feature list to start from.
