import { api } from './client';

const qs = (params = {}) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== 'All') s.set(k, v);
    const str = s.toString();
    return str ? `?${str}` : '';
};

export const referralsApi = {
    meta: () => api.get('/referrals/meta'),
    stats: () => api.get('/referrals/stats'),
    advocates: () => api.get('/referrals/advocates'),
    list: (filters) => api.get(`/referrals${qs(filters)}`),
    create: (data) => api.post('/referrals', data),
    update: (id, data) => api.patch(`/referrals/${id}`, data),
    remove: (id) => api.del(`/referrals/${id}`),
    nudges: () => api.get('/referrals/nudges'),
    addNudge: (data) => api.post('/referrals/nudges', data),
    seedSample: () => api.post('/referrals/seed-sample', {})
};
