package com.hustleup.notification.config;

import com.hustleup.common.security.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.socket.config.annotation.*;

import java.util.List;

/**
 * Real-time messaging transport.
 *
 * <p><strong>How a client authenticates.</strong> Not at the HTTP handshake — a browser
 * cannot attach an {@code Authorization} header to a WebSocket upgrade, so the handshake
 * is necessarily anonymous and {@code CommonSecurityConfig} permits {@code /ws/**}.
 * Instead the first STOMP frame, {@code CONNECT}, carries the bearer token as a native
 * header, and {@link #configureClientInboundChannel} validates it there. A session that
 * fails that check is refused before it can subscribe to anything.
 *
 * <p>Clients pass it via stomp.js {@code connectHeaders}:
 * <pre>{@code new Client({ brokerURL, connectHeaders: { Authorization: `Bearer ${token}` } })}</pre>
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtTokenProvider jwtTokenProvider;

    /**
     * Origins allowed to open a socket. Shares CORS_ALLOWED_ORIGINS with the gateway so
     * the two cannot drift apart; the localhost default keeps development working.
     */
    private final String[] allowedOrigins;

    public WebSocketConfig(
            JwtTokenProvider jwtTokenProvider,
            @Value("${CORS_ALLOWED_ORIGINS:http://localhost:5173,http://localhost:5174,http://localhost:3000}")
            String allowedOrigins) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.allowedOrigins = allowedOrigins.split("\\s*,\\s*");
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // SECURITY: this was setAllowedOriginPatterns("*"), which let any site on the
        // internet open an authenticated socket from a visitor's browser. Restricted to
        // the app's own origins, matching the gateway's CORS policy.
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(allowedOrigins)
                .withSockJS();
    }

    /**
     * Validates the JWT on the STOMP {@code CONNECT} frame and binds the caller's identity
     * to the session, so {@code /user/**} destinations resolve to the right person.
     *
     * <p>Only CONNECT is checked. Later frames on an established session inherit the
     * Principal set here, and re-parsing the token on every SEND would cost a signature
     * verification per chat message for no added safety.
     */
    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor =
                        MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

                if (accessor == null || !StompCommand.CONNECT.equals(accessor.getCommand())) {
                    return message;
                }

                String header = accessor.getFirstNativeHeader("Authorization");
                String token = (header != null && header.startsWith("Bearer "))
                        ? header.substring(7)
                        : null;

                // isValidAccessToken covers signature, expiry AND the token-type claim, so a
                // refresh token cannot be swapped in here to open a socket.
                if (token == null || !jwtTokenProvider.isValidAccessToken(token)) {
                    throw new IllegalArgumentException("STOMP CONNECT rejected: missing or invalid access token");
                }

                String email = jwtTokenProvider.getEmailFromToken(token);
                String role = jwtTokenProvider.getRoleFromToken(token);
                var authorities = (role == null || role.isBlank())
                        ? List.<SimpleGrantedAuthority>of()
                        : List.of(new SimpleGrantedAuthority("ROLE_" + role));

                accessor.setUser(new UsernamePasswordAuthenticationToken(email, null, authorities));
                return message;
            }
        });
    }
}
