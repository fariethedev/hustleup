package com.hustleup.common.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests for {@link JwtTokenProvider}, focused on the uniqueness guarantee the
 * {@code refresh_tokens} table depends on.
 *
 * <p>Every claim in a token other than {@code jti} is a function of the subject, the role, the
 * token type and the current <em>second</em> — {@code iat} and {@code exp} are NumericDate, so
 * milliseconds are truncated away. The signature is derived from the payload, so identical
 * payloads produce identical token strings. Two sign-ins by one user inside the same second
 * therefore used to mint the same refresh token twice, and inserting it violated the UNIQUE
 * index on {@code refresh_tokens.token} — a 500 on an ordinary login.
 */
class JwtTokenProviderTest {

    /** 32+ characters, as HS256 requires; the value itself is irrelevant to these tests. */
    private static final String SECRET = "test-secret-that-is-long-enough-for-hs256-hmac";
    private static final long ACCESS_MS = 900_000L;      // 15 minutes
    private static final long REFRESH_MS = 604_800_000L; // 7 days

    private final JwtTokenProvider provider = new JwtTokenProvider(SECRET, ACCESS_MS, REFRESH_MS);

    /**
     * The regression test proper. 500 iterations run far inside one second on any machine that
     * can run the suite, which is exactly the window where the collision used to occur — a loop
     * that took longer than a second would pass even against the unfixed code.
     */
    @Test
    @DisplayName("refresh tokens minted in the same second are all distinct")
    void refreshTokensAreUniqueWithinTheSameSecond() {
        Set<String> tokens = new HashSet<>();
        for (int i = 0; i < 500; i++) {
            tokens.add(provider.generateRefreshToken("student@hustlespace.space"));
        }
        assertThat(tokens).hasSize(500);
    }

    @Test
    @DisplayName("access tokens minted in the same second are all distinct")
    void accessTokensAreUniqueWithinTheSameSecond() {
        Set<String> tokens = new HashSet<>();
        for (int i = 0; i < 500; i++) {
            tokens.add(provider.generateAccessToken("student@hustlespace.space", "SELLER"));
        }
        assertThat(tokens).hasSize(500);
    }

    /**
     * Uniqueness must not have come at the cost of the claims anything actually reads. Guards
     * against a "fix" that made tokens differ but broke the subject, role or type round-trip.
     */
    @Test
    @DisplayName("an access token still carries a readable subject, role and type")
    void accessTokenClaimsSurvive() {
        String token = provider.generateAccessToken("student@hustlespace.space", "SELLER");

        assertThat(provider.validateToken(token)).isTrue();
        assertThat(provider.isValidAccessToken(token)).isTrue();
        assertThat(provider.getEmailFromToken(token)).isEqualTo("student@hustlespace.space");
        assertThat(provider.getRoleFromToken(token)).isEqualTo("SELLER");
        assertThat(provider.getTokenType(token)).isEqualTo(JwtTokenProvider.TYPE_ACCESS);
    }

    @Test
    @DisplayName("a refresh token validates but is rejected where an access token is required")
    void refreshTokenIsNotAcceptedAsAnAccessToken() {
        String token = provider.generateRefreshToken("student@hustlespace.space");

        assertThat(provider.validateToken(token)).isTrue();
        assertThat(provider.getEmailFromToken(token)).isEqualTo("student@hustlespace.space");
        assertThat(provider.getTokenType(token)).isEqualTo(JwtTokenProvider.TYPE_REFRESH);
        // The separation that stops a 7-day refresh token being replayed as a bearer credential.
        assertThat(provider.isValidAccessToken(token)).isFalse();
    }

    /** A token signed with a different secret must not verify against ours. */
    @Test
    @DisplayName("a token signed with another secret is rejected")
    void foreignTokenIsRejected() {
        JwtTokenProvider other = new JwtTokenProvider(
                "a-completely-different-secret-also-long-enough", ACCESS_MS, REFRESH_MS);
        String foreign = other.generateAccessToken("attacker@example.invalid", "ADMIN");

        assertThat(provider.validateToken(foreign)).isFalse();
        assertThat(provider.isValidAccessToken(foreign)).isFalse();
    }
}
