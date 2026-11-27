// Builds the standalone index.html from src/ (data, CSS, JS, embedded font).
// Usage: node build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { ASSET, SHOP, BRAND, SECTION_ID, PRODUCTS, CATALOG_ORDER, LOOKS, BUNDLE } from './src/data.mjs';

const here = (p) => new URL(p, import.meta.url);
const css = readFileSync(here('./src/runway.css'), 'utf8');
const js = readFileSync(here('./src/runway.js'), 'utf8');
const font = readFileSync(here('./src/inter-600.woff2')).toString('base64');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = (n) => '$' + n.toFixed(2);
const pad = (n) => String(n).padStart(2, '0');
const productUrl = (id) => `${SHOP}/products/${id}`;
const m640 = (m) => `${ASSET}model-${m}-640.webp`;
const m1080 = (m) => `${ASSET}original-look-${m}.webp`;

const modelImg = (look) => `<img src="${m640(look.model)}" srcset="${m640(look.model)} 640w, ${m1080(look.model)} 1080w" sizes="(min-width: 1800px) 540px, (min-width: 750px) 420px, 320px" loading="eager" decoding="async" width="1100" height="1956" draggable="false" data-model-image alt="${esc(look.name)}">`;

const ICON = {
  plus: '<svg class="rw__add-plus" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M12 4v16M4 12h16"/></svg>',
  check: '<svg class="rw__add-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.5l5 5L19.5 7"/></svg>',
  spin: (cls, s, w) => `<svg class="${cls}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" aria-hidden="true"><path d="M12 3a9 9 0 1 1-9 9"/></svg>`,
  close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>',
  arrow: '<svg class="rw__cta-arrow" width="22" height="12" viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 7h24M19 1l6 6-6 6"/></svg>'
};

function bodyMarkup(look, i) {
  const label = `Look ${i + 1}: ${look.name}`;
  return `<div class="rw__model" data-rw-model data-index="${i}" aria-hidden="true"><span class="rw__shadow"></span><div class="rw__figure" style="--rw-ar: 0.5625"><div class="rw__art">${modelImg(look)}<button class="rw__hit" type="button" data-rw-go="${i}" aria-label="${esc(label)}" tabindex="-1"></button></div></div></div>`;
}

function heroMarkup(look, i) {
  const label = `Look ${i + 1}: ${look.name}`;
  const pins = look.items.map((it, k) => {
    const n = k + 1, name = PRODUCTS[it.id].name, [x, y] = look.pins[k];
    return `<button class="rw__pin" type="button" data-rw-pin="${n}" data-tip="${esc(name)}" style="left:${x}%; top:${y}%; --pi:${n}" aria-label="${n}: ${esc(name)}" tabindex="-1"><span class="rw__pin-dot">${n}</span></button>`;
  }).join('');
  return `<div class="rw__hero${i === 0 ? ' is-on' : ''}" data-rw-hero data-index="${i}" data-name="${esc(look.name)}" data-label="${esc(label)}" data-probe="${m640(look.model)}"${i === 0 ? '' : ' aria-hidden="true"'}><div class="rw__morph"><span class="rw__shadow"></span><div class="rw__figure" style="--rw-ar: 0.5625"><div class="rw__art">${modelImg(look)}<button class="rw__zoom" type="button" data-rw-zoom aria-label="View look: ${esc(look.name)}" tabindex="-1"></button><div class="rw__pins">${pins}</div></div></div></div></div>`;
}

function tickMarkup(look, i) {
  return `<button class="rw__tick" type="button" data-rw-tick="${i}" aria-current="${i === 0}" aria-label="Look ${i + 1}: ${esc(look.name)}"><span class="rw__tick-bar"></span><span class="rw__tick-label">${pad(i + 1)}<span class="rw__tick-name">&nbsp;&nbsp;${esc(look.name)}</span></span></button>`;
}

