import React from 'react';
import { LayoutDashboard, Sparkles } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useView } from '../context/view';
import './ViewSwitcher.css';

/**
 * Flips between the SaaS dashboard and the GPT view. The choice is remembered,
 * so it also decides where the platform opens next time.
 */
export default function ViewSwitcher() {
    const { view, setView } = useView();
    const navigate = useNavigate();
    const location = useLocation();

    const go = (next) => {
        setView(next);
        if (next === 'gpt') navigate('/gpt');
        // Leaving the GPT view lands on the dashboard; from any other module,
        // stay put — switching the default shouldn't yank you off the page.
        else if (location.pathname === '/gpt') navigate('/');
    };

    return (
        <div className="view-switch" role="group" aria-label="View">
            <button
                className={view === 'dashboard' ? 'on' : ''}
                onClick={() => go('dashboard')}
                title="Classic SaaS dashboard"
            >
                <LayoutDashboard size={14} /> Dashboard
            </button>
            <button
                className={view === 'gpt' ? 'on' : ''}
                onClick={() => go('gpt')}
                title="Ask NEO — metrics, charts and data entry by prompt"
            >
                <Sparkles size={14} /> GPT
            </button>
        </div>
    );
}
