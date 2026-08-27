import { TICKET_STATUSES, TICKET_RESOLUTIONS, TICKET_PRIORITIES } from '../validation/supportSchema.js';
import { FEATURE_STATUSES, IMPACTS } from '../data/featureKit.js';

/**
 * Parse and validate the structured update a responder replies with in the CTO
 * group. The contract is deliberately simple and strict: `key: value` pairs,
 * separated by newlines or `|`. An update that doesn't parse, names an unknown
 * field, or gives an out-of-vocabulary value is REJECTED with a message that spells
 * out the exact schema — nothing half-valid is ever applied to a record.
 */

// Case-insensitive match of a value against an allowed set → the canonical spelling.
function canon(value, allowed) {
    const v = String(value || '').trim().toLowerCase();
    return allowed.find((a) => a.toLowerCase() === v) || null;
}

// Break "a: 1 | b: 2\n c: 3" into { a:'1', b:'2', c:'3' } (keys lower-cased).
function parsePairs(text) {
    const pairs = {};
    const chunks = String(text || '').split(/[\n|]+/);
    let any = false;
    for (const chunk of chunks) {
        const m = chunk.match(/^\s*([A-Za-z_ ]+?)\s*[:=]\s*(.+?)\s*$/);
        if (!m) continue;
        pairs[m[1].trim().toLowerCase().replace(/\s+/g, '_')] = m[2].trim();
        any = true;
    }
    return { pairs, any };
}

export const TICKET_UPDATE_SCHEMA =
    'status: <one of: ' + TICKET_STATUSES.join(', ') + '>\n' +
    'resolution: <one of: ' + TICKET_RESOLUTIONS.join(', ') + '> (optional)\n' +
    'priority: <one of: ' + TICKET_PRIORITIES.join(', ') + '> (optional)\n' +
    'note: <free text> (optional)';

export const FEATURE_UPDATE_SCHEMA =
    'status: <one of: ' + FEATURE_STATUSES.join(', ') + '>\n' +
    'impact: <one of: ' + IMPACTS.join(', ') + '> (optional)\n' +
    'note: <free text> (optional)';

/**
 * Validate a ticket update. Returns { ok:true, patch, note } or { ok:false, error }.
 * `patch` only ever contains recognised, in-vocabulary fields.
 */
export function parseTicketUpdate(text) {
    const { pairs, any } = parsePairs(text);
    if (!any) return { ok: false, error: `I couldn't read an update in that. Reply in this format:\n\n${TICKET_UPDATE_SCHEMA}` };

    const patch = {};
    const errors = [];
    for (const [k, v] of Object.entries(pairs)) {
        if (k === 'status') {
            const c = canon(v, TICKET_STATUSES);
            if (!c) errors.push(`"${v}" isn't a valid status. Use one of: ${TICKET_STATUSES.join(', ')}.`);
            else patch.status = c;
        } else if (k === 'resolution') {
            const c = canon(v, TICKET_RESOLUTIONS);
            if (!c) errors.push(`"${v}" isn't a valid resolution. Use one of: ${TICKET_RESOLUTIONS.join(', ')}.`);
            else patch.resolution = c;
        } else if (k === 'priority') {
            const c = canon(v, TICKET_PRIORITIES);
            if (!c) errors.push(`"${v}" isn't a valid priority. Use one of: ${TICKET_PRIORITIES.join(', ')}.`);
            else patch.priority = c;
        } else if (k === 'note' || k === 'comment' || k === 'update') {
            patch.__note = v;
        } else {
            errors.push(`"${k}" isn't an updatable field.`);
        }
    }
    if (errors.length) return { ok: false, error: `${errors.join('\n')}\n\nExpected:\n${TICKET_UPDATE_SCHEMA}` };

    const note = patch.__note; delete patch.__note;
    if (!Object.keys(patch).length && !note) return { ok: false, error: `Nothing to update. Reply in this format:\n\n${TICKET_UPDATE_SCHEMA}` };
    return { ok: true, patch, note: note || '' };
}

/** Validate a feature update. Returns { ok:true, patch, note } or { ok:false, error }. */
export function parseFeatureUpdate(text) {
    const { pairs, any } = parsePairs(text);
    if (!any) return { ok: false, error: `I couldn't read an update in that. Reply in this format:\n\n${FEATURE_UPDATE_SCHEMA}` };

    const patch = {};
    const errors = [];
    for (const [k, v] of Object.entries(pairs)) {
        if (k === 'status') {
            const c = canon(v, FEATURE_STATUSES);
            if (!c) errors.push(`"${v}" isn't a valid status. Use one of: ${FEATURE_STATUSES.join(', ')}.`);
            else patch.status = c;
        } else if (k === 'impact') {
            const c = canon(v, IMPACTS);
            if (!c) errors.push(`"${v}" isn't a valid impact. Use one of: ${IMPACTS.join(', ')}.`);
            else patch.impact = c;
        } else if (k === 'note' || k === 'comment' || k === 'update') {
            patch.__note = v;
        } else {
            errors.push(`"${k}" isn't an updatable field.`);
        }
    }
    if (errors.length) return { ok: false, error: `${errors.join('\n')}\n\nExpected:\n${FEATURE_UPDATE_SCHEMA}` };

    const note = patch.__note; delete patch.__note;
    if (!Object.keys(patch).length && !note) return { ok: false, error: `Nothing to update. Reply in this format:\n\n${FEATURE_UPDATE_SCHEMA}` };
    return { ok: true, patch, note: note || '' };
}
