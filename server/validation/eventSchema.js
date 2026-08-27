import { z } from 'zod';

export const EVENT_TYPES = ['Webinar', 'Workshop', 'Roundtable', 'User Group', 'Conference', 'Office Hours'];
export const EVENT_STATUSES = ['Planned', 'Open', 'Live', 'Completed', 'Cancelled'];

export const createEventSchema = z.object({
    account: z.string().trim().min(1, 'account is required').max(160),
    title: z.string().trim().min(1, 'title is required').max(200),
    type: z.enum(EVENT_TYPES).default('Webinar'),
    status: z.enum(EVENT_STATUSES).default('Planned'),
    starts_at: z.string().trim().max(40).optional().default(''),
    location: z.string().trim().max(200).optional().default(''),
    capacity: z.coerce.number().int().min(0).default(0),
    host: z.string().trim().max(160).optional().default(''),
    notes: z.string().trim().max(2000).optional().default('')
});

export const updateEventSchema = z.object({
    title: z.string().trim().min(1).max(200),
    type: z.enum(EVENT_TYPES),
    status: z.enum(EVENT_STATUSES),
    starts_at: z.string().trim().max(40),
    location: z.string().trim().max(200),
    capacity: z.coerce.number().int().min(0),
    registered: z.coerce.number().int().min(0),
    attended: z.coerce.number().int().min(0),
    host: z.string().trim().max(160),
    notes: z.string().trim().max(2000)
}).partial();
