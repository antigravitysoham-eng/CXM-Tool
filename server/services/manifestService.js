import { getAgent } from '../agents/registry.js';
import { operationsForAgent } from '../data/agentApi.js';

/**
 * The "agentic file" — a capability manifest a user drops into their own agent
 * (GPT, Hermes, Claude/MCP) so it learns how to drive this platform.
 *
 * All formats are generated from the one operation catalogue, scoped to the
 * agent identity, so they cannot describe anything the agent can't actually
 * reach. The key itself is never embedded — the manifest teaches the *shape*;
 * the user pastes their own secret where marked.
 */

const KEY_PLACEHOLDER = 'YOUR_AGENT_KEY';

// ---- shared: JSON-Schema properties for an operation's inputs ----
function inputSchema(op) {
    const properties = {};
    const required = [];
    for (const p of op.pathParams || []) {
        properties[p.name] = { type: 'string', description: p.desc || '' };
        required.push(p.name);
    }
    for (const q of op.query || []) {
        properties[q.name] = { type: 'string', description: q.desc || '' };
    }
    for (const [name, spec] of Object.entries(op.body || {})) {
        properties[name] = { type: spec.type || 'string', description: spec.desc || '' };
        required.push(name);
    }
    return { type: 'object', properties, required };
}

// ---- OpenAPI 3.1 ----
function toOpenApi(agent, ops, baseUrl, canWrite) {
    const paths = {};
    for (const op of ops) {
        const parameters = [
            ...(op.pathParams || []).map((p) => ({
                name: p.name, in: 'path', required: true, schema: { type: 'string' }, description: p.desc || ''
            })),
            ...(op.query || []).map((q) => ({
                name: q.name, in: 'query', required: false, schema: { type: 'string' }, description: q.desc || ''
            }))
        ];
        const operation = {
            operationId: op.id,
            summary: op.summary,
            responses: { 200: { description: op.returns || 'OK' } }
        };
        if (parameters.length) operation.parameters = parameters;
        if (op.body) {
            operation.requestBody = {
                required: true,
                content: { 'application/json': { schema: inputSchema({ body: op.body }) } }
            };
        }
        paths[op.path] = { ...(paths[op.path] || {}), [op.method.toLowerCase()]: operation };
    }
    return {
        openapi: '3.1.0',
        info: {
            title: `AGCX — ${agent.name} agent`,
            version: '1.0.0',
            description: `Permission-scoped access to the AGCX CX platform as the ${agent.name} agent. `
                + (canWrite
                    ? 'Reads run directly; writes are PROPOSED and take effect only after a human approves them (HTTP 202 returns a pending proposal). '
                    : 'Read-only. ')
                + 'Authenticate with your agent key as a bearer token. One instance of an agent identity may run at a time.'
        },
        servers: [{ url: baseUrl }],
        security: [{ agentKey: [] }],
        components: {
            securitySchemes: {
                agentKey: {
                    type: 'http', scheme: 'bearer',
                    description: 'Your agent key (agk_live_…), shown once at creation. Read-only and scoped to your permissions.'
                }
            }
        },
        paths
    };
}

// ---- OpenAI function-calling tools ----
function toOpenAiTools(ops) {
    return ops.map((op) => ({
        type: 'function',
        function: { name: op.id, description: op.summary, parameters: inputSchema(op) }
    }));
}

// ---- MCP tool definitions ----
function toMcpTools(agent, ops, baseUrl, canWrite) {
    return {
        // Shape a thin MCP bridge (or an MCP-capable client) can serve directly.
        server: { name: `agcx-${agent.key}`, description: `AGCX ${agent.name} agent (${canWrite ? 'read + propose-writes' : 'read-only'})` },
        transport: { baseUrl, auth: { type: 'bearer', valueFrom: KEY_PLACEHOLDER } },
        tools: ops.map((op) => ({
            name: op.id,
            description: op.summary,
            method: op.method,
            path: op.path,
            inputSchema: inputSchema(op)
        }))
    };
}

// ---- natural-language skill card (for a raw model via its system prompt) ----
function toSkillCard(agent, ops, baseUrl, userName, canWrite) {
    const lines = ops.map((op) => {
        const params = [
            ...(op.pathParams || []).map((p) => `{${p.name}}`),
            ...(op.query || []).map((q) => `?${q.name}=`)
        ].join(' ');
        const bodyHint = op.body ? `  body: ${JSON.stringify(Object.fromEntries(Object.keys(op.body).map((k) => [k, '…'])))}` : '';
        const tag = op.write ? ' [PROPOSE — needs human approval]' : '';
        return `- ${op.method} ${op.path}${params ? ' ' + params : ''} — ${op.summary}${tag}${bodyHint}`;
    });
    return [
        `# You are the ${agent.name} agent on AGCX`,
        '',
        `You act for **${userName}** on the AGCX customer-experience platform, with their`,
        canWrite
            ? 'permissions and no more. You may **read** freely; any **write is a proposal** that a human must approve before it takes effect.'
            : 'permissions and no more. Everything you can do here is **read-only**.',
        '',
        `Base URL: ${baseUrl}`,
        `Auth: send \`Authorization: Bearer ${KEY_PLACEHOLDER}\` on every request.`,
        'Your key was shown once when it was created; keep it wherever you store secrets.',
        '',
        'You can call:',
        ...lines,
        '',
        'Rules you must respect:',
        '- Only one instance of you may run at once — a second is refused (HTTP 409).',
        canWrite
            ? '- A write returns HTTP 202 with a pending proposal id; it has NOT happened yet. Do not retry it as if it failed.'
            : '- You cannot write, manage keys, or see anything the person you act for cannot.',
        '- You may ONLY call the operations listed above. Anything else — a probe, an export, a scan, a skill you brought — is refused (HTTP 403).',
        '- If a call returns 401 your key was revoked; stop and tell the user.'
    ].join('\n');
}

/**
 * Build one or all manifest formats for an agent identity.
 * `format`: 'openapi' | 'tools' | 'mcp' | 'skill' | 'bundle' (default).
 */
export function buildManifest(agentKey, { baseUrl, userName = 'the account owner', format = 'bundle', canWrite = false } = {}) {
    const agent = getAgent(agentKey);
    if (!agent) return null;
    // A write-provisioned key's manifest lists the writes it may propose; a
    // read-only key's manifest never mentions them.
    const ops = operationsForAgent(agentKey, { includeWrites: canWrite });

    const all = {
        agent: { key: agent.key, name: agent.name, emoji: agent.emoji, scope: agent.apiScope, canWrite },
        baseUrl,
        openapi: toOpenApi(agent, ops, baseUrl, canWrite),
        tools: toOpenAiTools(ops),
        mcp: toMcpTools(agent, ops, baseUrl, canWrite),
        skill: toSkillCard(agent, ops, baseUrl, userName, canWrite)
    };
    if (format === 'bundle') return all;
    if (all[format] !== undefined) return { [format]: all[format], agent: all.agent };
    return null;
}
