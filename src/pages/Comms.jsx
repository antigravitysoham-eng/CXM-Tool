import React, { useState } from 'react';
import { Mail, Send, Calendar, Users, Eye, MousePointer2, Save, Play, Pause, Zap, LayoutDashboard, List, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useCX } from '../context/CXContext';
import Modal from '../components/Modal';
import ModuleActions from '../components/ModuleActions';
import DataManagement from '../components/DataManagement';

const Comms = () => {
    const { addToast, comms, addComm, personaTriggers = [], addPersonaTrigger } = useCX();
    const [isNewsletterModalOpen, setIsNewsletterModalOpen] = useState(false);
    const [isTriggerModalOpen, setIsTriggerModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        date: '',
        type: 'Newsletter',
        audience: 'All Customers'
    });

    const handleCreate = async (e) => {
        e.preventDefault();
        await addComm(formData);
        setIsNewsletterModalOpen(false);
        setFormData({ title: '', date: '', type: 'Newsletter', audience: 'All Customers' });
    };

    const [triggerData, setTriggerData] = useState({
        persona: 'Admin',
        trigger: '',
        template: ''
    });

    const handleCreateTrigger = (e) => {
        e.preventDefault();
        addPersonaTrigger({
            ...triggerData,
            status: 'Active'
        });
        setIsTriggerModalOpen(false);
        setTriggerData({ persona: 'Admin', trigger: '', template: '' });
    };

    const [activeTab, setActiveTab] = useState('Overview');

    const funnelData = comms.map(c => ({
        name: c.title.substring(0, 10),
        opens: parseInt(c.open_rate) || 0,
        clicks: parseInt(c.click_rate) || 0,
    })).slice(-5);

    return (
        <div className="animate-fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Communications & Triggers</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage newsletters and persona-based automated mail triggers.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-ghost" onClick={() => setIsTriggerModalOpen(true)}>
                        <Zap size={18} /> New Trigger
                    </button>
                    <button className="btn btn-primary" onClick={() => setIsNewsletterModalOpen(true)}>
                        <Send size={18} /> Create Newsletter
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
                    <List size={18} /> Deep Dive Campaigns
                </button>
            </div>

            {activeTab === 'Overview' ? (
                <>
                    <ModuleActions
                        moduleName="Communications"
                        aiInsight="Email Deliverability is healthy (99%). Predictive AI suggests targeting 'Champions' with a 'New Feature Beta' campaign to drive early adoption."
                    />
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
                            <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem' }}>Campaigns</h4>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <h3 style={{ fontSize: '2rem' }}>{comms.length}</h3>
                                <span style={{ color: 'var(--accent-primary)', fontSize: '0.85rem' }}>Scheduled: {comms.filter(c => c.status === 'Scheduled').length}</span>
                            </div>
                        </div>
                    </div>

                    <div className="dashboard-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
                        <div className="glass-card" style={{ height: '400px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
                                <TrendingUp size={20} color="var(--accent-primary)" />
                                <h3 style={{ fontSize: '1.1rem' }}>Campaign Performance Funnel</h3>
                            </div>
                            <div style={{ width: '100%', height: '300px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={funnelData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                        <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                                        <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
                                        <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '8px' }} />
                                        <Legend />
                                        <Line name="Open Rate" type="monotone" dataKey="opens" stroke="var(--accent-primary)" strokeWidth={3} dot={{ r: 4 }} />
                                        <Line name="Click Rate" type="monotone" dataKey="clicks" stroke="var(--success)" strokeWidth={3} dot={{ r: 4 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="glass-card" style={{ height: '400px' }}>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Audience Health</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Engagement Score</span>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>72%</span>
                                    </div>
                                    <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                                        <div style={{ width: '72%', height: '100%', background: 'var(--accent-primary)', borderRadius: '4px' }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Unsubscribe Rate</span>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>0.8%</span>
                                    </div>
                                    <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                                        <div style={{ width: '8%', height: '100%', background: 'var(--success)', borderRadius: '4px' }}></div>
                                    </div>
                                </div>
                                <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>TOP PERFORMING SEGMENT</p>
                                    <p style={{ fontWeight: 600, color: 'var(--accent-secondary)' }}>Technical Leads (EME)</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--success)' }}>+45% avg engagement</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <DataManagement
                        moduleName="Campaigns & Triggers"
                        onManualAdd={() => setIsNewsletterModalOpen(true)}
                    />
                    <div className="glass-card" style={{ padding: '0' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ fontSize: '1.1rem' }}>Campaign Calendar & Status</h3>
                        </div>
                        <div style={{ padding: '1.5rem' }}>
                            {comms.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No campaigns found.</p>
                            ) : comms.map((comm, idx) => (
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
                                            <p style={{ fontWeight: 700 }}>{comm.open_rate}</p>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>CLICKS</p>
                                            <p style={{ fontWeight: 700 }}>{comm.click_rate}</p>
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

                    <div className="glass-card" style={{ padding: '0', marginTop: '2.5rem' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '1.1rem' }}>Persona-Based Mail Triggers</h3>
                            <span className="badge badge-info">{personaTriggers.length} Active Rules</span>
                        </div>
                        <div style={{ padding: '1.5rem' }}>
                            {personaTriggers.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No persona triggers configured.</p>
                            ) : personaTriggers.map((trigger, idx) => (
                                <div key={idx} className="glass" style={{ marginBottom: '1rem', padding: '1.25rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                                        <div style={{ width: '40px', height: '40px', background: 'var(--bg-tertiary)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                                            <Users size={18} />
                                        </div>
                                        <div>
                                            <h4 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Persona: {trigger.persona}</h4>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                <Zap size={12} style={{ verticalAlign: 'middle', marginRight: '4px', color: 'var(--warning)' }} />
                                                Trigger: {trigger.trigger}
                                            </p>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '3rem', alignItems: 'center' }}>
                                        <div>
                                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>TEMPLATE</p>
                                            <p style={{ fontWeight: 600, fontSize: '0.85rem' }}>{trigger.template}</p>
                                        </div>
                                        <span className={`badge ${trigger.status === 'Active' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.7rem', width: '60px', textAlign: 'center' }}>{trigger.status}</span>
                                        <button className="btn-ghost" style={{ padding: '8px' }} onClick={() => addToast(`Toggled trigger for ${trigger.persona}`, 'info')}>
                                            {trigger.status === 'Active' ? <Pause size={18} color="var(--text-muted)" /> : <Play size={18} color="var(--success)" />}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            <Modal isOpen={isNewsletterModalOpen} onClose={() => setIsNewsletterModalOpen(false)} title="Create New Campaign">
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
                        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsNewsletterModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Send size={18} /> Schedule Campaign</button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isTriggerModalOpen} onClose={() => setIsTriggerModalOpen(false)} title="Setup Persona Trigger">
                <form onSubmit={handleCreateTrigger} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="form-group">
                        <label>Target Persona</label>
                        <select
                            value={triggerData.persona}
                            onChange={(e) => setTriggerData({ ...triggerData, persona: e.target.value })}
                        >
                            <option value="Admin">System Admin</option>
                            <option value="Executive">Executive Sponsor</option>
                            <option value="Power User">Power User</option>
                            <option value="Champion">Account Champion</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Event Trigger condition</label>
                        <input
                            type="text"
                            placeholder="e.g. Has not logged in for 30 days"
                            value={triggerData.trigger}
                            onChange={(e) => setTriggerData({ ...triggerData, trigger: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Email Template</label>
                        <input
                            type="text"
                            placeholder="e.g. Re-engagement Campaign V2"
                            value={triggerData.template}
                            onChange={(e) => setTriggerData({ ...triggerData, template: e.target.value })}
                            required
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsTriggerModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Zap size={18} /> Activate Trigger</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Comms;
