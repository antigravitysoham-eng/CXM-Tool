import { describe, it, expect } from 'vitest';

const API = 'http://localhost:5099/api';

const login = async (email, password) => (await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
})).json()).token;
const call = (t, p, opts = {}) => fetch(`${API}${p}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
});

describe('feature requests (Forge) — demand, RICE, board, ABAC', () => {
    it('all checks pass', async () => {
        const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

        const admin = await login('demo@example.com', 'password123');
        const rep = await login('priya@cashhorizon.io', 'demo1234');
        ok(admin && rep, 'admin + rep logins');

        const meta = await (await call(admin, '/feature-requests/meta')).json();
        ok(meta.statuses?.includes('Shipped') && meta.impacts?.includes('Critical') && meta.efforts?.includes('XL'), 'meta carries statuses, impacts, efforts');

        const customers = (await (await call(admin, '/accounts')).json()).filter((a) => a.segment === 'Customer');
        const acct = customers[0].name;

        // ---- create with high impact / low effort -> high RICE ----
        const f = await (await call(admin, '/feature-requests', { method: 'POST', body: JSON.stringify({ account: acct, title: 'API webhooks', impact: 'Critical', effort: 'S', product_area: 'Integrations' }) })).json();
        ok(f.id && f.rice > 0 && f.demand === 1, `created a request with a RICE score (${f.rice}) and base demand 1`);

        // ---- supporters raise demand + RICE ----
        if (customers.length > 1) {
            const withSup = await (await call(admin, `/feature-requests/${f.id}/supporters`, { method: 'POST', body: JSON.stringify({ account: customers[1].name }) })).json();
            ok(withSup.supporterCount === 1 && withSup.demand === 2, 'adding a supporter raises demand');
            // duplicate supporter is idempotent
            const dup = await (await call(admin, `/feature-requests/${f.id}/supporters`, { method: 'POST', body: JSON.stringify({ account: customers[1].name }) })).json();
            ok(dup.supporterCount === 1, 'a duplicate supporter is ignored');
        } else { ok(true, 'only one customer — skipping supporter test'); }

        // ---- votes raise demand ----
        const voted = await (await call(admin, `/feature-requests/${f.id}/vote`, { method: 'POST' })).json();
        ok(voted.votes === 1, 'a vote is recorded');

        // ---- a low-impact/high-effort request ranks below ----
        const low = await (await call(admin, '/feature-requests', { method: 'POST', body: JSON.stringify({ account: acct, title: 'Minor tweak', impact: 'Low', effort: 'XL' }) })).json();
        ok(low.rice < f.rice, 'low-impact/high-effort ranks below high-impact/low-effort (RICE)');

        // ---- list is RICE-ranked ----
        const list = await (await call(admin, '/feature-requests')).json();
        ok(list.length >= 2 && list[0].rice >= list[list.length - 1].rice, 'list is ranked by RICE');

        // ---- board groups by status ----
        const board = await (await call(admin, '/feature-requests/board')).json();
        ok(board.Requested && Array.isArray(board.Shipped), 'board is grouped by pipeline status');

        // ---- move to Shipped ----
        const shipped = await (await call(admin, `/feature-requests/${low.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'Shipped' }) })).json();
        ok(shipped.status === 'Shipped', 'a request can be moved to Shipped');

        // ---- stats ----
        const stats = await (await call(admin, '/feature-requests/stats')).json();
        ok(stats.total >= 2 && typeof stats.shippedRate === 'number' && Array.isArray(stats.topDemand), `stats: ${stats.total} total, ${stats.shippedRate}% shipped, ${stats.topDemand.length} top-demand`);

        // ---- ABAC ----
        const repAccts = (await (await call(rep, '/accounts')).json()).map((a) => a.name);
        const notMine = (await (await call(admin, '/accounts')).json()).map((a) => a.name).find((n) => !repAccts.includes(n));
        if (notMine) {
            const forbidden = await call(rep, '/feature-requests', { method: 'POST', body: JSON.stringify({ account: notMine, title: 'x' }) });
            ok(forbidden.status === 403, `rep cannot raise a request on an account they don't own (${forbidden.status})`);
        } else { ok(true, 'rep owns all accounts — skipping cross-account check'); }

        // ---- Forge agent: scoped, read-only ----
        const mint = await call(rep, '/agent-keys', { method: 'POST', body: JSON.stringify({ agent_key: 'forge', label: 'forge test' }) });
        ok(mint.status === 201, `rep can mint a Forge key (${mint.status})`);
        const minted = await mint.json();
        if (minted.secret) {
            const agentStats = await call(minted.secret, '/feature-requests/stats');
            ok(agentStats.status === 200, `Forge agent can read stats (${agentStats.status})`);
            const agentWrite = await call(minted.secret, '/feature-requests', { method: 'POST', body: JSON.stringify({ account: repAccts[0], title: 'x' }) });
            ok(agentWrite.status === 403, `read-only Forge agent cannot create a request (${agentWrite.status})`);
            await call(rep, `/agent-keys/${minted.id}`, { method: 'DELETE' });
        }

        expect(__fail, __fail.join('\n')).toEqual([]);
    });
});
