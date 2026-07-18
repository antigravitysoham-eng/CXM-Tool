import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Plus, Pencil, Trash2, Search, SlidersHorizontal, ArrowDownUp, RotateCcw,
    FileText, Wallet, AlertTriangle, RefreshCw, Repeat, ChevronDown, UserPlus, Upload,
    Sparkles, Bell, ExternalLink, FolderOpen
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { contractsApi } from '../api/contracts';
import { scopeApi } from '../api/invoices';
import { fireEvent } from '../api/agents';
import Modal from '../components/Modal';
import ModuleReportMenu from '../components/ModuleReportMenu';
import BulkUploadModal from '../components/BulkUploadModal';
import StatCard from '../components/StatCard';
import DocumentLibrary from '../components/DocumentLibrary';
import ProductScope from '../components/ProductScope';
import InvoiceTracker from '../components/InvoiceTracker';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
import { ProceedToOnboard } from './Onboarding';
import Documents from './Documents';
import './CashHorizon.css';
import './CLM.css';

// Contracts and Documents are two screens of the same module — toggled here
// rather than living as separate items in the sidebar.
function CLMViewToggle({ view, setView }) {
    return (
        <div className="clm-viewtoggle">
            <button className={view === 'contracts' ? 'on' : ''} onClick={() => setView('contracts')}><FileText size={15} /> Contracts</button>
            <button className={view === 'documents' ? 'on' : ''} onClick={() => setView('documents')}><FolderOpen size={15} /> Documents</button>
        </div>
    );
}

const FX = 83; // USD -> INR (matches server default)

