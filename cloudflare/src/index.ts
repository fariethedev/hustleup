/**
 * HustleUp edge Worker.
 *
 * Replaces hustleup-gateway: the route table, rate limits, CORS and security headers
 * below are ported from its application.yml, RateLimitFilter and SecurityHeadersFilter.
 * Everything that is not /api, /uploads or /ws is served from static assets by the
 * platform before this code runs (see run_worker_first in wrangler.jsonc).
 */
import { DurableObject } from "cloudflare:workers";

type ServiceName = "AUTH" | "SOCIAL" | "MARKETPLACE" | "SUBSCRIPTION" | "NOTIFICATION";

interface Env {
  ASSETS: Fetcher;
  AUTH: DurableObjectNamespace<SpringService>;
  SOCIAL: DurableObjectNamespace<SpringService>;
  MARKETPLACE: DurableObjectNamespace<SpringService>;
  SUBSCRIPTION: DurableObjectNamespace<SpringService>;
  NOTIFICATION: DurableObjectNamespace<SpringService>;
  AUTH_LIMITER: RateLimit;
  API_LIMITER: RateLimit;
  /** Where the API is served (api.hustlespace.space). */
  PUBLIC_URL: string;
  /** Where the web app is served (Vercel). Used in email links and allowed by CORS. */
  FRONTEND_URL: string;
  EXTRA_CORS_ORIGINS: string;
  // Secrets and vars are read by name when a container starts (see SHARED_KEYS).
  [key: string]: unknown;
}

const SERVICES: ServiceName[] = ["AUTH", "SOCIAL", "MARKETPLACE", "SUBSCRIPTION", "NOTIFICATION"];

// ── Routing (order matters: first match wins, exactly like the gateway) ───────────────

/** Matches `prefix` itself or anything below it, never `prefix-something`. */
const under = (path: string, ...prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(p + "/"));

interface Route { service: ServiceName; path: string }

function route(path: string): Route | null {
  // Upload namespaces owned by other services; a single file segment is rewritten to that
  // service's own /uploads/<file>, as the gateway's RewritePath did.
  const upload = path.match(/^\/uploads\/(social|marketplace|messages)(\/.*)?$/);
  if (upload) {
    const service: ServiceName =
      upload[1] === "social" ? "SOCIAL" : upload[1] === "marketplace" ? "MARKETPLACE" : "NOTIFICATION";
    const single = upload[2]?.match(/^\/([^/]+)$/);
    return { service, path: single ? `/uploads/${single[1]}` : path };
  }
  const to = (service: ServiceName): Route => ({ service, path });

  if (under(path, "/uploads")) return to("AUTH");
  if (under(path, "/api/v1/auth", "/api/v1/users")) return to("AUTH");
  if (under(path, "/api/v1/stories", "/api/v1/follows", "/api/v1/feed", "/api/v1/communities",
    "/api/v1/news", "/api/v1/dating")) return to("SOCIAL");
  if (under(path, "/api/v1/listings", "/api/v1/bookings", "/api/v1/reviews", "/api/v1/availability",
    "/api/v1/payouts", "/api/v1/feedback", "/api/v1/claims", "/api/v1/jobs")) return to("MARKETPLACE");
  if (under(path, "/api/v1/admin/orders") ||
    ["/api/v1/admin/jobs", "/api/v1/admin/marketplace-stats", "/api/v1/admin/sales", "/api/v1/admin/claims"].includes(path)) return to("MARKETPLACE");
  if (under(path, "/api/v1/admin/reports")) return to("SOCIAL");
  if (under(path, "/api/v1/admin", "/api/v1/publishers")) return to("AUTH");
  if (under(path, "/api/v1/shops", "/api/v1/swaps", "/api/v1/leaderboard", "/api/v1/tickets")) return to("MARKETPLACE");
  if (under(path, "/api/v1/payments", "/api/payments", "/api/v1/subscriptions")) return to("SUBSCRIPTION");
  if (under(path, "/api/v1/notifications", "/api/v1/direct-messages", "/api/v1/messages", "/ws")) return to("NOTIFICATION");
  return null;
}

// ── CORS (gateway globalcors) ──────────────────────────────────────────────────────────

const CORS_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD";
const CORS_HEADERS = "Authorization, Content-Type, Accept, Origin, X-Requested-With";

