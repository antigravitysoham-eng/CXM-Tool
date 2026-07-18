import { getDb } from '../db.js';
import { accountRepo } from './accountRepo.js';
import { contractRepo } from './contractRepo.js';
import { supportRepo } from './supportRepo.js';
import { trainingRepo } from './trainingRepo.js';
import { onboardingRepo } from './onboardingRepo.js';
import { healthRepo } from './healthRepo.js';
import { currentQuarter, quarterLabel, quarterRange, EBR_STATUSES } from '../data/ebrPeriods.js';

/**
 * Aria — quarterly Executive Business Reviews, generated FROM the platform.
 *
 * An EBR isn't hand-typed: `generate` rolls up a customer's contract/ARR,
 * onboarding, support SLA, enablement and vendor-health for the quarter, then
 * synthesises insights (what went well) and areas for improvement (what to fix)
 * from those numbers and the health-call summaries. The result is a frozen JSON
 * snapshot, so a review shared with a customer never silently changes later.
 *
 * One EBR per (account, quarter): regenerating supersedes the snapshot.
 */

const now = () => new Date().toISOString();
const fmtInr = (n) => {
    const v = Math.round(Number(n) || 0);
    if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
    if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
    if (v >= 1e3) return `₹${(v / 1e3).toFixed(1)}k`;
    return `₹${v}`;
};

async function accessibleNames(user) {
    if (!user) throw new Error('ebrRepo: a user is required — pass req.user');
    return await accountRepo.list(user);
}

const parseJson = (s, fallback) => { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } };
const hydrate = (row) => row && ({
    ...row,
    metrics: parseJson(row.metrics, {}),
    insights: parseJson(row.insights, []),
    improvements: parseJson(row.improvements, []),
    quarterLabel: quarterLabel(row.quarter)
});

