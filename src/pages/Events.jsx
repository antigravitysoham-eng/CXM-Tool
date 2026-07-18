import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Calendar, MapPin, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { eventsApi } from '../api/events';
import { accountsApi } from '../api/accounts';
import Modal from '../components/Modal';
import ModuleReportMenu from '../components/ModuleReportMenu';
import './CashHorizon.css';
import './Events.css';

const STATUS_CLASS = { Planned: 'ev-s-planned', Open: 'ev-s-open', Live: 'ev-s-live', Completed: 'ev-s-done', Cancelled: 'ev-s-cancel' };
const TYPE_EMOJI = { Webinar: '💻', Workshop: '🛠️', Roundtable: '💬', 'User Group': '👥', Conference: '🎤', 'Office Hours': '🕐' };

export default function Events() {
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
        try { setError(''); const [s, l] = await Promise.all([eventsApi.stats(), eventsApi.list()]); setStats(s); setList(l); }
        catch (e) { setError(e.message || 'Failed to load'); }
    };
    useEffect(() => {
        let alive = true;
        Promise.all([eventsApi.meta(), accountsApi.list()])
            .then(([m, a]) => { if (!alive) return; setMeta(m); setAccounts(a.filter((x) => x.segment === 'Customer')); })
            .catch((e) => alive && setError(e.message));
        load();
        return () => { alive = false; };
    }, []);

    const create = async (form) => { try { await eventsApi.create(form); setModal(null); await load(); } catch (e) { setError(e.message); } };
    const setStatus = async (ev, status) => { try { await eventsApi.update(ev.id, { status }); await load(); } catch (e) { setError(e.message); } };
    const bump = async (ev, field, delta) => { try { await eventsApi.update(ev.id, { [field]: Math.max(0, (ev[field] || 0) + delta) }); await load(); } catch (e) { setError(e.message); } };
    const remove = async (ev) => { if (!window.confirm(`Delete "${ev.title}"?`)) return; try { await eventsApi.remove(ev.id); await load(); } catch (e) { setError(e.message); } };
    const seed = async () => { setBusy('seed'); try { await eventsApi.seedSample(); await load(); } catch (e) { setError(e.message); } finally { setBusy(''); } };

    if (!meta || !stats) return <div className="ch-empty">Loading…</div>;

    return (
        <div className="animate-fade-in">
            <header className="ch-head">
                <div>
                    <h1 className="ch-title">Events</h1>
                    <p className="ch-sub">Webinars, workshops and roundtables — registration to attendance. Ringmaster 🎪 makes sure nothing runs half-empty.</p>
                </div>
                <div style={{ display: 'flex', gap: '.6rem' }}>
                    {isAdmin && !list.length && <button className="btn btn-ghost" onClick={seed} disabled={busy === 'seed'}>{busy === 'seed' ? 'Seeding…' : 'Seed sample'}</button>}
                    <ModuleReportMenu module="events" title="Events" />
                    <button className="btn btn-primary" onClick={() => setModal({ account: accounts[0]?.name || '', title: '', type: 'Webinar', status: 'Planned', starts_at: '', location: '', capacity: 0 })}><Plus size={18} /> New event</button>
                </div>
            </header>

            {error && <div className="ch-error">{error}</div>}

            <div className="ev-strip">
                <div className="ev-strip-stat"><span className="ev-strip-num">{stats.events}</span><span className="ev-strip-label">events</span></div>
                <div className="ev-strip-stat"><span className="ev-strip-num" style={{ color: '#ec4899' }}>{stats.upcoming}</span><span className="ev-strip-label">upcoming</span></div>
                <div className="ev-strip-stat"><span className="ev-strip-num">{stats.totalRegistered}</span><span className="ev-strip-label">registrations</span></div>
                <div className="ev-strip-stat"><span className="ev-strip-num" style={{ color: '#10b981' }}>{stats.avgAttendanceRate === null ? '—' : `${stats.avgAttendanceRate}%`}</span><span className="ev-strip-label">avg attendance</span></div>
            </div>

            {list.length === 0 ? <div className="ch-empty">No events yet. Schedule a webinar or workshop to start.</div> : (
                <div className="ev-cards">
                    {list.map((ev) => (
                        <div className={`glass-card ev-card ${ev.upcoming ? 'ev-card-upcoming' : ''}`} key={ev.id}>
                            <div className="ev-card-head">
                                <div className="ev-card-type">{TYPE_EMOJI[ev.type] || '🎪'} {ev.type}</div>
                                <select className={`ev-status ${STATUS_CLASS[ev.status]}`} value={ev.status} onChange={(e) => setStatus(ev, e.target.value)}>
                                    {meta.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="ev-card-title">{ev.title}</div>
                            <div className="ev-card-meta">
                                <span><MapPin size={12} /> {ev.account}</span>
                                {ev.starts_at && <span><Calendar size={12} /> {new Date(ev.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                            </div>
                            <div className="ev-fill">
                                <div className="ev-fill-top"><span><Users size={12} /> {ev.registered}{ev.capacity ? ` / ${ev.capacity}` : ''} registered</span>{ev.fillRate !== null && <span>{ev.fillRate}%</span>}</div>
                                <div className="ev-fill-track"><div className="ev-fill-bar" style={{ width: `${Math.min(100, ev.fillRate || 0)}%` }} /></div>
                            </div>
                            {ev.status === 'Completed' && (
                                <div className="ev-attend">Attended {ev.attended} · <strong>{ev.attendanceRate === null ? '—' : `${ev.attendanceRate}%`}</strong> attendance</div>
                            )}
                            <div className="ev-card-actions">
                                <div className="ev-counter">
                                    <span>Reg</span>
                                    <button onClick={() => bump(ev, 'registered', -1)}>−</button>
                                    <button onClick={() => bump(ev, 'registered', 1)}>+</button>
                                </div>
                                {(ev.status === 'Live' || ev.status === 'Completed') && (
                                    <div className="ev-counter">
                                        <span>Att</span>
                                        <button onClick={() => bump(ev, 'attended', -1)}>−</button>
                                        <button onClick={() => bump(ev, 'attended', 1)}>+</button>
                                    </div>
                                )}
                                <button className="ev-x" onClick={() => remove(ev)}><Trash2 size={13} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modal && <EventModal init={modal} meta={meta} accounts={accounts} onClose={() => setModal(null)} onSave={create} />}
        </div>
    );
}

function EventModal({ init, meta, accounts, onClose, onSave }) {
    const [f, setF] = useState(init);
    const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
    return (
        <Modal isOpen onClose={onClose} title="New event" maxWidth="500px">
            <form onSubmit={(e) => { e.preventDefault(); onSave({ ...f, capacity: Number(f.capacity) }); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                <div className="form-group"><label>Customer</label>
                    <select value={f.account} onChange={(e) => set('account', e.target.value)} required>
                        <option value="">Select a customer…</option>
                        {accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                    </select>
                </div>
                <div className="form-group"><label>Title</label>
                    <input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Vendor Pulse deep-dive" required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.8rem' }}>
                    <div className="form-group"><label>Type</label>
                        <select value={f.type} onChange={(e) => set('type', e.target.value)}>{meta.types.map((t) => <option key={t}>{t}</option>)}</select>
                    </div>
                    <div className="form-group"><label>Status</label>
                        <select value={f.status} onChange={(e) => set('status', e.target.value)}>{meta.statuses.map((s) => <option key={s}>{s}</option>)}</select>
                    </div>
                    <div className="form-group"><label>Date</label>
                        <input type="date" value={f.starts_at} onChange={(e) => set('starts_at', e.target.value)} />
                    </div>
                    <div className="form-group"><label>Capacity</label>
                        <input type="number" value={f.capacity} onChange={(e) => set('capacity', e.target.value)} />
                    </div>
                </div>
                <div className="form-group"><label>Location</label>
                    <input value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="Online / venue (optional)" />
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={!f.account || !f.title}>Create</button>
                </div>
            </form>
        </Modal>
    );
}
