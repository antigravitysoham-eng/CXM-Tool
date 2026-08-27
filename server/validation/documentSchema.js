import { z } from 'zod';

/**
 * Document types for the DMS. A contract is one category among many — grouping
 * exists so the UI can section a long list without hardcoding it.
 */
export const DOC_CATEGORIES = {
    Contractual: ['Service Agreement', 'Post-Renewal Service Agreement', 'Addendum', 'MSA', 'SOW', 'NDA'],
    Commercial: ['Proposal', 'Purchase Order', 'Invoice', 'Quote'],
    Compliance: ['DPA / Compliance', 'Security Questionnaire', 'Audit Report', 'Certificate'],
    Delivery: ['Prerequisite', 'Onboarding', 'Training Material', 'Runbook'],
    Engagement: ['QBR Deck', 'Report', 'Meeting Notes'],
    Other: ['Other']
};

export const DOC_TYPES = Object.values(DOC_CATEGORIES).flat();

export const CATEGORY_BY_TYPE = Object.fromEntries(
    Object.entries(DOC_CATEGORIES).flatMap(([cat, types]) => types.map((t) => [t, cat]))
);

const base = {
    account: z.string().trim().min(1, 'Account is required'),
    contract_id: z.string().trim().optional().default(''),
    doc_type: z.enum(DOC_TYPES).default('Other'),
    name: z.string().trim().min(1, 'Name is required').max(200),
    description: z.string().trim().max(1000).optional().default(''),
    version: z.string().trim().max(20).optional().default('v1'),
    link: z.string().trim().optional().default('')
};

// A document is either an uploaded file or a link to one held elsewhere.
// Both are first-class: not every artefact is ours to store.
export const createDocumentSchema = z
    .object({
        ...base,
        file_base64: z.string().optional(),
        file_name: z.string().max(255).optional(),
        mime: z.string().max(160).optional(),
        replaces_id: z.number().int().positive().optional()
    })
    .refine((d) => Boolean(d.file_base64 || d.link), {
        message: 'Attach a file or provide an external link',
        path: ['file_base64']
    });

export const updateDocumentSchema = z.object({
    doc_type: z.enum(DOC_TYPES).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(1000).optional(),
    version: z.string().trim().max(20).optional(),
    contract_id: z.string().trim().optional()
});
