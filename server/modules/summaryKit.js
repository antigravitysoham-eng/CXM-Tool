/**
 * Shared helpers for module executive summaries.
 *
 * Every module's `summarize(records)` returns the same shape the PDF renderer
 * and the in-app Report view both consume:
 *   { kpis:[{label,value,hint,color}], bars:{title,items:[{label,sub,value,valueStr}]},
 *     sections:[{title,color,lines:[]}], actions:[], generatedBy }
 *
 * Currency is PDF-safe ("Rs") because pdfkit's built-in fonts lack the ₹ glyph.
 */

export const COLORS = {
    cyan: '#22d3ee', indigo: '#818cf8', green: '#34d399', red: '#f87171',
    amber: '#fbbf24', violet: '#a855f7', sky: '#38bdf8', slate: '#94a3b8'
};

export function fmtInr(n) {
    const v = Math.round(Number(n) || 0);
    if (v >= 10000000) return `Rs ${(v / 10000000).toFixed(2).replace(/\.00$/, '')} Cr`;
    if (v >= 100000) return `Rs ${(v / 100000).toFixed(2).replace(/\.00$/, '')} L`;
    return `Rs ${v.toLocaleString('en-IN')}`;
}

export const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
export const plural = (n, s, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;

// Turn a {key:count} map into sorted bar items.
export function barsFromMap(title, map, { valueStr } = {}) {
    const items = Object.entries(map || {})
        .map(([label, value]) => ({ label, sub: `${value}`, value, valueStr: valueStr ? valueStr(value) : String(value) }))
        .sort((a, b) => b.value - a.value);
    return { title, items: items.length ? items : [{ label: 'No data', sub: '', value: 0, valueStr: '0' }] };
}

export function kpi(label, value, hint, color) {
    return { label, value: String(value), hint, color };
}
