import { z } from 'zod';

// Customer enablement: training sessions delivered to an account, and how far
// the learners got — enrolled → completed → certified. Keep these vocabularies in
// sync with the page filters and the Sensei brain.
export const TRAINING_STATUSES = ['Scheduled', 'In Progress', 'Completed', 'Delayed', 'Cancelled'];
export const TRAINING_FORMATS = ['Webinar', 'On-site', 'Self-paced', 'Workshop'];

const count = z.coerce.number().int().min(0).max(100000);

const baseSession = {
    title: z.string().trim().min(1, 'title is required').max(200),
    account: z.string().trim().min(1, 'account is required').max(160),
    contract_id: z.string().trim().max(60).optional().default(''),
    trainer: z.string().trim().max(120).optional().default(''),
    format: z.enum(TRAINING_FORMATS).default('Webinar'),
    status: z.enum(TRAINING_STATUSES).default('Scheduled'),
    session_date: z.string().trim().max(40).optional().default(''),
    // The learner funnel. Clamped in the repo so completed ≤ enrolled and
    // certified ≤ completed — an impossible funnel is a data bug, not a state.
    enrolled: count.optional().default(0),
    completed: count.optional().default(0),
    certified: count.optional().default(0),
    notes: z.string().trim().max(4000).optional().default('')
};

// ---- course catalogue ----
export const COURSE_LEVELS = ['Foundation', 'Intermediate', 'Advanced'];

const baseCourse = {
    module: z.string().trim().min(1).max(60),
    title: z.string().trim().min(1).max(200),
    level: z.enum(COURSE_LEVELS).default('Foundation'),
    duration_hours: z.coerce.number().int().min(0).max(1000).optional().default(0),
    seat_price: z.coerce.number().int().min(0).max(100000000).optional().default(0),
    currency: z.string().trim().max(8).optional().default('INR'),
    active: z.coerce.boolean().optional().default(true)
};
export const createCourseSchema = z.object(baseCourse);
export const updateCourseSchema = z.object({
    module: z.string().trim().min(1).max(60),
    title: z.string().trim().min(1).max(200),
    level: z.enum(COURSE_LEVELS),
    duration_hours: z.coerce.number().int().min(0).max(1000),
    seat_price: z.coerce.number().int().min(0).max(100000000),
    currency: z.string().trim().max(8),
    active: z.coerce.boolean()
}).partial();

export const createSessionSchema = z.object(baseSession);

// Update must NOT carry the create defaults: z's .partial() keeps .default(), so
// a PATCH of one field would silently reset every other field to its default
// (completed→0, status→Scheduled…). The update fields are the same, minus the
// defaults, so a missing key stays undefined and the repo skips it.
const updatableSession = {
    title: z.string().trim().min(1).max(200),
    account: z.string().trim().min(1).max(160),
    contract_id: z.string().trim().max(60),
    trainer: z.string().trim().max(120),
    format: z.enum(TRAINING_FORMATS),
    status: z.enum(TRAINING_STATUSES),
    session_date: z.string().trim().max(40),
    enrolled: count,
    completed: count,
    certified: count,
    notes: z.string().trim().max(4000)
};
export const updateSessionSchema = z.object(updatableSession).partial();
