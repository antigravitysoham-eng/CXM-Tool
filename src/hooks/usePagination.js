import { useMemo, useState } from 'react';

export const PAGE_SIZES = [20, 50, 100];

/**
 * Client-side pagination for a list. Returns the current page's slice plus the
 * controls' state. The chosen page size is remembered per table via `storageKey`.
 *
 *   const { pageItems, ...page } = usePagination(rows, 'accounts');
 *   {pageItems.map(...)}
 *   <Pagination {...page} />
 *
 * The visible page is clamped to the available range at read time (rather than in
 * an effect), so a filter that shrinks the list never leaves us on a dead page.
 */
export function usePagination(items, storageKey) {
    const [page, setPageRaw] = useState(1);
    const [pageSize, setPageSizeState] = useState(() => {
        const saved = Number(storageKey && localStorage.getItem(`pg:${storageKey}`));
        return PAGE_SIZES.includes(saved) ? saved : 20;
    });

    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);

    const setPage = (p) => setPageRaw(Math.min(Math.max(1, p), totalPages));
    const setPageSize = (s) => {
        setPageSizeState(s);
        setPageRaw(1);
        if (storageKey) localStorage.setItem(`pg:${storageKey}`, String(s));
    };

    const pageItems = useMemo(
        () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
        [items, safePage, pageSize]
    );

    return { pageItems, page: safePage, setPage, pageSize, setPageSize, total, totalPages };
}
