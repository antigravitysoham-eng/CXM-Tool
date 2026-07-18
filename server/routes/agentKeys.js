import express from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import { agentKeyRepo } from '../repositories/agentKeyRepo.js';
import { visibleAgents, canUseAgent } from '../agents/registry.js';
import { validate } from '../validation/accountSchema.js';

const router = express.Router();
router.use(authenticateToken);

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
});

// A person manages their own agent keys. Agents can't reach this router at all
// (the segment is on the agent forbidden-list) — so no key can mint another key.
const mintSchema = z.object({
    agent_key: z.string().trim().min(1),
    label: z.string().trim().max(80).optional().default('')
});

// Which agents may I mint a key for? Exactly the ones I'm allowed to use — a key
// can never grant reach I don't have myself.
router.get('/mintable', wrap(async (req, res) => {
    const agents = (await visibleAgents(req.user)).filter((a) => a.online);
    res.json(agents.map((a) => ({
        key: a.key, name: a.name, emoji: a.emoji, color: a.color,
        tagline: a.tagline, scope: a.apiScope
    })));
}));

router.get('/', wrap(async (req, res) => {
    res.json(await agentKeyRepo.list(req.user.id));
}));

router.post('/', wrap(async (req, res) => {
    const { agent_key, label } = validate(mintSchema, req.body);
    // You can only delegate authority you hold: minting a key for an agent you
    // aren't permitted to use is refused here, before any key exists.
    if (!(await canUseAgent(req.user, agent_key))) {
        return res.status(403).json({ error: 'You do not have access to that agent.' });
    }
    const minted = await agentKeyRepo.mint(req.user.id, { agentKey: agent_key, label });
    // The secret is returned exactly once — the client must surface it now.
    res.status(201).json(minted);
}));

router.delete('/:id', wrap(async (req, res) => {
    const r = await agentKeyRepo.revoke(req.user.id, Number(req.params.id));
    if (r.notFound) return res.status(404).json({ error: 'Key not found' });
    res.json(r);
}));

export default router;
