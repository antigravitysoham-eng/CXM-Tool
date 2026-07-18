import { describe, it, expect } from 'vitest';

const API = 'http://localhost:5099/api';

const login = async (email, password) => (await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
})).json()).token;
const call = (t, p, opts = {}) => fetch(`${API}${p}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
});

describe('training module — enablement funnel, clamping, ABAC', () => {
    it('all checks pass', async () => {
        const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

        const admin = await login('demo@example.com', 'password123');
        const rep = await login('priya@cashhorizon.io', 'demo1234');
        ok(admin && rep, 'admin + rep logins');

        // ---- meta ----
        const meta = await (await call(admin, '/training/meta')).json();
        ok(meta.statuses?.includes('Completed') && meta.formats?.includes('Webinar'), 'meta carries statuses + formats');

        // ---- seed ----
        const seed = await (await call(admin, '/training/seed-sample', { method: 'POST' })).json();
        ok(seed.seeded > 0, `admin seeded ${seed.seeded} sessions`);

        // ---- list carries derived rates ----
        const list = await (await call(admin, '/training')).json();
        ok(Array.isArray(list) && list.length >= seed.seeded, `list returns sessions (${list.length})`);
        const s0 = list[0];
        ok('completion_rate' in s0 && 'certification_rate' in s0 && 'stalled' in s0, 'each session carries derived rates + stalled flag');
        ok(list.some((s) => s.stalled), 'the sample set contains at least one stalled session');

        // ---- stats ----
        const stats = await (await call(admin, '/training/stats')).json();
        ok(typeof stats.enrolled === 'number' && typeof stats.completionRate === 'number' && Array.isArray(stats.underEnabledAccounts),
            `stats rollup: ${stats.enrolled} enrolled, ${stats.completionRate}% completion, ${stats.underEnabledAccounts.length} under-enabled`);
        ok(stats.completionRate >= 0 && stats.completionRate <= 100 && stats.certificationRate <= stats.completionRate,
            'rates are valid and certification ≤ completion');

        const acct = (await (await call(admin, '/accounts')).json())[0];

        // ---- funnel clamping: impossible funnel is clamped, not stored ----
        const bad = await (await call(admin, '/training', {
            method: 'POST', body: JSON.stringify({ title: 'Clamp probe', account: acct.name, enrolled: 10, completed: 99, certified: 50 })
        })).json();
        ok(bad.completed === 10 && bad.certified === 10, 'completed and certified are clamped to enrolled (10/10, not 99/50)');
        ok(bad.completion_rate === 100, 'clamped completion rate is 100%');

        // update with a partial funnel still clamps against the merged state
        const upd = await (await call(admin, `/training/${bad.id}`, { method: 'PATCH', body: JSON.stringify({ enrolled: 4 }) })).json();
        ok(upd.enrolled === 4 && upd.completed === 4 && upd.certified === 4, 'shrinking enrolled re-clamps completed + certified down');

        // ---- stalled derivation ----
        const stalledOne = await (await call(admin, '/training', {
            method: 'POST', body: JSON.stringify({ title: 'Abandoned course', account: acct.name, status: 'Delayed', enrolled: 8, completed: 0 })
        })).json();
        ok(stalledOne.stalled === true, 'a Delayed session with enrolments but zero completions is stalled');

        // ---- ABAC both ways ----
        const adminAccts = (await (await call(admin, '/accounts')).json()).map((a) => a.name);
        const repAccts = (await (await call(rep, '/accounts')).json()).map((a) => a.name);
        const repList = await (await call(rep, '/training')).json();
        ok(repList.every((s) => repAccts.includes(s.account)), 'a rep sees only sessions on accounts they own');

        const notMine = adminAccts.find((n) => !repAccts.includes(n));
        if (notMine) {
            const forbidden = await call(rep, '/training', { method: 'POST', body: JSON.stringify({ title: 'blocked', account: notMine }) });
            ok(forbidden.status === 403, `rep cannot create a session on an account they don't own (${forbidden.status})`);
        } else {
            ok(true, 'rep owns all accounts in this seed — skipping cross-account create check');
        }
        if (repAccts.length) {
            const mine = await call(rep, '/training', { method: 'POST', body: JSON.stringify({ title: 'rep own session', account: repAccts[0], enrolled: 5, completed: 3 }) });
            ok(mine.status === 201, `rep can create a session on their own account (${mine.status})`);
        }

        // ---- Sensei agent: scoped, read-only ----
        const senseiMint = await call(rep, '/agent-keys', { method: 'POST', body: JSON.stringify({ agent_key: 'sensei', label: 'training test' }) });
        ok(senseiMint.status === 201, `rep can mint a Sensei key (training agent is online) (${senseiMint.status})`);
        const minted = await senseiMint.json();
        if (minted.secret) {
            const agentList = await call(minted.secret, '/training');
            const agentSessions = await agentList.json();
            ok(agentList.status === 200 && Array.isArray(agentSessions) && agentSessions.every((s) => repAccts.includes(s.account)),
                "Sensei agent reads sessions, scoped to the rep who granted it");
            const agentWrite = await call(minted.secret, '/training', { method: 'POST', body: JSON.stringify({ title: 'agent write', account: repAccts[0] }) });
            ok(agentWrite.status === 403, `read-only Sensei agent cannot create a session (${agentWrite.status})`);
            await call(rep, `/agent-keys/${minted.id}`, { method: 'DELETE' });
        }

        expect(__fail, __fail.join('\n')).toEqual([]);
    });
});
