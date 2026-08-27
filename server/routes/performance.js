import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { performanceRepo } from '../repositories/performanceRepo.js';

// People-performance scorecards. Admin-only: these roll the whole book up by the
// person responsible, which only makes sense for someone who can see all of it.
const router = express.Router();
router.use(authenticateToken);
router.use(requireRole('admin'));

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
});

// ?from=&to= pro-rate the value figures (portfolio / closed value / ARR) to the range.
const cleanDate = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) ? String(d) : '');
const periodOf = (req) => ({ from: cleanDate(req.query.from), to: cleanDate(req.query.to) });

router.get('/csm', wrap(async (req, res) => res.json(await performanceRepo.csmScorecards(req.user, periodOf(req)))));
router.get('/account-managers', wrap(async (req, res) => res.json(await performanceRepo.accountManagerScorecards(req.user, periodOf(req)))));
router.get('/partners', wrap(async (req, res) => res.json(await performanceRepo.partnerScorecards(req.user, periodOf(req)))));
router.get('/partner-managers', wrap(async (req, res) => res.json(await performanceRepo.partnerManagerScorecards(req.user, periodOf(req)))));

export default router;
