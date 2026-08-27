import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { scopeRepo } from '../repositories/scopeRepo.js';
import { validate } from '../validation/accountSchema.js';
import { createInvoiceSchema, updateInvoiceSchema, INVOICE_STATUSES, CURRENCIES } from '../validation/scopeSchema.js';
import { config } from '../config.js';

const router = express.Router();
router.use(authenticateToken);

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
});

const settled = (res, r) => {
    if (r.notFound) return res.status(404).json({ error: 'Not found — or the contract is outside your access' }) || true;
    if (r.forbidden) return res.status(403).json({ error: 'You do not have access to this account' }) || true;
    return false;
};

const filtersFrom = (q) => ({
    account: q.account, contract_id: q.contract_id, status: q.status, overdue: q.overdue === 'true'
});

router.get('/meta', wrap(async (req, res) => {
    res.json({ statuses: INVOICE_STATUSES, currencies: CURRENCIES });
}));

router.get('/stats', wrap(async (req, res) => {
    res.json(await scopeRepo.invoiceStats(req.user, filtersFrom(req.query), config.fxUsdInr));
}));

router.get('/', wrap(async (req, res) => {
    res.json(await scopeRepo.listInvoices(req.user, filtersFrom(req.query)));
}));

router.post('/', wrap(async (req, res) => {
    const data = validate(createInvoiceSchema, req.body);
    const r = await scopeRepo.createInvoice(data, req.user);
    if (settled(res, r)) return;
    res.status(201).json(r.invoice);
}));

// Auto-generate the invoice schedule for a contract from its billing terms.
router.post('/generate', wrap(async (req, res) => {
    const { contract_id } = req.body || {};
    if (!contract_id) return res.status(400).json({ error: 'contract_id is required' });
    const r = await scopeRepo.generateSchedule(contract_id, req.user);
    if (settled(res, r)) return;
    if (r.alreadyExists) return res.status(409).json({ error: `Schedule already exists (${r.alreadyExists} invoices) — delete them first to regenerate` });
    if (r.invalid) return res.status(400).json({ error: r.invalid });
    res.status(201).json(r);
}));

router.get('/:id/download', wrap(async (req, res) => {
    const r = await scopeRepo.downloadInvoice(Number(req.params.id), req.user);
    if (settled(res, r)) return;
    if (r.noFile) return res.status(409).json({ error: 'No file attached to this invoice' });
    res.setHeader('Content-Type', r.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${String(r.file_name).replace(/["\r\n]/g, '')}"`);
    res.send(r.buffer);
}));

router.patch('/:id', wrap(async (req, res) => {
    const data = validate(updateInvoiceSchema, req.body);
    const r = await scopeRepo.updateInvoice(Number(req.params.id), data, req.user);
    if (settled(res, r)) return;
    res.json(r.invoice);
}));

router.delete('/:id', wrap(async (req, res) => {
    const r = await scopeRepo.removeInvoice(Number(req.params.id), req.user);
    if (settled(res, r)) return;
    res.json(r);
}));

export default router;
