import React, { useState } from 'react';
import { Map, Zap, Calendar, MousePointer2, Globe, FileSearch, MessageCircle, Filter, Users, Box, Factory, LayoutDashboard, List, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { useCX } from '../context/CXContext';
import ModuleActions from '../components/ModuleActions';
import DataManagement from '../components/DataManagement';
import Modal from '../components/Modal';
import { Save } from 'lucide-react';

const usageDataIndividual = [
    { day: 'Mon', active: 45, actions: 240 },
    { day: 'Tue', active: 52, actions: 280 },
    { day: 'Wed', active: 48, actions: 260 },
    { day: 'Thu', active: 61, actions: 320 },
    { day: 'Fri', active: 58, actions: 300 },
    { day: 'Sat', active: 20, actions: 120 },
    { day: 'Sun', active: 18, actions: 100 },
];

const usageDataAggregate = [
    { day: 'Mon', active: 450, actions: 2400 },
    { day: 'Tue', active: 520, actions: 2800 },
    { day: 'Wed', active: 480, actions: 2600 },
    { day: 'Thu', active: 610, actions: 3200 },
    { day: 'Fri', active: 580, actions: 3000 },
    { day: 'Sat', active: 200, actions: 1200 },
    { day: 'Sun', active: 180, actions: 1000 },
];

const touchpoints = {
    Individual: [
        { date: 'Today, 10:24 AM', type: 'Product', label: 'Feature Used: Advanced Analytics', icon: <Zap size={18} />, color: 'var(--accent-primary)' },
        { date: 'Yesterday', type: 'Support', label: 'Support Ticket #8492 Opened', icon: <MessageCircle size={18} />, color: 'var(--danger)' },
        { date: 'Feb 24, 2026', type: 'Website', label: 'Visited API Pricing Page', icon: <Globe size={18} />, color: 'var(--info)' },
        { date: 'Feb 23, 2026', type: 'Docs', label: 'Searched for "Single Sign-On"', icon: <FileSearch size={18} />, color: 'var(--warning)' },
        { date: 'Feb 21, 2026', type: 'Meeting', label: 'Training Workshop Session 2', icon: <Calendar size={18} />, color: 'var(--success)' },
    ],
    Product: [
        { date: 'Today, 11:00 AM', type: 'Core Product', label: 'Spike in API Endpoint Usage', icon: <Zap size={18} />, color: 'var(--accent-primary)' },
        { date: 'Yesterday', type: 'Add-on', label: 'New Signups for Analytics Module', icon: <Users size={18} />, color: 'var(--success)' },
        { date: 'Feb 24, 2026', type: 'Core Product', label: 'Minor Outage Impacted 12 Users', icon: <MessageCircle size={18} />, color: 'var(--danger)' },
    ],
    Feature: [
        { date: 'Today, 09:15 AM', type: 'Reporting', label: 'Custom Report Builder usage up 20%', icon: <FileSearch size={18} />, color: 'var(--info)' },
        { date: 'Yesterday', type: 'Integrations', label: 'Salesforce Sync Errors Reported', icon: <MessageCircle size={18} />, color: 'var(--danger)' },
        { date: 'Feb 22, 2026', type: 'Dashboard', label: 'New Widget Adoption at 45%', icon: <Zap size={18} />, color: 'var(--accent-primary)' },
    ],
    Industry: [
        { date: 'Today', type: 'Healthcare', label: 'Compliance Audit workflow triggered 50x', icon: <Box size={18} />, color: 'var(--warning)' },
        { date: 'Yesterday', type: 'Finance', label: 'Security API Docs viewed heavily', icon: <FileSearch size={18} />, color: 'var(--info)' },
        { date: 'Feb 20, 2026', type: 'Retail', label: 'Q1 E-commerce API Spike', icon: <Globe size={18} />, color: 'var(--success)' },
    ]
};

const JourneyMap = () => {
    const { addToast } = useCX();
    const [viewMode, setViewMode] = useState('Individual');
    const [activeTab, setActiveTab] = useState('Overview');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newTouchpoint, setNewTouchpoint] = useState({ date: '', type: 'Product', label: '' });

    const handleAddTouchpoint = (e) => {
        e.preventDefault();
        addToast(`Touchpoint "${newTouchpoint.label}" added to journey!`, 'success');
        setIsModalOpen(false);
        setNewTouchpoint({ date: '', type: 'Product', label: '' });
    };

    const engagementData = [
        { name: 'Onboarding', score: 85, color: 'var(--success)' },
        { name: 'Adoption', score: 62, color: 'var(--accent-primary)' },
        { name: 'Expansion', score: 45, color: 'var(--warning)' },
        { name: 'Retention', score: 78, color: 'var(--info)' },
    ];

    return (
        <div className="animate-fade-in">
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Customer Journey Mapping</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Visualize product usage insights and engagement touchpoints.</p>
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
                    <List size={18} /> Deep Dive Map
                </button>
            </div>

            {activeTab === 'Overview' ? (
                <>
                    <ModuleActions
                        moduleName="Journey Map"
                        aiInsight="Friction Alert: Onboarding TTV (Time to Value) has increased by 2 days in the Retail sector. Slack engagement is recommended."
                    />
                    <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '2.5rem' }}>
                        <div className="glass-card" style={{ height: '350px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
                                <Activity size={20} color="var(--accent-primary)" />
                                <h3 style={{ fontSize: '1.1rem' }}>Engagement Health Index</h3>
                            </div>
                            <div style={{ width: '100%', height: '250px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={engagementData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                        <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '8px' }} />
                                        <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                                            {engagementData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="glass-card" style={{ height: '350px' }}>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Journey Efficiency</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem' }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>First Value (TTV)</span>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>12.4 Days</span>
                                    </div>
                                    <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                                        <div style={{ width: '75%', height: '100%', background: 'var(--success)', borderRadius: '4px' }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Adoption Velocity</span>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>High (8.2/10)</span>
                                    </div>
                                    <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                                        <div style={{ width: '82%', height: '100%', background: 'var(--accent-primary)', borderRadius: '4px' }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Friction Score</span>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>24%</span>
                                    </div>
                                    <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                                        <div style={{ width: '24%', height: '100%', background: 'var(--danger)', borderRadius: '4px' }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <DataManagement
                        moduleName="Engagement Data"
                        onManualAdd={() => setIsModalOpen(true)}
                    />
                    {/* View Selector Tabs */}
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                        {[
                            { id: 'Individual', icon: <Users size={18} />, label: 'Individual' },
                            { id: 'Product', icon: <Box size={18} />, label: 'Product-wise' },
                            { id: 'Feature', icon: <Zap size={18} />, label: 'Feature-wise' },
                            { id: 'Industry', icon: <Factory size={18} />, label: 'Industry' }
                        ].map(view => (
                            <button
                                key={view.id}
                                className={`btn ${viewMode === view.id ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setViewMode(view.id)}
                                style={{ padding: '8px 16px', borderRadius: '20px', fontSize: '0.85rem' }}
                            >
                                {view.icon} {view.label}
                            </button>
                        ))}
                    </div>

                    <div className="glass-card" style={{ marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3>{viewMode} Usage Insights (Daily)</h3>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Powered by Clarity/Posthog Proxy</span>
                            </div>
                        </div>
                        <div style={{ height: '300px', width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={viewMode === 'Individual' ? usageDataIndividual : usageDataAggregate}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                    <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                                        itemStyle={{ color: 'var(--text-secondary)' }}
                                    />
                                    <Line type="monotone" dataKey="active" stroke="var(--accent-primary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--accent-primary)' }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <h3 style={{ marginBottom: '1.5rem' }}>Engagement Touchpoints ({viewMode} Focus)</h3>
                    <div style={{ position: 'relative', paddingLeft: '4rem' }}>
                        <div style={{ position: 'absolute', left: '19px', top: '0', bottom: '0', width: '2px', background: 'var(--bg-tertiary)' }}></div>
                        {touchpoints[viewMode].map((touch, idx) => (
                            <div key={idx} style={{ position: 'relative', marginBottom: '2rem' }}>
                                <div style={{
                                    position: 'absolute',
                                    left: '-31px',
                                    top: '0',
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    background: 'var(--bg-secondary)',
                                    border: `2px solid ${touch.color}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: touch.color,
                                    zIndex: 2
                                }}>
                                    {touch.icon}
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{touch.date} • {touch.type}</p>
                                    <h4 style={{ fontWeight: 600 }}>{touch.label}</h4>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Log Manual Touchpoint">
                <form onSubmit={handleAddTouchpoint} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="form-group">
                        <label>Touchpoint Label</label>
                        <input
                            type="text"
                            placeholder="e.g. Quarterly Strategic Meeting"
                            value={newTouchpoint.label}
                            onChange={(e) => setNewTouchpoint({ ...newTouchpoint, label: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Category</label>
                        <select
                            value={newTouchpoint.type}
                            onChange={(e) => setNewTouchpoint({ ...newTouchpoint, type: e.target.value })}
                        >
                            <option value="Product">Product Engagement</option>
                            <option value="Meeting">Strategic Meeting</option>
                            <option value="Support">Support Interaction</option>
                            <option value="Marketing">Marketing Event</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Date</label>
                        <input
                            type="date"
                            value={newTouchpoint.date}
                            onChange={(e) => setNewTouchpoint({ ...newTouchpoint, date: e.target.value })}
                            required
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Save size={18} /> Log Touchpoint</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default JourneyMap;
