import { api } from './client';

export const journeyApi = {
    meta: () => api.get('/journey/meta'),
    stats: () => api.get('/journey/stats'),
    map: () => api.get('/journey/map'),
    list: () => api.get('/journey'),
    get: (account) => api.get(`/journey/${encodeURIComponent(account)}`),
    set: (data) => api.post('/journey', data),
    update: (account, data) => api.patch(`/journey/${encodeURIComponent(account)}`, data),
    adoption: () => api.get('/journey/adoption'),
    setAdoption: (account, product_key, usage_score) => api.post('/journey/adoption', { account, product_key, usage_score }),
    setUserAdoption: (account, active_users, total_users) => api.post('/journey/user-adoption', { account, active_users, total_users }),
    seedSample: () => api.post('/journey/seed-sample', {})
};
