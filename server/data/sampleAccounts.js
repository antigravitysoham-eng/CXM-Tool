// Sample data for Cash Horizon. Loaded on demand via POST /api/accounts/seed-sample
// (admin only). Amounts are whole currency units (rupees / dollars), never strings.

export const SAMPLE_SALES_USERS = [
    { email: 'priya@cashhorizon.io', name: 'Priya Sharma', role: 'rep' },
    { email: 'rohan@cashhorizon.io', name: 'Rohan Mehta', role: 'rep' },
    { email: 'ananya@cashhorizon.io', name: 'Ananya Rao', role: 'manager' }
];
export const SAMPLE_USER_PASSWORD = 'demo1234';

// Partners are inserted first so accounts can reference them by name.
export const SAMPLE_PARTNERS = [
    { name: 'Deloitte India', industry: 'Consulting', owner_email: 'ananya@cashhorizon.io' },
    { name: 'PwC India', industry: 'Consulting', owner_email: 'priya@cashhorizon.io' },
    { name: 'Accenture', industry: 'System Integrator', owner_email: 'rohan@cashhorizon.io' }
];

const M = (filled) => {
    // Build a MEDDICC object with the first `filled.length` pillars populated.
    const pillars = ['metrics', 'economic_buyer', 'decision_criteria', 'decision_process', 'identify_pain', 'champion', 'competition'];
    const out = {};
    pillars.forEach((p, i) => { out[p] = filled[i] || ''; });
    return out;
};

