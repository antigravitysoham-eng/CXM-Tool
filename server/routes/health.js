import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { healthRepo } from '../repositories/healthRepo.js';
import { accountRepo } from '../repositories/accountRepo.js';
import { validate } from '../validation/accountSchema.js';
import { createCallSchema, updateCallSchema, createActionSchema, updateActionSchema } from '../validation/healthSchema.js';
import { HEALTH_SIGNALS, HEALTH_SENTIMENTS, ACTION_STATUSES, TIER_CADENCE_DAYS } from '../data/healthCadence.js';
import { buildPrecallBrief } from '../services/precallBriefService.js';

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

// Accounts with a scheduled call within N days (default: by tomorrow) — the
// "briefs due" surfacing so a CSM preps the day before.
router.get('/briefs-due', wrap(async (req, res) => {
    const within = Math.max(0, Math.min(14, Number(req.query.within) || 1));
    res.json(await healthRepo.briefsDue(req.user, { within }));
}));

// The pre-call brief for one customer, as a PDF.
router.get('/accounts/:account/precall-brief.pdf', wrap(async (req, res) => {
    const { buffer, filename } = await buildPrecallBrief(req.params.account, req.user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
}));

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
    // Each customer gets a short history (older -> recent) so trend + carry-forward
    // are visible. The recent signal is what shows on the board.
    const arcs = [
        [ // improving
            { signal: 'Amber', sentiment: 'Neutral', days: 95, summary: 'Adoption slow to start; champion engaged but blocked on IT.', action: 'Unblock SSO setup' },
            { signal: 'Green', sentiment: 'Positive', days: 25, summary: 'Turned the corner — usage climbing, expansion interest in Vendor Pulse.', action: 'Share Vendor Pulse pricing' }
        ],
        [ // steady green
            { signal: 'Green', sentiment: 'Positive', days: 80, summary: 'Healthy adoption across teams.', action: 'Line up a case study' },
            { signal: 'Green', sentiment: 'Positive', days: 15, summary: 'Renewal conversation started early; sponsor happy.', action: 'Send renewal proposal' }
        ],
        [ // worsening -> red
            { signal: 'Amber', sentiment: 'Neutral', days: 110, summary: 'Two integrations pending on their side.', action: 'Chase pending API credentials' },
            { signal: 'Red', sentiment: 'Negative', days: 30, summary: 'Executive sponsor left; usage down 40%. Renewal at risk.', action: 'Build a save plan and schedule EBR' }
        ],
        [ // amber, overdue
            { signal: 'Amber', sentiment: 'Neutral', days: 140, summary: 'Plateaued after go-live; needs an enablement push.', action: 'Schedule admin training' }
        ]
    ];
    let created = 0;
    for (let i = 0; i < accounts.length; i++) {
        const arc = arcs[i % arcs.length];
        for (const p of arc) {
            const call = await healthRepo.createCall({
                account: accounts[i].name, check_date: daysAgo(p.days), signal: p.signal, sentiment: p.sentiment,
                summary: p.summary, conducted_by: 'CS Team'
            }, req.user);
            if (call.call) { await healthRepo.addAction(call.call.id, { text: p.action, owner: 'CSM' }, req.user); created += 1; }
        }
    }
    res.json({ seeded: created });
}));

export default router;
