import { config } from '../config.js';
import { AGENTS } from './registry.js';
import { accountMissions } from './missions.js';

// NEO — the global orchestrator. Sees across every live module, briefs the user,
// and routes work to the right specialist agent.

function fmtInr(n) {
    const v = Math.round(n || 0);
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(2).replace(/\.00$/, '')}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(2).replace(/\.00$/, '')}L`;
    return `₹${v.toLocaleString('en-IN')}`;
}

export function neoRespond(message, { records = [], fx = config.fxUsdInr } = {}) {
    const q = String(message || '').toLowerCase().trim();
    const has = (...w) => w.some((x) => q.includes(x));
    const toInr = (a) => (a.value_currency === 'INR' ? a.value_amount : a.value_amount * fx) || 0;
    const chips = ["What needs attention?", 'Portal status', 'Who is on my team?'];

    if (has('who', 'team', 'roster', 'agents', 'squad')) {
        const online = AGENTS.filter((a) => a.online && a.key !== 'neo');
        const soon = AGENTS.filter((a) => !a.online);
        return {
            reply: `Your squad:\n${online.map((a) => `${a.emoji} **${a.name}** — ${a.tagline} (online)`).join('\n')}\n\n${soon.length} more coming online as we build their modules: ${soon.map((a) => a.name).join(', ')}.`,
            chips
        };
    }

    if (has('help', 'what can you', 'hi', 'hello', 'hey') && !q.includes('attention')) {
        return {
            reply: `I'm **NEO** — I see the whole board. I'll brief you on what needs attention across the portal, tell you which agents are online, and route work to the right specialist. Right now **Aukat** runs Cash Horizon for you.`,
            chips
        };
    }

    // Delegation
    const target = AGENTS.find((a) => a.online && a.key !== 'neo' && q.includes(a.name.toLowerCase()));
    if (target || has('cash horizon', 'deals', 'pipeline', 'accounts')) {
        return { reply: `That's **Aukat's** territory — head to Cash Horizon and ask directly, or tell me the goal and I'll keep the whole board in sync.`, chips };
    }

    if (has('status', 'portal', 'online', 'how is everything')) {
        const onlineCount = AGENTS.filter((a) => a.online).length;
        return { reply: `Portal status: **${onlineCount} agents online** (NEO + Aukat). ${AGENTS.length - onlineCount} specialists standing by. Cash Horizon is fully operational; other modules come online as we build them.`, chips };
    }

    // Default: the cross-portal brief (accounts today).
    const customers = records.filter((a) => a.segment === 'Customer');
    const prospects = records.filter((a) => a.segment === 'Prospect');
    const portfolio = customers.reduce((s, a) => s + toInr(a), 0);
    const weighted = prospects.reduce((s, a) => s + toInr(a) * (a.probability / 100), 0);
    const missions = accountMissions(records);
    const missionLines = missions.slice(0, 3).map((m) => `${m.emoji} ${m.title}`).join('\n') || '• Nothing urgent — nice work.';

    return {
        reply: `Here's your board:\n\n💹 **Cash Horizon** (Aukat): ${fmtInr(portfolio)} portfolio · ${fmtInr(weighted)} weighted forecast.\n\n**Top priorities:**\n${missionLines}\n\nAsk Aukat in Cash Horizon to act on any of these.`,
        chips
    };
}
