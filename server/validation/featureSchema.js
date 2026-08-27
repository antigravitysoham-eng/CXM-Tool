import { z } from 'zod';
import { FEATURE_STATUSES, IMPACTS, EFFORTS } from '../data/featureKit.js';

export const createFeatureSchema = z.object({
    account: z.string().trim().min(1, 'account is required').max(160),
    title: z.string().trim().min(1, 'title is required').max(200),
    description: z.string().trim().max(4000).optional().default(''),
    status: z.enum(FEATURE_STATUSES).default('Requested'),
    impact: z.enum(IMPACTS).default('Medium'),
    effort: z.enum(EFFORTS).default('M'),
    product_area: z.string().trim().max(80).optional().default(''),
    requested_by: z.string().trim().max(160).optional().default('')
});

// Update omits defaults so a partial PATCH doesn't reset unspecified fields.
export const updateFeatureSchema = z.object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(4000),
    status: z.enum(FEATURE_STATUSES),
    impact: z.enum(IMPACTS),
    effort: z.enum(EFFORTS),
    product_area: z.string().trim().max(80)
}).partial();

export const supporterSchema = z.object({
    account: z.string().trim().min(1, 'account is required').max(160)
});