export const SAMPLE_ACCOUNTS = [
    // ---- Customers (won directly) ----
    {
        name: 'Bajaj Finserv', segment: 'Customer', source: 'Direct', stage: 'Live',
        industry: 'NBFC', tier: 'Enterprise', value_amount: 12000000, value_currency: 'INR',
        probability: 100, health: 'Good', renewal: '2026-12-15',
        owner_email: 'priya@cashhorizon.io', cxm: 'Priya Sharma',
        next_step: 'Quarterly business review', next_step_date: '2026-08-05',
        meddicc: M([
            'Reduced loan-approval TAT by 35%', 'CFO — Rajeev Nair', 'Security + TAT + INR pricing',
            'Board sign-off completed', 'Manual underwriting bottleneck', 'Head of Digital — Sneha K', 'Displaced in-house build'
        ])
    },
    {
        name: 'Muthoot Finance', segment: 'Customer', source: 'Direct', stage: 'Renewal',
        industry: 'Gold Loan NBFC', tier: 'Enterprise', value_amount: 8500000, value_currency: 'INR',
        probability: 100, health: 'Average', renewal: '2026-09-30',
        owner_email: 'rohan@cashhorizon.io', cxm: 'Rohan Mehta',
        next_step: 'Renewal proposal walkthrough', next_step_date: '2026-07-10',
        meddicc: M(['Branch throughput +20%', 'VP Ops — Thomas George', 'Uptime SLA', 'Procurement review', 'Branch reconciliation delays'])
    },
    // ---- Customers (won through a partner) ----
    {
        name: 'Shriram Finance', segment: 'Customer', source: 'Partner', sourcing_partner_name: 'Deloitte India',
        stage: 'Live', industry: 'NBFC', tier: 'Enterprise', value_amount: 6000000, value_currency: 'INR',
        probability: 100, health: 'Good', renewal: '2027-02-20',
        owner_email: 'ananya@cashhorizon.io', cxm: 'Ananya Rao',
        next_step: 'Expansion into insurance vertical', next_step_date: '2026-09-01',
        meddicc: M(['Collections efficiency +18%', 'CObol — Anil Kumar', 'Compliance + scale', 'Signed', 'Legacy collections stack', 'CTO — Meera R'])
    },
    {
        name: 'L&T Finance', segment: 'Customer', source: 'Partner', sourcing_partner_name: 'PwC India',
        stage: 'Renewal', industry: 'NBFC', tier: 'Professional', value_amount: 4500000, value_currency: 'INR',
        probability: 100, health: 'Poor', renewal: '2026-08-01',
        owner_email: 'priya@cashhorizon.io', cxm: 'Priya Sharma',
        next_step: 'Escalation call — usage decline', next_step_date: '2026-07-12',
        meddicc: M(['Adoption dropped 30%', 'CFO office', 'Cost justification', 'Under budget review'])
    },
    // ---- Customer in USD (exercises the currency toggle) ----
    {
        name: 'Global Fintech Inc', segment: 'Customer', source: 'Direct', stage: 'Live',
        industry: 'Fintech', tier: 'Enterprise', value_amount: 150000, value_currency: 'USD',
        probability: 100, health: 'Good', renewal: '2027-01-10',
        owner_email: 'ananya@cashhorizon.io', cxm: 'Ananya Rao',
        next_step: 'Multi-region rollout planning', next_step_date: '2026-08-20',
        meddicc: M([
            'Onboarding time cut 50%', 'VP Product — Dana L', 'API depth + SOC2', 'Executed',
            'Fragmented KYC flows', 'Eng Lead — Sam O', 'Beat legacy vendor'
        ])
    },
    // ---- Prospects (probable value + probability) ----
    {
        name: 'ICICI Lombard', segment: 'Prospect', source: 'Direct', stage: 'POC',
        industry: 'Insurance', tier: 'Enterprise', value_amount: 7500000, value_currency: 'INR',
        probability: 65, health: 'Good', renewal: '',
        owner_email: 'priya@cashhorizon.io',
        next_step: 'POC success-criteria review', next_step_date: '2026-07-22',
        meddicc: M(['Claims TAT target -40%', 'Chief Claims Officer', 'Accuracy + integration', 'POC in progress', 'Manual claims triage'])
    },
    {
        name: 'Tata Capital', segment: 'Prospect', source: 'Partner', sourcing_partner_name: 'Deloitte India',
        stage: 'Negotiation', industry: 'NBFC', tier: 'Enterprise', value_amount: 9000000, value_currency: 'INR',
        probability: 80, health: 'Good', renewal: '',
        owner_email: 'ananya@cashhorizon.io',
        next_step: 'Commercial terms — final round', next_step_date: '2026-07-18',
        meddicc: M(['Cross-sell lift target', 'CFO — Deepak S', 'TCO + partner endorsement', 'Legal redlines', 'Siloed customer data', 'CDO — Farhan A'])
    },
    {
        name: 'HDFC Ergo', segment: 'Prospect', source: 'Direct', stage: 'Qualified',
        industry: 'Insurance', tier: 'Professional', value_amount: 3000000, value_currency: 'INR',
        probability: 40, health: 'Good', renewal: '',
        owner_email: 'rohan@cashhorizon.io',
        next_step: 'Discovery workshop', next_step_date: '2026-07-28',
        meddicc: M(['Renewal retention', 'TBD', 'Ease of integration'])
    },
    {
        name: 'Cholamandalam', segment: 'Prospect', source: 'Partner', sourcing_partner_name: 'PwC India',
        stage: 'POC', industry: 'NBFC', tier: 'Professional', value_amount: 5000000, value_currency: 'INR',
        probability: 55, health: 'Average', renewal: '',
        owner_email: 'priya@cashhorizon.io',
        next_step: 'Technical POC kickoff', next_step_date: '2026-07-15',
        meddicc: M(['Disbursal speed', 'VP Tech', 'Scalability', 'Evaluating'])
    },
    {
        name: 'Aditya Birla Capital', segment: 'Prospect', source: 'Direct', stage: 'Lead',
        industry: 'NBFC', tier: 'Starter', value_amount: 2000000, value_currency: 'INR',
        probability: 15, health: 'Good', renewal: '',
        owner_email: 'rohan@cashhorizon.io',
        next_step: 'Initial qualification call', next_step_date: '2026-07-25',
        meddicc: M(['Exploring options'])
    },
    {
        name: 'Kotak Securities', segment: 'Prospect', source: 'Direct', stage: 'Negotiation',
        industry: 'Broking', tier: 'Enterprise', value_amount: 120000, value_currency: 'USD',
        probability: 75, health: 'Good', renewal: '',
        owner_email: 'ananya@cashhorizon.io',
        next_step: 'Security review with InfoSec', next_step_date: '2026-07-20',
        meddicc: M(['Latency SLA', 'CTO — Vikram J', 'Latency + compliance', 'Vendor onboarding', 'Legacy OMS limits'])
    }
];
