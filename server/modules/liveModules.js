/**
 * Report / export definitions for the live modules that hang off an account:
 * Onboarding, Support, Training, Documents, Health Checks, EBRs.
 *
 * Each exposes the module-engine contract — records / summarize / exportData /
 * templateColumns — so the /data engine gives every one of them Excel export
 * and an executive report (PDF + in-app JSON) for free. Accounts and Contracts
 * keep their own richer modules (custom fields, import); these are report-first.
 */
import { onboardingRepo } from '../repositories/onboardingRepo.js';
import { supportRepo } from '../repositories/supportRepo.js';
import { trainingRepo } from '../repositories/trainingRepo.js';
import { documentRepo } from '../repositories/documentRepo.js';
import { healthRepo } from '../repositories/healthRepo.js';
import { ebrRepo } from '../repositories/ebrRepo.js';
import { surveyRepo } from '../repositories/surveyRepo.js';
import { featureRepo } from '../repositories/featureRepo.js';
import { expansionRepo } from '../repositories/expansionRepo.js';
import { referralRepo } from '../repositories/referralRepo.js';
import { journeyRepo } from '../repositories/journeyRepo.js';
import { COLORS, fmtInr, pct, plural, barsFromMap, kpi } from './summaryKit.js';

const bump = (m, k) => { if (!k && k !== 0) return m; m[k] = (m[k] || 0) + 1; return m; };
const cols = (...defs) => defs.map(([key, header, type = 'text']) => ({ key, header, type }));

// ─────────────────────────────── Onboarding (Pilot) ───────────────────────────────
export const onboardingModule = {
    key: 'onboarding',
    title: 'Onboarding',
    async records(user) { return onboardingRepo.list(user); },
    summarize(list) {
        const live = list.filter((o) => o.status !== 'Completed' && o.status !== 'Cancelled');
        const blocked = list.filter((o) => o.status === 'Blocked' || o.status === 'At risk');
        const overdue = list.filter((o) => (o.overdueStages || 0) > 0);
        const avgProgress = list.length ? Math.round(list.reduce((s, o) => s + (o.progress || 0), 0) / list.length) : 0;
        const completed = list.filter((o) => o.status === 'Completed');
        const actions = [];
        if (blocked.length) actions.push(`Unblock ${plural(blocked.length, 'onboarding')}: ${blocked.map((o) => o.account).join(', ')}.`);
        if (overdue.length) actions.push(`${plural(overdue.length, 'onboarding')} have overdue stages — re-baseline the plan.`);
        if (!actions.length) actions.push('All onboardings on track — keep the go-live cadence.');
        return {
            kpis: [
                kpi('In flight', live.length, `${completed.length} completed`, COLORS.cyan),
                kpi('At risk / blocked', blocked.length, 'need intervention', blocked.length ? COLORS.red : COLORS.green),
                kpi('Avg progress', `${avgProgress}%`, 'across all plans', COLORS.indigo),
                kpi('Overdue stages', overdue.length, 'past due date', overdue.length ? COLORS.amber : COLORS.green)
            ],
            bars: barsFromMap('Onboardings by status', list.reduce((m, o) => bump(m, o.status), {})),
            sections: [
                { title: 'Needs attention', color: COLORS.red, lines: blocked.length ? blocked.map((o) => `${o.account} — ${o.status}, ${o.progress}%${o.currentStage ? ` (at ${o.currentStage.name})` : ''}`) : ['Nothing blocked.'] },
                { title: 'Overdue stages', color: COLORS.amber, lines: overdue.length ? overdue.map((o) => `${o.account} — ${plural(o.overdueStages, 'stage')} overdue`) : ['No overdue stages.'] },
                { title: 'Overview', color: COLORS.violet, lines: [`${live.length} live, ${completed.length} completed; average completion ${avgProgress}%.`] }
            ],
            actions, generatedBy: "Pilot's computed engine"
        };
    },
    async exportData(user) {
        const rows = await onboardingRepo.list(user);
        return {
            title: this.title,
            columns: cols(['account', 'Account'], ['status', 'Status'], ['progress', 'Progress %', 'number'],
                ['currentStage', 'Current Stage'], ['overdueStages', 'Overdue Stages', 'number'],
                ['target_go_live', 'Target Go-Live', 'date'], ['daysToGoLive', 'Days to Go-Live', 'number']),
            rows: rows.map((o) => ({ ...o, currentStage: o.currentStage ? o.currentStage.name : '' }))
        };
    },
    async templateColumns() { return { columns: (await this.exportData({})).columns, example: {}, moduleTitle: this.title }; }
};

