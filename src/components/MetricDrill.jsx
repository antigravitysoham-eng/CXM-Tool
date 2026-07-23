import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Database, Info, Search, X } from 'lucide-react';
import Modal from './Modal';
import { api } from '../api/client';
import { DrillContext, useMetricDrill } from './metricDrillContext';
import './MetricDrill.css';

/**
 * Metric provenance, available to any page.
 *
 * Every KPI card on the platform can be opened to show what the number means,
 * how it was worked out, which records it was read from, and the rows that
 * produce it. Rather than each module wiring its own modal and state, this
 * provider owns one, and a card just calls `open(key, label)`.
 */

const fmtInr = (n) => {
    const v = Math.round(Number(n) || 0);
    if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
    if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
    if (v >= 1e3) return `₹${(v / 1e3).toFixed(1)}k`;
    return `₹${v}`;
};
const fmtDate = (v) => (v ? String(v).slice(0, 10) : '—');

export function MetricDrillProvider({ children }) {
    const [drill, setDrill] = useState(null);
    // Which keys the server can explain, so a card only advertises a drill-down
    // that actually exists rather than opening onto a 404.
    const [keys, setKeys] = useState(null);

    useEffect(() => {
        let alive = true;
        api.get('/metrics')
            .then((r) => alive && setKeys(new Set(r.keys)))
            .catch(() => alive && setKeys(new Set()));   // no registry → nothing drillable
        return () => { alive = false; };
    }, []);

    const open = useCallback((key, label) => setDrill({ key, label }), []);
    // Until the registry loads, assume a key is valid — the dashboard's own six
    // are served by a different builder and are always available.
    const has = useCallback((key) => !key ? false : (keys === null ? true : keys.has(key) || DASHBOARD_KEYS.has(key)), [keys]);

    const value = useMemo(() => ({ open, has }), [open, has]);
    return (
        <DrillContext.Provider value={value}>
            {children}
            {drill && <MetricDetail drill={drill} onClose={() => setDrill(null)} />}
        </DrillContext.Provider>
    );
}

// Served by dashboardRepo rather than the registry — derived figures (a ratio,
// a cross-module average) that can't be expressed as filter-a-table.
const DASHBOARD_KEYS = new Set(['arr', 'nrr', 'atRisk', 'expansion', 'nps', 'adoption']);

/**
 * Makes any existing KPI markup drillable without restyling it.
 *
 * The module pages each grew their own stat strip long before this existed, so
 * rather than converting them all to a shared card, this wraps whatever they
 * already render and adds the click target and hover affordance around it.
 */
export function Drillable({ metric, label, children, className = '' }) {
    const { open, has } = useMetricDrill();
    if (!metric || !has(metric)) return <>{children}</>;
    return (
        <button type="button" className={`drillable ${className}`.trim()}
            onClick={() => open(metric, label)} title={`Where does "${label}" come from?`}>
            {children}
            <span className="drillable-info" aria-hidden><Info size={12} /></span>
        </button>
    );
}

/* Columns whose values come from a small closed vocabulary read far better as
   pills than as bare text — it makes a long table scannable at a glance. */
const PILL_COLUMNS = new Set(['status', 'priority', 'signal', 'currentSignal', 'sentiment',
    'health', 'stage', 'outcome', 'band', 'segment', 'tier', 'support_tier', 'type']);

const PILL_TONE = {
    Red: 'bad', Critical: 'bad', Poor: 'bad', Urgent: 'bad', Negative: 'bad', Declined: 'bad',
    Lost: 'bad', Cancelled: 'bad', Blocked: 'bad',
    Amber: 'warn', Average: 'warn', High: 'warn', Neutral: 'warn', Draft: 'warn',
    'In Progress': 'warn', 'In progress': 'warn', 'Waiting on Customer': 'warn',
    Green: 'good', Good: 'good', Excellent: 'good', Positive: 'good', Converted: 'good',
    Won: 'good', Resolved: 'good', Closed: 'good', Completed: 'good', Shared: 'good',
    Live: 'good', Sent: 'good', Certified: 'good', Shipped: 'good'
};

