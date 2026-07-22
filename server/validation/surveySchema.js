import { z } from 'zod';
import { SURVEY_TYPES, SURVEY_STATUSES } from '../data/surveyKit.js';

export const createCampaignSchema = z.object({
    account: z.string().trim().min(1, 'account is required').max(160),
    title: z.string().trim().min(1, 'title is required').max(200),
    type: z.enum(SURVEY_TYPES).default('NPS'),
    // Optional product focus — a campaign can ask about one module specifically.
    product_key: z.string().trim().max(60).optional().default(''),
    question: z.string().trim().max(500).optional().default(''),
    status: z.enum(SURVEY_STATUSES).default('Draft')
});

// Update omits defaults so a partial PATCH doesn't reset unspecified fields.
export const updateCampaignSchema = z.object({
    title: z.string().trim().min(1).max(200),
    type: z.enum(SURVEY_TYPES),
    product_key: z.string().trim().max(60),
    question: z.string().trim().max(500),
    status: z.enum(SURVEY_STATUSES)
}).partial();

export const createResponseSchema = z.object({
    respondent: z.string().trim().max(160).optional().default(''),
    score: z.coerce.number().int().min(0).max(10),
    comment: z.string().trim().max(2000).optional().default('')
});
