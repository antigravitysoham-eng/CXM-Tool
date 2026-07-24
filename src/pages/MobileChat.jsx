import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, LayoutDashboard, WifiOff, RefreshCw, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { neoApi } from '../api/neo';
import WhatsAppLink from './WhatsAppLink';
import './MobileChat.css';

/**
 * The phone app.
 *
 * One screen: ask a question, get an answer from live data. It talks to the same
 * `/neo/ask` endpoint the desktop GPT view uses, so it inherits the permission
 * scoping — a phone shows exactly what its owner is allowed to see, no more.
 *
 * Built mobile-first rather than as a squeezed desktop page: a fixed composer at
 * the thumb, safe-area padding for the notch and home indicator, and no side rail.
 */

const STORE = 'agcx.m.thread';

/** NEO returns structured blocks alongside prose; render the ones worth showing
 *  on a phone and skip the rest rather than dumping JSON at the reader. */
function Blocks({ blocks }) {
    if (!blocks?.length) return null;
    return (
        <div className="mc-blocks">
            {blocks.map((b, i) => {
                if (b.type === 'stat' || b.type === 'stats') {
                    const items = b.items || b.stats || [];
                    return (
                        <div className="mc-stats" key={i}>
                            {items.map((s, j) => (
                                <div key={j}><span>{s.value ?? s.v}</span><em>{s.label ?? s.k}</em></div>
                            ))}
                        </div>
                    );
                }
                if (b.type === 'table' && b.rows?.length) {
                    return (
                        <div className="mc-table" key={i}>
                            {b.rows.slice(0, 8).map((r, j) => (
                                <div className="mc-trow" key={j}>
                                    <span>{r[0]}</span><b>{r[r.length - 1]}</b>
                                </div>
                            ))}
                            {b.rows.length > 8 && <div className="mc-more">+{b.rows.length - 8} more</div>}
                        </div>
                    );
                }
                if (b.type === 'list' && b.items?.length) {
                    return (
                        <ul className="mc-list" key={i}>
                            {b.items.slice(0, 8).map((it, j) => (
                                <li key={j}>{typeof it === 'string' ? it : (it.label || it.title || JSON.stringify(it))}</li>
                            ))}
                        </ul>
                    );
                }
                return null;
            })}
        </div>
    );
}

export default function MobileChat() {
    const { user } = useAuth();
    const [messages, setMessages] = useState(() => {
        try { return JSON.parse(sessionStorage.getItem(STORE)) || []; } catch { return []; }
    });
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [meta, setMeta] = useState(null);
    const [waOpen, setWaOpen] = useState(false);
    const [online, setOnline] = useState(navigator.onLine);
    const endRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => { neoApi.meta().then(setMeta).catch(() => {}); }, []);

    useEffect(() => {
        const on = () => setOnline(true);
        const off = () => setOnline(false);
        window.addEventListener('online', on);
        window.addEventListener('offline', off);
        return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
    }, []);

    useEffect(() => {
        sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-40)));
        endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [messages, sending]);

    const send = async (text) => {
        const q = (text ?? input).trim();
        if (!q || sending) return;
        setInput('');
        setMessages((m) => [...m, { role: 'user', text: q }]);
        setSending(true);
        try {
            const r = await neoApi.ask(q);
            setMessages((m) => [...m, {
                role: 'bot', text: r.reply, blocks: r.blocks,
                agent: r.relay ? { name: r.relay.name, emoji: r.relay.emoji } : null
            }]);
        } catch (e) {
            setMessages((m) => [...m, {
                role: 'bot', error: true,
                text: navigator.onLine
                    ? (e.message || 'That did not go through. Try again.')
                    : 'You are offline. This needs a connection — the numbers have to be live.'
            }]);
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    const suggestions = meta?.suggestions?.slice(0, 4) || [
        "How's the pipeline?", 'What renews in 60 days?', "What's at risk?", 'Top 5 accounts'
    ];

    return (
        <div className="mc">
            <header className="mc-top">
                <div className="mc-brand">
                    <span className="mc-orb">{meta?.neo?.emoji || '🧠'}</span>
                    <div>
                        <strong>NEO</strong>
                        <em>{online ? 'live · scoped to you' : 'offline'}</em>
                    </div>
                </div>
                <button className="mc-toDash" title="Connect WhatsApp" onClick={() => setWaOpen(true)} aria-label="Connect WhatsApp">
                    <MessageCircle size={17} />
                </button>
                <Link to="/" className="mc-toDash" title="Full dashboard"><LayoutDashboard size={17} /></Link>
            </header>

            <WhatsAppLink open={waOpen} onClose={() => setWaOpen(false)} />

            {!online && (
                <div className="mc-offline"><WifiOff size={13} /> No connection — answers need live data.</div>
            )}

            <main className="mc-thread">
                {messages.length === 0 && (
                    <div className="mc-hero">
                        <div className="mc-hero-orb">{meta?.neo?.emoji || '🧠'}</div>
                        <h1>Hello{user?.name ? `, ${user.name.split(' ')[0]}` : ''}.</h1>
                        <p>Ask about your book — pipeline, renewals, health, adoption. I read the same live data as the dashboard.</p>
                    </div>
                )}

                {messages.map((m, i) => (
                    <div key={i} className={`mc-msg ${m.role === 'user' ? 'is-user' : 'is-bot'} ${m.error ? 'is-error' : ''}`}>
                        {m.role === 'bot' && m.agent && (
                            <span className="mc-via">{m.agent.emoji} {m.agent.name}</span>
                        )}
                        <div className="mc-bubble">
                            {String(m.text || '').split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
                                p.startsWith('**') && p.endsWith('**')
                                    ? <strong key={j}>{p.slice(2, -2)}</strong>
                                    : <React.Fragment key={j}>{p}</React.Fragment>)}
                        </div>
                        <Blocks blocks={m.blocks} />
                    </div>
                ))}

                {sending && (
                    <div className="mc-msg is-bot">
                        <div className="mc-bubble mc-typing"><span /><span /><span /></div>
                    </div>
                )}
                <div ref={endRef} />
            </main>

            {messages.length === 0 && (
                <div className="mc-chips">
                    {suggestions.map((s) => (
                        <button key={s} onClick={() => send(s)}>{s}</button>
                    ))}
                </div>
            )}

            <form className="mc-composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
                {messages.length > 0 && (
                    <button type="button" className="mc-new" onClick={() => setMessages([])} title="New chat">
                        <RefreshCw size={15} />
                    </button>
                )}
                <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask NEO anything…"
                    enterKeyHint="send"
                    autoComplete="off"
                />
                <button type="submit" disabled={!input.trim() || sending} aria-label="Send">
                    <Send size={17} />
                </button>
            </form>
        </div>
    );
}
