import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { featureRepo } from '../repositories/featureRepo.js';
import { validate } from '../validation/accountSchema.js';
import { createFeatureSchema, updateFeatureSchema, supporterSchema } from '../validation/featureSchema.js';
import { FEATURE_STATUSES, IMPACTS, EFFORTS, PRODUCT_AREAS } from '../data/featureKit.js';
import { relayFeatureToCto } from '../services/telegramService.js';

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

// Look a request up by its reference (FR-0007) — the id shown on the board and
// used to retrieve a request over WhatsApp.
router.get('/ref/:ref', wrap(async (req, res) => {
    const f = await featureRepo.getByRef(req.params.ref, req.user);
    if (!f) return res.status(404).json({ error: 'Not found' });
    res.json(f);
}));

router.get('/:id', wrap(async (req, res) => {
    const f = await featureRepo.get(Number(req.params.id), req.user);
    if (!f) return res.status(404).json({ error: 'Not found' });
    res.json(f);
}));

router.get('/:id/stage-history', wrap(async (req, res) => {
    const h = await featureRepo.stageHistory(Number(req.params.id), req.user);
    if (h === null) return res.status(404).json({ error: 'Not found — or outside your access' });
    res.json(h);
}));

router.post('/', wrap(async (req, res) => {
    const data = validate(createFeatureSchema, req.body);
    const r = await featureRepo.create(data, req.user);
    if (settled(res, r)) return;
    // New feature requests are passed on to the CTO's Telegram — fire-and-forget,
    // no-op if Telegram isn't configured.
    relayFeatureToCto(r.feature, { by: req.user.name }).catch(() => {});
    res.status(201).json(r.feature);
}));

// Manually push a request to the CTO's Telegram (any user who can see it).
router.post('/:id/escalate-cto', wrap(async (req, res) => {
    const f = await featureRepo.get(Number(req.params.id), req.user);
    if (!f) return res.status(404).json({ error: 'Not found — or outside your access' });
    const r = await relayFeatureToCto(f, { by: req.user.name });
    if (!r.ok) return res.status(r.disabled ? 503 : 502).json({ error: r.reason });
    res.json({ ok: true, ref: f.ref });
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
