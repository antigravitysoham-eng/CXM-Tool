// Sample CLM data for active customers. Renewal dates are set relative to
// mid-2026 so the 30/60/90-day triggers fire in the demo.

export const SAMPLE_CONTRACTS = [
    {
        id: 'CTR-2025-001', account: 'Bajaj Finserv', type: 'Renewal', status: 'Renewing',
        deployment: 'SaaS', license_type: 'Subscription', billing_frequency: 'Yearly', payment_terms: 'Net 45',
        start_date: '2025-08-05', end_date: '2026-08-05', renewal_date: '2026-08-05',
        term_months: 12, auto_renew: true, notice_period_days: 45,
        currency: 'INR', tcv: 12000000, arr: 12000000, mrr: 1000000,
        spoc_name: 'Rajeev Nair', spoc_email: 'rajeev.nair@bajajfinserv.example', spoc_role: 'CFO',
        csm_name: 'Priya Sharma', csm_email: 'priya@cashhorizon.io', am_name: 'Ananya Rao', am_email: 'ananya@cashhorizon.io',
        owner: 'Priya Sharma', notes: 'Flagship account. Expansion into insurance vertical under discussion.',
        documents: [
            { doc_type: 'Service Agreement', name: 'Master Service Agreement 2025', link: 'https://drive.example.com/bajaj/msa-2025.pdf', version: 'v2' },
            { doc_type: 'Proposal', name: 'Renewal Proposal FY26', link: 'https://drive.example.com/bajaj/renewal-fy26.pdf', version: 'v1' },
            { doc_type: 'Addendum', name: 'Data Processing Addendum', link: 'https://drive.example.com/bajaj/dpa.pdf', version: 'v1' }
        ]
    },
    {
        id: 'CTR-2025-014', account: 'Bajaj Finserv', type: 'Expansion', status: 'Active',
        deployment: 'SaaS', license_type: 'Subscription', billing_frequency: 'Quarterly', payment_terms: 'Net 45',
        start_date: '2026-02-20', end_date: '2026-11-20', renewal_date: '2026-11-20',
        term_months: 9, auto_renew: false, notice_period_days: 30,
        currency: 'INR', tcv: 3000000, arr: 3000000, mrr: 250000,
        spoc_name: 'Sneha K', spoc_email: 'sneha.k@bajajfinserv.example', spoc_role: 'Head of Digital',
        csm_name: 'Priya Sharma', csm_email: 'priya@cashhorizon.io', am_name: 'Ananya Rao', am_email: 'ananya@cashhorizon.io',
        owner: 'Priya Sharma', notes: 'Add-on analytics module.',
        documents: [{ doc_type: 'Proposal', name: 'Analytics Add-on SOW', link: 'https://drive.example.com/bajaj/analytics-sow.pdf', version: 'v1' }]
    },
    {
        id: 'CTR-2024-021', account: 'Muthoot Finance', type: 'Renewal', status: 'Renewing',
        deployment: 'On-premise', license_type: 'Perpetual', perpetual_term_years: 5, billing_frequency: 'Yearly', payment_terms: 'Net 60',
        start_date: '2021-09-01', end_date: '2026-09-01', renewal_date: '2026-09-01',
        term_months: 60, auto_renew: false, notice_period_days: 60,
        currency: 'INR', tcv: 8500000, arr: 1700000, mrr: 141666,
        spoc_name: 'Thomas George', spoc_email: 'thomas.george@muthoot.example', spoc_role: 'VP Operations',
        csm_name: 'Rohan Mehta', csm_email: 'rohan@cashhorizon.io', am_name: 'Ananya Rao', am_email: 'ananya@cashhorizon.io',
        owner: 'Rohan Mehta', notes: '5-year perpetual license, on-prem. AMC renewal due.',
        documents: [
            { doc_type: 'Service Agreement', name: 'Perpetual License Agreement', link: 'https://drive.example.com/muthoot/license.pdf', version: 'v1' },
            { doc_type: 'Prerequisite', name: 'On-prem Deployment Checklist', link: 'https://drive.example.com/muthoot/deploy-checklist.pdf', version: 'v3' }
        ]
    },
    {
        id: 'CTR-2025-030', account: 'Shriram Finance', type: 'New Business', status: 'Active',
        deployment: 'SaaS', license_type: 'Subscription', billing_frequency: 'Quarterly', payment_terms: 'Net 30',
        start_date: '2025-10-05', end_date: '2026-10-05', renewal_date: '2026-10-05',
        term_months: 12, auto_renew: true, notice_period_days: 30,
        currency: 'INR', tcv: 6000000, arr: 6000000, mrr: 500000,
        spoc_name: 'Anil Kumar', spoc_email: 'anil.kumar@shriram.example', spoc_role: 'COO',
        csm_name: 'Ananya Rao', csm_email: 'ananya@cashhorizon.io', am_name: 'Ananya Rao', am_email: 'ananya@cashhorizon.io',
        owner: 'Ananya Rao', notes: 'Sourced via Deloitte India.',
        documents: [
            { doc_type: 'Service Agreement', name: 'Service Agreement 2025', link: 'https://drive.example.com/shriram/sa-2025.pdf', version: 'v1' },
            { doc_type: 'Post-Renewal Service Agreement', name: 'Post-Renewal SA (draft)', link: 'https://drive.example.com/shriram/post-renewal.pdf', version: 'draft' }
        ]
    },
    {
        id: 'CTR-2025-045', account: 'L&T Finance', type: 'Renewal', status: 'Renewing',
        deployment: 'SaaS', license_type: 'Subscription', billing_frequency: 'Monthly', payment_terms: 'Net 30',
        start_date: '2025-08-01', end_date: '2026-08-01', renewal_date: '2026-08-01',
        term_months: 12, auto_renew: false, notice_period_days: 30,
        currency: 'INR', tcv: 4500000, arr: 4500000, mrr: 375000,
        spoc_name: 'Meera R', spoc_email: 'meera.r@ltfinance.example', spoc_role: 'CTO',
        csm_name: 'Priya Sharma', csm_email: 'priya@cashhorizon.io', am_name: 'Ananya Rao', am_email: 'ananya@cashhorizon.io',
        owner: 'Priya Sharma', notes: 'Adoption declined 30% — renewal at risk. Escalation in progress.',
        documents: [{ doc_type: 'Service Agreement', name: 'Service Agreement 2025', link: 'https://drive.example.com/lt/sa-2025.pdf', version: 'v1' }]
    },
    {
        id: 'CTR-2026-002', account: 'Global Fintech Inc', type: 'New Business', status: 'Active',
        deployment: 'SaaS', license_type: 'Subscription', billing_frequency: 'Yearly', payment_terms: 'Net 30',
        start_date: '2026-01-10', end_date: '2027-01-10', renewal_date: '2027-01-10',
        term_months: 12, auto_renew: true, notice_period_days: 30,
        currency: 'USD', tcv: 150000, arr: 150000, mrr: 12500,
        spoc_name: 'Dana L', spoc_email: 'dana.l@globalfintech.example', spoc_role: 'VP Product',
        csm_name: 'Ananya Rao', csm_email: 'ananya@cashhorizon.io', am_name: 'Ananya Rao', am_email: 'ananya@cashhorizon.io',
        owner: 'Ananya Rao', notes: 'Multi-region rollout planned.',
        documents: [
            { doc_type: 'Service Agreement', name: 'MSA (US)', link: 'https://drive.example.com/gfi/msa.pdf', version: 'v1' },
            { doc_type: 'Proposal', name: 'Multi-region Rollout Proposal', link: 'https://drive.example.com/gfi/rollout.pdf', version: 'v1' }
        ]
    }
];

