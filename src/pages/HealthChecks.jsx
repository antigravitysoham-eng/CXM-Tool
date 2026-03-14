import React, { useState } from 'react';
import { HeartPulse, CheckCircle2, XCircle, AlertCircle, Plus, Filter, Save, List, LayoutDashboard } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useCX } from '../context/CXContext';
import Modal from '../components/Modal';
import ModuleActions from '../components/ModuleActions';
import DataManagement from '../components/DataManagement';

const COLORS = {
    'Healthy': '#10b981',
    'Stable': '#6366f1',
    'Poor': '#f59e0b',
    'Critical': '#ef4444'
};

const HealthChecks = () => {
    const { addToast, customers, healthChecks, addHealthCheck } = useCX();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        account: '',
        outcome: 'Healthy',
        takeaway: '',
        next_step: ''
    });

    const handleLogCheck = async (e) => {
        e.preventDefault();
        const checkData = {
            ...formData,
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        };
        await addHealthCheck(checkData);
        setIsModalOpen(false);
        setFormData({ account: '', outcome: 'Healthy', takeaway: '', next_step: '' });
    };

    const getOutcomeIcon = (outcome) => {
        switch (outcome) {
            case 'Critical': return <XCircle size={16} color="var(--danger)" />;
            case 'Poor': return <AlertCircle size={16} color="var(--warning)" />;
            case 'Healthy': return <CheckCircle2 size={16} color="var(--success)" />;
            default: return <CheckCircle2 size={16} color="var(--success)" />;
        }
    };

    const [activeTab, setActiveTab] = useState('Overview');

    // Aggregate data for overview charts
    const healthStats = healthChecks.reduce((acc, curr) => {
        acc[curr.outcome] = (acc[curr.outcome] || 0) + 1;
        return acc;
    }, {});

    const pieData = Object.keys(healthStats).map(name => ({
        name,
        value: healthStats[name]
    })).sort((a, b) => b.value - a.value);

    return (
        <div className="animate-fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Health Checks</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Log and track outcomes of recurring customer sentiment calls.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-ghost"><Filter size={18} /> Filter</button>
                    <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                        <Plus size={18} /> Log Check
                    </button>
                </div>
            </header>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <button
                    className={`btn ${activeTab === 'Overview' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('Overview')}
                    style={{ padding: '8px 16px', borderRadius: '20px' }}
                >
                    <LayoutDashboard size={18} /> Executive Overview
                </button>
                <button
                    className={`btn ${activeTab === 'Data' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('Data')}
                    style={{ padding: '8px 16px', borderRadius: '20px' }}
                >
                    <List size={18} /> Deep Dive Data
                </button>
            </div>

            {activeTab === 'Overview' ? (
                <>
                    <ModuleActions
                        moduleName="Health Checks"
                        aiInsight="Predictive Churn: 3 accounts have missed their last 2 health checks. Urgent outreach triggered for account owners to re-establish touchpoints."
                    />
                    <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
                        <div className="glass-card" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Health Outcome Distribution</h3>
                            <div style={{ flex: 1, position: 'relative' }}>
                                {healthChecks.length === 0 ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>No data available</div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={pieData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={90}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {pieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[entry.name] || 'var(--text-muted)'} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '8px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '1rem' }}>
                                {pieData.map(stat => (
                                    <div key={stat.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLORS[stat.name] || 'gray' }} />
                                            <span style={{ fontSize: '0.85rem' }}>{stat.name}</span>
                                        </div>
                                        <span style={{ fontWeight: 600 }}>{stat.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="glass-card" style={{ height: '400px' }}>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Recent Critical & Poor Accounts</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {healthChecks.filter(c => c.outcome === 'Critical' || c.outcome === 'Poor').slice(0, 4).map((check, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                        <div>
                                            <h4 style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '4px' }}>{check.account}</h4>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Last Check: {check.date}</p>
                                        </div>
                                        <div style={{ flex: 1, margin: '0 2rem' }}>
                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Takeaway</p>
                                            <p style={{ fontSize: '0.9rem' }}>{check.takeaway}</p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <span className={`badge ${check.outcome === 'Critical' ? 'badge-danger' : 'badge-warning'}`} style={{ marginBottom: '8px', display: 'inline-block' }}>
                                                {check.outcome}
                                            </span>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', cursor: 'pointer' }}>Action: {check.next_step}</p>
                                        </div>
                                    </div>
                                ))}
                                {healthChecks.filter(c => c.outcome === 'Critical' || c.outcome === 'Poor').length === 0 && (
                                    <div style={{ textAlign: 'center', color: 'var(--success)', padding: '2rem' }}>
                                        <CheckCircle2 size={32} style={{ margin: '0 auto 1rem auto' }} opacity={0.5} />
                                        No accounts currently marked as Poor or Critical.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <DataManagement
                        moduleName="Sentiment Log"
                        onManualAdd={() => setIsModalOpen(true)}
                    />
                    <div className="glass-card" style={{ padding: '0' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>DATE</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>ACCOUNT</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>OUTCOME / SENTIMENT</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>KEY TAKEAWAY</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>NEXT STEP</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {healthChecks.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No health checks logged yet.</td>
                                    </tr>
                                ) : healthChecks.map((check, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', transition: '0.2s' }}>
                                        <td style={{ padding: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{check.date}</td>
                                        <td style={{ padding: '1.25rem', fontWeight: 600 }}>{check.account}</td>
                                        <td style={{ padding: '1.25rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {getOutcomeIcon(check.outcome)}
                                                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{check.outcome}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '250px' }}>{check.takeaway}</td>
                                        <td style={{ padding: '1.25rem' }}>
                                            <span style={{ fontSize: '0.8rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>{check.next_step}</span>
                                        </td>
                                        <td style={{ padding: '1.25rem', textAlign: 'right' }}>
                                            <button className="btn-ghost" style={{ padding: '4px' }}>View Notes</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Log Health Check">
                <form onSubmit={handleLogCheck} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="form-group">
                        <label>Select Account</label>
                        <select
                            value={formData.account}
                            onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                            required
                        >
                            <option value="">Select an account...</option>
                            {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Sentiment / Health Outcome</label>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            {['Healthy', 'Stable', 'Poor', 'Critical'].map(level => (
                                <button
                                    key={level}
                                    type="button"
                                    className={`btn ${formData.outcome === level ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ flex: 1, padding: '8px', fontSize: '0.85rem' }}
                                    onClick={() => setFormData({ ...formData, outcome: level })}
                                >
                                    {level}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Key Takeaway</label>
                        <input
                            type="text"
                            placeholder="e.g. Budget cuts at department level"
                            value={formData.takeaway}
                            onChange={(e) => setFormData({ ...formData, takeaway: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Next Step</label>
                        <input
                            type="text"
                            placeholder="e.g. Escalate to CTO"
                            value={formData.next_step}
                            onChange={(e) => setFormData({ ...formData, next_step: e.target.value })}
                            required
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Save size={18} /> Log Check</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default HealthChecks;
