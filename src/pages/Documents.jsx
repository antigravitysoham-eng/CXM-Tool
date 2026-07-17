import React, { useEffect, useMemo, useState } from 'react';
import { FolderOpen, FileText, Link2, HardDrive, Building2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { documentsApi, formatBytes } from '../api/documents';
import { accountsApi } from '../api/accounts';
import DocumentLibrary from '../components/DocumentLibrary';
import StatCard from '../components/StatCard';
import './CashHorizon.css';
import './CLM.css';

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
    const [storage, setStorage] = useState(null);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        documentsApi.stats().then(setStats).catch(() => {});
        accountsApi.list().then((a) => setAccounts(a.map((x) => x.name).sort())).catch(() => {});
    }, [tick]);

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

    const tooltipStyle = {
        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
        borderRadius: 10, color: 'var(--text-primary)', fontSize: 12
    };

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

            {byCategory.length > 0 && (
                <div className="clm-charts" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div className="glass-card clm-chart">
                        <div className="clm-chart-title">Library by category</div>
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={byCategory} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip cursor={{ fill: 'var(--veil-2)' }} contentStyle={tooltipStyle} />
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
                                <Tooltip cursor={{ fill: 'var(--veil-2)' }} contentStyle={tooltipStyle} />
                                <Bar dataKey="value" name="Documents" fill="#818cf8" radius={[0, 5, 5, 0]} barSize={13} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            <div className="glass-card" style={{ padding: '1.2rem' }}>
                <DocumentLibrary accounts={accounts} onChanged={() => setTick((t) => t + 1)} />
            </div>
        </div>
    );
}
