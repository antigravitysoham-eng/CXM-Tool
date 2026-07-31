import { api } from './client';

export const accountsApi = {
    list: () => api.get('/accounts'),
    meta: () => api.get('/accounts/meta'),
    create: (data) => api.post('/accounts', data),
    update: (id, data) => api.patch(`/accounts/${id}`, data),
    remove: (id) => api.del(`/accounts/${id}`),
    seedSample: () => api.post('/accounts/seed-sample'),
    // Account-level product scope (opted modules).
    productScope: (account) => api.get(`/accounts/product-scope/${encodeURIComponent(account)}`),
    setProductScope: (account, products) => api.put(`/accounts/product-scope/${encodeURIComponent(account)}`, { products }),
    // Stage trail + per-stage discussion log.
    stageHistory: (id) => api.get(`/accounts/${id}/stage-history`),
    discussions: (id) => api.get(`/accounts/${id}/discussions`),
    addDiscussion: (id, data) => api.post(`/accounts/${id}/discussions`, data),
    removeDiscussion: (discId) => api.del(`/accounts/discussions/${discId}`),
    // Partner Account Managers (PAMs) for a partner.
    managers: (partnerId) => api.get(`/accounts/${partnerId}/managers`),
    setManagers: (partnerId, managers) => api.put(`/accounts/${partnerId}/managers`, { managers })
};
