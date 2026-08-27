/**
 * Harvey — quarterly cadence for Executive Business Reviews.
 *
 * EBRs run once per calendar quarter and are shared with every customer. A
 * quarter is keyed `YYYY-Qn` (e.g. `2026-Q3`) so it sorts and compares as a
 * plain string, and labelled `Qn YYYY` for display.
 */

export const EBR_STATUSES = ['Draft', 'Generated', 'Shared'];

const quarterOf = (month0) => Math.floor(month0 / 3) + 1; // month0 = 0..11

/** The quarter key for a date (default: today). */
export function quarterKey(date = new Date()) {
    return `${date.getFullYear()}-Q${quarterOf(date.getMonth())}`;
}

/** 'Q3 2026' from a '2026-Q3' key. */
export function quarterLabel(key) {
    const [y, q] = String(key).split('-');
    return `${q} ${y}`;
}

/** First and last calendar day (ISO yyyy-mm-dd) of a quarter key. */
export function quarterRange(key) {
    const [y, q] = String(key).split('-');
    const year = Number(y);
    const qn = Number(q.replace('Q', ''));
    const startMonth = (qn - 1) * 3;
    const start = new Date(Date.UTC(year, startMonth, 1));
    const end = new Date(Date.UTC(year, startMonth + 3, 0));
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/** The current quarter, then the N-1 before it, newest first. */
export function recentQuarters(n = 4, from = new Date()) {
    const out = [];
    let year = from.getFullYear();
    let qn = quarterOf(from.getMonth());
    for (let i = 0; i < n; i++) {
        out.push(`${year}-Q${qn}`);
        qn -= 1;
        if (qn < 1) { qn = 4; year -= 1; }
    }
    return out;
}

export function currentQuarter(from = new Date()) {
    return quarterKey(from);
}
