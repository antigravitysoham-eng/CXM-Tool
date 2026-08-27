import { z } from 'zod';
import { DOC_TYPES } from './documentSchema.js';

export const CONTRACT_TYPES = ['New Business', 'Renewal', 'Amendment', 'Expansion'];
// 'Renewed' = a completed prior term that rolled into a successor contract. It's
// kept for the renewal history but is NEITHER current value (excluded from ARR /
// value-under-management) NOR churn (the customer renewed, they didn't leave).
// No 'Expired' — a contract that isn't renewed at all is simply Churned.
export const CONTRACT_STATUSES = ['Active', 'Renewing', 'Renewed', 'Churned', 'Draft'];
// Statuses that represent a superseded PRIOR term: shown in history, excluded from
// the current book. Kept here so every value roll-up agrees on the definition.
export const PRIOR_TERM_STATUSES = ['Renewed'];
export const DEPLOYMENTS = ['On-premise', 'SaaS'];
export const LICENSE_TYPES = ['Subscription', 'Perpetual'];
export const BILLING_FREQUENCIES = ['Monthly', 'Quarterly', 'Half-yearly', 'Yearly', 'One-time'];
export const SUPPORT_TIERS = ['Standard', 'Premium', 'Enterprise'];
export const CURRENCIES = ['INR', 'USD'];
// DOC_TYPES now lives with the DMS; re-exported so contract callers keep working.
export { DOC_TYPES } from './documentSchema.js';

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
    support_tier: z.enum(SUPPORT_TIERS).default('Standard'),
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

// Update must NOT carry the create defaults: z's .partial() keeps .default(), and
// contractRepo.update spreads the parsed data over the existing row, so a PATCH of
// one field would overwrite every unspecified field with its default — tcv/arr/mrr
// →0, type→New Business, status→Active, term_months→12, currency→INR. The update
// fields are the same, minus the defaults, so a missing key stays undefined.
const updatableContract = {
    id: z.string().trim().max(60),
    account: z.string().trim().min(1, 'Account is required').max(200),
    type: z.enum(CONTRACT_TYPES),
    status: z.enum(CONTRACT_STATUSES),
    deployment: z.enum(DEPLOYMENTS),
    license_type: z.enum(LICENSE_TYPES),
    perpetual_term_years: z.number().int().min(0).max(99).nullable(),
    billing_frequency: z.enum(BILLING_FREQUENCIES),
    support_tier: z.enum(SUPPORT_TIERS),
    payment_terms: z.string().trim().max(60),
    start_date: dateStr,
    end_date: dateStr,
    renewal_date: dateStr,
    term_months: z.number().int().min(0).max(600),
    auto_renew: z.boolean(),
    notice_period_days: z.number().int().min(0).max(365),
    currency: z.enum(CURRENCIES),
    tcv: money,
    arr: money,
    mrr: money,
    spoc_name: z.string().trim().max(120),
    spoc_email: z.string().trim().max(160),
    spoc_role: z.string().trim().max(120),
    csm_name: z.string().trim().max(120),
    csm_email: z.string().trim().max(160),
    am_name: z.string().trim().max(120),
    am_email: z.string().trim().max(160),
    owner: z.string().trim().max(120),
    notes: z.string().trim().max(2000)
};
export const updateContractSchema = z.object(updatableContract).partial();

export const contactSchema = z.object({
    account: z.string().trim().min(1).max(200),
    name: z.string().trim().min(1, 'Name is required').max(120),
    designation: z.string().trim().max(120).optional().default(''),
    email: z.string().trim().max(160).optional().default(''),
    phone: z.string().trim().max(40).optional().default(''),
    is_primary: z.boolean().optional().default(false)
});

export const documentSchema = z.object({
    contract_id: z.string().trim().max(60).optional().default(''),
    account: z.string().trim().max(200).optional().default(''),
    doc_type: z.enum(DOC_TYPES).default('Other'),
    name: z.string().trim().min(1, 'Document name is required').max(200),
    link: z.string().trim().max(1000).optional().default(''),
    version: z.string().trim().max(40).optional().default('v1')
});
