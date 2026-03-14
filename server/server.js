import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { getDb } from './db.js';
import { syncClosedWonDeals } from './services/zohoService.js';
import { saveCredentials, getAllCredentials, getSyncLogs } from './services/credentialService.js';

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'cx_portal_secret_key_2026';

app.use(cors());
app.use(express.json());

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, password, and name are required' });
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

        const token = jwt.sign({ id: result.lastID, email, name }, JWT_SECRET, { expiresIn: '24h' });

        res.status(201).json({ token, user: { id: result.lastID, email, name } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
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

        const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '24h' });

        res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Protected routes for CX context
app.get('/api/customers', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const customers = await db.all('SELECT * FROM customers ORDER BY id DESC');
        res.json(customers);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/customers', authenticateToken, async (req, res) => {
    try {
        const { name, tier, arr, status, owner, renewal, industry, progress, health, value, cxm } = req.body;
        const db = await getDb();
        const result = await db.run(
            'INSERT INTO customers (name, tier, arr, status, owner, renewal, industry, progress, health, value, cxm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [name, tier || 'Starter', arr || '$0', status || 'Onboarding', owner || req.user.name, renewal || '', industry || '', progress || 0, health || 'Good', value || '$0', cxm || req.user.name]
        );
        const newCustomer = await db.get('SELECT * FROM customers WHERE id = ?', [result.lastID]);
        res.status(201).json(newCustomer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/contracts', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const contracts = await db.all('SELECT * FROM contracts ORDER BY id DESC');
        res.json(contracts);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/contracts', authenticateToken, async (req, res) => {
    try {
        const { id, account, type, value, stage, startDate, date, status } = req.body;
        const db = await getDb();
        await db.run(
            'INSERT INTO contracts (id, account, type, value, stage, startDate, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, account, type, value, stage, startDate, date, status]
        );
        const newContract = await db.get('SELECT * FROM contracts WHERE id = ?', [id]);
        res.status(201).json(newContract);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

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

app.get('/api/connectivity/credentials', authenticateToken, async (req, res) => {
    try {
        const { tool_name } = req.query;
        if (tool_name) {
            const db = await getDb();
            const creds = await db.get('SELECT tool_name, updated_at, client_id, dc, refresh_token, target_module FROM credentials WHERE tool_name = ?', [tool_name]);
            return res.json(creds || {});
        }
        const creds = await getAllCredentials();
        res.json(creds);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch credentials' });
    }
});

app.post('/api/connectivity/credentials', authenticateToken, async (req, res) => {
    try {
        const { tool_name, ...creds } = req.body;
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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
