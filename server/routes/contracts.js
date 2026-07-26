import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { contractRepo } from '../repositories/contractRepo.js';
import { scopeRepo } from '../repositories/scopeRepo.js';
import { trainingRepo } from '../repositories/trainingRepo.js';
import { PRODUCTS } from '../data/products.js';
import { setScopeSchema } from '../validation/scopeSchema.js';
import { accountRepo } from '../repositories/accountRepo.js';
import { upcomingTriggers } from '../services/renewalService.js';
import { recommendCsm } from '../services/assignmentService.js';
import { validate } from '../validation/accountSchema.js';
import {
    createContractSchema, updateContractSchema, documentSchema, contactSchema,
    CONTRACT_TYPES, CONTRACT_STATUSES, DEPLOYMENTS, LICENSE_TYPES, BILLING_FREQUENCIES, SUPPORT_TIERS, CURRENCIES, DOC_TYPES
} from '../validation/contractSchema.js';

const router = express.Router();
router.use(authenticateToken);

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
});

function periodFrom(q) {
    if (!q.period_field) return null;
    return { field: q.period_field, from: q.period_from || '', to: q.period_to || '' };
}

// List with optional filters + period.
router.get('/', wrap(async (req, res) => {
    const { account, status, deployment, license_type } = req.query;
    res.json(await contractRepo.list({ account, status, deployment, license_type, period: periodFrom(req.query) }, req.user));
}));

router.get('/meta', wrap(async (req, res) => {
    res.json({
        types: CONTRACT_TYPES, statuses: CONTRACT_STATUSES, deployments: DEPLOYMENTS,
        licenseTypes: LICENSE_TYPES, billingFrequencies: BILLING_FREQUENCIES, supportTiers: SUPPORT_TIERS,
        currencies: CURRENCIES, docTypes: DOC_TYPES, products: PRODUCTS, role: req.user.role
    });
}));

// ---- product scope ----
// What the customer bought, and at what size. Onboarding Stage 2 builds its
// enablement checklist straight from this, so nobody re-types the frameworks.
router.get('/:id/scope', wrap(async (req, res) => {
    res.json(await scopeRepo.listScope(req.user, { contract_id: req.params.id }));
}));

router.put('/:id/scope', wrap(async (req, res) => {
    const { products } = validate(setScopeSchema, req.body);
    const r = await scopeRepo.setScope(req.params.id, products, req.user);
    if (r.notFound) return res.status(404).json({ error: 'Contract not found — or outside your access' });
    res.json(r.scope);
}));

// Everything an account has bought, across all of its contracts.
router.get('/account-scope/:account', wrap(async (req, res) => {
    res.json(await scopeRepo.listScope(req.user, { account: req.params.account }));
}));

// Contracts inside a 90/60/30 window, each with the two generated emails.
router.get('/renewal-triggers', wrap(async (req, res) => {
    const contracts = await contractRepo.list({}, req.user);
    res.json(upcomingTriggers(contracts));
}));

// Customer-centric view: every Cash Horizon Customer flows into CLM, joined
// with their contract rollup. Accounts with no contract yet show hasContract=false.
router.get('/customers', wrap(async (req, res) => {
    const accounts = await accountRepo.list(req.user);
    const contracts = await contractRepo.list({}, req.user);
    // All invoices the caller can see, grouped by account, so we can show — per
    // customer — whether their invoices are being raised and paid on time.
    const invoices = await scopeRepo.listInvoices(req.user, {});
    const invByAccount = invoices.reduce((m, i) => { (m[i.account] ||= []).push(i); return m; }, {});
    const training = await trainingRepo.courseAvailabilityMap();
    const trainingRev = await trainingRepo.revenueByAccount();
    const toInr = (c) => (c.currency === 'INR' ? c.tcv : c.tcv * 83) || 0;
    // Terminal statuses aren't "under management" — their value is churned, not live.
    const TERMINAL = new Set(['Expired', 'Churned', 'Cancelled', 'Terminated']);
    const paidLate = (i) => i.stored_status === 'Paid' && i.paid_date && i.due_date && i.paid_date > i.due_date;

    const customers = accounts.filter((a) => a.segment === 'Customer').map((a) => {
        const cs = contracts.filter((c) => c.account === a.name);
        const upcoming = cs.filter((c) => c.days_to_renewal !== null && c.days_to_renewal <= 90)
            .sort((x, y) => x.days_to_renewal - y.days_to_renewal)[0] || null;

        const inv = invByAccount[a.name] || [];
        const raised = inv.filter((i) => !['Draft', 'Cancelled'].includes(i.stored_status));
        const paid = inv.filter((i) => i.stored_status === 'Paid');
        const overdueCount = inv.filter((i) => i.overdue).length;
        const paidLateCount = inv.filter(paidLate).length;
        const outstanding = inv.filter((i) => !['Paid', 'Cancelled'].includes(i.stored_status)).length;
        // The KRI: 'none' (no invoices), 'ontime' (raised, nothing overdue or paid
        // late), or 'atrisk' (something overdue or paid late — the critical case).
        const invoiceKri = inv.length === 0 ? 'none'
            : (overdueCount > 0 || paidLateCount > 0) ? 'atrisk' : 'ontime';

        return {
            name: a.name, industry: a.industry, tier: a.tier, health: a.health,
            cxm: a.cxm, sales_owner: a.sales_owner, value_currency: a.value_currency, account_value: a.value_amount,
            contractCount: cs.length,
            // "Under management" = live contracts only; churned/expired tracked apart.
            totalValueInr: cs.filter((c) => !TERMINAL.has(c.status)).reduce((s, c) => s + toInr(c), 0),
            churnedValueInr: cs.filter((c) => TERMINAL.has(c.status)).reduce((s, c) => s + toInr(c), 0),
            churnedCount: cs.filter((c) => TERMINAL.has(c.status)).length,
            // A churned ACCOUNT = had contract value, now none of it is live. This
            // distinguishes a fully-lost customer from one with a mix of live +
            // churned contracts (an upsell/renewal churn, not a lost logo).
            isChurned: cs.length > 0
                && cs.some((c) => TERMINAL.has(c.status))
                && cs.filter((c) => !TERMINAL.has(c.status)).reduce((s, c) => s + toInr(c), 0) === 0,
            nextRenewalDate: upcoming ? upcoming.renewal_date : null,
            nextRenewalDays: upcoming ? upcoming.days_to_renewal : null,
            renewalBucket: upcoming ? upcoming.renewal_bucket : (cs.length ? 'healthy' : 'none'),
            autoRenew: cs.some((c) => c.auto_renew),
            hasContract: cs.length > 0,
            // Invoice activity + on-time KRI.
            invoiceCount: inv.length,
            invoicesRaised: raised.length,
            invoicesPaid: paid.length,
            invoicesOutstanding: outstanding,
            invoicesOverdue: overdueCount,
            invoicesPaidLate: paidLateCount,
            invoiceKri,
            // Training: courses this customer is entitled to (opted modules + platform).
            trainingCourseCount: (training.byAccount[a.name]?.count ?? training.platformCount),
            trainingModules: training.byAccount[a.name]?.modules || [],
            trainingRevenueInr: trainingRev[a.name] || 0
        };
    });
    res.json(customers);
}));

