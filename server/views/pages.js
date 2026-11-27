'use strict';
const { T, CATEGORIES, STATUSES, money, pick } = require('../i18n');
const { esc, json } = require('./layout');

function priceHtml(p, lang) {
  return `${p.compare_price > p.price ? `<s>${esc(money(p.compare_price, lang))}</s> ` : ''}<span>${esc(money(p.price, lang))}</span>`;
}

/* ---------- Shop ---------- */
function renderShop(req, { products, category }) {
  const lang = req.lang;
  const t = T[lang];
  const used = Object.keys(CATEGORIES).filter((c) => products.some((p) => p.category === c));
  const list = category ? products.filter((p) => p.category === category) : products;
  const chips = [['', t.all], ...used.map((c) => [c, CATEGORIES[c][lang]])]
    .map(([c, label]) => `<a class="chip" href="/shop${c ? `?c=${c}` : ''}"${(category || '') === c ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('');
  const cards = list.map((p) => {
    const img = p.images[0] || {};
    const soldOut = !p.variants.some((v) => v.stock !== 0);
    return `<li class="card${soldOut ? ' is-soldout' : ''}"><a href="/product/${encodeURIComponent(p.slug)}">
<span class="card__media">${img.src ? `<img src="${esc(img.thumb || img.src)}" alt="" loading="lazy" decoding="async" width="${img.w || 400}" height="${img.h || 500}">` : ''}${p.is_new ? `<span class="tag">${esc(t.isNew)}</span>` : ''}${soldOut ? `<span class="tag tag--muted">${esc(t.soldOut)}</span>` : ''}</span>
<span class="card__type">${esc(CATEGORIES[p.category] ? CATEGORIES[p.category][lang] : '')}</span>
<span class="card__name">${esc(pick(p, 'name', lang))}</span>
<span class="card__price">${priceHtml(p, lang)}</span>
</a></li>`;
  }).join('');
  return `<section class="page">
<div class="page-head"><div><h1 class="page-title">${esc(t.shopTitle)}</h1><p class="page-sub">${esc(t.shopSub)}</p></div><nav class="chips" aria-label="${esc(t.shopTitle)}">${chips}</nav></div>
${list.length ? `<ul class="grid" role="list">${cards}</ul>` : `<p class="empty">${esc(t.noProducts)}</p>`}
</section>`;
}

/* ---------- Product ---------- */
function renderProduct(req, { product: p, looks }) {
  const lang = req.lang;
  const t = T[lang];
  const name = pick(p, 'name', lang);
  const desc = pick(p, 'desc', lang);
  const firstOk = p.variants.findIndex((v) => v.stock !== 0);
  const gallery = p.images.map((img, i) => `<figure class="gallery__item"><img src="${esc(img.src)}" alt="${i === 0 ? esc(name) : ''}" width="${img.w || 800}" height="${img.h || 1000}" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></figure>`).join('');
  const pills = p.variants.map((v, j) => `<label class="rw__pill${v.stock === 0 ? ' is-unavailable' : ''}"><input type="radio" name="size" value="${v.id}" data-stock="${v.stock ?? ''}"${j === firstOk ? ' checked' : ''}${v.stock === 0 ? ' disabled' : ''}><span class="rw__pill-label">${esc(v.size)}</span></label>`).join('');
  const seenIn = looks.length ? `<div class="pdp__looks"><span class="label">${esc(t.inLooks)}</span>${looks.map((l) => `<a href="/?look=${l.id}">${esc(pick(l, 'name', lang))}</a>`).join('')}</div>` : '';
  return `<section class="page pdp">
<a class="back" href="/shop">${esc(t.backToShop)}</a>
<div class="pdp__grid">
<div class="gallery">${gallery}</div>
<div class="pdp__info">
<span class="label">${esc(CATEGORIES[p.category] ? CATEGORIES[p.category][lang] : '')}${p.is_new ? ` · ${esc(t.isNew)}` : ''}</span>
<h1 class="pdp__name">${esc(name)}</h1>
<p class="pdp__price">${priceHtml(p, lang)}</p>
<form class="pdp__form" data-pdp novalidate>
<fieldset class="rw__opt"><legend class="rw__opt-name">${esc(p.size_label === 'shoe' ? t.shoeSize : t.size)}</legend><div class="rw__values">${pills}</div></fieldset>
<p class="pdp__stock" data-stock-note aria-live="polite"></p>
<div class="pdp__row">
<div class="qty" role="group" aria-label="${esc(t.quantity)}"><button type="button" data-qty="-1" aria-label="-">−</button><input id="qty" name="qty" type="number" inputmode="numeric" min="1" max="20" value="1" aria-label="${esc(t.quantity)}"><button type="button" data-qty="1" aria-label="+">+</button></div>
<button class="btn btn--block" type="submit"${firstOk < 0 ? ' disabled' : ''}>${esc(firstOk < 0 ? t.soldOut : t.addToBag)}</button>
</div>
<p class="pdp__added" data-added hidden>${esc(t.addedTo)} · <a href="/cart">${esc(t.viewBag)}</a></p>
</form>
${desc ? `<div class="pdp__desc">${esc(desc).replace(/\n/g, '<br>')}</div>` : ''}
${seenIn}
</div>
</div>
</section>`;
}

/* ---------- Cart & checkout (rendered in the browser from /api/cart/quote) ---------- */
function renderCart(req, { settings }) {
  const lang = req.lang;
  const t = T[lang];
  const pay = [];
  if (settings.cod_enabled) pay.push(['cod', t.cod, t.codHint]);
  if (settings.bank_enabled) pay.push(['bank', t.bank, t.bankHint]);
  if (!pay.length) pay.push(['cod', t.cod, t.codHint]);
  const field = (id, label, attrs = '', hint = '') => `<div class="field"><label for="${id}">${esc(label)}</label><input id="${id}" name="${id}" ${attrs}>${hint ? `<p class="field__hint" id="${id}-hint">${esc(hint)}</p>` : ''}<p class="field__error" id="${id}-err" hidden></p></div>`;
  return `<section class="page cart" data-cart-page>
<h1 class="page-title">${esc(t.cartTitle)}</h1>
<div class="cart__grid">
<div class="cart__lines" data-cart-lines aria-live="polite"><p class="empty">…</p></div>
<aside class="cart__side" data-cart-side hidden>
<dl class="summary" data-summary></dl>
<form class="checkout" data-checkout novalidate>
<h2 class="section-title">${esc(t.checkout)}</h2>
${field('name', t.fullName, 'autocomplete="name" required maxlength="80"')}
${field('phone', t.phone, 'type="tel" inputmode="tel" autocomplete="tel" required maxlength="20" dir="ltr" aria-describedby="phone-hint"', t.phoneHint)}
<div class="field-row">${field('city', t.city, 'autocomplete="address-level2" required maxlength="60"')}${field('district', t.district, 'maxlength="60"')}</div>
${field('address', t.address, 'autocomplete="street-address" required maxlength="200"')}
<div class="field"><label for="notes">${esc(t.notes)}</label><textarea id="notes" name="notes" rows="2" maxlength="300"></textarea></div>
<fieldset class="pay"><legend>${esc(t.payment)}</legend>${pay.map(([v, label, hint], i) => `<label class="pay__opt"><input type="radio" name="payment" value="${v}"${i === 0 ? ' checked' : ''}><span><strong>${esc(label)}</strong><small>${esc(hint)}</small></span></label>`).join('')}</fieldset>
<p class="form-error" data-form-error role="alert" hidden></p>
<button class="btn btn--block" type="submit" data-place>${esc(t.placeOrder)}</button>
</form>
</aside>
</div>
</section>`;
}

/* ---------- Order confirmation ---------- */
function orderLines(order, lang) {
  return order.items.map((it) => `<li class="oline">${it.image ? `<img src="${esc(it.image)}" alt="" width="56" height="70" loading="lazy">` : '<span></span>'}<span><strong>${esc(lang === 'ar' ? it.name_ar : it.name_en)}</strong><small>${esc(T[lang].size)} ${esc(it.size)} · × ${it.qty}</small></span><span>${esc(money(it.price * it.qty, lang))}</span></li>`).join('');
}
function totalsHtml(order, lang) {
  const t = T[lang];
  return `<dl class="summary">
<div><dt>${esc(t.subtotal)}</dt><dd>${esc(money(order.subtotal, lang))}</dd></div>
${order.discount ? `<div class="summary__save"><dt>${esc(t.lookDiscount)}</dt><dd>−${esc(money(order.discount, lang))}</dd></div>` : ''}
<div><dt>${esc(t.shipping)}</dt><dd>${order.shipping ? esc(money(order.shipping, lang)) : esc(t.free)}</dd></div>
<div class="summary__total"><dt>${esc(t.total)}</dt><dd>${esc(money(order.total, lang))}</dd></div>
</dl>`;
}

function renderOrder(req, { order, settings }) {
  const lang = req.lang;
  const t = T[lang];
  const bank = order.payment === 'bank'
    ? `<div class="note-box"><h2 class="section-title">${esc(t.bankTitle)}</h2>${settings.bank_details ? `<p class="pre">${esc(settings.bank_details)}</p>` : `<p>${esc(t.bankPending)}</p>`}</div>` : '';
  return `<section class="page page--narrow order">
<p class="label">${esc(t.orderNumber)}</p>
<p class="order__code" dir="ltr">${esc(order.code)}</p>
<h1 class="page-title">${esc(t.thanks)}</h1>
<p class="page-sub">${esc(t.orderNext)} ${esc(t.keepCode)}</p>
${bank}
<h2 class="section-title">${esc(t.items)}</h2>
<ul class="olines" role="list">${orderLines(order, lang)}</ul>
${totalsHtml(order, lang)}
<h2 class="section-title">${esc(t.deliverTo)}</h2>
<p>${esc(order.name)} · <span dir="ltr">${esc(order.phone)}</span><br>${esc([order.city, order.district, order.address].filter(Boolean).join('، '))}</p>
<p class="label">${esc(t.payment)}: ${esc(order.payment === 'bank' ? t.bank : t.cod)}</p>
<p><a class="btn" href="/track?code=${encodeURIComponent(order.code)}">${esc(t.trackThis)}</a></p>
<script>try{localStorage.removeItem('polo-cart-v1')}catch(e){}</script>
</section>`;
}

/* ---------- Tracking ---------- */
function renderTrack(req, { code, phone, order, notFound }) {
  const lang = req.lang;
  const t = T[lang];
  let result = '';
  if (notFound) result = `<p class="form-error" role="alert">${esc(t.notFound)}</p>`;
  if (order) {
    const steps = order.status === 'cancelled' ? ['new', 'cancelled'] : STATUSES.filter((s) => s !== 'cancelled');
    const reached = new Map(order.events.map((e) => [e.status, e.created_at]));
    const curIdx = steps.indexOf(order.status);
    const timeline = steps.map((s, i) => {
      const at = reached.get(s);
      const done = i <= curIdx;
      return `<li class="step${done ? ' is-done' : ''}${i === curIdx ? ' is-current' : ''}"><span class="step__dot" aria-hidden="true"></span><span><strong>${esc(t.status[s])}</strong>${done && at ? `<small dir="ltr">${esc(at.replace('T', ' ').slice(0, 16))}</small>` : ''}</span></li>`;
    }).join('');
    result = `<div class="track-result">
<p class="label">${esc(t.orderNumber)}</p><p class="order__code" dir="ltr">${esc(order.code)}</p>
<ol class="steps">${timeline}</ol>
<ul class="olines" role="list">${orderLines(order, lang)}</ul>
${totalsHtml(order, lang)}
</div>`;
  }
  return `<section class="page page--narrow">
<h1 class="page-title">${esc(t.trackTitle)}</h1>
<p class="page-sub">${esc(t.trackSub)}</p>
<form class="track-form" method="get" action="/track">
<div class="field"><label for="code">${esc(t.orderNumber)}</label><input id="code" name="code" required maxlength="12" value="${esc(code || '')}" dir="ltr" autocapitalize="characters" placeholder="PL-XXXXXX"></div>
<div class="field"><label for="tphone">${esc(t.phone)}</label><input id="tphone" name="phone" type="tel" inputmode="tel" required maxlength="20" value="${esc(phone || '')}" dir="ltr" placeholder="05XXXXXXXX"></div>
<button class="btn" type="submit">${esc(t.trackBtn)}</button>
</form>
${result}
</section>`;
}

function renderNotFound(req) {
  const t = T[req.lang];
  return `<section class="page page--narrow empty-state"><h1 class="page-title">404</h1><p>${esc(t.notFoundPage)}</p><p><a class="btn" href="/">${esc(t.goHome)}</a></p></section>`;
}

module.exports = { renderShop, renderProduct, renderCart, renderOrder, renderTrack, renderNotFound, json };
