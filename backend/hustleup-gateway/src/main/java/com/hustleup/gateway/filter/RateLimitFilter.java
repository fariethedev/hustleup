package com.hustleup.gateway.filter;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * In-memory rate limiter applied as a global gateway filter.
 *
 * <p>Uses a simple fixed-window counter per client IP. Auth endpoints
 * get a tighter limit (5 req/sec) to slow down credential brute-forcing.
 * All other endpoints get a standard limit (20 req/sec).
 *
 * <p>State resets on gateway restart, and each instance counts independently.
 * For a multi-instance deployment, replace with a Redis-backed rate limiter.
 *
 * <h2>Client IP and {@code X-Forwarded-For}</h2>
 * <p>{@code X-Forwarded-For} is just a request header: any client can set it to anything.
 * Trusting it unconditionally means an attacker rotates a fake value per request, lands in
 * a fresh bucket every time, and the limiter stops existing — which matters most precisely
 * where it matters most, the tighter bucket in front of {@code /api/v1/auth}.
 *
 * <p>The header is only meaningful when something we control (a load balancer, ingress, or
 * reverse proxy) appends the real peer address and strips inbound copies. Whether that is
 * true is a deployment fact this code cannot detect, so it is configuration:
 * {@code app.gateway.trust-proxy}, defaulting to {@code false}. Deployed behind a proxy,
 * set it to {@code true}; exposed directly, leave it off and the limiter keys on the actual
 * TCP peer address, which a client cannot forge.
 */
@Component
public class RateLimitFilter implements GlobalFilter, Ordered {

    private static final int AUTH_LIMIT = 5;        // requests per window
    private static final int DEFAULT_LIMIT = 20;    // requests per window
    private static final long WINDOW_MS = 1_000;    // 1-second fixed window

    /**
     * Cap on distinct tracked keys.
     *
     * <p>Without a cap this map only ever grows: one entry per source IP, never removed.
     * A spray of requests from many addresses (or, with {@code trust-proxy} on, many forged
     * header values) is then an unauthenticated memory-exhaustion attack against the gateway
     * — the component every other service sits behind. When the cap is hit, expired buckets
     * are swept; if that frees nothing, the map is cleared outright. Both are safe: a lost
     * bucket costs a client at most one extra window of allowance, and never grants access.
     */
    private static final int MAX_TRACKED_KEYS = 100_000;

    // Tracks request counts per IP, per window
    private final Map<String, TokenBucket> buckets = new ConcurrentHashMap<>();

    /** See the class javadoc — only enable when a trusted proxy sets X-Forwarded-For. */
    @Value("${app.gateway.trust-proxy:false}")
    private boolean trustProxy;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String clientIp = getClientIp(exchange);
        String path = exchange.getRequest().getURI().getPath();

        boolean isAuthPath = path.startsWith("/api/v1/auth");
        int limit = isAuthPath ? AUTH_LIMIT : DEFAULT_LIMIT;
        String bucketKey = clientIp + ":" + (isAuthPath ? "auth" : "default");

        if (buckets.size() >= MAX_TRACKED_KEYS) {
            evictStaleBuckets();
        }

        TokenBucket bucket = buckets.computeIfAbsent(bucketKey, k -> new TokenBucket());

        if (!bucket.tryConsume(limit)) {
            exchange.getResponse().setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
            exchange.getResponse().getHeaders().set("Retry-After", "1");
            exchange.getResponse().getHeaders().set("X-RateLimit-Limit", String.valueOf(limit));
            return exchange.getResponse().setComplete();
        }

        // Add rate limit headers to successful responses
        exchange.getResponse().getHeaders().set("X-RateLimit-Limit", String.valueOf(limit));
        exchange.getResponse().getHeaders().set("X-RateLimit-Remaining",
                String.valueOf(Math.max(0, limit - bucket.getCount())));

        return chain.filter(exchange);
    }

    @Override
    public int getOrder() {
        return -1; // Execute before routing filters
    }

    /**
     * Drops buckets whose window has already elapsed — they carry no state that still
     * constrains anyone. If the sweep frees nothing (every bucket is currently active, i.e.
     * a genuine flood), the map is cleared so memory stays bounded regardless.
     */
    private void evictStaleBuckets() {
        long now = System.currentTimeMillis();
        buckets.values().removeIf(b -> now - b.getWindowStart() > WINDOW_MS);
        if (buckets.size() >= MAX_TRACKED_KEYS) {
            buckets.clear();
        }
    }

    /**
     * Resolves the address to rate-limit on: the forwarded client address when we are
     * configured to sit behind a trusted proxy, otherwise the unspoofable TCP peer.
     */
    private String getClientIp(ServerWebExchange exchange) {
        if (trustProxy) {
            // Left-most entry is the original client, appended by our own proxy.
            String xff = exchange.getRequest().getHeaders().getFirst("X-Forwarded-For");
            if (xff != null && !xff.isBlank()) {
                return xff.split(",")[0].trim();
            }
        }
        var remoteAddress = exchange.getRequest().getRemoteAddress();
        return remoteAddress != null && remoteAddress.getAddress() != null
                ? remoteAddress.getAddress().getHostAddress()
                : "unknown";
    }

    /**
     * Fixed-window counter. Resets the count when the window expires.
     */
    private static class TokenBucket {
        private final AtomicLong windowStart;
        private final AtomicLong count;

        TokenBucket() {
            this.windowStart = new AtomicLong(System.currentTimeMillis());
            this.count = new AtomicLong(0);
        }

        boolean tryConsume(int limit) {
            long now = System.currentTimeMillis();
            long start = windowStart.get();

            // If window has expired, reset. compareAndSet ensures only one concurrent
            // caller performs the reset; the losers fall through to the increment below
            // and are counted against the new window rather than skipping the check.
            if (now - start > WINDOW_MS && windowStart.compareAndSet(start, now)) {
                count.set(1);
                return true;
            }

            // Increment and check
            long current = count.incrementAndGet();
            return current <= limit;
        }

        long getCount() {
            return count.get();
        }

        long getWindowStart() {
            return windowStart.get();
        }
    }
}
