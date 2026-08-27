import ExcelJS from 'exceljs';

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
const TEMPLATE_ROWS = 200; // rows pre-armed with data validation

function styleHeader(row) {
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = HEADER_FILL;
    row.alignment = { vertical: 'middle' };
    row.height = 20;
}

function colHeader(c) {
    return c.required ? `${c.header} *` : c.header;
}

// A plain data export: one header row + one row per record.
export async function buildExport(columns, rows, sheetName = 'Data') {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Cash Horizon';
    const ws = wb.addWorksheet(sheetName);
    ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: Math.max(14, c.header.length + 2) }));
    styleHeader(ws.getRow(1));
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    rows.forEach((r) => ws.addRow(r));
    return Buffer.from(await wb.xlsx.writeBuffer());
}

// A guided import template: Instructions + Data (with validation) + Reference sheets.
export async function buildTemplate(columns, { title, example, moduleTitle }) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Cash Horizon';

    // ---- Instructions ----
    const ins = wb.addWorksheet('Instructions');
    ins.getColumn(1).width = 110;
    const lines = [
        [`${moduleTitle || title} — Import Template`, { bold: true, size: 16 }],
        ['', {}],
        ['How to use this file', { bold: true, size: 12 }],
        ['1. Go to the "Data" sheet and enter ONE record per row, starting at row 2.', {}],
        ['2. Do not rename, reorder, or delete the header row (row 1).', {}],
        ['3. Columns marked with * are required.', {}],
        ['4. Cells with a red corner have a note — hover to see what to enter.', {}],
        ['5. Drop-down and number cells are validated: invalid values are rejected as you type.', {}],
        ['6. Money columns take a WHOLE NUMBER only — no symbols, no commas (e.g. 12000000, not ₹1.2Cr).', {}],
        ['7. Dates use the format YYYY-MM-DD (e.g. 2026-12-15).', {}],
        ['', {}],
        ['Adding your own column', { bold: true, size: 12 }],
        ['• Add a new column to the RIGHT of the last column on the Data sheet with your own header.', {}],
        ['• On import it becomes a custom field automatically and is kept for every record.', {}],
        ['', {}],
        ['On import', { bold: true, size: 12 }],
        ['• Every row is re-checked on the server. Valid rows are imported; invalid rows are reported with the reason.', {}],
        ['• Row 2 below is a filled-in EXAMPLE — delete it (or overwrite it) before importing.', {}],
        ['', {}],
        ['Allowed values for drop-down columns are listed on the "Reference" sheet.', { italic: true }]
    ];
    lines.forEach(([text, style], i) => {
        const cell = ins.getCell(i + 1, 1);
        cell.value = text;
        cell.font = { bold: !!style.bold, italic: !!style.italic, size: style.size || 11 };
    });

    // ---- Data ----
    const ws = wb.addWorksheet('Data');
    ws.columns = columns.map((c) => ({ header: colHeader(c), key: c.key, width: Math.max(16, colHeader(c).length + 2) }));
    styleHeader(ws.getRow(1));
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    columns.forEach((c, i) => {
        const cell = ws.getRow(1).getCell(i + 1);
        if (c.help) cell.note = c.help;
    });
    if (example) ws.addRow(example);

    // Per-cell validation for the editable range.
    for (let i = 0; i < columns.length; i++) {
        const c = columns[i];
        for (let r = 2; r <= TEMPLATE_ROWS; r++) {
            const cell = ws.getRow(r).getCell(i + 1);
            if (c.type === 'select' && c.options && c.options.length) {
                cell.dataValidation = {
                    type: 'list', allowBlank: true,
                    formulae: [`"${c.options.join(',')}"`],
                    showErrorMessage: true, errorTitle: 'Invalid value',
                    error: `Choose one of: ${c.options.join(', ')}`
                };
            } else if (c.type === 'number') {
                const min = c.min ?? 0;
                const max = c.max;
                cell.dataValidation = max !== undefined
                    ? { type: 'whole', operator: 'between', formulae: [min, max], allowBlank: true, showErrorMessage: true, errorTitle: 'Invalid number', error: `Enter a whole number between ${min} and ${max}` }
                    : { type: 'whole', operator: 'greaterThanOrEqual', formulae: [min], allowBlank: true, showErrorMessage: true, errorTitle: 'Invalid number', error: 'Enter a whole number (no symbols or commas)' };
            } else if (c.type === 'date') {
                cell.dataValidation = {
                    type: 'date', operator: 'greaterThan', formulae: [new Date(2000, 0, 1)],
                    allowBlank: true, showErrorMessage: true, errorTitle: 'Invalid date', error: 'Use a date like 2026-12-15'
                };
            }
        }
    }

    // ---- Reference ----
    const ref = wb.addWorksheet('Reference');
    ref.getColumn(1).width = 24;
    ref.getColumn(2).width = 80;
    ref.addRow(['Column', 'Allowed values']).font = { bold: true };
    styleHeader(ref.getRow(1));
    columns.filter((c) => c.type === 'select' && c.options?.length).forEach((c) => {
        ref.addRow([c.header, c.options.join(', ')]);
    });

    return Buffer.from(await wb.xlsx.writeBuffer());
}

// Read a filled workbook -> { headers, rows }. Header '*' markers and rich cells are normalised.
export async function parseWorkbook(buffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.getWorksheet('Data') || wb.worksheets[0];
    if (!ws) return { headers: [], rows: [] };

    const headers = [];
    ws.getRow(1).eachCell((cell, col) => {
        headers[col] = String(cell.value ?? '').replace(/\s*\*\s*$/, '').trim();
    });

    const cellValue = (v) => {
        if (v === null || v === undefined) return '';
        if (v instanceof Date) return v.toISOString().slice(0, 10);
        if (typeof v === 'object') {
            if (v.text !== undefined) return v.text;
            if (v.result !== undefined) return v.result;
            if (v.richText) return v.richText.map((t) => t.text).join('');
            return '';
        }
        return v;
    };

    const rows = [];
    ws.eachRow((row, rn) => {
        if (rn === 1) return;
        const obj = { __row: rn };
        let hasData = false;
        row.eachCell((cell, col) => {
            const h = headers[col];
            if (!h) return;
            const v = cellValue(cell.value);
            obj[h] = v;
            if (v !== '' && v !== null && v !== undefined) hasData = true;
        });
        if (hasData) rows.push(obj);
    });

    return { headers: headers.filter(Boolean), rows };
}
