import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Flame } from 'lucide-react';
import { agentsApi } from '../api/agents';

// Always-visible gamification badge (level, command score, streak) -> Agent HQ.
export default function GameBadge() {
    const [state, setState] = useState(null);

    const load = () => agentsApi.state().then(setState).catch(() => {});
    useEffect(() => {
        load();
        const on = (e) => { if (e.detail?.state) setState(e.detail.state); else load(); };
        window.addEventListener('game-updated', on);
        return () => window.removeEventListener('game-updated', on);
    }, []);

    if (!state) return null;
    const xpPct = Math.round((state.xpIntoLevel / state.xpPerLevel) * 100);

    return (
        <Link
            to="/agents"
            title="Open Agent HQ"
            style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', borderRadius: 12,
                background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.28)',
                textDecoration: 'none', color: 'var(--text-primary)'
            }}
        >
            <div style={{
                width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center',
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                color: '#fff', fontWeight: 800, fontSize: '0.72rem', fontFamily: "'Outfit', sans-serif"
            }}>L{state.level}</div>
            <div style={{ minWidth: 70 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', fontWeight: 700 }}>
                    <Trophy size={12} color="var(--accent-secondary)" /> {state.commandScore}
                </div>
                <div style={{ height: 4, borderRadius: 3, background: 'var(--veil-4)', marginTop: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${xpPct}%`, background: 'var(--accent-primary)', borderRadius: 3, transition: 'width 0.4s ease' }} />
                </div>
            </div>
            {state.streak > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.78rem', fontWeight: 700, color: '#fb923c' }}>
                    <Flame size={13} /> {state.streak}
                </div>
            )}
        </Link>
    );
}
