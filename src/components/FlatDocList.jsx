import React from 'react';
import { Link2 } from 'lucide-react';
import { formatBytes } from '../api/documents';
import { fileType } from '../utils/fileType';

const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/**
 * A compact, clickable list of documents (from an already-fetched array).
 * Clicking a row calls onOpen(doc) — the caller shows the viewer. Used inside
 * the KPI drill-down modals so a metric expands into the documents behind it.
 */
export default function FlatDocList({ docs = [], onOpen, showAccount = true }) {
    if (!docs.length) return <div className="ch-empty" style={{ padding: '24px' }}>No documents here yet.</div>;
    return (
        <div className="dl-list">
            {docs.map((d) => {
                const ft = fileType(d);
                return (
                    <div className="dl-row dl-row--clickable" key={d.id} role="button" tabIndex={0}
                        onClick={() => onOpen?.(d)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(d); } }}>
                        <div className="dl-icon" style={{ background: `${ft.color}22`, color: ft.color }}>
                            <span style={{ fontSize: 16 }} aria-hidden>{d.has_file ? ft.icon : '🔗'}</span>
                        </div>
                        <div className="dl-main">
                            <div className="dl-name">
                                {d.name}
                                {d.has_file
                                    ? <span className="dl-typechip" style={{ color: ft.color, borderColor: `${ft.color}66` }}>{ft.ext ? ft.ext.toUpperCase() : ft.label}</span>
                                    : <span className="dl-linkbadge"><Link2 size={11} /> link</span>}
                            </div>
                            <div className="dl-sub">
                                <span className="dl-type">{d.doc_type}</span>
                                {showAccount && <span>· {d.account}</span>}
                                {d.contract_id && <span>· {d.contract_id}</span>}
                            </div>
                        </div>
                        <div className="dl-meta">
                            <span>{formatBytes(d.size)}</span>
                            <span>{fmtDate(d.created_at)}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
