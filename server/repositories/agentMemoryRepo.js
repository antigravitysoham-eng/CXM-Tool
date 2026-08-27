import { getDb } from '../db.js';
import { AGENTS } from '../agents/registry.js';

/**
 * An agent's memory — what it has been asked, and how well it did.
 *
 * Every question that reaches `/neo/ask` is attributed to the specialist that
 * owns the intent that handled it, so "how much work has Aukat actually done"
 * has an answer rather than an impression. Two things are deliberately kept
 * apart here:
 *
 *   agent_interactions  — conversations. What people asked, what came back.
 *   agent_audit         — what delegated API-key agents did to the data.
 *
 * They answer different questions and conflating them would make both useless.
 */

const now = () => new Date().toISOString();

/** Handlers that mean "I could not answer that" rather than a real reply. */
const UNRESOLVED_INTENTS = new Set(['fallback', 'help']);

export const agentMemoryRepo = {
    /**
     * Record one exchange. Never throws: telemetry must not be able to break a
     * reply the user is waiting for.
     */
    async record({ agentKey, userId, prompt, intent, blocks = 0, ms = 0 }) {
        try {
            const db = await getDb();
            await db.run(
                `INSERT INTO agent_interactions (agent_key, user_id, prompt, intent, resolved, blocks, ms, at)
                 VALUES (?,?,?,?,?,?,?,?)`,
                [agentKey || 'neo', userId ?? null, String(prompt || '').slice(0, 500),
                    intent || 'unknown', UNRESOLVED_INTENTS.has(intent) ? 0 : 1, blocks, Math.round(ms), now()]
            );
        } catch (e) {
            console.error('agent telemetry write failed:', e.message);
        }
    },

    /** Headline counts for every agent at once — one query, for the roster. */
    async rosterStats() {
        const db = await getDb();
        const rows = await db.all(`
            SELECT agent_key,
                   COUNT(*)                                   AS asked,
                   SUM(resolved)                              AS resolved,
                   ROUND(AVG(ms))                             AS avgMs,
                   MAX(at)                                    AS lastAt
              FROM agent_interactions
             GROUP BY agent_key`);
        return Object.fromEntries(rows.map((r) => [r.agent_key, {
            asked: r.asked,
            resolved: r.resolved || 0,
            resolveRate: r.asked ? Math.round(((r.resolved || 0) / r.asked) * 100) : null,
            avgMs: r.avgMs || 0,
            lastAt: r.lastAt
        }]));
    },

    /**
     * Everything Agent HQ shows when a card is opened: the counts, the shape of
     * the last fortnight, what it is most often asked, and the recent exchanges.
     */
    async profile(agentKey) {
        const db = await getDb();
        const agent = AGENTS.find((a) => a.key === agentKey);
        if (!agent) return { notFound: true };

        const all = await db.all(
            'SELECT * FROM agent_interactions WHERE agent_key = ? ORDER BY id DESC', [agentKey]
        );
        const asked = all.length;
        const resolved = all.filter((r) => r.resolved).length;

        // Fourteen day-buckets so the card can draw a sparkline of how busy it
        // has been. Dates are compared as YYYY-MM-DD strings, which is safe for
        // ISO timestamps and avoids a timezone round-trip.
        const days = [];
        for (let i = 13; i >= 0; i--) {
            const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
            days.push({ day: d, count: all.filter((r) => String(r.at).slice(0, 10) === d).length });
        }

        const byIntent = {};
        for (const r of all) {
            const e = (byIntent[r.intent] ||= { intent: r.intent, count: 0, resolved: 0 });
            e.count += 1; e.resolved += r.resolved;
        }

        return {
            key: agent.key,
            name: agent.name,
            emoji: agent.emoji,
            color: agent.color,
            tagline: agent.tagline,
            module: agent.module || null,
            online: !!agent.online,
            stats: {
                asked,
                resolved,
                unresolved: asked - resolved,
                resolveRate: asked ? Math.round((resolved / asked) * 100) : null,
                avgMs: asked ? Math.round(all.reduce((s, r) => s + (r.ms || 0), 0) / asked) : null,
                firstAt: all.length ? all[all.length - 1].at : null,
                lastAt: all.length ? all[0].at : null,
                last7: all.filter((r) => r.at >= new Date(Date.now() - 7 * 864e5).toISOString()).length
            },
            activity: days,
            topIntents: Object.values(byIntent).sort((a, b) => b.count - a.count).slice(0, 6),
            recent: all.slice(0, 12).map((r) => ({
                prompt: r.prompt, intent: r.intent, resolved: !!r.resolved, ms: r.ms, at: r.at
            }))
        };
    }
};
