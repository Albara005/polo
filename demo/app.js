'use strict';
// Browser preview of the POLO store: routes, API and admin run in the page, data stays in localStorage.
const db = require('./db');
const { quote } = require('./pricing');
const { T, CATEGORIES, STATUSES } = require('./i18n');
const { layout, clientStrings } = require('./layout');
const { renderRunway } = require('./runway');
const pages = require('./pages');
const V = require('./validate');

const root = document.getElementById('polo-root');
const styles = {
  base: document.getElementById('css-base'),
  runway: document.getElementById('css-runway'),
  admin: document.getElementById('css-admin')
};
const LANG_KEY = 'polo-demo-lang';
let current = '/';

const getLang = () => { try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ar'; } catch (_) { return 'ar'; } };
const setLang = (l) => { try { localStorage.setItem(LANG_KEY, l); } catch (_) { /* ignore */ } };

/* ---------------- API (mirrors server/index.js) ---------------- */
const isImage = (s) => typeof s === 'string' && (s.startsWith('assets/') || s.startsWith('data:image/'));
const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

async function shrink(file, maxW, quality) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxW / bmp.width);
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  let url = c.toDataURL('image/webp', quality);
  if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/png');
  return { url, w, h };
}

async function api(method, path, body) {
  const url = new URL(path, 'http://x');
  const p = url.pathname;
  const seg = p.split('/').filter(Boolean); // api, admin, products, :id
  const id = Number(seg[3]);
  try {
    if (p === '/api/admin/me') return json(200, { admin: true, configured: true });
    if (p === '/api/admin/login' || p === '/api/admin/logout') return json(200, { ok: true });
    if (p === '/api/admin/upload') {
      const file = body && body.get && body.get('file');
      if (!file) return json(400, { error: 'file' });
      const look = url.searchParams.get('kind') === 'look';
      const big = await shrink(file, look ? 900 : 1000, 0.82);
      const small = await shrink(file, look ? 520 : 440, 0.8);
      return json(200, { src: big.url, thumb: small.url, small: small.url, w: big.w, h: big.h });
    }
    if (seg[1] === 'admin' && seg[2] === 'products') {
      if (method === 'GET') return json(200, db.listProducts({ includeInactive: true }));
      if (method === 'DELETE') { db.deleteProduct(id); return json(200, { ok: true }); }
      const { errors, data } = V.cleanProduct(body || {}, { isImage });
      if (errors.length) return json(400, { error: 'invalid', fields: errors });
      return json(200, db.saveProduct(data, method === 'PUT' ? id : undefined));
    }
    if (seg[1] === 'admin' && seg[2] === 'looks') {
      if (method === 'GET') return json(200, db.listLooks({ includeInactive: true }));
      if (method === 'DELETE') { db.deleteLook(id); return json(200, { ok: true }); }
      const { errors, data } = V.cleanLook(body || {}, { isImage, productExists: (pid) => !!db.getProduct(pid) });
      if (errors.length) return json(400, { error: 'invalid', fields: errors });
      return json(200, db.saveLook(data, method === 'PUT' ? id : undefined));
    }
    if (seg[1] === 'admin' && seg[2] === 'orders') {
      if (!seg[3]) {
        const status = STATUSES.includes(url.searchParams.get('status')) ? url.searchParams.get('status') : undefined;
        return json(200, { orders: db.listOrders({ status }), stats: db.orderStats() });
      }
      if (method === 'PATCH') {
        if (!STATUSES.includes(body && body.status)) return json(400, { error: 'status' });
        const o = db.setOrderStatus(id, body.status);
        return o ? json(200, o) : json(404, { error: 'not_found' });
      }
      const o = db.getOrder(id);
      return o ? json(200, o) : json(404, { error: 'not_found' });
    }
    if (p === '/api/admin/settings') {
      if (method === 'PUT') return json(200, db.saveSettings(V.cleanSettings(body || {})));
      return json(200, db.getSettings());
    }
    if (p === '/api/cart/quote') return json(200, quote(body && body.items));
    if (p === '/api/orders') {
      const b = body || {};
      const q = quote(b.items);
      if (!q.lines.length) return json(400, { error: 'empty' });
      if (q.lines.some((l) => !l.available || l.short)) return json(409, { error: 'stock', quote: q });
      const phone = V.normPhone(b.phone);
      const fields = { name: V.str(b.name, 80), phone, city: V.str(b.city, 60), district: V.str(b.district, 60), address: V.str(b.address, 200), notes: V.str(b.notes, 300) };
      const missing = ['name', 'city', 'address'].filter((k) => !fields[k]);
      if (!V.validPhone(phone)) missing.push('phone');
      if (missing.length) return json(400, { error: 'invalid', fields: missing });
      const payment = b.payment === 'bank' && q.payments.bank ? 'bank' : (q.payments.cod || !q.payments.bank ? 'cod' : 'bank');
      try {
        const order = db.createOrder({
          ...fields, payment, subtotal: q.subtotal, discount: q.discount, shipping: q.shipping, total: q.total, lang: b.lang === 'en' ? 'en' : 'ar'
        }, q.lines.map((l) => ({ product_id: l.product_id, variant_id: l.v, slug: l.slug, name_en: l.name_en, name_ar: l.name_ar, size: l.size, image: l.image, qty: l.qty, price: l.price })));
        return json(200, { code: order.code, url: `/order/${order.code}` });
      } catch (err) {
        if (err.status === 409) return json(409, { error: 'stock', quote: quote(b.items) });
        throw err;
      }
    }
    return json(404, { error: 'not_found' });
  } catch (err) {
    console.error(err);
    return json(err.status || 500, { error: err.message === 'storage_full' ? 'storage_full' : 'server' });
  }
}

