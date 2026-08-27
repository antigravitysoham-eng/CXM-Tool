import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ViewContext, VIEWS } from './view';

const VIEW_KEY = 'view';
const RAIL_KEY = 'railCollapsed';

// Swap the view under the frost, at the sweep's peak, then let it clear.
// Keep in step with the 720ms animations in WarpTransition.css.
const WARP_SWAP_MS = 320;
const WARP_TOTAL_MS = 740;

const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function ViewProvider({ children }) {
    // The choice made at login persists, so the platform reopens the way you left it.
    const [view, setView] = useState(() => {
        const saved = localStorage.getItem(VIEW_KEY);
        return VIEWS[saved] ? saved : 'dashboard';
    });
    const [collapsed, setCollapsed] = useState(() => localStorage.getItem(RAIL_KEY) === '1');
    const [warping, setWarping] = useState(false);
    const timers = useRef([]);

    useEffect(() => { localStorage.setItem(VIEW_KEY, view); }, [view]);
    useEffect(() => { localStorage.setItem(RAIL_KEY, collapsed ? '1' : '0'); }, [collapsed]);

    // Don't leave timers running into an unmount — they'd fire setState on a dead tree.
    useEffect(() => () => timers.current.forEach(clearTimeout), []);

    /**
     * Runs `swap` under a full-screen warp so the shell changes shape behind it
     * instead of snapping. Reduced motion skips straight to the swap.
     */
    const warp = useCallback((swap) => {
        if (prefersReducedMotion()) { swap(); return; }
        // Jumping again before the last one lands must not inherit its timers —
        // the stale "end" would cut the new warp short halfway through.
        timers.current.forEach(clearTimeout);
        timers.current = [];
        setWarping(true);
        timers.current.push(setTimeout(swap, WARP_SWAP_MS));
        timers.current.push(setTimeout(() => setWarping(false), WARP_TOTAL_MS));
    }, []);

    const value = useMemo(
        () => ({ view, setView, collapsed, setCollapsed, warping, warp }),
        [view, collapsed, warping, warp]
    );
    return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}