export const ebrRepo = {
    /**
     * Pull one customer's whole-platform snapshot for a quarter and turn it into
     * an EBR: metrics + insights + areas for improvement. Persists (upserts) and
     * returns the stored EBR. Returns {forbidden}/{notFound} for ABAC.
     */
    async generate({ account, quarter }, user) {
        const accounts = await accessibleNames(user);
        const acct = accounts.find((a) => a.name === account);
        if (!acct) return { forbidden: true };
        if (acct.segment !== 'Customer') return { notFound: true }; // EBRs are for customers only
        const q = quarter || currentQuarter();
        const { start, end } = quarterRange(q);

        // ---- pull the platform ----
        const c360 = await contractRepo.customer360(account, user);
        const cm = c360?.metrics || {};
        const support = await supportRepo.stats(user, { account });
        const training = await trainingRepo.stats(user, { account });
        const trainingRevMap = await trainingRepo.revenueByAccount();
        const onboarding = (await onboardingRepo.list(user, { account }))[0] || null;
        const health = (await healthRepo.accountHealth(user)).find((h) => h.account === account) || null;
        const calls = (await healthRepo.listCalls(user, { account }))
            .filter((c) => c.check_date >= start && c.check_date <= end);

        const metrics = {
            tier: cm.supportTier || health?.tier || 'Standard',
            arrInr: cm.totalArrInr || 0,
            tcvInr: cm.totalTcvInr || 0,
            activeContracts: cm.activeCount || 0,
            revenueAtRiskInr: cm.revenueAtRiskInr || 0,
            nextRenewalDays: cm.nextRenewalDays ?? null,
            nextRenewalDate: cm.nextRenewalDate || null,
            trainingRevenueInr: trainingRevMap[account] || 0,
            support: {
                open: support.open, resolved: support.resolved, breached: support.breached,
                atRisk: support.atRisk, slaAttainment: support.slaAttainment, avgResolutionHrs: support.avgResolutionHrs
            },
            enablement: {
                enrolled: training.enrolled, completionRate: training.completionRate,
                certified: training.certified, certificationRate: training.certificationRate
            },
            onboarding: onboarding ? { status: onboarding.status, progress: onboarding.progress, daysToGoLive: onboarding.daysToGoLive } : null,
            health: health ? {
                signal: health.currentSignal, sentiment: health.sentiment, trend: health.trend,
                openActions: health.openActions, overdue: health.overdue, checkCount: health.checkCount,
                lastCheckDate: health.lastCheckDate
            } : null,
            checksThisQuarter: calls.length
        };

        const { insights, improvements, summary } = synthesise(account, q, metrics, calls);

        // ---- upsert one per (account, quarter) ----
        const db = await getDb();
        const existing = await db.get('SELECT * FROM ebrs WHERE account = ? AND quarter = ?', [account, q]);
        const title = `${account} — Executive Business Review, ${quarterLabel(q)}`;
        const ts = now();
        if (existing) {
            await db.run(
                `UPDATE ebrs SET status = 'Generated', title = ?, summary = ?, metrics = ?, insights = ?, improvements = ?,
                 generated_at = ?, shared_at = NULL, updated_at = ? WHERE id = ?`,
                [title, summary, JSON.stringify(metrics), JSON.stringify(insights), JSON.stringify(improvements), ts, ts, existing.id]
            );
            return { ebr: await this.get(existing.id, user), regenerated: true };
        }
        const r = await db.run(
            `INSERT INTO ebrs (account, quarter, status, title, summary, metrics, insights, improvements, generated_at, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [account, q, 'Generated', title, summary, JSON.stringify(metrics), JSON.stringify(insights), JSON.stringify(improvements), ts, ts, ts]
        );
        return { ebr: await this.get(r.lastID, user) };
    },

    /** Generate an EBR for every accessible customer for a quarter. */
    async generateAll({ quarter } = {}, user) {
        const q = quarter || currentQuarter();
        const customers = (await accessibleNames(user)).filter((a) => a.segment === 'Customer');
        let generated = 0;
        for (const a of customers) {
            const r = await this.generate({ account: a.name, quarter: q }, user);
            if (r.ebr) generated += 1;
        }
        return { quarter: q, generated };
    },

    async list(user, { account, quarter, status } = {}) {
        const db = await getDb();
        const names = new Set((await accessibleNames(user)).map((a) => a.name));
        const where = []; const params = [];
        if (account) { where.push('account = ?'); params.push(account); }
        if (quarter) { where.push('quarter = ?'); params.push(quarter); }
        if (status) { where.push('status = ?'); params.push(status); }
        const sql = `SELECT * FROM ebrs ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY quarter DESC, account ASC`;
        const rows = await db.all(sql, params);
        return rows.filter((r) => names.has(r.account)).map(hydrate);
    },

    async get(id, user) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM ebrs WHERE id = ?', [id]);
        if (!row) return null;
        const names = new Set((await accessibleNames(user)).map((a) => a.name));
        if (!names.has(row.account)) return null;
        return hydrate(row);
    },

    async update(id, data, user) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM ebrs WHERE id = ?', [id]);
        if (!row) return { notFound: true };
        const names = new Set((await accessibleNames(user)).map((a) => a.name));
        if (!names.has(row.account)) return { forbidden: true };
        const sets = []; const params = [];
        for (const f of ['title', 'summary']) if (data[f] !== undefined) { sets.push(`${f} = ?`); params.push(data[f]); }
        for (const f of ['insights', 'improvements']) if (data[f] !== undefined) { sets.push(`${f} = ?`); params.push(JSON.stringify(data[f])); }
        if (!sets.length) return { ebr: hydrate(row) };
        sets.push('updated_at = ?'); params.push(now());
        await db.run(`UPDATE ebrs SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
        return { ebr: await this.get(id, user) };
    },

    /** Mark an EBR as shared with the customer (the quarterly deliverable). */
    async share(id, user) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM ebrs WHERE id = ?', [id]);
        if (!row) return { notFound: true };
        const names = new Set((await accessibleNames(user)).map((a) => a.name));
        if (!names.has(row.account)) return { forbidden: true };
        const ts = now();
        await db.run("UPDATE ebrs SET status = 'Shared', shared_at = ?, updated_at = ? WHERE id = ?", [ts, ts, id]);
        return { ebr: await this.get(id, user) };
    },

    async remove(id, user) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM ebrs WHERE id = ?', [id]);
        if (!row) return { notFound: true };
        const names = new Set((await accessibleNames(user)).map((a) => a.name));
        if (!names.has(row.account)) return { forbidden: true };
        await db.run('DELETE FROM ebrs WHERE id = ?', [id]);
        return { deleted: true };
    },

    /**
     * Quarterly coverage board: for the quarter, which customers have an EBR,
     * whether it's been shared, and the portfolio rollup the header shows.
     */
    async coverage(user, { quarter } = {}) {
        const q = quarter || currentQuarter();
        const customers = (await accessibleNames(user)).filter((a) => a.segment === 'Customer');
        const ebrs = await this.list(user, { quarter: q });
        const byAccount = Object.fromEntries(ebrs.map((e) => [e.account, e]));
        const rows = customers.map((a) => {
            const e = byAccount[a.name] || null;
            return {
                account: a.name,
                quarter: q,
                status: e ? e.status : 'Not started',
                shared: e ? e.status === 'Shared' : false,
                id: e ? e.id : null,
                signal: e?.metrics?.health?.signal || null,
                arrInr: e?.metrics?.arrInr || 0
            };
        }).sort((x, y) => Number(x.shared) - Number(y.shared) || x.account.localeCompare(y.account));
        return {
            quarter: q, quarterLabel: quarterLabel(q),
            customers: customers.length,
            generated: ebrs.length,
            shared: ebrs.filter((e) => e.status === 'Shared').length,
            pendingShare: ebrs.filter((e) => e.status !== 'Shared').length,
            notStarted: customers.length - ebrs.length,
            rows
        };
    }
};

