import { api } from './client';

export const agentKeysApi = {
    // Agents I'm allowed to mint a key for, plus my admin-provisioned access
    // level: { agentAccess: 'none'|'read'|'write', canWrite, agents: [...] }.
    mintable: () => api.get('/agent-keys/mintable'),
    list: () => api.get('/agent-keys'),
    mint: (agent_key, label) => api.post('/agent-keys', { agent_key, label }),
    revoke: (id) => api.del(`/agent-keys/${id}`),
    sessions: () => api.get('/agent-keys/sessions'),
    audit: (limit = 60) => api.get(`/agent-keys/audit?limit=${limit}`),
    // The bundle carries every format, including the skill card as a string —
    // one call, then the console offers each for copy/download.
    manifest: (agent) => api.get(`/agent-keys/manifest?agent=${encodeURIComponent(agent)}&format=bundle`),
    // The write approval queue.
    proposals: (status) => api.get(`/agent-keys/proposals${status ? `?status=${status}` : ''}`),
    approveProposal: (id) => api.post(`/agent-keys/proposals/${id}/approve`, {}),
    rejectProposal: (id) => api.post(`/agent-keys/proposals/${id}/reject`, {})
};
