/**
 * Sensei — the Training / enablement specialist.
 *
 * Reads live training sessions, already carrying their derived rates, and answers
 * the questions a CS lead asks about enablement: what's stalling, who's
 * under-trained, and how the certification funnel looks. Same Claude-pluggable
 * seam as the other brains.
 */

const plural = (n, s, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;

const fmtInr = (n) => {
    const v = Math.round(Number(n) || 0);
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(2).replace(/\.00$/, '')}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(2).replace(/\.00$/, '')}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
    return `₹${v}`;
};

export function senseiRespond(message, { sessions = [], revenue = null, courseCount = 0 } = {}) {
    const q = String(message || '').toLowerCase().trim();
    const has = (...w) => w.some((x) => q.includes(x));
    const chips = ['Training revenue?', 'Who is under-trained?', 'Certification funnel', 'What’s stalling?'];

    // ---- training revenue (its own cash flow) ----
    if (revenue && has('revenue', 'money', 'arr', 'mrr', 'cash', 'subscription', 'collected', 'pending', 'billing', 'earning')) {
        if (!revenue.bookings) return { reply: 'No training revenue yet — training bills once a customer subscribes and enrolls seats. Reach the Training onboarding stage to activate it.', chips };
        const top = Object.entries(revenue.byModule || {}).sort((a, b) => b[1] - a[1])[0];
        return {
            reply: `Training is a separate cash flow: **${fmtInr(revenue.bookings)}** booked, **${fmtInr(revenue.arr)}** ARR (${fmtInr(revenue.mrr)} MRR) across ${plural(revenue.activeSubscriptions, 'active subscription')}.\n\n`
                + `Collected **${fmtInr(revenue.collected)}**, **${fmtInr(revenue.pending)}** still pending.`
                + (top ? ` Biggest module: ${top[0]} (${fmtInr(top[1])}).` : '')
                + `\n\nThis is computed only from Training — never mixed into contract ARR.`,
            chips
        };
    }

    // ---- catalogue / courses ----
    if (has('course', 'catalogue', 'catalog', 'advanced', 'curriculum', 'levels')) {
        return { reply: `The catalogue has **${courseCount || 'several'}** courses, module by module on a Foundation → Intermediate → Advanced ladder. A customer sees the courses for the modules they opted for, plus the platform track.`, chips };
    }

    if (!sessions.length) {
        return {
            reply: 'No training on the board yet. Schedule a session against an account and I’ll track the funnel — enrolled, completed, certified — and flag anyone drifting.',
            chips
        };
    }

    const enrolled = sessions.reduce((s, r) => s + r.enrolled, 0);
    const completed = sessions.reduce((s, r) => s + r.completed, 0);
    const certified = sessions.reduce((s, r) => s + r.certified, 0);
    const rate = enrolled ? Math.round((completed / enrolled) * 100) : 0;
    const certRate = enrolled ? Math.round((certified / enrolled) * 100) : 0;
    const stalled = sessions.filter((r) => r.stalled);

    // Under-enabled accounts: real enrolment, weak completion.
    const byAccount = sessions.reduce((acc, r) => {
        const a = acc[r.account] || { enrolled: 0, completed: 0 };
        a.enrolled += r.enrolled; a.completed += r.completed; acc[r.account] = a; return acc;
    }, {});
    const under = Object.entries(byAccount)
        .filter(([, v]) => v.enrolled >= 5 && (v.completed / v.enrolled) < 0.5)
        .map(([name, v]) => ({ name, rate: Math.round((v.completed / v.enrolled) * 100) }));

    // ---- stalling ----
    if (has('stall', 'stuck', 'slip', 'behind', 'delayed', 'drift')) {
        if (!stalled.length) return { reply: `Nothing is stalled. ${plural(sessions.filter((s) => s.status !== 'Completed').length, 'session')} in flight, all with learners progressing.`, chips };
        const lines = stalled.slice(0, 8).map((r) => `• **${r.account}** — *${r.title}* (${r.enrolled} enrolled, 0 completed, ${r.status})`);
        return { reply: `${plural(stalled.length, 'session')} stalled — enrolled but nobody finishing:\n\n${lines.join('\n')}\n\nA session people signed up for and abandoned is worse than one never run.`, chips };
    }

    // ---- under-trained accounts ----
    if (has('under', 'weak', 'risk', 'who', 'behind on training', 'low completion')) {
        if (!under.length) return { reply: 'No account is dangerously under-trained — every account with real enrolment is over 50% complete.', chips };
        const lines = under.slice(0, 8).map((a) => `• **${a.name}** — only ${a.rate}% of enrolled learners completed`);
        return { reply: `${plural(under.length, 'account')} under-enabled:\n\n${lines.join('\n')}\n\nUnder-trained accounts open more support tickets and churn harder — worth a nudge.`, chips };
    }

    // ---- certification / funnel ----
    if (has('certif', 'funnel', 'master', 'pipeline')) {
        return {
            reply: `Certification funnel: **${enrolled}** enrolled → **${completed}** completed (${rate}%) → **${certified}** certified (${certRate}%).`
                + (certRate < rate - 20 ? '\n\nA lot complete but don’t certify — the last step is where they’re dropping.' : ''),
            chips
        };
    }

    // ---- completion rate ----
    if (has('completion', 'rate', 'progress', 'how are we', 'doing', 'stats')) {
        return {
            reply: `Overall completion is **${rate}%** across ${plural(sessions.length, 'session')} (${completed}/${enrolled} learners).`
                + (stalled.length ? ` ${plural(stalled.length, 'session')} stalled.` : '')
                + (under.length ? ` ${plural(under.length, 'account')} under-enabled.` : ''),
            chips
        };
    }

    // ---- one account ----
    const named = sessions.find((r) => q.includes(r.account.toLowerCase()));
    if (named) {
        const acct = sessions.filter((r) => r.account === named.account);
        const e = acct.reduce((s, r) => s + r.enrolled, 0);
        const c = acct.reduce((s, r) => s + r.completed, 0);
        return {
            reply: `**${named.account}** — ${plural(acct.length, 'session')}, ${e ? Math.round((c / e) * 100) : 0}% completion (${c}/${e} learners).\n\nMost recent: *${acct[0].title}* (${acct[0].status}).`,
            chips
        };
    }

    // ---- default brief ----
    return {
        reply: `${plural(sessions.length, 'training session')}, **${rate}%** overall completion, ${certified} certified.`
            + (stalled.length ? ` ${plural(stalled.length, 'session')} stalled.` : ' Nothing stalled.')
            + (under.length ? ` ${plural(under.length, 'account')} under-enabled.` : '')
            + `\n\nAsk me what’s stalling, who’s under-trained, or how the certification funnel looks.`,
        chips
    };
}

