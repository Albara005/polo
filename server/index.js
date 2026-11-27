'use strict';
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');
const { ROOT, UPLOAD_DIR, PORT, ADMIN_PASSWORD, SECRET, PROD } = require('./config');
const db = require('./db');
const { quote } = require('./pricing');
const { T, CATEGORIES, STATUSES } = require('./i18n');
const { layout, esc, json } = require('./views/layout');
const { renderRunway } = require('./views/runway');
const pages = require('./views/pages');

db.seedIfEmpty();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

/* ---------- helpers ---------- */
const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('base64url');
const orderKey = (code) => sign(`order:${code}`).slice(0, 22);
const safeEqual = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};
function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
const toLatinDigits = (s) => String(s || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
function normPhone(s) {
  let p = toLatinDigits(s).replace(/[\s\-().]/g, '');
  if (/^(\+|00)?966/.test(p)) p = '0' + p.replace(/^(\+|00)?966/, '');
  if (/^5\d{8}$/.test(p)) p = '0' + p;
  return p;
}
const validPhone = (p) => /^05\d{8}$/.test(p) || /^\+?\d{8,15}$/.test(p);
const str = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);

// Small in-memory rate limiter (per IP and bucket)
const hits = new Map();
function limited(req, bucket, max, windowMs) {
  const key = `${bucket}:${req.ip}`;
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) { hits.set(key, { n: 1, reset: now + windowMs }); return false; }
  h.n += 1;
  return h.n > max;
}
setInterval(() => { const now = Date.now(); for (const [k, h] of hits) if (h.reset < now) hits.delete(k); }, 60_000).unref();

/* ---------- middleware ---------- */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});
app.use(express.json({ limit: '200kb' }));

app.use('/css', express.static(path.join(ROOT, 'public/css'), { maxAge: PROD ? '1h' : 0 }));
app.use('/js', express.static(path.join(ROOT, 'public/js'), { maxAge: PROD ? '1h' : 0 }));
app.use('/fonts', express.static(path.join(ROOT, 'public/fonts'), { maxAge: '30d', immutable: true }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '365d', immutable: true }));

// Language: ?lang= sets a cookie; default Arabic
app.use((req, res, next) => {
  const q = req.query.lang;
  let lang = q === 'en' || q === 'ar' ? q : cookies(req).lang;
  if (lang !== 'en' && lang !== 'ar') lang = 'ar';
  if (q === 'en' || q === 'ar') {
    res.cookie('lang', lang, { maxAge: 365 * 864e5, sameSite: 'lax', secure: req.secure, path: '/' });
  }
  req.lang = lang;
  next();
});

/* ---------- admin auth ---------- */
const ADMIN_COOKIE = 'polo_admin';
const SESSION_MS = 7 * 864e5;
function isAdmin(req) {
  const tok = cookies(req)[ADMIN_COOKIE];
  if (!tok || !ADMIN_PASSWORD) return false;
  const [exp, sig] = tok.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, sign(`admin:${exp}:${sign(ADMIN_PASSWORD)}`));
}
function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'auth' });
  // Custom header blocks cross-site form posts (CSRF) together with SameSite=Strict
  if (req.method !== 'GET' && req.get('X-Polo-Admin') !== '1') return res.status(403).json({ error: 'csrf' });
  next();
}

app.post('/api/admin/login', (req, res) => {
  if (limited(req, 'login', 10, 15 * 60_000)) return res.status(429).json({ error: 'rate' });
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: 'no_password' });
  if (!safeEqual(String((req.body && req.body.password) || ''), ADMIN_PASSWORD)) return res.status(401).json({ error: 'wrong' });
  const exp = Date.now() + SESSION_MS;
  res.cookie(ADMIN_COOKIE, `${exp}.${sign(`admin:${exp}:${sign(ADMIN_PASSWORD)}`)}`, { httpOnly: true, sameSite: 'strict', secure: req.secure, maxAge: SESSION_MS, path: '/' });
  res.json({ ok: true });
});
app.post('/api/admin/logout', (req, res) => {
  res.clearCookie(ADMIN_COOKIE, { path: '/' });
  res.json({ ok: true });
});
app.get('/api/admin/me', (req, res) => res.json({ admin: isAdmin(req), configured: !!ADMIN_PASSWORD }));

