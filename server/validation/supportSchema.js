import { z } from 'zod';
import { SUPPORT_TIERS } from './contractSchema.js';

// The support desk's vocabulary, aligned to the Zeron Support Guide. Priority
// drives the SLA clock alongside the account's tier; status drives the resolution
// clock (Customer/Dev Pending and Feature Request pause it — the ball is out of
// our court). Keep these in sync with the SLA matrix (data/supportSla.js) and the
// page's filters.
export const TICKET_TYPES = ['Question', 'Incident', 'Task'];
export const TICKET_STATUSES = [
    'Analysis in Progress', 'Customer Pending', 'Dev Pending',
    'Feature Request', 'Solution Delivered', 'Solution Accepted'
];
export const TICKET_PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'];
export const TICKET_RESOLUTIONS = ['Documentation', 'Network Connectivity', 'Bug Fix', 'Enhancement'];
export const TICKET_CHANNELS = ['Zoho', 'Support Email', 'Call'];

const iso = z.string().trim().max(40);

const baseTicket = {
    account: z.string().trim().min(1, 'account is required').max(160),
    contract_id: z.string().trim().max(60).optional().default(''),
    subject: z.string().trim().min(1, 'subject is required').max(200),
    description: z.string().trim().max(4000).optional().default(''),
    type: z.enum(TICKET_TYPES).default('Question'),
    priority: z.enum(TICKET_PRIORITIES).default('Medium'),
    status: z.enum(TICKET_STATUSES).default('Analysis in Progress'),
    // Resolution is only meaningful once the solution lands — optional throughout.
    resolution: z.enum(TICKET_RESOLUTIONS).optional().or(z.literal('')).default(''),
    channel: z.enum(TICKET_CHANNELS).default('Zoho'),
    // Product module + the sub-tab (component) the ticket is about — free text so
    // the desk isn't blocked when the product ships a new area.
    module: z.string().trim().max(80).optional().default(''),
    sub_tab: z.string().trim().max(80).optional().default(''),
    // The QA-raised JIRA reference, carried on the ticket per the guide's bug flow.
    jira_id: z.string().trim().max(60).optional().default(''),
    country: z.string().trim().max(80).optional().default(''),
    timezone: z.string().trim().max(60).optional().default(''),
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

// Update must NOT carry the create defaults: z's .partial() keeps .default(), so
// a PATCH of one field (e.g. status) would silently reset every unspecified field
// to its default — priority→Medium, type→Question, description→''. The update
// fields are the same, minus the defaults.
const updatableTicket = {
    account: z.string().trim().min(1).max(160),
    contract_id: z.string().trim().max(60),
    subject: z.string().trim().min(1).max(200),
    description: z.string().trim().max(4000),
    type: z.enum(TICKET_TYPES),
    priority: z.enum(TICKET_PRIORITIES),
    status: z.enum(TICKET_STATUSES),
    resolution: z.enum(TICKET_RESOLUTIONS).or(z.literal('')),
    channel: z.enum(TICKET_CHANNELS),
    module: z.string().trim().max(80),
    sub_tab: z.string().trim().max(80),
    jira_id: z.string().trim().max(60),
    country: z.string().trim().max(80),
    timezone: z.string().trim().max(60),
    support_tier: z.enum(SUPPORT_TIERS),
    assignee: z.string().trim().max(120),
    requester_name: z.string().trim().max(120),
    requester_email: z.string().trim().max(160),
    opened_at: iso,
    first_response_at: iso,
    resolved_at: iso
};
export const updateTicketSchema = z.object(updatableTicket).partial();
