// The agent roster. NEO (global orchestrator) + one specialist per module.
// `online: true` = the agent's brain and module are live. The rest appear in
// Agent HQ as "coming online" and unlock as we build their modules.

export const AGENTS = [
    {
        key: 'neo', name: 'NEO', scope: 'global', module: null,
        emoji: '🧠', color: '#6366f1',
        tagline: 'Sees the whole board.',
        personality: 'Calm, strategic mission-control. Briefs you and routes work to the right specialist.',
        online: true
    },
    {
        key: 'aukat', name: 'Aukat', scope: 'module', module: 'accounts',
        emoji: '💰', color: '#f59e0b',
        tagline: "Knows every deal's worth.",
        personality: "Sharp closer's instinct. Blunt about weak deals, relentless about the pipeline.",
        online: true
    },
    {
        key: 'aura', name: 'AURA', scope: 'module', module: 'clm',
        emoji: '🔮', color: '#a855f7',
        tagline: 'Sees every renewal coming.',
        personality: 'Serene and far-seeing. Reads a customer’s whole contract lifecycle and warns you before renewals slip.',
        online: true
    },
    {
        key: 'doxy', name: 'DOXY', scope: 'module', module: 'documents',
        emoji: '🗂️', color: '#38bdf8',
        tagline: 'Keeps every paper straight.',
        personality: 'Meticulous archivist. Knows which version was signed, by whom, and where the countersigned copy went.',
        online: true
    },
    { key: 'pilot', name: 'Pilot', scope: 'module', module: 'onboarding', emoji: '🚀', color: '#10b981', tagline: 'From kickoff to launch.', online: false },
    { key: 'sensei', name: 'Sensei', scope: 'module', module: 'training', emoji: '🥋', color: '#a855f7', tagline: 'Turns users into masters.', online: false },
    { key: 'pulse', name: 'Pulse', scope: 'module', module: 'health-checks', emoji: '💓', color: '#ef4444', tagline: 'Feels every heartbeat.', online: false },
    { key: 'aria', name: 'Aria', scope: 'module', module: 'ebrs', emoji: '🎯', color: '#8b5cf6', tagline: 'Owns the boardroom.', online: false },
    { key: 'echo', name: 'Echo', scope: 'module', module: 'surveys', emoji: '📣', color: '#14b8a6', tagline: 'Hears what customers feel.', online: false },
    { key: 'compass', name: 'Compass', scope: 'module', module: 'journey', emoji: '🧭', color: '#3b82f6', tagline: 'Maps every journey.', online: false },
    { key: 'medic', name: 'Medic', scope: 'module', module: 'support', emoji: '🚑', color: '#f43f5e', tagline: 'First on the scene.', online: false },
    { key: 'forge', name: 'Forge', scope: 'module', module: 'feature-requests', emoji: '🔧', color: '#eab308', tagline: 'Shapes the roadmap.', online: false },
    { key: 'rainmaker', name: 'Rainmaker', scope: 'module', module: 'upsells', emoji: '🌧️', color: '#22c55e', tagline: 'Makes it pour revenue.', online: false },
    { key: 'herald', name: 'Herald', scope: 'module', module: 'comms', emoji: '📯', color: '#06b6d4', tagline: 'Every message lands.', online: false },
    { key: 'ringmaster', name: 'Ringmaster', scope: 'module', module: 'events', emoji: '🎪', color: '#ec4899', tagline: 'Runs the whole show.', online: false },
    { key: 'magnet', name: 'Magnet', scope: 'module', module: 'referrals', emoji: '🧲', color: '#f97316', tagline: 'Pulls in advocates.', online: false }
];

export const AGENTS_BY_KEY = Object.fromEntries(AGENTS.map((a) => [a.key, a]));

export function getAgent(key) {
    return AGENTS_BY_KEY[key] || null;
}

// Route path -> the agent that owns it (used by the frontend dock).
export const AGENT_BY_ROUTE = Object.fromEntries(
    AGENTS.filter((a) => a.module).map((a) => [a.module, a.key])
);
