'use strict';
const { T, money } = require('../i18n');
const { getSettings } = require('../db');

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

// Strings the browser-side scripts need, in the page's language.
function clientStrings(lang) {
  const t = T[lang];
  return {
    pieceSaved: t.pieceSaved, lookSaved: t.lookSaved, remove: t.remove, subtotal: t.subtotal, lookDiscount: t.lookDiscount,
    shipping: t.shipping, free: t.free, total: t.total, cartEmpty: t.cartEmpty, continueShopping: t.continueShopping,
    unavailableLine: t.unavailableLine, stockLine: t.stockLine(999).replace('999', '{n}'),
    freeShippingHint: t.freeShippingHint('{p}'), required: t.required, badPhone: t.badPhone, placing: t.placing,
    placeOrder: t.placeOrder, orderFailed: t.orderFailed, stockChanged: t.stockChanged, size: t.size, quantity: t.quantity,
    addedTo: t.addedTo, viewBag: t.viewBag, chooseSize: t.chooseSize, soldOut: t.soldOut, addToBag: t.addToBag
  };
}

function langSwitchHref(req, lang) {
  const other = lang === 'ar' ? 'en' : 'ar';
  const url = new URL(req.originalUrl, 'http://x');
  url.searchParams.set('lang', other);
  return url.pathname + url.search;
}

function layout(req, { title, description = '', body, scripts = [], styles = [], active = '', head = '' }) {
  const lang = req.lang;
  const t = T[lang];
  const settings = getSettings();
  const nav = [
    ['/', t.navRunway, 'runway'],
    ['/shop', t.navShop, 'shop'],
    ['/track', t.navTrack, 'track']
  ].map(([href, label, key]) => `<a href="${href}"${active === key ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('');
  const wa = String(settings.whatsapp || '').replace(/\D/g, '');
  return `<!doctype html>
<html lang="${lang}" dir="${t.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#ffffff">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%23151413'/%3E%3Ctext x='16' y='22' font-family='Helvetica,Arial' font-size='16' font-weight='700' fill='%23fff' text-anchor='middle'%3EP%3C/text%3E%3C/svg%3E">
${lang === 'ar' ? '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap">' : ''}
<link rel="stylesheet" href="/css/base.css">
${styles.map((s) => `<link rel="stylesheet" href="${s}">`).join('\n')}
${head}
</head>
<body class="lang-${lang}">
<header class="site-header shopify-section-group-header-group">
<a href="/" class="brand" aria-label="${esc(t.brandHome)}"><span class="brand-word">POLO</span></a>
<nav aria-label="Main navigation">${nav}</nav>
<a class="lang-switch" href="${esc(langSwitchHref(req, lang))}" hreflang="${lang === 'ar' ? 'en' : 'ar'}" lang="${lang === 'ar' ? 'en' : 'ar'}">${esc(t.otherLang)}</a>
<a id="open-bag" href="/cart" aria-label="${esc(t.cartOpen)}"><svg width="22" height="24" viewBox="0 0 24 26" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M4 8h16l1 16H3L4 8zM8 8V6a4 4 0 0 1 8 0v2"/></svg><span data-cart-count>0</span></a>
</header>
<main>
${body}
</main>
<footer class="site-footer">
<div class="site-footer__in">
<span class="brand-word brand-word--small">POLO</span>
<p>${esc(t.footerNote)}</p>
<nav aria-label="Footer">${nav}${wa ? `<a href="https://wa.me/${wa}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ''}</nav>
</div>
</footer>
<div id="bag-status" role="status" aria-live="polite"></div>
<script>window.POLO = ${json({ lang, t: clientStrings(lang) })};</script>
<script src="/js/cart.js"></script>
${scripts.map((s) => (s.startsWith('<') ? s : `<script src="${s}"></script>`)).join('\n')}
</body>
</html>`;
}

module.exports = { layout, esc, json, money };
