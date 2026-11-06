/** @param {any} data */
export function createBackup(data) {
    return {
        formatVersion: 2,
        exportedAt: new Date().toISOString(),
        settings: data.settings,
        profile: data.profile,
        categories: data.categories,
        products: data.products,
        sales: data.sales,
        returns: data.returns || [],
        purchaseOrders: data.purchaseOrders || [],
        transactions: data.transactions,
        users: data.users,
    };
}

/** @param {any} data */
export function downloadBackupJson(data) {
    const payload = JSON.stringify(createBackup(data), null, 2);
    const url = URL.createObjectURL(new Blob([payload], {type: 'application/json'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = `retailtrack-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * @param {any} value
 * @param {string} label
 */
function requireRecordArray(value, label) {
    if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
    if (value.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) throw new Error(`${label} contains an invalid record.`);
}

/**
 * Validate a backup before showing the replacement confirmation.
 * @param {string} text
 * @returns {any}
 */
export function parseBackup(text) {
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error('This file is not valid JSON. Choose a RetailTrack JSON backup.');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The selected file does not contain a RetailTrack backup.');
    if (![1, 2].includes(Number(data.formatVersion))) throw new Error('This backup format is not supported. Export a new backup and try again.');
    requireRecordArray(data.products, 'Products');
    requireRecordArray(data.sales, 'Sales');
    requireRecordArray(data.transactions, 'Inventory movements');
    requireRecordArray(data.users, 'Users');
    if (data.categories !== undefined) requireRecordArray(data.categories, 'Categories');
    if (data.returns !== undefined) requireRecordArray(data.returns, 'Customer returns');
    if (data.purchaseOrders !== undefined) requireRecordArray(data.purchaseOrders, 'Purchase orders');

    const productIds = new Set();
    const skus = new Set();
    data.products.forEach((/** @type {any} */ product) => {
        if (!product.id || !product.sku || !product.name) throw new Error('Every product must have an ID, SKU and name.');
        if (![product.price, product.cost, product.stock, product.minStock].every((value) => Number.isFinite(Number(value)) && Number(value) >= 0)) throw new Error(`Product ${product.name} has invalid pricing or stock values.`);
        if (productIds.has(product.id)) throw new Error(`Duplicate product ID: ${product.id}.`);
        if (skus.has(String(product.sku).toLowerCase())) throw new Error(`Duplicate product SKU: ${product.sku}.`);
        productIds.add(product.id);
        skus.add(String(product.sku).toLowerCase());
    });
    const saleIds = new Set();
    data.sales.forEach((/** @type {any} */ sale) => {
        if (!sale.id || !sale.customer || !Array.isArray(sale.items) || !sale.createdAt) throw new Error('Every sale must have an ID, customer, items and date.');
        if (saleIds.has(sale.id)) throw new Error(`Duplicate sale ID: ${sale.id}.`);
        saleIds.add(sale.id);
        sale.items.forEach((/** @type {any} */ item) => {
            if (!item.productId || !item.name || !Number.isFinite(Number(item.qty)) || Number(item.qty) <= 0 || !Number.isFinite(Number(item.price))) throw new Error(`Sale ${sale.id} contains an invalid item.`);
        });
    });
    data.users.forEach((/** @type {any} */ user) => {
        if (!user.id || !user.name || !user.email || !['Administrator', 'Inventory Staff', 'Cashier'].includes(user.role)) throw new Error('The backup contains an invalid user account.');
    });
    return data;
}

/** @param {File} file */
export async function readBackupFile(file) {
    if (file.size > 8 * 1024 * 1024) throw new Error('Choose a backup smaller than 8 MB.');
    return parseBackup(await file.text());
}