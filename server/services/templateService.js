/**
 * Editable organisation document templates (.docx).
 *
 * These are blank boilerplate agreements/decks an org reuses — Proposal, Service
 * Agreement, Tripartite Agreement, Invoice, NDA, SOW. They carry no customer
 * data (they're the starting point a user fills in), so they're generated fresh
 * from code on each download rather than stored as binaries. Built with the
 * pure-JS `docx` library so the output opens editable in Word/Google Docs.
 */
import {
    Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
    Table, TableRow, TableCell, WidthType, BorderStyle
} from 'docx';

const BRAND = 'AGCX';
const ACCENT = '4338CA';
const MUTED = '6B7280';

// ─────────────────────────── building blocks ───────────────────────────
const brandHeader = (docType) => [
    new Paragraph({
        children: [new TextRun({ text: BRAND, bold: true, size: 30, color: ACCENT })],
    }),
    new Paragraph({
        children: [new TextRun({ text: docType.toUpperCase(), bold: true, size: 18, color: MUTED, characterSpacing: 40 })],
        spacing: { after: 240 },
    }),
];

const h = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 100 } });
const p = (text) => new Paragraph({ children: [new TextRun({ text, size: 21 })], spacing: { after: 120 } });
// A fill-in line: "Label: [placeholder]".
const field = (label, placeholder) => new Paragraph({
    children: [
        new TextRun({ text: `${label}: `, bold: true, size: 21 }),
        new TextRun({ text: `[${placeholder}]`, size: 21, color: MUTED, italics: true }),
    ],
    spacing: { after: 80 },
});
const clause = (n, title, body) => [
    new Paragraph({
        children: [new TextRun({ text: `${n}. ${title}`, bold: true, size: 22 })],
        spacing: { before: 160, after: 60 },
    }),
    new Paragraph({ children: [new TextRun({ text: body, size: 21 })], spacing: { after: 100 } }),
];
const signatureBlock = (parties) => {
    const cell = (name) => new TableCell({
        width: { size: 50, type: WidthType.PERCENTAGE },
        margins: { top: 120, bottom: 120, left: 120, right: 120 },
        children: [
            new Paragraph({ children: [new TextRun({ text: name, bold: true, size: 21 })], spacing: { after: 260 } }),
            new Paragraph({ children: [new TextRun({ text: 'Signature: ____________________', size: 21 })], spacing: { after: 80 } }),
            new Paragraph({ children: [new TextRun({ text: 'Name: ____________________', size: 21 })], spacing: { after: 80 } }),
            new Paragraph({ children: [new TextRun({ text: 'Title: ____________________', size: 21 })], spacing: { after: 80 } }),
            new Paragraph({ children: [new TextRun({ text: 'Date: ____________________', size: 21 })] }),
        ],
    });
    const rows = [];
    for (let i = 0; i < parties.length; i += 2) {
        rows.push(new TableRow({ children: [cell(parties[i]), cell(parties[i + 1] || '')] }));
    }
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
        },
        rows,
    });
};
const doc = (children) => new Document({
    creator: BRAND,
    styles: { default: { document: { run: { font: 'Calibri' } } } },
    sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } }, children }],
});

