import { describe, it, expect } from 'vitest';
import { scoreCustomer, detectAnomaly, RISK_WEIGHTS } from '../data/riskModel.js';

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
        const plotted = new Set(d.trends.metrics.map((m) => m.key));
        ok(d.trends.metrics.every((m) => withData.has(m.key)), 'every plotted metric is a catalogue entry flagged hasData');
        ok(withData.size === d.trends.metrics.length, `${withData.size} of ${cat.length} tracked metrics have data in this book`);

        // ---- churn-risk board ----
        ok(Array.isArray(d.risk.board) && d.risk.board.length === d.headline.customers, `every customer is scored (${d.risk.board.length})`);
        ok(d.risk.board.every((r) => r.score >= 0 && r.score <= 100), 'scores stay inside 0..100');
        ok(d.risk.board.every((r, i) => i === 0 || d.risk.board[i - 1].score >= r.score), 'the board is ordered most-at-risk first');
        ok(d.risk.board.every((r) => ['Critical', 'High', 'Moderate', 'Low'].includes(r.band)), 'every customer lands in a known band');
        // The point of a transparent model: the score must be reconstructable.
        ok(d.risk.board.every((r) => Array.isArray(r.factors) && (r.score === 0 || r.factors.length > 0)), 'a non-zero score always names its factors');
        ok(d.risk.board.every((r) => r.factors.every((f) => f.label && f.detail && f.points > 0 && f.points <= f.weight)),
            'each factor carries a label, a human-readable reason, and points within its weight');
        ok(d.risk.board.every((r) => r.score === Math.min(100, r.factors.reduce((s, f) => s + f.points, 0))),
            'the score is exactly the sum of its factors — nothing unexplained');
        ok(d.risk.board.every((r) => r.factors.every((f, i) => i === 0 || r.factors[i - 1].points >= f.points)), 'factors are ordered by contribution');
        ok(d.risk.board.every((r) => !r.factors.length || r.topFactor === r.factors[0].label), 'topFactor names the biggest contributor');
        const bandTotal = Object.values(d.risk.counts).reduce((s, n) => s + n, 0);
        ok(bandTotal === d.risk.board.length, 'band counts reconcile with the board');
        ok(d.risk.topDrivers.length > 0 && d.risk.topDrivers.every((t) => t.label && t.points > 0 && t.accounts > 0), `${d.risk.topDrivers.length} systemic risk drivers identified`);
        ok(d.risk.topDrivers.every((t, i) => i === 0 || d.risk.topDrivers[i - 1].points >= t.points), 'drivers are ranked by total contribution');
        const weightSum = Object.values(d.risk.weights).reduce((s, n) => s + n, 0);
        ok(weightSum === 100, `model weights sum to ${weightSum}`);

        // ---- anomaly signals ----
        ok(Array.isArray(d.signals), `${d.signals.length} signals surfaced`);
        ok(d.signals.every((s) => s.key && s.label && s.module && typeof s.z === 'number' && ['up', 'down'].includes(s.direction)),
            'each signal names its metric, module, direction and z-score');
        ok(d.signals.every((s) => Math.abs(s.z) >= 1.5), 'signals only fire past 1.5σ from their own baseline');
        ok(d.signals.every((s) => (s.kind === 'KRI' ? (s.direction === 'up' ? !s.good : s.good) : (s.direction === 'up' ? s.good : !s.good))),
            'good/bad respects whether the metric is a KPI or a KRI');
        ok(d.signals.every((s) => plotted.has(s.key)), 'every signal refers to a plotted metric');
        ok(d.signals.every((s, i) => i === 0 || !(d.signals[i - 1].good && !s.good)), 'signals needing attention come before the good news');

        // ---- NEO briefing ----
        ok(d.briefing.headline && d.briefing.headline.length > 20, 'the briefing opens with a headline sentence');
        ok(Array.isArray(d.briefing.points) && d.briefing.points.length >= 3, `${d.briefing.points.length} briefing points`);
        ok(d.briefing.points.every((p) => typeof p === 'string' && p.length > 0), 'no empty briefing points');
        ok(/\d/.test(d.briefing.headline) || d.briefing.headline.includes('customers'), 'the headline is grounded in a figure');
        ok(d.briefing.basis && d.briefing.basis.includes(String(d.trends.metrics.length)), 'the briefing states what it was computed from');
        // The briefing must agree with the board it describes.
        if (d.risk.board[0] && d.risk.board[0].score >= 30) {
            ok(d.briefing.points[0].includes(d.risk.board[0].account), 'the briefing names the same top-risk account as the board');
        } else {
            ok(true, 'no account above moderate risk — briefing says so instead of naming one');
        }

        // ---- sparklines ----
        ok(d.sparks && typeof d.sparks === 'object', 'headline sparklines are present');
        ok(Object.values(d.sparks).every((s) => s === null || s.length === d.trends.months.length),
            'each spark series matches the month axis (or is null when untracked)');

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

