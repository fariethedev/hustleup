package com.hustleup.common.repository;

import com.hustleup.common.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA repository for {@link User} entities.
 *
 * <p><b>What is a Spring Data JPA repository?</b><br>
 * By extending {@link JpaRepository}, Spring automatically provides a full set of
 * standard CRUD operations at runtime — no implementation class is needed. Spring
 * generates a proxy (implementation) for this interface behind the scenes, wiring it
 * into the application context so it can be {@code @Autowired} or constructor-injected
 * into any Spring-managed bean.
 *
 * <p><b>Generic parameters explained:</b><br>
 * {@code JpaRepository<User, UUID>} means:
 * <ul>
 *   <li>{@code User} — the entity type managed by this repository.</li>
 *   <li>{@code UUID} — the type of the entity's primary key ({@link User#id}).</li>
 * </ul>
 * This gives us methods like {@code save(User)}, {@code findById(UUID)},
 * {@code findAll()}, {@code delete(User)}, etc., for free.
 *
 * <p><b>Custom query methods:</b><br>
 * Spring Data parses method names and derives JPQL/SQL queries automatically using a
 * naming convention (e.g. {@code findBy<Field>}, {@code existsBy<Field>}). The two
 * methods below are not boilerplate — they are essential queries used by the
 * authentication and registration flows.
 *
 * <p><b>Architecture note:</b><br>
 * This repository is defined in {@code hustleup-common} so both the auth service and the
 * user-profile service can share it without duplicating the query logic.
 */
public interface UserRepository extends JpaRepository<User, UUID> {

    /**
     * Looks up a user by their email address.
     *
     * <p><b>Why it's needed:</b><br>
     * Email is the login credential for HustleUp. During authentication, the auth service
     * calls this method to retrieve the {@link User} record (including the hashed
     * password) so it can be compared against the submitted password via
     * {@code BCryptPasswordEncoder.matches()}.
     *
     * <p><b>Return type — {@code Optional<User>}:</b><br>
     * Returning an {@link java.util.Optional} instead of a nullable {@code User} forces
     * callers to explicitly handle the "user not found" case (e.g. by calling
     * {@code .orElseThrow(UsernameNotFoundException::new)}). This prevents accidental
     * {@code NullPointerException}s.
     *
     * <p><b>Derived query:</b><br>
     * Spring Data translates {@code findByEmail} into
     * {@code SELECT u FROM User u WHERE u.email = :email}, using the unique index on the
     * {@code email} column for an O(log n) lookup.
     *
     * @param email the email address to search for (case-sensitive)
     * @return an {@code Optional} containing the matching user, or empty if not found
     */
    Optional<User> findByEmail(String email);

    /**
     * Checks whether a user with the given email already exists in the database.
     *
     * <p><b>Why it's needed:</b><br>
     * During registration, before creating a new account, the auth service calls this
     * method to detect duplicate email addresses and return a user-friendly error (instead
     * of letting the database UNIQUE constraint throw a cryptic SQL exception).
     *
     * <p><b>Why {@code boolean} rather than {@code count}?</b><br>
     * The {@code existsBy} prefix generates a {@code SELECT COUNT(*) > 0} query (or an
     * equivalent EXISTS subquery depending on the JPA provider). Returning a simple
     * {@code boolean} keeps the calling code clean — no need to check {@code count > 0}.
     *
     * <p><b>Derived query:</b><br>
     * Translates to {@code SELECT CASE WHEN COUNT(u) > 0 THEN TRUE ELSE FALSE END
     * FROM User u WHERE u.email = :email}.
     *
     * @param email the email address to check for existence
     * @return {@code true} if a user with that email exists, {@code false} otherwise
     */
    boolean existsByEmail(String email);
}
