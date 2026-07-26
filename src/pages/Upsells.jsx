import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { upsellsApi } from '../api/upsells';
import { accountsApi } from '../api/accounts';
import Modal from '../components/Modal';
import ModuleReportMenu from '../components/ModuleReportMenu';
import StageTimelineFilter from '../components/StageTimelineFilter';
import { matchStageTimeline, emptyStageFilter } from '../utils/stageFilter';
import './CashHorizon.css';
import './Upsells.css';
import { Drillable } from '../components/MetricDrill';

const fmtInr = (n) => {
    const v = Math.round(Number(n) || 0);
    if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
    if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
    if (v >= 1e3) return `₹${(v / 1e3).toFixed(1)}k`;
    return `₹${v}`;
};
const STAGE_COLOR = { Identified: '#94a3b8', Qualified: '#38bdf8', Proposed: '#a855f7', Negotiation: '#f59e0b', Won: '#10b981', Lost: '#ef4444' };

export default function Upsells() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [meta, setMeta] = useState(null);
    const [stats, setStats] = useState(null);
    const [list, setList] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [modal, setModal] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');
    const [stf, setStf] = useState(emptyStageFilter);

    const load = async () => {
        try {
            setError('');
            const [s, l] = await Promise.all([upsellsApi.stats(), upsellsApi.list()]);
            setStats(s); setList(l);
        } catch (e) { setError(e.message || 'Failed to load'); }
    };
    useEffect(() => {
        let alive = true;
        Promise.all([upsellsApi.meta(), accountsApi.list()])
            .then(([m, a]) => { if (!alive) return; setMeta(m); setAccounts(a.filter((x) => x.segment === 'Customer')); })
            .catch((e) => alive && setError(e.message));
        load();
        return () => { alive = false; };
    }, []);

    const create = async (form) => { try { await upsellsApi.create(form); setModal(null); await load(); } catch (e) { setError(e.message); } };
    const setStage = async (e, stage) => { try { await upsellsApi.update(e.id, { stage }); await load(); } catch (er) { setError(er.message); } };
    const remove = async (e) => { if (!window.confirm(`Delete "${e.title}"?`)) return; try { await upsellsApi.remove(e.id); await load(); } catch (er) { setError(er.message); } };
    const seed = async () => { setBusy('seed'); try { await upsellsApi.seedSample(); await load(); } catch (e) { setError(e.message); } finally { setBusy(''); } };

    if (!meta || !stats) return <div className="ch-empty">Loading…</div>;

    const maxStageVal = Math.max(1, ...stats.valueByStage.map((s) => s.value));

    return (
        <div className="animate-fade-in">
            <header className="ch-head">
                <div>
                    <h1 className="ch-title">Upsells</h1>
                    <p className="ch-sub">The expansion-revenue pipeline — every open deal weighted by its probability. Rainmaker 🌧️ names the ones worth chasing this quarter.</p>
                </div>
                <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center' }}>
                    <StageTimelineFilter value={stf} onChange={setStf} />
                    {isAdmin && !list.length && <button className="btn btn-ghost" onClick={seed} disabled={busy === 'seed'}>{busy === 'seed' ? 'Seeding…' : 'Seed sample'}</button>}
                    <ModuleReportMenu module="upsells" title="Upsells" />
                    <button className="btn btn-primary" onClick={() => setModal({ account: accounts[0]?.name || '', title: '', type: 'Upsell', product: '', value_amount: 0, currency: 'INR', stage: 'Identified', target_close: '' })}><Plus size={18} /> New opportunity</button>
                </div>
            </header>

            {error && <div className="ch-error">{error}</div>}

            {/* Forecast hero */}
            <div className="up-hero">
                <div className="up-forecast glass-card">
                    <div className="up-forecast-label">Weighted forecast</div>
                    <Drillable metric="upsells.weighted" label="Weighted forecast"><div className="up-forecast-num">{fmtInr(stats.weightedForecastInr)}</div></Drillable>
                    <div className="up-forecast-sub">from {fmtInr(stats.openValueInr)} open pipeline · {stats.open} deals</div>
                </div>
                <div className="up-hero-stats">
                    <Drillable metric="upsells.won" label="Won"><div className="up-stat glass-card"><span className="up-stat-label">Won</span><span className="up-stat-val" style={{ color: '#10b981' }}>{fmtInr(stats.wonInr)}</span><span className="up-stat-hint">{stats.won} deals</span></div></Drillable>
                    <div className="up-stat glass-card"><span className="up-stat-label">Win rate</span><span className="up-stat-val">{stats.winRate === null ? '—' : `${stats.winRate}%`}</span><span className="up-stat-hint">of closed</span></div>
                    <Drillable metric="upsells.open" label="Open opportunities"><div className="up-stat glass-card"><span className="up-stat-label">Opportunities</span><span className="up-stat-val">{stats.opportunities}</span><span className="up-stat-hint">{stats.open} open</span></div></Drillable>
                </div>
            </div>

            {/* Stage funnel */}
            <div className="glass-card up-funnel">
                <div className="up-funnel-title">Pipeline value by stage</div>
                {stats.valueByStage.map((s) => (
                    <div className="up-funnel-row" key={s.stage}>
                        <span className="up-funnel-stage">{s.stage}</span>
                        <div className="up-funnel-track">
                            <div className="up-funnel-fill" style={{ width: `${(s.value / maxStageVal) * 100}%`, background: STAGE_COLOR[s.stage] }} />
                        </div>
                        <span className="up-funnel-val">{s.value ? fmtInr(s.value) : '—'}</span>
                    </div>
                ))}
            </div>

            {/* Opportunities */}
            {(() => {
                const shown = list.filter((e) => matchStageTimeline(e, stf));
                if (list.length === 0) return <div className="ch-empty">No expansion opportunities yet. Add one to start forecasting.</div>;
                return (
                    <div className="glass-card" style={{ padding: 0, overflowX: 'auto' }}>
                        <table className="up-table">
                            <thead>
                                <tr><th>Opportunity</th><th>Account</th><th>Type</th><th>Value</th><th>Stage</th><th>In stage</th><th>Prob.</th><th>Weighted</th><th>Close</th><th></th></tr>
                            </thead>
                            <tbody>
                                {shown.map((e) => (
                                    <tr key={e.id}>
                                        <td className="up-name">{e.title}</td>
                                        <td className="up-muted">{e.account}</td>
                                        <td className="up-muted">{e.type}</td>
                                        <td>{fmtInr(e.valueInr)}</td>
                                        <td>
                                            <select className="up-stage-sel" value={e.stage} onChange={(ev) => setStage(e, ev.target.value)} style={{ color: STAGE_COLOR[e.stage], borderColor: STAGE_COLOR[e.stage] }}>
                                                {meta.stages.map((s) => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </td>
                                        <td className={`up-muted ${e.days_in_stage > 30 ? 'up-stale' : ''}`}>{e.days_in_stage != null ? <><Clock size={11} /> {e.days_in_stage}d</> : '—'}</td>
                                        <td className="up-muted">{e.probability}%</td>
                                        <td className="up-weighted">{fmtInr(e.weightedInr)}</td>
                                        <td className="up-muted">{e.target_close || '—'}</td>
                                        <td><button className="up-x" onClick={() => remove(e)}><Trash2 size={13} /></button></td>
                                    </tr>
                                ))}
                                {shown.length === 0 && <tr><td colSpan={10} className="ch-muted" style={{ textAlign: 'center', padding: 18 }}>No opportunities match the timeline filter.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                );
            })()}

            {modal && <OppModal init={modal} meta={meta} accounts={accounts} onClose={() => setModal(null)} onSave={create} />}
        </div>
    );
}

function OppModal({ init, meta, accounts, onClose, onSave }) {
    const [f, setF] = useState(init);
    const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
    return (
        <Modal isOpen onClose={onClose} title="New expansion opportunity" maxWidth="520px">
            <form onSubmit={(e) => { e.preventDefault(); onSave({ ...f, value_amount: Number(f.value_amount) }); }} className="ch-form">
                <div className="ch-field"><label>Customer</label>
                    <select value={f.account} onChange={(e) => set('account', e.target.value)} required>
                        <option value="">Select a customer…</option>
                        {accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                    </select>
                </div>
                <div className="ch-field"><label>Title</label>
                    <input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. 25 additional seats" required />
                </div>
                <div className="ch-form-grid">
                    <div className="ch-field"><label>Type</label>
                        <select value={f.type} onChange={(e) => set('type', e.target.value)}>{meta.types.map((t) => <option key={t}>{t}</option>)}</select>
                    </div>
                    <div className="ch-field"><label>Stage</label>
                        <select value={f.stage} onChange={(e) => set('stage', e.target.value)}>{meta.stages.map((s) => <option key={s}>{s}</option>)}</select>
                    </div>
                    <div className="ch-field"><label>Value</label>
                        <input type="number" value={f.value_amount} onChange={(e) => set('value_amount', e.target.value)} />
                    </div>
                    <div className="ch-field"><label>Currency</label>
                        <select value={f.currency} onChange={(e) => set('currency', e.target.value)}><option>INR</option><option>USD</option></select>
                    </div>
                </div>
                <div className="ch-field"><label>Target close</label>
                    <input type="date" value={f.target_close} onChange={(e) => set('target_close', e.target.value)} />
                </div>
                <div className="ch-form-actions">
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={!f.account || !f.title}>Create</button>
                </div>
            </form>
        </Modal>
    );
}
