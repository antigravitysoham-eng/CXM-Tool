import React, { useState } from 'react';
import { Presentation, Calendar, CheckCircle, Clock, FileText, User, Plus } from 'lucide-react';
import Modal from '../components/Modal';
import { useCX } from '../context/CXContext';

const EBR = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { addToast } = useCX();

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

            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '2rem' }}>
                <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Upcoming This Week</p>
                    <h3 style={{ fontSize: '1.5rem' }}>12</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Next: **Acme Corp** (Tomorrow 10 AM)</p>
                </div>
                <div className="glass-card" style={{ borderLeft: '4px solid var(--success)' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Completed This Q</p>
                    <h3 style={{ fontSize: '1.5rem' }}>148</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Targets: 85% completion rate</p>
                </div>
                <div className="glass-card" style={{ borderLeft: '4px solid var(--warning)' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Pending Deck Reviews</p>
                    <h3 style={{ fontSize: '1.5rem' }}>7</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Past due for 3 accounts</p>
                </div>
            </div>

            <div className="glass-card" style={{ padding: '0' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                    <h3 style={{ fontSize: '1.1rem' }}>EBR Schedule & Archive</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-ghost" style={{ fontSize: '0.8rem', padding: '4px 12px' }}>Upcoming</button>
                        <button className="btn-ghost" style={{ fontSize: '0.8rem', padding: '4px 12px' }}>Archive</button>
                    </div>
                </div>
                <div style={{ padding: '1.5rem' }}>
                    {[
                        { account: 'Acme Corp', status: 'Upcoming', date: 'Feb 27, 2026', host: 'Sarah J.', prep: '90%', outcome: 'N/A' },
                        { account: 'Global Tech', status: 'Completed', date: 'Feb 15, 2026', host: 'Mark O.', prep: '100%', outcome: 'Positive' },
                        { account: 'Nexus Solutions', status: 'Overdue', date: 'Feb 10, 2026', host: 'Sarah J.', prep: '40%', outcome: 'Rescheduled' },
                        { account: 'Stellar Innovations', status: 'Completed', date: 'Jan 28, 2026', host: 'Elena R.', prep: '100%', outcome: 'Expansion identified' },
                    ].map((ebr, idx) => (
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
                                    <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => addToast("Loading Meeting Workspace...")}>{ebr.status === 'Completed' ? 'View Minutes' : 'Start Prep'}</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Schedule Executive Business Review">
                <form style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Select Account</label>
                        <select className="glass" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'white', background: 'var(--bg-secondary)' }}>
                            <option>Acme Corp</option>
                            <option>Global Tech</option>
                            <option>Nexus Solutions</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Review Date</label>
                        <input type="date" className="glass" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'white' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={() => {
                            addToast("EBR Scheduled and Invitations Sent!");
                            setIsModalOpen(false);
                        }}>Confirm Schedule</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default EBR;
