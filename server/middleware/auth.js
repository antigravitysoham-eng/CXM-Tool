import jwt from 'jsonwebtoken';
import { config } from '../config.js';

// Verifies the bearer token and attaches { id, email, name, role } to req.user.
export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied' });

    jwt.verify(token, config.jwtSecret, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
}

// Gate a route to specific roles, e.g. requireRole('admin').
export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

// Managers and admins see every account; reps see only the ones they own.
// Returns a { clause, params } fragment callers append to a WHERE.
export function accountScope(user) {
    if (user.role === 'admin' || user.role === 'manager') {
        return { clause: '1=1', params: [] };
    }
    return { clause: 'owner_id = ?', params: [user.id] };
}
