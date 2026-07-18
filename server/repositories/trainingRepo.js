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

    /**
     * The courses available to an account: every 'platform' course plus the
     * courses for the modules it opted for (account-level scope ∪ contract scope).
     * This is what a customer is entitled to train on.
     */
    async availableCourses(user, account) {
        if (!(await accessibleAccounts(user)).has(account)) return { forbidden: true };
        const db = await getDb();
        const acctMods = (await db.all('SELECT DISTINCT product_key FROM account_products WHERE account = ?', [account])).map((r) => r.product_key);
        const ctrMods = (await db.all('SELECT DISTINCT product_key FROM contract_products WHERE account = ?', [account])).map((r) => r.product_key);
        const opted = new Set([...acctMods, ...ctrMods].filter(Boolean));
        const courses = (await this.listCourses({ activeOnly: true })).filter((c) => c.module === 'platform' || opted.has(c.module));
        return { courses, modules: [...opted] };
    },

    /** Bulk course-availability by account (for the CLM/Directory columns). No
     *  per-user scoping — the caller already scopes the account list. */
    async courseAvailabilityMap() {
        const db = await getDb();
        const courses = await this.listCourses({ activeOnly: true });
        const platformCount = courses.filter((c) => c.module === 'platform').length;
        const byModule = {};
        for (const c of courses) if (c.module !== 'platform') byModule[c.module] = (byModule[c.module] || 0) + 1;
        const rows = [
            ...await db.all('SELECT DISTINCT account, product_key FROM account_products'),
            ...await db.all('SELECT DISTINCT account, product_key FROM contract_products')
        ];
        const modsByAcct = {};
        for (const r of rows) (modsByAcct[r.account] ||= new Set()).add(r.product_key);
        const out = {};
        for (const [account, mods] of Object.entries(modsByAcct)) {
            let count = platformCount;
            for (const m of mods) count += (byModule[m] || 0);
            out[account] = { count, modules: [...mods] };
        }
        return { byAccount: out, platformCount };
    },

    // ---- trainees (account-scoped) ----
    async listTrainees(user, account) {
        const db = await getDb();
        const names = await accessibleAccounts(user);
        const where = account ? 'WHERE account = ?' : '';
        const rows = await db.all(`SELECT * FROM training_trainees ${where} ORDER BY account, name`, account ? [account] : []);
        return rows.filter((r) => names.has(r.account));
    },
    async addTrainee(data, user) {
        const db = await getDb();
        if (!(await accessibleAccounts(user)).has(data.account)) return { forbidden: true };
        const r = await db.run(
            'INSERT INTO training_trainees (account, name, email, role, created_at) VALUES (?,?,?,?,?)',
            [data.account, data.name, data.email || '', data.role || '', new Date().toISOString()]
        );
        return { trainee: await db.get('SELECT * FROM training_trainees WHERE id = ?', [r.lastID]) };
    },
    async removeTrainee(id, user) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM training_trainees WHERE id = ?', [id]);
        if (!row) return { notFound: true };
        if (!(await accessibleAccounts(user)).has(row.account)) return { forbidden: true };
        await db.run('DELETE FROM training_trainees WHERE id = ?', [id]);
        await db.run('DELETE FROM training_enrollments WHERE trainee_id = ?', [id]);
        return { deleted: true };
    },

    // ---- trainers (global roster; admin writes) ----
    async listTrainers() {
        const db = await getDb();
        const rows = await db.all('SELECT * FROM training_trainers ORDER BY name');
        return rows.map((r) => ({ ...r, active: !!r.active, specialties: JSON.parse(r.specialties || '[]') }));
    },
    async addTrainer(data) {
        const db = await getDb();
        const r = await db.run(
            'INSERT INTO training_trainers (name, email, specialties, active, created_at) VALUES (?,?,?,?,?)',
            [data.name, data.email || '', JSON.stringify(data.specialties || []), data.active === false ? 0 : 1, new Date().toISOString()]
        );
        const row = await db.get('SELECT * FROM training_trainers WHERE id = ?', [r.lastID]);
        return { ...row, active: !!row.active, specialties: JSON.parse(row.specialties || '[]') };
    },
    async updateTrainer(id, data) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM training_trainers WHERE id = ?', [id]);
        if (!row) return { notFound: true };
        const sets = []; const params = [];
        if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
        if (data.email !== undefined) { sets.push('email = ?'); params.push(data.email); }
        if (data.specialties !== undefined) { sets.push('specialties = ?'); params.push(JSON.stringify(data.specialties)); }
        if (data.active !== undefined) { sets.push('active = ?'); params.push(data.active ? 1 : 0); }
        if (sets.length) await db.run(`UPDATE training_trainers SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
        const r = await db.get('SELECT * FROM training_trainers WHERE id = ?', [id]);
        return { trainer: { ...r, active: !!r.active, specialties: JSON.parse(r.specialties || '[]') } };
    },
    async removeTrainer(id) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM training_trainers WHERE id = ?', [id]);
        if (!row) return { notFound: true };
        await db.run('DELETE FROM training_trainers WHERE id = ?', [id]);
        await db.run('UPDATE training_enrollments SET trainer_id = NULL WHERE trainer_id = ?', [id]);
        return { deleted: true };
    },

    // ---- enrollments (account-scoped) ----
    async listEnrollments(user, { account, status, course_key, trainee_id } = {}) {
        const db = await getDb();
        const names = await accessibleAccounts(user);
        const courses = Object.fromEntries((await db.all('SELECT * FROM training_courses')).map((c) => [c.course_key, c]));
        const trainees = Object.fromEntries((await db.all('SELECT id, name FROM training_trainees')).map((t) => [t.id, t.name]));
        const trainers = Object.fromEntries((await db.all('SELECT id, name FROM training_trainers')).map((t) => [t.id, t.name]));
        const where = []; const args = [];
        if (account) { where.push('account = ?'); args.push(account); }
        if (status) { where.push('status = ?'); args.push(status); }
        if (course_key) { where.push('course_key = ?'); args.push(course_key); }
        if (trainee_id) { where.push('trainee_id = ?'); args.push(trainee_id); }
        const rows = await db.all(`SELECT * FROM training_enrollments ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC`, args);
        return rows.filter((r) => names.has(r.account)).map((r) => {
            const co = courses[r.course_key] || {};
            return {
                ...r,
                course_title: co.title || r.course_key, module: co.module || null, level: co.level || null,
                trainee_name: trainees[r.trainee_id] || null,
                trainer_name: r.trainer_id ? (trainers[r.trainer_id] || null) : null
            };
        });
    },
    async createEnrollment(data, user) {
        const db = await getDb();
        if (!(await accessibleAccounts(user)).has(data.account)) return { forbidden: true };
        const course = await db.get('SELECT * FROM training_courses WHERE course_key = ?', [data.course_key]);
        if (!course) return { notFound: true };
        // One enrollment per (trainee, course) — enrolling again is a no-op.
        const dupe = await db.get('SELECT id FROM training_enrollments WHERE account = ? AND course_key = ? AND trainee_id = ?', [data.account, data.course_key, data.trainee_id]);
        if (dupe) return { enrollment: (await this.listEnrollments(user, { account: data.account })).find((e) => e.id === dupe.id) };
        const now = new Date().toISOString();
        const r = await db.run(
            `INSERT INTO training_enrollments (account, course_key, trainee_id, trainer_id, status, seat_price, currency, enrolled_at, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [data.account, data.course_key, data.trainee_id, data.trainer_id || null, data.status || 'Enrolled',
                course.seat_price || 0, course.currency || 'INR', now, now, now]
        );
        return { enrollment: (await this.listEnrollments(user, { account: data.account })).find((e) => e.id === r.lastID) };
    },
    async updateEnrollment(id, data, user) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM training_enrollments WHERE id = ?', [id]);
        if (!row) return { notFound: true };
        if (!(await accessibleAccounts(user)).has(row.account)) return { forbidden: true };
        const now = new Date().toISOString();
        const sets = []; const params = [];
        if (data.trainer_id !== undefined) { sets.push('trainer_id = ?'); params.push(data.trainer_id || null); }
        if (data.notes !== undefined) { sets.push('notes = ?'); params.push(data.notes); }
        if (data.status !== undefined) {
            sets.push('status = ?'); params.push(data.status);
            // Stamp lifecycle dates as they happen.
            if (data.status === 'In progress' && !row.started_at) { sets.push('started_at = ?'); params.push(now); }
            if ((data.status === 'Completed' || data.status === 'Certified') && !row.completed_at) { sets.push('completed_at = ?'); params.push(now); }
            if (data.status === 'Certified' && !row.certified_at) { sets.push('certified_at = ?'); params.push(now); }
        }
        sets.push('updated_at = ?'); params.push(now);
        await db.run(`UPDATE training_enrollments SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
        return { enrollment: (await this.listEnrollments(user, { account: row.account })).find((e) => e.id === id) };
    },
    async removeEnrollment(id, user) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM training_enrollments WHERE id = ?', [id]);
        if (!row) return { notFound: true };
        if (!(await accessibleAccounts(user)).has(row.account)) return { forbidden: true };
        await db.run('DELETE FROM training_enrollments WHERE id = ?', [id]);
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
