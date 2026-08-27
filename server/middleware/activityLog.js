import { activityRepo } from '../repositories/activityRepo.js';
import { stripApi, entityFromPath, entityIdFromPath, actionLabel } from '../services/activityLabels.js';

const SKIP = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Records every human write (POST/PATCH/PUT/DELETE) to the activity trail. It
 * registers a res.on('finish') handler up front but reads req.user inside it —
 * by the time the response finishes, the sub-router's authenticateToken has run
 * and populated req.user (agents are skipped; they live in agent_audit).
 */
export function activityLog(req, res, next) {
    res.on('finish', () => {
        try {
            if (SKIP.has(req.method)) return;
            if (req.agent) return;                 // delegated agents → agent_audit
            const user = req.user;
            if (!user || !user.id) return;         // unauthenticated / login failures
            const path = stripApi(req.originalUrl || req.url || '');
            if (/^\/(auth|activity)(\/|$|\?)/.test(path)) return;  // don't log auth or the feed itself
            const entity = entityFromPath(path);
            activityRepo.record({
                actor_id: user.id,
                actor_name: user.name || user.email || 'user',
                role: user.role || 'rep',
                action: actionLabel(req.method, entity),
                entity,
                entity_id: entityIdFromPath(path),
                method: req.method,
                path: path.split('?')[0],
                status: res.statusCode
            });
        } catch { /* never break the response */ }
    });
    next();
}
