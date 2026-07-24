import crypto from 'crypto';
import { config } from '../config.js';
import { ask } from './neoService.js';
import { whatsappRepo } from '../repositories/whatsappRepo.js';

/**
 * WhatsApp Cloud API glue.
 *
 * Three jobs: prove an inbound webhook really came from Meta (HMAC over the raw
 * body), turn a NEO answer into text WhatsApp can render, and drive the inbound
 * conversation — link an unrecognised number via a code, or answer a linked
 * user's prompt strictly inside their scope by delegating to ask().
 */

const WA = config.whatsapp;

// ---- signature ---------------------------------------------------------------

/**
 * Verify Meta's X-Hub-Signature-256 over the exact raw request body.
 * With no app secret configured we cannot verify — allowed for local dev, but
 * the route logs a warning so it is never mistaken for real protection in prod.
 */
export function verifySignature(rawBody, header) {
    if (!WA.appSecret) return { ok: true, unverifiable: true };
    if (!header || !header.startsWith('sha256=')) return { ok: false };
    const expected = crypto.createHmac('sha256', WA.appSecret).update(rawBody).digest('hex');
    const got = header.slice('sha256='.length);
    // Both are hex of equal length; timingSafeEqual needs equal-length buffers.
    if (got.length !== expected.length) return { ok: false };
    const ok = crypto.timingSafeEqual(Buffer.from(got, 'hex'), Buffer.from(expected, 'hex'));
    return { ok };
}

// ---- outbound ----------------------------------------------------------------

const GRAPH = () => `https://graph.facebook.com/${WA.graphVersion}/${WA.phoneId}/messages`;
const MAX_BODY = 3800; // WhatsApp caps a text body at 4096; leave headroom.

// Split on paragraph/line boundaries so a long answer arrives as a few tidy
// messages rather than one truncated wall.
function chunk(text) {
    if (text.length <= MAX_BODY) return [text];
    const out = [];
    let buf = '';
    for (const line of text.split('\n')) {
        if (buf.length + line.length + 1 > MAX_BODY) {
            if (buf) out.push(buf);
            buf = line;
        } else {
            buf = buf ? `${buf}\n${line}` : line;
        }
    }
    if (buf) out.push(buf);
    return out;
}

