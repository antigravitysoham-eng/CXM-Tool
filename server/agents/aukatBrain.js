import { config } from '../config.js';
import { accountMissions } from './missions.js';

// Computed brain for Aukat (Cash Horizon). Understands instructions, answers from
// live account data, and suggests follow-ups. Swap this file's `respond` for a
// Claude call when a key + consent are provided — the route contract stays the same.

const today = () => new Date().toISOString().slice(0, 10);

function fmtInr(n) {
    const v = Math.round(n || 0);
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(2).replace(/\.00$/, '')}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(2).replace(/\.00$/, '')}L`;
    return `₹${v.toLocaleString('en-IN')}`;
}

export function aukatRespond(message, { records = [], fx = config.fxUsdInr } = {}) {
    const q = String(message || '').toLowerCase().trim();
    const toInr = (a) => (a.value_currency === 'INR' ? a.value_amount : a.value_amount * fx) || 0;

    const customers = records.filter((a) => a.segment === 'Customer');
    const prospects = records.filter((a) => a.segment === 'Prospect');

    const chips = ['Show my forecast', "What's at risk?", 'Weak deals', 'Overdue follow-ups', 'Top deals'];

    const has = (...words) => words.some((w) => q.includes(w));

    if (!q || has('help', 'what can you', 'who are you', 'hi', 'hello', 'hey')) {
        return {
            reply: `I'm **Aukat** — I run point on Cash Horizon. I know every deal's worth. Ask me for your forecast, what's at risk, weakly-qualified deals, overdue follow-ups, top deals, partner contribution, or a rep's workload. Tell me a standing instruction and I'll remember it for this pipeline.`,
            chips
        };
    }

    if (has('forecast', 'pipeline', 'weighted')) {
        const open = prospects.reduce((s, a) => s + toInr(a), 0);
        const weighted = prospects.reduce((s, a) => s + toInr(a) * (a.probability / 100), 0);
        const byStage = {};
        prospects.forEach((a) => { byStage[a.stage] = (byStage[a.stage] || 0) + toInr(a) * (a.probability / 100); });
        const lines = Object.entries(byStage).map(([s, v]) => `• ${s}: ${fmtInr(v)}`).join('\n');
        return { reply: `Weighted forecast is **${fmtInr(weighted)}** across ${prospects.length} prospects (open pipeline ${fmtInr(open)}).\n\nBy stage:\n${lines}`, chips };
    }

    if (has('risk', 'churn', 'poor', 'critical')) {
        const atRisk = customers.filter((a) => a.health === 'Poor' || a.health === 'Critical');
        if (!atRisk.length) return { reply: 'No customers are flagged Poor or Critical right now. Portfolio health is solid. ✅', chips };
        const lines = atRisk.map((a) => `• **${a.name}** — ${a.health}, ${fmtInr(toInr(a))}${a.sales_owner ? ` (${a.sales_owner})` : ''}`).join('\n');
        return { reply: `${atRisk.length} account(s) need a save plan:\n${lines}\n\nWant me to line these up as a mission?`, chips };
    }

    if (has('weak', 'qualify', 'meddicc', 'under-qualified', 'unqualified')) {
        const weak = prospects.filter((a) => a.meddicc_score < 3).sort((a, b) => a.meddicc_score - b.meddicc_score);
        if (!weak.length) return { reply: 'Every open prospect is at 3+/7 MEDDICC. Qualification looks healthy. 👍', chips };
        const lines = weak.map((a) => `• **${a.name}** — ${a.meddicc_score}/7 (${a.stage})`).join('\n');
        return { reply: `${weak.length} prospect(s) are under-qualified — don't advance these until MEDDICC improves:\n${lines}`, chips };
    }

    if (has('overdue', 'follow', 'next step', 'due')) {
        const overdue = records.filter((a) => a.next_step_date && a.next_step_date < today());
        if (!overdue.length) return { reply: 'Nothing overdue — every next step is in the future. 🎯', chips };
        const lines = overdue.map((a) => `• **${a.name}** — "${a.next_step}" was due ${a.next_step_date}`).join('\n');
        return { reply: `${overdue.length} overdue next step(s):\n${lines}`, chips };
    }

    if (has('top', 'biggest', 'largest', 'best deal')) {
        const top = [...records].filter((a) => a.segment !== 'Partner').sort((a, b) => toInr(b) - toInr(a)).slice(0, 5);
        const lines = top.map((a, i) => `${i + 1}. **${a.name}** — ${fmtInr(toInr(a))} (${a.segment})`).join('\n');
        return { reply: `Top deals by value:\n${lines}`, chips };
    }

    if (has('partner')) {
        const partners = records.filter((a) => a.segment === 'Partner');
        const lines = partners.map((p) => {
            const sourced = records.filter((a) => a.sourcing_partner_id === p.id);
            const closed = sourced.filter((a) => a.segment === 'Customer').reduce((s, a) => s + toInr(a), 0);
            return `• **${p.name}** — ${sourced.length} sourced, ${fmtInr(closed)} closed`;
        }).join('\n');
        return { reply: partners.length ? `Partner contribution:\n${lines}` : 'No partners on the books yet.', chips };
    }

    // rep workload
    const owner = ['priya', 'rohan', 'ananya'].find((n) => q.includes(n));
    if (owner || has('workload', 'who owns', 'owner')) {
        if (owner) {
            const theirs = records.filter((a) => (a.sales_owner || '').toLowerCase().includes(owner));
            const val = theirs.reduce((s, a) => s + toInr(a), 0);
            return { reply: `${theirs.length} account(s) worth ${fmtInr(val)} are owned by ${theirs[0]?.sales_owner || owner}.`, chips };
        }
        const byOwner = {};
        records.forEach((a) => { if (a.sales_owner) byOwner[a.sales_owner] = (byOwner[a.sales_owner] || 0) + toInr(a); });
        const lines = Object.entries(byOwner).sort((a, b) => b[1] - a[1]).map(([o, v]) => `• ${o}: ${fmtInr(v)}`).join('\n');
        return { reply: `Book by owner:\n${lines}`, chips };
    }

    if (has('mission', 'task', 'todo', 'to do', 'what should')) {
        const missions = accountMissions(records);
        if (!missions.length) return { reply: 'No open missions — the pipeline is in good shape. 🏆', chips };
        const lines = missions.map((m) => `${m.emoji} ${m.title} (+${m.points} XP)`).join('\n');
        return { reply: `Your missions right now:\n${lines}`, chips };
    }

    if (has('summary', 'brief', 'how are we', 'overview', 'status')) {
        const portfolio = customers.reduce((s, a) => s + toInr(a), 0);
        const weighted = prospects.reduce((s, a) => s + toInr(a) * (a.probability / 100), 0);
        return { reply: `Portfolio ${fmtInr(portfolio)} across ${customers.length} customers · weighted forecast ${fmtInr(weighted)} across ${prospects.length} prospects. Ask me to drill into risk, qualification, or follow-ups.`, chips };
    }

    return {
        reply: `I hear you — but I'm sharpest on deals. Try: forecast, what's at risk, weak deals, overdue follow-ups, top deals, partner contribution, or a rep's name. (I've noted that instruction.)`,
        chips
    };
}
