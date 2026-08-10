import { contractRepo } from '../repositories/contractRepo.js';
import { scopeRepo } from '../repositories/scopeRepo.js';
import { SUPPORT_TIERS } from '../validation/contractSchema.js';

// A won account (Account Status = Customer) carries its commercial terms on the
// account itself (Cash Horizon): value, currency, engagement start, term, basis,
// products, owner, CSM. But every value headline in the app — CLM "value under
// management", Dashboard ARR, CSM scorecards, invoices — reads the CONTRACTS
// table. Without a contract, a won customer shows ₹0 everywhere. This service
// provisions that contract from the account so the data the user already entered
// reflects throughout, instead of forcing a re-entry in CLM.

/**
 * Map an account's Value Amount into contract money (whole-rupee integers, same
 * currency). Annual = value is the yearly run-rate; Total = value is the whole
 * term. TCV is the full-term amount, ARR the yearly, MRR the monthly.
 */
export function accountToContractMoney(account) {
    const value = Math.max(0, Math.round(Number(account.value_amount) || 0));
    const term = Math.max(1, Math.round(Number(account.term_months) || 12));
    const isTotal = account.value_basis === 'Total';
    const arr = isTotal ? Math.round((value * 12) / term) : value;
    const tcv = isTotal ? value : Math.round((value * term) / 12);
    const mrr = Math.round(arr / 12);
    return { tcv, arr, mrr, term };
}

/**
 * Ensure a won account has a contract in CLM, seeded from the account. Idempotent:
 * does nothing if the account isn't a Customer or already has a contract. Returns
 * the created contract, or null when nothing was created.
 */
export async function ensureContractForAccount(account, user) {
    if (!account || account.segment !== 'Customer') return null;

    // Never duplicate — if any contract already exists for this account, leave it.
    const existing = await contractRepo.list({ account: account.name }, user);
    if (Array.isArray(existing) && existing.length) return null;

    const { tcv, arr, mrr, term } = accountToContractMoney(account);
    const supportTier = SUPPORT_TIERS.includes(account.tier) ? account.tier : 'Standard';

    const contract = await contractRepo.create({
        account: account.name,
        type: 'New Business',
        status: 'Active',
        currency: account.value_currency || 'INR',
        tcv, arr, mrr,
        term_months: term,
        start_date: account.engagement_start || '',
        end_date: account.renewal || '',
        renewal_date: account.renewal || '',
        deployment: 'SaaS',
        license_type: 'Subscription',
        billing_frequency: 'Yearly',
        support_tier: supportTier,
        payment_terms: 'Net 30',
        csm_name: account.cxm || '',
        owner: account.sales_owner || '',
        am_name: account.sales_owner || '',
        notes: 'Auto-created when the account was won — synced from Cash Horizon. Edit terms here as needed.'
    });

    // Carry the account's opted products into the formal contract scope so
    // onboarding/enablement (which read contract_products) see them too.
    try {
        const accScope = await scopeRepo.listAccountScope(user, account.name);
        const items = (accScope || []).map((s) => ({
            product_key: s.product_key, unit_count: s.unit_count || 1, items: s.items || []
        }));
        if (items.length) await scopeRepo.setScope(contract.id, items, user);
    } catch {
        // Scope carry-over is best-effort; the contract itself is what matters.
    }

    return contract;
}

/**
 * Backfill: provision contracts for every Customer account that doesn't have one.
 * Used once after enabling auto-sync (and safe to re-run — it skips any that
 * already have a contract). `accounts` is the caller-scoped account list.
 */
export async function backfillContractsForCustomers(accounts, user) {
    const created = [];
    for (const a of accounts.filter((x) => x.segment === 'Customer')) {
        const c = await ensureContractForAccount(a, user);
        if (c) created.push({ account: a.name, contractId: c.id, tcv: c.tcv, arr: c.arr });
    }
    return created;
}
