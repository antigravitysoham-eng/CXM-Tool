import React from 'react';
import { Rocket, CheckCircle2, Circle, MessageSquare, Star, CheckCircle } from 'lucide-react';
import { useCX } from '../context/CXContext';

const Onboarding = () => {
    const { onboarding, completeOnboardingStep } = useCX();

    const nextStep = onboarding.find(step => !step.completed);
    const completedCount = onboarding.filter(s => s.completed).length;
    const progressPercent = Math.round((completedCount / onboarding.length) * 100);

    return (
        <div className="animate-fade-in">
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Onboarding Journey</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Track and manage the customer onboarding experience for **Acme Corp**.</p>
            </header>

            <div className="dashboard-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
                <div className="glass-card">
                    <h3 style={{ marginBottom: '2rem' }}>Implementation Progress</h3>
                    <div style={{ paddingLeft: '2rem', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '7px', top: '10px', bottom: '10px', width: '2px', background: 'var(--bg-tertiary)' }}></div>
                        {onboarding.map((step, idx) => (
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
                                    {step.completed && <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Success</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                    {nextStep && (
                        <div style={{ marginTop: '1rem', padding: '1.5rem', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                            <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Next Task: **{nextStep.label}**</p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1rem' }}>Ensure the necessary resources are prepared for this stage of implementation.</p>
                            <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }} onClick={() => completeOnboardingStep(nextStep.id)}>
                                <CheckCircle size={14} /> Mark as Complete
                            </button>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="glass-card">
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Engagement Feedback</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>How was the Kickoff session?</p>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
                            {[1, 2, 3, 4, 5].map(s => <Star key={s} size={20} fill={s <= 4 ? 'var(--warning)' : 'none'} color={s <= 4 ? 'var(--warning)' : 'var(--text-muted)'} />)}
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <p style={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                                "The team was very responsive and the platform setup was faster than expected. Looking forward to the training."
                            </p>
                        </div>
                    </div>

                    <div className="glass-card" style={{ background: 'linear-gradient(135deg, var(--bg-secondary), var(--bg-primary))' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Onboarding Health</h3>
                        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                            <div style={{
                                width: '100px',
                                height: '100px',
                                borderRadius: '50%',
                                border: '8px solid var(--success)',
                                borderBottomColor: 'var(--bg-tertiary)',
                                margin: '0 auto 1rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transform: `rotate(${45 + (progressPercent * 1.8)}deg)`
                            }}>
                                <span style={{ fontSize: '1.5rem', fontWeight: 800, transform: `rotate(${-45 - (progressPercent * 1.8)}deg)` }}>{progressPercent}%</span>
                            </div>
                            <p style={{ fontWeight: 600, color: 'var(--success)' }}>On Track</p>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Maturity score increasing</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Onboarding;
