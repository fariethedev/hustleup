/**
 * Verifies Google and Facebook OAuth access tokens submitted by the frontend's implicit
 * login flows (Google's {@code useGoogleLogin}, Facebook's JS SDK), and trades a verified
 * token for the account's email/name — all {@link com.hustleup.auth.controller.AuthController}
 * needs to find-or-create the local {@code User} row.
 *
 * <h2>Why "verify" here means checking the audience, not just calling userinfo</h2>
 * <p>An OAuth <em>access token</em> is a bearer credential issued to a specific OAuth
 * client. Provider userinfo endpoints — Google's {@code /oauth2/v3/userinfo}, Facebook's
 * {@code /me} — happily accept <em>any</em> valid token for that provider and return the
 * matching profile. They answer "who is this token's user?", <b>not</b> "was this token
 * issued to <i>you</i>?".
 *
 * <p>Trusting a bare userinfo lookup is therefore an account-takeover hole, the classic
 * OAuth "confused deputy" / audience-confusion bug: an attacker registers their own
 * Google or Facebook app, gets any victim to sign into it (or simply harvests tokens from
 * an app they already run), then POSTs that victim's access token to
 * {@code /api/v1/auth/oauth/google}. Userinfo returns the victim's email, and this service
 * would have handed the attacker a fully-valid HustleUp session for the victim's account —
 * including any pre-existing password-registered account with the same address.
 *
 * <p>The fix is to validate the token's <b>audience</b> against our own credentials before
 * trusting the identity in it:
 * <ul>
 *   <li><b>Google</b> — {@code /tokeninfo} returns the {@code aud} the token was minted
 *       for; it must equal our {@code GOOGLE_CLIENT_ID}.</li>
 *   <li><b>Facebook</b> — {@code /debug_token}, called with our own app access token,
 *       returns the {@code app_id} the token belongs to plus an {@code is_valid} flag;
 *       the app id must equal our {@code FACEBOOK_APP_ID}.</li>
 * </ul>
 *
 * <p>We additionally require the provider to report the address as <b>verified</b>. Without
 * that, anyone able to create a provider account claiming an arbitrary unverified email
 * could use it to log into that email's existing HustleUp account.
 *
 * <h2>Fail closed</h2>
 * <p>If the corresponding credentials are not configured, social login is <em>refused</em>
 * rather than silently downgraded to an unverified userinfo lookup. An unconfigured
 * deployment loses a login button; a silently-downgraded one is exploitable.
 */
package com.hustleup.auth.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Map;

@Service
@Slf4j
public class SocialAuthService {

    private static final String GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";
    private static final String GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
    private static final String FACEBOOK_DEBUG_TOKEN_URL = "https://graph.facebook.com/debug_token";
    private static final String FACEBOOK_ME_URL = "https://graph.facebook.com/me";

    private final RestTemplate restTemplate = new RestTemplate();

    /** Our Google OAuth client id — the only {@code aud} value we accept tokens for. */
    private final String googleClientId;

    /** Our Facebook app id — the only {@code app_id} we accept tokens for. */
    private final String facebookAppId;

    /** Facebook app secret, needed to build the app access token that {@code /debug_token} requires. */
    private final String facebookAppSecret;

    public SocialAuthService(
            @Value("${app.google.client-id:}") String googleClientId,
            @Value("${app.facebook.app-id:}") String facebookAppId,
            @Value("${app.facebook.app-secret:}") String facebookAppSecret) {
        this.googleClientId = googleClientId;
        this.facebookAppId = facebookAppId;
        this.facebookAppSecret = facebookAppSecret;
    }

    public record SocialProfile(String email, String name) {}

