/**
 * Compass — the customer-lifecycle specialist.
 *
 * Works off the journey stats / map and answers where customers sit on the
 * lifecycle, who's stalled, and who's ready to advance.
 */

const plural = (n, s, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;

export function compassRespond(message, { journeyStats = null, journeyList = [] } = {}) {
    const q = String(message || '').toLowerCase().trim();
    const has = (...w) => w.some((x) => q.includes(x));
    const chips = ['Who is stalled?', 'Lifecycle distribution', 'Who is at risk?', 'Ready to advocate'];

    if (!journeyStats || !journeyStats.customers) {
        return { reply: 'No customers to map yet. Once accounts are live I’ll place each one on the lifecycle — Onboarding → Adoption → Value → Growth → Renewal → Advocacy — and flag anyone stuck too long in a stage.', chips };
    }
    const s = journeyStats;

    if (has('stall', 'stuck', 'slow', 'too long', 'behind')) {
        const stalled = journeyList.filter((j) => j.stalled);
        if (!stalled.length) return { reply: 'Nobody is stalled — every customer is moving through their stage inside the expected window.', chips };
        const lines = stalled.slice(0, 8).map((j) => `• **${j.account}** — ${j.stage}, ${plural(j.daysInStage, 'day')} in stage`);
        return { reply: `${plural(stalled.length, 'customer')} stalled:\n\n${lines.join('\n')}\n\nA customer stuck in a stage is momentum leaking — a nudge now is cheaper than a save later.`, chips };
    }
    if (has('distribut', 'lifecycle', 'stage', 'where', 'map', 'breakdown')) {
        const lines = Object.entries(s.byStage).map(([k, v]) => `• ${k}: ${plural(v, 'customer')}`);
        return { reply: `Lifecycle distribution:\n\n${lines.join('\n')}\n\nAverage progress along the path: ${s.avgProgress}%.`, chips };
    }
    if (has('risk', 'poor', 'churn', 'unhealthy')) {
        const risky = journeyList.filter((j) => j.stage === 'At Risk' || j.health === 'Poor');
        if (!risky.length) return { reply: 'No customers at risk or in poor health on the journey map. 🎉', chips };
        const lines = risky.slice(0, 8).map((j) => `• **${j.account}** — ${j.stage} / ${j.health}`);
        return { reply: `${plural(risky.length, 'customer')} at risk or poor health:\n\n${lines.join('\n')}`, chips };
    }
    if (has('advoca', 'ready', 'promoter', 'champion')) {
        const adv = journeyList.filter((j) => j.stage === 'Advocacy');
        const growth = journeyList.filter((j) => j.stage === 'Growth' && j.health === 'Good');
        return { reply: `${plural(adv.length, 'customer')} already at Advocacy${growth.length ? `; ${plural(growth.length, 'healthy Growth-stage customer')} could be nurtured toward it` : ''}. These are your referral and case-study candidates.`, chips };
    }

    return {
        reply: `${plural(s.customers, 'customer')} on the map: ${s.stalled} stalled, ${s.atRisk} at risk, ${s.advocacy} at advocacy. Average progress ${s.avgProgress}%.`
            + `\n\nAsk me who’s stalled, the lifecycle distribution, or who’s at risk.`,
        chips
    };
}

export function journeyMissions({ journeyStats = null, journeyList = [] } = {}) {
    if (!journeyStats || !journeyStats.customers) return [];
    const missions = [];
    const stalled = journeyList.filter((j) => j.stalled);
    if (stalled.length) missions.push({ id: 'unstick', emoji: '🧭', title: `Re-engage ${plural(stalled.length, 'stalled customer')}`, detail: 'Too long in their lifecycle stage', points: 35, target: stalled.length, accounts: stalled.map((j) => j.account) });
    const risky = journeyList.filter((j) => j.stage === 'At Risk');
    if (risky.length) missions.push({ id: 'save_atrisk', emoji: '🛟', title: `Save ${plural(risky.length, 'at-risk customer')}`, detail: 'Off the happy path', points: 45, target: risky.length, accounts: risky.map((j) => j.account) });
    const unmapped = journeyStats.customers - journeyStats.mapped;
    if (unmapped > 0) missions.push({ id: 'map_customers', emoji: '📍', title: `Place ${plural(unmapped, 'customer')} on the map`, detail: 'No lifecycle stage set yet', points: 15, target: unmapped });
    return missions;
}
