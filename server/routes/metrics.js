import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { metricRepo } from '../repositories/metricRepo.js';
import { dashboardRepo } from '../repositories/dashboardRepo.js';

const router = express.Router();
router.use(authenticateToken);

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
});

// Which metrics can be explained — used by the UI to decide whether a card is
// drillable, so a page never renders a dead "where did this come from" affordance.
router.get('/', wrap(async (req, res) => res.json({ keys: metricRepo.keys() })));

/**
 * Where a number came from.
 *
 * Module metrics live in the registry; the six dashboard headline figures are
 * derived rather than filtered (retention is a ratio, adoption spans modules)
 * and keep their bespoke builders in dashboardRepo. One endpoint serves both so
 * the client never has to know which kind it is asking about.
 */
router.get('/:key/explain', wrap(async (req, res) => {
    const { key } = req.params;
    let r = await metricRepo.explain(req.user, key);
    if (r.notFound) r = await dashboardRepo.explain(req.user, key);
    if (r.notFound) return res.status(404).json({ error: `No explanation is defined for "${key}"` });
    res.json(r);
}));

export default router;
