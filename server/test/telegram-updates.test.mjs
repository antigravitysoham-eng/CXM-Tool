import { describe, it, expect } from 'vitest';
import { parseTicketUpdate, parseFeatureUpdate } from '../services/telegramUpdateSchema.js';

describe('telegram relay — responder update schema', () => {
    it('parses and validates ticket + feature updates strictly', () => {
        const fail = [];
        const ok = (c, m) => { if (c) console.log('  ✓ ' + m); else { console.log('  ✗ ' + m); fail.push(m); } };

        // ---- valid ticket update (pipe-separated) ----
        const t1 = parseTicketUpdate('status: Dev Pending | resolution: Bug Fix | note: fixed in 1.2');
        ok(t1.ok && t1.patch.status === 'Dev Pending' && t1.patch.resolution === 'Bug Fix' && t1.note === 'fixed in 1.2',
            'valid ticket update parses status + resolution + note');

        // ---- case-insensitive value, newline-separated ----
        const t2 = parseTicketUpdate('Status: solution accepted\npriority: high');
        ok(t2.ok && t2.patch.status === 'Solution Accepted' && t2.patch.priority === 'High',
            'canonicalises case + accepts newlines');

        // ---- invalid status is refused with the schema ----
        const t3 = parseTicketUpdate('status: Frobnicate');
        ok(!t3.ok && /valid status/.test(t3.error), 'an out-of-vocabulary status is refused');

        // ---- unknown field is refused ----
        const t4 = parseTicketUpdate('severity: high');
        ok(!t4.ok && /isn't an updatable field/.test(t4.error), 'an unknown field is refused');

        // ---- unparseable text is refused ----
        const t5 = parseTicketUpdate('yeah we fixed it');
        ok(!t5.ok && /this format/.test(t5.error), 'free prose with no key:value is refused');

        // ---- note-only is allowed ----
        const t6 = parseTicketUpdate('note: waiting on customer logs');
        ok(t6.ok && t6.note === 'waiting on customer logs' && !Object.keys(t6.patch).length, 'a note-only update is allowed');

        // ---- feature update vocabulary is separate ----
        const f1 = parseFeatureUpdate('status: Planned | impact: High | note: Q3 roadmap');
        ok(f1.ok && f1.patch.status === 'Planned' && f1.patch.impact === 'High', 'valid feature update parses status + impact');
        const f2 = parseFeatureUpdate('status: Dev Pending'); // ticket status, not a feature status
        ok(!f2.ok && /valid status/.test(f2.error), 'a ticket status is rejected for a feature');

        expect(fail, fail.join('\n')).toEqual([]);
    });
});
