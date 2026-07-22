import { getDb } from '../db.js';
import { accountRepo } from './accountRepo.js';
import { config } from '../config.js';

/**
 * Magnet — customer advocacy / referrals.
 *
 * A referring customer (`account`) introduces a prospect; the lead moves through
 * New -> Contacted -> Qualified -> Converted. Scoped by the referring customer.
 * Conversion rate, referred pipeline and the advocate leaderboard are derived.
 */

const now = () => new Date().toISOString();
const CONVERTED = 'Converted';

async function accessibleNames(user) {
    if (!user) throw new Error('referralRepo: a user is required — pass req.user');
    return new Set((await accountRepo.list(user)).map((a) => a.name));
}
const toInr = (r) => (r.currency === 'INR' ? r.value_amount : r.value_amount * config.fxUsdInr) || 0;
const decorate = (r) => ({ ...r, valueInr: toInr(r), reward_paid: !!r.reward_paid });

export const referralRepo = {
    async list(user, { account, status } = {}) {
        const db = await getDb();
        const names = await accessibleNames(user);
        const where = []; const params = [];
        if (account) { where.push('account = ?'); params.push(account); }
        if (status) { where.push('status = ?'); params.push(status); }
        const rows = await db.all(`SELECT * FROM referral_leads ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC`, params);
        return rows.filter((r) => names.has(r.account)).map(decorate);
    },

    async get(id, user) {
        const db = await getDb();
        const r = await db.get('SELECT * FROM referral_leads WHERE id = ?', [id]);
        if (!r) return null;
        const names = await accessibleNames(user);
        if (!names.has(r.account)) return null;
        return decorate(r);
    },

    async create(data, user) {
        const db = await getDb();
        const names = await accessibleNames(user);
        if (!names.has(data.account)) return { forbidden: true };
        const ts = now();
        const r = await db.run(
            `INSERT INTO referral_leads (account, referred_name, contact, status, value_amount, currency, reward, reward_paid, owner, notes, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            [data.account, data.referred_name, data.contact || '', data.status || 'New', data.value_amount || 0, data.currency || 'INR',
                data.reward || '', 0, data.owner || (user.name || ''), data.notes || '', ts, ts]
        );
        return { referral: await this.get(r.lastID, user) };
    },

    async update(id, data, user) {
        const db = await getDb();
        const r = await db.get('SELECT * FROM referral_leads WHERE id = ?', [id]);
        if (!r) return { notFound: true };
        const names = await accessibleNames(user);
        if (!names.has(r.account)) return { forbidden: true };
        const sets = []; const params = [];
        for (const k of ['referred_name', 'contact', 'status', 'value_amount', 'currency', 'reward', 'owner', 'notes']) {
            if (data[k] !== undefined) { sets.push(`${k} = ?`); params.push(data[k]); }
        }
        if (data.reward_paid !== undefined) { sets.push('reward_paid = ?'); params.push(data.reward_paid ? 1 : 0); }
        sets.push('updated_at = ?'); params.push(now());
        await db.run(`UPDATE referral_leads SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
        return { referral: await this.get(id, user) };
    },

    async remove(id, user) {
        const db = await getDb();
        const r = await db.get('SELECT * FROM referral_leads WHERE id = ?', [id]);
        if (!r) return { notFound: true };
        const names = await accessibleNames(user);
        if (!names.has(r.account)) return { forbidden: true };
        await db.run('DELETE FROM referral_leads WHERE id = ?', [id]);
        return { deleted: true };
    },

    // ─────────────── nudge tracking ───────────────

    /**
     * The nudge tracker: EVERY customer, whether they've been asked for a
     * referral, when, and what they said — so "who have we never asked?" is a
     * glance, not a spreadsheet.
     */
    async nudgeBoard(user) {
        const db = await getDb();
        const customers = (await accountRepo.list(user)).filter((a) => a.segment === 'Customer');
        const names = new Set(customers.map((c) => c.name));
        const nudges = (await db.all('SELECT * FROM referral_nudges ORDER BY nudged_at DESC, id DESC')).filter((n) => names.has(n.account));
        const referrals = (await db.all('SELECT account, COUNT(*) c FROM referral_leads GROUP BY account')).filter((r) => names.has(r.account));
        const refByAccount = Object.fromEntries(referrals.map((r) => [r.account, r.c]));
        const byAccount = {};
        for (const n of nudges) (byAccount[n.account] ||= []).push(n);
        const rows = customers.map((c) => {
            const list = byAccount[c.name] || [];
            const last = list[0] || null;
            return {
                account: c.name,
                nudged: list.length > 0,
                nudgeCount: list.length,
                lastNudgedAt: last?.nudged_at || null,
                lastResponse: last?.response || '',
                lastOutcome: last?.outcome || null,
                referrals: refByAccount[c.name] || 0,
                history: list
            };
        }).sort((a, b) => Number(a.nudged) - Number(b.nudged) || (b.lastNudgedAt || '').localeCompare(a.lastNudgedAt || ''));
        return {
            rows,
            customers: customers.length,
            nudged: rows.filter((r) => r.nudged).length,
            neverNudged: rows.filter((r) => !r.nudged).length
        };
    },

    /** Log a nudge — the ask, and what the customer said. */
    async addNudge({ account, response, outcome, nudged_at }, user) {
        const names = await accessibleNames(user);
        if (!names.has(account)) return { forbidden: true };
        const db = await getDb();
        await db.run(
            'INSERT INTO referral_nudges (account, nudged_at, response, outcome, nudged_by, created_at) VALUES (?,?,?,?,?,?)',
            [account, nudged_at || new Date().toISOString().slice(0, 10), response || '', outcome || 'No answer', user.name || '', now()]
        );
        return { board: await this.nudgeBoard(user) };
    },

    /** The advocate leaderboard — customers ranked by referrals made + converted. */
    async advocates(user) {
        const all = await this.list(user);
        const byAccount = {};
        for (const r of all) {
            const a = byAccount[r.account] || (byAccount[r.account] = { account: r.account, referrals: 0, converted: 0, valueInr: 0, rewardsOwed: 0 });
            a.referrals += 1;
            if (r.status === CONVERTED) { a.converted += 1; a.valueInr += r.valueInr; if (r.reward && !r.reward_paid) a.rewardsOwed += 1; }
        }
        return Object.values(byAccount).sort((x, y) => y.converted - x.converted || y.referrals - x.referrals);
    },

    async stats(user) {
        const all = await this.list(user);
        const converted = all.filter((r) => r.status === CONVERTED);
        const declined = all.filter((r) => r.status === 'Declined');
        const closed = converted.length + declined.length;
        const bump = (m, k) => { m[k] = (m[k] || 0) + 1; return m; };
        return {
            total: all.length,
            open: all.filter((r) => !['Converted', 'Declined'].includes(r.status)).length,
            converted: converted.length,
            conversionRate: closed ? Math.round((converted.length / closed) * 100) : null,
            referredValueInr: all.filter((r) => r.status !== 'Declined').reduce((s, r) => s + r.valueInr, 0),
            convertedValueInr: converted.reduce((s, r) => s + r.valueInr, 0),
            rewardsOwed: all.filter((r) => r.status === CONVERTED && r.reward && !r.reward_paid).length,
            advocates: (await this.advocates(user)).length,
            byStatus: all.reduce((m, r) => bump(m, r.status), {})
        };
    },

    async seedSample(user) {
        const customers = (await accountRepo.list(user)).filter((a) => a.segment === 'Customer');
        if (!customers.length) return { seeded: 0 };
        const plan = [
            { name: 'Meridian NBFC', status: 'Converted', value: 2400000, reward: '1 month credit' },
            { name: 'Aster Finance', status: 'Qualified', value: 1600000, reward: 'Gift voucher' },
            { name: 'Northwind Capital', status: 'Contacted', value: 0, reward: '' },
            { name: 'Peak Lending', status: 'New', value: 0, reward: '' },
            { name: 'Vertex Credit', status: 'Converted', value: 1900000, reward: '1 month credit' }
        ];
        let seeded = 0;
        for (let i = 0; i < plan.length; i++) {
            const p = plan[i];
            const r = await this.create({ account: customers[i % customers.length].name, referred_name: p.name, status: p.status, value_amount: p.value, currency: 'INR', reward: p.reward }, user);
            if (r.referral) seeded += 1;
        }
        return { seeded };
    }
};
