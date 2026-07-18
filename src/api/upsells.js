import { api } from './client';

const qs = (params = {}) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== 'All') s.set(k, v);
    const str = s.toString();
    return str ? `?${str}` : '';
};

export const upsellsApi = {
    meta: () => api.get('/upsells/meta'),
    stats: () => api.get('/upsells/stats'),
    pipeline: () => api.get('/upsells/pipeline'),
    list: (filters) => api.get(`/upsells${qs(filters)}`),
    get: (id) => api.get(`/upsells/${id}`),
    create: (data) => api.post('/upsells', data),
    update: (id, data) => api.patch(`/upsells/${id}`, data),
    remove: (id) => api.del(`/upsells/${id}`),
    seedSample: () => api.post('/upsells/seed-sample', {})
};
