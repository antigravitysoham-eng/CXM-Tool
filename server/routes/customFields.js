import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { customFieldRepo, CUSTOM_FIELD_TYPES } from '../repositories/customFieldRepo.js';

const router = express.Router();
router.use(authenticateToken);

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
});

// List custom column definitions for a module.
router.get('/', wrap(async (req, res) => {
    const module = req.query.module || 'accounts';
    res.json(await customFieldRepo.listDefs(module));
}));

// Add a custom column (admin/manager — it affects the whole module).
router.post('/', requireRole('admin', 'manager'), wrap(async (req, res) => {
    const { module = 'accounts', label, type = 'text', options = [] } = req.body;
    if (!label || !String(label).trim()) {
        return res.status(400).json({ error: 'Label is required' });
    }
    if (!CUSTOM_FIELD_TYPES.includes(type)) {
        return res.status(400).json({ error: `type must be one of ${CUSTOM_FIELD_TYPES.join(', ')}` });
    }
    res.status(201).json(await customFieldRepo.createDef(module, { label, type, options }));
}));

router.delete('/:id', requireRole('admin', 'manager'), wrap(async (req, res) => {
    const module = req.query.module || 'accounts';
    const r = await customFieldRepo.deleteDef(module, Number(req.params.id));
    if (r.notFound) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
}));

export default router;
