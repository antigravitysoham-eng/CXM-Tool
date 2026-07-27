import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { supportRepo, isBugTicket } from '../repositories/supportRepo.js';
import { accountRepo } from '../repositories/accountRepo.js';
import { relayTicketToCto } from '../services/telegramService.js';
import { validate } from '../validation/accountSchema.js';
import {
    createTicketSchema, updateTicketSchema,
    TICKET_STATUSES, TICKET_PRIORITIES, TICKET_TYPES, TICKET_RESOLUTIONS, TICKET_CHANNELS
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
        statuses: TICKET_STATUSES, priorities: TICKET_PRIORITIES, types: TICKET_TYPES,
        resolutions: TICKET_RESOLUTIONS, channels: TICKET_CHANNELS,
        sla: SLA_MATRIX
    });
}));

router.get('/stats', wrap(async (req, res) => {
    res.json(await supportRepo.stats(req.user, filtersFrom(req.query)));
}));

router.get('/', wrap(async (req, res) => {
    res.json(await supportRepo.list(req.user, filtersFrom(req.query)));
}));

// Look a ticket up by its human reference (TIC-0007) — the id shown in the platform
// and used to retrieve a ticket over WhatsApp.
router.get('/ref/:ref', wrap(async (req, res) => {
    const t = await supportRepo.getByRef(req.params.ref, req.user);
    if (!t) return res.status(404).json({ error: 'Not found' });
    res.json(t);
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
    // A reported bug goes straight to the CTO's Telegram — fire-and-forget so the
    // ticket create never waits on (or fails for) the relay. No-op if unconfigured.
    if (isBugTicket(r.ticket)) {
        relayTicketToCto(r.ticket, { by: req.user.name, byUserId: req.user.id }).catch(() => {});
    }
    res.status(201).json(r.ticket);
}));

// Manually push a ticket to the CTO's Telegram (any user who can see the ticket).
router.post('/:id/escalate-cto', wrap(async (req, res) => {
    const t = await supportRepo.get(Number(req.params.id), req.user);
    if (!t) return res.status(404).json({ error: 'Not found — or the account is outside your access' });
    const r = await relayTicketToCto(t, { by: req.user.name, byUserId: req.user.id });
    if (!r.ok) return res.status(r.disabled ? 503 : 502).json({ error: r.reason });
    res.json({ ok: true, ticket_no: t.ticket_no });
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
    // [subject, type, priority, status, module, channel, resolution, openedHrsAgo, firstResponseHrsAgo|null, resolvedHrsAgo|null]
    const plan = [
        ['Login failing after SSO change', 'Incident', 'Urgent', 'Analysis in Progress', 'Access', 'Zoho', '', 6, null, null],          // no response yet → likely breached
        ['Dashboard totals look wrong', 'Incident', 'High', 'Dev Pending', 'Reporting', 'Zoho', 'Bug Fix', 30, 28, null],               // bug → CTO
        ['How do I export the renewal list?', 'Question', 'Low', 'Solution Accepted', 'Reporting', 'Support Email', 'Documentation', 120, 118, 100],
        ['Invoice PDF not generating', 'Incident', 'High', 'Customer Pending', 'Billing', 'Zoho', '', 50, 47, null],                     // clock paused
        ['API rate limit too low for sync', 'Task', 'Medium', 'Analysis in Progress', 'Integrations', 'Call', '', 20, 18, null],
        ['Add bulk user import', 'Task', 'Low', 'Feature Request', 'Platform', 'Support Email', 'Enhancement', 200, 190, null],          // punted to product
        ['Onboarding checklist stuck', 'Incident', 'Urgent', 'Solution Delivered', 'Onboarding', 'Zoho', 'Bug Fix', 40, 39, 12],        // resolved late → breach
        ['SAML metadata refresh', 'Question', 'Medium', 'Solution Accepted', 'Access', 'Support Email', 'Network Connectivity', 300, 298, 250]
    ];

    let created = 0;
    for (let i = 0; i < plan.length; i++) {
        const acct = accounts[i % accounts.length];
        const [subject, type, priority, status, module, channel, resolution, oh, fh, rh] = plan[i];
        const r = await supportRepo.create({
            account: acct.name, subject, type, priority, status, module, channel, resolution,
            requester_name: 'Sample Requester', assignee: fh === null ? '' : 'Support Desk',
            country: 'India', timezone: 'IST (UTC+5:30)',
            opened_at: hoursAgo(oh),
            first_response_at: fh === null ? '' : hoursAgo(fh),
            resolved_at: rh === null ? '' : hoursAgo(rh)
        }, req.user);
        if (r.ticket) created += 1;
    }
    res.json({ seeded: created });
}));

export default router;
