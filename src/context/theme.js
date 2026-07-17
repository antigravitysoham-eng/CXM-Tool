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

export const ThemeContext = createContext(null);

export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
};
