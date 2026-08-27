// Timeline filtering for stage boards/tables: "entered stage between X–Y" and
// "in stage ≥ N days", applied client-side over already-loaded records.

export const emptyStageFilter = { enteredFrom: '', enteredTo: '', minDays: '' };

export const stageFilterActive = (f) => !!(f && (f.enteredFrom || f.enteredTo || f.minDays));

/**
 * Does a record pass the stage-timeline filter?
 * - enteredFrom/enteredTo bound the stage-entered date (inclusive; a record with
 *   no entered date is excluded once a date bound is set).
 * - minDays keeps only records that have sat in their stage at least that long.
 * Field names are configurable because some modules use `days_in_stage` and some
 * use `daysInStage`.
 */
export function matchStageTimeline(rec, filter, { enteredField = 'stage_entered_at', daysField = 'days_in_stage' } = {}) {
    if (!stageFilterActive(filter)) return true;
    const { enteredFrom, enteredTo, minDays } = filter;
    if (enteredFrom || enteredTo) {
        const raw = rec?.[enteredField];
        const d = raw ? String(raw).slice(0, 10) : '';
        if (!d) return false;
        if (enteredFrom && d < enteredFrom) return false;
        if (enteredTo && d > enteredTo) return false;
    }
    if (minDays) {
        const days = rec?.[daysField];
        if (days == null || days < Number(minDays)) return false;
    }
    return true;
}
