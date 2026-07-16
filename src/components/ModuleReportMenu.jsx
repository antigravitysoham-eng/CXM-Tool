import React, { useRef, useState, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import { useCX } from '../context/CXContext';
import { dataApi } from '../api/dataExchange';

// Per-module reporting: Export to Excel + Executive PDF. Dropped into any module header.
export default function ModuleReportMenu({ module, title }) {
    const { addToast } = useCX();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState('');
    const ref = useRef(null);

    useEffect(() => {
        const onOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', onOutside);
        return () => document.removeEventListener('mousedown', onOutside);
    }, []);

    const run = async (label, fn) => {
        setOpen(false);
        setBusy(label);
        try { await fn(); } catch (e) { addToast(e.message || `${label} failed`, 'error'); } finally { setBusy(''); }
    };

    const items = [
        {
            label: 'Export to Excel', icon: <FileSpreadsheet size={16} color="var(--success)" />,
            onClick: () => run('Export', async () => { await dataApi.exportExcel(module); addToast(`${title} exported to Excel`, 'success'); })
        },
        {
            label: 'Executive PDF report', icon: <FileText size={16} color="var(--danger)" />,
            onClick: () => run('Report', async () => { await dataApi.report(module); addToast(`${title} PDF report downloaded`, 'success'); })
        }
    ];

    return (
        <div style={{ position: 'relative' }} ref={ref}>
            <button className="btn btn-ghost" onClick={() => setOpen((o) => !o)} disabled={!!busy}>
                {busy ? <span className="app-spinner" style={{ width: 15, height: 15, borderWidth: 2 }} /> : <Download size={16} />}
                {busy ? `${busy}…` : 'Export'} <ChevronDown size={14} />
            </button>
            {open && (
                <div style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 220,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                    borderRadius: 12, padding: 8, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 100
                }}>
                    {items.map((it) => (
                        <button
                            key={it.label}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: 10,
                                background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer',
                                textAlign: 'left', borderRadius: 8
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99,102,241,0.1)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            onClick={it.onClick}
                        >
                            {it.icon}<span style={{ fontSize: '0.85rem' }}>{it.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
