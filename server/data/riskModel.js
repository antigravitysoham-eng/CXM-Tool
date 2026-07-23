/**
 * Churn-risk scoring.
 *
 * This is a transparent weighted-signal model, not a trained one — every point a
 * customer scores traces back to a named factor the CSM can go and act on. That
 * matters more than accuracy here: a score nobody can explain is a score nobody
 * acts on, and the page shows the factor breakdown alongside the number.
 *
 * Weights sum to 100. Each factor returns 0..1 (how bad it is) and is multiplied
 * by its weight, so the final score reads as a percentage of the worst case.
 */

export const RISK_WEIGHTS = {
    health: 24,        // the CSM's own read on the account
    signal: 16,        // what the last health call actually sounded like
    adoption: 20,      // are they using what they pay for
    support: 14,       // load and SLA pain
    sentiment: 10,     // what their people say in surveys
    cadence: 6,        // are we even talking to them
    renewal: 10        // proximity of the decision point
};

export const RISK_BANDS = [
    { min: 70, band: 'Critical', tone: 'critical' },
    { min: 50, band: 'High', tone: 'high' },
    { min: 30, band: 'Moderate', tone: 'moderate' },
    { min: 0, band: 'Low', tone: 'low' }
];

export const bandFor = (score) => RISK_BANDS.find((b) => score >= b.min) || RISK_BANDS[RISK_BANDS.length - 1];

const HEALTH_RISK = { Critical: 1, Poor: 0.85, Average: 0.45, Good: 0.1, Excellent: 0 };
const SIGNAL_RISK = { Red: 1, Amber: 0.55, Green: 0.05, Unknown: 0.4 };

/** Clamp to 0..1 — factors are ratios, and bad inputs shouldn't blow up a score. */
const unit = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

/**
 * Score one customer.
 *
 * `input` carries only what the caller already loaded — the model does no I/O so
 * it stays cheap to run over the whole book and trivial to test.
 */
export function scoreCustomer(input) {
    const {
        health = 'Good',
        signal = 'Unknown',
        adoption = null,        // 0..100, null when never measured
        openTickets = 0,
        breachedTickets = 0,
        detractors = 0,
        responses = 0,
        overdueCheck = false,
        daysToRenewal = null,
        arrInr = 0
    } = input;

    const factors = [];
    const add = (key, label, severity, detail) => {
        const points = Math.round(unit(severity) * RISK_WEIGHTS[key]);
        if (points > 0) factors.push({ key, label, points, weight: RISK_WEIGHTS[key], detail });
        return points;
    };

    let score = 0;
    score += add('health', 'Account health', HEALTH_RISK[health] ?? 0.4, `Marked ${health}`);
    score += add('signal', 'Last health call', SIGNAL_RISK[signal] ?? 0.4, signal === 'Unknown' ? 'No call on record' : `Closed ${signal}`);

    // Adoption is the strongest leading indicator we hold: paying for seats nobody
    // opens is how a renewal quietly dies. Never-measured is treated as a mild
    // unknown rather than a zero, which would flag every new logo as critical.
    if (adoption === null) {
        score += add('adoption', 'Product adoption', 0.4, 'Never measured');
    } else {
        score += add('adoption', 'Product adoption', (100 - adoption) / 100, `${adoption}% across subscribed modules`);
    }

    // Ticket load only counts as risk above a couple of open items; every account
    // has some. Breaches are weighted far heavier than volume.
    const loadSeverity = unit(Math.max((openTickets - 2) / 8, breachedTickets / 2));
    score += add('support', 'Support pressure', loadSeverity,
        breachedTickets ? `${breachedTickets} SLA breach(es), ${openTickets} open` : `${openTickets} open ticket(s)`);

    const detractorRate = responses ? detractors / responses : 0;
    score += add('sentiment', 'Survey sentiment', unit(detractorRate), responses ? `${detractors} of ${responses} responses negative` : 'No survey responses');

    if (overdueCheck) score += add('cadence', 'Check-in cadence', 1, 'Health check overdue for their tier');

    // A renewal inside 90 days doesn't create risk on its own — it concentrates
    // whatever risk already exists, so it only scores when the date is close.
    if (daysToRenewal !== null && daysToRenewal >= 0 && daysToRenewal <= 180) {
        score += add('renewal', 'Renewal proximity', (180 - daysToRenewal) / 180, `Renews in ${daysToRenewal} day(s)`);
    }

    const rounded = Math.min(100, Math.round(score));
    const { band, tone } = bandFor(rounded);
    return {
        score: rounded,
        band,
        tone,
        arrInr: Math.round(arrInr),
        // Biggest contributor first — that is the one thing to go and fix.
        factors: factors.sort((a, b) => b.points - a.points),
        topFactor: factors.length ? factors.reduce((m, f) => (f.points > m.points ? f : m)).label : null
    };
}

/**
 * Flag a series whose latest reading breaks from its own recent history.
 *
 * Uses a z-score against the preceding months rather than a fixed threshold, so
 * a metric that is naturally spiky has to move further before it trips. Returns
 * null when there isn't enough history, or when the series simply hasn't moved.
 */
export function detectAnomaly(values, { kind = 'KPI', sigma = 1.5 } = {}) {
    if (!Array.isArray(values) || values.length < 4) return null;
    const history = values.slice(0, -1);
    const latest = values[values.length - 1];
    const mean = history.reduce((s, v) => s + v, 0) / history.length;
    const variance = history.reduce((s, v) => s + (v - mean) ** 2, 0) / history.length;
    const sd = Math.sqrt(variance);
    if (sd === 0) return null;

    const z = (latest - mean) / sd;
    if (Math.abs(z) < sigma) return null;

    // Up is good for a KPI and bad for a KRI — the direction alone doesn't say
    // whether this is worth waking someone up for.
    const rising = z > 0;
    const good = kind === 'KRI' ? !rising : rising;
    return {
        z: Math.round(z * 10) / 10,
        direction: rising ? 'up' : 'down',
        good,
        latest,
        baseline: Math.round(mean * 10) / 10,
        severity: Math.abs(z) >= 2.5 ? 'high' : 'medium'
    };
}
