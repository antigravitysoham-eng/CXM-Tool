import { api } from './client';

const qs = (params = {}) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== 'All') s.set(k, v);
    const str = s.toString();
    return str ? `?${str}` : '';
};

export const supportApi = {
    meta: () => api.get('/support/meta'),
    list: (filters) => api.get(`/support${qs(filters)}`),
    stats: (filters) => api.get(`/support/stats${qs(filters)}`),
    create: (data) => api.post('/support', data),
    update: (id, data) => api.patch(`/support/${id}`, data),
    remove: (id) => api.del(`/support/${id}`),
    escalateCto: (id) => api.post(`/support/${id}/escalate-cto`, {}),
    seedSample: () => api.post('/support/seed-sample', {})
};