function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const allowed = [new URL(env.PUBLIC_URL).origin, new URL(env.FRONTEND_URL).origin, new URL(request.url).origin,
    ...env.EXTRA_CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)];
  return allowed.includes(origin) ? origin : null;
}

// ── Security headers (SecurityHeadersFilter) — API responses only, never the SPA ──────

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy":
    "default-src 'none'; img-src 'self' data:; media-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const target = route(url.pathname);
    if (!target) {
      return url.pathname.startsWith("/api/") || url.pathname.startsWith("/ws")
        ? Response.json({ error: "Not found" }, { status: 404 })
        : env.ASSETS.fetch(request);
    }

    const origin = allowedOrigin(request, env);
    if (request.method === "OPTIONS" && request.headers.has("Access-Control-Request-Method")) {
      if (!origin) return new Response("Invalid CORS request", { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": CORS_METHODS,
          "Access-Control-Allow-Headers": CORS_HEADERS,
          "Access-Control-Max-Age": "3600",
          Vary: "Origin",
        },
      });
    }

    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const isAuth = under(url.pathname, "/api/v1/auth");
    const { success } = await (isAuth ? env.AUTH_LIMITER : env.API_LIMITER).limit({ key: ip });
    if (!success) {
      return new Response("Too Many Requests", { status: 429, headers: { "Retry-After": "1" } });
    }

    // Forward with the client address the services would have seen behind the gateway.
    const upstream = new URL(request.url);
    upstream.pathname = target.path;
    const forwarded = new Request(upstream, request);
    forwarded.headers.set("X-Forwarded-For", ip);
    forwarded.headers.set("X-Forwarded-Proto", "https");
    forwarded.headers.set("X-Forwarded-Host", url.host);

    const stub = (env[target.service] as DurableObjectNamespace<SpringService>).getByName("main");
    const response = await stub.fetch(forwarded);

    // A WebSocket upgrade must be returned untouched.
    if (response.status === 101 || response.webSocket) return response;

    const out = new Response(response.body, response);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      if (!out.headers.has(name)) out.headers.set(name, value);
    }
    if (origin) {
      out.headers.set("Access-Control-Allow-Origin", origin);
      out.headers.set("Access-Control-Expose-Headers", "Authorization");
      out.headers.append("Vary", "Origin");
    }
    return out;
  },

  // Keep every JVM warm (see triggers in wrangler.jsonc).
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(Promise.allSettled(SERVICES.map((s) =>
      (env[s] as DurableObjectNamespace<SpringService>).getByName("main").keepWarm())));
  },
} satisfies ExportedHandler<Env>;

// ── Containers ─────────────────────────────────────────────────────────────────────────

/** Passed to every service when set (blank values are skipped so app defaults apply). */
const SHARED_KEYS = [
  "JWT_SECRET", "SENTRY_DSN", "SENTRY_ENV", "EMAIL_FROM", "RESEND_API_KEY",
  "AWS_REGION", "AWS_S3_BUCKET", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "CDN_DOMAIN",
  "R2_IMAGES_ENABLED", "R2_ENDPOINT", "R2_BUCKET", "R2_PRIVATE_BUCKET", "R2_PUBLIC_BASE_URL",
  "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY",
];

/** Stop a container after this long without traffic; the 5-minute cron keeps it alive. */
const IDLE_MS = 30 * 60 * 1000;
/** Spring Boot on half a vCPU can take a few minutes to open its port. */
const STARTUP_BUDGET_MS = 6 * 60 * 1000;

abstract class SpringService extends DurableObject<Env> {
  protected abstract readonly port: number;
  protected abstract readonly heap: string;
  /** Service-specific secret/var names, on top of SHARED_KEYS. */
  protected abstract readonly keys: string[];
  /** Fixed values for this service. */
  protected readonly fixed: Record<string, string> = {};

