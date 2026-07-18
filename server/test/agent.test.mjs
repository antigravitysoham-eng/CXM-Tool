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
        const mintableRes = await (await asUser(admin, '/agent-keys/mintable')).json();
        const adminMintable = mintableRes.agents;
        ok(adminMintable.length === 6 && adminMintable.every((a) => a.key),
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

        // ═══ the capability manifest (the "agentic file") ═══
        const neoManifest = await (await asUser(admin, '/agent-keys/manifest?agent=neo')).json();
        ok(neoManifest.openapi && neoManifest.tools && neoManifest.mcp && neoManifest.skill,
            'NEO manifest bundles all four formats: OpenAPI, OpenAI tools, MCP, skill card');
        ok(neoManifest.openapi.openapi === '3.1.0' && Object.keys(neoManifest.openapi.paths).length > 5,
            `OpenAPI is valid 3.1 and lists NEO's operations (${Object.keys(neoManifest.openapi.paths).length} paths)`);
        ok(neoManifest.tools.some((t) => t.function.name === 'askNeo') && neoManifest.tools.some((t) => t.function.name === 'listAccounts'),
            'NEO (scope *) manifest spans modules — askNeo + listAccounts both present');
        ok(!neoManifest.skill.includes(neoKey) && neoManifest.skill.includes('YOUR_AGENT_KEY'),
            'the manifest never embeds a real key — a placeholder, so it is safe to share');

        // a scoped agent's manifest is scoped: Aukat sees only account ops
        const aukatManifest = await (await asUser(rep, '/agent-keys/manifest?agent=aukat')).json();
        const aukatOps = aukatManifest.tools.map((t) => t.function.name);
        ok(aukatOps.includes('listAccounts') && !aukatOps.includes('listContracts') && !aukatOps.includes('askNeo'),
            `Aukat's manifest is confined to its ceiling: ${aukatOps.join(', ')}`);

        // you can't generate a manifest for an agent you can't use
        const badManifest = await asUser(rep, '/agent-keys/manifest?agent=not_an_agent');
        ok(badManifest.status === 403, `no manifest for an agent you can't use (${badManifest.status})`);

        // a single format, and the skill card as downloadable markdown
        const skill = await asUser(admin, '/agent-keys/manifest?agent=neo&format=skill');
        ok(skill.headers.get('content-type')?.includes('markdown') && (await skill.text()).startsWith('# You are'),
            'the skill card downloads as markdown, ready to paste into a system prompt');

        // ---- NEO's read-only POST (/neo/ask) is reachable by an agent ----
        const ask = await asAgent(neoKey, '/neo/ask', { method: 'POST', body: JSON.stringify({ prompt: "how's the pipeline?" }) });
        ok(ask.status === 200 && !!(await ask.json()).reply, `a NEO agent can ask NEO in natural language via /neo/ask (${ask.status})`);
        // ...but the sibling WRITE (/neo/confirm) stays blocked
        const confirm = await asAgent(neoKey, '/neo/confirm', { method: 'POST', body: JSON.stringify({ proposal: {} }) });
        ok(confirm.status === 403, `the read-post allowlist is exact — /neo/confirm (a write) is still refused (${confirm.status})`);
        // and a non-NEO agent can't reach /neo at all
        ok((await asAgent(aukatKey, '/neo/ask', { method: 'POST', body: JSON.stringify({ prompt: 'x' }) })).status === 403,
            'Aukat cannot reach /neo/ask — not in its ceiling');

        // ═══ the manifest IS the allowlist — nothing off it, no matter what ═══
        // The agent can call the operations its manifest declares…
        ok((await asAgent(neoKey, '/accounts/meta')).status === 200, 'NEO can call an in-manifest op (/accounts/meta)');
        const anAccount = encodeURIComponent(adminAccountsHuman[0].name);
        ok((await asAgent(neoKey, `/contracts/customer-360/${anAccount}`)).status === 200, 'NEO can call a param op (customer-360/{account})');
        ok((await asAgent(neoKey, '/invoices/stats')).status === 200, 'NEO can call /invoices/stats');
        ok((await asAgent(neoKey, '/onboarding/stats')).status === 200, 'NEO can call /onboarding/stats');

        // …but NOT real endpoints its manifest never listed. This is the probe /
        // pentest / bring-your-own-skill surface — every one refused, whatever
        // segment it's in.
        const probes = [
            '/accounts/1',                       // account by id — exists, unlisted
            '/contracts/CTR-2024-021',           // contract by id
            '/contracts/CTR-2024-021/scope',     // contract scope
            '/contracts/renewal-triggers',       // (this one IS listed — sanity below)
            '/onboarding/1',                     // onboarding detail
            '/agents',                           // agent HQ roster
            '/agents/state',                     // gamification state
            '/data/contracts/export.xlsx',       // bulk export — exfiltration
            '/custom-fields'                     // another unlisted surface
        ];
        // renewal-triggers is legitimately in the manifest, so drop it from the deny set.
        const denyProbes = probes.filter((p) => p !== '/contracts/renewal-triggers');
        let blocked = 0;
        for (const p of denyProbes) {
            const r = await asAgent(neoKey, p);
            if (r.status === 403) blocked++;
        }
        ok(blocked === denyProbes.length,
            `every off-manifest request refused (${blocked}/${denyProbes.length}) — no recon, no export, no unlisted endpoint`);
        ok((await asAgent(neoKey, '/contracts/renewal-triggers')).status === 200,
            'the control passes: a probe that IS in the manifest (renewal-triggers) is allowed');

        // the refusals are on the record as off_manifest, and counted
        const probeAudit = await (await asUser(admin, '/agent-keys/audit')).json();
        ok(probeAudit.some((a) => a.action === 'off_manifest' && a.status === 403),
            'off-manifest attempts are logged as off_manifest');
        const probeSess = await (await asUser(admin, '/agent-keys/sessions')).json();
        ok(probeSess.probeAttempts >= denyProbes.length,
            `off-manifest probes are counted for the human to see (${probeSess.probeAttempts})`);

        // even NEO's '*' scope can't reach an unlisted write — the sibling of a
        // read it CAN do (ask) — proving the allowlist is method-exact
        ok((await asAgent(neoKey, '/neo/confirm', { method: 'POST', body: JSON.stringify({ proposal: {} }) })).status === 403,
            'off-manifest write (/neo/confirm) refused while the in-manifest read (/neo/ask) is allowed');

        // ═══ the anti-swarm lease ═══
        // The admin's first NEO key has been reading throughout, so it holds the
        // (admin, NEO) lease. A SECOND NEO key for the same admin is the swarm.
        const neo2 = await (await asUser(admin, '/agent-keys', {
            method: 'POST', body: JSON.stringify({ agent_key: 'neo', label: "admin's 2nd NEO (clone)" })
        })).json();
        const swarm = await asAgent(neo2.secret, '/accounts');
        ok(swarm.status === 409,
            `a second NEO agent for the same user is turned away — the swarm is stopped at the door (${swarm.status})`);
        ok(/already active/i.test((await swarm.json()).error), 'the 409 explains only one instance may run');

        // meanwhile the original key keeps working — it holds the lease
        ok((await asAgent(neoKey, '/accounts')).status === 200, 'the key that holds the lease keeps working');

        // a DIFFERENT identity for the same user is fine (NEO and Aukat coexist)
        const adminAukat = await (await asUser(admin, '/agent-keys', {
            method: 'POST', body: JSON.stringify({ agent_key: 'aukat', label: "admin's Aukat" })
        })).json();
        ok((await asAgent(adminAukat.secret, '/accounts')).status === 200,
            'a different identity (Aukat) runs alongside NEO — the lease is per identity, not per user');

        // the swarm attempt is on the audit trail, and flagged
        const sess = await (await asUser(admin, '/agent-keys/sessions')).json();
        ok(sess.sessions.some((s) => s.agent_key === 'neo' && s.live) && sess.swarmAttempts >= 1,
            `live sessions + swarm counter visible to the human: ${sess.sessions.filter((s) => s.live).map((s) => s.agent_name).join(', ')}, ${sess.swarmAttempts} swarm attempt(s)`);
        const audit = await (await asUser(admin, '/agent-keys/audit')).json();
        ok(audit.some((a) => a.action === 'lease_conflict'),
            'the swarm attempt is recorded in the agent audit trail as lease_conflict');
        ok(audit.some((a) => a.action === 'off_manifest' && a.status === 403),
            'the earlier write attempt is on the trail too — now caught by the manifest gate (off_manifest, 403)');

        // ---- a quiet holder auto-releases: the clone takes over after the TTL ----
        // (test server sets AGENT_LEASE_TTL_MS=2000)
        await new Promise((r) => setTimeout(r, 2400));
        const takeover = await asAgent(neo2.secret, '/accounts');
        ok(takeover.status === 200,
            `once the holder goes quiet past the TTL, another key takes over — no permanent lockout (${takeover.status})`);
        const auditAfter = await (await asUser(admin, '/agent-keys/audit')).json();
        ok(auditAfter.some((a) => a.action === 'takeover'), 'the takeover is recorded too');

        await asUser(admin, `/agent-keys/${neo2.id}`, { method: 'DELETE' });
        await asUser(admin, `/agent-keys/${adminAukat.id}`, { method: 'DELETE' });

        // ---- revocation kills the key immediately, and frees its lease ----
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
