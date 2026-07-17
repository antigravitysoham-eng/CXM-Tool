import React, { useEffect, useMemo, useState } from 'react';
import { ThemeContext } from './theme';

const systemPrefersLight = () =>
    typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || (systemPrefersLight() ? 'light' : 'dark'));
    const [accent, setAccent] = useState(() => localStorage.getItem('accent') || 'indigo');

    // Applied to <html> so every token — including portals/modals — picks it up.
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        document.documentElement.setAttribute('data-accent', accent);
        localStorage.setItem('accent', accent);
    }, [accent]);

    const value = useMemo(() => ({
        theme,
        accent,
        setTheme,
        setAccent,
        toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
    }), [theme, accent]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
