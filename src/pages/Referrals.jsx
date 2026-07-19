import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Trophy, Gift, Award } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { referralsApi } from '../api/referrals';
import { accountsApi } from '../api/accounts';
import Modal from '../components/Modal';
import ModuleReportMenu from '../components/ModuleReportMenu';
import './CashHorizon.css';
import './Referrals.css';

const fmtInr = (n) => {
    const v = Math.round(Number(n) || 0);
    if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
    if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
    if (v >= 1e3) return `₹${(v / 1e3).toFixed(1)}k`;
    return `₹${v}`;
};
const STATUS_CLASS = { New: 're-s-new', Contacted: 're-s-contacted', Qualified: 're-s-qualified', Converted: 're-s-converted', Declined: 're-s-declined' };
const MEDAL = ['🥇', '🥈', '🥉'];

export default function Referrals() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [meta, setMeta] = useState(null);
    const [stats, setStats] = useState(null);
    const [list, setList] = useState([]);
    const [advocates, setAdvocates] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [modal, setModal] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');

    const load = async () => {
        try {
            setError('');
            const [s, l, a] = await Promise.all([referralsApi.stats(), referralsApi.list(), referralsApi.advocates()]);
            setStats(s); setList(l); setAdvocates(a);
        } catch (e) { setError(e.message || 'Failed to load'); }
    };
    useEffect(() => {
        let alive = true;
        Promise.all([referralsApi.meta(), accountsApi.list()])
            .then(([m, ac]) => { if (!alive) return; setMeta(m); setAccounts(ac.filter((x) => x.segment === 'Customer')); })
            .catch((e) => alive && setError(e.message));
        load();
        return () => { alive = false; };
    }, []);

    const create = async (form) => { try { await referralsApi.create(form); setModal(null); await load(); } catch (e) { setError(e.message); } };
    const setStatus = async (r, status) => { try { await referralsApi.update(r.id, { status }); await load(); } catch (e) { setError(e.message); } };
    const togglePaid = async (r) => { try { await referralsApi.update(r.id, { reward_paid: !r.reward_paid }); await load(); } catch (e) { setError(e.message); } };
    const remove = async (r) => { if (!window.confirm(`Delete referral "${r.referred_name}"?`)) return; try { await referralsApi.remove(r.id); await load(); } catch (e) { setError(e.message); } };
    const seed = async () => { setBusy('seed'); try { await referralsApi.seedSample(); await load(); } catch (e) { setError(e.message); } finally { setBusy(''); } };

    if (!meta || !stats) return <div className="ch-empty">Loading…</div>;

    return (
        <div className="animate-fade-in">
            <header className="ch-head">
                <div>
                    <h1 className="ch-title">Referrals</h1>
                    <p className="ch-sub">Turn happy customers into an acquisition channel. Magnet 🧲 tracks every introduction to conversion — and the rewards you owe.</p>
                </div>
                <div style={{ display: 'flex', gap: '.6rem' }}>
                    {isAdmin && !list.length && <button className="btn btn-ghost" onClick={seed} disabled={busy === 'seed'}>{busy === 'seed' ? 'Seeding…' : 'Seed sample'}</button>}
                    <ModuleReportMenu module="referrals" title="Referrals" />
                    <button className="btn btn-primary" onClick={() => setModal({ account: accounts[0]?.name || '', referred_name: '', contact: '', status: 'New', value_amount: 0, currency: 'INR', reward: '' })}><Plus size={18} /> New referral</button>
                </div>
            </header>

            {error && <div className="ch-error">{error}</div>}

            <div className="re-strip">
                <div className="re-strip-stat"><span className="re-strip-num">{stats.total}</span><span className="re-strip-label">referrals</span></div>
                <div className="re-strip-stat"><span className="re-strip-num" style={{ color: '#10b981' }}>{stats.converted}</span><span className="re-strip-label">converted · {stats.conversionRate === null ? '—' : `${stats.conversionRate}%`}</span></div>
                <div className="re-strip-stat"><span className="re-strip-num" style={{ color: '#a855f7' }}>{fmtInr(stats.referredValueInr)}</span><span className="re-strip-label">referred pipeline</span></div>
                <div className="re-strip-stat"><span className="re-strip-num" style={{ color: stats.rewardsOwed ? '#f59e0b' : 'inherit' }}>{stats.rewardsOwed}</span><span className="re-strip-label">rewards owed</span></div>
            </div>

            <div className="re-grid">
                {/* Advocate leaderboard */}
                <div className="glass-card re-board">
                    <div className="re-board-head"><Trophy size={16} color="#fbbf24" /> Advocate leaderboard</div>
                    {advocates.length === 0 ? <div className="ch-muted" style={{ padding: '1rem' }}>No advocates yet.</div> : (
                        <div className="re-advocates">
                            {advocates.map((a, i) => (
                                <div className="re-advocate" key={a.account}>
                                    <span className="re-rank">{MEDAL[i] || `#${i + 1}`}</span>
                                    <div className="re-adv-body">
                                        <div className="re-adv-name">{a.account}</div>
                                        <div className="re-adv-meta">{a.referrals} referral{a.referrals === 1 ? '' : 's'} · {a.converted} converted</div>
                                    </div>
                                    <div className="re-adv-value">{a.valueInr ? fmtInr(a.valueInr) : '—'}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Referral list */}
                <div className="glass-card re-list">
                    <div className="re-board-head"><Award size={16} color="#f97316" /> Referrals</div>
                    {list.length === 0 ? <div className="ch-muted" style={{ padding: '1rem' }}>No referrals yet.</div> : (
                        <div className="re-items">
                            {list.map((r) => (
                                <div className="re-item" key={r.id}>
                                    <div className="re-item-main">
                                        <div className="re-item-name">{r.referred_name}</div>
                                        <div className="re-item-meta">via {r.account}{r.contact ? ` · ${r.contact}` : ''}{r.valueInr ? ` · ${fmtInr(r.valueInr)}` : ''}</div>
                                    </div>
                                    {r.reward ? (
                                        <button className={`re-reward ${r.reward_paid ? 're-reward-paid' : ''}`} onClick={() => togglePaid(r)} title={r.reward_paid ? 'Reward paid' : 'Mark reward paid'}>
                                            <Gift size={12} /> {r.reward_paid ? 'Paid' : r.reward}
                                        </button>
                                    ) : null}
                                    <select className={`re-status ${STATUS_CLASS[r.status]}`} value={r.status} onChange={(e) => setStatus(r, e.target.value)}>
                                        {meta.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <button className="re-x" onClick={() => remove(r)}><Trash2 size={13} /></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {modal && <ReferralModal init={modal} accounts={accounts} onClose={() => setModal(null)} onSave={create} />}
        </div>
    );
}

function ReferralModal({ init, accounts, onClose, onSave }) {
    const [f, setF] = useState(init);
    const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
    return (
        <Modal isOpen onClose={onClose} title="New referral" maxWidth="480px">
            <form onSubmit={(e) => { e.preventDefault(); onSave({ ...f, value_amount: Number(f.value_amount) }); }} className="ch-form">
                <div className="ch-field"><label>Referring customer (advocate)</label>
                    <select value={f.account} onChange={(e) => set('account', e.target.value)} required>
                        <option value="">Select a customer…</option>
                        {accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                    </select>
                </div>
                <div className="ch-field"><label>Referred company</label>
                    <input value={f.referred_name} onChange={(e) => set('referred_name', e.target.value)} placeholder="e.g. Acme NBFC" required />
                </div>
                <div className="ch-field"><label>Contact</label>
                    <input value={f.contact} onChange={(e) => set('contact', e.target.value)} placeholder="Name / email (optional)" />
                </div>
                <div className="ch-form-grid">
                    <div className="ch-field"><label>Potential value</label>
                        <input type="number" value={f.value_amount} onChange={(e) => set('value_amount', e.target.value)} />
                    </div>
                    <div className="ch-field"><label>Currency</label>
                        <select value={f.currency} onChange={(e) => set('currency', e.target.value)}><option>INR</option><option>USD</option></select>
                    </div>
                </div>
                <div className="ch-field"><label>Reward for advocate</label>
                    <input value={f.reward} onChange={(e) => set('reward', e.target.value)} placeholder="e.g. 1 month credit (optional)" />
                </div>
                <div className="ch-form-actions">
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={!f.account || !f.referred_name}>Create</button>
                </div>
            </form>
        </Modal>
    );
}
