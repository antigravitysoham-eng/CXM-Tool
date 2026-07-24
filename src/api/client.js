/**
 * Where the API lives.
 *
 * An explicit VITE_API_URL always wins. Otherwise: when the page is served by
 * the API process itself — the production container, or a phone hitting this
 * machine's LAN address — the API is on the same origin, and hardcoding
 * localhost would point the phone at itself. Only the Vite dev server, which
 * runs on its own port, needs the localhost:5000 fallback.
 */
const BASE = import.meta.env.VITE_API_URL
    || (typeof window !== 'undefined' && !['5173', '5174'].includes(window.location.port)
        ? window.location.origin
        : 'http://localhost:5000');

function authHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Is this response saying the session is over, rather than refusing one thing?
 *
 * The distinction matters. The API answers 401 "Access denied" when no token
 * was sent, and 403 "Invalid token" when the JWT has expired or been tampered
 * with — both mean sign in again. But it also answers 403 for an ordinary ABAC
 * refusal ("Insufficient permissions", an account outside your scope), and
 * logging someone out for opening a record they cannot see would be worse than
 * the error itself.
 */
const isSessionOver = (status, message) =>
    status === 401 || (status === 403 && /invalid token|token expired|jwt expired/i.test(message || ''));

/**
 * Drop the dead session and send the user to sign in.
 *
 * Without this an expired token left every page fetching, failing and rendering
 * empty while localStorage still claimed a login — no error, no data, and no
 * route back except clearing site data by hand.
 */
function endSession() {
    localStorage.removeItem('token');
    if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login?expired=1');
    }
}

async function request(path, { method = 'GET', body } = {}) {
    const res = await fetch(`${BASE}/api${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        // The login call itself answers 401 on a wrong password — that is a form
        // error to show, not a session to tear down.
        if (isSessionOver(res.status, data.error) && !path.startsWith('/auth/login')) endSession();
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

// Authenticated fetch that returns a blob object URL for *inline* viewing
// (PDF in an iframe, image in an <img>) instead of forcing a download. Caller
// must URL.revokeObjectURL(url) when done. Returns { url, blob, mime }.
async function blobUrl(path) {
    const res = await fetch(`${BASE}/api${path}`, { headers: authHeaders() });
    if (!res.ok) {
        let msg = 'Could not load file';
        try { msg = (await res.json()).error || msg; } catch { /* binary/no body */ }
        throw new Error(msg);
    }
    const blob = await res.blob();
    return { url: URL.createObjectURL(blob), blob, mime: res.headers.get('content-type') || blob.type };
}

export const api = {
    get: (p) => request(p),
    post: (p, b) => request(p, { method: 'POST', body: b }),
    put: (p, b) => request(p, { method: 'PUT', body: b }),
    patch: (p, b) => request(p, { method: 'PATCH', body: b }),
    del: (p) => request(p, { method: 'DELETE' }),
    download,
    blobUrl
};
