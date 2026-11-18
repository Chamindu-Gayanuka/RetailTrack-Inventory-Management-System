/**
 * @typedef {import('./types.js').Product} Product
 * @typedef {import('./types.js').StoreSettings} StoreSettings
 */

/** @param {number} value */
export const currency = (value) => `Rs. ${Number(value || 0).toLocaleString('en-LK', {maximumFractionDigits: 0})}`;
/** @param {number} value */
export const number = (value) => Number(value || 0).toLocaleString('en-LK');

/**
 * @param {string | number | Date} [value]
 * @param {boolean} [withTime]
 */
export const dateLabel = (value, withTime = false) => {
    if (!value) return '-';
    const date = new Date(value);
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        ...(withTime ? {hour: '2-digit', minute: '2-digit'} : {}),
    });
};

/** @param {string | number | Date} [value] */
export const relativeTime = (value) => {
    if (!value) return '-';
    const diff = Date.now() - new Date(value).getTime();
    const minutes = Math.max(0, Math.floor(diff / 60000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
};

/** @param {Product} product */
export const getStockStatus = (product) => {
    if (!product.active) return 'inactive';
    if (Number(product.stock) === 0) return 'out';
    if (Number(product.stock) <= Number(product.minStock)) return 'low';
    return 'in';
};

/** @param {Product} product */
export const getSeverity = (product) => {
    if (Number(product.stock) === 0) return 'critical';
    if (Number(product.stock) <= Number(product.minStock)) return 'low';
    return 'healthy';
};

/** @type {Record<string, string>} */
export const statusLabel = {
    in: 'In Stock',
    low: 'Low Stock',
    out: 'Out of Stock',
    inactive: 'Inactive',
    critical: 'Critical',
    Completed: 'Completed',
    Pending: 'Pending',
    Cancelled: 'Cancelled',
    Active: 'Active',
};

/** @type {Record<string, string[]>} */
export const rolePermissions = {
    Administrator: ['Full Inventory Access', 'User Management', 'Financial Reporting', 'Audit Logs'],
    'Inventory Staff': ['Manage Products', 'Add and Update Stock', 'Process Customer Returns', 'View Stock Alerts', 'Inventory Summaries'],
    Cashier: ['Search Products', 'Check Available Stock', 'Process Customer Sales', 'View Sales History'],
};

/** @type {StoreSettings} */
export const initialSettings = {
    storeName: 'Ape Kade',
    location: 'Padiyathalawa',
    address: 'Main Street, Padiyathalawa, Sri Lanka',
    phone: '+94 55 224 6800',
    email: 'hello@apekade.lk',
    currency: 'Sri Lankan Rupee (LKR)',
    lowStockAlerts: true,
    saleNotifications: true,
    weeklySummary: true,
    emailAlerts: false,
};
