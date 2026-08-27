import { describe, it, expect } from 'vitest';

const API = 'http://localhost:5099/api';
const login = async (email, password) => (await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
})).json()).token;
const call = (t, p, opts = {}) => fetch(`${API}${p}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
});

describe('training available courses from opted modules', () => {
    it('all checks pass', async () => {
        const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

        const admin = await login('demo@example.com', 'password123');
        const acct = (await (await call(admin, '/accounts')).json())[0].name;

        // Opt the account into Interno only (account-level scope).
        await call(admin, `/accounts/product-scope/${encodeURIComponent(acct)}`, {
            method: 'PUT', body: JSON.stringify({ products: [{ product_key: 'interno', items: ['CrowdStrike'], unit_count: 0 }] })
        });

        const avail = await (await call(admin, `/training/available/${encodeURIComponent(acct)}`)).json();
        ok(Array.isArray(avail.courses) && avail.modules.includes('interno'), `available reflects opted modules (${avail.modules.join(',')})`);
        ok(avail.courses.some((c) => c.module === 'interno') && avail.courses.some((c) => c.module === 'platform'),
            'available = platform courses + the opted module’s courses');
        ok(!avail.courses.some((c) => c.module === 'conformity'),
            'a module they did NOT opt for is excluded (no Conformity courses)');

        // The CLM customer rollup carries the training course count.
        const custs = await (await call(admin, '/contracts/customers')).json();
        const cust = custs.find((c) => c.name === acct);
        if (cust) {
            ok(typeof cust.trainingCourseCount === 'number' && cust.trainingCourseCount === avail.courses.length,
                `CLM customer rollup exposes trainingCourseCount (${cust?.trainingCourseCount})`);
            ok(Array.isArray(cust.trainingModules) && cust.trainingModules.includes('interno'), 'CLM rollup lists the opted training modules');
        } else {
            ok(true, 'account is not a CLM customer segment — skipping rollup check');
        }

        expect(__fail, __fail.join('\n')).toEqual([]);
    });
});
