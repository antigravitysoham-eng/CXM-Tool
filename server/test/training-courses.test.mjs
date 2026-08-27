import { describe, it, expect } from 'vitest';

const API = 'http://localhost:5099/api';
const login = async (email, password) => (await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
})).json()).token;
const call = (t, p, opts = {}) => fetch(`${API}${p}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
});

describe('training course catalogue', () => {
    it('all checks pass', async () => {
        const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

        const admin = await login('demo@example.com', 'password123');
        const rep = await login('priya@cashhorizon.io', 'demo1234');

        // ---- catalogue seeded, module-wise + level ladder ----
        const courses = await (await call(admin, '/training/courses')).json();
        ok(courses.length >= 15, `catalogue is seeded (${courses.length} courses)`);
        const interno = courses.filter((c) => c.module === 'interno');
        ok(interno.some((c) => c.level === 'Foundation') && interno.some((c) => c.level === 'Advanced'),
            `Interno has a Foundation→Advanced ladder (${interno.map((c) => c.level).join('/')})`);
        ok(courses.every((c) => c.seat_price >= 0 && c.currency && c.module), 'every course has a module, price and currency');
        const modules = [...new Set(courses.map((c) => c.module))];
        ok(modules.includes('platform') && modules.includes('conformity'), `courses span multiple modules (${modules.length})`);

        // ---- meta carries levels ----
        const meta = await (await call(admin, '/training/meta')).json();
        ok(Array.isArray(meta.levels) && meta.levels.includes('Advanced'), 'meta exposes course levels');

        // ---- everyone reads; only admin writes ----
        const repRead = await call(rep, '/training/courses');
        ok(repRead.status === 200, `a rep can read the catalogue (${repRead.status})`);
        const repWrite = await call(rep, '/training/courses', { method: 'POST', body: JSON.stringify({ module: 'platform', title: 'x', level: 'Foundation' }) });
        ok(repWrite.status === 403, `a rep cannot add a course (${repWrite.status})`);

        // ---- admin CRUD ----
        const created = await (await call(admin, '/training/courses', {
            method: 'POST', body: JSON.stringify({ module: 'interno', title: 'Interno Threat Hunting', level: 'Advanced', duration_hours: 20, seat_price: 55000 })
        })).json();
        ok(created.id && created.course_key && created.seat_price === 55000, `admin created a course (${created.title})`);
        const updated = await (await call(admin, `/training/courses/${created.id}`, { method: 'PATCH', body: JSON.stringify({ seat_price: 60000, active: false }) })).json();
        ok(updated.seat_price === 60000 && updated.active === false, 'admin edited price + active flag');
        const filtered = await (await call(admin, '/training/courses?module=interno&level=Advanced')).json();
        ok(filtered.every((c) => c.module === 'interno' && c.level === 'Advanced'), 'catalogue filters by module + level');
        const del = await call(admin, `/training/courses/${created.id}`, { method: 'DELETE' });
        ok(del.status === 200, `admin deleted the course (${del.status})`);

        expect(__fail, __fail.join('\n')).toEqual([]);
    });
});
