import { defineConfig } from 'vitest/config';

/**
 * The suites are integration tests: they hit a real running server over HTTP.
 * So a global setup boots one against a throwaway DB, and everything runs
 * serially — one server, one database, shared state, so parallel files would
 * stamp on each other.
 */
export default defineConfig({
    test: {
        include: ['test/**/*.test.mjs'],
        globalSetup: './test/globalSetup.mjs',
        fileParallelism: false,
        sequence: { concurrent: false },
        testTimeout: 30000,
        hookTimeout: 90000,
        // conn.test.mjs imports server code, which imports config — it needs a
        // secret present just to load. Not the server's; any value loads it.
        env: { JWT_SECRET: 'test-secret-for-loading-config-only-not-the-server-key' }
    }
});
