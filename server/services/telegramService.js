import { config } from '../config.js';
import { telegramRepo } from '../repositories/telegramRepo.js';
import { supportRepo } from '../repositories/supportRepo.js';
import { featureRepo } from '../repositories/featureRepo.js';
import { userRepo } from '../repositories/userRepo.js';
import { parseTicketUpdate, parseFeatureUpdate } from './telegramUpdateSchema.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// DM the sharer via the assistant bot — loaded lazily to avoid an import cycle
// (assistant → neoService → telegramService).
async function assistantDm(chatId, text) {
    try { const m = await import('./telegramAssistantService.js'); return m.sendText(chatId, text); }
    catch { return { ok: false }; }
}

/**
 * Telegram relay.
 *
 * A thin wrapper over the Telegram Bot API used to push two kinds of update to a
 * chat the leadership watches (by default the CTO's): reported bugs and
 * feature-request details. It is deliberately one-way — we only ever *send* — and
 * fully env-gated: with no bot token / chat id configured every call is a graceful
 * no-op that reports why, so the rest of the platform never has to care whether
 * Telegram is wired up.
 *
 * Setup (done once by the operator, never by Claude):
 *   1. Create a bot with @BotFather → it hands back a token.
 *   2. Get the destination chat id — message the bot (or add it to a group) and
 *      read the chat.id from https://api.telegram.org/bot<token>/getUpdates.
 *   3. Put both in .env: TELEGRAM_BOT_TOKEN and TELEGRAM_CTO_CHAT_ID.
 * Secrets live only in .env (gitignored) — never commit them.
 */

const api = (method) => `${config.telegram.apiBase}/bot${config.telegram.botToken}/${method}`;

// Telegram HTML parse mode needs &, <, > escaped in any interpolated value.
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Send a message to a chat. `chatId` defaults to the configured CTO chat.
 * Returns { ok, disabled?, reason?, result? } — never throws, so callers can relay
 * the outcome without a try/catch of their own.
 */
export async function sendMessage(text, { chatId } = {}) {
    // Never emit real Telegram traffic from the test suite (bug-ticket creates
    // would otherwise post to the live CTO group).
    if (config.env === 'test') return { ok: false, disabled: true, reason: 'test' };
    if (!config.telegram.enabled) {
        return { ok: false, disabled: true, reason: 'Telegram is not configured — set TELEGRAM_BOT_TOKEN and TELEGRAM_CTO_CHAT_ID in .env.' };
    }
    const chat_id = chatId || config.telegram.ctoChatId;
    try {
        const res = await fetch(api('sendMessage'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true })
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || body.ok === false) {
            return { ok: false, reason: body.description || `Telegram API returned ${res.status}`, result: body };
        }
        return { ok: true, result: body.result };
    } catch (err) {
        return { ok: false, reason: err.message || 'Telegram request failed' };
    }
}

const line = (label, value) => (value ? `<b>${esc(label)}:</b> ${esc(value)}\n` : '');

// A labelled Description block — always shown (with a placeholder when the record
// carries none) so the reader can see at a glance that nothing was written up.
const describe = (text) => `\n<b>📝 Description:</b>\n${text ? esc(String(text)).slice(0, 1200) : '<i>— no description provided —</i>'}\n`;

// The @handle to ping on every relay (e.g. @ask_santosh_bot). Mentions are NOT
// HTML-escaped — Telegram needs the literal @username to render the mention.
const tag = () => (config.telegram.mention ? `\n${config.telegram.mention}` : '');

// How a responder feeds an update back: reply to the message with key: value pairs.
const replyHint = (kind) => (kind === 'feature'
    ? '\n\n↩️ <b>Reply to this message</b> to update it — e.g. <code>status: Planned | note: on the Q3 roadmap</code>'
    : '\n\n↩️ <b>Reply to this message</b> to update it — e.g. <code>status: Dev Pending | resolution: Bug Fix | note: fixed in build 1.2</code>');

// Record the sent message so a reply can be matched back to the record + sharer.
async function trackRelay(res, { entity, entityId, reference, byUserId, by }) {
    if (res?.ok && res.result?.message_id) {
        try {
            await telegramRepo.recordRelay({
                chatId: config.telegram.ctoChatId, messageId: res.result.message_id,
                entity, entityId, reference, sharedByUserId: byUserId, sharedByName: by
            });
        } catch (e) { console.error('[telegram] recordRelay failed:', e.message); }
    }
}