const realFetch = window.fetch.bind(window);
window.fetch = async (input, opts = {}) => {
  const href = typeof input === 'string' ? input : input.url;
  if (!href.startsWith('/api/')) return realFetch(input, opts);
  let body = opts.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  return api((opts.method || 'GET').toUpperCase(), href, body);
};

/* ---------------- Pages (mirrors the server's page routes) ---------------- */
function renderPage(url) {
  const u = new URL(url, 'http://x');
  const req = { lang: getLang(), originalUrl: u.pathname + u.search, query: Object.fromEntries(u.searchParams) };
  const t = T[req.lang];
  const p = u.pathname;
  let m;
  if (p === '/') {
    return { req, css: ['runway'], html: layout(req, { title: `${t.runwayTitle.replace(/\.$/, '')} — POLO`, active: 'runway', body: renderRunway(req, { looks: db.listLooks(), products: db.listProducts(), startId: Number(req.query.look) || 0 }) }) };
  }
  if (p === '/shop') {
    const category = CATEGORIES[req.query.c] ? req.query.c : '';
    return { req, css: [], html: layout(req, { title: `${t.shopTitle} — POLO`, active: 'shop', body: pages.renderShop(req, { products: db.listProducts(), category }) }) };
  }
  if ((m = p.match(/^\/product\/([^/]+)$/))) {
    const product = db.getProductBySlug(decodeURIComponent(m[1]));
    if (product) {
      const looks = db.listLooks().filter((l) => l.items.some((i) => i.product_id === product.id));
      return { req, css: ['runway'], init: 'product', html: layout(req, { title: `${req.lang === 'ar' ? product.name_ar : product.name_en} — POLO`, active: 'shop', body: pages.renderProduct(req, { product, looks }) }) };
    }
  }
  if (p === '/cart') {
    return { req, css: [], init: 'checkout', html: layout(req, { title: `${t.cartTitle} — POLO`, body: pages.renderCart(req, { settings: db.getSettings() }) }) };
  }
  if ((m = p.match(/^\/order\/([^/]+)$/))) {
    const order = db.getOrderByCode(decodeURIComponent(m[1]));
    if (order) return { req, css: [], html: layout(req, { title: `${t.orderNumber} ${order.code} — POLO`, body: pages.renderOrder(req, { order, settings: db.getSettings() }) }) };
  }
  if (p === '/track') {
    const code = V.str(req.query.code, 12).toUpperCase();
    const phone = V.str(req.query.phone, 20);
    let order = null;
    let notFound = false;
    if (code && phone) {
      const o = db.getOrderByCode(code.startsWith('PL-') ? code : `PL-${code.replace(/^PL/, '')}`);
      if (o && V.normPhone(phone) === o.phone) order = o; else notFound = true;
    }
    return { req, css: [], html: layout(req, { title: `${t.trackTitle} — POLO`, active: 'track', body: pages.renderTrack(req, { code, phone, order, notFound }) }) };
  }
  if (p === '/admin') return { req, admin: true };
  return { req, css: [], html: layout(req, { title: '404 — POLO', body: pages.renderNotFound(req) }) };
}

