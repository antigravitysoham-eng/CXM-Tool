import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { surveyRepo } from '../repositories/surveyRepo.js';
import { validate } from '../validation/accountSchema.js';
import { createCampaignSchema, updateCampaignSchema, createResponseSchema } from '../validation/surveySchema.js';
import { SURVEY_TYPES, SURVEY_STATUSES, DEFAULT_QUESTION } from '../data/surveyKit.js';

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

router.get('/meta', wrap(async (req, res) => res.json({ types: SURVEY_TYPES, statuses: SURVEY_STATUSES, questions: DEFAULT_QUESTION })));
router.get('/stats', wrap(async (req, res) => res.json(await surveyRepo.stats(req.user))));
router.get('/detractors', wrap(async (req, res) => res.json(await surveyRepo.detractors(req.user))));

router.get('/', wrap(async (req, res) => res.json(await surveyRepo.listCampaigns(req.user, { account: req.query.account, status: req.query.status }))));

router.get('/:id', wrap(async (req, res) => {
    const c = await surveyRepo.getCampaign(Number(req.params.id), req.user);
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(c);
}));

router.post('/', wrap(async (req, res) => {
    const data = validate(createCampaignSchema, req.body);
    const r = await surveyRepo.createCampaign(data, req.user);
    if (settled(res, r)) return;
    res.status(201).json(r.campaign);
}));

router.patch('/:id', wrap(async (req, res) => {
    const data = validate(updateCampaignSchema, req.body);
    const r = await surveyRepo.updateCampaign(Number(req.params.id), data, req.user);
    if (settled(res, r)) return;
    res.json(r.campaign);
}));

router.post('/:id/send', wrap(async (req, res) => {
    const r = await surveyRepo.send(Number(req.params.id), req.body?.sent_count, req.user);
    if (settled(res, r)) return;
    res.json(r.campaign);
}));

router.delete('/:id', wrap(async (req, res) => {
    const r = await surveyRepo.removeCampaign(Number(req.params.id), req.user);
    if (settled(res, r)) return;
    res.json(r);
}));

router.post('/:id/responses', wrap(async (req, res) => {
    const data = validate(createResponseSchema, req.body);
    const r = await surveyRepo.addResponse(Number(req.params.id), data, req.user);
    if (settled(res, r)) return;
    res.status(201).json(r.campaign);
}));

router.delete('/responses/:id', wrap(async (req, res) => {
    const r = await surveyRepo.removeResponse(Number(req.params.id), req.user);
    if (settled(res, r)) return;
    res.json(r.campaign);
}));

router.post('/seed-sample', requireRole('admin'), wrap(async (req, res) => res.json(await surveyRepo.seedSample(req.user))));

export default router;
