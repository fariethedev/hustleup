/**
 * Entry point for the HustleUp Social microservice.
 *
 * <p>This service is responsible for all social-graph features of the HustleUp platform:
 * posts (the feed), comments, likes, stories, follow relationships, and dating profiles.
 * It is packaged as a standalone Spring Boot application so it can be deployed and scaled
 * independently of the other microservices (e.g. marketplace, messaging).
 *
 * <h2>Architecture overview</h2>
 * <pre>
 *  Client  ──▶  FeedController / FollowController / StoryController / DatingController
 *                      │
 *                      ├─▶ Repositories (JPA / MySQL)
 *                      ├─▶ StoryService  (business logic + scheduled cleanup)
 *                      ├─▶ RecommendationEngine  (scoring algorithm)
 *                      ├─▶ FeedEventPublisher  (Kafka events)
 *                      └─▶ FileStorageService (shared, from hustleup-common)
 * </pre>
 *
 * <h2>Package scanning</h2>
 * Spring Boot only auto-scans the package of the main class by default.
 * Because some entities and repositories live in {@code com.hustleup.common.*} (a shared
 * library jar), we must explicitly tell Spring where to look using the annotations below.
 */
package com.hustleup.social;

import com.hustleup.common.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.transaction.annotation.Transactional;

// @SpringBootApplication is a meta-annotation that combines:
//   @Configuration  – this class can declare @Bean methods
//   @EnableAutoConfiguration – let Spring Boot wire common infrastructure automatically
//   @ComponentScan  – scan for @Component/@Service/@Repository (extended below)
@SpringBootApplication

// Scan JPA repositories in BOTH the common library and this service's own repository package.
// Without this, Spring Data would only pick up repositories under com.hustleup.social.
@EnableJpaRepositories(basePackages = {"com.hustleup.common.repository", "com.hustleup.social.repository"})

// Tell Hibernate to discover @Entity classes in both the common model package (e.g. User)
// and the social service's own models (Post, Story, Follow, etc.).
@EntityScan(basePackages = {"com.hustleup.common.model", "com.hustleup.social.model"})

// Ensure Spring picks up @Service/@Component beans from the common library (e.g. FileStorageService).
@ComponentScan(basePackages = {"com.hustleup.social", "com.hustleup.common"})
public class SocialApplication {

    /**
     * Application entry point.
     *
     * <p>Delegates to {@link SpringApplication#run} which bootstraps the full Spring
     * application context, starts the embedded Tomcat server, and begins serving HTTP traffic.
     *
     * @param args command-line arguments forwarded from the OS (e.g. --server.port=8082)
     */
    public static void main(String[] args) {
        SpringApplication.run(SocialApplication.class, args);
    }

    /**
     * One-time data-quality fix that runs automatically on every startup.
     *
     * <p>Early in development, a test account was created with several misspellings of its
     * email address ("geographgy", "geographhy", "geograpgy"). This runner canonicalises
     * all those variants to the single correct address so the account remains usable.
     *
     * <p>Using {@link CommandLineRunner} means this code runs after the full Spring context
     * is ready (repositories are injected, database connection is open) but before the
     * application starts accepting HTTP requests.
     *
     * <p>{@code @Transactional} ensures that all the save() calls in the loop are wrapped
     * in a single database transaction — if anything fails, every update is rolled back.
     *
     * @param userRepository the JPA repository used to load and persist User records
     * @return a lambda that Spring Boot will invoke once on startup
     */
    @Bean
    @Transactional
    public CommandLineRunner socialStabilizer(UserRepository userRepository) {
        return args -> {
            // Iterate over every user; fix any that have a known misspelled email.
            userRepository.findAll().forEach(u -> {
                String email = u.getEmail();
                // Check all three known misspellings of "geograpghy@gmail.com".
                if (email != null && (email.contains("geographgy") || email.contains("geographhy") || email.contains("geograpgy"))) {
                    u.setEmail("geograpghy@gmail.com"); // canonical address
                    userRepository.save(u);             // persist the correction
                }
            });
        };
    }
}
