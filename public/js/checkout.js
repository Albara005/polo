/* Cart page: lines priced by the server, then the delivery form */
(() => {
  'use strict';
  const page = document.querySelector('[data-cart-page]');
  if (!page) return;
  const P = window.POLO;
  const t = P.t;
  const Cart = window.PoloCart;
  const linesEl = page.querySelector('[data-cart-lines]');
  const side = page.querySelector('[data-cart-side]');
  const summary = page.querySelector('[data-summary]');
  const form = page.querySelector('[data-checkout]');
  const formError = form.querySelector('[data-form-error]');
  const placeBtn = form.querySelector('[data-place]');
  let last = null;
  let seq = 0;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const name = (l) => (P.lang === 'ar' ? l.name_ar : l.name_en) || l.name_en || '';

  async function refresh() {
    const items = Cart.read();
    if (!items.length) { renderEmpty(); return; }
    const my = ++seq;
    try {
      const res = await fetch('/api/cart/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
      const q = await res.json();
      if (my !== seq) return;
      last = q;
      render(q);
    } catch (_) {
      linesEl.innerHTML = `<p class="form-error">${esc(t.orderFailed)}</p>`;
    }
  }

  function renderEmpty() {
    last = null;
    side.hidden = true;
    linesEl.innerHTML = `<div class="empty-state"><p>${esc(t.cartEmpty)}</p><p><a class="btn" href="/shop">${esc(t.continueShopping)}</a></p></div>`;
  }

  function render(q) {
    if (!q.lines.length) { renderEmpty(); return; }
    linesEl.innerHTML = q.lines.map((l) => {
      if (!l.available && !l.name_en) {
        return `<div class="cline" data-v="${l.v}"><span class="cline__media"></span><div class="cline__info"><p class="cline__warn">${esc(t.unavailableLine)}</p></div><div class="cline__end"><button type="button" class="link-btn" data-remove>${esc(t.remove)}</button></div></div>`;
      }
      const warn = !l.available ? t.unavailableLine : l.short ? t.stockLine.replace('{n}', l.max) : '';
      return `<div class="cline" data-v="${l.v}">
<a class="cline__media" href="/product/${encodeURIComponent(l.slug)}">${l.image ? `<img src="${esc(l.image)}" alt="" loading="lazy" width="96" height="120">` : ''}</a>
<div class="cline__info"><a class="cline__name" href="/product/${encodeURIComponent(l.slug)}">${esc(name(l))}</a><span class="cline__meta">${esc(t.size)} ${esc(l.size)} · ${esc(Cart.money(l.price))}</span>${warn ? `<p class="cline__warn">${esc(warn)}</p>` : ''}</div>
<div class="cline__end"><span>${esc(Cart.money(l.line || 0))}</span>
<div class="qty" role="group" aria-label="${esc(t.quantity)}"><button type="button" data-step="-1" aria-label="-">−</button><input type="number" inputmode="numeric" min="1" max="${l.max || 20}" value="${l.qty}" aria-label="${esc(t.quantity)}: ${esc(name(l))}" data-q><button type="button" data-step="1" aria-label="+">+</button></div>
<button type="button" class="link-btn" data-remove>${esc(t.remove)}</button></div>
</div>`;
    }).join('');
    const rows = [`<div><dt>${esc(t.subtotal)}</dt><dd>${esc(Cart.money(q.subtotal))}</dd></div>`];
    for (const d of q.discounts) rows.push(`<div class="summary__save"><dt>${esc(t.lookDiscount)} · ${esc(P.lang === 'ar' ? d.name_ar : d.name_en)}</dt><dd>−${esc(Cart.money(d.amount))}</dd></div>`);
    rows.push(`<div><dt>${esc(t.shipping)}</dt><dd>${q.shipping ? esc(Cart.money(q.shipping)) : esc(t.free)}</dd></div>`);
    rows.push(`<div class="summary__total"><dt>${esc(t.total)}</dt><dd>${esc(Cart.money(q.total))}</dd></div>`);
    if (q.shipping && q.free_shipping_over > 0) rows.push(`<p class="summary__hint">${esc(t.freeShippingHint.replace('{p}', Cart.money(q.free_shipping_over)))}</p>`);
    summary.innerHTML = rows.join('');
    side.hidden = false;
    placeBtn.disabled = q.lines.some((l) => !l.available || l.short);
  }

  let qtyTimer = 0;
  linesEl.addEventListener('click', (e) => {
    const line = e.target.closest('[data-v]');
    if (!line) return;
    const v = Number(line.dataset.v);
    if (e.target.closest('[data-remove]')) { Cart.set(v, 0); refresh(); return; }
    const step = e.target.closest('[data-step]');
    if (step) {
      const input = line.querySelector('[data-q]');
      const max = Number(input.max) || 20;
      const next = Math.min(max, Math.max(1, Number(input.value) + Number(step.dataset.step)));
      input.value = String(next);
      Cart.set(v, next);
      clearTimeout(qtyTimer);
      qtyTimer = setTimeout(refresh, 250);
    }
  });
  linesEl.addEventListener('change', (e) => {
    const input = e.target.closest('[data-q]');
    if (!input) return;
    const v = Number(input.closest('[data-v]').dataset.v);
    const n = Math.floor(Number(input.value));
    Cart.set(v, n > 0 ? Math.min(Number(input.max) || 20, n) : 0);
    refresh();
  });

  /* ---------- checkout form ---------- */
  const toLatin = (s) => String(s || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  function normPhone(s) {
    let p = toLatin(s).replace(/[\s\-().]/g, '');
    if (/^(\+|00)?966/.test(p)) p = '0' + p.replace(/^(\+|00)?966/, '');
    if (/^5\d{8}$/.test(p)) p = '0' + p;
    return p;
  }
  const validPhone = (p) => /^05\d{8}$/.test(p) || /^\+?\d{8,15}$/.test(p);

  function setError(id, msg) {
    const input = form.querySelector(`#${id}`);
    const err = form.querySelector(`#${id}-err`);
    if (!input || !err) return;
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    err.textContent = msg || '';
    err.hidden = !msg;
    const ids = [input.id + '-hint', msg ? err.id : ''].filter((x) => x && form.querySelector('#' + x));
    if (ids.length) input.setAttribute('aria-describedby', ids.join(' ')); else input.removeAttribute('aria-describedby');
  }
  function validate() {
    let first = null;
    for (const id of ['name', 'phone', 'city', 'address']) {
      const input = form.querySelector(`#${id}`);
      let msg = '';
      if (!input.value.trim()) msg = t.required;
      else if (id === 'phone' && !validPhone(normPhone(input.value))) msg = t.badPhone;
      setError(id, msg);
      if (msg && !first) first = input;
    }
    return first;
  }
  form.addEventListener('input', (e) => {
    if (e.target.getAttribute('aria-invalid') === 'true') setError(e.target.id, '');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.hidden = true;
    const bad = validate();
    if (bad) { bad.focus(); return; }
    const data = Object.fromEntries(new FormData(form));
    placeBtn.disabled = true;
    placeBtn.textContent = t.placing;
    try {
      const res = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, phone: normPhone(data.phone), items: Cart.read(), lang: P.lang })
      });
      const out = await res.json().catch(() => ({}));
      if (res.ok && out.url) {
        Cart.clear();
        location.href = out.url;
        return;
      }
      if (res.status === 409 && out.quote) {
        // Keep only what can still be bought, at the quantities left
        Cart.write(out.quote.lines.filter((l) => l.available).map((l) => ({ v: l.v, q: Math.min(l.qty, l.max) })));
        formError.textContent = t.stockChanged;
        await refresh();
      } else if (res.status === 400 && out.fields) {
        out.fields.forEach((f) => setError(f, f === 'phone' ? t.badPhone : t.required));
        formError.textContent = t.required;
      } else {
        formError.textContent = t.orderFailed;
      }
      formError.hidden = false;
    } catch (_) {
      formError.textContent = t.orderFailed;
      formError.hidden = false;
    }
    placeBtn.disabled = !!(last && last.lines.some((l) => !l.available || l.short));
    placeBtn.textContent = t.placeOrder;
  });

  refresh();
})();
