import { getDb } from '../db.js';
import { accountRepo } from '../repositories/accountRepo.js';
import { customFieldRepo } from '../repositories/customFieldRepo.js';
import { scopeRepo } from '../repositories/scopeRepo.js';
import { computeAccountsSummary } from '../services/summaryService.js';
import { PRODUCTS, PRODUCT_BY_KEY, productName } from '../data/products.js';
import {
    createAccountSchema, validate,
    SEGMENTS, SOURCES, CURRENCIES, STAGES, PIPELINE_STAGES, LIFECYCLE_STAGES, HEALTHS, MEDDICC_PILLARS
} from '../validation/accountSchema.js';

// Names of the subscribable products, for the Products column help + import mapping.
const PRODUCT_NAMES = PRODUCTS.filter((p) => p.key !== 'others').map((p) => p.name);
// name/key (case-insensitive) → canonical product_key, for resolving the Products cell.
const PRODUCT_KEY_BY_LABEL = (() => {
    const m = {};
    for (const p of PRODUCTS) { m[p.name.toLowerCase()] = p.key; m[p.key.toLowerCase()] = p.key; }
    return m;
})();
const resolveProducts = (cell) => [...new Set(String(cell || '')
    .split(/[,;/|]+/).map((s) => s.trim()).filter(Boolean)
    .map((s) => PRODUCT_KEY_BY_LABEL[s.toLowerCase()]).filter((k) => k && PRODUCT_BY_KEY[k]))];

const MEDDICC_HEADERS = {
    metrics: 'MEDDICC: Metrics',
    economic_buyer: 'MEDDICC: Economic Buyer',
    decision_criteria: 'MEDDICC: Decision Criteria',
    decision_process: 'MEDDICC: Decision Process',
    identify_pain: 'MEDDICC: Identify Pain',
    champion: 'MEDDICC: Champion',
    competition: 'MEDDICC: Competition'
};

const BASE_COLUMNS = [
    { key: 'name', header: 'Account Name', type: 'text', required: true, example: 'Bajaj Finserv', help: 'Account / company name (required)' },
    { key: 'segment', header: 'Segment', type: 'select', required: true, options: SEGMENTS, example: 'Customer', help: 'Customer = won, Prospect = in pipeline, Partner = channel partner' },
    { key: 'source', header: 'Source', type: 'select', options: SOURCES, example: 'Direct', help: 'How the deal came in: Direct or via a Partner' },
    { key: 'sourcing_partner', header: 'Sourcing Partner', type: 'text', example: 'Deloitte India', help: 'Partner account name — only if Source = Partner (must match an existing Partner)' },
    { key: 'stage', header: 'Stage', type: 'select', options: STAGES, example: 'POC',
        help: `Pipeline (board): ${PIPELINE_STAGES.join(', ')}. Won customers: ${LIFECYCLE_STAGES.join(', ')}.` },
    { key: 'products', header: 'Products', type: 'text', example: 'Interno, Conformity',
        help: `Comma-separated products this account has. Valid: ${PRODUCT_NAMES.join(', ')}` },
    { key: 'industry', header: 'Industry', type: 'text', example: 'NBFC' },
    { key: 'tier', header: 'Tier', type: 'text', example: 'Enterprise' },
    { key: 'value_amount', header: 'Value Amount', type: 'number', min: 0, example: 12000000, help: 'Whole number only — no symbols or commas (e.g. 12000000)' },
    { key: 'value_currency', header: 'Currency', type: 'select', options: CURRENCIES, example: 'INR', help: 'INR or USD' },
    { key: 'probability', header: 'Win Probability %', type: 'number', min: 0, max: 100, example: 65, help: '0-100 (prospects only)' },
    { key: 'sales_owner', header: 'Sales Owner', type: 'text', example: 'Priya Sharma' },
    { key: 'health', header: 'Health', type: 'select', options: HEALTHS, example: 'Good' },
    { key: 'renewal', header: 'Renewal Date', type: 'date', example: '2026-12-15', help: 'YYYY-MM-DD' },
    { key: 'next_step', header: 'Next Step', type: 'text', example: 'Discovery call' },
    { key: 'next_step_date', header: 'Next Step Date', type: 'date', example: '2026-07-30', help: 'YYYY-MM-DD' },
    ...MEDDICC_PILLARS.map((p) => ({ key: `meddicc_${p}`, header: MEDDICC_HEADERS[p], type: 'text' }))
];

function customColumns(defs) {
    return defs.map((d) => ({ key: `cf_${d.key}`, header: d.label, type: d.type, options: d.options }));
}

function buildColumns(defs) {
    return [...BASE_COLUMNS, ...customColumns(defs)];
}

// A filled example record for the template (row 2).
function exampleRow() {
    const ex = {};
    for (const c of BASE_COLUMNS) if (c.example !== undefined) ex[c.key] = c.example;
    ex.sourcing_partner = '';
    return ex;
}

async function partnersByIdMap(records) {
    const map = {};
    records.filter((r) => r.segment === 'Partner').forEach((p) => { map[p.id] = p.name; });
    return map;
}

