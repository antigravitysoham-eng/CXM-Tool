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
    removeCourse: (id) => api.del(`/training/courses/${id}`),
    // Roster + enrollments.
    trainees: (account) => api.get(`/training/trainees${qs({ account })}`),
    addTrainee: (data) => api.post('/training/trainees', data),
    removeTrainee: (id) => api.del(`/training/trainees/${id}`),
    trainers: () => api.get('/training/trainers'),
    addTrainer: (data) => api.post('/training/trainers', data),
    updateTrainer: (id, data) => api.patch(`/training/trainers/${id}`, data),
    removeTrainer: (id) => api.del(`/training/trainers/${id}`),
    available: (account) => api.get(`/training/available/${encodeURIComponent(account)}`),
    revenue: () => api.get('/training/revenue'),
    subscriptions: () => api.get('/training/subscriptions'),
    updateSubscription: (id, data) => api.patch(`/training/subscriptions/${id}`, data),
    activate: (account) => api.post(`/training/activate/${encodeURIComponent(account)}`, {}),
    enrollments: (filters) => api.get(`/training/enrollments${qs(filters)}`),
    enroll: (data) => api.post('/training/enrollments', data),
    updateEnrollment: (id, data) => api.patch(`/training/enrollments/${id}`, data),
    removeEnrollment: (id) => api.del(`/training/enrollments/${id}`)
};
