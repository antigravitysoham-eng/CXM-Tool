import React, { useEffect, useState } from 'react';
import { Trophy, Flame, Zap, Users, KeyRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { agentsApi } from '../api/agents';
import './AgentHQ.css';
import Modal from '../components/Modal';
import NeoMark from '../components/NeoMark';

// NEO wears its neural-brain mark; everyone else keeps their emoji.
const face = (agent, size) => (agent?.key === 'neo' ? <NeoMark size={size} /> : agent?.emoji);

export default function AgentHQ() {
    const [roster, setRoster] = useState([]);
    const [state, setState] = useState(null);
    const [openAgent, setOpenAgent] = useState(null);

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
                    <button key={a.key} type="button"
                        className={`glass-card hq-agent ${a.online ? 'online' : 'offline'}`}
                        onClick={() => a.online && setOpenAgent(a.key)}
                        disabled={!a.online}
                        title={a.online ? `See what ${a.name} has been asked` : `${a.name} is not online yet`}>
                        <div className="hq-agent-glow" style={{ background: a.color }} />
                        <div className="hq-agent-top">
                            <div className="hq-agent-avatar" style={{ background: `${a.color}22`, border: `1px solid ${a.color}55` }}>{face(a, 24)}</div>
                            <div style={{ flex: 1 }}>
                                <div className="hq-agent-name">{a.name}</div>
                                <div className="hq-agent-tagline">{a.tagline}</div>
                            </div>
                        </div>
                        {/* The agent's actual record, so the card answers "has this
                            thing done anything?" without opening it. */}
                        {a.online && (
                            <div className="hq-agent-perf">
                                <span><b>{a.perf?.asked ?? 0}</b> asked</span>
                                <span><b>{a.perf?.resolved ?? 0}</b> resolved</span>
                                <span className={a.perf?.resolveRate >= 80 ? 'is-good' : a.perf?.resolveRate >= 50 ? 'is-mid' : 'is-low'}>
                                    {a.perf?.resolveRate == null ? '—' : `${a.perf.resolveRate}%`}
                                </span>
                            </div>
                        )}
                        <div className="hq-agent-meta">
                            <span className={`hq-agent-status ${a.online ? 'on' : 'off'}`}>{a.online ? 'Online' : 'Coming soon'}</span>
                            {a.online && a.key !== 'neo' && <span className="hq-agent-lvl">Lv {a.agentLevel} · {a.interactions} tasks</span>}
                            {a.key === 'neo' && <span className="hq-agent-lvl">Orchestrator</span>}
                        </div>
                    </button>
                ))}
            </div>

            {openAgent && <AgentProfile agentKey={openAgent} onClose={() => setOpenAgent(null)} />}
        </div>
    );
}

/**
 * One agent's record.
 *
 * The question this answers is "what has this agent actually done for me" —
 * how often it was asked, how often it answered rather than falling through to
 * help, what people keep asking it, and the last dozen exchanges verbatim.
 */
function AgentProfile({ agentKey, onClose }) {
    const [p, setP] = useState(null);
    const [err, setErr] = useState('');
    // Stamped when the profile loads rather than read during render — "now" is
    // not a pure value, and re-reading it mid-render is what the purity rule
    // exists to catch.
    const [loadedAt, setLoadedAt] = useState(0);

    useEffect(() => {
        let alive = true;
        agentsApi.profile(agentKey)
            .then((r) => { if (alive) { setP(r); setLoadedAt(Date.now()); } })
            .catch((e) => alive && setErr(e.message || 'Could not load this agent'));
        return () => { alive = false; };
    }, [agentKey]);

    const when = (iso) => {
        if (!iso) return 'never';
        const mins = Math.round((loadedAt - new Date(iso).getTime()) / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
        return `${Math.round(mins / 1440)}d ago`;
    };
    const peak = p ? Math.max(1, ...p.activity.map((d) => d.count)) : 1;

    return (
        <Modal isOpen onClose={onClose} title={p ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{face(p, 20)} {p.name}</span> : 'Agent'} maxWidth="720px">
            {err && <div className="ch-error">{err}</div>}
            {!err && !p && <div className="ch-empty">Reading the log…</div>}
            {p && (
                <div className="hq-prof" style={{ '--c': p.color }}>
                    <p className="hq-prof-tag">{p.tagline}</p>

                    <div className="hq-prof-stats">
                        <div><span>{p.stats.asked}</span><em>questions asked</em></div>
                        <div><span>{p.stats.resolved}</span><em>answered</em></div>
                        <div>
                            <span className={p.stats.resolveRate >= 80 ? 'is-good' : p.stats.resolveRate >= 50 ? 'is-mid' : 'is-low'}>
                                {p.stats.resolveRate == null ? '—' : `${p.stats.resolveRate}%`}
                            </span><em>resolve rate</em>
                        </div>
                        <div><span>{p.stats.avgMs == null ? '—' : `${p.stats.avgMs}ms`}</span><em>avg response</em></div>
                        <div><span>{p.stats.last7}</span><em>last 7 days</em></div>
                        <div><span className="hq-prof-when">{when(p.stats.lastAt)}</span><em>last asked</em></div>
                    </div>

                    <h4 className="hq-prof-h">Activity · last 14 days</h4>
                    <div className="hq-prof-spark">
                        {p.activity.map((d) => (
                            <span key={d.day} title={`${d.day} · ${d.count}`}
                                style={{ height: `${Math.max(4, Math.round((d.count / peak) * 100))}%` }}
                                className={d.count ? 'has' : ''} />
                        ))}
                    </div>

                    {p.topIntents.length > 0 && (
                        <>
                            <h4 className="hq-prof-h">What it is asked most</h4>
                            <div className="hq-prof-intents">
                                {p.topIntents.map((t) => (
                                    <div key={t.intent} className="hq-prof-intent">
                                        <span className="hq-prof-intent-name">{t.intent}</span>
                                        <span className="hq-prof-intent-bar">
                                            <span style={{ width: `${Math.round((t.count / p.topIntents[0].count) * 100)}%` }} />
                                        </span>
                                        <span className="hq-prof-intent-n">{t.count}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    <h4 className="hq-prof-h">Recent questions</h4>
                    <div className="hq-prof-log">
                        {p.recent.length === 0 && <div className="ch-muted" style={{ padding: '.8rem' }}>Nobody has asked {p.name} anything yet.</div>}
                        {p.recent.map((r, i) => (
                            <div key={i} className={`hq-prof-row ${r.resolved ? '' : 'is-unres'}`}>
                                <span className="hq-prof-dot" />
                                <span className="hq-prof-q" title={r.prompt}>{r.prompt}</span>
                                <span className="hq-prof-when">{when(r.at)}</span>
                            </div>
                        ))}
                    </div>
                    {p.stats.unresolved > 0 && (
                        <p className="hq-prof-note">
                            {p.stats.unresolved} of {p.stats.asked} fell through without a real answer — those are
                            the phrasings worth teaching it next.
                        </p>
                    )}
                </div>
            )}
        </Modal>
    );
}