function toRow(acc, partnerName, defs, scopeByAccount = {}) {
    const row = {
        name: acc.name, segment: acc.segment, source: acc.source,
        sourcing_partner: acc.sourcing_partner_id ? (partnerName[acc.sourcing_partner_id] || '') : '',
        stage: acc.stage, products: (scopeByAccount[acc.name] || []).join(', '),
        industry: acc.industry, tier: acc.tier,
        value_amount: acc.value_amount, value_currency: acc.value_currency,
        probability: acc.probability, sales_owner: acc.sales_owner, health: acc.health,
        renewal: acc.renewal, next_step: acc.next_step, next_step_date: acc.next_step_date
    };
    for (const p of MEDDICC_PILLARS) row[`meddicc_${p}`] = acc.meddicc[p] || '';
    for (const d of defs) row[`cf_${d.key}`] = acc.custom_fields?.[d.key] ?? '';
    return row;
}

// account name → its subscribed product NAMES, for the Products export column.
async function productScopeByAccount() {
    const db = await getDb();
    const rows = await db.all('SELECT account, product_key FROM account_products');
    const map = {};
    for (const r of rows) (map[r.account] ||= []).push(productName(r.product_key));
    return map;
}

export const accountsModule = {
    key: 'accounts',
    title: 'Cash Horizon',

    async records(user) {
        return accountRepo.list(user);
    },

    summarize(records) {
        return computeAccountsSummary(records);
    },

    async getColumns() {
        return buildColumns(await customFieldRepo.listDefs('accounts'));
    },

    async exportData(user) {
        const records = await accountRepo.list(user);
        const defs = await customFieldRepo.listDefs('accounts');
        const pMap = await partnersByIdMap(records);
        const scopeMap = await productScopeByAccount();
        return {
            title: this.title,
            columns: buildColumns(defs),
            rows: records.map((r) => toRow(r, pMap, defs, scopeMap))
        };
    },

    async templateColumns() {
        return { columns: buildColumns(await customFieldRepo.listDefs('accounts')), example: exampleRow(), moduleTitle: this.title };
    },

    // parsed = { headers, rows } from excelService.parseWorkbook
    async importData(user, parsed) {
        const createdColumns = [];

        // Any header we don't recognise becomes a new text custom column.
        let defs = await customFieldRepo.listDefs('accounts');
        let columns = buildColumns(defs);
        const known = new Set(columns.map((c) => c.header.toLowerCase()));
        for (const h of parsed.headers) {
            if (h && !known.has(h.toLowerCase())) {
                const def = await customFieldRepo.createDef('accounts', { label: h, type: 'text' });
                createdColumns.push(def.label);
                known.add(h.toLowerCase());
            }
        }
        if (createdColumns.length) {
            defs = await customFieldRepo.listDefs('accounts');
            columns = buildColumns(defs);
        }
        const colByHeader = new Map(columns.map((c) => [c.header.toLowerCase(), c]));

        // partner name -> id (all partners, for reference resolution)
        const db = await getDb();
        const partnerRows = await db.all("SELECT id, name FROM customers WHERE type = 'Partner'");
        const partnerByName = new Map(partnerRows.map((p) => [String(p.name).toLowerCase(), p.id]));

        let imported = 0;
        const errors = [];

        for (const row of parsed.rows) {
            const data = { meddicc: {} };
            const custom = {};
            let sourcingPartnerName = '';
            let productsCell = '';

            for (const [h, val] of Object.entries(row)) {
                if (h === '__row') continue;
                const col = colByHeader.get(String(h).toLowerCase());
                if (!col) continue;
                const key = col.key;
                if (key.startsWith('meddicc_')) data.meddicc[key.slice(8)] = String(val ?? '');
                else if (key.startsWith('cf_')) custom[key.slice(3)] = val;
                else if (key === 'sourcing_partner') sourcingPartnerName = String(val ?? '').trim();
                else if (key === 'products') productsCell = String(val ?? ''); // handled after create (not an account field)
                else if (key === 'value_amount') data.value_amount = val === '' ? 0 : Number(val);
                else if (key === 'probability') data.probability = val === '' ? 0 : Number(val);
                else if (val !== '' && val !== null && val !== undefined) data[key] = val;
            }

            try {
                const clean = validate(createAccountSchema, data);
                if (clean.source === 'Partner' && sourcingPartnerName) {
                    clean.sourcing_partner_id = partnerByName.get(sourcingPartnerName.toLowerCase()) ?? null;
                }
                clean.custom_fields = customFieldRepo.coerceValues(defs, custom);
                await accountRepo.create(clean, user);
                // Product scope rides alongside the account, not on it — set it after
                // create from the Products cell (resolved to canonical product keys).
                const productKeys = resolveProducts(productsCell);
                if (productKeys.length) {
                    await scopeRepo.setAccountScope(clean.name, productKeys.map((k) => ({ product_key: k, unit_count: 1, items: [] })), user);
                }
                imported += 1;
            } catch (e) {
                errors.push({ row: row.__row, message: e.message });
            }
        }

        return { imported, errors, createdColumns };
    }
};
