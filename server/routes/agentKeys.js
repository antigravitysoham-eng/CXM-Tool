import express from 'express';
import { z } from 'zod';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { agentKeyRepo } from '../repositories/agentKeyRepo.js';
import { agentSessionRepo } from '../repositories/agentSessionRepo.js';
import { agentProposalRepo } from '../repositories/agentProposalRepo.js';
import { userRepo } from '../repositories/userRepo.js';
import { executeProposal } from '../services/proposalService.js';
import { visibleAgents, canUseAgent } from '../agents/registry.js';
import { buildManifest } from '../services/manifestService.js';
import { config } from '../config.js';
import { validate } from '../validation/accountSchema.js';

const router = express.Router();
router.use(authenticateToken);

// The caller's admin-provisioned agent-access level, read LIVE from their user
// row (not the JWT, which may predate the grant). 'none' | 'read' | 'write'.
async function agentAccessLevel(userId) {
    const u = await userRepo.get(userId);
    return u?.agent_access || 'read';
}

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
});

// A person manages their own agent keys. Agents can't reach this router at all
// (the segment is on the agent forbidden-list) — so no key can mint another key.
const mintSchema = z.object({
    agent_key: z.string().trim().min(1),
    label: z.string().trim().max(80).optional().default('')
});

// Which agents may I mint a key for? Exactly the ones I'm allowed to use — a key
// can never grant reach I don't have myself.
router.get('/mintable', wrap(async (req, res) => {
    const level = await agentAccessLevel(req.user.id);
    // No admin-granted agent access → nothing is mintable, whatever the modules.
    const agents = level === 'none' ? [] : (await visibleAgents(req.user)).filter((a) => a.online);
    res.json({
        agentAccess: level,
        canWrite: level === 'write',
        agents: agents.map((a) => ({
            key: a.key, name: a.name, emoji: a.emoji, color: a.color,
            tagline: a.tagline, scope: a.apiScope
        }))
    });
}));

/**
 * The capability manifest ("agentic file") for an agent identity — what the user
 * pastes into their own agent. Gated by canUseAgent: you can only generate a
 * manifest for an agent you're allowed to use, and it describes only what that
 * agent may reach.  ?agent=neo&format=bundle|openapi|tools|mcp|skill
 */
router.get('/manifest', wrap(async (req, res) => {
    const agentKey = String(req.query.agent || '').trim();
    const format = String(req.query.format || 'bundle').trim();
    if (!(await canUseAgent(req.user, agentKey))) {
        return res.status(403).json({ error: 'You do not have access to that agent.' });
    }
    // Self-describing base URL (respects a proxy via trust-proxy), overridable.
    const baseUrl = config.agentApiBaseUrl || `${req.protocol}://${req.get('host')}/api/v1`;
    // The manifest matches the key the caller will actually mint: a write-
    // provisioned user's file lists the writes their agent may propose.
    const canWrite = (await agentAccessLevel(req.user.id)) === 'write';
    const manifest = buildManifest(agentKey, { baseUrl, userName: req.user.name, format, canWrite });
    if (!manifest) return res.status(400).json({ error: 'Unknown agent or format' });

    // The skill card is plain text; serve it as such so it downloads cleanly.
    if (format === 'skill') {
        res.type('text/markdown').send(manifest.skill);
        return;
    }
    res.json(manifest);
}));

router.get('/', wrap(async (req, res) => {
    res.json(await agentKeyRepo.list(req.user.id));
}));

// Live agent sessions — which of my agent identities are running right now.
router.get('/sessions', wrap(async (req, res) => {
    res.json({
        sessions: await agentSessionRepo.listSessions(req.user.id),
        swarmAttempts: await agentSessionRepo.conflictCount(req.user.id),
        // Off-manifest attempts: an agent reaching for something it was never
        // granted — a probe, an export, a skill of its own. All refused.
        probeAttempts: await agentSessionRepo.probeCount(req.user.id),
        // Writes my agents proposed that still await a human decision.
        pendingProposals: await agentProposalRepo.pendingCount({ userId: req.user.id })
    });
}));

// ---- the write approval queue ----
// A user sees proposals their own agents filed; admins/managers govern the whole
// queue (they are the approvers) and see every user's.
router.get('/proposals', wrap(async (req, res) => {
    const governs = req.user.role === 'admin' || req.user.role === 'manager';
    const status = req.query.status ? String(req.query.status) : null;
    res.json(await agentProposalRepo.list({
        userId: governs ? null : req.user.id,
        status
    }));
}));

