import React, { useEffect, useState } from 'react';
import { Plus, Send, Trash2, Frown, Meh, Smile, Megaphone, ClipboardList } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { surveysApi } from '../api/surveys';
import { accountsApi } from '../api/accounts';
import Modal from '../components/Modal';
import ModuleReportMenu from '../components/ModuleReportMenu';
import './CashHorizon.css';
import './Surveys.css';

const TYPE_CLASS = { NPS: 'sv-t-nps', CSAT: 'sv-t-csat', CES: 'sv-t-ces' };
const STATUS_CLASS = { Draft: 'sv-st-draft', Live: 'sv-st-live', Closed: 'sv-st-closed' };
const npsColor = (n) => (n === null ? '#94a3b8' : n >= 50 ? '#10b981' : n >= 0 ? '#f59e0b' : '#ef4444');

function SentimentBar({ s }) {
    const total = (s.Positive || 0) + (s.Neutral || 0) + (s.Negative || 0) || 1;
    const seg = (n, c) => <div style={{ width: `${((n || 0) / total) * 100}%`, background: c }} />;
    return <div className="sv-sentbar">{seg(s.Positive, '#10b981')}{seg(s.Neutral, '#94a3b8')}{seg(s.Negative, '#ef4444')}</div>;
}

export default function Surveys() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [meta, setMeta] = useState(null);
    const [stats, setStats] = useState(null);
    const [campaigns, setCampaigns] = useState([]);
    const [detractors, setDetractors] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [view, setView] = useState('campaigns');
    const [modal, setModal] = useState(null);
    const [product, setProduct] = useState('All');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');

    const load = async (p = product) => {
        try {
            setError('');
            const [s, c, d] = await Promise.all([surveysApi.stats(), surveysApi.list(p !== 'All' ? { product_key: p } : {}), surveysApi.detractors()]);
            setStats(s); setCampaigns(c); setDetractors(d);
        } catch (e) { setError(e.message || 'Failed to load'); }
    };
    useEffect(() => {
        let alive = true;
        Promise.all([surveysApi.meta(), accountsApi.list()])
            .then(([m, a]) => { if (!alive) return; setMeta(m); setAccounts(a.filter((x) => x.segment === 'Customer')); })
            .catch((e) => alive && setError(e.message));
        load();
        return () => { alive = false; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const create = async (form) => {
        try { await surveysApi.create(form); setModal(null); await load(); } catch (e) { setError(e.message); }
    };
    const send = async (c) => { setBusy(`send-${c.id}`); try { await surveysApi.send(c.id, Math.max(c.responseCount + 3, 5)); await load(); } catch (e) { setError(e.message); } finally { setBusy(''); } };
    const remove = async (c) => { if (!window.confirm(`Delete campaign "${c.title}"?`)) return; try { await surveysApi.remove(c.id); await load(); } catch (e) { setError(e.message); } };
    const respond = async (c, score, comment, respondent) => {
        try { await surveysApi.respond(c.id, { score: Number(score), comment, respondent }); await load(); } catch (e) { setError(e.message); }
    };
    const seed = async () => { setBusy('seed'); try { await surveysApi.seedSample(); await load(); } catch (e) { setError(e.message); } finally { setBusy(''); } };

    if (!meta || !stats) return <div className="ch-empty">Loading…</div>;

    return (
        <div className="animate-fade-in">
            <header className="ch-head">
                <div>
                    <h1 className="ch-title">Surveys</h1>
                    <p className="ch-sub">Voice of the customer — NPS, CSAT and CES turned into one sentiment score. Echo 📣 flags every detractor to follow up.</p>
                </div>
                <div style={{ display: 'flex', gap: '.6rem' }}>
                    {isAdmin && !campaigns.length && <button className="btn btn-ghost" onClick={seed} disabled={busy === 'seed'}>{busy === 'seed' ? 'Seeding…' : 'Seed sample'}</button>}
                    <ModuleReportMenu module="surveys" title="Surveys" />
                    <button className="btn btn-primary" onClick={() => setModal({ account: accounts[0]?.name || '', title: '', type: 'NPS', product_key: '', question: '' })}><Plus size={18} /> New campaign</button>
                </div>
            </header>

            {error && <div className="ch-error">{error}</div>}

            {/* Sentiment hero — the one number that matters, distinct from the KPI grid */}
            <div className="sv-hero glass-card">
                <div className="sv-gauge">
                    <div className="sv-gauge-num" style={{ color: npsColor(stats.nps) }}>{stats.nps === null ? '—' : stats.nps}</div>
                    <div className="sv-gauge-label">Net Promoter Score</div>
                </div>
                <div className="sv-hero-right">
                    <div className="sv-hero-stats">
                        <div><span className="sv-mini-label">CSAT</span><span className="sv-mini-val">{stats.csat === null ? '—' : `${stats.csat}%`}</span></div>
                        <div><span className="sv-mini-label">CES</span><span className="sv-mini-val">{stats.ces === null ? '—' : stats.ces}</span></div>
                        <div><span className="sv-mini-label">Responses</span><span className="sv-mini-val">{stats.responses}</span></div>
                        <div><span className="sv-mini-label">Response rate</span><span className="sv-mini-val">{stats.responseRate === null ? '—' : `${stats.responseRate}%`}</span></div>
                    </div>
                    <div className="sv-sentiment-legend">
                        <SentimentBar s={stats.sentiments} />
                        <div className="sv-legend">
                            <span><Smile size={13} color="#10b981" /> {stats.sentiments.Positive || 0} promoters</span>
                            <span><Meh size={13} color="#94a3b8" /> {stats.sentiments.Neutral || 0} passive</span>
                            <span><Frown size={13} color="#ef4444" /> {stats.sentiments.Negative || 0} detractors</span>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="sv-toggle">
                    <button className={view === 'campaigns' ? 'on' : ''} onClick={() => setView('campaigns')}><Megaphone size={15} /> Campaigns ({campaigns.length})</button>
                    <button className={view === 'detractors' ? 'on' : ''} onClick={() => setView('detractors')}><Frown size={15} /> Detractors ({detractors.length})</button>
                </div>
                {view === 'campaigns' && (
                    <div className="ch-field" style={{ minWidth: 180, marginBottom: '1.1rem' }}>
                        <select value={product} onChange={(e) => { setProduct(e.target.value); load(e.target.value); }}>
                            <option value="All">All products</option>
                            {(meta.products || []).map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                        </select>
                    </div>
                )}
            </div>

            {view === 'campaigns' ? (
                campaigns.length === 0 ? <div className="ch-empty">No survey campaigns{product !== 'All' ? ' for this product yet' : ' yet. Launch one to start listening.'}</div> : (
                    <div className="sv-cards">
                        {campaigns.map((c) => <CampaignCard key={c.id} c={c} products={meta.products || []} onSend={send} onRemove={remove} onRespond={respond} busy={busy} />)}
                    </div>
                )
            ) : (
                <DetractorList detractors={detractors} />
            )}

            {modal && <CampaignModal init={modal} meta={meta} accounts={accounts} onClose={() => setModal(null)} onSave={create} />}
        </div>
    );
}

function CampaignCard({ c, products, onSend, onRemove, onRespond, busy }) {
    const [open, setOpen] = useState(false);
    const [score, setScore] = useState('');
    const [comment, setComment] = useState('');
    const headline = c.headline === null ? '—' : c.headline;
    const prod = c.product_key ? products.find((p) => p.key === c.product_key) : null;
    return (
        <div className="glass-card sv-card">
            <div className="sv-card-head">
                <div className="sv-card-titles">
                    <span className={`sv-type ${TYPE_CLASS[c.type]}`}>{c.type}</span>
                    {prod && <span className="sv-prod" style={{ color: prod.color, borderColor: prod.color }}>{prod.name}</span>}
                    <strong>{c.title}</strong>
                    <span className={`sv-status ${STATUS_CLASS[c.status]}`}>{c.status}</span>
                </div>
                <button className="sv-x" onClick={() => onRemove(c)}><Trash2 size={14} /></button>
            </div>
            <div className="ch-muted sv-card-acct">{c.account}</div>
            <div className="sv-card-body">
                <div className="sv-card-score">
                    <div className="sv-card-score-num">{headline}{c.type === 'CSAT' && headline !== '—' ? '%' : ''}</div>
                    <div className="sv-card-score-label">{c.headlineLabel}</div>
                </div>
                <div className="sv-card-meta">
                    <div><strong>{c.responseCount}</strong> / {c.sent_count || '—'} responses{c.responseRate !== null ? ` · ${c.responseRate}%` : ''}</div>
                    <SentimentBar s={c.sentiments} />
                    {c.detractors > 0 && <div className="sv-card-detr"><Frown size={12} /> {c.detractors} detractor{c.detractors === 1 ? '' : 's'}</div>}
                </div>
            </div>
            <div className="sv-card-actions">
                {c.status === 'Draft' && <button className="btn btn-ghost sv-sm" onClick={() => onSend(c)} disabled={busy === `send-${c.id}`}><Send size={13} /> Send</button>}
                <button className="btn btn-ghost sv-sm" onClick={() => setOpen((o) => !o)}><ClipboardList size={13} /> {open ? 'Hide' : 'Record response'}</button>
            </div>
            {open && (
                <form className="sv-respond" onSubmit={(e) => { e.preventDefault(); if (score !== '') { onRespond(c, score, comment, ''); setScore(''); setComment(''); } }}>
                    <input type="number" placeholder="Score" value={score} onChange={(e) => setScore(e.target.value)} className="sv-score-in" />
                    <input placeholder="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
                    <button type="submit" className="btn btn-primary sv-sm" disabled={score === ''}><Plus size={13} /></button>
                </form>
            )}
        </div>
    );
}

function DetractorList({ detractors }) {
    if (!detractors.length) return <div className="ch-empty" style={{ color: 'var(--success)' }}>No detractors — every scored response is neutral or better. 🎉</div>;
    return (
        <div className="sv-detractors">
            {detractors.map((d) => (
                <div key={d.id} className="glass-card sv-detr">
                    <div className="sv-detr-score">{d.score}</div>
                    <div className="sv-detr-body">
                        <div className="sv-detr-head"><strong>{d.account}</strong>{d.respondent ? <span className="ch-muted"> · {d.respondent}</span> : null}</div>
                        {d.comment ? <div className="sv-detr-comment">“{d.comment}”</div> : <div className="ch-muted sv-detr-comment">No comment left.</div>}
                    </div>
                    <div className="sv-detr-flag"><Frown size={16} /></div>
                </div>
            ))}
        </div>
    );
}

function CampaignModal({ init, meta, accounts, onClose, onSave }) {
    const [f, setF] = useState(init);
    const set = (k, v) => setF((p) => ({ ...p, [k]: v, ...(k === 'type' ? { question: '' } : {}) }));
    return (
        <Modal isOpen onClose={onClose} title="New survey campaign" maxWidth="480px">
            <form onSubmit={(e) => { e.preventDefault(); onSave(f); }} className="ch-form">
                <div className="ch-field"><label>Customer</label>
                    <select value={f.account} onChange={(e) => set('account', e.target.value)} required>
                        <option value="">Select a customer…</option>
                        {accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                    </select>
                </div>
                <div className="ch-field"><label>Instrument</label>
                    <div className="sv-seg">
                        {meta.types.map((t) => <button key={t} type="button" className={f.type === t ? 'on' : ''} onClick={() => set('type', t)}>{t}</button>)}
                    </div>
                </div>
                <div className="ch-field"><label>Product focus (optional)</label>
                    <select value={f.product_key || ''} onChange={(e) => set('product_key', e.target.value)}>
                        <option value="">Whole platform</option>
                        {(meta.products || []).map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                    </select>
                </div>
                <div className="ch-field"><label>Title</label>
                    <input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Q3 NPS pulse" required />
                </div>
                <div className="ch-field"><label>Question</label>
                    <input value={f.question} onChange={(e) => set('question', e.target.value)} placeholder={meta.questions[f.type]} />
                </div>
                <div className="ch-form-actions">
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={!f.account || !f.title}>Create</button>
                </div>
            </form>
        </Modal>
    );
}