/** Forward a (bug) support ticket to the CTO chat with the full detail set. */
export async function relayTicketToCto(t, { by, byUserId } = {}) {
    const msg =
        `🐞 <b>Bug ticket — ${esc(t.ticket_no)}</b>\n` +
        `<b>${esc(t.subject)}</b>\n\n` +
        line('Account', t.account) +
        line('Type', t.type) +
        line('Priority', t.priority) +
        line('Status', t.status) +
        line('Module', [t.module, t.sub_tab].filter(Boolean).join(' › ')) +
        line('Channel', t.channel) +
        line('Support tier', t.support_tier) +
        line('JIRA', t.jira_id) +
        line('Requester', [t.requester_name, t.requester_email].filter(Boolean).join(' · ')) +
        line('Assignee', t.assignee) +
        line('Country', [t.country, t.timezone].filter(Boolean).join(' · ')) +
        describe(t.description) +
        (by ? `\n<i>Escalated by ${esc(by)}</i>` : '') +
        replyHint('ticket') +
        tag();
    const res = await sendMessage(msg);
    await trackRelay(res, { entity: 'ticket', entityId: t.id, reference: t.ticket_no, byUserId, by });
    return res;
}

/** Forward a feature request to the CTO chat with its demand + RICE detail. */
export async function relayFeatureToCto(f, { by, byUserId } = {}) {
    const msg =
        `💡 <b>Feature request — ${esc(f.ref || ('#' + f.id))}</b>\n` +
        `<b>${esc(f.title)}</b>\n\n` +
        line('Raised by', f.account) +
        line('Product area', f.product_area) +
        line('Status', f.status) +
        line('Impact', f.impact) +
        line('Effort', f.effort) +
        line('RICE', f.rice) +
        line('Demand', `${f.demand} (${f.supporterCount} backers · ${f.votes} votes)`) +
        describe(f.description) +
        (by ? `\n<i>Shared by ${esc(by)}</i>` : '') +
        replyHint('feature') +
        tag();
    const res = await sendMessage(msg);
    await trackRelay(res, { entity: 'feature', entityId: f.id, reference: f.ref || `#${f.id}`, byUserId, by });
    return res;
}

// ---- inbound: apply a responder's reply back to the record --------------------

const relayApi = (method) => `${config.telegram.apiBase}/bot${config.telegram.botToken}/${method}`;