/** Send a text message to a number. No-op (logged) until credentials are set. */
export async function sendText(to, body) {
    if (!WA.enabled) {
        console.warn('[whatsapp] send skipped — WHATSAPP_TOKEN/PHONE_ID not configured');
        return { skipped: true };
    }
    for (const part of chunk(body)) {
        const res = await fetch(GRAPH(), {
            method: 'POST',
            headers: { Authorization: `Bearer ${WA.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to,
                type: 'text',
                text: { preview_url: false, body: part }
            })
        });
        if (!res.ok) {
            const detail = await res.text().catch(() => '');
            console.error(`[whatsapp] send failed ${res.status}: ${detail.slice(0, 300)}`);
            return { ok: false, status: res.status };
        }
    }
    return { ok: true };
}

// ---- answer formatting -------------------------------------------------------

// A compact INR formatter mirroring neoService.money(), used only for chart
// values (stats/tables arrive pre-formatted).
function money(n) {
    const v = Math.round(Number(n) || 0);
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(2).replace(/\.00$/, '')}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(2).replace(/\.00$/, '')}L`;
    return `₹${v.toLocaleString('en-IN')}`;
}

// NEO always speaks; it brings in the specialist. These are the collaboration
// intros, picked deterministically by intent so the same question reads the same
// way twice but different questions feel varied — never robotic.
const COLLAB = [
    (a) => `🧠 *NEO* looped in ${a.emoji} *${a.name}* — _${a.task}._`,
    (a) => `🧠 *NEO* pulled in ${a.emoji} *${a.name}* — _${a.task}._`,
    (a) => `🧠 *NEO* + ${a.emoji} *${a.name}* worked this out — _${a.task}._`,
    (a) => `🧠 *NEO* brought in ${a.emoji} *${a.name}* — _${a.task}._`
];
const hashStr = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const introFor = (relay, intent) => (relay ? COLLAB[hashStr(String(intent)) % COLLAB.length](relay) : '🧠 *NEO*');

/**
 * Render a NEO answer ({ reply, blocks, relay, denied }) as WhatsApp markdown.
 * Every answer opens with NEO handing off to the specialist and closes with a
 * joint signature, so it reads like a team derived the result. WhatsApp supports
 * *bold*, _italic_ and ```mono```; there are no tables, so tabular data becomes
 * aligned lines. Charts only render when nothing else carries the detail.
 */
export function formatAnswer(answer) {
    // Access denial: NEO's voice, names whose desk it is, then what they CAN ask.
    if (answer.denied) {
        const r = answer.relay;
        const desk = r ? `That's ${r.emoji} *${r.name}*'s desk. ` : '';
        return [
            '🧠 *NEO*',
            `${desk}${answer.reply || ''}`.trim(),
            '_Meanwhile I can help with: pipeline, renewals, top accounts._'
        ].join('\n\n');
    }

    const relay = answer.relay;
    const parts = [introFor(relay, answer.intent)];
    if (answer.reply) parts.push(answer.reply.trim());

    const blocks = answer.blocks || [];
    const hasDetail = blocks.some((b) => b.type === 'table' || b.type === 'stats' || b.type === 'list');

    for (const b of blocks) {
        if (b.type === 'text' && b.text) {
            parts.push(b.text.trim());
        } else if (b.type === 'stats' && b.items?.length) {
            parts.push(b.items.map((it) => {
                const hint = it.hint ? ` _(${it.hint})_` : '';
                return `• *${it.value}* — ${it.label}${hint}`;
            }).join('\n'));
        } else if (b.type === 'table' && b.rows?.length) {
            const lines = [`*${b.title || 'Details'}*`];
            for (const row of b.rows) {
                const [head, ...rest] = row.map((c) => String(c));
                lines.push(rest.length ? `• ${head} — ${rest.join(' · ')}` : `• ${head}`);
            }
            parts.push(lines.join('\n'));
        } else if (b.type === 'list' && b.items?.length) {
            parts.push([`*${b.title || ''}*`.trim(), ...b.items.map((i) => `• ${i}`)].filter(Boolean).join('\n'));
        } else if (b.type === 'chart' && !hasDetail && b.data?.length) {
            const fmt = b.valueFormat === 'money' ? money : (v) => String(v);
            const lines = [`*${b.title || 'Breakdown'}*`];
            for (const d of b.data.slice(0, 12)) lines.push(`• ${d.name} — ${fmt(d.value)}`);
            parts.push(lines.join('\n'));
        }
    }

    let out = parts.filter(Boolean).join('\n\n');
    if (answer.proposal?.summary) {
        // Writes are never auto-executed over WhatsApp — surface, don't perform.
        out += `\n\n_Requested change:_ ${answer.proposal.summary}\n_Confirm this in the AGCX app._`;
    }
    // Joint signature — reinforces "NEO worked this with the specialist".
    out += `\n\n_${relay ? `NEO + ${relay.name}` : 'NEO'} · AGCX_`;
    return out || 'Done.';
}

// ---- inbound conversation ----------------------------------------------------

const LINK_HELP =
    "👋 This number isn't linked to AGCX yet.\n\n" +
    'Open the AGCX app, tap the WhatsApp icon on the assistant screen to get a *6-digit code*, ' +
    'then send that code here. Your answers will be scoped to exactly what your account can see.';

const looksLikeCode = (t) => /^\s*\d{6}\s*$/.test(t || '');

/**
 * Handle one inbound text message from `from` (E.164 digits). Resolves the
 * number to a user and answers in scope, or runs the link handshake. Returns the
 * reply text that was sent (handy for tests); sending itself is best-effort.
 */
export async function handleInbound(from, text) {
    const body = String(text || '').trim();
    const identity = await whatsappRepo.resolve(from);

    // ---- linked: answer inside the user's scope ----
    if (identity) {
        if (/^\s*(unlink|stop|disconnect)\s*$/i.test(body)) {
            await whatsappRepo.unlink(from, identity.user.id);
            const msg = "You're unlinked. Send a fresh 6-digit code from the AGCX app to reconnect.";
            await sendText(from, msg);
            return msg;
        }
        const answer = await ask(body, identity.user);
        const reply = formatAnswer(answer);
        await sendText(from, reply);
        return reply;
    }

    // ---- unlinked: try to consume a link code, else explain how to link ----
    if (looksLikeCode(body)) {
        const userId = await whatsappRepo.consumeLinkCode(body);
        if (userId) {
            const ident = await whatsappRepo.bind(from, userId);
            const name = ident?.user?.name || 'there';
            const msg =
                `✅ Linked as *${name}*.\n\n` +
                'Ask me things like:\n' +
                '• _my pipeline_\n• _top 5 accounts_\n• _renewals in 90 days_\n• _pipeline by stage_\n\n' +
                'Send *unlink* any time to disconnect this number.';
            await sendText(from, msg);
            return msg;
        }
        const msg = "That code isn't valid or has expired. Open AGCX and generate a fresh one.";
        await sendText(from, msg);
        return msg;
    }

    await sendText(from, LINK_HELP);
    return LINK_HELP;
}

/**
 * Pull the text messages out of a Meta webhook payload. Ignores statuses
 * (delivered/read) and non-text message types, returning [{ from, text, id }].
 */
export function extractMessages(payload) {
    const out = [];
    for (const entry of payload?.entry || []) {
        for (const change of entry.changes || []) {
            for (const m of change.value?.messages || []) {
                if (m.type === 'text' && m.text?.body) {
                    out.push({ from: m.from, text: m.text.body, id: m.id });
                } else {
                    // A non-text message still deserves a nudge back.
                    out.push({ from: m.from, text: '', id: m.id, unsupported: true });
                }
            }
        }
    }
    return out;
}
