package com.hustleup.auth.repository;

import com.hustleup.auth.model.AuthToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AuthTokenRepository extends JpaRepository<AuthToken, UUID> {
    Optional<AuthToken> findByTokenAndPurpose(String token, AuthToken.Purpose purpose);
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
