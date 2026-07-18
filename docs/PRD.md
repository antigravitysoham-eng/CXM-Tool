# AGCX — Product & Technical Reference

The CX platform: what each module does, how it's built, and what it depends on.
Written for developers joining the codebase. Kept next to the code so it goes
stale visibly rather than quietly.

**Status key:** ✅ built & tested · 🟡 partial · ⬜ placeholder (UI shell only)

---

## 1. What this is

An AI-native CX platform for a security/compliance vendor (Zeron) selling to
regulated customers. It follows one customer from first contact to value:

```
Cash Horizon → CLM → Onboarding → (Support, Training, EBRs, …)
   prospect     contract   delivery        steady state
```

Two ways to use it, over the same data and the same components:

- **Dashboard** — modules, tables, filters.
- **GPT view** — ask NEO; get the same KPI cards and charts back inline, plus
  prompt-driven data entry.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────┐
│ React 19 SPA (Vite)                                      │
│  pages/ · components/ · context/ · api/                  │
└───────────────┬──────────────────────────────────────────┘
                │  REST + JWT  (/api/v1)
┌───────────────▼──────────────────────────────────────────┐
│ Express                                                  │
│  routes/       HTTP, validation, status codes            │
│  services/     logic (policy, sync, storage, NEO, PDF)   │
│  repositories/ data access + ABAC scoping   ← enforced   │
│  validation/   zod schemas                     here      │
│  data/         catalogues (products, stages)             │
│  agents/       NEO + specialists                         │
│  connectors/   external systems                          │
└───────────────┬──────────────────────────────────────────┘
                │
          SQLite (WAL) + local/db blob storage
