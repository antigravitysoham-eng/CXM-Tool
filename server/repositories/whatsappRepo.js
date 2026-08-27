import crypto from 'crypto';
import { getDb } from '../db.js';
import { parseModuleAccess } from '../services/policyService.js';

/**
 * WhatsApp identity binding.
 *
 * A phone number is bound to exactly one CX user through a short-lived code the
 * user generates while signed in and then texts from their phone. Once bound,
 * the number resolves to that user's live claims — the same trick agent keys
 * use — so every answer the bot gives stays inside the user's ABAC scope. The
 * number never carries authority of its own; unlink it (or the user) and it goes
 * dark.
 */

// Digits only, no ambiguity: a 6-digit code is enough entropy for a 10-minute,
// single-use, rate-limited window and is trivial to type into WhatsApp.
const CODE_TTL_MS = 10 * 60 * 1000;
const genCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

// Normalise to E.164 digits (Meta sends "9198…"; users may type "+91 98…").
export const normalizePhone = (raw) => String(raw || '').replace(/[^\d]/g, '');

const claimsFromUser = (u) => u && ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role || 'rep',
    region: u.region || '',
    business_unit: u.business_unit || '',
    team: u.team || '',
    // Read fresh on every inbound message, so an admin's access change takes
    // effect on the user's very next WhatsApp question.
    module_access: parseModuleAccess(u.module_access)
});

export const whatsappRepo = {
    /**
     * Mint a fresh link code for a user, retiring any earlier unused code they
     * hold so only the newest works. Returns { code, expiresAt }.
     */
    async createLinkCode(userId) {
        const db = await getDb();
        await db.run('DELETE FROM whatsapp_link_codes WHERE user_id = ?', [userId]);
        const now = new Date();
        const expiresAt = new Date(now.getTime() + CODE_TTL_MS).toISOString();
        // Retry on the astronomically unlikely PK collision.
        for (let i = 0; i < 5; i++) {
            const code = genCode();
            try {
                await db.run(
                    'INSERT INTO whatsapp_link_codes (code, user_id, expires_at, created_at) VALUES (?,?,?,?)',
                    [code, userId, expiresAt, now.toISOString()]
                );
                return { code, expiresAt };
            } catch (e) {
                if (!/UNIQUE/i.test(e.message)) throw e;
            }
        }
        throw new Error('Could not allocate a link code');
    },

    /**
     * Look up (without consuming) the account a code belongs to, plus the number
     * the admin registered for that account. The caller checks the texting number
     * against registered_phone before binding — so a code alone, texted from a
     * random number, never activates. Expired codes are cleaned up and read null.
     */
    async userForCode(rawCode) {
        const db = await getDb();
        const code = String(rawCode || '').replace(/[^\d]/g, '');
        if (code.length !== 6) return null;
        const row = await db.get(
            `SELECT c.user_id, c.expires_at, u.phone AS registered_phone, u.name
               FROM whatsapp_link_codes c JOIN users u ON u.id = c.user_id
              WHERE c.code = ?`,
            [code]
        );
        if (!row) return null;
        if (new Date(row.expires_at).getTime() < Date.now()) { await this.deleteLinkCode(code); return null; }
        return { user_id: row.user_id, registered_phone: normalizePhone(row.registered_phone), name: row.name };
    },

    /** Burn a code once it has done its job (single-use). */
    async deleteLinkCode(rawCode) {
        const db = await getDb();
        await db.run('DELETE FROM whatsapp_link_codes WHERE code = ?', [String(rawCode || '').replace(/[^\d]/g, '')]);
    },

    /** Bind (or rebind) a phone to a user, marking it verified now. */
    async bind(phone, userId) {
        const db = await getDb();
        const now = new Date().toISOString();
        await db.run(
            `INSERT INTO whatsapp_identities (phone, user_id, verified_at, created_at, last_seen_at)
             VALUES (?,?,?,?,?)
             ON CONFLICT(phone) DO UPDATE SET user_id = excluded.user_id, verified_at = excluded.verified_at`,
            [normalizePhone(phone), userId, now, now, now]
        );
        return this.resolve(phone);
    },

    /**
     * Resolve an inbound number to its user's claims (or null if unlinked). Also
     * stamps last_seen so the link screen can show recent activity.
     */
    async resolve(phone) {
        const db = await getDb();
        const p = normalizePhone(phone);
        const ident = await db.get('SELECT * FROM whatsapp_identities WHERE phone = ?', [p]);
        if (!ident) return null;
        const user = await db.get('SELECT * FROM users WHERE id = ?', [ident.user_id]);
        if (!user) return null; // user deleted — treat as unlinked
        await db.run('UPDATE whatsapp_identities SET last_seen_at = ? WHERE phone = ?', [new Date().toISOString(), p]);
        return { phone: p, verified_at: ident.verified_at, user: claimsFromUser(user) };
    },

    /** Numbers linked to a given user (for the in-app link screen). */
    async listForUser(userId) {
        const db = await getDb();
        const rows = await db.all(
            'SELECT phone, verified_at, last_seen_at FROM whatsapp_identities WHERE user_id = ? ORDER BY verified_at DESC',
            [userId]
        );
        return rows;
    },

    /** Every verified binding with its user — admin oversight of who's linked. */
    async listAll() {
        const db = await getDb();
        return db.all(
            `SELECT w.phone, w.verified_at, w.last_seen_at, u.id AS user_id, u.name, u.email, u.role
               FROM whatsapp_identities w JOIN users u ON u.id = w.user_id
              ORDER BY w.verified_at DESC`
        );
    },

    /** Unlink a number — scoped to its owner so a user can only drop their own. */
    async unlink(phone, userId) {
        const db = await getDb();
        const r = await db.run(
            'DELETE FROM whatsapp_identities WHERE phone = ? AND user_id = ?',
            [normalizePhone(phone), userId]
        );
        return r.changes > 0;
    }
};
