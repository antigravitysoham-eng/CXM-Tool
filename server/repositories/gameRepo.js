import { getDb } from '../db.js';

// XP awarded per event type. mission_complete uses the mission's own points.
const XP_RULES = {
    agent_query: 3,
    mission_complete: 20,
    account_created: 10,
    account_updated: 5,
    data_imported: 20,
    deal_qualified: 15,
    instruction_saved: 5,
    custom_column_added: 8
};

const XP_PER_LEVEL = 100;
export const levelForXp = (xp) => Math.floor((xp || 0) / XP_PER_LEVEL) + 1;

// Unlockable badges. `check` gets { type, agentKey, level, streak, unlocked }.
export const ACHIEVEMENTS = [
    { key: 'first_contact', label: 'First Contact', emoji: '👋', desc: 'Talked to an agent', check: (c) => c.type === 'agent_query' },
    { key: 'neo_ally', label: 'Ally of NEO', emoji: '🧠', desc: 'Briefed by NEO', check: (c) => c.type === 'agent_query' && c.agentKey === 'neo' },
    { key: 'dealmaker', label: 'Dealmaker', emoji: '🤝', desc: 'Created an account', check: (c) => c.type === 'account_created' },
    { key: 'bulk_boss', label: 'Bulk Boss', emoji: '📦', desc: 'Imported data in bulk', check: (c) => c.type === 'data_imported' },
    { key: 'qualifier', label: 'Qualifier', emoji: '✅', desc: 'Qualified a deal to 5+/7', check: (c) => c.type === 'deal_qualified' },
    { key: 'architect', label: 'Architect', emoji: '🏗️', desc: 'Added a custom column', check: (c) => c.type === 'custom_column_added' },
    { key: 'mission_1', label: 'Operative', emoji: '🎖️', desc: 'Completed a mission', check: (c) => c.type === 'mission_complete' },
    { key: 'streak_3', label: 'On a Roll', emoji: '🔥', desc: '3-day streak', check: (c) => c.streak >= 3 },
    { key: 'level_5', label: 'Commander', emoji: '⭐', desc: 'Reached level 5', check: (c) => c.level >= 5 }
];
const ACH_BY_KEY = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.key, a]));

function yesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
}
const today = () => new Date().toISOString().slice(0, 10);

async function ensureState(db, userId) {
    let s = await db.get('SELECT * FROM game_state WHERE user_id = ?', [userId]);
    if (!s) {
        // last_active null so the very first award counts as a fresh streak of 1.
        await db.run('INSERT INTO game_state (user_id, xp, streak, last_active, updated_at) VALUES (?, 0, 0, NULL, ?)', [userId, new Date().toISOString()]);
        s = await db.get('SELECT * FROM game_state WHERE user_id = ?', [userId]);
    }
    return s;
}

export const gameRepo = {
    async getState(userId) {
        const db = await getDb();
        const s = await ensureState(db, userId);
        const agentRows = await db.all('SELECT agent_key, xp, interactions FROM agent_xp WHERE user_id = ?', [userId]);
        const achRows = await db.all('SELECT key, unlocked_at FROM achievements WHERE user_id = ? ORDER BY unlocked_at', [userId]);
        const agents = {};
        agentRows.forEach((r) => { agents[r.agent_key] = { xp: r.xp, level: levelForXp(r.xp), interactions: r.interactions }; });
        const achievements = achRows.map((r) => ({ ...ACH_BY_KEY[r.key], unlocked_at: r.unlocked_at })).filter((a) => a.key);
        const level = levelForXp(s.xp);
        const commandScore = s.xp + s.streak * 20 + achievements.length * 50;
        return {
            xp: s.xp,
            level,
            xpIntoLevel: s.xp % XP_PER_LEVEL,
            xpPerLevel: XP_PER_LEVEL,
            streak: s.streak,
            commandScore,
            agents,
            achievements,
            allAchievements: ACHIEVEMENTS.map((a) => ({ key: a.key, label: a.label, emoji: a.emoji, desc: a.desc }))
        };
    },

    async award(userId, { type, agentKey = null, points = null }) {
        const db = await getDb();
        const s = await ensureState(db, userId);

        // Streak
        let streak = s.streak;
        if (s.last_active === today()) { /* same day */ } else if (s.last_active === yesterday()) streak += 1; else streak = 1;

        const awarded = points != null ? points : (XP_RULES[type] || 0);
        const newXp = s.xp + awarded;
        const leveledUp = levelForXp(newXp) > levelForXp(s.xp);

        await db.run('UPDATE game_state SET xp = ?, streak = ?, last_active = ?, updated_at = ? WHERE user_id = ?',
            [newXp, streak, today(), new Date().toISOString(), userId]);

        // Per-agent XP
        if (agentKey) {
            await db.run(
                `INSERT INTO agent_xp (user_id, agent_key, xp, interactions) VALUES (?, ?, ?, 1)
                 ON CONFLICT(user_id, agent_key) DO UPDATE SET xp = xp + ?, interactions = interactions + 1`,
                [userId, agentKey, awarded, awarded]
            );
        }

        // Achievements
        const already = new Set((await db.all('SELECT key FROM achievements WHERE user_id = ?', [userId])).map((r) => r.key));
        const ctx = { type, agentKey, level: levelForXp(newXp), streak, unlocked: already };
        const newAchievements = [];
        for (const a of ACHIEVEMENTS) {
            if (!already.has(a.key) && a.check(ctx)) {
                await db.run('INSERT OR IGNORE INTO achievements (user_id, key, unlocked_at) VALUES (?, ?, ?)', [userId, a.key, new Date().toISOString()]);
                newAchievements.push({ key: a.key, label: a.label, emoji: a.emoji, desc: a.desc });
            }
        }

        const state = await this.getState(userId);
        return { state, awarded, leveledUp, newAchievements };
    },

    async addInstruction(userId, agentKey, text) {
        const db = await getDb();
        await db.run('INSERT INTO agent_instructions (user_id, agent_key, text, created_at) VALUES (?, ?, ?, ?)',
            [userId, agentKey, text, new Date().toISOString()]);
        return this.listInstructions(userId, agentKey);
    },

    async listInstructions(userId, agentKey) {
        const db = await getDb();
        return db.all('SELECT id, text, created_at FROM agent_instructions WHERE user_id = ? AND agent_key = ? ORDER BY id DESC', [userId, agentKey]);
    }
};
