import { z } from 'zod';
import { HEALTH_SIGNALS, HEALTH_SENTIMENTS, ACTION_STATUSES } from '../data/healthCadence.js';

const date = z.string().trim().max(40);

export const createCallSchema = z.object({
    account: z.string().trim().min(1, 'account is required').max(160),
    check_date: date.optional(),
    signal: z.enum(HEALTH_SIGNALS).default('Green'),
    sentiment: z.enum(HEALTH_SENTIMENTS).default('Neutral'),
    summary: z.string().trim().max(6000).optional().default(''),
    attendees: z.string().trim().max(400).optional().default(''),
    conducted_by: z.string().trim().max(160).optional().default('')
});

// Update omits defaults so a partial PATCH doesn't reset unspecified fields.
export const updateCallSchema = z.object({
    check_date: date,
    signal: z.enum(HEALTH_SIGNALS),
    sentiment: z.enum(HEALTH_SENTIMENTS),
    summary: z.string().trim().max(6000),
    attendees: z.string().trim().max(400),
    conducted_by: z.string().trim().max(160)
}).partial();

export const createActionSchema = z.object({
    text: z.string().trim().min(1).max(500),
    owner: z.string().trim().max(160).optional().default(''),
    due_date: date.optional(),
    status: z.enum(ACTION_STATUSES).optional().default('Open')
});
export const updateActionSchema = z.object({
    text: z.string().trim().min(1).max(500),
    status: z.enum(ACTION_STATUSES),
    owner: z.string().trim().max(160),
    due_date: date
}).partial();
