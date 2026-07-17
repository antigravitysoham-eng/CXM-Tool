import React, { useEffect, useRef, useState } from 'react';
import { Sun, Moon, Palette, Check } from 'lucide-react';
import { useTheme, THEMES, ACCENTS, BACKGROUNDS } from '../context/theme';

export default function ThemeSwitcher() {
    const { theme, accent, bg, setTheme, setAccent, setBg, toggleTheme } = useTheme();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const onOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', onOutside);
        return () => document.removeEventListener('mousedown', onOutside);
    }, []);

    return (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }} ref={ref}>
            <button
                className="btn-ghost"
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
                style={{ padding: 8, borderRadius: 10, display: 'grid', placeItems: 'center', border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
                {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button
                className="btn-ghost"
                onClick={() => setOpen((o) => !o)}
                title="Appearance"
                style={{ padding: 8, borderRadius: 10, display: 'grid', placeItems: 'center', border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
                <Palette size={19} />
            </button>

            {open && (
                <div style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: 10, width: 210,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                    borderRadius: 14, padding: 12, boxShadow: 'var(--shadow-lg)', zIndex: 200
                }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Mode</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                        {THEMES.map((t) => (
                            <button
                                key={t.key}
                                onClick={() => setTheme(t.key)}
                                style={{
                                    flex: 1, padding: '7px 10px', borderRadius: 9, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                                    border: `1px solid ${theme === t.key ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                    background: theme === t.key ? 'var(--accent-primary)' : 'transparent',
                                    color: theme === t.key ? '#fff' : 'var(--text-secondary)'
                                }}
                            >{t.label}</button>
                        ))}
                    </div>

                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Accent</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                        {ACCENTS.map((a) => (
                            <button
                                key={a.key}
                                onClick={() => setAccent(a.key)}
                                title={a.label}
                                style={{
                                    width: 30, height: 30, borderRadius: 9, cursor: 'pointer',
                                    background: a.color, border: '2px solid var(--border-color)',
                                    display: 'grid', placeItems: 'center', color: '#fff'
                                }}
                            >{accent === a.key && <Check size={15} strokeWidth={3} />}</button>
                        ))}
                    </div>

                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Background</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {BACKGROUNDS.map((b) => (
                            <button
                                key={b.key}
                                onClick={() => setBg(b.key)}
                                title={b.label}
                                style={{
                                    width: 30, height: 30, borderRadius: 9, cursor: 'pointer',
                                    // Preview the palette as it will actually look in the active mode.
                                    background: theme === 'light' ? b.light : b.swatch,
                                    border: `2px solid ${bg === b.key ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                    display: 'grid', placeItems: 'center',
                                    color: theme === 'light' ? 'var(--accent-primary)' : '#fff'
                                }}
                            >{bg === b.key && <Check size={15} strokeWidth={3} />}</button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
