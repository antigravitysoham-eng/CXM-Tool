import { getDb } from '../db.js';
import { accountRepo } from './accountRepo.js';
import { contractRepo } from './contractRepo.js';
import { PRODUCT_BY_KEY, productName } from '../data/products.js';
import { storage } from '../services/storageService.js';

/**
 * Product scope and invoices.
 *
 * Both hang off a contract, which hangs off an account, so both inherit the
 * account's access — same rule as documents and contracts. `user` is required,
 * never optional: the one place that forgets is the one that leaks.
 */

async function accessibleAccounts(user) {
    if (!user) throw new Error('scopeRepo: a user is required — pass req.user');
    const accounts = await accountRepo.list(user);
    return new Set(accounts.map((a) => a.name));
}

const parseItems = (raw) => {
    try {
        const v = JSON.parse(raw || '[]');
        return Array.isArray(v) ? v : [];
    } catch {
        return [];
    }
};

function rowToScope(row) {
    const def = PRODUCT_BY_KEY[row.product_key];
    return {
        product_key: row.product_key,
        product: productName(row.product_key),
        unit_label: def?.unitLabel || 'Units',
        item_label: def?.itemLabel || null,
        color: def?.color || '#94a3b8',
        unit_count: row.unit_count ?? 0,
        items: parseItems(row.items),
        info: row.info || ''
    };
}

const daysBetween = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000);

function rowToInvoice(row) {
    const today = new Date().toISOString().slice(0, 10);
    const unpaid = !['Paid', 'Cancelled'].includes(row.status);
    // Overdue is derived, never stored: a stored flag is wrong the morning after
    // it's written and nobody notices until someone chases the wrong customer.
    const overdue = unpaid && !!row.due_date && row.due_date < today;
    return {
        id: row.id,
        invoice_no: row.invoice_no || '',
        contract_id: row.contract_id || '',
        account: row.account || '',
        amount: row.amount ?? 0,
        currency: row.currency || 'INR',
        status: overdue && row.status !== 'Overdue' ? 'Overdue' : row.status,
        stored_status: row.status,
        overdue,
        days_overdue: overdue ? daysBetween(today, row.due_date) : 0,
        issue_date: row.issue_date || '',
        due_date: row.due_date || '',
        paid_date: row.paid_date || '',
        period_from: row.period_from || '',
        period_to: row.period_to || '',
        notes: row.notes || '',
        raised_by: row.raised_by || '',
        has_file: Boolean(row.file_key),
        file_name: row.file_name || '',
        created_at: row.created_at,
        updated_at: row.updated_at
    };
}