/* ---------- admin: uploads ---------- */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp|avif|gif)$/.test(file.mimetype))
});
let sharp = null;
try { sharp = require('sharp'); } catch (_) { console.warn('sharp unavailable: images are stored without resizing'); }

async function saveImage(buf, kind) {
  const id = crypto.randomBytes(9).toString('hex');
  const fs = require('node:fs/promises');
  if (!sharp) {
    const name = `${kind}-${id}`;
    await fs.writeFile(path.join(UPLOAD_DIR, name), buf);
    return { src: `/uploads/${name}`, thumb: `/uploads/${name}`, small: `/uploads/${name}`, w: 0, h: 0 };
  }
  const big = kind === 'look' ? 1080 : 1400;
  const smallW = kind === 'look' ? 640 : 520;
  const base = sharp(buf, { failOn: 'error' }).rotate();
  const main = await base.clone().resize({ width: big, withoutEnlargement: true }).webp({ quality: 84, alphaQuality: 100 }).toBuffer({ resolveWithObject: true });
  const small = await base.clone().resize({ width: smallW, withoutEnlargement: true }).webp({ quality: 80, alphaQuality: 100 }).toBuffer();
  const mainName = `${kind}-${id}.webp`;
  const smallName = `${kind}-${id}-${smallW}.webp`;
  await fs.writeFile(path.join(UPLOAD_DIR, mainName), main.data);
  await fs.writeFile(path.join(UPLOAD_DIR, smallName), small);
  return { src: `/uploads/${mainName}`, thumb: `/uploads/${smallName}`, small: `/uploads/${smallName}`, w: main.info.width, h: main.info.height };
}

app.post('/api/admin/upload', requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file' });
  const kind = req.query.kind === 'look' ? 'look' : 'product';
  try {
    res.json(await saveImage(req.file.buffer, kind));
  } catch (err) {
    res.status(400).json({ error: 'image' });
  }
});

/* ---------- admin: products ---------- */
const isUploadPath = (s) => typeof s === 'string' && /^\/uploads\/[\w.-]+$/.test(s);
function cleanProduct(b) {
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
  const images = (Array.isArray(b.images) ? b.images : []).filter((i) => i && isUploadPath(i.src)).slice(0, 12)
    .map((i) => ({ src: i.src, thumb: isUploadPath(i.thumb) ? i.thumb : i.src, w: Number(i.w) || 0, h: Number(i.h) || 0 }));
  return {
    errors,
    data: {
      name_en, name_ar, desc_en: str(b.desc_en, 4000), desc_ar: str(b.desc_ar, 4000), category, price, compare_price: compare,
      size_label: b.size_label === 'shoe' ? 'shoe' : 'size', images, is_new: !!b.is_new, active: b.active !== false,
      sort: Math.floor(Number(b.sort)) || 0, slug: str(b.slug, 60), variants
    }
  };
}
app.get('/api/admin/products', requireAdmin, (req, res) => res.json(db.listProducts({ includeInactive: true })));
app.post('/api/admin/products', requireAdmin, (req, res) => {
  const { errors, data } = cleanProduct(req.body || {});
  if (errors.length) return res.status(400).json({ error: 'invalid', fields: errors });
  res.json(db.saveProduct(data));
});
app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!db.getProduct(id)) return res.status(404).json({ error: 'not_found' });
  const { errors, data } = cleanProduct(req.body || {});
  if (errors.length) return res.status(400).json({ error: 'invalid', fields: errors });
  res.json(db.saveProduct(data, id));
});
app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  db.deleteProduct(Number(req.params.id));
  res.json({ ok: true });
});

