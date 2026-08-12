package com.hustleup.auth.repository;

import com.hustleup.auth.model.AuthToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AuthTokenRepository extends JpaRepository<AuthToken, UUID> {
    Optional<AuthToken> findByTokenAndPurpose(String token, AuthToken.Purpose purpose);
    void deleteByUserIdAndPurpose(UUID userId, AuthToken.Purpose purpose);
}
