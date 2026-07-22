import React, { useEffect, useState } from 'react';
import { ChevronRight, AlertTriangle, MapPin, Route, Boxes, Download, Users as UsersIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { journeyApi } from '../api/journey';
import Modal from '../components/Modal';
import ModuleReportMenu from '../components/ModuleReportMenu';
import './CashHorizon.css';
import './JourneyMap.css';

const HEALTH_DOT = { Good: '#10b981', Watch: '#f59e0b', Poor: '#ef4444' };
const BAND_COLOR = { 'Power user': '#10b981', Active: '#38bdf8', Light: '#f59e0b', Dormant: '#ef4444', 'Not measured': '#94a3b8' };

export default function JourneyMap() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [meta, setMeta] = useState(null);
    const [stats, setStats] = useState(null);
    const [map, setMap] = useState(null);
    const [adoption, setAdoption] = useState(null);
    const [view, setView] = useState('lifecycle'); // 'lifecycle' | 'adoption'
    const [modal, setModal] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');

    const load = async () => {
        try {
            setError('');
            const [s, m, a] = await Promise.all([journeyApi.stats(), journeyApi.map(), journeyApi.adoption()]);
            setStats(s); setMap(m); setAdoption(a);
        } catch (e) { setError(e.message || 'Failed to load'); }
    };
    useEffect(() => {
        let alive = true;
        journeyApi.meta().then((m) => { if (alive) setMeta(m); }).catch((e) => alive && setError(e.message));
        load();
        return () => { alive = false; };
    }, []);

    const save = async (form) => { try { await journeyApi.set(form); setModal(null); await load(); } catch (e) { setError(e.message); } };
    const setUsage = async (account, product_key, usage_score) => {
        try { const a = await journeyApi.setAdoption(account, product_key, usage_score); setAdoption(a); } catch (e) { setError(e.message); }
    };
    const setUsers = async (account, active, total) => {
        try { const a = await journeyApi.setUserAdoption(account, active, total); setAdoption(a); } catch (e) { setError(e.message); }
    };
    const seed = async () => { setBusy('seed'); try { await journeyApi.seedSample(); await load(); } catch (e) { setError(e.message); } finally { setBusy(''); } };

    if (!meta || !stats || !map) return <div className="ch-empty">Loading…</div>;

    const totalMapped = stats.mapped;

    return (
        <div className="animate-fade-in">
            <header className="ch-head">
                <div>
                    <h1 className="ch-title">Journey Map</h1>
                    <p className="ch-sub">Where every customer sits on the lifecycle, and how they’re actually using the modules they pay for. Compass 🧭 flags who’s stalled and which modules are going dormant.</p>
                </div>
                <div style={{ display: 'flex', gap: '.6rem' }}>
                    {isAdmin && !totalMapped && <button className="btn btn-ghost" onClick={seed} disabled={busy === 'seed'}>{busy === 'seed' ? 'Seeding…' : 'Seed sample'}</button>}
                    <ModuleReportMenu module="journey" title="Journey Map" />
                </div>
            </header>

            <div className="jm-viewtoggle">
                <button className={view === 'lifecycle' ? 'on' : ''} onClick={() => setView('lifecycle')}><Route size={15} /> Lifecycle</button>
                <button className={view === 'adoption' ? 'on' : ''} onClick={() => setView('adoption')}><Boxes size={15} /> Module adoption</button>
            </div>

            {error && <div className="ch-error">{error}</div>}

            {view === 'adoption' ? (
                <AdoptionView adoption={adoption} onSetUsage={setUsage} onSetUsers={setUsers} />
            ) : (<>
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
            </>)}

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
            <form onSubmit={(e) => { e.preventDefault(); onSave(f); }} className="ch-form">
                <div className="ch-field"><label>Lifecycle stage</label>
                    <select value={f.stage} onChange={(e) => set('stage', e.target.value)}>{meta.stages.map((s) => <option key={s}>{s}</option>)}</select>
                </div>
                <div className="ch-field"><label>Health</label>
                    <div className="jm-seg">
                        {meta.healths.map((h) => (
                            <button key={h} type="button" className={f.health === h ? 'on' : ''} onClick={() => set('health', h)}>
                                <span className="jm-chip-dot" style={{ background: HEALTH_DOT[h] }} /> {h}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="ch-field"><label>Milestone note (optional)</label>
                    <input value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="What changed" />
                </div>
                <div className="ch-form-actions">
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="btn btn-primary"><MapPin size={15} /> Update</button>
                </div>
            </form>
        </Modal>
    );
}

/* ---------------- Module adoption view ---------------- */

function downloadCsv(filename, headerRow, rows) {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headerRow, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
}

function AdoptionView({ adoption, onSetUsage, onSetUsers }) {
    if (!adoption) return <div className="ch-empty">Loading…</div>;
    const { accounts, modules, summary } = adoption;
    if (!accounts.length || !modules.length) {
        return <div className="ch-empty">No module-usage data yet. Seed the sample (admin) or set a usage score on a customer’s module to start tracking adoption.</div>;
    }
    const maxAvg = Math.max(1, ...modules.map((m) => m.avgUsage));

    const downloadUserAdoption = () => downloadCsv('user-adoption.csv',
        ['Customer', 'Active users', 'Total users', 'User adoption %', 'Avg module usage %', 'Dormant modules'],
        accounts.map((a) => [a.account, a.activeUsers ?? '', a.totalUsers ?? '', a.userAdoptionRate ?? '', a.avgUsage ?? '', a.dormantCount]));
    const downloadModuleAdoption = () => downloadCsv('module-adoption.csv',
        ['Customer', 'Module', 'Usage %', 'Band', 'Subscribed', 'Last active'],
        accounts.flatMap((a) => a.modules.map((m) => [a.account, m.product, m.usageScore ?? '', m.band, m.subscribed ? 'Yes' : 'No', m.lastActive ?? ''])));

    return (
        <div>
            {/* summary — module + user adoption in one strip */}
            <div className="jm-strip">
                <div className="jm-strip-stat"><span className="jm-strip-num">{summary.measured}/{summary.customers}</span><span className="jm-strip-label">customers measured</span></div>
                <div className="jm-strip-stat"><span className="jm-strip-num" style={{ color: '#3b82f6' }}>{summary.avgUsage === null ? '—' : `${summary.avgUsage}%`}</span><span className="jm-strip-label">avg module usage</span></div>
                <div className="jm-strip-stat"><span className="jm-strip-num" style={{ color: '#a855f7' }}>{summary.avgUserAdoption === null ? '—' : `${summary.avgUserAdoption}%`}</span><span className="jm-strip-label">user adoption · {summary.activeUsers || 0}/{summary.totalUsers || 0} active</span></div>
                {summary.mostUsed && <div className="jm-strip-stat"><span className="jm-strip-num" style={{ color: '#10b981' }}>{summary.mostUsed.avgUsage}%</span><span className="jm-strip-label">most used · {summary.mostUsed.product}</span></div>}
                {summary.leastUsed && <div className="jm-strip-stat"><span className="jm-strip-num" style={{ color: '#ef4444' }}>{summary.leastUsed.avgUsage}%</span><span className="jm-strip-label">least used · {summary.leastUsed.product}</span></div>}
                <div className="jm-strip-stat"><span className="jm-strip-num" style={{ color: summary.dormantModules ? '#ef4444' : 'inherit' }}>{summary.dormantModules}</span><span className="jm-strip-label">dormant modules</span></div>
                <div className="jm-strip-dl">
                    <button className="btn btn-ghost jm-dl" onClick={downloadUserAdoption}><Download size={14} /> User adoption CSV</button>
                    <button className="btn btn-ghost jm-dl" onClick={downloadModuleAdoption}><Download size={14} /> Module adoption CSV</button>
                </div>
            </div>

            <div className="jm-adopt-grid">
                {/* usage across the book */}
                <div className="glass-card jm-adopt-modules">
                    <div className="jm-adopt-head"><Boxes size={16} /> Usage across the book</div>
                    <p className="ch-muted jm-adopt-sub">Which modules land, and which go dormant — steer health-check calls to the bottom of this list.</p>
                    {modules.map((m) => (
                        <div className="jm-mod-row" key={m.product_key}>
                            <span className="jm-mod-name"><span className="jm-mod-dot" style={{ background: m.color }} />{m.product}</span>
                            <div className="jm-mod-track"><div className="jm-mod-fill" style={{ width: `${(m.avgUsage / maxAvg) * 100}%`, background: m.color }} /></div>
                            <span className="jm-mod-val">{m.avgUsage}%</span>
                            {m.dormant > 0 && <span className="jm-mod-dormant" title={`${m.dormant} customer(s) dormant on this module`}>{m.dormant} dormant</span>}
                        </div>
                    ))}
                    {/* user adoption across the book, right under module usage — no dead space */}
                    <div className="jm-adopt-head" style={{ marginTop: '1.1rem' }}><UsersIcon size={15} /> User adoption per customer</div>
                    <p className="ch-muted jm-adopt-sub">Active users ÷ licensed users — a licensed seat nobody logs into is churn risk.</p>
                    {accounts.filter((a) => a.userAdoptionRate !== null).sort((a, b) => a.userAdoptionRate - b.userAdoptionRate).map((a) => (
                        <div className="jm-mod-row" key={a.account}>
                            <span className="jm-mod-name" title={a.account}>{a.account}</span>
                            <div className="jm-mod-track"><div className="jm-mod-fill" style={{ width: `${a.userAdoptionRate}%`, background: a.userAdoptionRate >= 70 ? '#10b981' : a.userAdoptionRate >= 40 ? '#f59e0b' : '#ef4444' }} /></div>
                            <span className="jm-mod-val">{a.userAdoptionRate}%</span>
                            <span className="ch-muted" style={{ fontSize: '.72rem', whiteSpace: 'nowrap' }}>{a.activeUsers}/{a.totalUsers}</span>
                        </div>
                    ))}
                </div>

                {/* per customer */}
                <div className="jm-adopt-accounts">
                    <div className="jm-adopt-head" style={{ marginBottom: '.6rem' }}>Per customer <span className="ch-muted" style={{ fontWeight: 400 }}>· least-adopted first · drag a bar to set usage</span></div>
                    {accounts.map((a) => (
                        <div className="glass-card jm-acct" key={a.account}>
                            <div className="jm-acct-head">
                                <strong>{a.account}</strong>
                                <UserAdoptionInline a={a} onSetUsers={onSetUsers} />
                                <span className="jm-acct-avg">{a.avgUsage === null ? 'not measured' : `${a.avgUsage}% avg`}</span>
                                {a.dormantCount > 0 && <span className="jm-acct-dormant">{a.dormantCount} dormant</span>}
                            </div>
                            <div className="jm-acct-mods">
                                {a.modules.map((m) => (
                                    <ModuleUsageRow key={m.product_key} account={a.account} m={m} onSetUsage={onSetUsage} />
                                ))}
                                {!a.modules.length && <span className="ch-muted" style={{ fontSize: '.8rem' }}>No modules subscribed.</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/** Inline active/total user editor on the customer card. */
function UserAdoptionInline({ a, onSetUsers }) {
    const [active, setActive] = useState(a.activeUsers ?? '');
    const [total, setTotal] = useState(a.totalUsers ?? '');
    const commit = () => {
        if (total === '' && active === '') return;
        onSetUsers(a.account, Number(active) || 0, Number(total) || 0);
    };
    return (
        <span className="jm-ua" title="Active users / licensed users">
            <UsersIcon size={13} />
            <input type="number" min="0" value={active} placeholder="active" onChange={(e) => setActive(e.target.value)} onBlur={commit} />
            <span className="ch-muted">/</span>
            <input type="number" min="0" value={total} placeholder="total" onChange={(e) => setTotal(e.target.value)} onBlur={commit} />
            {a.userAdoptionRate !== null && <span className="jm-ua-rate" style={{ color: a.userAdoptionRate >= 70 ? '#10b981' : a.userAdoptionRate >= 40 ? '#f59e0b' : '#ef4444' }}>{a.userAdoptionRate}%</span>}
        </span>
    );
}

function ModuleUsageRow({ account, m, onSetUsage }) {
    const [val, setVal] = useState(m.usageScore ?? 0);
    const color = BAND_COLOR[m.band] || '#94a3b8';
    return (
        <div className="jm-umod">
            <span className="jm-umod-name"><span className="jm-mod-dot" style={{ background: m.color }} />{m.product}</span>
            <input
                className="jm-umod-range" type="range" min="0" max="100" value={val}
                onChange={(e) => setVal(Number(e.target.value))}
                onMouseUp={(e) => onSetUsage(account, m.product_key, Number(e.target.value))}
                onKeyUp={(e) => onSetUsage(account, m.product_key, Number(e.target.value))}
                style={{ accentColor: color }}
            />
            <span className="jm-umod-band" style={{ color }}>{m.band}</span>
            <span className="jm-umod-val">{val}%</span>
        </div>
    );
}
