import { config } from '../config.js';
import { ask } from './neoService.js';
import { buildModuleReportPdf } from './reportService.js';
import { formatAnswer } from './whatsappService.js';
import { telegramRepo } from '../repositories/telegramRepo.js';

/**
 * Telegram conversational assistant — the NEO brain over Telegram, mirroring the
 * WhatsApp channel.
 *
 * A person DMs the bot; an unrecognised chat is walked through a one-time link
 * code (generated in the AGCX app) that binds their Telegram id to their account;
 * a linked chat gets its questions answered strictly inside that account's ABAC
 * scope by delegating to the same ask() every other surface uses. Delivery is by
 * long-polling (getUpdates) so it needs no public URL — it just runs inside the
 * server process. Env-gated on TELEGRAM_ASSISTANT_TOKEN.
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const THINK_MS = 900;
const MAX_BODY = 3900; // Telegram caps a message at 4096; leave headroom.

const api = (method) => `${config.telegram.apiBase}/bot${config.telegram.assistantToken}/${method}`;

// Split a long answer on line boundaries so it arrives as a few tidy messages.
function chunk(text) {
    if (text.length <= MAX_BODY) return [text];
    const out = [];
    let buf = '';
    for (const line of text.split('\n')) {
        if (buf.length + line.length + 1 > MAX_BODY) { if (buf) out.push(buf); buf = line; }
        else buf = buf ? `${buf}\n${line}` : line;
    }
    if (buf) out.push(buf);
    return out;
}

/**
 * Send text to a chat. Tries Telegram Markdown first (the WhatsApp formatter emits
 * the same bold/italic syntax); on a parse error (unbalanced markup from a stray
 * asterisk or underscore in data) it retries the same text as plain, so a reply is
 * never lost to formatting. No-op (logged) until the assistant token is set.
 */
export async function sendText(chatId, body) {
    if (!config.telegram.assistantEnabled) { console.warn('[telegram-assistant] send skipped — TELEGRAM_ASSISTANT_TOKEN not set'); return { skipped: true }; }
    for (const part of chunk(String(body || ''))) {
        let res = await post({ chat_id: chatId, text: part, parse_mode: 'Markdown', disable_web_page_preview: true });
        if (!res.ok && res.error_code === 400) {
            res = await post({ chat_id: chatId, text: part, disable_web_page_preview: true }); // plain fallback
        }
        if (!res.ok) { console.error('[telegram-assistant] send failed:', res.description || res.error_code); return { ok: false }; }
    }
    return { ok: true };
}

async function post(payload) {
    try {
        const r = await fetch(api('sendMessage'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        return r.json();
    } catch (e) { return { ok: false, description: e.message }; }
}

/** Show the "typing…" action while NEO works the answer. Best-effort. */
export async function sendTyping(chatId) {
    if (!config.telegram.assistantEnabled) return;
    try {
        await fetch(api('sendChatAction'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, action: 'typing' })
        });
    } catch { /* typing is a nicety, never fail the reply over it */ }
}

/** Send a PDF (e.g. a report) as a Telegram document. Best-effort. */
export async function sendDocument(chatId, buffer, filename, caption = '') {
    if (!config.telegram.assistantEnabled) return { skipped: true };
    try {
        const form = new FormData();
        form.append('chat_id', String(chatId));
        if (caption) form.append('caption', caption);
        form.append('document', new Blob([buffer], { type: 'application/pdf' }), filename);
        const r = await fetch(api('sendDocument'), { method: 'POST', body: form });
        const j = await r.json();
        if (!j.ok) { console.error('[telegram-assistant] document failed:', j.description); return { ok: false }; }
        return { ok: true };
    } catch (e) { console.error('[telegram-assistant] sendDocument error:', e.message); return { ok: false }; }
}

// ---- inbound conversation ----------------------------------------------------

const LINK_HELP =
    "👋 This Telegram isn't linked to AGCX yet.\n\n" +
    'Open the AGCX app → the assistant screen → *Link Telegram* to get a *6-digit code*, ' +
    'then send that code here. Your answers will be scoped to exactly what your account can see.';

const looksLikeCode = (t) => /^\s*\d{6}\s*$/.test(t || '');

/**
 * Handle one inbound message. `from` is the Telegram user object ({id, username,
 * first_name}); `chatId` is where to reply. Resolves the id to a user and answers
 * in scope, or runs the link handshake. Returns the reply text (handy for tests).
 */
