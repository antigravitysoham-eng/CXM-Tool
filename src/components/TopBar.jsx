import React from 'react';
import { Search, Bell, User, MessageSquare } from 'lucide-react';

const TopBar = () => {
    return (
        <div className="top-bar glass" style={{
            height: '70px',
            width: 'calc(100% - 280px)',
            position: 'fixed',
            top: 0,
            left: '280px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 2rem',
            borderBottom: '1px solid var(--border-color)',
            zIndex: 90
        }}>
            <div className="search-container" style={{ position: 'relative', width: '400px' }}>
                <Search
                    size={18}
                    style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                />
                <input
                    type="text"
                    placeholder="Search customers, contracts, or tasks..."
                    style={{
                        width: '100%',
                        padding: '10px 15px 10px 40px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        fontSize: '0.9rem'
                    }}
                />
            </div>

            <div className="actions" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button className="btn-ghost" style={{ padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageSquare size={20} />
                </button>
                <button className="btn-ghost" style={{ padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <Bell size={20} />
                    <span style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        width: '8px',
                        height: '8px',
                        background: 'var(--danger)',
                        borderRadius: '50%',
                        border: '2px solid var(--bg-primary)'
                    }}></span>
                </button>
                <div style={{
                    width: '1px',
                    height: '24px',
                    background: 'var(--border-color)',
                    margin: '0 0.5rem'
                }}></div>
                <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>Alex Rivera</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Customer Success Lead</p>
                    </div>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, var(--accent-secondary), var(--accent-primary))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(255, 255, 255, 0.2)'
                    }}>
                        <User size={22} color="white" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TopBar;
