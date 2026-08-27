import React, { useEffect, useState } from 'react';
import { Download, ExternalLink, Loader2 } from 'lucide-react';
import { documentsApi, formatBytes } from '../api/documents';
import { fileType } from '../utils/fileType';
import './DocumentViewer.css';

/**
 * Expanded document viewer.
 *
 * PDFs and text render in an iframe, images inline; office/archive files can't
 * be shown by the browser, so we present the typed icon and a download. Bytes
 * come over the authenticated download route as a blob object URL (revoked on
 * unmount), so nothing leaves the app's auth boundary.
 */
export default function DocumentViewer({ doc }) {
    const ft = fileType(doc || {});
    const [src, setSrc] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let objUrl = null;
        setSrc(null); setError('');
        if (!doc || !doc.has_file || !ft.inline) return undefined;
        setLoading(true);
        documentsApi.viewUrl(doc)
            .then(({ url }) => { objUrl = url; setSrc(url); })
            .catch((e) => setError(e.message || 'Could not load the file'))
            .finally(() => setLoading(false));
        return () => { if (objUrl) URL.revokeObjectURL(objUrl); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doc?.id]);

    if (!doc) return null;
    const isLink = !doc.has_file && doc.link;

    const body = () => {
        if (isLink) {
            return (
                <div className="dv-empty">
                    <ExternalLink size={40} />
                    <p>This document is stored as an external link.</p>
                    <a className="dv-btn dv-btn--primary" href={doc.link} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Open link</a>
                </div>
            );
        }
        if (!doc.has_file) {
            return <div className="dv-empty"><span style={{ fontSize: 40 }}>{ft.icon}</span><p>No file is attached to this record.</p></div>;
        }
        if (!ft.inline) {
            return (
                <div className="dv-empty">
                    <span style={{ fontSize: 46 }}>{ft.icon}</span>
                    <p>{ft.label} files can’t be previewed in the browser.<br />Download it to open in your app.</p>
                    <button className="dv-btn dv-btn--primary" onClick={() => documentsApi.download(doc)}><Download size={15} /> Download {ft.label.toLowerCase()}</button>
                </div>
            );
        }
        if (loading) return <div className="dv-empty"><Loader2 size={34} className="dv-spin" /><p>Loading preview…</p></div>;
        if (error) return <div className="dv-empty"><span style={{ fontSize: 40 }}>⚠️</span><p>{error}</p></div>;
        if (!src) return null;
        if (ft.kind === 'image') return <div className="dv-imgwrap"><img src={src} alt={doc.name} /></div>;
        return <iframe className="dv-frame" src={src} title={doc.name} />;
    };

    return (
        <div className="dv">
            <div className="dv-bar">
                <span className="dv-badge" style={{ background: `${ft.color}22`, color: ft.color, border: `1px solid ${ft.color}55` }}>
                    <span aria-hidden>{ft.icon}</span> {ft.ext ? ft.ext.toUpperCase() : ft.label}
                </span>
                <div className="dv-meta">
                    <span className="dv-name">{doc.name}</span>
                    <span className="dv-sub">
                        {doc.account}{doc.contract_id ? ` · ${doc.contract_id}` : ''}
                        {doc.size ? ` · ${formatBytes(doc.size)}` : ''}
                        {doc.uploaded_by ? ` · ${doc.uploaded_by}` : ''}
                        {doc.created_at ? ` · ${new Date(doc.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
                    </span>
                </div>
                {doc.has_file && (
                    <button className="dv-btn" onClick={() => documentsApi.download(doc)} title="Download"><Download size={15} /> Download</button>
                )}
            </div>
            <div className="dv-body">{body()}</div>
        </div>
    );
}
