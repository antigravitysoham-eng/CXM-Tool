import React from 'react';
import { Map, Zap, Calendar, MousePointer2, Globe, FileSearch, MessageCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const usageData = [
    { day: 'Mon', active: 450, actions: 2400 },
    { day: 'Tue', active: 520, actions: 2800 },
    { day: 'Wed', active: 480, actions: 2600 },
    { day: 'Thu', active: 610, actions: 3200 },
    { day: 'Fri', active: 580, actions: 3000 },
    { day: 'Sat', active: 200, actions: 1200 },
    { day: 'Sun', active: 180, actions: 1000 },
];

const JourneyMap = () => {
    return (
        <div className="animate-fade-in">
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Customer Journey Map</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Visualize product usage insights and engagement touchpoints for **Acme Corp**.</p>
            </header>

            <div className="glass-card" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3>Product Usage Insights (Daily)</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Powered by Clarity/Posthog Proxy</span>
                    </div>
                </div>
                <div style={{ height: '300px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={usageData}>
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

            <h3 style={{ marginBottom: '1.5rem' }}>Engagement Touchpoints</h3>
            <div style={{ position: 'relative', paddingLeft: '4rem' }}>
                <div style={{ position: 'absolute', left: '19px', top: '0', bottom: '0', width: '2px', background: 'var(--bg-tertiary)' }}></div>
                {[
                    { date: 'Today, 10:24 AM', type: 'Product', label: 'Feature Used: Advanced Analytics', icon: <Zap size={18} />, color: 'var(--accent-primary)' },
                    { date: 'Yesterday', type: 'Support', label: 'Support Ticket #8492 Opened', icon: <MessageCircle size={18} />, color: 'var(--danger)' },
                    { date: 'Feb 24, 2026', type: 'Website', label: 'Visited API Pricing Page', icon: <Globe size={18} />, color: 'var(--info)' },
                    { date: 'Feb 23, 2026', type: 'Docs', label: 'Searched for "Single Sign-On"', icon: <FileSearch size={18} />, color: 'var(--warning)' },
                    { date: 'Feb 21, 2026', type: 'Meeting', label: 'Training Workshop Session 2', icon: <Calendar size={18} />, color: 'var(--success)' },
                ].map((touch, idx) => (
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
        </div>
    );
};

export default JourneyMap;
