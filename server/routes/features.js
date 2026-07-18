import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { featureRepo } from '../repositories/featureRepo.js';
import { validate } from '../validation/accountSchema.js';
import { createFeatureSchema, updateFeatureSchema, supporterSchema } from '../validation/featureSchema.js';
import { FEATURE_STATUSES, IMPACTS, EFFORTS, PRODUCT_AREAS } from '../data/featureKit.js';

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

router.get('/meta', wrap(async (req, res) => res.json({ statuses: FEATURE_STATUSES, impacts: IMPACTS, efforts: EFFORTS, areas: PRODUCT_AREAS })));
router.get('/stats', wrap(async (req, res) => res.json(await featureRepo.stats(req.user))));
router.get('/board', wrap(async (req, res) => res.json(await featureRepo.board(req.user))));

router.get('/', wrap(async (req, res) => res.json(await featureRepo.list(req.user, {
    account: req.query.account, status: req.query.status, product_area: req.query.product_area
}))));

router.get('/:id', wrap(async (req, res) => {
    const f = await featureRepo.get(Number(req.params.id), req.user);
    if (!f) return res.status(404).json({ error: 'Not found' });
    res.json(f);
}));

router.post('/', wrap(async (req, res) => {
    const data = validate(createFeatureSchema, req.body);
    const r = await featureRepo.create(data, req.user);
    if (settled(res, r)) return;
    res.status(201).json(r.feature);
}));

router.patch('/:id', wrap(async (req, res) => {
    const data = validate(updateFeatureSchema, req.body);
    const r = await featureRepo.update(Number(req.params.id), data, req.user);
    if (settled(res, r)) return;
    res.json(r.feature);
}));

router.delete('/:id', wrap(async (req, res) => {
    const r = await featureRepo.remove(Number(req.params.id), req.user);
    if (settled(res, r)) return;
    res.json(r);
}));

router.post('/:id/vote', wrap(async (req, res) => {
    const r = await featureRepo.vote(Number(req.params.id), req.user);
    if (settled(res, r)) return;
    res.json(r.feature);
}));

router.post('/:id/supporters', wrap(async (req, res) => {
    const data = validate(supporterSchema, req.body);
    const r = await featureRepo.addSupporter(Number(req.params.id), data.account, req.user);
    if (settled(res, r)) return;
    res.status(201).json(r.feature);
}));

router.delete('/:id/supporters/:account', wrap(async (req, res) => {
    const r = await featureRepo.removeSupporter(Number(req.params.id), req.params.account, req.user);
    if (settled(res, r)) return;
    res.json(r.feature);
}));

router.post('/seed-sample', requireRole('admin'), wrap(async (req, res) => res.json(await featureRepo.seedSample(req.user))));

export default router;
