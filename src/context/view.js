import { createContext, useContext } from 'react';

// The two ways to use the platform. Same data, same components — different surface.
export const VIEWS = {
    dashboard: { key: 'dashboard', label: 'Dashboard', hint: 'Classic SaaS — modules, tables, filters' },
    gpt: { key: 'gpt', label: 'GPT view', hint: 'Ask NEO, get metrics and charts back' }
};

export const ViewContext = createContext({ view: 'dashboard', setView: () => {} });

export const useView = () => useContext(ViewContext);
