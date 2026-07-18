import { canUseModule } from '../services/policyService.js';
// The agent roster. NEO (global orchestrator) + one specialist per module.
// `online: true` = the agent's brain and module are live. The rest appear in
// Agent HQ as "coming online" and unlock as we build their modules.

export const AGENTS = [
    {
        key: 'neo', name: 'NEO', scope: 'global', module: null,
        emoji: '🧠', color: '#6366f1',
        tagline: 'Sees the whole board.',
        personality: 'Calm, strategic mission-control. Briefs you and routes work to the right specialist.',
        // '*' = every module the granting user can reach — NEO is the orchestrator.
        online: true, apiScope: '*'
    },
    {
        key: 'aukat', name: 'Aukat', scope: 'module', module: 'accounts', policy: 'accounts',
        emoji: '💰', color: '#f59e0b',
        tagline: "Knows every deal's worth.",
        personality: "Sharp closer's instinct. Blunt about weak deals, relentless about the pipeline.",
        online: true, apiScope: ['accounts']
    },
    {
        key: 'aura', name: 'AURA', scope: 'module', module: 'clm', policy: 'contracts',
        emoji: '🔮', color: '#a855f7',
        tagline: 'Sees every renewal coming.',
        personality: 'Serene and far-seeing. Reads a customer’s whole contract lifecycle and warns you before renewals slip.',
        online: true, apiScope: ['contracts', 'invoices']
    },
    {
        key: 'doxy', name: 'DOXY', scope: 'module', module: 'documents', policy: 'contracts',
        emoji: '🗂️', color: '#38bdf8',
        tagline: 'Keeps every paper straight.',
        personality: 'Meticulous archivist. Knows which version was signed, by whom, and where the countersigned copy went.',
        online: true, apiScope: ['documents']
    },
    {
        key: 'pilot', name: 'Pilot', scope: 'module', module: 'onboarding', policy: 'onboarding',
        emoji: '🚀', color: '#10b981',
        tagline: 'From kickoff to launch.',
        personality: 'Unflappable flight director. Counts down to go-live, and says plainly which stage is slipping and who is holding it.',
        online: true, apiScope: ['onboarding']
    },
    {
        key: 'sensei', name: 'Sensei', scope: 'module', module: 'training', policy: 'training',
        emoji: '🥋', color: '#a855f7',
        tagline: 'Turns users into masters.',
        personality: 'Patient, exacting teacher. Tracks who’s enrolled, who finished, who’s certified — and names the accounts drifting through training without ever landing it.',
        online: true, apiScope: ['training']
    },
    {
        key: 'pulse', name: 'Pulse', scope: 'module', module: 'health-checks', policy: 'health-checks',
        emoji: '💓', color: '#ef4444',
        tagline: 'Feels every heartbeat.',
        personality: 'Attentive and early-warning. Watches the cadence clock by support tier, reads the room from each call summary, and flags a customer turning amber before it turns red.',
        online: true, apiScope: ['health-checks']
    },
    { key: 'aria', name: 'Aria', scope: 'module', module: 'ebrs', policy: 'ebrs', emoji: '🎯', color: '#8b5cf6', tagline: 'Owns the boardroom.', online: false },
    { key: 'echo', name: 'Echo', scope: 'module', module: 'surveys', policy: 'surveys', emoji: '📣', color: '#14b8a6', tagline: 'Hears what customers feel.', online: false },
    { key: 'compass', name: 'Compass', scope: 'module', module: 'journey', policy: 'journey', emoji: '🧭', color: '#3b82f6', tagline: 'Maps every journey.', online: false },
    {
        key: 'medic', name: 'Medic', scope: 'module', module: 'support', policy: 'support',
        emoji: '🚑', color: '#f43f5e',
        tagline: 'First on the scene.',
        personality: 'Calm triage under pressure. Watches the SLA clock, calls the breach before it happens, and says plainly which ticket to grab next and why.',
        online: true, apiScope: ['support']
    },
    { key: 'forge', name: 'Forge', scope: 'module', module: 'feature-requests', policy: 'feature-requests', emoji: '🔧', color: '#eab308', tagline: 'Shapes the roadmap.', online: false },
    { key: 'rainmaker', name: 'Rainmaker', scope: 'module', module: 'upsells', policy: 'upsells', emoji: '🌧️', color: '#22c55e', tagline: 'Makes it pour revenue.', online: false },
    { key: 'herald', name: 'Herald', scope: 'module', module: 'comms', policy: 'comms', emoji: '📯', color: '#06b6d4', tagline: 'Every message lands.', online: false },
    { key: 'ringmaster', name: 'Ringmaster', scope: 'module', module: 'events', policy: 'events', emoji: '🎪', color: '#ec4899', tagline: 'Runs the whole show.', online: false },
    { key: 'magnet', name: 'Magnet', scope: 'module', module: 'referrals', policy: 'referrals', emoji: '🧲', color: '#f97316', tagline: 'Pulls in advocates.', online: false }
];

export const AGENTS_BY_KEY = Object.fromEntries(AGENTS.map((a) => [a.key, a]));

export function getAgent(key) {
    return AGENTS_BY_KEY[key] || null;
}

/**
 * The agents this user is allowed to see.
 *
 * An agent is a face on a module, so it follows that module's permissions: no
 * rights to the module, no agent. NEO is the exception — it is global, and can
 * only ever surface data the caller could already read.
 *
 * Single source of truth: every surface that lists agents (Agent HQ, the GPT
 * view, the relay) must go through this, or they will disagree with each other.
 */
export async function visibleAgents(user) {
    const out = [];
    for (const a of AGENTS) {
        if (await canUseModule(user, a.policy)) out.push(a);
    }
    return out;
}

export async function canUseAgent(user, key) {
    const agent = getAgent(key);
    if (!agent) return false;
    return canUseModule(user, agent.policy);
}

/**
 * The API path segments an agent identity may touch — its ceiling, gate 2 of
 * the three. '*' (NEO) means every segment the granting user can already reach.
 * An offline agent has no scope: it can't be minted a key.
 */
export function apiScopeFor(key) {
    const agent = getAgent(key);
    if (!agent || !agent.online) return [];
    return agent.apiScope || [];
}

export function agentCanReachSegment(key, segment) {
    const scope = apiScopeFor(key);
    return scope === '*' || (Array.isArray(scope) && scope.includes(segment));
}

// Route path -> the agent that owns it (used by the frontend dock).
export const AGENT_BY_ROUTE = Object.fromEntries(
    AGENTS.filter((a) => a.module).map((a) => [a.module, a.key])
);
