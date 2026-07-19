import { describe, it, expect } from 'vitest';

const API = 'http://localhost:5099/api';

const login = async (email, password) => (await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
})).json()).token;
const call = (t, p, opts = {}) => fetch(`${API}${p}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
});

describe('journey (Compass) — lifecycle map, stages, ABAC', () => {
    it('all checks pass', async () => {
        const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

        const admin = await login('demo@example.com', 'password123');
        const rep = await login('priya@cashhorizon.io', 'demo1234');
        ok(admin && rep, 'admin + rep logins');

        const meta = await (await call(admin, '/journey/meta')).json();
        ok(meta.stages?.includes('Advocacy') && meta.path?.[0] === 'Onboarding', 'meta carries stages + the lifecycle path');

        // ---- every customer appears on the map (even unmapped) ----
        const list = await (await call(admin, '/journey')).json();
        const customers = (await (await call(admin, '/accounts')).json()).filter((a) => a.segment === 'Customer');
        ok(Array.isArray(list) && list.length === customers.length, `every customer is on the map (${list.length})`);
        ok(list.every((j) => 'stage' in j && 'daysInStage' in j && 'progress' in j), 'each carries stage, days-in-stage and progress');

        const acct = customers[0].name;

        // ---- set a stage (upsert) ----
        const set = await (await call(admin, '/journey', { method: 'POST', body: JSON.stringify({ account: acct, stage: 'Value', health: 'Good', note: 'Hit first value' }) })).json();
        ok(set.account === acct && set.stage === 'Value' && set.set === true && set.progress > 0, `set ${acct} to Value (progress ${set.progress}%)`);

        // ---- a milestone event is logged on stage change ----
        const detail = await (await call(admin, `/journey/${encodeURIComponent(acct)}`)).json();
        ok(Array.isArray(detail.events) && detail.events.some((e) => e.stage === 'Value'), 'a milestone event was logged for the stage change');

        // ---- moving stage re-stamps entered_at (days-in-stage resets) ----
        const moved = await (await call(admin, `/journey/${encodeURIComponent(acct)}`, { method: 'PATCH', body: JSON.stringify({ stage: 'Growth' }) })).json();
        ok(moved.stage === 'Growth' && moved.daysInStage === 0, 'moving stage resets days-in-stage');

        // ---- map groups by stage ----
        const map = await (await call(admin, '/journey/map')).json();
        ok(map.Growth && Array.isArray(map.Onboarding), 'map is grouped by lifecycle stage');

        // ---- stats ----
        const stats = await (await call(admin, '/journey/stats')).json();
        ok(stats.customers === customers.length && typeof stats.avgProgress === 'number' && stats.byStage, `stats: ${stats.customers} customers, ${stats.avgProgress}% avg progress`);

        // ---- ABAC ----
        const repAccts = (await (await call(rep, '/accounts')).json()).map((a) => a.name);
        const notMine = customers.map((a) => a.name).find((n) => !repAccts.includes(n));
        if (notMine) {
            const forbidden = await call(rep, '/journey', { method: 'POST', body: JSON.stringify({ account: notMine, stage: 'Value' }) });
            ok(forbidden.status === 403, `rep cannot set a journey for an account they don't own (${forbidden.status})`);
        } else { ok(true, 'rep owns all accounts — skipping cross-account check'); }

        // ---- module adoption ----
        const setAd = await call(admin, '/journey/adoption', { method: 'POST', body: JSON.stringify({ account: acct, product_key: 'interno', usage_score: 90 }) });
        const adBoard = await setAd.json();
        ok(setAd.status === 200 && adBoard.accounts && adBoard.modules && adBoard.summary, 'setting adoption returns the adoption board');
        const acctRow = adBoard.accounts.find((a) => a.account === acct);
        ok(acctRow && acctRow.modules.some((m) => m.product_key === 'interno' && m.usageScore === 90 && m.band === 'Power user'),
            'a 90 usage score reads back as a Power user band on the customer');
        ok(adBoard.modules.some((m) => m.product_key === 'interno' && m.avgUsage >= 1), 'the module appears in the portfolio usage rollup');

        // low score -> dormant, surfaced for health-check focus
        await call(admin, '/journey/adoption', { method: 'POST', body: JSON.stringify({ account: acct, product_key: 'conformity', usage_score: 5 }) });
        const ad2 = await (await call(admin, '/journey/adoption')).json();
        const row2 = ad2.accounts.find((a) => a.account === acct);
        ok(row2.modules.some((m) => m.product_key === 'conformity' && m.band === 'Dormant'), 'a 5 usage score is Dormant');
        ok(typeof ad2.summary.dormantModules === 'number' && ad2.summary.dormantModules >= 1, 'dormant modules are counted in the summary');

        // ABAC + validation
        ok((await call(admin, '/journey/adoption', { method: 'POST', body: JSON.stringify({ account: acct, product_key: 'not_a_module', usage_score: 50 }) })).status === 404, 'an unknown module is rejected');
        if (notMine) {
            const f = await call(rep, '/journey/adoption', { method: 'POST', body: JSON.stringify({ account: notMine, product_key: 'interno', usage_score: 50 }) });
            ok(f.status === 403, `rep cannot set adoption for an account they don't own (${f.status})`);
        } else { ok(true, 'rep owns all accounts — skipping adoption cross-account check'); }

        // ---- Compass agent: scoped, read-only ----
        const mint = await call(rep, '/agent-keys', { method: 'POST', body: JSON.stringify({ agent_key: 'compass', label: 'compass test' }) });
        ok(mint.status === 201, `rep can mint a Compass key (${mint.status})`);
        const minted = await mint.json();
        if (minted.secret) {
            const agentStats = await call(minted.secret, '/journey/stats');
            ok(agentStats.status === 200, `Compass agent can read stats (${agentStats.status})`);
            const agentWrite = await call(minted.secret, '/journey', { method: 'POST', body: JSON.stringify({ account: repAccts[0], stage: 'Value' }) });
            ok(agentWrite.status === 403, `read-only Compass agent cannot set a journey (${agentWrite.status})`);
            await call(rep, `/agent-keys/${minted.id}`, { method: 'DELETE' });
        }

        expect(__fail, __fail.join('\n')).toEqual([]);
    });
});
