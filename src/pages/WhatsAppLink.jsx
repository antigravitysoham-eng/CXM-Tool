import React, { useEffect, useState, useCallback } from 'react';
import { X, Copy, Check, RefreshCw, Trash2, ExternalLink, ShieldCheck } from 'lucide-react';
import { whatsappApi } from '../api/whatsapp';
import './WhatsAppLink.css';

/**
 * Connect-WhatsApp sheet.
 *
 * The whole trust model in one screen: you prove who you are here (signed in),
 * generate a short-lived code, and text it from your phone. The number then
 * answers only what *you* can see. We never ask for the phone number in the app
 * — the webhook learns it when the code arrives, so there's nothing to mistype
 * and no way to bind someone else's number.
 */

const onlyDigits = (s) => String(s || '').replace(/[^\d]/g, '');
const prettyPhone = (p) => (p?.startsWith('+') ? p : `+${onlyDigits(p)}`);

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

export default function WhatsAppLink({ open, onClose }) {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [code, setCode] = useState(null);
    const [expiresAt, setExpiresAt] = useState(null);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');
    const left = useCountdown(expiresAt);

    const refresh = useCallback(async () => {
        try { setStatus(await whatsappApi.status()); }
        catch (e) { setError(e.message || 'Could not load status'); }
    }, []);

    useEffect(() => {
        if (!open) return;
        setError(''); setCode(null); setExpiresAt(null);
        refresh();
    }, [open, refresh]);

    // A generated code lives for ~10 min; when it lapses, clear it so the UI
    // doesn't offer a dead code.
    useEffect(() => { if (code && left === 0) { setCode(null); setExpiresAt(null); } }, [left, code]);

    if (!open) return null;

    const business = status?.businessNumber;
    const businessDigits = onlyDigits(business);
    const waLink = businessDigits && code ? `https://wa.me/${businessDigits}?text=${code}` : null;

    const getCode = async () => {
        setLoading(true); setError(''); setCopied(false);
        try {
            const r = await whatsappApi.linkCode();
            setCode(r.code); setExpiresAt(r.expiresAt);
        } catch (e) { setError(e.message || 'Could not generate a code'); }
        finally { setLoading(false); }
    };

    const copy = async () => {
        try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }
        catch { /* clipboard blocked — the code is visible to type */ }
    };

    const unlink = async (phone) => {
        try { await whatsappApi.unlink(phone); await refresh(); }
        catch (e) { setError(e.message || 'Could not unlink'); }
    };

    const mm = String(Math.floor(left / 60)).padStart(1, '0');
    const ss = String(left % 60).padStart(2, '0');

    return (
        <div className="wal-scrim" onClick={onClose}>
            <div className="wal-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Connect WhatsApp">
                <header className="wal-head">
                    <div className="wal-title">
                        <span className="wal-logo">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.06c-.24.68-1.42 1.32-1.95 1.37-.53.05-1.02.24-3.44-.72-2.9-1.15-4.74-4.12-4.88-4.31-.14-.19-1.16-1.55-1.16-2.95 0-1.4.73-2.09.99-2.38.24-.27.53-.34.71-.34.18 0 .36 0 .51.01.16.01.39-.06.6.46.24.58.82 2 .89 2.14.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.38-.43.51-.14.14-.29.29-.12.57.17.29.76 1.25 1.63 2.02 1.12 1 2.06 1.31 2.35 1.46.29.14.46.12.63-.07.17-.19.73-.85.92-1.14.19-.29.39-.24.65-.14.26.09 1.67.79 1.96.93.29.14.48.22.55.34.07.12.07.69-.17 1.37Z" />
                            </svg>
                        </span>
                        <div>
                            <strong>Connect WhatsApp</strong>
                            <em>Ask AGCX from your chats</em>
                        </div>
                    </div>
                    <button className="wal-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
                </header>

                {status && !status.enabled && (
                    <div className="wal-note wal-note-warn">
                        WhatsApp isn’t switched on for this workspace yet. An admin needs to add the Cloud API
                        credentials on the server. You can still generate a code — it’ll work once the channel is live.
                    </div>
                )}

                <div className="wal-body">
                    <ol className="wal-steps">
                        <li>
                            <span className="wal-num">1</span>
                            <div>
                                <b>Message the AGCX number</b>
                                {business
                                    ? <p>Text <a className="wal-phone" href={businessDigits ? `https://wa.me/${businessDigits}` : undefined} target="_blank" rel="noreferrer">{prettyPhone(business)}</a> on WhatsApp.</p>
                                    : <p className="wal-muted">The business number will appear here once configured.</p>}
                            </div>
                        </li>
                        <li>
                            <span className="wal-num">2</span>
                            <div>
                                <b>Send your one-time code</b>
                                <p>Generate a code and send it to that number to link this account.</p>

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
                                            {waLink && (
                                                <a className="wal-mini wal-mini-go" href={waLink} target="_blank" rel="noreferrer">
                                                    <ExternalLink size={13} /> Open WhatsApp
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
                            <span><ShieldCheck size={14} /> Linked numbers</span>
                            <button className="wal-refresh" onClick={refresh} aria-label="Refresh"><RefreshCw size={13} /></button>
                        </div>
                        {status?.links?.length ? (
                            <ul>
                                {status.links.map((l) => (
                                    <li key={l.phone}>
                                        <span className="wal-lnum">{prettyPhone(l.phone)}</span>
                                        <button className="wal-unlink" onClick={() => unlink(l.phone)} aria-label="Unlink">
                                            <Trash2 size={14} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="wal-muted">No numbers linked yet. After you send your code, tap refresh.</p>
                        )}
                    </div>

                    {error && <div className="wal-note wal-note-err">{error}</div>}

                    <p className="wal-fine">
                        Answers over WhatsApp are scoped to your access — the number can only see what you can.
                        Reply <b>unlink</b> from WhatsApp any time to disconnect.
                    </p>
                </div>
            </div>
        </div>
    );
}
