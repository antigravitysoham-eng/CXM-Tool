import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { agentKeyRepo } from '../repositories/agentKeyRepo.js';
import { agentCanReachSegment } from '../agents/registry.js';

/**
 * Authenticate a request as either a human (JWT) or a delegated agent (API key).
 *
 * The agent branch is where the security model lives. An agent key resolves to
 * the human who minted it, so `req.user` is populated exactly as for that human
 * — every downstream ABAC check (gate 3) then runs unchanged and unaware it is
 * serving an agent. On top of that we enforce two agent-only gates here:
 *
 *   gate 1  the key is valid, not revoked, not expired
 *   gate 2  the request is within the agent identity's ceiling:
 *             · read-only  — GET only (writes arrive with the approval queue)
 *             · in-scope   — the URL segment is one this agent may reach
 *
 * gate 3 (the granting user's live ABAC scope) is the existing repository
 * scoping, untouched. Deny on any gate.
 */

// Off-limits to every agent, even NEO's '*' scope: managing keys, users or
// integrations is a human's job, and letting a delegate reach key management
// would let an agent mint more agents — the exact escalation the lease prevents,
// closed here at the door too.
const AGENT_FORBIDDEN_SEGMENTS = new Set(['agent-keys', 'users', 'connectors']);

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

    // gate 2a — read-only. Writes will route through a human approval queue in a
    // later phase; until then an agent key cannot mutate anything.
    if (req.method !== 'GET') {
        return res.status(403).json({
            error: 'Agent keys are read-only. Write access via the approval queue is not enabled yet.'
        });
    }

    // gate 2b — the agent identity's reach.
    const segment = segmentOf(req);
    if (AGENT_FORBIDDEN_SEGMENTS.has(segment)) {
        return res.status(403).json({ error: 'This resource is not available to agents.' });
    }
    if (!agentCanReachSegment(credential.agent_key, segment)) {
        return res.status(403).json({
            error: `The ${credential.agent_name} agent cannot access '${segment || 'this resource'}'.`
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
