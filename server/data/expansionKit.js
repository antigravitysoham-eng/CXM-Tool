/**
 * Rainmaker — expansion-pipeline stages and stage-implied probabilities.
 *
 * Weighted forecast = value x probability. Moving a deal to a later stage bumps
 * its default probability, so the forecast reflects momentum.
 */
export const EXPANSION_TYPES = ['Upsell', 'Cross-sell', 'Seat expansion', 'Tier upgrade', 'Add-on module'];
export const EXPANSION_STAGES = ['Identified', 'Qualified', 'Proposed', 'Negotiation', 'Won', 'Lost'];
export const OPEN_STAGES = ['Identified', 'Qualified', 'Proposed', 'Negotiation'];

export const STAGE_PROBABILITY = {
    Identified: 20, Qualified: 40, Proposed: 60, Negotiation: 80, Won: 100, Lost: 0
};

export function probabilityForStage(stage, fallback = 20) {
    return STAGE_PROBABILITY[stage] ?? fallback;
}
