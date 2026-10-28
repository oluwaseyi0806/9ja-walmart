# Put the DEMO on Vercel (for your client to test only)

WARNING: on Vercel the database lives in a temporary folder and RESETS whenever Vercel restarts the app
(minutes to hours). Fine for a client to click around. NOT for real sellers, orders or money.
Background timers (auto-release, unpaid-order expiry) do not run. Use the Raspberry Pi/VPS for real use.

1. Upload this folder to a GitHub repository (github.com > New repository > upload files).
   Do NOT upload `.env`, `data.db` or `node_modules`.
2. vercel.com > Add New > Project > pick the repository > Framework: "Other". Leave build settings empty.
3. Before pressing Deploy, open Environment Variables and add:
   - ADMIN_KEY = a long secret you invent (this is your admin login key)
   - PAYSTACK_SECRET_KEY = your sk_test_ key (TEST key only!)
   - BASE_URL = https://YOUR-PROJECT.vercel.app
4. Deploy. Open the link. Demo seller login (Register / Sign in): demo@9jawalmart.com / Demo12345
5. Admin page: /admin.html and paste your ADMIN_KEY.
6. Send the link to your client. If the data disappears, that is the temporary database. Just use the demo seller again.
Later: move to the VPS (DEPLOY.md). Your domain DNS is the only thing that changes.
