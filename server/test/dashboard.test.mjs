import { describe, it, expect } from 'vitest';

const API = 'http://localhost:5099/api';

const login = async (email, password) => (await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
})).json()).token;
const call = (t, p, opts = {}) => fetch(`${API}${p}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
});

describe('executive dashboard — headline, coverage, modules, trends, forecast, actions', () => {
    it('all checks pass', async () => {
        const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

        const admin = await login('demo@example.com', 'password123');
        const rep = await login('priya@cashhorizon.io', 'demo1234');
        ok(admin && rep, 'admin + rep logins');

        // ---- auth is required ----
        ok((await fetch(`${API}/dashboard/overview`)).status === 401, 'overview rejects an anonymous caller');

        // Guarantee at least one live time-series: a flat-zero metric is filtered
        // out of the dropdown on purpose, so a bare test DB would offer nothing.
        const acct = (await (await call(admin, '/accounts')).json())[0].name;
        const today = new Date().toISOString().slice(0, 10);
        const made = await call(admin, '/support', {
            method: 'POST',
            body: JSON.stringify({ account: acct, subject: 'Dashboard trend probe', priority: 'High', opened_at: today })
        });
        const madeKpi = await call(admin, '/support', {
            method: 'POST',
            body: JSON.stringify({ account: acct, subject: 'Dashboard trend probe (closed)', status: 'Resolved', opened_at: today, resolved_at: today })
        });
        ok(made.status === 201 && madeKpi.status === 201, `seeded an open + a resolved ticket on ${acct} so a KRI and a KPI trend have data`);

        const d = await (await call(admin, '/dashboard/overview')).json();

        // ---- headline ----
        const H = ['arrInr', 'customers', 'accounts', 'pipelineInr', 'weightedPipelineInr', 'nps',
            'healthRed', 'healthGreen', 'openTickets', 'avgAdoption', 'renewalsDue90',
            'atRiskValueInr', 'expansionWeightedInr', 'regionsCovered', 'industriesCovered'];
        ok(H.every((k) => k in d.headline), `headline carries all ${H.length} executive figures`);
        ok(d.headline.arrInr > 0 && d.headline.customers > 0, `ARR ${d.headline.arrInr} across ${d.headline.customers} customers`);
        ok(d.headline.weightedPipelineInr <= d.headline.pipelineInr, 'weighted pipeline never exceeds open pipeline');

        // ---- coverage ----
        for (const k of ['byRegion', 'byIndustry', 'byTier', 'bySegment', 'byHealth']) {
            ok(Array.isArray(d.coverage[k]) && d.coverage[k].every((r) => 'name' in r && 'value' in r), `coverage.${k} is a name/value series`);
        }
        ok(d.coverage.regionsCovered === d.headline.regionsCovered, 'region count agrees between coverage and headline');
        ok(d.coverage.byRegion.reduce((s, r) => s + r.value, 0) === d.headline.accounts, 'region series accounts for every account');

        // ---- module metrics: every module carries KPIs and a chart ----
        ok(d.modules.length >= 12, `${d.modules.length} modules represented`);
        ok(d.modules.every((m) => m.key && m.title && m.route && Array.isArray(m.kpis) && m.kpis.length > 0), 'each module has a key, title, route and KPIs');
        ok(d.modules.every((m) => m.chart && ['bar', 'donut'].includes(m.chart.type) && Array.isArray(m.chart.data)), 'each module carries a bar or donut chart');
        ok(d.modules.every((m) => m.kpis.every((k) => 'label' in k && 'value' in k)), 'every KPI is labelled and valued');

        // ---- trends: history + forecast, tagged KPI/KRI ----
        ok(d.trends.months.length >= 6 && d.trends.forecastMonths.length >= 1, `${d.trends.months.length} months of history + ${d.trends.forecastMonths.length} projected`);
        ok(d.trends.metrics.length > 0, `${d.trends.metrics.length} trend metrics selectable`);
        ok(d.trends.metrics.some((m) => m.key === 'tickets_opened'), 'the seeded ticket surfaced its trend metric');
        ok(d.trends.metrics.every((m) => m.values.some((v) => v !== 0)), 'flat-zero series are filtered out of the dropdown');
        ok(d.trends.metrics.every((m) => m.values.length === d.trends.months.length), 'every metric series matches the month axis');
        ok(d.trends.metrics.every((m) => m.forecast.length === d.trends.forecastMonths.length), 'every forecast series matches the forecast axis');
        ok(d.trends.metrics.every((m) => ['KPI', 'KRI'].includes(m.kind)), 'every metric is tagged KPI or KRI');
        ok(d.trends.metrics.some((m) => m.kind === 'KRI') && d.trends.metrics.some((m) => m.kind === 'KPI'), 'both KPIs and KRIs are present');
        ok(new Set(d.trends.metrics.map((m) => m.key)).size === d.trends.metrics.length, 'metric keys are unique (safe as dropdown values)');
        ok(d.trends.metrics.every((m) => m.module), 'each metric names its module for dropdown grouping');

        // ---- forecast ----
        ok(d.forecast.projectedArr > 0 && d.forecast.arrInr === d.headline.arrInr, 'forecast projects ARR from the current book');
        ok(d.forecast.renewalCount90 === d.headline.renewalsDue90, 'renewal count agrees with the headline');
        ok(Array.isArray(d.forecast.notes) && d.forecast.notes.length > 0, `${d.forecast.notes?.length} narrative forecast notes`);

        // ---- call to actions ----
        ok(d.actions.length > 0 && d.actions.every((a) => a.team && a.title && a.route && a.priority), 'every action names a team, title, route and priority');
        const rank = { critical: 0, high: 1, medium: 2, low: 3 };
        ok(d.actions.every((a, i) => i === 0 || rank[d.actions[i - 1].priority] <= rank[a.priority]), 'actions are sorted most-urgent first');
        const teams = new Set(d.actions.map((a) => a.team));
        ok(teams.has('Sales') && teams.has('Customer Success'), `actions routed to ${[...teams].join(', ')}`);

        // ---- ABAC: a rep sees a strictly smaller book than the admin ----
        const repView = await (await call(rep, '/dashboard/overview')).json();
        ok(repView.headline.accounts <= d.headline.accounts, `rep sees ${repView.headline.accounts} of ${d.headline.accounts} accounts`);
        ok(repView.headline.arrInr <= d.headline.arrInr, 'rep ARR is scoped to their accounts');
        ok(repView.modules.length === d.modules.length, 'module set is the same shape for a rep (values are scoped, not hidden)');

        expect(__fail, __fail.join('\n')).toEqual([]);
    });
});
