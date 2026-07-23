#!/usr/bin/env node
import fs from 'node:fs';
import readline from 'node:readline';

/**
 * AGCX reference MCP server.
 *
 * A thin bridge: it turns an agent's downloaded manifest into MCP tools and
 * proxies each tool call to the AGCX API with the agent key. It holds no
 * authority of its own — the server enforces manifest-only, read-only and the
 * ABAC ceiling, so even a buggy or hostile bridge can't exceed what the key was
 * granted. Deliberately dependency-free (Node's built-in fetch + stdio).
 *
 * Usage:
 *   AGCX_AGENT_KEY=agk_live_… node server.mjs /path/to/agcx-<agent>-mcp.json
 *
 * The base URL comes from the manifest; AGCX_BASE_URL overrides it.
 */

const MANIFEST_PATH = process.env.MCP_MANIFEST || process.argv[2];
const KEY = process.env.AGCX_AGENT_KEY;

if (!KEY) {
    process.stderr.write('agcx-mcp: set AGCX_AGENT_KEY (mint one in AGCX under User & Agent Access).\n');
    process.exit(1);
}

/**
 * Where the manifest comes from.
 *
 * A downloaded file still works — pass its path. But a file goes stale the
 * moment an operation is added or an agent's scope changes, so with no path the
 * key fetches its own manifest over the wire instead. The key already identifies
 * the agent, and the endpoint returns nothing the key was not already granted.
 */
async function loadManifest() {
    if (MANIFEST_PATH) {
        const raw = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
        // Accept either the console's full bundle ({ mcp: {...} }) or the mcp object.
        return raw.mcp || raw;
    }
    const base = (process.env.AGCX_BASE_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '');
    const res = await fetch(`${base}/agent-keys/manifest-for-key`, {
        headers: { Authorization: `Bearer ${KEY}` }
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        process.stderr.write(
            `agcx-mcp: could not fetch the manifest from ${base} (${res.status}). `
            + `Check AGCX_BASE_URL and that the key is valid. ${body.slice(0, 160)}\n`
        );
        process.exit(1);
    }
    const raw = await res.json();
    return raw.mcp || raw;
}

const mcp = await loadManifest();
const BASE = (process.env.AGCX_BASE_URL || mcp.transport?.baseUrl || '').replace(/\/$/, '');
const TOOLS = mcp.tools || [];
const SERVER_NAME = mcp.server?.name || 'agcx-agent';

const send = (msg) => process.stdout.write(`${JSON.stringify(msg)}\n`);
const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

const toolDefs = () => TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));

async function callTool(name, args = {}) {
    const tool = TOOLS.find((t) => t.name === name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);

    // Path params are substituted from args; the rest become query (GET) or body.
    let path = tool.path;
    const pathParams = [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
    for (const p of pathParams) path = path.replace(`{${p}}`, encodeURIComponent(args[p] ?? ''));
    const rest = Object.fromEntries(Object.entries(args).filter(([k]) => !pathParams.includes(k)));

    let url = BASE + path;
    const opts = { method: tool.method, headers: { Authorization: `Bearer ${KEY}` } };
    if (tool.method === 'GET') {
        const qs = new URLSearchParams(rest).toString();
        if (qs) url += `?${qs}`;
    } else {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(rest);
    }

    const res = await fetch(url, opts);
    const text = await res.text();
    return { text, ok: res.ok, status: res.status };
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async (line) => {
    const s = line.trim();
    if (!s) return;
    let msg;
    try { msg = JSON.parse(s); } catch { return; }
    const { id, method, params } = msg;

    if (method === 'initialize') {
        reply(id, {
            protocolVersion: params?.protocolVersion || '2025-06-18',
            capabilities: { tools: {} },
            serverInfo: { name: SERVER_NAME, version: '1.0.0' }
        });
    } else if (method === 'notifications/initialized' || method === 'initialized') {
        // notification — no response
    } else if (method === 'tools/list') {
        reply(id, { tools: toolDefs() });
    } else if (method === 'tools/call') {
        try {
            const { name, arguments: args } = params || {};
            const out = await callTool(name, args || {});
            reply(id, {
                content: [{ type: 'text', text: out.text }],
                // A 403 here means the server refused an off-manifest/off-scope call —
                // surfaced to the client as a tool error, not a silent failure.
                isError: !out.ok
            });
        } catch (e) {
            reply(id, { content: [{ type: 'text', text: String(e.message) }], isError: true });
        }
    } else if (method === 'ping') {
        reply(id, {});
    } else if (id !== undefined) {
        fail(id, -32601, `Method not found: ${method}`);
    }
});
