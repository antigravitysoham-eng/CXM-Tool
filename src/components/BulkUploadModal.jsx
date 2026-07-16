import React, { useRef, useState } from 'react';
import { FileDown, Upload, CheckCircle2, AlertTriangle, Database } from 'lucide-react';
import { useCX } from '../context/CXContext';
import { dataApi } from '../api/dataExchange';
import { fireEvent } from '../api/agents';
import Modal from './Modal';

// Reusable bulk-upload flow: download a guided template, then upload a filled sheet.
// `onImported` refreshes the caller's data; `onLoadSample` (optional, admin) quick-seeds.
export default function BulkUploadModal({ isOpen, onClose, module, title, onImported, onLoadSample }) {
    const { addToast } = useCX();
    const [busy, setBusy] = useState('');
    const [result, setResult] = useState(null);
    const fileRef = useRef(null);

    const close = () => { setResult(null); setBusy(''); onClose(); };

    const downloadTemplate = async () => {
        setBusy('template');
        try {
            await dataApi.template(module);
            addToast('Template downloaded — fill the "Data" sheet', 'info');
        } catch (e) {
            addToast(e.message || 'Template download failed', 'error');
        } finally { setBusy(''); }
    };

    const onFile = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
            setBusy('upload');
            setResult(null);
            try {
                const res = await dataApi.import(module, reader.result);
                setResult(res);
                addToast(`Imported ${res.imported}${res.errors.length ? `, ${res.errors.length} rejected` : ''}`, res.errors.length ? 'info' : 'success');
                if (res.imported > 0) fireEvent('data_imported', 'aukat');
                onImported?.();
            } catch (err) {
                addToast(err.message || 'Import failed', 'error');
            } finally { setBusy(''); }
        };
        reader.readAsDataURL(file);
    };

    const loadSample = async () => {
        setBusy('sample');
        try {
            await onLoadSample();
            addToast('Sample dataset loaded', 'success');
            close();
        } catch (e) {
            addToast(e.message || 'Could not load sample', 'error');
        } finally { setBusy(''); }
    };

    return (
        <Modal isOpen={isOpen} onClose={close} title={`Bulk upload — ${title}`} maxWidth="560px">
            <div style={{ fontSize: '0.9rem' }}>
                <ol style={{ margin: '0 0 1.25rem', paddingLeft: '1.1rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    <li>Download the template — it has instructions, validated drop-downs, and an example row.</li>
                    <li>Fill one record per row on the <strong>Data</strong> sheet. Add your own columns to the right if needed.</li>
                    <li>Upload the file. Every row is re-checked; invalid rows are reported, valid rows imported.</li>
                </ol>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-ghost" onClick={downloadTemplate} disabled={!!busy}>
                        <FileDown size={16} /> {busy === 'template' ? 'Preparing…' : 'Download template'}
                    </button>
                    <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={onFile} />
                    <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={!!busy}>
                        <Upload size={16} /> {busy === 'upload' ? 'Uploading…' : 'Upload filled file'}
                    </button>
                </div>

                {result && (
                    <div style={{ marginTop: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.6rem' }}>
                            <CheckCircle2 size={17} color="var(--success)" />
                            <strong>{result.imported}</strong> imported
                            {result.errors.length > 0 && (
                                <>
                                    <AlertTriangle size={17} color="var(--danger)" style={{ marginLeft: 8 }} />
                                    <strong>{result.errors.length}</strong> rejected
                                </>
                            )}
                        </div>
                        {result.createdColumns?.length > 0 && (
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.6rem', fontSize: '0.85rem' }}>
                                New custom columns created: {result.createdColumns.join(', ')}
                            </p>
                        )}
                        {result.errors.length > 0 && (
                            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                                {result.errors.map((er, i) => (
                                    <div key={i} style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.82rem' }}>
                                        <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Row {er.row}:</span>{' '}
                                        <span style={{ color: 'var(--text-secondary)' }}>{er.message}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {onLoadSample && (
                    <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                        <button className="btn btn-ghost" onClick={loadSample} disabled={!!busy} style={{ fontSize: '0.82rem' }}>
                            <Database size={15} /> {busy === 'sample' ? 'Loading…' : 'Or load the sample dataset'}
                        </button>
                    </div>
                )}
            </div>
        </Modal>
    );
}
