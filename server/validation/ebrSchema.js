import { z } from 'zod';

const quarter = z.string().trim().regex(/^\d{4}-Q[1-4]$/, 'quarter must look like 2026-Q3').max(10);

/** Generate (or regenerate) an EBR for one account + quarter from platform data. */
export const generateSchema = z.object({
    account: z.string().trim().min(1, 'account is required').max(160),
    quarter: quarter.optional()
});

/** Generate for every accessible customer for a quarter. */
export const generateAllSchema = z.object({
    quarter: quarter.optional()
});

// Curator edits on top of the generated snapshot. Update omits defaults so a
// partial PATCH doesn't reset unspecified fields.
export const updateEbrSchema = z.object({
    title: z.string().trim().max(200),
    summary: z.string().trim().max(8000),
    insights: z.array(z.string().trim().max(500)).max(50),
    improvements: z.array(z.string().trim().max(500)).max(50)
}).partial();
