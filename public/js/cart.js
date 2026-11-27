/* POLO cart: kept in the browser until checkout; the server prices it. */
(() => {
  'use strict';
  const KEY = 'polo-cart-v1';
  const MAX = 20;
  let toastTimer = 0;

  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw.filter((e) => e && Number.isSafeInteger(e.v) && Number.isSafeInteger(e.q) && e.q >= 1 && e.q <= MAX).slice(0, 50);
    } catch (_) { return []; }
  }
  function write(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (_) { /* storage blocked */ }
    renderCount(items);
  }
  function count(items = read()) { return items.reduce((s, e) => s + e.q, 0); }
  function renderCount(items) {
    const n = String(count(items));
    document.querySelectorAll('[data-cart-count]').forEach((el) => { el.textContent = n; });
  }
  function toast(text) {
    const el = document.getElementById('bag-status');
    if (!el) return;
    el.textContent = text;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-on'), 2500);
  }
  /** items: [{ id: variantId, quantity }] */
  async function add(items, opts = {}) {
    const cart = read();
    for (const { id, quantity } of items) {
      if (!Number.isSafeInteger(id)) throw new Error('bad variant');
      const found = cart.find((e) => e.v === id);
      if (found) found.q = Math.min(MAX, found.q + (quantity || 1));
      else cart.push({ v: id, q: Math.min(MAX, quantity || 1) });
    }
    write(cart);
    const t = (window.POLO && window.POLO.t) || {};
    if (!opts.silent) toast(items.length > 1 ? t.lookSaved : t.pieceSaved);
  }
  function set(v, q) {
    let cart = read();
    if (q <= 0) cart = cart.filter((e) => e.v !== v);
    else {
      const f = cart.find((e) => e.v === v);
      if (f) f.q = Math.min(MAX, q); else cart.push({ v, q: Math.min(MAX, q) });
    }
    write(cart);
  }
  function clear() { write([]); }

  function money(halalas) {
    const n = (halalas || 0) / 100;
    const s = n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
    return (window.POLO && window.POLO.lang) === 'en' ? `SAR ${s}` : `${s} ر.س`;
  }

  window.PoloCart = { read, write, add, set, clear, count, toast, money, renderCount: () => renderCount(read()) };
  renderCount(read());
  window.addEventListener('storage', (e) => { if (e.key === KEY) renderCount(read()); });
})();
