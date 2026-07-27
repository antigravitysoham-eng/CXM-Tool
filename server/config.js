import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Centralised config. Secrets come from the environment (.env locally);
// there is no hardcoded fallback for JWT_SECRET so a missing secret fails loud.
if (!process.env.JWT_SECRET) {
    throw new Error(
        'JWT_SECRET is not set. Copy server/.env.example to server/.env and set a value ' +
        '(node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))").'
    );
}

const bool = (v, fallback = false) => {
    if (v === undefined || v === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
};

const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

const isProd = (process.env.NODE_ENV || 'development') === 'production';

// A short secret is a guessable secret. Refuse to start on one in production
// rather than sign tokens nobody can trust.
if (isProd && String(process.env.JWT_SECRET).length < 32) {
    throw new Error('JWT_SECRET is too short for production — use at least 32 characters of random hex.');
}

export const config = {
    env: process.env.NODE_ENV || 'development',
    isProd,
    port: Number(process.env.PORT) || 5000,

    // Absolute, so the database doesn't depend on the working directory. Point
    // DB_PATH at a mounted volume in production.
    dbPath: process.env.DB_PATH || path.join(here, 'cx_tool.sqlite'),
    jwtSecret: process.env.JWT_SECRET,
    // Sessions last 6 hours; the app auto-logs-out when the token expires.
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '6h',
    fxUsdInr: Number(process.env.FX_USD_INR) || 83,

    /**
     * Origins allowed to call the API. Empty = same-origin only, which is the
     * right default once the built frontend is served by this server.
     * A future mobile app sends no Origin header, so it is unaffected by CORS.
     */
    corsOrigins: list(process.env.CORS_ORIGINS),

    // Anyone able to reach the host could otherwise mint themselves an account.
    // Off unless deliberately switched on for a demo.
    allowSelfRegistration: bool(process.env.ALLOW_SELF_REGISTRATION, false),

    // Serve the built SPA from this server — one process, one port to host.
    serveStatic: bool(process.env.SERVE_STATIC, isProd),

    rateLimit: {
        windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
        max: Number(process.env.RATE_LIMIT_MAX) || 600,
        authMax: Number(process.env.RATE_LIMIT_AUTH_MAX) || 10
    },

    minPasswordLength: Number(process.env.MIN_PASSWORD_LENGTH) || 10,

    // How long an agent's session lease survives without a request before another
    // key for the same (user, agent identity) may take over. Short enough that a
    // crashed agent frees the identity soon; long enough that normal gaps between
    // calls don't drop it.
    agentLeaseTtlMs: Number(process.env.AGENT_LEASE_TTL_MS) || 90000,

    // Base URL written into generated agent manifests. Empty = derive from the
    // request (right in most setups); set it when the public URL differs from
    // what the server sees (e.g. behind a rewriting proxy).
    agentApiBaseUrl: process.env.AGENT_API_BASE_URL || '',

    // Trust the first proxy hop so rate limiting keys on the real client IP
    // rather than the load balancer's.
    trustProxy: bool(process.env.TRUST_PROXY, isProd),

    /**
     * WhatsApp Cloud API (Meta). The bot answers prompts texted from a linked
     * number, scoped to the user that number belongs to.
     *  - token        : permanent/system-user access token for the Graph API
     *  - phoneId      : the WhatsApp phone-number id messages are sent from
     *  - verifyToken  : shared secret Meta echoes back when registering the webhook
     *  - appSecret    : app secret used to HMAC-verify inbound webhook payloads
     * Absent token+phoneId, the feature is dormant: the webhook still 200s (so Meta
     * stops retrying) but nothing is sent, and the link endpoints report disabled.
     */
    whatsapp: {
        token: process.env.WHATSAPP_TOKEN || '',
        phoneId: process.env.WHATSAPP_PHONE_ID || '',
        verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
        appSecret: process.env.WHATSAPP_APP_SECRET || '',
        graphVersion: process.env.WHATSAPP_GRAPH_VERSION || 'v21.0',
        // The business number shown to users in the link screen ("text this number").
        businessNumber: process.env.WHATSAPP_BUSINESS_NUMBER || '',
        get enabled() { return Boolean(this.token && this.phoneId); }
    },
    // Telegram relay — forwards bug tickets and feature-request details to a chat
    // (e.g. the CTO's). A bot token from @BotFather plus the target chat id. Both
    // secrets live only in .env; when unset the relay is a graceful no-op.
    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN || '',
        // Default destination — the CTO's chat/channel that takes bug + feature routing.
        ctoChatId: process.env.TELEGRAM_CTO_CHAT_ID || '',
        apiBase: process.env.TELEGRAM_API_BASE || 'https://api.telegram.org',
        get enabled() { return Boolean(this.botToken && this.ctoChatId); }
    }
};
