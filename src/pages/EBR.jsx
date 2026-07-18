import React, { useEffect, useState } from 'react';
import {
    Presentation, LayoutGrid, FileText, Sparkles, Wrench, Send, Trash2,
    RefreshCw, CheckCircle2, Clock, Users, X, TrendingUp
} from 'lucide-react';
import { ebrsApi } from '../api/ebrs';
import StatCard from '../components/StatCard';
import Modal from '../components/Modal';
import ModuleReportMenu from '../components/ModuleReportMenu';
import './CashHorizon.css';
import './EBR.css';

const SIGNAL_COLOR = { Green: '#10b981', Amber: '#f59e0b', Red: '#ef4444', Unknown: '#94a3b8' };
const STATUS_CLASS = { 'Not started': 'ebr-st-none', Draft: 'ebr-st-draft', Generated: 'ebr-st-gen', Shared: 'ebr-st-shared' };
const fmtInr = (n) => {
    const v = Math.round(Number(n) || 0);
    if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
    if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
    if (v >= 1e3) return `₹${(v / 1e3).toFixed(1)}k`;
    return `₹${v}`;
};

export default function EBR() {
    const [meta, setMeta] = useState(null);
    const [quarter, setQuarter] = useState('');
    const [coverage, setCoverage] = useState(null);
    const [ebrs, setEbrs] = useState([]);
    const [view, setView] = useState('board'); // 'board' | 'reviews'
    const [detail, setDetail] = useState(null);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        let alive = true;
        ebrsApi.meta().then((m) => { if (!alive) return; setMeta(m); setQuarter(m.currentQuarter); }).catch((e) => alive && setError(e.message));
        return () => { alive = false; };
    }, []);

    const load = async (q = quarter) => {
        if (!q) return;
        try {
            setError('');
            const [cov, list] = await Promise.all([ebrsApi.coverage(q), ebrsApi.list({ quarter: q })]);
            setCoverage(cov); setEbrs(list);
        } catch (e) { setError(e.message || 'Failed to load'); }
    };

    useEffect(() => { if (quarter) load(quarter); }, [quarter]); // eslint-disable-line react-hooks/exhaustive-deps

    const generateAll = async () => {
        setBusy('all');
        try { await ebrsApi.generateAll(quarter); await load(); } catch (e) { setError(e.message); } finally { setBusy(''); }
    };
    const generateOne = async (account) => {
        setBusy(account);
        try { await ebrsApi.generate(account, quarter); await load(); } catch (e) { setError(e.message); } finally { setBusy(''); }
    };
    const share = async (id) => {
        setBusy(`share-${id}`);
        try { const e = await ebrsApi.share(id); await load(); if (detail?.id === id) setDetail(e); } catch (er) { setError(er.message); } finally { setBusy(''); }
    };
    const open = async (id) => {
        try { setDetail(await ebrsApi.get(id)); } catch (e) { setError(e.message); }
    };
    const remove = async (id) => {
        if (!window.confirm('Delete this EBR?')) return;
        try { await ebrsApi.remove(id); if (detail?.id === id) setDetail(null); await load(); } catch (e) { setError(e.message); }
    };

    if (!meta) return <div className="ch-empty">Loading…</div>;

    return (
        <div className="animate-fade-in">
            <header className="ch-head">
                <div>
                    <h1 className="ch-title">Executive Business Reviews</h1>
                    <p className="ch-sub">Quarterly reviews generated from the platform’s own data and shared with every customer. Aria 🎯 pulls the wins and the areas for improvement from ARR, support, enablement and vendor-health.</p>
                </div>
                <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center' }}>
                    <ModuleReportMenu module="ebrs" title="Executive Business Reviews" />
                    <select className="ebr-quarter" value={quarter} onChange={(e) => setQuarter(e.target.value)}>
                        {meta.quarters.map((q) => <option key={q} value={q}>{q.replace('-', ' ')}</option>)}
                    </select>
                    <button className="btn btn-primary" onClick={generateAll} disabled={busy === 'all'}>
                        <RefreshCw size={17} /> {busy === 'all' ? 'Generating…' : 'Generate the quarter'}
                    </button>
                </div>
            </header>

            <div className="ebr-toggle" style={{ marginBottom: '1.1rem' }}>
                <button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}><LayoutGrid size={15} /> Coverage board</button>
                <button className={view === 'reviews' ? 'on' : ''} onClick={() => setView('reviews')}><FileText size={15} /> Reviews</button>
            </div>

            {error && <div className="ch-error">{error}</div>}

            {coverage && (
                <div className="ch-kpis">
                    <StatCard label="Customers" icon={<Users size={19} />} accent="#38bdf8" variant="kpi"
                        countTo={coverage.customers} hint={coverage.quarterLabel} />
                    <StatCard label="Generated" icon={<FileText size={19} />} accent="#a855f7" variant="kpi"
                        countTo={coverage.generated} hint={`${coverage.notStarted} not started`} />
                    <StatCard label="Shared with customer" icon={<CheckCircle2 size={19} />} accent="#34d399" variant="kpi"
                        countTo={coverage.shared} format={(n) => Math.round(n)} hint={`of ${coverage.customers} customers`} />
                    <StatCard label="Awaiting share" icon={<Clock size={19} />} accent="#f59e0b" variant={coverage.pendingShare ? 'kri' : 'kpi'}
                        countTo={coverage.pendingShare} hint="Generated, not yet delivered" />
                </div>
            )}

            {view === 'board' ? (
                <Board coverage={coverage} busy={busy} onGenerate={generateOne} onOpen={open} onShare={share} />
            ) : (
                <Reviews ebrs={ebrs} busy={busy} onOpen={open} onShare={share} onRemove={remove} />
            )}

            {detail && <DetailModal ebr={detail} busy={busy} onClose={() => setDetail(null)} onShare={share} />}
        </div>
    );
}

