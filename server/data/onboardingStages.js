/**
 * The five onboarding stages, in order.
 *
 * `defaultDays` is days from kickoff, and becomes each stage's due date when an
 * onboarding starts — so every stage is time-bound from the moment it exists
 * rather than acquiring a deadline later, when it's already late.
 *
 * Stage 2 has no fixed tasks: its checklist is generated from what the customer
 * actually bought in CLM (see buildStageTwoTasks).
 */
export const STAGES = [
    {
        no: 1,
        name: 'Kickoff call',
        blurb: 'Kickoff with the customer’s stakeholders, and share the onboarding deck.',
        defaultDays: 7,
        tasks: [
            { label: 'Schedule kickoff with customer stakeholders', party: 'Zeron' },
            { label: 'Confirm attendees and roles (SPOCs identified)', party: 'Joint' },
            { label: 'Run the kickoff call', party: 'Joint' },
            { label: 'Upload the onboarding deck to the document library', party: 'Zeron' },
            { label: 'Circulate minutes and agreed timelines', party: 'Zeron' }
        ]
    },
    {
        no: 2,
        name: 'SaaS instance handover',
        blurb: 'Create the instance and enable exactly the modules that were sold.',
        defaultDays: 14,
        // One "Enable <module> access" task per subscribed product, on top of the
        // fixed instance setup.
        generate: 'modules',
        tasks: [
            { label: 'Create the customer’s SaaS instance', party: 'Zeron' },
            { label: 'Configure tenant, domains and SSO', party: 'Zeron' },
            { label: 'Create admin users and hand over credentials', party: 'Zeron' }
        ]
    },
    {
        no: 3,
        name: 'Integrations & deliverables',
        blurb: 'Each integration/deliverable from the scope, taken through its lifecycle.',
        defaultDays: 30,
        // Every named item in the scope becomes a task with its lifecycle subtasks.
        generate: 'integrations',
        tasks: [
            { label: 'Joint integration working session', party: 'Joint' },
            { label: 'Sign off enablement with the customer', party: 'Joint' }
        ]
    },
    {
        no: 4,
        name: 'Training',
        blurb: 'Get the customer’s team productive on what they bought.',
        defaultDays: 45,
        tasks: [
            { label: 'Agree training plan and audience', party: 'Joint' },
            { label: 'Admin training session', party: 'Zeron' },
            { label: 'End-user training session', party: 'Zeron' },
            { label: 'Share recordings and training material', party: 'Zeron' },
            { label: 'Confirm the customer’s team is self-sufficient', party: 'Customer' }
        ]
    },
    {
        no: 5,
        name: 'Support portal handover',
        blurb: 'Hand the customer to steady-state support.',
        defaultDays: 60,
        tasks: [
            { label: 'Create support portal accounts for the customer', party: 'Zeron' },
            { label: 'Walk through raising and tracking a ticket', party: 'Joint' },
            { label: 'Share SLAs and escalation matrix', party: 'Zeron' },
            { label: 'Introduce the CSM and support owners', party: 'Zeron' },
            { label: 'Customer confirms handover complete', party: 'Customer' }
        ]
    },
    {
        /*
         * Time to value.
         *
         * Live is not the same as useful: a customer can be fully provisioned,
         * trained and handed over while never having done the thing they bought
         * the platform to do. This stage closes only when they have — which is
         * what makes time-to-value a real measurement rather than a synonym for
         * time-to-onboard.
         *
         * It runs alongside the others rather than after them: the first use case
         * is often achievable well before the last handover.
         */
        no: 6,
        name: 'First value realised',
        blurb: 'The customer achieves the first use case they bought this for.',
        defaultDays: 75,
        valueStage: true,
        tasks: [
            { label: 'Agree the first use case with the customer', party: 'Joint' },
            { label: 'Define what "achieved" looks like — the success criteria', party: 'Joint' },
            { label: 'Customer runs the use case on their own data', party: 'Customer' },
            { label: 'First use case achieved — value realised', party: 'Joint' },
            { label: 'Customer confirms the outcome in their own words', party: 'Customer' }
        ]
    }
];

/** The stage whose completion marks value realised, for the TTV metric. */
export const VALUE_STAGE_NO = STAGES.find((s) => s.valueStage)?.no ?? null;

/**
 * Stage deadlines, in days from kickoff.
 *
 * Deliberately NOT driven by support tier: the tier a customer buys governs how
 * fast their tickets get answered once they're live, which belongs to Support.
 * How long it takes to bring them live is a function of how much they bought and
 * how fast both teams move — not what they pay for a response SLA.
 *
 * These are starting points. The CX lead can move any date when they start the
 * onboarding, and the plan that is agreed is the plan that is stored.
 */
export const DEFAULT_PLAN = [7, 14, 30, 45, 60, 75];

/**
 * Scope stretches the plan. A customer enabling 12 frameworks cannot be held to
 * the same Stage 2 date as one enabling two, so past a threshold each extra item
 * buys a day — capped, so a huge scope can't push go-live into next year without
 * someone deciding that deliberately.
 */
export function suggestPlan(scopeItemCount = 0) {
    const over = Math.max(0, scopeItemCount - 5);
    const stretch = Math.min(over, 30); // one day per item past 5, up to 30
    if (!stretch) return [...DEFAULT_PLAN];
    // Stage 1 (kickoff) doesn't care how much was sold; everything after does.
    return DEFAULT_PLAN.map((d, i) => (i === 0 ? d : d + stretch));
}

export const STAGE_STATUSES = ['Pending', 'In progress', 'Blocked', 'Done'];
export const ONBOARDING_STATUSES = ['Not started', 'In progress', 'Blocked', 'Live'];
export const PARTIES = ['Zeron', 'Customer', 'Joint'];

/**
 * Stage 2 — module enablement. One "Enable <module> access" task per product the
 * customer subscribed to. Which modules they have is the whole point of scoping at
 * contract time; here each becomes something to switch on.
 */
export function buildStageTwoTasks(scope, productDefs) {
    const seen = new Set();
    const tasks = [];
    for (const s of scope) {
        const def = productDefs[s.product_key];
        if (!def || seen.has(def.key)) continue;
        seen.add(def.key);
        tasks.push({ label: `Enable ${def.name} access`, product_key: def.key, party: 'Zeron' });
    }
    return tasks;
}

/**
 * Stage 3 — integrations & deliverables. Every named item in the scope becomes a
 * MAIN task, and each carries the delivery lifecycle for its product as subtasks
 * (Interno: pre-reqs → credentials → connectivity → data validation → ingestion →
 * KPI/use case). A product may also add a `finalTasks` entry once (Interno ends
 * with dashboard generation). `subtasks` are handled by the repo when it seeds.
 */
export function buildStageThreeTasks(scope, productDefs) {
    const out = [];
    for (const s of scope) {
        const def = productDefs[s.product_key];
        if (!def) continue;
        if (def.itemLabel && s.items?.length) {
            for (const item of s.items) {
                out.push({
                    label: `${def.name}: ${item}`,
                    product_key: def.key,
                    party: 'Zeron',
                    subtasks: (def.itemSubtasks || []).map((l) => ({ label: l, party: 'Zeron' }))
                });
            }
        }
        for (const ft of (def.finalTasks || [])) {
            out.push({ label: `${def.name}: ${ft}`, product_key: def.key, party: 'Zeron' });
        }
    }
    return out;
}
