import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getDb } from '../db.js';

/**
 * Blob storage for the DMS.
 *
 * Everything above this file talks to `storage` and never touches a filesystem
 * or a bucket directly, so swapping where bytes live is a config change plus a
 * new driver in DRIVERS — no changes to the repository, routes, or UI.
 *
 * A driver implements:
 *   save(buffer, filename) -> { key, size }
 *   read(key)              -> Buffer
 *   remove(key)            -> void
 *
 * `key` is opaque to callers: only the driver that minted it may interpret it.
 *
 * Set STORAGE_DRIVER to pick one (default: local).
 */

const MAX_BYTES = 15 * 1024 * 1024; // keep in step with the express.json body limit

const newKey = (filename) => {
    // Keep the extension for content-type sniffing; drop the original name so a
    // hostile filename can never influence the path we write to.
    const ext = path.extname(filename || '').slice(0, 12).replace(/[^a-zA-Z0-9.]/g, '');
    return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
};

// ---- local filesystem driver -------------------------------------------------
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'storage');

const localDriver = {
    name: 'local',
    // Reaches the browser, so it names the store without leaking the server path.
    describe: () => 'local file store',
    location: () => ROOT,
    async save(buffer, filename) {
        await fs.mkdir(ROOT, { recursive: true });
        const key = newKey(filename);
        await fs.writeFile(path.join(ROOT, key), buffer);
        return { key, size: buffer.length };
    },
    async read(key) {
        // `key` is ours, but resolve and re-check anyway: a key that escapes ROOT
        // would turn a download into an arbitrary file read.
        const full = path.resolve(ROOT, key);
        if (path.dirname(full) !== path.resolve(ROOT)) throw new Error('Invalid storage key');
        return fs.readFile(full);
    },
    async remove(key) {
        await fs.rm(path.resolve(ROOT, key), { force: true });
    }
};

// ---- sqlite blob driver ------------------------------------------------------
// Bytes live in the DB itself, so the whole DMS travels with the .sqlite file.
const dbDriver = {
    name: 'db',
    describe: () => 'platform database',
    location: () => 'document_blobs table',
    async save(buffer, filename) {
        const db = await getDb();
        const key = newKey(filename);
        await db.run('INSERT INTO document_blobs (key, data) VALUES (?, ?)', [key, buffer]);
        return { key, size: buffer.length };
    },
    async read(key) {
        const db = await getDb();
        const row = await db.get('SELECT data FROM document_blobs WHERE key = ?', [key]);
        if (!row) throw new Error('Blob not found');
        return Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
    },
    async remove(key) {
        const db = await getDb();
        await db.run('DELETE FROM document_blobs WHERE key = ?', [key]);
    }
};

const DRIVERS = { local: localDriver, db: dbDriver };

const active = DRIVERS[process.env.STORAGE_DRIVER || 'local'] || localDriver;

export const storage = {
    driver: active.name,
    describe: active.describe,
    location: active.location,
    maxBytes: MAX_BYTES,

    /** Accepts a base64 payload (optionally a data: URL) and persists it. */
    async saveBase64(base64, filename) {
        const raw = String(base64 || '').replace(/^data:[^;]*;base64,/, '');
        if (!raw) throw Object.assign(new Error('File is empty'), { status: 400 });
        const buffer = Buffer.from(raw, 'base64');
        if (!buffer.length) throw Object.assign(new Error('File is empty'), { status: 400 });
        if (buffer.length > MAX_BYTES) {
            throw Object.assign(
                new Error(`File is ${(buffer.length / 1048576).toFixed(1)}MB — the limit is ${MAX_BYTES / 1048576}MB`),
                { status: 413 }
            );
        }
        return active.save(buffer, filename);
    },

    read: (key) => active.read(key),
    // Never let a missing blob block deleting its metadata row.
    remove: (key) => active.remove(key).catch(() => {})
};
