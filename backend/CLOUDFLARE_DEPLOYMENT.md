# Deploying HustleUp to Cloudflare

| Piece | Runs on |
|---|---|
| Web app (`frontend/`) | **Vercel** at hustlespace.space, with `VITE_API_URL=https://api.hustlespace.space`. The Worker also serves a copy of the build on its `workers.dev` URL. |
| API | **`https://api.hustlespace.space`**, a custom domain on the Worker |
| Gateway | **The Worker itself** ([cloudflare/src/index.ts](../cloudflare/src/index.ts)): same routes, rate limits, CORS and security headers. The `hustleup-gateway` service is not deployed. |
| social | Cloudflare **Containers**, `standard-1` (1/2 vCPU, 4 GiB, 1 GiB heap) |
| auth, marketplace | Cloudflare **Containers**, `basic` (1/4 vCPU, 1 GiB, 512 MB heap) |
| subscription, notification | Cloudflare **Containers**, `basic` (1/4 vCPU, 1 GiB, 320 MB heap) |
| MySQL | **Aiven free MySQL 8.4** (Cloudflare has no MySQL; D1 is SQLite and Java can't connect to it directly) |
| Media | R2 bucket `hustlespace`, served from `images.hustlespace.space` |
| Deploys | GitHub Actions ([deploy-cloudflare.yml](../.github/workflows/deploy-cloudflare.yml)) on every push to `main` |

Every container runs as a single instance and is kept warm by a 5-minute cron.

Custom instance types need at least 1 vCPU, so the presets above are used. After a deploy,
`basic` instances get capacity within seconds, while `standard-1` can wait 10 minutes or more.
While a service is starting, the Worker returns `503` with `Retry-After: 30`.

**Cost estimate (check Cloudflare's pricing page):** $5 Workers Paid plan plus about $6.50
per GiB-month of memory, which is about $26 for the standard-1 and $6.50 for each basic,
plus CPU while active. That's roughly **$55–60/month**, and Aiven's free tier is $0.

**Database bootstrap:** the Flyway migrations cannot build the schema from an empty
database. V12 alters a `posts` table that no migration creates, because the earliest tables
predate Flyway. Production was therefore initialised from a schema-only dump of an
up-to-date database: 53 tables plus `flyway_schema_history` through V39, and the V32 sample
rows. Later migrations apply normally. To rebuild from scratch, dump the structure with
`mysqldump --no-data`, add the `flyway_schema_history` rows, and import it with
`SET SESSION sql_require_primary_key=0` first, because four collection tables have no
primary key.

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

## 5. Database
Production started from an empty database: the old Railway data was not carried over. See
**Database bootstrap** above for how the schema was created.

## 6. Domain and third parties
- **API domain:** `api.hustlespace.space` is declared in `wrangler.jsonc` (`routes`), and
  Wrangler creates it on deploy. The web app stays on Vercel, so `FRONTEND_URL` (used in
  email links and allowed by CORS) is `https://hustlespace.space`.
- **Vercel:** the `hustleup` project's `VITE_API_URL` is `https://api.hustlespace.space`.
- **Stripe webhooks:** `https://api.hustlespace.space/api/payments/webhook` (subscriptions) and
  `https://api.hustlespace.space/api/v1/payouts/webhook` (Connect payouts).
- **Google OAuth:** add `https://hustlespace.space` to *Authorized JavaScript origins*. Add the
  domain for Facebook Login (App domains) and Turnstile (Hostnames) too.
- **Mobile:** `EXPO_PUBLIC_API_URL` and `apiBaseUrl` (`mobile/eas.json`, `mobile/app.json`)
  point at `https://api.hustlespace.space/api/v1`. Ship a build or an EAS update to apply.

## Operating it
- **Logs:** run `npx wrangler tail` from `cloudflare/`, or use Dashboard → Workers → hustleup →
  Logs. Container stdout is under Containers → the service → Logs.
- **Change a secret:** run `npx wrangler secret put NAME`. Running containers keep their old
  environment until they restart, which happens on the next deploy.
- **First request after a deploy** waits while the JVM starts (up to a few minutes on
  0.5 vCPU). The cron starts every service within 5 minutes anyway.
