import { describe, it, expect } from 'vitest';
import { proratedAmount, overlapMonths, isRangeActive } from '../services/revenueService.js';

describe('revenueService — pro-rated revenue recognition', () => {
    it('returns the full value when no range is active (All time)', () => {
        expect(proratedAmount(1000000, { engagement_start: '2026-01-01' }, {})).toBe(1000000);
        expect(proratedAmount(1000000, { engagement_start: '2026-01-01' }, { from: '', to: '' })).toBe(1000000);
    });

    it('returns the full value when there is no engagement start (cannot pro-rate)', () => {
        expect(proratedAmount(1000000, {}, { from: '2026-01-01', to: '2026-12-31' })).toBe(1000000);
    });

    it('the headline example: 10L annual, started mid-year, 1-year range ≈ 5L', () => {
        // Engagement starts 1 Jul; recognise across the calendar year 1 Jan–31 Dec.
        // Overlap = 1 Jul → 31 Dec ≈ 6 months → half of the annual value.
        const v = proratedAmount(1000000, { engagement_start: '2026-07-01', value_basis: 'Annual', term_months: 12 },
            { from: '2026-01-01', to: '2026-12-31' });
        expect(Math.round(v / 1000)).toBeGreaterThanOrEqual(495); // ~5.0 L, day-accurate
        expect(Math.round(v / 1000)).toBeLessThanOrEqual(510);
    });

    it('annual value fully inside a range recognises the whole year', () => {
        // A full calendar year (1 Jan → 31 Dec is 364 days) after the start.
        const v = proratedAmount(1200000, { engagement_start: '2025-01-01', value_basis: 'Annual', term_months: 12 },
            { from: '2026-01-01', to: '2026-12-31' });
        expect(v).toBeGreaterThanOrEqual(1190000); // ≈12L, day-accurate
        expect(v).toBeLessThanOrEqual(1200000);
    });

    it('Total basis spreads the whole-term amount over the term', () => {
        // 30L total over 36 months. A full 1-year slice recognises ~10L.
        const oneYear = proratedAmount(3000000, { engagement_start: '2026-01-01', value_basis: 'Total', term_months: 36 },
            { from: '2026-01-01', to: '2026-12-31' });
        expect(Math.round(oneYear / 100000)).toBe(10); // ≈10.0 L
        // The full 3-year window recognises (almost) the entire total.
        const whole = proratedAmount(3000000, { engagement_start: '2026-01-01', value_basis: 'Total', term_months: 36 },
            { from: '2026-01-01', to: '2028-12-31' });
        expect(whole).toBeGreaterThanOrEqual(2950000);
        expect(whole).toBeLessThanOrEqual(3000000);
    });

    it('nothing is recognised before the engagement starts or after a Total term ends', () => {
        const before = proratedAmount(1000000, { engagement_start: '2027-01-01', value_basis: 'Annual' },
            { from: '2026-01-01', to: '2026-12-31' });
        expect(before).toBe(0);
        const after = proratedAmount(1000000, { engagement_start: '2020-01-01', value_basis: 'Total', term_months: 12 },
            { from: '2026-01-01', to: '2026-12-31' });
        expect(after).toBe(0);
    });

    it('helpers behave', () => {
        expect(isRangeActive({ from: '2026-01-01' })).toBe(true);
        expect(isRangeActive({})).toBe(false);
        expect(overlapMonths({}, { from: '2026-01-01', to: '2026-12-31' })).toBeNull();
    });
});
