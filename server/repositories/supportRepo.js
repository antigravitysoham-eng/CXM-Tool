import { getDb } from '../db.js';
import { accountRepo } from './accountRepo.js';
import { deriveSla, FIRST_RESPONSE_TARGET_HRS } from '../data/supportSla.js';

// A ticket the desk should escalate to engineering leadership — a reported bug.
// Either typed as an Incident or resolved as a Bug Fix (the JIRA path in the guide).
export const isBugTicket = (t) => t.type === 'Incident' || t.resolution === 'Bug Fix';
// The 3-strike rule: follow up every alternate day. An open ticket untouched for
// longer than two days has gone stale.
const STALE_DAYS = 2;

/**
 * Support tickets.
 *
 * A ticket hangs off an account, so it inherits that account's access — the same
 * rule as invoices and documents. `user` is required, never optional. The SLA
 * state (breach, at-risk, attainment) is always DERIVED from the tier + priority
 * + timestamps at read time, never stored, so it can't be stale the morning after
 * it was written.
 */

async function accessibleAccounts(user) {
    if (!user) throw new Error('supportRepo: a user is required — pass req.user');
    const accounts = await accountRepo.list(user);
    return new Set(accounts.map((a) => a.name));
}

const RESOLVED = new Set(['Solution Delivered', 'Solution Accepted']);

// Sequential, human-friendly reference (TIC-0007) derived from the row id, so it's
// unique and incremental by construction. Shown in the platform and used to look a
// ticket up over WhatsApp.
export const ticketRef = (id) => `TIC-${String(id).padStart(4, '0')}`;

function rowToTicket(row, now = new Date()) {
    const base = {
        id: row.id,
        ticket_no: row.ticket_no || ticketRef(row.id),
        account: row.account || '',
        contract_id: row.contract_id || '',
        subject: row.subject || '',
        description: row.description || '',
        type: row.type || 'Question',
        priority: row.priority || 'Medium',
        status: row.status || 'Analysis in Progress',
        resolution: row.resolution || '',
        channel: row.channel || 'Zoho',
        module: row.module || '',
        sub_tab: row.sub_tab || '',
        jira_id: row.jira_id || '',
        country: row.country || '',
        timezone: row.timezone || '',
        support_tier: row.support_tier || 'Standard',
        assignee: row.assignee || '',
        requester_name: row.requester_name || '',
        requester_email: row.requester_email || '',
        opened_at: row.opened_at || row.created_at || '',
        first_response_at: row.first_response_at || '',
        resolved_at: row.resolved_at || '',
        created_at: row.created_at,
        updated_at: row.updated_at
    };
    // Fold the derived SLA state onto the row — one shape for list, stats and UI.
    return { ...base, ...deriveSla(base, now) };
}

// Resolve the tier the SLA is measured against: explicit wins, else the contract's,
// else the account's most recent contract, else Standard.
async function resolveTier(db, { support_tier, contract_id, account }) {
    if (support_tier) return support_tier;
    if (contract_id) {
        const c = await db.get('SELECT support_tier FROM contracts WHERE id = ?', [contract_id]);
        if (c?.support_tier) return c.support_tier;
    }
    if (account) {
        const c = await db.get(
            "SELECT support_tier FROM contracts WHERE account = ? AND support_tier IS NOT NULL AND support_tier != '' ORDER BY id DESC LIMIT 1",
            [account]
        );
        if (c?.support_tier) return c.support_tier;
    }
    return 'Standard';
}

