import React, { useEffect, useState } from 'react';
import { Plus, Send, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { commsApi } from '../api/comms';
import { accountsApi } from '../api/accounts';
import Modal from '../components/Modal';
import ModuleReportMenu from '../components/ModuleReportMenu';
import './CashHorizon.css';
import './Comms.css';
import { Drillable } from '../components/MetricDrill';

const TYPE_CLASS = { Email: 'cm-t-email', Newsletter: 'cm-t-news', Announcement: 'cm-t-ann', 'In-app': 'cm-t-inapp', SMS: 'cm-t-sms' };
const STATUS_CLASS = { Draft: 'cm-s-draft', Scheduled: 'cm-s-sched', Sent: 'cm-s-sent' };

function Meter({ label, value, color }) {
    return (
        <div className="cm-meter">
            <div className="cm-meter-top"><span>{label}</span><span>{value === null ? '—' : `${value}%`}</span></div>
            <div className="cm-meter-track"><div className="cm-meter-fill" style={{ width: `${value || 0}%`, background: color }} /></div>
        </div>
    );
}

export default function Comms() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [meta, setMeta] = useState(null);
    const [stats, setStats] = useState(null);
    const [list, setList] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [modal, setModal] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');

    const load = async () => {
        try { setError(''); const [s, l] = await Promise.all([commsApi.stats(), commsApi.list()]); setStats(s); setList(l); }
        catch (e) { setError(e.message || 'Failed to load'); }
    };
    useEffect(() => {
        let alive = true;
        Promise.all([commsApi.meta(), accountsApi.list()])
            .then(([m, a]) => { if (!alive) return; setMeta(m); setAccounts(a.filter((x) => x.segment === 'Customer')); })
            .catch((e) => alive && setError(e.message));
        load();
        return () => { alive = false; };
    }, []);

    const create = async (form) => { try { await commsApi.create(form); setModal(null); await load(); } catch (e) { setError(e.message); } };
    const send = async (c) => { setBusy(`send-${c.id}`); try { await commsApi.send(c.id, { recipients: c.recipients || 50 }); await load(); } catch (e) { setError(e.message); } finally { setBusy(''); } };
    const remove = async (c) => { if (!window.confirm(`Delete "${c.title}"?`)) return; try { await commsApi.remove(c.id); await load(); } catch (e) { setError(e.message); } };
    const seed = async () => { setBusy('seed'); try { await commsApi.seedSample(); await load(); } catch (e) { setError(e.message); } finally { setBusy(''); } };

    if (!meta || !stats) return <div className="ch-empty">Loading…</div>;

    return (
        <div className="animate-fade-in">
            <header className="ch-head">
                <div>
                    <h1 className="ch-title">Communications</h1>
                    <p className="ch-sub">Every customer message and how it landed. Herald 📯 tracks open and click rates so you know what got read.</p>
                </div>
                <div style={{ display: 'flex', gap: '.6rem' }}>
                    {isAdmin && !list.length && <button className="btn btn-ghost" onClick={seed} disabled={busy === 'seed'}>{busy === 'seed' ? 'Seeding…' : 'Seed sample'}</button>}
                    <ModuleReportMenu module="comms" title="Communications" />
                    <button className="btn btn-primary" onClick={() => setModal({ account: accounts[0]?.name || '', title: '', type: 'Email', recipients: 0 })}><Plus size={18} /> New campaign</button>
                </div>
            </header>

            {error && <div className="ch-error">{error}</div>}

            <div className="cm-strip">
                <Drillable metric="comms.campaigns" label="Campaigns"><div className="cm-strip-stat"><span className="cm-strip-num">{stats.campaigns}</span><span className="cm-strip-label">campaigns</span></div></Drillable>
                <Drillable metric="comms.sent" label="Sent"><div className="cm-strip-stat"><span className="cm-strip-num">{stats.sent}</span><span className="cm-strip-label">sent · {stats.totalRecipients} recipients</span></div></Drillable>
                <div className="cm-strip-stat"><span className="cm-strip-num" style={{ color: '#10b981' }}>{stats.avgOpenRate === null ? '—' : `${stats.avgOpenRate}%`}</span><span className="cm-strip-label">avg open</span></div>
                <div className="cm-strip-stat"><span className="cm-strip-num" style={{ color: '#a855f7' }}>{stats.avgClickRate === null ? '—' : `${stats.avgClickRate}%`}</span><span className="cm-strip-label">avg click</span></div>
            </div>

            {list.length === 0 ? <div className="ch-empty">No communications yet. Draft one to start tracking engagement.</div> : (
                <div className="cm-cards">
                    {list.map((c) => (
                        <div className="glass-card cm-card" key={c.id}>
                            <div className="cm-card-head">
                                <div className="cm-card-titles">
                                    <span className={`cm-type ${TYPE_CLASS[c.type]}`}>{c.type}</span>
                                    <strong>{c.title}</strong>
                                </div>
                                <span className={`cm-status ${STATUS_CLASS[c.status]}`}>{c.status}</span>
                            </div>
                            <div className="ch-muted cm-card-acct">{c.account} · {c.recipients || 0} recipients</div>
                            {c.status === 'Sent' ? (
                                <div className="cm-meters">
                                    <Meter label="Open rate" value={c.openRate} color="#10b981" />
                                    <Meter label="Click rate" value={c.clickRate} color="#a855f7" />
                                </div>
                            ) : (
                                <div className="cm-card-actions">
                                    <button className="btn btn-ghost cm-sm" onClick={() => send(c)} disabled={busy === `send-${c.id}`}><Send size={13} /> {busy === `send-${c.id}` ? 'Sending…' : 'Mark sent'}</button>
                                </div>
                            )}
                            <button className="cm-x" onClick={() => remove(c)}><Trash2 size={13} /></button>
                        </div>
                    ))}
                </div>
            )}

            {modal && <CommModal init={modal} meta={meta} accounts={accounts} onClose={() => setModal(null)} onSave={create} />}
        </div>
    );
}

function CommModal({ init, meta, accounts, onClose, onSave }) {
    const [f, setF] = useState(init);
    const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
    return (
        <Modal isOpen onClose={onClose} title="New communication" maxWidth="460px">
            <form onSubmit={(e) => { e.preventDefault(); onSave({ ...f, recipients: Number(f.recipients) }); }} className="ch-form">
                <div className="ch-field"><label>Customer</label>
                    <select value={f.account} onChange={(e) => set('account', e.target.value)} required>
                        <option value="">Select a customer…</option>
                        {accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                    </select>
                </div>
                <div className="ch-field"><label>Title</label>
                    <input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Q3 product newsletter" required />
                </div>
                <div className="ch-form-grid">
                    <div className="ch-field"><label>Channel</label>
                        <select value={f.type} onChange={(e) => set('type', e.target.value)}>{meta.types.map((t) => <option key={t}>{t}</option>)}</select>
                    </div>
                    <div className="ch-field"><label>Recipients</label>
                        <input type="number" value={f.recipients} onChange={(e) => set('recipients', e.target.value)} />
                    </div>
                </div>
                <div className="ch-form-actions">
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={!f.account || !f.title}>Create</button>
                </div>
            </form>
        </Modal>
    );
}
