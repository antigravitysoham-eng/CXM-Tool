import { accountRepo } from './accountRepo.js';
import { contractRepo } from './contractRepo.js';
import { healthRepo } from './healthRepo.js';
import { onboardingRepo } from './onboardingRepo.js';
import { supportRepo } from './supportRepo.js';
import { trainingRepo } from './trainingRepo.js';
import { ebrRepo } from './ebrRepo.js';
import { surveyRepo } from './surveyRepo.js';
import { journeyRepo } from './journeyRepo.js';
import { getDb } from '../db.js';
import { config } from '../config.js';
import { proratedAmount } from '../services/revenueService.js';

/**
 * People-performance scorecards — CSM, Account Manager and Partner.
 *
 * These roll the whole book up by the person responsible, so they only make
 * sense for someone who can see the whole book: the routes are admin-only, and
 * because every repo scopes to the caller's accessible accounts, an admin caller
 * naturally aggregates across all accounts (a rep would only see their own).
 *
 * Attribution: CSM = customers.cxm, Account Manager = customers.sales_owner,
 * Partner = the Partner-segment account + who it sourced (sourcing_partner_id).
 * Every module record carries an `account` name, joined back to that account.
 */

const TERMINAL = new Set(['Expired', 'Churned', 'Cancelled', 'Terminated']);
const SIGNAL_SCORE = { Green: 100, Amber: 55, Red: 15, Unknown: 70 };

const round = (n) => Math.round(n);
const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
const daysBetween = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000));
// Average of the defined numbers only, rounded — or null when there's nothing.
const avgDefined = (arr) => { const v = arr.filter((n) => n != null && !Number.isNaN(n)); return v.length ? round(avg(v)) : null; };

// Load every module once and index by account name, so the three scorecards can
// be built from plain in-memory grouping.
async function gather(user, period = {}) {
    const fx = config.fxUsdInr || 83;
    const toInr = (amount, currency) => ((currency === 'INR' ? amount : amount * fx) || 0);
    // Recognised (time-apportioned) INR value of an engaged account for the range.
    // Falls back to full value when no range/start (see revenueService).
    const recogInr = (a) => toInr(proratedAmount(a.value_amount, a, period), a.value_currency);

    const [accounts, contracts, health, onboardings, tickets, training, ebrCoverage, surveys, journeys] = await Promise.all([
        accountRepo.list(user),
        contractRepo.list({}, user),
        healthRepo.accountHealth(user),
        onboardingRepo.list(user),
        supportRepo.list(user),
        trainingRepo.list(user),
        ebrRepo.coverage(user),
        surveyRepo.listCampaigns(user),
        journeyRepo.list(user)
    ]);

    // Per-account contract rollup (value under management vs churned, renewals due).
    const contractByAccount = {};
    for (const c of contracts) {
        const a = (contractByAccount[c.account] ||= { liveInr: 0, churnedInr: 0, churnedCount: 0, renewalDue: false });
        const inr = (c.currency === 'INR' ? c.tcv : c.tcv * fx) || 0;
        // Live value under management is recognised for the range; churned value is
        // reported in full (it's what was lost, not a run-rate slice).
        const liveInr = toInr(proratedAmount(c.tcv, { engagement_start: c.start_date, value_basis: 'Total', term_months: c.term_months }, period), c.currency);
        if (c.status === 'Renewed') { /* prior term — history only, neither live nor churned */ }
        else if (TERMINAL.has(c.status)) { a.churnedInr += inr; a.churnedCount += 1; }
        else { a.liveInr += liveInr; }
        if (c.days_to_renewal !== null && c.days_to_renewal !== undefined && c.days_to_renewal <= 90) a.renewalDue = true;
    }

    const healthByAccount = Object.fromEntries(health.map((h) => [h.account, h]));

    const onboardingByAccount = {};
    for (const o of onboardings) if (!onboardingByAccount[o.account]) onboardingByAccount[o.account] = o;

    const supportByAccount = {};
    for (const t of tickets) {
        const s = (supportByAccount[t.account] ||= { open: 0, breaches: 0, total: 0 });
        s.total += 1;
        if (!t.resolved) s.open += 1;
        if (t.breached) s.breaches += 1;
    }

    const trainingByAccount = {};
    for (const r of training) {
        const t = (trainingByAccount[r.account] ||= { rates: [] });
        if (typeof r.completion_rate === 'number') t.rates.push(r.completion_rate);
    }

    const ebrByAccount = {};
    for (const r of (ebrCoverage.rows || [])) ebrByAccount[r.account] = { generated: r.status !== 'Not started', shared: !!r.shared };

    const surveyByAccount = {};
    for (const c of surveys) {
        const s = (surveyByAccount[c.account] ||= { nps: [], csat: [], detractors: 0 });
        if (c.headline !== null && c.headline !== undefined) {
            if (c.type === 'NPS') s.nps.push(c.headline);
            else if (c.type === 'CSAT') s.csat.push(c.headline);
        }
        s.detractors += c.detractors || 0;
    }

    const journeyByAccount = Object.fromEntries(journeys.map((j) => [j.account, j]));

    // Deal-cycle timing from the account stage trail: first pipeline event → the
    // 'Closed'/'Won' event is the sales cycle; first event → now is the age of an
    // open deal. Keyed by account id.
    const db = await getDb();
    const closedRows = await db.all("SELECT account_id, MIN(entered_at) t FROM account_stage_events WHERE stage IN ('Closed', 'Won') GROUP BY account_id");
    const firstRows = await db.all('SELECT account_id, MIN(entered_at) t FROM account_stage_events GROUP BY account_id');
    const closedAt = Object.fromEntries(closedRows.map((r) => [r.account_id, r.t]));
    const firstAt = Object.fromEntries(firstRows.map((r) => [r.account_id, r.t]));
    const nowIso = new Date().toISOString();
    // Sales cycle (days) for accounts that reached a won stage.
    const closeCycleById = {};
    for (const [id, t] of Object.entries(closedAt)) { if (firstAt[id]) closeCycleById[id] = daysBetween(firstAt[id], t); }
    // Age of a deal still in play (days since it first appeared).
    const dealAge = (a) => { const start = firstAt[a.id] || a.created_at; return start ? daysBetween(start, nowIso) : null; };

    return {
        fx, toInr, recogInr, accounts,
        contractByAccount, healthByAccount, onboardingByAccount,
        supportByAccount, trainingByAccount, ebrByAccount, surveyByAccount, journeyByAccount,
        closeCycleById, dealAge
    };
}

