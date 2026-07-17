import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import AgentDock from '../components/AgentDock';
import WarpTransition from '../components/WarpTransition';
import { useView, RAIL } from '../context/view';

const MainLayout = () => {
    const { collapsed, warping } = useView();
    // The GPT view drops the module rail and the floating dock entirely: it is the
    // agent surface, and its own Agent HQ rail replaces both.
    const isGpt = useLocation().pathname === '/gpt';
    const rail = isGpt ? RAIL.none : (collapsed ? RAIL.collapsed : RAIL.open);

    return (
        // --rail is the single source of width: the sidebar, top bar and content
        // all read it, so they move together in one transition.
        <div className="app-container" style={{ '--rail': `${rail}px`, display: 'flex', width: '100%', minHeight: '100vh' }}>
            {!isGpt && <Sidebar />}
            <div
                className="main-content-wrapper"
                style={{
                    flex: 1,
                    marginLeft: 'var(--rail)',
                    paddingTop: '70px',
                    background: 'var(--bg-primary)',
                    minHeight: '100vh',
                    transition: 'margin-left 0.38s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
            >
                <TopBar />
                <main style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
                    <Outlet />
                </main>
                {!isGpt && <AgentDock />}
            </div>
            <WarpTransition active={warping} />
        </div>
    );
};

export default MainLayout;
