'use strict';

const supabase = require('../config/supabase');
const { unwrap } = require('../utils/db');

const TX_COLUMNS =
  'id, product_id, transaction_type, quantity_change, previous_quantity, new_quantity, reason, note, performed_by, related_sale_id, related_return_id, created_at';

/** Same thresholds as the frontend: out of stock is critical, <= 35% of minimum (at least 2) is a warning. */
function alertSeverity(stock, minStock) {
  if (stock === 0) return 'critical';
  return stock <= Math.max(2, minStock * 0.35) ? 'warning' : 'attention';
}

const suggestedRestock = (stock, minStock) => Math.max(minStock * 2 - stock, minStock);

async function summary() {
  const rows = unwrap(
    await supabase.from('products').select('current_stock, cost_price, stock_status').eq('is_active', true),
  );
  return {
    activeProducts: rows.length,
    totalUnits: rows.reduce((sum, r) => sum + r.current_stock, 0),
    stockValue: Math.round(rows.reduce((sum, r) => sum + r.current_stock * Number(r.cost_price), 0) * 100) / 100,
    lowStockCount: rows.filter((r) => r.stock_status === 'LOW_STOCK').length,
    outOfStockCount: rows.filter((r) => r.stock_status === 'OUT_OF_STOCK').length,
  };
}

/** Active products at or below their minimum, most urgent first. */
async function alerts({ severity } = {}) {
  const rows = unwrap(
    await supabase
      .from('products')
      .select('id, sku, name, category_id, current_stock, minimum_stock, image_url, updated_at')
      .eq('is_active', true)
      .in('stock_status', ['LOW_STOCK', 'OUT_OF_STOCK']),
  );
  return rows
    .map((r) => ({
      id: r.id,
      sku: r.sku,
      name: r.name,
      categoryId: r.category_id,
      stock: r.current_stock,
      minStock: r.minimum_stock,
      image: r.image_url || '',
      updatedAt: r.updated_at,
      severity: alertSeverity(r.current_stock, r.minimum_stock),
      suggestedRestock: suggestedRestock(r.current_stock, r.minimum_stock),
    }))
    .filter((a) => !severity || a.severity === severity)
    .sort((a, b) => a.stock / (a.minStock || 1) - b.stock / (b.minStock || 1));
}

function describe(tx, product) {
  const name = product?.name || 'Removed product';
  switch (tx.transaction_type) {
    case 'STOCK_ADDED':
      return /initial stock/i.test(tx.note || '') ? `Initial stock · ${name}` : `Restock ${name}`;
    case 'SALE_DEDUCTION':
      return `Sale #${tx.note || ''}`.trim();
    case 'RETURN':
      return `Customer return ${(tx.note || '').split(' - ')[1] || ''}`.trim();
    default:
      return `Stock adjustment · ${name}`;
  }
}

async function transactions({ productId, type, from, to, page, limit }) {
  let query = supabase
    .from('inventory_transactions')
    .select(TX_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false });
  if (productId) query = query.eq('product_id', productId);
  if (type) query = query.eq('transaction_type', type);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);
  const start = (page - 1) * limit;
  const res = await query.range(start, start + limit - 1);
  const rows = unwrap(res);

  const productIds = [...new Set(rows.map((r) => r.product_id))];
  const userIds = [...new Set(rows.map((r) => r.performed_by))];
  const products = productIds.length ? unwrap(await supabase.from('products').select('id, name, sku').in('id', productIds)) : [];
  const users = userIds.length ? unwrap(await supabase.from('users').select('id, full_name').in('id', userIds)) : [];
  const productMap = new Map(products.map((p) => [p.id, p]));
  const userMap = new Map(users.map((u) => [u.id, u.full_name]));

  const data = rows.map((r) => {
    const product = productMap.get(r.product_id);
    return {
      id: r.id,
      type: r.quantity_change > 0 ? 'inbound' : 'outbound',
      transactionType: r.transaction_type,
      title: describe(r, product),
      productId: r.product_id,
      productName: product?.name || null,
      sku: product?.sku || null,
      quantity: Math.abs(r.quantity_change),
      quantityChange: r.quantity_change,
      previousQuantity: r.previous_quantity,
      newQuantity: r.new_quantity,
      reason: r.reason || '',
      note: r.note || '',
      performedBy: userMap.get(r.performed_by) || null,
      saleId: r.related_sale_id,
      returnId: r.related_return_id,
      createdAt: r.created_at,
    };
  });
  return { data, total: res.count ?? data.length };
}

const addStock = async ({ productId, quantity, note }, userId) =>
  unwrap(await supabase.rpc('add_stock_atomic', { p_product_id: productId, p_quantity: quantity, p_note: note || null, p_user: userId }));

const adjustStock = async ({ productId, change, reason }, userId) =>
  unwrap(await supabase.rpc('adjust_stock_atomic', { p_product_id: productId, p_change: change, p_reason: reason, p_user: userId }));

module.exports = { alertSeverity, suggestedRestock, summary, alerts, transactions, addStock, adjustStock };
