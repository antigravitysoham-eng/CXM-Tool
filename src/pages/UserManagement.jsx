import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Shield, Users as UsersIcon, Lock, Bot, Inbox, Check, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../api/users';
import { agentKeysApi } from '../api/agentKeys';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
import './CashHorizon.css';

const ROLE_BADGE = { admin: 'ch-badge--critical', manager: 'ch-badge--prospect', rep: 'ch-badge--direct' };
// Agent-access grant → badge style + label.
const AGENT_ACCESS_BADGE = {
    write: { cls: 'ch-badge--prospect', label: 'Read + write' },
    read: { cls: 'ch-badge--direct', label: 'Read-only' },
    none: { cls: 'ch-badge--stage', label: 'Off' }
};
const agentAccessOf = (u) => u.agent_access || 'read';

function UserForm({ initial, meta, onSave, onCancel, saving }) {
    const [f, setF] = useState(initial);
    const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
    const isNew = !initial.id;
    const submit = (e) => { e.preventDefault(); onSave(f); };
    return (
        <form className="ch-form" onSubmit={submit}>
            <div className="ch-form-grid">
                <div className="ch-field"><label>Full name *</label><input required value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
                <div className="ch-field"><label>Email *</label><input required type="email" value={f.email} onChange={(e) => set('email', e.target.value)} disabled={!isNew} /></div>
            </div>
            <div className="ch-form-grid">
                <div className="ch-field"><label>{isNew ? 'Password *' : 'Password (blank = keep)'}</label><input type="password" value={f.password || ''} onChange={(e) => set('password', e.target.value)} required={isNew} /></div>
                <div className="ch-field"><label>Role</label><select value={f.role} onChange={(e) => set('role', e.target.value)}>{meta.roles.map((r) => <option key={r}>{r}</option>)}</select></div>
            </div>
            <div className="ch-section-title">Access attributes</div>
            <div className="ch-form-grid">
                <div className="ch-field"><label>Region</label>
                    <select value={f.region} onChange={(e) => set('region', e.target.value)}><option value="">—</option>{meta.regions.map((r) => <option key={r}>{r}</option>)}</select></div>
                <div className="ch-field"><label>Business unit</label><input value={f.business_unit} onChange={(e) => set('business_unit', e.target.value)} placeholder="Enterprise" /></div>
            </div>
            <div className="ch-field"><label>Team</label><input value={f.team} onChange={(e) => set('team', e.target.value)} placeholder="West-1" /></div>
            <div className="ch-section-title">Agent access</div>
            <div className="ch-field">
                <label>Can this user delegate to AI agents?</label>
                <select value={f.agent_access || 'read'} onChange={(e) => set('agent_access', e.target.value)}>
                    <option value="none">Off — no agent access</option>
                    <option value="read">Read-only — agents can read what the user can see</option>
                    <option value="write">Read + write — agents can also propose changes (human-approved)</option>
                </select>
            </div>
            <p className="ch-muted" style={{ fontSize: '0.76rem' }}>
                Agents always act within this user's own permissions. <strong>Read + write</strong> never lets an agent change data directly —
                every write becomes a proposal an admin or manager approves in the queue below.
            </p>
            <div className="ch-form-actions">
                <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save user'}</button>
            </div>
        </form>
    );
}

