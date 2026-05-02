/* ============================================================
   THE LEDGE BAGUIO — Store Controller (fixed + secured)
   ============================================================ */

const { getDB }   = require('../config/db');
const logger      = require('../utils/logger');
const { sanitizeObject, sanitizeString } = require('../utils/sanitize');

const MAX_ORDER_ITEMS   = 50;
const MAX_ITEM_QUANTITY = 100;
const MAX_STOCK_DELTA   = 10000;
const MAX_HONESTY_ITEMS = 30;
const MAX_CUSTOM_PRICE  = 99999;

function isValidPHMobile(num) {
  return /^(09|\+639)\d{9}$/.test((num || '').replace(/\s/g, ''));
}

// ── GCash Accounts ────────────────────────────────────────────

function getGcashAccounts(req, res, next) {
  try {
    const accounts = getDB().all('store_gcash_accounts').map(a => {
      const safe = { id: a.id, name: a.name, holder_name: a.holder_name, is_active: a.is_active };
      // Only admin/manager see the full number; store_staff see masked
      safe.number = ['admin','manager'].includes(req.user.role)
        ? a.number
        : (a.number || '').replace(/(\d{4})\d+(\d{4})/, '$1****$2');
      return safe;
    });
    res.json(accounts);
  } catch (err) { next(err); }
}

function createGcashAccount(req, res, next) {
  try {
    const clean = sanitizeObject(req.body);
    const { name, number, holder_name } = clean;
    if (!name || !number || !holder_name)
      return res.status(400).json({ error: 'name, number, and holder_name are required' });
    if (!isValidPHMobile(number))
      return res.status(400).json({ error: 'number must be a valid PH mobile number (09XXXXXXXXX)' });

    const db  = getDB();
    const acc = db.insert('store_gcash_accounts', { name, number, holder_name, is_active: true });
    logger.info('GCash account created', { id: acc.id, by: req.user.id });
    res.status(201).json({ id: acc.id, message: 'GCash account created' });
  } catch (err) { next(err); }
}

function updateGcashAccount(req, res, next) {
  try {
    const clean = sanitizeObject(req.body);
    const db    = getDB();
    const acc   = db.findById('store_gcash_accounts', req.params.id);
    if (!acc) return res.status(404).json({ error: 'Account not found' });

    const changes = {};
    if (clean.name        !== undefined) changes.name        = clean.name;
    if (clean.holder_name !== undefined) changes.holder_name = clean.holder_name;
    if (clean.is_active   !== undefined) changes.is_active   = Boolean(parseInt(clean.is_active));
    if (clean.number !== undefined) {
      if (!isValidPHMobile(clean.number))
        return res.status(400).json({ error: 'number must be a valid PH mobile number' });
      changes.number = clean.number;
    }

    db.updateById('store_gcash_accounts', req.params.id, changes);
    logger.info('GCash account updated', { id: req.params.id, by: req.user.id });
    res.json({ message: 'Account updated' });
  } catch (err) { next(err); }
}

function deleteGcashAccount(req, res, next) {
  try {
    const db  = getDB();
    const acc = db.findById('store_gcash_accounts', req.params.id);
    if (!acc) return res.status(404).json({ error: 'Account not found' });
    db.deleteById('store_gcash_accounts', req.params.id);
    logger.info('GCash account deleted', { id: req.params.id, by: req.user.id });
    res.json({ message: 'Account removed' });
  } catch (err) { next(err); }
}

// ── Products ─────────────────────────────────────────────────

function getPublicProducts(req, res, next) {
  try {
    const products = getDB()
      .find('store_products', p => p.is_active && p.stock > 0)
      .map(p => ({ id: p.id, name: p.name, category: p.category, price: p.price, unit: p.unit }));
    res.json(products);
  } catch (err) { next(err); }
}

function getProducts(req, res, next) {
  try {
    const products = getDB().all('store_products')
      .sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name));
    res.json(products);
  } catch (err) { next(err); }
}

