import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine
} from 'recharts';
import {
    TrendingUp, TrendingDown, Globe, Factory, Sparkles, ArrowRight,
    AlertTriangle, Target, Users, IndianRupee, Activity, LayoutGrid, UserCheck,
    Info, Database, ChevronRight, ChevronLeft
} from 'lucide-react';
import { useMetricDrill } from '../components/metricDrillContext';
import { dashboardApi } from '../api/dashboard';
import './Dashboard.css';
import { tooltipProps } from '../lib/chartTheme';

const PALETTE = ['#818cf8', '#22d3ee', '#34d399', '#fbbf24', '#f87171', '#a855f7', '#38bdf8', '#ec4899'];
const TONE = { good: '#10b981', watch: '#f59e0b', risk: '#ef4444' };
const PRIORITY = { critical: '#ef4444', high: '#f59e0b', medium: '#38bdf8', low: '#94a3b8' };

const fmtInr = (n) => {
    const v = Math.round(Number(n) || 0);
    if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
    if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
    if (v >= 1e3) return `₹${(v / 1e3).toFixed(1)}k`;
    return `₹${v}`;
};
const fmtVal = (v, format) => {
    if (v === null || v === undefined) return '—';
    if (format === 'inr') return fmtInr(v);
    if (format === 'pct') return `${v}%`;
    if (format === 'days') return v ? `${v}d` : '—';
    if (format === 'hrs') return v ? `${v}h` : '—';
    return Number(v).toLocaleString('en-IN');
};


