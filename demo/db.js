'use strict';
// In-browser stand-in for server/db.js, used only by the claude.ai preview build.
// Same function names and return shapes; data is kept in localStorage.
const { seedData } = require('./seed-data');

const KEY = 'polo-demo-db-v1';
const DEFAULT_SETTINGS = { shipping_fee: 2500, free_shipping_over: 30000, cod_enabled: 1, bank_enabled: 1, bank_details: '', whatsapp: '' };
const clone = (v) => JSON.parse(JSON.stringify(v));
const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

let S = null;

function blank() {
  return { next: { product: 1, variant: 1, look: 1, order: 1 }, products: [], looks: [], orders: [], settings: { ...DEFAULT_SETTINGS } };
}
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && Array.isArray(raw.products) && raw.next) return raw;
  } catch (_) { /* fall through */ }
  return null;
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (err) {
    throw Object.assign(new Error('storage_full'), { status: 507 });
  }
}
function db() {
  if (!S) { S = load(); if (!S) { S = blank(); seedIfEmpty(); } }
  return S;
}
const tx = (fn) => fn();

/* ---------- settings ---------- */
function getSettings() { return { ...DEFAULT_SETTINGS, ...db().settings }; }
function saveSettings(values) {
  const s = db();
  for (const k of Object.keys(DEFAULT_SETTINGS)) if (values[k] !== undefined) s.settings[k] = values[k];
  persist();
  return getSettings();
}

/* ---------- products ---------- */
const bySort = (a, b) => (a.sort - b.sort) || (a.id - b.id);
function listProducts({ includeInactive = false } = {}) {
  return clone(db().products.filter((p) => includeInactive || p.active).sort(bySort));
}
function getProduct(id) { const p = db().products.find((x) => x.id === id); return p ? clone(p) : null; }
function getProductBySlug(slug) { const p = db().products.find((x) => x.slug === slug && x.active); return p ? clone(p) : null; }

function slugify(s) {
  const base = String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 60);
  return base || 'product';
}
function uniqueSlug(wanted, exceptId) {
  let slug = slugify(wanted);
  let i = 2;
  while (db().products.some((p) => p.slug === slug && p.id !== exceptId)) slug = `${slugify(wanted)}-${i++}`;
  return slug;
}
function saveProduct(input, id) {
  const s = db();
  let p = id ? s.products.find((x) => x.id === id) : null;
  if (!p) { p = { id: s.next.product++, created_at: now(), variants: [] }; s.products.push(p); }
  Object.assign(p, {
    slug: uniqueSlug(input.slug || input.name_en, p.id),
    name_en: input.name_en, name_ar: input.name_ar, desc_en: input.desc_en || '', desc_ar: input.desc_ar || '',
    category: input.category, price: input.price, compare_price: input.compare_price || null,
    size_label: input.size_label === 'shoe' ? 'shoe' : 'size', images: input.images || [],
    is_new: !!input.is_new, active: !!input.active, sort: Number.isFinite(input.sort) ? input.sort : 0
  });
  // keep variant ids for sizes that stay (carts and orders refer to them)
  p.variants = (input.variants || []).map((v) => {
    const found = p.variants.find((e) => e.size === v.size);
    return { id: found ? found.id : s.next.variant++, size: v.size, stock: v.stock ?? null };
  });
  persist();
  return clone(p);
}
function deleteProduct(id) {
  const s = db();
  s.products = s.products.filter((p) => p.id !== id);
  s.looks.forEach((l) => { l.items = l.items.filter((i) => i.product_id !== id); });
  persist();
}

