import { contractRepo } from '../repositories/contractRepo.js';
import { computeContractsSummary } from '../services/summaryService.js';
import {
    createContractSchema,
    CONTRACT_TYPES, CONTRACT_STATUSES, DEPLOYMENTS, LICENSE_TYPES, BILLING_FREQUENCIES, SUPPORT_TIERS, CURRENCIES
} from '../validation/contractSchema.js';
import { validate } from '../validation/accountSchema.js';

const COLUMNS = [
    { key: 'id', header: 'Contract #', type: 'text', example: 'CTR-2026-010', help: 'Leave blank to auto-generate' },
    { key: 'account', header: 'Account', type: 'text', required: true, example: 'Bajaj Finserv', help: 'Must match a customer account' },
    { key: 'type', header: 'Type', type: 'select', options: CONTRACT_TYPES, example: 'Renewal' },
    { key: 'status', header: 'Status', type: 'select', options: CONTRACT_STATUSES, example: 'Active' },
    { key: 'deployment', header: 'Deployment', type: 'select', options: DEPLOYMENTS, example: 'SaaS' },
    { key: 'license_type', header: 'License', type: 'select', options: LICENSE_TYPES, example: 'Subscription' },
    { key: 'perpetual_term_years', header: 'Perpetual Term (yrs)', type: 'number', min: 0, example: '' },
    { key: 'billing_frequency', header: 'Billing', type: 'select', options: BILLING_FREQUENCIES, example: 'Yearly' },
    { key: 'support_tier', header: 'Support Tier', type: 'select', options: SUPPORT_TIERS, example: 'Standard' },
    { key: 'payment_terms', header: 'Payment Terms', type: 'text', example: 'Net 30' },
    { key: 'start_date', header: 'Start Date', type: 'date', example: '2025-08-05', help: 'YYYY-MM-DD' },
    { key: 'end_date', header: 'End Date', type: 'date', example: '2026-08-05' },
    { key: 'renewal_date', header: 'Renewal Date', type: 'date', example: '2026-08-05' },
    { key: 'term_months', header: 'Term (months)', type: 'number', min: 0, example: 12 },
    { key: 'auto_renew', header: 'Auto-renew', type: 'select', options: ['Yes', 'No'], example: 'No' },
    { key: 'notice_period_days', header: 'Notice Period (days)', type: 'number', min: 0, example: 30 },
    { key: 'currency', header: 'Currency', type: 'select', options: CURRENCIES, example: 'INR' },
    { key: 'tcv', header: 'TCV', type: 'number', min: 0, example: 12000000, help: 'Whole number, no symbols' },
    { key: 'arr', header: 'ARR', type: 'number', min: 0, example: 12000000 },
    { key: 'mrr', header: 'MRR', type: 'number', min: 0, example: 1000000 },
    { key: 'spoc_name', header: 'SPOC Name', type: 'text', example: 'Rajeev Nair' },
    { key: 'spoc_email', header: 'SPOC Email', type: 'text' },
    { key: 'spoc_role', header: 'SPOC Role', type: 'text' },
    { key: 'csm_name', header: 'CSM Name', type: 'text' },
    { key: 'csm_email', header: 'CSM Email', type: 'text' },
    { key: 'am_name', header: 'Account Manager', type: 'text' },
    { key: 'am_email', header: 'AM Email', type: 'text' },
    { key: 'owner', header: 'Owner', type: 'text' },
    { key: 'notes', header: 'Notes', type: 'text' }
];
const NUMERIC = new Set(['perpetual_term_years', 'term_months', 'notice_period_days', 'tcv', 'arr', 'mrr']);

function toRow(c) {
    const r = {};
    for (const col of COLUMNS) r[col.key] = c[col.key];
    r.auto_renew = c.auto_renew ? 'Yes' : 'No';
    return r;
}

function exampleRow() {
    const ex = {};
    for (const c of COLUMNS) if (c.example !== undefined) ex[c.key] = c.example;
    return ex;
}

export const contractsModule = {
    key: 'contracts',
    title: 'CLM',
    // Contract value is recognised over its term, so it's pro-rated to the report's
    // date range rather than filtered out by a single date.
    proratesValue: true,

    async records(user) { return contractRepo.list({}, user); },
    async getColumns() { return COLUMNS; },
    summarize(records, period) { return computeContractsSummary(records, undefined, period); },

    async exportData(user) {
        const records = await contractRepo.list({}, user);
        return { title: this.title, columns: COLUMNS, rows: records.map(toRow) };
    },

    async templateColumns() {
        return { columns: COLUMNS, example: exampleRow(), moduleTitle: this.title };
    },

    async importData(user, parsed) {
        const colByHeader = new Map(COLUMNS.map((c) => [c.header.toLowerCase(), c]));
        let imported = 0;
        const errors = [];
        for (const row of parsed.rows) {
            const data = {};
            for (const [h, val] of Object.entries(row)) {
                if (h === '__row') continue;
                const col = colByHeader.get(String(h).toLowerCase());
                if (!col) continue;
                if (col.key === 'auto_renew') data.auto_renew = String(val).toLowerCase().startsWith('y');
                else if (NUMERIC.has(col.key)) data[col.key] = val === '' ? undefined : Number(val);
                else if (val !== '' && val !== null && val !== undefined) data[col.key] = val;
            }
            try {
                const clean = validate(createContractSchema, data);
                await contractRepo.create(clean);
                imported += 1;
            } catch (e) {
                errors.push({ row: row.__row, message: e.message });
            }
        }
        return { imported, errors, createdColumns: [] };
    }
};