function PolicyForm({ meta, onSave, onCancel }) {
    const [f, setF] = useState({ name: '', role: 'rep', module: 'accounts', actions: ['read'], effect: 'allow', condition_type: 'own', condition_value: '' });
    const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
    const toggleAction = (a) => setF((p) => ({ ...p, actions: p.actions.includes(a) ? p.actions.filter((x) => x !== a) : [...p.actions, a] }));
    const submit = (e) => { e.preventDefault(); onSave(f); };
    return (
        <form className="ch-form" onSubmit={submit}>
            <div className="ch-field"><label>Policy name *</label><input required value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Managers — South region" /></div>
            <div className="ch-form-grid">
                <div className="ch-field"><label>Applies to role</label><select value={f.role} onChange={(e) => set('role', e.target.value)}>{meta.roles.map((r) => <option key={r}>{r}</option>)}</select></div>
                <div className="ch-field"><label>Module</label><select value={f.module} onChange={(e) => set('module', e.target.value)}>{meta.modules.map((m) => <option key={m}>{m === '*' ? 'All modules' : m}</option>)}</select></div>
            </div>
            <div className="ch-field"><label>Actions</label>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
                    {meta.actions.map((a) => (
                        <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            <input type="checkbox" checked={f.actions.includes(a)} onChange={() => toggleAction(a)} /> {a}
                        </label>
                    ))}
                </div>
            </div>
            <div className="ch-form-grid">
                <div className="ch-field"><label>Effect</label><select value={f.effect} onChange={(e) => set('effect', e.target.value)}><option>allow</option><option>deny</option></select></div>
                <div className="ch-field"><label>Condition</label><select value={f.condition_type} onChange={(e) => set('condition_type', e.target.value)}>{meta.conditionTypes.map((c) => <option key={c}>{c}</option>)}</select></div>
            </div>
            {f.condition_type === 'segment' && (
                <div className="ch-field"><label>Segments (comma-separated)</label><input value={f.condition_value} onChange={(e) => set('condition_value', e.target.value)} placeholder="Customer, Prospect" /></div>
            )}
            <p className="ch-muted" style={{ fontSize: '0.76rem' }}>
                <strong>all</strong> = every record · <strong>own</strong> = records they own · <strong>region</strong>/<strong>team</strong> = matching attribute · <strong>segment</strong> = listed segments.
            </p>
            <div className="ch-form-actions">
                <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add policy</button>
            </div>
        </form>
    );
}

