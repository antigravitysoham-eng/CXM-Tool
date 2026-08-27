import { describe, it, expect } from 'vitest';

const API = 'http://localhost:5099/api';

const login = async (email, password) => (await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
})).json()).token;

const call = (t, p, opts = {}) => fetch(`${API}${p}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
});

/**
 * The Cash Horizon pipeline: an account moves Lead -> ... -> Closed, and every
 * move is meant to be dated so time-to-close is measurable. A partner is just
 * an account with segment 'Partner' that carries an account manager, and the
 * accounts it sources should point back at it.
 */
describe('pipeline stages + partner sourcing', () => {
    it('all checks pass', async () => {
        const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

        const admin = await login('demo@example.com', 'password123');

        // ---- a partner carries an account manager ----
        const partnerRes = await call(admin, '/accounts', {
            method: 'POST',
            body: JSON.stringify({
                name: 'Test Advisory LLP', segment: 'Partner',
                partner_manager: 'Meera Nair', value: 0
            })
        });
        const partner = await partnerRes.json();
        ok(partnerRes.status === 201, `partner created (${partnerRes.status})`);
        ok(partner.partner_manager === 'Meera Nair', `partner keeps its account manager ("${partner.partner_manager}")`);

        // ---- an account sourced by that partner points back at it ----
        const sourcedRes = await call(admin, '/accounts', {
            method: 'POST',
            body: JSON.stringify({
                name: 'Sourced Co', segment: 'Prospect', value: 5000000,
                source: 'Partner', sourcing_partner_id: partner.id, stage: 'Lead'
            })
        });
        const sourced = await sourcedRes.json();
        ok(sourcedRes.status === 201, `sourced account created (${sourcedRes.status})`);
        ok(Number(sourced.sourcing_partner_id) === Number(partner.id), `account records its sourcing partner (${sourced.sourcing_partner_id})`);

        // a fresh Lead has an opening stage event and a non-null time-in-stage
        ok((sourced.stage || 'Lead') === 'Lead', `opens in Lead ("${sourced.stage}")`);
        ok(sourced.days_in_stage !== null && sourced.days_in_stage !== undefined, 'days_in_stage is populated on creation');

        const hist0 = await (await call(admin, `/accounts/${sourced.id}/stage-history`)).json();
        ok(Array.isArray(hist0) && hist0.length >= 1, `opening stage logged (${hist0.length} event/s)`);

        // ---- moving the stage re-stamps the entry date and appends a dated event ----
        const moveRes = await call(admin, `/accounts/${sourced.id}`, {
            method: 'PATCH', body: JSON.stringify({ stage: 'Qualified' })
        });
        const moved = await moveRes.json();
        ok(moveRes.status === 200, `stage move accepted (${moveRes.status})`);
        ok(moved.stage === 'Qualified', `stage advanced ("${moved.stage}")`);

        const hist1 = await (await call(admin, `/accounts/${sourced.id}/stage-history`)).json();
        ok(hist1.length === hist0.length + 1, `move appended one dated event (${hist0.length} -> ${hist1.length})`);
        const last = hist1[hist1.length - 1];
        ok(last.stage === 'Qualified' && !!last.entered_at, `latest event is dated ("${last.stage}" @ ${last.entered_at})`);
        ok(!!last.moved_by, `event records who moved it ("${last.moved_by}")`);

        // ---- reaching Closed yields a measurable days_to_close ----
        await call(admin, `/accounts/${sourced.id}`, { method: 'PATCH', body: JSON.stringify({ stage: 'Closed' }) });
        const closed = await (await call(admin, `/accounts/${sourced.id}`)).json();
        ok(closed.stage === 'Closed', 'account reached Closed');
        ok(closed.days_to_close !== null && closed.days_to_close !== undefined, `time-to-close is computed (${closed.days_to_close}d)`);

        // ---- a no-op PATCH (same stage) must not spam the history ----
        const before = (await (await call(admin, `/accounts/${sourced.id}/stage-history`)).json()).length;
        await call(admin, `/accounts/${sourced.id}`, { method: 'PATCH', body: JSON.stringify({ stage: 'Closed' }) });
        const after = (await (await call(admin, `/accounts/${sourced.id}/stage-history`)).json()).length;
        ok(after === before, `re-setting the same stage logs nothing (${before} -> ${after})`);

        // cleanup
        await call(admin, `/accounts/${sourced.id}`, { method: 'DELETE' });
        await call(admin, `/accounts/${partner.id}`, { method: 'DELETE' });

        expect(__fail, `failed: ${__fail.join('; ')}`).toEqual([]);
    });
});