// ─────────────────────────────── Support (Medic) ───────────────────────────────
export const supportModule = {
    key: 'support',
    title: 'Support Metrics',
    async records(user) { return supportRepo.list(user); },
    summarize(list) {
        const open = list.filter((t) => !t.resolved);
        const resolved = list.filter((t) => t.resolved);
        const breached = list.filter((t) => t.breached);
        const atRisk = list.filter((t) => t.at_risk && !t.resolved);
        const metSla = resolved.filter((t) => !t.breached).length;
        const attainment = resolved.length ? pct(metSla, resolved.length) : null;
        const actions = [];
        if (breached.length) actions.push(`${plural(breached.length, 'ticket')} breached SLA — review root causes.`);
        if (atRisk.length) actions.push(`Grab ${plural(atRisk.length, 'at-risk ticket')} before the SLA clock runs out.`);
        if (!actions.length) actions.push('SLA healthy — no breaches or at-risk tickets right now.');
        return {
            kpis: [
                kpi('Open tickets', open.length, `${list.length} total`, COLORS.cyan),
                kpi('SLA breaches', breached.length, 'response or resolution', breached.length ? COLORS.red : COLORS.green),
                kpi('At risk', atRisk.length, 'SLA clock running', atRisk.length ? COLORS.amber : COLORS.green),
                kpi('SLA attainment', attainment === null ? 'n/a' : `${attainment}%`, `${resolved.length} resolved`, COLORS.indigo)
            ],
            bars: barsFromMap('Open tickets by priority', open.reduce((m, t) => bump(m, t.priority), {})),
            sections: [
                { title: 'SLA breaches', color: COLORS.red, lines: breached.slice(0, 8).map((t) => `${t.ticket_no} · ${t.account} — ${t.priority}, ${t.status}`) || ['None.'] },
                { title: 'At risk', color: COLORS.amber, lines: atRisk.length ? atRisk.slice(0, 8).map((t) => `${t.ticket_no} · ${t.account} — ${t.priority}`) : ['None.'] },
                { title: 'By tier', color: COLORS.sky, lines: Object.entries(list.reduce((m, t) => bump(m, t.support_tier || t.tier), {})).map(([k, v]) => `${k}: ${v}`) },
                { title: 'Overview', color: COLORS.violet, lines: [`${open.length} open of ${list.length}; ${breached.length} breached; ${attainment === null ? 'no' : attainment + '%'} SLA attainment.`] }
            ],
            actions, generatedBy: "Medic's computed engine"
        };
    },
    async exportData(user) {
        const rows = await supportRepo.list(user);
        return {
            title: this.title,
            columns: cols(['ticket_no', 'Ticket'], ['account', 'Account'], ['subject', 'Subject'], ['category', 'Category'],
                ['priority', 'Priority'], ['status', 'Status'], ['support_tier', 'Tier'], ['assignee', 'Assignee'],
                ['sla_state', 'SLA State'], ['opened_at', 'Opened', 'date'], ['resolved_at', 'Resolved', 'date']),
            rows: rows.map((t) => ({ ...t, sla_state: t.breached ? 'Breached' : t.at_risk ? 'At risk' : 'On track' }))
        };
    },
    async templateColumns() { return { columns: (await this.exportData({})).columns, example: {}, moduleTitle: this.title }; }
};

