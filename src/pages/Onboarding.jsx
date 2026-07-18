import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Rocket, Check, AlertTriangle, Plus, Trash2, ChevronRight,
    CalendarClock, Package, X, Building2, Target, LayoutGrid, List as ListIcon,
    History, ArrowRight, GripVertical
} from 'lucide-react';
import { onboardingApi } from '../api/onboarding';
import StatCard from '../components/StatCard';
import Modal from '../components/Modal';
import './CashHorizon.css';
import './Onboarding.css';

const PARTY_CLASS = { Zeron: 'zeron', Customer: 'customer', Joint: 'joint' };
const VALUE_STAGE_NO = 6;

const STATUS_CLASS = {
    Pending: 'pending', 'In progress': 'progress', Blocked: 'blocked', Done: 'done',
    'Not started': 'pending', Live: 'done'
};

const fmtWhen = (iso) => {
    if (!iso) return '';
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
    if (mins < 10080) return `${Math.round(mins / 1440)}d ago`;
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const ACTION_ICON = {
    started: <Rocket size={12} />, stage_moved: <ArrowRight size={12} />, stage_status: <ChevronRight size={12} />,
    went_live: <Check size={12} />, status: <ChevronRight size={12} />, task_added: <Plus size={12} />
};

export default function Onboarding() {
    const [list, setList] = useState([]);
    const [stats, setStats] = useState(null);
    const [meta, setMeta] = useState(null);
    const [recent, setRecent] = useState([]);
    const [view, setView] = useState('board');
    const [openId, setOpenId] = useState(null);
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try {
            const [l, s, r] = await Promise.all([onboardingApi.list(), onboardingApi.stats(), onboardingApi.recentActivity(12).catch(() => [])]);
            setList(l); setStats(s); setRecent(r);
            setError('');
        } catch (e) { setError(e.message); } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { onboardingApi.meta().then(setMeta).catch(() => {}); }, []);
    useEffect(() => {
        if (!openId) { setDetail(null); return; }
        onboardingApi.get(openId).then(setDetail).catch((e) => setError(e.message));
    }, [openId]);

    const refresh = (updated) => { setDetail(updated); load(); };

    // Move a card to a stage column, then reload the board.
    const move = async (id, stageNo) => {
        try { await onboardingApi.move(id, stageNo); await load(); } catch (e) { setError(e.message); }
    };

    return (
        <div className="animate-fade-in">
            <header className="ch-head">
                <div>
                    <h1 className="ch-title">Onboarding</h1>
                    <p className="ch-sub">
                        Kickoff to live to first value, in six time-bound stages. Drag a customer across the
                        board to move their stage — every move is logged.
                    </p>
                </div>
                <div className="onb-viewtoggle">
                    <button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}><LayoutGrid size={15} /> Board</button>
                    <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}><ListIcon size={15} /> List</button>
                </div>
            </header>

            <div className="ch-kpis">
                <StatCard label="Onboarding" icon={<Rocket size={19} />} accent="#818cf8" variant="kpi"
                    countTo={stats?.inProgress || 0} hint={`${stats?.total || 0} total`} />
                <StatCard label="At risk" icon={<AlertTriangle size={19} />} accent="#f87171" variant="kri"
                    countTo={stats?.atRisk || 0} hint="a stage is past due"
                    progress={stats?.total ? ((stats.atRisk || 0) / stats.total) * 100 : 0} />
                <StatCard label="Time to onboard" icon={<CalendarClock size={19} />} accent="#38bdf8" variant="kpi"
                    countTo={stats?.avgTimeToOnboard || 0}
                    format={(n) => (stats?.avgTimeToOnboard ? `${Math.round(n)}d` : '—')}
                    hint={`kickoff → live · ${stats?.live || 0} live`} />
                <StatCard label="Time to value" icon={<Target size={19} />} accent="#34d399"
                    variant={stats?.liveWithoutValue ? 'kri' : 'kpi'}
                    countTo={stats?.avgTimeToValue || 0}
                    format={(n) => (stats?.avgTimeToValue ? `${Math.round(n)}d` : '—')}
                    hint={stats?.liveWithoutValue ? `${stats.liveWithoutValue} live without value yet` : 'kickoff → first use case'} />
            </div>

            {error && <div className="ch-error">{error}</div>}

            {loading ? (
                <div className="ch-empty">Loading…</div>
            ) : list.length === 0 ? (
                <div className="ch-empty" style={{ padding: '2.5rem' }}>
                    <Rocket size={26} style={{ opacity: 0.5 }} />
                    <p style={{ margin: '0.5rem 0 0', fontWeight: 600 }}>Nobody is onboarding yet</p>
                    <span style={{ fontSize: '0.82rem' }}>
                        Onboarding starts in CLM: assign a CSM to a customer, then hit “Proceed to onboard”.
                    </span>
                </div>
            ) : view === 'board' ? (
                <Board list={list} meta={meta} onOpen={setOpenId} onMove={move} recent={recent} />
            ) : (
                <ListView list={list} onOpen={setOpenId} />
            )}

            <Modal isOpen={!!openId} onClose={() => setOpenId(null)} title={detail?.account || ''} maxWidth="820px">
                {detail && <OnboardingDetail detail={detail} meta={meta} onChanged={refresh} />}
            </Modal>
        </div>
    );
}

