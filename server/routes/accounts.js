import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { accountRepo } from '../repositories/accountRepo.js';
import { customFieldRepo } from '../repositories/customFieldRepo.js';
import { scopeRepo } from '../repositories/scopeRepo.js';
import { PRODUCTS } from '../data/products.js';
import {
    createAccountSchema, updateAccountSchema, validate,
    SEGMENTS, SOURCES, CURRENCIES, STAGES, HEALTHS, MEDDICC_PILLARS, REGIONS
} from '../validation/accountSchema.js';
import { config } from '../config.js';

const router = express.Router();
router.use(authenticateToken);

// Async wrapper: validation errors carry .status (400); anything else is a 500.
const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
});

// List — scoped to the caller's role.
router.get('/', wrap(async (req, res) => {
    res.json(await accountRepo.list(req.user));
}));

// Enums + FX rate for the UI (kept before /:id so "meta" isn't read as an id).
router.get('/meta', wrap(async (req, res) => {
    res.json({
        segments: SEGMENTS, sources: SOURCES, currencies: CURRENCIES,
        stages: STAGES, healths: HEALTHS, meddiccPillars: MEDDICC_PILLARS, regions: REGIONS,
        products: PRODUCTS,
        fxUsdInr: config.fxUsdInr, role: req.user.role
    });
}));

// Load the sample dataset (admin only).
router.post('/seed-sample', requireRole('admin'), wrap(async (req, res) => {
    res.json(await accountRepo.seedSample());
}));

// Backfill CLM contracts for won accounts that don't have one yet (admin only).
// Idempotent — skips any customer that already has a contract. Used to sync
// existing customers after auto-provisioning was enabled.
router.post('/sync-contracts', requireRole('admin'), wrap(async (req, res) => {
    const { backfillContractsForCustomers } = await import('../services/contractSyncService.js');
    const accounts = await accountRepo.list(req.user);
    const created = await backfillContractsForCustomers(accounts, req.user);
    res.json({ createdCount: created.length, created });
}));

// The product modules an account has opted for (account-level scope). Keyed by
// account name to match the contract scope; the two-segment path can't collide
// with GET /:id. Both gate on the account being in the caller's access.
router.get('/product-scope/:account', wrap(async (req, res) => {
    res.json(await scopeRepo.listAccountScope(req.user, req.params.account));
}));

router.put('/product-scope/:account', wrap(async (req, res) => {
    const r = await scopeRepo.setAccountScope(req.params.account, req.body?.products || [], req.user);
    if (r.forbidden) return res.status(403).json({ error: 'You do not have access to this account' });
    res.json(r.scope);
}));

router.post('/', wrap(async (req, res) => {
    const data = validate(createAccountSchema, req.body);
    const defs = await customFieldRepo.listDefs('accounts');
    data.custom_fields = customFieldRepo.coerceValues(defs, req.body.custom_fields || {});
    res.status(201).json(await accountRepo.create(data, req.user));
}));

router.get('/:id', wrap(async (req, res) => {
    const acc = await accountRepo.get(Number(req.params.id), req.user);
    if (!acc) return res.status(404).json({ error: 'Not found' });
    res.json(acc);
}));

// The stage trail behind an account's time-to-close — dates and days per stage.
router.get('/:id/stage-history', wrap(async (req, res) => {
    const r = await accountRepo.stageHistory(Number(req.params.id), req.user);
    if (r.notFound) return res.status(404).json({ error: 'Not found' });
    if (r.forbidden) return res.status(403).json({ error: 'Insufficient permissions' });
    res.json(r);
}));

router.patch('/:id', wrap(async (req, res) => {
    const data = validate(updateAccountSchema, req.body);
    if (req.body.custom_fields) {
        const defs = await customFieldRepo.listDefs('accounts');
        data.custom_fields = customFieldRepo.coerceValues(defs, req.body.custom_fields);
    }
    // A note about the stage being left (captured when advancing an account) rides
    // outside the validated schema and is logged as a discussion on that stage.
    const r = await accountRepo.update(Number(req.params.id), data, req.user, { stageNote: req.body.stage_note });
    if (r.notFound) return res.status(404).json({ error: 'Not found' });
    if (r.forbidden) return res.status(403).json({ error: 'Insufficient permissions' });
    res.json(r.account);
}));

// ---- partner account managers (PAMs) ----
router.get('/:id/managers', wrap(async (req, res) => {
    const r = await accountRepo.partnerManagers(Number(req.params.id), req.user);
    if (r.notFound) return res.status(404).json({ error: 'Not found' });
    if (r.forbidden) return res.status(403).json({ error: 'Insufficient permissions' });
    res.json(r.managers);
}));

router.put('/:id/managers', wrap(async (req, res) => {
    const r = await accountRepo.setPartnerManagers(Number(req.params.id), req.body?.managers, req.user);
    if (r.notFound) return res.status(404).json({ error: 'Not found' });
    if (r.forbidden) return res.status(403).json({ error: 'Insufficient permissions' });
    if (r.invalid) return res.status(400).json({ error: r.invalid });
    res.json(r.managers);
}));

// ---- per-stage discussion log ----
router.get('/:id/discussions', wrap(async (req, res) => {
    const r = await accountRepo.discussions(Number(req.params.id), req.user);
    if (r.notFound) return res.status(404).json({ error: 'Not found' });
    if (r.forbidden) return res.status(403).json({ error: 'Insufficient permissions' });
    res.json(r.discussions);
}));

router.post('/:id/discussions', wrap(async (req, res) => {
    const r = await accountRepo.addDiscussion(Number(req.params.id), { stage: req.body.stage, note: req.body.note }, req.user);
    if (r.notFound) return res.status(404).json({ error: 'Not found' });
    if (r.forbidden) return res.status(403).json({ error: 'Insufficient permissions' });
    if (r.invalid) return res.status(400).json({ error: r.invalid });
    res.status(201).json(r.discussion);
}));

router.delete('/discussions/:discId', wrap(async (req, res) => {
    const r = await accountRepo.removeDiscussion(Number(req.params.discId), req.user);
    if (r.notFound) return res.status(404).json({ error: 'Not found' });
    if (r.forbidden) return res.status(403).json({ error: 'Insufficient permissions' });
    res.json({ deleted: true });
}));

// What a delete would remove — for the confirmation dialog (admin-only).
router.get('/:id/delete-preview', requireRole('admin'), wrap(async (req, res) => {
    const r = await accountRepo.deletePreview(Number(req.params.id), req.user);
    if (r.notFound) return res.status(404).json({ error: 'Not found' });
    if (r.forbidden) return res.status(403).json({ error: 'Insufficient permissions' });
    res.json(r);
}));

// Delete an account and everything under it. Admin-only + irreversible.
router.delete('/:id', requireRole('admin'), wrap(async (req, res) => {
    const r = await accountRepo.remove(Number(req.params.id), req.user);
    if (r.notFound) return res.status(404).json({ error: 'Not found' });
    if (r.forbidden) return res.status(403).json({ error: 'Insufficient permissions' });
    res.json({ deleted: true, name: r.name, code: r.code });
}));

export default router;
