import { api } from './client';

const qs = (params = {}) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== 'All') s.set(k, v);
    const str = s.toString();
    return str ? `?${str}` : '';
};

export const commsApi = {
    meta: () => api.get('/comms/meta'),
    stats: () => api.get('/comms/stats'),
    list: (filters) => api.get(`/comms${qs(filters)}`),
    create: (data) => api.post('/comms', data),
    update: (id, data) => api.patch(`/comms/${id}`, data),
    send: (id, data) => api.post(`/comms/${id}/send`, data || {}),
    remove: (id) => api.del(`/comms/${id}`),
    seedSample: () => api.post('/comms/seed-sample', {})
};