    /**
     * Verifies a Google access token was issued to <em>this</em> application, then returns
     * the verified email/name behind it.
     *
     * @throws IllegalArgumentException if Google login is not configured, the token is
     *         invalid, it was issued to a different OAuth client, or the email is unverified
     */
    public SocialProfile verifyGoogle(String accessToken) {
        if (googleClientId == null || googleClientId.isBlank()) {
            log.warn("Google sign-in attempted but GOOGLE_CLIENT_ID is not configured — refusing");
            throw new IllegalArgumentException("Google sign-in is not available");
        }
        if (accessToken == null || accessToken.isBlank()) {
            throw new IllegalArgumentException("Invalid Google token");
        }

        try {
            // Step 1 — audience check. tokeninfo tells us which client the token was minted
            // for. A token from any other Google app is rejected here, before we ever look
            // up an identity with it.
            @SuppressWarnings("unchecked")
            Map<String, Object> tokenInfo = restTemplate.getForObject(
                    UriComponentsBuilder.fromUriString(GOOGLE_TOKENINFO_URL)
                            .queryParam("access_token", accessToken)
                            .toUriString(), Map.class);

            if (tokenInfo == null) {
                throw new IllegalArgumentException("Invalid Google token");
            }

            String audience = asString(tokenInfo.get("aud"));
            if (!googleClientId.equals(audience)) {
                log.warn("Rejected Google token issued to a different OAuth client (aud={})", audience);
                throw new IllegalArgumentException("Invalid Google token");
            }

            // Step 2 — identity. tokeninfo often carries the email already; fall back to
            // userinfo only once the audience above has been proven to be ours.
            String email = asString(tokenInfo.get("email"));
            boolean emailVerified = isTrue(tokenInfo.get("email_verified"));
            String name = asString(tokenInfo.get("name"));

            if (email == null || email.isBlank()) {
                @SuppressWarnings("unchecked")
                Map<String, Object> profile = restTemplate.getForObject(
                        UriComponentsBuilder.fromUriString(GOOGLE_USERINFO_URL)
                                .queryParam("access_token", accessToken)
                                .toUriString(), Map.class);
                if (profile != null) {
                    email = asString(profile.get("email"));
                    emailVerified = isTrue(profile.get("email_verified"));
                    if (name == null) name = asString(profile.get("name"));
                }
            }

            if (email == null || email.isBlank()) {
                throw new IllegalArgumentException("Google did not return an email for this token");
            }
            if (!emailVerified) {
                // Without this, a provider account claiming an arbitrary unverified address
                // could be used to sign into that address's existing HustleUp account.
                throw new IllegalArgumentException("This Google account's email is not verified");
            }

            return new SocialProfile(email, name != null && !name.isBlank() ? name : email);
        } catch (RestClientException e) {
            log.warn("Google token verification failed: {}", e.getMessage());
            throw new IllegalArgumentException("Invalid Google token", e);
        }
    }

    /**
     * Verifies a Facebook access token was issued to <em>this</em> app, then returns the
     * verified email/name behind it.
     *
     * @throws IllegalArgumentException if Facebook login is not configured, the token is
     *         invalid, it belongs to a different app, or the account has no email
     */
    public SocialProfile verifyFacebook(String accessToken) {
        if (facebookAppId == null || facebookAppId.isBlank()
                || facebookAppSecret == null || facebookAppSecret.isBlank()) {
            log.warn("Facebook sign-in attempted but FACEBOOK_APP_ID/FACEBOOK_APP_SECRET are not configured — refusing");
            throw new IllegalArgumentException("Facebook sign-in is not available");
        }
        if (accessToken == null || accessToken.isBlank()) {
            throw new IllegalArgumentException("Invalid Facebook token");
        }

        try {
            // Step 1 — audience check via debug_token, authenticated with our app access
            // token ("<app-id>|<app-secret>"). This is the only call that can tell us which
            // app the user token actually belongs to.
            @SuppressWarnings("unchecked")
            Map<String, Object> debug = restTemplate.getForObject(
                    UriComponentsBuilder.fromUriString(FACEBOOK_DEBUG_TOKEN_URL)
                            .queryParam("input_token", accessToken)
                            .queryParam("access_token", facebookAppId + "|" + facebookAppSecret)
                            .toUriString(), Map.class);

            Object dataObj = debug != null ? debug.get("data") : null;
            if (!(dataObj instanceof Map<?, ?> data)) {
                throw new IllegalArgumentException("Invalid Facebook token");
            }
            if (!isTrue(data.get("is_valid"))) {
                throw new IllegalArgumentException("Invalid Facebook token");
            }
            String tokenAppId = asString(data.get("app_id"));
            if (!facebookAppId.equals(tokenAppId)) {
                log.warn("Rejected Facebook token issued to a different app (app_id={})", tokenAppId);
                throw new IllegalArgumentException("Invalid Facebook token");
            }

            // Step 2 — identity, now that the token is proven to be ours.
            @SuppressWarnings("unchecked")
            Map<String, Object> profile = restTemplate.getForObject(
                    UriComponentsBuilder.fromUriString(FACEBOOK_ME_URL)
                            .queryParam("fields", "id,name,email")
                            .queryParam("access_token", accessToken)
                            .toUriString(), Map.class);

            String email = profile != null ? asString(profile.get("email")) : null;
            if (email == null || email.isBlank()) {
                // Some Facebook accounts have no verified email attached — we can't create
                // an account keyed by email in that case, so surface a clear error instead
                // of a confusing downstream NPE.
                throw new IllegalArgumentException("This Facebook account has no email address — try email signup instead");
            }
            String name = asString(profile.get("name"));
            return new SocialProfile(email, name != null && !name.isBlank() ? name : email);
        } catch (RestClientException e) {
            log.warn("Facebook token verification failed: {}", e.getMessage());
            throw new IllegalArgumentException("Invalid Facebook token", e);
        }
    }

    /** Null-safe {@code toString} — provider JSON fields arrive as loosely-typed Objects. */
    private static String asString(Object value) {
        return value != null ? value.toString() : null;
    }

    /**
     * Both providers are inconsistent about whether booleans arrive as a JSON boolean or as
     * the string {@code "true"}, so accept either rather than silently reading {@code false}.
     */
    private static boolean isTrue(Object value) {
        return Boolean.TRUE.equals(value) || "true".equalsIgnoreCase(String.valueOf(value));
    }
}
