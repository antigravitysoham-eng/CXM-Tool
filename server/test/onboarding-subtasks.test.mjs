import { describe, it, expect } from 'vitest';

const API = 'http://localhost:5099/api';
const login = async (email, password) => (await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
})).json()).token;
const call = (t, p, opts = {}) => fetch(`${API}${p}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
});
const stage = (o, n) => o.stages.find((s) => s.stage_no === n);

describe('onboarding — subtasks + task comment trail', () => {
    it('all checks pass', async () => {
        const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

        const admin = await login('demo@example.com', 'password123');
        const contracts = await (await call(admin, '/contracts')).json();
        const c = contracts[1] || contracts[0];

        // Scope Interno with two integrations, then onboard — stage 3 should build
        // an integration list, each with the Interno lifecycle as subtasks.
        await call(admin, `/contracts/${c.id}/scope`, {
            method: 'PUT', body: JSON.stringify({ products: [{ product_key: 'interno', items: ['CrowdStrike', 'Okta'], unit_count: 0, info: '' }] })
        });
        const prior = await call(admin, `/onboarding/by-account/${encodeURIComponent(c.account)}`);
        if (prior.ok) await call(admin, `/onboarding/${(await prior.json()).id}`, { method: 'DELETE' });
        const o = await (await call(admin, '/onboarding', {
            method: 'POST', body: JSON.stringify({ account: c.account, contract_id: c.id, csm_name: 'Subtask Tester' })
        })).json();

        const s3 = stage(o, 3);
        const integ = s3.tasks.find((t) => t.label === 'Interno: CrowdStrike');
        ok(!!integ && integ.subtasks.length === 6, `an integration task carries its lifecycle subtasks (${integ?.subtasks?.length})`);
        ok(integ.done === false && integ.subCount === 6 && integ.subDone === 0, 'the parent starts not-done with 0/6 subtasks complete');
        ok(integ.subtasks.some((s) => s.parent_task_id === integ.id), 'subtasks reference their parent');

        // ---- completing all subtasks completes the parent ----
        let state = o;
        for (const st of integ.subtasks) {
            state = await (await call(admin, `/onboarding/tasks/${st.id}`, { method: 'PATCH', body: JSON.stringify({ done: true }) })).json();
        }
        let parent = stage(state, 3).tasks.find((t) => t.id === integ.id);
        ok(parent.done === true && parent.subDone === 6, 'ticking every subtask auto-completes the parent (6/6)');

        // ---- unticking one subtask reopens the parent ----
        state = await (await call(admin, `/onboarding/tasks/${integ.subtasks[0].id}`, { method: 'PATCH', body: JSON.stringify({ done: false }) })).json();
        parent = stage(state, 3).tasks.find((t) => t.id === integ.id);
        ok(parent.done === false && parent.subDone === 5, 'unticking a subtask reopens the parent (5/6)');

        // ---- toggling the parent cascades to all subtasks ----
        state = await (await call(admin, `/onboarding/tasks/${integ.id}`, { method: 'PATCH', body: JSON.stringify({ done: true }) })).json();
        parent = stage(state, 3).tasks.find((t) => t.id === integ.id);
        ok(parent.done === true && parent.subtasks.every((s) => s.done), 'ticking the parent checks the whole subtask list');

        // ---- adding a subtask reopens a completed parent ----
        state = await (await call(admin, `/onboarding/${o.id}/tasks`, {
            method: 'POST', body: JSON.stringify({ parent_task_id: integ.id, label: 'Extra verification step', party: 'Zeron' })
        })).json();
        parent = stage(state, 3).tasks.find((t) => t.id === integ.id);
        ok(parent.subCount === 7 && parent.done === false, 'adding a subtask grows the list and reopens the parent (now 7)');

        // ---- time-bound comment trail on a task ----
        const someTask = stage(state, 1).tasks[0];
        state = await (await call(admin, `/onboarding/tasks/${someTask.id}/comments`, {
            method: 'POST', body: JSON.stringify({ text: 'Kicked off with the customer; awaiting SPOC list.' })
        })).json();
        const commented = stage(state, 1).tasks.find((t) => t.id === someTask.id);
        ok(commented.comments?.length === 1 && commented.comments[0].author && commented.comments[0].at && /awaiting SPOC/.test(commented.comments[0].text),
            'a task carries a time-bound remark with author + timestamp');

        // ---- stages expose the four dates ----
        const st1 = stage(state, 1);
        ok('tentative_start_date' in st1 && 'due_date' in st1 && 'start_date' in st1 && 'end_date' in st1,
            'a stage exposes tentative start, target end (due), actual start and actual end');
        ok(!!st1.tentative_start_date && !!st1.due_date, `stage 1 has a tentative start (${st1.tentative_start_date}) and target end (${st1.due_date})`);

        // cleanup
        await call(admin, `/onboarding/${o.id}`, { method: 'DELETE' });

        expect(__fail, __fail.join('\n')).toEqual([]);
    });
});