// ─────────────────────────────── Training (Sensei) ───────────────────────────────
export const trainingModule = {
    key: 'training',
    title: 'Training',
    async records(user) { return trainingRepo.list(user); },
    async summarize(list, user) {
        const enrolled = list.reduce((s, r) => s + r.enrolled, 0);
        const completed = list.reduce((s, r) => s + r.completed, 0);
        const certified = list.reduce((s, r) => s + r.certified, 0);
        const stalled = list.filter((r) => r.stalled);
        const actions = [];
        if (stalled.length) actions.push(`Re-engage ${plural(stalled.length, 'stalled session')}.`);
        if (pct(completed, enrolled) < 60 && enrolled) actions.push('Completion under 60% — under-trained users drive support load and churn.');
        if (!actions.length) actions.push('Enablement healthy — keep certifications current.');
        return {
            kpis: [
                kpi('Learners enrolled', enrolled, `${list.length} sessions`, COLORS.cyan),
                kpi('Completion rate', `${pct(completed, enrolled)}%`, `${completed} completed`, COLORS.green),
                kpi('Certified', certified, `${pct(certified, enrolled)}% of enrolled`, COLORS.amber),
                kpi('Stalled sessions', stalled.length, 'no recent progress', stalled.length ? COLORS.red : COLORS.green)
            ],
            bars: barsFromMap('Sessions by status', list.reduce((m, r) => bump(m, r.status), {})),
            sections: [
                { title: 'Stalled', color: COLORS.red, lines: stalled.length ? stalled.slice(0, 8).map((r) => `${r.account} — ${r.title} (${r.completed}/${r.enrolled})`) : ['None.'] },
                { title: 'By format', color: COLORS.sky, lines: Object.entries(list.reduce((m, r) => bump(m, r.format), {})).map(([k, v]) => `${k}: ${v}`) },
                { title: 'Overview', color: COLORS.violet, lines: [`${enrolled} learners across ${list.length} sessions; ${pct(completed, enrolled)}% completion, ${certified} certified.`] }
            ],
            actions, generatedBy: "Sensei's computed engine"
        };
    },
    async exportData(user) {
        const rows = await trainingRepo.list(user);
        return {
            title: this.title,
            columns: cols(['title', 'Session'], ['account', 'Account'], ['format', 'Format'], ['status', 'Status'],
                ['trainer', 'Trainer'], ['enrolled', 'Enrolled', 'number'], ['completed', 'Completed', 'number'],
                ['certified', 'Certified', 'number'], ['completion_rate', 'Completion %', 'number'], ['session_date', 'Date', 'date']),
            rows
        };
    },
    async templateColumns() { return { columns: (await this.exportData({})).columns, example: {}, moduleTitle: this.title }; }
};

// ─────────────────────────────── Documents (DOXY) ───────────────────────────────
export const documentsModule = {
    key: 'documents',
    title: 'Documents',
    async records(user) { return documentRepo.list(user); },
    summarize(list) {
        const byType = list.reduce((m, d) => bump(m, d.doc_type), {});
        const byCategory = list.reduce((m, d) => bump(m, d.category || 'Uncategorised'), {});
        const totalBytes = list.reduce((s, d) => s + (d.size_bytes || 0), 0);
        const signed = list.filter((d) => /sign|counter/i.test(d.status || '') || /signed/i.test(d.name || ''));
        const actions = [];
        actions.push(`${plural(list.length, 'document')} on file across ${Object.keys(byCategory).length} categories.`);
        if (!signed.length && list.length) actions.push('No signed-copy markers found — confirm countersigned agreements are filed.');
        return {
            kpis: [
                kpi('Documents', list.length, `${Object.keys(byType).length} types`, COLORS.cyan),
                kpi('Categories', Object.keys(byCategory).length, 'in the library', COLORS.indigo),
                kpi('Total size', `${(totalBytes / 1048576).toFixed(1)} MB`, 'stored', COLORS.sky),
                kpi('Signed copies', signed.length, 'agreements executed', COLORS.green)
            ],
            bars: barsFromMap('Documents by type', byType),
            sections: [
                { title: 'By category', color: COLORS.sky, lines: Object.entries(byCategory).map(([k, v]) => `${k}: ${v}`) },
                { title: 'Overview', color: COLORS.violet, lines: [`${list.length} documents, ${(totalBytes / 1048576).toFixed(1)} MB across ${Object.keys(byCategory).length} categories.`] }
            ],
            actions, generatedBy: "DOXY's computed engine"
        };
    },
    async exportData(user) {
        const rows = await documentRepo.list(user);
        return {
            title: this.title,
            columns: cols(['name', 'Name'], ['account', 'Account'], ['doc_type', 'Type'], ['category', 'Category'],
                ['version', 'Version'], ['status', 'Status'], ['created_at', 'Added', 'date']),
            rows
        };
    },
    async templateColumns() { return { columns: (await this.exportData({})).columns, example: {}, moduleTitle: this.title }; }
};

