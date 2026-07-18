import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { config } from './config.js';
import { getDb } from './db.js';
import { authenticateToken, requireRole } from './middleware/auth.js';
import accountsRouter from './routes/accounts.js';
import customFieldsRouter from './routes/customFields.js';
import dataExchangeRouter from './routes/dataExchange.js';
import agentsRouter from './routes/agents.js';
import contractsRouter from './routes/contracts.js';
import documentsRouter from './routes/documents.js';
import invoicesRouter from './routes/invoices.js';
import onboardingRouter from './routes/onboarding.js';
import supportRouter from './routes/support.js';
import connectorsRouter from './routes/connectors.js';
import agentKeysRouter from './routes/agentKeys.js';
import neoRouter from './routes/neo.js';
import { storage } from './services/storageService.js';
import usersRouter from './routes/users.js';
import { syncClosedWonDeals } from './services/zohoService.js';
import { saveCredentials, getAllCredentials, getSyncLogs } from './services/credentialService.js';

const app = express();
const PORT = config.port;
const JWT_SECRET = config.jwtSecret;
const MIN_PASSWORD_LENGTH = config.minPasswordLength;

// Behind a load balancer the client IP arrives in X-Forwarded-For; without this
// every request looks like it came from the proxy and rate limiting keys on one
// bucket for the whole world.
if (config.trustProxy) app.set('trust proxy', 1);

// Security headers. CSP is left to the static handler below, which knows whether
// it is serving the SPA at all.
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(compression());

/**
 * CORS: an allowlist rather than the previous wide-open `cors()`, which let any
 * site on the internet call this API with a user's token.
 * No CORS_ORIGINS = same-origin only. Native mobile clients send no Origin
 * header and are unaffected.
 */
app.use(cors({
    origin(origin, cb) {
        if (!origin) return cb(null, true); // curl, server-to-server, native apps
        if (config.corsOrigins.length === 0) return cb(null, false);
        return cb(null, config.corsOrigins.includes(origin));
    },
    credentials: true
}));

// Larger limit so base64 Excel uploads (bulk import) fit.
app.use(express.json({ limit: '15mb' }));

// Blunt ceiling on API traffic — a backstop against runaway clients and scraping.
const apiLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests — slow down and try again shortly.' }
});

/**
 * Login is the brute-force surface, and it needs two limits rather than one.
 *
 * Per-account: many failures against one email is an attack on that account, so
 * it is throttled wherever it comes from. Keyed on email + IP so a whole office
 * behind one NAT gateway isn't locked out by one colleague fat-fingering their
 * password — the mistake that a naive per-IP limit makes.
 *
 * Per-IP: looser, and there to stop one source spraying many accounts, which the
 * per-account limit alone would miss.
 *
 * Successful logins count against neither.
 */
const ipKeyOf = (req) => ipKeyGenerator(req.ip);

const accountLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.authMax,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${ipKeyOf(req)}|${String(req.body?.email || '').toLowerCase()}`,
    message: { error: 'Too many attempts for this account. Try again later.' }
});

const authSprayLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.authMax * 6,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Try again later.' }
});

const authLimiter = [authSprayLimiter, accountLimiter];

app.use('/api/', apiLimiter);

// Liveness probe for the host/orchestrator. Deliberately says nothing about
// internals — no version, no config, no DB details.
app.get('/api/health', (req, res) => res.json({ ok: true }));

/**
 * The versioned API surface.
 *
 * Mounted at both /api/v1 and /api (the same router, so they cannot drift). New
 * clients — the planned Android/iOS app in particular — should pin /api/v1, so
 * this contract can change without a forced app update on day one. /api stays
 * for the current web build and can be retired once it has moved over.
 */
const v1 = express.Router();

// Cash Horizon accounts (layered: routes -> repository -> db).
v1.use('/accounts', accountsRouter);
// Reusable platform engine: custom columns + Excel export/import + PDF reports.
v1.use('/custom-fields', customFieldsRouter);
v1.use('/data', dataExchangeRouter);
// AI agents (NEO global orchestrator + module specialists) and gamification.
v1.use('/agents', agentsRouter);
// CLM — contract lifecycle for active customers (repository, renewals, docs, Customer 360).
v1.use('/contracts', contractsRouter);
v1.use('/documents', documentsRouter);
v1.use('/invoices', invoicesRouter);
// Onboarding — five time-bound stages, Stage 2 generated from the CLM scope.
// Mounted on v1, which is matched before the legacy /api/onboarding demo route.
v1.use('/onboarding', onboardingRouter);
// Support — tickets held to the account's support tier × priority SLA (Medic).
v1.use('/support', supportRouter);
// Connectors — where records come from when they don't come from a person.
v1.use('/connectors', connectorsRouter);
// Agent access: humans mint delegated keys for named agents (NEO, Aukat, …).
v1.use('/agent-keys', agentKeysRouter);
v1.use('/neo', neoRouter);
// ABAC — user management + access policies.
v1.use('/users', usersRouter);

app.use('/api/v1', v1);
app.use('/api', v1);

/**
 * Self-registration is OFF unless explicitly enabled.
 *
 * This is an internal CX portal for a regulated lender: anyone who could reach
 * the host could previously mint themselves a working account and a valid token.
 * Admins create users through /api/users, where role and region are set
 * deliberately. ALLOW_SELF_REGISTRATION=true restores the old behaviour for
 * demos.
 */
const authRouter = express.Router();
v1.use('/auth', authRouter);

authRouter.post('/register', authLimiter, async (req, res) => {
    if (!config.allowSelfRegistration) {
        return res.status(403).json({ error: 'Self-registration is disabled. Ask an administrator for an account.' });
    }
    try {
        const { email, password, name } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, password, and name are required' });
        }
        if (String(password).length < MIN_PASSWORD_LENGTH) {
            return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
        }
        const db = await getDb();

        // Check if user exists
        const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const hash = await bcrypt.hash(password, 10);
        const result = await db.run(
            'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
            [email, hash, name]
        );

        const token = jwt.sign({ id: result.lastID, email, name, role: 'rep' }, JWT_SECRET, { expiresIn: config.jwtExpiresIn });

        res.status(201).json({ token, user: { id: result.lastID, email, name, role: 'rep' } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

authRouter.post('/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        const db = await getDb();

        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const claims = {
            id: user.id, email: user.email, name: user.name, role: user.role || 'rep',
            region: user.region || '', business_unit: user.business_unit || '', team: user.team || '',
            agent_access: user.agent_access || 'read'
        };
        const token = jwt.sign(claims, JWT_SECRET, { expiresIn: config.jwtExpiresIn });

        res.json({ token, user: claims });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

/*
 * Removed: GET/POST /api/customers and GET/POST /api/contracts.
 *
 * These predate the ABAC layer and read the tables directly, so /api/customers
 * returned every account to any authenticated user — a rep saw 5 accounts through
 * /api/accounts and all 14 through here. The contracts pair was already dead
 * (the router above shadows it), and nothing in the app called either.
 *
 * The scoped equivalents are /api/accounts and /api/contracts (routers above).
 */

app.get('/api/onboarding', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const steps = await db.all('SELECT * FROM onboarding_steps ORDER BY id ASC');
        res.json(steps);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/onboarding/complete', authenticateToken, async (req, res) => {
    try {
        const { id, date } = req.body;
        const db = await getDb();
        await db.run('UPDATE onboarding_steps SET completed = 1, date = ? WHERE id = ?', [date, id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/health-checks', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const checks = await db.all('SELECT * FROM health_checks ORDER BY id DESC');
        res.json(checks);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/health-checks', authenticateToken, async (req, res) => {
    try {
        const { date, account, outcome, takeaway, next_step } = req.body;
        const db = await getDb();
        await db.run(
            'INSERT INTO health_checks (date, account, outcome, takeaway, next_step) VALUES (?, ?, ?, ?, ?)',
            [date, account, outcome, takeaway, next_step]
        );
        res.status(201).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/ebrs', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const ebrs = await db.all('SELECT * FROM ebr_meetings ORDER BY id DESC');
        res.json(ebrs);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/ebrs', authenticateToken, async (req, res) => {
    try {
        const { account, date, host, prep, outcome } = req.body;
        const db = await getDb();
        await db.run(
            'INSERT INTO ebr_meetings (account, date, host, prep, outcome, status) VALUES (?, ?, ?, ?, ?, ?)',
            [account, date, host || req.user.name, prep || '0%', outcome || 'Scheduled', 'Upcoming']
        );
        res.status(201).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/surveys', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const surveys = await db.all('SELECT * FROM surveys ORDER BY id DESC');
        res.json(surveys);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/surveys', authenticateToken, async (req, res) => {
    try {
        const { title, type, audience, distribution } = req.body;
        const db = await getDb();
        await db.run(
            'INSERT INTO surveys (title, type, audience, distribution, sent_count, response_rate, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [title, type, audience, distribution, 0, '0%', 'Active']
        );
        res.status(201).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/feature-requests', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const requests = await db.all('SELECT * FROM feature_requests ORDER BY votes DESC');
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/feature-requests', authenticateToken, async (req, res) => {
    try {
        const { title, account, impact, description } = req.body;
        const db = await getDb();
        await db.run(
            'INSERT INTO feature_requests (title, account, impact, description, status, votes) VALUES (?, ?, ?, ?, ?, ?)',
            [title, account, impact, description, 'Review', 0]
        );
        res.status(201).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/feature-requests/vote', authenticateToken, async (req, res) => {
    try {
        const { id } = req.body;
        const db = await getDb();
        await db.run('UPDATE feature_requests SET votes = votes + 1 WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/upsells', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const upsells = await db.all('SELECT * FROM upsells ORDER BY id DESC');
        res.json(upsells);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/upsells', authenticateToken, async (req, res) => {
    try {
        const { account, type, value, product, probability } = req.body;
        const db = await getDb();
        await db.run(
            'INSERT INTO upsells (account, type, value, product, probability, owner) VALUES (?, ?, ?, ?, ?, ?)',
            [account, type, value, product, probability, req.user.name]
        );
        res.status(201).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/comms', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const comms = await db.all('SELECT * FROM comms ORDER BY id DESC');
        res.json(comms);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/comms', authenticateToken, async (req, res) => {
    try {
        const { title, date, type, audience } = req.body;
        const db = await getDb();
        await db.run(
            'INSERT INTO comms (title, date, type, audience, open_rate, click_rate, status, sent_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [title, date, type, audience, '0%', '0%', 'Scheduled', 0]
        );
        res.status(201).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/events', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const events = await db.all('SELECT * FROM events ORDER BY id DESC');
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/events', authenticateToken, async (req, res) => {
    try {
        const { title, date, type, budget } = req.body;
        const db = await getDb();
        await db.run(
            'INSERT INTO events (title, date, type, attendees, status, budget) VALUES (?, ?, ?, ?, ?, ?)',
            [title, date, type, '0', 'Planning', budget]
        );
        res.status(201).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/ai/query', authenticateToken, async (req, res) => {
    try {
        const { query } = req.body;
        const db = await getDb();

        let response = "I'm sorry, I don't have enough data to answer that yet. Try asking about NPS, accounts at risk, or revenue predictions.";

        const lowerQuery = query.toLowerCase();

        if (lowerQuery.includes('nps')) {
            response = "Our current average NPS score is +72, which is in the 'Legendary' range.";
        } else if (lowerQuery.includes('at risk') || lowerQuery.includes('critical') || lowerQuery.includes('poor')) {
            const atRisk = await db.all("SELECT name FROM customers WHERE health IN ('Critical', 'Poor')");
            if (atRisk.length > 0) {
                response = `There are ${atRisk.length} accounts at risk: ${atRisk.map(a => a.name).join(', ')}. I recommend immediate outreach.`;
            } else {
                response = "Currently, there are no accounts marked as 'Critical' or 'Poor'. Excellent work!";
            }
        } else if (lowerQuery.includes('prediction') || lowerQuery.includes('future') || lowerQuery.includes('forecast')) {
            response = "Based on historical adoption rates and current health trends, we predict a **15% increase** in expansion revenue for the next quarter.";
        } else if (lowerQuery.includes('revenue') || lowerQuery.includes('value') || lowerQuery.includes('arr')) {
            const totalValue = await db.get("SELECT SUM(CAST(REPLACE(REPLACE(value, '$', ''), 'k', '000') AS INTEGER)) as total FROM customers");
            response = `The total estimated contract value across your portfolio is approximately **$${(totalValue.total / 1000).toFixed(0)}k**.`;
        } else if (lowerQuery.includes('customer') || lowerQuery.includes('account')) {
            const count = await db.get("SELECT COUNT(*) as count FROM customers");
            response = `You are currently managing ${count.count} accounts in your portfolio.`;
        }

        res.json({ response });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/zoho/sync', authenticateToken, async (req, res) => {
    try {
        const synced = await syncClosedWonDeals();
        res.json({ success: true, count: synced.length, accounts: synced });
    } catch (error) {
        console.error('Zoho Sync Error:', error.message);
        res.status(500).json({ error: error.message || 'Zoho sync failed.' });
    }
});

// Integration secrets: admins only, and never handed back to the browser.
// This used to return client_id and refresh_token to any authenticated user —
// a rep could read the credentials for every connected tool.
const REDACTED = '••••••••';
const redactCreds = (row) => {
    if (!row) return row;
    const out = { ...row };
    for (const k of ['refresh_token', 'client_secret', 'access_token', 'api_key', 'password']) {
        if (out[k]) out[k] = REDACTED;
    }
    return out;
};

app.get('/api/connectivity/credentials', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { tool_name } = req.query;
        if (tool_name) {
            const db = await getDb();
            const creds = await db.get(
                'SELECT tool_name, updated_at, client_id, dc, refresh_token, target_module FROM credentials WHERE tool_name = ?',
                [tool_name]
            );
            return res.json(redactCreds(creds) || {});
        }
        const creds = await getAllCredentials();
        res.json(Array.isArray(creds) ? creds.map(redactCreds) : redactCreds(creds));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch credentials' });
    }
});

app.post('/api/connectivity/credentials', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { tool_name, ...creds } = req.body;
        if (!tool_name) return res.status(400).json({ error: 'tool_name is required' });
        // A redacted value coming back from the UI means "unchanged" — never store it.
        for (const [k, v] of Object.entries(creds)) if (v === REDACTED) delete creds[k];
        await saveCredentials(tool_name, creds);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save credentials' });
    }
});

app.get('/api/connectivity/logs', authenticateToken, async (req, res) => {
    try {
        const { tool_name } = req.query;
        const db = await getDb();
        let logs;
        if (tool_name) {
            logs = await db.all('SELECT * FROM sync_logs WHERE tool_name = ? ORDER BY timestamp DESC LIMIT 20', [tool_name]);
        } else {
            logs = await getSyncLogs();
        }
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch sync logs' });
    }
});

// An unknown /api path is a 404 in JSON, never the SPA's index.html — a client
// getting HTML back from a mistyped endpoint is a confusing way to learn it.
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

/**
 * Serve the built SPA from this process, so the whole platform is one container
 * on one port with no separate web server to run or configure.
 */
if (config.serveStatic) {
    const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
    app.use(express.static(dist, { maxAge: '1y', index: false }));
    // index.html itself must never be cached, or clients pin to a stale bundle.
    app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html'), { maxAge: 0 }));
}

// Last-resort handler: log the detail, tell the client nothing. A stack trace in
// a response is a free map of the server.
// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.expose ? err.message : 'Server error' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT} [${config.env}]`);
    console.log(`Document storage: ${storage.driver} -> ${storage.location()}`);
    console.log(`Self-registration: ${config.allowSelfRegistration ? 'ENABLED' : 'disabled'}`);
    console.log(`CORS: ${config.corsOrigins.length ? config.corsOrigins.join(', ') : 'same-origin only'}`);
    if (config.serveStatic) console.log('Serving built frontend from ../dist');
});
