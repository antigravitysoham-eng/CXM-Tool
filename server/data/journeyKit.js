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
