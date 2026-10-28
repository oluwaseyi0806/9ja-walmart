# 9JA WALMART

## Run
1. Install Node.js LTS (nodejs.org)
2. Open this folder in VS Code, press Ctrl+` for the terminal
3. `npm install`  then  `npm start`   (needs Node 22.5 or newer; no compiling needed)
4. Open http://localhost:3000   (admin: /admin.html, default key: change-me)

## PROJECT MAP - "I want to change ___, which file?"

| I want to change...                         | Open this file                  |
|---------------------------------------------|---------------------------------|
| Starter products, prices, sellers           | src/db.js (delete data.db after) |
| Port (admin key lives in the .env file)     | src/config.js + .env            |
| Search, categories, flash sale data (API)   | src/routes/catalog.js           |
| Checkout rules, order saving, tracking API  | src/routes/orders.js            |
| Order status list, admin actions            | src/routes/admin.js             |
| Rate limits, security headers               | src/middleware.js               |
| Brand colours, spacing, layout              | public/styles.css (top: :root)  |
| Page structure (header, footer, sections)   | public/index.html               |
| Product card look / product loading         | public/js/02-products.js        |
| Category chips                              | public/js/03-categories.js      |
| Banner slides                               | public/js/04-hero.js            |
| Flash sale + countdown                      | public/js/05-flash-sale.js      |
| Search box + sort                           | public/js/06-search.js          |
| Cart                                        | public/js/07-cart.js            |
| Checkout form, Nigerian states              | public/js/08-checkout.js        |
| Order tracking popup                        | public/js/09-tracking.js        |
| Sign up / sign in / profile (screens)       | public/js/10-account.js         |
| Sign up / sign in / profile (server)        | src/routes/auth.js              |
| Seller apply / dashboard (screens)          | public/js/12-seller.js          |
| Seller rules + upload (server)              | src/routes/seller.js            |
| 3D card tilt effect                         | public/js/13-3d-effects.js      |
| Phone details popup + state filter          | public/js/14-phone-ui.js        |
| Which details a phone needs (add products)  | src/categories.js               |
| Nigerian states list                        | src/states.js                   |
| Commission, escrow, Paystack, expiry        | src/payments.js (+ routes/payments.js) |
| Store pages, phone popup, IMEI proof        | public/js/14-phone-ui.js        |
| Received + rating popups                    | public/js/09-tracking.js        |
| Excel file maker (admin downloads)          | public/admin-excel.js           |
| Seller: open / edit phones                  | public/js/12-seller.js + src/routes/seller.js |
| Motion: tilt, shine, press, ping, popups    | public/interactions.css + public/interactions.js |
| Admin page                                  | public/admin.html               |

Tip: in VS Code press Ctrl+P and type a file name to jump to it.
Money is always in kobo (1 naira = 100 kobo).

## Admin key
On first run the server creates a secret ADMIN_KEY, saves it in the .env file and prints it in the terminal. Open .env in VS Code any time to see or change it. Never share .env or upload it to GitHub.

## Sellers
A customer signs up, clicks Sell, submits the form. In /admin.html you review and Approve. Approved sellers get a dashboard, a Verified badge, and can upload product photos (saved in public/uploads).

## Money flow (phones)
Buyer pays in app -> Paystack -> webhook marks PAID -> 5% commission split off (COMMISSION_PERCENT) -> both amounts HELD
-> seller ships -> buyer taps "I received my phone" (or admin sets Delivered) -> money becomes AVAILABLE
-> admin sends seller's money by bank transfer and clicks "mark paid out".
Unpaid orders are cancelled after 30 minutes and stock is restored.
