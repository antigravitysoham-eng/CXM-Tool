import { accountRepo } from '../repositories/accountRepo.js';
import { contractRepo } from '../repositories/contractRepo.js';
import { documentRepo } from '../repositories/documentRepo.js';
import { supportRepo } from '../repositories/supportRepo.js';
import { onboardingRepo } from '../repositories/onboardingRepo.js';
import { trainingRepo } from '../repositories/trainingRepo.js';
import { healthRepo } from '../repositories/healthRepo.js';
import { ebrRepo } from '../repositories/ebrRepo.js';
import { surveyRepo } from '../repositories/surveyRepo.js';
import { journeyRepo } from '../repositories/journeyRepo.js';
import { featureRepo } from '../repositories/featureRepo.js';
import { expansionRepo } from '../repositories/expansionRepo.js';
import { commsRepo } from '../repositories/commsRepo.js';
import { eventRepo } from '../repositories/eventRepo.js';
import { referralRepo } from '../repositories/referralRepo.js';
import { canAccess, canUseModule } from './policyService.js';
import { relayTicketToCto, relayFeatureToCto } from './telegramService.js';
import { daysToRenewal } from './renewalService.js';
import { config } from '../config.js';
import { AGENTS, visibleAgents } from '../agents/registry.js';
import { SEGMENTS, SOURCES, REGIONS, STAGES } from '../validation/accountSchema.js';

// The field guide NEO shares over WhatsApp when an admin starts an add-account
// with no details yet. WhatsApp markdown (*bold*, • bullets). The copy-paste
// template is sent as a SEPARATE follow-up message (ACCOUNT_TEMPLATE_TEXT) so it
// can be copied, edited and pasted back in one tap.
const ACCOUNT_SCHEMA_TEXT = `📋 *Add a Cash Horizon account*

*Required:* Name
*Optional* (defaults applied):
• Segment — Customer / Prospect / Partner
• Stage — Lead / Qualified / POC / Negotiation / Closed / Lost
• Value — e.g. 50L or 2Cr (INR/USD)
• Region — India / APAC / EMEA / AMER / ANZ / LATAM / MEA
• Industry — free text
• Owner — sales owner
• Probability — 0–100

_(CSM is assigned later in CLM, once the deal closes.)_

👇 Copy the template below, edit the values, and send it back.`;

// The editable template — sent on its own so the whole message copies cleanly.
// No CSM here: CSM assignment happens in CLM after the deal is won.
const ACCOUNT_TEMPLATE_TEXT = `add account
name: Acme Capital
segment: Prospect
stage: Qualified
value: 50L
region: APAC
industry: Fintech
owner: Priya Sharma
probability: 40`;

// Parse "field: value" pairs (and money like 50L / 2Cr) out of a message, so the
// admin can send either natural language or a structured fill.
function parseMoneyToken(s) {
    const m = String(s).match(/([\d.,]+)\s*(cr|crore|l|lakh|k)?/i);
    if (!m) return null;
    let n = parseFloat(m[1].replace(/,/g, ''));
    if (Number.isNaN(n)) return null;
    const u = (m[2] || '').toLowerCase();
    if (u.startsWith('cr')) n *= 1e7; else if (u.startsWith('l')) n *= 1e5; else if (u === 'k') n *= 1e3;
    return { amount: Math.round(n), currency: /usd|\$/i.test(s) ? 'USD' : 'INR' };
}
function parseAccountFields(text) {
    const t = String(text || '');
    const field = (labels) => {
        const m = t.match(new RegExp(`\\b(?:${labels})\\s*[:=]\\s*"?([^",;\\n]+)`, 'i'));
        return m ? m[1].trim().replace(/^"|"$/g, '') : '';
    };
    const out = {};
    const pick = (val, list) => list.find((x) => x.toLowerCase() === val.toLowerCase());
    const name = field('name|account|customer|company'); if (name) out.name = name;
    const seg = field('segment|type'); if (seg && pick(seg, SEGMENTS)) out.segment = pick(seg, SEGMENTS);
    const stage = field('stage'); if (stage && pick(stage, STAGES)) out.stage = pick(stage, STAGES);
    const region = field('region'); if (region && pick(region, REGIONS)) out.region = pick(region, REGIONS);
    const source = field('source'); if (source && pick(source, SOURCES)) out.source = pick(source, SOURCES);
    const industry = field('industry|sector'); if (industry) out.industry = industry;
    const owner = field('owner|sales owner|sales_owner'); if (owner) out.sales_owner = owner;
    const prob = field('probability|prob'); if (prob) { const n = parseInt(prob, 10); if (!Number.isNaN(n)) out.probability = Math.min(100, Math.max(0, n)); }
    const val = field('value|amount|deal|tcv'); if (val) { const mv = parseMoneyToken(val); if (mv) { out.value_amount = mv.amount; out.value_currency = mv.currency; } }
    const cur = field('currency'); if (cur && /usd|\$/i.test(cur)) out.value_currency = 'USD';
    return out;
}

// ── Report period parsing (WhatsApp) ────────────────────────────────────────
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const MO_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const isoDate = (y, mo, d) => { const dt = new Date(Date.UTC(y, mo, d)); return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10); };
const fmtDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${+d} ${MO_SHORT[+m - 1]} ${y}`; };

// Parse a human date ("21 May 2025", "21st June 2026", "21/05/2025", ISO, "May 21 2025").
function parseNaturalDate(s) {
    const t = String(s || '').trim().toLowerCase().replace(/(\d+)(st|nd|rd|th)/g, '$1');
    let m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return isoDate(+m[1], +m[2] - 1, +m[3]);
    m = t.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/); // DD/MM/YYYY
    if (m && +m[2] >= 1 && +m[2] <= 12) return isoDate(+m[3], +m[2] - 1, +m[1]);
    m = t.match(/\b(\d{1,2})\s+([a-z]{3,})\s+(\d{4})\b/); // 21 may 2025
    if (m && MONTHS[m[2].slice(0, 3)] !== undefined) return isoDate(+m[3], MONTHS[m[2].slice(0, 3)], +m[1]);
    m = t.match(/\b([a-z]{3,})\s+(\d{1,2}),?\s+(\d{4})\b/); // may 21 2025
    if (m && MONTHS[m[1].slice(0, 3)] !== undefined) return isoDate(+m[3], MONTHS[m[1].slice(0, 3)], +m[2]);
    return null;
}

function quarterRange(q, year, today) {
    const startMonth = (q - 1) * 3;
    const from = isoDate(year, startMonth, 1);
    const lastDay = new Date(Date.UTC(year, startMonth + 3, 0)).getUTCDate();
    let to = isoDate(year, startMonth + 2, lastDay);
    const started = from <= today;
    const fullyPast = to <= today;
    if (!started) return { future: true, from, to };
    if (!fullyPast) to = today;                 // partial quarter → clamp to today
    return { from, to, partial: !fullyPast };
}

/**
 * Work out the reporting period from a WhatsApp message. Returns one of:
 *  { kind:'all'|'ytd'|'quarter'|'custom', from, to, label }
 *  { kind:'none' }                       → no period given, show the picker
 *  { error }                             → a bad request (future quarter, backwards range)
 * All future dates are clamped to today; quarters are computed for the current year.
 */
function resolveReportPeriod(prompt) {
    const raw = String(prompt || '');
    const p = raw.toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    const year = new Date().getFullYear();

    // 1) Custom range: "<date> to|through|until|– <date>".
    const sep = raw.match(/([\w\s/,-]+?)\s+(?:to|through|until|till|thru)\s+([\w\s/,-]+)/i) || raw.match(/([\w\s/,]+?)\s*[–—]\s*([\w\s/,]+)/);
    if (sep) {
        const from = parseNaturalDate(sep[1]);
        const to = parseNaturalDate(sep[2]);
        if (from && to) {
            if (from > to) return { error: `That range is backwards — the start (${fmtDate(from)}) is after the end (${fmtDate(to)}). Send it as *start to end*.` };
            if (from > today) return { error: `The start date (${fmtDate(from)}) is in the future — pick a start on or before today.` };
            const clamped = to > today ? today : to;
            return { kind: 'custom', from, to: clamped, label: `${fmtDate(from)} → ${fmtDate(clamped)}${to > today ? ' (clamped to today)' : ''}` };
        }
    }

    // 2) Quarter (Q1–Q4 or "first/second/third/fourth quarter").
    let q = null;
    const qm = p.match(/\bq\s*([1-4])\b/);
    if (qm) q = +qm[1];
    else { const w = { first: 1, second: 2, third: 3, fourth: 4 }; const wm = p.match(/\b(first|second|third|fourth)\s+quarter\b/); if (wm) q = w[wm[1]]; }
    if (q) {
        const r = quarterRange(q, year, today);
        if (r.future) return { error: `Q${q} ${year} hasn't started yet — it begins ${fmtDate(r.from)}. Try Q1–Q3, a custom range, or *all*.` };
        return { kind: 'quarter', from: r.from, to: r.to, label: `Q${q} ${year}${r.partial ? ' (so far)' : ''}` };
    }

    // 3) All-time / year-to-date.
    if (/\ball[\s-]?time\b|\beverything\b|\bentire\b|\ball\b/.test(p)) return { kind: 'all', from: '', to: '', label: 'All time' };
    if (/\bytd\b|year[\s-]?to[\s-]?date|this year|\bannual\b|full year/.test(p)) return { kind: 'ytd', from: isoDate(year, 0, 1), to: today, label: `${year} year-to-date` };

    return { kind: 'none' };
}

