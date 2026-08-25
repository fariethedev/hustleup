# Deploying the HustleUp Backend to Railway

Step-by-step guide for running the six Spring Boot services on Railway (Hobby plan).

The AWS guide in [AWS_DEPLOYMENT.md](backend/AWS_DEPLOYMENT.md) stays valid as an
alternative — this document is self-contained and replaces it operationally.

---

## What you are deploying

One Railway project containing **eight services**:

| Railway service | Module | Port | Public? |
|---|---|---|---|
| `hustleup-gateway` | `hustleup-gateway` | 8000 | ✅ the only public one |
| `hustleup-auth` | `hustleup-auth` | 8081 | private |
| `hustleup-social` | `hustleup-social` | 8082 | private |
| `hustleup-marketplace` | `hustleup-marketplace` | 8083 | private |
| `hustleup-subscription` | `hustleup-subscription` | 8084 | private |
| `hustleup-notification` | `hustleup-notification` | 8085 | private |
| `MySQL` | Railway plugin | 3306 | private |
| `Redis` | Railway plugin | 6379 | private |

Only the gateway gets a public domain. The other five talk to it over Railway's private
network and are never internet-reachable.

### Four things that must change before this works

Railway gives each service its own container, which breaks three assumptions baked into
the current code. Steps 1–2 and 9–10 fix them; know them up front:

1. **No Dockerfiles exist.** Nixpacks will not handle a 7-module Maven parent POM
   sensibly. Step 1 adds one Dockerfile per service.
2. **Gateway routes point at `localhost:808x`.** All ~21 routes in
   [application.yml](backend/hustleup-gateway/src/main/resources/application.yml) must
   become `*.railway.internal`. Step 2 makes them environment-driven so local dev still
   works unchanged.
3. **`UPLOAD_DIR` is a shared directory across all six services.** This cannot exist on
   Railway — separate containers, and a Railway volume mounts to exactly one service.
   S3 becomes mandatory, not optional (Step 9).
4. **`/ws` is not routed through the gateway**, and the notification service is the only
   thing serving it. Step 10 adds the route.

Two constraints you can't engineer away on Hobby:

- **Volume storage is capped at 5 GB**, which is your MySQL ceiling. Fine while uploads
  live in S3 (they will), but it's a hard limit to watch.
- **The notification service must run exactly 1 replica.** It uses an in-memory STOMP
  broker (`enableSimpleBroker`), so two instances can't see each other's subscriptions.

Finally: ignore [docker-compose.yml](backend/docker-compose.yml). It sets up Kong, which
nothing uses — Spring Cloud Gateway is the real gateway.

---

## Cost reality on Hobby

Hobby is $5/month including $5 of usage credit. Usage beyond that is metered at roughly
**$10/GB-month RAM** and **$20/vCPU-month** (billed per second — $0.00000386/GB/s and
$0.00000772/vCPU/s).

Six always-on JVMs at ~400–600 MB RSS each land around:

| | ~$/mo |
|---|---|
| 6 Spring Boot services (~2.9 GB) | 29 |
| MySQL + 5 GB volume | 5 |
| Redis | 0.50 |
| CPU (~0.3 vCPU avg, light traffic) | 6 |
| **Estimated total** | **~$40–45** |

The $5 credit comes off that. **Set a spend limit before you deploy** — Project Settings
→ Usage → set a hard cap. Railway will stop your services rather than run up a bill, which
is the behaviour you want while you're calibrating.

The heap caps in Step 1 exist to keep this number down. Railway bills actual RSS, not
allocated, so trimming heaps translates directly into money saved.

---

## Step 0 — Prerequisites

```powershell
railway --version   # npm i -g @railway/cli
railway login
```

You'll also need AWS credentials for S3 (Step 9) — Railway has no instance-role
equivalent, so you need a real IAM access key this time.

---

## Step 1 — Add Dockerfiles

**These already exist** — one at `backend/hustleup-<service>/Dockerfile` for each of the
six. They're near-identical; only the module name, port, and heap differ. Here is the auth
one:

```dockerfile
# syntax=docker/dockerfile:1
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

# Every module POM must be present: Maven constructs the full reactor from <modules>
# in the parent POM before -pl prunes it, so a missing child pom.xml fails the build.
# POMs change rarely, so this layer caches across source-only rebuilds.
COPY pom.xml .
COPY hustleup-common/pom.xml hustleup-common/
COPY hustleup-auth/pom.xml hustleup-auth/
COPY hustleup-social/pom.xml hustleup-social/
COPY hustleup-marketplace/pom.xml hustleup-marketplace/
COPY hustleup-subscription/pom.xml hustleup-subscription/
COPY hustleup-notification/pom.xml hustleup-notification/
COPY hustleup-gateway/pom.xml hustleup-gateway/

# Only the sources this service actually needs.
COPY hustleup-common/src hustleup-common/src
COPY hustleup-auth/src hustleup-auth/src

RUN mvn -B -pl hustleup-auth -am package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /build/hustleup-auth/target/hustleup-auth-1.0.0.jar app.jar
# preferIPv6Addresses: Railway private networking is IPv6; Java otherwise picks IPv4
# when a hostname resolves to both, which breaks *.railway.internal lookups.
ENV JAVA_OPTS="-Xmx400m -XX:+UseSerialGC -Djava.net.preferIPv6Addresses=true"
EXPOSE 8081
ENTRYPOINT ["sh","-c","java $JAVA_OPTS -jar app.jar"]
```

Heap sizes per service: gateway 320m, auth 400m, social 448m, marketplace 448m,
subscription 320m, notification 320m.

The build command is verified — `mvn -B -pl hustleup-auth -am package -DskipTests` builds
Parent → Common → Auth and produces `hustleup-auth-1.0.0.jar` in ~20s locally.

Three details that matter:

- **`-Djava.net.preferIPv6Addresses=true`** — Railway's private network is IPv6. Java
  otherwise prefers IPv4 addresses when a hostname resolves to both, which on legacy
  Railway environments (IPv6-only DNS) means the gateway can't reach anything.
- **`-XX:+UseSerialGC`** cuts JVM memory overhead noticeably at these heap sizes, and you
  are billed for that overhead.
- **The jar version `1.0.0`** comes from the parent POM. If you bump it, these break —
  check `ls */target/*.jar` after a local build.

Verify one builds before pushing:

```powershell
docker build -f hustleup-auth/Dockerfile -t hustleup-auth-test .
```

---

## Step 2 — Make the gateway routes environment-driven

Every route URI is hardcoded to `http://localhost:808x`. Rather than replacing them with
`.railway.internal` (which would break local development), give each a variable with the
current value as its default.

```powershell
$f = "hustleup-gateway/src/main/resources/application.yml"
$c = Get-Content $f -Raw
$c = $c -replace 'uri: http://localhost:8081', 'uri: $${AUTH_URI:http://localhost:8081}'
$c = $c -replace 'uri: http://localhost:8082', 'uri: $${SOCIAL_URI:http://localhost:8082}'
$c = $c -replace 'uri: http://localhost:8083', 'uri: $${MARKETPLACE_URI:http://localhost:8083}'
$c = $c -replace 'uri: http://localhost:8084', 'uri: $${SUBSCRIPTION_URI:http://localhost:8084}'
$c = $c -replace 'uri: http://localhost:8085', 'uri: $${NOTIFICATION_URI:http://localhost:8085}'
Set-Content $f $c -Encoding utf8
```

> The `$$` is not a typo. PowerShell's `-replace` treats `${name}` in the replacement as
> a regex named-group reference, so a literal `$` must be written `$$`. Check the result:
> the file should contain `uri: ${AUTH_URI:http://localhost:8081}`, single dollar sign.

Running the gateway locally with no variables set now behaves exactly as before.

---

## Step 3 — Create the project and the two datastores

```powershell
railway init --name hustleup
```

In the dashboard, **+ New → Database → Add MySQL**, then again for **Redis**. Name them
exactly `MySQL` and `Redis` — the variable references in Step 5 use those names.

Railway provisions each with a volume. On Hobby that volume maxes at 5 GB.

---

## Step 4 — Create the six application services

For each of the six, in the Railway dashboard: **+ New → GitHub Repo →** your repo, then
open its **Settings** and set:

| Setting | Value |
|---|---|
| Service Name | `hustleup-auth` (etc. — must match exactly, private DNS uses it) |
| Root Directory | `backend` |
| Dockerfile Path | `hustleup-auth/Dockerfile` |
| Watch Paths | `hustleup-auth/**`, `hustleup-common/**`, `pom.xml` |
| Healthcheck Path | **leave blank** (see note below) |
| Restart Policy | `ALWAYS` |

**Watch paths are the money-saver here.** Without them, every push rebuilds all six
services — six full Maven builds per commit, billed as build minutes. With them, a change
under `hustleup-marketplace/` rebuilds only that one. Anything touching
`hustleup-common/` correctly rebuilds all six.