export default function Dashboard() {
    const [d, setD] = useState(null);
    const [error, setError] = useState('');
    const [moduleKey, setModuleKey] = useState('');
    const [metricKey, setMetricKey] = useState('');
    const [team, setTeam] = useState('All');
    const [openCsm, setOpenCsm] = useState(null);
    // one popup for the whole platform — the module pages open the same one
    const { open: openMetric } = useMetricDrill();

    useEffect(() => {
        let alive = true;
        dashboardApi.overview()
            .then((res) => {
                if (!alive) return;
                setD(res);
                setModuleKey(res.modules[0]?.key || '');
                setMetricKey(res.trends.metrics[0]?.key || '');
            })
            .catch((e) => alive && setError(e.message || 'Failed to load'));
        return () => { alive = false; };
    }, []);

    const activeModule = useMemo(() => d?.modules.find((m) => m.key === moduleKey) || d?.modules[0], [d, moduleKey]);
    const activeMetric = useMemo(() => d?.trends.metrics.find((m) => m.key === metricKey) || d?.trends.metrics[0], [d, metricKey]);

    if (error) return <div className="ch-error" style={{ margin: '2rem 0' }}>{error}</div>;
    if (!d) return <div className="ch-empty">Building your executive view…</div>;

    const h = d.headline;
    const teams = ['All', ...new Set(d.actions.map((a) => a.team))];
    const shownActions = team === 'All' ? d.actions : d.actions.filter((a) => a.team === team);

    return (
        <div className="animate-fade-in dash">
            {/* ── the numbers a C-suite reads first ── */}
            <section className="dash-hero">
                <HeroTile primary metric="arr" onOpen={openMetric} label="ARR under management" value={fmtInr(h.arrInr)}
                    sub={`${h.customers} customers · ${fmtInr(h.arpaInr)} average per account`}
                    icon={<IndianRupee size={18} />} accent="#22d3ee" />
                <HeroTile metric="nrr" onOpen={openMetric} label="Net revenue retention" value={h.nrr == null ? '—' : `${h.nrr}%`}
                    sub={`${h.grr ?? '—'}% gross · ${fmtInr(h.expansionWonInr)} expansion won`}
                    icon={<TrendingUp size={18} />} accent="#34d399" />
                <HeroTile metric="atRisk" onOpen={openMetric} label="Customers at risk" value={h.atRiskCustomers}
                    sub={`${fmtInr(h.atRiskArrInr)} ARR exposed`}
                    icon={<AlertTriangle size={18} />} accent="#f87171" tone="risk" />
                <HeroTile metric="expansion" onOpen={openMetric} label="Expansion forecast" value={fmtInr(h.expansionWeightedInr)}
                    sub={`${fmtInr(h.weightedPipelineInr)} new-business pipeline`}
                    icon={<Target size={18} />} accent="#818cf8" />
                <HeroTile metric="nps" onOpen={openMetric} label="NPS" value={h.nps ?? '—'}
                    sub={`${h.detractors ?? 0} detractors · ${h.responseRate ?? '—'}% response rate`}
                    icon={<Activity size={18} />} accent="#fbbf24" />
                <HeroTile metric="adoption" onOpen={openMetric} label="Module adoption" value={h.avgAdoption == null ? '—' : `${h.avgAdoption}%`}
                    sub={h.topModule ? `${h.topModule} leads · ${h.dormantModules ?? 0} dormant` : `${h.dormantModules ?? 0} dormant modules`}
                    icon={<Users size={18} />} accent="#a855f7" />
            </section>

            {/* ── coverage: region / industry / tier ── */}
            <section className="dash-grid-3">
                {/* Region reads as revenue share, not a second bar chart. It is the
                    only coverage cut where ARR is the interesting axis — where the
                    money is, not merely where the logos are — and a donut beside a
                    bar chart tells the two panels apart at a glance. */}
                <Panel title="Coverage by region" icon={<Globe size={15} />} hint={`${h.regionsCovered} regions`}>
                    <RegionCoverage byRegion={d.coverage.byRegion} byValue={d.coverage.byRegionValue} />
                </Panel>

                <Panel title="Coverage by industry" icon={<Factory size={15} />} hint={`${h.industriesCovered} industries`}>
                    <ResponsiveContainer width="100%" height={190}>
                        <BarChart data={d.coverage.byIndustry} layout="vertical" margin={{ left: 4, right: 18 }}>
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={92} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip {...tooltipProps} />
                            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
                                {d.coverage.byIndustry.map((_, i) => <Cell key={i} fill={PALETTE[(i + 3) % PALETTE.length]} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </Panel>

                {/* Opening a CSM hides the others: the panel is narrow, and their
                    book needs the room more than the rows you are not reading. */}
                <Panel title={openCsm ? `${openCsm}'s book` : 'Customers by CSM'} icon={<UserCheck size={15} />}
                    hint={openCsm ? 'back to all' : `${d.coverage.csmCount} CSMs`}
                    onHintClick={openCsm ? () => setOpenCsm(null) : null}>
                    <div className="dash-csm">
                        {d.coverage.byCsm
                            .filter((c) => !openCsm || c.name === openCsm)
                            .map((c) => (
                                <CsmRow key={c.name} csm={c}
                                    colour={PALETTE[d.coverage.byCsm.findIndex((x) => x.name === c.name) % PALETTE.length]}
                                    top={d.coverage.byCsm[0]?.arr || 1}
                                    open={openCsm === c.name}
                                    onToggle={() => setOpenCsm(openCsm === c.name ? null : c.name)} />
                            ))}
                    </div>
                </Panel>
            </section>

            {/* ── module explorer: every module's metrics behind one dropdown ── */}
            <section className="dash-panel dash-modules">
                <div className="dash-panel-head">
                    <div className="dash-panel-title"><LayoutGrid size={15} /> Module-wise metrics</div>
                    <div className="dash-panel-tools">
                        <select className="dash-select" value={activeModule?.key} onChange={(e) => setModuleKey(e.target.value)}>
                            {d.modules.map((m) => <option key={m.key} value={m.key}>{m.title}</option>)}
                        </select>
                        {activeModule?.route && <Link to={activeModule.route} className="dash-open">Open module <ArrowRight size={13} /></Link>}
                    </div>
                </div>
                {activeModule && (
                    <div className="dash-modbody">
                        <div className="dash-modkpis">
                            {activeModule.kpis.map((k) => (
                                <div className="dash-modkpi" key={k.label} style={{ '--t': TONE[k.tone] || activeModule.color }}>
                                    <div className="dash-modkpi-val">{fmtVal(k.value, k.format)}</div>
                                    <div className="dash-modkpi-label">{k.label}</div>
                                    {k.hint && <div className="dash-modkpi-hint">{k.hint}</div>}
                                </div>
                            ))}
                        </div>
                        <div className="dash-modchart">
                            <div className="dash-modchart-title">{activeModule.chart.title}</div>
                            {(activeModule.chart.data || []).length === 0 ? <div className="ch-muted dash-nodata">No data yet.</div> : activeModule.chart.type === 'donut' ? (
                                <ResponsiveContainer width="100%" height={210}>
                                    <PieChart>
                                        <Pie data={activeModule.chart.data} dataKey="value" nameKey="name" innerRadius={46} outerRadius={78} paddingAngle={3}>
                                            {activeModule.chart.data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                                        </Pie>
                                        <Tooltip {...tooltipProps} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <ResponsiveContainer width="100%" height={210}>
                                    <BarChart data={activeModule.chart.data} margin={{ left: -18, right: 8 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-16} textAnchor="end" height={54} />
                                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                                        <Tooltip {...tooltipProps} />
                                        <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={26} fill={activeModule.color} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                )}
            </section>

            {/* ── trend analysis with forecast ── */}
            <section className="dash-panel">
                <div className="dash-panel-head">
                    <div className="dash-panel-title"><TrendingUp size={15} /> Trend analysis — KPI &amp; KRI</div>
                    <div className="dash-panel-tools">
                        <select className="dash-select dash-select--wide" value={activeMetric?.key} onChange={(e) => setMetricKey(e.target.value)}>
                            {Object.entries(d.trends.metrics.reduce((g, m) => { (g[m.module] ||= []).push(m); return g; }, {})).map(([mod, list]) => (
                                <optgroup key={mod} label={mod}>
                                    {list.map((m) => <option key={m.key} value={m.key}>{m.label} · {m.kind}</option>)}
                                </optgroup>
                            ))}
                        </select>
                    </div>
                </div>
                {activeMetric ? (
                    <TrendChart metric={activeMetric} months={d.trends.months} forecastMonths={d.trends.forecastMonths} />
                ) : (
                    <div className="ch-muted dash-nodata">No month-on-month movement recorded yet — trends appear once the modules start logging activity.</div>
                )}
            </section>

            {/* ── forecast + actions ── */}
            <section className="dash-grid-2">
                <Panel title="Forward view" icon={<Target size={15} />} hint="next 90 days">
                    <div className="dash-fc">
                        <div className="dash-fc-main">
                            <div className="dash-fc-label">Projected ARR</div>
                            <div className="dash-fc-val">{fmtInr(d.forecast.projectedArr)}</div>
                            <div className="dash-fc-delta">
                                {d.forecast.projectedArr >= d.forecast.arrInr
                                    ? <span className="dash-up"><TrendingUp size={13} /> {fmtInr(d.forecast.projectedArr - d.forecast.arrInr)} upside</span>
                                    : <span className="dash-down"><TrendingDown size={13} /> {fmtInr(d.forecast.arrInr - d.forecast.projectedArr)} downside</span>}
                                <span className="ch-muted"> vs {fmtInr(d.forecast.arrInr)} today</span>
                            </div>
                        </div>
                        <div className="dash-fc-tiles">
                            <div className="dash-fc-tile"><span>Renewals ≤ 90d</span><strong>{fmtInr(d.forecast.renewalValue90)}</strong><em>{d.forecast.renewalCount90} contracts</em></div>
                            <div className="dash-fc-tile"><span>Expansion weighted</span><strong style={{ color: '#10b981' }}>{fmtInr(d.forecast.expansionWeighted)}</strong><em>in pipeline</em></div>
                            <div className="dash-fc-tile"><span>Churn-risk ARR</span><strong style={{ color: '#ef4444' }}>{fmtInr(d.forecast.churnRiskInr)}</strong><em>poor/critical health</em></div>
                        </div>
                        <ul className="dash-fc-notes">
                            {d.forecast.notes.map((n, i) => <li key={i}>{n}</li>)}
                        </ul>
                    </div>
                </Panel>

                <Panel title="Key actions by team" icon={<Sparkles size={15} />} hint={`${d.actions.length} suggested`}>
                    <div className="dash-teamtabs">
                        {teams.map((t) => (
                            <button key={t} className={team === t ? 'on' : ''} onClick={() => setTeam(t)}>
                                {t}{t !== 'All' ? ` (${d.actions.filter((a) => a.team === t).length})` : ''}
                            </button>
                        ))}
                    </div>
                    <div className="dash-actions">
                        {shownActions.length === 0 && <div className="ch-muted" style={{ padding: '1rem' }}>Nothing outstanding for this team. 🎉</div>}
                        {shownActions.map((a, i) => (
                            <Link to={a.route} className="dash-action" key={i} style={{ '--p': PRIORITY[a.priority] }}>
                                <span className="dash-action-pri">{a.priority}</span>
                                <div className="dash-action-body">
                                    <div className="dash-action-title">{a.title}</div>
                                    <div className="dash-action-detail">{a.detail}</div>
                                </div>
                                <span className="dash-action-team">{a.team}</span>
                                <ArrowRight size={14} className="dash-action-go" />
                            </Link>
                        ))}
                    </div>
                </Panel>
            </section>
        </div>
    );
}

/** A headline tile. Given a `metric` key it becomes a button that opens the
 *  provenance for that number. */
function HeroTile({ label, value, sub, icon, accent, tone, primary, metric, onOpen }) {
    const style = { '--a': tone ? TONE[tone] : accent };
    const body = (
        <>
            <div className="dash-hero-top">{icon}<span>{label}</span></div>
            <div className="dash-hero-val">{value}</div>
            <div className="dash-hero-sub">{sub}</div>
            {metric && <span className="dash-hero-info" aria-hidden><Info size={13} /></span>}
        </>
    );
    if (!metric) return <div className={`dash-hero-tile ${primary ? 'is-primary' : ''}`} style={style}>{body}</div>;
    return (
        <button type="button" className={`dash-hero-tile is-clickable ${primary ? 'is-primary' : ''}`} style={style}
            onClick={() => onOpen(metric, label)}
            title={`Where does "${label}" come from?`}>
            {body}
        </button>
    );
}

/** A CSM's book, expandable in place to the accounts they actually hold — the
 *  question "which ones?" shouldn't require a trip to Accounts and a filter. */
/** Region coverage as ARR share: a donut with the legend carrying both the money
 *  and the logo count, so one panel answers "where is the revenue" and "how many
 *  accounts sit behind it" without a second chart. */
function RegionCoverage({ byRegion, byValue }) {
    const counts = Object.fromEntries(byRegion.map((r) => [r.name, r.value]));
    // Fall back to logo counts if no ARR has landed against a region yet —
    // an empty donut is worse than a differently-scaled one.
    const src = (byValue || []).filter((r) => r.value > 0);
    const data = (src.length ? src : byRegion).map((r, i) => ({
        ...r, accounts: counts[r.name] ?? 0, fill: PALETTE[i % PALETTE.length]
    }));
    const total = data.reduce((s, r) => s + r.value, 0) || 1;
    const byArr = src.length;

    return (
        <div className="dash-region">
            <div className="dash-region-chart">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="88%" paddingAngle={2} stroke="none">
                            {data.map((r) => <Cell key={r.name} fill={r.fill} />)}
                        </Pie>
                        <Tooltip {...tooltipProps} formatter={(v) => (byArr ? fmtInr(v) : `${v} customers`)} />
                    </PieChart>
                </ResponsiveContainer>
                <div className="dash-region-centre">
                    <span>{data.length}</span>
                    <em>regions</em>
                </div>
            </div>
            <ul className="dash-region-legend">
                {data.map((r) => (
                    <li key={r.name}>
                        <span className="dash-region-dot" style={{ background: r.fill }} />
                        <span className="dash-region-name">{r.name}</span>
                        <span className="dash-region-share">{Math.round((r.value / total) * 100)}%</span>
                        <span className="dash-region-sub">{byArr ? fmtInr(r.value) : `${r.value} cust.`} · {r.accounts} acct</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function CsmRow({ csm, colour, top, open, onToggle }) {
    const initials = csm.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    return (
        <div className={`dash-csm-item ${open ? 'is-open' : ''}`}>
            <button type="button" className="dash-csm-row" onClick={onToggle}
                aria-expanded={open} title={`Show the ${csm.value} account(s) ${csm.name} handles`}>
                <span className="dash-csm-avatar" style={{ background: colour }}>{initials}</span>
                <div className="dash-csm-main">
                    <div className="dash-csm-top">
                        <span className="dash-csm-name">{csm.name}</span>
                        <span className="dash-csm-arr">{fmtInr(csm.arr)}</span>
                    </div>
                    <div className="dash-csm-bar">
                        <span style={{ width: `${Math.max(3, Math.round((csm.arr / top) * 100))}%`, background: colour }} />
                    </div>
                    <div className="dash-csm-sub">
                        {csm.value} {csm.value === 1 ? 'customer' : 'customers'}
                        {csm.atRisk > 0 && <span className="dash-csm-risk">· {csm.atRisk} at risk</span>}
                    </div>
                </div>
                <ChevronRight size={15} className={`dash-csm-chev ${open ? 'is-open' : ''}`} />
            </button>
            {open && (
                <div className="dash-csm-book">
                    {csm.accounts.map((a) => (
                        <Link key={a.name} to="/cash-horizon" className={`dash-csm-acct ${a.atRisk ? 'is-risk' : ''}`}>
                            <span className="dash-csm-acct-name">{a.name}</span>
                            <span className="dash-csm-acct-meta">
                                {a.tier} · {a.region} · {a.health}
                                {a.daysToRenewal !== null && ` · renews in ${a.daysToRenewal}d`}
                            </span>
                            <span className="dash-csm-acct-arr">{fmtInr(a.arr)}</span>
                        </Link>
                    ))}
                    {csm.accounts.length === 0 && <div className="ch-muted" style={{ padding: '.5rem' }}>No accounts assigned.</div>}
                </div>
            )}
        </div>
    );
}

function Panel({ title, icon, hint, children, onHintClick }) {
    return (
        <div className="dash-panel">
            <div className="dash-panel-head">
                <div className="dash-panel-title">{icon} {title}</div>
                {hint && (onHintClick
                    ? <button type="button" className="dash-panel-hint is-action" onClick={onHintClick}>
                        <ChevronLeft size={11} /> {hint}
                    </button>
                    : <span className="dash-panel-hint">{hint}</span>)}
            </div>
            {children}
        </div>
    );
}

/** Actuals as a solid area, the projection as a dashed continuation. */
function TrendChart({ metric, months, forecastMonths }) {
    const data = [
        ...months.map((m, i) => ({ name: m, actual: metric.values[i], forecast: i === months.length - 1 ? metric.values[i] : null })),
        ...forecastMonths.map((m, i) => ({ name: m, actual: null, forecast: metric.forecast[i] }))
    ];
    const isKri = metric.kind === 'KRI';
    const color = isKri ? '#f87171' : '#34d399';
    const up = metric.delta >= 0;
    // For a KRI, up is bad; for a KPI, up is good.
    const goodDirection = isKri ? !up : up;
    const UNIT_SUFFIX = { pct: '%', hrs: 'h', days: 'd' };
    const fmt = (v) => {
        if (v === null || v === undefined) return '—';
        if (metric.unit === 'inr') return fmtInr(v);
        return `${v}${UNIT_SUFFIX[metric.unit] || ''}`;
    };

    return (
        <div className="dash-trend">
            <div className="dash-trend-head">
                <div>
                    <span className={`dash-kind ${isKri ? 'is-kri' : 'is-kpi'}`}>{metric.kind}</span>
                    <span className="dash-trend-label">{metric.label}</span>
                    <span className="ch-muted"> · {metric.module}</span>
                </div>
                <div className="dash-trend-now">
                    <span className="dash-trend-val">{fmt(metric.latest)}</span>
                    <span className={`dash-trend-delta ${goodDirection ? 'is-good' : 'is-bad'}`}>
                        {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                        {up ? '+' : ''}{fmt(metric.delta)} vs last month
                    </span>
                </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data} margin={{ left: -14, right: 10, top: 8 }}>
                    <defs>
                        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.42} />
                            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={62} tickFormatter={fmt} />
                    <Tooltip {...tooltipProps} formatter={(v, n) => [fmt(v), n === 'actual' ? 'Actual' : 'Forecast']} />
                    <ReferenceLine x={months[months.length - 1]} stroke="var(--text-muted)" strokeDasharray="4 4" label={{ value: 'today', fill: 'var(--text-muted)', fontSize: 10, position: 'top' }} />
                    <Area type="monotone" dataKey="actual" stroke={color} strokeWidth={2.4} fill="url(#trendFill)" connectNulls />
                    <Area type="monotone" dataKey="forecast" stroke={color} strokeWidth={2} strokeDasharray="6 5" fill="none" connectNulls />
                </AreaChart>
            </ResponsiveContainer>
            <div className="dash-trend-foot">
                Dashed line is a least-squares projection of the last {months.length} months — indicative, not a commitment.
            </div>
        </div>
    );
}
