import { describe, it, expect } from 'vitest';

const API = 'http://localhost:5099/api';

const login = async (email, password) => (await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
})).json()).token;
const call = (t, p, opts = {}) => fetch(`${API}${p}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
});
const hoursAgo = (h) => new Date(Date.now() - h * 3600000).toISOString();

describe('support module — SLA by tier, milestones, ABAC', () => {
    it('all checks pass', async () => {
        const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

        const admin = await login('demo@example.com', 'password123');
        const rep = await login('priya@cashhorizon.io', 'demo1234');
        ok(admin && rep, 'admin + rep logins');

        // ---- meta ----
        const meta = await (await call(admin, '/support/meta')).json();
        ok(meta.statuses?.includes('Open') && meta.priorities?.includes('Urgent') && !!meta.sla?.Enterprise?.Urgent,
            'meta carries statuses, priorities and the SLA matrix');

        // ---- seed sample ----
        const seed = await (await call(admin, '/support/seed-sample', { method: 'POST' })).json();
        ok(seed.seeded > 0, `admin seeded ${seed.seeded} sample tickets`);

        // ---- list carries derived SLA ----
        const list = await (await call(admin, '/support')).json();
        ok(Array.isArray(list) && list.length >= seed.seeded, `list returns tickets (${list.length})`);
        const withSla = list[0];
        ok('breached' in withSla && 'at_risk' in withSla && 'resolution_due' in withSla && 'support_tier' in withSla,
            'each ticket carries derived SLA fields (breached, at_risk, resolution_due, tier)');
        ok(list.some((t) => t.breached), 'the sample set contains at least one breached ticket');

        // ---- stats ----
        const stats = await (await call(admin, '/support/stats')).json();
        ok(typeof stats.open === 'number' && typeof stats.breached === 'number' && 'byTier' in stats,
            `stats rollup: ${stats.open} open, ${stats.breached} breached, tiers ${Object.keys(stats.byTier).join('/')}`);
        ok(stats.slaAttainment === null || (stats.slaAttainment >= 0 && stats.slaAttainment <= 100),
            `SLA attainment is a valid percentage (${stats.slaAttainment})`);

        // an account the admin owns, to attach test tickets to
        const acct = (await (await call(admin, '/accounts')).json())[0];

        // ---- SLA math: response breach ----
        // Standard/Urgent response SLA is 4h. Opened 10h ago, never answered → breached.
        const breach = await (await call(admin, '/support', {
            method: 'POST', body: JSON.stringify({
                account: acct.name, subject: 'SLA breach probe', priority: 'Urgent',
                support_tier: 'Standard', status: 'Open', opened_at: hoursAgo(10)
            })
        })).json();
        ok(breach.response_breached === true && breach.breached === true,
            'an Urgent/Standard ticket open 10h with no response is response-breached (SLA=4h)');

        // ---- SLA math: fresh ticket is fine ----
        const fresh = await (await call(admin, '/support', {
            method: 'POST', body: JSON.stringify({
                account: acct.name, subject: 'Fresh ticket', priority: 'Urgent',
                support_tier: 'Standard', status: 'Open', opened_at: hoursAgo(0)
            })
        })).json();
        ok(fresh.breached === false && fresh.at_risk === false, 'a just-opened ticket is inside SLA');

        // ---- SLA math: Waiting on Customer pauses the resolution clock ----
        // Answered in time, then parked on the customer well past the 24h resolve SLA.
        const paused = await (await call(admin, '/support', {
            method: 'POST', body: JSON.stringify({
                account: acct.name, subject: 'Parked on customer', priority: 'Urgent',
                support_tier: 'Standard', status: 'Waiting on Customer',
                opened_at: hoursAgo(100), first_response_at: hoursAgo(99)
            })
        })).json();
        ok(paused.paused === true && paused.resolution_breached === false,
            'Waiting on Customer pauses the resolution clock — no resolution breach while parked');

        // ---- milestone stamping ----
        const t = await (await call(admin, '/support', {
            method: 'POST', body: JSON.stringify({ account: acct.name, subject: 'Milestone flow', priority: 'Normal', status: 'Open' })
        })).json();
        ok(!t.first_response_at, 'a new Open ticket has no first-response stamp');
        const inprog = await (await call(admin, `/support/${t.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'In Progress' }) })).json();
        ok(!!inprog.first_response_at && inprog.responded === true, 'leaving Open stamps the first response');
        const resolved = await (await call(admin, `/support/${t.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'Resolved' }) })).json();
        ok(!!resolved.resolved_at && resolved.resolved === true, 'moving to Resolved stamps the resolution');

        // ---- ABAC both ways ----
        const adminAccts = (await (await call(admin, '/accounts')).json()).map((a) => a.name);
        const repAccts = (await (await call(rep, '/accounts')).json()).map((a) => a.name);
        const repList = await (await call(rep, '/support')).json();
        ok(repList.every((tk) => repAccts.includes(tk.account)), "a rep sees only tickets on accounts they own");
        ok(repList.length <= list.length, `rep's ticket view (${repList.length}) is bounded by admin's (${list.length})`);

        // rep cannot open a ticket on an account they don't own
        const notMine = adminAccts.find((n) => !repAccts.includes(n));
        if (notMine) {
            const forbidden = await call(rep, '/support', { method: 'POST', body: JSON.stringify({ account: notMine, subject: 'should be blocked' }) });
            ok(forbidden.status === 403, `rep cannot open a ticket on an account they don't own (${forbidden.status})`);
        } else {
            ok(true, 'rep owns all accounts in this seed — skipping cross-account create check');
        }
        // rep can open one on an account they own
        if (repAccts.length) {
            const mineRes = await call(rep, '/support', { method: 'POST', body: JSON.stringify({ account: repAccts[0], subject: 'rep own ticket', priority: 'Normal' }) });
            ok(mineRes.status === 201, `rep can open a ticket on their own account (${mineRes.status})`);
        }

        // ---- Medic agent: scoped, read-only ----
        const medicMint = await call(rep, '/agent-keys', { method: 'POST', body: JSON.stringify({ agent_key: 'medic', label: 'support test' }) });
        ok(medicMint.status === 201, `rep can mint a Medic key (support agent is online) (${medicMint.status})`);
        const minted = await medicMint.json();
        if (minted.secret) {
            const agentList = await call(minted.secret, '/support');
            const agentTickets = await agentList.json();
            ok(agentList.status === 200 && Array.isArray(agentTickets) && agentTickets.every((tk) => repAccts.includes(tk.account)),
                "Medic agent reads tickets, scoped to the rep who granted it");
            const agentWrite = await call(minted.secret, '/support', { method: 'POST', body: JSON.stringify({ account: repAccts[0], subject: 'agent write' }) });
            ok(agentWrite.status === 403, `read-only Medic agent cannot open a ticket (${agentWrite.status})`);
            await call(rep, `/agent-keys/${minted.id}`, { method: 'DELETE' });
        }

        expect(__fail, __fail.join('\n')).toEqual([]);
    });
});
