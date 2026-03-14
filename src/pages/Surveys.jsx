import React, { useState } from 'react';
import { ClipboardCheck, Star, MessageSquare, Quote, Download, Filter, Send, LayoutDashboard, List } from 'lucide-react';
import { useCX } from '../context/CXContext';
import Modal from '../components/Modal';
import ModuleActions from '../components/ModuleActions';
import DataManagement from '../components/DataManagement';

const Surveys = () => {
    const { addToast, surveys, addSurvey } = useCX();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        type: 'NPS',
        audience: 'All Customers',
        distribution: 'Email'
    });

    const handleSend = async (e) => {
        e.preventDefault();
        await addSurvey(formData);
        setIsModalOpen(false);
        setFormData({ title: '', type: 'NPS', audience: 'All Customers', distribution: 'Email' });
    };

    const [activeTab, setActiveTab] = useState('Overview');

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
                        moduleName="Surveys & Feedback"
                        aiInsight="Sentiment Alert: NPS for 'Mobile App' users has dropped 15 points. Key themes in feedback point to 'Sync Latency'. Notifying Product Team."
                    />
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
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Surveys Sent</p>
                            <h3 style={{ fontSize: '2rem' }}>{surveys.length}</h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--info)' }}>Active: {surveys.filter(s => s.status === 'Active').length}</p>
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
                                {surveys.length === 0 ? (
                                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No surveys distributed yet.</p>
                                ) : surveys.map((s, idx) => (
                                    <div key={idx}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.title}</p>
                                            <span style={{ fontSize: '0.75rem', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>{s.status}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                            <span>Sent: {s.sent_count}</span>
                                            <span>Rate: {s.response_rate}</span>
                                        </div>
                                        <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px' }}>
                                            <div style={{ height: '100%', width: s.response_rate, background: 'var(--accent-primary)', borderRadius: '3px' }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <DataManagement
                        moduleName="Global Feedback"
                        onManualAdd={() => setIsModalOpen(true)}
                    />
                    <div className="glass-card" style={{ padding: '0' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>DATE</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>CUSTOMER</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>SURVEY TYPE</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>NPS / SCORE</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>FEEDBACK PREVIEW</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', transition: '0.2s' }}>
                                    <td style={{ padding: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Feb 20, 2026</td>
                                    <td style={{ padding: '1.25rem', fontWeight: 600 }}>Acme Corp</td>
                                    <td style={{ padding: '1.25rem' }}>NPS Score</td>
                                    <td style={{ padding: '1.25rem' }}>
                                        <span className="badge badge-success">10 (Promoter)</span>
                                    </td>
                                    <td style={{ padding: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        "Platform is incredibly easy to use. I saved at least 5 hours this week."
                                    </td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', transition: '0.2s' }}>
                                    <td style={{ padding: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Feb 18, 2026</td>
                                    <td style={{ padding: '1.25rem', fontWeight: 600 }}>Stark Industries</td>
                                    <td style={{ padding: '1.25rem' }}>Feature Request</td>
                                    <td style={{ padding: '1.25rem' }}>
                                        <span className="badge badge-warning">6 (Detractor)</span>
                                    </td>
                                    <td style={{ padding: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        "Missing native Jira integration which makes syncing a pain..."
                                    </td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', transition: '0.2s' }}>
                                    <td style={{ padding: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Jan 12, 2026</td>
                                    <td style={{ padding: '1.25rem', fontWeight: 600 }}>Globex</td>
                                    <td style={{ padding: '1.25rem' }}>CSAT Survey</td>
                                    <td style={{ padding: '1.25rem' }}>
                                        <div style={{ display: 'flex', gap: '2px' }}>
                                            {[1, 2, 3, 4, 5].map(s => <Star key={s} size={14} fill={s <= 5 ? 'var(--warning)' : 'none'} color={s <= 5 ? 'var(--warning)' : 'var(--text-muted)'} />)}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        "Support agent Mike was fantastic and fixed our issue immediately."
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </>
            )}

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
