import { describe, it, expect } from 'vitest';

const API = 'http://localhost:5099/api';

const login = async (email, password) => (await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
})).json()).token;
const call = (t, p, opts = {}) => fetch(`${API}${p}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
});

const stageByNo = (o, n) => o.stages.find((s) => s.stage_no === n);

describe('onboarding board — stage moves + activity log', () => {
    it('all checks pass', async () => {
        const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

        const admin = await login('demo@example.com', 'password123');
        const rep = await login('priya@cashhorizon.io', 'demo1234');

        // Use a contract account distinct from the main onboarding test's (last one).
        const contracts = await (await call(admin, '/contracts')).json();
        const c = contracts[contracts.length - 1];

        // Fresh onboarding for this account.
        const prior = await call(admin, `/onboarding/by-account/${encodeURIComponent(c.account)}`);
        if (prior.ok) await call(admin, `/onboarding/${(await prior.json()).id}`, { method: 'DELETE' });
        const o = await (await call(admin, '/onboarding', {
            method: 'POST', body: JSON.stringify({ account: c.account, contract_id: c.id, csm_name: 'Board Tester', kickoff_date: '2026-06-01' })
        })).json();
        ok(o.id && o.stages.length === 6, `started onboarding for ${o.account}`);
        ok(stageByNo(o, 1).status === 'In progress', 'fresh board sits at stage 1');

        // ---- move forward to stage 3 ----
        const moved = await (await call(admin, `/onboarding/${o.id}/move`, { method: 'PATCH', body: JSON.stringify({ stage: 3 }) })).json();
        ok(stageByNo(moved, 1).status === 'Done' && stageByNo(moved, 2).status === 'Done', 'moving to stage 3 marks stages 1–2 Done');
        ok(stageByNo(moved, 3).status === 'In progress', 'the target stage becomes In progress');
        ok(stageByNo(moved, 4).status === 'Pending' && stageByNo(moved, 5).status === 'Pending', 'later delivery stages stay Pending');
        ok(stageByNo(moved, 1).tasks.every((t) => t.done) && stageByNo(moved, 2).tasks.every((t) => t.done),
            'tasks of the passed stages are ticked so stage + checklist agree');
        ok(stageByNo(moved, VALUE_STAGE_NO(moved)).status !== 'Done', 'the value stage is not touched by a delivery move');

        // ---- per-stage working dates + days-in-stage ----
        ok(stageByNo(moved, 1).start_date && stageByNo(moved, 1).end_date,
            'a passed stage gets both a start and end date');
        ok(stageByNo(moved, 1).days_in_stage != null, `days-in-stage is derived (${stageByNo(moved, 1).days_in_stage}d)`);
        ok(stageByNo(moved, 3).start_date && !stageByNo(moved, 3).end_date,
            'the in-progress stage has a start date but no end date');
        // editing the dates directly changes the tracked duration
        const s3 = stageByNo(moved, 3);
        const edited = await (await call(admin, `/onboarding/stages/${s3.id}`, {
            method: 'PATCH', body: JSON.stringify({ start_date: '2026-06-01', end_date: '2026-06-11' })
        })).json();
        ok(stageByNo(edited, 3).days_in_stage === 10, `editing start/end dates sets days-in-stage (got ${stageByNo(edited, 3).days_in_stage}, expected 10)`);

        // ---- tasks are clocked too ----
        // A passed stage's tasks were auto-completed with working dates.
        ok(stageByNo(moved, 1).tasks.every((t) => t.start_date && t.end_date && t.days_on_task != null),
            'tasks in a completed stage carry start/end dates + days_on_task');
        // Ticking an individual task clocks it; editing its dates sets the duration.
        const openTask = stageByNo(moved, 3).tasks[0];
        const afterTick = await (await call(admin, `/onboarding/tasks/${openTask.id}`, { method: 'PATCH', body: JSON.stringify({ done: true }) })).json();
        const tickedTask = afterTick.stages.find((s) => s.stage_no === 3).tasks.find((t) => t.id === openTask.id);
        ok(tickedTask.done && tickedTask.start_date && tickedTask.end_date, 'ticking a task stamps its start + end date');
        const afterEdit = await (await call(admin, `/onboarding/tasks/${openTask.id}`, { method: 'PATCH', body: JSON.stringify({ start_date: '2026-06-01', end_date: '2026-06-04' }) })).json();
        const editedTask = afterEdit.stages.find((s) => s.stage_no === 3).tasks.find((t) => t.id === openTask.id);
        ok(editedTask.days_on_task === 3, `editing task dates sets days_on_task (got ${editedTask.days_on_task}, expected 3)`);

        // ---- stage efficiency in stats ----
        const eff = await (await call(admin, '/onboarding/stats')).json();
        ok(Array.isArray(eff.stageDurations) && 'avgStageDays' in eff && 'runningLong' in eff,
            `stats expose stage efficiency (avg ${eff.avgStageDays}d/stage, ${eff.stageDurations.length} stages measured, ${eff.runningLong} running long)`);

        // ---- activity logged the move ----
        const act1 = await (await call(admin, `/onboarding/${o.id}/activity`)).json();
        ok(act1.some((a) => a.action === 'started'), 'the start was logged');
        const mv = act1.find((a) => a.action === 'stage_moved');
        ok(mv && mv.to_stage === 3 && /→/.test(mv.detail) && mv.actor, `the move was logged with from→to + actor (${mv?.detail} by ${mv?.actor})`);

        // ---- move to Live (stage 6 = the terminal column) ----
        const live = await (await call(admin, `/onboarding/${o.id}/move`, { method: 'PATCH', body: JSON.stringify({ stage: 6 }) })).json();
        ok(live.status === 'Live', `moving to the Live column marks every delivery stage done → Live (${live.status})`);
        const act2 = await (await call(admin, `/onboarding/${o.id}/activity`)).json();
        ok(act2.some((a) => a.action === 'went_live'), 'going Live was logged');

        // ---- move back to stage 2 (a correction) ----
        const back = await (await call(admin, `/onboarding/${o.id}/move`, { method: 'PATCH', body: JSON.stringify({ stage: 2 }) })).json();
        ok(stageByNo(back, 2).status === 'In progress' && stageByNo(back, 3).status === 'Pending' && back.status === 'In progress',
            'moving back re-opens the later stages and drops it out of Live');
        ok(stageByNo(back, 3).tasks.every((t) => !t.done), 're-opened stage has its tasks cleared');

        // ---- recent activity feed ----
        const recent = await (await call(admin, '/onboarding/activity?limit=50')).json();
        ok(Array.isArray(recent) && recent.some((a) => a.account === o.account), 'recent-activity feed returns the moves');

        // ---- ABAC: a rep who doesn't own this account can't move or read its log ----
        const repAccts = (await (await call(rep, '/accounts')).json()).map((a) => a.name);
        if (!repAccts.includes(o.account)) {
            const repMove = await call(rep, `/onboarding/${o.id}/move`, { method: 'PATCH', body: JSON.stringify({ stage: 4 }) });
            ok(repMove.status === 404, `a rep cannot move an onboarding outside their access (${repMove.status})`);
            const repLog = await call(rep, `/onboarding/${o.id}/activity`);
            ok(repLog.status === 404, `a rep cannot read the activity log of an onboarding outside their access (${repLog.status})`);
        } else {
            ok(true, 'rep owns this account — skipping cross-account ABAC check');
        }

        // ---- by-account is scoped to the account (regression: list ignored the filter) ----
        // Stand up a second onboarding on a different account, then confirm each
        // account resolves to its OWN onboarding, not just the newest one.
        const accounts = (await (await call(admin, '/accounts')).json()).map((a) => a.name);
        const other = accounts.find((n) => n !== o.account);
        if (other) {
            const priorOther = await call(admin, `/onboarding/by-account/${encodeURIComponent(other)}`);
            if (priorOther.ok) await call(admin, `/onboarding/${(await priorOther.json()).id}`, { method: 'DELETE' });
            const o2 = await (await call(admin, '/onboarding', { method: 'POST', body: JSON.stringify({ account: other, csm_name: 'Second CSM' }) })).json();
            const back1 = await (await call(admin, `/onboarding/by-account/${encodeURIComponent(o.account)}`)).json();
            const back2 = await (await call(admin, `/onboarding/by-account/${encodeURIComponent(other)}`)).json();
            ok(back1.account === o.account && back2.account === other && back1.id !== back2.id,
                'by-account resolves each account to its own onboarding, not the newest');
            await call(admin, `/onboarding/${o2.id}`, { method: 'DELETE' });
        }

        // cleanup
        await call(admin, `/onboarding/${o.id}`, { method: 'DELETE' });

        expect(__fail, __fail.join('\n')).toEqual([]);
    });
});

function VALUE_STAGE_NO(o) {
    // The value stage is the one flagged in meta; here it's stage 6 by construction.
    return 6;
}
