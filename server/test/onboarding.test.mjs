
import { describe, it, expect } from 'vitest';

describe('onboarding', () => {
  it('all checks pass', async () => {
    const API = 'http://localhost:5099/api';
    const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };
    const login = async (e, p) => (await (await fetch(`${API}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e, password: p })
    })).json()).token;
    const call = (t, path, opts = {}) => fetch(`${API}${path}`, {
        ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
    });

    const admin = await login('demo@example.com', 'password123');
    ok(admin, 'admin login');

    const meta = await (await call(admin, '/onboarding/meta')).json();
    ok(meta.stages?.length === 6, `5 stages defined: ${meta.stages.map((s) => `${s.no}. ${s.name}`).join(' → ')}`);
    ok(meta.stages.every((s) => s.defaultDays > 0), `every stage is time-bound by default: ${meta.stages.map((s) => `${s.no}:${s.defaultDays}d`).join(' ')}`);

    const contracts = await (await call(admin, '/contracts')).json();
    const c = contracts[0];

    // Set a known scope in CLM, then check it reaches Stage 2 verbatim.
    await call(admin, `/contracts/${c.id}/scope`, {
        method: 'PUT',
        body: JSON.stringify({
            products: [
                { product_key: 'conformity', items: ['ISO 27001', 'SOC 2 Type II', 'PCI DSS'] },
                { product_key: 'interno', items: ['CrowdStrike', 'Okta'] },
                { product_key: 'vendor_pulse', unit_count: 420 },
                { product_key: 'agentctl', items: ['OpenAI'] }
            ]
        })
    });

    // clear any prior onboarding for a clean run
    const prior = await call(admin, `/onboarding/by-account/${encodeURIComponent(c.account)}`);
    if (prior.ok) await call(admin, `/onboarding/${(await prior.json()).id}`, { method: 'DELETE' });

    // ---- CSM must be assigned first ----
    const noCsm = await call(admin, '/onboarding', { method: 'POST', body: JSON.stringify({ account: c.account, contract_id: c.id }) });
    ok(noCsm.status === 400, `cannot start onboarding without a CSM assigned (${noCsm.status})`);

    // ---- proceed to onboard ----
    const started = await (await call(admin, '/onboarding', {
        method: 'POST',
        body: JSON.stringify({
            account: c.account, contract_id: c.id, csm_name: 'Rohan Mehta',
            csm_email: 'rohan@zeron.example', kickoff_date: '2026-06-01'
        })
    })).json();
    ok(started.id && started.stages?.length === 6, `onboarding started for ${started.account}, CSM ${started.csm_name}, 5 stages built`);
    ok(started.status === 'In progress' && started.stages[0].status === 'In progress',
        `stage 1 opens automatically (${started.stages[0].name} = ${started.stages[0].status})`);

    // ---- time-bound: due dates derived from kickoff ----
    const dues = started.stages.map((s) => `${s.stage_no}:${s.due_date}`);
    ok(started.stages.every((s) => !!s.due_date), `every stage carries a due date from kickoff: ${dues.join(' ')}`);
    // The plan is tier-shaped and scope-stretched, not a fixed 60 days: this
    // customer has 7 scoped items, so everything after kickoff buys 2 extra days.
    const plan = JSON.parse(started.stage_plan);
    ok(!started.support_tier && plan.length === 6,
        `plan stored with the onboarding, and NOT tier-driven (support_tier=${started.support_tier}) → ${plan.join('/')} days`);
    ok(plan[0] === 7 && plan[4] === 62 && plan[5] === 77,
        `scope stretched the plan: 7 items > 5 threshold, so every stage after kickoff gained 2 days (${plan.join('/')})`);
    ok(started.stages[4].due_date === '2026-08-02', `stage 5 due ${plan[4]}d after kickoff (${started.stages[4].due_date})`);
    ok(started.target_go_live === '2026-08-02',
        `go-live tracks the last *delivery* deadline (${started.target_go_live}), not the value stage's ${started.stages[5].due_date} — value can land after handover`);

    // ---- the value stage, and the two metrics it makes possible ----
    const valueStage = started.stages.find((s) => s.stage_no === 6);
    ok(valueStage?.name === 'First value realised',
        `stage 6 exists and is the value stage: "${valueStage?.name}" — ${valueStage?.tasks.length} tasks`);
    ok(valueStage.tasks.some((t) => /first use case/i.test(t.label)) && valueStage.tasks.some((t) => /success criteria/i.test(t.label)),
        `it closes on the first use case being achieved, with agreed success criteria`);
    ok(started.timeToOnboardDays === null && started.timeToValueDays === null,
        `both metrics start empty — they're measured, not assumed`);

    // The lead's agreed plan wins over any suggestion.
    const preview = await (await call(admin, `/onboarding/plan-preview/${encodeURIComponent(c.account)}`)).json();
    ok(preview.suggested?.length === 6 && preview.scopeItems === 7 && preview.tier === undefined,
        `plan preview explains itself without any tier: ${preview.scopeItems} scope items, base ${preview.base.join('/')} → suggested ${preview.suggested.join('/')}`);
    ok(JSON.stringify(preview.base) !== JSON.stringify(preview.suggested),
        `preview shows the stretch rather than hiding it (${preview.base.join('/')} vs ${preview.suggested.join('/')})`);

    // ---- THE POINT: stage 2 generated from the CLM scope ----
    const s2 = started.stages.find((s) => s.stage_no === 2);
    const labels = s2.tasks.map((t) => t.label);
    console.log('\n      Stage 2 checklist, generated from CLM scope:');
    for (const l of labels) console.log('        · ' + l);
    console.log('');

    ok(labels.some((l) => l.includes('ISO 27001')) && labels.some((l) => l.includes('SOC 2 Type II')) && labels.some((l) => l.includes('PCI DSS')),
        `all 3 Conformity frameworks became tickable items`);
    ok(labels.some((l) => l.includes('CrowdStrike')) && labels.some((l) => l.includes('Okta')),
        `both Interno integrations became tickable items`);
    ok(labels.some((l) => /Vendor Pulse.*420 vendors/.test(l)),
        `Vendor Pulse carried its count into one task, not 420 of them`);
    ok(labels.some((l) => l.includes('Agentctl') && l.includes('OpenAI')), `Agentctl source became an item`);
    ok(labels.some((l) => /Create the customer.s SaaS instance/.test(l)), `fixed instance-setup tasks are there too`);
    ok(s2.tasks.filter((t) => t.product_key).length === 7,
        `${s2.tasks.filter((t) => t.product_key).length} generated tasks trace back to a product (3 frameworks + 2 integrations + 1 vendor count + 1 agent source)`);

    // ---- stage 3 is joint work between both teams ----
    const s3 = started.stages.find((s) => s.stage_no === 3);
    const parties = [...new Set(s3.tasks.map((t) => t.party))];
    ok(parties.includes('Zeron') && parties.includes('Customer') && parties.includes('Joint'),
        `stage 3 tracks both teams: ${parties.join(', ')}`);

    // ---- ticking tasks drives stage + onboarding status ----
    const s1 = started.stages.find((s) => s.stage_no === 1);
    let state = started;
    for (const t of s1.tasks) {
        state = await (await call(admin, `/onboarding/tasks/${t.id}`, { method: 'PATCH', body: JSON.stringify({ done: true }) })).json();
    }
    const s1After = state.stages.find((s) => s.stage_no === 1);
    ok(s1After.status === 'Done' && s1After.progress === 100,
        `ticking every task closes the stage automatically (${s1After.status}, ${s1After.progress}%)`);
    ok(!!s1After.completed_at, `completion timestamp recorded (${s1After.completed_at?.slice(0, 10)})`);
    ok(s1After.delivered_variance_days !== null,
        `delivery measured against the deadline: ${s1After.delivered_variance_days} days vs due ${s1After.due_date}`);
    ok(state.progress === 17, `overall progress reflects 1 of 6 stages (${state.progress}%)`);

    // unticking reopens it — the derived status must work both ways
    const reopened = await (await call(admin, `/onboarding/tasks/${s1.tasks[0].id}`, { method: 'PATCH', body: JSON.stringify({ done: false }) })).json();
    ok(reopened.stages.find((s) => s.stage_no === 1).status === 'In progress', `unticking a task reopens the stage`);

    // ---- a stage can be blocked, and blocking sticks ----
    const blocked = await (await call(admin, `/onboarding/stages/${s3.id}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'Blocked', notes: 'Waiting on customer firewall approval' })
    })).json();
    ok(blocked.stages.find((s) => s.stage_no === 3).status === 'Blocked', `a stage can be blocked with a reason`);

    // ---- adding an ad-hoc task ----
    const withTask = await (await call(admin, `/onboarding/${started.id}/tasks`, {
        method: 'POST', body: JSON.stringify({ stage_id: s3.id, label: 'Customer to open port 443 to collector', party: 'Customer' })
    })).json();
    ok(withTask.stages.find((s) => s.stage_no === 3).tasks.some((t) => t.label.includes('port 443')), `ad-hoc tasks can be added to a stage`);

    // ---- one onboarding per account ----
    const dupe = await call(admin, '/onboarding', {
        method: 'POST', body: JSON.stringify({ account: c.account, contract_id: c.id, csm_name: 'Someone Else' })
    });
    ok(dupe.status === 409, `a second onboarding for the same account is refused (${dupe.status})`);

    // ---- the scope travels with the onboarding ----
    ok(started.scope?.length === 4, `onboarding carries the CLM scope for reference (${started.scope.map((s) => s.product).join(', ')})`);

    // ---- stats ----
    const stats = await (await call(admin, '/onboarding/stats')).json();
    ok(stats.total >= 1, `portfolio stats: ${stats.total} onboarding(s), ${stats.inProgress} in progress, ${stats.atRisk} at risk, avg days to live: ${stats.avgDaysToLive ?? 'n/a'}`);

    // ---- ABAC ----
    const rep = await login('priya@cashhorizon.io', 'demo1234');
    if (rep) {
        const repAccts = (await (await call(rep, '/accounts')).json()).map((a) => a.name);
        const visible = await (await call(rep, '/onboarding')).json();
        ok(visible.every((o) => repAccts.includes(o.account)), `rep only sees onboardings for their accounts (${visible.length})`);
        if (!repAccts.includes(c.account)) {
            const peek = await call(rep, `/onboarding/${started.id}`);
            ok(peek.status === 404, `rep cannot open an out-of-scope onboarding (${peek.status})`);
            const tamper = await call(rep, `/onboarding/tasks/${s1.tasks[0].id}`, { method: 'PATCH', body: JSON.stringify({ done: true }) });
            ok(tamper.status === 403 || tamper.status === 404, `rep cannot tick tasks on an out-of-scope onboarding (${tamper.status})`);
            const start = await call(rep, '/onboarding', { method: 'POST', body: JSON.stringify({ account: c.account, csm_name: 'X' }) });
            ok(start.status === 403, `rep cannot start onboarding for an account they cannot see (${start.status})`);
        }
    }

    console.log(`      (left onboarding #${started.id} for ${started.account} in place for the UI)`);

    // ================= time to onboard vs time to value =================
    console.log('\n--- the two metrics ---');

    // Close every DELIVERY stage (1-5) and leave value (6) open.
    let st = await (await call(admin, `/onboarding/${started.id}`)).json();
    // stage 3 was blocked earlier; unblock so it can complete
    await call(admin, `/onboarding/stages/${st.stages.find((s) => s.stage_no === 3).id}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'In progress' })
    });
    st = await (await call(admin, `/onboarding/${started.id}`)).json();
    for (const s of st.stages.filter((x) => x.stage_no <= 5)) {
        for (const t of s.tasks.filter((t) => !t.done)) {
            st = await (await call(admin, `/onboarding/tasks/${t.id}`, { method: 'PATCH', body: JSON.stringify({ done: true }) })).json();
        }
    }
    ok(st.status === 'Live', `delivery complete → the customer is Live (${st.status}) even though the value stage is still open`);
    ok(st.timeToOnboardDays !== null, `time to onboard is now measured: ${st.timeToOnboardDays} days from kickoff`);
    ok(st.valueRealised === false && st.timeToValueDays === null,
        `but value is NOT yet realised — Live ≠ useful. This is the gap the metric exists to expose.`);

    const statsMid = await (await call(admin, '/onboarding/stats')).json();
    ok(statsMid.liveWithoutValue >= 1,
        `portfolio flags it: ${statsMid.liveWithoutValue} customer(s) live but not yet getting value`);

    // Now the customer actually achieves their first use case.
    for (const t of st.stages.find((s) => s.stage_no === 6).tasks.filter((t) => !t.done)) {
        st = await (await call(admin, `/onboarding/tasks/${t.id}`, { method: 'PATCH', body: JSON.stringify({ done: true }) })).json();
    }
    ok(st.valueRealised === true && st.timeToValueDays !== null,
        `first use case achieved → time to value measured: ${st.timeToValueDays} days from kickoff (realised ${st.valueRealisedOn})`);
    ok(st.timeToOnboardDays !== null && st.timeToValueDays !== null,
        `both metrics now stand on their own: onboard ${st.timeToOnboardDays}d, value ${st.timeToValueDays}d`);

    const statsEnd = await (await call(admin, '/onboarding/stats')).json();
    ok(statsEnd.avgTimeToOnboard !== null && statsEnd.avgTimeToValue !== null,
        `portfolio reports both: avg time to onboard ${statsEnd.avgTimeToOnboard}d, avg time to value ${statsEnd.avgTimeToValue}d`);
    ok(statsEnd.liveWithoutValue === 0, `and the live-without-value gap closed (${statsEnd.liveWithoutValue})`);

    expect(__fail, __fail.join('\n')).toEqual([]);
  });
});
