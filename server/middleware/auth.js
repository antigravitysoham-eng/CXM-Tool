import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { agentKeyRepo } from '../repositories/agentKeyRepo.js';
import { agentSessionRepo } from '../repositories/agentSessionRepo.js';
import { operationsForAgent } from '../data/agentApi.js';

/**
 * Authenticate a request as either a human (JWT) or a delegated agent (API key).
 *
 * The agent branch is where the security model lives. An agent key resolves to
 * the human who minted it, so `req.user` is populated exactly as for that human
 * — every downstream ABAC check (gate 3) then runs unchanged and unaware it is
 * serving an agent. On top of that we enforce two agent-only gates here:
 *
 *   gate 1  the key is valid, not revoked, not expired
 *   gate 2  the request is EXACTLY one of the operations in the agent's manifest.
 *           Not merely "a GET in an allowed segment" — the specific method+path
 *           the manifest declares, and nothing else. An unlisted endpoint, a
 *           probe, an export, a scan, or any skill the agent brought along on its
 *           own is refused. The manifest the user hands their agent and the rules
 *           enforced here read from the SAME catalogue, so the file is a contract,
 *           not documentation.
 *
 * gate 3 (the granting user's live ABAC scope) is the existing repository
 * scoping, untouched. Deny on any gate.
 */

// Off-limits to every agent, even NEO's '*' scope: managing keys, users or
// integrations is a human's job. (The manifest gate already blocks these — no
// operation exists for them — but the explicit list makes the intent loud.)
const AGENT_FORBIDDEN_SEGMENTS = new Set(['agent-keys', 'users', 'connectors']);

// The request path with the /api or /api/v1 prefix and query string stripped,
// so it can be matched against catalogue templates (which start at the segment).
function pathAfterApi(req) {
    const p = (req.originalUrl || '').split('?')[0];
    return p.replace(/^\/api(\/v1)?/, '') || '/';
}

// Does a catalogue path template (e.g. '/contracts/customer-360/{account}')
// match a concrete request path? {param} matches one path segment.
function opMatchesPath(template, path) {
    const escaped = template
        .split(/\{[^}]+\}/)
        .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('[^/]+');
    return new RegExp(`^${escaped}/?$`).test(path);
}

// Is this exact request one of the operations the agent's manifest grants?
function isInManifest(agentKey, req) {
    const path = pathAfterApi(req);
    return operationsForAgent(agentKey).some((op) => op.method === req.method && opMatchesPath(op.path, path));
}

// The module segment this request targets, from the router's mount path:
//   /api/v1/accounts/… → 'accounts'   ·   /api/documents/… → 'documents'
function segmentOf(req) {
    const parts = (req.baseUrl || req.originalUrl || '').split('/').filter(Boolean);
    const api = parts.indexOf('api');
    if (api === -1) return parts[0] || '';
    return parts[api + 1] === 'v1' ? (parts[api + 2] || '') : (parts[api + 1] || '');
}

async function authenticateAgent(req, res, next, token) {
    const resolved = await agentKeyRepo.resolve(token);
    if (!resolved) return res.status(401).json({ error: 'Invalid or revoked agent key' });

    const { credential, user } = resolved;
    const segment = segmentOf(req);

    // Every resolved agent request is written to the audit trail on the way out,
    // whatever the outcome — allowed, denied, or a swarm attempt.
    let auditAction = 'request';
    res.on('finish', () => {
        agentSessionRepo.audit({
            userId: user.id, agentKey: credential.agent_key, credentialId: credential.id,
            action: res.statusCode >= 400 && auditAction === 'request' ? 'denied' : auditAction,
            method: req.method, path: req.originalUrl, status: res.statusCode
        });
    });

    // The lease — the anti-swarm gate. One live session per (user, identity);
    // a second key for the same pair is turned away while the first holds it.
    const lease = await agentSessionRepo.acquire(user.id, credential.agent_key, credential.id);
    if (!lease.ok) {
        auditAction = 'lease_conflict';
        return res.status(409).json({
            error: `Another ${credential.agent_name} agent is already active for this account. `
                + 'Only one instance of an agent identity may run at a time.'
        });
    }
    if (lease.event === 'takeover') auditAction = 'takeover';

    // gate 2 — the manifest IS the allowlist. Only the exact operations the
    // agent's manifest declares are permitted; everything else is refused,
    // whatever segment it's in. This is what stops an agent from doing anything
    // beyond what it was handed — a probe, a scan, an export, or a skill it
    // carries of its own.
    if (!isInManifest(credential.agent_key, req)) {
        // Same refusal for all off-manifest requests; clearer wording for the
        // two common shapes so an honest agent understands why.
        if (AGENT_FORBIDDEN_SEGMENTS.has(segment)) {
            auditAction = 'off_manifest';
            return res.status(403).json({ error: 'This resource is not available to agents.' });
        }
        if (req.method !== 'GET') {
            auditAction = 'off_manifest';
            return res.status(403).json({
                error: 'Agent keys are read-only. Write access via the approval queue is not enabled yet.'
            });
        }
        auditAction = 'off_manifest';
        return res.status(403).json({
            error: `That isn't in your agent's manifest. ${credential.agent_name} may only perform the operations it was granted — nothing else.`
        });
    }

    req.user = user;                 // gate 3 runs against this, live
    req.agent = credential;          // tag for audit + downstream awareness
    next();
}

// Verifies the bearer token and attaches { id, email, name, role, … } to req.user.
export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied' });

    // Agent key — resolve to the delegating human and enforce the ceiling.
    if (token.startsWith('agk_')) {
        return authenticateAgent(req, res, next, token).catch((err) => {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        });
    }

    // Human — the existing JWT flow, unchanged.
    jwt.verify(token, config.jwtSecret, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
}

/**
 * Gate a route to specific roles, e.g. requireRole('admin').
 *
 * Agents are refused outright: role-gated routes (user management, policy edits,
 * sample reseeds) are human decisions, never a delegate's — even a delegate of
 * an admin. An admin's *agent* is not an admin.
 */
export function requireRole(...roles) {
    return (req, res, next) => {
        if (req.agent) {
            return res.status(403).json({ error: 'This action is not available to agents.' });
        }
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

// Managers and admins see every account; reps see only the ones they own.
// Returns a { clause, params } fragment callers append to a WHERE.
export function accountScope(user) {
    if (user.role === 'admin' || user.role === 'manager') {
        return { clause: '1=1', params: [] };
    }
    return { clause: 'owner_id = ?', params: [user.id] };
}