// The period picker NEO shows when a report is asked for with no span.
function reportPeriodMenu(label) {
    const today = new Date().toISOString().slice(0, 10);
    const year = new Date().getFullYear();
    const line = (q) => {
        const r = quarterRange(q, year, today);
        const range = `${fmtDate(r.from)}–${fmtDate(r.future ? r.to : (r.partial ? r.to : r.to))}`;
        const note = r.future ? ' _(not started)_' : r.partial ? ' _(so far)_' : '';
        return `• *Q${q}* — ${range}${note}`;
    };
    return `📊 *${label} report* — which period?\n\n`
        + `Reply with *${label} report* + one of:\n`
        + `• *All* — everything on record\n`
        + `${line(1)}\n${line(2)}\n${line(3)}\n${line(4)}\n`
        + `• *Custom* — a date range\n\n`
        + `Examples:\n_"${label} report Q2"_\n_"${label} report 21 May 2025 to 30 Jun 2026"_`;
}

/**
 * NEO — the brain behind the GPT view.
 *
 * ask() turns a prompt into a reply plus render *blocks* (stats, charts, tables)
 * that the client draws with the same components as the dashboard, so both views
 * show the same numbers from the same source.
 *
 * Interpretation is deliberately separated from execution:
 *   interpret(prompt) -> { intent, entities }   <- swappable (rules today, Claude later)
 *   HANDLERS[intent](entities, user)            <- always ours, always ABAC-scoped
 * Only interpretation would move to an LLM. Data access stays here, so a model
 * can never widen what a user is allowed to see.
 */

// ---- block helpers -----------------------------------------------------------
const text = (t) => ({ type: 'text', text: t });
const stats = (items) => ({ type: 'stats', items });
const chart = (variant, title, data, opts = {}) => ({ type: 'chart', variant, title, data, ...opts });
const table = (title, columns, rows) => ({ type: 'table', title, columns, rows });

const FX = config.fxUsdInr;
const inr = (a, c) => (c === 'USD' ? (Number(a) || 0) * FX : Number(a) || 0);

