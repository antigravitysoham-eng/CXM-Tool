import { api } from './client';

const qs = (params = {}) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== 'All') s.set(k, v);
    const str = s.toString();
    return str ? `?${str}` : '';
};

export const healthApi = {
    meta: () => api.get('/health-checks/meta'),
    stats: () => api.get('/health-checks/stats'),
    // Customer-health board — tier cadence, next-due/overdue, signal, actions.
    accounts: () => api.get('/health-checks/accounts'),
    // Call log + a single call.
    calls: (account) => api.get(`/health-checks/calls${qs({ account })}`),
    call: (id) => api.get(`/health-checks/calls/${id}`),
    logCall: (data) => api.post('/health-checks/calls', data),
    updateCall: (id, data) => api.patch(`/health-checks/calls/${id}`, data),
    removeCall: (id) => api.del(`/health-checks/calls/${id}`),
    // Actionables.
    addAction: (callId, data) => api.post(`/health-checks/calls/${callId}/actions`, data),
    updateAction: (id, data) => api.patch(`/health-checks/actions/${id}`, data),
    removeAction: (id) => api.del(`/health-checks/actions/${id}`),
    seedSample: () => api.post('/health-checks/seed-sample', {})
};