**On the healthcheck — leave it blank for now.** None of the six modules has
`spring-boot-starter-actuator`, and there is no `/health` controller anywhere in the
codebase, so *any* healthcheck path you enter today returns 404 and Railway will mark
every healthy deploy as failed and roll it back. With the field blank, Railway treats a
deploy as live once the process starts.

Adding actuator afterwards is worth doing, but do it as its own change, not during the
first deploy: add `spring-boot-starter-actuator` to each module, confirm
[CommonSecurityConfig](backend/hustleup-common/src/main/java/com/hustleup/common/security/CommonSecurityConfig.java)
permits `/actuator/health` unauthenticated (otherwise it 401s and you're back to failing
deploys), then set the path in Railway.

**Notification only:** set Replicas to **1** and leave it there.

---

## Step 5 — Set shared variables

In the project's **Variables** tab (shared across all services), add:

```
JWT_SECRET=<generate a new one — see below>
FRONTEND_URL=https://hustleup.app
AWS_ACCESS_KEY_ID=<your IAM key>
AWS_SECRET_ACCESS_KEY=<your IAM secret>
AWS_REGION=eu-central-1
AWS_S3_BUCKET=hustle-up-prod
CDN_DOMAIN=
SENTRY_ENV=production
SENTRY_DSN=
RESEND_API_KEY=
EMAIL_FROM=HustleUp <notifications@hustleup.app>
```

Generate a fresh JWT secret. The dev one in `backend/.env` should be treated as
compromised — the comment in [start-services.ps1](backend/start-services.ps1) notes it was
committed to git at one point, and a leaked signing key lets anyone mint valid tokens for
any account:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Max 256 }))
```

Then in **each of the six services'** variable tabs, reference the shared set plus the
database. These are the ones that make the hardcoded `localhost:3306` datasource point at
Railway's MySQL — Spring Boot's relaxed binding maps `SPRING_DATASOURCE_URL` onto
`spring.datasource.url`, overriding the YAML without editing five modules:

```
SPRING_DATASOURCE_URL=jdbc:mysql://${{MySQL.RAILWAY_PRIVATE_DOMAIN}}:3306/${{MySQL.MYSQLDATABASE}}?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true
SPRING_DATASOURCE_USERNAME=${{MySQL.MYSQLUSER}}
SPRING_DATASOURCE_PASSWORD=${{MySQL.MYSQLPASSWORD}}
SPRING_JPA_HIBERNATE_DDL_AUTO=validate
SERVER_ADDRESS=::
SERVER_PORT=8081
```

Adjust `SERVER_PORT` per service (8000/8081/8082/8083/8084/8085).

Two notes:

- **`RAILWAY_PRIVATE_DOMAIN`, not `MYSQLHOST`.** The private domain keeps database traffic
  on the internal network. `MYSQLHOST` routes through Railway's public proxy, which is
  slower and bills egress at $0.05/GB.
- **`useSSL=false` is acceptable here** only because Railway's private network is an
  encrypted WireGuard mesh. Do not carry this setting over to a public database host.

**Social service** additionally needs Redis:

```
REDIS_HOST=${{Redis.RAILWAY_PRIVATE_DOMAIN}}
REDIS_PORT=6379
SPRING_DATA_REDIS_PASSWORD=${{Redis.REDISPASSWORD}}
```

`SPRING_DATA_REDIS_PASSWORD` isn't in the YAML — it doesn't need to be. Relaxed binding
picks up any Spring property from the environment, and Railway's Redis requires auth
whereas your local one doesn't.

**Marketplace and subscription** need Stripe:

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...              # subscription
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...      # marketplace
STRIPE_PLATFORM_FEE_PERCENT=8
ALGOLIA_APP_ID=
ALGOLIA_ADMIN_KEY=
```

**Auth** needs the sign-in providers:

```
GOOGLE_CLIENT_ID=
GOOGLE_MAPS_SERVER_KEY=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
TURNSTILE_SECRET_KEY=
```

---

## Step 6 — Wire the gateway to the internal network

On the **gateway service only**, add the route variables from Step 2 plus its CORS and
proxy settings:

