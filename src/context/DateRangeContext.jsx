import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DateRangeContext, rangeForPreset, todayISO } from './dateRange';

const KEY = 'dateRange';

const load = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (saved && typeof saved === 'object') return saved;
    } catch { /* ignore corrupt state */ }
    return { from: '', to: '', preset: 'all' };
};

// Never let a stored/typed bound sit in the future.
const clampFuture = (d) => (d && d > todayISO() ? todayISO() : d);

const humanLabel = ({ from, to, preset }) => {
    if (preset === 'month') return 'This month';
    if (preset === 'quarter') return 'This quarter';
    if (preset === 'year') return 'This year';
    if (from && to) return `${from} → ${to}`;
    if (from) return `Since ${from}`;
    if (to) return `Through ${to}`;
    return 'All time';
};

export function DateRangeProvider({ children }) {
    const [state, setState] = useState(load);

    useEffect(() => { localStorage.setItem(KEY, JSON.stringify(state)); }, [state]);

    const setPreset = useCallback((key) => {
        if (key === 'custom') { setState((s) => ({ ...s, preset: 'custom' })); return; }
        const r = rangeForPreset(key);
        setState({ ...r, preset: key });
    }, []);

    // Editing either bound directly is a custom range. from>to is rejected so the
    // range can never be inverted from the picker.
    const setFrom = useCallback((v) => {
        const from = clampFuture(v);
        setState((s) => (from && s.to && from > s.to ? s : { ...s, from, preset: 'custom' }));
    }, []);
    const setTo = useCallback((v) => {
        const to = clampFuture(v);
        setState((s) => (to && s.from && to < s.from ? s : { ...s, to, preset: 'custom' }));
    }, []);

    const clear = useCallback(() => setState({ from: '', to: '', preset: 'all' }), []);

    const value = useMemo(() => ({
        from: state.from,
        to: state.to,
        preset: state.preset,
        active: Boolean(state.from || state.to),
        label: humanLabel(state),
        setPreset, setFrom, setTo, clear
    }), [state, setPreset, setFrom, setTo, clear]);

    return <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>;
}
