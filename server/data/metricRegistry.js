/**
 * The metric registry — one declaration per number the platform shows.
 *
 * Every KPI card on every module page is drillable, and a drill-down has to
 * answer three things: what does this mean, how was it worked out, and which
 * records produced it. Writing fifty bespoke handlers for that would guarantee
 * the explanations drift from the maths, so instead a metric is declared as:
 *
 *   source  — which table it reads and how to present a row of it
 *   filter  — which of those rows count
 *   measure — what each row contributes (omit for a plain count)
 *
 * and one generic builder in metricRepo turns that into rows + a total. Metrics
 * that genuinely can't be expressed that way (SLA breach, adoption, retention)
 * declare a `build` instead and do it themselves.
 *
 * Keys are `module.metric` so a page can ask for exactly what its card shows.
 */

/* ---------------------------------------------------------------------------
   Sources: where rows come from and how a row of that table is displayed.
   `account` is the column used to scope to what the caller may read.
   --------------------------------------------------------------------------- */
export const SOURCES = {
    accounts: {
        module: 'Accounts', route: '/cash-horizon', record: 'accounts', table: null, // supplied by the repo
        columns: [
            { key: 'name', label: 'Account' },
            { key: 'segment', label: 'Segment' },
            { key: 'tier', label: 'Tier' },
            { key: 'region', label: 'Region' },
            { key: 'health', label: 'Health' }
        ]
    },
    contracts: {
        module: 'Contracts (CLM)', route: '/clm', record: 'contracts', table: null,
        columns: [
            { key: 'account', label: 'Account' },
            { key: 'id', label: 'Contract' },
            { key: 'status', label: 'Status' },
            { key: 'renewal_date', label: 'Renews' }
        ]
    },
    tickets: {
        module: 'Support', route: '/support', record: 'tickets', table: 'support_tickets',
        columns: [
            { key: 'account', label: 'Account' },
            { key: 'ticket_no', label: 'Ticket' },
            { key: 'subject', label: 'Subject' },
            { key: 'priority', label: 'Priority' },
            { key: 'status', label: 'Status' },
            { key: 'opened_at', label: 'Opened', format: 'date' }
        ]
    },
    sessions: {
        module: 'Training', route: '/training', record: 'training sessions', table: 'training_sessions',
        columns: [
            { key: 'account', label: 'Account' },
            { key: 'title', label: 'Course' },
            { key: 'trainer', label: 'Trainer' },
            { key: 'status', label: 'Status' },
            { key: 'session_date', label: 'Date', format: 'date' }
        ]
    },
    enrollments: {
        module: 'Training', route: '/training', record: 'enrolments', table: 'training_enrollments',
        columns: [
            { key: 'account', label: 'Account' },
            { key: 'course_key', label: 'Course' },
            { key: 'status', label: 'Status' },
            { key: 'enrolled_at', label: 'Enrolled', format: 'date' }
        ]
    },
    calls: {
        module: 'Customer Health', route: '/health-checks', record: 'health calls', table: 'health_calls',
        columns: [
            { key: 'account', label: 'Account' },
            { key: 'check_date', label: 'Date', format: 'date' },
            { key: 'signal', label: 'Signal' },
            { key: 'sentiment', label: 'Sentiment' },
            { key: 'conducted_by', label: 'Held by' }
        ]
    },
    actionables: {
        module: 'Customer Health', route: '/health-checks', record: 'actionables', table: 'health_check_actions',
        columns: [
            { key: 'account', label: 'Account' },
            { key: 'text', label: 'Action' },
            { key: 'status', label: 'Status' },
            { key: 'owner', label: 'Owner' },
            { key: 'due_date', label: 'Due', format: 'date' }
        ]
    },
    ebrs: {
        module: 'Executive Reviews', route: '/ebrs', record: 'reviews', table: 'ebrs',
        columns: [
            { key: 'account', label: 'Account' },
            { key: 'quarter', label: 'Quarter' },
            { key: 'status', label: 'Status' },
            { key: 'shared_at', label: 'Shared', format: 'date' }
        ]
    },
    responses: {
        module: 'Voice of Customer', route: '/surveys', record: 'survey responses', table: 'survey_responses',
        columns: [
            { key: 'account', label: 'Account' },
            { key: 'respondent', label: 'Respondent' },
            { key: 'score', label: 'Score', align: 'right' },
            { key: 'sentiment', label: 'Sentiment' },
            { key: 'created_at', label: 'Received', format: 'date' }
        ]
    },
    campaigns: {
        module: 'Voice of Customer', route: '/surveys', record: 'survey campaigns', table: 'survey_campaigns',
        columns: [
            { key: 'account', label: 'Account' },
            { key: 'title', label: 'Campaign' },
            { key: 'type', label: 'Type' },
            { key: 'status', label: 'Status' },
            { key: 'sent_count', label: 'Sent', align: 'right' }
        ]
    },
    expansions: {
        module: 'Expansion', route: '/upsells', record: 'expansion deals', table: 'expansions',
        columns: [
            { key: 'account', label: 'Account' },
            { key: 'title', label: 'Opportunity' },
            { key: 'stage', label: 'Stage' },
            { key: 'probability', label: 'Win %', format: 'pct', align: 'right' }
        ]
    },
    features: {
        module: 'Product Demand', route: '/feature-requests', record: 'feature requests', table: 'feature_reqs',
        columns: [
            { key: 'account', label: 'Raised by' },
            { key: 'title', label: 'Request' },
            { key: 'status', label: 'Status' },
            { key: 'impact', label: 'Impact' },
            { key: 'votes', label: 'Votes', align: 'right' }
        ]
    },
    referrals: {
        module: 'Advocacy', route: '/referrals', record: 'referral leads', table: 'referral_leads',
        columns: [
            { key: 'account', label: 'Referred by' },
            { key: 'referred_name', label: 'Lead' },
            { key: 'status', label: 'Status' },
            { key: 'owner', label: 'Owner' }
        ]
    },
    nudges: {
        module: 'Advocacy', route: '/referrals', record: 'referral nudges', table: 'referral_nudges',
        columns: [
            { key: 'account', label: 'Account' },
            { key: 'outcome', label: 'Outcome' },
            { key: 'response', label: 'What they said' },
            { key: 'nudged_at', label: 'Asked', format: 'date' }
        ]
    },
    comms: {
        module: 'Communications', route: '/comms', record: 'campaigns', table: 'comms_campaigns',
        columns: [
            { key: 'account', label: 'Account' },
            { key: 'title', label: 'Campaign' },
            { key: 'status', label: 'Status' },
            { key: 'recipients', label: 'Recipients', align: 'right' },
            { key: 'sent_at', label: 'Sent', format: 'date' }
        ]
    },
    events: {
        module: 'Events', route: '/events', record: 'events', table: 'cx_events',
        columns: [
            { key: 'account', label: 'Account' },
            { key: 'title', label: 'Event' },
            { key: 'type', label: 'Type' },
            { key: 'status', label: 'Status' },
            { key: 'starts_at', label: 'Date', format: 'date' }
        ]
    },
    onboardings: {
        module: 'Onboarding', route: '/onboarding', record: 'onboardings', table: 'onboardings',
        columns: [
            { key: 'account', label: 'Account' },
            { key: 'status', label: 'Status' },
            { key: 'csm_name', label: 'CSM' },
            { key: 'kickoff_date', label: 'Kickoff', format: 'date' },
            { key: 'target_go_live', label: 'Target live', format: 'date' }
        ]
    },
    trainingSubs: {
        module: 'Training', route: '/training', record: 'training subscriptions', table: null,
        columns: [
            { key: 'account', label: 'Account' },
            { key: 'status', label: 'Status' },
            { key: 'billing_frequency', label: 'Billing' },
            { key: 'renewal_date', label: 'Renews', format: 'date' }
        ]
    },
    journeys: {
        module: 'Lifecycle & Adoption', route: '/journey', record: 'customer journeys', table: 'customer_journeys',
        columns: [
            { key: 'account', label: 'Account' },
            { key: 'stage', label: 'Stage' },
            { key: 'health', label: 'Health' },
            { key: 'owner', label: 'Owner' },
            { key: 'stage_entered_at', label: 'In stage since', format: 'date' }
        ]
    }
};

