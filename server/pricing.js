'use strict';
const { listProducts, listLooks, getSettings } = require('./db');

const MAX_QTY = 20;

function variantIndex(products) {
  const map = new Map();
  for (const p of products) for (const v of p.variants) map.set(v.id, { product: p, variant: v });
  return map;
}

function bundlePrice(look, productsById) {
  const prices = look.items.map((it) => productsById.get(it.product_id)).filter(Boolean).map((p) => p.price);
  const was = prices.reduce((s, p) => s + p, 0);
  const off = look.discount > 0 && prices.length >= 2 ? Math.round(was * look.discount / 100) : 0;
  return { was, now: was - off, off, count: prices.length };
}

/**
 * Price a cart. items: [{ v: variantId, q: qty }].
 * Returns lines (with availability), look-bundle discounts, shipping and total.
 */
function quote(items) {
  const products = listProducts();
  const index = variantIndex(products);
  const merged = new Map();
  for (const it of Array.isArray(items) ? items.slice(0, 50) : []) {
    const v = Number(it && it.v);
    const q = Math.floor(Number(it && it.q));
    if (!Number.isSafeInteger(v) || !(q > 0)) continue;
    merged.set(v, Math.min(MAX_QTY, (merged.get(v) || 0) + q));
  }
  const lines = [];
  for (const [v, q] of merged) {
    const hit = index.get(v);
    if (!hit) { lines.push({ v, qty: q, available: false }); continue; }
    const { product: p, variant } = hit;
    const max = variant.stock === null ? MAX_QTY : Math.min(MAX_QTY, variant.stock);
    lines.push({
      v, qty: q, available: max > 0, max, short: max > 0 && q > max,
      product_id: p.id, slug: p.slug, name_en: p.name_en, name_ar: p.name_ar, size: variant.size,
      image: (p.images[0] && (p.images[0].thumb || p.images[0].src)) || '', price: p.price,
      line: p.price * Math.min(q, max)
    });
  }
  const ok = lines.filter((l) => l.available);
  const subtotal = ok.reduce((s, l) => s + l.line, 0);

  // "Complete the look": a look's discount applies once when every piece of it is in the bag.
  const units = new Map();
  for (const l of ok) units.set(l.product_id, (units.get(l.product_id) || 0) + Math.min(l.qty, l.max));
  const productsById = new Map(products.map((p) => [p.id, p]));
  const discounts = [];
  for (const look of listLooks()) {
    if (!(look.discount > 0) || look.items.length < 2) continue;
    const ids = look.items.map((i) => i.product_id);
    if (!ids.every((id) => (units.get(id) || 0) > 0 && productsById.has(id))) continue;
    ids.forEach((id) => units.set(id, units.get(id) - 1));
    const { off } = bundlePrice(look, productsById);
    if (off > 0) discounts.push({ look_id: look.id, name_en: look.name_en, name_ar: look.name_ar, amount: off });
  }
  const discount = discounts.reduce((s, d) => s + d.amount, 0);
  const settings = getSettings();
  const afterDiscount = subtotal - discount;
  let shipping = 0;
  if (ok.length) {
    shipping = settings.free_shipping_over > 0 && afterDiscount >= settings.free_shipping_over ? 0 : settings.shipping_fee;
  }
  return {
    lines, subtotal, discounts, discount, shipping, total: afterDiscount + shipping,
    free_shipping_over: settings.free_shipping_over,
    payments: { cod: !!settings.cod_enabled, bank: !!settings.bank_enabled }
  };
}

module.exports = { quote, bundlePrice, MAX_QTY };
