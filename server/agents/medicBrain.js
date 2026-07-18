/**
 * Medic — the Support specialist.
 *
 * Reads live tickets, already carrying their derived SLA state, and answers the
 * questions a support lead actually asks: what's breached, what's about to
 * breach, what's unowned, and how are we doing against the tier promise. Same
 * Claude-pluggable seam as the other brains.
 */

const plural = (n, s, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;

export function medicRespond(message, { tickets = [] } = {}) {
    const q = String(message || '').toLowerCase().trim();
    const has = (...w) => w.some((x) => q.includes(x));
    const chips = ["What's breaching SLA?", 'What’s at risk?', 'Unassigned tickets', 'How’s our SLA attainment?'];

    if (!tickets.length) {
        return {
            reply: 'No tickets on the board. When a customer raises one, I’ll hold it to their tier’s SLA — response and resolution — and flag anything about to slip.',
            chips
        };
    }

    const open = tickets.filter((t) => !t.resolved);
    const breached = tickets.filter((t) => t.breached);
    const atRisk = open.filter((t) => t.at_risk);
    const unassigned = open.filter((t) => !t.assignee);
    const resolved = tickets.filter((t) => t.resolved);

    // ---- breaches ----
    if (has('breach', 'breaching', 'broke', 'missed', 'over sla', 'past sla')) {
        if (!breached.length) return { reply: `Nothing has breached SLA. ${plural(open.length, 'ticket')} open, all still inside their tier’s clock.`, chips };
        const lines = breached.slice(0, 8).map((t) => {
            const which = t.response_breached && t.resolution_breached ? 'response + resolution'
                : t.response_breached ? 'response' : 'resolution';
            return `• **${t.account}** — *${t.subject}* (${t.priority}/${t.support_tier}) — ${which} SLA missed`;
        });
        return { reply: `${plural(breached.length, 'ticket')} past SLA:\n\n${lines.join('\n')}\n\nThe tier is the promise — a Standard account breaching is bad; a Premium or Enterprise one breaching is a renewal risk.`, chips };
    }

    // ---- at risk ----
    if (has('risk', 'about to', 'soon', 'nearly', 'close to')) {
        if (!atRisk.length) return { reply: 'Nothing is inside the danger zone right now. Ask me what’s breached, or what’s unassigned.', chips };
        const lines = atRisk.slice(0, 8).map((t) => `• **${t.account}** — *${t.subject}* (${t.priority}/${t.support_tier}) — past 75% of its resolution window`);
        return { reply: `${plural(atRisk.length, 'ticket')} about to breach:\n\n${lines.join('\n')}\n\nGrab these before they flip red.`, chips };
    }

    // ---- unassigned ----
    if (has('unassigned', 'nobody', 'no owner', 'unowned', 'assign')) {
        if (!unassigned.length) return { reply: 'Every open ticket has an owner. Good — nothing is sitting unlooked-at.', chips };
        const lines = unassigned.slice(0, 8).map((t) => `• **${t.account}** — *${t.subject}* (${t.priority}/${t.support_tier})`);
        return { reply: `${plural(unassigned.length, 'ticket')} with no owner:\n\n${lines.join('\n')}\n\nAssign each one — an unowned Urgent is how a breach sneaks up.`, chips };
    }

    // ---- SLA attainment ----
    if (has('attainment', 'sla', 'how are we', 'performance', 'doing', 'stats', 'metrics')) {
        const met = resolved.filter((t) => !t.breached).length;
        const pct = resolved.length ? Math.round((met / resolved.length) * 100) : null;
        return {
            reply: pct === null
                ? 'Nothing resolved yet, so there’s no attainment to report. Ask me what’s open or breaching.'
                : `SLA attainment: **${pct}%** — ${met} of ${resolved.length} resolved tickets met both the response and resolution promise.\n\n${plural(open.length, 'ticket')} still open${breached.length ? `, ${breached.length} already breached` : ''}${atRisk.length ? `, ${atRisk.length} at risk` : ''}.`,
            chips
        };
    }

    // ---- one account ----
    const named = tickets.find((t) => q.includes(t.account.toLowerCase()));
    if (named) {
        const acctTickets = tickets.filter((t) => t.account === named.account);
        const acctOpen = acctTickets.filter((t) => !t.resolved);
        const acctBreached = acctTickets.filter((t) => t.breached);
        return {
            reply: `**${named.account}** (${named.support_tier} tier) — ${plural(acctTickets.length, 'ticket')}, ${acctOpen.length} open`
                + (acctBreached.length ? `, ⚠️ ${acctBreached.length} breaching SLA` : ', all inside SLA')
                + `.\n\nMost pressing: ${acctOpen[0] ? `*${acctOpen[0].subject}* (${acctOpen[0].priority})` : 'nothing open'}.`,
            chips
        };
    }

    // ---- default brief ----
    return {
        reply: `${plural(open.length, 'open ticket')}.`
            + (breached.length ? ` **${breached.length} breaching SLA.**` : ' None breached.')
            + (atRisk.length ? ` ${atRisk.length} at risk.` : '')
            + (unassigned.length ? ` ${unassigned.length} unassigned.` : '')
            + `\n\nAsk me what’s breaching, what’s at risk, what’s unassigned, or how our SLA attainment looks.`,
        chips
    };
}

/** Concrete triage work, computed from the live board. */
export function supportMissions(tickets = []) {
    const open = tickets.filter((t) => !t.resolved);
    const breached = tickets.filter((t) => t.breached);
    const atRisk = open.filter((t) => t.at_risk);
    const unassigned = open.filter((t) => !t.assignee);
    const urgentOpen = open.filter((t) => t.priority === 'Urgent');
    const premiumBreached = breached.filter((t) => t.support_tier !== 'Standard');

    const missions = [];
    if (breached.length) {
        missions.push({
            id: 'clear_breaches', emoji: '🚑',
            title: `Recover ${plural(breached.length, 'breached ticket')}`,
            detail: 'Past the tier’s SLA — resolve and follow up',
            points: 45, target: breached.length, accounts: [...new Set(breached.map((t) => t.account))]
        });
    }
    if (premiumBreached.length) {
        missions.push({
            id: 'premium_breach', emoji: '💔',
            title: `Save ${plural(premiumBreached.length, 'premium/enterprise breach')}`,
            detail: 'A paid-up tier missed its promise — renewal risk',
            points: 50, target: premiumBreached.length, accounts: [...new Set(premiumBreached.map((t) => t.account))]
        });
    }
    if (atRisk.length) {
        missions.push({
            id: 'catch_at_risk', emoji: '⏱️',
            title: `Catch ${plural(atRisk.length, 'ticket')} before they breach`,
            detail: 'Past 75% of the resolution window',
            points: 35, target: atRisk.length, accounts: [...new Set(atRisk.map((t) => t.account))]
        });
    }
    if (unassigned.length) {
        missions.push({
            id: 'assign_tickets', emoji: '🧑‍⚕️',
            title: `Assign ${plural(unassigned.length, 'unowned ticket')}`,
            detail: 'Nobody is on it yet',
            points: 25, target: unassigned.length, accounts: [...new Set(unassigned.map((t) => t.account))]
        });
    }
    if (urgentOpen.length) {
        missions.push({
            id: 'triage_urgent', emoji: '🔴',
            title: `Triage ${plural(urgentOpen.length, 'urgent ticket')}`,
            detail: 'Highest priority, still open',
            points: 30, target: urgentOpen.length, accounts: [...new Set(urgentOpen.map((t) => t.account))]
        });
    }
    return missions;
}
