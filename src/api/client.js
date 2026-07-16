// Central API client. Base URL comes from the environment so the app is
// deployable; falls back to the local backend in dev.
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function authHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, { method = 'GET', body } = {}) {
    const res = await fetch(`${BASE}/api${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.error || `Request failed (${res.status})`);
        err.status = res.status;
        throw err;
    }
    return data;
}

// Authenticated file download -> triggers a browser "Save as".
async function download(path, filename) {
    const res = await fetch(`${BASE}/api${path}`, { headers: authHeaders() });
    if (!res.ok) {
        let msg = 'Download failed';
        try { msg = (await res.json()).error || msg; } catch { /* binary/no body */ }
        throw new Error(msg);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export const api = {
    get: (p) => request(p),
    post: (p, b) => request(p, { method: 'POST', body: b }),
    patch: (p, b) => request(p, { method: 'PATCH', body: b }),
    del: (p) => request(p, { method: 'DELETE' }),
    download
};
