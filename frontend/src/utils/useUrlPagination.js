import {useCallback, useEffect, useRef} from 'react';

/**
 * Keep pagination in the URL so direct links and browser Back/Forward restore
 * the exact page. Filter changes replace the current entry with page one;
 * deliberate page changes create a new browser history entry.
 *
 * @param {(path: string, options?: { replace?: boolean }) => void} navigate
 * @param {number} pageCount
 * @param {string} resetKey
 * @returns {[number, (page: number) => void]}
 */
export default function useUrlPagination(navigate, pageCount, resetKey) {
    const params = new URLSearchParams(window.location.search);
    const parsed = Number.parseInt(params.get('page') || '1', 10);
    const requestedPage = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    const page = Math.min(requestedPage, Math.max(1, pageCount));
    const previousResetKey = useRef(resetKey);

    const updatePage = useCallback((/** @type {number} */ value, /** @type {boolean} */ replace = false) => {
        const nextPage = Math.max(1, Math.min(Math.max(1, pageCount), Math.trunc(Number(value)) || 1));
        const url = new URL(window.location.href);
        if (nextPage === 1) url.searchParams.delete('page');
        else url.searchParams.set('page', String(nextPage));
        const target = `${url.pathname}${url.search}`;
        const current = `${window.location.pathname}${window.location.search}`;
        if (target !== current) navigate(target, {replace});
    }, [navigate, pageCount]);

    useEffect(() => {
        if (previousResetKey.current !== resetKey) {
            previousResetKey.current = resetKey;
            updatePage(1, true);
        }
    }, [resetKey, updatePage]);

    useEffect(() => {
        if (requestedPage !== page) updatePage(page, true);
    }, [page, requestedPage, updatePage]);

    return [page, (nextPage) => updatePage(nextPage)];
}