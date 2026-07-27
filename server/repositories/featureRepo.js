import { getDb } from '../db.js';
import { accountRepo } from './accountRepo.js';
import { riceScore, OPEN_STATUSES, FEATURE_STATUSES } from '../data/featureKit.js';
import { openTrail, stampChange, daysInStage, history } from './stageEvents.js';

/**
 * Forge — the feature-request pipeline.
 *
 * Scoped by the raising customer (`account`) like every account resource. Other
 * customers can back a request (feature_supporters); demand and the RICE score
 * are derived, so the roadmap ranks by real customer pull, not who shouted last.
 */

const now = () => new Date().toISOString();

async function accessibleNames(user) {
    if (!user) throw new Error('featureRepo: a user is required — pass req.user');
    return new Set((await accountRepo.list(user)).map((a) => a.name));
}

// Sequential, human-friendly reference (FR-0007) derived from the row id — unique
// and incremental by construction. Shown on the board and used to look a request up
// over WhatsApp.
export const featureRef = (id) => `FR-${String(id).padStart(4, '0')}`;

function decorate(f, supportersByFeature) {
    const supporters = supportersByFeature[f.id] || [];
    return {
        ...f,
        ref: featureRef(f.id),
        supporters: supporters.map((s) => s.account),
        supporterCount: supporters.length,
        demand: supporters.length + (f.votes || 0) + 1,
        rice: riceScore({ supporters: supporters.length, votes: f.votes || 0, impact: f.impact, effort: f.effort }),
        stage_entered_at: f.stage_entered_at || f.created_at || null,
        days_in_stage: daysInStage(f)
    };
}

