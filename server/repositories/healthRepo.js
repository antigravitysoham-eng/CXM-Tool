import { getDb } from '../db.js';
import { accountRepo } from './accountRepo.js';
import { cadenceForTier, SIGNAL_SCORE } from '../data/healthCadence.js';

/**
 * Pulse — vendor-health check calls.
 *
 * Calls are cadenced by the customer's support tier. Account-scoped like
 * everything else that hangs off an account. The vendor-health signal, the
 * next-due date and portfolio metrics are all DERIVED from the call history +
 * the tier; only the calls and their actionables are stored.
 */

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (iso, d) => { const x = new Date(iso); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000);

async function accessibleAccounts(user) {
    if (!user) throw new Error('healthRepo: a user is required — pass req.user');
    return await accountRepo.list(user);
}

// account -> support tier, from its most recent contract that carries one.
async function accountTiers(db) {
    const rows = await db.all("SELECT account, support_tier FROM contracts WHERE support_tier IS NOT NULL AND support_tier != '' ORDER BY id DESC");
    const m = {};
    for (const r of rows) if (!m[r.account]) m[r.account] = r.support_tier;
    return m;
}

export const healthRepo = {
    async listCalls(user, { account } = {}) {
        const db = await getDb();
        const names = new Set((await accessibleAccounts(user)).map((a) => a.name));
        const where = account ? 'WHERE account = ?' : '';
        const calls = await db.all(`SELECT * FROM health_calls ${where} ORDER BY check_date DESC, id DESC`, account ? [account] : []);
        const actions = await db.all('SELECT * FROM health_check_actions ORDER BY id ASC');
        const byCall = {};
        for (const a of actions) (byCall[a.call_id] ||= []).push(a);
        return calls.filter((c) => names.has(c.account)).map((c) => ({ ...c, actions: byCall[c.id] || [] }));
    },

    async getCall(id, user) {
        const db = await getDb();
        const c = await db.get('SELECT * FROM health_calls WHERE id = ?', [id]);
        if (!c) return null;
        const names = new Set((await accessibleAccounts(user)).map((a) => a.name));
        if (!names.has(c.account)) return null;
        const actions = await db.all('SELECT * FROM health_check_actions WHERE call_id = ? ORDER BY id', [id]);
        return { ...c, actions };
    },

    /**
     * Log a health-check call. Open/Carried actionables from the account's most
     * recent prior call are pulled forward onto this one (and the originals marked
     * Carried), so nothing agreed on a call is quietly dropped.
     */
    async createCall(data, user) {
        const db = await getDb();
        const names = new Set((await accessibleAccounts(user)).map((a) => a.name));
        if (!names.has(data.account)) return { forbidden: true };
        const now = new Date().toISOString();
        const checkDate = data.check_date || today();

        const prior = await db.get('SELECT * FROM health_calls WHERE account = ? ORDER BY check_date DESC, id DESC LIMIT 1', [data.account]);

        const r = await db.run(
            `INSERT INTO health_calls (account, check_date, signal, sentiment, summary, attendees, conducted_by, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [data.account, checkDate, data.signal || 'Green', data.sentiment || 'Neutral', data.summary || '',
                data.attendees || '', data.conducted_by || (user.name || ''), now, now]
        );
        const callId = r.lastID;

        if (prior) {
            const open = await db.all("SELECT * FROM health_check_actions WHERE call_id = ? AND status != 'Done'", [prior.id]);
            for (const a of open) {
                await db.run(
                    `INSERT INTO health_check_actions (call_id, account, text, status, owner, due_date, carried_from, created_at, updated_at)
                     VALUES (?,?,?,?,?,?,?,?,?)`,
                    [callId, data.account, a.text, 'Open', a.owner || '', a.due_date || '', a.id, now, now]
                );
                await db.run('UPDATE health_check_actions SET status = ?, updated_at = ? WHERE id = ?', ['Carried', now, a.id]);
            }
        }
        return { call: await this.getCall(callId, user), carried: prior ? true : false };
    },

    async updateCall(id, data, user) {
        const db = await getDb();
        const c = await db.get('SELECT * FROM health_calls WHERE id = ?', [id]);
        if (!c) return { notFound: true };
        const names = new Set((await accessibleAccounts(user)).map((a) => a.name));
        if (!names.has(c.account)) return { forbidden: true };
        const sets = []; const params = [];
        for (const f of ['check_date', 'signal', 'sentiment', 'summary', 'attendees', 'conducted_by']) {
            if (data[f] !== undefined) { sets.push(`${f} = ?`); params.push(data[f]); }
        }
        sets.push('updated_at = ?'); params.push(new Date().toISOString());
        await db.run(`UPDATE health_calls SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
        return { call: await this.getCall(id, user) };
    },

    async removeCall(id, user) {
        const db = await getDb();
        const c = await db.get('SELECT * FROM health_calls WHERE id = ?', [id]);
        if (!c) return { notFound: true };
        const names = new Set((await accessibleAccounts(user)).map((a) => a.name));
        if (!names.has(c.account)) return { forbidden: true };
        await db.run('DELETE FROM health_check_actions WHERE call_id = ?', [id]);
        await db.run('DELETE FROM health_calls WHERE id = ?', [id]);
        return { deleted: true };
    },

    async addAction(callId, data, user) {
        const db = await getDb();
        const c = await db.get('SELECT * FROM health_calls WHERE id = ?', [callId]);
        if (!c) return { notFound: true };
        const names = new Set((await accessibleAccounts(user)).map((a) => a.name));
        if (!names.has(c.account)) return { forbidden: true };
        const now = new Date().toISOString();
        await db.run(
            `INSERT INTO health_check_actions (call_id, account, text, status, owner, due_date, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?)`,
            [callId, c.account, data.text, data.status || 'Open', data.owner || '', data.due_date || '', now, now]
        );
        return { call: await this.getCall(callId, user) };
    },

    async updateAction(id, data, user) {
        const db = await getDb();
        const a = await db.get('SELECT * FROM health_check_actions WHERE id = ?', [id]);
        if (!a) return { notFound: true };
        const names = new Set((await accessibleAccounts(user)).map((x) => x.name));
        if (!names.has(a.account)) return { forbidden: true };
        const sets = []; const params = [];
        for (const f of ['text', 'status', 'owner', 'due_date']) {
            if (data[f] !== undefined) { sets.push(`${f} = ?`); params.push(data[f]); }
        }
        sets.push('updated_at = ?'); params.push(new Date().toISOString());
        await db.run(`UPDATE health_check_actions SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
        return { call: await this.getCall(a.call_id, user) };
    },

    async removeAction(id, user) {
        const db = await getDb();
        const a = await db.get('SELECT * FROM health_check_actions WHERE id = ?', [id]);
        if (!a) return { notFound: true };
        const names = new Set((await accessibleAccounts(user)).map((x) => x.name));
        if (!names.has(a.account)) return { forbidden: true };
        await db.run('DELETE FROM health_check_actions WHERE id = ?', [id]);
        return { call: await this.getCall(a.call_id, user) };
    },

    /**
     * Per-customer vendor-health rollup: the tier-driven cadence, when the next
     * call is due (and whether it's overdue), the latest signal + trend, and how
     * many actionables are still open.
     */
    async accountHealth(user) {
        const db = await getDb();
        const accounts = (await accessibleAccounts(user)).filter((a) => a.segment === 'Customer');
        const tiers = await accountTiers(db);
        const calls = await db.all('SELECT * FROM health_calls ORDER BY check_date DESC, id DESC');
        const openRows = await db.all("SELECT account, COUNT(*) c FROM health_check_actions WHERE status != 'Done' GROUP BY account");
        const openByAccount = Object.fromEntries(openRows.map((r) => [r.account, r.c]));
        const byAccount = {};
        for (const c of calls) (byAccount[c.account] ||= []).push(c);

        return accounts.map((a) => {
            const cs = byAccount[a.name] || [];
            const last = cs[0] || null;
            const tier = tiers[a.name] || 'Standard';
            const cadence = cadenceForTier(tier);
            const lastDate = last ? last.check_date : null;
            const nextDue = lastDate ? addDays(lastDate, cadence) : today();
            const overdue = nextDue < today();
            const trend = cs.length >= 2 ? Math.sign((SIGNAL_SCORE[cs[1].signal] ?? 1) - (SIGNAL_SCORE[cs[0].signal] ?? 1)) : 0;
            return {
                account: a.name, tier, cadenceDays: cadence,
                lastCheckDate: lastDate, nextDueDate: nextDue, overdue,
                daysToNext: daysBetween(nextDue, today()),
                currentSignal: last ? last.signal : 'Unknown',
                sentiment: last ? last.sentiment : null,
                lastSummary: last ? last.summary : '',
                openActions: openByAccount[a.name] || 0,
                checkCount: cs.length,
                // >0 improving (last worse than current), <0 worsening, 0 flat
                trend
            };
        }).sort((x, y) => (y.overdue - x.overdue) || ((SIGNAL_SCORE[y.currentSignal] ?? 1) - (SIGNAL_SCORE[x.currentSignal] ?? 1)));
    },

    /** Portfolio health metrics for the module header. */
    async stats(user) {
        const health = await this.accountHealth(user);
        const bump = (m, k) => { m[k] = (m[k] || 0) + 1; return m; };
        return {
            accounts: health.length,
            overdue: health.filter((h) => h.overdue).length,
            red: health.filter((h) => h.currentSignal === 'Red').length,
            amber: health.filter((h) => h.currentSignal === 'Amber').length,
            green: health.filter((h) => h.currentSignal === 'Green').length,
            neverChecked: health.filter((h) => h.checkCount === 0).length,
            openActions: health.reduce((s, h) => s + h.openActions, 0),
            worsening: health.filter((h) => h.trend < 0).length,
            bySignal: health.reduce((m, h) => bump(m, h.currentSignal), {}),
            byTier: health.reduce((m, h) => bump(m, h.tier), {})
        };
    }
};
