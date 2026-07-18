import { describe, it, expect } from 'vitest';
import { TIER_CADENCE_DAYS } from '../data/healthCadence.js';

const API = 'http://localhost:5099/api';

const login = async (email, password) => (await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
})).json()).token;
const call = (t, p, opts = {}) => fetch(`${API}${p}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
});
const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);

describe('health checks (Pulse) — tier cadence, carry-forward, ABAC', () => {
    it('all checks pass', async () => {
        const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

        const admin = await login('demo@example.com', 'password123');
        const rep = await login('priya@cashhorizon.io', 'demo1234');
        ok(admin && rep, 'admin + rep logins');

        // ---- meta ----
        const meta = await (await call(admin, '/health-checks/meta')).json();
        ok(meta.signals?.includes('Red') && meta.sentiments?.includes('Negative'), 'meta carries signals + sentiments');
        ok(meta.cadence?.Enterprise === 30 && meta.cadence?.Premium === 60 && meta.cadence?.Standard === 120,
            'meta cadence matches tier policy (1/2/4 months)');

        // ---- seed a spread of sample calls ----
        const seed = await (await call(admin, '/health-checks/seed-sample', { method: 'POST' })).json();
        ok(seed.seeded > 0, `admin seeded ${seed.seeded} health checks`);

        // ---- board is derived: cadence follows the account's support tier ----
        const board = await (await call(admin, '/health-checks/accounts')).json();
        ok(Array.isArray(board) && board.length > 0, `board returns customers (${board.length})`);
        const b0 = board[0];
        ok(['account', 'tier', 'cadenceDays', 'nextDueDate', 'overdue', 'currentSignal', 'openActions'].every((k) => k in b0),
            'each board row carries tier, cadence, next-due, signal and open actions');
        ok(board.every((h) => h.cadenceDays === (TIER_CADENCE_DAYS[h.tier] || 120)), 'cadence days match each account tier');
        // board is sorted overdue-first
        ok(board.every((h, i) => i === 0 || Number(board[i - 1].overdue) >= Number(h.overdue)), 'board is sorted overdue-first');

        // ---- a customer we can use for the carry-forward flow ----
        const customers = (await (await call(admin, '/accounts')).json()).filter((a) => a.segment === 'Customer');
        ok(customers.length > 0, 'there is at least one customer account');
        const acct = customers[0].name;

        // ---- carry-forward: open actionables move onto the next call ----
        // `first` is the most recent prior call before `second` (both newer than any
        // seeded call for this account), so `second` must carry `first`'s open items.
        const TAG = `Chase pending API credentials ${Date.now()}`;
        const first = await (await call(admin, '/health-checks/calls', {
            method: 'POST', body: JSON.stringify({ account: acct, check_date: daysAgo(2), signal: 'Amber', sentiment: 'Neutral', summary: 'Adoption plateaued.' })
        })).json();
        ok(first.id, 'logged a first health-check call');
        const withAction = await (await call(admin, `/health-checks/calls/${first.id}/actions`, {
            method: 'POST', body: JSON.stringify({ text: TAG, owner: 'CSM' })
        })).json();
        ok(withAction.actions?.some((a) => a.text === TAG && a.status === 'Open'), 'added an open actionable to the first call');

        const second = await (await call(admin, '/health-checks/calls', {
            method: 'POST', body: JSON.stringify({ account: acct, check_date: daysAgo(1), signal: 'Green', sentiment: 'Positive', summary: 'Back on track.' })
        })).json();
        ok(second.id, 'logged a second, later health-check call');
        ok(second.actions?.some((a) => a.text === TAG && a.carried_from),
            'the open actionable carried forward onto the newer call (carried_from set)');

        // the original action on the first call is now marked Carried
        const firstAgain = await (await call(admin, `/health-checks/calls/${first.id}`)).json();
        ok(firstAgain.actions.some((a) => a.status === 'Carried'), 'the original actionable is marked Carried on the prior call');

        // ---- marking an action Done stops it carrying + drops the open count ----
        const carried = second.actions.find((a) => a.carried_from);
        const doneRes = await (await call(admin, `/health-checks/actions/${carried.id}`, {
            method: 'PATCH', body: JSON.stringify({ status: 'Done' })
        })).json();
        ok(doneRes.actions.find((a) => a.id === carried.id)?.status === 'Done', 'an actionable can be marked Done');

        // ---- stats rollup ----
        const stats = await (await call(admin, '/health-checks/stats')).json();
        ok(typeof stats.accounts === 'number' && typeof stats.overdue === 'number' && typeof stats.openActions === 'number',
            `stats rollup: ${stats.accounts} accounts, ${stats.overdue} overdue, ${stats.openActions} open actions`);
        ok((stats.red + stats.amber + stats.green) <= stats.accounts, 'signal counts do not exceed the account count');

        // ---- ABAC both ways ----
        const repAccts = (await (await call(rep, '/accounts')).json()).map((a) => a.name);
        const repCalls = await (await call(rep, '/health-checks/calls')).json();
        ok(repCalls.every((c) => repAccts.includes(c.account)), 'a rep sees only calls on accounts they own');

        const adminAccts = (await (await call(admin, '/accounts')).json()).map((a) => a.name);
        const notMine = adminAccts.find((n) => !repAccts.includes(n));
        if (notMine) {
            const forbidden = await call(rep, '/health-checks/calls', { method: 'POST', body: JSON.stringify({ account: notMine, summary: 'blocked' }) });
            ok(forbidden.status === 403, `rep cannot log a check on an account they don't own (${forbidden.status})`);
        } else {
            ok(true, 'rep owns all accounts — skipping cross-account create check');
        }

        // ---- Pulse agent: scoped, read-only ----
        const mintRes = await call(rep, '/agent-keys', { method: 'POST', body: JSON.stringify({ agent_key: 'pulse', label: 'health test' }) });
        ok(mintRes.status === 201, `rep can mint a Pulse key (health agent is online) (${mintRes.status})`);
        const minted = await mintRes.json();
        if (minted.secret) {
            const agentBoard = await call(minted.secret, '/health-checks/accounts');
            ok(agentBoard.status === 200, `Pulse agent can read the health board (${agentBoard.status})`);
            const agentWrite = await call(minted.secret, '/health-checks/calls', { method: 'POST', body: JSON.stringify({ account: repAccts[0], summary: 'agent write' }) });
            ok(agentWrite.status === 403, `read-only Pulse agent cannot log a check (${agentWrite.status})`);
            await call(rep, `/agent-keys/${minted.id}`, { method: 'DELETE' });
        }

        expect(__fail, __fail.join('\n')).toEqual([]);
    });
});
