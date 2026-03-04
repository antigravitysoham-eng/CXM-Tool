import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcrypt';

const MOCK_CUSTOMERS = [
    { name: 'Acme Corp', tier: 'Enterprise', arr: '$120,000', status: 'Healthy', owner: 'Sarah J.', renewal: '2025-01-15' },
    { name: 'Globex', tier: 'Professional', arr: '$45,000', status: 'At Risk', owner: 'Mike T.', renewal: '2024-11-30' },
    { name: 'Soylent', tier: 'Enterprise', arr: '$250,000', status: 'Healthy', owner: 'Alex M.', renewal: '2025-06-22' },
    { name: 'Initech', tier: 'Starter', arr: '$12,000', status: 'Needs Attention', owner: 'Sarah J.', renewal: '2024-12-05' }
];

const MOCK_CONTRACTS = [
    { id: 'CTR-2024-001', customer: 'Acme Corp', type: 'New Business', value: '$120,000', stage: 'Active', startDate: '2024-01-15' },
    { id: 'CTR-2024-002', customer: 'Globex', type: 'Renewal', value: '$45,000', stage: 'Pending Signature', startDate: '2024-12-01' },
];

let dbPromise = null;

export async function getDb() {
    if (!dbPromise) {
        dbPromise = open({
            filename: './cx_tool.sqlite',
            driver: sqlite3.Database
        }).then(async (db) => {
            // Create tables
            await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE,
          password TEXT,
          name TEXT
        );
        CREATE TABLE IF NOT EXISTS customers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          tier TEXT,
          arr TEXT,
          status TEXT,
          owner TEXT,
          renewal TEXT
        );
        CREATE TABLE IF NOT EXISTS contracts (
          id TEXT PRIMARY KEY,
          customer TEXT,
          type TEXT,
          value TEXT,
          stage TEXT,
          startDate TEXT
        );
      `);

            // Seed customers if empty
            const customerCount = await db.get('SELECT COUNT(*) as count FROM customers');
            if (customerCount.count === 0) {
                for (const c of MOCK_CUSTOMERS) {
                    await db.run(
                        'INSERT INTO customers (name, tier, arr, status, owner, renewal) VALUES (?, ?, ?, ?, ?, ?)',
                        [c.name, c.tier, c.arr, c.status, c.owner, c.renewal]
                    );
                }
            }

            // Seed contracts if empty
            const contractCount = await db.get('SELECT COUNT(*) as count FROM contracts');
            if (contractCount.count === 0) {
                for (const c of MOCK_CONTRACTS) {
                    await db.run(
                        'INSERT INTO contracts (id, customer, type, value, stage, startDate) VALUES (?, ?, ?, ?, ?, ?)',
                        [c.id, c.customer, c.type, c.value, c.stage, c.startDate]
                    );
                }
            }

            // Seed an initial user
            const userCount = await db.get('SELECT COUNT(*) as count FROM users');
            if (userCount.count === 0) {
                const hash = await bcrypt.hash('password123', 10);
                await db.run(
                    'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
                    ['demo@example.com', hash, 'Demo User']
                );
            }

            return db;
        });
    }
    return dbPromise;
}
