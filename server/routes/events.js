import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { eventRepo } from '../repositories/eventRepo.js';
import { validate } from '../validation/accountSchema.js';
import { createEventSchema, updateEventSchema, EVENT_TYPES, EVENT_STATUSES } from '../validation/eventSchema.js';

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

router.get('/meta', wrap(async (req, res) => res.json({ types: EVENT_TYPES, statuses: EVENT_STATUSES })));
router.get('/stats', wrap(async (req, res) => res.json(await eventRepo.stats(req.user))));
router.get('/', wrap(async (req, res) => res.json(await eventRepo.list(req.user, { account: req.query.account, status: req.query.status, type: req.query.type }))));

router.get('/:id', wrap(async (req, res) => {
    const e = await eventRepo.get(Number(req.params.id), req.user);
    if (!e) return res.status(404).json({ error: 'Not found' });
    res.json(e);
}));

router.post('/', wrap(async (req, res) => {
    const data = validate(createEventSchema, req.body);
    const r = await eventRepo.create(data, req.user);
    if (settled(res, r)) return;
    res.status(201).json(r.event);
}));

router.patch('/:id', wrap(async (req, res) => {
    const data = validate(updateEventSchema, req.body);
    const r = await eventRepo.update(Number(req.params.id), data, req.user);
    if (settled(res, r)) return;
    res.json(r.event);
}));

router.delete('/:id', wrap(async (req, res) => {
    const r = await eventRepo.remove(Number(req.params.id), req.user);
    if (settled(res, r)) return;
    res.json(r);
}));

router.post('/seed-sample', requireRole('admin'), wrap(async (req, res) => res.json(await eventRepo.seedSample(req.user))));

export default router;
