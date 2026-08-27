import { getDb } from '../db.js';

export const CUSTOM_FIELD_TYPES = ['text', 'number', 'date', 'select'];

// "Deal Region" -> "deal_region"
function slugify(label) {
    return String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'field';
}

export const customFieldRepo = {
    async listDefs(module) {
        const db = await getDb();
        const rows = await db.all('SELECT * FROM custom_field_defs WHERE module = ? ORDER BY id ASC', [module]);
        return rows.map((r) => ({
            id: r.id, module: r.module, key: r.key, label: r.label, type: r.type,
            options: r.options ? JSON.parse(r.options) : []
        }));
    },

    // Create a def; if the slug already exists, return the existing one (idempotent for imports).
    async createDef(module, { label, type = 'text', options = [] }) {
        const db = await getDb();
        if (!CUSTOM_FIELD_TYPES.includes(type)) type = 'text';
        let key = slugify(label);
        const existing = await db.get('SELECT * FROM custom_field_defs WHERE module = ? AND key = ?', [module, key]);
        if (existing) {
            return { id: existing.id, module, key, label: existing.label, type: existing.type, options: existing.options ? JSON.parse(existing.options) : [] };
        }
        const r = await db.run(
            'INSERT INTO custom_field_defs (module, key, label, type, options, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [module, key, label, type, JSON.stringify(options || []), new Date().toISOString()]
        );
        return { id: r.lastID, module, key, label, type, options: options || [] };
    },

    async deleteDef(module, id) {
        const db = await getDb();
        const def = await db.get('SELECT * FROM custom_field_defs WHERE id = ? AND module = ?', [id, module]);
        if (!def) return { notFound: true };
        await db.run('DELETE FROM custom_field_defs WHERE id = ?', [id]);
        return { deleted: true };
    },

    // Coerce/validate a values object against the module's defs. Unknown keys dropped.
    coerceValues(defs, values = {}) {
        const out = {};
        for (const def of defs) {
            let v = values[def.key];
            if (v === undefined || v === null || v === '') continue;
            if (def.type === 'number') {
                const n = Number(v);
                if (!Number.isNaN(n)) out[def.key] = n;
            } else if (def.type === 'select') {
                if (def.options.includes(String(v))) out[def.key] = String(v);
            } else {
                out[def.key] = String(v).slice(0, 2000);
            }
        }
        return out;
    }
};
