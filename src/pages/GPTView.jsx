import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Check, X, CornerDownLeft, ShieldCheck, ArrowRight, Plus, MessageSquare, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { neoApi } from '../api/neo';
import NeoBlocks from '../components/NeoBlocks';
import './GPTView.css';

const uid = (() => { let n = Date.now(); return () => ++n; })();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Types out a reply so an answer lands like speech rather than a page swap.
 * The visible text is derived from a counter rather than stored, so state only
 * ever changes inside the interval callback — never synchronously in the effect.
 */
function useTypewriter(full, enabled) {
    const animate = enabled && !reducedMotion();
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (!animate) return undefined;
        const step = Math.max(1, Math.round(full.length / 90));
        const t = setInterval(() => {
            setCount((c) => {
                if (c + step >= full.length) clearInterval(t);
                return c + step;
            });
        }, 16);
        return () => clearInterval(t);
    }, [full, animate]);
    return animate ? full.slice(0, count) : full;
}

/**
 * The hand-off, shown while NEO works.
 *
 * The agent and its task come from the server's real intent routing — NEO does
 * orchestrate, and the specialist named here is the one whose module answered.
 * The pacing is presentational: the work itself returns in milliseconds.
 */
function Relay({ phase, relay }) {
    const specialist = relay && phase !== 'parse';
    return (
        <div className="neo-msg neo-msg--neo">
            <div className="neo-avatar neo-avatar--thinking">🧠</div>
            <div className="neo-bubble neo-relay">
                <div className={`neo-relay-line ${phase === 'parse' ? 'is-live' : 'is-done'}`}>
                    {phase === 'parse' ? <span className="neo-spark" /> : <Check size={12} />}
                    <span>Reading your question</span>
                </div>

                {specialist && (
                    <div className={`neo-relay-line ${phase === 'route' ? 'is-live' : 'is-done'}`}>
                        {phase === 'route' ? <span className="neo-spark" /> : <Check size={12} />}
                        <span className="neo-handoff">
                            Handing to
                            <span className="neo-chip" style={{ '--agent': relay.color }}>
                                <em>{relay.emoji}</em>{relay.name}
                            </span>
                            <ArrowRight size={11} />
                        </span>
                    </div>
                )}

                {specialist && (phase === 'work' || phase === 'synth') && (
                    <div className={`neo-relay-line ${phase === 'work' ? 'is-live' : 'is-done'}`}>
                        {phase === 'work' ? <span className="neo-spark" style={{ '--agent': relay.color }} /> : <Check size={12} />}
                        <span><strong style={{ color: relay.color }}>{relay.name}</strong> is {relay.task}</span>
                    </div>
                )}

                {phase === 'synth' && (
                    <div className="neo-relay-line is-live">
                        <span className="neo-spark" />
                        <span>{specialist ? `Synthesising ${relay.name}'s feed` : 'Working on it'}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

function Reply({ msg, onConfirm, onDecline }) {
    const typed = useTypewriter(msg.reply || '', !msg.done);
    return (
        <div className="neo-msg neo-msg--neo">
            <div className="neo-avatar">🧠</div>
            <div className="neo-bubble">
                <div className="neo-who">
                    NEO
                    {msg.relay && (
                        <span className="neo-via">
                            via
                            <span className="neo-chip neo-chip--sm" style={{ '--agent': msg.relay.color }}>
                                <em>{msg.relay.emoji}</em>{msg.relay.name}
                            </span>
                        </span>
                    )}
                </div>
                {msg.reply && <p className="neo-reply">{typed}</p>}
                <NeoBlocks blocks={msg.blocks} />
                {msg.proposal && (
                    <div className={`neo-proposal ${msg.proposalState || ''}`}>
                        <div className="neo-proposal-head">
                            <ShieldCheck size={15} />
                            <strong>{msg.proposal.summary}</strong>
                            <span className="neo-proposal-tag">needs your confirmation</span>
                        </div>
                        <div className="neo-proposal-fields">
                            {msg.proposal.fields.map(([k, v]) => (
                                <div className="neo-proposal-field" key={k}>
                                    <span>{k}</span><strong>{v}</strong>
                                </div>
                            ))}
                        </div>
                        {!msg.proposalState && (
                            <div className="neo-proposal-actions">
                                <button className="neo-decline" onClick={() => onDecline(msg.id)}><X size={14} /> Discard</button>
                                <button className="neo-confirm" onClick={() => onConfirm(msg)}><Check size={14} /> Confirm &amp; create</button>
                            </div>
                        )}
                        {msg.proposalState === 'done' && <div className="neo-proposal-done"><Check size={14} /> Created</div>}
                        {msg.proposalState === 'declined' && <div className="neo-proposal-declined">Discarded — nothing was written.</div>}
                    </div>
                )}
            </div>
        </div>
    );
}

/** Chat sessions live in localStorage per user, like a local Claude sidebar. */
const sessionsKey = (userId) => `neo-chats-${userId || 'anon'}`;
const loadSessions = (userId) => {
    try { return JSON.parse(localStorage.getItem(sessionsKey(userId)) || '[]'); } catch { return []; }
};

export default function GPTView() {
    const { user } = useAuth();
    const [sessions, setSessions] = useState(() => loadSessions(user?.id));
    const [activeId, setActiveId] = useState(null); // null = fresh, unsaved chat
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [pending, setPending] = useState(null);
    const [meta, setMeta] = useState(null);
    const endRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => { neoApi.meta().then(setMeta).catch(() => {}); }, []);
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, pending]);
    useEffect(() => { inputRef.current?.focus(); }, [activeId]);

    // Every message lands in the active session (created on first message),
    // and the list is persisted — so a chat survives navigation and reload.
    useEffect(() => {
        if (!messages.length) return;
        setSessions((prev) => {
            let id = activeId;
            let next;
            if (!id) {
                id = `s${uid()}`;
                const firstUser = messages.find((m) => m.role === 'user');
                next = [{ id, title: (firstUser?.text || 'New chat').slice(0, 48), messages, updatedAt: Date.now() }, ...prev];
                // setState during render is illegal; defer the active switch.
                queueMicrotask(() => setActiveId(id));
            } else {
                next = prev.map((s) => (s.id === id ? { ...s, messages, updatedAt: Date.now() } : s));
                next.sort((a, b) => b.updatedAt - a.updatedAt);
            }
            try { localStorage.setItem(sessionsKey(user?.id), JSON.stringify(next.slice(0, 50))); } catch { /* storage full — keep going */ }
            return next;
        });
    }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

    const newChat = () => { setActiveId(null); setMessages([]); setInput(''); };
    const openChat = (s) => {
        setActiveId(s.id);
        // Restored replies never re-run the typewriter.
        setMessages(s.messages.map((m) => (m.role === 'neo' ? { ...m, done: true } : m)));
    };
    const deleteChat = (e, id) => {
        e.stopPropagation();
        setSessions((prev) => {
            const next = prev.filter((s) => s.id !== id);
            try { localStorage.setItem(sessionsKey(user?.id), JSON.stringify(next)); } catch { /* ignore */ }
            return next;
        });
        if (activeId === id) { setActiveId(null); setMessages([]); }
    };

    const send = useCallback(async (prompt) => {
        const q = String(prompt ?? '').trim();
        if (!q || pending) return;
        setInput('');
        setMessages((m) => [...m, { id: uid(), role: 'user', text: q }]);
        setPending({ phase: 'parse', relay: null });

        const beat = reducedMotion() ? 0 : 1;
        try {
            const r = await neoApi.ask(q);
            // Walk the hand-off the answer actually took.
            if (r.relay) {
                setPending({ phase: 'route', relay: r.relay });
                await sleep(420 * beat);
                setPending({ phase: 'work', relay: r.relay });
                await sleep(620 * beat);
                setPending({ phase: 'synth', relay: r.relay });
                await sleep(380 * beat);
            } else {
                setPending({ phase: 'synth', relay: null });
                await sleep(320 * beat);
            }
            setMessages((m) => [...m, { id: uid(), role: 'neo', ...r }]);
        } catch (e) {
            setMessages((m) => [...m, { id: uid(), role: 'neo', reply: e.message, blocks: [], done: true }]);
        } finally {
            setPending(null);
        }
    }, [pending]);

    const confirm = async (msg) => {
        setMessages((m) => m.map((x) => (x.id === msg.id ? { ...x, proposalState: 'pending' } : x)));
        try {
            const r = await neoApi.confirm(msg.proposal);
            setMessages((m) => [
                ...m.map((x) => (x.id === msg.id ? { ...x, proposalState: 'done' } : x)),
                { id: uid(), role: 'neo', reply: r.reply, blocks: r.blocks, done: false }
            ]);
        } catch (e) {
            setMessages((m) => [
                ...m.map((x) => (x.id === msg.id ? { ...x, proposalState: null } : x)),
                { id: uid(), role: 'neo', reply: e.message, blocks: [], done: true }
            ]);
        }
    };

    const decline = (id) => setMessages((m) => m.map((x) => (x.id === id ? { ...x, proposalState: 'declined' } : x)));

    const onKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
    };

    const empty = messages.length === 0 && !pending;

    return (
        <div className="neo-view neo-view--split">
            {/* Chat sessions — a local sidebar, like Claude's. */}
            <aside className="neo-sidebar">
                <button className="neo-newchat" onClick={newChat}><Plus size={15} /> New chat</button>
                <div className="neo-chatlist">
                    {sessions.length === 0 && <div className="neo-chatlist-empty">Your chats will appear here.</div>}
                    {sessions.map((s) => (
                        <button key={s.id} className={`neo-chatitem ${s.id === activeId ? 'is-active' : ''}`} onClick={() => openChat(s)} title={s.title}>
                            <MessageSquare size={13} />
                            <span className="neo-chatitem-title">{s.title}</span>
                            <span className="neo-chatitem-x" role="button" tabIndex={-1} onClick={(e) => deleteChat(e, s.id)} title="Delete chat"><Trash2 size={12} /></span>
                        </button>
                    ))}
                </div>
            </aside>

            <div className="neo-main">
            <div className="neo-scroll">
                {empty ? (
                    <div className="neo-hero">
                        <div className="neo-hero-orb">{meta?.neo?.emoji || '🧠'}</div>
                        <h1>Good to see you, {user?.name?.split(' ')[0] || 'there'}.</h1>
                        <p>
                            Ask me anything about your book — I read the same data as your dashboard,
                            scoped to exactly what you're allowed to see. I'll pull in a specialist
                            where one's needed. You can also just tell me to add things.
                        </p>
                        <div className="neo-suggestions">
                            {(meta?.suggestions || []).map((s) => (
                                <button key={s} onClick={() => send(s)}>{s}</button>
                            ))}
                        </div>

                        {/* Agent HQ, quietly: who NEO can call on — permission-gated,
                            so this only ever names agents this user may use. */}
                        {meta?.crew?.length > 0 && (
                            <div className="neo-crew">
                                <span className="neo-crew-label">NEO can call on</span>
                                <div className="neo-crew-list">
                                    {meta.crew.map((a) => (
                                        <span className="neo-crew-chip" key={a.key} style={{ '--agent': a.color }} title={a.tagline}>
                                            <em>{a.emoji}</em>{a.name}
                                        </span>
                                    ))}
                                </div>
                                <Link to="/agents" className="neo-crew-link">Agent HQ <ArrowRight size={11} /></Link>
                            </div>
                        )}
                    </div>
                ) : (
                    messages.map((m) => (
                        m.role === 'user' ? (
                            <div className="neo-msg neo-msg--me" key={m.id}>
                                <div className="neo-bubble neo-bubble--me">{m.text}</div>
                            </div>
                        ) : (
                            <Reply key={m.id} msg={m} onConfirm={confirm} onDecline={decline} />
                        )
                    ))
                )}
                {pending && <Relay phase={pending.phase} relay={pending.relay} />}
                <div ref={endRef} />
            </div>

            <div className="neo-composer-wrap">
                <div className="neo-composer">
                    <textarea
                        ref={inputRef}
                        rows={1}
                        value={input}
                        placeholder="Ask about pipeline, renewals, an account — or say “add prospect …”"
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={onKeyDown}
                    />
                    <button className="neo-send" onClick={() => send(input)} disabled={!!pending || !input.trim()}>
                        <Send size={16} />
                    </button>
                </div>
                <div className="neo-hint"><CornerDownLeft size={11} /> Enter to send · Shift+Enter for a new line · NEO only ever sees what you can</div>
            </div>
            </div>
        </div>
    );
}
