import { createContext, useContext } from 'react';

/**
 * Context for the metric provenance popup.
 *
 * Kept out of MetricDrill.jsx so that file exports only components — mixing a
 * hook in with them breaks React Fast Refresh for the whole module.
 *
 *   open(key, label) — show the breakdown for a metric
 *   has(key)         — is that metric explainable? (cards use it to decide
 *                      whether to advertise a drill-down at all)
 */
export const DrillContext = createContext({ open: () => {}, has: () => false });

export const useMetricDrill = () => useContext(DrillContext);
