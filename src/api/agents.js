import { api } from './client';

export const agentsApi = {
    roster: () => api.get('/agents'),
    state: () => api.get('/agents/state'),
    ask: (key, message) => api.post(`/agents/${key}/ask`, { message }),
    missions: (key) => api.get(`/agents/${key}/missions`),
    event: (type, agentKey = null, points = null) => api.post('/agents/event', { type, agentKey, points }),
    listInstructions: (key) => api.get(`/agents/${key}/instructions`),
    addInstruction: (key, text) => api.post(`/agents/${key}/instructions`, { text }),
    // An agent's record: what it has been asked, how much it resolved, what it is
    // asked most, and the last dozen exchanges.
    profile: (key) => api.get(`/agents/${key}/profile`)
};

// Fire-and-forget XP event; also notifies the badge to refresh.
export async function fireEvent(type, agentKey = null, points = null) {
    try {
        const res = await agentsApi.event(type, agentKey, points);
        window.dispatchEvent(new CustomEvent('game-updated', { detail: res }));
        return res;
    } catch { /* gamification is best-effort */ return null; }
}
