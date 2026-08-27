/**
 * Ringmaster — the customer-events specialist.
 *
 * Works off the events stats and answers: what's coming up, how's attendance,
 * and which events need filling.
 */

const plural = (n, s, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;

export function ringmasterRespond(message, { eventStats = null } = {}) {
    const q = String(message || '').toLowerCase().trim();
    const has = (...w) => w.some((x) => q.includes(x));
    const chips = ['What is coming up?', 'Attendance rate', 'Registrations', 'By type'];

    if (!eventStats || !eventStats.events) {
        return { reply: 'No events yet. Schedule a webinar, workshop or roundtable and I’ll track registrations and attendance so nothing runs half-empty.', chips };
    }
    const s = eventStats;

    if (has('coming', 'upcoming', 'next', 'schedule', 'planned')) {
        if (!s.next.length) return { reply: `No upcoming events — ${s.completed} completed. Time to put something on the calendar.`, chips };
        const lines = s.next.map((e) => `• **${e.title}** (${e.account})${e.starts_at ? ` — ${e.starts_at}` : ''} · ${e.registered}${e.capacity ? `/${e.capacity}` : ''} registered`);
        return { reply: `Coming up (${plural(s.upcoming, 'event')}):\n\n${lines.join('\n')}\n\nFill them early — an under-registered event a week out rarely recovers.`, chips };
    }
    if (has('attend', 'turnout', 'show up', 'rate')) {
        return { reply: `Average attendance **${s.avgAttendanceRate === null ? 'n/a' : `${s.avgAttendanceRate}%`}** across ${plural(s.completed, 'completed event')}. ${s.totalAttended} of ${s.totalRegistered} registered actually attended.`, chips };
    }
    if (has('registration', 'registered', 'signup', 'sign up')) {
        return { reply: `${s.totalRegistered} total registrations across ${plural(s.events, 'event')}; ${plural(s.upcoming, 'still upcoming')}.`, chips };
    }
    if (has('type', 'kind', 'format', 'breakdown')) {
        const lines = Object.entries(s.byType).map(([k, v]) => `• ${k}: ${plural(v, 'event')}`);
        return { reply: `By type:\n\n${lines.join('\n')}`, chips };
    }

    return {
        reply: `${plural(s.events, 'event')}: ${s.upcoming} upcoming, ${s.completed} completed. ${s.totalRegistered} registrations, ${s.avgAttendanceRate === null ? 'n/a' : `${s.avgAttendanceRate}%`} average attendance.`
            + `\n\nAsk me what’s coming up, the attendance rate, or the type breakdown.`,
        chips
    };
}

export function eventMissions(eventStats = null) {
    if (!eventStats || !eventStats.events) return [];
    const missions = [];
    const underfilled = eventStats.next.filter((e) => e.capacity && e.registered / e.capacity < 0.5);
    if (underfilled.length) missions.push({ id: 'fill_events', emoji: '🎪', title: `Fill ${plural(underfilled.length, 'under-registered event')}`, detail: 'Under 50% of capacity', points: 30, target: underfilled.length, accounts: underfilled.map((e) => e.account) });
    if (eventStats.upcoming) missions.push({ id: 'promote_upcoming', emoji: '📣', title: `Promote ${plural(eventStats.upcoming, 'upcoming event')}`, detail: 'Drive registrations', points: 20, target: eventStats.upcoming });
    return missions;
}
