
import { describe, it, expect } from 'vitest';

describe('dms', () => {
  it('all checks pass', async () => {
    const API = 'http://localhost:5099/api';
    const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

    const login = async (email, password) => {
        const r = await fetch(`${API}/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const j = await r.json();
        return j.token;
    };

    const call = (t, path, opts = {}) => fetch(`${API}${path}`, {
        ...opts,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
    });

    const admin = await login('demo@example.com', 'password123');
    if (!admin) { console.log('FAIL  admin login'); throw new Error('fatal: ' + (typeof m !== 'undefined' ? m : 'setup')); }
    ok(admin, 'admin login');

    // meta
    const meta = await (await call(admin, '/documents/meta')).json();
    ok(meta.docTypes?.length > 10, `meta: ${meta.docTypes?.length} doc types, storage=${meta.storage?.driver} (${meta.storage?.description})`);

    // legacy contract docs migrated into the DMS
    const all = await (await call(admin, '/documents')).json();
    ok(Array.isArray(all) && all.length > 0, `migrated legacy docs into library: ${all.length} docs across ${new Set(all.map(d => d.account)).size} accounts`);
    ok(all.every(d => d.category), `every doc categorised (e.g. ${all[0]?.doc_type} -> ${all[0]?.category})`);

    // upload a real file
    const body = Buffer.from('%PDF-1.4 fake signed agreement for testing\n').toString('base64');
    const created = await (await call(admin, '/documents', {
        method: 'POST',
        body: JSON.stringify({
            account: 'Bajaj Finserv', doc_type: 'NDA', name: 'Mutual NDA 2026',
            description: 'Signed at kickoff', file_base64: body,
            file_name: 'nda-2026.pdf', mime: 'application/pdf'
        })
    })).json();
    ok(created.id && created.has_file && created.size > 0, `upload stored: id=${created.id} size=${created.size}B by=${created.uploaded_by} v=${created.version}`);

    // download round-trip
    const dl = await call(admin, `/documents/${created.id}/download`);
    const text = await dl.text();
    ok(dl.status === 200 && text.includes('fake signed agreement'), `download round-trips bytes (${dl.headers.get('content-type')}, ${dl.headers.get('content-disposition')})`);

    // version supersession
    const v2 = await (await call(admin, '/documents', {
        method: 'POST',
        body: JSON.stringify({
            account: 'Bajaj Finserv', doc_type: 'NDA', name: 'Mutual NDA 2026',
            file_base64: Buffer.from('v2 body').toString('base64'),
            file_name: 'nda-2026-v2.pdf', mime: 'application/pdf', replaces_id: created.id
        })
    })).json();
    ok(v2.version === 'v2', `new version auto-bumped v1 -> ${v2.version}`);

    const latest = await (await call(admin, '/documents?account=Bajaj%20Finserv')).json();
    ok(!latest.some(d => d.id === created.id) && latest.some(d => d.id === v2.id), 'superseded version hidden from library');
    const hist = await (await call(admin, `/documents/${v2.id}/history`)).json();
    ok(hist.length === 2, `history chain intact: ${hist.map(h => h.version).join(' <- ')}`);

    // filters
    const nda = await (await call(admin, '/documents?doc_type=NDA')).json();
    ok(nda.length >= 1 && nda.every(d => d.doc_type === 'NDA'), `filter by type: ${nda.length} NDA`);
    const search = await (await call(admin, '/documents?q=kickoff')).json();
    ok(search.length === 1, `search hits description: ${search.length}`);
    const stats = await (await call(admin, '/documents/stats')).json();
    ok(stats.total > 0, `stats: ${stats.total} docs / ${stats.files} files / ${stats.links} links / ${stats.bytes}B / ${stats.accounts} accounts`);

    // validation: neither file nor link
    const bad = await call(admin, '/documents', { method: 'POST', body: JSON.stringify({ account: 'Bajaj Finserv', name: 'x', doc_type: 'Other' }) });
    ok(bad.status === 400, `rejects doc with no file and no link (${bad.status})`);
    const badAcct = await call(admin, '/documents', { method: 'POST', body: JSON.stringify({ account: 'Nope Ltd', name: 'x', link: 'http://x' }) });
    ok(badAcct.status === 404, `rejects unknown account (${badAcct.status})`);

    // ---- ABAC: a rep must not see documents for accounts they cannot read ----
    const rep = await login('priya@cashhorizon.io', 'demo1234');
    if (rep) {
        const repAccts = await (await call(rep, '/accounts')).json();
        const repDocs = await (await call(rep, '/documents')).json();
        const repNames = new Set(repAccts.map(a => a.name));
        ok(repDocs.every(d => repNames.has(d.account)),
            `ABAC: rep sees ${repDocs.length} docs, all within their ${repAccts.length} accounts`);
        const forbidden = all.find(d => !repNames.has(d.account));
        if (forbidden) {
            const r = await call(rep, `/documents/${forbidden.id}/download`);
            ok(r.status === 403, `ABAC: rep download of out-of-scope doc blocked (${r.status})`);
            const del = await call(rep, `/documents/${forbidden.id}`, { method: 'DELETE' });
            ok(del.status === 403, `ABAC: rep delete of out-of-scope doc blocked (${del.status})`);
        } else console.log('SKIP  no out-of-scope doc to probe');
    } else console.log('SKIP  rep login');

    // cleanup
    const d1 = await call(admin, `/documents/${v2.id}`, { method: 'DELETE' });
    await call(admin, `/documents/${created.id}`, { method: 'DELETE' });
    ok(d1.status === 200, 'delete removes doc + blob');

    expect(__fail, __fail.join('\n')).toEqual([]);
  });
});
