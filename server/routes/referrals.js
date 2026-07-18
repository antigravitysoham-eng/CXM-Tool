import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { referralRepo } from '../repositories/referralRepo.js';
import { validate } from '../validation/accountSchema.js';
import { createReferralSchema, updateReferralSchema, REFERRAL_STATUSES } from '../validation/referralSchema.js';

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

router.get('/meta', wrap(async (req, res) => res.json({ statuses: REFERRAL_STATUSES })));
router.get('/stats', wrap(async (req, res) => res.json(await referralRepo.stats(req.user))));
router.get('/advocates', wrap(async (req, res) => res.json(await referralRepo.advocates(req.user))));

router.get('/', wrap(async (req, res) => res.json(await referralRepo.list(req.user, { account: req.query.account, status: req.query.status }))));

router.get('/:id', wrap(async (req, res) => {
    const r = await referralRepo.get(Number(req.params.id), req.user);
    if (!r) return res.status(404).json({ error: 'Not found' });
    res.json(r);
}));

router.post('/', wrap(async (req, res) => {
    const data = validate(createReferralSchema, req.body);
    const r = await referralRepo.create(data, req.user);
    if (settled(res, r)) return;
    res.status(201).json(r.referral);
}));

router.patch('/:id', wrap(async (req, res) => {
    const data = validate(updateReferralSchema, req.body);
    const r = await referralRepo.update(Number(req.params.id), data, req.user);
    if (settled(res, r)) return;
    res.json(r.referral);
}));

router.delete('/:id', wrap(async (req, res) => {
    const r = await referralRepo.remove(Number(req.params.id), req.user);
    if (settled(res, r)) return;
    res.json(r);
}));

router.post('/seed-sample', requireRole('admin'), wrap(async (req, res) => res.json(await referralRepo.seedSample(req.user))));

export default router;
