import React, { useState, useRef, useEffect } from 'react';
import { History, X, Check } from 'lucide-react';
import { todayISO } from '../context/dateRange';
import { stageFilterActive, emptyStageFilter } from '../utils/stageFilter';
import './StageTimelineFilter.css';

/**
 * A per-board timeline filter for stage-based views: filter by when a record
 * entered its current stage, and/or how long it has been stuck there. Emits
 * { enteredFrom, enteredTo, minDays }. Self-contained popover, mirrors
 * DateRangeFilter's look.
 */
export default function StageTimelineFilter({ value, onChange }) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    const today = todayISO();
    const v = value || emptyStageFilter;
    const active = stageFilterActive(v);

    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
    }, [open]);

    const set = (patch) => onChange({ ...v, ...patch });
    const clear = () => onChange({ ...emptyStageFilter });

    const label = active
        ? [v.minDays ? `≥${v.minDays}d` : '', (v.enteredFrom || v.enteredTo) ? 'entered' : ''].filter(Boolean).join(' · ') || 'Timeline'
        : 'Timeline';

    return (
        <div className={`stf ${active ? 'is-active' : ''}`} ref={wrapRef}>
            <button className="stf-trigger" onClick={() => setOpen((o) => !o)} title="Filter by stage timeline" aria-expanded={open}>
                <History size={15} />
                <span className="stf-label">{label}</span>
                {active && (
                    <span className="stf-clear" role="button" tabIndex={0} title="Clear"
                        onClick={(e) => { e.stopPropagation(); clear(); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); clear(); } }}>
                        <X size={13} />
                    </span>
                )}
            </button>
            {open && (
                <div className="stf-pop" role="dialog" aria-label="Stage timeline filter">
                    <div className="stf-field">
                        <span>Entered stage between</span>
                        <div className="stf-dates">
                            <input type="date" value={v.enteredFrom} max={v.enteredTo || today} onChange={(e) => set({ enteredFrom: e.target.value })} />
                            <input type="date" value={v.enteredTo} min={v.enteredFrom || undefined} max={today} onChange={(e) => set({ enteredTo: e.target.value })} />
                        </div>
                    </div>
                    <div className="stf-field">
                        <span>In stage at least</span>
                        <div className="stf-days">
                            <input type="number" min="0" placeholder="0" value={v.minDays} onChange={(e) => set({ minDays: e.target.value })} />
                            <em>days</em>
                        </div>
                    </div>
                    <div className="stf-foot">
                        <button className="stf-clearall" onClick={clear} disabled={!active}>Clear</button>
                        <button className="stf-done" onClick={() => setOpen(false)}><Check size={13} /> Done</button>
                    </div>
                </div>
            )}
        </div>
    );
}
