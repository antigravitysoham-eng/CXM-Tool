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
        // user adoption (active / total licensed users) per customer
        const uaRows = (await db.all('SELECT * FROM user_adoption')).filter((r) => names.has(r.account));
        const uaByAccount = Object.fromEntries(uaRows.map((r) => [r.account, r]));

        const accounts = [];
        for (const c of customers) {
            const subscribed = await scopeRepo.listAccountScope(user, c.name); // opted modules
            const measured = byAccount[c.name] || {};
            const keys = [...new Set([...subscribed.map((s) => s.product_key), ...Object.keys(measured)])];
            const modules = keys.map((k) => {
                const m = measured[k];
                const usageScore = m ? m.usage_score : null;
                return {
                    product_key: k, product: productName(k), color: PRODUCT_BY_KEY[k]?.color || '#94a3b8',
                    usageScore, band: adoptionBand(usageScore), lastActive: m?.last_active || null,
                    subscribed: subscribed.some((s) => s.product_key === k)
                };
            }).sort((a, b) => (b.usageScore ?? -1) - (a.usageScore ?? -1));
            const scored = modules.filter((m) => m.usageScore !== null);
            const avgUsage = scored.length ? Math.round(scored.reduce((s, m) => s + m.usageScore, 0) / scored.length) : null;
            const dormant = modules.filter((m) => m.band === 'Dormant');
            const ua = uaByAccount[c.name] || null;
            accounts.push({
                account: c.name, modules, moduleCount: modules.length, avgUsage,
                topModule: scored[0] || null,
                dormant: dormant.map((m) => m.product),
                dormantCount: dormant.length,
                activeUsers: ua ? ua.active_users : null,
                totalUsers: ua ? ua.total_users : null,
                userAdoptionRate: ua && ua.total_users ? Math.round((ua.active_users / ua.total_users) * 100) : null
            });
        }

        // portfolio: average usage per module across customers that have it
        const perModule = {};
        for (const a of accounts) for (const m of a.modules) {
            if (m.usageScore === null) continue;
            const p = perModule[m.product_key] || (perModule[m.product_key] = { product_key: m.product_key, product: m.product, color: m.color, total: 0, count: 0, dormant: 0 });
            p.total += m.usageScore; p.count += 1; if (m.band === 'Dormant') p.dormant += 1;
        }
        const modules = Object.values(perModule).map((p) => ({ ...p, avgUsage: Math.round(p.total / p.count) }))
            .sort((a, b) => b.avgUsage - a.avgUsage);

        const measuredAccounts = accounts.filter((a) => a.avgUsage !== null);
        const withUsers = accounts.filter((a) => a.userAdoptionRate !== null);
        return {
            products: PRODUCTS.filter((p) => p.key !== 'others').map((p) => ({ key: p.key, name: p.name, color: p.color })),
            accounts: accounts.sort((a, b) => (a.avgUsage ?? 999) - (b.avgUsage ?? 999)), // least-adopted first
            modules,
            summary: {
                customers: customers.length,
                measured: measuredAccounts.length,
                avgUsage: measuredAccounts.length ? Math.round(measuredAccounts.reduce((s, a) => s + a.avgUsage, 0) / measuredAccounts.length) : null,
                mostUsed: modules[0] || null,
                leastUsed: modules[modules.length - 1] || null,
                dormantModules: accounts.reduce((s, a) => s + a.dormantCount, 0),
                totalUsers: withUsers.reduce((s, a) => s + a.totalUsers, 0),
                activeUsers: withUsers.reduce((s, a) => s + a.activeUsers, 0),
                avgUserAdoption: withUsers.length ? Math.round(withUsers.reduce((s, a) => s + a.userAdoptionRate, 0) / withUsers.length) : null
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
        const db = await getDb();
        const customers = await accessibleCustomers(user);
        if (!customers.length) return { seeded: 0 };
        // A believable spread: each customer subscribes to 4 modules with mixed usage.
        const modKeys = ['interno', 'conformity', 'vendor_pulse', 'zak_services', 'agentctl', 'certifications'];
        const scorePlans = [
            [88, 62, 15, 4], [95, 40, 22, 8], [70, 55, 30, 12], [50, 18, 6, 0], [82, 48, 25, 9], [60, 35, 10, 2]
        ];
        const userPlans = [[42, 60], [18, 25], [70, 120], [9, 40], [55, 65], [22, 30]];
        let seeded = 0;
        for (let i = 0; i < customers.length; i++) {
            const picks = [modKeys[i % modKeys.length], modKeys[(i + 1) % modKeys.length], modKeys[(i + 2) % modKeys.length], modKeys[(i + 4) % modKeys.length]];
            const scores = scorePlans[i % scorePlans.length];
            for (let j = 0; j < picks.length; j++) {
                await this.setAdoption(customers[i].name, picks[j], { usage_score: scores[j] }, user);
            }
            const [active, total] = userPlans[i % userPlans.length];
            await this.setUserAdoption(customers[i].name, { active_users: active, total_users: total }, user);
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