```
AUTH_URI=http://hustleup-auth.railway.internal:8081
SOCIAL_URI=http://hustleup-social.railway.internal:8082
MARKETPLACE_URI=http://hustleup-marketplace.railway.internal:8083
SUBSCRIPTION_URI=http://hustleup-subscription.railway.internal:8084
NOTIFICATION_URI=http://hustleup-notification.railway.internal:8085

CORS_ALLOWED_ORIGINS=https://hustleup.app,https://www.hustleup.app
APP_GATEWAY_TRUST_PROXY=true
SERVER_PORT=8000
SERVER_ADDRESS=::
```

`APP_GATEWAY_TRUST_PROXY=true` is correct and necessary here — Railway's edge proxy sets
`X-Forwarded-For`. Left at `false`, every request appears to originate from the proxy and
the rate limiter throttles your entire userbase as a single client.

### The IPv6 binding gotcha

`SERVER_ADDRESS=::` is the single most likely thing to trip you up. Railway's private
network runs over IPv6, and Spring Boot allows exactly one `server.address` — you cannot
bind `::` and `0.0.0.0` simultaneously. Environments created after 16 October 2025 resolve
internal DNS to both IPv4 and IPv6, so the default binding may work; older ones are
IPv6-only and will not.

Set `::` on all six. On Linux this also accepts IPv4-mapped connections, so it's the safe
universal choice. If the gateway's public domain returns 502 after deploying, this is the
first thing to check.

### Public domain

On the gateway: **Settings → Networking → Generate Domain**, target port **8000**. That
gives you `hustleup-gateway-production.up.railway.app`. Add your custom domain
(`api.hustleup.app`) there too — Railway provisions the certificate automatically, with no
ALB to pay for.

Do **not** generate domains for the other five.

---

## Step 7 — First deploy and schema creation

Every service ships `spring.jpa.hibernate.ddl-auto: update`. Against an empty Railway
MySQL you want that exactly once, to create the tables. After that it's a liability —
`update` never drops or narrows anything, so your schema silently drifts from your
entities.

Set on **one** service (auth) temporarily:

```
SPRING_JPA_HIBERNATE_DDL_AUTO=update
```

Deploy auth alone, confirm the tables exist, then set it back to `validate` and deploy the
rest. `validate` fails fast on boot when the schema doesn't match — which is the signal you
want *before* a bad deploy starts serving traffic.

Migrating existing data from local MySQL:

```powershell
mysqldump -u root -p hustleup > hustleup.sql
railway connect MySQL          # opens a mysql shell against the Railway instance
```

```
source hustleup.sql
```

Adding Flyway to `hustleup-common` is the correct next step for schema changes, and worth
doing before you have real user data.

---

## Step 8 — Deploy order

Databases first, then the five internal services, then the gateway:

```powershell
railway up --service hustleup-auth
railway up --service hustleup-social
railway up --service hustleup-marketplace
railway up --service hustleup-subscription
railway up --service hustleup-notification
railway up --service hustleup-gateway
```

Or just push to GitHub — with watch paths configured, Railway builds what changed.

Expect the first build of each service to take 3–5 minutes (full Maven dependency
download). Subsequent builds hit the layer cache and are much faster.

---

## Step 9 — S3 is now mandatory

On AWS this was optional because all six services shared a filesystem. On Railway they
don't, and a Railway volume attaches to exactly one service — so a file uploaded via
marketplace is invisible to auth, which is the service that serves `/uploads/**` back to
the browser. Images would 404 despite existing.

Follow [S3_SETUP.md](backend/S3_SETUP.md), with two production changes:

- **CORS `AllowedOrigins`**: replace `["*"]` with your real frontend origins. A wildcard
  lets any site read your bucket's responses from a visitor's browser.
- **Scope the IAM policy** to `s3:PutObject`/`GetObject`/`DeleteObject` on
  `arn:aws:s3:::hustle-up-prod/*` rather than `AmazonS3FullAccess`.

The upload code switches to S3 when `AWS_ACCESS_KEY_ID` is set (per `S3_SETUP.md`), so
setting the shared variables in Step 5 is what activates it. **Verify by uploading an
avatar and checking the returned URL** — an S3 URL means it worked; a local path means
you're writing to ephemeral container storage that vanishes on every redeploy.

Any images currently on your local disk need a one-time copy up:

```powershell
aws s3 sync ./uploads s3://hustle-up-prod/uploads/
```

---

## Step 10 — Add the missing WebSocket route

The notification service registers a STOMP endpoint at `/ws`, but the gateway has no route
for it. Locally the frontend probably connects to `localhost:8085` directly; on Railway
only the gateway is public, so real-time messaging fails silently.

