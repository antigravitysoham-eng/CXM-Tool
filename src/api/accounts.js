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
    setProductScope: (account, products) => api.put(`/accounts/product-scope/${encodeURIComponent(account)}`, { products })
};
