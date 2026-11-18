'use strict';

const supabase = require('../config/supabase');
const ApiError = require('../utils/ApiError');
const { unwrap, fetchAll } = require('../utils/db');
const inventory = require('./inventoryService');
const sales = require('./salesService');

const DAY = 86_400_000;
const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

// ---------- Periods ----------------------------------------------------------------------

/** Picks a readable bucket size for the span, like the frontend charts do. */
function autoBucket(fromMs, toMs) {
  const days = (toMs - fromMs) / DAY;
  if (days <= 14) return 'day';
  if (days <= 90) return 'week';
  if (days <= 730) return 'month';
  return 'year';
}

function floorLocal(localMs, bucket) {
  const d = new Date(localMs);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  if (bucket === 'year') return Date.UTC(y, 0, 1);
  if (bucket === 'month') return Date.UTC(y, m, 1);
  const start = Date.UTC(y, m, day);
  return bucket === 'week' ? start - ((d.getUTCDay() + 6) % 7) * DAY : start; // weeks start on Monday
}

function nextLocal(localMs, bucket) {
  const d = new Date(localMs);
  if (bucket === 'year') return Date.UTC(d.getUTCFullYear() + 1, 0, 1);
  if (bucket === 'month') return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  return localMs + (bucket === 'week' ? 7 : 1) * DAY;
}

/** Every bucket start (YYYY-MM-DD, local time) between two instants, so charts have no gaps. */
function bucketKeys(fromMs, toMs, bucket, tz) {
  const offset = tz * 60_000;
  const keys = [];
  let cursor = floorLocal(fromMs + offset, bucket);
  const end = toMs - 1 + offset;
  while (cursor <= end && keys.length < 1500) {
    keys.push(new Date(cursor).toISOString().slice(0, 10));
    cursor = nextLocal(cursor, bucket);
  }
  return keys;
}

async function earliestSaleMs() {
  const row = unwrap(
    await supabase.from('sales').select('created_at').eq('status', 'COMPLETED').order('created_at', { ascending: true }).limit(1).maybeSingle(),
  );
  return row ? new Date(row.created_at).getTime() : null;
}

/** Normalises from/to/bucket. A missing `from` means "since the first sale"; a missing `to` means now. */
async function resolvePeriod({ from, to, bucket = 'auto', tz = 330 }) {
  const toMs = to ? new Date(to).getTime() : Date.now();
  let fromMs = from ? new Date(from).getTime() : await earliestSaleMs();
  if (fromMs === null) fromMs = toMs - DAY;
  if (fromMs > toMs) throw ApiError.badRequest('The start date must be before the end date.', { from: ['The start date must be before the end date.'] });
  const resolved = bucket === 'auto' ? autoBucket(fromMs, toMs) : bucket;
  return {
    fromIso: from || null,
    toIso: to || null,
    fromMs,
    toMs,
    bucket: resolved,
    tz,
    info: { from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString(), bucket: resolved, tz },
  };
}

// ---------- Shared data loading ------------------------------------------------------------------

async function categoryMap() {
  const rows = unwrap(await supabase.from('categories').select('id, name, color'));
  return new Map(rows.map((c) => [c.id, c]));
}

async function loadSales(period, { categoryId = null, cashierId = null } = {}) {
  const data = unwrap(
    await supabase.rpc('report_sales', {
      p_from: period.fromIso,
      p_to: period.toIso,
      p_bucket: period.bucket,
      p_tz: period.tz,
      p_category: categoryId,
      p_cashier: cashierId,
    }),
  );
  const byBucket = new Map(data.series.map((s) => [s.bucket, s]));
  const series = bucketKeys(period.fromMs, period.toMs, period.bucket, period.tz).map((key) => {
    const s = byBucket.get(key);
    const revenue = round2(s?.revenue);
    const cost = round2(s?.cost);
    return { bucket: key, revenue, cost, profit: round2(revenue - cost), orders: s?.orders || 0 };
  });
  const revenue = round2(data.totals.revenue);
  const cogs = round2(data.totals.cogs);
  return { totals: { revenue, cogs, units: data.totals.units, orders: data.totals.orders }, series, byProduct: data.byProduct, byCategory: data.byCategory };
}

const categoryOut = (cats, id) => ({ categoryId: id, categoryName: cats.get(id)?.name || null });

// ---------- Reports -------------------------------------------------------------------------------

