import React, { useState, useRef, useEffect } from 'react';
import { CalendarRange, Check, X } from 'lucide-react';
import { useDateRange } from '../context/dateRange';
import { DATE_PRESETS, todayISO } from '../context/dateRange';
import './DateRangeFilter.css';

/**
 * The global reporting period control. Lives in the top bar; every module reads
 * the same range for its KPI cards, tables and report downloads. Native date
 * inputs (no picker dependency), capped at today so a future date can't be set.
 */
export default function DateRangeFilter() {
    const { from, to, preset, active, label, setPreset, setFrom, setTo, clear } = useDateRange();
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    const today = todayISO();

    // Close on outside click / Escape.
    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
    }, [open]);

    const inverted = from && to && from > to; // guarded in context, shown here defensively

    return (
        <div className={`drf ${active ? 'is-active' : ''}`} ref={wrapRef}>
            <button
                className="drf-trigger"
                onClick={() => setOpen((o) => !o)}
                title="Reporting period — filters metrics and reports"
                aria-haspopup="dialog"
                aria-expanded={open}
            >
                <CalendarRange size={16} />
                <span className="drf-label">{label}</span>
                {active && (
                    <span
                        className="drf-clear"
                        role="button"
                        tabIndex={0}
                        title="Clear period"
                        onClick={(e) => { e.stopPropagation(); clear(); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); clear(); } }}
                    >
                        <X size={13} />
                    </span>
                )}
            </button>

            {open && (
                <div className="drf-pop" role="dialog" aria-label="Choose reporting period">
                    <div className="drf-presets">
                        {DATE_PRESETS.map((p) => (
                            <button
                                key={p.key}
                                className={`drf-chip ${preset === p.key ? 'sel' : ''}`}
                                onClick={() => { setPreset(p.key); if (p.key !== 'custom') setOpen(false); }}
                            >
                                {preset === p.key && <Check size={12} />} {p.label}
                            </button>
                        ))}
                    </div>
                    <div className="drf-fields">
                        <label>
                            <span>From</span>
                            <input type="date" value={from} max={to || today} onChange={(e) => setFrom(e.target.value)} />
                        </label>
                        <label>
                            <span>To</span>
                            <input type="date" value={to} min={from || undefined} max={today} onChange={(e) => setTo(e.target.value)} />
                        </label>
                    </div>
                    {inverted && <p className="drf-err">“From” must be on or before “To”.</p>}
                    <p className="drf-hint">Applies to metrics and generated reports. Future dates are capped at today.</p>
                </div>
            )}
        </div>
    );
}
