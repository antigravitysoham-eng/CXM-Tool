import React, { useState } from 'react';
import { LifeBuoy, Clock, MessageSquare, AlertCircle, BarChart3, ArrowUpRight, LayoutDashboard, Database, TrendingUp, PieChart as PieChartIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, PieChart, Pie, Legend } from 'recharts';
import { useCX } from '../context/CXContext';
import ModuleActions from '../components/ModuleActions';
import DataManagement from '../components/DataManagement';
import Modal from '../components/Modal';
import { Save } from 'lucide-react';

const ticketData = [
    { name: 'Open', value: 45, color: 'var(--accent-primary)' },
    { name: 'Pending', value: 24, color: 'var(--warning)' },
    { name: 'Resolved', value: 156, color: 'var(--success)' },
    { name: 'Overdue', value: 8, color: 'var(--danger)' },
];

const categoryData = [
    { name: 'Technical', value: 40, color: 'var(--accent-primary)' },
    { name: 'Billing', value: 25, color: 'var(--info)' },
    { name: 'Feature Req', value: 20, color: 'var(--success)' },
    { name: 'Others', value: 15, color: 'var(--warning)' },
];

const trendData = [
    { time: 'Mon', value: 2.1 },
    { time: 'Tue', value: 1.8 },
    { time: 'Wed', value: 1.4 },
    { time: 'Thu', value: 1.6 },
    { time: 'Fri', value: 1.2 },
];

const SupportMetrics = () => {
    const { addToast } = useCX();
    const [activeTab, setActiveTab] = useState('Overview');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newTicket, setNewTicket] = useState({ account: '', subject: '', urgency: 'Medium' });

    const handleAddTicket = (e) => {
        e.preventDefault();
        addToast(`Ticket for ${newTicket.account} logged successfully!`, 'success');
        setIsModalOpen(false);
        setNewTicket({ account: '', subject: '', urgency: 'Medium' });
    };
    return (
        <div className="animate-fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Support Metrics</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Zoho Desk integration: Ticket volume, resolution times, and CSAT.</p>
                </div>
                <button className="btn btn-ghost" onClick={() => window.open('https://desk.zoho.com', '_blank')}>Open Zoho Desk <ArrowUpRight size={14} /></button>
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
                    <Database size={18} /> Deep Dive Tickets
                </button>
            </div>

            {activeTab === 'Overview' ? (
                <>
                    <ModuleActions
                        moduleName="Support Metrics"
                        aiInsight="Support Anomaly: Acme Corp has opened 4 critical tickets in 48 hours. This correlates with their recent 'API V2' migration. Escalating to Engineering."
                    />
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

                    <div className="dashboard-grid" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
                        <div className="glass-card" style={{ height: '350px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
                                <TrendingUp size={20} color="var(--accent-primary)" />
                                <h3 style={{ fontSize: '1.1rem' }}>Response Time Trend (hrs)</h3>
                            </div>
                            <div style={{ width: '100%', height: '250px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trendData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                        <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                                        <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                                        <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '8px' }} />
                                        <Line type="monotone" dataKey="value" stroke="var(--accent-primary)" strokeWidth={3} dot={{ r: 4 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="glass-card" style={{ height: '350px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
                                <PieChartIcon size={20} color="var(--info)" />
                                <h3 style={{ fontSize: '1.1rem' }}>Ticket Categories</h3>
                            </div>
                            <div style={{ width: '100%', height: '250px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={categoryData} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                                            {categoryData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '8px' }} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <DataManagement
                        moduleName="Zoho Tickets"
                        onManualAdd={() => setIsModalOpen(true)}
                    />
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
                </>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Log Manual Ticket">
                <form onSubmit={handleAddTicket} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="form-group">
                        <label>Account Name</label>
                        <input
                            type="text"
                            placeholder="e.g. Acme Corp"
                            value={newTicket.account}
                            onChange={(e) => setNewTicket({ ...newTicket, account: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Subject</label>
                        <input
                            type="text"
                            placeholder="e.g. Cannot access billing portal"
                            value={newTicket.subject}
                            onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Urgency</label>
                        <select
                            value={newTicket.urgency}
                            onChange={(e) => setNewTicket({ ...newTicket, urgency: e.target.value })}
                        >
                            <option value="Critical">Critical</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Save size={18} /> Log Ticket</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default SupportMetrics;
