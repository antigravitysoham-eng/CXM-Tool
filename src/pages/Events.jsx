import React, { useState } from 'react';
import { Calendar, MapPin, Users, TrendingUp, Filter, Plus, ExternalLink, Save } from 'lucide-react';
import { useCX } from '../context/CXContext';
import Modal from '../components/Modal';

const Events = () => {
    const { addToast } = useCX();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        date: '',
        type: 'Webinar',
        budget: ''
    });

    const handlePlan = (e) => {
        e.preventDefault();
        addToast(`Event "${formData.title}" has been added to the planner!`, 'success');
        setIsModalOpen(false);
        setFormData({ title: '', date: '', type: 'Webinar', budget: '' });
    };

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

            <div className="dashboard-grid" style={{ gridTemplateColumns: '2fr 1fr', marginBottom: '2.5rem' }}>
                <div className="glass-card">
                    <h3 style={{ marginBottom: '1.5rem' }}>Upcoming Engagement Events</h3>
                    {[
                        { title: 'Q1 Product Steering Committee', date: 'Mar 15, 2026', type: 'Virtual Workshop', attendees: '45/50', status: 'Confirmed' },
                        { title: 'Executive Dinner - London', date: 'Mar 24, 2026', type: 'In-Person', attendees: '12/15', status: 'Planning' },
                        { title: 'Best Practices Webinar: Security', date: 'Apr 05, 2026', type: 'Webinar', attendees: '256', status: 'Active' },
                    ].map((ev, idx) => (
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
                                <span className={`badge ${ev.status === 'Confirmed' ? 'badge-success' : 'badge-info'}`} style={{ fontSize: '0.65rem' }}>{ev.status}</span>
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
