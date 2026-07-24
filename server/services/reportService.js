import { getModule } from '../modules/registry.js';
import { buildExecutivePdf } from './pdfService.js';
import { generateExecutiveSummary } from './summaryService.js';
import { config } from '../config.js';

/**
 * Build a module's executive PDF report as a Buffer, scoped to `user` — the exact
 * same summary + renderer the in-app "Report" button and the /data/:module/report.pdf
 * route use, so WhatsApp gets the identical document. Returns null for an unknown
 * module. ABAC is enforced upstream (caller checks canUseModule) and again inside
 * mod.records(user).
 */
export async function buildModuleReportPdf(moduleKey, user) {
    const mod = getModule(moduleKey);
    if (!mod) return null;
    const records = await mod.records(user);
    const summary = mod.summarize
        ? await mod.summarize(records)
        : await generateExecutiveSummary(records, { fx: config.fxUsdInr });
    const buffer = await buildExecutivePdf(summary, { title: mod.title, subtitle: 'Executive Report' });
    return { buffer, filename: `${mod.key}-report.pdf`, title: mod.title };
}
