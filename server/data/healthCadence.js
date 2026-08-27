/**
 * Pulse — health-check cadence, driven by the support tier the customer pays for.
 *
 * The higher the tier, the more often we proactively check in:
 *   Enterprise → every 1 month · Premium → every 2 months · Standard → every 4.
 *
 * The next call is due `cadence` days after the last one; with no call on record,
 * it's due now.
 */
export const TIER_CADENCE_DAYS = { Enterprise: 30, Premium: 60, Standard: 120 };
export const DEFAULT_CADENCE_DAYS = 120; // treat an unknown tier as Standard

export const HEALTH_SIGNALS = ['Green', 'Amber', 'Red'];
export const HEALTH_SENTIMENTS = ['Positive', 'Neutral', 'Negative'];
export const ACTION_STATUSES = ['Open', 'Done', 'Carried'];

export function cadenceForTier(tier) {
    return TIER_CADENCE_DAYS[tier] || DEFAULT_CADENCE_DAYS;
}

// A crude but useful signal score, so trend and portfolio health can be ranked.
export const SIGNAL_SCORE = { Green: 0, Amber: 1, Red: 2, Unknown: 1 };
