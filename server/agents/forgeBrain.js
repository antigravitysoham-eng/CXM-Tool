/**
 * Forge — the feature-request / roadmap specialist.
 *
 * Works off the demand stats and answers what a CS lead / PM asks: what's the
 * top-demanded feature, what's in flight, and what customer promises are still open.
 */

const plural = (n, s, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;

export function forgeRespond(message, { featureStats = null } = {}) {
    const q = String(message || '').toLowerCase().trim();
    const has = (...w) => w.some((x) => q.includes(x));
    const chips = ['Top-demanded features', 'What is in progress?', 'Shipped rate', 'By product area'];

    if (!featureStats || !featureStats.total) {
        return { reply: 'No feature requests logged yet. Capture what customers ask for and I’ll rank the roadmap by RICE — reach x impact over effort — so build effort follows real demand.', chips };
    }
    const s = featureStats;

    if (has('top', 'demand', 'most', 'popular', 'wanted', 'rice')) {
        const lines = s.topDemand.map((f) => `• **${f.title}** — demand ${f.demand}, RICE ${f.rice} (${f.status}) · raised by ${f.account}`);
        return { reply: `Top demand:\n\n${lines.join('\n')}\n\nRICE ranks reach x impact over effort — the top of this list is where a build dollar buys the most customer value.`, chips };
    }
    if (has('progress', 'flight', 'building', 'planned', 'pipeline', 'status')) {
        const st = s.byStatus;
        return { reply: `Pipeline: ${Object.entries(st).map(([k, v]) => `${v} ${k}`).join(' · ')}. **${s.open}** open, ${s.shipped} shipped.`, chips };
    }
    if (has('ship', 'shipped', 'closed', 'done', 'rate')) {
        return { reply: `${plural(s.shipped, 'feature')} shipped of ${s.total} (${s.shippedRate}%). ${s.declined} declined. Closing the loop back to the customers who asked turns a shipped feature into a retention moment.`, chips };
    }
    if (has('area', 'product', 'module', 'category')) {
        const lines = Object.entries(s.byArea).sort((a, b) => b[1] - a[1]).map(([k, v]) => `• ${k}: ${plural(v, 'request')}`);
        return { reply: `Requests by product area:\n\n${lines.join('\n')}\n\nA cluster in one area is a signal about where the product is straining.`, chips };
    }

    return {
        reply: `${plural(s.total, 'feature request')}: ${s.open} open, ${s.shipped} shipped (${s.shippedRate}%). Total demand ${s.totalDemand}.`
            + (s.topDemand[0] ? ` Top: **${s.topDemand[0].title}** (demand ${s.topDemand[0].demand}).` : '')
            + `\n\nAsk me for the top-demanded features, what’s in progress, or the breakdown by area.`,
        chips
    };
}

export function featureMissions(featureStats = null) {
    if (!featureStats || !featureStats.total) return [];
    const missions = [];
    const stuck = (featureStats.byStatus?.Requested || 0) + (featureStats.byStatus?.['Under review'] || 0);
    if (stuck) missions.push({ id: 'triage_features', emoji: '🔍', title: `Triage ${plural(stuck, 'unreviewed request')}`, detail: 'Requested / under review', points: 25, target: stuck });
    if (featureStats.topDemand?.length) {
        const t = featureStats.topDemand[0];
        missions.push({ id: 'promote_top', emoji: '🚀', title: `Advance top-demand: ${t.title}`, detail: `Demand ${t.demand}, RICE ${t.rice}`, points: 35, target: 1, accounts: [t.account] });
    }
    if (featureStats.byStatus?.Shipped) {
        missions.push({ id: 'close_loop', emoji: '📣', title: `Close the loop on ${plural(featureStats.byStatus.Shipped, 'shipped feature')}`, detail: 'Tell the customers who asked', points: 30, target: featureStats.byStatus.Shipped });
    }
    return missions;
}