export const performanceRepo = {
    /** One scorecard per CSM (customers.cxm), aggregated across every module. */
    async csmScorecards(user, period = {}) {
        const g = await gather(user, period);
        const customers = g.accounts.filter((a) => a.segment === 'Customer');
        const groups = {};
        for (const a of customers) {
            const key = (a.cxm || '').trim() || 'Unassigned';
            (groups[key] ||= []).push(a);
        }

        const cards = Object.entries(groups).map(([csm, list]) => {
            const names = list.map((a) => a.name);
            const contractAgg = names.map((n) => g.contractByAccount[n]).filter(Boolean);
            const valueInr = contractAgg.reduce((s, c) => s + c.liveInr, 0);
            const churnedValueInr = contractAgg.reduce((s, c) => s + c.churnedInr, 0);
            const churnedAccounts = names.filter((n) => {
                const c = g.contractByAccount[n];
                return c && c.churnedCount > 0 && c.liveInr === 0;
            }).length;
            const renewalsDue = contractAgg.filter((c) => c.renewalDue).length;

            const healthRows = names.map((n) => g.healthByAccount[n]).filter(Boolean);
            const signalAvg = round(avg(healthRows.map((h) => SIGNAL_SCORE[h.currentSignal] ?? 70)));
            const red = healthRows.filter((h) => h.currentSignal === 'Red').length;
            const amber = healthRows.filter((h) => h.currentSignal === 'Amber').length;
            const green = healthRows.filter((h) => h.currentSignal === 'Green').length;
            const overdueChecks = healthRows.filter((h) => h.overdue).length;
            const openActions = healthRows.reduce((s, h) => s + (h.openActions || 0), 0);

            const onbRows = names.map((n) => g.onboardingByAccount[n]).filter(Boolean);
            const inFlight = onbRows.filter((o) => o.status !== 'Live' && o.status !== 'Completed').length;
            const overdueStages = onbRows.reduce((s, o) => s + (o.overdueStages || 0), 0);
            const ttv = onbRows.map((o) => o.timeToValueDays).filter((v) => v !== null && v !== undefined);
            const avgTimeToValue = ttv.length ? round(avg(ttv)) : null;

            const supRows = names.map((n) => g.supportByAccount[n]).filter(Boolean);
            const openTickets = supRows.reduce((s, t) => s + t.open, 0);
            const slaBreaches = supRows.reduce((s, t) => s + t.breaches, 0);

            const trainRates = names.flatMap((n) => g.trainingByAccount[n]?.rates || []);
            const avgCompletion = trainRates.length ? round(avg(trainRates)) : null;

            const ebrRows = names.map((n) => g.ebrByAccount[n]).filter(Boolean);
            const ebrShared = ebrRows.filter((e) => e.shared).length;
            const ebrCoveragePct = list.length ? round((ebrShared / list.length) * 100) : 0;

            const npsVals = names.flatMap((n) => g.surveyByAccount[n]?.nps || []);
            const csatVals = names.flatMap((n) => g.surveyByAccount[n]?.csat || []);
            const detractors = names.reduce((s, n) => s + (g.surveyByAccount[n]?.detractors || 0), 0);

            const atRisk = names.filter((n) => g.journeyByAccount[n]?.stage === 'At Risk').length;
            const avgOnboardDays = avgDefined(onbRows.map((o) => o.timeToOnboardDays));
            const avgDaysInStage = avgDefined(names.map((n) => g.journeyByAccount[n]?.daysInStage));

            return {
                csm,
                accounts: list.length,
                portfolio: { customers: list.length, valueInr, renewalsDue, churnedAccounts, churnedValueInr },
                health: { score: signalAvg, red, amber, green, overdueChecks, openActions },
                onboarding: { inFlight, overdueStages, avgTimeToValue, avgOnboardDays },
                support: { open: openTickets, breaches: slaBreaches },
                enablement: { avgCompletion },
                ebr: { shared: ebrShared, total: list.length, coveragePct: ebrCoveragePct },
                sentiment: { nps: npsVals.length ? round(avg(npsVals)) : null, csat: csatVals.length ? round(avg(csatVals)) : null, detractors },
                journey: { atRisk, avgDaysInStage }
            };
        });

        return cards.sort((a, b) => b.portfolio.valueInr - a.portfolio.valueInr);
    },

    /** One scorecard per Account Manager (customers.sales_owner) — sales lens. */
    async accountManagerScorecards(user, period = {}) {
        const g = await gather(user, period);
        const nonPartner = g.accounts.filter((a) => a.segment !== 'Partner');
        const dv = (a) => g.toInr(a.value_amount, a.value_currency);
        const groups = {};
        for (const a of nonPartner) {
            const key = (a.sales_owner || '').trim() || 'Unassigned';
            (groups[key] ||= []).push(a);
        }

        const cards = Object.entries(groups).map(([manager, list]) => {
            const custs = list.filter((a) => a.segment === 'Customer');
            const pros = list.filter((a) => a.segment === 'Prospect');
            const openPros = pros.filter((a) => a.stage !== 'Lost');
            const closedWon = pros.filter((a) => a.stage === 'Closed').length;
            const lost = pros.filter((a) => a.stage === 'Lost').length;
            const decided = closedWon + lost;
            // Timely metrics: how long deals took to close, and how old the open ones are.
            const cycles = [...custs, ...pros].map((a) => g.closeCycleById[a.id]).filter((v) => v != null);
            return {
                manager,
                accounts: list.length,
                customers: custs.length,
                prospects: openPros.length,
                portfolioInr: custs.reduce((s, a) => s + g.recogInr(a), 0),
                openPipeInr: openPros.reduce((s, a) => s + dv(a), 0),
                weightedInr: openPros.reduce((s, a) => s + dv(a) * ((a.probability || 0) / 100), 0),
                winRate: decided ? round((closedWon / decided) * 100) : null,
                avgMeddicc: pros.length ? Number(avg(pros.map((a) => a.meddicc_score || 0)).toFixed(1)) : 0,
                avgTimeToCloseDays: avgDefined(cycles),
                avgDealAgeDays: avgDefined(openPros.map((a) => g.dealAge(a)))
            };
        });

        return cards.sort((a, b) => (b.portfolioInr + b.weightedInr) - (a.portfolioInr + a.weightedInr));
    },

    /** One scorecard per sourcing Partner (segment = Partner). */
    async partnerScorecards(user, period = {}) {
        const g = await gather(user, period);
        const partners = g.accounts.filter((a) => a.segment === 'Partner');
        const dv = (a) => g.toInr(a.value_amount, a.value_currency);
        return partners.map((p) => {
            const sourced = g.accounts.filter((a) => a.sourcing_partner_id === p.id);
            const won = sourced.filter((a) => a.segment === 'Customer');
            const pipe = sourced.filter((a) => a.segment === 'Prospect' && a.stage !== 'Lost');
            const cycles = sourced.map((a) => g.closeCycleById[a.id]).filter((v) => v != null);
            return {
                id: p.id,
                name: p.name,
                manager: p.partner_manager || '',
                region: p.region || '',
                industry: p.industry || '',
                sourcedCount: sourced.length,
                closedValueInr: won.reduce((s, a) => s + g.recogInr(a), 0),
                pipelineValueInr: pipe.reduce((s, a) => s + dv(a) * ((a.probability || 0) / 100), 0),
                winRate: sourced.length ? round((won.length / sourced.length) * 100) : 0,
                avgTimeToCloseDays: avgDefined(cycles)
            };
        }).sort((a, b) => b.closedValueInr - a.closedValueInr);
    },

    /**
     * One scorecard per Partner Account Manager — the person on a partner's side
     * who ran the deal (customers.partner_manager_id, else the partner_manager name
     * for legacy rows). Rolls up every partner-sourced deal by that PAM.
     */
    async partnerManagerScorecards(user, period = {}) {
        const g = await gather(user, period);
        const dv = (a) => g.toInr(a.value_amount, a.value_currency);
        const db = await getDb();
        const pamRows = await db.all('SELECT id, partner_id, name FROM partner_managers');
        const pamById = Object.fromEntries(pamRows.map((r) => [r.id, r]));
        const partnerById = Object.fromEntries(g.accounts.filter((a) => a.segment === 'Partner').map((p) => [p.id, p]));

        const groups = {};
        for (const a of g.accounts.filter((x) => x.sourcing_partner_id)) {
            const pam = a.partner_manager_id ? pamById[a.partner_manager_id] : null;
            let key, name, partner;
            if (pam) { key = `id:${pam.id}`; name = pam.name; partner = partnerById[pam.partner_id]?.name || ''; }
            else if ((a.partner_manager || '').trim()) { key = `nm:${a.partner_manager.trim().toLowerCase()}`; name = a.partner_manager.trim(); partner = partnerById[a.sourcing_partner_id]?.name || ''; }
            else continue; // no PAM on this deal
            const grp = (groups[key] ||= { name, partner, list: [] });
            grp.list.push(a);
        }

        return Object.entries(groups).map(([key, grp]) => {
            const won = grp.list.filter((a) => a.segment === 'Customer');
            const pipe = grp.list.filter((a) => a.segment === 'Prospect' && a.stage !== 'Lost');
            const cycles = grp.list.map((a) => g.closeCycleById[a.id]).filter((v) => v != null);
            return {
                key, name: grp.name, partner: grp.partner,
                sourcedCount: grp.list.length,
                closedValueInr: won.reduce((s, a) => s + g.recogInr(a), 0),
                pipelineValueInr: pipe.reduce((s, a) => s + dv(a) * ((a.probability || 0) / 100), 0),
                winRate: grp.list.length ? round((won.length / grp.list.length) * 100) : 0,
                avgTimeToCloseDays: avgDefined(cycles)
            };
        }).sort((a, b) => b.closedValueInr - a.closedValueInr);
    }
};
