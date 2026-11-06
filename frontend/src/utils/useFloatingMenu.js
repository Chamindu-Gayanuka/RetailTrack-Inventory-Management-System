import {useCallback, useLayoutEffect, useState} from 'react';

/**
 * Position a popover within the viewport, including inside modals and on small
 * screens. The menu flips above its trigger when there is not enough room.
 *
 * @param {boolean} open
 * @param {import('react').RefObject<HTMLElement | null>} anchorRef
 * @param {import('react').RefObject<HTMLElement | null>} menuRef
 * @param {string | number | boolean} contentKey
 * @param {{ minWidth?: number, maxWidth?: number, maxHeight?: number }} [options]
 */
export default function useFloatingMenu(open, anchorRef, menuRef, contentKey, options = {}) {
    const {minWidth = 220, maxWidth = 340, maxHeight = 440} = options;
    const [style, setStyle] = useState(/** @type {import('react').CSSProperties} */ ({
        position: 'fixed',
        visibility: 'hidden'
    }));

    const updatePosition = useCallback(() => {
        const anchor = anchorRef.current;
        const menu = menuRef.current;
        if (!anchor || !menu) return;
        const rect = anchor.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const width = Math.min(Math.max(rect.width, minWidth), maxWidth, Math.max(180, viewportWidth - 16));
        const height = Math.min(menu.scrollHeight, maxHeight, Math.max(180, viewportHeight - 16));
        const left = Math.max(8, Math.min(rect.left, viewportWidth - width - 8));
        let top = rect.bottom + 7;
        if (top + height > viewportHeight - 8 && rect.top - height - 7 >= 8) top = rect.top - height - 7;
        if (top + height > viewportHeight - 8) top = Math.max(8, viewportHeight - height - 8);
        setStyle({position: 'fixed', top, left, width, maxHeight: height, overflowY: 'auto', visibility: 'visible'});
    }, [anchorRef, maxHeight, maxWidth, menuRef, minWidth]);

    useLayoutEffect(() => {
        if (!open) return undefined;
        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [open, contentKey, updatePosition]);

    return style;
}