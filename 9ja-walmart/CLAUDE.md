# 9JA WALMART: handoff notes (read this first)

Phone-only multi-vendor marketplace for Nigeria (like Jumia). The owner is a beginner learner on Windows who wants to launch sellers' registration in about a month. **Teach step by step in plain words, and explain every command.**

## Stack
- Node.js 22.13+ (uses built-in `node:sqlite`, no compile step) + Express 4. Only dependency: express.
- Vanilla JS front end, numbered files in `public/js/`. Admin = single `public/admin.html`.
- Money is in kobo (integers). Database file: `data.db` (never delete it or send it to anyone).
- Run: `npm install` then `npm start`. A `.env` is auto-created with `ADMIN_KEY`. Copy `.env.example` for the rest.

## Layout (every file has a header banner describing it)
- `server.js`: app wiring + timers (`expireUnpaid` every 5 min, `autoRelease` every hour)
- `src/config.js`, `db.js` (tables), `middleware.js`, `payments.js` (Paystack, ledger), `states.js`, `categories.js` (add new product types here later)
- `src/routes/`: `admin`, `auth`, `catalog`, `orders`, `payments`, `seller`
- `public/`: `index.html`, `admin.html`, `admin-excel.js` (dependency-free .xlsx writer), `styles.css`, `interactions.css/js` (3D tilt, press, ping, toasts)
- `deploy/`: Caddyfile, pm2 config, backup script. `DEPLOY.md` is the full beginner launch guide.

## Money flow (do not break)
Buyer pays via Paystack → webhook marks order Paid → seller share + commission (`COMMISSION_PERCENT`, default 5) are **held** in `ledger` → buyer taps "received" (or admin sets Delivered, or `autoRelease` after `AUTO_RELEASE_DAYS`=3 days from Shipped) → **available** → admin pays seller by bank transfer and clicks "I have paid". A buyer "Report a problem" creates an open `dispute`: funds stay frozen (`releaseFunds` refuses while a dispute is open) until admin chooses refund (void + order Cancelled) or release.

## Design rules
Palette: ink `#0B1220`, emerald `#0B7A53` (dark `#075E40`), amber `#F5A524` (text on amber `#1A1203`), surface `#F5F7FA`, muted `#5B6575`. Keep contrast at 4.5:1+. Native cursor only. Tilt capped at 10°. Respect `prefers-reduced-motion`. Enter key must work in every form. Don't change business logic when restyling.

## Known facts / risks
- Paystack Starter account: about ₦8,000,000 lifetime collection cap; payouts only to a personal account. Must upgrade to a Registered business (CAC) before volume.
- Unconfirmed: whether Paystack allows holding sellers' money until delivery. The owner must ask Paystack in writing. Fallback = Paystack split payments/subaccounts.
- `/admin.html` is publicly reachable: lock it with Caddy basic_auth or Cloudflare Access.
- No browser was available when this was built, so UI was checked by syntax/logic only. Look at pages visually when you can.
- Not built yet: password reset + email receipts, named admin accounts, split payments, automatic bank payouts, Terms/Privacy pages.

## Hosting plan
Domain `9jawalmart.com` is bought at Whogohost. Not on Vercel (it needs a persistent disk and always-on timers). Plan: run on a Raspberry Pi 4 via Cloudflare Tunnel for Phase A (sellers only, Paystack **test** key), then move to a Linux VPS (Ubuntu 24.04, 2 GB, Whogohost C2 plan) by copying `data.db`, `.env` and `public/uploads`.

## Phased launch
A: sellers only, test keys → B: a few friends buy with live keys → C: public.

## Design (Figma)
Brand board + Home screen + Phone card component: https://www.figma.com/design/pB4oOofmVaPQUcTcaN8Eo3 (file "9JA WALMART — Brand & UI"). Logo = original shopping-bag mark with a "9" (`public/logo-mark.svg`, `logo-icon.svg`). Font: Plus Jakarta Sans. The "16. PRO LAYER" at the end of `public/styles.css` implements the Figma look and deliberately flattens the older 3D skin (tilt/press interactions in interactions.css are kept). Still to design/apply: product popup, cart drawer, checkout, seller dashboard, admin, tracking and dispute popups (these still contain some emoji).
## Trademark warning
"Walmart" is a registered trademark of a large company. Before registering the business with CAC or going public, get a lawyer's opinion on the name "9JA WALMART" or choose a different name (the logo and code are easy to rename).
