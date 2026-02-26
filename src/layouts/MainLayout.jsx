import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import SmartAssistant from '../components/SmartAssistant';

const MainLayout = () => {
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
                <SmartAssistant />
            </div>
        </div>
    );
};

export default MainLayout;