function money(n) {
    const v = Math.round(Number(n) || 0);
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(2).replace(/\.00$/, '')}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(2).replace(/\.00$/, '')}L`;
    return `₹${v.toLocaleString('en-IN')}`;
}

const countBy = (rows, key) => rows.reduce((acc, r) => {
    const k = typeof key === 'function' ? key(r) : r[key];
    if (k) acc[k] = (acc[k] || 0) + 1;
    return acc;
}, {});

const toChartData = (obj) => Object.entries(obj).map(([name, value]) => ({ name, value }));

// Contracts are scoped inside the repository (it refuses to run without a user),
// so this is just the call-shape the handlers want.
const scopedContracts = (user, filters = {}) => contractRepo.list(filters, user);

// ---- entity extraction -------------------------------------------------------
const findIn = (list, prompt) => list.find((v) => new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(prompt));

// "50L" / "2.5 cr" / "$400k" -> { amount, currency }
function parseMoney(prompt) {
    const m = /(?:₹|rs\.?\s*|inr\s*)?(\$|usd\s*)?\s*(\d+(?:\.\d+)?)\s*(cr|crore[s]?|l|lakh[s]?|k|m|mn|million)?\b/i.exec(prompt);
    if (!m) return null;
    const usd = Boolean(m[1]) || /\busd|\$/i.test(prompt);
    const n = parseFloat(m[2]);
    const unit = (m[3] || '').toLowerCase();
    const mult = unit.startsWith('cr') ? 1e7
        : unit.startsWith('l') ? 1e5
            : unit === 'k' ? 1e3
                : (unit === 'm' || unit === 'mn' || unit === 'million') ? 1e6 : 1;
    const amount = Math.round(n * mult);
    // A bare small number is far more likely a count ("top 5") than a deal value.
    if (!unit && amount < 1000) return null;
    return { amount, currency: usd ? 'USD' : 'INR' };
}

function parseAccountName(prompt) {
    const quoted = /["“']([^"”']{2,60})["”']/.exec(prompt);
    if (quoted) return quoted[1].trim();
    const after = /\b(?:account|prospect|customer|partner|company|deal|named|called|about|for)\s+(?:named\s+|called\s+)?([A-Z][\w&.\-]*(?:\s+[A-Z][\w&.\-]*){0,3})/.exec(prompt);
    return after ? after[1].trim() : null;
}

// ---- interpretation (the swappable seam) ------------------------------------
// Note: no trailing \b on word stems — "renew" must also match "renews"/"renewal",
// and "document" must match "documents". Anchoring the create verb to the start
// keeps a question like "how many new customers?" from reading as a command.
const INTENT_RULES = [
    // A greeting gets a warm hospitality welcome before anything else.
    { intent: 'greeting', re: /^\s*(hi|hey|hello|hiya|yo|howdy|namaste|greetings|good\s+(morning|afternoon|evening|day))\b[\s!.]*$/i },
    // Pure gratitude / sign-off — a warm, professional acknowledgement. Anchored to
    // the whole message (allowing courtesy trailers like "so much" / "for your help")
    // so "thanks, now show the pipeline" still routes to the pipeline, not here.
    { intent: 'thanks', re: /^\s*(thanks?|thank\s*you|thank\s*u|thankyou|thx|tysm|ty|much\s+appreciated|appreciate\s+it|cheers|great\s+(job|work|stuff)|well\s+done|nice\s+(job|work)|good\s+(job|work)|awesome|perfect|brilliant|amazing|superb|lovely|that('?s| is)\s+(great|helpful|perfect|awesome|amazing)|bye|goodbye|good\s*night|see\s+(ya|you)|take\s+care|👍|🙏|❤️|🙌)(\s+(so\s+much|very\s+much|a\s+lot|a\s+ton|heaps|mate|buddy|much|guys?|team|neo|for\s+(your\s+)?(help|the\s+help|that|everything)))*[\s!.…]*$/i },
    // Escalate a ticket / feature to the CTO over Telegram ("send TIC-0007 to the CTO",
    // "forward FR-0003 to telegram"). Placed above the id-lookups so the escalation wins.
    { intent: 'escalate_cto', re: /(?:\b(?:escalat\w*|forward|send|notify|share|ping|pass(?:\s+on)?|route)\b[\s\S]*\b(?:cto|telegram)\b)|(?:\b(?:cto|telegram)\b[\s\S]*(?:tic-?\d+|fr-?\d+))|(?:(?:tic-?\d+|fr-?\d+)[\s\S]*\b(?:cto|telegram)\b)/i },
    // Retrieve a specific ticket / feature request by its reference id.
    { intent: 'ticket_lookup', re: /\btic-?\d+/i },
    { intent: 'feature_lookup', re: /\bfr-?\d+/i },
    // "send the CLM report", "pipeline pdf" → an executive PDF (module picked in the handler).
    { intent: 'report', re: /\b(reports?|pdf)\b/i },
    { intent: 'create_account', re: /^\s*(?:please\s+|can you\s+|could you\s+)?(add|create|register|log)\b[\s\S]*\b(account|prospect|customer|partner|deal|lead)\b/i },
    { intent: 'renewals', re: /\b(renew|expir|at risk|churn)/i },
    { intent: 'support', re: /\b(support|ticket|sla|escalat|helpdesk|help desk)/i },
    // Specialist agents — placed before the generic account/pipeline rules so a
    // module question routes to its owner, not to the pipeline fallback.
    { intent: 'onboarding', re: /\b(onboard|kick.?off|go.?live|implementation|time.to.value|ttv)/i },
    { intent: 'training', re: /\b(training|enablement|certif|course|workshop|enrol|learner)/i },
    { intent: 'health', re: /\b(health check|health score|account health|unhealthy|red account|amber account|worsening|at.risk account)/i },
    { intent: 'ebrs', re: /\b(ebr|qbr|business review|executive review)/i },
    { intent: 'surveys', re: /\b(nps|csat|\bces\b|survey|voice of|detractor|promoter)/i },
    { intent: 'journey', re: /\b(journey|lifecycle|adoption|drop.?off|customers? stall)/i },
    { intent: 'features', re: /\b(feature request|feature|roadmap|product feedback|rice)/i },
    { intent: 'upsells', re: /\b(upsell|cross.?sell|expansion|net revenue|nrr)/i },
    { intent: 'comms', re: /\b(comms|campaign|newsletter|announcement|open rate|click rate)/i },
    { intent: 'events', re: /\b(event|webinar|user group)/i },
    { intent: 'referrals', re: /\b(referral|advocate|advocacy|case study|reference)/i },
    { intent: 'documents', re: /\b(document|doc|contract file|agreement|nda|msa|paperwork)/i },
    { intent: 'pipeline_by_stage', re: /\b(stage|funnel)\b/i },
    { intent: 'by_region', re: /\b(region|geography|apac|emea|amer|anz|latam|mea|india)\b/i },
    { intent: 'by_owner', re: /\b(owner|rep|who owns|by owner|sales team)\b/i },
    { intent: 'meddicc', re: /\b(meddicc|qualification|qualified)\b/i },
    { intent: 'top_accounts', re: /\b(top|biggest|largest|best)\b/i },
    { intent: 'account_lookup', re: /\b(tell me about|show me|look ?up|details? (?:on|for|about)|who is|what about)\b/i },
    { intent: 'pipeline', re: /\b(pipeline|overview|summary|how are we|brief|status|numbers|dashboard)\b/i },
    { intent: 'help', re: /\b(help|what can you do|capabilities|menu|options|guide me)\b/i }
];

/**
 * Prompt -> { intent, entities }.
 *
 * Rule-based today. When an LLM key is configured this is where a Claude call
 * would slot in, returning the same shape — every handler below stays untouched.
 */
function ruleInterpret(prompt) {
    const p = String(prompt || '').trim();
    const hit = INTENT_RULES.find((r) => r.re.test(p));
    const entities = {
        prompt: p, // kept so handlers can do data-driven extraction (e.g. industry)
        name: parseAccountName(p),
        segment: findIn(SEGMENTS, p),
        source: findIn(SOURCES, p),
        region: findIn(REGIONS, p),
        stage: findIn(STAGES, p),
        money: parseMoney(p),
        limit: (/\btop\s+(\d+)/i.exec(p) || [])[1],
        days: (/\b(\d+)\s*days?\b/i.exec(p) || [])[1]
    };
    return { intent: hit?.intent || 'fallback', entities };
}

export async function interpret(prompt) {
    // Seam: with an Anthropic key we'd ask Claude for {intent, entities} here and
    // fall back to rules on any error. Nothing else in this file would change.
    return ruleInterpret(prompt);
}

// ---- access model -----------------------------------------------------------
// The module whose access governs each intent. A user who can't use the module
// gets a denial instead of the handler running. Uses modules the role seed
// actually grants (documents rides on 'contracts') so nothing regresses.
// help/fallback are omitted (global — always allowed).
const INTENT_MODULE = {
    pipeline: 'accounts', pipeline_by_stage: 'accounts', by_region: 'accounts',
    by_owner: 'accounts', top_accounts: 'accounts', meddicc: 'accounts',
    account_lookup: 'accounts', create_account: 'accounts',
    renewals: 'contracts', documents: 'contracts', support: 'support', ticket_lookup: 'support',
    onboarding: 'onboarding', training: 'training', health: 'health-checks',
    ebrs: 'ebrs', surveys: 'surveys', journey: 'journey', features: 'feature-requests',
    feature_lookup: 'feature-requests',
    upsells: 'upsells', comms: 'comms', events: 'events', referrals: 'referrals'
};
const MODULE_LABEL = {
    accounts: 'Accounts', contracts: 'Renewals', support: 'Support', documents: 'Documents',
    onboarding: 'Onboarding', training: 'Training', 'health-checks': 'Health Checks',
    ebrs: 'EBRs', surveys: 'Surveys', journey: 'Journey', 'feature-requests': 'Feature Requests',
    upsells: 'Upsells', comms: 'Comms', events: 'Events', referrals: 'Referrals'
};

// Report-facing labels — the names users actually call each area (matching the
// sidebar), distinct from MODULE_LABEL which is tuned for the agent/denial voice
// (e.g. contracts reads as "Renewals" there, but its report is the CLM report).
const REPORT_LABEL = {
    accounts: 'Cash Horizon', contracts: 'CLM', support: 'Support', onboarding: 'Onboarding',
    training: 'Training', 'health-checks': 'Health Checks', ebrs: 'EBR', surveys: 'Surveys',
    journey: 'Journey', 'feature-requests': 'Feature Requests', upsells: 'Upsells',
    comms: 'Communications', events: 'Events', referrals: 'Referrals', documents: 'Documents'
};

// Which module's report a request wants — first match wins, else the accounts
// (pipeline) executive report. Keys match the module registry AND policy names.
const REPORT_MAP = [
    ['contracts', /\b(clm|contract|renewal)/i],
    ['support', /\b(support|ticket|sla|desk)/i],
    ['onboarding', /\bonboard/i],
    ['training', /\b(training|enablement|certif|course)/i],
    ['health-checks', /\bhealth/i],
    ['ebrs', /\b(ebr|qbr|business review)/i],
    ['surveys', /\b(nps|csat|survey|voice of)/i],
    ['journey', /\b(journey|lifecycle|adoption)/i],
    ['feature-requests', /\bfeature/i],
    ['upsells', /\b(upsell|cross.?sell|expansion)/i],
    ['comms', /\b(comms|campaign|newsletter)/i],
    ['events', /\b(event|webinar)/i],
    ['documents', /\bdocument/i],
    ['accounts', /\b(pipeline|cash.?horizon|account|sales|revenue|deal)/i]
];

// The help menu, grouped by the module that gates each group.
const HELP_MENU = [
    { module: 'accounts', asks: [
        ["How's the pipeline?", 'Open value, weighted, stage mix'],
        ['Top 5 accounts', 'Ranked by value'],
        ['Break it down by region', 'Regional split'],
        ['MEDDICC health', 'Qualification scores, weak deals'],
        ['Tell me about Bajaj Finserv', 'Full account profile']
    ] },
    { module: 'contracts', asks: [
        ['What renews in 60 days?', 'Renewals, value at risk, CSMs'],
        ['Documents for Muthoot Finance', 'Their library']
    ] },
    { module: 'support', asks: [
        ['How are my support tickets?', 'Open tickets, SLA health, breaches']
    ] },
    { module: 'onboarding', asks: [['How is onboarding going?', 'In-progress, at-risk, time-to-value']] },
    { module: 'health-checks', asks: [['Which accounts are unhealthy?', 'Red/amber, overdue, worsening']] },
    { module: 'upsells', asks: [['Show the expansion pipeline', 'Open, weighted forecast, win rate']] },
    { module: 'training', asks: [['Training progress?', 'Enrolled, completion, certified']] },
    { module: 'surveys', asks: [['What is our NPS?', 'NPS/CSAT, responses, detractors']] },
    { module: 'ebrs', asks: [['EBR coverage this quarter', 'Generated, shared, pending']] },
    { module: 'journey', asks: [['Where are customers stalling?', 'Journey stage, stalled, at risk']] },
    { module: 'feature-requests', asks: [['Top feature requests', 'Demand, status, RICE']] },
    { module: 'comms', asks: [['Campaign performance', 'Sent, open rate, click rate']] },
    { module: 'events', asks: [['Upcoming events', 'Registered, attendance']] },
    { module: 'referrals', asks: [['Referral pipeline', 'Converted, value, advocates']] }
];

// ---- handlers ----------------------------------------------------------------
const HANDLERS = {
    async pipeline(_e, user) {
        const accounts = await accountRepo.list(user);
        const open = accounts.filter((a) => a.segment === 'Prospect');
        const customers = accounts.filter((a) => a.segment === 'Customer');
        const pipelineValue = open.reduce((s, a) => s + inr(a.value_amount, a.value_currency), 0);
        const weighted = open.reduce((s, a) => s + inr(a.value_amount, a.value_currency) * (a.probability / 100), 0);
        const won = customers.reduce((s, a) => s + inr(a.value_amount, a.value_currency), 0);

        return {
            reply: open.length || customers.length
                ? `You're carrying ${money(pipelineValue)} of open pipeline across ${open.length} prospects, weighted to ${money(weighted)}. ${customers.length} live customers represent ${money(won)}.`
                : 'I cannot see any accounts in your scope yet.',
            blocks: [
                stats([
                    { label: 'Open pipeline', value: money(pipelineValue), hint: `${open.length} prospects`, accent: '#818cf8' },
                    { label: 'Weighted', value: money(weighted), hint: 'by probability', accent: '#38bdf8' },
                    { label: 'Customers', value: String(customers.length), hint: money(won), accent: '#34d399' },
                    { label: 'Partners', value: String(accounts.filter((a) => a.segment === 'Partner').length), hint: 'sourcing', accent: '#fbbf24' }
                ]),
                chart('bar', 'Pipeline by stage', toChartData(countBy(open, 'stage')))
            ]
        };
    },

    async pipeline_by_stage(_e, user) {
        const accounts = await accountRepo.list(user);
        const open = accounts.filter((a) => a.segment === 'Prospect');
        const byStage = {};
        for (const a of open) {
            byStage[a.stage] = byStage[a.stage] || { name: a.stage, value: 0, count: 0 };
            byStage[a.stage].value += inr(a.value_amount, a.value_currency);
            byStage[a.stage].count += 1;
        }
        const data = Object.values(byStage);
        const top = [...data].sort((x, y) => y.value - x.value)[0];
        return {
            reply: top
                ? `${open.length} open deals across ${data.length} stages. The heaviest is ${top.name} at ${money(top.value)} over ${top.count} deals.`
                : 'No open deals in your scope.',
            blocks: [
                chart('bar', 'Value by stage', data, { valueFormat: 'money' }),
                table('Stages', ['Stage', 'Deals', 'Value'], data.map((d) => [d.name, d.count, money(d.value)]))
            ]
        };
    },

    async by_region(_e, user) {
        const accounts = await accountRepo.list(user);
        const byRegion = {};
        for (const a of accounts) {
            const r = a.region || 'Unassigned';
            byRegion[r] = byRegion[r] || { name: r, value: 0, count: 0 };
            byRegion[r].value += inr(a.value_amount, a.value_currency);
            byRegion[r].count += 1;
        }
        const data = Object.values(byRegion).sort((x, y) => y.value - x.value);
        return {
            reply: data.length
                ? `Your book spans ${data.length} regions. ${data[0].name} leads with ${data[0].count} accounts worth ${money(data[0].value)}.`
                : 'No accounts in your scope.',
            blocks: [
                chart('pie', 'Accounts by region', data.map((d) => ({ name: d.name, value: d.count }))),
                table('Regions', ['Region', 'Accounts', 'Value'], data.map((d) => [d.name, d.count, money(d.value)]))
            ]
        };
    },

    async by_owner(_e, user) {
        const accounts = await accountRepo.list(user);
        const byOwner = {};
        for (const a of accounts) {
            const o = a.sales_owner || 'Unassigned';
            byOwner[o] = byOwner[o] || { name: o, value: 0, count: 0 };
            byOwner[o].value += inr(a.value_amount, a.value_currency);
            byOwner[o].count += 1;
        }
        const data = Object.values(byOwner).sort((x, y) => y.value - x.value);
        return {
            reply: data.length ? `${data.length} owners across ${accounts.length} accounts.` : 'No accounts in your scope.',
            blocks: [
                chart('bar', 'Value by owner', data, { valueFormat: 'money' }),
                table('Owners', ['Owner', 'Accounts', 'Value'], data.map((d) => [d.name, d.count, money(d.value)]))
            ]
        };
    },

    async top_accounts(e, user) {
        const limit = Math.min(Number(e.limit) || 5, 20);
        const accounts = await accountRepo.list(user);
        const ranked = [...accounts]
            .filter((a) => a.segment !== 'Partner')
            .sort((x, y) => inr(y.value_amount, y.value_currency) - inr(x.value_amount, x.value_currency))
            .slice(0, limit);
        return {
            reply: ranked.length ? `Your top ${ranked.length} accounts by value:` : 'No accounts in your scope.',
            blocks: [
                chart('bar', `Top ${ranked.length} by value`, ranked.map((a) => ({ name: a.name, value: inr(a.value_amount, a.value_currency) })), { valueFormat: 'money', layout: 'vertical' }),
                table('Accounts', ['Account', 'Segment', 'Stage', 'Region', 'Value'],
                    ranked.map((a) => [a.name, a.segment, a.stage, a.region || '—', money(inr(a.value_amount, a.value_currency))]))
            ]
        };
    },

    async renewals(e, user) {
        const within = Number(e.days) || 90;
        const contracts = await scopedContracts(user);
        const due = contracts
            .map((c) => ({ ...c, days: daysToRenewal(c) }))
            .filter((c) => c.days !== null && c.days >= 0 && c.days <= within)
            .sort((a, b) => a.days - b.days);
        const value = due.reduce((s, c) => s + inr(c.tcv, c.currency), 0);
        const buckets = { '0-30': 0, '31-60': 0, '61-90': 0 };
        for (const c of due) {
            if (c.days <= 30) buckets['0-30'] += 1;
            else if (c.days <= 60) buckets['31-60'] += 1;
            else buckets['61-90'] += 1;
        }
        return {
            reply: due.length
                ? `${due.length} contracts renew within ${within} days, carrying ${money(value)}. The nearest is ${due[0].account} in ${due[0].days} days.`
                : `Nothing renews in the next ${within} days within your scope.`,
            blocks: [
                stats([
                    { label: 'Renewals due', value: String(due.length), hint: `within ${within} days`, accent: '#fbbf24', variant: 'kri' },
                    { label: 'Value at risk', value: money(value), hint: 'total TCV', accent: '#f87171', variant: 'kri' },
                    { label: 'Inside 30 days', value: String(buckets['0-30']), hint: 'act now', accent: '#f87171', variant: 'kri' }
                ]),
                ...(due.length ? [
                    chart('bar', 'Renewal windows', toChartData(buckets)),
                    table('Due', ['Account', 'Contract', 'Days', 'Value', 'CSM'],
                        due.slice(0, 12).map((c) => [c.account, c.id, `${c.days}d`, money(inr(c.tcv, c.currency)), c.csm_name || '—']))
                ] : [])
            ]
        };
    },

    async documents(e, user) {
        const filters = e.name ? { account: e.name } : {};
        const docs = await documentRepo.list(user, filters);
        const s = await documentRepo.stats(user, filters);
        if (!docs.length) {
            return {
                reply: e.name
                    ? `No documents filed against ${e.name} — either the library is empty or that account is outside your access.`
                    : 'No documents in your scope yet.',
                blocks: []
            };
        }
        return {
            reply: `${s.total} documents${e.name ? ` for ${e.name}` : ` across ${s.accounts} accounts`} — ${s.files} stored files and ${s.links} links.`,
            blocks: [
                chart('pie', 'By category', toChartData(s.byCategory)),
                table('Documents', ['Name', 'Type', 'Account', 'Version', 'Filed'],
                    docs.slice(0, 12).map((d) => [d.name, d.doc_type, d.account, d.version, (d.created_at || '').slice(0, 10)]))
            ]
        };
    },

    async meddicc(_e, user) {
        const accounts = await accountRepo.list(user);
        const open = accounts.filter((a) => a.segment === 'Prospect');
        if (!open.length) return { reply: 'No open deals to qualify.', blocks: [] };
        const avg = open.reduce((s, a) => s + a.meddicc_score, 0) / open.length;
        const weak = open.filter((a) => a.meddicc_score <= 3).sort((x, y) => x.meddicc_score - y.meddicc_score);
        return {
            reply: `Average MEDDICC across ${open.length} open deals is ${avg.toFixed(1)}/7. ${weak.length} deals are at 3 or below — those are the ones carrying risk.`,
            blocks: [
                stats([
                    { label: 'Avg MEDDICC', value: avg.toFixed(1), hint: 'out of 7', accent: '#818cf8' },
                    { label: 'Weak deals', value: String(weak.length), hint: 'score ≤ 3', accent: '#f87171', variant: 'kri' }
                ]),
                chart('bar', 'MEDDICC by deal', open.map((a) => ({ name: a.name, value: a.meddicc_score })), { layout: 'vertical' }),
                ...(weak.length ? [table('Needs qualification', ['Account', 'Stage', 'Score', 'Value'],
                    weak.slice(0, 10).map((a) => [a.name, a.stage, `${a.meddicc_score}/7`, money(inr(a.value_amount, a.value_currency))]))] : [])
            ]
        };
    },

    async account_lookup(e, user) {
        if (!e.name) return HANDLERS.fallback(e, user);
        const accounts = await accountRepo.list(user);
        const needle = e.name.toLowerCase();
        const a = accounts.find((x) => x.name.toLowerCase() === needle)
            || accounts.find((x) => x.name.toLowerCase().includes(needle));
        if (!a) {
            return {
                reply: `I can't find "${e.name}" in your accounts. It may not exist, or it may sit outside your access.`,
                blocks: []
            };
        }
        const contracts = await scopedContracts(user, { account: a.name });
        const docs = await documentRepo.list(user, { account: a.name });
        const value = inr(a.value_amount, a.value_currency);
        return {
            reply: `${a.name} — ${a.segment.toLowerCase()} in ${a.industry || 'an unspecified industry'}, ${a.stage} stage, owned by ${a.sales_owner || 'nobody yet'}. Worth ${money(value)}.`,
            blocks: [
                stats([
                    { label: 'Value', value: money(value), hint: a.value_currency, accent: '#818cf8' },
                    { label: 'Probability', value: `${a.probability}%`, hint: a.stage, accent: '#38bdf8' },
                    { label: 'MEDDICC', value: `${a.meddicc_score}/7`, hint: 'qualification', accent: a.meddicc_score >= 5 ? '#34d399' : '#fbbf24' },
                    { label: 'Health', value: a.health, hint: a.region || '—', accent: a.health === 'Good' ? '#34d399' : '#f87171', variant: a.health === 'Good' ? 'kpi' : 'kri' }
                ]),
                table('Profile', ['Field', 'Value'], [
                    ['Segment', a.segment], ['Source', a.source], ['Region', a.region || '—'],
                    ['Industry', a.industry || '—'], ['Owner', a.sales_owner || '—'], ['CSM', a.cxm || '—'],
                    ['Renewal', a.renewal || '—'], ['Next step', a.next_step || '—'],
                    ['Contracts', String(contracts.length)], ['Documents', String(docs.length)]
                ]),
                ...(contracts.length ? [table('Contracts', ['Contract', 'Status', 'Renews', 'Value'],
                    contracts.map((c) => [c.id, c.status, c.renewal_date || '—', money(inr(c.tcv, c.currency))]))] : [])
            ]
        };
    },

    /**
     * Data entry. Never writes — returns a proposal the user must confirm.
     * The write itself happens in confirm() below.
     */
    async create_account(e, user) {
        const allowed = await canAccess(
            user,
            { owner_id: user.id, region: e.region || user.region, segment: e.segment || 'Prospect' },
            'write',
            'accounts'
        );
        if (!allowed) {
            return { reply: 'Your access does not allow creating accounts. Ask an admin to widen your policy.', blocks: [] };
        }
        // A registered admin over WhatsApp may write directly (guided by a schema);
        // everyone else gets a draft to confirm in the app.
        const waAdmin = e.channel === 'whatsapp' && user.role === 'admin';
        const fields = parseAccountFields(e.prompt || '');
        const name = e.name || fields.name;

        if (!name) {
            // No name yet → hand the admin the schema, then the editable template as
            // a separate message (so it copies cleanly); others get a one-line hint.
            if (waAdmin) return { reply: ACCOUNT_SCHEMA_TEXT, blocks: [], schema: true, followups: [ACCOUNT_TEMPLATE_TEXT] };
            return { reply: 'I can add that — I just need a name. Try: `add prospect "Acme Capital", fintech, APAC, 50L, stage Discovery`.', blocks: [] };
        }

        // Industry is free text, so match against what the book already uses
        // rather than inventing an enum that would drift from the data.
        const known = [...new Set((await accountRepo.list(user)).map((a) => a.industry).filter(Boolean))];
        const segment = fields.segment || e.segment || 'Prospect';
        const draft = {
            name,
            segment,
            source: fields.source || e.source || 'Direct',
            stage: fields.stage || e.stage || (segment === 'Customer' ? 'Live' : 'Lead'),
            industry: fields.industry || findIn(known, e.prompt || '') || '',
            region: fields.region || e.region || user.region || 'India',
            value_amount: fields.value_amount ?? e.money?.amount ?? 0,
            value_currency: fields.value_currency || e.money?.currency || 'INR',
            probability: fields.probability ?? (segment === 'Customer' ? 100 : 10),
            // CSM (cxm) is deliberately NOT set at creation — it's assigned in CLM
            // once the deal is won.
            sales_owner: fields.sales_owner || user.name || ''
        };

        if (waAdmin) {
            // Direct write for a verified admin number.
            const account = await writeAccountDraft(draft, user);
            return {
                reply: `✅ Added *${account.name}* to Cash Horizon — ${account.segment.toLowerCase()} · ${account.region}${account.value_amount ? ` · ${account.value_currency} ${account.value_amount.toLocaleString('en-IN')}` : ''} · stage ${account.stage}.`,
                blocks: []
            };
        }

        return {
            reply: `Here's what I'll create. Check it before I write anything.`,
            blocks: [],
            proposal: {
                kind: 'create_account',
                summary: `Create ${draft.segment.toLowerCase()} "${draft.name}"`,
                fields: [
                    ['Name', draft.name], ['Segment', draft.segment], ['Source', draft.source],
                    ['Stage', draft.stage], ['Industry', draft.industry || '—'], ['Region', draft.region],
                    ['Value', draft.value_amount ? `${draft.value_currency} ${draft.value_amount.toLocaleString('en-IN')}` : '—'],
                    ['Owner', draft.sales_owner || '—']
                ],
                payload: draft
            }
        };
    },

    /** Support desk rollup (911). ABAC-scoped via supportRepo → accounts. */
    async support(_e, user) {
        const s = await supportRepo.stats(user);
        if (!s.total) {
            return { reply: 'No support tickets in your scope right now — the desk is clear.', blocks: [] };
        }
        const open = await supportRepo.list(user, { open: true });
        const slaState = (t) => (t.breached ? 'Breached' : t.at_risk ? 'At risk' : 'On track');
        return {
            reply: `${s.open} open ticket${s.open === 1 ? '' : 's'} across your accounts`
                + `${s.breached ? `, ${s.breached} breaching SLA` : ''}`
                + `${s.slaAttainment !== null ? `. SLA attainment is ${s.slaAttainment}%.` : '.'}`,
            blocks: [
                stats([
                    { label: 'Open tickets', value: String(s.open), hint: `${s.total} total`, accent: '#38bdf8' },
                    { label: 'SLA breached', value: String(s.breached), hint: s.atRisk ? `${s.atRisk} at risk` : 'live', accent: s.breached ? '#f87171' : '#34d399', variant: s.breached ? 'kri' : 'kpi' },
                    { label: 'SLA attainment', value: s.slaAttainment !== null ? `${s.slaAttainment}%` : '—', hint: 'resolved on time', accent: '#a855f7' },
                    { label: 'Avg first response', value: s.avgFirstResponseHrs !== null ? `${s.avgFirstResponseHrs}h` : '—', hint: 'to first reply', accent: '#fbbf24' }
                ]),
                ...(open.length ? [table('Open tickets', ['Ticket', 'Account', 'Priority', 'SLA'],
                    open.slice(0, 8).map((t) => [t.ticket_no || `#${t.id}`, t.account, t.priority, slaState(t)]))] : [])
            ]
        };
    },

    /** Pull one ticket by its reference (TIC-0007) — the WhatsApp retrieval path. */
    async ticket_lookup(e, user) {
        const ref = (String(e.prompt || '').match(/tic-?\d+/i) || [])[0];
        const t = ref ? await supportRepo.getByRef(ref, user) : null;
        if (!t) {
            return {
                reply: ref
                    ? `I couldn't find ticket *${ref.toUpperCase().replace(/^TIC-?/i, 'TIC-')}* in your scope — check the id and try again.`
                    : "Tell me the ticket id and I'll pull it up — for example *TIC-0007*.",
                blocks: []
            };
        }
        const slaState = t.breached ? 'Breached' : t.at_risk ? 'At risk' : t.paused ? `Paused · ${t.status}` : 'On track';
        return {
            reply: `*${t.ticket_no}* — ${t.subject}\n${t.account} · ${t.type} · ${t.priority} priority · ${t.status}`,
            blocks: [
                stats([
                    { label: 'Priority', value: t.priority, accent: '#f87171' },
                    { label: 'Status', value: t.status, accent: '#38bdf8' },
                    { label: 'SLA', value: slaState, accent: t.breached ? '#f87171' : '#34d399' },
                    { label: 'Tier', value: t.support_tier, accent: '#a855f7' }
                ]),
                table('Details', ['Field', 'Value'], [
                    ['Channel', t.channel || '—'],
                    ['Module', [t.module, t.sub_tab].filter(Boolean).join(' › ') || '—'],
                    ['Resolution', t.resolution || '—'],
                    ['JIRA', t.jira_id || '—'],
                    ['Assignee', t.assignee || 'unassigned'],
                    ['Requester', [t.requester_name, t.requester_email].filter(Boolean).join(' · ') || '—']
                ])
            ]
        };
    },

    /** Pull one feature request by its reference (FR-0003). */
    async feature_lookup(e, user) {
        const ref = (String(e.prompt || '').match(/fr-?\d+/i) || [])[0];
        const f = ref ? await featureRepo.getByRef(ref, user) : null;
        if (!f) {
            return {
                reply: ref
                    ? `I couldn't find feature request *${ref.toUpperCase().replace(/^FR-?/i, 'FR-')}* in your scope.`
                    : "Tell me the request id and I'll pull it up — for example *FR-0003*.",
                blocks: []
            };
        }
        return {
            reply: `*${f.ref}* — ${f.title}\n${f.account} · ${f.product_area || 'unassigned area'} · ${f.status}`,
            blocks: [
                stats([
                    { label: 'Status', value: f.status, accent: '#38bdf8' },
                    { label: 'RICE', value: String(f.rice), accent: '#a855f7' },
                    { label: 'Demand', value: String(f.demand), accent: '#34d399' },
                    { label: 'Impact', value: f.impact, accent: '#fbbf24' }
                ])
            ]
        };
    },

    /** Forward a ticket or feature request to the CTO's Telegram. */
    async escalate_cto(e, user) {
        const p = String(e.prompt || '');
        const tRef = (p.match(/tic-?\d+/i) || [])[0];
        const fRef = (p.match(/fr-?\d+/i) || [])[0];
        if (!tRef && !fRef) {
            return { reply: 'Which one should I send to the CTO? Give me a ticket id (*TIC-0007*) or a feature request id (*FR-0003*).', blocks: [] };
        }
        if (tRef) {
            if (!(await canUseModule(user, 'support'))) return denialAnswer('ticket_lookup', relayForModule('support'), 'support');
            const t = await supportRepo.getByRef(tRef, user);
            if (!t) return { reply: `I couldn't find ticket *${tRef.toUpperCase().replace(/^TIC-?/i, 'TIC-')}* in your scope.`, blocks: [] };
            const r = await relayTicketToCto(t, { by: user.name });
            return {
                reply: r.ok
                    ? `Sent *${t.ticket_no}* — "${t.subject}" to the CTO on Telegram. ✅`
                    : r.disabled
                        ? `The CTO's Telegram isn't linked yet — ask an admin to set it up, then I can forward *${t.ticket_no}*.`
                        : `I couldn't reach Telegram just now (${r.reason}). Try again shortly.`,
                blocks: []
            };
        }
        if (!(await canUseModule(user, 'feature-requests'))) return denialAnswer('feature_lookup', relayForModule('feature-requests'), 'feature-requests');
        const f = await featureRepo.getByRef(fRef, user);
        if (!f) return { reply: `I couldn't find feature request *${fRef.toUpperCase().replace(/^FR-?/i, 'FR-')}* in your scope.`, blocks: [] };
        const r = await relayFeatureToCto(f, { by: user.name });
        return {
            reply: r.ok
                ? `Shared *${f.ref}* — "${f.title}" with the CTO on Telegram. ✅`
                : r.disabled
                    ? "The CTO's Telegram isn't linked yet — ask an admin to configure it, then I can share it."
                    : `I couldn't reach Telegram just now (${r.reason}). Try again shortly.`,
            blocks: []
        };
    },

    /* ---- specialist agents (each ABAC-scoped via its repo) ------------------ */
    async onboarding(_e, user) {
        const s = await onboardingRepo.stats(user);
        if (!s.total) return { reply: 'No onboarding projects in your scope.', blocks: [] };
        const rows = await onboardingRepo.list(user);
        return {
            reply: `${s.inProgress} onboarding in progress, ${s.atRisk} at risk. Avg time-to-value ${s.avgTimeToValue != null ? `${s.avgTimeToValue} days` : 'n/a'}.`,
            blocks: [
                stats([
                    { label: 'In progress', value: String(s.inProgress), hint: `${s.total} total`, accent: '#38bdf8' },
                    { label: 'At risk', value: String(s.atRisk), accent: s.atRisk ? '#f87171' : '#34d399', variant: s.atRisk ? 'kri' : 'kpi' },
                    { label: 'Live', value: String(s.live), hint: `${s.liveWithoutValue || 0} w/o value`, accent: '#34d399' },
                    { label: 'Avg time-to-value', value: s.avgTimeToValue != null ? `${s.avgTimeToValue}d` : '—', accent: '#a855f7' }
                ]),
                ...(rows.length ? [table('Projects', ['Account', 'Status', 'Progress', 'Go-live'],
                    rows.slice(0, 8).map((r) => [r.account, r.status, `${r.progress}%`, r.daysToGoLive != null ? `${r.daysToGoLive}d` : '—']))] : [])
            ]
        };
    },
    async training(_e, user) {
        const s = await trainingRepo.stats(user);
        if (!s.sessions) return { reply: 'No training sessions in your scope.', blocks: [] };
        const rows = await trainingRepo.list(user);
        return {
            reply: `${s.enrolled} learners enrolled, ${s.completed} completed (${s.completionRate ?? 0}%), ${s.certified} certified. ${s.stalled} stalled.`,
            blocks: [
                stats([
                    { label: 'Enrolled', value: String(s.enrolled), hint: `${s.sessions} sessions`, accent: '#38bdf8' },
                    { label: 'Completion', value: `${s.completionRate ?? 0}%`, hint: `${s.completed} done`, accent: '#34d399' },
                    { label: 'Certified', value: String(s.certified), hint: `${s.certificationRate ?? 0}%`, accent: '#a855f7' },
                    { label: 'Stalled', value: String(s.stalled), accent: s.stalled ? '#f59e0b' : '#34d399', variant: s.stalled ? 'kri' : 'kpi' }
                ]),
                ...(rows.length ? [table('Sessions', ['Title', 'Account', 'Status', 'Completion'],
                    rows.slice(0, 8).map((r) => [r.title, r.account, r.status, `${r.completion_rate ?? 0}%`]))] : [])
            ]
        };
    },
    async health(_e, user) {
        const s = await healthRepo.stats(user);
        if (!s.accounts) return { reply: 'No customer health data in your scope.', blocks: [] };
        const at = (await healthRepo.accountHealth(user)).filter((a) => a.currentSignal === 'Red' || a.overdue);
        return {
            reply: `${s.red} red, ${s.amber} amber of ${s.accounts} accounts. ${s.overdue} overdue a check, ${s.worsening} worsening.`,
            blocks: [
                stats([
                    { label: 'Red', value: String(s.red), accent: s.red ? '#f87171' : '#34d399', variant: s.red ? 'kri' : 'kpi' },
                    { label: 'Amber', value: String(s.amber), accent: '#f59e0b' },
                    { label: 'Overdue check', value: String(s.overdue), hint: `${s.neverChecked || 0} never`, accent: '#38bdf8' },
                    { label: 'Worsening', value: String(s.worsening), hint: `${s.openActions} open actions`, accent: '#a855f7' }
                ]),
                ...(at.length ? [table('Needs attention', ['Account', 'Signal', 'Tier', 'Open actions'],
                    at.slice(0, 8).map((a) => [a.account, a.currentSignal, a.tier, String(a.openActions)]))] : [])
            ]
        };
    },
    async ebrs(_e, user) {
        const c = await ebrRepo.coverage(user);
        if (!c.customers) return { reply: 'No EBR-eligible customers in your scope.', blocks: [] };
        return {
            reply: `${c.quarterLabel}: ${c.generated} EBRs generated, ${c.shared} shared. ${c.pendingShare} pending share, ${c.notStarted} not started.`,
            blocks: [
                stats([
                    { label: 'Generated', value: String(c.generated), hint: `${c.customers} customers`, accent: '#38bdf8' },
                    { label: 'Shared', value: String(c.shared), accent: '#34d399' },
                    { label: 'Pending share', value: String(c.pendingShare), accent: c.pendingShare ? '#f59e0b' : '#34d399' },
                    { label: 'Not started', value: String(c.notStarted), accent: c.notStarted ? '#f87171' : '#34d399', variant: c.notStarted ? 'kri' : 'kpi' }
                ]),
                ...(c.rows?.length ? [table(`${c.quarterLabel} EBRs`, ['Account', 'Status', 'Signal', 'ARR'],
                    c.rows.slice(0, 8).map((r) => [r.account, r.status, r.signal || '—', money(r.arrInr)]))] : [])
            ]
        };
    },
    async surveys(_e, user) {
        const s = await surveyRepo.stats(user);
        if (!s.campaigns) return { reply: 'No survey campaigns in your scope.', blocks: [] };
        const c = await surveyRepo.listCampaigns(user);
        return {
            reply: `NPS ${s.nps ?? '—'}, CSAT ${s.csat ?? '—'} across ${s.responses} responses (${s.responseRate ?? 0}% response). ${s.detractors} detractors.`,
            blocks: [
                stats([
                    { label: 'NPS', value: s.nps != null ? String(s.nps) : '—', accent: '#38bdf8' },
                    { label: 'CSAT', value: s.csat != null ? `${s.csat}` : '—', accent: '#34d399' },
                    { label: 'Responses', value: String(s.responses), hint: `${s.responseRate ?? 0}% rate`, accent: '#a855f7' },
                    { label: 'Detractors', value: String(s.detractors), accent: s.detractors ? '#f87171' : '#34d399', variant: s.detractors ? 'kri' : 'kpi' }
                ]),
                ...(c.length ? [table('Campaigns', ['Title', 'Type', 'Score', 'Responses'],
                    c.slice(0, 8).map((x) => [x.title, x.type, String(x.headline ?? '—'), String(x.responseCount)]))] : [])
            ]
        };
    },
    async journey(_e, user) {
        const s = await journeyRepo.stats(user);
        if (!s.customers) return { reply: 'No mapped customer journeys in your scope.', blocks: [] };
        const rows = await journeyRepo.list(user);
        return {
            reply: `${s.mapped} of ${s.customers} customers mapped. ${s.stalled} stalled, ${s.atRisk} at risk, ${s.advocacy} in advocacy. Avg progress ${s.avgProgress ?? 0}%.`,
            blocks: [
                stats([
                    { label: 'Stalled', value: String(s.stalled), accent: s.stalled ? '#f59e0b' : '#34d399', variant: s.stalled ? 'kri' : 'kpi' },
                    { label: 'At risk', value: String(s.atRisk), accent: s.atRisk ? '#f87171' : '#34d399' },
                    { label: 'Advocacy', value: String(s.advocacy), accent: '#34d399' },
                    { label: 'Avg progress', value: `${s.avgProgress ?? 0}%`, accent: '#a855f7' }
                ]),
                ...(rows.length ? [table('Journeys', ['Account', 'Stage', 'Health', 'Days in stage'],
                    rows.slice(0, 8).map((r) => [r.account, r.stage, r.health, String(r.daysInStage ?? '—')]))] : [])
            ]
        };
    },
    async features(_e, user) {
        const s = await featureRepo.stats(user);
        if (!s.total) return { reply: 'No feature requests in your scope.', blocks: [] };
        return {
            reply: `${s.open} open of ${s.total} requests, ${s.shipped} shipped. Total demand across ${s.totalDemand} supporters.`,
            blocks: [
                stats([
                    { label: 'Open', value: String(s.open), hint: `${s.total} total`, accent: '#38bdf8' },
                    { label: 'Shipped', value: String(s.shipped), hint: `${s.shippedRate ?? 0}%`, accent: '#34d399' },
                    { label: 'Declined', value: String(s.declined), accent: '#f59e0b' },
                    { label: 'Demand', value: String(s.totalDemand), hint: 'supporters', accent: '#a855f7' }
                ]),
                ...(s.topDemand?.length ? [table('Top demand', ['Request', 'Account', 'Demand', 'Status'],
                    s.topDemand.slice(0, 8).map((r) => [r.title, r.account, String(r.demand), r.status]))] : [])
            ]
        };
    },
    async upsells(_e, user) {
        const s = await expansionRepo.stats(user);
        if (!s.opportunities) return { reply: 'No expansion opportunities in your scope.', blocks: [] };
        return {
            reply: `${s.open} open expansions worth ${money(s.openValueInr)}, weighted to ${money(s.weightedForecastInr)}. Win rate ${s.winRate ?? 0}%.`,
            blocks: [
                stats([
                    { label: 'Open pipeline', value: money(s.openValueInr), hint: `${s.open} deals`, accent: '#818cf8' },
                    { label: 'Weighted', value: money(s.weightedForecastInr), hint: 'forecast', accent: '#38bdf8' },
                    { label: 'Won', value: money(s.wonInr), hint: `${s.won} deals`, accent: '#34d399' },
                    { label: 'Win rate', value: `${s.winRate ?? 0}%`, accent: '#a855f7' }
                ]),
                ...(s.topDeals?.length ? [table('Top deals', ['Deal', 'Account', 'Value', 'Stage'],
                    s.topDeals.slice(0, 8).map((d) => [d.title, d.account, money(d.valueInr), d.stage]))] : [])
            ]
        };
    },
    async comms(_e, user) {
        const s = await commsRepo.stats(user);
        if (!s.campaigns) return { reply: 'No communications campaigns in your scope.', blocks: [] };
        const rows = await commsRepo.list(user);
        return {
            reply: `${s.sent} sent of ${s.campaigns} campaigns (${s.scheduled} scheduled, ${s.drafts} drafts). Avg open ${s.avgOpenRate ?? 0}%, click ${s.avgClickRate ?? 0}%.`,
            blocks: [
                stats([
                    { label: 'Sent', value: String(s.sent), hint: `${s.campaigns} total`, accent: '#38bdf8' },
                    { label: 'Scheduled', value: String(s.scheduled), accent: '#f59e0b' },
                    { label: 'Avg open', value: `${s.avgOpenRate ?? 0}%`, accent: '#34d399' },
                    { label: 'Avg click', value: `${s.avgClickRate ?? 0}%`, accent: '#a855f7' }
                ]),
                ...(rows.length ? [table('Campaigns', ['Title', 'Type', 'Open', 'Click'],
                    rows.slice(0, 8).map((r) => [r.title, r.type, `${r.openRate ?? 0}%`, `${r.clickRate ?? 0}%`]))] : [])
            ]
        };
    },
    async events(_e, user) {
        const s = await eventRepo.stats(user);
        if (!s.events) return { reply: 'No events in your scope.', blocks: [] };
        return {
            reply: `${s.upcoming} upcoming, ${s.completed} completed of ${s.events} events. ${s.totalRegistered} registered, avg attendance ${s.avgAttendanceRate ?? 0}%.`,
            blocks: [
                stats([
                    { label: 'Upcoming', value: String(s.upcoming), accent: '#38bdf8' },
                    { label: 'Completed', value: String(s.completed), accent: '#34d399' },
                    { label: 'Registered', value: String(s.totalRegistered), hint: `${s.totalAttended} attended`, accent: '#a855f7' },
                    { label: 'Avg attendance', value: `${s.avgAttendanceRate ?? 0}%`, accent: '#f59e0b' }
                ]),
                ...(s.next?.length ? [table('Next up', ['Event', 'Account', 'Registered', 'Capacity'],
                    s.next.slice(0, 8).map((e) => [e.title, e.account, String(e.registered), String(e.capacity ?? '—')]))] : [])
            ]
        };
    },
    async referrals(_e, user) {
        const s = await referralRepo.stats(user);
        if (!s.total) return { reply: 'No referral leads in your scope.', blocks: [] };
        const rows = await referralRepo.list(user);
        return {
            reply: `${s.converted} of ${s.total} referrals converted (${s.conversionRate ?? 0}%), worth ${money(s.referredValueInr)}. ${s.advocates} advocates.`,
            blocks: [
                stats([
                    { label: 'Converted', value: String(s.converted), hint: `${s.total} leads`, accent: '#34d399' },
                    { label: 'Conversion', value: `${s.conversionRate ?? 0}%`, accent: '#38bdf8' },
                    { label: 'Referred value', value: money(s.referredValueInr), accent: '#818cf8' },
                    { label: 'Advocates', value: String(s.advocates), hint: `${money(s.rewardsOwed)} owed`, accent: '#a855f7' }
                ]),
                ...(rows.length ? [table('Leads', ['Referral', 'Account', 'Status', 'Value'],
                    rows.slice(0, 8).map((r) => [r.referred_name, r.account, r.status, money(r.valueInr)]))] : [])
            ]
        };
    },

    /**
     * Asks for a PDF report. Picks the module from the prompt, gates it, and
     * returns a { report: { module, label } } marker — the channel delivers the
     * file (WhatsApp sends the PDF; the web points to the module's Report button).
     */
    async report(e, user) {
        const key = (REPORT_MAP.find(([, re]) => re.test(e.prompt || '')) || ['accounts'])[0];
        const label = REPORT_LABEL[key] || MODULE_LABEL[key] || key;
        if (!(await canUseModule(user, key))) return denialAnswer('report', relayForModule(key), key);

        // Work out the reporting period (All / Q1–Q4 / custom range). Over WhatsApp,
        // a bare "send the CLM report" gets the period picker first.
        const period = resolveReportPeriod(e.prompt || '');
        if (period.error) return { reply: `⚠️ ${period.error}`, blocks: [] };
        if (period.kind === 'none' && e.channel === 'whatsapp') {
            return { reply: reportPeriodMenu(label), blocks: [] };
        }
        const span = period.kind === 'none' || period.kind === 'all' ? 'all time' : period.label;

        // Attribute the report to the specialist whose module it is.
        return {
            relay: relayForModule(key, `compiling the ${label} report`),
            reply: `Pulling your *${label}* report for *${span}* — sending the PDF. 📄`,
            blocks: [],
            report: { module: key, label, period: { from: period.from || '', to: period.to || '', label: span } }
        };
    },

    /** A warm hospitality-style welcome, then a nudge toward what they can ask. */
    async greeting(_e, user) {
        const first = (user.name || '').split(' ')[0];
        const rows = [];
        for (const grp of HELP_MENU) {
            if (rows.length >= 5) break;
            if (await canUseModule(user, grp.module)) rows.push(grp.asks[0]);
        }
        return {
            reply: `Welcome to AGCX${first ? `, ${first}` : ''}! 👋 How may I help you today?\n\n`
                + 'I can pull live numbers from across your book — just ask in plain words, or start with one of these:',
            blocks: [
                table('Popular questions', ['Ask', 'What you get'],
                    rows.length ? rows : [["How's the pipeline?", 'Open value, weighted, stage mix']])
            ]
        };
    },

    /** A warm, professional acknowledgement when the user says thanks or signs off. */
    async thanks(e, user) {
        const first = (user.name || '').split(' ')[0];
        const p = (e.prompt || '').toLowerCase();
        const farewell = /\b(bye|goodbye|good\s*night|see\s+(ya|you)|take\s+care)\b/.test(p) || /👋/.test(p);
        if (farewell) {
            return { reply: `Take care${first ? `, ${first}` : ''}! 👋 I'm here whenever you need the numbers — just message me anytime.`, blocks: [] };
        }
        const options = [
            `You're very welcome${first ? `, ${first}` : ''}! 🙌 Happy to help — just say the word if there's anything else.`,
            `My pleasure${first ? `, ${first}` : ''}! Anytime you need a number pulled or a report sent, I'm right here.`,
            `Glad I could help${first ? `, ${first}` : ''}! 😊 I'm always a message away if something else comes up.`,
            `Anytime${first ? `, ${first}` : ''}! 🙏 Reach out whenever you'd like another look across your book.`
        ];
        // Vary the phrasing by message length so repeated thanks don't feel canned.
        return { reply: options[(e.prompt || '').trim().length % options.length], blocks: [] };
    },

    async help(_e, user) {
        // Only surface what this user can actually ask — a rep denied Support
        // shouldn't be told to ask about tickets. Gate each group by canUseModule.
        const rows = [];
        for (const grp of HELP_MENU) {
            if (await canUseModule(user, grp.module)) rows.push(...grp.asks);
        }
        return {
            reply: `I'm NEO. For each question I bring in the right specialist — Aukat 💰 on accounts, AURA 🔮 on renewals, 911 🚑 on support — and everything stays scoped to what you can see, ${user.name}.`,
            blocks: [
                table('Try asking', ['Ask', 'What you get'],
                    rows.length ? rows : [['—', 'No modules are enabled for your account yet — ask an admin.']])
            ]
        };
    },

    async fallback(_e, user) {
        const r = await HANDLERS.help({}, user);
        return { ...r, reply: `I didn't quite catch that. Here's what I can do:` };
    }
};

