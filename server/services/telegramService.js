import { config } from '../config.js';

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

/** Forward a (bug) support ticket to the CTO chat with the full detail set. */
export async function relayTicketToCto(t, { by } = {}) {
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
        (t.description ? `\n${esc(t.description).slice(0, 900)}\n` : '') +
        (by ? `\n<i>Escalated by ${esc(by)}</i>` : '');
    return sendMessage(msg);
}

/** Forward a feature request to the CTO chat with its demand + RICE detail. */
export async function relayFeatureToCto(f, { by } = {}) {
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
        (f.description ? `\n${esc(f.description).slice(0, 900)}\n` : '') +
        (by ? `\n<i>Shared by ${esc(by)}</i>` : '');
    return sendMessage(msg);
}

export const telegramService = { sendMessage, relayTicketToCto, relayFeatureToCto, get enabled() { return config.telegram.enabled; } };