/** Concrete enablement work, computed from the live board. */
export function trainingMissions(sessions = []) {
    const stalled = sessions.filter((r) => r.stalled);
    const scheduled = sessions.filter((r) => r.status === 'Scheduled');
    const completedNoCert = sessions.filter((r) => r.status === 'Completed' && r.completed > 0 && r.certified < r.completed);

    const byAccount = sessions.reduce((acc, r) => {
        const a = acc[r.account] || { enrolled: 0, completed: 0 };
        a.enrolled += r.enrolled; a.completed += r.completed; acc[r.account] = a; return acc;
    }, {});
    const under = Object.entries(byAccount)
        .filter(([, v]) => v.enrolled >= 5 && (v.completed / v.enrolled) < 0.5)
        .map(([name]) => name);

    const missions = [];
    if (stalled.length) {
        missions.push({
            id: 'restart_stalled', emoji: '🥋',
            title: `Restart ${plural(stalled.length, 'stalled session')}`,
            detail: 'Enrolled but nobody has completed',
            points: 35, target: stalled.length, accounts: [...new Set(stalled.map((r) => r.account))]
        });
    }
    if (under.length) {
        missions.push({
            id: 'enable_under', emoji: '📚',
            title: `Enable ${plural(under.length, 'under-trained account')}`,
            detail: 'Under 50% completion — a churn + support-load risk',
            points: 40, target: under.length, accounts: under
        });
    }
    if (completedNoCert.length) {
        missions.push({
            id: 'push_cert', emoji: '🎓',
            title: `Certify learners in ${plural(completedNoCert.length, 'finished session')}`,
            detail: 'Completed the course but never certified',
            points: 25, target: completedNoCert.length, accounts: [...new Set(completedNoCert.map((r) => r.account))]
        });
    }
    if (scheduled.length) {
        missions.push({
            id: 'run_scheduled', emoji: '📅',
            title: `Run ${plural(scheduled.length, 'scheduled session')}`,
            detail: 'Booked, not yet started',
            points: 20, target: scheduled.length, accounts: [...new Set(scheduled.map((r) => r.account))]
        });
    }
    return missions;
}
