import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

/**
 * Boots the real server against a throwaway SQLite file, seeds the sample data
 * the suites expect, and tears it all down after.
 *
 * A fresh DB per run is the point: the suites used to assume the dev database
 * was already populated, which made them non-portable and their results depend
 * on whatever state I'd left behind. Now the run is hermetic — it works on a
 * teammate's machine and in CI, not just mine.
 */

export const TEST_PORT = 5099;
const API = `http://localhost:${TEST_PORT}/api`;

export async function setup() {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const serverEntry = path.join(here, '..', 'server.js');
    const dbPath = path.join(os.tmpdir(), `cx-test-${Date.now()}-${process.pid}.sqlite`);

    const env = {
        ...process.env,
        NODE_ENV: 'test',
        PORT: String(TEST_PORT),
        DB_PATH: dbPath,
        JWT_SECRET: 'test-server-secret-at-least-32-characters-long-xxxxx',
        RATE_LIMIT_MAX: '1000000',   // the suites make thousands of calls
        CORS_ORIGINS: '',
        ALLOW_SELF_REGISTRATION: 'false',
        STORAGE_DRIVER: 'local',
        AGENT_LEASE_TTL_MS: '2000',  // short, so the lease-takeover test is quick
        // WhatsApp channel: give the webhook a verify token + app secret so the
        // signature path is exercised, but no TOKEN/PHONE_ID — sends stay no-ops
        // (the suite must not call out to Meta).
        WHATSAPP_VERIFY_TOKEN: 'test-verify-token',
        WHATSAPP_APP_SECRET: 'test-app-secret',
        WHATSAPP_BUSINESS_NUMBER: '+1 555 010 0000'
    };

    const proc = spawn(process.execPath, [serverEntry], { env, stdio: ['ignore', 'ignore', 'inherit'] });

    // Wait for the health probe rather than a fixed sleep.
    let up = false;
    for (let i = 0; i < 80; i++) {
        try {
            const r = await fetch(`${API}/health`);
            if (r.ok) { up = true; break; }
        } catch { /* not listening yet */ }
        await sleep(250);
    }
    if (!up) {
        proc.kill();
        throw new Error(`Test server never became healthy on :${TEST_PORT}`);
    }

    // demo@example.com is promoted to admin on boot (see db.js). Seed the sample
    // accounts + contracts the suites read.
    const login = async (email, password) => (await (await fetch(`${API}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    })).json()).token;
    const admin = await login('demo@example.com', 'password123');
    const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` };
    await fetch(`${API}/accounts/seed-sample`, { method: 'POST', headers: H });
    await fetch(`${API}/contracts/seed-sample`, { method: 'POST', headers: H });

    // Vitest calls the returned function as teardown.
    return async () => {
        proc.kill();
        for (const f of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
            try { fs.rmSync(f, { force: true }); } catch { /* best effort */ }
        }
    };
}
