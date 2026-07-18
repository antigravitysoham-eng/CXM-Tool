import { z } from 'zod';
import { SUPPORT_TIERS } from './contractSchema.js';

// The support desk's vocabulary. Priority drives the SLA clock alongside the
// account's tier; status drives the resolution clock (Waiting on Customer pauses
// it). Keep these in sync with the SLA matrix and the page's filters.
export const TICKET_STATUSES = ['Open', 'In Progress', 'Waiting on Customer', 'Resolved', 'Closed'];
export const TICKET_PRIORITIES = ['Urgent', 'High', 'Normal', 'Low'];
export const TICKET_CATEGORIES = ['Technical', 'Billing', 'How-to', 'Bug', 'Feature request', 'Access', 'Other'];

const iso = z.string().trim().max(40);

const baseTicket = {
    account: z.string().trim().min(1, 'account is required').max(160),
    contract_id: z.string().trim().max(60).optional().default(''),
    subject: z.string().trim().min(1, 'subject is required').max(200),
    description: z.string().trim().max(4000).optional().default(''),
    category: z.enum(TICKET_CATEGORIES).default('Technical'),
    priority: z.enum(TICKET_PRIORITIES).default('Normal'),
    status: z.enum(TICKET_STATUSES).default('Open'),
    // Snapshot of the tier the SLA is measured against. Omitted → resolved from
    // the contract at create time, else Standard.
    support_tier: z.enum(SUPPORT_TIERS).optional(),
    assignee: z.string().trim().max(120).optional().default(''),
    requester_name: z.string().trim().max(120).optional().default(''),
    requester_email: z.string().trim().max(160).optional().default(''),
    opened_at: iso.optional(),
    first_response_at: iso.optional(),
    resolved_at: iso.optional()
};

export const createTicketSchema = z.object(baseTicket);
export const updateTicketSchema = z.object(baseTicket).partial();
