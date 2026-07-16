import { accountsModule } from './accountsModule.js';

// Registry of modules that support export / import / custom-fields / reports.
// Each new module (CLM, Health Checks, …) registers here to get the engine for free.
export const modules = {
    accounts: accountsModule
};

export function getModule(key) {
    return modules[key] || null;
}
