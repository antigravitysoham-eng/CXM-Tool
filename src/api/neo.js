import { api } from './client';

export const neoApi = {
    meta: () => api.get('/neo/meta'),
    ask: (prompt) => api.post('/neo/ask', { prompt }),
    confirm: (proposal) => api.post('/neo/confirm', { proposal })
};
