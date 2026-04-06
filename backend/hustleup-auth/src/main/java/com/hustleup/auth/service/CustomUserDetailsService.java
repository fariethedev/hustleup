package com.hustleup.auth.service;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;
import java.util.List;

/**
 * CustomUserDetailsService — the bridge between the application's User model
 * and Spring Security's authentication machinery.
 *
 * <h2>Why does this class exist?</h2>
 * <p>Spring Security's {@link org.springframework.security.authentication.AuthenticationManager}
 * needs a way to load a user's credentials from your data store when verifying a
 * username/password pair. It does this by calling a {@link UserDetailsService} bean.
 * Spring provides a few default implementations (e.g., in-memory, JDBC), but we need
 * to load users from our own PostgreSQL database via JPA. This class provides that
 * custom implementation.</p>
 *
 * <h2>How it fits into the authentication flow</h2>
 * <ol>
 *   <li>A client sends {@code POST /api/v1/auth/login} with email + password.</li>
 *   <li>{@link com.hustleup.auth.controller.AuthController#login} calls
 *       {@code authenticationManager.authenticate(...)}.</li>
 *   <li>The {@code DaoAuthenticationProvider} (wired by Spring Security auto-config)
 *       calls <strong>this</strong> method to load the {@link UserDetails} for the given
 *       username (email).</li>
 *   <li>Spring Security then compares the provided plain-text password with the stored
 *       BCrypt hash using the configured {@link org.springframework.security.crypto.password.PasswordEncoder}.</li>
 *   <li>If they match, authentication succeeds; otherwise a {@code BadCredentialsException}
 *       is thrown and the login attempt fails.</li>
 * </ol>
 *
 * <h2>Why "CustomUserDetails" and not just UserDetails?</h2>
 * <p>The interface method is named {@code loadUserByUsername} because Spring Security
 * was designed for username-based auth. We simply treat the email address as the
 * "username". The naming is legacy — the concept is identical.</p>
 */
// @Service registers this class as a Spring-managed bean in the IoC container.
// Spring Security's auto-configuration detects a UserDetailsService bean and automatically
// wires it into the DaoAuthenticationProvider — no manual configuration required.
@Service
public class CustomUserDetailsService implements UserDetailsService {

    // Repository for loading User entities from the database.
    // Injected via constructor (the single-constructor injection shorthand — no @Autowired needed).
    private final UserRepository userRepository;

    /**
     * Constructor injection — Spring supplies the {@link UserRepository} bean automatically.
     *
     * @param userRepository Spring Data JPA repository for {@link User} entities
     */
    public CustomUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Load a user's security details by their email address.
     *
     * <p>This method is called by Spring Security's {@code DaoAuthenticationProvider}
     * during the authentication process. It must:</p>
     * <ol>
     *   <li>Find the user in the data store.</li>
     *   <li>Return a {@link UserDetails} object containing the email, hashed password,
     *       and granted authorities (roles).</li>
     * </ol>
     *
     * <p>If the user is not found, throwing {@link UsernameNotFoundException} is the
     * contract defined by the interface. Spring Security catches this and converts it
     * to a {@code BadCredentialsException} so attackers cannot distinguish between
     * "wrong password" and "user doesn't exist" (prevents user enumeration attacks).</p>
     *
     * @param email the email address submitted by the client — treated as the "username"
     * @return a populated {@link UserDetails} object ready for password comparison
     * @throws UsernameNotFoundException if no user with this email exists in the database
     */
    // @Override confirms we are implementing the interface method — the compiler will
    // flag an error if the signature doesn't match, which is a useful safety net.
    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        // Query the DB for a User with this email. findByEmail is a Spring Data
        // derived query method — Spring generates "SELECT * FROM users WHERE email = ?" for us.
        // orElseThrow() unwraps the Optional, or throws if empty.
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));

        // Construct Spring Security's built-in User object (note: this is
        // org.springframework.security.core.userdetails.User, NOT our domain User entity).
        // We pass:
        //   1. The principal name (email) — used as the identity throughout the security context.
        //   2. The BCrypt-hashed password — Spring Security will call passwordEncoder.matches()
        //      against the plain-text password supplied at login.
        //   3. A list of GrantedAuthority objects — represent the permissions/roles this user has.
        //      SimpleGrantedAuthority("ROLE_BUYER") follows Spring Security's convention of
        //      prefixing role names with "ROLE_". @PreAuthorize("hasRole('BUYER')") and
        //      hasAuthority("ROLE_BUYER") both rely on this prefix.
        return new org.springframework.security.core.userdetails.User(
                user.getEmail(),   // principal name (the "username" in Spring Security terms)
                user.getPassword(), // BCrypt hash — never the plain-text password
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())) // e.g. ROLE_BUYER
        );
    }
}
