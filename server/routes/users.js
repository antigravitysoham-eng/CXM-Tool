import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { userRepo } from '../repositories/userRepo.js';
import { policyRepo, CONDITION_TYPES, ACTIONS, MODULES } from '../services/policyService.js';

const router = express.Router();
router.use(authenticateToken);

const ROLES = ['admin', 'manager', 'rep'];
// Admin-provisioned agent access levels. 'none' = this user may not delegate to
// any agent; 'read' = read-only agent keys; 'write' = keys that may also propose
// changes through the human approval queue (never write directly).
const AGENT_ACCESS = ['none', 'read', 'write'];
// Same global regions as accounts — so an ABAC "region" policy matches the
// account's region attribute directly.
const REGIONS = ['APAC', 'EMEA', 'AMER', 'ANZ', 'LATAM', 'MEA', 'India'];

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
});

router.get('/meta', wrap(async (req, res) => {
    res.json({ roles: ROLES, regions: REGIONS, agentAccess: AGENT_ACCESS, conditionTypes: CONDITION_TYPES, actions: ACTIONS, modules: MODULES, role: req.user.role });
}));

// ---- policies (admin) ----
router.get('/policies', requireRole('admin', 'manager'), wrap(async (req, res) => {
    const rows = await policyRepo.list();
    res.json(rows.map((p) => ({ ...p, actions: p.actions.split(',').map((s) => s.trim()) })));
}));
router.post('/policies', requireRole('admin'), wrap(async (req, res) => {
    const { name, role, module, actions, effect, condition_type, condition_value } = req.body || {};
    if (!name || !role) return res.status(400).json({ error: 'name and role are required' });
    res.status(201).json(await policyRepo.create({ name, role, module, actions, effect, condition_type, condition_value }));
}));
router.delete('/policies/:id', requireRole('admin'), wrap(async (req, res) => {
    res.json(await policyRepo.remove(Number(req.params.id)));
}));

// ---- users ----
router.get('/', requireRole('admin', 'manager'), wrap(async (req, res) => {
    res.json(await userRepo.list());
}));

router.post('/', requireRole('admin'), wrap(async (req, res) => {
    const { email, name, password, role = 'rep', region = '', business_unit = '', team = '', agent_access = 'read', phone = '' } = req.body || {};
    if (!email || !name || !password) return res.status(400).json({ error: 'email, name and password are required' });
    if (!ROLES.includes(role)) return res.status(400).json({ error: `role must be one of ${ROLES.join(', ')}` });
    if (!AGENT_ACCESS.includes(agent_access)) return res.status(400).json({ error: `agent_access must be one of ${AGENT_ACCESS.join(', ')}` });
    if (phone && !/^\+?[\d\s-]{7,20}$/.test(phone)) return res.status(400).json({ error: 'phone must be a valid number (E.164, e.g. +91 62917 45974)' });
    res.status(201).json(await userRepo.create({ email, name, password, role, region, business_unit, team, agent_access, phone }));
}));

router.patch('/:id', requireRole('admin'), wrap(async (req, res) => {
    const id = Number(req.params.id);
    const target = await userRepo.get(id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    // Don't allow removing the last admin's admin role.
    if (target.role === 'admin' && req.body.role && req.body.role !== 'admin' && (await userRepo.countAdmins()) <= 1) {
        return res.status(400).json({ error: 'Cannot demote the last admin' });
    }
    if (req.body.role && !ROLES.includes(req.body.role)) return res.status(400).json({ error: 'Invalid role' });
    if (req.body.agent_access && !AGENT_ACCESS.includes(req.body.agent_access)) return res.status(400).json({ error: 'Invalid agent_access' });
    if (req.body.module_access !== undefined) {
        const ma = req.body.module_access;
        if (ma === null || typeof ma !== 'object' || Array.isArray(ma)) return res.status(400).json({ error: 'module_access must be an object of module -> "allow"|"deny"' });
        if (Object.values(ma).some((v) => v !== 'allow' && v !== 'deny')) return res.status(400).json({ error: 'module_access values must be "allow" or "deny"' });
    }
    if (req.body.phone && !/^\+?[\d\s-]{7,20}$/.test(req.body.phone)) return res.status(400).json({ error: 'phone must be a valid number' });
    res.json(await userRepo.update(id, req.body));
}));

router.delete('/:id', requireRole('admin'), wrap(async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });
    const target = await userRepo.get(id);
    if (target?.role === 'admin' && (await userRepo.countAdmins()) <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last admin' });
    }
    res.json(await userRepo.remove(id));
}));

export default router;