export async function handleInbound({ chatId, from, text }) {
    const body = String(text || '').trim();
    const tgId = String(from?.id || chatId);
    const identity = await telegramRepo.resolve(tgId);

    // ---- linked: answer inside the user's scope ----
    if (identity) {
        if (/^\s*(unlink|stop|disconnect)\s*$/i.test(body)) {
            await telegramRepo.unlink(tgId, identity.user.id);
            const msg = "You're unlinked. Generate a fresh 6-digit code in the AGCX app to reconnect.";
            await sendText(chatId, msg);
            return msg;
        }
        await sendTyping(chatId);
        const answer = await ask(body, identity.user, { channel: 'telegram' });
        const reply = formatAnswer(answer);
        await sleep(THINK_MS);
        await sendText(chatId, reply);
        // Follow-up messages (e.g. a copy-paste template) go out on their own.
        for (const extra of answer.followups || []) {
            if (extra && extra.trim()) await sendText(chatId, extra);
        }
        // If they asked for a report, follow the text with the actual PDF, scoped
        // to the period they chose (All / Q1–Q4 / custom range).
        if (answer.report) {
            try {
                const period = answer.report.period || null;
                const pdf = await buildModuleReportPdf(answer.report.module, identity.user, period);
                if (pdf) {
                    const span = period?.label && period.label !== 'all time' ? ` · ${period.label}` : '';
                    const rows = pdf.count != null ? ` (${pdf.count} record${pdf.count === 1 ? '' : 's'})` : '';
                    await sendDocument(chatId, pdf.buffer, pdf.filename, `${answer.report.label} · Executive Report${span}${rows}`);
                } else await sendText(chatId, "Sorry — I couldn't find that report.");
            } catch (e) {
                console.error('[telegram-assistant] report failed:', e?.message || e);
                await sendText(chatId, 'The report failed to generate — please try again shortly.');
            }
        }
        return reply;
    }

    // ---- unlinked: /start (optionally with a deep-link code), or the handshake ----
    // A t.me/<bot>?start=<code> deep link arrives as "/start <code>" — pull the code
    // out so one tap from the app links the account.
    const start = body.match(/^\/start(?:\s+(\S+))?/);
    let candidate = body;
    if (start) {
        const payload = String(start[1] || '').replace(/[^\d]/g, '');
        if (payload.length !== 6) { await sendText(chatId, LINK_HELP); return LINK_HELP; }
        candidate = payload;
    }

    if (looksLikeCode(candidate)) {
        const rec = await telegramRepo.userForCode(candidate);
        if (!rec) {
            const msg = "That code isn't valid or has expired. Open AGCX and generate a fresh one.";
            await sendText(chatId, msg); return msg;
        }
        await telegramRepo.deleteLinkCode(candidate);
        await telegramRepo.bind(tgId, rec.user_id, { chatId, username: from?.username, firstName: from?.first_name });
        const msg =
            `✅ Linked as *${rec.name}*.\n\n` +
            'Ask me anything in your scope — for example:\n' +
            '• _my pipeline_\n• _how are my support tickets?_\n• _show me TIC-0157_\n• _send the CLM report_\n\n' +
            'Send *unlink* any time to disconnect.';
        await sendText(chatId, msg);
        return msg;
    }

    await sendText(chatId, LINK_HELP);
    return LINK_HELP;
}

// ---- long-poll loop ----------------------------------------------------------

let running = false;
let offset = 0;
let assistantUsername = '';

/** The @username of the assistant bot (known after startAssistant), for deep links. */
export function getAssistantUsername() { return assistantUsername; }

async function pollOnce() {
    const r = await fetch(api('getUpdates') + `?timeout=30&offset=${offset}&allowed_updates=["message"]`);
    const j = await r.json();
    if (!j.ok) { if (j.error_code === 409) console.error('[telegram-assistant] getUpdates conflict — another poller or a webhook is set'); return; }
    for (const u of j.result || []) {
        offset = u.update_id + 1;
        const m = u.message;
        if (!m || !m.text) continue;
        try {
            await handleInbound({ chatId: m.chat.id, from: m.from, text: m.text });
        } catch (e) {
            console.error('[telegram-assistant] handler error:', e?.message || e);
        }
    }
}

/** Start the long-poll loop (once). No-op if the assistant token isn't set. */
export async function startAssistant() {
    if (!config.telegram.assistantEnabled) return;
    if (running) return;
    // Confirm the token and clear any stale webhook (getUpdates and webhooks are
    // mutually exclusive), so polling is guaranteed to receive updates.
    try {
        const me = await (await fetch(api('getMe'))).json();
        if (!me.ok) { console.error('[telegram-assistant] invalid TELEGRAM_ASSISTANT_TOKEN — not starting'); return; }
        assistantUsername = me.result.username || '';
        await fetch(api('deleteWebhook') + '?drop_pending_updates=false').catch(() => {});
        running = true;
        console.log(`[telegram-assistant] polling started as @${me.result.username}`);
        (async () => {
            while (running) {
                try { await pollOnce(); }
                catch (e) { console.error('[telegram-assistant] poll error:', e?.message || e); await sleep(2000); }
            }
        })();
    } catch (e) {
        console.error('[telegram-assistant] failed to start:', e?.message || e);
    }
}

export function stopAssistant() { running = false; }
