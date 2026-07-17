import React, { useState, useEffect, useMemo } from 'react';
import { ViewContext, VIEWS } from './view';

const KEY = 'view';

export function ViewProvider({ children }) {
    // The choice made at login persists, so the platform reopens the way you left it.
    const [view, setView] = useState(() => {
        const saved = localStorage.getItem(KEY);
        return VIEWS[saved] ? saved : 'dashboard';
    });

    useEffect(() => { localStorage.setItem(KEY, view); }, [view]);

    const value = useMemo(() => ({ view, setView }), [view]);
    return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}
