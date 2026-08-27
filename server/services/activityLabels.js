// Turn an API request into human-readable Activity Log fields.

const ENTITY_MAP = {
    accounts: 'account', contracts: 'contract', invoices: 'invoice', documents: 'document',
    onboarding: 'onboarding', support: 'support ticket', training: 'training', 'health-checks': 'health check',
    ebrs: 'EBR', surveys: 'survey', 'feature-requests': 'feature request', upsells: 'upsell', referrals: 'referral',
    journey: 'journey', comms: 'comms campaign', events: 'event', users: 'user', 'agent-keys': 'agent key',
    'custom-fields': 'custom field', connectors: 'connector', data: 'data import', whatsapp: 'WhatsApp', neo: 'NEO'
};

// Strip the /api or /api/v1 mount prefix so paths read cleanly.
export const stripApi = (p) => String(p || '').replace(/^\/api(\/v1)?/, '') || '/';

const firstSeg = (path) => stripApi(path).replace(/^\/+/, '').split(/[/?]/)[0];

export function entityFromPath(path) {
    const seg = firstSeg(path);
    return ENTITY_MAP[seg] || seg || 'record';
}

// The id after the entity, when it looks like one (numeric or CTR-2026-… style).
export function entityIdFromPath(path) {
    const parts = stripApi(path).split('?')[0].split('/').filter(Boolean);
    const cand = parts[1] || '';
    return /^[0-9]+$/.test(cand) || /^[A-Z]{2,}-/.test(cand) ? cand : '';
}

export function actionLabel(method, entity) {
    const verb = method === 'POST' ? 'Created'
        : method === 'DELETE' ? 'Deleted'
            : (method === 'PATCH' || method === 'PUT') ? 'Updated' : method;
    return `${verb} ${entity}`;
}
