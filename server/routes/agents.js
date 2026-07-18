import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { config } from '../config.js';
import { AGENTS, AGENT_BY_ROUTE, getAgent, visibleAgents, canUseAgent } from '../agents/registry.js';
import { aukatRespond } from '../agents/aukatBrain.js';
import { neoRespond } from '../agents/neoBrain.js';
import { auraRespond } from '../agents/auraBrain.js';
import { pilotRespond, onboardingMissions } from '../agents/pilotBrain.js';
import { medicRespond } from '../agents/medicBrain.js';
import { senseiRespond } from '../agents/senseiBrain.js';
import { pulseRespond } from '../agents/pulseBrain.js';
import { ariaRespond } from '../agents/ariaBrain.js';
import { echoRespond } from '../agents/echoBrain.js';
import { onboardingRepo } from '../repositories/onboardingRepo.js';
import { supportRepo } from '../repositories/supportRepo.js';
import { trainingRepo } from '../repositories/trainingRepo.js';
import { healthRepo } from '../repositories/healthRepo.js';
import { ebrRepo } from '../repositories/ebrRepo.js';
import { surveyRepo } from '../repositories/surveyRepo.js';
import { missionsForAgent } from '../agents/missions.js';
import { gameRepo } from '../repositories/gameRepo.js';
import { accountRepo } from '../repositories/accountRepo.js';
import { contractRepo } from '../repositories/contractRepo.js';

const router = express.Router();
router.use(authenticateToken);

// `next` must be forwarded: this wraps middleware as well as handlers, and the
// permission gate below calls next() to let an allowed request through. Without
// it, every *permitted* agent chat died with "next is not a function" — the
// denied path returned 403 before reaching next(), so the tests stayed green.
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
});

// Assemble the data each agent's brain / missions need.
async function contextFor(agentKey, user) {
    const ctx = { fx: config.fxUsdInr, records: [], contracts: [] };
    if (agentKey === 'aukat' || agentKey === 'aura' || agentKey === 'neo') ctx.records = await accountRepo.list(user);
    if (agentKey === 'aura' || agentKey === 'neo') ctx.contracts = await contractRepo.list({}, user);
    if (agentKey === 'pilot' || agentKey === 'neo') ctx.onboardings = await onboardingRepo.list(user);
    if (agentKey === 'medic' || agentKey === 'neo') ctx.tickets = await supportRepo.list(user);
    if (agentKey === 'sensei' || agentKey === 'neo') {
        ctx.sessions = await trainingRepo.list(user);
        ctx.revenue = await trainingRepo.revenue(user);
        ctx.courseCount = (await trainingRepo.listCourses({ activeOnly: true })).length;
    }
    if (agentKey === 'pulse' || agentKey === 'neo') ctx.health = await healthRepo.accountHealth(user);
    if (agentKey === 'aria' || agentKey === 'neo') ctx.ebrCoverage = await ebrRepo.coverage(user);
    if (agentKey === 'echo' || agentKey === 'neo') {
        ctx.surveyStats = await surveyRepo.stats(user);
        ctx.detractors = await surveyRepo.detractors(user);
    }
    return ctx;
}

// Roster + the caller's per-agent progress — only the agents they may see.
router.get('/', wrap(async (req, res) => {
    const state = await gameRepo.getState(req.user.id);
    const allowed = await visibleAgents(req.user);
    const agents = allowed.map((a) => ({
        ...a,
        xp: state.agents[a.key]?.xp || 0,
        agentLevel: state.agents[a.key]?.level || 1,
        interactions: state.agents[a.key]?.interactions || 0
    }));
    res.json({ agents, routes: AGENT_BY_ROUTE, total: AGENTS.length });
}));

// Every /:key route below addresses one agent, so the permission check belongs
// here once — rather than repeated, and eventually forgotten, in each handler.
router.use('/:key', wrap(async (req, res, next) => {
    if (!getAgent(req.params.key)) return next(); // /state, /event — they guard themselves
    if (!(await canUseAgent(req.user, req.params.key))) {
        return res.status(403).json({ error: 'You do not have access to this agent' });
    }
    next();
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
    const brain = agent.key === 'neo' ? neoRespond
        : agent.key === 'aura' ? auraRespond
            : agent.key === 'pilot' ? pilotRespond
                : agent.key === 'medic' ? medicRespond
                    : agent.key === 'sensei' ? senseiRespond
                        : agent.key === 'pulse' ? pulseRespond
                            : agent.key === 'aria' ? ariaRespond
                                : agent.key === 'echo' ? echoRespond
                                    : aukatRespond;
    const out = brain(message, ctx);
    const game = await gameRepo.award(req.user.id, { type: 'agent_query', agentKey: agent.key });

    res.json({ agent, reply: out.reply, chips: out.chips || [], game });
}));

export default router;