// ─────────────────────────────── Health Checks (Pulse) ───────────────────────────────
export const healthModule = {
    key: 'health-checks',
    title: 'Health Checks',
    async records(user) { return healthRepo.accountHealth(user); },
    summarize(board) {
        const red = board.filter((h) => h.currentSignal === 'Red');
        const amber = board.filter((h) => h.currentSignal === 'Amber');
        const overdue = board.filter((h) => h.overdue);
        const worsening = board.filter((h) => h.trend < 0);
        const openActions = board.reduce((s, h) => s + h.openActions, 0);
        const actions = [];
        if (overdue.length) actions.push(`Call ${plural(overdue.length, 'overdue account')} — start with the highest tier.`);
        if (red.length) actions.push(`Build save plans for ${plural(red.length, 'red account')}.`);
        if (!actions.length) actions.push('Every customer inside cadence and green — maintain the rhythm.');
        return {
            kpis: [
                kpi('Customers tracked', board.length, `${board.filter((h) => h.checkCount === 0).length} never checked`, COLORS.cyan),
                kpi('Overdue checks', overdue.length, 'past tier cadence', overdue.length ? COLORS.amber : COLORS.green),
                kpi('At risk', red.length + amber.length, `${red.length} red · ${amber.length} amber`, red.length ? COLORS.red : COLORS.green),
                kpi('Open actionables', openActions, `${worsening.length} worsening`, COLORS.violet)
            ],
            bars: barsFromMap('Customers by signal', board.reduce((m, h) => bump(m, h.currentSignal), {})),
            sections: [
                { title: 'Red / at risk', color: COLORS.red, lines: [...red, ...amber].slice(0, 8).map((h) => `${h.account} — ${h.currentSignal}${h.openActions ? `, ${plural(h.openActions, 'open action')}` : ''}`) || ['None.'] },
                { title: 'Overdue', color: COLORS.amber, lines: overdue.length ? overdue.slice(0, 8).map((h) => `${h.account} (${h.tier}) — ${h.lastCheckDate ? `${Math.abs(h.daysToNext)}d overdue` : 'never checked'}`) : ['None.'] },
                { title: 'Overview', color: COLORS.violet, lines: [`${board.length} customers; ${red.length} red, ${amber.length} amber; ${overdue.length} overdue; ${openActions} open actionables.`] }
            ],
            actions, generatedBy: "Pulse's computed engine"
        };
    },
    async exportData(user) {
        const rows = await healthRepo.accountHealth(user);
        return {
            title: this.title,
            columns: cols(['account', 'Account'], ['tier', 'Tier'], ['cadenceDays', 'Cadence (days)', 'number'],
                ['currentSignal', 'Signal'], ['sentiment', 'Sentiment'], ['lastCheckDate', 'Last Check', 'date'],
                ['nextDueDate', 'Next Due', 'date'], ['openActions', 'Open Actions', 'number']),
            rows
        };
    },
    async templateColumns() { return { columns: (await this.exportData({})).columns, example: {}, moduleTitle: this.title }; }
};

