// All content for the POLO "Try the Look." runway page.
// Edit this file, then run `node build.mjs` to regenerate index.html.

export const ASSET = 'https://reel-ref-try-the-look.vercel.app/assets/';
export const SHOP = 'https://nike-makknzjs.myshopify.com';

// Brand-facing strings. The structure and behaviour of the page follow the
// original runway export; these are the bits that make it the POLO site.
export const BRAND = {
  name: 'POLO',
  homeLabel: 'Polo home',
  title: 'Try the Look — Polo Runway',
  description: 'Six looks, styled head to toe. Explore the runway, isolate a look, and tap a pin to see the piece.',
  nav: [
    { label: 'Home', href: './' },
    { label: 'Polo Orbit', href: SHOP + '/pages/nike-orbit', external: true },
    { label: 'Hand Rail Pro', href: SHOP + '/pages/scene-rail', external: true },
    { label: 'Runway', href: './', current: true }
  ],
  shortlistHeading: 'POLO RUNWAY — STYLING SHORTLIST'
};

export const SECTION_ID = 'Runway-template--28035983671601__the_runway_wdM8BG';

// width/height of the product cut-outs as used in the markup (panel and sheet)
const shoe = { w: 400, h: 400, sw: 160, sh: 160 };

export const PRODUCTS = {
  'tatum-5-orbit-copy': {
    name: 'Air Jordan 12 Retro', vendor: 'Polo', price: 149, legend: 'Shoe size',
    image: 'source-tatum-5-orbit-copy.webp', ...shoe,
    variants: [['40', 57015167025457], ['41', 57015167058225], ['42', 57015167090993], ['43', 57015167123761], ['44', 57015167156529], ['45', 57015167189297], ['46', 57015167222065]]
  },
  tshirt: {
    name: 'Tshirt', vendor: 'Polo', price: 199, legend: 'Size',
    image: 'source-tshirt.webp', w: 400, h: 563, sw: 160, sh: 225,
    variants: [['S', 56835911582001], ['L', 56835911614769], ['M', 56835911647537], ['XL', 56835911680305]]
  },
  sweatshirt: {
    name: 'Sweatshirt', vendor: 'Polo', price: 199, legend: 'Size',
    image: 'source-sweatshirt.webp', w: 400, h: 581, sw: 160, sh: 232,
    variants: [['S', 56835806396721], ['L', 56835806429489], ['M', 56835806462257], ['XL', 56835806495025]]
  },
  'tatum-5-orbit': {
    name: 'Tatum 5 Orbit', vendor: 'Polo', price: 149, legend: 'Shoe size',
    image: 'source-tatum-5-orbit.webp', ...shoe,
    variants: [['40', 57015166730545], ['41', 57015166763313], ['42', 57015166796081], ['43', 57015166828849], ['44', 57015166861617], ['45', 57015166894385], ['46', 57015166927153]]
  },
  'hoodie-black': {
    name: 'Hoodie Black', vendor: 'Polo', price: 199, legend: 'Size',
    image: 'source-hoodie-black.webp', w: 400, h: 536, sw: 160, sh: 214,
    variants: [['S', 56836251681073], ['L', 56836251713841], ['M', 56836251746609], ['XL', 56836251779377]]
  },
  'sweatshirt-plus': {
    name: 'Sweatshirt Plus', vendor: 'Polo', price: 199, legend: 'Size',
    image: 'source-sweatshirt-plus.webp', w: 400, h: 610, sw: 160, sh: 244,
    variants: [['S', 56836143743281], ['L', 56836143776049], ['M', 56836143808817], ['XL', 56836143841585]]
  },
  hoodie: {
    name: 'Hoodie', vendor: 'Polo', price: 199, legend: 'Size',
    image: 'source-hoodie.webp', w: 400, h: 555, sw: 160, sh: 222,
    variants: [['S', 56836002185521], ['L', 56836002218289], ['M', 56836002251057], ['XL', 56836002283825]]
  },
  'air-jordan-12-retro-copy': {
    name: 'Luka 5', vendor: 'Polo', price: 149, legend: 'Shoe size',
    image: 'source-air-jordan-12-retro-copy.webp', ...shoe,
    variants: [['40', 57015176364337], ['41', 57015176397105], ['42', 57015176429873], ['43', 57015176462641], ['44', 57015176495409], ['45', 57015176528177], ['46', 57015176560945]]
  }
};

// Catalog order (matches native-catalog.json)
export const CATALOG_ORDER = ['tatum-5-orbit-copy', 'tshirt', 'sweatshirt', 'tatum-5-orbit', 'hoodie-black', 'sweatshirt-plus', 'hoodie', 'air-jordan-12-retro-copy'];

const P2 = [[50, 28], [48, 58], [45, 88]];

export const LOOKS = [
  { key: 'bndthK', name: 'The City Edit', model: 1, description: 'A charcoal knit and easy denim.',
    items: [{ id: 'tatum-5-orbit-copy' }, { id: 'tshirt' }, { id: 'sweatshirt' }],
    pins: [[47, 27], [48, 58], [45, 96]] },
  { key: 'XckgG6', name: 'Gallery Opening', model: 5, description: 'A clean white tee and relaxed denim.',
    items: [{ id: 'tatum-5-orbit' }, { id: 'hoodie-black', tag: 'New' }, { id: 'tshirt' }], pins: P2 },
  { key: 'rLfAhC', name: 'Gallery Opening', model: 4, description: 'Olive knitwear. A grounded palette.',
    items: [{ id: 'sweatshirt-plus' }, { id: 'tatum-5-orbit', tag: 'New' }, { id: 'tshirt' }], pins: P2 },
  { key: 'FKg67q', name: 'Studio Day', model: 6, description: 'Black, white and laid-back denim.',
    items: [{ id: 'hoodie-black' }, { id: 'tatum-5-orbit-copy' }, { id: 'tshirt' }], pins: P2 },
  { key: '8KREEE', name: 'Studio Day', model: 3, description: 'Burgundy layers. A tailored perspective.',
    items: [{ id: 'sweatshirt' }, { id: 'tatum-5-orbit' }, { id: 'tshirt' }], pins: P2 },
  { key: 'N3bfm9', name: 'Studio Day', model: 2, description: 'A grey crew and your favourite denim.',
    items: [{ id: 'hoodie' }, { id: 'air-jordan-12-retro-copy' }, { id: 'tshirt' }], pins: P2 }
];

export const BUNDLE = { was: '$547.00', now: '$492.30', note: 'Bundle all 3 and save 10%' };
