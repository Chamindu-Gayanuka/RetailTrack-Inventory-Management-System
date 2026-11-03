import { useCallback, useEffect, useMemo, useState } from 'react';
import { StoreContext } from './store-context.js';
import {
    demoAccounts,
    initialProfile,
    initialSettings,
    seedCategories,
    seedProducts,
    seedSales,
    seedTransactions,
    seedUsers,
} from './data.js';
import { passwordValidationError } from './utils/credentials.js';

/**
 * @typedef {import('./types.js').StoreValue} StoreValue
 * @typedef {import('./types.js').Session} Session
 * @typedef {import('./types.js').DemoAccount} DemoAccount
 * @typedef {import('./types.js').Product} Product
 * @typedef {import('./types.js').Sale} Sale
 * @typedef {import('./types.js').InventoryTransaction} InventoryTransaction
 * @typedef {import('./types.js').ToastMessage} ToastMessage
 * @typedef {import('react').ReactNode} ReactNode
 * @typedef {import('react').Dispatch<import('react').SetStateAction<Session | null>>} SessionSetter
 */

const signedOutKey = 'retailtrack-signed-out';

/** @type {Session} */
const defaultSession = {
    userId: demoAccounts[0].userId,
    name: demoAccounts[0].name,
    email: demoAccounts[0].email,
    role: demoAccounts[0].role,
    avatar: demoAccounts[0].avatar,
    remember: true,
};

/** @returns {[Session | null, SessionSetter]} */
function useSessionState() {
    const [session, setSession] = useState(/** @type {() => Session | null} */(() => {
        try {
            // An explicit sign-out must survive reloads instead of restoring the demo admin.
            if (localStorage.getItem(signedOutKey) === 'true') return null;
        } catch {
            // Continue with the available session when storage is blocked.
        }

        for (const storage of [localStorage, sessionStorage]) {
            try {
                const saved = storage.getItem('retailtrack-session');
                if (saved) return JSON.parse(saved);
            } catch {
                // Fall through to the default demo session.
            }
        }
        return defaultSession;
    }));

    useEffect(() => {
        try {
            if (!session) {
                localStorage.removeItem('retailtrack-session');
                sessionStorage.removeItem('retailtrack-session');
                return;
            }
            const serialized = JSON.stringify(session);
            if (session.remember === false) {
                sessionStorage.setItem('retailtrack-session', serialized);
                localStorage.removeItem('retailtrack-session');
            } else {
                localStorage.setItem('retailtrack-session', serialized);
                sessionStorage.removeItem('retailtrack-session');
            }
        } catch {
            // Authentication still works for the current page when storage is blocked.
        }
    }, [session]);

    return [session, setSession];
}

/**
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @param {(value: any) => T} [transform]
 * @returns {[T, import('react').Dispatch<import('react').SetStateAction<T>>]}
 */
function usePersistentState(key, fallback, transform) {
    const [state, setState] = useState(() => {
        try {
            const saved = localStorage.getItem(key);
            if (!saved) return fallback;
            const parsed = JSON.parse(saved);
            return transform ? transform(parsed) : parsed;
        } catch {
            return fallback;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(state));
        } catch {
            // The app remains usable when storage is unavailable.
        }
    }, [key, state]);

    return [state, setState];
}

/**
 * @param {Product[]} products
 * @returns {Product[]}
 */
function withExampleProductImages(products) {
    if (!Array.isArray(products)) return products;
    const exampleProducts = new Map(seedProducts.filter((product) => product.image).map((product) => [product.id, product]));
    return products.map((product) => {
        const example = exampleProducts.get(product.id);
        if (!example || product.imageRemoved) return product;
        const isMatchingMockProduct = product.sku === example.sku && product.name === example.name;
        const needsImage = !Object.prototype.hasOwnProperty.call(product, 'image') || product.image === '';
        // Backfill catalog photos for matching mock records without replacing custom uploads.
        return isMatchingMockProduct && needsImage ? { ...product, image: example.image } : product;
    });
}

const mockDateKey = 'retailtrack-mock-date';
const currentDayKey = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/**
 * Refresh only built-in record dates, preserving user edits and newly created records.
 * @template T
 * @param {T[]} records
 * @param {T[]} seedRecords
 * @param {string} [field]
 * @returns {T[]}
 */
