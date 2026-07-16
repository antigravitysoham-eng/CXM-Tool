import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { contractRepo } from '../repositories/contractRepo.js';
import { accountRepo } from '../repositories/accountRepo.js';
import { upcomingTriggers } from '../services/renewalService.js';
import { recommendCsm } from '../services/assignmentService.js';
import { validate } from '../validation/accountSchema.js';
import {
    createContractSchema, updateContractSchema, documentSchema,
    CONTRACT_TYPES, CONTRACT_STATUSES, DEPLOYMENTS, LICENSE_TYPES, BILLING_FREQUENCIES, CURRENCIES, DOC_TYPES
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
    res.json(await contractRepo.list({ account, status, deployment, license_type, period: periodFrom(req.query) }));
}));

router.get('/meta', wrap(async (req, res) => {
    res.json({
        types: CONTRACT_TYPES, statuses: CONTRACT_STATUSES, deployments: DEPLOYMENTS,
        licenseTypes: LICENSE_TYPES, billingFrequencies: BILLING_FREQUENCIES, currencies: CURRENCIES,
        docTypes: DOC_TYPES, role: req.user.role
    });
}));

// Contracts inside a 90/60/30 window, each with the two generated emails.
router.get('/renewal-triggers', wrap(async (req, res) => {
    const contracts = await contractRepo.list({});
    res.json(upcomingTriggers(contracts));
}));

// Customer-centric view: every Cash Horizon Customer flows into CLM, joined
// with their contract rollup. Accounts with no contract yet show hasContract=false.
router.get('/customers', wrap(async (req, res) => {
    const accounts = await accountRepo.list(req.user);
    const contracts = await contractRepo.list({});
    const toInr = (c) => (c.currency === 'INR' ? c.tcv : c.tcv * 83) || 0;
    const customers = accounts.filter((a) => a.segment === 'Customer').map((a) => {
        const cs = contracts.filter((c) => c.account === a.name);
        const upcoming = cs.filter((c) => c.days_to_renewal !== null && c.days_to_renewal <= 90)
            .sort((x, y) => x.days_to_renewal - y.days_to_renewal)[0] || null;
        return {
            name: a.name, industry: a.industry, tier: a.tier, health: a.health,
            cxm: a.cxm, sales_owner: a.sales_owner, value_currency: a.value_currency, account_value: a.value_amount,
            contractCount: cs.length,
            totalValueInr: cs.reduce((s, c) => s + toInr(c), 0),
            nextRenewalDate: upcoming ? upcoming.renewal_date : null,
            nextRenewalDays: upcoming ? upcoming.days_to_renewal : null,
            renewalBucket: upcoming ? upcoming.renewal_bucket : (cs.length ? 'healthy' : 'none'),
            autoRenew: cs.some((c) => c.auto_renew),
            hasContract: cs.length > 0
        };
    });
    res.json(customers);
}));

router.get('/customer-360/:account', wrap(async (req, res) => {
    res.json(await contractRepo.customer360(req.params.account));
}));

router.post('/seed-sample', requireRole('admin'), wrap(async (req, res) => {
    res.json(await contractRepo.seedSample());
}));

// Advisory CSM assignment: recommend who should own an account. CX lead decides.
router.post('/assignment-advice', wrap(async (req, res) => {
    const accounts = await accountRepo.list(req.user);
    const contracts = await contractRepo.list({});
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
    res.json(await contractRepo.listDocuments({ contract_id: req.params.id }));
}));
router.post('/:id/documents', wrap(async (req, res) => {
    const contract = await contractRepo.get(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    const data = validate(documentSchema, { ...req.body, contract_id: req.params.id, account: contract.account });
    res.status(201).json(await contractRepo.addDocument(data));
}));
router.delete('/documents/:docId', wrap(async (req, res) => {
    res.json(await contractRepo.removeDocument(Number(req.params.docId)));
}));

router.get('/:id', wrap(async (req, res) => {
    const c = await contractRepo.get(req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(c);
}));

router.patch('/:id', wrap(async (req, res) => {
    const data = validate(updateContractSchema, req.body);
    const r = await contractRepo.update(req.params.id, data);
    if (r.notFound) return res.status(404).json({ error: 'Not found' });
    res.json(r.contract);
}));

router.delete('/:id', wrap(async (req, res) => {
    const r = await contractRepo.remove(req.params.id);
    if (r.notFound) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
}));

export default router;
