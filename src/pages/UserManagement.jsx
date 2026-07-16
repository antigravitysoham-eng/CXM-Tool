import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Shield, Users as UsersIcon, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../api/users';
import Modal from '../components/Modal';
import './CashHorizon.css';

const ROLE_BADGE = { admin: 'ch-badge--critical', manager: 'ch-badge--prospect', rep: 'ch-badge--direct' };

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
    const [meta, setMeta] = useState(null);
    const [error, setError] = useState('');
    const [userModal, setUserModal] = useState(null);
    const [policyModal, setPolicyModal] = useState(false);
    const [saving, setSaving] = useState(false);

    const canWrite = (meta?.role || user?.role) === 'admin';

    const load = async () => {
        try {
            setError('');
            const [u, m, p] = await Promise.all([usersApi.list(), usersApi.meta(), usersApi.policies()]);
            setUsers(u); setMeta(m); setPolicies(p);
        } catch (e) { setError(e.message || 'Failed to load'); }
    };
    useEffect(() => { load(); }, []);

    const blankUser = () => ({ email: '', name: '', password: '', role: 'rep', region: '', business_unit: '', team: '' });

    const saveUser = async (f) => {
        setSaving(true);
        try {
            if (f.id) await usersApi.update(f.id, { name: f.name, role: f.role, region: f.region, business_unit: f.business_unit, team: f.team, ...(f.password ? { password: f.password } : {}) });
            else await usersApi.create(f);
            setUserModal(null); await load();
        } catch (e) { setError(e.message); } finally { setSaving(false); }
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

    if (!meta) return <div className="ch-empty">Loading…</div>;

    return (
        <div className="animate-fade-in">
            <header className="ch-head">
                <div>
                    <h1 className="ch-title">Access &amp; Users</h1>
                    <p className="ch-sub">Attribute-based access control — add users, set attributes, and govern who sees what.</p>
                </div>
                {canWrite && <button className="btn btn-primary" onClick={() => setUserModal(blankUser())}><Plus size={18} /> Add user</button>}
            </header>

            {error && <div className="ch-error">{error}</div>}
            {!canWrite && <div className="ch-error" style={{ background: 'rgba(148,163,184,0.1)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}><Lock size={14} style={{ display: 'inline' }} /> You have read-only access. Only admins can add or change users and policies.</div>}

            <div className="ch-section-title" style={{ border: 'none', marginBottom: '0.75rem' }}><UsersIcon size={16} style={{ display: 'inline', marginRight: 6 }} />Users ({users.length})</div>
            <div className="glass-card" style={{ padding: 0, marginBottom: '2rem' }}>
                <div className="ch-table-wrap">
                    <table className="ch-table">
                        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Region</th><th>Business unit</th><th>Team</th><th></th></tr></thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u.id}>
                                    <td className="ch-acct-name">{u.name}</td>
                                    <td className="ch-muted">{u.email}</td>
                                    <td><span className={`ch-badge ${ROLE_BADGE[u.role] || 'ch-badge--direct'}`}>{u.role}</span></td>
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

            <Modal isOpen={!!userModal} onClose={() => setUserModal(null)} title={userModal?.id ? 'Edit user' : 'Add user'} maxWidth="560px">
                {userModal && <UserForm initial={userModal} meta={meta} onSave={saveUser} onCancel={() => setUserModal(null)} saving={saving} />}
            </Modal>
            <Modal isOpen={policyModal} onClose={() => setPolicyModal(false)} title="Add access policy" maxWidth="560px">
                <PolicyForm meta={meta} onSave={savePolicy} onCancel={() => setPolicyModal(false)} />
            </Modal>
        </div>
    );
}
