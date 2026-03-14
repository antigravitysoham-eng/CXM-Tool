import React, { useState } from 'react';
import { Rocket, CheckCircle, Star, Users, Briefcase, Activity, LayoutDashboard, List, Timer, AlertTriangle, Plus, Save } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useCX } from '../context/CXContext';
import ModuleActions from '../components/ModuleActions';
import DataManagement from '../components/DataManagement';
import Modal from '../components/Modal';

const Onboarding = () => {
    const { onboarding, completeOnboardingStep } = useCX();
    const [selectedCustomer, setSelectedCustomer] = useState(onboarding[0] || null);

    // Overview Metrics
    const totalOnboarding = onboarding.length;
    const avgProgress = onboarding.length ? Math.round(onboarding.reduce((acc, c) => acc + c.progress, 0) / onboarding.length) : 0;
    const atRiskCount = onboarding.filter(c => c.status === 'At Risk').length;

    const handleSelectCustomer = (customer) => {
        setSelectedCustomer(customer);
    };

    const [activeTab, setActiveTab] = useState('Overview');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newAccount, setNewAccount] = useState({ name: '', cxm: 'Sarah J.' });

    const handleAddAccount = (e) => {
        e.preventDefault();
        addToast(`Added ${newAccount.name} to onboarding queue!`, 'success');
        setIsAddModalOpen(false);
        setNewAccount({ name: '', cxm: 'Sarah J.' });
    };

    // Data for charts
    const stageData = [
        { stage: 'Kickoff', count: onboarding.filter(c => c.progress < 25).length },
        { stage: 'Config', count: onboarding.filter(c => c.progress >= 25 && c.progress < 50).length },
        { stage: 'Training', count: onboarding.filter(c => c.progress >= 50 && c.progress < 75).length },
        { stage: 'Go-Live', count: onboarding.filter(c => c.progress >= 75).length },
    ];

    return (
        <div className="animate-fade-in">
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Onboarding Command Center</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Track and manage the customer onboarding experience across your portfolio.</p>
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
                    <List size={18} /> Deep Dive Queue
                </button>
            </div>

            {activeTab === 'Overview' ? (
                <>
                    <ModuleActions
                        moduleName="Onboarding"
                        aiInsight="Warning: 3 accounts in 'Technical Setup' haven't updated in 5 days. Potential technical blocker identified in regional US-East setups."
                    />
                    <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '2.5rem' }}>
                        <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Active Onboardings</p>
                                    <h3 style={{ fontSize: '1.5rem' }}>{totalOnboarding}</h3>
                                </div>
                                <div style={{ padding: '0.5rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', color: 'var(--accent-primary)' }}>
                                    <Briefcase size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="glass-card" style={{ borderLeft: '4px solid var(--success)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Average Progress</p>
                                    <h3 style={{ fontSize: '1.5rem' }}>{avgProgress}%</h3>
                                </div>
                                <div style={{ padding: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', color: 'var(--success)' }}>
                                    <Activity size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="glass-card" style={{ borderLeft: '4px solid var(--danger)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>At Risk Accounts</p>
                                    <h3 style={{ fontSize: '1.5rem' }}>{atRiskCount}</h3>
                                </div>
                                <div style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', color: 'var(--danger)' }}>
                                    <Users size={20} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="dashboard-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
                        <div className="glass-card" style={{ height: '350px' }}>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Onboarding Funnel Stages</h3>
                            <div style={{ width: '100%', height: '250px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stageData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                        <XAxis dataKey="stage" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '8px' }} />
                                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                            {stageData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={index === stageData.length - 1 ? 'var(--success)' : 'var(--accent-primary)'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="glass-card" style={{ height: '350px', overflowY: 'auto' }}>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>Critical Actions</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {onboarding.filter(c => c.status === 'At Risk').map((customer, idx) => (
                                    <div key={idx} style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                                            <AlertTriangle size={14} color="var(--danger)" />
                                            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{customer.account}</span>
                                        </div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Stalled at {customer.progress}% progress. CXM {customer.cxm} intervention required.</p>
                                    </div>
                                ))}
                                {atRiskCount === 0 && (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                        <CheckCircle size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                        <p>All ontrack!</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <DataManagement
                        moduleName="Onboarding Queue"
                        onManualAdd={() => setIsAddModalOpen(true)}
                    />
                    <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
                        {/* Customer List */}
                        <div className="glass-card">
                            <h3 style={{ marginBottom: '1.5rem' }}>Customer Queue</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {onboarding.map(customer => (
                                    <div
                                        key={customer.customerId}
                                        onClick={() => handleSelectCustomer(customer)}
                                        style={{
                                            padding: '1rem',
                                            borderRadius: '8px',
                                            border: `1px solid ${selectedCustomer?.customerId === customer.customerId ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                            background: selectedCustomer?.customerId === customer.customerId ? 'rgba(99, 102, 241, 0.05)' : 'rgba(255,255,255,0.02)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>{customer.account}</h4>
                                            <span className={`badge ${customer.status === 'On Track' ? 'badge-success' : customer.status === 'At Risk' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                                                {customer.status}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>CXM: {customer.cxm}</p>
                                        <div style={{ height: '6px', width: '100%', background: 'var(--bg-tertiary)', borderRadius: '3px' }}>
                                            <div style={{ height: '100%', width: `${customer.progress}%`, background: 'var(--accent-primary)', borderRadius: '3px' }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Individual Journey Tracker */}
                        {selectedCustomer ? (
                            <div className="glass-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                    <div>
                                        <h3 style={{ fontSize: '1.25rem' }}>Journey: {selectedCustomer.account}</h3>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Assigned CXM: **{selectedCustomer.cxm}**</p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--accent-primary)' }}>{selectedCustomer.progress}%</span>
                                    </div>
                                </div>

                                <div style={{ paddingLeft: '2rem', position: 'relative' }}>
                                    <div style={{ position: 'absolute', left: '7px', top: '10px', bottom: '10px', width: '2px', background: 'var(--bg-tertiary)' }}></div>
                                    {selectedCustomer.steps.map((step, idx) => (
                                        <div key={idx} style={{ position: 'relative', marginBottom: '2.5rem' }}>
                                            <div style={{
                                                position: 'absolute',
                                                left: '-26px',
                                                top: '0',
                                                width: '16px',
                                                height: '16px',
                                                borderRadius: '50%',
                                                background: step.completed ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                                border: `3px solid ${step.completed ? 'var(--bg-primary)' : 'var(--bg-tertiary)'}`,
                                                zIndex: 2,
                                                boxShadow: step.completed ? '0 0 10px var(--accent-glow)' : 'none'
                                            }}></div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <h4 style={{ color: step.completed ? 'var(--text-primary)' : 'var(--text-muted)', marginBottom: '0.25rem' }}>{step.label}</h4>
                                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{step.completed ? `Completed on ${step.date}` : `Scheduled for ${step.date}`}</p>
                                                </div>
                                                {step.completed ? (
                                                    <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Success</span>
                                                ) : (
                                                    <button
                                                        className="btn btn-primary"
                                                        style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                                                        onClick={() => completeOnboardingStep(selectedCustomer.customerId, step.id)}
                                                    >
                                                        Complete
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
                                <p style={{ color: 'var(--text-muted)' }}>Select a customer to view their journey.</p>
                            </div>
                        )}
                    </div>
                </>
            )}

            <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add New Onboarding Account">
                <form onSubmit={handleAddAccount} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="form-group">
                        <label>Account Name</label>
                        <input
                            type="text"
                            placeholder="e.g. Acme Corp"
                            value={newAccount.name}
                            onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Assigned CX Manager</label>
                        <select
                            value={newAccount.cxm}
                            onChange={(e) => setNewAccount({ ...newAccount, cxm: e.target.value })}
                        >
                            <option value="Sarah J.">Sarah J.</option>
                            <option value="Mike T.">Mike T.</option>
                            <option value="Unassigned">Unassigned</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Save size={18} /> Add Account</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Onboarding;
