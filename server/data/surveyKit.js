/**
 * Echo — voice-of-customer survey scoring.
 *
 * Three instruments, each with its own scale and its own idea of "good":
 *   NPS  0-10  — promoter 9-10, passive 7-8, detractor 0-6; NPS = %promoter - %detractor
 *   CSAT 1-5   — satisfied when score >= 4; CSAT% = % satisfied
 *   CES  1-7   — effort score, LOWER is better; "low effort" when score <= 2
 *
 * Sentiment is normalised across instruments so the portfolio can mix them.
 */
export const SURVEY_TYPES = ['NPS', 'CSAT', 'CES'];
export const SURVEY_STATUSES = ['Draft', 'Live', 'Closed'];
export const SENTIMENTS = ['Positive', 'Neutral', 'Negative'];

export const SCORE_RANGE = { NPS: [0, 10], CSAT: [1, 5], CES: [1, 7] };
export const DEFAULT_QUESTION = {
    NPS: 'How likely are you to recommend us to a colleague? (0-10)',
    CSAT: 'How satisfied are you with the service? (1-5)',
    CES: 'How much effort did you have to put in to get this resolved? (1-7)'
};

export function sentimentFor(type, score) {
    const s = Number(score);
    if (type === 'NPS') return s >= 9 ? 'Positive' : s >= 7 ? 'Neutral' : 'Negative';
    if (type === 'CSAT') return s >= 4 ? 'Positive' : s === 3 ? 'Neutral' : 'Negative';
    if (type === 'CES') return s <= 2 ? 'Positive' : s <= 4 ? 'Neutral' : 'Negative';
    return 'Neutral';
}

// NPS category for an individual 0-10 response.
export function npsBand(score) {
    const s = Number(score);
    return s >= 9 ? 'Promoter' : s >= 7 ? 'Passive' : 'Detractor';
}

/** Roll a set of responses (each {type, score}) into a headline score by type. */
export function scoreSummary(responses) {
    const nps = responses.filter((r) => r.type === 'NPS');
    const csat = responses.filter((r) => r.type === 'CSAT');
    const ces = responses.filter((r) => r.type === 'CES');
    const npsScore = nps.length
        ? Math.round(((nps.filter((r) => r.score >= 9).length - nps.filter((r) => r.score <= 6).length) / nps.length) * 100)
        : null;
    const csatPct = csat.length ? Math.round((csat.filter((r) => r.score >= 4).length / csat.length) * 100) : null;
    const cesAvg = ces.length ? Math.round((ces.reduce((s, r) => s + r.score, 0) / ces.length) * 10) / 10 : null;
    return { npsScore, csatPct, cesAvg, nps: nps.length, csat: csat.length, ces: ces.length };
}
