import { api } from './client';

const qs = (params = {}) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== 'All') s.set(k, v);
    const str = s.toString();
    return str ? `?${str}` : '';
};

export const featuresApi = {
    meta: () => api.get('/feature-requests/meta'),
    stats: () => api.get('/feature-requests/stats'),
    board: () => api.get('/feature-requests/board'),
    list: (filters) => api.get(`/feature-requests${qs(filters)}`),
    get: (id) => api.get(`/feature-requests/${id}`),
    stageHistory: (id) => api.get(`/feature-requests/${id}/stage-history`),
    create: (data) => api.post('/feature-requests', data),
    update: (id, data) => api.patch(`/feature-requests/${id}`, data),
    remove: (id) => api.del(`/feature-requests/${id}`),
    vote: (id) => api.post(`/feature-requests/${id}/vote`, {}),
    addSupporter: (id, account) => api.post(`/feature-requests/${id}/supporters`, { account }),
    removeSupporter: (id, account) => api.del(`/feature-requests/${id}/supporters/${encodeURIComponent(account)}`),
    seedSample: () => api.post('/feature-requests/seed-sample', {})
};
