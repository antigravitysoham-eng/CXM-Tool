import { getDb } from '../db.js';
import { config } from '../config.js';
import { accountRepo } from './accountRepo.js';
import { contractRepo } from './contractRepo.js';
import { scopeRepo } from './scopeRepo.js';
import { onboardingRepo } from './onboardingRepo.js';
import { supportRepo } from './supportRepo.js';
import { trainingRepo } from './trainingRepo.js';
import { healthRepo } from './healthRepo.js';
import { ebrRepo } from './ebrRepo.js';
import { surveyRepo } from './surveyRepo.js';
import { featureRepo } from './featureRepo.js';
import { expansionRepo } from './expansionRepo.js';
import { referralRepo } from './referralRepo.js';
import { commsRepo } from './commsRepo.js';
import { eventRepo } from './eventRepo.js';
import { journeyRepo } from './journeyRepo.js';
import { scoreCustomer, detectAnomaly, RISK_WEIGHTS as RISK_WEIGHT_TABLE } from '../data/riskModel.js';

/**
 * The executive dashboard aggregator.
 *
 * One read that answers "how is the whole business doing" — every module's
 * headline metrics, portfolio coverage (region / industry / tier), month-by-month
 * KPI & KRI trends derived from the dates already on the records, a forward
 * projection, and the concrete next actions each team should take.
 *
 * Everything is ABAC-scoped: it only ever sums what the caller can already read.
 */

const MONTHS = 6;
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);
const sum = (a) => a.reduce((s, n) => s + (n || 0), 0);
const avg = (a) => (a.length ? Math.round(sum(a) / a.length) : 0);

