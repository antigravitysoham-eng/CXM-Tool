
import { describe, it, expect } from 'vitest';

describe('neo', () => {
  it('all checks pass', async () => {
    const API = 'http://localhost:5099/api';
    const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

    const login = async (email, password) => {
        const r = await fetch(`${API}/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        return (await r.json()).token;
    };
    const call = (t, path, opts = {}) => fetch(`${API}${path}`, {
        ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
    });
    const askAs = async (t, prompt) => (await call(t, '/neo/ask', { method: 'POST', body: JSON.stringify({ prompt }) })).json();

    const admin = await login('demo@example.com', 'password123');
    ok(admin, 'admin login');

    const kinds = (r) => (r.blocks || []).map((b) => b.type + (b.variant ? `:${b.variant}` : '')).join(', ');

    // ---- intent routing ----
    const cases = [
        ["How's the pipeline?", 'pipeline'],
        ['pipeline by stage', 'pipeline_by_stage'],
        ['Top 5 accounts', 'top_accounts'],
        ['What renews in 60 days?', 'renewals'],
        ['break it down by region', 'by_region'],
        ['MEDDICC health', 'meddicc'],
        ['who owns what', 'by_owner'],
        ['Tell me about Bajaj Finserv', 'account_lookup'],
        ['Documents for Muthoot Finance', 'documents'],
        ['hello', 'greeting'],
        ['what can you do', 'help'],
        ['add prospect "Acme Capital", fintech, APAC, 50L', 'create_account'],
        ['sdlkfj qwerty', 'fallback']
    ];
    for (const [prompt, want] of cases) {
        const r = await askAs(admin, prompt);
        ok(r.intent === want, `"${prompt}" -> ${r.intent}${r.intent === want ? '' : ` (wanted ${want})`} | blocks: ${kinds(r) || 'none'}`);
    }

    // ---- answers carry real numbers ----
    const pipe = await askAs(admin, "How's the pipeline?");
    ok(/₹/.test(pipe.reply) && pipe.blocks.some((b) => b.type === 'stats'), `pipeline reply: ${pipe.reply.slice(0, 95)}`);

    const ren = await askAs(admin, 'what renews in 90 days');
    ok(ren.blocks.some((b) => b.type === 'stats'), `renewals reply: ${ren.reply.slice(0, 95)}`);

    const look = await askAs(admin, 'Tell me about Bajaj Finserv');
    ok(/Bajaj/.test(look.reply), `lookup reply: ${look.reply.slice(0, 95)}`);

    const top = await askAs(admin, 'top 3 accounts');
    const topTable = top.blocks.find((b) => b.type === 'table');
    ok(topTable?.rows.length === 3, `"top 3" honoured the limit: ${topTable?.rows.length} rows`);

    const missing = await askAs(admin, 'Tell me about Nonexistent Corp');
    ok(/can't find/i.test(missing.reply), `unknown account handled: ${missing.reply.slice(0, 70)}`);

    // ---- data entry: proposal, then confirm ----
    const draft = await askAs(admin, 'add prospect "Acme Capital Ltd", NBFC, APAC, 50L, stage Qualified');
    ok(draft.proposal?.kind === 'create_account', `proposal returned, not written: ${draft.proposal?.summary}`);
    const f = Object.fromEntries(draft.proposal?.fields || []);
    ok(f.Name === 'Acme Capital Ltd' && f.Region === 'APAC' && f.Stage === 'Qualified' && f.Value?.includes('50,00,000'),
        `parsed: name=${f.Name} region=${f.Region} stage=${f.Stage} value=${f.Value} segment=${f.Segment}`);

    const before = (await (await call(admin, '/accounts')).json()).length;
    const done = await (await call(admin, '/neo/confirm', { method: 'POST', body: JSON.stringify({ proposal: draft.proposal }) })).json();
    const after = (await (await call(admin, '/accounts')).json()).length;
    ok(after === before + 1 && done.account?.name === 'Acme Capital Ltd', `confirm wrote it: ${before} -> ${after} accounts | ${done.reply}`);
    ok(done.account?.region === 'APAC' && done.account?.value_amount === 5000000, `stored correctly: region=${done.account?.region} value=${done.account?.value_amount}`);

    // ---- ABAC ----
    const rep = await login('priya@cashhorizon.io', 'demo1234');
    if (rep) {
        const repAccts = (await (await call(rep, '/accounts')).json()).map((a) => a.name);
        const repPipe = await askAs(rep, "How's the pipeline?");
        const adminPipe = await askAs(admin, "How's the pipeline?");
        ok(repPipe.reply !== adminPipe.reply, `ABAC: rep gets a different pipeline than admin (rep sees ${repAccts.length} accounts)`);

        const repTop = await askAs(rep, 'top 20 accounts');
        const names = (repTop.blocks.find((b) => b.type === 'table')?.rows || []).map((r) => r[0]);
        ok(names.every((n) => repAccts.includes(n)), `ABAC: every account NEO names to the rep is in their scope (${names.length} rows)`);

        // An account the rep cannot see must not leak through a direct lookup.
        const adminAccts = (await (await call(admin, '/accounts')).json()).map((a) => a.name);
        const hidden = adminAccts.find((n) => !repAccts.includes(n));
        if (hidden) {
            const leak = await askAs(rep, `Tell me about ${hidden}`);
            ok(/can't find/i.test(leak.reply), `ABAC: lookup of out-of-scope "${hidden}" refused, not leaked`);
            const docLeak = await askAs(rep, `documents for ${hidden}`);
            ok(!(docLeak.blocks.find((b) => b.type === 'table')?.rows || []).length, `ABAC: documents for out-of-scope account not listed`);
        }
        // Forged proposal must be re-checked server-side, not trusted.
        const forged = { kind: 'create_account', payload: { name: 'Forged Inc', segment: 'Customer', region: 'EMEA', value_amount: 1, value_currency: 'INR', stage: 'Live', source: 'Direct' } };
        const fr = await call(rep, '/neo/confirm', { method: 'POST', body: JSON.stringify({ proposal: forged }) });
        const fj = await fr.json().catch(() => ({}));
        const repMe = JSON.parse(Buffer.from(rep.split('.')[1], 'base64').toString());
        ok(fr.status === 403 || fj.account?.owner_id === repMe.id,
            `forged proposal re-checked server-side: status ${fr.status}, owner forced to the rep (${fj.account?.owner_id} vs rep ${repMe.id})`);
    }

    // cleanup
    const all = await (await call(admin, '/accounts')).json();
    for (const a of all.filter((x) => /Acme Capital Ltd|Forged Inc/.test(x.name))) {
        await call(admin, `/accounts/${a.id}`, { method: 'DELETE' });
        console.log(`      cleaned up ${a.name}`);
    }

    expect(__fail, __fail.join('\n')).toEqual([]);
  });
});
