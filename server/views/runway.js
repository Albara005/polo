'use strict';
const { T, CATEGORIES, money, pick } = require('../i18n');
const { bundlePrice } = require('../pricing');
const { esc, json } = require('./layout');

const pad = (n) => String(n).padStart(2, '0');

const ICON = {
  plus: '<svg class="rw__add-plus" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M12 4v16M4 12h16"/></svg>',
  check: '<svg class="rw__add-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.5l5 5L19.5 7"/></svg>',
  spin: (cls, s, w) => `<svg class="${cls}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" aria-hidden="true"><path d="M12 3a9 9 0 1 1-9 9"/></svg>`,
  close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>',
  arrow: '<svg class="rw__cta-arrow" width="22" height="12" viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 7h24M19 1l6 6-6 6"/></svg>'
};

function modelImg(look, name) {
  const img = look.image || {};
  const src = img.small || img.src;
  const srcset = img.small && img.src && img.small !== img.src ? ` srcset="${esc(img.small)} 640w, ${esc(img.src)} 1080w" sizes="(min-width: 1800px) 540px, (min-width: 750px) 420px, 320px"` : '';
  return `<img src="${esc(src)}"${srcset} loading="eager" decoding="async" width="1100" height="1956" draggable="false" data-model-image alt="${esc(name)}">`;
}

