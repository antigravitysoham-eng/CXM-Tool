import bcrypt from 'bcrypt';
import { getDb } from '../db.js';

const PUBLIC = 'id, email, name, role, region, business_unit, team, agent_access';

export const userRepo = {
    async list() {
        const db = await getDb();
        return db.all(`SELECT ${PUBLIC} FROM users ORDER BY id`);
    },
    async get(id) {
        const db = await getDb();
        return db.get(`SELECT ${PUBLIC} FROM users WHERE id = ?`, [id]);
    },
    async create({ email, name, password, role = 'rep', region = '', business_unit = '', team = '', agent_access = 'read' }) {
        const db = await getDb();
        const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) { const e = new Error('A user with that email already exists'); e.status = 400; throw e; }
        const hash = await bcrypt.hash(password, 10);
        const r = await db.run(
            'INSERT INTO users (email, name, password, role, region, business_unit, team, agent_access) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [email, name, hash, role, region, business_unit, team, agent_access]
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