// ─────────────────────────────── Surveys (Echo) ───────────────────────────────
export const surveysModule = {
    key: 'surveys',
    title: 'Surveys',
    async records(user) { return surveyRepo.listCampaigns(user); },
    // Computed from the already-scoped campaign list (the engine passes records only).
    summarize(list) {
        const avg = (arr) => (arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : null);
        const npsScore = avg(list.filter((c) => c.type === 'NPS' && c.headline !== null).map((c) => c.headline));
        const csatScore = avg(list.filter((c) => c.type === 'CSAT' && c.headline !== null).map((c) => c.headline));
        const responses = list.reduce((s, c) => s + (c.responseCount || 0), 0);
        const detractors = list.reduce((s, c) => s + (c.detractors || 0), 0);
        const live = list.filter((c) => c.status === 'Live').length;
        const sentiments = list.reduce((m, c) => {
            for (const [k, v] of Object.entries(c.sentiments || {})) m[k] = (m[k] || 0) + v;
            return m;
        }, { Positive: 0, Neutral: 0, Negative: 0 });
        const byType = list.reduce((m, c) => { m[c.type] = (m[c.type] || 0) + 1; return m; }, {});
        const rates = list.filter((c) => c.responseRate !== null).map((c) => c.responseRate);
        const actions = [];
        if (detractors) actions.push(`Follow up ${plural(detractors, 'detractor')} — a fast answer is a save.`);
        if (list.length && !responses) actions.push('Campaigns are out but no responses yet — chase participation.');
        if (!actions.length) actions.push('Sentiment healthy — keep the survey cadence and close the loop on every comment.');
        return {
            kpis: [
                kpi('NPS', npsScore === null ? 'n/a' : npsScore, `${responses} responses`, COLORS.cyan),
                kpi('CSAT', csatScore === null ? 'n/a' : `${csatScore}%`, 'satisfied', COLORS.green),
                kpi('Response rate', rates.length ? `${avg(rates)}%` : 'n/a', `${live} live`, COLORS.indigo),
                kpi('Detractors', detractors, 'to follow up', detractors ? COLORS.red : COLORS.green)
            ],
            bars: barsFromMap('Responses by sentiment', sentiments),
            sections: [
                { title: 'Detractors', color: COLORS.red, lines: detractors ? list.filter((c) => c.detractors > 0).slice(0, 8).map((c) => `${c.account} — ${c.title}: ${plural(c.detractors, 'detractor')}`) : ['None.'] },
                { title: 'By instrument', color: COLORS.sky, lines: Object.entries(byType).map(([k, v]) => `${k}: ${v} campaign(s)`) },
                { title: 'Overview', color: COLORS.violet, lines: [`${list.length} campaigns, ${responses} responses; NPS ${npsScore ?? 'n/a'}, CSAT ${csatScore ?? 'n/a'}%.`] }
            ],
            actions, generatedBy: "Echo's computed engine"
        };
    },
    async exportData(user) {
        const rows = await surveyRepo.listCampaigns(user);
        return {
            title: this.title,
            columns: cols(['title', 'Campaign'], ['account', 'Account'], ['type', 'Type'], ['status', 'Status'],
                ['sent_count', 'Sent', 'number'], ['responseCount', 'Responses', 'number'], ['responseRate', 'Response %', 'number'],
                ['headline', 'Score'], ['detractors', 'Detractors', 'number']),
            rows
        };
    },
    async templateColumns() { return { columns: (await this.exportData({})).columns, example: {}, moduleTitle: this.title }; }
};

// ─────────────────────────────── Feature Requests (Forge) ───────────────────────────────
export const featuresModule = {
    key: 'feature-requests',
    title: 'Feature Requests',
    async records(user) { return featureRepo.list(user); },
    summarize(list) {
        const OPEN = ['Requested', 'Under review', 'Planned', 'In progress'];
        const open = list.filter((f) => OPEN.includes(f.status));
        const shipped = list.filter((f) => f.status === 'Shipped');
        const bump = (m, k) => { if (k) m[k] = (m[k] || 0) + 1; return m; };
        const top = [...list].sort((a, b) => b.demand - a.demand).slice(0, 8);
        const actions = [];
        const triage = list.filter((f) => f.status === 'Requested' || f.status === 'Under review').length;
        if (triage) actions.push(`Triage ${plural(triage, 'unreviewed request')}.`);
        if (shipped.length) actions.push(`Close the loop on ${plural(shipped.length, 'shipped feature')} — tell the customers who asked.`);
        if (!actions.length) actions.push('Roadmap is flowing — keep ranking by demand.');
        return {
            kpis: [
                kpi('Requests', list.length, `${open.length} open`, COLORS.cyan),
                kpi('Shipped', shipped.length, `${list.length ? Math.round((shipped.length / list.length) * 100) : 0}% shipped`, COLORS.green),
                kpi('Total demand', list.reduce((s, f) => s + f.demand, 0), 'supporters + votes', COLORS.violet),
                kpi('Top RICE', top[0] ? top[0].rice : 0, top[0] ? top[0].title.slice(0, 22) : '—', COLORS.amber)
            ],
            bars: barsFromMap('Requests by status', list.reduce((m, f) => bump(m, f.status), {})),
            sections: [
                { title: 'Top demand', color: COLORS.violet, lines: top.slice(0, 6).map((f) => `${f.title} — demand ${f.demand}, RICE ${f.rice} (${f.status})`) },
                { title: 'By product area', color: COLORS.sky, lines: Object.entries(list.reduce((m, f) => bump(m, f.product_area || 'Unassigned'), {})).map(([k, v]) => `${k}: ${v}`) },
                { title: 'Overview', color: COLORS.indigo, lines: [`${list.length} requests, ${open.length} open, ${shipped.length} shipped.`] }
            ],
            actions, generatedBy: "Forge's computed engine"
        };
    },
    async exportData(user) {
        const rows = await featureRepo.list(user);
        return {
            title: this.title,
            columns: cols(['title', 'Feature'], ['account', 'Raised By'], ['status', 'Status'], ['impact', 'Impact'],
                ['effort', 'Effort'], ['product_area', 'Product Area'], ['supporterCount', 'Supporters', 'number'],
                ['votes', 'Votes', 'number'], ['demand', 'Demand', 'number'], ['rice', 'RICE', 'number']),
            rows
        };
    },
    async templateColumns() { return { columns: (await this.exportData({})).columns, example: {}, moduleTitle: this.title }; }
};

