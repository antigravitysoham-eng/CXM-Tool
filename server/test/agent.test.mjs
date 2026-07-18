import { describe, it, expect } from 'vitest';

const API = 'http://localhost:5099/api';

const login = async (email, password) => (await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
})).json()).token;

const asUser = (t, path, opts = {}) => fetch(`${API}${path}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
});
const asAgent = (key, path, opts = {}) => fetch(`${API}${path}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...(opts.headers || {}) }
});

describe('agent access — delegation & ceiling', () => {
    it('all checks pass', async () => {
        const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

        const admin = await login('demo@example.com', 'password123');
        const rep = await login('priya@cashhorizon.io', 'demo1234');
        ok(admin && rep, 'human logins');

        // ---- you can only mint keys for agents you may use ----
        // (In the seeded roles every user has scoped access to every module, so
        //  both can mint all five online agents. What DIFFERS is what each key can
        //  then SEE — proven by the scope checks further down, not by this count.)
        const adminMintable = await (await asUser(admin, '/agent-keys/mintable')).json();
        ok(adminMintable.length === 5 && adminMintable.every((a) => a.key),
            `mintable = the online agents you may use: ${adminMintable.map((a) => a.key).join(', ')}`);
        ok(adminMintable.find((a) => a.key === 'neo')?.scope === '*',
            'NEO is mintable and carries the * (all-modules) scope');

        // Minting for an unknown / non-mintable agent is refused (the same
        // canUseAgent gate proven in the security suite).
        const badMint = await asUser(rep, '/agent-keys', { method: 'POST', body: JSON.stringify({ agent_key: 'not_an_agent' }) });
        ok(badMint.status === 403, `minting a key for a non-existent agent is refused (${badMint.status})`);

        // ---- mint a NEO key for the ADMIN, and an Aukat key for the REP ----
        const neoMint = await (await asUser(admin, '/agent-keys', {
            method: 'POST', body: JSON.stringify({ agent_key: 'neo', label: "admin's NEO" })
        })).json();
        ok(neoMint.secret && neoMint.secret.startsWith('agk_live_'), `key minted, secret shown once (${neoMint.key_prefix})`);
        const neoKey = neoMint.secret;

        const aukatMint = await (await asUser(rep, '/agent-keys', {
            method: 'POST', body: JSON.stringify({ agent_key: 'aukat', label: "priya's Aukat" })
        })).json();
        const aukatKey = aukatMint.secret;
        ok(!!aukatKey, "rep minted an Aukat key");

        // the secret is never returned again
        const listed = await (await asUser(admin, '/agent-keys')).json();
        ok(listed.every((k) => !('secret' in k)) && listed.some((k) => k.id === neoMint.id),
            'listing keys never returns the secret, only metadata');

        // ---- gate 1: a valid key authenticates and reads ----
        const neoAccounts = await asAgent(neoKey, '/accounts');
        ok(neoAccounts.status === 200, `NEO agent reads /accounts (${neoAccounts.status})`);
        const neoContracts = await asAgent(neoKey, '/contracts');
        ok(neoContracts.status === 200, `NEO agent (scope *) also reads /contracts (${neoContracts.status})`);

        // ---- THE core property: an agent can never out-read its granting human ----
        const adminAccountsHuman = await (await asUser(admin, '/accounts')).json();
        const adminAccountsAgent = await (await asAgent(neoKey, '/accounts')).json();
        ok(adminAccountsAgent.length === adminAccountsHuman.length,
            `admin's NEO agent sees exactly what admin sees (${adminAccountsAgent.length} = ${adminAccountsHuman.length})`);

        const repAccountsHuman = await (await asUser(rep, '/accounts')).json();
        const repAccountsAgent = await (await asAgent(aukatKey, '/accounts')).json();
        ok(repAccountsAgent.length === repAccountsHuman.length && repAccountsAgent.length < adminAccountsHuman.length,
            `rep's agent is bounded by the REP's scope, not admin's (${repAccountsAgent.length} = rep ${repAccountsHuman.length}, < admin ${adminAccountsHuman.length})`);

        // ---- gate 2a: read-only. Writes are refused. ----
        const write = await asAgent(neoKey, '/accounts', { method: 'POST', body: JSON.stringify({ name: 'Agent Made This', segment: 'Prospect' }) });
        ok(write.status === 403, `NEO agent write refused — read-only for now (${write.status})`);
        const del = await asAgent(neoKey, '/contracts/CTR-2024-021', { method: 'DELETE' });
        ok(del.status === 403, `NEO agent DELETE refused (${del.status})`);

        // ---- gate 2b: the identity's reach ----
        const aukatContracts = await asAgent(aukatKey, '/contracts');
        ok(aukatContracts.status === 403, `Aukat agent (accounts-only) cannot reach /contracts (${aukatContracts.status})`);
        const aukatDocs = await asAgent(aukatKey, '/documents');
        ok(aukatDocs.status === 403, `Aukat agent cannot reach /documents (${aukatDocs.status})`);
        const aukatOwn = await asAgent(aukatKey, '/accounts');
        ok(aukatOwn.status === 200, `Aukat agent CAN reach its own segment /accounts (${aukatOwn.status})`);

        // ---- agents can never reach key management, user admin, or connectors ----
        //      (even NEO's * scope is overridden by the forbidden-list)
        const neoKeys = await asAgent(neoKey, '/agent-keys');
        ok(neoKeys.status === 403, `NEO agent (scope *) still cannot list keys — no minting more agents (${neoKeys.status})`);
        const neoUsers = await asAgent(neoKey, '/users');
        ok(neoUsers.status === 403, `NEO agent cannot reach /users (${neoUsers.status})`);
        const neoConnectors = await asAgent(neoKey, '/connectors');
        ok(neoConnectors.status === 403, `NEO agent cannot reach /connectors (${neoConnectors.status})`);

        // ---- an admin's agent is not an admin: role-gated actions refused ----
        const reseed = await asAgent(neoKey, '/accounts/seed-sample', { method: 'POST' });
        ok(reseed.status === 403, `admin's NEO agent cannot reseed (a delegate of an admin is not an admin) (${reseed.status})`);

        // ---- revocation kills the key immediately ----
        await asUser(admin, `/agent-keys/${neoMint.id}`, { method: 'DELETE' });
        const afterRevoke = await asAgent(neoKey, '/accounts');
        ok(afterRevoke.status === 401, `a revoked key is dead on the next call (${afterRevoke.status})`);

        // ---- garbage / forged keys ----
        const garbage = await asAgent('agk_live_totally-made-up', '/accounts');
        ok(garbage.status === 401, `an unknown agent key is rejected (${garbage.status})`);

        // cleanup
        await asUser(rep, `/agent-keys/${aukatMint.id}`, { method: 'DELETE' });

        expect(__fail, __fail.join('\n')).toEqual([]);
    });
});
