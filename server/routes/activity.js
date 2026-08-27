import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { activityRepo } from '../repositories/activityRepo.js';

// The Activity Log is a governance surface — admins and managers only.
const router = express.Router();
router.use(authenticateToken);
router.use(requireRole('admin', 'manager'));

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
});

router.get('/meta', wrap(async (req, res) => res.json(await activityRepo.meta())));

router.get('/', wrap(async (req, res) => {
    const { actor, action, entity, from, to, limit } = req.query;
    res.json(await activityRepo.list({ actor, action, entity, from, to, limit }));
}));

export default router;
