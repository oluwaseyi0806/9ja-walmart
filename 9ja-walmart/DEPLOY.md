# 🚀 DEPLOY.md: Put 9JA WALMART on the internet (beginner guide)

Read this slowly, one step at a time. **Do not skip Part 0.** It protects your money and your reputation.

Words you will meet:
- **Domain** = your website name (yourdomain.com). **VPS** = a small computer you rent that is always on.
- **SSH** = typing commands into that computer from yours. **Caddy** = a program that gives your site the padlock (HTTPS).
- **pm2** = a program that keeps your shop running and restarts it if it crashes.

---

## PART 0. Business facts to settle FIRST (before any code)

### 0.1 Your Paystack Starter limit: ₦8,000,000 in total
A Starter Paystack business can only collect about **₦8,000,000 in its whole lifetime**, and pays out only to a personal bank account that matches your BVN/ID. A shop selling phones reaches that fast (that is only about 80 phones at ₦100k).
**Action:** While you build, stay on Starter. Before launch Phase B, start upgrading to a **Registered business**. That needs a CAC registration (business name or company) and a business bank account. Registration takes days to weeks, so start it NOW, in week 1.

### 0.2 "Holding" the seller's money until delivery: ask Paystack in writing
Your app holds the seller's share until the buyer says "received". Paystack normally pays everything into YOUR account, then YOU pay sellers. Some regulators and payment companies treat holding other people's money as a regulated activity.
**Action:** Email Paystack support (support@paystack.com) and ask exactly:
> "I run a marketplace. Buyers pay into my Paystack account; I hold the seller's share until the buyer confirms delivery, then pay the seller by bank transfer. Is this allowed on my account type? If not, what do you recommend (split payments/subaccounts)?"

Keep their answer. If they say no, use Paystack **Split Payments** (sellers get a subaccount and Paystack pays them directly). That is a code change we can do together. Also ask a lawyer for one hour of advice.

### 0.3 Commission: now 5%
Paystack takes about 1.5% + ₦100 from every payment. At 2% you earn almost nothing. At **5%** (set in `.env`: `COMMISSION_PERCENT=5`) you keep about ₦600 on a ₦20,000 phone and ₦5,500 on a ₦150,000 phone after Paystack's fee. You can change it any time. It only affects new orders.

### 0.4 Customer data law (NDPC)
You store names, phones and addresses. Nigeria's data protection law may require you to register with the NDPC once you pass roughly 200 customers. Check ndpc.gov.ng when you grow, and add a Privacy page to your site.

---

## PART 1. Launch in 3 phases (this protects you)

| Phase | Who | What works | Money |
|---|---|---|---|
| **A** (weeks 1-3) | Sellers only | Sellers register, you approve them, they list phones | Test keys only. Nobody pays |
| **B** (week 4) | 5-10 trusted friends buy | Real payments with live Paystack keys, real delivery | Small real orders. Practise refunds and the "Report a problem" button |
| **C** | Everyone | Advertise to the public | Registered Paystack account done |

Never jump to C before B works perfectly.

---

## PART 2. Buy the pieces

1. **Domain**: buy a `.com.ng` or `.com` (Namecheap, Whogohost, etc.). About ₦5,000 to ₦20,000 per year.
2. **VPS**: Hetzner, DigitalOcean or Contabo. Choose **Ubuntu 24.04**, 2 GB RAM. You get an **IP address** and a root password by email.
3. **Cloudflare (free)**: make an account, add your domain, and change your domain's nameservers to the two Cloudflare gives you. Then add a DNS record: type **A**, name `@`, value = your VPS IP. Add another with name `www`. Wait up to an hour.

---

## PART 3. Set up the server (copy each command, press Enter)

On Windows, open **PowerShell** and connect (replace the IP):
```
ssh root@YOUR.VPS.IP
```
Type yes, then the password. Now you are inside the server.

**3.1 Update and install Node 22**
```
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs sqlite3 git unzip
node -v
```
`node -v` must show v22.13 or higher.

**3.2 Install pm2 and Caddy**
```
npm install -g pm2
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```

**3.3 Basic firewall (only web + SSH allowed)**
```
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
```

---

## PART 4. Upload your shop

