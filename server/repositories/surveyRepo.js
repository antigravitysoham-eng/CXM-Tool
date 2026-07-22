import { getDb } from '../db.js';
import { accountRepo } from './accountRepo.js';
import { sentimentFor, scoreSummary, npsBand, SCORE_RANGE } from '../data/surveyKit.js';

/**
 * Echo — voice-of-customer surveys.
 *
 * A campaign is sent to a customer; responses carry a score + comment. The NPS /
 * CSAT / CES headline, the sentiment split and the "detractors to follow up" are
 * all DERIVED from the response scores — only campaigns and responses are stored.
 */

const now = () => new Date().toISOString();

async function accessibleNames(user) {
    if (!user) throw new Error('surveyRepo: a user is required — pass req.user');
    return new Set((await accountRepo.list(user)).map((a) => a.name));
}

function decorateCampaign(c, responses) {
    const mine = responses.filter((r) => r.campaign_id === c.id);
    const withType = mine.map((r) => ({ ...r, type: c.type }));
    const summ = scoreSummary(withType);
    const headline = c.type === 'NPS' ? summ.npsScore : c.type === 'CSAT' ? summ.csatPct : summ.cesAvg;
    const sentiments = mine.reduce((m, r) => { m[r.sentiment] = (m[r.sentiment] || 0) + 1; return m; }, {});
    return {
        ...c,
        responseCount: mine.length,
        responseRate: c.sent_count ? Math.round((mine.length / c.sent_count) * 100) : null,
        headline,
        headlineLabel: c.type === 'CES' ? 'avg effort' : c.type === 'CSAT' ? '% satisfied' : 'NPS',
        detractors: mine.filter((r) => r.sentiment === 'Negative').length,
        sentiments
    };
}