// Approve → the write executes now, as the granting user, through the normal
// ABAC-scoped path. Reject → nothing happens. Either way it's recorded and can't
// be decided twice. Agents can't reach this (requireRole refuses req.agent).
router.post('/proposals/:id/approve', requireRole('admin', 'manager'), wrap(async (req, res) => {
    const proposal = await agentProposalRepo.get(Number(req.params.id));
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (proposal.status !== 'pending') return res.status(409).json({ error: `Already ${proposal.status}` });

    let result;
    try {
        result = await executeProposal(proposal);
    } catch (err) {
        // The write itself failed (validation, scope, not-found). Record the
        // outcome on the proposal and surface it — don't leave it dangling.
        const decided = await agentProposalRepo.decide(proposal.id, {
            status: 'rejected', deciderId: req.user.id, deciderName: req.user.name,
            result: { ok: false, error: err.message || 'Execution failed' }
        });
        return res.status(err.status || 400).json({ error: err.message || 'Execution failed', proposal: decided });
    }

    const decided = await agentProposalRepo.decide(proposal.id, {
        status: 'approved', deciderId: req.user.id, deciderName: req.user.name, result
    });
    if (!decided) return res.status(409).json({ error: 'Proposal was already decided' });
    res.json({ approved: true, proposal: decided });
}));

router.post('/proposals/:id/reject', requireRole('admin', 'manager'), wrap(async (req, res) => {
    const decided = await agentProposalRepo.decide(Number(req.params.id), {
        status: 'rejected', deciderId: req.user.id, deciderName: req.user.name,
        result: { ok: false, error: 'Rejected by reviewer' }
    });
    if (!decided) return res.status(404).json({ error: 'Proposal not found or already decided' });
    res.json({ rejected: true, proposal: decided });
}));

// The agent audit trail — every action my agents took, separate from my own.
router.get('/audit', wrap(async (req, res) => {
    res.json(await agentSessionRepo.listAudit(req.user.id, { limit: Number(req.query.limit) || 100 }));
}));

router.post('/', wrap(async (req, res) => {
    const { agent_key, label } = validate(mintSchema, req.body);
    // Admin-provisioned gate: no agent access, no key — regardless of modules.
    const level = await agentAccessLevel(req.user.id);
    if (level === 'none') {
        return res.status(403).json({ error: "Agent access isn't enabled for your account. Ask an admin to turn it on." });
    }
    // You can only delegate authority you hold: minting a key for an agent you
    // aren't permitted to use is refused here, before any key exists.
    if (!(await canUseAgent(req.user, agent_key))) {
        return res.status(403).json({ error: 'You do not have access to that agent.' });
    }
    // The key inherits the user's provisioned level: 'write' keys may propose
    // changes (through the approval queue); 'read' keys are read-only.
    const canWrite = level === 'write';
    const minted = await agentKeyRepo.mint(req.user.id, { agentKey: agent_key, label, canWrite });
    // The secret is returned exactly once — the client must surface it now.
    res.status(201).json(minted);
}));

router.delete('/:id', wrap(async (req, res) => {
    const r = await agentKeyRepo.revoke(req.user.id, Number(req.params.id));
    if (r.notFound) return res.status(404).json({ error: 'Key not found' });
    res.json(r);
}));

/**
 * The manifest for the key making the request.
 *
 * `/manifest?agent=` above is for a signed-in human choosing an agent to mint.
 * This one is for the agent itself: an MCP client or SDK presents its key and
 * learns which operations it may call. It returns nothing the caller was not
 * already granted, which is why the middleware lets it through the manifest
 * gate — a client that cannot discover its own capabilities has to be told them
 * out of band, and out-of-band lists go stale.
 */
router.get('/manifest-for-key', wrap(async (req, res) => {
    if (!req.agent) return res.status(400).json({ error: 'This endpoint is for agent keys. Sign-in tokens should use /manifest?agent=.' });
    const baseUrl = config.agentApiBaseUrl || `${req.protocol}://${req.get('host')}/api/v1`;
    const manifest = buildManifest(req.agent.agent_key, {
        baseUrl, userName: req.user?.name, format: 'bundle', canWrite: !!req.agent.can_write
    });
    if (!manifest) return res.status(400).json({ error: 'Unknown agent' });
    res.json(manifest);
}));

export default router;
