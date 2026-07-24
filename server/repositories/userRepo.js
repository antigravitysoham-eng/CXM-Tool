import bcrypt from 'bcrypt';
import { getDb } from '../db.js';
import { parseModuleAccess } from '../services/policyService.js';

const PUBLIC = 'id, email, name, role, region, business_unit, team, agent_access, module_access, phone';

// Digits-only E.164 (matches how Meta delivers numbers and how we store bindings).
const normPhone = (p) => String(p || '').replace(/[^\d]/g, '') || null;
// module_access is stored as a JSON string; hand callers a parsed object.
const shape = (row) => row && ({ ...row, module_access: parseModuleAccess(row.module_access) });

export const userRepo = {
    async list() {
        const db = await getDb();
        return (await db.all(`SELECT ${PUBLIC} FROM users ORDER BY id`)).map(shape);
    },
    async get(id) {
        const db = await getDb();
        return shape(await db.get(`SELECT ${PUBLIC} FROM users WHERE id = ?`, [id]));
    },
    async create({ email, name, password, role = 'rep', region = '', business_unit = '', team = '', agent_access = 'read', phone = '' }) {
        const db = await getDb();
        const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) { const e = new Error('A user with that email already exists'); e.status = 400; throw e; }
        const hash = await bcrypt.hash(password, 10);
        const r = await db.run(
            'INSERT INTO users (email, name, password, role, region, business_unit, team, agent_access, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [email, name, hash, role, region, business_unit, team, agent_access, normPhone(phone)]
        );
        return this.get(r.lastID);
    },
    async update(id, data) {
        const db = await getDb();
        const fields = [];
        const params = [];
        for (const k of ['name', 'role', 'region', 'business_unit', 'team', 'agent_access']) {
            if (data[k] !== undefined) { fields.push(`${k} = ?`); params.push(data[k]); }
        }
        if (data.phone !== undefined) { fields.push('phone = ?'); params.push(normPhone(data.phone)); }
        // Per-user module overrides: store the map as JSON (drop empty values so a
        // fully-cleared map reads back as "no overrides").
        if (data.module_access !== undefined) {
            const clean = Object.fromEntries(
                Object.entries(data.module_access || {}).filter(([, v]) => v === 'allow' || v === 'deny')
            );
            fields.push('module_access = ?');
            params.push(Object.keys(clean).length ? JSON.stringify(clean) : null);
        }
        if (data.password) { fields.push('password = ?'); params.push(await bcrypt.hash(data.password, 10)); }
        if (!fields.length) return this.get(id);
        await db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
        return this.get(id);
    },
    async remove(id) {
        const db = await getDb();
        await db.run('DELETE FROM users WHERE id = ?', [id]);
        return { deleted: true };
    },
    async countAdmins() {
        const db = await getDb();
        const r = await db.get("SELECT COUNT(*) as c FROM users WHERE role = 'admin'");
        return r.c;
    }
};
