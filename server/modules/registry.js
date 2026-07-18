import { accountsModule } from './accountsModule.js';
import { contractsModule } from './contractsModule.js';
import {
    onboardingModule, supportModule, trainingModule,
    documentsModule, healthModule, ebrModule, surveysModule, featuresModule, upsellsModule, referralsModule, journeyModule,
    commsModule, eventsModule
} from './liveModules.js';

// Registry of modules that support export / import / custom-fields / reports.
// Accounts + Contracts are full modules (custom fields, import); the rest are
// report-first (Excel export + executive report), registered here so every
// module page gets the reporting engine.
export const modules = {
    accounts: accountsModule,
    contracts: contractsModule,
    onboarding: onboardingModule,
    support: supportModule,
    training: trainingModule,
    documents: documentsModule,
    'health-checks': healthModule,
    ebrs: ebrModule,
    surveys: surveysModule,
    'feature-requests': featuresModule,
    upsells: upsellsModule,
    referrals: referralsModule,
    journey: journeyModule,
    comms: commsModule,
    events: eventsModule
};

export function getModule(key) {
    return modules[key] || null;
}
