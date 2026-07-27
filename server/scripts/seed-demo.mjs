/**
 * Demo data expansion.
 *
 *   node scripts/seed-demo.mjs
 *
 * The per-module `POST /seed-sample` endpoints each drop a small fixed set on
 * today's date, which is enough to prove a page renders but not enough to make
 * the metrics mean anything: trend lines come out flat, the risk model has
 * nothing to separate accounts by, and forecasting has no slope to work with.
 *
 * This adds volume *and spreads it over the last eight months*, which is the
 * part that matters — a dashboard built on month-over-month series is only
 * interesting if the months differ.
 *
 * Everything goes through the repositories rather than raw SQL, so the same
 * validation, clamping and derived-field logic the API uses applies here too.
 * Re-runnable: it skips accounts that already exist and tags what it creates.
 */

import { accountRepo } from '../repositories/accountRepo.js';
import { contractRepo } from '../repositories/contractRepo.js';
import { supportRepo } from '../repositories/supportRepo.js';
import { healthRepo } from '../repositories/healthRepo.js';
import { trainingRepo } from '../repositories/trainingRepo.js';
import { surveyRepo } from '../repositories/surveyRepo.js';
import { expansionRepo } from '../repositories/expansionRepo.js';
import { referralRepo } from '../repositories/referralRepo.js';
import { commsRepo } from '../repositories/commsRepo.js';
import { eventRepo } from '../repositories/eventRepo.js';
import { featureRepo } from '../repositories/featureRepo.js';
import { journeyRepo } from '../repositories/journeyRepo.js';
import { onboardingRepo } from '../repositories/onboardingRepo.js';
import { ebrRepo } from '../repositories/ebrRepo.js';
import { getDb } from '../db.js';

// Admin identity for the repo calls — ABAC lets an admin write anywhere.
const ADMIN = { id: 1, email: 'demo@example.com', role: 'admin', region: null };

/* --------------------------------------------------------------------------
   Deterministic randomness: a seeded LCG, so two runs of this script produce
   the same book and the numbers quoted in a demo stay true.
   -------------------------------------------------------------------------- */
let _s = 20260723;
const rnd = () => { _s = (_s * 1664525 + 1013904223) % 4294967296; return _s / 4294967296; };
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const pick = (a) => a[Math.floor(rnd() * a.length)];
const chance = (p) => rnd() < p;

const MONTHS_BACK = 8;
const today = new Date();
/** An ISO date `n` months back, on a plausible day of that month. */
const monthsAgo = (n, day) => {
    const d = new Date(today.getFullYear(), today.getMonth() - n, Math.min(day ?? int(2, 27), 28));
    return d.toISOString().slice(0, 10);
};
const daysAgo = (n) => new Date(today.getTime() - n * 864e5).toISOString().slice(0, 10);
const iso = (dateStr, hour = 10) => `${dateStr}T${String(hour).padStart(2, '0')}:00:00.000Z`;

const log = (...a) => console.log('  ', ...a);

/* --------------------------------------------------------------------------
   New accounts — widens region and industry coverage, which the dashboard's
   coverage panels and the per-CSM book both read from.
   -------------------------------------------------------------------------- */
