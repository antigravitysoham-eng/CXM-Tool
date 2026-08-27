import { z } from 'zod';

export const COMM_TYPES = ['Email', 'Newsletter', 'Announcement', 'In-app', 'SMS'];
export const COMM_STATUSES = ['Draft', 'Scheduled', 'Sent'];

export const createCommSchema = z.object({
    account: z.string().trim().min(1, 'account is required').max(160),
    title: z.string().trim().min(1, 'title is required').max(200),
    type: z.enum(COMM_TYPES).default('Email'),
    status: z.enum(COMM_STATUSES).default('Draft'),
    recipients: z.coerce.number().int().min(0).default(0),
    scheduled_for: z.string().trim().max(40).optional().default('')
});

export const updateCommSchema = z.object({
    title: z.string().trim().min(1).max(200),
    type: z.enum(COMM_TYPES),
    status: z.enum(COMM_STATUSES),
    recipients: z.coerce.number().int().min(0),
    opens: z.coerce.number().int().min(0),
    clicks: z.coerce.number().int().min(0),
    scheduled_for: z.string().trim().max(40)
}).partial();

export const sendCommSchema = z.object({
    recipients: z.coerce.number().int().min(0).optional(),
    opens: z.coerce.number().int().min(0).optional(),
    clicks: z.coerce.number().int().min(0).optional()
});
