import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Shield, Users as UsersIcon, Lock, Bot, Inbox, Check, X, MessageCircle, ScrollText, RotateCcw, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../api/users';
import { agentKeysApi } from '../api/agentKeys';
import { whatsappApi } from '../api/whatsapp';
import { activityApi } from '../api/activity';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import PhoneInput from '../components/PhoneInput';
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

// Every module a role/user can be granted — one per sidebar area, mapped to the
// policy string its agent gates on. Used by the Roles form (module dropdown), the
// per-user Module-access grid, and reflects which agent a permission unlocks.
const MODULE_CATALOG = [
    { key: 'accounts', label: 'Cash Horizon', agent: 'Aukat 💰' },
    { key: 'contracts', label: 'CLM', agent: 'AURA 🔮 · DOXY 🗂️' },
    { key: 'onboarding', label: 'Onboarding', agent: 'Pilot 🚀' },
    { key: 'training', label: 'Training', agent: 'Sensei 🥋' },
    { key: 'health-checks', label: 'Health Checks', agent: 'Pulse 💓' },
    { key: 'ebrs', label: 'EBRs', agent: 'Harvey 🎯' },
    { key: 'surveys', label: 'Surveys', agent: 'Echo 📣' },
    { key: 'journey', label: 'Journey Map', agent: 'Compass 🧭' },
    { key: 'support', label: 'Support Metrics', agent: '911 🚑' },
    { key: 'feature-requests', label: 'Feature Requests', agent: 'Forge 🔧' },
    { key: 'upsells', label: 'Upsells', agent: 'Rainmaker 🌧️' },
    { key: 'comms', label: 'Communications', agent: 'Herald 📯' },
    { key: 'events', label: 'Events', agent: 'Ringmaster 🎪' },
    { key: 'referrals', label: 'Referrals', agent: 'Magnet 🧲' }
];

function UserForm({ initial, meta, onSave, onCancel, saving }) {
    const [f, setF] = useState(initial);
    const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
    const isNew = !initial.id;
    const setModuleAccess = (mod, val) => setF((p) => {
        const next = { ...(p.module_access || {}) };
        if (val === 'default') delete next[mod]; else next[mod] = val;
        return { ...p, module_access: next };
    });
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
            <div className="ch-field">
                <label>WhatsApp number</label>
                <PhoneInput value={f.phone || ''} onChange={(digits) => set('phone', digits)} />
                <p className="ch-muted" style={{ fontSize: '0.72rem', marginTop: 4 }}>
                    Only this number can activate the WhatsApp assistant for this account — a code texted from any other number is refused.
                </p>
            </div>
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
            {!isNew && (
                <>
                    <div className="ch-section-title">Module access (assistant &amp; WhatsApp)</div>
                    <p className="ch-muted" style={{ fontSize: '0.76rem', marginTop: '-0.25rem' }}>
                        Override the role default for this person. A denied module means the assistant replies
                        “you don’t have access” when they ask about it — on the web and over WhatsApp.
                    </p>
                    {MODULE_CATALOG.map((m) => {
                        const cur = f.module_access?.[m.key] || 'default';
                        return (
                            <div key={m.key} className="ch-field" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                <div style={{ fontSize: '0.85rem' }}>
                                    <strong>{m.label}</strong> <span className="ch-muted">· {m.agent}</span>
                                </div>
                                <select value={cur} onChange={(e) => setModuleAccess(m.key, e.target.value)} style={{ maxWidth: 160 }}>
                                    <option value="default">Role default</option>
                                    <option value="allow">Allow</option>
                                    <option value="deny">Deny</option>
                                </select>
                            </div>
                        );
                    })}
                </>
            )}
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
            <div className="ch-field"><label>Role rule name *</label><input required value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Reps — Support desk access" /></div>
            <div className="ch-form-grid">
                <div className="ch-field"><label>Applies to role</label><select value={f.role} onChange={(e) => set('role', e.target.value)}>{meta.roles.map((r) => <option key={r}>{r}</option>)}</select></div>
                <div className="ch-field"><label>Module (enables its agent)</label>
                    <select value={f.module} onChange={(e) => set('module', e.target.value)}>
                        <option value="*">All modules (full access)</option>
                        {MODULE_CATALOG.map((m) => <option key={m.key} value={m.key}>{m.label} · {m.agent}</option>)}
                    </select>
                </div>
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
                <button type="submit" className="btn btn-primary">Add role access</button>
            </div>
        </form>
    );
}