// ─────────────────────────── templates ───────────────────────────
const TEMPLATES = [
    {
        key: 'proposal', title: 'Proposal', category: 'Commercial', filename: 'proposal-template.docx',
        description: 'Solution proposal with scope, commercials and next steps.',
        build: () => doc([
            ...brandHeader('Proposal'),
            new Paragraph({ children: [new TextRun({ text: 'Business Proposal', bold: true, size: 40 })], spacing: { after: 160 } }),
            field('Prepared for', 'Customer Name'), field('Prepared by', 'Account Executive'),
            field('Date', 'DD Mon YYYY'), field('Valid until', 'DD Mon YYYY'),
            h('1. Executive summary'),
            p('Summarise the customer’s objective and how the proposed solution meets it in two or three sentences.'),
            h('2. Understanding of requirements'),
            p('Restate the customer’s goals, pains and success criteria as we understand them.'),
            h('3. Proposed solution & scope'),
            p('Describe the modules, services and deliverables included. List explicit inclusions and exclusions.'),
            h('4. Commercials'),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({ children: ['Item', 'Qty', 'Unit price', 'Total'].map((t) => new TableCell({ shading: { fill: 'EEF2FF' }, children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 20 })] })] })) }),
                    ...[1, 2, 3].map(() => new TableRow({ children: ['[Line item]', '[Qty]', '[₹]', '[₹]'].map((t) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, size: 20, color: MUTED })] })] })) })),
                ],
            }),
            h('5. Assumptions & next steps'),
            p('State key assumptions, the proposed timeline, and the actions required to proceed.'),
        ]),
    },
    {
        key: 'service-agreement', title: 'Service Agreement', category: 'Contractual', filename: 'service-agreement-template.docx',
        description: 'Master services agreement between provider and customer.',
        build: () => doc([
            ...brandHeader('Service Agreement'),
            new Paragraph({ children: [new TextRun({ text: 'Service Agreement', bold: true, size: 40 })], spacing: { after: 160 } }),
            p('This Service Agreement (the “Agreement”) is entered into on [Effective Date] by and between:'),
            field('Provider', 'Provider legal entity, address'),
            field('Customer', 'Customer legal entity, address'),
            ...clause(1, 'Scope of services', 'The Provider shall deliver the services described in the applicable Statement of Work / Order Form, incorporated by reference.'),
            ...clause(2, 'Term', 'This Agreement commences on the Effective Date and continues for [term], renewing per Clause 8 unless terminated earlier.'),
            ...clause(3, 'Fees & payment', 'Customer shall pay the fees set out in the Order Form within [30] days of a valid invoice. Late amounts may accrue interest at [rate].'),
            ...clause(4, 'Service levels', 'The Provider shall meet the service levels in Schedule A. Remedies for missed SLAs are as set out therein.'),
            ...clause(5, 'Confidentiality', 'Each party shall protect the other’s Confidential Information and use it solely to perform this Agreement.'),
            ...clause(6, 'Data protection', 'The parties shall comply with applicable data-protection law; processing terms are set out in the Data Processing Addendum.'),
            ...clause(7, 'Liability', 'Except for [carve-outs], each party’s aggregate liability is capped at the fees paid in the preceding [12] months.'),
            ...clause(8, 'Renewal & termination', 'Either party may terminate for material breach uncured within [30] days, or on [notice] before a renewal term.'),
            h('Signatures'),
            signatureBlock(['For the Provider', 'For the Customer']),
        ]),
    },
    {
        key: 'tripartite-agreement', title: 'Tripartite Agreement', category: 'Contractual', filename: 'tripartite-agreement-template.docx',
        description: 'Three-party agreement (provider, customer, partner/integrator).',
        build: () => doc([
            ...brandHeader('Tripartite Agreement'),
            new Paragraph({ children: [new TextRun({ text: 'Tripartite Agreement', bold: true, size: 40 })], spacing: { after: 160 } }),
            p('This Tripartite Agreement is made on [Effective Date] between the following three parties:'),
            field('Party A — Provider', 'Provider legal entity'),
            field('Party B — Customer', 'Customer legal entity'),
            field('Party C — Partner / Implementation Partner', 'Partner legal entity'),
            ...clause(1, 'Purpose', 'This Agreement governs the combined engagement in which the Provider licenses the platform, the Partner implements it, and the Customer receives the service.'),
            ...clause(2, 'Roles & responsibilities', 'Party A: platform, licensing and support. Party B: access, data and payment. Party C: implementation, integration and enablement per the SOW.'),
            ...clause(3, 'Commercials & flow of funds', 'Set out who invoices whom, amounts, and payment terms between the three parties.'),
            ...clause(4, 'Confidentiality & data', 'All parties shall protect Confidential Information and comply with the data-protection terms in Schedule B.'),
            ...clause(5, 'Term & termination', 'Term, renewal and exit obligations, including transition assistance on termination.'),
            h('Signatures'),
            signatureBlock(['For Party A (Provider)', 'For Party B (Customer)', 'For Party C (Partner)', '']),
        ]),
    },
    {
        key: 'invoice', title: 'Invoice', category: 'Commercial', filename: 'invoice-template.docx',
        description: 'Tax invoice with line items and totals.',
        build: () => doc([
            ...brandHeader('Tax Invoice'),
            new Paragraph({ children: [new TextRun({ text: 'Tax Invoice', bold: true, size: 40 })], spacing: { after: 160 } }),
            field('Invoice no.', 'INV-XXXX'), field('Invoice date', 'DD Mon YYYY'), field('Due date', 'DD Mon YYYY'),
            field('Bill to', 'Customer name & address'), field('GSTIN / Tax ID', 'XXXXXXXXXXXX'),
            h('Line items'),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({ children: ['Description', 'HSN/SAC', 'Qty', 'Rate', 'Amount'].map((t) => new TableCell({ shading: { fill: 'EEF2FF' }, children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 20 })] })] })) }),
                    ...[1, 2, 3, 4].map(() => new TableRow({ children: ['[Item]', '[Code]', '[Qty]', '[₹]', '[₹]'].map((t) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, size: 20, color: MUTED })] })] })) })),
                ],
            }),
            new Paragraph({ children: [new TextRun({ text: 'Subtotal: [₹]    Tax (GST): [₹]    Total due: [₹]', bold: true, size: 22 })], alignment: AlignmentType.RIGHT, spacing: { before: 160 } }),
            h('Payment details'),
            p('Bank: [Bank name] · A/C: [Account no.] · IFSC: [IFSC] · Terms: [Net 30]'),
        ]),
    },
    {
        key: 'nda', title: 'Non-Disclosure Agreement', category: 'Compliance', filename: 'nda-template.docx',
        description: 'Mutual NDA for pre-contract discussions.',
        build: () => doc([
            ...brandHeader('Non-Disclosure Agreement'),
            new Paragraph({ children: [new TextRun({ text: 'Mutual Non-Disclosure Agreement', bold: true, size: 36 })], spacing: { after: 160 } }),
            p('This NDA is entered into on [Effective Date] between [Disclosing Party] and [Receiving Party] (each a “Party”).'),
            ...clause(1, 'Confidential Information', 'Non-public information disclosed by a Party, whether marked confidential or reasonably understood to be so.'),
            ...clause(2, 'Obligations', 'The Receiving Party shall use Confidential Information solely to evaluate the potential relationship and protect it with reasonable care.'),
            ...clause(3, 'Exclusions', 'Information that is public, independently developed, or rightfully received from a third party is not Confidential Information.'),
            ...clause(4, 'Term', 'Confidentiality obligations survive for [2] years from disclosure.'),
            h('Signatures'),
            signatureBlock(['Disclosing Party', 'Receiving Party']),
        ]),
    },
    {
        key: 'sow', title: 'Statement of Work', category: 'Delivery', filename: 'sow-template.docx',
        description: 'Scope, deliverables, milestones and acceptance.',
        build: () => doc([
            ...brandHeader('Statement of Work'),
            new Paragraph({ children: [new TextRun({ text: 'Statement of Work', bold: true, size: 40 })], spacing: { after: 160 } }),
            field('Customer', 'Customer name'), field('SOW no.', 'SOW-XXXX'), field('Effective date', 'DD Mon YYYY'),
            h('1. Objectives'), p('State the business outcome this engagement delivers.'),
            h('2. Scope of deliverables'), p('List each deliverable with a clear definition of done. Note explicit out-of-scope items.'),
            h('3. Milestones & timeline'),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({ children: ['Milestone', 'Owner', 'Target date', 'Acceptance'].map((t) => new TableCell({ shading: { fill: 'EEF2FF' }, children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 20 })] })] })) }),
                    ...[1, 2, 3].map(() => new TableRow({ children: ['[Milestone]', '[Owner]', '[Date]', '[Criteria]'].map((t) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, size: 20, color: MUTED })] })] })) })),
                ],
            }),
            h('4. Assumptions & responsibilities'), p('Customer and provider responsibilities, dependencies and assumptions.'),
            h('5. Acceptance'), p('Describe how deliverables are reviewed and accepted, and the response window.'),
        ]),
    },
];

export function listTemplates() {
    return TEMPLATES.map(({ key, title, description, category, filename }) => ({ key, title, description, category, filename, format: 'docx' }));
}

export async function buildTemplate(key) {
    const t = TEMPLATES.find((x) => x.key === key);
    if (!t) return null;
    const buffer = await Packer.toBuffer(t.build());
    return { buffer, filename: t.filename, title: t.title };
}