/* ---------- admin: looks ---------- */
function cleanLook(b) {
  const errors = [];
  const name_en = str(b.name_en, 80);
  const name_ar = str(b.name_ar, 80) || name_en;
  if (!name_en) errors.push('name_en');
  const img = b.image || {};
  if (!isUploadPath(img.src)) errors.push('image');
  const discount = Math.floor(Number(b.discount));
  if (!(discount >= 0 && discount <= 90)) errors.push('discount');
  const clamp = (n) => Math.min(100, Math.max(0, Math.round(Number(n) * 10) / 10 || 0));
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 6)
    .map((i) => ({ product_id: Number(i && i.product_id), x: clamp(i && i.x), y: clamp(i && i.y) }))
    .filter((i) => db.getProduct(i.product_id));
  if (!items.length) errors.push('items');
  return {
    errors,
    data: {
      name_en, name_ar, discount, active: b.active !== false, sort: Math.floor(Number(b.sort)) || 0, items,
      image: { src: img.src, small: isUploadPath(img.small) ? img.small : img.src, w: Number(img.w) || 0, h: Number(img.h) || 0 }
    }
  };
}
app.get('/api/admin/looks', requireAdmin, (req, res) => res.json(db.listLooks({ includeInactive: true })));
app.post('/api/admin/looks', requireAdmin, (req, res) => {
  const { errors, data } = cleanLook(req.body || {});
  if (errors.length) return res.status(400).json({ error: 'invalid', fields: errors });
  res.json(db.saveLook(data));
});
app.put('/api/admin/looks/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!db.getLook(id)) return res.status(404).json({ error: 'not_found' });
  const { errors, data } = cleanLook(req.body || {});
  if (errors.length) return res.status(400).json({ error: 'invalid', fields: errors });
  res.json(db.saveLook(data, id));
});
app.delete('/api/admin/looks/:id', requireAdmin, (req, res) => {
  db.deleteLook(Number(req.params.id));
  res.json({ ok: true });
});

/* ---------- admin: orders & settings ---------- */
app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const status = STATUSES.includes(req.query.status) ? req.query.status : undefined;
  res.json({ orders: db.listOrders({ status }), stats: db.orderStats() });
});
app.get('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const o = db.getOrder(Number(req.params.id));
  if (!o) return res.status(404).json({ error: 'not_found' });
  res.json(o);
});
app.patch('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const status = req.body && req.body.status;
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'status' });
  const o = db.setOrderStatus(Number(req.params.id), status);
  if (!o) return res.status(404).json({ error: 'not_found' });
  res.json(o);
});
app.get('/api/admin/settings', requireAdmin, (req, res) => res.json(db.getSettings()));
app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const b = req.body || {};
  const money = (v) => Math.max(0, Math.floor(Number(v)) || 0);
  res.json(db.saveSettings({
    shipping_fee: money(b.shipping_fee),
    free_shipping_over: money(b.free_shipping_over),
    cod_enabled: b.cod_enabled ? 1 : 0,
    bank_enabled: b.bank_enabled ? 1 : 0,
    bank_details: str(b.bank_details, 1000),
    whatsapp: str(b.whatsapp, 20).replace(/[^\d+]/g, '')
  }));
});

/* ---------- public API ---------- */
app.post('/api/cart/quote', (req, res) => {
  res.json(quote(req.body && req.body.items));
});

app.post('/api/orders', (req, res) => {
  if (limited(req, 'order', 8, 10 * 60_000)) return res.status(429).json({ error: 'rate' });
  const b = req.body || {};
  const q = quote(b.items);
  if (!q.lines.length) return res.status(400).json({ error: 'empty' });
  if (q.lines.some((l) => !l.available || l.short)) return res.status(409).json({ error: 'stock', quote: q });
  const phone = normPhone(b.phone);
  const fields = {
    name: str(b.name, 80), phone, city: str(b.city, 60), district: str(b.district, 60),
    address: str(b.address, 200), notes: str(b.notes, 300)
  };
  const missing = ['name', 'city', 'address'].filter((k) => !fields[k]);
  if (!validPhone(phone)) missing.push('phone');
  if (missing.length) return res.status(400).json({ error: 'invalid', fields: missing });
  const payment = b.payment === 'bank' && q.payments.bank ? 'bank' : (q.payments.cod || !q.payments.bank ? 'cod' : 'bank');
  try {
    const order = db.createOrder({
      ...fields, payment, subtotal: q.subtotal, discount: q.discount, shipping: q.shipping, total: q.total,
      lang: b.lang === 'en' ? 'en' : 'ar'
    }, q.lines.map((l) => ({
      product_id: l.product_id, variant_id: l.v, slug: l.slug, name_en: l.name_en, name_ar: l.name_ar,
      size: l.size, image: l.image, qty: l.qty, price: l.price
    })));
    res.json({ code: order.code, url: `/order/${order.code}?k=${orderKey(order.code)}` });
  } catch (err) {
    if (err.status === 409) return res.status(409).json({ error: 'stock', quote: quote(b.items) });
    throw err;
  }
});

