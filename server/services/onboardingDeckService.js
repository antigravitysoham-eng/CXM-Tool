/**
 * Per-customer onboarding deck (.pptx), generated from the onboarding record +
 * the scope of deliverables carried over from CLM. Built with pptxgenjs so the
 * CSM gets an editable PowerPoint to walk the customer through at kickoff.
 */
import pptxgen from 'pptxgenjs';

const BG = '0B1020';
const PANEL = '141C34';
const ACCENT = '6366F1';
const CYAN = '22D3EE';
const TEXT = 'E8ECF6';
const MUTED = '8592AD';
const GREEN = '34D399';
const AMBER = 'FBBF24';

const FONT = 'Segoe UI';
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const statusColor = (st) => (st === 'Done' ? GREEN : st === 'Blocked' ? 'EF4444' : st === 'In progress' ? AMBER : MUTED);

function headerBand(slide, kicker, title) {
    slide.background = { color: BG };
    slide.addShape('rect', { x: 0, y: 0, w: '100%', h: 0.9, fill: { color: PANEL } });
    slide.addText('AGCX', { x: 0.5, y: 0.16, w: 3, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: CYAN, charSpacing: 2 });
    slide.addText(kicker.toUpperCase(), { x: 0.5, y: 0.42, w: 8, h: 0.3, fontFace: FONT, fontSize: 9, color: MUTED, charSpacing: 2 });
    slide.addText(title, { x: 0.5, y: 1.15, w: 12.3, h: 0.7, fontFace: FONT, fontSize: 26, bold: true, color: TEXT });
}