function renderRunway(req, { looks, products, startId }) {
  const lang = req.lang;
  const t = T[lang];
  const byId = new Map(products.map((p) => [p.id, p]));
  const L = looks
    .map((l) => ({ ...l, name: pick(l, 'name', lang), items: l.items.filter((it) => byId.has(it.product_id)) }))
    .filter((l) => l.items.length && l.image && l.image.src);

  if (!L.length) {
    return `<section class="page page--narrow empty-state"><h1 class="page-title">${esc(t.runwayTitle)}</h1><p>${esc(t.noLooks)}</p><p><a class="btn" href="/shop">${esc(t.navShop)}</a></p></section>`;
  }
  const start = Math.max(0, L.findIndex((l) => l.id === startId));

  const bodies = L.map((look, i) => `<div class="rw__model" data-rw-model data-index="${i}" aria-hidden="true"><span class="rw__shadow"></span><div class="rw__figure" style="--rw-ar: 0.5625"><div class="rw__art">${modelImg(look, look.name)}<button class="rw__hit" type="button" data-rw-go="${i}" aria-label="${esc(`${t.look} ${i + 1}: ${look.name}`)}" tabindex="-1"></button></div></div></div>`).join('');

  const heroes = L.map((look, i) => {
    const pins = look.items.map((it, k) => {
      const name = pick(byId.get(it.product_id), 'name', lang);
      return `<button class="rw__pin" type="button" data-rw-pin="${k + 1}" data-tip="${esc(name)}" style="left:${Number(it.x)}%; top:${Number(it.y)}%; --pi:${k + 1}" aria-label="${k + 1}: ${esc(name)}" tabindex="-1"><span class="rw__pin-dot">${k + 1}</span></button>`;
    }).join('');
    const on = i === start;
    return `<div class="rw__hero${on ? ' is-on' : ''}" data-rw-hero data-index="${i}" data-name="${esc(look.name)}" data-label="${esc(`${t.look} ${i + 1}: ${look.name}`)}" data-probe="${esc(look.image.small || look.image.src)}"${on ? '' : ' aria-hidden="true"'}><div class="rw__morph"><span class="rw__shadow"></span><div class="rw__figure" style="--rw-ar: 0.5625"><div class="rw__art">${modelImg(look, look.name)}<button class="rw__zoom" type="button" data-rw-zoom aria-label="${esc(`${t.viewLook}: ${look.name}`)}" tabindex="-1"></button><div class="rw__pins">${pins}</div></div></div></div></div>`;
  }).join('');

  const ticks = L.map((look, i) => `<button class="rw__tick" type="button" data-rw-tick="${i}" aria-current="${i === start}" aria-label="${esc(`${t.look} ${i + 1}: ${look.name}`)}"><span class="rw__tick-bar"></span><span class="rw__tick-label">${pad(i + 1)}<span class="rw__tick-name">&nbsp;&nbsp;${esc(look.name)}</span></span></button>`).join('');

  const panels = L.map((look, i) => {
    const pieces = t.pieces(look.items.length);
    const b = bundlePrice(look, byId);
    const items = look.items.map((it, k) => {
      const n = k + 1;
      const p = byId.get(it.product_id);
      const name = pick(p, 'name', lang);
      const url = `/product/${encodeURIComponent(p.slug)}`;
      const image = p.images[0] || {};
      const thumb = image.thumb || image.src || '';
      const pickerId = `Picker-look_${look.id}-${n}`;
      const optName = `Opt-look_${look.id}-${n}-1`;
      const firstOk = Math.max(0, p.variants.findIndex((v) => v.stock !== 0));
      const soldOut = !p.variants.some((v) => v.stock !== 0);
      const pills = p.variants.map((v, j) => `<label class="rw__pill"><input type="radio" name="${optName}" value="${esc(v.size)}" data-rw-option="0"${j === firstOk ? ' checked' : ''}><span class="rw__pill-label">${esc(v.size)}</span></label>`).join('');
      const variants = json(p.variants.map((v) => ({ id: v.id, a: v.stock !== 0, o: [v.size] })));
      const cat = CATEGORIES[p.category] ? CATEGORIES[p.category][lang] : '';
      return `<li class="rw__item${soldOut ? ' is-soldout' : ''}" data-rw-card="${n}" style="--i:${n}" data-title="${esc(name)}">`
        + (p.is_new ? `<span class="rw__tag"><span class="rw__tag-text">${esc(t.isNew)}</span></span>` : '')
        + `<a class="rw__media" href="${url}" tabindex="-1" aria-hidden="true"><img src="${esc(thumb)}" loading="lazy" decoding="async" alt="" width="${image.w || 400}" height="${image.h || 500}"><span class="rw__num">${n}</span></a>`
        + `<div class="rw__info"><span class="rw__type">${esc(cat)}</span><a class="rw__name" href="${url}">${esc(name)}</a><span class="rw__price">${p.compare_price > p.price ? `<s>${esc(money(p.compare_price, lang))}</s>` : ''}<span>${esc(money(p.price, lang))}</span></span></div>`
        + `<button class="rw__add" type="button" data-rw-add aria-expanded="false" aria-controls="${pickerId}" aria-label="${esc(t.addToBagFor(name))}" data-added-label="${esc(t.addedToBagFor(name))}">${ICON.plus}${ICON.check}${ICON.spin('rw__add-spin', 18, 1.5)}</button>`
        + `<div class="rw__picker" data-rw-picker id="${pickerId}" hidden>`
        + `<div class="rw__picker-head"><img src="${esc(thumb)}" loading="lazy" decoding="async" alt="" width="160" height="200"><div class="rw__picker-copy"><span class="rw__picker-title">${esc(name)}</span><span class="rw__picker-price">${esc(money(p.price, lang))}</span></div><button class="rw__pick-close" type="button" data-rw-pick-close aria-label="${esc(t.close)}">${ICON.close}</button></div>`
        + `<fieldset class="rw__opt"><legend class="rw__opt-name">${esc(p.size_label === 'shoe' ? t.shoeSize : t.size)}</legend><div class="rw__values">${pills}</div></fieldset>`
        + `<button class="rw__confirm" type="button" data-rw-confirm><span data-rw-confirm-label data-add="${esc(t.addToBag)}">${esc(t.addToBag)}</span><span class="rw__sr"> — ${esc(name)}</span></button>`
        + `<script type="application/json" data-rw-variants>${variants}</script>`
        + `</div></li>`;
    }).join('');
    const now = money(b.now, lang);
    return `<div class="rw__look-panel${i === start ? ' is-in' : ''}" data-rw-panel="${i}"${i === start ? '' : ' hidden'}>`
      + `<div class="rw__mhead"><span class="rw__mhead-title">${esc(look.name)}</span><span class="rw__label">${esc(pieces)}</span></div>`
      + `<ul class="rw__items" role="list">${items}</ul>`
      + `<div class="rw__bundle has-rule"><p class="rw__msg" data-rw-msg role="status" aria-live="polite"></p>`
      + `<div class="rw__bundle-row"><div class="rw__bundle-copy"><span class="rw__bundle-title">${esc(t.completeLook)}</span><span class="rw__bundle-note">${esc(b.off ? t.bundleSave(b.count, look.discount) : t.bundleAll(b.count))}</span></div><div class="rw__bundle-price">${b.off ? `<s>${esc(money(b.was, lang))}</s>` : ''}<strong>${esc(now)}</strong></div></div>`
      + `<button class="rw__cta" type="button" data-rw-all><span class="rw__cta-add">${esc(t.addFullLook)}</span><span class="rw__cta-m">${esc(t.addFullLookShort(now))}</span><span class="rw__cta-done">${esc(t.fullLookIn)}</span>${ICON.arrow}${ICON.spin('rw__cta-spin', 16, 1.8)}</button>`
      + `</div><template data-rw-pieces-text>${esc(pieces)}</template></div>`;
  }).join('\n');

  const tokens = {
    '--rw-c-stage': '#ffffff', '--rw-c-panel': '#ffffff', '--rw-c-text': '#151413', '--rw-c-muted': '#66625c',
    '--rw-c-accent': '#0e0e0e', '--rw-c-on-accent': '#ffffff', '--rw-c-line': '#c8c8c8', '--rw-card': '#DFDFDF',
    '--rw-hf': 'var(--font-heading--family, inherit)', '--rw-hw': '400',
    '--rw-h-d': '46px', '--rw-h-m': '24px', '--rw-sub-d': '12px', '--rw-sub-m': '12px',
    '--rw-label-d': '10px', '--rw-label-m': '9px', '--rw-chip-d': '17px', '--rw-chip-m': '18px',
    '--rw-ph-d': '18px', '--rw-ph-m': '16px', '--rw-pt-size-d': '13px', '--rw-pt-size-m': '12px',
    '--rw-price-d': '12px', '--rw-price-m': '12px', '--rw-opt-d': '11px', '--rw-opt-m': '11px',
    '--rw-total-d': '16px', '--rw-total-m': '16px', '--rw-thumb-d': '92px', '--rw-thumb-m': '62px',
    '--rw-tag-top': '18px', '--rw-tag-left': '0px', '--rw-thumb-radius': '0px', '--rw-morph': '900ms',
    '--rw-bar-r': '20px', '--rw-panel-w': '380px', '--rw-panel-pad-d': '32px', '--rw-radius': '0px',
    '--rw-max': 'none', '--rw-speed': '5s', '--rw-ax': '40%', '--rw-btn-radius': '0px',
    '--rw-pill-radius': '30px', '--rw-add-radius': '20px'
  };
  const style = Object.entries(tokens).map(([k, v]) => `${k}: ${v}`).join('; ');

  return `<runway-section id="Runway" class="rw rw--add-icon rw--popup rw--list has-dividers has-border" data-start="${start}" data-feel="balanced" data-blur="true" data-mblur="true" data-style="ring" data-mstyle="classic" data-fit="true" data-height-mode="original" data-height-vh="100" data-mheight-mode="custom" data-mheight-vh="109" data-reflect="false" data-autoplay="true" data-speed="5000" data-msg-choose="${esc(t.pickSizeFor)}" data-msg-error="${esc(t.addError)}" data-msg-soldout="${esc(t.soldOut)}" style="${style}">
<div class="rw__sticky"><div class="rw__grid">
<div class="rw__left">
<div class="rw__head"><div class="rw__intro"><h1 class="rw__title">${esc(t.runwayTitle)}</h1><p class="rw__sub">${esc(t.runwaySub)}</p></div><span class="rw__sr" aria-live="polite" aria-atomic="true" data-rw-live></span></div>
<div class="rw__stage" data-rw-stage tabindex="0" role="region" aria-roledescription="carousel" aria-label="${esc(t.runwayAria)}">
<div class="rw__actors" data-rw-actors>${bodies}</div>
<div class="rw__heroes" data-rw-heroes>${heroes}</div>
<span class="rw__sweep" aria-hidden="true"></span>
<span class="rw__cursor" data-rw-cursor aria-hidden="true"><span class="rw__cursor-in"><span class="rw__cursor-label rw__cursor-drag">${esc(t.drag)}</span><span class="rw__cursor-label rw__cursor-view">${esc(t.view)}</span></span></span>
<span class="rw__walk" aria-hidden="true"><span class="rw__walk-line"></span></span>
</div>
<div class="rw__controls">
<button class="rw__icon rw__prev" type="button" data-rw-prev aria-label="${esc(t.prevLook)}"><svg width="26" height="14" viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M25 7H1M7 1L1 7l6 6"/></svg></button>
<div class="rw__ticks">${ticks}</div>
<button class="rw__icon rw__auto" type="button" data-rw-auto aria-pressed="false" aria-label="${esc(t.autoplay)}"><svg class="rw__auto-play" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg><svg class="rw__auto-pause" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.5 4.5h3.5v15H6.5zM14 4.5h3.5v15H14z"/></svg></button>
<button class="rw__icon rw__next" type="button" data-rw-next aria-label="${esc(t.nextLook)}"><svg width="26" height="14" viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 7h24M19 1l6 6-6 6"/></svg></button>
</div>
<div class="rw__lb" data-rw-lb data-word="${esc(t.look)}" role="region" aria-label="${esc(t.viewLook)}" aria-hidden="true">
<div class="rw__lb-stage" data-rw-lb-stage></div>
<div class="rw__lb-top"><p class="rw__lb-cap"><span class="rw__lb-kicker" data-rw-lb-kicker></span><span class="rw__lb-name" data-rw-lb-name></span></p><button class="rw__lb-close" type="button" data-rw-zoom-close aria-label="${esc(t.close)}">${ICON.close}</button></div>
<p class="rw__lb-hint">${esc(t.tapDot)}</p>
</div>
</div>
<aside class="rw__panel has-rule" aria-label="${esc(t.inThisLook)}"><div class="rw__panel-inner">
<div class="rw__panel-head"><h2 class="rw__panel-title">${esc(t.inThisLook)}</h2><span class="rw__label" data-rw-pieces></span></div>
${panels}
</div></aside>
</div></div>
</runway-section>`;
}

module.exports = { renderRunway };
