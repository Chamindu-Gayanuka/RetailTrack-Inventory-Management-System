import {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
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

const StoreContext = createContext(null);
const signedOutKey = 'retailtrack-signed-out';

const defaultSession = {
    userId: demoAccounts[0].userId,
    name: demoAccounts[0].name,
    email: demoAccounts[0].email,
    role: demoAccounts[0].role,
    avatar: demoAccounts[0].avatar,
    remember: true,
};

function useSessionState() {
    const [session, setSession] = useState(() => {
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
    });

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

function usePersistentState(key, fallback) {
    const [state, setState] = useState(() => {
        try {
            const saved = localStorage.getItem(key);
            return saved ? JSON.parse(saved) : fallback;
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

export function StoreProvider({children}) {
    const [products, setProducts] = usePersistentState('retailtrack-products', seedProducts);
    const [categories, setCategories] = usePersistentState('retailtrack-categories', seedCategories);
    const [sales, setSales] = usePersistentState('retailtrack-sales', seedSales);
    const [transactions, setTransactions] = usePersistentState('retailtrack-transactions', seedTransactions);
    const [users, setUsers] = usePersistentState('retailtrack-users', seedUsers);
    const [profile, setProfile] = usePersistentState('retailtrack-profile', initialProfile);
    const [settings, setSettings] = usePersistentState('retailtrack-settings', initialSettings);
    const [session, setSession] = useSessionState();
    const [toasts, setToasts] = useState([]);

    const dismissToast = useCallback((id) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const notify = useCallback((message, type = 'success', title) => {
        const id = `${Date.now()}-${Math.random()}`;
        setToasts((current) => [...current.slice(-2), {id, message, type, title}]);
        window.setTimeout(() => dismissToast(id), 4200);
        return id;
    }, [dismissToast]);

    const login = useCallback((account, remember = true) => {
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

    const addProduct = useCallback((data) => {
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

    const updateProduct = useCallback((id, data) => {
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

    const toggleProduct = useCallback((id) => {
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

    const createSale = useCallback(({customer, items, payment = 'Cash', status = 'Completed'}) => {
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
                return sold ? {
                    ...product,
                    stock: product.stock - sold.qty,
                    updatedAt: new Date().toISOString()
                } : product;
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

    const completeSale = useCallback((saleId) => {
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
        setSales((current) => current.map((item) => item.id === saleId ? {
            ...item,
            status: 'Completed',
            completedAt: new Date().toISOString()
        } : item));
        setProducts((current) => current.map((product) => {
            const sold = sale.items.find((item) => item.productId === product.id);
            return sold ? {...product, stock: product.stock - sold.qty, updatedAt: new Date().toISOString()} : product;
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

    const cancelSale = useCallback((saleId) => {
        const sale = sales.find((item) => item.id === saleId);
        if (!sale || sale.status !== 'Pending') {
            notify('Only pending sales can be cancelled.', 'error');
            return false;
        }
        setSales((current) => current.map((item) => item.id === saleId ? {...item, status: 'Cancelled'} : item));
        notify(`${sale.id} cancelled. No stock was changed.`, 'info');
        return true;
    }, [notify, sales, setSales]);

    const addCategory = useCallback((data) => {
        const category = {...data, id: `cat${Date.now()}`};
        setCategories((current) => [...current, category]);
        notify(`${category.name} category created.`);
        return category;
    }, [notify, setCategories]);

    const updateCategory = useCallback((id, data) => {
        setCategories((current) => current.map((category) => category.id === id ? {...category, ...data} : category));
        notify('Category updated.');
    }, [notify, setCategories]);

    const deleteCategory = useCallback((id) => {
        const category = categories.find((item) => item.id === id);
        if (products.some((product) => product.categoryId === id)) {
            notify('Move products to another category before deleting this one.', 'error');
            return false;
        }
        setCategories((current) => current.filter((categoryItem) => categoryItem.id !== id));
        notify(`${category?.name || 'Category'} deleted.`, 'info');
        return true;
    }, [categories, notify, products, setCategories]);

    const addUser = useCallback((data) => {
        const user = {
            ...data,
            id: `u${Date.now()}`,
            active: true,
            lastActive: new Date().toISOString(),
        };
        setUsers((current) => [...current, user]);
        notify(`Invitation sent to ${user.email}.`);
        return user;
    }, [notify, setUsers]);

    const toggleUser = useCallback((id) => {
        if (id === 'u1') {
            notify('The primary administrator account cannot be deactivated.', 'error');
            return;
        }
        setUsers((current) => current.map((user) => user.id === id ? {...user, active: !user.active} : user));
        notify('User access updated.', 'info');
    }, [notify, setUsers]);

    const updateProfile = useCallback((data) => {
        if (session?.userId === 'u1') setProfile((current) => ({...current, ...data}));
        setUsers((current) => current.map((user) => user.id === session?.userId ? {...user, ...data} : user));
        setSession((current) => current ? {...current, ...data} : current);
        notify('Your profile changes were saved.');
    }, [notify, session?.userId, setProfile, setSession, setUsers]);

    const updateSettings = useCallback((data) => {
        setSettings((current) => ({...current, ...data}));
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
        notify('Demo data has been restored.', 'info');
    }, [notify, setCategories, setProducts, setProfile, setSales, setSettings, setTransactions, setUsers]);

    const value = useMemo(() => ({
        products, categories, sales, transactions, users, profile, settings, session, toasts,
        dismissToast, notify, login, logout, addProduct, updateProduct, toggleProduct, restock,
        createSale, completeSale, cancelSale, addCategory, updateCategory, deleteCategory,
        addUser, toggleUser, updateProfile, updateSettings, resetDemo,
    }), [
        products, categories, sales, transactions, users, profile, settings, session, toasts,
        dismissToast, notify, login, logout, addProduct, updateProduct, toggleProduct, restock,
        createSale, completeSale, cancelSale, addCategory, updateCategory, deleteCategory,
        addUser, toggleUser, updateProfile, updateSettings, resetDemo,
    ]);

    return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
    const context = useContext(StoreContext);
    if (!context) throw new Error('useStore must be used inside StoreProvider');
    return context;
}

export function downloadCsv(filename, rows) {
    const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = rows.map((row) => row.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}