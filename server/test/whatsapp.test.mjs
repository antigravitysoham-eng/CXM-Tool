import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';

const API = 'http://localhost:5099/api';
const WEBHOOK = `${API}/whatsapp/webhook`;
const APP_SECRET = 'test-app-secret';       // matches globalSetup
const VERIFY_TOKEN = 'test-verify-token';   // matches globalSetup

const login = async (email, password) => (await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
})).json()).token;

const call = (t, p, opts = {}) => fetch(`${API}${p}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) }
});

// Post a Meta-shaped inbound payload with a valid HMAC signature.
const sign = (raw) => 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(raw).digest('hex');
const postWebhook = (bodyObj, { signature } = {}) => {
    const raw = Buffer.from(JSON.stringify(bodyObj));
    return fetch(WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': signature ?? sign(raw) },
        body: raw
    });
};
const inbound = (from, text) => ({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ value: { messages: [{ from, id: 'wamid.' + from + Date.now(), type: 'text', text: { body: text } }] } }] }]
});

// The webhook answers 200 before doing the work, so give the async handler a beat.
const settle = () => new Promise((r) => setTimeout(r, 400));

describe('whatsapp integration', () => {
    it('all checks pass', async () => {
        const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

        // ---- GET verification handshake ----
        const good = await fetch(`${WEBHOOK}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=42`);
        ok(good.status === 200 && (await good.text()) === '42', 'verify handshake echoes the challenge');

        const bad = await fetch(`${WEBHOOK}?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=42`);
        ok(bad.status === 403, 'verify handshake rejects a wrong token (403)');

        // ---- signature enforcement ----
        const noSig = await postWebhook(inbound('15550009999', 'hi'), { signature: 'sha256=deadbeef' });
        ok(noSig.status === 401, 'inbound with a bad signature is rejected (401)');

        // ---- unknown number gets the link instructions, stays unlinked ----
        const phone = '919812345670';
        const unknown = await postWebhook(inbound(phone, 'my pipeline'));
        ok(unknown.status === 200, 'valid inbound is acknowledged fast (200)');

        // ---- link handshake: admin mints a code, texting it binds the number ----
        const admin = await login('demo@example.com', 'password123');

        const status0 = await (await call(admin, '/whatsapp/status')).json();
        ok(status0.businessNumber === '+1 555 010 0000', `status exposes the business number ("${status0.businessNumber}")`);
        ok(Array.isArray(status0.links) && status0.links.length === 0, 'admin has no linked numbers yet');

        const { code } = await (await call(admin, '/whatsapp/link-code', { method: 'POST' })).json();
        ok(/^\d{6}$/.test(code || ''), `link-code returns a 6-digit code (${code})`);

        // A wrong code must NOT bind.
        await postWebhook(inbound(phone, '000000'));
        await settle();
        let links = await (await call(admin, '/whatsapp/links')).json();
        ok(links.length === 0, 'a wrong code does not link the number');

        // The real code binds the number to the admin.
        await postWebhook(inbound(phone, code));
        await settle();
        links = await (await call(admin, '/whatsapp/links')).json();
        ok(links.length === 1 && links[0].phone === phone, `correct code links the number (${links[0]?.phone})`);

        // A code is single-use: replaying it does not create a second binding.
        await postWebhook(inbound('15550001111', code));
        await settle();
        const otherAdminLinks = await (await call(admin, '/whatsapp/links')).json();
        ok(otherAdminLinks.length === 1, 'a link code cannot be reused (single-use)');

        // ---- a linked number now resolves to the user for scoped answers ----
        // (send is a no-op without WHATSAPP_TOKEN, but the pipeline must not throw)
        const answered = await postWebhook(inbound(phone, 'top 5 accounts'));
        ok(answered.status === 200, 'a prompt from a linked number is accepted (200)');

        // ---- unlink from the app removes the binding ----
        const del = await call(admin, `/whatsapp/links/${phone}`, { method: 'DELETE' });
        ok(del.status === 200, 'unlink returns 200');
        links = await (await call(admin, '/whatsapp/links')).json();
        ok(links.length === 0, 'the number is gone after unlink');

        // deleting a non-existent link 404s
        const del2 = await call(admin, `/whatsapp/links/${phone}`, { method: 'DELETE' });
        ok(del2.status === 404, 'unlinking an unknown number 404s');

        expect(__fail, `failed: ${__fail.join('; ')}`).toEqual([]);
    });
});

// Pure formatter unit test — no server, no Meta.
describe('whatsapp answer formatting', () => {
    it('renders blocks as WhatsApp markdown', async () => {
        const { formatAnswer } = await import('../services/whatsappService.js');
        const out = formatAnswer({
            reply: 'You have 3 prospects.',
            blocks: [
                { type: 'stats', items: [{ label: 'Open pipeline', value: '₹4Cr', hint: '3 prospects' }] },
                { type: 'table', title: 'Stages', columns: ['Stage', 'Deals', 'Value'], rows: [['POC', 2, '₹2Cr'], ['Lead', 1, '₹1Cr']] },
                { type: 'chart', variant: 'bar', title: 'ignored', data: [{ name: 'x', value: 100000 }], valueFormat: 'money' }
            ]
        });
        expect(out).toContain('You have 3 prospects.');
        expect(out).toContain('*₹4Cr* — Open pipeline');
        expect(out).toContain('*Stages*');
        expect(out).toContain('POC — 2 · ₹2Cr');
        // chart is suppressed when a table/stats already carry the detail
        expect(out).not.toContain('Breakdown');
    });

    it('reads like NEO collaborating with the specialist', async () => {
        const { formatAnswer } = await import('../services/whatsappService.js');
        const out = formatAnswer({
            intent: 'support',
            relay: { key: 'medic', name: '911', emoji: '🚑', task: 'triaging the support desk' },
            reply: 'You have 7 open tickets.',
            blocks: [{ type: 'stats', items: [{ label: 'Open tickets', value: '7' }] }]
        });
        expect(out).toContain('*NEO*');            // NEO always speaks
        expect(out).toContain('*911*');            // specialist named (name, not key)
        expect(out).toContain('triaging the support desk'); // the collaboration task
        expect(out).toContain('_NEO + 911 · AGCX_');        // joint signature
        expect(out).not.toContain('medic');         // never the internal key
    });

    it('renders an access denial in NEO voice naming the desk', async () => {
        const { formatAnswer } = await import('../services/whatsappService.js');
        const out = formatAnswer({
            intent: 'support', denied: true, module: 'support',
            relay: { key: 'medic', name: '911', emoji: '🚑', task: 'triaging the support desk' },
            reply: "You don't have access to the Support module, so I can't pull that for you. Ask an admin to enable Support for your account."
        });
        expect(out).toContain("*911*'s desk");
        expect(out).toContain("don't have access to the Support module");
        expect(out).toContain('Meanwhile I can help with');
    });
});

// The access gate lives in the shared brain (ask), so /neo/ask exercises exactly
// what WhatsApp does. A per-user module deny turns an answer into a denial.
describe('per-user access gating', () => {
    it('all checks pass', async () => {
        const __fail = [];
        const ok = (c, m) => { if (c) { console.log('  ✓ ' + m); } else { console.log('  ✗ ' + m); __fail.push(m); } };

        const admin = await login('demo@example.com', 'password123');
        const email = `gate-${Date.now()}@example.com`;

        // Admin creates a rep. Reps hold Support by the seed policy.
        const created = await (await call(admin, '/users', {
            method: 'POST', body: JSON.stringify({ email, name: 'Gate Test', password: 'password123', role: 'rep' })
        })).json();
        ok(created.id, `created rep user (id ${created.id})`);

        const rep = await login(email, 'password123');
        const askSupport = async (t) => (await call(t, '/neo/ask', { method: 'POST', body: JSON.stringify({ prompt: 'how are my support tickets?' }) })).json();

        // With Support (role default) → a real, agent-attributed answer, not a denial.
        const a1 = await askSupport(rep);
        ok(a1.intent === 'support', `support question routes to support intent (${a1.intent})`);
        ok(!a1.denied, 'rep WITH support access is not denied');
        ok(a1.relay?.name === '911', `answer is attributed to 911 (${a1.relay?.name})`);

        // Admin denies Support for this one user.
        const patched = await call(admin, `/users/${created.id}`, { method: 'PATCH', body: JSON.stringify({ module_access: { support: 'deny' } }) });
        ok(patched.status === 200, `admin set module_access.support=deny (${patched.status})`);
        const back = await (await call(admin, '/users')).json();
        ok(back.find((u) => u.id === created.id)?.module_access?.support === 'deny', 'deny persisted on the user');

        // Re-login so the JWT carries the new module_access, then ask again → denial.
        const rep2 = await login(email, 'password123');
        const a2 = await askSupport(rep2);
        ok(a2.denied === true, 'rep WITHOUT support access is denied');
        ok(/access to the Support module/i.test(a2.reply || ''), 'denial explains the missing Support access');

        // The deny is scoped to Support only — accounts still answers.
        const a3 = await (await call(rep2, '/neo/ask', { method: 'POST', body: JSON.stringify({ prompt: "how's the pipeline?" }) })).json();
        ok(!a3.denied && a3.intent === 'pipeline', 'accounts questions still work after a support-only deny');

        // cleanup
        await call(admin, `/users/${created.id}`, { method: 'DELETE' });

        expect(__fail, `failed: ${__fail.join('; ')}`).toEqual([]);
    });
});
