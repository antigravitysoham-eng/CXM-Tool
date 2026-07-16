import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { X, Send, Sparkles, Target, BookMarked, ChevronDown } from 'lucide-react';
import { agentsApi } from '../api/agents';
import { confettiBurst } from '../utils/celebrate';
import './AgentDock.css';

// Route -> owning agent. NEO is the global fallback.
const ROUTE_AGENT = {
    '/': 'neo', '/cash-horizon': 'aukat', '/clm': 'quill', '/onboarding': 'pilot',
    '/training': 'sensei', '/health-checks': 'pulse', '/ebrs': 'aria', '/surveys': 'echo',
    '/journey': 'compass', '/support': 'medic', '/feature-requests': 'forge', '/upsells': 'rainmaker',
    '/comms': 'herald', '/events': 'ringmaster', '/referrals': 'magnet'
};

function renderRich(text) {
    return String(text).split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
            ? <strong key={i}>{part.slice(2, -2)}</strong>
            : <React.Fragment key={i}>{part}</React.Fragment>
    );
}

export default function AgentDock() {
    const location = useLocation();
    const [open, setOpen] = useState(false);
    const [roster, setRoster] = useState([]);
    const [state, setState] = useState(null);
    const [activeKey, setActiveKey] = useState('neo');
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [missions, setMissions] = useState([]);
    const [instructions, setInstructions] = useState([]);
    const [showInstr, setShowInstr] = useState(false);
    const [instrText, setInstrText] = useState('');
    const [celebrate, setCelebrate] = useState(null);
    const bodyRef = useRef(null);

    const routeKey = ROUTE_AGENT[location.pathname] || 'neo';
    const routeAgent = roster.find((a) => a.key === routeKey);
    const activeAgent = roster.find((a) => a.key === activeKey);

    const loadState = async () => {
        try { setState(await agentsApi.state()); } catch { /* noop */ }
    };
    useEffect(() => {
        agentsApi.roster().then((r) => setRoster(r.agents)).catch(() => {});
        loadState();
        const onUpdate = (e) => { if (e.detail?.state) setState(e.detail.state); else loadState(); };
        window.addEventListener('game-updated', onUpdate);
        return () => window.removeEventListener('game-updated', onUpdate);
    }, []);

    // Pick the active agent for the current route (fall back to NEO if offline).
    useEffect(() => {
        if (!roster.length) return;
        const ra = roster.find((a) => a.key === routeKey);
        const key = ra && ra.online ? routeKey : 'neo';
        setActiveKey(key);
        const agent = roster.find((a) => a.key === key);
        setMessages([{ role: 'bot', text: `Hi, I'm **${agent?.name}**. ${agent?.tagline} Ask me anything, or tap a mission.`, chips: [] }]);
        agentsApi.missions(key).then(setMissions).catch(() => setMissions([]));
        agentsApi.listInstructions(key).then(setInstructions).catch(() => setInstructions([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routeKey, roster.length]);

    useEffect(() => {
        if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }, [messages, sending]);

    const applyGame = (game) => {
        if (!game) return;
        setState(game.state);
        window.dispatchEvent(new CustomEvent('game-updated', { detail: game }));
        if (game.leveledUp) {
            setCelebrate({ emoji: '⭐', text: `Level ${game.state.level}!` });
            confettiBurst();
        } else if (game.newAchievements?.length) {
            const a = game.newAchievements[0];
            setCelebrate({ emoji: a.emoji, text: `Achievement: ${a.label}` });
            confettiBurst();
        }
        if (game.leveledUp || game.newAchievements?.length) setTimeout(() => setCelebrate(null), 3200);
    };

    const send = async (text) => {
        const msg = (text ?? input).trim();
        if (!msg || sending) return;
        setInput('');
        setMessages((m) => [...m, { role: 'user', text: msg }]);
        setSending(true);
        try {
            const res = await agentsApi.ask(activeKey, msg);
            setMessages((m) => [...m, { role: 'bot', text: res.reply, chips: res.chips || [] }]);
            applyGame(res.game);
            agentsApi.missions(activeKey).then(setMissions).catch(() => {});
        } catch (e) {
            setMessages((m) => [...m, { role: 'bot', text: e.message || 'I hit a snag — try again.' }]);
        } finally {
            setSending(false);
        }
    };

    const saveInstruction = async () => {
        const t = instrText.trim();
        if (!t) return;
        setInstrText('');
        try {
            const res = await agentsApi.addInstruction(activeKey, t);
            setInstructions(res.instructions);
            applyGame(res.game);
        } catch { /* noop */ }
    };

    const color = activeAgent?.color || '#6366f1';
    const level = state?.level || 1;
    const xpPct = state ? Math.round((state.xpIntoLevel / state.xpPerLevel) * 100) : 0;
    const lastChips = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'bot' && messages[i].chips?.length) return messages[i].chips;
        return [];
    }, [messages]);

    if (!open) {
        return (
            <>
                <button className="agent-fab" data-level={level} style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }} onClick={() => setOpen(true)} title={`Talk to ${activeAgent?.name || 'your agent'}`}>
                    <span className="agent-fab-pulse" style={{ color: `${color}55` }} />
                    <span>{activeAgent?.emoji || '🧠'}</span>
                </button>
                {celebrate && (
                    <div className="agent-celebrate"><div className="agent-celebrate-card"><span style={{ fontSize: '1.3rem' }}>{celebrate.emoji}</span> {celebrate.text}</div></div>
                )}
            </>
        );
    }

    return (
        <>
            <div className="agent-panel">
                <div className="agent-head" style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)` }}>
                    <div className="agent-head-top">
                        <div className="agent-avatar">{activeAgent?.emoji || '🧠'}</div>
                        <div className="agent-id">
                            <div className="agent-name">{activeAgent?.name}</div>
                            <div className="agent-tagline">{activeAgent?.tagline}</div>
                        </div>
                        <button className="agent-close" onClick={() => setOpen(false)}><X size={16} /></button>
                    </div>
                    <div className="agent-xp">
                        <div className="agent-xp-top">
                            <span>Level {level} · {state?.commandScore ?? 0} Command Score</span>
                            <span>{state?.streak ? `🔥 ${state.streak}` : ''}</span>
                        </div>
                        <div className="agent-xp-bar"><div className="agent-xp-fill" style={{ width: `${xpPct}%` }} /></div>
                    </div>
                    {routeAgent && !routeAgent.online && activeKey === 'neo' && (
                        <div className="agent-offline-note">{routeAgent.emoji} {routeAgent.name} comes online with its module — NEO's got you for now.</div>
                    )}
                </div>

                <div className="agent-body" ref={bodyRef}>
                    {missions.length > 0 && (
                        <div>
                            <div className="agent-section-h"><Target size={13} /> Missions</div>
                            <div className="agent-missions" style={{ marginTop: 6 }}>
                                {missions.map((m) => (
                                    <button key={m.id} className="agent-mission" onClick={() => send(m.title)}>
                                        <span className="agent-mission-emoji">{m.emoji}</span>
                                        <span className="agent-mission-body">
                                            <span className="agent-mission-title">{m.title}</span>
                                            <span className="agent-mission-detail">{m.detail}</span>
                                        </span>
                                        <span className="agent-mission-pts">+{m.points}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="agent-msgs">
                        {messages.map((m, i) => (
                            <div key={i} className={`agent-msg agent-msg--${m.role === 'user' ? 'user' : 'bot'}`}>{renderRich(m.text)}</div>
                        ))}
                        {sending && <div className="agent-typing">{activeAgent?.name} is thinking…</div>}
                    </div>

                    {!sending && lastChips.length > 0 && (
                        <div className="agent-chips">
                            {lastChips.map((c) => <button key={c} className="agent-chip" onClick={() => send(c)}>{c}</button>)}
                        </div>
                    )}

                    <div>
                        <div className="agent-section-h" onClick={() => setShowInstr((s) => !s)}>
                            <BookMarked size={13} /> Standing instructions ({instructions.length}) <ChevronDown size={13} style={{ transform: showInstr ? 'rotate(180deg)' : 'none' }} />
                        </div>
                        {showInstr && (
                            <div className="agent-instr" style={{ marginTop: 6 }}>
                                {instructions.map((ins) => <div key={ins.id} className="agent-instr-item">{ins.text}</div>)}
                                <div className="agent-instr-row">
                                    <input className="agent-input" placeholder={`Teach ${activeAgent?.name} a rule…`} value={instrText} onChange={(e) => setInstrText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveInstruction()} />
                                    <button className="agent-send" style={{ background: color }} onClick={saveInstruction}><Send size={16} /></button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="agent-foot">
                    <div className="agent-input-row">
                        <input className="agent-input" placeholder={`Ask ${activeAgent?.name}…`} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
                        <button className="agent-send" style={{ background: color }} disabled={sending} onClick={() => send()}><Send size={16} /></button>
                    </div>
                    <Link to="/agents" className="agent-hq-link" onClick={() => setOpen(false)}><Sparkles size={11} style={{ display: 'inline' }} /> Open Agent HQ</Link>
                </div>
            </div>
            {celebrate && (
                <div className="agent-celebrate"><div className="agent-celebrate-card"><span style={{ fontSize: '1.3rem' }}>{celebrate.emoji}</span> {celebrate.text}</div></div>
            )}
        </>
    );
}
