import { api } from './client';

const qs = (params = {}) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== 'All') s.set(k, v);
    const str = s.toString();
    return str ? `?${str}` : '';
};

export const documentsApi = {
    meta: () => api.get('/documents/meta'),
    list: (filters) => api.get(`/documents${qs(filters)}`),
    stats: (filters) => api.get(`/documents/stats${qs(filters)}`),
    history: (id) => api.get(`/documents/${id}/history`),
    create: (doc) => api.post('/documents', doc),
    update: (id, doc) => api.patch(`/documents/${id}`, doc),
    remove: (id) => api.del(`/documents/${id}`),

    // Downloads are authenticated, so a plain href won't do — the shared client
    // attaches the token and hands the browser a temporary object URL.
    download: (doc) => api.download(`/documents/${doc.id}/download`, doc.file_name || doc.name)
};

/** Reads a File into the base64 payload the upload endpoint expects. */
export function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]*;base64,/, ''));
        reader.onerror = () => reject(new Error('Could not read that file'));
        reader.readAsDataURL(file);
    });
}

export const formatBytes = (b) => {
    if (!b) return '—';
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1048576).toFixed(1)} MB`;
};
