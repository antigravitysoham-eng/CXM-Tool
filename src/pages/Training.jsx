import React, { useEffect, useState, useMemo } from 'react';
import {
    GraduationCap, Plus, Users, CheckCircle, Award, AlertTriangle,
    Pencil, Trash2, BookOpen, X, Wallet, TrendingUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { trainingApi } from '../api/training';
import { accountsApi } from '../api/accounts';
import StatCard from '../components/StatCard';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import ModuleReportMenu from '../components/ModuleReportMenu';
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
    const [view, setView] = useState('sessions'); // 'sessions' | 'courses'
    const [courses, setCourses] = useState([]);
    const isAdmin = user?.role === 'admin';

    const loadCourses = async () => {
        try { setCourses(await trainingApi.courses()); } catch (e) { setError(e.message); }
    };

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
    useEffect(() => { if (view === 'courses' && !courses.length) loadCourses(); }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

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
                    <p className="ch-sub">Customer enablement — module-wise courses, the learner funnel, and enablement revenue. Sensei 🥋 flags accounts drifting through training.</p>
                </div>
                <div style={{ display: 'flex', gap: '.6rem' }}>
                    <ModuleReportMenu module="training" title="Training" />
                    {view === 'sessions' && <button className="btn btn-primary" onClick={() => setModal(blank)}><Plus size={18} /> New session</button>}
                </div>
            </header>

            <div className="onb-viewtoggle" style={{ marginBottom: '1.1rem' }}>
                <button className={view === 'sessions' ? 'on' : ''} onClick={() => setView('sessions')}><BookOpen size={15} /> Sessions</button>
                <button className={view === 'courses' ? 'on' : ''} onClick={() => setView('courses')}><GraduationCap size={15} /> Course catalogue</button>
                <button className={view === 'roster' ? 'on' : ''} onClick={() => setView('roster')}><Users size={15} /> Roster & enrollments</button>
                <button className={view === 'revenue' ? 'on' : ''} onClick={() => setView('revenue')}><Wallet size={15} /> Revenue</button>
            </div>

            {error && <div className="ch-error">{error}</div>}

            {view === 'courses' ? (
                <Catalogue courses={courses} meta={meta} isAdmin={isAdmin} onChanged={loadCourses} setError={setError} />
            ) : view === 'roster' ? (
                <Roster meta={meta} accounts={accounts} courses={courses} loadCourses={loadCourses} isAdmin={isAdmin} setError={setError} />
            ) : view === 'revenue' ? (
                <Revenue meta={meta} setError={setError} />
            ) : (<>
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
            </>)}

            <Modal isOpen={!!modal} onClose={() => setModal(null)} title={modal?.id ? 'Edit session' : 'New training session'} maxWidth="580px">
                {modal && <SessionForm initial={modal} meta={meta} accounts={accounts} onSave={save} onCancel={() => setModal(null)} saving={saving} />}
            </Modal>
        </div>
    );
}

/* ---------------- Course catalogue ---------------- */