export const supportRepo = {
    async list(user, { account, status, priority, breached, open } = {}) {
        const db = await getDb();
        const names = await accessibleAccounts(user);
        const where = [];
        const args = [];
        if (account) { where.push('account = ?'); args.push(account); }
        if (status) { where.push('status = ?'); args.push(status); }
        if (priority) { where.push('priority = ?'); args.push(priority); }
        const rows = await db.all(
            `SELECT * FROM support_tickets ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
             ORDER BY (status IN ('Solution Delivered','Solution Accepted')) ASC, opened_at DESC, id DESC`,
            args
        );
        let list = rows.filter((r) => names.has(r.account)).map((r) => rowToTicket(r));
        if (breached) list = list.filter((t) => t.breached);
        if (open) list = list.filter((t) => !t.resolved);
        return list;
    },

    async get(id, user) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM support_tickets WHERE id = ?', [id]);
        if (!row) return null;
        const names = await accessibleAccounts(user);
        if (!names.has(row.account)) return null; // outside access reads as not-found
        return rowToTicket(row);
    },

    // Look a ticket up by its human reference (TIC-0007 / #7 / 7). Used by NEO so a
    // ticket can be pulled over WhatsApp by the id shown in the platform.
    async getByRef(ref, user) {
        const digits = String(ref || '').replace(/[^0-9]/g, '');
        if (!digits) return null;
        return this.get(Number(digits), user);
    },

    async create(data, user) {
        const db = await getDb();
        const names = await accessibleAccounts(user);
        if (!names.has(data.account)) return { forbidden: true };

        const now = new Date().toISOString();
        const openedAt = data.opened_at || now;
        const tier = await resolveTier(db, data);

        // A ticket that opens already resolved should carry a resolved timestamp.
        const resolvedAt = data.resolved_at || (RESOLVED.has(data.status) ? now : '');

        const r = await db.run(
            `INSERT INTO support_tickets
               (ticket_no, account, contract_id, subject, description, type, priority, status,
                resolution, channel, module, sub_tab, jira_id, country, timezone,
                support_tier, assignee, requester_name, requester_email,
                opened_at, first_response_at, resolved_at, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
                '', data.account, data.contract_id || '', data.subject, data.description || '',
                data.type || 'Question', data.priority || 'Medium', data.status || 'Analysis in Progress',
                data.resolution || '', data.channel || 'Zoho', data.module || '', data.sub_tab || '',
                data.jira_id || '', data.country || '', data.timezone || '',
                tier, data.assignee || '', data.requester_name || '', data.requester_email || '',
                openedAt, data.first_response_at || '', resolvedAt, now, now
            ]
        );
        // The reference is the row id, zero-padded — unique and incremental by
        // construction, so no two tickets ever collide on it.
        await db.run('UPDATE support_tickets SET ticket_no = ? WHERE id = ?', [ticketRef(r.lastID), r.lastID]);
        return { ticket: rowToTicket(await db.get('SELECT * FROM support_tickets WHERE id = ?', [r.lastID])) };
    },

    async update(id, data, user) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM support_tickets WHERE id = ?', [id]);
        if (!row) return { notFound: true };
        const names = await accessibleAccounts(user);
        if (!names.has(row.account)) return { forbidden: true };

        const sets = [];
        const params = [];
        for (const f of ['account', 'contract_id', 'subject', 'description', 'type', 'priority',
            'status', 'resolution', 'channel', 'module', 'sub_tab', 'jira_id', 'country', 'timezone',
            'support_tier', 'assignee', 'requester_name', 'requester_email',
            'opened_at', 'first_response_at', 'resolved_at']) {
            if (data[f] !== undefined) { sets.push(`${f} = ?`); params.push(data[f]); }
        }

        const now = new Date().toISOString();
        // First touch: the first status move stamps the first response if it isn't
        // already set — that's what the response SLA is measured against.
        const statusMoved = data.status && data.status !== row.status;
        if (statusMoved && data.first_response_at === undefined && !row.first_response_at) {
            sets.push('first_response_at = ?'); params.push(now);
        }
        // Resolving without a date leaves the resolution SLA guessing.
        if (data.status && RESOLVED.has(data.status) && data.resolved_at === undefined && !row.resolved_at) {
            sets.push('resolved_at = ?'); params.push(now);
        }
        // Reopening clears the resolved stamp so the clock runs again.
        if (data.status && !RESOLVED.has(data.status) && row.resolved_at) {
            sets.push('resolved_at = ?'); params.push('');
        }

        if (!sets.length) return { ticket: rowToTicket(row) };
        sets.push('updated_at = ?'); params.push(now);
        await db.run(`UPDATE support_tickets SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
        return { ticket: rowToTicket(await db.get('SELECT * FROM support_tickets WHERE id = ?', [id])) };
    },

    async remove(id, user) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM support_tickets WHERE id = ?', [id]);
        if (!row) return { notFound: true };
        const names = await accessibleAccounts(user);
        if (!names.has(row.account)) return { forbidden: true };
        await db.run('DELETE FROM support_tickets WHERE id = ?', [id]);
        return { deleted: true };
    },

    /** Desk rollup: volume, SLA health, and the tier's actual attainment. */
    async stats(user, filters = {}) {
        const list = await this.list(user, filters);
        const open = list.filter((t) => !t.resolved);
        const resolved = list.filter((t) => t.resolved);
        const responseTimes = list.map((t) => t.response_hours_actual).filter((n) => n !== null);
        const resolutionTimes = resolved.map((t) => t.resolution_hours_actual).filter((n) => n !== null);
        const avg = (a) => (a.length ? Math.round((a.reduce((s, n) => s + n, 0) / a.length) * 10) / 10 : null);

        // Attainment = resolved tickets that met BOTH SLA promises ÷ resolved.
        const metSla = resolved.filter((t) => !t.breached).length;

        // The guide's flat promise: a first technical response within 1 hour.
        const responded = list.filter((t) => t.response_hours_actual !== null);
        const respondedIn1h = responded.filter((t) => t.response_hours_actual <= FIRST_RESPONSE_TARGET_HRS).length;

        // 3-strike rule: an open ticket not touched in > 2 days has gone stale.
        const staleBefore = Date.now() - STALE_DAYS * 86400000;
        const staleOpen = open.filter((t) => {
            const touched = new Date(t.updated_at || t.opened_at || t.created_at || 0).getTime();
            return touched && touched < staleBefore;
        }).length;

        const openBugs = open.filter(isBugTicket).length;

        const bump = (acc, k) => { acc[k] = (acc[k] || 0) + 1; return acc; };

        return {
            total: list.length,
            open: open.length,
            resolved: resolved.length,
            unassigned: open.filter((t) => !t.assignee).length,
            breached: list.filter((t) => t.breached).length,
            responseBreached: list.filter((t) => t.response_breached).length,
            resolutionBreached: list.filter((t) => t.resolution_breached).length,
            atRisk: list.filter((t) => t.at_risk).length,
            avgFirstResponseHrs: avg(responseTimes),
            avgResolutionHrs: avg(resolutionTimes),
            slaAttainment: resolved.length ? Math.round((metSla / resolved.length) * 100) : null,
            firstResponseSla: responded.length ? Math.round((respondedIn1h / responded.length) * 100) : null,
            staleOpen,
            openBugs,
            byStatus: list.reduce((a, t) => bump(a, t.status), {}),
            byPriority: list.reduce((a, t) => bump(a, t.priority), {}),
            byType: list.reduce((a, t) => bump(a, t.type), {}),
            byTier: list.reduce((a, t) => {
                a[t.tier] = a[t.tier] || { total: 0, breached: 0 };
                a[t.tier].total += 1;
                if (t.breached) a[t.tier].breached += 1;
                return a;
            }, {})
        };
    }
};
