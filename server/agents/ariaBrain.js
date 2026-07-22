/**
 * Aria — the Executive Business Review specialist.
 *
 * Works off the quarterly coverage board (who has an EBR this quarter, who's
 * been shared with) and answers the questions a CS lead asks before a QBR
 * cycle: who still needs a review generated, who hasn't had it shared, and
 * what a given account's review says.
 */

const plural = (n, s, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;

export function ariaRespond(message, { ebrCoverage = null } = {}) {
    const q = String(message || '').toLowerCase().trim();
    const has = (...w) => w.some((x) => q.includes(x));
    const chips = ['Who still needs an EBR?', 'What’s not shared yet?', 'This quarter’s coverage', 'Generate the quarter'];

    if (!ebrCoverage || !ebrCoverage.customers) {
        return { reply: 'No customers to review yet. Once accounts go live I’ll build each one a quarterly Executive Business Review from the platform’s own data — ARR, support, enablement and customer-health — and track that every customer gets one, every quarter.', chips };
    }

    const c = ebrCoverage;
    const notStarted = c.rows.filter((r) => r.status === 'Not started');
    const pending = c.rows.filter((r) => r.id && r.status !== 'Shared');

    if (has('need', 'missing', 'not started', 'generate', 'left', 'remaining', 'who still')) {
        if (!notStarted.length) return { reply: `Every customer has an EBR generated for ${c.quarterLabel} (${c.generated}/${c.customers}). ${c.pendingShare ? `${plural(c.pendingShare, 'is')} still waiting to be shared.` : 'All shared.'}`, chips };
        const lines = notStarted.slice(0, 10).map((r) => `• **${r.account}**`);
        return { reply: `${plural(notStarted.length, 'customer')} still need${notStarted.length === 1 ? 's' : ''} a ${c.quarterLabel} EBR:\n\n${lines.join('\n')}\n\nRun “generate the quarter” to build them all from platform data in one pass.`, chips };
    }

    if (has('shared', 'not shared', 'deliver', 'send', 'pending')) {
        if (!pending.length) return { reply: `Nothing pending — every generated EBR for ${c.quarterLabel} has been shared (${c.shared}/${c.generated}).`, chips };
        const lines = pending.slice(0, 10).map((r) => `• **${r.account}** — ${r.status}${r.signal ? ` · ${r.signal}` : ''}`);
        return { reply: `${plural(pending.length, 'EBR')} generated but not yet shared:\n\n${lines.join('\n')}\n\nEBRs are a quarterly commitment — the value only lands once the customer sees it.`, chips };
    }

    if (has('coverage', 'quarter', 'status', 'summary', 'overview', 'how are we')) {
        return {
            reply: `**${c.quarterLabel} EBR coverage** — ${c.generated}/${c.customers} generated, ${c.shared} shared, ${c.pendingShare} awaiting share, ${c.notStarted} not started.\n\n`
                + (c.notStarted ? `Start with the ${plural(c.notStarted, 'customer')} that have nothing yet.` : c.pendingShare ? `Everyone has a draft — the job now is sharing the ${plural(c.pendingShare, 'pending one')}.` : 'Fully covered and shared for the quarter. 🎯'),
            chips
        };
    }

    // one account
    const named = c.rows.find((r) => q.includes(r.account.toLowerCase()));
    if (named) {
        return {
            reply: `**${named.account}** — ${c.quarterLabel}: ${named.status === 'Not started' ? 'no EBR generated yet.' : `EBR ${named.status.toLowerCase()}${named.signal ? `, customer-health ${named.signal}` : ''}.`}`
                + (named.arrInr ? ` ARR on file.` : '')
                + (named.status === 'Not started' ? ' Generate it from the account’s platform data.' : named.status !== 'Shared' ? ' Share it with the customer to close the loop.' : ''),
            chips
        };
    }

    return {
        reply: `${c.quarterLabel}: ${c.generated} of ${c.customers} customers have an EBR, ${c.shared} shared. `
            + (c.notStarted ? `${plural(c.notStarted, 'customer')} still to start.` : 'All generated.')
            + `\n\nAsk me who still needs one, what’s not shared, or about a specific account.`,
        chips
    };
}

/** Concrete review work, from the coverage board. */
export function ebrMissions(ebrCoverage = null) {
    if (!ebrCoverage || !ebrCoverage.rows) return [];
    const notStarted = ebrCoverage.rows.filter((r) => r.status === 'Not started');
    const pending = ebrCoverage.rows.filter((r) => r.id && r.status !== 'Shared');
    const redUnshared = pending.filter((r) => r.signal === 'Red');

    const missions = [];
    if (notStarted.length) {
        missions.push({ id: 'generate_ebrs', emoji: '📊', title: `Generate ${plural(notStarted.length, 'EBR')} for ${ebrCoverage.quarterLabel}`, detail: 'Customers with no review this quarter', points: 35, target: notStarted.length, accounts: notStarted.map((r) => r.account) });
    }
    if (redUnshared.length) {
        missions.push({ id: 'share_red_ebrs', emoji: '🚑', title: `Review + share ${plural(redUnshared.length, 'at-risk EBR')}`, detail: 'Red customer-health, review not shared', points: 45, target: redUnshared.length, accounts: redUnshared.map((r) => r.account) });
    }
    if (pending.length) {
        missions.push({ id: 'share_ebrs', emoji: '📤', title: `Share ${plural(pending.length, 'pending EBR')} with customers`, detail: 'Generated but not yet delivered', points: 30, target: pending.length, accounts: pending.map((r) => r.account) });
    }
    return missions;
}
