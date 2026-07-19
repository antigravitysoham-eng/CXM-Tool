/**
 * Compass — customer lifecycle stages.
 *
 * The happy path runs Onboarding -> Adoption -> Value -> Growth -> Renewal ->
 * Advocacy. "At Risk" is off-path — a customer that's slipping regardless of
 * where they were. A customer sitting in a stage past its expected days is
 * "stalled" and needs a nudge.
 */
export const JOURNEY_STAGES = ['Onboarding', 'Adoption', 'Value', 'Growth', 'Renewal', 'Advocacy', 'At Risk'];
export const LIFECYCLE_PATH = ['Onboarding', 'Adoption', 'Value', 'Growth', 'Renewal', 'Advocacy'];
export const JOURNEY_HEALTHS = ['Good', 'Watch', 'Poor'];

// Days a customer is expected to spend in a stage before it counts as stalled.
export const STAGE_MAX_DAYS = {
    Onboarding: 60, Adoption: 90, Value: 120, Growth: 180, Renewal: 45, Advocacy: 365, 'At Risk': 30
};

export function isStalled(stage, daysInStage) {
    return daysInStage > (STAGE_MAX_DAYS[stage] ?? 120);
}

/**
 * Module-usage bands for the adoption view. A 0-100 usage score maps to a band;
 * Dormant modules are the ones a health-check call should dig into.
 */
export const ADOPTION_BANDS = ['Power user', 'Active', 'Light', 'Dormant'];
export function adoptionBand(score) {
    if (score === null || score === undefined) return 'Not measured';
    if (score >= 75) return 'Power user';
    if (score >= 40) return 'Active';
    if (score >= 10) return 'Light';
    return 'Dormant';
}
