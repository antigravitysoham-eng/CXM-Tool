import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGE_SIZES } from '../hooks/usePagination';
import './Pagination.css';

/** The page-size selector + range readout + prev/next. Hidden if there's nothing. */
export default function Pagination({ page, setPage, pageSize, setPageSize, total, totalPages }) {
    if (!total) return null;
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);

    return (
        <div className="pg">
            <div className="pg-size">
                <span>Rows</span>
                <select className="select-sm" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                    {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            <div className="pg-nav">
                <span className="pg-range">{from}–{to} of {total}</span>
                <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
                    <ChevronLeft size={16} />
                </button>
                <span className="pg-page">{page} / {totalPages}</span>
                <button type="button" onClick={() => setPage(page + 1)} disabled={page >= totalPages} aria-label="Next page">
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );
}
