import { getDb } from '../db.js';
import { config } from '../config.js';
import { getAgent } from '../agents/registry.js';

/**
 * The single-active-session lease, and the agent audit trail.
 *
 * Lease is keyed on (user, agent identity) — NOT on the key. So minting five
 * "NEO-as-Soham" keys and running them all still yields one live NEO: the first
 * grabs the lease, the rest are turned away. A holder that goes quiet past the
 * TTL is considered gone, and another key may take over — otherwise a crashed
 * agent would lock the identity out forever.
 */

const now = () => new Date().toISOString();
const msSince = (iso) => Date.now() - new Date(iso).getTime();

export const agentSessionRepo = {
    /**
     * Try to hold the lease for (user, agent identity) with this credential.
     *
     * Returns { ok:true } if this key holds (or just took) the lease, or
     * { ok:false, holderCredentialId } if a different, still-live key holds it.
     *
     * Runs in an IMMEDIATE transaction so two racing requests can't both acquire.
     */
    async acquire(userId, agentKey, credentialId) {
        const db = await getDb();
        const ttl = config.agentLeaseTtlMs;
        await db.run('BEGIN IMMEDIATE');
        try {
            const lease = await db.get(
                'SELECT * FROM agent_sessions WHERE user_id = ? AND agent_key = ?',
                [userId, agentKey]
            );

            if (!lease) {
                await db.run(
                    `INSERT INTO agent_sessions (user_id, agent_key, credential_id, started_at, last_seen, request_count)
                     VALUES (?,?,?,?,?,1)`,
                    [userId, agentKey, credentialId, now(), now()]
                );
                await db.run('COMMIT');
                return { ok: true, event: 'acquired' };
            }

            const mine = lease.credential_id === credentialId;
            const stale = msSince(lease.last_seen) > ttl;

            if (mine) {
                await db.run(
                    'UPDATE agent_sessions SET last_seen = ?, request_count = request_count + 1 WHERE id = ?',
                    [now(), lease.id]
                );
                await db.run('COMMIT');
                return { ok: true, event: 'refresh' };
            }

            if (stale) {
                // Previous holder went quiet — this key takes over.
                await db.run(
                    'UPDATE agent_sessions SET credential_id = ?, started_at = ?, last_seen = ?, request_count = 1 WHERE id = ?',
                    [credentialId, now(), now(), lease.id]
                );
                await db.run('COMMIT');
                return { ok: true, event: 'takeover', fromCredentialId: lease.credential_id };
            }

            // A different key holds a live lease → this is the swarm case.
            await db.run('COMMIT');
            return { ok: false, holderCredentialId: lease.credential_id };
        } catch (e) {
            await db.run('ROLLBACK').catch(() => {});
            throw e;
        }
    },

    /** Free the lease a revoked key was holding, so the identity isn't stuck. */
    async releaseForCredential(credentialId) {
        const db = await getDb();
        await db.run('DELETE FROM agent_sessions WHERE credential_id = ?', [credentialId]);
    },

    /** Live sessions for a user — decorated with whether each is still fresh. */
    async listSessions(userId) {
        const db = await getDb();
        const rows = await db.all('SELECT * FROM agent_sessions WHERE user_id = ? ORDER BY last_seen DESC', [userId]);
        const ttl = config.agentLeaseTtlMs;
        return rows.map((r) => ({
            agent_key: r.agent_key,
            agent_name: getAgent(r.agent_key)?.name || r.agent_key,
            credential_id: r.credential_id,
            started_at: r.started_at,
            last_seen: r.last_seen,
            request_count: r.request_count,
            live: msSince(r.last_seen) <= ttl
        }));
    },

    /** Append one line to the agent audit trail. Never throws into a request. */
    async audit({ userId, agentKey, credentialId, action, method, path, status, detail = '' }) {
        try {
            const db = await getDb();
            await db.run(
                `INSERT INTO agent_audit (user_id, agent_key, credential_id, action, method, path, status, detail, at)
                 VALUES (?,?,?,?,?,?,?,?,?)`,
                [userId, agentKey, credentialId, action, method, path, status, detail, now()]
            );
        } catch (e) {
            console.error('agent audit write failed:', e.message);
        }
    },

    async listAudit(userId, { limit = 100 } = {}) {
        const db = await getDb();
        const rows = await db.all(
            'SELECT * FROM agent_audit WHERE user_id = ? ORDER BY id DESC LIMIT ?',
            [userId, Math.min(limit, 500)]
        );
        return rows.map((r) => ({
            ...r,
            agent_name: getAgent(r.agent_key)?.name || r.agent_key
        }));
    },

    /** Recent count of a given flagged action (swarm attempts, off-manifest probes). */
    async actionCount(userId, action, { windowMs = 3600000 } = {}) {
        const db = await getDb();
        const since = new Date(Date.now() - windowMs).toISOString();
        const r = await db.get(
            'SELECT COUNT(*) AS n FROM agent_audit WHERE user_id = ? AND action = ? AND at >= ?',
            [userId, action, since]
        );
        return r?.n || 0;
    },

    conflictCount(userId, opts) { return this.actionCount(userId, 'lease_conflict', opts); },
    probeCount(userId, opts) { return this.actionCount(userId, 'off_manifest', opts); }
};
