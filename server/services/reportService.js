import { getModule } from '../modules/registry.js';
import { buildExecutivePdf } from './pdfService.js';
import { generateExecutiveSummary } from './summaryService.js';
import { PERIOD_FIELD, filterByPeriod } from '../modules/periodFields.js';
import { config } from '../config.js';

/**
 * Build a module's executive PDF report as a Buffer, scoped to `user` — the exact
 * same summary + renderer the in-app "Report" button and the /data/:module/report.pdf
 * route use, so WhatsApp gets the identical document. Returns null for an unknown
 * module. An optional `period` ({ from, to, label }) scopes the records to a span
 * (the same PERIOD_FIELD the reports engine uses). ABAC is enforced upstream
 * (canUseModule) and again inside mod.records(user).
 */
export async function buildModuleReportPdf(moduleKey, user, period = null) {
    const mod = getModule(moduleKey);
    if (!mod) return null;
    let records = await mod.records(user);
    const field = PERIOD_FIELD[moduleKey];
    const scoped = period && (period.from || period.to);
    if (scoped && field) records = filterByPeriod(records, field, period.from, period.to);
    const summary = mod.summarize
        ? await mod.summarize(records)
        : await generateExecutiveSummary(records, { fx: config.fxUsdInr });
    const subtitle = period && period.label && period.label !== 'All time' ? `Executive Report · ${period.label}` : 'Executive Report';
    const buffer = await buildExecutivePdf(summary, { title: mod.title, subtitle });
    const slug = scoped ? `_${period.from || 'start'}_to_${period.to || 'today'}` : '';
    return { buffer, filename: `${mod.key}-report${slug}.pdf`, title: mod.title, count: Array.isArray(records) ? records.length : null };
}
