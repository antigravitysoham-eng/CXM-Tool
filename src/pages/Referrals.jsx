import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Trophy, Gift, Award, Megaphone, BellRing } from 'lucide-react';
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
    const [nudges, setNudges] = useState(null);
    const [nudgeModal, setNudgeModal] = useState(null); // { account }
    const [view, setView] = useState('pipeline'); // 'pipeline' | 'nudges'
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');

    const load = async () => {
        try {
            setError('');
            const [s, l, a, n] = await Promise.all([referralsApi.stats(), referralsApi.list(), referralsApi.advocates(), referralsApi.nudges()]);
            setStats(s); setList(l); setAdvocates(a); setNudges(n);
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
    const logNudge = async (form) => {
        try { const board = await referralsApi.addNudge(form); setNudges(board); setNudgeModal(null); } catch (e) { setError(e.message); }
    };

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
                {nudges && <div className="re-strip-stat"><span className="re-strip-num" style={{ color: nudges.neverNudged ? '#ef4444' : '#10b981' }}>{nudges.nudged}/{nudges.customers}</span><span className="re-strip-label">customers nudged</span></div>}
            </div>

            <div className="re-toggle">
                <button className={view === 'pipeline' ? 'on' : ''} onClick={() => setView('pipeline')}><Award size={15} /> Pipeline</button>
                <button className={view === 'nudges' ? 'on' : ''} onClick={() => setView('nudges')}><BellRing size={15} /> Nudge tracker{nudges?.neverNudged ? ` (${nudges.neverNudged} never asked)` : ''}</button>
            </div>

            {view === 'nudges' ? (
                <NudgeTracker nudges={nudges} onLog={(account) => setNudgeModal({ account })} />
            ) : (
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
            )}

            {modal && <ReferralModal init={modal} accounts={accounts} onClose={() => setModal(null)} onSave={create} />}
            {nudgeModal && <NudgeModal account={nudgeModal.account} outcomes={meta.nudgeOutcomes || []} onClose={() => setNudgeModal(null)} onSave={logNudge} />}
        </div>
    );
}

/* ---------------- Nudge tracker ---------------- */

const OUTCOME_CLASS = {
    'Agreed to refer': 're-s-converted', 'Gave a name': 're-s-converted',
    'Will think about it': 're-s-qualified', Declined: 're-s-declined', 'No answer': 're-s-new'
};

function NudgeTracker({ nudges, onLog }) {
    const [open, setOpen] = useState(null); // account whose history is expanded
    if (!nudges) return <div className="ch-empty">Loading…</div>;
    if (!nudges.rows.length) return <div className="ch-empty">No customers yet.</div>;
    return (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="re-nudge-table">
                <thead>
                    <tr><th>Customer</th><th>Nudged?</th><th>Last asked</th><th>What they said</th><th>Outcome</th><th>Referrals</th><th></th></tr>
                </thead>
                <tbody>
                    {nudges.rows.map((r) => (
                        <React.Fragment key={r.account}>
                            <tr className={r.nudged ? '' : 're-nudge-never'}>
                                <td className="re-item-name">{r.account}</td>
                                <td>
                                    {r.nudged
                                        ? <span className="re-nudge-yes">✓ {r.nudgeCount}×</span>
                                        : <span className="re-nudge-no">Never asked</span>}
                                </td>
                                <td className="re-item-meta">{r.lastNudgedAt || '—'}</td>
                                <td className="re-nudge-quote">{r.lastResponse ? `“${r.lastResponse}”` : <span className="ch-muted">—</span>}</td>
                                <td>{r.lastOutcome ? <span className={`re-status ${OUTCOME_CLASS[r.lastOutcome] || 're-s-new'}`} style={{ padding: '2px 8px' }}>{r.lastOutcome}</span> : '—'}</td>
                                <td className="re-item-meta" style={{ textAlign: 'center' }}>{r.referrals || '—'}</td>
                                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    {r.nudgeCount > 1 && <button className="btn btn-ghost re-sm" onClick={() => setOpen(open === r.account ? null : r.account)}>{open === r.account ? 'Hide' : 'History'}</button>}
                                    <button className="btn btn-primary re-sm" onClick={() => onLog(r.account)}><BellRing size={13} /> Log nudge</button>
                                </td>
                            </tr>
                            {open === r.account && r.history.map((h) => (
                                <tr key={h.id} className="re-nudge-hist">
                                    <td /><td className="re-item-meta">{h.nudged_at}</td><td colSpan={2} className="re-nudge-quote">{h.response ? `“${h.response}”` : '—'}</td>
                                    <td colSpan={3}><span className={`re-status ${OUTCOME_CLASS[h.outcome] || 're-s-new'}`} style={{ padding: '2px 8px' }}>{h.outcome}</span>{h.nudged_by ? <span className="ch-muted"> · by {h.nudged_by}</span> : null}</td>
                                </tr>
                            ))}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function NudgeModal({ account, outcomes, onClose, onSave }) {
    const [f, setF] = useState({ account, nudged_at: new Date().toISOString().slice(0, 10), response: '', outcome: outcomes[0] || 'No answer' });
    const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
    return (
        <Modal isOpen onClose={onClose} title={`Log a referral nudge — ${account}`} maxWidth="480px">
            <form className="ch-form" onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
                <div className="ch-form-grid">
                    <div className="ch-field"><label>When asked</label>
                        <input type="date" value={f.nudged_at} onChange={(e) => set('nudged_at', e.target.value)} />
                    </div>
                    <div className="ch-field"><label>Outcome</label>
                        <select value={f.outcome} onChange={(e) => set('outcome', e.target.value)}>
                            {outcomes.map((o) => <option key={o}>{o}</option>)}
                        </select>
                    </div>
                </div>
                <div className="ch-field"><label>What did they say?</label>
                    <textarea rows={3} value={f.response} onChange={(e) => set('response', e.target.value)} placeholder="e.g. Happy to intro us to their sister company after the audit wraps up in March" />
                </div>
                <div className="ch-form-actions">
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="btn btn-primary"><BellRing size={15} /> Log nudge</button>
                </div>
            </form>
        </Modal>
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
