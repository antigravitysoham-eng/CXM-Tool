import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { config } from '../config.js';
import { whatsappRepo } from '../repositories/whatsappRepo.js';
import { telegramRepo } from '../repositories/telegramRepo.js';
import { getAssistantUsername } from '../services/telegramAssistantService.js';

/**
 * In-app linking for the Telegram assistant, mirroring the WhatsApp link screen.
 * The link code is the same one-time code WhatsApp uses (channel-agnostic), so a
 * user generates it once and can bind either channel with it.
 */

const router = express.Router();
router.use(authenticateToken);

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
});

router.get('/status', wrap(async (req, res) => {
    const links = await telegramRepo.listForUser(req.user.id);
    res.json({
        enabled: config.telegram.assistantEnabled,
        username: getAssistantUsername(),
        activated: links.length > 0,
        links
    });
}));

router.post('/link-code', wrap(async (req, res) => {
    const { code, expiresAt } = await whatsappRepo.createLinkCode(req.user.id);
    res.json({ code, expiresAt, username: getAssistantUsername() });
}));

router.delete('/unlink/:telegramId', wrap(async (req, res) => {
    const ok = await telegramRepo.unlink(req.params.telegramId, req.user.id);
    res.json({ unlinked: ok });
}));

export default router;
