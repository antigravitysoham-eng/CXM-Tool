import { api } from './client';

export const dashboardApi = {
    overview: () => api.get('/dashboard/overview'),
    // The rows behind one headline tile — what it means, how it is derived, and
    // which records it was read from.
    explain: (key) => api.get(`/dashboard/explain/${key}`)
};
