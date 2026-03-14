import React, { useState } from 'react';
import { Gift, TrendingUp, Users, ArrowRight, Save, Copy, LayoutDashboard, List, Trophy, PieChart as PieChartIcon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useCX } from '../context/CXContext';
import Modal from '../components/Modal';
import ModuleActions from '../components/ModuleActions';
import DataManagement from '../components/DataManagement';

const Referrals = () => {
    const { referrals, addReferral, addToast } = useCX();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        referrer: '',
        referee: '',
        status: 'Pending',
        reward: ''
    });

    const handleAdd = (e) => {
        e.preventDefault();
        addReferral({
            ...formData,
            date: new Date().toISOString().split('T')[0]
        });
        setIsModalOpen(false);
        setFormData({ referrer: '', referee: '', status: 'Pending', reward: '' });
    };

    const totalReferrals = referrals.length;
    const wonReferrals = referrals.filter(r => r.status === 'Won').length;
    const conversionRate = totalReferrals > 0 ? Math.round((wonReferrals / totalReferrals) * 100) : 0;

    const copyLink = () => {
        addToast('Referral link copied to clipboard!', 'info');
    };

    const [activeTab, setActiveTab] = useState('Overview');

    // Data for UI
    const statusData = [
        { name: 'Won', value: referrals.filter(r => r.status === 'Won').length, color: 'var(--success)' },
        { name: 'Pending', value: referrals.filter(r => r.status === 'Pending').length, color: 'var(--warning)' },
        { name: 'Lost', value: referrals.filter(r => r.status === 'Lost').length, color: 'var(--danger)' },
    ].filter(d => d.value > 0);

    const leaderBoard = Object.entries(
        referrals.reduce((acc, r) => {
            acc[r.referrer] = (acc[r.referrer] || 0) + 1;
            return acc;
        }, {})
    )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    return (
        <div className="animate-fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Customer Referrals</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Track and manage referrals coming from active customers.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-ghost" onClick={copyLink}>
                        <Copy size={18} /> Get Referral Link
                    </button>
                    <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                        <Gift size={18} /> Track Referral
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
                    <List size={18} /> Deep Dive Log
                </button>
            </div>

            {activeTab === 'Overview' ? (
                <>
                    <ModuleActions
                        moduleName="Referrals"
                        aiInsight="Referral velocity is up 15%. Recommend triggering 'Referral Bonus' emails for high-NPS accounts in the Fintech segment."
                    />
                    <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '2.5rem' }}>
                        <div className="glass-card">
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Total Referrals</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <h3 style={{ fontSize: '2rem' }}>{totalReferrals}</h3>
                                <Users size={24} color="var(--accent-primary)" />
                            </div>
                        </div>
                        <div className="glass-card">
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Conversion Rate</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <h3 style={{ fontSize: '2rem' }}>{conversionRate}%</h3>
                                <TrendingUp size={24} color="var(--success)" />
                            </div>
                        </div>
                        <div className="glass-card">
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Pending Rewards</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <h3 style={{ fontSize: '2rem' }}>{referrals.filter(r => r.status === 'Pending').length}</h3>
                                <Gift size={24} color="var(--warning)" />
                            </div>
                        </div>
                    </div>

                    <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        <div className="glass-card" style={{ height: '350px' }}>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Referral Status Distribution</h3>
                            <div style={{ width: '100%', height: '250px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={statusData}
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {statusData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '8px' }} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="glass-card" style={{ height: '350px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
                                <Trophy size={20} color="var(--warning)" />
                                <h3 style={{ fontSize: '1.1rem' }}>Top Referrers (Advocates)</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {leaderBoard.map(([name, count], idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                                        <span style={{ fontWeight: 600 }}>{name}</span>
                                        <span className="badge badge-primary">{count} referrals</span>
                                    </div>
                                ))}
                                {leaderBoard.length === 0 && (
                                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>No leaderboard data yet.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <DataManagement
                        moduleName="Referral Log"
                        onManualAdd={() => setIsModalOpen(true)}
                    />
                    <div className="glass-card" style={{ padding: 0 }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ fontSize: '1.1rem' }}>Referral Tracking Log</h3>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>DATE</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>REFERRER (CUSTOMER)</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>REFEREE (PROSPECT)</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>STATUS</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>REWARD</th>
                                    <th style={{ padding: '1rem' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {referrals.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No referrals tracked yet.</td>
                                    </tr>
                                ) : referrals.map(ref => (
                                    <tr key={ref.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'var(--transition-fast)' }}>
                                        <td style={{ padding: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{ref.date}</td>
                                        <td style={{ padding: '1.25rem', fontWeight: 600 }}>{ref.referrer}</td>
                                        <td style={{ padding: '1.25rem' }}>{ref.referee}</td>
                                        <td style={{ padding: '1.25rem' }}>
                                            <span className={`badge ${ref.status === 'Won' ? 'badge-success' : ref.status === 'Lost' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                                                {ref.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1.25rem', fontSize: '0.9rem' }}>{ref.reward}</td>
                                        <td style={{ padding: '1.25rem', textAlign: 'right' }}>
                                            <button className="btn btn-ghost" style={{ padding: '6px' }} onClick={() => addToast(`Viewing details for ${ref.referee}`, 'info')}>
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Track New Referral">
                <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="form-group">
                        <label>Referrer (Existing Customer)</label>
                        <input
                            type="text"
                            placeholder="e.g. Acme Corp"
                            value={formData.referrer}
                            onChange={(e) => setFormData({ ...formData, referrer: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Referee (Prospect/Company)</label>
                        <input
                            type="text"
                            placeholder="e.g. Stark Industries"
                            value={formData.referee}
                            onChange={(e) => setFormData({ ...formData, referee: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Expected Reward</label>
                        <input
                            type="text"
                            placeholder="e.g. $500 Credit or '1 Month Free'"
                            value={formData.reward}
                            onChange={(e) => setFormData({ ...formData, reward: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Initial Status</label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        >
                            <option value="Pending">Pending</option>
                            <option value="Won">Won</option>
                            <option value="Lost">Lost</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Save size={18} /> Save Referral</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Referrals;