/* ---------- pages ---------- */
app.get('/', (req, res) => {
  const t = T[req.lang];
  const body = renderRunway(req, { looks: db.listLooks(), products: db.listProducts(), startId: Number(req.query.look) || 0 });
  res.send(layout(req, {
    title: `${t.runwayTitle.replace(/\.$/, '')} — POLO`, description: t.runwaySub, active: 'runway', body,
    styles: ['/css/runway.css'], scripts: ['/js/runway.js']
  }));
});

app.get('/shop', (req, res) => {
  const t = T[req.lang];
  const category = CATEGORIES[req.query.c] ? req.query.c : '';
  res.send(layout(req, {
    title: `${t.shopTitle} — POLO`, description: t.shopSub, active: 'shop',
    body: pages.renderShop(req, { products: db.listProducts(), category })
  }));
});

app.get('/product/:slug', (req, res, next) => {
  const product = db.getProductBySlug(req.params.slug);
  if (!product) return next();
  const looks = db.listLooks().filter((l) => l.items.some((i) => i.product_id === product.id));
  const name = req.lang === 'ar' ? product.name_ar : product.name_en;
  const desc = (req.lang === 'ar' ? product.desc_ar : product.desc_en) || '';
  res.send(layout(req, {
    title: `${name} — POLO`, description: desc.slice(0, 160), active: 'shop',
    styles: ['/css/runway.css'], scripts: ['/js/product.js'],
    body: pages.renderProduct(req, { product, looks })
  }));
});

app.get('/cart', (req, res) => {
  const t = T[req.lang];
  res.send(layout(req, {
    title: `${t.cartTitle} — POLO`, scripts: ['/js/checkout.js'], styles: [],
    body: pages.renderCart(req, { settings: db.getSettings() })
  }));
});

app.get('/order/:code', (req, res, next) => {
  const code = String(req.params.code);
  if (!req.query.k || !safeEqual(req.query.k, orderKey(code))) return next();
  const order = db.getOrderByCode(code);
  if (!order) return next();
  res.setHeader('Cache-Control', 'no-store');
  res.send(layout(req, {
    title: `${T[req.lang].orderNumber} ${order.code} — POLO`,
    body: pages.renderOrder(req, { order, settings: db.getSettings() })
  }));
});

app.get('/track', (req, res) => {
  const t = T[req.lang];
  const code = str(req.query.code, 12).toUpperCase();
  const phone = str(req.query.phone, 20);
  let order = null;
  let notFound = false;
  if (code && phone) {
    if (limited(req, 'track', 30, 10 * 60_000)) {
      notFound = true;
    } else {
      const o = db.getOrderByCode(code.startsWith('PL-') ? code : `PL-${code.replace(/^PL/, '')}`);
      if (o && normPhone(phone) === o.phone) order = o; else notFound = true;
    }
  }
  res.setHeader('Cache-Control', 'no-store');
  res.send(layout(req, { title: `${t.trackTitle} — POLO`, active: 'track', body: pages.renderTrack(req, { code, phone, order, notFound }) }));
});

app.get('/admin', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.send(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>لوحة تحكم POLO</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/css/admin.css">
</head>
<body>
<div id="app" aria-live="polite"></div>
<div id="toast" role="status" aria-live="polite"></div>
<script>window.ADMIN = ${json({ categories: CATEGORIES, statuses: STATUSES, statusLabels: T.ar.status })};</script>
<script src="/js/admin.js"></script>
</body>
</html>`);
});

app.get('/healthz', (req, res) => res.json({ ok: true }));

/* ---------- 404 & errors ---------- */
app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));
app.use((req, res) => {
  res.status(404).send(layout(req, { title: '404 — POLO', body: pages.renderNotFound(req) }));
});
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  if (res.headersSent) return;
  if (req.path.startsWith('/api')) return res.status(err.status || 500).json({ error: 'server' });
  res.status(500).send(`<!doctype html><meta charset="utf-8"><title>Error</title><p style="font-family:sans-serif;padding:40px">${esc('Something went wrong. Please try again.')}</p>`);
});

app.listen(PORT, () => {
  console.log(`POLO store running on http://localhost:${PORT}`);
  if (!ADMIN_PASSWORD) console.warn('ADMIN_PASSWORD is not set: the admin dashboard at /admin stays locked until you set it.');
});
