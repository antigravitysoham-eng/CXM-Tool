/**
 * Pulse — the Health Checks specialist.
 *
 * Reads the per-customer customer-health rollup (tier cadence, next-due, latest
 * signal, open actionables) and answers the questions a CS lead asks: who's
 * overdue a call, who's turning red, and what's still open from the last one.
 */

const plural = (n, s, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;

export function pulseRespond(message, { health = [] } = {}) {
    const q = String(message || '').toLowerCase().trim();
    const has = (...w) => w.some((x) => q.includes(x));
    const chips = ['Who is overdue a check?', 'Who is turning red?', 'What’s worsening?', 'Open actionables'];

    if (!health.length) {
        return { reply: 'No customers to health-check yet. Once accounts go live I’ll cadence calls by their support tier — Enterprise monthly, Premium every 2 months, Standard every 4 — and flag anyone slipping.', chips };
    }

    const overdue = health.filter((h) => h.overdue);
    const red = health.filter((h) => h.currentSignal === 'Red');
    const amber = health.filter((h) => h.currentSignal === 'Amber');
    const worsening = health.filter((h) => h.trend < 0);
    const openActions = health.reduce((s, h) => s + h.openActions, 0);

    // ---- overdue calls ----
    if (has('overdue', 'due', 'cadence', 'schedule', 'call', 'behind')) {
        if (!overdue.length) return { reply: `Everyone is inside their cadence — no health checks are overdue. ${plural(amber.length + red.length, 'account')} to keep an eye on.`, chips };
        const lines = overdue.slice(0, 8).map((h) => `• **${h.account}** (${h.tier}, every ${h.cadenceDays}d) — ${h.lastCheckDate ? `${Math.abs(h.daysToNext)}d overdue` : 'never checked'}, last signal ${h.currentSignal}`);
        return { reply: `${plural(overdue.length, 'account')} overdue a health check:\n\n${lines.join('\n')}\n\nThe higher the tier, the tighter the cadence — an overdue Enterprise account is the one to call first.`, chips };
    }

    // ---- red / at risk ----
    if (has('red', 'risk', 'churn', 'unhappy', 'negative', 'bad')) {
        if (!red.length && !amber.length) return { reply: 'Nobody is red or amber right now — the book is green. Ask me who’s overdue a check to stay ahead of it.', chips };
        const lines = [...red, ...amber].slice(0, 8).map((h) => `• **${h.account}** — ${h.currentSignal}${h.sentiment ? ` / ${h.sentiment}` : ''}${h.openActions ? `, ${plural(h.openActions, 'open action')}` : ''}`);
        return { reply: `${plural(red.length, 'red account')}${amber.length ? `, ${plural(amber.length, 'amber')}` : ''}:\n\n${lines.join('\n')}\n\n${red.length ? 'Red = renewal risk. Build a save plan and consider pulling an EBR forward.' : ''}`, chips };
    }

    // ---- worsening trend ----
    if (has('worsen', 'declin', 'slipping', 'trend', 'getting worse', 'downhill')) {
        if (!worsening.length) return { reply: 'No account got worse since its previous check. Signals are holding or improving.', chips };
        const lines = worsening.slice(0, 8).map((h) => `• **${h.account}** — now ${h.currentSignal}`);
        return { reply: `${plural(worsening.length, 'account')} worse than last check:\n\n${lines.join('\n')}\n\nThe summary from the last call is where the reason is — read it before the next one.`, chips };
    }

    // ---- open actionables ----
    if (has('action', 'actionable', 'follow up', 'follow-up', 'carried', 'todo', 'open item')) {
        const withOpen = health.filter((h) => h.openActions > 0).sort((a, b) => b.openActions - a.openActions);
        if (!withOpen.length) return { reply: 'No open actionables — everything agreed on the last calls is closed.', chips };
        const lines = withOpen.slice(0, 8).map((h) => `• **${h.account}** — ${plural(h.openActions, 'open action')}`);
        return { reply: `${plural(openActions, 'actionable')} still open across ${plural(withOpen.length, 'account')}:\n\n${lines.join('\n')}\n\nOpen actions carry forward to the next call automatically — but carrying isn’t closing.`, chips };
    }

    // ---- one account ----
    const named = health.find((h) => q.includes(h.account.toLowerCase()));
    if (named) {
        return {
            reply: `**${named.account}** (${named.tier} · every ${named.cadenceDays}d) — signal **${named.currentSignal}**${named.sentiment ? ` (${named.sentiment})` : ''}.\n\n`
                + (named.lastCheckDate ? `Last checked ${named.lastCheckDate}; next due ${named.nextDueDate}${named.overdue ? ` (**${Math.abs(named.daysToNext)}d overdue**)` : ` (in ${named.daysToNext}d)`}.` : 'Never health-checked — due now.')
                + (named.openActions ? ` ${plural(named.openActions, 'open action')}.` : '')
                + (named.lastSummary ? `\n\nLast summary: “${named.lastSummary.slice(0, 160)}${named.lastSummary.length > 160 ? '…' : ''}”` : ''),
            chips
        };
    }

    // ---- default brief ----
    return {
        reply: `${plural(health.length, 'customer')} on the health board: ${red.length} red, ${amber.length} amber, ${health.length - red.length - amber.length} green.`
            + (overdue.length ? ` **${plural(overdue.length, 'call')} overdue.**` : ' All calls inside cadence.')
            + (openActions ? ` ${plural(openActions, 'open actionable')}.` : '')
            + `\n\nAsk me who’s overdue a check, who’s turning red, what’s worsening, or about a specific account.`,
        chips
    };
}

/** Concrete outreach work, from the health board. */
export function healthMissions(health = []) {
    const overdue = health.filter((h) => h.overdue);
    const overdueEnt = overdue.filter((h) => h.tier === 'Enterprise');
    const red = health.filter((h) => h.currentSignal === 'Red');
    const worsening = health.filter((h) => h.trend < 0);
    const withOpen = health.filter((h) => h.openActions > 0);

    const missions = [];
    if (overdueEnt.length) {
        missions.push({ id: 'call_overdue_ent', emoji: '📞', title: `Call ${plural(overdueEnt.length, 'overdue Enterprise account')}`, detail: 'Highest tier, tightest cadence, past due', points: 45, target: overdueEnt.length, accounts: overdueEnt.map((h) => h.account) });
    }
    if (overdue.length) {
        missions.push({ id: 'call_overdue', emoji: '⏰', title: `Schedule ${plural(overdue.length, 'overdue health check')}`, detail: 'Past its tier cadence', points: 35, target: overdue.length, accounts: overdue.map((h) => h.account) });
    }
    if (red.length) {
        missions.push({ id: 'save_red', emoji: '🚑', title: `Build save plans for ${plural(red.length, 'red account')}`, detail: 'Signal is red — renewal risk', points: 50, target: red.length, accounts: red.map((h) => h.account) });
    }
    if (worsening.length) {
        missions.push({ id: 'catch_worsening', emoji: '📉', title: `Get ahead of ${plural(worsening.length, 'worsening account')}`, detail: 'Signal dropped since the last check', points: 40, target: worsening.length, accounts: worsening.map((h) => h.account) });
    }
    if (withOpen.length) {
        missions.push({ id: 'close_actions', emoji: '✅', title: `Close ${plural(withOpen.reduce((s, h) => s + h.openActions, 0), 'open actionable')}`, detail: 'Carried from prior calls', points: 25, target: withOpen.length, accounts: withOpen.map((h) => h.account) });
    }
    return missions;
}
