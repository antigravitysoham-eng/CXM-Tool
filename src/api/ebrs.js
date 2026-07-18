import { api } from './client';

const qs = (params = {}) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== 'All') s.set(k, v);
    const str = s.toString();
    return str ? `?${str}` : '';
};

export const ebrsApi = {
    meta: () => api.get('/ebrs/meta'),
    coverage: (quarter) => api.get(`/ebrs/coverage${qs({ quarter })}`),
    list: (filters) => api.get(`/ebrs${qs(filters)}`),
    get: (id) => api.get(`/ebrs/${id}`),
    generate: (account, quarter) => api.post('/ebrs/generate', { account, quarter }),
    generateAll: (quarter) => api.post('/ebrs/generate-all', { quarter }),
    update: (id, data) => api.patch(`/ebrs/${id}`, data),
    share: (id) => api.post(`/ebrs/${id}/share`, {}),
    remove: (id) => api.del(`/ebrs/${id}`)
};