export default function UserManagement() {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [policies, setPolicies] = useState([]);
    const [proposals, setProposals] = useState([]);
    const [meta, setMeta] = useState(null);
    const [error, setError] = useState('');
    const [userModal, setUserModal] = useState(null);
    const [policyModal, setPolicyModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deciding, setDeciding] = useState(null);

    const canWrite = (meta?.role || user?.role) === 'admin';
    // Admins and managers govern the write-approval queue.
    const canGovernAgents = ['admin', 'manager'].includes(meta?.role || user?.role);

    const load = async () => {
        try {
            setError('');
            const [u, m, p, pr] = await Promise.all([
                usersApi.list(), usersApi.meta(), usersApi.policies(),
                agentKeysApi.proposals().catch(() => [])
            ]);
            setUsers(u); setMeta(m); setPolicies(p); setProposals(pr);
        } catch (e) { setError(e.message || 'Failed to load'); }
    };
    useEffect(() => { load(); }, []);

    const blankUser = () => ({ email: '', name: '', password: '', role: 'rep', region: '', business_unit: '', team: '', agent_access: 'read' });

    const saveUser = async (f) => {
        setSaving(true);
        try {
            if (f.id) await usersApi.update(f.id, { name: f.name, role: f.role, region: f.region, business_unit: f.business_unit, team: f.team, agent_access: f.agent_access, ...(f.password ? { password: f.password } : {}) });
            else await usersApi.create(f);
            setUserModal(null); await load();
        } catch (e) { setError(e.message); } finally { setSaving(false); }
    };

    const decideProposal = async (id, action) => {
        setDeciding(id);
        try {
            if (action === 'approve') await agentKeysApi.approveProposal(id);
            else await agentKeysApi.rejectProposal(id);
            await load();
        } catch (e) { setError(e.message); } finally { setDeciding(null); }
    };
    const delUser = async (u) => {
        if (!window.confirm(`Delete user ${u.name}?`)) return;
        try { await usersApi.remove(u.id); await load(); } catch (e) { setError(e.message); }
    };
    const savePolicy = async (f) => {
        try { await usersApi.createPolicy(f); setPolicyModal(false); await load(); } catch (e) { setError(e.message); }
    };
    const delPolicy = async (id) => {
        if (!window.confirm('Delete this policy? It affects who can access what.')) return;
        try { await usersApi.removePolicy(id); await load(); } catch (e) { setError(e.message); }
    };

    const { pageItems: pagedUsers, ...pg } = usePagination(users, 'users');

    if (!meta) return <div className="ch-empty">Loading…</div>;

    return (
        <div className="animate-fade-in">
            <header className="ch-head">
                <div>
                    <h1 className="ch-title">User &amp; Agent Access</h1>
                    <p className="ch-sub">Attribute-based access control — add users, set attributes, provision agent access, and govern who (and whose agents) sees what.</p>
                </div>
                {canWrite && <button className="btn btn-primary" onClick={() => setUserModal(blankUser())}><Plus size={18} /> Add user</button>}
            </header>

            {error && <div className="ch-error">{error}</div>}
            {!canWrite && <div className="ch-error" style={{ background: 'rgba(148,163,184,0.1)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}><Lock size={14} style={{ display: 'inline' }} /> You have read-only access. Only admins can add or change users and policies.</div>}

            <div className="ch-section-title" style={{ border: 'none', marginBottom: '0.75rem' }}><UsersIcon size={16} style={{ display: 'inline', marginRight: 6 }} />Users ({users.length})</div>
            <div className="glass-card" style={{ padding: 0, marginBottom: '2rem' }}>
                <div className="ch-table-wrap">
                    <table className="ch-table">
                        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Agent access</th><th>Region</th><th>Business unit</th><th>Team</th><th></th></tr></thead>
                        <tbody>
                            {pagedUsers.map((u) => (
                                <tr key={u.id}>
                                    <td className="ch-acct-name">{u.name}</td>
                                    <td className="ch-muted">{u.email}</td>
                                    <td><span className={`ch-badge ${ROLE_BADGE[u.role] || 'ch-badge--direct'}`}>{u.role}</span></td>
                                    <td><span className={`ch-badge ${AGENT_ACCESS_BADGE[agentAccessOf(u)].cls}`}><Bot size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />{AGENT_ACCESS_BADGE[agentAccessOf(u)].label}</span></td>
                                    <td>{u.region || <span className="ch-muted">—</span>}</td>
                                    <td>{u.business_unit || <span className="ch-muted">—</span>}</td>
                                    <td>{u.team || <span className="ch-muted">—</span>}</td>
                                    <td>
                                        {canWrite && (
                                            <div className="ch-rowactions">
                                                <button className="ch-iconbtn" onClick={() => setUserModal({ ...u, password: '' })}><Pencil size={15} /></button>
                                                <button className="ch-iconbtn ch-iconbtn--danger" onClick={() => delUser(u)}><Trash2 size={15} /></button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Pagination {...pg} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div className="ch-section-title" style={{ border: 'none', margin: 0 }}><Shield size={16} style={{ display: 'inline', marginRight: 6 }} />Access policies ({policies.length})</div>
                {canWrite && <button className="btn btn-ghost" onClick={() => setPolicyModal(true)}><Plus size={16} /> Add policy</button>}
            </div>
            <div className="glass-card" style={{ padding: 0 }}>
                <div className="ch-table-wrap">
                    <table className="ch-table">
                        <thead><tr><th>Policy</th><th>Role</th><th>Module</th><th>Actions</th><th>Effect</th><th>Condition</th><th></th></tr></thead>
                        <tbody>
                            {policies.map((p) => (
                                <tr key={p.id}>
                                    <td className="ch-acct-name">{p.name}</td>
                                    <td><span className={`ch-badge ${ROLE_BADGE[p.role] || 'ch-badge--direct'}`}>{p.role}</span></td>
                                    <td>{p.module === '*' ? 'All' : p.module}</td>
                                    <td className="ch-muted">{(Array.isArray(p.actions) ? p.actions : String(p.actions).split(',')).join(', ')}</td>
                                    <td><span className={`ch-badge ${p.effect === 'deny' ? 'ch-badge--critical' : 'ch-badge--good'}`}>{p.effect}</span></td>
                                    <td><span className="ch-badge ch-badge--stage">{p.condition_type}{p.condition_value ? `: ${p.condition_value}` : ''}</span></td>
                                    <td>{canWrite && <button className="ch-iconbtn ch-iconbtn--danger" onClick={() => delPolicy(p.id)}><Trash2 size={15} /></button>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {canGovernAgents && (() => {
                const pending = proposals.filter((p) => p.status === 'pending');
                const decided = proposals.filter((p) => p.status !== 'pending').slice(0, 8);
                return (
                    <div style={{ marginTop: '2rem' }}>
                        <div className="ch-section-title" style={{ border: 'none', marginBottom: '0.75rem' }}>
                            <Inbox size={16} style={{ display: 'inline', marginRight: 6 }} />
                            Agent write approvals {pending.length > 0 && <span className="ch-badge ch-badge--critical" style={{ marginLeft: 8 }}>{pending.length} pending</span>}
                        </div>
                        <div className="glass-card" style={{ padding: 0 }}>
                            <div className="ch-table-wrap">
                                <table className="ch-table">
                                    <thead><tr><th>Agent</th><th>For</th><th>Proposed change</th><th>When</th><th>Status</th><th></th></tr></thead>
                                    <tbody>
                                        {pending.length === 0 && decided.length === 0 && (
                                            <tr><td colSpan={6} className="ch-muted" style={{ textAlign: 'center', padding: '18px' }}>No agent has proposed a change. When a write-provisioned agent proposes one, it waits here for your approval.</td></tr>
                                        )}
                                        {[...pending, ...decided].map((p) => {
                                            const owner = users.find((u) => u.id === p.user_id);
                                            return (
                                                <tr key={p.id}>
                                                    <td><span className="ch-badge ch-badge--direct"><Bot size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />{p.agent_name}</span></td>
                                                    <td className="ch-muted">{owner?.name || `user #${p.user_id}`}</td>
                                                    <td>
                                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{p.summary || `${p.method} ${p.path}`}</div>
                                                        <code style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.method} {p.path} {p.body && Object.keys(p.body).length ? `· ${JSON.stringify(p.body)}` : ''}</code>
                                                    </td>
                                                    <td className="ch-muted">{p.created_at ? new Date(p.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                                                    <td>
                                                        <span className={`ch-badge ${p.status === 'approved' ? 'ch-badge--good' : p.status === 'rejected' ? 'ch-badge--critical' : 'ch-badge--prospect'}`}>{p.status}</span>
                                                        {p.decided_by_name && <div className="ch-muted" style={{ fontSize: '0.68rem', marginTop: 2 }}>by {p.decided_by_name}</div>}
                                                    </td>
                                                    <td>
                                                        {p.status === 'pending' && (
                                                            <div className="ch-rowactions">
                                                                <button className="btn btn-primary" style={{ padding: '3px 10px', fontSize: '0.75rem' }} disabled={deciding === p.id} onClick={() => decideProposal(p.id, 'approve')}><Check size={13} /> Approve</button>
                                                                <button className="btn btn-ghost" style={{ padding: '3px 10px', fontSize: '0.75rem' }} disabled={deciding === p.id} onClick={() => decideProposal(p.id, 'reject')}><X size={13} /> Reject</button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <p className="ch-muted" style={{ fontSize: '0.76rem', marginTop: '0.6rem' }}>
                            Approving runs the change as the requesting user, through their own permissions — an agent can never do more than the person it acts for. Nothing is written until you approve.
                        </p>
                    </div>
                );
            })()}

            <Modal isOpen={!!userModal} onClose={() => setUserModal(null)} title={userModal?.id ? 'Edit user' : 'Add user'} maxWidth="560px">
                {userModal && <UserForm initial={userModal} meta={meta} onSave={saveUser} onCancel={() => setUserModal(null)} saving={saving} />}
            </Modal>
            <Modal isOpen={policyModal} onClose={() => setPolicyModal(false)} title="Add access policy" maxWidth="560px">
                <PolicyForm meta={meta} onSave={savePolicy} onCancel={() => setPolicyModal(false)} />
            </Modal>
        </div>
    );
}
