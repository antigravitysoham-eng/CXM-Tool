import { getDb } from '../db.js';

/**
 * Activity Log — a unified, admin-facing audit of who did what.
 *
 * Two sources merged newest-first:
 *  - activity_log: human actions (logins + every write), captured by the
 *    activityLog middleware.
 *  - agent_audit: delegated API-key agent actions (already captured in auth).
 * The read side normalises both into one shape and offers filtering by actor,
 * action/task and date so the User & Agent Access page can slice it.
 */

export const activityRepo = {
    // Fire-and-forget insert of one human action. Never throws into the caller.
    async record(row) {
        try {
            const db = await getDb();
            await db.run(
                `INSERT INTO activity_log (actor_id, actor_name, role, action, entity, entity_id, method, path, status, detail, at)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
                [row.actor_id ?? null, row.actor_name || '', row.role || '', row.action || '', row.entity || '',
                    row.entity_id || '', row.method || '', row.path || '', row.status ?? null, row.detail || '', new Date().toISOString()]
            );
        } catch { /* telemetry must never break a request */ }
    },

    async logLogin(user) {
        return this.record({
            actor_id: user.id, actor_name: user.name || user.email || 'user', role: user.role || 'rep',
            action: 'Signed in', entity: 'session', method: 'POST', path: '/auth/login', status: 200
        });
    },

    /** Merged, filtered, newest-first activity across humans and agents. */
    async list({ actor, action, entity, from, to, limit = 200 } = {}) {
        const db = await getDb();
        const cap = Math.min(1000, Math.max(1, Number(limit) || 200));

        const humans = (await db.all('SELECT * FROM activity_log ORDER BY id DESC LIMIT 2000')).map((r) => ({
            source: 'user', actor_type: 'user', actor_name: r.actor_name, role: r.role,
            action: r.action, entity: r.entity, entity_id: r.entity_id,
            method: r.method, path: r.path, status: r.status, at: r.at
        }));

        // Agent audit, with the agent's display name.
        const agentRows = await db.all(
            `SELECT a.*, c.agent_name FROM agent_audit a
             LEFT JOIN agent_credentials c ON c.id = a.credential_id
             ORDER BY a.id DESC LIMIT 2000`
        ).catch(() => []);
        const agents = agentRows.map((r) => ({
            source: 'agent', actor_type: 'agent', actor_name: r.agent_name || r.agent_key || 'agent', role: 'agent',
            action: labelForAgent(r), entity: entityForAgentPath(r.path), entity_id: '',
            method: r.method, path: r.path, status: r.status, at: r.at
        }));

        let all = [...humans, ...agents].sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0));

        if (actor && actor !== 'All') all = all.filter((r) => r.actor_name === actor);
        if (action && action !== 'All') all = all.filter((r) => r.action === action);
        if (entity && entity !== 'All') all = all.filter((r) => r.entity === entity);
        if (from) all = all.filter((r) => (r.at || '').slice(0, 10) >= from);
        if (to) all = all.filter((r) => (r.at || '').slice(0, 10) <= to);
        return all.slice(0, cap);
    },

    /** Distinct actors + actions + entities present, for the filter dropdowns. */
    async meta() {
        const rows = await this.list({ limit: 1000 });
        const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();
        return {
            actors: uniq(rows.map((r) => r.actor_name)),
            actions: uniq(rows.map((r) => r.action)),
            entities: uniq(rows.map((r) => r.entity))
        };
    }
};

// Agent audit rows store a coarse action ('request'/'denied'/…) + the raw path.
const AGENT_ACTIONS = { request: 'Called', denied: 'Denied', lease_conflict: 'Blocked (lease)', takeover: 'Took over', off_manifest: 'Off-manifest', proposed: 'Proposed change' };
const entityForAgentPath = (p) => {
    const seg = String(p || '').replace(/^\/api(\/v1)?/, '').replace(/^\/+/, '').split(/[/?]/)[0];
    return seg || 'api';
};
const labelForAgent = (r) => `${AGENT_ACTIONS[r.action] || r.action} ${entityForAgentPath(r.path)}`;
