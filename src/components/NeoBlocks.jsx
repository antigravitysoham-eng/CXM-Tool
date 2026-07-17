import React from 'react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
    PieChart, Pie, LineChart, Line
} from 'recharts';
import {
    Wallet, AlertTriangle, RefreshCw, Users, FileText, Target,
    HeartPulse, Percent, Activity, Handshake, CheckCircle2
} from 'lucide-react';
import StatCard from './StatCard';

/**
 * Renders NEO's answer blocks.
 *
 * These are the same StatCard and recharts components the dashboard uses, so a
 * number in the chat and the same number on a module page are literally the same
 * component fed from the same API — they cannot drift apart.
 */

const PALETTE = ['#818cf8', '#34d399', '#38bdf8', '#fbbf24', '#c084fc', '#f87171', '#2dd4bf', '#f472b6'];

const tooltipStyle = {
    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
    borderRadius: 10, color: 'var(--text-primary)', fontSize: 12
};

// The server sends labels, not icons — keeping lucide out of the API. First match
// wins, so order matters ("value at risk" must beat "value").
const ICON_RULES = [
    [/risk|weak|churn/i, AlertTriangle],
    [/renew/i, RefreshCw],
    [/customer|account|stakeholder/i, Users],
    [/partner/i, Handshake],
    [/document|file|library/i, FileText],
    [/meddicc|qualif/i, Target],
    [/health/i, HeartPulse],
    [/probability|%/i, Percent],
    [/created|done/i, CheckCircle2],
    [/value|pipeline|weighted|revenue|₹/i, Wallet]
];
const iconFor = (label = '', value = '') => {
    const hit = ICON_RULES.find(([re]) => re.test(label) || re.test(String(value)));
    const Icon = hit ? hit[1] : Activity;
    return <Icon size={19} />;
};

const compact = (n) => {
    const v = Number(n) || 0;
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
    return String(v);
};

function ChartBlock({ block }) {
    const { variant, title, data = [], valueFormat, layout } = block;
    if (!data.length) return null;
    const fmt = valueFormat === 'money' ? compact : (v) => v;

    return (
        <div className="neo-block neo-chart">
            {title && <div className="neo-block-title">{title}</div>}
            <ResponsiveContainer width="100%" height={variant === 'pie' ? 200 : Math.max(170, Math.min(data.length * 26 + 40, 300))}>
                {variant === 'pie' ? (
                    <PieChart>
                        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={78} paddingAngle={2}>
                            {data.map((d, i) => <Cell key={d.name} fill={PALETTE[i % PALETTE.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                ) : variant === 'line' ? (
                    <LineChart data={data} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmt} />
                        <Tooltip contentStyle={tooltipStyle} formatter={fmt} />
                        <Line type="monotone" dataKey="value" stroke="#818cf8" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                ) : layout === 'vertical' ? (
                    <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                        <XAxis type="number" hide tickFormatter={fmt} />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: 'var(--veil-2)' }} contentStyle={tooltipStyle} formatter={fmt} />
                        <Bar dataKey="value" radius={[0, 5, 5, 0]} barSize={13}>
                            {data.map((d, i) => <Cell key={d.name} fill={PALETTE[i % PALETTE.length]} />)}
                        </Bar>
                    </BarChart>
                ) : (
                    <BarChart data={data} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={fmt} />
                        <Tooltip cursor={{ fill: 'var(--veil-2)' }} contentStyle={tooltipStyle} formatter={fmt} />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                            {data.map((d, i) => <Cell key={d.name} fill={PALETTE[i % PALETTE.length]} />)}
                        </Bar>
                    </BarChart>
                )}
            </ResponsiveContainer>
        </div>
    );
}

export default function NeoBlocks({ blocks = [] }) {
    return blocks.map((b, i) => {
        if (b.type === 'text') return <p className="neo-text" key={i}>{b.text}</p>;

        if (b.type === 'stats') {
            return (
                <div className="neo-block neo-stats" key={i}>
                    {b.items.map((s) => (
                        <StatCard
                            key={s.label}
                            label={s.label}
                            icon={iconFor(s.label, s.value)}
                            accent={s.accent}
                            variant={s.variant || 'kpi'}
                            hint={s.hint}
                            // Values arrive pre-formatted (₹1.2Cr, 46d), so skip the
                            // count-up rather than animate a string to NaN.
                            countTo={1}
                            format={() => s.value}
                        />
                    ))}
                </div>
            );
        }

        if (b.type === 'chart') return <ChartBlock block={b} key={i} />;

        if (b.type === 'table') {
            return (
                <div className="neo-block neo-table-wrap" key={i}>
                    {b.title && <div className="neo-block-title">{b.title}</div>}
                    <table className="neo-table">
                        <thead>
                            <tr>{b.columns.map((c) => <th key={c}>{c}</th>)}</tr>
                        </thead>
                        <tbody>
                            {b.rows.map((row, ri) => (
                                <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        return null;
    });
}