/**
 * Turn the metric snapshot + the quarter's health-call summaries into an
 * executive narrative: a headline summary, wins, and areas for improvement.
 * Rules are deliberately explicit — an EBR a CSM presents shouldn't hinge on a
 * black box.
 */
function synthesise(account, quarter, m, calls) {
    const insights = [];
    const improvements = [];

    // ---- commercial ----
    if (m.arrInr > 0) insights.push(`Active ARR of ${fmtInr(m.arrInr)} across ${m.activeContracts} contract${m.activeContracts === 1 ? '' : 's'}.`);
    if (m.trainingRevenueInr > 0) insights.push(`${fmtInr(m.trainingRevenueInr)} in enablement (training) revenue booked.`);
    if (m.nextRenewalDays !== null && m.nextRenewalDays <= 90) {
        improvements.push(`Renewal is ${m.nextRenewalDays < 0 ? `${Math.abs(m.nextRenewalDays)} days overdue` : `due in ${m.nextRenewalDays} days`}${m.nextRenewalDate ? ` (${m.nextRenewalDate})` : ''} — open the renewal conversation now.`);
    }
    if (m.revenueAtRiskInr > 0) improvements.push(`${fmtInr(m.revenueAtRiskInr)} of contract value sits inside the renewal-risk window.`);

    // ---- vendor health (from Pulse) ----
    if (m.health) {
        const h = m.health;
        if (h.signal === 'Green') insights.push('Vendor-health signal is Green — the relationship is healthy.');
        else if (h.signal === 'Amber') improvements.push('Vendor-health signal is Amber — adoption or sentiment is slipping; agree a plan to bring it back to Green.');
        else if (h.signal === 'Red') improvements.push('Vendor-health signal is Red — this is a renewal risk; a save plan is the priority coming out of this review.');
        if (h.trend < 0) improvements.push('Health has worsened since the previous check — the last call summary explains why.');
        if (h.overdue) improvements.push('The next health check is overdue against the tier cadence — schedule it.');
        if (h.openActions > 0) improvements.push(`${h.openActions} open actionable${h.openActions === 1 ? '' : 's'} carried from health checks still need closing.`);
    } else {
        improvements.push('No health checks on record this quarter — start the tier-cadenced call rhythm.');
    }

    // ---- support / SLA (from Medic) ----
    const s = m.support;
    if (s.slaAttainment !== null && s.slaAttainment >= 90) insights.push(`Support SLA attainment at ${s.slaAttainment}% — commitments are being met.`);
    if (s.breached > 0) improvements.push(`${s.breached} support ticket${s.breached === 1 ? '' : 's'} breached SLA this period — review the root causes.`);
    if (s.open > 0) improvements.push(`${s.open} support ticket${s.open === 1 ? '' : 's'} still open going into the review.`);

    // ---- enablement (from Sensei) ----
    const e = m.enablement;
    if (e.enrolled > 0 && e.completionRate >= 70) insights.push(`Strong enablement — ${e.completionRate}% course completion across ${e.enrolled} learners, ${e.certified} certified.`);
    if (e.enrolled >= 5 && e.completionRate < 50) improvements.push(`Enablement gap — only ${e.completionRate}% of ${e.enrolled} enrolled learners have completed; under-trained users drive support load and churn.`);

    // ---- onboarding (from Pilot) ----
    if (m.onboarding) {
        if (m.onboarding.status === 'Completed' || m.onboarding.progress === 100) insights.push('Onboarding is complete — the customer is fully live.');
        else improvements.push(`Onboarding is ${m.onboarding.progress}% complete${m.onboarding.daysToGoLive !== null ? ` (${m.onboarding.daysToGoLive} days to target go-live)` : ''} — keep it on track.`);
    }

    // ---- voice of customer, from the health-call summaries in the quarter ----
    for (const c of calls.slice(0, 3)) {
        if (c.summary && c.summary.trim()) insights.push(`From the ${c.check_date} check (${c.signal}): “${c.summary.trim().slice(0, 180)}${c.summary.trim().length > 180 ? '…' : ''}”`);
    }

    if (!insights.length) insights.push('No standout wins captured this quarter — the next EBR is the chance to change that.');
    if (!improvements.length) improvements.push('No material risks flagged this quarter — maintain the cadence and keep enablement current.');

    const signalWord = m.health?.signal ? m.health.signal.toLowerCase() : 'unmeasured';
    const summary = `Executive Business Review for ${account}, ${quarterLabel(quarter)}. `
        + `The account carries ${fmtInr(m.arrInr)} ARR on a ${m.tier} support tier with ${signalWord} vendor-health. `
        + `${insights.length} highlight${insights.length === 1 ? '' : 's'} and ${improvements.length} area${improvements.length === 1 ? '' : 's'} for improvement were drawn from platform data and ${calls.length} health-check ${calls.length === 1 ? 'call' : 'calls'} this quarter.`;

    return { insights, improvements, summary };
}

export { EBR_STATUSES };
