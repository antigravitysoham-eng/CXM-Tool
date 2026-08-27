import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    FileText, Upload, Link2, Download, Trash2, History, Search,
    FileSignature, Receipt, ShieldCheck, Wrench, MessageSquare, File
} from 'lucide-react';
import { documentsApi, readFileAsBase64, formatBytes } from '../api/documents';
import { fileType } from '../utils/fileType';
import { useAuth } from '../context/AuthContext';
import Modal from './Modal';
import DocumentViewer from './DocumentViewer';
import './DocumentLibrary.css';

const CATEGORY_ICON = {
    Contractual: FileSignature,
    Commercial: Receipt,
    Compliance: ShieldCheck,
    Delivery: Wrench,
    Engagement: MessageSquare,
    Other: File
};

const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/**
 * The account-level document library.
 *
 * Renders standalone (the DMS page, across every account) or embedded in a
 * customer view. `account` pins it to one account; `contractId` additionally
 * files new uploads against a contract.
 */
export default function DocumentLibrary({ account, contractId, accounts = [], compact = false, onChanged }) {
    const [docs, setDocs] = useState([]);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filters, setFilters] = useState({ account: account || 'All', category: 'All', doc_type: 'All', q: '' });
    const [uploading, setUploading] = useState(false);
    const [showUpload, setShowUpload] = useState(false);
    const [historyFor, setHistoryFor] = useState(null);
    const [chain, setChain] = useState([]);
    const [viewDoc, setViewDoc] = useState(null);
    const { user } = useAuth();
    // Mirrors the server rule: admins/managers can delete any document; anyone else
    // only what they uploaded. Hide the button when it isn't allowed.
    const canDelete = (d) => user?.role === 'admin' || user?.role === 'manager'
        || (!!d.uploaded_by && (d.uploaded_by === user?.name || d.uploaded_by === user?.email));

    const load = useCallback(async () => {
        try {
            const query = { ...filters, account: account || filters.account, contract_id: contractId };
            const list = await documentsApi.list(query);
            setDocs(list);
            setError('');
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [filters, account, contractId]);

    useEffect(() => { documentsApi.meta().then(setMeta).catch(() => {}); }, []);
    useEffect(() => { load(); }, [load]);

    const openHistory = async (doc) => {
        setHistoryFor(doc);
        setChain(await documentsApi.history(doc.id).catch(() => []));
    };

    const remove = async (doc) => {
        if (!window.confirm(`Delete "${doc.name}"? This removes the stored file.`)) return;
        try {
            await documentsApi.remove(doc.id);
            load();
            onChanged?.();
        } catch (e) { setError(e.message); }
    };

    const download = async (doc) => {
        try {
            if (!doc.has_file && doc.link) return window.open(doc.link, '_blank', 'noopener');
            await documentsApi.download(doc);
        } catch (e) { setError(e.message); }
    };

    const types = meta?.docTypes || [];
    const categories = Object.keys(meta?.categories || {});
    const visibleTypes = filters.category === 'All' ? types : (meta?.categories?.[filters.category] || []);
    // A contract holds a handful of documents — a full filter bar there is noise.
    const showFilters = !contractId;

    return (
        <div className={`dl ${compact ? 'dl-compact' : ''}`}>
            <div className="dl-bar">
                {showFilters && (
                    <>
                        <div className="dl-search">
                            <Search size={15} />
                            <input
                                placeholder="Search documents, descriptions, files…"
                                value={filters.q}
                                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                            />
                        </div>
                        {!account && (
                            <select className="ch-filter" value={filters.account} onChange={(e) => setFilters({ ...filters, account: e.target.value })}>
                                <option value="All">All accounts</option>
                                {accounts.map((a) => <option key={a}>{a}</option>)}
                            </select>
                        )}
                        <select
                            className="ch-filter"
                            value={filters.category}
                            onChange={(e) => setFilters({ ...filters, category: e.target.value, doc_type: 'All' })}
                        >
                            <option value="All">All categories</option>
                            {categories.map((c) => <option key={c}>{c}</option>)}
                        </select>
                        <select className="ch-filter" value={filters.doc_type} onChange={(e) => setFilters({ ...filters, doc_type: e.target.value })}>
                            <option value="All">All types</option>
                            {visibleTypes.map((t) => <option key={t}>{t}</option>)}
                        </select>
                    </>
                )}
                <button className={`dl-add ${contractId ? 'dl-add--sm' : ''}`} onClick={() => setShowUpload(true)}>
                    <Upload size={15} /> Add document
                </button>
            </div>

            {error && <div className="dl-error">{error}</div>}

            {loading ? (
                <div className="dl-empty">Loading library…</div>
            ) : docs.length === 0 ? (
                <div className="dl-empty">
                    <FileText size={28} />
                    <p>No documents yet</p>
                    <span>Upload a signed agreement, proposal, or any customer artefact.</span>
                </div>
            ) : (
                <div className="dl-list">
                    {docs.map((d) => {
                        const Icon = CATEGORY_ICON[d.category] || File;
                        const ft = fileType(d);
                        return (
                            <div className="dl-row dl-row--clickable" key={d.id} role="button" tabIndex={0}
                                onClick={() => setViewDoc(d)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setViewDoc(d); } }}>
                                <div className="dl-icon" style={{ background: `${ft.color}22`, color: ft.color }}>
                                    {d.has_file ? <span style={{ fontSize: 16 }} aria-hidden>{ft.icon}</span> : <Icon size={17} />}
                                </div>
                                <div className="dl-main">
                                    <div className="dl-name">
                                        {d.name}
                                        <span className="dl-version">{d.version}</span>
                                        {d.has_file
                                            ? <span className="dl-typechip" style={{ color: ft.color, borderColor: `${ft.color}66` }}>{ft.ext ? ft.ext.toUpperCase() : ft.label}</span>
                                            : <span className="dl-linkbadge"><Link2 size={11} /> link</span>}
                                    </div>
                                    <div className="dl-sub">
                                        <span className="dl-type">{d.doc_type}</span>
                                        {!account && <span>· {d.account}</span>}
                                        {d.contract_id && <span>· {d.contract_id}</span>}
                                        {d.description && <span>· {d.description}</span>}
                                    </div>
                                </div>
                                <div className="dl-meta">
                                    <span>{formatBytes(d.size)}</span>
                                    <span>{fmtDate(d.created_at)}</span>
                                    {d.uploaded_by && <span>{d.uploaded_by}</span>}
                                </div>
                                <div className="dl-actions" onClick={(e) => e.stopPropagation()}>
                                    <button title="Version history" onClick={() => openHistory(d)}><History size={15} /></button>
                                    <button title={d.has_file ? 'Download' : 'Open link'} onClick={() => download(d)}><Download size={15} /></button>
                                    {canDelete(d) && <button title="Delete" className="dl-danger" onClick={() => remove(d)}><Trash2 size={15} /></button>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showUpload && (
                <UploadDialog
                    meta={meta}
                    account={account}
                    accounts={accounts}
                    contractId={contractId}
                    busy={uploading}
                    setBusy={setUploading}
                    onClose={() => setShowUpload(false)}
                    onDone={() => { setShowUpload(false); load(); onChanged?.(); }}
                />
            )}

            <Modal isOpen={!!historyFor} onClose={() => setHistoryFor(null)} title={`Version history — ${historyFor?.name || ''}`} maxWidth="620px">
                <div className="dl-chain">
                    {chain.map((c, i) => (
                        <div className={`dl-chain-row ${i === 0 ? 'is-current' : ''}`} key={c.id}>
                            <span className="dl-version">{c.version}</span>
                            <span className="dl-chain-name">{c.file_name || c.name}</span>
                            <span>{formatBytes(c.size)}</span>
                            <span>{fmtDate(c.created_at)}</span>
                            <span>{c.uploaded_by}</span>
                            {i === 0 ? <span className="dl-current">current</span> : <span className="dl-superseded">superseded</span>}
                            <button title="Download" onClick={() => download(c)}><Download size={14} /></button>
                        </div>
                    ))}
                </div>
            </Modal>

            <Modal isOpen={!!viewDoc} onClose={() => setViewDoc(null)} title={viewDoc?.name || 'Document'} maxWidth="940px">
                {viewDoc && <DocumentViewer doc={viewDoc} />}
            </Modal>
        </div>
    );
}

function UploadDialog({ meta, account, accounts, contractId, busy, setBusy, onClose, onDone }) {
    const [form, setForm] = useState({
        account: account || accounts[0] || '', doc_type: 'Service Agreement',
        name: '', description: '', version: 'v1', link: ''
    });
    const [file, setFile] = useState(null);
    const [mode, setMode] = useState('file');
    const [err, setErr] = useState('');
    const [drag, setDrag] = useState(false);
    const inputRef = useRef(null);

    const pick = (f) => {
        if (!f) return;
        setFile(f);
        // Default the display name to the filename, but never clobber a typed one.
        setForm((s) => ({ ...s, name: s.name || f.name.replace(/\.[^.]+$/, '') }));
    };

    const submit = async (e) => {
        e.preventDefault();
        setErr('');
        setBusy(true);
        try {
            const payload = { ...form, contract_id: contractId || '' };
            if (mode === 'file') {
                if (!file) throw new Error('Choose a file to upload');
                const max = meta?.storage?.maxBytes || 15728640;
                if (file.size > max) throw new Error(`File is ${formatBytes(file.size)} — the limit is ${formatBytes(max)}`);
                payload.file_base64 = await readFileAsBase64(file);
                payload.file_name = file.name;
                payload.mime = file.type || 'application/octet-stream';
                payload.link = '';
            } else if (!form.link) throw new Error('Paste a link to the document');
            await documentsApi.create(payload);
            onDone();
        } catch (e2) {
            setErr(e2.message);
        } finally {
            setBusy(false);
        }
    };

    const types = meta?.docTypes || [];

    return (
        <Modal isOpen onClose={onClose} title="Add document" maxWidth="560px">
            <form className="dl-uploadform" onSubmit={submit}>
                <div className="dl-tabs">
                    <button type="button" className={mode === 'file' ? 'on' : ''} onClick={() => setMode('file')}><Upload size={14} /> Upload file</button>
                    <button type="button" className={mode === 'link' ? 'on' : ''} onClick={() => setMode('link')}><Link2 size={14} /> External link</button>
                </div>

                {mode === 'file' ? (
                    <div
                        className={`dl-drop ${drag ? 'is-drag' : ''} ${file ? 'has-file' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                        onDragLeave={() => setDrag(false)}
                        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
                        onClick={() => inputRef.current?.click()}
                    >
                        <input ref={inputRef} type="file" hidden onChange={(e) => pick(e.target.files?.[0])} />
                        <Upload size={22} />
                        {file ? (
                            <><strong>{file.name}</strong><span>{formatBytes(file.size)} · click to replace</span></>
                        ) : (
                            <><strong>Drop a file here, or click to browse</strong>
                                <span>PDF, Office docs, images — up to {formatBytes(meta?.storage?.maxBytes || 15728640)}</span></>
                        )}
                    </div>
                ) : (
                    <label className="dl-field">
                        <span>Document link</span>
                        <input
                            placeholder="https://…"
                            value={form.link}
                            onChange={(e) => setForm({ ...form, link: e.target.value })}
                        />
                    </label>
                )}

                <div className="dl-grid">
                    {!account && (
                        <label className="dl-field">
                            <span>Account</span>
                            <select value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })}>
                                {accounts.map((a) => <option key={a}>{a}</option>)}
                            </select>
                        </label>
                    )}
                    <label className="dl-field">
                        <span>Type</span>
                        <select value={form.doc_type} onChange={(e) => setForm({ ...form, doc_type: e.target.value })}>
                            {Object.entries(meta?.categories || {}).map(([cat, list]) => (
                                <optgroup label={cat} key={cat}>
                                    {list.map((t) => <option key={t}>{t}</option>)}
                                </optgroup>
                            ))}
                            {!types.length && <option>Other</option>}
                        </select>
                    </label>
                    <label className="dl-field">
                        <span>Name</span>
                        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="MSA 2026–29" />
                    </label>
                    <label className="dl-field">
                        <span>Version</span>
                        <input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
                    </label>
                    <label className="dl-field dl-span">
                        <span>Description</span>
                        <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Signed at kickoff, countersigned copy" />
                    </label>
                </div>

                {err && <div className="dl-error">{err}</div>}

                <div className="dl-modal-foot">
                    {meta?.storage && <span className="dl-storage">Stored in {meta.storage.driver === 'local' ? 'local file store' : 'database'}</span>}
                    <button type="button" onClick={onClose}>Cancel</button>
                    <button type="submit" className="dl-add" disabled={busy}>{busy ? 'Uploading…' : 'Add document'}</button>
                </div>
            </form>
        </Modal>
    );
}
