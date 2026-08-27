/**
 * CSM pre-call brief (PDF).
 *
 * A one-page situational read for the CSM before a scheduled health call: how
 * the relationship has gone (prior calls, signal, open actions), the support
 * picture (tickets by status), what's been shipped for them, and a few talking
 * points. Aggregated across modules, ABAC-scoped to the caller.
 *
 * "Doesn't look repetitive": the intro phrasing, section lead-ins, the ordering
 * of the two middle sections and the accent tint are all chosen deterministically
 * from a hash of the account name — so two customers' briefs read differently,
 * but the same customer's brief is stable call to call.
 */
import PDFDocument from 'pdfkit';
import { healthRepo } from '../repositories/healthRepo.js';
import { supportRepo } from '../repositories/supportRepo.js';
import { featureRepo } from '../repositories/featureRepo.js';

const BG = '#0b1020';
const PANEL = '#141c34';
const TEXT = '#e8ecf6';
const MUTED = '#8592ad';
const FAINT = '#5b6787';
const ACCENTS = ['#6366f1', '#0891b2', '#7c3aed', '#0d9488'];
const CYAN = '#22d3ee';
const RESOLVED = new Set(['Resolved', 'Closed']);

const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const trunc = (s, n) => { const t = String(s ?? ''); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

const INTROS = [
    (a) => `Ahead of your call with ${a}, here's where the relationship stands.`,
    (a) => `A quick read on ${a} before you dial in.`,
    (a) => `Everything you need on ${a} going into this conversation.`,
    (a) => `Context for the ${a} call — history, support and what's shipped.`,
];
const HISTORY_LEAD = ['Relationship so far', 'How it has gone', 'The story to date', 'Recent history'];
const SUPPORT_LEAD = ['Support picture', 'On the support desk', 'Tickets right now', 'Support snapshot'];
const PRODUCT_LEAD = ['What we\'ve shipped', 'Product & delivery', 'Value delivered', 'On the product side'];
const TALK_LEAD = ['Bring these up', 'Talking points', 'Worth raising', 'Steer the call to'];

export async function buildPrecallBrief(account, user) {
    // Gather, all ABAC-scoped to the caller. An account the caller can't see
    // yields empty lists everywhere and no board row.
    const calls = (await healthRepo.listCalls(user, { account })) || [];
    const board = (await healthRepo.accountHealth(user)).find((h) => h.account === account) || null;
    const allTickets = await supportRepo.list(user);
    const tickets = allTickets.filter((t) => t.account === account);
    const allFeatures = await featureRepo.list(user);
    const features = allFeatures.filter((f) => f.account === account);

    // If the account isn't visible to this user, none of the above will contain
    // it — and there'll be no board row either.
    const isResolved = (t) => t.resolved !== undefined ? t.resolved : RESOLVED.has(t.status);
    const openTickets = tickets.filter((t) => !isResolved(t));
    const inProgress = tickets.filter((t) => /progress|working/i.test(t.status || ''));
    const resolvedTickets = tickets.filter(isResolved);
    const shipped = features.filter((f) => f.status === 'Shipped');
    const openFeatures = features.filter((f) => f.status && f.status !== 'Shipped' && f.status !== 'Declined');
    const openActions = board?.openActions || 0;
    const lastCall = calls[0] || null;

    const seed = hash(account);
    const accent = ACCENTS[seed % ACCENTS.length];
    const pick = (arr, salt = 0) => arr[(seed + salt) % arr.length];

    // Derived talking points — vary with the actual situation, so never boilerplate.
    const points = [];
    if (board?.currentSignal === 'Red') points.push('Signal is RED — lead with the recovery plan and re-earn confidence.');
    else if (board?.currentSignal === 'Amber') points.push('Signal is AMBER — probe for the friction before it hardens.');
    if (openActions) points.push(`Close the loop on ${openActions} open action${openActions === 1 ? '' : 's'} agreed last time.`);
    if (openTickets.length) points.push(`Acknowledge ${openTickets.length} open ticket${openTickets.length === 1 ? '' : 's'}${openTickets.some((t) => t.breached) ? ' — some have breached SLA' : ''}.`);
    if (shipped.length) points.push(`Celebrate ${shipped.length} shipped request${shipped.length === 1 ? '' : 's'} — proof we act on their feedback.`);
    if (openFeatures.length) points.push(`Set expectations on ${openFeatures.length} request${openFeatures.length === 1 ? '' : 's'} still on the roadmap.`);
    if (board?.sentiment === 'Negative') points.push('Last sentiment was negative — open with empathy, listen first.');
    if (!points.length) points.push('Healthy account — use the time to explore expansion and advocacy.');

    return await new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 0 });
        const chunks = [];
        doc.on('data', (c) => chunks.push(c));
        doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), filename: `precall-brief-${account.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf` }));
        doc.on('error', reject);

        const W = doc.page.width; const H = doc.page.height; const M = 40; const CW = W - M * 2;

        doc.rect(0, 0, W, H).fill(BG);
        // header
        const hg = doc.linearGradient(0, 0, W, 104);
        hg.stop(0, accent).stop(1, '#0891b2');
        doc.rect(0, 0, W, 104).fill(hg);
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text('Pre-Call Brief', M, 26);
        doc.fillColor('#eef2ff').font('Helvetica').fontSize(13).text(account, M, 54);
        doc.fillColor('#dbe4ff').fontSize(9).text(
            `${board ? `${board.tier} · ${board.currentSignal}` : ''}${board?.scheduledCallDate ? `   ·   Call scheduled ${fmtDate(board.scheduledCallDate)}` : ''}`,
            M, 78
        );
        doc.fillColor('#c7d2fe').fontSize(8.5).text(`Prepared ${new Date().toISOString().slice(0, 10)}`, M, 26, { width: CW, align: 'right' });

        // intro
        let y = 122;
        doc.fillColor(TEXT).font('Helvetica-Oblique').fontSize(10.5).text(pick(INTROS)(account), M, y, { width: CW });
        y = doc.y + 14;

        // KPI tiles
        const tiles = [
            ['Previous calls', String(calls.length), `${board?.checkCount ?? calls.length} logged`],
            ['Open tickets', String(openTickets.length), `${resolvedTickets.length} resolved`],
            ['Shipped for them', String(shipped.length), `${openFeatures.length} on roadmap`],
            ['Open actions', String(openActions), 'from prior calls'],
        ];
        const gap = 12; const tileW = (CW - gap * 3) / 4; const tileH = 60;
        tiles.forEach((t, i) => {
            const x = M + i * (tileW + gap);
            doc.roundedRect(x, y, tileW, tileH, 9).fill(PANEL);
            doc.roundedRect(x, y, tileW, 3, 1.5).fill(accent);
            doc.fillColor(MUTED).font('Helvetica').fontSize(6.8).text(t[0].toUpperCase(), x + 10, y + 11, { width: tileW - 20, characterSpacing: 0.4 });
            doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(18).text(t[1], x + 10, y + 22);
            doc.fillColor(FAINT).font('Helvetica').fontSize(6.8).text(trunc(t[2], 24), x + 10, y + 46, { width: tileW - 16, lineBreak: false });
        });
        y += tileH + 20;

        // section helpers
        const sectionTitle = (label) => {
            doc.roundedRect(M, y + 1, 3, 12, 1.5).fill(CYAN);
            doc.fillColor('#aeb8d4').font('Helvetica-Bold').fontSize(9).text(label.toUpperCase(), M + 9, y, { characterSpacing: 0.6 });
            y += 20;
        };
        const line = (text, color = '#c3cbe0') => {
            doc.fillColor(color).font('Helvetica').fontSize(9.5).text(text, M + 4, y, { width: CW - 8, lineGap: 1.5 });
            y = doc.y + 5;
        };

        // History section
        const historySection = () => {
            sectionTitle(pick(HISTORY_LEAD, 1));
            if (lastCall) {
                line(`Last call ${fmtDate(lastCall.check_date)} — signal ${lastCall.signal}, sentiment ${lastCall.sentiment}.`, TEXT);
                if (lastCall.summary) line(`“${trunc(lastCall.summary, 220)}”`, MUTED);
                if (board?.trend) line(board.trend < 0 ? 'Trend is worsening vs the previous call.' : 'Trend is improving vs the previous call.', board.trend < 0 ? '#f87171' : '#34d399');
            } else {
                line('No calls logged yet — this is the first structured touch. Set the baseline.', MUTED);
            }
            y += 4;
        };
        // Support section
        const supportSection = () => {
            sectionTitle(pick(SUPPORT_LEAD, 2));
            line(`${openTickets.length} open · ${inProgress.length} in progress · ${resolvedTickets.length} resolved (of ${tickets.length} all-time).`, TEXT);
            openTickets.slice(0, 4).forEach((t) => line(`• ${t.ticket_no || '#'} ${trunc(t.subject, 60)} — ${t.priority}, ${t.status}${t.breached ? ' · SLA breached' : ''}`, t.breached ? '#f87171' : '#c3cbe0'));
            if (!tickets.length) line('No tickets on record — a clean support relationship.', MUTED);
            y += 4;
        };
        // Product section
        const productSection = () => {
            sectionTitle(pick(PRODUCT_LEAD, 3));
            if (shipped.length) shipped.slice(0, 4).forEach((f) => line(`✓ ${trunc(f.title, 64)}`, '#34d399'));
            else line('Nothing shipped from their requests yet.', MUTED);
            if (openFeatures.length) line(`${openFeatures.length} request${openFeatures.length === 1 ? '' : 's'} still open: ${trunc(openFeatures.slice(0, 3).map((f) => f.title).join(', '), 120)}.`, MUTED);
            y += 4;
        };

        historySection();
        // Rotate the order of the two middle sections so briefs don't all read the same.
        if (seed % 2 === 0) { supportSection(); productSection(); } else { productSection(); supportSection(); }

        // Talking points box
        const boxY = Math.min(y, H - 190);
        const bp = points.slice(0, 5);
        const boxH = 30 + bp.length * 16;
        doc.roundedRect(M, boxY, CW, boxH, 12).fill('#101830');
        doc.roundedRect(M, boxY, 4, boxH, 2).fill(accent);
        doc.fillColor('#e8ecf6').font('Helvetica-Bold').fontSize(9).text(pick(TALK_LEAD, 4).toUpperCase(), M + 16, boxY + 11, { characterSpacing: 0.6 });
        let ty = boxY + 28;
        bp.forEach((pt, i) => {
            doc.fillColor(CYAN).font('Helvetica-Bold').fontSize(8.5).text(`${i + 1}`, M + 16, ty, { width: 12 });
            doc.fillColor('#c3cbe0').font('Helvetica').fontSize(9).text(trunc(pt, 120), M + 30, ty, { width: CW - 46, lineBreak: false });
            ty += 16;
        });

        // footer
        doc.rect(0, H - 26, W, 26).fill('#0a0e1c');
        doc.fillColor(FAINT).font('Helvetica').fontSize(7.5).text(`Pre-call brief for ${account}  ·  Confidential  ·  Pulse`, M, H - 18, { width: CW, align: 'center' });

        doc.end();
    });
}
