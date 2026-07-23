import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { ask, confirm } from '../services/neoService.js';
import { AGENTS, visibleAgents } from '../agents/registry.js';
import { agentMemoryRepo } from '../repositories/agentMemoryRepo.js';

const router = express.Router();
router.use(authenticateToken);

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
});

router.get('/meta', wrap(async (req, res) => {
    // NEO leads. The specialists it can call on are named quietly — permission-
    // gated, so a user never sees an agent they have no rights to — while the full
    // roster with missions and XP stays in the Agent HQ module.
    const neo = AGENTS.find((a) => a.key === 'neo');
    const allowed = await visibleAgents(req.user);
    const crew = allowed
        .filter((a) => a.key !== 'neo' && a.online)
        .map((a) => ({ key: a.key, name: a.name, emoji: a.emoji, color: a.color, tagline: a.tagline }));
    res.json({
        neo: neo && { key: neo.key, name: neo.name, emoji: neo.emoji, color: neo.color, tagline: neo.tagline },
        crew,
        suggestions: [
            "How's the pipeline?",
            'Top 5 accounts',
            'What renews in 60 days?',
            'Break it down by region',
            'MEDDICC health',
            'Documents for Muthoot Finance'
        ]
    });
}));

router.post('/ask', wrap(async (req, res) => {
    const { prompt } = req.body || {};
    if (!String(prompt || '').trim()) return res.status(400).json({ error: 'Ask me something' });

    const started = Date.now();
    const answer = await ask(prompt, req.user);
    // Attribute the exchange to whichever specialist owned the intent that ran.
    // `relay` is the real routing, so an unrelayed answer belongs to NEO itself.
    // record() swallows its own errors — telemetry must never break a reply.
    await agentMemoryRepo.record({
        agentKey: answer.relay?.key || 'neo',
        userId: req.user?.id,
        prompt,
        intent: answer.intent,
        blocks: Array.isArray(answer.blocks) ? answer.blocks.length : 0,
        ms: Date.now() - started
    });
    res.json(answer);
}));

router.post('/confirm', wrap(async (req, res) => {
    res.json(await confirm(req.body?.proposal, req.user));
}));

export default router;