export const featureRepo = {
    async list(user, { account, status, product_area } = {}) {
        const db = await getDb();
        const names = await accessibleNames(user);
        const where = []; const params = [];
        if (account) { where.push('account = ?'); params.push(account); }
        if (status) { where.push('status = ?'); params.push(status); }
        if (product_area) { where.push('product_area = ?'); params.push(product_area); }
        const rows = await db.all(`SELECT * FROM feature_reqs ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC`, params);
        const supporters = await db.all('SELECT * FROM feature_supporters');
        const byFeature = {};
        for (const s of supporters) (byFeature[s.feature_id] ||= []).push(s);
        return rows.filter((f) => names.has(f.account)).map((f) => decorate(f, byFeature)).sort((a, b) => b.rice - a.rice);
    },

    async get(id, user) {
        const db = await getDb();
        const f = await db.get('SELECT * FROM feature_reqs WHERE id = ?', [id]);
        if (!f) return null;
        const names = await accessibleNames(user);
        if (!names.has(f.account)) return null;
        const supporters = await db.all('SELECT * FROM feature_supporters WHERE feature_id = ?', [id]);
        return decorate(f, { [id]: supporters });
    },

    // Look a request up by its reference (FR-0007 / #7 / 7). Used by NEO so a feature
    // request can be pulled over WhatsApp by the id shown on the board.
    async getByRef(ref, user) {
        const digits = String(ref || '').replace(/[^0-9]/g, '');
        if (!digits) return null;
        return this.get(Number(digits), user);
    },

    async create(data, user) {
        const db = await getDb();
        const names = await accessibleNames(user);
        if (!names.has(data.account)) return { forbidden: true };
        const ts = now();
        const r = await db.run(
            `INSERT INTO feature_reqs (account, title, description, status, impact, effort, product_area, votes, requested_by, stage_entered_at, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            [data.account, data.title, data.description || '', data.status || 'Requested', data.impact || 'Medium',
                data.effort || 'M', data.product_area || '', 0, data.requested_by || '', ts, ts, ts]
        );
        await openTrail(db, 'feature', r.lastID, data.status || 'Requested', user);
        return { feature: await this.get(r.lastID, user) };
    },

    async update(id, data, user) {
        const db = await getDb();
        const f = await db.get('SELECT * FROM feature_reqs WHERE id = ?', [id]);
        if (!f) return { notFound: true };
        const names = await accessibleNames(user);
        if (!names.has(f.account)) return { forbidden: true };
        const statusChanged = data.status !== undefined && data.status !== f.status;
        const sets = []; const params = [];
        for (const k of ['title', 'description', 'status', 'impact', 'effort', 'product_area']) {
            if (data[k] !== undefined) { sets.push(`${k} = ?`); params.push(data[k]); }
        }
        sets.push('updated_at = ?'); params.push(now());
        // A real status move resets the stage clock; a no-op re-save doesn't.
        if (statusChanged) { sets.push('stage_entered_at = ?'); params.push(now()); }
        await db.run(`UPDATE feature_reqs SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
        if (statusChanged) await stampChange(db, 'feature', id, f.status, data.status, user);
        return { feature: await this.get(id, user) };
    },

    async remove(id, user) {
        const db = await getDb();
        const f = await db.get('SELECT * FROM feature_reqs WHERE id = ?', [id]);
        if (!f) return { notFound: true };
        const names = await accessibleNames(user);
        if (!names.has(f.account)) return { forbidden: true };
        await db.run('DELETE FROM feature_supporters WHERE feature_id = ?', [id]);
        await db.run('DELETE FROM feature_reqs WHERE id = ?', [id]);
        return { deleted: true };
    },

    // The stage-transition trail for one request (ABAC-checked via get).
    async stageHistory(id, user) {
        if (!(await this.get(id, user))) return null;
        return history(await getDb(), 'feature', id);
    },

    async vote(id, user) {
        const db = await getDb();
        const f = await db.get('SELECT * FROM feature_reqs WHERE id = ?', [id]);
        if (!f) return { notFound: true };
        const names = await accessibleNames(user);
        if (!names.has(f.account)) return { forbidden: true };
        await db.run('UPDATE feature_reqs SET votes = votes + 1, updated_at = ? WHERE id = ?', [now(), id]);
        return { feature: await this.get(id, user) };
    },

    async addSupporter(id, account, user) {
        const db = await getDb();
        const f = await db.get('SELECT * FROM feature_reqs WHERE id = ?', [id]);
        if (!f) return { notFound: true };
        const names = await accessibleNames(user);
        if (!names.has(f.account)) return { forbidden: true };
        if (!names.has(account)) return { forbidden: true };
        const exists = await db.get('SELECT id FROM feature_supporters WHERE feature_id = ? AND account = ?', [id, account]);
        if (!exists) await db.run('INSERT INTO feature_supporters (feature_id, account, created_at) VALUES (?,?,?)', [id, account, now()]);
        return { feature: await this.get(id, user) };
    },

    async removeSupporter(id, account, user) {
        const db = await getDb();
        const f = await db.get('SELECT * FROM feature_reqs WHERE id = ?', [id]);
        if (!f) return { notFound: true };
        const names = await accessibleNames(user);
        if (!names.has(f.account)) return { forbidden: true };
        await db.run('DELETE FROM feature_supporters WHERE feature_id = ? AND account = ?', [id, account]);
        return { feature: await this.get(id, user) };
    },

    /** The roadmap board: requests grouped by status, each column RICE-ranked. */
    async board(user) {
        const all = await this.list(user);
        const cols = {};
        for (const s of FEATURE_STATUSES) cols[s] = [];
        for (const f of all) (cols[f.status] ||= []).push(f);
        return cols;
    },

    async stats(user) {
        const all = await this.list(user);
        const open = all.filter((f) => OPEN_STATUSES.includes(f.status));
        const shipped = all.filter((f) => f.status === 'Shipped');
        const declined = all.filter((f) => f.status === 'Declined');
        const bump = (m, k) => { if (k) m[k] = (m[k] || 0) + 1; return m; };
        return {
            total: all.length,
            open: open.length,
            shipped: shipped.length,
            declined: declined.length,
            shippedRate: all.length ? Math.round((shipped.length / all.length) * 100) : 0,
            totalDemand: all.reduce((s, f) => s + f.demand, 0),
            byStatus: all.reduce((m, f) => bump(m, f.status), {}),
            byArea: all.reduce((m, f) => bump(m, f.product_area || 'Unassigned'), {}),
            byImpact: all.reduce((m, f) => bump(m, f.impact), {}),
            topDemand: [...all].sort((a, b) => b.demand - a.demand).slice(0, 5).map((f) => ({ id: f.id, title: f.title, account: f.account, demand: f.demand, status: f.status, rice: f.rice }))
        };
    },

    async seedSample(user) {
        const customers = (await accountRepo.list(user)).filter((a) => a.segment === 'Customer');
        if (!customers.length) return { seeded: 0 };
        const plan = [
            { title: 'SSO via Azure AD', status: 'Planned', impact: 'High', effort: 'M', area: 'Platform', backers: 4, votes: 12 },
            { title: 'Bulk vendor risk export', status: 'Under review', impact: 'Medium', effort: 'S', area: 'Vendor Pulse', backers: 3, votes: 7 },
            { title: 'Custom EBR templates', status: 'Requested', impact: 'Medium', effort: 'L', area: 'Reporting', backers: 2, votes: 4 },
            { title: 'Webhook on contract renewal', status: 'In progress', impact: 'High', effort: 'M', area: 'Integrations', backers: 5, votes: 9 },
            { title: 'Dark-mode PDF reports', status: 'Shipped', impact: 'Low', effort: 'S', area: 'Reporting', backers: 1, votes: 3 },
            { title: 'SCIM user provisioning', status: 'Requested', impact: 'High', effort: 'L', area: 'Platform', backers: 4, votes: 11 },
            { title: 'Slack alerts for SLA breaches', status: 'Planned', impact: 'Medium', effort: 'S', area: 'Integrations', backers: 3, votes: 8 },
            { title: 'Framework mapping (ISO↔SOC2)', status: 'Under review', impact: 'Critical', effort: 'XL', area: 'Conformity', backers: 6, votes: 15 },
            { title: 'Mobile app for approvals', status: 'Requested', impact: 'Medium', effort: 'XL', area: 'Platform', backers: 2, votes: 5 },
            { title: 'Scheduled report emails', status: 'Shipped', impact: 'Medium', effort: 'M', area: 'Reporting', backers: 3, votes: 6 },
            { title: 'API rate-limit dashboard', status: 'In progress', impact: 'Low', effort: 'M', area: 'AgentCtl', backers: 1, votes: 2 },
            { title: 'Multi-currency invoicing', status: 'Planned', impact: 'High', effort: 'L', area: 'Platform', backers: 4, votes: 10 },
            { title: 'Bulk user import (CSV)', status: 'Declined', impact: 'Low', effort: 'S', area: 'Platform', backers: 1, votes: 1 },
            { title: 'Zak Services SLA tiers', status: 'Requested', impact: 'High', effort: 'M', area: 'Zak Services', backers: 3, votes: 8 }
        ];
        let seeded = 0;
        for (let i = 0; i < plan.length; i++) {
            const p = plan[i];
            const owner = customers[i % customers.length].name;
            const r = await this.create({ account: owner, title: p.title, status: p.status, impact: p.impact, effort: p.effort, product_area: p.area }, user);
            if (r.feature) {
                for (let j = 1; j <= Math.min(p.backers, customers.length - 1); j++) {
                    await this.addSupporter(r.feature.id, customers[(i + j) % customers.length].name, user);
                }
                for (let v = 0; v < (p.votes || 0); v++) await this.vote(r.feature.id, user);
                seeded += 1;
            }
        }
        return { seeded };
    }
};
