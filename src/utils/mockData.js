export const mockCustomers = [
    { id: 1, name: 'Acme Corp', type: 'Customer', cxm: 'Sarah J.', health: 'Critical', value: '$45,000', renewals: 'Oct 12, 2026', progress: 85, industry: 'SaaS' },
    { id: 2, name: 'Global Tech', type: 'Customer', cxm: 'Mark O.', health: 'Poor', value: '$120,000', renewals: 'Oct 24, 2026', progress: 40, industry: 'FinTech' },
    { id: 3, name: 'Nexus Solutions', type: 'Prospect', cxm: 'Sarah J.', health: 'Stable', value: '$32,500', renewals: 'Nov 02, 2026', progress: 15, industry: 'E-commerce' },
    { id: 4, name: 'Stellar Innovations', type: 'Partner', cxm: 'Elena R.', health: 'Good', value: '$84,000', renewals: 'Nov 15, 2026', progress: 100, industry: 'AI' },
    { id: 5, name: 'Cloud Nine', type: 'Customer', cxm: 'David K.', health: 'Good', value: '$60,000', renewals: 'Dec 05, 2026', progress: 95, industry: 'Cloud' },
    { id: 6, name: 'Velocity Systems', type: 'Prospect', cxm: 'Mark O.', health: 'Neutral', value: '$55,000', renewals: 'N/A', progress: 10, industry: 'Logistics' },
];

export const mockContracts = [
    { id: 1, account: 'Acme Corp', stage: 'Renewing', value: '$45k', date: '2026-10-12', status: 'In Progress' },
    { id: 2, account: 'Global Tech', stage: 'Signed', value: '$120k', date: '2025-10-24', status: 'Active' },
    { id: 3, account: 'Nexus Solutions', stage: 'Draft', value: '$32k', date: '2026-02-15', status: 'Negotiation' },
    { id: 4, account: 'Stellar Innovations', stage: 'Review', value: '$84k', date: '2026-03-01', status: 'Legal Review' },
];

export const onboardingSteps = [
    { id: 1, label: 'Kickoff Call', completed: true, date: '2026-01-10' },
    { id: 2, label: 'Technical Integration', completed: true, date: '2026-01-15' },
    { id: 3, label: 'User Training', completed: false, date: '2026-02-01' },
    { id: 4, label: 'Business Review', completed: false, date: '2026-02-15' },
    { id: 5, label: 'Full Adoption', completed: false, date: '2026-03-01' },
];

export const mockStats = {
    activeCustomers: 1284,
    riskRenewals: 14,
    ebrCount: 256,
    pipelineValue: '$2.4M'
};
