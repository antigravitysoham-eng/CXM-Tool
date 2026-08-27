/**
 * The Zeron product catalogue and how each one is scoped.
 *
 * This is the single definition of a product's shape. CLM renders its scope form
 * from it, and Onboarding Stage 2 builds its enablement checklist from the same
 * entries — so a framework named at contract time becomes a tickable item at
 * instance-setup time without anyone re-typing it.
 *
 * `unitLabel`  — what the count means for this product.
 * `itemLabel`  — what each named thing is (null = count only, no names).
 * `checklist`  — how Stage 2 turns the scope into tasks:
 *      'per-item'  one task per named item (each framework, each integration)
 *      'per-unit'  one task for the product, carrying the count
 *
 * Onboarding generation (from the subscribed modules + their scope):
 *  Stage 2 — one "Enable <module> access" task per subscribed product.
 *  Stage 3 — for a per-item product, each named item becomes a MAIN task with
 *            `itemSubtasks` beneath it (the delivery lifecycle for that item),
 *            plus one `finalTasks` entry per product (e.g. Interno's dashboard).
 */
export const PRODUCTS = [
    {
        key: 'interno',
        name: 'Interno',
        blurb: 'Security posture, driven by your tool integrations.',
        unitLabel: 'Security tool integrations',
        itemLabel: 'Integration',
        itemPlaceholder: 'CrowdStrike, Okta, AWS GuardDuty, Jira…',
        checklist: 'per-item',
        checklistVerb: 'Enable and verify integration',
        color: '#818cf8',
        // Each integration goes through this lifecycle as subtasks…
        itemSubtasks: [
            'Pre-requisites sharing',
            'Credential gathering',
            'Connectivity testing',
            'Data validation',
            'Platform data ingestion',
            'KPI / KRI or use case generation'
        ],
        // …and Interno finishes with one dashboard for the whole product.
        finalTasks: ['Dashboard generation']
    },
    {
        key: 'conformity',
        name: 'Conformity',
        blurb: 'Compliance frameworks the customer is certifying against.',
        unitLabel: 'Frameworks',
        itemLabel: 'Framework',
        itemPlaceholder: 'ISO 27001, SOC 2 Type II, PCI DSS, RBI CSF…',
        checklist: 'per-item',
        checklistVerb: 'Enable framework',
        color: '#34d399',
        itemSubtasks: ['Gap assessment', 'Evidence collection', 'Control implementation', 'Internal audit readiness']
    },
    {
        key: 'vendor_pulse',
        name: 'Vendor Pulse',
        blurb: 'Third-party risk across the vendor base.',
        unitLabel: 'Vendors',
        itemLabel: null, // a count, not a list — nobody types 400 vendor names
        checklist: 'per-unit',
        checklistVerb: 'Provision platform for',
        unitNoun: 'vendors',
        color: '#38bdf8'
    },
    {
        key: 'zak_services',
        name: 'ZAK - Services',
        blurb: 'Delivered services engaged under the contract.',
        unitLabel: 'Services',
        itemLabel: 'Service',
        itemPlaceholder: 'VAPT, Red Team, Cloud Security Review…',
        checklist: 'per-item',
        checklistVerb: 'Scope and schedule',
        color: '#fbbf24',
        itemSubtasks: ['Scoping', 'Scheduling', 'Delivery', 'Report & sign-off']
    },
    {
        key: 'agentctl',
        name: 'Agentctl',
        blurb: 'Governance over the customer’s AI agents.',
        unitLabel: 'AI agents to be governed',
        itemLabel: 'AI agent source',
        itemPlaceholder: 'OpenAI, Anthropic, Azure OpenAI, in-house…',
        checklist: 'per-item',
        checklistVerb: 'Connect and govern source',
        color: '#c084fc',
        itemSubtasks: ['Connect source', 'Policy configuration', 'Guardrail testing', 'Go-live']
    },
    {
        key: 'certifications',
        name: 'Certifications',
        blurb: 'Certifications the customer is pursuing.',
        unitLabel: 'Certifications',
        itemLabel: 'Certification',
        itemPlaceholder: 'ISO 27701, CMMI, StateRAMP…',
        checklist: 'per-item',
        checklistVerb: 'Kick off certification',
        color: '#f472b6',
        itemSubtasks: ['Readiness assessment', 'Documentation', 'Audit', 'Certification issued']
    },
    {
        key: 'others',
        name: 'Others',
        blurb: 'Anything not covered above — describe the unit.',
        unitLabel: 'Units',
        itemLabel: 'Item',
        itemPlaceholder: 'Name each unit…',
        needsInfo: true, // free-text description of what the unit actually is
        checklist: 'per-item',
        checklistVerb: 'Deliver',
        color: '#94a3b8'
    }
];

export const PRODUCT_KEYS = PRODUCTS.map((p) => p.key);
export const PRODUCT_BY_KEY = Object.fromEntries(PRODUCTS.map((p) => [p.key, p]));
export const productName = (key) => PRODUCT_BY_KEY[key]?.name || key;
