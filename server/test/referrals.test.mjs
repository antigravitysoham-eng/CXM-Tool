import { describe, it, expect } from 'vitest';

const API = 'http://localhost:5099/api';

const login = async (email, password) => (await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
})).json()).token;
const call = (t, p, opts = {}) => fetch(`${API}${p}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
});

describe('referrals (Magnet) — advocacy, conversion, rewards, ABAC', () => {
    it('all checks pass', async () => {
        const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

        const admin = await login('demo@example.com', 'password123');
        const rep = await login('priya@cashhorizon.io', 'demo1234');
        ok(admin && rep, 'admin + rep logins');

        const meta = await (await call(admin, '/referrals/meta')).json();
        ok(meta.statuses?.includes('Converted'), 'meta carries statuses');

        const customers = (await (await call(admin, '/accounts')).json()).filter((a) => a.segment === 'Customer');
        const acct = customers[0].name;

        // ---- create a referral, convert it ----
        const r = await (await call(admin, '/referrals', { method: 'POST', body: JSON.stringify({ account: acct, referred_name: 'Acme NBFC', value_amount: 2000000, currency: 'INR', reward: '1 month credit' }) })).json();
        ok(r.id && r.status === 'New' && r.valueInr === 2000000, `created a referral (status ${r.status})`);

        const conv = await (await call(admin, `/referrals/${r.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'Converted' }) })).json();
        ok(conv.status === 'Converted', 'a referral can be converted');

        // ---- advocate leaderboard ----
        const advocates = await (await call(admin, '/referrals/advocates')).json();
        ok(Array.isArray(advocates) && advocates.some((a) => a.account === acct && a.converted >= 1), 'the referring customer appears on the advocate leaderboard with a conversion');

        // ---- rewards owed until paid ----
        const stats1 = await (await call(admin, '/referrals/stats')).json();
        ok(stats1.rewardsOwed >= 1, 'a converted referral with an unpaid reward is owed');
        await call(admin, `/referrals/${r.id}`, { method: 'PATCH', body: JSON.stringify({ reward_paid: true }) });
        const stats2 = await (await call(admin, '/referrals/stats')).json();
        ok(stats2.rewardsOwed === stats1.rewardsOwed - 1, 'paying the reward clears it from owed');

        // ---- conversion rate ----
        await call(admin, '/referrals', { method: 'POST', body: JSON.stringify({ account: acct, referred_name: 'Declined Co', status: 'Declined' }) });
        const stats3 = await (await call(admin, '/referrals/stats')).json();
        ok(typeof stats3.conversionRate === 'number' && stats3.converted >= 1, `conversion rate computed (${stats3.conversionRate}%)`);

        // ---- ABAC ----
        const repAccts = (await (await call(rep, '/accounts')).json()).map((a) => a.name);
        const notMine = (await (await call(admin, '/accounts')).json()).map((a) => a.name).find((n) => !repAccts.includes(n));
        if (notMine) {
            const forbidden = await call(rep, '/referrals', { method: 'POST', body: JSON.stringify({ account: notMine, referred_name: 'x' }) });
            ok(forbidden.status === 403, `rep cannot log a referral for an account they don't own (${forbidden.status})`);
        } else { ok(true, 'rep owns all accounts — skipping cross-account check'); }

        // ---- Magnet agent: scoped, read-only ----
        const mint = await call(rep, '/agent-keys', { method: 'POST', body: JSON.stringify({ agent_key: 'magnet', label: 'magnet test' }) });
        ok(mint.status === 201, `rep can mint a Magnet key (${mint.status})`);
        const minted = await mint.json();
        if (minted.secret) {
            const agentStats = await call(minted.secret, '/referrals/stats');
            ok(agentStats.status === 200, `Magnet agent can read stats (${agentStats.status})`);
            const agentWrite = await call(minted.secret, '/referrals', { method: 'POST', body: JSON.stringify({ account: repAccts[0], referred_name: 'x' }) });
            ok(agentWrite.status === 403, `read-only Magnet agent cannot create a referral (${agentWrite.status})`);
            await call(rep, `/agent-keys/${minted.id}`, { method: 'DELETE' });
        }

        expect(__fail, __fail.join('\n')).toEqual([]);
    });
});
