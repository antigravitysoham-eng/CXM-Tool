import { api } from './client';

export const contractsApi = {
    customers: () => api.get('/contracts/customers'),
    meta: () => api.get('/contracts/meta'),
    list: () => api.get('/contracts'),
    customer360: (account) => api.get(`/contracts/customer-360/${encodeURIComponent(account)}`),
    renewalTriggers: () => api.get('/contracts/renewal-triggers'),
    create: (data) => api.post('/contracts', data),
    update: (id, data) => api.patch(`/contracts/${id}`, data),
    remove: (id) => api.del(`/contracts/${id}`),
    seedSample: () => api.post('/contracts/seed-sample'),
    assignmentAdvice: (body) => api.post('/contracts/assignment-advice', body),
    addDocument: (id, doc) => api.post(`/contracts/${id}/documents`, doc),
    removeDocument: (docId) => api.del(`/contracts/documents/${docId}`),
    addContact: (contact) => api.post('/contracts/contacts', contact),
    removeContact: (id) => api.del(`/contracts/contacts/${id}`)
};
