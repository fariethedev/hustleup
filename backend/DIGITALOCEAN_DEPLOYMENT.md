# Deploying HustleUp to DigitalOcean

The whole stack runs as **one App Platform app** plus **one Managed MySQL cluster**, in
Frankfurt (`fra` / `fra1`). Everything is described in [`.do/app.yaml`](../.do/app.yaml),
and every push to `main` redeploys automatically.

| Component | Type | Exposed at |
|---|---|---|
| `hustleup-web` | Static site (Vite build of `frontend/`) | `/` |
| `hustleup-gateway` | Service, Dockerfile | `/api`, `/uploads`, `/ws` |
| `hustleup-auth` … `hustleup-notification` | Internal services | `http://<name>:<port>`, private |
| `hustleup-mysql` | Managed MySQL 8 | private, injected as env vars |

The web app and API share one origin, so the browser never makes cross-origin calls.

### Design decisions

- **No Redis.** Social is the only service that uses it, and its cache already treats Redis
  failures as cache misses. `CACHE_TYPE=simple` uses an in-memory cache instead. If you want
  a shared cache later, add Managed Valkey and set `CACHE_TYPE=redis`, `REDIS_HOST` and
  `REDIS_PORT`.
- **S3 is mandatory.** Containers have no shared or persistent disk. Your existing bucket and
  objects stay where they are, so no files need to move.
- **Rate limiter keys on `DO-Connecting-IP`.** DigitalOcean's edge sets this header to the
  real client address. Without it, every user would share the load balancer's IP.
- **The gateway, marketplace and notification services must run exactly one instance each.**
  They hold in-memory state: the rate-limit buckets, the payout sweep and the STOMP broker.
- **Kafka is not deployed.** Social logs connection warnings and carries on, the same as on
  Railway.

### Monthly cost (estimate; check DigitalOcean's pricing page)

| Item | Approx. |
|---|---|
| 6 × `apps-s-1vcpu-1gb` services | ~$72 |
| Static site | $0 |
| Managed MySQL `db-s-1vcpu-1gb` (daily backups and point-in-time recovery included) | ~$15 |
| **Total** | **~$87** |

The fastest way to cut this is to merge the five internal services into one app, which
brings the total to about $30–40. Moving the gateway and subscription services to smaller
instances is riskier, because a JVM with less than 1 GB of memory gets killed easily.

---

## 1. One-time setup

```powershell
winget install DigitalOcean.Doctl
doctl auth init          # paste an API token: Control Panel → API → Generate New Token (read + write)
```

Then connect GitHub: Control Panel → Apps → Create App → GitHub → **install the
DigitalOcean GitHub app** with access to `fariethedev/hustleup`. Only an owner or admin of
that repo can grant this. You can abandon the wizard once access is granted.

## 2. Create the database

```powershell
doctl databases create hustleup-mysql --engine mysql --version 8 --region fra1 --size db-s-1vcpu-1gb --num-nodes 1
doctl databases list                          # copy the cluster ID; wait for status "online" (~5 min)
doctl databases db create <CLUSTER_ID> hustleup
doctl databases user create <CLUSTER_ID> hustleup
```

All Flyway migrations create primary keys, so the cluster's default
`sql_require_primary_key=ON` setting is fine.

## 3. Fill in secrets

```powershell
Copy-Item .do/secrets.env.example .do/secrets.env    # gitignored
```

Use the **production** values from Railway (each service → Variables → Raw Editor), not the
localhost values in `backend/.env`. Database credentials are not needed here; App Platform
injects them.

## 4. Create the app

```powershell
node scripts/do-render-spec.mjs                       # writes .do/app.rendered.yaml (gitignored)
doctl apps spec validate .do/app.rendered.yaml
doctl apps create --spec .do/app.rendered.yaml
doctl apps list                                       # note the app ID and its default URL
```

The first build takes about 10–15 minutes, because six Maven builds run in parallel. To
follow progress:

```powershell
doctl apps logs <APP_ID> hustleup-auth --type build --follow
doctl apps logs <APP_ID> hustleup-auth --type run --follow
```

On first boot, Flyway creates the schema in the empty database. That's fine for a smoke test,
and step 6 replaces it with your real data.

## 5. Smoke test on the `*.ondigitalocean.app` URL