function withCurrentMockDates(records, seedRecords, field = 'createdAt') {
    if (!Array.isArray(records)) return records;
    const seeds = new Map(seedRecords.map((record) => [/** @type {any} */ (record).id, record]));
    return /** @type {T[]} */ (records.map((record) => {
        const seed = seeds.get(/** @type {any} */(record).id);
        const value = seed ? /** @type {any} */ (seed)[field] : null;
        return seed && value ? { ...record, [field]: value } : record;
    }));
}

/** @param {import('./types.js').UserAccount[]} users */
function withEmailVerification(users) {
    if (!Array.isArray(users)) return users;
    return users.map((user) => {
        if (typeof user.emailVerified === 'boolean') return user;
        const seed = seedUsers.find((item) => item.id === user.id);
        return { ...user, emailVerified: seed?.emailVerified ?? false };
    });
}

/** @param {{ children: ReactNode }} props */
export function StoreProvider({ children }) {
    let refreshMockDates = false;
    try { refreshMockDates = localStorage.getItem(mockDateKey) !== currentDayKey(); } catch { /* Seed dates already use the current day. */ }
    const [products, setProducts] = usePersistentState('retailtrack-products', seedProducts, withExampleProductImages);
    const [categories, setCategories] = usePersistentState('retailtrack-categories', seedCategories);
    const [sales, setSales] = usePersistentState('retailtrack-sales', seedSales, (records) => /** @type {Sale[]} */(refreshMockDates ? withCurrentMockDates(records, seedSales) : records));
    const [transactions, setTransactions] = usePersistentState('retailtrack-transactions', seedTransactions, (records) => /** @type {InventoryTransaction[]} */(refreshMockDates ? withCurrentMockDates(records, seedTransactions) : records));
    const [users, setUsers] = usePersistentState('retailtrack-users', seedUsers, (records) => withEmailVerification(refreshMockDates ? withCurrentMockDates(records, seedUsers, 'lastActive') : records));
    const [profile, setProfile] = usePersistentState('retailtrack-profile', initialProfile);
    const [settings, setSettings] = usePersistentState('retailtrack-settings', initialSettings);
    const [passwordOverrides, setPasswordOverrides] = usePersistentState('retailtrack-password-overrides', /** @type {Record<string, string>} */({}));
    const [session, setSession] = useSessionState();
    const [toasts, setToasts] = useState(/** @type {ToastMessage[]} */([]));

    useEffect(() => {
        try { localStorage.setItem(mockDateKey, currentDayKey()); } catch { /* Date refresh remains available when storage is accessible again. */ }
    }, []);

    const dismissToast = useCallback((/** @type {string} */ id) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    /** @type {StoreValue['notify']} */
    const notify = useCallback((message, type = 'success', title) => {
        const id = `${Date.now()}-${Math.random()}`;
        setToasts((current) => [...current.slice(-2), { id, message, type, title }]);
        window.setTimeout(() => dismissToast(id), 4200);
        return id;
    }, [dismissToast]);

    const login = useCallback((/** @type {DemoAccount} */ account, /** @type {boolean} */ remember = true) => {
        const user = users.find((item) => item.id === account.userId);
        try {
            localStorage.removeItem(signedOutKey);
        } catch {
            // Signing in still works for the current page when storage is blocked.
        }
        setSession({
            userId: account.userId,
            name: user?.name || account.name,
            email: user?.email || account.email,
            role: account.role,
            avatar: user?.avatar || (account.userId === 'u1' ? profile.avatar : null),
            remember,
        });
    }, [profile.avatar, setSession, users]);

    const logout = useCallback(() => {
        try {
            localStorage.setItem(signedOutKey, 'true');
            localStorage.removeItem('retailtrack-session');
            sessionStorage.removeItem('retailtrack-session');
        } catch {
            // Signing out still works for the current page when storage is blocked.
        }
        setSession(null);
    }, [setSession]);

    const getDemoAccount = useCallback((/** @type {string} */ userId) => {
        const account = demoAccounts.find((item) => item.userId === userId);
        if (!account) return null;
        const user = users.find((item) => item.id === userId);
        return { ...account, email: user?.email || account.email, password: passwordOverrides[userId] || account.password };
    }, [passwordOverrides, users]);

    const findAccountByEmail = useCallback((/** @type {string} */ email) => {
        const normalized = email.trim().toLowerCase();
        const matchingUser = users.find((item) => item.email.toLowerCase() === normalized);
        const account = demoAccounts.find((item) => item.userId === matchingUser?.id) || demoAccounts.find((item) => item.email.toLowerCase() === normalized);
        if (!account) return null;
        const user = users.find((item) => item.id === account.userId);
        if (user?.active === false) return null;
        return getDemoAccount(account.userId);
    }, [getDemoAccount, users]);

    const authenticate = useCallback((/** @type {string} */ email, /** @type {string} */ password) => {
        const account = findAccountByEmail(email);
        return account && account.password === password ? account : null;
    }, [findAccountByEmail]);

    const resetPassword = useCallback((/** @type {string} */ email, /** @type {string} */ password) => {
        const account = findAccountByEmail(email);
        if (!account || passwordValidationError(password)) return false;
        setPasswordOverrides((current) => ({ ...current, [account.userId]: password }));
        return true;
    }, [findAccountByEmail, setPasswordOverrides]);

    const changePassword = useCallback((/** @type {string} */ currentPassword, /** @type {string} */ newPassword) => {
        const account = session ? getDemoAccount(session.userId) : null;
        if (!account || account.password !== currentPassword) return { ok: false, message: 'Your current password is incorrect.' };
        const validation = passwordValidationError(newPassword);
        if (validation) return { ok: false, message: validation };
        setPasswordOverrides((current) => ({ ...current, [account.userId]: newPassword }));
        return { ok: true, message: '' };
    }, [getDemoAccount, session, setPasswordOverrides]);

    const addProduct = useCallback((/** @type {any} */ data) => {
        const product = {
            ...data,
            id: `p${Date.now()}`,
            price: Number(data.price),
            cost: Number(data.cost || 0),
            stock: Number(data.stock || 0),
            minStock: Number(data.minStock || 0),
            active: data.active !== false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        setProducts((current) => [product, ...current]);
        if (product.stock > 0) {
            setTransactions((current) => [{
                id: `tx${Date.now()}`,
                type: 'inbound',
                title: `Initial stock · ${product.name}`,
                productId: product.id,
                quantity: product.stock,
                createdAt: new Date().toISOString(),
                note: 'Product created',
            }, ...current]);
        }
        notify(`${product.name} was added to the catalog.`);
        return product;
    }, [notify, setProducts, setTransactions]);

    const updateProduct = useCallback((/** @type {string} */ id, /** @type {any} */ data) => {
        setProducts((current) => current.map((product) => product.id === id ? {
            ...product,
            ...data,
            price: Number(data.price),
            cost: Number(data.cost || 0),
            minStock: Number(data.minStock || 0),
            updatedAt: new Date().toISOString(),
        } : product));
        notify('Product details were updated.');
    }, [notify, setProducts]);

    const toggleProduct = useCallback((/** @type {string} */ id) => {
        const selected = products.find((product) => product.id === id);
        if (!selected) return;
        const nowActive = !selected.active;
        setProducts((current) => current.map((product) => product.id === id ? {
            ...product,
            active: nowActive,
            updatedAt: new Date().toISOString(),
        } : product));
        notify(`${selected.name} is now ${nowActive ? 'active' : 'inactive'}.`, 'info');
    }, [notify, products, setProducts]);

    /** @type {(productId: string, quantity: number, note?: string) => boolean} */
    const restock = useCallback((productId, quantity, note = 'Manual stock addition') => {
        const qty = Number(quantity);
        const product = products.find((item) => item.id === productId);
        if (!product || !Number.isFinite(qty) || qty <= 0) {
            notify('Enter a valid quantity and select a product.', 'error');
            return false;
        }
        setProducts((current) => current.map((item) => item.id === productId ? {
            ...item,
            stock: Number(item.stock) + qty,
            updatedAt: new Date().toISOString(),
        } : item));
        setTransactions((current) => [{
            id: `tx${Date.now()}`,
            type: 'inbound',
            title: `Restock ${product.name}`,
            productId,
            quantity: qty,
            createdAt: new Date().toISOString(),
            note,
        }, ...current]);
        notify(`${qty} units added to ${product.name}.`);
        return true;
    }, [notify, products, setProducts, setTransactions]);

    /** @type {(input: { customer: string, items: Array<{ productId: string, qty: number, name?: string }>, payment?: string, status?: string }) => Sale | null} */
    const createSale = useCallback(({ customer, items, payment = 'Cash', status = 'Completed' }) => {
        if (!items.length) {
            notify('Add at least one product to the sale.', 'error');
            return null;
        }
        for (const item of items) {
            const product = products.find((entry) => entry.id === item.productId);
            if (!product || !product.active || Number(item.qty) <= 0 || Number(item.qty) > Number(product.stock)) {
                notify(`Insufficient stock for ${item.name || 'a selected product'}.`, 'error');
                return null;
            }
        }
        const numericId = Math.max(1032, ...sales.map((sale) => Number(sale.numericId) || 0)) + 1;
        const saleItems = items.map((item) => {
            const product = products.find((entry) => entry.id === item.productId);
            if (!product) throw new Error(`Product ${item.productId} is no longer available.`);
            return {
                productId: item.productId,
                name: product.name,
                sku: product.sku,
                qty: Number(item.qty),
                price: Number(product.price),
            };
        });
        const sale = {
            id: `SALE-${numericId}`,
            numericId,
            customer: customer.trim() || 'Walk-in Customer',
            items: saleItems,
            total: saleItems.reduce((sum, item) => sum + item.qty * item.price, 0),
            payment,
            status,
            cashier: session?.name || profile.name,
            createdAt: new Date().toISOString(),
        };
        setSales((current) => [sale, ...current]);
        if (status === 'Completed') {
            setProducts((current) => current.map((product) => {
                const sold = saleItems.find((item) => item.productId === product.id);
                return sold ? { ...product, stock: product.stock - sold.qty, updatedAt: new Date().toISOString() } : product;
            }));
            setTransactions((current) => [
                ...saleItems.map((item, index) => ({
                    id: `tx${Date.now()}-${index}`,
                    type: 'outbound',
                    title: `Sale #${sale.id}`,
                    productId: item.productId,
                    quantity: item.qty,
                    createdAt: sale.createdAt,
                    note: `Sold to ${sale.customer}`,
                })),
                ...current,
            ]);
        }
        notify(status === 'Completed' ? `${sale.id} completed · stock updated automatically.` : `${sale.id} saved as a pending order.`, status === 'Completed' ? 'success' : 'info');
        return sale;
    }, [notify, products, profile.name, sales, session?.name, setProducts, setSales, setTransactions]);

    const completeSale = useCallback((/** @type {string} */ saleId) => {
        const sale = sales.find((item) => item.id === saleId);
        if (!sale || sale.status !== 'Pending') {
            notify('Only pending sales can be completed.', 'error');
            return false;
        }
        for (const item of sale.items) {
            const product = products.find((entry) => entry.id === item.productId);
            if (!product || !product.active || product.stock < item.qty) {
                notify(`Insufficient stock for ${item.name}. Restock before completing this sale.`, 'error');
                return false;
            }
        }
        setSales((current) => current.map((item) => item.id === saleId ? { ...item, status: 'Completed', completedAt: new Date().toISOString() } : item));
        setProducts((current) => current.map((product) => {
            const sold = sale.items.find((item) => item.productId === product.id);
            return sold ? { ...product, stock: product.stock - sold.qty, updatedAt: new Date().toISOString() } : product;
        }));
        setTransactions((current) => [
            ...sale.items.map((item, index) => ({
                id: `tx${Date.now()}-${index}`,
                type: 'outbound',
                title: `Sale #${sale.id}`,
                productId: item.productId,
                quantity: item.qty,
                createdAt: new Date().toISOString(),
                note: `Pending sale completed for ${sale.customer}`,
            })),
            ...current,
        ]);
        notify(`${sale.id} completed and stock updated.`);
        return true;
    }, [notify, products, sales, setProducts, setSales, setTransactions]);

    const cancelSale = useCallback((/** @type {string} */ saleId) => {
        const sale = sales.find((item) => item.id === saleId);
        if (!sale || sale.status !== 'Pending') {
            notify('Only pending sales can be cancelled.', 'error');
            return false;
        }
        setSales((current) => current.map((item) => item.id === saleId ? { ...item, status: 'Cancelled' } : item));
        notify(`${sale.id} cancelled. No stock was changed.`, 'info');
        return true;
    }, [notify, sales, setSales]);

    const addCategory = useCallback((/** @type {any} */ data) => {
        const category = { ...data, id: `cat${Date.now()}` };
        setCategories((current) => [...current, category]);
        notify(`${category.name} category created.`);
        return category;
    }, [notify, setCategories]);

    const updateCategory = useCallback((/** @type {string} */ id, /** @type {any} */ data) => {
        setCategories((current) => current.map((category) => category.id === id ? { ...category, ...data } : category));
        notify('Category updated.');
    }, [notify, setCategories]);

    const deleteCategory = useCallback((/** @type {string} */ id) => {
        const category = categories.find((item) => item.id === id);
        if (products.some((product) => product.categoryId === id)) {
            notify('Move products to another category before deleting this one.', 'error');
            return false;
        }
        setCategories((current) => current.filter((categoryItem) => categoryItem.id !== id));
        notify(`${category?.name || 'Category'} deleted.`, 'info');
        return true;
    }, [categories, notify, products, setCategories]);

    const addUser = useCallback((/** @type {any} */ data) => {
        const user = {
            ...data,
            id: `u${Date.now()}`,
            active: true,
            emailVerified: false,
            lastActive: new Date().toISOString(),
        };
        setUsers((current) => [...current, user]);
        notify(`Invitation sent to ${user.email}.`);
        return user;
    }, [notify, setUsers]);

    const toggleUser = useCallback((/** @type {string} */ id) => {
        if (id === 'u1') {
            notify('The primary administrator account cannot be deactivated.', 'error');
            return;
        }
        setUsers((current) => current.map((user) => user.id === id ? { ...user, active: !user.active } : user));
        notify('User access updated.', 'info');
    }, [notify, setUsers]);

    const updateProfile = useCallback((/** @type {any} */ data) => {
        if (session?.userId === 'u1') setProfile((current) => ({ ...current, ...data, ...(data.email && data.email !== current.email ? { emailVerified: false } : {}) }));
        setUsers((current) => current.map((user) => user.id === session?.userId ? { ...user, ...data, ...(data.email && data.email !== user.email ? { emailVerified: false } : {}) } : user));
        setSession((current) => current ? { ...current, ...data } : current);
        notify('Your profile changes were saved.');
    }, [notify, session?.userId, setProfile, setSession, setUsers]);

    const markEmailVerified = useCallback(() => {
        if (!session) return;
        setUsers((current) => current.map((user) => user.id === session.userId ? { ...user, emailVerified: true } : user));
        if (session.userId === 'u1') setProfile((current) => ({ ...current, emailVerified: true }));
        notify('Your email address has been verified.');
    }, [notify, session, setProfile, setUsers]);

    const updateSettings = useCallback((/** @type {any} */ data) => {
        setSettings((current) => ({ ...current, ...data }));
        notify('Settings saved successfully.');
    }, [notify, setSettings]);

    const resetDemo = useCallback(() => {
        setProducts(seedProducts);
        setCategories(seedCategories);
        setSales(seedSales);
        setTransactions(seedTransactions);
        setUsers(seedUsers);
        setProfile(initialProfile);
        setSettings(initialSettings);
        setPasswordOverrides({});
        notify('Demo data and passwords have been restored.', 'info');
    }, [notify, setCategories, setPasswordOverrides, setProducts, setProfile, setSales, setSettings, setTransactions, setUsers]);

    const value = useMemo(() => /** @type {StoreValue} */({
        products, categories, sales, transactions, users, profile, settings, session: /** @type {Session} */ (session), toasts,
        dismissToast, notify, login, logout, getDemoAccount, findAccountByEmail, authenticate, resetPassword, changePassword,
        addProduct, updateProduct, toggleProduct, restock,
        createSale, completeSale, cancelSale, addCategory, updateCategory, deleteCategory,
        addUser, toggleUser, updateProfile, markEmailVerified, updateSettings, resetDemo,
    }), [
        products, categories, sales, transactions, users, profile, settings, session, toasts,
        dismissToast, notify, login, logout, getDemoAccount, findAccountByEmail, authenticate, resetPassword, changePassword,
        addProduct, updateProduct, toggleProduct, restock,
        createSale, completeSale, cancelSale, addCategory, updateCategory, deleteCategory,
        addUser, toggleUser, updateProfile, markEmailVerified, updateSettings, resetDemo,
    ]);

    return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}