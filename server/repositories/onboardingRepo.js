import { getDb } from '../db.js';
import { accountRepo } from './accountRepo.js';
import { scopeRepo } from './scopeRepo.js';
import { STAGES, buildStageTwoTasks, suggestPlan, VALUE_STAGE_NO } from '../data/onboardingStages.js';
import { PRODUCT_BY_KEY } from '../data/products.js';

/**
 * Onboarding — bringing a signed customer live across six time-bound stages,
 * the last of which is the first use case actually being achieved.
 *
 * Scoped to the account, like everything else that hangs off one.
 */

async function accessibleAccounts(user) {
    if (!user) throw new Error('onboardingRepo: a user is required — pass req.user');
    return new Set((await accountRepo.list(user)).map((a) => a.name));
}

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (iso, days) => {
    const d = new Date(iso);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
};
const daysBetween = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000);
const actorOf = (user) => user.name || user.email || 'someone';

// Append-only activity log — every meaningful change to an onboarding, so the
// board is auditable. Never lets a logging failure break the actual operation.
async function logActivity(db, { onboardingId, account, actor, action, detail, fromStage = null, toStage = null }) {
    try {
        await db.run(
            `INSERT INTO onboarding_activity (onboarding_id, account, actor, action, detail, from_stage, to_stage, at)
             VALUES (?,?,?,?,?,?,?,?)`,
            [onboardingId, account, actor, action, detail, fromStage, toStage, new Date().toISOString()]
        );
    } catch (e) { /* telemetry must not fail the write */ }
}

// A task carries its own clock too: days-on-task from its working dates.
function decorateTask(t) {
    const start = t.start_date || null;
    const end = t.end_date || null;
    return {
        ...t,
        start_date: start,
        end_date: end,
        days_on_task: start ? Math.max(0, daysBetween(end || today(), start)) : null
    };
}

function decorateStage(stage, tasks, plannedDays = null) {
    const mine = tasks.filter((t) => t.stage_id === stage.id).map(decorateTask);
    const done = mine.filter((t) => t.done).length;
    const overdue = stage.status !== 'Done' && !!stage.due_date && stage.due_date < today();
    // Days-in-stage, from the CSM-logged working dates: end→start if finished,
    // else today→start while it's running. Null until it has actually started.
    const start = stage.start_date || null;
    const end = stage.end_date || null;
    const daysInStage = start ? Math.max(0, daysBetween(end || today(), start)) : null;
    // Running long: in progress and already past the days this stage was planned
    // to take (the gap between its due date and the previous stage's).
    const runningLong = stage.status === 'In progress' && !!start && plannedDays != null
        && daysBetween(today(), start) > plannedDays;
    return {
        ...stage,
        overdue,
        days_late: overdue ? daysBetween(today(), stage.due_date) : 0,
        // Recorded against the deadline it was given: negative = early.
        delivered_variance_days: (stage.end_date || stage.completed_at) && stage.due_date
            ? daysBetween((stage.end_date || stage.completed_at.slice(0, 10)), stage.due_date)
            : null,
        start_date: start,
        end_date: end,
        planned_days: plannedDays,
        days_in_stage: daysInStage,
        running_long: !!runningLong,
        taskCount: mine.length,
        doneCount: done,
        progress: mine.length ? Math.round((done / mine.length) * 100) : 0,
        tasks: mine
    };
}

// The days each stage was planned to take: its due date minus the previous
// stage's (kickoff for the first). Returned aligned to the stage order given.
function plannedWindows(stages, kickoff) {
    let prevDue = kickoff || null;
    return stages.map((s) => {
        const planned = s.due_date && prevDue ? Math.max(0, daysBetween(s.due_date, prevDue)) : null;
        prevDue = s.due_date || prevDue;
        return planned;
    });
}

/**
 * The two numbers this module exists to move.
 *
 * Time to onboard — kickoff to live. How long the delivery took.
 * Time to value  — kickoff to the first use case actually being achieved.
 *
 * They are deliberately separate. A customer can be fully provisioned, trained
 * and handed over while never once having done the thing they bought this for;
 * reporting only time-to-onboard would call that a success.
 */
