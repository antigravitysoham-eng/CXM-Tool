/**
 * Magnet — the referral / advocacy specialist.
 *
 * Works off the referral stats + advocate leaderboard and answers: who's
 * referring, what's converting, and which rewards are owed.
 */

const plural = (n, s, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;
const fmtInr = (n) => {
    const v = Math.round(Number(n) || 0);
    if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
    if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
    if (v >= 1e3) return `₹${(v / 1e3).toFixed(1)}k`;
    return `₹${v}`;
};

export function magnetRespond(message, { referralStats = null, advocates = [] } = {}) {
    const q = String(message || '').toLowerCase().trim();
    const has = (...w) => w.some((x) => q.includes(x));
    const chips = ['Top advocates', 'Conversion rate', 'Rewards owed', 'Referral pipeline'];

    if (!referralStats || !referralStats.total) {
        return { reply: 'No referrals yet. Ask your happiest customers (the NPS promoters) for an introduction and I’ll track every one from lead to converted, and flag the rewards you owe.', chips };
    }
    const s = referralStats;

    if (has('advocate', 'top', 'referrer', 'who', 'champion')) {
        if (!advocates.length) return { reply: 'No advocates yet — no customer has made a referral.', chips };
        const lines = advocates.slice(0, 8).map((a) => `• **${a.account}** — ${plural(a.referrals, 'referral')}, ${a.converted} converted (${fmtInr(a.valueInr)})`);
        return { reply: `Top advocates:\n\n${lines.join('\n')}\n\nA converting advocate is your cheapest acquisition channel — keep them close.`, chips };
    }
    if (has('conversion', 'convert', 'rate', 'won')) {
        return { reply: `${s.converted} of ${s.total} referrals converted (${s.conversionRate === null ? 'n/a' : `${s.conversionRate}%`}), worth ${fmtInr(s.convertedValueInr)}. ${plural(s.open, 'lead')} still open.`, chips };
    }
    if (has('reward', 'owe', 'owed', 'pay', 'credit')) {
        if (!s.rewardsOwed) return { reply: 'No rewards outstanding — every converted referral’s reward is settled.', chips };
        return { reply: `**${plural(s.rewardsOwed, 'reward')}** owed to advocates for converted referrals. Paying promptly is what keeps the referral engine running.`, chips };
    }
    if (has('pipeline', 'value', 'referred', 'open')) {
        return { reply: `${plural(s.total, 'referral')}, ${s.open} open, worth ${fmtInr(s.referredValueInr)} in referred pipeline. ${s.converted} converted.`, chips };
    }

    return {
        reply: `${plural(s.total, 'referral')} from ${plural(s.advocates, 'advocate')}: ${s.converted} converted (${s.conversionRate === null ? 'n/a' : `${s.conversionRate}%`}), ${fmtInr(s.referredValueInr)} referred pipeline.`
            + (s.rewardsOwed ? ` **${plural(s.rewardsOwed, 'reward')} owed.**` : '')
            + `\n\nAsk me for the top advocates, the conversion rate, or rewards owed.`,
        chips
    };
}

export function referralMissions({ referralStats = null, advocates = [] } = {}) {
    if (!referralStats || !referralStats.total) return [];
    const missions = [];
    if (referralStats.open) missions.push({ id: 'work_referrals', emoji: '🤝', title: `Work ${plural(referralStats.open, 'open referral')}`, detail: 'New / contacted / qualified leads', points: 30, target: referralStats.open });
    if (referralStats.rewardsOwed) missions.push({ id: 'pay_rewards', emoji: '🎁', title: `Settle ${plural(referralStats.rewardsOwed, 'advocate reward')}`, detail: 'Owed on converted referrals', points: 25, target: referralStats.rewardsOwed });
    if (advocates.length) {
        const top = advocates[0];
        missions.push({ id: 'thank_advocate', emoji: '⭐', title: `Thank your top advocate: ${top.account}`, detail: `${top.converted} converted referrals`, points: 20, target: 1, accounts: [top.account] });
    }
    return missions;
}
