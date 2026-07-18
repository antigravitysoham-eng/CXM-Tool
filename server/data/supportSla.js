/**
 * Support SLAs — the support tier's actual job.
 *
 * A customer pays for a tier; the tier is a promise about how fast we answer and
 * how fast we resolve, and it bends by how bad the ticket is. This table is that
 * promise, in hours. Everything else in the module (breach, at-risk, attainment)
 * is derived from it, so the SLA lives in exactly one place.
 *
 * Hours are calendar hours, deliberately — a simple, auditable clock. Business-
 * hours calendars are a later refinement; when they land, they land here.
 */

// tier → priority → { response, resolution } in hours.
export const SLA_MATRIX = {
    Enterprise: {
        Urgent: { response: 1, resolution: 8 },
        High: { response: 2, resolution: 24 },
        Normal: { response: 4, resolution: 72 },
        Low: { response: 8, resolution: 120 }
    },
    Premium: {
        Urgent: { response: 2, resolution: 12 },
        High: { response: 4, resolution: 48 },
        Normal: { response: 8, resolution: 120 },
        Low: { response: 24, resolution: 240 }
    },
    Standard: {
        Urgent: { response: 4, resolution: 24 },
        High: { response: 8, resolution: 72 },
        Normal: { response: 24, resolution: 240 },
        Low: { response: 48, resolution: 480 }
    }
};

const DEFAULT_TIER = 'Standard';
const DEFAULT_PRIORITY = 'Normal';

// The agreed target for a (tier, priority), always resolving to something real.
export function slaTarget(tier, priority) {
    const t = SLA_MATRIX[tier] || SLA_MATRIX[DEFAULT_TIER];
    return t[priority] || t[DEFAULT_PRIORITY];
}

const HOUR = 3600000;
const addHours = (iso, hrs) => new Date(new Date(iso).getTime() + hrs * HOUR);
const hoursBetween = (a, b) => (new Date(a).getTime() - new Date(b).getTime()) / HOUR;

const RESOLVED = new Set(['Resolved', 'Closed']);
// A ticket waiting on the customer isn't ours to move — the resolution clock is
// paused for it, so it can't breach while the ball is in their court.
const CLOCK_PAUSED = new Set(['Waiting on Customer']);

/**
 * Derive the live SLA state of one ticket against its tier's promise.
 * `now` is injectable so tests are deterministic and the same call is reusable
 * for both list rows and stats.
 */
export function deriveSla(ticket, now = new Date()) {
    const nowMs = new Date(now).getTime();
    const tier = ticket.support_tier || DEFAULT_TIER;
    const priority = ticket.priority || DEFAULT_PRIORITY;
    const target = slaTarget(tier, priority);
    const opened = ticket.opened_at || ticket.created_at;

    const responded = !!ticket.first_response_at;
    const resolved = RESOLVED.has(ticket.status) || !!ticket.resolved_at;
    const paused = CLOCK_PAUSED.has(ticket.status);

    const responseDue = opened ? addHours(opened, target.response) : null;
    const resolutionDue = opened ? addHours(opened, target.resolution) : null;

    // Response breach: measured at first response if we answered, else against now.
    const responseBreached = responseDue
        ? (responded ? new Date(ticket.first_response_at) > responseDue : nowMs > responseDue.getTime())
        : false;

    // Resolution breach: measured at resolution if closed, else against now —
    // unless the clock is paused on the customer.
    const resolutionBreached = resolutionDue
        ? (resolved
            ? new Date(ticket.resolved_at || ticket.updated_at) > resolutionDue
            : (!paused && nowMs > resolutionDue.getTime()))
        : false;

    // At risk: still open, not yet breached, past 75% of the resolution window.
    const elapsedFrac = (resolutionDue && opened && !resolved && !paused)
        ? hoursBetween(now, opened) / target.resolution
        : 0;
    const atRisk = !resolved && !resolutionBreached && elapsedFrac >= 0.75;

    return {
        tier,
        sla_response_hours: target.response,
        sla_resolution_hours: target.resolution,
        response_due: responseDue ? responseDue.toISOString() : null,
        resolution_due: resolutionDue ? resolutionDue.toISOString() : null,
        responded,
        resolved,
        paused,
        response_breached: responseBreached,
        resolution_breached: resolutionBreached,
        breached: responseBreached || resolutionBreached,
        at_risk: atRisk,
        // Actuals, for attainment/averages — only when the milestone happened.
        response_hours_actual: responded && opened ? round1(hoursBetween(ticket.first_response_at, opened)) : null,
        resolution_hours_actual: resolved && opened && ticket.resolved_at ? round1(hoursBetween(ticket.resolved_at, opened)) : null
    };
}

const round1 = (n) => Math.round(n * 10) / 10;
