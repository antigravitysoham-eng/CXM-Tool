import { z } from 'zod';
import { EXPANSION_TYPES, EXPANSION_STAGES } from '../data/expansionKit.js';

const CURRENCIES = ['INR', 'USD'];

export const createExpansionSchema = z.object({
    account: z.string().trim().min(1, 'account is required').max(160),
    title: z.string().trim().min(1, 'title is required').max(200),
    type: z.enum(EXPANSION_TYPES).default('Upsell'),
    product: z.string().trim().max(120).optional().default(''),
    value_amount: z.coerce.number().int().min(0).default(0),
    currency: z.enum(CURRENCIES).default('INR'),
    stage: z.enum(EXPANSION_STAGES).default('Identified'),
    probability: z.coerce.number().int().min(0).max(100).optional(),
    target_close: z.string().trim().max(40).optional().default(''),
    owner: z.string().trim().max(160).optional().default(''),
    notes: z.string().trim().max(2000).optional().default('')
});

// Update omits defaults so a partial PATCH doesn't reset unspecified fields.
export const updateExpansionSchema = z.object({
    title: z.string().trim().min(1).max(200),
    type: z.enum(EXPANSION_TYPES),
    product: z.string().trim().max(120),
    value_amount: z.coerce.number().int().min(0),
    currency: z.enum(CURRENCIES),
    stage: z.enum(EXPANSION_STAGES),
    probability: z.coerce.number().int().min(0).max(100),
    target_close: z.string().trim().max(40),
    owner: z.string().trim().max(160),
    notes: z.string().trim().max(2000)
}).partial();
