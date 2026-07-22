import { getDb } from '../db.js';
import { accountRepo } from './accountRepo.js';
import { scopeRepo } from './scopeRepo.js';
import { isStalled, adoptionBand, JOURNEY_STAGES, LIFECYCLE_PATH } from '../data/journeyKit.js';
import { PRODUCTS, PRODUCT_BY_KEY, productName } from '../data/products.js';

/**
 * Compass — the customer lifecycle map.
 *
 * One journey row per customer (upserted). Days-in-stage, stall and progress
 * along the lifecycle path are derived. Scoped to the customers the caller can
 * see; customers with no journey row yet are surfaced as "Onboarding / unset".
 */

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000);

async function accessibleCustomers(user) {
    if (!user) throw new Error('journeyRepo: a user is required — pass req.user');
    return (await accountRepo.list(user)).filter((a) => a.segment === 'Customer');
}

function decorate(account, row) {
    const stage = row ? row.stage : 'Onboarding';
    const enteredAt = row?.stage_entered_at || row?.created_at || null;
    const daysInStage = enteredAt ? Math.max(0, daysBetween(today(), enteredAt.slice(0, 10))) : 0;
    const pathIndex = LIFECYCLE_PATH.indexOf(stage);
    return {
        account,
        stage,
        health: row ? row.health : 'Good',
        owner: row ? row.owner : '',
        notes: row ? row.notes : '',
        daysInStage,
        stalled: row ? isStalled(stage, daysInStage) : false,
        progress: pathIndex >= 0 ? Math.round(((pathIndex + 1) / LIFECYCLE_PATH.length) * 100) : null,
        onPath: pathIndex >= 0,
        set: !!row,
        updated_at: row?.updated_at || null
    };
}

