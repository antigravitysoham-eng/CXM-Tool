import React, { useEffect, useState } from 'react';
import {
    HeartPulse, Plus, Activity, AlertTriangle, ClipboardList, CheckCircle2,
    Clock, TrendingDown, TrendingUp, X, Save, CalendarClock, FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { healthApi } from '../api/health';
import StatCard from '../components/StatCard';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import ModuleReportMenu from '../components/ModuleReportMenu';
import { usePagination } from '../hooks/usePagination';
import './CashHorizon.css';
import './HealthChecks.css';

const SIGNAL_COLOR = { Green: '#10b981', Amber: '#f59e0b', Red: '#ef4444', Unknown: '#94a3b8' };
const SENTIMENT_ICON = { Positive: '🙂', Neutral: '😐', Negative: '🙁' };

function SignalDot({ signal }) {
    return <span className="hc-dot" style={{ background: SIGNAL_COLOR[signal] || SIGNAL_COLOR.Unknown }} title={signal} />;
}
function SignalBadge({ signal }) {
    const c = SIGNAL_COLOR[signal] || SIGNAL_COLOR.Unknown;
    return <span className="hc-signal" style={{ color: c, borderColor: c, background: `${c}1a` }}><SignalDot signal={signal} />{signal}</span>;
}

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

export default function HealthChecks() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [meta, setMeta] = useState(null);
    const [stats, setStats] = useState(null);
    const [board, setBoard] = useState([]);
    const [calls, setCalls] = useState([]);
    const [view, setView] = useState('board'); // 'board' | 'log'
    const [modal, setModal] = useState(null);   // { account } for logging a check
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [briefs, setBriefs] = useState([]);   // calls scheduled soon
    const [briefBusy, setBriefBusy] = useState('');

    const load = async () => {
        try {
            setError('');
            const [m, s, b, c, bd] = await Promise.all([
                meta ? Promise.resolve(meta) : healthApi.meta(),
                healthApi.stats(), healthApi.accounts(), healthApi.calls(), healthApi.briefsDue(1)
            ]);
            setMeta(m); setStats(s); setBoard(b); setCalls(c); setBriefs(bd || []);
        } catch (e) { setError(e.message || 'Failed to load'); }
    };

    const downloadBrief = async (account) => {
        setBriefBusy(account);
        try { await healthApi.precallBrief(account); } catch (e) { setError(e.message); } finally { setBriefBusy(''); }
    };

    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const seed = async () => {
        setBusy(true);
        try { await healthApi.seedSample(); await load(); } catch (e) { setError(e.message); } finally { setBusy(false); }
    };

    const saveCall = async (form) => {
        setSaving(true);
        try {
            const { actions, ...call } = form;
            const created = await healthApi.logCall(call);
            const first = (actions || []).filter((a) => a.text.trim());
            for (const a of first) await healthApi.addAction(created.id, { text: a.text.trim(), owner: a.owner || '' });
            setModal(null); await load();
        } catch (e) { setError(e.message); } finally { setSaving(false); }
    };

    const toggleAction = async (a) => {
        try { await healthApi.updateAction(a.id, { status: a.status === 'Done' ? 'Open' : 'Done' }); await load(); }
        catch (e) { setError(e.message); }
    };
    const addActionTo = async (callId, text) => {
        if (!text.trim()) return;
        try { await healthApi.addAction(callId, { text: text.trim() }); await load(); } catch (e) { setError(e.message); }
    };
    const removeCall = async (c) => {
        if (!window.confirm(`Delete the ${fmtDate(c.check_date)} health check for ${c.account}?`)) return;
        try { await healthApi.removeCall(c.id); await load(); } catch (e) { setError(e.message); }
    };

    const { pageItems: pagedCalls, ...pg } = usePagination(calls, 'health-calls');

    if (!meta || !stats) return <div className="ch-empty">Loading…</div>;

    const overdueCount = stats.overdue || 0;
    const atRisk = (stats.red || 0) + (stats.amber || 0);

    return (
        <div className="animate-fade-in">
            <header className="ch-head">
                <div>
                    <h1 className="ch-title">Health Checks</h1>
                    <p className="ch-sub">Tier-cadenced customer-health calls — Enterprise monthly, Premium every 2 months, Standard every 4. Pulse 💓 watches the cadence clock and flags a customer turning amber before it turns red.</p>
                </div>
                <div style={{ display: 'flex', gap: '.6rem' }}>
                    {isAdmin && !calls.length && <button className="btn btn-ghost" onClick={seed} disabled={busy}>{busy ? 'Seeding…' : 'Seed sample'}</button>}
                    <ModuleReportMenu module="health-checks" title="Health Checks" />
                    <button className="btn btn-primary" onClick={() => setModal({ account: board[0]?.account || '', signal: 'Green', sentiment: 'Neutral', check_date: '', next_call_date: '', summary: '', attendees: '', conducted_by: '', actions: [{ text: '', owner: '' }] })}><Plus size={18} /> Log check</button>
                </div>
            </header>

            <div className="hc-toggle" style={{ marginBottom: '1.1rem' }}>
                <button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}><Activity size={15} /> Customer-health board</button>
                <button className={view === 'log' ? 'on' : ''} onClick={() => setView('log')}><ClipboardList size={15} /> Call log</button>
            </div>

            {error && <div className="ch-error">{error}</div>}

            <div className="ch-kpis">
                <StatCard label="Customers tracked" metric="journey.customers" icon={<HeartPulse size={19} />} accent="#38bdf8" variant="kpi"
                    countTo={stats.accounts || 0} hint={`${stats.neverChecked || 0} never checked`} />
                <StatCard label="Overdue a check" metric="health.overdue" icon={<Clock size={19} />} accent="#f59e0b" variant={overdueCount ? 'kri' : 'kpi'}
                    countTo={overdueCount} hint="Past their tier cadence" />
                <StatCard label="At risk (red · amber)" metric="health.atRisk" icon={<AlertTriangle size={19} />} accent="#ef4444" variant={stats.red ? 'kri' : 'kpi'}
                    countTo={atRisk} hint={`${stats.red || 0} red · ${stats.amber || 0} amber`} />
                <StatCard label="Open actionables" metric="health.openActions" icon={<ClipboardList size={19} />} accent="#a855f7" variant="kpi"
                    countTo={stats.openActions || 0} hint={`${stats.worsening || 0} account${stats.worsening === 1 ? '' : 's'} worsening`} />
            </div>

            {briefs.length > 0 && (
                <div className="hc-briefs">
                    <div className="hc-briefs-head">
                        <CalendarClock size={16} />
                        <strong>{briefs.length} call{briefs.length === 1 ? '' : 's'} scheduled soon</strong>
                        <span className="hc-muted">— grab the pre-call brief the day before.</span>
                    </div>
                    <div className="hc-briefs-list">
                        {briefs.map((b) => (
                            <div key={b.account} className="hc-brief-chip">
                                <SignalDot signal={b.currentSignal} />
                                <span className="hc-brief-acct">{b.account}</span>
                                <span className="hc-muted">{b.daysToScheduled <= 0 ? 'today' : b.daysToScheduled === 1 ? 'tomorrow' : `in ${b.daysToScheduled}d`}</span>
                                <button className="btn btn-ghost hc-sm" onClick={() => downloadBrief(b.account)} disabled={briefBusy === b.account}>
                                    <FileText size={13} /> {briefBusy === b.account ? '…' : 'Brief'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {view === 'board' ? (
                <Board board={board} briefBusy={briefBusy} onBrief={downloadBrief}
                    onLog={(account) => setModal({ account, signal: 'Green', sentiment: 'Neutral', check_date: '', next_call_date: '', summary: '', attendees: '', conducted_by: '', actions: [{ text: '', owner: '' }] })} />
            ) : (
                <CallLog calls={pagedCalls} pg={pg} onToggle={toggleAction} onAdd={addActionTo} onRemove={removeCall} />
            )}

            {modal && (
                <LogModal init={modal} board={board} meta={meta} saving={saving} onClose={() => setModal(null)} onSave={saveCall} />
            )}
        </div>
    );
}

function Board({ board, onLog, onBrief, briefBusy }) {
    if (!board.length) return <div className="ch-empty">No customers to health-check yet. Once accounts go live they’ll appear here, cadenced by support tier.</div>;
    return (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="hc-table">
                <thead>
                    <tr>
                        <th>Customer</th><th>Tier · cadence</th><th>Last check</th><th>Next due</th>
                        <th>Signal</th><th>Sentiment</th><th>Open</th><th>Trend</th><th></th>
                    </tr>
                </thead>
                <tbody>
                    {board.map((h) => (
                        <tr key={h.account} className={h.overdue ? 'hc-row-overdue' : ''}>
                            <td className="hc-acct">{h.account}</td>
                            <td className="hc-muted">{h.tier} · every {h.cadenceDays}d</td>
                            <td className="hc-muted">{h.lastCheckDate ? fmtDate(h.lastCheckDate) : <span className="hc-never">never</span>}</td>
                            <td>
                                {h.scheduledCallDate
                                    ? <span className="hc-due hc-due-sched"><CalendarClock size={13} /> {fmtDate(h.scheduledCallDate)}</span>
                                    : h.overdue
                                        ? <span className="hc-due hc-due-over"><CalendarClock size={13} /> {h.lastCheckDate ? `${Math.abs(h.daysToNext)}d overdue` : 'due now'}</span>
                                        : <span className="hc-due">in {h.daysToNext}d</span>}
                            </td>
                            <td><SignalBadge signal={h.currentSignal} /></td>
                            <td className="hc-muted">{h.sentiment ? `${SENTIMENT_ICON[h.sentiment] || ''} ${h.sentiment}` : '—'}</td>
                            <td className="hc-muted">{h.openActions || '—'}</td>
                            <td>
                                {h.trend < 0 ? <span className="hc-trend hc-worse"><TrendingDown size={15} /></span>
                                    : h.trend > 0 ? <span className="hc-trend hc-better"><TrendingUp size={15} /></span>
                                        : <span className="hc-muted">–</span>}
                            </td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <button className="btn btn-ghost hc-sm" onClick={() => onBrief(h.account)} disabled={briefBusy === h.account} title="Download pre-call brief">
                                    <FileText size={14} /> {briefBusy === h.account ? '…' : 'Brief'}
                                </button>
                                <button className="btn btn-ghost hc-sm" onClick={() => onLog(h.account)} style={{ marginLeft: 6 }}><Plus size={14} /> Log</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function CallLog({ calls, pg, onToggle, onAdd, onRemove }) {
    if (!calls.length) return <div className="ch-empty">No health-check calls logged yet.</div>;
    return (
        <>
            <div className="hc-calls">
                {calls.map((c) => <CallCard key={c.id} call={c} onToggle={onToggle} onAdd={onAdd} onRemove={onRemove} />)}
            </div>
            <Pagination {...pg} />
        </>
    );
}

function CallCard({ call, onToggle, onAdd, onRemove }) {
    const [newAction, setNewAction] = useState('');
    const open = call.actions.filter((a) => a.status !== 'Done');
    const done = call.actions.filter((a) => a.status === 'Done');
    return (
        <div className="glass-card hc-call">
            <div className="hc-call-head">
                <div>
                    <div className="hc-call-acct">{call.account} <SignalBadge signal={call.signal} /></div>
                    <div className="hc-muted hc-call-meta">
                        {fmtDate(call.check_date)}
                        {call.sentiment && <> · {SENTIMENT_ICON[call.sentiment] || ''} {call.sentiment}</>}
                        {call.conducted_by && <> · by {call.conducted_by}</>}
                        {call.attendees && <> · with {call.attendees}</>}
                    </div>
                </div>
                <button className="hc-x" onClick={() => onRemove(call)} title="Delete call"><X size={16} /></button>
            </div>
            {call.summary && <p className="hc-summary">{call.summary}</p>}
            <div className="hc-actions">
                <div className="hc-actions-title"><ClipboardList size={14} /> Actionables {call.actions.length ? `(${open.length} open)` : ''}</div>
                {call.actions.length === 0 && <div className="hc-muted hc-none">No actionables from this call.</div>}
                {[...open, ...done].map((a) => (
                    <div key={a.id} className={`hc-action ${a.status === 'Done' ? 'hc-action-done' : ''}`}>
                        <button className="hc-check" onClick={() => onToggle(a)} title={a.status === 'Done' ? 'Reopen' : 'Mark done'}>
                            {a.status === 'Done' ? <CheckCircle2 size={16} color="var(--success)" /> : <span className="hc-check-empty" />}
                        </button>
                        <span className="hc-action-text">{a.text}</span>
                        {a.owner && <span className="hc-owner">{a.owner}</span>}
                        {a.carried_from && <span className="hc-carried" title="Carried forward from a previous call">carried</span>}
                    </div>
                ))}
                <form className="hc-add" onSubmit={(e) => { e.preventDefault(); onAdd(call.id, newAction); setNewAction(''); }}>
                    <input value={newAction} onChange={(e) => setNewAction(e.target.value)} placeholder="Add an actionable…" />
                    <button type="submit" className="btn btn-ghost hc-sm" disabled={!newAction.trim()}><Plus size={14} /></button>
                </form>
            </div>
        </div>
    );
}

function LogModal({ init, board, meta, saving, onClose, onSave }) {
    const [form, setForm] = useState(init);
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const setAction = (i, k, v) => setForm((f) => ({ ...f, actions: f.actions.map((a, j) => (i === j ? { ...a, [k]: v } : a)) }));
    const addRow = () => setForm((f) => ({ ...f, actions: [...f.actions, { text: '', owner: '' }] }));
    const selected = board.find((b) => b.account === form.account);

    return (
        <Modal isOpen onClose={onClose} title="Log health check">
            <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="ch-form">
                <div className="ch-field">
                    <label>Customer</label>
                    <select value={form.account} onChange={(e) => set('account', e.target.value)} required>
                        <option value="">Select a customer…</option>
                        {board.map((b) => <option key={b.account} value={b.account}>{b.account} · {b.tier}</option>)}
                    </select>
                    {selected && <div className="hc-hint">{selected.tier} tier — checked every {selected.cadenceDays} days. {selected.overdue ? 'Currently overdue.' : ''}</div>}
                </div>
                <div className="ch-field">
                    <label>Customer-health signal</label>
                    <div className="hc-seg">
                        {meta.signals.map((s) => (
                            <button key={s} type="button" className={form.signal === s ? 'on' : ''} onClick={() => set('signal', s)}
                                style={form.signal === s ? { borderColor: SIGNAL_COLOR[s], color: SIGNAL_COLOR[s] } : undefined}>
                                <SignalDot signal={s} /> {s}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="ch-field">
                    <label>Sentiment</label>
                    <div className="hc-seg">
                        {meta.sentiments.map((s) => (
                            <button key={s} type="button" className={form.sentiment === s ? 'on' : ''} onClick={() => set('sentiment', s)}>{SENTIMENT_ICON[s]} {s}</button>
                        ))}
                    </div>
                </div>
                <div className="ch-form-grid">
                    <div className="ch-field">
                        <label>Check date</label>
                        <input type="date" value={form.check_date} onChange={(e) => set('check_date', e.target.value)} />
                    </div>
                    <div className="ch-field">
                        <label>Conducted by</label>
                        <input value={form.conducted_by} onChange={(e) => set('conducted_by', e.target.value)} placeholder="CSM name" />
                    </div>
                </div>
                <div className="ch-field">
                    <label>Next call date <span className="hc-muted" style={{ fontWeight: 400 }}>— schedule the follow-up; you'll get a pre-call brief the day before</span></label>
                    <input type="date" value={form.next_call_date || ''} onChange={(e) => set('next_call_date', e.target.value)} />
                </div>
                <div className="ch-field">
                    <label>Attendees</label>
                    <input value={form.attendees} onChange={(e) => set('attendees', e.target.value)} placeholder="Who was on the call" />
                </div>
                <div className="ch-field">
                    <label>Summary — what was discussed</label>
                    <textarea rows={3} value={form.summary} onChange={(e) => set('summary', e.target.value)} placeholder="Adoption, blockers, sentiment, expansion signals…" />
                </div>
                <div className="ch-field">
                    <label>Actionables for next check</label>
                    {form.actions.map((a, i) => (
                        <div key={i} className="hc-action-row">
                            <input value={a.text} onChange={(e) => setAction(i, 'text', e.target.value)} placeholder="Actionable" />
                            <input value={a.owner} onChange={(e) => setAction(i, 'owner', e.target.value)} placeholder="Owner" style={{ maxWidth: 130 }} />
                        </div>
                    ))}
                    <button type="button" className="btn btn-ghost hc-sm" onClick={addRow}><Plus size={14} /> Add actionable</button>
                    <div className="hc-hint">Open actionables carry forward automatically to the next check.</div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '.4rem' }}>
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={saving || !form.account}><Save size={18} /> {saving ? 'Logging…' : 'Log check'}</button>
                </div>
            </form>
        </Modal>
    );
}
