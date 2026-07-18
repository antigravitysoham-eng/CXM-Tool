import { z } from 'zod';
import { JOURNEY_STAGES, JOURNEY_HEALTHS } from '../data/journeyKit.js';

// Upsert a customer's journey position.
export const setJourneySchema = z.object({
    account: z.string().trim().min(1, 'account is required').max(160),
    stage: z.enum(JOURNEY_STAGES).default('Onboarding'),
    health: z.enum(JOURNEY_HEALTHS).default('Good'),
    owner: z.string().trim().max(160).optional().default(''),
    notes: z.string().trim().max(2000).optional().default(''),
    note: z.string().trim().max(500).optional() // optional milestone note to log
});

export const updateJourneySchema = z.object({
    stage: z.enum(JOURNEY_STAGES),
    health: z.enum(JOURNEY_HEALTHS),
    owner: z.string().trim().max(160),
    notes: z.string().trim().max(2000),
    note: z.string().trim().max(500)
}).partial();