/** The last N month keys, oldest first: ['2026-02', …, '2026-07']. */
function monthKeys(n = MONTHS) {
    const out = [];
    const d = new Date();
    d.setDate(1);
    for (let i = n - 1; i >= 0; i--) {
        const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
        out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
    }
    return out;
}
const monthOf = (v) => (v ? String(v).slice(0, 7) : null);
const label = (key) => {
    const [y, m] = key.split('-');
    return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1]} ${String(y).slice(2)}`;
};

/**
 * Bucket rows into the month series.
 * `value` returns the number to add for a row (default 1 = a count).
 */
function series(keys, rows, dateField, value = () => 1) {
    const m = Object.fromEntries(keys.map((k) => [k, 0]));
    for (const r of rows) {
        const k = monthOf(r[dateField]);
        if (k in m) m[k] += value(r) || 0;
    }
    return keys.map((k) => m[k]);
}
/** Same, but averages the contributing rows instead of summing. */
function seriesAvg(keys, rows, dateField, value) {
    const acc = Object.fromEntries(keys.map((k) => [k, []]));
    for (const r of rows) {
        const k = monthOf(r[dateField]);
        if (k in acc) acc[k].push(value(r));
    }
    return keys.map((k) => (acc[k].length ? Math.round(sum(acc[k]) / acc[k].length) : 0));
}

/** Least-squares slope → project the next `ahead` points off the trend. */
function project(vals, ahead = 3) {
    const pts = vals.filter((v) => v !== null);
    if (pts.length < 2) return Array(ahead).fill(pts[0] ?? 0);
    const n = pts.length;
    const xs = pts.map((_, i) => i);
    const mx = sum(xs) / n; const my = sum(pts) / n;
    const denom = sum(xs.map((x) => (x - mx) ** 2)) || 1;
    const slope = sum(xs.map((x, i) => (x - mx) * (pts[i] - my))) / denom;
    return Array.from({ length: ahead }, (_, i) => Math.max(0, Math.round(my + slope * (n - 1 - mx + i + 1))));
}

const countBy = (rows, key) => rows.reduce((m, r) => {
    const k = (typeof key === 'function' ? key(r) : r[key]) || 'Unspecified';
    m[k] = (m[k] || 0) + 1;
    return m;
}, {});
const sumBy = (rows, key, val) => rows.reduce((m, r) => {
    const k = (typeof key === 'function' ? key(r) : r[key]) || 'Unspecified';
    m[k] = (m[k] || 0) + (val(r) || 0);
    return m;
}, {});
const toPairs = (obj) => Object.entries(obj).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

export const dashboardRepo = {
    async overview(user) {
        const db = await getDb();
        const fx = config.fxUsdInr;
        const keys = monthKeys();
        const months = keys.map(label);

        // ── raw, ABAC-scoped ──────────────────────────────────────────────
        const accounts = await accountRepo.list(user);
        const names = new Set(accounts.map((a) => a.name));
        const mine = (rows) => rows.filter((r) => names.has(r.account));
        const customers = accounts.filter((a) => a.segment === 'Customer');
        const prospects = accounts.filter((a) => a.segment === 'Prospect');
        const contracts = await contractRepo.list({}, user);

        const [supportStats, trainingStats, onboardingStats, healthStats, surveyStats,
            featureStats, expansionStats, referralStats, commsStats, eventStats,
            journeyStats, adoption, ebrCoverage, invoiceStats, accountHealth] = await Promise.all([
                supportRepo.stats(user), trainingRepo.stats(user), onboardingRepo.stats(user),
                healthRepo.stats(user), surveyRepo.stats(user), featureRepo.stats(user),
                expansionRepo.stats(user), referralRepo.stats(user), commsRepo.stats(user),
                eventRepo.stats(user), journeyRepo.stats(user), journeyRepo.adoption(user),
                ebrRepo.coverage(user), scopeRepo.invoiceStats(user, {}, fx),
                healthRepo.accountHealth(user)
            ]);

        // dated rows for the trend series
        const [tickets, responses, campaigns, calls, deals, refs, feats, evts, comms, sessions,
            onboardings, stages, actionables, enrollments, ebrRows, nudges] = await Promise.all([
                db.all('SELECT account, opened_at, first_response_at, resolved_at, status, priority FROM support_tickets'),
                db.all('SELECT r.account, r.created_at, r.score, r.sentiment, c.type FROM survey_responses r LEFT JOIN survey_campaigns c ON c.id = r.campaign_id'),
                db.all('SELECT account, sent_at, opens, clicks, recipients FROM comms_campaigns'),
                db.all('SELECT account, check_date, signal FROM health_calls'),
                db.all('SELECT account, created_at, stage, value_amount, currency FROM expansions'),
                db.all('SELECT account, created_at, status, value_amount, currency FROM referral_leads'),
                db.all('SELECT account, created_at, status FROM feature_reqs'),
                db.all('SELECT account, starts_at, registered, attended, status FROM cx_events'),
                db.all('SELECT account, sent_at, opens, clicks, recipients FROM comms_campaigns'),
                db.all('SELECT account, session_date, enrolled, completed, certified FROM training_sessions'),
                db.all('SELECT account, kickoff_date, completed_at, status FROM onboardings'),
                db.all('SELECT s.due_date, s.completed_at, s.status, o.account FROM onboarding_stages s LEFT JOIN onboardings o ON o.id = s.onboarding_id'),
                db.all('SELECT account, created_at, updated_at, status, carried_from FROM health_check_actions'),
                db.all('SELECT account, enrolled_at, completed_at, certified_at FROM training_enrollments'),
                db.all('SELECT account, generated_at, shared_at, status FROM ebrs'),
                db.all('SELECT account, nudged_at, outcome FROM referral_nudges')
            ]);
        const toInr = (r) => ((r.currency === 'USD' ? (r.value_amount || 0) * fx : (r.value_amount || 0)) || 0);

        // ── portfolio headline ────────────────────────────────────────────
        // Contracts hang off accounts of every segment (partners resell, prospects
        // hold drafts). Recurring revenue is the *customer* book only — anything
        // else inflates ARR with money nobody is paying yet.
        const cVal = (c) => (c.currency === 'INR' ? c.arr : (c.arr || 0) * fx) || 0;
        const customerNames = new Set(customers.map((c) => c.name));
        const customerContracts = contracts.filter((c) => customerNames.has(c.account));
        const activeContracts = customerContracts.filter((c) => c.status === 'Active' || c.status === 'Renewing');
        const arr = sum(activeContracts.map(cVal));
        const arpa = customers.length ? arr / customers.length : 0;

        // Retention, the two numbers a SaaS board opens with. The opening base is
        // what was under contract before this period's losses, so:
        //   GRR = surviving base ÷ opening base   (never above 100%)
        //   NRR = (surviving + expansion won) ÷ opening base
        const lostArr = sum(customerContracts.filter((c) => c.status === 'Churned' || c.status === 'Expired').map(cVal));
        const openingArr = arr + lostArr;
        const expansionWonInr = sum(deals.filter((d) => customerNames.has(d.account) && d.stage === 'Won').map(toInr));
        const grr = openingArr ? Math.round((arr / openingArr) * 100) : null;
        const nrr = openingArr ? Math.round(((arr + expansionWonInr) / openingArr) * 100) : null;

        const renewals90 = customerContracts.filter((c) => c.days_to_renewal !== null && c.days_to_renewal >= 0 && c.days_to_renewal <= 90);
        const atRiskValue = sum(renewals90.map(cVal));

        // "At risk" is health-led, not renewal-date-led — a red account is a churn
        // candidate whether or not its renewal happens to fall in the window.
        const atRiskCustomers = customers.filter((a) => a.health === 'Poor' || a.health === 'Critical');
        const atRiskNames = new Set(atRiskCustomers.map((a) => a.name));
        const atRiskArr = sum(activeContracts.filter((c) => atRiskNames.has(c.account)).map(cVal));

        const pipelineInr = sum(prospects.map((a) => (a.value_currency === 'INR' ? a.value_amount : (a.value_amount || 0) * fx) || 0));
        const weightedPipeline = sum(prospects.map((a) => (((a.value_currency === 'INR' ? a.value_amount : (a.value_amount || 0) * fx) || 0) * (a.probability || 0)) / 100));

        // ── coverage ──────────────────────────────────────────────────────
        // Book of business per CSM: headcount alone hides the real imbalance, so
        // each name also carries the ARR and the red/poor accounts they hold.
        const csmOf = (a) => a.cxm || a.sales_owner || 'Unassigned';
        const arrOf = (a) => sum(activeContracts.filter((c) => c.account === a.name).map(cVal));
        const csmNames = [...new Set(customers.map(csmOf))];
        const byCsm = csmNames.map((n) => {
            const book = customers.filter((a) => csmOf(a) === n);
            return {
                name: n,
                value: book.length,
                arr: Math.round(sum(book.map(arrOf))),
                atRisk: book.filter((a) => atRiskNames.has(a.name)).length
            };
        }).sort((a, b) => b.arr - a.arr || b.value - a.value);

        const coverage = {
            byRegion: toPairs(countBy(customers, (a) => a.region || 'Unspecified')),
            byRegionValue: toPairs(sumBy(customers, 'region', arrOf)),
            byIndustry: toPairs(countBy(customers, (a) => a.industry || 'Unspecified')).slice(0, 8),
            byIndustryValue: toPairs(sumBy(customers, (a) => a.industry || 'Unspecified', arrOf)).slice(0, 8),
            byCsm,
            byTier: toPairs(countBy(customers, 'tier')),
            bySegment: toPairs(countBy(accounts, 'segment')),
            byHealth: toPairs(countBy(customers, 'health')),
            csmCount: csmNames.length,
            regionsCovered: new Set(customers.map((a) => a.region).filter(Boolean)).size,
            industriesCovered: new Set(customers.map((a) => a.industry).filter(Boolean)).size
        };

        // ── module-by-module metric groups ────────────────────────────────
        const money = (n) => Math.round(n);
        // Narrative strings (forecast notes, action details) carry a formatted
        // figure — the raw paise-free integer reads as noise in a sentence.
        const inr = (n) => {
            const v = Math.round(n || 0);
            if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
            if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
            if (v >= 1e3) return `₹${(v / 1e3).toFixed(1)}k`;
            return `₹${v}`;
        };
        const modules = [
            {
                key: 'accounts', title: 'Accounts & Pipeline', color: '#f59e0b', route: '/cash-horizon',
                kpis: [
                    { label: 'Customers', value: customers.length, hint: `${accounts.length} accounts total` },
                    { label: 'Open pipeline', value: money(pipelineInr), format: 'inr', hint: `${prospects.length} prospects` },
                    { label: 'Weighted forecast', value: money(weightedPipeline), format: 'inr', hint: 'value × win probability' },
                    { label: 'At-risk customers', value: atRiskCustomers.length, tone: 'risk', hint: `${inr(atRiskArr)} ARR exposed` }
                ],
                chart: { type: 'donut', title: 'Accounts by segment', data: coverage.bySegment }
            },
            {
                key: 'contracts', title: 'Contracts (CLM)', color: '#a855f7', route: '/clm',
                kpis: [
                    { label: 'ARR under management', value: money(arr), format: 'inr', hint: `${activeContracts.length} active customer contracts` },
                    { label: 'Gross retention', value: grr, format: 'pct', tone: grr >= 90 ? 'good' : 'risk', hint: `${inr(lostArr)} churned or expired` },
                    { label: 'Renewals ≤ 90d', value: renewals90.length, tone: renewals90.length ? 'watch' : 'good', hint: `${inr(atRiskValue)} in the window` },
                    { label: 'Collected', value: money(invoiceStats.collected), format: 'inr', hint: `${inr(invoiceStats.outstanding)} outstanding` }
                ],
                chart: { type: 'bar', title: 'Contracts by status', data: toPairs(countBy(customerContracts, 'status')) }
            },
            {
                key: 'onboarding', title: 'Onboarding', color: '#818cf8', route: '/onboarding',
                kpis: [
                    { label: 'In flight', value: onboardingStats.inProgress || 0, hint: `${onboardingStats.total || 0} total` },
                    { label: 'At risk', value: onboardingStats.atRisk || 0, tone: 'risk', hint: 'a stage is past due' },
                    { label: 'Time to onboard', value: onboardingStats.avgTimeToOnboard || 0, format: 'days', hint: 'kickoff → live' },
                    { label: 'Time to value', value: onboardingStats.avgTimeToValue || 0, format: 'days', hint: 'kickoff → first use case' }
                ],
                chart: { type: 'bar', title: 'Avg days per stage', data: (onboardingStats.stageDurations || []).map((d) => ({ name: d.name, value: d.avgDays })) }
            },
            {
                key: 'support', title: 'Support', color: '#f43f5e', route: '/support',
                kpis: [
                    { label: 'Open tickets', value: supportStats.open, hint: `${supportStats.total} total` },
                    { label: 'SLA breaches', value: supportStats.breached, tone: 'risk', hint: 'response or resolution' },
                    { label: 'SLA attainment', value: supportStats.slaAttainment ?? 0, format: 'pct', tone: 'good', hint: `${supportStats.resolved} resolved` },
                    { label: 'Avg resolution', value: Math.round(supportStats.avgResolutionHrs || 0), format: 'hrs', hint: 'hours to close' }
                ],
                chart: { type: 'bar', title: 'Open tickets by priority', data: toPairs(supportStats.byPriority || {}) }
            },
            {
                key: 'training', title: 'Training', color: '#a855f7', route: '/training',
                kpis: [
                    { label: 'Learners enrolled', value: trainingStats.enrolled, hint: `${trainingStats.sessions} sessions` },
                    { label: 'Completion rate', value: trainingStats.completionRate, format: 'pct', tone: 'good' },
                    { label: 'Certified', value: trainingStats.certified, hint: `${trainingStats.certificationRate}% of enrolled` },
                    { label: 'Stalled sessions', value: trainingStats.stalled, tone: 'watch' }
                ],
                chart: { type: 'donut', title: 'Sessions by status', data: toPairs(trainingStats.byStatus || {}) }
            },
            {
                key: 'health-checks', title: 'Customer Health', color: '#ef4444', route: '/health-checks',
                kpis: [
                    { label: 'Customers tracked', value: healthStats.accounts, hint: `${healthStats.neverChecked} never checked` },
                    { label: 'Red / Amber', value: (healthStats.red || 0) + (healthStats.amber || 0), tone: 'risk', hint: `${healthStats.red} red` },
                    { label: 'Overdue checks', value: healthStats.overdue, tone: 'watch', hint: 'past tier cadence' },
                    { label: 'Open actionables', value: healthStats.openActions, hint: `${healthStats.worsening} worsening` }
                ],
                chart: { type: 'donut', title: 'Customers by health signal', data: toPairs(healthStats.bySignal || {}) }
            },
            {
                key: 'surveys', title: 'Voice of Customer', color: '#14b8a6', route: '/surveys',
                kpis: [
                    { label: 'NPS', value: surveyStats.nps ?? 0, tone: (surveyStats.nps ?? 0) >= 30 ? 'good' : 'watch', hint: `${surveyStats.responses} responses` },
                    { label: 'CSAT', value: surveyStats.csat ?? 0, format: 'pct' },
                    { label: 'Response rate', value: surveyStats.responseRate ?? 0, format: 'pct', hint: `${surveyStats.live} live campaigns` },
                    { label: 'Detractors', value: surveyStats.detractors, tone: 'risk', hint: 'to follow up' }
                ],
                chart: { type: 'donut', title: 'Responses by sentiment', data: toPairs(surveyStats.sentiments || {}) }
            },
            {
                key: 'upsells', title: 'Expansion', color: '#22c55e', route: '/upsells',
                kpis: [
                    { label: 'Open pipeline', value: money(expansionStats.openValueInr), format: 'inr', hint: `${expansionStats.open} deals` },
                    { label: 'Weighted forecast', value: money(expansionStats.weightedForecastInr), format: 'inr', tone: 'good' },
                    { label: 'Won', value: money(expansionStats.wonInr), format: 'inr', hint: `${expansionStats.won} deals` },
                    { label: 'Win rate', value: expansionStats.winRate ?? 0, format: 'pct' }
                ],
                chart: { type: 'bar', title: 'Pipeline value by stage', data: (expansionStats.valueByStage || []).filter((s) => s.value > 0).map((s) => ({ name: s.stage, value: s.value })) }
            },
            {
                key: 'feature-requests', title: 'Product Demand', color: '#eab308', route: '/feature-requests',
                kpis: [
                    { label: 'Requests', value: featureStats.total, hint: `${featureStats.open} open` },
                    { label: 'Shipped', value: featureStats.shipped, format: 'num', tone: 'good', hint: `${featureStats.shippedRate}% shipped` },
                    { label: 'Total demand', value: featureStats.totalDemand, hint: 'supporters + votes' },
                    { label: 'Awaiting triage', value: (featureStats.byStatus?.Requested || 0) + (featureStats.byStatus?.['Under review'] || 0), tone: 'watch' }
                ],
                chart: { type: 'bar', title: 'Requests by status', data: toPairs(featureStats.byStatus || {}) }
            },
            {
                key: 'journey', title: 'Lifecycle & Adoption', color: '#3b82f6', route: '/journey',
                kpis: [
                    { label: 'Avg module usage', value: adoption.summary.avgUsage ?? 0, format: 'pct', hint: `${adoption.summary.mostUsed?.product || '—'} leads` },
                    { label: 'Active users', value: adoption.summary.activeUsers || 0, hint: `of ${adoption.summary.totalUsers || 0} tracked` },
                    { label: 'Stalled customers', value: journeyStats.stalled, tone: 'watch', hint: 'too long in stage' },
                    { label: 'Dormant modules', value: adoption.summary.dormantModules, tone: 'risk', hint: 'paid for, unused' }
                ],
                chart: { type: 'bar', title: 'Module usage across the book', data: adoption.modules.map((m) => ({ name: m.product, value: m.avgUsage })) }
            },
            {
                key: 'ebrs', title: 'Executive Reviews', color: '#8b5cf6', route: '/ebrs',
                kpis: [
                    { label: 'Generated', value: ebrCoverage.generated, hint: `of ${ebrCoverage.customers} customers` },
                    { label: 'Shared', value: ebrCoverage.shared, tone: 'good', hint: ebrCoverage.quarterLabel },
                    { label: 'Awaiting share', value: ebrCoverage.pendingShare, tone: 'watch' },
                    { label: 'Not started', value: ebrCoverage.notStarted, tone: ebrCoverage.notStarted ? 'risk' : 'good' }
                ],
                chart: { type: 'donut', title: 'EBR status this quarter', data: toPairs(countBy(ebrCoverage.rows, 'status')) }
            },
            {
                key: 'referrals', title: 'Advocacy', color: '#f97316', route: '/referrals',
                kpis: [
                    { label: 'Referrals', value: referralStats.total, hint: `${referralStats.open} open` },
                    { label: 'Converted', value: referralStats.converted, tone: 'good', hint: `${referralStats.conversionRate ?? 0}% conversion` },
                    { label: 'Referred pipeline', value: money(referralStats.referredValueInr), format: 'inr' },
                    { label: 'Rewards owed', value: referralStats.rewardsOwed, tone: 'watch' }
                ],
                chart: { type: 'bar', title: 'Referrals by status', data: toPairs(referralStats.byStatus || {}) }
            },
            {
                key: 'comms', title: 'Communications', color: '#06b6d4', route: '/comms',
                kpis: [
                    { label: 'Campaigns sent', value: commsStats.sent, hint: `${commsStats.totalRecipients} recipients` },
                    { label: 'Avg open rate', value: commsStats.avgOpenRate ?? 0, format: 'pct', tone: 'good' },
                    { label: 'Avg click rate', value: commsStats.avgClickRate ?? 0, format: 'pct' },
                    { label: 'Scheduled', value: commsStats.scheduled, hint: `${commsStats.drafts} drafts` }
                ],
                chart: { type: 'donut', title: 'Campaigns by channel', data: toPairs(commsStats.byType || {}) }
            },
            {
                key: 'events', title: 'Events', color: '#ec4899', route: '/events',
                kpis: [
                    { label: 'Events', value: eventStats.events, hint: `${eventStats.upcoming} upcoming` },
                    { label: 'Registrations', value: eventStats.totalRegistered },
                    { label: 'Avg attendance', value: eventStats.avgAttendanceRate ?? 0, format: 'pct', tone: 'good' },
                    { label: 'Completed', value: eventStats.completed }
                ],
                chart: { type: 'bar', title: 'Events by type', data: toPairs(eventStats.byType || {}) }
            }
        ];

        // ── KPI / KRI trends, month by month ──────────────────────────────
        // A KPI is something you want to go up, a KRI is an early warning you want
        // to go down — the page colours and reads the delta differently for each,
        // so every module contributes at least one of both wherever it can.
        const myTickets = mine(tickets);
        const npsResponses = mine(responses).filter((r) => r.type === 'NPS');
        const csatResponses = mine(responses).filter((r) => r.type === 'CSAT');
        const myStages = mine(stages);
        const myEnrol = mine(enrollments);
        const hoursBetween = (a, b) => (a && b ? Math.max(0, (new Date(b) - new Date(a)) / 36e5) : null);
        // Average a per-row measure over the rows dated into each month.
        const avgOver = (rows, dateField, measure) => keys.map((k) => {
            const vals = rows.map((r) => (monthOf(r[dateField]) === k ? measure(r) : null)).filter((v) => v !== null && !Number.isNaN(v));
            return vals.length ? Math.round(sum(vals) / vals.length) : 0;
        });
        // Percentage of rows in each month satisfying `hit`.
        const rateOver = (rows, dateField, hit) => keys.map((k) => {
            const inMonth = rows.filter((r) => monthOf(r[dateField]) === k);
            return inMonth.length ? pct(inMonth.filter(hit).length, inMonth.length) : 0;
        });

        const trendDefs = [
            // ── Revenue & contracts ──
            { key: 'arr_added', label: 'ARR added', module: 'Contracts', kind: 'KPI', unit: 'inr', values: series(keys, customerContracts.filter((c) => c.status === 'Active' || c.status === 'Renewing'), 'created_at', cVal) },
            { key: 'arr_lost', label: 'ARR churned or expired', module: 'Contracts', kind: 'KRI', unit: 'inr', values: series(keys, customerContracts.filter((c) => c.status === 'Churned' || c.status === 'Expired'), 'updated_at', cVal) },
            { key: 'contracts_signed', label: 'Contracts signed', module: 'Contracts', kind: 'KPI', unit: 'num', values: series(keys, customerContracts, 'created_at') },

            // ── Expansion ──
            { key: 'expansion_created', label: 'Expansion pipeline added', module: 'Expansion', kind: 'KPI', unit: 'inr', values: series(keys, mine(deals), 'created_at', toInr) },
            { key: 'expansion_won', label: 'Expansion won', module: 'Expansion', kind: 'KPI', unit: 'inr', values: series(keys, mine(deals).filter((d) => d.stage === 'Won'), 'created_at', toInr) },
            { key: 'expansion_lost', label: 'Expansion lost', module: 'Expansion', kind: 'KRI', unit: 'inr', values: series(keys, mine(deals).filter((d) => d.stage === 'Lost'), 'created_at', toInr) },
            { key: 'expansion_winrate', label: 'Expansion win rate', module: 'Expansion', kind: 'KPI', unit: 'pct', values: rateOver(mine(deals).filter((d) => d.stage === 'Won' || d.stage === 'Lost'), 'created_at', (d) => d.stage === 'Won') },

            // ── Support ──
            { key: 'tickets_opened', label: 'Tickets opened', module: 'Support', kind: 'KRI', unit: 'num', values: series(keys, myTickets, 'opened_at') },
            { key: 'tickets_resolved', label: 'Tickets resolved', module: 'Support', kind: 'KPI', unit: 'num', values: series(keys, myTickets.filter((t) => t.resolved_at), 'resolved_at') },
            { key: 'tickets_urgent', label: 'Urgent tickets raised', module: 'Support', kind: 'KRI', unit: 'num', values: series(keys, myTickets.filter((t) => t.priority === 'Urgent'), 'opened_at') },
            { key: 'first_response_hrs', label: 'First response time', module: 'Support', kind: 'KRI', unit: 'hrs', values: avgOver(myTickets.filter((t) => t.first_response_at), 'opened_at', (t) => hoursBetween(t.opened_at, t.first_response_at)) },
            { key: 'resolution_hrs', label: 'Resolution time', module: 'Support', kind: 'KRI', unit: 'hrs', values: avgOver(myTickets.filter((t) => t.resolved_at), 'opened_at', (t) => hoursBetween(t.opened_at, t.resolved_at)) },
            { key: 'ticket_backlog', label: 'Unresolved at month end', module: 'Support', kind: 'KRI', unit: 'num', values: series(keys, myTickets.filter((t) => !t.resolved_at), 'opened_at') },

            // ── Voice of customer ──
            { key: 'nps_trend', label: 'NPS', module: 'Surveys', kind: 'KPI', unit: 'score', values: keys.map((k) => { const r = npsResponses.filter((x) => monthOf(x.created_at) === k); return r.length ? Math.round(((r.filter((x) => x.score >= 9).length - r.filter((x) => x.score <= 6).length) / r.length) * 100) : 0; }) },
            { key: 'csat_trend', label: 'CSAT (avg score)', module: 'Surveys', kind: 'KPI', unit: 'score', values: avgOver(csatResponses, 'created_at', (r) => r.score) },
            { key: 'survey_responses', label: 'Survey responses', module: 'Surveys', kind: 'KPI', unit: 'num', values: series(keys, mine(responses), 'created_at') },
            { key: 'detractors', label: 'Detractors', module: 'Surveys', kind: 'KRI', unit: 'num', values: series(keys, npsResponses.filter((r) => r.score <= 6), 'created_at') },
            { key: 'negative_sentiment', label: 'Negative sentiment responses', module: 'Surveys', kind: 'KRI', unit: 'num', values: series(keys, mine(responses).filter((r) => r.sentiment === 'Negative'), 'created_at') },

            // ── Customer health ──
            { key: 'health_calls', label: 'Health checks held', module: 'Customer Health', kind: 'KPI', unit: 'num', values: series(keys, mine(calls), 'check_date') },
            { key: 'health_red', label: 'Red health signals', module: 'Customer Health', kind: 'KRI', unit: 'num', values: series(keys, mine(calls).filter((c) => c.signal === 'Red'), 'check_date') },
            { key: 'health_green_rate', label: 'Calls closing green', module: 'Customer Health', kind: 'KPI', unit: 'pct', values: rateOver(mine(calls), 'check_date', (c) => c.signal === 'Green') },
            { key: 'actions_closed', label: 'Actionables closed', module: 'Customer Health', kind: 'KPI', unit: 'num', values: series(keys, mine(actionables).filter((a) => a.status === 'Done' || a.status === 'Closed'), 'updated_at') },
            { key: 'actions_carried', label: 'Actionables carried forward', module: 'Customer Health', kind: 'KRI', unit: 'num', values: series(keys, mine(actionables).filter((a) => a.carried_from), 'created_at') },

            // ── Onboarding ──
            { key: 'onboarding_started', label: 'Onboardings kicked off', module: 'Onboarding', kind: 'KPI', unit: 'num', values: series(keys, mine(onboardings), 'kickoff_date') },
            { key: 'onboarding_live', label: 'Onboardings gone live', module: 'Onboarding', kind: 'KPI', unit: 'num', values: series(keys, mine(onboardings).filter((o) => o.completed_at), 'completed_at') },
            { key: 'onboarding_days', label: 'Days to go live', module: 'Onboarding', kind: 'KRI', unit: 'days', values: avgOver(mine(onboardings).filter((o) => o.completed_at && o.kickoff_date), 'completed_at', (o) => hoursBetween(o.kickoff_date, o.completed_at) / 24) },
            { key: 'stages_overdue', label: 'Stages finished late', module: 'Onboarding', kind: 'KRI', unit: 'num', values: series(keys, myStages.filter((s) => s.completed_at && s.due_date && s.completed_at > s.due_date), 'completed_at') },

            // ── Training ──
            { key: 'training_enrolled', label: 'Learners enrolled', module: 'Training', kind: 'KPI', unit: 'num', values: series(keys, mine(sessions), 'session_date', (s) => s.enrolled) },
            { key: 'training_completed', label: 'Learners completed', module: 'Training', kind: 'KPI', unit: 'num', values: series(keys, mine(sessions), 'session_date', (s) => s.completed) },
            { key: 'training_completion_rate', label: 'Completion rate', module: 'Training', kind: 'KPI', unit: 'pct', values: keys.map((k) => { const r = mine(sessions).filter((s) => monthOf(s.session_date) === k); return pct(sum(r.map((s) => s.completed)), sum(r.map((s) => s.enrolled))); }) },
            { key: 'training_dropoff', label: 'Enrolled but not completed', module: 'Training', kind: 'KRI', unit: 'num', values: series(keys, mine(sessions), 'session_date', (s) => Math.max(0, (s.enrolled || 0) - (s.completed || 0))) },
            { key: 'training_certified', label: 'Learners certified', module: 'Training', kind: 'KPI', unit: 'num', values: series(keys, myEnrol.filter((e) => e.certified_at), 'certified_at') },

            // ── Lifecycle & reviews ──
            { key: 'ebrs_shared', label: 'EBRs shared', module: 'Executive Reviews', kind: 'KPI', unit: 'num', values: series(keys, mine(ebrRows).filter((e) => e.shared_at), 'shared_at') },
            { key: 'ebrs_unshared', label: 'EBRs generated but unshared', module: 'Executive Reviews', kind: 'KRI', unit: 'num', values: series(keys, mine(ebrRows).filter((e) => e.generated_at && !e.shared_at), 'generated_at') },

            // ── Advocacy ──
            { key: 'referrals_new', label: 'Referrals received', module: 'Advocacy', kind: 'KPI', unit: 'num', values: series(keys, mine(refs), 'created_at') },
            { key: 'referrals_converted', label: 'Referrals converted', module: 'Advocacy', kind: 'KPI', unit: 'num', values: series(keys, mine(refs).filter((r) => r.status === 'Converted'), 'created_at') },
            { key: 'referrals_lost', label: 'Referrals lost', module: 'Advocacy', kind: 'KRI', unit: 'num', values: series(keys, mine(refs).filter((r) => r.status === 'Lost' || r.status === 'Rejected'), 'created_at') },
            { key: 'nudges_sent', label: 'Referral nudges made', module: 'Advocacy', kind: 'KPI', unit: 'num', values: series(keys, mine(nudges), 'nudged_at') },
            { key: 'nudges_declined', label: 'Nudges declined', module: 'Advocacy', kind: 'KRI', unit: 'num', values: series(keys, mine(nudges).filter((n) => n.outcome === 'Declined'), 'nudged_at') },

            // ── Product demand ──
            { key: 'features_raised', label: 'Feature requests raised', module: 'Product Demand', kind: 'KPI', unit: 'num', values: series(keys, mine(feats), 'created_at') },
            { key: 'features_untriaged', label: 'Requests still untriaged', module: 'Product Demand', kind: 'KRI', unit: 'num', values: series(keys, mine(feats).filter((f) => f.status === 'Requested'), 'created_at') },
            { key: 'features_shipped', label: 'Requests shipped', module: 'Product Demand', kind: 'KPI', unit: 'num', values: series(keys, mine(feats).filter((f) => f.status === 'Shipped' || f.status === 'Released'), 'updated_at') },
            { key: 'features_declined', label: 'Requests declined', module: 'Product Demand', kind: 'KRI', unit: 'num', values: series(keys, mine(feats).filter((f) => f.status === 'Declined'), 'updated_at') },

            // ── Engagement ──
            { key: 'event_registrations', label: 'Event registrations', module: 'Events', kind: 'KPI', unit: 'num', values: series(keys, mine(evts), 'starts_at', (e) => e.registered) },
            { key: 'event_attendance', label: 'Event attendance', module: 'Events', kind: 'KPI', unit: 'num', values: series(keys, mine(evts), 'starts_at', (e) => e.attended) },
            { key: 'event_noshow', label: 'Event no-show rate', module: 'Events', kind: 'KRI', unit: 'pct', values: keys.map((k) => { const r = mine(evts).filter((e) => monthOf(e.starts_at) === k); return pct(sum(r.map((e) => Math.max(0, (e.registered || 0) - (e.attended || 0)))), sum(r.map((e) => e.registered))); }) },
            { key: 'comms_open_rate', label: 'Comms open rate', module: 'Communications', kind: 'KPI', unit: 'pct', values: seriesAvg(keys, mine(comms).filter((c) => c.sent_at && c.recipients), 'sent_at', (c) => pct(c.opens, c.recipients)) },
            { key: 'comms_click_rate', label: 'Comms click rate', module: 'Communications', kind: 'KPI', unit: 'pct', values: seriesAvg(keys, mine(comms).filter((c) => c.sent_at && c.recipients), 'sent_at', (c) => pct(c.clicks, c.recipients)) },
            { key: 'comms_sent', label: 'Campaigns sent', module: 'Communications', kind: 'KPI', unit: 'num', values: series(keys, mine(comms).filter((c) => c.sent_at), 'sent_at') }
        ];

        // A series that is flat zero across every month is noise in the dropdown, so
        // only the ones with movement are plottable. The full catalogue still ships —
        // it is what the module tracks, whether or not this book has data for it yet.
        const plottable = trendDefs.filter((t) => sum(t.values) > 0);

        const trends = {
            months,
            forecastMonths: (() => {
                const d = new Date(); d.setDate(1);
                return Array.from({ length: 3 }, (_, i) => label(`${new Date(d.getFullYear(), d.getMonth() + i + 1, 1).getFullYear()}-${String(new Date(d.getFullYear(), d.getMonth() + i + 1, 1).getMonth() + 1).padStart(2, '0')}`));
            })(),
            catalogue: trendDefs.map((t) => ({
                key: t.key, label: t.label, module: t.module, kind: t.kind, unit: t.unit,
                hasData: sum(t.values) > 0
            })),
            metrics: plottable.map((t) => ({
                key: t.key, label: t.label, module: t.module, kind: t.kind, unit: t.unit,
                values: t.values,
                forecast: project(t.values, 3),
                latest: t.values[t.values.length - 1],
                delta: t.values.length > 1 ? t.values[t.values.length - 1] - t.values[t.values.length - 2] : 0
            }))
        };

        // ── churn-risk board ──────────────────────────────────────────────
        // Every customer scored by the transparent weighted-signal model, so the
        // page can show *why* an account is exposed and not just that it is.
        const healthByAccount = Object.fromEntries(accountHealth.map((h) => [h.account, h]));
        const adoptionByAccount = Object.fromEntries((adoption.accounts || []).map((a) => [a.account, a]));
        const ticketsByAccount = {};
        for (const t of mine(tickets)) {
            const row = (ticketsByAccount[t.account] ||= { open: 0, breached: 0 });
            if (t.status !== 'Resolved' && t.status !== 'Closed') row.open += 1;
        }
        // `breached` is derived from the SLA matrix during list decoration, not a
        // column, so it has to come back through the repo rather than the raw rows.
        for (const b of await supportRepo.list(user, { breached: true })) {
            (ticketsByAccount[b.account] ||= { open: 0, breached: 0 }).breached += 1;
        }
        const respByAccount = {};
        for (const r of mine(responses)) {
            const row = (respByAccount[r.account] ||= { responses: 0, detractors: 0 });
            row.responses += 1;
            if (r.sentiment === 'Negative') row.detractors += 1;
        }
        const renewalByAccount = {};
        for (const c of customerContracts) {
            if (c.days_to_renewal === null || c.days_to_renewal === undefined || c.days_to_renewal < 0) continue;
            const cur = renewalByAccount[c.account];
            if (cur === undefined || c.days_to_renewal < cur) renewalByAccount[c.account] = c.days_to_renewal;
        }

        const riskBoard = customers.map((a) => {
            const hc = healthByAccount[a.name] || {};
            const ad = adoptionByAccount[a.name] || {};
            const tk = ticketsByAccount[a.name] || { open: 0, breached: 0 };
            const sv = respByAccount[a.name] || { responses: 0, detractors: 0 };
            const scored = scoreCustomer({
                health: a.health,
                signal: hc.currentSignal || 'Unknown',
                adoption: ad.overallUsage ?? null,
                openTickets: tk.open,
                breachedTickets: tk.breached,
                detractors: sv.detractors,
                responses: sv.responses,
                overdueCheck: !!hc.overdue,
                daysToRenewal: renewalByAccount[a.name] ?? null,
                arrInr: sum(activeContracts.filter((c) => c.account === a.name).map(cVal))
            });
            return {
                account: a.name,
                csm: csmOf(a),
                tier: a.tier,
                region: a.region,
                health: a.health,
                adoption: ad.overallUsage ?? null,
                daysToRenewal: renewalByAccount[a.name] ?? null,
                ...scored
            };
        }).sort((x, y) => y.score - x.score || y.arrInr - x.arrInr);

        const risk = {
            board: riskBoard,
            weights: RISK_WEIGHT_TABLE,
            exposedArrInr: money(sum(riskBoard.filter((r) => r.score >= 50).map((r) => r.arrInr))),
            counts: riskBoard.reduce((m, r) => { m[r.band] = (m[r.band] || 0) + 1; return m; }, {}),
            // Which factor drives the most risk across the whole book — that is the
            // systemic problem, as opposed to any one unhappy account.
            topDrivers: Object.values(riskBoard.reduce((m, r) => {
                for (const f of r.factors) {
                    const e = (m[f.key] ||= { key: f.key, label: f.label, points: 0, accounts: 0 });
                    e.points += f.points; e.accounts += 1;
                }
                return m;
            }, {})).sort((a, b) => b.points - a.points).slice(0, 4)
        };

        // ── anomaly signals ───────────────────────────────────────────────
        // What actually moved this month, judged against each series' own history
        // rather than a fixed threshold, so a naturally spiky metric has to move
        // further before it earns a place on the page.
        const signals = plottable
            .map((t) => {
                const a = detectAnomaly(t.values, { kind: t.kind });
                return a ? { key: t.key, label: t.label, module: t.module, kind: t.kind, unit: t.unit, ...a } : null;
            })
            .filter(Boolean)
            .sort((a, b) => (a.good === b.good ? Math.abs(b.z) - Math.abs(a.z) : a.good ? 1 : -1));

        // ── NEO briefing ──────────────────────────────────────────────────
        // Written from the numbers just computed, so every sentence is checkable
        // against a figure elsewhere on the page. Nothing here is invented.
        const seriesFor = (key) => plottable.find((t) => t.key === key)?.values || null;
        const worstSignal = signals.find((s) => !s.good);
        const bestSignal = signals.find((s) => s.good);
        const topRisk = riskBoard[0];
        const heaviestCsm = byCsm[0];
        const briefing = {
            headline: nrr === null ? `${customers.length} customers under management.`
                : nrr >= 100
                    ? `Net revenue retention is holding at ${nrr}% — the book is growing without new logos.`
                    : `Net revenue retention has slipped to ${nrr}% — the base is shrinking faster than expansion replaces it.`,
            points: [
                topRisk && topRisk.score >= 30
                    ? `${topRisk.account} carries the highest churn risk at ${topRisk.score}/100, driven by ${topRisk.topFactor.toLowerCase()}. ${inr(topRisk.arrInr)} of ARR sits behind it.`
                    : 'No customer is scoring above moderate churn risk right now.',
                worstSignal
                    ? `${worstSignal.label} moved ${worstSignal.direction} to ${worstSignal.latest} against a ${worstSignal.baseline} baseline — ${Math.abs(worstSignal.z)}σ out, and worth a look before it becomes a trend.`
                    : 'Nothing in the trend set broke from its own baseline this month.',
                risk.topDrivers[0]
                    ? `Across the book, ${risk.topDrivers[0].label.toLowerCase()} contributes the most risk — it shows up on ${risk.topDrivers[0].accounts} of ${customers.length} customers.`
                    : 'Risk is evenly spread with no single systemic driver.',
                renewals90.length
                    ? `${renewals90.length} contract(s) worth ${inr(atRiskValue)} reach their renewal inside 90 days.`
                    : 'No renewals fall inside the next 90 days.',
                heaviestCsm
                    ? `${heaviestCsm.name} carries the largest book at ${inr(heaviestCsm.arr)} across ${heaviestCsm.value} customer(s).`
                    : null,
                bestSignal ? `On the upside, ${bestSignal.label.toLowerCase()} is running ${Math.abs(bestSignal.z)}σ better than its baseline.` : null
            ].filter(Boolean),
            // What the reader should know about how this was produced.
            basis: `Computed from ${plottable.length} live metric series across ${new Set(plottable.map((t) => t.module)).size} modules and ${customers.length} customer records.`
        };

        // Six-month spark series behind the headline figures, so a tile shows the
        // shape of the number and not only its latest value.
        const sparks = {
            arr: seriesFor('arr_added'),
            expansion: seriesFor('expansion_won'),
            nps: seriesFor('nps_trend'),
            tickets: seriesFor('tickets_opened'),
            adoption: seriesFor('training_completion_rate'),
            risk: seriesFor('health_red')
        };

        // ── forward look ──────────────────────────────────────────────────
        const forecast = {
            arrInr: money(arr),
            renewalValue90: money(atRiskValue),
            renewalCount90: renewals90.length,
            expansionWeighted: money(expansionStats.weightedForecastInr),
            projectedArr: money(arr + expansionStats.weightedForecastInr - atRiskValue * 0.15),
            churnRiskInr: money(sum(contracts.filter((c) => customers.find((a) => a.name === c.account && (a.health === 'Poor' || a.health === 'Critical'))).map(cVal))),
            pipelineWeighted: money(weightedPipeline),
            notes: [
                `${renewals90.length} contract(s) worth ${inr(atRiskValue)} renew inside 90 days.`,
                `${expansionStats.open} expansion deal(s) weighted at ${inr(expansionStats.weightedForecastInr)}.`,
                `${healthStats.red} customer(s) are red — the biggest single threat to the renewal base.`
            ]
        };

        // ── the next actions, by team ─────────────────────────────────────
        const actions = [];
        const act = (team, priority, title, detail, count, route) => actions.push({ team, priority, title, detail, count, route });
        // Sales
        if (renewals90.length) act('Sales', 'high', `Work ${renewals90.length} renewal(s) closing in 90 days`, `${inr(atRiskValue)} of contract value in the window`, renewals90.length, '/clm');
        const weakProspects = prospects.filter((p) => (p.meddicc_score ?? 0) < 3);
        if (weakProspects.length) act('Sales', 'medium', `Qualify ${weakProspects.length} under-qualified deal(s)`, 'MEDDICC below 3/7 — close the gaps before advancing', weakProspects.length, '/cash-horizon');
        if (expansionStats.open) act('Sales', 'high', `Chase ${expansionStats.open} expansion deal(s)`, `${inr(expansionStats.weightedForecastInr)} weighted — late-stage first`, expansionStats.open, '/upsells');
        // Customer Success
        if (healthStats.red) act('Customer Success', 'critical', `Build save plans for ${healthStats.red} red account(s)`, 'Red health is the leading churn indicator', healthStats.red, '/health-checks');
        if (healthStats.overdue) act('Customer Success', 'high', `Run ${healthStats.overdue} overdue health check(s)`, 'Past their support-tier cadence', healthStats.overdue, '/health-checks');
        if (ebrCoverage.notStarted) act('Customer Success', 'medium', `Generate ${ebrCoverage.notStarted} EBR(s) for ${ebrCoverage.quarterLabel}`, 'Every customer gets a quarterly review', ebrCoverage.notStarted, '/ebrs');
        if (surveyStats.detractors) act('Customer Success', 'high', `Close the loop with ${surveyStats.detractors} detractor(s)`, 'A fast answer to a bad score is a save', surveyStats.detractors, '/surveys');
        if (journeyStats.stalled) act('Customer Success', 'medium', `Re-engage ${journeyStats.stalled} stalled customer(s)`, 'Too long in their lifecycle stage', journeyStats.stalled, '/journey');
        if (onboardingStats.atRisk) act('Customer Success', 'high', `Unblock ${onboardingStats.atRisk} at-risk onboarding(s)`, 'A stage is past its due date', onboardingStats.atRisk, '/onboarding');
        // Trainers
        if (adoption.summary.dormantModules) act('Trainers', 'high', `Run enablement on ${adoption.summary.dormantModules} dormant module(s)`, 'Subscribed but barely used — training lifts adoption', adoption.summary.dormantModules, '/journey');
        if (trainingStats.stalled) act('Trainers', 'medium', `Restart ${trainingStats.stalled} stalled training session(s)`, 'Enrolled learners with no completions', trainingStats.stalled, '/training');
        if (trainingStats.underEnabledAccounts?.length) act('Trainers', 'high', `Lift ${trainingStats.underEnabledAccounts.length} under-enabled account(s)`, 'Under 50% completion — drives support load', trainingStats.underEnabledAccounts.length, '/training');
        // Support
        if (supportStats.breached) act('Support', 'critical', `Review ${supportStats.breached} SLA breach(es)`, 'Root-cause them before the next QBR', supportStats.breached, '/support');
        if (supportStats.atRisk) act('Support', 'high', `Grab ${supportStats.atRisk} at-risk ticket(s)`, 'SLA clock still running', supportStats.atRisk, '/support');
        // Product
        const triage = (featureStats.byStatus?.Requested || 0) + (featureStats.byStatus?.['Under review'] || 0);
        if (triage) act('Product', 'medium', `Triage ${triage} feature request(s)`, 'Rank by RICE so build follows demand', triage, '/feature-requests');
        // Marketing
        if (referralStats.total !== undefined) {
            const nudge = await referralRepo.nudgeBoard(user);
            if (nudge.neverNudged) act('Marketing', 'medium', `Ask ${nudge.neverNudged} customer(s) for a referral`, 'Never nudged — the cheapest pipeline you have', nudge.neverNudged, '/referrals');
        }
        if (commsStats.scheduled) act('Marketing', 'low', `Ship ${commsStats.scheduled} scheduled comm(s)`, 'Queued and waiting', commsStats.scheduled, '/comms');
        if (eventStats.upcoming) act('Marketing', 'medium', `Fill ${eventStats.upcoming} upcoming event(s)`, 'Drive registrations before the date', eventStats.upcoming, '/events');

        const rank = { critical: 0, high: 1, medium: 2, low: 3 };
        actions.sort((a, b) => rank[a.priority] - rank[b.priority]);

        return {
            headline: {
                arrInr: money(arr),                                  // customers only
                arpaInr: money(arpa),
                customers: customers.length,
                accounts: accounts.length,
                nrr: nrr,
                grr: grr,
                lostArrInr: money(lostArr),
                expansionWonInr: money(expansionWonInr),
                atRiskCustomers: atRiskCustomers.length,
                atRiskArrInr: money(atRiskArr),
                pipelineInr: money(pipelineInr),
                weightedPipelineInr: money(weightedPipeline),
                nps: surveyStats.nps ?? null,
                csat: surveyStats.csat ?? null,
                detractors: surveyStats.detractors ?? null,
                responseRate: surveyStats.responseRate ?? null,
                healthRed: healthStats.red,
                healthGreen: healthStats.green,
                slaAttainment: supportStats.slaAttainment,
                openTickets: supportStats.open,
                avgAdoption: adoption.summary.avgUsage ?? null,
                dormantModules: adoption.summary.dormantModules ?? null,
                activeUsers: adoption.summary.activeUsers ?? null,
                totalUsers: adoption.summary.totalUsers ?? null,
                topModule: adoption.summary.mostUsed?.product ?? null,
                renewalsDue90: renewals90.length,
                atRiskValueInr: money(atRiskValue),
                expansionWeightedInr: money(expansionStats.weightedForecastInr),
                csmCount: coverage.csmCount,
                regionsCovered: coverage.regionsCovered,
                industriesCovered: coverage.industriesCovered
            },
            briefing,
            sparks,
            signals,
            risk,
            coverage,
            modules,
            trends,
            forecast,
            actions
        };
    }
};
