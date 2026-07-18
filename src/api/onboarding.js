import { api } from './client';

const qs = (params = {}) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== 'All') s.set(k, v);
    const str = s.toString();
    return str ? `?${str}` : '';
};

export const onboardingApi = {
    meta: () => api.get('/onboarding/meta'),
    stats: () => api.get('/onboarding/stats'),
    list: (filters) => api.get(`/onboarding${qs(filters)}`),
    get: (id) => api.get(`/onboarding/${id}`),
    // Returns null rather than throwing: "no onboarding yet" is the normal case
    // in CLM, not an error worth a red box.
    byAccount: (account) => api.get(`/onboarding/by-account/${encodeURIComponent(account)}`).catch(() => null),
    start: (data) => api.post('/onboarding', data),
    update: (id, data) => api.patch(`/onboarding/${id}`, data),
    // Board move: place an onboarding at a delivery stage (or the Live column).
    move: (id, stage) => api.patch(`/onboarding/${id}/move`, { stage }),
    activity: (id, limit = 50) => api.get(`/onboarding/${id}/activity?limit=${limit}`),
    recentActivity: (limit = 30) => api.get(`/onboarding/activity?limit=${limit}`),
    updateStage: (stageId, data) => api.patch(`/onboarding/stages/${stageId}`, data),
    addTask: (id, data) => api.post(`/onboarding/${id}/tasks`, data),
    updateTask: (taskId, data) => api.patch(`/onboarding/tasks/${taskId}`, data),
    removeTask: (taskId) => api.del(`/onboarding/tasks/${taskId}`),
    remove: (id) => api.del(`/onboarding/${id}`)
};