router.get('/customer-360/:account', wrap(async (req, res) => {
    const detail = await contractRepo.customer360(req.params.account, req.user);
    if (!detail) return res.status(404).json({ error: 'Account not found — or outside your access' });
    res.json(detail);
}));

router.post('/seed-sample', requireRole('admin'), wrap(async (req, res) => {
    res.json(await contractRepo.seedSample());
}));

// Advisory CSM assignment: recommend who should own an account. CX lead decides.
router.post('/assignment-advice', wrap(async (req, res) => {
    const accounts = await accountRepo.list(req.user);
    const contracts = await contractRepo.list({}, req.user);
    let { industry = '', tier = '', account = '' } = req.body || {};
    if (account) {
        const match = accounts.find((a) => a.name.toLowerCase() === String(account).toLowerCase());
        if (match) { industry = industry || match.industry; tier = tier || match.tier; }
    }
    res.json(recommendCsm({ industry, tier }, accounts, contracts));
}));

router.post('/', wrap(async (req, res) => {
    const data = validate(createContractSchema, req.body);
    res.status(201).json(await contractRepo.create(data));
}));

// ---- documents ----
router.get('/:id/documents', wrap(async (req, res) => {
    const contract = await contractRepo.get(req.params.id, req.user);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    res.json(await contractRepo.listDocuments({ contract_id: req.params.id }));
}));
router.post('/:id/documents', wrap(async (req, res) => {
    const contract = await contractRepo.get(req.params.id, req.user);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    const data = validate(documentSchema, { ...req.body, contract_id: req.params.id, account: contract.account });
    res.status(201).json(await contractRepo.addDocument(data));
}));
router.delete('/documents/:docId', wrap(async (req, res) => {
    res.json(await contractRepo.removeDocument(Number(req.params.docId)));
}));

// ---- customer contacts (multiple SPOCs) ----
router.post('/contacts', wrap(async (req, res) => {
    const data = validate(contactSchema, req.body);
    res.status(201).json(await contractRepo.addContact(data));
}));
router.delete('/contacts/:id', wrap(async (req, res) => {
    res.json(await contractRepo.removeContact(Number(req.params.id)));
}));

router.get('/:id/stage-history', wrap(async (req, res) => {
    const h = await contractRepo.stageHistory(req.params.id, req.user);
    if (h === null) return res.status(404).json({ error: 'Not found — or outside your access' });
    res.json(h);
}));

router.get('/:id', wrap(async (req, res) => {
    const c = await contractRepo.get(req.params.id, req.user);
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(c);
}));

router.patch('/:id', wrap(async (req, res) => {
    const data = validate(updateContractSchema, req.body);
    const r = await contractRepo.update(req.params.id, data, req.user);
    if (r.notFound) return res.status(404).json({ error: 'Not found' });
    if (r.forbidden) return res.status(403).json({ error: 'This contract is outside your access' });
    res.json(r.contract);
}));

router.delete('/:id', wrap(async (req, res) => {
    const r = await contractRepo.remove(req.params.id, req.user);
    if (r.notFound) return res.status(404).json({ error: 'Not found' });
    if (r.forbidden) return res.status(403).json({ error: 'This contract is outside your access' });
    res.json({ deleted: true });
}));

export default router;
