/**
 * Echo — the voice-of-customer specialist.
 *
 * Works off the survey stats + detractor list and answers what a CS lead asks
 * about sentiment: what's our NPS, who are the detractors, and what's the follow-up.
 */

const plural = (n, s, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;

export function echoRespond(message, { surveyStats = null, detractors = [] } = {}) {
    const q = String(message || '').toLowerCase().trim();
    const has = (...w) => w.some((x) => q.includes(x));
    const chips = ['What is our NPS?', 'Who are the detractors?', 'Response rate', 'Sentiment breakdown'];

    if (!surveyStats || !surveyStats.campaigns) {
        return { reply: 'No surveys out yet. Launch an NPS or CSAT campaign and I’ll turn the responses into a single sentiment score and flag every detractor to follow up.', chips };
    }
    const s = surveyStats;

    if (has('nps', 'csat', 'ces', 'score', 'sentiment')) {
        const parts = [];
        if (s.nps !== null) parts.push(`NPS **${s.nps}**`);
        if (s.csat !== null) parts.push(`CSAT **${s.csat}%**`);
        if (s.ces !== null) parts.push(`CES **${s.ces}** effort`);
        return { reply: `${parts.length ? parts.join(' · ') : 'No scored responses yet'}. Sentiment: ${s.sentiments.Positive || 0} positive, ${s.sentiments.Neutral || 0} neutral, ${s.sentiments.Negative || 0} negative across ${plural(s.responses, 'response')}.`, chips };
    }

    if (has('detractor', 'unhappy', 'negative', 'follow up', 'risk', 'churn')) {
        if (!detractors.length) return { reply: 'No detractors right now — every scored response is neutral or better. 🎉', chips };
        const lines = detractors.slice(0, 8).map((d) => `• **${d.account}**${d.respondent ? ` (${d.respondent})` : ''} — scored ${d.score}${d.comment ? `: “${d.comment.slice(0, 90)}”` : ''}`);
        return { reply: `${plural(detractors.length, 'detractor')} to follow up:\n\n${lines.join('\n')}\n\nA detractor comment answered fast is a save; ignored, it’s a churn signal.`, chips };
    }

    if (has('response rate', 'rate', 'participation', 'responses')) {
        return { reply: `${plural(s.responses, 'response')} across ${plural(s.campaigns, 'campaign')} (${s.live} live). Response rate ${s.responseRate === null ? 'n/a' : `${s.responseRate}%`}.`, chips };
    }

    return {
        reply: `${plural(s.campaigns, 'survey campaign')}, ${s.live} live. `
            + (s.nps !== null ? `NPS **${s.nps}**. ` : '')
            + (s.detractors ? `**${plural(s.detractors, 'detractor')}** to follow up. ` : 'No detractors. ')
            + `\n\nAsk me for the NPS, the detractors, or the response rate.`,
        chips
    };
}

export function surveyMissions({ surveyStats = null, detractors = [] } = {}) {
    if (!surveyStats) return [];
    const missions = [];
    if (detractors.length) {
        const accts = [...new Set(detractors.map((d) => d.account))];
        missions.push({ id: 'follow_detractors', emoji: '🎯', title: `Follow up ${plural(detractors.length, 'detractor')}`, detail: 'Negative survey responses', points: 40, target: detractors.length, accounts: accts });
    }
    if (surveyStats.campaigns && !surveyStats.responses) {
        missions.push({ id: 'chase_responses', emoji: '📨', title: 'Chase survey responses', detail: 'Campaigns out, nothing back yet', points: 20, target: surveyStats.live });
    }
    return missions;
}
