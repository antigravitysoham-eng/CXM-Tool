import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;
const admin = jwt.sign({ id: 1, email: 'admin@x', name: 'QA Admin', role: 'admin', module_access: {} }, SECRET, { expiresIn: '10m' });
const rep = jwt.sign({ id: 2, email: 'rep@x', name: 'QA Rep', role: 'rep', module_access: {} }, SECRET, { expiresIn: '10m' });
const BASE = 'http://localhost:5000/api';

let pass = 0, fail = 0;
const results = [];
const H = (t) => ({ Authorization: `Bearer ${t}` });
async function get(path, tok = admin) {
    const r = await fetch(BASE + path, { headers: H(tok) });
    let body = null; try { body = await r.json(); } catch { /* non-json */ }
    return { status: r.status, body };
}
function check(name, cond, detail = '') {
    if (cond) { pass++; results.push(`  PASS  ${name}${detail ? ' — ' + detail : ''}`); }
    else { fail++; results.push(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

// 1) Every module list endpoint returns 200 + data (admin).
const modules = [
    ['/accounts', (b) => Array.isArray(b) && b.length],
    ['/contracts/customers', (b) => Array.isArray(b) && b.length],
    ['/onboarding', (b) => Array.isArray(b)],
    ['/support', (b) => Array.isArray(b) && b.length],
    ['/training', (b) => Array.isArray(b) && b.length],
    ['/health-checks/accounts', (b) => Array.isArray(b) && b.length],
    ['/ebrs/coverage', (b) => b && typeof b === 'object'],
    ['/surveys', (b) => Array.isArray(b) && b.length],
    ['/feature-requests', (b) => Array.isArray(b) && b.length],
    ['/upsells', (b) => Array.isArray(b) && b.length],
    ['/referrals', (b) => Array.isArray(b) && b.length],
    ['/journey/map', (b) => b && typeof b === 'object'],
    ['/comms', (b) => Array.isArray(b) && b.length],
    ['/events', (b) => Array.isArray(b) && b.length],
    ['/data/modules', (b) => b && Array.isArray(b.modules) && b.modules.length === 15]
];
console.log('\n== Module endpoints (admin) ==');
for (const [p, ok] of modules) {
    const r = await get(p);
    check(`GET ${p}`, r.status === 200 && ok(r.body), `status ${r.status}`);
}

// 2) New feature surfaces.
console.log('\n== New feature surfaces ==');
const act = await get('/activity');
check('GET /activity (admin)', act.status === 200 && Array.isArray(act.body), `${act.body?.length} events`);
const actRep = await get('/activity', rep);
check('GET /activity (rep → 403)', actRep.status === 403);
for (const p of ['/performance/csm', '/performance/account-managers', '/performance/partners']) {
    const r = await get(p); const rr = await get(p, rep);
    check(`GET ${p} (admin 200, rep 403)`, r.status === 200 && Array.isArray(r.body) && rr.status === 403);
}
// customer360 MEDDICC
const custs = (await get('/contracts/customers')).body;
check('/customers has region + isChurned', 'region' in custs[0] && 'isChurned' in custs[0]);
const c360 = await get(`/contracts/customer-360/${encodeURIComponent(custs[0].name)}`);
check('customer360 returns MEDDICC', c360.status === 200 && 'meddicc' in c360.body && Object.keys(c360.body.meddicc).length === 7);
// feature stage-history
const feats = (await get('/feature-requests')).body;
const sh = await get(`/feature-requests/${feats[0].id}/stage-history`);
check('feature stage-history', sh.status === 200 && Array.isArray(sh.body));
check('feature has days_in_stage', feats[0].days_in_stage !== undefined);

// 3) Invoice attach + download round-trip.
console.log('\n== Invoice attach + download ==');
const withContract = custs.find((x) => x.hasContract);
const c360b = await get(`/contracts/customer-360/${encodeURIComponent(withContract.name)}`);
const contractId = c360b.body.contracts[0]?.id;
const tinyPdf = Buffer.from('%PDF-1.4 QA test invoice').toString('base64');
const createRes = await fetch(BASE + '/invoices', {
    method: 'POST', headers: { ...H(admin), 'Content-Type': 'application/json' },
    body: JSON.stringify({ contract_id: contractId, amount: 100000, currency: 'INR', status: 'Raised', file_base64: tinyPdf, file_name: 'qa-invoice.pdf', mime: 'application/pdf' })
});
const inv = await createRes.json();
check('create invoice with attachment', createRes.status === 201 && inv.has_file === true, `has_file=${inv.has_file}`);
const dl = await fetch(BASE + `/invoices/${inv.id}/download`, { headers: H(admin) });
const dlBuf = Buffer.from(await dl.arrayBuffer());
check('download attached invoice', dl.status === 200 && dlBuf.slice(0, 5).toString() === '%PDF-', `${dlBuf.length} bytes`);

// 4) Cross-module consistency (accounts referenced all exist).
console.log('\n== Consistency ==');
const names = new Set(custs.map((c) => c.name).concat((await get('/accounts')).body.map((a) => a.name)));
const journeyMap = (await get('/journey/map')).body;
const journeyAccts = Object.values(journeyMap).flat().map((j) => j.account);
check('journey accounts all exist', journeyAccts.every((a) => names.has(a)));

console.log('\n' + results.join('\n'));
console.log(`\n== QA RESULT: ${pass} passed, ${fail} failed ==`);
process.exit(fail ? 1 : 0);
