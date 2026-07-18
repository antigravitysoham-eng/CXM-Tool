import { apiScopeFor } from '../agents/registry.js';

/**
 * The catalogue of operations an agent may call.
 *
 * One definition, rendered into every manifest format (OpenAPI, OpenAI tools,
 * MCP, skill card) — the same pattern as products and stages: describe it once,
 * generate the surface. Only read operations appear here; agent writes go through
 * the human approval queue (a later phase) and are not in any manifest.
 *
 * `segment` maps to the agent ceiling: an op is in an agent's manifest only if
 * that agent may reach its segment (NEO='*' → all of them).
 */
export const AGENT_OPERATIONS = [
    // ---- accounts (Aukat) ----
    {
        id: 'listAccounts', segment: 'accounts', method: 'GET', path: '/accounts',
        summary: 'List the accounts you can see — customers, prospects and partners, already scoped to your permissions.',
        query: [
            { name: 'segment', desc: "Filter by segment: 'Customer', 'Prospect' or 'Partner'." },
            { name: 'region', desc: 'Filter by global region (APAC, EMEA, AMER, …).' }
        ],
        returns: 'An array of account objects with value, stage, MEDDICC score, owner, health.'
    },
    {
        id: 'accountsMeta', segment: 'accounts', method: 'GET', path: '/accounts/meta',
        summary: 'The allowed values for account fields (segments, stages, regions, tiers).',
        returns: 'Enum lists used when reading or filtering accounts.'
    },

    // ---- CLM / contracts (AURA) ----
    {
        id: 'listContracts', segment: 'contracts', method: 'GET', path: '/contracts',
        summary: 'List contracts (CLM), scoped to your accounts.',
        query: [
            { name: 'account', desc: 'Filter to one account name.' },
            { name: 'status', desc: "Filter by status: 'Active', 'Renewing', 'Expired', 'Churned'." }
        ],
        returns: 'Contracts with value, deployment, renewal date and days-to-renewal.'
    },
    {
        id: 'renewalTriggers', segment: 'contracts', method: 'GET', path: '/contracts/renewal-triggers',
        summary: 'Contracts inside a 90/60/30-day renewal window, each with the generated customer + CSM emails.',
        returns: 'Upcoming renewals with their trigger emails.'
    },
    {
        id: 'customer360', segment: 'contracts', method: 'GET', path: '/contracts/customer-360/{account}',
        summary: 'The full file for one customer: contracts, stakeholders, documents and product scope.',
        pathParams: [{ name: 'account', desc: 'The account name.' }],
        returns: 'A 360° view of the customer.'
    },

    // ---- invoices (AURA) ----
    {
        id: 'listInvoices', segment: 'invoices', method: 'GET', path: '/invoices',
        summary: 'List invoices for your accounts, with derived overdue status.',
        query: [{ name: 'account', desc: 'Filter to one account.' }, { name: 'status', desc: 'Filter by status.' }],
        returns: 'Invoices with amount, due date, and whether they are overdue.'
    },
    {
        id: 'invoiceStats', segment: 'invoices', method: 'GET', path: '/invoices/stats',
        summary: 'Receivables rollup: outstanding, overdue and collected, with ageing buckets.',
        returns: 'Aggregate AR figures.'
    },

    // ---- documents (DOXY) ----
    {
        id: 'listDocuments', segment: 'documents', method: 'GET', path: '/documents',
        summary: 'Search the document library across your accounts.',
        query: [
            { name: 'account', desc: 'Filter to one account.' },
            { name: 'doc_type', desc: 'Filter by document type (Service Agreement, NDA, …).' },
            { name: 'q', desc: 'Full-text search over name, description and filename.' }
        ],
        returns: 'Document metadata (never the file bytes).'
    },
    {
        id: 'documentStats', segment: 'documents', method: 'GET', path: '/documents/stats',
        summary: 'Library rollup by category and type.',
        returns: 'Counts and sizes across the library.'
    },

    // ---- onboarding (Pilot) ----
    {
        id: 'listOnboarding', segment: 'onboarding', method: 'GET', path: '/onboarding',
        summary: 'List active onboardings with progress, current stage and days-to-go-live.',
        returns: 'Onboardings rolled up per customer.'
    },
    {
        id: 'onboardingStats', segment: 'onboarding', method: 'GET', path: '/onboarding/stats',
        summary: 'Portfolio view: in-progress, at-risk, blocked, plus time-to-onboard and time-to-value.',
        returns: 'Aggregate onboarding health.'
    },

    // ---- NEO: natural language over everything ----
    {
        id: 'askNeo', segment: 'neo', method: 'POST', path: '/neo/ask',
        summary: 'Ask NEO a question in plain English about the book — pipeline, renewals, an account, documents. Returns a written answer plus the same metric cards and charts the dashboard shows. Read-only.',
        body: { prompt: { type: 'string', desc: 'Your question, e.g. "what renews in 60 days?"' } },
        returns: 'A reply, render blocks (stats/charts/tables), and which specialist answered.'
    }
];

/** The operations a given agent identity is allowed to call. */
export function operationsForAgent(agentKey) {
    const scope = apiScopeFor(agentKey);
    if (scope === '*') return AGENT_OPERATIONS;
    if (!Array.isArray(scope) || !scope.length) return [];
    return AGENT_OPERATIONS.filter((op) => scope.includes(op.segment));
}
