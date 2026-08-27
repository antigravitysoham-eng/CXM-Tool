import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { journeyRepo } from '../repositories/journeyRepo.js';
import { validate } from '../validation/accountSchema.js';
import { setJourneySchema, updateJourneySchema } from '../validation/journeySchema.js';
import { JOURNEY_STAGES, JOURNEY_HEALTHS, LIFECYCLE_PATH, STAGE_MAX_DAYS, VALUE_ADD_CATEGORIES } from '../data/journeyKit.js';

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

router.get('/meta', wrap(async (req, res) => res.json({ stages: JOURNEY_STAGES, path: LIFECYCLE_PATH, healths: JOURNEY_HEALTHS, stageMaxDays: STAGE_MAX_DAYS, valueAddCategories: VALUE_ADD_CATEGORIES })));
router.get('/stats', wrap(async (req, res) => res.json(await journeyRepo.stats(req.user))));
router.get('/map', wrap(async (req, res) => res.json(await journeyRepo.map(req.user))));

// Module adoption — which modules each customer uses most / least.
router.get('/adoption', wrap(async (req, res) => res.json(await journeyRepo.adoption(req.user))));
// Per-user module usage — how heavily one named user uses one module.
router.post('/user-module-usage', wrap(async (req, res) => {
    const { account, user_name, product_key, usage_score, role } = req.body || {};
    if (!account || !user_name || !product_key) return res.status(400).json({ error: 'account, user_name and product_key are required' });
    const r = await journeyRepo.setUserModuleUsage(account, user_name, product_key, { usage_score, role }, req.user);
    if (r.forbidden) return res.status(403).json({ error: 'You do not have access to this account' });
    if (r.notFound) return res.status(404).json({ error: 'Unknown module or user' });
    res.json(await journeyRepo.adoption(req.user));
}));
router.post('/adoption', wrap(async (req, res) => {
    const { account, product_key, usage_score, last_active } = req.body || {};
    if (!account || !product_key) return res.status(400).json({ error: 'account and product_key are required' });
    const r = await journeyRepo.setAdoption(account, product_key, { usage_score, last_active }, req.user);
    if (r.forbidden) return res.status(403).json({ error: 'You do not have access to this account' });
    if (r.notFound) return res.status(404).json({ error: 'Unknown module' });
    res.json(await journeyRepo.adoption(req.user));
}));

router.get('/', wrap(async (req, res) => res.json(await journeyRepo.list(req.user))));

// ---- extra value delivered (beyond scope) ----
// Download an uploaded artifact. Literal-prefixed, so it never shadows /:account.
router.get('/value-adds/:id/artifact', wrap(async (req, res) => {
    const r = await journeyRepo.downloadArtifact(Number(req.params.id), req.user);
    if (r.notFound || r.forbidden) return res.status(r.forbidden ? 403 : 404).json({ error: 'Not found — or outside your access' });
    if (r.noFile) return res.status(409).json({ error: 'No file attached to this entry' });
    res.setHeader('Content-Type', r.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${String(r.file_name).replace(/["\r\n]/g, '')}"`);
    res.send(r.buffer);
}));

router.delete('/value-adds/:id', wrap(async (req, res) => {
    const r = await journeyRepo.removeValueAdd(Number(req.params.id), req.user);
    if (settled(res, r)) return;
    res.json(r);
}));

router.get('/:account/value-adds', wrap(async (req, res) => {
    const list = await journeyRepo.valueAdds(req.params.account, req.user);
    if (list === null) return res.status(404).json({ error: 'Not found — or outside your access' });
    res.json(list);
}));

router.post('/:account/value-adds', wrap(async (req, res) => {
    const b = req.body || {};
    if (!String(b.title || '').trim()) return res.status(400).json({ error: 'title is required' });
    const r = await journeyRepo.addValueAdd(req.params.account, {
        title: String(b.title).trim().slice(0, 200),
        category: b.category, detail: String(b.detail || '').slice(0, 2000),
        activity_date: b.activity_date, artifact_link: String(b.artifact_link || '').slice(0, 500),
        file_base64: b.file_base64, file_name: b.file_name, file_mime: b.file_mime
    }, req.user);
    if (settled(res, r)) return;
    res.status(201).json(r.valueAdd);
}));

router.get('/:account', wrap(async (req, res) => {
    const j = await journeyRepo.get(req.params.account, req.user);
    if (!j) return res.status(404).json({ error: 'Not found' });
    res.json(j);
}));

// Upsert a customer's journey position (create-or-update).
router.post('/', wrap(async (req, res) => {
    const data = validate(setJourneySchema, req.body);
    const r = await journeyRepo.set(data.account, data, req.user);
    if (settled(res, r)) return;
    res.status(201).json(r.journey);
}));

router.patch('/:account', wrap(async (req, res) => {
    const data = validate(updateJourneySchema, req.body);
    const r = await journeyRepo.set(req.params.account, data, req.user);
    if (settled(res, r)) return;
    res.json(r.journey);
}));

router.post('/seed-sample', requireRole('admin'), wrap(async (req, res) => res.json(await journeyRepo.seedSample(req.user))));

export default router;
