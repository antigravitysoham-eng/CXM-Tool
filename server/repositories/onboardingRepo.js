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

function decorateStage(stage, tasks) {
    const mine = tasks.filter((t) => t.stage_id === stage.id);
    const done = mine.filter((t) => t.done).length;
    const overdue = stage.status !== 'Done' && !!stage.due_date && stage.due_date < today();
    return {
        ...stage,
        overdue,
        days_late: overdue ? daysBetween(today(), stage.due_date) : 0,
        // Recorded against the deadline it was given: negative = early.
        delivered_variance_days: stage.completed_at && stage.due_date
            ? daysBetween(stage.completed_at.slice(0, 10), stage.due_date)
            : null,
        taskCount: mine.length,
        doneCount: done,
        progress: mine.length ? Math.round((done / mine.length) * 100) : 0,
        tasks: mine
    };
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
                currentStage: current ? { no: current.stage_no, name: current.name, due_date: current.due_date } : null,
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
        const decorated = stages.map((s) => decorateStage(s, tasks));
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
        for (const f of ['status', 'owner', 'due_date', 'notes']) {
            if (data[f] !== undefined) { sets.push(`${f} = ?`); params.push(data[f]); }
        }
        // Stamp the real dates as they happen — that's what makes the delivery
        // variance against the due date meaningful rather than decorative.
        if (data.status === 'In progress' && !stage.started_at) { sets.push('started_at = ?'); params.push(new Date().toISOString()); }
        if (data.status === 'Done' && !stage.completed_at) { sets.push('completed_at = ?'); params.push(new Date().toISOString()); }
        if (data.status && data.status !== 'Done' && stage.completed_at) { sets.push('completed_at = ?'); params.push(null); }

        if (sets.length) await db.run(`UPDATE onboarding_stages SET ${sets.join(', ')} WHERE id = ?`, [...params, stageId]);
        await this.syncStatus(stage.onboarding_id);
        return { onboarding: await this.get(stage.onboarding_id, user) };
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
            sets.push('done = ?'); params.push(data.done ? 1 : 0);
            sets.push('completed_at = ?'); params.push(data.done ? new Date().toISOString() : null);
        }
        for (const f of ['owner', 'due_date', 'notes', 'label']) {
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
                await db.run(
                    `UPDATE onboarding_stages SET status = ?, completed_at = ?, started_at = COALESCE(started_at, ?) WHERE id = ?`,
                    [next, allDone ? new Date().toISOString() : null, anyDone ? new Date().toISOString() : null, task.stage_id]
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

    /** Portfolio view for the module header. */
    async stats(user) {
        const list = await this.list(user);
        const live = list.filter((o) => o.status === 'Live');
        const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
        const onboardTimes = list.map((o) => o.timeToOnboardDays).filter((n) => n !== null);
        const valueTimes = list.map((o) => o.timeToValueDays).filter((n) => n !== null);
        return {
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