export const journeyRepo = {
    async list(user) {
        const db = await getDb();
        const customers = await accessibleCustomers(user);
        const rows = await db.all('SELECT * FROM customer_journeys');
        const byAccount = Object.fromEntries(rows.map((r) => [r.account, r]));
        return customers.map((c) => decorate(c.name, byAccount[c.name]))
            .sort((a, b) => (b.stalled - a.stalled) || (JOURNEY_STAGES.indexOf(a.stage) - JOURNEY_STAGES.indexOf(b.stage)));
    },

    async get(account, user) {
        const customers = await accessibleCustomers(user);
        if (!customers.some((c) => c.name === account)) return null;
        const db = await getDb();
        const row = await db.get('SELECT * FROM customer_journeys WHERE account = ?', [account]);
        const events = await db.all('SELECT * FROM journey_events WHERE account = ? ORDER BY id DESC', [account]);
        return { ...decorate(account, row), events };
    },

    /** Set/advance a customer's journey. Changing stage stamps a new entered_at
     *  and logs a milestone event. */
    async set(account, data, user) {
        const customers = await accessibleCustomers(user);
        if (!customers.some((c) => c.name === account)) return { forbidden: true };
        const db = await getDb();
        const existing = await db.get('SELECT * FROM customer_journeys WHERE account = ?', [account]);
        const ts = now();
        const stage = data.stage || existing?.stage || 'Onboarding';
        const stageChanged = !existing || existing.stage !== stage;

        if (existing) {
            await db.run(
                `UPDATE customer_journeys SET stage = ?, health = ?, owner = ?, notes = ?, stage_entered_at = ?, updated_at = ? WHERE account = ?`,
                [stage, data.health ?? existing.health, data.owner ?? existing.owner, data.notes ?? existing.notes,
                    stageChanged ? ts : existing.stage_entered_at, ts, account]
            );
        } else {
            await db.run(
                `INSERT INTO customer_journeys (account, stage, health, owner, notes, stage_entered_at, created_at, updated_at)
                 VALUES (?,?,?,?,?,?,?,?)`,
                [account, stage, data.health || 'Good', data.owner || (user.name || ''), data.notes || '', ts, ts, ts]
            );
        }
        if (stageChanged) {
            await db.run('INSERT INTO journey_events (account, stage, note, created_at) VALUES (?,?,?,?)',
                [account, stage, data.note || `Moved to ${stage}`, ts]);
        } else if (data.note) {
            await db.run('INSERT INTO journey_events (account, stage, note, created_at) VALUES (?,?,?,?)', [account, stage, data.note, ts]);
        }
        return { journey: await this.get(account, user) };
    },

    /** The lifecycle map — customers grouped by stage. */
    async map(user) {
        const list = await this.list(user);
        const cols = {};
        for (const s of JOURNEY_STAGES) cols[s] = [];
        for (const j of list) (cols[j.stage] ||= []).push(j);
        return cols;
    },

    async stats(user) {
        const list = await this.list(user);
        const bump = (m, k) => { m[k] = (m[k] || 0) + 1; return m; };
        const advocacy = list.filter((j) => j.stage === 'Advocacy').length;
        return {
            customers: list.length,
            mapped: list.filter((j) => j.set).length,
            stalled: list.filter((j) => j.stalled).length,
            atRisk: list.filter((j) => j.stage === 'At Risk').length,
            advocacy,
            poorHealth: list.filter((j) => j.health === 'Poor').length,
            avgProgress: list.length ? Math.round(list.filter((j) => j.progress !== null).reduce((s, j) => s + j.progress, 0) / Math.max(1, list.filter((j) => j.progress !== null).length)) : 0,
            byStage: list.reduce((m, j) => bump(m, j.stage), {}),
            byHealth: list.reduce((m, j) => bump(m, j.health), {})
        };
    },

    // ─────────────────── module adoption / usage ───────────────────

    /**
     * Per-customer module usage: for every module a customer has subscribed to
     * (account scope) or that we've measured, a 0-100 usage score and band. Also
     * rolls up usage per module across the book, so a CSM can see which modules
     * are used most / least and steer health-check calls to the dormant ones.
     */
    async adoption(user) {
        const db = await getDb();
        const customers = await accessibleCustomers(user);
        const names = new Set(customers.map((c) => c.name));
        const rows = (await db.all('SELECT * FROM module_adoption')).filter((r) => names.has(r.account));
        const byAccount = {};
        for (const r of rows) (byAccount[r.account] ||= {})[r.product_key] = r;

        // per-user, per-module usage rows
        const uuRows = (await db.all('SELECT * FROM module_user_usage')).filter((r) => names.has(r.account));
        const uuByAccount = {};
        for (const r of uuRows) (uuByAccount[r.account] ||= []).push(r);

        const mod = (k, usage) => ({ product_key: k, product: productName(k), color: PRODUCT_BY_KEY[k]?.color || '#94a3b8', usage, band: adoptionBand(usage) });

        const accounts = [];
        for (const c of customers) {
            const subscribed = await scopeRepo.listAccountScope(user, c.name); // the account's product subscription
            const subKeys = subscribed.map((s) => s.product_key);
            const measured = byAccount[c.name] || {};
            const userRows = uuByAccount[c.name] || [];

            // The module set is SYNCED to the subscription: only modules the account
            // pays for (plus any we've measured, in case scope isn't set) are shown.
            const keys = [...new Set([...subKeys, ...Object.keys(measured), ...userRows.map((r) => r.product_key)])];

            // per-user breakdown — which modules each named user actually uses
            const usersMap = {};
            for (const r of userRows) {
                const u = usersMap[r.user_name] || (usersMap[r.user_name] = { name: r.user_name, role: r.role || '', modules: [] });
                u.modules.push(mod(r.product_key, r.usage_score));
            }
            const users = Object.values(usersMap).map((u) => {
                u.modules.sort((a, b) => b.usage - a.usage);
                const active = u.modules.filter((m) => m.usage >= 10);
                u.overallUsage = u.modules.length ? Math.round(u.modules.reduce((s, m) => s + m.usage, 0) / u.modules.length) : 0;
                u.topModule = u.modules[0] || null;
                u.activeModules = active.length;
                return u;
            }).sort((a, b) => b.overallUsage - a.overallUsage);

            // customer-level per-module usage: average of its users, else the
            // module_adoption baseline, else null.
            const modules = keys.map((k) => {
                const uv = userRows.filter((r) => r.product_key === k);
                const fromUsers = uv.length ? Math.round(uv.reduce((s, r) => s + r.usage_score, 0) / uv.length) : null;
                const usage = fromUsers ?? (measured[k] ? measured[k].usage_score : null);
                return {
                    ...mod(k, usage), usageScore: usage,
                    userCount: uv.length, subscribed: subKeys.includes(k)
                };
            }).sort((a, b) => Number(b.subscribed) - Number(a.subscribed) || (b.usageScore ?? -1) - (a.usageScore ?? -1));

            const scored = modules.filter((m) => m.usageScore !== null);
            const overallUsage = scored.length ? Math.round(scored.reduce((s, m) => s + m.usageScore, 0) / scored.length) : null;
            const dormant = modules.filter((m) => m.band === 'Dormant');
            accounts.push({
                account: c.name,
                subscribedCount: subKeys.length,
                modules,
                overallUsage,
                topModule: scored[0] || null,
                bottomModule: scored.length ? scored[scored.length - 1] : null,
                dormant: dormant.map((m) => m.product),
                dormantCount: dormant.length,
                users,
                userCount: users.length,
                activeUserCount: users.filter((u) => u.overallUsage >= 10).length
            });
        }

        // portfolio: average usage per module across customers that use it
        const perModule = {};
        for (const a of accounts) for (const m of a.modules) {
            if (m.usageScore === null) continue;
            const p = perModule[m.product_key] || (perModule[m.product_key] = { product_key: m.product_key, product: m.product, color: m.color, total: 0, count: 0, dormant: 0 });
            p.total += m.usageScore; p.count += 1; if (m.band === 'Dormant') p.dormant += 1;
        }
        const modules = Object.values(perModule).map((p) => ({ ...p, avgUsage: Math.round(p.total / p.count) }))
            .sort((a, b) => b.avgUsage - a.avgUsage);

        const measuredAccounts = accounts.filter((a) => a.overallUsage !== null);
        const totalUsers = accounts.reduce((s, a) => s + a.userCount, 0);
        const activeUsers = accounts.reduce((s, a) => s + a.activeUserCount, 0);
        return {
            products: PRODUCTS.filter((p) => p.key !== 'others').map((p) => ({ key: p.key, name: p.name, color: p.color })),
            accounts: accounts.sort((a, b) => (a.overallUsage ?? 999) - (b.overallUsage ?? 999)), // least-adopted first
            modules,
            summary: {
                customers: customers.length,
                measured: measuredAccounts.length,
                avgUsage: measuredAccounts.length ? Math.round(measuredAccounts.reduce((s, a) => s + a.overallUsage, 0) / measuredAccounts.length) : null,
                mostUsed: modules[0] || null,
                leastUsed: modules[modules.length - 1] || null,
                dormantModules: accounts.reduce((s, a) => s + a.dormantCount, 0),
                totalUsers,
                activeUsers,
                avgUserAdoption: totalUsers ? Math.round((activeUsers / totalUsers) * 100) : null
            }
        };
    },

    /** Upsert a customer's user-adoption numbers (active / total licensed users). */
    async setUserAdoption(account, { active_users, total_users }, user) {
        const customers = await accessibleCustomers(user);
        if (!customers.some((c) => c.name === account)) return { forbidden: true };
        const db = await getDb();
        const total = Math.max(0, Number(total_users) || 0);
        const active = Math.min(Math.max(0, Number(active_users) || 0), total || Number.MAX_SAFE_INTEGER);
        await db.run(
            `INSERT INTO user_adoption (account, active_users, total_users, updated_at) VALUES (?,?,?,?)
             ON CONFLICT(account) DO UPDATE SET active_users = excluded.active_users, total_users = excluded.total_users, updated_at = excluded.updated_at`,
            [account, active, total, now()]
        );
        return { ok: true };
    },

    /** Upsert one product user's usage of one module. */
    async setUserModuleUsage(account, userName, productKey, data, user) {
        const customers = await accessibleCustomers(user);
        if (!customers.some((c) => c.name === account)) return { forbidden: true };
        if (!PRODUCT_BY_KEY[productKey]) return { notFound: true };
        if (!userName) return { notFound: true };
        const db = await getDb();
        const score = Math.max(0, Math.min(100, Number(data.usage_score) || 0));
        await db.run(
            `INSERT INTO module_user_usage (account, user_name, role, product_key, usage_score, last_active, updated_at)
             VALUES (?,?,?,?,?,?,?)
             ON CONFLICT(account, user_name, product_key) DO UPDATE SET usage_score = excluded.usage_score, last_active = excluded.last_active, updated_at = excluded.updated_at`,
            [account, userName, data.role || '', productKey, score, data.last_active || today(), now()]
        );
        return { ok: true };
    },

    /** Upsert a customer's usage score for one module. */
    async setAdoption(account, productKey, data, user) {
        const customers = await accessibleCustomers(user);
        if (!customers.some((c) => c.name === account)) return { forbidden: true };
        if (!PRODUCT_BY_KEY[productKey]) return { notFound: true };
        const db = await getDb();
        const score = Math.max(0, Math.min(100, Number(data.usage_score) || 0));
        const ts = now();
        await db.run(
            `INSERT INTO module_adoption (account, product_key, usage_score, last_active, updated_at)
             VALUES (?,?,?,?,?)
             ON CONFLICT(account, product_key) DO UPDATE SET usage_score = excluded.usage_score, last_active = excluded.last_active, updated_at = excluded.updated_at`,
            [account, productKey, score, data.last_active || today(), ts]
        );
        return { ok: true };
    },

    async seedAdoption(user) {
        const customers = await accessibleCustomers(user);
        if (!customers.length) return { seeded: 0 };
        const modKeys = ['interno', 'conformity', 'vendor_pulse', 'zak_services', 'agentctl', 'certifications'];
        // Named users per customer, and which of the subscribed modules each one
        // leans on — deliberately uneven, so "this user lives in Conformity, that
        // one only touches Vendor Pulse" is visible.
        const people = [
            { name: 'Ravi Kumar', role: 'Admin' },
            { name: 'Priya Sharma', role: 'Risk Analyst' },
            { name: 'Arjun Mehta', role: 'Compliance Lead' },
            { name: 'Neha Verma', role: 'Ops Manager' }
        ];
        // per-user module-usage matrix over the 4 subscribed modules [m0,m1,m2,m3]
        const userMatrices = [
            [[92, 40, 0, 0], [15, 0, 78, 0], [0, 30, 0, 62]],           // spread across 3 users
            [[95, 60, 20, 0], [0, 0, 85, 40], [10, 25, 0, 0], [0, 0, 0, 55]],
            [[70, 0, 35, 0], [0, 88, 0, 20], [22, 0, 0, 66]],
            [[45, 10, 0, 0], [0, 0, 30, 6], [8, 0, 0, 0]],
            [[80, 50, 25, 0], [0, 0, 90, 15], [12, 20, 0, 0]],
            [[62, 0, 0, 30], [0, 40, 12, 0], [0, 0, 55, 8]]
        ];
        let seeded = 0;
        for (let i = 0; i < customers.length; i++) {
            const account = customers[i].name;
            // 1) Subscription — synced source of truth. Set it if the account has none.
            let subscribed = (await scopeRepo.listAccountScope(user, account)).map((s) => s.product_key);
            const subMods = [modKeys[i % modKeys.length], modKeys[(i + 1) % modKeys.length], modKeys[(i + 2) % modKeys.length], modKeys[(i + 4) % modKeys.length]];
            if (!subscribed.length) {
                await scopeRepo.setAccountScope(account, subMods.map((k) => ({ product_key: k, unit_count: 1, items: [] })), user);
                subscribed = subMods;
            }
            const mods = subscribed.slice(0, 4);

            // 2) Per-user usage over those subscribed modules.
            const matrix = userMatrices[i % userMatrices.length];
            for (let u = 0; u < matrix.length && u < people.length; u++) {
                const row = matrix[u];
                for (let m = 0; m < mods.length; m++) {
                    if (!row[m]) continue; // this user doesn't touch this module
                    await this.setUserModuleUsage(account, people[u].name, mods[m], { role: people[u].role, usage_score: row[m] }, user);
                }
            }

            // 3) Customer-level module baseline = average of the users (keeps the
            //    module_adoption table in step for anything that reads it).
            for (let m = 0; m < mods.length; m++) {
                const vals = matrix.map((r) => r[m]).filter((v) => v > 0);
                const avg = vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
                await this.setAdoption(account, mods[m], { usage_score: avg }, user);
            }
            seeded += 1;
        }
        return { seeded };
    },

    async seedSample(user) {
        const customers = await accessibleCustomers(user);
        if (!customers.length) return { seeded: 0 };
        const plan = [
            { stage: 'Adoption', health: 'Good' }, { stage: 'Value', health: 'Good' },
            { stage: 'Growth', health: 'Watch' }, { stage: 'At Risk', health: 'Poor' },
            { stage: 'Renewal', health: 'Good' }, { stage: 'Advocacy', health: 'Good' }
        ];
        let seeded = 0;
        for (let i = 0; i < customers.length; i++) {
            const p = plan[i % plan.length];
            const r = await this.set(customers[i].name, { stage: p.stage, health: p.health, note: `Seeded at ${p.stage}` }, user);
            if (r.journey) seeded += 1;
        }
        await this.seedAdoption(user); // also seed module usage for the adoption view
        return { seeded };
    }
};
