import { api } from './client';

export const whatsappApi = {
    // { enabled, businessNumber, links: [{ phone, verified_at, last_seen_at }] }
    status: () => api.get('/whatsapp/status'),
    // { code, expiresAt, businessNumber }
    linkCode: () => api.post('/whatsapp/link-code'),
    links: () => api.get('/whatsapp/links'),
    unlink: (phone) => api.del(`/whatsapp/links/${encodeURIComponent(phone)}`),
    // Admin oversight: every verified number and who it belongs to.
    identities: () => api.get('/whatsapp/identities')
};
