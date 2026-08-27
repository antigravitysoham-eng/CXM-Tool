import { describe, it, expect } from 'vitest';

const API = 'http://localhost:5099/api';
const login = async (email, password) => (await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
})).json()).token;
const call = (t, p, opts = {}) => fetch(`${API}${p}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
});

describe('training roster — trainees, trainers, enrollments', () => {
    it('all checks pass', async () => {
        const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

        const admin = await login('demo@example.com', 'password123');
        const rep = await login('priya@cashhorizon.io', 'demo1234');
        const acct = (await (await call(admin, '/accounts')).json())[0].name;
        const course = (await (await call(admin, '/training/courses?module=interno&level=Foundation')).json())[0];

        // ---- trainers roster (admin writes) ----
        const trainer = await (await call(admin, '/training/trainers', {
            method: 'POST', body: JSON.stringify({ name: 'Anita Rao', email: 'anita@zeron.example', specialties: ['interno', 'conformity'] })
        })).json();
        ok(trainer.id && trainer.specialties.includes('interno'), `admin added a trainer (${trainer.name})`);
        const repTrainer = await call(rep, '/training/trainers', { method: 'POST', body: JSON.stringify({ name: 'x' }) });
        ok(repTrainer.status === 403, `a rep cannot add a trainer (${repTrainer.status})`);

        // ---- trainees (account-scoped) ----
        const t1 = await (await call(admin, '/training/trainees', { method: 'POST', body: JSON.stringify({ account: acct, name: 'Ravi Kumar', role: 'Security Analyst' }) })).json();
        const t2 = await (await call(admin, '/training/trainees', { method: 'POST', body: JSON.stringify({ account: acct, name: 'Meera Nair', role: 'Compliance Lead' }) })).json();
        ok(t1.id && t2.id, `added 2 trainees to ${acct}`);
        const roster = await (await call(admin, `/training/trainees?account=${encodeURIComponent(acct)}`)).json();
        ok(roster.length >= 2 && roster.every((t) => t.account === acct), 'trainee roster is scoped to the account');

        // ---- enrollment: trainee → course, with an assigned trainer ----
        const enr = await (await call(admin, '/training/enrollments', {
            method: 'POST', body: JSON.stringify({ account: acct, course_key: course.course_key, trainee_id: t1.id, trainer_id: trainer.id })
        })).json();
        ok(enr.id && enr.course_title === course.title && enr.trainee_name === 'Ravi Kumar' && enr.trainer_name === 'Anita Rao',
            `enrolled ${enr.trainee_name} in "${enr.course_title}" with ${enr.trainer_name}`);
        ok(enr.seat_price === course.seat_price, 'the seat price is snapshotted from the course at enrolment');

        // duplicate enrollment is a no-op
        const dupe = await (await call(admin, '/training/enrollments', {
            method: 'POST', body: JSON.stringify({ account: acct, course_key: course.course_key, trainee_id: t1.id })
        })).json();
        ok(dupe.id === enr.id, 'enrolling the same trainee in the same course again is a no-op');

        // ---- status lifecycle stamps dates ----
        const prog = await (await call(admin, `/training/enrollments/${enr.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'In progress' }) })).json();
        ok(prog.status === 'In progress' && !!prog.started_at, 'moving to In progress stamps started_at');
        const cert = await (await call(admin, `/training/enrollments/${enr.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'Certified' }) })).json();
        ok(cert.status === 'Certified' && !!cert.completed_at && !!cert.certified_at, 'Certified stamps completed + certified');

        // ---- ABAC: rep bounded to their own accounts ----
        const repAccts = (await (await call(rep, '/accounts')).json()).map((a) => a.name);
        const repEnr = await (await call(rep, '/training/enrollments')).json();
        ok(repEnr.every((e) => repAccts.includes(e.account)), 'a rep only sees enrollments for their accounts');
        if (!repAccts.includes(acct)) {
            const forbidden = await call(rep, '/training/trainees', { method: 'POST', body: JSON.stringify({ account: acct, name: 'z' }) });
            ok(forbidden.status === 403, `a rep cannot add a trainee to an account they don't own (${forbidden.status})`);
        } else { ok(true, 'rep owns the test account — skipping cross-account check'); }

        // cleanup
        await call(admin, `/training/enrollments/${enr.id}`, { method: 'DELETE' });
        await call(admin, `/training/trainees/${t1.id}`, { method: 'DELETE' });
        await call(admin, `/training/trainees/${t2.id}`, { method: 'DELETE' });
        await call(admin, `/training/trainers/${trainer.id}`, { method: 'DELETE' });

        expect(__fail, __fail.join('\n')).toEqual([]);
    });
});
