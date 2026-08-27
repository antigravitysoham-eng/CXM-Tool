import { api } from './client';

// Build a ?from=&to= query string, dropping empty bounds.
const periodQs = (period = {}) => {
    const s = new URLSearchParams();
    if (period.from) s.set('from', period.from);
    if (period.to) s.set('to', period.to);
    const str = s.toString();
    return str ? `?${str}` : '';
};

// People-performance scorecards. Admin-only on the server (403 otherwise).
// An optional { from, to } pro-rates the value figures to that date range.
export const performanceApi = {
    csm: (period) => api.get(`/performance/csm${periodQs(period)}`),
    accountManagers: (period) => api.get(`/performance/account-managers${periodQs(period)}`),
    partners: (period) => api.get(`/performance/partners${periodQs(period)}`),
    partnerManagers: (period) => api.get(`/performance/partner-managers${periodQs(period)}`)
};