function banner(lang) {
  const ar = lang === 'ar';
  return `<div class="demo-bar shopify-section-group-header-group" role="note"><span>${ar ? 'نسخة معاينة: الطلبات والتعديلات تنحفظ في متصفحك فقط.' : 'Preview: orders and edits are saved in this browser only.'}</span><a href="/admin">${ar ? 'لوحة التحكم' : 'Admin dashboard'}</a><button type="button" data-demo-reset>${ar ? 'إعادة البيانات الأصلية' : 'Reset sample data'}</button></div>`;
}

function useStyles(list) {
  styles.base.disabled = !list.includes('base');
  styles.runway.disabled = !list.includes('runway');
  styles.admin.disabled = !list.includes('admin');
}

function navigate(url, opts = {}) {
  const u = new URL(url, 'http://x');
  const lang = u.searchParams.get('lang');
  if (lang === 'en' || lang === 'ar') setLang(lang);
  current = u.pathname + u.search;
  const r = renderPage(current);
  const el = document.querySelector('.rw-sheet-host');
  if (el) el.remove();
  if (r.admin) {
    useStyles(['admin']);
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    document.body.className = 'demo-admin';
    document.title = 'لوحة تحكم POLO';
    root.innerHTML = '<div id="app" aria-live="polite"></div><div id="toast" role="status" aria-live="polite"></div>';
    window.ADMIN = { categories: CATEGORIES, statuses: STATUSES, statusLabels: T.ar.status };
    window.PoloAdmin.boot();
  } else {
    const doc = new DOMParser().parseFromString(r.html, 'text/html');
    useStyles(['base', ...r.css]);
    document.documentElement.lang = r.req.lang;
    document.documentElement.dir = T[r.req.lang].dir;
    document.body.className = doc.body.className;
    document.title = doc.title;
    window.POLO = { lang: r.req.lang, t: clientStrings(r.req.lang) };
    doc.querySelectorAll('script').forEach((s) => { if (!s.type || s.type === 'text/javascript') s.remove(); });
    root.innerHTML = banner(r.req.lang) + doc.body.innerHTML;
    window.PoloCart.renderCount();
    if (r.init === 'product') window.__initProduct();
    if (r.init === 'checkout') window.__initCheckout();
  }
  if (!opts.keepScroll) window.scrollTo(0, 0);
}
window.POLO_NAV = (u) => navigate(u);

// In-page links and GET forms
document.addEventListener('click', (e) => {
  const reset = e.target.closest && e.target.closest('[data-demo-reset]');
  if (reset) {
    if (!reset.dataset.armed) {
      reset.dataset.armed = '1';
      const old = reset.textContent;
      reset.textContent = getLang() === 'ar' ? 'اضغط مرة ثانية للتأكيد' : 'Press again to confirm';
      setTimeout(() => { delete reset.dataset.armed; reset.textContent = old; }, 4000);
      return;
    }
    db.resetAll();
    window.PoloCart.clear();
    navigate('/');
    return;
  }
  const a = e.target.closest && e.target.closest('a[href]');
  if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const href = a.getAttribute('href');
  if (!href || !href.startsWith('/')) return;
  e.preventDefault();
  navigate(href);
});
document.addEventListener('submit', (e) => {
  const form = e.target;
  const action = form.getAttribute('action');
  if (!action || !action.startsWith('/') || (form.method || 'get').toLowerCase() !== 'get') return;
  e.preventDefault();
  const qs = new URLSearchParams(new FormData(form)).toString();
  navigate(action + (qs ? `?${qs}` : ''));
});

const adminHash = /^#(orders|products|looks|config)/.test(location.hash);
navigate(adminHash ? '/admin' : '/');