1. The home page loads, and refreshing a deep link such as `/feed` doesn't 404.
2. You can register and log in.
3. An uploaded avatar comes back with an **S3, CDN or R2 URL**. A `/uploads/...` path means the
   AWS variables are wrong.
4. Opening a chat delivers messages in real time (WebSocket via `/ws`).

## 6. Cut over the data (plan for ~15 minutes of downtime)

Your machine has no MySQL client, so run one through Docker:

```powershell
# a) Stop writes on Railway: scale the Railway services to 0 or pause them.
# b) Dump Railway MySQL. Host, port and password come from the MySQL service → Variables →
#    MYSQL_PUBLIC_URL (TCP proxy).
docker run --rm mysql:8.0 mysqldump -h <RAILWAY_PROXY_HOST> -P <PORT> -u root -p<PASSWORD> `
  --single-transaction --routines --triggers --set-gtid-purged=OFF --no-tablespaces railway > hustleup-cutover.sql

# c) Let your IP reach the DigitalOcean cluster, then restore over the schema from step 4.
doctl databases firewalls append <CLUSTER_ID> --rule ip_addr:<YOUR_PUBLIC_IP>
doctl databases connection <CLUSTER_ID>               # host / port / doadmin password
docker run --rm mysql:8.0 mysql -h <DO_HOST> -P 25060 -u doadmin -p<DO_PASSWORD> --ssl-mode=REQUIRED `
  -e "DROP DATABASE hustleup; CREATE DATABASE hustleup;"
Get-Content hustleup-cutover.sql | docker run --rm -i mysql:8.0 mysql -h <DO_HOST> -P 25060 -u doadmin -p<DO_PASSWORD> --ssl-mode=REQUIRED hustleup

# d) Restart so the services start against the real data. Flyway applies only migrations
#    that are newer than the dump.
doctl apps create-deployment <APP_ID>
doctl databases firewalls remove <CLUSTER_ID> --uuid <RULE_UUID>   # from `doctl databases firewalls list`
```

The dump includes `flyway_schema_history`, so Flyway keeps its existing migration history and
doesn't re-run anything. Keep `hustleup-cutover.sql` somewhere safe and **never commit it**.

## 7. Domain and third parties

1. **Domain:** Apps → hustleup → Settings → Domains → add `hustlespace.space`, then create the
   CNAME it shows you. If DNS is on Cloudflare, set the record to **DNS only** (grey cloud) until
   App Platform has issued its certificate. `APP_URL`, `FRONTEND_URL` and CORS all follow
   automatically after the next deploy.
2. **Stripe** (Dashboard → Developers → Webhooks): point both endpoints at the new domain.
   - Subscriptions: `https://<domain>/api/payments/webhook`
   - Connect payouts: `https://<domain>/api/v1/payouts/webhook`

   If Stripe issues new signing secrets, update `.do/secrets.env`, then re-render and re-apply
   the spec (see the next section).
3. **Google OAuth:** in Cloud Console → APIs & Services → Credentials → your OAuth client, add
   `https://<domain>` under *Authorized JavaScript origins*.
4. **Facebook Login** (App domains) and **Cloudflare Turnstile** (Hostnames): add the domain.
5. **Mobile:** set `EXPO_PUBLIC_API_URL` / `apiBaseUrl` in `mobile/eas.json` and
   `mobile/app.json` to `https://<domain>/api/v1`, then publish a new build or an EAS update.
   Use your own domain rather than the `ondigitalocean.app` URL, so future host moves don't
   require an app release.
6. **Vercel:** once the domain serves the web app from DigitalOcean, the Vercel project can be
   removed.

## 8. Day-to-day

- **Deploy code:** push to `main`, and every component rebuilds.
- **Change env vars:** edit `.do/secrets.env`, run `node scripts/do-render-spec.mjs`, then run
  `doctl apps update <APP_ID> --spec .do/app.rendered.yaml`. Don't change env vars in the
  dashboard as well: the next `apps update` overwrites anything that isn't in the spec.
- **Backups:** the managed cluster keeps daily backups plus point-in-time recovery for 7 days.
  You can restore one to a new cluster with `doctl databases backups <CLUSTER_ID>`.
- **Rollback:** Apps → hustleup → Activity → pick an earlier deployment → Rollback.
- **Decommission Railway** after about a week of stable running. Take one final dump first.
