import React, { useState } from 'react';
import { Bot, X, Sparkles, ChevronRight, AlertTriangle, Lightbulb, Send } from 'lucide-react';
import { useCX } from '../context/CXContext';

const SmartAssistant = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState('insights'); // 'insights' or 'chat'
    const [chatInput, setChatInput] = useState('');
    const [chatHistory, setChatHistory] = useState([
        { text: "Hello! I'm your CX Assistant. How can I help you optimize customer accounts today?", isBot: true }
    ]);
    const { automateOutreach } = useCX();

    const suggestions = [
        { type: 'Alert', text: '**Acme Corp** hasn\'t had an EBR in 124 days.', icon: <AlertTriangle size={14} />, color: 'var(--danger)' },
        { type: 'Insight', text: '**Global Tech** usage of "Analytics" dropped 20% this week.', icon: <Sparkles size={14} />, color: 'var(--warning)' },
        { type: 'Opportunity', text: '**Nexus Solutions** is prime for a "Batch Export" upsell.', icon: <Lightbulb size={14} />, color: 'var(--info)' },
    ];

    const handleSendChat = (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;

        const newHistory = [...chatHistory, { text: chatInput, isBot: false }];
        setChatHistory(newHistory);
        setChatInput('');

        // Simulate AI response
        setTimeout(() => {
            setChatHistory(prev => [...prev, {
                text: "I've analyzed that for you. Based on the current health metrics, I recommend scheduling a follow-up call with the executive sponsor.",
                isBot: true
            }]);
        }, 1000);
    };

    return (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 1000 }}>
            {isOpen ? (
                <div className="glass" style={{ width: '350px', borderRadius: '16px', padding: '1.25rem', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--accent-primary)', display: 'flex', flexDirection: 'column', maxHeight: '500px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '32px', height: '32px', background: 'var(--accent-primary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Bot size={20} color="white" />
                            </div>
                            <h4 style={{ fontSize: '0.9rem' }}>CX Guidance Assistant</h4>
                        </div>
                        <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <X size={18} />
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                        <button
                            onClick={() => setMode('insights')}
                            style={{ background: 'transparent', border: 'none', color: mode === 'insights' ? 'var(--accent-primary)' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                            Insights
                        </button>
                        <button
                            onClick={() => setMode('chat')}
                            style={{ background: 'transparent', border: 'none', color: mode === 'chat' ? 'var(--accent-primary)' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                            Chat
                        </button>
                    </div>

                    {mode === 'insights' ? (
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '1rem' }}>Smart Prompts</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {suggestions.map((s, idx) => (
                                    <div key={idx} style={{ padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                            <span style={{ color: s.color }}>{s.icon}</span>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: s.color }}>{s.type.toUpperCase()}</span>
                                        </div>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{s.text.split('**').map((t, i) => i % 2 === 1 ? <strong key={i} style={{ color: 'white' }}>{t}</strong> : t)}</p>
                                    </div>
                                ))}
                            </div>
                            <button className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem', padding: '10px', fontSize: '0.85rem' }} onClick={() => automateOutreach()}>
                                Automate Outreach <ChevronRight size={14} />
                            </button>
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'hidden' }}>
                            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '5px' }}>
                                {chatHistory.map((msg, idx) => (
                                    <div key={idx} style={{
                                        alignSelf: msg.isBot ? 'flex-start' : 'flex-end',
                                        background: msg.isBot ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
                                        padding: '8px 12px',
                                        borderRadius: msg.isBot ? '12px 12px 12px 0' : '12px 12px 0 12px',
                                        maxWidth: '85%',
                                        fontSize: '0.8rem'
                                    }}>
                                        {msg.text}
                                    </div>
                                ))}
                            </div>
                            <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                <input
                                    type="text"
                                    className="glass"
                                    placeholder="Ask anything..."
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'white' }}
                                />
                                <button type="submit" className="btn btn-primary" style={{ padding: '8px' }}>
                                    <Send size={16} />
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            ) : (
                <button
                    onClick={() => setIsOpen(true)}
                    style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '16px',
                        background: 'var(--accent-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        boxShadow: 'var(--shadow-glow)',
                        border: 'none',
                        cursor: 'pointer',
                        transition: '0.3s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <Bot size={28} />
                </button>
            )}
        </div>
    );
};

export default SmartAssistant;
