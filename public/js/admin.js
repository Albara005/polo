/* POLO admin dashboard */
(() => {
  'use strict';
  const A = window.ADMIN;
  const app = document.getElementById('app');
  const toastEl = document.getElementById('toast');
  const state = { products: [], looks: [], settings: null, placing: 0, draft: null };
  let toastTimer = 0;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sar = (h) => { const n = (h || 0) / 100; return n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }) + ' ر.س'; };
  const toHalalas = (v) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN; };
  const fromHalalas = (h) => (h === null || h === undefined ? '' : String(h / 100));
  const catLabel = (c) => (A.categories[c] ? A.categories[c].ar : c);
  const date = (s) => (s ? s.replace('T', ' ').slice(0, 16) : '');

  function toast(msg, bad) {
    toastEl.textContent = msg;
    toastEl.className = 'is-on' + (bad ? ' is-bad' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.className = ''; }, 2800);
  }

  async function api(method, url, body) {
    const opts = { method, headers: { 'X-Polo-Admin': '1' } };
    if (body instanceof FormData) opts.body = body;
    else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const res = await fetch(url, opts);
    if (res.status === 401 && !url.endsWith('/login')) { renderLogin(); throw new Error('auth'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'error'), { status: res.status, data });
    return data;
  }

  /* ---------- login ---------- */
  async function boot() {
    const me = await fetch('/api/admin/me').then((r) => r.json()).catch(() => ({}));
    if (!me.configured) {
      app.innerHTML = `<main class="login"><h1>لوحة تحكم POLO</h1><p class="muted">لوحة التحكم مقفلة لأن كلمة المرور غير مضبوطة.</p><p>أضف متغير البيئة <code dir="ltr">ADMIN_PASSWORD</code> في Railway (أو في جهازك)، ثم أعد تشغيل الخادم.</p></main>`;
      return;
    }
    if (!me.admin) { renderLogin(); return; }
    route();
  }
  function renderLogin(msg) {
    app.innerHTML = `<main class="login"><h1>لوحة تحكم POLO</h1>
<form id="login-form" class="stack">
<label class="field"><span>كلمة المرور</span><input id="password" type="password" autocomplete="current-password" required dir="ltr"></label>
<p class="error" id="login-err" ${msg ? '' : 'hidden'}>${esc(msg || '')}</p>
<button class="btn" type="submit">دخول</button>
</form></main>`;
    const form = document.getElementById('login-form');
    form.password.focus();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('POST', '/api/admin/login', { password: form.password.value });
        route();
      } catch (err) {
        const m = err.status === 429 ? 'محاولات كثيرة. انتظر ربع ساعة وحاول مرة ثانية.' : 'كلمة المرور غير صحيحة.';
        renderLogin(m);
      }
    });
  }

  /* ---------- shell ---------- */
  const TABS = [['orders', 'الطلبات'], ['products', 'المنتجات'], ['looks', 'الإطلالات'], ['settings', 'الإعدادات']];
  function shell(active, inner) {
    app.innerHTML = `<header class="bar"><span class="logo" dir="ltr">POLO</span><nav>${TABS.map(([k, l]) => `<a href="#${k}"${k === active ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
<span class="bar__end"><a href="/" target="_blank" rel="noopener">عرض المتجر ↗</a><button type="button" class="link" id="logout">خروج</button></span></header>
<main class="main">${inner}</main>`;
    document.getElementById('logout').addEventListener('click', async () => { await api('POST', '/api/admin/logout'); renderLogin(); });
  }

  async function route() {
    const [section, id] = (location.hash.slice(1) || 'orders').split('/');
    try {
      if (section === 'products') return id ? productForm(id) : productList();
      if (section === 'looks') return id ? lookForm(id) : lookList();
      if (section === 'settings') return settingsView();
      return id ? orderView(id) : orderList();
    } catch (err) {
      if (err.message !== 'auth') toast('صار خطأ في التحميل. حدّث الصفحة.', true);
    }
  }
  window.addEventListener('hashchange', route);

  /* ---------- orders ---------- */
  const statusChip = (s) => `<span class="status status--${s}">${esc(A.statusLabels[s] || s)}</span>`;
  async function orderList() {
    const filter = new URLSearchParams(location.search).get('status') || state.orderFilter || '';
    const { orders, stats } = await api('GET', `/api/admin/orders${filter ? `?status=${filter}` : ''}`);
    const count = (s) => (stats.find((x) => x.status === s) || {}).n || 0;
    const total = stats.reduce((n, s) => n + s.n, 0);
    shell('orders', `<div class="head"><h1>الطلبات</h1></div>
<div class="filters" role="group" aria-label="تصفية حسب الحالة">
<button type="button" class="pill" data-filter=""${!filter ? ' aria-pressed="true"' : ''}>الكل <b>${total}</b></button>
${A.statuses.map((s) => `<button type="button" class="pill" data-filter="${s}"${filter === s ? ' aria-pressed="true"' : ''}>${esc(A.statusLabels[s])} <b>${count(s)}</b></button>`).join('')}
</div>
${orders.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>رقم الطلب</th><th>التاريخ</th><th>العميل</th><th>الجوال</th><th>المدينة</th><th>القطع</th><th>الإجمالي</th><th>الدفع</th><th>الحالة</th></tr></thead><tbody>
${orders.map((o) => `<tr data-href="#orders/${o.id}" tabindex="0"><td dir="ltr" class="mono">${esc(o.code)}</td><td dir="ltr">${esc(date(o.created_at))}</td><td>${esc(o.name)}</td><td dir="ltr">${esc(o.phone)}</td><td>${esc(o.city)}</td><td>${o.item_count}</td><td>${esc(sar(o.total))}</td><td>${o.payment === 'bank' ? 'تحويل' : 'عند الاستلام'}</td><td>${statusChip(o.status)}</td></tr>`).join('')}
</tbody></table></div>` : '<p class="empty">ما فيه طلبات هنا حتى الآن. أول ما يطلب زبون من المتجر، يظهر طلبه هنا.</p>'}`);
    app.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => { state.orderFilter = b.dataset.filter; orderList(); }));
    bindRowLinks();
  }
  function bindRowLinks() {
    app.querySelectorAll('tr[data-href]').forEach((tr) => {
      tr.addEventListener('click', () => { location.hash = tr.dataset.href; });
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') location.hash = tr.dataset.href; });
    });
  }
  function waNumber(phone) {
    const p = String(phone).replace(/\D/g, '');
    return /^05\d{8}$/.test(p) ? '966' + p.slice(1) : p;
  }
  async function orderView(id) {
    const o = await api('GET', `/api/admin/orders/${id}`);
    const msg = encodeURIComponent(`مرحبًا ${o.name}، معك متجر POLO بخصوص طلبك ${o.code}.`);
    shell('orders', `<a class="back" href="#orders">→ كل الطلبات</a>
<div class="head"><h1 dir="ltr" class="mono">${esc(o.code)}</h1>${statusChip(o.status)}</div>
<div class="cols">
<section class="panel">
<h2>القطع</h2>
<ul class="lines">${o.items.map((it) => `<li>${it.image ? `<img src="${esc(it.image)}" alt="" width="48" height="60">` : '<span></span>'}<span><strong>${esc(it.name_ar)}</strong><small>المقاس ${esc(it.size)} · × ${it.qty}</small></span><span>${esc(sar(it.price * it.qty))}</span></li>`).join('')}</ul>
<dl class="sum"><div><dt>المجموع</dt><dd>${sar(o.subtotal)}</dd></div>${o.discount ? `<div><dt>خصم الإطلالة</dt><dd>−${sar(o.discount)}</dd></div>` : ''}<div><dt>الشحن</dt><dd>${o.shipping ? sar(o.shipping) : 'مجاني'}</dd></div><div class="sum__total"><dt>الإجمالي</dt><dd>${sar(o.total)}</dd></div></dl>
</section>
<section class="panel">
<h2>العميل</h2>
<p><strong>${esc(o.name)}</strong><br><span dir="ltr">${esc(o.phone)}</span></p>
<p class="actions"><a class="btn btn--small" href="https://wa.me/${esc(waNumber(o.phone))}?text=${msg}" target="_blank" rel="noopener">واتساب</a><a class="btn btn--small btn--ghost" href="tel:${esc(o.phone)}">اتصال</a></p>
<h2>العنوان</h2>
<p>${esc([o.city, o.district].filter(Boolean).join('، '))}<br>${esc(o.address)}</p>
${o.notes ? `<h2>ملاحظات</h2><p>${esc(o.notes)}</p>` : ''}
<h2>الدفع</h2><p>${o.payment === 'bank' ? 'تحويل بنكي' : 'الدفع عند الاستلام'}</p>
<h2>حالة الطلب</h2>
<div class="status-picker" role="group" aria-label="حالة الطلب">${A.statuses.map((s) => `<button type="button" class="pill" data-status="${s}"${o.status === s ? ' aria-pressed="true"' : ''}>${esc(A.statusLabels[s])}</button>`).join('')}</div>
<p class="muted small">إلغاء الطلب يرجّع الكمية للمخزون تلقائيًا.</p>
<h2>السجل</h2>
<ol class="events">${o.events.map((e) => `<li>${esc(A.statusLabels[e.status] || e.status)} · <span dir="ltr">${esc(date(e.created_at))}</span></li>`).join('')}</ol>
</section>
</div>`);
    app.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', async () => {
      if (b.getAttribute('aria-pressed') === 'true') return;
      await api('PATCH', `/api/admin/orders/${id}`, { status: b.dataset.status });
      toast('تم تحديث حالة الطلب');
      orderView(id);
    }));
  }

  /* ---------- products ---------- */
  async function loadProducts() { state.products = await api('GET', '/api/admin/products'); return state.products; }
  async function productList() {
    const list = await loadProducts();
    shell('products', `<div class="head"><h1>المنتجات</h1><a class="btn" href="#products/new">منتج جديد</a></div>
${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th></th><th>المنتج</th><th>القسم</th><th>السعر</th><th>المقاسات والمخزون</th><th>الحالة</th></tr></thead><tbody>
${list.map((p) => `<tr data-href="#products/${p.id}" tabindex="0"><td>${p.images[0] ? `<img class="thumb" src="${esc(p.images[0].thumb || p.images[0].src)}" alt="" width="44" height="55">` : '<span class="thumb"></span>'}</td>
<td><strong>${esc(p.name_ar)}</strong><br><small class="muted" dir="ltr">${esc(p.name_en)}</small></td><td>${esc(catLabel(p.category))}</td><td>${esc(sar(p.price))}</td>
<td class="small">${p.variants.map((v) => `<span class="size${v.stock === 0 ? ' is-out' : ''}">${esc(v.size)}${v.stock === null ? '' : `<sub>${v.stock}</sub>`}</span>`).join(' ')}</td>
<td>${p.active ? '<span class="status status--delivered">ظاهر</span>' : '<span class="status status--cancelled">مخفي</span>'}${p.is_new ? ' <span class="status status--new">جديد</span>' : ''}</td></tr>`).join('')}
</tbody></table></div>` : '<p class="empty">ما فيه منتجات. ابدأ بإضافة أول منتج.</p>'}`);
    bindRowLinks();
  }

  const PRESETS = { apparel: ['S', 'M', 'L', 'XL'], apparel2: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], shoes: ['40', '41', '42', '43', '44', '45', '46'], one: ['مقاس واحد'] };

  async function productForm(id) {
    if (!state.products.length) await loadProducts();
    const isNew = id === 'new';
    const p = isNew
      ? { name_en: '', name_ar: '', category: 'tshirts', price: 0, compare_price: null, size_label: 'size', images: [], desc_ar: '', desc_en: '', is_new: false, active: true, sort: 0, variants: PRESETS.apparel.map((size) => ({ size, stock: null })) }
      : state.products.find((x) => String(x.id) === id);
    if (!p) { location.hash = 'products'; return; }
    state.draft = { images: p.images.slice(), variants: p.variants.map((v) => ({ size: v.size, stock: v.stock })) };
    shell('products', `<a class="back" href="#products">→ كل المنتجات</a>
<div class="head"><h1>${isNew ? 'منتج جديد' : esc(p.name_ar)}</h1>${isNew ? '' : `<a class="link" href="/product/${esc(p.slug)}" target="_blank" rel="noopener">عرض في المتجر ↗</a>`}</div>
<form id="pform" class="form" novalidate>
<div class="grid2">
<label class="field"><span>الاسم بالعربي</span><input name="name_ar" value="${esc(p.name_ar)}" maxlength="120"></label>
<label class="field"><span>الاسم بالإنجليزي</span><input name="name_en" value="${esc(p.name_en)}" maxlength="120" dir="ltr" required></label>
<label class="field"><span>القسم</span><select name="category">${Object.keys(A.categories).map((c) => `<option value="${c}"${p.category === c ? ' selected' : ''}>${esc(A.categories[c].ar)}</option>`).join('')}</select></label>
<div class="grid2 tight">
<label class="field"><span>السعر (ر.س)</span><input name="price" inputmode="decimal" value="${esc(fromHalalas(p.price))}" dir="ltr" required></label>
<label class="field"><span>السعر قبل الخصم (اختياري)</span><input name="compare_price" inputmode="decimal" value="${esc(fromHalalas(p.compare_price))}" dir="ltr"></label>
</div>
</div>

<fieldset class="box"><legend>المقاسات والمخزون</legend>
<div class="row wrap">
<label class="radio"><input type="radio" name="size_label" value="size"${p.size_label !== 'shoe' ? ' checked' : ''}> مقاسات ملابس</label>
<label class="radio"><input type="radio" name="size_label" value="shoe"${p.size_label === 'shoe' ? ' checked' : ''}> مقاسات أحذية</label>
</div>
<p class="muted small">اترك خانة المخزون فاضية إذا الكمية مفتوحة. اكتب 0 إذا المقاس نفد.</p>
<div id="variants"></div>
<div class="row wrap"><button type="button" class="btn btn--small btn--ghost" data-add-size>+ مقاس</button>
<span class="muted small">جاهز:</span>
<button type="button" class="pill" data-preset="apparel">S – XL</button><button type="button" class="pill" data-preset="apparel2">XS – XXL</button><button type="button" class="pill" data-preset="shoes">40 – 46</button><button type="button" class="pill" data-preset="one">مقاس واحد</button></div>
</fieldset>

<fieldset class="box"><legend>الصور</legend>
<p class="muted small">أول صورة هي الرئيسية. الأفضل خلفية بيضاء أو شفافة، بنسبة طولية.</p>
<div id="images" class="images"></div>
<label class="upload"><input type="file" accept="image/*" multiple data-upload="product"><span>+ رفع صور</span></label>
</fieldset>

<div class="grid2">
<label class="field"><span>الوصف بالعربي</span><textarea name="desc_ar" rows="5" maxlength="4000">${esc(p.desc_ar)}</textarea></label>
<label class="field"><span>الوصف بالإنجليزي</span><textarea name="desc_en" rows="5" maxlength="4000" dir="ltr">${esc(p.desc_en)}</textarea></label>
</div>

<div class="row wrap">
<label class="check"><input type="checkbox" name="active"${p.active ? ' checked' : ''}> ظاهر في المتجر</label>
<label class="check"><input type="checkbox" name="is_new"${p.is_new ? ' checked' : ''}> عليه علامة «جديد»</label>
<label class="field inline"><span>الترتيب</span><input name="sort" type="number" value="${esc(p.sort)}" dir="ltr"></label>
</div>
<p class="error" id="ferr" hidden></p>
<div class="row"><button class="btn" type="submit">حفظ</button>${isNew ? '' : '<button type="button" class="btn btn--danger" data-delete>حذف المنتج</button>'}</div>
</form>`);
    renderVariants();
    renderImages();
    const form = document.getElementById('pform');
    form.addEventListener('click', (e) => {
      const preset = e.target.closest('[data-preset]');
      if (preset) {
        state.draft.variants = PRESETS[preset.dataset.preset].map((size) => ({ size, stock: null }));
        form.size_label.value = preset.dataset.preset === 'shoes' ? 'shoe' : 'size';
        renderVariants();
      }
      if (e.target.closest('[data-add-size]')) { syncVariants(); state.draft.variants.push({ size: '', stock: null }); renderVariants(true); }
      const rm = e.target.closest('[data-rm-size]');
      if (rm) { syncVariants(); state.draft.variants.splice(Number(rm.dataset.rmSize), 1); renderVariants(); }
      const rmImg = e.target.closest('[data-rm-img]');
      if (rmImg) { state.draft.images.splice(Number(rmImg.dataset.rmImg), 1); renderImages(); }
      const main = e.target.closest('[data-main-img]');
      if (main) { const [img] = state.draft.images.splice(Number(main.dataset.mainImg), 1); state.draft.images.unshift(img); renderImages(); }
      const del = e.target.closest('[data-delete]');
      if (del) confirmDelete(del, async () => { await api('DELETE', `/api/admin/products/${p.id}`); toast('تم حذف المنتج'); location.hash = 'products'; });
    });
    form.querySelector('[data-upload]').addEventListener('change', async (e) => {
      for (const file of e.target.files) {
        const img = await uploadFile(file, 'product', e.target.closest('.upload'));
        if (img) { state.draft.images.push(img); renderImages(); }
      }
      e.target.value = '';
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      syncVariants();
      const err = document.getElementById('ferr');
      const price = toHalalas(form.price.value);
      const compare = form.compare_price.value.trim() ? toHalalas(form.compare_price.value) : null;
      const problems = [];
      if (!form.name_en.value.trim()) problems.push('اكتب اسم المنتج بالإنجليزي (يُستخدم في الرابط).');
      if (!Number.isFinite(price)) problems.push('اكتب سعر صحيح بالأرقام.');
      if (compare !== null && !Number.isFinite(compare)) problems.push('السعر قبل الخصم لازم يكون رقم.');
      const variants = state.draft.variants.filter((v) => v.size.trim());
      if (!variants.length) problems.push('أضف مقاس واحد على الأقل.');
      if (problems.length) { err.textContent = problems.join(' '); err.hidden = false; return; }
      err.hidden = true;
      const body = {
        name_en: form.name_en.value, name_ar: form.name_ar.value, category: form.category.value, price, compare_price: compare,
        size_label: form.size_label.value, variants, images: state.draft.images, desc_ar: form.desc_ar.value, desc_en: form.desc_en.value,
        active: form.active.checked, is_new: form.is_new.checked, sort: Number(form.sort.value) || 0, slug: isNew ? '' : p.slug
      };
      try {
        const saved = await api(isNew ? 'POST' : 'PUT', isNew ? '/api/admin/products' : `/api/admin/products/${p.id}`, body);
        toast('تم الحفظ');
        await loadProducts();
        if (isNew) location.hash = `products/${saved.id}`; else productForm(String(saved.id));
      } catch (ex) {
        err.textContent = 'ما قدرنا نحفظ. تأكد من الحقول وحاول مرة ثانية.';
        err.hidden = false;
      }
    });
  }
  function syncVariants() {
    document.querySelectorAll('#variants .vrow').forEach((row, i) => {
      const v = state.draft.variants[i];
      if (!v) return;
      v.size = row.querySelector('[data-size]').value.trim();
      const s = row.querySelector('[data-stock]').value.trim();
      v.stock = s === '' ? null : Math.max(0, Math.floor(Number(s)) || 0);
    });
  }
  function renderVariants(focusLast) {
    const el = document.getElementById('variants');
    el.innerHTML = state.draft.variants.map((v, i) => `<div class="vrow"><label class="field inline"><span>المقاس</span><input data-size value="${esc(v.size)}" maxlength="20" dir="ltr"></label><label class="field inline"><span>المخزون</span><input data-stock type="number" min="0" value="${v.stock ?? ''}" placeholder="مفتوح" dir="ltr"></label><button type="button" class="link" data-rm-size="${i}" aria-label="حذف المقاس ${esc(v.size)}">حذف</button></div>`).join('') || '<p class="muted small">ما فيه مقاسات.</p>';
    if (focusLast) { const inputs = el.querySelectorAll('[data-size]'); if (inputs.length) inputs[inputs.length - 1].focus(); }
  }
  function renderImages() {
    const el = document.getElementById('images');
    el.innerHTML = state.draft.images.map((img, i) => `<figure class="img${i === 0 ? ' is-main' : ''}"><img src="${esc(img.thumb || img.src)}" alt=""><figcaption>${i === 0 ? '<span class="badge">الرئيسية</span>' : `<button type="button" class="link" data-main-img="${i}">اجعلها الرئيسية</button>`}<button type="button" class="link" data-rm-img="${i}">حذف</button></figcaption></figure>`).join('');
  }
  async function uploadFile(file, kind, label) {
    const span = label && label.querySelector('span');
    const old = span && span.textContent;
    if (span) span.textContent = 'جاري الرفع…';
    try {
      const fd = new FormData();
      fd.append('file', file);
      return await api('POST', `/api/admin/upload?kind=${kind}`, fd);
    } catch (_) {
      toast('ما قدرنا نرفع الصورة. استخدم JPG أو PNG أو WebP أقل من 12MB.', true);
      return null;
    } finally {
      if (span) span.textContent = old;
    }
  }
  function confirmDelete(btn, fn) {
    if (btn.dataset.armed) { fn().catch(() => toast('ما قدرنا نحذف.', true)); return; }
    btn.dataset.armed = '1';
    const old = btn.textContent;
    btn.textContent = 'اضغط مرة ثانية للتأكيد';
    setTimeout(() => { delete btn.dataset.armed; btn.textContent = old; }, 4000);
  }

  /* ---------- looks ---------- */
  async function loadLooks() { state.looks = await api('GET', '/api/admin/looks'); return state.looks; }
  async function lookList() {
    const [looks] = await Promise.all([loadLooks(), loadProducts()]);
    shell('looks', `<div class="head"><h1>الإطلالات</h1><a class="btn" href="#looks/new">إطلالة جديدة</a></div>
<p class="muted">الإطلالات هي الموديلات اللي تدور في الصفحة الرئيسية. كل إطلالة فيها صورة موديل وقطع من منتجاتك.</p>
${looks.length ? `<ul class="looks">${looks.map((l, i) => `<li><a href="#looks/${l.id}"><span class="looks__img">${l.image.small || l.image.src ? `<img src="${esc(l.image.small || l.image.src)}" alt="">` : ''}</span><span class="looks__meta"><span class="muted small" dir="ltr">${String(i + 1).padStart(2, '0')}</span><strong>${esc(l.name_ar)}</strong><span class="small muted">${l.items.length} قطع · خصم ${l.discount}%</span>${l.active ? '' : '<span class="status status--cancelled">مخفية</span>'}</span></a></li>`).join('')}</ul>` : '<p class="empty">ما فيه إطلالات. الصفحة الرئيسية بتعرض رسالة «إطلالات جديدة قريبًا» لين تضيف وحدة.</p>'}`);
  }

  async function lookForm(id) {
    if (!state.products.length) await loadProducts();
    if (!state.looks.length) await loadLooks();
    const isNew = id === 'new';
    const l = isNew
      ? { name_ar: '', name_en: '', discount: 10, active: true, sort: state.looks.length, image: {}, items: [] }
      : state.looks.find((x) => String(x.id) === id);
    if (!l) { location.hash = 'looks'; return; }
    state.draft = { image: { ...l.image }, items: l.items.map((i) => ({ ...i })) };
    state.placing = 0;
    shell('looks', `<a class="back" href="#looks">→ كل الإطلالات</a>
<div class="head"><h1>${isNew ? 'إطلالة جديدة' : esc(l.name_ar)}</h1></div>
<form id="lform" class="form look-form" novalidate>
<div class="look-cols">
<div class="stack">
<div class="grid2">
<label class="field"><span>اسم الإطلالة بالعربي</span><input name="name_ar" value="${esc(l.name_ar)}" maxlength="80"></label>
<label class="field"><span>الاسم بالإنجليزي</span><input name="name_en" value="${esc(l.name_en)}" maxlength="80" dir="ltr"></label>
</div>
<div class="row wrap">
<label class="field inline"><span>خصم الإطلالة الكاملة %</span><input name="discount" type="number" min="0" max="90" value="${esc(l.discount)}" dir="ltr"></label>
<label class="field inline"><span>الترتيب</span><input name="sort" type="number" value="${esc(l.sort)}" dir="ltr"></label>
<label class="check"><input type="checkbox" name="active"${l.active ? ' checked' : ''}> ظاهرة</label>
</div>
<p class="muted small">الخصم ينطبق في السلة لما الزبون يضيف كل قطع الإطلالة. اكتب 0 لإلغاء الخصم.</p>
<fieldset class="box"><legend>القطع في الإطلالة</legend>
<p class="muted small">اختر القطعة، ثم اضغط «حدّد مكانها» واضغط على الصورة في المكان اللي تبي النقطة فيه.</p>
<div id="litems"></div>
<button type="button" class="btn btn--small btn--ghost" data-add-item>+ قطعة</button>
</fieldset>
<p class="error" id="lerr" hidden></p>
<div class="row"><button class="btn" type="submit">حفظ</button>${isNew ? '' : '<button type="button" class="btn btn--danger" data-delete>حذف الإطلالة</button>'}</div>
</div>
<div class="stack">
<div class="model-box" id="model-box" title="اضغط لتحديد مكان القطعة المختارة"></div>
<label class="upload"><input type="file" accept="image/png,image/webp,image/*" data-upload="look"><span>${l.image.src ? 'تغيير صورة الموديل' : '+ رفع صورة الموديل'}</span></label>
<p class="muted small">الأفضل صورة كاملة من الرأس للقدم، بخلفية شفافة (PNG أو WebP)، بنسبة 9:16.</p>
</div>
</div>
</form>`);
    renderLookItems();
    renderModel();
    const form = document.getElementById('lform');
    form.addEventListener('click', (e) => {
      if (e.target.closest('[data-add-item]')) {
        if (state.draft.items.length >= 6) { toast('الحد 6 قطع للإطلالة.', true); return; }
        const used = new Set(state.draft.items.map((i) => i.product_id));
        const next = state.products.find((p) => !used.has(p.id)) || state.products[0];
        if (!next) { toast('أضف منتجات أول.', true); return; }
        state.draft.items.push({ product_id: next.id, x: 50, y: 20 + state.draft.items.length * 25 });
        state.placing = state.draft.items.length - 1;
        renderLookItems(); renderModel();
      }
      const rm = e.target.closest('[data-rm-item]');
      if (rm) { state.draft.items.splice(Number(rm.dataset.rmItem), 1); state.placing = 0; renderLookItems(); renderModel(); }
      const place = e.target.closest('[data-place]');
      if (place) { state.placing = Number(place.dataset.place); renderLookItems(); renderModel(); document.getElementById('model-box').focus(); }
      const del = e.target.closest('[data-delete]');
      if (del) confirmDelete(del, async () => { await api('DELETE', `/api/admin/looks/${l.id}`); toast('تم حذف الإطلالة'); await loadLooks(); location.hash = 'looks'; });
    });
    form.addEventListener('change', (e) => {
      const sel = e.target.closest('[data-item-product]');
      if (sel) { state.draft.items[Number(sel.dataset.itemProduct)].product_id = Number(sel.value); renderModel(); }
    });
    form.querySelector('[data-upload]').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const img = await uploadFile(file, 'look', e.target.closest('.upload'));
      if (img) { state.draft.image = { src: img.src, small: img.small, w: img.w, h: img.h }; renderModel(); }
      e.target.value = '';
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = document.getElementById('lerr');
      const problems = [];
      if (!form.name_en.value.trim() && !form.name_ar.value.trim()) problems.push('اكتب اسم الإطلالة.');
      if (!state.draft.image.src) problems.push('ارفع صورة الموديل.');
      if (!state.draft.items.length) problems.push('أضف قطعة واحدة على الأقل.');
      if (problems.length) { err.textContent = problems.join(' '); err.hidden = false; return; }
      err.hidden = true;
      const body = {
        name_ar: form.name_ar.value || form.name_en.value, name_en: form.name_en.value || form.name_ar.value,
        discount: Math.min(90, Math.max(0, Number(form.discount.value) || 0)), sort: Number(form.sort.value) || 0,
        active: form.active.checked, image: state.draft.image, items: state.draft.items
      };
      try {
        const saved = await api(isNew ? 'POST' : 'PUT', isNew ? '/api/admin/looks' : `/api/admin/looks/${l.id}`, body);
        toast('تم الحفظ');
        await loadLooks();
        if (isNew) location.hash = `looks/${saved.id}`; else lookForm(String(saved.id));
      } catch (_) {
        err.textContent = 'ما قدرنا نحفظ. تأكد من الحقول وحاول مرة ثانية.';
        err.hidden = false;
      }
    });
  }
  function renderLookItems() {
    const el = document.getElementById('litems');
    el.innerHTML = state.draft.items.map((it, i) => `<div class="irow${state.placing === i ? ' is-placing' : ''}"><span class="num">${i + 1}</span>
<select data-item-product="${i}" aria-label="القطعة ${i + 1}">${state.products.map((p) => `<option value="${p.id}"${p.id === it.product_id ? ' selected' : ''}>${esc(p.name_ar)}${p.active ? '' : ' (مخفي)'}</option>`).join('')}</select>
<button type="button" class="pill" data-place="${i}"${state.placing === i ? ' aria-pressed="true"' : ''}>حدّد مكانها</button>
<button type="button" class="link" data-rm-item="${i}">حذف</button></div>`).join('') || '<p class="muted small">ما فيه قطع.</p>';
  }
  function renderModel() {
    const box = document.getElementById('model-box');
    const src = state.draft.image.small || state.draft.image.src;
    box.innerHTML = (src ? `<img src="${esc(src)}" alt="">` : '<span class="muted small">صورة الموديل تظهر هنا</span>')
      + state.draft.items.map((it, i) => `<span class="dot${state.placing === i ? ' is-on' : ''}" style="left:${it.x}%;top:${it.y}%">${i + 1}</span>`).join('');
    box.tabIndex = 0;
    box.onclick = (e) => {
      if (!state.draft.items.length) return;
      const r = box.getBoundingClientRect();
      const it = state.draft.items[state.placing];
      if (!it) return;
      it.x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10;
      it.y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10;
      renderModel();
    };
    box.onkeydown = (e) => {
      const it = state.draft.items[state.placing];
      if (!it) return;
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d) return;
      e.preventDefault();
      it.x = Math.min(100, Math.max(0, it.x + d[0]));
      it.y = Math.min(100, Math.max(0, it.y + d[1]));
      renderModel();
      box.focus();
    };
  }

  /* ---------- settings ---------- */
  async function settingsView() {
    const s = await api('GET', '/api/admin/settings');
    shell('settings', `<div class="head"><h1>الإعدادات</h1></div>
<form id="sform" class="form narrow" novalidate>
<fieldset class="box"><legend>الشحن</legend>
<div class="grid2 tight">
<label class="field"><span>رسوم الشحن (ر.س)</span><input name="shipping_fee" inputmode="decimal" value="${esc(fromHalalas(s.shipping_fee))}" dir="ltr"></label>
<label class="field"><span>شحن مجاني للطلبات فوق (ر.س)</span><input name="free_shipping_over" inputmode="decimal" value="${esc(fromHalalas(s.free_shipping_over))}" dir="ltr"></label>
</div>
<p class="muted small">اكتب 0 في خانة الشحن المجاني لإلغائه.</p>
</fieldset>
<fieldset class="box"><legend>طرق الدفع</legend>
<label class="check"><input type="checkbox" name="cod_enabled"${s.cod_enabled ? ' checked' : ''}> الدفع عند الاستلام</label>
<label class="check"><input type="checkbox" name="bank_enabled"${s.bank_enabled ? ' checked' : ''}> تحويل بنكي</label>
<label class="field"><span>بيانات التحويل (تظهر للزبون بعد الطلب)</span><textarea name="bank_details" rows="4" maxlength="1000" placeholder="اسم البنك&#10;اسم المستفيد&#10;رقم الآيبان">${esc(s.bank_details)}</textarea></label>
</fieldset>
<fieldset class="box"><legend>التواصل</legend>
<label class="field"><span>رقم واتساب المتجر (يظهر أسفل الموقع)</span><input name="whatsapp" value="${esc(s.whatsapp)}" dir="ltr" placeholder="9665XXXXXXXX"></label>
</fieldset>
<button class="btn" type="submit">حفظ الإعدادات</button>
</form>`);
    const form = document.getElementById('sform');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fee = toHalalas(form.shipping_fee.value || 0);
      const free = toHalalas(form.free_shipping_over.value || 0);
      if (!Number.isFinite(fee) || !Number.isFinite(free)) { toast('اكتب أرقام صحيحة للشحن.', true); return; }
      await api('PUT', '/api/admin/settings', {
        shipping_fee: fee, free_shipping_over: free, cod_enabled: form.cod_enabled.checked, bank_enabled: form.bank_enabled.checked,
        bank_details: form.bank_details.value, whatsapp: form.whatsapp.value
      });
      toast('تم حفظ الإعدادات');
    });
  }

  boot();
})();
