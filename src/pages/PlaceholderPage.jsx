import React from 'react';

const PlaceholderPage = ({ title }) => {
    return (
        <div className="animate-fade-in">
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{title}</h1>
                <p style={{ color: 'var(--text-secondary)' }}>This module is currently under development. Stay tuned for updates.</p>
            </header>

            <div className="glass-card" style={{ padding: '4rem', textAlign: 'center' }}>
                <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: 'rgba(99, 102, 241, 0.1)',
                    margin: '0 auto 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-primary)'
                }}>
                    <div style={{ width: '40px', height: '40px', border: '4px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 2s linear infinite' }}></div>
                </div>
                <h3 style={{ marginBottom: '1rem' }}>Fleshing out the {title} logic...</h3>
                <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>
                    We are building a robust backend integration for this module to provide real-time tracking and insights.
                </p>
            </div>

            <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
};

export default PlaceholderPage;
