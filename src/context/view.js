import { createContext, useContext } from 'react';

// The two ways to use the platform. Same data, same components — different surface.
export const VIEWS = {
    dashboard: { key: 'dashboard', label: 'Dashboard', hint: 'Classic SaaS — modules, tables, filters' },
    gpt: { key: 'gpt', label: 'GPT', hint: 'Ask NEO, get metrics and charts back' }
};

// Rail widths, mirrored into --rail on the shell so the sidebar, top bar and
// content all move as one. The GPT view has no rail at all.
export const RAIL = { open: 280, collapsed: 76, none: 0 };

export const ViewContext = createContext({
    view: 'dashboard',
    setView: () => {},
    collapsed: false,
    setCollapsed: () => {},
    warping: false,
    warp: (fn) => fn()
});

export const useView = () => useContext(ViewContext);
