import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { healthRepo } from '../repositories/healthRepo.js';
import { accountRepo } from '../repositories/accountRepo.js';
import { validate } from '../validation/accountSchema.js';
import { createCallSchema, updateCallSchema, createActionSchema, updateActionSchema } from '../validation/healthSchema.js';
import { HEALTH_SIGNALS, HEALTH_SENTIMENTS, ACTION_STATUSES, TIER_CADENCE_DAYS } from '../data/healthCadence.js';

const router = express.Router();
router.use(authenticateToken);

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
});
const settled = (res, r) => {
    if (r.notFound) return res.status(404).json({ error: 'Not found — or outside your access' }) || true;
    if (r.forbidden) return res.status(403).json({ error: 'You do not have access to this account' }) || true;
    return false;
};

router.get('/meta', wrap(async (req, res) => {
    res.json({ signals: HEALTH_SIGNALS, sentiments: HEALTH_SENTIMENTS, actionStatuses: ACTION_STATUSES, cadence: TIER_CADENCE_DAYS });
}));

router.get('/stats', wrap(async (req, res) => res.json(await healthRepo.stats(req.user))));

// The per-customer vendor-health board (tier cadence, next due, signal, actions).
router.get('/accounts', wrap(async (req, res) => res.json(await healthRepo.accountHealth(req.user))));

// The call log (optionally for one account).
router.get('/calls', wrap(async (req, res) => res.json(await healthRepo.listCalls(req.user, { account: req.query.account }))));

router.get('/calls/:id', wrap(async (req, res) => {
    const c = await healthRepo.getCall(Number(req.params.id), req.user);
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(c);
}));

router.post('/calls', wrap(async (req, res) => {
    const data = validate(createCallSchema, req.body);
    const r = await healthRepo.createCall(data, req.user);
    if (settled(res, r)) return;
    res.status(201).json(r.call);
}));

router.patch('/calls/:id', wrap(async (req, res) => {
    const data = validate(updateCallSchema, req.body);
    const r = await healthRepo.updateCall(Number(req.params.id), data, req.user);
    if (settled(res, r)) return;
    res.json(r.call);
}));

router.delete('/calls/:id', wrap(async (req, res) => {
    const r = await healthRepo.removeCall(Number(req.params.id), req.user);
    if (settled(res, r)) return;
    res.json(r);
}));

// ---- actionables ----
router.post('/calls/:id/actions', wrap(async (req, res) => {
    const data = validate(createActionSchema, req.body);
    const r = await healthRepo.addAction(Number(req.params.id), data, req.user);
    if (settled(res, r)) return;
    res.status(201).json(r.call);
}));
router.patch('/actions/:id', wrap(async (req, res) => {
    const data = validate(updateActionSchema, req.body);
    const r = await healthRepo.updateAction(Number(req.params.id), data, req.user);
    if (settled(res, r)) return;
    res.json(r.call);
}));
router.delete('/actions/:id', wrap(async (req, res) => {
    const r = await healthRepo.removeAction(Number(req.params.id), req.user);
    if (settled(res, r)) return;
    res.json(r.call);
}));

/** Seed a spread of sample calls across the caller's customers so the cadence,
 *  signals and carried actions have something to show. Admin only. */
router.post('/seed-sample', requireRole('admin'), wrap(async (req, res) => {
    const accounts = (await accountRepo.list(req.user)).filter((a) => a.segment === 'Customer');
    if (!accounts.length) return res.status(400).json({ error: 'No customer accounts to check.' });
    const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    const plan = [
        { signal: 'Green', sentiment: 'Positive', days: 20, summary: 'Strong adoption; expansion interest in Vendor Pulse. No blockers.', action: 'Share Vendor Pulse pricing' },
        { signal: 'Amber', sentiment: 'Neutral', days: 70, summary: 'Adoption plateaued; two integrations pending on their side. Champion still engaged.', action: 'Chase pending API credentials' },
        { signal: 'Red', sentiment: 'Negative', days: 130, summary: 'Executive sponsor left; usage down 40%. Renewal at risk without a save plan.', action: 'Build a save plan and schedule EBR' }
    ];
    let created = 0;
    for (let i = 0; i < accounts.length; i++) {
        const p = plan[i % plan.length];
        const call = await healthRepo.createCall({
            account: accounts[i].name, check_date: daysAgo(p.days), signal: p.signal, sentiment: p.sentiment,
            summary: p.summary, conducted_by: 'CS Team'
        }, req.user);
        if (call.call) { await healthRepo.addAction(call.call.id, { text: p.action, owner: 'CSM' }, req.user); created += 1; }
    }
    res.json({ seeded: created });
}));

export default router;
