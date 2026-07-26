import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
    Plus, Pencil, Trash2, Search, TrendingUp, Target,
    Wallet, Gauge, Columns3, SlidersHorizontal, ArrowDownUp, RotateCcw,
    UserPlus, Upload, ChevronDown, Handshake, LayoutGrid, Table2, Clock, X, ArrowRight, XCircle, UserCog
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { accountsApi } from '../api/accounts';
import { trainingApi } from '../api/training';
import { performanceApi } from '../api/performance';
import { customFieldsApi } from '../api/dataExchange';
import { fireEvent } from '../api/agents';
import Modal from '../components/Modal';
import ModuleReportMenu from '../components/ModuleReportMenu';
import BulkUploadModal from '../components/BulkUploadModal';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
import ProductScope from '../components/ProductScope';
import './CashHorizon.css';
import { Drillable } from '../components/MetricDrill';

const MEDDICC_LABELS = {
    metrics: 'Metrics',
    economic_buyer: 'Economic Buyer',
    decision_criteria: 'Decision Criteria',
    decision_process: 'Decision Process',
    identify_pain: 'Identify Pain',
    champion: 'Champion',
    competition: 'Competition'
};
const PILLARS = Object.keys(MEDDICC_LABELS);
const SEGMENTS = ['Customer', 'Prospect', 'Partner'];
const STAGES = ['Lead', 'Qualified', 'POC', 'Negotiation', 'Closing', 'Live', 'Renewal', 'Churn Risk'];
const HEALTHS = ['Good', 'Average', 'Poor', 'Critical'];
const REGIONS = ['APAC', 'EMEA', 'AMER', 'ANZ', 'LATAM', 'MEA', 'India'];

const todayStr = () => new Date().toISOString().slice(0, 10);
const isOverdue = (d) => d && d < todayStr();

