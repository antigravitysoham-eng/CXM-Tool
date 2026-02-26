import React, { useState } from 'react';
import { Mail, Send, Calendar, Users, Eye, MousePointer2, Save } from 'lucide-react';
import { useCX } from '../context/CXContext';
import Modal from '../components/Modal';

const Comms = () => {
    const { addToast } = useCX();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        date: '',
        type: 'Newsletter',
        audience: 'All Customers'
    });

    const handleCreate = (e) => {
        e.preventDefault();
        addToast(`Campaign "${formData.title}" has been scheduled!`, 'success');
        setIsModalOpen(false);
        setFormData({ title: '', date: '', type: 'Newsletter', audience: 'All Customers' });
    };

    return (
        <div className="animate-fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Communications & Newsletters</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage monthly updates, release notes, and special occasion wishes.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                    <Send size={18} /> Create Newsletter
                </button>
            </header>

            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '2.5rem' }}>
                <div className="glass-card">
                    <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem' }}>Total Subscribers</h4>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <h3 style={{ fontSize: '2rem' }}>4,280</h3>
                        <span style={{ color: 'var(--success)', fontSize: '0.85rem' }}>+12% vs last mo</span>
                    </div>
                </div>
                <div className="glass-card">
                    <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem' }}>Avg. Open Rate</h4>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <h3 style={{ fontSize: '2rem' }}>38.5%</h3>
                        <span style={{ color: 'var(--info)', fontSize: '0.85rem' }}>Industry: 22%</span>
                    </div>
                </div>
                <div className="glass-card">
                    <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem' }}>Click Rate</h4>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <h3 style={{ fontSize: '2rem' }}>8.2%</h3>
                        <span style={{ color: 'var(--accent-primary)', fontSize: '0.85rem' }}>Next: Mar 01</span>
                    </div>
                </div>
            </div>

            <div className="glass-card" style={{ padding: '0' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '1.1rem' }}>Campaign Calendar & Status</h3>
                </div>
                <div style={{ padding: '1.5rem' }}>
                    {[
                        { title: 'February Platform Release Updates', date: 'Feb 12, 2026', sent: 4200, open: '42%', click: '12%', status: 'Sent' },
                        { title: 'March Monthly CX Newsletter', date: 'Mar 02, 2026', sent: 4350, open: 'N/A', click: 'N/A', status: 'Scheduled' },
                        { title: 'Annual Security Governance Update', date: 'Feb 26, 2026', sent: 120, open: '85%', click: '45%', status: 'In Flight' },
                        { title: 'Customer Appreciation Week - EMEA', date: 'Feb 15, 2026', sent: 850, open: '38%', click: '10%', status: 'Sent' },
                    ].map((comm, idx) => (
                        <div key={idx} className="glass" style={{ marginBottom: '1rem', padding: '1.25rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                                <div style={{ width: '40px', height: '40px', background: 'var(--bg-tertiary)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                                    <Mail size={18} />
                                </div>
                                <div>
                                    <h4 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>{comm.title}</h4>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}><Calendar size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> {comm.date}</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '3rem', alignItems: 'center' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>OPEN RATE</p>
                                    <p style={{ fontWeight: 700 }}>{comm.open}</p>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>CLICKS</p>
                                    <p style={{ fontWeight: 700 }}>{comm.click}</p>
                                </div>
                                <span className={`badge ${comm.status === 'Sent' ? 'badge-success' : comm.status === 'Scheduled' ? 'badge-info' : 'badge-warning'}`} style={{ fontSize: '0.7rem' }}>{comm.status}</span>
                                <button className="btn-ghost" style={{ padding: '8px' }} onClick={() => addToast(`Previewing: ${comm.title}`, 'info')}>
                                    <Eye size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Campaign">
                <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="form-group">
                        <label>Campaign Title</label>
                        <input
                            type="text"
                            placeholder="e.g. Q1 Product Roadmap Update"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Target Send Date</label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Campaign Type</label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        >
                            <option value="Newsletter">Monthly Newsletter</option>
                            <option value="ReleaseNotes">Release Notes</option>
                            <option value="Event">Event Invitation</option>
                            <option value="Urgent">Urgent Security Notice</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Audience Segment</label>
                        <select
                            value={formData.audience}
                            onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                        >
                            <option value="All Customers">All Customers</option>
                            <option value="Admins">Admins Only</option>
                            <option value="EMEA">EMEA Region</option>
                            <option value="Enterprise">Enterprise Accounts</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Send size={18} /> Schedule Campaign</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Comms;
