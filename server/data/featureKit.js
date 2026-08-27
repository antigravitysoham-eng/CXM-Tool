/**
 * Forge — feature-request pipeline scoring.
 *
 * The roadmap should follow real customer pull, so each request carries a
 * RICE-style score: reach (supporters + votes) x impact / effort. Higher =
 * more customer value per unit of build.
 */
export const FEATURE_STATUSES = ['Requested', 'Under review', 'Planned', 'In progress', 'Shipped', 'Declined'];
export const IMPACTS = ['Low', 'Medium', 'High', 'Critical'];
export const EFFORTS = ['S', 'M', 'L', 'XL'];
export const PRODUCT_AREAS = ['Platform', 'Interno', 'Conformity', 'Vendor Pulse', 'Zak Services', 'AgentCtl', 'Integrations', 'Reporting'];

const IMPACT_WEIGHT = { Low: 1, Medium: 2, High: 4, Critical: 8 };
const EFFORT_WEIGHT = { S: 1, M: 2, L: 4, XL: 8 };

// Open statuses still competing for roadmap space.
export const OPEN_STATUSES = ['Requested', 'Under review', 'Planned', 'In progress'];

export function riceScore({ supporters = 0, votes = 0, impact = 'Medium', effort = 'M' }) {
    const reach = supporters + votes + 1; // +1: the raising customer
    return Math.round((reach * (IMPACT_WEIGHT[impact] || 2)) / (EFFORT_WEIGHT[effort] || 2) * 10) / 10;
}
