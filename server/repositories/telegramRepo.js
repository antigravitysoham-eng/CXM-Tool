import { getDb } from '../db.js';
import { parseModuleAccess } from '../services/policyService.js';

/**
 * Telegram identity binding — the mirror of whatsappRepo.
 *
 * A Telegram user id is bound to exactly one CX user through the same short-lived
 * code the user generates while signed in (whatsapp_link_codes — the code is
 * channel-agnostic; only the delivery differs). Once bound, the Telegram id
 * resolves to that user's live claims, so every answer stays inside their ABAC
 * scope. Unlike WhatsApp there is no admin-registered handle to match against, so
 * a valid, unexpired, single-use code is what authorises the bind.
 */

const claimsFromUser = (u) => u && ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role || 'rep',
    region: u.region || '',
    business_unit: u.business_unit || '',
    team: u.team || '',
    // Read fresh on every inbound message, so an admin's access change takes
    // effect on the user's very next Telegram question.
    module_access: parseModuleAccess(u.module_access)
});

const asId = (v) => String(v || '').trim();

export const telegramRepo = {
    /**
     * Look up (without consuming) the account a link code belongs to. Reuses the
     * WhatsApp link-code table — a code identifies a user regardless of channel.
     * Expired codes are cleaned up and read as null.
     */
    async userForCode(rawCode) {
        const db = await getDb();
        const code = String(rawCode || '').replace(/[^\d]/g, '');
        if (code.length !== 6) return null;
        const row = await db.get(
            `SELECT c.user_id, c.expires_at, u.name
               FROM whatsapp_link_codes c JOIN users u ON u.id = c.user_id
              WHERE c.code = ?`,
            [code]
        );
        if (!row) return null;
        if (new Date(row.expires_at).getTime() < Date.now()) {
            await db.run('DELETE FROM whatsapp_link_codes WHERE code = ?', [code]);
            return null;
        }
        return { user_id: row.user_id, name: row.name };
    },

    /** Burn a code once it has bound an identity (single-use). */
    async deleteLinkCode(rawCode) {
        const db = await getDb();
        await db.run('DELETE FROM whatsapp_link_codes WHERE code = ?', [String(rawCode || '').replace(/[^\d]/g, '')]);
    },

    /** Bind (or rebind) a Telegram id to a user, marking it verified now. */
    async bind(telegramId, userId, { chatId, username, firstName } = {}) {
        const db = await getDb();
        const now = new Date().toISOString();
        const id = asId(telegramId);
        await db.run(
            `INSERT INTO telegram_identities (telegram_id, chat_id, username, first_name, user_id, verified_at, created_at, last_seen_at)
             VALUES (?,?,?,?,?,?,?,?)
             ON CONFLICT(telegram_id) DO UPDATE SET
                user_id = excluded.user_id, chat_id = excluded.chat_id,
                username = excluded.username, first_name = excluded.first_name,
                verified_at = excluded.verified_at`,
            [id, asId(chatId) || id, username || '', firstName || '', userId, now, now, now]
        );
        return this.resolve(id);
    },

    /** Resolve an inbound Telegram id to its user's claims (or null if unlinked). */
    async resolve(telegramId) {
        const db = await getDb();
        const id = asId(telegramId);
        const ident = await db.get('SELECT * FROM telegram_identities WHERE telegram_id = ?', [id]);
        if (!ident) return null;
        const user = await db.get('SELECT * FROM users WHERE id = ?', [ident.user_id]);
        if (!user) return null; // user deleted — treat as unlinked
        await db.run('UPDATE telegram_identities SET last_seen_at = ? WHERE telegram_id = ?', [new Date().toISOString(), id]);
        return { telegram_id: id, chat_id: ident.chat_id, verified_at: ident.verified_at, user: claimsFromUser(user) };
    },

    /** Telegram bindings for a given user (for the in-app link screen). */
    async listForUser(userId) {
        const db = await getDb();
        return db.all(
            'SELECT telegram_id, username, first_name, verified_at, last_seen_at FROM telegram_identities WHERE user_id = ? ORDER BY verified_at DESC',
            [userId]
        );
    },

    /** Every verified binding with its user — admin oversight of who's linked. */
    async listAll() {
        const db = await getDb();
        return db.all(
            `SELECT t.telegram_id, t.username, t.first_name, t.verified_at, t.last_seen_at,
                    u.id AS user_id, u.name, u.email, u.role
               FROM telegram_identities t JOIN users u ON u.id = t.user_id
              ORDER BY t.verified_at DESC`
        );
    },

    /** Unlink a Telegram id — scoped to its owner so a user can only drop their own. */
    async unlink(telegramId, userId) {
        const db = await getDb();
        const r = await db.run(
            'DELETE FROM telegram_identities WHERE telegram_id = ? AND user_id = ?',
            [asId(telegramId), userId]
        );
        return r.changes > 0;
    }
};