function itemMarkup(look, it, k) {
  const n = k + 1, p = PRODUCTS[it.id], url = productUrl(it.id);
  const pickerId = `Picker-template--28035983671601__the_runway_wdM8BG-look_${look.key}-${n}`;
  const optName = `Opt-template--28035983671601__the_runway_wdM8BG-look_${look.key}-${n}-1`;
  const pills = p.variants.map(([v], j) => `<label class="rw__pill"><input type="radio" name="${optName}" value="${esc(v)}" data-rw-option="0"${j === 0 ? ' checked' : ''}><span class="rw__pill-label">${esc(v)}</span></label>`).join('');
  const variants = JSON.stringify(p.variants.map(([v, id]) => ({ id, a: true, o: [v] })));
  return `<li class="rw__item" data-rw-card="${n}" style="--i:${n}" data-title="${esc(p.name)}">`
    + (it.tag ? `<span class="rw__tag"><span class="rw__tag-text">${esc(it.tag)}</span></span>` : '')
    + `<a class="rw__media" href="${url}" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true"><img src="${ASSET}${p.image}" loading="lazy" decoding="async" alt="" width="${p.w}" height="${p.h}"><span class="rw__num">${n}</span></a>`
    + `<div class="rw__info"><span class="rw__type">${esc(p.vendor)}</span><a class="rw__name" href="${url}" target="_blank" rel="noopener noreferrer">${esc(p.name)}</a><span class="rw__price"><span>${money(p.price)}</span></span></div>`
    + `<button class="rw__add" type="button" data-rw-add aria-expanded="false" aria-controls="${pickerId}" aria-label="Add to bag: ${esc(p.name)}" data-added-label="Added to bag: ${esc(p.name)}">${ICON.plus}${ICON.check}${ICON.spin('rw__add-spin', 18, 1.5)}</button>`
    + `<div class="rw__picker" data-rw-picker id="${pickerId}" hidden>`
    + `<div class="rw__picker-head"><img src="${ASSET}${p.image}" loading="lazy" decoding="async" alt="" width="${p.sw}" height="${p.sh}"><div class="rw__picker-copy"><span class="rw__picker-title">${esc(p.name)}</span><span class="rw__picker-price">${money(p.price)}</span></div><button class="rw__pick-close" type="button" data-rw-pick-close aria-label="Close">${ICON.close}</button></div>`
    + `<fieldset class="rw__opt"><legend class="rw__opt-name">${esc(p.legend)}</legend><div class="rw__values">${pills}</div></fieldset>`
    + `<button class="rw__confirm" type="button" data-rw-confirm><span data-rw-confirm-label data-add="Add to bag">Add to bag</span><span class="rw__sr"> — ${esc(p.name)}</span></button>`
    + `<script type="application/json" data-rw-variants>${variants}</script>`
    + `</div></li>`;
}

function panelMarkup(look, i) {
  const pieces = `${look.items.length} pieces`;
  return `<div class="rw__look-panel${i === 0 ? ' is-in' : ''}" data-rw-panel="${i}"${i === 0 ? '' : ' hidden'}>`
    + `<div class="rw__mhead"><span class="rw__mhead-title">${esc(look.name)}</span><span class="rw__label">${pieces}</span></div>`
    + `<ul class="rw__items" role="list">${look.items.map((it, k) => itemMarkup(look, it, k)).join('')}</ul>`
    + `<div class="rw__bundle has-rule"><p class="rw__msg" data-rw-msg role="status" aria-live="polite"></p>`
    + `<div class="rw__bundle-row"><div class="rw__bundle-copy"><span class="rw__bundle-title">Complete the look</span><span class="rw__bundle-note">${BUNDLE.note}</span></div><div class="rw__bundle-price"><s>${BUNDLE.was}</s><strong>${BUNDLE.now}</strong></div></div>`
    + `<button class="rw__cta" type="button" data-rw-all><span class="rw__cta-add">Add full look to bag</span><span class="rw__cta-m">Add full look — ${BUNDLE.now}</span><span class="rw__cta-done">Full look in your bag</span>${ICON.arrow}${ICON.spin('rw__cta-spin', 16, 1.8)}</button>`
    + `</div><template data-rw-pieces-text>${pieces}</template></div>`;
}

