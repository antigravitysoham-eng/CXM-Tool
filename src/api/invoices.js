import { api } from './client';

const qs = (params = {}) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== 'All') s.set(k, v);
    const str = s.toString();
    return str ? `?${str}` : '';
};

export const invoicesApi = {
    meta: () => api.get('/invoices/meta'),
    list: (filters) => api.get(`/invoices${qs(filters)}`),
    stats: (filters) => api.get(`/invoices/stats${qs(filters)}`),
    create: (data) => api.post('/invoices', data),
    generate: (contractId) => api.post('/invoices/generate', { contract_id: contractId }),
    update: (id, data) => api.patch(`/invoices/${id}`, data),
    remove: (id) => api.del(`/invoices/${id}`),
    downloadFile: (inv) => api.download(`/invoices/${inv.id}/download`, inv.file_name || `${inv.invoice_no || 'invoice'}.pdf`)
};

export const scopeApi = {
    forContract: (id) => api.get(`/contracts/${id}/scope`),
    setForContract: (id, products) => api.put(`/contracts/${id}/scope`, { products }),
    forAccount: (account) => api.get(`/contracts/account-scope/${encodeURIComponent(account)}`)
};
