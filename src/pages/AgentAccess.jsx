import React, { useState, useEffect, useCallback } from 'react';
import {
    KeyRound, Plus, Trash2, Copy, Check, X, ShieldCheck, Activity,
    AlertTriangle, Download, Radio, FileCode, Terminal, BookOpen
} from 'lucide-react';
import { agentKeysApi } from '../api/agentKeys';
import StatCard from '../components/StatCard';
import Modal from '../components/Modal';
import './CashHorizon.css';
import './AgentAccess.css';

const fmtWhen = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const ACTION_CLASS = { request: 'ok', takeover: 'warn', lease_conflict: 'bad', denied: 'bad' };

function CopyButton({ text, label = 'Copy' }) {
    const [done, setDone] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setDone(true);
            setTimeout(() => setDone(false), 1600);
        } catch { /* clipboard blocked; user can select manually */ }
    };
    return (
        <button className="agk-copy" onClick={copy}>
            {done ? <><Check size={13} /> Copied</> : <><Copy size={13} /> {label}</>}
        </button>
    );
}

export default function AgentAccess() {
    const [keys, setKeys] = useState([]);
    const [mintable, setMintable] = useState([]);
    const [sessions, setSessions] = useState({ sessions: [], swarmAttempts: 0 });
    const [audit, setAudit] = useState([]);
    const [error, setError] = useState('');
    const [minting, setMinting] = useState(false);
    const [freshSecret, setFreshSecret] = useState(null); // { secret, agent_name, id, agent_key }
    const [manifestFor, setManifestFor] = useState(null); // agent key string

    const load = useCallback(async () => {
        try {
            const [k, s, a] = await Promise.all([
                agentKeysApi.list(),
                agentKeysApi.sessions(),
                agentKeysApi.audit()
            ]);
            setKeys(k);
            setSessions(s);
            setAudit(a);
            setError('');
        } catch (e) { setError(e.message); }
    }, []);

    // Initial load, inline so setState only happens in the async callbacks.
    useEffect(() => {
        let alive = true;
        Promise.all([agentKeysApi.list(), agentKeysApi.sessions(), agentKeysApi.audit()])
            .then(([k, s, a]) => { if (!alive) return; setKeys(k); setSessions(s); setAudit(a); })
            .catch((e) => { if (alive) setError(e.message); });
        agentKeysApi.mintable().then((m) => alive && setMintable(m)).catch(() => {});
        return () => { alive = false; };
    }, []);

    // Live sessions and the audit trail move on their own — poll gently.
    useEffect(() => {
        const t = setInterval(() => {
            agentKeysApi.sessions().then(setSessions).catch(() => {});
            agentKeysApi.audit().then(setAudit).catch(() => {});
        }, 8000);
        return () => clearInterval(t);
    }, []);

    const revoke = async (key) => {
        if (!window.confirm(`Revoke "${key.label || key.agent_name}"? Any agent using it is cut off immediately.`)) return;
        try { await agentKeysApi.revoke(key.id); load(); } catch (e) { setError(e.message); }
    };

    const activeKeys = keys.filter((k) => !k.revoked);
    const liveSessions = sessions.sessions.filter((s) => s.live);

    return (
        <div className="animate-fade-in">
            <header className="ch-head">
                <div>
                    <h1 className="ch-title">Agent Access</h1>
                    <p className="ch-sub">
                        Let your own AI agent — ChatGPT, Claude, anything — drive AGCX on your behalf,
                        bounded by exactly your permissions. Read-only, one instance at a time, fully audited.
                    </p>
                </div>
            </header>

            <div className="ch-kpis">
                <StatCard label="Active keys" icon={<KeyRound size={19} />} accent="#818cf8" variant="kpi"
                    countTo={activeKeys.length} hint={`${keys.length} total minted`} />
                <StatCard label="Live now" icon={<Radio size={19} />} accent="#34d399" variant="kpi"
                    countTo={liveSessions.length} hint="agents currently acting" />
                <StatCard label="Swarm attempts" icon={<AlertTriangle size={19} />}
                    accent="#f87171" variant={sessions.swarmAttempts ? 'kri' : 'kpi'}
                    countTo={sessions.swarmAttempts} hint="duplicate agents turned away" />
                <StatCard label="Actions logged" icon={<Activity size={19} />} accent="#38bdf8" variant="kpi"
                    countTo={audit.length} hint="recent, in the trail below" />
            </div>

            {error && <div className="ch-error">{error}</div>}

            {/* how it works */}
            <div className="glass-card agk-how">
                <div className="agk-how-step"><span>1</span><div><strong>Mint a key</strong> for one of your agents (NEO, Aukat, …). The secret shows once.</div></div>
                <div className="agk-how-arrow">→</div>
                <div className="agk-how-step"><span>2</span><div><strong>Give it the agentic file</strong> — paste the manifest into your own agent so it learns the API.</div></div>
                <div className="agk-how-arrow">→</div>
                <div className="agk-how-step"><span>3</span><div><strong>It acts as you</strong> — read-only, only what you can see, one instance at a time.</div></div>
            </div>

            <div className="agk-grid">
                {/* keys */}
                <div className="glass-card agk-panel">
                    <div className="agk-panel-head">
                        <h3><KeyRound size={15} /> Your agent keys</h3>
                        <button className="agk-mint" onClick={() => setMinting(true)}><Plus size={14} /> Mint a key</button>
                    </div>
                    {activeKeys.length === 0 ? (
                        <div className="agk-empty">No keys yet. Mint one to let an agent in.</div>
                    ) : (
                        <div className="agk-keys">
                            {activeKeys.map((k) => (
                                <div className="agk-key" key={k.id}>
                                    <div className="agk-key-main">
                                        <div className="agk-key-name">{k.label || k.agent_name}</div>
                                        <div className="agk-key-sub">
                                            <span className="agk-badge">{k.agent_name}</span>
                                            <code>{k.key_prefix}</code>
                                            <span>· used {fmtWhen(k.last_used_at)}</span>
                                        </div>
                                    </div>
                                    <button className="agk-icon" title="Get the agentic file" onClick={() => setManifestFor(k.agent_key)}><FileCode size={15} /></button>
                                    <button className="agk-icon agk-danger" title="Revoke" onClick={() => revoke(k)}><Trash2 size={15} /></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* live sessions */}
                <div className="glass-card agk-panel">
                    <div className="agk-panel-head"><h3><Radio size={15} /> Live sessions</h3></div>
                    {liveSessions.length === 0 ? (
                        <div className="agk-empty">No agent is acting right now.</div>
                    ) : (
                        <div className="agk-sessions">
                            {liveSessions.map((s) => (
                                <div className="agk-session" key={s.agent_key}>
                                    <span className="agk-live-dot" />
                                    <div className="agk-session-main">
                                        <strong>{s.agent_name}</strong>
                                        <span>{s.request_count} requests · since {fmtWhen(s.started_at)}</span>
                                    </div>
                                    <span className="agk-badge">1 of 1</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* audit */}
            <div className="glass-card agk-panel">
                <div className="agk-panel-head"><h3><ShieldCheck size={15} /> Agent audit trail</h3><span className="agk-muted">separate from your own activity</span></div>
                {audit.length === 0 ? (
                    <div className="agk-empty">No agent activity yet.</div>
                ) : (
                    <div className="agk-audit-wrap">
                        <table className="agk-audit">
                            <thead><tr><th>When</th><th>Agent</th><th>Action</th><th>Request</th><th>Status</th></tr></thead>
                            <tbody>
                                {audit.map((a) => (
                                    <tr key={a.id}>
                                        <td>{fmtWhen(a.at)}</td>
                                        <td>{a.agent_name}</td>
                                        <td><span className={`agk-action agk-action--${ACTION_CLASS[a.action] || 'ok'}`}>{a.action.replace('_', ' ')}</span></td>
                                        <td className="agk-mono">{a.method} {a.path.replace('/api/v1', '').replace('/api', '')}</td>
                                        <td className={a.status >= 400 ? 'agk-bad' : ''}>{a.status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {minting && (
                <MintModal
                    mintable={mintable}
                    onClose={() => setMinting(false)}
                    onMinted={(res) => { setMinting(false); setFreshSecret(res); load(); }}
                />
            )}

            {freshSecret && (
                <SecretModal secret={freshSecret} onClose={() => setFreshSecret(null)} onManifest={() => { setManifestFor(freshSecret.agent_key); setFreshSecret(null); }} />
            )}

            {manifestFor && (
                <ManifestModal agentKey={manifestFor} onClose={() => setManifestFor(null)} />
            )}
        </div>
    );
}

function MintModal({ mintable, onClose, onMinted }) {
    const [picked, setPicked] = useState(null);
    const [label, setLabel] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    // Derive the selection rather than sync it in an effect: the explicit pick,
    // else the first mintable agent once the list arrives.
    const agent = picked ?? mintable[0]?.key ?? '';

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true); setErr('');
        try { onMinted(await agentKeysApi.mint(agent, label.trim())); }
        catch (e2) { setErr(e2.message); setBusy(false); }
    };

    return (
        <Modal isOpen onClose={onClose} title="Mint an agent key" maxWidth="560px">
            <form className="agk-form" onSubmit={submit}>
                <p className="agk-note">
                    A key lets an agent act <strong>as you</strong> — it can never see or do more than you can.
                    You can only mint for agents you're allowed to use.
                </p>
                <label className="agk-field-label">Which agent?</label>
                <div className="agk-agent-pick">
                    {mintable.map((a) => (
                        <button
                            type="button" key={a.key}
                            className={`agk-agent ${agent === a.key ? 'on' : ''}`}
                            style={{ '--agent': a.color }}
                            onClick={() => setPicked(a.key)}
                        >
                            <span className="agk-agent-emoji">{a.emoji}</span>
                            <span className="agk-agent-name">{a.name}</span>
                            <span className="agk-agent-scope">{a.scope === '*' ? 'all modules' : (a.scope || []).join(', ')}</span>
                        </button>
                    ))}
                </div>
                <label className="agk-field-label">Label (so you recognise it later)</label>
                <input className="agk-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. my ChatGPT assistant" />
                {err && <div className="ch-error">{err}</div>}
                <div className="agk-form-foot">
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={busy || !agent}>{busy ? 'Minting…' : 'Mint key'}</button>
                </div>
            </form>
        </Modal>
    );
}

function SecretModal({ secret, onClose, onManifest }) {
    return (
        <Modal isOpen onClose={onClose} title="Your key — copy it now" maxWidth="560px">
            <div className="agk-secret">
                <div className="agk-secret-warn"><AlertTriangle size={15} /> This is the only time the full key is shown. Store it in your agent's secrets now.</div>
                <div className="agk-secret-box">
                    <code>{secret.secret}</code>
                    <CopyButton text={secret.secret} label="Copy key" />
                </div>
                <p className="agk-note">Minted for <strong>{secret.agent_name}</strong>. Next, give your agent the manifest so it knows how to use this key.</p>
                <div className="agk-form-foot">
                    <button className="btn btn-ghost" onClick={onClose}>Done</button>
                    <button className="btn btn-primary" onClick={onManifest}><FileCode size={15} /> Get the agentic file</button>
                </div>
            </div>
        </Modal>
    );
}

const FORMATS = [
    { key: 'skill', label: 'Skill card', icon: <BookOpen size={13} />, hint: 'Paste into any model’s system prompt', lang: 'markdown' },
    { key: 'tools', label: 'OpenAI tools', icon: <Terminal size={13} />, hint: 'For GPT function-calling', lang: 'json' },
    { key: 'openapi', label: 'OpenAPI', icon: <FileCode size={13} />, hint: 'Universal spec', lang: 'json' },
    { key: 'mcp', label: 'MCP', icon: <Download size={13} />, hint: 'Model Context Protocol tools', lang: 'json' }
];

function ManifestModal({ agentKey, onClose }) {
    const [bundle, setBundle] = useState(null);
    const [fmt, setFmt] = useState('skill');
    const [err, setErr] = useState('');

    useEffect(() => { agentKeysApi.manifest(agentKey).then(setBundle).catch((e) => setErr(e.message)); }, [agentKey]);

    const content = !bundle ? '' : (fmt === 'skill' ? bundle.skill : JSON.stringify(bundle[fmt], null, 2));

    const download = () => {
        const ext = fmt === 'skill' ? 'md' : 'json';
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `agcx-${agentKey}-${fmt}.${ext}`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
    };

    return (
        <Modal isOpen onClose={onClose} title={`The agentic file — ${bundle?.agent?.name || ''}`} maxWidth="720px">
            {err && <div className="ch-error">{err}</div>}
            {!bundle ? <div className="agk-empty">Generating…</div> : (
                <div className="agk-manifest">
                    <p className="agk-note">
                        Give this to your agent so it learns to drive AGCX as {bundle.agent.name}. The key isn’t in here —
                        it’s a placeholder; your agent supplies the key you copied.
                    </p>
                    <div className="agk-fmt-tabs">
                        {FORMATS.map((f) => (
                            <button key={f.key} className={`agk-fmt ${fmt === f.key ? 'on' : ''}`} onClick={() => setFmt(f.key)} title={f.hint}>
                                {f.icon} {f.label}
                            </button>
                        ))}
                    </div>
                    <div className="agk-fmt-hint">{FORMATS.find((f) => f.key === fmt)?.hint}</div>
                    <pre className="agk-code"><code>{content}</code></pre>
                    <div className="agk-form-foot">
                        <CopyButton text={content} label="Copy" />
                        <button className="btn btn-primary" onClick={download}><Download size={14} /> Download</button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
