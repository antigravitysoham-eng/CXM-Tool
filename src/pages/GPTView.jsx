import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Sparkles, Check, X, LayoutDashboard, CornerDownLeft, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useView } from '../context/view';
import { neoApi } from '../api/neo';
import NeoBlocks from '../components/NeoBlocks';
import './GPTView.css';

const uid = (() => { let n = 0; return () => ++n; })();

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

function Reply({ msg, onConfirm, onDecline }) {
    const typed = useTypewriter(msg.reply || '', !msg.done);
    return (
        <div className="neo-msg neo-msg--neo">
            <div className="neo-avatar">🧠</div>
            <div className="neo-bubble">
                <div className="neo-who">NEO</div>
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

export default function GPTView() {
    const { user } = useAuth();
    const { setView } = useView();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [meta, setMeta] = useState(null);
    const endRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => { neoApi.meta().then(setMeta).catch(() => {}); }, []);
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);
    useEffect(() => { inputRef.current?.focus(); }, []);

    const send = useCallback(async (prompt) => {
        const q = String(prompt ?? '').trim();
        if (!q || busy) return;
        setInput('');
        setMessages((m) => [...m, { id: uid(), role: 'user', text: q }]);
        setBusy(true);
        try {
            const r = await neoApi.ask(q);
            setMessages((m) => [...m, { id: uid(), role: 'neo', ...r }]);
        } catch (e) {
            setMessages((m) => [...m, { id: uid(), role: 'neo', reply: e.message, blocks: [], done: true }]);
        } finally {
            setBusy(false);
        }
    }, [busy]);

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

    const empty = messages.length === 0;

    return (
        <div className="neo-view">
            <aside className="neo-side">
                <div className="neo-side-head">
                    <Sparkles size={15} />
                    <span>Agent HQ</span>
                </div>
                <p className="neo-side-sub">NEO orchestrates. Specialists cover their modules.</p>
                <div className="neo-roster">
                    {(meta?.agents || []).map((a) => (
                        <button
                            key={a.key}
                            className="neo-agent"
                            style={{ '--agent': a.color }}
                            title={a.personality || a.tagline}
                            onClick={() => send(a.key === 'neo' ? "How's the pipeline?" : `Tell me about ${a.module === 'clm' ? 'renewals' : 'the pipeline'}`)}
                        >
                            <span className="neo-agent-emoji">{a.emoji}</span>
                            <span className="neo-agent-body">
                                <span className="neo-agent-name">{a.name}</span>
                                <span className="neo-agent-tag">{a.tagline}</span>
                            </span>
                            <span className="neo-agent-dot" />
                        </button>
                    ))}
                </div>
                <button className="neo-switch" onClick={() => { setView('dashboard'); navigate('/'); }}>
                    <LayoutDashboard size={15} /> Switch to dashboard
                </button>
            </aside>

            <main className="neo-main">
                <div className="neo-scroll">
                    {empty ? (
                        <div className="neo-hero">
                            <div className="neo-hero-orb">🧠</div>
                            <h1>Good to see you, {user?.name?.split(' ')[0] || 'there'}.</h1>
                            <p>
                                Ask me anything about your book — I read the same data as your dashboard,
                                scoped to exactly what you're allowed to see. You can also just tell me to add things.
                            </p>
                            <div className="neo-suggestions">
                                {(meta?.suggestions || []).map((s) => (
                                    <button key={s} onClick={() => send(s)}>{s}</button>
                                ))}
                            </div>
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
                    {busy && (
                        <div className="neo-msg neo-msg--neo">
                            <div className="neo-avatar neo-avatar--thinking">🧠</div>
                            <div className="neo-bubble neo-bubble--thinking">
                                <span className="neo-dot" /><span className="neo-dot" /><span className="neo-dot" />
                            </div>
                        </div>
                    )}
                    <div ref={endRef} />
                </div>

                <div className="neo-composer">
                    <textarea
                        ref={inputRef}
                        rows={1}
                        value={input}
                        placeholder="Ask about pipeline, renewals, an account — or say “add prospect …”"
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={onKeyDown}
                    />
                    <button className="neo-send" onClick={() => send(input)} disabled={busy || !input.trim()}>
                        <Send size={16} />
                    </button>
                </div>
                <div className="neo-hint"><CornerDownLeft size={11} /> Enter to send · Shift+Enter for a new line · NEO only ever sees what you can</div>
            </main>
        </div>
    );
}
