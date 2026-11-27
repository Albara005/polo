'use strict';
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { DATA_DIR, UPLOAD_DIR, ROOT } = require('./config');
const { seedData } = require('./seed-data');

const db = new DatabaseSync(path.join(DATA_DIR, 'polo.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  desc_en TEXT NOT NULL DEFAULT '',
  desc_ar TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  price INTEGER NOT NULL,
  compare_price INTEGER,
  size_label TEXT NOT NULL DEFAULT 'size',
  images TEXT NOT NULL DEFAULT '[]',
  is_new INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS variants (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  stock INTEGER,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS looks (
  id INTEGER PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  image TEXT NOT NULL DEFAULT '{}',
  discount INTEGER NOT NULL DEFAULT 10,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS look_items (
  look_id INTEGER NOT NULL REFERENCES looks(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  pos INTEGER NOT NULL,
  x REAL NOT NULL DEFAULT 50,
  y REAL NOT NULL DEFAULT 50
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  district TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  payment TEXT NOT NULL,
  subtotal INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  shipping INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  lang TEXT NOT NULL DEFAULT 'ar',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_items (
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER,
  variant_id INTEGER,
  slug TEXT,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  size TEXT NOT NULL,
  image TEXT,
  qty INTEGER NOT NULL,
  price INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS order_events (
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON variants(product_id);
CREATE INDEX IF NOT EXISTS idx_look_items_look ON look_items(look_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
`);

const DEFAULT_SETTINGS = {
  shipping_fee: 2500,          // halalas (25 SAR)
  free_shipping_over: 30000,   // halalas (300 SAR); 0 = never free
  cod_enabled: 1,
  bank_enabled: 1,
  bank_details: '',
  whatsapp: ''
};

function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

const parse = (s, fallback) => { try { return JSON.parse(s); } catch (_) { return fallback; } };

/* ---------- settings ---------- */
function getSettings() {
  const out = { ...DEFAULT_SETTINGS };
  for (const row of db.prepare('SELECT key, value FROM settings').all()) {
    out[row.key] = typeof DEFAULT_SETTINGS[row.key] === 'number' ? Number(row.value) : row.value;
  }
  return out;
}
function saveSettings(values) {
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  tx(() => {
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (values[key] !== undefined) stmt.run(key, String(values[key]));
    }
  });
  return getSettings();
}

/* ---------- products ---------- */
function hydrateProduct(row, variants) {
  if (!row) return null;
  return {
    ...row,
    images: parse(row.images, []),
    is_new: !!row.is_new,
    active: !!row.active,
    variants: variants || db.prepare('SELECT id, size, stock FROM variants WHERE product_id = ? ORDER BY sort, id').all(row.id)
  };
}

function listProducts({ includeInactive = false } = {}) {
  const rows = db.prepare(`SELECT * FROM products ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY sort, id`).all();
  const vars = db.prepare('SELECT id, product_id, size, stock FROM variants ORDER BY sort, id').all();
  const byProduct = new Map();
  for (const v of vars) {
    if (!byProduct.has(v.product_id)) byProduct.set(v.product_id, []);
    byProduct.get(v.product_id).push({ id: v.id, size: v.size, stock: v.stock });
  }
  return rows.map((r) => hydrateProduct(r, byProduct.get(r.id) || []));
}

function getProduct(id) {
  return hydrateProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id));
}
function getProductBySlug(slug) {
  return hydrateProduct(db.prepare('SELECT * FROM products WHERE slug = ? AND active = 1').get(slug));
}

function slugify(s) {
  const base = String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 60);
  return base || 'product';
}
function uniqueSlug(wanted, exceptId) {
  let slug = slugify(wanted);
  let i = 2;
  const q = db.prepare('SELECT id FROM products WHERE slug = ?');
  while (true) {
    const hit = q.get(slug);
    if (!hit || hit.id === exceptId) return slug;
    slug = `${slugify(wanted)}-${i++}`;
  }
}

function saveProduct(input, id) {
  return tx(() => {
    const data = {
      slug: uniqueSlug(input.slug || input.name_en, id),
      name_en: input.name_en, name_ar: input.name_ar,
      desc_en: input.desc_en || '', desc_ar: input.desc_ar || '',
      category: input.category, price: input.price,
      compare_price: input.compare_price || null,
      size_label: input.size_label === 'shoe' ? 'shoe' : 'size',
      images: JSON.stringify(input.images || []),
      is_new: input.is_new ? 1 : 0, active: input.active ? 1 : 0,
      sort: Number.isFinite(input.sort) ? input.sort : 0
    };
    if (id) {
      db.prepare(`UPDATE products SET slug=$slug, name_en=$name_en, name_ar=$name_ar, desc_en=$desc_en, desc_ar=$desc_ar, category=$category,
        price=$price, compare_price=$compare_price, size_label=$size_label, images=$images, is_new=$is_new, active=$active, sort=$sort WHERE id=$id`).run({ ...data, id });
    } else {
      id = Number(db.prepare(`INSERT INTO products (slug, name_en, name_ar, desc_en, desc_ar, category, price, compare_price, size_label, images, is_new, active, sort)
        VALUES ($slug, $name_en, $name_ar, $desc_en, $desc_ar, $category, $price, $compare_price, $size_label, $images, $is_new, $active, $sort)`).run(data).lastInsertRowid);
    }
    // Variants: keep ids for sizes that stay (carts and orders refer to them)
    const existing = db.prepare('SELECT id, size FROM variants WHERE product_id = ?').all(id);
    const keep = new Set();
    (input.variants || []).forEach((v, i) => {
      const found = existing.find((e) => e.size === v.size);
      if (found) {
        db.prepare('UPDATE variants SET stock = ?, sort = ? WHERE id = ?').run(v.stock ?? null, i, found.id);
        keep.add(found.id);
      } else {
        const vid = Number(db.prepare('INSERT INTO variants (product_id, size, stock, sort) VALUES (?, ?, ?, ?)').run(id, v.size, v.stock ?? null, i).lastInsertRowid);
        keep.add(vid);
      }
    });
    for (const e of existing) if (!keep.has(e.id)) db.prepare('DELETE FROM variants WHERE id = ?').run(e.id);
    return getProduct(id);
  });
}

function deleteProduct(id) {
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
}

/* ---------- looks ---------- */
function listLooks({ includeInactive = false } = {}) {
  const rows = db.prepare(`SELECT * FROM looks ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY sort, id`).all();
  const items = db.prepare('SELECT look_id, product_id, pos, x, y FROM look_items ORDER BY look_id, pos').all();
  return rows.map((r) => ({
    ...r,
    active: !!r.active,
    image: parse(r.image, {}),
    items: items.filter((i) => i.look_id === r.id).map(({ product_id, x, y }) => ({ product_id, x, y }))
  }));
}
function getLook(id) {
  return listLooks({ includeInactive: true }).find((l) => l.id === id) || null;
}
function saveLook(input, id) {
  return tx(() => {
    const data = {
      name_en: input.name_en, name_ar: input.name_ar,
      image: JSON.stringify(input.image || {}),
      discount: input.discount, active: input.active ? 1 : 0,
      sort: Number.isFinite(input.sort) ? input.sort : 0
    };
    if (id) {
      db.prepare('UPDATE looks SET name_en=$name_en, name_ar=$name_ar, image=$image, discount=$discount, active=$active, sort=$sort WHERE id=$id').run({ ...data, id });
    } else {
      id = Number(db.prepare('INSERT INTO looks (name_en, name_ar, image, discount, active, sort) VALUES ($name_en, $name_ar, $image, $discount, $active, $sort)').run(data).lastInsertRowid);
    }
    db.prepare('DELETE FROM look_items WHERE look_id = ?').run(id);
    const ins = db.prepare('INSERT INTO look_items (look_id, product_id, pos, x, y) VALUES (?, ?, ?, ?, ?)');
    (input.items || []).forEach((it, i) => ins.run(id, it.product_id, i, it.x, it.y));
    return getLook(id);
  });
}
function deleteLook(id) {
  db.prepare('DELETE FROM looks WHERE id = ?').run(id);
}

/* ---------- orders ---------- */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newCode() {
  const bytes = crypto.randomBytes(6);
  let s = 'PL-';
  for (const b of bytes) s += CODE_CHARS[b % CODE_CHARS.length];
  return s;
}

function createOrder(order, lines) {
  return tx(() => {
    // Re-check and reserve stock inside the transaction
    for (const l of lines) {
      const v = db.prepare('SELECT stock FROM variants WHERE id = ?').get(l.variant_id);
      if (!v) throw Object.assign(new Error('unavailable'), { status: 409, code: 'unavailable' });
      if (v.stock !== null && v.stock < l.qty) throw Object.assign(new Error('stock'), { status: 409, code: 'stock' });
    }
    for (const l of lines) {
      db.prepare('UPDATE variants SET stock = stock - ? WHERE id = ? AND stock IS NOT NULL').run(l.qty, l.variant_id);
    }
    let code = newCode();
    while (db.prepare('SELECT 1 FROM orders WHERE code = ?').get(code)) code = newCode();
    const id = Number(db.prepare(`INSERT INTO orders (code, status, name, phone, city, district, address, notes, payment, subtotal, discount, shipping, total, lang)
      VALUES ($code, 'new', $name, $phone, $city, $district, $address, $notes, $payment, $subtotal, $discount, $shipping, $total, $lang)`).run({ ...order, code }).lastInsertRowid);
    const ins = db.prepare('INSERT INTO order_items (order_id, product_id, variant_id, slug, name_en, name_ar, size, image, qty, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const l of lines) ins.run(id, l.product_id, l.variant_id, l.slug, l.name_en, l.name_ar, l.size, l.image || null, l.qty, l.price);
    db.prepare("INSERT INTO order_events (order_id, status) VALUES (?, 'new')").run(id);
    return getOrderByCode(code);
  });
}

function hydrateOrder(row) {
  if (!row) return null;
  return {
    ...row,
    items: db.prepare('SELECT product_id, variant_id, slug, name_en, name_ar, size, image, qty, price FROM order_items WHERE order_id = ?').all(row.id),
    events: db.prepare('SELECT status, created_at FROM order_events WHERE order_id = ? ORDER BY rowid').all(row.id)
  };
}
function getOrderByCode(code) {
  return hydrateOrder(db.prepare('SELECT * FROM orders WHERE code = ?').get(code));
}
function getOrder(id) {
  return hydrateOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(id));
}
function listOrders({ status } = {}) {
  const rows = status
    ? db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY id DESC LIMIT 500').all(status)
    : db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 500').all();
  const counts = db.prepare('SELECT order_id, SUM(qty) AS n FROM order_items GROUP BY order_id').all();
  const byId = new Map(counts.map((c) => [c.order_id, c.n]));
  return rows.map((r) => ({ ...r, item_count: byId.get(r.id) || 0 }));
}
function setOrderStatus(id, status) {
  return tx(() => {
    const cur = db.prepare('SELECT status FROM orders WHERE id = ?').get(id);
    if (!cur) return null;
    if (cur.status !== status) {
      // Return stock when an order is cancelled, take it again if un-cancelled
      if (status === 'cancelled' || cur.status === 'cancelled') {
        const sign = status === 'cancelled' ? 1 : -1;
        for (const it of db.prepare('SELECT variant_id, qty FROM order_items WHERE order_id = ?').all(id)) {
          db.prepare('UPDATE variants SET stock = MAX(0, stock + ?) WHERE id = ? AND stock IS NOT NULL').run(sign * it.qty, it.variant_id);
        }
      }
      db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
      db.prepare('INSERT INTO order_events (order_id, status) VALUES (?, ?)').run(id, status);
    }
    return getOrder(id);
  });
}
function orderStats() {
  return db.prepare("SELECT status, COUNT(*) AS n, SUM(total) AS total FROM orders GROUP BY status").all();
}

/* ---------- seed ---------- */
function seedIfEmpty() {
  const has = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (has) return;
  const seedDir = path.join(ROOT, 'seed', 'images');
  for (const f of fs.readdirSync(seedDir)) {
    const dest = path.join(UPLOAD_DIR, 'seed-' + f);
    if (!fs.existsSync(dest)) fs.copyFileSync(path.join(seedDir, f), dest);
  }
  const { P, L } = seedData((f) => `/uploads/seed-${f}`);
  const ids = {};
  P.forEach(([slug, en, ar, category, price, sizeLabel, sizes, image, dEn, dAr], i) => {
    ids[slug] = saveProduct({
      slug, name_en: en, name_ar: ar, desc_en: dEn, desc_ar: dAr, category, price, size_label: sizeLabel,
      images: [image], is_new: slug === 'hoodie-black', active: true, sort: i,
      variants: sizes.map((size) => ({ size, stock: null }))
    }).id;
  });
  L.forEach(([en, ar, m, products, pp], i) => {
    saveLook({
      name_en: en, name_ar: ar, discount: 10, active: true, sort: i,
      image: { src: `/uploads/seed-original-look-${m}.webp`, small: `/uploads/seed-model-${m}-640.webp`, w: 1080, h: 1920 },
      items: products.map((slug, k) => ({ product_id: ids[slug], x: pp[k][0], y: pp[k][1] }))
    });
  });
}

module.exports = {
  db, tx, getSettings, saveSettings,
  listProducts, getProduct, getProductBySlug, saveProduct, deleteProduct,
  listLooks, getLook, saveLook, deleteLook,
  createOrder, getOrder, getOrderByCode, listOrders, setOrderStatus, orderStats,
  seedIfEmpty
};
