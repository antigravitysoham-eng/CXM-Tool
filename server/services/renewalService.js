// Renewal intelligence: days-to-renewal, 90/60/30 trigger detection, and the
// two differently-toned emails each trigger produces (customer SPOC + internal CSM/AM).

const MS_DAY = 86400000;
const MILESTONES = [90, 60, 30];

const today = () => new Date();

export function daysToRenewal(contract) {
    const d = contract.renewal_date || contract.end_date;
    if (!d) return null;
    const t = new Date(d);
    if (Number.isNaN(t.getTime())) return null;
    return Math.ceil((t.getTime() - today().getTime()) / MS_DAY);
}

// Which 90/60/30 window a contract currently sits in (the tightest one).
export function activeMilestone(days) {
    if (days === null || days === undefined) return null;
    if (days < 0) return 'overdue';
    for (const m of [30, 60, 90]) if (days <= m) return m;
    return null;
}

export function renewalBucket(days) {
    if (days === null) return 'none';
    if (days < 0) return 'overdue';
    if (days <= 30) return 'critical';
    if (days <= 60) return 'warning';
    if (days <= 90) return 'watch';
    return 'healthy';
}

function fmt(amount, currency) {
    const n = Math.round(amount || 0);
    if (currency === 'INR') {
        if (n >= 10000000) return `₹${(n / 10000000).toFixed(2).replace(/\.00$/, '')}Cr`;
        if (n >= 100000) return `₹${(n / 100000).toFixed(2).replace(/\.00$/, '')}L`;
        return `₹${n.toLocaleString('en-IN')}`;
    }
    if (n >= 1000000) return `$${(n / 1000000).toFixed(2).replace(/\.00$/, '')}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    return `$${n}`;
}

function noticeDeadline(contract) {
    const d = contract.renewal_date || contract.end_date;
    if (!d) return '';
    const t = new Date(d);
    if (Number.isNaN(t.getTime())) return '';
    t.setDate(t.getDate() - (contract.notice_period_days || 30));
    return t.toISOString().slice(0, 10);
}

// The two emails for a milestone. Customer tone is warm; internal tone is urgent.
export function buildTriggerEmails(contract, milestone) {
    const days = daysToRenewal(contract);
    const value = fmt(contract.tcv || contract.arr, contract.currency);
    const renewal = contract.renewal_date || contract.end_date || 'the upcoming date';
    const spoc = contract.spoc_name || 'there';
    const csm = contract.csm_name || 'CSM';
    const am = contract.am_name || 'Account Manager';
    const label = milestone === 'overdue' ? 'overdue' : `${milestone}-day`;

    const customer = {
        to: contract.spoc_email || '',
        toName: contract.spoc_name || '',
        tone: 'Warm · customer-facing',
        subject: `Your ${contract.account} agreement renews on ${renewal}`,
        body:
            `Hi ${spoc},\n\n` +
            `A quick heads-up that your service agreement (${contract.id}) with us is due for renewal on ${renewal}` +
            `${days >= 0 ? `, about ${days} days away` : ' (now past due)'}.\n\n` +
            `It's been a pleasure supporting ${contract.account}, and we'd love to keep things running smoothly. ` +
            `Your customer success manager, ${csm}, will reach out shortly to walk you through renewal options` +
            `${contract.auto_renew ? ' (your plan is set to auto-renew unless you let us know otherwise)' : ''}.\n\n` +
            `If you have any questions in the meantime, just reply to this note.\n\nWarm regards,\n${csm}`
    };

    const internal = {
        to: [contract.csm_email, contract.am_email].filter(Boolean).join(', '),
        toName: `${csm} / ${am}`,
        tone: 'Direct · internal',
        subject: `[ACTION · ${label}] ${contract.account} renews in ${days} days — ${value} at risk`,
        body:
            `${csm} / ${am} —\n\n` +
            `${contract.account} (contract ${contract.id}) renews on ${renewal}, ${days} days out. This is the ${label} trigger.\n\n` +
            `• Value at risk: ${value} (${contract.billing_frequency}, ${contract.deployment})\n` +
            `• License: ${contract.license_type}${contract.perpetual_term_years ? ` (${contract.perpetual_term_years}-yr perpetual)` : ''}\n` +
            `• Auto-renew: ${contract.auto_renew ? 'YES' : 'no'} · Notice deadline: ${noticeDeadline(contract) || 'n/a'}\n` +
            `• Customer SPOC: ${contract.spoc_name || 'unknown'} (${contract.spoc_email || 'no email on file'})\n\n` +
            `Next: confirm the SPOC is engaged, prep the renewal proposal, and log the outcome. Don't let this slip.`
    };

    return { milestone, customer, internal };
}

// All contracts currently inside a 90/60/30 window (or overdue), with their emails.
export function upcomingTriggers(contracts) {
    return contracts
        .map((c) => ({ contract: c, days: daysToRenewal(c) }))
        .filter(({ days }) => days !== null && days <= 90)
        .map(({ contract, days }) => {
            const milestone = activeMilestone(days);
            return {
                contract_id: contract.id,
                account: contract.account,
                days_to_renewal: days,
                milestone,
                bucket: renewalBucket(days),
                renewal_date: contract.renewal_date || contract.end_date,
                emails: milestone ? buildTriggerEmails(contract, milestone) : null
            };
        })
        .sort((a, b) => a.days_to_renewal - b.days_to_renewal);
}

export { MILESTONES };
