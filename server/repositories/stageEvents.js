/**
 * Generic stage-transition trail, shared by the entities that gained timeline
 * tracking in this pass — Feature Requests ('feature'), Upsells ('expansion')
 * and Contracts ('contract'). One `stage_events` table keyed by (entity,
 * entity_id); each row is a move with the date it landed and who moved it.
 *
 * Mirrors the Accounts template (account_stage_events): only a REAL change is
 * recorded, the parent's `stage_entered_at` is reset in step, and per-stage days
 * are the gap from one event to the next.
 */

const daysBetween = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000));
export const daysInStage = (row) => {
    const from = row?.stage_entered_at || row?.created_at;
    return from ? daysBetween(from, new Date().toISOString()) : null;
};

const actorOf = (user) => (user?.name || user?.email || '');

/** Open the trail when the record is created, so time-in-stage runs from day one. */
export async function openTrail(db, entity, id, stage, user) {
    await db.run(
        'INSERT INTO stage_events (entity, entity_id, stage, entered_at, moved_by) VALUES (?,?,?,?,?)',
        [entity, id, stage || '', new Date().toISOString(), actorOf(user)]
    );
}

/**
 * Record a move — but only a genuine one. A no-op change (re-saving the same
 * stage) must not restart the clock or spam the trail. Call AFTER the parent
 * write so a failed update leaves no orphan event. Returns the timestamp used
 * (or null when nothing changed) so the caller can stamp stage_entered_at.
 */
export async function stampChange(db, entity, id, oldStage, newStage, user) {
    if (!newStage || newStage === oldStage) return null;
    const ts = new Date().toISOString();
    await db.run(
        'INSERT INTO stage_events (entity, entity_id, stage, entered_at, moved_by) VALUES (?,?,?,?,?)',
        [entity, id, newStage, ts, actorOf(user)]
    );
    return ts;
}

/** The trail for one record, each event carrying how long that stage lasted. */
export async function history(db, entity, id) {
    const events = await db.all(
        'SELECT stage, entered_at, moved_by FROM stage_events WHERE entity = ? AND entity_id = ? ORDER BY id',
        [entity, id]
    );
    const now = new Date().toISOString();
    return events.map((e, i) => ({
        ...e,
        days: daysBetween(e.entered_at, i + 1 < events.length ? events[i + 1].entered_at : now)
    }));
}
