import React, { useState } from 'react';
import { HeartPulse, CheckCircle2, XCircle, AlertCircle, Plus, Filter, Save } from 'lucide-react';
import { useCX } from '../context/CXContext';
import Modal from '../components/Modal';

const HealthChecks = () => {
    const { addToast, customers } = useCX();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        account: '',
        outcome: 'Healthy',
        takeaway: '',
        nextStep: ''
    });

    const handleLogCheck = (e) => {
        e.preventDefault();
        addToast(`Health check for ${formData.account} logged successfully!`, 'success');
        setIsModalOpen(false);
        setFormData({ account: '', outcome: 'Healthy', takeaway: '', nextStep: '' });
    };

    const getOutcomeIcon = (outcome) => {
        switch (outcome) {
            case 'Critical': return <XCircle size={16} color="var(--danger)" />;
            case 'Poor': return <AlertCircle size={16} color="var(--warning)" />;
            case 'Healthy': return <CheckCircle2 size={16} color="var(--success)" />;
            default: return <CheckCircle2 size={16} color="var(--success)" />;
        }
    };

    return (
        <div className="animate-fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Health Checks</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Log and track outcomes of recurring customer sentiment calls.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-ghost"><Filter size={18} /> Filter</button>
                    <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                        <Plus size={18} /> Log Check
                    </button>
                </div>
            </header>

            <div className="glass-card" style={{ padding: '0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>DATE</th>
                            <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>ACCOUNT</th>
                            <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>OUTCOME / SENTIMENT</th>
                            <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>KEY TAKEAWAY</th>
                            <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>NEXT STEP</th>
                            <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {[
                            { date: 'Feb 24, 2026', account: 'Acme Corp', outcome: 'Critical', takeaway: 'Budget cuts at department level', next: 'Escalate to CTO', icon: <XCircle size={16} color="var(--danger)" /> },
                            { date: 'Feb 22, 2026', account: 'Global Tech', outcome: 'Poor', takeaway: 'Integration bugs persist', next: 'Engineering sync', icon: <AlertCircle size={16} color="var(--warning)" /> },
                            { date: 'Feb 20, 2026', account: 'Cloud Nine', outcome: 'Healthy', takeaway: 'Feature adoption increased', next: 'Upsell discussion', icon: <CheckCircle2 size={16} color="var(--success)" /> },
                            { date: 'Feb 18, 2026', account: 'Stellar Innovations', outcome: 'Healthy', takeaway: 'All KPIs met for Q1', next: 'Quarterly Survey', icon: <CheckCircle2 size={16} color="var(--success)" /> },
                        ].map((check, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', transition: '0.2s' }}>
                                <td style={{ padding: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{check.date}</td>
                                <td style={{ padding: '1.25rem', fontWeight: 600 }}>{check.account}</td>
                                <td style={{ padding: '1.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {check.icon}
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{check.outcome}</span>
                                    </div>
                                </td>
                                <td style={{ padding: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '250px' }}>{check.takeaway}</td>
                                <td style={{ padding: '1.25rem' }}>
                                    <span style={{ fontSize: '0.8rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>{check.next}</span>
                                </td>
                                <td style={{ padding: '1.25rem', textAlign: 'right' }}>
                                    <button className="btn-ghost" style={{ padding: '4px' }}>View Notes</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Log Health Check">
                <form onSubmit={handleLogCheck} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="form-group">
                        <label>Select Account</label>
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
                        <label>Sentiment / Health Outcome</label>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            {['Healthy', 'Stable', 'Poor', 'Critical'].map(level => (
                                <button
                                    key={level}
                                    type="button"
                                    className={`btn ${formData.outcome === level ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ flex: 1, padding: '8px', fontSize: '0.85rem' }}
                                    onClick={() => setFormData({ ...formData, outcome: level })}
                                >
                                    {level}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Key Takeaway</label>
                        <input
                            type="text"
                            placeholder="e.g. Budget cuts at department level"
                            value={formData.takeaway}
                            onChange={(e) => setFormData({ ...formData, takeaway: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Next Step</label>
                        <input
                            type="text"
                            placeholder="e.g. Escalate to CTO"
                            value={formData.nextStep}
                            onChange={(e) => setFormData({ ...formData, nextStep: e.target.value })}
                            required
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Save size={18} /> Log Check</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default HealthChecks;
