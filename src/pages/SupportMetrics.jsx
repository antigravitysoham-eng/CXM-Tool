import React, { useEffect, useState } from 'react';
import {
    LifeBuoy, Plus, AlertTriangle, Clock, ShieldCheck, Timer,
    Pencil, Trash2, Gauge, Inbox, Bug, Send
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supportApi } from '../api/support';
import { accountsApi } from '../api/accounts';
import StatCard from '../components/StatCard';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import ModuleReportMenu from '../components/ModuleReportMenu';
import { usePagination } from '../hooks/usePagination';
import './CashHorizon.css';
import './SupportMetrics.css';

const PRIORITY_BADGE = { Urgent: 'ch-badge--critical', High: 'ch-badge--poor', Medium: 'ch-badge--direct', Low: 'ch-badge--stage' };
const STATUS_BADGE = {
    'Analysis in Progress': 'ch-badge--direct', 'Customer Pending': 'ch-badge--average', 'Dev Pending': 'ch-badge--prospect',
    'Feature Request': 'ch-badge--stage', 'Solution Delivered': 'ch-badge--good', 'Solution Accepted': 'ch-badge--stage'
};
const TYPE_BADGE = { Incident: 'ch-badge--poor', Question: 'ch-badge--direct', Task: 'ch-badge--prospect' };
const TIER_BADGE = { Enterprise: 'ch-badge--critical', Premium: 'ch-badge--prospect', Standard: 'ch-badge--direct' };

const fmtDue = (iso) => {
    if (!iso) return '—';
    const hrs = (new Date(iso) - Date.now()) / 3600000;
    const a = Math.abs(hrs);
    const s = a < 1 ? `${Math.round(a * 60)}m` : a < 48 ? `${Math.round(a)}h` : `${Math.round(a / 24)}d`;
    return hrs >= 0 ? `in ${s}` : `${s} ago`;
};

function SlaPill({ t }) {
    if (t.resolved) return <span className="sm-sla sm-sla--ok"><ShieldCheck size={12} /> {t.breached ? 'Resolved late' : 'Met SLA'}</span>;
    if (t.breached) return <span className="sm-sla sm-sla--bad"><AlertTriangle size={12} /> Breached · due {fmtDue(t.resolution_due)}</span>;
    if (t.at_risk) return <span className="sm-sla sm-sla--warn"><Timer size={12} /> At risk · due {fmtDue(t.resolution_due)}</span>;
    if (t.paused) return <span className="sm-sla sm-sla--paused"><Clock size={12} /> Paused · {t.status}</span>;
    return <span className="sm-sla sm-sla--ok"><Clock size={12} /> In SLA · due {fmtDue(t.resolution_due)}</span>;
}

