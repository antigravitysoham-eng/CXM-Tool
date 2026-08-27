import { describe, it, expect } from 'vitest';

const API = 'http://localhost:5099/api';

const login = async (email, password) => (await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
})).json()).token;
const call = (t, p, opts = {}) => fetch(`${API}${p}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
});
const json = async (t, p) => (await call(t, p)).json();

/**
 * The card and its drill-down are computed by two different code paths — the
 * module's own stats endpoint, and the metric registry. If they ever disagree,
 * the popup is lying about the number above it, which is worse than having no
 * popup at all. Every wired card is pinned here.
 *
 * [registry key, module stats endpoint, field in that payload]
 */
const CARD_PAIRS = [
    ['support.open', '/support/stats', 'open'],
    ['support.breached', '/support/stats', 'breached'],
    ['support.atRisk', '/support/stats', 'atRisk'],
    ['support.slaAttainment', '/support/stats', 'slaAttainment'],
    ['training.sessions', '/training/stats', 'sessions'],
    ['training.enrolled', '/training/stats', 'enrolled'],
    ['training.certified', '/training/stats', 'certified'],
    ['training.completionRate', '/training/stats', 'completionRate'],
    ['health.openActions', '/health-checks/stats', 'openActions'],
    ['ebr.generated', '/ebrs/coverage', 'generated'],
    ['ebr.shared', '/ebrs/coverage', 'shared'],
    ['ebr.pendingShare', '/ebrs/coverage', 'pendingShare'],
    ['features.total', '/feature-requests/stats', 'total'],
    ['features.open', '/feature-requests/stats', 'open'],
    ['features.shipped', '/feature-requests/stats', 'shipped'],
    ['features.demand', '/feature-requests/stats', 'totalDemand'],
    ['referrals.total', '/referrals/stats', 'total'],
    ['referrals.converted', '/referrals/stats', 'converted'],
    ['referrals.pipeline', '/referrals/stats', 'referredValueInr'],
    ['comms.campaigns', '/comms/stats', 'campaigns'],
    ['comms.sent', '/comms/stats', 'sent'],
    ['events.total', '/events/stats', 'events'],
    ['events.upcoming', '/events/stats', 'upcoming'],
    ['events.registered', '/events/stats', 'totalRegistered'],
    ['upsells.open', '/upsells/stats', 'open'],
    ['upsells.weighted', '/upsells/stats', 'weightedForecastInr'],
    ['upsells.won', '/upsells/stats', 'wonInr'],
    ['journey.customers', '/journey/stats', 'customers'],
    ['journey.atRisk', '/journey/stats', 'atRisk'],
    ['onboarding.inFlight', '/onboarding/stats', 'inProgress'],
    ['onboarding.atRisk', '/onboarding/stats', 'atRisk'],
    ['onboarding.live', '/onboarding/stats', 'live'],
    ['training.bookings', '/training/revenue', 'bookings'],
    ['training.collected', '/training/revenue', 'collected'],
    ['training.pending', '/training/revenue', 'pending'],
    ['surveys.responses', '/surveys/stats', 'responses']
];

describe('metric registry — provenance for every module KPI', () => {
    it('all checks pass', async () => {
        const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

        const admin = await login('demo@example.com', 'password123');
        const rep = await login('priya@cashhorizon.io', 'demo1234');
        ok(admin && rep, 'admin + rep logins');

        // ---- discovery ----
        ok((await fetch(`${API}/metrics`)).status === 401, 'the registry listing needs auth');
        const { keys } = await json(admin, '/metrics');
        ok(Array.isArray(keys) && keys.length >= 45, `${keys.length} metrics are explainable`);
        ok(keys.every((k) => /^[a-z]+\.[A-Za-z]+$/.test(k)), 'every key is module.metric');
        ok(new Set(keys).size === keys.length, 'keys are unique');
        ok((await call(admin, '/metrics/nope.nope/explain')).status === 404, 'an unknown key is a 404');
        ok((await fetch(`${API}/metrics/support.open/explain`)).status === 401, 'explain needs auth');

        // ---- shape and self-consistency for every registered metric ----
        let summing = 0, counting = 0, ratios = 0;
        for (const key of keys) {
            const x = await json(admin, `/metrics/${key}/explain`);
            if (x.error) { ok(false, `${key}: ${x.error}`); continue; }
            const shapeOk = x.label && x.definition && x.formula
                && Array.isArray(x.columns) && x.columns.length > 0
                && Array.isArray(x.rows) && Array.isArray(x.sources) && x.sources.length > 0
                && x.sources.every((s) => s.module && s.route && s.record && typeof s.count === 'number');
            if (!shapeOk) { ok(false, `${key}: incomplete provenance`); continue; }
            if (!x.rows.every((r) => x.columns.every((c) => c.key in r))) { ok(false, `${key}: a row is missing a column`); continue; }

            // The promise of the drill-down: the value is what the rows add up to.
            if (x.countRows) {
                counting += 1;
                if (x.rows.length !== x.value) { ok(false, `${key}: counted ${x.value} but listed ${x.rows.length} rows`); continue; }
            } else if (x.noTotal) {
                ratios += 1;   // a ratio — rows are the numerator, not a sum
            } else {
                summing += 1;
                const t = x.rows.reduce((s, r) => s + (r.contribution || 0), 0);
                if (t !== x.value) { ok(false, `${key}: value ${x.value} but rows sum to ${t}`); continue; }
            }
        }
        ok(__fail.length === 0, `all ${keys.length} metrics are self-consistent (${counting} counting, ${summing} summing, ${ratios} ratio)`);

        // ---- the card and its drill-down must agree ----
        const cache = {};
        for (const [key, ep, field] of CARD_PAIRS) {
            cache[ep] ||= await json(admin, ep);
            const card = cache[ep][field];
            const drill = (await json(admin, `/metrics/${key}/explain`)).value;
            ok(card === drill, `${key}: card ${card} matches drill-down ${drill}`);
        }

        // ---- provenance is scoped like everything else ----
        const adminOpen = await json(admin, '/metrics/support.open/explain');
        const repOpen = await json(rep, '/metrics/support.open/explain');
        ok(repOpen.rows.length <= adminOpen.rows.length, `rep sees ${repOpen.rows.length} of ${adminOpen.rows.length} open tickets`);
        const repTickets = await json(rep, '/support/stats');
        ok(repOpen.value === repTickets.open, "rep's drill-down matches their own scoped card");

        // ---- the dashboard's derived six are served by the same endpoint ----
        for (const key of ['arr', 'nrr', 'atRisk', 'expansion', 'nps', 'adoption']) {
            const x = await json(admin, `/metrics/${key}/explain`);
            ok(!x.error && x.formula, `${key}: the dashboard metric resolves through /metrics too`);
        }

        expect(__fail, __fail.join('\n')).toEqual([]);
    });
});
