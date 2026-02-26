import React from 'react';
import {
    Users,
    TrendingUp,
    AlertTriangle,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    MoreVertical,
    CheckCircle2
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { useCX } from '../context/CXContext';

const data = [
    { name: 'Jan', renewals: 4000, ebrs: 2400 },
    { name: 'Feb', renewals: 3000, ebrs: 1398 },
    { name: 'Mar', renewals: 2000, ebrs: 9800 },
    { name: 'Apr', renewals: 2780, ebrs: 3908 },
    { name: 'May', renewals: 1890, ebrs: 4800 },
    { name: 'Jun', renewals: 2390, ebrs: 3800 },
];

const COLORS = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe'];

const StatCard = ({ title, value, change, trend, icon, color }) => (
    <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div style={{
                padding: '0.75rem',
                borderRadius: '12px',
                background: `${color}15`,
                color: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                {icon}
            </div>
            <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <MoreVertical size={18} />
            </button>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.25rem' }}>{title}</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '1.8rem', fontWeight: 700 }}>{value}</h3>
            <span style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: trend === 'up' ? 'var(--success)' : 'var(--danger)'
            }}>
                {trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {change}
            </span>
        </div>
    </div>
);

const Dashboard = () => {
    const { customers, contracts } = useCX();

    const activeCustomers = customers.filter(c => c.type === 'Customer').length;
    const atRiskCount = customers.filter(c => c.health === 'Critical' || c.health === 'Poor').length;

    // Calculate values by CXM for the pie chart
    const cxmStats = customers.reduce((acc, curr) => {
        acc[curr.cxm] = (acc[curr.cxm] || 0) + 1;
        return acc;
    }, {});

    const pieData = Object.keys(cxmStats).map(name => ({
        name,
        value: cxmStats[name]
    }));

    return (
        <div className="animate-fade-in">
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Good afternoon, <span className="gradient-text">Alex</span></h1>
                <p style={{ color: 'var(--text-secondary)' }}>Welcome back to your CX command center. Here's what's happening today.</p>
            </header>

            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '2rem' }}>
                <StatCard
                    title="Active Customers"
                    value={activeCustomers}
                    change="+12%"
                    trend="up"
                    icon={<Users size={20} />}
                    color="#6366f1"
                />
                <StatCard
                    title="Health at Risk"
                    value={atRiskCount}
                    change="-2"
                    trend="up"
                    icon={<AlertTriangle size={20} />}
                    color="#f59e0b"
                />
                <StatCard
                    title="Upcoming Renewals"
                    value={contracts.filter(c => c.stage === 'Renewing').length}
                    change="+18%"
                    trend="up"
                    icon={<Calendar size={20} />}
                    color="#10b981"
                />
                <StatCard
                    title="Total Contract Value"
                    value={`$${(contracts.reduce((sum, c) => sum + parseInt(c.value.replace(/[^0-9]/g, '')), 0) / 10).toFixed(1)}M`}
                    change="+5.2%"
                    trend="up"
                    icon={<TrendingUp size={20} />}
                    color="#818cf8"
                />
            </div>

            <div className="dashboard-grid" style={{ gridTemplateColumns: '2fr 1fr', marginBottom: '2rem' }}>
                <div className="glass-card" style={{ height: '400px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3 style={{ fontSize: '1.1rem' }}>Renewals vs EBR Outcomes</h3>
                        <select style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '6px' }}>
                            <option>Last 6 Months</option>
                            <option>Last Quarter</option>
                        </select>
                    </div>
                    <div style={{ width: '100%', height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
                                <defs>
                                    <linearGradient id="colorRenewals" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                                    itemStyle={{ color: 'var(--text-primary)' }}
                                />
                                <Area type="monotone" dataKey="renewals" stroke="var(--accent-primary)" fillOpacity={1} fill="url(#colorRenewals)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-card" style={{ height: '400px' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Accounts by CXM</h3>
                    <div style={{ width: '100%', height: '250px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={{ marginTop: '1rem' }}>
                        {pieData.map((cxm, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLORS[idx % COLORS.length] }}></div>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{cxm.name}</span>
                                </div>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{cxm.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="glass-card">
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>High Priority Actions</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>ACCOUNT</th>
                            <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>CX MANAGER</th>
                            <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>RENEWAL DATE</th>
                            <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>VALUE</th>
                            <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>HEALTH</th>
                            <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {customers.filter(c => c.health === 'Critical' || c.health === 'Poor').slice(0, 4).map((row, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '1rem', fontWeight: 600 }}>{row.name}</td>
                                <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{row.cxm}</td>
                                <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{row.renewals}</td>
                                <td style={{ padding: '1rem', fontWeight: 600 }}>{row.value}</td>
                                <td style={{ padding: '1rem' }}>
                                    <span className={`badge ${row.health === 'Critical' ? 'badge-danger' : 'badge-warning'}`}>
                                        {row.health}
                                    </span>
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                    <button className="btn-ghost" style={{ padding: '6px' }}>View Details</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Dashboard;
