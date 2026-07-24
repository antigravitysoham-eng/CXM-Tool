import React, { useEffect, useMemo, useState } from 'react';
import { FolderOpen, FileText, Link2, HardDrive, Building2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { documentsApi, formatBytes } from '../api/documents';
import { accountsApi } from '../api/accounts';
import DocumentLibrary from '../components/DocumentLibrary';
import StatCard from '../components/StatCard';
import ModuleReportMenu from '../components/ModuleReportMenu';
import Modal from '../components/Modal';
import { fileType } from '../utils/fileType';
import './CashHorizon.css';
import './CLM.css';
import { tooltipProps } from '../lib/chartTheme';

const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const CATEGORY_COLOR = {
    Contractual: '#818cf8',
    Commercial: '#34d399',
    Compliance: '#38bdf8',
    Delivery: '#fbbf24',
    Engagement: '#c084fc',
    Other: '#94a3b8'
};

export default function Documents() {
    const [stats, setStats] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [docs, setDocs] = useState([]);
    const [storage, setStorage] = useState(null);
    const [customerModal, setCustomerModal] = useState(null);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        documentsApi.stats().then(setStats).catch(() => {});
        documentsApi.list().then(setDocs).catch(() => {});
        accountsApi.list().then((a) => setAccounts(a.map((x) => x.name).sort())).catch(() => {});
    }, [tick]);

    // Roll the flat document list up per customer: count, a type breakdown, and
    // when it was last touched — the "how many / what type" the table shows.
    const byCustomer = useMemo(() => {
        const m = {};
        for (const d of docs) {
            const a = d.account || 'Unassigned';
            m[a] = m[a] || { account: a, count: 0, types: {}, last: null };
            m[a].count += 1;
            const ft = fileType(d);
            const label = d.has_file ? (ft.ext ? ft.ext.toUpperCase() : ft.label) : 'LINK';
            const color = d.has_file ? ft.color : '#38bdf8';
            m[a].types[label] = m[a].types[label] || { count: 0, color };
            m[a].types[label].count += 1;
            if (!m[a].last || (d.created_at || '') > m[a].last) m[a].last = d.created_at;
        }
        return Object.values(m).sort((x, y) => y.count - x.count);
    }, [docs]);

    useEffect(() => { documentsApi.meta().then((m) => setStorage(m.storage)).catch(() => {}); }, []);

    const byCategory = useMemo(
        () => Object.entries(stats?.byCategory || {})
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value),
        [stats]
    );

    const topTypes = useMemo(
        () => Object.entries(stats?.byType || {})
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6),
        [stats]
    );


    return (
        <div className="animate-fade-in">
            <header className="ch-head">
                <div>
                    <h1 className="ch-title">Document Management</h1>
                    <p className="ch-sub">
                        Every customer artefact in one library — contracts are just one category.
                        {storage && <> Files are held in the {storage.description}.</>}
                    </p>
                </div>
                <ModuleReportMenu module="documents" title="Documents" />
            </header>

            <div className="ch-kpis">
                <StatCard
                    label="Documents" icon={<FileText size={19} />} accent="#818cf8" variant="kpi"
                    countTo={stats?.total || 0} hint={`${stats?.files || 0} stored files`}
                />
                <StatCard
                    label="Accounts covered" icon={<Building2 size={19} />} accent="#34d399" variant="kpi"
                    countTo={stats?.accounts || 0} hint="with at least one document"
                />
                <StatCard
                    label="External links" icon={<Link2 size={19} />} accent="#38bdf8" variant="kpi"
                    countTo={stats?.links || 0} hint="held outside the platform"
                    progress={stats?.total ? (stats.links / stats.total) * 100 : 0}
                />
                <StatCard
                    label="Stored" icon={<HardDrive size={19} />} accent="#fbbf24" variant="kpi"
                    countTo={stats?.bytes || 0} format={(n) => (Math.round(n) ? formatBytes(Math.round(n)) : '0 B')}
                    hint={storage ? `${storage.driver} driver` : ''}
                />
            </div>

            <div className="ch-section-title" style={{ marginTop: '1.5rem' }}>
                <Building2 size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
                Documents by customer ({byCustomer.length})
            </div>
            <div className="glass-card" style={{ padding: 0, marginBottom: '1.5rem' }}>
                <div className="ch-table-wrap">
                    <table className="ch-table">
                        <thead><tr><th>Customer</th><th>Documents</th><th>Types</th><th>Last updated</th></tr></thead>
                        <tbody>
                            {byCustomer.length === 0 && (
                                <tr><td colSpan={4} className="ch-muted" style={{ textAlign: 'center', padding: '18px' }}>No documents yet. Upload one below, or add documents while creating a contract.</td></tr>
                            )}
                            {byCustomer.map((c) => (
                                <tr key={c.account} style={{ cursor: 'pointer' }} onClick={() => setCustomerModal(c.account)}>
                                    <td className="ch-acct-name">{c.account}</td>
                                    <td><strong>{c.count}</strong> <span className="ch-muted" style={{ fontSize: '0.75rem' }}>doc{c.count === 1 ? '' : 's'}</span></td>
                                    <td>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                            {Object.entries(c.types).sort((a, b) => b[1].count - a[1].count).map(([label, t]) => (
                                                <span key={label} style={{ padding: '1px 8px', borderRadius: 999, fontSize: '0.66rem', fontWeight: 700, color: t.color, border: `1px solid ${t.color}66` }}>
                                                    {t.count} {label}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="ch-muted">{fmtDate(c.last)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {byCategory.length > 0 && (
                <div className="clm-charts" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div className="glass-card clm-chart">
                        <div className="clm-chart-title">Library by category</div>
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={byCategory} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip {...tooltipProps} />
                                <Bar dataKey="value" name="Documents" radius={[6, 6, 0, 0]}>
                                    {byCategory.map((c) => <Cell key={c.name} fill={CATEGORY_COLOR[c.name] || '#94a3b8'} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="glass-card clm-chart">
                        <div className="clm-chart-title">Most-filed document types</div>
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={topTypes} layout="vertical" margin={{ top: 4, right: 12, left: 42, bottom: 0 }}>
                                <XAxis type="number" hide allowDecimals={false} />
                                <YAxis
                                    type="category" dataKey="name" width={110}
                                    tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false}
                                />
                                <Tooltip {...tooltipProps} />
                                <Bar dataKey="value" name="Documents" fill="#818cf8" radius={[0, 5, 5, 0]} barSize={13} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            <div className="ch-section-title"><FolderOpen size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} /> All documents</div>
            <div className="glass-card" style={{ padding: '1.2rem' }}>
                <DocumentLibrary accounts={accounts} onChanged={() => setTick((t) => t + 1)} />
            </div>

            <Modal isOpen={!!customerModal} onClose={() => setCustomerModal(null)} title={`Documents — ${customerModal || ''}`} maxWidth="900px">
                {customerModal && (
                    <DocumentLibrary account={customerModal} accounts={accounts} onChanged={() => setTick((t) => t + 1)} />
                )}
            </Modal>
        </div>
    );
}
