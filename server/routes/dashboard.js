import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { dashboardRepo, csmAdvice } from '../repositories/dashboardRepo.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
});

// The whole executive picture in one scoped read. ?from=&to= pro-rate the value
// headlines (ARR under management, CSM book) to the selected date range.
const cleanDate = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) ? String(d) : '');
router.get('/overview', wrap(async (req, res) => res.json(
    await dashboardRepo.overview(req.user, { from: cleanDate(req.query.from), to: cleanDate(req.query.to) })
)));

// Where a headline number came from — the contributing rows behind one tile.
router.get('/explain/:key', wrap(async (req, res) => {
    const r = await dashboardRepo.explain(req.user, req.params.key);
    if (r.notFound) return res.status(404).json({ error: `No explanation is defined for "${req.params.key}"` });
    res.json(r);
}));

/**
 * Which CSM should take an account.
 *
 * Admin-only: the answer exposes every CSM's entire book — ARR, account count
 * and how many of theirs are on fire. That is a management view, not something
 * a rep should see about their peers.
 */
router.get('/csm-advice', requireRole('admin'), wrap(async (req, res) => {
    res.json(await csmAdvice(req.user, { account: req.query.account }));
}));

export default router;