function createProduct(req, res, next) {
  try {
    const clean = sanitizeObject(req.body);
    const { name, category, price, stock, unit, description } = clean;
    if (!name || price === undefined || price === '')
      return res.status(400).json({ error: 'name and price are required' });

    const parsedPrice = parseFloat(price);
    const parsedStock = parseInt(stock) || 0;
    if (isNaN(parsedPrice) || parsedPrice < 0)
      return res.status(400).json({ error: 'price must be a non-negative number' });
    if (parsedStock < 0)
      return res.status(400).json({ error: 'stock must be non-negative' });

    const db = getDB();
    const p  = db.insert('store_products', {
      name, category: category || 'General',
      price: parsedPrice, stock: parsedStock,
      unit: unit || 'pc', description: description || null, is_active: true,
    });
    logger.info('Product created', { id: p.id, name, by: req.user.id });
    res.status(201).json({ id: p.id, message: 'Product created' });
  } catch (err) { next(err); }
}

function updateProduct(req, res, next) {
  try {
    const clean = sanitizeObject(req.body);
    const db    = getDB();
    const p     = db.findById('store_products', req.params.id);
    if (!p) return res.status(404).json({ error: 'Product not found' });

    const changes = {};
    if (clean.name        !== undefined) changes.name        = clean.name;
    if (clean.category    !== undefined) changes.category    = clean.category;
    if (clean.unit        !== undefined) changes.unit        = clean.unit;
    if (clean.description !== undefined) changes.description = clean.description;
    if (clean.is_active   !== undefined) changes.is_active   = Boolean(parseInt(clean.is_active));
    if (clean.price !== undefined) {
      const v = parseFloat(clean.price);
      if (isNaN(v) || v < 0) return res.status(400).json({ error: 'price must be non-negative' });
      changes.price = v;
    }
    if (clean.stock !== undefined) {
      const v = parseInt(clean.stock);
      if (isNaN(v) || v < 0) return res.status(400).json({ error: 'stock must be non-negative' });
      changes.stock = v;
    }

    db.updateById('store_products', req.params.id, changes);
    logger.info('Product updated', { id: req.params.id, by: req.user.id });
    res.json({ message: 'Product updated' });
  } catch (err) { next(err); }
}

function deleteProduct(req, res, next) {
  try {
    const db = getDB();
    if (!db.findById('store_products', req.params.id))
      return res.status(404).json({ error: 'Product not found' });
    db.updateById('store_products', req.params.id, { is_active: false });
    logger.info('Product deactivated', { id: req.params.id, by: req.user.id });
    res.json({ message: 'Product deactivated' });
  } catch (err) { next(err); }
}

function adjustStock(req, res, next) {
  try {
    const { adjustment, note } = req.body;
    const delta = parseInt(adjustment);
    if (isNaN(delta) || delta === 0)
      return res.status(400).json({ error: 'adjustment must be a non-zero integer' });
    if (Math.abs(delta) > MAX_STOCK_DELTA)
      return res.status(400).json({ error: `Adjustment cannot exceed ±${MAX_STOCK_DELTA}` });

    const db = getDB();
    const p  = db.findById('store_products', req.params.id);
    if (!p) return res.status(404).json({ error: 'Product not found' });

    const newStock = Math.max(0, (p.stock || 0) + delta);
    db.updateById('store_products', req.params.id, { stock: newStock });
    db.insert('store_stock_log', {
      product_id: p.id, product_name: p.name,
      delta, stock_before: p.stock, stock_after: newStock,
      note: sanitizeString(note || '').slice(0, 255),
      by_user_id: req.user.id,
    });

    logger.info('Stock adjusted', { product: p.name, delta, newStock, by: req.user.id });
    res.json({ message: 'Stock updated', new_stock: newStock });
  } catch (err) { next(err); }
}

// ── Orders (POS) ─────────────────────────────────────────────

function getOrders(req, res, next) {
  try {
    const { date, status } = req.query;
    if (status && !['completed','pending_payment','voided'].includes(status))
      return res.status(400).json({ error: 'Invalid status filter' });
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))
      return res.status(400).json({ error: 'date must be YYYY-MM-DD' });

    const db = getDB();
    let orders = db.all('store_orders');
    if (status) orders = orders.filter(o => o.status === status);
    if (date)   orders = orders.filter(o => o.created_at?.startsWith(date));
    orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(orders);
  } catch (err) { next(err); }
}

