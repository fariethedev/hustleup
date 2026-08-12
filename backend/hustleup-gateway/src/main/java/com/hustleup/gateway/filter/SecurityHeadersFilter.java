package com.hustleup.gateway.filter;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Adds baseline security response headers to everything served through the gateway.
 *
 * <p>Every response — API JSON and, importantly, the user-uploaded files proxied under
 * {@code /uploads/**} — passes through here, so this is the one place that covers the
 * whole surface without touching each service.
 *
 * <h2>What each header defends against</h2>
 * <ul>
 *   <li><b>X-Content-Type-Options: nosniff</b> — stops browsers from ignoring the declared
 *       {@code Content-Type} and guessing from the bytes. This is the header that matters
 *       most for {@code /uploads/**}: without it, a file stored as an image but containing
 *       markup can be sniffed into {@code text/html} and executed on our own origin. Uploads
 *       are already restricted to an image/video allowlist in {@code FileStorageService};
 *       this is the second, independent layer.</li>
 *   <li><b>X-Frame-Options: DENY</b> — blocks framing of our responses, so an attacker
 *       cannot overlay the UI in a hidden iframe and harvest clicks (clickjacking).</li>
 *   <li><b>Referrer-Policy: strict-origin-when-cross-origin</b> — trims the {@code Referer}
 *       sent to third parties to the bare origin, so path segments containing identifiers
 *       (profile ids, reset links) do not leak to external sites.</li>
 *   <li><b>Content-Security-Policy</b> — a deliberately narrow policy scoped to API and
 *       upload responses: no scripts, no framing, no plugins. It makes an uploaded file
 *       inert even if it somehow reaches a browser as an active document. It is NOT a
 *       policy for the SPA's own HTML, which the gateway does not serve (Vite/the static
 *       host does) and which needs a far more permissive script policy.</li>
 *   <li><b>Strict-Transport-Security</b> — pins future visits to HTTPS. Only meaningful
 *       over an already-secure connection; browsers ignore it on plain HTTP, so it is
 *       harmless in local development.</li>
 * </ul>
 *
 * <p>Headers are set just before the response commits (rather than up front) so they are
 * applied to whatever the downstream service produced, and {@code setIfAbsent} is used so a
 * service that deliberately sets its own value keeps it.
 */
@Component
public class SecurityHeadersFilter implements GlobalFilter, Ordered {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        exchange.getResponse().beforeCommit(() -> {
            HttpHeaders headers = exchange.getResponse().getHeaders();
            setIfAbsent(headers, "X-Content-Type-Options", "nosniff");
            setIfAbsent(headers, "X-Frame-Options", "DENY");
            setIfAbsent(headers, "Referrer-Policy", "strict-origin-when-cross-origin");
            setIfAbsent(headers, "Content-Security-Policy",
                    "default-src 'none'; img-src 'self' data:; media-src 'self'; "
                            + "frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
            setIfAbsent(headers, "Strict-Transport-Security", "max-age=31536000; includeSubDomains");
            return Mono.empty();
        });
        return chain.filter(exchange);
    }

    /** Sets {@code name} only when the downstream service did not already provide it. */
    private static void setIfAbsent(HttpHeaders headers, String name, String value) {
        if (!headers.containsKey(name)) {
            headers.set(name, value);
        }
    }

    @Override
    public int getOrder() {
        // After the rate limiter (-1) but still ahead of routing, so short-circuited
        // responses and proxied responses alike pick the headers up.
        return 0;
    }
}
