import { getDb } from '../db.js';
import { accountRepo } from './accountRepo.js';

/**
 * Herald — customer communications.
 *
 * A campaign targeted at a customer; open and click rates are derived from
 * opens / clicks over recipients. Scoped to the customers the caller can see.
 */

const now = () => new Date().toISOString();
const rate = (n, d) => (d ? Math.round((n / d) * 100) : null);

async function accessibleNames(user) {
    if (!user) throw new Error('commsRepo: a user is required — pass req.user');
    return new Set((await accountRepo.list(user)).map((a) => a.name));
}
const decorate = (c) => ({ ...c, openRate: rate(c.opens, c.recipients), clickRate: rate(c.clicks, c.recipients) });

export const commsRepo = {
    async list(user, { account, status, type } = {}) {
        const db = await getDb();
        const names = await accessibleNames(user);
        const where = []; const params = [];
        if (account) { where.push('account = ?'); params.push(account); }
        if (status) { where.push('status = ?'); params.push(status); }
        if (type) { where.push('type = ?'); params.push(type); }
        const rows = await db.all(`SELECT * FROM comms_campaigns ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC`, params);
        return rows.filter((c) => names.has(c.account)).map(decorate);
    },

    async get(id, user) {
        const db = await getDb();
        const c = await db.get('SELECT * FROM comms_campaigns WHERE id = ?', [id]);
        if (!c) return null;
        const names = await accessibleNames(user);
        if (!names.has(c.account)) return null;
        return decorate(c);
    },

    async create(data, user) {
        const db = await getDb();
        const names = await accessibleNames(user);
        if (!names.has(data.account)) return { forbidden: true };
        const ts = now();
        const r = await db.run(
            `INSERT INTO comms_campaigns (account, title, type, status, recipients, opens, clicks, scheduled_for, created_by, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [data.account, data.title, data.type || 'Email', data.status || 'Draft', data.recipients || 0, 0, 0, data.scheduled_for || '', user.name || '', ts, ts]
        );
        return { comm: await this.get(r.lastID, user) };
    },

    async update(id, data, user) {
        const db = await getDb();
        const c = await db.get('SELECT * FROM comms_campaigns WHERE id = ?', [id]);
        if (!c) return { notFound: true };
        const names = await accessibleNames(user);
        if (!names.has(c.account)) return { forbidden: true };
        const patch = { ...data };
        // Keep the funnel sane: opens <= recipients, clicks <= opens.
        const recipients = patch.recipients ?? c.recipients;
        if (patch.opens !== undefined) patch.opens = Math.min(patch.opens, recipients);
        const opens = patch.opens ?? c.opens;
        if (patch.clicks !== undefined) patch.clicks = Math.min(patch.clicks, opens);
        const sets = []; const params = [];
        for (const k of ['title', 'type', 'status', 'recipients', 'opens', 'clicks', 'scheduled_for']) {
            if (patch[k] !== undefined) { sets.push(`${k} = ?`); params.push(patch[k]); }
        }
        sets.push('updated_at = ?'); params.push(now());
        await db.run(`UPDATE comms_campaigns SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
        return { comm: await this.get(id, user) };
    },

    async remove(id, user) {
        const db = await getDb();
        const c = await db.get('SELECT * FROM comms_campaigns WHERE id = ?', [id]);
        if (!c) return { notFound: true };
        const names = await accessibleNames(user);
        if (!names.has(c.account)) return { forbidden: true };
        await db.run('DELETE FROM comms_campaigns WHERE id = ?', [id]);
        return { deleted: true };
    },

    /** Mark a campaign Sent, stamping recipients and (optional) engagement. */
    async send(id, data, user) {
        const db = await getDb();
        const c = await db.get('SELECT * FROM comms_campaigns WHERE id = ?', [id]);
        if (!c) return { notFound: true };
        const names = await accessibleNames(user);
        if (!names.has(c.account)) return { forbidden: true };
        const ts = now();
        const recipients = Math.max(c.recipients, Number(data.recipients) || c.recipients || 0);
        const opens = data.opens !== undefined ? Math.min(recipients, Number(data.opens)) : c.opens;
        const clicks = data.clicks !== undefined ? Math.min(opens, Number(data.clicks)) : c.clicks;
        await db.run("UPDATE comms_campaigns SET status = 'Sent', recipients = ?, opens = ?, clicks = ?, sent_at = ?, updated_at = ? WHERE id = ?",
            [recipients, opens, clicks, ts, ts, id]);
        return { comm: await this.get(id, user) };
    },

    async stats(user) {
        const all = await this.list(user);
        const sent = all.filter((c) => c.status === 'Sent');
        const withOpen = sent.filter((c) => c.openRate !== null);
        const withClick = sent.filter((c) => c.clickRate !== null);
        const avg = (arr, k) => (arr.length ? Math.round(arr.reduce((s, c) => s + c[k], 0) / arr.length) : null);
        const bump = (m, k) => { m[k] = (m[k] || 0) + 1; return m; };
        return {
            campaigns: all.length,
            sent: sent.length,
            scheduled: all.filter((c) => c.status === 'Scheduled').length,
            drafts: all.filter((c) => c.status === 'Draft').length,
            totalRecipients: sent.reduce((s, c) => s + c.recipients, 0),
            avgOpenRate: avg(withOpen, 'openRate'),
            avgClickRate: avg(withClick, 'clickRate'),
            byType: all.reduce((m, c) => bump(m, c.type), {}),
            byStatus: all.reduce((m, c) => bump(m, c.status), {})
        };
    },

    async seedSample(user) {
        const customers = (await accountRepo.list(user)).filter((a) => a.segment === 'Customer');
        if (!customers.length) return { seeded: 0 };
        const plan = [
            { title: 'Q3 product newsletter', type: 'Newsletter', recipients: 120, opens: 78, clicks: 24, status: 'Sent' },
            { title: 'Planned maintenance notice', type: 'Announcement', recipients: 60, opens: 51, clicks: 8, status: 'Sent' },
            { title: 'New Vendor Pulse features', type: 'Email', recipients: 90, opens: 40, clicks: 18, status: 'Sent' },
            { title: 'Renewal reminder', type: 'Email', recipients: 45, opens: 39, clicks: 21, status: 'Sent' },
            { title: 'In-app: new dashboard', type: 'In-app', recipients: 200, opens: 150, clicks: 60, status: 'Sent' },
            { title: 'Security advisory', type: 'Announcement', recipients: 80, opens: 74, clicks: 12, status: 'Sent' },
            { title: 'Feature webinar invite', type: 'Email', recipients: 110, opens: 55, clicks: 30, status: 'Sent' },
            { title: 'Monthly digest', type: 'Newsletter', recipients: 140, opens: 60, clicks: 14, status: 'Draft' },
            { title: 'Outage post-mortem', type: 'Announcement', recipients: 0, opens: 0, clicks: 0, status: 'Scheduled' }
        ];
        let seeded = 0;
        for (let i = 0; i < customers.length; i++) {
            // Two comms per customer for a fuller engagement picture.
            for (const off of [0, 1]) {
                const p = plan[(i * 2 + off) % plan.length];
                const c = await this.create({ account: customers[i].name, title: p.title, type: p.type, recipients: p.recipients }, user);
                if (!c.comm) continue;
                if (p.status === 'Sent') await this.send(c.comm.id, { recipients: p.recipients, opens: p.opens, clicks: p.clicks }, user);
                else if (p.status === 'Scheduled') await this.update(c.comm.id, { status: 'Scheduled' }, user);
                seeded += 1;
            }
        }
        return { seeded };
    }
};
