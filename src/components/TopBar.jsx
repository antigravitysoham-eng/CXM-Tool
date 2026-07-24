import React, { useState } from 'react';
import { Sparkles, User, LogOut, ArrowRight, MessageCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useView } from '../context/view';
import ThemeSwitcher from './ThemeSwitcher';
import ViewSwitcher from './ViewSwitcher';
import WhatsAppLink from '../pages/WhatsAppLink';
import './TopBar.css';

const TopBar = () => {
    const { user, logout } = useAuth();
    const { setView, warp } = useView();
    const navigate = useNavigate();
    const onGpt = useLocation().pathname === '/gpt';
    const [q, setQ] = useState('');
    const [waOpen, setWaOpen] = useState(false);

    // The search bar is NEO's front door: a question here jumps into the GPT view
    // and asks it, carried through as ?q= so NEO auto-answers on arrival.
    const askNeo = () => {
        const query = q.trim();
        if (!query) return;
        setQ('');
        warp(() => { setView('gpt'); navigate(`/gpt?q=${encodeURIComponent(query)}`); });
    };

    return (
        <div className="top-bar glass" style={{
            height: '70px',
            width: 'calc(100% - var(--rail, 280px))',
            position: 'fixed',
            top: 0,
            left: 'var(--rail, 280px)',
            transition: 'left 0.38s cubic-bezier(0.4, 0, 0.2, 1), width 0.38s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 2rem',
            borderBottom: '1px solid var(--border-color)',
            zIndex: 90
        }}>
            {/* On the GPT surface the search bar is redundant — NEO is right there. */}
            {!onGpt ? (
                <div className="neo-search" role="search">
                    <Sparkles size={18} className="neo-search-spark" />
                    <input
                        type="text"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') askNeo(); }}
                        placeholder="Ask NEO anything…"
                        aria-label="Ask NEO anything"
                    />
                    <button className="neo-search-go" onClick={askNeo} disabled={!q.trim()} title="Ask NEO">
                        <ArrowRight size={16} />
                    </button>
                </div>
            ) : <div />}

            <div className="actions" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <ViewSwitcher />
                <ThemeSwitcher />
                {/* Connect WhatsApp — generate the link code without leaving the app. */}
                <button
                    onClick={() => setWaOpen(true)}
                    className="btn-ghost"
                    style={{ padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#25D366' }}
                    title="Connect WhatsApp assistant"
                    aria-label="Connect WhatsApp assistant"
                >
                    <MessageCircle size={20} />
                </button>
                <WhatsAppLink open={waOpen} onClose={() => setWaOpen(false)} />
                {/* The full profile block only clutters the focused GPT surface. */}
                {!onGpt && (
                    <>
                        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', margin: '0 0.5rem' }} />
                        <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user?.name || 'Loading...'}</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.email || 'Authenticated User'}</p>
                            </div>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '12px',
                                background: 'linear-gradient(135deg, var(--accent-secondary), var(--accent-primary))',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '1px solid rgba(255, 255, 255, 0.2)'
                            }}>
                                <User size={22} color="white" />
                            </div>
                        </div>
                    </>
                )}

                <button
                    onClick={logout}
                    className="btn-ghost"
                    style={{ padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '4px', color: '#f87171' }}
                    title="Log out"
                >
                    <LogOut size={20} />
                </button>
            </div>
        </div>
    );
};

export default TopBar;
