import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { config } from './config.js';
import bcrypt from 'bcrypt';

// Add a column only if it isn't already present (SQLite has no ADD COLUMN IF NOT EXISTS).
async function ensureColumn(db, table, name, ddl) {
    const cols = await db.all(`PRAGMA table_info(${table})`);
    if (!cols.some((c) => c.name === name)) {
        await db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    }
}

// Parse a legacy display string like "$120k" into a whole-unit integer.
export function parseLegacyMoney(str) {
    if (str == null) return 0;
    const s = String(str).trim().toLowerCase().replace(/[$,₹\s]/g, '');
    const m = s.match(/^([0-9.]+)\s*(cr|l|m|k)?$/);
    if (!m) return parseInt(s.replace(/[^0-9]/g, ''), 10) || 0;
    const n = parseFloat(m[1]);
    const mult = { cr: 10000000, l: 100000, m: 1000000, k: 1000 }[m[2]] || 1;
    return Math.round(n * mult);
}

const MOCK_CUSTOMERS = [
    { name: 'Acme Corp', type: 'Customer', tier: 'Enterprise', arr: '$120,000', status: 'Healthy', owner: 'Sarah J.', renewal: '2025-01-15', industry: 'SaaS', progress: 85, health: 'Good', value: '$120k', cxm: 'Sarah J.' },
    { name: 'Globex', type: 'Customer', tier: 'Professional', arr: '$45,000', status: 'At Risk', owner: 'Mike T.', renewal: '2024-11-30', industry: 'Manufacturing', progress: 40, health: 'Poor', value: '$45k', cxm: 'Mike T.' },
    { name: 'Soylent', type: 'Customer', tier: 'Enterprise', arr: '$250,000', status: 'Healthy', owner: 'Alex M.', renewal: '2025-06-22', industry: 'FoodTech', progress: 95, health: 'Good', value: '$250k', cxm: 'Alex M.' },
    { name: 'Initech', type: 'Customer', tier: 'Starter', arr: '$12,000', status: 'Needs Attention', owner: 'Sarah J.', renewal: '2024-12-05', industry: 'Finance', progress: 60, health: 'Average', value: '$12k', cxm: 'Sarah J.' },
    { name: 'Umbrella Health', type: 'Prospect', tier: 'Enterprise', arr: '$0', status: 'Evaluating', owner: 'Alex M.', renewal: '', industry: 'Healthcare', progress: 15, health: 'Good', value: '$0', cxm: 'Alex M.' },
    { name: 'Stark Industries', type: 'Partner', tier: 'Professional', arr: '$60,000', status: 'Healthy', owner: 'Mike T.', renewal: '2025-03-10', industry: 'Aerospace', progress: 70, health: 'Good', value: '$60k', cxm: 'Mike T.' }
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
            // Was './cx_tool.sqlite' — relative to the working directory, so the
            // database you got depended on where you launched from, and in a
            // container it landed outside the mounted volume and vanished on
            // restart. Absolute by default, overridable for deployment.
            filename: config.dbPath,
            driver: sqlite3.Database
        }).then(async (db) => {
            // SQLite defaults are tuned for a single writer with no concurrency.
            // WAL lets reads continue during writes, and a busy timeout makes
            // concurrent writers wait rather than immediately throwing SQLITE_BUSY.
            await db.exec('PRAGMA journal_mode = WAL');
            await db.exec('PRAGMA busy_timeout = 5000');
            await db.exec('PRAGMA foreign_keys = ON');
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
          type TEXT,
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
        CREATE TABLE IF NOT EXISTS credentials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tool_name TEXT UNIQUE,
            target_module TEXT,
            client_id TEXT,
            client_secret TEXT,
            refresh_token TEXT,
            dc TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS sync_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tool_name TEXT,
            status TEXT,
            records_count INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            error_message TEXT
        );
        CREATE TABLE IF NOT EXISTS custom_field_defs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            module TEXT,
            key TEXT,
            label TEXT,
            type TEXT,
            options TEXT,
            created_at TEXT,
            UNIQUE(module, key)
        );
        CREATE TABLE IF NOT EXISTS contract_documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contract_id TEXT,
            account TEXT,
            doc_type TEXT,
            name TEXT,
            link TEXT,
            version TEXT,
            created_at TEXT
        );
        /* What a customer actually bought, and at what scope.
           One row per product per contract — rows, not a JSON blob on the
           contract, so Onboarding can query "every framework for this account"
           and reporting can group by product without parsing anything. */
        CREATE TABLE IF NOT EXISTS contract_products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contract_id TEXT,
            account TEXT,
            product_key TEXT,
            unit_count INTEGER DEFAULT 0,
            items TEXT,            -- JSON array of named things (frameworks, integrations…)
            info TEXT,             -- what the unit means, for "Others"
            created_at TEXT,
            updated_at TEXT,
            UNIQUE(contract_id, product_key)
        );
        CREATE TABLE IF NOT EXISTS invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_no TEXT,
            contract_id TEXT,
            account TEXT,
            amount INTEGER DEFAULT 0,
            currency TEXT DEFAULT 'INR',
            status TEXT DEFAULT 'Draft',
            issue_date TEXT,
            due_date TEXT,
            paid_date TEXT,
            period_from TEXT,
            period_to TEXT,
            notes TEXT,
            raised_by TEXT,
            created_at TEXT,
            updated_at TEXT
        );
        /* Onboarding: one record per customer being brought live, its five
           stages, and the tasks inside them. Stage 2's tasks are generated from
           contract_products above, which is why scope is stored as rows. */
        CREATE TABLE IF NOT EXISTS onboardings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account TEXT,
            contract_id TEXT,
            csm_name TEXT,
            csm_email TEXT,
            status TEXT DEFAULT 'Not started',
            kickoff_date TEXT,
            target_go_live TEXT,
            started_at TEXT,
            completed_at TEXT,
            initiated_by TEXT,
            notes TEXT,
            created_at TEXT,
            updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS onboarding_stages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            onboarding_id INTEGER,
            stage_no INTEGER,
            name TEXT,
            status TEXT DEFAULT 'Pending',
            owner TEXT,
            due_date TEXT,
            started_at TEXT,
            completed_at TEXT,
            notes TEXT
        );
        CREATE TABLE IF NOT EXISTS onboarding_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            onboarding_id INTEGER,
            stage_id INTEGER,
            label TEXT,
            product_key TEXT,
            party TEXT DEFAULT 'Zeron',
            done INTEGER DEFAULT 0,
            owner TEXT,
            due_date TEXT,
            completed_at TEXT,
            notes TEXT,
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account TEXT,
            contract_id TEXT,
            doc_type TEXT,
            name TEXT,
            description TEXT,
            version TEXT,
            link TEXT,
            file_key TEXT,
            file_name TEXT,
            mime TEXT,
            size INTEGER,
            uploaded_by TEXT,
            replaces_id INTEGER,
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS document_blobs (
            key TEXT PRIMARY KEY,
            data BLOB
        );
        CREATE TABLE IF NOT EXISTS policies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            role TEXT,
            module TEXT,
            actions TEXT,
            effect TEXT,
            condition_type TEXT,
            condition_value TEXT,
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS customer_contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account TEXT,
            name TEXT,
            designation TEXT,
            email TEXT,
            phone TEXT,
            is_primary INTEGER DEFAULT 0,
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS game_state (
            user_id INTEGER PRIMARY KEY,
            xp INTEGER DEFAULT 0,
            streak INTEGER DEFAULT 0,
            last_active TEXT,
            updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS agent_xp (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            agent_key TEXT,
            xp INTEGER DEFAULT 0,
            interactions INTEGER DEFAULT 0,
            UNIQUE(user_id, agent_key)
        );
        CREATE TABLE IF NOT EXISTS achievements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            key TEXT,
            unlocked_at TEXT,
            UNIQUE(user_id, key)
        );
        CREATE TABLE IF NOT EXISTS agent_instructions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            agent_key TEXT,
            text TEXT,
            created_at TEXT
        );
      `);

            // --- Schema migrations (add columns to existing tables) ---
            // `type` (segment) was added after the first release.
            await ensureColumn(db, 'customers', 'type', 'type TEXT');
            // Cash Horizon fields: money as numbers, sales ownership, MEDDICC, pipeline.
            await ensureColumn(db, 'customers', 'source', 'source TEXT');
            await ensureColumn(db, 'customers', 'sourcing_partner_id', 'sourcing_partner_id INTEGER');
            await ensureColumn(db, 'customers', 'stage', 'stage TEXT');
            await ensureColumn(db, 'customers', 'value_amount', 'value_amount INTEGER');
            await ensureColumn(db, 'customers', 'value_currency', 'value_currency TEXT');
            await ensureColumn(db, 'customers', 'probability', 'probability INTEGER');
            await ensureColumn(db, 'customers', 'owner_id', 'owner_id INTEGER');
            await ensureColumn(db, 'customers', 'sales_owner', 'sales_owner TEXT');
            await ensureColumn(db, 'customers', 'next_step', 'next_step TEXT');
            await ensureColumn(db, 'customers', 'next_step_date', 'next_step_date TEXT');
            await ensureColumn(db, 'customers', 'meddicc_metrics', 'meddicc_metrics TEXT');
            await ensureColumn(db, 'customers', 'meddicc_economic_buyer', 'meddicc_economic_buyer TEXT');
            await ensureColumn(db, 'customers', 'meddicc_decision_criteria', 'meddicc_decision_criteria TEXT');
            await ensureColumn(db, 'customers', 'meddicc_decision_process', 'meddicc_decision_process TEXT');
            await ensureColumn(db, 'customers', 'meddicc_identify_pain', 'meddicc_identify_pain TEXT');
            await ensureColumn(db, 'customers', 'meddicc_champion', 'meddicc_champion TEXT');
            await ensureColumn(db, 'customers', 'meddicc_competition', 'meddicc_competition TEXT');
            await ensureColumn(db, 'customers', 'created_at', 'created_at TEXT');
            await ensureColumn(db, 'customers', 'updated_at', 'updated_at TEXT');
            // User-defined columns stored as a JSON blob keyed by custom_field_defs.key.
            await ensureColumn(db, 'customers', 'custom_fields', 'custom_fields TEXT');
            // Role-based access control on users.
            await ensureColumn(db, 'users', 'role', "role TEXT DEFAULT 'rep'");
            // ABAC attributes on users + resources.
            await ensureColumn(db, 'users', 'region', 'region TEXT');
            await ensureColumn(db, 'users', 'business_unit', 'business_unit TEXT');
            await ensureColumn(db, 'users', 'team', 'team TEXT');
            await ensureColumn(db, 'customers', 'region', 'region TEXT');
            await ensureColumn(db, 'customers', 'is_confidential', 'is_confidential INTEGER DEFAULT 0');

            // CLM: extend contracts for active-customer lifecycle management.
            for (const [col, ddl] of [
                ['end_date', 'end_date TEXT'], ['renewal_date', 'renewal_date TEXT'],
                ['term_months', 'term_months INTEGER'], ['auto_renew', 'auto_renew INTEGER DEFAULT 0'],
                ['notice_period_days', 'notice_period_days INTEGER DEFAULT 30'],
                ['deployment', 'deployment TEXT'], ['license_type', 'license_type TEXT'],
                ['perpetual_term_years', 'perpetual_term_years INTEGER'],
                ['billing_frequency', 'billing_frequency TEXT'], ['payment_terms', 'payment_terms TEXT'],
                ['currency', 'currency TEXT'], ['tcv', 'tcv INTEGER'], ['arr', 'arr INTEGER'], ['mrr', 'mrr INTEGER'],
                ['spoc_name', 'spoc_name TEXT'], ['spoc_email', 'spoc_email TEXT'], ['spoc_role', 'spoc_role TEXT'],
                ['csm_name', 'csm_name TEXT'], ['csm_email', 'csm_email TEXT'],
                ['am_name', 'am_name TEXT'], ['am_email', 'am_email TEXT'],
                ['owner', 'owner TEXT'], ['notes', 'notes TEXT'],
                ['support_tier', 'support_tier TEXT'],
                ['created_at', 'created_at TEXT'], ['updated_at', 'updated_at TEXT']
            ]) {
                await ensureColumn(db, 'contracts', col, ddl);
            }

            // DMS: documents used to hang off a contract. Lift the existing rows into
            // the account-level library once; contract_documents is left untouched as
            // a fallback until the next release drops it.
            const docCount = await db.get('SELECT COUNT(*) as count FROM documents');
            if (docCount.count === 0) {
                const legacy = await db.all('SELECT * FROM contract_documents');
                for (const d of legacy) {
                    await db.run(
                        `INSERT INTO documents (account, contract_id, doc_type, name, version, link, created_at)
                         VALUES (?,?,?,?,?,?,?)`,
                        [d.account, d.contract_id, d.doc_type, d.name, d.version, d.link, d.created_at]
                    );
                }
            }

            /*
             * Indexes for the hot paths. There were none: every login scanned the
             * users table, and every ABAC-scoped read scanned customers end to end.
             * Invisible at demo size, quadratic at real size — each scoped contract
             * or document read scans customers too.
             *
             * Cheap to create and idempotent, so they are applied on every boot.
             */
            for (const [name, ddl] of [
                // Login looks up by email on every single request to /auth/login.
                ['idx_users_email', 'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)'],
                // The three ABAC scope clauses: all / own / region, plus segment.
                ['idx_customers_owner', 'CREATE INDEX IF NOT EXISTS idx_customers_owner ON customers(owner_id)'],
                ['idx_customers_region', 'CREATE INDEX IF NOT EXISTS idx_customers_region ON customers(region)'],
                ['idx_customers_type', 'CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(type)'],
                // Accounts are resolved by name from contracts and documents.
                ['idx_customers_name', 'CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)'],
                ['idx_contracts_account', 'CREATE INDEX IF NOT EXISTS idx_contracts_account ON contracts(account)'],
                ['idx_contracts_renewal', 'CREATE INDEX IF NOT EXISTS idx_contracts_renewal ON contracts(renewal_date)'],
                ['idx_contracts_status', 'CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status)'],
                ['idx_documents_account', 'CREATE INDEX IF NOT EXISTS idx_documents_account ON documents(account)'],
                ['idx_documents_contract', 'CREATE INDEX IF NOT EXISTS idx_documents_contract ON documents(contract_id)'],
                // Drives the "hide superseded versions" subquery on every list.
                ['idx_documents_replaces', 'CREATE INDEX IF NOT EXISTS idx_documents_replaces ON documents(replaces_id)'],
                ['idx_contacts_account', 'CREATE INDEX IF NOT EXISTS idx_contacts_account ON customer_contacts(account)'],
                // Scope lookups: by contract (CLM form) and by account (Onboarding).
                ['idx_cprod_contract', 'CREATE INDEX IF NOT EXISTS idx_cprod_contract ON contract_products(contract_id)'],
                ['idx_cprod_account', 'CREATE INDEX IF NOT EXISTS idx_cprod_account ON contract_products(account)'],
                ['idx_invoices_account', 'CREATE INDEX IF NOT EXISTS idx_invoices_account ON invoices(account)'],
                ['idx_invoices_contract', 'CREATE INDEX IF NOT EXISTS idx_invoices_contract ON invoices(contract_id)'],
                // Drives the ageing/overdue views.
                ['idx_invoices_status', 'CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status, due_date)'],
                ['idx_onb_account', 'CREATE INDEX IF NOT EXISTS idx_onb_account ON onboardings(account)'],
                ['idx_onb_stages', 'CREATE INDEX IF NOT EXISTS idx_onb_stages ON onboarding_stages(onboarding_id, stage_no)'],
                ['idx_onb_tasks', 'CREATE INDEX IF NOT EXISTS idx_onb_tasks ON onboarding_tasks(onboarding_id, stage_id)'],
                // Policy lookup runs on every authorization decision.
                ['idx_policies_role', 'CREATE INDEX IF NOT EXISTS idx_policies_role ON policies(role, module)']
            ]) {
                try {
                    await db.exec(ddl);
                } catch (e) {
                    // A pre-existing duplicate would break the unique email index —
                    // don't take the whole server down over an index.
                    console.warn(`Index ${name} skipped: ${e.message}`);
                }
            }

            // Seed customers if empty
            const customerCount = await db.get('SELECT COUNT(*) as count FROM customers');
            if (customerCount.count === 0) {
                for (const c of MOCK_CUSTOMERS) {
                    await db.run(
                        'INSERT INTO customers (name, type, tier, arr, status, owner, renewal, industry, progress, health, value, cxm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [c.name, c.type, c.tier, c.arr, c.status, c.owner, c.renewal, c.industry, c.progress, c.health, c.value, c.cxm]
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

            // --- Backfill new columns (runs after seeds so fresh + migrated rows both get values) ---
            await db.run("UPDATE customers SET type = 'Customer' WHERE type IS NULL OR type = ''");
            await db.run("UPDATE customers SET source = 'Direct' WHERE source IS NULL OR source = ''");
            await db.run("UPDATE customers SET value_currency = 'USD' WHERE value_currency IS NULL OR value_currency = ''");
            await db.run("UPDATE customers SET stage = CASE WHEN type = 'Customer' THEN 'Live' WHEN type = 'Prospect' THEN 'Lead' ELSE 'Live' END WHERE stage IS NULL OR stage = ''");
            await db.run("UPDATE customers SET probability = CASE WHEN type = 'Customer' THEN 100 ELSE 0 END WHERE probability IS NULL");
            await db.run("UPDATE customers SET sales_owner = owner WHERE (sales_owner IS NULL OR sales_owner = '') AND owner IS NOT NULL");
            await db.run("UPDATE customers SET created_at = datetime('now') WHERE created_at IS NULL");
            await db.run("UPDATE customers SET updated_at = datetime('now') WHERE updated_at IS NULL");

            // value_amount parsed from the legacy display string (needs JS, not SQL).
            const needAmount = await db.all("SELECT id, value FROM customers WHERE value_amount IS NULL");
            for (const row of needAmount) {
                await db.run('UPDATE customers SET value_amount = ? WHERE id = ?', [parseLegacyMoney(row.value), row.id]);
            }

            // Roles: the demo account is admin; everyone else defaults to rep.
            await db.run("UPDATE users SET role = 'admin' WHERE email = 'demo@example.com'");
            await db.run("UPDATE users SET role = 'rep' WHERE role IS NULL OR role = ''");

            // Seed the default ABAC policy set — reproduces the prior RBAC exactly
            // (admin/manager see all; reps see only what they own) so nothing changes.
            const policyCount = await db.get('SELECT COUNT(*) as count FROM policies');
            if (policyCount.count === 0) {
                const now = new Date().toISOString();
                const seed = [
                    ['Admin — full access', 'admin', '*', 'read,write,delete,export', 'allow', 'all', ''],
                    ['Manager — full portfolio', 'manager', '*', 'read,write,export', 'allow', 'all', ''],
                    ['Rep — own accounts', 'rep', 'accounts', 'read,write', 'allow', 'own', ''],
                    ['Rep — own contracts', 'rep', 'contracts', 'read,write', 'allow', 'own', '']
                ];
                for (const p of seed) {
                    await db.run(
                        'INSERT INTO policies (name, role, module, actions, effect, condition_type, condition_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [...p, now]
                    );
                }
            }

            return db;
        });
    }
    return dbPromise;
}
