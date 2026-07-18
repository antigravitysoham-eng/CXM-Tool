# Working methodology

How this codebase gets built, why it's built that way, and how to join in.
This is descriptive, not aspirational — it's what actually happened, including
the parts that went wrong.

---

## 1. The loop

Every change follows the same five steps. The order matters.

```
1. READ    the code that already exists — before writing any
2. BUILD   backend first: schema → validation → repository → routes
3. TEST    live HTTP against a running server, before any UI
4. VERIFY  in a real browser, on real data
5. COMMIT  one coherent change, message explains WHY
```

### 1. Read first

Nearly every serious bug in this project was found by reading code before
changing it, not by testing afterwards:

- Adding scope endpoints → found `PATCH /contracts/:id` checked nothing.
- Planning the agent relay → found `contractRepo.list({})` unscoped in 10 places.
- Auditing routes → found `/api/customers` bypassing ABAC entirely.

None of these had a ticket. They were found because the first step was reading.

### 2. Backend before UI

Schema → validation → repository → routes → *then* components. A module's
correctness lives in the repository; the UI is a view of it. Building the UI
first means discovering the data model through JSX, which is how you end up with
business rules in a component.

### 3. Test before UI, with real HTTP

Suites hit a running server over HTTP with real logins. Not mocked.

This ordering is deliberate: **the API is a product**, because the mobile app
will consume the same one. If it's only exercised through our own React code, it's
only correct for our own React code.

**Test the allowed path, not just the denied one.** The agent permission gate had
tests. They all passed. Every *permitted* agent chat was broken for days because
`wrap()` dropped `next` — and the tests only ever checked the 403.

### 4. Verify in a real browser

A passing test suite is not a working feature. Screenshots caught:

- Every checkbox rendering a stray `0` (`{0 && <Check/>}` renders the zero)
- Badges unreadable in light mode (dark-tuned colours on white)
- The agent dock sitting on top of the composer's send button
- A per-contract filter bar heavier than the 2 rows it filtered

**Verify what you measured, not what you assume.** Twice, the browser reported a
"broken" feature that was fine: a hidden tab freezes rAF and CSS animations, so a
warp animation looked dead and a canvas looked blank. Both were the environment.
Check `document.visibilityState` before believing a rendering bug.

### 5. Commit one change, explain why

The diff shows what changed. The message says why, what was rejected, and what
was found on the way. Commits here read like short design notes because in six
months the *why* is the only part that isn't recoverable from the code.

---

## 2. Principles the code actually follows

**Fail closed, loudly.**
`contractRepo.list(filters, user)` requires `user` and *throws* without it. An
optional scope is one a caller forgets, and forgetting it here hands over every
customer's contracts. This immediately paid: `customer-360` was unscoped and
surfaced as a 500 instead of a leak.

**Derive, don't store, anything that goes stale.**
Invoice "overdue" is computed from the due date on read. A stored flag is wrong
the morning after it's written and nobody notices until someone chases the wrong
customer. Same for stage status and onboarding status.

**One source of truth, or none.**
Where scope items are named, the count *is* the list length — a contradictory
number is ignored, not stored. `visibleAgents()` backs every surface that lists
agents so they can't disagree. `--rail` drives sidebar, top bar and content
width, because three hardcoded `280px` drifted.

**Catalogues are data, not code.**
Products and stages are definitions in `data/`. CLM renders its form from the
product catalogue; Onboarding builds its checklist from the same entries. Adding
a product is a data change.

**Never fake it.**
An unbuilt connector reports `implemented: false` and syncs nothing. It would be
easy to return plausible rows and demo well. The failed run is logged, because a
feed that quietly stopped is worse than one that visibly failed.

**Protect human work from automation.**
`localWins` lists fields a sync may never overwrite. Zoho owns the commercials;
the CSM's health rating is theirs. A nightly job silently reverting a colleague's
judgement is how people stop trusting a platform.

**Ask, don't assume, on business rules.**
Agent names are the user's call — every one was asked for. Where I *did* assume
(onboarding pace scaling with support tier) I was wrong, and it had to be undone.
Support tier governs ticket SLAs, not delivery speed. Guessing a domain rule
costs more than asking.

---

## 3. Layout

```
server/
  routes/         HTTP only: validate, call a repo, map to status codes
  repositories/   data access + ABAC scoping.  ← authorization lives HERE
  services/       logic with no HTTP knowledge (policy, storage, sync, NEO, PDF)
  validation/     zod schemas, one per resource
  data/           catalogues: products, onboarding stages
  agents/         registry + one brain per agent
  connectors/     external system definitions (+ drivers/)
  db.js           schema, migrations, indexes, seeds — in that order

src/
  pages/          one per module
  components/     reusable; the GPT view reuses these, so they stay presentational
  context/        auth, theme, view.  Split: constants in x.js, provider in xContext.jsx
  api/            one client per module; nothing else calls fetch()
```

