import { getDb } from '../db.js';
import { accountRepo } from './accountRepo.js';
import { isStalled, JOURNEY_STAGES, LIFECYCLE_PATH } from '../data/journeyKit.js';

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
        return { seeded };
    }
};
