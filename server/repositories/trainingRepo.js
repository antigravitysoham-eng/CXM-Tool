import { getDb } from '../db.js';
import { accountRepo } from './accountRepo.js';

/**
 * Training sessions — customer enablement.
 *
 * A session hangs off an account, so it inherits that account's access (same rule
 * as invoices, documents and support). The learner funnel — enrolled → completed
 * → certified — is stored, but its rates and the account's enablement health are
 * DERIVED at read time, never stored.
 */

async function accessibleAccounts(user) {
    if (!user) throw new Error('trainingRepo: a user is required — pass req.user');
    const accounts = await accountRepo.list(user);
    return new Set(accounts.map((a) => a.name));
}

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);

// completed ≤ enrolled, certified ≤ completed — clamp so the funnel is always sane.
function clampFunnel({ enrolled = 0, completed = 0, certified = 0 }) {
    const e = Math.max(0, enrolled | 0);
    const c = Math.min(Math.max(0, completed | 0), e);
    const cert = Math.min(Math.max(0, certified | 0), c);
    return { enrolled: e, completed: c, certified: cert };
}

function rowToSession(row) {
    const funnel = clampFunnel(row);
    const active = !['Completed', 'Cancelled'].includes(row.status);
    // Stalled: past its date (or in-flight) with nobody finishing yet — the
    // enablement equivalent of a ticket sitting unanswered.
    const past = !!row.session_date && row.session_date < new Date().toISOString().slice(0, 10);
    const stalled = active && funnel.enrolled > 0 && funnel.completed === 0 && (past || row.status === 'Delayed');
    return {
        id: row.id,
        title: row.title || '',
        account: row.account || '',
        contract_id: row.contract_id || '',
        trainer: row.trainer || '',
        format: row.format || 'Webinar',
        status: row.status || 'Scheduled',
        session_date: row.session_date || '',
        ...funnel,
        completion_rate: pct(funnel.completed, funnel.enrolled),
        certification_rate: pct(funnel.certified, funnel.enrolled),
        stalled,
        notes: row.notes || '',
        created_at: row.created_at,
        updated_at: row.updated_at
    };
}

function rowToCourse(r) {
    return {
        id: r.id, course_key: r.course_key, module: r.module, title: r.title, level: r.level,
        duration_hours: r.duration_hours ?? 0, seat_price: r.seat_price ?? 0, currency: r.currency || 'INR',
        active: !!r.active, created_at: r.created_at
    };
}
const LEVEL_ORDER = { Foundation: 0, Intermediate: 1, Advanced: 2 };

