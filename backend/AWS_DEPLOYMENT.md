# Deploying the HustleUp Backend to AWS

A step-by-step guide for getting the six Spring Boot services running on AWS.

**Target architecture (Phase 1):** one EC2 instance running all six JVMs, an RDS MySQL
database, Redis on the same EC2 box, S3 for uploads, and an Application Load Balancer
terminating HTTPS in front of the gateway.

This is deliberately the simplest architecture that works for this codebase. See
[Appendix C](#appendix-c--moving-to-ecs-fargate-later) for what to change when you
outgrow it.

---

## What you are deploying

| Service | Module | Port | Notes |
|---|---|---|---|
| Gateway | `hustleup-gateway` | 8000 | Spring Cloud Gateway, the only public entry point |
| Auth | `hustleup-auth` | 8081 | Also serves `/uploads/**` back to the browser |
| Social | `hustleup-social` | 8082 | Needs Redis; Kafka optional |
| Marketplace | `hustleup-marketplace` | 8083 | Stripe Connect, Algolia |
| Subscription | `hustleup-subscription` | 8084 | Stripe subscriptions |
| Notification | `hustleup-notification` | 8085 | WebSocket/STOMP at `/ws` |

All six share **one** MySQL schema (`hustleup`). Java 21, Spring Boot 3.4.3, Maven
multi-module build rooted at [backend/pom.xml](backend/pom.xml).

### Read this before you start

Five things in the current code will bite you on AWS. Each is addressed in the steps
below, but know about them up front:

1. **`spring.jpa.hibernate.ddl-auto: update`** is set in every service. Hibernate will
   alter your production schema on every boot. Step 9 covers turning this off.
2. **Datasource URLs are hardcoded** to `jdbc:mysql://localhost:3306/hustleup?useSSL=false`
   with `username: root`. You override these with environment variables (Step 6) rather
   than editing five YAML files.
3. **`UPLOAD_DIR` is a shared local directory.** All six services write to it, but only
   auth serves it back. This only works while they share a filesystem — which on a
   single EC2 instance they do. Use S3 instead (Step 7) so this stops being a constraint.
4. **The `/ws` WebSocket endpoint is not routed through the gateway.** There is no route
   for it in [application.yml](backend/hustleup-gateway/src/main/resources/application.yml).
   Step 12 adds one.
5. **The notification service uses an in-memory STOMP broker.** You can run exactly one
   instance of it. Scaling it needs a real broker — see Appendix C.

Also: `backend/docker-compose.yml` sets up Kong. Nothing uses it — Spring Cloud Gateway
is the actual gateway. Ignore that file; don't deploy it.

---

## Step 0 — Prerequisites

On your laptop:

```powershell
aws --version          # AWS CLI v2
java -version          # 21
mvn -version           # 3.9+
```

Configure credentials for an admin-ish IAM user (this is your deploy identity, separate
from the app's runtime IAM role):

```powershell
aws configure
# AWS Access Key ID, Secret, region (pick one and use it everywhere — e.g. eu-central-1), json
```

Pick your region now and stay in it. Cross-region traffic between EC2 and RDS costs money
and adds latency for no benefit here.

---

## Step 1 — Create the VPC and security groups

You can use the default VPC to start. Create three security groups:

```powershell
# Get your default VPC id
$VPC = aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text

# 1. ALB — public HTTPS
$SG_ALB = aws ec2 create-security-group --group-name hustleup-alb --description "HustleUp ALB" --vpc-id $VPC --query GroupId --output text
aws ec2 authorize-security-group-ingress --group-id $SG_ALB --protocol tcp --port 443 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SG_ALB --protocol tcp --port 80 --cidr 0.0.0.0/0

# 2. App server — gateway port from the ALB only, SSH from your IP only
$SG_APP = aws ec2 create-security-group --group-name hustleup-app --description "HustleUp app server" --vpc-id $VPC --query GroupId --output text
aws ec2 authorize-security-group-ingress --group-id $SG_APP --protocol tcp --port 8000 --source-group $SG_ALB
$MYIP = (Invoke-RestMethod https://checkip.amazonaws.com).Trim()
aws ec2 authorize-security-group-ingress --group-id $SG_APP --protocol tcp --port 22 --cidr "$MYIP/32"

# 3. Database — MySQL from the app server only
$SG_DB = aws ec2 create-security-group --group-name hustleup-db --description "HustleUp RDS" --vpc-id $VPC --query GroupId --output text
aws ec2 authorize-security-group-ingress --group-id $SG_DB --protocol tcp --port 3306 --source-group $SG_APP
```

Note what is **not** open: ports 8081–8085 take no inbound traffic at all. Those services
are reached only over loopback by the gateway on the same box. Do not open them.

---

## Step 2 — Create the RDS MySQL database

```powershell
aws rds create-db-instance `
  --db-instance-identifier hustleup-db `
  --db-instance-class db.t4g.micro `
  --engine mysql `
  --engine-version 8.0 `
  --master-username hustleup `
  --manage-master-user-password `
  --allocated-storage 20 `
  --max-allocated-storage 100 `
  --storage-type gp3 `
  --vpc-security-group-ids $SG_DB `
  --backup-retention-period 7 `
  --no-publicly-accessible `
  --db-name hustleup
```

`--manage-master-user-password` stores the password in Secrets Manager and rotates it —
better than typing one in. Note the master username is `hustleup`, **not** `root`; the
YAML defaults assume root, which you override in Step 6.

Wait for it, then grab the endpoint and the secret:

```powershell
aws rds wait db-instance-available --db-instance-identifier hustleup-db

aws rds describe-db-instances --db-instance-identifier hustleup-db `
  --query "DBInstances[0].[Endpoint.Address,MasterUserSecret.SecretArn]" --output text
```

Save both. The endpoint looks like `hustleup-db.abc123.eu-central-1.rds.amazonaws.com`.

Retrieve the generated password when you need it:

```powershell
aws secretsmanager get-secret-value --secret-id <the-secret-arn> --query SecretString --output text
```

---

## Step 3 — Create the S3 bucket for uploads

[S3_SETUP.md](backend/S3_SETUP.md) already covers the bucket policy and CORS. Follow it,
with two changes for production:

- **CORS `AllowedOrigins`**: replace `["*"]` with your real frontend origin(s), e.g.
  `["https://hustleup.app"]`. A wildcard here lets any site read your bucket's responses
  from a visitor's browser.
- **Don't create an IAM access key.** Step 4 attaches a role to the instance instead, so
  there is no long-lived secret to leak.

```powershell
aws s3api create-bucket --bucket hustle-up-prod --region eu-central-1 `
  --create-bucket-configuration LocationConstraint=eu-central-1
```

Apply the public-read bucket policy and the CORS config from `S3_SETUP.md`, substituting
your bucket name.

---

## Step 4 — Create the instance IAM role

This is how the app gets S3 access without an access key in a file.

```powershell
@'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}
'@ | Set-Content trust.json

aws iam create-role --role-name hustleup-app-role --assume-role-policy-document file://trust.json

@'
{"Version":"2012-10-17","Statement":[
  {"Effect":"Allow","Action":["s3:PutObject","s3:GetObject","s3:DeleteObject"],"Resource":"arn:aws:s3:::hustle-up-prod/*"},
  {"Effect":"Allow","Action":["secretsmanager:GetSecretValue"],"Resource":"*"}
]}
'@ | Set-Content s3policy.json

aws iam put-role-policy --role-name hustleup-app-role --policy-name hustleup-app-access --policy-document file://s3policy.json

aws iam create-instance-profile --instance-profile-name hustleup-app-profile
aws iam add-role-to-instance-profile --instance-profile-name hustleup-app-profile --role-name hustleup-app-role
```

Because the role provides credentials, you leave `AWS_ACCESS_KEY_ID` **blank** in the
env file — the AWS SDK picks up the instance role automatically.

> ⚠️ One catch: the upload code checks whether `AWS_ACCESS_KEY_ID` is set to decide
> between S3 and local storage (see `S3_SETUP.md`, "How it works"). If it falls back to
> local storage with the key blank, you have two options: set the key/secret explicitly
> from an IAM user, or change that check to always use S3 in production. Verify which
> path it took by uploading an image and looking at the returned URL.

---

## Step 5 — Launch the EC2 instance

`t3.small` (2 GB) is too small for six JVMs. Start at **`t3.medium` (4 GB)** and watch
memory; Step 8 caps each heap to make it fit.

```powershell
aws ec2 create-key-pair --key-name hustleup-key --query KeyMaterial --output text | Set-Content hustleup-key.pem

aws ec2 run-instances `
  --image-id resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 `
  --instance-type t3.medium `
  --key-name hustleup-key `
  --security-group-ids $SG_APP `
  --iam-instance-profile Name=hustleup-app-profile `
  --block-device-mappings "DeviceName=/dev/xvda,Ebs={VolumeSize=30,VolumeType=gp3}" `
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=hustleup-app}]"
```

Get the public IP and SSH in:

```powershell
aws ec2 describe-instances --filters "Name=tag:Name,Values=hustleup-app" "Name=instance-state-name,Values=running" `
  --query "Reservations[0].Instances[0].PublicIpAddress" --output text

ssh -i hustleup-key.pem ec2-user@<public-ip>
```

Install the runtime dependencies on the instance:

```bash
sudo dnf update -y
sudo dnf install -y java-21-amazon-corretto-headless redis6 git
sudo systemctl enable --now redis6
sudo mkdir -p /opt/hustleup/{bin,uploads,logs}
sudo chown -R ec2-user:ec2-user /opt/hustleup
```

Redis runs locally on 6379, which matches the `REDIS_HOST` default. That's fine for one
instance — move it to ElastiCache when you add a second.

Java only — no Maven needed on the server, because you build locally and ship jars.

---

## Step 6 — Write the production environment file

On the instance, create `/opt/hustleup/hustleup.env`. This is the single most important
file in the deployment; it is what makes the hardcoded `localhost` datasource point at
RDS instead.

```bash
cat > /opt/hustleup/hustleup.env <<'EOF'
# ── Database (overrides the hardcoded localhost URL in every service's YAML) ──
SPRING_DATASOURCE_URL=jdbc:mysql://hustleup-db.abc123.eu-central-1.rds.amazonaws.com:3306/hustleup?useSSL=true&requireSSL=true&serverTimezone=UTC
SPRING_DATASOURCE_USERNAME=hustleup
SPRING_DATASOURCE_PASSWORD=<from-secrets-manager>

# Do NOT let Hibernate alter the production schema. See Step 9.
SPRING_JPA_HIBERNATE_DDL_AUTO=validate

# ── JWT — generate a NEW one, do not reuse the dev secret ──
JWT_SECRET=<64-char-random-string>

# ── AWS ──
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=eu-central-1
AWS_S3_BUCKET=hustle-up-prod
CDN_DOMAIN=

# ── URLs and CORS ──
FRONTEND_URL=https://hustleup.app
CORS_ALLOWED_ORIGINS=https://hustleup.app,https://www.hustleup.app

# TRUE here is correct and required: the gateway sits behind an ALB that overwrites
# X-Forwarded-For. Left false, every request appears to come from the ALB's IP and the
# rate limiter throttles all your users as one client.
APP_GATEWAY_TRUST_PROXY=true

# ── Uploads (local fallback path; S3 is the real target) ──
UPLOAD_DIR=/opt/hustleup/uploads

# ── Redis (local on this box) ──
REDIS_HOST=localhost
REDIS_PORT=6379

# ── Stripe — LIVE keys ──
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...

# ── Third parties ──
SENTRY_DSN=
SENTRY_ENV=production
RESEND_API_KEY=
EMAIL_FROM=HustleUp <notifications@hustleup.app>
GOOGLE_CLIENT_ID=
GOOGLE_MAPS_SERVER_KEY=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
TURNSTILE_SECRET_KEY=
ALGOLIA_APP_ID=
ALGOLIA_ADMIN_KEY=
EOF

chmod 600 /opt/hustleup/hustleup.env
```

Two things worth understanding here:

- **`SPRING_DATASOURCE_URL` works without touching any YAML.** Spring Boot's relaxed
  binding maps that environment variable onto `spring.datasource.url`, overriding the
  file. Same for username and password. This is why you don't have to edit five modules.
- **`requireSSL=true`** replaces the dev `useSSL=false`. Traffic between EC2 and RDS
  crosses the VPC network; encrypt it.

Generate a fresh JWT secret — the dev one in `backend/.env` should be treated as
compromised (it was committed to git at one point, per the note in
[start-services.ps1](backend/start-services.ps1)):

```bash
openssl rand -base64 48
```

---

## Step 7 — Build the jars locally and upload them

From `backend/` on your laptop:

```powershell
mvn clean package -DskipTests
```

That produces one jar per module under `<module>/target/`. Ship them:

```powershell
$IP = "<public-ip>"
scp -i hustleup-key.pem `
  hustleup-gateway/target/hustleup-gateway-1.0.0.jar `
  hustleup-auth/target/hustleup-auth-1.0.0.jar `
  hustleup-social/target/hustleup-social-1.0.0.jar `
  hustleup-marketplace/target/hustleup-marketplace-1.0.0.jar `
  hustleup-subscription/target/hustleup-subscription-1.0.0.jar `
  hustleup-notification/target/hustleup-notification-1.0.0.jar `
  ec2-user@${IP}:/opt/hustleup/bin/
```

> If the jar filenames differ, check `ls */target/*.jar` — the version comes from
> `<version>1.0.0</version>` in the parent POM.

Building locally rather than on the server keeps the instance small and means a bad
build never reaches production. Appendix B shows how to automate this with CodeDeploy.

---

## Step 8 — Create systemd units

One unit per service, so they restart on crash and start on boot. On the instance:

```bash
for svc in gateway:8000:1024 auth:8081:768 social:8082:768 marketplace:8083:768 subscription:8084:512 notification:8085:512; do
  name="${svc%%:*}"; rest="${svc#*:}"; port="${rest%%:*}"; mem="${rest##*:}"
  sudo tee /etc/systemd/system/hustleup-$name.service > /dev/null <<EOF
[Unit]
Description=HustleUp $name service
After=network.target

[Service]
User=ec2-user
WorkingDirectory=/opt/hustleup
EnvironmentFile=/opt/hustleup/hustleup.env
ExecStart=/usr/bin/java -Xmx${mem}m -XX:+UseSerialGC -jar /opt/hustleup/bin/hustleup-$name-1.0.0.jar
SuccessExitStatus=143
Restart=always
RestartSec=10
StandardOutput=append:/opt/hustleup/logs/$name.log
StandardError=append:/opt/hustleup/logs/$name.log

[Install]
WantedBy=multi-user.target
EOF
done

sudo systemctl daemon-reload
```

The heap caps total about 4.1 GB of `-Xmx` on a 4 GB box. That's intentional — JVMs
rarely all peak at once — but if you see the OOM killer in `dmesg`, either move to
`t3.large` or trim the caps. `-XX:+UseSerialGC` meaningfully reduces memory overhead for
small heaps.

Start in dependency order — gateway last, since it's the front door:

```bash
sudo systemctl enable --now hustleup-auth hustleup-social hustleup-marketplace hustleup-subscription hustleup-notification
sleep 45
sudo systemctl enable --now hustleup-gateway

systemctl status 'hustleup-*' --no-pager
```

---

## Step 9 — Handle the schema, and turn off `ddl-auto`

Every service currently ships `ddl-auto: update`. On a first deploy against an empty RDS
database you actually *want* that once, to create the tables. After that it becomes a
liability: any entity change silently alters production tables, and `update` never drops
or narrows anything, so your schema drifts from your model.

**First boot only** — temporarily set in `hustleup.env`:

```
SPRING_JPA_HIBERNATE_DDL_AUTO=update
```

Start the services, confirm the tables exist, then **change it to `validate` and
restart**:

```bash
sudo sed -i 's/DDL_AUTO=update/DDL_AUTO=validate/' /opt/hustleup/hustleup.env
sudo systemctl restart 'hustleup-*'
```

`validate` fails fast on boot if the schema doesn't match the entities — which is exactly
the signal you want before a bad deploy starts serving traffic.

For migrations from here on, add Flyway to `hustleup-common`. That's beyond this guide,
but it is the correct next step and worth doing before you have real user data.

If you're migrating existing data from your local MySQL:

```powershell
mysqldump -u root -p hustleup > hustleup.sql
scp -i hustleup-key.pem hustleup.sql ec2-user@${IP}:/tmp/
```

```bash
sudo dnf install -y mariadb105
mysql -h <rds-endpoint> -u hustleup -p hustleup < /tmp/hustleup.sql
```

---

## Step 10 — Put an ALB in front with HTTPS

Request a certificate first (DNS validation; add the CNAME it gives you at your registrar):

```powershell
aws acm request-certificate --domain-name api.hustleup.app --validation-method DNS
```

Create the load balancer and target group:

```powershell
$SUBNETS = aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC" --query "Subnets[*].SubnetId" --output text

aws elbv2 create-load-balancer --name hustleup-alb --subnets $SUBNETS.Split() --security-groups $SG_ALB --type application

aws elbv2 create-target-group --name hustleup-gw-tg --protocol HTTP --port 8000 --vpc-id $VPC `
  --health-check-path /api/v1/auth/health --health-check-interval-seconds 30 --target-type instance
```

> Check that a health endpoint actually exists. If `/api/v1/auth/health` returns 404, add
> `spring-boot-starter-actuator` to the gateway and point the health check at
> `/actuator/health` — otherwise the ALB will mark a perfectly healthy instance as failed
> and stop routing to it.

Register the instance, create the listeners:

```powershell
$INSTANCE = aws ec2 describe-instances --filters "Name=tag:Name,Values=hustleup-app" "Name=instance-state-name,Values=running" --query "Reservations[0].Instances[0].InstanceId" --output text
$TG = aws elbv2 describe-target-groups --names hustleup-gw-tg --query "TargetGroups[0].TargetGroupArn" --output text
$ALB = aws elbv2 describe-load-balancers --names hustleup-alb --query "LoadBalancers[0].LoadBalancerArn" --output text
$CERT = aws acm list-certificates --query "CertificateSummaryList[?DomainName=='api.hustleup.app'].CertificateArn" --output text

aws elbv2 register-targets --target-group-arn $TG --targets Id=$INSTANCE

# HTTPS listener
aws elbv2 create-listener --load-balancer-arn $ALB --protocol HTTPS --port 443 `
  --certificates CertificateArn=$CERT `
  --default-actions Type=forward,TargetGroupArn=$TG

# HTTP → HTTPS redirect
aws elbv2 create-listener --load-balancer-arn $ALB --protocol HTTP --port 80 `
  --default-actions 'Type=redirect,RedirectConfig={Protocol=HTTPS,Port=443,StatusCode=HTTP_301}'
```

Point `api.hustleup.app` at the ALB's DNS name with a Route 53 alias record (or a CNAME
at your registrar):

```powershell
aws elbv2 describe-load-balancers --names hustleup-alb --query "LoadBalancers[0].DNSName" --output text
```

**Raise the idle timeout** — the default 60s will disconnect WebSocket clients:

```powershell
aws elbv2 modify-load-balancer-attributes --load-balancer-arn $ALB `
  --attributes Key=idle_timeout.timeout_seconds,Value=300
```

---

## Step 11 — Point Stripe and the frontend at the new API

**Stripe webhooks.** In the Stripe dashboard, create two endpoints (the code expects them
separately — `STRIPE_WEBHOOK_SECRET` and `STRIPE_CONNECT_WEBHOOK_SECRET` are distinct):

- `https://api.hustleup.app/api/v1/payments/webhook` — subscription events
- `https://api.hustleup.app/api/v1/payouts/webhook` — Connect events (`account.updated`,
  `payment_intent.*`, `transfer.*`)

Confirm the exact paths against the controllers before saving; copy each signing secret
into `hustleup.env` and restart.

**Frontend.** Repoint its API base URL from `http://localhost:8000` to
`https://api.hustleup.app` and rebuild. Whatever origin the frontend is served from must
appear in `CORS_ALLOWED_ORIGINS` — the gateway no longer accepts `*`, so a missing origin
shows up as CORS failures in the browser console on every call.

---

## Step 12 — Add the missing WebSocket route

The notification service registers a STOMP endpoint at `/ws`, but the gateway has no
route for it. Locally the frontend probably connects to `localhost:8085` directly; behind
the ALB only port 8000 is reachable, so real-time messaging will silently fail.

Add to `routes` in
[backend/hustleup-gateway/src/main/resources/application.yml](backend/hustleup-gateway/src/main/resources/application.yml):

```yaml
        - id: notification-websocket
          uri: http://localhost:8085
          predicates:
            - Path=/ws/**
```

Also tighten `setAllowedOriginPatterns("*")` in
[WebSocketConfig.java](backend/hustleup-notification/src/main/java/com/hustleup/notification/config/WebSocketConfig.java)
to your real origins — same reasoning as the gateway CORS fix. Then rebuild and redeploy
those two jars (Step 7, then `sudo systemctl restart hustleup-gateway hustleup-notification`).

---

## Step 13 — Verify

```bash
# On the instance: all six up?
systemctl is-active hustleup-gateway hustleup-auth hustleup-social hustleup-marketplace hustleup-subscription hustleup-notification

# Gateway reachable locally?
curl -i http://localhost:8000/api/v1/listings

# Any startup failures?
tail -n 100 /opt/hustleup/logs/*.log
```

From your laptop:

```powershell
curl -i https://api.hustleup.app/api/v1/listings
aws elbv2 describe-target-health --target-group-arn $TG   # should be "healthy"
```

Then walk the real paths: register a user, upload an avatar (check the returned URL is an
S3 URL, not a local path — that tells you whether the Step 4 caveat bit you), create a
listing, open a chat to test WebSocket, and fire a Stripe test webhook.

---

## Step 14 — Backups and monitoring

RDS automated backups are already on (7 days from Step 2). Add:

```powershell
# Alarm on high CPU
aws cloudwatch put-metric-alarm --alarm-name hustleup-cpu-high `
  --metric-name CPUUtilization --namespace AWS/EC2 --statistic Average `
  --period 300 --threshold 80 --comparison-operator GreaterThanThreshold `
  --evaluation-periods 2 --dimensions Name=InstanceId,Value=$INSTANCE
```

Install the CloudWatch agent to ship `/opt/hustleup/logs/*.log`, or rely on Sentry —
`SENTRY_DSN` is already wired into all six services, so setting it in `hustleup.env` gives
you error tracking for free.

Add log rotation so the disk doesn't fill:

```bash
sudo tee /etc/logrotate.d/hustleup > /dev/null <<'EOF'
/opt/hustleup/logs/*.log {
  daily
  rotate 14
  compress
  missingok
  notifempty
  copytruncate
}
EOF
```

---

## Redeploying

```powershell
# Local
mvn clean package -DskipTests
scp -i hustleup-key.pem hustleup-auth/target/hustleup-auth-1.0.0.jar ec2-user@${IP}:/opt/hustleup/bin/
```

```bash
# On the instance
sudo systemctl restart hustleup-auth
tail -f /opt/hustleup/logs/auth.log
```

Restart only what changed. Anything in `hustleup-common` means rebuilding and restarting
all six.

---

## Appendix A — Rough monthly cost

| Item | Spec | ~USD/month |
|---|---|---|
| EC2 | t3.medium on-demand | 30 |
| RDS | db.t4g.micro, 20 GB gp3 | 15 |
| ALB | 1 LB, low traffic | 18 |
| S3 | 50 GB + requests | 2 |
| Data transfer | modest | 5 |
| **Total** | | **~70** |

A 1-year EC2 Savings Plan and an RDS reserved instance cut the compute roughly in half.
The ALB is the least avoidable fixed cost; you can drop it and terminate TLS with Caddy or
nginx on the instance itself for about $18/month less, at the cost of doing your own
certificate renewal.

---

## Appendix B — Automating deploys

Once the manual path works, the smallest useful automation is a GitHub Actions workflow
that builds on push to `main` and pushes jars via CodeDeploy:

1. Create an S3 bucket for build artifacts.
2. Add the CodeDeploy agent to the instance and tag it for a deployment group.
3. Add an `appspec.yml` at the repo root with `ApplicationStop` / `AfterInstall` hooks
   that stop, copy, and restart the systemd units.
4. In the workflow, authenticate with an OIDC role (no long-lived keys), run
   `mvn package -DskipTests`, and call `aws deploy create-deployment`.

Keep the manual steps working. When a deploy pipeline breaks at 2am, `scp` plus
`systemctl restart` is what gets you back online.

---

## Appendix C — Moving to ECS Fargate later

The single-instance design holds up until roughly a few hundred concurrent users. The
signals that you've outgrown it: sustained CPU above 70%, the OOM killer in `dmesg`, or
wanting deploys with no downtime.

What has to change, in order of difficulty:

1. **Write Dockerfiles.** There are none today. Each is a ~10-line multi-stage build on
   `eclipse-temurin:21-jre-alpine`.
2. **Replace the gateway's `localhost` route URIs.** All 20-odd routes in the gateway
   YAML point at `http://localhost:808x`. On Fargate they become service-discovery names
   like `http://hustleup-auth.hustleup.local:8081`. This is a real edit, not an env var
   override — the list-index environment variable form is too fragile to rely on.
3. **Drop the shared `UPLOAD_DIR` entirely.** Separate containers no longer share a
   filesystem, so every upload path must go through S3, and auth's `/uploads/**` handler
   must serve redirects to S3/CloudFront rather than local files.
4. **Move Redis to ElastiCache.** Trivial — it's already an env var (`REDIS_HOST`).
5. **Fix the notification service's broker.** `enableSimpleBroker` is in-memory, so two
   instances can't see each other's subscriptions. You need either exactly one
   notification task, or a real STOMP relay (ElastiCache Redis pub/sub, or Amazon MQ).

Point 5 is the one that actually constrains scaling, and it's worth knowing about before
you plan the migration rather than during it.
