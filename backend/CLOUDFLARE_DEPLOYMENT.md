# Deploying HustleUp to Cloudflare

| Piece | Runs on |
|---|---|
| Web app (`frontend/`) | Worker static assets |
| Gateway | **The Worker itself** ([cloudflare/src/index.ts](../cloudflare/src/index.ts)): same routes, rate limits, CORS and security headers. The `hustleup-gateway` service is not deployed. |
| auth, social, marketplace, subscription, notification | Cloudflare **Containers**: one instance each, 0.5 vCPU / 1 GiB, kept warm by a 5-minute cron |
| MySQL | **Aiven free MySQL 8** (Cloudflare has no MySQL; D1 is SQLite and Java can't connect to it directly) |
| Media | S3 / R2, unchanged |
| Deploys | GitHub Actions ([deploy-cloudflare.yml](../.github/workflows/deploy-cloudflare.yml)) on every push to `main` |

**Cost estimate (check Cloudflare's pricing page):** $5 Workers Paid plan plus about $6.50
per GiB-month of memory for 5 always-on containers, plus CPU while active. That's roughly
**$40–50/month**, and Aiven's free tier is $0.

**Known limits:**
- Aiven's free tier allows 1 GB of storage. Your data is currently under 1 MB.
- Aiven powers off free services after long inactivity. The cron keeps the services
  connected, so that shouldn't happen.
- Cloudflare rate limiting counts per location, so it's approximate.
- Containers have no persistent disk, so uploads must go to S3 or R2.

---

## 1. Cloudflare account
1. Subscribe to **Workers Paid** (Dashboard → Workers & Pages → Plans). Containers need it.
2. Create an **API token**: My Profile → API Tokens → Create Token → template
   *Edit Cloudflare Workers*, and add the **Containers: Edit** permission.
3. Copy your **Account ID** from the Workers & Pages overview.

## 2. Free MySQL on Aiven
1. Sign up at aiven.io → Create service → **MySQL** → **Free plan**.
2. On the service's Overview page, note the host, port, user (`avnadmin`), password and
   database (`defaultdb`).
3. Build `DB_URL`: `jdbc:mysql://<host>:<port>/defaultdb?sslMode=REQUIRED&serverTimezone=UTC`

## 3. Worker secrets (from your machine)
```powershell
cd cloudflare
npm ci
npx wrangler login                         # browser approval
Copy-Item secrets.env.example .secrets.env # gitignored: fill in production values
npx wrangler secret bulk .secrets.env
```
If `secret bulk` complains that the Worker doesn't exist yet, run the deploy workflow once
(step 4), then repeat this step.

## 4. GitHub configuration (repo → Settings → Secrets and variables → Actions)

| Kind | Name | Value |
|---|---|---|
| Secret | `CLOUDFLARE_API_TOKEN` | token from step 1 |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | account ID from step 1 |
| Variable | `PUBLIC_URL` | `https://hustlespace.space`, or the `*.workers.dev` URL to start with |
| Variable (optional) | `EXTRA_CORS_ORIGINS` | comma-separated extra origins |
| Variables (optional) | `VITE_GOOGLE_CLIENT_ID`, `VITE_FACEBOOK_APP_ID`, `VITE_TURNSTILE_SITE_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_ALGOLIA_APP_ID`, `VITE_ALGOLIA_SEARCH_KEY`, `VITE_SENTRY_DSN`, `VITE_CRISP_WEBSITE_ID` | public web build keys |

Then go to Actions → **Deploy to Cloudflare** → Run workflow. The first run builds five
images and takes about 15–20 minutes. Until the secret and variable are set, the workflow
skips without failing.

## 5. Copy the data (Railway → Aiven)
1. On Railway, open the MySQL service → Settings → enable the **TCP Proxy** (public access).
   Its Variables tab shows the host, port, user, password and database.
2. Add the `SOURCE_MYSQL_HOST/PORT/USER/PASSWORD/DATABASE` and
   `TARGET_MYSQL_HOST/PORT/USER/PASSWORD/DATABASE` repository secrets.
3. Pause writes: scale the Railway services down. Then go to Actions →
   **Copy database (Railway → Aiven)** → Run workflow, typing `overwrite`.
4. Re-run **Deploy to Cloudflare** so the services restart against the copied data. Flyway
   sees the copied migration history and applies only newer migrations.
5. Turn the Railway TCP proxy off again.

## 6. Domain and third parties
- **Domain:** Workers & Pages → hustleup → Settings → Domains & Routes → add
  `hustlespace.space` as a custom domain. Then set the `PUBLIC_URL` variable to it and
  redeploy.
- **Stripe webhooks:** `https://<domain>/api/payments/webhook` (subscriptions) and
  `https://<domain>/api/v1/payouts/webhook` (Connect payouts).
- **Google OAuth:** add `https://<domain>` to *Authorized JavaScript origins*. Add the domain
  for Facebook Login (App domains) and Turnstile (Hostnames) too.
- **Mobile:** set `EXPO_PUBLIC_API_URL` and `apiBaseUrl` (`mobile/eas.json`,
  `mobile/app.json`) to `https://<domain>/api/v1`, then ship a build or an EAS update.

## Operating it
- **Logs:** run `npx wrangler tail` from `cloudflare/`, or use Dashboard → Workers → hustleup →
  Logs. Container stdout is under Containers → the service → Logs.
- **Change a secret:** run `npx wrangler secret put NAME`. Running containers keep their old
  environment until they restart, which happens on the next deploy.
- **First request after a deploy** waits while the JVM starts (up to a few minutes on
  0.5 vCPU). The cron starts every service within 5 minutes anyway.
