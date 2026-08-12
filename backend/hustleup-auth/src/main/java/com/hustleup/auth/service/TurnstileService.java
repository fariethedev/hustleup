/**
 * Verifies Cloudflare Turnstile tokens submitted with the registration form.
 *
 * <p>If {@code app.turnstile.secret-key} is blank (the default until a real key is
 * configured), {@link #verify} always returns true — registration isn't broken for
 * anyone running without bot protection set up, mirroring how {@code EmailService}
 * degrades to a no-op without a Resend key.
 */
package com.hustleup.auth.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
@Slf4j
public class TurnstileService {

    private static final String SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

    private final String secretKey;
    private final RestTemplate restTemplate = new RestTemplate();

    public TurnstileService(@Value("${app.turnstile.secret-key:}") String secretKey) {
        this.secretKey = secretKey;
    }

    public boolean verify(String token) {
        if (secretKey == null || secretKey.isBlank()) {
            return true; // not configured — don't block registration
        }
        if (token == null || token.isBlank()) {
            return false; // configured, but the client sent nothing
        }
        try {
            Map<String, String> body = Map.of("secret", secretKey, "response", token);
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(SITEVERIFY_URL, body, Map.class);
            return response != null && Boolean.TRUE.equals(response.get("success"));
        } catch (Exception e) {
            log.warn("Turnstile verification call failed: {}", e.getMessage());
            return false; // fail closed — a broken verification call shouldn't let bots through
        }
    }
}
