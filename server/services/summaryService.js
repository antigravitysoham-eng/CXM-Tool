import { config } from '../config.js';

// Computed executive summaries in a generic shape the PDF renderer consumes:
//   { kpis, bars:{title,items}, sections:[{title,color,lines}], actions, generatedBy }
// PDF-safe currency ("Rs") since pdfkit's built-in fonts lack the ₹ glyph.

function fmtInr(n) {
    const v = Math.round(n || 0);
    if (v >= 10000000) return `Rs ${(v / 10000000).toFixed(2).replace(/\.00$/, '')} Cr`;
    if (v >= 100000) return `Rs ${(v / 100000).toFixed(2).replace(/\.00$/, '')} L`;
    return `Rs ${v.toLocaleString('en-IN')}`;
}
const todayStr = () => new Date().toISOString().slice(0, 10);

// ---------- Accounts (Cash Horizon) ----------
export function computeAccountsSummary(records, fx = config.fxUsdInr) {
    const toInr = (a) => (a.value_currency === 'INR' ? a.value_amount : a.value_amount * fx) || 0;
    const customers = records.filter((a) => a.segment === 'Customer');
    const prospects = records.filter((a) => a.segment === 'Prospect');
    const partners = records.filter((a) => a.segment === 'Partner');

    const portfolio = customers.reduce((s, a) => s + toInr(a), 0);
    const openPipe = prospects.reduce((s, a) => s + toInr(a), 0);
    const weighted = prospects.reduce((s, a) => s + toInr(a) * (a.probability / 100), 0);
    const atRisk = customers.filter((a) => a.health === 'Poor' || a.health === 'Critical');
    const weak = prospects.filter((a) => a.meddicc_score < 3).sort((a, b) => a.meddicc_score - b.meddicc_score);
    const overdue = records.filter((a) => a.next_step_date && a.next_step_date < todayStr());

    const stageOrder = ['Lead', 'Qualified', 'POC', 'Negotiation'];
    const byStage = {};
    prospects.forEach((a) => { byStage[a.stage] = byStage[a.stage] || { w: 0, c: 0 }; byStage[a.stage].w += toInr(a) * (a.probability / 100); byStage[a.stage].c += 1; });

    const partnerRollup = partners.map((p) => {
        const sourced = records.filter((a) => a.sourcing_partner_id === p.id);
        const won = sourced.filter((a) => a.segment === 'Customer');
        return { name: p.name, sourced: sourced.length, closed: won.reduce((s, a) => s + toInr(a), 0) };
    }).filter((p) => p.sourced > 0).sort((a, b) => b.closed - a.closed);

    const actions = [];
    if (atRisk.length) actions.push(`Prioritise save plans for ${atRisk.length} at-risk customer(s): ${atRisk.map((a) => a.name).join(', ')}.`);
    if (weak.length) actions.push(`Close MEDDICC gaps on ${weak.length} under-qualified prospect(s) before advancing.`);
    if (overdue.length) actions.push(`Clear ${overdue.length} overdue next step(s) this week.`);
    if (weighted > 0) actions.push(`Weighted forecast is ${fmtInr(weighted)} across ${prospects.length} prospects — focus late-stage deals.`);
    if (!actions.length) actions.push('Portfolio is healthy — maintain cadence and pursue expansion.');

    return {
        kpis: [
            { label: 'Customer portfolio', value: fmtInr(portfolio), hint: `${customers.length} customers`, color: '#22d3ee' },
            { label: 'Open pipeline', value: fmtInr(openPipe), hint: `${prospects.length} prospects`, color: '#818cf8' },
            { label: 'Weighted forecast', value: fmtInr(weighted), hint: 'value x win %', color: '#34d399' },
            { label: 'Accounts at risk', value: String(atRisk.length), hint: 'Poor / Critical', color: '#f87171' }
        ],
        bars: {
            title: 'Pipeline by stage',
            items: stageOrder.filter((s) => byStage[s]).map((s) => ({ label: s, sub: `${byStage[s].c} deal(s)`, value: byStage[s].w, valueStr: fmtInr(byStage[s].w) }))
        },
        sections: [
            { title: 'Needs attention', color: '#f87171', lines: atRisk.length ? atRisk.map((a) => `${a.name} — ${a.health}, ${fmtInr(toInr(a))}${a.sales_owner ? ` (${a.sales_owner})` : ''}`) : ['Nothing flagged.'] },
            { title: 'MEDDICC gaps', color: '#fbbf24', lines: weak.length ? weak.map((a) => `${a.name} — ${a.meddicc_score}/7 (${a.stage})`) : ['All prospects 3+/7.'] },
            { title: 'Partner contribution', color: '#38bdf8', lines: partnerRollup.length ? partnerRollup.map((p) => `${p.name} — ${p.sourced} sourced, ${fmtInr(p.closed)} closed`) : ['No partner-sourced deals.'] },
            { title: 'Overview', color: '#6366f1', lines: [`Portfolio ${fmtInr(portfolio)} across ${customers.length} customers; ${fmtInr(weighted)} weighted forecast across ${prospects.length} prospects.`] }
        ],
        actions,
        generatedBy: "NEO's computed engine"
    };
}

