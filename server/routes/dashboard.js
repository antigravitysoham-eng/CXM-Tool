import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { dashboardRepo } from '../repositories/dashboardRepo.js';

const router = express.Router();
router.use(authenticateToken);

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
});

// The whole executive picture in one scoped read.
router.get('/overview', wrap(async (req, res) => res.json(await dashboardRepo.overview(req.user))));

export default router;
