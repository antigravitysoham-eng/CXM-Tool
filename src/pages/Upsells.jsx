import React, { useState } from 'react';
import { TrendingUp, Sparkles, DollarSign, Target, ArrowRight, UserPlus, Save } from 'lucide-react';
import { useCX } from '../context/CXContext';
import Modal from '../components/Modal';

const Upsells = () => {
    const { addToast } = useCX();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        account: '',
        type: 'Expansion',
        value: '',
        product: '',
        probability: '50%'
    });

    const handleAdd = (e) => {
        e.preventDefault();
        addToast(`Upsell opportunity for ${formData.account} added to pipeline!`, 'success');
        setIsModalOpen(false);
        setFormData({ account: '', type: 'Expansion', value: '', product: '', probability: '50%' });
    };

    const opportunities = [
        { account: 'Global Tech', type: 'Expansion', value: '$85,000', probability: '80%', product: 'Advanced Security Suite', owner: 'Mark O.' },
        { account: 'Acme Corp', type: 'Cross-sell', value: '$22,000', probability: '45%', product: 'Premium Support Plus', owner: 'Sarah J.' },
        { account: 'Cloud Nine', type: 'License Growth', value: '$150,000', probability: '90%', product: 'Enterprise Tier Upgrade', owner: 'David K.' },
        { account: 'Stellar Innovations', type: 'Expansion', value: '$35,000', probability: '60%', product: 'Analytics PowerPack', owner: 'Elena R.' },
    ];

    return (
        <div className="animate-fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Upsell & Account Deepening</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Track existing customer expansion opportunities and revenue growth pipeline.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                    <TrendingUp size={18} /> Add Opportunity
                </button>
            </header>

            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '2.5rem' }}>
                <div className="glass-card">
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Pipeline Value</p>
                    <h3 style={{ fontSize: '1.5rem' }}>$292,000</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--success)' }}>Weighted: $184,500</p>
                </div>
                <div className="glass-card">
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Conversion Rate</p>
                    <h3 style={{ fontSize: '1.5rem' }}>24.5%</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Target: 30%</p>
                </div>
                <div className="glass-card">
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Average Deal Size</p>
                    <h3 style={{ fontSize: '1.5rem' }}>$48,600</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--accent-primary)' }}>High-value focus</p>
                </div>
                <div className="glass-card">
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Active Champions</p>
                    <h3 style={{ fontSize: '1.5rem' }}>84</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--info)' }}>Identified in 65 accounts</p>
                </div>
            </div>

            <div className="glass-card">
                <h3 style={{ marginBottom: '1.5rem' }}>Open Expansion Opportunities</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>ACCOUNT</th>
                            <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>TYPE</th>
                            <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>PRODUCT</th>
                            <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>VALUE</th>
                            <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>PROBABILITY</th>
                            <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>OWNER</th>
                            <th style={{ padding: '1rem' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {opportunities.map((opp, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', transition: 'var(--transition-fast)' }}>
                                <td style={{ padding: '1.25rem', fontWeight: 600 }}>{opp.account}</td>
                                <td style={{ padding: '1.25rem' }}>
                                    <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>{opp.type}</span>
                                </td>
                                <td style={{ padding: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{opp.product}</td>
                                <td style={{ padding: '1.25rem', fontWeight: 700 }}>{opp.value}</td>
                                <td style={{ padding: '1.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ height: '6px', width: '60px', background: 'var(--bg-tertiary)', borderRadius: '3px' }}>
                                            <div style={{ height: '100%', width: opp.probability, background: 'var(--accent-primary)', borderRadius: '3px' }}></div>
                                        </div>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{opp.probability}</span>
                                    </div>
                                </td>
                                <td style={{ padding: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{opp.owner}</td>
                                <td style={{ padding: '1.25rem', textAlign: 'right' }}>
                                    <button className="btn btn-ghost" style={{ padding: '6px' }} onClick={() => addToast(`Viewing deal details for ${opp.account}`, 'info')}>
                                        <ArrowRight size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Expansion Opportunity">
                <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="form-group">
                        <label>Customer Account</label>
                        <input
                            type="text"
                            placeholder="e.g. Global Tech"
                            value={formData.account}
                            onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Opportunity Type</label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        >
                            <option value="Expansion">Seat Expansion</option>
                            <option value="Cross-sell">New Product Cross-sell</option>
                            <option value="Upgrade">Tier Upgrade</option>
                            <option value="Service">Professional Services</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Estimated Value</label>
                        <input
                            type="text"
                            placeholder="e.g. $25,000"
                            value={formData.value}
                            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Target Product/Service</label>
                        <input
                            type="text"
                            placeholder="e.g. Advanced Analytics"
                            value={formData.product}
                            onChange={(e) => setFormData({ ...formData, product: e.target.value })}
                            required
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Save size={18} /> Add to Pipeline</button>
                    </div>
                </form>
            </Modal>

            <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="glass-card" style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                        <Sparkles size={18} color="var(--accent-primary)" /> Smart Suggestions
                    </h4>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        **Nexus Solutions** has reached 95% of their seat capacity. Recommended action: Propose a 20-seat addition for the next renewal cycle.
                    </p>
                </div>
                <div className="glass-card" style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                        <UserPlus size={18} color="var(--success)" /> Champion Identified
                    </h4>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        **Acme Corp** has a new Head of Platform. Sarah J. is requested to initiate a "Relationship Deepening" plan within the next 7 days.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Upsells;
