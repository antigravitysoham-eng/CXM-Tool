import { getDb } from '../db.js';

export const saveCredentials = async (toolName, creds) => {
    const db = await getDb();
    const { client_id, client_secret, refresh_token, dc, target_module } = creds;

    // Using INSERT OR REPLACE (equivalent to Upsert in SQLite)
    await db.run(
        `INSERT INTO credentials (tool_name, client_id, client_secret, refresh_token, dc, target_module, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(tool_name) DO UPDATE SET 
            client_id=excluded.client_id, 
            client_secret=excluded.client_secret, 
            refresh_token=excluded.refresh_token, 
            dc=excluded.dc,
            target_module=excluded.target_module,
            updated_at=CURRENT_TIMESTAMP`,
        [toolName, client_id, client_secret, refresh_token, dc, target_module]
    );
};

export const getCredentials = async (toolName) => {
    const db = await getDb();
    return await db.get('SELECT * FROM credentials WHERE tool_name = ?', [toolName]);
};

export const getAllCredentials = async () => {
    const db = await getDb();
    return await db.all('SELECT tool_name, updated_at, target_module FROM credentials');
};

export const logSync = async (toolName, status, recordsCount, errorMessage = null) => {
    const db = await getDb();
    await db.run(
        'INSERT INTO sync_logs (tool_name, status, records_count, error_message) VALUES (?, ?, ?, ?)',
        [toolName, status, recordsCount, errorMessage]
    );
};

export const getSyncLogs = async (limit = 20) => {
    const db = await getDb();
    return await db.all('SELECT * FROM sync_logs ORDER BY timestamp DESC LIMIT ?', [limit]);
};
