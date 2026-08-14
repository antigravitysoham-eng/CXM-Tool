import { getDb } from '../db.js';
import { scope, canAccess } from '../services/policyService.js';
import { storage } from '../services/storageService.js';
import { CATEGORY_BY_TYPE } from '../validation/documentSchema.js';

// A document inherits its access rules from the account it belongs to — there is
// no separate document policy to drift out of step with the account's.
const asResource = (acct) => ({ owner_id: acct.owner_id, region: acct.region, segment: acct.type });

async function accountRow(account) {
    const db = await getDb();
    return db.get('SELECT * FROM customers WHERE name = ?', [account]);
}

function rowToDoc(row) {
    if (!row) return null;
    return {
        id: row.id,
        account: row.account,
        contract_id: row.contract_id || '',
        doc_type: row.doc_type,
        category: CATEGORY_BY_TYPE[row.doc_type] || 'Other',
        name: row.name,
        description: row.description || '',
        version: row.version || 'v1',
        link: row.link || '',
        has_file: Boolean(row.file_key),
        file_name: row.file_name || '',
        mime: row.mime || '',
        size: row.size || 0,
        uploaded_by: row.uploaded_by || '',
        replaces_id: row.replaces_id || null,
        created_at: row.created_at
    };
}

// 'v3' -> 'v4'; anything unparseable just gets a suffix so we never lose ordering.
function nextVersion(v) {
    const m = /^v?(\d+)$/i.exec(String(v || '').trim());
    return m ? `v${Number(m[1]) + 1}` : `${v || 'v1'}.1`;
}