**Where authorization lives:** repositories, not routes. A route can be forgotten;
a repository that refuses to run without a user cannot.

---

## 4. Adding things

**A module**
1. Table + indexes in `db.js` (see migration rule below)
2. zod schema in `validation/`
3. Repository taking `user`, scoping through `accountRepo.list(user)`
4. Routes: validate → repo → status codes
5. Mount on `v1` in `server.js`
6. Test suite: happy path, validation, **and ABAC both ways**
7. Then the page
8. Policy in `db.js` seeds if reps should see it
9. This document + `PRD.md`

**An agent**
1. **Ask the user for the name.** Non-negotiable — they're the user's naming.
2. Registry entry with `policy: '<module>'`
3. Brain in `agents/`, `respond()` + `missions()`
4. Wire into `contextFor`, the brain switch, `missionsForAgent`
5. Intent routing in `neoService.ROUTING` if NEO should hand off to it
6. Seed its module policy, or it's admin-only forever

**A connector**
1. Definition in `connectors/registry.js`: `fieldMap`, `identity`, `localWins`, `matchOn`
2. Driver: `pull(credentials, since) → rows`
3. Register in `syncService.DRIVERS`
4. Nothing else changes

**A migration**
`CREATE TABLE IF NOT EXISTS` is a **no-op on an existing table**. New columns
need `ensureColumn()`. This has bitten this project **twice** (`customers.type`,
`onboardings.support_tier`) — both times the feature worked on a fresh DB and
failed on a real one. Order in `db.js` is: create → ALTER → indexes → seed →
backfill. Backfill runs *after* seeds so fresh and migrated rows both get values.

---

## 5. Testing

```bash
cd server && node server.js          # suites need it running
node <suite>.mjs                     # live HTTP, real logins
```

Each suite: happy path → edge cases → validation → **ABAC as a non-admin**.

Rules learned the hard way:
- **Test the permitted path.** See §1.3.
- **Suites must be re-runnable.** The security suite's brute-force probe locked
  out the account the rest of it logs in with. It now uses a throwaway identity.
- **Clean up.** Tests that create data delete it.
- **A failing test might be the test.** "Discovery" isn't a stage here; ₹50L
  renders `50,00,000` in en-IN. Read the failure before changing the code.

**Now under Vitest.** `npm test` from the repo root boots the server on a
throwaway DB (`server/test/globalSetup.mjs`), seeds it, runs all six suites
serially, and tears it down. Hermetic — a teammate or CI gets the same result,
not one that depends on the dev database's state.

```bash
npm test              # all six suites, non-zero exit on failure
npm run test:watch    # (in server/) re-run on change
```

Adding a suite: drop `server/test/<name>.test.mjs` — one `describe` → one `it`
that runs its checks and asserts at the end. The global setup already gives it a
live, seeded server.

---

## 6. Conventions

- **Comments say why, never what.** `// increment i` is noise; `// per-IP would
  lock out an office behind one NAT` is the reason the code looks odd.
- **Money:** integer `amount` + `currency`. Never a formatted string in the DB.
- **Dates:** `YYYY-MM-DD` for dates, ISO for timestamps.
- **CSS:** tokens only. Never a hardcoded colour — it breaks a theme someone
  picks later. Veils (`--veil-1..4`) invert per theme.
- **`{cond && <X/>}` with a number:** SQLite returns 0/1 and React renders the
  `0`. Coerce.
- **No secret is ever returned to the browser**, redacted or not-at-all.

---

## 7. Environment

```bash
# once
cd server && cp .env.example .env    # set JWT_SECRET
npm install && (cd server && npm install)

# dev — two processes
cd server && node server.js          # :5000
npm run dev                          # :5174 (CORS_ORIGINS must list it)

# prod — one
docker build -t agcx . && docker run -p 5000:5000 -v agcx-data:/app/server/storage agcx
```

Every setting is in `server/.env.example` with a note on why it exists.
Defaults are safe: self-registration off, CORS same-origin, static serving on in
production.

**Note:** the dev tab accumulates hot-reloads and can wedge React fast-refresh —
a frozen page after ~20 HMR updates is the tab, not the code. Hard-reload.

---

## 8. Integrating later

**Claude as NEO's brain.** `interpret(prompt) → {intent, entities}` in
`neoService.js` is the seam. Swap the rules for a Claude call returning the same
shape; every handler stays untouched. **Data access must stay in the handlers** —
that's what stops a model widening what a user can see.

**Email.** `renewalService.buildTriggerEmails()` already produces both tones.
It needs a provider and a scheduler; nothing else.

**Postgres.** The repository layer is the seam. SQL is plain and portable; WAL and
`busy_timeout` are the only SQLite-isms.

**Mobile.** Pin `/api/v1`. Add refresh tokens first — 24h expiry means a daily
re-login on a phone.
