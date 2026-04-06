package com.hustleup.auth;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.context.annotation.ComponentScan;

/**
 * AuthApplication — the entry point for the HustleUp Authentication Service.
 *
 * <p>This microservice is solely responsible for user identity: registration, login,
 * token issuance, token refresh, and basic profile management. Keeping auth in its
 * own service means the rest of the platform can be scaled, deployed, or rewritten
 * independently without touching security-sensitive code.</p>
 *
 * <h2>How a Spring Boot application starts</h2>
 * <p>When Java runs {@code main()}, {@link SpringApplication#run} bootstraps the entire
 * Spring IoC container (the "Application Context"). Spring scans the classpath for
 * components ({@code @Service}, {@code @Repository}, {@code @Controller}, etc.),
 * wires their dependencies together, applies all {@code @Configuration} classes, and
 * finally starts the embedded web server (Tomcat by default).</p>
 *
 * <h2>Why the extra scan annotations?</h2>
 * <p>The shared {@code hustleup-common} library lives under the {@code com.hustleup.common}
 * package — a different package root than this service ({@code com.hustleup.auth}).
 * By default, {@code @SpringBootApplication} only scans the package it lives in and its
 * sub-packages. The three explicit scan annotations below widen that scope to the entire
 * {@code com.hustleup} namespace so that shared entities, repositories, and components
 * from the common library are picked up automatically.</p>
 */
// @SpringBootApplication is a convenience annotation that combines three annotations:
//   1. @Configuration       — marks this class as a source of Spring bean definitions
//   2. @EnableAutoConfiguration — tells Spring Boot to auto-configure beans based on
//                                  what's on the classpath (e.g. DataSource, Security, JPA)
//   3. @ComponentScan        — scans for @Component, @Service, @Repository, @Controller, etc.
@SpringBootApplication

// Tells Spring Data JPA where to look for Repository interfaces.
// Without this, only repositories under com.hustleup.auth would be detected.
// We point at "com.hustleup" so repositories in hustleup-common are included too.
@EnableJpaRepositories(basePackages = "com.hustleup")

// Tells Hibernate (the JPA implementation) where @Entity classes live.
// It needs this to build the database schema and generate SQL queries.
// Again, broadened to "com.hustleup" to catch shared entities like User.
@EntityScan(basePackages = "com.hustleup")

// Broadens Spring's component scan beyond the default package.
// Picks up @Service, @Component, @Configuration, etc. from hustleup-common.
@ComponentScan(basePackages = "com.hustleup")
public class AuthApplication {

    /**
     * Application entry point.
     *
     * <p>{@link SpringApplication#run} does all the heavy lifting:
     * it creates the Spring context, registers all beans, runs any
     * {@code CommandLineRunner} / {@code ApplicationRunner} beans, and
     * then starts the embedded HTTP server so the service is ready to
     * accept requests.</p>
     *
     * @param args command-line arguments forwarded by the JVM (e.g. {@code --server.port=9090})
     */
    public static void main(String[] args) {
        // Hand control to Spring Boot. From here, everything is managed by the framework.
        SpringApplication.run(AuthApplication.class, args);
    }
}
