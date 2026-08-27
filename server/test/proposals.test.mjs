import { describe, it, expect } from 'vitest';

const API = 'http://localhost:5099/api';

const login = async (email, password) => (await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
})).json()).token;

// A human call (JWT).
const call = (t, p, opts = {}) => fetch(`${API}${p}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
});
// An agent call (agk_ key as bearer).
const agent = (key, p, opts = {}) => fetch(`${API}${p}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...(opts.headers || {}) }
});

describe('agent write approval queue + admin provisioning', () => {
    it('all checks pass', async () => {
        const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

        const admin = await login('demo@example.com', 'password123');

        // Resolve the demo user's id so we can provision its agent access.
        const users = await (await call(admin, '/users')).json();
        const demo = users.find((u) => u.email === 'demo@example.com');
        ok(!!demo, `found demo user (id ${demo?.id})`);

        // An account the admin can edit — target for the write proposal.
        const accounts = await (await call(admin, '/accounts')).json();
        const target = accounts[0];
        ok(!!target, `have an account to target (id ${target?.id}, "${target?.name}")`);

        const setAccess = (level) => call(admin, `/users/${demo.id}`, {
            method: 'PATCH', body: JSON.stringify({ agent_access: level })
        });

        // ---- provisioning gate: 'none' means no key at all ----
        await setAccess('none');
        const noneRes = await call(admin, '/agent-keys', { method: 'POST', body: JSON.stringify({ agent_key: 'aukat', label: 'blocked' }) });
        ok(noneRes.status === 403, `agent_access=none blocks minting (got ${noneRes.status})`);

        // ---- read provisioning: key mints read-only, writes are refused ----
        await setAccess('read');
        const readKey = await (await call(admin, '/agent-keys', {
            method: 'POST', body: JSON.stringify({ agent_key: 'aukat', label: 'read key' })
        })).json();
        ok(readKey.secret && readKey.can_write === false, 'read grant mints a read-only key (can_write=false)');

        // read op works
        const readList = await agent(readKey.secret, '/accounts');
        ok(readList.status === 200, `read-only key can list accounts (${readList.status})`);

        // a write from a read-only key is refused, and never in the manifest
        const readWrite = await agent(readKey.secret, `/accounts/${target.id}`, {
            method: 'PATCH', body: JSON.stringify({ next_step: 'should be blocked' })
        });
        ok(readWrite.status === 403, `read-only key cannot write (${readWrite.status})`);

        // manifest for a read grant contains no write tools
        const readManifest = await (await call(admin, '/agent-keys/manifest?agent=aukat')).json();
        const readToolNames = readManifest.mcp.tools.map((t) => t.name);
        ok(!readToolNames.includes('createAccount') && !readToolNames.includes('updateAccount'),
            'read manifest omits write tools');

        // free the lease before switching keys
        await call(admin, `/agent-keys/${readKey.id}`, { method: 'DELETE' });

        // ---- write provisioning: agent proposes, nothing mutates yet ----
        await setAccess('write');
        const writeKey = await (await call(admin, '/agent-keys', {
            method: 'POST', body: JSON.stringify({ agent_key: 'aukat', label: 'write key' })
        })).json();
        ok(writeKey.can_write === true, 'write grant mints a write-capable key (can_write=true)');

        // manifest for a write grant now lists the writes it may PROPOSE
        const writeManifest = await (await call(admin, '/agent-keys/manifest?agent=aukat')).json();
        const writeToolNames = writeManifest.mcp.tools.map((t) => t.name);
        ok(writeToolNames.includes('updateAccount') && writeToolNames.includes('createAccount'),
            'write manifest lists write tools');

        // the agent proposes an update — expect 202, a pending proposal
        const proposeRes = await agent(writeKey.secret, `/accounts/${target.id}`, {
            method: 'PATCH', body: JSON.stringify({ next_step: 'Agent-proposed next step' })
        });
        const proposeBody = await proposeRes.json();
        ok(proposeRes.status === 202 && proposeBody.proposal?.status === 'pending',
            `write is diverted to a pending proposal (${proposeRes.status})`);
        const proposalId = proposeBody.proposal?.id;

        // the account is NOT changed yet — the write hasn't executed
        const beforeApprove = await (await call(admin, `/accounts/${target.id}`)).json();
        ok(beforeApprove.next_step !== 'Agent-proposed next step', 'the target is unchanged while the proposal is pending');

        // the proposal shows up in the queue
        const queue = await (await call(admin, '/agent-keys/proposals?status=pending')).json();
        ok(queue.some((p) => p.id === proposalId), 'the proposal appears in the pending queue');

        // sessions surfaces the pending count
        const sessions = await (await call(admin, '/agent-keys/sessions')).json();
        ok((sessions.pendingProposals || 0) >= 1, `sessions reports pending proposals (${sessions.pendingProposals})`);

        // ---- approval executes the write, as the granting user ----
        const approveRes = await call(admin, `/agent-keys/proposals/${proposalId}/approve`, { method: 'POST' });
        const approveBody = await approveRes.json();
        ok(approveRes.status === 200 && approveBody.proposal?.status === 'approved', `approving succeeds (${approveRes.status})`);

        const afterApprove = await (await call(admin, `/accounts/${target.id}`)).json();
        ok(afterApprove.next_step === 'Agent-proposed next step', 'the write took effect only after approval');

        // approving again is refused (no double execution)
        const reApprove = await call(admin, `/agent-keys/proposals/${proposalId}/approve`, { method: 'POST' });
        ok(reApprove.status === 409, `a decided proposal cannot be approved twice (${reApprove.status})`);

        // ---- rejection: nothing happens ----
        const propose2 = await (await agent(writeKey.secret, '/accounts', {
            method: 'POST', body: JSON.stringify({ name: 'Agent Proposed Co', type: 'Prospect' })
        })).json();
        const rejectRes = await call(admin, `/agent-keys/proposals/${propose2.proposal.id}/reject`, { method: 'POST' });
        const rejectBody = await rejectRes.json();
        ok(rejectRes.status === 200 && rejectBody.proposal?.status === 'rejected', `rejecting a proposal works (${rejectRes.status})`);
        const afterReject = await (await call(admin, '/accounts')).json();
        ok(!afterReject.some((a) => a.name === 'Agent Proposed Co'), 'a rejected create never reaches the database');

        // ---- an off-manifest write is still refused even on a write key ----
        // DELETE /accounts/{id} exists as a route but is NOT in the catalogue.
        const offManifest = await agent(writeKey.secret, `/accounts/${target.id}`, { method: 'DELETE' });
        ok(offManifest.status === 403, `a write not in the manifest is refused (${offManifest.status})`);
        // and it counts as a probe, not a proposal
        const sessions2 = await (await call(admin, '/agent-keys/sessions')).json();
        ok((sessions2.probeAttempts || 0) >= 1, `the off-manifest write is logged as a probe (${sessions2.probeAttempts})`);

        // cleanup: revoke the key, restore demo to the default grant
        await call(admin, `/agent-keys/${writeKey.id}`, { method: 'DELETE' });
        await setAccess('read');

        expect(__fail, __fail.join('\n')).toEqual([]);
    });
});
