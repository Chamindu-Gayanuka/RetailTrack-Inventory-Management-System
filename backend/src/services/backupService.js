'use strict';

const crypto = require('node:crypto');
const { z } = require('zod');
const supabase = require('../config/supabase');
const ApiError = require('../utils/ApiError');
const { unwrap, fetchAll } = require('../utils/db');
const { hashPassword, verifyPassword } = require('../utils/password');
const users = require('./userService');
const { validateImage } = require('./imageService');

const FORMAT_VERSION = 3;
const CONFIRM_PHRASE = 'REPLACE ALL DATA';
const ROLE_BY_LABEL = { Administrator: 'ADMIN', 'Inventory Staff': 'INVENTORY_STAFF', Cashier: 'CASHIER' };

// ---------- Export --------------------------------------------------------------------------------

/**
 * Everything the business owns, as one JSON document. Password hashes, OTP codes and token
 * data are never included. Users are identified by email so the file can be restored anywhere.
 */
async function exportAll() {
  const all = (table, columns, order = 'id') => fetchAll(() => supabase.from(table).select(columns).order(order));
  const [userRows, categories, products, sales, saleItems, returns, returnItems, transactions, orders, settingsRow] = await Promise.all([
    all('users', 'id, full_name, email, phone, role, is_active, email_verified'),
    all('categories', 'id, name, description, color'),
    all('products', 'id, sku, name, category_id, selling_price, cost_price, current_stock, minimum_stock, image_url, image_public_id, is_active, created_at'),
    all('sales', 'id, sale_number, customer_name, payment_method, status, processed_by, completed_at, created_at'),
    all('sale_items', 'sale_id, product_id, product_name, sku, quantity, unit_price, unit_cost', 'id'),
    all('returns', 'id, return_number, sale_id, reason, processed_by, created_at'),
    all('return_items', 'return_id, product_id, product_name, sku, quantity, unit_price, unit_cost', 'id'),
    all('inventory_transactions', 'id, product_id, transaction_type, quantity_change, previous_quantity, new_quantity, reason, note, performed_by, related_sale_id, related_return_id, created_at'),
    all('purchase_orders', 'id, po_number, product_id, supplier, quantity, unit_cost, stock_at_creation, minimum_at_creation, created_by, created_at'),
    unwrap(await supabase.from('store_settings').select('*').eq('id', 1).maybeSingle()),
  ]);

  const emailOf = new Map(userRows.map((u) => [u.id, u.email]));
  const group = (rows, key) => rows.reduce((m, r) => (m.get(r[key]) ? m.get(r[key]).push(r) : m.set(r[key], [r]), m), new Map());
  const itemsBySale = group(saleItems, 'sale_id');
  const itemsByReturn = group(returnItems, 'return_id');
  const item = (i) => ({ productId: i.product_id, name: i.product_name, sku: i.sku, qty: i.quantity, price: Number(i.unit_price), cost: Number(i.unit_cost) });

  const doc = {
    formatVersion: FORMAT_VERSION,
    source: 'retailtrack-api',
    exportedAt: new Date().toISOString(),
    settings: settingsRow && {
      storeName: settingsRow.store_name, location: settingsRow.location, address: settingsRow.address,
      phone: settingsRow.phone, email: settingsRow.email, currency: settingsRow.currency,
      lowStockAlerts: settingsRow.low_stock_alerts, saleNotifications: settingsRow.sale_notifications,
      weeklySummary: settingsRow.weekly_summary, emailAlerts: settingsRow.email_alerts,
    },
    users: userRows.map((u) => ({ email: u.email, name: u.full_name, phone: u.phone || '', role: u.role, active: u.is_active, emailVerified: u.email_verified })),
    categories: categories.map((c) => ({ id: c.id, name: c.name, description: c.description || '', color: c.color })),
    products: products.map((p) => ({
      id: p.id, sku: p.sku, name: p.name, categoryId: p.category_id, price: Number(p.selling_price), cost: Number(p.cost_price),
      stock: p.current_stock, minStock: p.minimum_stock, active: p.is_active, image: p.image_url || '', imagePublicId: p.image_public_id || '',
      createdAt: p.created_at,
    })),
    sales: sales.map((s) => ({
      id: s.id, saleNumber: s.sale_number, customer: s.customer_name, payment: s.payment_method, status: s.status,
      cashierEmail: emailOf.get(s.processed_by) || null, createdAt: s.created_at, completedAt: s.completed_at,
      items: (itemsBySale.get(s.id) || []).map(item),
    })),
    returns: returns.map((r) => ({
      id: r.id, returnNumber: r.return_number, saleId: r.sale_id, reason: r.reason,
      processedByEmail: emailOf.get(r.processed_by) || null, createdAt: r.created_at,
      items: (itemsByReturn.get(r.id) || []).map(item),
    })),
    inventoryTransactions: transactions.map((t) => ({
      id: t.id, productId: t.product_id, transactionType: t.transaction_type, quantityChange: t.quantity_change,
      previousQuantity: t.previous_quantity, newQuantity: t.new_quantity, reason: t.reason || '', note: t.note || '',
      performedByEmail: emailOf.get(t.performed_by) || null, saleId: t.related_sale_id, returnId: t.related_return_id, createdAt: t.created_at,
    })),
    purchaseOrders: orders.map((o) => ({
      id: o.id, poNumber: o.po_number, productId: o.product_id, supplier: o.supplier, quantity: o.quantity, unitCost: Number(o.unit_cost),
      currentStock: o.stock_at_creation, minStock: o.minimum_at_creation, createdByEmail: emailOf.get(o.created_by) || null, createdAt: o.created_at,
    })),
  };
  return doc;
}

