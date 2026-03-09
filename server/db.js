import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcrypt';

const MOCK_CUSTOMERS = [
    { name: 'Acme Corp', tier: 'Enterprise', arr: '$120,000', status: 'Healthy', owner: 'Sarah J.', renewal: '2025-01-15', industry: 'SaaS', progress: 85, health: 'Good', value: '$120k', cxm: 'Sarah J.' },
    { name: 'Globex', tier: 'Professional', arr: '$45,000', status: 'At Risk', owner: 'Mike T.', renewal: '2024-11-30', industry: 'Manufacturing', progress: 40, health: 'Poor', value: '$45k', cxm: 'Mike T.' },
    { name: 'Soylent', tier: 'Enterprise', arr: '$250,000', status: 'Healthy', owner: 'Alex M.', renewal: '2025-06-22', industry: 'FoodTech', progress: 95, health: 'Good', value: '$250k', cxm: 'Alex M.' },
    { name: 'Initech', tier: 'Starter', arr: '$12,000', status: 'Needs Attention', owner: 'Sarah J.', renewal: '2024-12-05', industry: 'Finance', progress: 60, health: 'Average', value: '$12k', cxm: 'Sarah J.' }
];

const MOCK_CONTRACTS = [
    { id: 'CTR-2024-001', account: 'Acme Corp', type: 'New Business', value: '$120,000', stage: 'Active', startDate: '2024-01-15', date: 'Jan 15, 2024', status: 'Active' },
    { id: 'CTR-2024-002', account: 'Globex', type: 'Renewal', value: '$45,000', stage: 'Renewing', startDate: '2024-12-01', date: 'Dec 01, 2024', status: 'Pending' },
];

const MOCK_ONBOARDING = [
    { label: 'Kickoff Meeting', date: '2024-02-01', completed: true },
    { label: 'Technical Setup', date: '2024-02-05', completed: true },
    { label: 'User Training', date: '2024-02-12', completed: false },
    { label: 'Platform Launch', date: '2024-02-20', completed: false }
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
          renewal TEXT,
          industry TEXT,
          progress INTEGER,
          health TEXT,
          value TEXT,
          cxm TEXT
        );
        CREATE TABLE IF NOT EXISTS contracts (
          id TEXT PRIMARY KEY,
          account TEXT,
          type TEXT,
          value TEXT,
          stage TEXT,
          startDate TEXT,
          date TEXT,
          status TEXT
        );
        CREATE TABLE IF NOT EXISTS onboarding_steps (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          label TEXT,
          date TEXT,
          completed BOOLEAN
        );
        CREATE TABLE IF NOT EXISTS health_checks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT,
          account TEXT,
          outcome TEXT,
          takeaway TEXT,
          next_step TEXT
        );
        CREATE TABLE IF NOT EXISTS ebr_meetings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account TEXT,
          status TEXT,
          date TEXT,
          host TEXT,
          prep TEXT,
          outcome TEXT
        );
        CREATE TABLE IF NOT EXISTS surveys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            type TEXT,
            audience TEXT,
            distribution TEXT,
            sent_count INTEGER,
            response_rate TEXT,
            status TEXT
        );
        CREATE TABLE IF NOT EXISTS feature_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            account TEXT,
            impact TEXT,
            description TEXT,
            status TEXT,
            votes INTEGER
        );
        CREATE TABLE IF NOT EXISTS upsells (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account TEXT,
            type TEXT,
            value TEXT,
            product TEXT,
            probability TEXT,
            owner TEXT
        );
        CREATE TABLE IF NOT EXISTS comms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            date TEXT,
            type TEXT,
            audience TEXT,
            open_rate TEXT,
            click_rate TEXT,
            status TEXT,
            sent_count INTEGER
        );
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            date TEXT,
            type TEXT,
            attendees TEXT,
            status TEXT,
            budget TEXT
        );
      `);

            // Seed customers if empty
            const customerCount = await db.get('SELECT COUNT(*) as count FROM customers');
            if (customerCount.count === 0) {
                for (const c of MOCK_CUSTOMERS) {
                    await db.run(
                        'INSERT INTO customers (name, tier, arr, status, owner, renewal, industry, progress, health, value, cxm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [c.name, c.tier, c.arr, c.status, c.owner, c.renewal, c.industry, c.progress, c.health, c.value, c.cxm]
                    );
                }
            }

            // Seed contracts if empty
            const contractCount = await db.get('SELECT COUNT(*) as count FROM contracts');
            if (contractCount.count === 0) {
                for (const c of MOCK_CONTRACTS) {
                    await db.run(
                        'INSERT INTO contracts (id, account, type, value, stage, startDate, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [c.id, c.account, c.type, c.value, c.stage, c.startDate, c.date, c.status]
                    );
                }
            }

            // Seed onboarding if empty
            const onboardingCount = await db.get('SELECT COUNT(*) as count FROM onboarding_steps');
            if (onboardingCount.count === 0) {
                for (const s of MOCK_ONBOARDING) {
                    await db.run(
                        'INSERT INTO onboarding_steps (label, date, completed) VALUES (?, ?, ?)',
                        [s.label, s.date, s.completed]
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
