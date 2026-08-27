import bcrypt from 'bcrypt';
import { getDb } from '../db.js';
import { scope, canAccess } from '../services/policyService.js';
import { MEDDICC_PILLARS } from '../validation/accountSchema.js';

// Resource attributes an account exposes to the policy engine.
const asResource = (row) => ({ owner_id: row.owner_id, region: row.region, segment: row.type });
import {
    SAMPLE_SALES_USERS,
    SAMPLE_USER_PASSWORD,
    SAMPLE_PARTNERS,
    SAMPLE_ACCOUNTS
} from '../data/sampleAccounts.js';

// Legacy display string kept in sync for modules that still read customers.value.
function formatMoney(amount, currency) {
    const n = Number(amount) || 0;
    if (currency === 'INR') {
        if (n >= 10000000) return `₹${(n / 10000000).toFixed(2).replace(/\.00$/, '')}Cr`;
        if (n >= 100000) return `₹${(n / 100000).toFixed(2).replace(/\.00$/, '')}L`;
        return `₹${n.toLocaleString('en-IN')}`;
    }
    if (n >= 1000000) return `$${(n / 1000000).toFixed(2).replace(/\.00$/, '')}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    return `$${n}`;
}

// DB row -> API shape: expose `segment`, a nested `meddicc`, and a computed score.
function rowToAccount(row) {
    if (!row) return null;
    const meddicc = {};
    let score = 0;
    for (const p of MEDDICC_PILLARS) {
        const v = row[`meddicc_${p}`] || '';
        meddicc[p] = v;
        if (v.trim()) score += 1;
    }
    return {
        id: row.id,
        name: row.name,
        segment: row.type,
        source: row.source,
        sourcing_partner_id: row.sourcing_partner_id,
        stage: row.stage,
        industry: row.industry,
        region: row.region || '',
        country: row.country || '',
        state: row.state || '',
        city: row.city || '',
        tier: row.tier,
        value_amount: row.value_amount ?? 0,
        value_currency: row.value_currency || 'INR',
        // Revenue-recognition inputs for date-range pro-rating.
        engagement_start: row.engagement_start || '',
        value_basis: row.value_basis || 'Annual',
        term_months: row.term_months ?? 12,
        probability: row.probability ?? 0,
        owner_id: row.owner_id,
        sales_owner: row.sales_owner || '',
        partner_manager: row.partner_manager || '',
        partner_manager_id: row.partner_manager_id ?? null,
        cxm: row.cxm || '',
        // When the account landed in its current stage, and how long it has sat
        // there. Falls back to creation for rows that predate stage tracking.
        stage_entered_at: row.stage_entered_at || row.created_at || null,
        days_in_stage: daysSince(row.stage_entered_at || row.created_at),
        // For a closed deal, the full cycle: created → the day it closed.
        days_to_close: row.stage === 'Closed'
            ? daysBetween(row.created_at, row.stage_entered_at || row.updated_at)
            : null,
        health: row.health || 'Good',
        renewal: row.renewal || '',
        next_step: row.next_step || '',
        next_step_date: row.next_step_date || '',
        meddicc,
        meddicc_score: score,
        custom_fields: row.custom_fields ? JSON.parse(row.custom_fields) : {},
        created_at: row.created_at,
        updated_at: row.updated_at
    };
}

/** Whole days from an ISO date to now, or null if the date is missing. */
function daysSince(iso) {
    if (!iso) return null;
    return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 864e5));
}
/** Whole days between two ISO dates, or null. */
function daysBetween(from, to) {
    if (!from || !to) return null;
    return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 864e5));
}

/**
 * An account is a single entity, but its NAME is the foreign key used across the
 * whole platform — contracts, product scope, invoices, documents, contacts, and
 * every per-module record reference the account by name. So renaming an account
 * must move all of them with it, or they orphan under the old name. We discover
 * every table that has an `account` column at runtime, so any table added later
 * cascades automatically too. (Id-keyed links — stage events, partner managers —
 * are already rename-safe and untouched.)
 */
async function cascadeAccountRename(db, oldName, newName) {
    if (!oldName || !newName || oldName === newName) return;
    const tables = await db.all("SELECT name FROM sqlite_master WHERE type = 'table'");
    for (const { name } of tables) {
        if (name === 'customers') continue; // the account row itself is renamed via SET name
        const cols = await db.all(`PRAGMA table_info(${name})`);
        if (cols.some((c) => c.name === 'account')) {
            await db.run(`UPDATE ${name} SET account = ? WHERE account = ?`, [newName, oldName]);
        }
    }
}

/**
 * Provision a CLM contract for a won account so its value flows to CLM / Dashboard
 * / performance. Dynamically imported to avoid a circular dependency (contractRepo
 * and scopeRepo both import accountRepo). Best-effort: a failure here must never
 * break the account write, so it's swallowed with a log.
 */
async function syncContract(account, user) {
    if (!account || account.segment !== 'Customer') return;
    try {
        const { ensureContractForAccount } = await import('../services/contractSyncService.js');
        await ensureContractForAccount(account, user);
    } catch (e) {
        console.error('[contract-sync] failed for', account?.name, e.message);
    }
}

// Shared insert used by create() and the sample seeder. `data` fields are resolved
// (owner_id / sourcing_partner_id are ids, meddicc is a nested object).
async function insertAccount(db, data) {
    const now = new Date().toISOString();
    const legacyValue = formatMoney(data.value_amount, data.value_currency);
    const result = await db.run(
        `INSERT INTO customers
          (name, type, source, sourcing_partner_id, stage, stage_entered_at, partner_manager, partner_manager_id,
           industry, region, country, state, city, tier,
           value_amount, value_currency, value, arr, engagement_start, value_basis, term_months, probability, owner_id, sales_owner, owner,
           cxm, health, status, renewal, progress, next_step, next_step_date,
           meddicc_metrics, meddicc_economic_buyer, meddicc_decision_criteria,
           meddicc_decision_process, meddicc_identify_pain, meddicc_champion, meddicc_competition,
           custom_fields, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?, ?,?,?,?,?,?, ?,?,?,?,?,?,?,?,?,?,?, ?,?,?,?,?,?,?, ?,?,?,?,?,?,?, ?,?,?)`,
        [
            data.name, data.segment, data.source, data.sourcing_partner_id ?? null, data.stage,
            now, data.partner_manager || '', data.partner_manager_id ?? null,
            data.industry || '', data.region || 'India', data.country || '', data.state || '', data.city || '', data.tier || 'Starter',
            data.value_amount, data.value_currency, legacyValue, legacyValue,
            data.engagement_start || '', data.value_basis || 'Annual', data.term_months ?? 12,
            data.probability ?? 0, data.owner_id ?? null, data.sales_owner || '', data.sales_owner || '',
            data.cxm || '', data.health || 'Good', data.stage, data.renewal || '',
            data.segment === 'Customer' ? 100 : (data.probability ?? 0),
            data.next_step || '', data.next_step_date || '',
            data.meddicc?.metrics || '', data.meddicc?.economic_buyer || '', data.meddicc?.decision_criteria || '',
            data.meddicc?.decision_process || '', data.meddicc?.identify_pain || '', data.meddicc?.champion || '',
            data.meddicc?.competition || '',
            JSON.stringify(data.custom_fields || {}), now, now
        ]
    );
    return result.lastID;
}

export const accountRepo = {
    async list(user) {
        const db = await getDb();
        const { clause, params } = await scope(user, 'accounts');
        const rows = await db.all(`SELECT * FROM customers WHERE ${clause} ORDER BY id DESC`, params);
        return rows.map(rowToAccount);
    },

    async get(id, user) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
        if (!row) return null;
        if (!(await canAccess(user, asResource(row), 'read', 'accounts'))) return null;
        return rowToAccount(row);
    },

    async create(data, user) {
        const db = await getDb();
        // A rep always owns what they create; managers/admins may assign an owner.
        const ownerId = user.role === 'rep' ? user.id : (data.owner_id ?? null);
        const id = await insertAccount(db, { ...data, owner_id: ownerId });
        // Open the stage trail so time-in-stage is measurable from day one.
        await db.run('INSERT INTO account_stage_events (account_id, stage, entered_at, moved_by) VALUES (?,?,?,?)',
            [id, data.stage || 'Lead', new Date().toISOString(), user.name || '']);
        const account = rowToAccount(await db.get('SELECT * FROM customers WHERE id = ?', [id]));
        // A won account (Customer) needs a CLM contract so its value reflects in
        // CLM / Dashboard / performance. Best-effort; never blocks the account.
        await syncContract(account, user);
        return account;
    },

    async update(id, data, user, opts = {}) {
        const db = await getDb();
        const existing = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
        if (!existing) return { notFound: true };
        if (!(await canAccess(user, asResource(existing), 'write', 'accounts'))) return { forbidden: true };

        const sets = [];
        const params = [];
        const col = (name, val) => { sets.push(`${name} = ?`); params.push(val); };

        if (data.name !== undefined) col('name', data.name);
        if (data.segment !== undefined) { col('type', data.segment); }
        if (data.source !== undefined) col('source', data.source);
        if (data.sourcing_partner_id !== undefined) col('sourcing_partner_id', data.sourcing_partner_id);
        if (data.stage !== undefined) {
            col('stage', data.stage); col('status', data.stage);
            // Only reset the clock and log an event on an ACTUAL move — a PATCH
            // that re-sends the same stage should not restart the timer.
            if (data.stage !== existing.stage) {
                col('stage_entered_at', new Date().toISOString());
                // Stage drives account status (stored in `type`): a won deal (Closed)
                // becomes a Customer and moves to CLM; a lost one (Lost) is recycled to
                // a PQL. Skipped only if the caller set the status explicitly in the
                // same patch (so we never write `type` twice) or the account is a Partner.
                if (data.segment === undefined && existing.type !== 'Partner') {
                    if (data.stage === 'Closed') col('type', 'Customer');
                    else if (data.stage === 'Lost') col('type', 'PQL');
                }
            }
        }
        if (data.industry !== undefined) col('industry', data.industry);
        if (data.region !== undefined) col('region', data.region);
        if (data.country !== undefined) col('country', data.country);
        if (data.state !== undefined) col('state', data.state);
        if (data.city !== undefined) col('city', data.city);
        if (data.tier !== undefined) col('tier', data.tier);
        if (data.value_amount !== undefined || data.value_currency !== undefined) {
            const amount = data.value_amount ?? existing.value_amount ?? 0;
            const currency = data.value_currency ?? existing.value_currency ?? 'INR';
            col('value_amount', amount);
            col('value_currency', currency);
            const legacy = formatMoney(amount, currency);
            col('value', legacy);
            col('arr', legacy);
        }
        if (data.engagement_start !== undefined) col('engagement_start', data.engagement_start);
        if (data.value_basis !== undefined) col('value_basis', data.value_basis);
        if (data.term_months !== undefined) col('term_months', data.term_months);
        if (data.probability !== undefined) col('probability', data.probability);
        if (data.owner_id !== undefined && user.role !== 'rep') col('owner_id', data.owner_id);
        if (data.sales_owner !== undefined) { col('sales_owner', data.sales_owner); col('owner', data.sales_owner); }
        if (data.partner_manager !== undefined) col('partner_manager', data.partner_manager);
        if (data.partner_manager_id !== undefined) col('partner_manager_id', data.partner_manager_id ?? null);
        if (data.cxm !== undefined) col('cxm', data.cxm);
        if (data.health !== undefined) col('health', data.health);
        if (data.renewal !== undefined) col('renewal', data.renewal);
        if (data.next_step !== undefined) col('next_step', data.next_step);
        if (data.next_step_date !== undefined) col('next_step_date', data.next_step_date);
        if (data.meddicc !== undefined) {
            for (const p of MEDDICC_PILLARS) col(`meddicc_${p}`, data.meddicc[p] || '');
        }
        if (data.custom_fields !== undefined) {
            const merged = { ...(JSON.parse(existing.custom_fields || '{}')), ...data.custom_fields };
            col('custom_fields', JSON.stringify(merged));
        }
        col('updated_at', new Date().toISOString());

        await db.run(`UPDATE customers SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);

        // Renaming an account renames the whole entity: cascade the new name to every
        // table that references it by name so nothing is left stranded under the old.
        if (data.name !== undefined && data.name !== existing.name) {
            await cascadeAccountRename(db, existing.name, data.name);
        }

        // Append to the stage trail on a real move — after the write, so a failed
        // update leaves no orphan event.
        if (data.stage !== undefined && data.stage !== existing.stage) {
            await db.run('INSERT INTO account_stage_events (account_id, stage, entered_at, moved_by) VALUES (?,?,?,?)',
                [id, data.stage, new Date().toISOString(), user.name || '']);
            // A note about what happened in the stage being LEFT is logged against
            // that previous stage, so the record of it isn't lost on the move.
            if (opts.stageNote && String(opts.stageNote).trim()) {
                await db.run('INSERT INTO account_stage_discussions (account_id, stage, note, author, created_at) VALUES (?,?,?,?,?)',
                    [id, existing.stage, String(opts.stageNote).trim(), user.name || '', new Date().toISOString()]);
            }
        }
        const account = rowToAccount(await db.get('SELECT * FROM customers WHERE id = ?', [id]));
        // On the transition to Customer (stage → Closed, or status set to Customer),
        // provision the CLM contract from the account so its value reflects in CLM,
        // the Dashboard and performance without re-entry.
        if (account.segment === 'Customer' && existing.type !== 'Customer') {
            await syncContract(account, user);
        }
        return { account };
    },

    // ─────────────────── partner account managers (PAMs) ───────────────────

    /** The PAMs for a partner (ABAC read-checked via the partner account). */
    async partnerManagers(partnerId, user) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM customers WHERE id = ?', [partnerId]);
        if (!row) return { notFound: true };
        if (!(await canAccess(user, asResource(row), 'read', 'accounts'))) return { forbidden: true };
        const rows = await db.all('SELECT id, name, email FROM partner_managers WHERE partner_id = ? ORDER BY id', [partnerId]);
        return { managers: rows };
    },

    /** Replace a partner's PAM list (from the add/edit-partner form). */
    async setPartnerManagers(partnerId, list, user) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM customers WHERE id = ?', [partnerId]);
        if (!row) return { notFound: true };
        if (row.type !== 'Partner') return { invalid: 'Only a partner can have account managers' };
        if (!(await canAccess(user, asResource(row), 'write', 'accounts'))) return { forbidden: true };
        const clean = (Array.isArray(list) ? list : [])
            .map((m) => ({ name: String(m?.name || '').trim().slice(0, 120), email: String(m?.email || '').trim().slice(0, 160) }))
            .filter((m) => m.name);
        const now = new Date().toISOString();
        await db.run('DELETE FROM partner_managers WHERE partner_id = ?', [partnerId]);
        for (const m of clean) {
            await db.run('INSERT INTO partner_managers (partner_id, name, email, created_at) VALUES (?,?,?,?)', [partnerId, m.name, m.email, now]);
        }
        return { managers: await db.all('SELECT id, name, email FROM partner_managers WHERE partner_id = ? ORDER BY id', [partnerId]) };
    },

    // ─────────────────── per-stage discussion log ───────────────────

    /** All discussions for an account, oldest first (ABAC read-checked). */
    async discussions(id, user) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
        if (!row) return { notFound: true };
        if (!(await canAccess(user, asResource(row), 'read', 'accounts'))) return { forbidden: true };
        const rows = await db.all('SELECT id, stage, note, author, created_at FROM account_stage_discussions WHERE account_id = ? ORDER BY id', [id]);
        return { discussions: rows };
    },

    /** Add a discussion to an account, tagged to a stage (defaults to current). */
    async addDiscussion(id, { stage, note }, user) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
        if (!row) return { notFound: true };
        if (!(await canAccess(user, asResource(row), 'write', 'accounts'))) return { forbidden: true };
        if (!String(note || '').trim()) return { invalid: 'note is required' };
        const r = await db.run(
            'INSERT INTO account_stage_discussions (account_id, stage, note, author, created_at) VALUES (?,?,?,?,?)',
            [id, stage || row.stage || '', String(note).trim().slice(0, 4000), user.name || '', new Date().toISOString()]
        );
        const disc = await db.get('SELECT id, stage, note, author, created_at FROM account_stage_discussions WHERE id = ?', [r.lastID]);
        return { discussion: disc };
    },

    async removeDiscussion(discId, user) {
        const db = await getDb();
        const disc = await db.get('SELECT * FROM account_stage_discussions WHERE id = ?', [discId]);
        if (!disc) return { notFound: true };
        const row = await db.get('SELECT * FROM customers WHERE id = ?', [disc.account_id]);
        if (!row || !(await canAccess(user, asResource(row), 'write', 'accounts'))) return { forbidden: true };
        await db.run('DELETE FROM account_stage_discussions WHERE id = ?', [discId]);
        return { deleted: true };
    },

    /** The full stage trail for one account, oldest first — for the drill-down. */
    async stageHistory(id, user) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
        if (!row) return { notFound: true };
        if (!(await canAccess(user, asResource(row), 'read', 'accounts'))) return { forbidden: true };
        const events = await db.all('SELECT stage, entered_at, moved_by FROM account_stage_events WHERE account_id = ? ORDER BY id', [id]);
        // Time spent in each stage = gap to the next event (or to now for the last).
        return events.map((e, i) => ({
            ...e,
            days: daysBetween(e.entered_at, i + 1 < events.length ? events[i + 1].entered_at : new Date().toISOString())
        }));
    },

    async remove(id, user) {
        const db = await getDb();
        const existing = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
        if (!existing) return { notFound: true };
        if (!(await canAccess(user, asResource(existing), 'delete', 'accounts'))) return { forbidden: true };
        await db.run('DELETE FROM customers WHERE id = ?', [id]);
        return { deleted: true };
    },

    // Wipe accounts and load the rich sample dataset. Ensures sample sales users exist.
    async seedSample() {
        const db = await getDb();

        // Ensure sample sales users (idempotent), collect email -> id.
        const ownerByEmail = {};
        for (const u of SAMPLE_SALES_USERS) {
            let existing = await db.get('SELECT id FROM users WHERE email = ?', [u.email]);
            if (!existing) {
                const hash = await bcrypt.hash(SAMPLE_USER_PASSWORD, 10);
                const r = await db.run(
                    'INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)',
                    [u.email, hash, u.name, u.role]
                );
                existing = { id: r.lastID };
            } else {
                await db.run('UPDATE users SET role = ? WHERE id = ?', [u.role, existing.id]);
            }
            ownerByEmail[u.email] = existing.id;
        }

        await db.run('DELETE FROM customers');

        // Partners first so accounts can reference them.
        const partnerByName = {};
        for (const p of SAMPLE_PARTNERS) {
            const id = await insertAccount(db, {
                name: p.name, segment: 'Partner', source: 'Direct', stage: 'Live',
                industry: p.industry, region: p.region || 'India', tier: 'Partner', value_amount: 0, value_currency: 'INR',
                probability: 0, owner_id: ownerByEmail[p.owner_email] ?? null,
                sales_owner: SAMPLE_SALES_USERS.find((u) => u.email === p.owner_email)?.name || '',
                cxm: '', health: 'Good', renewal: '', next_step: '', next_step_date: '', meddicc: {}
            });
            partnerByName[p.name] = id;
        }

        // Then customers + prospects.
        for (const a of SAMPLE_ACCOUNTS) {
            await insertAccount(db, {
                ...a,
                owner_id: ownerByEmail[a.owner_email] ?? null,
                sales_owner: SAMPLE_SALES_USERS.find((u) => u.email === a.owner_email)?.name || '',
                sourcing_partner_id: a.sourcing_partner_name ? (partnerByName[a.sourcing_partner_name] ?? null) : null,
                meddicc: a.meddicc || {}
            });
        }

        const count = await db.get('SELECT COUNT(*) as c FROM customers');
        return { count: count.c, salesUsers: SAMPLE_SALES_USERS.map((u) => u.email) };
    }
};