function createOrder(req, res, next) {
  try {
    const { items, payment_method, gcash_account_id, customer_name, customer_note } = req.body;

    if (!items || !Array.isArray(items) || !items.length)
      return res.status(400).json({ error: 'items array is required' });
    if (items.length > MAX_ORDER_ITEMS)
      return res.status(400).json({ error: `Cannot process more than ${MAX_ORDER_ITEMS} line items` });
    if (!payment_method || !['cash','gcash'].includes(payment_method))
      return res.status(400).json({ error: 'payment_method must be cash or gcash' });
    if (payment_method === 'gcash' && !gcash_account_id)
      return res.status(400).json({ error: 'gcash_account_id required for GCash payment' });

    const db = getDB();
    const resolvedItems = [];
    let total = 0;

    for (const item of items) {
      const quantity = parseInt(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1)
        return res.status(400).json({ error: 'Each item quantity must be a positive integer' });
      if (quantity > MAX_ITEM_QUANTITY)
        return res.status(400).json({ error: `Quantity cannot exceed ${MAX_ITEM_QUANTITY} per item` });

      const product = db.findById('store_products', item.product_id);
      if (!product || !product.is_active)
        return res.status(400).json({ error: 'Product not found or inactive' });
      if (product.stock < quantity)
        return res.status(400).json({ error: `Insufficient stock for ${product.name}` });

      // Price always from DB — never client-supplied
      const subtotal = parseFloat(product.price) * quantity;
      total += subtotal;
      resolvedItems.push({
        product_id: product.id, product_name: product.name,
        price: product.price, quantity, subtotal,
      });
    }

    let gcash_account = null;
    if (payment_method === 'gcash') {
      const acc = db.findById('store_gcash_accounts', gcash_account_id);
      if (!acc || acc.is_active === false)
        return res.status(400).json({ error: 'GCash account not found or inactive' });
      gcash_account = { id: acc.id, name: acc.name, number: acc.number, holder_name: acc.holder_name };
    }

    const order = db.insert('store_orders', {
      items: resolvedItems, total, payment_method, gcash_account,
      customer_name: sanitizeString(customer_name || 'Walk-in').slice(0, 100),
      customer_note: sanitizeString(customer_note || '').slice(0, 500),
      status: payment_method === 'cash' ? 'completed' : 'pending_payment',
      created_by: req.user.id,
      confirmed_at: payment_method === 'cash' ? new Date().toISOString() : null,
    });

    for (const item of resolvedItems) {
      const prod = db.findById('store_products', item.product_id);
      if (prod) db.updateById('store_products', item.product_id, { stock: Math.max(0, (prod.stock || 0) - item.quantity) });
    }

    logger.info('Order created', { id: order.id, total, method: payment_method, by: req.user.id });
    res.status(201).json({ id: order.id, total, status: order.status, gcash_account });
  } catch (err) { next(err); }
}

function confirmPayment(req, res, next) {
  try {
    const db    = getDB();
    const order = db.findById('store_orders', req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'pending_payment')
      return res.status(400).json({ error: 'Order is not awaiting payment' });

    db.updateById('store_orders', req.params.id, {
      status: 'completed', confirmed_at: new Date().toISOString(), confirmed_by: req.user.id,
    });
    logger.info('Payment confirmed', { orderId: order.id, by: req.user.id });
    res.json({ message: 'Payment confirmed', id: order.id });
  } catch (err) { next(err); }
}

function voidOrder(req, res, next) {
  try {
    const db    = getDB();
    const order = db.findById('store_orders', req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status === 'voided') return res.status(400).json({ error: 'Order already voided' });

    for (const item of (order.items || [])) {
      const prod = db.findById('store_products', item.product_id);
      if (prod) db.updateById('store_products', item.product_id, { stock: (prod.stock || 0) + item.quantity });
    }

    db.updateById('store_orders', req.params.id, {
      status: 'voided', voided_at: new Date().toISOString(), voided_by: req.user.id,
    });
    logger.info('Order voided', { orderId: order.id, by: req.user.id });
    res.json({ message: 'Order voided' });
  } catch (err) { next(err); }
}

// ── Honesty Log ───────────────────────────────────────────────