const MODULE_LABELS = {
    platform: 'Platform', interno: 'Interno', conformity: 'Conformity', vendor_pulse: 'Vendor Pulse',
    zak_services: 'ZAK - Services', agentctl: 'Agentctl', certifications: 'Certifications', others: 'Others'
};
const LEVEL_CLASS = { Foundation: 'tr-lvl--f', Intermediate: 'tr-lvl--i', Advanced: 'tr-lvl--a' };
const fmtInr = (n) => {
    const v = Number(n) || 0;
    if (v >= 100000) return `₹${(v / 100000).toFixed(v % 100000 ? 1 : 0)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
    return `₹${v}`;
};

function Catalogue({ courses, meta, isAdmin, onChanged, setError }) {
    const [modal, setModal] = useState(null); // course being edited, or {} for new

    const byModule = useMemo(() => {
        const m = {};
        for (const c of courses) (m[c.module] ||= []).push(c);
        return m;
    }, [courses]);

    const save = async (form) => {
        try {
            if (form.id) await trainingApi.updateCourse(form.id, form);
            else await trainingApi.createCourse(form);
            setModal(null); await onChanged();
        } catch (e) { setError(e.message); }
    };
    const remove = async (c) => {
        if (!window.confirm(`Delete course "${c.title}"?`)) return;
        try { await trainingApi.removeCourse(c.id); await onChanged(); } catch (e) { setError(e.message); }
    };

    const modules = Object.keys(byModule);
    return (
        <div>
            <div className="tr-cat-head">
                <span className="ch-muted">{courses.length} courses across {modules.length} modules · Foundation → Advanced</span>
                {isAdmin && <button className="btn btn-primary" onClick={() => setModal({ module: 'platform', level: 'Foundation', duration_hours: 4, seat_price: 15000, currency: 'INR', active: true })}><Plus size={16} /> New course</button>}
            </div>

            {modules.length === 0 && <div className="ch-empty">No courses yet.</div>}

            {modules.map((mod) => (
                <div className="tr-cat-module" key={mod}>
                    <div className="tr-cat-module-name">{MODULE_LABELS[mod] || mod}</div>
                    <div className="tr-cat-grid">
                        {byModule[mod].map((c) => (
                            <div className={`tr-course glass-card ${c.active ? '' : 'is-inactive'}`} key={c.id}>
                                <div className="tr-course-top">
                                    <span className={`tr-lvl ${LEVEL_CLASS[c.level]}`}>{c.level}</span>
                                    {isAdmin && (
                                        <div className="tr-course-actions">
                                            <button className="ch-iconbtn" onClick={() => setModal(c)}><Pencil size={13} /></button>
                                            <button className="ch-iconbtn ch-iconbtn--danger" onClick={() => remove(c)}><Trash2 size={13} /></button>
                                        </div>
                                    )}
                                </div>
                                <div className="tr-course-title">{c.title}</div>
                                <div className="tr-course-meta">{c.duration_hours}h · <strong>{fmtInr(c.seat_price)}</strong>/seat{c.active ? '' : ' · inactive'}</div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            <Modal isOpen={!!modal} onClose={() => setModal(null)} title={modal?.id ? 'Edit course' : 'New course'} maxWidth="520px">
                {modal && <CourseForm initial={modal} meta={meta} onSave={save} onCancel={() => setModal(null)} />}
            </Modal>
        </div>
    );
}

/* ---------------- Training revenue (separate cash flow) ---------------- */

function Revenue({ meta, setError }) {
    const [rev, setRev] = useState(null);
    const [subs, setSubs] = useState([]);

    const load = async () => {
        try {
            const [r, s] = await Promise.all([trainingApi.revenue(), trainingApi.subscriptions()]);
            setRev(r); setSubs(s);
        } catch (e) { setError(e.message); }
    };
    useEffect(() => {
        let alive = true;
        Promise.all([trainingApi.revenue(), trainingApi.subscriptions()])
            .then(([r, s]) => { if (alive) { setRev(r); setSubs(s); } })
            .catch((e) => { if (alive) setError(e.message); });
        return () => { alive = false; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const patch = async (id, data) => { try { await trainingApi.updateSubscription(id, data); await load(); } catch (e) { setError(e.message); } };

    if (!rev) return <div className="ch-empty">Loading…</div>;
    const byModule = Object.entries(rev.byModule || {}).sort((a, b) => b[1] - a[1]);
    const maxMod = Math.max(1, ...byModule.map(([, v]) => v));

    return (
        <div>
            <div className="ch-kpis">
                <StatCard label="Training bookings" icon={<Wallet size={19} />} accent="#818cf8" variant="kpi"
                    countTo={rev.bookings || 0} format={(n) => fmtInr(n)} hint={`${rev.subscriptions} subscription${rev.subscriptions === 1 ? '' : 's'}`} />
                <StatCard label="Training ARR" icon={<TrendingUp size={19} />} accent="#34d399" variant="kpi"
                    countTo={rev.arr || 0} format={(n) => fmtInr(n)} hint={`${fmtInr(rev.mrr || 0)} MRR · ${rev.activeSubscriptions} active`} />
                <StatCard label="Collected" icon={<CheckCircle size={19} />} accent="#38bdf8" variant="kpi"
                    countTo={rev.collected || 0} format={(n) => fmtInr(n)} hint="recorded against subscriptions" />
                <StatCard label="Pending" icon={<AlertTriangle size={19} />} accent="#fbbf24" variant={rev.pending ? 'kri' : 'kpi'}
                    countTo={rev.pending || 0} format={(n) => fmtInr(n)} hint="booked, not yet collected" />
            </div>

            <div className="glass-card tr-rev-note" style={{ marginBottom: '1rem' }}>
                <Wallet size={14} /> Training revenue is computed <strong>only from the Training module</strong> — a separate cash flow, not merged into contract ARR.
            </div>

            {byModule.length > 0 && (
                <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
                    <div className="tr-roster-head"><strong>Bookings by module</strong></div>
                    {byModule.map(([mod, v]) => (
                        <div className="tr-mod-row" key={mod}>
                            <span className="tr-mod-name">{MODULE_LABELS[mod] || mod}</span>
                            <div className="tr-mod-bar"><div className="tr-mod-fill" style={{ width: `${Math.round((v / maxMod) * 100)}%` }} /></div>
                            <span className="tr-mod-val">{fmtInr(v)}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="glass-card" style={{ padding: 0 }}>
                <div className="ch-table-wrap">
                    <table className="ch-table">
                        <thead><tr><th>Account</th><th>Status</th><th>Billing</th><th>Amount</th><th>Collected</th><th>Pending</th></tr></thead>
                        <tbody>
                            {subs.length === 0 && <tr><td colSpan={6} className="ch-muted" style={{ textAlign: 'center', padding: '20px' }}>No training subscriptions yet — they’re created when a customer reaches the onboarding Training stage.</td></tr>}
                            {subs.map((s) => (
                                <tr key={s.id}>
                                    <td className="ch-acct-name">{s.account}</td>
                                    <td>
                                        <select className="onb-set" value={s.status} onChange={(e) => patch(s.id, { status: e.target.value })}>
                                            {(meta.subscriptionStatuses || []).map((x) => <option key={x}>{x}</option>)}
                                        </select>
                                    </td>
                                    <td>
                                        <select className="onb-set" value={s.billing_frequency} onChange={(e) => patch(s.id, { billing_frequency: e.target.value })}>
                                            {(meta.billingFrequencies || []).map((x) => <option key={x}>{x}</option>)}
                                        </select>
                                    </td>
                                    <td className="ch-value">{fmtInr(s.amount)}</td>
                                    <td><input type="number" min="0" className="tr-collect" value={s.collected || 0} onChange={(e) => patch(s.id, { collected: Math.max(0, parseInt(e.target.value || '0', 10) || 0) })} /></td>
                                    <td className={s.pending ? 'clm-inv-due' : 'ch-muted'}>{fmtInr(s.pending)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

/* ---------------- Roster & enrollments ---------------- */

const ENR_CLASS = { Enrolled: 'ch-badge--prospect', 'In progress': 'ch-badge--direct', Completed: 'ch-badge--good', Certified: 'ch-badge--good', Cancelled: 'ch-badge--stage' };

function Roster({ meta, accounts, courses, loadCourses, isAdmin, setError }) {
    const [account, setAccount] = useState(accounts[0]?.name || '');
    const [trainees, setTrainees] = useState([]);
    const [enrollments, setEnrollments] = useState([]);
    const [trainers, setTrainers] = useState([]);
    const [newTrainee, setNewTrainee] = useState({ name: '', role: '' });
    const [newTrainer, setNewTrainer] = useState('');
    const [enrollFor, setEnrollFor] = useState(null); // trainee being enrolled

    const load = async (acct = account) => {
        try {
            const [tr, en, trn] = await Promise.all([
                trainingApi.trainees(acct), trainingApi.enrollments({ account: acct }), trainingApi.trainers()
            ]);
            setTrainees(tr); setEnrollments(en); setTrainers(trn);
        } catch (e) { setError(e.message); }
    };
    useEffect(() => { if (!courses.length) loadCourses(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (account) load(account); }, [account]); // eslint-disable-line react-hooks/exhaustive-deps

    const addTrainee = async () => {
        if (!newTrainee.name.trim()) return;
        try { await trainingApi.addTrainee({ account, ...newTrainee }); setNewTrainee({ name: '', role: '' }); await load(); }
        catch (e) { setError(e.message); }
    };
    const removeTrainee = async (t) => { if (!window.confirm(`Remove ${t.name}?`)) return; try { await trainingApi.removeTrainee(t.id); await load(); } catch (e) { setError(e.message); } };
    const addTrainer = async () => {
        if (!newTrainer.trim()) return;
        try { await trainingApi.addTrainer({ name: newTrainer.trim() }); setNewTrainer(''); await load(); } catch (e) { setError(e.message); }
    };
    const removeTrainer = async (t) => { try { await trainingApi.removeTrainer(t.id); await load(); } catch (e) { setError(e.message); } };
    const enroll = async (trainee, courseKey, trainerId) => {
        try { await trainingApi.enroll({ account, course_key: courseKey, trainee_id: trainee.id, trainer_id: trainerId || undefined }); setEnrollFor(null); await load(); }
        catch (e) { setError(e.message); }
    };
    const setStatus = async (e, status) => { try { await trainingApi.updateEnrollment(e.id, { status }); await load(); } catch (err) { setError(err.message); } };
    const setTrainer = async (e, trainerId) => { try { await trainingApi.updateEnrollment(e.id, { trainer_id: trainerId ? Number(trainerId) : null }); await load(); } catch (err) { setError(err.message); } };
    const unenroll = async (e) => { try { await trainingApi.removeEnrollment(e.id); await load(); } catch (err) { setError(err.message); } };

    const enrByTrainee = useMemo(() => {
        const m = {};
        for (const e of enrollments) (m[e.trainee_id] ||= []).push(e);
        return m;
    }, [enrollments]);

    return (
        <div>
            {/* Trainers roster */}
            <div className="glass-card tr-roster">
                <div className="tr-roster-head"><strong>Assigned trainers</strong><span className="ch-muted">{trainers.length}</span></div>
                <div className="tr-trainer-list">
                    {trainers.map((t) => (
                        <span className="tr-trainer" key={t.id}>
                            {t.name}{t.specialties.length ? <span className="tr-trainer-spec"> · {t.specialties.join(', ')}</span> : null}
                            {isAdmin && <button className="tr-x" onClick={() => removeTrainer(t)}><X size={11} /></button>}
                        </span>
                    ))}
                    {trainers.length === 0 && <span className="ch-muted">No trainers yet.</span>}
                </div>
                {isAdmin && (
                    <div className="tr-inline-add">
                        <input value={newTrainer} placeholder="Add trainer name…" onChange={(e) => setNewTrainer(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addTrainer(); }} />
                        <button className="btn btn-ghost" onClick={addTrainer}><Plus size={14} /> Trainer</button>
                    </div>
                )}
            </div>

            {/* Account picker */}
            <div className="sm-filters" style={{ marginTop: '1rem' }}>
                <select value={account} onChange={(e) => setAccount(e.target.value)}>
                    {accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                </select>
                <span className="ch-muted">{trainees.length} trainees · {enrollments.length} enrollments</span>
            </div>

            {/* Trainees + their enrollments */}
            <div className="glass-card" style={{ padding: '1rem' }}>
                <div className="tr-inline-add" style={{ marginBottom: '0.8rem' }}>
                    <input value={newTrainee.name} placeholder="Trainee name" onChange={(e) => setNewTrainee({ ...newTrainee, name: e.target.value })} />
                    <input value={newTrainee.role} placeholder="Role (optional)" onChange={(e) => setNewTrainee({ ...newTrainee, role: e.target.value })} />
                    <button className="btn btn-primary" onClick={addTrainee}><Plus size={14} /> Add trainee</button>
                </div>

                {trainees.length === 0 && <div className="ch-empty">No trainees for {account} yet.</div>}
                {trainees.map((t) => (
                    <div className="tr-trainee" key={t.id}>
                        <div className="tr-trainee-head">
                            <div><strong>{t.name}</strong>{t.role ? <span className="ch-muted"> · {t.role}</span> : null}</div>
                            <div className="tr-trainee-actions">
                                <button className="btn btn-ghost" style={{ padding: '3px 10px', fontSize: '0.75rem' }} onClick={() => setEnrollFor(t)}><Plus size={13} /> Enroll</button>
                                <button className="ch-iconbtn ch-iconbtn--danger" onClick={() => removeTrainee(t)}><Trash2 size={13} /></button>
                            </div>
                        </div>
                        <div className="tr-enr-list">
                            {(enrByTrainee[t.id] || []).map((e) => (
                                <div className="tr-enr" key={e.id}>
                                    <span className={`tr-lvl ${LEVEL_CLASS[e.level] || ''}`}>{e.level || '—'}</span>
                                    <span className="tr-enr-course">{e.course_title}</span>
                                    <select className="onb-set" value={e.status} onChange={(ev) => setStatus(e, ev.target.value)}>
                                        {(meta.enrollmentStatuses || []).map((s) => <option key={s}>{s}</option>)}
                                    </select>
                                    <select className="onb-set" value={e.trainer_id || ''} onChange={(ev) => setTrainer(e, ev.target.value)}>
                                        <option value="">— trainer —</option>
                                        {trainers.map((tr) => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
                                    </select>
                                    <button className="tr-x" onClick={() => unenroll(e)}><X size={12} /></button>
                                </div>
                            ))}
                            {!(enrByTrainee[t.id] || []).length && <span className="ch-muted" style={{ fontSize: '0.78rem' }}>Not enrolled in anything yet.</span>}
                        </div>
                    </div>
                ))}
            </div>

            {enrollFor && (
                <Modal isOpen onClose={() => setEnrollFor(null)} title={`Enroll ${enrollFor.name}`} maxWidth="460px">
                    <EnrollForm courses={courses} trainers={trainers} onEnroll={(ck, tid) => enroll(enrollFor, ck, tid)} onCancel={() => setEnrollFor(null)} />
                </Modal>
            )}
        </div>
    );
}

function EnrollForm({ courses, trainers, onEnroll, onCancel }) {
    const active = courses.filter((c) => c.active);
    const [courseKey, setCourseKey] = useState(active[0]?.course_key || '');
    const [trainerId, setTrainerId] = useState('');
    return (
        <form className="ch-form" onSubmit={(e) => { e.preventDefault(); if (courseKey) onEnroll(courseKey, trainerId); }}>
            <div className="ch-field"><label>Course</label>
                <select value={courseKey} onChange={(e) => setCourseKey(e.target.value)}>
                    {active.map((c) => <option key={c.course_key} value={c.course_key}>{(MODULE_LABELS[c.module] || c.module)} · {c.title} ({c.level})</option>)}
                </select>
            </div>
            <div className="ch-field"><label>Trainer (optional)</label>
                <select value={trainerId} onChange={(e) => setTrainerId(e.target.value)}>
                    <option value="">— unassigned —</option>
                    {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            </div>
            <div className="ch-form-actions">
                <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!courseKey}>Enroll</button>
            </div>
        </form>
    );
}

function CourseForm({ initial, meta, onSave, onCancel }) {
    const [f, setF] = useState(initial);
    const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
    const submit = (e) => { e.preventDefault(); onSave(f); };
    return (
        <form className="ch-form" onSubmit={submit}>
            <div className="ch-field"><label>Course title *</label><input required value={f.title || ''} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Advanced Detection Engineering" /></div>
            <div className="ch-form-grid">
                <div className="ch-field"><label>Module</label>
                    <select value={f.module} onChange={(e) => set('module', e.target.value)}>
                        {Object.entries(MODULE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                </div>
                <div className="ch-field"><label>Level</label>
                    <select value={f.level} onChange={(e) => set('level', e.target.value)}>{(meta.levels || ['Foundation', 'Intermediate', 'Advanced']).map((l) => <option key={l}>{l}</option>)}</select>
                </div>
            </div>
            <div className="ch-form-grid">
                <div className="ch-field"><label>Duration (hours)</label><input type="number" min="0" value={f.duration_hours} onChange={(e) => set('duration_hours', Math.max(0, parseInt(e.target.value || '0', 10) || 0))} /></div>
                <div className="ch-field"><label>Seat price (₹)</label><input type="number" min="0" value={f.seat_price} onChange={(e) => set('seat_price', Math.max(0, parseInt(e.target.value || '0', 10) || 0))} /></div>
            </div>
            <label className="tr-active"><input type="checkbox" checked={f.active !== false} onChange={(e) => set('active', e.target.checked)} /> Active (bookable)</label>
            <div className="ch-form-actions">
                <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!f.title}>{f.id ? 'Save' : 'Create course'}</button>
            </div>
        </form>
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