/**
 * Which specialist owns each intent, and what it is actually doing.
 *
 * This is the real routing, not decoration: the intent picked here is the
 * handler that ran, and the agent is the one that owns that handler's module.
 * The GPT view narrates this hand-off, so it must stay true — if an intent moves
 * to another module, its agent moves with it.
 */
const ROUTING = {
    pipeline: ['aukat', 'reading the open pipeline'],
    pipeline_by_stage: ['aukat', 'walking the funnel stage by stage'],
    by_region: ['aukat', 'splitting the book by region'],
    by_owner: ['aukat', 'checking who owns what'],
    top_accounts: ['aukat', 'ranking accounts by value'],
    meddicc: ['aukat', 'scoring deal qualification'],
    account_lookup: ['aukat', 'pulling the account profile'],
    create_account: ['aukat', 'drafting the record'],
    renewals: ['aura', 'checking renewal windows'],
    documents: ['doxy', 'pulling the document library'],
    support: ['medic', 'triaging the support desk'],
    ticket_lookup: ['medic', 'pulling the ticket'],
    escalate_cto: ['medic', 'escalating to the CTO on Telegram'],
    onboarding: ['pilot', 'walking the onboarding milestones'],
    training: ['sensei', 'reviewing enablement progress'],
    health: ['pulse', 'taking the account pulse'],
    ebrs: ['aria', 'assembling the business review'],
    surveys: ['echo', 'reading the voice of the customer'],
    journey: ['compass', 'tracing the customer journey'],
    features: ['forge', 'shaping the roadmap demand'],
    feature_lookup: ['forge', 'pulling the feature request'],
    upsells: ['rainmaker', 'sizing the expansion pipeline'],
    comms: ['herald', 'reviewing the campaigns'],
    events: ['ringmaster', 'checking the events lineup'],
    referrals: ['magnet', 'counting advocates and referrals']
};