// A plain-text reply in the group (never HTML — the responder's text is untrusted,
// so it can't inject markup). Optionally threaded to a specific message.
async function sendPlainReply(chatId, text, replyToMessageId) {
    try {
        const body = { chat_id: chatId, text, disable_web_page_preview: true };
        if (replyToMessageId) body.reply_to_message_id = replyToMessageId;
        await fetch(relayApi('sendMessage'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch (e) { console.error('[telegram] reply failed:', e.message); }
}

// Is this responder allowed to post updates? Only inside the configured group, and
// (if an allowlist is set) only listed ids/usernames.
function responderAllowed(from) {
    const allow = config.telegram.ctoAllowedIds;
    if (!allow.length) return true;
    const uname = String(from?.username || '').toLowerCase();
    const id = String(from?.id || '');
    return allow.includes(uname) || allow.includes(id);
}

const clip = (s, n) => (String(s || '').length > n ? String(s).slice(0, n) : String(s || ''));

// Apply the parsed update to the record, INSIDE the sharer's own scope (never
// god-mode), leaving a changelog line on the description. Returns { ok, summary }.
async function applyUpdate(relay, patch, note, responder) {
    // Who to act as: the person who shared it (preserves ABAC); fall back to an
    // admin only if that link is gone.
    let actor = relay.shared_by_user_id ? await userRepo.get(relay.shared_by_user_id) : null;
    if (!actor) actor = (await userRepo.list()).find((u) => u.role === 'admin');
    if (!actor) return { ok: false, error: 'No account to attribute this update to.' };

    const parts = Object.entries(patch).map(([k, v]) => `${k} → ${v}`);
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const changelog = `[Telegram update by ${responder} · ${stamp} UTC] ${parts.join(', ') || 'note'}${note ? `: ${clip(note, 500)}` : ''}`;

    if (relay.entity === 'ticket') {
        const cur = await supportRepo.get(relay.entity_id, actor);
        if (!cur) return { ok: false, error: 'That ticket is no longer accessible.' };
        const data = { ...patch, description: `${cur.description ? cur.description + '\n' : ''}${changelog}` };
        const r = await supportRepo.update(relay.entity_id, data, actor);
        if (r.forbidden || r.notFound) return { ok: false, error: 'Could not apply — the sharer no longer has access to that ticket.' };
        return { ok: true, summary: parts.join(', ') || 'note added' };
    }
    if (relay.entity === 'feature') {
        const cur = await featureRepo.get(relay.entity_id, actor);
        if (!cur) return { ok: false, error: 'That feature request is no longer accessible.' };
        const data = { ...patch, description: `${cur.description ? cur.description + '\n' : ''}${changelog}` };
        const r = await featureRepo.update(relay.entity_id, data, actor);
        if (r.forbidden || r.notFound) return { ok: false, error: 'Could not apply — the sharer no longer has access to that request.' };
        return { ok: true, summary: parts.join(', ') || 'note added' };
    }
    return { ok: false, error: 'Unknown record type.' };
}

// Tag the sharer in the group AND DM them via the assistant bot if they're linked.
async function notifySharer(relay, text, replyToMessageId) {
    let handle = relay.shared_by_name || 'there';
    let dmChat = null;
    if (relay.shared_by_user_id) {
        const links = await telegramRepo.listForUser(relay.shared_by_user_id).catch(() => []);
        if (links[0]?.username) handle = `@${links[0].username}`;
        if (links[0]?.telegram_id) dmChat = links[0].telegram_id;
    }
    await sendPlainReply(relay.chat_id, `${handle} — ${text}`, replyToMessageId);
    if (dmChat) await assistantDm(dmChat, `🔔 ${text}`); // best-effort DM
}

/**
 * Handle one inbound message on the relay bot. Only a REPLY, in the configured
 * group, to a message we sent, is ever actioned — everything else is ignored.
 */
export async function handleRelayReply(msg) {
    if (!msg || msg.from?.is_bot) return { ignored: 'bot' };            // ignore bots
    if (String(msg.chat?.id) !== String(config.telegram.ctoChatId)) return { ignored: 'other-chat' }; // only the CTO group
    const repliedTo = msg.reply_to_message;
    if (!repliedTo) return { ignored: 'not-a-reply' };                 // must be a reply
    const relay = await telegramRepo.findRelay(msg.chat.id, repliedTo.message_id);
    if (!relay) return { ignored: 'unknown-message' };                // not one of our records

    const responder = msg.from?.username ? `@${msg.from.username}` : (msg.from?.first_name || 'someone');
    if (!responderAllowed(msg.from)) {
        await sendPlainReply(msg.chat.id, `Sorry ${responder}, you're not authorised to update records here.`, msg.message_id);
        return { refused: true };
    }

    const parser = relay.entity === 'feature' ? parseFeatureUpdate : parseTicketUpdate;
    const parsed = parser(msg.text || '');
    if (!parsed.ok) {
        await sendPlainReply(msg.chat.id, `⚠️ ${relay.reference}: ${parsed.error}`, msg.message_id);
        return { ok: false, error: parsed.error };
    }

    const applied = await applyUpdate(relay, parsed.patch, parsed.note, responder);
    if (!applied.ok) {
        await sendPlainReply(msg.chat.id, `⚠️ ${relay.reference}: ${applied.error}`, msg.message_id);
        return { ok: false, error: applied.error };
    }
    await sendPlainReply(msg.chat.id, `✅ ${relay.reference} updated (${applied.summary}) by ${responder}.`, msg.message_id);
    await notifySharer(relay, `${relay.reference} was updated by ${responder}: ${applied.summary}${parsed.note ? ` — "${clip(parsed.note, 300)}"` : ''}.`, repliedTo.message_id);
    return { ok: true, summary: applied.summary, reference: relay.reference };
}

// ---- relay-bot long-poll loop (to receive replies) ---------------------------

let relayRunning = false;
let relayOffset = 0;

async function relayPollOnce() {
    const r = await fetch(relayApi('getUpdates') + `?timeout=30&offset=${relayOffset}&allowed_updates=["message"]`);
    const j = await r.json();
    if (!j.ok) { if (j.error_code === 409) console.error('[telegram-relay] getUpdates conflict'); return; }
    for (const u of j.result || []) {
        relayOffset = u.update_id + 1;
        try { await handleRelayReply(u.message); }
        catch (e) { console.error('[telegram-relay] handler error:', e?.message || e); }
    }
}

/** Start listening for update-replies in the CTO group. No-op if the relay isn't configured. */
export async function startRelayListener() {
    if (!config.telegram.enabled) return;
    if (relayRunning) return;
    try {
        const me = await (await fetch(relayApi('getMe'))).json();
        if (!me.ok) { console.error('[telegram-relay] invalid TELEGRAM_BOT_TOKEN — listener not started'); return; }
        await fetch(relayApi('deleteWebhook') + '?drop_pending_updates=false').catch(() => {});
        relayRunning = true;
        console.log(`[telegram-relay] listening for updates as @${me.result.username}`);
        (async () => {
            while (relayRunning) {
                try { await relayPollOnce(); }
                catch (e) { console.error('[telegram-relay] poll error:', e?.message || e); await sleep(2000); }
            }
        })();
    } catch (e) { console.error('[telegram-relay] failed to start:', e?.message || e); }
}

export function stopRelayListener() { relayRunning = false; }

export const telegramService = { sendMessage, relayTicketToCto, relayFeatureToCto, get enabled() { return config.telegram.enabled; } };
