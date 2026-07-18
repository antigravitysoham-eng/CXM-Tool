import { describe, it, expect } from 'vitest';

const API = 'http://localhost:5099/api';

const login = async (email, password) => (await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
})).json()).token;
const call = (t, p, opts = {}) => fetch(`${API}${p}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
});

describe('comms (Herald) + events (Ringmaster) — engagement, attendance, ABAC', () => {
    it('all checks pass', async () => {
        const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

        const admin = await login('demo@example.com', 'password123');
        const rep = await login('priya@cashhorizon.io', 'demo1234');
        ok(admin && rep, 'admin + rep logins');

        const customers = (await (await call(admin, '/accounts')).json()).filter((a) => a.segment === 'Customer');
        const acct = customers[0].name;

        // Comms (Herald) and Events (Ringmaster) are central, admin-only modules —
        // reps have no policy for them at all.

        // ═══════════ Comms (Herald) ═══════════
        const cMeta = await (await call(admin, '/comms/meta')).json();
        ok(cMeta.types?.includes('Newsletter') && cMeta.statuses?.includes('Sent'), 'comms meta carries types + statuses');

        const comm = await (await call(admin, '/comms', { method: 'POST', body: JSON.stringify({ account: acct, title: 'Q3 newsletter', type: 'Newsletter', recipients: 100 }) })).json();
        ok(comm.id && comm.status === 'Draft', `created a comm campaign (status ${comm.status})`);

        // send with engagement -> derived open/click rates
        const sent = await (await call(admin, `/comms/${comm.id}/send`, { method: 'POST', body: JSON.stringify({ recipients: 100, opens: 60, clicks: 15 }) })).json();
        ok(sent.status === 'Sent' && sent.openRate === 60 && sent.clickRate === 15, `send derives open/click rates (${sent.openRate}%/${sent.clickRate}%)`);

        // clicks are clamped to opens
        const clamp = await (await call(admin, `/comms/${comm.id}`, { method: 'PATCH', body: JSON.stringify({ opens: 40, clicks: 90 }) })).json();
        ok(clamp.clicks <= clamp.opens, 'clicks are clamped to opens');

        const cStats = await (await call(admin, '/comms/stats')).json();
        ok(cStats.sent >= 1 && typeof cStats.avgOpenRate === 'number', `comms stats: ${cStats.sent} sent, ${cStats.avgOpenRate}% avg open`);

        // Comms + Events are admin-only central modules: the Herald / Ringmaster
        // agents are NOT on the rep's roster (module policy gates agent visibility).
        const repAgentKeys = (await (await call(rep, '/agents')).json()).agents.map((a) => a.key);
        ok(!repAgentKeys.includes('herald') && !repAgentKeys.includes('ringmaster'), 'the rep roster excludes the admin-only Herald + Ringmaster agents');

        // ═══════════ Events (Ringmaster) ═══════════
        const eMeta = await (await call(admin, '/events/meta')).json();
        ok(eMeta.types?.includes('Webinar') && eMeta.statuses?.includes('Completed'), 'events meta carries types + statuses');

        const soon = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
        const ev = await (await call(admin, '/events', { method: 'POST', body: JSON.stringify({ account: acct, title: 'Deep-dive webinar', type: 'Webinar', status: 'Open', starts_at: soon, capacity: 100 }) })).json();
        ok(ev.id && ev.upcoming === true, 'created an upcoming event');

        // registered clamped to capacity, attended clamped to registered
        const reg = await (await call(admin, `/events/${ev.id}`, { method: 'PATCH', body: JSON.stringify({ registered: 150, attended: 200 }) })).json();
        ok(reg.registered === 100 && reg.attended <= reg.registered, 'registered clamped to capacity, attended to registered');

        const done = await (await call(admin, `/events/${ev.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'Completed', attended: 70 }) })).json();
        ok(done.attendanceRate === 70, `attendance rate derived (${done.attendanceRate}%)`);

        const eStats = await (await call(admin, '/events/stats')).json();
        ok(eStats.events >= 1 && Array.isArray(eStats.next) && typeof eStats.totalRegistered === 'number', `events stats: ${eStats.events} events, ${eStats.totalRegistered} registrations`);

        // ═══════════ agents: admin can mint + use, read-only on writes ═══════════
        for (const [key, statPath, writePath] of [
            ['herald', '/comms/stats', '/comms'],
            ['ringmaster', '/events/stats', '/events']
        ]) {
            // admin-only modules: a rep can't even mint the agent key
            ok((await call(rep, '/agent-keys', { method: 'POST', body: JSON.stringify({ agent_key: key }) })).status === 403,
                `a rep cannot mint an admin-only ${key} key`);
            const mint = await call(admin, '/agent-keys', { method: 'POST', body: JSON.stringify({ agent_key: key, label: `${key} test` }) });
            ok(mint.status === 201, `admin can mint a ${key} key (${mint.status})`);
            const minted = await mint.json();
            if (minted.secret) {
                ok((await call(minted.secret, statPath)).status === 200, `${key} agent can read stats`);
                ok((await call(minted.secret, writePath, { method: 'POST', body: JSON.stringify({ account: acct, title: 'x' }) })).status === 403, `read-only ${key} agent cannot write`);
                await call(admin, `/agent-keys/${minted.id}`, { method: 'DELETE' });
            }
        }

        expect(__fail, __fail.join('\n')).toEqual([]);
    });
});
