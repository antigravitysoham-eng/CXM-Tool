import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const API = 'http://localhost:5099/api';

const login = async (email, password) => (await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
})).json()).token;
const call = (t, p, opts = {}) => fetch(`${API}${p}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
});

// A minimal MCP-over-stdio client: write newline-delimited JSON-RPC, resolve by id.
function mcpClient(child) {
    const pending = new Map();
    const rl = readline.createInterface({ input: child.stdout });
    rl.on('line', (line) => {
        let msg;
        try { msg = JSON.parse(line); } catch { return; }
        if (msg.id !== undefined && pending.has(msg.id)) {
            pending.get(msg.id)(msg);
            pending.delete(msg.id);
        }
    });
    let id = 0;
    const rpc = (method, params) => new Promise((resolve) => {
        const myId = ++id;
        pending.set(myId, resolve);
        child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: myId, method, params })}\n`);
    });
    const notify = (method, params) => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
    return { rpc, notify };
}

describe('mcp reference server', () => {
    it('an external MCP client drives AGCX through the bridge', async () => {
        const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

        const admin = await login('demo@example.com', 'password123');

        // Mint a NEO key and fetch its MCP manifest, exactly as the console does.
        const mint = await (await call(admin, '/agent-keys', {
            method: 'POST', body: JSON.stringify({ agent_key: 'neo', label: 'mcp test' })
        })).json();
        const bundle = await (await call(admin, '/agent-keys/manifest?agent=neo')).json();

        // The user downloads the MCP file; write it to a temp path.
        const manifestPath = path.join(os.tmpdir(), `agcx-mcp-${Date.now()}.json`);
        fs.writeFileSync(manifestPath, JSON.stringify(bundle.mcp));

        // Spawn the reference server with the key in the environment.
        const serverPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'mcp-server', 'server.mjs');
        const child = spawn(process.execPath, [serverPath, manifestPath], {
            env: { ...process.env, AGCX_AGENT_KEY: mint.secret },
            stdio: ['pipe', 'pipe', 'inherit']
        });
        const { rpc, notify } = mcpClient(child);

        try {
            // handshake
            const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
            ok(init.result?.serverInfo?.name === 'agcx-neo' && !!init.result.protocolVersion,
                `initialize handshake: server "${init.result?.serverInfo?.name}", protocol ${init.result?.protocolVersion}`);
            notify('notifications/initialized');

            // the manifest's operations are exposed as MCP tools
            const list = await rpc('tools/list');
            const names = (list.result?.tools || []).map((t) => t.name);
            ok(names.includes('listAccounts') && names.includes('askNeo'),
                `tools/list surfaces the manifest as tools (${names.length}: ${names.slice(0, 4).join(', ')}…)`);

            // a real tool call proxies through the bridge → HTTP → scoped response
            const accounts = await rpc('tools/call', { name: 'listAccounts', arguments: {} });
            const accountsData = JSON.parse(accounts.result.content[0].text);
            ok(!accounts.result.isError && Array.isArray(accountsData) && accountsData.length > 0,
                `tools/call listAccounts returned real, scoped data (${accountsData.length} accounts)`);

            // a path-param + the natural-language NEO tool both work through the bridge
            const ask = await rpc('tools/call', { name: 'askNeo', arguments: { prompt: "how's the pipeline?" } });
            const askData = JSON.parse(ask.result.content[0].text);
            ok(!ask.result.isError && !!askData.reply,
                `tools/call askNeo answered in natural language: "${String(askData.reply).slice(0, 50)}…"`);

            // an unknown tool is a clean error, not a crash
            const bad = await rpc('tools/call', { name: 'deleteEverything', arguments: {} });
            ok(bad.result?.isError === true, 'an unknown tool returns a tool error, not a crash');
        } finally {
            child.kill();
            fs.rmSync(manifestPath, { force: true });
            await call(admin, `/agent-keys/${mint.id}`, { method: 'DELETE' });
        }

        expect(__fail, __fail.join('\n')).toEqual([]);
    });
});