export const surveyRepo = {
    async listCampaigns(user, { account, status, product_key } = {}) {
        const db = await getDb();
        const names = await accessibleNames(user);
        const where = []; const params = [];
        if (account) { where.push('account = ?'); params.push(account); }
        if (status) { where.push('status = ?'); params.push(status); }
        if (product_key) { where.push('product_key = ?'); params.push(product_key); }
        const campaigns = await db.all(`SELECT * FROM survey_campaigns ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC`, params);
        const responses = await db.all('SELECT * FROM survey_responses');
        return campaigns.filter((c) => names.has(c.account)).map((c) => decorateCampaign(c, responses));
    },

    async getCampaign(id, user) {
        const db = await getDb();
        const c = await db.get('SELECT * FROM survey_campaigns WHERE id = ?', [id]);
        if (!c) return null;
        const names = await accessibleNames(user);
        if (!names.has(c.account)) return null;
        const responses = await db.all('SELECT * FROM survey_responses WHERE campaign_id = ? ORDER BY id DESC', [id]);
        const dec = decorateCampaign(c, responses);
        return { ...dec, responses: responses.map((r) => ({ ...r, band: c.type === 'NPS' ? npsBand(r.score) : null })) };
    },

    async createCampaign(data, user) {
        const db = await getDb();
        const names = await accessibleNames(user);
        if (!names.has(data.account)) return { forbidden: true };
        const ts = now();
        const r = await db.run(
            `INSERT INTO survey_campaigns (account, title, type, product_key, status, question, sent_count, created_by, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [data.account, data.title, data.type || 'NPS', data.product_key || '', data.status || 'Draft', data.question || '', 0, user.name || '', ts, ts]
        );
        return { campaign: await this.getCampaign(r.lastID, user) };
    },

    async updateCampaign(id, data, user) {
        const db = await getDb();
        const c = await db.get('SELECT * FROM survey_campaigns WHERE id = ?', [id]);
        if (!c) return { notFound: true };
        const names = await accessibleNames(user);
        if (!names.has(c.account)) return { forbidden: true };
        const sets = []; const params = [];
        for (const f of ['title', 'type', 'product_key', 'question', 'status']) if (data[f] !== undefined) { sets.push(`${f} = ?`); params.push(data[f]); }
        // Moving to Live stamps a sent time + a nominal audience size if none yet.
        if (data.status === 'Live' && !c.sent_at) { sets.push('sent_at = ?'); params.push(now()); }
        sets.push('updated_at = ?'); params.push(now());
        await db.run(`UPDATE survey_campaigns SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
        return { campaign: await this.getCampaign(id, user) };
    },

    /** Mark a campaign Live and record how many recipients it went to. */
    async send(id, sentCount, user) {
        const db = await getDb();
        const c = await db.get('SELECT * FROM survey_campaigns WHERE id = ?', [id]);
        if (!c) return { notFound: true };
        const names = await accessibleNames(user);
        if (!names.has(c.account)) return { forbidden: true };
        const ts = now();
        await db.run("UPDATE survey_campaigns SET status = 'Live', sent_count = ?, sent_at = ?, updated_at = ? WHERE id = ?",
            [Math.max(1, Number(sentCount) || c.sent_count || 1), ts, ts, id]);
        return { campaign: await this.getCampaign(id, user) };
    },

    async removeCampaign(id, user) {
        const db = await getDb();
        const c = await db.get('SELECT * FROM survey_campaigns WHERE id = ?', [id]);
        if (!c) return { notFound: true };
        const names = await accessibleNames(user);
        if (!names.has(c.account)) return { forbidden: true };
        await db.run('DELETE FROM survey_responses WHERE campaign_id = ?', [id]);
        await db.run('DELETE FROM survey_campaigns WHERE id = ?', [id]);
        return { deleted: true };
    },

    async addResponse(campaignId, data, user) {
        const db = await getDb();
        const c = await db.get('SELECT * FROM survey_campaigns WHERE id = ?', [campaignId]);
        if (!c) return { notFound: true };
        const names = await accessibleNames(user);
        if (!names.has(c.account)) return { forbidden: true };
        const [lo, hi] = SCORE_RANGE[c.type] || [0, 10];
        const score = Math.max(lo, Math.min(hi, Number(data.score)));
        const sentiment = sentimentFor(c.type, score);
        await db.run(
            `INSERT INTO survey_responses (campaign_id, account, respondent, score, comment, sentiment, created_at)
             VALUES (?,?,?,?,?,?,?)`,
            [campaignId, c.account, data.respondent || '', score, data.comment || '', sentiment, now()]
        );
        // A response implies at least one recipient; keep sent_count sane.
        await db.run('UPDATE survey_campaigns SET sent_count = MAX(sent_count, (SELECT COUNT(*) FROM survey_responses WHERE campaign_id = ?)) WHERE id = ?', [campaignId, campaignId]);
        return { campaign: await this.getCampaign(campaignId, user) };
    },

    async removeResponse(id, user) {
        const db = await getDb();
        const r = await db.get('SELECT * FROM survey_responses WHERE id = ?', [id]);
        if (!r) return { notFound: true };
        const names = await accessibleNames(user);
        if (!names.has(r.account)) return { forbidden: true };
        await db.run('DELETE FROM survey_responses WHERE id = ?', [id]);
        return { campaign: await this.getCampaign(r.campaign_id, user) };
    },

    /** Portfolio rollup for the module header. */
    async stats(user) {
        const campaigns = await this.listCampaigns(user);
        const db = await getDb();
        const names = await accessibleNames(user);
        const allResp = (await db.all('SELECT * FROM survey_responses')).filter((r) => names.has(r.account));
        // attach type to each response for the cross-instrument headline
        const typeByCampaign = Object.fromEntries(campaigns.map((c) => [c.id, c.type]));
        const typed = allResp.map((r) => ({ ...r, type: typeByCampaign[r.campaign_id] || 'NPS' }));
        const summ = scoreSummary(typed);
        const sentiments = typed.reduce((m, r) => { m[r.sentiment] = (m[r.sentiment] || 0) + 1; return m; }, { Positive: 0, Neutral: 0, Negative: 0 });
        const sent = campaigns.reduce((s, c) => s + (c.sent_count || 0), 0);
        return {
            campaigns: campaigns.length,
            live: campaigns.filter((c) => c.status === 'Live').length,
            responses: typed.length,
            responseRate: sent ? Math.round((typed.length / sent) * 100) : null,
            nps: summ.npsScore, csat: summ.csatPct, ces: summ.cesAvg,
            detractors: typed.filter((r) => r.sentiment === 'Negative').length,
            sentiments,
            byType: campaigns.reduce((m, c) => { m[c.type] = (m[c.type] || 0) + 1; return m; }, {}),
            // Product-wise sentiment: average headline per targeted module.
            byProduct: (() => {
                const m = {};
                for (const c of campaigns) {
                    if (!c.product_key || c.headline === null) continue;
                    const p = m[c.product_key] || (m[c.product_key] = { campaigns: 0, total: 0 });
                    p.campaigns += 1; p.total += c.headline;
                }
                return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { campaigns: v.campaigns, avgScore: Math.round(v.total / v.campaigns) }]));
            })()
        };
    },

    /** Detractor comments to follow up — the negative responses with something said. */
    async detractors(user) {
        const db = await getDb();
        const names = await accessibleNames(user);
        const rows = (await db.all("SELECT * FROM survey_responses WHERE sentiment = 'Negative' ORDER BY id DESC"))
            .filter((r) => names.has(r.account));
        return rows.slice(0, 50);
    },

    /** Seed a couple of NPS/CSAT campaigns with responses across the caller's customers. */
    async seedSample(user) {
        const customers = (await accountRepo.list(user)).filter((a) => a.segment === 'Customer');
        if (!customers.length) return { seeded: 0 };
        let seeded = 0;
        const plans = [
            { type: 'NPS', title: 'Quarterly NPS pulse', scores: [10, 9, 8, 6, 9], comments: ['Love the platform', 'Great support', 'Solid', 'Onboarding was slow', 'Recommending internally'] },
            { type: 'CSAT', title: 'Support satisfaction', scores: [5, 4, 4, 2, 5], comments: ['Fast fix', 'Happy', 'Good', 'Ticket took too long', 'Excellent'] }
        ];
        for (let i = 0; i < customers.length; i++) {
            const p = plans[i % plans.length];
            const c = await this.createCampaign({ account: customers[i].name, title: p.title, type: p.type, status: 'Draft' }, user);
            if (!c.campaign) continue;
            await this.send(c.campaign.id, p.scores.length + 2, user);
            for (let j = 0; j < p.scores.length; j++) {
                await this.addResponse(c.campaign.id, { respondent: `User ${j + 1}`, score: p.scores[j], comment: p.comments[j] }, user);
            }
            seeded += 1;
        }
        return { seeded };
    }
};
