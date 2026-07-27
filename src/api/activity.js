import { api } from './client';

const qs = (params = {}) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== 'All') s.set(k, v);
    const str = s.toString();
    return str ? `?${str}` : '';
};

// Activity Log — merged human + agent audit (admin/manager only on the server).
export const activityApi = {
    meta: () => api.get('/activity/meta'),
    list: (filters) => api.get(`/activity${qs(filters)}`)
};
