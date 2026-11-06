import {createContext, useContext} from 'react';

/** @typedef {import('./types.js').StoreValue} StoreValue */

/** Shared application state. Kept outside the provider module for Fast Refresh. */
export const StoreContext = createContext(/** @type {StoreValue | null} */ (null));

/** @returns {StoreValue} */
export function useStore() {
    const context = useContext(StoreContext);
    if (!context) throw new Error('useStore must be used inside StoreProvider');
    return context;
}