export const trainingRepo = {
    // ---- course catalogue (global; admin writes) ----
    async listCourses({ module, level, activeOnly = false } = {}) {
        const db = await getDb();
        const where = [];
        const args = [];
        if (module) { where.push('module = ?'); args.push(module); }
        if (level) { where.push('level = ?'); args.push(level); }
        if (activeOnly) where.push('active = 1');
        const rows = await db.all(`SELECT * FROM training_courses ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`, args);
        return rows.map(rowToCourse)
            .sort((a, b) => a.module.localeCompare(b.module) || (LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]));
    },

    async getCourse(id) {
        const db = await getDb();
        return rowToCourse(await db.get('SELECT * FROM training_courses WHERE id = ?', [id]) || {});
    },

    async createCourse(data) {
        const db = await getDb();
        const key = data.course_key
            || `${data.module}_${data.level.toLowerCase()}_${Date.now().toString().slice(-5)}`;
        const r = await db.run(
            `INSERT INTO training_courses (course_key, module, title, level, duration_hours, seat_price, currency, active, created_at)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [key, data.module, data.title, data.level, data.duration_hours || 0, data.seat_price || 0,
                data.currency || 'INR', data.active === false ? 0 : 1, new Date().toISOString()]
        );
        return rowToCourse(await db.get('SELECT * FROM training_courses WHERE id = ?', [r.lastID]));
    },

    async updateCourse(id, data) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM training_courses WHERE id = ?', [id]);
        if (!row) return { notFound: true };
        const sets = [];
        const params = [];
        for (const f of ['module', 'title', 'level', 'duration_hours', 'seat_price', 'currency']) {
            if (data[f] !== undefined) { sets.push(`${f} = ?`); params.push(data[f]); }
        }
        if (data.active !== undefined) { sets.push('active = ?'); params.push(data.active ? 1 : 0); }
        if (sets.length) await db.run(`UPDATE training_courses SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
        return { course: rowToCourse(await db.get('SELECT * FROM training_courses WHERE id = ?', [id])) };
    },

    async removeCourse(id) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM training_courses WHERE id = ?', [id]);
        if (!row) return { notFound: true };
        await db.run('DELETE FROM training_courses WHERE id = ?', [id]);
        return { deleted: true };
    },

    async list(user, { account, status, format } = {}) {
        const db = await getDb();
        const names = await accessibleAccounts(user);
        const where = [];
        const args = [];
        if (account) { where.push('account = ?'); args.push(account); }
        if (status) { where.push('status = ?'); args.push(status); }
        if (format) { where.push('format = ?'); args.push(format); }
        const rows = await db.all(
            `SELECT * FROM training_sessions ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
             ORDER BY (status = 'Completed') ASC, COALESCE(session_date, created_at) DESC, id DESC`,
            args
        );
        return rows.filter((r) => names.has(r.account)).map(rowToSession);
    },

    async get(id, user) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM training_sessions WHERE id = ?', [id]);
        if (!row) return null;
        const names = await accessibleAccounts(user);
        if (!names.has(row.account)) return null;
        return rowToSession(row);
    },

    async create(data, user) {
        const db = await getDb();
        const names = await accessibleAccounts(user);
        if (!names.has(data.account)) return { forbidden: true };

        const now = new Date().toISOString();
        const f = clampFunnel(data);
        const r = await db.run(
            `INSERT INTO training_sessions
               (title, account, contract_id, trainer, format, status, session_date,
                enrolled, completed, certified, notes, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
                data.title, data.account, data.contract_id || '', data.trainer || '',
                data.format || 'Webinar', data.status || 'Scheduled', data.session_date || '',
                f.enrolled, f.completed, f.certified, data.notes || '', now, now
            ]
        );
        return { session: rowToSession(await db.get('SELECT * FROM training_sessions WHERE id = ?', [r.lastID])) };
    },

    async update(id, data, user) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM training_sessions WHERE id = ?', [id]);
        if (!row) return { notFound: true };
        const names = await accessibleAccounts(user);
        if (!names.has(row.account)) return { forbidden: true };

        // Merge, then clamp the whole funnel so a partial update can't create an
        // impossible state (e.g. certifying more than were enrolled).
        const merged = {
            enrolled: data.enrolled ?? row.enrolled,
            completed: data.completed ?? row.completed,
            certified: data.certified ?? row.certified
        };
        const f = clampFunnel(merged);

        const sets = [];
        const params = [];
        for (const key of ['title', 'account', 'contract_id', 'trainer', 'format', 'status', 'session_date', 'notes']) {
            if (data[key] !== undefined) { sets.push(`${key} = ?`); params.push(data[key]); }
        }
        for (const key of ['enrolled', 'completed', 'certified']) {
            sets.push(`${key} = ?`); params.push(f[key]);
        }
        sets.push('updated_at = ?'); params.push(new Date().toISOString());
        await db.run(`UPDATE training_sessions SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
        return { session: rowToSession(await db.get('SELECT * FROM training_sessions WHERE id = ?', [id])) };
    },

    async remove(id, user) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM training_sessions WHERE id = ?', [id]);
        if (!row) return { notFound: true };
        const names = await accessibleAccounts(user);
        if (!names.has(row.account)) return { forbidden: true };
        await db.run('DELETE FROM training_sessions WHERE id = ?', [id]);
        return { deleted: true };
    },

    /** Enablement rollup: the funnel, its rates, and where it's stalling. */
    async stats(user, filters = {}) {
        const list = await this.list(user, filters);
        const sum = (k) => list.reduce((s, r) => s + r[k], 0);
        const enrolled = sum('enrolled');
        const completed = sum('completed');
        const certified = sum('certified');
        const bump = (acc, k) => { acc[k] = (acc[k] || 0) + 1; return acc; };

        // Accounts with enrolment but weak completion — the enablement gap that
        // feeds churn and, per the module's own insight, support load.
        const byAccount = list.reduce((acc, r) => {
            const a = acc[r.account] || { enrolled: 0, completed: 0 };
            a.enrolled += r.enrolled; a.completed += r.completed;
            acc[r.account] = a; return acc;
        }, {});
        const underEnabled = Object.entries(byAccount)
            .filter(([, v]) => v.enrolled >= 5 && pct(v.completed, v.enrolled) < 50)
            .map(([name]) => name);

        return {
            sessions: list.length,
            active: list.filter((r) => !['Completed', 'Cancelled'].includes(r.status)).length,
            enrolled,
            completed,
            certified,
            completionRate: pct(completed, enrolled),
            certificationRate: pct(certified, enrolled),
            stalled: list.filter((r) => r.stalled).length,
            underEnabledAccounts: underEnabled,
            byStatus: list.reduce((a, r) => bump(a, r.status), {}),
            byFormat: list.reduce((a, r) => bump(a, r.format), {})
        };
    }
};
