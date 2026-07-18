import { describe, it, expect } from 'vitest';

const API = 'http://localhost:5099/api';

const login = async (email, password) => (await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
})).json()).token;
const call = (t, p, opts = {}) => fetch(`${API}${p}`, {
    ...opts, headers: { Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
});

// Every module page must have a report. This proves the engine is wired for all.
const MODULES = ['accounts', 'contracts', 'onboarding', 'support', 'training', 'documents', 'health-checks', 'ebrs'];

describe('reports engine — every module has an executive report + export', () => {
    it('all checks pass', async () => {
        const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

        const admin = await login('demo@example.com', 'password123');
        ok(admin, 'admin login');

        for (const mod of MODULES) {
            // ---- in-app JSON report ----
            const res = await call(admin, `/data/${mod}/report.json`);
            const body = await res.json().catch(() => ({}));
            const s = body.summary;
            ok(res.status === 200 && s && Array.isArray(s.kpis) && s.kpis.length >= 1,
                `${mod}: report.json returns a summary with KPIs (${s?.kpis?.length || 0})`);
            ok(s && s.bars && Array.isArray(s.bars.items) && Array.isArray(s.sections) && Array.isArray(s.actions),
                `${mod}: report carries bars, sections and actions`);
            ok(s && s.kpis.every((k) => 'label' in k && 'value' in k),
                `${mod}: every KPI has a label and value`);

            // ---- Excel export ----
            const xlsx = await call(admin, `/data/${mod}/export.xlsx`);
            const ct = xlsx.headers.get('content-type') || '';
            ok(xlsx.status === 200 && ct.includes('spreadsheet'), `${mod}: export.xlsx streams a workbook`);

            // ---- PDF report ----
            const pdf = await call(admin, `/data/${mod}/report.pdf`);
            const pct = pdf.headers.get('content-type') || '';
            ok(pdf.status === 200 && pct.includes('pdf'), `${mod}: report.pdf streams a PDF`);
        }

        // ---- unknown module is a clean 404 ----
        const bad = await call(admin, '/data/not-a-module/report.json');
        ok(bad.status === 404, `unknown module reports 404 (${bad.status})`);

        expect(__fail, __fail.join('\n')).toEqual([]);
    });
});