const OPEN_TICKET = (r) => !['Resolved', 'Closed'].includes(r.status);

/* ---------------------------------------------------------------------------
   Metrics. `format` drives how the headline value is rendered:
   num | inr | pct | days | hrs.
   --------------------------------------------------------------------------- */
export const METRICS = {
    /* ---- Accounts / pipeline ---- */
    'accounts.customers': {
        label: 'Customers', source: 'accounts', format: 'num',
        definition: 'Accounts that have converted and are being served.',
        formula: 'count of accounts where segment = Customer',
        filter: (a) => a.segment === 'Customer'
    },
    'accounts.pipeline': {
        label: 'Open pipeline', source: 'accounts', format: 'inr',
        definition: 'Total value of opportunities not yet won.',
        formula: 'Σ value of accounts where segment = Prospect',
        filter: (a) => a.segment === 'Prospect',
        measure: (a, ctx) => ctx.acctValue(a),
        extraColumns: [{ key: 'contribution', label: 'Value', format: 'inr', align: 'right' }]
    },
    'accounts.weighted': {
        label: 'Weighted pipeline', source: 'accounts', format: 'inr',
        definition: 'Open pipeline discounted by each deal\'s own win probability.',
        formula: 'Σ (prospect value × probability ÷ 100)',
        caveats: ['Probability is set on the account, not derived from the stage.'],
        filter: (a) => a.segment === 'Prospect',
        measure: (a, ctx) => (ctx.acctValue(a) * (a.probability || 0)) / 100,
        extraColumns: [
            { key: 'probability', label: 'Win %', format: 'pct', align: 'right' },
            { key: 'contribution', label: 'Weighted', format: 'inr', align: 'right' }
        ]
    },
    'accounts.atRisk': {
        label: 'At-risk customers', source: 'accounts', format: 'num',
        definition: 'Customers whose health the CSM has marked Poor or Critical.',
        formula: 'count of customers where health ∈ {Poor, Critical}',
        caveats: ['Health is a judgement recorded on the account, not a computed threshold.'],
        filter: (a) => a.segment === 'Customer' && (a.health === 'Poor' || a.health === 'Critical')
    },

    /* ---- Contracts ---- */
    'contracts.value': {
        label: 'Value under management', source: 'contracts', format: 'inr',
        definition: 'Recurring revenue committed on live contracts.',
        formula: 'Σ arr of contracts where status ∈ {Active, Renewing}',
        caveats: ['USD contracts are converted at the configured FX rate.'],
        filter: (c) => c.status === 'Active' || c.status === 'Renewing',
        measure: (c, ctx) => ctx.cVal(c),
        extraColumns: [{ key: 'contribution', label: 'ARR', format: 'inr', align: 'right' }]
    },
    'contracts.atRisk': {
        label: 'Revenue at risk', source: 'contracts', format: 'inr',
        definition: 'Contract value whose renewal date falls inside the next 90 days.',
        formula: 'Σ arr of contracts renewing in 0–90 days',
        filter: (c) => c.days_to_renewal !== null && c.days_to_renewal >= 0 && c.days_to_renewal <= 90,
        measure: (c, ctx) => ctx.cVal(c),
        extraColumns: [
            { key: 'days_to_renewal', label: 'Days left', align: 'right' },
            { key: 'contribution', label: 'ARR', format: 'inr', align: 'right' }
        ]
    },
    'contracts.renewals': {
        label: 'Renewals due', source: 'contracts', format: 'num',
        definition: 'Contracts reaching their renewal date within 90 days.',
        formula: 'count of contracts renewing in 0–90 days',
        filter: (c) => c.days_to_renewal !== null && c.days_to_renewal >= 0 && c.days_to_renewal <= 90,
        extraColumns: [{ key: 'days_to_renewal', label: 'Days left', align: 'right' }]
    },
    'contracts.autoRenew': {
        label: 'Auto-renew', source: 'contracts', format: 'num',
        definition: 'Live contracts that roll over automatically unless notice is served.',
        formula: 'count of contracts where auto_renew is true',
        filter: (c) => !!c.auto_renew,
        extraColumns: [{ key: 'notice_period_days', label: 'Notice (days)', align: 'right' }]
    },

    /* ---- Support ---- */
    'support.open': {
        label: 'Open tickets', source: 'tickets', format: 'num',
        definition: 'Tickets still being worked — anything not Resolved or Closed.',
        formula: 'count of tickets where status ∉ {Resolved, Closed}',
        filter: OPEN_TICKET
    },
    'support.total': {
        label: 'Total tickets', source: 'tickets', format: 'num',
        definition: 'Every ticket raised against the accounts you can see.',
        formula: 'count of all tickets',
        filter: () => true
    },
    'support.urgent': {
        label: 'Urgent tickets', source: 'tickets', format: 'num',
        definition: 'Open tickets raised at the highest priority.',
        formula: 'count of open tickets where priority = Urgent',
        filter: (r) => OPEN_TICKET(r) && r.priority === 'Urgent'
    },
    'support.unassigned': {
        label: 'Unassigned', source: 'tickets', format: 'num',
        definition: 'Open tickets with nobody named against them.',
        formula: 'count of open tickets with no assignee',
        filter: (r) => OPEN_TICKET(r) && !String(r.assignee || '').trim()
    },

    // SLA state is derived while the repo decorates a ticket, not stored, so
    // these read through supportRepo rather than the raw table.
    'support.breached': {
        label: 'Breaching SLA', source: 'tickets', format: 'num',
        definition: 'Tickets that missed their response or resolution target for the account\'s support tier.',
        formula: 'count of tickets flagged breached by the SLA matrix',
        caveats: ['The target depends on both ticket priority and the account\'s support tier.'],
        rowsFrom: (user, ctx) => ctx.supportList(user, {}),
        filter: (t) => !!t.breached,
        extraColumns: [{ key: 'support_tier', label: 'Tier' }]
    },
    'support.atRisk': {
        label: 'At risk', source: 'tickets', format: 'num',
        definition: 'Open tickets past 75% of their resolution window but not yet breached.',
        formula: 'count of open tickets flagged at_risk by the SLA matrix',
        rowsFrom: (user, ctx) => ctx.supportList(user, {}),
        filter: (t) => !!t.at_risk,
        extraColumns: [{ key: 'support_tier', label: 'Tier' }]
    },
    'support.slaAttainment': {
        label: 'SLA attainment', source: 'tickets', format: 'pct',
        definition: 'Share of resolved tickets that met their SLA.',
        formula: 'resolved tickets not breached ÷ all resolved tickets × 100',
        rowsFrom: (user, ctx) => ctx.supportList(user, {}),
        filter: (t) => !!t.resolved_at && !t.breached,
        ratioOf: (t) => !!t.resolved_at,
        extraColumns: [{ key: 'resolved_at', label: 'Resolved', format: 'date' }]
    },

    /* ---- Training ---- */
    'training.sessions': {
        label: 'Sessions', source: 'sessions', format: 'num',
        definition: 'Training sessions scheduled or delivered.',
        formula: 'count of training sessions',
        filter: () => true
    },
    'training.enrolled': {
        label: 'Learners enrolled', source: 'sessions', format: 'num',
        definition: 'Seats taken across every session.',
        formula: 'Σ enrolled across sessions',
        filter: (s) => (s.enrolled || 0) > 0,
        measure: (s) => s.enrolled || 0,
        extraColumns: [{ key: 'contribution', label: 'Enrolled', align: 'right' }]
    },
    'training.completed': {
        label: 'Learners completed', source: 'sessions', format: 'num',
        definition: 'Enrolled learners who finished the course.',
        formula: 'Σ completed across sessions',
        filter: (s) => (s.completed || 0) > 0,
        measure: (s) => s.completed || 0,
        extraColumns: [{ key: 'contribution', label: 'Completed', align: 'right' }]
    },
    'training.certified': {
        label: 'Certified', source: 'sessions', format: 'num',
        definition: 'Learners who passed certification, a subset of those who completed.',
        formula: 'Σ certified across sessions',
        filter: (s) => (s.certified || 0) > 0,
        measure: (s) => s.certified || 0,
        extraColumns: [{ key: 'contribution', label: 'Certified', align: 'right' }]
    },
    'training.stalled': {
        label: 'Stalled sessions', source: 'sessions', format: 'num',
        definition: 'Sessions with learners enrolled but nobody finishing.',
        formula: 'count of sessions where enrolled > 0 and completed = 0 and the date has passed',
        filter: (s) => (s.enrolled || 0) > 0 && !(s.completed || 0) && s.status !== 'Scheduled',
        extraColumns: [{ key: 'enrolled', label: 'Enrolled', align: 'right' }]
    },

    'training.completionRate': {
        label: 'Completion rate', source: 'sessions', format: 'pct',
        definition: 'Share of enrolled learners who finished their course.',
        // Learners, not sessions — a rate over sessions would weigh a cohort of
        // two the same as a cohort of forty, and would not match the card.
        formula: 'Σ completed ÷ Σ enrolled across all sessions × 100',
        filter: (s) => (s.enrolled || 0) > 0,
        ratioSum: { numerator: (s) => s.completed || 0, denominator: (s) => s.enrolled || 0 },
        emptyValue: 0,   // trainingRepo reports 0% with no learners, not "unknown"
        extraColumns: [
            { key: 'enrolled', label: 'Enrolled', align: 'right' },
            { key: 'completed', label: 'Completed', align: 'right' }
        ]
    },

    // Training is billed separately from the platform, so its revenue reads from
    // the subscription rows rather than contracts.
    'training.bookings': {
        label: 'Training bookings', source: 'trainingSubs', format: 'inr',
        definition: 'Total value of training subscriptions sold, excluding cancellations.',
        formula: 'Σ amount of training subscriptions where status ≠ Cancelled',
        rowsFrom: (user, ctx) => ctx.trainingSubs(user),
        filter: (s) => s.status !== 'Cancelled',
        measure: (s) => s.amount || 0,
        extraColumns: [{ key: 'contribution', label: 'Booked', format: 'inr', align: 'right' }]
    },
    'training.collected': {
        label: 'Collected', source: 'trainingSubs', format: 'inr',
        definition: 'Training revenue actually invoiced and received.',
        formula: 'Σ collected across training subscriptions',
        rowsFrom: (user, ctx) => ctx.trainingSubs(user),
        filter: (s) => (s.collected || 0) > 0,
        measure: (s) => s.collected || 0,
        extraColumns: [{ key: 'contribution', label: 'Collected', format: 'inr', align: 'right' }]
    },
    'training.pending': {
        label: 'Pending', source: 'trainingSubs', format: 'inr',
        definition: 'Training revenue booked but not yet collected.',
        formula: 'Σ (amount − collected) across training subscriptions',
        rowsFrom: (user, ctx) => ctx.trainingSubs(user),
        filter: (s) => (s.pending || 0) > 0,
        measure: (s) => s.pending || 0,
        extraColumns: [{ key: 'contribution', label: 'Outstanding', format: 'inr', align: 'right' }]
    },

    /* ---- Onboarding tiles ---- */
    'onboarding.atRisk': {
        label: 'At risk', source: 'onboardings', format: 'num',
        definition: 'Onboardings with at least one stage past its due date.',
        formula: 'count of in-flight onboardings with an overdue stage',
        rowsFrom: (user, ctx) => ctx.onboardingList(user),
        // `overdueStages` is counted during list decoration; a Live onboarding
        // that ran late is finished, not at risk.
        filter: (o) => o.status !== 'Live' && (o.overdueStages || 0) > 0,
        extraColumns: [{ key: 'overdueStages', label: 'Overdue stages', align: 'right' }]
    },

    /* ---- Customer health ---- */
    'health.overdue': {
        label: 'Overdue a check', source: 'accounts', format: 'num',
        definition: 'Customers past the check-in cadence their support tier promises.',
        formula: 'count of customers whose next health check is due in the past',
        caveats: ['Cadence is 1 month for Enterprise, 2 for Premium, 4 for Standard.'],
        rowsFrom: (user, ctx) => ctx.accountHealth(user),
        filter: (h) => !!h.overdue,
        columnsOverride: [
            { key: 'account', label: 'Account' },
            { key: 'tier', label: 'Tier' },
            { key: 'lastCheckDate', label: 'Last check', format: 'date' },
            { key: 'nextDueDate', label: 'Was due', format: 'date' },
            { key: 'currentSignal', label: 'Last signal' }
        ]
    },
    'health.atRisk': {
        label: 'At risk (red · amber)', source: 'accounts', format: 'num',
        definition: 'Customers whose most recent health call closed on a red or amber signal.',
        formula: 'count of customers where the latest call signal ∈ {Red, Amber}',
        rowsFrom: (user, ctx) => ctx.accountHealth(user),
        filter: (h) => h.currentSignal === 'Red' || h.currentSignal === 'Amber',
        columnsOverride: [
            { key: 'account', label: 'Account' },
            { key: 'currentSignal', label: 'Signal' },
            { key: 'sentiment', label: 'Sentiment' },
            { key: 'lastCheckDate', label: 'Last check', format: 'date' },
            { key: 'openActions', label: 'Open actions', align: 'right' }
        ]
    },
    'health.calls': {
        label: 'Health checks held', source: 'calls', format: 'num',
        definition: 'Check-in calls logged against customers.',
        formula: 'count of health calls',
        filter: () => true
    },
    'health.red': {
        label: 'Red signals', source: 'calls', format: 'num',
        definition: 'Check-ins that closed on a red signal.',
        formula: 'count of health calls where signal = Red',
        filter: (c) => c.signal === 'Red'
    },
    'health.openActions': {
        label: 'Open actionables', source: 'actionables', format: 'num',
        definition: 'Commitments made on a health call that are still outstanding.',
        formula: 'count of actionables where status is not Done or Closed',
        filter: (a) => a.status !== 'Done' && a.status !== 'Closed'
    },
    'health.carried': {
        label: 'Carried forward', source: 'actionables', format: 'num',
        definition: 'Actionables that rolled over from an earlier call without being closed.',
        formula: 'count of actionables with a carried_from reference',
        caveats: ['A rising count means commitments are being repeated rather than met.'],
        filter: (a) => !!a.carried_from
    },

    /* ---- Executive reviews ----
       The EBR page reports on the quarter in progress, so these scope to it too:
       counting every review ever written would not match the card above them. */
    'ebr.generated': {
        label: 'Generated', source: 'ebrs', format: 'num',
        definition: 'Reviews the platform has assembled for the current quarter.',
        formula: 'count of EBRs for the quarter in progress',
        filter: (e, ctx) => e.quarter === ctx.quarter
    },
    'ebr.shared': {
        label: 'Shared with customer', source: 'ebrs', format: 'num',
        definition: 'This quarter\'s reviews that have actually been delivered.',
        formula: 'count of EBRs for the current quarter with a shared_at date',
        filter: (e, ctx) => e.quarter === ctx.quarter && !!e.shared_at
    },
    'ebr.pendingShare': {
        label: 'Awaiting share', source: 'ebrs', format: 'num',
        definition: 'Reviews written for this quarter but never sent — a draft, not a review.',
        formula: 'count of EBRs for the current quarter with no shared_at date',
        filter: (e, ctx) => e.quarter === ctx.quarter && !e.shared_at
    },
    'ebr.allTime': {
        label: 'Reviews on record', source: 'ebrs', format: 'num',
        definition: 'Every quarterly review ever generated, across all quarters.',
        formula: 'count of EBRs',
        filter: () => true
    },

    /* ---- Voice of customer ---- */
    'surveys.responses': {
        label: 'Responses', source: 'responses', format: 'num',
        definition: 'Every reply received across all survey types.',
        formula: 'count of survey responses',
        filter: () => true
    },
    'surveys.detractors': {
        label: 'Detractors', source: 'responses', format: 'num',
        definition: 'Responses that came back negative.',
        formula: 'count of responses where sentiment = Negative',
        filter: (r) => r.sentiment === 'Negative'
    },
    'surveys.promoters': {
        label: 'Promoters', source: 'responses', format: 'num',
        definition: 'Responses that came back positive.',
        formula: 'count of responses where sentiment = Positive',
        filter: (r) => r.sentiment === 'Positive'
    },
    'surveys.campaigns': {
        label: 'Campaigns', source: 'campaigns', format: 'num',
        definition: 'Survey campaigns created.',
        formula: 'count of survey campaigns',
        filter: () => true
    },
    'surveys.live': {
        label: 'Live campaigns', source: 'campaigns', format: 'num',
        definition: 'Campaigns currently collecting responses.',
        formula: 'count of campaigns where status = Live',
        filter: (c) => c.status === 'Live'
    },

    /* ---- Expansion ---- */
    'upsells.open': {
        label: 'Open opportunities', source: 'expansions', format: 'num',
        definition: 'Expansion deals still in play.',
        formula: 'count of deals where stage ∉ {Won, Lost}',
        filter: (d) => d.stage !== 'Won' && d.stage !== 'Lost'
    },
    'upsells.openValue': {
        label: 'Open pipeline', source: 'expansions', format: 'inr',
        definition: 'Face value of expansion deals still in play.',
        formula: 'Σ value of deals where stage ∉ {Won, Lost}',
        filter: (d) => d.stage !== 'Won' && d.stage !== 'Lost',
        measure: (d, ctx) => ctx.toInr(d),
        extraColumns: [{ key: 'contribution', label: 'Value', format: 'inr', align: 'right' }]
    },
    'upsells.weighted': {
        label: 'Weighted forecast', source: 'expansions', format: 'inr',
        definition: 'Open expansion pipeline discounted by the win probability of each stage.',
        formula: 'Σ (deal value × stage probability ÷ 100) over open deals',
        caveats: ['Probability comes from the stage, not a per-deal estimate.'],
        filter: (d) => d.stage !== 'Won' && d.stage !== 'Lost',
        measure: (d, ctx) => (ctx.toInr(d) * (d.probability || 0)) / 100,
        extraColumns: [{ key: 'contribution', label: 'Weighted', format: 'inr', align: 'right' }]
    },
    'upsells.won': {
        label: 'Won', source: 'expansions', format: 'inr',
        definition: 'Expansion revenue closed and booked.',
        formula: 'Σ value of deals where stage = Won',
        filter: (d) => d.stage === 'Won',
        measure: (d, ctx) => ctx.toInr(d),
        extraColumns: [{ key: 'contribution', label: 'Value', format: 'inr', align: 'right' }]
    },

    /* ---- Product demand ---- */
    'features.total': {
        label: 'Requests', source: 'features', format: 'num',
        definition: 'Feature requests raised by customers.',
        formula: 'count of feature requests',
        filter: () => true
    },
    'features.open': {
        label: 'Open requests', source: 'features', format: 'num',
        definition: 'Requests not yet shipped or declined.',
        formula: 'count of requests where status ∉ {Shipped, Declined}',
        filter: (f) => f.status !== 'Shipped' && f.status !== 'Declined'
    },
    'features.shipped': {
        label: 'Shipped', source: 'features', format: 'num',
        definition: 'Requests that made it into the product.',
        formula: 'count of requests where status = Shipped',
        filter: (f) => f.status === 'Shipped'
    },
    'features.demand': {
        label: 'Total demand', source: 'features', format: 'num',
        definition: 'How loudly the base is asking — the requester, their backers and every vote cast.',
        // `demand` is composed during list decoration (supporters + votes + the
        // account that raised it), so this has to read through the repo.
        formula: 'Σ (1 raiser + backing accounts + votes) across every request',
        rowsFrom: (user, ctx) => ctx.featureList(user),
        filter: () => true,
        measure: (f) => f.demand || 0,
        extraColumns: [
            { key: 'votes', label: 'Votes', align: 'right' },
            { key: 'contribution', label: 'Demand', align: 'right' }
        ]
    },

    /* ---- Advocacy ---- */
    'referrals.total': {
        label: 'Referrals', source: 'referrals', format: 'num',
        definition: 'Introductions customers have made.',
        formula: 'count of referral leads',
        filter: () => true
    },
    'referrals.converted': {
        label: 'Converted', source: 'referrals', format: 'num',
        definition: 'Referrals that became customers.',
        formula: 'count of leads where status = Converted',
        filter: (r) => r.status === 'Converted'
    },
    'referrals.pipeline': {
        label: 'Referred pipeline', source: 'referrals', format: 'inr',
        definition: 'Value attached to referrals that are still alive.',
        formula: 'Σ value of leads not Declined',
        filter: (r) => r.status !== 'Declined',
        measure: (r, ctx) => ctx.toInr(r),
        extraColumns: [{ key: 'contribution', label: 'Value', format: 'inr', align: 'right' }]
    },
    'referrals.nudged': {
        label: 'Customers nudged', source: 'nudges', format: 'num',
        definition: 'Customers who have actually been asked for a referral.',
        formula: 'count of distinct accounts with a nudge on record',
        filter: () => true,
        distinctBy: 'account'
    },

    /* ---- Communications ---- */
    'comms.campaigns': {
        label: 'Campaigns', source: 'comms', format: 'num',
        definition: 'Outbound communications created.',
        formula: 'count of comms campaigns',
        filter: () => true
    },
    'comms.sent': {
        label: 'Sent', source: 'comms', format: 'num',
        definition: 'Campaigns that have actually gone out.',
        formula: 'count of campaigns where status = Sent',
        filter: (c) => c.status === 'Sent'
    },
    'comms.recipients': {
        label: 'Recipients', source: 'comms', format: 'num',
        definition: 'People reached across every sent campaign.',
        formula: 'Σ recipients of sent campaigns',
        filter: (c) => c.status === 'Sent',
        measure: (c) => c.recipients || 0,
        extraColumns: [{ key: 'contribution', label: 'Recipients', align: 'right' }]
    },

    /* ---- Events ---- */
    'events.total': {
        label: 'Events', source: 'events', format: 'num',
        definition: 'Webinars, workshops and roundtables on the calendar.',
        formula: 'count of events',
        filter: () => true
    },
    'events.upcoming': {
        label: 'Upcoming', source: 'events', format: 'num',
        definition: 'Events still to run — open for registration and not yet past their date.',
        // Both halves matter: a Planned event whose date has passed is not
        // upcoming, it was missed. The repo derives the flag, so read it there.
        formula: 'count of events with an upcoming status whose start date has not passed',
        rowsFrom: (user, ctx) => ctx.eventList(user),
        filter: (e) => !!e.upcoming
    },
    'events.registered': {
        label: 'Registrations', source: 'events', format: 'num',
        definition: 'Total sign-ups across every event.',
        formula: 'Σ registered across events',
        filter: (e) => (e.registered || 0) > 0,
        measure: (e) => e.registered || 0,
        extraColumns: [
            { key: 'contribution', label: 'Registered', align: 'right' },
            { key: 'attended', label: 'Attended', align: 'right' }
        ]
    },

    /* ---- Onboarding ---- */
    'onboarding.inFlight': {
        label: 'Customers onboarding', source: 'onboardings', format: 'num',
        definition: 'Onboardings started but not yet live.',
        formula: 'count of onboardings where status ≠ Live',
        filter: (o) => o.status !== 'Live'
    },
    'onboarding.live': {
        label: 'Gone live', source: 'onboardings', format: 'num',
        definition: 'Onboardings completed and handed over.',
        formula: 'count of onboardings where status = Live',
        filter: (o) => o.status === 'Live'
    },

    /* ---- Lifecycle ---- */
    'journey.customers': {
        label: 'Customers', source: 'accounts', format: 'num',
        // Counts customers, not journey rows: an unmapped customer is still a
        // customer, and both the Journey and Health Checks cards count them.
        definition: 'Customers being tracked through the lifecycle.',
        formula: 'count of accounts where segment = Customer',
        filter: (a) => a.segment === 'Customer'
    },
    'journey.mapped': {
        label: 'Placed on the map', source: 'journeys', format: 'num',
        definition: 'Customers that have actually been given a lifecycle stage.',
        formula: 'count of journey records',
        caveats: ['A customer with no journey record is not on the map yet.'],
        filter: () => true
    },
    'journey.atRisk': {
        label: 'At risk', source: 'journeys', format: 'num',
        definition: 'Customers flagged Poor or Critical on their journey record.',
        formula: 'count of journeys where health ∈ {Poor, Critical}',
        filter: (j) => j.health === 'Poor' || j.health === 'Critical'
    }
};
