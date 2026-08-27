import { describe, it, expect } from 'vitest';

const API = 'http://localhost:5099/api';

const login = async (email, password) => (await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
})).json()).token;
const call = (t, p, opts = {}) => fetch(`${API}${p}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
});

describe('EBRs (Aria) — platform-generated quarterly reviews, sharing, ABAC', () => {
    it('all checks pass', async () => {
        const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

        const admin = await login('demo@example.com', 'password123');
        const rep = await login('priya@cashhorizon.io', 'demo1234');
        ok(admin && rep, 'admin + rep logins');

        // ---- meta ----
        const meta = await (await call(admin, '/ebrs/meta')).json();
        ok(meta.statuses?.includes('Shared') && /^\d{4}-Q[1-4]$/.test(meta.currentQuarter) && meta.quarters?.length >= 1,
            `meta carries statuses, quarters and current quarter (${meta.currentQuarter})`);
        const Q = meta.currentQuarter;

        // ---- a customer to review ----
        const customers = (await (await call(admin, '/accounts')).json()).filter((a) => a.segment === 'Customer');
        ok(customers.length > 0, 'there are customer accounts to review');
        const acct = customers[0].name;

        // ---- generate ONE from platform data ----
        const gen = await (await call(admin, '/ebrs/generate', { method: 'POST', body: JSON.stringify({ account: acct, quarter: Q }) })).json();
        ok(gen.id && gen.status === 'Generated', `generated an EBR for ${acct} (status ${gen.status})`);
        ok(gen.metrics && typeof gen.metrics.arrInr === 'number' && gen.metrics.tier,
            'the EBR carries a platform metrics snapshot (ARR, tier)');
        ok(Array.isArray(gen.insights) && Array.isArray(gen.improvements) && (gen.insights.length + gen.improvements.length) > 0,
            `insights + areas for improvement were synthesised (${gen.insights.length} / ${gen.improvements.length})`);
        ok(typeof gen.summary === 'string' && gen.summary.includes(acct), 'the EBR has an executive summary naming the account');

        // ---- generating a non-customer is refused ----
        const prospect = (await (await call(admin, '/accounts')).json()).find((a) => a.segment !== 'Customer');
        if (prospect) {
            const bad = await call(admin, '/ebrs/generate', { method: 'POST', body: JSON.stringify({ account: prospect.name, quarter: Q }) });
            ok(bad.status === 404, `EBRs are customers-only — generating for a ${prospect.segment} is refused (${bad.status})`);
        } else {
            ok(true, 'no non-customer account to probe the customers-only rule — skipped');
        }

        // ---- share it ----
        const shared = await (await call(admin, `/ebrs/${gen.id}/share`, { method: 'POST' })).json();
        ok(shared.status === 'Shared' && shared.shared_at, 'sharing marks the EBR Shared with a timestamp');

        // ---- regenerating supersedes the snapshot and resets to Generated ----
        const regen = await (await call(admin, '/ebrs/generate', { method: 'POST', body: JSON.stringify({ account: acct, quarter: Q }) })).json();
        ok(regen.id === gen.id && regen.status === 'Generated' && !regen.shared_at,
            'regenerating supersedes the shared snapshot (back to Generated, share cleared)');

        // ---- curator edits ----
        const edited = await (await call(admin, `/ebrs/${gen.id}`, { method: 'PATCH', body: JSON.stringify({ insights: ['Manually curated highlight'] }) })).json();
        ok(edited.insights.length === 1 && edited.insights[0] === 'Manually curated highlight', 'a curator can edit the insights on top of the snapshot');

        // ---- generate for EVERY customer (the quarterly run) ----
        const all = await (await call(admin, '/ebrs/generate-all', { method: 'POST', body: JSON.stringify({ quarter: Q }) })).json();
        ok(all.generated === customers.length && all.quarter === Q, `generate-all built an EBR for every customer (${all.generated}/${customers.length})`);

        // ---- coverage board ----
        const cov = await (await call(admin, `/ebrs/coverage?quarter=${Q}`)).json();
        ok(cov.customers === customers.length && cov.generated === customers.length && cov.notStarted === 0,
            `coverage board: ${cov.generated}/${cov.customers} generated, ${cov.notStarted} not started`);
        ok(Array.isArray(cov.rows) && cov.rows.every((r) => 'status' in r && 'account' in r), 'coverage rows carry per-customer status');

        // ---- list + filter ----
        const list = await (await call(admin, `/ebrs?quarter=${Q}`)).json();
        ok(list.length === customers.length, `list returns the quarter's EBRs (${list.length})`);

        // ---- ABAC both ways ----
        const repAccts = (await (await call(rep, '/accounts')).json()).map((a) => a.name);
        const repList = await (await call(rep, `/ebrs?quarter=${Q}`)).json();
        ok(repList.every((e) => repAccts.includes(e.account)), 'a rep sees only EBRs on accounts they own');

        const adminAccts = (await (await call(admin, '/accounts')).json()).map((a) => a.name);
        const notMine = adminAccts.find((n) => !repAccts.includes(n));
        if (notMine) {
            const forbidden = await call(rep, '/ebrs/generate', { method: 'POST', body: JSON.stringify({ account: notMine, quarter: Q }) });
            ok(forbidden.status === 403, `rep cannot generate an EBR for an account they don't own (${forbidden.status})`);
        } else {
            ok(true, 'rep owns all accounts — skipping cross-account generate check');
        }

        // ---- Aria agent: scoped, read-only ----
        const mintRes = await call(rep, '/agent-keys', { method: 'POST', body: JSON.stringify({ agent_key: 'aria', label: 'ebr test' }) });
        ok(mintRes.status === 201, `rep can mint an Aria key (EBR agent is online) (${mintRes.status})`);
        const minted = await mintRes.json();
        if (minted.secret) {
            const agentCov = await call(minted.secret, '/ebrs/coverage');
            ok(agentCov.status === 200, `Aria agent can read the coverage board (${agentCov.status})`);
            const agentWrite = await call(minted.secret, '/ebrs/generate', { method: 'POST', body: JSON.stringify({ account: repAccts[0], quarter: Q }) });
            ok(agentWrite.status === 403, `read-only Aria agent cannot generate an EBR (${agentWrite.status})`);
            await call(rep, `/agent-keys/${minted.id}`, { method: 'DELETE' });
        }

        expect(__fail, __fail.join('\n')).toEqual([]);
    });
});
