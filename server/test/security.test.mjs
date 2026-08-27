
import { describe, it, expect } from 'vitest';

describe('security', () => {
  it('all checks pass', async () => {
    const API = 'http://localhost:5099/api';
    const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

    const login = async (email, password) => {
        const r = await fetch(`${API}/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        return (await r.json()).token;
    };
    const call = (t, path, opts = {}) => fetch(`${API}${path}`, {
        ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
    });

    const admin = await login('demo@example.com', 'password123');
    const rep = await login('priya@cashhorizon.io', 'demo1234');
    ok(admin && rep, 'logins');

    const repAccts = (await (await call(rep, '/accounts')).json()).map((a) => a.name);
    const adminAccts = (await (await call(admin, '/accounts')).json()).map((a) => a.name);

    // ---- the leak: contracts had no scoping at all ----
    const adminContracts = await (await call(admin, '/contracts')).json();
    const repContracts = await (await call(rep, '/contracts')).json();
    ok(repContracts.length < adminContracts.length,
        `contract list scoped: admin sees ${adminContracts.length}, rep sees ${repContracts.length}`);
    ok(repContracts.every((c) => repAccts.includes(c.account)),
        `every contract the rep sees belongs to an account they can read`);

    // direct fetch of an out-of-scope contract
    const hidden = adminContracts.find((c) => !repAccts.includes(c.account));
    if (hidden) {
        const r = await call(rep, `/contracts/${hidden.id}`);
        ok(r.status === 404 || r.status === 403, `out-of-scope contract ${hidden.id} refused (${r.status})`);
    } else console.log('SKIP  no out-of-scope contract to probe');

    // ---- the same leak via export/report, which read the same records ----
    const outOfScope = adminAccts.filter((n) => !repAccts.includes(n));
    for (const [label, path] of [['Excel export', '/data/contracts/export.xlsx'], ['PDF report', '/data/contracts/report.pdf']]) {
        const r = await call(rep, path);
        if (!r.ok) { console.log(`SKIP  ${label} returned ${r.status}`); continue; }
        const buf = Buffer.from(await r.arrayBuffer());
        // xlsx is a zip, so a name may not appear literally; a hit is still a definite leak.
        const leaked = outOfScope.filter((n) => buf.includes(Buffer.from(n)));
        ok(leaked.length === 0, `CLM ${label}: no out-of-scope account names in ${buf.length}B${leaked.length ? ` — LEAKED: ${leaked.join(', ')}` : ''}`);
    }

    // ---- agent permissions ----
    const adminAgents = (await (await call(admin, '/agents')).json());
    const repAgents = (await (await call(rep, '/agents')).json());
    ok(repAgents.agents.length < adminAgents.agents.length,
        `agent roster is permission-gated: admin ${adminAgents.agents.length}, rep ${repAgents.agents.length}`);
    const repKeys = repAgents.agents.map((a) => a.key);
    ok(repKeys.includes('neo') && repKeys.includes('aukat'), `rep keeps the agents they're entitled to: ${repKeys.join(', ')}`);

    // The permitted path matters as much as the denied one: only testing the 403
    // let a broken next() ship, which killed every *allowed* agent chat.
    for (const key of ['neo', 'aukat', 'aura', 'pilot']) {
        const r = await call(admin, `/agents/${key}/ask`, { method: 'POST', body: JSON.stringify({ message: 'status' }) });
        const j = await r.json().catch(() => ({}));
        ok(r.status === 200 && !!j.reply, `permitted agent ${key} answers (${r.status}) — ${String(j.reply || j.error).slice(0, 48)}…`);
        const m = await call(admin, `/agents/${key}/missions`);
        ok(m.status === 200, `permitted agent ${key} missions load (${m.status})`);
    }

    const denied = adminAgents.agents.find((a) => !repKeys.includes(a.key));
    if (denied) {
        const r = await call(rep, `/agents/${denied.key}/ask`, { method: 'POST', body: JSON.stringify({ message: 'hi' }) });
        ok(r.status === 403, `rep asking a forbidden agent (${denied.key}) blocked (${r.status})`);
        const m = await call(rep, `/agents/${denied.key}/missions`);
        ok(m.status === 403, `rep reading a forbidden agent's missions blocked (${m.status})`);
    } else console.log('SKIP  no denied agent to probe');

    // NEO's meta must never hand out the roster
    const meta = await (await call(rep, '/neo/meta')).json();
    ok(!('agents' in meta) && meta.neo, 'GPT view meta exposes NEO only, not the roster');

    // ---- unauthenticated access ----
    for (const p of ['/accounts', '/contracts', '/documents', '/agents', '/neo/meta', '/users']) {
        const r = await fetch(`${API}${p}`);
        ok(r.status === 401, `${p} rejects anonymous (${r.status})`);
    }

    // ---- a rep must not reach admin-only surfaces ----
    const uList = await call(rep, '/users');
    ok(uList.status === 403, `rep cannot list users (${uList.status})`);
    const pol = await call(rep, '/users/policies');
    ok(pol.status === 403, `rep cannot read policies (${pol.status})`);
    const seed = await call(rep, '/accounts/seed-sample', { method: 'POST' });
    ok(seed.status === 403, `rep cannot reseed sample data (${seed.status})`);

    // ---- tampered / forged tokens ----
    const badSig = admin.slice(0, -6) + 'aaaaaa';
    ok((await fetch(`${API}/accounts`, { headers: { Authorization: `Bearer ${badSig}` } })).status === 403,
        'tampered JWT signature rejected');
    const noneAlg = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
        + '.' + Buffer.from(JSON.stringify({ id: 1, role: 'admin' })).toString('base64url') + '.';
    ok((await fetch(`${API}/accounts`, { headers: { Authorization: `Bearer ${noneAlg}` } })).status === 403,
        'alg:none JWT rejected');

    // ================= Phase B hardening =================
    console.log('--- hardening ---');

    // legacy ABAC bypass must be gone
    const legacy = await call(rep, '/customers');
    ok(legacy.status === 404, `legacy /api/customers (ABAC bypass) removed (${legacy.status})`);

    // self-registration closed
    const reg = await fetch(`${API}/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'attacker2@evil.test', password: 'password123', name: 'A' })
    });
    ok(reg.status === 403, `anonymous self-registration refused (${reg.status})`);

    // integration secrets are admin-only
    const credsRep = await call(rep, '/connectivity/credentials');
    ok(credsRep.status === 403, `rep cannot read integration credentials (${credsRep.status})`);

    // security headers
    const h = await fetch(`${API}/health`);
    const hdr = (k) => h.headers.get(k);
    ok(h.status === 200, `health probe responds (${h.status})`);
    ok(!!hdr('x-content-type-options'), `X-Content-Type-Options: ${hdr('x-content-type-options')}`);
    ok(!!hdr('x-frame-options') || !!hdr('content-security-policy'), `clickjacking defence: X-Frame-Options=${hdr('x-frame-options')}`);
    ok(!hdr('x-powered-by'), `X-Powered-By hidden (${hdr('x-powered-by') || 'absent'})`);
    ok(!!hdr('ratelimit-limit') || !!hdr('x-ratelimit-limit'), `rate limit advertised: ${hdr('ratelimit-limit') || hdr('x-ratelimit-limit')}`);

    // unknown API path -> JSON 404, not the SPA
    const nf = await call(admin, '/definitely-not-a-route');
    ok(nf.status === 404 && (nf.headers.get('content-type') || '').includes('json'), `unknown /api path returns JSON 404 (${nf.status})`);

    // CORS is an allowlist, not "*"
    const evil = await fetch(`${API}/health`, { headers: { Origin: 'https://evil.example' } });
    ok(evil.headers.get('access-control-allow-origin') !== '*', `CORS does not echo *: ${evil.headers.get('access-control-allow-origin') || 'not allowed'}`);

    // Brute force gets throttled. Aimed at a throwaway identity, not a real one:
    // the per-account limiter is keyed on email, so hammering demo@example.com here
    // would lock out every later run of this suite.
    const victimEmail = `ratelimit-probe-${Date.now()}@example.test`;
    let throttled = 0;
    for (let i = 0; i < 14; i++) {
        const r = await fetch(`${API}/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: victimEmail, password: 'wrong-password' })
        });
        if (r.status === 429) throttled++;
    }
    ok(throttled > 0, `login brute force throttled after repeated failures (${throttled}/14 got 429)`);

    // ...and the throttling must be per-account, not per-IP: a colleague on the same
    // office gateway must still be able to log in while one account is under attack.
    const bystander = await fetch(`${API}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'priya@cashhorizon.io', password: 'demo1234' })
    });
    ok(bystander.status === 200, `attack on one account does not lock out others on the same IP (${bystander.status})`);

    expect(__fail, __fail.join('\n')).toEqual([]);
  });
});
