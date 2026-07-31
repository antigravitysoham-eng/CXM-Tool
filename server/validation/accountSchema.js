import { z } from 'zod';

// The field is stored as `type`/`segment`. For real accounts it is the ACCOUNT
// STATUS — Prospect (in pipeline), Customer (won), PQL (product-qualified lead,
// e.g. a lost deal recycled). 'Partner' is not an account status: partners are a
// separate kind, managed on their own, so it stays in the enum for those records
// but is not offered when creating a normal account.
export const ACCOUNT_STATUSES = ['Prospect', 'Customer', 'PQL'];
export const SEGMENTS = [...ACCOUNT_STATUSES, 'Partner'];
export const SOURCES = ['Direct', 'Partner'];
export const CURRENCIES = ['INR', 'USD'];
// Global sales regions. Doubles as the ABAC `region` attribute, so a policy like
// "managers see their region" works off the same field.
export const REGIONS = ['APAC', 'EMEA', 'AMER', 'ANZ', 'LATAM', 'MEA', 'India'];
// Prospect pipeline stages + customer lifecycle stages, one shared set.
// Single source of truth for account stages, so the pipeline board, the edit
// form and the bulk-upload template can never drift apart.
//   • PIPELINE_STAGES are the deal columns Cash Horizon shows and drags between.
//   • LIFECYCLE_STAGES are where a won customer sits afterwards (off the board).
// STAGES (the validation enum + template dropdown) is exactly their union — no
// orphan values (the old 'Closing' is gone; it was never a board column).
export const PIPELINE_STAGES = ['Lead', 'Qualified', 'POC', 'Negotiation', 'Closed', 'Lost'];
export const LIFECYCLE_STAGES = ['Live', 'Renewal', 'Churn Risk'];
export const STAGES = [...PIPELINE_STAGES, ...LIFECYCLE_STAGES];
export const HEALTHS = ['Good', 'Average', 'Poor', 'Critical'];

export const MEDDICC_PILLARS = [
    'metrics',
    'economic_buyer',
    'decision_criteria',
    'decision_process',
    'identify_pain',
    'champion',
    'competition'
];

const meddiccSchema = z
    .object(Object.fromEntries(
        MEDDICC_PILLARS.map((p) => [p, z.string().trim().max(1000).optional().default('')])
    ))
    .default({});

// Money is stored as a whole-unit integer plus a currency code — never a string.
const baseAccount = {
    name: z.string().trim().min(1, 'Name is required').max(200),
    segment: z.enum(SEGMENTS).default('Customer'),
    source: z.enum(SOURCES).default('Direct'),
    sourcing_partner_id: z.number().int().positive().nullable().optional().default(null),
    stage: z.enum(STAGES).default('Lead'),
    industry: z.string().trim().max(120).optional().default(''),
    region: z.enum(REGIONS).optional().default('India'),
    tier: z.string().trim().max(60).optional().default('Starter'),
    value_amount: z.number().int().min(0).max(1_000_000_000_000).default(0),
    value_currency: z.enum(CURRENCIES).default('INR'),
    probability: z.number().int().min(0).max(100).default(0),
    sales_owner: z.string().trim().max(120).optional().default(''),
    // Account manager for a partner relationship (segment = Partner).
    partner_manager: z.string().trim().max(120).optional().default(''),
    partner_manager_id: z.number().int().positive().nullable().optional().default(null),
    country: z.string().trim().max(80).optional().default(''),
    state: z.string().trim().max(80).optional().default(''),
    city: z.string().trim().max(80).optional().default(''),
    owner_id: z.number().int().positive().nullable().optional().default(null),
    cxm: z.string().trim().max(120).optional().default(''),
    health: z.enum(HEALTHS).default('Good'),
    renewal: z.string().trim().max(40).optional().default(''),
    next_step: z.string().trim().max(300).optional().default(''),
    next_step_date: z.string().trim().max(40).optional().default(''),
    meddicc: meddiccSchema
};

export const createAccountSchema = z.object(baseAccount);

// Update must NOT carry the create defaults: z's .partial() keeps .default(), so
// a PATCH of one field (e.g. stage) would silently reset every unspecified field
// to its default — segment→Customer, health→Good, value_amount→0, probability→0,
// next_step→'', meddicc cleared. The update fields are the same, minus the
// defaults, so a missing key stays undefined and the repo skips it.
const updatableAccount = {
    name: z.string().trim().min(1, 'Name is required').max(200),
    segment: z.enum(SEGMENTS),
    source: z.enum(SOURCES),
    sourcing_partner_id: z.number().int().positive().nullable(),
    stage: z.enum(STAGES),
    industry: z.string().trim().max(120),
    region: z.enum(REGIONS),
    tier: z.string().trim().max(60),
    value_amount: z.number().int().min(0).max(1_000_000_000_000),
    value_currency: z.enum(CURRENCIES),
    probability: z.number().int().min(0).max(100),
    sales_owner: z.string().trim().max(120),
    partner_manager: z.string().trim().max(120),
    partner_manager_id: z.number().int().positive().nullable(),
    country: z.string().trim().max(80),
    state: z.string().trim().max(80),
    city: z.string().trim().max(80),
    owner_id: z.number().int().positive().nullable(),
    cxm: z.string().trim().max(120),
    health: z.enum(HEALTHS),
    renewal: z.string().trim().max(40),
    next_step: z.string().trim().max(300),
    next_step_date: z.string().trim().max(40),
    // A meddicc object without the outer .default({}), so omitting it leaves the
    // pillars untouched instead of wiping them to empty strings.
    meddicc: z.object(Object.fromEntries(
        MEDDICC_PILLARS.map((p) => [p, z.string().trim().max(1000).optional()])
    ))
};
export const updateAccountSchema = z.object(updatableAccount).partial();

// Small helper so routes stay tidy: returns { data } or throws a 400-shaped error.
export function validate(schema, payload) {
    const result = schema.safeParse(payload);
    if (!result.success) {
        const detail = result.error.issues
            .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
            .join('; ');
        const err = new Error(detail);
        err.status = 400;
        throw err;
    }
    return result.data;
}
