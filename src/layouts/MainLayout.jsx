import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import AgentDock from '../components/AgentDock';

const MainLayout = () => {
    // The GPT view *is* the agent surface — its Agent HQ rail replaces the dock,
    // which would otherwise float over the composer's send button.
    const isGpt = useLocation().pathname === '/gpt';

    return (
        <div className="app-container" style={{ display: 'flex', width: '100%', minHeight: '100vh' }}>
            <Sidebar />
            <div className="main-content-wrapper" style={{
                flex: 1,
                marginLeft: '280px',
                paddingTop: '70px',
                background: 'var(--bg-primary)',
                minHeight: '100vh'
            }}>
                <TopBar />
                <main style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
                    <Outlet />
                </main>
                {!isGpt && <AgentDock />}
            </div>
        </div>
    );
};

export default MainLayout;
