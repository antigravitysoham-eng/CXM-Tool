import { config } from '../config.js';

// Executive summary generator. Deterministic "computed" engine — no data leaves
// the server. generateExecutiveSummary is the seam a Claude-backed brain plugs into.

// PDF-safe currency: pdfkit's built-in fonts have no ₹ glyph, so INR uses "Rs".
function fmtInr(n) {
    const v = Math.round(n || 0);
    if (v >= 10000000) return `Rs ${(v / 10000000).toFixed(2).replace(/\.00$/, '')} Cr`;
    if (v >= 100000) return `Rs ${(v / 100000).toFixed(2).replace(/\.00$/, '')} L`;
    return `Rs ${v.toLocaleString('en-IN')}`;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export function computeAccountsSummary(records, fx = config.fxUsdInr) {
    const toInr = (a) => (a.value_currency === 'INR' ? a.value_amount : a.value_amount * fx) || 0;

    const customers = records.filter((a) => a.segment === 'Customer');
    const prospects = records.filter((a) => a.segment === 'Prospect');
    const partners = records.filter((a) => a.segment === 'Partner');

    const portfolio = customers.reduce((s, a) => s + toInr(a), 0);
    const openPipe = prospects.reduce((s, a) => s + toInr(a), 0);
    const weighted = prospects.reduce((s, a) => s + toInr(a) * (a.probability / 100), 0);
    const atRiskAccts = customers.filter((a) => a.health === 'Poor' || a.health === 'Critical');
    const weakAccts = prospects.filter((a) => a.meddicc_score < 3).sort((a, b) => a.meddicc_score - b.meddicc_score);
    const overdue = records.filter((a) => a.next_step_date && a.next_step_date < todayStr());

    // Pipeline weighted by stage (for the bar chart).
    const stageOrder = ['Lead', 'Qualified', 'POC', 'Negotiation', 'Closing'];
    const stageMap = {};
    prospects.forEach((a) => {
        stageMap[a.stage] = stageMap[a.stage] || { weighted: 0, count: 0 };
        stageMap[a.stage].weighted += toInr(a) * (a.probability / 100);
        stageMap[a.stage].count += 1;
    });
    const pipeline = stageOrder.filter((s) => stageMap[s]).map((s) => ({ stage: s, weighted: stageMap[s].weighted, count: stageMap[s].count, weightedStr: fmtInr(stageMap[s].weighted) }));

    const partnerRollup = partners.map((p) => {
        const sourced = records.filter((a) => a.sourcing_partner_id === p.id);
        const won = sourced.filter((a) => a.segment === 'Customer');
        return { name: p.name, sourced: sourced.length, closed: won.reduce((s, a) => s + toInr(a), 0) };
    }).filter((p) => p.sourced > 0).sort((a, b) => b.closed - a.closed);

    // Structured lists for the report layout.
    const attention = [
        ...atRiskAccts.map((a) => ({ name: a.name, tag: `${a.health} health`, value: fmtInr(toInr(a)), owner: a.sales_owner })),
        ...(overdue.length ? [{ name: `${overdue.length} overdue next step(s)`, tag: 'follow-up lapsed', value: '', owner: '' }] : [])
    ];
    const weak = weakAccts.map((a) => ({ name: a.name, score: a.meddicc_score, stage: a.stage }));
    const partnersOut = partnerRollup.map((p) => ({ name: p.name, sourced: p.sourced, closed: fmtInr(p.closed) }));

    const kpis = [
        { label: 'Customer portfolio', value: fmtInr(portfolio), hint: `${customers.length} customers`, color: '#22d3ee' },
        { label: 'Open pipeline', value: fmtInr(openPipe), hint: `${prospects.length} prospects`, color: '#818cf8' },
        { label: 'Weighted forecast', value: fmtInr(weighted), hint: 'value x win %', color: '#34d399' },
        { label: 'Accounts at risk', value: String(atRiskAccts.length), hint: 'Poor / Critical', color: '#f87171' }
    ];

    const actions = [];
    if (atRiskAccts.length) actions.push(`Prioritise save plans for ${atRiskAccts.length} at-risk customer(s): ${atRiskAccts.map((a) => a.name).join(', ')}.`);
    if (weakAccts.length) actions.push(`Close MEDDICC gaps on ${weakAccts.length} under-qualified prospect(s) before advancing them.`);
    if (overdue.length) actions.push(`Clear ${overdue.length} overdue next step(s) this week.`);
    if (weighted > 0) actions.push(`Weighted forecast is ${fmtInr(weighted)} across ${prospects.length} prospects — focus late-stage deals.`);
    if (!actions.length) actions.push('Portfolio is healthy — maintain cadence and pursue expansion in strong accounts.');

    const narrative =
        `The portfolio holds ${fmtInr(portfolio)} across ${customers.length} customers, with ${fmtInr(openPipe)} of open ` +
        `pipeline (${fmtInr(weighted)} weighted) across ${prospects.length} prospects. ${atRiskAccts.length} customer(s) are ` +
        `at risk and ${weakAccts.length} prospect(s) are under-qualified.`;

    return {
        kpis, actions, narrative,
        pipeline, attention, weak, partners: partnersOut,
        maxStageWeighted: Math.max(1, ...pipeline.map((p) => p.weighted)),
        generatedBy: "NEO's computed engine"
    };
}

export async function generateExecutiveSummary(records, { fx } = {}) {
    return computeAccountsSummary(records, fx);
}
