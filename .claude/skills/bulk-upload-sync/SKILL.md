---
name: bulk-upload-sync
description: Keep bulk-upload/export templates, validation enums, board/UI stage lists, and import handlers in sync whenever a module's fields, enums, or stages change in CXM-Tool. Apply this whenever touching accounts (Cash Horizon) or contracts (CLM) fields/stages/products, adding a module field or enum value, or building/reviewing a bulk-upload template.
---

# Bulk-upload / template sync invariant

CXM-Tool has one recurring class of bug: a module's **fields, enums, or stages** drift
between the places that must agree. When any of them changes, ALL of these must move
together — never edit one in isolation.

## The single source of truth
- **Stages / enums live in the validation schema** (`server/validation/*Schema.js`) and
  `server/data/*Kit.js`. Everything else derives from there.
- Account stages: `accountSchema.js` exports `PIPELINE_STAGES` (the board columns),
  `LIFECYCLE_STAGES` (won-customer stages, off the board), and `STAGES` = their union.
  There must be **no orphan stage** (a value in `STAGES` that no board column and no
  view ever shows — the old `'Closing'` was exactly that).

## When you change a module field / enum / stage, update every layer
1. **Validation schema enum** (`*Schema.js` / `*Kit.js`) — the source of truth.
2. **Bulk-upload template** = the module's `templateColumns()` / `exportData().columns`
   (`server/modules/*.js`). Every `select` field MUST carry `options:` = the current
   enum, so the generated `.xlsx` gets a dropdown + a Reference sheet
   (`services/excelService.js` renders these from `options`). Free-text columns for
   values that have an enum = a sync bug.
3. **Import handler** (`importData`) — must map the column back to the field, and handle
   fields that don't live on the record directly (e.g. account **Products** → set via
   `scopeRepo.setAccountScope` AFTER create, since the account schema strips it).
4. **Export row** (`toRow`) — round-trips the same columns, including derived ones
   (e.g. product scope fetched per account).
5. **Frontend UI lists** that hardcode the same values (`CashHorizon.jsx` has a local
   `STAGES` for the edit form and `PIPELINE_STAGES` for the board; `/accounts/meta`
   returns `stages`/`products`). Sync them, or better, read from `meta`.
6. **Tests** — grep the test suite for the old value before removing an enum member
   (e.g. a test PATCHing `stage: 'Closing'`).

## Which modules actually have bulk upload
Only **accounts** (`CashHorizon.jsx`) and **contracts** (`CLM.jsx`) expose the
`BulkUploadModal` and implement `importData`. The other modules export/template only.
The `/data/:module/import` route now 400s cleanly if a module lacks `importData`.

## Review checklist (run before finishing any field/enum/stage change)
- [ ] Enum changed in exactly one source-of-truth file; all readers import it.
- [ ] `templateColumns`/`exportData` `select` columns pass `options:` = that enum.
- [ ] `importData` maps the header → field (and handles off-record fields like Products).
- [ ] No orphan stage/enum value (every value shows somewhere in the UI).
- [ ] Frontend hardcoded lists (edit form, board) match — or read from `meta`.
- [ ] `grep` the tests for any removed enum value and update them.
- [ ] Download the template and confirm the dropdown + Reference sheet are correct.
