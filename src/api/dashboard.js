import { api } from './client';

export const dashboardApi = {
    overview: () => api.get('/dashboard/overview')
};