Add to `routes` in the gateway YAML:

```yaml
        - id: notification-websocket
          uri: ${NOTIFICATION_URI:http://localhost:8085}
          predicates:
            - Path=/ws/**
```

Also tighten `setAllowedOriginPatterns("*")` in
[WebSocketConfig.java](backend/hustleup-notification/src/main/java/com/hustleup/notification/config/WebSocketConfig.java)
to your real origins — same reasoning as the gateway CORS restriction.

Railway's proxy supports WebSocket upgrades with no extra configuration, and there's no
60-second idle timeout to raise as there was with the ALB.

---

## Step 11 — Point Stripe and the frontend at Railway

**Stripe webhooks** — two separate endpoints, since the code expects distinct secrets:

- `https://api.hustleup.app/api/v1/payments/webhook` — subscription events
- `https://api.hustleup.app/api/v1/payouts/webhook` — Connect events (`account.updated`,
  `payment_intent.*`, `transfer.*`)

Confirm the exact paths against the controllers before saving, then copy each signing
secret into the right service's variables.

**Frontend** — repoint the API base URL to `https://api.hustleup.app` and rebuild. Whatever
origin serves the frontend must appear in `CORS_ALLOWED_ORIGINS`; the gateway no longer
accepts `*`, so a missing entry surfaces as CORS errors on every call.

---

## Step 12 — Verify

```powershell
railway logs --service hustleup-gateway
curl -i https://api.hustleup.app/api/v1/listings
```

Then walk the real paths: register a user, upload an avatar (**check the URL is S3**),
create a listing, open a chat to exercise the WebSocket, and fire a Stripe test webhook.

Watch the **Metrics** tab for the first day. If a service sits well below its `-Xmx`, trim
the heap in its Dockerfile — that's money back every month.

---

## Troubleshooting

**Gateway returns 502 on the public domain.**
`SERVER_ADDRESS=::` missing or the target port isn't 8000. Check Settings → Networking.

**Gateway returns 503 for a specific route.**
That service is down, or the `*_URI` variable has the wrong service name/port. The private
hostname must match the Railway service name exactly.

**`UnknownHostException: hustleup-auth.railway.internal`.**
Java resolved IPv4-only. Confirm `-Djava.net.preferIPv6Addresses=true` is in that service's
`JAVA_OPTS` — it's set in the Dockerfile, but an env-var override of `JAVA_OPTS` would drop it.

**Kafka connection errors in the social service logs.**
Expected. [application.yml](backend/hustleup-social/src/main/resources/application.yml) sets
`spring.kafka.admin.fail-fast: false` with a 500ms `max.block.ms`, so the service starts and
runs fine — it's log noise, not a failure. Remove the Kafka dependency or point
`KAFKA_SERVERS` at a real broker when you actually need events.

**Deploy fails with `Schema-validation: missing table`.**
`ddl-auto` is `validate` against a schema that was never created. Re-run Step 7.

**All six services rebuild on every push.**
Watch paths aren't set, or are set relative to the repo root instead of the `backend` root
directory. This is billed build time — fix it.

**Bill higher than expected.**
Metrics tab → find the service with the largest RSS → lower its `-Xmx`. Also confirm you're
using `RAILWAY_PRIVATE_DOMAIN` for MySQL rather than `MYSQLHOST`, which bills egress.

---

## Redeploying

Push to GitHub; watch paths decide what rebuilds. Or target one service:

```powershell
railway up --service hustleup-marketplace
```

Anything touching `hustleup-common/` rebuilds all six — expected, since they all embed it.

Rollback is in the dashboard under each service's **Deployments** tab. On Hobby, images
are retained for **72 hours**, so a rollback older than that requires a rebuild from git.

---

## Known gaps to revisit

| Gap | Impact | When to fix |
|---|---|---|
| Notification pinned to 1 replica | Real-time messaging can't scale horizontally | Before meaningful concurrent chat load — needs a STOMP relay (Redis pub/sub or Amazon MQ) instead of `enableSimpleBroker` |
| 5 GB volume cap on Hobby | MySQL ceiling | Upgrade to Pro (1 TB) when you approach it |
| No Flyway | Schema changes are manual | Before you have user data worth losing |
| Railway MySQL backups | Not RDS-grade PITR | Add a scheduled `mysqldump` to S3 |
| `ddl-auto` still `update` in YAML | A missing env override silently re-enables schema mutation | Change the default in all six YAMLs to `validate` |
