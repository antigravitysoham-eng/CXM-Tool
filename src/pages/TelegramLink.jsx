import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, RefreshCw, Trash2, ExternalLink, ShieldCheck, Send } from 'lucide-react';
import { telegramApi } from '../api/telegram';
import './WhatsAppLink.css';
import './TelegramLink.css';

/**
 * Connect-Telegram sheet — the twin of the WhatsApp link screen.
 *
 * Prove who you are here (signed in), generate a short-lived code, and send it to
 * the assistant bot on Telegram (one tap via the deep link). The chat then answers
 * only what *you* can see. Same one-time code the WhatsApp screen uses.
 */

function useCountdown(expiresAt) {
    const [left, setLeft] = useState(0);
    useEffect(() => {
        if (!expiresAt) return undefined;
        const tick = () => setLeft(Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)));
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [expiresAt]);
    return left;
}

export default function TelegramLink({ open, onClose }) {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [code, setCode] = useState(null);
    const [expiresAt, setExpiresAt] = useState(null);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');
    const left = useCountdown(expiresAt);

    const refresh = useCallback(async () => {
        try { setStatus(await telegramApi.status()); }
        catch (e) { setError(e.message || 'Could not load status'); }
    }, []);

    useEffect(() => {
        if (!open) return;
        setError(''); setCode(null); setExpiresAt(null);
        refresh();
    }, [open, refresh]);

    useEffect(() => { if (code && left === 0) { setCode(null); setExpiresAt(null); } }, [left, code]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    const username = status?.username;
    const botLink = username ? `https://t.me/${username}` : null;
    const deepLink = username && code ? `https://t.me/${username}?start=${code}` : null;

    const getCode = async () => {
        setLoading(true); setError(''); setCopied(false);
        try {
            const r = await telegramApi.linkCode();
            setCode(r.code); setExpiresAt(r.expiresAt);
        } catch (e) { setError(e.message || 'Could not generate a code'); }
        finally { setLoading(false); }
    };

    const copy = async () => {
        try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }
        catch { /* clipboard blocked — the code is visible to type */ }
    };

    const unlink = async (telegramId) => {
        try { await telegramApi.unlink(telegramId); await refresh(); }
        catch (e) { setError(e.message || 'Could not unlink'); }
    };

    const mm = String(Math.floor(left / 60)).padStart(1, '0');
    const ss = String(left % 60).padStart(2, '0');

    return createPortal(
        <div className="wal-scrim" onClick={onClose}>
            <div className="wal-sheet wal-tg" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Connect Telegram">
                <header className="wal-head">
                    <div className="wal-title">
                        <span className="wal-logo" style={{ background: 'linear-gradient(135deg,#2AABEE,#229ED9)' }}>
                            <Send size={16} />
                        </span>
                        <div>
                            <strong>Connect Telegram</strong>
                            <em>Ask AGCX from your chats</em>
                        </div>
                    </div>
                    <button className="wal-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
                </header>

                {status && !status.enabled && (
                    <div className="wal-note wal-note-warn">
                        The Telegram assistant isn’t switched on for this workspace yet. An admin needs to add the
                        bot token on the server. You can still generate a code — it’ll work once the channel is live.
                    </div>
                )}

                {status?.activated && (
                    <div className="wal-note" style={{ margin: '0 1.1rem 1rem', background: 'rgba(34,158,217,.12)', border: '1px solid rgba(34,158,217,.4)', color: '#229ED9' }}>
                        ✅ <b>Active</b> — your Telegram is connected. Ask AGCX anything from that chat.
                    </div>
                )}

                <div className="wal-body">
                    <ol className="wal-steps">
                        <li>
                            <span className="wal-num">1</span>
                            <div>
                                <b>Open the AGCX assistant on Telegram</b>
                                {botLink
                                    ? <p>Message <a className="wal-phone" href={botLink} target="_blank" rel="noreferrer">@{username}</a> on Telegram.</p>
                                    : <p className="wal-muted">The bot handle will appear here once the assistant is configured.</p>}
                            </div>
                        </li>
                        <li>
                            <span className="wal-num">2</span>
                            <div>
                                <b>Send your one-time code</b>
                                <p>Generate a code and send it to the bot — or just tap <b>Open Telegram</b> to send it in one step.</p>

                                {!code ? (
                                    <button className="wal-cta" onClick={getCode} disabled={loading}>
                                        {loading ? 'Generating…' : 'Get my code'}
                                    </button>
                                ) : (
                                    <div className="wal-codebox">
                                        <div className="wal-code">
                                            {code.split('').map((d, i) => <span key={i}>{d}</span>)}
                                        </div>
                                        <div className="wal-codeactions">
                                            <button onClick={copy} className="wal-mini">
                                                {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                                            </button>
                                            {deepLink && (
                                                <a className="wal-mini wal-mini-go" href={deepLink} target="_blank" rel="noreferrer">
                                                    <ExternalLink size={13} /> Open Telegram
                                                </a>
                                            )}
                                        </div>
                                        <p className="wal-expiry">Expires in {mm}:{ss} · single use</p>
                                    </div>
                                )}
                            </div>
                        </li>
                    </ol>

                    <div className="wal-linked">
                        <div className="wal-linked-head">
                            <span><ShieldCheck size={14} /> Linked chats</span>
                            <button className="wal-refresh" onClick={refresh} aria-label="Refresh"><RefreshCw size={13} /></button>
                        </div>
                        {status?.links?.length ? (
                            <ul>
                                {status.links.map((l) => (
                                    <li key={l.telegram_id}>
                                        <span className="wal-lnum">{l.username ? `@${l.username}` : (l.first_name || `id ${l.telegram_id}`)}</span>
                                        <button className="wal-unlink" onClick={() => unlink(l.telegram_id)} aria-label="Unlink">
                                            <Trash2 size={14} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="wal-muted">No chats linked yet. After you send your code, tap refresh.</p>
                        )}
                    </div>

                    {error && <div className="wal-note wal-note-err">{error}</div>}

                    <p className="wal-fine">
                        Answers over Telegram are scoped to your access — the chat can only see what you can.
                        Send <b>unlink</b> from Telegram any time to disconnect.
                    </p>
                </div>
            </div>
        </div>,
        document.body
    );
}
