import { getDb } from '../db.js';
import { CONNECTOR_BY_KEY, CONNECTORS } from '../connectors/registry.js';
import { getCredentials } from './credentialService.js';

/**
 * The sync engine.
 *
 * Connectors supply `pull()` and nothing else. Everything that is easy to get
 * wrong per-connector — identity, provenance, not clobbering human edits, run
 * logging — happens once, here.
 *
 * Deliberately conservative: it will skip a record rather than guess. A wrong
 * customer created from a fuzzy name match is more expensive to unpick than a
 * record that simply didn't arrive.
 */

const now = () => new Date().toISOString();

/**
 * Drivers, keyed by connector. Each is `pull(credentials, since) -> [rows]`
 * in the connector's own field names; the engine maps them.
 *
 * Registered here as they are built. An unregistered connector reports
 * `configured: false` and syncs nothing — it never invents data to look busy.
 */
const DRIVERS = {
    // zoho_crm: pullZohoDeals,     <- server/connectors/drivers/zoho.js
    // leegality: pullLeegalityDocs <- server/connectors/drivers/leegality.js
};

/** Their row -> ours, using the connector's declared fieldMap. */
export function mapRow(def, raw) {
    const out = {};
    for (const [theirs, ours] of Object.entries(def.fieldMap)) {
        if (raw[theirs] !== undefined) out[ours] = raw[theirs];
    }
    return out;
}

/**
 * Merge an incoming record over an existing one.
 *
 * `localWins` fields are never overwritten by a sync: Zoho owns the commercials,
 * but a CSM's health rating and next step are ours, and a nightly job silently
 * reverting them would make the platform untrustworthy.
 */
export function mergeRecord(def, existing, incoming) {
    if (!existing) return { ...incoming, source_system: def.key, synced_at: now() };
    const merged = { ...existing };
    for (const [k, v] of Object.entries(incoming)) {
        if (def.localWins?.includes(k)) continue;
        if (v === undefined || v === null || v === '') continue; // absent ≠ cleared
        merged[k] = v;
    }
    merged.source_system = def.key;
    merged.synced_at = now();
    return merged;
}

export async function connectorStatus(key) {
    const def = CONNECTOR_BY_KEY[key];
    if (!def) return null;
    const creds = await getCredentials(key).catch(() => null);
    const configured = !!creds && def.credentialFields.every((f) => !!creds[f]);
    const db = await getDb();
    const last = await db.get(
        'SELECT * FROM connector_runs WHERE connector_key = ? ORDER BY id DESC LIMIT 1',
        [key]
    );
    const counts = await db.get(
        `SELECT COUNT(*) as n FROM ${def.target} WHERE source_system = ?`,
        [key]
    ).catch(() => ({ n: 0 }));

    return {
        key: def.key,
        name: def.name,
        blurb: def.blurb,
        module: def.module,
        color: def.color,
        direction: def.direction,
        credentialFields: def.credentialFields,
        fieldMap: def.fieldMap,
        localWins: def.localWins,
        configured,
        // Built = a driver exists. A configured connector with no driver is a
        // promise, and the UI should say so rather than imply a working feed.
        implemented: !!DRIVERS[def.key],
        recordsFromHere: counts?.n || 0,
        lastRun: last || null
    };
}

export async function allConnectorStatus() {
    return Promise.all(CONNECTORS.map((c) => connectorStatus(c.key)));
}

/**
 * Run one connector.
 *
 * Returns a run summary and always writes it to connector_runs — a feed that
 * quietly stopped is worse than one that visibly failed.
 */
export async function runSync(key, user, { since = null } = {}) {
    const def = CONNECTOR_BY_KEY[key];
    if (!def) throw Object.assign(new Error(`Unknown connector: ${key}`), { status: 404 });

    const db = await getDb();
    const startedAt = now();
    const run = { fetched: 0, created: 0, updated: 0, skipped: 0, quarantined: 0 };
    let status = 'success';
    let error = null;

    try {
        const driver = DRIVERS[def.key];
        if (!driver) {
            throw Object.assign(
                new Error(`${def.name} is defined but its driver isn’t built yet — nothing was synced.`),
                { status: 501 }
            );
        }
        const creds = await getCredentials(def.key);
        if (!creds || !def.credentialFields.every((f) => creds[f])) {
            throw Object.assign(new Error(`${def.name} is not configured. Add its credentials first.`), { status: 400 });
        }

        const rows = await driver(creds, since);
        run.fetched = rows.length;

        for (const raw of rows) {
            const incoming = mapRow(def, raw);
            if (!incoming.external_id) { run.skipped += 1; continue; }

            // Fuzzy account matching is parked, not guessed — see registry.matchOn.
            if (def.matchOn) {
                const hit = await db.get(
                    `SELECT id FROM customers WHERE name = ?`,
                    [incoming[def.matchOn.field]]
                );
                if (!hit) { run.quarantined += 1; continue; }
            }

            const existing = await db.get(
                `SELECT * FROM ${def.target} WHERE source_system = ? AND external_id = ?`,
                [def.key, incoming.external_id]
            );
            const merged = mergeRecord(def, existing, incoming);
            if (existing) {
                const sets = Object.keys(merged).filter((k) => k !== 'id');
                await db.run(
                    `UPDATE ${def.target} SET ${sets.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`,
                    [...sets.map((k) => merged[k]), existing.id]
                );
                run.updated += 1;
            } else {
                const cols = Object.keys(merged);
                await db.run(
                    `INSERT INTO ${def.target} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
                    cols.map((k) => merged[k])
                );
                run.created += 1;
            }
        }
    } catch (e) {
        status = 'failed';
        error = e.message;
    }

    await db.run(
        `INSERT INTO connector_runs
           (connector_key, status, started_at, finished_at, fetched, created, updated, skipped, quarantined, error, triggered_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [key, status, startedAt, now(), run.fetched, run.created, run.updated, run.skipped, run.quarantined,
            error, user?.name || user?.email || 'system']
    );

    return { connector: key, status, ...run, error };
}
