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
        blurb: 'Create the instance and enable exactly what was sold.',
        defaultDays: 14,
        generated: true, // built from the CLM scope
        tasks: [
            { label: 'Create the customer’s SaaS instance', party: 'Zeron' },
            { label: 'Configure tenant, domains and SSO', party: 'Zeron' },
            { label: 'Create admin users and hand over credentials', party: 'Zeron' }
        ]
    },
    {
        no: 3,
        name: 'Integrations & deliverables',
        blurb: 'Joint work between the Zeron and customer teams, tracked through to enablement.',
        defaultDays: 30,
        tasks: [
            { label: 'Share integration pre-requisites with the customer', party: 'Zeron' },
            { label: 'Customer provisions API keys / service accounts', party: 'Customer' },
            { label: 'Network and firewall allowlisting', party: 'Customer' },
            { label: 'Joint integration working session', party: 'Joint' },
            { label: 'Validate data flowing end to end', party: 'Joint' },
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
    }
];

/**
 * Stage deadlines, in days from kickoff, per support tier.
 *
 * Enterprise runs longest, not shortest: those customers arrive with more
 * frameworks, more integrations and more stakeholders to get through, and a
 * plan that ignores that is late before it starts. These are starting points —
 * the CX lead can move any date when they start the onboarding, and the plan
 * that's agreed is the plan that's stored.
 */
export const STAGE_PLANS = {
    Standard: [7, 14, 30, 45, 60],
    Premium: [7, 17, 38, 56, 75],
    Enterprise: [10, 24, 52, 75, 90]
};

export const DEFAULT_TIER = 'Standard';

export const planFor = (tier) => STAGE_PLANS[tier] || STAGE_PLANS[DEFAULT_TIER];

/**
 * Scope stretches the plan. A customer enabling 12 frameworks cannot be held to
 * the same Stage 2 date as one enabling two, so past a threshold each extra item
 * buys a day — capped, so a huge scope can't push go-live into next year without
 * someone deciding that deliberately.
 */
export function suggestPlan(tier, scopeItemCount = 0) {
    const base = planFor(tier);
    const over = Math.max(0, scopeItemCount - 5);
    const stretch = Math.min(over, 30); // one day per item past 5, up to 30
    if (!stretch) return [...base];
    // Stage 1 (kickoff) doesn't care how much was sold; everything after does.
    return base.map((d, i) => (i === 0 ? d : d + stretch));
}

export const STAGE_STATUSES = ['Pending', 'In progress', 'Blocked', 'Done'];
export const ONBOARDING_STATUSES = ['Not started', 'In progress', 'Blocked', 'Live'];
export const PARTIES = ['Zeron', 'Customer', 'Joint'];

/**
 * Turns the CLM scope into Stage 2's enablement checklist.
 *
 * This is the whole point of scoping products at contract time: every framework,
 * integration and vendor count named in CLM arrives here as something to tick,
 * so nobody re-types it and nothing sold quietly goes un-provisioned.
 */
export function buildStageTwoTasks(scope, productDefs) {
    const tasks = [];
    for (const s of scope) {
        const def = productDefs[s.product_key];
        if (!def) continue;
        const verb = def.checklistVerb || 'Enable';

        if (def.checklist === 'per-item' && s.items?.length) {
            // Each named thing gets its own line — "3 frameworks" isn't a checklist.
            for (const item of s.items) {
                tasks.push({ label: `${def.name}: ${verb} — ${item}`, product_key: s.product_key, party: 'Zeron' });
            }
        } else if (s.unit_count > 0) {
            const noun = def.unitNoun || def.unitLabel.toLowerCase();
            tasks.push({
                label: `${def.name}: ${verb} ${s.unit_count} ${noun}`,
                product_key: s.product_key,
                party: 'Zeron'
            });
        } else {
            // Sold, but nobody said how much. Surface it rather than skip it.
            tasks.push({
                label: `${def.name}: confirm scope with the account team`,
                product_key: s.product_key,
                party: 'Zeron'
            });
        }
    }
    return tasks;
}