// ---------- Contracts (CLM) ----------
export function computeContractsSummary(contracts, fx = config.fxUsdInr) {
    const toInr = (c) => (c.currency === 'INR' ? c.tcv : c.tcv * fx) || 0;
    const active = contracts.filter((c) => c.status === 'Active' || c.status === 'Renewing');
    const withDays = contracts.filter((c) => c.days_to_renewal !== null && c.days_to_renewal !== undefined);

    const valueUnderMgmt = active.reduce((s, c) => s + toInr(c), 0);
    const atRiskList = withDays.filter((c) => c.days_to_renewal <= 90 && c.days_to_renewal >= -30);
    const revenueAtRisk = atRiskList.reduce((s, c) => s + toInr(c), 0);
    const autoRenew = contracts.filter((c) => c.auto_renew);
    const autoExposure = autoRenew.reduce((s, c) => s + toInr(c), 0);

    const buckets = [
        { label: 'Overdue', match: (d) => d < 0 },
        { label: 'Due <= 30d', match: (d) => d >= 0 && d <= 30 },
        { label: 'Due 31-60d', match: (d) => d > 30 && d <= 60 },
        { label: 'Due 61-90d', match: (d) => d > 60 && d <= 90 }
    ].map((b) => {
        const items = withDays.filter((c) => b.match(c.days_to_renewal));
        return { label: b.label, sub: `${items.length} contract(s)`, value: items.reduce((s, c) => s + toInr(c), 0), valueStr: fmtInr(items.reduce((s, c) => s + toInr(c), 0)) };
    }).filter((b) => b.value > 0);

    const overdueOrCritical = withDays.filter((c) => c.days_to_renewal <= 30).sort((a, b) => a.days_to_renewal - b.days_to_renewal);
    const autoSoon = autoRenew.filter((c) => c.days_to_renewal !== null && c.days_to_renewal <= 90);
    const sub = contracts.filter((c) => c.license_type === 'Subscription').length;
    const perp = contracts.filter((c) => c.license_type === 'Perpetual').length;
    const saas = contracts.filter((c) => c.deployment === 'SaaS').length;
    const onprem = contracts.filter((c) => c.deployment === 'On-premise').length;

    const actions = [];
    const overdue = withDays.filter((c) => c.days_to_renewal < 0);
    const crit = withDays.filter((c) => c.days_to_renewal >= 0 && c.days_to_renewal <= 30);
    if (overdue.length) actions.push(`Chase ${overdue.length} overdue renewal(s): ${overdue.map((c) => c.account).join(', ')}.`);
    if (crit.length) actions.push(`Fire the 30-day trigger for ${crit.length} contract(s) and prep renewal proposals.`);
    if (autoSoon.length) actions.push(`Confirm notice windows for ${autoSoon.length} auto-renewing contract(s).`);
    if (!actions.length) actions.push('No renewals inside 30 days — keep engaging SPOCs early.');

    return {
        kpis: [
            { label: 'Value under mgmt', value: fmtInr(valueUnderMgmt), hint: `${active.length} active`, color: '#22d3ee' },
            { label: 'Revenue at risk', value: fmtInr(revenueAtRisk), hint: `${atRiskList.length} renewing <=90d`, color: '#f87171' },
            { label: 'Renewals <= 90d', value: String(withDays.filter((c) => c.days_to_renewal >= -30 && c.days_to_renewal <= 90).length), hint: '30/60/90 windows', color: '#a855f7' },
            { label: 'Auto-renew exposure', value: fmtInr(autoExposure), hint: `${autoRenew.length} contracts`, color: '#818cf8' }
        ],
        bars: { title: 'Renewals by window', items: buckets.length ? buckets : [{ label: 'None <=90d', sub: '', value: 0, valueStr: 'Rs 0' }] },
        sections: [
            { title: 'Needs attention', color: '#f87171', lines: overdueOrCritical.length ? overdueOrCritical.map((c) => `${c.account} — ${c.days_to_renewal < 0 ? 'OVERDUE' : `${c.days_to_renewal}d`}, ${fmtInr(toInr(c))}${c.csm_name ? ` (${c.csm_name})` : ''}`) : ['No contract inside 30 days.'] },
            { title: 'Auto-renew watch', color: '#fbbf24', lines: autoSoon.length ? autoSoon.map((c) => `${c.account} — renews ${c.renewal_date}, notice by ${c.notice_deadline || 'n/a'}`) : ['No near-term auto-renewals.'] },
            { title: 'License & deployment', color: '#38bdf8', lines: [`${sub} subscription, ${perp} perpetual`, `${saas} SaaS, ${onprem} on-premise`] },
            { title: 'Overview', color: '#a855f7', lines: [`${fmtInr(valueUnderMgmt)} under management across ${active.length} active contracts; ${fmtInr(revenueAtRisk)} renewing within 90 days.`] }
        ],
        actions,
        generatedBy: "AURA's computed engine"
    };
}

export async function generateExecutiveSummary(records, { fx } = {}) {
    return computeAccountsSummary(records, fx);
}
