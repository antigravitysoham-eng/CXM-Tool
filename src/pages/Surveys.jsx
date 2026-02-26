import React, { useState } from 'react';
import { ClipboardCheck, Star, MessageSquare, Quote, Download, Filter, Send } from 'lucide-react';
import { useCX } from '../context/CXContext';
import Modal from '../components/Modal';

const Surveys = () => {
    const { addToast } = useCX();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        type: 'NPS',
        audience: 'All Customers',
        distribution: 'Email'
    });

    const handleSend = (e) => {
        e.preventDefault();
        addToast(`Survey "${formData.title}" has been scheduled for distribution!`, 'success');
        setIsModalOpen(false);
        setFormData({ title: '', type: 'NPS', audience: 'All Customers', distribution: 'Email' });
    };

    return (
        <div className="animate-fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Surveys & Feedback</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>NPS, CSAT, and Quarterly Customer Testimonials.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-ghost"><Download size={18} /> Export Data</button>
                    <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                        <ClipboardCheck size={18} /> Send New Survey
                    </button>
                </div>
            </header>

            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '2.5rem' }}>
                <div className="glass-card" style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Avg NPS Score</p>
                    <h3 style={{ fontSize: '2.5rem', color: 'var(--accent-primary)' }}>+72</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Legendary Range</p>
                </div>
                <div className="glass-card" style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>CSAT Rating</p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '0.5rem' }}>
                        {[1, 2, 3, 4, 5].map(s => <Star key={s} size={18} fill={s <= 4 ? 'var(--warning)' : 'none'} color={s <= 4 ? 'var(--warning)' : 'var(--text-muted)'} />)}
                    </div>
                    <h3 style={{ fontSize: '1.25rem' }}>4.8 / 5.0</h3>
                </div>
                <div className="glass-card" style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Response Rate</p>
                    <h3 style={{ fontSize: '2rem' }}>42%</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Industry avg: 15%</p>
                </div>
                <div className="glass-card" style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Testimonials</p>
                    <h3 style={{ fontSize: '2rem' }}>24</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--info)' }}>New this quarter: 5</p>
                </div>
            </div>

            <div className="dashboard-grid" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
                <div className="glass-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3>Customer Testimonials</h3>
                        <button className="btn-ghost" style={{ fontSize: '0.8rem' }}><Filter size={14} /> Filter by Sentiment</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {[
                            { name: 'Marcus Chen', company: 'Global Tech', text: 'The CX team has been instrumental in our digital transformation. The proactive EBRs helped us identify $200k in potential savings through optimization.', rating: 5 },
                            { name: 'Diana Prince', company: 'Themyscira Inc', text: 'Stellar onboarding. The personalized training sessions meant our team was productive in days, not weeks.', rating: 5 },
                            { name: 'Bruce Wayne', company: 'Wayne Ent', text: 'Reliable platform and exceptional support engagement. Their feedback loop on feature requests is actually genuine.', rating: 4 },
                        ].map((t, idx) => (
                            <div key={idx} className="glass" style={{ padding: '1.5rem', borderRadius: '12px', position: 'relative' }}>
                                <Quote size={24} color="var(--accent-primary)" style={{ opacity: 0.2, position: 'absolute', top: '1rem', right: '1rem' }} />
                                <div style={{ display: 'flex', gap: '4px', marginBottom: '0.75rem' }}>
                                    {[1, 2, 3, 4, 5].map(s => <Star key={s} size={14} fill={s <= t.rating ? 'var(--warning)' : 'none'} color={s <= t.rating ? 'var(--warning)' : 'var(--text-muted)'} />)}
                                </div>
                                <p style={{ fontSize: '0.95rem', fontStyle: 'italic', marginBottom: '1rem', color: 'var(--text-secondary)' }}>"{t.text}"</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>{t.name.split(' ').map(n => n[0]).join('')}</div>
                                    <div>
                                        <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t.name}</p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.company}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="glass-card">
                    <h3 style={{ marginBottom: '1.5rem' }}>Survey Distribution</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {[
                            { label: 'Q1 NPS Health Check', sent: 500, response: '45%', status: 'Closing' },
                            { label: 'Platform 2.0 UX Feedback', sent: 1200, response: '32%', status: 'Active' },
                            { label: 'Post-Onboarding Satisfaction', sent: 85, response: '88%', status: 'Recurring' },
                        ].map((s, idx) => (
                            <div key={idx}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.label}</p>
                                    <span style={{ fontSize: '0.75rem', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>{s.status}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                    <span>Sent: {s.sent}</span>
                                    <span>Rate: {s.response}</span>
                                </div>
                                <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px' }}>
                                    <div style={{ height: '100%', width: s.response, background: 'var(--accent-primary)', borderRadius: '3px' }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Send New Survey">
                <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="form-group">
                        <label>Survey Title</label>
                        <input
                            type="text"
                            placeholder="e.g. Q3 Customer Satisfaction"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Survey Type</label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        >
                            <option value="NPS">NPS (Net Promoter Score)</option>
                            <option value="CSAT">CSAT (Customer Satisfaction)</option>
                            <option value="CES">CES (Customer Effort Score)</option>
                            <option value="Testimonial">Testimonial Request</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Target Audience</label>
                        <select
                            value={formData.audience}
                            onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                        >
                            <option value="All Customers">All Customers</option>
                            <option value="Enterpise Only">Enterpise Only</option>
                            <option value="Recently Onboarded">Recently Onboarded</option>
                            <option value="At Risk Accounts">At Risk Accounts</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Distribution Channel</label>
                        <select
                            value={formData.distribution}
                            onChange={(e) => setFormData({ ...formData, distribution: e.target.value })}
                        >
                            <option value="Email">Email Blast</option>
                            <option value="In-App">In-App Pop-up</option>
                            <option value="Slack">Slack Notification</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Send size={18} /> Schedule Survey</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Surveys;