function submitHonestyEntry(req, res, next) {
  try {
    const { items, note } = req.body;
    if (!items || !Array.isArray(items) || !items.length)
      return res.status(400).json({ error: 'items array is required' });
    if (items.length > MAX_HONESTY_ITEMS)
      return res.status(400).json({ error: `Cannot log more than ${MAX_HONESTY_ITEMS} items at once` });

    const db = getDB();
    let total = 0;
    const resolvedItems = [];

    for (const item of items) {
      const name = sanitizeString(item.name || '').slice(0, 200);
      if (!name) return res.status(400).json({ error: 'Each item must have a name' });

      let price    = Math.max(0, Math.min(parseFloat(item.price) || 0, MAX_CUSTOM_PRICE));
      const quantity = Math.max(1, Math.min(parseInt(item.quantity) || 1, MAX_ITEM_QUANTITY));

      // FIX BUG 5: if product_id is supplied, verify the price against the DB
      // This prevents a user from selecting a listed product but reporting a lower price
      let product_id = null;
      if (item.product_id) {
        const product = db.findById('store_products', item.product_id);
        if (product && product.is_active) {
          product_id = product.id;
          price      = product.price; // always use the server price for listed items
        }
        // If product not found, treat as a custom item (product_id = null, price from client)
      }

      const subtotal = price * quantity;
      total += subtotal;
      resolvedItems.push({
        product_id,
        name,
        price,
        quantity,
        subtotal,
      });
    }

    const entry = db.insert('store_honesty_log', {
      guest_user_id: req.user.id,
      guest_email:   req.user.email,
      items:         resolvedItems,
      total,
      note:          sanitizeString(note || '').slice(0, 1000),
      status:        'pending',
    });

    res.status(201).json({ id: entry.id, total, message: 'Honesty entry submitted. Thank you!' });
  } catch (err) { next(err); }
}

function getMyHonestyEntries(req, res, next) {
  try {
    const entries = getDB()
      .find('store_honesty_log', e => e.guest_user_id === req.user.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(entries);
  } catch (err) { next(err); }
}

function getAllHonestyEntries(req, res, next) {
  try {
    const { status } = req.query;
    if (status && !['pending','verified','disputed'].includes(status))
      return res.status(400).json({ error: 'Invalid status filter' });

    const db = getDB();
    let entries = db.all('store_honesty_log');
    if (status) entries = entries.filter(e => e.status === status);
    entries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(entries);
  } catch (err) { next(err); }
}

function verifyHonestyEntry(req, res, next) {
  try {
    const { status, note } = req.body;
    if (!['verified','disputed'].includes(status))
      return res.status(400).json({ error: 'status must be verified or disputed' });

    const db    = getDB();
    const entry = db.findById('store_honesty_log', req.params.id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    db.updateById('store_honesty_log', req.params.id, {
      status,
      reviewed_by:   req.user.id,
      reviewed_at:   new Date().toISOString(),
      reviewer_note: sanitizeString(note || '').slice(0, 500),
    });
    logger.info('Honesty entry reviewed', { id: req.params.id, status, by: req.user.id });
    res.json({ message: `Entry marked as ${status}` });
  } catch (err) { next(err); }
}

// ── Reports ───────────────────────────────────────────────────

function getStoreReports(req, res, next) {
  try {
    const db     = getDB();
    const orders = db.find('store_orders', o => o.status === 'completed');
    const today  = new Date().toISOString().split('T')[0];

    const todayOrders  = orders.filter(o => o.created_at?.startsWith(today));
    const todayRevenue = todayOrders.reduce((s, o) => s + (o.total || 0), 0);
    const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);

    const productSales = {};
    for (const order of orders) {
      for (const item of (order.items || [])) {
        if (!productSales[item.product_name])
          productSales[item.product_name] = { name: item.product_name, qty: 0, revenue: 0 };
        productSales[item.product_name].qty     += item.quantity;
        productSales[item.product_name].revenue += item.subtotal;
      }
    }
    const best_sellers = Object.values(productSales).sort((a, b) => b.qty - a.qty).slice(0, 10);
    const low_stock    = db.find('store_products', p => p.is_active && p.stock <= 5).sort((a, b) => a.stock - b.stock);

    res.json({ today_orders: todayOrders.length, today_revenue: todayRevenue, total_orders: orders.length, total_revenue: totalRevenue, best_sellers, low_stock });
  } catch (err) { next(err); }
}

module.exports = {
  getGcashAccounts, createGcashAccount, updateGcashAccount, deleteGcashAccount,
  getPublicProducts, getProducts, createProduct, updateProduct, deleteProduct, adjustStock,
  getOrders, createOrder, confirmPayment, voidOrder,
  submitHonestyEntry, getMyHonestyEntries, getAllHonestyEntries, verifyHonestyEntry,
  getStoreReports,
};