// Support tier the customer has subscribed to.
export const SUPPORT_TIER_BY_ACCOUNT = {
    'Bajaj Finserv': 'Enterprise',
    'Muthoot Finance': 'Premium',
    'Shriram Finance': 'Standard',
    'L&T Finance': 'Standard',
    'Global Fintech Inc': 'Enterprise'
};

// Multiple stakeholders (SPOCs) per customer, each with a designation.
export const SAMPLE_CONTACTS = [
    { account: 'Bajaj Finserv', name: 'Rajeev Nair', designation: 'CFO', email: 'rajeev.nair@bajajfinserv.example', is_primary: true },
    { account: 'Bajaj Finserv', name: 'Sneha K', designation: 'Head of Digital', email: 'sneha.k@bajajfinserv.example' },
    { account: 'Bajaj Finserv', name: 'Amit Verma', designation: 'IT Manager', email: 'amit.verma@bajajfinserv.example' },
    { account: 'Muthoot Finance', name: 'Thomas George', designation: 'VP Operations', email: 'thomas.george@muthoot.example', is_primary: true },
    { account: 'Muthoot Finance', name: 'Rekha Nair', designation: 'Finance Lead', email: 'rekha.nair@muthoot.example' },
    { account: 'Shriram Finance', name: 'Anil Kumar', designation: 'COO', email: 'anil.kumar@shriram.example', is_primary: true },
    { account: 'L&T Finance', name: 'Meera R', designation: 'CTO', email: 'meera.r@ltfinance.example', is_primary: true },
    { account: 'L&T Finance', name: 'Karan Shah', designation: 'Procurement', email: 'karan.shah@ltfinance.example' },
    { account: 'Global Fintech Inc', name: 'Dana L', designation: 'VP Product', email: 'dana.l@globalfintech.example', is_primary: true },
    { account: 'Global Fintech Inc', name: 'Sam O', designation: 'Engineering Lead', email: 'sam.o@globalfintech.example' }
];
