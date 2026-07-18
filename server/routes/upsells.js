import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { expansionRepo } from '../repositories/expansionRepo.js';
import { validate } from '../validation/accountSchema.js';
import { createExpansionSchema, updateExpansionSchema } from '../validation/expansionSchema.js';
import { EXPANSION_TYPES, EXPANSION_STAGES, STAGE_PROBABILITY } from '../data/expansionKit.js';

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

router.get('/meta', wrap(async (req, res) => res.json({ types: EXPANSION_TYPES, stages: EXPANSION_STAGES, stageProbability: STAGE_PROBABILITY })));
router.get('/stats', wrap(async (req, res) => res.json(await expansionRepo.stats(req.user))));
router.get('/pipeline', wrap(async (req, res) => res.json(await expansionRepo.pipeline(req.user))));

router.get('/', wrap(async (req, res) => res.json(await expansionRepo.list(req.user, {
    account: req.query.account, stage: req.query.stage, type: req.query.type
}))));

router.get('/:id', wrap(async (req, res) => {
    const e = await expansionRepo.get(Number(req.params.id), req.user);
    if (!e) return res.status(404).json({ error: 'Not found' });
    res.json(e);
}));

router.post('/', wrap(async (req, res) => {
    const data = validate(createExpansionSchema, req.body);
    const r = await expansionRepo.create(data, req.user);
    if (settled(res, r)) return;
    res.status(201).json(r.expansion);
}));

router.patch('/:id', wrap(async (req, res) => {
    const data = validate(updateExpansionSchema, req.body);
    const r = await expansionRepo.update(Number(req.params.id), data, req.user);
    if (settled(res, r)) return;
    res.json(r.expansion);
}));

router.delete('/:id', wrap(async (req, res) => {
    const r = await expansionRepo.remove(Number(req.params.id), req.user);
    if (settled(res, r)) return;
    res.json(r);
}));

router.post('/seed-sample', requireRole('admin'), wrap(async (req, res) => res.json(await expansionRepo.seedSample(req.user))));

export default router;
