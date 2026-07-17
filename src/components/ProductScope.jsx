import React, { useState, useEffect, useCallback } from 'react';
import { Check, Plus, X, Package, Save, ArrowRight } from 'lucide-react';
import { scopeApi } from '../api/invoices';
import './ProductScope.css';

/**
 * What a customer bought, and at what size.
 *
 * Products are multi-select — customers routinely take several — and each one
 * asks only for what it actually needs: named frameworks for Conformity, a
 * vendor count for Vendor Pulse, and so on. That shape comes from the server's
 * catalogue, so this form never hardcodes a product.
 *
 * Whatever is captured here becomes Onboarding's Stage 2 checklist verbatim.
 */
export default function ProductScope({ contractId, products = [], onSaved, readOnly = false }) {
    const [scope, setScope] = useState({}); // product_key -> { unit_count, items, info }
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [dirty, setDirty] = useState(false);

    const load = useCallback(async () => {
        try {
            const rows = await scopeApi.forContract(contractId);
            const next = {};
            for (const r of rows) next[r.product_key] = { unit_count: r.unit_count, items: r.items, info: r.info };
            setScope(next);
            setDirty(false);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [contractId]);

    useEffect(() => { load(); }, [load]);

    const toggle = (key) => {
        setScope((s) => {
            const next = { ...s };
            if (next[key]) delete next[key];
            else next[key] = { unit_count: 0, items: [], info: '' };
            return next;
        });
        setDirty(true);
    };

    const patch = (key, fields) => {
        setScope((s) => ({ ...s, [key]: { ...s[key], ...fields } }));
        setDirty(true);
    };

    const save = async () => {
        setSaving(true);
        setError('');
        try {
            const payload = Object.entries(scope).map(([product_key, v]) => ({
                product_key,
                unit_count: Number(v.unit_count) || 0,
                items: v.items || [],
                info: v.info || ''
            }));
            await scopeApi.setForContract(contractId, payload);
            setDirty(false);
            onSaved?.();
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="ps-empty">Loading scope…</div>;

    const chosen = Object.keys(scope);

    return (
        <div className="ps">
            <div className="ps-head">
                <span className="ps-title"><Package size={14} /> Products &amp; scope</span>
                <span className="ps-count">{chosen.length ? `${chosen.length} selected` : 'none selected'}</span>
            </div>

            <div className="ps-grid">
                {products.map((p) => {
                    const on = !!scope[p.key];
                    return (
                        <button
                            type="button"
                            key={p.key}
                            className={`ps-pick ${on ? 'is-on' : ''}`}
                            style={{ '--prod': p.color }}
                            onClick={() => !readOnly && toggle(p.key)}
                            disabled={readOnly}
                            title={p.blurb}
                        >
                            <span className="ps-pick-check">{on && <Check size={12} strokeWidth={3} />}</span>
                            <span className="ps-pick-name">{p.name}</span>
                        </button>
                    );
                })}
            </div>

            {chosen.length > 0 && (
                <div className="ps-scopes">
                    {products.filter((p) => scope[p.key]).map((p) => (
                        <ProductFields
                            key={p.key}
                            def={p}
                            value={scope[p.key]}
                            readOnly={readOnly}
                            onChange={(fields) => patch(p.key, fields)}
                        />
                    ))}
                </div>
            )}

            {error && <div className="ps-error">{error}</div>}

            {!readOnly && (
                <div className="ps-foot">
                    <span className="ps-hint">
                        <ArrowRight size={11} /> This scope becomes the Stage 2 setup checklist at onboarding.
                    </span>
                    <button type="button" className="ps-save" onClick={save} disabled={saving || !dirty}>
                        <Save size={14} /> {saving ? 'Saving…' : dirty ? 'Save scope' : 'Saved'}
                    </button>
                </div>
            )}
        </div>
    );
}

/** The fields one product needs — nothing more. */
function ProductFields({ def, value, onChange, readOnly }) {
    const [draft, setDraft] = useState('');
    const items = value.items || [];

    const addItem = () => {
        const v = draft.trim();
        if (!v || items.includes(v)) { setDraft(''); return; }
        onChange({ items: [...items, v] });
        setDraft('');
    };
    const removeItem = (n) => onChange({ items: items.filter((x) => x !== n) });

    return (
        <div className="ps-scope" style={{ '--prod': def.color }}>
            <div className="ps-scope-head">
                <strong>{def.name}</strong>
                <span className="ps-scope-blurb">{def.blurb}</span>
            </div>

            {def.itemLabel ? (
                <>
                    <label className="ps-field">
                        <span>{def.unitLabel} — name each one</span>
                        <div className="ps-add">
                            <input
                                value={draft}
                                placeholder={def.itemPlaceholder}
                                disabled={readOnly}
                                onChange={(e) => setDraft(e.target.value)}
                                // Enter adds an item; it must not submit the contract form.
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
                            />
                            <button type="button" onClick={addItem} disabled={readOnly || !draft.trim()}>
                                <Plus size={14} />
                            </button>
                        </div>
                    </label>
                    <div className="ps-items">
                        {items.map((n) => (
                            <span className="ps-item" key={n}>
                                {n}
                                {!readOnly && <button type="button" onClick={() => removeItem(n)}><X size={11} /></button>}
                            </span>
                        ))}
                        {/* The count is the list's length — never a second number to disagree with it. */}
                        <span className="ps-tally">{items.length} {items.length === 1 ? def.itemLabel.toLowerCase() : def.unitLabel.toLowerCase()}</span>
                    </div>
                </>
            ) : (
                <label className="ps-field">
                    <span>{def.unitLabel}</span>
                    <input
                        type="number" min="0"
                        value={value.unit_count ?? 0}
                        disabled={readOnly}
                        onChange={(e) => onChange({ unit_count: e.target.value })}
                        placeholder="0"
                    />
                </label>
            )}

            {def.needsInfo && (
                <label className="ps-field">
                    <span>What is the unit?</span>
                    <input
                        value={value.info || ''}
                        disabled={readOnly}
                        onChange={(e) => onChange({ info: e.target.value })}
                        placeholder="Describe what is being counted"
                    />
                </label>
            )}
        </div>
    );
}
