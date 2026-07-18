import { apiScopeFor } from '../agents/registry.js';

/**
 * The catalogue of operations an agent may call.
 *
 * One definition, rendered into every manifest format (OpenAPI, OpenAI tools,
 * MCP, skill card) — the same pattern as products and stages: describe it once,
 * generate the surface.
 *
 * Read operations are available to any agent key. Operations flagged `write:true`
 * are available ONLY to a write-provisioned key, and even then they do not execute
 * on call — they file a proposal in the human approval queue. So a write op in a
 * manifest means "your agent may PROPOSE this", never "your agent may do this".
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
    {
        id: 'createAccount', segment: 'accounts', method: 'POST', path: '/accounts', write: true,
        summary: 'Propose a new account (customer, prospect or partner). Does NOT create it — files a proposal a human must approve. Read the returned proposal id to track it.',
        body: {
            name: { type: 'string', desc: 'Account name (required).' },
            type: { type: 'string', desc: "'Customer', 'Prospect' or 'Partner'." },
            region: { type: 'string', desc: 'Global region (APAC, EMEA, AMER, …).' }
        },
        returns: 'A pending proposal — { proposal: { id, status: "pending", … } }.'
    },
    {
        id: 'updateAccount', segment: 'accounts', method: 'PATCH', path: '/accounts/{id}', write: true,
        summary: 'Propose changes to one account. Does NOT apply them — files a proposal a human must approve.',
        pathParams: [{ name: 'id', desc: 'The account id.' }],
        body: { stage: { type: 'string', desc: 'Pipeline stage.' }, next_step: { type: 'string', desc: 'Next step note.' } },
        returns: 'A pending proposal — { proposal: { id, status: "pending", … } }.'
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

    // ---- support (Medic) ----
    {
        id: 'listTickets', segment: 'support', method: 'GET', path: '/support',
        summary: 'List support tickets for your accounts, each carrying its derived SLA state (breached, at-risk) against the account tier × priority.',
        query: [
            { name: 'account', desc: 'Filter to one account.' },
            { name: 'status', desc: "Filter by status: 'Open', 'In Progress', 'Waiting on Customer', 'Resolved', 'Closed'." },
            { name: 'priority', desc: "Filter by priority: 'Urgent', 'High', 'Normal', 'Low'." },
            { name: 'breached', desc: "'true' → only tickets past their SLA." }
        ],
        returns: 'Tickets with priority, tier, SLA due dates and breach/at-risk flags.'
    },
    {
        id: 'ticketStats', segment: 'support', method: 'GET', path: '/support/stats',
        summary: 'Support desk rollup: open/resolved, SLA breaches, at-risk, average response and resolution time, and SLA attainment by tier.',
        returns: 'Aggregate SLA health for the support desk.'
    },

    // ---- training (Sensei) ----
    {
        id: 'listTraining', segment: 'training', method: 'GET', path: '/training',
        summary: 'List training sessions for your accounts, each with its learner funnel (enrolled/completed/certified), completion rate and stalled flag.',
        query: [
            { name: 'account', desc: 'Filter to one account.' },
            { name: 'status', desc: "Filter by status: 'Scheduled', 'In Progress', 'Completed', 'Delayed', 'Cancelled'." },
            { name: 'format', desc: "Filter by format: 'Webinar', 'On-site', 'Self-paced', 'Workshop'." }
        ],
        returns: 'Training sessions with completion/certification rates and stalled flag.'
    },
    {
        id: 'trainingStats', segment: 'training', method: 'GET', path: '/training/stats',
        summary: 'Enablement rollup: the enrolled→completed→certified funnel, completion and certification rates, stalled sessions, and under-enabled accounts.',
        returns: 'Aggregate enablement health.'
    },
    {
        id: 'trainingCourses', segment: 'training', method: 'GET', path: '/training/courses',
        summary: 'The training course catalogue — module-wise, Foundation→Advanced, per-seat priced.',
        query: [{ name: 'module', desc: 'Filter to one product module.' }, { name: 'level', desc: 'Filter by level.' }],
        returns: 'Courses with module, level, duration and seat price.'
    },
    {
        id: 'trainingRevenue', segment: 'training', method: 'GET', path: '/training/revenue',
        summary: 'Training revenue rollup — bookings, ARR/MRR, collected vs pending, and bookings by module. A separate cash flow, computed only from training.',
        returns: 'Aggregate training revenue.'
    },
    {
        id: 'trainingEnrollments', segment: 'training', method: 'GET', path: '/training/enrollments',
        summary: 'Course enrollments for your accounts — trainee, course, assigned trainer and status.',
        query: [{ name: 'account', desc: 'Filter to one account.' }, { name: 'status', desc: 'Filter by enrollment status.' }],
        returns: 'Enrollments with trainee, course, trainer and status.'
    },

    // ---- health checks (Pulse) ----
    {
        id: 'healthAccounts', segment: 'health-checks', method: 'GET', path: '/health-checks/accounts',
        summary: 'The vendor-health board — every customer with its tier-driven call cadence (Enterprise monthly, Premium every 2 months, Standard every 4), next-due/overdue date, latest signal (Green/Amber/Red), trend and open actionables.',
        returns: 'Per-customer health rollup, sorted overdue-then-signal.'
    },
    {
        id: 'healthStats', segment: 'health-checks', method: 'GET', path: '/health-checks/stats',
        summary: 'Portfolio health rollup: accounts, overdue checks, red/amber/green counts, never-checked, worsening, and open actionables.',
        returns: 'Aggregate vendor-health metrics.'
    },
    {
        id: 'healthCalls', segment: 'health-checks', method: 'GET', path: '/health-checks/calls',
        summary: 'The health-check call log for your customers — each call with its signal, sentiment, summary of what was discussed, and the actionables carried to the next check.',
        query: [{ name: 'account', desc: 'Filter to one account.' }],
        returns: 'Health-check calls with summary and actionables.'
    },

    // ---- EBRs (Aria) ----
    {
        id: 'ebrCoverage', segment: 'ebrs', method: 'GET', path: '/ebrs/coverage',
        summary: 'The quarterly EBR coverage board — for the quarter, which customers have an Executive Business Review generated, which have been shared, and the portfolio rollup (generated / shared / pending / not-started).',
        query: [{ name: 'quarter', desc: 'Quarter key, e.g. 2026-Q3 (defaults to the current quarter).' }],
        returns: 'Per-customer EBR status plus quarterly coverage totals.'
    },
    {
        id: 'listEbrs', segment: 'ebrs', method: 'GET', path: '/ebrs',
        summary: 'List Executive Business Reviews for your customers — each a quarterly snapshot with its metrics, insights and areas for improvement.',
        query: [
            { name: 'account', desc: 'Filter to one account.' },
            { name: 'quarter', desc: 'Filter to one quarter (e.g. 2026-Q3).' },
            { name: 'status', desc: "Filter by status: 'Draft', 'Generated', 'Shared'." }
        ],
        returns: 'EBRs with metrics snapshot, insights and improvements.'
    },

    // ---- surveys (Echo) ----
    {
        id: 'surveyStats', segment: 'surveys', method: 'GET', path: '/surveys/stats',
        summary: 'Voice-of-customer rollup — NPS, CSAT and CES headline scores, response rate, sentiment split and the detractor count across your customers.',
        returns: 'Aggregate survey sentiment metrics.'
    },
    {
        id: 'listSurveys', segment: 'surveys', method: 'GET', path: '/surveys',
        summary: 'List survey campaigns for your customers, each with its response count, headline score and sentiment split.',
        query: [{ name: 'account', desc: 'Filter to one account.' }, { name: 'status', desc: "Filter by status: 'Draft', 'Live', 'Closed'." }],
        returns: 'Survey campaigns with derived scores.'
    },
    {
        id: 'surveyDetractors', segment: 'surveys', method: 'GET', path: '/surveys/detractors',
        summary: 'The detractor responses to follow up — negative-sentiment survey responses with the account, score and comment.',
        returns: 'Detractor responses.'
    },

    // ---- feature requests (Forge) ----
    {
        id: 'featureStats', segment: 'feature-requests', method: 'GET', path: '/feature-requests/stats',
        summary: 'Roadmap demand rollup — total / open / shipped requests, shipped rate, total demand, and the top-demanded features by RICE (reach x impact / effort).',
        returns: 'Aggregate feature-request demand metrics.'
    },
    {
        id: 'listFeatures', segment: 'feature-requests', method: 'GET', path: '/feature-requests',
        summary: 'List feature requests for your customers, each with its supporters, demand and RICE score.',
        query: [{ name: 'account', desc: 'Filter to one account.' }, { name: 'status', desc: 'Filter by status.' }, { name: 'product_area', desc: 'Filter by product area.' }],
        returns: 'Feature requests ranked by RICE.'
    },
    {
        id: 'featureBoard', segment: 'feature-requests', method: 'GET', path: '/feature-requests/board',
        summary: 'The roadmap board — feature requests grouped by pipeline status, each column ranked by RICE.',
        returns: 'Requests grouped by status.'
    },

    // ---- NEO: natural language over everything ----
    {
        id: 'askNeo', segment: 'neo', method: 'POST', path: '/neo/ask',
        summary: 'Ask NEO a question in plain English about the book — pipeline, renewals, an account, documents. Returns a written answer plus the same metric cards and charts the dashboard shows. Read-only.',
        body: { prompt: { type: 'string', desc: 'Your question, e.g. "what renews in 60 days?"' } },
        returns: 'A reply, render blocks (stats/charts/tables), and which specialist answered.'
    }
];

/**
 * The operations a given agent identity is allowed to call.
 *
 * Reads are always included. Write operations are included only when the key is
 * write-provisioned (`includeWrites`) — so a read-only key's manifest and its
 * enforced allowlist never even mention a write, and a write key's manifest lists
 * the writes it may PROPOSE.
 */
export function operationsForAgent(agentKey, { includeWrites = false } = {}) {
    const scope = apiScopeFor(agentKey);
    let ops;
    if (scope === '*') ops = AGENT_OPERATIONS;
    else if (!Array.isArray(scope) || !scope.length) ops = [];
    else ops = AGENT_OPERATIONS.filter((op) => scope.includes(op.segment));
    return includeWrites ? ops : ops.filter((op) => !op.write);
}
