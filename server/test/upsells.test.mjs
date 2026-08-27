import { describe, it, expect } from 'vitest';

const API = 'http://localhost:5099/api';

const login = async (email, password) => (await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
})).json()).token;
const call = (t, p, opts = {}) => fetch(`${API}${p}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
});

describe('upsells (Rainmaker) — weighted forecast, stage probability, ABAC', () => {
    it('all checks pass', async () => {
        const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

        const admin = await login('demo@example.com', 'password123');
        const rep = await login('priya@cashhorizon.io', 'demo1234');
        ok(admin && rep, 'admin + rep logins');

        const meta = await (await call(admin, '/upsells/meta')).json();
        ok(meta.stages?.includes('Won') && meta.types?.includes('Cross-sell') && meta.stageProbability?.Negotiation === 80, 'meta carries stages, types, stage probabilities');

        const customers = (await (await call(admin, '/accounts')).json()).filter((a) => a.segment === 'Customer');
        const acct = customers[0].name;

        // ---- create: probability follows stage; weighted = value x prob ----
        const e = await (await call(admin, '/upsells', { method: 'POST', body: JSON.stringify({ account: acct, title: 'Seat expansion', type: 'Seat expansion', value_amount: 1000000, currency: 'INR', stage: 'Proposed' }) })).json();
        ok(e.id && e.probability === 60, `stage Proposed sets probability 60 (${e.probability})`);
        ok(e.valueInr === 1000000 && e.weightedInr === 600000, `weighted forecast = value x probability (${e.weightedInr})`);

        // ---- moving stage pulls the new stage probability ----
        const moved = await (await call(admin, `/upsells/${e.id}`, { method: 'PATCH', body: JSON.stringify({ stage: 'Negotiation' }) })).json();
        ok(moved.probability === 80 && moved.weightedInr === 800000, 'moving to Negotiation raises probability to 80 and reweights');

        // ---- USD value is normalised to INR ----
        const usd = await (await call(admin, '/upsells', { method: 'POST', body: JSON.stringify({ account: acct, title: 'USD deal', value_amount: 10000, currency: 'USD', stage: 'Qualified' }) })).json();
        ok(usd.valueInr > usd.value_amount, 'a USD value is converted to INR for the forecast');

        // ---- won deal ----
        const won = await (await call(admin, '/upsells', { method: 'POST', body: JSON.stringify({ account: acct, title: 'Won deal', value_amount: 500000, currency: 'INR', stage: 'Won' }) })).json();
        ok(won.probability === 100, 'a Won deal is 100% probability');

        // ---- pipeline + stats ----
        const pipe = await (await call(admin, '/upsells/pipeline')).json();
        ok(pipe.Negotiation && typeof pipe.Negotiation.weighted === 'number', 'pipeline groups by stage with weighted totals');
        const stats = await (await call(admin, '/upsells/stats')).json();
        ok(stats.opportunities >= 3 && stats.weightedForecastInr > 0 && Array.isArray(stats.topDeals), `stats: ${stats.opportunities} opps, ${stats.weightedForecastInr} weighted`);
        ok(stats.wonInr >= 500000, 'won value is captured in stats');

        // ---- ABAC ----
        const repAccts = (await (await call(rep, '/accounts')).json()).map((a) => a.name);
        const notMine = (await (await call(admin, '/accounts')).json()).map((a) => a.name).find((n) => !repAccts.includes(n));
        if (notMine) {
            const forbidden = await call(rep, '/upsells', { method: 'POST', body: JSON.stringify({ account: notMine, title: 'x', value_amount: 1 }) });
            ok(forbidden.status === 403, `rep cannot create an expansion on an account they don't own (${forbidden.status})`);
        } else { ok(true, 'rep owns all accounts — skipping cross-account check'); }

        // ---- Rainmaker agent: scoped, read-only ----
        const mint = await call(rep, '/agent-keys', { method: 'POST', body: JSON.stringify({ agent_key: 'rainmaker', label: 'rain test' }) });
        ok(mint.status === 201, `rep can mint a Rainmaker key (${mint.status})`);
        const minted = await mint.json();
        if (minted.secret) {
            const agentStats = await call(minted.secret, '/upsells/stats');
            ok(agentStats.status === 200, `Rainmaker agent can read stats (${agentStats.status})`);
            const agentWrite = await call(minted.secret, '/upsells', { method: 'POST', body: JSON.stringify({ account: repAccts[0], title: 'x', value_amount: 1 }) });
            ok(agentWrite.status === 403, `read-only Rainmaker agent cannot create a deal (${agentWrite.status})`);
            await call(rep, `/agent-keys/${minted.id}`, { method: 'DELETE' });
        }

        expect(__fail, __fail.join('\n')).toEqual([]);
    });
});
