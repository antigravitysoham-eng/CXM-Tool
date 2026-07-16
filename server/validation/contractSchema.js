import { z } from 'zod';

export const CONTRACT_TYPES = ['New Business', 'Renewal', 'Amendment', 'Expansion'];
export const CONTRACT_STATUSES = ['Active', 'Renewing', 'Expired', 'Churned', 'Draft'];
export const DEPLOYMENTS = ['On-premise', 'SaaS'];
export const LICENSE_TYPES = ['Subscription', 'Perpetual'];
export const BILLING_FREQUENCIES = ['Monthly', 'Quarterly', 'Bi-annual', 'Yearly', 'One-time'];
export const CURRENCIES = ['INR', 'USD'];
export const DOC_TYPES = ['Service Agreement', 'Post-Renewal Service Agreement', 'Addendum', 'Proposal', 'Prerequisite', 'Other'];

const money = z.number().int().min(0).max(1_000_000_000_000);
const dateStr = z.string().trim().max(40);

const base = {
    id: z.string().trim().max(60).optional(),
    account: z.string().trim().min(1, 'Account is required').max(200),
    type: z.enum(CONTRACT_TYPES).default('New Business'),
    status: z.enum(CONTRACT_STATUSES).default('Active'),
    deployment: z.enum(DEPLOYMENTS).default('SaaS'),
    license_type: z.enum(LICENSE_TYPES).default('Subscription'),
    perpetual_term_years: z.number().int().min(0).max(99).nullable().optional().default(null),
    billing_frequency: z.enum(BILLING_FREQUENCIES).default('Yearly'),
    payment_terms: z.string().trim().max(60).optional().default('Net 30'),
    start_date: dateStr.optional().default(''),
    end_date: dateStr.optional().default(''),
    renewal_date: dateStr.optional().default(''),
    term_months: z.number().int().min(0).max(600).optional().default(12),
    auto_renew: z.boolean().optional().default(false),
    notice_period_days: z.number().int().min(0).max(365).optional().default(30),
    currency: z.enum(CURRENCIES).default('INR'),
    tcv: money.default(0),
    arr: money.default(0),
    mrr: money.default(0),
    spoc_name: z.string().trim().max(120).optional().default(''),
    spoc_email: z.string().trim().max(160).optional().default(''),
    spoc_role: z.string().trim().max(120).optional().default(''),
    csm_name: z.string().trim().max(120).optional().default(''),
    csm_email: z.string().trim().max(160).optional().default(''),
    am_name: z.string().trim().max(120).optional().default(''),
    am_email: z.string().trim().max(160).optional().default(''),
    owner: z.string().trim().max(120).optional().default(''),
    notes: z.string().trim().max(2000).optional().default('')
};

export const createContractSchema = z.object(base);
export const updateContractSchema = z.object(base).partial();

export const documentSchema = z.object({
    contract_id: z.string().trim().max(60).optional().default(''),
    account: z.string().trim().max(200).optional().default(''),
    doc_type: z.enum(DOC_TYPES).default('Other'),
    name: z.string().trim().min(1, 'Document name is required').max(200),
    link: z.string().trim().max(1000).optional().default(''),
    version: z.string().trim().max(40).optional().default('v1')
});
