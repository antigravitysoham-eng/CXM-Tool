import { accountRepo } from '../repositories/accountRepo.js';
import { customFieldRepo } from '../repositories/customFieldRepo.js';
import { userRepo } from '../repositories/userRepo.js';
import { createAccountSchema, updateAccountSchema, validate } from '../validation/accountSchema.js';

/**
 * Execute an approved agent proposal.
 *
 * The write runs AS THE GRANTING USER, loaded live at approval time, and goes
 * through the exact same repository call — with the same ABAC scoping and the
 * same validation — that a person filling in the form would hit. The human
 * approving the proposal is the reviewer; the delegator is still the actor, so a
 * proposal can never do more than that delegator could do themselves, even if
 * their access shrank between filing and approval.
 *
 * Each op_id maps to one repository action. Adding a write operation to the
 * catalogue means adding a case here — deliberately explicit, so no route becomes
 * agent-writable by accident.
 */

// Pull a numeric id out of a concrete path like '/accounts/123'.
function idFromPath(path) {
    const m = String(path).match(/\/(\d+)(?:\/|$)/);
    return m ? Number(m[1]) : null;
}

export async function executeProposal(proposal) {
    // The delegator's current claims — not a snapshot from when the agent filed.
    const user = await userRepo.get(proposal.user_id);
    if (!user) { const e = new Error('The granting user no longer exists.'); e.status = 400; throw e; }

    const body = proposal.body || {};

    switch (proposal.op_id) {
        case 'createAccount': {
            const data = validate(createAccountSchema, body);
            const defs = await customFieldRepo.listDefs('accounts');
            data.custom_fields = customFieldRepo.coerceValues(defs, body.custom_fields || {});
            const account = await accountRepo.create(data, user);
            return { ok: true, account };
        }
        case 'updateAccount': {
            const id = idFromPath(proposal.path);
            if (!id) { const e = new Error('Proposal is missing a valid account id.'); e.status = 400; throw e; }
            const data = validate(updateAccountSchema, body);
            if (body.custom_fields) {
                const defs = await customFieldRepo.listDefs('accounts');
                data.custom_fields = customFieldRepo.coerceValues(defs, body.custom_fields);
            }
            const r = await accountRepo.update(id, data, user);
            if (r.notFound) { const e = new Error('Account not found.'); e.status = 404; throw e; }
            if (r.forbidden) { const e = new Error('The granting user cannot modify that account.'); e.status = 403; throw e; }
            return { ok: true, account: r.account };
        }
        default: {
            const e = new Error(`No executor for operation '${proposal.op_id}'.`);
            e.status = 400;
            throw e;
        }
    }
}