function StatusBadge({ status }) {
    return <span className={`ebr-status ${STATUS_CLASS[status] || ''}`}>{status}</span>;
}

function Board({ coverage, busy, onGenerate, onOpen, onShare }) {
    if (!coverage) return <div className="ch-empty">Loading…</div>;
    if (!coverage.rows.length) return <div className="ch-empty">No customers to review yet.</div>;
    return (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="ebr-table">
                <thead>
                    <tr><th>Customer</th><th>Status</th><th>Vendor-health</th><th>ARR</th><th></th></tr>
                </thead>
                <tbody>
                    {coverage.rows.map((r) => (
                        <tr key={r.account}>
                            <td className="ebr-acct">{r.account}</td>
                            <td><StatusBadge status={r.status} /></td>
                            <td>{r.signal ? <span className="ebr-sig" style={{ color: SIGNAL_COLOR[r.signal] }}><span className="ebr-dot" style={{ background: SIGNAL_COLOR[r.signal] }} />{r.signal}</span> : <span className="ebr-muted">—</span>}</td>
                            <td className="ebr-muted">{r.arrInr ? fmtInr(r.arrInr) : '—'}</td>
                            <td style={{ textAlign: 'right' }}>
                                {r.id ? (
                                    <div className="ebr-rowbtns">
                                        <button className="btn btn-ghost ebr-sm" onClick={() => onOpen(r.id)}><FileText size={14} /> View</button>
                                        {r.status !== 'Shared' && <button className="btn btn-primary ebr-sm" onClick={() => onShare(r.id)} disabled={busy === `share-${r.id}`}><Send size={14} /> Share</button>}
                                    </div>
                                ) : (
                                    <button className="btn btn-ghost ebr-sm" onClick={() => onGenerate(r.account)} disabled={busy === r.account}>
                                        <RefreshCw size={14} /> {busy === r.account ? 'Generating…' : 'Generate'}
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Reviews({ ebrs, busy, onOpen, onShare, onRemove }) {
    if (!ebrs.length) return <div className="ch-empty">No EBRs generated for this quarter yet. Use “Generate the quarter” to build them from platform data.</div>;
    return (
        <div className="ebr-cards">
            {ebrs.map((e) => (
                <div key={e.id} className="glass-card ebr-card">
                    <div className="ebr-card-head">
                        <div>
                            <div className="ebr-card-acct">{e.account} <StatusBadge status={e.status} /></div>
                            <div className="ebr-muted ebr-card-q">{e.quarterLabel}{e.metrics?.tier ? ` · ${e.metrics.tier} tier` : ''}{e.metrics?.health?.signal ? ` · ${e.metrics.health.signal}` : ''}</div>
                        </div>
                        <div className="ebr-rowbtns">
                            <button className="btn btn-ghost ebr-sm" onClick={() => onOpen(e.id)}><FileText size={14} /> Open</button>
                            {e.status !== 'Shared' && <button className="btn btn-primary ebr-sm" onClick={() => onShare(e.id)} disabled={busy === `share-${e.id}`}><Send size={14} /> Share</button>}
                            <button className="ebr-x" onClick={() => onRemove(e.id)} title="Delete"><Trash2 size={15} /></button>
                        </div>
                    </div>
                    {e.summary && <p className="ebr-summary">{e.summary}</p>}
                    <div className="ebr-cols">
                        <div>
                            <div className="ebr-col-title ebr-win"><Sparkles size={14} /> Insights ({e.insights.length})</div>
                            <ul className="ebr-list">{e.insights.slice(0, 4).map((t, i) => <li key={i}>{t}</li>)}</ul>
                            {e.insights.length > 4 && <button className="ebr-more" onClick={() => onOpen(e.id)}>+{e.insights.length - 4} more</button>}
                        </div>
                        <div>
                            <div className="ebr-col-title ebr-imp"><Wrench size={14} /> Areas for improvement ({e.improvements.length})</div>
                            <ul className="ebr-list">{e.improvements.slice(0, 4).map((t, i) => <li key={i}>{t}</li>)}</ul>
                            {e.improvements.length > 4 && <button className="ebr-more" onClick={() => onOpen(e.id)}>+{e.improvements.length - 4} more</button>}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function Metric({ label, value }) {
    return <div className="ebr-metric"><span className="ebr-metric-v">{value}</span><span className="ebr-metric-l">{label}</span></div>;
}

function DetailModal({ ebr, busy, onClose, onShare }) {
    const m = ebr.metrics || {};
    return (
        <Modal isOpen onClose={onClose} title={ebr.title || `${ebr.account} — EBR`}>
            <div className="ebr-detail">
                <div className="ebr-detail-head">
                    <StatusBadge status={ebr.status} />
                    <span className="ebr-muted">{ebr.quarterLabel}</span>
                    {ebr.status !== 'Shared'
                        ? <button className="btn btn-primary ebr-sm" style={{ marginLeft: 'auto' }} onClick={() => onShare(ebr.id)} disabled={busy === `share-${ebr.id}`}><Send size={14} /> Share with customer</button>
                        : <span className="ebr-shared-note"><CheckCircle2 size={14} /> Shared{ebr.shared_at ? ` ${new Date(ebr.shared_at).toLocaleDateString()}` : ''}</span>}
                </div>

                <p className="ebr-summary">{ebr.summary}</p>

                <div className="ebr-metrics">
                    <Metric label="ARR" value={fmtInr(m.arrInr)} />
                    <Metric label="Support tier" value={m.tier || '—'} />
                    <Metric label="Health" value={m.health?.signal || '—'} />
                    <Metric label="Open support" value={m.support?.open ?? '—'} />
                    <Metric label="SLA attainment" value={m.support?.slaAttainment !== null && m.support?.slaAttainment !== undefined ? `${m.support.slaAttainment}%` : '—'} />
                    <Metric label="Enablement" value={m.enablement?.enrolled ? `${m.enablement.completionRate}%` : '—'} />
                    <Metric label="Training rev" value={fmtInr(m.trainingRevenueInr)} />
                    <Metric label="Renewal in" value={m.nextRenewalDays !== null && m.nextRenewalDays !== undefined ? `${m.nextRenewalDays}d` : '—'} />
                </div>

                <div className="ebr-detail-col">
                    <div className="ebr-col-title ebr-win"><Sparkles size={15} /> Insights</div>
                    <ul className="ebr-list">{ebr.insights.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </div>
                <div className="ebr-detail-col">
                    <div className="ebr-col-title ebr-imp"><Wrench size={15} /> Areas for improvement</div>
                    <ul className="ebr-list">{ebr.improvements.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </div>
            </div>
        </Modal>
    );
}
