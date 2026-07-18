import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { ebrRepo } from '../repositories/ebrRepo.js';
import { validate } from '../validation/accountSchema.js';
import { generateSchema, generateAllSchema, updateEbrSchema } from '../validation/ebrSchema.js';
import { EBR_STATUSES, recentQuarters, currentQuarter } from '../data/ebrPeriods.js';

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
    res.json({ statuses: EBR_STATUSES, quarters: recentQuarters(6), currentQuarter: currentQuarter() });
}));

// Quarterly coverage board — who has an EBR this quarter, who's been shared with.
router.get('/coverage', wrap(async (req, res) => res.json(await ebrRepo.coverage(req.user, { quarter: req.query.quarter }))));

router.get('/', wrap(async (req, res) => res.json(await ebrRepo.list(req.user, {
    account: req.query.account, quarter: req.query.quarter, status: req.query.status
}))));

// Generate one customer's EBR from platform data.
router.post('/generate', wrap(async (req, res) => {
    const data = validate(generateSchema, req.body);
    const r = await ebrRepo.generate(data, req.user);
    if (settled(res, r)) return;
    res.status(201).json(r.ebr);
}));

// Generate for every accessible customer (the quarterly run).
router.post('/generate-all', wrap(async (req, res) => {
    const data = validate(generateAllSchema, req.body || {});
    res.json(await ebrRepo.generateAll(data, req.user));
}));

router.get('/:id', wrap(async (req, res) => {
    const e = await ebrRepo.get(Number(req.params.id), req.user);
    if (!e) return res.status(404).json({ error: 'Not found' });
    res.json(e);
}));

router.patch('/:id', wrap(async (req, res) => {
    const data = validate(updateEbrSchema, req.body);
    const r = await ebrRepo.update(Number(req.params.id), data, req.user);
    if (settled(res, r)) return;
    res.json(r.ebr);
}));

// Share the review with the customer — the quarterly deliverable.
router.post('/:id/share', wrap(async (req, res) => {
    const r = await ebrRepo.share(Number(req.params.id), req.user);
    if (settled(res, r)) return;
    res.json(r.ebr);
}));

router.delete('/:id', wrap(async (req, res) => {
    const r = await ebrRepo.remove(Number(req.params.id), req.user);
    if (settled(res, r)) return;
    res.json(r);
}));

export default router;