export const documentRepo = {
    /**
     * Superseded rows are hidden unless `history` is set: the library shows what
     * is current, and the chain stays available for audit.
     */
    async list(user, { account, contract_id, doc_type, category, q, history = false } = {}) {
        const db = await getDb();
        // Reuse the account read scope so document visibility can never exceed it.
        const { clause, params } = await scope(user, 'accounts');
        const visible = await db.all(`SELECT name FROM customers WHERE ${clause}`, params);
        const names = new Set(visible.map((r) => r.name));

        const where = [];
        const args = [];
        if (account) { where.push('account = ?'); args.push(account); }
        if (contract_id) { where.push('contract_id = ?'); args.push(contract_id); }
        if (doc_type) { where.push('doc_type = ?'); args.push(doc_type); }
        if (!history) where.push('id NOT IN (SELECT replaces_id FROM documents WHERE replaces_id IS NOT NULL)');

        const rows = await db.all(
            `SELECT * FROM documents ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC`,
            args
        );

        let docs = rows.map(rowToDoc).filter((d) => names.has(d.account));
        if (category) docs = docs.filter((d) => d.category === category);
        if (q) {
            const needle = q.toLowerCase();
            docs = docs.filter((d) =>
                [d.name, d.description, d.account, d.doc_type, d.file_name]
                    .some((f) => String(f).toLowerCase().includes(needle))
            );
        }
        return docs;
    },

    /** Full supersession chain for a document, newest first. */
    async history(id, user) {
        const db = await getDb();
        const chain = [];
        let row = await db.get('SELECT * FROM documents WHERE id = ?', [id]);
        if (!row) return null;
        const acct = await accountRow(row.account);
        if (acct && !(await canAccess(user, asResource(acct), 'read', 'contracts'))) return null;
        while (row) {
            chain.push(rowToDoc(row));
            row = row.replaces_id ? await db.get('SELECT * FROM documents WHERE id = ?', [row.replaces_id]) : null;
        }
        return chain;
    },

    async create(data, user) {
        const db = await getDb();
        const acct = await accountRow(data.account);
        if (!acct) return { notFound: true };
        if (!(await canAccess(user, asResource(acct), 'write', 'contracts'))) return { forbidden: true };

        // Uploading against an existing document supersedes it and bumps the version.
        // Unsupplied metadata is inherited from the version being replaced — a new
        // revision of the same agreement shouldn't silently lose its filing details.
        let version = data.version || 'v1';
        if (data.replaces_id) {
            const prev = await db.get('SELECT * FROM documents WHERE id = ?', [data.replaces_id]);
            if (!prev) return { notFound: true };
            if (prev.account !== data.account) return { forbidden: true };
            if (!data.version || data.version === prev.version) version = nextVersion(prev.version);
            data = {
                ...data,
                description: data.description || prev.description || '',
                contract_id: data.contract_id || prev.contract_id || '',
                doc_type: data.doc_type && data.doc_type !== 'Other' ? data.doc_type : prev.doc_type
            };
        }

        let file = { key: null, size: 0 };
        if (data.file_base64) file = await storage.saveBase64(data.file_base64, data.file_name || data.name);

        const r = await db.run(
            `INSERT INTO documents
               (account, contract_id, doc_type, name, description, version, link,
                file_key, file_name, mime, size, uploaded_by, replaces_id, created_at)
             VALUES (?,?,?,?,?,?,?, ?,?,?,?,?,?,?)`,
            [
                data.account, data.contract_id || '', data.doc_type, data.name,
                data.description || '', version, data.link || '',
                file.key, data.file_name || '', data.mime || '', file.size,
                user.name || user.email || '', data.replaces_id || null,
                new Date().toISOString()
            ]
        );
        return { document: rowToDoc(await db.get('SELECT * FROM documents WHERE id = ?', [r.lastID])) };
    },

    async update(id, data, user) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM documents WHERE id = ?', [id]);
        if (!row) return { notFound: true };
        const acct = await accountRow(row.account);
        if (acct && !(await canAccess(user, asResource(acct), 'write', 'contracts'))) return { forbidden: true };

        const sets = [];
        const params = [];
        for (const f of ['doc_type', 'name', 'description', 'version', 'contract_id']) {
            if (data[f] !== undefined) { sets.push(`${f} = ?`); params.push(data[f]); }
        }
        if (!sets.length) return { document: rowToDoc(row) };
        await db.run(`UPDATE documents SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
        return { document: rowToDoc(await db.get('SELECT * FROM documents WHERE id = ?', [id])) };
    },

    /** Returns the bytes plus display metadata, or an access verdict. */
    async download(id, user) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM documents WHERE id = ?', [id]);
        if (!row) return { notFound: true };
        const acct = await accountRow(row.account);
        if (acct && !(await canAccess(user, asResource(acct), 'read', 'contracts'))) return { forbidden: true };
        if (!row.file_key) return { noFile: true, link: row.link || '' };
        return {
            buffer: await storage.read(row.file_key),
            file_name: row.file_name || row.name,
            mime: row.mime || 'application/octet-stream'
        };
    },

    async remove(id, user) {
        const db = await getDb();
        const row = await db.get('SELECT * FROM documents WHERE id = ?', [id]);
        if (!row) return { notFound: true };
        const acct = await accountRow(row.account);
        // Deleting a document is destructive, so it's more restricted than uploading:
        // admins and managers may remove any document on an account they can write to;
        // anyone else may remove only a document they uploaded themselves. Every
        // deletion is captured in the activity log (see the activity middleware).
        const canWrite = !acct || (await canAccess(user, asResource(acct), 'write', 'contracts'));
        const isManagerPlus = user.role === 'admin' || user.role === 'manager';
        const isUploader = !!row.uploaded_by && (row.uploaded_by === user.name || row.uploaded_by === user.email);
        if (!canWrite || (!isManagerPlus && !isUploader)) return { forbidden: true };
        // Detach superseded versions rather than orphaning them behind a dead pointer.
        await db.run('UPDATE documents SET replaces_id = NULL WHERE replaces_id = ?', [id]);
        await db.run('DELETE FROM documents WHERE id = ?', [id]);
        if (row.file_key) await storage.remove(row.file_key);
        return { deleted: true };
    },

    /** Library-wide rollup for the DMS header. */
    async stats(user, filters = {}) {
        const docs = await this.list(user, filters);
        const byType = {};
        const byCategory = {};
        let bytes = 0;
        let files = 0;
        for (const d of docs) {
            byType[d.doc_type] = (byType[d.doc_type] || 0) + 1;
            byCategory[d.category] = (byCategory[d.category] || 0) + 1;
            bytes += d.size || 0;
            if (d.has_file) files += 1;
        }
        return {
            total: docs.length,
            files,
            links: docs.length - files,
            bytes,
            accounts: new Set(docs.map((d) => d.account)).size,
            byType,
            byCategory
        };
    }
};