export default function SupportMetrics() {
    const { user } = useAuth();
    const [tickets, setTickets] = useState([]);
    const [stats, setStats] = useState(null);
    const [meta, setMeta] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [filters, setFilters] = useState({ status: 'All', priority: 'All', breached: false });
    const [modal, setModal] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const isAdmin = user?.role === 'admin';

    const load = async (f = filters) => {
        try {
            setError('');
            const q = { status: f.status, priority: f.priority, breached: f.breached ? 'true' : undefined };
            const [list, s] = await Promise.all([supportApi.list(q), supportApi.stats(q)]);
            setTickets(list); setStats(s);
        } catch (e) { setError(e.message || 'Failed to load'); }
    };

    useEffect(() => {
        let alive = true;
        Promise.all([supportApi.meta(), accountsApi.list()])
            .then(([m, a]) => { if (!alive) return; setMeta(m); setAccounts(a); })
            .catch((e) => { if (alive) setError(e.message); });
        return () => { alive = false; };
    }, []);

    useEffect(() => { load(filters); /* refetch on filter change */ }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

    const save = async (form) => {
        setSaving(true);
        try {
            if (form.id) await supportApi.update(form.id, form);
            else await supportApi.create(form);
            setModal(null); await load();
        } catch (e) { setError(e.message); } finally { setSaving(false); }
    };
    const remove = async (t) => {
        if (!window.confirm(`Delete ticket "${t.subject}"?`)) return;
        try { await supportApi.remove(t.id); await load(); } catch (e) { setError(e.message); }
    };
    const escalate = async (t) => {
        if (!window.confirm(`Send ${t.ticket_no} — "${t.subject}" to the CTO on Telegram?`)) return;
        try { await supportApi.escalateCto(t.id); setError(''); window.alert(`Sent ${t.ticket_no} to the CTO on Telegram.`); }
        catch (e) { setError(e.message || 'Could not send to the CTO.'); }
    };
    const isBug = (t) => t.type === 'Incident' || t.resolution === 'Bug Fix';
    const seed = async () => {
        try { await supportApi.seedSample(); await load(); } catch (e) { setError(e.message); }
    };

    const { pageItems: pagedTickets, ...pg } = usePagination(tickets, 'support');

    if (!meta) return <div className="ch-empty">Loading…</div>;

    const blank = {
        account: accounts[0]?.name || '', subject: '', description: '', type: 'Question', priority: 'Medium',
        status: 'Analysis in Progress', resolution: '', channel: 'Zoho', module: '', sub_tab: '',
        jira_id: '', country: '', timezone: '', assignee: '', requester_name: '', requester_email: ''
    };
    const tierRows = Object.entries(stats?.byTier || {}).sort((a, b) => b[1].total - a[1].total);

    return (
        <div className="animate-fade-in">
            <header className="ch-head">
                <div>
                    <h1 className="ch-title">Support</h1>
                    <p className="ch-sub">Every ticket held to the account's <strong>support tier</strong> — response and resolution SLAs by priority. Medic 🚑 watches the clock.</p>
                </div>
                <div style={{ display: 'flex', gap: '.6rem' }}>
                    <ModuleReportMenu module="support" title="Support Metrics" />
                    <button className="btn btn-primary" onClick={() => setModal(blank)}><Plus size={18} /> New ticket</button>
                </div>
            </header>

            {error && <div className="ch-error">{error}</div>}

            <div className="ch-kpis">
                <StatCard label="Open tickets" metric="support.open" icon={<Inbox size={19} />} accent="#818cf8" variant="kpi"
                    countTo={stats?.open || 0} hint={`${stats?.total || 0} total · ${stats?.unassigned || 0} unassigned`} />
                <StatCard label="First response ≤ 1h" metric="support.firstResponseSla" icon={<Clock size={19} />} accent="#38bdf8" variant="kpi"
                    countTo={stats?.firstResponseSla ?? 0} format={(n) => `${Math.round(n)}%`}
                    hint={stats?.avgFirstResponseHrs != null ? `avg first reply ${stats.avgFirstResponseHrs}h` : 'no replies yet'} />
                <StatCard label="Breaching SLA" metric="support.breached" icon={<AlertTriangle size={19} />} accent="#f87171"
                    variant={stats?.breached ? 'kri' : 'kpi'} countTo={stats?.breached || 0}
                    hint={`${stats?.responseBreached || 0} response · ${stats?.resolutionBreached || 0} resolution`} />
                <StatCard label="At risk" metric="support.atRisk" icon={<Timer size={19} />} accent="#fbbf24" variant={stats?.atRisk ? 'kri' : 'kpi'}
                    countTo={stats?.atRisk || 0} hint={`past 75% of window · ${stats?.staleOpen || 0} stale`} />
                <StatCard label="SLA attainment" metric="support.slaAttainment" icon={<Gauge size={19} />} accent="#34d399" variant="kpi"
                    countTo={stats?.slaAttainment ?? 0} format={(n) => `${Math.round(n)}%`}
                    hint={stats?.avgResolutionHrs != null ? `avg resolve ${stats.avgResolutionHrs}h` : 'no resolved tickets yet'} />
                <StatCard label="Open bugs" metric="support.openBugs" icon={<Bug size={19} />} accent="#fb7185" variant={stats?.openBugs ? 'kri' : 'kpi'}
                    countTo={stats?.openBugs || 0} hint="Incident / Bug Fix — CTO escalation" />
            </div>

            {/* SLA by tier — the tier's actual job, kept honest */}
            {tierRows.length > 0 && (
                <div className="glass-card sm-tiers">
                    {tierRows.map(([tier, v]) => {
                        const promise = meta.sla[tier]?.Urgent;
                        return (
                            <div className="sm-tier" key={tier}>
                                <div className="sm-tier-head">
                                    <span className={`ch-badge ${TIER_BADGE[tier] || 'ch-badge--direct'}`}>{tier}</span>
                                    <span className="sm-tier-count">{v.total} ticket{v.total === 1 ? '' : 's'}</span>
                                </div>
                                <div className={`sm-tier-breach ${v.breached ? 'bad' : 'ok'}`}>
                                    {v.breached ? `${v.breached} breaching SLA` : 'all within SLA'}
                                </div>
                                {promise && <div className="sm-tier-promise">Urgent: respond ≤{promise.response}h · resolve ≤{promise.resolution}h</div>}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* filters */}
            <div className="sm-filters">
                <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                    <option value="All">All statuses</option>
                    {meta.statuses.map((s) => <option key={s}>{s}</option>)}
                </select>
                <select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
                    <option value="All">All priorities</option>
                    {meta.priorities.map((p) => <option key={p}>{p}</option>)}
                </select>
                <label className="sm-toggle">
                    <input type="checkbox" checked={filters.breached} onChange={(e) => setFilters({ ...filters, breached: e.target.checked })} />
                    Breaching only
                </label>
                <div className="sm-filter-spacer" />
                {isAdmin && tickets.length === 0 && <button className="btn btn-ghost" onClick={seed}><LifeBuoy size={15} /> Load sample tickets</button>}
            </div>

            <div className="glass-card" style={{ padding: 0 }}>
                <div className="ch-table-wrap">
                    <table className="ch-table">
                        <thead><tr><th>Ticket</th><th>Account</th><th>Type</th><th>Priority</th><th>Status</th><th>SLA</th><th>Assignee</th><th></th></tr></thead>
                        <tbody>
                            {tickets.length === 0 && (
                                <tr><td colSpan={8} className="ch-muted" style={{ textAlign: 'center', padding: '22px' }}>
                                    No tickets{filters.breached || filters.status !== 'All' || filters.priority !== 'All' ? ' match these filters' : ' yet'}.
                                </td></tr>
                            )}
                            {pagedTickets.map((t) => (
                                <tr key={t.id}>
                                    <td>
                                        <div className="ch-acct-name">{t.subject}</div>
                                        <div className="ch-muted" style={{ fontSize: '0.7rem' }}>
                                            {t.ticket_no}{t.channel ? ` · ${t.channel}` : ''}{t.module ? ` · ${t.module}` : ''}{t.jira_id ? ` · ${t.jira_id}` : ''}
                                        </div>
                                    </td>
                                    <td>
                                        <div>{t.account}</div>
                                        <span className={`ch-badge ${TIER_BADGE[t.support_tier] || 'ch-badge--direct'}`} style={{ fontSize: '0.62rem' }}>{t.support_tier}</span>
                                    </td>
                                    <td><span className={`ch-badge ${TYPE_BADGE[t.type] || 'ch-badge--direct'}`}>{t.type}</span></td>
                                    <td><span className={`ch-badge ${PRIORITY_BADGE[t.priority]}`}>{t.priority}</span></td>
                                    <td><span className={`ch-badge ${STATUS_BADGE[t.status] || 'ch-badge--direct'}`}>{t.status}</span></td>
                                    <td><SlaPill t={t} /></td>
                                    <td>{t.assignee || <span className="ch-muted">unassigned</span>}</td>
                                    <td>
                                        <div className="ch-rowactions">
                                            {isBug(t) && <button className="ch-iconbtn" title="Send to CTO on Telegram" onClick={() => escalate(t)}><Send size={15} /></button>}
                                            <button className="ch-iconbtn" onClick={() => setModal(t)}><Pencil size={15} /></button>
                                            <button className="ch-iconbtn ch-iconbtn--danger" onClick={() => remove(t)}><Trash2 size={15} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Pagination {...pg} />
            </div>

            <Modal isOpen={!!modal} onClose={() => setModal(null)} title={modal?.id ? 'Edit ticket' : 'New ticket'} maxWidth="580px">
                {modal && <TicketForm initial={modal} meta={meta} accounts={accounts} onSave={save} onCancel={() => setModal(null)} saving={saving} />}
            </Modal>
        </div>
    );
}

function TicketForm({ initial, meta, accounts, onSave, onCancel, saving }) {
    const [f, setF] = useState(initial);
    const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
    const isNew = !initial.id;
    const submit = (e) => { e.preventDefault(); onSave(f); };
    const promise = meta.sla[f.support_tier || 'Standard']?.[f.priority];

    return (
        <form className="ch-form" onSubmit={submit}>
            <div className="ch-field">
                <label>Account *</label>
                <select required value={f.account} onChange={(e) => set('account', e.target.value)} disabled={!isNew}>
                    <option value="">Select an account</option>
                    {accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                </select>
            </div>
            <div className="ch-field"><label>Subject *</label><input required value={f.subject} onChange={(e) => set('subject', e.target.value)} placeholder="What's the issue?" /></div>
            <div className="ch-form-grid">
                <div className="ch-field"><label>Type</label><select value={f.type} onChange={(e) => set('type', e.target.value)}>{meta.types.map((t) => <option key={t}>{t}</option>)}</select></div>
                <div className="ch-field"><label>Priority</label><select value={f.priority} onChange={(e) => set('priority', e.target.value)}>{meta.priorities.map((p) => <option key={p}>{p}</option>)}</select></div>
            </div>
            <div className="ch-form-grid">
                <div className="ch-field"><label>Status</label><select value={f.status} onChange={(e) => set('status', e.target.value)}>{meta.statuses.map((s) => <option key={s}>{s}</option>)}</select></div>
                <div className="ch-field"><label>Channel</label><select value={f.channel} onChange={(e) => set('channel', e.target.value)}>{meta.channels.map((c) => <option key={c}>{c}</option>)}</select></div>
            </div>
            <div className="ch-form-grid">
                <div className="ch-field"><label>Module</label><input value={f.module} onChange={(e) => set('module', e.target.value)} placeholder="e.g. Reporting" /></div>
                <div className="ch-field"><label>Sub-Tab</label><input value={f.sub_tab} onChange={(e) => set('sub_tab', e.target.value)} placeholder="Component of the module" /></div>
            </div>
            <div className="ch-form-grid">
                <div className="ch-field"><label>Resolution</label><select value={f.resolution} onChange={(e) => set('resolution', e.target.value)}><option value="">—</option>{meta.resolutions.map((r) => <option key={r}>{r}</option>)}</select></div>
                <div className="ch-field"><label>JIRA ID</label><input value={f.jira_id} onChange={(e) => set('jira_id', e.target.value)} placeholder="e.g. ZER-1234" /></div>
            </div>
            <div className="ch-form-grid">
                <div className="ch-field"><label>Requester</label><input value={f.requester_name} onChange={(e) => set('requester_name', e.target.value)} placeholder="Customer name" /></div>
                <div className="ch-field"><label>Requester email</label><input type="email" value={f.requester_email} onChange={(e) => set('requester_email', e.target.value)} placeholder="name@customer.com" /></div>
            </div>
            <div className="ch-form-grid">
                <div className="ch-field"><label>Country</label><input value={f.country} onChange={(e) => set('country', e.target.value)} placeholder="e.g. India" /></div>
                <div className="ch-field"><label>Timezone</label><input value={f.timezone} onChange={(e) => set('timezone', e.target.value)} placeholder="e.g. IST (UTC+5:30)" /></div>
            </div>
            <div className="ch-field"><label>Assignee</label><input value={f.assignee} onChange={(e) => set('assignee', e.target.value)} placeholder="Who's on it?" /></div>
            {promise && (
                <p className="ch-muted" style={{ fontSize: '0.76rem' }}>
                    On the <strong>{f.support_tier || "account's"}</strong> tier, a <strong>{f.priority}</strong> ticket must get a first technical response within <strong>1h</strong> (guide) and be resolved within <strong>{promise.resolution}h</strong>.
                </p>
            )}
            <div className="ch-field"><label>Description</label><textarea rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Details, steps to reproduce, links…" /></div>
            <div className="ch-form-actions">
                <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving || !f.account || !f.subject}>{saving ? 'Saving…' : (isNew ? 'Create ticket' : 'Save')}</button>
            </div>
        </form>
    );
}
