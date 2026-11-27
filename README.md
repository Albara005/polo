# POLO Store

A standalone store for POLO, with no Shopify. It is a Node.js server with a SQLite database and an admin dashboard. It runs on Railway or on any server that has Node 22.

## What's in it

**Storefront (Arabic and English, prices in SAR):**
- `/`: the runway. Models turn on a 3D ring. Each look shows its pieces, and the shopper can add a single piece or the full look to the bag.
- `/shop`: all products, with filters by category.
- `/product/<slug>`: the product page, with images, sizes, stock and quantity.
- `/cart`: the cart and checkout. The shopper enters name, mobile, city, district and address, then picks cash on delivery or bank transfer.
- `/order/<code>`: the order confirmation page.
- `/track`: order tracking by order number and mobile number.

**Admin dashboard `/admin` (Arabic, password protected):**
- **Orders:** filter by status, change status, and contact the customer by WhatsApp or phone. Cancelling an order puts its stock back.
- **Products:** add, edit, hide or delete. Each product has an Arabic and an English name, a price and an optional compare-at price, sizes with stock per size, images, a description and a "New" tag.
- **Looks:** upload the model photo, choose its pieces, and click on the photo to place each numbered pin. Each look can have a full-look discount.
- **Settings:** shipping fee, free-shipping threshold, payment methods, bank transfer details and the store's WhatsApp number.

**How prices are calculated:** prices are stored in halalas, and the server prices every cart again. When a cart contains every piece of a look, that look's discount applies once. Shipping is free above the threshold set in Settings.

## Run locally

```sh
npm install
ADMIN_PASSWORD='choose-a-strong-password' npm start
# open http://localhost:3000 and http://localhost:3000/admin
```

On the first run the store fills itself with the 8 sample products and 6 looks. Data is saved in `./data/`: the database (`polo.db`) and the uploaded images (`uploads/`).

## Deploy on Railway

1. **New Project → Deploy from GitHub repo**, then choose `polo` and the branch you want to deploy.
2. **Add a Volume.** Without one, every deploy wipes your products, orders and images.
   - In the service, choose **Attach Volume** and set the mount path to `/data`.
   - The app finds it through `RAILWAY_VOLUME_MOUNT_PATH`. You can also set `DATA_DIR=/data` yourself.
3. **Variables:**
   - `ADMIN_PASSWORD`: the dashboard password. Use a long one.
   - `SESSION_SECRET` (optional): a long random string. If you leave it out, the app creates one and saves it on the Volume.
4. **Settings → Networking → Generate Domain**, or connect your own domain.
5. Open `https://<your-domain>/admin`, sign in, and replace the sample products and looks with your own.

The included `railway.json` sets the start command and a health check at `/healthz`. Keep the service at **one replica**, because SQLite lives on a single Volume.

## Tips for photos

- **Model photos for looks:** full body from head to feet, a transparent background (PNG or WebP), and a 9:16 ratio. The runway places each model's feet on the floor automatically.
- **Product photos:** a white or transparent background in portrait orientation. White backgrounds blend into the page.

## Project layout

| Path | Contents |
|---|---|
| `server/index.js` | Routes, public API, admin API, image uploads |
| `server/db.js` | SQLite schema, queries and sample data |
| `server/pricing.js` | Cart pricing: look discounts and shipping |
| `server/i18n.js` | Arabic and English text, categories, order statuses |
| `server/views/` | Page templates (runway, shop, product, cart, order, tracking) |
| `public/` | CSS and browser scripts (runway, cart, checkout, admin) |
| `seed/images/` | Sample photos copied in on the first run |
