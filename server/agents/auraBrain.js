import { config } from '../config.js';
import { recommendCsm } from '../services/assignmentService.js';

// Computed brain for AURA (CLM). Reads the live contract book and speaks to
// renewals, risk, licensing, per-customer lifecycle, and CSM assignment advice.
// Pluggable for Claude later.

function fmt(amount, currency, fx = config.fxUsdInr) {
    const n = Math.round((currency === 'INR' ? amount : amount * fx) || 0);
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2).replace(/\.00$/, '')}Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(2).replace(/\.00$/, '')}L`;
    return `₹${n.toLocaleString('en-IN')}`;
}
const inr = (c) => (c.currency === 'INR' ? c.tcv : c.tcv * config.fxUsdInr) || 0;

export function auraRespond(message, { contracts = [], records = [] } = {}) {
    const q = String(message || '').toLowerCase().trim();
    const has = (...w) => w.some((x) => q.includes(x));
    const chips = ['Renewals in 90 days', "What's at risk?", 'Auto-renew exposure', 'Who should own this account?'];

    // CSM assignment advice — advisory, CX lead decides.
    if (has('assign', 'who should', 'which csm', 'recommend a csm', 'best csm', 'owner for')) {
        const account = [...new Set(records.map((r) => r.name))].find((a) => q.includes(a.toLowerCase()));
        const target = account
            ? (records.find((r) => r.name === account) || {})
            : {};
        const rec = recommendCsm({ industry: target.industry || '', tier: target.tier || '' }, records, contracts);
        if (!rec.recommended) return { reply: 'I have no CSM profiles to compare yet.', chips };
        const r = rec.recommended;
        const top3 = rec.ranked.slice(0, 3).map((p, i) => `${i + 1}. **${p.name}** (score ${p.score}) — ${p.reasons.join(', ')}`).join('\n');
        return {
            reply:
                `${account ? `For **${account}** (${target.industry || 'industry n/a'}, ${target.tier || 'tier n/a'}), ` : 'For a new account, '}` +
                `I'd recommend **${r.name}** — ${r.reasons.join(', ')}.\n\n${top3}\n\n_Advisory only — you make the final call._`,
            chips
        };
    }

    if (!q || has('help', 'what can you', 'who are you', 'hi', 'hello', 'hey')) {
        return {
            reply: `I'm **AURA** — I watch every active customer's contracts. Ask me what's renewing (90/60/30), what's at risk, auto-renew exposure, the license and deployment mix, or "tell me about <customer>" for their full picture. I raise the renewal triggers before they slip.`,
            chips
        };
    }

    if (has('renew', 'expiring', 'upcoming', 'due')) {
        const up = contracts.filter((c) => c.days_to_renewal !== null && c.days_to_renewal <= 90).sort((a, b) => a.days_to_renewal - b.days_to_renewal);
        if (!up.length) return { reply: 'Nothing renews in the next 90 days. Clear skies. 🔮', chips };
        const lines = up.map((c) => `• **${c.account}** (${c.id}) — ${c.days_to_renewal < 0 ? `${Math.abs(c.days_to_renewal)}d overdue` : `${c.days_to_renewal}d`}, ${fmt(c.tcv, c.currency)}${c.active_milestone && c.active_milestone !== 'overdue' ? ` [${c.active_milestone}-day trigger]` : ''}`).join('\n');
        return { reply: `${up.length} contract(s) renew within 90 days:\n${lines}`, chips };
    }

    if (has('risk', 'overdue', 'slip', 'churn')) {
        const risk = contracts.filter((c) => c.days_to_renewal !== null && c.days_to_renewal <= 30).sort((a, b) => a.days_to_renewal - b.days_to_renewal);
        if (!risk.length) return { reply: 'No contract is inside the critical 30-day window. 👍', chips };
        const atRisk = risk.reduce((s, c) => s + inr(c), 0);
        const lines = risk.map((c) => `• **${c.account}** — ${c.days_to_renewal < 0 ? 'OVERDUE' : `${c.days_to_renewal}d`}, ${fmt(c.tcv, c.currency)}${c.auto_renew ? ' (auto-renew)' : ''}`).join('\n');
        return { reply: `${risk.length} contract(s) in the critical window — ${fmt(atRisk, 'INR')} at risk:\n${lines}\n\nWant me to fire the renewal triggers?`, chips };
    }

    if (has('auto-renew', 'auto renew', 'autorenew')) {
        const ar = contracts.filter((c) => c.auto_renew);
        const exposure = ar.reduce((s, c) => s + inr(c), 0);
        return { reply: ar.length ? `${ar.length} contract(s) auto-renew, ${fmt(exposure, 'INR')} of exposure: ${ar.map((c) => c.account).join(', ')}. Watch their notice deadlines.` : 'No contracts are set to auto-renew.', chips };
    }

    if (has('license', 'perpetual', 'subscription')) {
        const sub = contracts.filter((c) => c.license_type === 'Subscription').length;
        const perp = contracts.filter((c) => c.license_type === 'Perpetual');
        const perpLines = perp.map((c) => `${c.account} (${c.perpetual_term_years || '?'}-yr)`).join(', ');
        return { reply: `License mix: ${sub} subscription, ${perp.length} perpetual${perp.length ? ` — ${perpLines}` : ''}.`, chips };
    }

    if (has('deployment', 'on-prem', 'on prem', 'saas', 'cloud')) {
        const saas = contracts.filter((c) => c.deployment === 'SaaS').length;
        const onprem = contracts.filter((c) => c.deployment === 'On-premise').length;
        return { reply: `Deployment: ${saas} SaaS, ${onprem} on-premise.`, chips };
    }

    if (has('value', 'tcv', 'arr', 'portfolio', 'book')) {
        const active = contracts.filter((c) => c.status === 'Active' || c.status === 'Renewing');
        const total = active.reduce((s, c) => s + inr(c), 0);
        return { reply: `Active contract value under management: ${fmt(total, 'INR')} across ${active.length} contract(s).`, chips };
    }

    // "tell me about <customer>"
    const account = [...new Set(contracts.map((c) => c.account))].find((a) => q.includes(a.toLowerCase()));
    if (account) {
        const cs = contracts.filter((c) => c.account === account);
        const total = cs.reduce((s, c) => s + inr(c), 0);
        const next = cs.filter((c) => c.days_to_renewal !== null && c.days_to_renewal >= 0).sort((a, b) => a.days_to_renewal - b.days_to_renewal)[0];
        return {
            reply: `**${account}** — ${cs.length} contract(s), ${fmt(total, 'INR')} total.\n` +
                `${next ? `Next renewal: ${next.renewal_date} (${next.days_to_renewal}d), ${next.deployment}, ${next.license_type}, billed ${next.billing_frequency}.` : 'No upcoming renewals.'}\n` +
                `SPOC: ${cs[0].spoc_name || 'unknown'} · CSM: ${cs[0].csm_name || 'unassigned'}`,
            chips
        };
    }

    if (has('mission', 'task', 'todo', 'what should')) {
        return { reply: 'Check the missions above — I surface renewals to prep, overdue notices, and auto-renew deadlines from the live contract book.', chips };
    }

    return { reply: `I'm sharpest on contracts and renewals. Try: what's renewing, what's at risk, auto-renew exposure, license mix, or "tell me about <customer>".`, chips };
}
