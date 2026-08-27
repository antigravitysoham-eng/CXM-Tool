import { api } from './client';

const qs = (params = {}) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== 'All') s.set(k, v);
    const str = s.toString();
    return str ? `?${str}` : '';
};

export const eventsApi = {
    meta: () => api.get('/events/meta'),
    stats: () => api.get('/events/stats'),
    list: (filters) => api.get(`/events${qs(filters)}`),
    create: (data) => api.post('/events', data),
    update: (id, data) => api.patch(`/events/${id}`, data),
    remove: (id) => api.del(`/events/${id}`),
    seedSample: () => api.post('/events/seed-sample', {})
};
