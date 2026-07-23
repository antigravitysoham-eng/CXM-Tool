import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Database, Info } from 'lucide-react';
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

function MetricDetail({ drill, onClose }) {
    const [data, setData] = useState(null);
    const [err, setErr] = useState('');

    useEffect(() => {
        let alive = true;
        api.get(`/metrics/${drill.key}/explain`)
            .then((r) => alive && setData(r))
            .catch((e) => alive && setErr(e.message || 'Could not load the breakdown'));
        return () => { alive = false; };
    }, [drill.key]);

    const cell = (row, col) => {
        const v = row[col.key];
        if (col.format === 'inr') return fmtInr(v);
        if (col.format === 'pct') return v === null || v === undefined ? '—' : `${v}%`;
        if (col.format === 'date') return fmtDate(v);
        if (typeof v === 'number') return v.toLocaleString('en-IN');
        return v === null || v === undefined || v === '' ? '—' : v;
    };
    const headline = (d) => (d.format === 'inr' ? fmtInr(d.value)
        : d.format === 'pct' ? `${d.value ?? '—'}%`
            : d.value === null || d.value === undefined ? '—' : d.value.toLocaleString('en-IN'));

    return (
        <Modal isOpen onClose={onClose} title={drill.label || data?.label || 'Metric'} maxWidth="880px">
            {err && <div className="ch-error">{err}</div>}
            {!err && !data && <div className="ch-empty">Tracing the number…</div>}
            {data && (
                <div className="md">
                    <div className="md-value">
                        <span>{headline(data)}</span>
                        <em>{data.definition}</em>
                    </div>

                    <div className="md-block">
                        <h4>How it is worked out</h4>
                        <code className="md-formula">{data.formula}</code>
                    </div>

                    <div className="md-block">
                        <h4><Database size={13} /> Read from</h4>
                        <div className="md-sources">
                            {data.sources.map((s) => (
                                <Link key={s.module + s.record} to={s.route} className="md-source" onClick={onClose}>
                                    <span className="md-source-mod">{s.module}</span>
                                    <span className="md-source-rec">{s.count.toLocaleString('en-IN')} {s.record}</span>
                                    <ArrowRight size={13} />
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="md-block">
                        <h4>{data.countRows ? `The ${data.rows.length.toLocaleString('en-IN')} record(s) counted` : 'What makes it up'}</h4>
                        <div className="md-tablewrap">
                            <table className="md-table">
                                <thead>
                                    <tr>{data.columns.map((c) => <th key={c.key} className={c.align === 'right' ? 'is-right' : ''}>{c.label}</th>)}</tr>
                                </thead>
                                <tbody>
                                    {data.rows.map((r, i) => (
                                        <tr key={i}>
                                            {data.columns.map((c) => <td key={c.key} className={c.align === 'right' ? 'is-right' : ''}>{cell(r, c)}</td>)}
                                        </tr>
                                    ))}
                                    {data.rows.length === 0 && (
                                        <tr><td colSpan={data.columns.length} className="ch-muted">Nothing contributes to this number yet.</td></tr>
                                    )}
                                </tbody>
                                {/* Only totalled where the rows are components of a sum — a
                                    ratio or a band split does not add up to anything. */}
                                {!data.noTotal && data.rows.length > 0 && (
                                    <tfoot>
                                        <tr>
                                            <td colSpan={data.columns.length - 1}>Total</td>
                                            <td className="is-right">
                                                {(() => {
                                                    const last = data.columns[data.columns.length - 1];
                                                    const t = data.rows.reduce((s, r) => s + (Number(r[last.key]) || 0), 0);
                                                    return last.format === 'inr' ? fmtInr(t) : t.toLocaleString('en-IN');
                                                })()}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>

                    {data.caveats.length > 0 && (
                        <div className="md-block">
                            <h4>Worth knowing</h4>
                            <ul className="md-caveats">{data.caveats.map((c, i) => <li key={i}>{c}</li>)}</ul>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
}
