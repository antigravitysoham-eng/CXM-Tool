import { api } from './client';

export const journeyApi = {
    meta: () => api.get('/journey/meta'),
    stats: () => api.get('/journey/stats'),
    map: () => api.get('/journey/map'),
    list: () => api.get('/journey'),
    get: (account) => api.get(`/journey/${encodeURIComponent(account)}`),
    set: (data) => api.post('/journey', data),
    update: (account, data) => api.patch(`/journey/${encodeURIComponent(account)}`, data),
    seedSample: () => api.post('/journey/seed-sample', {})
};
