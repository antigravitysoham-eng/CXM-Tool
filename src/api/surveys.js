import { api } from './client';

const qs = (params = {}) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== 'All') s.set(k, v);
    const str = s.toString();
    return str ? `?${str}` : '';
};

export const surveysApi = {
    meta: () => api.get('/surveys/meta'),
    stats: () => api.get('/surveys/stats'),
    detractors: () => api.get('/surveys/detractors'),
    list: (filters) => api.get(`/surveys${qs(filters)}`),
    get: (id) => api.get(`/surveys/${id}`),
    create: (data) => api.post('/surveys', data),
    update: (id, data) => api.patch(`/surveys/${id}`, data),
    send: (id, sent_count) => api.post(`/surveys/${id}/send`, { sent_count }),
    remove: (id) => api.del(`/surveys/${id}`),
    respond: (id, data) => api.post(`/surveys/${id}/responses`, data),
    removeResponse: (id) => api.del(`/surveys/responses/${id}`),
    seedSample: () => api.post('/surveys/seed-sample', {})
};