On YOUR computer (new PowerShell window), from the folder that contains the project zip:
```
scp 9ja-walmart.zip root@YOUR.VPS.IP:/root/
```
Back in the server window:
```
cd /root && unzip 9ja-walmart.zip && cd 9ja-walmart
npm install
cp .env.example .env
nano .env
```
In `nano`, set these lines, then press **Ctrl+O, Enter, Ctrl+X** to save:
```
COMMISSION_PERCENT=5
AUTO_RELEASE_DAYS=3
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxx      (use TEST key until Phase B)
BASE_URL=https://yourdomain.com
TRUST_PROXY=1
```
Your `ADMIN_KEY` is created automatically the first time the app starts. Run `cat .env` to see it. **Save it in a password manager.**

Start it forever:
```
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup
```
(`pm2 startup` prints one command. Copy and run it. This makes the shop start after a reboot.)

---

## PART 5. HTTPS and admin lockdown

1. Make a password for the admin area:
```
caddy hash-password
```
Type a strong password twice. It prints a long hash starting with `$2a$`.
2. Edit the Caddy file:
```
cp deploy/Caddyfile /etc/caddy/Caddyfile
nano /etc/caddy/Caddyfile
```
Change `yourdomain.com` to your domain and paste the hash where it says PASTE_HASH.
3. `systemctl reload caddy`

Visit `https://yourdomain.com`. You should see the padlock and your shop. Visit `/admin.html`: the browser asks for username `boss` and your password FIRST. Then you still enter the ADMIN_KEY. That is two locks.

In Cloudflare set **SSL/TLS → Full (strict)** and turn on **Always Use HTTPS**.

---

## PART 6. Connect Paystack

1. Paystack Dashboard → Settings → API Keys & Webhooks.
2. **Webhook URL:** `https://yourdomain.com/api/payments/webhook`
3. Test with a Paystack test card in Phase A, and check that the order turns **Paid** in the admin.
4. **Only when Phase B starts:** replace `sk_test_` with `sk_live_` in `.env`, then `pm2 restart 9ja-walmart`.

---

## PART 7. Backups (do this before real customers)

```
chmod +x deploy/backup.sh
crontab -e
```
Add this line at the bottom (it runs every night at 2:30):
```
30 2 * * * /root/9ja-walmart/deploy/backup.sh
```
Test it once: `./deploy/backup.sh` then `ls /root/backups`. **Every week, download the backups to your own computer** (use `scp -r root@YOUR.VPS.IP:/root/backups .`). A backup that only lives on the same server is not safe.

---

## PART 8. How the money flow works day to day

1. Buyer pays → order **Paid** → seller's share and your commission are **held**.
2. Seller ships → admin sets **Shipped**.
3. Buyer taps **"I received my order"** → money becomes **Ready to pay** in Payouts.
4. If the buyer says nothing, after `AUTO_RELEASE_DAYS` (3) the app releases it automatically.
5. If the buyer taps **"Report a problem"**, the money is **frozen** and a red badge appears on **Disputes** in the admin. Call both people, then choose **Refund the buyer** or **Pay the seller**. For a refund, you also click Refund in your Paystack dashboard on that transaction.
6. You send the seller's money by bank transfer, then click **I have paid this seller**.

---

## PART 9. Updating your site later

On your computer, change the files, zip, upload (Part 4 `scp`), then on the server:
```
cd /root && unzip -o 9ja-walmart.zip -d 9ja-walmart-new
cp -r 9ja-walmart-new/9ja-walmart/* 9ja-walmart/     # never overwrites .env or data.db
cd 9ja-walmart && npm install && pm2 restart 9ja-walmart
```
Then press **Ctrl+F5** in the browser.

Useful commands: `pm2 logs` (see errors), `pm2 status`, `pm2 restart 9ja-walmart`.

---

## PART 10. Launch checklist

- [ ] Asked Paystack about holding funds, and kept the answer
- [ ] Registered-business upgrade started (CAC)
- [ ] `COMMISSION_PERCENT=5`
- [ ] HTTPS padlock works, `/admin.html` asks for a password first
- [ ] `ADMIN_KEY` saved in a password manager
- [ ] Test payment turned the order Paid; test refund and Report a problem tried
- [ ] Nightly backup works, and one copy downloaded to your computer
- [ ] Terms and Privacy pages added
- [ ] Phase A sellers approved, Phase B done with friends before Phase C
