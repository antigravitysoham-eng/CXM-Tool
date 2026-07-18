import { z } from 'zod';
import { PRODUCT_KEYS } from '../data/products.js';

export const INVOICE_STATUSES = ['Draft', 'Raised', 'Sent', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'];
export const CURRENCIES = ['INR', 'USD'];

const date = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').or(z.literal('')).optional().default('');

// ---- product scope ----
export const productScopeSchema = z.object({
    product_key: z.enum(PRODUCT_KEYS),
    unit_count: z.number().int().min(0).max(1_000_000).optional().default(0),
    items: z.array(z.string().trim().min(1).max(160)).max(500).optional().default([]),
    info: z.string().trim().max(500).optional().default('')
});

// The whole scope for a contract, replaced as one set — simpler to reason about
// than diffing individual rows, and it is a small list.
export const setScopeSchema = z.object({
    products: z.array(productScopeSchema).max(PRODUCT_KEYS.length)
});

// ---- invoices ----
const invoiceBase = {
    invoice_no: z.string().trim().max(60).optional().default(''),
    contract_id: z.string().trim().min(1, 'Contract is required'),
    amount: z.number().int().min(0).max(1_000_000_000_000),
    currency: z.enum(CURRENCIES).optional().default('INR'),
    status: z.enum(INVOICE_STATUSES).optional().default('Draft'),
    issue_date: date,
    due_date: date,
    paid_date: date,
    period_from: date,
    period_to: date,
    notes: z.string().trim().max(1000).optional().default('')
};

export const createInvoiceSchema = z.object(invoiceBase).refine(
    (d) => !d.period_from || !d.period_to || d.period_from <= d.period_to,
    { message: 'Period start must not be after period end', path: ['period_to'] }
).refine(
    (d) => d.status !== 'Paid' || !!d.paid_date,
    { message: 'A paid invoice needs a paid date', path: ['paid_date'] }
);

// Update must NOT carry the create defaults: z's .partial() keeps .default(), so a
// PATCH of one field (e.g. status) would silently reset every unspecified field to
// its default — currency→INR, status→Draft, invoice_no/dates/notes→''. The update
// fields are the same, minus the defaults, so a missing key stays undefined and the
// repo's `if (data[f] !== undefined)` guard skips it.
const updDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').or(z.literal(''));
const updatableInvoice = {
    invoice_no: z.string().trim().max(60),
    contract_id: z.string().trim().min(1, 'Contract is required'),
    amount: z.number().int().min(0).max(1_000_000_000_000),
    currency: z.enum(CURRENCIES),
    status: z.enum(INVOICE_STATUSES),
    issue_date: updDate,
    due_date: updDate,
    paid_date: updDate,
    period_from: updDate,
    period_to: updDate,
    notes: z.string().trim().max(1000)
};
export const updateInvoiceSchema = z.object(updatableInvoice).partial();
