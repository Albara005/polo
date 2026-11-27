'use strict';
// Input cleaning shared by the server and the in-browser preview.
const { CATEGORIES } = require('./i18n');

const str = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const toLatinDigits = (s) => String(s || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
function normPhone(s) {
  let p = toLatinDigits(s).replace(/[\s\-().]/g, '');
  if (/^(\+|00)?966/.test(p)) p = '0' + p.replace(/^(\+|00)?966/, '');
  if (/^5\d{8}$/.test(p)) p = '0' + p;
  return p;
}
const validPhone = (p) => /^05\d{8}$/.test(p) || /^\+?\d{8,15}$/.test(p);

/** deps: { isImage(src) -> bool } */
function cleanProduct(b, deps) {
  const errors = [];
  const name_en = str(b.name_en, 120);
  const name_ar = str(b.name_ar, 120) || name_en;
  if (!name_en) errors.push('name_en');
  const category = CATEGORIES[b.category] ? b.category : null;
  if (!category) errors.push('category');
  const price = Number(b.price);
  if (!Number.isSafeInteger(price) || price < 0) errors.push('price');
  const compare = b.compare_price === null || b.compare_price === '' || b.compare_price === undefined ? null : Number(b.compare_price);
  if (compare !== null && (!Number.isSafeInteger(compare) || compare < 0)) errors.push('compare_price');
  const seen = new Set();
  const variants = (Array.isArray(b.variants) ? b.variants : []).map((v) => ({
    size: str(v && v.size, 20),
    stock: v && v.stock !== null && v.stock !== '' && v.stock !== undefined ? Math.max(0, Math.floor(Number(v.stock)) || 0) : null
  })).filter((v) => v.size && !seen.has(v.size) && seen.add(v.size));
  if (!variants.length) errors.push('variants');
  const images = (Array.isArray(b.images) ? b.images : []).filter((i) => i && deps.isImage(i.src)).slice(0, 12)
    .map((i) => ({ src: i.src, thumb: deps.isImage(i.thumb) ? i.thumb : i.src, w: Number(i.w) || 0, h: Number(i.h) || 0 }));
  return {
    errors,
    data: {
      name_en, name_ar, desc_en: str(b.desc_en, 4000), desc_ar: str(b.desc_ar, 4000), category, price, compare_price: compare,
      size_label: b.size_label === 'shoe' ? 'shoe' : 'size', images, is_new: !!b.is_new, active: b.active !== false,
      sort: Math.floor(Number(b.sort)) || 0, slug: str(b.slug, 60), variants
    }
  };
}

/** deps: { isImage(src) -> bool, productExists(id) -> bool } */
function cleanLook(b, deps) {
  const errors = [];
  const name_en = str(b.name_en, 80);
  const name_ar = str(b.name_ar, 80) || name_en;
  if (!name_en) errors.push('name_en');
  const img = b.image || {};
  if (!deps.isImage(img.src)) errors.push('image');
  const discount = Math.floor(Number(b.discount));
  if (!(discount >= 0 && discount <= 90)) errors.push('discount');
  const clamp = (n) => Math.min(100, Math.max(0, Math.round(Number(n) * 10) / 10 || 0));
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 6)
    .map((i) => ({ product_id: Number(i && i.product_id), x: clamp(i && i.x), y: clamp(i && i.y) }))
    .filter((i) => deps.productExists(i.product_id));
  if (!items.length) errors.push('items');
  return {
    errors,
    data: {
      name_en, name_ar, discount, active: b.active !== false, sort: Math.floor(Number(b.sort)) || 0, items,
      image: { src: img.src, small: deps.isImage(img.small) ? img.small : img.src, w: Number(img.w) || 0, h: Number(img.h) || 0 }
    }
  };
}

function cleanSettings(b) {
  const money = (v) => Math.max(0, Math.floor(Number(v)) || 0);
  return {
    shipping_fee: money(b.shipping_fee),
    free_shipping_over: money(b.free_shipping_over),
    cod_enabled: b.cod_enabled ? 1 : 0,
    bank_enabled: b.bank_enabled ? 1 : 0,
    bank_details: str(b.bank_details, 1000),
    whatsapp: str(b.whatsapp, 20).replace(/[^\d+]/g, '')
  };
}

module.exports = { str, normPhone, validPhone, cleanProduct, cleanLook, cleanSettings };
