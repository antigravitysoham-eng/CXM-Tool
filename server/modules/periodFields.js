/**
 * Period scoping for the generic report/export engine.
 *
 * Every module's `records(user)` (and `exportData().rows`) is a flat list keyed
 * by a customer/record. To let a report cover only a chosen time span, we need
 * to know WHICH date field on each module's records represents "when this
 * happened". That's `PERIOD_FIELD` below — one canonical date per module.
 *
 * A few modules' `records()` return a computed aggregate rather than a row list
 * (EBRs return a coverage object); `filterByPeriod` leaves any non-array
 * untouched, so those simply ignore the range instead of breaking.
 */
export const PERIOD_FIELD = {
    accounts: 'renewal',
    contracts: 'renewal_date',
    onboarding: 'target_go_live',
    support: 'opened_at',
    training: 'session_date',
    documents: 'created_at',
    'health-checks': 'lastCheckDate',
    ebrs: 'generated_at',
    surveys: 'sent_at',
    'feature-requests': 'created_at',
    upsells: 'target_close',
    referrals: 'created_at',
    journey: 'stage_entered_at',
    comms: 'sent_at',
    events: 'starts_at'
};

export const periodFieldFor = (moduleKey) => PERIOD_FIELD[moduleKey] || null;

// Compare only the date portion — record dates may be full ISO timestamps while
// the from/to bounds are plain YYYY-MM-DD.
const dayOf = (v) => String(v).slice(0, 10);

/**
 * Keep only records whose `field` date falls within [from, to] inclusive.
 * - Non-array input (a computed summary) is returned as-is.
 * - No field or no bounds → no filtering (full dataset).
 * - A record with a blank/missing date is dropped when a range is active: it
 *   can't be placed in time, so it isn't "in this period".
 */
export function filterByPeriod(records, field, from, to) {
    if (!Array.isArray(records)) return records;
    if (!field || (!from && !to)) return records;
    const lo = from || '0000-00-00';
    const hi = to || '9999-99-99';
    return records.filter((r) => {
        const raw = r?.[field];
        if (!raw) return false;
        const d = dayOf(raw);
        return d >= lo && d <= hi;
    });
}

/**
 * Normalise ?from=&to= query params into a safe, validated period.
 * Clamps future dates to today (you can't report on time that hasn't happened)
 * and throws a 400-style error for an inverted range.
 */
export function resolvePeriod(query, moduleKey) {
    const field = periodFieldFor(moduleKey);
    const today = new Date().toISOString().slice(0, 10);
    const clean = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : '');
    let from = clean(query.from);
    let to = clean(query.to);
    // Future dates make no sense for historical records — clamp to today.
    if (from && from > today) from = today;
    if (to && to > today) to = today;
    if (from && to && from > to) {
        const err = new Error('Invalid period: "from" is after "to".');
        err.status = 400;
        throw err;
    }
    return { field, from, to, applied: Boolean(field && (from || to)), today };
}