export async function buildOnboardingDeck(onboarding) {
    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'AGCX';
    pptx.company = 'AGCX';
    pptx.title = `Onboarding — ${onboarding.account}`;

    const scope = onboarding.scope || [];
    const stages = onboarding.stages || [];

    // ── Slide 1 — title ────────────────────────────────────────────────
    const s1 = pptx.addSlide();
    s1.background = { color: BG };
    s1.addShape('rect', { x: 0, y: 3.0, w: '100%', h: 1.5, fill: { color: PANEL } });
    s1.addText('ONBOARDING PLAN', { x: 0.6, y: 2.15, w: 10, h: 0.4, fontFace: FONT, fontSize: 14, color: CYAN, charSpacing: 3 });
    s1.addText(onboarding.account, { x: 0.6, y: 2.6, w: 12, h: 1.1, fontFace: FONT, fontSize: 44, bold: true, color: TEXT });
    s1.addText(
        [
            { text: 'Kickoff  ', options: { color: MUTED } }, { text: fmtDate(onboarding.kickoff_date), options: { color: TEXT, bold: true } },
            { text: '      Target go-live  ', options: { color: MUTED } }, { text: fmtDate(onboarding.target_go_live), options: { color: TEXT, bold: true } },
        ],
        { x: 0.6, y: 4.55, w: 12, h: 0.4, fontFace: FONT, fontSize: 14 }
    );
    s1.addText(`Your CSM: ${onboarding.csm_name || 'To be assigned'}${onboarding.csm_email ? `  ·  ${onboarding.csm_email}` : ''}`,
        { x: 0.6, y: 5.05, w: 12, h: 0.4, fontFace: FONT, fontSize: 12, color: MUTED });
    s1.addText('Prepared with AGCX', { x: 0.6, y: 6.9, w: 6, h: 0.3, fontFace: FONT, fontSize: 9, color: MUTED });

    // ── Slide 2 — welcome / at a glance ───────────────────────────────
    const s2 = pptx.addSlide();
    headerBand(s2, 'Welcome', `We're glad to have ${onboarding.account} on board`);
    const tile = (x, label, value, color) => {
        s2.addShape('roundRect', { x, y: 2.3, w: 3.9, h: 1.5, rectRadius: 0.1, fill: { color: PANEL } });
        s2.addText(label.toUpperCase(), { x: x + 0.2, y: 2.5, w: 3.5, h: 0.3, fontFace: FONT, fontSize: 9, color: MUTED, charSpacing: 1 });
        s2.addText(String(value), { x: x + 0.2, y: 2.85, w: 3.5, h: 0.7, fontFace: FONT, fontSize: 26, bold: true, color });
    };
    const goLive = onboarding.daysToGoLive;
    tile(0.6, 'Progress', `${onboarding.progress ?? 0}%`, CYAN);
    tile(4.7, 'Stages', `${stages.filter((s) => s.status === 'Done').length} / ${stages.length}`, ACCENT);
    tile(8.8, 'Days to go-live', goLive == null ? '—' : goLive, goLive != null && goLive < 0 ? 'EF4444' : GREEN);
    s2.addText(
        onboarding.notes?.trim()
            ? onboarding.notes.trim()
            : `This plan takes ${onboarding.account} from kickoff to first realised value across ${stages.length} stages. We'll track every deliverable together and keep you updated at each milestone.`,
        { x: 0.6, y: 4.2, w: 12.1, h: 1.6, fontFace: FONT, fontSize: 14, color: TEXT, valign: 'top', lineSpacingMultiple: 1.2 }
    );

    // ── Slide 3 — scope of deliverables ───────────────────────────────
    const s3 = pptx.addSlide();
    headerBand(s3, 'Scope of deliverables', 'What we are delivering');
    if (!scope.length) {
        s3.addText('Scope will be confirmed at kickoff and captured here.', { x: 0.6, y: 3, w: 12, h: 0.5, fontFace: FONT, fontSize: 14, color: MUTED });
    } else {
        const head = ['Product / Module', 'Units', 'Key items'].map((t) => ({ text: t, options: { bold: true, color: BG, fill: { color: CYAN }, fontSize: 12 } }));
        const rows = scope.map((sc) => {
            const count = sc.items?.length ? sc.items.length : (sc.unit_count || 0);
            const items = (sc.items || []).slice(0, 4).join(', ') + ((sc.items || []).length > 4 ? ` +${sc.items.length - 4} more` : '');
            return [
                { text: sc.product || sc.product_key, options: { color: TEXT, bold: true } },
                { text: `${count} ${sc.unit_label || ''}`.trim(), options: { color: TEXT } },
                { text: items || sc.info || '—', options: { color: MUTED } },
            ];
        });
        s3.addTable([head, ...rows], {
            x: 0.6, y: 2.1, w: 12.1, colW: [4.2, 2.4, 5.5], border: { type: 'solid', color: '243049', pt: 1 },
            fill: { color: PANEL }, fontFace: FONT, fontSize: 12, rowH: 0.5, valign: 'middle',
        });
    }

    // ── Slide 4 — roadmap ─────────────────────────────────────────────
    const s4 = pptx.addSlide();
    headerBand(s4, 'Roadmap', 'Your onboarding journey');
    if (!stages.length) {
        s4.addText('Stages will appear here once the plan is set.', { x: 0.6, y: 3, w: 12, h: 0.5, fontFace: FONT, fontSize: 14, color: MUTED });
    } else {
        const head = ['#', 'Stage', 'Target', 'Status', 'Tasks'].map((t) => ({ text: t, options: { bold: true, color: BG, fill: { color: CYAN }, fontSize: 12 } }));
        const rows = stages.map((st) => ([
            { text: String(st.stage_no ?? ''), options: { color: MUTED } },
            { text: st.name, options: { color: TEXT, bold: true } },
            { text: fmtDate(st.due_date), options: { color: TEXT } },
            { text: st.status, options: { color: statusColor(st.status), bold: true } },
            { text: `${st.doneCount ?? 0}/${st.taskCount ?? 0}`, options: { color: MUTED } },
        ]));
        s4.addTable([head, ...rows], {
            x: 0.6, y: 2.1, w: 12.1, colW: [0.6, 5.0, 2.4, 2.1, 2.0], border: { type: 'solid', color: '243049', pt: 1 },
            fill: { color: PANEL }, fontFace: FONT, fontSize: 12, rowH: 0.5, valign: 'middle',
        });
    }

    // ── Slide 5 — next steps ──────────────────────────────────────────
    const s5 = pptx.addSlide();
    headerBand(s5, 'Kickoff', 'What happens next');
    const kickoffTasks = (stages.find((s) => s.stage_no === 1)?.tasks || []).filter((t) => !t.done).slice(0, 6);
    const bullets = kickoffTasks.length
        ? kickoffTasks.map((t) => ({ text: `${t.label}${t.owner ? `  (${t.owner})` : ''}`, options: { bullet: true, color: TEXT, fontSize: 15, paraSpaceAfter: 8 } }))
        : [
            { text: 'Confirm stakeholders and success criteria', options: { bullet: true, color: TEXT, fontSize: 15, paraSpaceAfter: 8 } },
            { text: 'Provision access and environments', options: { bullet: true, color: TEXT, fontSize: 15, paraSpaceAfter: 8 } },
            { text: 'Agree the delivery timeline and cadence', options: { bullet: true, color: TEXT, fontSize: 15, paraSpaceAfter: 8 } },
        ];
    s5.addText(bullets, { x: 0.7, y: 2.2, w: 12, h: 3.6, valign: 'top', fontFace: FONT });
    s5.addText(`Questions? Reach your CSM ${onboarding.csm_name || ''}${onboarding.csm_email ? ` at ${onboarding.csm_email}` : ''}.`,
        { x: 0.7, y: 6.4, w: 12, h: 0.4, fontFace: FONT, fontSize: 12, color: MUTED });

    const buffer = await pptx.write({ outputType: 'nodebuffer' });
    const safe = String(onboarding.account || 'customer').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    return { buffer, filename: `onboarding-deck-${safe}.pptx` };
}