// ─────────────────────────────── Upsells (Rainmaker) ───────────────────────────────
export const upsellsModule = {
    key: 'upsells',
    title: 'Upsells',
    async records(user) { return expansionRepo.list(user); },
    // Computed from the already-scoped, decorated expansion list (valueInr/weightedInr).
    summarize(list) {
        const OPEN = ['Identified', 'Qualified', 'Proposed', 'Negotiation'];
        const open = list.filter((e) => OPEN.includes(e.stage));
        const won = list.filter((e) => e.stage === 'Won');
        const lost = list.filter((e) => e.stage === 'Lost');
        const closed = won.length + lost.length;
        const bump = (m, k) => { m[k] = (m[k] || 0) + 1; return m; };
        const openValue = open.reduce((s, e) => s + e.valueInr, 0);
        const weighted = open.reduce((s, e) => s + e.weightedInr, 0);
        const wonValue = won.reduce((s, e) => s + e.valueInr, 0);
        const winRate = closed ? Math.round((won.length / closed) * 100) : null;
        const byStageValue = {};
        for (const e of list) byStageValue[e.stage] = (byStageValue[e.stage] || 0) + e.valueInr;
        const top = [...open].sort((a, b) => b.weightedInr - a.weightedInr).slice(0, 6);
        const actions = [];
        const late = list.filter((e) => e.stage === 'Negotiation' || e.stage === 'Proposed');
        if (late.length) actions.push(`Close ${plural(late.length, 'late-stage deal')} — nearest to revenue.`);
        const early = list.filter((e) => e.stage === 'Identified');
        if (early.length) actions.push(`Qualify ${plural(early.length, 'identified deal')} out of the top of the funnel.`);
        if (!actions.length) actions.push('Pipeline healthy — keep sourcing expansion on happy accounts.');
        return {
            kpis: [
                kpi('Open pipeline', fmtInr(openValue), `${open.length} deals`, COLORS.cyan),
                kpi('Weighted forecast', fmtInr(weighted), 'value x probability', COLORS.green),
                kpi('Won', fmtInr(wonValue), `${won.length} deals`, COLORS.violet),
                kpi('Win rate', winRate === null ? 'n/a' : `${winRate}%`, 'of closed', COLORS.amber)
            ],
            bars: { title: 'Pipeline value by stage', items: Object.entries(byStageValue).filter(([, v]) => v > 0).map(([stage, value]) => ({ label: stage, sub: '', value, valueStr: fmtInr(value) })).sort((a, b) => b.value - a.value) },
            sections: [
                { title: 'Top deals to chase', color: COLORS.green, lines: top.length ? top.map((d) => `${d.title} (${d.account}) — ${fmtInr(d.valueInr)} @ ${d.probability}% = ${fmtInr(d.weightedInr)}`) : ['None open.'] },
                { title: 'By type', color: COLORS.sky, lines: Object.entries(list.reduce((m, e) => bump(m, e.type), {})).map(([k, v]) => `${k}: ${v}`) },
                { title: 'Overview', color: COLORS.indigo, lines: [`${list.length} opportunities; ${fmtInr(openValue)} open, ${fmtInr(weighted)} weighted.`] }
            ],
            actions, generatedBy: "Rainmaker's computed engine"
        };
    },
    async exportData(user) {
        const rows = await expansionRepo.list(user);
        return {
            title: this.title,
            columns: cols(['title', 'Opportunity'], ['account', 'Account'], ['type', 'Type'], ['product', 'Product'],
                ['stage', 'Stage'], ['value_amount', 'Value', 'number'], ['currency', 'Currency'], ['probability', 'Probability %', 'number'],
                ['valueInr', 'Value (INR)', 'number'], ['weightedInr', 'Weighted (INR)', 'number'], ['target_close', 'Target Close', 'date']),
            rows
        };
    },
    async templateColumns() { return { columns: (await this.exportData({})).columns, example: {}, moduleTitle: this.title }; }
};