export const scopeRepo = {
    // ---- product scope ----
    async listScope(user, { contract_id, account } = {}) {
        const db = await getDb();
        const names = await accessibleAccounts(user);
        const where = [];
        const args = [];
        if (contract_id) { where.push('contract_id = ?'); args.push(contract_id); }
        if (account) { where.push('account = ?'); args.push(account); }
        const rows = await db.all(
            `SELECT * FROM contract_products ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id ASC`,
            args
        );
        return rows.filter((r) => names.has(r.account)).map(rowToScope);
    },

    /** Replaces a contract's whole scope in one go. */
    async setScope(contractId, products, user) {
        const db = await getDb();
        const contract = await contractRepo.get(contractId, user); // scoped: 404s if not theirs
        if (!contract) return { notFound: true };

        const now = new Date().toISOString();
        await db.run('DELETE FROM contract_products WHERE contract_id = ?', [contractId]);
        for (const p of products) {
            const def = PRODUCT_BY_KEY[p.product_key];
            // A product with no named items is counted, not listed — don't store
            // names against something that doesn't have them.
            const items = def?.itemLabel ? (p.items || []).filter(Boolean) : [];
            // If items are named, they are the count. Two sources of truth for
            // "how many frameworks" is one too many.
            const count = items.length ? items.length : Math.max(0, Number(p.unit_count) || 0);
            await db.run(
                `INSERT INTO contract_products (contract_id, account, product_key, unit_count, items, info, created_at, updated_at)
                 VALUES (?,?,?,?,?,?,?,?)`,
                [contractId, contract.account, p.product_key, count, JSON.stringify(items), p.info || '', now, now]
            );
        }
        return { scope: await this.listScope(user, { contract_id: contractId }) };
    },

    // ---- account-level product scope (the modules opted for on the account) ----
    async listAccountScope(user, account) {
        if (!(await accessibleAccounts(user)).has(account)) return [];
        const db = await getDb();
        const rows = await db.all('SELECT * FROM account_products WHERE account = ? ORDER BY id ASC', [account]);
        return rows.map(rowToScope);
    },

    /** Replaces an account's opted-modules scope in one go. */
    async setAccountScope(account, products, user) {
        if (!(await accessibleAccounts(user)).has(account)) return { forbidden: true };
        const db = await getDb();
        const now = new Date().toISOString();
        await db.run('DELETE FROM account_products WHERE account = ?', [account]);
        for (const p of products) {
            const def = PRODUCT_BY_KEY[p.product_key];
            if (!def) continue;
            const items = def.itemLabel ? (p.items || []).filter(Boolean) : [];
            const count = items.length ? items.length : Math.max(0, Number(p.unit_count) || 0);
            await db.run(
                `INSERT INTO account_products (account, product_key, unit_count, items, info, created_at, updated_at)
                 VALUES (?,?,?,?,?,?,?)`,
                [account, p.product_key, count, JSON.stringify(items), p.info || '', now, now]
            );
        }
        return { scope: await this.listAccountScope(user, account) };
    },

    // ---- invoices ----
    async listInvoices(user, { account, contract_id, status, overdue } = {}) {
        const db = await getDb();
        const names = await accessibleAccounts(user);
        const where = [];
        const args = [];
        if (account) { where.push('account = ?'); args.push(account); }
        if (contract_id) { where.push('contract_id = ?'); args.push(contract_id); }
        const rows = await db.all(
            `SELECT * FROM invoices ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY COALESCE(due_date, issue_date) DESC, id DESC`,
            args
        );
        let list = rows.filter((r) => names.has(r.account)).map(rowToInvoice);
        // Filter on the derived status so "Overdue" means what the user sees.
        if (status) list = list.filter((i) => i.status === status);
        if (overdue) list = list.filter((i) => i.overdue);
        return list;
    },

    async createInvoice(data, user) {
        const db = await getDb();
        const contract = await contractRepo.get(data.contract_id, user);
        if (!contract) return { notFound: true };

        const now = new Date().toISOString();
        const invoiceNo = data.invoice_no?.trim() || `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
        // Optionally attach a copy of an externally-raised invoice.
        let fileKey = '', fileName = '', mime = '';
        if (data.file_base64) {
            const saved = await storage.saveBase64(data.file_base64, data.file_name || `${invoiceNo}.pdf`);
            fileKey = saved.key; fileName = data.file_name || `${invoiceNo}.pdf`; mime = data.mime || 'application/octet-stream';
        }
        const r = await db.run(
            `INSERT INTO invoices
               (invoice_no, contract_id, account, amount, currency, status,
                issue_date, due_date, paid_date, period_from, period_to, notes, raised_by,
                file_key, file_name, mime, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
                invoiceNo, data.contract_id, contract.account,
                Math.max(0, Math.round(data.amount || 0)), data.currency || contract.currency || 'INR',
                data.status || 'Draft',
                data.issue_date || '', data.due_date || '', data.paid_date || '',
                data.period_from || '', data.period_to || '', data.notes || '',
                user.name || user.email || '', fileKey, fileName, mime, now, now
            ]
        );
        return { invoice: rowToInvoice(await db.get('SELECT * FROM invoices WHERE id = ?', [r.lastID])) };
    },

    /** Bytes of an attached invoice copy, ABAC-checked against the account. */
    async downloadInvoice(id, user) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM invoices WHERE id = ?', [id]);
        if (!row) return { notFound: true };
        const names = await accessibleAccounts(user);
        if (!names.has(row.account)) return { forbidden: true };
        if (!row.file_key) return { noFile: true };
        const buffer = await storage.read(row.file_key);
        return { buffer, file_name: row.file_name || 'invoice', mime: row.mime || 'application/octet-stream' };
    },

    async updateInvoice(id, data, user) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM invoices WHERE id = ?', [id]);
        if (!row) return { notFound: true };
        const names = await accessibleAccounts(user);
        if (!names.has(row.account)) return { forbidden: true };

        const sets = [];
        const params = [];
        for (const f of ['invoice_no', 'amount', 'currency', 'status', 'issue_date', 'due_date', 'paid_date', 'period_from', 'period_to', 'notes']) {
            if (data[f] !== undefined) { sets.push(`${f} = ?`); params.push(data[f]); }
        }
        // Marking it paid without a date leaves the ageing report guessing.
        if (data.status === 'Paid' && !data.paid_date && !row.paid_date) {
            sets.push('paid_date = ?');
            params.push(new Date().toISOString().slice(0, 10));
        }
        if (!sets.length) return { invoice: rowToInvoice(row) };
        sets.push('updated_at = ?');
        params.push(new Date().toISOString());
        await db.run(`UPDATE invoices SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
        return { invoice: rowToInvoice(await db.get('SELECT * FROM invoices WHERE id = ?', [id])) };
    },

    async removeInvoice(id, user) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM invoices WHERE id = ?', [id]);
        if (!row) return { notFound: true };
        const names = await accessibleAccounts(user);
        if (!names.has(row.account)) return { forbidden: true };
        await db.run('DELETE FROM invoices WHERE id = ?', [id]);
        return { deleted: true };
    },

    /** Receivables rollup for the CLM header. */
    async invoiceStats(user, filters = {}, fx = 83) {
        const list = await this.listInvoices(user, filters);
        const inr = (i) => (i.currency === 'USD' ? i.amount * fx : i.amount);
        const sum = (rows) => rows.reduce((s, i) => s + inr(i), 0);
        const outstanding = list.filter((i) => !['Paid', 'Cancelled'].includes(i.status));
        const overdue = list.filter((i) => i.overdue);
        return {
            count: list.length,
            raised: sum(list.filter((i) => i.status !== 'Draft' && i.status !== 'Cancelled')),
            collected: sum(list.filter((i) => i.status === 'Paid')),
            outstanding: sum(outstanding),
            outstandingCount: outstanding.length,
            overdue: sum(overdue),
            overdueCount: overdue.length,
            // Standard AR ageing buckets — how late, not just how much.
            ageing: overdue.reduce((acc, i) => {
                const b = i.days_overdue <= 30 ? '1-30' : i.days_overdue <= 60 ? '31-60' : i.days_overdue <= 90 ? '61-90' : '90+';
                acc[b] = (acc[b] || 0) + inr(i);
                return acc;
            }, {}),
            byStatus: list.reduce((acc, i) => { acc[i.status] = (acc[i.status] || 0) + 1; return acc; }, {})
        };
    }
};
