import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {StoreContext} from './store-context.js';
import {initialSettings} from './data.js';
import {api, ApiError, fetchAll, getToken, onUnauthorized, setToken} from './api/client.js';
import {
    adaptProduct,
    adaptPurchaseOrder,
    adaptReturn,
    adaptSale,
    adaptSettings,
    adaptTransaction,
    adaptUser,
    toProductBody,
    toRoleCode,
} from './api/adapters.js';

/**
 * Application store backed by the RetailTrack REST API. The database is the source of truth: every
 * action calls the server, then the affected lists are reloaded. Actions return promises.
 */

/** @typedef {import('./types.js').Session} Session */
/** @typedef {import('./types.js').ToastMessage} ToastMessage */

/** @param {any} user @param {boolean} remember @returns {Session} */
function toSession(user, remember) {
    return {userId: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar || null, remember};
}

/** @param {unknown} error */
const messageOf = (error) => (error instanceof Error ? error.message : 'Something went wrong. Please try again.');

/** @param {{ children: import('react').ReactNode }} props */
export function StoreProvider({children}) {
    const [products, setProducts] = useState(/** @type {any[]} */ ([]));
    const [categories, setCategories] = useState(/** @type {any[]} */ ([]));
    const [sales, setSales] = useState(/** @type {any[]} */ ([]));
    const [returns, setReturns] = useState(/** @type {any[]} */ ([]));
    const [purchaseOrders, setPurchaseOrders] = useState(/** @type {any[]} */ ([]));
    const [transactions, setTransactions] = useState(/** @type {any[]} */ ([]));
    const [users, setUsers] = useState(/** @type {any[]} */ ([]));
    const [settings, setSettings] = useState(/** @type {any} */ (initialSettings));
    const [session, setSession] = useState(/** @type {Session | null} */ (null));
    const [ready, setReady] = useState(false);
    const [toasts, setToasts] = useState(/** @type {ToastMessage[]} */ ([]));
    const salesRef = useRef(/** @type {any[]} */ ([]));
    salesRef.current = sales;
    const sessionRef = useRef(/** @type {Session | null} */ (null));
    sessionRef.current = session;

    const dismissToast = useCallback((/** @type {string} */ id) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    /** @type {import('./types.js').StoreValue['notify']} */
    const notify = useCallback((message, type = 'success', title) => {
        const id = `${Date.now()}-${Math.random()}`;
        setToasts((current) => [...current.slice(-2), {id, message, type, title}]);
        window.setTimeout(() => dismissToast(id), 4200);
        return id;
    }, [dismissToast]);

    const clearData = useCallback(() => {
        setProducts([]);
        setCategories([]);
        setSales([]);
        setReturns([]);
        setPurchaseOrders([]);
        setTransactions([]);
        setUsers([]);
    }, []);

    /**
     * Loads the lists this role may see. A list the role may not read (403) simply stays empty.
     * @param {string} role
     * @param {any} [me]
     * @param {string[]} [only] reload just these lists
     */
    const loadData = useCallback(async (/** @type {string} */ role, /** @type {any} */ me = undefined, /** @type {string[] | undefined} */ only = undefined) => {
        const staffOrAdmin = role !== 'Cashier';
        /** @type {Record<string, () => Promise<any>>} */
        const jobs = {
            products: async () => setProducts((await fetchAll('/products')).map(adaptProduct)),
            categories: async () => setCategories((await api.get('/categories')).data),
            sales: async () => setSales((await fetchAll('/sales')).map(adaptSale)),
            returns: async () => setReturns((await fetchAll('/returns')).map(adaptReturn)),
            transactions: async () => setTransactions(staffOrAdmin ? (await fetchAll('/inventory/transactions')).map(adaptTransaction) : []),
            purchaseOrders: async () => setPurchaseOrders(staffOrAdmin ? (await fetchAll('/purchase-orders')).map(adaptPurchaseOrder) : []),
            users: async () => setUsers(role === 'Administrator' ? (await fetchAll('/users')).map(adaptUser) : me ? [adaptUser(me)] : []),
            settings: async () => setSettings(adaptSettings((await api.get('/settings')).data)),
        };
        const names = only || Object.keys(jobs);
        const results = await Promise.allSettled(names.map((/** @type {string} */ name) => jobs[name]()));
        const failure = results.find((result) => result.status === 'rejected' && !(result.reason instanceof ApiError && (result.reason.status === 403 || result.reason.status === 401)));
        if (failure && failure.status === 'rejected') notify(messageOf(failure.reason), 'error', 'Could not load data');
    }, [notify]);

    const reload = useCallback((/** @type {string[]} */ names) => {
        const current = sessionRef.current;
        return current ? loadData(current.role, undefined, names) : Promise.resolve();
    }, [loadData]);

    const logout = useCallback(() => {
        setToken(null);
        setSession(null);
        clearData();
    }, [clearData]);

    // Restore a previous session (the token survives page reloads when "Remember me" was on).
    useEffect(() => {
        let cancelled = false;
        // The old browser-only version stored its demo data here (including demo passwords); it is not used any more.
        try {
            for (const key of ['products', 'categories', 'sales', 'returns', 'purchase-orders', 'transactions', 'users', 'profile', 'settings', 'password-overrides', 'session', 'seed-date', 'signed-out']) localStorage.removeItem(`retailtrack-${key}`);
            sessionStorage.removeItem('retailtrack-session');
        } catch { /* storage blocked */
        }
        onUnauthorized(() => {
            if (cancelled) return;
            setToken(null);
            setSession(null);
            clearData();
            notify('Your session has ended. Please sign in again.', 'info');
        });
        (async () => {
            if (!getToken()) {
                setReady(true);
                return;
            }
            try {
                // A temporary failure (server busy, rate limit, offline) must not sign the user out: retry, and only a
                // 401 from the server means the saved sign-in is really invalid.
                /** @type {any} */
                let rawMe;
                for (let attempt = 0; ; attempt += 1) {
                    try {
                        rawMe = (await api.get('/auth/me')).data;
                        break;
                    } catch (error) {
                        if ((error instanceof ApiError && error.status === 401) || attempt >= 2) throw error;
                        await new Promise((resolve) => window.setTimeout(resolve, 700 * (attempt + 1)));
                    }
                }
                const me = adaptUser(rawMe);
                if (cancelled) return;
                const remember = (() => {
                    try {
                        return Boolean(localStorage.getItem('retailtrack-token'));
                    } catch {
                        return true;
                    }
                })();
                setSession(toSession(me, remember));
                await loadData(me.role, rawMe);
            } catch (error) {
                if (error instanceof ApiError && error.status === 401) setToken(null);
                else notify('Cannot reach the server right now. Reload the page to try again.', 'error');
            } finally {
                if (!cancelled) setReady(true);
            }
        })();
        return () => {
            cancelled = true;
            onUnauthorized(null);
        };
    }, [clearData, loadData, notify]);

    // ---- Authentication --------------------------------------------------------------------------

    /**
     * Checks the credentials with the server. Returns null for a wrong email or password and throws
     * for anything else (server unreachable, too many attempts...), so the login page can say why.
     */
    const authenticate = useCallback(async (/** @type {string} */ email, /** @type {string} */ password) => {
        try {
            const json = await api.post('/auth/login', {email: email.trim(), password}, {auth: false});
            setToken(json.data.token, false); // kept for this tab until login() decides where to store it
            const user = adaptUser(json.data.user);
            return {userId: user.id, name: user.name, email: user.email, password: '', role: user.role, avatar: user.avatar, token: json.data.token, user};
        } catch (error) {
            if (error instanceof ApiError && (error.status === 401 || error.status === 400)) {
                if (error.status === 401 && /deactivat|disabled|inactive/i.test(error.message)) throw error;
                return null;
            }
            throw error;
        }
    }, []);

    const login = useCallback(async (/** @type {any} */ account, /** @type {boolean} */ remember = true) => {
        setToken(account.token || getToken(), remember);
        setSession(toSession(account.user, remember));
        await loadData(account.user.role);
        // Non-admins see themselves in the user list (the profile page reads the phone number from it).
        if (account.user.role !== 'Administrator') setUsers([account.user]);
    }, [loadData]);

    const changePassword = useCallback(async (/** @type {string} */ currentPassword, /** @type {string} */ newPassword) => {
        try {
            const json = await api.post('/auth/change-password', {currentPassword, newPassword});
            if (json.data?.token) setToken(json.data.token, sessionRef.current?.remember !== false);
            return {ok: true, message: ''};
        } catch (error) {
            return {ok: false, message: messageOf(error)};
        }
    }, []);

    // ---- Wrapper for actions ------------------------------------------------------------------------

    /**
     * Runs an action; on failure shows the server's message and returns the fallback.
     * @template T
     * @param {() => Promise<T>} task
     * @param {T} fallback
     * @returns {Promise<T>}
     */
    const attempt = useCallback(async (/** @type {() => Promise<any>} */ task, /** @type {any} */ fallback) => {
        try {
            return await task();
        } catch (error) {
            notify(messageOf(error), 'error');
            return fallback;
        }
    }, [notify]);

    // ---- Catalog ------------------------------------------------------------------------------------

    const addProduct = useCallback((/** @type {any} */ data) => attempt(async () => {
        const body = {...toProductBody(data), stock: Number(data.stock || 0), active: data.active !== false};
        const json = await api.post('/products', body);
        await reload(['products', 'transactions', 'categories']);
        notify(`${json.data.name} was added to the catalog.`);
        return adaptProduct(json.data);
    }, null), [attempt, notify, reload]);

    const updateProduct = useCallback((/** @type {string} */ id, /** @type {any} */ data) => attempt(async () => {
        await api.patch(`/products/${id}`, toProductBody(data));
        await reload(['products', 'categories']);
        notify('Product details were updated.');
        return true;
    }, false), [attempt, notify, reload]);

    const deleteProduct = useCallback((/** @type {string} */ id) => attempt(async () => {
        await api.delete(`/products/${id}`);
        await reload(['products', 'categories']);
        notify('The product was deleted from the catalog.', 'info');
        return true;
    }, false), [attempt, notify, reload]);

    const toggleProduct = useCallback(async (/** @type {string} */ id) => {
        const selected = products.find((product) => product.id === id);
        if (!selected) return false;
        return attempt(async () => {
            await api.patch(`/products/${id}/status`, {active: !selected.active});
            await reload(['products']);
            notify(`${selected.name} is now ${selected.active ? 'inactive' : 'active'}.`, 'info');
            return true;
        }, false);
    }, [attempt, notify, products, reload]);

    const addCategory = useCallback((/** @type {any} */ data) => attempt(async () => {
        const json = await api.post('/categories', {name: data.name, description: data.description, color: data.color});
        await reload(['categories']);
        notify(`${json.data.name} category created.`);
        return json.data;
    }, null), [attempt, notify, reload]);

    const updateCategory = useCallback((/** @type {string} */ id, /** @type {any} */ data) => attempt(async () => {
        await api.patch(`/categories/${id}`, {name: data.name, description: data.description, color: data.color});
        await reload(['categories', 'products']);
        notify('Category updated.');
        return true;
    }, false), [attempt, notify, reload]);

    const deleteCategory = useCallback(async (/** @type {string} */ id) => {
        const category = categories.find((item) => item.id === id);
        return attempt(async () => {
            await api.delete(`/categories/${id}`);
            await reload(['categories']);
            notify(`${category?.name || 'Category'} deleted.`, 'info');
            return true;
        }, false);
    }, [attempt, categories, notify, reload]);

    // ---- Inventory ----------------------------------------------------------------------------------

    const restock = useCallback((/** @type {string} */ productId, /** @type {number} */ quantity, note = 'Manual stock addition') => attempt(async () => {
        await api.post('/inventory/restock', {productId, quantity: Number(quantity), note});
        const product = products.find((item) => item.id === productId);
        await reload(['products', 'transactions']);
        notify(`${Number(quantity)} units added to ${product?.name || 'the product'}.`);
        return true;
    }, false), [attempt, notify, products, reload]);

    // ---- Sales and returns --------------------------------------------------------------------------

    const createSale = useCallback((/** @type {{customer: string, items: Array<{productId: string, qty: number}>, payment?: string, status?: string}} */ input) => attempt(async () => {
        const {customer, items, payment = 'Cash', status = 'Completed'} = input;
        if (!items.length) {
            notify('Add at least one product to the sale.', 'error');
            return null;
        }
        const json = await api.post('/sales', {
            customer: customer.trim(),
            payment,
            status,
            items: items.map((item) => ({productId: item.productId, qty: Number(item.qty)})),
        });
        const sale = adaptSale(json.data);
        await reload(['products', 'sales', 'transactions']);
        notify(sale.status === 'Completed' ? `${sale.id} completed · stock updated automatically.` : `${sale.id} saved as a pending order.`, sale.status === 'Completed' ? 'success' : 'info');
        return sale;
    }, null), [attempt, notify, reload]);

    const completeSale = useCallback((/** @type {string} */ saleId) => attempt(async () => {
        const sale = salesRef.current.find((item) => item.id === saleId);
        if (!sale) throw new Error('Sale not found.');
        await api.post(`/sales/${sale.uuid}/complete`);
        await reload(['products', 'sales', 'transactions']);
        notify(`${sale.id} completed and stock updated.`);
        return true;
    }, false), [attempt, notify, reload]);

    const cancelSale = useCallback((/** @type {string} */ saleId) => attempt(async () => {
        const sale = salesRef.current.find((item) => item.id === saleId);
        if (!sale) throw new Error('Sale not found.');
        await api.post(`/sales/${sale.uuid}/cancel`);
        await reload(['sales']);
        notify(`${sale.id} cancelled. No stock was changed.`, 'info');
        return true;
    }, false), [attempt, notify, reload]);

    const createReturn = useCallback((/** @type {{saleId: string, reason: string, items: Array<{productId: string, qty: number}>}} */ input) => attempt(async () => {
        const sale = salesRef.current.find((item) => item.id === input.saleId);
        if (!sale) throw new Error('Only completed sales can be returned.');
        const items = input.items.filter((item) => Number(item.qty) > 0).map((item) => ({productId: item.productId, qty: Number(item.qty)}));
        if (!items.length) {
            notify('Select at least one item and quantity to return.', 'error');
            return null;
        }
        const json = await api.post('/returns', {saleId: sale.uuid, reason: input.reason.trim(), items});
        const record = adaptReturn(json.data);
        await reload(['products', 'sales', 'returns', 'transactions']);
        notify(`${record.id} processed for ${input.saleId}. Stock was updated.`);
        return record;
    }, null), [attempt, notify, reload]);

    const createPurchaseOrder = useCallback((/** @type {{productId: string, quantity: number, supplier?: string}} */ input) => attempt(async () => {
        const json = await api.post('/purchase-orders', {productId: input.productId, quantity: Number(input.quantity), supplier: (input.supplier || '').trim()});
        const order = adaptPurchaseOrder(json.data);
        await reload(['purchaseOrders']);
        notify(`${order.id} created for ${order.productName}.`);
        return order;
    }, null), [attempt, notify, reload]);

    // ---- Users, profile, settings, backup ---------------------------------------------------------------

    const addUser = useCallback((/** @type {any} */ data) => attempt(async () => {
        const json = await api.post('/users', {name: data.name, email: data.email, phone: data.phone || undefined, role: toRoleCode(data.role)});
        await reload(['users']);
        notify(`User account for ${data.email} was created. A temporary password was emailed.`);
        return adaptUser(json.data.user || json.data);
    }, null), [attempt, notify, reload]);

    const toggleUser = useCallback(async (/** @type {string} */ id) => {
        const target = users.find((user) => user.id === id);
        if (!target) return;
        await attempt(async () => {
            await api.patch(`/users/${id}/status`, {active: !target.active});
            await reload(['users']);
            notify('User access updated.', 'info');
            return true;
        }, false);
    }, [attempt, notify, reload, users]);

    const updateProfile = useCallback((/** @type {any} */ data) => attempt(async () => {
        const body = Object.fromEntries(Object.entries({name: data.name, email: data.email, phone: data.phone, avatar: data.avatar}).filter(([, value]) => value !== undefined));
        const json = await api.patch('/users/me', body);
        const me = adaptUser(json.data.user || json.data);
        setSession((current) => current ? {...current, name: me.name, email: me.email, avatar: me.avatar} : current);
        setUsers((current) => current.some((user) => user.id === me.id) ? current.map((user) => user.id === me.id ? {...user, ...me} : user) : current);
        notify('Your profile changes were saved.');
        return true;
    }, false), [attempt, notify]);

    const markEmailVerified = useCallback(() => {
        const current = sessionRef.current;
        if (!current) return;
        setUsers((list) => list.map((user) => user.id === current.userId ? {...user, emailVerified: true} : user));
        notify('Your email address has been verified.');
    }, [notify]);

    const updateSettings = useCallback((/** @type {any} */ data) => attempt(async () => {
        const {storeName, location, address, phone, email, currency, lowStockAlerts, saleNotifications, weeklySummary, emailAlerts} = data;
        const json = await api.patch('/settings', {storeName, location, address, phone, email, currency, lowStockAlerts, saleNotifications, weeklySummary, emailAlerts});
        setSettings(adaptSettings(json.data));
        notify('Settings saved successfully.');
        return true;
    }, false), [attempt, notify]);

    const importBackup = useCallback((/** @type {any} */ data) => attempt(async () => {
        const password = window.prompt('Importing replaces ALL current data on the server.\nEnter your administrator password to confirm:');
        if (!password) {
            notify('Import cancelled. Nothing was changed.', 'info');
            return false;
        }
        await api.post('/backup/import', {mode: 'replace', password, confirm: 'REPLACE ALL DATA', backup: data});
        const current = sessionRef.current;
        if (current) await loadData(current.role);
        notify('Backup imported successfully.');
        return true;
    }, false), [attempt, loadData, notify]);

    const profile = useMemo(() => {
        const me = users.find((user) => user.id === session?.userId);
        return {
            name: session?.name || '',
            email: session?.email || '',
            phone: me?.phone || '',
            role: session?.role || 'Cashier',
            avatar: session?.avatar || '',
            emailVerified: me?.emailVerified === true,
        };
    }, [session, users]);

    const value = useMemo(() => /** @type {import('./types.js').StoreValue} */ (/** @type {unknown} */ ({
        products, categories, sales, returns, purchaseOrders, transactions, users, profile, settings,
        session: /** @type {Session} */ (session),
        toasts, dismissToast, notify, login, logout, authenticate,
        changePassword, addProduct, updateProduct, deleteProduct, toggleProduct, restock, createSale, completeSale,
        cancelSale, createReturn, createPurchaseOrder, addCategory, updateCategory, deleteCategory, addUser, toggleUser,
        updateProfile, markEmailVerified, updateSettings, importBackup,
        ready,
    })), [
        products, categories, sales, returns, purchaseOrders, transactions, users, profile, settings, session, toasts, ready,
        dismissToast, notify, login, logout, authenticate, changePassword,
        addProduct, updateProduct, deleteProduct, toggleProduct, restock, createSale, completeSale, cancelSale, createReturn,
        createPurchaseOrder, addCategory, updateCategory, deleteCategory, addUser, toggleUser, updateProfile,
        markEmailVerified, updateSettings, importBackup,
    ]);

    return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
