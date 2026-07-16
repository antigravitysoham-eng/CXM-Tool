// Advisory CSM-assignment engine. Builds a performance/capacity profile for each
// CSM from live data and scores fit for a new account. The recommendation is
// advisory — the CX lead always makes the final call.

const CAPACITY = 8; // target active accounts per CSM (bandwidth baseline)

// Derive each CSM's profile from the accounts they manage + their contracts.
export function computeCsmProfiles(accounts = [], contracts = []) {
    const names = new Set();
    accounts.forEach((a) => { if (a.cxm) names.add(a.cxm); });
    contracts.forEach((c) => { if (c.csm_name) names.add(c.csm_name); });

    return [...names].map((name) => {
        const myAccounts = accounts.filter((a) => a.cxm === name && a.segment === 'Customer');
        const myContracts = contracts.filter((c) => c.csm_name === name);
        const industries = [...new Set(myAccounts.map((a) => a.industry).filter(Boolean))];
        const tiers = [...new Set(myAccounts.map((a) => a.tier).filter(Boolean))];

        // Success rate: share of the CSM's customers in good health, blended with
        // the share of their contracts not overdue for renewal.
        const goodHealth = myAccounts.filter((a) => a.health === 'Good').length;
        const healthRate = myAccounts.length ? goodHealth / myAccounts.length : null;
        const onTrackContracts = myContracts.filter((c) => c.days_to_renewal === null || c.days_to_renewal >= 0).length;
        const renewalRate = myContracts.length ? onTrackContracts / myContracts.length : null;
        const parts = [healthRate, renewalRate].filter((x) => x !== null);
        const successRate = parts.length ? Math.round((parts.reduce((s, x) => s + x, 0) / parts.length) * 100) : null;

        const load = myAccounts.length;
        const bandwidth = CAPACITY - load;

        return { name, industries, tiers, load, capacity: CAPACITY, bandwidth, successRate, accountsManaged: myAccounts.length, contractsManaged: myContracts.length };
    });
}

// Rank CSMs for a target account. target = { industry, tier }.
export function recommendCsm(target, accounts = [], contracts = []) {
    const profiles = computeCsmProfiles(accounts, contracts);
    const industry = (target.industry || '').trim();
    const tier = (target.tier || '').trim();

    const scored = profiles.map((p) => {
        const reasons = [];
        let score = 0;

        // Industry expertise (highest weight)
        if (industry && p.industries.some((i) => i.toLowerCase() === industry.toLowerCase())) {
            score += 40; reasons.push(`handles ${industry} accounts`);
        } else if (industry) {
            reasons.push(`no direct ${industry} experience`);
        }

        // Account-type experience
        if (tier && p.tiers.some((t) => t.toLowerCase() === tier.toLowerCase())) {
            score += 20; reasons.push(`experienced with ${tier} accounts`);
        }

        // Success rate
        if (p.successRate !== null) {
            score += Math.round((p.successRate / 100) * 25);
            reasons.push(`${p.successRate}% success rate`);
        }

        // Bandwidth
        if (p.bandwidth > 0) {
            score += Math.min(15, p.bandwidth * 4);
            reasons.push(`bandwidth for ${p.bandwidth} more`);
        } else {
            score -= 15; reasons.push(`at capacity (${p.load}/${p.capacity})`);
        }

        return { ...p, score, reasons };
    }).sort((a, b) => b.score - a.score);

    return {
        target: { industry, tier },
        recommended: scored[0] || null,
        ranked: scored,
        note: 'Advisory only — the CX lead makes the final assignment.'
    };
}
