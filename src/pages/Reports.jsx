import React, { useEffect, useMemo, useState } from 'react';
import { FileBarChart, CalendarRange, Check, AlertCircle } from 'lucide-react';
import { dataApi } from '../api/dataExchange';
import ReportView from '../components/ReportView';
import { useDateRange } from '../context/dateRange';
import { DATE_PRESETS, todayISO } from '../context/dateRange';
import './Reports.css';

/**
 * One place to pull an executive report or Excel export for any module, scoped
 * to a period. The period control here edits the same global range as the top
 * bar, so what you pick is what every metric and download reflects.
 */
export default function Reports() {
    const [mods, setMods] = useState([]);
    const [selected, setSelected] = useState('');
    const [error, setError] = useState('');
    const { from, to, preset, active, setPreset, setFrom, setTo } = useDateRange();
    const today = todayISO();

    useEffect(() => {
        let alive = true;
        dataApi.modules()
            .then((d) => {
                if (!alive) return;
                setMods(d.modules || []);
                setSelected((cur) => cur || (d.modules?.[0]?.key ?? ''));
            })
            .catch((e) => { if (alive) setError(e.message || 'Failed to load modules'); });
        return () => { alive = false; };
    }, []);

    const current = useMemo(() => mods.find((m) => m.key === selected), [mods, selected]);
    const noPeriod = current && !current.periodField;

    return (
        <div className="rp">
            <div className="rp-head">
                <div className="rp-head-icon"><FileBarChart size={22} /></div>
                <div>
                    <h1 className="rp-title">Reports</h1>
                    <p className="rp-sub">Executive reports and data exports for any module, scoped to a period.</p>
                </div>
            </div>

            {error && <div className="rp-error"><AlertCircle size={16} /> {error}</div>}

            <div className="rp-controls">
                <div className="rp-field">
                    <label htmlFor="rp-module">Module</label>
                    <select id="rp-module" value={selected} onChange={(e) => setSelected(e.target.value)}>
                        {mods.map((m) => <option key={m.key} value={m.key}>{m.title}</option>)}
                    </select>
                </div>

                <div className="rp-period">
                    <div className="rp-period-label"><CalendarRange size={15} /> Period</div>
                    <div className="rp-presets">
                        {DATE_PRESETS.map((p) => (
                            <button
                                key={p.key}
                                className={`rp-chip ${preset === p.key ? 'sel' : ''}`}
                                onClick={() => setPreset(p.key)}
                            >
                                {preset === p.key && <Check size={12} />} {p.label}
                            </button>
                        ))}
                    </div>
                    <div className="rp-dates">
                        <label>From <input type="date" value={from} max={to || today} onChange={(e) => setFrom(e.target.value)} /></label>
                        <label>To <input type="date" value={to} min={from || undefined} max={today} onChange={(e) => setTo(e.target.value)} /></label>
                    </div>
                </div>
            </div>

            {noPeriod && active && (
                <div className="rp-note">
                    <AlertCircle size={15} /> <span><strong>{current.title}</strong> has no date field to scope by — this report covers the full dataset regardless of the period.</span>
                </div>
            )}

            {selected && (
                <div className="rp-report card">
                    <ReportView key={selected} module={selected} />
                </div>
            )}
        </div>
    );
}
