import { createContext, useContext } from 'react';

// A global reporting period the whole platform reads from. `from`/`to` are
// plain YYYY-MM-DD strings ('' means open-ended). `preset` remembers which
// quick-pick produced the current range so the UI can highlight it.

export const DATE_PRESETS = [
    { key: 'all', label: 'All time' },
    { key: 'month', label: 'This month' },
    { key: 'quarter', label: 'This quarter' },
    { key: 'year', label: 'This year' },
    { key: 'custom', label: 'Custom' }
];

export const todayISO = () => new Date().toISOString().slice(0, 10);
const iso = (d) => d.toISOString().slice(0, 10);

// Turn a preset key into a concrete { from, to }. `to` is always today — you
// can't report on the future.
export function rangeForPreset(key) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    switch (key) {
        case 'month': return { from: iso(new Date(y, m, 1)), to: todayISO() };
        case 'quarter': return { from: iso(new Date(y, Math.floor(m / 3) * 3, 1)), to: todayISO() };
        case 'year': return { from: iso(new Date(y, 0, 1)), to: todayISO() };
        case 'all':
        default: return { from: '', to: '' };
    }
}

export const DateRangeContext = createContext({
    from: '',
    to: '',
    preset: 'all',
    active: false,
    label: 'All time',
    setPreset: () => {},
    setFrom: () => {},
    setTo: () => {},
    clear: () => {}
});

export const useDateRange = () => useContext(DateRangeContext);
