import React, { useState } from 'react';
import { Zap, ThumbsUp, MessageSquare, TrendingUp, Filter, Search, Plus, Save } from 'lucide-react';
import { useCX } from '../context/CXContext';
import Modal from '../components/Modal';

const FeatureRequests = () => {
    const { addToast } = useCX();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        account: '',
        impact: 'Medium',
        description: ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        addToast(`Feature request "${formData.title}" has been submitted and tagged for review!`, 'success');
        setIsModalOpen(false);
        setFormData({ title: '', account: '', impact: 'Medium', description: '' });
    };

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

            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '2.5rem' }}>
                <div className="glass-card">
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Total Requests</p>
                    <h3 style={{ fontSize: '1.5rem' }}>142</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--info)' }}>32 Planned for Q2</p>
                </div>
                <div className="glass-card">
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Expansion Potential</p>
                    <h3 style={{ fontSize: '1.5rem' }}>$420k</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--success)' }}>Revenue Impact Opportunity</p>
                </div>
                <div className="glass-card">
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Avg. Votes / Request</p>
                    <h3 style={{ fontSize: '1.5rem' }}>18</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Engagement up 15%</p>
                </div>
            </div>

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
                    {[
                        { title: 'Advanced Role-Based Access Control', status: 'Planned', votes: 45, impact: 'High', account: 'Global Tech' },
                        { title: 'Batch Export to AWS S3', status: 'Review', votes: 28, impact: 'Medium', account: 'Acme Corp' },
                        { title: 'Custom Widget Dashboard API', status: 'In Development', votes: 112, impact: 'Critical', account: 'Multiple' },
                        { title: 'Mobile App Push Notifications', status: 'Gathering Interest', votes: 64, impact: 'High', account: 'Cloud Nine' },
                    ].map((req, idx) => (
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
                                <button className="btn btn-ghost" style={{ padding: '8px', borderRadius: '8px' }} onClick={() => addToast(`Upvoted: ${req.title}`, 'info')}>
                                    <ThumbsUp size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

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
        </div>
    );
};

export default FeatureRequests;
