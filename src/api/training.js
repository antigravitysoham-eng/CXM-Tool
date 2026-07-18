import { api } from './client';

const qs = (params = {}) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== 'All') s.set(k, v);
    const str = s.toString();
    return str ? `?${str}` : '';
};

export const trainingApi = {
    meta: () => api.get('/training/meta'),
    list: (filters) => api.get(`/training${qs(filters)}`),
    stats: (filters) => api.get(`/training/stats${qs(filters)}`),
    create: (data) => api.post('/training', data),
    update: (id, data) => api.patch(`/training/${id}`, data),
    remove: (id) => api.del(`/training/${id}`),
    seedSample: () => api.post('/training/seed-sample', {}),
    // Course catalogue.
    courses: (filters) => api.get(`/training/courses${qs(filters)}`),
    createCourse: (data) => api.post('/training/courses', data),
    updateCourse: (id, data) => api.patch(`/training/courses/${id}`, data),
    removeCourse: (id) => api.del(`/training/courses/${id}`)
};
