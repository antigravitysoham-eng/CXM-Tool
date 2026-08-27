/**
 * Classify a document by its mime type and/or file name so the UI can show the
 * right icon, a human label, and decide whether it can be previewed inline.
 *
 * kind is the coarse family used for rendering: 'pdf' | 'image' | 'excel' |
 * 'word' | 'ppt' | 'text' | 'archive' | 'other'. `inline` is true when a browser
 * can render it directly (PDF + images); everything else offers a download.
 */

const EXT_KIND = {
    pdf: 'pdf',
    png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', bmp: 'image', svg: 'image', avif: 'image',
    xls: 'excel', xlsx: 'excel', xlsm: 'excel', csv: 'excel', tsv: 'excel',
    doc: 'word', docx: 'word', rtf: 'word', odt: 'word',
    ppt: 'ppt', pptx: 'ppt', odp: 'ppt',
    txt: 'text', md: 'text', json: 'text', xml: 'text', log: 'text',
    zip: 'archive', rar: 'archive', '7z': 'archive', gz: 'archive', tar: 'archive'
};

const MIME_KIND = [
    [/pdf/, 'pdf'],
    [/^image\//, 'image'],
    [/(spreadsheet|excel|csv|ms-excel)/, 'excel'],
    [/(wordprocessing|msword|rtf)/, 'word'],
    [/(presentation|powerpoint)/, 'ppt'],
    [/(^text\/|json|xml)/, 'text'],
    [/(zip|compressed|x-tar|gzip)/, 'archive']
];

const META = {
    pdf: { label: 'PDF', icon: '📕', color: '#ef4444', inline: true },
    image: { label: 'Image', icon: '🖼️', color: '#8b5cf6', inline: true },
    excel: { label: 'Spreadsheet', icon: '📊', color: '#22c55e', inline: false },
    word: { label: 'Document', icon: '📘', color: '#3b82f6', inline: false },
    ppt: { label: 'Slides', icon: '📙', color: '#f59e0b', inline: false },
    text: { label: 'Text', icon: '📄', color: '#64748b', inline: true },
    archive: { label: 'Archive', icon: '🗜️', color: '#a16207', inline: false },
    other: { label: 'File', icon: '📎', color: '#94a3b8', inline: false }
};

const extOf = (name) => {
    const m = /\.([a-z0-9]+)$/i.exec(String(name || '').trim());
    return m ? m[1].toLowerCase() : '';
};

/** Returns { kind, label, icon, color, inline, ext } for a document row. */
export function fileType(doc = {}) {
    const ext = extOf(doc.file_name || doc.name);
    let kind = EXT_KIND[ext];
    if (!kind && doc.mime) {
        const hit = MIME_KIND.find(([re]) => re.test(doc.mime));
        if (hit) kind = hit[1];
    }
    kind = kind || 'other';
    return { kind, ext, ...META[kind] };
}

/** Can this document be shown in an inline viewer (vs download only)? */
export const canPreview = (doc) => fileType(doc).inline && (doc.has_file || doc.file_key);