function relayFor(intent) {
    const [key, task] = ROUTING[intent] || [];
    if (!key) return null;
    const agent = AGENTS.find((a) => a.key === key && a.online);
    if (!agent) return null;
    return { key: agent.key, name: agent.name, emoji: agent.emoji, color: agent.color, task };
}

// The agent that owns a module (by its policy) — used to attribute a report to
// the specialist whose area it covers (CLM report → AURA, support report → 911).
function relayForModule(moduleKey, task) {
    const agent = AGENTS.find((a) => a.policy === moduleKey && a.online);
    if (!agent) return null;
    return { key: agent.key, name: agent.name, emoji: agent.emoji, color: agent.color, task };
}

/**
 * The user is identity-verified (their number is bound to their account); the
 * only question is whether that account may use the module. If not, we hand back
 * a denial — attributed to the specialist whose desk it is — instead of running
 * the handler and leaking (or emptily hiding) data.
 */
function denialAnswer(intent, relay, moduleKey) {
    const label = MODULE_LABEL[moduleKey] || moduleKey;
    return {
        intent,
        relay,
        denied: true,
        module: moduleKey,
        reply: `You don't have access to the ${label} module, so I can't pull that for you. Ask an admin to enable ${label} for your account.`,
        blocks: []
    };
}

export async function ask(prompt, user, opts = {}) {
    const { intent, entities } = await interpret(prompt);
    // The surface the question came from ('whatsapp' | 'web' | 'mcp'). Lets a
    // handler behave differently per channel — e.g. an admin over WhatsApp can
    // write directly, where the web asks for an in-app confirmation.
    entities.channel = opts.channel || 'web';
    // Access gate: enforced here, in the shared brain, so web, WhatsApp and MCP
    // all deny consistently. help/fallback have no module → always allowed.
    const moduleKey = INTENT_MODULE[intent];
    if (moduleKey && !(await canUseModule(user, moduleKey))) {
        return denialAnswer(intent, relayFor(intent), moduleKey);
    }
    const handler = HANDLERS[intent] || HANDLERS.fallback;
    const result = await handler(entities, user);
    // null relay = NEO answered it itself (help, fallback), so the view says so.
    return { intent, relay: relayFor(intent), ...result };
}

