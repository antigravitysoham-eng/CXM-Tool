import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { commsRepo } from '../repositories/commsRepo.js';
import { validate } from '../validation/accountSchema.js';
import { createCommSchema, updateCommSchema, sendCommSchema, COMM_TYPES, COMM_STATUSES } from '../validation/commsSchema.js';

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

router.get('/meta', wrap(async (req, res) => res.json({ types: COMM_TYPES, statuses: COMM_STATUSES })));
router.get('/stats', wrap(async (req, res) => res.json(await commsRepo.stats(req.user))));
router.get('/', wrap(async (req, res) => res.json(await commsRepo.list(req.user, { account: req.query.account, status: req.query.status, type: req.query.type }))));

router.get('/:id', wrap(async (req, res) => {
    const c = await commsRepo.get(Number(req.params.id), req.user);
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(c);
}));

router.post('/', wrap(async (req, res) => {
    const data = validate(createCommSchema, req.body);
    const r = await commsRepo.create(data, req.user);
    if (settled(res, r)) return;
    res.status(201).json(r.comm);
}));

router.patch('/:id', wrap(async (req, res) => {
    const data = validate(updateCommSchema, req.body);
    const r = await commsRepo.update(Number(req.params.id), data, req.user);
    if (settled(res, r)) return;
    res.json(r.comm);
}));

router.post('/:id/send', wrap(async (req, res) => {
    const data = validate(sendCommSchema, req.body || {});
    const r = await commsRepo.send(Number(req.params.id), data, req.user);
    if (settled(res, r)) return;
    res.json(r.comm);
}));

router.delete('/:id', wrap(async (req, res) => {
    const r = await commsRepo.remove(Number(req.params.id), req.user);
    if (settled(res, r)) return;
    res.json(r);
}));

router.post('/seed-sample', requireRole('admin'), wrap(async (req, res) => res.json(await commsRepo.seedSample(req.user))));

export default router;
