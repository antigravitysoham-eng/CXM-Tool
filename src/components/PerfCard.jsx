import React from 'react';
import { Clock } from 'lucide-react';
import './PerfCard.css';

const initials = (name) => (name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

/**
 * A polished leaderboard scorecard used across the performance views (Account
 * Manager, Partner, CSM). Shows a rank + avatar + name, a headline number, and a
 * responsive grid of labelled metric tiles. Metrics flagged `time` get a clock
 * and a tinted tile so temporal KPIs (avg time to close, time-to-value) stand out.
 */
export default function PerfCard({ rank, name, subtitle, accent = '#6366f1', headline, metrics = [] }) {
    return (
        <div className="perf-card" style={{ '--accent': accent }}>
            <div className="perf-card-head">
                {rank != null && <span className="perf-rank">{rank}</span>}
                <span className="perf-avatar">{initials(name)}</span>
                <div className="perf-id">
                    <div className="perf-name">{name}</div>
                    {subtitle && <div className="perf-sub">{subtitle}</div>}
                </div>
                {headline && (
                    <div className="perf-headline">
                        <div className="perf-headline-val">{headline.value}</div>
                        <div className="perf-headline-lbl">{headline.label}</div>
                    </div>
                )}
            </div>
            <div className="perf-metrics">
                {metrics.filter(Boolean).map((m) => (
                    <div className={`perf-metric ${m.time ? 'is-time' : ''}`} key={m.label}>
                        <div className="perf-metric-lbl">{m.time && <Clock size={11} />}{m.label}</div>
                        <div className="perf-metric-val" style={m.tone ? { color: m.tone } : undefined}>{m.value}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
