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

router.patch('/:id', wrap(async (req, res) => {
    const data = validate(updateAccountSchema, req.body);
    if (req.body.custom_fields) {
        const defs = await customFieldRepo.listDefs('accounts');
        data.custom_fields = customFieldRepo.coerceValues(defs, req.body.custom_fields);
    }
    const r = await accountRepo.update(Number(req.params.id), data, req.user);
    if (r.notFound) return res.status(404).json({ error: 'Not found' });
    if (r.forbidden) return res.status(403).json({ error: 'Insufficient permissions' });
    res.json(r.account);
}));

router.delete('/:id', wrap(async (req, res) => {
    const r = await accountRepo.remove(Number(req.params.id), req.user);
    if (r.notFound) return res.status(404).json({ error: 'Not found' });
    if (r.forbidden) return res.status(403).json({ error: 'Insufficient permissions' });
    res.json({ deleted: true });
}));

export default router;
