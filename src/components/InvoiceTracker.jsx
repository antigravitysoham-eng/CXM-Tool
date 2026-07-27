import React, { useState, useEffect, useCallback } from 'react';
import { Receipt, Plus, Trash2, AlertTriangle, X, Paperclip, Download } from 'lucide-react';
import { invoicesApi } from '../api/invoices';
import { readFileAsBase64 } from '../api/documents';
import './InvoiceTracker.css';

const fmt = (amount, currency) => {
    const n = Math.round(Number(amount) || 0);
    if (currency === 'USD') return `$${n.toLocaleString('en-US')}`;
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2).replace(/\.00$/, '')}Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(2).replace(/\.00$/, '')}L`;
    return `₹${n.toLocaleString('en-IN')}`;
};

const STATUS_CLASS = {
    Draft: 'draft', Raised: 'raised', Sent: 'sent',
    'Partially Paid': 'partial', Paid: 'paid', Overdue: 'overdue', Cancelled: 'cancelled'
};

const blank = (contractId) => ({
    contract_id: contractId || '', amount: '', currency: 'INR', status: 'Raised',
    issue_date: new Date().toISOString().slice(0, 10), due_date: '',
    period_from: '', period_to: '', notes: '', invoice_no: ''
});

/**
 * Invoice raising and chasing, per customer.
 *
 * Overdue is decided by the server from the due date rather than stored, so an
 * invoice that lapses overnight shows as overdue in the morning without anyone
 * touching it.
 */
export default function InvoiceTracker({ account, contracts = [], compact = false, onChanged }) {
    const [invoices, setInvoices] = useState([]);
    const [stats, setStats] = useState(null);
    const [meta, setMeta] = useState(null);
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState(blank());
    const [file, setFile] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try {
            const [list, s] = await Promise.all([
                invoicesApi.list({ account }),
                invoicesApi.stats({ account })
            ]);
            setInvoices(list);
            setStats(s);
            setError('');
        } catch (e) { setError(e.message); }
    }, [account]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { invoicesApi.meta().then(setMeta).catch(() => {}); }, []);

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            const payload = { ...form, amount: Math.max(0, Math.round(Number(form.amount) || 0)) };
            if (file) {
                payload.file_base64 = await readFileAsBase64(file);
                payload.file_name = file.name;
                payload.mime = file.type || 'application/octet-stream';
            }
            await invoicesApi.create(payload);
            setForm(blank(contracts[0]?.id));
            setFile(null);
            setAdding(false);
            await load();
            onChanged?.();
        } catch (e2) { setError(e2.message); } finally { setBusy(false); }
    };

    const setStatus = async (inv, status) => {
        try {
            await invoicesApi.update(inv.id, { status });
            await load();
            onChanged?.();
        } catch (e) { setError(e.message); }
    };

    const remove = async (inv) => {
        if (!window.confirm(`Delete invoice ${inv.invoice_no}?`)) return;
        try {
            await invoicesApi.remove(inv.id);
            await load();
            onChanged?.();
        } catch (e) { setError(e.message); }
    };

    return (
        <div className={`inv ${compact ? 'inv-compact' : ''}`}>
            <div className="inv-head">
                <span className="inv-title"><Receipt size={14} /> Invoices</span>
                {stats && stats.count > 0 && (
                    <span className="inv-rollup">
                        <span>{fmt(stats.outstanding, 'INR')} outstanding</span>
                        {stats.overdueCount > 0 && (
                            <span className="inv-overdue-flag">
                                <AlertTriangle size={11} /> {fmt(stats.overdue, 'INR')} overdue ({stats.overdueCount})
                            </span>
                        )}
                    </span>
                )}
                <button className="inv-add" onClick={() => { setForm(blank(contracts[0]?.id)); setAdding((o) => !o); }}>
                    {adding ? <><X size={13} /> Cancel</> : <><Plus size={13} /> Raise invoice</>}
                </button>
            </div>

            {error && <div className="inv-error">{error}</div>}

            {adding && (
                <form className="inv-form" onSubmit={submit}>
                    <div className="inv-form-grid">
                        <label><span>Contract</span>
                            <select required value={form.contract_id} onChange={(e) => setForm({ ...form, contract_id: e.target.value })}>
                                <option value="">— select —</option>
                                {contracts.map((c) => <option key={c.id} value={c.id}>{c.id}</option>)}
                            </select>
                        </label>
                        <label><span>Invoice # (blank = auto)</span>
                            <input value={form.invoice_no} onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} placeholder="INV-2026-001" />
                        </label>
                        <label><span>Amount</span>
                            <div className="inv-amount">
                                <input type="number" min="0" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" />
                                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                                    {(meta?.currencies || ['INR', 'USD']).map((c) => <option key={c}>{c}</option>)}
                                </select>
                            </div>
                        </label>
                        <label><span>Status</span>
                            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                {(meta?.statuses || []).filter((s) => s !== 'Overdue').map((s) => <option key={s}>{s}</option>)}
                            </select>
                        </label>
                        <label><span>Issue date</span>
                            <input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
                        </label>
                        <label><span>Due date</span>
                            <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                        </label>
                        <label><span>Billing period from</span>
                            <input type="date" value={form.period_from} onChange={(e) => setForm({ ...form, period_from: e.target.value })} />
                        </label>
                        <label><span>Billing period to</span>
                            <input type="date" value={form.period_to} onChange={(e) => setForm({ ...form, period_to: e.target.value })} />
                        </label>
                    </div>
                    <label className="inv-notes"><span>Notes</span>
                        <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Annual subscription, milestone 2…" />
                    </label>
                    <label className="inv-notes"><span><Paperclip size={12} style={{ verticalAlign: '-2px' }} /> Attach copy — if the invoice was raised elsewhere (PDF/image, optional)</span>
                        <input type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    </label>
                    <div className="inv-form-actions">
                        <button type="submit" className="inv-submit" disabled={busy}>{busy ? 'Saving…' : (file ? 'Attach & file invoice' : 'Raise invoice')}</button>
                    </div>
                </form>
            )}

            {invoices.length === 0 ? (
                <div className="inv-empty">No invoices raised yet.</div>
            ) : (
                <div className="inv-list">
                    {invoices.map((i) => (
                        <div className={`inv-row ${i.overdue ? 'is-overdue' : ''}`} key={i.id}>
                            <div className="inv-main">
                                <div className="inv-no">
                                    {i.invoice_no}
                                    <span className={`inv-status inv-status--${STATUS_CLASS[i.status] || 'draft'}`}>{i.status}</span>
                                    {i.overdue && <span className="inv-days">{i.days_overdue}d late</span>}
                                </div>
                                <div className="inv-sub">
                                    <span>{i.contract_id}</span>
                                    {i.due_date && <span>· due {i.due_date}</span>}
                                    {i.period_from && <span>· {i.period_from} → {i.period_to}</span>}
                                    {i.notes && <span>· {i.notes}</span>}
                                </div>
                            </div>
                            <div className="inv-amt">{fmt(i.amount, i.currency)}</div>
                            <div className="inv-actions">
                                {i.has_file && (
                                    <button className="inv-del" title={`Download ${i.file_name || 'attachment'}`} onClick={() => invoicesApi.downloadFile(i)}><Download size={14} /></button>
                                )}
                                <select
                                    className="inv-set"
                                    value={i.stored_status}
                                    onChange={(e) => setStatus(i, e.target.value)}
                                    title="Update status"
                                >
                                    {(meta?.statuses || []).filter((s) => s !== 'Overdue').map((s) => <option key={s}>{s}</option>)}
                                </select>
                                <button className="inv-del" title="Delete" onClick={() => remove(i)}><Trash2 size={14} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
