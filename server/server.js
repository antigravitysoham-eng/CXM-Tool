import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { getDb } from './db.js';

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
        const { name, tier, arr, status, owner, renewal } = req.body;
        const db = await getDb();
        const result = await db.run(
            'INSERT INTO customers (name, tier, arr, status, owner, renewal) VALUES (?, ?, ?, ?, ?, ?)',
            [name, tier || 'Starter', arr || '$0', status || 'Onboarding', owner || req.user.name, renewal || '']
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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
