import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { config } from '../config.js';
import { AGENTS, AGENT_BY_ROUTE, getAgent } from '../agents/registry.js';
import { aukatRespond } from '../agents/aukatBrain.js';
import { neoRespond } from '../agents/neoBrain.js';
import { auraRespond } from '../agents/auraBrain.js';
import { missionsForAgent } from '../agents/missions.js';
import { gameRepo } from '../repositories/gameRepo.js';
import { accountRepo } from '../repositories/accountRepo.js';
import { contractRepo } from '../repositories/contractRepo.js';

const router = express.Router();
router.use(authenticateToken);

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
});

// Assemble the data each agent's brain / missions need.
async function contextFor(agentKey, user) {
    const ctx = { fx: config.fxUsdInr, records: [], contracts: [] };
    if (agentKey === 'aukat' || agentKey === 'aura' || agentKey === 'neo') ctx.records = await accountRepo.list(user);
    if (agentKey === 'aura' || agentKey === 'neo') ctx.contracts = await contractRepo.list({});
    return ctx;
}

// Roster + the caller's per-agent progress.
router.get('/', wrap(async (req, res) => {
    const state = await gameRepo.getState(req.user.id);
    const agents = AGENTS.map((a) => ({
        ...a,
        xp: state.agents[a.key]?.xp || 0,
        agentLevel: state.agents[a.key]?.level || 1,
        interactions: state.agents[a.key]?.interactions || 0
    }));
    res.json({ agents, routes: AGENT_BY_ROUTE });
}));

// Gamification state (xp, level, streak, command score, achievements).
router.get('/state', wrap(async (req, res) => {
    res.json(await gameRepo.getState(req.user.id));
}));

// Award XP for an action (mission complete, account created, import, etc.).
router.post('/event', wrap(async (req, res) => {
    const { type, agentKey = null, points = null } = req.body || {};
    if (!type) return res.status(400).json({ error: 'type is required' });
    res.json(await gameRepo.award(req.user.id, { type, agentKey, points }));
}));

// Missions for an agent, computed from live data.
router.get('/:key/missions', wrap(async (req, res) => {
    const agent = getAgent(req.params.key);
    if (!agent) return res.status(404).json({ error: 'Unknown agent' });
    const ctx = await contextFor(agent.key, req.user);
    res.json(missionsForAgent(agent.key, ctx));
}));

// Standing instructions the user gives an agent.
router.get('/:key/instructions', wrap(async (req, res) => {
    res.json(await gameRepo.listInstructions(req.user.id, req.params.key));
}));
router.post('/:key/instructions', wrap(async (req, res) => {
    const { text } = req.body || {};
    if (!text || !String(text).trim()) return res.status(400).json({ error: 'text is required' });
    const instructions = await gameRepo.addInstruction(req.user.id, req.params.key, String(text).trim());
    const game = await gameRepo.award(req.user.id, { type: 'instruction_saved', agentKey: req.params.key });
    res.json({ instructions, game });
}));

// Talk to an agent.
router.post('/:key/ask', wrap(async (req, res) => {
    const agent = getAgent(req.params.key);
    if (!agent) return res.status(404).json({ error: 'Unknown agent' });
    if (!agent.online) return res.status(400).json({ error: `${agent.name} is not online yet` });

    const { message } = req.body || {};
    const ctx = await contextFor(agent.key, req.user);
    const brain = agent.key === 'neo' ? neoRespond : agent.key === 'aura' ? auraRespond : aukatRespond;
    const out = brain(message, ctx);
    const game = await gameRepo.award(req.user.id, { type: 'agent_query', agentKey: agent.key });

    res.json({ agent, reply: out.reply, chips: out.chips || [], game });
}));

export default router;