const NEW_ACCOUNTS = [
    { name: 'HDFC Life', segment: 'Customer', region: 'India', industry: 'Insurance', tier: 'Enterprise', health: 'Good', cxm: 'Priya Nair', arr: 9600000 },
    { name: 'Axis Finance', segment: 'Customer', region: 'India', industry: 'NBFC', tier: 'Professional', health: 'Average', cxm: 'Arjun Rao', arr: 5400000 },
    { name: 'Piramal Capital', segment: 'Customer', region: 'India', industry: 'NBFC', tier: 'Enterprise', health: 'Good', cxm: 'Sara Iyer', arr: 8200000 },
    { name: 'IIFL Finance', segment: 'Customer', region: 'India', industry: 'Gold Loan', tier: 'Professional', health: 'Poor', cxm: 'Rohan Mehta', arr: 3800000 },
    { name: 'Northline Credit', segment: 'Customer', region: 'AMER', industry: 'Fintech', tier: 'Enterprise', health: 'Good', cxm: 'Sara Iyer', arr: 11500000 },
    { name: 'Meridian Trust', segment: 'Customer', region: 'EMEA', industry: 'Banking', tier: 'Enterprise', health: 'Average', cxm: 'Priya Nair', arr: 10200000 },
    { name: 'Sunrise Lending', segment: 'Customer', region: 'APAC', industry: 'Fintech', tier: 'Starter', health: 'Good', cxm: 'Arjun Rao', arr: 1800000 },
    { name: 'Kotak Mahindra Prime', segment: 'Prospect', region: 'India', industry: 'NBFC', tier: 'Enterprise', health: 'Good', value: 14000000, probability: 60 },
    { name: 'Federal Bank', segment: 'Prospect', region: 'India', industry: 'Banking', tier: 'Enterprise', health: 'Good', value: 9500000, probability: 40 },
    { name: 'Harbour Financial', segment: 'Prospect', region: 'AMER', industry: 'Fintech', tier: 'Professional', health: 'Average', value: 6200000, probability: 25 },
    { name: 'Anchor Capital', segment: 'Prospect', region: 'EMEA', industry: 'Insurance', tier: 'Professional', health: 'Good', value: 7400000, probability: 55 },
    { name: 'Pacific Micro', segment: 'Prospect', region: 'APAC', industry: 'Microfinance', tier: 'Starter', health: 'Good', value: 2100000, probability: 15 },
    // Second wave — wider region + industry spread for the coverage panels.
    { name: 'Zenith Insurance', segment: 'Customer', region: 'MEA', industry: 'Insurance', tier: 'Enterprise', health: 'Good', cxm: 'Priya Nair', arr: 8800000 },
    { name: 'Orion Payments', segment: 'Customer', region: 'LATAM', industry: 'Fintech', tier: 'Professional', health: 'Average', cxm: 'Arjun Rao', arr: 4200000 },
    { name: 'Summit Housing Finance', segment: 'Customer', region: 'India', industry: 'Housing Finance', tier: 'Enterprise', health: 'Good', cxm: 'Sara Iyer', arr: 7600000 },
    { name: 'Blue Harbor Bank', segment: 'Customer', region: 'AMER', industry: 'Banking', tier: 'Enterprise', health: 'Poor', cxm: 'Rohan Mehta', arr: 9900000 },
    { name: 'Nova Microfinance', segment: 'Customer', region: 'APAC', industry: 'Microfinance', tier: 'Starter', health: 'Good', cxm: 'Arjun Rao', arr: 1500000 },
    { name: 'Ironwood Lending', segment: 'Customer', region: 'India', industry: 'NBFC', tier: 'Professional', health: 'Average', cxm: 'Priya Nair', arr: 4900000 },
    { name: 'Everest Credit Union', segment: 'Customer', region: 'AMER', industry: 'Banking', tier: 'Enterprise', health: 'Good', cxm: 'Sara Iyer', arr: 10800000 },
    { name: 'Vertex Capital', segment: 'Prospect', region: 'ANZ', industry: 'NBFC', tier: 'Professional', health: 'Average', value: 5500000, probability: 35 },
    { name: 'Crestline Securities', segment: 'Prospect', region: 'EMEA', industry: 'Capital Markets', tier: 'Enterprise', health: 'Good', value: 12000000, probability: 50 },
    { name: 'Pinnacle Wealth', segment: 'Prospect', region: 'MEA', industry: 'Wealth Management', tier: 'Professional', health: 'Good', value: 6800000, probability: 30 }
];

// Sample MEDDICC content, so the CLM 360 + Cash Horizon qualification read real.
const MEDDICC_SAMPLES = {
    metrics: ['30% faster onboarding', 'Cut manual reporting ~20h/mo', '15% lower support cost', 'Reduce audit prep by 40%'],
    economic_buyer: ['CFO', 'Chief Risk Officer', 'VP Operations', 'Head of Digital'],
    decision_criteria: ['SOC2 + data residency', 'API depth & SLAs', 'Total cost of ownership', 'Time to value'],
    decision_process: ['Security review → pilot → board sign-off', 'RFP shortlisting this quarter', 'Legal + procurement gate'],
    identify_pain: ['Manual renewals slipping', 'No single view of customer health', 'Fragmented reporting', 'Compliance overhead'],
    champion: ['VP Customer Experience', 'Head of Operations', 'Platform lead', 'Risk manager'],
    competition: ['In-house build', 'Legacy incumbent', 'Spreadsheet + BI tool', 'Regional competitor']
};

const SALES_OWNERS = ['Priya Sharma', 'Rohan Mehta', 'Ananya Rao'];
const TRAINERS = ['Meera Joshi', 'Vikram Shah', 'Neha Gupta', 'Karan Bhatt'];
const FIRST = ['Aditya', 'Kavya', 'Rahul', 'Sneha', 'Vivek', 'Divya', 'Nikhil', 'Pooja', 'Sameer', 'Anita', 'Rohit', 'Ishita'];
const LAST = ['Sharma', 'Iyer', 'Menon', 'Reddy', 'Kulkarni', 'Banerjee', 'Chopra', 'Nair', 'Desai', 'Gupta'];
const ROLES = ['Analyst', 'Ops Manager', 'Compliance Lead', 'Risk Officer', 'Platform Admin', 'Underwriter'];

const TICKET_SUBJECTS = [
    'SSO login loop after password reset', 'Bulk export times out over 10k rows', 'Webhook retries duplicating events',
    'Dashboard totals differ from the export', 'API rate limit hit during nightly sync', 'PDF report renders without the logo',
    'Two-factor codes arriving late', 'Saved filter resets on reload', 'Sandbox data leaking into reports',
    'Scheduled job skipped on month end', 'User cannot be removed from a group', 'Audit log missing an actor'
];
const FEATURE_TITLES = [
    'Bulk approve from the queue', 'Custom SLA per customer segment', 'Slack alerts for red health',
    'Export scheduled to email', 'Role-based dashboard presets', 'Multi-currency on the pipeline view',
    'Offline mode for field agents', 'Inline commenting on reports', 'Configurable retention windows'
];

