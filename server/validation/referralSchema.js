import { z } from 'zod';

export const REFERRAL_STATUSES = ['New', 'Contacted', 'Qualified', 'Converted', 'Declined'];
const CURRENCIES = ['INR', 'USD'];

export const createReferralSchema = z.object({
    account: z.string().trim().min(1, 'account is required').max(160),
    referred_name: z.string().trim().min(1, 'referred name is required').max(200),
    contact: z.string().trim().max(200).optional().default(''),
    status: z.enum(REFERRAL_STATUSES).default('New'),
    value_amount: z.coerce.number().int().min(0).default(0),
    currency: z.enum(CURRENCIES).default('INR'),
    reward: z.string().trim().max(200).optional().default(''),
    owner: z.string().trim().max(160).optional().default(''),
    notes: z.string().trim().max(2000).optional().default('')
});

export const updateReferralSchema = z.object({
    referred_name: z.string().trim().min(1).max(200),
    contact: z.string().trim().max(200),
    status: z.enum(REFERRAL_STATUSES),
    value_amount: z.coerce.number().int().min(0),
    currency: z.enum(CURRENCIES),
    reward: z.string().trim().max(200),
    reward_paid: z.coerce.boolean(),
    owner: z.string().trim().max(160),
    notes: z.string().trim().max(2000)
}).partial();
