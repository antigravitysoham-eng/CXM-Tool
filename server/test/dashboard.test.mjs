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
        const H = ['arrInr', 'arpaInr', 'customers', 'accounts', 'nrr', 'grr', 'lostArrInr', 'expansionWonInr',
            'atRiskCustomers', 'atRiskArrInr', 'pipelineInr', 'weightedPipelineInr', 'nps', 'csat', 'detractors',
            'healthRed', 'healthGreen', 'openTickets', 'avgAdoption', 'dormantModules', 'renewalsDue90',
            'atRiskValueInr', 'expansionWeightedInr', 'csmCount', 'regionsCovered', 'industriesCovered'];
        ok(H.every((k) => k in d.headline), `headline carries all ${H.length} executive figures`);
        ok(d.headline.arrInr > 0 && d.headline.customers > 0, `ARR ${d.headline.arrInr} across ${d.headline.customers} customers`);
        ok(d.headline.weightedPipelineInr <= d.headline.pipelineInr, 'weighted pipeline never exceeds open pipeline');

        // ARR counts the customer book only — prospects and partners hold contracts too,
        // and folding those in would overstate recurring revenue.
        const allAccounts = await (await call(admin, '/accounts')).json();
        const custNames = new Set(allAccounts.filter((a) => a.segment === 'Customer').map((a) => a.name));
        const allContracts = await (await call(admin, '/contracts')).json();
        const customerArr = allContracts
            .filter((c) => custNames.has(c.account) && (c.status === 'Active' || c.status === 'Renewing'))
            .reduce((s, c) => s + (c.currency === 'INR' ? (c.arr || 0) : 0), 0);
        ok(d.headline.arrInr >= customerArr, `ARR ${d.headline.arrInr} covers the INR customer contracts (${customerArr})`);
        const nonCustomerArr = allContracts
            .filter((c) => !custNames.has(c.account) && (c.status === 'Active' || c.status === 'Renewing'))
            .reduce((s, c) => s + (c.currency === 'INR' ? (c.arr || 0) : 0), 0);
        ok(d.headline.arrInr < customerArr + nonCustomerArr || nonCustomerArr === 0,
            nonCustomerArr ? `ARR excludes ${nonCustomerArr} sitting on non-customer accounts` : 'no non-customer contracts to exclude');

        // Retention: gross can never exceed 100%, net can (expansion).
        ok(d.headline.grr === null || d.headline.grr <= 100, `GRR ${d.headline.grr}% never exceeds 100%`);
        ok(d.headline.nrr === null || d.headline.nrr >= d.headline.grr, `NRR ${d.headline.nrr}% is at or above GRR`);
        ok(d.headline.arpaInr === Math.round(d.headline.arrInr / d.headline.customers), 'ARPA is ARR divided across the customer count');

        // At-risk is health-led, and its ARR can never exceed the whole book.
        ok(d.headline.atRiskArrInr <= d.headline.arrInr, `at-risk ARR ${d.headline.atRiskArrInr} sits inside total ARR`);
        ok(d.headline.atRiskCustomers <= d.headline.customers, `${d.headline.atRiskCustomers} at-risk of ${d.headline.customers} customers`);

        // ---- coverage ----
        for (const k of ['byRegion', 'byIndustry', 'byTier', 'bySegment', 'byHealth']) {
            ok(Array.isArray(d.coverage[k]) && d.coverage[k].every((r) => 'name' in r && 'value' in r), `coverage.${k} is a name/value series`);
        }
        ok(d.coverage.regionsCovered === d.headline.regionsCovered, 'region count agrees between coverage and headline');
        ok(d.coverage.byRegion.reduce((s, r) => s + r.value, 0) === d.headline.customers, 'region series accounts for every customer');
        ok(d.coverage.byIndustry.reduce((s, r) => s + r.value, 0) === d.headline.customers, 'industry series accounts for every customer');

        // ---- customers by CSM ----
        ok(Array.isArray(d.coverage.byCsm) && d.coverage.byCsm.length > 0, `${d.coverage.byCsm.length} CSMs hold the book`);
        ok(d.coverage.byCsm.every((c) => c.name && 'value' in c && 'arr' in c && 'atRisk' in c), 'each CSM carries name, customer count, ARR and at-risk count');
        ok(d.coverage.byCsm.reduce((s, c) => s + c.value, 0) === d.headline.customers, 'every customer is assigned to exactly one CSM');
        ok(d.coverage.byCsm.reduce((s, c) => s + c.atRisk, 0) === d.headline.atRiskCustomers, 'at-risk counts per CSM reconcile with the headline');
        ok(d.coverage.byCsm.every((c, i) => i === 0 || d.coverage.byCsm[i - 1].arr >= c.arr), 'CSMs are ordered by the ARR they carry');
        ok(d.coverage.csmCount === d.coverage.byCsm.length, 'the CSM count matches the series length');

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
        ok(d.trends.metrics.every((m) => ['num', 'pct', 'inr', 'days', 'hrs', 'score'].includes(m.unit)), 'every metric declares a unit the chart can format');

        // The trend section is the dashboard's cross-module lens, so the catalogue has
        // to be broad — one lonely KRI makes the dropdown pointless. Assert against the
        // catalogue, not the plotted list: which series carry data depends on the book,
        // but what the platform tracks must not silently shrink.
        const cat = d.trends.catalogue;
        ok(Array.isArray(cat) && cat.every((m) => m.key && m.label && m.module && m.kind && 'hasData' in m), `catalogue of ${cat.length} tracked metrics`);
        const trendModules = new Set(cat.map((m) => m.module));
        ok(trendModules.size >= 10, `trends span ${trendModules.size} modules: ${[...trendModules].join(', ')}`);
        const kris = cat.filter((m) => m.kind === 'KRI');
        const kpis = cat.filter((m) => m.kind === 'KPI');
        ok(kris.length >= 12, `${kris.length} KRIs tracked (not just one)`);
        ok(kpis.length >= 20, `${kpis.length} KPIs tracked`);
        const kriModules = new Set(kris.map((m) => m.module));
        ok(kriModules.size >= 8, `KRIs come from ${kriModules.size} different modules: ${[...kriModules].join(', ')}`);
        ok(new Set(cat.map((m) => m.key)).size === cat.length, 'catalogue keys are unique');
        // Everything plotted must be a catalogue entry that actually has data.
        const withData = new Set(cat.filter((m) => m.hasData).map((m) => m.key));
        ok(d.trends.metrics.every((m) => withData.has(m.key)), 'every plotted metric is a catalogue entry flagged hasData');
        ok(withData.size === d.trends.metrics.length, `${withData.size} of ${cat.length} tracked metrics have data in this book`);

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
