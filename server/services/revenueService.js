// Time-apportioned (pro-rated) revenue recognition.
//
// An account's Value Amount is either a per-year run-rate (basis 'Annual') or the
// whole-term amount of a fixed deal (basis 'Total', spread over `term_months`).
// Given a selected date range [from,to], we recognise only the share of that value
// which falls inside the range:
//
//   monthly rate = basis === 'Total' ? value / term_months : value / 12
//   recognised   = monthly rate × (months of the engagement window inside [from,to])
//
// The engagement window starts at `engagement_start`. For 'Total' it ends at
// start + term_months (nothing after the term). For 'Annual' it is open-ended
// (an ongoing subscription), so the range's own `to` bounds it.
//
// Rules:
//  • No range active (All time) → return the full value (annual run-rate as entered).
//  • No engagement_start → cannot pro-rate → return the full value (never understate
//    legacy rows that predate this field).
//  • Pipeline/prospect values are NOT pro-rated by callers — this models recognised
//    revenue of engaged accounts, not open-pipeline forecasts.

const DAY_MS = 86400000;
// Average month length (365.25 / 12 days) so a full year of overlap = 12 months and
// a full N-month term recognises exactly the whole Total.
export const MONTH_MS = (365.25 / 12) * DAY_MS;

/** Is a date range actually constraining anything? */
export function isRangeActive(period = {}) {
    return !!(period && (period.from || period.to));
}

const parse = (d) => { const t = Date.parse(d); return Number.isNaN(t) ? null : t; };

/**
 * Fractional months of the engagement window that fall inside [from,to].
 * Returns null when it cannot be computed (no start), so callers fall back to full.
 */
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

/**
 * Pro-rated value (same currency/units as `valueAmount`) for the given period.
 * `acc` supplies engagement_start / value_basis / term_months.
 */
export function proratedAmount(valueAmount, acc = {}, period = {}) {
    const value = Number(valueAmount) || 0;
    if (!value) return 0;
    if (!isRangeActive(period)) return value;        // All time → full run-rate
    const months = overlapMonths(acc, period);
    if (months === null) return value;               // no start → cannot pro-rate
    const isTotal = acc.value_basis === 'Total';
    const term = Math.max(1, Number(acc.term_months) || 12);
    const monthly = isTotal ? value / term : value / 12;
    return monthly * months;
}
