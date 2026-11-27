'use strict';
// Builds a single-file, in-browser preview of the store (for a claude.ai artifact or any static host).
// Usage: node scripts/build-preview.js <out.html>
// The page expects the seed images beside it under assets/ (same files as seed/images/).
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const out = process.argv[2];
if (!out) { console.error('usage: node scripts/build-preview.js <out.html>'); process.exit(1); }

const MODULES = {
  'i18n': 'server/i18n.js',
  'seed-data': 'server/seed-data.js',
  'validate': 'server/validate.js',
  'db': 'demo/db.js',
  'pricing': 'server/pricing.js',
  'layout': 'server/views/layout.js',
  'runway': 'server/views/runway.js',
  'pages': 'server/views/pages.js',
  'app': 'demo/app.js'
};

const modules = Object.entries(MODULES).map(([name, file]) =>
  `__def(${JSON.stringify(name)}, function (module, exports, require) {\n${read(file)}\n});`).join('\n');

const bundle = `(function () {
'use strict';
var __defs = {}, __cache = {};
function __def(name, fn) { __defs[name] = fn; }
function __req(p) {
  var name = String(p).split('/').pop().replace(/\\.js$/, '');
  if (__cache[name]) return __cache[name].exports;
  if (!__defs[name]) throw new Error('Unknown module ' + p);
  var m = __cache[name] = { exports: {} };
  __defs[name](m, m.exports, __req);
  return m.exports;
}
${modules}
__req('app');
})();`;

const wrap = (file, fnName) => `window.${fnName} = function () {\n${read(file)}\n};`;
const font = fs.readFileSync(path.join(ROOT, 'public/fonts/inter-600.woff2')).toString('base64');
const baseCss = read('public/css/base.css').replace('url(/fonts/inter-600.woff2)', `url(data:font/woff2;base64,${font})`);

const scripts = [
  read('public/js/cart.js'),
  read('public/js/runway.js'),
  wrap('public/js/product.js', '__initProduct'),
  wrap('public/js/checkout.js', '__initCheckout'),
  'window.POLO_DEMO = true;',
  read('public/js/admin.js'),
  bundle
].join('\n;\n').replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

const demoCss = `
#polo-root{min-height:100vh;display:flex;flex-direction:column;flex:1 0 auto}
.demo-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;padding:8px max(16px,env(safe-area-inset-right,0px)) 8px max(16px,env(safe-area-inset-left,0px));background:#151413;color:#fff;font-size:12px;line-height:1.5}
.demo-bar span{flex:1 1 260px}
.demo-bar a{color:#fff;text-decoration:underline;text-underline-offset:3px;padding:6px 0}
.demo-bar button{background:none;border:1px solid rgb(255 255 255/.45);color:#fff;padding:6px 12px;font:inherit;cursor:pointer;min-height:32px}
.demo-bar button:hover{border-color:#fff}
`;

const html = `<title>POLO Store</title>
<meta name="description" content="POLO store preview: runway looks, shop, cart, checkout, order tracking and the admin dashboard.">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap">
<style id="css-base">
${baseCss}
${demoCss}
</style>
<style id="css-runway">
${read('public/css/runway.css')}
</style>
<style id="css-admin" disabled>
${read('public/css/admin.css')}
</style>
<div id="polo-root"></div>
<script>
${scripts}
</script>
`;

fs.writeFileSync(out, html);
console.log(`${out} written (${(html.length / 1024).toFixed(1)} KB)`);
