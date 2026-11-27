(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => reduceMQ.matches;
  const isPhone = () => window.innerWidth <= 749;
  const reflow = (el) => void el.offsetWidth;
  const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const BRAND = window.RUNWAY_BRAND || { shortlistHeading: 'RUNWAY — STYLING SHORTLIST', shopHost: 'nike-makknzjs.myshopify.com' };

  /* ================================================================
   * Styling bag (local shortlist)
   * ================================================================ */
  const Bag = (() => {
    const KEY = 'runway-styling-bag-v3';
    let entries = load();
    let catalogPromise = null;
    let catalog = null;
    let toastTimer = 0;
    const $ = (id) => document.getElementById(id);

    function load() {
      try {
        const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
        if (!Array.isArray(raw)) return [];
        return raw.filter((e) => e && Number.isSafeInteger(e.id) && Number.isSafeInteger(e.quantity) && e.quantity >= 1 && e.quantity <= 20)
          .slice(0, 50).map((e) => ({ id: e.id, quantity: e.quantity }));
      } catch (_) { return []; }
    }
    function save() {
      try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch (_) { /* storage unavailable */ }
    }
    function validate(data) {
      const ok = data && Array.isArray(data.items) && data.items.every((it) =>
        typeof it.id === 'string' && typeof it.name === 'string' && Number.isFinite(it.price) && it.price >= 0 &&
        Array.isArray(it.variants) && it.variants.every((v) => Number.isSafeInteger(v.id) && typeof v.a === 'boolean' &&
          Array.isArray(v.o) && v.o.every((o) => typeof o === 'string')));
      if (!ok) throw new Error('The product list is unavailable.');
      const byVariant = new Map();
      data.items.forEach((item) => item.variants.forEach((v) => byVariant.set(v.id, { item, variant: v })));
      return { data, byVariant };
    }
    function getCatalog() {
      if (!catalogPromise) {
        catalogPromise = Promise.resolve().then(() => {
          const data = window.RUNWAY_CATALOG;
          if (!data) throw new Error('The product list could not load.');
          catalog = validate(data);
          return catalog;
        });
        catalogPromise.catch(() => { catalogPromise = null; });
      }
      return catalogPromise;
    }
    async function add(items) {
      const cat = await getCatalog();
      items.forEach(({ id }) => {
        const hit = cat.byVariant.get(id);
        if (!hit || !hit.variant.a) throw new Error('Please choose an available size.');
      });
      items.forEach(({ id, quantity }) => {
        const found = entries.find((e) => e.id === id);
        if (found) found.quantity = Math.min(20, found.quantity + (quantity || 1));
        else if (entries.length < 50) entries.push({ id, quantity: quantity || 1 });
      });
      save();
      render();
      toast(items.length > 1 ? 'Look saved to your styling bag' : 'Piece saved to your styling bag');
    }
    function remove(id) {
      entries = entries.filter((e) => e.id !== id);
      save();
      render();
    }
    function count() { return entries.reduce((s, e) => s + e.quantity, 0); }
    function toast(text) {
      const el = $('bag-status');
      if (!el) return;
      el.textContent = text;
      el.classList.add('is-on');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => el.classList.remove('is-on'), 2500);
    }
    function safeUrl(url) {
      const u = new URL(url);
      if (u.hostname !== BRAND.shopHost) throw new Error('Unexpected product link.');
      return u.href;
    }
    function render() {
      document.querySelectorAll('[data-cart-count]').forEach((el) => { el.textContent = String(count()); });
      const list = $('bag-items');
      if (!list) return;
      const total = $('bag-total');
      const exportBtn = $('export-bag');
      list.textContent = '';
      if (!entries.length || !catalog) {
        if (!entries.length) {
          const p = document.createElement('p');
          p.className = 'bag-note';
          p.textContent = 'Your styling bag is empty. Choose a size beside a piece to save it.';
          list.append(p);
          total.textContent = '';
          exportBtn.disabled = true;
          return;
        }
      }
      let sum = 0;
      entries.forEach((e) => {
        const hit = catalog && catalog.byVariant.get(e.id);
        if (!hit) return;
        const { item, variant } = hit;
        sum += item.price * e.quantity;
        const row = document.createElement('div');
        row.className = 'bag-row';
        const img = document.createElement('img');
        img.src = item.image; img.alt = item.name; img.width = 60; img.height = 80; img.loading = 'lazy';
        const info = document.createElement('div');
        const h = document.createElement('h3'); h.textContent = item.name;
        const p = document.createElement('p');
        p.textContent = `Size ${variant.o.join(' / ')} · Quantity ${e.quantity} · ${moneyFmt.format(item.price)}`;
        const a = document.createElement('a');
        a.href = safeUrl(item.url); a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.textContent = 'View original piece ↗';
        info.append(h, p, a);
        const rm = document.createElement('button');
        rm.type = 'button'; rm.textContent = '×'; rm.setAttribute('aria-label', `Remove ${item.name}`);
        rm.addEventListener('click', () => remove(e.id));
        row.append(img, info, rm);
        list.append(row);
      });
      total.textContent = `Reference subtotal ${moneyFmt.format(sum)}`;
      exportBtn.disabled = false;
    }
    function exportList() {
      if (!entries.length || !catalog) return;
      const lines = entries.map((e) => {
        const hit = catalog.byVariant.get(e.id);
        if (!hit) return '';
        return `${hit.item.name} · Size ${hit.variant.o.join(' / ')} · Quantity ${e.quantity}\n${hit.item.url}`;
      }).filter(Boolean);
      const text = [BRAND.shortlistHeading, 'Reference prices; no order or payment has been placed.', '', ...lines].join('\n\n');
      if (BRAND.exportMode === 'copy') {
        try {
          navigator.clipboard.writeText(text).then(() => toast('Shortlist copied'), () => toast('Copying isn’t available here'));
        } catch (_) { toast('Copying isn’t available here'); }
        return;
      }
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'runway-outfit-shortlist.txt';
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function initDialog() {
      const dialog = $('bag-dialog');
      const open = $('open-bag');
      if (open && dialog) {
        open.addEventListener('click', async () => {
          try { await getCatalog(); } catch (_) { /* render empty */ }
          try { render(); } catch (_) { /* bad link */ }
          if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
        });
        $('close-bag').addEventListener('click', () => dialog.close());
        dialog.addEventListener('click', (e) => {
          const r = dialog.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
        });
        $('export-bag').addEventListener('click', exportList);
      }
      getCatalog().then(() => render()).catch(() => render());
    }
    return { add, render, initDialog };
  })();

  /* ================================================================
   * <runway-section>
   * ================================================================ */
  const FEEL = { soft: [70, 0.06], balanced: [95, 0.04], snappy: [140, 0.03] };
  const CLASSIC = {
    phone: { ax: 0.3, ay: 22, sx: 0.32, sy: 22, sr: 0.76, ex: 0.55, d: 4 },
    desk: { ax: 0.4, ay: 36, sx: 0.125, sy: 58, sr: 0.76, ex: 0.38, d: 5 }
  };

  class RunwaySection extends HTMLElement {
    connectedCallback() {
      if (this._ready) return;
      this._ready = true;
      this.init();
    }

    disconnectedCallback() {
      cancelAnimationFrame(this.raf);
      cancelAnimationFrame(this.cursorRaf);
      clearTimeout(this.timer);
      clearTimeout(this.resizeT);
      clearTimeout(this.zoomT);
      [this.io, this.revealIO, this.ro].forEach((o) => o && o.disconnect());
      window.removeEventListener('resize', this.onResize);
      document.removeEventListener('visibilitychange', this.onVis);
      this.dockSheet();
      if (this.host) this.host.remove();
      this._ready = false;
    }

    init() {
      const q = (s) => this.querySelector(s);
      const ds = this.dataset;
      this.stage = q('[data-rw-stage]');
      this.actors = q('[data-rw-actors]');
      this.heroes = [...this.querySelectorAll('[data-rw-hero]')];
      this.ticks = [...this.querySelectorAll('[data-rw-tick]')];
      this.panels = [...this.querySelectorAll('[data-rw-panel]')];
      this.live = q('[data-rw-live]');
      this.pieces = q('[data-rw-pieces]');
      this.lb = q('[data-rw-lb]');
      this.lbStage = q('[data-rw-lb-stage]');
      this.cursor = q('[data-rw-cursor]');
      this.panel = q('.rw__panel');

      this.n = this.heroes.length;
      const feel = FEEL[ds.feel] || FEEL.balanced;
      this.K = feel[0];
      this.C = 2 * Math.sqrt(this.K);
      this.lag = feel[1];
      this.speed = parseInt(ds.speed, 10) || 5000;
      this.blurOn = ds.blur === 'true';

      // Clone bodies so the ring always has N = n * ceil(8 / n) figures.
      const originals = [...this.actors.querySelectorAll('[data-rw-model]')];
      const N = this.n * Math.ceil(8 / this.n);
      for (let a = this.n; a < N; a++) {
        const c = originals[a % this.n].cloneNode(true);
        c.setAttribute('data-rw-clone', '');
        c.querySelectorAll('img').forEach((img) => { img.loading = 'lazy'; });
        this.actors.append(c);
      }
      this.bodies = [...this.actors.querySelectorAll('[data-rw-model]')].map((el, a) => {
        el.dataset.body = a;
        return { el, a, look: a % this.n, hit: el.querySelector('.rw__hit'), w: 0, x: 0, v: 0, g: 0, goal: 0, trip: 0, from: 0, blur: -1, settled: false };
      });
      this.N = this.bodies.length;

      // State
      this.index = 0;
      this.target = 0;
      const start = reduced() ? 0 : 1.15;
      this.cur = -start;
      this.vel = 0;
      this.still = false;
      this.visible = false;
      this.dragging = false;
      this.playing = false;
      this.engaged = false;
      this.panelHover = false;
      this.zoomed = false;
      this.suppressUntil = 0;
      this.wheelAcc = 0;
      this.wheelLock = 0;
      this.last = 0;
      this.mode = '';
      this.vhLatch = { w: 0, h: 0 };

      this.classList.add('rw--js');
      this.decodeImages(this);
      this.bodies.forEach((s) => {
        const g = (s.a % this.N + this.N) % this.N;
        s.goal = g; s.g = g + start; s.x = g + start; s.v = 0;
      });

      // Pickers
      this.querySelectorAll('[data-rw-card]').forEach((card) => this.initCard(card));

      this.measure();
      this.setIndex(0, true);
      this.probeFeet();
      this.bindEvents();
      this.initCursor();

      // Visibility for the render loop
      this.io = new IntersectionObserver((es) => {
        this.visible = es.some((e) => e.isIntersecting);
        if (this.visible) { this.kick(); this.restartBar(); }
      }, { threshold: 0 });
      this.io.observe(this);

      // Intro reveal
      if (reduced()) {
        this.classList.add('is-revealed');
      } else {
        this.revealIO = new IntersectionObserver((es) => {
          if (!es.some((e) => e.isIntersecting)) return;
          this.revealIO.disconnect();
          requestAnimationFrame(() => requestAnimationFrame(() => this.classList.add('is-revealed')));
        }, { threshold: 0, rootMargin: '0px 0px -22% 0px' });
        this.revealIO.observe(this);
      }

      const design = window.Shopify && window.Shopify.designMode;
      if (design) this.classList.add('rw--design');
      if (this.dataset.autoplay === 'true' && !reduced() && !design) this.play(true);
    }

    /* ---------- images ---------- */
    decodeImages(root) {
      root.querySelectorAll('img[data-model-image]').forEach((img) => {
        if (img.classList.contains('is-decoded')) return;
        const done = () => img.classList.add('is-decoded');
        const fallback = () => {
          if (img.complete && img.naturalWidth) done();
          else img.addEventListener('load', done, { once: true });
        };
        try { img.decode().then(done, fallback); } catch (_) { fallback(); }
      });
    }

    probeFeet() {
      this.heroes.forEach((hero, look) => {
        const src = hero.dataset.probe;
        if (!src) return;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const w = 48;
            const h = Math.max(1, Math.round(w * img.naturalHeight / img.naturalWidth));
            const cv = document.createElement('canvas');
            cv.width = w; cv.height = h;
            const ctx = cv.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0, w, h);
            const px = ctx.getImageData(0, 0, w, h).data;
            let lastRow = -1;
            for (let y = h - 1; y >= 0 && lastRow < 0; y--) {
              for (let x = 0; x < w; x++) {
                if (px[(y * w + x) * 4 + 3] > 40) { lastRow = y; break; }
              }
            }
            if (lastRow < 0) return;
            const foot = clamp((h - 1 - lastRow) / h, 0, 0.4).toFixed(4);
            hero.style.setProperty('--rw-foot', foot);
            this.bodies.forEach((s) => { if (s.look === look) s.el.style.setProperty('--rw-foot', foot); });
          } catch (_) { /* tainted canvas: keep offset 0 */ }
        };
        img.src = src;
      });
    }

    /* ---------- measure ---------- */
    headerHeight() {
      let h = 0;
      document.querySelectorAll('.shopify-section-group-header-group, #shopify-section-header, #shopify-section-announcement-bar').forEach((el) => {
        if (el.contains(this)) return;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        h += r.height;
      });
      return h;
    }

    measure() {
      const phone = isPhone();
      const mode = phone ? (this.dataset.mstyle || 'classic') : (this.dataset.style || 'ring');
      const ds = this.dataset;
      let frameH;
      if (phone) {
        const lw = this.vhLatch;
        if (lw.w !== window.innerWidth || Math.abs(lw.h - window.innerHeight) >= 160 || !lw.h) {
          this.vhLatch = { w: window.innerWidth, h: window.innerHeight };
        }
        const pct = ds.mheightMode === 'custom' ? clamp(parseFloat(ds.mheightVh) || 100, 50, 120) : 100;
        frameH = this.vhLatch.h * pct / 100;
      } else if (ds.fit === 'true') {
        frameH = Math.max(380, window.innerHeight - this.headerHeight());
      } else {
        frameH = window.innerHeight * (parseFloat(ds.heightVh) || 100) / 100;
      }
      this.style.setProperty('--rw-frame-h', Math.round(frameH) + 'px');

      if (mode !== this.mode) {
        const prev = this.mode;
        this.mode = mode;
        if (prev) {
          if (mode === 'ring') { this.cur = this.target; this.vel = 0; }
          this.bodies.forEach((s) => {
            s.goal = this.wrapN(s.a - this.target); s.x = s.g = s.goal; s.v = 0; s.trip = 0;
          });
          if (!phone) this.dockSheet();
        }
      }
      this.phone = phone;

      const r = this.stage.getBoundingClientRect();
      this.W = r.width;
      this.H = r.height;
      const ring = mode === 'ring';
      this.fs = ring ? 1.08 : 1;
      this.style.setProperty('--rw-fs', this.fs);
      let modelH;
      if (ring) modelH = Math.max(200, Math.round((this.H - 34 - 18) / 1.08));
      else modelH = Math.max(200, Math.round(this.H - (phone ? 24 : 36) - 18));
      this.stage.style.setProperty('--rw-model-h', modelH + 'px');
      this.stage.style.setProperty('--rw-fs', this.fs);
      const P = phone ? CLASSIC.phone : CLASSIC.desk;
      this.cfg = P;
      const hx = ring ? 0.5 * this.W : P.ax * this.W;
      const hy = ring ? 34 : P.ay;
      this.stage.style.setProperty('--rw-hx', hx + 'px');
      this.stage.style.setProperty('--rw-hy', hy + 'px');
      this.style.setProperty('--rw-ax', (this.W ? hx / this.W * 100 : 40).toFixed(2) + '%');
      this.bodies.forEach((s) => { s.w = s.el.offsetWidth; });
      this.unit = ring ? Math.max(phone ? 90 : 120, 0.3 * this.W) : Math.max(90, this.W * P.sx * 1.6);
      this.renderAll();
    }

    wrapN(x) { const N = this.N; return ((x % N) + N) % N; }

    /* ---------- placement ---------- */
    put(s, x, bottom, scale, opacity, blur, z) {
      const half = s.w * scale / 2;
      if (x + half < -4 || x - half > this.W + 4) opacity = 0;
      s.el.style.transform = `translate3d(${x.toFixed(2)}px, ${(-bottom).toFixed(2)}px, 0) translateX(-50%) scale(${scale.toFixed(4)})`;
      s.el.style.opacity = opacity.toFixed(3);
      s.el.style.zIndex = z;
      s.el.style.visibility = opacity < 0.01 ? 'hidden' : '';
      s.el.style.pointerEvents = opacity < 0.5 ? 'none' : '';
      const b = this.blurOn ? Math.round(blur * 10) / 10 : 0;
      if (b !== s.blur) {
        s.blur = b;
        s.el.style.filter = b > 0.05 ? `blur(${b}px)` : '';
      }
    }

    renderAll() {
      if (!this.W) return;
      if (this.mode === 'ring') this.renderRing(); else this.renderClassic();
    }

    renderRing() {
      const W = this.W, H = this.H, phone = this.phone;
      const cx = 0.5 * W, R = (phone ? 0.72 : 0.62) * W, P = (phone ? 1.9 : 1.65) * W;
      const floor = H - 34, horizon = 0.36 * H, step = TAU / this.N, fs = this.fs;
      this.bodies.forEach((s) => {
        let phi = ((s.a - this.cur) * step) % TAU;
        if (phi <= -Math.PI) phi += TAU;
        if (phi > Math.PI) phi -= TAU;
        const z = R * (1 - Math.cos(phi));
        const persp = P / (P + z);
        const sl = Math.abs(phi) / step;
        const scale = persp * (1 + (fs - 1) * clamp(1 - sl, 0, 1));
        const x = cx + R * Math.sin(phi) * persp;
        const feet = horizon + (floor - horizon) * persp;
        const blur = sl <= 1 ? 1.8 * sl : Math.min(1.8 + (sl - 1) * 2, 6.5);
        let op = clamp((Math.cos(phi) + 0.55) / 0.3, 0, 1);
        if (this.still && sl < 0.02) op = 0;
        this.put(s, x, H - feet, scale, op, blur, Math.round(scale * 1000));
      });
    }

    renderClassic() {
      const W = this.W, c = this.cfg;
      this.bodies.forEach((s) => {
        let k = s.x, e = -1;
        if (s.trip) {
          const span = Math.abs(s.goal - s.from) || 1;
          const u = clamp(Math.abs(s.x - s.from) / span, 0, 1);
          if (s.trip > 0) { // forward: walk out past the camera, re-enter at the back
            if (u < 0.5) e = 2 * u * 1.4; else k = s.goal + 2 * (1 - u);
          } else { // backward: walk off into the distance, re-enter from the camera side
            if (u < 0.5) k = s.from + 2 * u; else e = 2 * (1 - u) * 1.4;
          }
        } else if (k < 0) {
          e = Math.min(-k, 1.4);
        }
        if (e >= 0) {
          this.put(s, W * (c.ax - c.ex * e), c.ay - 22 * e, 1 + 0.14 * e, Math.max(0, 1 - 1.05 * e), 4 * Math.min(e, 1), 1100);
          return;
        }
        let op = k <= c.d - 1 ? 1 - 0.13 * k : Math.max(0, 0.61 * (c.d - k));
        if (this.still && Math.abs(k) < 0.02) op = 0;
        this.put(s, W * (c.ax + c.sx * k), c.ay + c.sy * k, Math.pow(c.sr, k), clamp(op, 0, 1), Math.min(0.9 * k, 3.2), 1000 - Math.round(10 * k));
      });
    }

    /* ---------- loop ---------- */
    kick() {
      if (this.raf || !this.visible || document.hidden) return;
      this.last = 0;
      this.raf = requestAnimationFrame((t) => this.tick(t));
    }

    tick(now) {
      this.raf = 0;
      const dt = this.last ? Math.min(0.034, (now - this.last) / 1000) : 1 / 60;
      this.last = now;
      let settled;
      if (this.mode === 'ring') settled = this.stepRing(dt);
      else settled = this.stepClassic(dt);
      const still = settled && !this.dragging;
      this.setStill(still);
      this.renderAll();
      if (!still && this.visible && !document.hidden) this.raf = requestAnimationFrame((t) => this.tick(t));
    }

    stepRing(dt) {
      if (reduced() && !this.dragging) { this.cur = this.target; this.vel = 0; return true; }
      const h = dt / 3;
      for (let i = 0; i < 3; i++) {
        const acc = -this.K * (this.cur - this.target) - this.C * this.vel;
        this.vel += acc * h;
        this.cur += this.vel * h;
      }
      if (Math.abs(this.cur - this.target) <= 0.0005 && Math.abs(this.vel) <= 0.0005) {
        this.cur = this.target; this.vel = 0;
        return true;
      }
      return false;
    }

    stepClassic(dt) {
      let all = true;
      const N = this.N;
      this.bodies.forEach((s) => {
        const goal = this.wrapN(s.a - this.target);
        if (Math.abs(goal - s.goal) > N / 2) {
          s.from = s.x;
          s.trip = goal > s.from ? 1 : -1;
          s.g = s.x;
        }
        s.goal = goal;
        if (reduced() && !this.dragging) {
          s.x = s.g = goal; s.v = 0; s.trip = 0; s.settled = true;
          return;
        }
        const tau = this.dragging ? 0.016 : s.trip ? 0.1 : 0.03 + this.lag * Math.min(goal, 4);
        s.g += (goal - s.g) * (1 - Math.exp(-dt / tau));
        const h = dt / 3;
        for (let i = 0; i < 3; i++) {
          const acc = -this.K * (s.x - s.g) - this.C * s.v;
          s.v += acc * h;
          s.x += s.v * h;
        }
        if (s.trip && Math.abs(s.x - goal) < 0.02) s.trip = 0;
        if (!s.trip && Math.abs(s.x - goal) <= 0.0006 && Math.abs(s.v) <= 0.0006) {
          s.x = s.g = goal; s.v = 0; s.settled = true;
        } else {
          s.settled = false; all = false;
        }
      });
      return all;
    }

    setStill(v) {
      if (this.still === v) return;
      this.still = v;
      this.classList.toggle('rw--still', v);
    }

    /* ---------- index ---------- */
    rank(s) {
      const t = Math.round(this.target);
      if (this.mode === 'ring') {
        let k = this.wrapN(s.a - t);
        if (k >= this.N / 2) k -= this.N;
        return k;
      }
      return this.wrapN(s.a - t);
    }

    setIndex(i, silent) {
      const prev = this.index;
      const changed = i !== prev;
      this.index = i;
      this.kick();

      const lim = this.mode === 'ring' ? 2 : 3;
      this.bodies.forEach((s) => {
        const k = this.rank(s);
        const on = k !== 0 && Math.abs(k) <= lim;
        s.hit.tabIndex = on ? 0 : -1;
        if (on) s.el.removeAttribute('aria-hidden'); else s.el.setAttribute('aria-hidden', 'true');
      });

      if (changed || silent) {
        if (changed) {
          this.closeZoom();
          if (this.phone) this.dockSheet();
        }
        this.style.setProperty('--rw-progress', ((i + 1) / this.n).toFixed(3));
        this.heroes.forEach((h, j) => {
          h.classList.toggle('is-on', j === i);
          h.classList.toggle('was', changed && j === prev);
          if (j === i) h.removeAttribute('aria-hidden'); else h.setAttribute('aria-hidden', 'true');
          const z = h.querySelector('[data-rw-zoom]');
          if (z) z.tabIndex = j === i ? 0 : -1;
        });
        if (!silent && !reduced()) {
          this.stage.classList.remove('is-sweep');
          reflow(this.stage);
          this.stage.classList.add('is-sweep');
        }
        if (!silent && this.live) this.live.textContent = this.heroes[i].dataset.label;
        this.ticks.forEach((t, j) => {
          t.setAttribute('aria-current', String(j === i));
          t.classList.toggle('is-past', j < i);
        });
        this.panels.forEach((p, j) => { p.hidden = j !== i; });
        if (!silent) {
          this.panels.forEach((p) => p.classList.remove('is-in'));
          reflow(this.panels[i]);
          this.panels[i].classList.add('is-in');
        }
        const tpl = this.panels[i].querySelector('template[data-rw-pieces-text]');
        if (this.pieces && tpl) {
          this.pieces.textContent = tpl.content.textContent.trim();
          if (!silent) {
            this.pieces.classList.remove('is-swap');
            reflow(this.pieces);
            this.pieces.classList.add('is-swap');
          }
        }
        this.clearHot();
      }
      this.restartBar();
    }

    moveTo(T) {
      this.target = T;
      this.setStill(false);
      this.setIndex(((T % this.n) + this.n) % this.n);
    }
    next() { this.moveTo(Math.round(this.target) + 1); }
    prev() { this.moveTo(Math.round(this.target) - 1); }
    go(i) {
      let d = ((i - this.index) % this.n + this.n) % this.n;
      if (d > this.n / 2) d -= this.n;
      this.moveTo(Math.round(this.target) + d);
    }

    /* ---------- autoplay ---------- */
    play(on) {
      this.playing = on;
      this.classList.toggle('is-playing', on);
      const b = this.querySelector('[data-rw-auto]');
      if (b) b.setAttribute('aria-pressed', String(on));
      this.restartBar();
    }

    restartBar() {
      clearTimeout(this.timer);
      this.ticks.forEach((t) => t.classList.remove('is-run'));
      if (!this.playing) return;
      const t = this.ticks[this.index];
      if (t) { reflow(t); t.classList.add('is-run'); }
      this.timer = setTimeout(() => {
        if (this.playing && this.visible && !this.dragging && !document.hidden && !this.panelHover && !this.zoomed && !this.engaged) this.next();
        else this.restartBar();
      }, this.speed);
    }

    engage() {
      this.engaged = true;
      if (this.playing) this.play(false);
    }

    /* ---------- events ---------- */
    bindEvents() {
      this.onResize = () => {
        clearTimeout(this.resizeT);
        this.resizeT = setTimeout(() => { this.measure(); this.kick(); }, 120);
      };
      window.addEventListener('resize', this.onResize);
      this.onVis = () => { if (!document.hidden) { this.kick(); this.restartBar(); } };
      document.addEventListener('visibilitychange', this.onVis);
      if ('ResizeObserver' in window) {
        this.ro = new ResizeObserver(() => { this.measure(); this.kick(); });
        this.ro.observe(this.stage);
      }

      // Click suppression after a drag
      this.addEventListener('click', (e) => {
        if (performance.now() < this.suppressUntil) { e.stopPropagation(); e.preventDefault(); }
      }, true);
      this.addEventListener('click', (e) => this.onClick(e));
      this.addEventListener('change', (e) => this.onChange(e));
      this.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.onEscape(e);
      });
      this.stage.addEventListener('keydown', (e) => {
        if (e.target !== this.stage) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); this.next(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); this.prev(); }
      });

      // Drag / swipe
      this.stage.addEventListener('pointerdown', (e) => this.onDown(e));
      this.stage.addEventListener('pointermove', (e) => this.onMove(e));
      this.stage.addEventListener('pointerup', (e) => this.onUp(e));
      this.stage.addEventListener('pointercancel', (e) => this.onUp(e));
      this.stage.addEventListener('lostpointercapture', (e) => { if (this.drag && this.drag.active) this.onUp(e); });

      // Trackpad horizontal swipe
      this.stage.addEventListener('wheel', (e) => {
        if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
        e.preventDefault();
        const now = performance.now();
        if (now < this.wheelLock) return;
        this.wheelAcc += e.deltaX;
        if (Math.abs(this.wheelAcc) > 45) {
          if (this.wheelAcc > 0) this.next(); else this.prev();
          this.wheelAcc = 0;
          this.wheelLock = now + 520;
        }
      }, { passive: false });

      // Panel hover holds the look; rows light up their pin
      if (this.panel) {
        this.panel.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') this.panelHover = true; });
        this.panel.addEventListener('pointerleave', (e) => {
          if (e.pointerType !== 'mouse') return;
          this.panelHover = false;
          this.restartBar();
        });
        this.panel.addEventListener('pointerover', (e) => {
          if (e.pointerType !== 'mouse') return;
          const card = e.target.closest('[data-rw-card]');
          if (card && !card.classList.contains('is-hot')) this.hot(+card.dataset.rwCard, false);
        });
        this.panel.addEventListener('pointerout', (e) => {
          if (e.pointerType !== 'mouse') return;
          const card = e.target.closest('[data-rw-card]');
          if (card && !card.contains(e.relatedTarget)) this.clearHot();
        });
      }
    }

    onDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (this.zoomed) return;
      this.drag = { x0: e.clientX, y0: e.clientY, t: this.target, id: e.pointerId, samples: [{ x: e.clientX, time: performance.now() }], active: false, dx: 0 };
    }

    onMove(e) {
      const d = this.drag;
      if (!d || e.pointerId !== d.id) return;
      if (e.pointerType === 'mouse' && e.buttons === 0) { this.onUp(e); return; }
      const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
      if (!d.active) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > 1.2 * Math.abs(dy)) {
          d.active = true;
          this.dragging = true;
          this.classList.add('is-dragging');
          try { this.stage.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        } else if (Math.abs(dy) > 10) {
          this.drag = null;
          return;
        } else return;
      }
      d.dx = dx;
      d.samples.push({ x: e.clientX, time: performance.now() });
      if (d.samples.length > 6) d.samples.shift();
      this.target = d.t - dx / this.unit;
      this.setStill(false);
      this.kick();
    }

    onUp(e) {
      const d = this.drag;
      if (!d || (e.pointerId !== undefined && e.pointerId !== d.id)) return;
      this.drag = null;
      if (!d.active) return;
      this.dragging = false;
      this.classList.remove('is-dragging');
      try { this.stage.releasePointerCapture(d.id); } catch (_) { /* ignore */ }
      const first = d.samples[0], last = d.samples[d.samples.length - 1];
      const vx = last.time > first.time ? (last.x - first.x) / (last.time - first.time) : 0;
      const sign = -1;
      const from = Math.round(d.t);
      const dx = d.dx;
      if (this.phone) {
        if (Math.abs(dx) > 30 || Math.abs(vx) > 0.3) this.moveTo(from + sign * (dx > 0 ? 1 : -1));
        else this.moveTo(from);
      } else {
        let i = Math.round(this.target + sign * vx * 160 / this.unit);
        if (i === from && Math.abs(vx) > 0.3) i = from + sign * (vx > 0 ? 1 : -1);
        i = clamp(i, from - 2, from + 2);
        this.moveTo(i);
      }
      this.suppressUntil = performance.now() + 60;
    }

    onEscape(e) {
      if (this.sheetCard) {
        const btn = this.sheetCard.querySelector('[data-rw-add]');
        this.dockSheet();
        if (btn) btn.focus({ preventScroll: true });
        e.preventDefault();
        return;
      }
      if (this.zoomed) { this.closeZoom(); e.preventDefault(); }
    }

    onClick(e) {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const inPanel = t.closest('.rw__panel') || (this.host && this.host.contains(t));
      if (inPanel && t.closest('button, a, input, select, label')) this.engage();

      let el;
      if (t.closest('[data-rw-pick-close]')) {
        const card = this.cardOf(t);
        if (card) this.closePicker(card, true);
        return;
      }
      if (t.closest('[data-rw-zoom-close]')) { this.closeZoom(); return; }
      if (this.zoomed && t.closest('[data-rw-lb]') && !t.closest('.rw__lb-model') && !t.closest('.rw__lb-top')) { this.closeZoom(); return; }
      if (t.closest('[data-rw-zoom]')) { this.openZoom(); return; }
      if (t.closest('[data-rw-next]')) { this.next(); return; }
      if (t.closest('[data-rw-prev]')) { this.prev(); return; }
      if ((el = t.closest('[data-rw-tick]'))) { this.go(+el.dataset.rwTick); return; }
      if (t.closest('[data-rw-auto]')) {
        if (!this.playing) this.engaged = false;
        this.play(!this.playing);
        return;
      }
      if ((el = t.closest('[data-rw-pin]'))) { this.engage(); this.hot(+el.dataset.rwPin, true); return; }
      if ((el = t.closest('[data-rw-go]'))) {
        const body = el.closest('[data-rw-model]');
        const s = this.bodies[+body.dataset.body];
        const k = this.rank(s);
        if (k !== 0 && Math.abs(k) < 6) this.moveTo(Math.round(this.target) + k);
        else if (k === 0) this.openZoom();
        return;
      }
      if (t.closest('[data-rw-confirm]')) { const c = this.cardOf(t); if (c) this.confirm(c); return; }
      if (t.closest('[data-rw-add]')) { const c = this.cardOf(t); if (c) this.togglePicker(c); return; }
      if ((el = t.closest('[data-rw-all]'))) { this.addAll(el.closest('[data-rw-panel]')); }
    }

    onChange(e) {
      const t = e.target;
      if (!(t instanceof Element) || !t.matches('[data-rw-option]')) return;
      this.engage();
      const card = this.cardOf(t);
      if (card) this.updateCard(card, false);
    }

    /* ---------- cursor ---------- */
    initCursor() {
      const c = this.cursor;
      if (!c) return;
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) { c.remove(); this.cursor = null; return; }
      this.classList.add('rw--cursor');
      const pos = { x: 0, y: 0, tx: 0, ty: 0, on: false };
      const loop = () => {
        this.cursorRaf = 0;
        const f = reduced() ? 1 : 0.18;
        pos.x += (pos.tx - pos.x) * f;
        pos.y += (pos.ty - pos.y) * f;
        if (Math.hypot(pos.tx - pos.x, pos.ty - pos.y) < 0.2) { pos.x = pos.tx; pos.y = pos.ty; }
        else this.cursorRaf = requestAnimationFrame(loop);
        c.style.transform = `translate3d(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px, 0)`;
      };
      this.stage.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const r = this.stage.getBoundingClientRect();
        pos.tx = e.clientX - r.left; pos.ty = e.clientY - r.top;
        if (!pos.on) { pos.on = true; pos.x = pos.tx; pos.y = pos.ty; c.classList.add('is-on'); }
        const t = e.target instanceof Element ? e.target : null;
        const drag = this.dragging;
        c.classList.toggle('is-view', !drag && !!(t && t.closest('.rw__zoom')));
        c.classList.toggle('is-link', !drag && !!(t && t.closest('.rw__pin, .rw__hit')));
        if (!this.cursorRaf) this.cursorRaf = requestAnimationFrame(loop);
      });
      this.stage.addEventListener('pointerleave', () => {
        pos.on = false;
        c.classList.remove('is-on', 'is-link', 'is-view');
      });
    }

    /* ---------- hot linking ---------- */
    clearHot() {
      this.querySelectorAll('.is-hot').forEach((el) => el.classList.remove('is-hot'));
    }

    hot(n, scroll) {
      this.clearHot();
      const root = this.zoomed ? this.lbStage : this.heroes[this.index];
      const pin = root && root.querySelector(`[data-rw-pin="${n}"]`);
      if (pin) pin.classList.add('is-hot');
      const card = this.panels[this.index].querySelector(`[data-rw-card="${n}"]`);
      if (!card) return;
      card.classList.add('is-hot');
      if (scroll) this.reveal(card);
    }

    reveal(card) {
      const list = card.closest('.rw__items');
      const behavior = reduced() ? 'auto' : 'smooth';
      if (!list) return;
      const cr = card.getBoundingClientRect(), lr = list.getBoundingClientRect();
      if (list.scrollWidth > list.clientWidth + 1) {
        list.scrollTo({ left: list.scrollLeft + cr.left - lr.left - 20, behavior });
      } else if (list.scrollHeight > list.clientHeight + 1) {
        list.scrollTo({ top: card.offsetTop - list.offsetTop - 12, behavior });
      } else if (cr.top < 0 || cr.bottom > window.innerHeight - 140) {
        window.scrollBy({ top: cr.top - 0.3 * window.innerHeight, behavior });
      }
    }

    /* ---------- popup ---------- */
    openZoom() {
      if (this.zoomed) return;
      this.engage();
      this.clearHot();
      const hero = this.heroes[this.index];
      const fig = hero.querySelector('.rw__figure');
      const a = fig.getBoundingClientRect();
      clearTimeout(this.zoomT);
      this.lbStage.textContent = '';

      const model = document.createElement('div');
      model.className = 'rw__lb-model';
      const shadow = hero.querySelector('.rw__shadow').cloneNode(true);
      const figure = fig.cloneNode(true);
      figure.querySelectorAll('.rw__zoom').forEach((z) => z.remove());
      figure.querySelectorAll('.rw__pin').forEach((p) => { p.tabIndex = 0; p.classList.remove('is-hot'); });
      const foot = hero.style.getPropertyValue('--rw-foot');
      if (foot) model.style.setProperty('--rw-foot', foot);
      model.append(shadow, figure);
      this.lbStage.append(model);

      const sr = this.lbStage.getBoundingClientRect();
      const h = Math.max(160, Math.min(sr.height, sr.width / 0.5625));
      model.style.setProperty('--rw-model-h', h + 'px');
      figure.querySelectorAll('img').forEach((img) => {
        img.loading = 'eager';
        img.sizes = Math.round(h * 0.5625) + 'px';
        img.classList.add('is-decoded');
      });

      const word = this.lb.dataset.word || 'Look';
      this.querySelector('[data-rw-lb-kicker]').textContent = `${word} ${String(this.index + 1).padStart(2, '0')}`;
      this.querySelector('[data-rw-lb-name]').textContent = hero.dataset.name || '';
      this.zoomed = true;
      this.classList.add('rw--zoom');
      this.lb.setAttribute('aria-hidden', 'false');

      if (!reduced() && a.height) {
        const b = figure.getBoundingClientRect();
        model.style.transition = 'none';
        model.style.transformOrigin = '0 100%';
        model.style.transform = `translate3d(${a.left - b.left}px, ${a.bottom - b.bottom}px, 0) scale(${a.height / b.height})`;
        reflow(model);
        model.style.transition = '';
        model.style.transform = '';
      }
      const close = this.querySelector('[data-rw-zoom-close]');
      if (close) close.focus({ preventScroll: true });
      this.restartBar();
    }

    closeZoom() {
      if (!this.zoomed) return;
      this.zoomed = false;
      const model = this.lbStage.querySelector('.rw__lb-model');
      if (model && !reduced()) {
        const heroFig = this.heroes[this.index].querySelector('.rw__figure');
        const fig = model.querySelector('.rw__figure');
        const a = heroFig.getBoundingClientRect();
        const b = fig.getBoundingClientRect();
        if (a.height && b.height) {
          model.style.transformOrigin = '0 100%';
          model.style.transform = `translate3d(${a.left - b.left}px, ${a.bottom - b.bottom}px, 0) scale(${a.height / b.height})`;
        }
      }
      this.classList.remove('rw--zoom');
      this.lb.setAttribute('aria-hidden', 'true');
      if (this.lb.contains(document.activeElement)) this.stage.focus({ preventScroll: true });
      clearTimeout(this.zoomT);
      this.zoomT = setTimeout(() => { if (!this.zoomed) this.lbStage.textContent = ''; }, 950);
      this.restartBar();
    }

    /* ---------- cards / pickers ---------- */
    cardOf(el) {
      const card = el.closest('[data-rw-card]');
      if (card) return card;
      const picker = el.closest('[data-rw-picker]');
      return picker ? picker._card : null;
    }

    initCard(card) {
      const picker = card.querySelector('[data-rw-picker]');
      card._picker = picker;
      card._add = card.querySelector('[data-rw-add]');
      if (!picker) return;
      picker._card = card;
      try { card._variants = JSON.parse(picker.querySelector('[data-rw-variants]').textContent); } catch (_) { card._variants = []; }
      this.updateCard(card, true);
    }

    updateCard(card, initial) {
      const picker = card._picker;
      const groups = {};
      picker.querySelectorAll('[data-rw-option]').forEach((r) => {
        const k = r.dataset.rwOption;
        (groups[k] = groups[k] || []).push(r);
      });
      const keys = Object.keys(groups).sort();
      const sel = keys.map((k) => { const c = groups[k].find((r) => r.checked); return c ? c.value : null; });
      const variants = card._variants || [];
      keys.forEach((k, gi) => {
        groups[k].forEach((r) => {
          const ok = variants.some((v) => v.a && v.o[gi] === r.value && sel.every((s, si) => si === gi || s === null || v.o[si] === s));
          r.closest('.rw__pill').classList.toggle('is-unavailable', !ok);
        });
      });
      const match = variants.find((v) => v.o.every((o, oi) => o === sel[oi]));
      const btn = picker.querySelector('[data-rw-confirm]');
      const label = picker.querySelector('[data-rw-confirm-label]');
      const available = !!(match && match.a);
      btn.disabled = !available;
      label.textContent = available ? label.dataset.add : (this.dataset.msgSoldout || 'Sold out');
      if (available) card.dataset.selected = String(match.id); else delete card.dataset.selected;
      if (!initial) card.dataset.touched = '1';
    }

    togglePicker(card) {
      if (card.classList.contains('is-added') || card.classList.contains('is-loading')) return;
      if (card.classList.contains('is-picking')) this.closePicker(card, false);
      else this.openPicker(card);
    }

    openPicker(card, focus = true) {
      const picker = card._picker;
      if (!picker || card.classList.contains('is-added')) return;
      if (this.phone) {
        if (this.sheetCard && this.sheetCard !== card) this.dockSheet();
        this.openSheet(card);
      } else {
        picker.hidden = false;
      }
      card.classList.add('is-picking');
      card._add.setAttribute('aria-expanded', 'true');
      if (focus) {
        const checked = picker.querySelector('[data-rw-option]:checked') || picker.querySelector('[data-rw-option]');
        if (checked) checked.focus({ preventScroll: true });
      }
      if (!this.phone) this.reveal(card);
    }

    closePicker(card, refocus) {
      if (this.sheetCard === card) this.dockSheet();
      if (card._picker) card._picker.hidden = true;
      card.classList.remove('is-picking');
      if (card.classList.contains('is-added')) card._add.removeAttribute('aria-expanded');
      else card._add.setAttribute('aria-expanded', 'false');
      if (refocus && card._add) card._add.focus({ preventScroll: true });
    }

    ensureHost() {
      if (this.host) return this.host;
      const host = document.createElement('div');
      host.className = 'rw-sheet-host';
      const scrim = document.createElement('button');
      scrim.type = 'button';
      scrim.className = 'rw__pick-scrim';
      scrim.setAttribute('data-rw-pick-close', '');
      scrim.tabIndex = -1;
      scrim.setAttribute('aria-hidden', 'true');
      host.append(scrim);
      host.addEventListener('click', (e) => {
        if (e.target === scrim) { this.dockSheet(); return; }
        this.onClick(e);
      });
      host.addEventListener('change', (e) => this.onChange(e));
      host.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.onEscape(e); });
      document.body.append(host);
      this.host = host;
      return host;
    }

    openSheet(card) {
      const host = this.ensureHost();
      const cs = getComputedStyle(this);
      ['--rw-panel', '--rw-text', '--rw-muted', '--rw-line', '--rw-accent', '--rw-on-accent', '--rw-btn-bg', '--rw-btn-fg', '--rw-btn-radius',
        '--rw-pill-radius', '--rw-bar-r', '--rw-thumb-radius', '--rw-pt-size', '--rw-price', '--rw-opt', '--rw-ease', '--rw-ease-sheet', '--rw-ease-spring']
        .forEach((v) => host.style.setProperty(v, cs.getPropertyValue(v)));
      host.style.fontFamily = cs.fontFamily;
      host.style.color = cs.color;
      const picker = card._picker;
      host.append(picker);
      picker.hidden = false;
      host.classList.add('is-open');
      this.classList.add('rw--picking');
      this.sheetCard = card;
    }

    dockSheet() {
      const card = this.sheetCard;
      if (!card) return;
      this.sheetCard = null;
      const picker = card._picker;
      picker.hidden = true;
      card.append(picker);
      if (this.host) this.host.classList.remove('is-open');
      this.classList.remove('rw--picking');
      card.classList.remove('is-picking');
      if (card.classList.contains('is-added')) card._add.removeAttribute('aria-expanded');
      else card._add.setAttribute('aria-expanded', 'false');
    }

    msg(panel, text) {
      const m = panel && panel.querySelector('[data-rw-msg]');
      if (m) m.textContent = text || '';
    }

    async confirm(card) {
      card.dataset.touched = '1';
      const id = Number(card.dataset.selected);
      if (!id || card.classList.contains('is-added') || card.classList.contains('is-loading')) return;
      const panel = card.closest('[data-rw-panel]');
      this.msg(panel, '');
      card.classList.add('is-loading');
      try {
        await Promise.all([Bag.add([{ id, quantity: 1 }]), this.wait(320)]);
        this.markAdded(card);
      } catch (err) {
        card.classList.remove('is-loading');
        this.msg(panel, this.dataset.msgError || (err && err.message));
      }
    }

    wait(ms) { return new Promise((r) => setTimeout(r, reduced() ? 0 : ms)); }

    markAdded(card) {
      card.classList.remove('is-loading');
      card.classList.add('is-added');
      this.closePicker(card, false);
      card._add.setAttribute('aria-label', card._add.dataset.addedLabel);
      card._add.removeAttribute('aria-expanded');
      if (this.phone && !reduced() && navigator.vibrate) { try { navigator.vibrate(12); } catch (_) { /* ignore */ } }
      this.checkComplete(card.closest('[data-rw-panel]'));
    }

    checkComplete(panel) {
      if (!panel) return;
      const cards = [...panel.querySelectorAll('[data-rw-card]')];
      if (cards.length >= 2 && cards.every((c) => c.classList.contains('is-added'))) {
        panel.classList.add('is-complete');
        this.msg(panel, '');
      }
    }

    async addAll(panel) {
      if (!panel) return;
      const cta = panel.querySelector('[data-rw-all]');
      if (panel.classList.contains('is-complete') || cta.classList.contains('is-loading')) return;
      this.msg(panel, '');
      const cards = [...panel.querySelectorAll('[data-rw-card]')].filter((c) => !c.classList.contains('is-added') && !c.classList.contains('is-soldout'));
      const ready = cards.filter((c) => c.dataset.variantId || (c.dataset.touched && c.dataset.selected));
      const pending = cards.filter((c) => !ready.includes(c));
      if (ready.length) {
        cta.classList.add('is-loading');
        ready.forEach((c) => c.classList.add('is-loading'));
        try {
          await Promise.all([Bag.add(ready.map((c) => ({ id: Number(c.dataset.variantId || c.dataset.selected), quantity: 1 }))), this.wait(420)]);
          ready.forEach((c) => this.markAdded(c));
        } catch (err) {
          ready.forEach((c) => c.classList.remove('is-loading'));
          this.msg(panel, this.dataset.msgError || (err && err.message));
        } finally {
          cta.classList.remove('is-loading');
        }
      }
      if (pending.length) {
        const open = this.phone ? pending.slice(0, 1) : pending;
        open.forEach((c, i) => { if (!c.classList.contains('is-picking')) this.openPicker(c, i === 0); });
        if (!this.phone) this.reveal(pending[0]);
        const tpl = this.dataset.msgChoose || 'Pick a size for: [items]';
        this.msg(panel, tpl.replace('[items]', pending.map((c) => c.dataset.title).join(', ')));
      }
    }
  }

  if (!customElements.get('runway-section')) customElements.define('runway-section', RunwaySection);
  Bag.initDialog();
})();