// ─────────────────────────────── Referrals (Magnet) ───────────────────────────────
export const referralsModule = {
    key: 'referrals',
    title: 'Referrals',
    async records(user) { return referralRepo.list(user); },
    summarize(list) {
        // advocate leaderboard computed from the already-scoped list (no user needed)
        const advMap = {};
        for (const r of list) {
            const a = advMap[r.account] || (advMap[r.account] = { account: r.account, referrals: 0, converted: 0, valueInr: 0 });
            a.referrals += 1;
            if (r.status === 'Converted') { a.converted += 1; a.valueInr += r.valueInr; }
        }
        const advocates = Object.values(advMap).sort((x, y) => y.converted - x.converted || y.referrals - x.referrals);
        const converted = list.filter((r) => r.status === 'Converted');
        const declined = list.filter((r) => r.status === 'Declined');
        const closed = converted.length + declined.length;
        const open = list.filter((r) => !['Converted', 'Declined'].includes(r.status));
        const rewardsOwed = list.filter((r) => r.status === 'Converted' && r.reward && !r.reward_paid).length;
        const bump = (m, k) => { m[k] = (m[k] || 0) + 1; return m; };
        const actions = [];
        if (open.length) actions.push(`Work ${plural(open.length, 'open referral')} toward conversion.`);
        if (rewardsOwed) actions.push(`Settle ${plural(rewardsOwed, 'advocate reward')} — pay promptly to keep referrals flowing.`);
        if (!actions.length) actions.push('Referral engine is idle — ask your NPS promoters for an introduction.');
        return {
            kpis: [
                kpi('Referrals', list.length, `${open.length} open`, COLORS.cyan),
                kpi('Converted', converted.length, closed ? `${Math.round((converted.length / closed) * 100)}% conversion` : 'n/a', COLORS.green),
                kpi('Referred value', fmtInr(list.filter((r) => r.status !== 'Declined').reduce((s, r) => s + r.valueInr, 0)), 'pipeline', COLORS.violet),
                kpi('Rewards owed', rewardsOwed, 'to advocates', rewardsOwed ? COLORS.amber : COLORS.green)
            ],
            bars: barsFromMap('Referrals by status', list.reduce((m, r) => bump(m, r.status), {})),
            sections: [
                { title: 'Top advocates', color: COLORS.green, lines: advocates.length ? advocates.slice(0, 6).map((a) => `${a.account} — ${a.referrals} referrals, ${a.converted} converted (${fmtInr(a.valueInr)})`) : ['No advocates yet.'] },
                { title: 'Overview', color: COLORS.violet, lines: [`${list.length} referrals from ${advocates.length} advocates; ${converted.length} converted.`] }
            ],
            actions, generatedBy: "Magnet's computed engine"
        };
    },
    async exportData(user) {
        const rows = await referralRepo.list(user);
        return {
            title: this.title,
            columns: cols(['referred_name', 'Referred'], ['account', 'Referred By'], ['status', 'Status'],
                ['value_amount', 'Value', 'number'], ['currency', 'Currency'], ['valueInr', 'Value (INR)', 'number'],
                ['reward', 'Reward'], ['owner', 'Owner']),
            rows
        };
    },
    async templateColumns() { return { columns: (await this.exportData({})).columns, example: {}, moduleTitle: this.title }; }
};