async function salesReport(query) {
  const period = await resolvePeriod(query);
  const [data, cats] = await Promise.all([loadSales(period, { categoryId: query.categoryId }), categoryMap()]);
  const { revenue, orders, units } = data.totals;
  const best = [...data.series].sort((a, b) => b.revenue - a.revenue)[0];

  return {
    period: period.info,
    totals: { revenue, orders, units, averageOrderValue: orders ? round2(revenue / orders) : 0 },
    bestPeriod: best && best.revenue > 0 ? { bucket: best.bucket, revenue: best.revenue, orders: best.orders } : null,
    series: data.series.map(({ bucket, revenue: r, orders: o }) => ({ bucket, revenue: r, orders: o })),
    byCategory: data.byCategory.map((c) => ({
      ...categoryOut(cats, c.categoryId),
      color: cats.get(c.categoryId)?.color || null,
      revenue: round2(c.revenue),
      units: c.units,
    })),
    topProducts: data.byProduct.map((p, index) => ({
      rank: index + 1,
      productId: p.productId,
      sku: p.sku,
      name: p.name,
      ...categoryOut(cats, p.categoryId),
      units: p.units,
      revenue: round2(p.revenue),
    })),
  };
}

async function profitReport(query) {
  const period = await resolvePeriod(query);
  const [data, cats] = await Promise.all([loadSales(period, { categoryId: query.categoryId }), categoryMap()]);
  const { revenue, cogs } = data.totals;
  const grossProfit = round2(revenue - cogs);
  const margin = (p, r) => (r ? round2((p / r) * 100) : 0);

  return {
    period: period.info,
    totals: { revenue, cogs, grossProfit, marginPercent: margin(grossProfit, revenue), orders: data.totals.orders, units: data.totals.units },
    series: data.series,
    byProduct: data.byProduct
      .map((p) => {
        const profit = round2(p.revenue - p.cost);
        return {
          productId: p.productId,
          sku: p.sku,
          name: p.name,
          ...categoryOut(cats, p.categoryId),
          units: p.units,
          revenue: round2(p.revenue),
          cost: round2(p.cost),
          profit,
          marginPercent: margin(profit, p.revenue),
        };
      })
      .sort((a, b) => b.profit - a.profit),
  };
}

/**
 * Fast = top third of selling products, slow = bottom third, no-sales = nothing sold in the period.
 * Products tied on units always get the same class.
 */
function classifyMovement(rows) {
  const sold = rows.filter((r) => r.units > 0).sort((a, b) => b.units - a.units || a.name.localeCompare(b.name));
  const n = sold.length;
  const fastN = Math.ceil(n / 3);
  const slowN = n >= 2 ? Math.ceil(n / 3) : 0;
  const fastCut = n ? sold[fastN - 1].units : Infinity;
  const slowCut = slowN ? sold[n - slowN].units : -1;

  const classes = new Map();
  for (const r of sold) {
    classes.set(r.productId, r.units >= fastCut ? 'FAST' : r.units <= slowCut ? 'SLOW' : 'NORMAL');
  }
  return rows.map((r) => ({ ...r, movement: r.units > 0 ? classes.get(r.productId) : 'NO_SALES' }));
}

async function movementReport(query) {
  const period = await resolvePeriod(query);
  const [raw, cats] = await Promise.all([
    supabase.rpc('report_movement', { p_from: period.fromIso, p_to: period.toIso, p_category: query.categoryId || null }).then(unwrap),
    categoryMap(),
  ]);
  const days = Math.max(1, (period.toMs - period.fromMs) / DAY);
  let rows = classifyMovement(raw).map((r) => ({
    productId: r.productId,
    sku: r.sku,
    name: r.name,
    ...categoryOut(cats, r.categoryId),
    stock: r.stock,
    minStock: r.minStock,
    unitsSold: r.units,
    revenue: round2(r.revenue),
    unitsPerDay: round2(r.units / days),
    lastSoldAt: r.lastSoldAt,
    movement: r.movement,
  }));
  const summary = {
    fast: rows.filter((r) => r.movement === 'FAST').length,
    normal: rows.filter((r) => r.movement === 'NORMAL').length,
    slow: rows.filter((r) => r.movement === 'SLOW').length,
    noSales: rows.filter((r) => r.movement === 'NO_SALES').length,
  };
  if (query.movement) rows = rows.filter((r) => r.movement === query.movement);
  return { period: period.info, summary, products: rows };
}

