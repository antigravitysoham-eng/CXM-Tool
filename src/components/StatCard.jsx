import React, { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { useMetricDrill } from './metricDrillContext';
import './StatCard.css';

const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Animated count-up to `target`, eased. Updates happen inside the animation
// frame (never synchronously in the effect). Reduced motion -> duration 0.
function useCountUp(target, duration = 900) {
    const [v, setV] = useState(0);
    const raf = useRef(0);
    useEffect(() => {
        // Nothing to animate if nobody is looking, and reduced motion asks us not to.
        const hidden = typeof document !== 'undefined' && document.hidden;
        const dur = (reduced() || hidden) ? 0 : duration;
        const start = performance.now();
        const tick = (now) => {
            const t = dur === 0 ? 1 : Math.min(1, (now - start) / dur);
            const eased = 1 - Math.pow(1 - t, 3);
            setV(target * eased);
            if (t < 1) raf.current = requestAnimationFrame(tick);
        };
        // A hidden tab never fires rAF, so a page opened in the background
        // (cmd-click, restored session) would sit at 0 until focused. Drive the
        // single settle-to-target tick off a timeout there instead.
        if (hidden) {
            const id = setTimeout(() => tick(performance.now()), 0);
            return () => clearTimeout(id);
        }
        raf.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf.current);
    }, [target, duration]);
    return v;
}

/**
 * KPI / KRI stat card. `variant`: 'kpi' (stable) or 'kri' (risk — pulses).
 *
 * Pass `metric` (a registry key) to make the card drillable: it becomes a
 * button that opens the provenance popup showing where the number came from.
 */
export default function StatCard({ label, icon, accent = '#6366f1', variant = 'kpi', hint, countTo = 0, format = (n) => Math.round(n), progress, metric, onClick }) {
    const v = useCountUp(countTo);
    const { open, has } = useMetricDrill();
    const drillable = !!metric && has(metric);

    const body = (
        <>
            <div className="stat-card-glow" />
            <div className="stat-card-top">
                <div className="stat-card-icon">{icon}</div>
                {variant === 'kri' && <span className="stat-card-kri"><span className="stat-card-kri-dot" />KRI</span>}
                {drillable && <span className="stat-card-info" aria-hidden><Info size={13} /></span>}
            </div>
            <div className="stat-card-label">{label}</div>
            <div className="stat-card-value">{format(v)}</div>
            {hint && <div className="stat-card-hint">{hint}</div>}
            {progress !== undefined && (
                <div className="stat-card-bar"><div className="stat-card-bar-fill" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>
            )}
        </>
    );

    // A plain click handler (no metric registry) still makes the card actionable.
    if (!drillable && onClick) {
        return (
            <button type="button" className={`stat-card stat-card--${variant} is-drillable`} style={{ '--accent': accent }} onClick={onClick}>
                {body}
            </button>
        );
    }
    if (!drillable) {
        return <div className={`stat-card stat-card--${variant}`} style={{ '--accent': accent }}>{body}</div>;
    }
    return (
        <button type="button" className={`stat-card stat-card--${variant} is-drillable`} style={{ '--accent': accent }}
            onClick={() => open(metric, label)} title={`Where does "${label}" come from?`}>
            {body}
        </button>
    );
}
