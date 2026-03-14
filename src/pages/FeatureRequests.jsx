import React, { useState } from 'react';
import { Zap, ThumbsUp, MessageSquare, TrendingUp, Filter, Search, Plus, Save, LayoutDashboard, List } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useCX } from '../context/CXContext';
import Modal from '../components/Modal';
import ModuleActions from '../components/ModuleActions';
import DataManagement from '../components/DataManagement';

const IMPACT_COLORS = {
    'Critical': '#ef4444',
    'High': '#f59e0b',
    'Medium': '#6366f1',
    'Low': '#10b981'
};

const FeatureRequests = () => {
    const { addToast, requests, addRequest, voteRequest } = useCX();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        account: '',
        impact: 'Medium',
        description: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        await addRequest(formData);
        setIsModalOpen(false);
        setFormData({ title: '', account: '', impact: 'Medium', description: '' });
    };

    const [activeTab, setActiveTab] = useState('Overview');

    // Aggregate data for overview
    const impactStats = requests.reduce((acc, curr) => {
        acc[curr.impact] = (acc[curr.impact] || 0) + 1;
        return acc;
    }, {});

    const pieData = Object.keys(impactStats).map(name => ({
        name,
        value: impactStats[name]
    }));

    return (
        <div className="animate-fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Feature Requests</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Track and analyze customer-specific enhancements and product feedback.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                    <Plus size={18} /> New Request
                </button>
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
                        moduleName="Feature Requests"
                        aiInsight="Revenue Opportunity: The 'Advanced RBAC' request is linked to 4 'At Risk' enterprise accounts. Fast-tracking this could secure $120k in ARR."
                    />
                    <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '2.5rem' }}>
                        <div className="glass-card">
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Total Requests</p>
                            <h3 style={{ fontSize: '1.5rem' }}>{requests.length}</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--info)' }}>{requests.filter(r => r.status === 'Planned').length} Planned for Q2</p>
                        </div>
                        <div className="glass-card">
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Expansion Potential</p>
                            <h3 style={{ fontSize: '1.5rem' }}>$420k</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--success)' }}>Revenue Impact Opportunity</p>
                        </div>
                        <div className="glass-card">
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Avg. Votes / Request</p>
                            <h3 style={{ fontSize: '1.5rem' }}>{requests.length > 0 ? (requests.reduce((acc, r) => acc + r.votes, 0) / requests.length).toFixed(1) : 0}</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Engagement up 15%</p>
                        </div>
                    </div>

                    <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
                        <div className="glass-card" style={{ height: '350px', display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Requests by Impact</h3>
                            <div style={{ flex: 1, position: 'relative' }}>
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
                                                <Cell key={`cell-${index}`} fill={IMPACT_COLORS[entry.name] || 'var(--text-muted)'} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '8px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="glass-card" style={{ height: '350px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.1rem' }}>Top Requested Features</h3>
                                <button className="btn-ghost" style={{ fontSize: '0.8rem' }}>View All</button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {requests.slice().sort((a, b) => b.votes - a.votes).slice(0, 3).map((req, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                            <div style={{ padding: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', textAlign: 'center', minWidth: '40px' }}>
                                                <TrendingUp size={12} color="var(--accent-primary)" style={{ marginBottom: '2px' }} />
                                                <p style={{ fontSize: '0.8rem', fontWeight: 700 }}>{req.votes}</p>
                                            </div>
                                            <div>
                                                <h4 style={{ fontSize: '0.95rem', marginBottom: '0.25rem' }}>{req.title}</h4>
                                                <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>{req.status}</span>
                                            </div>
                                        </div>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: req.impact === 'Critical' ? 'var(--danger)' : req.impact === 'High' ? 'var(--warning)' : 'var(--text-secondary)' }}>
                                            {req.impact} Impact
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <DataManagement
                        moduleName="Feature Backlog"
                        onManualAdd={() => setIsModalOpen(true)}
                    />
                    <div className="glass-card" style={{ padding: '0' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '1.1rem' }}>Requested Enhancements</h3>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ position: 'relative' }}>
                                    <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input type="text" placeholder="Search requests..." style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px 12px 6px 32px', color: 'white', fontSize: '0.85rem' }} />
                                </div>
                                <button className="btn-ghost" style={{ padding: '8px' }}><Filter size={18} /></button>
                            </div>
                        </div>
                        <div style={{ padding: '1.5rem' }}>
                            {requests.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No feature requests found.</p>
                            ) : requests.map((req, idx) => (
                                <div key={idx} className="glass" style={{ marginBottom: '1rem', padding: '1.25rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                                        <div style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', textAlign: 'center', minWidth: '45px' }}>
                                            <TrendingUp size={14} color="var(--accent-primary)" style={{ marginBottom: '2px' }} />
                                            <p style={{ fontSize: '0.75rem', fontWeight: 700 }}>{req.votes}</p>
                                        </div>
                                        <div>
                                            <h4 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>{req.title}</h4>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Required by: **{req.account}**</p>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'center' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Impact</p>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: req.impact === 'Critical' ? 'var(--danger)' : req.impact === 'High' ? 'var(--warning)' : 'var(--success)' }}>{req.impact}</span>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Status</p>
                                            <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>{req.status}</span>
                                        </div>
                                        <button className="btn btn-ghost" style={{ padding: '8px', borderRadius: '8px' }} onClick={() => voteRequest(req.id)}>
                                            <ThumbsUp size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )
            }

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Log New Feature Request">
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="form-group">
                        <label>Request Title</label>
                        <input
                            type="text"
                            placeholder="e.g. SSO Integration for Enterprise"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Requesting Account</label>
                        <input
                            type="text"
                            placeholder="Customer name"
                            value={formData.account}
                            onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Revenue Impact / Potential</label>
                        <select
                            value={formData.impact}
                            onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
                        >
                            <option value="Critical">Critical (Blocker for Renewal)</option>
                            <option value="High">High (Major Expansion Potential)</option>
                            <option value="Medium">Medium (QoL Improvement)</option>
                            <option value="Low">Low (Minor Request)</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Description & Context</label>
                        <textarea
                            placeholder="Detail why this feature is requested..."
                            style={{ height: '100px', resize: 'none' }}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            required
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Save size={18} /> Submit Request</button>
                    </div>
                </form>
            </Modal>
        </div >
    );
};

export default FeatureRequests;
