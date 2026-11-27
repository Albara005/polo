/* Product page: size, quantity, add to cart */
(() => {
  'use strict';
  const form = document.querySelector('[data-pdp]');
  if (!form) return;
  const P = window.POLO;
  const qty = form.querySelector('#qty');
  const note = form.querySelector('[data-stock-note]');
  const added = form.querySelector('[data-added]');
  const btn = form.querySelector('button[type="submit"]');

  const selected = () => form.querySelector('input[name="size"]:checked');
  function maxFor(input) {
    const s = input && input.dataset.stock;
    return s === '' || s === undefined ? 20 : Math.min(20, Number(s));
  }
  function update() {
    const input = selected();
    const max = maxFor(input);
    qty.max = String(Math.max(1, max));
    if (Number(qty.value) > max) qty.value = String(Math.max(1, max));
    note.textContent = input && input.dataset.stock !== '' && max > 0 && max <= 5 ? P.t.stockLine.replace('{n}', max) : '';
    added.hidden = true;
  }
  form.addEventListener('change', update);
  form.querySelectorAll('[data-qty]').forEach((b) => b.addEventListener('click', () => {
    const next = Math.min(Number(qty.max) || 20, Math.max(1, (Number(qty.value) || 1) + Number(b.dataset.qty)));
    qty.value = String(next);
  }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = selected();
    if (!input) { note.textContent = P.t.chooseSize; return; }
    const q = Math.min(Number(qty.max) || 20, Math.max(1, Math.floor(Number(qty.value)) || 1));
    btn.disabled = true;
    await window.PoloCart.add([{ id: Number(input.value), quantity: q }]);
    btn.disabled = false;
    added.hidden = false;
  });
  update();
})();
