import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getModule } from '../modules/registry.js';
import { buildExport, buildTemplate, parseWorkbook } from '../services/excelService.js';
import { buildExecutivePdf } from '../services/pdfService.js';
import { generateExecutiveSummary } from '../services/summaryService.js';
import { config } from '../config.js';

const router = express.Router();
router.use(authenticateToken);

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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

// Excel export of the current data (scoped to the caller).
router.get('/:module/export.xlsx', wrap(async (req, res) => {
    const mod = resolveModule(req, res); if (!mod) return;
    const { columns, rows } = await mod.exportData(req.user);
    const buf = await buildExport(columns, rows);
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename="${mod.key}-export.xlsx"`);
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
    const { fileBase64 } = req.body || {};
    if (!fileBase64) return res.status(400).json({ error: 'No file provided' });
    const buffer = Buffer.from(String(fileBase64).split(',').pop(), 'base64');
    const parsed = await parseWorkbook(buffer);
    if (!parsed.rows.length) return res.status(400).json({ error: 'No data rows found on the "Data" sheet' });
    const result = await mod.importData(req.user, parsed);
    res.json(result);
}));

// Executive PDF report (computed summary).
router.get('/:module/report.pdf', wrap(async (req, res) => {
    const mod = resolveModule(req, res); if (!mod) return;
    const records = await mod.records(req.user);
    const summary = await generateExecutiveSummary(records, { fx: config.fxUsdInr });
    const buf = await buildExecutivePdf(summary, { title: mod.title, subtitle: 'Executive Report' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${mod.key}-executive-report.pdf"`);
    res.send(buf);
}));

export default router;