// ─────────────────────────────── Journey (Compass) ───────────────────────────────
export const journeyModule = {
    key: 'journey',
    title: 'Journey Map',
    async records(user) { return journeyRepo.list(user); },
    summarize(list) {
        const bump = (m, k) => { m[k] = (m[k] || 0) + 1; return m; };
        const stalled = list.filter((j) => j.stalled);
        const atRisk = list.filter((j) => j.stage === 'At Risk');
        const advocacy = list.filter((j) => j.stage === 'Advocacy');
        const withProg = list.filter((j) => j.progress !== null);
        const avgProgress = withProg.length ? Math.round(withProg.reduce((s, j) => s + j.progress, 0) / withProg.length) : 0;
        const actions = [];
        if (stalled.length) actions.push(`Re-engage ${plural(stalled.length, 'stalled customer')} stuck too long in a stage.`);
        if (atRisk.length) actions.push(`Build save plans for ${plural(atRisk.length, 'at-risk customer')}.`);
        if (!actions.length) actions.push('Every customer is progressing on the lifecycle — keep nudging toward advocacy.');
        return {
            kpis: [
                kpi('Customers mapped', `${list.filter((j) => j.set).length}/${list.length}`, 'on the lifecycle', COLORS.cyan),
                kpi('Stalled', stalled.length, 'too long in stage', stalled.length ? COLORS.amber : COLORS.green),
                kpi('At risk', atRisk.length, 'off the happy path', atRisk.length ? COLORS.red : COLORS.green),
                kpi('At advocacy', advocacy.length, `avg progress ${avgProgress}%`, COLORS.violet)
            ],
            bars: barsFromMap('Customers by lifecycle stage', list.reduce((m, j) => bump(m, j.stage), {})),
            sections: [
                { title: 'Stalled', color: COLORS.amber, lines: stalled.length ? stalled.slice(0, 8).map((j) => `${j.account} — ${j.stage}, ${plural(j.daysInStage, 'day')} in stage`) : ['None.'] },
                { title: 'At risk / poor health', color: COLORS.red, lines: list.filter((j) => j.stage === 'At Risk' || j.health === 'Poor').slice(0, 8).map((j) => `${j.account} — ${j.stage} / ${j.health}`) || ['None.'] },
                { title: 'Overview', color: COLORS.indigo, lines: [`${list.length} customers; ${advocacy.length} at advocacy, ${atRisk.length} at risk; avg progress ${avgProgress}%.`] }
            ],
            actions, generatedBy: "Compass's computed engine"
        };
    },
    async exportData(user) {
        const rows = await journeyRepo.list(user);
        return {
            title: this.title,
            columns: cols(['account', 'Account'], ['stage', 'Lifecycle Stage'], ['health', 'Health'],
                ['daysInStage', 'Days in Stage', 'number'], ['progress', 'Progress %', 'number'], ['owner', 'Owner']),
            rows
        };
    },
    async templateColumns() { return { columns: (await this.exportData({})).columns, example: {}, moduleTitle: this.title }; }
};

// ─────────────────────────────── EBRs (Aria) ───────────────────────────────
export const ebrModule = {
    key: 'ebrs',
    title: 'Executive Business Reviews',
    async records(user) { return ebrRepo.coverage(user); },
    summarize(cov) {
        const actions = [];
        if (cov.notStarted) actions.push(`Generate EBRs for ${plural(cov.notStarted, 'customer')} with none this quarter.`);
        if (cov.pendingShare) actions.push(`Share ${plural(cov.pendingShare, 'generated EBR')} with customers.`);
        if (!actions.length) actions.push(`Every customer covered and shared for ${cov.quarterLabel}.`);
        return {
            kpis: [
                kpi('Customers', cov.customers, cov.quarterLabel, COLORS.cyan),
                kpi('Generated', cov.generated, `${cov.notStarted} not started`, COLORS.violet),
                kpi('Shared', cov.shared, `of ${cov.customers}`, COLORS.green),
                kpi('Awaiting share', cov.pendingShare, 'generated, not sent', cov.pendingShare ? COLORS.amber : COLORS.green)
            ],
            bars: barsFromMap('EBR status this quarter', cov.rows.reduce((m, r) => bump(m, r.status), {})),
            sections: [
                { title: 'Not started', color: COLORS.red, lines: cov.rows.filter((r) => r.status === 'Not started').slice(0, 10).map((r) => r.account) || ['None.'] },
                { title: 'Awaiting share', color: COLORS.amber, lines: cov.rows.filter((r) => r.id && r.status !== 'Shared').slice(0, 10).map((r) => `${r.account} — ${r.status}`) },
                { title: 'Overview', color: COLORS.violet, lines: [`${cov.quarterLabel}: ${cov.generated}/${cov.customers} generated, ${cov.shared} shared.`] }
            ],
            actions, generatedBy: "Aria's computed engine"
        };
    },
    async exportData(user) {
        const rows = await ebrRepo.list(user, {});
        return {
            title: this.title,
            columns: cols(['account', 'Account'], ['quarter', 'Quarter'], ['status', 'Status'],
                ['generated_at', 'Generated', 'date'], ['shared_at', 'Shared', 'date']),
            rows
        };
    },
    async templateColumns() { return { columns: (await this.exportData({})).columns, example: {}, moduleTitle: this.title }; }
};
