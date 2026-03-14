import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users,
    TrendingUp,
    AlertTriangle,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    MoreVertical,
    CheckCircle2,
    ArrowRight,
    Rocket,
    Gift,
    Sparkles,
    ClipboardCheck,
    Map
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

const StatCard = ({ title, value, change, trend, icon, color, link, onNavigate }) => (
    <div className="glass-card" style={{ position: 'relative', cursor: link ? 'pointer' : 'default', transition: 'var(--transition-fast)' }} onClick={() => link && onNavigate(link)} onMouseEnter={(e) => link && (e.currentTarget.style.transform = 'translateY(-2px)')} onMouseLeave={(e) => link && (e.currentTarget.style.transform = 'translateY(0)')}>
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
            {link ? (
                <button style={{ background: 'transparent', border: 'none', color: 'var(--accents-primary)', cursor: 'pointer' }}>
                    <ArrowRight size={18} color="var(--text-muted)" />
                </button>
            ) : (
                <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <MoreVertical size={18} />
                </button>
            )}
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.25rem' }}>{title}</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '1.8rem', fontWeight: 700 }}>{value}</h3>
            {change && (
                <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: trend === 'down' ? 'var(--danger)' : 'var(--success)'
                }}>
                    {trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {change}
                </span>
            )}
        </div>
    </div>
);

const Dashboard = () => {
    const { customers, contracts, onboarding, referrals, aiPredictions, surveys } = useCX();
    const navigate = useNavigate();

    const activeCustomers = customers.filter(c => c.type === 'Customer').length;
    const atRiskCount = customers.filter(c => c.health === 'Critical' || c.health === 'Poor').length;
    const activeOnboardings = onboarding.length;
    const pendingReferrals = referrals.filter(r => r.status === 'Pending').length;
    const aiOpportunities = aiPredictions.length;
    const avgNps = surveys.reduce((acc, curr) => acc + parseInt(curr.nps || 0), 0) / (surveys.length || 1);

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
                <p style={{ color: 'var(--text-secondary)' }}>Welcome to your CX Command Center. Here is your executive overview.</p>
            </header>

            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: '2rem' }}>
                <StatCard
                    title="Active Customers"
                    value={activeCustomers}
                    change="+12%"
                    trend="up"
                    icon={<Users size={20} />}
                    color="#6366f1"
                    link="/directory"
                    onNavigate={navigate}
                />
                <StatCard
                    title="Health at Risk"
                    value={atRiskCount}
                    change="-2"
                    trend="down"
                    icon={<AlertTriangle size={20} />}
                    color="#f59e0b"
                    link="/health-checks"
                    onNavigate={navigate}
                />
                <StatCard
                    title="Active Onboardings"
                    value={activeOnboardings}
                    icon={<Rocket size={20} />}
                    color="#10b981"
                    link="/onboarding"
                    onNavigate={navigate}
                />
                <StatCard
                    title="Pending Referrals"
                    value={pendingReferrals}
                    icon={<Gift size={20} />}
                    color="#818cf8"
                    link="/referrals"
                    onNavigate={navigate}
                />
                <StatCard
                    title="AI Upsell Opps"
                    value={aiOpportunities}
                    icon={<Sparkles size={20} />}
                    color="#ec4899"
                    link="/upsells"
                    onNavigate={navigate}
                />
            </div>

            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', cursor: 'pointer', transition: 'var(--transition-fast)' }} onClick={() => navigate('/surveys')} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ background: 'var(--info)', padding: '6px', borderRadius: '8px', color: 'white' }}>
                                <ClipboardCheck size={18} />
                            </div>
                            <h3 style={{ fontSize: '1.1rem' }}>Overall Satisfaction</h3>
                        </div>
                        <ArrowRight size={18} color="var(--text-muted)" />
                    </div>
                    <div style={{ marginTop: 'auto' }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Global Sentiment</p>
                        <h2 style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            {surveys.length > 0 ? 'Positive' : 'Neutral'}
                            <span className="badge badge-success" style={{ fontSize: '0.8rem' }}>Avg NPS: {avgNps.toFixed(0)}</span>
                        </h2>
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', cursor: 'pointer', transition: 'var(--transition-fast)' }} onClick={() => navigate('/journey')} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ background: 'var(--accent-primary)', padding: '6px', borderRadius: '8px', color: 'white' }}>
                                <Map size={18} />
                            </div>
                            <h3 style={{ fontSize: '1.1rem' }}>Engagement Level</h3>
                        </div>
                        <ArrowRight size={18} color="var(--text-muted)" />
                    </div>
                    <div style={{ marginTop: 'auto' }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Product Adoption</p>
                        <h2 style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            High
                            <span className="badge badge-info" style={{ fontSize: '0.8rem' }}>+12% Session Time</span>
                        </h2>
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', cursor: 'pointer', transition: 'var(--transition-fast)' }} onClick={() => navigate('/clm')} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ background: 'var(--warning)', padding: '6px', borderRadius: '8px', color: 'white' }}>
                                <Calendar size={18} />
                            </div>
                            <h3 style={{ fontSize: '1.1rem' }}>Value at Stake</h3>
                        </div>
                        <ArrowRight size={18} color="var(--text-muted)" />
                    </div>
                    <div style={{ marginTop: 'auto' }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Upcoming Renewals</p>
                        <h2 style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            ${(contracts.reduce((sum, c) => sum + parseInt(c.value.replace(/[^0-9]/g, '')), 0) / 10).toFixed(1)}M
                            <span className="badge badge-warning" style={{ fontSize: '0.8rem' }}>{contracts.filter(c => c.stage === 'Renewing').length} Accounts</span>
                        </h2>
                    </div>
                </div>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h3 style={{ fontSize: '1.1rem' }}>High Priority Actions</h3>
                        <span className="badge badge-danger">{customers.filter(c => c.health === 'Critical' || c.health === 'Poor').length} Alerts</span>
                    </div>
                    <button className="btn-ghost" onClick={() => navigate('/health-checks')}>View All Health</button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>ACCOUNT</th>
                            <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>CX MANAGER</th>
                            <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>RENEWAL DATE</th>
                            <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>ARR VALUE</th>
                            <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>HEALTH</th>
                            <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>ACTION</th>
                        </tr>
                    </thead>
                    <tbody>
                        {customers.filter(c => c.health === 'Critical' || c.health === 'Poor').slice(0, 5).map((row, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', transition: '0.2s' }}>
                                <td style={{ padding: '1.25rem', fontWeight: 600 }}>{row.name}</td>
                                <td style={{ padding: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{row.cxm}</td>
                                <td style={{ padding: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Clock size={14} /> {row.renewals}
                                </td>
                                <td style={{ padding: '1.25rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{row.value}</td>
                                <td style={{ padding: '1.25rem' }}>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        color: row.health === 'Critical' ? '#ef4444' : '#f59e0b',
                                        background: row.health === 'Critical' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }}></div>
                                        {row.health}
                                    </span>
                                </td>
                                <td style={{ padding: '1.25rem', textAlign: 'right' }}>
                                    <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '0.8rem' }} onClick={() => navigate('/journey')}>
                                        Intervene
                                    </button>
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
