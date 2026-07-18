/**
 * Rainmaker — the expansion-revenue specialist.
 *
 * Works off the expansion pipeline stats and answers the revenue questions:
 * what's the weighted forecast, what should I chase, and what's the win rate.
 */

const plural = (n, s, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;
const fmtInr = (n) => {
    const v = Math.round(Number(n) || 0);
    if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
    if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
    if (v >= 1e3) return `₹${(v / 1e3).toFixed(1)}k`;
    return `₹${v}`;
};

export function rainmakerRespond(message, { expansionStats = null } = {}) {
    const q = String(message || '').toLowerCase().trim();
    const has = (...w) => w.some((x) => q.includes(x));
    const chips = ['Weighted forecast', 'What should I chase?', 'Win rate', 'Pipeline by stage'];

    if (!expansionStats || !expansionStats.opportunities) {
        return { reply: 'No expansion opportunities logged yet. Add upsell, cross-sell, seat or tier deals and I’ll weight the forecast by probability and tell you which to chase first.', chips };
    }
    const s = expansionStats;

    if (has('forecast', 'weighted', 'pipeline value', 'value', 'revenue')) {
        return { reply: `Open pipeline **${fmtInr(s.openValueInr)}** across ${plural(s.open, 'deal')}; weighted forecast **${fmtInr(s.weightedForecastInr)}**. Won so far ${fmtInr(s.wonInr)}.`, chips };
    }
    if (has('chase', 'priorit', 'focus', 'top', 'best')) {
        if (!s.topDeals.length) return { reply: 'No open deals to chase — everything is won or lost. Time to source new expansion.', chips };
        const lines = s.topDeals.map((d) => `• **${d.title}** (${d.account}) — ${fmtInr(d.valueInr)} @ ${d.probability}% = ${fmtInr(d.weightedInr)} weighted · ${d.stage}`);
        return { reply: `Chase these — highest weighted value:\n\n${lines.join('\n')}\n\nLate-stage × high-value is where the quarter is won.`, chips };
    }
    if (has('win rate', 'won', 'lost', 'close rate', 'conversion')) {
        return { reply: `Win rate **${s.winRate === null ? 'n/a' : `${s.winRate}%`}** (${s.won} won). ${fmtInr(s.wonInr)} closed. Keep qualifying hard so the forecast stays honest.`, chips };
    }
    if (has('stage', 'funnel', 'breakdown')) {
        const lines = Object.entries(s.byStage).map(([k, v]) => `• ${k}: ${plural(v, 'deal')}`);
        return { reply: `Pipeline by stage:\n\n${lines.join('\n')}`, chips };
    }

    return {
        reply: `${plural(s.opportunities, 'expansion opportunity')}: ${s.open} open worth ${fmtInr(s.openValueInr)} (${fmtInr(s.weightedForecastInr)} weighted). Win rate ${s.winRate === null ? 'n/a' : `${s.winRate}%`}.`
            + (s.topDeals[0] ? ` Top: **${s.topDeals[0].title}** (${fmtInr(s.topDeals[0].weightedInr)} weighted).` : '')
            + `\n\nAsk me for the weighted forecast, what to chase, or the win rate.`,
        chips
    };
}

export function expansionMissions(expansionStats = null) {
    if (!expansionStats || !expansionStats.opportunities) return [];
    const missions = [];
    if (expansionStats.topDeals?.length) {
        const late = expansionStats.topDeals.filter((d) => d.stage === 'Negotiation' || d.stage === 'Proposed');
        if (late.length) missions.push({ id: 'close_late', emoji: '🏁', title: `Close ${plural(late.length, 'late-stage deal')}`, detail: 'Proposed / Negotiation — nearest to revenue', points: 45, target: late.length, accounts: late.map((d) => d.account) });
    }
    const early = expansionStats.byStage?.Identified || 0;
    if (early) missions.push({ id: 'qualify_early', emoji: '🔎', title: `Qualify ${plural(early, 'identified deal')}`, detail: 'Move them out of Identified', points: 25, target: early });
    return missions;
}
