import { describe, it, expect } from 'vitest';

const API = 'http://localhost:5099/api';

const login = async (email, password) => (await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
})).json()).token;
const call = (t, p, opts = {}) => fetch(`${API}${p}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
});

describe('surveys (Echo) — NPS/CSAT scoring, sentiment, ABAC', () => {
    it('all checks pass', async () => {
        const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

        const admin = await login('demo@example.com', 'password123');
        const rep = await login('priya@cashhorizon.io', 'demo1234');
        ok(admin && rep, 'admin + rep logins');

        const meta = await (await call(admin, '/surveys/meta')).json();
        ok(meta.types?.includes('NPS') && meta.statuses?.includes('Live'), 'meta carries survey types + statuses');

        const customers = (await (await call(admin, '/accounts')).json()).filter((a) => a.segment === 'Customer');
        const acct = customers[0].name;

        // ---- create an NPS campaign, send it, add responses ----
        const camp = await (await call(admin, '/surveys', { method: 'POST', body: JSON.stringify({ account: acct, title: 'NPS test', type: 'NPS' }) })).json();
        ok(camp.id && camp.status === 'Draft', `created an NPS campaign (status ${camp.status})`);

        const sent = await (await call(admin, `/surveys/${camp.id}/send`, { method: 'POST', body: JSON.stringify({ sent_count: 5 }) })).json();
        ok(sent.status === 'Live' && sent.sent_count === 5, 'sending marks it Live with a recipient count');

        // NPS: 10 (promoter), 9 (promoter), 6 (detractor) -> 2 promoters, 1 detractor of 3 => (66-33)=33
        for (const score of [10, 9, 6]) await call(admin, `/surveys/${camp.id}/responses`, { method: 'POST', body: JSON.stringify({ score, comment: score < 7 ? 'unhappy' : 'great' }) });
        const withResp = await (await call(admin, `/surveys/${camp.id}`)).json();
        ok(withResp.responseCount === 3 && withResp.headline === 33, `NPS computed from responses (headline ${withResp.headline})`);
        ok(withResp.responses.some((r) => r.band === 'Detractor') && withResp.detractors === 1, 'a 6/10 response is a detractor');

        // ---- CSAT campaign: sentiment + range clamping ----
        const csat = await (await call(admin, '/surveys', { method: 'POST', body: JSON.stringify({ account: acct, title: 'CSAT test', type: 'CSAT' }) })).json();
        await call(admin, `/surveys/${csat.id}/responses`, { method: 'POST', body: JSON.stringify({ score: 2 }) });
        // A CSAT score of 8 (valid 0-10 in the schema) is clamped to the 1-5 CSAT range.
        const clamped = await (await call(admin, `/surveys/${csat.id}/responses`, { method: 'POST', body: JSON.stringify({ score: 8 }) })).json();
        ok(clamped.responses[0].score === 5, 'an out-of-range CSAT score (8) is clamped to 5');
        const csatFull = await (await call(admin, `/surveys/${csat.id}`)).json();
        ok(csatFull.responses.some((r) => r.score === 2 && r.sentiment === 'Negative'), 'a CSAT 2/5 is negative sentiment');

        // ---- stats + detractors ----
        const stats = await (await call(admin, '/surveys/stats')).json();
        ok(typeof stats.nps === 'number' && stats.detractors >= 2 && stats.sentiments, `stats rollup: NPS ${stats.nps}, ${stats.detractors} detractors`);
        const detr = await (await call(admin, '/surveys/detractors')).json();
        ok(Array.isArray(detr) && detr.every((d) => d.sentiment === 'Negative'), 'detractors endpoint returns only negative responses');

        // ---- ABAC ----
        const repAccts = (await (await call(rep, '/accounts')).json()).map((a) => a.name);
        const notMine = (await (await call(admin, '/accounts')).json()).map((a) => a.name).find((n) => !repAccts.includes(n));
        if (notMine) {
            const forbidden = await call(rep, '/surveys', { method: 'POST', body: JSON.stringify({ account: notMine, title: 'x', type: 'NPS' }) });
            ok(forbidden.status === 403, `rep cannot create a survey on an account they don't own (${forbidden.status})`);
        } else { ok(true, 'rep owns all accounts — skipping cross-account check'); }

        // ---- Echo agent: scoped, read-only ----
        const mint = await call(rep, '/agent-keys', { method: 'POST', body: JSON.stringify({ agent_key: 'echo', label: 'survey test' }) });
        ok(mint.status === 201, `rep can mint an Echo key (${mint.status})`);
        const minted = await mint.json();
        if (minted.secret) {
            const agentStats = await call(minted.secret, '/surveys/stats');
            ok(agentStats.status === 200, `Echo agent can read survey stats (${agentStats.status})`);
            const agentWrite = await call(minted.secret, '/surveys', { method: 'POST', body: JSON.stringify({ account: repAccts[0], title: 'x', type: 'NPS' }) });
            ok(agentWrite.status === 403, `read-only Echo agent cannot create a campaign (${agentWrite.status})`);
            await call(rep, `/agent-keys/${minted.id}`, { method: 'DELETE' });
        }

        expect(__fail, __fail.join('\n')).toEqual([]);
    });
});
