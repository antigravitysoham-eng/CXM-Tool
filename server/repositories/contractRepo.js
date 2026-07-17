import { getDb } from '../db.js';
import { accountRepo } from './accountRepo.js';
import { daysToRenewal, renewalBucket, activeMilestone } from '../services/renewalService.js';
import { SAMPLE_CONTRACTS, SAMPLE_CONTACTS, SUPPORT_TIER_BY_ACCOUNT } from '../data/sampleContracts.js';

function fmtMoney(amount, currency) {
    const n = Math.round(amount || 0);
    if (currency === 'INR') {
        if (n >= 10000000) return `₹${(n / 10000000).toFixed(2).replace(/\.00$/, '')}Cr`;
        if (n >= 100000) return `₹${(n / 100000).toFixed(2).replace(/\.00$/, '')}L`;
        return `₹${n.toLocaleString('en-IN')}`;
    }
    if (n >= 1000000) return `$${(n / 1000000).toFixed(2).replace(/\.00$/, '')}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    return `$${n}`;
}

function noticeDeadline(c) {
    const d = c.renewal_date || c.end_date;
    if (!d) return '';
    const t = new Date(d);
    if (Number.isNaN(t.getTime())) return '';
    t.setDate(t.getDate() - (c.notice_period_days || 30));
    return t.toISOString().slice(0, 10);
}

function rowToContract(row) {
    if (!row) return null;
    const c = {
        id: row.id,
        account: row.account,
        type: row.type,
        status: row.status,
        stage: row.stage,
        value: row.value || '',
        date: row.date || row.startDate || '',
        deployment: row.deployment || 'SaaS',
        license_type: row.license_type || 'Subscription',
        perpetual_term_years: row.perpetual_term_years ?? null,
        billing_frequency: row.billing_frequency || 'Yearly',
        support_tier: row.support_tier || 'Standard',
        payment_terms: row.payment_terms || 'Net 30',
        start_date: row.startDate || '',
        end_date: row.end_date || '',
        renewal_date: row.renewal_date || row.end_date || '',
        term_months: row.term_months ?? 12,
        auto_renew: !!row.auto_renew,
        notice_period_days: row.notice_period_days ?? 30,
        currency: row.currency || 'INR',
        tcv: row.tcv ?? 0,
        arr: row.arr ?? 0,
        mrr: row.mrr ?? 0,
        spoc_name: row.spoc_name || '', spoc_email: row.spoc_email || '', spoc_role: row.spoc_role || '',
        csm_name: row.csm_name || '', csm_email: row.csm_email || '',
        am_name: row.am_name || '', am_email: row.am_email || '',
        owner: row.owner || '', notes: row.notes || '',
        created_at: row.created_at, updated_at: row.updated_at
    };
    const days = daysToRenewal(c);
    c.days_to_renewal = days;
    c.renewal_bucket = renewalBucket(days);
    c.active_milestone = activeMilestone(days);
    c.notice_deadline = noticeDeadline(c);
    return c;
}

function genId() {
    return `CTR-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
}

const COLS = [
    'id', 'account', 'type', 'status', 'stage', 'value', 'date',
    'deployment', 'license_type', 'perpetual_term_years', 'billing_frequency', 'support_tier', 'payment_terms',
    'startDate', 'end_date', 'renewal_date', 'term_months', 'auto_renew', 'notice_period_days',
    'currency', 'tcv', 'arr', 'mrr',
    'spoc_name', 'spoc_email', 'spoc_role', 'csm_name', 'csm_email', 'am_name', 'am_email',
    'owner', 'notes', 'created_at', 'updated_at'
];

function toRowValues(d, now) {
    const renewal = d.renewal_date || d.end_date || '';
    return {
        id: d.id, account: d.account, type: d.type, status: d.status, stage: d.status,
        value: fmtMoney(d.tcv, d.currency), date: d.start_date || '',
        deployment: d.deployment, license_type: d.license_type, perpetual_term_years: d.perpetual_term_years ?? null,
        billing_frequency: d.billing_frequency, support_tier: d.support_tier || 'Standard', payment_terms: d.payment_terms,
        startDate: d.start_date || '', end_date: d.end_date || '', renewal_date: renewal,
        term_months: d.term_months ?? 12, auto_renew: d.auto_renew ? 1 : 0, notice_period_days: d.notice_period_days ?? 30,
        currency: d.currency, tcv: d.tcv ?? 0, arr: d.arr ?? 0, mrr: d.mrr ?? 0,
        spoc_name: d.spoc_name || '', spoc_email: d.spoc_email || '', spoc_role: d.spoc_role || '',
        csm_name: d.csm_name || '', csm_email: d.csm_email || '', am_name: d.am_name || '', am_email: d.am_email || '',
        owner: d.owner || '', notes: d.notes || '', created_at: now, updated_at: now
    };
}

