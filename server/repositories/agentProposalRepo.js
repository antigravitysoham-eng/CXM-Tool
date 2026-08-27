import { getDb } from '../db.js';

/**
 * The agent write approval queue.
 *
 * A write-provisioned agent does not mutate data — it records a proposal here.
 * A human (admin/manager) then approves it, at which point the write executes as
 * the granting user through the normal ABAC-scoped path, or rejects it, and
 * nothing happens. Either way the decision and its outcome are on the record,
 * beside the separate agent audit trail.
 */

function rowToProposal(row) {
    if (!row) return null;
    return {
        id: row.id,
        user_id: row.user_id,
        credential_id: row.credential_id,
        agent_key: row.agent_key,
        agent_name: row.agent_name,
        op_id: row.op_id,
        method: row.method,
        path: row.path,
        summary: row.summary,
        body: row.body ? JSON.parse(row.body) : {},
        status: row.status,
        created_at: row.created_at,
        decided_at: row.decided_at || null,
        decided_by: row.decided_by || null,
        decided_by_name: row.decided_by_name || null,
        result: row.result ? JSON.parse(row.result) : null
    };
}

export const agentProposalRepo = {
    async create({ userId, credentialId, agentKey, agentName, opId, method, path, summary, body }) {
        const db = await getDb();
        const now = new Date().toISOString();
        const r = await db.run(
            `INSERT INTO agent_proposals
               (user_id, credential_id, agent_key, agent_name, op_id, method, path, summary, body, status, created_at)
             VALUES (?,?,?,?,?,?,?,?,?, 'pending', ?)`,
            [userId, credentialId, agentKey, agentName, opId, method, path, summary || '', JSON.stringify(body || {}), now]
        );
        return this.get(r.lastID);
    },

    async get(id) {
        const db = await getDb();
        return rowToProposal(await db.get('SELECT * FROM agent_proposals WHERE id = ?', [id]));
    },

    /**
     * List proposals. Admins/managers govern the queue and see everything; a plain
     * user sees only proposals filed by agents they granted (their own delegates).
     */
    async list({ userId = null, status = null, limit = 100 } = {}) {
        const db = await getDb();
        const where = [];
        const params = [];
        if (userId != null) { where.push('user_id = ?'); params.push(userId); }
        if (status) { where.push('status = ?'); params.push(status); }
        const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const rows = await db.all(
            `SELECT * FROM agent_proposals ${clause} ORDER BY id DESC LIMIT ?`,
            [...params, limit]
        );
        return rows.map(rowToProposal);
    },

    async pendingCount({ userId = null } = {}) {
        const db = await getDb();
        if (userId != null) {
            const r = await db.get("SELECT COUNT(*) c FROM agent_proposals WHERE status = 'pending' AND user_id = ?", [userId]);
            return r.c;
        }
        const r = await db.get("SELECT COUNT(*) c FROM agent_proposals WHERE status = 'pending'");
        return r.c;
    },

    /**
     * Record a decision. Guarded to a pending row so a proposal can't be approved
     * twice (which would execute the write twice). Returns null if it wasn't
     * pending (already decided, or gone).
     */
    async decide(id, { status, deciderId, deciderName, result = null }) {
        const db = await getDb();
        const now = new Date().toISOString();
        const r = await db.run(
            `UPDATE agent_proposals
                SET status = ?, decided_at = ?, decided_by = ?, decided_by_name = ?, result = ?
              WHERE id = ? AND status = 'pending'`,
            [status, now, deciderId, deciderName, result ? JSON.stringify(result) : null, id]
        );
        if (!r.changes) return null;
        return this.get(id);
    }
};
