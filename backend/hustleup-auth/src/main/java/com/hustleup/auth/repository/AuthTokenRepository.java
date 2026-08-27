package com.hustleup.auth.repository;

import com.hustleup.auth.model.AuthToken;
import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

public interface AuthTokenRepository extends JpaRepository<AuthToken, UUID> {
    Optional<AuthToken> findByTokenAndPurpose(String token, AuthToken.Purpose purpose);
    /**
     * Clears a user's outstanding tokens of one kind.
     *
     * <p>{@code @Transactional} is required, not decorative: a derived delete issues a
     * DELETE statement, and without a transaction on the calling thread Hibernate refuses
     * it with "No EntityManager with actual transaction available". Callers here are plain
     * controller methods, so nothing else supplies one.
     */
    @Transactional
    void deleteByUserIdAndPurpose(UUID userId, AuthToken.Purpose purpose);

    /**
     * Looks up a code that belongs to one specific user.
     *
     * <p>Scoping to the user is what makes a six-digit code safe to use at all. Matching on
     * the code alone would mean any of the million possible values verifies *whoever*
     * currently holds it, so an attacker could confirm a stranger's address by guessing
     * numbers rather than by reading their inbox.
     */
    Optional<AuthToken> findByUserIdAndTokenAndPurpose(UUID userId, String token, AuthToken.Purpose purpose);
}
