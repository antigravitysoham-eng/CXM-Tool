
import { describe, it, expect } from 'vitest';

describe('clm', () => {
  it('all checks pass', async () => {
    const API = 'http://localhost:5099/api';
    const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };
    const login = async (e, p) => (await (await fetch(`${API}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e, password: p })
    })).json()).token;
    const call = (t, path, opts = {}) => fetch(`${API}${path}`, {
        ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
    });

    const admin = await login('demo@example.com', 'password123');
    ok(admin, 'admin login');

    // ---- product catalogue ----
    const meta = await (await call(admin, '/contracts/meta')).json();
    ok(meta.products?.length === 7, `catalogue exposed: ${meta.products?.map((p) => p.name).join(', ')}`);
    const conformity = meta.products.find((p) => p.key === 'conformity');
    ok(conformity.itemLabel === 'Framework' && conformity.unitLabel === 'Frameworks',
        `Conformity scoped by named frameworks (${conformity.unitLabel})`);
    const vp = meta.products.find((p) => p.key === 'vendor_pulse');
    ok(vp.itemLabel === null, `Vendor Pulse is a count, not a list (${vp.unitLabel}) — nobody types 400 vendor names`);

    const contracts = await (await call(admin, '/contracts')).json();
    const c = contracts[0];
    ok(!!c, `working against contract ${c.id} (${c.account})`);

    // ---- multi-select scope: a customer takes several products ----
    const put = await call(admin, `/contracts/${c.id}/scope`, {
        method: 'PUT',
        body: JSON.stringify({
            products: [
                { product_key: 'conformity', items: ['ISO 27001', 'SOC 2 Type II', 'PCI DSS', 'RBI CSF'] },
                { product_key: 'interno', items: ['CrowdStrike', 'Okta', 'AWS GuardDuty'] },
                { product_key: 'vendor_pulse', unit_count: 420 },
                { product_key: 'agentctl', items: ['OpenAI', 'Anthropic'] },
                { product_key: 'others', unit_count: 3, items: ['Custom SIEM rules'], info: 'Bespoke detection engineering blocks' }
            ]
        })
    });
    const scope = await put.json();
    ok(put.status === 200 && scope.length === 5, `5 products scoped on one contract (multi-select works)`);

    const conf = scope.find((s) => s.product_key === 'conformity');
    ok(conf.unit_count === 4 && conf.items.length === 4,
        `Conformity: count derived from the names — ${conf.unit_count} frameworks (${conf.items.join(', ')})`);

    const vpScope = scope.find((s) => s.product_key === 'vendor_pulse');
    ok(vpScope.unit_count === 420 && vpScope.items.length === 0, `Vendor Pulse: ${vpScope.unit_count} vendors, no item list`);

    const others = scope.find((s) => s.product_key === 'others');
    ok(others.info === 'Bespoke detection engineering blocks', `Others carries its unit description: "${others.info}"`);

    // count must follow the names, not a stale number typed beside them
    const put2 = await call(admin, `/contracts/${c.id}/scope`, {
        method: 'PUT',
        body: JSON.stringify({ products: [{ product_key: 'conformity', unit_count: 99, items: ['ISO 27001', 'SOC 2 Type II'] }] })
    });
    const s2 = await put2.json();
    ok(s2[0].unit_count === 2, `count follows the named items, ignoring a contradictory unit_count (99 -> ${s2[0].unit_count})`);

    // replacing the scope replaces it wholesale
    ok(s2.length === 1, `PUT replaces the whole scope (5 -> ${s2.length})`);

    // restore the fuller scope for later phases
    await call(admin, `/contracts/${c.id}/scope`, {
        method: 'PUT',
        body: JSON.stringify({
            products: [
                { product_key: 'conformity', items: ['ISO 27001', 'SOC 2 Type II', 'PCI DSS'] },
                { product_key: 'interno', items: ['CrowdStrike', 'Okta'] },
                { product_key: 'vendor_pulse', unit_count: 420 }
            ]
        })
    });

    // account-wide scope, across contracts
    const acctScope = await (await call(admin, `/contracts/account-scope/${encodeURIComponent(c.account)}`)).json();
    ok(acctScope.length >= 3, `account-wide scope readable for Onboarding: ${acctScope.map((s) => s.product).join(', ')}`);

    // bad product key rejected
    const bad = await call(admin, `/contracts/${c.id}/scope`, {
        method: 'PUT', body: JSON.stringify({ products: [{ product_key: 'not_a_product', unit_count: 1 }] })
    });
    ok(bad.status === 400, `unknown product rejected (${bad.status})`);

    // ---- invoices ----
    const inv = await (await call(admin, '/invoices', {
        method: 'POST',
        body: JSON.stringify({
            contract_id: c.id, amount: 2500000, currency: 'INR', status: 'Raised',
            issue_date: '2026-07-01', due_date: '2026-07-31', period_from: '2026-07-01', period_to: '2027-06-30',
            notes: 'Annual subscription'
        })
    })).json();
    ok(inv.id && inv.invoice_no?.startsWith('INV-'), `invoice raised with generated number ${inv.invoice_no} for ${inv.account}`);

    // overdue is derived from the due date, not stored
    const late = await (await call(admin, '/invoices', {
        method: 'POST',
        body: JSON.stringify({ contract_id: c.id, amount: 500000, status: 'Sent', issue_date: '2026-01-01', due_date: '2026-02-01' })
    })).json();
    ok(late.status === 'Overdue' && late.days_overdue > 0,
        `past-due invoice reads as Overdue automatically (${late.days_overdue} days), stored status still "${late.stored_status}"`);

    // marking paid without a date fills it in rather than leaving ageing guessing
    const paid = await (await call(admin, `/invoices/${late.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'Paid' }) })).json();
    ok(paid.status === 'Paid' && !!paid.paid_date, `marking paid auto-stamps the paid date (${paid.paid_date})`);

    const stats = await (await call(admin, '/invoices/stats')).json();
    ok(stats.count >= 2, `AR stats: ${stats.count} invoices, ₹${stats.outstanding} outstanding, ₹${stats.collected} collected, ${stats.overdueCount} overdue`);
    ok(typeof stats.ageing === 'object', `ageing buckets present: ${JSON.stringify(stats.ageing)}`);

    // validation
    const noContract = await call(admin, '/invoices', { method: 'POST', body: JSON.stringify({ amount: 100 }) });
    ok(noContract.status === 400, `invoice without a contract rejected (${noContract.status})`);
    const badPeriod = await call(admin, '/invoices', {
        method: 'POST', body: JSON.stringify({ contract_id: c.id, amount: 100, period_from: '2026-12-01', period_to: '2026-01-01' })
    });
    ok(badPeriod.status === 400, `inverted period rejected (${badPeriod.status})`);

    // ---- ABAC on the new surfaces ----
    const rep = await login('priya@cashhorizon.io', 'demo1234');
    if (rep) {
        const repAccts = (await (await call(rep, '/accounts')).json()).map((a) => a.name);
        const foreign = contracts.find((x) => !repAccts.includes(x.account));
        if (foreign) {
            const s = await call(rep, `/contracts/${foreign.id}/scope`);
            const sj = await s.json();
            ok(Array.isArray(sj) && sj.length === 0, `rep sees no scope for an out-of-scope contract (${sj.length} rows)`);
            const w = await call(rep, `/contracts/${foreign.id}/scope`, {
                method: 'PUT', body: JSON.stringify({ products: [{ product_key: 'interno', unit_count: 1 }] })
            });
            ok(w.status === 404, `rep cannot write scope to a foreign contract (${w.status})`);
            const i = await call(rep, '/invoices', {
                method: 'POST', body: JSON.stringify({ contract_id: foreign.id, amount: 1 })
            });
            ok(i.status === 404, `rep cannot raise an invoice against a foreign contract (${i.status})`);
        }
        const repInvoices = await (await call(rep, '/invoices')).json();
        ok(repInvoices.every((x) => repAccts.includes(x.account)), `rep's invoice list stays inside their accounts (${repInvoices.length})`);
    }

    // ---- partial-PATCH must not reset unspecified fields to schema defaults ----
    // z's .partial() keeps .default(), so before the fix a one-field PATCH silently
    // reset every other field (tcv→0, currency→INR, segment→Customer, …). These
    // create a record with non-default values, PATCH a single field, and assert the
    // rest survived.
    const regC = await (await call(admin, '/contracts', {
        method: 'POST', body: JSON.stringify({
            account: c.account, type: 'Renewal', status: 'Renewing', deployment: 'On-premise',
            license_type: 'Perpetual', billing_frequency: 'Quarterly', support_tier: 'Enterprise',
            payment_terms: 'Net 60', currency: 'USD', tcv: 1234567, arr: 456789, mrr: 38000,
            term_months: 24, auto_renew: true, notice_period_days: 90, spoc_name: 'Riya Regression',
            notes: 'regression-marker'
        })
    })).json();
    const regCPatched = await (await call(admin, `/contracts/${regC.id}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'Active' })
    })).json();
    ok(regCPatched.status === 'Active' && regCPatched.type === 'Renewal'
        && regCPatched.support_tier === 'Enterprise' && regCPatched.license_type === 'Perpetual'
        && regCPatched.currency === 'USD' && regCPatched.tcv === 1234567 && regCPatched.arr === 456789
        && regCPatched.term_months === 24 && regCPatched.auto_renew === true
        && regCPatched.notice_period_days === 90 && regCPatched.billing_frequency === 'Quarterly'
        && regCPatched.notes === 'regression-marker',
        'a status-only PATCH on a contract preserves type/tcv/term/currency/notes (no default reset)');

    const regI = await (await call(admin, '/invoices', {
        method: 'POST', body: JSON.stringify({
            contract_id: c.id, amount: 777000, currency: 'USD', status: 'Sent', invoice_no: 'INV-REG-001',
            issue_date: '2026-03-01', due_date: '2026-03-31', period_from: '2026-03-01',
            period_to: '2026-03-31', notes: 'regression-marker'
        })
    })).json();
    const regIPatched = await (await call(admin, `/invoices/${regI.id}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'Paid' })
    })).json();
    ok(regIPatched.status === 'Paid' && regIPatched.currency === 'USD'
        && regIPatched.invoice_no === 'INV-REG-001' && regIPatched.amount === 777000
        && regIPatched.notes === 'regression-marker' && regIPatched.issue_date === '2026-03-01'
        && regIPatched.period_to === '2026-03-31',
        'a status-only PATCH on an invoice preserves currency/no/amount/notes/dates (no default reset)');

    const regA = await (await call(admin, '/accounts', {
        method: 'POST', body: JSON.stringify({
            name: `Regression Co ${Date.now()}`, segment: 'Prospect', source: 'Partner',
            stage: 'Negotiation', region: 'EMEA', tier: 'Enterprise', health: 'Average',
            value_amount: 8800000, value_currency: 'USD', probability: 65,
            next_step: 'Send MSA', next_step_date: '2026-08-01',
            meddicc: { metrics: 'ROI 3x', champion: 'CISO' }
        })
    })).json();
    const regAPatched = await (await call(admin, `/accounts/${regA.id}`, {
        method: 'PATCH', body: JSON.stringify({ stage: 'Closing' })
    })).json();
    ok(regAPatched.stage === 'Closing' && regAPatched.segment === 'Prospect'
        && regAPatched.source === 'Partner' && regAPatched.region === 'EMEA'
        && regAPatched.tier === 'Enterprise' && regAPatched.health === 'Average'
        && regAPatched.value_amount === 8800000 && regAPatched.value_currency === 'USD'
        && regAPatched.probability === 65 && regAPatched.next_step === 'Send MSA'
        && regAPatched.next_step_date === '2026-08-01'
        && regAPatched.meddicc?.metrics === 'ROI 3x' && regAPatched.meddicc?.champion === 'CISO',
        'a stage-only PATCH on an account preserves segment/value/health/next_step/meddicc (no default reset)');

    // cleanup
    for (const id of [inv.id, late.id, regI.id]) await call(admin, `/invoices/${id}`, { method: 'DELETE' });
    await call(admin, `/contracts/${regC.id}`, { method: 'DELETE' });
    await call(admin, `/accounts/${regA.id}`, { method: 'DELETE' });
    console.log('      cleaned up test invoices, contract, account');

    expect(__fail, __fail.join('\n')).toEqual([]);
  });
});
