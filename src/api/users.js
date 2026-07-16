import { api } from './client';

export const usersApi = {
    list: () => api.get('/users'),
    meta: () => api.get('/users/meta'),
    create: (data) => api.post('/users', data),
    update: (id, data) => api.patch(`/users/${id}`, data),
    remove: (id) => api.del(`/users/${id}`),
    policies: () => api.get('/users/policies'),
    createPolicy: (data) => api.post('/users/policies', data),
    removePolicy: (id) => api.del(`/users/policies/${id}`)
};