function MetricDetail({ drill, onClose }) {
    const [data, setData] = useState(null);
    const [err, setErr] = useState('');
    const [q, setQ] = useState('');

    useEffect(() => {
        let alive = true;
        api.get(`/metrics/${drill.key}/explain`)
            .then((r) => alive && setData(r))
            .catch((e) => alive && setErr(e.message || 'Could not load the breakdown'));
        return () => { alive = false; };
    }, [drill.key]);

    const text = (row, col) => {
        const v = row[col.key];
        if (col.format === 'inr') return fmtInr(v);
        if (col.format === 'pct') return v === null || v === undefined ? '—' : `${v}%`;
        if (col.format === 'date') return fmtDate(v);
        if (typeof v === 'number') return v.toLocaleString('en-IN');
        return v === null || v === undefined || v === '' ? '—' : String(v);
    };
    const headline = (d) => (d.format === 'inr' ? fmtInr(d.value)
        : d.format === 'pct' ? `${d.value ?? '—'}%`
            : d.value === null || d.value === undefined ? '—' : d.value.toLocaleString('en-IN'));

    // Filtering the breakdown in place beats closing the popup and going to
    // filter the module by hand.
    const needle = q.trim().toLowerCase();
    const shown = !data ? [] : (!needle ? data.rows : data.rows.filter((r) =>
        data.columns.some((c) => String(r[c.key] ?? '').toLowerCase().includes(needle))));

    const totalCol = data && !data.noTotal ? data.columns[data.columns.length - 1] : null;
    const total = totalCol ? shown.reduce((s, r) => s + (Number(r[totalCol.key]) || 0), 0) : null;

    return (
        <Modal isOpen onClose={onClose} title={drill.label || data?.label || 'Metric'} maxWidth="940px">
            {err && <div className="ch-error">{err}</div>}
            {!err && !data && <div className="md-loading">Tracing the number…</div>}
            {data && (
                <div className="md">
                    {/* the number, what it means, and where it was read from */}
                    <header className="md-hero">
                        <div className="md-hero-main">
                            <div className="md-hero-value">{headline(data)}</div>
                            <p className="md-hero-def">{data.definition}</p>
                        </div>
                        <div className="md-hero-side">
                            {data.sources.map((s) => (
                                <Link key={s.module + s.record} to={s.route} className="md-source" onClick={onClose}>
                                    <Database size={14} />
                                    <span className="md-source-text">
                                        <strong>{s.module}</strong>
                                        <em>{s.count.toLocaleString('en-IN')} {s.record}</em>
                                    </span>
                                    <ArrowRight size={13} />
                                </Link>
                            ))}
                        </div>
                    </header>

                    <div className="md-formula">
                        <span className="md-formula-tag">Formula</span>
                        <code>{data.formula}</code>
                    </div>

                    <section className="md-block">
                        <div className="md-block-head">
                            <h4>
                                {data.countRows ? 'Records counted' : 'What makes it up'}
                                <span className="md-count">
                                    {shown.length.toLocaleString('en-IN')}
                                    {shown.length !== data.rows.length ? ` of ${data.rows.length.toLocaleString('en-IN')}` : ''}
                                </span>
                            </h4>
                            {data.rows.length > 8 && (
                                <div className="md-search">
                                    <Search size={13} />
                                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter these rows…" />
                                    {q && <button type="button" onClick={() => setQ('')} aria-label="Clear filter"><X size={12} /></button>}
                                </div>
                            )}
                        </div>

                        <div className="md-tablewrap">
                            <table className="md-table">
                                <thead>
                                    <tr>{data.columns.map((c) => (
                                        <th key={c.key} className={c.align === 'right' ? 'is-right' : ''}>{c.label}</th>
                                    ))}</tr>
                                </thead>
                                <tbody>
                                    {shown.map((r, i) => (
                                        <tr key={i}>
                                            {data.columns.map((c) => {
                                                const v = text(r, c);
                                                const pill = PILL_COLUMNS.has(c.key) && v !== '—';
                                                return (
                                                    <td key={c.key} className={c.align === 'right' ? 'is-right' : ''} title={v}>
                                                        {pill
                                                            ? <span className={`md-pill is-${PILL_TONE[v] || 'plain'}`}>{v}</span>
                                                            : v}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                    {shown.length === 0 && (
                                        <tr><td colSpan={data.columns.length} className="md-empty">
                                            {data.rows.length ? 'Nothing matches that filter.' : 'Nothing contributes to this number yet.'}
                                        </td></tr>
                                    )}
                                </tbody>
                                {/* Only totalled where the rows are components of a sum — a ratio
                                    or a band split does not add up to anything. */}
                                {totalCol && shown.length > 0 && (
                                    <tfoot>
                                        <tr>
                                            <td colSpan={data.columns.length - 1}>{needle ? 'Total (filtered)' : 'Total'}</td>
                                            <td className="is-right">
                                                {totalCol.format === 'inr' ? fmtInr(total) : total.toLocaleString('en-IN')}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </section>

                    {data.caveats.length > 0 && (
                        <footer className="md-caveats">
                            <Info size={13} />
                            <ul>{data.caveats.map((c, i) => <li key={i}>{c}</li>)}</ul>
                        </footer>
                    )}
                </div>
            )}
        </Modal>
    );
}
