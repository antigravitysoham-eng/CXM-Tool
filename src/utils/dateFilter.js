// Client-side period filtering for KPI cards + tables. The backend scopes the
// downloadable reports precisely; on-screen metrics filter the already-loaded
// rows by the same date field so what you see matches what you'd download.

const dayOf = (v) => (v ? String(v).slice(0, 10) : '');

/**
 * Is `dateStr` within [from, to] inclusive? Blank bounds are open-ended, so an
 * empty range (all-time) passes everything. A blank/missing date is EXCLUDED
 * only when a range is active — it can't be placed in the period.
 */
export function withinRange(dateStr, from, to) {
    if (!from && !to) return true;
    const d = dayOf(dateStr);
    if (!d) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
}

/** Filter a list of records by one date field against the range. */
export function filterByRange(list, field, from, to) {
    if (!Array.isArray(list) || (!from && !to) || !field) return list;
    return list.filter((r) => withinRange(r?.[field], from, to));
}