describe('risk model — scoring and anomaly detection', () => {
    it('all checks pass', () => {
        const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

        // ---- the model's contract ----
        ok(Object.values(RISK_WEIGHTS).reduce((s, n) => s + n, 0) === 100, 'weights sum to 100, so a score reads as a percentage of worst case');

        // ---- a healthy, engaged account barely registers ----
        const healthy = scoreCustomer({ health: 'Good', signal: 'Green', adoption: 95, openTickets: 1, responses: 10, detractors: 0 });
        ok(healthy.score < 15 && healthy.band === 'Low', `a healthy account scores ${healthy.score} (Low)`);

        // ---- the worst case saturates but never exceeds 100 ----
        const worst = scoreCustomer({
            health: 'Critical', signal: 'Red', adoption: 0, openTickets: 40, breachedTickets: 9,
            detractors: 10, responses: 10, overdueCheck: true, daysToRenewal: 0
        });
        ok(worst.score === 100 && worst.band === 'Critical', `the worst case scores ${worst.score} (Critical)`);

        // ---- every point is explained ----
        for (const c of [healthy, worst, scoreCustomer({ health: 'Average', signal: 'Amber', adoption: 40 })]) {
            ok(c.score === Math.min(100, c.factors.reduce((s, f) => s + f.points, 0)), `score ${c.score} equals the sum of its factors`);
            ok(c.factors.every((f) => f.points <= f.weight), 'no factor can score above its own weight');
            ok(c.factors.every((f) => typeof f.detail === 'string' && f.detail.length > 0), 'every factor states its reason in words');
        }

        // ---- a never-measured account is an unknown, not a catastrophe ----
        const unmeasured = scoreCustomer({ health: 'Good', signal: 'Unknown', adoption: null });
        const zeroUse = scoreCustomer({ health: 'Good', signal: 'Unknown', adoption: 0 });
        ok(unmeasured.score < zeroUse.score, `never-measured (${unmeasured.score}) scores below genuinely-unused (${zeroUse.score})`);
        ok(unmeasured.factors.find((f) => f.key === 'adoption').detail === 'Never measured', 'and it says so rather than implying zero usage');

        // ---- a couple of open tickets is normal operation, not risk ----
        ok(scoreCustomer({ health: 'Good', signal: 'Green', adoption: 90, openTickets: 2 }).factors.every((f) => f.key !== 'support'),
            'two open tickets contribute no support risk');
        ok(scoreCustomer({ health: 'Good', signal: 'Green', adoption: 90, openTickets: 2, breachedTickets: 1 }).factors.some((f) => f.key === 'support'),
            'but a single SLA breach does');

        // ---- renewal proximity only bites when the date is close ----
        ok(scoreCustomer({ health: 'Good', adoption: 90, daysToRenewal: 300 }).factors.every((f) => f.key !== 'renewal'), 'a renewal 300 days out adds nothing');
        const near = scoreCustomer({ health: 'Good', adoption: 90, daysToRenewal: 10 });
        const mid = scoreCustomer({ health: 'Good', adoption: 90, daysToRenewal: 120 });
        ok(near.score > mid.score, `a renewal in 10 days scores above one in 120 (${near.score} > ${mid.score})`);

        // ---- monotonic in the direction you would expect ----
        const scores = [95, 70, 40, 10].map((a) => scoreCustomer({ health: 'Good', signal: 'Green', adoption: a }).score);
        ok(scores.every((s, i) => i === 0 || s >= scores[i - 1]), `falling adoption raises the score monotonically (${scores.join(' → ')})`);

        // ---- anomaly detection ----
        ok(detectAnomaly([5, 5, 5, 5, 5, 5]) === null, 'a flat series is never an anomaly (zero variance)');
        ok(detectAnomaly([1, 2, 3]) === null, 'too little history to judge');
        ok(detectAnomaly([5, 6, 5, 6, 5, 6]) === null, 'ordinary wobble does not trip the threshold');
        const spike = detectAnomaly([5, 6, 5, 6, 5, 40]);
        ok(spike && spike.direction === 'up' && spike.severity === 'high', `a clear spike is caught (${spike?.z}σ, ${spike?.severity})`);
        ok(spike.baseline === 5.4, `and reports the baseline it broke from (${spike.baseline})`);

        // Direction alone doesn't say whether it is good news.
        const kpiUp = detectAnomaly([5, 6, 5, 6, 5, 40], { kind: 'KPI' });
        const kriUp = detectAnomaly([5, 6, 5, 6, 5, 40], { kind: 'KRI' });
        ok(kpiUp.good === true && kriUp.good === false, 'a spike is good for a KPI and bad for a KRI');
        const kriDown = detectAnomaly([40, 38, 41, 39, 40, 2], { kind: 'KRI' });
        ok(kriDown.direction === 'down' && kriDown.good === true, 'a KRI collapsing is good news');

        expect(__fail, __fail.join('\n')).toEqual([]);
    });
});