async function inventoryReport({ categoryId, status, search } = {}) {
  const cats = await categoryMap();
  const rows = await fetchAll(() => {
    let q = supabase
      .from('products')
      .select('id, sku, name, category_id, selling_price, cost_price, current_stock, minimum_stock, is_active, stock_status')
      .order('name', { ascending: true })
      .order('id');
    if (categoryId) q = q.eq('category_id', categoryId);
    if (status) q = q.eq('stock_status', status);
    return q;
  });
  const term = (search || '').trim().toLowerCase();
  const products = rows
    .filter((r) => !term || `${r.name} ${r.sku}`.toLowerCase().includes(term))
    .map((r) => ({
      productId: r.id,
      sku: r.sku,
      name: r.name,
      ...categoryOut(cats, r.category_id),
      stock: r.current_stock,
      minStock: r.minimum_stock,
      cost: Number(r.cost_price),
      price: Number(r.selling_price),
      costValue: round2(r.current_stock * r.cost_price),
      retailValue: round2(r.current_stock * r.selling_price),
      active: r.is_active,
      stockStatus: r.stock_status,
    }))
    .sort((a, b) => b.costValue - a.costValue);

  const active = products.filter((p) => p.active);
  const costValue = round2(active.reduce((s, p) => s + p.costValue, 0));
  const retailValue = round2(active.reduce((s, p) => s + p.retailValue, 0));
  return {
    totals: {
      activeProducts: active.length,
      units: active.reduce((s, p) => s + p.stock, 0),
      costValue,
      retailValue,
      potentialMargin: round2(retailValue - costValue),
      lowStockCount: active.filter((p) => p.stockStatus === 'LOW_STOCK').length,
      outOfStockCount: active.filter((p) => p.stockStatus === 'OUT_OF_STOCK').length,
    },
    products,
  };
}

// ---------- Dashboard -------------------------------------------------------------------------------

/** Defaults to the last 7 days, like the frontend's weekly view. */
async function dashboard(query, viewer) {
  const now = Date.now();
  const period = await resolvePeriod({ ...query, from: query.from || new Date(now - 6 * DAY).toISOString(), to: query.to });
  const isCashier = viewer.role === 'CASHIER';
  const seesInventoryMoney = !isCashier;

  const [data, products, lowStock, recent, counts, transactions] = await Promise.all([
    loadSales(period, { cashierId: isCashier ? viewer.id : null }),
    fetchAll(() =>
      supabase.from('products').select('current_stock, minimum_stock, cost_price').eq('is_active', true).order('id'),
    ),
    inventory.alerts(),
    sales.listSales({ page: 1, limit: 5, from: period.fromIso, to: period.toIso }, viewer),
    unwrap(await supabase.from('categories').select('id')),
    isCashier ? null : inventory.transactions({ page: 1, limit: 4, from: period.fromIso, to: period.toIso }),
  ]);

  const critical = products.filter((p) => p.current_stock > 0 && p.current_stock <= Math.max(2, p.minimum_stock * 0.25)).length;
  const out = products.filter((p) => p.current_stock === 0).length;
  const low = products.filter((p) => p.current_stock > 0 && p.current_stock <= p.minimum_stock).length - critical;
  const lowCount = products.filter((p) => p.current_stock <= p.minimum_stock).length;
  const { revenue, orders } = data.totals;

  return {
    role: viewer.role,
    period: period.info,
    stats: {
      activeProducts: products.length,
      categories: counts.length,
      unitsInStock: products.reduce((s, p) => s + p.current_stock, 0),
      lowStockProducts: lowCount,
      periodRevenue: revenue,
      periodOrders: orders,
      salesRecords: recent.total,
      ...(seesInventoryMoney && { inventoryValue: round2(products.reduce((s, p) => s + p.current_stock * Number(p.cost_price), 0)) }),
    },
    salesSeries: data.series.map(({ bucket, revenue: r, orders: o }) => ({ bucket, revenue: r, orders: o })),
    stockBreakdown: { inStock: products.length - low - critical - out, lowStock: low, critical, outOfStock: out },
    lowStock: lowStock.slice(0, 5),
    recentSales: recent.data,
    recentTransactions: transactions ? transactions.data : [],
  };
}

module.exports = { salesReport, profitReport, movementReport, inventoryReport, dashboard, classifyMovement, bucketKeys, autoBucket };
