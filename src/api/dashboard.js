import { api } from './client';

// Build a ?from=&to= query string, dropping empty bounds.
const periodQs = (period = {}) => {
    const s = new URLSearchParams();
    if (period.from) s.set('from', period.from);
    if (period.to) s.set('to', period.to);
    const str = s.toString();
    return str ? `?${str}` : '';
};

export const dashboardApi = {
    // Optional { from, to } pro-rates the value headlines to that date range.
    overview: (period) => api.get(`/dashboard/overview${periodQs(period)}`),
    // The rows behind one headline tile — what it means, how it is derived, and
    // which records it was read from.
    explain: (key) => api.get(`/dashboard/explain/${key}`)
};
