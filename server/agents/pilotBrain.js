/**
 * Pilot — the Onboarding specialist.
 *
 * Reads live onboardings and answers the questions a CX lead actually asks
 * mid-flight: what's slipping, who's holding it, and when does this go live.
 * Computed today, with the same Claude-pluggable seam as the other brains.
 */

const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000);

const plural = (n, s, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;

export function pilotRespond(message, { onboardings = [] } = {}) {
    const q = String(message || '').toLowerCase().trim();
    const has = (...w) => w.some((x) => q.includes(x));
    const chips = ["What's slipping?", 'Who is blocking us?', 'When does everyone go live?', 'Stage 2 progress'];

    if (!onboardings.length) {
        return {
            reply: 'Nothing is onboarding right now. Once a CX lead assigns a CSM in CLM and hits “Proceed to onboard”, I’ll track it from kickoff to live.',
            chips
        };
    }

    const live = onboardings.filter((o) => o.status === 'Live');
    const active = onboardings.filter((o) => o.status !== 'Live');
    const late = active.filter((o) => o.overdueStages > 0);
    const blocked = onboardings.filter((o) => o.status === 'Blocked');

    // ---- what's slipping ----
    if (has('slip', 'late', 'overdue', 'behind', 'at risk', 'risk')) {
        if (!late.length) return { reply: `Nothing is past due. ${plural(active.length, 'onboarding')} in flight, all inside their dates.`, chips };
        const lines = late.map((o) => {
            const over = o.daysToGoLive !== null && o.daysToGoLive < 0 ? `, go-live ${Math.abs(o.daysToGoLive)}d overdue` : '';
            return `• **${o.account}** — ${plural(o.overdueStages, 'stage')} past due at *${o.currentStage?.name || '—'}*${over} (CSM ${o.csm_name || 'unassigned'})`;
        });
        return {
            reply: `${plural(late.length, 'onboarding')} slipping:\n\n${lines.join('\n')}\n\nThe stage date is the one that was agreed at kickoff — if the plan was wrong, move the date deliberately rather than quietly running late.`,
            chips
        };
    }

    // ---- who's blocking ----
    if (has('block', 'stuck', 'waiting', 'who is holding', 'holding')) {
        if (!blocked.length) return { reply: 'Nothing is blocked. Anything late is late for other reasons — ask me what’s slipping.', chips };
        const lines = blocked.map((o) => `• **${o.account}** — blocked at *${o.currentStage?.name || '—'}* (CSM ${o.csm_name || 'unassigned'})`);
        return { reply: `${plural(blocked.length, 'onboarding')} blocked:\n\n${lines.join('\n')}`, chips };
    }

    // ---- go-live dates ----
    if (has('go live', 'go-live', 'live', 'when', 'launch', 'date')) {
        const upcoming = [...active]
            .filter((o) => o.target_go_live)
            .sort((a, b) => a.target_go_live.localeCompare(b.target_go_live));
        if (!upcoming.length) return { reply: 'No go-live dates set on the active onboardings.', chips };
        const lines = upcoming.map((o) => {
            const d = o.daysToGoLive;
            const when = d < 0 ? `**${Math.abs(d)}d overdue**` : d === 0 ? '**today**' : `in ${d}d`;
            return `• **${o.account}** — ${o.target_go_live} (${when}), ${o.progress}% done at *${o.currentStage?.name || 'complete'}*`;
        });
        return { reply: `Go-live board:\n\n${lines.join('\n')}`, chips };
    }

    // ---- one account ----
    const named = onboardings.find((o) => q.includes(o.account.toLowerCase()));
    if (named) {
        const d = named.daysToGoLive;
        const when = d === null ? 'no target set'
            : d < 0 ? `${Math.abs(d)} days past its target` : `${d} days to target`;
        return {
            reply: `**${named.account}** — ${named.status.toLowerCase()}, ${named.progress}% (${named.doneStages}/${named.stageCount} stages, ${named.doneTasks}/${named.taskCount} tasks).\n\n`
                + `Now at *${named.currentStage?.name || 'all stages complete'}*, ${when}. CSM ${named.csm_name || 'unassigned'}.`
                + (named.overdueStages ? `\n\n⚠️ ${plural(named.overdueStages, 'stage')} past due.` : ''),
            chips
        };
    }

    // ---- default brief ----
    const cycle = live
        .filter((o) => o.started_at && o.completed_at)
        .map((o) => daysBetween(o.completed_at.slice(0, 10), o.started_at.slice(0, 10)));
    const avg = cycle.length ? Math.round(cycle.reduce((a, b) => a + b, 0) / cycle.length) : null;

    return {
        reply: `${plural(active.length, 'customer')} in flight, ${live.length} live.`
            + (late.length ? ` ${plural(late.length, 'onboarding')} slipping.` : ' Nothing past due.')
            + (blocked.length ? ` ${blocked.length} blocked.` : '')
            + (avg !== null ? `\n\nAverage kickoff-to-live so far: **${avg} days**.` : '')
            + `\n\nAsk me what’s slipping, who’s blocking us, or when a customer goes live.`,
        chips
    };
}

/** Concrete work, computed from the live board. */
export function onboardingMissions(onboardings = []) {
    const active = onboardings.filter((o) => o.status !== 'Live');
    const late = active.filter((o) => o.overdueStages > 0);
    const blocked = onboardings.filter((o) => o.status === 'Blocked');
    const unassigned = active.filter((o) => !o.csm_name);
    const stalled = active.filter((o) => o.taskCount > 0 && o.doneTasks === 0);
    const nearlyThere = active.filter((o) => o.progress >= 80);

    const missions = [];
    if (late.length) {
        missions.push({
            id: 'unslip_stages', emoji: '⏰',
            title: `Pull ${plural(late.length, 'onboarding')} back on schedule`,
            detail: 'A stage is past the date agreed at kickoff',
            points: 40, target: late.length, accounts: late.map((o) => o.account)
        });
    }
    if (blocked.length) {
        missions.push({
            id: 'clear_blockers', emoji: '🚧',
            title: `Clear ${plural(blocked.length, 'blocker')}`,
            detail: 'Someone is waiting on someone else',
            points: 35, target: blocked.length, accounts: blocked.map((o) => o.account)
        });
    }
    if (unassigned.length) {
        missions.push({
            id: 'assign_csm', emoji: '🧑‍✈️',
            title: `Assign a CSM to ${plural(unassigned.length, 'onboarding')}`,
            detail: 'Nobody owns the customer through go-live',
            points: 30, target: unassigned.length, accounts: unassigned.map((o) => o.account)
        });
    }
    if (stalled.length) {
        missions.push({
            id: 'start_stalled', emoji: '🛫',
            title: `Get ${plural(stalled.length, 'onboarding')} moving`,
            detail: 'Started, but not a single task ticked yet',
            points: 25, target: stalled.length, accounts: stalled.map((o) => o.account)
        });
    }
    if (nearlyThere.length) {
        missions.push({
            id: 'land_it', emoji: '🛬',
            title: `Land ${plural(nearlyThere.length, 'customer')} — 80%+ done`,
            detail: 'Closest to live; finish the last stage',
            points: 45, target: nearlyThere.length, accounts: nearlyThere.map((o) => o.account)
        });
    }
    return missions;
}
