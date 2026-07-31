import { accountRepo } from '../repositories/accountRepo.js';
import { createAccountSchema, validate, REGIONS } from '../validation/accountSchema.js';

/**
 * Partners — the channel partners who source deals. Stored as accounts with
 * type='Partner', but managed on their own (their own bulk template + import),
 * each carrying a list of Partner Account Managers (PAMs).
 */

const COLUMNS = [
    { key: 'name', header: 'Partner Name', type: 'text', required: true, example: 'Deloitte India', help: 'Partner / channel-partner name (required)' },
    { key: 'region', header: 'Region', type: 'select', options: REGIONS, example: 'India' },
    { key: 'industry', header: 'Industry', type: 'text', example: 'Consulting' },
    { key: 'sales_owner', header: 'Partner Owner', type: 'text', example: 'Priya Sharma', help: 'Who owns the partner relationship internally' },
    { key: 'managers', header: 'Partner Account Managers', type: 'text', example: 'Alice Roy <alice@deloitte.com>; Bob Sen <bob@deloitte.com>', help: 'Semicolon-separated. Format: Name <email> (email optional)' }
];

// "Alice Roy <a@x.com>; Bob Sen" -> [{name, email}]
function parseManagers(cell) {
    return String(cell || '').split(/[;\n]+/).map((s) => s.trim()).filter(Boolean).map((s) => {
        const m = s.match(/^(.*?)\s*<([^>]+)>\s*$/);
        return m ? { name: m[1].trim(), email: m[2].trim() } : { name: s, email: '' };
    }).filter((x) => x.name);
}

export const partnersModule = {
    key: 'partners',
    title: 'Partners',

    async records(user) { return (await accountRepo.list(user)).filter((a) => a.segment === 'Partner'); },
    async getColumns() { return COLUMNS; },

    summarize(records) {
        return {
            kpis: [{ label: 'Partners', value: records.length, color: '#22d3ee' }],
            sections: [{ title: 'Partners', color: '#22d3ee', lines: records.slice(0, 20).map((p) => `${p.name} — ${p.region || '—'}`) }],
            actions: ['Keep partner account managers current so partner-sourced deals attribute correctly.'],
            generatedBy: 'Cash Horizon'
        };
    },

    async exportData(user) {
        const partners = (await accountRepo.list(user)).filter((a) => a.segment === 'Partner');
        const rows = [];
        for (const p of partners) {
            const r = await accountRepo.partnerManagers(p.id, user);
            const managers = (r.managers || []).map((m) => (m.email ? `${m.name} <${m.email}>` : m.name)).join('; ');
            rows.push({ name: p.name, region: p.region, industry: p.industry, sales_owner: p.sales_owner, managers });
        }
        return { title: this.title, columns: COLUMNS, rows };
    },

    async templateColumns() {
        const example = Object.fromEntries(COLUMNS.filter((c) => c.example !== undefined).map((c) => [c.key, c.example]));
        return { columns: COLUMNS, example, moduleTitle: this.title };
    },

    async importData(user, parsed) {
        const colByHeader = new Map(COLUMNS.map((c) => [c.header.toLowerCase(), c]));
        let imported = 0;
        const errors = [];
        for (const row of parsed.rows) {
            const data = { segment: 'Partner', source: 'Direct', stage: 'Live', tier: 'Partner' };
            let managersCell = '';
            for (const [h, val] of Object.entries(row)) {
                if (h === '__row') continue;
                const col = colByHeader.get(String(h).toLowerCase());
                if (!col) continue;
                if (col.key === 'managers') managersCell = String(val ?? '');
                else if (val !== '' && val !== null && val !== undefined) data[col.key] = val;
            }
            try {
                const clean = validate(createAccountSchema, data);
                const partner = await accountRepo.create(clean, user);
                if (partner?.id && managersCell.trim()) {
                    await accountRepo.setPartnerManagers(partner.id, parseManagers(managersCell), user);
                }
                imported += 1;
            } catch (e) {
                errors.push({ row: row.__row, message: e.message });
            }
        }
        return { imported, errors };
    }
};
