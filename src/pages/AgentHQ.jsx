import React, { useEffect, useState } from 'react';
import { Trophy, Flame, Zap, Users, KeyRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { agentsApi } from '../api/agents';
import './AgentHQ.css';

export default function AgentHQ() {
    const [roster, setRoster] = useState([]);
    const [state, setState] = useState(null);

    const load = () => {
        agentsApi.roster().then((r) => setRoster(r.agents)).catch(() => {});
        agentsApi.state().then(setState).catch(() => {});
    };
    useEffect(() => {
        load();
        const on = () => agentsApi.state().then(setState).catch(() => {});
        window.addEventListener('game-updated', on);
        return () => window.removeEventListener('game-updated', on);
    }, []);

    const unlocked = new Set((state?.achievements || []).map((a) => a.key));
    const onlineCount = roster.filter((a) => a.online).length;
    const xpPct = state ? Math.round((state.xpIntoLevel / state.xpPerLevel) * 100) : 0;

    return (
        <div className="animate-fade-in">
            <header className="hq-hero">
                <div>
                    <h1 className="hq-title">Agent HQ</h1>
                    <p className="hq-sub">Your AI squad, missions, and progress across the portal.</p>
                </div>
                {/* The bridge to bring-your-own-agent: mint a key, hand out the manifest. */}
                <Link to="/agent-access" className="hq-access-link">
                    <KeyRound size={15} /> Agent access &amp; keys
                </Link>
            </header>

            <div className="hq-command">
                <div className="glass-card hq-stat">
                    <div className="hq-stat-label"><Trophy size={14} /> Command Score</div>
                    <div className="hq-stat-value">{state?.commandScore ?? 0}</div>
                    <div className="hq-xp-bar"><div className="hq-xp-fill" style={{ width: `${xpPct}%` }} /></div>
                </div>
                <div className="glass-card hq-stat">
                    <div className="hq-stat-label"><Zap size={14} /> Level</div>
                    <div className="hq-stat-value">{state?.level ?? 1}</div>
                </div>
                <div className="glass-card hq-stat">
                    <div className="hq-stat-label"><Flame size={14} /> Streak</div>
                    <div className="hq-stat-value">{state?.streak ?? 0}<span style={{ fontSize: '1rem' }}> day</span></div>
                </div>
                <div className="glass-card hq-stat">
                    <div className="hq-stat-label"><Users size={14} /> Agents online</div>
                    <div className="hq-stat-value">{onlineCount}<span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}> / {roster.length}</span></div>
                </div>
            </div>

            <h2 className="hq-section-title">Achievements</h2>
            <div className="hq-ach-grid">
                {(state?.allAchievements || []).map((a) => {
                    const got = unlocked.has(a.key);
                    return (
                        <div key={a.key} className={`hq-ach ${got ? 'unlocked' : 'locked'}`}>
                            <div className="hq-ach-emoji">{got ? a.emoji : '🔒'}</div>
                            <div className="hq-ach-label">{a.label}</div>
                            <div className="hq-ach-desc">{a.desc}</div>
                        </div>
                    );
                })}
            </div>

            <h2 className="hq-section-title">Your squad</h2>
            <div className="hq-agents">
                {roster.map((a) => (
                    <div key={a.key} className={`glass-card hq-agent ${a.online ? 'online' : 'offline'}`}>
                        <div className="hq-agent-glow" style={{ background: a.color }} />
                        <div className="hq-agent-top">
                            <div className="hq-agent-avatar" style={{ background: `${a.color}22`, border: `1px solid ${a.color}55` }}>{a.emoji}</div>
                            <div style={{ flex: 1 }}>
                                <div className="hq-agent-name">{a.name}</div>
                                <div className="hq-agent-tagline">{a.tagline}</div>
                            </div>
                        </div>
                        <div className="hq-agent-meta">
                            <span className={`hq-agent-status ${a.online ? 'on' : 'off'}`}>{a.online ? 'Online' : 'Coming soon'}</span>
                            {a.online && a.key !== 'neo' && <span className="hq-agent-lvl">Lv {a.agentLevel} · {a.interactions} tasks</span>}
                            {a.key === 'neo' && <span className="hq-agent-lvl">Orchestrator</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
