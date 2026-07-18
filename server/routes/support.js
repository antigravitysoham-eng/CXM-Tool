import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { supportRepo } from '../repositories/supportRepo.js';
import { accountRepo } from '../repositories/accountRepo.js';
import { validate } from '../validation/accountSchema.js';
import {
    createTicketSchema, updateTicketSchema,
    TICKET_STATUSES, TICKET_PRIORITIES, TICKET_CATEGORIES
} from '../validation/supportSchema.js';
import { SLA_MATRIX } from '../data/supportSla.js';

const router = express.Router();
router.use(authenticateToken);

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
});

const settled = (res, r) => {
    if (r.notFound) return res.status(404).json({ error: 'Not found — or the account is outside your access' }) || true;
    if (r.forbidden) return res.status(403).json({ error: 'You do not have access to this account' }) || true;
    return false;
};

const filtersFrom = (q) => ({
    account: q.account, status: q.status, priority: q.priority,
    breached: q.breached === 'true', open: q.open === 'true'
});

router.get('/meta', wrap(async (req, res) => {
    res.json({
        statuses: TICKET_STATUSES, priorities: TICKET_PRIORITIES, categories: TICKET_CATEGORIES,
        sla: SLA_MATRIX
    });
}));

router.get('/stats', wrap(async (req, res) => {
    res.json(await supportRepo.stats(req.user, filtersFrom(req.query)));
}));

router.get('/', wrap(async (req, res) => {
    res.json(await supportRepo.list(req.user, filtersFrom(req.query)));
}));

router.get('/:id', wrap(async (req, res) => {
    const t = await supportRepo.get(Number(req.params.id), req.user);
    if (!t) return res.status(404).json({ error: 'Not found' });
    res.json(t);
}));

router.post('/', wrap(async (req, res) => {
    const data = validate(createTicketSchema, req.body);
    const r = await supportRepo.create(data, req.user);
    if (settled(res, r)) return;
    res.status(201).json(r.ticket);
}));

router.patch('/:id', wrap(async (req, res) => {
    const data = validate(updateTicketSchema, req.body);
    const r = await supportRepo.update(Number(req.params.id), data, req.user);
    if (settled(res, r)) return;
    res.json(r.ticket);
}));

router.delete('/:id', wrap(async (req, res) => {
    const r = await supportRepo.remove(Number(req.params.id), req.user);
    if (settled(res, r)) return;
    res.json(r);
}));

/**
 * Seed a spread of sample tickets across the accounts the caller can see —
 * varied priority, status and timing so the SLA math has something to show
 * (some breached, some at-risk, some comfortably in SLA). Admin only, idempotent-
 * ish: it appends, so it's for demos and fresh test databases.
 */
router.post('/seed-sample', requireRole('admin'), wrap(async (req, res) => {
    const accounts = await accountRepo.list(req.user);
    if (!accounts.length) return res.status(400).json({ error: 'No accounts to attach tickets to — seed accounts first.' });

    const hoursAgo = (h) => new Date(Date.now() - h * 3600000).toISOString();
    // [subject, category, priority, status, openedHrsAgo, firstResponseHrsAgo|null, resolvedHrsAgo|null]
    const plan = [
        ['Login failing after SSO change', 'Access', 'Urgent', 'Open', 6, null, null],           // no response yet → likely breached
        ['Dashboard totals look wrong', 'Bug', 'High', 'In Progress', 30, 28, null],
        ['How do I export the renewal list?', 'How-to', 'Low', 'Resolved', 120, 118, 100],
        ['Invoice PDF not generating', 'Billing', 'High', 'Waiting on Customer', 50, 47, null],   // clock paused
        ['API rate limit too low for sync', 'Technical', 'Normal', 'Open', 20, 18, null],
        ['Add bulk user import', 'Feature request', 'Low', 'Open', 200, 190, null],
        ['Onboarding checklist stuck', 'Technical', 'Urgent', 'Resolved', 40, 39, 12],            // resolved late → breach
        ['SAML metadata refresh', 'Access', 'Normal', 'Closed', 300, 298, 250]
    ];

    let created = 0;
    for (let i = 0; i < plan.length; i++) {
        const acct = accounts[i % accounts.length];
        const [subject, category, priority, status, oh, fh, rh] = plan[i];
        const r = await supportRepo.create({
            account: acct.name, subject, category, priority, status,
            requester_name: 'Sample Requester', assignee: status === 'Open' ? '' : 'Support Desk',
            opened_at: hoursAgo(oh),
            first_response_at: fh === null ? '' : hoursAgo(fh),
            resolved_at: rh === null ? '' : hoursAgo(rh)
        }, req.user);
        if (r.ticket) created += 1;
    }
    res.json({ seeded: created });
}));

export default router;
