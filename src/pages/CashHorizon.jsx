import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
    Plus, Pencil, Trash2, Search, TrendingUp, Target,
    Wallet, Gauge, Columns3, SlidersHorizontal, ArrowDownUp, RotateCcw,
    UserPlus, Upload, ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { accountsApi } from '../api/accounts';
import { scopeApi } from '../api/invoices';
import { customFieldsApi } from '../api/dataExchange';
import { fireEvent } from '../api/agents';
import Modal from '../components/Modal';
import ModuleReportMenu from '../components/ModuleReportMenu';
import BulkUploadModal from '../components/BulkUploadModal';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
import './CashHorizon.css';

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
    sales_owner: '', health: 'Good', renewal: '', next_step: '', next_step_date: '',
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
        scopeApi.forAccount(account).then((r) => alive && setRows(Array.isArray(r) ? r : [])).catch(() => alive && setRows([]));
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

function AccountForm({ initial, partners, defs, onSave, onCancel, saving }) {
    const [f, setF] = useState(initial);
    const set = (k, v) => setF((prev) => ({ ...prev, [k]: v }));
    const setM = (k, v) => setF((prev) => ({ ...prev, meddicc: { ...prev.meddicc, [k]: v } }));
    const setCF = (k, v) => setF((prev) => ({ ...prev, custom_fields: { ...prev.custom_fields, [k]: v } }));

    const submit = (e) => {
        e.preventDefault();
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
            health: f.health,
            renewal: f.renewal,
            next_step: f.next_step,
            next_step_date: f.next_step_date,
            meddicc: f.meddicc,
            custom_fields: f.custom_fields || {}
        });
    };

    return (
        <form className="ch-form" onSubmit={submit}>
            <div className="ch-field">
                <label>Account name *</label>
                <input required value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Bajaj Finserv" />
            </div>

            <div className="ch-form-grid">
                <div className="ch-field">
                    <label>Segment</label>
                    <select value={f.segment} onChange={(e) => set('segment', e.target.value)}>
                        {SEGMENTS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                </div>
                <div className="ch-field">
                    <label>Source</label>
                    <select value={f.source} onChange={(e) => set('source', e.target.value)}>
                        <option>Direct</option>
                        <option>Partner</option>
                    </select>
                </div>
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
                <div className="ch-field">
                    <label>Stage</label>
                    <select value={f.stage} onChange={(e) => set('stage', e.target.value)}>
                        {STAGES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                </div>
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
                    <label>Sales owner</label>
                    <input value={f.sales_owner} onChange={(e) => set('sales_owner', e.target.value)} placeholder="Priya Sharma" />
                </div>
                <div className="ch-field">
                    <label>Health</label>
                    <select value={f.health} onChange={(e) => set('health', e.target.value)}>
                        {HEALTHS.map((h) => <option key={h}>{h}</option>)}
                    </select>
                </div>
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

            <div className="ch-section-title">MEDDICC qualification</div>
            <div className="ch-meddicc-grid">
                {PILLARS.map((p) => (
                    <div className="ch-field" key={p}>
                        <label>{MEDDICC_LABELS[p]}</label>
                        <textarea rows={2} value={f.meddicc[p]} onChange={(e) => setM(p, e.target.value)} />
                    </div>
                ))}
            </div>

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
        const dv = (a) => toDisplay(a.value_amount, a.value_currency, display, fx);
        const portfolio = custs.reduce((s, a) => s + dv(a), 0);
        const openPipe = pros.reduce((s, a) => s + dv(a), 0);
        const weighted = pros.reduce((s, a) => s + dv(a) * (a.probability / 100), 0);
        const avgMed = pros.length ? pros.reduce((s, a) => s + a.meddicc_score, 0) / pros.length : 0;
        return { portfolio, openPipe, weighted, avgMed, custCount: custs.length, proCount: pros.length };
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
            winRate: sourced.length ? Math.round((won.length / sourced.length) * 100) : 0
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
            const isEdit = editing && editing.id;
            const result = isEdit ? await accountsApi.update(editing.id, payload) : await accountsApi.create(payload);
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
                    {canEditSchema && (
                        <button className="btn btn-ghost" onClick={() => setColModal(true)}><Columns3 size={17} /> Add column</button>
                    )}
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
                </div>
            </header>

            {error && <div className="ch-error">{error}</div>}

            <div className="ch-kpis">
                <div className="glass-card ch-kpi">
                    <div className="ch-kpi-label"><Wallet size={15} /> Customer portfolio</div>
                    <div className="ch-kpi-value">{formatCur(kpis.portfolio, display)}</div>
                    <div className="ch-kpi-hint">{kpis.custCount} active customers</div>
                </div>
                <div className="glass-card ch-kpi">
                    <div className="ch-kpi-label"><Target size={15} /> Open pipeline</div>
                    <div className="ch-kpi-value">{formatCur(kpis.openPipe, display)}</div>
                    <div className="ch-kpi-hint">{kpis.proCount} prospects</div>
                </div>
                <div className="glass-card ch-kpi">
                    <div className="ch-kpi-label"><TrendingUp size={15} /> Weighted forecast</div>
                    <div className="ch-kpi-value">{formatCur(kpis.weighted, display)}</div>
                    <div className="ch-kpi-hint">value × win probability</div>
                </div>
                <div className="glass-card ch-kpi">
                    <div className="ch-kpi-label"><Gauge size={15} /> Avg MEDDICC</div>
                    <div className="ch-kpi-value">{kpis.avgMed.toFixed(1)}<span className="ch-muted" style={{ fontSize: '1rem' }}> / 7</span></div>
                    <div className="ch-kpi-hint">deal qualification strength</div>
                </div>
            </div>

            <div className="ch-toolbar">
                <div className="ch-tabs">
                    {['All', 'Customer', 'Prospect', 'Partner'].map((s) => (
                        <button key={s} className={`ch-tab ${segment === s ? 'active' : ''}`} onClick={() => setSegment(s)}>
                            {s === 'All' ? 'All' : s + 's'} <span className="ch-tab-count">{counts[s]}</span>
                        </button>
                    ))}
                </div>
                {segment !== 'Partner' && (
                    <>
                        <select className="ch-filter" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                            <option value="All">All sources</option>
                            <option value="Direct">Direct</option>
                            <option value="Partner">Via partner</option>
                        </select>
                        <button className={`ch-tab ${showFilters || activeCount ? 'active' : ''}`} onClick={() => setShowFilters((v) => !v)}>
                            <SlidersHorizontal size={15} /> Filters{activeCount > 0 ? ` (${activeCount})` : ''}
                        </button>
                    </>
                )}
                <div className="ch-spacer" />
                {segment !== 'Partner' && (
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

            {showFilters && segment !== 'Partner' && (
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
            ) : segment === 'Partner' ? (
                <>
                    <div className="ch-partner-grid">
                        {partnerScorecard.map((p) => (
                            <div className="glass-card ch-partner-card" key={p.id}>
                                <div className="ch-partner-name">{p.name}</div>
                                <div className="ch-partner-owner">{p.sales_owner || 'Unassigned'} · {p.industry || '—'}</div>
                                <div className="ch-partner-stats">
                                    <div>
                                        <div className="ch-partner-stat-label">Accounts sourced</div>
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
                                        <div className="ch-partner-stat-label">Weighted pipeline</div>
                                        <div className="ch-partner-stat-value">{formatCur(p.pipelineValue, display)}</div>
                                    </div>
                                </div>
                                <div className="ch-form-actions" style={{ marginTop: '1rem' }}>
                                    <button className="ch-iconbtn" onClick={() => openEdit(p)}><Pencil size={16} /></button>
                                    <button className="ch-iconbtn ch-iconbtn--danger" onClick={() => del(p)}><Trash2 size={16} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {partners.length === 0 && <div className="ch-empty">No partners yet. Add one, or load the sample data.</div>}
                </>
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

            <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editing?.id ? 'Edit account' : 'Add account'} maxWidth="760px">
                {editing && (
                    <AccountForm
                        initial={editing}
                        partners={partners}
                        defs={defs}
                        onSave={save}
                        onCancel={() => setFormOpen(false)}
                        saving={saving}
                    />
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
