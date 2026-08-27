import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { documentRepo } from '../repositories/documentRepo.js';
import { storage } from '../services/storageService.js';
import { validate } from '../validation/accountSchema.js';
import {
    createDocumentSchema, updateDocumentSchema, DOC_TYPES, DOC_CATEGORIES
} from '../validation/documentSchema.js';
import { listTemplates, buildTemplate } from '../services/templateService.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const router = express.Router();
router.use(authenticateToken);

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
});

// Translate a repo verdict into a response; returns true if it handled the reply.
const settled = (res, r) => {
    if (r.notFound) return res.status(404).json({ error: 'Document not found' }) || true;
    if (r.forbidden) return res.status(403).json({ error: 'You do not have access to this account' }) || true;
    return false;
};

const filtersFrom = (q) => ({
    account: q.account, contract_id: q.contract_id, doc_type: q.doc_type,
    category: q.category, q: q.q, history: q.history === 'true'
});

router.get('/meta', wrap(async (req, res) => {
    res.json({
        docTypes: DOC_TYPES,
        categories: DOC_CATEGORIES,
        storage: { driver: storage.driver, description: storage.describe(), maxBytes: storage.maxBytes }
    });
}));

// Editable organisation document templates — blank boilerplate any user can
// download and fill in (Proposal, Service Agreement, Tripartite, Invoice, …).
router.get('/templates', wrap(async (req, res) => {
    res.json({ templates: listTemplates() });
}));

router.get('/templates/:key/download', wrap(async (req, res) => {
    const t = await buildTemplate(req.params.key);
    if (!t) return res.status(404).json({ error: 'Unknown template' });
    res.setHeader('Content-Type', DOCX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename="${t.filename}"`);
    res.send(t.buffer);
}));

router.get('/stats', wrap(async (req, res) => {
    res.json(await documentRepo.stats(req.user, filtersFrom(req.query)));
}));

router.get('/', wrap(async (req, res) => {
    res.json(await documentRepo.list(req.user, filtersFrom(req.query)));
}));

router.get('/:id/history', wrap(async (req, res) => {
    const chain = await documentRepo.history(Number(req.params.id), req.user);
    if (!chain) return res.status(404).json({ error: 'Document not found' });
    res.json(chain);
}));

router.get('/:id/download', wrap(async (req, res) => {
    const r = await documentRepo.download(Number(req.params.id), req.user);
    if (settled(res, r)) return;
    if (r.noFile) return res.status(409).json({ error: 'This document is a link, not a stored file', link: r.link });
    res.setHeader('Content-Type', r.mime);
    // Quote the filename and strip control chars — it is user-supplied.
    res.setHeader('Content-Disposition', `attachment; filename="${r.file_name.replace(/["\r\n]/g, '')}"`);
    res.send(r.buffer);
}));

router.post('/', wrap(async (req, res) => {
    const data = validate(createDocumentSchema, req.body);
    const r = await documentRepo.create(data, req.user);
    if (r.notFound) return res.status(404).json({ error: 'Account not found' });
    if (settled(res, r)) return;
    res.status(201).json(r.document);
}));

router.patch('/:id', wrap(async (req, res) => {
    const data = validate(updateDocumentSchema, req.body);
    const r = await documentRepo.update(Number(req.params.id), data, req.user);
    if (settled(res, r)) return;
    res.json(r.document);
}));

router.delete('/:id', wrap(async (req, res) => {
    const r = await documentRepo.remove(Number(req.params.id), req.user);
    if (settled(res, r)) return;
    res.json(r);
}));

export default router;
