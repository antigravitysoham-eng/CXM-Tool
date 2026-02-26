import React from 'react';
import { LifeBuoy, Clock, MessageSquare, AlertCircle, BarChart3, ArrowUpRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const ticketData = [
    { name: 'Open', value: 45, color: 'var(--accent-primary)' },
    { name: 'Pending', value: 24, color: 'var(--warning)' },
    { name: 'Resolved', value: 156, color: 'var(--success)' },
    { name: 'Overdue', value: 8, color: 'var(--danger)' },
];

const SupportMetrics = () => {
    return (
        <div className="animate-fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Support Metrics</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Zoho Desk integration: Ticket volume, resolution times, and CSAT.</p>
                </div>
                <button className="btn btn-ghost" onClick={() => window.open('https://desk.zoho.com', '_blank')}>Open Zoho Desk <ArrowUpRight size={14} /></button>
            </header>

            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '2.5rem' }}>
                <div className="glass-card">
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Avg. Response Time</p>
                    <h3 style={{ fontSize: '1.5rem' }}>1.4 hrs</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--success)' }}>-15% from last week</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="glass-card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Escalated</span>
                        <span style={{ fontWeight: 700, color: 'var(--danger)' }}>3</span>
                    </div>
                    <div className="glass-card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>First Contact Res.</span>
                        <span style={{ fontWeight: 700, color: 'var(--success)' }}>82%</span>
                    </div>
                </div>
                <div className="glass-card">
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Customer Health (Support)</p>
                    <h3 style={{ fontSize: '1.5rem' }}>Stable</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Based on ticket sentiment</p>
                </div>
                <div className="glass-card">
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Total Tickets (30d)</p>
                    <h3 style={{ fontSize: '1.5rem' }}>412</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--info)' }}>+5% growth</p>
                </div>
            </div>

            <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1.5fr' }}>
                <div className="glass-card">
                    <h3 style={{ marginBottom: '1.5rem' }}>Ticket Status Distribution</h3>
                    <div style={{ height: '250px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={ticketData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis hide />
                                <Tooltip
                                    contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                    {ticketData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-card">
                    <h3 style={{ marginBottom: '1.5rem' }}>Critical Tickets (Action Required)</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {[
                            { id: '#8492', account: 'Acme Corp', subject: 'Production outage in US-East-1', urgency: 'Critical', time: '2h ago' },
                            { id: '#8488', account: 'Global Tech', subject: 'SSO configuration failure', urgency: 'High', time: '5h ago' },
                            { id: '#8480', account: 'Nexus Solutions', subject: 'Billing enquiry - Missing invoice', urgency: 'Medium', time: '1d ago' },
                        ].map((ticket, idx) => (
                            <div key={idx} className="glass" style={{ padding: '1rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <div style={{ color: ticket.urgency === 'Critical' ? 'var(--danger)' : 'var(--warning)' }}>
                                        <AlertCircle size={20} />
                                    </div>
                                    <div>
                                        <h4 style={{ fontSize: '0.9rem' }}>{ticket.subject}</h4>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ticket.account} • {ticket.id}</p>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span className={`badge ${ticket.urgency === 'Critical' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.6rem', marginBottom: '4px', display: 'inline-block' }}>{ticket.urgency}</span>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{ticket.time}</p>
                                </div>
                            </div>
                        ))}
                        <button className="btn btn-ghost" style={{ width: '100%', padding: '10px' }}>View All Tickets</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SupportMetrics;
