import React, { useState } from 'react';
import { GraduationCap, Users, Clock, CheckCircle, BookOpen, ExternalLink, Save } from 'lucide-react';
import { useCX } from '../context/CXContext';
import Modal from '../components/Modal';

const Training = () => {
    const { addToast, customers } = useCX();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        courseName: '',
        account: '',
        date: '',
        attendees: ''
    });

    const handleCreate = (e) => {
        e.preventDefault();
        addToast(`New training session for "${formData.courseName}" has been scheduled!`, 'success');
        setIsModalOpen(false);
        setFormData({ courseName: '', account: '', date: '', attendees: '' });
    };

    const courses = [
        { name: 'Platform Essentials', trainees: 45, completion: '92%', status: 'Active' },
        { name: 'Advanced Admin Training', trainees: 12, completion: '65%', status: 'In Progress' },
        { name: 'API & Integrations', trainees: 8, completion: '100%', status: 'Completed' },
        { name: 'Custom Reports Setup', trainees: 22, completion: '30%', status: 'Delayed' },
    ];

    return (
        <div className="animate-fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Training Tracker</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Monitor customer enablement and educational progress across all accounts.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                    <BookOpen size={18} /> New Course Session
                </button>
            </header>

            <div className="dashboard-grid" style={{ marginBottom: '2.5rem' }}>
                <div className="glass-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                            <Users size={20} />
                        </div>
                        <div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Trainees</p>
                            <h3 style={{ fontSize: '1.25rem' }}>1,482</h3>
                        </div>
                    </div>
                    <div style={{ position: 'relative', height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '70%', background: 'var(--accent-primary)' }}></div>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>70% of accounts have completed mandatory training.</p>
                </div>

                <div className="glass-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
                            <CheckCircle size={20} />
                        </div>
                        <div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Certifications Issued</p>
                            <h3 style={{ fontSize: '1.25rem' }}>842</h3>
                        </div>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>+12 certifications issued this week.</p>
                </div>
            </div>

            <div className="glass-card" style={{ padding: '0' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '1.1rem' }}>Active Enablement Courses</h3>
                </div>
                <div style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                        {courses.map((course, idx) => (
                            <div key={idx} className="glass" style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <span className={`badge ${course.status === 'Completed' ? 'badge-success' : course.status === 'Delayed' ? 'badge-danger' : course.status === 'In Progress' ? 'badge-info' : 'badge-ghost'}`}>
                                        {course.status}
                                    </span>
                                    <button className="btn-ghost" style={{ padding: '4px' }} onClick={() => addToast(`Opening materials for ${course.name}`, 'info')}>
                                        <ExternalLink size={14} />
                                    </button>
                                </div>
                                <h4 style={{ marginBottom: '1rem' }}>{course.name}</h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={14} /> {course.trainees} trainees</span>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Enablement Rate</span>
                                        <span>{course.completion}</span>
                                    </div>
                                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                                        <div style={{ height: '100%', width: course.completion, background: 'var(--accent-primary)', borderRadius: '2px' }}></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Training Session">
                <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="form-group">
                        <label>Course Name</label>
                        <input
                            type="text"
                            placeholder="e.g. Advanced Workflow Automation"
                            value={formData.courseName}
                            onChange={(e) => setFormData({ ...formData, courseName: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Select Customer</label>
                        <select
                            value={formData.account}
                            onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                            required
                        >
                            <option value="">Select an account...</option>
                            {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Session Date</label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Expected Attendees</label>
                        <input
                            type="number"
                            placeholder="e.g. 10"
                            value={formData.attendees}
                            onChange={(e) => setFormData({ ...formData, attendees: e.target.value })}
                            required
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Save size={18} /> Schedule Session</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Training;
