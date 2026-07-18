import React, { useEffect, useState } from 'react';
import {
    GraduationCap, Plus, Users, CheckCircle, Award, AlertTriangle,
    Pencil, Trash2, BookOpen
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { trainingApi } from '../api/training';
import { accountsApi } from '../api/accounts';
import StatCard from '../components/StatCard';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
import './CashHorizon.css';
import './SupportMetrics.css'; // shared filter-bar styles (sm-filters, sm-toggle)
import './Training.css';

const STATUS_BADGE = {
    Scheduled: 'ch-badge--prospect', 'In Progress': 'ch-badge--direct', Completed: 'ch-badge--good',
    Delayed: 'ch-badge--poor', Cancelled: 'ch-badge--stage'
};

function Funnel({ s }) {
    const w = (n) => `${s.enrolled ? Math.round((n / s.enrolled) * 100) : 0}%`;
    return (
        <div className="tr-funnel" title={`${s.enrolled} enrolled · ${s.completed} completed · ${s.certified} certified`}>
            <div className="tr-funnel-bar">
                <div className="tr-funnel-seg tr-completed" style={{ width: w(s.completed) }} />
                <div className="tr-funnel-seg tr-certified" style={{ width: w(s.certified) }} />
            </div>
            <span className="tr-funnel-label">{s.completed}/{s.enrolled} · {s.completion_rate}%</span>
        </div>
    );
}

export default function Training() {
    const { user } = useAuth();
    const [sessions, setSessions] = useState([]);
    const [stats, setStats] = useState(null);
    const [meta, setMeta] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [filters, setFilters] = useState({ status: 'All', format: 'All' });
    const [modal, setModal] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const isAdmin = user?.role === 'admin';

    const load = async (f = filters) => {
        try {
            setError('');
            const q = { status: f.status, format: f.format };
            const [list, s] = await Promise.all([trainingApi.list(q), trainingApi.stats(q)]);
            setSessions(list); setStats(s);
        } catch (e) { setError(e.message || 'Failed to load'); }
    };

    useEffect(() => {
        let alive = true;
        Promise.all([trainingApi.meta(), accountsApi.list()])
            .then(([m, a]) => { if (!alive) return; setMeta(m); setAccounts(a); })
            .catch((e) => { if (alive) setError(e.message); });
        return () => { alive = false; };
    }, []);

    useEffect(() => { load(filters); }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

    const save = async (form) => {
        setSaving(true);
        try {
            if (form.id) await trainingApi.update(form.id, form);
            else await trainingApi.create(form);
            setModal(null); await load();
        } catch (e) { setError(e.message); } finally { setSaving(false); }
    };
    const remove = async (s) => {
        if (!window.confirm(`Delete session "${s.title}"?`)) return;
        try { await trainingApi.remove(s.id); await load(); } catch (e) { setError(e.message); }
    };
    const seed = async () => {
        try { await trainingApi.seedSample(); await load(); } catch (e) { setError(e.message); }
    };

    const { pageItems: pagedSessions, ...pg } = usePagination(sessions, 'training');

    if (!meta) return <div className="ch-empty">Loading…</div>;

    const blank = { title: '', account: accounts[0]?.name || '', trainer: '', format: 'Webinar', status: 'Scheduled', session_date: '', enrolled: 0, completed: 0, certified: 0 };
    const under = stats?.underEnabledAccounts || [];

    return (
        <div className="animate-fade-in">
            <header className="ch-head">
                <div>
                    <h1 className="ch-title">Training</h1>
                    <p className="ch-sub">Customer enablement — the learner funnel from enrolled to certified. Sensei 🥋 flags accounts drifting through training without landing it.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setModal(blank)}><Plus size={18} /> New session</button>
            </header>

            {error && <div className="ch-error">{error}</div>}

            <div className="ch-kpis">
                <StatCard label="Sessions" icon={<BookOpen size={19} />} accent="#818cf8" variant="kpi"
                    countTo={stats?.sessions || 0} hint={`${stats?.active || 0} active`} />
                <StatCard label="Learners enrolled" icon={<Users size={19} />} accent="#38bdf8" variant="kpi"
                    countTo={stats?.enrolled || 0} hint={`${stats?.completed || 0} completed`} />
                <StatCard label="Completion rate" icon={<CheckCircle size={19} />} accent="#34d399" variant="kpi"
                    countTo={stats?.completionRate || 0} format={(n) => `${Math.round(n)}%`}
                    hint={`${stats?.stalled || 0} stalled session${stats?.stalled === 1 ? '' : 's'}`} />
                <StatCard label="Certified" icon={<Award size={19} />} accent="#fbbf24" variant="kpi"
                    countTo={stats?.certified || 0} hint={`${stats?.certificationRate || 0}% of enrolled`} />
            </div>

            {under.length > 0 && (
                <div className="tr-under glass-card">
                    <AlertTriangle size={16} />
                    <span><strong>{under.length} under-enabled account{under.length === 1 ? '' : 's'}</strong> — under 50% completion: {under.join(', ')}. Under-trained accounts open more tickets and churn harder.</span>
                </div>
            )}

            <div className="sm-filters">
                <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                    <option value="All">All statuses</option>
                    {meta.statuses.map((s) => <option key={s}>{s}</option>)}
                </select>
                <select value={filters.format} onChange={(e) => setFilters({ ...filters, format: e.target.value })}>
                    <option value="All">All formats</option>
                    {meta.formats.map((f) => <option key={f}>{f}</option>)}
                </select>
                <div className="sm-filter-spacer" />
                {isAdmin && sessions.length === 0 && <button className="btn btn-ghost" onClick={seed}><GraduationCap size={15} /> Load sample sessions</button>}
            </div>

            <div className="glass-card" style={{ padding: 0 }}>
                <div className="ch-table-wrap">
                    <table className="ch-table">
                        <thead><tr><th>Course</th><th>Account</th><th>Format</th><th>Status</th><th>Learner funnel</th><th>Certified</th><th></th></tr></thead>
                        <tbody>
                            {sessions.length === 0 && (
                                <tr><td colSpan={7} className="ch-muted" style={{ textAlign: 'center', padding: '22px' }}>
                                    No sessions{filters.status !== 'All' || filters.format !== 'All' ? ' match these filters' : ' yet'}.
                                </td></tr>
                            )}
                            {pagedSessions.map((s) => (
                                <tr key={s.id}>
                                    <td>
                                        <div className="ch-acct-name">{s.title}{s.stalled && <span className="tr-stalled">stalled</span>}</div>
                                        <div className="ch-muted" style={{ fontSize: '0.7rem' }}>{s.trainer || '—'}{s.session_date ? ` · ${s.session_date}` : ''}</div>
                                    </td>
                                    <td>{s.account}</td>
                                    <td className="ch-muted">{s.format}</td>
                                    <td><span className={`ch-badge ${STATUS_BADGE[s.status] || 'ch-badge--direct'}`}>{s.status}</span></td>
                                    <td style={{ minWidth: 160 }}><Funnel s={s} /></td>
                                    <td>{s.certified}<span className="ch-muted" style={{ fontSize: '0.7rem' }}> · {s.certification_rate}%</span></td>
                                    <td>
                                        <div className="ch-rowactions">
                                            <button className="ch-iconbtn" onClick={() => setModal(s)}><Pencil size={15} /></button>
                                            <button className="ch-iconbtn ch-iconbtn--danger" onClick={() => remove(s)}><Trash2 size={15} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Pagination {...pg} />
            </div>

            <Modal isOpen={!!modal} onClose={() => setModal(null)} title={modal?.id ? 'Edit session' : 'New training session'} maxWidth="580px">
                {modal && <SessionForm initial={modal} meta={meta} accounts={accounts} onSave={save} onCancel={() => setModal(null)} saving={saving} />}
            </Modal>
        </div>
    );
}

function SessionForm({ initial, meta, accounts, onSave, onCancel, saving }) {
    const [f, setF] = useState(initial);
    const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
    const num = (k, v) => set(k, Math.max(0, parseInt(v || '0', 10) || 0));
    const isNew = !initial.id;
    const submit = (e) => { e.preventDefault(); onSave(f); };
    const funnelWarn = f.completed > f.enrolled || f.certified > f.completed;

    return (
        <form className="ch-form" onSubmit={submit}>
            <div className="ch-field"><label>Course *</label><input required value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Advanced Admin Training" /></div>
            <div className="ch-field">
                <label>Account *</label>
                <select required value={f.account} onChange={(e) => set('account', e.target.value)} disabled={!isNew}>
                    <option value="">Select an account</option>
                    {accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                </select>
            </div>
            <div className="ch-form-grid">
                <div className="ch-field"><label>Format</label><select value={f.format} onChange={(e) => set('format', e.target.value)}>{meta.formats.map((x) => <option key={x}>{x}</option>)}</select></div>
                <div className="ch-field"><label>Status</label><select value={f.status} onChange={(e) => set('status', e.target.value)}>{meta.statuses.map((x) => <option key={x}>{x}</option>)}</select></div>
            </div>
            <div className="ch-form-grid">
                <div className="ch-field"><label>Trainer</label><input value={f.trainer} onChange={(e) => set('trainer', e.target.value)} placeholder="Who's delivering it?" /></div>
                <div className="ch-field"><label>Session date</label><input type="date" value={f.session_date} onChange={(e) => set('session_date', e.target.value)} /></div>
            </div>
            <div className="ch-section-title">Learner funnel</div>
            <div className="ch-form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div className="ch-field"><label>Enrolled</label><input type="number" min="0" value={f.enrolled} onChange={(e) => num('enrolled', e.target.value)} /></div>
                <div className="ch-field"><label>Completed</label><input type="number" min="0" value={f.completed} onChange={(e) => num('completed', e.target.value)} /></div>
                <div className="ch-field"><label>Certified</label><input type="number" min="0" value={f.certified} onChange={(e) => num('certified', e.target.value)} /></div>
            </div>
            {funnelWarn && <p className="ch-muted" style={{ fontSize: '0.76rem', color: 'var(--warning, #f59e0b)' }}>Completed can't exceed enrolled, and certified can't exceed completed — these will be clamped on save.</p>}
            <div className="ch-form-actions">
                <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving || !f.title || !f.account}>{saving ? 'Saving…' : (isNew ? 'Create session' : 'Save')}</button>
            </div>
        </form>
    );
}
