import { getDb } from '../db.js';
import { accountRepo } from './accountRepo.js';
import { config } from '../config.js';
import { probabilityForStage, OPEN_STAGES, EXPANSION_STAGES } from '../data/expansionKit.js';

/**
 * Rainmaker — the expansion-revenue pipeline.
 *
 * Upsell / cross-sell / seat / tier opportunities on existing customers. Value
 * is normalised to INR; the weighted forecast is value x probability, and the
 * probability tracks the stage unless a rep overrides it.
 */

const now = () => new Date().toISOString();

async function accessibleNames(user) {
    if (!user) throw new Error('expansionRepo: a user is required — pass req.user');
    return new Set((await accountRepo.list(user)).map((a) => a.name));
}

function decorate(e) {
    const valueInr = (e.currency === 'INR' ? e.value_amount : e.value_amount * config.fxUsdInr) || 0;
    return { ...e, valueInr, weightedInr: Math.round(valueInr * (e.probability || 0) / 100) };
}

export const expansionRepo = {
    async list(user, { account, stage, type } = {}) {
        const db = await getDb();
        const names = await accessibleNames(user);
        const where = []; const params = [];
        if (account) { where.push('account = ?'); params.push(account); }
        if (stage) { where.push('stage = ?'); params.push(stage); }
        if (type) { where.push('type = ?'); params.push(type); }
        const rows = await db.all(`SELECT * FROM expansions ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC`, params);
        return rows.filter((e) => names.has(e.account)).map(decorate).sort((a, b) => b.weightedInr - a.weightedInr);
    },

    async get(id, user) {
        const db = await getDb();
        const e = await db.get('SELECT * FROM expansions WHERE id = ?', [id]);
        if (!e) return null;
        const names = await accessibleNames(user);
        if (!names.has(e.account)) return null;
        return decorate(e);
    },

    async create(data, user) {
        const db = await getDb();
        const names = await accessibleNames(user);
        if (!names.has(data.account)) return { forbidden: true };
        const ts = now();
        const stage = data.stage || 'Identified';
        const probability = data.probability ?? probabilityForStage(stage);
        const r = await db.run(
            `INSERT INTO expansions (account, title, type, product, value_amount, currency, stage, probability, target_close, owner, notes, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [data.account, data.title, data.type || 'Upsell', data.product || '', data.value_amount || 0, data.currency || 'INR',
                stage, probability, data.target_close || '', data.owner || (user.name || ''), data.notes || '', ts, ts]
        );
        return { expansion: await this.get(r.lastID, user) };
    },

    async update(id, data, user) {
        const db = await getDb();
        const e = await db.get('SELECT * FROM expansions WHERE id = ?', [id]);
        if (!e) return { notFound: true };
        const names = await accessibleNames(user);
        if (!names.has(e.account)) return { forbidden: true };
        const patch = { ...data };
        // Moving stage without setting probability pulls the stage-implied one.
        if (data.stage !== undefined && data.probability === undefined) patch.probability = probabilityForStage(data.stage);
        const sets = []; const params = [];
        for (const k of ['title', 'type', 'product', 'value_amount', 'currency', 'stage', 'probability', 'target_close', 'owner', 'notes']) {
            if (patch[k] !== undefined) { sets.push(`${k} = ?`); params.push(patch[k]); }
        }
        sets.push('updated_at = ?'); params.push(now());
        await db.run(`UPDATE expansions SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
        return { expansion: await this.get(id, user) };
    },

    async remove(id, user) {
        const db = await getDb();
        const e = await db.get('SELECT * FROM expansions WHERE id = ?', [id]);
        if (!e) return { notFound: true };
        const names = await accessibleNames(user);
        if (!names.has(e.account)) return { forbidden: true };
        await db.run('DELETE FROM expansions WHERE id = ?', [id]);
        return { deleted: true };
    },

    /** Pipeline grouped by stage, each stage carrying its value + weighted total. */
    async pipeline(user) {
        const all = await this.list(user);
        const cols = {};
        for (const s of EXPANSION_STAGES) cols[s] = { items: [], value: 0, weighted: 0 };
        for (const e of all) {
            const c = cols[e.stage] || (cols[e.stage] = { items: [], value: 0, weighted: 0 });
            c.items.push(e); c.value += e.valueInr; c.weighted += e.weightedInr;
        }
        return cols;
    },

    async stats(user) {
        const all = await this.list(user);
        const open = all.filter((e) => OPEN_STAGES.includes(e.stage));
        const won = all.filter((e) => e.stage === 'Won');
        const lost = all.filter((e) => e.stage === 'Lost');
        const closed = won.length + lost.length;
        const bump = (m, k, v = 1) => { m[k] = (m[k] || 0) + v; return m; };
        return {
            opportunities: all.length,
            open: open.length,
            openValueInr: open.reduce((s, e) => s + e.valueInr, 0),
            weightedForecastInr: open.reduce((s, e) => s + e.weightedInr, 0),
            wonInr: won.reduce((s, e) => s + e.valueInr, 0),
            won: won.length,
            winRate: closed ? Math.round((won.length / closed) * 100) : null,
            byStage: all.reduce((m, e) => bump(m, e.stage), {}),
            byType: all.reduce((m, e) => bump(m, e.type), {}),
            valueByStage: EXPANSION_STAGES.map((s) => ({ stage: s, value: all.filter((e) => e.stage === s).reduce((x, e) => x + e.valueInr, 0) })),
            topDeals: [...open].sort((a, b) => b.weightedInr - a.weightedInr).slice(0, 5).map((e) => ({ id: e.id, title: e.title, account: e.account, valueInr: e.valueInr, weightedInr: e.weightedInr, stage: e.stage, probability: e.probability }))
        };
    },

    async seedSample(user) {
        const customers = (await accountRepo.list(user)).filter((a) => a.segment === 'Customer');
        if (!customers.length) return { seeded: 0 };
        const plan = [
            { title: 'Vendor Pulse add-on', type: 'Cross-sell', value: 1800000, stage: 'Proposed' },
            { title: '25 additional seats', type: 'Seat expansion', value: 900000, stage: 'Negotiation' },
            { title: 'Enterprise tier upgrade', type: 'Tier upgrade', value: 3200000, stage: 'Qualified' },
            { title: 'Conformity module', type: 'Add-on module', value: 1500000, stage: 'Identified' },
            { title: 'Renewal uplift', type: 'Upsell', value: 1200000, stage: 'Won' },
            { title: 'Interno integration pack', type: 'Add-on module', value: 2100000, stage: 'Negotiation' },
            { title: 'Premium support tier', type: 'Tier upgrade', value: 800000, stage: 'Proposed' },
            { title: '50 seat expansion', type: 'Seat expansion', value: 1750000, stage: 'Qualified' },
            { title: 'AgentCtl cross-sell', type: 'Cross-sell', value: 2600000, stage: 'Identified' },
            { title: 'Multi-year renewal + uplift', type: 'Upsell', value: 4200000, stage: 'Won' },
            { title: 'Zak Services bundle', type: 'Cross-sell', value: 1400000, stage: 'Proposed' },
            { title: 'Certifications module', type: 'Add-on module', value: 950000, stage: 'Qualified' },
            { title: 'Dept-wide rollout', type: 'Seat expansion', value: 3800000, stage: 'Negotiation' },
            { title: 'Analytics add-on', type: 'Cross-sell', value: 700000, stage: 'Lost' },
            { title: 'Global tier upgrade', type: 'Tier upgrade', value: 5100000, stage: 'Identified' }
        ];
        let seeded = 0;
        for (let i = 0; i < plan.length; i++) {
            const p = plan[i];
            const r = await this.create({ account: customers[i % customers.length].name, title: p.title, type: p.type, value_amount: p.value, currency: 'INR', stage: p.stage, product: p.title }, user);
            if (r.expansion) seeded += 1;
        }
        return { seeded };
    }
};