// period: { field: 'renewal_date'|'start_date'|'end_date', from, to }
function inPeriod(c, period) {
    if (!period || !period.field) return true;
    const map = { renewal_date: c.renewal_date, start_date: c.start_date, end_date: c.end_date };
    const v = map[period.field] || '';
    if (period.from && v < period.from) return false;
    if (period.to && v > period.to) return false;
    return true;
}

/**
 * Contracts hang off an account and hold no access attributes of their own, so
 * they inherit the account's — a contract is visible exactly when its account is.
 *
 * `user` is required rather than optional: an optional scope is one a caller can
 * forget, and forgetting it here means handing over every customer's contracts.
 * Fail closed instead.
 */
async function scopeToUser(list, user) {
    if (!user) {
        throw new Error('contractRepo: a user is required to scope contracts — pass req.user');
    }
    const accounts = await accountRepo.list(user);
    const names = new Set(accounts.map((a) => a.name));
    return list.filter((c) => names.has(c.account));
}

export const contractRepo = {
    async list({ account, status, deployment, license_type, period } = {}, user) {
        const db = await getDb();
        const rows = await db.all('SELECT * FROM contracts ORDER BY renewal_date ASC');
        let list = rows.map(rowToContract);
        if (account) list = list.filter((c) => c.account === account);
        if (status) list = list.filter((c) => c.status === status);
        if (deployment) list = list.filter((c) => c.deployment === deployment);
        if (license_type) list = list.filter((c) => c.license_type === license_type);
        if (period) list = list.filter((c) => inPeriod(c, period));
        return scopeToUser(list, user);
    },

    async get(id, user) {
        const contract = await this.getRaw(id);
        if (!contract) return null;
        const [visible] = await scopeToUser([contract], user);
        return visible || null;
    },

    // Unscoped read for internal use only — writes echoing back the row they just
    // wrote, where the caller's access was already established. Never serve this
    // straight to a route.
    async getRaw(id) {
        const db = await getDb();
        return rowToContract(await db.get('SELECT * FROM contracts WHERE id = ?', [id]));
    },

    async create(data) {
        const db = await getDb();
        const id = data.id && data.id.trim() ? data.id.trim() : genId();
        const vals = toRowValues({ ...data, id }, new Date().toISOString());
        const placeholders = COLS.map(() => '?').join(', ');
        await db.run(`INSERT INTO contracts (${COLS.join(', ')}) VALUES (${placeholders})`, COLS.map((k) => vals[k]));
        return this.getRaw(id);
    },

    async update(id, data, user) {
        const db = await getDb();
        const existing = await db.get('SELECT * FROM contracts WHERE id = ?', [id]);
        if (!existing) return { notFound: true };
        // Reading a contract was scoped; writing one was not, so a rep could PATCH
        // a contract they could not even GET. Same gate on both paths now.
        if (!(await this.get(id, user))) return { forbidden: true };
        const merged = { ...rowToContract(existing), ...data };
        const vals = toRowValues(merged, existing.created_at || new Date().toISOString());
        vals.updated_at = new Date().toISOString();
        const sets = COLS.filter((k) => k !== 'id').map((k) => `${k} = ?`).join(', ');
        await db.run(`UPDATE contracts SET ${sets} WHERE id = ?`, [...COLS.filter((k) => k !== 'id').map((k) => vals[k]), id]);
        return { contract: await this.getRaw(id) };
    },

    async remove(id, user) {
        const db = await getDb();
        const existing = await db.get('SELECT * FROM contracts WHERE id = ?', [id]);
        if (!existing) return { notFound: true };
        if (!(await this.get(id, user))) return { forbidden: true };
        await db.run('DELETE FROM contracts WHERE id = ?', [id]);
        // The scope goes with it; the documents do not (see below).
        await db.run('DELETE FROM contract_products WHERE contract_id = ?', [id]);
        // Detach, don't destroy: a signed agreement outlives the contract record it
        // was filed under, and stays in the account's library.
        await db.run("UPDATE documents SET contract_id = '' WHERE contract_id = ?", [id]);
        return { deleted: true };
    },

    // Everything about one customer: contracts + aggregates + documents.
    async customer360(account, user) {
        // An account the caller cannot read has no 360 to show. Without this the
        // whole customer file — contracts, contacts, documents — was one URL away.
        const visible = await accountRepo.list(user);
        if (!visible.some((a) => a.name === account)) return null;

        const contracts = await this.list({ account }, user);
        const documents = await this.listDocuments({ account });
        const contacts = await this.listContacts(account);
        const toBase = (c) => (c.currency === 'INR' ? c.tcv : c.tcv * 83);
        const active = contracts.filter((c) => c.status === 'Active' || c.status === 'Renewing');
        const totalTcv = active.reduce((s, c) => s + toBase(c), 0);
        const totalArr = active.reduce((s, c) => s + (c.currency === 'INR' ? c.arr : c.arr * 83), 0);
        const upcoming = contracts.filter((c) => c.days_to_renewal !== null && c.days_to_renewal <= 90 && c.days_to_renewal >= -30);
        const atRisk = upcoming.reduce((s, c) => s + toBase(c), 0);
        const nextRenewal = contracts
            .filter((c) => c.days_to_renewal !== null && c.days_to_renewal >= 0)
            .sort((a, b) => a.days_to_renewal - b.days_to_renewal)[0] || null;
        return {
            account,
            contracts,
            documents,
            contacts,
            metrics: {
                contractCount: contracts.length,
                activeCount: active.length,
                totalTcvInr: totalTcv,
                totalArrInr: totalArr,
                revenueAtRiskInr: atRisk,
                nextRenewalDays: nextRenewal ? nextRenewal.days_to_renewal : null,
                nextRenewalDate: nextRenewal ? nextRenewal.renewal_date : null,
                autoRenewCount: contracts.filter((c) => c.auto_renew).length,
                documentCount: documents.length,
                contactCount: contacts.length,
                supportTier: active[0] ? active[0].support_tier : (contracts[0] ? contracts[0].support_tier : null)
            }
        };
    },

    // ---- customer contacts (multiple SPOCs) ----
    async listContacts(account) {
        const db = await getDb();
        return db.all('SELECT * FROM customer_contacts WHERE account = ? ORDER BY is_primary DESC, id ASC', [account]);
    },
    async addContact(c) {
        const db = await getDb();
        const r = await db.run(
            'INSERT INTO customer_contacts (account, name, designation, email, phone, is_primary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [c.account, c.name, c.designation || '', c.email || '', c.phone || '', c.is_primary ? 1 : 0, new Date().toISOString()]
        );
        return db.get('SELECT * FROM customer_contacts WHERE id = ?', [r.lastID]);
    },
    async removeContact(id) {
        const db = await getDb();
        await db.run('DELETE FROM customer_contacts WHERE id = ?', [id]);
        return { deleted: true };
    },

    // ---- documents ----
    async listDocuments({ contract_id, account } = {}) {
        const db = await getDb();
        if (contract_id) return db.all('SELECT * FROM documents WHERE contract_id = ? ORDER BY id DESC', [contract_id]);
        if (account) return db.all('SELECT * FROM documents WHERE account = ? ORDER BY id DESC', [account]);
        return db.all('SELECT * FROM documents ORDER BY id DESC');
    },
    async addDocument(doc) {
        const db = await getDb();
        const r = await db.run(
            'INSERT INTO documents (contract_id, account, doc_type, name, link, version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [doc.contract_id || '', doc.account || '', doc.doc_type, doc.name, doc.link || '', doc.version || 'v1', new Date().toISOString()]
        );
        return db.get('SELECT * FROM documents WHERE id = ?', [r.lastID]);
    },
    async removeDocument(id) {
        const db = await getDb();
        await db.run('DELETE FROM documents WHERE id = ?', [id]);
        return { deleted: true };
    },

    // Wipe and load the sample contract set + their documents.
    async seedSample() {
        const db = await getDb();
        await db.run('DELETE FROM contracts');
        await db.run("DELETE FROM documents WHERE contract_id IS NOT NULL AND contract_id != ''");
        await db.run('DELETE FROM customer_contacts');
        for (const c of SAMPLE_CONTRACTS) {
            const { documents = [], ...contract } = c;
            contract.support_tier = SUPPORT_TIER_BY_ACCOUNT[contract.account] || 'Standard';
            await this.create(contract);
            for (const doc of documents) {
                await this.addDocument({ ...doc, contract_id: contract.id, account: contract.account });
            }
        }
        for (const ct of SAMPLE_CONTACTS) await this.addContact(ct);
        const count = await db.get('SELECT COUNT(*) as c FROM contracts');
        return { count: count.c };
    }
};
