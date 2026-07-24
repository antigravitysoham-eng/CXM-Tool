import { getDb } from '../db.js';

// Attribute-Based Access Control. Access = evaluated from policies (deny-overrides)
// against user attributes + resource attributes. RBAC is just the default policy set.

export const CONDITION_TYPES = ['all', 'own', 'region', 'team', 'segment'];
export const ACTIONS = ['read', 'write', 'delete', 'export'];
export const MODULES = ['*', 'accounts', 'contracts', 'onboarding'];

async function applicablePolicies(role, module, action) {
    const db = await getDb();
    const rows = await db.all('SELECT * FROM policies WHERE role = ? AND (module = ? OR module = ?)', [role, module, '*']);
    return rows.filter((p) => p.actions.split(',').map((s) => s.trim()).includes(action));
}

function conditionMatches(p, user, resource) {
    switch (p.condition_type) {
        case 'all': return true;
        case 'own': return String(resource.owner_id) === String(user.id);
        case 'region': return !!resource.region && resource.region === user.region;
        case 'team': return !!resource.business_unit && resource.business_unit === user.business_unit;
        case 'segment': return (p.condition_value || '').split(',').map((s) => s.trim()).includes(resource.segment);
        default: return false;
    }
}

// SQL scope fragment for list queries on the customers table (accounts).
export async function scope(user, module) {
    const pols = await applicablePolicies(user.role, module, 'read');
    const allows = pols.filter((p) => p.effect === 'allow');
    if (allows.some((p) => p.condition_type === 'all')) return { type: 'all', clause: '1=1', params: [] };
    if (allows.some((p) => p.condition_type === 'region')) return { type: 'region', clause: 'region = ?', params: [user.region || '__none__'] };
    if (allows.some((p) => p.condition_type === 'own')) return { type: 'own', clause: 'owner_id = ?', params: [user.id] };
    return { type: 'none', clause: '1=0', params: [] };
}

/**
 * Module-level check, independent of any single record: may this role touch this
 * module at all? Used to decide which agents a user can see — an agent is a face
 * on a module, so it must not appear to someone with no rights to that module.
 */
/**
 * Parse the users.module_access JSON blob into a plain map, tolerating null,
 * empty, or malformed values (never throws). Call this wherever a user row is
 * turned into the `user` object the access checks see.
 */
export function parseModuleAccess(raw) {
    if (!raw) return {};
    try {
        const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return v && typeof v === 'object' ? v : {};
    } catch {
        return {};
    }
}

export async function canUseModule(user, module, action = 'read') {
    if (!module) return true; // global (NEO) — it can only surface what the user may read anyway
    // Per-user override wins over the role default, in both directions: an admin can
    // revoke a module the role would allow, or grant one the role would not. Only
    // present when the user object has been hydrated with module_access (login,
    // agent-key resolve, WhatsApp resolve); absent → fall through to role policies.
    const override = user.module_access?.[module];
    if (override === 'deny') return false;
    if (override === 'allow') return true;
    const pols = await applicablePolicies(user.role, module, action);
    return pols.some((p) => p.effect === 'allow');
}

export async function canAccess(user, resource, action, module) {
    const pols = await applicablePolicies(user.role, module, action);
    if (pols.filter((p) => p.effect === 'deny').some((p) => conditionMatches(p, user, resource))) return false;
    return pols.filter((p) => p.effect === 'allow').some((p) => conditionMatches(p, user, resource));
}

export const policyRepo = {
    async list() {
        const db = await getDb();
        return db.all('SELECT * FROM policies ORDER BY role, id');
    },
    async create({ name, role, module = '*', actions = [], effect = 'allow', condition_type = 'all', condition_value = '' }) {
        const db = await getDb();
        const r = await db.run(
            'INSERT INTO policies (name, role, module, actions, effect, condition_type, condition_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [name, role, module, (Array.isArray(actions) ? actions.join(',') : actions), effect, condition_type, condition_value, new Date().toISOString()]
        );
        return db.get('SELECT * FROM policies WHERE id = ?', [r.lastID]);
    },
    async remove(id) {
        const db = await getDb();
        await db.run('DELETE FROM policies WHERE id = ?', [id]);
        return { deleted: true };
    }
};