/**
 * Phases can be run individually — `node scripts/seed-demo.mjs surveys spread`.
 * Creation phases append, so re-running everything doubles the volume; the
 * gate exists so a phase that failed can be retried on its own.
 */
const PHASES = process.argv.slice(2);
const run = (p) => PHASES.length === 0 || PHASES.includes(p);

async function main() {
    const db = await getDb();
    const before = await counts(db);
    if (PHASES.length) log('phases:', PHASES.join(', '));

    /* ---- accounts ------------------------------------------------------- */
    if (run('accounts')) {
        const existing = new Set((await accountRepo.list(ADMIN)).map((a) => a.name));
        let made = 0;
        for (const a of NEW_ACCOUNTS) {
            if (existing.has(a.name)) continue;
            await accountRepo.create({
                name: a.name, segment: a.segment, region: a.region, industry: a.industry, tier: a.tier,
                health: a.health, source: 'Direct',
                stage: a.segment === 'Customer' ? 'Live' : pick(['Qualified', 'POC', 'Negotiation']),
                value_amount: a.arr ?? a.value ?? 0, value_currency: 'INR',
                probability: a.segment === 'Customer' ? 100 : (a.probability ?? 30),
                sales_owner: pick(SALES_OWNERS),
                renewal: a.segment === 'Customer' ? monthsAgo(-int(1, 10), 15) : ''
            }, ADMIN);
            // cxm is the CS owner; the create schema doesn't carry it, so set it directly.
            if (a.cxm) await db.run('UPDATE customers SET cxm = ? WHERE name = ?', [a.cxm, a.name]);
            made += 1;
        }
        log(`accounts: +${made}`);
    }

    const accounts = await accountRepo.list(ADMIN);
    const customers = accounts.filter((a) => a.segment === 'Customer');
    const names = customers.map((c) => c.name);

    /* ---- MEDDICC backfill ---------------------------------------------- */
    // Fill deal qualification for any account that has none, so the CLM 360 and
    // Cash Horizon MEDDICC views show real content. Idempotent: skips accounts
    // that already have a score.
    if (run('meddicc')) {
        let filled = 0;
        for (const a of accounts) {
            if ((a.meddicc_score || 0) > 0) continue;
            const pillars = Object.keys(MEDDICC_SAMPLES);
            const meddicc = {};
            // 4–6 pillars, chosen deterministically from the name so re-runs match.
            const seed = [...a.name].reduce((s, ch) => s + ch.charCodeAt(0), 0);
            const count = 4 + (seed % 3);
            for (let i = 0; i < count; i++) {
                const p = pillars[(seed + i) % pillars.length];
                const opts = MEDDICC_SAMPLES[p];
                meddicc[p] = opts[(seed + i) % opts.length];
            }
            await accountRepo.update(a.id, { meddicc }, ADMIN);
            filled += 1;
        }
        log(`meddicc: +${filled}`);
    }

    /* ---- contracts ------------------------------------------------------ */
    if (run('contracts')) {
        const haveContract = new Set((await contractRepo.list({}, ADMIN)).map((c) => c.account));
        let contracts = 0;
        for (const a of NEW_ACCOUNTS.filter((x) => x.segment === 'Customer')) {
            if (haveContract.has(a.name)) continue;
            const startMonths = int(6, 22);
            const arr = a.arr;
            await contractRepo.create({
                account: a.name, type: 'New Business', status: 'Active',
                support_tier: a.tier === 'Enterprise' ? 'Enterprise' : a.tier === 'Professional' ? 'Premium' : 'Standard',
                start_date: monthsAgo(startMonths, 1), end_date: monthsAgo(startMonths - 12, 1),
                renewal_date: monthsAgo(startMonths - 12, 1),
                term_months: 12, auto_renew: chance(0.6), currency: 'INR',
                arr, mrr: Math.round(arr / 12), tcv: arr,
                spoc_name: `${pick(FIRST)} ${pick(LAST)}`, spoc_role: 'Head of Digital',
                csm_name: a.cxm || '', billing_frequency: 'Yearly'
            });
            contracts += 1;
        }
        // A couple of closed contracts so gross retention is a real number rather
        // than a flat 100% — without any losses the metric is meaningless.
        // Deliberately not guarded by haveContract: a lapsed line runs alongside a
        // live one (a multi-entity lender dropping one entity), which is both
        // realistic and the only way a customer contributes to churn without
        // disappearing from the book.
        const LOSSES = [['Kotak Securities', 'Churned', 1200000], ['Muthoot Finance', 'Churned', 2400000], ['IIFL Finance', 'Churned', 900000]];
        for (const [acct, status, arr] of LOSSES) {
            if (!names.includes(acct)) continue;
            const already = await contractRepo.list({ account: acct }, ADMIN);
            if (already.some((c) => c.status === status)) continue;
            await contractRepo.create({
                account: acct, type: 'New Business', status,
                start_date: monthsAgo(20, 1), end_date: monthsAgo(4, 1), renewal_date: monthsAgo(4, 1),
                term_months: 12, currency: 'INR', arr, mrr: Math.round(arr / 12), tcv: arr, support_tier: 'Standard'
            });
            contracts += 1;
        }
        log(`contracts: +${contracts}`);
    }

    /* ---- support: eight months of ticket flow ---------------------------- */
    if (run('support')) {
        let tickets = 0;
        for (let m = MONTHS_BACK - 1; m >= 0; m--) {
            // Volume trends gently upward, so the KRI has a slope to project.
            const n = int(4, 7) + Math.round((MONTHS_BACK - m) * 0.8);
            for (let i = 0; i < n; i++) {
                const opened = monthsAgo(m);
                const priority = pick(['Urgent', 'High', 'Normal', 'Normal', 'Low']);
                const resolved = m > 0 || chance(0.55);
                const respHrs = priority === 'Urgent' ? int(1, 4) : int(3, 20);
                const resHrs = respHrs + (priority === 'Urgent' ? int(4, 20) : int(12, 90));
                await supportRepo.create({
                    account: pick(names), subject: pick(TICKET_SUBJECTS), category: pick(['Technical', 'Bug', 'How-to', 'Access', 'Billing']),
                    priority, status: resolved ? pick(['Resolved', 'Closed']) : pick(['Open', 'In Progress', 'Waiting on Customer']),
                    opened_at: iso(opened, 9),
                    first_response_at: iso(opened, 9 + Math.min(respHrs, 12)),
                    resolved_at: resolved ? new Date(new Date(iso(opened, 9)).getTime() + resHrs * 36e5).toISOString() : undefined,
                    requester_name: `${pick(FIRST)} ${pick(LAST)}`, assignee: pick(['Meera Joshi', 'Vikram Shah', 'Neha Gupta'])
                }, ADMIN);
                tickets += 1;
            }
        }
        log(`support tickets: +${tickets}`);
    }

    /* ---- health calls + actionables -------------------------------------- */
    if (run('health')) {
        let calls = 0, actions = 0;
        for (const c of customers) {
            const cadence = c.tier === 'Enterprise' ? 1 : c.tier === 'Professional' ? 2 : 4;
            for (let m = MONTHS_BACK - 1; m >= 0; m -= cadence) {
                // A struggling account trends red; a healthy one mostly stays green.
                const signal = c.health === 'Poor' || c.health === 'Critical'
                    ? pick(['Red', 'Red', 'Amber'])
                    : c.health === 'Average' ? pick(['Amber', 'Green', 'Amber']) : pick(['Green', 'Green', 'Amber']);
                const call = await healthRepo.createCall({
                    account: c.name, check_date: monthsAgo(m, 12), signal,
                    sentiment: signal === 'Red' ? 'Negative' : signal === 'Amber' ? 'Neutral' : 'Positive',
                    summary: signal === 'Red'
                        ? 'Escalations from the ops team remain open; sponsor asked for a recovery plan before the renewal conversation.'
                        : signal === 'Amber'
                            ? 'Steady usage in the core module, but the wider rollout has stalled behind an internal reprioritisation.'
                            : 'Positive check-in. Adoption is climbing and the team raised two enhancement ideas rather than issues.',
                    attendees: `${pick(FIRST)} ${pick(LAST)}, ${pick(FIRST)} ${pick(LAST)}`,
                    conducted_by: c.cxm || pick(SALES_OWNERS)
                }, ADMIN);
                calls += 1;
                const callId = call?.call?.id ?? call?.id;
                if (!callId) continue;
                for (let k = 0; k < int(1, 3); k++) {
                    await healthRepo.addAction(callId, {
                        text: pick([
                            'Share the revised rollout plan with the sponsor',
                            'Schedule an enablement session for the ops team',
                            'Close out the two open P2 tickets',
                            'Walk through the new reporting pack',
                            'Confirm the renewal commercials with procurement'
                        ]),
                        status: m > 1 ? pick(['Done', 'Done', 'Open']) : 'Open',
                        owner: c.cxm || pick(SALES_OWNERS),
                        due_date: monthsAgo(m - 1, 20)
                    }, ADMIN);
                    actions += 1;
                }
            }
        }
        log(`health calls: +${calls}, actionables: +${actions}`);
    }

    /* ---- training: trainees, sessions, enrolments ------------------------ */
    if (run('training')) {
        const courses = await trainingRepo.listCourses();
        const courseKeys = courses.map((c) => c.course_key ?? c.key).filter(Boolean);
        let trainees = 0, sessions = 0, enrolments = 0;
        const trainerIds = [];
        for (const t of TRAINERS) {
            try {
                const r = await trainingRepo.addTrainer({ name: t, email: `${t.split(' ')[0].toLowerCase()}@cashhorizon.io`, specialties: [] });
                trainerIds.push(r?.trainer?.id ?? r?.id);
            } catch { /* already present */ }
        }
        for (const c of customers) {
            for (let i = 0; i < int(3, 6); i++) {
                const name = `${pick(FIRST)} ${pick(LAST)}`;
                const r = await trainingRepo.addTrainee({
                    account: c.name, name,
                    email: `${name.toLowerCase().replace(/\s+/g, '.')}@${c.name.toLowerCase().replace(/[^a-z]/g, '')}.com`,
                    role: pick(ROLES)
                }, ADMIN);
                const traineeId = r?.trainee?.id ?? r?.id;
                trainees += 1;
                if (!traineeId || !courseKeys.length) continue;
                for (const key of [pick(courseKeys), pick(courseKeys)]) {
                    try {
                        await trainingRepo.createEnrollment({
                            account: c.name, course_key: key, trainee_id: traineeId,
                            trainer_id: trainerIds.filter(Boolean).length ? pick(trainerIds.filter(Boolean)) : undefined,
                            status: pick(['Completed', 'Certified', 'In progress', 'Enrolled'])
                        }, ADMIN);
                        enrolments += 1;
                    } catch { /* duplicate course for this trainee */ }
                }
            }
            // Sessions spread over the period, with a completion funnel that improves.
            for (let m = MONTHS_BACK - 1; m >= 0; m -= 2) {
                const enrolled = int(6, 18);
                const rate = 0.45 + (MONTHS_BACK - m) * 0.05;
                const completed = Math.min(enrolled, Math.round(enrolled * Math.min(rate, 0.9)));
                await trainingRepo.create({
                    title: pick(courses)?.title || 'Platform essentials',
                    account: c.name, trainer: pick(TRAINERS), format: chance(0.7) ? 'Virtual' : 'Offline',
                    status: m === 0 ? pick(['Scheduled', 'In progress']) : 'Completed',
                    session_date: monthsAgo(m, 18), enrolled, completed: m === 0 ? 0 : completed,
                    certified: m === 0 ? 0 : Math.round(completed * 0.6)
                }, ADMIN);
                sessions += 1;
            }
        }
        log(`trainees: +${trainees}, enrolments: +${enrolments}, sessions: +${sessions}`);
    }

    /* ---- surveys --------------------------------------------------------- */
    if (run('surveys')) {
        // A campaign belongs to one account here, so a monthly "pulse" is several
        // campaigns — one per account sampled that month.
        let campaigns = 0, responses = 0;
        for (let m = MONTHS_BACK - 1; m >= 0; m--) {
            const type = pick(['NPS', 'NPS', 'CSAT', 'CES']);
            for (const account of shuffle(names).slice(0, int(2, 4))) {
            const c = await surveyRepo.createCampaign({
                account,
                title: `${type} pulse — ${monthsAgo(m, 1).slice(0, 7)}`, type,
                question: type === 'NPS' ? 'How likely are you to recommend us?' : 'How was your experience?',
                status: 'Live'
            }, ADMIN);
            const id = c?.campaign?.id;
            if (!id) continue;
            campaigns += 1;
            const sent = int(40, 90);
            await surveyRepo.send(id, sent, ADMIN);
            // The repo stamps created_at with now() — correct for live use, wrong for
            // a seeder rebuilding history, so the date is corrected in the spread pass.
            await db.run('UPDATE survey_campaigns SET created_at = ?, sent_at = ? WHERE id = ?', [iso(monthsAgo(m, 3)), iso(monthsAgo(m, 3)), id]);
            for (let i = 0; i < int(8, 16); i++) {
                // Sentiment improves slightly over time so NPS has a direction.
                const lean = (MONTHS_BACK - m) / MONTHS_BACK;
                const score = type === 'NPS' ? (chance(0.45 + lean * 0.2) ? int(9, 10) : chance(0.6) ? int(7, 8) : int(0, 6))
                    : type === 'CSAT' ? (chance(0.6 + lean * 0.15) ? int(4, 5) : int(1, 3))
                        : int(2, 6);
                await surveyRepo.addResponse(id, {
                    respondent: `${pick(FIRST)} ${pick(LAST)}`, score,
                    comment: score >= (type === 'NPS' ? 9 : 4)
                        ? 'Rollout went smoothly and support has been responsive.'
                        : score <= (type === 'NPS' ? 6 : 2)
                            ? 'Reporting is still hard to navigate and the last release broke a saved view.'
                            : 'Works well overall, a few rough edges in the export flow.'
                }, ADMIN);
                responses += 1;
            }
            // Same reason as the campaign above: put the replies in their real month.
            await db.run("UPDATE survey_responses SET created_at = ? WHERE campaign_id = ? AND created_at > ?",
                [iso(monthsAgo(m, 14)), id, iso(monthsAgo(m, 14))]);
            }
        }
        log(`survey campaigns: +${campaigns}, responses: +${responses}`);
    }

    /* ---- expansion, referrals, comms, events, features -------------------- */
    if (run('engagement')) {
        let deals = 0;
        for (let m = MONTHS_BACK - 1; m >= 0; m--) {
            for (let i = 0; i < int(1, 3); i++) {
                const stage = m > 2 ? pick(['Won', 'Won', 'Lost', 'Negotiation']) : pick(['Identified', 'Qualified', 'Proposed', 'Negotiation', 'Won']);
                await expansionRepo.create({
                    account: pick(names), title: pick(['Add Conformity module', 'Seat expansion — ops team', 'Premium support upgrade', 'Vendor Pulse rollout', 'Additional entity onboarding']),
                    type: pick(['Cross-sell', 'Upsell', 'Seat expansion']), stage,
                    value_amount: int(4, 30) * 100000, currency: 'INR',
                    target_close: monthsAgo(m - 2, 20), owner: pick(SALES_OWNERS),
                    created_at: iso(monthsAgo(m))
                }, ADMIN);
                deals += 1;
            }
        }
        log(`expansion deals: +${deals}`);

        let leads = 0, nudges = 0;
        for (const c of customers) {
            if (chance(0.75)) {
                await referralRepo.addNudge({
                    account: c.name, nudged_at: monthsAgo(int(0, 5), 10),
                    response: pick(['Happy to introduce two peers at the NBFC forum.', 'Wants to wait until after their go-live.', 'Asked for a case study first.', 'Declined for now — internal policy on vendor references.']),
                    outcome: pick(['Agreed', 'Agreed', 'Later', 'Declined'])
                }, ADMIN);
                nudges += 1;
            }
            for (let i = 0; i < int(0, 3); i++) {
                await referralRepo.create({
                    account: c.name, referred_name: `${pick(['Sterling', 'Vertex', 'Crescent', 'Beacon', 'Trident'])} ${pick(['Finance', 'Capital', 'Credit', 'Lending'])}`,
                    contact: `${pick(FIRST).toLowerCase()}@example.com`,
                    // REFERRAL_STATUSES only — the repo doesn't validate (that lives in
                // the route layer), so an invented status would persist silently.
                status: pick(['New', 'Contacted', 'Qualified', 'Converted', 'Converted', 'Declined', 'Declined']),
                    value_amount: int(5, 40) * 100000, currency: 'INR', owner: pick(SALES_OWNERS)
                }, ADMIN);
                leads += 1;
            }
        }
        log(`referral leads: +${leads}, nudges: +${nudges}`);

        let comms = 0;
        for (let m = MONTHS_BACK - 1; m >= 0; m--) {
            for (let i = 0; i < int(1, 3); i++) {
                const recipients = int(120, 600);
                const c = await commsRepo.create({
                    account: pick(names), title: pick(['Release notes', 'Quarterly product update', 'Maintenance window notice', 'Webinar invitation', 'Security advisory']),
                    type: pick(['Newsletter', 'Product update', 'Announcement']), status: 'Draft', recipients
                }, ADMIN);
                const id = c?.comm?.id;   // commsRepo returns { comm }, not { campaign }
                comms += 1;
                if (!id || m === 0) continue;
                const openRate = 0.42 + (MONTHS_BACK - m) * 0.03;
                await commsRepo.send(id, {
                    sent_at: iso(monthsAgo(m, 8)),
                    opens: Math.round(recipients * Math.min(openRate, 0.78)),
                    clicks: Math.round(recipients * Math.min(openRate * 0.35, 0.3))
                }, ADMIN);
            }
        }
        log(`comms campaigns: +${comms}`);

        let events = 0;
        for (let m = MONTHS_BACK - 1; m >= -2; m--) {
            for (let i = 0; i < int(1, 2); i++) {
                const registered = int(40, 260);
                const past = m > 0;
                // create() deliberately starts every event at zero registrations —
                // the funnel only moves through update(), which clamps it.
                const ev = await eventRepo.create({
                    account: pick(names), title: pick(['NBFC Risk Forum', 'Product deep-dive', 'Customer advisory board', 'Compliance roundtable', 'Regional user meet']),
                    type: pick(['Webinar', 'Workshop', 'Roundtable', 'Conference']),
                    status: past ? 'Completed' : pick(['Planned', 'Registration open']),
                    starts_at: iso(monthsAgo(m, 14), 11), location: pick(['Mumbai', 'Bengaluru', 'Virtual', 'Delhi', 'Singapore']),
                    capacity: registered + int(10, 80),
                    host: pick(SALES_OWNERS)
                }, ADMIN);
                const evId = ev?.event?.id;
                if (evId) {
                    await eventRepo.update(evId, {
                        registered,
                        attended: past ? Math.round(registered * (0.55 + rnd() * 0.3)) : 0
                    }, ADMIN);
                }
                events += 1;
            }
        }
        log(`events: +${events}`);

        let features = 0;
        for (const title of FEATURE_TITLES) {
            const r = await featureRepo.create({
                account: pick(names), title,
                description: 'Raised during a customer working session; several accounts have asked for the same behaviour.',
                status: pick(['Requested', 'Requested', 'Under review', 'Planned', 'Shipped', 'Declined']),
                impact: pick(['Low', 'Medium', 'High']), effort: pick(['Low', 'Medium', 'High']),
                product_area: pick(['Reporting', 'Workflow', 'Integrations', 'Administration'])
            }, ADMIN);
            const id = r?.request?.id ?? r?.id;
            features += 1;
            if (!id) continue;
            for (const acct of names.slice(0, int(1, 5))) {
                try { await featureRepo.addSupporter(id, acct, ADMIN); } catch { /* already a supporter */ }
            }
        }
        log(`feature requests: +${features}`);
    }

    /* ---- onboarding + executive reviews ---------------------------------- */
    if (run('lifecycle')) {
        let started = 0, completed = 0;
        for (const c of customers) {
            const kickoff = monthsAgo(int(2, MONTHS_BACK), 5);
            const r = await onboardingRepo.start({ account: c.name, kickoff_date: kickoff, csm_name: c.cxm || '' }, ADMIN);
            if (r?.conflict || !r?.onboarding) continue;
            started += 1;
            // Most are live by now; the stage rows carry the dates the
            // time-to-onboard and time-to-value averages are computed from.
            if (chance(0.7)) {
                const liveOn = monthsAgo(int(0, 2), 20);
                await db.run("UPDATE onboardings SET status = 'Live', completed_at = ? WHERE id = ?", [iso(liveOn), r.onboarding.id]);
                const stages = await db.all('SELECT id FROM onboarding_stages WHERE onboarding_id = ? ORDER BY stage_no', [r.onboarding.id]);
                stages.forEach(async (s, i) => {
                    const done = monthsAgo(Math.max(0, int(2, MONTHS_BACK) - i), 10 + i);
                    await db.run("UPDATE onboarding_stages SET status = 'Done', completed_at = ?, started_at = ? WHERE id = ?",
                        [iso(done), iso(kickoff), s.id]);
                });
                completed += 1;
            }
        }
        log(`onboardings: +${started} (${completed} gone live)`);

        // Quarterly reviews for the quarters that have already closed, most of
        // them shared — an EBR nobody sent is a draft, not a review.
        let ebrs = 0, shared = 0;
        for (const q of ['2026-Q1', '2026-Q2']) {
            const r = await ebrRepo.generateAll({ quarter: q }, ADMIN).catch(() => null);
            const made = r?.generated ?? r?.created ?? 0;
            ebrs += made;
        }
        const drafts = await db.all("SELECT id FROM ebrs WHERE shared_at IS NULL OR shared_at = ''");
        for (const e of drafts) {
            if (!chance(0.75)) continue;
            await ebrRepo.share(e.id, ADMIN).catch(() => null);
            shared += 1;
        }
        log(`EBRs: +${ebrs} generated, ${shared} shared`);
    }

    /* ---- tidy the industry vocabulary ------------------------------------ */
    // The coverage chart groups on this string, so near-duplicates ('Gold Loan
    // NBFC' next to 'Gold Loan') split one bar into two and a blank shows up as
    // an 'Unspecified' slice that means nothing to a reader.
    if (run('tidy')) {
        await db.run("UPDATE customers SET industry = 'Gold Loan' WHERE industry = 'Gold Loan NBFC'");
        await db.run("UPDATE customers SET industry = 'NBFC' WHERE (industry IS NULL OR industry = '') AND type = 'Customer'");
        // 'Lost' was never a REFERRAL_STATUS; rows carrying it fall outside every
        // filter in referralRepo.stats and quietly distort the conversion rate.
        const bad = await db.run("UPDATE referral_leads SET status = 'Declined' WHERE status NOT IN ('New','Contacted','Qualified','Converted','Declined')");

        // An event created but never updated sits at zero registrations, which
        // reads as a failed event rather than an unpopulated record. Fill the
        // funnel for anything with a capacity, keeping attended <= registered.
        const empties = await db.all("SELECT id, capacity, starts_at, status FROM cx_events WHERE registered = 0 AND capacity > 0");
        for (const e of empties) {
            const registered = Math.max(10, Math.round(e.capacity * (0.55 + rnd() * 0.4)));
            const past = e.status === 'Completed' || (e.starts_at && e.starts_at < new Date().toISOString());
            await db.run('UPDATE cx_events SET registered = ?, attended = ? WHERE id = ?',
                [Math.min(registered, e.capacity), past ? Math.round(registered * (0.55 + rnd() * 0.3)) : 0, e.id]);
        }
        // Most campaigns sitting in Draft leaves the open-rate trend with almost no
        // points. Send the older ones so the series has something to plot; the
        // newest stay unsent, which is what a real queue looks like.
        const drafts = await db.all("SELECT id, recipients FROM comms_campaigns WHERE status = 'Draft' AND recipients > 0 ORDER BY id");
        let sent = 0;
        for (let i = 0; i < drafts.length; i++) {
            if (i >= Math.floor(drafts.length * 0.8)) break;   // leave a live queue
            const c = drafts[i];
            const bucket = Math.floor((i / drafts.length) ** 0.85 * MONTHS_BACK);
            const opens = Math.round(c.recipients * (0.4 + rnd() * 0.35));
            await db.run("UPDATE comms_campaigns SET status = 'Sent', sent_at = ?, opens = ?, clicks = ? WHERE id = ?",
                [iso(monthsAgo(Math.max(0, MONTHS_BACK - 1 - bucket), ((i * 5) % 26) + 1)), opens, Math.round(opens * (0.2 + rnd() * 0.3)), c.id]);
            sent += 1;
        }
        log(`normalised industry labels; repaired ${bad.changes} referral status(es), ${empties.length} empty event(s), sent ${sent} draft comm(s)`);
    }

    /* ---- spread the timestamps the repos stamped with now() -------------- */
    // expansionRepo.create, commsRepo.send and featureRepo.create all use the
    // wall clock, which is right for the API and wrong here: every row lands in
    // the current month and the month-over-month series come out as a single
    // spike. Redistributing by row id is deterministic and keeps the ordering.
    await spread(db, 'expansions', 'created_at');
    await spread(db, 'comms_campaigns', 'sent_at', "WHERE sent_at IS NOT NULL AND sent_at <> ''");
    await spread(db, 'feature_reqs', 'created_at');
    await spread(db, 'referral_leads', 'created_at');
    await spread(db, 'training_enrollments', 'enrolled_at');
    // Campaigns first, then pull every reply onto its own campaign's date plus a
    // few days — a response must never predate the survey that asked for it.
    await spread(db, 'survey_campaigns', 'created_at');
    // strftime, not datetime(): datetime() yields 'YYYY-MM-DD HH:MM:SS' while the
    // rest of the column is full ISO, and mixing the two makes string comparison
    // on the column lie (a space sorts before 'T').
    await db.run(`
        UPDATE survey_responses
           SET created_at = (
               SELECT strftime('%Y-%m-%dT%H:%M:%S.000Z', c.created_at, '+' || (survey_responses.id % 12) || ' days')
                 FROM survey_campaigns c WHERE c.id = survey_responses.campaign_id)
         WHERE campaign_id IN (SELECT id FROM survey_campaigns)`);
    await db.run("UPDATE survey_campaigns SET sent_at = created_at WHERE sent_at IS NOT NULL AND sent_at <> ''");
    log('backdated the now()-stamped tables across the window');

    /* ---- adoption for the new customers ---------------------------------- */
    try {
        await journeyRepo.seedSample(ADMIN);
        log('journey + adoption: refreshed');
    } catch (e) { log('journey seed skipped:', e.message); }

    /* ---- report ---------------------------------------------------------- */
    const after = await counts(db);
    console.log('\n  table                    before   after');
    for (const k of Object.keys(after)) {
        if (after[k] === before[k]) continue;
        console.log(`  ${k.padEnd(24)} ${String(before[k]).padStart(5)}  ${String(after[k]).padStart(6)}`);
    }
}

