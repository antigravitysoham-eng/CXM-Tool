import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, RadialBarChart, RadialBar
} from 'recharts';
import {
    TrendingUp, TrendingDown, Globe, Factory, Sparkles, ArrowRight, Radar,
    AlertTriangle, Target, Users, IndianRupee, Activity, LayoutGrid, UserCheck, Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dashboardApi } from '../api/dashboard';
import './Dashboard.css';

const PALETTE = ['#818cf8', '#22d3ee', '#34d399', '#fbbf24', '#f87171', '#a855f7', '#38bdf8', '#ec4899'];
const TONE = { good: '#10b981', watch: '#f59e0b', risk: '#ef4444' };
const PRIORITY = { critical: '#ef4444', high: '#f59e0b', medium: '#38bdf8', low: '#94a3b8' };
const BAND = { Critical: '#ef4444', High: '#f97316', Moderate: '#f59e0b', Low: '#10b981' };

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

const tip = { background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 10, fontSize: 12 };

export default function Dashboard() {
    const { user } = useAuth();
    const [d, setD] = useState(null);
    const [error, setError] = useState('');
    const [moduleKey, setModuleKey] = useState('');
    const [metricKey, setMetricKey] = useState('');
    const [team, setTeam] = useState('All');
    const [openRisk, setOpenRisk] = useState(null);

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
    const alerts = d.signals.filter((s) => !s.good);

    return (
        <div className="animate-fade-in dash">
            {/* ── NEO briefing: what the numbers add up to, in words ── */}
            <section className="dash-neo">
                <div className="dash-neo-glow" aria-hidden />
                <div className="dash-neo-body">
                    <div className="dash-neo-tag">
                        <span className="dash-live" /> NEO briefing
                        <span className="dash-neo-basis">{d.briefing.basis}</span>
                    </div>
                    <h1 className="dash-neo-headline">{d.briefing.headline}</h1>
                    <ul className="dash-neo-points">
                        {d.briefing.points.map((p, i) => (
                            <li key={i}><Zap size={13} /><span>{p}</span></li>
                        ))}
                    </ul>
                    <div className="dash-neo-foot">
                        <Link to="/gpt" className="dash-neo-cta"><Sparkles size={15} /> Ask NEO about this</Link>
                        <span className="ch-muted">Signed in as {user?.name || 'you'} · figures are scoped to your book</span>
                    </div>
                </div>
                <div className="dash-neo-side">
                    <RiskDial counts={d.risk.counts} total={d.risk.board.length} exposed={d.risk.exposedArrInr} />
                </div>
            </section>

            {/* ── headline KPIs, each carrying its own six-month shape ── */}
            <section className="dash-hero">
                <KpiTile primary label="ARR under management" value={fmtInr(h.arrInr)}
                    sub={`${h.customers} customers · ${fmtInr(h.arpaInr)} avg`}
                    spark={d.sparks.arr} accent="#22d3ee" icon={<IndianRupee size={15} />} />
                <KpiTile label="Net revenue retention" value={h.nrr == null ? '—' : `${h.nrr}%`}
                    sub={`${h.grr ?? '—'}% gross retention`}
                    spark={d.sparks.expansion} accent="#34d399" icon={<TrendingUp size={15} />} />
                <KpiTile label="Customers at risk" value={h.atRiskCustomers}
                    sub={`${fmtInr(h.atRiskArrInr)} exposed`}
                    spark={d.sparks.risk} accent="#f87171" invert icon={<AlertTriangle size={15} />} />
                <KpiTile label="Expansion forecast" value={fmtInr(h.expansionWeightedInr)}
                    sub={`${fmtInr(h.weightedPipelineInr)} new pipeline`}
                    spark={d.sparks.expansion} accent="#818cf8" icon={<Target size={15} />} />
                <KpiTile label="NPS" value={h.nps ?? '—'}
                    sub={`${h.detractors ?? 0} detractors · ${h.responseRate ?? '—'}% replied`}
                    spark={d.sparks.nps} accent="#fbbf24" icon={<Activity size={15} />} />
                <KpiTile label="Module adoption" value={h.avgAdoption == null ? '—' : `${h.avgAdoption}%`}
                    sub={h.topModule ? `${h.topModule} leads · ${h.dormantModules ?? 0} dormant` : `${h.dormantModules ?? 0} dormant`}
                    spark={d.sparks.adoption} accent="#a855f7" icon={<Users size={15} />} />
            </section>

            {/* ── the AI centrepiece: who is at risk, and why ── */}
            <section className="dash-grid-risk">
                <Panel title="Churn-risk radar" icon={<Radar size={15} />} hint={`${d.risk.board.length} customers scored`}>
                    <div className="dash-riskbar">
                        {Object.entries(BAND).filter(([b]) => d.risk.counts[b]).map(([b, c]) => (
                            <span key={b} style={{ flex: d.risk.counts[b], background: c }} title={`${d.risk.counts[b]} ${b}`}>
                                {d.risk.counts[b]}
                            </span>
                        ))}
                    </div>
                    <div className="dash-risklist">
                        {d.risk.board.map((r) => (
                            <RiskRow key={r.account} r={r} open={openRisk === r.account}
                                onToggle={() => setOpenRisk(openRisk === r.account ? null : r.account)} />
                        ))}
                    </div>
                </Panel>

                <div className="dash-riskside">
                    <Panel title="What drives the risk" icon={<Target size={15} />} hint="whole book">
                        <div className="dash-drivers">
                            {d.risk.topDrivers.map((t, i) => {
                                const top = d.risk.topDrivers[0].points || 1;
                                return (
                                    <div className="dash-driver" key={t.key}>
                                        <div className="dash-driver-top">
                                            <span>{t.label}</span>
                                            <strong>{t.accounts} account{t.accounts === 1 ? '' : 's'}</strong>
                                        </div>
                                        <div className="dash-driver-bar">
                                            <span style={{ width: `${Math.round((t.points / top) * 100)}%`, background: PALETTE[i % PALETTE.length] }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="dash-modelnote">
                            Weighted signal model — health, adoption, support load, sentiment,
                            check-in cadence and renewal proximity. Every point traces to a factor above.
                        </p>
                    </Panel>

                    <Panel title="Signals this month" icon={<Activity size={15} />} hint={`${alerts.length} need attention`}>
                        <div className="dash-signals">
                            {d.signals.length === 0 && <div className="ch-muted dash-fill-note">Nothing broke from its baseline.</div>}
                            {d.signals.slice(0, 6).map((s) => (
                                <div className={`dash-signal ${s.good ? 'is-good' : 'is-bad'}`} key={s.key}>
                                    <span className="dash-signal-arrow">
                                        {s.direction === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                    </span>
                                    <div className="dash-signal-body">
                                        <div className="dash-signal-label">{s.label}</div>
                                        <div className="dash-signal-detail">
                                            {fmtVal(s.latest, s.unit === 'inr' ? 'inr' : s.unit)} vs {fmtVal(s.baseline, s.unit === 'inr' ? 'inr' : s.unit)} baseline · {s.module}
                                        </div>
                                    </div>
                                    <span className="dash-signal-z">{Math.abs(s.z)}σ</span>
                                </div>
                            ))}
                        </div>
                    </Panel>
                </div>
            </section>

            {/* ── module explorer ── */}
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
                            <div className="dash-chartfill">
                                {(activeModule.chart.data || []).length === 0 ? <div className="ch-muted dash-fill-note">No data yet.</div> : activeModule.chart.type === 'donut' ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={activeModule.chart.data} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="82%" paddingAngle={3}>
                                                {activeModule.chart.data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                                            </Pie>
                                            <Tooltip contentStyle={tip} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={activeModule.chart.data} margin={{ left: -18, right: 8, top: 4 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                            <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-16} textAnchor="end" height={54} />
                                            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                                            <Tooltip cursor={{ fill: 'var(--veil-1)' }} contentStyle={tip} />
                                            <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={26} fill={activeModule.color} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* ── trend analysis with forecast ── */}
            <section className="dash-panel">
                <div className="dash-panel-head">
                    <div className="dash-panel-title"><TrendingUp size={15} /> Trend analysis — KPI &amp; KRI</div>
                    <div className="dash-panel-tools">
                        <span className="dash-panel-hint">{d.trends.metrics.length} of {d.trends.catalogue.length} tracked</span>
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
                    <TrendChart metric={activeMetric} months={d.trends.months} forecastMonths={d.trends.forecastMonths}
                        signal={d.signals.find((s) => s.key === activeMetric.key)} />
                ) : (
                    <div className="ch-muted dash-fill-note">No month-on-month movement recorded yet.</div>
                )}
            </section>

            {/* ── coverage ── */}
            <section className="dash-grid-3">
                <Panel title="Coverage by region" icon={<Globe size={15} />} hint={`${h.regionsCovered} regions`}>
                    <div className="dash-chartfill">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={d.coverage.byRegion} layout="vertical" margin={{ left: 4, right: 18 }}>
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" width={62} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{ fill: 'var(--veil-1)' }} contentStyle={tip} />
                                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
                                    {d.coverage.byRegion.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>

                <Panel title="Coverage by industry" icon={<Factory size={15} />} hint={`${h.industriesCovered} industries`}>
                    <div className="dash-chartfill">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={d.coverage.byIndustry} layout="vertical" margin={{ left: 4, right: 18 }}>
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" width={92} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{ fill: 'var(--veil-1)' }} contentStyle={tip} />
                                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
                                    {d.coverage.byIndustry.map((_, i) => <Cell key={i} fill={PALETTE[(i + 3) % PALETTE.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>

                <Panel title="Customers by CSM" icon={<UserCheck size={15} />} hint={`${d.coverage.csmCount} CSMs`}>
                    <div className="dash-csm">
                        {d.coverage.byCsm.map((c, i) => {
                            const top = d.coverage.byCsm[0]?.arr || 1;
                            return (
                                <div className="dash-csm-row" key={c.name}>
                                    <span className="dash-csm-avatar" style={{ background: PALETTE[i % PALETTE.length] }}>
                                        {c.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                                    </span>
                                    <div className="dash-csm-main">
                                        <div className="dash-csm-top">
                                            <span className="dash-csm-name">{c.name}</span>
                                            <span className="dash-csm-arr">{fmtInr(c.arr)}</span>
                                        </div>
                                        <div className="dash-csm-bar">
                                            <span style={{ width: `${Math.max(3, Math.round((c.arr / top) * 100))}%`, background: PALETTE[i % PALETTE.length] }} />
                                        </div>
                                        <div className="dash-csm-sub">
                                            {c.value} {c.value === 1 ? 'customer' : 'customers'}
                                            {c.atRisk > 0 && <span className="dash-csm-risk">· {c.atRisk} at risk</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Panel>
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
                        {shownActions.length === 0 && <div className="ch-muted dash-fill-note">Nothing outstanding for this team.</div>}
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

/** Portfolio risk as a single ring, with the band split underneath. */
function RiskDial({ counts, total, exposed }) {
    const atRisk = (counts.Critical || 0) + (counts.High || 0);
    const pctAtRisk = total ? Math.round((atRisk / total) * 100) : 0;
    const data = [{ name: 'risk', value: pctAtRisk, fill: atRisk ? '#f97316' : '#10b981' }];
    return (
        <div className="dash-dial">
            <div className="dash-dial-chart">
                <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart innerRadius="68%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
                        <RadialBar dataKey="value" cornerRadius={10} background={{ fill: 'var(--veil-2)' }} domain={[0, 100]} />
                    </RadialBarChart>
                </ResponsiveContainer>
                <div className="dash-dial-centre">
                    <span className="dash-dial-num">{atRisk}</span>
                    <span className="dash-dial-lbl">at risk</span>
                </div>
            </div>
            <div className="dash-dial-meta">
                <strong>{fmtInr(exposed)}</strong>
                <span>ARR exposed</span>
            </div>
        </div>
    );
}

/** A KPI tile whose sparkline fills the bottom, so the card never has dead space. */
function KpiTile({ label, value, sub, spark, accent, icon, primary, invert }) {
    const data = (spark || []).map((v, i) => ({ i, v }));
    const first = data[0]?.v ?? 0;
    const last = data[data.length - 1]?.v ?? 0;
    const rising = last >= first;
    // For an inverted tile (risk-style) a rising line is the bad direction.
    const good = invert ? !rising : rising;
    const id = `sp-${label.replace(/\W/g, '')}`;
    return (
        <div className={`dash-kpi ${primary ? 'is-primary' : ''}`} style={{ '--a': accent }}>
            <div className="dash-kpi-top">{icon}<span>{label}</span></div>
            <div className="dash-kpi-val">{value}</div>
            <div className="dash-kpi-sub">{sub}</div>
            <div className="dash-kpi-spark">
                {data.length > 1 && (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
                            <defs>
                                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={accent} stopOpacity={0.5} />
                                    <stop offset="100%" stopColor={accent} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="v" stroke={accent} strokeWidth={1.8} fill={`url(#${id})`} isAnimationActive={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
            {data.length > 1 && (
                <span className={`dash-kpi-trend ${good ? 'is-good' : 'is-bad'}`}>
                    {rising ? <TrendingUp size={11} /> : <TrendingDown size={11} />} 6mo
                </span>
            )}
        </div>
    );
}

/** One customer on the risk radar; expands to show what produced the score. */
function RiskRow({ r, open, onToggle }) {
    const colour = BAND[r.band];
    return (
        <div className={`dash-risk ${open ? 'is-open' : ''}`} style={{ '--b': colour }}>
            <button className="dash-risk-head" onClick={onToggle}>
                <span className="dash-risk-ring" style={{ background: `conic-gradient(${colour} ${r.score * 3.6}deg, var(--veil-2) 0)` }}>
                    <span className="dash-risk-ring-in">{r.score}</span>
                </span>
                <span className="dash-risk-id">
                    <span className="dash-risk-name">{r.account}</span>
                    <span className="dash-risk-meta">
                        {r.csm} · {r.tier}
                        {r.adoption !== null && ` · ${r.adoption}% adoption`}
                        {r.daysToRenewal !== null && ` · renews in ${r.daysToRenewal}d`}
                    </span>
                </span>
                <span className="dash-risk-right">
                    <span className="dash-risk-band">{r.band}</span>
                    <span className="dash-risk-arr">{fmtInr(r.arrInr)}</span>
                </span>
            </button>
            {open && (
                <div className="dash-risk-factors">
                    {r.factors.map((f) => (
                        <div className="dash-risk-factor" key={f.key}>
                            <div className="dash-risk-factor-top">
                                <span>{f.label}</span><strong>+{f.points}</strong>
                            </div>
                            <div className="dash-risk-factor-bar">
                                <span style={{ width: `${Math.round((f.points / f.weight) * 100)}%`, background: colour }} />
                            </div>
                            <div className="dash-risk-factor-detail">{f.detail}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function Panel({ title, icon, hint, children }) {
    return (
        <div className="dash-panel">
            <div className="dash-panel-head">
                <div className="dash-panel-title">{icon} {title}</div>
                {hint && <span className="dash-panel-hint">{hint}</span>}
            </div>
            {children}
        </div>
    );
}

/** Actuals as a solid area, the projection as a dashed continuation. */
function TrendChart({ metric, months, forecastMonths, signal }) {
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
                    {signal && (
                        <span className={`dash-trend-flag ${signal.good ? 'is-good' : 'is-bad'}`}>
                            {Math.abs(signal.z)}σ from baseline
                        </span>
                    )}
                </div>
                <div className="dash-trend-now">
                    <span className="dash-trend-val">{fmt(metric.latest)}</span>
                    <span className={`dash-trend-delta ${goodDirection ? 'is-good' : 'is-bad'}`}>
                        {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                        {up ? '+' : ''}{fmt(metric.delta)} vs last month
                    </span>
                </div>
            </div>
            <div className="dash-trend-chart">
                <ResponsiveContainer width="100%" height="100%">
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
                        <Tooltip contentStyle={tip} formatter={(v, n) => [fmt(v), n === 'actual' ? 'Actual' : 'Forecast']} />
                        {/* the projected span, shaded so it reads as estimate not record */}
                        <ReferenceArea x1={months[months.length - 1]} x2={forecastMonths[forecastMonths.length - 1]} fill="var(--veil-1)" fillOpacity={1} />
                        <ReferenceLine x={months[months.length - 1]} stroke="var(--text-muted)" strokeDasharray="4 4" label={{ value: 'today', fill: 'var(--text-muted)', fontSize: 10, position: 'top' }} />
                        <Area type="monotone" dataKey="actual" stroke={color} strokeWidth={2.4} fill="url(#trendFill)" connectNulls />
                        <Area type="monotone" dataKey="forecast" stroke={color} strokeWidth={2} strokeDasharray="6 5" fill="none" connectNulls />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
            <div className="dash-trend-foot">
                Shaded span is a least-squares projection of the last {months.length} months — indicative, not a commitment.
            </div>
        </div>
    );
}
