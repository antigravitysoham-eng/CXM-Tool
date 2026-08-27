import { getDb } from '../db.js';
import { accountRepo } from './accountRepo.js';

/**
 * Ringmaster — customer events (webinar / workshop / roundtable / user group).
 *
 * Scoped to a customer. Attendance rate is attended / registered; fill rate is
 * registered / capacity. registered/attended are clamped so they stay sane.
 */

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const rate = (n, d) => (d ? Math.round((n / d) * 100) : null);
const UPCOMING = ['Planned', 'Open', 'Live'];

async function accessibleNames(user) {
    if (!user) throw new Error('eventRepo: a user is required — pass req.user');
    return new Set((await accountRepo.list(user)).map((a) => a.name));
}
const decorate = (e) => ({
    ...e,
    attendanceRate: rate(e.attended, e.registered),
    fillRate: rate(e.registered, e.capacity),
    upcoming: UPCOMING.includes(e.status) && (!e.starts_at || e.starts_at >= today())
});

export const eventRepo = {
    async list(user, { account, status, type } = {}) {
        const db = await getDb();
        const names = await accessibleNames(user);
        const where = []; const params = [];
        if (account) { where.push('account = ?'); params.push(account); }
        if (status) { where.push('status = ?'); params.push(status); }
        if (type) { where.push('type = ?'); params.push(type); }
        const rows = await db.all(`SELECT * FROM cx_events ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY (starts_at IS NULL OR starts_at = '') ASC, starts_at ASC, id DESC`, params);
        return rows.filter((e) => names.has(e.account)).map(decorate);
    },

    async get(id, user) {
        const db = await getDb();
        const e = await db.get('SELECT * FROM cx_events WHERE id = ?', [id]);
        if (!e) return null;
        const names = await accessibleNames(user);
        if (!names.has(e.account)) return null;
        return decorate(e);
    },

    async create(data, user) {
        const db = await getDb();
        const names = await accessibleNames(user);
        if (!names.has(data.account)) return { forbidden: true };
        const ts = now();
        const r = await db.run(
            `INSERT INTO cx_events (account, title, type, status, starts_at, location, capacity, registered, attended, host, notes, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [data.account, data.title, data.type || 'Webinar', data.status || 'Planned', data.starts_at || '', data.location || '',
                data.capacity || 0, 0, 0, data.host || (user.name || ''), data.notes || '', ts, ts]
        );
        return { event: await this.get(r.lastID, user) };
    },

    async update(id, data, user) {
        const db = await getDb();
        const e = await db.get('SELECT * FROM cx_events WHERE id = ?', [id]);
        if (!e) return { notFound: true };
        const names = await accessibleNames(user);
        if (!names.has(e.account)) return { forbidden: true };
        const patch = { ...data };
        // Keep the funnel sane: registered <= capacity (if set), attended <= registered.
        const capacity = patch.capacity ?? e.capacity;
        if (patch.registered !== undefined && capacity) patch.registered = Math.min(patch.registered, capacity);
        const registered = patch.registered ?? e.registered;
        if (patch.attended !== undefined) patch.attended = Math.min(patch.attended, registered);
        const sets = []; const params = [];
        for (const k of ['title', 'type', 'status', 'starts_at', 'location', 'capacity', 'registered', 'attended', 'host', 'notes']) {
            if (patch[k] !== undefined) { sets.push(`${k} = ?`); params.push(patch[k]); }
        }
        sets.push('updated_at = ?'); params.push(now());
        await db.run(`UPDATE cx_events SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
        return { event: await this.get(id, user) };
    },

    async remove(id, user) {
        const db = await getDb();
        const e = await db.get('SELECT * FROM cx_events WHERE id = ?', [id]);
        if (!e) return { notFound: true };
        const names = await accessibleNames(user);
        if (!names.has(e.account)) return { forbidden: true };
        await db.run('DELETE FROM cx_events WHERE id = ?', [id]);
        return { deleted: true };
    },

    async stats(user) {
        const all = await this.list(user);
        const completed = all.filter((e) => e.status === 'Completed');
        const withAttendance = completed.filter((e) => e.attendanceRate !== null);
        const avg = (arr, k) => (arr.length ? Math.round(arr.reduce((s, e) => s + e[k], 0) / arr.length) : null);
        const bump = (m, k) => { m[k] = (m[k] || 0) + 1; return m; };
        return {
            events: all.length,
            upcoming: all.filter((e) => e.upcoming).length,
            completed: completed.length,
            totalRegistered: all.reduce((s, e) => s + e.registered, 0),
            totalAttended: all.reduce((s, e) => s + e.attended, 0),
            avgAttendanceRate: avg(withAttendance, 'attendanceRate'),
            byType: all.reduce((m, e) => bump(m, e.type), {}),
            byStatus: all.reduce((m, e) => bump(m, e.status), {}),
            next: all.filter((e) => e.upcoming).slice(0, 5).map((e) => ({ id: e.id, title: e.title, account: e.account, starts_at: e.starts_at, registered: e.registered, capacity: e.capacity }))
        };
    },

    async seedSample(user) {
        const customers = (await accountRepo.list(user)).filter((a) => a.segment === 'Customer');
        if (!customers.length) return { seeded: 0 };
        const soon = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
        const plan = [
            { title: 'Vendor Pulse deep-dive webinar', type: 'Webinar', status: 'Open', starts: soon(14), cap: 100, reg: 62, att: 0 },
            { title: 'Admin power-user workshop', type: 'Workshop', status: 'Completed', starts: soon(-20), cap: 30, reg: 28, att: 22 },
            { title: 'NBFC customer roundtable', type: 'Roundtable', status: 'Planned', starts: soon(40), cap: 20, reg: 6, att: 0 },
            { title: 'Product roadmap user group', type: 'User Group', status: 'Open', starts: soon(21), cap: 80, reg: 47, att: 0 },
            { title: 'Compliance office hours', type: 'Office Hours', status: 'Completed', starts: soon(-8), cap: 25, reg: 19, att: 14 },
            { title: 'Annual customer conference', type: 'Conference', status: 'Planned', starts: soon(60), cap: 300, reg: 128, att: 0 },
            { title: 'Onboarding fast-track webinar', type: 'Webinar', status: 'Completed', starts: soon(-35), cap: 120, reg: 96, att: 71 },
            { title: 'Integrations workshop', type: 'Workshop', status: 'Live', starts: soon(0), cap: 40, reg: 38, att: 30 },
            { title: 'Security best-practices webinar', type: 'Webinar', status: 'Completed', starts: soon(-14), cap: 150, reg: 110, att: 88 }
        ];
        let seeded = 0;
        for (let i = 0; i < customers.length; i++) {
            // Two events per customer (one upcoming, one past) for a real funnel.
            for (const off of [0, 1]) {
                const p = plan[(i * 2 + off) % plan.length];
                const e = await this.create({ account: customers[i].name, title: p.title, type: p.type, status: p.status, starts_at: p.starts, capacity: p.cap }, user);
                if (e.event) { await this.update(e.event.id, { registered: p.reg, attended: p.att }, user); seeded += 1; }
            }
        }
        return { seeded };
    }
};
