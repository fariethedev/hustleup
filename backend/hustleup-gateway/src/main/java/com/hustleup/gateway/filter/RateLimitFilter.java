package com.hustleup.gateway.filter;

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
 * <p>Uses a simple token-bucket algorithm per client IP. Auth endpoints
 * get a tighter limit (5 req/sec) to prevent brute-force attacks.
 * All other endpoints get a standard limit (20 req/sec).
 *
 * <p>State resets on gateway restart. For a multi-instance deployment,
 * replace with a Redis-backed rate limiter.
 */
@Component
public class RateLimitFilter implements GlobalFilter, Ordered {

    private static final int AUTH_LIMIT = 5;        // requests per window
    private static final int DEFAULT_LIMIT = 20;    // requests per window
    private static final long WINDOW_MS = 1_000;    // 1-second sliding window

    // Tracks request counts per IP, per window
    private final Map<String, TokenBucket> buckets = new ConcurrentHashMap<>();

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String clientIp = getClientIp(exchange);
        String path = exchange.getRequest().getURI().getPath();

        int limit = path.startsWith("/api/v1/auth") ? AUTH_LIMIT : DEFAULT_LIMIT;
        String bucketKey = clientIp + ":" + (path.startsWith("/api/v1/auth") ? "auth" : "default");

        TokenBucket bucket = buckets.computeIfAbsent(bucketKey, k -> new TokenBucket(limit));

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

    private String getClientIp(ServerWebExchange exchange) {
        // Check for proxy headers first
        String xff = exchange.getRequest().getHeaders().getFirst("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        var remoteAddress = exchange.getRequest().getRemoteAddress();
        return remoteAddress != null ? remoteAddress.getAddress().getHostAddress() : "unknown";
    }

    /**
     * Simple token bucket with a sliding time window.
     * Resets the counter when the window expires.
     */
    private static class TokenBucket {
        private final AtomicLong windowStart;
        private final AtomicLong count;

        TokenBucket(int limit) {
            this.windowStart = new AtomicLong(System.currentTimeMillis());
            this.count = new AtomicLong(0);
        }

        boolean tryConsume(int limit) {
            long now = System.currentTimeMillis();
            long start = windowStart.get();

            // If window has expired, reset
            if (now - start > WINDOW_MS) {
                windowStart.set(now);
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
    }
}
