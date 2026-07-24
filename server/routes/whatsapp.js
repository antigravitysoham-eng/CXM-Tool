import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { config } from '../config.js';
import { whatsappRepo, normalizePhone } from '../repositories/whatsappRepo.js';
import { verifySignature, extractMessages, handleInbound } from '../services/whatsappService.js';

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
});

/* --------------------------------------------------------------------------
 * Public webhook router — mounted BEFORE the global JSON parser so it keeps the
 * raw body for HMAC signature verification. No JWT: Meta authenticates itself
 * with the verify token (GET) and the app-secret signature (POST).
 * ------------------------------------------------------------------------ */
export const whatsappWebhookRouter = express.Router();

// Meta's one-time subscription handshake: echo hub.challenge iff the token matches.
whatsappWebhookRouter.get('/', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token && token === config.whatsapp.verifyToken) {
        return res.status(200).send(String(challenge ?? ''));
    }
    return res.sendStatus(403);
});

// Inbound messages. Raw body (Buffer) so the signature covers the exact bytes.
whatsappWebhookRouter.post('/', express.raw({ type: () => true, limit: '2mb' }), (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
    const sig = verifySignature(raw, req.get('x-hub-signature-256'));
    if (!sig.ok) return res.sendStatus(401);
    if (sig.unverifiable) console.warn('[whatsapp] inbound accepted WITHOUT signature check — set WHATSAPP_APP_SECRET');

    let payload;
    try { payload = JSON.parse(raw.toString('utf8') || '{}'); } catch { return res.sendStatus(400); }

    // Acknowledge immediately — Meta retries anything slower than ~20s, which
    // would double-process. The actual work (ask + reply) runs after the 200.
    res.sendStatus(200);

    const messages = extractMessages(payload);
    for (const m of messages) {
        const text = m.unsupported ? '' : m.text;
        Promise.resolve(handleInbound(m.from, text)).catch((err) =>
            console.error('[whatsapp] handleInbound failed:', err?.message || err));
    }
});

/* --------------------------------------------------------------------------
 * Management router — JWT-protected, JSON. The in-app "link my WhatsApp" screen.
 * Mounted on /api/whatsapp alongside the other v1 modules.
 * ------------------------------------------------------------------------ */
export const whatsappRouter = express.Router();
whatsappRouter.use(authenticateToken);

// Is the channel wired up, and which business number should the user text?
whatsappRouter.get('/status', wrap(async (req, res) => {
    res.json({
        enabled: config.whatsapp.enabled,
        businessNumber: config.whatsapp.businessNumber || null,
        links: await whatsappRepo.listForUser(req.user.id)
    });
}));

// Generate a fresh 6-digit link code for the signed-in user.
whatsappRouter.post('/link-code', wrap(async (req, res) => {
    const { code, expiresAt } = await whatsappRepo.createLinkCode(req.user.id);
    res.json({ code, expiresAt, businessNumber: config.whatsapp.businessNumber || null });
}));

// Numbers linked to me.
whatsappRouter.get('/links', wrap(async (req, res) => {
    res.json(await whatsappRepo.listForUser(req.user.id));
}));

// Drop one of my linked numbers.
whatsappRouter.delete('/links/:phone', wrap(async (req, res) => {
    const removed = await whatsappRepo.unlink(normalizePhone(req.params.phone), req.user.id);
    if (!removed) return res.status(404).json({ error: 'No such linked number' });
    res.json({ ok: true });
}));

// Admin oversight: every verified number and who it belongs to.
whatsappRouter.get('/identities', requireRole('admin', 'manager'), wrap(async (req, res) => {
    res.json(await whatsappRepo.listAll());
}));

export default whatsappRouter;
