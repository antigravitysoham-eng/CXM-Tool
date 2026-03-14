import React, { useState } from 'react';
import { Presentation, Calendar, CheckCircle, Clock, FileText, User, Plus, LayoutDashboard, List } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Modal from '../components/Modal';
import { useCX } from '../context/CXContext';
import ModuleActions from '../components/ModuleActions';
import DataManagement from '../components/DataManagement';

const pipelineData = [
    { name: 'Aug', scheduled: 4 },
    { name: 'Sep', scheduled: 7 },
    { name: 'Oct', scheduled: 2 },
    { name: 'Nov', scheduled: 5 },
];

const EBR = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { addToast, ebrs, addEbr, customers } = useCX();
    const [formData, setFormData] = useState({
        account: '',
        date: '',
        prep: '0%',
        outcome: 'Scheduled'
    });

    const handleSchedule = async (e) => {
        e.preventDefault();
        await addEbr(formData);
        setIsModalOpen(false);
        setFormData({ account: '', date: '', prep: '0%', outcome: 'Scheduled' });
    };

    const upcomingCount = ebrs.filter(e => e.status === 'Upcoming').length;
    const completedCount = ebrs.filter(e => e.status === 'Completed').length;
    const pendingPrep = ebrs.filter(e => parseInt(e.prep) < 100).length;

    const [activeTab, setActiveTab] = useState('Overview');

    return (
        <div className="animate-fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>EBR Meetings</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Executive Business Reviews: Planner, Deck Links, and Outcomes.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                    <Calendar size={18} /> Schedule EBR
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
                    <List size={18} /> Deep Dive Data
                </button>
            </div>

            {activeTab === 'Overview' ? (
                <>
                    <ModuleActions
                        moduleName="EBR Meetings"
                        aiInsight="EBR Preparedness: 4 scheduled meetings lack updated consumption decks. Suggesting automated slide generation based on recent 'Usage Stats'."
                    />
                    <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '2rem' }}>
                        <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Upcoming</p>
                            <h3 style={{ fontSize: '1.5rem' }}>{upcomingCount}</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Next: {ebrs.find(e => e.status === 'Upcoming')?.account || 'None scheduled'}</p>
                        </div>
                        <div className="glass-card" style={{ borderLeft: '4px solid var(--success)' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Completed</p>
                            <h3 style={{ fontSize: '1.5rem' }}>{completedCount}</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total reviews conducted</p>
                        </div>
                        <div className="glass-card" style={{ borderLeft: '4px solid var(--warning)' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Pending Prep</p>
                            <h3 style={{ fontSize: '1.5rem' }}>{pendingPrep}</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Past due decks: {ebrs.filter(e => parseInt(e.prep) < 50).length}</p>
                        </div>
                    </div>

                    <div className="glass-card" style={{ height: '350px' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Upcoming Schedule Pipeline</h3>
                        <div style={{ width: '100%', height: '250px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={pipelineData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                    <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '8px' }} />
                                    <Bar dataKey="scheduled" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <DataManagement
                        moduleName="EBR Queue"
                        onManualAdd={() => setIsModalOpen(true)}
                    />
                    <div className="glass-card" style={{ padding: '0' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                            <h3 style={{ fontSize: '1.1rem' }}>EBR Schedule & Archive</h3>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn-ghost" style={{ fontSize: '0.8rem', padding: '4px 12px' }}>Upcoming</button>
                                <button className="btn-ghost" style={{ fontSize: '0.8rem', padding: '4px 12px' }}>Archive</button>
                            </div>
                        </div>
                        <div style={{ padding: '1.5rem' }}>
                            {ebrs.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No EBR meetings found.</p>
                            ) : ebrs.map((ebr, idx) => (
                                <div key={idx} className="glass" style={{ marginBottom: '1rem', padding: '1.25rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                                            <Presentation size={24} />
                                        </div>
                                        <div>
                                            <h4 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>{ebr.account}</h4>
                                            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={12} /> {ebr.date}</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={12} /> {ebr.host}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '3rem', alignItems: 'center' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>PREP</p>
                                            <p style={{ fontWeight: 700, color: parseInt(ebr.prep) >= 80 ? 'var(--success)' : 'var(--warning)' }}>{ebr.prep}</p>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>OUTCOME</p>
                                            <p style={{ fontWeight: 600, fontSize: '0.85rem' }}>{ebr.outcome}</p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button className="btn-ghost" title="View Deck" onClick={() => addToast("Opening Executive Deck...")}><FileText size={18} /></button>
                                            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => addToast("Loading Meeting Workspace...")}>{ebr.status === 'Completed' ? 'View Minutes' : 'Start Prep'}</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )
            }

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Schedule Executive Business Review">
                <form onSubmit={handleSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Select Account</label>
                        <select
                            className="glass"
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'white', background: 'var(--bg-secondary)' }}
                            value={formData.account}
                            onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                            required
                        >
                            <option value="">Select an account</option>
                            {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Review Date</label>
                        <input
                            type="date"
                            className="glass"
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'white' }}
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            required
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Confirm Schedule</button>
                    </div>
                </form>
            </Modal>
        </div >
    );
};

export default EBR;
