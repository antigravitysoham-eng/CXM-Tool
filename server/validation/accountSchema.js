import { z } from 'zod';

export const SEGMENTS = ['Customer', 'Prospect', 'Partner'];
export const SOURCES = ['Direct', 'Partner'];
export const CURRENCIES = ['INR', 'USD'];
// Global sales regions. Doubles as the ABAC `region` attribute, so a policy like
// "managers see their region" works off the same field.
export const REGIONS = ['APAC', 'EMEA', 'AMER', 'ANZ', 'LATAM', 'MEA', 'India'];
// Prospect pipeline stages + customer lifecycle stages, one shared set.
export const STAGES = [
    'Lead', 'Qualified', 'POC', 'Negotiation', 'Closing',
    'Live', 'Renewal', 'Churn Risk'
];
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
    owner_id: z.number().int().positive().nullable().optional().default(null),
    cxm: z.string().trim().max(120).optional().default(''),
    health: z.enum(HEALTHS).default('Good'),
    renewal: z.string().trim().max(40).optional().default(''),
    next_step: z.string().trim().max(300).optional().default(''),
    next_step_date: z.string().trim().max(40).optional().default(''),
    meddicc: meddiccSchema
};

export const createAccountSchema = z.object(baseAccount);

// Every field optional on update; only what's sent gets changed.
export const updateAccountSchema = z.object(baseAccount).partial();

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
