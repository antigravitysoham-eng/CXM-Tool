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
    const { view, setView, warp } = useView();
    const navigate = useNavigate();
    const location = useLocation();

    const onGpt = location.pathname === '/gpt';

    const go = (next) => {
        // Key off where you actually are, not just the stored view: with the view
        // set to GPT but sitting on a module page, "GPT" must still take you there.
        const alreadyThere = next === view && (next === 'gpt' ? onGpt : !onGpt);
        if (alreadyThere) return;
        // Jump under the warp so the rail appearing/disappearing is covered.
        warp(() => {
            setView(next);
            if (next === 'gpt') navigate('/gpt');
            // Leaving the GPT view lands on the dashboard; from any other module,
            // stay put — switching the default shouldn't yank you off the page.
            else if (onGpt) navigate('/');
        });
    };

    return (
        // The highlight follows the surface you're on, not the stored preference —
        // showing "GPT" lit while you're reading a module table would be a lie.
        <div className="view-switch" role="group" aria-label="View">
            <button
                className={!onGpt ? 'on' : ''}
                onClick={() => go('dashboard')}
                aria-pressed={!onGpt}
                title="Classic SaaS dashboard"
            >
                <LayoutDashboard size={14} /> Dashboard
            </button>
            <button
                className={onGpt ? 'on' : ''}
                onClick={() => go('gpt')}
                aria-pressed={onGpt}
                title="Ask NEO — metrics, charts and data entry by prompt"
            >
                <Sparkles size={14} /> GPT
            </button>
        </div>
    );
}
