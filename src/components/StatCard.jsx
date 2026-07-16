import React, { useEffect, useRef, useState } from 'react';
import './StatCard.css';

const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Animated count-up to `target`, eased. Updates happen inside the animation
// frame (never synchronously in the effect). Reduced motion -> duration 0.
function useCountUp(target, duration = 900) {
    const [v, setV] = useState(0);
    const raf = useRef(0);
    useEffect(() => {
        const dur = reduced() ? 0 : duration;
        const start = performance.now();
        const tick = (now) => {
            const t = dur === 0 ? 1 : Math.min(1, (now - start) / dur);
            const eased = 1 - Math.pow(1 - t, 3);
            setV(target * eased);
            if (t < 1) raf.current = requestAnimationFrame(tick);
        };
        raf.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf.current);
    }, [target, duration]);
    return v;
}

// KPI / KRI stat card. `variant`: 'kpi' (stable) or 'kri' (risk — pulses).
export default function StatCard({ label, icon, accent = '#6366f1', variant = 'kpi', hint, countTo = 0, format = (n) => Math.round(n), progress }) {
    const v = useCountUp(countTo);
    return (
        <div className={`stat-card stat-card--${variant}`} style={{ '--accent': accent }}>
            <div className="stat-card-glow" />
            <div className="stat-card-top">
                <div className="stat-card-icon">{icon}</div>
                {variant === 'kri' && <span className="stat-card-kri"><span className="stat-card-kri-dot" />KRI</span>}
            </div>
            <div className="stat-card-label">{label}</div>
            <div className="stat-card-value">{format(v)}</div>
            {hint && <div className="stat-card-hint">{hint}</div>}
            {progress !== undefined && (
                <div className="stat-card-bar"><div className="stat-card-bar-fill" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>
            )}
        </div>
    );
}
