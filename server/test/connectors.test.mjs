import { mapRow, mergeRecord } from '../services/syncService.js';
import { CONNECTOR_BY_KEY, provenanceOf } from '../connectors/registry.js';
import { describe, it, expect } from 'vitest';

describe('connectors', () => {
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
    const rep = await login('priya@cashhorizon.io', 'demo1234');
    ok(admin, 'admin login');

    // ---- the registry describes the shape ahead of the integration ----
    const list = await (await call(admin, '/connectors')).json();
    ok(list.length === 2 && list.some((c) => c.key === 'zoho_crm') && list.some((c) => c.key === 'leegality'),
        `connectors declared: ${list.map((c) => `${c.name}→${c.module}`).join(', ')}`);
    ok(list.every((c) => c.configured === false && c.implemented === false),
        `both report configured=false, implemented=false — no pretending to have a live feed`);

    // ---- field mapping ----
    const zoho = CONNECTOR_BY_KEY.zoho_crm;
    const mapped = mapRow(zoho, {
        id: 'ZC-9001', Account_Name: 'Nova Finance', Industry: 'NBFC',
        Amount: 4500000, Currency: 'INR', Stage: 'Live', Owner: 'Priya Sharma', Ignored_Field: 'x'
    });
    ok(mapped.external_id === 'ZC-9001' && mapped.name === 'Nova Finance' && mapped.value_amount === 4500000,
        `Zoho fields map to ours: ${JSON.stringify(mapped)}`);
    ok(!('Ignored_Field' in mapped), 'unmapped source fields are dropped, not smuggled into our schema');

    // ---- the important one: a sync must not stamp on human work ----
    const existing = {
        id: 7, name: 'Nova Finance', value_amount: 4000000, stage: 'Negotiation',
        cxm: 'Rohan Mehta', health: 'Poor', next_step: 'Escalate to CFO', tier: 'Enterprise', region: 'APAC'
    };
    const incoming = mapRow(zoho, {
        id: 'ZC-9001', Account_Name: 'Nova Finance', Amount: 4500000, Stage: 'Live', Owner: 'Priya Sharma'
    });
    const merged = mergeRecord(zoho, existing, incoming);
    ok(merged.value_amount === 4500000 && merged.stage === 'Live',
        `Zoho wins on the commercials it owns (amount ${existing.value_amount} → ${merged.value_amount}, stage → ${merged.stage})`);
    ok(merged.cxm === 'Rohan Mehta' && merged.health === 'Poor' && merged.next_step === 'Escalate to CFO',
        `the CSM's own work survives the sync (cxm/health/next_step untouched) — a nightly job silently reverting them would make the platform untrustworthy`);
    ok(merged.tier === 'Enterprise' && merged.region === 'APAC', 'locally-owned tier and region survive too');
    ok(merged.source_system === 'zoho_crm' && !!merged.synced_at,
        `provenance stamped: source=${merged.source_system}, synced_at set`);

    // absent ≠ cleared
    const sparse = mergeRecord(zoho, existing, { external_id: 'ZC-9001', name: '' });
    ok(sparse.name === 'Nova Finance', 'an empty incoming field does not wipe a populated one (absent ≠ cleared)');

    // a brand-new record
    const fresh = mergeRecord(zoho, null, incoming);
    ok(fresh.source_system === 'zoho_crm' && fresh.external_id === 'ZC-9001',
        'a new record carries its origin from the first insert');

    // ---- provenance, for the UI ----
    ok(provenanceOf({ source_system: 'manual' }).label === 'Entered here', 'manual records read as entered here');
    const p = provenanceOf({ source_system: 'leegality', external_id: 'LG-1', synced_at: '2026-07-17T00:00:00Z' });
    ok(p.label === 'Synced from Leegality' && p.external_id === 'LG-1',
        `synced records say where they came from: "${p.label}"`);

    // ---- Leegality won't guess which customer a signed agreement belongs to ----
    const lg = CONNECTOR_BY_KEY.leegality;
    ok(lg.matchOn?.onMiss === 'quarantine',
        `Leegality parks unmatched documents instead of guessing — filing a signed agreement against the wrong customer is worse than not filing it`);

    // ---- a run is recorded even when it fails ----
    const before = (await (await call(admin, '/connectors/leegality/runs')).json()).length;
    const r = await (await call(admin, '/connectors/leegality/sync', { method: 'POST', body: '{}' })).json();
    ok(r.status === 'failed' && /driver isn’t built/.test(r.error), `unbuilt connector fails honestly: "${r.error}"`);
    const after = await (await call(admin, '/connectors/leegality/runs')).json();
    ok(after.length === before + 1, `the failed run is logged (${before} → ${after.length}) — a feed that quietly stopped is worse than one that visibly failed`);

    // ---- access ----
    ok((await call(rep, '/connectors')).status === 403, 'a rep cannot read connector config');
    ok((await call(rep, '/connectors/zoho_crm/sync', { method: 'POST', body: '{}' })).status === 403, 'a rep cannot trigger a sync');

    expect(__fail, __fail.join('\n')).toEqual([]);
  });
});