function timings(o, stages) {
    const valueStage = stages.find((s) => s.stage_no === VALUE_STAGE_NO);
    const from = o.kickoff_date || (o.started_at || '').slice(0, 10);
    const toOnboard = o.completed_at ? o.completed_at.slice(0, 10) : null;
    const toValue = valueStage?.completed_at ? valueStage.completed_at.slice(0, 10) : null;
    return {
        timeToOnboardDays: from && toOnboard ? daysBetween(toOnboard, from) : null,
        timeToValueDays: from && toValue ? daysBetween(toValue, from) : null,
        valueRealised: !!toValue,
        valueRealisedOn: toValue
    };
}

export const onboardingRepo = {
    async list(user, { account, status } = {}) {
        const db = await getDb();
        const names = await accessibleAccounts(user);
        const rows = await db.all('SELECT * FROM onboardings ORDER BY id DESC');
        const visible = rows.filter((r) => names.has(r.account));

        // Roll each one up so the list can show progress without N+1 detail calls.
        const out = [];
        for (const o of visible) {
            // The account filter was destructured but never applied, so
            // findByAccount (CLM's "already onboarding?" check) returned whichever
            // onboarding had the highest id, not this account's. Invisible with one
            // onboarding; wrong the moment there are two.
            if (account && o.account !== account) continue;
            if (status && o.status !== status) continue;
            const stages = await db.all('SELECT * FROM onboarding_stages WHERE onboarding_id = ? ORDER BY stage_no', [o.id]);
            const tasks = await db.all('SELECT * FROM onboarding_tasks WHERE onboarding_id = ?', [o.id]);
            const doneStages = stages.filter((s) => s.status === 'Done').length;
            const current = stages.find((s) => s.status !== 'Done') || null;
            out.push({
                ...o,
                stageCount: stages.length,
                doneStages,
                progress: stages.length ? Math.round((doneStages / stages.length) * 100) : 0,
                currentStage: current ? {
                    no: current.stage_no, name: current.name, due_date: current.due_date,
                    start_date: current.start_date || null,
                    days_in_stage: current.start_date ? Math.max(0, daysBetween(today(), current.start_date)) : null
                } : null,
                overdueStages: stages.filter((s) => s.status !== 'Done' && s.due_date && s.due_date < today()).length,
                taskCount: tasks.length,
                doneTasks: tasks.filter((t) => t.done).length,
                daysToGoLive: o.target_go_live ? daysBetween(o.target_go_live, today()) : null,
                ...timings(o, stages)
            });
        }
        return out;
    },

    async get(id, user) {
        const db = await getDb();
        const o = await db.get('SELECT * FROM onboardings WHERE id = ?', [id]);
        if (!o) return null;
        const names = await accessibleAccounts(user);
        if (!names.has(o.account)) return null;

        const stages = await db.all('SELECT * FROM onboarding_stages WHERE onboarding_id = ? ORDER BY stage_no', [id]);
        const tasks = await db.all('SELECT * FROM onboarding_tasks WHERE onboarding_id = ? ORDER BY id', [id]);
        const kickoff = o.kickoff_date || (o.started_at || '').slice(0, 10);
        const planned = plannedWindows(stages, kickoff);
        const decorated = stages.map((s, i) => decorateStage(s, tasks, planned[i]));
        const doneStages = decorated.filter((s) => s.status === 'Done').length;

        return {
            ...o,
            stages: decorated,
            progress: decorated.length ? Math.round((doneStages / decorated.length) * 100) : 0,
            daysToGoLive: o.target_go_live ? daysBetween(o.target_go_live, today()) : null,
            ...timings(o, stages),
            // The scope this onboarding is delivering, carried from CLM.
            scope: await scopeRepo.listScope(user, { account: o.account })
        };
    },

    async findByAccount(account, user) {
        const all = await this.list(user, { account });
        return all[0] || null;
    },

    /**
     * "Proceed to onboard" from CLM.
     *
     * Builds the six stages with due dates from the kickoff, and generates
     * Stage 2 from what the customer actually bought.
     */
    async start(data, user) {
        const db = await getDb();
        const names = await accessibleAccounts(user);
        if (!names.has(data.account)) return { forbidden: true };

        // One live onboarding per account — a second would split the truth in two.
        const existing = await db.get(
            "SELECT id FROM onboardings WHERE account = ? AND status != 'Live'",
            [data.account]
        );
        if (existing) return { conflict: true, id: existing.id };

        const now = new Date().toISOString();
        const kickoff = data.kickoff_date || today();
        const scope = await scopeRepo.listScope(user, { account: data.account });

        // The plan: whatever the lead agreed, else the default stretched by how
        // much was actually sold. Deliberately not the support tier — that governs
        // ticket SLAs once live, not how fast delivery goes.
        const scopeItems = scope.reduce((n, s) => n + (s.items.length || 1), 0);
        const plan = Array.isArray(data.stage_days) && data.stage_days.length === STAGES.length
            ? data.stage_days.map((d) => Math.max(1, Number(d) || 1))
            : suggestPlan(scopeItems);

        const r = await db.run(
            `INSERT INTO onboardings
               (account, contract_id, csm_name, csm_email, status, kickoff_date, support_tier, stage_plan,
                target_go_live, started_at, initiated_by, notes, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
                data.account, data.contract_id || '', data.csm_name || '', data.csm_email || '',
                'In progress', kickoff, null, JSON.stringify(plan),
                // Default go-live is the last stage's deadline, so the target and
                // the plan agree from day one.
                // Go-live is the last delivery deadline — the value stage sits past it
                // and must not drag the target with it.
                data.target_go_live || addDays(kickoff, plan[STAGES.filter((x) => !x.valueStage).length - 1]),
                now, user.name || user.email || '', data.notes || '', now, now
            ]
        );
        const onboardingId = r.lastID;

        for (const def of STAGES) {
            const sr = await db.run(
                `INSERT INTO onboarding_stages (onboarding_id, stage_no, name, status, owner, due_date, notes)
                 VALUES (?,?,?,?,?,?,?)`,
                [onboardingId, def.no, def.name, def.no === 1 ? 'In progress' : 'Pending',
                    data.csm_name || '', addDays(kickoff, plan[def.no - 1]), '']
            );
            const stageId = sr.lastID;

            const fixed = def.tasks.map((t) => ({ ...t, product_key: null }));
            // Stage 2 = the fixed instance setup, then everything the CLM scope says.
            const generated = def.generated ? buildStageTwoTasks(scope, PRODUCT_BY_KEY) : [];

            for (const t of [...fixed, ...generated]) {
                await db.run(
                    `INSERT INTO onboarding_tasks (onboarding_id, stage_id, label, product_key, party, done, owner, due_date, created_at)
                     VALUES (?,?,?,?,?,?,?,?,?)`,
                    [onboardingId, stageId, t.label, t.product_key || null, t.party || 'Zeron', 0,
                        data.csm_name || '', addDays(kickoff, plan[def.no - 1]), now]
                );
            }
        }

        if (data.csm_name) {
            // Keep CLM and Cash Horizon agreeing on who owns this customer.
            await db.run('UPDATE contracts SET csm_name = ? WHERE account = ?', [data.csm_name, data.account]);
            await db.run('UPDATE customers SET cxm = ? WHERE name = ?', [data.csm_name, data.account]);
        }

        await logActivity(db, {
            onboardingId, account: data.account, actor: actorOf(user),
            action: 'started', detail: `Onboarding started · CSM ${data.csm_name || '—'}`, toStage: 1
        });

        return { onboarding: await this.get(onboardingId, user) };
    },

    async update(id, data, user) {
        const db = await getDb();
        const current = await this.get(id, user);
        if (!current) return { notFound: true };

        const sets = [];
        const params = [];
        for (const f of ['csm_name', 'csm_email', 'status', 'kickoff_date', 'target_go_live', 'notes', 'contract_id']) {
            if (data[f] !== undefined) { sets.push(`${f} = ?`); params.push(data[f]); }
        }
        if (data.status === 'Live' && !current.completed_at) {
            sets.push('completed_at = ?');
            params.push(new Date().toISOString());
        }
        if (!sets.length) return { onboarding: current };
        sets.push('updated_at = ?');
        params.push(new Date().toISOString());
        await db.run(`UPDATE onboardings SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
        if (data.status && data.status !== current.status) {
            await logActivity(db, {
                onboardingId: id, account: current.account, actor: actorOf(user),
                action: data.status === 'Live' ? 'went_live' : 'status',
                detail: `Status: ${current.status} → ${data.status}`
            });
        }
        return { onboarding: await this.get(id, user) };
    },

    async updateStage(stageId, data, user) {
        const db = await getDb();
        const stage = await db.get('SELECT * FROM onboarding_stages WHERE id = ?', [stageId]);
        if (!stage) return { notFound: true };
        const parent = await this.get(stage.onboarding_id, user);
        if (!parent) return { forbidden: true };

        const sets = [];
        const params = [];
        for (const f of ['status', 'owner', 'due_date', 'notes', 'start_date', 'end_date']) {
            if (data[f] !== undefined) { sets.push(`${f} = ?`); params.push(data[f]); }
        }
        // Stamp the real timestamps as they happen — the immutable audit trail.
        if (data.status === 'In progress' && !stage.started_at) { sets.push('started_at = ?'); params.push(new Date().toISOString()); }
        if (data.status === 'Done' && !stage.completed_at) { sets.push('completed_at = ?'); params.push(new Date().toISOString()); }
        if (data.status && data.status !== 'Done' && stage.completed_at) { sets.push('completed_at = ?'); params.push(null); }
        // Default the CSM-editable working dates from the same transitions, unless
        // the caller set them explicitly in this request. A stage that starts gets
        // a start date; one that finishes gets an end date; reopening clears the end.
        const td = today();
        if (data.status === 'In progress' && data.start_date === undefined && !stage.start_date) { sets.push('start_date = ?'); params.push(td); }
        if (data.status === 'Done') {
            if (data.start_date === undefined && !stage.start_date) { sets.push('start_date = ?'); params.push(td); }
            if (data.end_date === undefined && !stage.end_date) { sets.push('end_date = ?'); params.push(td); }
        }
        if (data.status && data.status !== 'Done' && data.end_date === undefined && stage.end_date) { sets.push('end_date = ?'); params.push(null); }

        if (sets.length) await db.run(`UPDATE onboarding_stages SET ${sets.join(', ')} WHERE id = ?`, [...params, stageId]);
        if (data.status && data.status !== stage.status) {
            await logActivity(db, {
                onboardingId: stage.onboarding_id, account: parent.account, actor: actorOf(user),
                action: 'stage_status', detail: `${stage.name}: ${stage.status} → ${data.status}`,
                fromStage: stage.stage_no, toStage: stage.stage_no
            });
        }
        await this.syncStatus(stage.onboarding_id);
        return { onboarding: await this.get(stage.onboarding_id, user) };
    },

    /**
     * The board move: place an onboarding at a delivery stage. Stages before the
     * target become Done (their tasks ticked), the target becomes In progress, and
     * later delivery stages return to Pending (their tasks cleared) — so the stage
     * and its checklist always agree after a move. Target beyond the last delivery
     * stage means "delivered" → syncStatus takes it Live. The value stage (which
     * runs alongside) is never touched here. Every move is logged.
     */
    async moveToStage(id, targetNo, user) {
        const db = await getDb();
        const parent = await this.get(id, user);
        if (!parent) return { notFound: true };

        const delivery = parent.stages
            .filter((s) => s.stage_no !== VALUE_STAGE_NO)
            .sort((a, b) => a.stage_no - b.stage_no);
        if (!delivery.length) return { onboarding: parent };
        const maxNo = delivery[delivery.length - 1].stage_no;
        const liveNo = maxNo + 1; // the "Live" column
        const target = Math.max(1, Math.min(Number(targetNo) || 1, liveNo));

        // Where it sits now: first non-Done delivery stage, or Live.
        const currentStage = delivery.find((s) => s.status !== 'Done');
        const fromNo = parent.status === 'Live' ? liveNo : (currentStage ? currentStage.stage_no : liveNo);
        if (target === fromNo) return { onboarding: parent };

        const now = new Date().toISOString();
        const td = today();
        for (const s of delivery) {
            const status = s.stage_no < target ? 'Done' : s.stage_no === target ? 'In progress' : 'Pending';
            if (status === s.status) continue;
            if (status === 'Done') {
                await db.run('UPDATE onboarding_stages SET status = ?, started_at = COALESCE(started_at, ?), completed_at = COALESCE(completed_at, ?), start_date = COALESCE(start_date, ?), end_date = COALESCE(end_date, ?) WHERE id = ?', ['Done', now, now, td, td, s.id]);
                await db.run('UPDATE onboarding_tasks SET done = 1, completed_at = COALESCE(completed_at, ?), start_date = COALESCE(start_date, ?), end_date = COALESCE(end_date, ?) WHERE stage_id = ?', [now, td, td, s.id]);
            } else if (status === 'In progress') {
                await db.run('UPDATE onboarding_stages SET status = ?, started_at = COALESCE(started_at, ?), completed_at = NULL, start_date = COALESCE(start_date, ?), end_date = NULL WHERE id = ?', ['In progress', now, td, s.id]);
            } else {
                await db.run('UPDATE onboarding_stages SET status = ?, completed_at = NULL, start_date = NULL, end_date = NULL WHERE id = ?', ['Pending', s.id]);
                await db.run('UPDATE onboarding_tasks SET done = 0, completed_at = NULL, end_date = NULL WHERE stage_id = ?', [s.id]);
            }
        }
        await this.syncStatus(id);

        const nameOf = (n) => (n >= liveNo ? 'Live' : (delivery.find((s) => s.stage_no === n)?.name || `Stage ${n}`));
        await logActivity(db, {
            onboardingId: id, account: parent.account, actor: actorOf(user),
            action: target >= liveNo ? 'went_live' : 'stage_moved',
            detail: `${nameOf(fromNo)} → ${nameOf(target)}`, fromStage: fromNo, toStage: target
        });
        return { onboarding: await this.get(id, user) };
    },

    /** The activity log for one onboarding (newest first). */
    async activity(id, user, { limit = 50 } = {}) {
        const parent = await this.get(id, user);
        if (!parent) return null;
        const db = await getDb();
        return db.all('SELECT * FROM onboarding_activity WHERE onboarding_id = ? ORDER BY id DESC LIMIT ?', [id, limit]);
    },

    /** Recent activity across every onboarding the caller can see (for the board). */
    async recentActivity(user, { limit = 30 } = {}) {
        const db = await getDb();
        const names = await accessibleAccounts(user);
        const rows = await db.all('SELECT * FROM onboarding_activity ORDER BY id DESC LIMIT 500');
        return rows.filter((r) => names.has(r.account)).slice(0, limit);
    },

    async updateTask(taskId, data, user) {
        const db = await getDb();
        const task = await db.get('SELECT * FROM onboarding_tasks WHERE id = ?', [taskId]);
        if (!task) return { notFound: true };
        const parent = await this.get(task.onboarding_id, user);
        if (!parent) return { forbidden: true };

        const sets = [];
        const params = [];
        if (data.done !== undefined) {
            const td = today();
            sets.push('done = ?'); params.push(data.done ? 1 : 0);
            sets.push('completed_at = ?'); params.push(data.done ? new Date().toISOString() : null);
            // Ticking a task clocks it: an end date now, and a start date if it
            // never had one. Un-ticking clears the end. Explicit dates in this
            // request win over these defaults.
            if (data.done) {
                if (data.start_date === undefined && !task.start_date) { sets.push('start_date = ?'); params.push(td); }
                if (data.end_date === undefined && !task.end_date) { sets.push('end_date = ?'); params.push(td); }
            } else if (data.end_date === undefined && task.end_date) {
                sets.push('end_date = ?'); params.push(null);
            }
        }
        for (const f of ['owner', 'due_date', 'notes', 'label', 'start_date', 'end_date']) {
            if (data[f] !== undefined) { sets.push(`${f} = ?`); params.push(data[f]); }
        }
        if (sets.length) await db.run(`UPDATE onboarding_tasks SET ${sets.join(', ')} WHERE id = ?`, [...params, taskId]);

        // A stage whose tasks are all ticked is done; one with any progress is in
        // progress. Derived, so the stage can't sit "Pending" with 9/9 complete.
        const siblings = await db.all('SELECT * FROM onboarding_tasks WHERE stage_id = ?', [task.stage_id]);
        const stage = await db.get('SELECT * FROM onboarding_stages WHERE id = ?', [task.stage_id]);
        if (siblings.length && stage.status !== 'Blocked') {
            const allDone = siblings.every((t) => t.done);
            const anyDone = siblings.some((t) => t.done);
            const next = allDone ? 'Done' : anyDone ? 'In progress' : 'Pending';
            if (next !== stage.status) {
                const nowIso = new Date().toISOString();
                const td = today();
                await db.run(
                    `UPDATE onboarding_stages
                        SET status = ?, completed_at = ?, started_at = COALESCE(started_at, ?),
                            end_date = ?, start_date = COALESCE(start_date, ?)
                      WHERE id = ?`,
                    [next, allDone ? nowIso : null, anyDone ? nowIso : null, allDone ? td : null, anyDone ? td : null, task.stage_id]
                );
            }
        }
        await this.syncStatus(task.onboarding_id);
        return { onboarding: await this.get(task.onboarding_id, user) };
    },

    async addTask(onboardingId, data, user) {
        const db = await getDb();
        const parent = await this.get(onboardingId, user);
        if (!parent) return { notFound: true };
        const stage = parent.stages.find((s) => s.id === Number(data.stage_id));
        if (!stage) return { notFound: true };
        const r = await db.run(
            `INSERT INTO onboarding_tasks (onboarding_id, stage_id, label, party, done, owner, due_date, created_at)
             VALUES (?,?,?,?,?,?,?,?)`,
            [onboardingId, stage.id, data.label, data.party || 'Zeron', 0, data.owner || '', data.due_date || stage.due_date, new Date().toISOString()]
        );
        return { onboarding: await this.get(onboardingId, user), taskId: r.lastID };
    },

    async removeTask(taskId, user) {
        const db = await getDb();
        const task = await db.get('SELECT * FROM onboarding_tasks WHERE id = ?', [taskId]);
        if (!task) return { notFound: true };
        if (!(await this.get(task.onboarding_id, user))) return { forbidden: true };
        await db.run('DELETE FROM onboarding_tasks WHERE id = ?', [taskId]);
        return { onboarding: await this.get(task.onboarding_id, user) };
    },

    /**
     * Live = every *delivery* stage done. Derived, not hand-flagged.
     *
     * The value stage is deliberately excluded. If "Live" required it, then
     * time-to-onboard and time-to-value would always be the same number and one of
     * the two would be pointless. Delivery finishing and the customer actually
     * getting value are different events — often weeks apart, and the gap between
     * them is the interesting part.
     */
    async syncStatus(onboardingId) {
        const db = await getDb();
        const stages = await db.all('SELECT * FROM onboarding_stages WHERE onboarding_id = ?', [onboardingId]);
        if (!stages.length) return;
        const o = await db.get('SELECT * FROM onboardings WHERE id = ?', [onboardingId]);
        if (o.status === 'Blocked') return; // a human said blocked; don't argue

        const delivery = stages.filter((s) => s.stage_no !== VALUE_STAGE_NO);
        const allDone = delivery.every((s) => s.status === 'Done');
        const next = allDone ? 'Live' : 'In progress';
        if (next !== o.status) {
            await db.run(
                'UPDATE onboardings SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?',
                [next, allDone ? (o.completed_at || new Date().toISOString()) : null, new Date().toISOString(), onboardingId]
            );
        }
    },

    async remove(id, user) {
        const db = await getDb();
        if (!(await this.get(id, user))) return { notFound: true };
        await db.run('DELETE FROM onboarding_tasks WHERE onboarding_id = ?', [id]);
        await db.run('DELETE FROM onboarding_stages WHERE onboarding_id = ?', [id]);
        await db.run('DELETE FROM onboardings WHERE id = ?', [id]);
        return { deleted: true };
    },

    /**
     * How efficiently stages move, across every onboarding the caller can see.
     * Actual days-in-stage come from the CSM-logged start/end dates; the planned
     * window is each stage's due date minus the previous stage's.
     */
    async stageEfficiency(list) {
        const empty = { avgStageDays: null, runningLong: 0, slowestStage: null, stageDurations: [] };
        const ids = list.map((o) => o.id);
        if (!ids.length) return empty;
        const db = await getDb();
        const kickoffById = Object.fromEntries(list.map((o) => [o.id, o.kickoff_date || (o.started_at || '').slice(0, 10)]));
        const rows = await db.all(
            `SELECT * FROM onboarding_stages WHERE onboarding_id IN (${ids.map(() => '?').join(',')}) ORDER BY onboarding_id, stage_no`,
            ids
        );
        const byOnb = {};
        for (const s of rows) (byOnb[s.onboarding_id] ||= []).push(s);

        const durations = []; // { no, name, days } — completed stages only
        let runningLong = 0;
        for (const [oid, ss] of Object.entries(byOnb)) {
            const planned = plannedWindows(ss, kickoffById[oid]);
            ss.forEach((s, i) => {
                if (s.start_date && s.end_date) {
                    durations.push({ no: s.stage_no, name: s.name, days: Math.max(0, daysBetween(s.end_date, s.start_date)) });
                }
                if (s.status === 'In progress' && s.start_date && planned[i] != null && daysBetween(today(), s.start_date) > planned[i]) {
                    runningLong += 1;
                }
            });
        }
        const avgStageDays = durations.length ? Math.round(durations.reduce((a, b) => a + b.days, 0) / durations.length) : null;
        const per = {};
        for (const d of durations) {
            (per[d.no] ||= { no: d.no, name: d.name, total: 0, count: 0 });
            per[d.no].total += d.days; per[d.no].count += 1;
        }
        const stageDurations = Object.values(per).sort((a, b) => a.no - b.no)
            .map((x) => ({ no: x.no, name: x.name, avgDays: Math.round(x.total / x.count), count: x.count }));
        const slowestStage = stageDurations.length ? [...stageDurations].sort((a, b) => b.avgDays - a.avgDays)[0] : null;
        return { avgStageDays, runningLong, slowestStage, stageDurations };
    },

    /** Portfolio view for the module header. */
    async stats(user) {
        const list = await this.list(user);
        const live = list.filter((o) => o.status === 'Live');
        const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
        const onboardTimes = list.map((o) => o.timeToOnboardDays).filter((n) => n !== null);
        const valueTimes = list.map((o) => o.timeToValueDays).filter((n) => n !== null);

        // Stage efficiency across every visible onboarding: how many days each
        // stage actually takes, and which are running past their planned window.
        const efficiency = await this.stageEfficiency(list);

        return {
            ...efficiency,
            total: list.length,
            inProgress: list.filter((o) => o.status === 'In progress').length,
            blocked: list.filter((o) => o.status === 'Blocked').length,
            live: live.length,
            atRisk: list.filter((o) => o.status !== 'Live' && o.overdueStages > 0).length,
            // Kickoff -> live. How long delivery took.
            avgTimeToOnboard: avg(onboardTimes),
            // Kickoff -> the first use case actually achieved. The one that matters.
            avgTimeToValue: avg(valueTimes),
            valueRealisedCount: list.filter((o) => o.valueRealised).length,
            // Live but no value yet: provisioned, trained, handed over — and still
            // not doing the thing they bought it for. The gap worth chasing.
            liveWithoutValue: live.filter((o) => !o.valueRealised).length,
            avgDaysToLive: avg(onboardTimes),
            byStage: list.filter((o) => o.status !== 'Live').reduce((acc, o) => {
                if (o.currentStage) acc[o.currentStage.name] = (acc[o.currentStage.name] || 0) + 1;
                return acc;
            }, {})
        };
    }
};
