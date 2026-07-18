import React, { useEffect, useState } from 'react';
import { ChevronRight, AlertTriangle, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { journeyApi } from '../api/journey';
import Modal from '../components/Modal';
import ModuleReportMenu from '../components/ModuleReportMenu';
import './CashHorizon.css';
import './JourneyMap.css';

const HEALTH_DOT = { Good: '#10b981', Watch: '#f59e0b', Poor: '#ef4444' };

export default function JourneyMap() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [meta, setMeta] = useState(null);
    const [stats, setStats] = useState(null);
    const [map, setMap] = useState(null);
    const [modal, setModal] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');

    const load = async () => {
        try {
            setError('');
            const [s, m] = await Promise.all([journeyApi.stats(), journeyApi.map()]);
            setStats(s); setMap(m);
        } catch (e) { setError(e.message || 'Failed to load'); }
    };
    useEffect(() => {
        let alive = true;
        journeyApi.meta().then((m) => { if (alive) setMeta(m); }).catch((e) => alive && setError(e.message));
        load();
        return () => { alive = false; };
    }, []);

    const save = async (form) => { try { await journeyApi.set(form); setModal(null); await load(); } catch (e) { setError(e.message); } };
    const seed = async () => { setBusy('seed'); try { await journeyApi.seedSample(); await load(); } catch (e) { setError(e.message); } finally { setBusy(''); } };

    if (!meta || !stats || !map) return <div className="ch-empty">Loading…</div>;

    const totalMapped = stats.mapped;

    return (
        <div className="animate-fade-in">
            <header className="ch-head">
                <div>
                    <h1 className="ch-title">Journey Map</h1>
                    <p className="ch-sub">Where every customer sits on the lifecycle — Onboarding to Advocacy. Compass 🧭 flags anyone stalled in a stage too long.</p>
                </div>
                <div style={{ display: 'flex', gap: '.6rem' }}>
                    {isAdmin && !totalMapped && <button className="btn btn-ghost" onClick={seed} disabled={busy === 'seed'}>{busy === 'seed' ? 'Seeding…' : 'Seed sample'}</button>}
                    <ModuleReportMenu module="journey" title="Journey Map" />
                </div>
            </header>

            {error && <div className="ch-error">{error}</div>}

            <div className="jm-strip">
                <div className="jm-strip-stat"><span className="jm-strip-num">{stats.customers}</span><span className="jm-strip-label">customers</span></div>
                <div className="jm-strip-stat"><span className="jm-strip-num" style={{ color: '#3b82f6' }}>{stats.avgProgress}%</span><span className="jm-strip-label">avg progress</span></div>
                <div className="jm-strip-stat"><span className="jm-strip-num" style={{ color: stats.stalled ? '#f59e0b' : 'inherit' }}>{stats.stalled}</span><span className="jm-strip-label">stalled</span></div>
                <div className="jm-strip-stat"><span className="jm-strip-num" style={{ color: stats.atRisk ? '#ef4444' : 'inherit' }}>{stats.atRisk}</span><span className="jm-strip-label">at risk</span></div>
                <div className="jm-strip-stat"><span className="jm-strip-num" style={{ color: '#a855f7' }}>{stats.advocacy}</span><span className="jm-strip-label">advocates</span></div>
            </div>

            {/* Lifecycle path */}
            <div className="jm-path">
                {meta.path.map((stage, i) => (
                    <React.Fragment key={stage}>
                        <StageColumn stage={stage} customers={map[stage] || []} onPick={setModal} />
                        {i < meta.path.length - 1 && <div className="jm-arrow"><ChevronRight size={20} /></div>}
                    </React.Fragment>
                ))}
            </div>

            {/* At Risk lane */}
            {(map['At Risk'] || []).length > 0 && (
                <div className="jm-atrisk">
                    <div className="jm-atrisk-head"><AlertTriangle size={15} /> At Risk — off the happy path</div>
                    <div className="jm-chips">
                        {map['At Risk'].map((j) => <CustomerChip key={j.account} j={j} onPick={setModal} />)}
                    </div>
                </div>
            )}

            {modal && <JourneyModal init={modal} meta={meta} onClose={() => setModal(null)} onSave={save} />}
        </div>
    );
}

function StageColumn({ stage, customers, onPick }) {
    return (
        <div className="jm-stage">
            <div className="jm-stage-head">
                <span>{stage}</span>
                <span className="jm-stage-count">{customers.length}</span>
            </div>
            <div className="jm-chips">
                {customers.map((j) => <CustomerChip key={j.account} j={j} onPick={onPick} />)}
                {!customers.length && <div className="jm-stage-empty">—</div>}
            </div>
        </div>
    );
}

function CustomerChip({ j, onPick }) {
    return (
        <button className={`jm-chip ${j.stalled ? 'jm-chip-stalled' : ''}`} onClick={() => onPick({ account: j.account, stage: j.stage, health: j.health, owner: j.owner, notes: j.notes, note: '' })}>
            <span className="jm-chip-dot" style={{ background: HEALTH_DOT[j.health] }} />
            <span className="jm-chip-name">{j.account}</span>
            {j.stalled && <span className="jm-chip-stall" title={`${j.daysInStage} days in stage`}>⏳</span>}
        </button>
    );
}

function JourneyModal({ init, meta, onClose, onSave }) {
    const [f, setF] = useState(init);
    const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
    return (
        <Modal isOpen onClose={onClose} title={`${init.account} — lifecycle`} maxWidth="460px">
            <form onSubmit={(e) => { e.preventDefault(); onSave(f); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                <div className="form-group"><label>Lifecycle stage</label>
                    <select value={f.stage} onChange={(e) => set('stage', e.target.value)}>{meta.stages.map((s) => <option key={s}>{s}</option>)}</select>
                </div>
                <div className="form-group"><label>Health</label>
                    <div className="jm-seg">
                        {meta.healths.map((h) => (
                            <button key={h} type="button" className={f.health === h ? 'on' : ''} onClick={() => set('health', h)}>
                                <span className="jm-chip-dot" style={{ background: HEALTH_DOT[h] }} /> {h}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="form-group"><label>Milestone note (optional)</label>
                    <input value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="What changed" />
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><MapPin size={15} /> Update</button>
                </div>
            </form>
        </Modal>
    );
}
