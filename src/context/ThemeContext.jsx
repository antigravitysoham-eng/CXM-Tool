import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { ThemeContext, BACKGROUNDS } from './theme';

const systemPrefersLight = () =>
    typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;

const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// A stale or hand-edited value would leave data-bg pointing at no palette.
const validBg = (k) => (BACKGROUNDS.some((b) => b.key === k) ? k : 'slate');

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || (systemPrefersLight() ? 'light' : 'dark'));
    const [accent, setAccent] = useState(() => localStorage.getItem('accent') || 'indigo');
    const [bg, setBg] = useState(() => validBg(localStorage.getItem('bg')));

    // Applied to <html> so every token — including portals/modals — picks it up.
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        document.documentElement.setAttribute('data-accent', accent);
        localStorage.setItem('accent', accent);
    }, [accent]);

    useEffect(() => {
        document.documentElement.setAttribute('data-bg', bg);
        localStorage.setItem('bg', bg);
    }, [bg]);

    // Switch the theme as a crossfade: the View Transitions API snapshots the
    // page, we swap data-theme, and the old/new snapshots dissolve into each
    // other (styled in design-system.css). flushSync forces React to commit the
    // new theme inside the transition callback; we also set the attribute
    // imperatively so the "after" snapshot is captured with the new palette.
    // Falls back to an instant switch where the API or motion isn't available.
    const applyTheme = useCallback((next) => {
        const resolve = (t) => (typeof next === 'function' ? next(t) : next);
        const swap = () => {
            const t = resolve(theme);
            document.documentElement.setAttribute('data-theme', t);
            flushSync(() => setTheme(t));
        };
        if (document.startViewTransition && !prefersReducedMotion()) {
            document.startViewTransition(swap);
        } else {
            setTheme(next);
        }
    }, [theme]);

    const value = useMemo(() => ({
        theme,
        accent,
        bg,
        setTheme: applyTheme,
        setAccent,
        setBg,
        toggleTheme: () => applyTheme((t) => (t === 'dark' ? 'light' : 'dark'))
    }), [theme, accent, bg, applyTheme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