// Sanitise a draft and write it, re-checking write access here (never trusting a
// round-tripped payload). Shared by the in-app confirm() and the WhatsApp admin
// direct-write path.
async function writeAccountDraft(p, user) {
    const allowed = await canAccess(
        user,
        { owner_id: user.id, region: p.region, segment: p.segment },
        'write',
        'accounts'
    );
    if (!allowed) throw Object.assign(new Error('Your access does not allow creating accounts'), { status: 403 });
    return accountRepo.create({
        name: String(p.name || '').trim(),
        segment: SEGMENTS.includes(p.segment) ? p.segment : 'Prospect',
        source: SOURCES.includes(p.source) ? p.source : 'Direct',
        stage: STAGES.includes(p.stage) ? p.stage : 'Lead',
        industry: p.industry || '',
        region: REGIONS.includes(p.region) ? p.region : 'India',
        tier: 'Starter',
        value_amount: Math.max(0, Math.round(Number(p.value_amount) || 0)),
        value_currency: p.value_currency === 'USD' ? 'USD' : 'INR',
        probability: Math.min(100, Math.max(0, Number(p.probability) || 0)),
        sales_owner: p.sales_owner || user.name || '',
        cxm: p.cxm || '', health: 'Good', renewal: '', next_step: '', next_step_date: '',
        meddicc: {}, custom_fields: {}
    }, user);
}

/** Executes a proposal the user has explicitly confirmed. */
export async function confirm(proposal, user) {
    if (!proposal || proposal.kind !== 'create_account') {
        throw Object.assign(new Error('Unknown proposal'), { status: 400 });
    }
    const account = await writeAccountDraft(proposal.payload || {}, user);

    return {
        account,
        reply: `Done — ${account.name} is in Cash Horizon as a ${account.segment.toLowerCase()}.`,
        blocks: [
            stats([
                { label: 'Created', value: account.name, hint: `${account.segment} · ${account.region}`, accent: '#34d399' },
                { label: 'Value', value: money(inr(account.value_amount, account.value_currency)), hint: account.stage, accent: '#818cf8' }
            ])
        ]
    };
}
