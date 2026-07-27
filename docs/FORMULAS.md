# CXM-Tool — Formulas & Metric Definitions

Every computed number in the platform, the exact formula, and why it's defined
that way. Verified against the code (`server/data/metricRegistry.js`, the
repositories, and `server/services/*`). Money is normalised to INR at the
configured FX (`config.fxUsdInr`, default ₹83/USD) before summing.

Legend: **Σ** = sum over the set · a *contract* is one agreement · an *account*
is one customer/prospect/partner.

---

## Cash Horizon (accounts & pipeline)
| Metric | Formula | Justification |
|---|---|---|
| Customer portfolio | Σ value of accounts where `segment = Customer` | Book value under management — only won logos. |
| Open pipeline | Σ value of accounts where `segment = Prospect` and `stage ≠ Lost` | Live deals only; a lost deal isn't pipeline. |
| Weighted forecast | Σ (prospect value × `probability` ÷ 100), open deals | Probability-adjusted expected revenue — the commit number. |
| Win rate | Closed ÷ (Closed + Lost) × 100 over prospect stages | Of decided deals, the share won. Excludes still-open deals so it isn't diluted. |
| Avg MEDDICC | mean of filled MEDDICC pillars per prospect, out of 7 | Deal-qualification strength; each captured pillar = 1 point. |
| MEDDICC score | count of non-empty pillars ÷ 7 | 7 pillars (Metrics, Economic buyer, Decision criteria, Decision process, Identified pain, Champion, Competition). |
| Days in stage | (today − `stage_entered_at`) in days | Time the deal has sat in its current stage; the clock resets only on a real stage change. |
| Time to close | `entered_at('Closed')` − first stage event, in days | Full sales cycle, measured from the trail so it's exact even after a won deal moves to Live. |
| Deal age (open) | (today − first stage event) in days | How long an open deal has been in play. |

## CLM (contracts, renewals, churn)
| Metric | Formula | Justification |
|---|---|---|
| Value under management | Σ `tcv` (→INR) of contracts where `status ∉ {Expired, Churned, Cancelled, Terminated}` | Live contract value only; churned value is tracked separately. |
| Revenue at risk | Σ value of customers whose next renewal is in 0–90 days | Value that needs a renewal touch in the quarter. |
| Renewals due | count of customers renewing in 0–90 days | Workload of upcoming renewals. |
| Auto-renew | count of customers with any `auto_renew` contract | Low-touch renewals. |
| Churned value | Σ `tcv` (→INR) of contracts in a terminal status | Revenue lost to non-renewal/cancellation. |
| **Revenue churn %** | churned value ÷ (live value + churned value) × 100 | Share of all-time contract value that has churned. Denominator is live+churned so it reads as a true rate. |
| Churned accounts | count of customers with churned value **and** zero live value | A fully-lost logo (distinct from a mixed live+churned account). |
| Days to renewal | (`renewal_date` − today) in days | Drives the renewal window buckets. |
| Renewal bucket | ≤0 overdue · ≤30 critical · ≤60 warning · ≤90 watch · else healthy | Standard renewal-risk banding. |
| Time to value | value-stage completion − kickoff, in days | Onboarding effectiveness — how fast the customer reached first value. |
| Time to onboard | go-live − kickoff, in days | Total implementation duration. |

## Support (SLA) — aligned to the Zeron Support Guide
Vocabulary: **Type** {Question, Incident, Task} · **Priority** {Urgent, High, Medium, Low} · **Status** {Analysis in Progress, Customer Pending, Dev Pending, Feature Request, Solution Delivered, Solution Accepted} · **Resolution** {Documentation, Network Connectivity, Bug Fix, Enhancement} · **Channel** {Zoho, Support Email, Call}.

| Metric | Formula | Justification |
|---|---|---|
| Open tickets | count where `status ∉ {Solution Delivered, Solution Accepted}` | Live desk load — anything the solution hasn't landed on yet. |
| First response ≤ 1h (KPI) | first-answered within 1h ÷ all answered × 100 | The guide's flat promise: a first technical response within one hour, whatever the tier. |
| SLA breaches (KRI) | count flagged breached by the tier×priority SLA matrix | Response/resolution past the promised time; derived at read-time (never stored) so it's correct the morning after it lapses. Customer/Dev Pending & Feature Request **pause** the resolution clock (ball is out of the desk's court). |
| At risk | count of open tickets flagged `at_risk` (past 75% of the resolution window) | Catch before breach. |
| SLA attainment % | resolved-and-not-breached ÷ all resolved × 100 | The kept-promise rate. |
| Stale / 3-strike (KRI) | count of open tickets where `now − updated_at > 2 days` | The guide's alternate-day follow-up rule — flags tickets that have gone quiet. |
| Open bugs (KRI) | count of open tickets where `type = Incident` OR `resolution = Bug Fix` | The CTO-escalation path; these are auto-forwarded to the CTO's Telegram on creation. |