export default function UserManagement() {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [policies, setPolicies] = useState([]);
    const [proposals, setProposals] = useState([]);
    const [identities, setIdentities] = useState([]);
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
            const [u, m, p, pr, ids] = await Promise.all([
                usersApi.list(), usersApi.meta(), usersApi.policies(),
                agentKeysApi.proposals().catch(() => []),
                whatsappApi.identities().catch(() => [])
            ]);
            setUsers(u); setMeta(m); setPolicies(p); setProposals(pr); setIdentities(ids);
        } catch (e) { setError(e.message || 'Failed to load'); }
    };
    useEffect(() => { load(); }, []);

    const blankUser = () => ({ email: '', name: '', password: '', role: 'rep', region: '', business_unit: '', team: '', agent_access: 'read', module_access: {}, phone: '' });

    const saveUser = async (f) => {
        setSaving(true);
        try {
            if (f.id) await usersApi.update(f.id, { name: f.name, role: f.role, region: f.region, business_unit: f.business_unit, team: f.team, agent_access: f.agent_access, module_access: f.module_access || {}, phone: f.phone || '', ...(f.password ? { password: f.password } : {}) });
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

    // WhatsApp activation status for a user: no number registered / registered but
    // not yet activated / active (a linked number matches the registered one).
    const digits = (p) => String(p || '').replace(/[^\d]/g, '');
    const waStatus = (u) => {
        const reg = digits(u.phone);
        if (!reg) return { label: 'No number', cls: 'ch-badge--stage' };
        const active = identities.some((i) => digits(i.phone) === reg && i.user_id === u.id);
        return active
            ? { label: 'Active', cls: 'ch-badge--good' }
            : { label: 'Pending', cls: 'ch-badge--prospect' };
    };

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
                        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Agent access</th><th>WhatsApp</th><th>Region</th><th>Team</th><th></th></tr></thead>
                        <tbody>
                            {pagedUsers.map((u) => {
                                const wa = waStatus(u);
                                return (
                                <tr key={u.id}>
                                    <td className="ch-acct-name">{u.name}</td>
                                    <td className="ch-muted">{u.email}</td>
                                    <td><span className={`ch-badge ${ROLE_BADGE[u.role] || 'ch-badge--direct'}`}>{u.role}</span></td>
                                    <td><span className={`ch-badge ${AGENT_ACCESS_BADGE[agentAccessOf(u)].cls}`}><Bot size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />{AGENT_ACCESS_BADGE[agentAccessOf(u)].label}</span></td>
                                    <td>
                                        <span className={`ch-badge ${wa.cls}`}><MessageCircle size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />{wa.label}</span>
                                        {u.phone && <div className="ch-muted" style={{ fontSize: '0.68rem', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>+{digits(u.phone)}</div>}
                                    </td>
                                    <td>{u.region || <span className="ch-muted">—</span>}</td>
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
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <Pagination {...pg} />
            </div>

            {canGovernAgents && (
                <>
                    <div className="ch-section-title" style={{ border: 'none', marginBottom: '0.75rem' }}>
                        <MessageCircle size={16} style={{ display: 'inline', marginRight: 6 }} />
                        WhatsApp-verified users ({identities.length})
                    </div>
                    <div className="glass-card" style={{ padding: 0, marginBottom: '2rem' }}>
                        <div className="ch-table-wrap">
                            <table className="ch-table">
                                <thead><tr><th>User</th><th>Role</th><th>Verified number</th><th>Verified</th><th>Last active</th></tr></thead>
                                <tbody>
                                    {identities.length === 0 && (
                                        <tr><td colSpan={5} className="ch-muted" style={{ textAlign: 'center', padding: '18px' }}>
                                            No numbers linked yet. Users link their own from the assistant → WhatsApp, after signing in. Answers over WhatsApp are scoped to each user's access.
                                        </td></tr>
                                    )}
                                    {identities.map((i) => (
                                        <tr key={i.phone}>
                                            <td className="ch-acct-name">{i.name}<div className="ch-muted" style={{ fontSize: '0.72rem' }}>{i.email}</div></td>
                                            <td><span className={`ch-badge ${ROLE_BADGE[i.role] || 'ch-badge--direct'}`}>{i.role}</span></td>
                                            <td style={{ fontVariantNumeric: 'tabular-nums' }}>+{i.phone}</td>
                                            <td className="ch-muted">{i.verified_at ? new Date(i.verified_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</td>
                                            <td className="ch-muted">{i.last_seen_at ? new Date(i.last_seen_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div className="ch-section-title" style={{ border: 'none', margin: 0 }}><Shield size={16} style={{ display: 'inline', marginRight: 6 }} />Roles &amp; module access ({policies.length})</div>
                {canWrite && <button className="btn btn-ghost" onClick={() => setPolicyModal(true)}><Plus size={16} /> Add Role</button>}
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

            {canGovernAgents && <ActivityLogSection />}

            <Modal isOpen={!!userModal} onClose={() => setUserModal(null)} title={userModal?.id ? 'Edit user' : 'Add user'} maxWidth="560px">
                {userModal && <UserForm initial={userModal} meta={meta} onSave={saveUser} onCancel={() => setUserModal(null)} saving={saving} />}
            </Modal>
            <Modal isOpen={policyModal} onClose={() => setPolicyModal(false)} title="Add Role — grant a role access to a module" maxWidth="560px">
                <PolicyForm meta={meta} onSave={savePolicy} onCancel={() => setPolicyModal(false)} />
            </Modal>
        </div>
    );
}

const fmtWhen = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const statusTone = (s) => (s >= 500 ? '#f87171' : s >= 400 ? '#fbbf24' : '#34d399');

/**
 * Activity Log — a merged, filterable audit of human writes/logins and delegated
 * agent actions. Admin/manager only (the endpoint enforces it too).
 */
function ActivityLogSection() {
    const empty = { actor: 'All', action: 'All', entity: 'All', from: '', to: '' };
    const [meta, setMeta] = useState({ actors: [], actions: [], entities: [] });
    const [rows, setRows] = useState(null);
    const [f, setF] = useState(empty);
    const [error, setError] = useState('');
    const setK = (k, v) => setF((p) => ({ ...p, [k]: v }));

    useEffect(() => { activityApi.meta().then(setMeta).catch(() => {}); }, []);
    useEffect(() => {
        let alive = true;
        activityApi.list(f).then((r) => alive && setRows(r)).catch((e) => alive && setError(e.message));
        return () => { alive = false; };
    }, [f]);

    return (
        <div style={{ marginTop: '2rem' }}>
            <div className="ch-section-title" style={{ border: 'none', marginBottom: '0.75rem' }}>
                <ScrollText size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: '-3px' }} />
                Activity Log <span className="ch-muted" style={{ fontWeight: 400, fontSize: '0.82rem' }}>— who did what, users and agents</span>
            </div>

            <div className="ch-toolbar" style={{ flexWrap: 'wrap' }}>
                <select className="ch-filter" value={f.actor} onChange={(e) => setK('actor', e.target.value)}>
                    <option value="All">All users & agents</option>
                    {meta.actors.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                <select className="ch-filter" value={f.action} onChange={(e) => setK('action', e.target.value)}>
                    <option value="All">All tasks</option>
                    {meta.actions.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                <select className="ch-filter" value={f.entity} onChange={(e) => setK('entity', e.target.value)}>
                    <option value="All">All areas</option>
                    {meta.entities.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                <label className="ch-muted" style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 5 }}>From <input type="date" className="ch-filter" value={f.from} onChange={(e) => setK('from', e.target.value)} /></label>
                <label className="ch-muted" style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 5 }}>To <input type="date" className="ch-filter" value={f.to} onChange={(e) => setK('to', e.target.value)} /></label>
                {(f.actor !== 'All' || f.action !== 'All' || f.entity !== 'All' || f.from || f.to) && (
                    <button className="btn btn-ghost" onClick={() => setF(empty)}><RotateCcw size={14} /> Clear</button>
                )}
                <div className="ch-spacer" />
                <span className="ch-muted" style={{ fontSize: '0.8rem' }}>{rows ? `${rows.length} events` : '…'}</span>
            </div>

            {error && <div className="ch-error">{error}</div>}

            <div className="glass-card" style={{ padding: 0 }}>
                <div className="ch-table-wrap" style={{ maxHeight: '60vh' }}>
                    <table className="ch-table">
                        <thead><tr><th>Who</th><th>Task</th><th>Area</th><th>When</th><th>Result</th></tr></thead>
                        <tbody>
                            {!rows && <tr><td colSpan={5} className="ch-muted" style={{ textAlign: 'center', padding: 18 }}>Loading…</td></tr>}
                            {rows && rows.length === 0 && <tr><td colSpan={5} className="ch-muted" style={{ textAlign: 'center', padding: 18 }}>No activity matches these filters.</td></tr>}
                            {rows && rows.map((r, i) => (
                                <tr key={i}>
                                    <td>
                                        <span className={`ch-badge ${r.actor_type === 'agent' ? 'ch-badge--direct' : 'ch-badge--prospect'}`}>
                                            {r.actor_type === 'agent' ? <Bot size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} /> : <UserIcon size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />}
                                            {r.actor_name}
                                        </span>
                                    </td>
                                    <td>{r.action}{r.entity_id ? <span className="ch-muted"> · {r.entity_id}</span> : ''}</td>
                                    <td className="ch-muted">{r.entity}</td>
                                    <td className="ch-muted" style={{ whiteSpace: 'nowrap' }}>{fmtWhen(r.at)}</td>
                                    <td><span style={{ color: statusTone(r.status), fontWeight: 600, fontSize: '0.8rem' }}>{r.status || '—'}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
