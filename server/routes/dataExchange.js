import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getModule, modules } from '../modules/registry.js';
import { buildExport, buildTemplate, parseWorkbook } from '../services/excelService.js';
import { buildExecutivePdf } from '../services/pdfService.js';
import { generateExecutiveSummary } from '../services/summaryService.js';
import { PERIOD_FIELD, filterByPeriod, resolvePeriod } from '../modules/periodFields.js';
import { config } from '../config.js';

const router = express.Router();
router.use(authenticateToken);

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// A human label for the period, used in report subtitles + filenames so a
// downloaded report visibly reflects the span it covers.
function periodLabel({ from, to }) {
    if (from && to) return `${from} to ${to}`;
    if (from) return `since ${from}`;
    if (to) return `through ${to}`;
    return 'All time';
}
const periodSlug = ({ from, to }) => (from || to ? `_${from || 'start'}_to_${to || 'today'}` : '');

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
});

function resolveModule(req, res) {
    const mod = getModule(req.params.module);
    if (!mod) { res.status(404).json({ error: `Unknown module: ${req.params.module}` }); return null; }
    return mod;
}

// Catalogue of reportable modules — powers the Reports page dropdown. `period`
// tells the UI whether a date range applies (and which field it scopes on).
router.get('/modules', wrap(async (req, res) => {
    res.json({
        modules: Object.values(modules).map((m) => ({
            key: m.key,
            title: m.title,
            periodField: PERIOD_FIELD[m.key] || null
        }))
    });
}));

// Excel export of the current data (scoped to the caller + optional period).
router.get('/:module/export.xlsx', wrap(async (req, res) => {
    const mod = resolveModule(req, res); if (!mod) return;
    const period = resolvePeriod(req.query, mod.key);
    const { columns, rows } = await mod.exportData(req.user);
    const scoped = filterByPeriod(rows, period.field, period.from, period.to);
    const buf = await buildExport(columns, scoped);
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename="${mod.key}-export${periodSlug(period)}.xlsx"`);
    res.send(buf);
}));

// Guided, validated import template.
router.get('/:module/template.xlsx', wrap(async (req, res) => {
    const mod = resolveModule(req, res); if (!mod) return;
    const { columns, example, moduleTitle } = await mod.templateColumns();
    const buf = await buildTemplate(columns, { title: mod.title, example, moduleTitle });
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename="${mod.key}-template.xlsx"`);
    res.send(buf);
}));

// Bulk import: { fileBase64 } -> parse -> validate -> create. Returns a per-row report.
router.post('/:module/import', wrap(async (req, res) => {
    const mod = resolveModule(req, res); if (!mod) return;
    if (typeof mod.importData !== 'function') {
        return res.status(400).json({ error: `The ${mod.title} module does not support bulk import.` });
    }
    const { fileBase64 } = req.body || {};
    if (!fileBase64) return res.status(400).json({ error: 'No file provided' });
    const buffer = Buffer.from(String(fileBase64).split(',').pop(), 'base64');
    const parsed = await parseWorkbook(buffer);
    if (!parsed.rows.length) return res.status(400).json({ error: 'No data rows found on the "Data" sheet' });
    const result = await mod.importData(req.user, parsed);
    res.json(result);
}));

// In-app executive report (same computed summary the PDF renders, as JSON).
// Honours ?from=&to= — the summary is computed over only the in-period records.
router.get('/:module/report.json', wrap(async (req, res) => {
    const mod = resolveModule(req, res); if (!mod) return;
    const period = resolvePeriod(req.query, mod.key);
    const all = await mod.records(req.user);
    // Value-recognising modules (accounts, contracts) pro-rate over the range, so
    // they keep every record and apportion; others drop rows outside the window.
    const records = mod.proratesValue ? all : filterByPeriod(all, period.field, period.from, period.to);
    const summary = mod.summarize ? await mod.summarize(records, period) : await generateExecutiveSummary(records, { fx: config.fxUsdInr });
    res.json({
        module: mod.key,
        title: mod.title,
        generatedAt: new Date().toISOString(),
        period: { from: period.from, to: period.to, field: period.field, applied: period.applied, label: periodLabel(period) },
        recordCount: Array.isArray(records) ? records.length : null,
        summary
    });
}));

// Executive PDF report (computed summary), period-scoped.
router.get('/:module/report.pdf', wrap(async (req, res) => {
    const mod = resolveModule(req, res); if (!mod) return;
    const period = resolvePeriod(req.query, mod.key);
    const all = await mod.records(req.user);
    const records = mod.proratesValue ? all : filterByPeriod(all, period.field, period.from, period.to);
    const summary = mod.summarize ? await mod.summarize(records, period) : await generateExecutiveSummary(records, { fx: config.fxUsdInr });
    const subtitle = period.applied ? `Executive Report · ${periodLabel(period)}` : 'Executive Report';
    const buf = await buildExecutivePdf(summary, { title: mod.title, subtitle });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${mod.key}-executive-report${periodSlug(period)}.pdf"`);
    res.send(buf);
}));

export default router;