Every ticket carries a **sequential reference** `TIC-####` (from its row id — unique and incremental); feature requests carry `FR-####`. Both are retrievable over WhatsApp ("show me TIC-0157") and can be forwarded to the CTO's Telegram ("send TIC-0157 to the CTO").

## Health Checks (Pulse)
| Metric | Formula | Justification |
|---|---|---|
| Cadence (days) | Enterprise 30 · Premium 60 · Standard 120 (by support tier) | Higher tiers get more frequent check-ins. |
| Next due | last `check_date` + cadence (or an explicit `next_call_date` if set) | Overdue when next due < today. |
| Signal score (0–100) | mean of {Green 100, Amber 55, Red 15, Unknown 70} across a CSM's customers | The CSM Performance headline; blends the portfolio's health signals. |
| Trend | sign(prev signal − current signal), using {Green 0, Amber 1, Red 2} | >0 improving, <0 worsening — lower is healthier on that scale. |

## Training (enablement)
| Metric | Formula | Justification |
|---|---|---|
| Completion rate % | Σ completed ÷ Σ enrolled × 100 | Enablement effectiveness across sessions. |
| Certification rate % | Σ certified ÷ Σ enrolled × 100 | Depth of enablement. |
| Stalled session | enrolled > 0 and completed = 0 and the date has passed | Sessions that never landed. |

## Surveys (VoC)
| Metric | Formula | Justification |
|---|---|---|
| NPS (per campaign) | % promoters − % detractors | Standard Net Promoter Score. |
| CSAT % | satisfied ÷ responses × 100 | Standard satisfaction. |
| Detractors | count of responses with `sentiment = Negative` | Close-the-loop list. |

## Feature Requests (Forge)
| Metric | Formula | Justification |
|---|---|---|
| Demand | 1 + backing accounts + votes | The raiser counts as 1; supporters and votes add pull. |
| **RICE** | round((reach × impact_weight ÷ effort_weight) × 10) ÷ 10, where reach = supporters + votes + 1 | Prioritises by real customer pull ÷ cost; impact/effort are weighted enums. |
| Shipped rate % | shipped ÷ total × 100 | Delivery throughput. |

## Upsells (Rainmaker)
| Metric | Formula | Justification |
|---|---|---|
| Open pipeline | Σ value of deals where `stage ∉ {Won, Lost}` | Live expansion value. |
| Weighted forecast | Σ (value × stage probability ÷ 100), open deals | Probability tracks the stage unless a rep overrides it. |
| Win rate | Won ÷ (Won + Lost) × 100 | Of closed expansion deals, the share won. |

## Referrals (Magnet)
| Metric | Formula | Justification |
|---|---|---|
| Conversion % | converted ÷ (converted + declined) × 100 | Advocacy pipeline efficiency (open leads excluded from the rate). |
| Referred value | Σ value of leads not `Declined` | Pipeline sourced by advocates. |

## EBRs / Comms / Events
| Metric | Formula | Justification |
|---|---|---|
| EBR coverage | shared this quarter ÷ customers × 100 | Exec-review reach. |
| Comms open/click rate | opens ÷ recipients × 100 (and clicks ÷ recipients) | Engagement of sent campaigns. |
| Event attendance % | attended ÷ registered × 100 | Turnout of completed events. |

## Invoices (AR)
| Metric | Formula | Justification |
|---|---|---|
| Outstanding | Σ amount where `status ∉ {Paid, Cancelled}` | Receivables still owed. |
| Overdue | Σ amount of unpaid invoices where `due_date < today` | Derived, not stored, so ageing is always current. |
| Ageing buckets | days overdue → 1–30 / 31–60 / 61–90 / 90+ | Standard AR ageing. |

## Account-Manager & Partner Performance
| Metric | Formula | Justification |
|---|---|---|
| Portfolio (AM) | Σ customer value grouped by `sales_owner` | Book value each AM manages. |
| Partner win rate | won accounts ÷ sourced accounts × 100 | Quality of a partner's introductions. |
| Partner closed value | Σ value of `Customer` accounts sourced by the partner | Revenue attributable to the partner. |

---

### Notes on correctness
- All money is converted to a single currency (INR) **before** summing, so mixed-currency books don't mis-add.
- SLA breach, invoice overdue, days-in-stage, days-to-renewal and health "next due" are **derived at read time** from timestamps — never stored — so they can't go stale.
- Rates use denominators that make them true rates (e.g. win rate over *decided* deals, revenue churn over *all-time* value), not vanity ratios.
- The in-app metric drill-downs (`GET /metrics/:key/explain`) surface these same formulas from `metricRegistry.js`, so what the UI explains matches what the code computes.
