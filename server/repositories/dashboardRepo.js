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
            journeyStats, adoption, ebrCoverage, invoiceStats] = await Promise.all([
                supportRepo.stats(user), trainingRepo.stats(user), onboardingRepo.stats(user),
                healthRepo.stats(user), surveyRepo.stats(user), featureRepo.stats(user),
                expansionRepo.stats(user), referralRepo.stats(user), commsRepo.stats(user),
                eventRepo.stats(user), journeyRepo.stats(user), journeyRepo.adoption(user),
                ebrRepo.coverage(user), scopeRepo.invoiceStats(user, {}, fx)
            ]);

        // dated rows for the trend series
        const [tickets, responses, campaigns, calls, deals, refs, feats, evts, comms, sessions] = await Promise.all([
            db.all('SELECT account, opened_at, resolved_at, status, priority FROM support_tickets'),
            db.all('SELECT r.account, r.created_at, r.score, r.sentiment, c.type FROM survey_responses r LEFT JOIN survey_campaigns c ON c.id = r.campaign_id'),
            db.all('SELECT account, sent_at, opens, clicks, recipients FROM comms_campaigns'),
            db.all('SELECT account, check_date, signal FROM health_calls'),
            db.all('SELECT account, created_at, stage, value_amount, currency FROM expansions'),
            db.all('SELECT account, created_at, status, value_amount, currency FROM referral_leads'),
            db.all('SELECT account, created_at, status FROM feature_reqs'),
            db.all('SELECT account, starts_at, registered, attended, status FROM cx_events'),
            db.all('SELECT account, sent_at, opens, recipients FROM comms_campaigns'),
            db.all('SELECT account, session_date, enrolled, completed FROM training_sessions')
        ]);
        const toInr = (r) => ((r.currency === 'USD' ? (r.value_amount || 0) * fx : (r.value_amount || 0)) || 0);

        // ── portfolio headline ────────────────────────────────────────────
        const cVal = (c) => (c.currency === 'INR' ? c.arr : (c.arr || 0) * fx) || 0;
        const activeContracts = contracts.filter((c) => c.status === 'Active' || c.status === 'Renewing');
        const arr = sum(activeContracts.map(cVal));
        const renewals90 = contracts.filter((c) => c.days_to_renewal !== null && c.days_to_renewal >= 0 && c.days_to_renewal <= 90);
        const atRiskValue = sum(renewals90.map(cVal));
        const pipelineInr = sum(prospects.map((a) => (a.value_currency === 'INR' ? a.value_amount : (a.value_amount || 0) * fx) || 0));
        const weightedPipeline = sum(prospects.map((a) => (((a.value_currency === 'INR' ? a.value_amount : (a.value_amount || 0) * fx) || 0) * (a.probability || 0)) / 100));

        // ── coverage ──────────────────────────────────────────────────────
        const coverage = {
            byRegion: toPairs(countBy(accounts, 'region')),
            byRegionValue: toPairs(sumBy(customers, 'region', (a) => (a.value_currency === 'INR' ? a.value_amount : (a.value_amount || 0) * fx) || 0)),
            byIndustry: toPairs(countBy(customers, (a) => a.industry || 'Unspecified')).slice(0, 8),
            byTier: toPairs(countBy(customers, 'tier')),
            bySegment: toPairs(countBy(accounts, 'segment')),
            byHealth: toPairs(countBy(customers, 'health')),
            regionsCovered: new Set(accounts.map((a) => a.region).filter(Boolean)).size,
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
                    { label: 'At-risk accounts', value: customers.filter((a) => a.health === 'Poor' || a.health === 'Critical').length, tone: 'risk', hint: 'Poor / Critical health' }
                ],
                chart: { type: 'donut', title: 'Accounts by segment', data: coverage.bySegment }
            },
            {
                key: 'contracts', title: 'Contracts (CLM)', color: '#a855f7', route: '/clm',
                kpis: [
                    { label: 'ARR under management', value: money(arr), format: 'inr', hint: `${activeContracts.length} active contracts` },
                    { label: 'Renewals ≤ 90d', value: renewals90.length, tone: renewals90.length ? 'watch' : 'good', hint: 'due this quarter' },
                    { label: 'Revenue at risk', value: money(atRiskValue), format: 'inr', tone: 'risk', hint: 'inside the renewal window' },
                    { label: 'Collected', value: money(invoiceStats.collected), format: 'inr', hint: `${money(invoiceStats.outstanding)} outstanding` }
                ],
                chart: { type: 'bar', title: 'Contracts by status', data: toPairs(countBy(contracts, 'status')) }
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
        const openTickets = mine(tickets);
        const npsResponses = mine(responses).filter((r) => r.type === 'NPS');
        const trendDefs = [
            { key: 'tickets_opened', label: 'Support tickets opened', module: 'Support', kind: 'KRI', unit: 'num', values: series(keys, openTickets, 'opened_at') },
            { key: 'tickets_resolved', label: 'Tickets resolved', module: 'Support', kind: 'KPI', unit: 'num', values: series(keys, openTickets.filter((t) => t.resolved_at), 'resolved_at') },
            { key: 'nps_trend', label: 'NPS (monthly)', module: 'Surveys', kind: 'KPI', unit: 'score', values: keys.map((k) => { const r = npsResponses.filter((x) => monthOf(x.created_at) === k); return r.length ? Math.round(((r.filter((x) => x.score >= 9).length - r.filter((x) => x.score <= 6).length) / r.length) * 100) : 0; }) },
            { key: 'survey_responses', label: 'Survey responses', module: 'Surveys', kind: 'KPI', unit: 'num', values: series(keys, mine(responses), 'created_at') },
            { key: 'health_calls', label: 'Health checks held', module: 'Customer Health', kind: 'KPI', unit: 'num', values: series(keys, mine(calls), 'check_date') },
            { key: 'health_red', label: 'Red health signals', module: 'Customer Health', kind: 'KRI', unit: 'num', values: series(keys, mine(calls).filter((c) => c.signal === 'Red'), 'check_date') },
            { key: 'expansion_created', label: 'Expansion pipeline added', module: 'Expansion', kind: 'KPI', unit: 'inr', values: series(keys, mine(deals), 'created_at', toInr) },
            { key: 'expansion_won', label: 'Expansion won', module: 'Expansion', kind: 'KPI', unit: 'inr', values: series(keys, mine(deals).filter((d) => d.stage === 'Won'), 'created_at', toInr) },
            { key: 'referrals_new', label: 'Referrals received', module: 'Advocacy', kind: 'KPI', unit: 'num', values: series(keys, mine(refs), 'created_at') },
            { key: 'referrals_converted', label: 'Referrals converted', module: 'Advocacy', kind: 'KPI', unit: 'num', values: series(keys, mine(refs).filter((r) => r.status === 'Converted'), 'created_at') },
            { key: 'features_raised', label: 'Feature requests raised', module: 'Product Demand', kind: 'KPI', unit: 'num', values: series(keys, mine(feats), 'created_at') },
            { key: 'event_registrations', label: 'Event registrations', module: 'Events', kind: 'KPI', unit: 'num', values: series(keys, mine(evts), 'starts_at', (e) => e.registered) },
            { key: 'event_attendance', label: 'Event attendance', module: 'Events', kind: 'KPI', unit: 'num', values: series(keys, mine(evts), 'starts_at', (e) => e.attended) },
            { key: 'comms_open_rate', label: 'Comms open rate', module: 'Communications', kind: 'KPI', unit: 'pct', values: seriesAvg(keys, mine(comms).filter((c) => c.sent_at && c.recipients), 'sent_at', (c) => pct(c.opens, c.recipients)) },
            { key: 'training_enrolled', label: 'Learners enrolled', module: 'Training', kind: 'KPI', unit: 'num', values: series(keys, mine(sessions), 'session_date', (s) => s.enrolled) },
            { key: 'training_completed', label: 'Learners completed', module: 'Training', kind: 'KPI', unit: 'num', values: series(keys, mine(sessions), 'session_date', (s) => s.completed) }
        ].filter((t) => sum(t.values) > 0);

        const trends = {
            months,
            forecastMonths: (() => {
                const d = new Date(); d.setDate(1);
                return Array.from({ length: 3 }, (_, i) => label(`${new Date(d.getFullYear(), d.getMonth() + i + 1, 1).getFullYear()}-${String(new Date(d.getFullYear(), d.getMonth() + i + 1, 1).getMonth() + 1).padStart(2, '0')}`));
            })(),
            metrics: trendDefs.map((t) => ({
                key: t.key, label: t.label, module: t.module, kind: t.kind, unit: t.unit,
                values: t.values,
                forecast: project(t.values, 3),
                latest: t.values[t.values.length - 1],
                delta: t.values.length > 1 ? t.values[t.values.length - 1] - t.values[t.values.length - 2] : 0
            }))
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
                arrInr: money(arr),
                customers: customers.length,
                accounts: accounts.length,
                pipelineInr: money(pipelineInr),
                weightedPipelineInr: money(weightedPipeline),
                nps: surveyStats.nps ?? null,
                healthRed: healthStats.red,
                healthGreen: healthStats.green,
                slaAttainment: supportStats.slaAttainment,
                openTickets: supportStats.open,
                avgAdoption: adoption.summary.avgUsage ?? null,
                renewalsDue90: renewals90.length,
                atRiskValueInr: money(atRiskValue),
                expansionWeightedInr: money(expansionStats.weightedForecastInr),
                regionsCovered: coverage.regionsCovered,
                industriesCovered: coverage.industriesCovered
            },
            coverage,
            modules,
            trends,
            forecast,
            actions
        };
    }
};
