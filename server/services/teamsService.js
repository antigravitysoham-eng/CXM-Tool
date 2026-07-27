import { config } from '../config.js';

/**
 * Microsoft Teams relay (one-way).
 *
 * Posts reported bugs and feature-request details into a Teams channel through an
 * Incoming Webhook (the classic Office 365 connector card / MessageCard format,
 * which Incoming Webhooks render natively). Deliberately one-way — Incoming
 * Webhooks can only receive, so there's no reply-to-update loop here (that needs a
 * Bot Framework bot). Fully env-gated on TEAMS_WEBHOOK_URL: every call is a
 * graceful no-op that reports why when the webhook isn't configured.
 *
 * Setup (once, by the operator): in Teams, target channel → ••• → Connectors →
 * Incoming Webhook → name it → copy the URL → put it in .env as TEAMS_WEBHOOK_URL.
 * The URL is a secret (anyone with it can post) — keep it in .env only.
 */

const truncate = (s, n) => (String(s || '').length > n ? String(s).slice(0, n - 1) + '…' : String(s || ''));

// Post a MessageCard to the configured webhook. Never throws.
async function postCard(card) {
    if (config.env === 'test') return { ok: false, disabled: true, reason: 'test' };
    if (!config.teams.enabled) {
        return { ok: false, disabled: true, reason: 'Teams is not configured — set TEAMS_WEBHOOK_URL in .env.' };
    }
    try {
        const res = await fetch(config.teams.webhookUrl, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(card)
        });
        // Incoming Webhooks answer "1" on success; anything else is an error body.
        const body = await res.text().catch(() => '');
        if (!res.ok) return { ok: false, reason: `Teams webhook returned ${res.status}: ${truncate(body, 200)}` };
        return { ok: true };
    } catch (err) {
        return { ok: false, reason: err.message || 'Teams request failed' };
    }
}

const fact = (name, value) => (value ? [{ name, value: String(value) }] : []);

function card({ color, title, subtitle, facts, description, by }) {
    return {
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        themeColor: color,
        summary: title,
        title,
        sections: [{
            activityTitle: subtitle,
            facts,
            text: [description ? truncate(description, 1200) : '', by ? `_Escalated by ${by}_` : ''].filter(Boolean).join('\n\n')
        }]
    };
}

/** Forward a (bug) support ticket into the Teams channel. */
export async function relayTicketToTeams(t, { by } = {}) {
    return postCard(card({
        color: 'D7263D',
        title: `🐞 Bug ticket — ${t.ticket_no}`,
        subtitle: t.subject,
        facts: [
            ...fact('Account', t.account),
            ...fact('Type', t.type),
            ...fact('Priority', t.priority),
            ...fact('Status', t.status),
            ...fact('Module', [t.module, t.sub_tab].filter(Boolean).join(' › ')),
            ...fact('Channel', t.channel),
            ...fact('Support tier', t.support_tier),
            ...fact('JIRA', t.jira_id),
            ...fact('Requester', [t.requester_name, t.requester_email].filter(Boolean).join(' · ')),
            ...fact('Assignee', t.assignee)
        ],
        description: t.description,
        by
    }));
}

/** Forward a feature request into the Teams channel. */
export async function relayFeatureToTeams(f, { by } = {}) {
    return postCard(card({
        color: '2AABEE',
        title: `💡 Feature request — ${f.ref || ('#' + f.id)}`,
        subtitle: f.title,
        facts: [
            ...fact('Raised by', f.account),
            ...fact('Product area', f.product_area),
            ...fact('Status', f.status),
            ...fact('Impact', f.impact),
            ...fact('Effort', f.effort),
            ...fact('RICE', f.rice),
            ...fact('Demand', `${f.demand} (${f.supporterCount} backers · ${f.votes} votes)`)
        ],
        description: f.description,
        by
    }));
}

export const teamsService = { relayTicketToTeams, relayFeatureToTeams, get enabled() { return config.teams.enabled; } };