// ---------- Reading a backup file -------------------------------------------------------------------

const money = z.coerce.number().finite().min(0).max(99_999_999);
const whole = z.coerce.number().int().min(0).max(100_000_000);
const text = (max) => z.string().trim().max(max);
const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'must be a valid date').transform((v) => new Date(v).toISOString());
const idStr = z.union([z.string(), z.number()]).transform(String).pipe(z.string().min(1).max(100));

const itemSchema = z.object({ productId: idStr, name: text(150).optional(), sku: text(40).optional(), qty: z.coerce.number().int().min(1).max(1_000_000), price: money, cost: money.optional() });

const backupSchema = z.object({
  settings: z.record(z.string(), z.unknown()).nullable().optional(),
  users: z.array(z.object({
    email: z.string().trim().toLowerCase().email().max(254), name: text(100).min(2),
    phone: text(30).nullish(), role: z.enum(['ADMIN', 'INVENTORY_STAFF', 'CASHIER']),
    active: z.boolean().default(true), emailVerified: z.boolean().default(false),
  })).default([]),
  categories: z.array(z.object({ id: idStr, name: text(80).min(2), description: text(300).nullish(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullish() })).default([]),
  products: z.array(z.object({
    id: idStr, sku: text(40).min(2), name: text(150).min(2), categoryId: idStr, price: money, cost: money.default(0),
    stock: whole, minStock: whole.default(0), active: z.boolean().default(true), image: z.string().nullish(), imagePublicId: z.string().nullish(),
    createdAt: isoDate.nullish(),
  })).default([]),
  sales: z.array(z.object({
    id: idStr, saleNumber: text(30).min(1), customer: text(120).min(1), payment: z.enum(['CASH', 'CARD', 'OTHER']).default('CASH'),
    status: z.enum(['COMPLETED', 'PENDING', 'CANCELLED']), cashierEmail: z.string().nullish(), cashierName: z.string().nullish(),
    createdAt: isoDate, completedAt: isoDate.nullish(), items: z.array(itemSchema).min(1),
  })).default([]),
  returns: z.array(z.object({
    id: idStr, returnNumber: text(30).min(1), saleId: idStr, reason: text(300).optional(),
    processedByEmail: z.string().nullish(), processedByName: z.string().nullish(), createdAt: isoDate, items: z.array(itemSchema).min(1),
  })).default([]),
  inventoryTransactions: z.array(z.object({
    id: idStr.optional(), productId: idStr, transactionType: z.enum(['STOCK_ADDED', 'SALE_DEDUCTION', 'ADJUSTMENT', 'RETURN']),
    quantityChange: z.coerce.number().int(), previousQuantity: whole, newQuantity: whole, reason: text(300).nullish(), note: text(500).nullish(),
    performedByEmail: z.string().nullish(), saleId: idStr.nullish(), returnId: idStr.nullish(), createdAt: isoDate,
  })).default([]),
  purchaseOrders: z.array(z.object({
    id: idStr.optional(), poNumber: text(30).min(1), productId: idStr, supplier: text(120).default(''), quantity: z.coerce.number().int().min(1),
    unitCost: money.default(0), currentStock: whole.default(0), minStock: whole.default(0),
    createdByEmail: z.string().nullish(), createdByName: z.string().nullish(), createdAt: isoDate,
  })).default([]),
});

/**
 * Converts a backup made by the frontend (formatVersion 1 or 2, browser demo data) into the API format.
 * This is the migration path from the browser-only demo to the real database.
 */
function fromFrontendBackup(data) {
  const warnings = [];
  const list = (v) => (Array.isArray(v) ? v : []);
  const products = list(data.products);
  const stockOf = new Map(products.map((p) => [String(p.id), Number(p.stock) || 0]));
  const saleIds = new Set(list(data.sales).map((s) => String(s.id)));
  const returnIds = new Set(list(data.returns).map((r) => String(r.id)));

  // Frontend movements only record a direction and quantity. Rebuild before/after counts by
  // walking back from each product's current stock; movements that cannot be reconciled are skipped.
  const byProduct = new Map();
  list(data.transactions).forEach((t, index) => {
    const arr = byProduct.get(String(t.productId)) || [];
    arr.push({ t, index });
    byProduct.set(String(t.productId), arr);
  });
  const inventoryTransactions = [];
  let skipped = 0;
  for (const [productId, entries] of byProduct) {
    if (!stockOf.has(productId)) { skipped += entries.length; continue; }
    entries.sort((a, b) => Date.parse(b.t.createdAt) - Date.parse(a.t.createdAt) || a.index - b.index); // newest first
    let current = stockOf.get(productId);
    for (let i = 0; i < entries.length; i += 1) {
      const { t } = entries[i];
      const qty = Number(t.quantity) || 0;
      const change = t.type === 'inbound' ? qty : -qty;
      const previous = current - change;
      if (qty <= 0 || previous < 0 || !Number.isInteger(change)) { skipped += entries.length - i; break; }
      const title = String(t.title || '');
      const type = /^customer return/i.test(title) ? 'RETURN' : t.type === 'inbound' ? 'STOCK_ADDED' : /^sale/i.test(title) ? 'SALE_DEDUCTION' : 'ADJUSTMENT';
      const saleRef = `${title} ${t.note || ''}`.match(/SALE-\d+/i)?.[0]?.toUpperCase();
      const retRef = title.match(/RET-\d+/i)?.[0]?.toUpperCase();
      inventoryTransactions.push({
        productId, transactionType: type, quantityChange: change, previousQuantity: previous, newQuantity: current,
        reason: type === 'ADJUSTMENT' ? String(t.note || title).slice(0, 300) : null,
        note: [title, t.note].filter(Boolean).join(' - ').slice(0, 500),
        saleId: saleRef && saleIds.has(saleRef) ? saleRef : null,
        returnId: retRef && returnIds.has(retRef) ? retRef : null,
        createdAt: t.createdAt,
      });
      current = previous;
    }
  }
  if (skipped) warnings.push(`${skipped} stock movement(s) could not be reconciled with current stock levels and were skipped.`);

  const items = (arr) => list(arr).map((i) => ({ productId: String(i.productId), name: i.name, sku: i.sku, qty: i.qty, price: i.price }));
  const normalized = {
    settings: data.settings && typeof data.settings === 'object' ? data.settings : null,
    users: list(data.users).map((u) => ({
      email: String(u.email || '').toLowerCase(), name: u.name, phone: u.phone || '', role: ROLE_BY_LABEL[u.role] || u.role,
      active: u.active !== false, emailVerified: u.emailVerified === true,
    })),
    categories: list(data.categories).map((c) => ({ id: String(c.id), name: c.name, description: c.description || '', color: /^#[0-9a-fA-F]{6}$/.test(c.color || '') ? c.color : null })),
    products: products.map((p) => ({
      id: String(p.id), sku: String(p.sku).toUpperCase(), name: p.name, categoryId: String(p.categoryId), price: p.price, cost: p.cost ?? 0,
      stock: p.stock, minStock: p.minStock ?? 0, active: p.active !== false, image: p.image || '', createdAt: p.createdAt || null,
    })),
    sales: list(data.sales).map((s) => ({
      id: String(s.id), saleNumber: String(s.id), customer: s.customer, payment: String(s.payment || 'Cash').toUpperCase(),
      status: String(s.status || 'Completed').toUpperCase(), cashierName: s.cashier, createdAt: s.createdAt, completedAt: s.completedAt || null, items: items(s.items),
    })),
    returns: list(data.returns).map((r) => ({
      id: String(r.id), returnNumber: String(r.id), saleId: String(r.saleId), reason: r.reason, processedByName: r.processedBy, createdAt: r.createdAt, items: items(r.items),
    })),
    inventoryTransactions,
    purchaseOrders: list(data.purchaseOrders).map((o) => ({
      id: String(o.id), poNumber: String(o.id), productId: String(o.productId), supplier: o.supplier || '', quantity: o.quantity, unitCost: o.unitCost ?? 0,
      currentStock: o.currentStock ?? 0, minStock: o.minStock ?? 0, createdByName: o.createdBy, createdAt: o.createdAt,
    })),
  };
  return { normalized, warnings };
}

/** Accepts API (v3) or frontend (v1/v2) backups and returns a validated API-format document. */
function readBackup(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw ApiError.badRequest('The selected file does not contain a RetailTrack backup.');
  const version = Number(raw.formatVersion);
  let candidate = raw;
  let warnings = [];
  if (version === 1 || version === 2) {
    ({ normalized: candidate, warnings } = fromFrontendBackup(raw));
  } else if (version !== FORMAT_VERSION) {
    throw ApiError.badRequest('This backup format is not supported. Export a new backup and try again.');
  }

  const parsed = backupSchema.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue.path.slice(0, 2).join(' #');
    throw ApiError.badRequest(`The backup is not valid (${where || 'file'}: ${issue.message}).`);
  }
  return { backup: parsed.data, warnings };
}

// ---------- Preparing the data for the database ---------------------------------------------------------

const fail = (message) => { throw ApiError.badRequest(`The backup is not valid: ${message}`); };
const uniqueOrFail = (values, label) => {
  const seen = new Set();
  for (const v of values) {
    const key = String(v).toLowerCase();
    if (seen.has(key)) fail(`duplicate ${label} "${v}".`);
    seen.add(key);
  }
};
const r2 = (n) => Math.round(n * 100) / 100;

/**
 * Cross-checks the backup, gives every record a fresh id, resolves references, recomputes totals
 * from the line items, and returns the payload for import_backup().
 * @param {ReturnType<typeof readBackup>['backup']} backup
 * @param {{ existingUsers: Array<{id: string, email: string, full_name: string}>, importerId: string, makePasswordHash: () => Promise<string> }} ctx
 */
async function prepare(backup, ctx) {
  const warnings = [];
  uniqueOrFail(backup.categories.map((c) => c.id), 'category id');
  uniqueOrFail(backup.categories.map((c) => c.name), 'category name');
  uniqueOrFail(backup.products.map((p) => p.id), 'product id');
  uniqueOrFail(backup.products.map((p) => p.sku), 'SKU');
  uniqueOrFail(backup.sales.map((s) => s.id), 'sale id');
  uniqueOrFail(backup.sales.map((s) => s.saleNumber), 'sale number');
  uniqueOrFail(backup.returns.map((r) => r.id), 'return id');
  uniqueOrFail(backup.returns.map((r) => r.returnNumber), 'return number');
  uniqueOrFail(backup.purchaseOrders.map((o) => o.poNumber), 'purchase order number');
  uniqueOrFail(backup.users.map((u) => u.email), 'user email');

  // ----- users: existing accounts are kept; accounts only in the backup are added -----
  const emailToId = new Map(ctx.existingUsers.map((u) => [u.email.toLowerCase(), u.id]));
  const nameToId = new Map(ctx.existingUsers.map((u) => [u.full_name.toLowerCase(), u.id]));
  const newUsers = [];
  for (const u of backup.users) {
    if (emailToId.has(u.email)) continue;
    const id = crypto.randomUUID();
    emailToId.set(u.email, id);
    nameToId.set(u.name.toLowerCase(), id);
    newUsers.push({ id, full_name: u.name, email: u.email, phone: u.phone || null, role: u.role, is_active: u.active, email_verified: u.emailVerified, password_hash: await ctx.makePasswordHash() });
  }
  if (newUsers.length) warnings.push(`${newUsers.length} account(s) were restored without a password. They must use "Forgot password" to sign in.`);
  let fallbackUsers = 0;
  const resolveUser = (email, name) => {
    const id = (email && emailToId.get(String(email).toLowerCase())) || (name && nameToId.get(String(name).toLowerCase()));
    if (id) return id;
    fallbackUsers += 1;
    return ctx.importerId;
  };

  // ----- categories & products -----
  const categoryId = new Map(backup.categories.map((c) => [c.id, crypto.randomUUID()]));
  const categories = backup.categories.map((c) => ({ id: categoryId.get(c.id), name: c.name, description: c.description || null, color: c.color || '#6574e8' }));

  const productId = new Map(backup.products.map((p) => [p.id, crypto.randomUUID()]));
  const productById = new Map(backup.products.map((p) => [p.id, p]));
  let droppedImages = 0;
  const products = backup.products.map((p) => {
    if (!categoryId.has(p.categoryId)) fail(`product ${p.sku} uses an unknown category.`);
    let image = p.image || null;
    try { validateImage(image); } catch { image = null; droppedImages += 1; }
    if (image && image.startsWith('data:') && image.length > 700_000) { image = null; droppedImages += 1; }
    return {
      id: productId.get(p.id), sku: p.sku.toUpperCase(), name: p.name, category_id: categoryId.get(p.categoryId),
      selling_price: p.price, cost_price: p.cost, current_stock: p.stock, minimum_stock: p.minStock,
      image_url: image, image_public_id: image && !image.startsWith('data:') ? p.imagePublicId || null : null,
      is_active: p.active, created_at: p.createdAt || null,
    };
  });
  if (droppedImages) warnings.push(`${droppedImages} product image(s) were invalid or too large and were left out.`);

  // ----- sales -----
  const saleId = new Map(backup.sales.map((s) => [s.id, crypto.randomUUID()]));
  const saleById = new Map(backup.sales.map((s) => [s.id, s]));
  const lineOf = (item, where) => {
    const product = productById.get(item.productId);
    if (!product) fail(`${where} refers to an unknown product.`);
    return {
      product_id: productId.get(item.productId), product_name: item.name || product.name, sku: (item.sku || product.sku).toUpperCase(),
      quantity: item.qty, unit_price: item.price, unit_cost: item.cost ?? product.cost, subtotal: r2(item.qty * item.price),
    };
  };

  const saleItems = [];
  const sales = backup.sales.map((s) => {
    const merged = new Map();
    for (const item of s.items) {
      const prev = merged.get(item.productId);
      merged.set(item.productId, prev ? { ...prev, qty: prev.qty + item.qty } : item);
    }
    const lines = [...merged.values()].map((i) => lineOf(i, `sale ${s.saleNumber}`));
    lines.forEach((l) => saleItems.push({ sale_id: saleId.get(s.id), ...l }));
    return {
      id: saleId.get(s.id), sale_number: s.saleNumber, customer_name: s.customer, payment_method: s.payment, status: s.status,
      total_amount: r2(lines.reduce((t, l) => t + l.subtotal, 0)), item_count: lines.reduce((t, l) => t + l.quantity, 0),
      refunded_total: 0, return_status: null, processed_by: resolveUser(s.cashierEmail, s.cashierName),
      completed_at: s.status === 'COMPLETED' ? s.completedAt || s.createdAt : null, created_at: s.createdAt,
    };
  });

  // ----- returns (checked against what was sold) -----
  const returnId = new Map(backup.returns.map((r) => [r.id, crypto.randomUUID()]));
  const returnedQty = new Map(); // `${saleId}:${productId}` -> qty
  const returnItems = [];
  const salesRow = new Map(sales.map((s) => [s.id, s]));
  const returns = backup.returns.map((r) => {
    const sale = saleById.get(r.saleId);
    if (!sale) fail(`return ${r.returnNumber} refers to an unknown sale.`);
    if (sale.status !== 'COMPLETED') fail(`return ${r.returnNumber} refers to a sale that was not completed.`);
    const merged = new Map();
    for (const item of r.items) merged.set(item.productId, { ...item, qty: (merged.get(item.productId)?.qty || 0) + item.qty });
    let total = 0;
    for (const item of merged.values()) {
      const sold = sale.items.filter((i) => i.productId === item.productId).reduce((t, i) => t + i.qty, 0);
      const key = `${r.saleId}:${item.productId}`;
      const already = returnedQty.get(key) || 0;
      if (!sold || already + item.qty > sold) fail(`return ${r.returnNumber} returns more than was sold.`);
      returnedQty.set(key, already + item.qty);
      const soldLine = sale.items.find((i) => i.productId === item.productId);
      const line = lineOf({ ...item, price: soldLine.price, cost: soldLine.cost }, `return ${r.returnNumber}`);
      total += line.subtotal;
      returnItems.push({ return_id: returnId.get(r.id), ...line });
    }
    const row = salesRow.get(saleId.get(r.saleId));
    row.refunded_total = r2(row.refunded_total + total);
    return {
      id: returnId.get(r.id), return_number: r.returnNumber, sale_id: saleId.get(r.saleId), reason: r.reason || 'Customer return',
      total_amount: r2(total), processed_by: resolveUser(r.processedByEmail, r.processedByName), created_at: r.createdAt,
    };
  });
  for (const s of backup.sales) {
    const row = salesRow.get(saleId.get(s.id));
    const soldBy = new Map();
    s.items.forEach((i) => soldBy.set(i.productId, (soldBy.get(i.productId) || 0) + i.qty));
    const anyReturned = [...soldBy.keys()].some((p) => returnedQty.get(`${s.id}:${p}`));
    const allReturned = [...soldBy].every(([p, q]) => (returnedQty.get(`${s.id}:${p}`) || 0) >= q);
    if (anyReturned) row.return_status = allReturned ? 'RETURNED' : 'PARTIALLY_RETURNED';
  }

  // ----- stock history & purchase orders -----
  const inventoryTransactions = backup.inventoryTransactions.map((t) => {
    if (!productId.has(t.productId)) fail('a stock movement refers to an unknown product.');
    if (t.quantityChange === 0 || t.newQuantity !== t.previousQuantity + t.quantityChange) fail('a stock movement has inconsistent quantities.');
    return {
      id: crypto.randomUUID(), product_id: productId.get(t.productId), transaction_type: t.transactionType, quantity_change: t.quantityChange,
      previous_quantity: t.previousQuantity, new_quantity: t.newQuantity, reason: t.reason || null, note: t.note || null,
      performed_by: resolveUser(t.performedByEmail), related_sale_id: (t.saleId && saleId.get(t.saleId)) || null,
      related_return_id: (t.returnId && returnId.get(t.returnId)) || null, created_at: t.createdAt,
    };
  });
  const purchaseOrders = backup.purchaseOrders.map((o) => {
    if (!productId.has(o.productId)) fail(`purchase order ${o.poNumber} refers to an unknown product.`);
    return {
      id: crypto.randomUUID(), po_number: o.poNumber, product_id: productId.get(o.productId), supplier: o.supplier, quantity: o.quantity,
      unit_cost: o.unitCost, stock_at_creation: o.currentStock, minimum_at_creation: o.minStock,
      created_by: resolveUser(o.createdByEmail, o.createdByName), created_at: o.createdAt,
    };
  });
  if (fallbackUsers) warnings.push(`${fallbackUsers} record(s) referred to a person who is not an account here and were assigned to you.`);

  const s = backup.settings || null;
  const settings = s && {
    store_name: s.storeName, location: s.location, address: s.address, phone: s.phone, email: s.email, currency: s.currency,
    low_stock_alerts: s.lowStockAlerts, sale_notifications: s.saleNotifications, weekly_summary: s.weeklySummary, email_alerts: s.emailAlerts,
  };

  return {
    payload: { settings, users: newUsers, categories, products, sales, sale_items: saleItems, returns, return_items: returnItems, inventory_transactions: inventoryTransactions, purchase_orders: purchaseOrders },
    summary: {
      usersToAdd: newUsers.length, categories: categories.length, products: products.length, sales: sales.length,
      returns: returns.length, inventoryTransactions: inventoryTransactions.length, purchaseOrders: purchaseOrders.length,
    },
    warnings,
  };
}

// ---------- Import ----------------------------------------------------------------------------------------

const makeUnusablePasswordHash = () => hashPassword(crypto.randomBytes(32).toString('hex'));

/**
 * mode 'validate': check the file and report what would change.
 * mode 'replace': after re-checking the admin's password and the confirmation phrase, replace all
 * business data in a single database transaction.
 */
async function importBackup({ backup: raw, mode, password, confirm }, admin) {
  const { backup, warnings: readWarnings } = readBackup(raw);
  const existingUsers = await fetchAll(() => supabase.from('users').select('id, email, full_name').order('id'));
  const prepared = await prepare(backup, { existingUsers, importerId: admin.id, makePasswordHash: makeUnusablePasswordHash });
  const warnings = [...readWarnings, ...prepared.warnings];

  if (mode === 'validate') return { valid: true, applied: false, summary: prepared.summary, warnings };

  if (confirm !== CONFIRM_PHRASE) {
    throw ApiError.badRequest(`Type "${CONFIRM_PHRASE}" to confirm that all current data will be replaced.`, { confirm: [`Type "${CONFIRM_PHRASE}" to confirm.`] });
  }
  const account = await users.findByIdWithHash(admin.id);
  if (!password || !account || !(await verifyPassword(password, account.password_hash))) {
    throw ApiError.badRequest('Your password is incorrect.', { password: ['Your password is incorrect.'] });
  }

  const result = unwrap(await supabase.rpc('import_backup', { p_data: prepared.payload }));
  console.log(`Backup imported by ${admin.email}:`, JSON.stringify(result));
  return { valid: true, applied: true, summary: prepared.summary, result, warnings };
}

module.exports = { FORMAT_VERSION, CONFIRM_PHRASE, exportAll, readBackup, fromFrontendBackup, prepare, importBackup };
