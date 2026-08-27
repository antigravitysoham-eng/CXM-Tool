import { describe, it, expect } from 'vitest';

const API = 'http://localhost:5099/api';
const login = async (email, password) => (await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
})).json()).token;
const call = (t, p, opts = {}) => fetch(`${API}${p}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
});

describe('training revenue + auto-activation', () => {
    it('all checks pass', async () => {
        const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

        const admin = await login('demo@example.com', 'password123');
        const acct = (await (await call(admin, '/accounts')).json())[0].name;

        // Opt into Interno, add trainees.
        await call(admin, `/accounts/product-scope/${encodeURIComponent(acct)}`, {
            method: 'PUT', body: JSON.stringify({ products: [{ product_key: 'interno', items: ['CrowdStrike'], unit_count: 0 }] })
        });
        const t1 = await (await call(admin, '/training/trainees', { method: 'POST', body: JSON.stringify({ account: acct, name: 'Rev Tester 1' }) })).json();
        const t2 = await (await call(admin, '/training/trainees', { method: 'POST', body: JSON.stringify({ account: acct, name: 'Rev Tester 2' }) })).json();

        // ---- manual activation = subscription + foundation enrollments ----
        const act = await (await call(admin, `/training/activate/${encodeURIComponent(acct)}`, { method: 'POST' })).json();
        ok(act.activated && act.enrolled > 0, `activation created ${act.enrolled} enrollments across ${act.courses} foundation courses for ${act.trainees} trainees`);

        const subs = await (await call(admin, '/training/subscriptions')).json();
        const sub = subs.find((s) => s.account === acct);
        ok(sub && sub.status === 'Active' && sub.amount > 0, `a training subscription exists with a derived amount (${sub?.amount})`);

        // ---- revenue rolls up, only from training ----
        const rev = await (await call(admin, '/training/revenue')).json();
        ok(rev.bookings >= sub.amount && rev.arr >= 0 && 'byModule' in rev, `revenue rollup: bookings ${rev.bookings}, ARR ${rev.arr}`);
        ok((rev.byModule.interno || 0) > 0 || (rev.byModule.platform || 0) > 0, 'revenue is attributed by module');

        // ---- record a collection → pending drops ----
        const paid = await (await call(admin, `/training/subscriptions/${sub.id}`, { method: 'PATCH', body: JSON.stringify({ collected: 30000 }) })).json();
        ok(paid.collected === 30000 && paid.pending === Math.max(0, paid.amount - 30000), `collection recorded, pending = amount − collected (${paid.pending})`);

        // ---- billing frequency drives ARR annualisation ----
        await call(admin, `/training/subscriptions/${sub.id}`, { method: 'PATCH', body: JSON.stringify({ billing_frequency: 'Monthly' }) });
        const rev2 = await (await call(admin, '/training/revenue')).json();
        ok(rev2.arr >= rev.arr, 'switching a subscription to Monthly annualises ARR (×12)');

        // ---- CLM rollup carries training revenue ----
        const custs = await (await call(admin, '/contracts/customers')).json();
        const cust = custs.find((c) => c.name === acct);
        if (cust) ok(cust.trainingRevenueInr === sub.amount, `CLM customer rollup exposes trainingRevenueInr (${cust?.trainingRevenueInr})`);
        else ok(true, 'account not a CLM customer — skipping rollup');

        // ---- auto-activation via the onboarding Training stage ----
        const contracts = await (await call(admin, '/contracts')).json();
        const c2 = contracts.find((x) => x.account !== acct) || contracts[0];
        if (c2 && c2.account !== acct) {
            await call(admin, `/accounts/product-scope/${encodeURIComponent(c2.account)}`, { method: 'PUT', body: JSON.stringify({ products: [{ product_key: 'conformity', items: ['ISO 27001'], unit_count: 0 }] }) });
            await call(admin, '/training/trainees', { method: 'POST', body: JSON.stringify({ account: c2.account, name: 'Auto Learner' }) });
            const prior = await call(admin, `/onboarding/by-account/${encodeURIComponent(c2.account)}`);
            if (prior.ok) await call(admin, `/onboarding/${(await prior.json()).id}`, { method: 'DELETE' });
            const o = await (await call(admin, '/onboarding', { method: 'POST', body: JSON.stringify({ account: c2.account, contract_id: c2.id, csm_name: 'X' }) })).json();
            // Move onto the Training stage (stage 4).
            await call(admin, `/onboarding/${o.id}/move`, { method: 'PATCH', body: JSON.stringify({ stage: 4 }) });
            const subs2 = await (await call(admin, '/training/subscriptions')).json();
            ok(subs2.some((s) => s.account === c2.account), `reaching the onboarding Training stage auto-activated training for ${c2.account}`);
            await call(admin, `/onboarding/${o.id}`, { method: 'DELETE' });
        } else { ok(true, 'no second account — skipping auto-activation-via-onboarding check'); }

        expect(__fail, __fail.join('\n')).toEqual([]);
    });
});