/** Fisher-Yates on a copy, using the seeded generator so runs stay reproducible. */
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * Redistribute a timestamp column evenly across the trailing window.
 *
 * Rows are walked oldest id first and dealt round-robin into the months, so the
 * spread is stable across runs and the newest rows still read as the newest.
 */
async function spread(db, table, col, where = '') {
    const rows = await db.all(`SELECT id FROM ${table} ${where} ORDER BY id`);
    if (!rows.length) return;
    for (let i = 0; i < rows.length; i++) {
        // Slight forward weighting: recent months carry a little more volume,
        // which is what a growing book actually looks like.
        const bucket = Math.floor((i / rows.length) ** 0.85 * MONTHS_BACK);
        const m = Math.max(0, MONTHS_BACK - 1 - bucket);
        await db.run(`UPDATE ${table} SET ${col} = ? WHERE id = ?`, [iso(monthsAgo(m, ((i * 7) % 26) + 1)), rows[i].id]);
    }
}

async function counts(db) {
    const tables = ['customers', 'contracts', 'support_tickets', 'health_calls', 'health_check_actions',
        'training_sessions', 'training_trainees', 'training_enrollments', 'survey_campaigns', 'survey_responses',
        'expansions', 'referral_leads', 'referral_nudges', 'comms_campaigns', 'cx_events', 'feature_reqs'];
    const out = {};
    for (const t of tables) out[t] = (await db.get(`SELECT COUNT(*) c FROM ${t}`)).c;
    return out;
}

main().then(() => { console.log('\n  done'); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
