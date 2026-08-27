import { api } from './client';

export const telegramApi = {
    status: () => api.get('/telegram/status'),
    linkCode: () => api.post('/telegram/link-code'),
    unlink: (telegramId) => api.del(`/telegram/unlink/${encodeURIComponent(telegramId)}`)
};