  private starting: Promise<void> | undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const container = ctx.container;
    if (container?.running) {
      void ctx.blockConcurrencyWhile(() => container.setInactivityTimeout(IDLE_MS));
    }
  }

  override async fetch(request: Request): Promise<Response> {
    await this.ready();
    const url = new URL(request.url);
    url.protocol = "http:";
    url.host = "container";
    const forwarded = new Request(url, request);
    forwarded.headers.delete("host");
    return this.ctx.container!.getTcpPort(this.port).fetch(forwarded);
  }

  /** Called by the cron: starts the container if needed and counts as activity. */
  async keepWarm(): Promise<void> {
    await this.ready();
  }

  private ready(): Promise<void> {
    // Concurrent requests share one startup, including a retry after a failed one.
    this.starting ??= this.startAndWait().finally(() => { this.starting = undefined; });
    return this.starting;
  }

  private environment(): Record<string, string> {
    const env: Record<string, string> = {};
    for (const key of [...SHARED_KEYS, ...this.keys]) {
      const value = this.env[key];
      if (typeof value === "string" && value !== "") env[key] = value;
    }
    // Spring relaxed binding: these override spring.datasource.* in application.yml.
    const dbUrl = this.env.DB_URL, dbUser = this.env.DB_USERNAME, dbPassword = this.env.DB_PASSWORD;
    if (typeof dbUrl === "string") env.SPRING_DATASOURCE_URL = dbUrl;
    if (typeof dbUser === "string") env.SPRING_DATASOURCE_USERNAME = dbUser;
    if (typeof dbPassword === "string") {
      env.SPRING_DATASOURCE_PASSWORD = dbPassword;
      env.MYSQL_PASSWORD = dbPassword;
    }
    env.FRONTEND_URL = this.env.FRONTEND_URL;
    // Containers have no persistent disk: uploads must go to S3/R2. This only gives the
    // local-disk fallback somewhere harmless to point.
    env.UPLOAD_DIR = "/tmp/uploads";
    env.JAVA_OPTS = `-Xmx${this.heap} -XX:+UseSerialGC`;
    return { ...env, ...this.fixed };
  }

  private async startAndWait(): Promise<void> {
    const container = this.ctx.container!;
    if (!container.running) {
      container.start({ env: this.environment(), enableInternet: true });
      this.ctx.waitUntil(container.monitor()
        .then(() => console.log(`${this.constructor.name}: container exited`))
        .catch((e: unknown) => console.error(`${this.constructor.name}: container failed`, e)));
    }
    await container.setInactivityTimeout(IDLE_MS);

    // No actuator in these services, so "ready" means the port answers HTTP at all —
    // a 401 or 404 from Spring is a running app.
    const tcp = container.getTcpPort(this.port);
    const deadline = Date.now() + STARTUP_BUDGET_MS;
    let lastError: unknown;
    while (Date.now() < deadline) {
      try {
        const res = await tcp.fetch("http://container/", { signal: AbortSignal.timeout(2000) });
        await res.body?.cancel();
        return;
      } catch (error) {
        lastError = error;
        if (!container.running) throw new Error(`${this.constructor.name} exited during startup`, { cause: error });
        await scheduler.wait(1000);
      }
    }
    throw new Error(`${this.constructor.name} did not open port ${this.port}`, { cause: lastError });
  }
}

export class AuthService extends SpringService {
  protected readonly port = 8081;
  protected readonly heap = "1g";
  protected readonly keys = ["GOOGLE_CLIENT_ID", "FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET",
    "TURNSTILE_SECRET_KEY", "GOOGLE_MAPS_SERVER_KEY"];
}

export class SocialService extends SpringService {
  protected readonly port = 8082;
  protected readonly heap = "1g";
  protected readonly keys: string[] = [];
  // In-process cache instead of Redis; CacheConfig already treats cache errors as misses.
  protected override readonly fixed = { CACHE_TYPE: "simple" };
}

export class MarketplaceService extends SpringService {
  protected readonly port = 8083;
  protected readonly heap = "1g";
  protected readonly keys = ["STRIPE_SECRET_KEY", "STRIPE_CONNECT_WEBHOOK_SECRET", "STRIPE_PLATFORM_FEE_PERCENT",
    "ALGOLIA_APP_ID", "ALGOLIA_ADMIN_KEY", "ADZUNA_APP_ID", "ADZUNA_APP_KEY"];
}

export class SubscriptionService extends SpringService {
  protected readonly port = 8084;
  protected readonly heap = "320m";
  protected readonly keys = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"];
}

export class NotificationService extends SpringService {
  protected readonly port = 8085;
  protected readonly heap = "320m";
  protected readonly keys: string[] = [];
}
