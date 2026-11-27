# POLO — Try the Look (Runway)

A single page, `index.html`, built with plain HTML, CSS and vanilla JavaScript. Open it in a browser or host it anywhere as a static file.

- **Desktop (750px and wider):** six models stand on a turning 3D ring. It autoplays every 5 s and has a 01–06 progress bar, arrows, a pause button and a custom "Drag / View" cursor.
- **"View look" popup:** shows the selected model large, with numbered pins for each product.
- **"In this look" panel:** each product has a size picker. The panel ends with a bundle price and "Add full look to bag".
- **Phones (749px and narrower):** the models line up diagonally, the products scroll sideways, and sizes open in a bottom sheet.
- **Styling bag:** a shortlist saved in the browser (`localStorage`). It can be downloaded as a `.txt` file.

## Editing

The page is generated. Do not edit `index.html` by hand.

| File | What it holds |
|---|---|
| `src/data.mjs` | Brand name, nav links, looks, products, prices, sizes, variant IDs, pin positions |
| `src/runway.css` | All styles |
| `src/runway.js` | Carousel physics, autoplay, popup, pickers and bag |
| `src/inter-600.woff2` | Nav font, embedded into the page at build time |

After any change, rebuild with Node 18 or later:

```sh
node build.mjs
```

The model and product images load from `https://reel-ref-try-the-look.vercel.app/assets/`. Product links point to the Shopify store set in `SHOP` in `src/data.mjs`.