// Convert a native amount into the chosen display currency using the USD->INR rate.
function toDisplay(amount, currency, display, fx) {
    const inInr = currency === 'INR' ? amount : amount * fx;
    return display === 'INR' ? inInr : inInr / fx;
}
function formatCur(amount, display) {
    const n = Math.round(Number(amount) || 0);
    if (display === 'INR') {
        if (n >= 10000000) return `₹${(n / 10000000).toFixed(2).replace(/\.00$/, '')}Cr`;
        if (n >= 100000) return `₹${(n / 100000).toFixed(2).replace(/\.00$/, '')}L`;
        return `₹${n.toLocaleString('en-IN')}`;
    }
    if (n >= 1000000) return `$${(n / 1000000).toFixed(2).replace(/\.00$/, '')}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    return `$${n}`;
}
const meddiccTier = (s) => (s >= 5 ? 'strong' : s >= 3 ? 'mid' : 'weak');

const blankForm = {
    name: '', segment: 'Prospect', source: 'Direct', sourcing_partner_id: '', stage: 'Lead',
    industry: '', region: 'India', tier: 'Professional', value_amount: '', value_currency: 'INR', probability: '',
    sales_owner: '', partner_manager: '', health: 'Good', renewal: '', next_step: '', next_step_date: '',
    meddicc: PILLARS.reduce((a, p) => ({ ...a, [p]: '' }), {}),
    custom_fields: {}
};

/**
 * The product modules an account has opted for — derived from its contracts'
 * scope, so it stays true without a second place to edit. Read-only here; the
 * modules themselves are chosen on the contract.
 */
function AccountProducts({ account }) {
    const [rows, setRows] = useState(null);
    useEffect(() => {
        let alive = true;
        accountsApi.productScope(account).then((r) => alive && setRows(Array.isArray(r) ? r : [])).catch(() => alive && setRows([]));
        return () => { alive = false; };
    }, [account]);
    if (rows === null) return null;
    return (
        <div className="ch-detail-row" style={{ alignItems: 'flex-start' }}>
            <span className="ch-detail-label">Products</span>
            <span>
                {rows.length === 0 ? (
                    <span className="ch-muted">None yet — chosen on the customer&apos;s contracts</span>
                ) : (
                    <span className="ch-prodchips">
                        {rows.map((p) => {
                            const detail = p.items?.length
                                ? `${p.items.length} ${(p.item_label || 'item').toLowerCase()}${p.items.length === 1 ? '' : 's'}`
                                : p.unit_count ? `${p.unit_count} ${(p.unit_label || '').toLowerCase()}` : '';
                            return (
                                <span className="ch-prodchip" key={p.product_key} style={{ '--prod': p.color }} title={p.items?.join(', ') || ''}>
                                    {p.product}{detail ? ` · ${detail}` : ''}
                                </span>
                            );
                        })}
                    </span>
                )}
            </span>
        </div>
    );
}

/** Training courses the account is entitled to, from its opted modules. */
function AccountTraining({ account }) {
    const [data, setData] = useState(null);
    useEffect(() => {
        let alive = true;
        trainingApi.available(account).then((r) => alive && setData(r)).catch(() => alive && setData({ courses: [] }));
        return () => { alive = false; };
    }, [account]);
    if (!data) return null;
    const courses = data.courses || [];
    return (
        <div className="ch-detail-row" style={{ alignItems: 'flex-start' }}>
            <span className="ch-detail-label">Training courses</span>
            <span>
                {courses.length === 0 ? <span className="ch-muted">none available</span> : (
                    <span className="ch-prodchips">
                        {courses.slice(0, 8).map((c) => (
                            <span className="ch-prodchip" key={c.course_key} title={`${c.level} · ₹${c.seat_price}/seat`}>{c.title}</span>
                        ))}
                        {courses.length > 8 && <span className="ch-muted">+{courses.length - 8} more</span>}
                    </span>
                )}
            </span>
        </div>
    );
}

// The deal board columns. 'Closed' is the terminal win; 'Lost' the terminal
// loss (kept off pipeline value totals, tracked for win-rate).
const PIPELINE_STAGES = ['Lead', 'Qualified', 'POC', 'Negotiation', 'Closed', 'Lost'];
const STAGE_TONE = {
    Lead: '#94a3b8', Qualified: '#38bdf8', POC: '#a855f7', Negotiation: '#f59e0b', Closed: '#10b981', Lost: '#ef4444'
};

/**
 * The pipeline as a kanban.
 *
 * Cards carry how long they've sat in the current stage, so a deal going stale
 * is visible without opening it. Dragging a card to another column moves the
 * stage and — because the backend stamps the date — feeds the time-to-close
 * measurement. Uses native HTML5 drag-and-drop; no library.
 */
function PipelineBoard({ accounts, onMove, onOpen, display, formatCur }) {
    const [dragId, setDragId] = useState(null);
    const [overStage, setOverStage] = useState(null);

    // Only pipeline accounts belong on the board — a Live customer is not a deal.
    const cols = PIPELINE_STAGES.map((stage) => ({
        stage,
        cards: accounts.filter((a) => a.segment !== 'Partner' && (a.stage || 'Lead') === stage)
    }));
    const onBoard = cols.reduce((n, c) => n + c.cards.length, 0);

    const drop = (stage) => {
        const card = accounts.find((a) => a.id === dragId);
        setDragId(null); setOverStage(null);
        if (card) onMove(card, stage);
    };

    return (
        <div className="ch-board">
            {cols.map(({ stage, cards }) => {
                const total = cards.reduce((s, a) => s + toDisplay(a.value_amount, a.value_currency, display, 83), 0);
                return (
                    <div key={stage}
                        className={`ch-board-col ${overStage === stage ? 'is-over' : ''}`}
                        style={{ '--stage': STAGE_TONE[stage] }}
                        onDragOver={(e) => { e.preventDefault(); setOverStage(stage); }}
                        onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
                        onDrop={() => drop(stage)}
                    >
                        <div className="ch-board-head">
                            <span className="ch-board-dot" />
                            <span className="ch-board-title">{stage}</span>
                            <span className="ch-board-count">{cards.length}</span>
                        </div>
                        <div className="ch-board-sub">{formatCur(total, display)}</div>
                        <div className="ch-board-cards">
                            {cards.map((a) => (
                                <div key={a.id}
                                    className={`ch-card ${dragId === a.id ? 'is-dragging' : ''}`}
                                    draggable
                                    onDragStart={() => setDragId(a.id)}
                                    onDragEnd={() => { setDragId(null); setOverStage(null); }}
                                    onClick={() => onOpen(a)}
                                >
                                    <div className="ch-card-name">{a.name}</div>
                                    <div className="ch-card-meta">
                                        <span className="ch-card-val">{formatCur(toDisplay(a.value_amount, a.value_currency, display, 83), display)}</span>
                                        {a.segment === 'Prospect' && <span className="ch-card-prob">{a.probability || 0}%</span>}
                                    </div>
                                    <div className="ch-card-foot">
                                        <span className={`ch-card-age ${a.days_in_stage > 21 ? 'is-stale' : ''}`}>
                                            <Clock size={11} /> {a.days_in_stage ?? 0}d in stage
                                        </span>
                                        {a.stage === 'Closed' && a.days_to_close != null && (
                                            <span className="ch-card-closed">closed in {a.days_to_close}d</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {cards.length === 0 && <div className="ch-board-empty">Drop deals here</div>}
                        </div>
                    </div>
                );
            })}
            {onBoard === 0 && <div className="ch-empty" style={{ gridColumn: '1 / -1' }}>No accounts in the pipeline. Add one, or clear your filters.</div>}
        </div>
    );
}

/**
 * Admin-only performance analytics: how each Account Manager and each Partner
 * is performing across the book. Data comes from the admin-gated /performance
 * endpoints (a non-admin never reaches this tab, and the API refuses them).
 */
function PerfStat({ label, value }) {
    return (
        <div>
            <div className="ch-partner-stat-label">{label}</div>
            <div className="ch-partner-stat-value">{value}</div>
        </div>
    );
}
function PerformanceView({ display, formatCur }) {
    const [ams, setAms] = useState(null);
    const [partners, setPartners] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let alive = true;
        Promise.all([performanceApi.accountManagers(), performanceApi.partners()])
            .then(([a, p]) => { if (alive) { setAms(a); setPartners(p); } })
            .catch((e) => alive && setError(e.message || 'Failed to load performance'));
        return () => { alive = false; };
    }, []);
    if (error) return <div className="ch-error">{error}</div>;
    if (!ams || !partners) return <div className="ch-empty">Loading performance…</div>;
    return (
        <div className="ch-perf">
            <div className="ch-perf-head"><UserCog size={17} /> Account Manager Performance <span className="ch-muted">· {ams.length}</span></div>
            <div className="ch-partner-grid">
                {ams.map((m) => (
                    <div className="glass-card ch-partner-card" key={m.manager}>
                        <div className="ch-partner-name">{m.manager}</div>
                        <div className="ch-partner-owner">{m.customers} customers · {m.prospects} open deals</div>
                        <div className="ch-partner-stats">
                            <PerfStat label="Portfolio" value={formatCur(m.portfolioInr, display)} />
                            <PerfStat label="Weighted pipe" value={formatCur(m.weightedInr, display)} />
                            <PerfStat label="Win rate" value={m.winRate === null ? '—' : `${m.winRate}%`} />
                            <PerfStat label="Avg MEDDICC" value={`${m.avgMeddicc}/7`} />
                        </div>
                    </div>
                ))}
                {!ams.length && <div className="ch-empty">No account managers assigned yet.</div>}
            </div>

            <div className="ch-perf-head"><Handshake size={17} /> Partner Performance <span className="ch-muted">· {partners.length}</span></div>
            <div className="ch-partner-grid">
                {partners.map((p) => (
                    <div className="glass-card ch-partner-card" key={p.id}>
                        <div className="ch-partner-name">{p.name}</div>
                        <div className="ch-partner-mgr"><Handshake size={13} /> {p.manager || 'No account manager'}</div>
                        <div className="ch-partner-stats">
                            <PerfStat label="Sourced" value={p.sourcedCount} />
                            <PerfStat label="Win rate" value={`${p.winRate}%`} />
                            <PerfStat label="Closed value" value={formatCur(p.closedValueInr, display)} />
                            <PerfStat label="Weighted pipe" value={formatCur(p.pipelineValueInr, display)} />
                        </div>
                    </div>
                ))}
                {!partners.length && <div className="ch-empty">No partners yet.</div>}
            </div>
        </div>
    );
}

/** A partner's sourced book — won accounts and live pipeline, each openable. */
function PartnerDetail({ partner, formatCur, display, onOpenAccount }) {
    const won = partner.sourced.filter((a) => a.segment === 'Customer');
    const pipe = partner.sourced.filter((a) => a.segment === 'Prospect');
    return (
        <div className="ch-pd">
            <div className="ch-pd-mgr">
                <Handshake size={15} />
                <div>
                    <strong>{partner.partner_manager || 'No account manager assigned'}</strong>
                    <span>Partner / Account Manager</span>
                </div>
            </div>
            <div className="ch-pd-stats">
                <div><span>{partner.sourcedCount}</span><em>accounts sourced</em></div>
                <div><span>{partner.winRate}%</span><em>win rate</em></div>
                <div><span>{formatCur(partner.closedValue, display)}</span><em>closed value</em></div>
                <div><span>{formatCur(partner.pipelineValue, display)}</span><em>weighted pipeline</em></div>
            </div>

            {won.length > 0 && (
                <>
                    <h4 className="ch-pd-h">Won · {won.length}</h4>
                    <div className="ch-pd-list">
                        {won.map((a) => (
                            <button key={a.id} className="ch-pd-item" onClick={() => onOpenAccount(a.id)}>
                                <span className="ch-pd-item-name">{a.name}</span>
                                <span className="ch-pd-item-val">{formatCur(a.value, display)}</span>
                                <ArrowRight size={13} />
                            </button>
                        ))}
                    </div>
                </>
            )}
            {pipe.length > 0 && (
                <>
                    <h4 className="ch-pd-h">In pipeline · {pipe.length}</h4>
                    <div className="ch-pd-list">
                        {pipe.map((a) => (
                            <button key={a.id} className="ch-pd-item" onClick={() => onOpenAccount(a.id)}>
                                <span className="ch-pd-item-name">{a.name}</span>
                                <span className="ch-pd-item-stage" style={{ color: STAGE_TONE[a.stage] || 'var(--text-muted)' }}>{a.stage}</span>
                                <span className="ch-pd-item-val">{formatCur(a.value, display)}</span>
                                <ArrowRight size={13} />
                            </button>
                        ))}
                    </div>
                </>
            )}
            {partner.sourced.length === 0 && (
                <div className="ch-muted" style={{ padding: '1.5rem 0', textAlign: 'center' }}>
                    No accounts sourced yet. When you add an account and pick {partner.name} as the sourcing partner, it appears here.
                </div>
            )}
        </div>
    );
}

function AccountForm({ initial, partners, defs, products, onSave, onCancel, saving }) {
    const [f, setF] = useState(initial);
    const set = (k, v) => setF((prev) => ({ ...prev, [k]: v }));
    const setM = (k, v) => setF((prev) => ({ ...prev, meddicc: { ...prev.meddicc, [k]: v } }));
    const setCF = (k, v) => setF((prev) => ({ ...prev, custom_fields: { ...prev.custom_fields, [k]: v } }));

    // Product modules the customer opted for, captured on the account. Preloaded
    // for an existing account; empty for a new one.
    const [scope, setScope] = useState({});
    useEffect(() => {
        if (!initial.id || !initial.name) return undefined;
        let alive = true;
        accountsApi.productScope(initial.name).then((rows) => {
            if (!alive) return;
            const next = {};
            for (const r of rows) next[r.product_key] = { unit_count: r.unit_count, items: r.items, info: r.info };
            setScope(next);
        }).catch(() => {});
        return () => { alive = false; };
    }, [initial.id, initial.name]);

    const submit = (e) => {
        e.preventDefault();
        const _scope = Object.entries(scope).map(([product_key, v]) => ({
            product_key, unit_count: Number(v.unit_count) || 0, items: v.items || [], info: v.info || ''
        }));
        onSave({
            name: f.name,
            segment: f.segment,
            source: f.source,
            sourcing_partner_id: f.source === 'Partner' && f.sourcing_partner_id ? Number(f.sourcing_partner_id) : null,
            stage: f.stage,
            industry: f.industry,
            region: f.region,
            tier: f.tier,
            value_amount: Math.max(0, Math.round(Number(f.value_amount) || 0)),
            value_currency: f.value_currency,
            probability: Math.min(100, Math.max(0, Math.round(Number(f.probability) || 0))),
            sales_owner: f.sales_owner,
            partner_manager: f.partner_manager || '',
            health: f.health,
            renewal: f.renewal,
            next_step: f.next_step,
            next_step_date: f.next_step_date,
            meddicc: f.meddicc,
            custom_fields: f.custom_fields || {},
            _scope
        });
    };

    return (
        <form className="ch-form" onSubmit={submit}>
            <div className="ch-field">
                <label>{f.segment === 'Partner' ? 'Partner name *' : 'Account name *'}</label>
                <input required value={f.name} onChange={(e) => set('name', e.target.value)}
                    placeholder={f.segment === 'Partner' ? 'e.g. Deloitte India' : 'e.g. Bajaj Finserv'} />
            </div>

            <div className="ch-form-grid">
                <div className="ch-field">
                    <label>Segment</label>
                    <select value={f.segment} onChange={(e) => set('segment', e.target.value)}>
                        {SEGMENTS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                </div>
                {f.segment !== 'Partner' && (
                    <div className="ch-field">
                        <label>Source</label>
                        <select value={f.source} onChange={(e) => set('source', e.target.value)}>
                            <option>Direct</option>
                            <option>Partner</option>
                        </select>
                    </div>
                )}
            </div>

            {f.source === 'Partner' && (
                <div className="ch-field">
                    <label>Sourcing partner</label>
                    <select value={f.sourcing_partner_id} onChange={(e) => set('sourcing_partner_id', e.target.value)}>
                        <option value="">— select partner —</option>
                        {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
            )}

            <div className="ch-form-grid">
                {f.segment !== 'Partner' && (
                    <div className="ch-field">
                        <label>Stage</label>
                        <select value={f.stage} onChange={(e) => set('stage', e.target.value)}>
                            {STAGES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                    </div>
                )}
                <div className="ch-field">
                    <label>Industry</label>
                    <input value={f.industry} onChange={(e) => set('industry', e.target.value)} placeholder="NBFC" />
                </div>
            </div>

            <div className="ch-field">
                <label>Global region</label>
                <select value={f.region} onChange={(e) => set('region', e.target.value)}>
                    {REGIONS.map((r) => <option key={r}>{r}</option>)}
                </select>
            </div>

            <div className="ch-form-grid">
                <div className="ch-field">
                    <label>{f.segment === 'Prospect' ? 'Probable value' : 'Account value'}</label>
                    <div className="ch-value-row">
                        <input type="number" min="0" value={f.value_amount} onChange={(e) => set('value_amount', e.target.value)} placeholder="0" />
                        <select value={f.value_currency} onChange={(e) => set('value_currency', e.target.value)}>
                            <option>INR</option>
                            <option>USD</option>
                        </select>
                    </div>
                </div>
                <div className="ch-field">
                    <label>{f.segment === 'Prospect' ? 'Win probability (%)' : 'Tier'}</label>
                    {f.segment === 'Prospect'
                        ? <input type="number" min="0" max="100" value={f.probability} onChange={(e) => set('probability', e.target.value)} placeholder="0" />
                        : <input value={f.tier} onChange={(e) => set('tier', e.target.value)} placeholder="Enterprise" />}
                </div>
            </div>

            <div className="ch-form-grid">
                <div className="ch-field">
                    <label>{f.segment === 'Partner' ? 'Partner owner' : 'Sales owner'}</label>
                    <input value={f.sales_owner} onChange={(e) => set('sales_owner', e.target.value)} placeholder="Priya Sharma" />
                </div>
                {f.segment === 'Partner' ? (
                    <div className="ch-field">
                        <label>Partner / Account Manager *</label>
                        <input value={f.partner_manager} onChange={(e) => set('partner_manager', e.target.value)} placeholder="Who manages this partner" />
                    </div>
                ) : (
                    <div className="ch-field">
                        <label>Health</label>
                        <select value={f.health} onChange={(e) => set('health', e.target.value)}>
                            {HEALTHS.map((h) => <option key={h}>{h}</option>)}
                        </select>
                    </div>
                )}
            </div>

            <div className="ch-form-grid">
                <div className="ch-field">
                    <label>Next step</label>
                    <input value={f.next_step} onChange={(e) => set('next_step', e.target.value)} placeholder="Discovery call" />
                </div>
                <div className="ch-field">
                    <label>Next step date</label>
                    <input type="date" value={f.next_step_date} onChange={(e) => set('next_step_date', e.target.value)} />
                </div>
            </div>

            {/* MEDDICC is a deal-qualification framework — it has no meaning for a
                partner relationship, so it is hidden when adding one. */}
            {f.segment !== 'Partner' && (
                <>
                    <div className="ch-section-title">MEDDICC qualification</div>
                    <div className="ch-meddicc-grid">
                        {PILLARS.map((p) => (
                            <div className="ch-field" key={p}>
                                <label>{MEDDICC_LABELS[p]}</label>
                                <textarea rows={2} value={f.meddicc[p]} onChange={(e) => setM(p, e.target.value)} />
                            </div>
                        ))}
                    </div>
                </>
            )}

            {defs && defs.length > 0 && (
                <>
                    <div className="ch-section-title">Custom fields</div>
                    <div className="ch-form-grid">
                        {defs.map((d) => (
                            <div className="ch-field" key={d.key}>
                                <label>{d.label}</label>
                                {d.type === 'select' ? (
                                    <select value={(f.custom_fields || {})[d.key] || ''} onChange={(e) => setCF(d.key, e.target.value)}>
                                        <option value="">—</option>
                                        {d.options.map((o) => <option key={o}>{o}</option>)}
                                    </select>
                                ) : (
                                    <input
                                        type={d.type === 'number' ? 'number' : d.type === 'date' ? 'date' : 'text'}
                                        value={(f.custom_fields || {})[d.key] ?? ''}
                                        onChange={(e) => setCF(d.key, e.target.value)}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}

            <div className="ch-section-title">Products &amp; modules</div>
            <p className="ch-muted" style={{ fontSize: '0.76rem', marginTop: '-0.4rem', marginBottom: '0.6rem' }}>
                Which modules has this customer opted for? Saved on the account; contracts formalise the scope in CLM.
            </p>
            <ProductScope products={products || []} value={scope} onChange={setScope} embedded />

            <div className="ch-form-actions">
                <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save account'}</button>
            </div>
        </form>
    );
}

function ColumnForm({ defs, onSave, onRemove, onCancel }) {
    const [label, setLabel] = useState('');
    const [type, setType] = useState('text');
    const [options, setOptions] = useState('');

    const submit = (e) => {
        e.preventDefault();
        if (!label.trim()) return;
        onSave({
            label: label.trim(),
            type,
            options: type === 'select' ? options.split(',').map((s) => s.trim()).filter(Boolean) : []
        });
        setLabel(''); setType('text'); setOptions('');
    };

    return (
        <div>
            {defs.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                    <div className="ch-section-title" style={{ borderTop: 'none', paddingTop: 0 }}>Existing custom columns</div>
                    {defs.map((d) => (
                        <div key={d.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: '0.85rem' }}>
                            <span>{d.label} <span className="ch-muted">· {d.type}</span></span>
                            <button className="ch-iconbtn ch-iconbtn--danger" onClick={() => onRemove(d.id)} title="Remove"><Trash2 size={15} /></button>
                        </div>
                    ))}
                </div>
            )}
            <form className="ch-form" onSubmit={submit}>
                <div className="ch-field">
                    <label>Column name</label>
                    <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Deal Region" required />
                </div>
                <div className="ch-field">
                    <label>Type</label>
                    <select value={type} onChange={(e) => setType(e.target.value)}>
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="select">Dropdown (select)</option>
                    </select>
                </div>
                {type === 'select' && (
                    <div className="ch-field">
                        <label>Options (comma-separated)</label>
                        <input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="North, South, West" />
                    </div>
                )}
                <div className="ch-form-actions">
                    <button type="button" className="btn btn-ghost" onClick={onCancel}>Close</button>
                    <button type="submit" className="btn btn-primary">Add column</button>
                </div>
            </form>
        </div>
    );
}

export default function CashHorizon() {
    const { user } = useAuth();
    const [accounts, setAccounts] = useState([]);
    const [meta, setMeta] = useState({ fxUsdInr: 83, role: user?.role });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [display, setDisplay] = useState('INR');
    const [segment, setSegment] = useState('All');
    const [sourceFilter, setSourceFilter] = useState('All');
    const [search, setSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const emptyFilters = { stage: 'All', owner: 'All', health: 'All', partner: 'All', industry: 'All', region: 'All', tier: 'All', valueMin: '', valueMax: '', probMin: '', probMax: '', meddiccMin: 0, overdueOnly: false };
    const [filters, setFilters] = useState(emptyFilters);
    const [sort, setSort] = useState({ by: 'value', dir: 'desc' });
    const setF = (k, v) => setFilters((prev) => ({ ...prev, [k]: v }));
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [detail, setDetail] = useState(null);
    const [saving, setSaving] = useState(false);
    const [defs, setDefs] = useState([]);
    const [colModal, setColModal] = useState(false);
    const [addMenuOpen, setAddMenuOpen] = useState(false);
    const [bulkOpen, setBulkOpen] = useState(false);
    const addMenuRef = useRef(null);
    // 'table' | 'board' — the pipeline kanban lives behind this toggle.
    const [pipeView, setPipeView] = useState('table');
    const [partnerDetail, setPartnerDetail] = useState(null);

    useEffect(() => {
        const onOutside = (e) => { if (addMenuRef.current && !addMenuRef.current.contains(e.target)) setAddMenuOpen(false); };
        document.addEventListener('mousedown', onOutside);
        return () => document.removeEventListener('mousedown', onOutside);
    }, []);

    const role = meta.role || user?.role;
    const isAdmin = role === 'admin';
    const canEditSchema = role === 'admin' || role === 'manager';
    const fx = meta.fxUsdInr || 83;

    const load = async () => {
        try {
            setError('');
            const [list, m, d] = await Promise.all([accountsApi.list(), accountsApi.meta(), customFieldsApi.list('accounts')]);
            setAccounts(list);
            setMeta(m);
            setDefs(d);
        } catch (e) {
            setError(e.message || 'Failed to load accounts');
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        load();
        // Reload when the global Data menu imports a file for this module.
        const onChange = (e) => { if (!e.detail || e.detail.module === 'accounts') load(); };
        window.addEventListener('module-data-changed', onChange);
        return () => window.removeEventListener('module-data-changed', onChange);
    }, []);

    const partners = useMemo(() => accounts.filter((a) => a.segment === 'Partner'), [accounts]);
    const partnerName = (id) => partners.find((p) => p.id === id)?.name;

    const counts = useMemo(() => ({
        All: accounts.filter((a) => a.segment !== 'Partner').length,
        Customer: accounts.filter((a) => a.segment === 'Customer').length,
        Prospect: accounts.filter((a) => a.segment === 'Prospect').length,
        Partner: partners.length
    }), [accounts, partners]);

    const kpis = useMemo(() => {
        const custs = accounts.filter((a) => a.segment === 'Customer');
        const pros = accounts.filter((a) => a.segment === 'Prospect');
        // A Lost deal is terminal — it must not sit in "open" pipeline or its
        // weighted forecast. Kept aside for win-rate + a lost-value read.
        const openPros = pros.filter((a) => a.stage !== 'Lost');
        const lost = pros.filter((a) => a.stage === 'Lost');
        const dv = (a) => toDisplay(a.value_amount, a.value_currency, display, fx);
        const portfolio = custs.reduce((s, a) => s + dv(a), 0);
        const openPipe = openPros.reduce((s, a) => s + dv(a), 0);
        const weighted = openPros.reduce((s, a) => s + dv(a) * (a.probability / 100), 0);
        const avgMed = openPros.length ? openPros.reduce((s, a) => s + a.meddicc_score, 0) / openPros.length : 0;
        // Of the deals that reached a verdict on the board (Closed won vs Lost),
        // what share did we win?
        const decided = pros.filter((a) => a.stage === 'Closed').length + lost.length;
        const winRate = decided ? Math.round((pros.filter((a) => a.stage === 'Closed').length / decided) * 100) : null;
        return {
            portfolio, openPipe, weighted, avgMed,
            custCount: custs.length, proCount: openPros.length,
            lostCount: lost.length, lostValue: lost.reduce((s, a) => s + dv(a), 0), winRate
        };
    }, [accounts, display, fx]);

    const partnerScorecard = useMemo(() => partners.map((p) => {
        const sourced = accounts.filter((a) => a.sourcing_partner_id === p.id);
        const won = sourced.filter((a) => a.segment === 'Customer');
        const pipe = sourced.filter((a) => a.segment === 'Prospect');
        const dv = (a) => toDisplay(a.value_amount, a.value_currency, display, fx);
        return {
            ...p,
            sourcedCount: sourced.length,
            closedValue: won.reduce((s, a) => s + dv(a), 0),
            pipelineValue: pipe.reduce((s, a) => s + dv(a) * (a.probability / 100), 0),
            winRate: sourced.length ? Math.round((won.length / sourced.length) * 100) : 0,
            // The accounts themselves, so the detail view can list who this
            // partner brought in — the loop the user asked to close.
            sourced: sourced.map((a) => ({ id: a.id, name: a.name, segment: a.segment, stage: a.stage, value: dv(a), health: a.health }))
        };
    }), [partners, accounts, display, fx]);

    // Distinct values present in the data, for the filter dropdowns.
    const filterOptions = useMemo(() => {
        const uniq = (arr) => [...new Set(arr.filter((v) => v !== null && v !== undefined && v !== ''))].sort();
        return {
            owners: uniq(accounts.map((a) => a.sales_owner)),
            industries: uniq(accounts.map((a) => a.industry)),
            tiers: uniq(accounts.map((a) => a.tier))
        };
    }, [accounts]);

    const activeCount = useMemo(() => {
        let n = 0;
        if (sourceFilter !== 'All') n += 1;
        if (search.trim()) n += 1;
        ['stage', 'owner', 'health', 'partner', 'industry', 'region', 'tier'].forEach((k) => { if (filters[k] !== 'All') n += 1; });
        if (filters.valueMin !== '') n += 1;
        if (filters.valueMax !== '') n += 1;
        if (filters.probMin !== '') n += 1;
        if (filters.probMax !== '') n += 1;
        if (Number(filters.meddiccMin) > 0) n += 1;
        if (filters.overdueOnly) n += 1;
        return n;
    }, [sourceFilter, search, filters]);

    const clearFilters = () => { setFilters(emptyFilters); setSourceFilter('All'); setSearch(''); };

    const visible = useMemo(() => {
        let list = segment === 'All'
            ? accounts.filter((a) => a.segment !== 'Partner')
            : accounts.filter((a) => a.segment === segment);

        const dvv = (a) => toDisplay(a.value_amount, a.value_currency, display, fx);
        const f = filters;

        if (sourceFilter !== 'All') list = list.filter((a) => a.source === sourceFilter);
        if (search.trim()) list = list.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()));
        if (f.stage !== 'All') list = list.filter((a) => a.stage === f.stage);
        if (f.owner !== 'All') list = list.filter((a) => a.sales_owner === f.owner);
        if (f.health !== 'All') list = list.filter((a) => a.health === f.health);
        if (f.partner !== 'All') list = list.filter((a) => String(a.sourcing_partner_id) === String(f.partner));
        if (f.industry !== 'All') list = list.filter((a) => a.industry === f.industry);
        if (f.region !== 'All') list = list.filter((a) => a.region === f.region);
        if (f.tier !== 'All') list = list.filter((a) => a.tier === f.tier);
        if (f.valueMin !== '') list = list.filter((a) => dvv(a) >= Number(f.valueMin));
        if (f.valueMax !== '') list = list.filter((a) => dvv(a) <= Number(f.valueMax));
        if (f.probMin !== '') list = list.filter((a) => a.probability >= Number(f.probMin));
        if (f.probMax !== '') list = list.filter((a) => a.probability <= Number(f.probMax));
        if (Number(f.meddiccMin) > 0) list = list.filter((a) => a.meddicc_score >= Number(f.meddiccMin));
        if (f.overdueOnly) list = list.filter((a) => isOverdue(a.next_step_date));

        const dir = sort.dir === 'asc' ? 1 : -1;
        const sortVal = (a) => {
            switch (sort.by) {
                case 'value': return dvv(a);
                case 'probability': return a.probability;
                case 'meddicc': return a.meddicc_score;
                case 'next_step_date': return a.next_step_date || '';
                case 'name': return a.name.toLowerCase();
                default: return dvv(a);
            }
        };
        return [...list].sort((a, b) => {
            const va = sortVal(a); const vb = sortVal(b);
            if (va < vb) return -1 * dir;
            if (va > vb) return 1 * dir;
            return 0;
        });
    }, [accounts, segment, sourceFilter, search, filters, sort, display, fx]);

    const { pageItems: pagedVisible, ...pg } = usePagination(visible, 'accounts');

    const totalInSegment = useMemo(() => (
        segment === 'All' ? accounts.filter((a) => a.segment !== 'Partner').length : accounts.filter((a) => a.segment === segment).length
    ), [accounts, segment]);

    const openAdd = () => { setEditing({ ...blankForm }); setFormOpen(true); };
    // Same form, pre-set to a partner — so the partner-only fields show and the
    // pipeline fields hide.
    const openAddPartner = () => { setEditing({ ...blankForm, segment: 'Partner', source: 'Direct', tier: 'Partner' }); setFormOpen(true); };

    // Drag-drop on the board: move an account to a stage. The backend stamps the
    // date and appends to the stage trail. Optimistic — the card jumps columns
    // immediately, and a failure reloads to the truth.
    const moveStage = async (account, stage) => {
        if (account.stage === stage) return;
        setAccounts((prev) => prev.map((a) => (a.id === account.id ? { ...a, stage } : a)));
        try {
            await accountsApi.update(account.id, { stage });
            fireEvent('account_updated', 'aukat');
            await load();
        } catch (e) {
            setError(e.message || 'Could not move the deal');
            await load();
        }
    };
    const openEdit = (a) => {
        setEditing({
            ...blankForm, ...a,
            sourcing_partner_id: a.sourcing_partner_id || '',
            value_amount: a.value_amount || '',
            probability: a.probability || '',
            meddicc: { ...blankForm.meddicc, ...a.meddicc }
        });
        setFormOpen(true);
    };

    const save = async (payload) => {
        setSaving(true);
        try {
            const { _scope, ...accountData } = payload;
            const isEdit = editing && editing.id;
            const result = isEdit ? await accountsApi.update(editing.id, accountData) : await accountsApi.create(accountData);
            // Save the opted-modules scope against the account name (known now).
            if (_scope) {
                try { await accountsApi.setProductScope(result?.name || accountData.name, _scope); }
                catch (e) { setError(`Account saved, but modules failed: ${e.message}`); }
            }
            setFormOpen(false);
            setEditing(null);
            setDetail(null);
            await load();
            fireEvent(isEdit ? 'account_updated' : 'account_created', 'aukat');
            if (result?.meddicc_score >= 5) fireEvent('deal_qualified', 'aukat');
        } catch (e) {
            setError(e.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const del = async (a) => {
        if (!window.confirm(`Delete account "${a.name}"? This cannot be undone.`)) return;
        try {
            await accountsApi.remove(a.id);
            setDetail(null);
            await load();
        } catch (e) {
            setError(e.message || 'Delete failed');
        }
    };

    const loadSampleData = async () => {
        await accountsApi.seedSample();
        await load();
    };

    const addColumn = async (payload) => {
        try {
            await customFieldsApi.create({ module: 'accounts', ...payload });
            setColModal(false);
            setDefs(await customFieldsApi.list('accounts'));
            fireEvent('custom_column_added', 'aukat');
        } catch (e) {
            setError(e.message || 'Could not add column');
        }
    };

    const removeColumn = async (id) => {
        if (!window.confirm('Remove this custom column? Existing values are hidden but not deleted.')) return;
        try {
            await customFieldsApi.remove(id, 'accounts');
            setDefs(await customFieldsApi.list('accounts'));
        } catch (e) {
            setError(e.message || 'Could not remove column');
        }
    };

    return (
        <div className="animate-fade-in">
            <header className="ch-head">
                <div>
                    <h1 className="ch-title">Cash Horizon</h1>
                    <p className="ch-sub">Live view of the sales team — customers, pipeline, and partner-sourced deals.</p>
                </div>
                <div className="ch-actions">
                    <div className="ch-cur" role="group" aria-label="Display currency">
                        <button className={display === 'INR' ? 'active' : ''} onClick={() => setDisplay('INR')}>₹ INR</button>
                        <button className={display === 'USD' ? 'active' : ''} onClick={() => setDisplay('USD')}>$ USD</button>
                    </div>
                    <ModuleReportMenu module="accounts" title="Cash Horizon" />
                    {/* On the Partners tab the primary action is adding a partner —
                        a different thing from an account, with its own fields. */}
                    {segment === 'Partner' ? (
                        <button className="btn btn-primary" onClick={openAddPartner}>
                            <Handshake size={18} /> Add partner
                        </button>
                    ) : (
                        <div style={{ position: 'relative' }} ref={addMenuRef}>
                            <button className="btn btn-primary" onClick={() => setAddMenuOpen((o) => !o)}>
                                <Plus size={18} /> Add account <ChevronDown size={15} />
                            </button>
                            {addMenuOpen && (
                                <div style={{
                                    position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 230,
                                    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                    borderRadius: 12, padding: 8, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 100
                                }}>
                                    <button
                                        className="ch-menu-item"
                                        onClick={() => { setAddMenuOpen(false); openAdd(); }}
                                    >
                                        <UserPlus size={16} /> Add individual account
                                    </button>
                                    <button
                                        className="ch-menu-item"
                                        onClick={() => { setAddMenuOpen(false); setBulkOpen(true); }}
                                    >
                                        <Upload size={16} /> Bulk upload
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {error && <div className="ch-error">{error}</div>}

            <div className="ch-kpis">
                <Drillable metric="accounts.customers" label="Customers" className="ch-kpi-drill">
                <div className="glass-card ch-kpi">
                    <div className="ch-kpi-label"><Wallet size={15} /> Customer portfolio</div>
                    <div className="ch-kpi-value">{formatCur(kpis.portfolio, display)}</div>
                    <div className="ch-kpi-hint">{kpis.custCount} active customers</div>
                </div>
                </Drillable>
                <Drillable metric="accounts.pipeline" label="Open pipeline" className="ch-kpi-drill">
                <div className="glass-card ch-kpi">
                    <div className="ch-kpi-label"><Target size={15} /> Open pipeline</div>
                    <div className="ch-kpi-value">{formatCur(kpis.openPipe, display)}</div>
                    <div className="ch-kpi-hint">{kpis.proCount} prospects</div>
                </div>
                </Drillable>
                <Drillable metric="accounts.weighted" label="Weighted forecast" className="ch-kpi-drill">
                <div className="glass-card ch-kpi">
                    <div className="ch-kpi-label"><TrendingUp size={15} /> Weighted forecast</div>
                    <div className="ch-kpi-value">{formatCur(kpis.weighted, display)}</div>
                    <div className="ch-kpi-hint">value × win probability</div>
                </div>
                </Drillable>
                <Drillable metric="accounts.meddicc" label="Avg MEDDICC" className="ch-kpi-drill">
                <div className="glass-card ch-kpi">
                    <div className="ch-kpi-label"><Gauge size={15} /> Avg MEDDICC</div>
                    <div className="ch-kpi-value">{kpis.avgMed.toFixed(1)}<span className="ch-muted" style={{ fontSize: '1rem' }}> / 7</span></div>
                    <div className="ch-kpi-hint">deal qualification strength</div>
                </div>
                </Drillable>
                <div className="glass-card ch-kpi">
                    <div className="ch-kpi-label"><XCircle size={15} /> Win rate</div>
                    <div className="ch-kpi-value">{kpis.winRate === null ? '—' : `${kpis.winRate}%`}</div>
                    <div className="ch-kpi-hint">{kpis.lostCount} lost · {formatCur(kpis.lostValue, display)}</div>
                </div>
            </div>

            <div className="ch-toolbar">
                <div className="ch-tabs">
                    {['All', 'Customer', 'Prospect', 'Partner', ...(isAdmin ? ['Performance'] : [])].map((s) => (
                        <button key={s} className={`ch-tab ${segment === s ? 'active' : ''}`} onClick={() => setSegment(s)}>
                            {s === 'All' ? 'All' : s === 'Performance' ? 'Performance' : s + 's'}
                            {counts[s] !== undefined && <span className="ch-tab-count">{counts[s]}</span>}
                        </button>
                    ))}
                </div>
                {segment !== 'Partner' && segment !== 'Performance' && (
                    <>
                        {/* Table for the full record, board to work the pipeline and
                            watch how long deals sit in a stage. */}
                        <div className="ch-viewtoggle" role="group" aria-label="View">
                            <button className={pipeView === 'table' ? 'on' : ''} onClick={() => setPipeView('table')}>
                                <Table2 size={14} /> Table
                            </button>
                            <button className={pipeView === 'board' ? 'on' : ''} onClick={() => setPipeView('board')}>
                                <LayoutGrid size={14} /> Board
                            </button>
                        </div>
                        <select className="ch-filter" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                            <option value="All">All sources</option>
                            <option value="Direct">Direct</option>
                            <option value="Partner">Via partner</option>
                        </select>
                        <button className={`ch-tab ${showFilters || activeCount ? 'active' : ''}`} onClick={() => setShowFilters((v) => !v)}>
                            <SlidersHorizontal size={15} /> Filters{activeCount > 0 ? ` (${activeCount})` : ''}
                        </button>
                        {/* Add column lives beside Filters — it customises the accounts table. */}
                        {canEditSchema && (
                            <button className="ch-tab" onClick={() => setColModal(true)}>
                                <Columns3 size={15} /> Add column
                            </button>
                        )}
                    </>
                )}
                <div className="ch-spacer" />
                {segment !== 'Partner' && segment !== 'Performance' && (
                    <>
                        <span className="ch-muted" style={{ fontSize: '0.8rem' }}>{visible.length} of {totalInSegment}</span>
                        <div className="ch-sort">
                            <ArrowDownUp size={14} />
                            <select value={sort.by} onChange={(e) => setSort((s) => ({ ...s, by: e.target.value }))}>
                                <option value="value">Value</option>
                                <option value="probability">Probability</option>
                                <option value="meddicc">MEDDICC</option>
                                <option value="next_step_date">Next step date</option>
                                <option value="name">Name</option>
                            </select>
                            <button className="ch-iconbtn" onClick={() => setSort((s) => ({ ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' }))} title="Toggle sort direction">
                                {sort.dir === 'asc' ? '↑' : '↓'}
                            </button>
                        </div>
                    </>
                )}
                <div style={{ position: 'relative' }}>
                    <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                    <input className="ch-search" style={{ paddingLeft: 30 }} placeholder="Search accounts…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
            </div>

            {showFilters && segment !== 'Partner' && segment !== 'Performance' && (
                <div className="glass-card ch-filter-panel">
                    <div className="ch-filter-grid">
                        <div className="ch-field">
                            <label>Stage</label>
                            <select value={filters.stage} onChange={(e) => setF('stage', e.target.value)}>
                                <option value="All">All</option>
                                {STAGES.map((s) => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="ch-field">
                            <label>Owner</label>
                            <select value={filters.owner} onChange={(e) => setF('owner', e.target.value)}>
                                <option value="All">All</option>
                                {filterOptions.owners.map((o) => <option key={o}>{o}</option>)}
                            </select>
                        </div>
                        <div className="ch-field">
                            <label>Health</label>
                            <select value={filters.health} onChange={(e) => setF('health', e.target.value)}>
                                <option value="All">All</option>
                                {HEALTHS.map((h) => <option key={h}>{h}</option>)}
                            </select>
                        </div>
                        <div className="ch-field">
                            <label>Sourcing partner</label>
                            <select value={filters.partner} onChange={(e) => setF('partner', e.target.value)}>
                                <option value="All">All</option>
                                {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div className="ch-field">
                            <label>Industry</label>
                            <select value={filters.industry} onChange={(e) => setF('industry', e.target.value)}>
                                <option value="All">All</option>
                                {filterOptions.industries.map((o) => <option key={o}>{o}</option>)}
                            </select>
                        </div>
                        <div className="ch-field">
                            <label>Global region</label>
                            <select value={filters.region} onChange={(e) => setF('region', e.target.value)}>
                                <option value="All">All</option>
                                {REGIONS.map((r) => <option key={r}>{r}</option>)}
                            </select>
                        </div>
                        <div className="ch-field">
                            <label>Tier</label>
                            <select value={filters.tier} onChange={(e) => setF('tier', e.target.value)}>
                                <option value="All">All</option>
                                {filterOptions.tiers.map((o) => <option key={o}>{o}</option>)}
                            </select>
                        </div>
                        <div className="ch-field">
                            <label>Value min ({display})</label>
                            <input type="number" value={filters.valueMin} onChange={(e) => setF('valueMin', e.target.value)} placeholder="0" />
                        </div>
                        <div className="ch-field">
                            <label>Value max ({display})</label>
                            <input type="number" value={filters.valueMax} onChange={(e) => setF('valueMax', e.target.value)} placeholder="Any" />
                        </div>
                        <div className="ch-field">
                            <label>Win prob. min %</label>
                            <input type="number" min="0" max="100" value={filters.probMin} onChange={(e) => setF('probMin', e.target.value)} placeholder="0" />
                        </div>
                        <div className="ch-field">
                            <label>Win prob. max %</label>
                            <input type="number" min="0" max="100" value={filters.probMax} onChange={(e) => setF('probMax', e.target.value)} placeholder="100" />
                        </div>
                        <div className="ch-field">
                            <label>MEDDICC min: {filters.meddiccMin}/7</label>
                            <input type="range" min="0" max="7" value={filters.meddiccMin} onChange={(e) => setF('meddiccMin', Number(e.target.value))} />
                        </div>
                        <div className="ch-field ch-check">
                            <label>
                                <input type="checkbox" checked={filters.overdueOnly} onChange={(e) => setF('overdueOnly', e.target.checked)} />
                                Overdue next step only
                            </label>
                        </div>
                    </div>
                    <div className="ch-filter-actions">
                        <span className="ch-muted">Showing {visible.length} of {totalInSegment} accounts</span>
                        <button className="btn btn-ghost" onClick={clearFilters}><RotateCcw size={15} /> Clear all</button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="ch-empty">Loading accounts…</div>
            ) : segment === 'Performance' ? (
                <PerformanceView display={display} formatCur={formatCur} />
            ) : segment === 'Partner' ? (
                <>
                    <div className="ch-partner-grid">
                        {partnerScorecard.map((p) => (
                            <div className="glass-card ch-partner-card" key={p.id}>
                                <button className="ch-partner-open" onClick={() => setPartnerDetail(p)}
                                    title="See the accounts this partner has sourced">
                                    <div className="ch-partner-name">{p.name}</div>
                                    <div className="ch-partner-mgr">
                                        <Handshake size={13} /> {p.partner_manager || 'No account manager'}
                                    </div>
                                    <div className="ch-partner-owner">{p.industry || '—'} · {p.region || '—'}</div>
                                    <div className="ch-partner-stats">
                                        <div>
                                            <div className="ch-partner-stat-label">Sourced</div>
                                            <div className="ch-partner-stat-value">{p.sourcedCount}</div>
                                        </div>
                                        <div>
                                            <div className="ch-partner-stat-label">Win rate</div>
                                            <div className="ch-partner-stat-value">{p.winRate}%</div>
                                        </div>
                                        <div>
                                            <div className="ch-partner-stat-label">Closed value</div>
                                            <div className="ch-partner-stat-value">{formatCur(p.closedValue, display)}</div>
                                        </div>
                                        <div>
                                            <div className="ch-partner-stat-label">Weighted pipe</div>
                                            <div className="ch-partner-stat-value">{formatCur(p.pipelineValue, display)}</div>
                                        </div>
                                    </div>
                                </button>
                                <div className="ch-partner-foot">
                                    <span className="ch-muted">{p.sourcedCount ? 'Tap for sourced accounts' : 'No accounts sourced yet'}</span>
                                    <span className="ch-partner-acts">
                                        <button className="ch-iconbtn" onClick={() => openEdit(p)}><Pencil size={16} /></button>
                                        <button className="ch-iconbtn ch-iconbtn--danger" onClick={() => del(p)}><Trash2 size={16} /></button>
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {partners.length === 0 && <div className="ch-empty">No partners yet. Add one with the button above, or load the sample data.</div>}
                </>
            ) : pipeView === 'board' ? (
                <PipelineBoard accounts={visible} onMove={moveStage} onOpen={setDetail} display={display} formatCur={formatCur} />
            ) : (
                <div className="glass-card" style={{ padding: 0 }}>
                    <div className="ch-table-wrap">
                        <table className="ch-table">
                            <thead>
                                <tr>
                                    <th>Account</th>
                                    <th>Segment</th>
                                    <th>Region</th>
                                    <th>Source</th>
                                    <th>Stage</th>
                                    <th>Value</th>
                                    <th>Prob.</th>
                                    <th>MEDDICC</th>
                                    <th>Owner</th>
                                    <th>Next step</th>
                                    <th>Health</th>
                                    {defs.map((d) => <th key={d.key}>{d.label}</th>)}
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagedVisible.map((a) => (
                                    <tr key={a.id} className="ch-row" onClick={() => setDetail(a)}>
                                        <td>
                                            <div className="ch-acct-name">{a.name}</div>
                                            <div className="ch-acct-industry">{a.industry}</div>
                                        </td>
                                        <td><span className={`ch-badge ch-badge--${a.segment.toLowerCase()}`}>{a.segment}</span></td>
                                        <td>{a.region ? <span className="ch-badge ch-badge--stage">{a.region}</span> : <span className="ch-muted">—</span>}</td>
                                        <td>
                                            {a.source === 'Partner'
                                                ? <span className="ch-badge ch-badge--partnersrc" title={partnerName(a.sourcing_partner_id)}>via {partnerName(a.sourcing_partner_id) || 'Partner'}</span>
                                                : <span className="ch-badge ch-badge--direct">Direct</span>}
                                        </td>
                                        <td><span className="ch-badge ch-badge--stage">{a.stage}</span></td>
                                        <td className="ch-value">{formatCur(toDisplay(a.value_amount, a.value_currency, display, fx), display)}</td>
                                        <td>{a.segment === 'Prospect' ? `${a.probability}%` : <span className="ch-muted">—</span>}</td>
                                        <td>
                                            <span className={`ch-meddicc ch-meddicc--${meddiccTier(a.meddicc_score)}`}>
                                                <span className="ch-meddicc-dot" />{a.meddicc_score}/7
                                            </span>
                                        </td>
                                        <td>{a.sales_owner || <span className="ch-muted">—</span>}</td>
                                        <td className="ch-next">
                                            {a.next_step ? (
                                                <>
                                                    <div>{a.next_step}</div>
                                                    <div className={`ch-next-date ${isOverdue(a.next_step_date) ? 'ch-overdue' : ''}`}>
                                                        {a.next_step_date ? (isOverdue(a.next_step_date) ? 'Overdue · ' : '') + a.next_step_date : '—'}
                                                    </div>
                                                </>
                                            ) : <span className="ch-muted">—</span>}
                                        </td>
                                        <td><span className={`ch-badge ch-badge--${(a.health || 'good').toLowerCase()}`}>{a.health}</span></td>
                                        {defs.map((d) => (
                                            <td key={d.key} className="ch-muted">{a.custom_fields?.[d.key] ?? '—'}</td>
                                        ))}
                                        <td onClick={(e) => e.stopPropagation()}>
                                            <div className="ch-rowactions">
                                                <button className="ch-iconbtn" onClick={() => openEdit(a)} title="Edit"><Pencil size={15} /></button>
                                                <button className="ch-iconbtn ch-iconbtn--danger" onClick={() => del(a)} title="Delete"><Trash2 size={15} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {visible.length === 0 && <div className="ch-empty">No accounts match. Add one, or load the sample data.</div>}
                    <Pagination {...pg} />
                </div>
            )}

            <Modal isOpen={formOpen} onClose={() => setFormOpen(false)}
                title={editing?.id ? (editing.segment === 'Partner' ? 'Edit partner' : 'Edit account') : (editing?.segment === 'Partner' ? 'Add partner' : 'Add account')} maxWidth="760px">
                {editing && (
                    <AccountForm
                        initial={editing}
                        partners={partners}
                        defs={defs}
                        products={meta?.products}
                        onSave={save}
                        onCancel={() => setFormOpen(false)}
                        saving={saving}
                    />
                )}
            </Modal>

            {/* A partner's book: who they've brought in, won vs still in play. */}
            <Modal isOpen={!!partnerDetail} onClose={() => setPartnerDetail(null)} title={partnerDetail?.name || ''} maxWidth="640px">
                {partnerDetail && (
                    <PartnerDetail partner={partnerDetail} formatCur={formatCur} display={display}
                        onOpenAccount={(id) => { const a = accounts.find((x) => x.id === id); if (a) { setPartnerDetail(null); setDetail(a); } }} />
                )}
            </Modal>

            <Modal isOpen={colModal} onClose={() => setColModal(false)} title="Add custom column" maxWidth="440px">
                <ColumnForm defs={defs} onSave={addColumn} onRemove={removeColumn} onCancel={() => setColModal(false)} />
            </Modal>

            <BulkUploadModal
                isOpen={bulkOpen}
                onClose={() => setBulkOpen(false)}
                module="accounts"
                title="Cash Horizon"
                onImported={load}
                onLoadSample={isAdmin ? loadSampleData : undefined}
            />

            <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={detail?.name || ''} maxWidth="640px">
                {detail && (
                    <div>
                        <div className="ch-detail-row"><span className="ch-detail-label">Segment</span><span>{detail.segment} · {detail.stage}</span></div>
                        <div className="ch-detail-row"><span className="ch-detail-label">Source</span><span>{detail.source === 'Partner' ? `Via ${partnerName(detail.sourcing_partner_id) || 'partner'}` : 'Direct'}</span></div>
                        <div className="ch-detail-row"><span className="ch-detail-label">Value</span><span className="ch-value">{formatCur(toDisplay(detail.value_amount, detail.value_currency, display, fx), display)}{detail.segment === 'Prospect' ? ` · ${detail.probability}% win` : ''}</span></div>
                        <div className="ch-detail-row"><span className="ch-detail-label">Owner</span><span>{detail.sales_owner || '—'}</span></div>
                        <div className="ch-detail-row"><span className="ch-detail-label">Next step</span><span className={isOverdue(detail.next_step_date) ? 'ch-overdue' : ''}>{detail.next_step || '—'}{detail.next_step_date ? ` (${detail.next_step_date})` : ''}</span></div>
                        <div className="ch-detail-row"><span className="ch-detail-label">MEDDICC</span><span className={`ch-meddicc ch-meddicc--${meddiccTier(detail.meddicc_score)}`}><span className="ch-meddicc-dot" />{detail.meddicc_score}/7 qualified</span></div>
                        <AccountProducts account={detail.name} />
                        <AccountTraining account={detail.name} />

                        <div className="ch-meddicc-detail">
                            {PILLARS.map((p) => (
                                <div className="ch-meddicc-item" key={p}>
                                    <div className="ch-meddicc-item-label">{MEDDICC_LABELS[p]}</div>
                                    <div className={detail.meddicc[p] ? '' : 'ch-meddicc-item-empty'}>{detail.meddicc[p] || 'Not captured'}</div>
                                </div>
                            ))}
                        </div>

                        <div className="ch-form-actions" style={{ marginTop: '1.25rem' }}>
                            <button className="btn btn-ghost" onClick={() => del(detail)}><Trash2 size={16} /> Delete</button>
                            <button className="btn btn-primary" onClick={() => openEdit(detail)}><Pencil size={16} /> Edit</button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
