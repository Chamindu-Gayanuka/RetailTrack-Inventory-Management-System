'use strict';

const supabase = require('../config/supabase');
const { unwrap } = require('../utils/db');

const COLUMNS =
  'store_name, location, address, phone, email, currency, low_stock_alerts, sale_notifications, weekly_summary, email_alerts, updated_at';

const toPublic = (r) => ({
  storeName: r.store_name,
  location: r.location,
  address: r.address,
  phone: r.phone,
  email: r.email,
  currency: r.currency,
  lowStockAlerts: r.low_stock_alerts,
  saleNotifications: r.sale_notifications,
  weeklySummary: r.weekly_summary,
  emailAlerts: r.email_alerts,
  updatedAt: r.updated_at,
});

const FIELD_TO_COLUMN = {
  storeName: 'store_name',
  location: 'location',
  address: 'address',
  phone: 'phone',
  email: 'email',
  currency: 'currency',
  lowStockAlerts: 'low_stock_alerts',
  saleNotifications: 'sale_notifications',
  weeklySummary: 'weekly_summary',
  emailAlerts: 'email_alerts',
};

/** The settings table holds exactly one row (id = 1); create it if a fresh database lacks it. */
async function ensureRow() {
  const row = unwrap(await supabase.from('store_settings').select(COLUMNS).eq('id', 1).maybeSingle());
  if (row) return row;
  return unwrap(await supabase.from('store_settings').insert({ id: 1 }).select(COLUMNS).single());
}

async function get() {
  return toPublic(await ensureRow());
}

/** What the login page may show before anyone is signed in. */
async function getPublic() {
  const { storeName, location } = await get();
  return { storeName, location };
}

async function update(changes) {
  await ensureRow();
  const patch = Object.fromEntries(Object.entries(changes).map(([field, value]) => [FIELD_TO_COLUMN[field], value]));
  if (Object.keys(patch).length === 0) return get();
  return toPublic(unwrap(await supabase.from('store_settings').update(patch).eq('id', 1).select(COLUMNS).single()));
}

module.exports = { get, getPublic, update };
