import { api } from './client';

// People-performance scorecards. Admin-only on the server (403 otherwise).
export const performanceApi = {
    csm: () => api.get('/performance/csm'),
    accountManagers: () => api.get('/performance/account-managers'),
    partners: () => api.get('/performance/partners')
};
