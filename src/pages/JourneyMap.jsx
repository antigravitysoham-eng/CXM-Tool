import React, { useEffect, useState } from 'react';
import { ChevronRight, AlertTriangle, MapPin, Route, Boxes, Download, Users as UsersIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { journeyApi } from '../api/journey';
import Modal from '../components/Modal';
import ModuleReportMenu from '../components/ModuleReportMenu';
import StageTimelineFilter from '../components/StageTimelineFilter';
import { matchStageTimeline, emptyStageFilter, stageFilterActive } from '../utils/stageFilter';
import './CashHorizon.css';
import './JourneyMap.css';
import { Drillable } from '../components/MetricDrill';

const JM_STAGE_OPTS = { enteredField: 'stage_entered_at', daysField: 'daysInStage' };

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
    const [stf, setStf] = useState(emptyStageFilter);

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
    const setUserUsage = async (payload) => {
        try { const a = await journeyApi.setUserModuleUsage(payload); setAdoption(a); } catch (e) { setError(e.message); }
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
                <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center' }}>
                    {view === 'lifecycle' && <StageTimelineFilter value={stf} onChange={setStf} />}
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
                <AdoptionView adoption={adoption} onSetUserUsage={setUserUsage} />
            ) : (<>
            <div className="jm-strip">
                <Drillable metric="journey.customers" label="Customers mapped"><div className="jm-strip-stat"><span className="jm-strip-num">{stats.customers}</span><span className="jm-strip-label">customers</span></div></Drillable>
                <div className="jm-strip-stat"><span className="jm-strip-num" style={{ color: '#3b82f6' }}>{stats.avgProgress}%</span><span className="jm-strip-label">avg progress</span></div>
                <div className="jm-strip-stat"><span className="jm-strip-num" style={{ color: stats.stalled ? '#f59e0b' : 'inherit' }}>{stats.stalled}</span><span className="jm-strip-label">stalled</span></div>
                <Drillable metric="journey.atRisk" label="At risk"><div className="jm-strip-stat"><span className="jm-strip-num" style={{ color: stats.atRisk ? '#ef4444' : 'inherit' }}>{stats.atRisk}</span><span className="jm-strip-label">at risk</span></div></Drillable>
                <div className="jm-strip-stat"><span className="jm-strip-num" style={{ color: '#a855f7' }}>{stats.advocacy}</span><span className="jm-strip-label">advocates</span></div>
            </div>

            {/* Lifecycle path */}
            <div className="jm-path">
                {meta.path.map((stage, i) => (
                    <React.Fragment key={stage}>
                        <StageColumn stage={stage} customers={(map[stage] || []).filter((j) => matchStageTimeline(j, stf, JM_STAGE_OPTS))} onPick={setModal} />
                        {i < meta.path.length - 1 && <div className="jm-arrow"><ChevronRight size={20} /></div>}
                    </React.Fragment>
                ))}
            </div>

            {/* At Risk lane */}
            {(map['At Risk'] || []).filter((j) => matchStageTimeline(j, stf, JM_STAGE_OPTS)).length > 0 && (
                <div className="jm-atrisk">
                    <div className="jm-atrisk-head"><AlertTriangle size={15} /> At Risk — off the happy path</div>
                    <div className="jm-chips">
                        {map['At Risk'].filter((j) => matchStageTimeline(j, stf, JM_STAGE_OPTS)).map((j) => <CustomerChip key={j.account} j={j} onPick={setModal} />)}
                    </div>
                </div>
            )}
            {stageFilterActive(stf) && Object.values(map).flat().filter((j) => matchStageTimeline(j, stf, JM_STAGE_OPTS)).length === 0 && (
                <div className="ch-empty">No customers match the timeline filter.</div>
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

const usageColor = (v) => (v == null ? '#94a3b8' : v >= 75 ? '#10b981' : v >= 40 ? '#38bdf8' : v >= 10 ? '#f59e0b' : '#ef4444');

function AdoptionView({ adoption, onSetUserUsage }) {
    if (!adoption) return <div className="ch-empty">Loading…</div>;
    const { accounts, modules, summary } = adoption;
    if (!accounts.length) {
        return <div className="ch-empty">No adoption data yet. Seed the sample (admin) to populate module and user usage synced to each account’s subscription.</div>;
    }

    const downloadModuleCsv = () => downloadCsv('module-adoption.csv',
        ['Customer', 'Overall usage %', 'Module', 'Usage %', 'Band', 'Subscribed'],
        accounts.flatMap((a) => a.modules.map((m) => [a.account, a.overallUsage ?? '', m.product, m.usageScore ?? '', m.band, m.subscribed ? 'Yes' : 'No'])));
    const downloadUserCsv = () => downloadCsv('user-adoption.csv',
        ['Customer', 'User', 'Role', 'User overall %', 'Module', 'Usage %', 'Band'],
        accounts.flatMap((a) => a.users.flatMap((u) => u.modules.map((m) => [a.account, u.name, u.role, u.overallUsage, m.product, m.usage, m.band]))));

    return (
        <div>
            {/* portfolio strip */}
            <div className="jm-strip">
                <div className="jm-strip-stat"><span className="jm-strip-num" style={{ color: usageColor(summary.avgUsage) }}>{summary.avgUsage == null ? '—' : `${summary.avgUsage}%`}</span><span className="jm-strip-label">avg usage across the book</span></div>
                {summary.mostUsed && <div className="jm-strip-stat"><span className="jm-strip-num" style={{ color: '#10b981' }}>{summary.mostUsed.avgUsage}%</span><span className="jm-strip-label">most used · {summary.mostUsed.product}</span></div>}
                {summary.leastUsed && <div className="jm-strip-stat"><span className="jm-strip-num" style={{ color: '#ef4444' }}>{summary.leastUsed.avgUsage}%</span><span className="jm-strip-label">least used · {summary.leastUsed.product}</span></div>}
                <div className="jm-strip-stat"><span className="jm-strip-num" style={{ color: '#a855f7' }}>{summary.activeUsers}/{summary.totalUsers}</span><span className="jm-strip-label">active users ({summary.avgUserAdoption ?? '—'}%)</span></div>
                <div className="jm-strip-stat"><span className="jm-strip-num" style={{ color: summary.dormantModules ? '#ef4444' : 'inherit' }}>{summary.dormantModules}</span><span className="jm-strip-label">dormant modules</span></div>
                <div className="jm-strip-dl">
                    <button className="btn btn-ghost jm-dl" onClick={downloadModuleCsv}><Download size={14} /> Module CSV</button>
                    <button className="btn btn-ghost jm-dl" onClick={downloadUserCsv}><Download size={14} /> User CSV</button>
                </div>
            </div>

            {/* usage across the book — compact module ranking */}
            <div className="glass-card jm-book">
                <div className="jm-book-head"><Boxes size={15} /> Usage across the book — which modules land, which go dormant</div>
                <div className="jm-book-bars">
                    {modules.map((m) => (
                        <div className="jm-book-bar" key={m.product_key} title={`${m.product}: ${m.avgUsage}% · ${m.count} customer(s)${m.dormant ? `, ${m.dormant} dormant` : ''}`}>
                            <div className="jm-book-track"><div className="jm-book-fill" style={{ height: `${m.avgUsage}%`, background: m.color }} /></div>
                            <div className="jm-book-pct">{m.avgUsage}%</div>
                            <div className="jm-book-name">{m.product}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* one clear card per customer — least-adopted first */}
            <div className="jm-custlist">
                {accounts.map((a) => <CustomerAdoption key={a.account} a={a} onSetUserUsage={onSetUserUsage} />)}
            </div>
        </div>
    );
}

function CustomerAdoption({ a, onSetUserUsage }) {
    const [open, setOpen] = useState(false);
    const overall = a.overallUsage;
    return (
        <div className="glass-card jm-cust">
            {/* headline — the pinpoint summary */}
            <button className="jm-cust-head" onClick={() => setOpen((o) => !o)}>
                <div className="jm-cust-gauge" style={{ '--c': usageColor(overall) }}>
                    <span className="jm-cust-gauge-num">{overall == null ? '—' : `${overall}%`}</span>
                    <span className="jm-cust-gauge-lbl">usage</span>
                </div>
                <div className="jm-cust-headmain">
                    <div className="jm-cust-name">{a.account}</div>
                    <div className="jm-cust-sentence">
                        {a.topModule
                            ? <>Leans on <b style={{ color: a.topModule.color }}>{a.topModule.product}</b> ({a.topModule.usage}%){a.bottomModule && a.bottomModule.product !== a.topModule.product ? <> · barely touches <b style={{ color: a.bottomModule.color }}>{a.bottomModule.product}</b> ({a.bottomModule.usage}%)</> : null}</>
                            : 'No usage recorded yet.'}
                    </div>
                    <div className="jm-cust-meta">
                        <span>{a.subscribedCount} module{a.subscribedCount === 1 ? '' : 's'} subscribed</span>
                        <span>·</span>
                        <span>{a.activeUserCount}/{a.userCount} users active</span>
                        {a.dormantCount > 0 && <span className="jm-cust-dormant">· {a.dormantCount} dormant</span>}
                    </div>
                </div>
                <div className="jm-cust-modstrip">
                    {a.modules.filter((m) => m.subscribed).map((m) => (
                        <span className="jm-cust-modchip" key={m.product_key} title={`${m.product}: ${m.usageScore == null ? 'n/a' : m.usageScore + '%'}`}>
                            <span className="jm-mod-dot" style={{ background: m.color }} />
                            <span className="jm-cust-modchip-name">{m.product}</span>
                            <span className="jm-cust-modchip-val" style={{ color: usageColor(m.usageScore) }}>{m.usageScore == null ? '—' : `${m.usageScore}%`}</span>
                        </span>
                    ))}
                </div>
                <ChevronRight size={18} className={`jm-cust-chev ${open ? 'is-open' : ''}`} />
            </button>

            {/* drill-down — who uses what */}
            {open && (
                <div className="jm-cust-body">
                    <div className="jm-cust-bodyhead"><UsersIcon size={14} /> {a.userCount} product user{a.userCount === 1 ? '' : 's'} — who’s using which module</div>
                    {a.users.length === 0 && <div className="ch-muted" style={{ fontSize: '.82rem' }}>No named users tracked for this customer yet.</div>}
                    <div className="jm-users">
                        {a.users.map((u) => (
                            <div className="jm-user" key={u.name}>
                                <div className="jm-user-id">
                                    <span className="jm-user-avatar" style={{ background: usageColor(u.overallUsage) }}>{u.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
                                    <div>
                                        <div className="jm-user-name">{u.name}</div>
                                        <div className="jm-user-role">{u.role || 'User'} · {u.overallUsage}% overall</div>
                                    </div>
                                </div>
                                <div className="jm-user-mods">
                                    {a.modules.filter((m) => m.subscribed).map((m) => {
                                        const um = u.modules.find((x) => x.product_key === m.product_key);
                                        const v = um ? um.usage : 0;
                                        return (
                                            <UserModuleCell key={m.product_key} account={a.account} user={u} module={m} value={v} onSet={onSetUserUsage} />
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/** One user × module cell — shows usage, click to edit via a slider. */
function UserModuleCell({ account, user, module, value, onSet }) {
    const [editing, setEditing] = useState(false);
    const [v, setV] = useState(value);
    const color = usageColor(value);
    if (editing) {
        return (
            <span className="jm-uc jm-uc-edit" title={`${module.product} — ${user.name}`}>
                <span className="jm-uc-name">{module.product}</span>
                <input type="range" min="0" max="100" value={v} onChange={(e) => setV(Number(e.target.value))}
                    onMouseUp={() => { onSet({ account, user_name: user.name, role: user.role, product_key: module.product_key, usage_score: v }); setEditing(false); }}
                    onBlur={() => setEditing(false)} autoFocus style={{ accentColor: usageColor(v) }} />
                <span className="jm-uc-val">{v}%</span>
            </span>
        );
    }
    return (
        <button className={`jm-uc ${value < 10 ? 'jm-uc-dim' : ''}`} onClick={() => { setV(value); setEditing(true); }} title="Click to set usage" style={{ '--c': color }}>
            <span className="jm-mod-dot" style={{ background: module.color }} />
            <span className="jm-uc-name">{module.product}</span>
            <span className="jm-uc-val" style={{ color }}>{value > 0 ? `${value}%` : '—'}</span>
        </button>
    );
}
