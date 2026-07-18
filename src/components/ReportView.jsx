import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { FileSpreadsheet, FileText, Sparkles, AlertCircle } from 'lucide-react';
import { dataApi } from '../api/dataExchange';
import './ReportView.css';

/**
 * In-app executive report for any registered module — renders the same computed
 * summary the PDF does (KPIs, a ranked bar chart, colour-coded sections and
 * recommended actions), with Excel / PDF export beside it.
 */
export default function ReportView({ module }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');

    useEffect(() => {
        let alive = true;
        dataApi.reportJson(module)
            .then((d) => { if (alive) setData(d); })
            .catch((e) => { if (alive) setError(e.message || 'Failed to build report'); });
        return () => { alive = false; };
    }, [module]);

    const run = async (kind, fn) => {
        setBusy(kind);
        try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(''); }
    };

    if (error) return <div className="rv-error"><AlertCircle size={16} /> {error}</div>;
    if (!data) return <div className="rv-loading"><span className="app-spinner" /> Building report…</div>;

    const s = data.summary;
    const bars = (s.bars?.items || []).map((it) => ({ name: it.label, value: it.value, valueStr: it.valueStr }));
    const palette = ['#818cf8', '#22d3ee', '#34d399', '#fbbf24', '#f87171', '#a855f7', '#38bdf8'];

    return (
        <div className="rv">
            <div className="rv-head">
                <div>
                    <div className="rv-title">{data.title} — Executive Report</div>
                    <div className="rv-gen">{s.generatedBy} · {new Date(data.generatedAt).toLocaleString()}</div>
                </div>
                <div className="rv-exports">
                    <button className="btn btn-ghost rv-exp" disabled={!!busy} onClick={() => run('xlsx', () => dataApi.exportExcel(module))}>
                        <FileSpreadsheet size={15} color="var(--success)" /> {busy === 'xlsx' ? 'Exporting…' : 'Excel'}
                    </button>
                    <button className="btn btn-ghost rv-exp" disabled={!!busy} onClick={() => run('pdf', () => dataApi.report(module))}>
                        <FileText size={15} color="var(--danger)" /> {busy === 'pdf' ? 'Building…' : 'PDF'}
                    </button>
                </div>
            </div>

            <div className="rv-kpis">
                {s.kpis.map((k, i) => (
                    <div key={i} className="rv-kpi" style={{ '--k': k.color || '#6366f1' }}>
                        <div className="rv-kpi-label">{k.label}</div>
                        <div className="rv-kpi-value">{k.value}</div>
                        {k.hint && <div className="rv-kpi-hint">{k.hint}</div>}
                    </div>
                ))}
            </div>

            {bars.length > 0 && (
                <div className="rv-chart-card">
                    <div className="rv-section-title">{s.bars.title}</div>
                    <ResponsiveContainer width="100%" height={Math.max(140, bars.length * 42)}>
                        <BarChart data={bars} layout="vertical" margin={{ left: 8, right: 40 }}>
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={130} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{ fill: 'var(--veil-1)' }} contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }}
                                formatter={(v, _n, p) => [p.payload.valueStr || v, '']} />
                            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
                                {bars.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            <div className="rv-sections">
                {s.sections.map((sec, i) => (
                    <div key={i} className="rv-section" style={{ '--sc': sec.color || '#6366f1' }}>
                        <div className="rv-section-head">{sec.title}</div>
                        <ul className="rv-lines">
                            {sec.lines.map((l, j) => <li key={j}>{l}</li>)}
                        </ul>
                    </div>
                ))}
            </div>

            {s.actions?.length > 0 && (
                <div className="rv-actions">
                    <div className="rv-actions-head"><Sparkles size={15} /> Recommended actions</div>
                    <ul className="rv-lines">
                        {s.actions.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                </div>
            )}
        </div>
    );
}
