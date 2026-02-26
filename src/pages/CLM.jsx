import React, { useState } from 'react';
import { FileText, Clock, CheckCircle, AlertCircle, Plus, ChevronRight, ChevronLeft } from 'lucide-react';
import { useCX } from '../context/CXContext';
import Modal from '../components/Modal';

const stages = ['Draft', 'Review', 'Signed', 'Renewing'];

const CLM = () => {
    const { contracts, updateContractStage, addToast } = useCX();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const moveStage = (id, currentStage, direction) => {
        const currentIndex = stages.indexOf(currentStage);
        const nextIndex = currentIndex + direction;
        if (nextIndex >= 0 && nextIndex < stages.length) {
            updateContractStage(id, stages[nextIndex]);
        }
    };

    return (
        <div className="animate-fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Contract Lifecycle</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Track your contracts through the pipeline from draft to renewal.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                    <Plus size={18} /> New Contract
                </button>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', height: 'calc(100vh - 250px)' }}>
                {stages.map((stage) => (
                    <div key={stage} className="glass-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{stage}</h3>
                            <span style={{ fontSize: '0.8rem', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>
                                {contracts.filter(c => c.stage === stage).length}
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
                            {contracts.filter(c => c.stage === stage).map((contract) => (
                                <div key={contract.id} className="glass" style={{ padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', cursor: 'default' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                        <h4 style={{ fontSize: '0.95rem' }}>{contract.account}</h4>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button
                                                onClick={() => moveStage(contract.id, contract.stage, -1)}
                                                disabled={stage === 'Draft'}
                                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: stage === 'Draft' ? 'not-allowed' : 'pointer' }}
                                            >
                                                <ChevronLeft size={16} />
                                            </button>
                                            <button
                                                onClick={() => moveStage(contract.id, contract.stage, 1)}
                                                disabled={stage === 'Renewing'}
                                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: stage === 'Renewing' ? 'not-allowed' : 'pointer' }}
                                            >
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{contract.value}</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Clock size={12} /> {contract.date}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {contract.status === 'Active' ? <CheckCircle size={14} color="#10b981" /> : <AlertCircle size={14} color="#f59e0b" />}
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: contract.status === 'Active' ? '#10b981' : '#f59e0b' }}>{contract.status}</span>
                                        </div>
                                        <div style={{ display: 'flex', WebkitMaskImage: 'linear-gradient(to right, transparent, black 25%)' }}>
                                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent-primary)', border: '2px solid var(--bg-secondary)', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>JD</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={() => setIsModalOpen(true)}
                                style={{ background: 'transparent', border: '1px dashed var(--border-color)', borderRadius: '12px', padding: '1rem', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}
                            >
                                + Add Card
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Contract">
                <div style={{ textAlign: 'center', padding: '1rem' }}>
                    <FileText size={48} color="var(--accent-primary)" style={{ marginBottom: '1rem' }} />
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Create a new contract draft and enter negotiations.</p>
                    <button className="btn btn-primary" onClick={() => {
                        addToast("Contract drafted successfully!");
                        setIsModalOpen(false);
                    }}>Initiate Contract Draft</button>
                </div>
            </Modal>
        </div >
    );
};

export default CLM;