const tokens = {
  '--rw-c-stage': '#ffffff', '--rw-c-panel': '#ffffff', '--rw-c-text': '#151413', '--rw-c-muted': '#66625c',
  '--rw-c-accent': '#0e0e0e', '--rw-c-on-accent': '#ffffff', '--rw-c-line': '#c8c8c8', '--rw-card': '#DFDFDF',
  '--rw-hf': 'var(--font-heading--family, inherit)', '--rw-hw': '400',
  '--rw-h-d': '46px', '--rw-h-m': '24px', '--rw-sub-d': '12px', '--rw-sub-m': '12px',
  '--rw-eyebrow-d': '11px', '--rw-eyebrow-m': '10px', '--rw-label-d': '10px', '--rw-label-m': '9px',
  '--rw-chip-d': '17px', '--rw-chip-m': '18px', '--rw-ph-d': '18px', '--rw-ph-m': '16px',
  '--rw-pt-size-d': '13px', '--rw-pt-size-m': '12px', '--rw-price-d': '12px', '--rw-price-m': '12px',
  '--rw-opt-d': '11px', '--rw-opt-m': '11px', '--rw-total-d': '16px', '--rw-total-m': '16px',
  '--rw-thumb-d': '92px', '--rw-thumb-m': '62px', '--rw-tag-top': '18px', '--rw-tag-left': '0px',
  '--rw-thumb-radius': '0px', '--rw-morph': '900ms', '--rw-bar-r': '20px', '--rw-panel-w': '380px',
  '--rw-panel-pad-d': '32px', '--rw-radius': '0px', '--rw-max': 'none', '--rw-speed': '5s', '--rw-ax': '40%',
  '--rw-btn-radius': '0px', '--rw-pill-radius': '30px', '--rw-add-radius': '20px'
};
const tokenStyle = Object.entries(tokens).map(([k, v]) => `${k}: ${v}`).join('; ');

const catalog = {
  source: `${SHOP}/pages/runway`,
  looks: LOOKS.map((l) => ({ name: l.name, description: l.description, image: m1080(l.model), products: l.items.map((i) => i.id) })),
  items: CATALOG_ORDER.map((id) => {
    const p = PRODUCTS[id];
    return { id, name: p.name, type: 'From the original lookbook', price: p.price, image: ASSET + p.image, sizes: p.variants.map(([v]) => v), variants: p.variants.map(([v, vid]) => ({ id: vid, a: true, o: [v] })), url: productUrl(id) };
  })
};

