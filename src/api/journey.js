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
    setUserModuleUsage: (data) => api.post('/journey/user-module-usage', data),
    seedSample: () => api.post('/journey/seed-sample', {}),
    // Extra value delivered (beyond scope) — logged per customer with a date + artifact.
    valueAdds: (account) => api.get(`/journey/${encodeURIComponent(account)}/value-adds`),
    addValueAdd: (account, data) => api.post(`/journey/${encodeURIComponent(account)}/value-adds`, data),
    removeValueAdd: (id) => api.del(`/journey/value-adds/${id}`),
    downloadArtifact: (v) => api.download(`/journey/value-adds/${v.id}/artifact`, v.artifact_name || 'artifact')
};