/* ---------- looks ---------- */
function listLooks({ includeInactive = false } = {}) {
  return clone(db().looks.filter((l) => includeInactive || l.active).sort(bySort));
}
function getLook(id) { const l = db().looks.find((x) => x.id === id); return l ? clone(l) : null; }
function saveLook(input, id) {
  const s = db();
  let l = id ? s.looks.find((x) => x.id === id) : null;
  if (!l) { l = { id: s.next.look++ }; s.looks.push(l); }
  Object.assign(l, {
    name_en: input.name_en, name_ar: input.name_ar, image: input.image || {}, discount: input.discount,
    active: !!input.active, sort: Number.isFinite(input.sort) ? input.sort : 0,
    items: (input.items || []).map((i) => ({ product_id: i.product_id, x: i.x, y: i.y }))
  });
  persist();
  return clone(l);
}
function deleteLook(id) { const s = db(); s.looks = s.looks.filter((l) => l.id !== id); persist(); }

/* ---------- orders ---------- */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let c = 'PL-';
  for (const b of bytes) c += CODE_CHARS[b % CODE_CHARS.length];
  return c;
}
function findVariant(vid) {
  for (const p of db().products) { const v = p.variants.find((x) => x.id === vid); if (v) return v; }
  return null;
}
function createOrder(order, lines) {
  const s = db();
  for (const l of lines) {
    const v = findVariant(l.variant_id);
    if (!v) throw Object.assign(new Error('unavailable'), { status: 409 });
    if (v.stock !== null && v.stock < l.qty) throw Object.assign(new Error('stock'), { status: 409 });
  }
  for (const l of lines) { const v = findVariant(l.variant_id); if (v.stock !== null) v.stock -= l.qty; }
  let code = newCode();
  while (s.orders.some((o) => o.code === code)) code = newCode();
  const t = now();
  const o = { id: s.next.order++, code, status: 'new', ...order, created_at: t, updated_at: t, items: lines.map((l) => ({ ...l })), events: [{ status: 'new', created_at: t }] };
  s.orders.push(o);
  persist();
  return clone(o);
}
function getOrder(id) { const o = db().orders.find((x) => x.id === id); return o ? clone(o) : null; }
function getOrderByCode(code) { const o = db().orders.find((x) => x.code === code); return o ? clone(o) : null; }
function listOrders({ status } = {}) {
  return clone(db().orders.filter((o) => !status || o.status === status).sort((a, b) => b.id - a.id)
    .map((o) => ({ ...o, item_count: o.items.reduce((n, i) => n + i.qty, 0) })));
}
function setOrderStatus(id, status) {
  const o = db().orders.find((x) => x.id === id);
  if (!o) return null;
  if (o.status !== status) {
    if (status === 'cancelled' || o.status === 'cancelled') {
      const sign = status === 'cancelled' ? 1 : -1;
      for (const it of o.items) { const v = findVariant(it.variant_id); if (v && v.stock !== null) v.stock = Math.max(0, v.stock + sign * it.qty); }
    }
    o.status = status;
    o.updated_at = now();
    o.events.push({ status, created_at: o.updated_at });
    persist();
  }
  return clone(o);
}
function orderStats() {
  const m = new Map();
  for (const o of db().orders) {
    const e = m.get(o.status) || { status: o.status, n: 0, total: 0 };
    e.n += 1; e.total += o.total; m.set(o.status, e);
  }
  return [...m.values()];
}

/* ---------- seed ---------- */
function seedIfEmpty() {
  if (S.products.length) return;
  const { P, L } = seedData((f) => `assets/${f}`);
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
      image: { src: `assets/original-look-${m}.webp`, small: `assets/model-${m}-640.webp`, w: 1080, h: 1920 },
      items: products.map((slug, k) => ({ product_id: ids[slug], x: pp[k][0], y: pp[k][1] }))
    });
  });
}
function resetAll() {
  S = blank();
  seedIfEmpty();
  persist();
}

module.exports = {
  tx, getSettings, saveSettings, listProducts, getProduct, getProductBySlug, saveProduct, deleteProduct,
  listLooks, getLook, saveLook, deleteLook, createOrder, getOrder, getOrderByCode, listOrders, setOrderStatus, orderStats,
  seedIfEmpty, resetAll
};