function fmtMoney(amount, currency) {
    const n = Math.round(Number(amount) || 0);
    if (currency === 'INR') {
        if (n >= 10000000) return `₹${(n / 10000000).toFixed(2).replace(/\.00$/, '')}Cr`;
        if (n >= 100000) return `₹${(n / 100000).toFixed(2).replace(/\.00$/, '')}L`;
        return `₹${n.toLocaleString('en-IN')}`;
    }
    if (n >= 1000000) return `$${(n / 1000000).toFixed(2).replace(/\.00$/, '')}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    return `$${n}`;
}
// stored INR base -> display currency
const displayVal = (inr, display) => fmtMoney(display === 'INR' ? inr : inr / FX, display);

const blankContract = (account = '') => ({
    account, type: 'New Business', status: 'Active', deployment: 'SaaS', license_type: 'Subscription',
    perpetual_term_years: '', billing_frequency: 'Yearly', support_tier: 'Standard', payment_terms: 'Net 30',
    start_date: '', end_date: '', renewal_date: '', term_months: 12, auto_renew: false, notice_period_days: 30,
    currency: 'INR', tcv: '', arr: '', mrr: '',
    spoc_name: '', spoc_email: '', spoc_role: '', csm_name: '', csm_email: '', am_name: '', am_email: '',
    owner: '', notes: ''
});

function ContractForm({ initial, meta, customers, onSave, onCancel, saving }) {
    const [f, setF] = useState(initial);
    const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
    const lockAccount = !!initial.id || !!initial.account;

    // Which product modules the customer opted for, captured right here on the
    // contract. product_key -> { unit_count, items, info }. On edit, preload the
    // contract's existing scope so it shows what they already have.
    const [scope, setScope] = useState({});
    useEffect(() => {
        // New contract → scope stays empty (its initial value). Existing contract
        // → load its current scope so the form shows what they already opted for.
        if (!initial.id) return undefined;
        let alive = true;
        scopeApi.forContract(initial.id).then((rows) => {
            if (!alive) return;
            const next = {};
            for (const r of rows) next[r.product_key] = { unit_count: r.unit_count, items: r.items, info: r.info };
            setScope(next);
        }).catch(() => {});
        return () => { alive = false; };
    }, [initial.id]);

    const pickAccount = (name) => {
        const c = customers.find((x) => x.name === name);
        setF((p) => ({ ...p, account: name, currency: c?.value_currency || p.currency, csm_name: c?.cxm || p.csm_name, owner: c?.sales_owner || p.owner, tcv: p.tcv || (c?.account_value ?? '') }));
    };

    const submit = (e) => {
        e.preventDefault();
        const _scope = Object.entries(scope).map(([product_key, v]) => ({
            product_key, unit_count: Number(v.unit_count) || 0, items: v.items || [], info: v.info || ''
        }));
        onSave({
            ...f,
            perpetual_term_years: f.license_type === 'Perpetual' && f.perpetual_term_years !== '' ? Number(f.perpetual_term_years) : null,
            term_months: Number(f.term_months) || 0,
            notice_period_days: Number(f.notice_period_days) || 0,
            tcv: Math.max(0, Math.round(Number(f.tcv) || 0)),
            arr: Math.max(0, Math.round(Number(f.arr) || 0)),
            mrr: Math.max(0, Math.round(Number(f.mrr) || 0)),
            auto_renew: !!f.auto_renew,
            _scope
        });
    };

    return (
        <form className="ch-form" onSubmit={submit}>
            <div className="ch-form-grid">
                <div className="ch-field">
                    <label>Account *</label>
                    {lockAccount ? <input value={f.account} disabled /> : (
                        <select value={f.account} onChange={(e) => pickAccount(e.target.value)} required>
                            <option value="">— select customer —</option>
                            {customers.map((c) => <option key={c.name}>{c.name}</option>)}
                        </select>
                    )}
                </div>
                <div className="ch-field"><label>Contract # (blank = auto)</label><input value={f.id || ''} onChange={(e) => set('id', e.target.value)} placeholder="CTR-2026-010" disabled={!!initial.id} /></div>
            </div>
            <div className="ch-form-grid">
                <div className="ch-field"><label>Type</label><select value={f.type} onChange={(e) => set('type', e.target.value)}>{meta.types.map((t) => <option key={t}>{t}</option>)}</select></div>
                <div className="ch-field"><label>Status</label><select value={f.status} onChange={(e) => set('status', e.target.value)}>{meta.statuses.map((t) => <option key={t}>{t}</option>)}</select></div>
            </div>
            <div className="ch-form-grid">
                <div className="ch-field"><label>Deployment</label><select value={f.deployment} onChange={(e) => set('deployment', e.target.value)}>{meta.deployments.map((t) => <option key={t}>{t}</option>)}</select></div>
                <div className="ch-field"><label>License</label><select value={f.license_type} onChange={(e) => set('license_type', e.target.value)}>{meta.licenseTypes.map((t) => <option key={t}>{t}</option>)}</select></div>
            </div>
            {f.license_type === 'Perpetual' && (
                <div className="ch-field"><label>Perpetual term (years)</label><input type="number" min="0" value={f.perpetual_term_years} onChange={(e) => set('perpetual_term_years', e.target.value)} placeholder="5" /></div>
            )}
            <div className="ch-form-grid">
                <div className="ch-field"><label>Billing</label><select value={f.billing_frequency} onChange={(e) => set('billing_frequency', e.target.value)}>{meta.billingFrequencies.map((t) => <option key={t}>{t}</option>)}</select></div>
                <div className="ch-field"><label>Support tier</label><select value={f.support_tier} onChange={(e) => set('support_tier', e.target.value)}>{(meta.supportTiers || ['Standard', 'Premium', 'Enterprise']).map((t) => <option key={t}>{t}</option>)}</select></div>
            </div>
            <div className="ch-field"><label>Payment terms</label><input value={f.payment_terms} onChange={(e) => set('payment_terms', e.target.value)} placeholder="Net 30" /></div>
            <div className="ch-form-grid">
                <div className="ch-field"><label>Start date</label><input type="date" value={f.start_date} onChange={(e) => set('start_date', e.target.value)} /></div>
                <div className="ch-field"><label>Renewal date</label><input type="date" value={f.renewal_date} onChange={(e) => set('renewal_date', e.target.value)} /></div>
            </div>
            <div className="ch-form-grid">
                <div className="ch-field"><label>Term (months)</label><input type="number" min="0" value={f.term_months} onChange={(e) => set('term_months', e.target.value)} /></div>
                <div className="ch-field"><label>Notice period (days)</label><input type="number" min="0" value={f.notice_period_days} onChange={(e) => set('notice_period_days', e.target.value)} /></div>
            </div>
            <div className="ch-form-grid">
                <div className="ch-field"><label>Value (TCV)</label>
                    <div className="ch-value-row">
                        <input type="number" min="0" value={f.tcv} onChange={(e) => set('tcv', e.target.value)} placeholder="0" />
                        <select value={f.currency} onChange={(e) => set('currency', e.target.value)}>{meta.currencies.map((c) => <option key={c}>{c}</option>)}</select>
                    </div>
                </div>
                <div className="ch-check" style={{ alignItems: 'center' }}>
                    <label><input type="checkbox" checked={f.auto_renew} onChange={(e) => set('auto_renew', e.target.checked)} /> Auto-renew</label>
                </div>
            </div>
            <div className="ch-section-title">Customer SPOC</div>
            <div className="ch-form-grid">
                <div className="ch-field"><label>Name</label><input value={f.spoc_name} onChange={(e) => set('spoc_name', e.target.value)} /></div>
                <div className="ch-field"><label>Email</label><input value={f.spoc_email} onChange={(e) => set('spoc_email', e.target.value)} placeholder="name@company.com" /></div>
            </div>
            <div className="ch-field"><label>SPOC role</label><input value={f.spoc_role} onChange={(e) => set('spoc_role', e.target.value)} placeholder="CFO" /></div>
            <div className="ch-section-title">Internal owners</div>
            <div className="ch-form-grid">
                <div className="ch-field"><label>CSM</label><input value={f.csm_name} onChange={(e) => set('csm_name', e.target.value)} /></div>
                <div className="ch-field"><label>CSM email</label><input value={f.csm_email} onChange={(e) => set('csm_email', e.target.value)} /></div>
            </div>
            <div className="ch-form-grid">
                <div className="ch-field"><label>Account Manager</label><input value={f.am_name} onChange={(e) => set('am_name', e.target.value)} /></div>
                <div className="ch-field"><label>AM email</label><input value={f.am_email} onChange={(e) => set('am_email', e.target.value)} /></div>
            </div>
            <div className="ch-field"><label>Notes</label><textarea rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></div>

            <div className="ch-section-title">Products &amp; modules</div>
            <p className="ch-muted" style={{ fontSize: '0.76rem', marginTop: '-0.4rem', marginBottom: '0.6rem' }}>
                Pick the modules this customer opted for and scope each one — this is saved with the contract and becomes their onboarding checklist.
            </p>
            <ProductScope products={meta.products || []} value={scope} onChange={setScope} embedded />

            <div className="ch-form-actions">
                <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save contract'}</button>
            </div>
        </form>
    );
}

function StakeholderList({ account, contacts, onChanged }) {
    const [adding, setAdding] = useState(false);
    const [c, setC] = useState({ name: '', designation: '', email: '' });
    const add = async () => {
        if (!c.name.trim()) return;
        await contractsApi.addContact({ ...c, account });
        setC({ name: '', designation: '', email: '' }); setAdding(false); onChanged();
    };
    const remove = async (id) => { await contractsApi.removeContact(id); onChanged(); };
    return (
        <div className="clm-stakeholders">
            <div className="ch-section-title" style={{ border: 'none', padding: 0, margin: '0 0 0.6rem' }}>Stakeholders (SPOCs)</div>
            {contacts.length === 0 && <div className="ch-muted" style={{ fontSize: '0.82rem', marginBottom: '0.5rem' }}>No stakeholders yet — add the customer's SPOCs and their designations.</div>}
            {contacts.map((ct) => (
                <div className="clm-spoc-row" key={ct.id}>
                    <div className="clm-spoc-avatar">{(ct.name || '?').charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1 }}>
                        <div className="clm-spoc-name">{ct.name} {ct.is_primary ? <span className="clm-pill">primary</span> : null}</div>
                        <div className="clm-spoc-desig">{ct.designation || '—'}{ct.email ? ` · ${ct.email}` : ''}</div>
                    </div>
                    <button className="ch-iconbtn ch-iconbtn--danger" onClick={() => remove(ct.id)}><Trash2 size={14} /></button>
                </div>
            ))}
            {adding ? (
                <div className="clm-spoc-add">
                    <input className="ch-search" placeholder="Name" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
                    <input className="ch-search" placeholder="Designation" value={c.designation} onChange={(e) => setC({ ...c, designation: e.target.value })} />
                    <input className="ch-search" placeholder="Email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} />
                    <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.8rem' }} onClick={add}>Add</button>
                </div>
            ) : (
                <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: '0.78rem', marginTop: 8 }} onClick={() => setAdding(true)}><UserPlus size={14} /> Add SPOC</button>
            )}
        </div>
    );
}

export default function CLM({ defaultView = 'contracts' }) {
    const { user } = useAuth();
    const [view, setView] = useState(defaultView);
    const [customers, setCustomers] = useState([]);
    const [contractsRaw, setContractsRaw] = useState([]);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [display, setDisplay] = useState('INR');
    const [tab, setTab] = useState('all');
    const emptyFilters = { industry: 'All', health: 'All', csm: 'All', valueMin: '', valueMax: '', renewalFrom: '', renewalTo: '', hasContract: 'All' };
    const [filters, setFilters] = useState(emptyFilters);
    const [showFilters, setShowFilters] = useState(false);
    const [sort, setSort] = useState({ by: 'renewal', dir: 'asc' });
    const [search, setSearch] = useState('');
    const [detailAccount, setDetailAccount] = useState(null);
    const [detail, setDetail] = useState(null);
    const [assign, setAssign] = useState(null);
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [saving, setSaving] = useState(false);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [addMenu, setAddMenu] = useState(false);
    const [triggersOpen, setTriggersOpen] = useState(false);
    const [triggers, setTriggers] = useState([]);
    const addRef = useRef(null);

    const isAdmin = (meta?.role || user?.role) === 'admin';
    const setF = (k, v) => setFilters((p) => ({ ...p, [k]: v }));

    const load = async () => {
        try {
            setError('');
            const [c, m, cl] = await Promise.all([contractsApi.customers(), contractsApi.meta(), contractsApi.list()]);
            setCustomers(c); setMeta(m); setContractsRaw(cl);
        } catch (e) { setError(e.message || 'Failed to load'); } finally { setLoading(false); }
    };
    useEffect(() => {
        load();
        const onChange = (e) => { if (!e.detail || e.detail.module === 'contracts') load(); };
        window.addEventListener('module-data-changed', onChange);
        const onOutside = (e) => { if (addRef.current && !addRef.current.contains(e.target)) setAddMenu(false); };
        document.addEventListener('mousedown', onOutside);
        return () => { window.removeEventListener('module-data-changed', onChange); document.removeEventListener('mousedown', onOutside); };
    }, []);

    const openDetail = async (account) => {
        setDetailAccount(account); setDetail(null); setAssign(null);
        try { setDetail(await contractsApi.customer360(account)); } catch (e) { setError(e.message); }
    };
    const refreshDetail = async () => { if (detailAccount) setDetail(await contractsApi.customer360(detailAccount)); };

    const kpis = useMemo(() => {
        const val = customers.reduce((s, c) => s + c.totalValueInr, 0);
        const atRisk = customers.filter((c) => c.nextRenewalDays !== null && c.nextRenewalDays <= 90);
        return { val, atRiskVal: atRisk.reduce((s, c) => s + c.totalValueInr, 0), dueCount: atRisk.length, autoCount: customers.filter((c) => c.autoRenew).length };
    }, [customers]);

    const charts = useMemo(() => {
        const cs = contractsRaw;
        const windows = [
            { name: 'Overdue', match: (d) => d !== null && d < 0, color: '#f87171' },
            { name: '≤30d', match: (d) => d !== null && d >= 0 && d <= 30, color: '#f87171' },
            { name: '31–60d', match: (d) => d !== null && d > 30 && d <= 60, color: '#fbbf24' },
            { name: '61–90d', match: (d) => d !== null && d > 60 && d <= 90, color: '#38bdf8' }
        ].map((w) => ({ name: w.name, count: cs.filter((c) => w.match(c.days_to_renewal)).length, color: w.color }));
        const tierColors = { Standard: '#64748b', Premium: '#818cf8', Enterprise: '#22d3ee' };
        const tiers = ['Standard', 'Premium', 'Enterprise'].map((t) => ({ name: t, value: cs.filter((c) => c.support_tier === t).length, color: tierColors[t] })).filter((x) => x.value);
        const deployColors = { SaaS: '#34d399', 'On-premise': '#fbbf24' };
        const deploy = ['SaaS', 'On-premise'].map((d) => ({ name: d, value: cs.filter((c) => c.deployment === d).length, color: deployColors[d] })).filter((x) => x.value);
        return { windows, tiers, deploy };
    }, [contractsRaw]);

    const counts = useMemo(() => ({
        all: customers.length,
        critical: customers.filter((c) => c.renewalBucket === 'critical').length,
        warning: customers.filter((c) => c.renewalBucket === 'warning').length,
        watch: customers.filter((c) => c.renewalBucket === 'watch').length,
        overdue: customers.filter((c) => c.renewalBucket === 'overdue').length
    }), [customers]);

    const options = useMemo(() => ({
        industries: [...new Set(customers.map((c) => c.industry).filter(Boolean))].sort(),
        csms: [...new Set(customers.map((c) => c.cxm).filter(Boolean))].sort()
    }), [customers]);

    const activeCount = useMemo(() => {
        let n = 0;
        ['industry', 'health', 'csm', 'hasContract'].forEach((k) => { if (filters[k] !== 'All') n += 1; });
        ['valueMin', 'valueMax', 'renewalFrom', 'renewalTo'].forEach((k) => { if (filters[k] !== '') n += 1; });
        if (search.trim()) n += 1;
        return n;
    }, [filters, search]);

    const visible = useMemo(() => {
        let list = tab === 'all' ? customers : customers.filter((c) => c.renewalBucket === tab);
        const f = filters;
        if (f.industry !== 'All') list = list.filter((c) => c.industry === f.industry);
        if (f.health !== 'All') list = list.filter((c) => c.health === f.health);
        if (f.csm !== 'All') list = list.filter((c) => c.cxm === f.csm);
        if (f.hasContract !== 'All') list = list.filter((c) => (f.hasContract === 'Yes' ? c.hasContract : !c.hasContract));
        const dv = (c) => (display === 'INR' ? c.totalValueInr : c.totalValueInr / FX);
        if (f.valueMin !== '') list = list.filter((c) => dv(c) >= Number(f.valueMin));
        if (f.valueMax !== '') list = list.filter((c) => dv(c) <= Number(f.valueMax));
        if (f.renewalFrom) list = list.filter((c) => c.nextRenewalDate && c.nextRenewalDate >= f.renewalFrom);
        if (f.renewalTo) list = list.filter((c) => c.nextRenewalDate && c.nextRenewalDate <= f.renewalTo);
        if (search.trim()) list = list.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
        const dir = sort.dir === 'asc' ? 1 : -1;
        const val = (c) => sort.by === 'value' ? c.totalValueInr : sort.by === 'name' ? c.name.toLowerCase() : (c.nextRenewalDays ?? 99999);
        return [...list].sort((a, b) => { const x = val(a), y = val(b); return x < y ? -dir : x > y ? dir : 0; });
    }, [customers, tab, filters, search, sort, display]);

    const { pageItems: pagedVisible, ...pg } = usePagination(visible, 'clm');

    const openAdd = (account = '') => {
        const c = customers.find((x) => x.name === account);
        const base = blankContract(account);
        if (c) { base.currency = c.value_currency; base.csm_name = c.cxm; base.owner = c.sales_owner; base.tcv = c.account_value; }
        setEditing(base); setFormOpen(true);
    };
    const openEdit = (contract) => { setEditing({ ...contract }); setFormOpen(true); };

    const save = async (payload) => {
        setSaving(true);
        try {
            // The product scope rides along with the form; it's saved to its own
            // endpoint once we know the contract id (new or existing).
            const { _scope, ...contractData } = payload;
            let contractId = editing?.id;
            if (editing?.id && payload.id) await contractsApi.update(editing.id, contractData);
            else { const created = await contractsApi.create(contractData); contractId = created?.id; }
            if (_scope && contractId) {
                try { await scopeApi.setForContract(contractId, _scope); } catch (e) { setError(`Contract saved, but scope failed: ${e.message}`); }
            }
            setFormOpen(false); setEditing(null);
            await load(); await refreshDetail();
            fireEvent('account_updated', 'aura');
        } catch (e) { setError(e.message || 'Save failed'); } finally { setSaving(false); }
    };
    const delContract = async (id) => { if (!window.confirm('Delete this contract?')) return; await contractsApi.remove(id); await load(); await refreshDetail(); };
    const getAssign = async () => { try { setAssign(await contractsApi.assignmentAdvice({ account: detailAccount })); } catch (e) { setError(e.message); } };
    const applyAssign = async (name) => {
        for (const c of detail.contracts) await contractsApi.update(c.id, { csm_name: name });
        await load(); await refreshDetail(); setAssign(null);
    };
    const openTriggers = async () => { setTriggersOpen(true); try { setTriggers(await contractsApi.renewalTriggers()); } catch (e) { setError(e.message); } };
    const loadSample = async () => { await contractsApi.seedSample(); await load(); };

    const bucketClass = (b) => `clm-bucket--${b || 'none'}`;

    // Documents is the module's other screen — same shell, toggled at the top.
    if (view === 'documents') {
        return (
            <div className="animate-fade-in">
                <CLMViewToggle view={view} setView={setView} />
                <Documents />
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <CLMViewToggle view={view} setView={setView} />
            <header className="ch-head">
                <div>
                    <h1 className="ch-title">Contract Lifecycle</h1>
                    <p className="ch-sub">Active-customer contracts, renewals, and documents — flowing in from Cash Horizon.</p>
                </div>
                <div className="ch-actions">
                    <div className="ch-cur" role="group">
                        <button className={display === 'INR' ? 'active' : ''} onClick={() => setDisplay('INR')}>₹ INR</button>
                        <button className={display === 'USD' ? 'active' : ''} onClick={() => setDisplay('USD')}>$ USD</button>
                    </div>
                    <button className="btn btn-ghost" onClick={openTriggers}><Bell size={16} /> Renewal triggers</button>
                    {meta && <ModuleReportMenu module="contracts" title="CLM" />}
                    <div style={{ position: 'relative' }} ref={addRef}>
                        <button className="btn btn-primary" onClick={() => setAddMenu((o) => !o)}><Plus size={18} /> Add contract <ChevronDown size={15} /></button>
                        {addMenu && (
                            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 230, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 8, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 100 }}>
                                <button className="ch-menu-item" onClick={() => { setAddMenu(false); openAdd(); }}><UserPlus size={16} /> Add individual contract</button>
                                <button className="ch-menu-item" onClick={() => { setAddMenu(false); setBulkOpen(true); }}><Upload size={16} /> Bulk upload</button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {error && <div className="ch-error">{error}</div>}

            <div className="ch-kpis">
                <StatCard label="Value under management" icon={<Wallet size={19} />} accent="#22d3ee" variant="kpi"
                    countTo={kpis.val} format={(n) => displayVal(n, display)} hint={`${customers.length} customers`} />
                <StatCard label="Revenue at risk" icon={<AlertTriangle size={19} />} accent="#f87171" variant="kri"
                    countTo={kpis.atRiskVal} format={(n) => displayVal(n, display)} hint="renewing ≤ 90 days"
                    progress={kpis.val ? (kpis.atRiskVal / kpis.val) * 100 : 0} />
                <StatCard label="Renewals due" icon={<RefreshCw size={19} />} accent="#fbbf24" variant="kri"
                    countTo={kpis.dueCount} format={(n) => Math.round(n)} hint="within 90 days"
                    progress={customers.length ? (kpis.dueCount / customers.length) * 100 : 0} />
                <StatCard label="Auto-renew" icon={<Repeat size={19} />} accent="#818cf8" variant="kpi"
                    countTo={kpis.autoCount} format={(n) => Math.round(n)} hint="customers on auto-renew" />
            </div>

            <div className="clm-charts">
                <div className="glass-card clm-chart">
                    <div className="clm-chart-title">Renewals by window</div>
                    <ResponsiveContainer width="100%" height={165}>
                        <BarChart data={charts.windows} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip cursor={{ fill: 'var(--veil-1)' }} contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 }} />
                            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                                {charts.windows.map((w) => <Cell key={w.name} fill={w.color} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="glass-card clm-chart">
                    <div className="clm-chart-title">Support tier mix</div>
                    <ResponsiveContainer width="100%" height={135}>
                        <PieChart>
                            <Pie data={charts.tiers} dataKey="value" nameKey="name" innerRadius={38} outerRadius={60} paddingAngle={3} stroke="none">
                                {charts.tiers.map((t) => <Cell key={t.name} fill={t.color} />)}
                            </Pie>
                            <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 }} />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="clm-legend">{charts.tiers.map((t) => <span key={t.name}><i style={{ background: t.color }} />{t.name} · {t.value}</span>)}</div>
                </div>
                <div className="glass-card clm-chart">
                    <div className="clm-chart-title">Deployment</div>
                    <ResponsiveContainer width="100%" height={135}>
                        <PieChart>
                            <Pie data={charts.deploy} dataKey="value" nameKey="name" innerRadius={38} outerRadius={60} paddingAngle={3} stroke="none">
                                {charts.deploy.map((d) => <Cell key={d.name} fill={d.color} />)}
                            </Pie>
                            <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 }} />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="clm-legend">{charts.deploy.map((d) => <span key={d.name}><i style={{ background: d.color }} />{d.name} · {d.value}</span>)}</div>
                </div>
            </div>

            <div className="ch-toolbar">
                <div className="ch-tabs">
                    {[['all', 'All'], ['critical', '≤30d'], ['warning', '≤60d'], ['watch', '≤90d'], ['overdue', 'Overdue']].map(([k, label]) => (
                        <button key={k} className={`ch-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{label} <span className="ch-tab-count">{counts[k] ?? 0}</span></button>
                    ))}
                </div>
                <button className={`ch-tab ${showFilters || activeCount ? 'active' : ''}`} onClick={() => setShowFilters((v) => !v)}><SlidersHorizontal size={15} /> Filters{activeCount ? ` (${activeCount})` : ''}</button>
                <div className="ch-spacer" />
                <span className="ch-muted" style={{ fontSize: '0.8rem' }}>{visible.length} of {counts.all}</span>
                <div className="ch-sort">
                    <ArrowDownUp size={14} />
                    <select value={sort.by} onChange={(e) => setSort((s) => ({ ...s, by: e.target.value }))}>
                        <option value="renewal">Next renewal</option><option value="value">Value</option><option value="name">Name</option>
                    </select>
                    <button className="ch-iconbtn" onClick={() => setSort((s) => ({ ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' }))}>{sort.dir === 'asc' ? '↑' : '↓'}</button>
                </div>
                <div style={{ position: 'relative' }}>
                    <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                    <input className="ch-search" style={{ paddingLeft: 30 }} placeholder="Search customers…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
            </div>

            {showFilters && (
                <div className="glass-card ch-filter-panel">
                    <div className="ch-filter-grid">
                        <div className="ch-field"><label>Industry</label><select value={filters.industry} onChange={(e) => setF('industry', e.target.value)}><option value="All">All</option>{options.industries.map((o) => <option key={o}>{o}</option>)}</select></div>
                        <div className="ch-field"><label>Health</label><select value={filters.health} onChange={(e) => setF('health', e.target.value)}><option value="All">All</option>{['Good', 'Average', 'Poor', 'Critical'].map((h) => <option key={h}>{h}</option>)}</select></div>
                        <div className="ch-field"><label>CSM</label><select value={filters.csm} onChange={(e) => setF('csm', e.target.value)}><option value="All">All</option>{options.csms.map((o) => <option key={o}>{o}</option>)}</select></div>
                        <div className="ch-field"><label>Has contract</label><select value={filters.hasContract} onChange={(e) => setF('hasContract', e.target.value)}><option value="All">All</option><option>Yes</option><option>No</option></select></div>
                        <div className="ch-field"><label>Value min ({display})</label><input type="number" value={filters.valueMin} onChange={(e) => setF('valueMin', e.target.value)} placeholder="0" /></div>
                        <div className="ch-field"><label>Value max ({display})</label><input type="number" value={filters.valueMax} onChange={(e) => setF('valueMax', e.target.value)} placeholder="Any" /></div>
                        <div className="ch-field"><label>Renewal from</label><input type="date" value={filters.renewalFrom} onChange={(e) => setF('renewalFrom', e.target.value)} /></div>
                        <div className="ch-field"><label>Renewal to</label><input type="date" value={filters.renewalTo} onChange={(e) => setF('renewalTo', e.target.value)} /></div>
                    </div>
                    <div className="ch-filter-actions">
                        <span className="ch-muted">Showing {visible.length} of {counts.all} customers</span>
                        <button className="btn btn-ghost" onClick={() => { setFilters(emptyFilters); setSearch(''); }}><RotateCcw size={15} /> Clear all</button>
                    </div>
                </div>
            )}

            {loading ? <div className="ch-empty">Loading…</div> : (
                <div className="glass-card" style={{ padding: 0 }}>
                    <div className="ch-table-wrap">
                        <table className="ch-table">
                            <thead><tr><th>Customer</th><th>Industry</th><th>Contracts</th><th>Value</th><th>Next renewal</th><th>CSM</th><th>Health</th><th>Auto-renew</th></tr></thead>
                            <tbody>
                                {pagedVisible.map((c) => (
                                    <tr key={c.name} className="ch-row" onClick={() => openDetail(c.name)}>
                                        <td><div className="ch-acct-name">{c.name}</div><div className="ch-acct-industry">{c.tier}</div></td>
                                        <td>{c.industry}</td>
                                        <td>{c.hasContract ? c.contractCount : <span className="clm-pill">no contract</span>}</td>
                                        <td className="ch-value">{displayVal(c.totalValueInr, display)}</td>
                                        <td>{c.nextRenewalDate ? (
                                            <span className="clm-renewal"><span className={`clm-renewal-days ${bucketClass(c.renewalBucket)}`}>{c.nextRenewalDays < 0 ? `${Math.abs(c.nextRenewalDays)}d overdue` : `${c.nextRenewalDays}d`}</span><span className="clm-renewal-date">{c.nextRenewalDate}</span></span>
                                        ) : <span className="ch-muted">—</span>}</td>
                                        <td>{c.cxm || <span className="ch-muted">unassigned</span>}</td>
                                        <td><span className={`ch-badge ch-badge--${(c.health || 'good').toLowerCase()}`}>{c.health}</span></td>
                                        <td>{c.autoRenew ? <span className="clm-pill"><Repeat size={11} /> auto</span> : <span className="ch-muted">—</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {visible.length === 0 && <div className="ch-empty">No customers match{isAdmin ? ' — or load sample contracts from Bulk upload.' : '.'}</div>}
                    <Pagination {...pg} />
                </div>
            )}

            <Modal isOpen={!!detailAccount} onClose={() => setDetailAccount(null)} title={detailAccount || ''} maxWidth="760px">
                {!detail ? <div className="ch-empty">Loading…</div> : (
                    <div>
                        <div className="clm-360-metrics">
                            <div className="clm-360-metric"><div className="clm-360-metric-label">Contracts</div><div className="clm-360-metric-value">{detail.metrics.contractCount}</div></div>
                            <div className="clm-360-metric"><div className="clm-360-metric-label">Total value</div><div className="clm-360-metric-value">{displayVal(detail.metrics.totalTcvInr, display)}</div></div>
                            <div className="clm-360-metric"><div className="clm-360-metric-label">Next renewal</div><div className="clm-360-metric-value">{detail.metrics.nextRenewalDays !== null ? `${detail.metrics.nextRenewalDays}d` : '—'}</div></div>
                            <div className="clm-360-metric"><div className="clm-360-metric-label">Revenue at risk</div><div className="clm-360-metric-value">{displayVal(detail.metrics.revenueAtRiskInr, display)}</div></div>
                            <div className="clm-360-metric"><div className="clm-360-metric-label">Support tier</div><div className="clm-360-metric-value" style={{ fontSize: '1rem' }}><span className={`clm-tier clm-tier--${(detail.metrics.supportTier || 'standard').toLowerCase()}`}>{detail.metrics.supportTier || '—'}</span></div></div>
                            <div className="clm-360-metric"><div className="clm-360-metric-label">Documents</div><div className="clm-360-metric-value">{detail.metrics.documentCount}</div></div>
                            <div className="clm-360-metric"><div className="clm-360-metric-label">Stakeholders</div><div className="clm-360-metric-value">{detail.metrics.contactCount}</div></div>
                        </div>

                        <StakeholderList account={detailAccount} contacts={detail.contacts} onChanged={refreshDetail} />

                        <div className="clm-assign">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong style={{ fontSize: '0.9rem' }}><Sparkles size={14} style={{ display: 'inline', color: '#c084fc' }} /> CSM assignment advice</strong>
                                <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: '0.8rem' }} onClick={getAssign}>Get advice</button>
                            </div>
                            {assign && assign.recommended && (
                                <>
                                    <div className="clm-assign-rec">Recommended: <strong>{assign.recommended.name}</strong> — {assign.recommended.reasons.join(', ')}. <span className="ch-muted">You decide.</span></div>
                                    {assign.ranked.map((p) => (
                                        <div key={p.name} className="clm-assign-row">
                                            <div><span className="clm-assign-score">{p.score}</span> &nbsp;{p.name}<div className="clm-assign-reasons">{p.reasons.join(' · ')}</div></div>
                                            <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => applyAssign(p.name)}>Assign</button>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>

                        {/* Account-level library: everything filed against the customer,
                            including artefacts that belong to no single contract. */}
                        <div className="ch-section-title" style={{ border: 'none', padding: 0, margin: '0 0 0.75rem' }}>Document library</div>
                        <DocumentLibrary account={detailAccount} compact onChanged={refreshDetail} />

                        {/* Receivables are an account-level concern, so they sit above the
                            contract list rather than buried inside one contract. */}
                        <ProceedToOnboard
                            account={detailAccount}
                            contracts={detail.contracts}
                            csmName={detail.contracts[0]?.csm_name || ''}
                            onStarted={refreshDetail}
                        />

                        <div className="clm-invoices">
                            <InvoiceTracker account={detailAccount} contracts={detail.contracts} onChanged={refreshDetail} />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1.25rem 0 0.75rem' }}>
                            <div className="ch-section-title" style={{ border: 'none', padding: 0, margin: 0 }}>Contracts</div>
                            <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.8rem' }} onClick={() => openAdd(detailAccount)}><Plus size={15} /> Add contract</button>
                        </div>

                        {detail.contracts.length === 0 && <div className="ch-empty" style={{ padding: '1.5rem' }}>No contracts yet — this customer flowed in from Cash Horizon. Add their first contract.</div>}
                        {detail.contracts.map((c) => (
                            <div className="clm-contract-card" key={c.id}>
                                <div className="clm-contract-head">
                                    <div>
                                        <div className="clm-contract-id">{c.id} <span className="ch-badge ch-badge--stage">{c.type}</span> <span className="ch-badge ch-badge--stage">{c.status}</span></div>
                                        <div className="clm-contract-sub">{c.deployment} · {c.license_type}{c.perpetual_term_years ? ` (${c.perpetual_term_years}-yr)` : ''} · {c.billing_frequency} · <span className={`clm-tier clm-tier--${(c.support_tier || 'standard').toLowerCase()}`}>{c.support_tier}</span> support</div>
                                    </div>
                                    <div className="ch-rowactions">
                                        <button className="ch-iconbtn" onClick={() => openEdit(c)}><Pencil size={15} /></button>
                                        <button className="ch-iconbtn ch-iconbtn--danger" onClick={() => delContract(c.id)}><Trash2 size={15} /></button>
                                    </div>
                                </div>
                                <div className="clm-terms">
                                    <span className="ch-value">{fmtMoney(c.tcv, c.currency)}</span>
                                    {c.renewal_date && <span className={`clm-pill ${bucketClass(c.renewal_bucket)}`}>renews {c.renewal_date} ({c.days_to_renewal}d)</span>}
                                    {c.auto_renew && <span className="clm-pill"><Repeat size={11} /> auto-renew · notice by {c.notice_deadline}</span>}
                                </div>
                                <div className="clm-contacts">
                                    <span>SPOC: <strong>{c.spoc_name || '—'}</strong> {c.spoc_email && `(${c.spoc_email})`}</span>
                                    <span>CSM: <strong>{c.csm_name || '—'}</strong></span>
                                    <span>AM: <strong>{c.am_name || '—'}</strong></span>
                                </div>
                                <ProductScope contractId={c.id} products={meta?.products || []} onSaved={refreshDetail} />
                                <DocumentLibrary account={detailAccount} contractId={c.id} compact onChanged={refreshDetail} />
                            </div>
                        ))}
                    </div>
                )}
            </Modal>

            <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editing?.id ? `Edit ${editing.id}` : 'Add contract'} maxWidth="720px">
                {editing && meta && <ContractForm initial={editing} meta={meta} customers={customers} onSave={save} onCancel={() => setFormOpen(false)} saving={saving} />}
            </Modal>

            <Modal isOpen={triggersOpen} onClose={() => setTriggersOpen(false)} title="Renewal triggers — emails ready" maxWidth="700px">
                {triggers.length === 0 ? <div className="ch-empty">No renewals in the 90-day window.</div> : triggers.map((t) => (
                    <div className="clm-trigger" key={t.contract_id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <strong>{t.account}</strong>
                            <span className={`clm-pill ${bucketClass(t.bucket)}`}>{t.days_to_renewal}d · {t.milestone === 'overdue' ? 'overdue' : `${t.milestone}-day`}</span>
                        </div>
                        {t.emails && (
                            <>
                                <div className="clm-email">
                                    <span className="clm-email-tone clm-email-tone--warm">{t.emails.customer.tone}</span>
                                    <div className="clm-email-to">To: {t.emails.customer.to || '—'}</div>
                                    <div className="clm-email-subject">{t.emails.customer.subject}</div>
                                    <div className="clm-email-body">{t.emails.customer.body}</div>
                                </div>
                                <div className="clm-email">
                                    <span className="clm-email-tone clm-email-tone--direct">{t.emails.internal.tone}</span>
                                    <div className="clm-email-to">To: {t.emails.internal.to || '—'}</div>
                                    <div className="clm-email-subject">{t.emails.internal.subject}</div>
                                    <div className="clm-email-body">{t.emails.internal.body}</div>
                                </div>
                            </>
                        )}
                    </div>
                ))}
                <p className="ch-muted" style={{ fontSize: '0.78rem', marginTop: '0.5rem' }}>Generated &amp; logged. Live delivery activates once a mail provider is connected.</p>
            </Modal>

            <BulkUploadModal isOpen={bulkOpen} onClose={() => setBulkOpen(false)} module="contracts" title="CLM" onImported={load} onLoadSample={isAdmin ? loadSample : undefined} />
        </div>
    );
}
