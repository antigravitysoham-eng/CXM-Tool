import React, { useState } from 'react';
import { Calendar, MapPin, Users, TrendingUp, Filter, Plus, ExternalLink, Save, LayoutDashboard, Database, PieChart as PieChartIcon, BarChart3 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useCX } from '../context/CXContext';
import Modal from '../components/Modal';
import ModuleActions from '../components/ModuleActions';
import DataManagement from '../components/DataManagement';

const Events = () => {
    const { addToast, events, addEvent } = useCX();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        date: '',
        type: 'Webinar',
        budget: ''
    });

    const handlePlan = async (e) => {
        e.preventDefault();
        await addEvent(formData);
        setIsModalOpen(false);
        setFormData({ title: '', date: '', type: 'Webinar', budget: '' });
    };

    const [activeTab, setActiveTab] = useState('Overview');

    const typeData = [
        { name: 'Webinar', value: events.filter(e => e.type === 'Webinar').length, color: 'var(--accent-primary)' },
        { name: 'Workshop', value: events.filter(e => e.type === 'Workshop').length, color: 'var(--info)' },
        { name: 'Dinner', value: events.filter(e => e.type === 'Dinner').length, color: 'var(--success)' },
        { name: 'Conference', value: events.filter(e => e.type === 'Conference').length, color: 'var(--warning)' },
    ].filter(d => d.value > 0);

    const registrationData = events.map(e => ({
        name: e.title.substring(0, 8),
        registrations: e.attendees
    })).slice(-5);

    return (
        <div className="animate-fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Engagement Event Planner</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Coordinate workshops, webinars, and field events with marketing tools.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                    <Plus size={18} /> Plan New Event
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
                    <Database size={18} /> Deep Dive Planner
                </button>
            </div>

            {activeTab === 'Overview' ? (
                <>
                    <ModuleActions
                        moduleName="Field Events"
                        aiInsight="Event Impact: 'Executive Dinner' events drive a 25% higher renewal rate. Recommend scheduling 2 dinners for the West Coast accounts in Q3."
                    />
                    <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '2.5rem' }}>
                        <div className="glass-card">
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Total Planned Events</p>
                            <h3 style={{ fontSize: '1.5rem' }}>{events.length}</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--info)' }}>Next: {events[0]?.title || 'None'}</p>
                        </div>
                        <div className="glass-card">
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Total Registrations</p>
                            <h3 style={{ fontSize: '1.5rem' }}>{events.reduce((sum, e) => sum + (e.attendees || 0), 0)}</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--success)' }}>+18% vs goal</p>
                        </div>
                        <div className="glass-card">
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Budget Utilization</p>
                            <h3 style={{ fontSize: '1.5rem' }}>$42.5k</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--warning)' }}>72% of quarterly budget</p>
                        </div>
                    </div>

                    <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1.5fr' }}>
                        <div className="glass-card" style={{ height: '350px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
                                <PieChartIcon size={20} color="var(--accent-primary)" />
                                <h3 style={{ fontSize: '1.1rem' }}>Event Mix</h3>
                            </div>
                            <div style={{ width: '100%', height: '250px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={typeData} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                                            {typeData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '8px' }} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="glass-card" style={{ height: '350px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
                                <BarChart3 size={20} color="var(--info)" />
                                <h3 style={{ fontSize: '1.1rem' }}>Registration Volume</h3>
                            </div>
                            <div style={{ width: '100%', height: '250px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={registrationData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                        <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                                        <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                                        <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '8px' }} />
                                        <Bar name="Attendees" dataKey="registrations" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <DataManagement
                        moduleName="Event Planner"
                        onManualAdd={() => setIsModalOpen(true)}
                    />
                    <div className="dashboard-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
                        <div className="glass-card">
                            <h3 style={{ marginBottom: '1.5rem' }}>Upcoming Engagement Events</h3>
                            {events.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No events planned.</p>
                            ) : events.map((ev, idx) => (
                                <div key={idx} className="glass" style={{ marginBottom: '1rem', padding: '1.25rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                                            <Calendar size={24} />
                                        </div>
                                        <div>
                                            <h4 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>{ev.title}</h4>
                                            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} /> {ev.type}</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={12} /> {ev.attendees} Registered</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                                        <span className={`badge ${ev.status === 'Confirmed' ? 'badge-success' : ev.status === 'Confirmed' ? 'badge-success' : 'badge-info'}`} style={{ fontSize: '0.65rem' }}>{ev.status}</span>
                                        <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => addToast(`Opening management dashboard for ${ev.title}`, 'info')}>
                                            Manage
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="glass-card">
                            <h3 style={{ marginBottom: '1.5rem' }}>Marketing Alignment</h3>
                            <div style={{ padding: '1.5rem', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                                    <TrendingUp size={16} color="var(--accent-primary)" /> Campaign Influence
                                </h4>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                                    The "Security Efficiency" campaign has influenced **12 upsell opportunities** totaling **$145k** this month.
                                </p>
                                <button className="btn-ghost" style={{ fontSize: '0.85rem', width: '100%', justifyContent: 'center' }} onClick={() => window.open('https://google.com', '_blank')}>
                                    View MQL Report <ExternalLink size={14} />
                                </button>
                            </div>

                            <div style={{ marginTop: '1.5rem' }}>
                                <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Resource Sharing</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <button className="sidebar-link" style={{ background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }} onClick={() => addToast('Downloading Q1 Product Roadmap Deck...', 'success')}>
                                        📄 Q1 Product Roadmap Deck
                                    </button>
                                    <button className="sidebar-link" style={{ background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }} onClick={() => addToast('Downloading Customer Reference Template...', 'success')}>
                                        📄 Customer Reference Template
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Plan New Engagement Event">
                <form onSubmit={handlePlan} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="form-group">
                        <label>Event Title</label>
                        <input
                            type="text"
                            placeholder="e.g. Regional User Group - NYC"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Event Date</label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Event Type</label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        >
                            <option value="Webinar">Webinar</option>
                            <option value="Workshop">Hands-on Workshop</option>
                            <option value="Dinner">Executive Dinner</option>
                            <option value="Conference">Conference Booth</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Allocated Budget</label>
                        <input
                            type="text"
                            placeholder="e.g. $5,000"
                            value={formData.budget}
                            onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                            required
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Plus size={18} /> Schedule Event</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Events;