const nav = BRAND.nav.map((l) => `<a href="${l.href}"${l.external ? ' target="_blank" rel="noopener noreferrer"' : ''}${l.current ? ' aria-current="page"' : ''}>${esc(l.label)}</a>`).join('');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#ffffff">
<title>${esc(BRAND.title)}</title>
<meta name="description" content="${esc(BRAND.description)}">
<link rel="preload" as="image" href="${m640(LOOKS[0].model)}" fetchpriority="high">
<style>
@font-face{font-family:Inter;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:600;font-style:normal;font-display:swap}
${css}
</style>
</head>
<body>
<header class="site-header shopify-section-group-header-group">
<a href="./" class="brand" aria-label="${esc(BRAND.homeLabel)}"><span class="brand-word">${esc(BRAND.name)}</span></a>
<nav aria-label="Main navigation">${nav}</nav>
<button id="open-bag" type="button" aria-label="Open styling bag"><svg width="22" height="24" viewBox="0 0 24 26" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M4 8h16l1 16H3L4 8zM8 8V6a4 4 0 0 1 8 0v2"/></svg><span data-cart-count>0</span></button>
</header>
<main>
<runway-section id="${SECTION_ID}" class="rw rw--add-icon rw--popup rw--list has-dividers has-border" data-feel="balanced" data-blur="true" data-mblur="true" data-style="ring" data-mstyle="classic" data-fit="true" data-height-mode="original" data-height-vh="100" data-mheight-mode="custom" data-mheight-vh="109" data-reflect="false" data-autoplay="true" data-speed="5000" data-after-add="stay" data-bundle-code="" data-msg-choose="Pick a size for: [items]" data-msg-error="Couldn’t add to bag. Please try again." data-msg-soldout="Sold out" style="${tokenStyle}">
<div class="rw__sticky"><div class="rw__grid">
<div class="rw__left">
<div class="rw__head"><div class="rw__intro"><h2 class="rw__title">Try the Look.</h2><p class="rw__sub">Six looks, styled head to toe. Tap a pin to see the piece.</p></div><span class="rw__sr" aria-live="polite" aria-atomic="true" data-rw-live></span></div>
<div class="rw__stage" data-rw-stage tabindex="0" role="region" aria-roledescription="carousel" aria-label="Try the Look. — use arrow keys or swipe to change look">
<div class="rw__actors" data-rw-actors>${LOOKS.map(bodyMarkup).join('')}</div>
<div class="rw__heroes" data-rw-heroes>${LOOKS.map(heroMarkup).join('')}</div>
<span class="rw__sweep" aria-hidden="true"></span>
<span class="rw__cursor" data-rw-cursor aria-hidden="true"><span class="rw__cursor-in"><span class="rw__cursor-label rw__cursor-drag">Drag</span><span class="rw__cursor-label rw__cursor-view">View</span></span></span>
<span class="rw__walk" aria-hidden="true"><span class="rw__walk-line"></span></span>
</div>
<div class="rw__controls">
<button class="rw__icon rw__prev" type="button" data-rw-prev aria-label="Previous look"><svg width="26" height="14" viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M25 7H1M7 1L1 7l6 6"/></svg></button>
<div class="rw__ticks">${LOOKS.map(tickMarkup).join('')}</div>
<button class="rw__icon rw__auto" type="button" data-rw-auto aria-pressed="false" aria-label="Autoplay"><svg class="rw__auto-play" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg><svg class="rw__auto-pause" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.5 4.5h3.5v15H6.5zM14 4.5h3.5v15H14z"/></svg></button>
<button class="rw__icon rw__next" type="button" data-rw-next aria-label="Next look"><svg width="26" height="14" viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 7h24M19 1l6 6-6 6"/></svg></button>
</div>
<div class="rw__lb" data-rw-lb data-word="Look" role="region" aria-label="View look" aria-hidden="true">
<div class="rw__lb-stage" data-rw-lb-stage></div>
<div class="rw__lb-top"><p class="rw__lb-cap"><span class="rw__lb-kicker" data-rw-lb-kicker></span><span class="rw__lb-name" data-rw-lb-name></span></p><button class="rw__lb-close" type="button" data-rw-zoom-close aria-label="Close">${ICON.close}</button></div>
<p class="rw__lb-hint">Tap a dot to shop the piece</p>
</div>
</div>
<aside class="rw__panel has-rule" aria-label="In this look"><div class="rw__panel-inner">
<div class="rw__panel-head"><h3 class="rw__panel-title">In this look</h3><span class="rw__label" data-rw-pieces>3 pieces</span></div>
${LOOKS.map(panelMarkup).join('\n')}
</div></aside>
</div></div>
</runway-section>
</main>
<dialog id="bag-dialog" aria-labelledby="bag-title">
<div class="bag-heading"><h2 id="bag-title">Your styling bag</h2><button id="close-bag" type="button" aria-label="Close styling bag">×</button></div>
<p class="bag-note">A local outfit shortlist. No payment or order is collected here. Open a piece on the original demo to continue.</p>
<div id="bag-items"></div>
<p id="bag-total"></p>
<button id="export-bag" type="button">Download outfit shortlist</button>
</dialog>
<div id="bag-status" role="status" aria-live="polite"></div>
<script>window.RUNWAY_CATALOG = ${JSON.stringify(catalog)};
window.RUNWAY_BRAND = ${JSON.stringify({ shortlistHeading: BRAND.shortlistHeading, shopHost: new URL(SHOP).hostname })};</script>
<script>
${js}
</script>
</body>
</html>
`;

writeFileSync(here('./index.html'), html);
console.log(`index.html written (${(html.length / 1024).toFixed(1)} KB)`);
