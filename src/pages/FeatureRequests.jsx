import React, { useEffect, useState } from 'react';
import { Plus, ThumbsUp, Trash2, Users, ChevronRight, Wrench } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { featuresApi } from '../api/features';
import { accountsApi } from '../api/accounts';
import Modal from '../components/Modal';
import ModuleReportMenu from '../components/ModuleReportMenu';
import './CashHorizon.css';
import './FeatureRequests.css';

const IMPACT_CLASS = { Low: 'fr-i-low', Medium: 'fr-i-med', High: 'fr-i-high', Critical: 'fr-i-crit' };
const STATUS_ACCENT = {
    Requested: '#94a3b8', 'Under review': '#38bdf8', Planned: '#a855f7',
    'In progress': '#f59e0b', Shipped: '#10b981', Declined: '#ef4444'
};

export default function FeatureRequests() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [meta, setMeta] = useState(null);
    const [stats, setStats] = useState(null);
    const [board, setBoard] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [modal, setModal] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');

    const load = async () => {
        try {
            setError('');
            const [b, s] = await Promise.all([featuresApi.board(), featuresApi.stats()]);
            setBoard(b); setStats(s);
        } catch (e) { setError(e.message || 'Failed to load'); }
    };
    useEffect(() => {
        let alive = true;
        Promise.all([featuresApi.meta(), accountsApi.list()])
            .then(([m, a]) => { if (!alive) return; setMeta(m); setAccounts(a.filter((x) => x.segment === 'Customer')); })
            .catch((e) => alive && setError(e.message));
        load();
        return () => { alive = false; };
    }, []);

    const create = async (form) => { try { await featuresApi.create(form); setModal(null); await load(); } catch (e) { setError(e.message); } };
    const move = async (f, status) => { try { await featuresApi.update(f.id, { status }); await load(); } catch (e) { setError(e.message); } };
    const vote = async (f) => { try { await featuresApi.vote(f.id); await load(); } catch (e) { setError(e.message); } };
    const remove = async (f) => { if (!window.confirm(`Delete "${f.title}"?`)) return; try { await featuresApi.remove(f.id); await load(); } catch (e) { setError(e.message); } };
    const seed = async () => { setBusy('seed'); try { await featuresApi.seedSample(); await load(); } catch (e) { setError(e.message); } finally { setBusy(''); } };

    if (!meta || !stats || !board) return <div className="ch-empty">Loading…</div>;

    const empty = stats.total === 0;

    return (
        <div className="animate-fade-in">
            <header className="ch-head">
                <div>
                    <h1 className="ch-title">Feature Requests</h1>
                    <p className="ch-sub">The product-demand pipeline, ranked by RICE — reach × impact ÷ effort. Forge 🔧 keeps the roadmap following real customer pull.</p>
                </div>
                <div style={{ display: 'flex', gap: '.6rem' }}>
                    {isAdmin && empty && <button className="btn btn-ghost" onClick={seed} disabled={busy === 'seed'}>{busy === 'seed' ? 'Seeding…' : 'Seed sample'}</button>}
                    <ModuleReportMenu module="feature-requests" title="Feature Requests" />
                    <button className="btn btn-primary" onClick={() => setModal({ account: accounts[0]?.name || '', title: '', description: '', impact: 'Medium', effort: 'M', product_area: '' })}><Plus size={18} /> New request</button>
                </div>
            </header>

            {error && <div className="ch-error">{error}</div>}

            {/* demand strip */}
            <div className="fr-strip">
                <div className="fr-strip-stat"><span className="fr-strip-num">{stats.total}</span><span className="fr-strip-label">requests</span></div>
                <div className="fr-strip-stat"><span className="fr-strip-num">{stats.open}</span><span className="fr-strip-label">open</span></div>
                <div className="fr-strip-stat"><span className="fr-strip-num" style={{ color: '#10b981' }}>{stats.shipped}</span><span className="fr-strip-label">shipped · {stats.shippedRate}%</span></div>
                <div className="fr-strip-stat"><span className="fr-strip-num" style={{ color: '#a855f7' }}>{stats.totalDemand}</span><span className="fr-strip-label">total demand</span></div>
                {stats.topDemand[0] && <div className="fr-strip-top"><span className="fr-strip-label">Top demand</span><strong>{stats.topDemand[0].title}</strong><span className="ch-muted">demand {stats.topDemand[0].demand} · RICE {stats.topDemand[0].rice}</span></div>}
            </div>

            {empty ? <div className="ch-empty">No feature requests yet. Capture what customers ask for to start ranking the roadmap.</div> : (
                <div className="fr-board">
                    {meta.statuses.map((st) => (
                        <div className="fr-col" key={st} style={{ '--accent': STATUS_ACCENT[st] }}>
                            <div className="fr-col-head">
                                <span className="fr-col-dot" />
                                {st}
                                <span className="fr-col-count">{(board[st] || []).length}</span>
                            </div>
                            <div className="fr-col-body">
                                {(board[st] || []).map((f) => (
                                    <FeatureCard key={f.id} f={f} statuses={meta.statuses} onVote={vote} onMove={move} onRemove={remove} />
                                ))}
                                {!(board[st] || []).length && <div className="fr-col-empty">—</div>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modal && <FeatureModal init={modal} meta={meta} accounts={accounts} onClose={() => setModal(null)} onSave={create} />}
        </div>
    );
}

function FeatureCard({ f, statuses, onVote, onMove, onRemove }) {
    const [menu, setMenu] = useState(false);
    return (
        <div className="fr-card">
            <div className="fr-card-top">
                <span className={`fr-impact ${IMPACT_CLASS[f.impact]}`}>{f.impact}</span>
                <span className="fr-effort" title="Effort">{f.effort}</span>
                <span className="fr-rice" title="RICE score">RICE {f.rice}</span>
                <button className="fr-x" onClick={() => onRemove(f)}><Trash2 size={12} /></button>
            </div>
            <div className="fr-card-title">{f.title}</div>
            <div className="fr-card-acct">{f.account}{f.product_area ? <span className="ch-muted"> · {f.product_area}</span> : null}</div>
            <div className="fr-card-foot">
                <button className="fr-vote" onClick={() => onVote(f)}><ThumbsUp size={12} /> {f.votes}</button>
                <span className="fr-supporters" title="Backing customers"><Users size={12} /> {f.supporterCount}</span>
                <span className="fr-demand">demand {f.demand}</span>
                <div className="fr-move">
                    <button className="fr-move-btn" onClick={() => setMenu((m) => !m)}><ChevronRight size={13} /></button>
                    {menu && (
                        <div className="fr-move-menu" onMouseLeave={() => setMenu(false)}>
                            {statuses.filter((s) => s !== f.status).map((s) => (
                                <button key={s} onClick={() => { onMove(f, s); setMenu(false); }}>{s}</button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function FeatureModal({ init, meta, accounts, onClose, onSave }) {
    const [f, setF] = useState(init);
    const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
    return (
        <Modal isOpen onClose={onClose} title="New feature request" maxWidth="500px">
            <form onSubmit={(e) => { e.preventDefault(); onSave(f); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                <div className="form-group"><label>Raised by (customer)</label>
                    <select value={f.account} onChange={(e) => set('account', e.target.value)} required>
                        <option value="">Select a customer…</option>
                        {accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                    </select>
                </div>
                <div className="form-group"><label>Title</label>
                    <input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. SSO via Azure AD" required />
                </div>
                <div className="form-group"><label>Description</label>
                    <textarea rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="What and why" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '.8rem' }}>
                    <div className="form-group"><label>Impact</label>
                        <select value={f.impact} onChange={(e) => set('impact', e.target.value)}>{meta.impacts.map((i) => <option key={i}>{i}</option>)}</select>
                    </div>
                    <div className="form-group"><label>Effort</label>
                        <select value={f.effort} onChange={(e) => set('effort', e.target.value)}>{meta.efforts.map((i) => <option key={i}>{i}</option>)}</select>
                    </div>
                    <div className="form-group"><label>Area</label>
                        <select value={f.product_area} onChange={(e) => set('product_area', e.target.value)}>
                            <option value="">—</option>
                            {meta.areas.map((a) => <option key={a}>{a}</option>)}
                        </select>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={!f.account || !f.title}>Create</button>
                </div>
            </form>
        </Modal>
    );
}
