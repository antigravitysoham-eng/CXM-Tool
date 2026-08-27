// Client mirror of server/services/revenueService.js — keep the two in sync.
// Time-apportioned revenue: recognise only the share of an account's value that
// falls inside the selected date range. See the server file for the full model.

const DAY_MS = 86400000;
export const MONTH_MS = (365.25 / 12) * DAY_MS;

export function isRangeActive(period = {}) {
    return !!(period && (period.from || period.to));
}

const parse = (d) => { const t = Date.parse(d); return Number.isNaN(t) ? null : t; };

export function overlapMonths({ engagement_start, value_basis = 'Annual', term_months = 12 } = {}, period = {}) {
    const s = parse(engagement_start);
    if (s === null) return null;
    const isTotal = value_basis === 'Total';
    const term = Math.max(1, Number(term_months) || 12);
    const winEnd = isTotal ? s + term * MONTH_MS : Infinity;
    const rFrom = period.from ? parse(period.from) : s;
    const rTo = period.to ? parse(period.to) : Date.now();
    if (rFrom === null || rTo === null) return null;
    const lo = Math.max(s, rFrom);
    const hi = Math.min(winEnd, rTo);
    if (!(hi > lo)) return 0;
    return (hi - lo) / MONTH_MS;
}

/** Pro-rated value in the same units as valueAmount for the given period. */
export function proratedAmount(valueAmount, acc = {}, period = {}) {
    const value = Number(valueAmount) || 0;
    if (!value) return 0;
    if (!isRangeActive(period)) return value;
    const months = overlapMonths(acc, period);
    if (months === null) return value;
    const isTotal = acc.value_basis === 'Total';
    const term = Math.max(1, Number(acc.term_months) || 12);
    const monthly = isTotal ? value / term : value / 12;
    return monthly * months;
}
