import crypto from 'crypto';
import { getDb } from '../db.js';
import { getAgent } from '../agents/registry.js';
import { agentSessionRepo } from './agentSessionRepo.js';
import { parseModuleAccess } from '../services/policyService.js';

/**
 * Delegated agent credentials.
 *
 * A key is minted by a human for one named agent and carries no authority of its
 * own — at request time it resolves back to the granting user, and every access
 * check runs against *that user's live scope*. Revoke the user, and the key dies
 * with them; that's the point of resolving live rather than baking a snapshot
 * into the key.
 *
 * The secret is shown once. We store only its SHA-256, so a database read (or a
 * leak of one) never yields a working key.
 */

const PREFIX = 'agk_live_';
const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

function rowToMeta(row) {
    return {
        id: row.id,
        agent_key: row.agent_key,
        agent_name: getAgent(row.agent_key)?.name || row.agent_key,
        label: row.label || '',
        key_prefix: row.key_prefix,
        can_write: !!row.can_write,
        revoked: !!row.revoked,
        created_at: row.created_at,
        last_used_at: row.last_used_at || null,
        expires_at: row.expires_at || null
    };
}

export const agentKeyRepo = {
    /**
     * Create a key for `agentKey` on behalf of `userId`. Returns the metadata
     * plus the plaintext secret — the ONLY time it is ever available.
     */
    async mint(userId, { agentKey, label = '', canWrite = false, expiresAt = null }) {
        const db = await getDb();
        const secret = PREFIX + crypto.randomBytes(24).toString('base64url');
        const prefix = secret.slice(0, PREFIX.length + 6) + '…';
        const now = new Date().toISOString();
        const r = await db.run(
            `INSERT INTO agent_credentials
               (user_id, agent_key, label, key_prefix, key_hash, can_write, revoked, created_at, expires_at)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [userId, agentKey, label.trim(), prefix, hash(secret), canWrite ? 1 : 0, 0, now, expiresAt]
        );
        const row = await db.get('SELECT * FROM agent_credentials WHERE id = ?', [r.lastID]);
        return { ...rowToMeta(row), secret };
    },

    /**
     * Resolve a presented token to its credential and the user it delegates for.
     * Null on any reason it shouldn't be honoured — unknown, revoked, expired.
     */
    async resolve(token) {
        if (!token || !token.startsWith(PREFIX)) return null;
        const db = await getDb();
        const row = await db.get(
            'SELECT * FROM agent_credentials WHERE key_hash = ?',
            [hash(token)]
        );
        if (!row || row.revoked) return null;
        if (row.expires_at && row.expires_at < new Date().toISOString()) return null;

        const user = await db.get('SELECT * FROM users WHERE id = ?', [row.user_id]);
        if (!user) return null; // granting user gone → key is inert

        // Touch last-used, but never let telemetry fail a request.
        db.run('UPDATE agent_credentials SET last_used_at = ? WHERE id = ?', [new Date().toISOString(), row.id])
            .catch(() => {});

        return {
            credential: rowToMeta(row),
            // The claims the rest of the stack expects on req.user — built LIVE
            // from the user row, so the key inherits current access, not stale.
            user: {
                id: user.id, email: user.email, name: user.name, role: user.role || 'rep',
                region: user.region || '', business_unit: user.business_unit || '', team: user.team || '',
                module_access: parseModuleAccess(user.module_access)
            }
        };
    },

    async list(userId) {
        const db = await getDb();
        const rows = await db.all(
            'SELECT * FROM agent_credentials WHERE user_id = ? ORDER BY id DESC',
            [userId]
        );
        return rows.map(rowToMeta);
    },

    async revoke(userId, id) {
        const db = await getDb();
        // Scoped to the owner: you can only revoke your own keys.
        const row = await db.get('SELECT * FROM agent_credentials WHERE id = ? AND user_id = ?', [id, userId]);
        if (!row) return { notFound: true };
        await db.run('UPDATE agent_credentials SET revoked = 1 WHERE id = ?', [id]);
        // Free the lease it held, so the identity isn't stuck until the TTL.
        await agentSessionRepo.releaseForCredential(id);
        return { revoked: true };
    }
};
