import { getDb } from '../db.js';
import { config } from '../config.js';
import { accountRepo } from './accountRepo.js';
import { contractRepo } from './contractRepo.js';
import { supportRepo } from './supportRepo.js';
import { healthRepo } from './healthRepo.js';
import { featureRepo } from './featureRepo.js';
import { eventRepo } from './eventRepo.js';
import { quarterKey } from '../data/ebrPeriods.js';
import { SOURCES, METRICS } from '../data/metricRegistry.js';

/**
 * Generic metric provenance.
 *
 * Takes a declaration from the registry, loads its source rows scoped to what
 * the caller may read, applies the declared filter, and returns the surviving
 * rows plus the value they add up to. Because the value is computed from the
 * same rows it returns, a drill-down cannot disagree with itself — the tests
 * assert `value === Σ rows` for every summing metric.
 */

const sum = (a) => a.reduce((s, n) => s + (n || 0), 0);

/** Load the rows for a source, already scoped by ABAC. */
async function loadSource(sourceKey, user, ctx) {
    const src = SOURCES[sourceKey];
    // Accounts and contracts come through their repos, which apply ABAC and
    // derive fields (days_to_renewal, meddicc score) that the raw tables lack.
    if (sourceKey === 'accounts') return ctx.accounts;
    if (sourceKey === 'contracts') return ctx.contracts;

    const db = await getDb();
    const rows = await db.all(`SELECT * FROM ${src.table}`);
    return rows.filter((r) => ctx.names.has(r.account));
}

export const metricRepo = {
    /** Every metric key the platform can explain, for discovery and testing. */
    keys() {
        return Object.keys(METRICS);
    },

    async explain(user, key) {
        const def = METRICS[key];
        if (!def) return { notFound: true };
        const src = SOURCES[def.source];

        const fx = config.fxUsdInr;
        const accounts = await accountRepo.list(user);
        const names = new Set(accounts.map((a) => a.name));
        const customerNames = new Set(accounts.filter((a) => a.segment === 'Customer').map((a) => a.name));
        const contracts = (await contractRepo.list({}, user)).filter((c) => customerNames.has(c.account));

        const ctx = {
            accounts, contracts, names, customerNames, fx,
            cVal: (c) => (c.currency === 'INR' ? c.arr : (c.arr || 0) * fx) || 0,
            toInr: (r) => ((r.currency === 'USD' ? (r.value_amount || 0) * fx : (r.value_amount || 0)) || 0),
            acctValue: (a) => (a.value_currency === 'INR' ? a.value_amount : (a.value_amount || 0) * fx) || 0,
            // Repo readers for the metrics whose fields are derived, not stored.
            supportList: (u, f) => supportRepo.list(u, f),
            accountHealth: (u) => healthRepo.accountHealth(u),
            featureList: (u) => featureRepo.list(u, {}),
            eventList: (u) => eventRepo.list(u, {}),
            // The quarter in progress — EBR metrics report on it, matching the page.
            quarter: quarterKey()
        };

        // Some numbers can't be expressed as filter-a-table: an SLA breach is
        // derived during list decoration, a completion rate is a ratio. Those
        // declare `rowsFrom` and supply their own already-scoped rows.
        const all = def.rowsFrom ? await def.rowsFrom(user, ctx) : await loadSource(def.source, user, ctx);
        let matched = all.filter((r) => def.filter(r, ctx));

        // A "distinct" metric counts accounts, not records — several nudges to the
        // same customer is still one customer nudged.
        if (def.distinctBy) {
            const seen = new Set();
            matched = matched.filter((r) => {
                const k = r[def.distinctBy];
                if (seen.has(k)) return false;
                seen.add(k); return true;
            });
        }

        // A `rowsFrom` metric often returns a shape unrelated to its table, so it
        // can replace the source's columns outright.
        const columns = def.columnsOverride || [...src.columns, ...(def.extraColumns || [])];
        const rows = matched.map((r) => {
            const out = {};
            for (const c of columns) out[c.key] = r[c.key] ?? null;
            // `contribution` is what this row adds to the total — only meaningful
            // when the metric sums something rather than counting rows.
            if (def.measure) out.contribution = Math.round(def.measure(r, ctx));
            return out;
        });

        // Sort biggest-contributor first when summing, so the drill-down opens on
        // whatever is actually moving the number.
        if (def.measure) rows.sort((a, b) => b.contribution - a.contribution);

        // A ratio metric reports its own headline (x of y as a percentage); the
        // rows below it are still the numerator, which is what you'd want to see.
        let value;
        // With nothing to divide by, the modules differ on what to report —
        // support says "no SLA data" (null), training says 0% completed.
        // `emptyValue` mirrors whichever the card shows so the two never disagree.
        const empty = def.emptyValue === undefined ? null : def.emptyValue;
        if (def.ratioSum) {
            // A rate over quantities (learners, seats) rather than over records.
            const num = sum(matched.map(def.ratioSum.numerator));
            const den = sum(matched.map(def.ratioSum.denominator));
            value = den ? Math.round((num / den) * 100) : empty;
        } else if (def.ratioOf) {
            const den = all.filter((r) => def.ratioOf(r, ctx)).length;
            value = den ? Math.round((matched.length / den) * 100) : empty;
        } else if (def.measure) {
            value = Math.round(sum(matched.map((r) => def.measure(r, ctx))));
        } else {
            value = matched.length;
        }
        const isRatio = !!(def.ratioOf || def.ratioSum);

        return {
            key,
            label: def.label,
            definition: def.definition,
            formula: def.formula,
            caveats: def.caveats || [],
            format: def.format,
            value,
            sources: [{ module: src.module, route: src.route, record: src.record, count: all.length }],
            columns,
            rows,
            // Counting metrics have no column to total; summing ones total their
            // contribution column.
            noTotal: !def.measure || isRatio,
            countRows: !def.measure && !isRatio
        };
    }
};
