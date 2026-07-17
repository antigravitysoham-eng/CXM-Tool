import { createContext, useContext } from 'react';

// Context + hook + constants live here (no components) so the provider file can
// stay component-only and keep fast-refresh happy.

export const THEMES = [
    { key: 'dark', label: 'Dark' },
    { key: 'light', label: 'Light' }
];

export const ACCENTS = [
    { key: 'indigo', label: 'Indigo', color: '#6366f1' },
    { key: 'emerald', label: 'Emerald', color: '#10b981' },
    { key: 'amber', label: 'Amber', color: '#f59e0b' },
    { key: 'rose', label: 'Rose', color: '#f43f5e' },
    { key: 'cyan', label: 'Cyan', color: '#06b6d4' }
];

// Background palettes. Independent of light/dark: the theme decides whether
// surfaces are dark or light, the palette decides their hue. `swatch` is the
// dark page colour and `light` its light-mode counterpart — the switcher shows
// whichever matches the active theme.
export const BACKGROUNDS = [
    { key: 'slate', label: 'Slate', swatch: '#0f172a', light: '#f4f6fb' },
    { key: 'midnight', label: 'Midnight', swatch: '#080d24', light: '#edf0fc' },
    { key: 'obsidian', label: 'Obsidian', swatch: '#0a0a0d', light: '#f1f1f4' },
    { key: 'ocean', label: 'Ocean', swatch: '#051d27', light: '#ecf7fa' },
    { key: 'plum', label: 'Plum', swatch: '#180d20', light: '#f8eefc' },
    { key: 'sand', label: 'Sand', swatch: '#16120e', light: '#faf5ed' }
];

export const ThemeContext = createContext(null);

export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
};