```

**Layering rule:** routes never touch the DB; repositories always take `user` and
scope to it. The rule exists because it was broken — see §7.

### Stack

| Layer | Choice | Why |
|---|---|---|
| UI | React 19, Vite 7, react-router 7 | Fast build, no framework lock-in |
| Charts | Recharts | Same components in dashboard and GPT view |
| Icons | lucide-react | Tree-shakeable |
| Styling | CSS custom properties, no framework | Theming by token swap; no Tailwind build step |
| API | Express 4 | Small, boring, well-understood |
| DB | SQLite (`sqlite3` v6) + WAL | One file, no server to run — see §8 |
| Auth | JWT (jsonwebtoken) + bcrypt | Stateless: same token works for the mobile app |
| Validation | zod | One schema per resource, at the route edge |
| Files | exceljs, pdfkit | Export/report generation server-side |
| Security | helmet, express-rate-limit, cors allowlist | §7 |

**Deliberately absent:** no Redux (context is enough), no ORM (SQL is legible),
no Tailwind, no server-side rendering, no message queue. Each would add build or
ops weight for a platform whose whole point is being cheap to host.

---

## 3. Modules

### Cash Horizon (Directory) ✅
The account book: customers, prospects, partners.

- Segments (Customer/Prospect/Partner), Direct/Partner source with sourcing partner
- MEDDICC (7 pillars) with computed qualification score
- Money as `amount` + `currency` (never a display string), INR/$ toggle at FX 83
- Global region: APAC/EMEA/AMER/ANZ/LATAM/MEA/India — the same field ABAC scopes on
- Sales owner, CXM, health, next step + date
- Custom columns (UI or Excel), bulk import with a validated template, Excel export, AI-summarised PDF
- **Agent:** Aukat 💰 · **Files:** `routes/accounts.js`, `repositories/accountRepo.js`, `modules/accountsModule.js`

### CLM ✅
Contract lifecycle for active customers. Flows in from Cash Horizon on Customer tagging.

- Deployment (SaaS/On-prem), licence type, perpetual term, billing frequency, payment terms, support tier
- Renewal engine: 90/60/30 milestones, notice deadlines, dual-tone trigger emails (warm to the customer SPOC, direct to CSM/AM) — **generated, not sent** 🟡
- CSM assignment advice: industry 40 / tier 20 / success 25 / bandwidth ±15 — **advisory; the CX lead decides**
- Customer 360: contracts, SPOCs, documents, invoices, scope
- **Product scope** (§4) and **invoice tracker** (§5)
- **Agent:** AURA 🔮 · **Files:** `routes/contracts.js`, `repositories/contractRepo.js`, `services/renewalService.js`, `services/assignmentService.js`

### Documents (DMS) ✅
Account-level library; contracts are one category of many.

- 22 types across 6 categories; real upload (drag-drop) **or** external link
- Versioning by supersession: v1→v2 hides the old row, keeps the chain for audit
- Storage behind a driver interface: `local` (filesystem) or `db` (SQLite blobs), `STORAGE_DRIVER` picks
- Keys are random, never derived from the filename; reads re-check the resolved path
- **Agent:** DOXY 🗂️ · **Files:** `routes/documents.js`, `repositories/documentRepo.js`, `services/storageService.js`

### Onboarding ✅
Kickoff to live to first value, in six time-bound stages.

| # | Stage | Default day | Notes |
|---|---|---|---|
| 1 | Kickoff call | 7 | Stakeholders + onboarding deck |
| 2 | SaaS instance handover | 14 | **Generated from the CLM scope** |
| 3 | Integrations & deliverables | 30 | Zeron / Customer / Joint, to enablement sign-off |
| 4 | Training | 45 | |
| 5 | Support portal handover | 60 | Delivery ends here → **Live** |
| 6 | First value realised | 75 | First use case achieved → **value** |

- Entry: CLM "Proceed to onboard", **requires a named CSM** (400 without one)
- Plan = default stretched by scope (>5 items, +1 day each, capped 30); the lead's agreed plan overrides and is stored
- **Not driven by support tier** — that governs ticket SLAs once live, which is Support's concern
- Status is derived: all tasks ticked → stage Done; all *delivery* stages Done → Live. A human's "Blocked" wins.
- **Two metrics, deliberately independent:**
  - *Time to onboard* — kickoff → live
  - *Time to value* — kickoff → first use case achieved
  - If Live required stage 6 they'd be the same number and one would be pointless. `liveWithoutValue` counts the gap: provisioned, trained, handed over — and still not doing the thing they bought it for.
- **Board:** a kanban of the delivery stages (1–5) + a terminal **Live** column;
  each customer is a card in its current stage, **drag to move**. A move sets the
  stages (prior → Done with tasks ticked, target → In progress, later → Pending
  with tasks cleared) so the stage and its checklist always agree; past the last
  delivery stage → syncStatus takes it Live. Every move, status change and start
  is written to `onboarding_activity` and shown as a per-customer log + a board
  activity feed. Endpoints: `PATCH /onboarding/:id/move {stage}`,
  `GET /onboarding/:id/activity`, `GET /onboarding/activity`.
- **Bug fixed here:** `onboardingRepo.list` destructured the `account` filter but
  never applied it, so `findByAccount` (CLM's "already onboarding?" check)
  returned the newest onboarding regardless of account. Invisible with one
  onboarding, wrong with two — now filtered, with a regression check.
- **Agent:** Pilot 🚀 · **Files:** `routes/onboarding.js`, `repositories/onboardingRepo.js`, `data/onboardingStages.js`

### Support ✅
The support tier's actual job: every ticket held to an SLA set by the account's
tier × the ticket's priority.

- **SLA is the model.** `data/supportSla.js` is the single matrix — tier
  (Standard/Premium/Enterprise) × priority (Urgent/High/Normal/Low) → response +
  resolution hours. Everything else (breach, at-risk, attainment) is **derived**
  from it at read time, never stored — the same rule as invoice "overdue".
- The tier is **snapshotted onto the ticket** at creation (from the contract, else
  the account's latest contract, else Standard), so the promise measured is the
  one in force when it was raised.
- **Response clock** runs to first response; **resolution clock** runs to close —
  and **`Waiting on Customer` pauses** the resolution clock (not ours to move).
- Milestones are stamped, not typed: leaving *Open* stamps the first response;
  moving to *Resolved/Closed* stamps resolution; reopening clears it.
- Account-scoped through `accountRepo.list(user)`, so a rep sees only tickets on
  accounts they own — ABAC unchanged.
- **Agent:** Medic 🚑 (read: `listTickets`, `ticketStats`) · **Files:**
  `routes/support.js`, `repositories/supportRepo.js`, `data/supportSla.js`,
  `validation/supportSchema.js`, `agents/medicBrain.js`

### Training ✅
Customer enablement: the learner funnel from enrolled → completed → certified,
per training session per account.

- **The funnel is the model.** Sessions store enrolled/completed/certified;
  completion rate, certification rate, the *stalled* flag and each account's
  enablement health are **derived** at read time.
- **Clamped, always.** completed ≤ enrolled and certified ≤ completed, enforced on
  create *and* on partial update (a shrink re-clamps down) — an impossible funnel
  is a data bug, not a state.
- **Under-enabled accounts** (≥5 enrolled, <50% complete) are surfaced — the
  enablement gap that feeds churn and, per this module's own insight, support load.
- Account-scoped through `accountRepo.list(user)` — ABAC unchanged.
- **Agent:** Sensei 🥋 (read: `listTraining`, `trainingStats`) · **Files:**
  `routes/training.js`, `repositories/trainingRepo.js`,
  `validation/trainingSchema.js`, `agents/senseiBrain.js`
- **Gotcha fixed here:** zod's `.partial()` keeps `.default()`, so an update schema
  built as `z.object(base).partial()` silently resets every unspecified field to
  its default on a PATCH. Update schemas now omit defaults (fixed in both Training
  and Support). Worth auditing the older modules for the same pattern.

### Access & Users ✅
ABAC, with RBAC as its default policy set.

- Policies: role × module × actions × effect × condition (`all`/`own`/`region`/`team`/`segment`), deny-overrides
- Defaults seeded **by name if missing**, so a new module's policy reaches existing databases; edited policies are never overwritten
- **Files:** `routes/users.js`, `services/policyService.js`

### GPT view + Agent HQ ✅
- NEO answers from the same repositories the dashboard uses, always ABAC-scoped
- Answers are **render blocks** (stats/chart/table) drawn with the dashboard's own components — the numbers cannot drift
- Intent → agent routing is real (the named specialist owns the handler that ran); only the pacing is presentational
- Data entry: proposal → user confirms → write, **permission re-checked at execute** (the proposal round-trips through the client)
- **Seam:** `interpret(prompt) → {intent, entities}` is the only piece an LLM replaces. Data access stays ours, so a model can't widen what a user may see.

### Placeholders ⬜
Training, Health Checks, EBRs, Surveys, Journey, Support, Feature Requests,
Upsells, Comms, Events, Referrals — UI shells on demo data. Their agents are
offline. **Support** owns ticket SLAs by tier.

---

## 4. Product scope (CLM → Onboarding)

The catalogue is one definition (`data/products.js`); CLM renders its form from
it and Onboarding builds its checklist from it.

| Product | Unit | Named items? |
|---|---|---|
| Interno | Security tool integrations | yes |
| Conformity | Frameworks | yes |
| Vendor Pulse | Vendors | **no** — a count |
| ZAK - Services | Services | yes |
| Agentctl | AI agents to govern | yes (sources) |
| Certifications | Certifications | yes |
| Others | Units | yes + a description of the unit |

Two decisions worth keeping:

- **Where items are named, the count IS the list length.** Two sources of truth for
  "how many frameworks" is one too many, so a contradictory number is ignored.
- **Stored as rows, not JSON on the contract.** That's what makes "every framework
  on this account" a query, and Stage 2 a generation rather than a parse.

`buildStageTwoTasks()` turns scope into tasks: `per-item` → one task each,
`per-unit` → one task carrying the number. Sold-but-unscoped becomes "confirm
scope with the account team" rather than being skipped.

---

## 5. Invoices

Raise/chase/settle per customer: billing period, due date, ageing (1-30/31-60/61-90/90+).

**Overdue is derived on read, never stored.** A stored flag is wrong the morning
after it's written and nobody notices until someone chases the wrong customer.
Marking Paid auto-stamps the date rather than leaving ageing to guess.

---

## 6. Connectors (structure built, drivers pending 🟡)

Declared ahead of the integrations so modules never change when one lands.

| Connector | Feeds | Identity | Status |
|---|---|---|---|
| Zoho CRM | Closed-won deals → Cash Horizon accounts | `external_id` | configured=false, implemented=false |
| Leegality | Signed agreements → document library | `external_id` | configured=false, implemented=false |

A connector supplies **`pull(credentials, since)`** and nothing else. Provenance,
upserting, run logging and access are handled once in `services/syncService.js`.

- **Provenance:** every syncable record carries `source_system` / `external_id` /
  `synced_at`, so a synced row is distinguishable from a typed one and re-syncing
  updates rather than duplicates.
- **`localWins`:** fields a sync must never overwrite. Zoho owns the commercials;
  the CSM's health rating and next step are ours. A nightly job silently
  reverting them would make the platform untrustworthy.
- **`matchOn` + quarantine:** Leegality sends a party *name*, not an account id.
  Unmatched documents are parked, not guessed — filing a signed agreement against
  the wrong customer is worse than not filing it.
- **Honesty:** no credentials or no driver → `configured: false` /
  `implemented: false`, syncs nothing, and the failed run is still logged. A feed
  that quietly stopped is worse than one that visibly failed.

**To add a driver:** write `pull()` → register it in `DRIVERS` → done.

---

## 7. Security

Findings from the audit, all fixed and regression-tested (`sec-test`, 42 checks):

| Was | Now |
|---|---|
| `GET /api/customers` read the table directly — a rep saw **5** accounts via `/accounts` and **all 14** here | Removed (dead code that silently undid ABAC) |
| Contracts had **no scoping at all** — 10 call sites, incl. Excel export and PDF report | Scoped in the repository; `user` is **required**, not optional — it throws rather than leaks |
| `PATCH`/`DELETE /contracts/:id` checked nothing — a rep could edit a contract they couldn't read | Same gate on read and write |
| `customer-360/:account` unscoped — the whole customer file one URL away | Scoped |
| Self-registration open — anyone reaching the host could mint an admin-adjacent account | Off unless `ALLOW_SELF_REGISTRATION` |
| `/connectivity/credentials` returned `client_id` + `refresh_token` to any user | Admin-only, redacted |
| `cors()` wide open | Allowlist; empty = same-origin |
| No rate limiting | Per-account (email+IP) **and** per-IP, IPv6-safe |

**Why per-account:** a naive per-IP login limit locks out a whole office behind
one NAT gateway when one colleague mistypes their password. It did exactly that
to the test suite.

Also: helmet, JSON 404s on unknown `/api` paths, no stack traces in responses,
production refuses to boot on a short `JWT_SECRET`, dependencies 16 → 4
vulnerabilities (incl. a live ReDoS in Express's path matching).

**The lesson worth keeping:** the agent permission gate looked tested — but only
the *denied* path was. `wrap()` dropped `next`, so every *permitted* agent chat
was broken and the suite stayed green. **Test the allowed path too.**

---

## 8. Scale & hosting

- **Indexes:** there were none. Every login scanned `users`; every scoped read
  scanned `customers` end to end — invisible at 14 rows, quadratic at real size.
  20 indexes; all hot paths now `SEARCH ... USING INDEX`.
- **SQLite** in WAL with a busy timeout. Right until concurrent writers or >~100k
  rows; the repository layer is the seam to swap it behind.
- **Docker:** multi-stage, non-root, healthcheck, volume. The API serves the built
  SPA — one container, one port.
- `DB_PATH` is absolute (it was relative, so a container put the DB outside the
  volume and lost it on restart).

## 9. Mobile

The API is REST + stateless JWT and versioned at **`/api/v1`** (same router as
`/api`, so they can't drift). An Android/iOS client is a consumer, not a rewrite.

- Pin `/api/v1`. Auth: `POST /api/v1/auth/login` → bearer token.
- CORS doesn't apply to native clients (no `Origin` header).
- Not yet: refresh tokens (24h expiry, re-login), push, offline sync.

---

## 10. Testing

174 checks across six suites, all live HTTP against a running server. Under
**Vitest** — `npm test` from the repo root (or `server/`).

```bash
npm test          # runs all six suites, exits non-zero on any failure
```

The harness (`server/test/globalSetup.mjs`) boots the real server on a throwaway
SQLite file, seeds the sample data, runs every suite serially against it, then
tears it down. A fresh DB per run makes it **hermetic** — it works on a
teammate's machine and in CI, not just against whatever state was left in the dev
database.

| Suite | Checks | Covers |
|---|---|---|
| `security` | 42 | Scoping, agent permissions, anonymous, privilege, forged JWTs, headers, rate limits |
| `onboarding` | 45 | Stages, scope→checklist, timelines, both metrics, ABAC |
| `onboarding-board` | 17 | Stage moves, task sync, activity log, go-live, by-account scoping, ABAC |
| `support` | 22 | SLA by tier×priority, breach/at-risk, pause, milestones, no-default-reset, ABAC, Medic |
| `training` | 18 | Funnel, rates, clamping (create+shrink), stalled, ABAC, Sensei agent |
| `neo` | 27 | Intent routing, answers, data entry, ABAC |
| `clm` | 24 | Products, scope, invoices, ageing, ABAC |
| `dms` | 18 | Upload, versions, both storage drivers, ABAC |
| `connectors` | 18 | Field mapping, `localWins`, provenance, quarantine, access |

Each suite is one Vitest test that runs its checks in order and fails with the
name of the first check that broke. (Splitting into per-assertion `it()`s is a
later refinement; the automation and CI-gating are what mattered.)

---

## 11. Open items

1. ~~**Vitest**~~ ✅ done — `npm test`, hermetic, 174 checks
2. **Agent access layer** — bring-your-own-agent: delegated scoped keys, capability
   manifest, single-session lease (anti-swarm), separate audit, read + approval-queue
   writes. In progress; see §12.
3. **Email provider** — renewal triggers generate both emails but can't send
4. **Zoho + Leegality drivers** — sockets cut, need credentials
5. ~~**Support module**~~ ✅ done — ticket SLAs by tier × priority, Medic online
6. Remaining placeholder modules + their agents — **Training ✅ (Sensei online)**;
   still to do: Health Checks, EBRs, Surveys, Journey, Feature Requests, Upsells,
   Comms, Events, Referrals
7. Refresh tokens before the mobile app ships

## 12. Agent access layer (in progress)

Letting a user's *own* agent (Claude, GPT, Hermes, …) drive the platform, bounded
by the same ABAC and a hard security spine.

- **Delegation:** an agent acts *as* a user, with authority ≤ that user's. Three
  gates on every call — key valid, agent ceiling, live ABAC scope — deny wins.
- **Writes:** read by default; writes are *proposed* into a human-approval queue
  (the NEO confirm-card, async), never straight to the book.
- **Capability manifest:** the "agentic file" — OpenAPI + MCP + OpenAI tool schema
  + skill card, generated from the agent's permitted actions. We provide it; the
  user loads it into their agent.
- **Single-session lease (anti-swarm):** one active session per (user, agent
  identity). Minting five keys for "NEO-as-Soham" still yields one live NEO;
  the rest get `409 already active`. Heartbeat + TTL so a crash auto-releases.
- **Agent audit:** a separate trail from human actions.
