import React, { useState } from 'react';
import { TrendingUp, Sparkles, DollarSign, Target, ArrowRight, UserPlus, Save, Bot, LayoutDashboard, List, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { useCX } from '../context/CXContext';
import Modal from '../components/Modal';
import ModuleActions from '../components/ModuleActions';
import DataManagement from '../components/DataManagement';

const Upsells = () => {
    const { addToast, upsells, addUpsell, aiPredictions = [] } = useCX();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        account: '',
        type: 'Expansion',
        value: '',
        product: '',
        probability: '50%'
    });

    const handleAdd = async (e) => {
        e.preventDefault();
        await addUpsell(formData);
        setIsModalOpen(false);
        setFormData({ account: '', type: 'Expansion', value: '', product: '', probability: '50%' });
    };

    const totalValue = upsells.reduce((acc, opp) => acc + parseInt(opp.value.replace(/[^0-9]/g, '') || 0), 0);
    const weightedValue = upsells.reduce((acc, opp) => acc + (parseInt(opp.value.replace(/[^0-9]/g, '') || 0) * (parseInt(opp.probability) / 100)), 0);

    const handlePredictionAction = (prediction) => {
        setFormData({
            account: prediction.account,
            type: prediction.prediction.includes('Expansion') ? 'Expansion' : prediction.prediction.includes('Upgrade') ? 'Upgrade' : 'Service',
            value: '',
            product: prediction.prediction,
            probability: `${prediction.probability}%`
        });
        setIsModalOpen(true);
    };

    const [activeTab, setActiveTab] = useState('Overview');

    const chartData = [
        { name: 'Net Pipeline', value: totalValue, fill: 'var(--accent-primary)' },
        { name: 'Weighted Pipeline', value: Math.round(weightedValue), fill: 'var(--success)' },
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
                    <List size={18} /> Deep Dive Pipeline
                </button>
            </div>

            {activeTab === 'Overview' ? (
                <>
                    <ModuleActions
                        moduleName="Upsells"
                        aiInsight="Top Opportunity: 12 accounts are hitting 90% seat utilization. High conversion probability for 'Unlimited Seat' tier upgrades."
                    />
                    <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '2.5rem' }}>
                        <div className="glass-card">
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Pipeline Value</p>
                            <h3 style={{ fontSize: '1.5rem' }}>${(totalValue / 1000).toFixed(1)}k</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--success)' }}>Weighted: ${(weightedValue / 1000).toFixed(1)}k</p>
                        </div>
                        <div className="glass-card">
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Conversion Rate</p>
                            <h3 style={{ fontSize: '1.5rem' }}>24.5%</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Target: 30%</p>
                        </div>
                        <div className="glass-card">
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Average Deal Size</p>
                            <h3 style={{ fontSize: '1.5rem' }}>${upsells.length > 0 ? (totalValue / upsells.length / 1000).toFixed(1) : 0}k</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--accent-primary)' }}>High-value focus</p>
                        </div>
                        <div className="glass-card">
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Opportunities</p>
                            <h3 style={{ fontSize: '1.5rem' }}>{upsells.length}</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--info)' }}>Identified in {new Set(upsells.map(u => u.account)).size} accounts</p>
                        </div>
                    </div>

                    <div className="dashboard-grid" style={{ gridTemplateColumns: '2fr 3fr' }}>
                        <div className="glass-card" style={{ height: '400px' }}>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Pipeline Breakdown</h3>
                            <div style={{ width: '100%', height: '300px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                                        <XAxis type="number" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis dataKey="name" type="category" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} width={100} />
                                        <Tooltip
                                            formatter={(value) => `$${(value / 1000).toFixed(1)}k`}
                                            contentStyle={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '8px' }}
                                        />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="glass-card" style={{ height: '400px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(16, 185, 129, 0.05))', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                <div style={{ background: 'var(--accent-primary)', padding: '0.4rem', borderRadius: '6px', color: 'white' }}>
                                    <Bot size={16} />
                                </div>
                                <h3 style={{ fontSize: '1.1rem' }}>AI Predicted Insights</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {aiPredictions.map(pred => (
                                    <div key={pred.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <h4 style={{ fontWeight: 600, fontSize: '0.95rem' }}>{pred.account}</h4>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 700 }}>{pred.probability}% Prob</span>
                                        </div>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--accent-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>{pred.prediction}</p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: '0.75rem' }}>{pred.rationale}</p>
                                        <button className="btn btn-ghost" style={{ width: '100%', padding: '4px', fontSize: '0.75rem', border: '1px solid var(--accent-primary)' }} onClick={() => handlePredictionAction(pred)}>
                                            Convert
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <DataManagement
                        moduleName="Expansion Pipeline"
                        onManualAdd={() => setIsModalOpen(true)}
                    />
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
                                {upsells.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No expansion opportunities identified.</td>
                                    </tr>
                                ) : upsells.map((opp, idx) => (
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
                </>
            )}

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
                    <div className="form-group">
                        <label>Probability (%)</label>
                        <input
                            type="text"
                            placeholder="e.g. 75%"
                            value={formData.probability}
                            onChange={(e) => setFormData({ ...formData, probability: e.target.value })}
                            required
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Save size={18} /> Add to Pipeline</button>
                    </div>
                </form>
            </Modal>

        </div>
    );
};

export default Upsells;