/* ---------------- Kanban board ---------------- */

function Board({ list, meta, onOpen, onMove, recent }) {
    const drag = useRef(null); // { id, from }
    const [overCol, setOverCol] = useState(null);

    // Columns = the delivery stages, then a terminal "Live" column.
    const columns = useMemo(() => {
        const delivery = (meta?.stages || []).filter((s) => !s.valueStage).sort((a, b) => a.no - b.no);
        const maxNo = delivery.length ? delivery[delivery.length - 1].no : 5;
        return { delivery, maxNo, liveNo: maxNo + 1 };
    }, [meta]);

    const colOf = (o) => {
        if (o.status === 'Live') return columns.liveNo;
        const n = o.currentStage?.no;
        if (!n) return columns.liveNo;
        return Math.min(n, columns.maxNo);
    };

    const byCol = useMemo(() => {
        const map = {};
        for (const o of list) (map[colOf(o)] ||= []).push(o);
        return map;
    }, [list, columns]); // eslint-disable-line react-hooks/exhaustive-deps

    const onDrop = (targetNo) => {
        setOverCol(null);
        const d = drag.current;
        drag.current = null;
        if (d && d.from !== targetNo) onMove(d.id, targetNo);
    };

    const allCols = [...columns.delivery.map((s) => ({ no: s.no, name: s.name })), { no: columns.liveNo, name: 'Live' }];

    return (
        <>
            <div className="onb-board">
                {allCols.map((col) => {
                    const cards = byCol[col.no] || [];
                    const isLive = col.no === columns.liveNo;
                    return (
                        <div
                            key={col.no}
                            className={`onb-col ${overCol === col.no ? 'is-over' : ''} ${isLive ? 'onb-col--live' : ''}`}
                            onDragOver={(e) => { e.preventDefault(); if (overCol !== col.no) setOverCol(col.no); }}
                            onDragLeave={(e) => { if (e.currentTarget === e.target) setOverCol(null); }}
                            onDrop={() => onDrop(col.no)}
                        >
                            <div className="onb-col-head">
                                <span className="onb-col-no">{isLive ? '✓' : col.no}</span>
                                <span className="onb-col-name">{col.name}</span>
                                <span className="onb-col-count">{cards.length}</span>
                            </div>
                            <div className="onb-col-body">
                                {cards.map((o) => (
                                    <KanbanCard
                                        key={o.id} o={o} isLive={isLive}
                                        onOpen={() => onOpen(o.id)}
                                        onDragStart={() => { drag.current = { id: o.id, from: col.no }; }}
                                        onDragEnd={() => { drag.current = null; setOverCol(null); }}
                                    />
                                ))}
                                {cards.length === 0 && <div className="onb-col-empty">—</div>}
                            </div>
                        </div>
                    );
                })}
            </div>

            {recent.length > 0 && (
                <div className="glass-card onb-activity">
                    <div className="onb-activity-head"><History size={14} /> Recent activity</div>
                    <div className="onb-activity-list">
                        {recent.map((a) => (
                            <div className="onb-activity-row" key={a.id}>
                                <span className={`onb-act-icon onb-act-icon--${a.action}`}>{ACTION_ICON[a.action] || <ChevronRight size={12} />}</span>
                                <span className="onb-act-acct">{a.account}</span>
                                <span className="onb-act-detail">{a.detail}</span>
                                <span className="onb-act-meta">{a.actor} · {fmtWhen(a.at)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}

function KanbanCard({ o, isLive, onOpen, onDragStart, onDragEnd }) {
    return (
        <div
            className={`onb-kcard ${o.status === 'Blocked' ? 'is-blocked' : ''} ${o.overdueStages > 0 && o.status !== 'Live' ? 'is-risk' : ''}`}
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={onOpen}
        >
            <div className="onb-kcard-top">
                <GripVertical size={13} className="onb-kcard-grip" />
                <span className="onb-kcard-name"><Building2 size={12} /> {o.account}</span>
                {o.status === 'Blocked' && <span className="onb-kbadge onb-kbadge--blocked">blocked</span>}
            </div>
            <div className="onb-bar onb-bar--sm"><div className="onb-bar-fill" style={{ width: `${o.progress}%` }} /></div>
            <div className="onb-kcard-foot">
                <span>{o.csm_name || 'no CSM'}</span>
                <span>{o.doneStages}/{o.stageCount} stages</span>
            </div>
            <div className="onb-kcard-tags">
                {o.overdueStages > 0 && o.status !== 'Live' && (
                    <span className="onb-kbadge onb-kbadge--risk"><AlertTriangle size={10} /> {o.overdueStages} late</span>
                )}
                {!isLive && o.daysToGoLive !== null && (
                    <span className={`onb-kbadge ${o.daysToGoLive < 0 ? 'onb-kbadge--risk' : ''}`}>
                        {o.daysToGoLive < 0 ? `${Math.abs(o.daysToGoLive)}d over` : `${o.daysToGoLive}d to go-live`}
                    </span>
                )}
                {isLive && (
                    <span className={`onb-kbadge ${o.valueRealised ? 'onb-kbadge--value' : ''}`}>
                        {o.valueRealised ? '★ value realised' : 'value pending'}
                    </span>
                )}
            </div>
        </div>
    );
}

/* ---------------- List view (the original cards) ---------------- */

function ListView({ list, onOpen }) {
    return (
        <div className="onb-list">
            {list.map((o) => (
                <button className="onb-card glass-card" key={o.id} onClick={() => onOpen(o.id)}>
                    <div className="onb-card-top">
                        <div>
                            <div className="onb-card-name"><Building2 size={14} /> {o.account}</div>
                            <div className="onb-card-sub">CSM {o.csm_name || '—'}{o.contract_id && ` · ${o.contract_id}`}</div>
                        </div>
                        <span className={`onb-status onb-status--${STATUS_CLASS[o.status]}`}>{o.status}</span>
                    </div>
                    <div className="onb-bar"><div className="onb-bar-fill" style={{ width: `${o.progress}%` }} /></div>
                    <div className="onb-card-foot">
                        <span>{o.doneStages}/{o.stageCount} stages · {o.doneTasks}/{o.taskCount} tasks</span>
                        {o.currentStage && <span className="onb-current"><ChevronRight size={11} />{o.currentStage.name}</span>}
                        {o.overdueStages > 0 && <span className="onb-late"><AlertTriangle size={11} /> {o.overdueStages} past due</span>}
                        {o.daysToGoLive !== null && o.status !== 'Live' && (
                            <span className={o.daysToGoLive < 0 ? 'onb-late' : ''}>
                                {o.daysToGoLive < 0 ? `${Math.abs(o.daysToGoLive)}d over` : `${o.daysToGoLive}d to go-live`}
                            </span>
                        )}
                    </div>
                </button>
            ))}
        </div>
    );
}

/* ---------------- Detail drawer ---------------- */

function OnboardingDetail({ detail, meta, onChanged }) {
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [activity, setActivity] = useState([]);

    useEffect(() => { onboardingApi.activity(detail.id).then(setActivity).catch(() => {}); }, [detail.id, detail.updated_at]);

    const act = async (fn) => {
        setBusy(true); setErr('');
        try { onChanged(await fn()); } catch (e) { setErr(e.message); } finally { setBusy(false); }
    };

    const scopeSummary = useMemo(() => (detail.scope || []).map((s) => (
        `${s.product}: ${s.items.length ? s.items.join(', ') : `${s.unit_count} ${s.unit_label.toLowerCase()}`}`
    )), [detail.scope]);

    return (
        <div className={`onb-detail ${busy ? 'is-busy' : ''}`}>
            <div className="onb-summary">
                <div className="onb-sum-item"><span>CSM</span><strong>{detail.csm_name || '—'}</strong></div>
                <div className="onb-sum-item"><span>Kickoff</span><strong>{detail.kickoff_date || '—'}</strong></div>
                <div className="onb-sum-item"><span>Target go-live</span><strong>{detail.target_go_live || '—'}</strong></div>
                <div className="onb-sum-item"><span>Progress</span><strong>{detail.progress}%</strong></div>
                <div className="onb-sum-item"><span>Time to onboard</span><strong>{detail.timeToOnboardDays !== null ? `${detail.timeToOnboardDays}d` : '—'}</strong></div>
                <div className="onb-sum-item"><span>Time to value</span>
                    <strong className={detail.valueRealised ? 'onb-early' : ''}>{detail.timeToValueDays !== null ? `${detail.timeToValueDays}d` : 'not yet'}</strong></div>
                <div className="onb-sum-item"><span>Status</span>
                    <strong><span className={`onb-status onb-status--${STATUS_CLASS[detail.status]}`}>{detail.status}</span></strong></div>
            </div>

            {scopeSummary.length > 0 && (
                <div className="onb-scope">
                    <span className="onb-scope-label"><Package size={12} /> Delivering</span>
                    <div className="onb-scope-items">{scopeSummary.map((s) => <span className="onb-scope-chip" key={s}>{s}</span>)}</div>
                </div>
            )}

            {err && <div className="ch-error">{err}</div>}

            <div className="onb-stages">
                {detail.stages.map((s) => <Stage key={s.id} stage={s} meta={meta} onboardingId={detail.id} act={act} />)}
            </div>

            {activity.length > 0 && (
                <div className="onb-log">
                    <div className="onb-log-head"><History size={13} /> Activity log</div>
                    {activity.map((a) => (
                        <div className="onb-log-row" key={a.id}>
                            <span className={`onb-act-icon onb-act-icon--${a.action}`}>{ACTION_ICON[a.action] || <ChevronRight size={12} />}</span>
                            <span className="onb-log-detail">{a.detail}</span>
                            <span className="onb-log-meta">{a.actor} · {fmtWhen(a.at)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function Stage({ stage, meta, onboardingId, act }) {
    const [adding, setAdding] = useState(false);
    const [label, setLabel] = useState('');
    const [party, setParty] = useState('Zeron');

    const addTask = async () => {
        if (!label.trim()) return;
        await act(() => onboardingApi.addTask(onboardingId, { stage_id: stage.id, label: label.trim(), party }));
        setLabel(''); setAdding(false);
    };

    return (
        <div className={`onb-stage onb-stage--${STATUS_CLASS[stage.status]} ${stage.overdue ? 'is-overdue' : ''} ${stage.stage_no === VALUE_STAGE_NO ? 'is-value' : ''}`}>
            <div className="onb-stage-head">
                <span className="onb-stage-no">{stage.stage_no}</span>
                <div className="onb-stage-title">
                    <strong>{stage.name}</strong>
                    <span className="onb-stage-meta">
                        {stage.doneCount}/{stage.taskCount} · due {stage.due_date || '—'}
                        {stage.overdue && <span className="onb-late"> · {stage.days_late}d late</span>}
                        {stage.delivered_variance_days !== null && (
                            <span className={stage.delivered_variance_days <= 0 ? 'onb-early' : 'onb-late'}>
                                {' · '}{stage.delivered_variance_days <= 0 ? `${Math.abs(stage.delivered_variance_days)}d early` : `${stage.delivered_variance_days}d late`}
                            </span>
                        )}
                    </span>
                </div>
                <select className="onb-set" value={stage.status}
                    onChange={(e) => act(() => onboardingApi.updateStage(stage.id, { status: e.target.value }))}>
                    {(meta?.stageStatuses || []).map((s) => <option key={s}>{s}</option>)}
                </select>
            </div>

            <div className="onb-bar onb-bar--sm"><div className="onb-bar-fill" style={{ width: `${stage.progress}%` }} /></div>

            <div className="onb-tasks">
                {stage.tasks.map((t) => (
                    <label className={`onb-task ${t.done ? 'is-done' : ''}`} key={t.id}>
                        <input type="checkbox" checked={!!t.done}
                            onChange={(e) => act(() => onboardingApi.updateTask(t.id, { done: e.target.checked }))} />
                        <span className="onb-task-box">{t.done ? <Check size={11} strokeWidth={3} /> : null}</span>
                        <span className="onb-task-label">{t.label}</span>
                        {t.product_key && <span className="onb-from-scope" title="Generated from the CLM scope">from scope</span>}
                        <span className={`onb-party onb-party--${PARTY_CLASS[t.party]}`}>{t.party}</span>
                        <button type="button" className="onb-task-del" title="Remove"
                            onClick={(e) => { e.preventDefault(); act(() => onboardingApi.removeTask(t.id)); }}>
                            <Trash2 size={12} />
                        </button>
                    </label>
                ))}
            </div>

            {adding ? (
                <div className="onb-add">
                    <input autoFocus value={label} placeholder="What needs doing?"
                        onChange={(e) => setLabel(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }} />
                    <select value={party} onChange={(e) => setParty(e.target.value)}>
                        {(meta?.parties || ['Zeron', 'Customer', 'Joint']).map((p) => <option key={p}>{p}</option>)}
                    </select>
                    <button type="button" onClick={addTask}><Check size={13} /></button>
                    <button type="button" onClick={() => setAdding(false)}><X size={13} /></button>
                </div>
            ) : (
                <button type="button" className="onb-add-btn" onClick={() => setAdding(true)}><Plus size={12} /> Add task</button>
            )}
        </div>
    );
}

/**
 * The CLM-side entry point.
 *
 * Shows the live onboarding if there is one, and otherwise offers to start it —
 * which is where the CX lead names the CSM who owns the customer from here.
 */
export function ProceedToOnboard({ account, contracts = [], csmName, onStarted }) {
    const [existing, setExisting] = useState(undefined); // undefined = still checking
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
        csm_name: '', csm_email: '',
        kickoff_date: new Date().toISOString().slice(0, 10), target_go_live: '', notes: '',
        contract_id: ''
    });
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    useEffect(() => { onboardingApi.byAccount(account).then(setExisting); }, [account]);
    useEffect(() => {
        setForm((f) => ({
            ...f,
            csm_name: f.csm_name || csmName || '',
            contract_id: f.contract_id || contracts[0]?.id || ''
        }));
    }, [csmName, contracts]);

    const start = async (e) => {
        e.preventDefault();
        setBusy(true); setErr('');
        try {
            const o = await onboardingApi.start({ ...form, account });
            setExisting(o);
            setOpen(false);
            onStarted?.(o);
        } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
    };

    if (existing === undefined) return null;

    if (existing) {
        return (
            <div className="onb-inline onb-inline--live">
                <Rocket size={14} />
                <span>
                    Onboarding <strong>{existing.status.toLowerCase()}</strong> — {existing.progress}%
                    {existing.currentStage ? ` · now: ${existing.currentStage.name}` : ' · all stages done'}
                </span>
                <a className="onb-inline-link" href="/onboarding">Open <ChevronRight size={12} /></a>
            </div>
        );
    }

    return (
        <>
            <div className="onb-inline">
                <Rocket size={14} />
                <span>This customer hasn’t been onboarded yet.</span>
                <button className="onb-proceed" onClick={() => setOpen(true)}>Proceed to onboard</button>
            </div>

            <Modal isOpen={open} onClose={() => setOpen(false)} title={`Onboard ${account}`} maxWidth="560px">
                <form className="ch-form" onSubmit={start}>
                    <p className="onb-modal-note">
                        The CSM owns this from here. Stage 2’s checklist is built from what {account}
                        {' '}bought — so scope their contract in CLM first if you haven’t.
                    </p>
                    <div className="ch-form-grid">
                        <div className="ch-field">
                            <label>Assign CSM *</label>
                            <input required value={form.csm_name} onChange={(e) => setForm({ ...form, csm_name: e.target.value })} placeholder="Who owns this customer?" />
                        </div>
                        <div className="ch-field">
                            <label>CSM email</label>
                            <input type="email" value={form.csm_email} onChange={(e) => setForm({ ...form, csm_email: e.target.value })} placeholder="csm@zeron.example" />
                        </div>
                    </div>
                    <div className="ch-form-grid">
                        <div className="ch-field">
                            <label>Contract</label>
                            <select value={form.contract_id} onChange={(e) => setForm({ ...form, contract_id: e.target.value })}>
                                <option value="">— none —</option>
                                {contracts.map((c) => <option key={c.id} value={c.id}>{c.id}</option>)}
                            </select>
                        </div>
                        <div className="ch-field">
                            <label>Kickoff date</label>
                            <input type="date" value={form.kickoff_date} onChange={(e) => setForm({ ...form, kickoff_date: e.target.value })} />
                        </div>
                    </div>
                    <div className="ch-field">
                        <label>Target go-live (blank = 60 days from kickoff)</label>
                        <input type="date" value={form.target_go_live} onChange={(e) => setForm({ ...form, target_go_live: e.target.value })} />
                    </div>
                    {err && <div className="ch-error">{err}</div>}
                    <div className="ch-form-actions">
                        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Starting…' : 'Start onboarding'}</button>
                    </div>
                </form>
            </Modal>
        </>
    );
}
