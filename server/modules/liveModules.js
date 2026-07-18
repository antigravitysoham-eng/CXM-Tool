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
