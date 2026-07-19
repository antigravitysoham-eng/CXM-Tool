import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    Mail,
    Lock,
    User,
    ArrowRight,
    Activity,
    AlertCircle,
    Eye,
    EyeOff,
    HeartPulse,
    CalendarClock,
    LineChart,
    Sparkles,
    LayoutDashboard,
    User as UserIcon,
    Bot,
    KeyRound,
    ShieldCheck
} from 'lucide-react';
import { useView, VIEWS } from '../context/view';
import './Login.css';

const FEATURES = [
    { icon: <HeartPulse size={16} />, text: 'Account health scoring and churn risk' },
    { icon: <CalendarClock size={16} />, text: 'Contract lifecycle and renewal tracking' },
    { icon: <LineChart size={16} />, text: 'Live retention and expansion analytics' }
];

export default function Login() {
    const { login, register } = useAuth();
    const { view, setView } = useView();
    // Who's signing in — a person, or someone here to set up their own agent.
    // Agents don't use this form (they authenticate with a key), so the agent
    // side is an explainer that routes back to a human sign-in.
    const [entryMode, setEntryMode] = useState('human');
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });

    const rootRef = useRef(null);
    const cardRef = useRef(null);

    // Pointer drives orb parallax and card tilt via CSS vars, so moving the
    // mouse never re-renders React. rAF-throttled to one write per frame.
    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        let frame = 0;
        const onMove = (e) => {
            if (frame) return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                const root = rootRef.current;
                if (!root) return;

                const dx = e.clientX / window.innerWidth - 0.5;
                const dy = e.clientY / window.innerHeight - 0.5;

                root.style.setProperty('--lg-px', `${dx * 28}px`);
                root.style.setProperty('--lg-py', `${dy * 28}px`);

                const card = cardRef.current;
                if (!card) return;
                const r = card.getBoundingClientRect();
                const cx = (e.clientX - r.left) / r.width - 0.5;
                const cy = (e.clientY - r.top) / r.height - 0.5;
                const near = Math.abs(cx) < 1.6 && Math.abs(cy) < 1.6;
                root.style.setProperty('--lg-ry', `${near ? cx * 7 : 0}deg`);
                root.style.setProperty('--lg-rx', `${near ? -cy * 7 : 0}deg`);
            });
        };

        window.addEventListener('mousemove', onMove);
        return () => {
            window.removeEventListener('mousemove', onMove);
            if (frame) cancelAnimationFrame(frame);
        };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const res = isLogin
            ? await login(formData.email, formData.password)
            : await register(formData.name, formData.email, formData.password);

        if (!res.success) {
            setError(res.error);
            setLoading(false);
        }
    };

    const setField = (key) => (e) => setFormData((prev) => ({ ...prev, [key]: e.target.value }));

    return (
        <div className="login-root" ref={rootRef}>
            <div className="login-bg">
                <div className="login-orb login-orb--a" />
                <div className="login-orb login-orb--b" />
                <div className="login-floor" />
                <div className="login-noise" />
                <div className="login-vignette" />
            </div>

            <aside className="login-brand">
                <div className="login-rings" aria-hidden="true">
                    <div className="login-ring" />
                    <div className="login-ring" />
                    <div className="login-ring" />
                    <div className="login-orbit" />
                    <div className="login-orbit login-orbit--slow" />
                </div>

                <div className="login-logo">
                    <span className="login-logo-mark"><Activity size={20} /></span>
                    CX Command Center
                </div>

                <div className="login-brand-body">
                    <span className="login-eyebrow">Customer Experience Platform</span>
                    <h1 className="login-headline gradient-text">Every account, one clear view.</h1>
                    <p className="login-sub">
                        Track health, renewals, and onboarding across your entire book of business —
                        backed by live data, not static mockups.
                    </p>
                    <ul className="login-features">
                        {FEATURES.map((f) => (
                            <li className="login-feature" key={f.text}>
                                <span className="login-feature-icon">{f.icon}</span>
                                {f.text}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="login-brand-foot">14 modules · one workspace</div>
            </aside>

            <main className="login-panel">
                <div className="login-card" ref={cardRef}>
                    <div className="login-card-inner">
                        <span className="login-bracket login-bracket--tl" aria-hidden="true" />
                        <span className="login-bracket login-bracket--tr" aria-hidden="true" />
                        <span className="login-bracket login-bracket--bl" aria-hidden="true" />
                        <span className="login-bracket login-bracket--br" aria-hidden="true" />
                        <div className="login-scan" aria-hidden="true" />

                        <div className="login-head">
                            <span className="login-tag">{isLogin ? 'Secure sign-in' : 'New account'}</span>
                            <h2 className="login-title">{isLogin ? 'Welcome back' : 'Create your account'}</h2>
                            <p className="login-caption">
                                {isLogin
                                    ? 'Sign in to continue to your CX portal.'
                                    : 'Set up access to the CX portal in a few seconds.'}
                            </p>
                        </div>

                        {/* Who's coming in — a person, or an agent's owner. */}
                        <div className="login-modetoggle" role="group" aria-label="Sign in as">
                            <button
                                type="button"
                                className={entryMode === 'human' ? 'on' : ''}
                                onClick={() => setEntryMode('human')}
                            >
                                <UserIcon size={15} /> User Access
                            </button>
                            <button
                                type="button"
                                className={entryMode === 'agent' ? 'on' : ''}
                                onClick={() => setEntryMode('agent')}
                            >
                                <Bot size={15} /> Get Your Agent
                            </button>
                        </div>

                        {entryMode === 'agent' ? (
                            <div className="login-agent">
                                <p className="login-agent-lead">
                                    Your own AI agent — ChatGPT, Claude, anything — can drive AGCX for you,
                                    bounded by exactly your permissions.
                                </p>
                                <ul className="login-agent-points">
                                    <li><KeyRound size={15} /> You sign in as yourself and mint a scoped key for one of your agents.</li>
                                    <li><Sparkles size={15} /> You get an “agentic file” to paste into your agent — it learns the rest.</li>
                                    <li><ShieldCheck size={15} /> Read-only, one instance at a time, and fully audited. It never sees more than you.</li>
                                </ul>
                                <button type="button" className="login-submit" onClick={() => setEntryMode('human')}>
                                    Sign in to set up agent access
                                    <ArrowRight className="login-arrow" size={17} />
                                </button>
                                <p className="login-agent-note">Agents authenticate with a key, not a password — so there's nothing to log in with here yet.</p>
                            </div>
                        ) : (
                        <>
                        {error && (
                            <div className="login-error" role="alert">
                                <AlertCircle size={16} />
                                <span>{error}</span>
                            </div>
                        )}

                        <form className="login-form" onSubmit={handleSubmit} noValidate>
                            {!isLogin && (
                                <div className="login-field">
                                    <label htmlFor="login-name">Full name</label>
                                    <div className="login-input-wrap">
                                        <span className="login-input-icon"><User size={17} /></span>
                                        <input
                                            id="login-name"
                                            className="login-input"
                                            type="text"
                                            required
                                            autoComplete="name"
                                            value={formData.name}
                                            onChange={setField('name')}
                                            placeholder="Alex Morgan"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="login-field">
                                <label htmlFor="login-email">Email address</label>
                                <div className="login-input-wrap">
                                    <span className="login-input-icon"><Mail size={17} /></span>
                                    <input
                                        id="login-email"
                                        className="login-input"
                                        type="email"
                                        required
                                        autoComplete="email"
                                        aria-invalid={!!error}
                                        value={formData.email}
                                        onChange={setField('email')}
                                        placeholder="name@company.com"
                                    />
                                </div>
                            </div>

                            <div className="login-field">
                                <div className="login-label-row">
                                    <label htmlFor="login-password">Password</label>
                                    {isLogin && <a className="login-forgot" href="#">Forgot password?</a>}
                                </div>
                                <div className="login-input-wrap">
                                    <span className="login-input-icon"><Lock size={17} /></span>
                                    <input
                                        id="login-password"
                                        className="login-input login-input--password"
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        autoComplete={isLogin ? 'current-password' : 'new-password'}
                                        aria-invalid={!!error}
                                        value={formData.password}
                                        onChange={setField('password')}
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        className="login-reveal"
                                        onClick={() => setShowPassword((v) => !v)}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        title={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* Choose the surface before entering; the choice sticks
                                and can still be flipped from the top bar. */}
                            <div className="login-viewpick">
                                <span className="login-viewpick-label">Choose View</span>
                                <div className="login-views">
                                    {Object.values(VIEWS).map((v) => (
                                        <button
                                            type="button"
                                            key={v.key}
                                            className={`login-view ${view === v.key ? 'is-on' : ''}`}
                                            onClick={() => setView(v.key)}
                                            aria-pressed={view === v.key}
                                        >
                                            {v.key === 'gpt' ? <Sparkles size={15} /> : <LayoutDashboard size={15} />}
                                            <span className="login-view-name">{v.label}</span>
                                            <span className="login-view-hint">{v.hint}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button className="login-submit" type="submit" disabled={loading}>
                                {loading ? (
                                    <span className="login-spinner" aria-hidden="true" />
                                ) : (
                                    <>
                                        {isLogin ? 'Sign in' : 'Create account'}
                                        <ArrowRight className="login-arrow" size={17} />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="login-switch">
                            {isLogin ? "Don't have an account?" : 'Already have an account?'}
                            <button
                                type="button"
                                onClick={() => {
                                    setIsLogin((v) => !v);
                                    setError('');
                                    setShowPassword(false);
                                    setFormData({ name: '', email: '', password: '' });
                                }}
                            >
                                {isLogin ? 'Request access' : 'Sign in'}
                            </button>
                        </div>
                        </>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
