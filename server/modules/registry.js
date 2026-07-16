import { accountsModule } from './accountsModule.js';
import { contractsModule } from './contractsModule.js';

// Registry of modules that support export / import / custom-fields / reports.
// Each new module (Health Checks, …) registers here to get the engine for free.
export const modules = {
    accounts: accountsModule,
    contracts: contractsModule
};

export function getModule(key) {
    return modules[key] || null;
}
