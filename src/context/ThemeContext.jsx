import React, { useEffect, useMemo, useState } from 'react';
import { ThemeContext, BACKGROUNDS } from './theme';

const systemPrefersLight = () =>
    typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;

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

    const value = useMemo(() => ({
        theme,
        accent,
        bg,
        setTheme,
        setAccent,
        setBg,
        toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
    }), [theme, accent, bg]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
