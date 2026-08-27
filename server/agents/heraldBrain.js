/**
 * Herald — the customer-communications specialist.
 *
 * Works off the comms stats and answers: what's our engagement, what's going
 * out, and which messages landed.
 */

const plural = (n, s, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;

export function heraldRespond(message, { commsStats = null } = {}) {
    const q = String(message || '').toLowerCase().trim();
    const has = (...w) => w.some((x) => q.includes(x));
    const chips = ['Open + click rates', 'What is scheduled?', 'By channel', 'How many sent?'];

    if (!commsStats || !commsStats.campaigns) {
        return { reply: 'No communications yet. Draft a customer email or newsletter and I’ll track how many opened and clicked, so you know which messages actually land.', chips };
    }
    const s = commsStats;

    if (has('open', 'click', 'engage', 'rate', 'read')) {
        return { reply: `Average open rate **${s.avgOpenRate === null ? 'n/a' : `${s.avgOpenRate}%`}**, click rate **${s.avgClickRate === null ? 'n/a' : `${s.avgClickRate}%`}** across ${plural(s.sent, 'sent campaign')} to ${s.totalRecipients} recipients.`, chips };
    }
    if (has('schedule', 'draft', 'pending', 'going out', 'upcoming')) {
        return { reply: `${plural(s.scheduled, 'scheduled campaign')} and ${plural(s.drafts, 'draft')} in the pipeline. ${s.sent} already sent.`, chips };
    }
    if (has('channel', 'type', 'breakdown', 'email', 'newsletter')) {
        const lines = Object.entries(s.byType).map(([k, v]) => `• ${k}: ${plural(v, 'campaign')}`);
        return { reply: `By channel:\n\n${lines.join('\n')}`, chips };
    }
    if (has('sent', 'how many', 'total', 'recipients')) {
        return { reply: `${plural(s.sent, 'campaign')} sent to ${s.totalRecipients} recipients in total.`, chips };
    }

    return {
        reply: `${plural(s.campaigns, 'comm campaign')}: ${s.sent} sent, ${s.scheduled} scheduled, ${s.drafts} draft. Open rate ${s.avgOpenRate === null ? 'n/a' : `${s.avgOpenRate}%`}, click rate ${s.avgClickRate === null ? 'n/a' : `${s.avgClickRate}%`}.`
            + `\n\nAsk me about open/click rates, what’s scheduled, or the channel breakdown.`,
        chips
    };
}

export function commsMissions(commsStats = null) {
    if (!commsStats || !commsStats.campaigns) return [];
    const missions = [];
    if (commsStats.scheduled) missions.push({ id: 'send_scheduled', emoji: '📤', title: `Ship ${plural(commsStats.scheduled, 'scheduled comm')}`, detail: 'Queued to go out', points: 20, target: commsStats.scheduled });
    if (commsStats.avgOpenRate !== null && commsStats.avgOpenRate < 30 && commsStats.sent) {
        missions.push({ id: 'improve_open', emoji: '✉️', title: 'Lift a low open rate', detail: `Avg open ${commsStats.avgOpenRate}% — test subject lines`, points: 25, target: 1 });
    }
    return missions;
}
