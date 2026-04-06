package com.hustleup.auth.repository;

import com.hustleup.auth.model.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

/**
 * RefreshTokenRepository — data access layer for {@link RefreshToken} entities.
 *
 * <h2>What is a Spring Data JPA repository?</h2>
 * <p>This is just an interface — there is no implementation class. Spring Data JPA
 * reads this interface at startup and automatically generates a full implementation
 * (a proxy) with all the SQL you would otherwise have to write by hand. The generated
 * class handles connection management, SQL generation, result mapping, and
 * transaction boundaries.</p>
 *
 * <h2>How JpaRepository works</h2>
 * <p>By extending {@link JpaRepository}{@code <RefreshToken, UUID>} we immediately
 * inherit standard CRUD methods:</p>
 * <ul>
 *   <li>{@code save(entity)}      — INSERT if new, UPDATE if existing</li>
 *   <li>{@code findById(id)}      — SELECT by primary key</li>
 *   <li>{@code findAll()}         — SELECT *</li>
 *   <li>{@code delete(entity)}    — DELETE</li>
 *   <li>{@code deleteById(id)}    — DELETE WHERE id = ?</li>
 *   <li>...and many more</li>
 * </ul>
 *
 * <h2>Derived query methods (the magic)</h2>
 * <p>Spring Data parses method names and generates the corresponding SQL query.
 * For example, {@code findByToken(String token)} becomes
 * {@code SELECT * FROM refresh_tokens WHERE token = ?}. The naming convention is
 * rigid: {@code findBy<FieldName>}, {@code deleteBy<FieldName>}, etc.</p>
 */
// No @Repository annotation is needed here. Spring Data JPA detects any interface
// that extends JpaRepository and registers it as a Spring-managed repository bean
// automatically. The @EnableJpaRepositories scan in AuthApplication handles discovery.
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    /**
     * Look up a refresh token record by its token string value.
     *
     * <p>Generated SQL: {@code SELECT * FROM refresh_tokens WHERE token = ? LIMIT 1}</p>
     *
     * <p>Returns an {@link Optional} rather than a nullable {@link RefreshToken} because
     * the token might not exist (invalid/expired/never issued). Optional forces the caller
     * to explicitly handle the absent case — a contract enforced at compile time.</p>
     *
     * <p>Called by {@link com.hustleup.auth.controller.AuthController#refresh} to validate
     * the token string sent by the client.</p>
     *
     * @param token the opaque refresh token string from the client request
     * @return an Optional containing the matching {@link RefreshToken}, or empty if not found
     */
    Optional<RefreshToken> findByToken(String token);

    /**
     * Delete all refresh tokens belonging to a specific user.
     *
     * <p>Generated SQL: {@code DELETE FROM refresh_tokens WHERE user_id = ?}</p>
     *
     * <p>This is used to invalidate all sessions for a user at once — for example,
     * when the user changes their password or requests a "log out everywhere" action.
     * Deleting all refresh tokens means any existing session cannot be refreshed,
     * forcing a fresh login on all devices.</p>
     *
     * <p>Note: Spring Data wraps {@code deleteBy...} methods in a transaction
     * automatically, so this is safe to call without a surrounding {@code @Transactional}
     * in the calling code (though adding one there is good practice for larger operations).</p>
     *
     * @param userId the UUID of the user whose tokens should be deleted
     */
    void deleteByUserId(UUID userId);
}
