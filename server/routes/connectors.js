import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { allConnectorStatus, connectorStatus, runSync } from '../services/syncService.js';
import { getDb } from '../db.js';

const router = express.Router();
router.use(authenticateToken);

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
});

// Connector config decides where a whole module's data comes from, and a wrong
// mapping rewrites the book — that's an admin decision, not a rep's.
router.get('/', requireRole('admin', 'manager'), wrap(async (req, res) => {
    res.json(await allConnectorStatus());
}));

router.get('/:key', requireRole('admin', 'manager'), wrap(async (req, res) => {
    const s = await connectorStatus(req.params.key);
    if (!s) return res.status(404).json({ error: 'Unknown connector' });
    res.json(s);
}));

router.get('/:key/runs', requireRole('admin', 'manager'), wrap(async (req, res) => {
    const db = await getDb();
    res.json(await db.all(
        'SELECT * FROM connector_runs WHERE connector_key = ? ORDER BY id DESC LIMIT 20',
        [req.params.key]
    ));
}));

router.post('/:key/sync', requireRole('admin'), wrap(async (req, res) => {
    const r = await runSync(req.params.key, req.user, { since: req.body?.since || null });
    // A failed run is still a run: 200 with the outcome, so the UI can show what
    // happened rather than a bare error toast.
    res.json(r);
}));

export default router;
